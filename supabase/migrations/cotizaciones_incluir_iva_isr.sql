-- Opciones de IVA e ISR en cotizaciones (checkboxes en UI)
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS incluir_iva BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incluir_isr BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN cotizaciones.incluir_iva IS 'Si se suma IVA 16% al subtotal de partidas';
COMMENT ON COLUMN cotizaciones.incluir_isr IS 'Si se aplica retención ISR (sobre subtotal; tasa en app)';
