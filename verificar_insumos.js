const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Leer .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarInsumos() {
  console.log('🔍 Verificando tabla de insumos...\n');
  
  const { data, error } = await supabase
    .from('insumos')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log('✅ ¡Tabla de insumos creada exitosamente!\n');
  console.log(`📊 Total de insumos: ${data.length}\n`);
  
  if (data.length > 0) {
    console.log('📦 Insumos registrados:\n');
    data.forEach((insumo, index) => {
      console.log(`${index + 1}. [${insumo.codigo}] ${insumo.nombre}`);
      console.log(`   📦 Presentación: ${insumo.presentacion}`);
      console.log(`   📏 Cantidad: ${insumo.cantidad_por_presentacion} unidades`);
      console.log(`   📝 ${insumo.descripcion || 'Sin descripción'}`);
      console.log(`   ${insumo.activo ? '✅' : '❌'} ${insumo.activo ? 'Activo' : 'Inactivo'}`);
      console.log('');
    });
    
    console.log('🎉 ¡Todo listo! Ahora puedes usar el módulo de Insumos en la aplicación.\n');
    console.log('🚀 Inicia el proyecto con: npm run dev');
    console.log('📱 Ve a: http://localhost:3000/insumos');
  } else {
    console.log('⚠️  No se encontraron insumos. Los datos de ejemplo no se insertaron.');
  }
}

verificarInsumos();

