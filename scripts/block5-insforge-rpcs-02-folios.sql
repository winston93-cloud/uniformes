-- Folio de cotizaciones: contador global incremental (no se reinicia por día/mes)
-- Problema actual: generar_folio_cotizacion() usa MAX(...) por prefijo de periodo, lo cual reinicia y además puede colisionar en concurrencia.
-- Solución: usar una SEQUENCE global y formatear el folio con prefijo de fecha + número global.

-- 1) Crear secuencia si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'cotizacion_folio_seq'
  ) THEN
    CREATE SEQUENCE public.cotizacion_folio_seq;
  END IF;
END $$;

-- 2) Inicializar secuencia a partir del máximo folio existente (solo la parte numérica final)
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '.*-([0-9]+)$', '\1'), folio)::bigint), 0)
  INTO v_max
  FROM public.cotizaciones
  WHERE folio IS NOT NULL AND folio <> '';

  IF v_max <= 0 THEN
    PERFORM setval('public.cotizacion_folio_seq', 1, false);
  ELSE
    PERFORM setval('public.cotizacion_folio_seq', v_max, true);
  END IF;
END $$;

-- 3) Reemplazar función para generar folio (global)
CREATE OR REPLACE FUNCTION public.generar_folio_cotizacion()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  anio text;
  mes text;
  n bigint;
BEGIN
  anio := to_char(current_date, 'YYYY');
  mes := to_char(current_date, 'MM');
  n := nextval('public.cotizacion_folio_seq');

  -- Mantener el formato visible COT-YYYYMM-0001, pero el número ya es global y no se reinicia.
  RETURN 'COT-' || anio || mes || '-' || lpad(n::text, 4, '0');
END;
$$;

-- 4) (Opcional) helper para re-foliar cotizaciones existentes
--    NO se ejecuta automáticamente; úsalo solo si decides corregir el historial.
--    Advertencia: puede afectar PDFs/URLs si dependen del folio.
CREATE OR REPLACE FUNCTION public.refoliar_cotizaciones_existentes()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_n bigint;
  v_count int := 0;
BEGIN
  -- Reiniciar secuencia en base al orden cronológico real
  -- Nota: las sequences de Postgres empiezan en 1; 0 es inválido.
  -- setval(seq, 1, false) hace que el siguiente nextval() retorne 1.
  PERFORM setval('public.cotizacion_folio_seq', 1, false);

  FOR r IN
    SELECT id, fecha_cotizacion, created_at
    FROM public.cotizaciones
    ORDER BY
      COALESCE(fecha_cotizacion, created_at::date) ASC,
      created_at ASC,
      id ASC
  LOOP
    v_n := nextval('public.cotizacion_folio_seq');
    UPDATE public.cotizaciones
    SET folio = 'COT-' || to_char(COALESCE(r.fecha_cotizacion, r.created_at::date), 'YYYYMM') || '-' || lpad(v_n::text, 4, '0')
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refoliar_cotizaciones_existentes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refoliar_cotizaciones_existentes() TO anon;
