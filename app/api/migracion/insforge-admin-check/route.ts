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
    if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
    if (!token) throw new Error('Falta INSFORGE_ADMIN_TOKEN');

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
    return NextResponse.json({
      success: res.ok,
      status: res.status,
      body: text,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

