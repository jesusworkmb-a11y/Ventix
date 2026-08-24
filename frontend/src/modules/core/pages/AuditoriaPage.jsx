import { useEffect, useState } from 'react';
import { listarAuditoria, listarUsuarios } from '../api/core.api';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Paginacion from '../../../shared/ui/Paginacion';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

// Nombres legibles de cada `entidad` cruda que guarda el backend -- usados en el filtro y en la
// columna "Entidad" de la tabla. Debe cubrir toda entidad que registrarAuditoria use en algún
// *.service.js (ver auditoriaResolver.service.js en el backend para la lista de referencia).
const ETIQUETAS_ENTIDAD = {
  Articulo: 'Artículo',
  Cliente: 'Cliente',
  Proveedor: 'Proveedor',
  ListaPrecio: 'Lista de precio',
  Categoria: 'Categoría',
  Marca: 'Marca',
  Unidad: 'Unidad',
  Impuesto: 'Impuesto',
  Atributo: 'Atributo',
  ValorAtributo: 'Valor de atributo',
  Promocion: 'Promoción',
  Descuento: 'Descuento',
  UnidadAlterna: 'Unidad alterna',
  PrecioArticulo: 'Precio por lista',
  ArticuloKitDetalle: 'Componente de kit',
  Venta: 'Venta',
  Devolucion: 'Devolución',
  Cotizacion: 'Cotización',
  Compra: 'Compra',
  OrdenCompra: 'Orden de compra',
  Transferencia: 'Transferencia',
  ConteoFisico: 'Conteo físico',
  Ajuste: 'Ajuste de inventario',
  Existencia: 'Existencia',
  Caja: 'Caja',
  SesionCaja: 'Sesión de caja',
  MovimientoCaja: 'Movimiento de caja',
  Usuario: 'Usuario',
  Rol: 'Rol',
  RolPermiso: 'Permisos de rol',
  Sucursal: 'Sucursal',
  Empresa: 'Empresa',
  Factura: 'Factura',
  FacturaCsd: 'Certificado (CSD)',
};

function etiquetaEntidad(entidad) {
  return ETIQUETAS_ENTIDAD[entidad] || entidad;
}

const ENTIDADES = Object.keys(ETIQUETAS_ENTIDAD).sort((a, b) => (
  ETIQUETAS_ENTIDAD[a].localeCompare(ETIQUETAS_ENTIDAD[b], 'es')
));

const COLUMNAS = [
  { label: 'Fecha', clave: 'creadoEn', ordenable: true },
  { label: 'Usuario', clave: null },
  { label: 'Acción', clave: 'accion', ordenable: true },
  { label: 'Entidad', clave: 'entidad', ordenable: true },
  { label: 'Detalle', clave: null },
];

const ETIQUETAS_CAMPO = {
  nombre: 'Nombre',
  correo: 'Correo',
  telefono: 'Teléfono',
  rolId: 'Rol',
  estado: 'Estado',
  plan: 'Plan',
  activo: 'Activo',
  vigenciaHasta: 'Vigencia',
  direccion: 'Dirección',
  codigoPostal: 'Código postal',
  razonSocial: 'Razón social',
  rfc: 'RFC',
  clienteId: 'Cliente',
  proveedorId: 'Proveedor',
  articuloId: 'Artículo',
  articuloComponenteId: 'Componente',
  listaPrecioId: 'Lista de precio',
  categoriaId: 'Categoría',
  categoriaPadreId: 'Categoría padre',
  marcaId: 'Marca',
  unidadId: 'Unidad',
  unidadBaseId: 'Unidad',
  impuestoId: 'Impuesto',
  sucursalId: 'Sucursal',
  sucursalOrigenId: 'Sucursal origen',
  sucursalDestinoId: 'Sucursal destino',
  cajaId: 'Caja',
  usuarioId: 'Usuario',
  autorizadoPorId: 'Autorizado por',
  ventaId: 'Venta',
  compraId: 'Compra',
  cotizacionId: 'Cotización',
  ordenCompraId: 'Orden de compra',
  atributoId: 'Atributo',
  valorAtributoId: 'Valor de atributo',
  descuentoId: 'Descuento',
  promocionId: 'Promoción',
  cantidad: 'Cantidad',
  precio: 'Precio',
  precioUnitario: 'Precio unitario',
  costo: 'Costo',
  subtotal: 'Subtotal',
  impuestos: 'Impuestos',
  total: 'Total',
  folio: 'Folio',
  motivo: 'Motivo',
  esBase: 'Es base',
};

