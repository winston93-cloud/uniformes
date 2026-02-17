-- Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(20),
  es_matriz BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE sucursales IS 'Catálogo de sucursales del sistema';
COMMENT ON COLUMN sucursales.codigo IS 'Código único de la sucursal (ej: MAT-MAD, MAT-CEN, PV-WIN)';
COMMENT ON COLUMN sucursales.nombre IS 'Nombre de la sucursal';
COMMENT ON COLUMN sucursales.es_matriz IS 'Indica si es la sucursal matriz (donde están los insumos)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_sucursales_activo ON sucursales(activo);
CREATE INDEX IF NOT EXISTS idx_sucursales_es_matriz ON sucursales(es_matriz) WHERE es_matriz = true;

-- Insertar sucursal matriz por defecto
INSERT INTO sucursales (codigo, nombre, direccion, es_matriz, activo)
VALUES 
  ('MAT-MAD', 'Matriz Madero', 'Calle Madero #123', true, true)
ON CONFLICT (codigo) DO NOTHING;

-- Agregar columna sucursal_id a tabla costos (stock por sucursal)
ALTER TABLE costos 
ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Agregar columna sucursal_id a tabla pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Índices para filtrado por sucursal
CREATE INDEX IF NOT EXISTS idx_costos_sucursal ON costos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_sucursal ON pedidos(sucursal_id);

-- Comentarios
COMMENT ON COLUMN costos.sucursal_id IS 'Sucursal a la que pertenece este stock';
COMMENT ON COLUMN pedidos.sucursal_id IS 'Sucursal donde se realizó el pedido';

-- Actualizar registros existentes para que pertenezcan a la matriz
UPDATE costos 
SET sucursal_id = (SELECT id FROM sucursales WHERE codigo = 'MAT-MAD' LIMIT 1)
WHERE sucursal_id IS NULL;

UPDATE pedidos 
SET sucursal_id = (SELECT id FROM sucursales WHERE codigo = 'MAT-MAD' LIMIT 1)
WHERE sucursal_id IS NULL;

-- Hacer obligatorio el campo sucursal_id después de la actualización
ALTER TABLE costos ALTER COLUMN sucursal_id SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN sucursal_id SET NOT NULL;
