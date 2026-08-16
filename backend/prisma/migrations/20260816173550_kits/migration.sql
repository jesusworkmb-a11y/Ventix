-- AlterEnum
ALTER TYPE "TipoArticulo" ADD VALUE 'KIT';

-- CreateTable
CREATE TABLE "articulos_kit_detalle" (
    "id" TEXT NOT NULL,
    "kit_id" TEXT NOT NULL,
    "articulo_componente_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "articulos_kit_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articulos_kit_detalle_kit_id_articulo_componente_id_key" ON "articulos_kit_detalle"("kit_id", "articulo_componente_id");

-- AddForeignKey
ALTER TABLE "articulos_kit_detalle" ADD CONSTRAINT "articulos_kit_detalle_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos_kit_detalle" ADD CONSTRAINT "articulos_kit_detalle_articulo_componente_id_fkey" FOREIGN KEY ("articulo_componente_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
