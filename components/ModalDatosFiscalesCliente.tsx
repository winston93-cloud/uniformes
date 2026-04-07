'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { DatosFiscalesCliente } from '@/lib/types';
import { isUuid, resolverAlumnoUuidParaCotizacion } from '@/lib/resolverAlumnoCotizacion';

/** Claves frecuentes c_RegimenFiscal (SAT). El valor puede ampliarse según contabilidad. */
const REGIMENES_SAT: { value: string; label: string }[] = [
  { value: '601', label: '601 — Régimen General de Ley Personas Morales' },
  { value: '603', label: '603 — Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 — Sueldos y salarios e ingresos asimilados' },
  { value: '606', label: '606 — Arrendamiento' },
  { value: '608', label: '608 — Demás ingresos' },
  { value: '610', label: '610 — Residentes en el Extranjero sin PE' },
  { value: '611', label: '611 — Ingresos por dividendos' },
  { value: '612', label: '612 — Personas Físicas con Actividades Empresariales' },
  { value: '614', label: '614 — Ingresos por intereses' },
  { value: '616', label: '616 — Sin obligaciones fiscales' },
  { value: '620', label: '620 — Sociedades Cooperativas' },
  { value: '621', label: '621 — Incorporación Fiscal' },
  { value: '625', label: '625 — Régimen de las Actividades Empresariales (plataformas)' },
  { value: '626', label: '626 — Régimen Simplificado de Confianza' },
];

const USOS_CFDI: { value: string; label: string }[] = [
  { value: 'G01', label: 'G01 — Adquisición de mercancías' },
  { value: 'G02', label: 'G02 — Devoluciones, descuentos o bonificaciones' },
  { value: 'G03', label: 'G03 — Gastos en general' },
  { value: 'I01', label: 'I01 — Construcciones' },
  { value: 'I02', label: 'I02 — Mobiliario y equipo de oficina' },
  { value: 'I03', label: 'I03 — Equipo de transporte' },
  { value: 'I04', label: 'I04 — Equipo de cómputo y accesorios' },
  { value: 'D01', label: 'D01 — Honorarios médicos' },
  { value: 'D02', label: 'D02 — Gastos médicos por incapacidad' },
  { value: 'D03', label: 'D03 — Gastos funerales' },
  { value: 'D04', label: 'D04 — Donativos' },
  { value: 'P01', label: 'P01 — Por definir' },
  { value: 'S01', label: 'S01 — Sin efectos fiscales' },
];

function normalizarRfc(rfc: string): string {
  return rfc.trim().toUpperCase().replace(/\s+/g, '');
}

function rfcValidoFormato(rfc: string): boolean {
  const r = normalizarRfc(rfc);
  if (r.length !== 12 && r.length !== 13) return false;
  return /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(r);
}

function cpValido(cp: string): boolean {
  return /^\d{5}$/.test(cp.trim());
}

type Props = {
  open: boolean;
  onClose: () => void;
  tipoCliente: 'alumno' | 'externo';
  cliente: Record<string, unknown> | null;
};

