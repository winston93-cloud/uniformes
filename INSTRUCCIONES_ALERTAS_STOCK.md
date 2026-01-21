# 📦 Sistema de Alertas de Stock Mínimo

## 🎯 Descripción

Sistema automático de monitoreo y alertas de inventario que permite establecer niveles mínimos de stock para cada insumo y recibir notificaciones visuales cuando los niveles caen por debajo del umbral definido.

---

## ✨ Características Principales

### 1. **Stock Mínimo Configurable**
- Cada insumo puede tener un valor de `stock_minimo` definido
- Se configura directamente en el catálogo de insumos
- Valor por defecto: 0 (sin alertas)

### 2. **Niveles de Alerta Inteligentes**
El sistema categoriza automáticamente cada insumo en 3 niveles según el porcentaje de stock:

| Nivel | Porcentaje | Emoji | Color | Descripción |
|-------|-----------|-------|-------|-------------|
| **Crítico** | < 25% | 🚨 | Rojo | Stock extremadamente bajo, requiere acción inmediata |
| **Bajo** | 25% - 49% | ⚠️ | Naranja | Stock bajo, programar compra pronto |
| **Advertencia** | 50% - 99% | 📊 | Azul | Se acerca al mínimo, monitorear |
| **OK** | ≥ 100% | ✅ | Verde | Stock saludable |

**Fórmula de cálculo:**
```
Stock Actual = Σ (todas las compras de ese insumo)
Porcentaje = (Stock Actual / Stock Mínimo) × 100
```

### 3. **Dashboard en Tiempo Real**
- Tarjeta dedicada en el dashboard principal
- Vista lado a lado con "Insumos Necesarios para Producción"
- Contadores visuales por nivel de alerta
- Tabla detallada ordenada por criticidad

### 4. **Integración con Compras**
- Botón directo "💰 Comprar" en cada alerta
- Abre el modal de registro de compra preconfigurado
- Al registrar una compra, actualiza automáticamente el stock y recalcula alertas

---

## 🗄️ Base de Datos

### Nueva Columna: `insumos.stock_minimo`

```sql
ALTER TABLE insumos
ADD COLUMN stock_minimo DECIMAL(10, 2) DEFAULT 0 CHECK (stock_minimo >= 0);
```

**Características:**
- Tipo: `DECIMAL(10, 2)` - Permite hasta 2 decimales
- Por defecto: `0` - Sin alertas
- Constraint: `>= 0` - No permite valores negativos
- Índice: Creado para optimizar consultas de alertas

---

## 🔧 Implementación Técnica

### Archivos Creados/Modificados

#### 1. **Base de Datos**
```
/supabase/agregar_stock_minimo_insumos.sql
```
- Script SQL para agregar columna `stock_minimo`
- Índice para optimizar consultas
- Valores por defecto para insumos existentes

#### 2. **Hook Personalizado**
```typescript
/lib/hooks/useAlertasStock.ts
```

**Interfaz Principal:**
```typescript
interface AlertaStock {
  insumo_id: string;
  insumo_nombre: string;
  insumo_codigo: string;
  stock_actual: number;
  stock_minimo: number;
  diferencia: number; // stock_actual - stock_minimo
  porcentaje_stock: number; // (stock_actual / stock_minimo) * 100
  nivel_alerta: 'critico' | 'bajo' | 'advertencia';
  presentacion_nombre: string;
  presentacion_descripcion: string;
}
```

**Funciones:**
- `cargarAlertas()` - Obtiene insumos, calcula stock y genera alertas
- `recargar()` - Actualiza alertas en tiempo real
- `contadores` - Totales por nivel de alerta

**Lógica de Cálculo:**
1. Obtener todos los insumos con `stock_minimo > 0`
2. Sumar todas las compras por `insumo_id`
3. Calcular porcentaje: `(stock_actual / stock_minimo) * 100`
4. Clasificar en nivel de alerta según porcentaje
5. Ordenar por criticidad (crítico primero)

#### 3. **Componente Visual**
```typescript
/components/TarjetaAlertasStock.tsx
```

