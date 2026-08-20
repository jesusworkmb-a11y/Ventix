const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { ROL_PERMISOS_DEFAULT } = require('../../../shared/permisos.catalog');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { buildSecuenciasIniciales } = require('../../../shared/services/secuencia.service');
const { resolverPermisosDeUsuario } = require('../../../shared/services/permisos.service');
const { formatearFechaCorta } = require('../../../shared/formatearFecha');
const { parsearNumeroEmpresa } = require('../../../shared/numeroEmpresa');
const { enviarCorreo } = require('../../../shared/services/correo.service');

const RECUPERACION_VIGENCIA_MS = 60 * 60 * 1000; // 1 hora
const MENSAJE_RECUPERACION_GENERICO = 'Si los datos coinciden con una cuenta, te enviamos un '
  + 'correo con instrucciones para recuperar el acceso.';

const ROLES_BASE = ['Administrador', 'Supervisor', 'Cajero', 'Almacenista'];
const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 15;

function generarToken({ usuarioId, empresaId, rolId }) {
  return jwt.sign({ empresaId, rolId }, process.env.JWT_SECRET, {
    subject: usuarioId,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

// Alta self-service de empresa + admin, en una sola transacción: Empresa, Sucursal "Matriz",
// los 4 roles base con sus permisos por defecto, las Secuencias iniciales de folios, y el
// usuario administrador vinculado. Usuario.correo es único global, así que un correo repetido
// siempre es un 409 (dirige a login) — nunca se vincula aquí a una empresa existente.
async function registrarEmpresa({ empresa, admin }) {
  const correoExistente = await prisma.usuario.findUnique({ where: { correo: admin.correo } });
  if (correoExistente) {
    throw new AppError(409, 'Ya existe una cuenta con ese correo. Inicia sesión en su lugar.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const nuevaEmpresa = await tx.empresa.create({ data: empresa });
      const sucursal = await tx.sucursal.create({
        data: { empresaId: nuevaEmpresa.id, nombre: 'Matriz', clave: 'MAT' },
      });

      const roles = {};
      for (const nombre of ROLES_BASE) {
        roles[nombre] = await tx.rol.create({ data: { empresaId: nuevaEmpresa.id, nombre } });
      }

      const permisos = await tx.permiso.findMany();
      const permisoIdPorClave = new Map(permisos.map((p) => [p.clave, p.id]));

      const filasRolPermiso = [];
      for (const [nombreRol, claves] of Object.entries(ROL_PERMISOS_DEFAULT)) {
        for (const clave of claves) {
          const permisoId = permisoIdPorClave.get(clave);
          if (permisoId) filasRolPermiso.push({ rolId: roles[nombreRol].id, permisoId });
        }
      }
      await tx.rolPermiso.createMany({ data: filasRolPermiso });
      await tx.secuencia.createMany({ data: buildSecuenciasIniciales(nuevaEmpresa.id, sucursal) });

      const passwordHash = await bcrypt.hash(admin.password, 10);
      const usuario = await tx.usuario.create({
        data: { nombre: admin.nombre, correo: admin.correo, passwordHash },
      });
      await tx.usuarioEmpresa.create({
        data: { usuarioId: usuario.id, empresaId: nuevaEmpresa.id, rolId: roles.Administrador.id },
      });
      await tx.usuarioSucursal.create({ data: { usuarioId: usuario.id, sucursalId: sucursal.id } });

      await registrarAuditoria(tx, {
        empresaId: nuevaEmpresa.id,
        usuarioEjecutorId: usuario.id,
        accion: 'CREAR',
        entidad: 'Empresa',
        entidadId: nuevaEmpresa.id,
      });

      const token = generarToken({ usuarioId: usuario.id, empresaId: nuevaEmpresa.id, rolId: roles.Administrador.id });
      return {
        token,
        empresa: nuevaEmpresa,
        usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
        sucursal,
        rol: roles.Administrador,
      };
    });
  } catch (error) {
    // Cierra la condición de carrera del check previo: si dos registros con el mismo correo
    // llegan casi simultáneos, ambos pueden pasar el check y solo el constraint de la DB
    // detiene al segundo. Sin esto, ese segundo request revienta como 500 crudo en vez de 409.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target?.includes('correo')
    ) {
      throw new AppError(409, 'Ya existe una cuenta con ese correo. Inicia sesión en su lugar.');
    }
    throw error;
  }
}

async function login({ correo, password }) {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) throw new AppError(401, 'Correo o contraseña incorrectos.');

  if (usuario.estado !== 'ACTIVO') {
    throw new AppError(403, 'Tu cuenta está inactiva o bloqueada. Contacta a un administrador.');
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    throw new AppError(423, 'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta más tarde.');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    // Incremento atómico (`SET intentos_fallidos = intentos_fallidos + 1` a nivel DB, no
    // leer-en-JS-y-escribir): con el patrón anterior, logins fallidos concurrentes leían el
    // mismo valor viejo y se pisaban entre sí, así que el conteo nunca llegaba al umbral —
    // reproducido en vivo con 10 intentos fallidos concurrentes seguidos de un login exitoso,
    // la cuenta nunca se bloqueaba. El incremento atómico serializa los intentos concurrentes a
    // nivel de fila, así que el conteo sí sube correctamente bajo concurrencia.
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: { increment: 1 } },
      select: { intentosFallidos: true },
    });
    if (actualizado.intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000) },
      });
    }
    throw new AppError(401, 'Correo o contraseña incorrectos.');
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });

  // Superadmin de plataforma: no está vinculado a ninguna empresa, así que no pasa por
  // UsuarioEmpresa ni por el check de Empresa.estado de abajo. Administra el panel de tenants
  // aparte (ver core/superadmin).
  if (usuario.esSuperAdmin) {
    const token = generarToken({ usuarioId: usuario.id, empresaId: null, rolId: null });
    return {
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
      empresa: null,
      rol: null,
      esSuperAdmin: true,
    };
  }

  const usuarioEmpresa = await prisma.usuarioEmpresa.findFirst({
    where: { usuarioId: usuario.id, activo: true },
    include: { empresa: true, rol: true },
  });
  if (!usuarioEmpresa) {
    throw new AppError(403, 'Tu cuenta no está vinculada a ninguna empresa activa.');
  }
  if (usuarioEmpresa.empresa.estado !== 'ACTIVA') {
    throw new AppError(403, 'Esta empresa está suspendida. Contacta al administrador de la plataforma.');
  }
  // Vigencia separada de `estado` a propósito: "venció la suscripción" y "lo suspendió el
  // superadmin a mano" son motivos distintos, cada uno con su propio mensaje para el cliente.
  const { vigenciaHasta } = usuarioEmpresa.empresa;
  if (vigenciaHasta && vigenciaHasta < new Date()) {
    throw new AppError(
      403,
      `La vigencia de tu suscripción venció el ${formatearFechaCorta(vigenciaHasta)}. Contacta al administrador de la plataforma para renovarla.`,
    );
  }

  const token = generarToken({
    usuarioId: usuario.id,
    empresaId: usuarioEmpresa.empresaId,
    rolId: usuarioEmpresa.rolId,
  });

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
    empresa: usuarioEmpresa.empresa,
    rol: usuarioEmpresa.rol,
    esSuperAdmin: false,
  };
}

