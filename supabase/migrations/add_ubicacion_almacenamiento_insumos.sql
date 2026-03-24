-- ============================================
-- Migración: Ubicación de almacenamiento en insumos
-- Propósito: Agregar campo "dónde está almacenado" a los insumos
-- con opciones: Taller, Bodega uno, Bodega dos (extensible)
-- ============================================

-- 1. Crear tabla de ubicaciones de almacenamiento
CREATE TABLE IF NOT EXISTS public.ubicaciones_almacenamiento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ubicaciones_almacenamiento_nombre ON public.ubicaciones_almacenamiento(nombre);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_almacenamiento_activo ON public.ubicaciones_almacenamiento(activo);

-- Trigger para updated_at
CREATE TRIGGER update_ubicaciones_almacenamiento_updated_at
    BEFORE UPDATE ON public.ubicaciones_almacenamiento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.ubicaciones_almacenamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todas las operaciones en ubicaciones_almacenamiento"
    ON public.ubicaciones_almacenamiento FOR ALL USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.ubicaciones_almacenamiento IS 'Catálogo de ubicaciones donde se almacenan los insumos (Taller, Bodega uno, etc.)';
COMMENT ON COLUMN public.ubicaciones_almacenamiento.nombre IS 'Nombre de la ubicación de almacenamiento';

-- 2. Insertar las tres opciones iniciales
INSERT INTO public.ubicaciones_almacenamiento (nombre, descripcion, activo)
VALUES 
    ('Taller', 'Insumos almacenados en el taller', true),
    ('Bodega uno', 'Insumos almacenados en bodega 1', true),
    ('Bodega dos', 'Insumos almacenados en bodega 2', true)
ON CONFLICT (nombre) DO NOTHING;

-- 3. Agregar columna a la tabla insumos
ALTER TABLE public.insumos 
    ADD COLUMN IF NOT EXISTS ubicacion_almacenamiento_id UUID 
    REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_ubicacion_almacenamiento ON public.insumos(ubicacion_almacenamiento_id);

COMMENT ON COLUMN public.insumos.ubicacion_almacenamiento_id IS 'Ubicación donde se almacena el insumo (Taller, Bodega uno, Bodega dos, etc.)';
