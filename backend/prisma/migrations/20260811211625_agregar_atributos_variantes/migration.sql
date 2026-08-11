-- AlterTable
ALTER TABLE "articulos" ADD COLUMN     "articulo_padre_id" TEXT;

-- CreateTable
CREATE TABLE "atributos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "atributos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valores_atributo" (
    "id" TEXT NOT NULL,
    "atributo_id" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "valores_atributo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articulo_valores_atributo" (
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "valor_atributo_id" TEXT NOT NULL,

    CONSTRAINT "articulo_valores_atributo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atributos_empresa_id_nombre_key" ON "atributos"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "valores_atributo_atributo_id_valor_key" ON "valores_atributo"("atributo_id", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "articulo_valores_atributo_articulo_id_valor_atributo_id_key" ON "articulo_valores_atributo"("articulo_id", "valor_atributo_id");

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_articulo_padre_id_fkey" FOREIGN KEY ("articulo_padre_id") REFERENCES "articulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atributos" ADD CONSTRAINT "atributos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_atributo" ADD CONSTRAINT "valores_atributo_atributo_id_fkey" FOREIGN KEY ("atributo_id") REFERENCES "atributos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulo_valores_atributo" ADD CONSTRAINT "articulo_valores_atributo_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulo_valores_atributo" ADD CONSTRAINT "articulo_valores_atributo_valor_atributo_id_fkey" FOREIGN KEY ("valor_atributo_id") REFERENCES "valores_atributo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
