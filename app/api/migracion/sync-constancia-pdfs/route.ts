import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getInsforge, assertInsforgeConfigured } from '@/lib/insforge';
import { BUCKET_CONSTANCIAS_FISCALES } from '@/lib/storageConstanciaFiscal';

/** Copia PDFs de constancia fiscal Supabase Storage → InsForge Storage (una vez post-corte). */
export async function POST() {
  try {
    assertInsforgeConfigured();
    const sb = getSupabaseAdmin();
    const ifDb = getInsforge().database;
    const ifStorage = getInsforge().storage.from(BUCKET_CONSTANCIAS_FISCALES);

    const { data: rows, error } = await ifDb
      .from('datos_fiscales_cliente')
      .select('id, constancia_pdf_path')
      .not('constancia_pdf_path', 'is', null);
    if (error) throw error;

    let copied = 0;
    const errors: string[] = [];

    for (const row of rows || []) {
      const path = String((row as { constancia_pdf_path?: string }).constancia_pdf_path || '').trim();
      if (!path) continue;
      try {
        const { data: blob, error: dlErr } = await sb.storage.from(BUCKET_CONSTANCIAS_FISCALES).download(path);
        if (dlErr) throw dlErr;
        if (!blob) throw new Error('Blob vacío');
        const { error: upErr } = await ifStorage.upload(path, blob);
        if (upErr) throw upErr;
        copied += 1;
      } catch (e: unknown) {
        errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: (rows || []).length,
      copied,
      errors,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
