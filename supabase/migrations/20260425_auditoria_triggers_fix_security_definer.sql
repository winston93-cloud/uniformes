-- Fix: asegurar que los triggers globales puedan insertar en auditoria aunque exista RLS
-- Motivo: los triggers se ejecutan con el rol del usuario; si RLS/políticas bloquean INSERT,
-- la auditoría no se registra. Con SECURITY DEFINER la función corre como su dueño y evita el bloqueo.

-- 1) Asegurar columna para PK no-UUID (si no existe)
ALTER TABLE public.auditoria
ADD COLUMN IF NOT EXISTS registro_pk TEXT;

-- 2) Re-crear la función como SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.trg_auditoria_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 3) (Opcional pero recomendado) política explícita para INSERT (por si alguien consulta desde cliente)
DO $$
BEGIN
  -- Si RLS está activo, asegurar política de INSERT.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='auditoria'
  ) THEN
    -- Crear política solo si no existe (nombre estable).
    BEGIN
      CREATE POLICY "Insert auditoria permitido" ON public.auditoria
        FOR INSERT WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

