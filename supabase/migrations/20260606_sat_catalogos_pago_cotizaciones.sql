-- Catálogos SAT: c_MetodoPago y c_FormaPago para cotizaciones / CFDI.

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

COMMENT ON TABLE public.sat_metodos_pago IS 'Catálogo SAT c_MetodoPago (PUE, PPD, etc.)';
COMMENT ON TABLE public.sat_formas_pago IS 'Catálogo SAT c_FormaPago (01 Efectivo, 03 Transferencia, etc.)';

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS metodo_pago_id UUID REFERENCES public.sat_metodos_pago(id) ON DELETE SET NULL;
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS forma_pago_id UUID REFERENCES public.sat_formas_pago(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_metodo_pago ON public.cotizaciones(metodo_pago_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_forma_pago ON public.cotizaciones(forma_pago_id);

ALTER TABLE public.sat_metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sat_formas_pago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso total sat_metodos_pago" ON public.sat_metodos_pago;
CREATE POLICY "Permitir acceso total sat_metodos_pago" ON public.sat_metodos_pago
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total sat_formas_pago" ON public.sat_formas_pago;
CREATE POLICY "Permitir acceso total sat_formas_pago" ON public.sat_formas_pago
  FOR ALL USING (true) WITH CHECK (true);

-- Métodos de pago (SAT)
INSERT INTO public.sat_metodos_pago (clave, descripcion, orden, es_default, activo)
VALUES
  ('PUE', 'EFECTIVO', 1, true, true),
  ('PPD', 'Pago en parcialidades o diferido', 2, false, true)
ON CONFLICT (clave) DO NOTHING;

-- Formas de pago (SAT) — frecuentes en operación
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

UPDATE public.sat_metodos_pago SET es_default = (clave = 'PUE') WHERE es_default IS DISTINCT FROM (clave = 'PUE');
UPDATE public.sat_formas_pago SET es_default = (clave = '01') WHERE es_default IS DISTINCT FROM (clave = '01');
