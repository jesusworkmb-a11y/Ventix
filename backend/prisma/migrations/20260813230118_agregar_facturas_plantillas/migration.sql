-- CreateTable
CREATE TABLE "facturas_plantillas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "forma_pago" TEXT,
    "metodo_pago" TEXT,
    "es_predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "uso_contador" INTEGER NOT NULL DEFAULT 0,
    "ultimo_uso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_plantillas_detalle" (
    "id" TEXT NOT NULL,
    "factura_plantilla_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad_habitual" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "facturas_plantillas_detalle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "facturas_plantillas" ADD CONSTRAINT "facturas_plantillas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_plantillas" ADD CONSTRAINT "facturas_plantillas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_plantillas" ADD CONSTRAINT "facturas_plantillas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_plantillas_detalle" ADD CONSTRAINT "facturas_plantillas_detalle_factura_plantilla_id_fkey" FOREIGN KEY ("factura_plantilla_id") REFERENCES "facturas_plantillas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