// Resuelve permisos EN VIVO (no del JWT) para que el frontend pueda mostrar/ocultar UI;
// la aplicación real de permisos siempre vive en el backend vía requierePermiso.
async function obtenerMe({ usuarioId, empresaId, rolId, esSuperAdmin }) {
  if (esSuperAdmin) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, correo: true },
    });
    return { usuario, empresa: null, rol: null, permisos: [], esSuperAdmin: true };
  }

  const [usuario, empresa, rol, permisos] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nombre: true, correo: true } }),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.rol.findUnique({ where: { id: rolId } }),
    resolverPermisosDeUsuario({ usuarioId, rolId }),
  ]);
  return { usuario, empresa, rol, permisos, esSuperAdmin: false };
}

async function emitirTokenRecuperacionYEnviar(usuario) {
  const tokenCrudo = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenCrudo).digest('hex');
  const expiraEn = new Date(Date.now() + RECUPERACION_VIGENCIA_MS);

  await prisma.passwordResetToken.create({
    data: { usuarioId: usuario.id, tokenHash, expiraEn },
  });

  const link = `${process.env.FRONTEND_URL}/restablecer-password?token=${tokenCrudo}`;
  await enviarCorreo({
    destinatario: usuario.correo,
    asunto: 'Recuperar acceso a BOX POS',
    mensaje: `Hola ${usuario.nombre},\n\nRecibimos una solicitud para restablecer tu contraseña `
      + `de BOX POS. Este enlace es válido por 1 hora:\n\n${link}\n\nSi no fuiste vos, ignorá `
      + 'este correo.',
    html: `<p>Hola ${usuario.nombre},</p><p>Recibimos una solicitud para restablecer tu `
      + `contraseña de BOX POS. Este enlace es válido por 1 hora:</p><p><a href="${link}">${link}`
      + '</a></p><p>Si no fuiste vos, ignorá este correo.</p>',
  });
}

