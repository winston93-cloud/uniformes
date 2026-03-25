-- Corrige 400 al actualizar estado desde la app (CHECK desactualizado o datos legacy).
-- Ejecutar en Supabase SQL Editor si al cambiar estatus ves error de restricción / 400.

-- 1) Normalizar valores antiguos a los que usa la app
UPDATE cotizaciones
SET estado = CASE
  WHEN estado IN ('vigente', 'rechazada', 'vencida') THEN 'emitido'
  WHEN estado = 'aceptada' THEN 'aprobado'
  WHEN estado IN ('emitido', 'aprobado', 'trabajando', 'terminado') THEN estado
  ELSE 'emitido'
END
WHERE estado IS NULL
   OR estado NOT IN ('emitido', 'aprobado', 'trabajando', 'terminado');

-- 2) Recrear constraint de estados
ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('emitido', 'aprobado', 'trabajando', 'terminado'));

ALTER TABLE cotizaciones ALTER COLUMN estado SET DEFAULT 'emitido';
