-- Paso 1: pasar dueño de postgres → project_admin (requiere conexión postgres).
--
-- En tu PC:
--   cd uniformes
--   npx @insforge/cli@latest link --project-id 71884820-3d1e-4006-8a39-8607d7f36742
--   npx @insforge/cli@latest db connection-string
--   psql "postgresql://..." -f migrations/20260707110000_fix-ownership-postgres-to-project-admin.sql
--
-- Luego ejecuta en SQL Editor o con psql:
--   migrations/20260707120000_winston-linea-venta-folios.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tableowner = 'postgres'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO project_admin', r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER SEQUENCE %I.%I OWNER TO project_admin',
        r.sequence_schema,
        r.sequence_name
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) = 'postgres'
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO project_admin', r.sig);
  END LOOP;
END $$;
