-- Agregar campos faltantes a la tabla pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS observaciones TEXT,
ADD COLUMN IF NOT EXISTS modalidad_pago VARCHAR(20) DEFAULT 'TOTAL' CHECK (modalidad_pago IN ('TOTAL', 'ANTICIPO')),
ADD COLUMN IF NOT EXISTS efectivo_recibido DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255);

-- Agregar campos faltantes a la tabla detalle_pedidos
ALTER TABLE detalle_pedidos 
ADD COLUMN IF NOT EXISTS prenda_id UUID REFERENCES prendas(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS talla_id UUID REFERENCES tallas(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS especificaciones TEXT,
ADD COLUMN IF NOT EXISTS pendiente INTEGER DEFAULT 0 CHECK (pendiente >= 0);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_prenda ON detalle_pedidos(prenda_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_talla ON detalle_pedidos(talla_id);

