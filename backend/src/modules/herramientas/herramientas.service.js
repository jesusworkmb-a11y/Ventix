const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { aCsv, parsearCsv } = require('../../shared/csv');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const toJson = require('../../shared/toJson');

// Convierte una columna numérica del CSV, rechazando con un mensaje de negocio limpio en vez de
// dejar pasar NaN hasta Prisma -- que lo rechaza con un volcado técnico crudo del validador
// (verificado en vivo: "costo" con texto producía un dump multilínea del shape completo del
// create, mencionando incluso un campo "empresa" no relacionado al error real).
function numeroDeColumna(valor, nombreColumna, porDefecto) {
  if (!valor) return porDefecto;
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    throw new AppError(400, `La columna "${nombreColumna}" no es un número válido: "${valor}".`);
  }
  return numero;
}

// exportarArticulos incluye "activo" en el CSV, pero importarArticulos nunca la leía -- todo
// artículo importado quedaba activo:true sin importar lo que dijera el CSV (verificado en vivo:
// fila con activo=false, el artículo creado quedó activo:true). "false"/"0" (sin distinguir
// mayúsculas) se interpreta como inactivo; cualquier otro valor no vacío, como activo; vacío
// deja el default del schema (activo).
function activoDeColumna(valor) {
  if (!valor) return undefined;
  return !['false', '0'].includes(valor.toLowerCase());
}

const COLUMNAS_ARTICULOS = [
  'tipo',
  'sku',
  'codigoBarras',
  'clave',
  'nombre',
  'descripcion',
  'categoria',
  'marca',
  'unidadBase',
  'impuesto',
  'costo',
  'precio',
  'stockMinimo',
  'stockMaximo',
  'activo',
];

async function exportarArticulos({ empresaId }) {
  const articulos = await prisma.articulo.findMany({
    where: { empresaId },
    include: { categoria: true, marca: true, unidadBase: true, impuesto: true },
    orderBy: { nombre: 'asc' },
  });

  const filas = articulos.map((a) => ({
    tipo: a.tipo,
    sku: a.sku || '',
    codigoBarras: a.codigoBarras || '',
    clave: a.clave || '',
    nombre: a.nombre,
    descripcion: a.descripcion || '',
    categoria: a.categoria?.nombre || '',
    marca: a.marca?.nombre || '',
    unidadBase: a.unidadBase.nombre,
    impuesto: a.impuesto?.nombre || '',
    costo: a.costo,
    precio: a.precio,
    stockMinimo: a.stockMinimo ?? '',
    stockMaximo: a.stockMaximo ?? '',
    activo: a.activo,
  }));

  return aCsv(filas, COLUMNAS_ARTICULOS);
}

const COLUMNAS_CLIENTES = ['nombre', 'telefono', 'correo', 'rfc', 'direccion', 'activo'];

async function exportarClientes({ empresaId }) {
  const clientes = await prisma.cliente.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
  const filas = clientes.map((c) => ({
    nombre: c.nombre,
    telefono: c.telefono || '',
    correo: c.correo || '',
    rfc: c.rfc || '',
    direccion: c.direccion || '',
    activo: c.activo,
  }));
  return aCsv(filas, COLUMNAS_CLIENTES);
}

const COLUMNAS_PROVEEDORES = ['nombre', 'telefono', 'correo', 'rfc', 'direccion', 'activo'];

async function exportarProveedores({ empresaId }) {
  const proveedores = await prisma.proveedor.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
  const filas = proveedores.map((p) => ({
    nombre: p.nombre,
    telefono: p.telefono || '',
    correo: p.correo || '',
    rfc: p.rfc || '',
    direccion: p.direccion || '',
    activo: p.activo,
  }));
  return aCsv(filas, COLUMNAS_PROVEEDORES);
}

