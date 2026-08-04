const bcrypt = require('bcrypt');
const { Prisma } = require('@prisma/client');
const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { parsePaginacion, parseOrden, respuestaPaginada } = require('../../../shared/paginacion');

const INCLUDE_USUARIO = {
  usuario: { select: { id: true, nombre: true, correo: true, estado: true, ultimoAcceso: true } },
  rol: true,
};

const COLUMNAS_ORDENABLES = {
  nombre: 'usuario.nombre',
  correo: 'usuario.correo',
  rol: 'rol.nombre',
  estado: 'usuario.estado',
};

function relacionAUsuario(r) {
  return { ...r.usuario, activo: r.activo, rol: r.rol };
}

// `paginacion` opcional, mismo criterio que Artículos/Clientes/Proveedores: sin `pagina`
// explícita devuelve el array completo (VentasHistorialPage/AuditoriaPage/AjustesPage lo usan
// como fuente de un dropdown, no como tabla), solo pagina cuando el caller la pide (UsuariosPage).
// El modelo real es UsuarioEmpresa (join table), no Usuario directo — de ahí filtrar/ordenar por
// campos anidados `usuario.*`/`rol.*`.
async function listar({ empresaId, filtros, paginacion, ordenamiento }) {
  const where = { empresaId };
  if (filtros?.buscar) {
    where.usuario = {
      OR: [
        { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
        { correo: { contains: filtros.buscar, mode: 'insensitive' } },
      ],
    };
  }

  if (!paginacion || paginacion.pagina === undefined) {
    const relaciones = await prisma.usuarioEmpresa.findMany({ where, include: INCLUDE_USUARIO });
    return relaciones.map(relacionAUsuario);
  }

  const paginado = parsePaginacion(paginacion);
  const orderBy = parseOrden(ordenamiento || {}, COLUMNAS_ORDENABLES, { usuario: { nombre: 'asc' } });

  const [relaciones, total] = await Promise.all([
    prisma.usuarioEmpresa.findMany({
      where, include: INCLUDE_USUARIO, orderBy, skip: paginado.skip, take: paginado.take,
    }),
    prisma.usuarioEmpresa.count({ where }),
  ]);
  return respuestaPaginada(relaciones.map(relacionAUsuario), total, paginado);
}

// Solo crea usuarios con correo nuevo (Usuario.correo es único global). Si el correo ya existe
// en otra empresa, responde 409 en vez de vincularlo — vincular una cuenta existente a una
// segunda empresa queda para una fase posterior (mantiene el login de Fase 1 simple: un usuario
// siempre resuelve a una sola empresa).
async function crear({ empresaId, usuarioEjecutorId, datos }) {
  const rol = await prisma.rol.findFirst({ where: { id: datos.rolId, empresaId } });
  if (!rol) throw new AppError(400, 'El rol indicado no pertenece a esta empresa.');

  const correoExistente = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
  if (correoExistente) throw new AppError(409, 'Ya existe una cuenta con ese correo.');

  try {
    return await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(datos.password, 10);
      const usuario = await tx.usuario.create({
        data: { nombre: datos.nombre, correo: datos.correo, passwordHash },
      });
      await tx.usuarioEmpresa.create({ data: { usuarioId: usuario.id, empresaId, rolId: datos.rolId } });

      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Usuario',
        entidadId: usuario.id,
        valoresDespues: toJson({ nombre: usuario.nombre, correo: usuario.correo, rolId: datos.rolId }),
      });

      return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol };
    });
  } catch (error) {
    // Mismo saneo de condición de carrera que en auth.service.registrarEmpresa: el check
    // previo no es atómico, así que el constraint único de la DB es la última línea de
    // defensa contra dos altas simultáneas con el mismo correo.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target?.includes('correo')
    ) {
      throw new AppError(409, 'Ya existe una cuenta con ese correo.');
    }
    throw error;
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, usuarioId, datos }) {
  const relacion = await prisma.usuarioEmpresa.findUnique({
    where: { usuarioId_empresaId: { usuarioId, empresaId } },
    include: { usuario: true },
  });
  if (!relacion) throw new AppError(404, 'Usuario no encontrado en esta empresa.');

  if (datos.rolId) {
    const rol = await prisma.rol.findFirst({ where: { id: datos.rolId, empresaId } });
    if (!rol) throw new AppError(400, 'El rol indicado no pertenece a esta empresa.');
  }

  return prisma.$transaction(async (tx) => {
    const antes = { estado: relacion.usuario.estado, rolId: relacion.rolId };

    if (datos.rolId) {
      await tx.usuarioEmpresa.update({ where: { id: relacion.id }, data: { rolId: datos.rolId } });
    }
    if (datos.estado || datos.telefono !== undefined) {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          ...(datos.estado ? { estado: datos.estado } : {}),
          ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
        },
      });
    }

    await registrarAuditoria(tx, {
      empresaId,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: usuarioId,
      valoresAntes: toJson(antes),
      valoresDespues: toJson({ estado: datos.estado ?? antes.estado, rolId: datos.rolId ?? antes.rolId }),
    });

    const actualizado = await tx.usuarioEmpresa.findUnique({
      where: { id: relacion.id },
      include: { usuario: { select: { id: true, nombre: true, correo: true, estado: true } }, rol: true },
    });
    return { ...actualizado.usuario, rol: actualizado.rol };
  });
}

module.exports = { listar, crear, actualizar };
