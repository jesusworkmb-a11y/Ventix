-- Supabase expone el schema public por su Data API (PostgREST) y su linter marca como ERROR
-- toda tabla sin Row Level Security. BOX POS no usa esa API: el backend entra directo a Postgres
-- con Prisma como `postgres`, dueño de las tablas, y RLS no aplica al dueño (sin FORCE). Activar
-- RLS sin políticas deja la Data API sin acceso a nada y no cambia nada para la app.
-- Recorre todas las tablas de public (incluida _prisma_migrations) en vez de listarlas a mano.
-- Las tablas que se creen en migraciones futuras necesitan su propio
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
