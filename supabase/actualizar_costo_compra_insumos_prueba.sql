-- Datos de prueba: asigna $100.00 MXN de costo de compra por presentación a todos los insumos.
-- Útil para probar el módulo de producción semanal sin costos en cero.
-- Ejecutar en Supabase → SQL Editor (o psql) cuando lo necesites.
-- Para revertir manualmente, edita cada insumo en /insumos o restaura desde un backup.

UPDATE public.insumos
SET costo_compra = 100.00;

-- Verificación opcional:
-- SELECT id, codigo, nombre, costo_compra FROM public.insumos ORDER BY codigo;
