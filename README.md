# Ventix — POS multi-tenant

Generado a partir de:
- `VENTIX_ESPECIFICACION_MAESTRA_INTEGRAL_V1.md`
- `VENTIX_BASE_TECNICA_CONSOLIDADA_V1.md`
- `VENTIX_PLAN_DE_TRABAJO_V1.md`

## Estado actual (2026-08-03)

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
5. Dile qué sigue: con los 10 módulos completos y ya en producción, y MOD-001 Core, MOD-008
   Ventas, MOD-006 Caja, MOD-004 Inventario, MOD-002 Catálogo y MOD-005 Compras ya con su primera
   pasada de QA (ver secciones abajo) — lo siguiente es a elección: QA de otro módulo
   (Clientes/Proveedores, Reportes, Herramientas), o nuevas funcionalidades fuera del plan
   original.

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
    └── src/
        ├── App.jsx               ← rutas de la app (una por pantalla, todas tras login salvo /login y /registro)
        ├── shared/api.js         ← cliente HTTP único hacia el backend
        └── modules/              ← una carpeta por módulo (core, catalogo, ventas...), cada
                                     una con api/ (llamadas HTTP) y pages/ (pantallas) — ver las
                                     secciones de QA arriba para el detalle de qué pantallas
                                     tiene cada módulo y qué le falta
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

Los 10 módulos del plan original están completos y en producción, y MOD-001 Core, MOD-008
Ventas, MOD-006 Caja, MOD-004 Inventario, MOD-002 Catálogo y MOD-005 Compras ya pasaron su
primera ronda de QA (ver secciones arriba). Todos los vacíos detectados en esas pasadas ya están
resueltos. A elección: QA de algún otro módulo (Clientes/Proveedores, Reportes, Herramientas), o
nuevas funcionalidades fuera del plan original.
