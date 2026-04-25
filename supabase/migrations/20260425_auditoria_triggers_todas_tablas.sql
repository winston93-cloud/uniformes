-- Auditoría global: registrar INSERT/UPDATE/DELETE para todas las tablas del proyecto
-- (excluye la propia tabla auditoria y tablas internas)

-- 1) Asegurar columna para PK no-UUID (por compatibilidad con usuario.usuario_id, etc.)
ALTER TABLE public.auditoria
ADD COLUMN IF NOT EXISTS registro_pk TEXT;

-- 2) Función genérica de trigger
CREATE OR REPLACE FUNCTION public.trg_auditoria_generic()
RETURNS TRIGGER AS $$
DECLARE
  v_pk_text TEXT;
  v_pk_uuid UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSE
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_new := to_jsonb(NEW);
  END IF;

  v_pk_text := COALESCE(
    v_new->>'id',
    v_old->>'id',
    v_new->>'usuario_id',
    v_old->>'usuario_id'
  );

  BEGIN
    v_pk_uuid := NULLIF(v_pk_text, '')::uuid;
  EXCEPTION
    WHEN others THEN
      v_pk_uuid := NULL;
  END;

  INSERT INTO public.auditoria (tabla, operacion, registro_id, registro_pk, datos_anteriores, datos_nuevos, usuario_id, timestamp)
  VALUES (TG_TABLE_NAME, TG_OP, v_pk_uuid, v_pk_text, v_old, v_new, NULL, NOW());

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Crear triggers en todas las tablas públicas (excepto auditoria)
DO $$
DECLARE
  r RECORD;
  trig_name TEXT;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('auditoria')
  LOOP
    trig_name := 'trg_auditoria_' || r.tablename;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trig_name, r.tablename);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_generic();',
      trig_name,
      r.tablename
    );
  END LOOP;
END $$;

