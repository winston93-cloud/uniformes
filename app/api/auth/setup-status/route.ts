import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';

export async function GET() {
  try {
    const { count, error } = await getInsforge().database
      .from('usuarios_uniformes')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return NextResponse.json({ needsSetup: (count ?? 0) === 0 });
  } catch (e) {
    console.error('GET /api/auth/setup-status', e);
    return NextResponse.json({ needsSetup: false, error: true }, { status: 500 });
  }
}
