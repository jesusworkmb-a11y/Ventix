const prisma = require('../../config/db');

// Qué tabla/campo resuelve el nombre legible de cada `entidad` de auditoría. Para las entidades
// "hijas" que se borran y recrean por completo en cada cambio (UnidadAlterna, PrecioArticulo,
// ArticuloKitDetalle, RolPermiso -- ver comentario en articulos.service.js#setPrecios y
// roles.service.js), el `entidadId` guardado es el del padre estable (Articulo/Rol), así que se
// resuelven contra esa tabla.
const RESOLVERS = {
  Empresa: { modelo: 'empresa', campo: 'nombreComercial' },
  Sucursal: { modelo: 'sucursal', campo: 'nombre' },
  Usuario: { modelo: 'usuario', campo: 'nombre' },
  Rol: { modelo: 'rol', campo: 'nombre' },
  RolPermiso: { modelo: 'rol', campo: 'nombre' },
  Cliente: { modelo: 'cliente', campo: 'nombre' },
  Proveedor: { modelo: 'proveedor', campo: 'nombre' },
  Articulo: { modelo: 'articulo', campo: 'nombre' },
  UnidadAlterna: { modelo: 'articulo', campo: 'nombre' },
  PrecioArticulo: { modelo: 'articulo', campo: 'nombre' },
  ArticuloKitDetalle: { modelo: 'articulo', campo: 'nombre' },
  Marca: { modelo: 'marca', campo: 'nombre' },
  Categoria: { modelo: 'categoria', campo: 'nombre' },
  Unidad: { modelo: 'unidad', campo: 'nombre' },
  Impuesto: { modelo: 'impuesto', campo: 'nombre' },
  Atributo: { modelo: 'atributo', campo: 'nombre' },
  ValorAtributo: { modelo: 'valorAtributo', campo: 'valor' },
  ListaPrecio: { modelo: 'listaPrecio', campo: 'nombre' },
  Promocion: { modelo: 'promocion', campo: 'nombre' },
  Descuento: { modelo: 'descuento', campo: 'nombre' },
  Caja: { modelo: 'caja', campo: 'nombre' },
  Venta: { modelo: 'venta', campo: 'folio' },
  Compra: { modelo: 'compra', campo: 'folio' },
  Cotizacion: { modelo: 'cotizacion', campo: 'folio' },
  OrdenCompra: { modelo: 'ordenCompra', campo: 'folio' },
  Devolucion: { modelo: 'devolucion', campo: 'folio' },
  Transferencia: { modelo: 'transferencia', campo: 'folio' },
  Ajuste: { modelo: 'ajuste', campo: 'folio' },
  Factura: { modelo: 'factura', campo: 'folio' },
};

// A qué entidad de RESOLVERS corresponde un campo "*Id" encontrado dentro de valoresAntes/
// valoresDespues -- a cualquier profundidad, incluido dentro de arreglos como el `detalles` de
// Venta/Compra/Transferencia/etc. Es lo que permite mostrar "Coca-Cola 600ml" en vez de un uuid
// crudo de articuloId dentro de la línea de una venta, sin tener que tocar cómo cada módulo
// arma sus valoresAntes/valoresDespues.
const FIELD_A_ENTIDAD = {
  clienteId: 'Cliente',
  proveedorId: 'Proveedor',
  articuloId: 'Articulo',
  articuloComponenteId: 'Articulo',
  rolId: 'Rol',
  listaPrecioId: 'ListaPrecio',
  categoriaId: 'Categoria',
  categoriaPadreId: 'Categoria',
  marcaId: 'Marca',
  unidadId: 'Unidad',
  unidadBaseId: 'Unidad',
  impuestoId: 'Impuesto',
  sucursalId: 'Sucursal',
  sucursalOrigenId: 'Sucursal',
  sucursalDestinoId: 'Sucursal',
  cajaId: 'Caja',
  usuarioId: 'Usuario',
  usuarioEjecutorId: 'Usuario',
  usuarioResponsableId: 'Usuario',
  autorizadoPorId: 'Usuario',
  autorizadorId: 'Usuario',
  ventaId: 'Venta',
  compraId: 'Compra',
  cotizacionId: 'Cotizacion',
  ordenCompraId: 'OrdenCompra',
  atributoId: 'Atributo',
  valorAtributoId: 'ValorAtributo',
  descuentoId: 'Descuento',
  promocionId: 'Promocion',
};

function recolectarIds(valor, acc) {
  if (Array.isArray(valor)) {
    for (const item of valor) recolectarIds(item, acc);
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const [clave, val] of Object.entries(valor)) {
      const entidad = FIELD_A_ENTIDAD[clave];
      if (entidad && typeof val === 'string' && val) {
        if (!acc[entidad]) acc[entidad] = new Set();
        acc[entidad].add(val);
      }
      recolectarIds(val, acc);
    }
  }
}

// Resuelve en lote todos los IDs referenciados por un conjunto de filas de auditoría (el
// entidadId propio de cada fila + cualquier *Id reconocido dentro de valoresAntes/
// valoresDespues) contra su tabla real -- una sola consulta por tabla involucrada, sin importar
// cuántas filas/campos las referencien. No filtra por empresaId: los IDs que aparecen acá siempre
// vinieron de operaciones ya registradas para esta misma empresa, nunca de un campo libre que un
// usuario pueda inventar.
async function resolverEtiquetas(filas) {
  const idsPorEntidad = {};
  for (const fila of filas) {
    if (fila.entidad && fila.entidadId) {
      if (!idsPorEntidad[fila.entidad]) idsPorEntidad[fila.entidad] = new Set();
      idsPorEntidad[fila.entidad].add(fila.entidadId);
    }
    recolectarIds(fila.valoresAntes, idsPorEntidad);
    recolectarIds(fila.valoresDespues, idsPorEntidad);
  }

  const etiquetaPorId = {};
  await Promise.all(
    Object.entries(idsPorEntidad).map(async ([entidad, ids]) => {
      const resolver = RESOLVERS[entidad];
      if (!resolver) return;
      const registros = await prisma[resolver.modelo].findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, [resolver.campo]: true },
      });
      for (const r of registros) {
        etiquetaPorId[r.id] = r[resolver.campo] || null;
      }
    }),
  );
  return etiquetaPorId;
}

module.exports = { resolverEtiquetas };
