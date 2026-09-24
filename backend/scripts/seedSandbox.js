// Siembra datos demo SINTÉTICOS en la base del entorno sandbox (ver "Entorno sandbox" en el
// README): una empresa demo con 2 sucursales, usuarios por rol, catálogo, clientes,
// proveedores, cajas y stock inicial (vía una compra real), más un superadmin de plataforma.
//
// Uso (con backend/.env o variables apuntando a la base del SANDBOX, nunca a producción):
//   Git Bash:    ENTORNO=sandbox DATABASE_URL="<url del sandbox>" npm run seed:sandbox
//   PowerShell:  $env:ENTORNO='sandbox'; $env:DATABASE_URL='<url del sandbox>'; npm run seed:sandbox
// (dotenv no pisa variables ya definidas, así que las de la terminal ganan sobre backend/.env.)
//
// Candado doble: exige ENTORNO=sandbox y se niega a correr si DATABASE_URL apunta al
// proyecto de Supabase de producción. Pasa por los mismos services que la API (no inserta
// filas a mano) para respetar folios, auditoría, Decimal y kardex igual que en producción.
// No es re-ejecutable a propósito: si la empresa demo ya existe, se detiene sin tocar nada.

require('dotenv').config();

const REF_SUPABASE_PRODUCCION = 'ncfrvaapybqmrcaqhpyj';

if (process.env.ENTORNO !== 'sandbox') {
  console.error('Abortado: este script solo corre con ENTORNO=sandbox.');
  process.exit(1);
}
if ((process.env.DATABASE_URL || '').includes(REF_SUPABASE_PRODUCCION)) {
  console.error('Abortado: DATABASE_URL apunta a la base de PRODUCCIÓN.');
  process.exit(1);
}

const bcrypt = require('bcrypt');
const prisma = require('../src/config/db');
const seedPermisos = require('../src/shared/bootstrap/seedPermisos');
const seedCatalogosSat = require('../src/shared/bootstrap/seedCatalogosSat');
const auth = require('../src/modules/core/auth/auth.service');
const sucursales = require('../src/modules/core/sucursales/sucursales.service');
const usuarios = require('../src/modules/core/usuarios/usuarios.service');
const categorias = require('../src/modules/catalogo/categorias/categorias.service');
const marcas = require('../src/modules/catalogo/marcas/marcas.service');
const unidades = require('../src/modules/catalogo/unidades/unidades.service');
const impuestos = require('../src/modules/catalogo/impuestos/impuestos.service');
const listasPrecio = require('../src/modules/catalogo/listasPrecio/listasPrecio.service');
const articulos = require('../src/modules/catalogo/articulos/articulos.service');
const clientes = require('../src/modules/clientes/clientes.service');
const proveedores = require('../src/modules/proveedores/proveedores.service');
const cajas = require('../src/modules/caja/cajas/cajas.service');
const compras = require('../src/modules/compras/compras.service');

const PASSWORD_DEMO = 'Sandbox1234';
const CORREO_ADMIN = 'admin@demo.boxpos.test';
const CORREO_SUPERADMIN = 'superadmin@demo.boxpos.test';

