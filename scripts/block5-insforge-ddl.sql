-- Bloque 5: cotizaciones + pedidos + movimientos (InsForge — fase espejo)
-- Orden FK: sat_* → cotizaciones → detalle_cotizacion → pedidos → detalle_pedidos → movimientos → snapshot
-- alumno_id en cotizaciones/pedidos: TEXT (IDs numéricos MySQL / legado), sin FK a alumno.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== Catálogos SAT (Bloque 2, requeridos por cotizaciones) ==========
CREATE TABLE IF NOT EXISTS public.sat_metodos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave VARCHAR(10) NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  es_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sat_metodos_pago_clave_unique UNIQUE (clave)
);

CREATE TABLE IF NOT EXISTS public.sat_formas_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave VARCHAR(10) NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  es_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sat_formas_pago_clave_unique UNIQUE (clave)
);

INSERT INTO public.sat_metodos_pago (clave, descripcion, orden, es_default, activo)
VALUES
  ('PUE', 'EFECTIVO', 1, true, true),
  ('PPD', 'Pago en parcialidades o diferido', 2, false, true)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.sat_formas_pago (clave, descripcion, orden, es_default, activo)
VALUES
  ('01', 'EFECTIVO', 1, true, true),
  ('02', 'Cheque nominativo', 2, false, true),
  ('03', 'Transferencia electrónica de fondos', 3, false, true),
  ('04', 'Tarjeta de crédito', 4, false, true),
  ('08', 'Vales de despensa', 5, false, true),
  ('28', 'Tarjeta de débito', 6, false, true),
  ('99', 'Por definir', 99, false, true)
ON CONFLICT (clave) DO NOTHING;

-- ========== Cotizaciones ==========
CREATE SEQUENCE IF NOT EXISTS public.cotizacion_folio_seq;

CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(50) UNIQUE NOT NULL,
  alumno_id TEXT,
  externo_id UUID REFERENCES public.externos(id) ON DELETE SET NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('alumno', 'externo')),
  fecha_cotizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vigencia DATE,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  condiciones_pago TEXT,
  tiempo_entrega VARCHAR(100),
  fecha_entrega DATE,
  pdf_url TEXT,
  estado VARCHAR(20) DEFAULT 'emitido' CHECK (estado IN ('emitido', 'aprobado', 'trabajando', 'terminado')),
  incluir_iva BOOLEAN NOT NULL DEFAULT false,
  incluir_isr BOOLEAN NOT NULL DEFAULT false,
  insumos_trabajando_aplicado BOOLEAN NOT NULL DEFAULT false,
  metodo_pago_id UUID REFERENCES public.sat_metodos_pago(id) ON DELETE SET NULL,
  forma_pago_id UUID REFERENCES public.sat_formas_pago(id) ON DELETE SET NULL,
  metodo_pago_pdf VARCHAR(200),
  forma_pago_pdf VARCHAR(200),
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cotizaciones_check_cliente CHECK (
    (alumno_id IS NOT NULL AND externo_id IS NULL)
    OR (alumno_id IS NULL AND externo_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.detalle_cotizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  prenda_nombre VARCHAR(255) NOT NULL,
  talla VARCHAR(50) NOT NULL,
  color VARCHAR(100),
  especificaciones TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  orden INTEGER DEFAULT 1,
  tipo_precio_usado VARCHAR(10) NOT NULL DEFAULT 'menudeo' CHECK (tipo_precio_usado IN ('mayoreo', 'menudeo')),
  prenda_id UUID REFERENCES public.prendas(id) ON DELETE SET NULL,
  costo_id UUID REFERENCES public.costos(id) ON DELETE SET NULL,
  es_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Pedidos ==========
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(50),
  cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  alumno_id TEXT,
  externo_id UUID REFERENCES public.externos(id) ON DELETE SET NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('alumno', 'externo')),
  cliente_nombre VARCHAR(255),
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
  estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'CANCELADO', 'CANCELADO_PARCIAL')),
  subtotal DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  fecha_entrega TIMESTAMPTZ,
  fecha_liquidacion TIMESTAMPTZ,
  notas TEXT,
  observaciones TEXT,
  modalidad_pago VARCHAR(20) DEFAULT 'TOTAL' CHECK (modalidad_pago IN ('TOTAL', 'ANTICIPO')),
  efectivo_recibido DECIMAL(10, 2) DEFAULT 0,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pedidos_check_total_positivo CHECK (total > 0 AND subtotal > 0)
);

CREATE TABLE IF NOT EXISTS public.detalle_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  costo_id UUID REFERENCES public.costos(id) ON DELETE RESTRICT,
  prenda_id UUID REFERENCES public.prendas(id) ON DELETE RESTRICT,
  talla_id UUID REFERENCES public.tallas(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  pendiente INTEGER DEFAULT 0 CHECK (pendiente >= 0),
  especificaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  costo_id UUID NOT NULL REFERENCES public.costos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL,
  observaciones TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.snapshot_insumos_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detalle_pedido_id UUID NOT NULL REFERENCES public.detalle_pedidos(id) ON DELETE CASCADE,
  prenda_id UUID NOT NULL,
  talla_id UUID NOT NULL,
  insumo_id UUID NOT NULL,
  insumo_nombre VARCHAR(255) NOT NULL,
  cantidad_insumo DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
