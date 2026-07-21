-- Conjuntos: pantalón + chamarra → precio de conjunto por talla (Winston / Educativo)

CREATE TABLE IF NOT EXISTS public.conjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(40),
  prenda_a_id UUID NOT NULL REFERENCES public.prendas(id) ON DELETE RESTRICT,
  prenda_b_id UUID NOT NULL REFERENCES public.prendas(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conjuntos_prendas_distintas CHECK (prenda_a_id <> prenda_b_id),
  CONSTRAINT conjuntos_par_unico UNIQUE (prenda_a_id, prenda_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS conjuntos_codigo_uidx
  ON public.conjuntos (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE TABLE IF NOT EXISTS public.conjunto_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conjunto_id UUID NOT NULL REFERENCES public.conjuntos(id) ON DELETE CASCADE,
  talla_id UUID NOT NULL REFERENCES public.tallas(id) ON DELETE RESTRICT,
  precio_mayoreo NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_menudeo NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conjunto_precios_unico UNIQUE (conjunto_id, talla_id)
);

CREATE INDEX IF NOT EXISTS conjunto_precios_conjunto_idx ON public.conjunto_precios (conjunto_id);
CREATE INDEX IF NOT EXISTS conjuntos_activo_idx ON public.conjuntos (activo);

COMMENT ON TABLE public.conjuntos IS
  'Define pares de prendas (ej. pants + chamarra) que al venderse misma talla usan precio de conjunto.';
COMMENT ON TABLE public.conjunto_precios IS
  'Precio de conjunto por talla; vacío/0 en un campo no aplica esa talla.';

ALTER TABLE public.conjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conjunto_precios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conjuntos_all ON public.conjuntos;
CREATE POLICY conjuntos_all ON public.conjuntos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS conjunto_precios_all ON public.conjunto_precios;
CREATE POLICY conjunto_precios_all ON public.conjunto_precios FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conjuntos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conjunto_precios TO anon, authenticated;

-- Seed: CONJUNTO PANTS WINSTON (PANTS WINSTON + CHAMARRA WINSTON)
INSERT INTO public.conjuntos (id, nombre, codigo, prenda_a_id, prenda_b_id, activo, notas)
VALUES (
  'a1111111-1111-4111-8111-111111111101',
  'CONJUNTO PANTS WINSTON',
  'CJ-PANTS-WIN',
  '5856a99c-aae8-45b8-98be-dfe361067d7d',
  '2faab56c-b4ed-44d9-bc85-28864fd23651',
  true,
  'Pantalón pants + chamarra pants Winston, misma talla'
)
ON CONFLICT (prenda_a_id, prenda_b_id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    codigo = EXCLUDED.codigo,
    activo = true,
    notas = EXCLUDED.notas,
    updated_at = now();

-- Seed: CONJUNTO PANTS EDUCATIVO
INSERT INTO public.conjuntos (id, nombre, codigo, prenda_a_id, prenda_b_id, activo, notas)
VALUES (
  'a1111111-1111-4111-8111-111111111102',
  'CONJUNTO PANTS EDUCATIVO',
  'CJ-PANTS-EDU',
  '28d34eef-79cc-4b13-a753-06db97505ce3',
  'b2bee8fd-1834-4cb0-86de-fe6b080e729c',
  true,
  'Pantalón pants + chamarra pants Educativo, misma talla'
)
ON CONFLICT (prenda_a_id, prenda_b_id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    codigo = EXCLUDED.codigo,
    activo = true,
    notas = EXCLUDED.notas,
    updated_at = now();

-- Precios Winston (lista impresa)
INSERT INTO public.conjunto_precios (conjunto_id, talla_id, precio_mayoreo, precio_menudeo, precio_venta)
VALUES
  ('a1111111-1111-4111-8111-111111111101', 'b007fcda-2a13-4ebb-a0e0-240f19a2e814', 840, 840, 840), -- 6
  ('a1111111-1111-4111-8111-111111111101', '46f25f5e-5438-4c7a-8d50-faf46167443a', 880, 880, 880), -- 10
  ('a1111111-1111-4111-8111-111111111101', 'dc0d2dee-1a66-4c6d-a650-d31cdf778118', 920, 920, 920), -- 16
  ('a1111111-1111-4111-8111-111111111101', 'aff04417-c6e1-44f9-b7a9-eb21af84d72c', 970, 970, 970), -- 32
  ('a1111111-1111-4111-8111-111111111101', '3980ae7e-768c-4dc0-83bf-fc86f9fa8aaf', 1020, 1020, 1020), -- 36
  ('a1111111-1111-4111-8111-111111111101', '0677d1d0-e7f7-4920-8769-cfffa3b7586c', 1040, 1040, 1040) -- ESPECIAL
ON CONFLICT (conjunto_id, talla_id) DO UPDATE
SET precio_mayoreo = EXCLUDED.precio_mayoreo,
    precio_menudeo = EXCLUDED.precio_menudeo,
    precio_venta = EXCLUDED.precio_venta,
    updated_at = now();

-- Precios Educativo (lista impresa: 1=3→800, 5→820, 7=9→880, ESPECIAL→1040)
INSERT INTO public.conjunto_precios (conjunto_id, talla_id, precio_mayoreo, precio_menudeo, precio_venta)
VALUES
  ('a1111111-1111-4111-8111-111111111102', '316ae4ad-01c0-4fc6-ad19-607d03988141', 800, 800, 800), -- 1
  ('a1111111-1111-4111-8111-111111111102', '380fb295-478a-405d-9e48-b201b1e14b36', 800, 800, 800), -- 3
  ('a1111111-1111-4111-8111-111111111102', 'b33cf977-def7-4c9f-b40b-baa1ea41a05d', 820, 820, 820), -- 5
  ('a1111111-1111-4111-8111-111111111102', '86b7e9a0-fab7-4a33-8ed2-6e009d802b1a', 880, 880, 880), -- 7
  ('a1111111-1111-4111-8111-111111111102', '111a772b-004e-421c-8df1-dc1c6fe2baf7', 880, 880, 880), -- 9
  ('a1111111-1111-4111-8111-111111111102', '0677d1d0-e7f7-4920-8769-cfffa3b7586c', 1040, 1040, 1040) -- ESPECIAL
ON CONFLICT (conjunto_id, talla_id) DO UPDATE
SET precio_mayoreo = EXCLUDED.precio_mayoreo,
    precio_menudeo = EXCLUDED.precio_menudeo,
    precio_venta = EXCLUDED.precio_venta,
    updated_at = now();
