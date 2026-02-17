#!/usr/bin/env node

/**
 * Script para actualizar los pedidos de prueba a estado LIQUIDADO
 * para que aparezcan en los reportes de ventas
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nmxrccrbnoenkahefrrw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teHJjY3Jibm9lbmthaGVmcnJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE1MTg0OCwiZXhwIjoyMDY5NzI3ODQ4fQ._SIR3rmq7TWukuym30cCP4BAKGe-dhnillDV0Bz6Hf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function actualizarPedidos() {
  console.log('🔄 Actualizando pedidos a estado LIQUIDADO...\n');

  try {
    // Obtener todos los pedidos que están ENTREGADO
    const { data: pedidos, error: errorPedidos } = await supabase
      .from('pedidos')
      .select('id, created_at, estado')
      .eq('estado', 'ENTREGADO');

    if (errorPedidos) {
      console.error('❌ Error obteniendo pedidos:', errorPedidos);
      return;
    }

    if (!pedidos || pedidos.length === 0) {
      console.log('ℹ️  No hay pedidos ENTREGADO para actualizar');
      return;
    }

    console.log(`📦 Encontrados ${pedidos.length} pedidos ENTREGADO\n`);

    // Actualizar cada pedido
    for (const pedido of pedidos) {
      // Usar la misma fecha de creación como fecha de liquidación
      const fechaLiquidacion = pedido.created_at;

      const { error: errorUpdate } = await supabase
        .from('pedidos')
        .update({
          estado: 'LIQUIDADO',
          fecha_liquidacion: fechaLiquidacion
        })
        .eq('id', pedido.id);

      if (errorUpdate) {
        console.error(`❌ Error actualizando pedido ${pedido.id}:`, errorUpdate);
      } else {
        console.log(`✅ Pedido ${pedido.id.substring(0, 8)}... → LIQUIDADO`);
      }
    }

    console.log('\n✅ Actualización completada');
    console.log('📊 Ahora los reportes deberían mostrar datos');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar
actualizarPedidos();
