-- DropIndex
DROP INDEX "ventas_factura_id_key";

-- CreateIndex
CREATE INDEX "ventas_factura_id_idx" ON "ventas"("factura_id");

