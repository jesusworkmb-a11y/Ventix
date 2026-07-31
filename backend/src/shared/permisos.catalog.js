// Catálogo global de permisos y su asignación por defecto a los 4 roles base de una empresa nueva.
// VALIDADO como decisión razonable (no existe en el repo el documento maestro de espec.);
// ajustable después vía una UI de roles sin requerir cambios de schema.

const PERMISOS_DEFAULT = [
  { clave: 'administracion.empresa.editar', grupo: 'Administración', nombre: 'Editar datos de la empresa' },
  { clave: 'administracion.usuarios.ver', grupo: 'Administración', nombre: 'Ver usuarios' },
  { clave: 'administracion.usuarios.crear', grupo: 'Administración', nombre: 'Invitar/crear usuarios' },
  { clave: 'administracion.usuarios.editar', grupo: 'Administración', nombre: 'Editar usuarios (rol, estado)' },
  { clave: 'administracion.roles.ver', grupo: 'Administración', nombre: 'Ver roles y permisos' },
  { clave: 'administracion.roles.gestionar', grupo: 'Administración', nombre: 'Crear/editar roles y asignar permisos' },
  { clave: 'administracion.sucursales.ver', grupo: 'Administración', nombre: 'Ver sucursales' },
  { clave: 'administracion.sucursales.gestionar', grupo: 'Administración', nombre: 'Crear/editar sucursales' },
  { clave: 'administracion.auditoria.ver', grupo: 'Administración', nombre: 'Ver bitácora de auditoría' },
  { clave: 'administracion.configuracion.gestionar', grupo: 'Administración', nombre: 'Editar configuración de la empresa / folios' },
  { clave: 'venta.crear', grupo: 'Ventas', nombre: 'Registrar ventas' },
  { clave: 'venta.modificar_precio', grupo: 'Ventas', nombre: 'Modificar precio en venta' },
  { clave: 'venta.cancelar', grupo: 'Ventas', nombre: 'Cancelar venta' },
  { clave: 'venta.aplicar_descuento', grupo: 'Ventas', nombre: 'Aplicar descuentos' },
  { clave: 'caja.abrir', grupo: 'Caja', nombre: 'Abrir sesión de caja' },
  { clave: 'caja.cerrar', grupo: 'Caja', nombre: 'Cerrar sesión de caja' },
  { clave: 'caja.retiro', grupo: 'Caja', nombre: 'Retiro de efectivo' },
  { clave: 'caja.ingreso', grupo: 'Caja', nombre: 'Ingreso de efectivo' },
  { clave: 'inventario.ajustar', grupo: 'Inventario', nombre: 'Ajustes de inventario' },
  { clave: 'inventario.transferir', grupo: 'Inventario', nombre: 'Transferencias entre sucursales' },
  { clave: 'inventario.conteo_fisico', grupo: 'Inventario', nombre: 'Conteo físico' },
  { clave: 'compra.crear', grupo: 'Compras', nombre: 'Registrar compras' },
  { clave: 'compra.cancelar', grupo: 'Compras', nombre: 'Cancelar compras' },
  { clave: 'catalogo.articulos.ver', grupo: 'Catálogo', nombre: 'Ver artículos y servicios' },
  { clave: 'catalogo.articulos.gestionar', grupo: 'Catálogo', nombre: 'Crear/editar artículos y servicios' },
  { clave: 'catalogo.precios.gestionar', grupo: 'Catálogo', nombre: 'Gestionar listas de precio' },
  {
    clave: 'catalogo.configuracion.gestionar',
    grupo: 'Catálogo',
    nombre: 'Gestionar categorías, marcas, unidades e impuestos',
  },
];

const TODAS_LAS_CLAVES = PERMISOS_DEFAULT.map((p) => p.clave);

const ROL_PERMISOS_DEFAULT = {
  Administrador: TODAS_LAS_CLAVES,
  Supervisor: [
    'administracion.usuarios.ver',
    'administracion.sucursales.ver',
    'administracion.roles.ver',
    'administracion.auditoria.ver',
    'venta.crear',
    'venta.modificar_precio',
    'venta.cancelar',
    'venta.aplicar_descuento',
    'caja.abrir',
    'caja.cerrar',
    'caja.retiro',
    'caja.ingreso',
    'inventario.ajustar',
    'inventario.transferir',
    'inventario.conteo_fisico',
    'compra.crear',
    'compra.cancelar',
    'catalogo.articulos.ver',
    'catalogo.articulos.gestionar',
    'catalogo.precios.gestionar',
    'catalogo.configuracion.gestionar',
  ],
  Cajero: ['venta.crear', 'caja.abrir', 'caja.cerrar', 'caja.ingreso', 'catalogo.articulos.ver'],
  Almacenista: [
    'inventario.ajustar',
    'inventario.transferir',
    'inventario.conteo_fisico',
    'compra.crear',
    'administracion.sucursales.ver',
    'catalogo.articulos.ver',
  ],
};

module.exports = { PERMISOS_DEFAULT, ROL_PERMISOS_DEFAULT };
