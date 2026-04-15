-- Permitir identificar cancelación parcial vs total en pedidos.
-- Se agrega estado CANCELADO_PARCIAL al CHECK de pedidos.estado.

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'CANCELADO', 'CANCELADO_PARCIAL'));

