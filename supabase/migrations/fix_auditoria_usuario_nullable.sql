-- Hacer que usuario_id sea NULLABLE en auditoria
-- Permite auditar operaciones sin usuario asignado

ALTER TABLE auditoria 
ALTER COLUMN usuario_id DROP NOT NULL;

COMMENT ON COLUMN auditoria.usuario_id IS 
'ID del usuario que realizó la operación. NULL si no hay usuario asignado.';
