/**
 * Espejo opcional MySQL → InsForge (Bloque 4, sin activar en prod).
 * Activar con INSFORGE_MIRROR_ALUMNO_SYNC=1 en Vercel cuando se apruebe el corte.
 */
import { getInsforge } from '@/lib/insforge';

export async function mirrorAlumnoChunkToInsforge(
  rows: Record<string, unknown>[]
): Promise<{ mirrored: number; error: string | null }> {
  if (process.env.INSFORGE_MIRROR_ALUMNO_SYNC !== '1' && process.env.INSFORGE_MIRROR_ALUMNO_SYNC !== 'true') {
    return { mirrored: 0, error: null };
  }
  if (!rows.length) return { mirrored: 0, error: null };

  try {
    const { error } = await getInsforge().database.from('alumno').upsert(rows, { onConflict: 'alumno_ref' });
    if (error) throw error;
    return { mirrored: rows.length, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mirrorAlumnoChunkToInsforge]', msg);
    return { mirrored: 0, error: msg };
  }
}
