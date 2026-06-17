-- Tabla `alumno` sincronizada desde MySQL (hosting escolar).
-- PK numérica `alumno_id`; referencia única `alumno_ref`.
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

CREATE INDEX IF NOT EXISTS idx_alumno_ciclo_status ON public.alumno (alumno_ciclo_escolar, alumno_status);
CREATE INDEX IF NOT EXISTS idx_alumno_actualizacion ON public.alumno (alumno_actualizacion DESC);

COMMENT ON TABLE public.alumno IS 'Alumnos sincronizados desde MySQL; usados en cotizaciones/pedidos por alumno_id numérico.';
