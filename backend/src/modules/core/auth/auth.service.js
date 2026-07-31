const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { ROL_PERMISOS_DEFAULT } = require('../../../shared/permisos.catalog');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { buildSecuenciasIniciales } = require('../../../shared/services/secuencia.service');
const { resolverPermisosDeUsuario } = require('../../../shared/services/permisos.service');

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

  return prisma.$transaction(async (tx) => {
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
}

async function login({ correo, password }) {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) throw new AppError(401, 'Correo o contraseña incorrectos.');

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    throw new AppError(423, 'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta más tarde.');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    const intentosFallidos = usuario.intentosFallidos + 1;
    const seBloquea = intentosFallidos >= MAX_INTENTOS_FALLIDOS;
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: seBloquea ? 0 : intentosFallidos,
        bloqueadoHasta: seBloquea ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000) : null,
      },
    });
    throw new AppError(401, 'Correo o contraseña incorrectos.');
  }

  const usuarioEmpresa = await prisma.usuarioEmpresa.findFirst({
    where: { usuarioId: usuario.id, activo: true },
    include: { empresa: true, rol: true },
  });
  if (!usuarioEmpresa) {
    throw new AppError(403, 'Tu cuenta no está vinculada a ninguna empresa activa.');
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });

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
  };
}

// Resuelve permisos EN VIVO (no del JWT) para que el frontend pueda mostrar/ocultar UI;
// la aplicación real de permisos siempre vive en el backend vía requierePermiso.
async function obtenerMe({ usuarioId, empresaId, rolId }) {
  const [usuario, empresa, rol, permisos] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nombre: true, correo: true } }),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.rol.findUnique({ where: { id: rolId } }),
    resolverPermisosDeUsuario({ usuarioId, rolId }),
  ]);
  return { usuario, empresa, rol, permisos };
}

module.exports = { registrarEmpresa, login, obtenerMe };
