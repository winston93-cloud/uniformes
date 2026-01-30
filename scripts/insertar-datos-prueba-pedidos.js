const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nmxrccrbnoenkahefrrw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teHJjY3Jibm9lbmthaGVmcnJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE1MTg0OCwiZXhwIjoyMDY5NzI3ODQ4fQ._SIR3rmq7TWukuym30cCP4BAKGe-dhnillDV0Bz6Hf0'
);

async function insertarDatosPrueba() {
  console.log('🚀 Iniciando inserción de datos de prueba para reportes...\n');

  try {
    // 1. Verificar que existan prendas y costos
    const { data: prendas, error: errorPrendas } = await supabase
      .from('prendas')
      .select('id, nombre')
      .limit(5);

    if (errorPrendas) throw errorPrendas;
    if (!prendas || prendas.length === 0) {
      console.log('❌ No hay prendas en el sistema. Primero crea algunas prendas.');
      return;
    }

    console.log('✅ Prendas encontradas:', prendas.map(p => p.nombre).join(', '));

    // 2. Obtener costos para las prendas con tallas
    const { data: costos, error: errorCostos } = await supabase
      .from('costos')
      .select(`
        id, 
        prenda_id, 
        talla_id,
        precio_menudeo, 
        precio_mayoreo,
        tallas:talla_id (nombre)
      `)
      .in('prenda_id', prendas.map(p => p.id))
      .limit(20);

    if (errorCostos) throw errorCostos;
    if (!costos || costos.length === 0) {
      console.log('❌ No hay costos definidos. Primero crea costos para las prendas.');
      return;
    }

    console.log('✅ Costos encontrados:', costos.length);

    // 3. Obtener un cliente (alumno o externo)
    const { data: alumnos, error: errorAlumnos } = await supabase
      .from('alumno')
      .select('id')
      .limit(1);

    const { data: externos, error: errorExternos } = await supabase
      .from('externos')
      .select('id')
      .limit(1);

    const clienteId = alumnos?.[0]?.id || externos?.[0]?.id;
    const tipoCliente = alumnos?.[0]?.id ? 'alumno' : 'externo';

    if (!clienteId) {
      console.log('❌ No hay clientes (alumnos o externos) en el sistema.');
      return;
    }

    console.log(`✅ Cliente encontrado: ${tipoCliente}\n`);

    // 4. Crear pedidos de prueba con folios consecutivos
    const fechaBase = new Date('2026-01-15');
    const pedidosAPrueba = [];

    for (let i = 0; i < 10; i++) {
      const fecha = new Date(fechaBase);
      fecha.setDate(fecha.getDate() + Math.floor(i / 2)); // 2 pedidos por día

      // Seleccionar 2-4 costos aleatorios para este pedido
      const numItems = 2 + Math.floor(Math.random() * 3);
      const costosSeleccionados = [];
      
      for (let j = 0; j < numItems; j++) {
        const costoAleatorio = costos[Math.floor(Math.random() * costos.length)];
        const cantidad = 1 + Math.floor(Math.random() * 5);
        const usarMayoreo = Math.random() > 0.5;
        const precioUnitario = usarMayoreo ? costoAleatorio.precio_mayoreo : costoAleatorio.precio_menudeo;
        
        costosSeleccionados.push({
          costo_id: costoAleatorio.id,
          talla_id: costoAleatorio.talla_id,
          cantidad: cantidad,
          precio_unitario: precioUnitario,
          subtotal: cantidad * precioUnitario,
        });
      }

      const total = costosSeleccionados.reduce((sum, item) => sum + item.subtotal, 0);

      // Crear pedido (tabla: pedidos, no pedido)
      // Nota: usa created_at automático, no hay campo fecha_pedido
      const pedidoData = {
        [tipoCliente === 'alumno' ? 'alumno_id' : 'externo_id']: clienteId,
        tipo_cliente: tipoCliente,
        subtotal: total,
        total: total,
        estado: 'ENTREGADO',
        fecha_entrega: fecha.toISOString(),
      };

      console.log(`   Intentando crear pedido ${i + 1}`);
      
      const { data: pedidoCreado, error: errorPedido } = await supabase
        .from('pedidos')
        .insert(pedidoData)
        .select()
        .single();

      console.log(`   Respuesta:`, { data: pedidoCreado, error: errorPedido });

      if (errorPedido) {
        console.log(`❌ Error al crear pedido ${i + 1}:`, JSON.stringify(errorPedido));
        continue;
      }
      
      if (!pedidoCreado) {
        console.log(`❌ No se creó el pedido ${i + 1} (sin datos retornados)`);
        continue;
      }

      console.log(`✅ Pedido #${pedidoCreado.id.slice(0, 8)} creado (${fecha.toISOString().split('T')[0]})`);

      // Crear detalles del pedido (tabla: detalle_pedidos, no detalle_pedido)
      const detalles = costosSeleccionados.map(item => ({
        pedido_id: pedidoCreado.id,
        costo_id: item.costo_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
      }));

      const { error: errorDetalles } = await supabase
        .from('detalle_pedidos')
        .insert(detalles);

      if (errorDetalles) {
        console.log(`   ⚠️  Error al crear detalles:`, errorDetalles.message);
      } else {
        console.log(`   📋 ${detalles.length} items agregados`);
      }

      pedidosAPrueba.push(pedidoCreado);
    }

    console.log('\n✅ RESUMEN:');
    console.log(`   • ${pedidosAPrueba.length} pedidos creados`);
    console.log(`   • Fechas: ${new Date('2026-01-15').toISOString().split('T')[0]} a ${new Date(fechaBase.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`);
    console.log('\n🎉 ¡Datos de prueba insertados exitosamente!');
    console.log('🔍 Ahora puedes probar los reportes en el sistema.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

insertarDatosPrueba();
