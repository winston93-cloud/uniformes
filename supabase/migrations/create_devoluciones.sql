-- =====================================================
-- SISTEMA DE DEVOLUCIONES
-- =====================================================
-- Permite registrar devoluciones completas, parciales,
-- cambios de talla, cambios de prenda, etc.
-- =====================================================

-- Tabla principal de devoluciones
CREATE TABLE IF NOT EXISTS devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio SERIAL UNIQUE NOT NULL,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id),
  usuario_id SMALLINT NOT NULL REFERENCES usuario(usuario_id),
  
  tipo_devolucion VARCHAR(20) NOT NULL CHECK (tipo_devolucion IN ('COMPLETA', 'PARCIAL', 'CAMBIO_TALLA', 'CAMBIO_PRENDA')),
  motivo VARCHAR(100) NOT NULL, -- 'Talla incorrecta', 'Defecto de fabricación', 'No le gustó', etc.
  observaciones TEXT,
  
  total_devolucion DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Monto total devuelto
  reembolso_aplicado BOOLEAN DEFAULT false, -- Si se hizo reembolso económico
  monto_reembolsado DECIMAL(10, 2) DEFAULT 0,
  
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESADA', 'CANCELADA')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Detalle de artículos devueltos
CREATE TABLE IF NOT EXISTS detalle_devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  detalle_pedido_id UUID NOT NULL, -- ID del detalle original del pedido
  
  -- Artículo devuelto
  prenda_id UUID NOT NULL REFERENCES prendas(id),
  talla_id UUID NOT NULL REFERENCES tallas(id),
  cantidad_devuelta INTEGER NOT NULL CHECK (cantidad_devuelta > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  
  -- Si es cambio: nuevo artículo
  es_cambio BOOLEAN DEFAULT false,
  prenda_cambio_id UUID REFERENCES prendas(id),
  talla_cambio_id UUID REFERENCES tallas(id),
  cantidad_cambio INTEGER,
  precio_cambio DECIMAL(10, 2),
  
  observaciones_detalle TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_devoluciones_pedido_id ON devoluciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_sucursal_id ON devoluciones(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_usuario_id ON devoluciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_created_at ON devoluciones(created_at);
CREATE INDEX IF NOT EXISTS idx_detalle_devoluciones_devolucion_id ON detalle_devoluciones(devolucion_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_devoluciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_devoluciones_updated_at
  BEFORE UPDATE ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION update_devoluciones_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE devoluciones IS 'Registro de todas las devoluciones de pedidos';
COMMENT ON COLUMN devoluciones.tipo_devolucion IS 'COMPLETA: devuelve todo | PARCIAL: devuelve algunos items | CAMBIO_TALLA: cambio por otra talla | CAMBIO_PRENDA: cambio por otra prenda';
COMMENT ON COLUMN devoluciones.motivo IS 'Razón de la devolución: Talla incorrecta, Defecto, No le gustó, etc.';
COMMENT ON COLUMN devoluciones.reembolso_aplicado IS 'Si se devolvió dinero al cliente';
COMMENT ON TABLE detalle_devoluciones IS 'Detalle de artículos devueltos y sus cambios (si aplica)';
COMMENT ON COLUMN detalle_devoluciones.es_cambio IS 'Si es true, hay artículo de cambio en prenda_cambio_id y talla_cambio_id';
