const prisma = require('../../config/db');
const AppError = require('../../shared/errors/AppError');
const { aCsv, parsearCsv } = require('../../shared/csv');
const { registrarAuditoria } = require('../../shared/services/auditoria.service');
const toJson = require('../../shared/toJson');

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
        costo: fila.costo ? Number(fila.costo) : 0,
        precio: fila.precio ? Number(fila.precio) : 0,
        stockMinimo: fila.stockMinimo ? Number(fila.stockMinimo) : undefined,
        stockMaximo: fila.stockMaximo ? Number(fila.stockMaximo) : undefined,
      };

      await prisma.$transaction(async (tx) => {
        const articulo = await tx.articulo.create({ data: { empresaId, ...datos } });
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
