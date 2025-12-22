const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Leer .env.local manualmente
const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || 
                     envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📋 Ejecutando migración directamente...\n');
  
  try {
    // Verificar si ya existe la columna
    const { data: existingColumns, error: checkError } = await supabase
      .from('costos')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error al verificar tabla:', checkError);
      return;
    }
    
    // Si llega aquí, podemos insertar datos de prueba
    console.log('✅ Tabla costos existe');
    console.log('\n⚠️  No se puede ejecutar ALTER TABLE desde el cliente de Supabase');
    console.log('📝 Por favor, ejecuta este SQL en el SQL Editor de Supabase Dashboard:\n');
    console.log('--------------------------------------------------');
    console.log('ALTER TABLE costos');
    console.log('ADD COLUMN IF NOT EXISTS precio_compra DECIMAL(10, 2) DEFAULT 0 NOT NULL;');
    console.log('');
    console.log('COMMENT ON COLUMN costos.precio_compra IS \'Precio de compra/costo de adquisición de la prenda\';');
    console.log('');
    console.log('CREATE INDEX IF NOT EXISTS idx_costos_precio_compra ON costos(precio_compra);');
    console.log('--------------------------------------------------\n');
    console.log('📍 URL: ' + supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/').split('.supabase')[0].replace('https://supabase.com/dashboard/project/', 'https://supabase.com/dashboard/project/') + '/sql');
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

applyMigration();

