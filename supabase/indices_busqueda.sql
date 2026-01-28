-- ============================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE BÚSQUEDAS
-- Solución a: "Después de varios minutos se genera la búsqueda"
-- ============================================================
-- Problema: Búsquedas con ILIKE (%query%) sin índices causan
--           Full Table Scans en tablas grandes → Lentitud extrema
-- Solución: Índices GIN con pg_trgm para búsquedas rápidas
-- ============================================================

-- 1. Habilitar extensión pg_trgm (trigramas) si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. ÍNDICES PARA TABLA: alumno
-- ============================================================
-- Índice para búsqueda por nombre completo (alumno_nombre + alumno_app)
-- Usado en: searchAlumnos() - busca en nombre y apellido
CREATE INDEX IF NOT EXISTS idx_alumno_busqueda_nombre
ON alumno 
USING GIN ((alumno_nombre || ' ' || COALESCE(alumno_app, '')) gin_trgm_ops);

-- Índice para búsqueda por referencia (alumno_ref)
-- Usado en: searchAlumnos() - busca en referencia
CREATE INDEX IF NOT EXISTS idx_alumno_busqueda_ref
ON alumno 
USING GIN (alumno_ref gin_trgm_ops);

-- Índice compuesto para filtrar alumnos activos (común en WHERE)
CREATE INDEX IF NOT EXISTS idx_alumno_activo
ON alumno (activo)
WHERE activo = true;

-- ============================================================
-- 3. ÍNDICES PARA TABLA: externos
-- ============================================================
-- Índice para búsqueda por nombre
-- Usado en: searchExternos() - busca en nombre
CREATE INDEX IF NOT EXISTS idx_externos_busqueda_nombre
ON externos 
USING GIN (nombre gin_trgm_ops);

-- Índice para búsqueda por referencia
-- Usado en: searchExternos() - busca en referencia
CREATE INDEX IF NOT EXISTS idx_externos_busqueda_ref
ON externos 
USING GIN (referencia gin_trgm_ops);

-- Índice compuesto para filtrar externos activos (común en WHERE)
CREATE INDEX IF NOT EXISTS idx_externos_activo
ON externos (activo)
WHERE activo = true;

-- ============================================================
-- 4. ÍNDICES PARA TABLA: costos
-- ============================================================
-- Índice para búsqueda por prenda_id (FK más común)
-- Usado en: getCostosByPrenda() - busca costos por prenda
CREATE INDEX IF NOT EXISTS idx_costos_prenda_id
ON costos (prenda_id)
WHERE activo = true;

-- Índice compuesto para prenda_id + talla_id (queries comunes)
CREATE INDEX IF NOT EXISTS idx_costos_prenda_talla
ON costos (prenda_id, talla_id)
WHERE activo = true;

-- Índice para costos activos (usado en filtros)
CREATE INDEX IF NOT EXISTS idx_costos_activo
ON costos (activo)
WHERE activo = true;

-- ============================================================
-- 5. ÍNDICES PARA TABLA: prendas
-- ============================================================
-- Índice para búsqueda por nombre de prenda
-- Usado en: autocomplete de prendas en ModalCotizacion
CREATE INDEX IF NOT EXISTS idx_prendas_busqueda_nombre
ON prendas 
USING GIN (nombre gin_trgm_ops);

-- Índice para prendas activas (muy común en WHERE)
CREATE INDEX IF NOT EXISTS idx_prendas_activo
ON prendas (activo)
WHERE activo = true;

-- ============================================================
-- ANÁLISIS DE IMPACTO ESPERADO:
-- ============================================================
-- ANTES (Sin índices):
-- - Búsqueda "laura" en 10,000 alumnos: ~30-60 segundos (Full Table Scan)
-- - Race conditions: Respuestas llegan en desorden
-- - Sistema inutilizable
--
-- DESPUÉS (Con índices GIN + pg_trgm):
-- - Búsqueda "laura" en 10,000 alumnos: ~50-200ms (Índice GIN)
-- - Mejora: 150x - 1000x más rápido
-- - Búsquedas subsecuentes: ~10-50ms (caché de PostgreSQL)
--
-- NOTA: Los índices GIN con pg_trgm son especialmente efectivos para:
-- - Búsquedas ILIKE '%texto%' (cualquier posición)
-- - Búsquedas ILIKE 'texto%' (prefijo)
-- - Tolerancia a typos (similitud)
-- ============================================================

-- ============================================================
-- INSTRUCCIONES DE APLICACIÓN:
-- ============================================================
-- 1. Copiar este archivo completo
-- 2. Abrir Supabase Dashboard → SQL Editor
-- 3. Pegar contenido y ejecutar
-- 4. Verificar éxito: Mensaje "Success. No rows returned"
-- 5. Validar índices creados:
--    SELECT indexname, tablename 
--    FROM pg_indexes 
--    WHERE indexname LIKE 'idx_%busqueda%';
-- ============================================================

-- ============================================================
-- MANTENIMIENTO:
-- ============================================================
-- Los índices GIN se actualizan automáticamente con INSERT/UPDATE/DELETE
-- NO requieren mantenimiento manual
-- Espacio adicional: ~20-30% del tamaño de la tabla (aceptable)
-- ============================================================
