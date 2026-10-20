'use client';

import { useEffect } from 'react';
import { registrarEventoCliente, tipoDeAlerta } from '@/lib/eventosCliente';

function textoDe(valor: unknown): string {
  if (valor instanceof Error) return valor.message;
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object' && 'message' in valor) return String((valor as { message: unknown }).message);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

/** Reporta al Main Control Room los errores del navegador y los avisos que ve el usuario. */
export default function VigilantePantalla() {
  useEffect(() => {
    const alertOriginal = window.alert;
    const consoleErrorOriginal = console.error;

    window.alert = (mensaje?: unknown) => {
      const texto = textoDe(mensaje ?? '');
      registrarEventoCliente(tipoDeAlerta(texto), texto);
      alertOriginal.call(window, mensaje as string);
    };

    console.error = (...args: unknown[]) => {
      consoleErrorOriginal.apply(console, args);
      const [primero, ...resto] = args;
      const texto = textoDe(primero);
      if (/^Warning:/.test(texto)) return;
      registrarEventoCliente('error', texto, resto.length ? resto.map(textoDe).join(' | ') : undefined);
    };

    const alError = (e: ErrorEvent) =>
      registrarEventoCliente('error', e.message || 'Error de JavaScript', `${e.filename ?? ''}:${e.lineno ?? ''}`);
    const alRechazo = (e: PromiseRejectionEvent) =>
      registrarEventoCliente('error', textoDe(e.reason) || 'Promesa rechazada sin manejar');

    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);
    return () => {
      window.alert = alertOriginal;
      console.error = consoleErrorOriginal;
      window.removeEventListener('error', alError);
      window.removeEventListener('unhandledrejection', alRechazo);
    };
  }, []);

  return null;
}
