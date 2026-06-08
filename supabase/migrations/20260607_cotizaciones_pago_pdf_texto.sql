-- Texto de método/forma de pago tal como se imprimió en el PDF (crear o modificar cotización).

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS metodo_pago_pdf VARCHAR(200);
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS forma_pago_pdf VARCHAR(200);

COMMENT ON COLUMN public.cotizaciones.metodo_pago_pdf IS 'Descripción SAT método de pago en PDF al guardar';
COMMENT ON COLUMN public.cotizaciones.forma_pago_pdf IS 'Descripción SAT forma de pago en PDF al guardar';
