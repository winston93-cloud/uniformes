-- Crear tabla para catálogo de ciclos escolares
CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
  id SERIAL PRIMARY KEY,
  valor SMALLINT NOT NULL UNIQUE,
  nombre VARCHAR(20) NOT NULL UNIQUE,
  anio_inicio SMALLINT NOT NULL,
  anio_fin SMALLINT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  es_actual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_anios CHECK (anio_fin = anio_inicio + 1)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_ciclos_valor ON public.ciclos_escolares(valor);
CREATE INDEX IF NOT EXISTS idx_ciclos_activo ON public.ciclos_escolares(activo);
CREATE INDEX IF NOT EXISTS idx_ciclos_actual ON public.ciclos_escolares(es_actual);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_ciclo_escolar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ciclo_escolar_timestamp
  BEFORE UPDATE ON public.ciclos_escolares
  FOR EACH ROW
  EXECUTE FUNCTION update_ciclo_escolar_updated_at();

-- Trigger para asegurar que solo haya un ciclo actual
CREATE OR REPLACE FUNCTION asegurar_un_ciclo_actual()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.es_actual = true THEN
    -- Desactivar todos los demás ciclos como actuales
    UPDATE public.ciclos_escolares
    SET es_actual = false
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_un_ciclo_actual
  AFTER INSERT OR UPDATE OF es_actual ON public.ciclos_escolares
  FOR EACH ROW
  WHEN (NEW.es_actual = true)
  EXECUTE FUNCTION asegurar_un_ciclo_actual();

-- Insertar ciclos escolares existentes (últimos 5 años y próximo)
INSERT INTO public.ciclos_escolares (valor, nombre, anio_inicio, anio_fin, activo, es_actual) VALUES
(19, '2022-2023', 2022, 2023, true, false),
(20, '2023-2024', 2023, 2024, true, false),
(21, '2024-2025', 2024, 2025, true, false),
(22, '2025-2026', 2025, 2026, true, true), -- Ciclo actual
(23, '2026-2027', 2026, 2027, true, false)
ON CONFLICT (valor) DO NOTHING;

COMMENT ON TABLE public.ciclos_escolares IS 'Catálogo de ciclos escolares. Valor base: 2003 = 0, entonces 2025 = 22';
COMMENT ON COLUMN public.ciclos_escolares.valor IS 'Valor numérico del ciclo (año_inicio - 2003)';
COMMENT ON COLUMN public.ciclos_escolares.nombre IS 'Nombre del ciclo escolar (ej: 2025-2026)';
COMMENT ON COLUMN public.ciclos_escolares.es_actual IS 'Indica si es el ciclo escolar actual. Solo puede haber uno activo.';
