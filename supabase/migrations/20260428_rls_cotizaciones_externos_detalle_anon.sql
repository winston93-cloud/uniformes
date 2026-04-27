-- Cotizaciones + detalle + externos: la app usa NEXT_PUBLIC_SUPABASE_ANON_KEY sin sesión Supabase Auth,
-- por lo que el rol efectivo es `anon`. Sin políticas permisivas, SELECT devuelve 0 filas sin error HTTP.
-- Idempotente: elimina políticas existentes en cada tabla y deja una política permisiva (mismo criterio que fix_rls_anon_access.sql).

DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.cotizaciones') IS NOT NULL THEN
    ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'cotizaciones'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.cotizaciones', r.policyname);
    END LOOP;
    CREATE POLICY "Permitir acceso total a cotizaciones" ON public.cotizaciones
      FOR ALL USING (true) WITH CHECK (true);
    COMMENT ON POLICY "Permitir acceso total a cotizaciones" ON public.cotizaciones IS
      'Cliente anon (app sin Supabase Auth JWT): lista y CRUD de cotizaciones';
  ELSE
    RAISE NOTICE 'Omitido RLS cotizaciones: tabla no existe';
  END IF;

  IF to_regclass('public.detalle_cotizacion') IS NOT NULL THEN
    ALTER TABLE public.detalle_cotizacion ENABLE ROW LEVEL SECURITY;
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'detalle_cotizacion'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.detalle_cotizacion', r.policyname);
    END LOOP;
    CREATE POLICY "Permitir acceso total a detalle_cotizacion" ON public.detalle_cotizacion
      FOR ALL USING (true) WITH CHECK (true);
    COMMENT ON POLICY "Permitir acceso total a detalle_cotizacion" ON public.detalle_cotizacion IS
      'Cliente anon: partidas de cotización';
  ELSE
    RAISE NOTICE 'Omitido RLS detalle_cotizacion: tabla no existe';
  END IF;

  IF to_regclass('public.externos') IS NOT NULL THEN
    ALTER TABLE public.externos ENABLE ROW LEVEL SECURITY;
    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'externos'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.externos', r.policyname);
    END LOOP;
    CREATE POLICY "Permitir acceso total a externos" ON public.externos
      FOR ALL USING (true) WITH CHECK (true);
    COMMENT ON POLICY "Permitir acceso total a externos" ON public.externos IS
      'Cliente anon: datos de cliente externo para historial de cotizaciones';
  ELSE
    RAISE NOTICE 'Omitido RLS externos: tabla no existe';
  END IF;
END $$;
