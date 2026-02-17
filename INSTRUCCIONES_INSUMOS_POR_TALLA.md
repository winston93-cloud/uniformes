# 🧵 Insumos por Talla - Instrucciones de Instalación

## Funcionalidad Nueva

Ahora puedes **asignar insumos específicos a cada talla** de una prenda.

Por ejemplo:
- **Camisa Polo - Talla 10:**
  - 3 botones
  - 2 metros de tela blanca  
  - 1 cuello

Esto te permite:
✅ Calcular costos precisos por talla
✅ Gestionar inventario de manera más exacta
✅ Saber exactamente qué materiales necesitas para cada prenda

## Instalación

### Paso 1: Crear la tabla en Supabase

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/crear_tabla_prenda_talla_insumos.sql`
4. Haz clic en **Run** para ejecutar el SQL

O alternativamente, desde la terminal:

```bash
# Desde la carpeta sistema-uniformes/
psql -h [TU-HOST].supabase.com -p 5432 -U postgres -d postgres -f supabase/crear_tabla_prenda_talla_insumos.sql
```

### Paso 2: Verificar que funcionó

1. En Supabase, ve a **Table Editor**
2. Deberías ver la nueva tabla: `prenda_talla_insumos`
3. Verifica que tenga las columnas: `id`, `prenda_id`, `talla_id`, `insumo_id`, `cantidad`

## Cómo Usar

### 1. Editar una Prenda

- Ve al módulo de **Prendas**
- Haz clic en **Editar** en cualquier prenda
- Selecciona las tallas disponibles marcando los checkboxes

### 2. Gestionar Insumos por Talla

- Al lado de cada talla **seleccionada**, verás un botón con el ícono 🧵 y un número
- El número indica cuántos insumos tiene asignados esa talla
- Haz clic en el botón para abrir el modal de insumos

### 3. En el Modal de Insumos

**Agregar Insumo:**
1. Selecciona un insumo del dropdown
2. Ingresa la cantidad (respeta la unidad de medida del insumo)
3. Haz clic en "Agregar"

**Editar Cantidad:**
- Haz clic en el ícono de lápiz ✏️
- Modifica la cantidad
- Haz clic en ✓ para guardar

**Eliminar Insumo:**
- Haz clic en el ícono de papelera 🗑️
- Confirma la eliminación

## Ejemplo Completo

**Prenda:** CAMISA POLO BLANCA
**Talla:** 10

**Insumos:**
- Botón Blanco (12mm): 3 piezas
- Tela Blanca Polyester: 2 metros
- Cuello Polo Blanco: 1 pieza
- Hilo Blanco: 50 metros

Cada talla puede tener insumos completamente diferentes según sus necesidades.

## Notas Importantes

- ⚠️ Solo puedes agregar insumos a tallas que estén **seleccionadas** en la prenda
- 📊 El botón cambia de color cuando tiene insumos asignados (morado = con insumos, gris = sin insumos)
- 🔄 Los insumos se cargan automáticamente al abrir el modal
- ✨ No puedes agregar el mismo insumo dos veces a la misma talla (edítalo en su lugar)

## Solución de Problemas

**Error: "Tabla no existe"**
- Verifica que ejecutaste el SQL correctamente en Supabase

**No aparece el botón de insumos**
- Asegúrate de que estás **editando** una prenda existente (no creando una nueva)
- Verifica que la talla esté **seleccionada** (checkbox marcado)

**Error al guardar insumo**
- Verifica que el insumo esté activo
- Verifica que la cantidad sea mayor a 0
- No puedes agregar el mismo insumo dos veces

---

¿Preguntas? Revisa el código en:
- `components/ModalInsumosTalla.tsx` - Modal de gestión
- `lib/hooks/usePrendaTallaInsumos.ts` - Lógica de datos
- `supabase/crear_tabla_prenda_talla_insumos.sql` - Estructura de la base de datos
