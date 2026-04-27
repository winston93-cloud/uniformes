/** Tablas `public.*` referenciadas en FKs dentro de un fragmento DDL. */
export function extractReferencedPublicTablesFromDdl(ddl: string): string[] {
  const refs = new Set<string>();
  const re = /REFERENCES\s+public\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  for (;;) {
    m = re.exec(ddl);
    if (!m) break;
    refs.add(m[1]);
  }
  return [...refs];
}