// Identifica la cuenta por correo + número de empresa (ligados, a pedido explícito del usuario
// del proyecto -- el número de empresa es el mismo identificador corto que usa el superadmin en
// /superadmin) y manda un link de un solo uso por correo. Superadmin de plataforma no pasa por
// acá (no tiene empresa) -- si algún día hace falta, es un caso aparte, no self-service.
// Mismo mensaje genérico coincida o no la identificación, para no dar un oráculo de qué correos
// y números de empresa son válidos (mismo criterio que el portal público de autofacturación).
async function solicitarRecuperacion({ correo, numeroEmpresa }) {
  try {
    const numero = parsearNumeroEmpresa(numeroEmpresa);
    const usuario = await prisma.usuario.findUnique({ where: { correo } });

    if (usuario && !usuario.esSuperAdmin && numero !== null) {
      const vinculo = await prisma.usuarioEmpresa.findFirst({
        where: { usuarioId: usuario.id, empresa: { numero } },
      });
      if (vinculo) {
        await emitirTokenRecuperacionYEnviar(usuario);
      }
    }
  } catch (error) {
    // No se propaga: un 502 de Resend solo en el caso "sí coincidía" sería el mismo oráculo que
    // se evita arriba con el mensaje genérico. Se loguea para poder diagnosticar desde soporte.
    console.error('Error en solicitarRecuperacion:', error); // eslint-disable-line no-console
  }
  return { mensaje: MENSAJE_RECUPERACION_GENERICO };
}

async function restablecerPassword({ token, passwordNueva }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const MENSAJE_INVALIDO = 'El enlace no es válido o ya expiró. Solicitá uno nuevo.';

  const registro = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
    throw new AppError(400, MENSAJE_INVALIDO);
  }

  await prisma.$transaction(async (tx) => {
    // Reclamo atómico (mismo patrón `UPDATE...WHERE <condición>` que el resto del proyecto usa
    // para condiciones de carrera): si dos requests con el mismo token llegan casi juntos, el
    // check de arriba puede pasar en ambos -- solo uno gana el claim acá.
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: registro.id, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    if (claim.count === 0) throw new AppError(400, MENSAJE_INVALIDO);

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await tx.usuario.update({
      where: { id: registro.usuarioId },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
    });
    // Defensa en profundidad: si el usuario pidió varios links, uno viejo filtrado no debe
    // seguir sirviendo después de que ya se usó cualquiera de ellos.
    await tx.passwordResetToken.updateMany({
      where: { usuarioId: registro.usuarioId, usadoEn: null },
      data: { usadoEn: new Date() },
    });
  });
}

module.exports = {
  registrarEmpresa, login, obtenerMe, solicitarRecuperacion, restablecerPassword,
};
