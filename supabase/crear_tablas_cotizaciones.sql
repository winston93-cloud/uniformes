-- ============================================
-- MÓDULO: Sistema de Cotizaciones
-- Propósito: Generar cotizaciones profesionales sin afectar inventario
-- ============================================

-- Tabla principal de cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Folio único y secuencial
  folio VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cliente (alumno o externo)
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  externo_id UUID REFERENCES externos(id) ON DELETE SET NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('alumno', 'externo')),
  
  -- Fechas
  fecha_cotizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vigencia DATE, -- Hasta cuándo es válida la cotización
  
  -- Montos
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Información adicional
  observaciones TEXT,
  condiciones_pago TEXT, -- Ej: "50% anticipo, 50% contra entrega"
  tiempo_entrega VARCHAR(100), -- Ej: "5-7 días hábiles"
  
  -- PDF generado
  pdf_url TEXT,
  
  -- Estado de la cotización
  estado VARCHAR(20) DEFAULT 'vigente' CHECK (estado IN ('vigente', 'aceptada', 'rechazada', 'vencida')),
  
  -- Usuario que creó la cotización
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: debe tener alumno_id O externo_id, no ambos ni ninguno
  CONSTRAINT check_cliente CHECK (
    (alumno_id IS NOT NULL AND externo_id IS NULL) OR
    (alumno_id IS NULL AND externo_id IS NOT NULL)
  )
);

-- Tabla de detalle de cotizaciones (partidas)
CREATE TABLE IF NOT EXISTS detalle_cotizacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con cotización
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  
  -- Información del producto/prenda
  prenda_nombre VARCHAR(255) NOT NULL,
  talla VARCHAR(50) NOT NULL,
  color VARCHAR(100),
  especificaciones TEXT,
  
  -- Cantidades y precios
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  
  -- Orden de las partidas
  orden INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio ON cotizaciones(folio);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_alumno ON cotizaciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_externo ON cotizaciones(externo_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha_cotizacion);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion ON detalle_cotizacion(cotizacion_id);

-- Función para generar folio automático
CREATE OR REPLACE FUNCTION generar_folio_cotizacion()
RETURNS TEXT AS $$
DECLARE
  anio TEXT;
  mes TEXT;
  siguiente_numero INTEGER;
  nuevo_folio TEXT;
BEGIN
  -- Obtener año y mes actual
  anio := TO_CHAR(CURRENT_DATE, 'YYYY');
  mes := TO_CHAR(CURRENT_DATE, 'MM');
  
  -- Obtener el siguiente número secuencial para este mes
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(folio FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO siguiente_numero
  FROM cotizaciones
  WHERE folio LIKE 'COT-' || anio || mes || '%';
  
  -- Generar folio con formato: COT-YYYYMM-0001
  nuevo_folio := 'COT-' || anio || mes || '-' || LPAD(siguiente_numero::TEXT, 4, '0');
  
  RETURN nuevo_folio;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_cotizaciones_updated_at ON cotizaciones;
CREATE TRIGGER update_cotizaciones_updated_at
    BEFORE UPDATE ON cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE cotizaciones IS 'Cotizaciones generadas para alumnos y clientes externos';
COMMENT ON COLUMN cotizaciones.folio IS 'Folio único de la cotización (formato: COT-YYYYMM-0001)';
COMMENT ON COLUMN cotizaciones.tipo_cliente IS 'Tipo de cliente: alumno o externo';
COMMENT ON COLUMN cotizaciones.fecha_vigencia IS 'Fecha hasta la cual es válida la cotización';
COMMENT ON COLUMN cotizaciones.estado IS 'Estado actual: vigente, aceptada, rechazada, vencida';
COMMENT ON COLUMN cotizaciones.condiciones_pago IS 'Condiciones de pago acordadas';
COMMENT ON COLUMN cotizaciones.tiempo_entrega IS 'Tiempo estimado de entrega';

COMMENT ON TABLE detalle_cotizacion IS 'Partidas/items de cada cotización';
COMMENT ON COLUMN detalle_cotizacion.orden IS 'Orden de visualización de la partida';
COMMENT ON COLUMN detalle_cotizacion.especificaciones IS 'Detalles adicionales del producto (bordados, logos, etc.)';

-- RLS (Row Level Security)
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cotizacion ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos pueden ver y crear cotizaciones (autenticados)
CREATE POLICY "Permitir lectura de cotizaciones" ON cotizaciones
    FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserción de cotizaciones" ON cotizaciones
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir actualización de cotizaciones" ON cotizaciones
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir eliminación de cotizaciones" ON cotizaciones
    FOR DELETE
    USING (true);

CREATE POLICY "Permitir lectura de detalle_cotizacion" ON detalle_cotizacion
    FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserción de detalle_cotizacion" ON detalle_cotizacion
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir actualización de detalle_cotizacion" ON detalle_cotizacion
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir eliminación de detalle_cotizacion" ON detalle_cotizacion
    FOR DELETE
    USING (true);