// Create-only, fila por fila, sin transacción global: lo válido se crea, lo inválido se
// reporta — es el comportamiento esperado de una carga masiva, no todo-o-nada. categoria/
// marca/unidad/impuesto se resuelven por nombre (así llena un CSV un dueño de negocio) contra
// las tablas de Catálogo vía Prisma directo — sin importar catalogo.service.js (§3.1).
async function importarArticulos({ empresaId, usuarioId, csv }) {
  const filas = parsearCsv(csv);

  const [categorias, marcas, unidades, impuestos, articulosExistentes] = await Promise.all([
    prisma.categoria.findMany({ where: { empresaId } }),
    prisma.marca.findMany({ where: { empresaId } }),
    prisma.unidad.findMany({ where: { empresaId } }),
    prisma.impuesto.findMany({ where: { empresaId } }),
    prisma.articulo.findMany({ where: { empresaId }, select: { sku: true, codigoBarras: true } }),
  ]);

  const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c]));
  const marcaPorNombre = new Map(marcas.map((m) => [m.nombre.toLowerCase(), m]));
  const unidadPorNombre = new Map(unidades.map((u) => [u.nombre.toLowerCase(), u]));
  const impuestoPorNombre = new Map(impuestos.map((i) => [i.nombre.toLowerCase(), i]));
  const skusExistentes = new Set(articulosExistentes.map((a) => a.sku).filter(Boolean));
  const codigosExistentes = new Set(articulosExistentes.map((a) => a.codigoBarras).filter(Boolean));

  const errores = [];
  const advertencias = [];
  let creados = 0;

  for (let i = 0; i < filas.length; i += 1) {
    const numeroFila = i + 2; // +1 por encabezado, +1 por índice base 1
    const fila = filas[i];

    try {
      if (!fila.nombre) throw new AppError(400, 'Falta el nombre.');
      if (!fila.unidadBase) throw new AppError(400, 'Falta la unidad base.');

      const unidad = unidadPorNombre.get(fila.unidadBase.toLowerCase());
      if (!unidad) {
        throw new AppError(
          400,
          `La unidad "${fila.unidadBase}" no existe; créala primero en Configuración de catálogo.`,
        );
      }

      const sku = fila.sku || undefined;
      const codigoBarras = fila.codigoBarras || undefined;
      if (sku && skusExistentes.has(sku)) throw new AppError(400, `Ya existe un artículo con el SKU "${sku}".`);
      if (codigoBarras && codigosExistentes.has(codigoBarras)) {
        throw new AppError(400, `Ya existe un artículo con el código de barras "${codigoBarras}".`);
      }

      const advertenciasFila = [];
      let categoriaId;
      if (fila.categoria) {
        const categoria = categoriaPorNombre.get(fila.categoria.toLowerCase());
        if (categoria) categoriaId = categoria.id;
        else advertenciasFila.push(`La categoría "${fila.categoria}" no existe; se dejó sin categoría.`);
      }
      let marcaId;
      if (fila.marca) {
        const marca = marcaPorNombre.get(fila.marca.toLowerCase());
        if (marca) marcaId = marca.id;
        else advertenciasFila.push(`La marca "${fila.marca}" no existe; se dejó sin marca.`);
      }
      let impuestoId;
      if (fila.impuesto) {
        const impuesto = impuestoPorNombre.get(fila.impuesto.toLowerCase());
        if (impuesto) impuestoId = impuesto.id;
        else advertenciasFila.push(`El impuesto "${fila.impuesto}" no existe; se dejó sin impuesto.`);
      }

      const datos = {
        tipo: fila.tipo === 'SERVICIO' ? 'SERVICIO' : 'PRODUCTO',
        sku,
        codigoBarras,
        clave: fila.clave || undefined,
        nombre: fila.nombre,
        descripcion: fila.descripcion || undefined,
        categoriaId,
        marcaId,
        impuestoId,
        unidadBaseId: unidad.id,
        costo: numeroDeColumna(fila.costo, 'costo', 0),
        precio: numeroDeColumna(fila.precio, 'precio', 0),
        stockMinimo: numeroDeColumna(fila.stockMinimo, 'stockMinimo', undefined),
        stockMaximo: numeroDeColumna(fila.stockMaximo, 'stockMaximo', undefined),
        activo: activoDeColumna(fila.activo),
      };

      await prisma.$transaction(async (tx) => {
        let articulo;
        try {
          articulo = await tx.articulo.create({ data: { empresaId, ...datos } });
        } catch (errorCreacion) {
          // La verificación de skusExistentes/codigosExistentes de arriba es en memoria, cargada
          // una sola vez al inicio de la importación -- no atrapa dos importaciones concurrentes
          // creando el mismo SKU nuevo (verificado en vivo: 5 importaciones a la vez del mismo
          // CSV, 4 de 5 filtraban el error crudo de Prisma en vez de un mensaje de negocio, mismo
          // hueco que el SKU duplicado ya corregido en articulos.service.js#crear). Se traduce
          // aquí el constraint único al mismo mensaje 409 que usa Catálogo.
          if (errorCreacion instanceof Prisma.PrismaClientKnownRequestError && errorCreacion.code === 'P2002') {
            if (errorCreacion.meta?.target?.includes('sku')) {
              throw new AppError(409, `Ya existe un artículo con el SKU "${sku}".`);
            }
            if (errorCreacion.meta?.target?.includes('codigoBarras')) {
              throw new AppError(409, `Ya existe un artículo con el código de barras "${codigoBarras}".`);
            }
          }
          throw errorCreacion;
        }
        await registrarAuditoria(tx, {
          empresaId,
          usuarioEjecutorId: usuarioId,
          accion: 'CREAR',
          entidad: 'Articulo',
          entidadId: articulo.id,
          motivo: 'Importación CSV',
          valoresDespues: toJson(articulo),
        });
      });

      if (sku) skusExistentes.add(sku);
      if (codigoBarras) codigosExistentes.add(codigoBarras);
      creados += 1;

      for (const advertencia of advertenciasFila) {
        advertencias.push({ fila: numeroFila, mensaje: advertencia });
      }
    } catch (err) {
      errores.push({ fila: numeroFila, mensaje: err.publicMessage || err.message || 'Error desconocido.' });
    }
  }

  return { creados, errores, advertencias };
}

module.exports = { exportarArticulos, exportarClientes, exportarProveedores, importarArticulos };
