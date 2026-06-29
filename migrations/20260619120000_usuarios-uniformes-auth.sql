-- Copia en migrations/ para aplicar en InsForge
-- Login app: usuario + contraseña en usuarios_uniformes (reinicio limpio de perfiles).

ALTER TABLE public.usuarios_uniformes
  ADD COLUMN IF NOT EXISTS usuario TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

DELETE FROM public.usuarios_uniformes;

ALTER TABLE public.usuarios_uniformes
  ALTER COLUMN usuario SET NOT NULL;

ALTER TABLE public.usuarios_uniformes
  DROP CONSTRAINT IF EXISTS usuarios_uniformes_usuario_unique;

ALTER TABLE public.usuarios_uniformes
  ADD CONSTRAINT usuarios_uniformes_usuario_unique UNIQUE (usuario);

ALTER TABLE public.usuarios_uniformes
  ALTER COLUMN password_hash SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_uniformes_usuario ON public.usuarios_uniformes (usuario);

COMMENT ON COLUMN public.usuarios_uniformes.usuario IS 'Nombre de usuario para login (único, case-insensitive en app).';
COMMENT ON COLUMN public.usuarios_uniformes.password_hash IS 'Hash scrypt; nunca exponer al cliente.';
