const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Leer .env.local manualmente
const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📋 Aplicando migración: add_precio_compra...');
  
  // Leer la migración
  const migration = fs.readFileSync('supabase/migrations/add_precio_compra.sql', 'utf8');
  
  // Ejecutar directamente la consulta SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: migration });
  
  if (error) {
    console.error('❌ Error al aplicar la migración:', error);
    console.log('\n⚠️  Probablemente necesitas ejecutar esta migración desde el SQL Editor de Supabase Dashboard');
    console.log('📝 Contenido de la migración:\n');
    console.log(migration);
    process.exit(1);
  }
  
  console.log('✅ Migración aplicada exitosamente');
}

applyMigration();

