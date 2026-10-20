'use client';

/** Errores y avisos que ve el usuario y que nunca llegan a la base; los lee el Main Control Room. */
export type TipoEventoCliente = 'error' | 'silencioso' | 'aviso';

const VENTANA_DUPLICADO_MS = 60_000;
const MAX_POR_SESION = 60;

const recientes = new Map<string, number>();
let enviados = 0;

export function registrarEventoCliente(tipo: TipoEventoCliente, mensaje: string, detalle?: string) {
  if (typeof window === 'undefined') return;
  const texto = String(mensaje ?? '').trim().slice(0, 500);
  if (!texto || enviados >= MAX_POR_SESION) return;

  const ahora = Date.now();
  const previo = recientes.get(texto);
  if (previo && ahora - previo < VENTANA_DUPLICADO_MS) return;
  recientes.set(texto, ahora);
  enviados += 1;

  try {
    void fetch('/api/eventos-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        tipo,
        pantalla: window.location.pathname,
        mensaje: texto,
        detalle: detalle?.slice(0, 2000),
      }),
    }).catch(() => {});
  } catch {}
}

const PATRON_ERROR = /error|no se pudo|no se encontr|fall[oóa]|❌|denegad|inválid/i;

/** Clasifica el texto de un alert(): error si suena a falla, aviso si es una validación. */
export function tipoDeAlerta(mensaje: string): TipoEventoCliente {
  return PATRON_ERROR.test(mensaje) ? 'error' : 'aviso';
}
