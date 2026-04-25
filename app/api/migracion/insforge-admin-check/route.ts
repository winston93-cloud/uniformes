import { NextResponse } from 'next/server';

function getInsforgeBaseUrl() {
  return process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
}

function getInsforgeAdminToken() {
  return process.env.INSFORGE_ADMIN_TOKEN ?? process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN;
}

export async function GET() {
  try {
    const baseUrl = getInsforgeBaseUrl();
    const token = getInsforgeAdminToken();
    if (!baseUrl) {
      return NextResponse.json(
        { success: false, configured: false, error: 'Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL' },
        { status: 200 }
      );
    }
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error:
            'Falta INSFORGE_ADMIN_TOKEN en Vercel (server). Agrega el token admin de InsForge y vuelve a desplegar.',
        },
        { status: 200 }
      );
    }

    const candidates = [
      '/api/database/migrations',
      '/api/database/migrations/',
      // endpoints admin alternos para detectar si el host sirve
      '/api/database/indexes',
      '/api/database/policies',
    ];

    const results: Array<{ path: string; status: number; ok: boolean; bodySnippet: string }> = [];
    for (const path of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const url = new URL(path, baseUrl).toString();
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: token,
        },
        cache: 'no-store',
      });
      // eslint-disable-next-line no-await-in-loop
      const text = await res.text();
      results.push({
        path,
        status: res.status,
        ok: res.ok,
        bodySnippet: String(text || '').slice(0, 240),
      });
    }

    const anyOk = results.some((r) => r.ok);
    return NextResponse.json(
      {
        success: anyOk,
        configured: true,
        baseUrl,
        results,
        hint:
          'Si todos dan 404 con HTML, la variable NEXT_PUBLIC_INSFORGE_URL probablemente apunta al Dashboard y no al host backend/API del proyecto.',
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { success: false, configured: false, error: e?.message || String(e) },
      { status: 200 }
    );
  }
}

