const prisma = require('../../config/db');
const { usuarioTienePermiso } = require('../../shared/services/permisos.service');

const LIMITE_POR_CATEGORIA = 5;

// Búsqueda rápida multi-entidad para el buscador de la barra superior. Cada categoría se
// consulta solo si el usuario tiene el permiso de "ver" correspondiente (mismo criterio que
// ya exige cada módulo en su propia ruta) — un vendedor sin permiso sobre Proveedores, por
// ejemplo, nunca ve resultados de esa categoría acá tampoco.
async function buscarGlobal({ empresaId, usuarioId, rolId, q }) {
  const texto = (q || '').trim();
  const resultado = { articulos: [], clientes: [], proveedores: [], ventas: [] };
  if (texto.length < 2) return resultado;

  const [puedeArticulos, puedeClientes, puedeProveedores, puedeVentas] = await Promise.all([
    usuarioTienePermiso({ usuarioId, rolId, clave: 'catalogo.articulos.ver' }),
    usuarioTienePermiso({ usuarioId, rolId, clave: 'clientes.ver' }),
    usuarioTienePermiso({ usuarioId, rolId, clave: 'proveedores.ver' }),
    usuarioTienePermiso({ usuarioId, rolId, clave: 'venta.ver' }),
  ]);

  const tareas = [];

  if (puedeArticulos) {
    tareas.push(
      prisma.articulo.findMany({
        where: {
          empresaId,
          OR: [
            { nombre: { contains: texto, mode: 'insensitive' } },
            { sku: { contains: texto, mode: 'insensitive' } },
            { codigoBarras: { contains: texto, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, sku: true, activo: true },
        orderBy: { nombre: 'asc' },
        take: LIMITE_POR_CATEGORIA,
      }).then((datos) => { resultado.articulos = datos; }),
    );
  }

  if (puedeClientes) {
    tareas.push(
      prisma.cliente.findMany({
        where: {
          empresaId,
          OR: [
            { nombre: { contains: texto, mode: 'insensitive' } },
            { correo: { contains: texto, mode: 'insensitive' } },
            { telefono: { contains: texto, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, correo: true, telefono: true, activo: true },
        orderBy: { nombre: 'asc' },
        take: LIMITE_POR_CATEGORIA,
      }).then((datos) => { resultado.clientes = datos; }),
    );
  }

  if (puedeProveedores) {
    tareas.push(
      prisma.proveedor.findMany({
        where: {
          empresaId,
          OR: [
            { nombre: { contains: texto, mode: 'insensitive' } },
            { correo: { contains: texto, mode: 'insensitive' } },
            { telefono: { contains: texto, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, correo: true, telefono: true, activo: true },
        orderBy: { nombre: 'asc' },
        take: LIMITE_POR_CATEGORIA,
      }).then((datos) => { resultado.proveedores = datos; }),
    );
  }

  if (puedeVentas) {
    tareas.push(
      prisma.venta.findMany({
        where: {
          empresaId,
          OR: [
            { folio: { contains: texto, mode: 'insensitive' } },
            { cliente: { nombre: { contains: texto, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, folio: true, total: true, estado: true, cliente: { select: { nombre: true } } },
        orderBy: { creadoEn: 'desc' },
        take: LIMITE_POR_CATEGORIA,
      }).then((datos) => { resultado.ventas = datos; }),
    );
  }

  await Promise.all(tareas);
  return resultado;
}

module.exports = { buscarGlobal };
