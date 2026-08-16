-- CreateEnum
CREATE TYPE "CotizacionEstado" AS ENUM ('VIGENTE', 'CONVERTIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "estado" "CotizacionEstado" NOT NULL DEFAULT 'VIGENTE';

-- AlterTable
ALTER TABLE "ventas_detalle" ADD COLUMN     "costo_unitario" DECIMAL(65,30);

-- DataMigration: las cotizaciones ya convertidas antes de este campo deben quedar CONVERTIDA,
-- no VIGENTE (el default). "RESERVADO" es un valor temporal de lock usado solo mientras se
-- procesa una conversión en curso (ver cotizaciones.service.js#convertir) — no debería
-- persistir así en ninguna fila existente, pero se excluye por las dudas para no marcar como
-- convertida una cotización que en realidad quedó con el lock trabado por un fallo pasado.
UPDATE "cotizaciones"
SET "estado" = 'CONVERTIDA'
WHERE "convertida_en_venta_id" IS NOT NULL
  AND "convertida_en_venta_id" <> 'RESERVADO';