function etiquetaCampo(clave) {
  return ETIQUETAS_CAMPO[clave]
    || clave.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function esObjetoPlano(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Un objeto de línea (ej. un renglón de "detalles" en Venta/Compra/Transferencia) se muestra como
// "Campo: valor, Campo: valor" en vez de JSON crudo -- "id" propio de la línea se omite porque no
// aporta nada legible a quien audita.
function formatearObjeto(obj, etiquetas) {
  return Object.entries(obj)
    .filter(([clave]) => clave !== 'id')
    .map(([clave, val]) => `${etiquetaCampo(clave)}: ${formatearValor(val, etiquetas)}`)
    .join(', ');
}

// `etiquetas` es el mapa id -> nombre legible que arma el backend (auditoriaResolver.service.js)
// para todo lo referenciado en la página actual -- así "articuloId": "a1b2c3d4-..." se muestra
// como "Coca-Cola 600ml" en vez del uuid crudo, sin que este componente necesite saber a qué
// tabla pertenece cada campo.
function formatearValor(v, etiquetas = {}) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(etiquetas, v)) {
    return etiquetas[v] || `${v.slice(0, 8)}…`;
  }
  if (Array.isArray(v)) {
    if (!v.length) return '—';
    return v.map((item) => (esObjetoPlano(item) ? formatearObjeto(item, etiquetas) : formatearValor(item, etiquetas))).join('; ');
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const fecha = new Date(v);
    return Number.isNaN(fecha.getTime()) ? v : fecha.toLocaleString();
  }
  if (typeof v === 'object') return formatearObjeto(v, etiquetas);
  return String(v);
}

// Reemplaza el volcado crudo de JSON por una lista legible campo: antes → después.
// Cubre el caso más común (diff de pares campo-valor); para valores que no son un objeto plano
// (ej. el arreglo "detalles" de una venta/compra, o el de permisos de un rol) cae a mostrar
// antes/después como listas, ya resueltas campo por campo vía formatearValor.
function DetalleAuditoria({ valoresAntes, valoresDespues, etiquetas }) {
  if (!esObjetoPlano(valoresAntes) && !esObjetoPlano(valoresDespues)) {
    return (
      <div className="space-y-1">
        {valoresAntes !== null && valoresAntes !== undefined && (
          <div><span className="font-medium text-gray-700">Antes:</span> {formatearValor(valoresAntes, etiquetas)}</div>
        )}
        {valoresDespues !== null && valoresDespues !== undefined && (
          <div><span className="font-medium text-gray-700">Después:</span> {formatearValor(valoresDespues, etiquetas)}</div>
        )}
      </div>
    );
  }

  // "id"/"empresaId" del propio registro son iguales en cada fila y ya se ven en la columna
  // Entidad -- mostrarlos acá es ruido repetido, no información nueva para quien audita.
  const claves = [...new Set([
    ...(esObjetoPlano(valoresAntes) ? Object.keys(valoresAntes) : []),
    ...(esObjetoPlano(valoresDespues) ? Object.keys(valoresDespues) : []),
  ])].filter((clave) => clave !== 'id' && clave !== 'empresaId');

  return (
    <ul className="space-y-1">
      {claves.map((clave) => {
        const tieneAntes = esObjetoPlano(valoresAntes) && Object.prototype.hasOwnProperty.call(valoresAntes, clave);
        const tieneDespues = esObjetoPlano(valoresDespues) && Object.prototype.hasOwnProperty.call(valoresDespues, clave);
        const antes = tieneAntes ? valoresAntes[clave] : undefined;
        const despues = tieneDespues ? valoresDespues[clave] : undefined;
        const cambio = tieneAntes && tieneDespues && JSON.stringify(antes) !== JSON.stringify(despues);
        return (
          <li key={clave}>
            <span className="font-medium text-gray-700">{etiquetaCampo(clave)}:</span>{' '}
            {cambio
              ? `${formatearValor(antes, etiquetas)} → ${formatearValor(despues, etiquetas)}`
              : formatearValor(tieneDespues ? despues : antes, etiquetas)}
          </li>
        );
      })}
    </ul>
  );
}

