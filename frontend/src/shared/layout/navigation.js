import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Package,
  Boxes,
  Tag,
  Users,
  Truck,
  BarChart3,
  Wrench,
  Settings,
  Receipt,
} from 'lucide-react';

// Estructura fija del sidebar (§ "La estructura nunca cambia" de la guía visual).
// `permiso` oculta el item entero si el usuario no lo tiene; los items sin `permiso`
// son visibles para cualquier usuario logueado (mismo criterio que el nav plano previo
// en DashboardPage, que solo condicionaba los links de Administración).
export const NAVEGACION = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Ventas',
    to: '/ventas',
    icon: ShoppingCart,
    hijos: [
      { label: 'Ventas', to: '/ventas' },
      { label: 'Ventas recientes', to: '/ventas/recientes' },
      { label: 'Cotizaciones', to: '/ventas/cotizaciones' },
    ],
  },
  { label: 'Caja', to: '/caja', icon: Wallet },
  { label: 'Compras', to: '/compras', icon: Package },
  {
    label: 'Inventario',
    to: '/inventario/existencias',
    icon: Boxes,
    hijos: [
      { label: 'Existencias', to: '/inventario/existencias' },
      { label: 'Ajustes', to: '/inventario/ajustes' },
      { label: 'Transferencias', to: '/inventario/transferencias' },
      { label: 'Conteos físicos', to: '/inventario/conteos' },
    ],
  },
  {
    label: 'Catálogo',
    to: '/catalogo/articulos',
    icon: Tag,
    hijos: [
      { label: 'Artículos', to: '/catalogo/articulos' },
      { label: 'Configuración', to: '/catalogo/configuracion' },
    ],
  },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Proveedores', to: '/proveedores', icon: Truck },
  { label: 'Reportes', to: '/reportes', icon: BarChart3 },
  {
    label: 'Facturación',
    to: '/facturacion',
    icon: Receipt,
    hijos: [
      { label: 'Factura directa', to: '/facturacion/directa', permiso: 'facturacion.crear' },
      { label: 'Global / Consolidada', to: '/facturacion/global', permiso: 'facturacion.global.generar' },
      { label: 'Facturas', to: '/facturacion', permiso: 'facturacion.ver' },
    ],
  },
  { label: 'Herramientas', to: '/herramientas', icon: Wrench },
  {
    label: 'Configuración',
    to: '/administracion/sucursales',
    icon: Settings,
    hijos: [
      { label: 'Empresa', to: '/administracion/empresa', permiso: 'administracion.empresa.editar' },
      { label: 'Datos fiscales', to: '/administracion/fiscal', permiso: 'administracion.fiscal.editar' },
      { label: 'Sucursales', to: '/administracion/sucursales', permiso: 'administracion.sucursales.ver' },
      { label: 'Usuarios', to: '/administracion/usuarios', permiso: 'administracion.usuarios.ver' },
      { label: 'Roles y permisos', to: '/administracion/roles', permiso: 'administracion.roles.ver' },
      { label: 'Auditoría', to: '/administracion/auditoria', permiso: 'administracion.auditoria.ver' },
    ],
  },
];
