-- Fase 0+1: sucursal por usuario en login; una sola matriz (taller).

ALTER TABLE public.usuarios_uniformes
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_uniformes_sucursal
  ON public.usuarios_uniformes (sucursal_id);

COMMENT ON COLUMN public.usuarios_uniformes.sucursal_id IS
  'Tienda por defecto al iniciar sesión. NULL = matriz (MAT-MAD) en la app.';

-- Matriz única: taller / origen de transferencias
UPDATE public.sucursales
SET es_matriz = (codigo = 'MAT-MAD')
WHERE codigo IN ('MAT-MAD', 'SUC-WIN');

-- Cuentas operativas
UPDATE public.usuarios_uniformes u
SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.codigo = 'SUC-WIN' AND lower(u.usuario) = 'winston';

UPDATE public.usuarios_uniformes u
SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.codigo = 'MAT-MAD' AND lower(u.usuario) IN ('uniformes', 'mario');

UPDATE public.usuarios_uniformes u
SET sucursal_id = s.id
FROM public.sucursales s
WHERE u.sucursal_id IS NULL AND s.codigo = 'MAT-MAD';
