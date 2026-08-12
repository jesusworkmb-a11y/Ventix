# Ventix — POS multi-tenant

Generado a partir de:
- `VENTIX_ESPECIFICACION_MAESTRA_INTEGRAL_V1.md`
- `VENTIX_BASE_TECNICA_CONSOLIDADA_V1.md`
- `VENTIX_PLAN_DE_TRABAJO_V1.md`

## Estado actual (2026-08-11)

Las 10 fases del plan original están completas, commiteadas y en GitHub
(`https://github.com/jesusworkmb-a11y/Ventix`, rama `main`), **y desplegadas en producción en Render**.

| Fase | Módulo |
|---|---|
| 0 | Cimentación técnica (Express + React + Prisma + PostgreSQL) |
| 1 | MOD-001 Core (auth, empresas, sucursales, usuarios, roles, permisos, folios, auditoría) |
| 2 | MOD-002 Catálogo (artículos, categorías, marcas, unidades, impuestos) |
| 3 | MOD-003 Clientes / Proveedores |
| 4 | MOD-004 Inventario (existencias, kardex, ajustes, transferencias) |
| 5 | MOD-005 Compras |
| 6 | MOD-006 Caja (sesiones, movimientos) |
| 7 | MOD-007 Ventas (ventas, devoluciones, cotizaciones) |
| 9 | MOD-009 Reportes |
| 10 | MOD-010 Herramientas (importar/exportar CSV) |

(No existe Fase 8 en la numeración original del plan.)

Base de datos: Supabase (Postgres gestionado). Repo: GitHub, un commit detallado por fase.

### Producción (Render)

| Servicio | URL |
|---|---|
| Frontend (Static Site) | https://ventix-frontend.onrender.com |
| Backend (Web Service) | https://ventix-backend-yjgv.onrender.com |
| Health check | https://ventix-backend-yjgv.onrender.com/api/health |

Login de prueba en producción: `jesus.rodriguez@ventixdemo.test` / `SuperSegura123`.

Notas del despliegue:
- El blueprint vive en [`render.yaml`](render.yaml) (raíz del repo) — define ambos servicios para que Render
  los cree juntos vía **New + → Blueprint**.
- `DATABASE_URL` en Render usa el **connection pooler** de Supabase en modo *Session*
  (`aws-0-<region>.pooler.supabase.com:5432`), no la conexión directa (`db.<ref>.supabase.co`) que
  aparece por defecto: las máquinas de build de Render no tienen salida IPv6 y la conexión directa de
  proyectos nuevos de Supabase solo resuelve por IPv6.
- La contraseña de la base de datos debe ser alfanumérica (sin `#`, `%`, `/`, `?`, etc.) — esos caracteres
  rompen el parseo de `DATABASE_URL` si no van *URL-encoded*.
- El frontend es un Static Site: `VITE_API_URL` se hornea en build time, así que cualquier cambio a esa
  variable requiere un **Manual Deploy** en `ventix-frontend` para tomar efecto (guardar la variable sola
  no alcanza).
- `FRONTEND_URL` (backend) y `VITE_API_URL` (frontend) deben apuntar el uno al otro para que CORS y las
  llamadas a la API funcionen — ver `render.yaml` para el resto de variables.
- Plan free: cold start tras inactividad (~30–50s la primera petición después de estar dormido).

**Para retomar el proyecto** (incluida una conversación nueva de Claude Code):
1. Abre Claude Code en `C:\Users\DELL\Documents\Quique\Ventix\ventix-fase0\ventix`.
2. Pide que lea este README y, si hace falta más detalle, `git log --oneline` (los mensajes de
   commit documentan qué se hizo y por qué en cada fase).
3. Para desarrollo local, levanta los servidores (no persisten entre sesiones/reinicios de máquina):
   ```bash
   cd backend && npm run dev   # http://localhost:4000
   cd frontend && npm run dev  # http://localhost:5173
   ```
   Los `.env` de ambos ya están configurados (Supabase + JWT secret) — no hace falta tocarlos.
   `backend/.env` apunta directo a Supabase (no al pooler) con la misma base que producción;
   si `DATABASE_URL` da "Authentication failed" es que la contraseña quedó desactualizada
   respecto a Supabase — pídesela al usuario o probá contra producción vía `curl`/`fetch` en el
   navegador en su lugar (`https://ventix-backend-yjgv.onrender.com`), como se hizo en el QA de
   Caja y el cierre de pendientes de Ventas. Para probar el frontend contra producción localmente
   hace falta más que cambiar `VITE_API_URL`: el backend de Render solo permite CORS desde
   `FRONTEND_URL` (el frontend ya desplegado), no desde `localhost:5173` — para verificar cambios
   de frontend en vivo, pusheá y probá contra `https://ventix-frontend.onrender.com` directamente.
4. Login de prueba: `jesus.rodriguez@ventixdemo.test` / `SuperSegura123`.
5. Dile qué sigue: no queda ningún pendiente abierto (10 módulos completos y en producción, dos
   rondas de QA cerradas, rediseño visual + su pulido ya aplicados, documentos de venta,
   descuentos/promociones, alertas de stock, unidades alternas + variantes de producto,
   restricción de nombre único en Catálogo y envío de documentos por correo ya implementados) —
   ver el detalle de opciones en "Qué sigue" al final de este README.

## QA de MOD-001 Core (2026-08-02)

Primera pasada de QA sobre auth/empresas/sucursales/usuarios/roles/permisos/auditoría —
revisión de código + pruebas en vivo contra producción (con limpieza de datos de prueba
después de cada una). Encontrado y corregido:

- **Crítico — el bloqueo de usuario no funcionaba en absoluto.** `login()` solo validaba el
  bloqueo automático temporal (5 intentos fallidos), nunca el campo `estado` que fija un
  admin — un usuario puesto en `BLOQUEADO` podía seguir logueando normal. Además, el
  middleware de auth no revalidaba el estado en cada request, así que ni siquiera las
  sesiones ya abiertas se cortaban. Corregido en ambos puntos
  ([auth.service.js](backend/src/modules/core/auth/auth.service.js),
  [auth.middleware.js](backend/src/middlewares/auth.middleware.js)).
- **`PUT /roles/:id/permisos` fallaba con claves de permiso duplicadas** aunque todas
  fueran válidas (comparaba el largo del array crudo contra el deduplicado por la DB).
  Corregido en [roles.service.js](backend/src/modules/core/roles/roles.service.js).
- **Condición de carrera en alta de empresa/usuario con correo duplicado**: el chequeo de
  correo existente corría antes de la transacción, no de forma atómica; dos altas casi
  simultáneas con el mismo correo podían terminar en un 500 crudo en vez de un 409 limpio.
  Corregido atrapando el constraint único de Postgres en
  [auth.service.js](backend/src/modules/core/auth/auth.service.js) y
  [usuarios.service.js](backend/src/modules/core/usuarios/usuarios.service.js).
- **Vacío funcional grande: no existía UI de administración.** El backend ya tenía CRUD
  completo de sucursales/usuarios/roles/permisos y consulta de auditoría, pero el frontend
  solo implementaba login/registro. Se construyeron las 4 pantallas nuevas (alta + edición
  inline, sin librería de UI, mismo estilo que el resto del frontend):
  [SucursalesPage](frontend/src/modules/core/pages/SucursalesPage.jsx),
  [UsuariosPage](frontend/src/modules/core/pages/UsuariosPage.jsx),
  [RolesPage](frontend/src/modules/core/pages/RolesPage.jsx) (con matriz de permisos por
  checkbox) y [AuditoriaPage](frontend/src/modules/core/pages/AuditoriaPage.jsx). El nav del
  dashboard oculta estos links según los permisos reales del usuario.

Pendiente, baja prioridad: los endpoints `PATCH` de actualización aceptan body vacío `{}` y
de todos modos escriben una entrada de auditoría sin cambios reales (ruido cosmético, no
afecta seguridad ni datos).

## QA de MOD-008 Ventas (2026-08-03)

Primera pasada de QA sobre ventas/devoluciones/cotizaciones — revisión de código + pruebas
en vivo contra producción, incluyendo reproducción intencional de cada bug antes del fix y
reverificación después del deploy (con limpieza de datos de prueba después de cada una).
Encontrado y corregido:

- **Crítico — se podía procesar una devolución sobre una venta ya cancelada.** `crear()` en
  devoluciones no validaba `venta.estado`. Cancelar una venta ya restaura el stock
  (`CANCELACION_VENTA`); una devolución posterior sobre esa misma venta volvía a acreditar
  stock (unidad fantasma, verificado en vivo: 88 → 89) y generaba un reembolso de caja
  indebido sobre una venta que nunca se cobró de verdad tras la cancelación. Corregido en
  [devoluciones.service.js](backend/src/modules/ventas/devoluciones/devoluciones.service.js)
  exigiendo `estado === 'CONFIRMADA'`.
- **Crítico — condición de carrera al convertir una cotización en venta.** El check de
  "¿ya fue convertida?" y el marcado de `convertidaEnVentaId` no eran atómicos; dos
  conversiones casi simultáneas de la misma cotización pasaban ambas el check y generaban
  dos ventas (stock y cobro duplicados) — reproducido en vivo disparando dos requests
  concurrentes, ambos con `201`. Corregido en
  [cotizaciones.service.js](backend/src/modules/ventas/cotizaciones/cotizaciones.service.js)
  reclamando la cotización con un `UPDATE...WHERE convertidaEnVentaId IS NULL` antes de crear
  la venta (misma idea de apoyarse en una garantía atómica de Postgres que el fix del correo
  duplicado en Core); si la creación de la venta falla, se libera el candado.
- **El reembolso de una devolución no incluía el impuesto.** Se calculaba como
  `cantidad × precio`, ignorando `impuestoTasa` — una devolución sobre una venta de $23.20
  (con 16% de IVA) reembolsaba $20.00. Corregido en el mismo archivo de devoluciones,
  incluyendo el impuesto y redondeando a 2 decimales (mismo patrón que
  subtotal/impuestos/total en [ventas.service.js](backend/src/modules/ventas/ventas/ventas.service.js)).

### Cierre de los dos pendientes (2026-08-03)

- **Validación sucursal↔caja.** Se decidió que era un bug: se podía vender/devolver en una
  sucursal cobrando contra la caja de otra. Corregido en el único punto de escritura de
  `MovimientoCaja` ([caja.service.js](backend/src/shared/services/caja.service.js)
  `registrarMovimientoCaja`), que ahora acepta un `sucursalId` opcional y exige que la caja de
  la sesión sea de esa sucursal cuando se manda (Ventas y Devoluciones lo mandan; Caja/INGRESO-
  RETIRO no, ahí no hay nada que cruzar). Verificado en vivo: venta/devolución/conversión de
  cotización con caja de otra sucursal → rechazado; con la caja correcta → aceptado.
  - De paso, verificando esto en vivo apareció un bug no relacionado: crear una sucursal nueva
    (`sucursales.crear`) nunca sembraba sus filas de `Secuencia` (folios VTA/COM/COT/DEV/AJU) —
    el primer documento en una sucursal creada después del alta de la empresa reventaba con 500
    crudo. Corregido en
    [secuencia.service.js](backend/src/shared/services/secuencia.service.js) y
    [sucursales.service.js](backend/src/modules/core/sucursales/sucursales.service.js).
- **UI de cancelar/devoluciones/cotizaciones.** Construida en
  [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx) (cancelar y devolver como
  acciones inline por fila, sobre ventas `CONFIRMADA`) y
  [CotizacionesPage.jsx](frontend/src/modules/ventas/pages/CotizacionesPage.jsx) (nueva, ruta
  `/ventas/cotizaciones`: crear, listar, convertir). Bug propio encontrado al verificar en vivo:
  el panel de conversión mandaba `Cotizacion.total` como pago, pero ese campo es solo el
  subtotal (el impuesto se calcula recién al convertir, con la tasa vigente en ese momento) —
  la conversión fallaba en cualquier artículo con impuesto. Corregido recalculando el total con
  impuesto antes de mostrar/enviar el monto a cobrar.

## QA de MOD-006 Caja (2026-08-03)

Primera pasada de QA sobre cajas/sesiones/movimientos — revisión de código + pruebas en vivo
contra producción, disparando requests concurrentes con `curl` para reproducir cada condición
de carrera antes del fix y reverificando después del deploy (con limpieza de datos de prueba
después de cada una). Encontrado y corregido:

- **Crítico — el flag `activa` de una caja no se validaba en ningún lado.** Se podía
  desactivar una caja (`PATCH /caja/cajas/:id`) y aun así seguir abriendo sesiones sobre ella
  con total normalidad — mismo tipo de vacío que el estado `BLOQUEADO` en Core (nadie leía el
  flag al abrir). Verificado en vivo: caja desactivada, `POST /caja/sesiones` devolvía `201`.
