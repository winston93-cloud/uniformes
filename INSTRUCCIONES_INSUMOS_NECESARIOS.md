# 📋 Insumos Necesarios para Producción

## 🎯 ¿Qué es esta funcionalidad?

Esta es la **tarjeta principal** del sistema, diseñada específicamente para la **administración ejecutiva**. Permite ver de forma clara y automática **qué insumos se necesitan comprar** para completar todos los pedidos pendientes.

---

## 🌟 Ubicación

La tarjeta **"Insumos Necesarios para Producción"** se encuentra:
- ✅ Al **inicio del Dashboard** (primera tarjeta)
- ✅ Con diseño destacado en **gradiente morado**
- ✅ Visible para todos los usuarios

---

## 📊 ¿Cómo funciona?

### Cálculo Automático

El sistema realiza el siguiente proceso **automáticamente**:

1. **Identifica pedidos pendientes**
   - Busca todos los pedidos con estado "PEDIDO" (no entregados)

2. **Analiza las prendas vendidas**
   - Por cada pedido pendiente, identifica:
     - Qué prenda se vendió
     - Qué talla se vendió
     - Cuántas unidades se vendieron

3. **Calcula insumos necesarios**
   - Por cada prenda-talla vendida, consulta:
     - Qué insumos se necesitan (configurados en el módulo de Prendas)
     - Cuánta cantidad de cada insumo se requiere
   - Multiplica la cantidad de insumo × cantidad de prendas vendidas

4. **Agrupa y totaliza**
   - Suma todos los insumos del mismo tipo
   - Ordena de mayor a menor cantidad
   - Muestra el resultado final

### Ejemplo Práctico

```
Pedidos Pendientes:
- Pedido #1: 5 Camisas Polo Talla 10
- Pedido #2: 3 Camisas Polo Talla 12
- Pedido #3: 2 Pantalones Talla 8

Si la configuración de insumos es:
- Camisa Polo Talla 10: 3 botones, 2 mts tela blanca
- Camisa Polo Talla 12: 3 botones, 2.2 mts tela blanca
- Pantalón Talla 8: 1 cierre, 1.5 mts tela azul

El sistema calculará:
┌─────────────────┬──────────────┐
│ Insumo          │ Cantidad     │
├─────────────────┼──────────────┤
│ Botones         │ 24 piezas    │
│ Tela Blanca     │ 16.6 metros  │
│ Cierre          │ 2 piezas     │
│ Tela Azul       │ 3 metros     │
└─────────────────┴──────────────┘
```

---

## 💡 ¿Cómo usar la tarjeta?

### Estado Colapsado (Vista Rápida)

Al entrar al Dashboard, verás:

```
┌────────────────────────────────────────────────────┐
│ 📋 Insumos Necesarios para Producción            │
│    Basado en pedidos pendientes de entrega        │
│                                                    │
│                            ⚠️ 4 insumos necesarios│
│                            🔄 Actualizar       ▼  │
└────────────────────────────────────────────────────┘
```

**Indicadores de Estado:**
- 🟢 **Verde**: "✅ No hay pedidos pendientes" - Todo al día
- 🟡 **Amarillo**: 1-5 insumos necesarios - Atención normal
- 🟠 **Naranja**: 6-10 insumos necesarios - Requiere atención
- 🔴 **Rojo**: +10 insumos necesarios - Urgente

### Estado Expandido (Vista Completa)

Haz clic en cualquier parte de la tarjeta para **expandir** y ver el detalle:

```
┌────────────────────────────────────────────────────────────┐
│ 📋 Insumos Necesarios para Producción            ▲        │
│    Basado en pedidos pendientes de entrega                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Resumen de Compra                                       │
│ Se necesitan 4 tipos de insumos diferentes                 │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ # │ Código  │ Insumo       │ Cantidad │ Unidad      │  │
│ ├───┼─────────┼──────────────┼──────────┼─────────────┤  │
│ │ 1 │ BOT-001 │ Botones      │ 24.00    │ Pieza       │  │
│ │ 2 │ TEL-BL  │ Tela Blanca  │ 16.60    │ Metro       │  │
│ │ 3 │ TEL-AZ  │ Tela Azul    │ 3.00     │ Metro       │  │
│ │ 4 │ CIE-001 │ Cierre       │ 2.00     │ Pieza       │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ 💡 Tip: Estos cálculos están basados en los pedidos       │
│         con estado "PEDIDO" (pendientes de entrega)        │
└────────────────────────────────────────────────────────────┘
```

---

## 🔄 Actualización de Datos

### Botón "Actualizar"

- **Ubicación**: Esquina superior derecha de la tarjeta
- **Función**: Recalcula los insumos necesarios consultando la base de datos
- **Cuándo usar**:
  - ✅ Después de registrar nuevos pedidos
  - ✅ Después de cambiar el estado de un pedido
  - ✅ Después de modificar insumos en una prenda
  - ✅ Para verificar datos actualizados

