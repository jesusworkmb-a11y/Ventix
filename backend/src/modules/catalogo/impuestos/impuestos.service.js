const prisma = require('../../../config/db');
const AppError = require('../../../shared/errors/AppError');
const { registrarAuditoria } = require('../../../shared/services/auditoria.service');
const toJson = require('../../../shared/toJson');
const { validarNombreUnico, relanzarConflictoNombre } = require('../../../shared/nombreUnico');
const { aDecimalString } = require('../../../shared/decimal');

const MENSAJE_DUPLICADO = 'Ya existe un impuesto con ese nombre.';

// tasa llega como number crudo del body (z.coerce.number, sin redondear()) -- mismo riesgo de
// ruido de punto flotante que costo/precio en Articulo, ver shared/decimal.js. Las tasas reales
// (IVA 0/0.08/0.16, IEPS) siempre caben en 2 decimales, así que no hay pérdida de precisión.
function aDatosConDecimales(datos) {
  const limpios = { ...datos };
  if (limpios.tasa !== undefined) limpios.tasa = aDecimalString(limpios.tasa);
  return limpios;
}

async function listar({ empresaId }) {
  return prisma.impuesto.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
}

async function crear({ empresaId, usuarioEjecutorId, datos }) {
  await validarNombreUnico({
    prisma, modelo: 'impuesto', empresaId, id: null, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const impuesto = await tx.impuesto.create({ data: { empresaId, ...aDatosConDecimales(datos) } });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'CREAR',
        entidad: 'Impuesto',
        entidadId: impuesto.id,
        valoresDespues: toJson(impuesto),
      });
      return impuesto;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

async function actualizar({ empresaId, usuarioEjecutorId, impuestoId, datos }) {
  const impuesto = await prisma.impuesto.findFirst({ where: { id: impuestoId, empresaId } });
  if (!impuesto) throw new AppError(404, 'Impuesto no encontrado.');

  await validarNombreUnico({
    prisma, modelo: 'impuesto', empresaId, id: impuestoId, nombre: datos.nombre, mensaje: MENSAJE_DUPLICADO,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.impuesto.update({ where: { id: impuestoId }, data: aDatosConDecimales(datos) });
      await registrarAuditoria(tx, {
        empresaId,
        usuarioEjecutorId,
        accion: 'ACTUALIZAR',
        entidad: 'Impuesto',
        entidadId: impuestoId,
        valoresAntes: toJson(impuesto),
        valoresDespues: toJson(actualizado),
      });
      return actualizado;
    });
  } catch (error) {
    relanzarConflictoNombre(error, MENSAJE_DUPLICADO);
  }
}

module.exports = { listar, crear, actualizar };