**Características UI:**
- Gradiente dinámico según nivel de alerta más crítico
- Expansión/colapso con animaciones suaves
- Tabla responsive con hover effects
- Contadores visuales por nivel
- Integración directa con modal de compras

**Estados Visuales:**
- 🚨 **Crítico**: Gradiente rojo intenso
- ⚠️ **Bajo**: Gradiente naranja
- 📊 **Advertencia**: Gradiente azul
- ✅ **OK**: Gradiente verde

#### 4. **Tipos TypeScript**
```typescript
/lib/types.ts
```

Actualizado `Insumo` con:
```typescript
stock_minimo?: number;
```

#### 5. **Catálogo de Insumos**
```typescript
/app/insumos/page.tsx
```

**Cambios:**
- Nuevo campo "📦 Stock Mínimo" en formulario
- Input numérico con validación `min="0"`
- Estilo especial con borde naranja para destacar
- Texto explicativo sobre alertas automáticas

#### 6. **Dashboard**
```typescript
/app/dashboard/page.tsx
```

**Nuevo Layout:**
```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
  gap: '1.5rem'
}}>
  <TarjetaInsumosFaltantes />
  <TarjetaAlertasStock />
</div>
```

- Grid responsivo de 2 columnas
- Ancho mínimo: 500px por columna
- Gap: 1.5rem entre tarjetas

---

## 📊 Flujo de Uso

### 1. Configuración Inicial

1. Ir a **Catálogo de Insumos** (`/insumos`)
2. Crear o editar un insumo
3. Establecer el **Stock Mínimo** deseado
   - Ejemplo: 10 piezas de botones blancos
4. Guardar el insumo

### 2. Monitoreo de Alertas

1. Ir al **Dashboard** (`/dashboard`)
2. Ver la tarjeta **"Alertas de Stock Mínimo"**
3. El badge muestra el estado general:
   - 🚨 **X Alertas Críticas** (rojo)
   - ⚠️ **X Stock Bajo** (naranja)
   - 📊 **X Advertencias** (azul)
   - ✅ **Stock OK** (verde)
4. Click en la tarjeta para expandir y ver detalles

### 3. Gestión de Alertas

**Vista Expandida:**
- Contadores por nivel (Crítico / Bajo / Advertencia)
- Tabla completa ordenada por prioridad
- Columnas:
  - **Nivel**: Badge con emoji y color
  - **Insumo**: Nombre y código
  - **Stock Actual**: Cantidad disponible (color según nivel)
  - **Stock Mínimo**: Umbral definido
  - **%**: Porcentaje actual vs mínimo
  - **Acción**: Botón "💰 Comprar"

### 4. Registro de Compra

1. Click en **"💰 Comprar"** del insumo deseado
2. Se abre el modal de registro de compra
3. Completar:
   - Cantidad comprada (sugerida: diferencia faltante)
   - Costo unitario
   - Proveedor
   - Fecha de compra
   - Notas (opcional)
4. Click en **"Registrar Compra"**
5. El sistema automáticamente:
   - Suma la cantidad al stock actual
   - Recalcula el porcentaje
   - Actualiza el nivel de alerta
   - Recarga ambas tarjetas

---

## 🎨 Diseño y UX

### Principios de Diseño

1. **Jerarquía Visual Clara**
   - Alertas críticas siempre arriba
   - Colores intensos para urgencia
   - Tamaño de fuente proporcional a importancia

2. **Feedback Inmediato**
   - Actualizaciones en tiempo real
   - Animaciones suaves en transiciones
   - Hover effects para interactividad

3. **Accesibilidad**
   - Emojis como indicadores visuales adicionales
   - Alto contraste en colores
   - Tamaños de fuente legibles

### Responsive Design

| Viewport | Layout |
|----------|--------|
| > 1200px | 2 columnas (50% cada una) |
| 800-1200px | 2 columnas adaptativas |
| < 800px | 1 columna (stack vertical) |

---

## 🔒 Seguridad y Permisos

- **Lectura**: Todos los usuarios pueden ver alertas
- **Escritura**: Solo usuarios autenticados pueden:
  - Definir stock mínimo
  - Registrar compras
