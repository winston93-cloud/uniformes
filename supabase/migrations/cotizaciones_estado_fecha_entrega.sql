-- Migración: Cambio de estados en cotizaciones + fecha de entrega
-- Estados: Emitido, Aprobado, Trabajando, Terminado
-- Añade fecha_entrega como campo obligatorio opcional

-- 1. Añadir columna fecha_entrega
ALTER TABLE cotizaciones
ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

COMMENT ON COLUMN cotizaciones.fecha_entrega IS 'Fecha comprometida de entrega al cliente';

-- 2. Migrar estados existentes
-- vigente -> emitido, aceptada -> aprobado, rechazada -> emitido, vencida -> emitido
UPDATE cotizaciones
SET estado = CASE
  WHEN estado = 'vigente' THEN 'emitido'
  WHEN estado = 'aceptada' THEN 'aprobado'
  WHEN estado = 'rechazada' THEN 'emitido'
  WHEN estado = 'vencida' THEN 'emitido'
  ELSE 'emitido'
END
WHERE estado IN ('vigente', 'aceptada', 'rechazada', 'vencida');

-- 3. Eliminar constraint antiguo y añadir nuevo
ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('emitido', 'aprobado', 'trabajando', 'terminado'));

-- 4. Cambiar valor por defecto
ALTER TABLE cotizaciones ALTER COLUMN estado SET DEFAULT 'emitido';
