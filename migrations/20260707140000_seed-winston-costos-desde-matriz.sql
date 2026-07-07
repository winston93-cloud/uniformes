-- Alta de inventario Winston (SUC-WIN) para prendas winston/educativo.
-- Copia tallas y precios desde MAT-MAD; stock y mínimo en 0. No modifica la matriz.

-- 1) Insertar costos faltantes en SUC-WIN
INSERT INTO costos (
  talla_id,
  prenda_id,
  sucursal_id,
  precio_venta,
  precio_compra,
  precio_mayoreo,
  precio_menudeo,
  stock_inicial,
  stock,
  cantidad_venta,
  stock_minimo,
  ubicacion_almacenamiento_id,
  activo
)
SELECT
  c.talla_id,
  c.prenda_id,
  sw.id,
  c.precio_venta,
  c.precio_compra,
  c.precio_mayoreo,
  c.precio_menudeo,
  0,
  0,
  0,
  0,
  NULL,
  COALESCE(c.activo, true)
FROM costos c
JOIN sucursales sm ON c.sucursal_id = sm.id AND sm.codigo = 'MAT-MAD'
JOIN sucursales sw ON sw.codigo = 'SUC-WIN'
JOIN prendas p ON p.id = c.prenda_id
WHERE (
    LOWER(p.nombre) LIKE '%winston%'
    OR LOWER(p.nombre) LIKE '%educativo%'
  )
  AND COALESCE(c.activo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM costos cw
    WHERE cw.sucursal_id = sw.id
      AND cw.prenda_id = c.prenda_id
      AND cw.talla_id = c.talla_id
  );

-- 2) Alinear precios y poner stock/mínimo en 0 en costos ya existentes de SUC-WIN
UPDATE costos cw
SET
  precio_venta = cm.precio_venta,
  precio_compra = cm.precio_compra,
  precio_mayoreo = cm.precio_mayoreo,
  precio_menudeo = cm.precio_menudeo,
  stock = 0,
  stock_inicial = 0,
  stock_minimo = 0,
  updated_at = NOW()
FROM costos cm
JOIN sucursales sm ON cm.sucursal_id = sm.id AND sm.codigo = 'MAT-MAD'
JOIN sucursales sw ON sw.codigo = 'SUC-WIN'
JOIN prendas p ON p.id = cm.prenda_id
WHERE cw.sucursal_id = sw.id
  AND cw.prenda_id = cm.prenda_id
  AND cw.talla_id = cm.talla_id
  AND (
    LOWER(p.nombre) LIKE '%winston%'
    OR LOWER(p.nombre) LIKE '%educativo%'
  )
  AND COALESCE(cm.activo, true) = true;
