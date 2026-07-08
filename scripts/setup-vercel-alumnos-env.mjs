#!/usr/bin/env node
/** Configura variables InsForge Alumnos (Winston Servicios) en Vercel proyecto uniformes. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const winCfg = JSON.parse(
  fs.readFileSync(path.join(ROOT, '../servicios_admin/.insforge/project.json'), 'utf8')
);

const vars = {
  NEXT_PUBLIC_INSFORGE_ALUMNOS_URL: winCfg.oss_host,
  INSFORGE_ALUMNOS_API_KEY: winCfg.api_key,
};

const environments = ['production', 'preview', 'development'];

function run(cmd, input) {
  execSync(cmd, {
    cwd: ROOT,
    input: input ?? undefined,
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

if (!fs.existsSync(path.join(ROOT, '.vercel/project.json'))) {
  run('npx vercel link --yes --project uniformes');
  console.log('✓ Proyecto enlazado a uniformes en Vercel');
}

for (const [name, value] of Object.entries(vars)) {
  for (const env of environments) {
    const sensitive = name.includes('KEY') ? ' --sensitive' : '';
    try {
      run(`npx vercel env add ${name} ${env} --yes --force${sensitive}`, value);
      console.log(`✓ ${name} → ${env}`);
    } catch (err) {
      const msg = err.stderr || err.message || String(err);
      console.error(`✗ ${name} → ${env}: ${String(msg).slice(0, 200)}`);
      process.exitCode = 1;
    }
  }
}

console.log('\n✓ Variables Winston Alumnos en Vercel (uniformes)');