function AuditoriaPage() {
  const [registros, setRegistros] = useState([]);
  const [etiquetas, setEtiquetas] = useState({});
  const [usuariosPorId, setUsuariosPorId] = useState({});
  const [filtros, setFiltros] = useState({ entidad: '', desde: '', hasta: '', buscar: '' });
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [orden, setOrden] = useState({ ordenarPor: 'creadoEn', orden: 'desc' });
  const [error, setError] = useState('');

  function cargar(pagina = 1) {
    setError('');
    const params = { pagina, porPagina: 20, ordenarPor: orden.ordenarPor, orden: orden.orden };
    if (filtros.entidad) params.entidad = filtros.entidad;
    if (filtros.buscar) params.buscar = filtros.buscar;
    if (filtros.desde) params.desde = filtros.desde;
    // "Hasta" es solo fecha (input type=date); sin la hora, el backend compararía contra
    // medianoche y excluiría todo lo registrado ese mismo día después de las 00:00.
    if (filtros.hasta) params.hasta = `${filtros.hasta}T23:59:59.999`;
    listarAuditoria(params)
      .then((r) => {
        setRegistros(r.datos);
        setEtiquetas(r.etiquetas || {});
        setPaginacion({ pagina: r.pagina, totalPaginas: r.totalPaginas, total: r.total });
      })
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar la bitácora.'));
  }

  function handleOrdenar(clave) {
    setOrden((o) => (o.ordenarPor === clave
      ? { ordenarPor: clave, orden: o.orden === 'asc' ? 'desc' : 'asc' }
      : { ordenarPor: clave, orden: 'asc' }));
  }

  useEffect(() => {
    listarUsuarios()
      .then((usuarios) => {
        const mapa = {};
        for (const u of usuarios) mapa[u.id] = u.nombre;
        setUsuariosPorId(mapa);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function aplicarFiltros(e) {
    e.preventDefault();
    cargar(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bitácora de auditoría</h1>
        <p className="text-sm text-gray-500">Historial de cambios realizados en el sistema.</p>
      </div>

      <Card>
        <form onSubmit={aplicarFiltros} className="flex flex-wrap items-end gap-3">
          <Select
            id="entidadFiltro"
            label="Entidad"
            value={filtros.entidad}
            onChange={(e) => setFiltros((f) => ({ ...f, entidad: e.target.value }))}
            className="min-w-[180px]"
          >
            <option value="">Todas</option>
            {ENTIDADES.map((ent) => (
              <option key={ent} value={ent}>{etiquetaEntidad(ent)}</option>
            ))}
          </Select>
          <Input
            id="desdeFiltro"
            label="Desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
          />
          <Input
            id="hastaFiltro"
            label="Hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
          />
          <Input
            id="buscarFolioFiltro"
            label="Folio"
            placeholder="Buscar por folio..."
            value={filtros.buscar}
            onChange={(e) => setFiltros((f) => ({ ...f, buscar: e.target.value }))}
          />
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}

      <Card title="Registros">
        <Table
          columnas={COLUMNAS}
          ordenarPor={orden.ordenarPor}
          orden={orden.orden}
          onOrdenar={handleOrdenar}
          pie={(
            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              onCambiar={cargar}
            />
          )}
        >
          {registros.length === 0 && <TablaVacia colSpan={5} mensaje="Sin registros para los filtros seleccionados." />}
          {registros.map((r) => (
            <Fila key={r.id}>
              <Celda>{new Date(r.creadoEn).toLocaleString()}</Celda>
              <Celda>{usuariosPorId[r.usuarioEjecutorId] || r.usuarioEjecutorId}</Celda>
              <Celda>{r.accion}</Celda>
              <Celda>
                {etiquetaEntidad(r.entidad)}
                {r.entidadId && (
                  <span className="text-gray-400"> — {etiquetas[r.entidadId] ?? `${r.entidadId.slice(0, 8)}…`}</span>
                )}
              </Celda>
              <Celda>
                {(r.valoresAntes || r.valoresDespues) ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-primary-600 hover:underline">ver</summary>
                    <div className="mt-2 max-w-md rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                      <DetalleAuditoria valoresAntes={r.valoresAntes} valoresDespues={r.valoresDespues} etiquetas={etiquetas} />
                    </div>
                  </details>
                ) : '—'}
              </Celda>
            </Fila>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default AuditoriaPage;
