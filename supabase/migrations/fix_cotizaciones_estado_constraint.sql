-- Corrige 400 al actualizar estado desde la app (CHECK desactualizado o datos legacy).
-- IMPORTANTE: primero se quita el CHECK viejo; si no, el UPDATE falla (p. ej. filas con
-- 'emitido' mientras el constraint solo permitía vigente/aceptada/...).

-- 1) Quitar restricción antigua (si existe) para poder reescribir filas sin violar el CHECK previo
ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

-- 2) Normalizar todos los valores a los que usa la app
UPDATE cotizaciones
SET estado = CASE
  WHEN estado IN ('vigente', 'rechazada', 'vencida') THEN 'emitido'
  WHEN estado = 'aceptada' THEN 'aprobado'
  WHEN estado IN ('emitido', 'aprobado', 'trabajando', 'terminado') THEN estado
  ELSE 'emitido'
END;

-- 3) Asegurar NOT NULL en estado (por si hubo NULLs)
UPDATE cotizaciones SET estado = 'emitido' WHERE estado IS NULL;

-- 4) Nuevo CHECK
ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('emitido', 'aprobado', 'trabajando', 'terminado'));

ALTER TABLE cotizaciones ALTER COLUMN estado SET DEFAULT 'emitido';