### Actualización Automática

La tarjeta se actualiza automáticamente cuando:
- Entras al Dashboard
- Recargas la página del navegador

---

## 🎯 Casos de Uso

### Para la Dueña/Dirección

1. **Revisión Diaria**
   - Entrar al Dashboard cada mañana
   - Verificar el estado de insumos necesarios
   - Tomar decisiones de compra

2. **Planificación de Compras**
   - Expandir la tarjeta
   - Revisar la tabla completa
   - Exportar o anotar las cantidades necesarias
   - Realizar órdenes de compra a proveedores

3. **Control de Producción**
   - Monitorear qué insumos son más demandados
   - Identificar cuellos de botella
   - Optimizar inventario

### Para Operadores

1. **Verificación antes de Producir**
   - Verificar que los insumos calculados estén disponibles
   - Coordinar con bodega/almacén

2. **Actualización de Estados**
   - Después de completar pedidos, cambiar estado a "ENTREGADO"
   - Actualizar la tarjeta para reflejar nuevos cálculos

---

## ⚙️ Requisitos Previos

Para que esta funcionalidad funcione correctamente:

### 1. Configuración de Insumos por Talla (CRÍTICO)

**Cada prenda debe tener sus insumos configurados por talla:**

1. Ir a **Prendas** en el Dashboard
2. Editar una prenda
3. Seleccionar las tallas disponibles
4. Hacer clic en el botón 🧵 junto a cada talla
5. En el modal que aparece:
   - Agregar cada insumo necesario
   - Especificar la cantidad exacta
   - Guardar

**Ejemplo:**
```
Camisa Polo - Talla 10
├─ Botones: 3 piezas
├─ Tela Blanca: 2 metros
├─ Hilo Blanco: 0.5 metros
└─ Cuello: 1 pieza
```

### 2. Registro de Pedidos

Los pedidos deben estar registrados en el sistema con:
- ✅ Estado: "PEDIDO" (pendiente de entrega)
- ✅ Detalle completo (prenda, talla, cantidad)
- ✅ Cliente asignado (alumno o externo)

### 3. Catálogos Completos

Verificar que existan:
- ✅ Insumos dados de alta
- ✅ Presentaciones (unidades de medida) configuradas
- ✅ Tallas disponibles
- ✅ Prendas configuradas

---

## 🚨 Solución de Problemas

### "✅ No hay pedidos pendientes" (cuando debería haber)

**Posibles causas:**
1. Los pedidos están en estado "ENTREGADO" o "CANCELADO"
   - **Solución**: Verificar el módulo de Pedidos y cambiar estado a "PEDIDO"

2. Los pedidos no tienen detalle
   - **Solución**: Revisar que los pedidos tengan líneas de detalle

### "0 insumos necesarios" (cuando hay pedidos pendientes)

**Posibles causas:**
1. Las prendas no tienen insumos configurados
   - **Solución**: Ir a Prendas → Editar → Configurar insumos por talla

2. Las tallas del pedido no tienen insumos asignados
   - **Solución**: Configurar insumos para esa talla específica

### "Error al calcular"

**Posibles causas:**
1. Problema de conexión a la base de datos
   - **Solución**: Verificar conexión a internet
   - **Solución**: Hacer clic en "Actualizar"

2. Datos inconsistentes en la base de datos
   - **Solución**: Contactar al administrador del sistema

---

## 📈 Beneficios

### Para la Dirección

✅ **Visibilidad instantánea** de necesidades de compra
✅ **Toma de decisiones** basada en datos reales
✅ **Control de costos** al comprar exactamente lo necesario
✅ **Planificación efectiva** de producción

### Para el Negocio

✅ **Reducción de desperdicio** (no comprar de más)
✅ **Evitar faltantes** (no comprar de menos)
✅ **Optimización de capital** de trabajo
✅ **Cumplimiento de entregas** a tiempo

---

## 🎨 Diseño Visual

La tarjeta fue diseñada con:
- **Gradiente morado/violeta**: Profesional y distintivo
- **Iconografía clara**: Fácil de entender
- **Jerarquía visual**: Lo más importante resalta
- **Responsive**: Se adapta a diferentes pantallas
- **Interactiva**: Expandible/colapsable

---

## 📞 Soporte

Si tienes dudas o problemas con esta funcionalidad:
1. Verificar esta documentación
2. Hacer clic en "Actualizar" para refrescar datos
3. Contactar al administrador del sistema

---

**🏫 Sistema de Uniformes Winston Churchill**  
**📅 Creado:** Enero 2026  
**👥 Diseñado para:** Dirección y Administración
