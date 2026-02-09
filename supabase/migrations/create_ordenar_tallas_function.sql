-- Función para ordenar tallas: números primero (orden numérico), luego letras (orden alfabético)
CREATE OR REPLACE FUNCTION obtener_tallas_ordenadas()
RETURNS TABLE (
    id uuid,
    nombre text,
    orden integer,
    activo boolean,
    created_at timestamptz,
    updated_at timestamptz
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    id,
    nombre,
    orden,
    activo,
    created_at,
    updated_at
  FROM tallas
  ORDER BY 
    -- 1. Separar números de letras (números primero = 0, letras después = 1)
    CASE 
      WHEN nombre ~ '^[0-9]+$' THEN 0  -- Es solo números
      ELSE 1  -- Contiene letras o caracteres especiales
    END,
    -- 2. Si es número, ordenar numéricamente
    CASE 
      WHEN nombre ~ '^[0-9]+$' THEN nombre::integer
      ELSE 999999  -- Valor alto para que las letras vayan después
    END,
    -- 3. Ordenar alfabéticamente (para letras como XS, S, M, L, XL)
    nombre ASC;
$$;

-- Permitir acceso público a la función
GRANT EXECUTE ON FUNCTION obtener_tallas_ordenadas() TO anon, authenticated;

-- Comentario
COMMENT ON FUNCTION obtener_tallas_ordenadas() IS 'Retorna tallas ordenadas: números primero (1,2,3...10,11...), luego letras (L,M,S,XL,XS)';
