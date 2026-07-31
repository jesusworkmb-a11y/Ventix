-- CreateEnum
CREATE TYPE "EstadoGeneral" AS ENUM ('ACTIVA', 'SUSPENDIDA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "TipoArticulo" AS ENUM ('PRODUCTO', 'SERVICIO');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA_COMPRA', 'SALIDA_VENTA', 'ENTRADA_DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'INVENTARIO_INICIAL', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'CANCELACION_COMPRA', 'CANCELACION_VENTA');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'RETIRO', 'VENTA', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "razon_social" TEXT,
    "rfc" TEXT,
    "pais" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "zona_horaria" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "sitio_web" TEXT,
    "logo_url" TEXT,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "responsable" TEXT,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "telefono" TEXT,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "ultimo_acceso" TIMESTAMP(3),
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_empresas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuarios_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_sucursales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,

    CONSTRAINT "usuarios_sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,
    "permiso_id" TEXT NOT NULL,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos_usuario_excepciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "permiso_id" TEXT NOT NULL,
    "concedido" BOOLEAN NOT NULL,

    CONSTRAINT "permisos_usuario_excepciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT,
    "tipo_documento" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "siguiente_numero" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "secuencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT,
    "usuario_ejecutor_id" TEXT NOT NULL,
    "usuario_autorizador_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "folio" TEXT,
    "motivo" TEXT,
    "valores_antes" JSONB,
    "valores_despues" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_internas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_internas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria_padre_id" TEXT,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marcas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "abreviatura" TEXT,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_alternas" (
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "factor" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "unidades_alternas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impuestos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tasa" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "impuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articulos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoArticulo" NOT NULL,
    "clave" TEXT,
    "sku" TEXT,
    "codigo_barras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria_id" TEXT,
    "marca_id" TEXT,
    "unidad_base_id" TEXT NOT NULL,
    "impuesto_id" TEXT,
    "costo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(65,30),
    "stock_maximo" DECIMAL(65,30),
    "imagen_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_precio" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "es_base" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "listas_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_articulo" (
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "lista_precio_id" TEXT NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "precios_articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articulos_proveedores" (
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "articulos_proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "es_general" BOOLEAN NOT NULL DEFAULT false,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "rfc" TEXT,
    "direccion" TEXT,
    "lista_precio_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "rfc" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "existencias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "existencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "referencia_tipo" TEXT NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "folio" TEXT,
    "motivo" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "autorizado_por_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_detalle" (
    "id" TEXT NOT NULL,
    "ajuste_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ajustes_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteos_fisicos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CAPTURA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteos_fisicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteos_detalle" (
    "id" TEXT NOT NULL,
    "conteo_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad_sistema" DECIMAL(65,30) NOT NULL,
    "cantidad_fisica" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "conteos_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_origen_id" TEXT NOT NULL,
    "sucursal_destino_id" TEXT NOT NULL,
    "folio" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_TRANSITO',
    "usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_detalle" (
    "id" TEXT NOT NULL,
    "transferencia_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "transferencias_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "folio" TEXT,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'CONFIRMADA',
    "total" DECIMAL(65,30) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_detalle" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "costo" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "compras_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cajas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_caja" (
    "id" TEXT NOT NULL,
    "caja_id" TEXT NOT NULL,
    "usuario_responsable_id" TEXT NOT NULL,
    "fondo_inicial" DECIMAL(65,30) NOT NULL,
    "saldo_esperado" DECIMAL(65,30),
    "saldo_real" DECIMAL(65,30),
    "diferencia" DECIMAL(65,30),
    "abierta_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_en" TIMESTAMP(3),

    CONSTRAINT "sesiones_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL,
    "sesion_caja_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "motivo" TEXT,
    "referencia_tipo" TEXT,
    "referencia_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "autorizado_por_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "sesion_caja_id" TEXT NOT NULL,
    "folio" TEXT,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'CONFIRMADA',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "impuestos" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_detalle" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,
    "impuesto_tasa" DECIMAL(65,30) NOT NULL,
    "cantidad_devuelta" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "ventas_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "folio" TEXT,
    "motivo" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "autorizado_por_id" TEXT NOT NULL,
    "reembolso" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_detalle" (
    "id" TEXT NOT NULL,
    "devolucion_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "vuelve_a_stock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "devoluciones_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "folio" TEXT,
    "total" DECIMAL(65,30) NOT NULL,
    "convertida_en_venta_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones_detalle" (
    "id" TEXT NOT NULL,
    "cotizacion_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "cotizaciones_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_empresa_id_clave_key" ON "sucursales"("empresa_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresas_usuario_id_empresa_id_key" ON "usuarios_empresas"("usuario_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sucursales_usuario_id_sucursal_id_key" ON "usuarios_sucursales"("usuario_id", "sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresa_id_nombre_key" ON "roles"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_clave_key" ON "permisos"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "roles_permisos_rol_id_permiso_id_key" ON "roles_permisos"("rol_id", "permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_usuario_excepciones_usuario_id_permiso_id_key" ON "permisos_usuario_excepciones"("usuario_id", "permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_empresa_id_clave_key" ON "configuraciones"("empresa_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_empresa_id_sucursal_id_tipo_documento_key" ON "secuencias"("empresa_id", "sucursal_id", "tipo_documento");

-- CreateIndex
CREATE INDEX "auditorias_empresa_id_entidad_entidad_id_idx" ON "auditorias"("empresa_id", "entidad", "entidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_alternas_articulo_id_unidad_id_key" ON "unidades_alternas"("articulo_id", "unidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "articulos_empresa_id_sku_key" ON "articulos"("empresa_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "articulos_empresa_id_codigo_barras_key" ON "articulos"("empresa_id", "codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "precios_articulo_articulo_id_lista_precio_id_key" ON "precios_articulo"("articulo_id", "lista_precio_id");

-- CreateIndex
CREATE UNIQUE INDEX "articulos_proveedores_articulo_id_proveedor_id_key" ON "articulos_proveedores"("articulo_id", "proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "existencias_sucursal_id_articulo_id_key" ON "existencias"("sucursal_id", "articulo_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_empresa_id_sucursal_id_articulo_id_idx" ON "movimientos_inventario"("empresa_id", "sucursal_id", "articulo_id");

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_sucursales" ADD CONSTRAINT "usuarios_sucursales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_sucursales" ADD CONSTRAINT "usuarios_sucursales_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_usuario_excepciones" ADD CONSTRAINT "permisos_usuario_excepciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_usuario_excepciones" ADD CONSTRAINT "permisos_usuario_excepciones_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuraciones" ADD CONSTRAINT "configuraciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secuencias" ADD CONSTRAINT "secuencias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_internas" ADD CONSTRAINT "notificaciones_internas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_categoria_padre_id_fkey" FOREIGN KEY ("categoria_padre_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcas" ADD CONSTRAINT "marcas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_alternas" ADD CONSTRAINT "unidades_alternas_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_alternas" ADD CONSTRAINT "unidades_alternas_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_unidad_base_id_fkey" FOREIGN KEY ("unidad_base_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_impuesto_id_fkey" FOREIGN KEY ("impuesto_id") REFERENCES "impuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_precio" ADD CONSTRAINT "listas_precio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_articulo" ADD CONSTRAINT "precios_articulo_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_articulo" ADD CONSTRAINT "precios_articulo_lista_precio_id_fkey" FOREIGN KEY ("lista_precio_id") REFERENCES "listas_precio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos_proveedores" ADD CONSTRAINT "articulos_proveedores_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos_proveedores" ADD CONSTRAINT "articulos_proveedores_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_lista_precio_id_fkey" FOREIGN KEY ("lista_precio_id") REFERENCES "listas_precio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencias" ADD CONSTRAINT "existencias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencias" ADD CONSTRAINT "existencias_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencias" ADD CONSTRAINT "existencias_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_detalle" ADD CONSTRAINT "ajustes_detalle_ajuste_id_fkey" FOREIGN KEY ("ajuste_id") REFERENCES "ajustes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_detalle" ADD CONSTRAINT "conteos_detalle_conteo_id_fkey" FOREIGN KEY ("conteo_id") REFERENCES "conteos_fisicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_detalle" ADD CONSTRAINT "transferencias_detalle_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "transferencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_detalle" ADD CONSTRAINT "compras_detalle_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_sesion_caja_id_fkey" FOREIGN KEY ("sesion_caja_id") REFERENCES "sesiones_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sesion_caja_id_fkey" FOREIGN KEY ("sesion_caja_id") REFERENCES "sesiones_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_detalle" ADD CONSTRAINT "devoluciones_detalle_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_detalle" ADD CONSTRAINT "cotizaciones_detalle_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
