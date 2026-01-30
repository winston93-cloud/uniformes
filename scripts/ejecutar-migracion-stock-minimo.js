#!/usr/bin/env node

/**
 * Script para ejecutar la migración de stock_minimo en costos
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nmxrccrbnoenkahefrrw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teHJjY3Jibm9lbmthaGVmcnJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE1MTg0OCwiZXhwIjoyMDY5NzI3ODQ4fQ._SIR3rmq7TWukuym30cCP4BAKGe-dhnillDV0Bz6Hf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function ejecutarMigracion() {
  console.log('🔄 Ejecutando migración de stock_minimo...\n');

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../supabase/migrations/add_stock_minimo_costos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL a ejecutar:');
    console.log('---');
    console.log(sql);
    console.log('---\n');

    // Ejecutar la migración usando rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error ejecutando migración:', error);
      console.log('\n⚠️  Intenta ejecutar el SQL manualmente en el editor SQL de Supabase');
      return;
    }

    console.log('✅ Migración ejecutada exitosamente');
    console.log('📊 La columna stock_minimo ha sido agregada a la tabla costos');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 INSTRUCCIONES MANUALES:');
    console.log('1. Ve a https://supabase.com/dashboard');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a SQL Editor');
    console.log('4. Ejecuta el contenido del archivo:');
    console.log('   supabase/migrations/add_stock_minimo_costos.sql');
  }
}

// Ejecutar
ejecutarMigracion();
