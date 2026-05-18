-- Tabla `public.alumno` recreada en producción: exponer a PostgREST y permitir lectura con anon (app sin Auth JWT).

DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.alumno') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.alumno TO anon, authenticated, service_role;

    ALTER TABLE public.alumno ENABLE ROW LEVEL SECURITY;

    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'alumno'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.alumno', r.policyname);
    END LOOP;

    CREATE POLICY "Permitir acceso total a alumno" ON public.alumno
      FOR ALL USING (true) WITH CHECK (true);

    COMMENT ON POLICY "Permitir acceso total a alumno" ON public.alumno IS
      'Cliente anon (Uniformes sin Supabase Auth): búsqueda y listado de alumnos.';
  ELSE
    RAISE NOTICE 'Omitido RLS alumno: tabla public.alumno no existe';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
