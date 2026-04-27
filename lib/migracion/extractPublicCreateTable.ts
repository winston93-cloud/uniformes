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
