-- Empresas opcionales para clasificar prendas del catálogo (vista «Por empresa»).
-- Aplica a ambas cuentas (Winston / Uniformes): comparten el mismo catálogo de prendas.

CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_nombre_unique UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS empresas_activo_idx ON public.empresas (activo);
CREATE INDEX IF NOT EXISTS empresas_nombre_idx ON public.empresas (nombre);

COMMENT ON TABLE public.empresas IS
  'Empresa / cliente externo opcional asociada a modelos del catálogo de prendas.';

ALTER TABLE public.prendas
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prendas_empresa_id_idx ON public.prendas (empresa_id);

COMMENT ON COLUMN public.prendas.empresa_id IS
  'Opcional: empresa a la que corresponde el modelo. NULL = sin empresa.';

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_all ON public.empresas;
CREATE POLICY empresas_all ON public.empresas
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO anon, authenticated, project_admin;

-- Empresa de prueba solicitada por Mario
INSERT INTO public.empresas (nombre, activo)
VALUES ('prueba', true)
ON CONFLICT (nombre) DO NOTHING;
