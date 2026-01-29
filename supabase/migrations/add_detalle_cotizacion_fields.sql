-- Migración: Agregar campos de control de precio a detalle_cotizacion
-- Fecha: 2025-01-29
-- Descripción: Permite rastrear el tipo de precio usado y la referencia a prenda/costo para cada partida

-- Agregar tipo_precio_usado (mayoreo/menudeo)
ALTER TABLE detalle_cotizacion 
ADD COLUMN IF NOT EXISTS tipo_precio_usado VARCHAR(10) DEFAULT 'menudeo' NOT NULL;

-- Agregar referencia a prenda (NULL si es manual)
ALTER TABLE detalle_cotizacion 
ADD COLUMN IF NOT EXISTS prenda_id UUID REFERENCES prendas(id) ON DELETE SET NULL;

-- Agregar referencia a costo (NULL si es manual)
ALTER TABLE detalle_cotizacion 
ADD COLUMN IF NOT EXISTS costo_id UUID REFERENCES costos(id) ON DELETE SET NULL;

-- Agregar flag para indicar si es partida manual
ALTER TABLE detalle_cotizacion 
ADD COLUMN IF NOT EXISTS es_manual BOOLEAN DEFAULT false NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN detalle_cotizacion.tipo_precio_usado IS 'Tipo de precio aplicado: mayoreo o menudeo';
COMMENT ON COLUMN detalle_cotizacion.prenda_id IS 'Referencia a la prenda (NULL si es partida manual)';
COMMENT ON COLUMN detalle_cotizacion.costo_id IS 'Referencia al costo específico usado (NULL si es partida manual)';
COMMENT ON COLUMN detalle_cotizacion.es_manual IS 'Indica si la partida fue creada manualmente (cotización directa)';

-- Índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_detalle_tipo_precio ON detalle_cotizacion(tipo_precio_usado);
CREATE INDEX IF NOT EXISTS idx_detalle_prenda_id ON detalle_cotizacion(prenda_id);
CREATE INDEX IF NOT EXISTS idx_detalle_costo_id ON detalle_cotizacion(costo_id);
CREATE INDEX IF NOT EXISTS idx_detalle_es_manual ON detalle_cotizacion(es_manual);

-- Constraint para validar tipo_precio_usado
ALTER TABLE detalle_cotizacion 
ADD CONSTRAINT chk_tipo_precio_usado 
CHECK (tipo_precio_usado IN ('mayoreo', 'menudeo'));
