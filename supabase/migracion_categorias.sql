-- 1. Crear tabla de Categorías de Prendas
CREATE TABLE IF NOT EXISTS categorias_prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar columna categoria_id a la tabla prendas
ALTER TABLE prendas ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_prendas(id) ON DELETE SET NULL;

-- 3. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_prendas_categoria ON prendas(categoria_id);

-- 4. Migrar datos existentes: crear categorías desde los valores existentes en prendas.categoria
INSERT INTO categorias_prendas (nombre, activo)
SELECT DISTINCT categoria, true
FROM prendas
WHERE categoria IS NOT NULL AND categoria != ''
ON CONFLICT (nombre) DO NOTHING;

-- 5. Actualizar prendas con categoria_id basado en el nombre de la categoría
UPDATE prendas p
SET categoria_id = cp.id
FROM categorias_prendas cp
WHERE p.categoria = cp.nombre AND p.categoria IS NOT NULL;

-- 6. Insertar categorías iniciales si no existen
INSERT INTO categorias_prendas (nombre, activo) VALUES
  ('Camisas', true),
  ('Pantalones', true),
  ('Suéteres', true),
  ('Faldas', true),
  ('Deportivo', true),
  ('Accesorios', true)
ON CONFLICT (nombre) DO NOTHING;

-- 7. Eliminar columna antigua categoria (descomentar cuando estés seguro de que la migración funcionó)
-- ALTER TABLE prendas DROP COLUMN IF EXISTS categoria;

-- 8. Agregar trigger para updated_at
CREATE TRIGGER update_categorias_prendas_updated_at 
  BEFORE UPDATE ON categorias_prendas
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Habilitar RLS y crear política
ALTER TABLE categorias_prendas ENABLE ROW LEVEL SECURITY;

-- Eliminar política si existe antes de crearla
DROP POLICY IF EXISTS "Allow all operations on categorias_prendas" ON categorias_prendas;

CREATE POLICY "Allow all operations on categorias_prendas" 
  ON categorias_prendas
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

