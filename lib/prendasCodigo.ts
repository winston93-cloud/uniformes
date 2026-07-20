import { insforgeDb } from '@/lib/insforgeBrowser';

/** Prefijo de 3 letras a partir del nombre (misma lógica que el formulario de prendas). */
export function prefijoCodigoDesdeNombre(nombre: string): string {
  if (!nombre || nombre.trim() === '') return '';

  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const palabras = sinAcentos.split(/\s+/);
  const palabrasClave: { [key: string]: string } = {
    CAMISA: 'CAM',
    PANTALON: 'PAN',
    PANTALÓN: 'PAN',
    PANTS: 'PAN',
    SUETER: 'SUE',
    SUÉTER: 'SUE',
    FALDA: 'FAL',
    DEPORTIVO: 'DEP',
    DEPORTIVA: 'DEP',
    ACCESORIO: 'ACC',
    BLUSA: 'BLU',
    PLAYERA: 'PLA',
    POLO: 'POL',
    CHALECO: 'CHA',
    SACO: 'SAC',
    ABRIGO: 'ABR',
  };

  for (const palabra of palabras) {
    const clave = Object.keys(palabrasClave).find((k) => palabra.includes(k));
    if (clave) return palabrasClave[clave];
  }

  return palabras[0]?.substring(0, 3).toUpperCase() || '';
}

export function siguienteNumeroCodigo(codigos: string[], prefijo: string): number {
  const base = prefijo.toUpperCase();
  const nums = codigos
    .filter((c) => c && c.toUpperCase().startsWith(base))
    .map((c) => {
      const match = c.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    });
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

export function formatearCodigoConNumero(prefijo: string, numero: number): string {
  return `${prefijo.toUpperCase()}-${String(numero).padStart(3, '0')}`;
}

/** Códigos del catálogo global (todas las tiendas), no solo el inventario filtrado. */
export async function fetchCodigosPrendasPorPrefijo(prefijo: string): Promise<string[]> {
  const p = prefijo.trim().toUpperCase();
  if (!p) return [];

  const { data, error } = await insforgeDb()
    .from('prendas')
    .select('codigo')
    .ilike('codigo', `${p}%`);

  if (error) {
    console.error('Error al consultar códigos de prendas:', error);
    return [];
  }

  return (data || [])
    .map((r) => String((r as { codigo?: string }).codigo || '').trim())
    .filter(Boolean);
}

export async function buscarPrendaPorCodigo(codigo: string): Promise<{
  id: string;
  codigo: string;
  nombre: string;
} | null> {
  const c = codigo.trim();
  if (!c) return null;

  const { data, error } = await insforgeDb()
    .from('prendas')
    .select('id, codigo, nombre')
    .ilike('codigo', c)
    .limit(1);

  if (error || !data?.length) return null;
  const row = data[0] as { id: string; codigo: string; nombre: string };
  return { id: String(row.id), codigo: String(row.codigo), nombre: String(row.nombre) };
}

/** Asigna el siguiente código libre en el catálogo global para un prefijo. */
export async function asignarSiguienteCodigoGlobal(prefijo: string): Promise<string> {
  const p = prefijo.trim().toUpperCase();
  if (!p) return '';
  const existentes = await fetchCodigosPrendasPorPrefijo(p);
  const n = siguienteNumeroCodigo(existentes, p);
  return formatearCodigoConNumero(p, n);
}
