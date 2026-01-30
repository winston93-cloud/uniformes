-- Función de autenticación que bypasea RLS
CREATE OR REPLACE FUNCTION login_usuario(
  p_username VARCHAR,
  p_password VARCHAR
)
RETURNS TABLE (
  usuario_id SMALLINT,
  perfil_id SMALLINT,
  usuario_app VARCHAR(50),
  usuario_apm VARCHAR(50),
  usuario_nombre VARCHAR(50),
  usuario_username VARCHAR(20),
  usuario_email VARCHAR(100),
  nivel INTEGER
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.usuario_id,
    u.perfil_id,
    u.usuario_app,
    u.usuario_apm,
    u.usuario_nombre,
    u.usuario_username,
    u.usuario_email,
    u.nivel
  FROM usuario u
  WHERE u.usuario_username = p_username
    AND u.usuario_password = p_password
  LIMIT 1;
END;
$$;

-- Dar permisos de ejecución a anon y authenticated
GRANT EXECUTE ON FUNCTION login_usuario(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION login_usuario(VARCHAR, VARCHAR) TO authenticated;
