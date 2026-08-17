-- CreateEnum
CREATE TYPE "PlantillaPdf" AS ENUM ('CLASICA', 'MODERNA', 'EJECUTIVA', 'COMERCIAL', 'CATALOGO', 'PREMIUM');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "color_acento" TEXT,
ADD COLUMN     "color_primario" TEXT,
ADD COLUMN     "color_secundario" TEXT,
ADD COLUMN     "datos_bancarios" TEXT,
ADD COLUMN     "plantilla_pdf" "PlantillaPdf" NOT NULL DEFAULT 'CLASICA',
ADD COLUMN     "terminos_condiciones_pdf" TEXT;
