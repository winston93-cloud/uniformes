#!/usr/bin/env node

/**
 * Script para agregar stock_minimo a prendas y crear alertas de ejemplo
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nmxrccrbnoenkahefrrw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teHJjY3Jibm9lbmthaGVmcnJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE1MTg0OCwiZXhwIjoyMDY5NzI3ODQ4fQ._SIR3rmq7TWukuym30cCP4BAKGe-dhnillDV0Bz6Hf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function agregarStockMinimo() {
  console.log('🔄 Agregando stock_minimo a prendas para crear alertas...\n');

  try {
    // 1. Obtener todos los costos (prenda-talla) activos
    const { data: costos, error: errorCostos } = await supabase
      .from('costos')
      .select('id, stock, prendas(nombre), tallas(nombre)')
      .eq('activo', true)
      .limit(15); // Trabajar con las primeras 15

    if (errorCostos) {
      console.error('❌ Error obteniendo costos:', errorCostos);
      return;
    }

    if (!costos || costos.length === 0) {
      console.log('ℹ️  No hay costos disponibles');
      return;
    }

    console.log(`📦 Encontrados ${costos.length} registros de prendas-tallas\n`);

    let actualizados = 0;
    let criticos = 0;
    let bajos = 0;
    let advertencias = 0;

    // 2. Actualizar cada costo con diferentes niveles de stock_minimo
    for (const costo of costos) {
      const prenda = Array.isArray(costo.prendas) ? costo.prendas[0] : costo.prendas;
      const talla = Array.isArray(costo.tallas) ? costo.tallas[0] : costo.tallas;
      
      if (!prenda || !talla) continue;

      const stockActual = costo.stock || 0;
      
      // Generar diferentes escenarios de alertas
      let stockMinimo;
      let nivel;
      
      // Distribuir alertas:
      // 30% crítico (stock < 25% del mínimo)
      // 40% bajo (stock 25-50% del mínimo)
      // 30% advertencia (stock 50-100% del mínimo)
      
      const random = Math.random();
      
      if (random < 0.3) {
        // Crítico: stock_minimo será mucho mayor que stock actual
        stockMinimo = Math.max(stockActual * 5, 50);
        nivel = '🚨 CRÍTICO';
        criticos++;
      } else if (random < 0.7) {
        // Bajo: stock_minimo será el doble del stock actual
        stockMinimo = Math.max(stockActual * 2.5, 30);
        nivel = '⚠️ BAJO';
        bajos++;
      } else {
        // Advertencia: stock_minimo será ligeramente mayor que stock actual
        stockMinimo = Math.max(stockActual * 1.3, 20);
        nivel = '📊 ADVERTENCIA';
        advertencias++;
      }

      // Actualizar el registro
      const { error: errorUpdate } = await supabase
        .from('costos')
        .update({ stock_minimo: stockMinimo })
        .eq('id', costo.id);

      if (errorUpdate) {
        console.error(`❌ Error actualizando ${prenda.nombre} - ${talla.nombre}:`, errorUpdate);
      } else {
        const porcentaje = Math.round((stockActual / stockMinimo) * 100);
        console.log(`${nivel} ${prenda.nombre} - Talla ${talla.nombre}`);
        console.log(`   Stock: ${stockActual} | Mínimo: ${stockMinimo} | ${porcentaje}%`);
        actualizados++;
      }
    }

    console.log('\n✅ Actualización completada');
    console.log(`📊 Total actualizado: ${actualizados} prendas`);
    console.log(`🚨 Críticas: ${criticos}`);
    console.log(`⚠️  Bajas: ${bajos}`);
    console.log(`📊 Advertencias: ${advertencias}`);
    console.log('\n📈 Las alertas ahora se mostrarán en el dashboard');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar
agregarStockMinimo();
