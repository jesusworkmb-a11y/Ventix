-- CreateEnum
CREATE TYPE "TipoFactura" AS ENUM ('DIRECTA', 'VENTA_POS', 'AUTOFACTURACION', 'GLOBAL', 'CONSOLIDADA_CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('BORRADOR', 'PENDIENTE', 'TIMBRADA', 'CANCELADA', 'ERROR');

-- CreateEnum
CREATE TYPE "TipoImpuestoCfdi" AS ENUM ('TRASLADO', 'RETENCION');

-- AlterTable
ALTER TABLE "articulos" ADD COLUMN     "clave_prod_serv_sat" TEXT;

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "domicilio_fiscal_cp" TEXT,
ADD COLUMN     "regimen_fiscal_clave" TEXT,
ADD COLUMN     "uso_cfdi_preferido" TEXT;

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "regimen_fiscal_clave" TEXT,
ADD COLUMN     "slug_publico" TEXT;

-- AlterTable
ALTER TABLE "impuestos" ADD COLUMN     "clave_impuesto_sat" TEXT NOT NULL DEFAULT '002',
ADD COLUMN     "tipo_factor_sat" TEXT NOT NULL DEFAULT 'Tasa';

-- AlterTable
ALTER TABLE "sucursales" ADD COLUMN     "codigo_postal" TEXT,
ADD COLUMN     "razon_social" TEXT,
ADD COLUMN     "regimen_fiscal_clave" TEXT,
ADD COLUMN     "rfc" TEXT;

-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "clave_unidad_sat" TEXT;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "factura_id" TEXT;

-- CreateTable
CREATE TABLE "catalogos_sat" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "catalogos_sat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "tipo" "TipoFactura" NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'BORRADOR',
    "serie" TEXT,
    "folio" TEXT,
    "rfc_receptor" TEXT NOT NULL,
    "nombre_receptor" TEXT NOT NULL,
    "regimen_fiscal_receptor" TEXT NOT NULL,
    "uso_cfdi" TEXT NOT NULL,
    "domicilio_fiscal_receptor_cp" TEXT NOT NULL,
    "rfc_emisor" TEXT NOT NULL,
    "razon_social_emisor" TEXT NOT NULL,
    "regimen_fiscal_emisor" TEXT NOT NULL,
    "lugar_expedicion" TEXT NOT NULL,
    "forma_pago" TEXT NOT NULL,
    "metodo_pago" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "tipo_cambio" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30) NOT NULL,
    "total_descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_impuestos_trasladados" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_impuestos_retenidos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "informacion_global_periodicidad" TEXT,
    "informacion_global_meses" TEXT,
    "informacion_global_anio" INTEGER,
    "clave_motivo_cancelacion" TEXT,
    "factura_sustituta_id" TEXT,
    "uuid" TEXT,
    "xml_timbrado" TEXT,
    "cadena_original" TEXT,
    "sello_sat" TEXT,
    "no_certificado_sat" TEXT,
    "fecha_timbrado" TIMESTAMP(3),
    "usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_ventas" (
    "id" TEXT NOT NULL,
    "factura_id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,

    CONSTRAINT "facturas_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_detalle" (
    "id" TEXT NOT NULL,
    "factura_id" TEXT NOT NULL,
    "articulo_id" TEXT,
    "clave_prod_serv_sat" TEXT NOT NULL,
    "clave_unidad_sat" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "valor_unitario" DECIMAL(65,30) NOT NULL,
    "importe" DECIMAL(65,30) NOT NULL,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objeto_impuesto" TEXT NOT NULL,

    CONSTRAINT "facturas_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_detalle_impuestos" (
    "id" TEXT NOT NULL,
    "factura_detalle_id" TEXT NOT NULL,
    "tipo" "TipoImpuestoCfdi" NOT NULL,
    "impuesto_clave_sat" TEXT NOT NULL,
    "tipo_factor_sat" TEXT NOT NULL,
    "base" DECIMAL(65,30) NOT NULL,
    "tasa_o_cuota" DECIMAL(65,30),
    "importe" DECIMAL(65,30),

    CONSTRAINT "facturas_detalle_impuestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalogos_sat_tipo_descripcion_idx" ON "catalogos_sat"("tipo", "descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "catalogos_sat_tipo_clave_key" ON "catalogos_sat"("tipo", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_uuid_key" ON "facturas"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_ventas_venta_id_key" ON "facturas_ventas"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_publico_key" ON "empresas"("slug_publico");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_factura_id_key" ON "ventas"("factura_id");

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_ventas" ADD CONSTRAINT "facturas_ventas_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_detalle" ADD CONSTRAINT "facturas_detalle_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_detalle_impuestos" ADD CONSTRAINT "facturas_detalle_impuestos_factura_detalle_id_fkey" FOREIGN KEY ("factura_detalle_id") REFERENCES "facturas_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

