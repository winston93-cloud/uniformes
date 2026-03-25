/** Misma lógica que en `app/api/produccion-semanal/plan/route.ts` (lunes = inicio de semana). */
export function getWeekForDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function weekBoundsFromOffset(semanaOffset: number) {
  const base = new Date();
  base.setDate(base.getDate() + semanaOffset * 7);
  const { monday, sunday } = getWeekForDate(base);
  return { fecha_inicio: toISODate(monday), fecha_fin: toISODate(sunday), monday, sunday };
}
