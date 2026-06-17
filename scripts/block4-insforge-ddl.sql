-- Bloque 4: clientes y datos fiscales (InsForge)
-- Orden: alumno → externos → datos_fiscales_cliente

CREATE TABLE IF NOT EXISTS public.alumno (
  alumno_id BIGINT PRIMARY KEY,
  alumno_ref TEXT NOT NULL,
  alumno_app TEXT,
  alumno_apm TEXT,
  alumno_nombre TEXT,
  alumno_nivel INTEGER,
  alumno_grado INTEGER,
  alumno_grupo INTEGER,
  alumno_nuevo_ingreso INTEGER,
  alumno_registro DATE,
  alumno_alta TIMESTAMPTZ,
  alumno_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  alumno_boleta INTEGER,
  mes INTEGER,
  alumno_status INTEGER DEFAULT 1,
  alumno_ciclo_escolar INTEGER,
  alumno_nombre_completo TEXT,
  CONSTRAINT alumno_ref_unique UNIQUE (alumno_ref)
);

CREATE TABLE IF NOT EXISTS public.externos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.datos_fiscales_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id TEXT,
  externo_id UUID REFERENCES public.externos(id) ON DELETE CASCADE,
  rfc TEXT NOT NULL,
  nombre_fiscal TEXT NOT NULL,
  regimen_fiscal TEXT NOT NULL,
  codigo_postal TEXT NOT NULL,
  uso_cfdi TEXT NOT NULL DEFAULT 'G03',
  email_fiscal TEXT,
  constancia_pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT datos_fiscales_un_solo_cliente CHECK (
    (alumno_id IS NOT NULL AND externo_id IS NULL)
    OR (alumno_id IS NULL AND externo_id IS NOT NULL)
  ),
  CONSTRAINT datos_fiscales_cp_len CHECK (char_length(trim(codigo_postal)) = 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_fiscales_alumno
  ON public.datos_fiscales_cliente (alumno_id)
  WHERE alumno_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_fiscales_externo
  ON public.datos_fiscales_cliente (externo_id)
  WHERE externo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alumno_ciclo_status ON public.alumno (alumno_ciclo_escolar, alumno_status);
CREATE INDEX IF NOT EXISTS idx_alumno_actualizacion ON public.alumno (alumno_actualizacion DESC);
CREATE INDEX IF NOT EXISTS idx_externos_activo ON public.externos (activo) WHERE activo = true;
