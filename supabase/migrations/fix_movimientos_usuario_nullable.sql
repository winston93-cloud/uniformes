-- Hacer que usuario_id sea NULLABLE en movimientos
-- Permite registrar movimientos sin usuario asignado

ALTER TABLE movimientos 
ALTER COLUMN usuario_id DROP NOT NULL;

COMMENT ON COLUMN movimientos.usuario_id IS 
'ID del usuario que realizó el movimiento. NULL si no hay usuario asignado.';
