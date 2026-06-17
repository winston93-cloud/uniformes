-- Folios cotización (secuencia ya creada en block5-insforge-ddl.sql; setval post-migración en migrate-block5)

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

  RETURN 'COT-' || anio || mes || '-' || lpad(n::text, 4, '0');
END;
$$;

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
