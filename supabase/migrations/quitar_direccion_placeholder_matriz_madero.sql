-- Quitar dirección placeholder del ticket y del catálogo de sucursales (Matriz Madero).
UPDATE sucursales
SET direccion = NULL
WHERE codigo = 'MAT-MAD'
  AND direccion = 'Calle Madero #123';
