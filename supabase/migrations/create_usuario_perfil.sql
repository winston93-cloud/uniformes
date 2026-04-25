-- Tabla faltante en migrations del repo: usuario_perfil
-- Reconstruida desde introspección de Supabase (Winston) para habilitar
-- migración automática (DDL + datos) hacia InsForge.

CREATE TABLE IF NOT EXISTS public.usuario_perfil (
  perfil_id SMALLINT NOT NULL,
  perfil_clase VARCHAR NOT NULL,
  CONSTRAINT usuario_perfil_pkey PRIMARY KEY (perfil_id)
);

