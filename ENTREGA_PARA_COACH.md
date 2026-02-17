# ENTREGA PARA REVISIÓN - AGENTE PLAYER

## 📝 CONTEXTO DEL PROYECTO

**Proyecto:** Sistema de Gestión de Uniformes - Winston Churchill  
**Stack Tecnológico:**
- **Frontend:** Next.js 14 (App Router) + React 19 + TypeScript
- **Base de datos:** Supabase (PostgreSQL)
- **Generación PDF:** jsPDF + jspdf-autotable
- **Autenticación:** Supabase Auth
- **Deployment:** (Preparado para Vercel)
- **Node:** >= 24.0.0

---

## 🎯 MÓDULO ACTUAL: SISTEMA DE COTIZACIONES

**Descripción:**  
Módulo para generar cotizaciones profesionales en PDF para alumnos y clientes externos, **sin afectar el inventario**. Incluye gestión de partidas, cálculo de totales, generación de folios automáticos y seguimiento de estado.

**Estado actual:** ⚠️ **FUNCIONAL PERO REQUIERE MEJORAS ABSOLUTAS**

El usuario solicita:
- **Mejoras en el flujo completo** del módulo
- **Normalización de las tablas** de base de datos
- **Optimización general** de arquitectura

---

## 📊 ARQUITECTURA ACTUAL DEL MÓDULO

### **Tablas de Base de Datos:**

#### 1. `cotizaciones`
```sql
- id: UUID (PK)
- folio: VARCHAR(50) UNIQUE (formato: COT-YYYYMM-0001)
- alumno_id: UUID (FK → alumnos)
- externo_id: UUID (FK → externos)
- tipo_cliente: ENUM('alumno', 'externo')
- fecha_cotizacion: DATE
- fecha_vigencia: DATE
- subtotal: DECIMAL(10,2)
- total: DECIMAL(10,2)
- observaciones: TEXT
- condiciones_pago: TEXT
- tiempo_entrega: VARCHAR(100)
- pdf_url: TEXT
- estado: ENUM('vigente', 'aceptada', 'rechazada', 'vencida')
- usuario_id: UUID (FK → usuarios)
- created_at, updated_at: TIMESTAMP
```

**Constraint:** `CHECK` que asegura alumno_id XOR externo_id (uno u otro, no ambos)

#### 2. `detalle_cotizacion`
```sql
- id: UUID (PK)
- cotizacion_id: UUID (FK → cotizaciones, ON DELETE CASCADE)
- prenda_nombre: VARCHAR(255)
- talla: VARCHAR(50)
- color: VARCHAR(100)
- especificaciones: TEXT
- cantidad: INTEGER
- precio_unitario: DECIMAL(10,2)
- subtotal: DECIMAL(10,2)
- orden: INTEGER
- created_at: TIMESTAMP
```

### **Función de Base de Datos:**

**`generar_folio_cotizacion()`**
- Genera folios secuenciales por mes
- Formato: `COT-YYYYMM-0001`
- Usa MAX() + 1 para siguiente número

---

## 💻 IMPLEMENTACIÓN ACTUAL

### **Archivo 1:** `/lib/types.ts` (Líneas 151-185)

**Interfaces TypeScript:**

```typescript
export interface Cotizacion {
  id: string;
  folio: string;
  alumno_id: string | null;
  externo_id: string | null;
  tipo_cliente: 'alumno' | 'externo';
  fecha_cotizacion: string;
  fecha_vigencia: string | null;
  subtotal: number;
  total: number;
  observaciones: string | null;
  condiciones_pago: string | null;
  tiempo_entrega: string | null;
  pdf_url: string | null;
  estado: 'vigente' | 'aceptada' | 'rechazada' | 'vencida';
  usuario_id: string | null;
  created_at?: string;
  updated_at?: string;
  alumno?: Alumno;
  externo?: Externo;
}

export interface DetalleCotizacion {
  id: string;
  cotizacion_id: string;
  prenda_nombre: string;
  talla: string;
  color: string | null;
  especificaciones: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  orden: number;
  created_at?: string;
}
```

---

### **Archivo 2:** `/lib/hooks/useCotizaciones.ts` (220 líneas)

**Hook personalizado para gestión de cotizaciones**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Cotizacion, DetalleCotizacion } from '@/lib/types';

export interface PartidaCotizacion {
  prenda_nombre: string;
  talla: string;
  color: string;
  especificaciones: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  orden: number;
}

