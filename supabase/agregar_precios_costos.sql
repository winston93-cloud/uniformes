-- ============================================
-- Modificación: Agregar precios diferenciados en costos
-- Propósito: Permitir precio de compra, precio mayoreo y precio menudeo
-- ============================================

-- 1. Agregar columna precio_compra (costo de adquisición)
ALTER TABLE costos
ADD COLUMN IF NOT EXISTS precio_compra DECIMAL(10, 2) DEFAULT 0 CHECK (precio_compra >= 0);

-- 2. Agregar columna precio_mayoreo (venta al por mayor)
ALTER TABLE costos
ADD COLUMN IF NOT EXISTS precio_mayoreo DECIMAL(10, 2) DEFAULT 0 CHECK (precio_mayoreo >= 0);

-- 3. Agregar columna precio_menudeo (venta al menudeo/detalle)
ALTER TABLE costos
ADD COLUMN IF NOT EXISTS precio_menudeo DECIMAL(10, 2) DEFAULT 0 CHECK (precio_menudeo >= 0);

-- Comentarios para documentación
COMMENT ON COLUMN costos.precio_compra IS 'Precio de compra o costo de adquisición del producto';
COMMENT ON COLUMN costos.precio_mayoreo IS 'Precio de venta al por mayor (pedidos grandes)';
COMMENT ON COLUMN costos.precio_menudeo IS 'Precio de venta al menudeo o detalle (venta individual)';

-- 4. Migrar datos existentes: copiar precio_venta a precio_menudeo
-- (Asumiendo que el precio_venta actual es el precio menudeo)
UPDATE costos 
SET precio_menudeo = precio_venta, 
    precio_mayoreo = precio_venta * 0.9  -- Sugerencia: mayoreo 10% más barato
WHERE precio_menudeo = 0 OR precio_mayoreo = 0;

-- 5. Crear índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_costos_precio_compra ON costos(precio_compra);
CREATE INDEX IF NOT EXISTS idx_costos_precio_mayoreo ON costos(precio_mayoreo);
CREATE INDEX IF NOT EXISTS idx_costos_precio_menudeo ON costos(precio_menudeo);

-- 6. Actualizar el trigger de updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_costos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_costos_updated_at ON costos;
CREATE TRIGGER trigger_costos_updated_at
  BEFORE UPDATE ON costos
  FOR EACH ROW
  EXECUTE FUNCTION update_costos_updated_at();

-- ============================================
-- NOTA: El campo precio_venta se mantiene por compatibilidad
-- pero ahora se usan precio_mayoreo y precio_menudeo
-- ============================================

-- Verificación: Ver estructura actualizada
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'costos'
-- ORDER BY ordinal_position;
