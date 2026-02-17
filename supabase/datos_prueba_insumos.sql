-- ============================================
-- DATOS DE PRUEBA PARA SISTEMA DE UNIFORMES
-- Módulo: Insumos Necesarios para Producción
-- ============================================

-- Limpiar datos de prueba anteriores (opcional, comentar si no quieres borrar)
-- DELETE FROM detalle_pedidos WHERE pedido_id IN (SELECT id FROM pedidos WHERE estado = 'PEDIDO');
-- DELETE FROM pedidos WHERE estado = 'PEDIDO';
-- DELETE FROM prenda_talla_insumos;
-- DELETE FROM costos WHERE prenda_id IN (SELECT id FROM prendas WHERE codigo LIKE 'TEST-%');
-- DELETE FROM prendas WHERE codigo LIKE 'TEST-%';
-- DELETE FROM insumos WHERE codigo LIKE 'TEST-%';
-- DELETE FROM alumnos WHERE referencia LIKE 'TEST-%';

-- ============================================
-- 1. PRESENTACIONES (Unidades de Medida)
-- ============================================
INSERT INTO presentaciones (nombre, descripcion, activo)
VALUES 
  ('Pieza', 'Unidad individual', true),
  ('Metro', 'Metro lineal', true),
  ('Kilo', 'Kilogramo', true),
  ('Rollo', 'Rollo completo', true),
  ('Bolsa', 'Bolsa con múltiples unidades', true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- 2. INSUMOS (Materiales para fabricación)
-- ============================================
INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-BOT-001', 
  'Botones Blancos', 
  'Botones plásticos blancos 15mm', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Pieza'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-TEL-BL', 
  'Tela Blanca', 
  'Tela de algodón blanca premium', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Metro'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-TEL-AZ', 
  'Tela Azul Marino', 
  'Tela de algodón azul marino', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Metro'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-CIE-001', 
  'Cierre Metálico', 
  'Cierre metálico 20cm', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Pieza'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-HIL-BL', 
  'Hilo Blanco', 
  'Hilo de coser blanco resistente', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Metro'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-CUE-001', 
  'Cuello Polo', 
  'Cuello tipo polo blanco', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Pieza'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (codigo, nombre, descripcion, presentacion_id, cantidad_por_presentacion, activo)
SELECT 
  'TEST-ETI-001', 
  'Etiqueta Winston', 
  'Etiqueta bordada con logo', 
  p.id, 
  1, 
  true
FROM presentaciones p WHERE p.nombre = 'Pieza'
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- 3. CATEGORÍAS DE PRENDAS
-- ============================================
INSERT INTO categorias_prendas (nombre, activo)
VALUES ('Uniformes Diarios', true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- 4. PRENDAS
-- ============================================
INSERT INTO prendas (codigo, nombre, descripcion, categoria_id, activo)
SELECT 
  'TEST-POLO-01', 
  'Camisa Polo Blanca', 
  'Camisa tipo polo manga corta color blanco', 
  c.id, 
  true
FROM categorias_prendas c WHERE c.nombre = 'Uniformes Diarios'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO prendas (codigo, nombre, descripcion, categoria_id, activo)
SELECT 
  'TEST-PANT-01', 
  'Pantalón Azul Marino', 
  'Pantalón formal azul marino', 
  c.id, 
  true
FROM categorias_prendas c WHERE c.nombre = 'Uniformes Diarios'
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- 5. COSTOS (Prenda-Talla con Precio y Stock)
-- ============================================
-- Camisa Polo - Tallas 8, 10, 12
INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
SELECT 
  p.id, 
  t.id, 
  250.00, 
  0, 
  0, 
  true
FROM prendas p, tallas t 
WHERE p.codigo = 'TEST-POLO-01' 
  AND t.nombre IN ('8', '10', '12')
ON CONFLICT (prenda_id, talla_id) DO NOTHING;

-- Pantalón - Tallas 8, 10, 12
INSERT INTO costos (prenda_id, talla_id, precio_venta, stock_inicial, stock, activo)
SELECT 
  p.id, 
  t.id, 
  350.00, 
  0, 
  0, 
  true
FROM prendas p, tallas t 
WHERE p.codigo = 'TEST-PANT-01' 
  AND t.nombre IN ('8', '10', '12')
ON CONFLICT (prenda_id, talla_id) DO NOTHING;

-- ============================================
-- 6. PRENDA_TALLA_INSUMOS (Configuración de Insumos)
-- ============================================

-- CAMISA POLO TALLA 8
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 3
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '8' AND i.codigo = 'TEST-BOT-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1.8
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '8' AND i.codigo = 'TEST-TEL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 0.3
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '8' AND i.codigo = 'TEST-HIL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '8' AND i.codigo = 'TEST-CUE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '8' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- CAMISA POLO TALLA 10
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 3
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10' AND i.codigo = 'TEST-BOT-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 2.0
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10' AND i.codigo = 'TEST-TEL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 0.35
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10' AND i.codigo = 'TEST-HIL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10' AND i.codigo = 'TEST-CUE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- CAMISA POLO TALLA 12
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 3
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12' AND i.codigo = 'TEST-BOT-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 2.2
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12' AND i.codigo = 'TEST-TEL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 0.4
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12' AND i.codigo = 'TEST-HIL-BL'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12' AND i.codigo = 'TEST-CUE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- PANTALÓN TALLA 8
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '8' AND i.codigo = 'TEST-CIE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1.5
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '8' AND i.codigo = 'TEST-TEL-AZ'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '8' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- PANTALÓN TALLA 10
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '10' AND i.codigo = 'TEST-CIE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1.7
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '10' AND i.codigo = 'TEST-TEL-AZ'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '10' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- PANTALÓN TALLA 12
INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '12' AND i.codigo = 'TEST-CIE-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1.9
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '12' AND i.codigo = 'TEST-TEL-AZ'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

INSERT INTO prenda_talla_insumos (prenda_id, talla_id, insumo_id, cantidad)
SELECT p.id, t.id, i.id, 1
FROM prendas p, tallas t, insumos i
WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '12' AND i.codigo = 'TEST-ETI-001'
ON CONFLICT (prenda_id, talla_id, insumo_id) DO NOTHING;

-- ============================================
-- 7. ALUMNOS (Clientes de Prueba)
-- ============================================
INSERT INTO alumnos (nombre, referencia, grado, grupo, telefono, email, activo)
VALUES 
  ('Juan Pérez García', 'TEST-ALU-001', '4to', 'A', '5551234567', 'juan@test.com', true),
  ('María López Sánchez', 'TEST-ALU-002', '5to', 'B', '5557654321', 'maria@test.com', true),
  ('Pedro Ramírez Torres', 'TEST-ALU-003', '6to', 'A', '5559876543', 'pedro@test.com', true)
ON CONFLICT (referencia) DO NOTHING;

-- ============================================
-- 8. PEDIDOS PENDIENTES (Estado: PEDIDO)
-- ============================================

-- Pedido 1: Juan Pérez - 5 Polos Talla 10
INSERT INTO pedidos (alumno_id, tipo_cliente, estado, subtotal, total, notas)
SELECT 
  a.id,
  'alumno',
  'PEDIDO',
  1250.00,
  1250.00,
  'PEDIDO DE PRUEBA - 5 camisas polo talla 10'
FROM alumnos a
WHERE a.referencia = 'TEST-ALU-001'
ON CONFLICT DO NOTHING
RETURNING id;

-- Obtener ID del pedido anterior y agregar detalle
WITH ultimo_pedido AS (
  SELECT id FROM pedidos 
  WHERE alumno_id = (SELECT id FROM alumnos WHERE referencia = 'TEST-ALU-001')
    AND estado = 'PEDIDO'
  ORDER BY created_at DESC 
  LIMIT 1
),
costo_polo_10 AS (
  SELECT c.id FROM costos c
  JOIN prendas p ON c.prenda_id = p.id
  JOIN tallas t ON c.talla_id = t.id
  WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '10'
)
INSERT INTO detalle_pedidos (pedido_id, costo_id, cantidad, precio_unitario, subtotal)
SELECT up.id, cp.id, 5, 250.00, 1250.00
FROM ultimo_pedido up, costo_polo_10 cp
ON CONFLICT DO NOTHING;

-- Pedido 2: María López - 3 Pantalones Talla 8
INSERT INTO pedidos (alumno_id, tipo_cliente, estado, subtotal, total, notas)
SELECT 
  a.id,
  'alumno',
  'PEDIDO',
  1050.00,
  1050.00,
  'PEDIDO DE PRUEBA - 3 pantalones talla 8'
FROM alumnos a
WHERE a.referencia = 'TEST-ALU-002'
ON CONFLICT DO NOTHING;

WITH ultimo_pedido AS (
  SELECT id FROM pedidos 
  WHERE alumno_id = (SELECT id FROM alumnos WHERE referencia = 'TEST-ALU-002')
    AND estado = 'PEDIDO'
  ORDER BY created_at DESC 
  LIMIT 1
),
costo_pant_8 AS (
  SELECT c.id FROM costos c
  JOIN prendas p ON c.prenda_id = p.id
  JOIN tallas t ON c.talla_id = t.id
  WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '8'
)
INSERT INTO detalle_pedidos (pedido_id, costo_id, cantidad, precio_unitario, subtotal)
SELECT up.id, cp.id, 3, 350.00, 1050.00
FROM ultimo_pedido up, costo_pant_8 cp
ON CONFLICT DO NOTHING;

-- Pedido 3: Pedro Ramírez - 2 Polos Talla 12 + 2 Pantalones Talla 12
INSERT INTO pedidos (alumno_id, tipo_cliente, estado, subtotal, total, notas)
SELECT 
  a.id,
  'alumno',
  'PEDIDO',
  1200.00,
  1200.00,
  'PEDIDO DE PRUEBA - Uniforme completo talla 12'
FROM alumnos a
WHERE a.referencia = 'TEST-ALU-003'
ON CONFLICT DO NOTHING;

-- Detalle: 2 Polos Talla 12
WITH ultimo_pedido AS (
  SELECT id FROM pedidos 
  WHERE alumno_id = (SELECT id FROM alumnos WHERE referencia = 'TEST-ALU-003')
    AND estado = 'PEDIDO'
  ORDER BY created_at DESC 
  LIMIT 1
),
costo_polo_12 AS (
  SELECT c.id FROM costos c
  JOIN prendas p ON c.prenda_id = p.id
  JOIN tallas t ON c.talla_id = t.id
  WHERE p.codigo = 'TEST-POLO-01' AND t.nombre = '12'
)
INSERT INTO detalle_pedidos (pedido_id, costo_id, cantidad, precio_unitario, subtotal)
SELECT up.id, cp.id, 2, 250.00, 500.00
FROM ultimo_pedido up, costo_polo_12 cp
ON CONFLICT DO NOTHING;

-- Detalle: 2 Pantalones Talla 12
WITH ultimo_pedido AS (
  SELECT id FROM pedidos 
  WHERE alumno_id = (SELECT id FROM alumnos WHERE referencia = 'TEST-ALU-003')
    AND estado = 'PEDIDO'
  ORDER BY created_at DESC 
  LIMIT 1
),
costo_pant_12 AS (
  SELECT c.id FROM costos c
  JOIN prendas p ON c.prenda_id = p.id
  JOIN tallas t ON c.talla_id = t.id
  WHERE p.codigo = 'TEST-PANT-01' AND t.nombre = '12'
)
INSERT INTO detalle_pedidos (pedido_id, costo_id, cantidad, precio_unitario, subtotal)
SELECT up.id, cp.id, 2, 350.00, 700.00
FROM ultimo_pedido up, costo_pant_12 cp
ON CONFLICT DO NOTHING;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

-- Verificar datos creados
SELECT 'RESUMEN DE DATOS CREADOS' as info;

SELECT COUNT(*) as total_insumos FROM insumos WHERE codigo LIKE 'TEST-%';
SELECT COUNT(*) as total_prendas FROM prendas WHERE codigo LIKE 'TEST-%';
SELECT COUNT(*) as total_configuraciones FROM prenda_talla_insumos;
SELECT COUNT(*) as total_pedidos_pendientes FROM pedidos WHERE estado = 'PEDIDO';
SELECT COUNT(*) as total_detalles FROM detalle_pedidos;

-- Mostrar resumen de pedidos
SELECT 
  p.id,
  a.nombre as alumno,
  p.estado,
  p.total,
  p.notas,
  p.created_at
FROM pedidos p
LEFT JOIN alumnos a ON p.alumno_id = a.id
WHERE p.estado = 'PEDIDO'
ORDER BY p.created_at DESC;