- **RLS Activo**: Políticas aplicadas en `compras_insumos`

---

## 🚀 Beneficios del Sistema

### Para la Dueña/Administración
✅ Visibilidad instantánea del estado de inventario
✅ Prevención de quiebres de stock
✅ Toma de decisiones basada en datos reales
✅ Ahorro de tiempo en control manual

### Para el Personal
✅ Indicadores claros de qué comprar
✅ Priorización automática por criticidad
✅ Acceso directo a registro de compras
✅ Reducción de errores humanos

### Para el Negocio
✅ Optimización de capital de trabajo
✅ Reducción de costos de almacenamiento
✅ Mejor planificación de compras
✅ Cumplimiento oportuno de pedidos

---

## 🐛 Troubleshooting

### Problema: Las alertas no aparecen

**Causa**: Los insumos no tienen `stock_minimo` definido
**Solución**:
1. Ir a `/insumos`
2. Editar cada insumo
3. Establecer un valor en "Stock Mínimo"
4. Guardar

### Problema: Stock actual aparece en 0

**Causa**: No se han registrado compras
**Solución**:
1. Click en "💰 Comprar" en la alerta
2. Registrar compra inicial
3. El stock se actualizará automáticamente

### Problema: Alerta no desaparece después de comprar

**Causa**: La cantidad comprada aún no alcanza el mínimo
**Solución**:
- Verificar el stock actual vs stock mínimo
- Si es necesario, registrar compra adicional
- O ajustar el stock mínimo si es muy alto

### Problema: No se ve la tarjeta en el dashboard

**Causa**: Error en despliegue o caché
**Solución**:
1. Limpiar caché del navegador (Ctrl+Shift+R)
2. Verificar en Vercel que el deployment fue exitoso
3. Revisar console del navegador por errores

---

## 📝 Mantenimiento

### Actualización de Stock Mínimo

Se recomienda revisar y ajustar los valores de stock mínimo:
- **Mensualmente**: Para insumos de rotación media
- **Trimestralmente**: Para insumos de baja rotación
- **Semanalmente**: Para insumos críticos de alta rotación

### Auditoría de Alertas

Revisar periódicamente:
- Insumos con alertas persistentes (más de 2 semanas)
- Stock mínimo vs demanda real
- Proveedores y tiempos de entrega

---

## 🎓 Mejores Prácticas

1. **Establecer Stock Mínimo Realista**
   - Considerar tiempo de entrega del proveedor
   - Analizar consumo histórico
   - Dejar margen de seguridad (1-2 semanas)

2. **Monitoreo Regular**
   - Revisar dashboard al inicio del día
   - Atender alertas críticas inmediatamente
   - Programar compras preventivas para alertas bajas

3. **Registro Preciso**
   - Siempre registrar compras en el sistema
   - Incluir información completa (proveedor, costo, fecha)
   - Agregar notas relevantes (número de factura, condiciones)

4. **Coordinación de Compras**
   - Usar la tabla de alertas para planificar pedidos combinados
   - Optimizar costos de envío con compras agrupadas
   - Negociar mejores precios con volumen

---

## 📈 Futuras Mejoras

**Ideas para versiones futuras:**
- 📧 Notificaciones por email cuando hay alertas críticas
- 📊 Gráficas de tendencia de consumo
- 🤖 Sugerencias automáticas de cantidad a comprar
- 📱 Notificaciones push móviles
- 🔄 Integración con proveedores para pedidos automáticos
- 📦 Predicción de quiebre de stock con IA

---

## 🎯 Resumen Ejecutivo

El **Sistema de Alertas de Stock Mínimo** es un módulo crítico que:

✅ **Automatiza** el control de inventario
✅ **Previene** quiebres de stock
✅ **Optimiza** decisiones de compra
✅ **Reduce** costos operativos
✅ **Mejora** la eficiencia del negocio

**Impacto directo**: Evita situaciones donde no se pueden completar pedidos por falta de insumos, protegiendo ingresos y reputación del negocio.

---

**¡Sistema listo para usarse! 🚀**
