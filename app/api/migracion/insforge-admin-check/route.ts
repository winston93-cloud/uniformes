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

    const url = new URL('/api/database/migrations', baseUrl).toString();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: token,
      },
      cache: 'no-store',
    });
    const text = await res.text();
    return NextResponse.json(
      {
        success: res.ok,
        configured: true,
        status: res.status,
        body: text,
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

