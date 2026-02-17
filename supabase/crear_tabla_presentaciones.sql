-- Crear tabla de presentaciones (unidades de medida para insumos)
CREATE TABLE IF NOT EXISTS public.presentaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presentaciones_nombre ON public.presentaciones(nombre);
CREATE INDEX IF NOT EXISTS idx_presentaciones_activo ON public.presentaciones(activo);

-- Trigger para updated_at
CREATE TRIGGER update_presentaciones_updated_at BEFORE UPDATE ON public.presentaciones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todas las operaciones en presentaciones" ON public.presentaciones
    FOR ALL USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.presentaciones IS 'Cat\u00e1logo de presentaciones o unidades de medida para insumos';
COMMENT ON COLUMN public.presentaciones.nombre IS 'Nombre de la presentaci\u00f3n (Kilo, Bolsa, Metro, etc.)';
COMMENT ON COLUMN public.presentaciones.descripcion IS 'Descripci\u00f3n opcional de la presentaci\u00f3n';

-- Insertar presentaciones predeterminadas
INSERT INTO public.presentaciones (nombre, descripcion, activo)
VALUES 
    ('Kilo', 'Kilogramo - unidad de masa', true),
    ('Bolsa', 'Bolsa o paquete sellado', true),
    ('Metro', 'Metro lineal - unidad de longitud', true),
    ('Rollo', 'Rollo o carrete', true),
    ('Caja', 'Caja de cart\u00f3n o pl\u00e1stico', true),
    ('Paquete', 'Paquete o bulto', true),
    ('Pieza', 'Pieza o unidad individual', true),
    ('Litro', 'Litro - unidad de volumen', true),
    ('Unidad', 'Unidad gen\u00e9rica', true),
    ('Docena', '12 unidades', true),
    ('Otro', 'Otra presentaci\u00f3n no especificada', true)
ON CONFLICT (nombre) DO NOTHING;

-- Actualizar tabla de insumos para usar foreign key
-- NOTA: Ejecutar esto DESPU\u00c9S de migrar los datos existentes
ALTER TABLE public.insumos 
    DROP COLUMN IF EXISTS presentacion,
    ADD COLUMN IF NOT EXISTS presentacion_id UUID REFERENCES public.presentaciones(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_insumos_presentacion_id ON public.insumos(presentacion_id);
