const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const { generarRespaldo } = require('../../../shared/respaldo');
const { formatearNumeroEmpresa } = require('../../../shared/numeroEmpresa');
const zlib = require('zlib');

async function listarEmpresas() {
  return prisma.empresa.findMany({
    select: {
      id: true,
      numero: true,
      nombreComercial: true,
      razonSocial: true,
      correo: true,
      telefono: true,
      estado: true,
      vigenciaHasta: true,
      plan: true,
      creadoEn: true,
      _count: { select: { usuariosEmpresa: true, sucursales: true } },
    },
    orderBy: { creadoEn: 'desc' },
  });
}

async function cambiarEstado({ id, estado, usuarioEjecutorId }) {
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError(404, 'Empresa no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.empresa.update({ where: { id }, data: { estado } });
    await registrarAuditoria(tx, {
      empresaId: id,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: id,
      motivo: 'Cambio de estado por el superadmin de la plataforma.',
      valoresAntes: { estado: empresa.estado },
      valoresDespues: { estado: actualizada.estado },
      esAccionPlataforma: true,
    });
    return actualizada;
  });
}

async function actualizarVigencia({ id, vigenciaHasta, usuarioEjecutorId }) {
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError(404, 'Empresa no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.empresa.update({ where: { id }, data: { vigenciaHasta } });
    await registrarAuditoria(tx, {
      empresaId: id,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: id,
      motivo: 'Cambio de vigencia por el superadmin de la plataforma.',
      valoresAntes: { vigenciaHasta: empresa.vigenciaHasta ? empresa.vigenciaHasta.toISOString() : null },
      valoresDespues: { vigenciaHasta: actualizada.vigenciaHasta ? actualizada.vigenciaHasta.toISOString() : null },
      esAccionPlataforma: true,
    });
    return actualizada;
  });
}

async function actualizarPlan({ id, plan, usuarioEjecutorId }) {
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) throw new AppError(404, 'Empresa no encontrada.');

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.empresa.update({ where: { id }, data: { plan } });
    await registrarAuditoria(tx, {
      empresaId: id,
      usuarioEjecutorId,
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: id,
      motivo: 'Cambio de plan por el superadmin de la plataforma.',
      valoresAntes: { plan: empresa.plan },
      valoresDespues: { plan: actualizada.plan },
      esAccionPlataforma: true,
    });
    return actualizada;
  });
}

// Espera a que el stream acepte más datos; si se cierra antes (el superadmin canceló la descarga
// o se cayó la conexión), rechaza para abortar la transacción de lectura en vez de colgarla.
function esperarDrenado(stream) {
  return new Promise((resolve, reject) => {
    const alDrenar = () => { stream.off('close', alCerrar); resolve(); };
    const alCerrar = () => { stream.off('drain', alDrenar); reject(new Error('La descarga se cerró antes de terminar.')); };
    stream.once('drain', alDrenar);
    stream.once('close', alCerrar);
  });
}

// Respaldo completo (empresaId vacío) o de una sola empresa, en streaming gzip directo a la
// respuesta -- no se arma el archivo en memoria (Render free tiene 512 MB). Formato y alcance
// de cada tabla: ver shared/respaldo.js.
async function descargarRespaldo({ res, empresaId = null, usuarioEjecutorId }) {
  let empresa = null;
  if (empresaId) {
    empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, numero: true, nombreComercial: true },
    });
    if (!empresa) throw new AppError(404, 'Empresa no encontrada.');
  }

  const marca = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const nombre = empresa
    ? `boxpos-respaldo-${formatearNumeroEmpresa(empresa.numero)}-${marca}.ndjson.gz`
    : `boxpos-respaldo-completo-${marca}.ndjson.gz`;
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);

  const gzip = zlib.createGzip();
  gzip.pipe(res);
  res.on('close', () => { if (!gzip.destroyed) gzip.destroy(); });

  const inicio = Date.now();
  try {
    const conteos = await generarRespaldo(prisma, {
      empresa,
      escribir: async (linea) => {
        if (gzip.destroyed) throw new Error('La descarga se cerró antes de terminar.');
        if (!gzip.write(linea)) await esperarDrenado(gzip);
      },
    });
    gzip.end();

    const filas = Object.values(conteos).reduce((a, b) => a + b, 0);
    console.log(`[RESPALDO] ${nombre}: ${filas} filas en ${Date.now() - inicio} ms (usuario ${usuarioEjecutorId})`);
    if (empresa) {
      await registrarAuditoria(null, {
        empresaId: empresa.id,
        usuarioEjecutorId,
        accion: 'EXPORTAR',
        entidad: 'Empresa',
        entidadId: empresa.id,
        motivo: 'Descarga de respaldo de la empresa por el superadmin de la plataforma.',
        valoresDespues: { filas },
        esAccionPlataforma: true,
      });
    }
  } catch (err) {
    // Los encabezados ya se mandaron: no hay forma de responder un error JSON. Se corta la
    // conexión para que el navegador marque la descarga como fallida (el archivo truncado,
    // además, no trae la línea final y el restaurador lo rechazaría).
    console.error(`[RESPALDO] ${nombre} falló: ${err.message}`);
    gzip.destroy();
    res.destroy();
  }
}

module.exports = { listarEmpresas, cambiarEstado, actualizarVigencia, actualizarPlan, descargarRespaldo };
