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
4. Login de prueba: `jesus.rodriguez@ventixdemo.test` / `SuperSegura123`.
5. Dile qué sigue: con los 10 módulos completos y ya en producción, y MOD-001 Core y MOD-008
   Ventas ya con su primera pasada de QA (ver secciones abajo), lo siguiente es a elección —
   QA de otro módulo (Caja es el candidato más obvio, por ser el otro núcleo del POS), los
   pendientes que dejó el QA de Ventas, o nuevas funcionalidades fuera del plan original.

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

Pendiente, sin decidir todavía:
- `ventas.crear` no valida que la caja de `sesionCajaId` pertenezca a la misma sucursal de
  la venta, solo que sea de la misma empresa — se podría vender en una sucursal y cobrar
  contra la caja de otra. No está claro si es un bug o flexibilidad intencional.
- Vacío funcional: el frontend de Ventas
  ([VentasPage.jsx](frontend/src/modules/ventas/pages/VentasPage.jsx)) solo tiene "crear
  venta" y "listar" — no hay UI para cancelar, devoluciones ni cotizaciones (mismo tipo de
  vacío que se encontró y cerró en Core). Todo eso solo es alcanzable vía API por ahora.

## Qué contiene

```text
ventix/
├── backend/
│   ├── prisma/schema.prisma      ← modelo físico completo (resuelve PENDIENTE-011)
│   └── src/
│       ├── app.js                ← registro central de rutas por módulo
│       ├── server.js
│       ├── config/db.js          ← cliente Prisma único (fuente de verdad, §3.2)
│       ├── routes/health.js      ← health check end-to-end
│       └── modules/              ← MOD-001 a MOD-010, un router placeholder cada uno
└── frontend/
    └── src/
        ├── App.jsx               ← rutas de la app (una por pantalla, todas tras login salvo /login y /registro)
        ├── shared/api.js         ← cliente HTTP único hacia el backend
        └── modules/              ← una carpeta por módulo (core, catalogo, ventas...)
            └── core/pages/       ← Login, Registro, y las 4 pantallas de administración
                                     (Sucursales, Usuarios, Roles, Auditoría)
```

## Cómo arrancarlo

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

Si ves "Estado del backend: conectado — DB: connected" en la pantalla, la Fase 0 está completa: el criterio de salida (React → Express → PostgreSQL funcionando end-to-end) se cumple.

## Qué falta antes de pasar a Fase 1

- [x] Elegir Render vs. Railway para el backend en producción — decidido: **Render** (tier gratuito real; el cold start tras inactividad es aceptable para esta etapa)
- [x] Desplegar backend y frontend en Render (ver sección "Producción" arriba)
- [x] Correr `npm run prisma:migrate` contra una base de datos real y revisar que el schema no tenga errores
- [x] Configurar el repositorio Git (`git init`, primer commit, remoto en GitHub) — remoto en GitHub pendiente
- [x] Revisar las notas "// REVISAR" dentro de `schema.prisma` — validadas, marcadas como "VALIDADO" en el schema

## Qué sigue

Los 10 módulos del plan original están completos y en producción, y MOD-001 Core y MOD-008
Ventas ya pasaron su primera ronda de QA (ver secciones arriba). A elección: QA de Caja
(el otro núcleo del POS), los dos pendientes que dejó el QA de Ventas (validación cruzada
sucursal↔caja, UI de cancelar/devoluciones/cotizaciones), QA de algún otro módulo, o nuevas
funcionalidades fuera del plan original.
