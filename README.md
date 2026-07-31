# Ventix — POS multi-tenant

Generado a partir de:
- `VENTIX_ESPECIFICACION_MAESTRA_INTEGRAL_V1.md`
- `VENTIX_BASE_TECNICA_CONSOLIDADA_V1.md`
- `VENTIX_PLAN_DE_TRABAJO_V1.md`

## Estado actual (2026-07-31)

Las 10 fases del plan original están completas, commiteadas y en GitHub
(`https://github.com/jesusworkmb-a11y/Ventix`, rama `main`):

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

**Para retomar el proyecto** (incluida una conversación nueva de Claude Code):
1. Abre Claude Code en `C:\Users\DELL\Documents\Quique\Ventix\ventix-fase0\ventix`.
2. Pide que lea este README y, si hace falta más detalle, `git log --oneline` (los mensajes de
   commit documentan qué se hizo y por qué en cada fase).
3. Levanta los servidores (no persisten entre sesiones/reinicios de máquina):
   ```bash
   cd backend && npm run dev   # http://localhost:4000
   cd frontend && npm run dev  # http://localhost:5173
   ```
   Los `.env` de ambos ya están configurados (Supabase + JWT secret) — no hace falta tocarlos.
4. Login de prueba: `jesus.rodriguez@ventixdemo.test` / `SuperSegura123`.
5. Dile qué sigue: como los 10 módulos del plan original ya están completos, lo siguiente es a
   elección — desplegar a producción (Render, backend ya decidido en Fase 0), pulir/QA de algún
   módulo, o nuevas funcionalidades fuera del plan original.

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
        ├── App.jsx               ← valida conexión React → Express → PostgreSQL
        ├── shared/api.js         ← cliente HTTP único hacia el backend
        └── modules/              ← una carpeta por módulo (core, catalogo, ventas...)
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
- [x] Correr `npm run prisma:migrate` contra una base de datos real y revisar que el schema no tenga errores
- [x] Configurar el repositorio Git (`git init`, primer commit, remoto en GitHub) — remoto en GitHub pendiente
- [x] Revisar las notas "// REVISAR" dentro de `schema.prisma` — validadas, marcadas como "VALIDADO" en el schema

## Siguiente fase

**Fase 1 — MOD-001 Core**: autenticación, empresas (con inicialización automática), sucursales, usuarios, roles, permisos, folios y auditoría. Es el módulo del que dependen todos los demás.
