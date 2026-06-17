import { NextResponse } from 'next/server';
import { buscarAlumnosEnDb } from '@/lib/alumnoSearch';
import { getInsforge } from '@/lib/insforge';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }
    const cicloRaw = url.searchParams.get('ciclo');
    const cicloEscolar =
      cicloRaw != null && cicloRaw !== '' && Number.isFinite(Number(cicloRaw))
        ? Number(cicloRaw)
        : undefined;

    const data = await buscarAlumnosEnDb(getInsforge().database, q, cicloEscolar);
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
