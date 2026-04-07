-- Datos fiscales del receptor (SAT / CFDI 4.0) vinculados a alumno (tabla alumnos) o externo.
CREATE TABLE IF NOT EXISTS datos_fiscales_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id) ON DELETE CASCADE,
  externo_id UUID REFERENCES externos(id) ON DELETE CASCADE,
  rfc TEXT NOT NULL,
  nombre_fiscal TEXT NOT NULL,
  regimen_fiscal TEXT NOT NULL,
  codigo_postal TEXT NOT NULL,
  uso_cfdi TEXT NOT NULL DEFAULT 'G03',
  email_fiscal TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT datos_fiscales_un_solo_cliente CHECK (
    (alumno_id IS NOT NULL AND externo_id IS NULL)
    OR (alumno_id IS NULL AND externo_id IS NOT NULL)
  ),
  CONSTRAINT datos_fiscales_cp_len CHECK (char_length(trim(codigo_postal)) = 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_fiscales_alumno
  ON datos_fiscales_cliente (alumno_id)
  WHERE alumno_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_fiscales_externo
  ON datos_fiscales_cliente (externo_id)
  WHERE externo_id IS NOT NULL;

ALTER TABLE datos_fiscales_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso total datos_fiscales_cliente" ON datos_fiscales_cliente;
CREATE POLICY "Permitir acceso total datos_fiscales_cliente" ON datos_fiscales_cliente
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE datos_fiscales_cliente IS 'Receptor fiscal SAT: RFC, nombre, régimen, CP, uso CFDI; un registro por alumno o externo (UUID).';
