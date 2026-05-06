-- Ajuste: cantidad_por_presentacion debe iniciar en 0 (no 1) y permitir capturar después.
-- También normaliza registros existentes para que no queden con 1 por el default anterior.

ALTER TABLE public.insumos
  ALTER COLUMN cantidad_por_presentacion SET DEFAULT 0;

UPDATE public.insumos
SET cantidad_por_presentacion = 0
WHERE cantidad_por_presentacion IS NULL
   OR cantidad_por_presentacion <> 0;

