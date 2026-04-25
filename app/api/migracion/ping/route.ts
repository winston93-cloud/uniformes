import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';

function hostFromUrl(url: string | undefined | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    assertInsforgeConfigured();
    return NextResponse.json({
      success: true,
      supabaseHost: hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      insforgeHost: hostFromUrl(process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