export interface NuevaCotizacion {
  alumno_id?: string;
  externo_id?: string;
  tipo_cliente: 'alumno' | 'externo';
  fecha_vigencia?: string;
  observaciones?: string;
  condiciones_pago?: string;
  tiempo_entrega?: string;
  partidas: PartidaCotizacion[];
}

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener todas las cotizaciones
  const obtenerCotizaciones = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('cotizaciones')
        .select(`
          *,
          alumno:alumnos(*),
          externo:externos(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCotizaciones(data || []);
    } catch (err) {
      console.error('Error al obtener cotizaciones:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, []);

  // Obtener una cotización con su detalle
  const obtenerCotizacion = useCallback(async (id: string) => {
    try {
      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .select(`
          *,
          alumno:alumnos(*),
          externo:externos(*)
        `)
        .eq('id', id)
        .single();

      if (cotError) throw cotError;

      const { data: detalle, error: detError } = await supabase
        .from('detalle_cotizacion')
        .select('*')
        .eq('cotizacion_id', id)
        .order('orden', { ascending: true });

      if (detError) throw detError;

      return { cotizacion, detalle: detalle || [] };
    } catch (err) {
      console.error('Error al obtener cotización:', err);
      throw err;
    }
  }, []);

  // Generar folio automático
  const generarFolio = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generar_folio_cotizacion');
      if (error) throw error;
      return data as string;
    } catch (err) {
      console.error('Error al generar folio:', err);
      throw err;
    }
  };

  // Crear cotización
  const crearCotizacion = async (nuevaCotizacion: NuevaCotizacion) => {
    try {
      // 1. Generar folio
      const folio = await generarFolio();

      // 2. Calcular totales
      const subtotal = nuevaCotizacion.partidas.reduce((sum, p) => sum + p.subtotal, 0);
      const total = subtotal;

      // 3. Crear cotización
      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .insert([{
          folio,
          alumno_id: nuevaCotizacion.alumno_id || null,
          externo_id: nuevaCotizacion.externo_id || null,
          tipo_cliente: nuevaCotizacion.tipo_cliente,
          fecha_cotizacion: new Date().toISOString().split('T')[0],
          fecha_vigencia: nuevaCotizacion.fecha_vigencia || null,
          subtotal,
          total,
          observaciones: nuevaCotizacion.observaciones || null,
          condiciones_pago: nuevaCotizacion.condiciones_pago || '50% anticipo, 50% contra entrega',
          tiempo_entrega: nuevaCotizacion.tiempo_entrega || '5-7 días hábiles',
          estado: 'vigente',
        }])
        .select()
        .single();

      if (cotError) throw cotError;

      // 4. Crear partidas
      const partidas = nuevaCotizacion.partidas.map((p, index) => ({
        cotizacion_id: cotizacion.id,
        ...p,
        orden: index + 1,
      }));

      const { error: detError } = await supabase
        .from('detalle_cotizacion')
        .insert(partidas);

      if (detError) throw detError;

      await obtenerCotizaciones();
      return { data: cotizacion, error: null };
    } catch (err) {
      console.error('Error al crear cotizacion:', err);
      return { data: null, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Actualizar estado de cotización
  const actualizarEstado = async (id: string, estado: 'vigente' | 'aceptada' | 'rechazada' | 'vencida') => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado })
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Actualizar PDF URL
  const actualizarPdfUrl = async (id: string, pdfUrl: string) => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ pdf_url: pdfUrl })
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar PDF URL:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Eliminar cotización
  const eliminarCotizacion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      return { error: null };
    } catch (err) {
      console.error('Error al eliminar cotizacion:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  useEffect(() => {
    obtenerCotizaciones();
  }, [obtenerCotizaciones]);

  return {
    cotizaciones,
    cargando,
    error,
    obtenerCotizaciones,
    obtenerCotizacion,
    crearCotizacion,
    actualizarEstado,
    actualizarPdfUrl,
    eliminarCotizacion,
  };
}
```

**Funciones principales:**
- `obtenerCotizaciones()` - Lista todas con joins a alumnos/externos
- `obtenerCotizacion(id)` - Obtiene cotización + detalle
- `generarFolio()` - Llama a función RPC de Supabase
- `crearCotizacion(nuevaCotizacion)` - Crea cotización + partidas (⚠️ NO ES ATÓMICO)
- `actualizarEstado(id, estado)` - Cambia estado
- `actualizarPdfUrl(id, url)` - Guarda URL del PDF (pero nunca se usa)
- `eliminarCotizacion(id)` - Borra cotización (cascade al detalle)

---

### **Archivo 3:** `/components/ModalCotizacion.tsx` (893 líneas)

**Componente React monolítico para interfaz de cotizaciones**

Debido a la extensión (893 líneas), resumen de funcionalidades clave:

**Estructura:**
- 2 vistas con tabs: "Nueva Cotización" y "Historial"
- 17 estados de React (useState)
- Búsqueda de clientes con useEffect + debounce (300ms)
- Formulario multi-partida con tabla
- Generación de PDF inline con jsPDF
- Re-impresión de PDFs históricos

**Flujo de creación:**
1. Seleccionar tipo de cliente (alumno/externo)
2. Buscar y seleccionar cliente (autocomplete)
3. Agregar partidas (prenda, talla, color, cantidad, precio)
4. Llenar información adicional (vigencia, condiciones, observaciones)
5. Click "Generar" → `handleCrearCotizacion()`:
   - Llama `crearCotizacion()` del hook
   - Genera PDF con `generarPDF(folio)`
   - Descarga PDF con `pdf.save()`
   - Alert de éxito
   - Cambia a vista "Historial"

**Problemas de arquitectura:**
- 893 líneas en un solo componente
- Mezcla lógica de negocio, UI y generación de PDF
- Estilos inline everywhere
- Función `generarPDF()` duplicada (líneas 110-197 vs 268-314)
- No hay separación de concerns

---

### **Archivo 4:** `/supabase/crear_tablas_cotizaciones.sql` (172 líneas)

**Schema SQL completo:**

```sql
-- ============================================
-- MÓDULO: Sistema de Cotizaciones
-- ============================================

-- Tabla principal de cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Folio único y secuencial
  folio VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cliente (alumno o externo)
  alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
  externo_id UUID REFERENCES externos(id) ON DELETE SET NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('alumno', 'externo')),
  
  -- Fechas
  fecha_cotizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vigencia DATE,
  
  -- Montos
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Información adicional
  observaciones TEXT,
  condiciones_pago TEXT,
  tiempo_entrega VARCHAR(100),
  
  -- PDF generado
  pdf_url TEXT,
  
  -- Estado de la cotización
  estado VARCHAR(20) DEFAULT 'vigente' CHECK (estado IN ('vigente', 'aceptada', 'rechazada', 'vencida')),
  
  -- Usuario que creó la cotización
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: debe tener alumno_id O externo_id, no ambos ni ninguno
  CONSTRAINT check_cliente CHECK (
    (alumno_id IS NOT NULL AND externo_id IS NULL) OR
    (alumno_id IS NULL AND externo_id IS NOT NULL)
  )
);

-- Tabla de detalle de cotizaciones (partidas)
CREATE TABLE IF NOT EXISTS detalle_cotizacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con cotización
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  
  -- Información del producto/prenda
  prenda_nombre VARCHAR(255) NOT NULL,
  talla VARCHAR(50) NOT NULL,
  color VARCHAR(100),
  especificaciones TEXT,
  
  -- Cantidades y precios
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  
  -- Orden de las partidas
  orden INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio ON cotizaciones(folio);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_alumno ON cotizaciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_externo ON cotizaciones(externo_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha_cotizacion);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion ON detalle_cotizacion(cotizacion_id);

-- Función para generar folio automático
CREATE OR REPLACE FUNCTION generar_folio_cotizacion()
RETURNS TEXT AS $$
DECLARE
  anio TEXT;
  mes TEXT;
  siguiente_numero INTEGER;
  nuevo_folio TEXT;
BEGIN
  -- Obtener año y mes actual
  anio := TO_CHAR(CURRENT_DATE, 'YYYY');
  mes := TO_CHAR(CURRENT_DATE, 'MM');
  
  -- Obtener el siguiente número secuencial para este mes
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(folio FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO siguiente_numero
  FROM cotizaciones
  WHERE folio LIKE 'COT-' || anio || mes || '%';
  
  -- Generar folio con formato: COT-YYYYMM-0001
  nuevo_folio := 'COT-' || anio || mes || '-' || LPAD(siguiente_numero::TEXT, 4, '0');
  
  RETURN nuevo_folio;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security)
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cotizacion ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos pueden ver y crear cotizaciones (autenticados)
CREATE POLICY "Permitir lectura de cotizaciones" ON cotizaciones
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de cotizaciones" ON cotizaciones
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de cotizaciones" ON cotizaciones
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminación de cotizaciones" ON cotizaciones
    FOR DELETE USING (true);

CREATE POLICY "Permitir lectura de detalle_cotizacion" ON detalle_cotizacion
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de detalle_cotizacion" ON detalle_cotizacion
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de detalle_cotizacion" ON detalle_cotizacion
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminación de detalle_cotizacion" ON detalle_cotizacion
    FOR DELETE USING (true);
```

---

## 🐛 PROBLEMAS IDENTIFICADOS (Auto-revisión del Player)

### 🔴 **CRÍTICOS:**

#### 1. **Transacciones no atómicas**
**Ubicación:** `useCotizaciones.ts` líneas 102-152

**Problema:**
```typescript
// Paso 1: Insert cotización
const { data: cotizacion, error: cotError } = await supabase
  .from('cotizaciones')
  .insert([{...}])
  .single();

// Paso 2: Insert partidas (separado)
const { error: detError } = await supabase
  .from('detalle_cotizacion')
  .insert(partidas);
```

**Impacto:** Si el paso 2 falla, queda una cotización huérfana sin partidas.

**Escenario de falla:**
- Usuario crea cotización con 5 partidas
- Insert de cotización: ✅ Éxito
- Insert de partidas: ❌ Falla por timeout/red
- Resultado: Cotización existe pero sin productos
- No hay rollback automático

**¿Supabase soporta transacciones SQL desde el cliente?**

---

#### 2. **Race condition en generación de folio**
**Ubicación:** `crear_tablas_cotizaciones.sql` líneas 84-112

**Problema:**
```sql
SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM '[0-9]+$') AS INTEGER)), 0) + 1
```

**Impacto:** Dos usuarios simultáneos pueden obtener el mismo folio.

**Escenario de falla:**
- Usuario A llama `generarFolio()` → obtiene "COT-202601-0005"
- Usuario B llama `generarFolio()` (antes de que A inserte) → obtiene "COT-202601-0005"
- Usuario A inserta cotización: ✅
- Usuario B inserta cotización: ❌ Error de UNIQUE constraint

**Frontend no maneja este error:**
```typescript
const folio = await generarFolio(); // ¿Qué pasa si otro usuario ya usó ese folio?
```

**Solución conocida:** Usar secuencias de PostgreSQL, pero el folio tiene formato especial YYYYMM.

---

#### 3. **PDF se genera en cliente pero no se almacena**
**Ubicación:** `ModalCotizacion.tsx` líneas 109-249

**Problema:**
- Campo `pdf_url` existe en DB
- Función `actualizarPdfUrl()` existe en hook
- **Pero NUNCA se usa**

**Código actual:**
```typescript
const pdf = generarPDF(data.folio);
pdf.save(`Cotizacion-${data.folio}.pdf`); // Solo descarga local
// NO HAY: await actualizarPdfUrl(data.id, url);
```

**Impacto:**
- No hay registro del PDF generado
- Cada vez que se "re-imprime" se regenera desde cero
- Si cambian precios/datos, el PDF "histórico" cambia (inconsistencia)

**Preguntas:**
- ¿Debería guardarse en Supabase Storage?
- ¿O generar PDF en servidor (Edge Function)?
- ¿O guardar Base64 en DB?

---

### 🟠 **ALTOS:**

#### 4. **Duplicación de interface `PartidaCotizacion`**
**Ubicación:** `useCotizaciones.ts` línea 7-16 vs `types.ts` (no existe)

**Problema:**
```typescript
// En useCotizaciones.ts
export interface PartidaCotizacion { ... }

// En types.ts - NO EXISTE
```

**Impacto:** 
- Otros componentes no pueden importar `PartidaCotizacion` desde types
- Inconsistencia en organización
- Si `DetalleCotizacion` existe en types, `PartidaCotizacion` también debería

---

#### 5. **Validación con `alert()` primitivo**
**Ubicación:** `ModalCotizacion.tsx` múltiples líneas

**Ejemplos:**
```typescript
if (!partidaActual.prenda_nombre) {
  alert('Por favor completa todos los campos obligatorios');
  return;
}

if (!clienteSeleccionado) {
  alert('Por favor selecciona un cliente');
  return;
}
```

**Impacto:**
- UX pobre (bloquea navegador)
- No se puede testear
- No es accesible (screen readers)
- No hay feedback visual en el formulario

---

#### 6. **Búsqueda de clientes falla silenciosamente**
**Ubicación:** `ModalCotizacion.tsx` líneas 43-69

**Problema:**
```typescript
try {
  const { data, error } = await supabase.from(tabla).select('*')...
  if (error) throw error;
  setResultadosBusqueda(data || []);
} catch (err) {
  console.error('Error al buscar:', err); // Solo console
}
```

**Impacto:**
- Usuario escribe nombre
- Si falla la búsqueda (red caída), no aparece nada
- Usuario no sabe si no hay resultados o si hubo error
- No hay feedback visual

---

#### 7. **Cálculo de totales triplicado**
**Ubicación:** Múltiples archivos

**Problema:**
```typescript
// 1. En ModalCotizacion.tsx (componente)
const subtotal = partidas.reduce((sum, p) => sum + p.subtotal, 0);

// 2. En useCotizaciones.ts (hook)
const subtotal = nuevaCotizacion.partidas.reduce((sum, p) => sum + p.subtotal, 0);

// 3. Al agregar cada partida
subtotal: partidaActual.cantidad! * partidaActual.precio_unitario!
```

**Impacto:**
- No hay source of truth único
- Difícil de mantener
- Propenso a inconsistencias si cambia la lógica

---

#### 8. **Modelo de datos: `detalle_cotizacion` desnormalizado**
**Ubicación:** `crear_tablas_cotizaciones.sql` líneas 52-74

**Problema:**
```sql
prenda_nombre VARCHAR(255) NOT NULL,  -- ❌ String libre
talla VARCHAR(50) NOT NULL,           -- ❌ String libre
color VARCHAR(100),                   -- ❌ String libre

-- NO HAY:
-- prenda_id UUID REFERENCES prendas(id)
-- talla_id UUID REFERENCES tallas(id)
-- costo_id UUID REFERENCES costos(id)
```

**Justificación actual (snapshot approach):**
- "La cotización es una foto del momento"
- "Si cambias el precio de una prenda, cotizaciones viejas no se afectan"

**Pero esto causa problemas:**
- ❌ No puedes hacer reporte: "¿Cuántas Playeras Polo cotizamos este mes?"
- ❌ Typos: "Playera Polo" vs "playera polo" vs "Polo" → son diferentes
- ❌ No detectas si una prenda ya no existe
- ❌ No puedes convertir cotización en pedido automáticamente

**Opciones de normalización:**

**Opción A (actual):** Snapshot puro
- Mantener como está
- **Pros:** Simple, inmutable, histórico fiel
- **Contras:** Reportes imposibles, datos inconsistentes

**Opción B:** Normalización con FKs
```sql
ADD COLUMN prenda_id UUID REFERENCES prendas(id) ON DELETE RESTRICT
ADD COLUMN talla_id UUID REFERENCES tallas(id) ON DELETE RESTRICT
ADD COLUMN costo_id UUID REFERENCES costos(id) ON DELETE RESTRICT
```
- **Pros:** Reportes fáciles, integridad referencial
- **Contras:** No puedes borrar prendas con cotizaciones, histórico se afecta

**Opción C (híbrido - recomendación del Player):**
```sql
-- Mantener campos snapshot
prenda_nombre VARCHAR(255) NOT NULL,
talla VARCHAR(50) NOT NULL,
precio_unitario DECIMAL(10,2) NOT NULL,

-- AGREGAR FKs opcionales para trazabilidad
costo_id UUID REFERENCES costos(id) ON DELETE SET NULL,
-- Si se borra el costo, se mantiene el snapshot
```
- **Pros:** Lo mejor de ambos mundos
- **Contras:** Datos duplicados (redundancia controlada)

**¿Cuál opción recomienda el Coach?**

---

### 🟡 **MEDIOS:**

#### 9. **Componente monolítico de 893 líneas**
**Ubicación:** `ModalCotizacion.tsx` (todo el archivo)

**Problema:**
- Mezcla lógica de negocio, UI y generación PDF
- 17 estados de React
- 4 funciones grandes (100+ líneas cada una)
- Imposible testear unitariamente

**Debería separarse en:**
- `ModalCotizacion.tsx` (container)
- `FormularioCotizacion.tsx` (formulario)
- `ListaPartidas.tsx` (tabla de partidas)
- `HistorialCotizaciones.tsx` (tabla de historial)
- `generarPDFCotizacion.ts` (utility pura)
- `BuscadorClientes.tsx` (componente reutilizable)

---

#### 10. **Estilos inline everywhere**
**Ubicación:** `ModalCotizacion.tsx` todas las líneas

**Problema:**
```typescript
style={{
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  // ... 10 propiedades más
}}
```

**Impacto:**
- Código verboso (30-40% del componente son estilos)
- No reutilizable
- No se puede aplicar temas
- Difícil de mantener

**Debería usar:**
- CSS Modules
- Tailwind CSS (ya que es Next.js)
- Styled Components

---

#### 11. **No hay paginación en historial**
**Ubicación:** `useCotizaciones.ts` línea 35-57

**Problema:**
```typescript
const { data } = await supabase
  .from('cotizaciones')
  .select(`*`)
  .order('created_at', { ascending: false });
// NO HAY .range(from, to)
```

**Impacto:**
- Carga TODAS las cotizaciones al abrir modal
- Con 1000 cotizaciones → query lenta + UI pesada
- Desperdicio de recursos

**Debería tener:**
- Paginación o infinite scroll
- Límite inicial (ej: últimas 50)

---

#### 12. **Función `generarPDF()` duplicada**
**Ubicación:** `ModalCotizacion.tsx` líneas 110-197 vs 252-314

**Problema:**
- Dos implementaciones casi idénticas
- Una para cotización nueva
- Otra para re-imprimir histórica
- 70% del código es igual

**Debería:**
- Extraer a función pura
- Recibir datos como parámetros
- Reutilizar en ambos casos

---

#### 13. **No hay filtros en historial**
**Ubicación:** `ModalCotizacion.tsx` vista "historial"

**Problema:**
- Solo muestra tabla plana
- No se puede buscar por:
  - Folio
  - Cliente
  - Rango de fechas
  - Estado

**Con 500 cotizaciones es inutilizable.**

---

#### 14. **Estados como strings literales**
**Ubicación:** Múltiples archivos

**Problema:**
```typescript
estado: 'vigente' | 'aceptada' | 'rechazada' | 'vencida'
```

Repetido en:
- `types.ts`
- `useCotizaciones.ts`
- `crear_tablas_cotizaciones.sql`

**Debería ser:**
```typescript
// constants/cotizaciones.ts
export const ESTADOS_COTIZACION = {
  VIGENTE: 'vigente',
  ACEPTADA: 'aceptada',
  RECHAZADA: 'rechazada',
  VENCIDA: 'vencida',
} as const;

export type EstadoCotizacion = typeof ESTADOS_COTIZACION[keyof typeof ESTADOS_COTIZACION];
```

---

### 🔵 **BAJOS:**

#### 15. **Cero tests**
**Ubicación:** Todo el módulo

**Problema:**
- No existe ningún archivo `.test.ts` o `.spec.ts`
- Cobertura: 0%

**Tests críticos que deberían existir:**

```typescript
// useCotizaciones.test.ts
describe('crearCotizacion', () => {
  test('calcula subtotal correctamente', () => {})
  test('maneja error si falla insert de cotización', () => {})
  test('maneja error si falla insert de detalle', () => {})
  test('genera folio con formato correcto', () => {})
})

// generarPDF.test.ts
describe('generarPDF', () => {
  test('genera PDF con partidas correctas', () => {})
  test('formatea precios con 2 decimales', () => {})
  test('incluye información del cliente', () => {})
})

// ModalCotizacion.test.tsx
describe('ModalCotizacion', () => {
  test('valida campos requeridos antes de crear', () => {})
  test('calcula totales al agregar partidas', () => {})
  test('busca clientes con debounce', () => {})
})
```

---

#### 16. **Inconsistencia opcional vs nullable**
**Ubicación:** `types.ts`

**Problema:**
```typescript
created_at?: string;      // Opcional (puede no existir)
observaciones: string | null;  // Nullable (puede ser null)
```

**TypeScript diferencia:**
- `campo?: string` → puede ser `undefined` o no existir
- `campo: string | null` → siempre existe pero puede ser `null`

**En las respuestas de Supabase:**
- Campos NULL de DB → `null`
- Campos que no pediste en SELECT → `undefined`

**Debería ser consistente:**
```typescript
// Si la columna es nullable en DB:
observaciones: string | null;
created_at: string | null;

// O si prefieres optional everywhere:
observaciones?: string;
created_at?: string;
```

---

#### 17. **Formateo de fechas hardcodeado**
**Ubicación:** Múltiples archivos

**Problema:**
```typescript
new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-MX')
```

Repetido 5+ veces.

**Debería:**
```typescript
// utils/formatters.ts
export const formatearFecha = (fecha: string) => 
  new Date(fecha).toLocaleDateString('es-MX');
```

---

#### 18. **Magic numbers en estilos**
**Ubicación:** `ModalCotizacion.tsx`

**Problema:**
```typescript
fillColor: [102, 126, 234]  // ¿Qué color es?
background: '#667eea'         // ¿Brand color?
```

Repetido 10+ veces.

**Debería:**
```typescript
// constants/theme.ts
export const COLORS = {
  primary: '#667eea',
  primaryRgb: [102, 126, 234],
  // ...
};
```

---

## 🧪 TESTS EXISTENTES

**Cobertura de tests:** ❌ **0% - No hay tests**

**No existe:**
- `useCotizaciones.test.ts`
- `ModalCotizacion.test.tsx`
- `generarPDF.test.ts`

**Framework de testing:** ❓ No configurado (Next.js viene sin tests por defecto)

---

## 🔍 FLUJO ACTUAL COMPLETO

### **Flujo de creación de cotización (happy path):**

```
1. Usuario hace clic en "Cotizaciones" en Header
   ↓
2. ModalCotizacion.tsx se monta
   ↓
3. useCotizaciones() hook se inicializa
   → obtenerCotizaciones() ejecuta automáticamente (useEffect)
   → SELECT * FROM cotizaciones (SIN LÍMITE)
   ↓
4. Usuario selecciona tab "Nueva Cotización" (default)
   ↓
5. Usuario selecciona tipo cliente (alumno/externo)
   ↓
6. Usuario escribe en búsqueda
   → useEffect se dispara
   → Espera 300ms (debounce)
   → Query: SELECT * FROM alumnos WHERE nombre ILIKE '%búsqueda%' LIMIT 10
   ↓
7. Usuario selecciona cliente de resultados
   → setClienteSeleccionado(cliente)
   → setBusquedaCliente(cliente.nombre)
   ↓
8. Usuario llena formulario de partida
   - Prenda nombre (text input libre)
   - Talla (text input libre)
   - Color (text input libre)
   - Cantidad (number)
   - Precio unitario (number)
   - Especificaciones (textarea)
   ↓
9. Usuario hace clic "Agregar Partida"
   → Validación básica (if !prenda_nombre → alert)
   → Calcula subtotal: cantidad * precio_unitario
   → setPartidas([...partidas, nuevaPartida])
   ↓
10. (Usuario repite 8-9 para más partidas)
   ↓
11. Usuario llena info adicional (opcional)
   - Fecha vigencia
   - Condiciones de pago (default: "50% anticipo...")
   - Tiempo entrega (default: "5-7 días...")
   - Observaciones
   ↓
12. Usuario hace clic "Generar Cotización y Descargar PDF"
   → handleCrearCotizacion()
     ├─ Validación: if (!clienteSeleccionado) → alert; return;
     ├─ Validación: if (partidas.length === 0) → alert; return;
     ├─ setGenerando(true)
     ├─ Llama crearCotizacion(nuevaCotizacion)
     │   ├─ generarFolio() → RPC a Supabase
     │   │   └─ SELECT MAX(folio) WHERE folio LIKE 'COT-202601%'
     │   │   └─ RETURN 'COT-202601-0001' (o siguiente)
     │   ├─ Calcula subtotal: reduce(partidas)
     │   ├─ INSERT INTO cotizaciones (...) → obtiene ID
     │   ├─ INSERT INTO detalle_cotizacion (múltiples rows)
     │   └─ obtenerCotizaciones() (refresh lista)
     ├─ Si no hay error:
     │   ├─ generarPDF(data.folio)
     │   │   ├─ new jsPDF()
     │   │   ├─ doc.text(...) // Headers
     │   │   ├─ autoTable(...) // Tabla de partidas
     │   │   └─ return doc
     │   ├─ pdf.save(`Cotizacion-${folio}.pdf`)
     │   └─ alert('✅ Cotización generada')
     └─ setGenerando(false)
   ↓
13. Vista cambia automáticamente a tab "Historial"
   ↓
14. Usuario ve la nueva cotización en la tabla
```

### **Puntos de falla potenciales:**

| Paso | Problema | Impacto |
|------|----------|---------|
| 3 | Carga todas las cotizaciones | Performance con muchos registros |
| 6 | Búsqueda falla silenciosamente | Usuario no sabe si hay error |
| 9 | Validación con alert() | UX pobre, no testeable |
| 12 (generarFolio) | Race condition | Folio duplicado → error |
| 12 (inserts) | No atómico | Cotización huérfana si falla detalle |
| 12 (generarPDF) | Bloquea main thread | UI congelada |
| 12 (pdf.save) | No se guarda en servidor | No hay histórico de PDFs |

---

## 🎯 ÁREAS DE REVISIÓN PRIORITARIA PARA EL COACH

**Por favor Coach, enfócate especialmente en:**

### 1. 🔴 **Transacciones y atomicidad**
- ¿Cómo hacer que crearCotizacion sea atómico en Supabase?
- ¿Deberíamos crear una Edge Function que haga BEGIN-COMMIT?
- ¿O hay forma de hacer transacciones desde el cliente?

### 2. 🔴 **Race condition en folios**
- ¿Cómo solucionar la generación concurrente de folios?
- ¿Usar secuencias de PostgreSQL con formato custom?
- ¿Advisory locks?
- ¿Generar UUID y mapear a folio después?

### 3. 🔴 **Modelo de datos: Normalización vs Snapshot**
- ¿Opción A (snapshot puro), B (normalizado) o C (híbrido)?
- ¿Hay una opción D que no consideré?
- ¿Cómo balancear "datos históricos inmutables" vs "reportes útiles"?

### 4. 🟠 **Arquitectura del módulo**
- ¿Cómo refactorizar el componente de 893 líneas?
- ¿En qué componentes separarlo?
- ¿Extraer lógica de negocio a custom hooks adicionales?

### 5. 🟠 **Generación y almacenamiento de PDFs**
- ¿Dónde generar PDFs: cliente o servidor?
- ¿Dónde almacenar:
  - Supabase Storage (pros/contras)?
  - Vercel Blob?
  - Base64 en DB?
  - No almacenar (regenerar on-demand)?
- ¿Impacto en costos?

### 6. 🟡 **Estrategia de testing**
- ¿Qué testear PRIMERO (mayor ROI)?
- ¿Framework: Jest + React Testing Library?
- ¿Tests E2E con Playwright/Cypress?
- ¿Mock de Supabase o usar test database?

### 7. 🟡 **Manejo de errores y validación**
- ¿Cómo reemplazar alert()?
- ¿Usar librería de forms: react-hook-form, Formik?
- ¿Toast notifications: react-hot-toast, sonner?
- ¿Validación con Zod?

### 8. 🟡 **Performance y escalabilidad**
- ¿Paginación: offset-based o cursor-based?
- ¿Caching de cotizaciones?
- ¿Debería el historial estar en una ruta separada (/cotizaciones)?

---

## ⚡ SUPUESTOS Y DECISIONES ACTUALES

**Supuestos del diseño actual:**

1. **Las cotizaciones son inmutables (snapshot approach)**
   - Una vez creada, solo puede cambiar el `estado`
   - No se pueden editar partidas
   - **¿Es correcto? ¿O se deben poder editar en estado "vigente"?**

2. **Los PDFs se generan on-demand en el cliente**
   - No se almacenan permanentemente
   - Se regeneran cada vez que se solicitan
   - **¿Es correcto? ¿O debe guardarse el PDF original?**

3. **No hay flujo "Cotización → Pedido"**
   - Cotizaciones y Pedidos son módulos independientes
   - No hay botón "Convertir cotización en pedido"
   - **¿Es correcto? ¿O debería haber conversión automática?**

4. **Los folios se reinician cada mes**
   - Formato: COT-YYYYMM-0001
   - En enero 2026: COT-202601-0001, COT-202601-0002...
   - En febrero 2026: COT-202602-0001, COT-202602-0002...
   - **¿Es correcto? ¿O debe ser secuencial continuo?**

5. **RLS permite operaciones sin restricciones**
   - Cualquier usuario autenticado puede:
     - Ver todas las cotizaciones
     - Crear cotizaciones
     - Modificar cualquier cotización
     - Eliminar cualquier cotización
   - **¿Es correcto? ¿O debe haber permisos por rol/usuario?**

6. **No hay auditoría de cambios de estado**
   - Si una cotización cambia de "vigente" a "rechazada":
     - Solo se guarda el estado actual
     - No se registra quién lo cambió
     - No se registra cuándo se cambió
   - **¿Es correcto? ¿O se necesita histórico de cambios?**

7. **Partidas se guardan como strings libres**
   - Prenda, talla, color → texto libre
   - No hay relación con tablas `prendas`, `tallas`, `costos`
   - **¿Es correcto para el modelo de negocio?**

**¿Estos supuestos son válidos para los requisitos del negocio?**

---

## 📊 MÉTRICAS Y COMPLEJIDAD

### **Performance actual:**

| Operación | Complejidad | Tiempo estimado | Notas |
|-----------|-------------|-----------------|-------|
| Carga inicial de modal | O(n) | ~500ms con 100 registros | Sin paginación |
| Búsqueda de clientes | O(n) | ~100ms | Con LIMIT 10 |
| Generación de PDF | O(m) | ~200-500ms | m = partidas, bloquea UI |
| Crear cotización | O(1) + O(m) | ~300-800ms | 2 queries no atómicas |
| Generar folio | O(n) | ~50-100ms | n = cotizaciones del mes |

### **Queries a la base de datos:**

**Al abrir modal:**
```sql
-- 1 query
SELECT * FROM cotizaciones 
  LEFT JOIN alumnos ON ... 
  LEFT JOIN externos ON ...
ORDER BY created_at DESC;
-- Sin LIMIT → puede devolver miles de registros
```

**Al buscar cliente:**
```sql
-- 1 query cada 300ms (con debounce)
SELECT * FROM alumnos 
WHERE nombre ILIKE '%búsqueda%' 
   OR referencia ILIKE '%búsqueda%'
ORDER BY nombre 
LIMIT 10;
```

**Al crear cotización:**
```sql
-- Query 1: Generar folio
SELECT MAX(CAST(SUBSTRING(folio FROM '[0-9]+$') AS INTEGER))
FROM cotizaciones
WHERE folio LIKE 'COT-202601%';
-- Retorna: 5

-- Query 2: Insert cotización
INSERT INTO cotizaciones (...) RETURNING *;

-- Query 3: Insert partidas (1 sola query con múltiples rows)
INSERT INTO detalle_cotizacion (...) VALUES (...), (...), (...);

-- Query 4: Refrescar lista
SELECT * FROM cotizaciones LEFT JOIN...;
```

**Total: 4 queries no transaccionales**

---

## 📋 DEPENDENCIAS DEL PROYECTO

**package.json:**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.83.0",
    "jspdf": "^3.0.4",
    "jspdf-autotable": "^5.0.2",
    "next": "^16.0.7",
    "react": "^19.2.1",
    "react-dom": "^19.2.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

**Notable:**
- ❌ No hay framework de testing
- ❌ No hay librería de validación de forms
- ❌ No hay librería de manejo de estado (zustand, redux)
- ❌ No hay librería de UI (solo estilos inline)
- ✅ jsPDF para generación de PDFs

---

## 🚦 ESTADO FINAL Y SOLICITUD

**Nivel de confianza personal del Player:** **6/10**

**Motivos:**
- ✅ Funciona correctamente para casos simples
- ✅ Genera PDFs profesionales
- ✅ Búsqueda de clientes es fluida
- ⚠️ Race conditions no probadas en producción
- ⚠️ Transacciones no atómicas (riesgo de datos inconsistentes)
- ⚠️ Manejo de errores débil (alert())
- ❌ Cero tests automatizados
- ❌ Performance no optimizada (sin paginación)
- ❌ Arquitectura monolítica (mantenibilidad baja)

**Nivel de completitud:** **7/10** respecto a requisitos funcionales básicos

**¿Por qué no 10/10?**
- Falta almacenamiento de PDFs
- Falta histórico de cambios de estado
- Falta filtros en historial
- Falta validación robusta
- Falta manejo de errores

---

## 🎯 OBJETIVO DE ESTA REVISIÓN

**Necesito que el Coach (ChatGPT/Codex) me indique:**

### 1. **Priorización de problemas**
   - De los 18 problemas identificados, ¿cuáles arreglar PRIMERO?
   - ¿Qué tiene mayor impacto en producción?
   - ¿Qué tiene mejor ROI (esfuerzo vs beneficio)?

### 2. **Arquitectura objetivo**
   - ¿Cómo debe quedar estructurado el módulo después del refactor?
   - ¿Qué separar en qué archivos/componentes?
   - ¿Usar Edge Functions o mantener lógica en cliente?

### 3. **Plan de refactorización paso a paso**
   - ¿En qué orden implementar las mejoras?
   - ¿Qué se puede hacer sin romper funcionalidad actual?
   - ¿Qué requiere migración de datos?

### 4. **Decisión sobre normalización de BD**
   - ¿Opción A, B, C u otra?
   - ¿Qué cambios de schema específicos hacer?
   - ¿Cómo migrar datos existentes?

### 5. **Estrategia de testing**
   - ¿Qué tests escribir PRIMERO?
   - ¿Qué framework configurar?
   - ¿Qué casos críticos testear obligatoriamente?

### 6. **Decisiones técnicas específicas**
   - ¿Transacciones: Edge Function o cliente?
   - ¿Folios: secuencias, locks, o rediseño?
   - ¿PDFs: Storage, Blob, DB o regenerar?
   - ¿Forms: react-hook-form + Zod?
   - ¿UI: Tailwind, CSS Modules o componentes?

---

## ❓ PREGUNTAS PARA ACLARAR (si el Coach las detecta)

Si el Coach necesita información adicional del usuario para dar recomendaciones:

1. ¿Las cotizaciones deben poder convertirse en pedidos automáticamente?
2. ¿Los PDFs deben guardarse permanentemente o solo generarse on-demand?
3. ¿Hay requisitos de auditoría (quién cambió estado y cuándo)?
4. ¿Cuál es el volumen esperado (cotizaciones/mes, usuarios concurrentes)?
5. ¿Se necesitan reportes analíticos ("productos más cotizados", "clientes top")?
6. ¿Hay restricciones de permisos (no todos pueden ver/editar todas las cotizaciones)?
7. ¿Las cotizaciones deben poder editarse después de creadas?
8. ¿Cuál es la prioridad: velocidad de desarrollo vs robustez vs performance?

---

## 📦 ESTRUCTURA DE ARCHIVOS ACTUAL DEL MÓDULO

```
sistema-uniformes/
├── lib/
│   ├── types.ts (líneas 151-185: Cotizacion, DetalleCotizacion)
│   └── hooks/
│       └── useCotizaciones.ts (220 líneas: lógica de negocio)
├── components/
│   └── ModalCotizacion.tsx (893 líneas: UI monolítica)
└── supabase/
    └── crear_tablas_cotizaciones.sql (172 líneas: schema)
```

**Archivos totales:** 4  
**Líneas de código:** ~1,285  
**Archivos de tests:** 0

---

## 📝 NOTA FINAL DEL PLAYER

He documentado TODO lo que pude sobre el estado actual del módulo de cotizaciones. Los problemas están priorizados (🔴 Crítico → 🔵 Bajo) pero necesito la visión crítica del Coach para:

1. Validar si los problemas identificados son realmente problemas
2. Detectar problemas que no vi (edge cases, vulnerabilidades, etc.)
3. Dar un plan de acción concreto y priorizado
4. Recomendar decisiones técnicas específicas

**Este módulo funciona para casos básicos, pero necesita mejoras absolutas para producción seria.**

---

## ✅ AGREGADO POR EL COACH: HALLAZGOS Y RECOMENDACIONES

### 🔴 **Críticos (alto impacto / riesgo de datos)**

1. **Creación no atómica (transacciones ausentes)**
   - **Impacto:** cotizaciones huérfanas si falla el insert del detalle.
   - **Recomendación:** mover la creación a una **RPC/Edge Function** con `BEGIN/COMMIT` para insertar cabecera + detalle en una sola transacción.

2. **Race condition en generación de folios**
   - **Causa:** `MAX() + 1` no es seguro con concurrencia.
   - **Impacto:** duplicados y fallos por `UNIQUE`.
   - **Recomendación:** usar secuencia o tabla de control con **lock** (advisory o row-level) dentro de una transacción.

3. **RLS demasiado permisivo**
   - **Impacto:** cualquier usuario autenticado puede ver/modificar todo.
   - **Recomendación:** definir políticas por rol/usuario y registrar auditoría de cambios de estado.

---

### 🟠 **Altos (afectan consistencia y trazabilidad)**

4. **PDF histórico no persistente**
   - **Impacto:** el PDF puede cambiar si cambian datos.
   - **Recomendación:** guardar PDF en **Supabase Storage** o generar en servidor (Edge Function) y persistir URL.

5. **Errores invisibles para el usuario**
   - **Impacto:** fallas silenciosas → UX mala y problemas no detectados.
   - **Recomendación:** reemplazar `alert()` por UI de errores + notificaciones (toast) + logging.

6. **Sin paginación ni filtros en historial**
   - **Impacto:** rendimiento pobre con muchos registros.
   - **Recomendación:** paginación (range), filtros por folio/cliente/estado/fecha.

---

### 🟡 **Medios (mantenibilidad y calidad)**

7. **Duplicación de lógica y tipos**
   - Cálculo de totales repetido en UI/hook.
   - `PartidaCotizacion` no centralizado.
   - **Recomendación:** mover a `lib/types.ts` y `utils/cotizaciones.ts`.

8. **Componente monolítico (893 líneas)**
   - **Recomendación:** separar en componentes + extraer generación de PDF a util puro.

9. **Tipos inconsistentes (nullable vs optional)**
   - **Recomendación:** alinear con contrato real de Supabase.

---

### 🔵 **Bajos (deuda técnica / estilo)**

10. **Estilos inline y magic numbers**
    - **Recomendación:** migrar a CSS Modules o Tailwind + constantes de tema.

---

## 🧠 PROBLEMAS ADICIONALES DETECTADOS (NO LISTADOS ANTES)

1. **Zona horaria / fechas**
   - `new Date().toISOString().split('T')[0]` puede desfasar fecha por zona.
2. **Falta de validación server-side**
   - La lógica vive en cliente; faltan constraints y validadores en backend.
3. **No hay idempotencia**
   - Doble click o reintento puede duplicar cotización.
4. **No hay control de duplicados de partidas**
   - Se pueden agregar partidas repetidas sin advertencia.

---

## ✅ RECOMENDACIONES CLAVE (RESUMEN EJECUTIVO)

1. **Transacciones:** crear RPC/Edge Function transaccional.
2. **Folios:** secuencia con lock o tabla de control mensual.
3. **PDF:** almacenar en Storage o generar en servidor.
4. **Normalización:** opción híbrida (snapshot + FK opcional).
5. **Testing:** empezar con `useCotizaciones`, transacciones y PDF.
6. **Validación UI:** `react-hook-form + zod + toast`.

---

## 🗺️ PLAN DE REFACTOR (ORDEN PROPUESTO)

1. **Resolver atomicidad y folios en BD**
2. **RLS y permisos correctos**
3. **Persistencia de PDF**
4. **Paginación + filtros**
5. **Separación de componentes + utils**
6. **Tests mínimos**

---

## ❓ PREGUNTAS ABIERTAS CRÍTICAS

1. ¿Se requiere **auditoría** (quién cambió estado y cuándo)?
2. ¿Las cotizaciones se pueden **editar** en estado vigente?
3. ¿Se deben **convertir** en pedidos?
4. ¿Cuál es el **volumen esperado** (cotizaciones/mes, usuarios concurrentes)?
5. ¿Se requieren **reportes analíticos** reales?

---

**Estado:** ✅ **Listo para revisión exhaustiva del Coach**

**Fecha de entrega:** 2026-01-24

---

## 🧑‍💻 INSTRUCCIONES PARA EL COACH

Coach, por favor:

1. **Lee este documento completo** (no hay más información, todo está aquí)
2. **Identifica problemas adicionales** que el Player no detectó
3. **Prioriza los problemas** (de crítico a bajo)
4. **Propón arquitectura objetivo** concreta
5. **Da un plan de refactorización** paso a paso
6. **Responde las preguntas técnicas** planteadas
7. **Usa el formato de revisión estándar** que tienes configurado

**Recuerda:** Eres el Coach amargado y riguroso. No apruebes nada que no esté sólido. Encuentra los edge cases que faltan. Sé específico con tus recomendaciones.

Gracias por tu revisión rigurosa.
