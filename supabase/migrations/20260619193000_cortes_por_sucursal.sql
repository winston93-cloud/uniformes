-- Cortes de caja por sucursal (cada tienda con sus ventas liquidadas)

ALTER TABLE public.cortes
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id);

UPDATE public.cortes
SET sucursal_id = (SELECT id FROM public.sucursales WHERE codigo = 'MAT-MAD' LIMIT 1)
WHERE sucursal_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cortes_sucursal ON public.cortes(sucursal_id);

COMMENT ON COLUMN public.cortes.sucursal_id IS 'Tienda a la que pertenece el corte de caja';
