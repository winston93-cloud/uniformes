/**
 * @deprecated Bloque 4 cortado: sync MySQL escribe directo en InsForge.
 * Archivo conservado por si hace falta espejo temporal SB; no usar en prod.
 */
import { getInsforge } from '@/lib/insforge';

export async function mirrorAlumnoChunkToInsforge(
  rows: Record<string, unknown>[]
): Promise<{ mirrored: number; error: string | null }> {
  if (!rows.length) return { mirrored: 0, error: null };
  try {
    const { error } = await getInsforge().database.from('alumno').upsert(rows, { onConflict: 'alumno_ref' });
    if (error) throw error;
    return { mirrored: rows.length, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { mirrored: 0, error: msg };
  }
}
