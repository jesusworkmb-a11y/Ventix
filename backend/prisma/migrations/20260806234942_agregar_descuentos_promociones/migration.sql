-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "AlcanceDescuento" AS ENUM ('TODOS', 'CATEGORIA', 'ARTICULO');

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "autorizado_por_id" TEXT;

-- AlterTable
ALTER TABLE "ventas_detalle" ADD COLUMN     "descuento_id" TEXT,
ADD COLUMN     "descuento_monto" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "promocion_id" TEXT;

-- CreateTable
CREATE TABLE "descuentos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDescuento" NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "alcance" "AlcanceDescuento" NOT NULL DEFAULT 'TODOS',
    "categoria_id" TEXT,
    "articulo_id" TEXT,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descuentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promociones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alcance" "AlcanceDescuento" NOT NULL,
    "categoria_id" TEXT,
    "articulo_id" TEXT,
    "cantidad_requerida" INTEGER NOT NULL,
    "cantidad_gratis" INTEGER NOT NULL,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "descuentos" ADD CONSTRAINT "descuentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuentos" ADD CONSTRAINT "descuentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuentos" ADD CONSTRAINT "descuentos_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_descuento_id_fkey" FOREIGN KEY ("descuento_id") REFERENCES "descuentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promociones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
