-- Tabla de transferencias de mercancía entre sucursales
CREATE TABLE IF NOT EXISTS transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(20) UNIQUE NOT NULL,
  sucursal_origen_id UUID NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id UUID NOT NULL REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),
  fecha_transferencia TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA')),
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detalle de transferencias (prendas transferidas)
CREATE TABLE IF NOT EXISTS detalle_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id UUID NOT NULL REFERENCES transferencias(id) ON DELETE CASCADE,
  prenda_id UUID NOT NULL REFERENCES prendas(id),
  talla_id UUID NOT NULL REFERENCES tallas(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  costo_id UUID REFERENCES costos(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE transferencias IS 'Registro de transferencias de mercancía entre sucursales';
COMMENT ON COLUMN transferencias.folio IS 'Folio único de la transferencia (ej: TRANS-2026-001)';
COMMENT ON COLUMN transferencias.estado IS 'Estado de la transferencia: PENDIENTE, EN_TRANSITO, RECIBIDA, CANCELADA';

COMMENT ON TABLE detalle_transferencias IS 'Detalle de prendas transferidas';
COMMENT ON COLUMN detalle_transferencias.cantidad IS 'Cantidad de prendas transferidas';

-- Índices
CREATE INDEX idx_transferencias_origen ON transferencias(sucursal_origen_id);
CREATE INDEX idx_transferencias_destino ON transferencias(sucursal_destino_id);
CREATE INDEX idx_transferencias_estado ON transferencias(estado);
CREATE INDEX idx_transferencias_fecha ON transferencias(fecha_transferencia DESC);
CREATE INDEX idx_detalle_transferencias_trans ON detalle_transferencias(transferencia_id);

-- Restricción: no se puede transferir a la misma sucursal
ALTER TABLE transferencias 
ADD CONSTRAINT check_sucursales_diferentes 
CHECK (sucursal_origen_id != sucursal_destino_id);

-- Función para generar folio automático
CREATE OR REPLACE FUNCTION generate_folio_transferencia()
RETURNS TRIGGER AS $$
DECLARE
  new_folio VARCHAR(20);
  year_part VARCHAR(4);
  count_part INTEGER;
BEGIN
  -- Obtener el año actual
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Contar transferencias del año actual
  SELECT COALESCE(COUNT(*) + 1, 1)
  INTO count_part
  FROM transferencias
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Generar folio: TRANS-2026-001
  new_folio := 'TRANS-' || year_part || '-' || LPAD(count_part::TEXT, 3, '0');
  
  NEW.folio := new_folio;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar folio automáticamente
CREATE TRIGGER trigger_generate_folio_transferencia
BEFORE INSERT ON transferencias
FOR EACH ROW
WHEN (NEW.folio IS NULL OR NEW.folio = '')
EXECUTE FUNCTION generate_folio_transferencia();
