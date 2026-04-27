import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';
import { insforge } from '@/lib/insforge';

export type SyncState = {
  key: 'uniformes';
  baseline_ts: string | null;
  last_applied_ts: string | null;
};

export async function ensureSyncStateTable() {
  assertInsforgeConfigured();
  await runInsforgeMigrationsSql(`
CREATE TABLE IF NOT EXISTS public.uniformes_migracion_state (
  key TEXT PRIMARY KEY,
  baseline_ts TIMESTAMPTZ,
  last_applied_ts TIMESTAMPTZ
);
`);
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

