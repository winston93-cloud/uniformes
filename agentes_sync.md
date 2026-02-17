... (contenido anterior sin cambios) ...

**Instrucción para el Usuario:**
1. Copia el contenido del archivo `supabase/indices_busqueda.sql`.
2. Ve al Dashboard de Supabase -> SQL Editor.
3. Pega y ejecuta el script.

Sin este paso, el sistema seguirá lento. Una vez ejecutado, la mejora debería ser inmediata.

**Veredicto:** El código es sólido. Esperando ejecución del SQL por parte del usuario.

---

## 🚑 ROLLBACK DE EMERGENCIA & CORRECCIÓN DE ESTRATEGIA

**Fecha:** Martes 28 enero 2026
**Estado:** 🔴 **FALLO EN IMPLEMENTACIÓN**

**Reporte del Usuario:**
"Salió peor, ni siquiera busca en tipo de cliente".

**Diagnóstico del Coach:**
1.  **Posible Error de SDK:** Es muy probable que la versión de `@supabase/supabase-js` en el proyecto sea antigua y **no soporte** `builder.abortSignal()`. Esto hace que la función lance un error ("is not a function") y el `catch` devuelva un array vacío `[]`. Resultado: No busca nada.
2.  **Desajuste de Índices:** Creé un índice "inteligente" (concatenado) pero el código sigue buscando columna por columna (`OR`). Postgres no usará ese índice eficientemente para esta consulta específica. Seguimos con lentitud latente.

### 🛠️ PLAN DE RECUPERACIÓN (FIX REAL):

**Paso 1: Simplificar Frontend (Quitar AbortController)**
Vamos a eliminar la complejidad del `AbortController` por ahora. Si logramos que la BD responda en 50ms (con índices correctos), las condiciones de carrera (race conditions) serán imperceptibles para el usuario humano. Prioridad: Que funcione.

**Paso 2: Corregir Índices SQL**
Vamos a crear índices INDIVIDUALES para cada columna que se busca. Esto garantiza que la consulta `OR` actual use los índices.

**Instrucción para Sonnet:**
1.  **Revertir AbortController:** Eliminar la lógica de cancelación en `useAlumnos`, `useExternos` y `ModalCotizacion`. Volver a la versión simple que funcionaba (pero lenta).
2.  **Actualizar SQL:** Generar un nuevo script `supabase/indices_correctos.sql` con índices GIN para `alumno_nombre`, `alumno_app`, `alumno_apm` por separado.

**Acción:** Revertir cambios de frontend y generar SQL corregido.
