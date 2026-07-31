# Ventix — Fase 0: Cimentación técnica

Este es el andamiaje inicial de Ventix generado a partir de:
- `VENTIX_ESPECIFICACION_MAESTRA_INTEGRAL_V1.md`
- `VENTIX_BASE_TECNICA_CONSOLIDADA_V1.md`
- `VENTIX_PLAN_DE_TRABAJO_V1.md`

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
