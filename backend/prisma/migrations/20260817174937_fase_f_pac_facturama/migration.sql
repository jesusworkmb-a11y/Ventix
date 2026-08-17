-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "pac_id" TEXT;

-- CreateTable
CREATE TABLE "facturas_csd" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "vigencia_hasta" TIMESTAMP(3) NOT NULL,
    "registrado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_csd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_csd_empresa_id_rfc_key" ON "facturas_csd"("empresa_id", "rfc");

-- AddForeignKey
ALTER TABLE "facturas_csd" ADD CONSTRAINT "facturas_csd_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
