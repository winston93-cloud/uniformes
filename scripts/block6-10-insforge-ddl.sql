-- Bloques 6–10 InsForge: usuario/usuarios, cortes, transferencias, devoluciones, auditoría

-- ========== Bloque 9: identidad operativa ==========
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

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  apellido_p VARCHAR(255),
  apellido_m VARCHAR(255),
  usuario VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  tipo INTEGER DEFAULT 1,
  email VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Bloque 8: cortes de caja ==========
CREATE TABLE IF NOT EXISTS public.cortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_ventas DECIMAL(10, 2) DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.detalle_cortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id UUID REFERENCES public.cortes(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Bloque 6: transferencias ==========
CREATE TABLE IF NOT EXISTS public.transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(20) UNIQUE NOT NULL,
  sucursal_origen_id UUID NOT NULL REFERENCES public.sucursales(id),
  sucursal_destino_id UUID NOT NULL REFERENCES public.sucursales(id),
  usuario_id SMALLINT REFERENCES public.usuario(usuario_id),
  fecha_transferencia TIMESTAMPTZ DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_sucursales_diferentes CHECK (sucursal_origen_id != sucursal_destino_id)
);

CREATE TABLE IF NOT EXISTS public.detalle_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id UUID NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  prenda_id UUID NOT NULL REFERENCES public.prendas(id),
  talla_id UUID NOT NULL REFERENCES public.tallas(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  costo_id UUID REFERENCES public.costos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Bloque 7: devoluciones ==========
CREATE SEQUENCE IF NOT EXISTS public.devoluciones_folio_seq;

CREATE TABLE IF NOT EXISTS public.devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio INTEGER NOT NULL UNIQUE DEFAULT nextval('public.devoluciones_folio_seq'),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id),
  usuario_id SMALLINT NOT NULL REFERENCES public.usuario(usuario_id),
  tipo_devolucion VARCHAR(20) NOT NULL CHECK (tipo_devolucion IN ('COMPLETA', 'PARCIAL', 'CAMBIO_TALLA', 'CAMBIO_PRENDA')),
  motivo VARCHAR(100) NOT NULL,
  observaciones TEXT,
  total_devolucion DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reembolso_aplicado BOOLEAN DEFAULT false,
  monto_reembolsado DECIMAL(10, 2) DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESADA', 'CANCELADA')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.detalle_devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID NOT NULL REFERENCES public.devoluciones(id) ON DELETE CASCADE,
  detalle_pedido_id UUID NOT NULL REFERENCES public.detalle_pedidos(id),
  prenda_id UUID NOT NULL REFERENCES public.prendas(id),
  talla_id UUID NOT NULL REFERENCES public.tallas(id),
  cantidad_devuelta INTEGER NOT NULL CHECK (cantidad_devuelta > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  es_cambio BOOLEAN DEFAULT false,
  prenda_cambio_id UUID REFERENCES public.prendas(id),
  talla_cambio_id UUID REFERENCES public.tallas(id),
  cantidad_cambio INTEGER,
  precio_cambio DECIMAL(10, 2),
  observaciones_detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========== Bloque 10: auditoría ==========
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla VARCHAR(100) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  registro_id UUID,
  registro_pk TEXT,
  registro_pk_col TEXT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id SMALLINT REFERENCES public.usuario(usuario_id),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
