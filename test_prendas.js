// Script para probar si prendas contiene "BLUSA"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPrendas() {
  const { data, error } = await supabase
    .from('prendas')
    .select('*')
    .ilike('nombre', '%BLUSA%');
  
  console.log('Prendas con BLUSA:', data);
  console.log('Error:', error);
  
  const { data: allPrendas } = await supabase
    .from('prendas')
    .select('nombre, codigo, activo')
    .order('nombre');
  
  console.log('\nTodas las prendas:', allPrendas);
}

testPrendas();
