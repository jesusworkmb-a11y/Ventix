-- CreateIndex
CREATE UNIQUE INDEX "categorias_empresa_id_categoria_padre_id_nombre_key" ON "categorias"("empresa_id", "categoria_padre_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "impuestos_empresa_id_nombre_key" ON "impuestos"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "listas_precio_empresa_id_nombre_key" ON "listas_precio"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "marcas_empresa_id_nombre_key" ON "marcas"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_empresa_id_nombre_key" ON "unidades"("empresa_id", "nombre");
