-- Quitar de SUC-WIN costos fantasma (stock 0) de prendas que no son winston/educativo.
-- Origen: bug antiguo que creaba costos en todas las sucursales al dar de alta en matriz.

DELETE FROM costos c
USING prendas p, sucursales s
WHERE c.prenda_id = p.id
  AND c.sucursal_id = s.id
  AND s.codigo = 'SUC-WIN'
  AND NOT (
    LOWER(p.nombre) LIKE '%winston%'
    OR LOWER(p.nombre) LIKE '%educativo%'
  )
  AND COALESCE(c.stock, 0) = 0;
