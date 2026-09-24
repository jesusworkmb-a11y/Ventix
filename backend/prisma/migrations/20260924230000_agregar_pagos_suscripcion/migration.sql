-- CreateEnum
CREATE TYPE "EstadoPagoSuscripcion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "pagos_suscripcion" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "meses" INTEGER NOT NULL DEFAULT 1,
    "monto" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "estado" "EstadoPagoSuscripcion" NOT NULL DEFAULT 'PENDIENTE',
    "mp_preferencia_id" TEXT,
    "mp_pago_id" TEXT,
    "mp_estado" TEXT,
    "vigencia_anterior" TIMESTAMP(3),
    "vigencia_nueva" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicado_en" TIMESTAMP(3),

    CONSTRAINT "pagos_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_suscripcion_mp_pago_id_key" ON "pagos_suscripcion"("mp_pago_id");

-- CreateIndex
CREATE INDEX "pagos_suscripcion_empresa_id_creado_en_idx" ON "pagos_suscripcion"("empresa_id", "creado_en");

-- AddForeignKey
ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

