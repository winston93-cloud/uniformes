-- Crear tabla de insumos para el catálogo de materiales
CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    presentacion VARCHAR(50) NOT NULL, -- kilo, bolsa, metro, rollo, caja, etc.
    cantidad_por_presentacion DECIMAL(10, 2) NOT NULL DEFAULT 1, -- cantidad que contiene cada presentación
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_insumos_codigo ON public.insumos(codigo);
CREATE INDEX IF NOT EXISTS idx_insumos_nombre ON public.insumos(nombre);
CREATE INDEX IF NOT EXISTS idx_insumos_presentacion ON public.insumos(presentacion);
CREATE INDEX IF NOT EXISTS idx_insumos_activo ON public.insumos(activo);

-- Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajustar según necesidades de seguridad)
CREATE POLICY "Permitir todas las operaciones en insumos" ON public.insumos
    FOR ALL USING (true) WITH CHECK (true);

-- Comentarios de la tabla y columnas
COMMENT ON TABLE public.insumos IS 'Catálogo de insumos para la fabricación de prendas';
COMMENT ON COLUMN public.insumos.codigo IS 'Código único del insumo generado automáticamente';
COMMENT ON COLUMN public.insumos.nombre IS 'Nombre del insumo';
COMMENT ON COLUMN public.insumos.descripcion IS 'Descripción detallada del insumo (material, color, características)';
COMMENT ON COLUMN public.insumos.presentacion IS 'Unidad de medida o presentación (kilo, bolsa, metro, rollo, caja, etc.)';
COMMENT ON COLUMN public.insumos.cantidad_por_presentacion IS 'Cantidad de unidades que contiene cada presentación (ej: 500 botones por bolsa)';
COMMENT ON COLUMN public.insumos.activo IS 'Indica si el insumo está activo en el catálogo';

-- Insertar algunos insumos de ejemplo (opcional)
INSERT INTO public.insumos (codigo, nombre, descripcion, presentacion, cantidad_por_presentacion, activo)
VALUES 
    ('BOT-001', 'Botones Blancos', 'Botones de plástico color blanco, 15mm de diámetro', 'Bolsa', 500, true),
    ('TEL-001', 'Tela Azul Marino', 'Tela de poliéster color azul marino, alta resistencia', 'Metro', 1, true),
    ('HIL-001', 'Hilo Poliéster Blanco', 'Hilo de poliéster color blanco, carrete de 5000m', 'Rollo', 5000, true),
    ('CIE-001', 'Cierre 20cm Negro', 'Cierre metálico color negro, 20cm de longitud', 'Pieza', 1, true),
    ('ELA-001', 'Elástico 2cm', 'Elástico blanco de 2cm de ancho', 'Metro', 1, true)
ON CONFLICT (codigo) DO NOTHING;

