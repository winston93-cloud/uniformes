-- Script para insertar PLAYERA POLO con sus tallas asociadas
-- Las tallas se insertan solo si no existen (evita duplicados)

-- 1. Insertar tallas (solo si no existen)
INSERT INTO tallas (nombre, orden, activo) VALUES
  ('6', 6, true),
  ('8', 8, true),
  ('10', 10, true),
  ('12', 12, true),
  ('14', 14, true),
  ('16', 16, true),
  ('CH', 100, true),
  ('M', 101, true),
  ('G', 102, true),
  ('XG', 103, true)
ON CONFLICT (nombre) DO NOTHING;

-- 2. Obtener o crear la categoría (ajusta según necesites)
DO $$
DECLARE
  v_categoria_id UUID;
  v_prenda_id UUID;
  v_talla_id UUID;
BEGIN
  -- Obtener ID de categoría 'Deportivo' o crear si no existe
  SELECT id INTO v_categoria_id FROM categorias_prendas WHERE nombre = 'Deportivo';
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categorias_prendas (nombre, activo) VALUES ('Deportivo', true)
    RETURNING id INTO v_categoria_id;
  END IF;

  -- 3. Insertar prenda PLAYERA POLO si no existe
  INSERT INTO prendas (nombre, codigo, descripcion, categoria_id, activo)
  VALUES ('PLAYERA POLO', 'PP', 'Playera tipo polo', v_categoria_id, true)
  ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_prenda_id;
  
  -- Si la prenda ya existía, obtener su ID
  IF v_prenda_id IS NULL THEN
    SELECT id INTO v_prenda_id FROM prendas WHERE codigo = 'PP';
  END IF;

  -- 4. Asociar tallas con la prenda en la tabla costos (solo si no existen)
  -- Talla 6
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '6';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla 8
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '8';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla 10
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '10';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla 12
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '12';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla 14
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '14';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla 16
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = '16';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla CH
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = 'CH';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla M
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = 'M';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla G
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = 'G';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  -- Talla XG
  SELECT id INTO v_talla_id FROM tallas WHERE nombre = 'XG';
  INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
  VALUES (v_prenda_id, v_talla_id, 0.00, 0, 0, true)
  ON CONFLICT (talla_id, prenda_id) DO NOTHING;

  RAISE NOTICE 'PLAYERA POLO insertada exitosamente con sus tallas asociadas';
END $$;

