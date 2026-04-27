import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';
import { insforge } from '@/lib/insforge';
import { insforgeCreateTable, insforgeDeleteTable } from '@/lib/insforgeAdminTables';

export type SyncState = {
  key: 'uniformes';
  baseline_ts: string | null;
  last_applied_ts: string | null;
};

export async function ensureSyncStateTable() {
  assertInsforgeConfigured();
  // Esta tabla es SOLO para estado de migración. Si existe con un esquema viejo
  // (por ejemplo creado en intentos anteriores), la recreamos para evitar conflictos.
  // Nota: InsForge reserva nombres como id/created_at/updated_at; usamos `key`.
  try {
    await insforgeDeleteTable('uniformes_migracion_state');
  } catch {
    // ignore
  }
  try {
    await insforgeCreateTable({
      tableName: 'uniformes_migracion_state',
      rlsEnabled: false,
      columns: [
        { name: 'key', type: 'string', nullable: false, unique: true },
        { name: 'baseline_ts', type: 'datetime', nullable: true },
        { name: 'last_applied_ts', type: 'datetime', nullable: true },
      ],
    });
  } catch (e: any) {
    // Si ya existe por carrera, no fallar.
    const msg = String(e?.message || '');
    if (!msg.includes('DUPLICATE') && !msg.includes('already exists')) throw e;
  }
}

export async function getSyncState(): Promise<SyncState | null> {
  await ensureSyncStateTable();
  const { data, error } = await (insforge.database as any)
    .from('uniformes_migracion_state')
    .select('*')
    .eq('key', 'uniformes')
    .maybeSingle();
  if (error) throw new Error(error.message || String(error));
  return data ?? null;
}

export async function upsertSyncState(patch: Partial<SyncState>) {
  await ensureSyncStateTable();
  const row = {
    key: 'uniformes',
    ...patch,
  };
  const { error } = await (insforge.database as any)
    .from('uniformes_migracion_state')
    .upsert([row], { onConflict: 'key' });
  if (error) throw new Error(error.message || String(error));
}

