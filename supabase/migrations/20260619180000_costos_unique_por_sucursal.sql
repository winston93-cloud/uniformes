-- Stock por sucursal: una fila costo por (prenda, talla, sucursal)
ALTER TABLE public.costos DROP CONSTRAINT IF EXISTS costos_talla_id_prenda_id_key;

ALTER TABLE public.costos
  ADD CONSTRAINT costos_prenda_talla_sucursal_key UNIQUE (prenda_id, talla_id, sucursal_id);

COMMENT ON CONSTRAINT costos_prenda_talla_sucursal_key ON public.costos IS
  'Permite inventario independiente por sucursal para la misma prenda/talla';
