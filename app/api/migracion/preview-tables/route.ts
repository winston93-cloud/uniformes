import { NextResponse } from 'next/server';
import { previewInsforgeTableMigration } from '@/lib/migracion/previewInsforgeMigration';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Prechequeo sin tocar InsForge: DDL desde repo + validación del camino Tables API (saneado + parser).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tables?: unknown };
    const rawTables: unknown[] = Array.isArray(body.tables) ? body.tables : [];
    const names: string[] = rawTables
      .map((x: unknown) => String(x ?? '').trim())
      .filter((s: string) => s.length > 0);
    const tables: string[] = [...new Set(names)].filter(isSafeTableName);

    if (!tables.length) {
      return NextResponse.json({ success: false, error: 'Envía tables: string[] con al menos un nombre válido.' }, { status: 400 });
    }

    const rows = [];
    for (const table of tables) {
      // eslint-disable-next-line no-await-in-loop
      rows.push(await previewInsforgeTableMigration(table));
    }

    const okCount = rows.filter((r) => r.ok).length;
    const badCount = rows.length - okCount;

    return NextResponse.json({
      success: true,
      rows,
      summary: { total: rows.length, ok: okCount, problems: badCount },
      disclaimer:
        'Este chequeo valida sobre todo el fallback Tables API (POST /api/database/tables). Si tu InsForge tiene POST /api/database/migrations y acepta DDL crudo, una tabla puede migrar bien aunque aquí salga en rojo.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
