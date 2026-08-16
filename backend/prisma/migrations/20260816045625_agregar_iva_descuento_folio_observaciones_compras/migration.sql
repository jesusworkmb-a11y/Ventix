-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "folio_proveedor" TEXT,
ADD COLUMN     "impuestos" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "compras_detalle" ADD COLUMN     "descuento_monto" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "impuesto_tasa" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Backfill: las compras registradas antes de este campo nunca desglosaron impuesto (el costo
-- capturado era el total de la línea a secas) — su "subtotal" real es el total ya guardado, con
-- impuestos en 0, no el default de 0 que dejaría el ALTER TABLE de arriba.
UPDATE "compras" SET "subtotal" = "total" WHERE "subtotal" = 0;