- **Crítico — condición de carrera al abrir sesión.** El check de "¿ya tiene una sesión
  abierta?" y la creación de la sesión no eran atómicos: dos aperturas casi simultáneas de la
  misma caja pasaban ambas el check. Reproducido en vivo disparando 5 aperturas concurrentes
  contra la misma caja: 2 de 5 tuvieron éxito, dejando dos sesiones abiertas a la vez sobre
  una única caja física.
- **Crítico — condición de carrera al cerrar sesión / registrar movimiento.** Dos problemas
  relacionados, ambos por la misma causa (lectura de movimientos y `UPDATE` del cierre fuera
  de una transacción compartida con las demás escrituras contra la sesión):
  - *Doble cierre*: 5 cierres concurrentes sobre la misma sesión, 4 de 5 devolvieron `200`
    con `saldoEsperado`/`diferencia` distintos cada uno (gana el último `UPDATE` en la fila;
    los otros 3 cajeros veían en pantalla un resultado que nunca quedó guardado).
  - *Movimiento perdido*: 15 movimientos + 1 cierre disparados en paralelo sobre una sesión
    nueva — los 15 se insertaron con éxito (`201`), pero el cierre calculó `saldoEsperado`
    contando solo 12, dejando 3 fuera del cálculo por haberse insertado entre la lectura de
    movimientos y el `UPDATE` del cierre — diferencia de caja fantasma sin que nada fallara.

  Corregido en [sesiones.service.js](backend/src/modules/caja/sesiones/sesiones.service.js)
  (`abrir`, `cerrar`) y en
  [caja.service.js](backend/src/shared/services/caja.service.js) (`registrarMovimientoCaja`,
  compartida también por Ventas/Devoluciones) tomando un `SELECT ... FOR UPDATE` sobre la fila
  de la caja/sesión al principio de cada transacción — serializa aperturas, cierres y
  movimientos concurrentes en vez de dejarlos correr en paralelo con datos obsoletos.

Sin pendientes abiertos de esta pasada — los tres bugs se corrigieron y reverificaron en vivo
contra producción tras el deploy.

## QA de MOD-004 Inventario (2026-08-03)

Primera pasada de QA sobre existencias/kardex/ajustes/transferencias/conteos físicos —
revisión de código + pruebas en vivo contra producción, disparando requests concurrentes con
`curl` para reproducir cada condición de carrera antes del fix y reverificando después del
deploy (con limpieza/corrección de datos de prueba después de cada una, incluyendo ajustes
compensatorios cuando el bug alcanzó a escribir stock de más). Encontrado y corregido:

- **Crítico — condición de carrera al recibir una transferencia.** `recibir()` chequeaba
  `estado === 'EN_TRANSITO'` fuera de la transacción y acreditaba el destino sin reclamar el
  documento primero. Reproducido en vivo: 5 `recibir()` concurrentes sobre una transferencia de
  5 unidades, las 5 con `200` y el destino terminó en +25 en vez de +5. Corregido en
  [transferencias.service.js](backend/src/modules/inventario/transferencias/transferencias.service.js)
  reclamando la transferencia con un `UPDATE...WHERE estado='EN_TRANSITO'` antes de aplicar los
  movimientos (mismo patrón que la conversión de cotización en Ventas y el cierre de sesión en
  Caja). Reverificado: de 5 concurrentes, solo 1 tiene éxito.
- **Crítico — condición de carrera al autorizar un conteo físico.** Mismo patrón: `cambiarEstado()`
  chequeaba la transición válida fuera de la transacción y, al pasar a `AUTORIZADO`, aplicaba el
  ajuste de kardex (diferencia física − sistema) sin reclamar el documento. Reproducido en vivo:
  5 `cambiarEstado()` concurrentes de `REVISION` a `AUTORIZADO` sobre el mismo conteo — sin el
  fix habría duplicado el ajuste de stock. Corregido en
  [conteos.service.js](backend/src/modules/inventario/conteos/conteos.service.js) con el mismo
  `UPDATE...WHERE estado=<el leído>` antes de aplicar movimientos.
- **Bug no relacionado, encontrado al reproducir el de transferencias.** La corrección requería
  un ajuste compensatorio en `Sucursal Norte`, creada antes del fix de secuencias del QA de
  Ventas (2026-08-03, más arriba) — seguía sin sus filas `Secuencia`, así que cualquier
  documento ahí (no solo ventas) reventaba con 500. Como no hay endpoint para sembrarlas
  retroactivamente, se agregó autorreparación en
  [sucursales.service.js](backend/src/modules/core/sucursales/sucursales.service.js)
  `actualizar()`: siembra las secuencias faltantes con `createMany` + `skipDuplicates` cada vez
  que se edita una sucursal (no-op para las que ya las tienen). Se usó para reparar Sucursal
  Norte en el momento.

### Cierre del vacío de UI (2026-08-03)

Construidas [AjustesPage.jsx](frontend/src/modules/inventario/pages/AjustesPage.jsx) (registrar
ajuste con cantidad +/- por línea y ver detalle de ajustes recientes),
[TransferenciasPage.jsx](frontend/src/modules/inventario/pages/TransferenciasPage.jsx) (crear
transferencia y recibirla como acción inline sobre las `EN_TRANSITO`) y
[ConteosPage.jsx](frontend/src/modules/inventario/pages/ConteosPage.jsx) (iniciar conteo,
capturar líneas, avanzar CAPTURA→REVISION→AUTORIZADO con vista de sistema/física/diferencia).
Mismo estilo sin librería de UI, mismo patrón de acciones inline expandibles por fila que
devoluciones/cotizaciones en Ventas. Los tres flujos completos se probaron en vivo contra
producción (crear ajuste, crear+recibir transferencia, capturar+revisar+autorizar conteo),
revirtiendo el efecto de stock de las pruebas al terminar.

Sin pendientes abiertos de esta pasada.

## QA de MOD-002 Catálogo (2026-08-03)

Primera pasada de QA sobre artículos/categorías/marcas/unidades/impuestos/listas de precio —
revisión de código + pruebas en vivo contra producción, disparando requests concurrentes con
`curl` para reproducir la condición de carrera antes del fix y reverificando después del
deploy (con limpieza de datos de prueba después: venta cancelada, ajuste compensatorio de
stock, retiro de caja compensatorio y artículos de prueba renombrados/desactivados con la
convención "(ignorar)"). Encontrado y corregido:

