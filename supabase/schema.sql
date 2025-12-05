-- Schema completo para Sistema de Uniformes Winston Churchill
-- Base de datos: PostgreSQL (Supabase)

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  apellido_p VARCHAR(255),
  apellido_m VARCHAR(255),
  usuario VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  tipo INTEGER DEFAULT 1, -- 1: admin, 3: operador, 5: supervisor
  email VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Tallas
CREATE TABLE IF NOT EXISTS tallas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) UNIQUE NOT NULL,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Categorías de Prendas
CREATE TABLE IF NOT EXISTS categorias_prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Prendas
CREATE TABLE IF NOT EXISTS prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  codigo VARCHAR(100) UNIQUE,
  descripcion TEXT,
  categoria_id UUID REFERENCES categorias_prendas(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Costos (precio y stock por prenda y talla)
CREATE TABLE IF NOT EXISTS costos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talla_id UUID REFERENCES tallas(id) ON DELETE CASCADE,
  prenda_id UUID REFERENCES prendas(id) ON DELETE CASCADE,
  precio_venta DECIMAL(10, 2) NOT NULL DEFAULT 0,
  precio_compra DECIMAL(10, 2) DEFAULT 0,
  stock_inicial INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0 CHECK (stock >= 0), -- No permitir stock negativo
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(talla_id, prenda_id)
);

-- 5. Tabla de Alumnos
CREATE TABLE IF NOT EXISTS alumnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  referencia VARCHAR(50) UNIQUE, -- Código único del alumno
  grado VARCHAR(50),
  grupo VARCHAR(10),
  telefono VARCHAR(20),
  email VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabla de Clientes Externos
CREATE TABLE IF NOT EXISTS externos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabla de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  externo_id UUID REFERENCES externos(id) ON DELETE SET NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('alumno', 'externo')),
  estado VARCHAR(20) DEFAULT 'PEDIDO' CHECK (estado IN ('PEDIDO', 'ENTREGADO', 'LIQUIDADO', 'CANCELADO')),
  subtotal DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  fecha_entrega TIMESTAMP WITH TIME ZONE,
  fecha_liquidacion TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabla de Detalle de Pedidos
CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  costo_id UUID REFERENCES costos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabla de Movimientos de Inventario
CREATE TABLE IF NOT EXISTS movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  costo_id UUID REFERENCES costos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL, -- Positivo para ENTRADA/AJUSTE positivo, negativo para SALIDA/AJUSTE negativo
  observaciones TEXT,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Tabla de Cortes de Caja
CREATE TABLE IF NOT EXISTS cortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_ventas DECIMAL(10, 2) DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Tabla de Detalle de Cortes
CREATE TABLE IF NOT EXISTS detalle_cortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id UUID REFERENCES cortes(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_prendas_categoria ON prendas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_costos_talla ON costos(talla_id);
CREATE INDEX IF NOT EXISTS idx_costos_prenda ON costos(prenda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_alumno ON pedidos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_externo ON pedidos(externo_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_pedido ON detalle_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_costo ON movimientos(costo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tallas_updated_at BEFORE UPDATE ON tallas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categorias_prendas_updated_at BEFORE UPDATE ON categorias_prendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prendas_updated_at BEFORE UPDATE ON prendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_costos_updated_at BEFORE UPDATE ON costos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alumnos_updated_at BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_externos_updated_at BEFORE UPDATE ON externos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cortes_updated_at BEFORE UPDATE ON cortes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para generar referencia única de alumno
CREATE OR REPLACE FUNCTION generar_referencia_alumno()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referencia IS NULL OR NEW.referencia = '' THEN
    NEW.referencia := LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generar_referencia_alumno_trigger
  BEFORE INSERT ON alumnos
  FOR EACH ROW
  WHEN (NEW.referencia IS NULL OR NEW.referencia = '')
  EXECUTE FUNCTION generar_referencia_alumno();

-- Row Level Security (RLS) - Habilitar para todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tallas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_prendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cortes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (permitir todo por ahora, ajustar según necesidades)
CREATE POLICY "Allow all operations on tallas" ON tallas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on categorias_prendas" ON categorias_prendas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on prendas" ON prendas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on costos" ON costos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on alumnos" ON alumnos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on externos" ON externos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on pedidos" ON pedidos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on detalle_pedidos" ON detalle_pedidos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on movimientos" ON movimientos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on cortes" ON cortes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on detalle_cortes" ON detalle_cortes
  FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales de ejemplo (opcional)
INSERT INTO tallas (nombre, orden, activo) VALUES
  ('XS', 1, true),
  ('S', 2, true),
  ('M', 3, true),
  ('L', 4, true),
  ('XL', 5, true)
ON CONFLICT (nombre) DO NOTHING;

-- Datos iniciales de categorías de prendas
INSERT INTO categorias_prendas (nombre, activo) VALUES
  ('Camisas', true),
  ('Pantalones', true),
  ('Suéteres', true),
  ('Faldas', true),
  ('Deportivo', true),
  ('Accesorios', true)
ON CONFLICT (nombre) DO NOTHING;

-- Migración: Actualizar tabla prendas si ya existe con campo categoria VARCHAR
DO $$
BEGIN
  -- Si existe la columna categoria (VARCHAR) y no existe categoria_id, hacer migración
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prendas' AND column_name = 'categoria' 
    AND data_type = 'character varying'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prendas' AND column_name = 'categoria_id'
  ) THEN
    -- Agregar columna categoria_id
    ALTER TABLE prendas ADD COLUMN categoria_id UUID REFERENCES categorias_prendas(id) ON DELETE SET NULL;
    
    -- Migrar datos existentes (crear categorías si no existen y asociarlas)
    INSERT INTO categorias_prendas (nombre, activo)
    SELECT DISTINCT categoria, true
    FROM prendas
    WHERE categoria IS NOT NULL AND categoria != ''
    ON CONFLICT (nombre) DO NOTHING;
    
    -- Actualizar prendas con categoria_id basado en nombre
    UPDATE prendas p
    SET categoria_id = cp.id
    FROM categorias_prendas cp
    WHERE p.categoria = cp.nombre AND p.categoria IS NOT NULL;
    
    -- Eliminar columna antigua categoria
    ALTER TABLE prendas DROP COLUMN categoria;
    
    -- Crear índice si no existe
    CREATE INDEX IF NOT EXISTS idx_prendas_categoria ON prendas(categoria_id);
  END IF;
END $$;

-- Mensaje de éxito
DO $$
BEGIN
  RAISE NOTICE 'Schema creado exitosamente para Sistema de Uniformes Winston Churchill';
END $$;

