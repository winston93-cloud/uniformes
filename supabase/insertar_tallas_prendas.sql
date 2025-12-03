-- Script para insertar tallas y prendas del inventario manual
-- Tallas: 6, 8, 10, 12, 14, 16, CH, M, G, XG
-- Prendas: Playera, Short Deportivo

-- 1. Insertar tallas que no existan
INSERT INTO tallas (nombre, orden, activo) VALUES
  ('6', 1, true),
  ('8', 2, true),
  ('10', 3, true),
  ('12', 4, true),
  ('14', 5, true),
  ('16', 6, true),
  ('CH', 7, true),
  ('M', 8, true),
  ('G', 9, true),
  ('XG', 10, true)
ON CONFLICT (nombre) DO NOTHING;

-- 2. Obtener o crear categoría "Deportivo" para las prendas
DO $$
DECLARE
  categoria_deportivo_id UUID;
BEGIN
  -- Buscar o crear categoría Deportivo
  SELECT id INTO categoria_deportivo_id 
  FROM categorias_prendas 
  WHERE nombre = 'Deportivo';
  
  IF categoria_deportivo_id IS NULL THEN
    INSERT INTO categorias_prendas (nombre, activo) 
    VALUES ('Deportivo', true)
    RETURNING id INTO categoria_deportivo_id;
  END IF;

  -- 3. Insertar prenda "Playera"
  INSERT INTO prendas (nombre, codigo, categoria_id, activo)
  VALUES ('Playera', 'PLA-001', categoria_deportivo_id, true)
  ON CONFLICT (codigo) DO UPDATE SET nombre = 'Playera';
  
  -- 4. Insertar prenda "Short Deportivo"
  INSERT INTO prendas (nombre, codigo, categoria_id, activo)
  VALUES ('Short Deportivo', 'SHO-001', categoria_deportivo_id, true)
  ON CONFLICT (codigo) DO UPDATE SET nombre = 'Short Deportivo';
END $$;

-- 5. Insertar relaciones prenda-talla con stock
-- Primero obtenemos los IDs de las prendas y tallas
DO $$
DECLARE
  playera_id UUID;
  short_id UUID;
  talla_6_id UUID;
  talla_8_id UUID;
  talla_10_id UUID;
  talla_12_id UUID;
  talla_14_id UUID;
  talla_16_id UUID;
  talla_ch_id UUID;
  talla_m_id UUID;
  talla_g_id UUID;
  talla_xg_id UUID;
BEGIN
  -- Obtener IDs de prendas
  SELECT id INTO playera_id FROM prendas WHERE codigo = 'PLA-001' OR nombre = 'Playera' LIMIT 1;
  SELECT id INTO short_id FROM prendas WHERE codigo = 'SHO-001' OR nombre = 'Short Deportivo' LIMIT 1;
  
  -- Obtener IDs de tallas
  SELECT id INTO talla_6_id FROM tallas WHERE nombre = '6';
  SELECT id INTO talla_8_id FROM tallas WHERE nombre = '8';
  SELECT id INTO talla_10_id FROM tallas WHERE nombre = '10';
  SELECT id INTO talla_12_id FROM tallas WHERE nombre = '12';
  SELECT id INTO talla_14_id FROM tallas WHERE nombre = '14';
  SELECT id INTO talla_16_id FROM tallas WHERE nombre = '16';
  SELECT id INTO talla_ch_id FROM tallas WHERE nombre = 'CH';
  SELECT id INTO talla_m_id FROM tallas WHERE nombre = 'M';
  SELECT id INTO talla_g_id FROM tallas WHERE nombre = 'G';
  SELECT id INTO talla_xg_id FROM tallas WHERE nombre = 'XG';
  
  -- Insertar costos para Playera
  IF playera_id IS NOT NULL THEN
    INSERT INTO costos (prenda_id, talla_id, stock_inicial, stock, precio_venta, precio_compra, activo) VALUES
      (playera_id, talla_6_id, 6, 6, 0, 0, true),
      (playera_id, talla_8_id, 24, 24, 0, 0, true),
      (playera_id, talla_10_id, 6, 6, 0, 0, true),
      (playera_id, talla_12_id, 14, 14, 0, 0, true),
      (playera_id, talla_14_id, 18, 18, 0, 0, true),
      (playera_id, talla_16_id, 9, 9, 0, 0, true),
      (playera_id, talla_ch_id, 6, 6, 0, 0, true),
      (playera_id, talla_m_id, 12, 12, 0, 0, true),
      (playera_id, talla_g_id, 15, 15, 0, 0, true),
      (playera_id, talla_xg_id, 5, 5, 0, 0, true)
    ON CONFLICT (prenda_id, talla_id) DO UPDATE SET
      stock = EXCLUDED.stock,
      stock_inicial = EXCLUDED.stock_inicial;
  END IF;
  
  -- Insertar costos para Short Deportivo
  IF short_id IS NOT NULL THEN
    INSERT INTO costos (prenda_id, talla_id, stock_inicial, stock, precio_venta, precio_compra, activo) VALUES
      (short_id, talla_6_id, 28, 28, 0, 0, true),
      (short_id, talla_8_id, 5, 5, 0, 0, true),
      (short_id, talla_10_id, 11, 11, 0, 0, true),
      (short_id, talla_12_id, 13, 13, 0, 0, true),
      (short_id, talla_14_id, 6, 6, 0, 0, true),
      (short_id, talla_16_id, 12, 12, 0, 0, true),
      (short_id, talla_ch_id, 4, 4, 0, 0, true),
      (short_id, talla_m_id, 7, 7, 0, 0, true),
      (short_id, talla_g_id, 4, 4, 0, 0, true),
      (short_id, talla_xg_id, 0, 0, 0, 0, true)
    ON CONFLICT (prenda_id, talla_id) DO UPDATE SET
      stock = EXCLUDED.stock,
      stock_inicial = EXCLUDED.stock_inicial;
  END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Tallas y prendas insertadas exitosamente con sus cantidades de stock';
END $$;

