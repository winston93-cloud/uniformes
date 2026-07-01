-- Borrador de cotización mientras se capturan partidas (antes de «Generar cotización»).
ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('en_proceso', 'emitido', 'aprobado', 'trabajando', 'terminado'));

COMMENT ON COLUMN cotizaciones.estado IS 'en_proceso = borrador; emitido → terminado = flujo operativo';