export default function ModalDatosFiscalesCliente({ open, onClose, tipoCliente, cliente }: Props) {
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [registroId, setRegistroId] = useState<string | null>(null);

  const [rfc, setRfc] = useState('');
  const [nombreFiscal, setNombreFiscal] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('612');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('G03');
  const [emailFiscal, setEmailFiscal] = useState('');

  const nombreMostrarCliente = cliente
    ? String((cliente as { nombre?: string }).nombre || (cliente as { alumno_nombre?: string }).alumno_nombre || '')
    : '';

  const opcionesRegimen = useMemo(() => {
    const base = [...REGIMENES_SAT];
    if (regimenFiscal && !base.some((o) => o.value === regimenFiscal)) {
      base.unshift({ value: regimenFiscal, label: `${regimenFiscal} (actual)` });
    }
    return base;
  }, [regimenFiscal]);

  const opcionesUso = useMemo(() => {
    const base = [...USOS_CFDI];
    if (usoCfdi && !base.some((o) => o.value === usoCfdi)) {
      base.unshift({ value: usoCfdi, label: `${usoCfdi} (actual)` });
    }
    return base;
  }, [usoCfdi]);

  const resolverClienteUuid = useCallback(async (): Promise<{ alumnoUuid: string | null; externoUuid: string | null }> => {
    if (!cliente) throw new Error('No hay cliente seleccionado.');
    if (tipoCliente === 'externo') {
      const id = String((cliente as { id: string }).id);
      if (!isUuid(id)) throw new Error('Cliente externo inválido; vuelve a seleccionar el cliente.');
      return { alumnoUuid: null, externoUuid: id };
    }
    const legacyId = String((cliente as { id: string }).id);
    const ref = String((cliente as { referencia?: string }).referencia || (cliente as { alumno_ref?: string }).alumno_ref || '');
    const nombre = nombreMostrarCliente || 'Alumno';
    const uuid = await resolverAlumnoUuidParaCotizacion(legacyId, ref, nombre);
    return { alumnoUuid: uuid, externoUuid: null };
  }, [cliente, tipoCliente, nombreMostrarCliente]);

  const cargar = useCallback(async () => {
    if (!open || !cliente) return;
    setError(null);
    setCargando(true);
    setRegistroId(null);
    try {
      const { alumnoUuid, externoUuid } = await resolverClienteUuid();
      const col = alumnoUuid ? 'alumno_id' : 'externo_id';
      const fk = alumnoUuid || externoUuid;
      const { data, error: qErr } = await supabase
        .from('datos_fiscales_cliente')
        .select('*')
        .eq(col, fk)
        .maybeSingle();

      if (qErr) throw qErr;

      if (data) {
        const d = data as DatosFiscalesCliente;
        setRegistroId(d.id);
        setRfc(d.rfc);
        setNombreFiscal(d.nombre_fiscal);
        setRegimenFiscal(d.regimen_fiscal);
        setCodigoPostal(d.codigo_postal);
        setUsoCfdi(d.uso_cfdi);
        setEmailFiscal(d.email_fiscal || '');
      } else {
        setRegistroId(null);
        setRfc('');
        setNombreFiscal(nombreMostrarCliente);
        setRegimenFiscal('612');
        setCodigoPostal('');
        setUsoCfdi('G03');
        setEmailFiscal('');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos fiscales.');
    } finally {
      setCargando(false);
    }
  }, [open, cliente, resolverClienteUuid, nombreMostrarCliente]);

  useEffect(() => {
    if (open) void cargar();
  }, [open, cargar]);

  const guardar = async () => {
    setError(null);
    const rfcN = normalizarRfc(rfc);
    if (!rfcValidoFormato(rfcN)) {
      setError('RFC inválido: debe tener 12 caracteres (moral) o 13 (física), formato SAT.');
      return;
    }
    if (!nombreFiscal.trim()) {
      setError('Indica el nombre o razón social fiscal.');
      return;
    }
    if (!cpValido(codigoPostal.trim())) {
      setError('Código postal fiscal: exactamente 5 dígitos.');
      return;
    }
    if (!regimenFiscal.trim()) {
      setError('Selecciona el régimen fiscal.');
      return;
    }
    if (!usoCfdi.trim()) {
      setError('Selecciona el uso CFDI.');
      return;
    }

    setGuardando(true);
    try {
      const { alumnoUuid, externoUuid } = await resolverClienteUuid();
      const payload = {
        rfc: rfcN,
        nombre_fiscal: nombreFiscal.trim(),
        regimen_fiscal: regimenFiscal.trim(),
        codigo_postal: codigoPostal.trim(),
        uso_cfdi: usoCfdi.trim(),
        email_fiscal: emailFiscal.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (registroId) {
        const { error: uErr } = await supabase
          .from('datos_fiscales_cliente')
          .update(payload)
          .eq('id', registroId);
        if (uErr) throw uErr;
      } else {
        const insertRow = {
          ...payload,
          alumno_id: alumnoUuid,
          externo_id: externoUuid,
        };
        const { data: ins, error: iErr } = await supabase
          .from('datos_fiscales_cliente')
          .insert([insertRow])
          .select('id')
          .single();
        if (iErr) throw iErr;
        if (ins) setRegistroId((ins as { id: string }).id);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!registroId) return;
    if (!confirm('¿Eliminar los datos fiscales de este cliente?')) return;
    setEliminando(true);
    setError(null);
    try {
      const { error: dErr } = await supabase.from('datos_fiscales_cliente').delete().eq('id', registroId);
      if (dErr) throw dErr;
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar.');
    } finally {
      setEliminando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-datos-fiscales"
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <h2 id="titulo-datos-fiscales" style={{ margin: 0, fontSize: '1.35rem' }}>
            Datos fiscales (SAT)
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.95 }}>
            Receptor para CFDI 4.0 · {nombreMostrarCliente || 'Cliente'}
          </p>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {cargando ? (
            <p style={{ color: '#64748b' }}>Cargando…</p>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '0.9rem',
                  }}
                >
                  {error}
                </div>
              )}

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                RFC
              </label>
              <input
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                placeholder="Ej. XAXX010101000"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '1rem',
                }}
                maxLength={13}
              />

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Nombre o razón social (fiscal)
              </label>
              <input
                value={nombreFiscal}
                onChange={(e) => setNombreFiscal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '1rem',
                }}
              />

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Régimen fiscal
              </label>
              <select
                value={regimenFiscal}
                onChange={(e) => setRegimenFiscal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '0.95rem',
                }}
              >
                {opcionesRegimen.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Código postal fiscal
              </label>
              <input
                value={codigoPostal}
                onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="5 dígitos"
                inputMode="numeric"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '1rem',
                }}
                maxLength={5}
              />

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Uso de CFDI esperado
              </label>
              <select
                value={usoCfdi}
                onChange={(e) => setUsoCfdi(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '0.95rem',
                }}
              >
                {opcionesUso.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Correo para envío de CFDI (opcional)
              </label>
              <input
                type="email"
                value={emailFiscal}
                onChange={(e) => setEmailFiscal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  marginBottom: '1.25rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '1rem',
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'flex-end' }}>
                {registroId && (
                  <button
                    type="button"
                    onClick={() => void eliminar()}
                    disabled={eliminando || guardando}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: '2px solid #fecaca',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontWeight: 700,
                      cursor: eliminando ? 'wait' : 'pointer',
                    }}
                  >
                    {eliminando ? 'Eliminando…' : 'Eliminar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    background: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => void guardar()}
                  disabled={guardando || eliminando}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 800,
                    cursor: guardando ? 'wait' : 'pointer',
                  }}
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
