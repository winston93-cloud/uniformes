-- Bloque 3: inventario maestro (Fase A — solo InsForge)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.categorias_prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tallas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) UNIQUE NOT NULL,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.presentaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.ubicaciones_almacenamiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(20),
  es_matriz BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  codigo VARCHAR(100) UNIQUE,
  descripcion TEXT,
  categoria_id UUID REFERENCES public.categorias_prendas(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  stock_minimo DECIMAL(10, 2) DEFAULT 0 CHECK (stock_minimo >= 0),
  ubicacion_almacenamiento_id UUID REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.costos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talla_id UUID NOT NULL REFERENCES public.tallas(id) ON DELETE CASCADE,
  prenda_id UUID NOT NULL REFERENCES public.prendas(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id),
  precio_venta DECIMAL(10, 2) NOT NULL DEFAULT 0,
  precio_compra DECIMAL(10, 2) DEFAULT 0,
  precio_mayoreo DECIMAL(10, 2) DEFAULT 0,
  precio_menudeo DECIMAL(10, 2) DEFAULT 0,
  stock_inicial INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  cantidad_venta INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 0,
  ubicacion_almacenamiento_id UUID REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(talla_id, prenda_id)
);

CREATE TABLE IF NOT EXISTS public.prenda_talla_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenda_id UUID NOT NULL REFERENCES public.prendas(id) ON DELETE CASCADE,
  talla_id UUID NOT NULL REFERENCES public.tallas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prenda_id, talla_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS public.compras_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad_comprada DECIMAL(10, 2) NOT NULL CHECK (cantidad_comprada > 0),
  costo_unitario DECIMAL(10, 2),
  costo_total DECIMAL(10, 2),
  proveedor VARCHAR(255),
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.costo_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  costo_id UUID NOT NULL REFERENCES public.costos(id) ON DELETE CASCADE,
  ubicacion_almacenamiento_id UUID NOT NULL REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT uq_costo_ubicacion UNIQUE (costo_id, ubicacion_almacenamiento_id)
);

CREATE TABLE IF NOT EXISTS public.insumo_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  ubicacion_almacenamiento_id UUID NOT NULL REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE RESTRICT,
  cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT uq_insumo_ubicacion UNIQUE (insumo_id, ubicacion_almacenamiento_id)
);