- **Condición de carrera al crear/editar un artículo con SKU o código de barras duplicado.**
  `validarUnicidad()` en `articulos.service.js` chequeaba fuera de la transacción, sin atrapar
  después el constraint único de la DB (mismo vacío que el correo duplicado ya corregido en
  Core). Reproducido en vivo: 5 altas concurrentes con el mismo SKU dieron 2 de 5 con `500`
  crudo ("Ocurrió un problema...") en vez del `409` limpio ("Ya existe un artículo con ese
  SKU."). Corregido atrapando el `P2002` de Prisma en
  [articulos.service.js](backend/src/modules/catalogo/articulos/articulos.service.js)
  (`crear` y `actualizar`), mismo patrón que auth/usuarios en Core.
- **El flag `activo` de un artículo no se validaba en ningún lado.** Se podía desactivar un
  artículo (marcarlo descontinuado) y venderlo con total normalidad — mismo tipo de vacío que
  `BLOQUEADO` en Core y `activa` en Caja (nadie leía el flag al usarlo). Verificado en vivo:
  artículo con `activo:false`, `POST /ventas/ventas` devolvía `201` y confirmaba la venta.
  Corregido en [ventas.service.js](backend/src/modules/ventas/ventas/ventas.service.js)
  (`crear`), que ahora rechaza la venta si algún artículo no está activo; cubre también la
  conversión de cotización en venta, que reusa esta misma función.

Encontrado y documentado como vacío funcional grande — **ya implementado el mismo día**, ver
"Listas de precio en Ventas" más abajo:

- ~~Las listas de precio (MOD-002) están completamente desconectadas de Ventas.~~ Resuelto.

- ~~Vacío de UI menor: solo alta, no edición, para artículos/categorías/marcas/unidades/
  impuestos.~~ Resuelto, ver "UI de edición de Catálogo" más abajo.

## Listas de precio en Ventas (2026-08-03)

Implementado el vacío funcional detectado en el QA de Catálogo (arriba): las listas de precio
ahora se usan de verdad al vender, no solo se guardan.

- **Backend:** nuevo `resolverPreciosCatalogo()` en
  [ventas.service.js](backend/src/modules/ventas/ventas/ventas.service.js) — resuelve el precio
  de línea con el `PrecioArticulo` de la lista asignada al cliente (`Cliente.listaPrecioId`) si
  existe uno para ese artículo; si no, cae al precio base. Se usa en `ventas.crear()` y lo reusa
  [cotizaciones.service.js](backend/src/modules/ventas/cotizaciones/cotizaciones.service.js)
  (mismo módulo) para que el total de una cotización coincida con lo que se cobra al
  convertirla. `articulos.service.js#listar` ahora incluye los precios por lista de cada
  artículo, y `actualizarClienteSchema` acepta `listaPrecioId: null` para poder desasignar una
  lista ya asignada.
- **Frontend:** sección "Listas de precio" en
  [ConfiguracionCatalogoPage.jsx](frontend/src/modules/catalogo/pages/ConfiguracionCatalogoPage.jsx)
  (crear lista); fila expandible "Precios" en
  [ArticulosPage.jsx](frontend/src/modules/catalogo/pages/ArticulosPage.jsx) para definir el
  precio de un artículo por lista; selector de lista por cliente (alta y edición inline) en
  [ClientesPage.jsx](frontend/src/modules/clientes/pages/ClientesPage.jsx); el precio mostrado
  y usado al agregar una línea en
  [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx) y
  [CotizacionesPage.jsx](frontend/src/modules/ventas/pages/CotizacionesPage.jsx) ahora refleja
  la lista del cliente seleccionado.
- Verificado en vivo contra producción de punta a punta: artículo con precio base $100 y precio
  $80 en una lista "Mayoreo" de prueba, cliente asignado a esa lista → venta cobra $80; Cliente
  General (sin lista) → sigue cobrando $100 (sin regresión). Datos de prueba limpiados después
  (ventas canceladas, stock y caja compensados, artículo/cliente de prueba desactivados).

## UI de edición de Catálogo (2026-08-03)

Cierra el último vacío del QA de Catálogo: el frontend solo tenía alta para
artículos/categorías/marcas/unidades/impuestos, nunca edición.

- **Artículos:** botón "Editar" con formulario expandible (mismo patrón que "Precios") en
  [ArticulosPage.jsx](frontend/src/modules/catalogo/pages/ArticulosPage.jsx), con todos los
  campos del alta más código de barras (que tampoco existía en el alta, agregado ahí también) y
  un checkbox de activo para descontinuar/reactivar desde la UI.
- **Categorías/Marcas/Unidades/Impuestos:** edición inline por fila en
  [ConfiguracionCatalogoPage.jsx](frontend/src/modules/catalogo/pages/ConfiguracionCatalogoPage.jsx) —
  `SeccionSimple` ahora soporta un prop `actualizar` opcional, reusado por Marcas/Unidades/
  Impuestos; Categorías mantiene su propio componente por la regla de padre a 2 niveles.
- **Backend:** `actualizarArticuloSchema` ahora acepta `null` en sku/codigoBarras/categoriaId/
  marcaId/impuestoId para poder desasignar un valor ya asignado (a diferencia de crear, donde
  omitir el campo alcanza) — mismo patrón ya usado para `Cliente.listaPrecioId` y
  `Categoria.categoriaPadreId`.
- Verificado en vivo contra producción, incluida la UI real en el navegador: editar el nombre de
  una marca de prueba y reactivar un artículo de prueba marcado como descontinuado, ambos
  confirmados por API antes y después del cambio.

## QA de MOD-005 Compras (2026-08-03)

Primera pasada de QA sobre compras/cancelación — revisión de código + pruebas en vivo contra
producción, disparando requests concurrentes con `curl` para reproducir la condición de carrera
antes del fix y reverificando después del deploy (con limpieza/corrección de datos de prueba
después, incluyendo un ajuste compensatorio de stock). Encontrado y corregido:

- **Crítico — condición de carrera al cancelar una compra.** `cancelar()` chequeaba
  `compra.estado !== 'CONFIRMADA'` fuera de la transacción, sin reclamar el estado atómicamente
  (mismo patrón exacto que en Ventas/Caja/Inventario). Reproducido en vivo: 6 cancelaciones
  concurrentes sobre la misma compra de 1 unidad, 5 de 6 con `200` y la reversión de stock
  aplicada 5 veces en vez de una (stock: 83 → 78 en vez de 83 → 82). Corregido en
  [compras.service.js](backend/src/modules/compras/compras.service.js) reclamando la compra con
  un `UPDATE...WHERE estado='CONFIRMADA'` antes de aplicar los movimientos, mismo patrón que
  `transferencias.recibir` en Inventario. Reverificado: de 6 concurrentes, solo 1 tiene éxito.
- **El flag `activo` de un proveedor no se validaba en ningún lado.** Se podía desactivar un
  proveedor y seguir registrándole compras con total normalidad — mismo tipo de vacío que
  `BLOQUEADO` en Core, `activa` en Caja y `articulo.activo` en Catálogo. Verificado en vivo:
  proveedor con `activo:false`, `POST /compras` devolvía `201`. Corregido en
  [compras.service.js](backend/src/modules/compras/compras.service.js) (`crear`), que ahora
  rechaza la compra si el proveedor está inactivo.

De paso, se cerró el vacío de UI que dejó esto en evidencia: el frontend de Compras solo tenía
alta, nunca cancelación, pese a que el backend ya soportaba `PATCH /:id/cancelar`. Agregada acción
"Cancelar" inline por fila en [ComprasPage.jsx](frontend/src/modules/compras/pages/ComprasPage.jsx)
(mismo patrón que VentasPage) y el selector de proveedor ahora excluye los inactivos.

Sin pendientes abiertos de esta pasada.

## QA de MOD-003 Clientes/Proveedores (2026-08-03)

Primera pasada de QA sobre clientes/proveedores — revisión de código + pruebas en vivo contra
producción. A diferencia de los módulos anteriores, Clientes/Proveedores es CRUD simple sin
máquina de estados (crear/cancelar), así que no tiene el patrón de condición de carrera visto en
Ventas/Caja/Inventario/Compras. Encontrado y corregido:

- **El flag `activo` de un cliente no se validaba en ningún lado.** Se podía desactivar un
  cliente y seguir vendiéndole con total normalidad — mismo tipo de vacío que `BLOQUEADO` en
  Core, `activa` en Caja, `articulo.activo` en Catálogo y `proveedor.activo` en Compras.
  Verificado en vivo: cliente con `activo:false`, `POST /ventas/ventas` devolvía `201`.
  Corregido en [ventas.service.js](backend/src/modules/ventas/ventas/ventas.service.js)
  (`crear`), que ahora rechaza la venta si el cliente está inactivo; cubre también la conversión
  de cotización en venta, que reusa esta misma función.

Investigado pero no corregido (severidad muy baja): `asegurarClienteGeneral()` en
[clientes.service.js](backend/src/modules/clientes/clientes.service.js) crea el "Cliente
General" de forma perezosa la primera vez que alguien lista clientes, con un check-then-act no
atómico (mismo tipo de patrón que las demás condiciones de carrera de este QA). En teoría dos
`listar()` concurrentes en una empresa recién registrada podrían crear dos "Cliente General".
Se intentó reproducir en vivo con una empresa nueva y 8 requests concurrentes sin éxito — la
ventana es demasiado angosta en la práctica, el impacto es solo cosmético (un nombre duplicado
en el selector) y la ventana de riesgo real dura solo hasta el primer `listar()` exitoso de la
vida de la empresa. Queda documentado por si se decide reforzar más adelante.

Cerrados dos vacíos de UI encontrados al verificar los fixes en el navegador:
- **Proveedores no tenía ninguna edición en el frontend**, ni siquiera para reactivar/desactivar,
  pese a que el backend ya soportaba `PATCH /proveedores/:id`. Agregada edición inline por fila
  en [ProveedoresPage.jsx](frontend/src/modules/proveedores/pages/ProveedoresPage.jsx) (mismo
  patrón que ArticulosPage).
- **Clientes solo permitía cambiar la lista de precio**, no el resto de los campos ni `activo`.
  Agregada edición inline completa en
  [ClientesPage.jsx](frontend/src/modules/clientes/pages/ClientesPage.jsx), protegiendo al
  Cliente General de ser desactivado desde la UI (el checkbox de activo no se muestra para él,
  igual que ya lo protege el backend). Los selectores de cliente en
  [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx) y
  [CotizacionesPage.jsx](frontend/src/modules/ventas/pages/CotizacionesPage.jsx) ahora excluyen
  clientes inactivos, mismo criterio que el selector de proveedor en ComprasPage.

Todo verificado en vivo contra producción, incluidos clics reales en el navegador (edición de
Proveedores y Clientes, protección del Cliente General).

## QA de MOD-009 Reportes (2026-08-03)

Primera pasada de QA sobre reportes de ventas/artículos/inventario/compras/caja — este módulo es
de solo lectura (no tiene alta/confirmar/cancelar), así que no aplica el patrón de condición de
carrera de los módulos anteriores; el foco fue corrección de cálculos y alcance multi-tenant.
Encontrado y corregido:

- **El reporte de ventas no descontaba las devoluciones.** Una devolución no cambia
  `venta.estado` (queda `CONFIRMADA`) ni los totales guardados en la venta — `reporteVentas`
  sumaba el total original de cada venta confirmada sin restar lo ya reembolsado en
  devoluciones posteriores, sobreestimando el ingreso neto. Verificado en vivo: el reporte
  mostraba `total: 265.64` con `38.20` ya reembolsados en devoluciones sobre esas mismas ventas
  (neto real: `227.44`). Mismo hueco en `reporteArticulosMasVendidos`, que sumaba
  `VentaDetalle.cantidad` sin restar `cantidadDevuelta` — un artículo devuelto por completo
  seguía apareciendo como "vendido". Corregido en
  [reportes.service.js](backend/src/modules/reportes/reportes.service.js): `reporteVentas` ahora
  expone `totalDevoluciones` y `totalNeto` (conserva `total` como cifra bruta), y
  `reporteArticulosMasVendidos` usa cantidad neta (`cantidad - cantidadDevuelta`) por línea.
  [ReportesPage.jsx](frontend/src/modules/reportes/pages/ReportesPage.jsx) ahora muestra
  Devoluciones/Neto. Verificado en vivo contra producción, incluida la UI real en el navegador.

Sin pendientes abiertos de esta pasada.

## QA de MOD-010 Herramientas (2026-08-03)

Primera pasada de QA sobre importar/exportar CSV — cierra el ciclo de QA de los 10 módulos
originales. Sin máquina de estados (create-only, fila por fila), así que el foco fue manejo de
errores y validación de datos de entrada en vez de condiciones de carrera. Encontrado y
corregido en [herramientas.service.js](backend/src/modules/herramientas/herramientas.service.js):

- **Errores técnicos crudos de Prisma filtrados directo al usuario**, en dos casos distintos:
  - Condición de carrera de baja frecuencia: la verificación de SKU/código de barras duplicado
    usa un `Set` en memoria cargado una sola vez al inicio de la importación, sin atrapar el
    constraint único de la DB después — mismo hueco que el SKU duplicado ya corregido en
    `articulos.service.js#crear`, pero sin heredarlo porque esta ruta usa su propio
    `tx.articulo.create` inline. Verificado en vivo: 5 importaciones concurrentes del mismo CSV
    con un SKU nuevo, 4 de 5 mostraban `"Invalid \`prisma.articulo.create()\` invocation..."` en
    vez de un mensaje de negocio.
  - Una columna numérica inválida (ej. `costo` con texto) dejaba pasar `NaN` hasta Prisma, que lo
    rechazaba con un volcado técnico multilínea del validador completo. Verificado en vivo.
  
  Ambos corregidos: el primero traduciendo el `P2002` al mismo mensaje 409 que usa Catálogo; el
  segundo validando `costo`/`precio`/`stockMinimo`/`stockMaximo` antes de tocar la DB.
- **`exportarArticulos` incluye la columna `activo` en el CSV, pero `importarArticulos` nunca la
  leía** — todo artículo importado quedaba `activo:true` sin importar lo que dijera el CSV.
  Verificado en vivo: fila con `activo=false`, el artículo creado quedó `activo:true`. Corregido
  leyendo la columna (`"false"`/`"0"` = inactivo).

Investigado y descartado (no es un bug): un CSV con BOM de UTF-8 al inicio (típico al guardar
desde Excel) se maneja bien porque `String.trim()` de JS quita el carácter BOM del encabezado de
la primera columna.

Sin pendientes abiertos de esta pasada. Con esto, los 10 módulos del plan original ya tuvieron su
primera ronda de QA.

## Bug de precisión Decimal en Caja + gotcha de Prisma para todo el proyecto (2026-08-03)

Encontrado haciendo un recorrido del flujo completo de venta como usuario (abrir caja → vender →
cerrar caja), fuera de una pasada de QA formal — el mensaje de cierre de sesión mostraba
`"Esperado: 843.4400000000002"` en vez de un monto limpio.

**Primer intento de fix (insuficiente):** `sesiones.service.js#cerrar` sumaba los movimientos con
punto flotante de JS sin pasar por `redondear()` — se corrigió envolviendo `saldoEsperado` y
`diferencia` en `redondear()`, como ya hace el resto del proyecto. El fix no se reflejaba en
producción ni después de varios redeploys, un clear-cache-and-deploy y un restart manual del
servicio, lo que parecía (engañosamente) un problema de infraestructura de Render.

**Causa raíz real, encontrada con un marcador de debug temporal:** el problema no era el deploy.
`redondear()` sí dejaba la variable de JS limpia (`9.7`), pero pasar ese `number` de JS
directamente a un campo `Decimal` de Prisma podía reintroducir el mismo artefacto de punto
flotante *en la conversión interna a Decimal* — el valor que Prisma efectivamente persistía y
devolvía era `"9.699999999999999"`, no `"9.7"`, pese a que la variable de origen ya estaba
redondeada. Verificado end-to-end con un debug marker temporal que comparó
`localDiferencia` (9.7, `number`) contra `actualizada.diferencia` (objeto Decimal cuyo
`.toString()` daba `"9.699999999999999"`) en la misma respuesta.

**Fix real:** pasar el valor como *string* (`valor.toFixed(2)`) en vez de `number` al campo
Decimal — `decimal.js` (la librería detrás de `Prisma.Decimal`) parsea un string de forma exacta,
sin pasar por la representación binaria de un `number` de JS. Corregido en
[sesiones.service.js](backend/src/modules/caja/sesiones/sesiones.service.js) para
`saldoEsperado`/`saldoReal`/`diferencia`. Verificado en vivo, repetido más de 10 veces sin
recurrencia.

**Nota para el futuro:** este mismo patrón (`redondear()` en JS pero pasando el resultado como
`number` crudo a un campo Decimal, en vez de `.toFixed(2)` como string) se usa en varios otros
puntos del proyecto (ventas/compras/devoluciones/cotizaciones `total`/`subtotal`/`reembolso`,
etc.) y no mostró el mismo síntoma con los valores probados hasta ahora — pero el riesgo es
inherente al valor específico convertido (algunos floats sobreviven la conversión a Decimal
limpios, otros no), no al campo. Si en el futuro aparece un monto con decimales "sucios" en
cualquier reporte o pantalla, este es el patrón a revisar primero.

## Rediseño visual (2026-08-04)

Con los 10 módulos completos y su primera ronda de QA cerrada, se hizo un rediseño visual
completo del frontend a pedido del usuario, siguiendo una guía de diseño provista por él
(minimalista, inspirada en Linear/Notion/Stripe/Vercel — mucho blanco, colores solo
funcionales, bordes redondeados, sombras sutiles) más una imagen de referencia de un dashboard.
Sin cambios de lógica de negocio en ningún módulo: mismos estados, handlers y llamadas a la
API en todas las pantallas, solo cambió el markup/estilos.

- **Stack:** se sumó Tailwind CSS (antes el frontend no tenía ningún framework de estilos,
  todo era CSS inline) + tipografía Inter (Google Fonts) + [lucide-react](https://lucide.dev)
  para íconos. Tokens de diseño (paleta azul/verde/amarillo/rojo funcionales, navy para el
  sidebar, radios, sombras) en
  [tailwind.config.js](frontend/tailwind.config.js).
- **Design system reutilizable** en `frontend/src/shared/ui/`: `Button`, `Input`, `Select`,
  `Card`, `StatCard`, `Badge`, `Table`, `Modal`, `TrendChart` (gráfico de línea propio en SVG,
  sin librería de charts). Un solo estilo por tipo de componente, reusado en las 22 pantallas.
- **Layout fijo** en `frontend/src/shared/layout/`: `Sidebar` (navy, con los 11 módulos
  agrupados — Ventas/Inventario/Catálogo/Configuración son expandibles porque cada uno cuelga
  de varias pantallas) + `TopBar` (búsqueda, usuario, logout). Se engancha automáticamente en
  [ProtectedRoute.jsx](frontend/src/shared/components/ProtectedRoute.jsx), así que toda
  pantalla autenticada lo hereda sin tocarla una por una.
- **Dashboard reconstruido** ([DashboardPage.jsx](frontend/src/modules/dashboard/pages/DashboardPage.jsx))
  con datos 100% reales del backend existente (ventas del día, caja actual vía sesiones
  abiertas, artículos en stock, clientes activos, tendencia de 7 días, productos más vendidos,
  movimientos recientes fusionando ventas/compras/ajustes/clientes nuevos, alertas de stock
  bajo y estado de caja, resumen de cobros por método de pago) — sin inventar datos que el
  backend no expone: por ejemplo "compras pendientes" no existe como concepto (las compras se
  confirman al crearse, no hay flujo de recepción pendiente), así que ese card de la imagen de
  referencia se reemplazó por algo real.
- **Login/Registro** reconstruidos como card centrado con logo. **Los otros 8 módulos**
  (Ventas, Cotizaciones, Caja, Compras, Inventario ×4, Catálogo ×2, Clientes, Proveedores,
  Reportes, Herramientas, Sucursales, Usuarios, Roles, Auditoría) se re-skinaron 1:1 sobre el
  código existente. Los paneles que antes eran filas de tabla expandibles (editar, ver
  detalle, devolver una venta, convertir cotización, precios por lista, permisos de rol) ahora
  son `Modal`.
- **Verificación:** cada lote se probó primero en local (`npm run dev` del frontend, sin
  necesidad de backend para detectar errores de compilación/consola — todas las páginas se
  importan de forma eager en `App.jsx`, así que un error de sintaxis en cualquiera rompe hasta
  el login) y después en producción con clics reales vía el usuario de prueba, incluyendo el
  modal de devolución de Ventas.
- Se pusheó a `main` en 8 commits incrementales (fundación+Dashboard, Login/Registro,
  Ventas/Cotizaciones, Caja/Compras/Inventario, Catálogo, Clientes/Proveedores,
  Reportes/Herramientas, Configuración/Administración) — cada uno redesplegado y verificado en
  Render antes de seguir con el siguiente.

Pendiente si se quiere profundizar: diseño responsivo real en mobile (solo se probó el
colapso del sidebar), una tabla con búsqueda/orden/paginación server-side propia del design
system (hoy las tablas son simples, la búsqueda ya existente en Artículos/Clientes/Proveedores
se dejó igual), y loading states (spinners) más pulidos.

## Pulido post-rediseño (2026-08-04)

Los tres pendientes de la sección anterior se cerraron en la misma sesión:

- **Ventas como POS real**: [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx)
  se reescribió para capturar sin clics de más — clic en la tarjeta de un producto (o Enter
  en el buscador con match exacto de SKU/código de barras) lo agrega directo al carrito, sin
  botón "Agregar"; carrito con steppers +/-; cobrar en un clic (Tarjeta/Transferencia), con
  Efectivo abriendo un modal para ingresar el monto recibido y calcular el cambio antes de
  confirmar; atajos F1/F2/F3/Esc. "Ventas recientes" (cancelar/devolver) se separó a su propia
  pantalla, [VentasHistorialPage.jsx](frontend/src/modules/ventas/pages/VentasHistorialPage.jsx)
  en `/ventas/recientes`, para que la captura quede enfocada solo en vender.
- **Responsive mobile real**: auditoría de las 22 pantallas a 375px; el único bug real eran
  los headers de página con botón de acción (Ventas, Ventas recientes, Cotizaciones) que no
  apilaban y partían el texto en varias líneas — corregido.
- **Búsqueda/orden/paginación server-side**: implementado con alcance acotado a las listas
  grandes — Ventas recientes, Compras, Artículos, Clientes, Proveedores, Auditoría (el resto
  de las tablas queda simple, a pedido del usuario). Helper compartido
  [backend/src/shared/paginacion.js](backend/src/shared/paginacion.js) + componente
  [Paginacion.jsx](frontend/src/shared/ui/Paginacion.jsx) y `Table` extendido con headers
  ordenables de forma retrocompatible. Artículos/Clientes/Proveedores quedaron "dual-mode"
  (sin `pagina` en el query devuelven el array completo de siempre, porque otras pantallas
  —el POS de Ventas, Cotizaciones, Compras, Ajustes, Conteos, Transferencias— dependen de esa
  lista completa para sus selects/grillas) — **grepear quién más consume un endpoint antes de
  cambiarle el shape de la respuesta**.

Detalle completo (incluidos los gotchas de diseño de cada uno) en la memoria del proyecto, no
se duplica acá.

## Documentos: ticket de venta, PDF de cotización y logo de empresa (2026-08-04)

Fuera del plan original — funcionalidad nueva pedida por el usuario tras cerrar el pulido
post-rediseño. Todo verificado en vivo contra producción.

- **Impresión de ticket de venta.** Componente
  [TicketVenta.jsx](frontend/src/modules/ventas/components/TicketVenta.jsx): recibo angosto
  estilo térmico (80mm) con datos de empresa/sucursal, folio, fecha, cliente, líneas,
  subtotal/impuestos/total, pago(s) y cambio (cuando se conoce). CSS `@media print` en
  [index.css](frontend/src/index.css) aísla el ticket del resto de la app al imprimir (oculta
  todo salvo `#ticket-imprimible`) y el botón dispara `window.print()`. Se usa en
  [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx) (botón "Imprimir ticket"
  al confirmar una venta nueva, con el cambio en efectivo porque ese dato no se persiste en el
  backend) y en
  [VentasHistorialPage.jsx](frontend/src/modules/ventas/pages/VentasHistorialPage.jsx) (acción
  "Imprimir" por fila, para reimprimir cualquier venta ya registrada — incluidas las
  canceladas, que muestran "** VENTA CANCELADA **").
- **PDF de cotización para el cliente.** Nuevo
  [cotizacionPdf.js](frontend/src/modules/ventas/pdf/cotizacionPdf.js) con jsPDF +
  jspdf-autotable (dependencias nuevas del frontend). `Cotizacion.total` en el backend es el
  subtotal *sin* impuesto (se calcula recién al convertir, con la tasa vigente en ese momento
  — igual que en el resto del módulo); el PDF recalcula subtotal/impuestos/total por línea con
  el mismo criterio para no mostrarle al cliente un monto que no es el que realmente pagaría.
  jsPDF pesa bastante (~250kB gzip) así que se carga con `import()` dinámico solo cuando se
  pide un PDF, en vez de ir en el bundle inicial de toda la app (confirmado con el build: queda
  en su propio chunk). Botón "Descargar PDF" al confirmar una cotización nueva y acción "PDF"
  por fila en "Cotizaciones recientes"
  ([CotizacionesPage.jsx](frontend/src/modules/ventas/pages/CotizacionesPage.jsx)). Requirió
  que `cotizaciones.service.js#obtener` resolviera `cliente` y `sucursal` con consultas
  manuales (el modelo `Cotizacion` no declara esas relaciones en Prisma, a diferencia de
  `Venta`, que sí).
- **Nombre y logo de la empresa editables.** No existía ninguna forma de cambiar
  `Empresa.nombreComercial`/`logoUrl` desde que se registra la empresa. Nuevo módulo backend
  [core/empresa](backend/src/modules/core/empresa) (`PATCH /api/core/empresa`), protegido con
  el permiso `administracion.empresa.editar` (ya estaba en el catálogo de permisos sin usar).
  Sin almacenamiento de archivos en el backend — mismo criterio que `Articulo.imagenUrl`, que
  tampoco lo tiene: el logo se redimensiona (máx. 320px de lado) y comprime en un `<canvas>`
  del propio navegador y viaja como data URI dentro del JSON; se subió el límite de body de
  express a 3mb en [app.js](backend/src/app.js) para que quepa. Nueva pantalla
  [EmpresaPage.jsx](frontend/src/modules/core/pages/EmpresaPage.jsx) en
  `/administracion/empresa` (dentro de "Configuración" en el sidebar).
  `AuthContext.actualizarEmpresa()` refresca nombre/logo en toda la app sin recargar; el logo,
  cuando está cargado, reemplaza el ícono genérico en el pie del sidebar y ese bloque enlaza
  directo a la pantalla de edición.
- **Logo en el PDF de cotización (a pedido explícito — en el ticket de venta no).** Si
  `empresa.logoUrl` está definido, `generarPdfCotizacion` lo dibuja en el encabezado
  respetando su proporción real (`doc.getImageProperties`, sin deformarlo) y corre el
  nombre/datos de la empresa a la derecha del logo; un logo corrupto o en un formato que jsPDF
  no pueda leer no rompe la generación del PDF (se ignora silenciosamente). Verificado con un
  logo de prueba no cuadrado (200×80) — el PDF resultante embebe un objeto `/Image` con
  Width=200/Height=80, confirmando que no se deformó.

## Buscador global de la barra superior (2026-08-04)

El input de búsqueda del `TopBar` era puramente decorativo desde el rediseño visual —
sin `value`/`onChange`, nunca conectado a nada. Implementado como funcionalidad nueva a
pedido del usuario:

- **Backend:** nuevo módulo [`busqueda`](backend/src/modules/busqueda) (`GET
  /api/busqueda?q=...`), sin permiso único propio — cada categoría (Artículos, Clientes,
  Proveedores, Ventas) se consulta solo si el usuario tiene el permiso de "ver" de ese
  módulo (mismo catálogo de permisos que ya exige cada ruta propia), así que el resultado
  respeta los mismos límites de visibilidad que el resto de la app. Umbral mínimo de 2
  caracteres, máximo 5 resultados por categoría. Busca por nombre/SKU/código de barras
  (artículos), nombre/correo/teléfono (clientes y proveedores) y folio/nombre de cliente
  (ventas).
- **Frontend:** [`TopBar.jsx`](frontend/src/shared/layout/TopBar.jsx) ahora tiene estado
  real: debounce de 300ms, dropdown agrupado por categoría, cierre con click afuera o
  Escape. Como la app no tiene páginas de detalle por registro (todo es lista + panel
  inline/modal), un clic en un resultado navega a la pantalla de esa categoría pasando el
  término por `location.state.buscar`; las 4 páginas destino
  ([ArticulosPage](frontend/src/modules/catalogo/pages/ArticulosPage.jsx),
  [ClientesPage](frontend/src/modules/clientes/pages/ClientesPage.jsx),
  [ProveedoresPage](frontend/src/modules/proveedores/pages/ProveedoresPage.jsx),
  [VentasHistorialPage](frontend/src/modules/ventas/pages/VentasHistorialPage.jsx)) ya
  tenían su propio buscador local con paginación server-side (ver "Pulido post-rediseño"
  arriba) — solo se les agregó leer ese estado inicial para prefiltrar en vez de duplicar
  lógica de búsqueda.
- Verificado en vivo contra producción con clics reales: búsqueda "general" → Cliente
  General + 5 ventas con ese cliente, clic navega a Clientes filtrado a 1 resultado;
  búsqueda "coca" → artículo por SKU, clic navega a Artículos filtrado a 1 resultado;
  término sin match → "Sin resultados"; Escape cierra el dropdown. No se creó ningún dato
  de prueba (funcionalidad de solo lectura), nada que limpiar.
- **Gotcha de esta sesión:** el backend local no pudo levantar contra Supabase (mismo
  problema de siempre, sin salida IPv6 para la conexión directa) — se verificó pusheando a
  `main` y probando contra `https://ventix-frontend.onrender.com` ya desplegado, patrón ya
  establecido en sesiones anteriores.

## Paginación server-side extendida (2026-08-04, sesión posterior)

A pedido del usuario, se extendió el patrón de búsqueda+orden+paginación server-side (ver
"Búsqueda/orden/paginación server-side" en "Pulido post-rediseño" arriba) a 6 pantallas más:
**Usuarios, Existencias, Cotizaciones, Conteos físicos, Transferencias y Ajustes**.

Antes de implementar se relevaron las 12 pantallas con tabla que quedaban sin migrar y se
acordó el alcance con el usuario. Quedaron **sin cambios** (a propósito): Sucursales y Roles
(catálogos chicos y acotados, reusados como dropdown en varias pantallas — paginar agregaría
complejidad para listas que casi nunca superan una página), Caja (la única tabla que muestra
son los movimientos de la sesión abierta actual, no una lista navegable),
[ConfiguracionCatalogoPage](frontend/src/modules/catalogo/pages/ConfiguracionCatalogoPage.jsx)
(ni siquiera usa `<Table>`, son catálogos chicos) y Herramientas/Reportes (Herramientas no
tiene una lista persistida — solo el resultado de la última importación — y Reportes son
tablas de resultados agregados, no colecciones CRUD).

- **Usuarios y Existencias quedaron en modo dual** (mismo criterio que Artículos/Clientes/
  Proveedores: sin `pagina` en el query devuelven el array completo de siempre) porque otras
  pantallas dependen de esa lista sin paginar: `listarUsuarios` lo usan también
  VentasHistorialPage/AuditoriaPage/AjustesPage (filtros/dropdowns) y `listarExistencias` lo
  usan VentasPage (lookup de stock del POS) y `useDashboardData.js`. Usuarios además vive en
  una join table (`UsuarioEmpresa`), no en `Usuario` directo, así que ordenar/buscar es sobre
  campos anidados (`usuario.nombre`, `rol.nombre`).
- **Existencias era la única de las seis sin ningún `take`** — antes totalmente sin límite,
  la colección que más crece de las seis (sucursales × artículos). De paso se expusieron en
  la UI los filtros de sucursal y "solo con stock" que el backend ya soportaba
  (`filtros.sucursalId`/`filtros.soloConStock`) pero ninguna pantalla usaba.
- **Cotizaciones, Conteos, Transferencias y Ajustes no necesitan modo dual** salvo Ajustes
  (consumido también por `useDashboardData.js` para el feed de movimientos recientes) —
  reemplazan el `take: 200` fijo de siempre por paginación real. Conteos físicos no tiene
  ningún campo de texto libre (a diferencia de los otros tres, que sí tienen `folio`), así
  que en vez de un buscador de texto tiene un filtro exacto por sucursal.
- Verificado en vivo contra producción con clics reales en las 6 pantallas: búsqueda,
  filtros, orden por columna y paginación en cada una, más los consumidores dual-mode
  (dropdown de artículos en Ajustes/Transferencias/Cotizaciones que sigue usando la lista sin
  paginar de Existencias no aplica ahí, pero sí el selector "Autoriza" de Ajustes con la lista
  completa de Usuarios). No se generaron datos de prueba (solo lectura/filtrado), nada que
  limpiar.
- **Mismo gotcha de siempre:** backend local no pudo levantar contra Supabase (sin salida
  IPv6), se verificó pusheando a `main` y probando contra
  `https://ventix-frontend.onrender.com` ya desplegado.

## PDF de compra (2026-08-04, sesión posterior)

A pedido del usuario, mismo tratamiento que la cotización: nuevo
[compraPdf.js](frontend/src/modules/compras/pdf/compraPdf.js) (`generarPdfCompra`), cargado
con `import()` dinámico solo al pedirlo para no engordar el bundle inicial. Diferencia clave
con la cotización: `CompraDetalle.costo` no lleva un impuesto separado (a diferencia de
`VentaDetalle`/`CotizacionDetalle`), así que el PDF no recalcula subtotal/impuestos — solo
suma cantidad × costo por línea. Mostraba proveedor en vez de cliente, y marca
"** COMPRA CANCELADA **" en rojo si `compra.estado === 'CANCELADA'` (las compras canceladas
siguen listadas y siguen pudiendo generar su PDF, a diferencia de Cotizaciones que no tiene
estado cancelado). Requirió que `compras.service.js#obtener` incluyera `proveedor`/`sucursal`
en el `include` (a diferencia de `Cotizacion`, `Compra` sí declara esas relaciones de Prisma
directamente, así que no hizo falta resolución manual). Botón "PDF" nuevo por fila en
"Compras recientes" ([ComprasPage.jsx](frontend/src/modules/compras/pages/ComprasPage.jsx)),
junto al de "Cancelar" ya existente.

Verificado en producción interceptando `URL.createObjectURL` para leer los bytes crudos del
PDF generado (mismo truco que Cotizaciones/Empresa): una compra `CONFIRMADA` (folio,
proveedor y total correctos, sin marca de cancelada) y una `CANCELADA` (mismos datos más
"COMPRA CANCELADA" presente). Sin datos de prueba generados — solo lectura.

## Exportar Existencias a CSV/Excel (2026-08-04, sesión posterior)

A pedido del usuario ("la consulta de existencia debe permitir exportar el reporte en
excel"), nuevo `GET /inventario/existencias/exportar` en
[existencias.controller.js](backend/src/modules/inventario/existencias/existencias.controller.js),
mismo permiso que ver la lista (`inventario.ver`, no un permiso aparte de Herramientas) y
mismo helper CSV que ya usaba Herramientas para Artículos/Clientes/Proveedores
([shared/csv.js](backend/src/shared/csv.js) — CSV plano, sin dependencias, abre directo en
Excel/Sheets). El armado del `where` de Prisma se factorizó a `construirWhere()` en
[existencias.service.js](backend/src/modules/inventario/existencias/existencias.service.js),
compartido entre `listar()` y el nuevo `exportarCsv()`, para que el CSV exportado sea siempre
exactamente el reporte que se está viendo en pantalla (misma búsqueda/sucursal/solo-con-
stock) y no un volcado completo aparte. Botón "Exportar CSV" nuevo junto al título de la
tabla en [ExistenciasPage.jsx](frontend/src/modules/inventario/pages/ExistenciasPage.jsx).

Verificado en producción interceptando `URL.createObjectURL` (mismo truco de siempre): con
el buscador filtrado a "coca", el CSV descargado trae exactamente las 3 filas esperadas
(Coca Cola 600ml en las 3 sucursales) con el encabezado correcto. Sin datos de prueba
generados — solo lectura.

## Stock mínimo/máximo opcional en Artículos (2026-08-04, sesión posterior)

A pedido del usuario ("la edición de artículos nos debe dejar colocar stock mínimo o máximo
como opcional"): el backend ya soportaba `stockMinimo`/`stockMaximo` como opcionales desde
Fase 2 (los usaba la importación CSV de Herramientas), pero ningún formulario del frontend
los mostraba nunca — ni alta ni edición. Agregados ambos campos a "Nuevo artículo" y "Editar
artículo" en [ArticulosPage.jsx](frontend/src/modules/catalogo/pages/ArticulosPage.jsx),
sin `required`. En edición, dejar el campo vacío ahora manda `null` explícito para borrar el
límite que hubiera — mismo patrón ya usado para sku/codigoBarras/categoriaId/marcaId/
impuestoId — así que `actualizarArticuloSchema` se extendió con `.nullable()` para
`stockMinimo`/`stockMaximo` en
[articulos.validators.js](backend/src/modules/catalogo/articulos/articulos.validators.js).

Verificado en producción con clics reales sobre un artículo real (Coca Cola 600ml, no uno de
prueba): asignar 5/50, reabrir el modal y confirmar que persistieron; volver a vaciar ambos
campos y confirmar que el modal los muestra vacíos de nuevo (límite borrado, artículo
devuelto a su estado original sin límites). El click por `ref` del Browser pane volvió a
fallar en silencio en esta pantalla (mismo gotcha ya documentado para Clientes/Reportes) —
se usó `javascript_tool` para disparar los clics reales sobre los elementos del DOM.

## Menú lateral contraíble en escritorio (2026-08-04, sesión posterior)

A pedido del usuario ("el menú debe poder contraerse y colapsar"), nuevo botón de flecha
junto al logo en [Sidebar.jsx](frontend/src/shared/layout/Sidebar.jsx) (visible solo en
`lg:` — escritorio) que alterna el sidebar completo (`w-64`) a una barra angosta solo con
íconos (`w-20`), con la preferencia guardada en `localStorage` (`ventix_sidebar_colapsado`)
para persistir entre sesiones.

- Con el menú contraído, los grupos con submenú (Ventas, Inventario, Catálogo,
  Configuración) se comportan como link directo a su página principal en vez de desplegar
  el submenú indentado, que no entra en el ancho disponible — mismo criterio que un item
  sin hijos. Las etiquetas de texto se ocultan (solo ícono) con `title` nativo del navegador
  como tooltip.
- **El overlay de mobile ignora esta preferencia a propósito**
  (`mostrarColapsado = colapsado && !abierto`): abrir el menú en un celular siempre muestra
  el menú completo con submenús desplegables, sin importar lo que se dejó colapsado la
  última vez que se usó en escritorio — la preferencia de "rail angosto" no tendría sentido
  en un overlay que ya se abre y cierra por completo.
- **Gotcha de esta sesión, importante para verificaciones futuras:** al medir el ancho del
  `<aside>` con `getBoundingClientRect()`/`getComputedStyle()` justo después de togglear (vía
  `javascript_tool`, sin poder ver la pestaña), el valor devuelto a veces quedaba "pegado" en
  el ancho anterior en vez del nuevo — no es un bug de la app: la transición CSS de `width`
  (150ms) no completa su animación en una pestaña que el Browser pane de este entorno no está
  compositando activamente (mismo gotcha ya documentado de `screenshot failed: the Browser
  pane is not displayed`). Se confirmó forzando `aside.style.transition = 'none'` + un reflow
  (`void aside.offsetWidth`) antes de medir, lo que sí devolvió el ancho final correcto de
  inmediato. Si una verificación futura de un cambio con transición CSS da un valor que
  "no cuadra", probar este truco antes de asumir que el cambio está roto.
- Verificado en producción: alternar colapsado/expandido en escritorio (ancho, visibilidad
  del wordmark y del texto de los items, preferencia persistida en localStorage), y el
  overlay de mobile mostrando el menú completo con el submenú de Ventas desplegándose
  normalmente pese a tener la preferencia de escritorio en "colapsado".

## Exportar Reportes a CSV/Excel (2026-08-04, sesión posterior)

A pedido del usuario ("los reportes específicamente en el módulo de Reportes deben poder
exportarse en excel"): a diferencia del export de Existencias (que necesitó un endpoint
nuevo), acá los datos de cada reporte ya están completos en memoria una vez generado
(`resultado` en [ReportesPage.jsx](frontend/src/modules/reportes/pages/ReportesPage.jsx)),
así que el export es 100% client-side — nuevo
[frontend/src/shared/csv.js](frontend/src/shared/csv.js) (`exportarCsv`, mismo criterio de
escapado que el helper del backend, más un BOM UTF-8 para que los acentos se vean bien al
abrir directo en Excel). Botón "Exportar CSV" agregado vía el prop `action` de `Card` en cada
tarjeta de reporte: Ventas por método de pago, Artículos más vendidos, Inventario valorizado,
Stock bajo, Compras por proveedor, Cortes de caja — son 6 botones en total porque "Inventario
valorizado" tiene dos tablas independientes (valorización + stock bajo), cada una con su
propio export. Cada botón exporta exactamente las filas de la tabla que tiene debajo (no las
cifras resumen de arriba, como subtotal/impuestos/ticket promedio en Ventas), con valores
numéricos crudos (no `$1,234.00` formateado) para que Excel los trate como números y no como
texto; se deshabilita solo si la tabla no tiene filas.

Verificado en producción generando reportes reales: "Ventas por período" → CSV con las 4
filas de método de pago y montos exactos; "Inventario valorizado" → CSV con las 3 sucursales
y valores exactos, y confirmado que el botón de "Stock bajo" (0 filas ese día) queda
deshabilitado. Sin datos de prueba generados — solo lectura.

## Descuentos y promociones en Catálogo, con aprobación de Supervisor en Ventas (2026-08-06, sesión posterior)

Funcionalidad nueva fuera del plan original, a pedido del usuario. Antes de implementar se
usó plan mode (exploración del schema/permisos existentes + `AskUserQuestion` para acordar el
diseño) porque tocaba varias decisiones no triviales; el diseño final terminó revisándose dos
veces más a partir de feedback del usuario ya con la primera versión funcionando en producción.

- **Modelo de datos**, sin migración adicional después de la primera: nuevos modelos
  [`Descuento`](backend/prisma/schema.prisma) (nombre, `tipo` PORCENTAJE/MONTO_FIJO, `valor`,
  `alcance` TODOS/CATEGORIA/ARTICULO, vigencia opcional, `requiereAprobacion`) y `Promocion`
  (mismo alcance salvo TODOS, `cantidadRequerida`/`cantidadGratis` para reglas tipo "2x1"/"3x2").
  `VentaDetalle` ganó `descuentoId`/`promocionId`/`descuentoMonto`; `Venta` ganó
  `autorizadoPorId` (mismo patrón opcional que `Ajuste`/`MovimientoCaja`). Primera migración de
  schema desde que se cerró el plan original — todo lo anterior reutilizaba columnas existentes.
- **Permisos nuevos**: `catalogo.descuentos.gestionar` (alta/edición en Catálogo) y
  `venta.autorizar_descuento` (quién puede figurar como autorizador) — ambos Administrador +
  Supervisor por defecto. Reutiliza `venta.aplicar_descuento`, que ya existía en el catálogo de
  permisos sin ningún punto de la app que lo usara.
- **Backend**: módulos CRUD [`catalogo/descuentos`](backend/src/modules/catalogo/descuentos) y
  [`catalogo/promociones`](backend/src/modules/catalogo/promociones), mismo patrón que
  `listasPrecio` salvo que el GET va con `catalogo.articulos.ver` (no con
  `catalogo.descuentos.gestionar`): cualquier cajero necesita poder listarlos para que se le
  apliquen solos, aunque no pueda gestionarlos. `ventas.service.js#crear` resuelve el
  descuento/promoción de cada línea (`resolverDescuentoLinea`), valida alcance/vigencia, y si
  alguno tiene `requiereAprobacion=true` exige un `autorizadoPorId` con permiso
  `venta.autorizar_descuento` antes de confirmar.
- **Aplicación automática, no manual** (cambio de diseño pedido después de la primera versión):
  un descuento/promoción de catálogo ya no se elige de una lista en Ventas — se aplica solo
  apenas el artículo/cantidad de la línea califica, sin gatear el permiso
  `venta.aplicar_descuento` (se considera "pre-aprobado" por existir en el catálogo). Si más de
  uno califica para la misma línea, gana el de alcance más específico (artículo > categoría >
  todos) y, en empate, el que dé mayor descuento (`resolverAutomatico` en
  [VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx), misma fórmula reflejada
  en el backend).
- **Descuento manual** (agregado también a pedido, tras la versión automática): ícono de
  porcentaje por línea del carrito (junto al de eliminar, mismo criterio visual) para cargar un
  %/monto directo en la venta, sin pasar por catálogo. Reemplaza cualquier descuento automático
  de esa línea y **siempre** exige autorización de Supervisor — a diferencia de los de catálogo,
  si requiere el permiso `venta.aplicar_descuento` (es la acción discrecional del cajero). No
  generó campos nuevos: viaja como `descuentoManual: {tipo, valor}` en el request y se persiste
  en los mismos `descuentoMonto`/`autorizadoPorId` ya existentes, sin ligar a un registro de
  catálogo (`descuentoId`/`promocionId` quedan `null`; se etiqueta "Descuento manual" en el
  ticket/resumen cuando no hay nombre de catálogo que mostrar).
- **Visibilidad**: el total de descuento aparece como renglón propio ("Descuento -$X") en el
  resumen de Subtotal/Impuestos/Total del carrito y en el
  [ticket de venta](frontend/src/modules/ventas/components/TicketVenta.jsx), además del detalle
  ya existente por línea.

Dos bugs reales encontrados y corregidos durante la verificación en vivo (no en el desarrollo
inicial, sino probando contra producción):
- **Cobrar directo con Tarjeta/Transferencia mandaba la venta sin el autorizador recién
  elegido.** `setAutorizadoPorId()` es asíncrono; la acción pendiente se disparaba en el mismo
  instante con el estado todavía viejo. El backend rechazaba correctamente (nunca llegó a crear
  una venta mal autorizada), pero la UX quedaba rota. Efectivo/Mixto no tenían el bug porque
  abren un modal aparte, con un render de por medio antes de confirmar. Fix: la acción
  pendiente ahora recibe el id del autorizador como argumento en vez de leer el estado.
- **"Datos de descuento inválidos" al crear un descuento dejando Tipo en "Porcentaje".** El
  `<select>` de Tipo/Alcance mostraba una opción por defecto solo visualmente (`?? 'PORCENTAJE'`
  en el `value`), pero el estado del formulario nunca la guardaba si el usuario no tocaba el
  desplegable a mano — el campo viajaba vacío y Zod lo rechazaba por ser obligatorio. Fix: el
  formulario de alta en
  [ConfiguracionCatalogoPage.jsx](frontend/src/modules/catalogo/pages/ConfiguracionCatalogoPage.jsx)
  se inicializa (y se resetea tras crear) con esos valores reales en el estado, no solo
  mostrados en pantalla.

Verificado en vivo contra producción en cada iteración (creación de descuento/promoción de
prueba, venta con aplicación automática, reemplazo por descuento manual forzando aprobación,
autorización rechazada/aceptada según permiso, ticket y resumen mostrando el descuento) —
datos de prueba limpiados (ventas canceladas, descuento/promoción de prueba desactivados con el
sufijo "(ignorar)") después de cada corrida.

## Descuento manual en Cotizaciones (2026-08-07)

A pedido del usuario, se extendieron descuentos/promociones a Cotizaciones — con un alcance
más chico que en Ventas, definido explícitamente por el usuario antes de implementar:

- Cotizaciones **no** consume el catálogo de Descuentos/Promociones en absoluto (ni activos ni
  inactivos, sin aplicación automática). Solo se puede capturar un **descuento manual** por
  línea — porcentaje o monto fijo — directo en la cotización, con el mismo mini-formulario
  (ícono %) que ya existía en Ventas.
- **No pide permiso para crearse** (a diferencia del ícono de descuento manual en Ventas, que
  exige `venta.aplicar_descuento`) — cualquiera puede cargarlo en una cotización.
- **Sí exige autorización de Supervisor al convertir la cotización en venta** — reusa el
  mecanismo ya existente (`venta.autorizar_descuento`), sin duplicar la validación: el backend
  reconstruye el descuento manual congelado como `descuentoManual: {tipo: 'MONTO_FIJO', valor}`
  al armar la venta, y dejará que
  [ventas.service.js#crear](backend/src/modules/ventas/ventas/ventas.service.js) exija
  `autorizadoPorId` porque un descuento manual siempre resuelve `requiereAprobacion: true`.
- **Modelo de datos**: un único campo nuevo, `CotizacionDetalle.descuentoMonto` (mismo patrón
  minimalista que `VentaDetalle.descuentoMonto` — solo se persiste el monto ya calculado, no el
  tipo/valor original; la etiqueta "Descuento manual" es puramente de UI). Sin relaciones a
  `Descuento`/`Promocion`, sin enums nuevos — la migración es la más chica de las que tocaron
  schema hasta ahora.
- **Backend**: `descuentoManualSchema` (ya existía en
  [ventas.validators.js](backend/src/modules/ventas/ventas/ventas.validators.js)) se exportó y
  se reusa en
  [cotizaciones.validators.js](backend/src/modules/ventas/cotizaciones/cotizaciones.validators.js).
  `cotizaciones.service.js#crear` calcula el monto con un helper local (mismo cálculo que la
  rama manual de `resolverDescuentoLinea`, sin los mapas de catálogo que acá no aplican, sin
  chequeo de permiso). `convertir()` ahora acepta `autorizadoPorId` y lo reenvía a
  `ventasService.crear()`.
- **Frontend**: [CotizacionesPage.jsx](frontend/src/modules/ventas/pages/CotizacionesPage.jsx)
  — ícono % por línea del carrito (mismo mini-formulario que `VentasPage`, portado sin gating
  de permiso), fila "Descuento" en el resumen de totales, y el modal "Convertir cotización en
  venta" ahora muestra un selector "Autoriza" cuando la cotización tiene algún descuento
  manual — la conversión se bloquea del lado del cliente si no se elige antes de confirmar (el
  backend igual la re-valida). El PDF de cotización
  ([cotizacionPdf.js](frontend/src/modules/ventas/pdf/cotizacionPdf.js)) también neta el
  descuento por línea y agrega la fila "Descuento" al bloque de totales.
- Antes de implementar se usó plan mode + `AskUserQuestion` para acordar el alcance con el
  usuario (¿solo catálogo automático como en Ventas, o también descuento manual?) — se optó por
  algo más simple que lo de Ventas: nada de catálogo, solo el descuento manual con autorización
  diferida a la conversión.

Verificado en vivo contra el backend local (misma base que producción): cotización con línea al
10% y otra con $5 de descuento fijo (totales netos correctos en la UI y en el PDF, confirmado
interceptando `URL.createObjectURL` para leer el PDF crudo); conversión rechazada sin
autorizador elegido (validación de cliente) y con un autorizador sin el permiso
`venta.autorizar_descuento` (403 del backend); conversión exitosa con un autorizador válido,
`Venta`/`VentaDetalle` resultante con el mismo `descuentoMonto` y `autorizadoPorId` correctos;
y una cotización sin ningún descuento se sigue convirtiendo exactamente igual que antes (sin
pedir autorizador). Ventas de prueba generadas por las conversiones, canceladas al terminar.
Repetido después contra `https://ventix-frontend.onrender.com` ya con el deploy de Render
terminado: cotización con 20% de descuento → total neto correcto devuelto por el backend de
producción (prueba de que el código nuevo ya estaba en vivo), conversión con autorización
exitosa. Venta de prueba cancelada al terminar.

## Segunda ronda de QA (2026-08-11)

A pedido del usuario, segunda ronda de QA más profunda sobre los 10 módulos, uno por uno —
revisión de código módulo por módulo + reproducción en vivo de cada hallazgo antes del fix y
reverificación después, mismo criterio que la primera ronda (ver secciones de QA de cada módulo
más arriba). A diferencia de la primera ronda, esta vez se pudo levantar el backend local contra
la misma base de Supabase que producción (sin el problema de IPv6 de sesiones anteriores), así
que casi toda la reproducción/verificación se hizo en local antes de pushear, no contra
producción directamente. Clientes/Proveedores, Compras, Caja, Cotizaciones, Búsqueda global y
Empresa no tuvieron hallazgos nuevos. Encontrado y corregido:

**Críticos:**
- **Las sesiones no revalidaban el rol en cada request, solo el estado.** El JWT lleva el
  `rolId` fijo desde el login; `auth.middleware.js` solo revalidaba `estado` (activo/bloqueado)
  en cada request, no el rol. Verificado en vivo: se degradó un usuario de prueba de
  Administrador a Cajero y su token viejo siguió creando sucursales normalmente. Corregido
  resolviendo el rol en vivo contra `UsuarioEmpresa` en cada request, igual que el estado —
  degradar/reasignar un rol ahora tiene efecto inmediato sobre sesiones ya abiertas, no hasta
  que el token expire (hasta 8h).
- **El bloqueo de cuenta por intentos fallidos era evitable con concurrencia.** `login()` en
  `auth.service.js` hacía un leer-incrementar-escribir en JS, no atómico: 10 intentos fallidos
  concurrentes contra un usuario de prueba no bloquearon la cuenta (cada request leía el mismo
  valor viejo). Corregido con un incremento atómico a nivel de base de datos
  (`intentosFallidos: { increment: 1 }`) — reverificado con el mismo ataque, la cuenta ahora sí
  bloquea. Reverificado también contra producción ya con el deploy hecho.
- **`ventas.service.js#cancelar` nunca tuvo el candado atómico** que sí tienen
  `compras.cancelar`/`transferencias.recibir`/`conteos.cambiarEstado` desde la primera ronda.
  Verificado en vivo: 5 cancelaciones concurrentes sobre una venta de 5 unidades, 4 de 5 con
  éxito, el stock volvió a 115 en vez de 100 (reversión aplicada 4 veces). Corregido con el
  mismo patrón `UPDATE...WHERE estado='CONFIRMADA'` antes de aplicar los movimientos.
- **`devoluciones.service.js#crear` podía sobre-devolverse.** La validación de "cuánto queda
  disponible para devolver" se leía antes de la transacción. Verificado en vivo: 3 devoluciones
  concurrentes pidiendo las mismas 5 unidades de una venta de $50 — **las 3 tuvieron éxito**,
  $150 reembolsados y +15 de stock. Dinero real duplicado, no solo inventario. Corregido
  bloqueando la línea de venta con `SELECT...FOR UPDATE` (mismo patrón que `sesiones_caja` en
  Caja) y revalidando contra el valor fresco antes de incrementar `cantidadDevuelta`.
- **El reembolso de una devolución ignoraba el descuento de la línea.** `descuentoMonto` es el
  descuento total de la línea, pero `reembolso` se calculaba con el precio de lista completo sin
  prorratearlo. Verificado en vivo: venta de 5 unidades a $10 con 20% de descuento (total pagado
  $40), devolución completa reembolsó $50 en vez de $40. Corregido prorrateando
  `descuentoMonto` por unidad antes de calcular el reembolso; reverificado también con una
  devolución parcial (2 de 5 unidades → reembolso exacto de $16).

**Otros:**
- **Sin protección contra quedar sin ningún administrador de usuarios.** Se podía desactivar o
  degradar al último usuario activo con permiso para administrar usuarios, dejando a la empresa
  sin nadie que pudiera revertirlo desde la UI. Agregada la misma protección que ya existía para
  el Cliente General, en `usuarios.service.js#actualizar`.
- **Condición de carrera al crear roles/sucursales con nombre/clave duplicado** (Core): mismo
  hueco que ya se había corregido en Catálogo/Core-auth en la primera ronda, pero nunca se
  aplicó acá — daban 500 crudo en vez del 409 de negocio esperado bajo concurrencia. Corregido
  en `roles.service.js`/`sucursales.service.js`.
- **Misma condición de carrera al eliminar un descuento/promoción ya usado** (Catálogo): el
  check de "¿ya se aplicó en ventas?" no es atómico con el delete; el constraint de llave
  foránea de la DB podía filtrar como 500 crudo. Corregido en `descuentos.service.js`/
  `promociones.service.js`.
- **`existencias.service.js#establecerInicial` podía duplicarse bajo concurrencia** (mismo hueco
  que los anteriores): 5 llamadas concurrentes fijando "10" como stock inicial terminaban en
  "50" en vez de rechazar las 4 repetidas. Corregido.
- **El reporte "Artículos más vendidos" tampoco descontaba el descuento de línea** del monto
  reportado (mismo hueco que el reembolso de arriba, pero en Reportes) — mostraba ingresos por
  encima de lo real en artículos con descuento aplicado. Corregido con el mismo prorrateo.
- **Inyección de fórmulas en los exports CSV** (Herramientas, Existencias, Reportes; CWE-1236):
  un nombre de cliente/proveedor/artículo que empezara con `=`, `+`, `-` o `@` se interpretaba
  como fórmula al abrir el CSV en Excel/Sheets — nada neutralizaba esto en ninguno de los dos
  helpers CSV del proyecto (`backend/src/shared/csv.js`, `frontend/src/shared/csv.js`).
  Corregido en ambos anteponiendo un apóstrofe a valores que empiezan con esos caracteres.

**Notado y documentado, no corregido** (decisión de producto, no bug): Categorías, Marcas,
Unidades, Impuestos y Listas de precio no tienen ninguna restricción de nombre único en la base
de datos — se puede crear "Bebidas" dos veces sin que nada lo impida. Agregar la restricción
ahora podría chocar con duplicados que ya existan en producción, así que queda pendiente de
decidir con el usuario en vez de asumir.

Todos los fixes verificados en vivo contra el backend local (misma base de Supabase que
producción, sin el problema de IPv6 de sesiones anteriores) antes de pushear, con datos de
prueba limpiados después de cada uno (artículos/roles/sucursales de prueba desactivados o
archivados, movimientos de caja compensatorios donde una prueba generó dinero/stock real de
más). Pusheado a `main` en un solo commit (13 archivos) con permiso explícito del usuario,
verificado también contra `https://ventix-backend-yjgv.onrender.com` ya con el deploy
terminado (login-lockout reprobado en producción, mismo resultado que en local).

## Alertas de stock (mínimo/máximo) en la barra superior (2026-08-11, sesión posterior)

A pedido del usuario, nuevo ícono de notificaciones (campana) en el `TopBar`, junto al menú de
usuario, para avisar cuando un artículo llega a su límite de stock mínimo o máximo configurado
(`Articulo.stockMinimo`/`stockMaximo`, expuestos en el frontend desde "Stock mínimo/máximo
opcional en Artículos" — ver arriba).

- **Backend**: nuevo `GET /api/inventario/existencias/alertas` en
  [existencias.service.js](backend/src/modules/inventario/existencias/existencias.service.js),
  mismo permiso que el resto del módulo (`inventario.ver`). Trae las existencias de la empresa
  cuyo artículo esté activo y tenga al menos un límite configurado, y compara en JS (no se puede
  expresar en el `where` de Prisma una comparación entre dos columnas de tablas distintas, mismo
  motivo por el que `reportes.service.js#reporteInventarioValorizado` ya hacía esto mismo pero
  solo para `stockMinimo`): `cantidad <= stockMinimo` → alerta `BAJO`, `cantidad >= stockMaximo`
  → alerta `ALTO`. El stock se lleva por sucursal, así que un mismo artículo puede generar una
  alerta distinta por cada sucursal.
- **Frontend**: [TopBar.jsx](frontend/src/shared/layout/TopBar.jsx) — la campana solo se muestra
  si el usuario tiene el permiso `inventario.ver` (mismo criterio que oculta secciones enteras del
  Sidebar); hace polling cada 60s (sin websockets). Badge rojo con el conteo (sin contar más de
  "9+"); dropdown con la lista (ícono de flecha abajo en rojo para `BAJO`, flecha arriba en ámbar
  para `ALTO`, artículo, sucursal, cantidad actual vs. límite). Clic en una alerta navega a
  [ExistenciasPage](frontend/src/modules/inventario/pages/ExistenciasPage.jsx) con la búsqueda
  pre-cargada por SKU/nombre del artículo — se le agregó a esa pantalla el mismo patrón
  `location.state.buscar` que ya usan Artículos/Clientes/Proveedores/Ventas recientes desde el
  buscador global, en vez de duplicar lógica. Link "Ver existencias" al pie del dropdown.
- Verificado en vivo contra el backend local (misma base de Supabase que producción): se forzó
  `stockMinimo`/`stockMaximo` de un artículo real (Sprite 600ml, con stock en dos sucursales) por
  API para disparar ambos casos — la campana mostró badge "2", el dropdown listó las dos
  sucursales con el texto correcto, y el clic navegó a Existencias con el SKU pre-cargado,
  filtrando la tabla a esas 2 filas. Artículo revertido a sin límites al terminar (sin datos de
  prueba que queden sucios).

## Unidades alternas y variantes de producto (2026-08-11, sesión posterior)

A pedido del usuario: (1) poder comprar en una unidad y llevar el stock/venta en otra (ej.
entra por Caja, se vende por Pieza), y (2) poder generar variantes de un mismo producto por
atributos (color, talla, etc.). Antes de implementar se usó plan mode (investigación del schema
+ `AskUserQuestion` para acordar diseño) porque tocaba una migración de schema no trivial.

**Unidades alternas — resultó ser un gap, no una funcionalidad nueva.** El modelo
`UnidadAlterna` y la conversión automática en Compras
([compras.service.js#resolverFactor](backend/src/modules/compras/compras.service.js)) ya
existían desde Fase 2, pero no había ninguna pantalla para configurarlas ni el selector de
Compras las filtraba — en la práctica, inusable. Cerrado:
- Nuevo panel "Unidades alternas" en
  [ArticulosPage.jsx](frontend/src/modules/catalogo/pages/ArticulosPage.jsx) (mismo patrón Modal
  que "Precios por lista"): un input de factor opcional por cada unidad de la empresa distinta a
  la base del artículo.
- El selector de "Unidad" en
  [ComprasPage.jsx](frontend/src/modules/compras/pages/ComprasPage.jsx) ahora solo muestra la
  unidad base + las alternas configuradas del artículo elegido, con el factor en la etiqueta
  (ej. "Caja (= 24 Pieza)"), y se resetea a la base al cambiar de artículo.
- Sin cambios en Ventas: se confirmó con el usuario que siempre se vende en la unidad base, así
  que la conversión solo aplicaba al capturar la compra.

**Variantes — funcionalidad nueva de fondo.** Decisión de arquitectura clave: en vez de una
tabla `ArticuloVariante` separada, **cada variante es otro `Articulo`**, enlazado al padre con
un nuevo campo auto-referencial `articuloPadreId`. Se eligió así porque Existencia,
MovimientoInventario, CompraDetalle, VentaDetalle, AjusteDetalle, TransferenciaDetalle,
ConteoDetalle, búsqueda global, reportes, exportación CSV y descuentos/promociones ya funcionan
puramente sobre `articuloId` — con una variante siendo un `Articulo` normal, ninguno de esos
módulos necesitó tocarse.
- **Schema** (nueva migración `agregar_atributos_variantes`, aditiva): `Atributo` +
  `ValorAtributo` (catálogo reusable, ej. "Color" → "Rojo"/"Azul"), `ArticuloValorAtributo`
  (qué combinación de valores identifica a una variante) y `Articulo.articuloPadreId`.
- **Backend**: nuevo módulo CRUD `catalogo/atributos` (mismo patrón que `unidades`, con
  `valores` anidados). Nueva `generarVariantes()` en
  [articulos.service.js](backend/src/modules/catalogo/articulos/articulos.service.js)
  (`PUT /:id/variantes`): dado un padre + una lista de valores de atributo, calcula el producto
  cartesiano entre atributos distintos (Color × Talla) y crea un `Articulo` hijo por cada
  combinación nueva (aditivo e idempotente — combinaciones ya generadas no se tocan), copiando
  del padre tipo/categoría/marca/unidad/impuesto/costo/precio/stock como punto de partida
  editable; sku/código de barras quedan en `null`, igual que cualquier artículo nuevo. `listar()`
  en modo paginado (el único usado por `ArticulosPage`) ahora excluye variantes de la tabla
  principal (`articuloPadreId: null`) — se gestionan desde el panel "Variantes" del padre, no
  como filas sueltas; el modo array completo (Ventas/Compras/Cotizaciones/Ajustes/Conteos/
  Transferencias) sigue trayendo todo sin filtrar, porque esos flujos sí necesitan elegir una
  variante puntual directamente.
- **Frontend**: nueva sección "Atributos de variante" en
  [ConfiguracionCatalogoPage.jsx](frontend/src/modules/catalogo/pages/ConfiguracionCatalogoPage.jsx)
  (mismo criterio que Categorías: lógica propia, con chips de valores por atributo). Nuevo panel
  "Variantes" en ArticulosPage.jsx: checkboxes de valores agrupados por atributo + botón
  "Generar variantes"; la tabla de variantes ya generadas reusa directamente la función
  `iniciarEdicion` ya existente (una variante es un `Articulo` común, así que el modal "Editar
  artículo" de siempre sirve sin cambios). En el POS
  ([VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx)), un artículo con
  variantes ya no se agrega directo al hacer clic — muestra "Elegir variante (N)" y abre un
  picker con cada combinación (precio y stock propios); las variantes en sí no aparecen como
  tarjeta suelta en la grilla. El escaneo por código de barras/SKU exacto sigue agregando directo
  (ya identifica la variante puntual).
- **Fuera de alcance, a propósito**: sin migración de artículos ya existentes a variantes de un
  padre común (confirmado con el usuario); Herramientas (CSV) no se tocó, crea artículos sueltos
  sin padre sin romper nada; descuentos/promociones con alcance "ARTICULO" no se propagan
  automáticamente del padre a sus variantes (cada una tiene su propio `articuloId`).

Verificado en vivo contra el backend local (misma base de Supabase que producción): artículo de
prueba con unidad base Pieza + alterna Caja (factor 24, ya configurada en Coca Cola de una
sesión anterior) confirmado en el selector de Compras; atributos Color (Rojo/Azul) y Talla
(M/L) generando las 4 combinaciones correctas, edición de SKU/precio de una variante puntual
reusando el modal existente, venta de esa variante puntual desde el POS (grid → "Elegir
variante" → picker → cobrar) con el stock descontado de la variante correcta (no del padre) y
el folio de venta reflejando el precio de la variante. Datos de prueba limpiados (venta
cancelada, artículo padre + 4 variantes desactivados).

## Nombre único en Categorías/Marcas/Unidades/Impuestos/Listas de precio (2026-08-11)

Cierra el ítem pendiente que dejó la segunda ronda de QA: estas cinco entidades de
Catálogo se podían crear/editar con un nombre duplicado dentro de la misma empresa.
Antes de tocar el schema se confirmó contra producción que no había ningún duplicado
existente (`GROUP BY empresa_id, lower(nombre) HAVING count(*) > 1` sobre las 5 tablas,
0 filas en las 5) — si hubiera habido, agregar el constraint de DB habría roto la
migración.

- **Backend:** nuevo constraint `@@unique([empresaId, nombre])` en
  [schema.prisma](backend/prisma/schema.prisma) para Marca/Unidad/Impuesto/ListaPrecio;
  Categoría lo lleva acotado a `@@unique([empresaId, categoriaPadreId, nombre])` para
  permitir reusar un nombre de subcategoría bajo padres distintos (p.ej. "Otros" bajo
  "Bebidas" y bajo "Snacks"), ya que el modelo soporta hasta 2 niveles. Nuevo helper
  compartido [`backend/src/shared/nombreUnico.js`](backend/src/shared/nombreUnico.js)
  (`validarNombreUnico` + `relanzarConflictoNombre`), mismo patrón de dos capas ya usado
  para SKU/código de barras en `articulos.service.js`: un pre-chequeo insensible a
  mayúsculas/minúsculas antes de escribir (da un 409 limpio en el caso normal) más el
  `@@unique` de la DB como última línea de defensa ante dos altas/ediciones simultáneas
  con el mismo nombre exacto (capturando el `P2002` de Prisma). Los cinco
  `<entidad>.service.js` de `catalogo/` quedaron con este mismo patrón.
- **Frontend:** sin cambios — `ConfiguracionCatalogoPage.jsx` ya mostraba
  `err.response?.data?.error` genérico en cada formulario, así que el mensaje 409
  ("Ya existe una marca con ese nombre.", etc.) aparece solo.
- **Nota de diseño — el constraint de Categoría no cubre la carrera entre dos categorías
  raíz** (`categoriaPadreId: null`) con el mismo nombre: Postgres trata `NULL` como
  distinto de `NULL` en un unique constraint, así que dos altas simultáneas de una
  categoría raíz con nombre idéntico podrían ambas pasar el pre-chequeo y el constraint
  de DB no las bloquea. Mismo tipo de ventana de riesgo ya aceptado en el proyecto (ver
  `asegurarClienteGeneral()` en el QA de Clientes/Proveedores) — de baja severidad
  (cosmético) y no se resolvió con una solución más compleja (índice funcional fuera del
  DSL de Prisma) para mantener el mismo patrón que el resto del código.
- Verificado contra la base de producción (mismo Supabase, vía backend local — la
  conexión directa sí funcionó esta sesión): pre-chequeo insensible a mayúsculas bloquea
  con 409 limpio; 5 altas concurrentes con el mismo nombre exacto disparadas directo
  contra `prisma.marca.create()` (saltando el pre-chequeo a propósito) dieron 1 éxito y 4
  rechazadas por el constraint de la DB; llamando al `crear()` real del servicio con la
  misma carrera, las 4 rechazadas devuelven el 409 limpio (no el error crudo de Prisma);
  subcategoría "Otros" creada bajo dos padres distintos sin problema, bloqueada al
  repetirla bajo el mismo padre. Todos los datos de prueba limpiados al terminar.

## Enviar documentos por correo (2026-08-11)

El usuario pidió poder enviar documentos por correo directamente desde el sistema, en vez de
descargarlos y reenviarlos a mano. Alcance: Cotización, Compra, Ticket de venta y Reportes (CSV).
Proveedor de email: [Resend](https://resend.com).

- **El backend no genera PDFs** (no tenía ninguna librería de PDF instalada, y sumar una tipo
  Puppeteer era pesado innecesariamente). En su lugar, el **frontend sigue generando el PDF/CSV
  como ya lo hacía** (jsPDF) y lo manda como `base64` a un endpoint nuevo del backend, que solo lo
  adjunta y lo envía — mismo criterio que ya usa el proyecto para el logo de empresa (data URI en
  el JSON).
- **Cuatro endpoints "enviar", cada uno dueño de su propio módulo** (regla de límites de módulo,
  §3.1 — nada de un `/api/documentos/enviar` centralizado): `POST
  /api/ventas/cotizaciones/:id/enviar` (permiso `venta.ver`), `POST /api/compras/:id/enviar`
  (`compra.ver`), `POST /api/ventas/ventas/:id/enviar-ticket` (`venta.ver`), `POST
  /api/reportes/enviar` (`reportes.ver`). Los cuatro comparten un servicio único
  [`backend/src/shared/services/correo.service.js`](backend/src/shared/services/correo.service.js)
  para el envío real (wrapper sobre el SDK `resend`) y un validador Zod compartido
  ([`backend/src/shared/validators/enviarDocumento.validator.js`](backend/src/shared/validators/enviarDocumento.validator.js)).
  **Sin permiso nuevo en el catálogo**: cada acción "enviar" reusa el mismo permiso que ya gatea
  ver/descargar ese documento — si ya lo podés ver, lo podés mandar por correo.
- `Cotizacion` no tiene relaciones de Prisma hacia `Cliente`/`Sucursal` (a diferencia de
  `Venta`/`Compra`) — no hizo falta migración, el `enviar()` de ese módulo reusa el mismo patrón
  de consulta manual que ya usaba `obtener()`.
- **Ticket de venta**: antes solo existía como impresión térmica (`window.print()`), sin ruta a
  PDF. Nuevo [`ticketPdf.js`](frontend/src/modules/ventas/pdf/ticketPdf.js) que arma el mismo
  contenido como PDF angosto (formato recibo), solo para email — la impresión sigue igual.
  `cotizacionPdf.js`/`compraPdf.js` se refactorizaron para separar la construcción del `doc` de
  jsPDF de la descarga, sin cambiar el comportamiento de descarga existente, y agregar una función
  hermana que devuelve el mismo documento en base64.
- **Frontend**: componente nuevo
  [`EnviarCorreoModal`](frontend/src/shared/ui/EnviarCorreoModal.jsx) en el design system (modal
  chico con destinatario/asunto/mensaje), reusado por las 5 pantallas — sugiere el destinatario
  desde `cliente.correo`/`proveedor.correo` cuando existe (queda editable si viene vacío, p.ej.
  Cliente General). `frontend/src/shared/csv.js` se separó en `construirCsv` (string) +
  `exportarCsv` (descarga) para poder reusar el mismo CSV en el correo de Reportes.
- Body limit de Express subido de 3mb a 8mb en `app.js` (los PDFs/CSVs adjuntos en base64 pueden
  superar el límite que alcanzaba solo para el logo de empresa).
- **Verificado en vivo, incluido un envío real**: los 4 flujos probados contra el backend local
  (conectado a Supabase) con clics reales en el navegador — antes de tener la API key de Resend,
  los 4 endpoints se verificaron llegando limpio hasta el error esperado ("El envío de correo no
  está configurado en el servidor"); con la API key configurada, se envió una Cotización real
  (con PDF adjunto) al correo del usuario y se confirmó la entrega.
- Cuenta de Resend nueva del usuario, sin dominio propio verificado todavía — usa el dominio
  sandbox `onboarding@resend.dev` de Resend, que solo entrega al correo dueño de la cuenta. Para
  enviar a clientes/proveedores reales hace falta verificar un dominio propio en Resend (Domains →
  Add Domain, agregar los registros DNS que da) y actualizar `RESEND_FROM_EMAIL`.

## Qué contiene

```text
ventix/
├── backend/
│   ├── prisma/schema.prisma      ← modelo físico completo
│   │   └── migrations/           ← una migración por cambio de schema (npx prisma migrate dev)
│   └── src/
│       ├── app.js                ← registro central de rutas por módulo (§3.1: módulos no se
│       │                            importan entre sí salvo excepción documentada in-line)
│       ├── server.js
│       ├── config/db.js          ← cliente Prisma único (fuente de verdad, §3.2)
│       ├── routes/health.js      ← health check end-to-end
│       ├── shared/services/      ← puntos únicos de escritura compartidos entre módulos:
│       │                            aplicarMovimiento (stock), registrarMovimientoCaja (caja),
│       │                            obtenerSiguienteFolio (secuencia.service.js), auditoria
│       └── modules/              ← MOD-001 a MOD-010, cada uno con sus propios
│                                    <recurso>/{.controller,.service,.routes,.validators}.js
└── frontend/
    ├── tailwind.config.js        ← tokens de diseño (colores, tipografía, sombras, radios)
    └── src/
        ├── App.jsx               ← rutas de la app (una por pantalla, todas tras login salvo /login y /registro)
        ├── index.css              ← entrypoint de Tailwind
        ├── shared/
        │   ├── api.js             ← cliente HTTP único hacia el backend
        │   ├── format.js          ← formatoMoneda / formatoFecha / tiempoRelativo
        │   ├── ui/                ← design system: Button, Input, Select, Card, StatCard,
        │   │                         Badge, Table, Modal, TrendChart
        │   └── layout/            ← Sidebar + TopBar + AppLayout (estructura fija, enganchada
        │                             en ProtectedRoute.jsx)
        └── modules/              ← una carpeta por módulo (core, catalogo, ventas...), cada
                                     una con api/ (llamadas HTTP) y pages/ (pantallas), y
                                     opcionalmente components/ o pdf/ para piezas reusables
                                     dentro del módulo (p.ej. ventas/components/TicketVenta.jsx,
                                     ventas/pdf/cotizacionPdf.js) — ver las secciones de QA,
                                     "Rediseño visual" y "Documentos" arriba para el detalle de
                                     qué pantallas tiene cada módulo
```

## Cómo arrancarlo desde cero

Para retomar *este* proyecto (misma base de Supabase que producción) usá la guía "Para retomar
el proyecto" más arriba — los `.env` ya están listos, no hace falta nada de esto. Esta sección
es para el caso distinto: máquina nueva, clon del repo, o base de datos nueva.

### 1. Base de datos
Necesitas una instancia de PostgreSQL (local, Supabase, Render o Railway). Copia la URL de conexión.

### 2. Backend
```bash
cd backend
cp .env.example .env
# edita .env con tu DATABASE_URL real
npm install
npm run prisma:migrate   # crea las tablas a partir de schema.prisma
npm run dev               # levanta el servidor en http://localhost:4000
```

Verifica en el navegador: `http://localhost:4000/api/health` → debe responder `{"status":"ok","db":"connected"}`.

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # levanta la app en http://localhost:5173
```

Con una base de datos nueva y vacía, el primer paso real es registrar una empresa desde
`/registro` (crea la empresa, la sucursal Matriz, el usuario administrador y siembra roles,
permisos y secuencias) — no hay datos de arranque más allá de eso.

## Qué sigue

Los 10 módulos del plan original están completos y en producción, los 10 ya tuvieron su
primera ronda de QA (ver secciones arriba: Core, Ventas, Caja, Inventario, Catálogo, Compras,
Clientes/Proveedores, Reportes, Herramientas — todos los vacíos detectados ya están resueltos,
con una excepción documentada de severidad muy baja en Clientes), el rediseño visual completo
ya se aplicó a las 22 pantallas (ver "Rediseño visual" arriba), y sus tres pendientes de
pulido (UX de captura de Ventas tipo POS, responsive mobile real, búsqueda/orden/paginación
server-side en las listas grandes) ya se cerraron (ver "Pulido post-rediseño" arriba). Además,
ya se agregaron documentos fuera del plan original: impresión de ticket de venta, PDF de
cotización (con logo de empresa), PDF de compra, exportar Existencias a CSV/Excel, exportar
Reportes a CSV/Excel, stock mínimo/máximo opcional en Artículos y edición de nombre/logo de
la empresa (ver "Documentos", "PDF de compra", "Exportar Existencias", "Exportar Reportes" y
"Stock mínimo/máximo opcional" arriba), el buscador global de la barra superior ya está
implementado (ver "Buscador global" arriba), el menú lateral ya se puede contraer/expandir en
escritorio (ver "Menú lateral contraíble" arriba), y la paginación server-side ya se extendió
a Usuarios, Existencias, Cotizaciones, Conteos, Transferencias y Ajustes (ver "Paginación
server-side extendida" arriba) — de las pantallas con tabla que quedaban, solo Sucursales,
Roles, Caja y Configuración de Catálogo se dejaron sin paginar a propósito (catálogos chicos,
ver esa misma sección para el porqué de cada una; Herramientas no tenía nada que paginar y
Reportes ya tiene su propio export CSV en vez de paginación, que no aplicaba ahí). Por último,
ya se agregaron descuentos y promociones en Catálogo con aplicación automática en Ventas,
descuento manual con aprobación forzada de Supervisor, y su visibilidad en el resumen de venta
y el ticket (ver "Descuentos y promociones" arriba) — y ese descuento manual ya se extendió
también a Cotizaciones, con autorización diferida a cuando se convierten en venta (ver
"Descuento manual en Cotizaciones" arriba). Por último, ya se hizo una segunda ronda de QA más
profunda sobre los 10 módulos (ver "Segunda ronda de QA" arriba): 5 bugs críticos corregidos
(sesiones que no revalidaban rol, bloqueo de cuenta evitable por concurrencia, cancelación de
ventas y devoluciones sobre-aplicables por condición de carrera, reembolsos que ignoraban
descuentos) más 5 adicionales (condiciones de carrera menores, un reporte que tampoco
descontaba descuentos, e inyección de fórmulas en los exports CSV), todos verificados en vivo y
ya desplegados en producción. Se agregó un ícono de notificaciones (campana) en la barra
superior que avisa cuando un artículo llega a su límite de stock mínimo o máximo por sucursal
(ver "Alertas de stock" arriba). Por último, se cerró el gap de unidades alternas que ya existía
en el backend desde Fase 2 pero nunca tuvo pantalla (comprar por Caja, llevar el stock por
Pieza) y se agregaron variantes de producto por atributos reusables (color, talla, etc., con
generación automática de combinaciones y SKU/precio propios por variante — ver "Unidades
alternas y variantes de producto" arriba). Por último, ya se agregó la restricción de nombre
único a Categorías/Marcas/Unidades/Impuestos/Listas de precio que había quedado pendiente de
la segunda ronda de QA (ver "Nombre único en Categorías/Marcas/Unidades/Impuestos/Listas de
precio" arriba). Por último, ya se agregó el envío de documentos por correo (Cotización, Compra,
Ticket de venta, Reportes) vía Resend (ver "Enviar documentos por correo" arriba) — pendiente
menor: el usuario todavía no verificó un dominio propio en Resend, así que por ahora solo entrega
al correo de su cuenta (dominio sandbox). **No queda ningún otro pendiente abierto.** A elección:
- Una tercera ronda de QA, o profundizar en algún módulo específico.
- Otros documentos o campos de empresa editables (razón social, RFC, correo, teléfono, sitio
  web ya existen en el modelo `Empresa` pero solo `nombreComercial`/`logoUrl` son editables
  desde la UI por ahora).
- Nuevas funcionalidades fuera del plan original.
- Loading states (spinners) más pulidos — el único ítem del pulido visual que quedó sin tocar.
- Extender variantes/unidades alternas si hace falta: vender también por unidad alterna (hoy
  solo se compra en alterna, se vende en base — descartado a propósito por el usuario), migrar
  artículos ya existentes a variantes de un padre común, o propagar descuentos/promociones del
  padre a sus variantes automáticamente.
