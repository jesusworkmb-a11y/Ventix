import { useEffect, useState } from 'react';
import { reporteVentas, reporteArticulosMasVendidos, reporteInventarioValorizado } from '../../reportes/api/reportes.api';
import { listarSesiones, obtenerSesion } from '../../caja/api/caja.api';
import { listarExistencias } from '../../inventario/api/inventario.api';
import { listarClientes } from '../../clientes/api/clientes.api';
import { listarVentas } from '../../ventas/api/ventas.api';
import { listarCompras } from '../../compras/api/compras.api';
import { listarAjustes } from '../../inventario/api/ajustes.api';

const SIGNO_POR_TIPO = { INGRESO: 1, VENTA: 1, RETIRO: -1, DEVOLUCION: -1 };

function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

function nombreDia(fecha) {
  return fecha.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
}

async function calcularCajaActual() {
  const sesiones = await listarSesiones({ abierta: 'true' });
  if (!sesiones.length) return { total: 0, abiertas: 0 };

  const detalles = await Promise.all(sesiones.map((s) => obtenerSesion(s.id)));
  const total = detalles.reduce((acc, sesion) => {
    const neto = sesion.movimientos.reduce(
      (a, m) => a + Number(m.monto) * (SIGNO_POR_TIPO[m.tipo] || 0),
      Number(sesion.fondoInicial),
    );
    return acc + neto;
  }, 0);
  return { total, abiertas: sesiones.length };
}

function fusionarMovimientos({ ventas, compras, ajustes, clientes }) {
  const items = [
    ...ventas.slice(0, 5).map((v) => ({
      tipo: 'venta',
      titulo: `Venta ${v.folio || '#' + v.id.slice(0, 6)}`,
      monto: Number(v.total),
      fecha: v.creadoEn,
    })),
    ...compras.slice(0, 5).map((c) => ({
      tipo: 'compra',
      titulo: `Compra ${c.folio || '#' + c.id.slice(0, 6)}`,
      monto: Number(c.total),
      fecha: c.creadoEn,
    })),
    ...ajustes.slice(0, 5).map((a) => ({
      tipo: 'ajuste',
      titulo: 'Ajuste de inventario',
      detalle: a.motivo,
      fecha: a.creadoEn,
    })),
    ...clientes
      .filter((c) => !c.esGeneral)
      .slice(0, 5)
      .map((c) => ({ tipo: 'cliente', titulo: 'Nuevo cliente', detalle: c.nombre, fecha: c.creadoEn })),
  ];
  return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6);
}

export function useDashboardData() {
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const hoy = new Date();
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);

        const diasSemana = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(hoy);
          d.setDate(d.getDate() - (6 - i));
          return d;
        });

        const [
          ventasHoy,
          ventasAyer,
          tendencia,
          topArticulos,
          inventario,
          existencias,
          clientes,
          caja,
          ventasRecientes,
          comprasRecientes,
          ajustesRecientes,
        ] = await Promise.all([
          reporteVentas({ desde: inicioDelDia(hoy).toISOString(), hasta: finDelDia(hoy).toISOString() }),
          reporteVentas({ desde: inicioDelDia(ayer).toISOString(), hasta: finDelDia(ayer).toISOString() }),
          Promise.all(
            diasSemana.map((d) =>
              reporteVentas({ desde: inicioDelDia(d).toISOString(), hasta: finDelDia(d).toISOString() }).then(
                (r) => ({ etiqueta: nombreDia(d), total: Number(r.totalNeto) }),
              ),
            ),
          ),
          reporteArticulosMasVendidos({ limite: 5 }),
          reporteInventarioValorizado({}),
          listarExistencias({}),
          listarClientes({}),
          calcularCajaActual(),
          listarVentas({}),
          listarCompras({}),
          listarAjustes({}),
        ]);

        if (cancelado) return;

        const clientesActivos = clientes.filter((c) => c.activo);
        const unaSemanaAtras = new Date(hoy);
        unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
        const clientesNuevosSemana = clientes.filter((c) => new Date(c.creadoEn) >= unaSemanaAtras).length;

        const articulosConStock = new Set(
          existencias.filter((e) => Number(e.cantidad) > 0).map((e) => e.articuloId),
        ).size;

        const netoHoy = Number(ventasHoy.totalNeto);
        const netoAyer = Number(ventasAyer.totalNeto);
        const deltaVentas = netoAyer > 0 ? ((netoHoy - netoAyer) / netoAyer) * 100 : null;

        setEstado({
          cargando: false,
          error: null,
          datos: {
            ventasHoy: netoHoy,
            deltaVentas,
            caja,
            articulosConStock,
            stockBajo: inventario.stockBajo,
            clientesActivos: clientesActivos.length,
            clientesNuevosSemana,
            tendencia,
            topArticulos,
            movimientos: fusionarMovimientos({
              ventas: ventasRecientes,
              compras: comprasRecientes,
              ajustes: ajustesRecientes,
              clientes,
            }),
            porMetodoPago: ventasHoy.porMetodoPago,
          },
        });
      } catch (error) {
        if (!cancelado) setEstado({ cargando: false, error, datos: null });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return estado;
}
