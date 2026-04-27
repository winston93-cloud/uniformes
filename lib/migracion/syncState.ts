import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';
import { insforge } from '@/lib/insforge';

export type SyncState = {
  id: 'uniformes';
  baseline_ts: string | null;
  last_applied_ts: string | null;
  updated_at: string | null;
};

export async function ensureSyncStateTable() {
  assertInsforgeConfigured();
  await runInsforgeMigrationsSql(`
CREATE TABLE IF NOT EXISTS public.uniformes_migracion_state (
  id TEXT PRIMARY KEY,
  baseline_ts TIMESTAMPTZ,
  last_applied_ts TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`);
}

export async function getSyncState(): Promise<SyncState | null> {
  await ensureSyncStateTable();
  const { data, error } = await (insforge.database as any)
    .from('uniformes_migracion_state')
    .select('*')
    .eq('id', 'uniformes')
    .maybeSingle();
  if (error) throw new Error(error.message || String(error));
  return data ?? null;
}

export async function upsertSyncState(patch: Partial<SyncState>) {
  await ensureSyncStateTable();
  const row = {
    id: 'uniformes',
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (insforge.database as any)
    .from('uniformes_migracion_state')
    .upsert([row], { onConflict: 'id' });
  if (error) throw new Error(error.message || String(error));
}

