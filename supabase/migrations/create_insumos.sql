-- Esquema actual de public.insumos (Supabase real: presentacion_id + stock, costo, ubicación).
-- Sustituye para la migración InsForge el fragmento legacy en supabase/crear_tabla_insumos.sql
-- que aún tenía presentacion VARCHAR; en producción esa columna se sustituyó por presentacion_id
-- (ver crear_tabla_presentaciones.sql: DROP presentacion, ADD presentacion_id).
--
-- Orden de migración: presentaciones y ubicaciones_almacenamiento deben existir antes.
CREATE TABLE IF NOT EXISTS public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  presentacion_id UUID REFERENCES public.presentaciones(id) ON DELETE RESTRICT,
  cantidad_por_presentacion DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unidad_medida VARCHAR(80) NOT NULL DEFAULT 'unidades',
  costo_compra DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_inicial DECIMAL(10, 2) DEFAULT 0,
  stock DECIMAL(10, 2) DEFAULT 0,
  ubicacion_almacenamiento_id UUID REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
