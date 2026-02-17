const fs = require('fs');
const https = require('https');

// Leer .env.local manualmente
const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const serviceRoleKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

if (!serviceRoleKey) {
  console.error('❌ No se encontró SUPABASE_SERVICE_ROLE_KEY en .env.local');
  console.log('⚠️  Necesitas agregar la service role key para ejecutar DDL statements');
  process.exit(1);
}

const projectRef = supabaseUrl.split('//')[1].split('.')[0];

// Leer el archivo SQL
const sqlContent = fs.readFileSync('./supabase/crear_tabla_insumos.sql', 'utf8');

// Dividir el SQL en statements individuales
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log('🧵 Ejecutando SQL para crear tabla de insumos...\n');

async function ejecutarSQL() {
  const url = `${supabaseUrl}/rest/v1/rpc`;
  
  // Combinar todos los statements en uno solo
  const fullSQL = statements.join(';\n') + ';';
  
  console.log('📋 Ejecutando SQL...\n');
  
  const data = JSON.stringify({
    query: fullSQL
  });

  const options = {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ SQL ejecutado exitosamente!\n');
          resolve(responseData);
        } else {
          console.error(`❌ Error HTTP ${res.statusCode}`);
          console.error('Respuesta:', responseData);
          
          // Intentar método alternativo
          console.log('\n🔄 Probando método alternativo con pg...');
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error en la petición:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Método alternativo usando el cliente de Supabase con pg
async function ejecutarConPG() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  try {
    // Ejecutar cada statement por separado
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.toUpperCase().includes('INSERT INTO')) {
        console.log(`📝 Insertando datos de ejemplo...`);
        // Los inserts los manejamos con el cliente
        const match = stmt.match(/INSERT INTO public\.insumos \(([^)]+)\) VALUES\s+(.+)/);
        if (match) {
          const values = match[2].match(/\(([^)]+)\)/g);
          if (values) {
            for (const value of values) {
              const cleanValue = value.replace(/[()]/g, '').split(',').map(v => v.trim().replace(/^'|'$/g, ''));
              const [codigo, nombre, descripcion, presentacion, cantidad, activo] = cleanValue;
              
              const { error } = await supabase
                .from('insumos')
                .insert([{
                  codigo,
                  nombre,
                  descripcion: descripcion === 'NULL' ? null : descripcion,
                  presentacion,
                  cantidad_por_presentacion: parseFloat(cantidad),
                  activo: activo === 'true'
                }]);
              
              if (error && !error.message.includes('duplicate')) {
                console.error(`❌ Error insertando ${codigo}:`, error.message);
              } else if (!error) {
                console.log(`✅ Insumo ${codigo} creado`);
              }
            }
          }
        }
      }
    }
    
    // Verificar que la tabla existe y mostrar datos
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      console.log('\n✅ Tabla de insumos creada y lista!');
      console.log(`📊 Total de insumos: ${data.length}\n`);
      
      if (data.length > 0) {
        console.log('📦 Insumos registrados:');
        data.forEach((insumo, index) => {
          console.log(`${index + 1}. [${insumo.codigo}] ${insumo.nombre}`);
          console.log(`   ${insumo.presentacion} - ${insumo.cantidad_por_presentacion} unidades`);
        });
      }
    } else if (error) {
      console.log('\n⚠️  La tabla aún no existe. Debes crearla manualmente.');
      console.log('\n📍 Ve al SQL Editor de Supabase:');
      console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql`);
      console.log('\n📋 Y ejecuta el SQL del archivo:');
      console.log('   ./supabase/crear_tabla_insumos.sql\n');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Ejecutar
ejecutarConPG();

