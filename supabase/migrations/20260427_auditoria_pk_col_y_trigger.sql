-- Auditoría: capturar PK real (columna y valor) para sync confiable
-- Nota: diseñado para seguir funcionando con RLS activado (SECURITY DEFINER).

ALTER TABLE public.auditoria
ADD COLUMN IF NOT EXISTS registro_pk_col TEXT;

CREATE OR REPLACE FUNCTION public.trg_auditoria_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk_col TEXT;
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

  -- Detectar PK (primer campo del primary key)
  SELECT a.attname
  INTO v_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[1]
  WHERE i.indrelid = TG_RELID
    AND i.indisprimary
  LIMIT 1;

  -- Valor de PK como texto (desde NEW u OLD)
  IF v_pk_col IS NOT NULL THEN
    v_pk_text := COALESCE(v_new->>v_pk_col, v_old->>v_pk_col);
  END IF;

  -- Compat: fallback a id/usuario_id si no hubo PK detectada o valor nulo
  IF v_pk_text IS NULL OR v_pk_text = '' THEN
    v_pk_col := NULL;
    v_pk_text := COALESCE(
      v_new->>'id',
      v_old->>'id',
      v_new->>'usuario_id',
      v_old->>'usuario_id'
    );
  END IF;

  BEGIN
    v_pk_uuid := NULLIF(v_pk_text, '')::uuid;
  EXCEPTION
    WHEN others THEN
      v_pk_uuid := NULL;
  END;

  INSERT INTO public.auditoria (tabla, operacion, registro_id, registro_pk_col, registro_pk, datos_anteriores, datos_nuevos, usuario_id, timestamp)
  VALUES (TG_TABLE_NAME, TG_OP, v_pk_uuid, v_pk_col, v_pk_text, v_old, v_new, NULL, NOW());

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

