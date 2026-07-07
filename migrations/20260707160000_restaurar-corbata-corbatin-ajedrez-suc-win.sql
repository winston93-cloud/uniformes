-- Restaurar en SUC-WIN: CORBATA, CORBATIN y PLAYERA DE AJEDREZ (catálogo Winston).
-- Copia tallas y precios desde MAT-MAD; stock y mínimo en 0. No modifica la matriz.

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
    LOWER(p.nombre) LIKE '%corbatin%'
    OR LOWER(p.nombre) = 'corbata'
    OR LOWER(p.nombre) LIKE '%ajedrez%'
  )
  AND COALESCE(c.activo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM costos cw
    WHERE cw.sucursal_id = sw.id
      AND cw.prenda_id = c.prenda_id
      AND cw.talla_id = c.talla_id
  );