async function main() {
  await seedPermisos();
  await seedCatalogosSat();

  if (await prisma.usuario.findUnique({ where: { correo: CORREO_ADMIN } })) {
    console.log('La empresa demo ya existe — no se sembró nada. Borra la base del sandbox para empezar de cero.');
    return;
  }

  // --- Empresa, sucursales y usuarios ---
  const registro = await auth.registrarEmpresa({
    empresa: {
      nombreComercial: 'Abarrotes Demo',
      // RFC/razón social/régimen del contribuyente de pruebas del SAT que acepta el sandbox de
      // Facturama — CFDI 4.0 exige que la razón social coincida exacto con el RFC.
      razonSocial: 'ESCUELA KEMPER URGATE',
      rfc: 'EKU9003173C9',
      pais: 'MX',
      moneda: 'MXN',
      zonaHoraria: 'America/Mexico_City',
      correo: CORREO_ADMIN,
      telefono: '5500000000',
    },
    admin: { nombre: 'Admin Demo', correo: CORREO_ADMIN, password: PASSWORD_DEMO },
  });
  const empresaId = registro.empresa.id;
  const usuarioEjecutorId = registro.usuario.id;
  const ctx = { empresaId, usuarioEjecutorId };
  const matriz = registro.sucursal;

  // Sin vencimiento (la empresa demo no debe caducar a los 7 días del trial) y con régimen
  // fiscal, que el registro no pide pero facturas.service#resolverEmisor sí exige.
  await prisma.empresa.update({
    where: { id: empresaId },
    data: { vigenciaHasta: null, regimenFiscalClave: '601' },
  });

  // C.P. de expedición: sin él no se puede timbrar (ver "Depuración de timbrado en producción").
  // 42501 es el C.P. que el sandbox de Facturama asocia al RFC de pruebas EKU9003173C9.
  await sucursales.actualizarFiscal({ ...ctx, sucursalId: matriz.id, datos: { codigoPostal: '42501' } });

  const norte = await sucursales.crear({
    ...ctx,
    datos: { nombre: 'Sucursal Norte', clave: 'NTE', telefono: '5500000001', direccion: 'Av. Demo 123' },
  });

  const roles = await prisma.rol.findMany({ where: { empresaId } });
  const rolId = (nombre) => roles.find((r) => r.nombre === nombre).id;
  for (const [nombre, correo, rol] of [
    ['Supervisor Demo', 'supervisor@demo.boxpos.test', 'Supervisor'],
    ['Cajero Demo', 'cajero@demo.boxpos.test', 'Cajero'],
    ['Almacenista Demo', 'almacen@demo.boxpos.test', 'Almacenista'],
  ]) {
    await usuarios.crear({ ...ctx, datos: { nombre, correo, password: PASSWORD_DEMO, rolId: rolId(rol) } });
  }

  // --- Catálogo ---
  const cat = {};
  for (const nombre of ['Bebidas', 'Botanas', 'Abarrotes', 'Limpieza', 'Servicios']) {
    cat[nombre] = await categorias.crear({ ...ctx, datos: { nombre } });
  }
  const marca = {};
  for (const nombre of ['Genérica', 'La Demo', 'Refrescos del Valle']) {
    marca[nombre] = await marcas.crear({ ...ctx, nombre });
  }
  const pieza = await unidades.crear({ ...ctx, datos: { nombre: 'Pieza', abreviatura: 'pza', claveUnidadSat: 'H87' } });
  const kilo = await unidades.crear({ ...ctx, datos: { nombre: 'Kilogramo', abreviatura: 'kg', claveUnidadSat: 'KGM' } });
  const servicioU = await unidades.crear({ ...ctx, datos: { nombre: 'Servicio', abreviatura: 'serv', claveUnidadSat: 'E48' } });
  const iva16 = await impuestos.crear({
    ...ctx, datos: { nombre: 'IVA 16%', tasa: 0.16, claveImpuestoSat: '002', tipoFactorSat: 'Tasa' },
  });
  const iva0 = await impuestos.crear({
    ...ctx, datos: { nombre: 'IVA 0%', tasa: 0, claveImpuestoSat: '002', tipoFactorSat: 'Tasa' },
  });
  const mayoreo = await listasPrecio.crear({ ...ctx, datos: { nombre: 'Mayoreo' } });

  // [nombre, sku, categoría, marca, unidad, impuesto, costo, precio, claveProdServSat, stockMin]
  const ARTICULOS = [
    ['Refresco cola 600ml', 'BEB-001', 'Bebidas', 'Refrescos del Valle', pieza, iva16, 11, 18, '50202306', 24],
    ['Agua natural 1L', 'BEB-002', 'Bebidas', 'Refrescos del Valle', pieza, iva16, 7, 13, '50202301', 24],
    ['Jugo de naranja 1L', 'BEB-003', 'Bebidas', 'La Demo', pieza, iva16, 16, 27, '50202304', 12],
    ['Papas fritas 45g', 'BOT-001', 'Botanas', 'La Demo', pieza, iva16, 9, 17, '50192100', 20],
    ['Cacahuates 100g', 'BOT-002', 'Botanas', 'Genérica', pieza, iva16, 8, 15, '50101716', 10],
    ['Arroz 1kg', 'ABA-001', 'Abarrotes', 'Genérica', kilo, iva0, 18, 28, '50221101', 10],
    ['Frijol negro 1kg', 'ABA-002', 'Abarrotes', 'Genérica', kilo, iva0, 22, 34, '50221102', 10],
    ['Aceite vegetal 1L', 'ABA-003', 'Abarrotes', 'La Demo', pieza, iva0, 30, 45, '50151513', 6],
    ['Atún en agua 140g', 'ABA-004', 'Abarrotes', 'La Demo', pieza, iva0, 14, 22, '50121537', 12],
    ['Detergente 1kg', 'LIM-001', 'Limpieza', 'Genérica', pieza, iva16, 28, 42, '47131807', 6],
    ['Cloro 1L', 'LIM-002', 'Limpieza', 'Genérica', pieza, iva16, 12, 20, '47131810', 6],
  ];

  const creados = [];
  for (const [nombre, sku, categoria, m, unidad, impuesto, costo, precio, clave, stockMinimo] of ARTICULOS) {
    const articulo = await articulos.crear({
      ...ctx,
      datos: {
        tipo: 'PRODUCTO',
        nombre,
        sku,
        codigoBarras: `750000000${String(creados.length + 1).padStart(4, '0')}`,
        categoriaId: cat[categoria].id,
        marcaId: marca[m].id,
        unidadBaseId: unidad.id,
        impuestoId: impuesto.id,
        costo,
        precio,
        stockMinimo,
        claveProdServSat: clave,
      },
    });
    await articulos.setPrecios({
      ...ctx,
      articuloId: articulo.id,
      precios: [{ listaPrecioId: mayoreo.id, precio: Math.round(precio * 0.9 * 100) / 100 }],
    });
    creados.push({ articulo, unidad, costo });
  }
  await articulos.crear({
    ...ctx,
    datos: {
      tipo: 'SERVICIO',
      nombre: 'Envío a domicilio',
      sku: 'SRV-001',
      categoriaId: cat.Servicios.id,
      unidadBaseId: servicioU.id,
      impuestoId: iva16.id,
      costo: 0,
      precio: 35,
      claveProdServSat: '78102203',
    },
  });

  // --- Clientes y proveedores ---
  await clientes.crear({
    ...ctx,
    datos: {
      nombre: 'Cliente Mayorista Demo',
      telefono: '5511111111',
      correo: 'mayorista@demo.boxpos.test',
      rfc: 'XAXX010101000',
      listaPrecioId: mayoreo.id,
    },
  });
  await clientes.crear({
    ...ctx,
    datos: {
      nombre: 'Escuela Kemper Urgate',
      correo: 'facturas@demo.boxpos.test',
      rfc: 'EKU9003173C9',
      domicilioFiscalCp: '42501',
      regimenFiscalClave: '601',
      usoCfdiPreferido: 'G03',
    },
  });
  await clientes.crear({ ...ctx, datos: { nombre: 'María Demo', telefono: '5522222222' } });

  const proveedorPrincipal = await proveedores.crear({
    ...ctx,
    datos: { nombre: 'Distribuidora Demo', telefono: '5533333333', correo: 'ventas@distdemo.boxpos.test' },
  });
  await proveedores.crear({ ...ctx, datos: { nombre: 'Refrescos del Valle (proveedor)', telefono: '5544444444' } });

  // --- Cajas y stock inicial (compra real, para que el kardex quede consistente) ---
  await cajas.crear({ ...ctx, sucursalId: matriz.id, nombre: 'Caja Principal' });
  await cajas.crear({ ...ctx, sucursalId: norte.id, nombre: 'Caja Norte' });

  for (const sucursal of [matriz, norte]) {
    await compras.crear({
      empresaId,
      usuarioId: usuarioEjecutorId,
      sucursalId: sucursal.id,
      proveedorId: proveedorPrincipal.id,
      folioProveedor: `INV-INICIAL-${sucursal.clave}`,
      observaciones: 'Inventario inicial del sandbox',
      detalles: creados.map(({ articulo, unidad, costo }) => ({
        articuloId: articulo.id,
        unidadId: unidad.id,
        cantidad: 50,
        costo,
      })),
    });
  }

  // --- Superadmin de plataforma (panel /superadmin) ---
  if (!(await prisma.usuario.findUnique({ where: { correo: CORREO_SUPERADMIN } }))) {
    await prisma.usuario.create({
      data: {
        nombre: 'Superadmin Sandbox',
        correo: CORREO_SUPERADMIN,
        passwordHash: await bcrypt.hash(PASSWORD_DEMO, 10),
        esSuperAdmin: true,
      },
    });
  }

  console.log('Sandbox sembrado. Contraseña de todos los usuarios demo:', PASSWORD_DEMO);
  console.log(`  Admin:      ${CORREO_ADMIN}`);
  console.log('  Supervisor: supervisor@demo.boxpos.test');
  console.log('  Cajero:     cajero@demo.boxpos.test');
  console.log('  Almacén:    almacen@demo.boxpos.test');
  console.log(`  Superadmin: ${CORREO_SUPERADMIN}`);
}

main()
  .catch((error) => {
    console.error('Falló la siembra del sandbox:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
