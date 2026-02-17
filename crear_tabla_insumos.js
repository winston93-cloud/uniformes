const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Leer .env.local manualmente
const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || 
                     envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearTablaInsumos() {
  console.log('🧵 Creando tabla de insumos...\n');
  
  try {
    // Leer el archivo SQL
    const sqlContent = fs.readFileSync('./supabase/crear_tabla_insumos.sql', 'utf8');
    
    console.log('📋 SQL a ejecutar:\n');
    console.log('--------------------------------------------------');
    console.log(sqlContent);
    console.log('--------------------------------------------------\n');
    
    // Intentar verificar si la tabla ya existe
    const { data: existingData, error: checkError } = await supabase
      .from('insumos')
      .select('*')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ La tabla "insumos" ya existe!');
      console.log(`📊 Registros actuales: ${existingData?.length || 0}\n`);
      
      // Mostrar los insumos existentes
      const { data: allInsumos } = await supabase
        .from('insumos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (allInsumos && allInsumos.length > 0) {
        console.log('📦 Insumos registrados:');
        allInsumos.forEach((insumo, index) => {
          console.log(`${index + 1}. ${insumo.codigo} - ${insumo.nombre} (${insumo.presentacion}, ${insumo.cantidad_por_presentacion} unidades)`);
        });
      }
      
      return;
    }
    
    console.log('⚠️  La tabla no existe. Debes ejecutar el SQL manualmente.\n');
    console.log('📝 Opciones para crear la tabla:\n');
    console.log('1️⃣  Copia y pega el SQL de arriba en el SQL Editor de Supabase');
    console.log('2️⃣  O ejecuta este comando:\n');
    console.log(`   psql ${supabaseUrl.replace('https://', 'postgresql://postgres:[PASSWORD]@').split('.supabase')[0].replace('postgresql://postgres:[PASSWORD]@', 'postgresql://postgres:[PASSWORD]@') + '.supabase.co:5432/postgres'} < ./supabase/crear_tabla_insumos.sql\n`);
    console.log('📍 SQL Editor URL:');
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql\n`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

crearTablaInsumos();

