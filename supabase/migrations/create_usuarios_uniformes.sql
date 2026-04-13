-- Gobernanza: perfiles de aplicación separados del catálogo de permisos (roles).
-- NOTA SEGURIDAD: la app usa anon key en cliente sin Supabase Auth JWT. Las políticas
-- permiten CRUD en usuarios_uniformes como el resto de tablas operativas; al integrar
-- login real, sustituir por RLS basada en auth.uid() / claims o rutas API + service_role.

CREATE TABLE IF NOT EXISTS public.roles_uniformes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT roles_uniformes_nombre_unique UNIQUE (nombre)
);

CREATE TABLE IF NOT EXISTS public.usuarios_uniformes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  rol_id UUID NOT NULL REFERENCES public.roles_uniformes (id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'pendiente_validacion'
    CHECK (estado IN ('pendiente_validacion', 'activo', 'inactivo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT usuarios_uniformes_correo_unique UNIQUE (correo)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_uniformes_rol ON public.usuarios_uniformes (rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_uniformes_estado ON public.usuarios_uniformes (estado);

COMMENT ON TABLE public.roles_uniformes IS 'Catálogo de roles para usuarios_uniformes; no duplica filas de permiso por usuario.';
COMMENT ON TABLE public.usuarios_uniformes IS 'Perfiles de gobernanza del sistema de uniformes; estado pendiente_validacion hasta validación formal.';
COMMENT ON COLUMN public.usuarios_uniformes.estado IS 'pendiente_validacion: alta sin login real; activo/inactivo tras gobernanza.';

INSERT INTO public.roles_uniformes (nombre, descripcion, orden)
VALUES
  ('Administrador', 'Acceso completo previsto tras login real', 1),
  ('Operativo', 'Operación diaria', 2),
  ('Consulta', 'Solo lectura / reportes', 3)
ON CONFLICT (nombre) DO NOTHING;

DROP TRIGGER IF EXISTS update_roles_uniformes_updated_at ON public.roles_uniformes;
CREATE TRIGGER update_roles_uniformes_updated_at
  BEFORE UPDATE ON public.roles_uniformes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_uniformes_updated_at ON public.usuarios_uniformes;
CREATE TRIGGER update_usuarios_uniformes_updated_at
  BEFORE UPDATE ON public.usuarios_uniformes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.roles_uniformes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_uniformes ENABLE ROW LEVEL SECURITY;

-- Catálogo de roles: solo lectura desde cliente anónimo (sin exponer escritura de permisos).
DROP POLICY IF EXISTS "roles_uniformes_select_catalogo" ON public.roles_uniformes;
CREATE POLICY "roles_uniformes_select_catalogo"
  ON public.roles_uniformes FOR SELECT
  USING (activo = true);

-- Usuarios: mismo patrón operativo que otras tablas hasta exista auth JWT (ver comentario arriba).
DROP POLICY IF EXISTS "usuarios_uniformes_crud_provisional" ON public.usuarios_uniformes;
CREATE POLICY "usuarios_uniformes_crud_provisional"
  ON public.usuarios_uniformes FOR ALL
  USING (true)
  WITH CHECK (true);
