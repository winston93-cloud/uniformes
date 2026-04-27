-- Tabla legacy `usuario` (PK usuario_id SMALLINT) usada por login_usuario y FKs antiguas.
-- No confundir con `public.usuarios` (UUID). Inferido de create_login_function.sql y REFERENCES en migraciones.
CREATE TABLE IF NOT EXISTS public.usuario (
  usuario_id SMALLSERIAL PRIMARY KEY,
  perfil_id SMALLINT,
  usuario_app VARCHAR(50),
  usuario_apm VARCHAR(50),
  usuario_nombre VARCHAR(50),
  usuario_username VARCHAR(20) NOT NULL,
  usuario_email VARCHAR(100),
  usuario_password VARCHAR(255) NOT NULL,
  nivel INTEGER DEFAULT 1
);
