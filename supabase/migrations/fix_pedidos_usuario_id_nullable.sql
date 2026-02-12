-- Hacer que usuario_id sea NULLABLE en pedidos
-- Esto permite crear pedidos sin requerir un usuario existente en la tabla usuarios
-- Útil para sistemas legacy donde usuario_id es numérico y no UUID

-- Eliminar la constraint de foreign key si existe
ALTER TABLE pedidos 
DROP CONSTRAINT IF EXISTS pedidos_usuario_id_fkey;

-- Hacer la columna NULLABLE
ALTER TABLE pedidos 
ALTER COLUMN usuario_id DROP NOT NULL;

-- Recrear la constraint como NULLABLE (opcional)
ALTER TABLE pedidos
ADD CONSTRAINT pedidos_usuario_id_fkey 
FOREIGN KEY (usuario_id) 
REFERENCES usuarios(usuario_id)
ON DELETE SET NULL;

-- Comentario
COMMENT ON COLUMN pedidos.usuario_id IS 
'ID del usuario que creó el pedido. NULL si el sistema no tiene usuario asignado.';
