-- Corregir RLS en tabla auditoria para permitir inserciones de usuarios autenticados

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Usuarios autenticados acceden a auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar en auditoria" ON public.auditoria;

-- Habilitar RLS en auditoria
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios autenticados leer su propia auditoría
CREATE POLICY "Usuarios autenticados pueden leer auditoria" 
ON public.auditoria
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Permitir a usuarios autenticados insertar en auditoría
CREATE POLICY "Usuarios autenticados pueden insertar auditoria" 
ON public.auditoria
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Comentario
COMMENT ON TABLE public.auditoria IS 'Tabla de auditoría con RLS habilitado para usuarios autenticados';
