function escapeRegexTableName(s: string) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Localiza `CREATE TABLE ... <tabla>` en un archivo (puede haber más SQL después) y devuelve
 * el statement completo con paréntesis balanceados — el mismo criterio que InsForge sanitize.
 */
export function extractCreateTableStatementForTable(fullText: string, table: string): string | null {
  const t = String(table || '').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) return null;
  const esc = escapeRegexTableName(t);

  const headerPatterns = [
    new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${esc}\\b`, 'i'),
    new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${esc}\\b`, 'i'),
    new RegExp(`CREATE\\s+TABLE\\s+public\\.${esc}\\b`, 'i'),
    new RegExp(`CREATE\\s+TABLE\\s+${esc}\\b`, 'i'),
  ];

  let start = -1;
  for (const re of headerPatterns) {
    const m = fullText.match(re);
    if (m?.index !== undefined && (start < 0 || m.index < start)) start = m.index;
  }
  if (start < 0) return null;

  const fromCreate = fullText.slice(start);
  const openIdx = fromCreate.indexOf('(');
  if (openIdx < 0) return null;

  let depth = 0;
  for (let i = openIdx; i < fromCreate.length; i++) {
    const ch = fromCreate[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < fromCreate.length && /\s/.test(fromCreate[end])) end += 1;
        if (end < fromCreate.length && fromCreate[end] === ';') end += 1;
        return fromCreate.slice(0, end);
      }
    }
  }
  return null;
}

/**
 * Extrae el primer CREATE TABLE ... para `public.<tabla>` manejando paréntesis anidados
 * (CHECK (...), varchar(...), etc.). Evita el bug clásico de regex `([\s\S]*)\)` que corta
 * en el primer ")".
 */

export function extractFirstPublicCreateTable(sql: string): {
  tableName: string;
  header: string;
  body: string;
  fullStatement: string;
} | null {
  const s = String(sql || '');
  const idxCreate = s.search(/\bcreate\s+table\b/i);
  if (idxCreate < 0) return null;

  const fromCreate = s.slice(idxCreate);
  const mHead = fromCreate.match(
    /^create\s+table\s+(if\s+not\s+exists\s+)?public\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/i
  );
  if (!mHead) return null;

  const ifNot = mHead[1] ? mHead[1] : '';
  const tableName = mHead[2];

  const openIdxRel = fromCreate.indexOf('(');
  if (openIdxRel < 0) return null;

  let depth = 0;
  let i = openIdxRel;
  const n = fromCreate.length;
  for (; i < n; i++) {
    const ch = fromCreate[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        const closeIdxRel = i;
        const stmtCore = fromCreate.slice(0, closeIdxRel + 1); // CREATE TABLE ... ( ... )
        const inner = fromCreate.slice(openIdxRel + 1, closeIdxRel);

        const tail = fromCreate.slice(closeIdxRel + 1).trimStart();
        const semi = tail.startsWith(';') ? ';' : '';

        const fullStatement = `${stmtCore}${semi}`;

        return {
          tableName,
          header: `CREATE TABLE ${ifNot}public.${tableName} (`,
          body: inner,
          fullStatement,
        };
      }
    }
  }

  return null;
}
