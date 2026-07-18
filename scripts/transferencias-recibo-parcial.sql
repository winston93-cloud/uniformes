-- Recepción parcial de transferencias
-- Cabecera: RECIBIDA_PARCIAL
-- Detalle: EN_TRANSITO | RECIBIDA | EN_TRANSITO_COMPLEMENTARIO

ALTER TABLE public.transferencias
  ALTER COLUMN estado TYPE VARCHAR(40);

ALTER TABLE public.transferencias
  DROP CONSTRAINT IF EXISTS transferencias_estado_check;

ALTER TABLE public.transferencias
  ADD CONSTRAINT transferencias_estado_check
  CHECK (estado IN ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDA', 'RECIBIDA_PARCIAL', 'CANCELADA'));

ALTER TABLE public.detalle_transferencias
  ADD COLUMN IF NOT EXISTS estado VARCHAR(40) DEFAULT 'EN_TRANSITO';

UPDATE public.detalle_transferencias
SET estado = 'EN_TRANSITO'
WHERE estado IS NULL OR TRIM(estado) = '';

-- Detalles de transferencias ya cerradas → RECIBIDA
UPDATE public.detalle_transferencias d
SET estado = 'RECIBIDA'
FROM public.transferencias t
WHERE d.transferencia_id = t.id
  AND t.estado = 'RECIBIDA'
  AND COALESCE(d.estado, '') <> 'RECIBIDA';
