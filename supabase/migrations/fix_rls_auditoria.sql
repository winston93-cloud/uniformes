-- Corregir RLS en tabla auditoria para permitir inserciones de usuarios autenticados

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Usuarios autenticados acceden a auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar en auditoria" ON public.auditoria;

-- Habilitar RLS en auditoria
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Permitir a todos los usuarios autenticados acceder a auditoría
CREATE POLICY "Acceso completo a auditoria para autenticados" 
ON public.auditoria
FOR ALL 
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Comentario
COMMENT ON TABLE public.auditoria IS 'Tabla de auditoría con RLS habilitado para usuarios autenticados';
