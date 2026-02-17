#!/usr/bin/env node
/**
 * Script para ejecutar migraciones en Supabase
 * Uso: node run-migration.js add_detalle_cotizacion_fields.sql
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function runMigration(filename) {
  const migrationPath = path.join(__dirname, 'migrations', filename);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migración no encontrada: ${filename}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`📄 Ejecutando migración: ${filename}\n`);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Migración ejecutada exitosamente\n');
    console.log(sql);
  } catch (error) {
    console.error('❌ Error al ejecutar migración:', error.message);
    console.error('\n📋 SQL a ejecutar manualmente en Supabase SQL Editor:\n');
    console.log(sql);
    process.exit(1);
  }
}

const filename = process.argv[2] || 'add_detalle_cotizacion_fields.sql';
runMigration(filename);
