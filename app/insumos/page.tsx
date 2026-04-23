'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import AuxiliarCatalogoModal from '@/components/AuxiliarCatalogoModal';
import { useInsumos } from '@/lib/hooks/useInsumos';
import { usePresentaciones } from '@/lib/hooks/usePresentaciones';
import { useUbicacionesAlmacenamiento } from '@/lib/hooks/useUbicacionesAlmacenamiento';
import { supabase } from '@/lib/supabase';
import type { Insumo } from '@/lib/types';
import {
  parseNumeroFormateado,
  formatearNumeroMilesDecimalesAlEscribir,
  formatoNumeroDesdeDb,
} from '@/lib/formatNumericInput';

export const dynamic = 'force-dynamic';

// Función para generar código automático
const generarCodigo = (nombre: string, insumos: Insumo[]): string => {
  if (!nombre || nombre.trim() === '') return '';
  
  // Remover acentos y caracteres especiales
  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // Tomar las primeras 3 letras
  const prefijo = sinAcentos.substring(0, 3);
  
  // Buscar el siguiente número secuencial
  const codigosSimilares = insumos
    .filter(i => i.codigo && i.codigo.startsWith(prefijo))
    .map(i => {
      const match = i.codigo?.match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    });
  
  const siguienteNumero = codigosSimilares.length > 0 
    ? Math.max(...codigosSimilares) + 1 
    : 1;
  
  return `${prefijo}-${String(siguienteNumero).padStart(3, '0')}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function textoAlmacenInsumo(insumo: Insumo): string {
  const partes = insumo.insumo_ubicaciones;
  if (partes && partes.length > 0) {
    return partes
      .map((p) => {
        const nom = p.ubicacion?.nombre || '?';
        const q = Number(p.cantidad ?? 0);
        const s = formatoNumeroDesdeDb(q);
        return `${nom} (${s})`;
      })
      .join(', ');
  }
  return insumo.ubicacion_almacenamiento?.nombre || '-';
}

function stockExistenteInsumo(insumo: Insumo): number {
  const partes = insumo.insumo_ubicaciones;
  if (partes && partes.length > 0) {
    return partes.reduce((s, p) => s + (Number(p.cantidad ?? 0) || 0), 0);
  }
  // Respaldo: si la BD trae un stock total, úsalo.
  const s = Number((insumo as any).stock);
  return Number.isFinite(s) ? s : 0;
}

export default function InsumosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [modalExitoAbierto, setModalExitoAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { insumos, loading, error, createInsumo, updateInsumo, deleteInsumo } = useInsumos();
  const {
    presentaciones,
    loading: loadingPresentaciones,
    createPresentacion,
    updatePresentacion,
    deletePresentacion,
  } = usePresentaciones();
  const {
    ubicaciones,
    loading: loadingUbicaciones,
    createUbicacion,
    updateUbicacion,
    deleteUbicacion,
  } = useUbicacionesAlmacenamiento();

  const [auxTipo, setAuxTipo] = useState<null | 'presentacion' | 'ubicacion'>(null);
  const [auxModo, setAuxModo] = useState<'crear' | 'editar'>('crear');
  const [auxForm, setAuxForm] = useState({ nombre: '', descripcion: '', activo: true });
  const [auxError, setAuxError] = useState<string | null>(null);
  const [auxGuardando, setAuxGuardando] = useState(false);

  const [ubicacionCatalogoSeleccionada, setUbicacionCatalogoSeleccionada] = useState('');
  /** Partidas por ubicación (misma lógica que Prendas → Configurar stock) */
  const [ubicacionesInsumo, setUbicacionesInsumo] = useState<
    Array<{ tempId: string; ubicacion_id: string; cantidad: string }>
  >([]);

  const [modalAjusteStockAbierto, setModalAjusteStockAbierto] = useState(false);
  const [ajusteTipo, setAjusteTipo] = useState<'SUMAR' | 'RESTAR'>('SUMAR');
  const [ajusteUbicacionId, setAjusteUbicacionId] = useState('');
  const [ajusteCantidad, setAjusteCantidad] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  const cerrarAuxModal = () => {
    setAuxTipo(null);
    setAuxError(null);
    setAuxGuardando(false);
  };

  const abrirNuevaPresentacion = () => {
    setAuxForm({ nombre: '', descripcion: '', activo: true });
    setAuxModo('crear');
    setAuxTipo('presentacion');
    setAuxError(null);
  };

  const abrirEditarPresentacion = () => {
    const id = formData.presentacion_id;
    if (!id) return;
    const p = presentaciones.find((x) => x.id === id);
    if (!p) return;
    setAuxForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      activo: p.activo,
    });
    setAuxModo('editar');
    setAuxTipo('presentacion');
    setAuxError(null);
  };

  const eliminarPresentacionSeleccionada = async (desdeModalAux = false) => {
    const id = formData.presentacion_id;
    if (!id) return;
    if (!confirm('¿Eliminar este proveedor del catálogo? Si está en uso, la base de datos puede rechazar la operación.')) {
      return;
    }
    setAuxGuardando(true);
    const { error: err } = await deletePresentacion(id);
    setAuxGuardando(false);
    if (err) {
      if (desdeModalAux) setAuxError(err);
      else {
        setMensajeError(`❌ ${err}`);
        setModalErrorAbierto(true);
      }
      return;
    }
    setFormData((f) => ({ ...f, presentacion_id: '' }));
    if (desdeModalAux) cerrarAuxModal();
  };

  const abrirNuevaUbicacion = () => {
    setAuxForm({ nombre: '', descripcion: '', activo: true });
    setAuxModo('crear');
    setAuxTipo('ubicacion');
    setAuxError(null);
  };

  const abrirEditarUbicacion = () => {
    const id = ubicacionCatalogoSeleccionada;
    if (!id) return;
    const u = ubicaciones.find((x) => x.id === id);
    if (!u) return;
    setAuxForm({
      nombre: u.nombre,
      descripcion: u.descripcion || '',
      activo: u.activo,
    });
    setAuxModo('editar');
    setAuxTipo('ubicacion');
    setAuxError(null);
  };

  const eliminarUbicacionSeleccionada = async (desdeModalAux = false) => {
    const id = ubicacionCatalogoSeleccionada;
    if (!id) return;
    if (!confirm('¿Eliminar esta ubicación? Si está en uso, la base de datos puede rechazar la operación.')) {
      return;
    }
    setAuxGuardando(true);
    const { error: err } = await deleteUbicacion(id);
    setAuxGuardando(false);
    if (err) {
      if (desdeModalAux) setAuxError(err);
      else {
        setMensajeError(`❌ ${err}`);
        setModalErrorAbierto(true);
      }
      return;
    }
    setUbicacionCatalogoSeleccionada('');
    setUbicacionesInsumo((prev) => prev.filter((p) => p.ubicacion_id !== id));
    if (desdeModalAux) cerrarAuxModal();
  };

  const handleAuxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuxError(null);
    const nombreTrim = auxForm.nombre.trim();
    if (!nombreTrim) {
      setAuxError('El nombre es obligatorio.');
      return;
    }
    setAuxGuardando(true);
    try {
      if (auxTipo === 'presentacion') {
        const payload = {
          nombre: nombreTrim.toUpperCase(),
          descripcion: auxForm.descripcion.trim() || null,
          activo: auxForm.activo,
        };
        if (auxModo === 'crear') {
          const { data, error: err } = await createPresentacion(payload);
          if (err) {
            setAuxError(err);
            return;
          }
          if (data) setFormData((f) => ({ ...f, presentacion_id: data.id }));
          cerrarAuxModal();
        } else {
          const id = formData.presentacion_id;
          if (!id) {
            setAuxError('No hay proveedor seleccionado.');
            return;
          }
          const { error: err } = await updatePresentacion(id, payload);
          if (err) {
            setAuxError(err);
            return;
          }
          cerrarAuxModal();
        }
      } else if (auxTipo === 'ubicacion') {
        const payload = {
          nombre: nombreTrim,
          descripcion: auxForm.descripcion.trim() || null,
          activo: auxForm.activo,
        };
        if (auxModo === 'crear') {
          const { data, error: err } = await createUbicacion(payload);
          if (err) {
            setAuxError(err);
            return;
          }
          if (data) setUbicacionCatalogoSeleccionada(data.id);
          cerrarAuxModal();
        } else {
          const id = ubicacionCatalogoSeleccionada;
          if (!id) {
            setAuxError('No hay ubicación seleccionada.');
            return;
          }
          const { error: err } = await updateUbicacion(id, payload);
          if (err) {
            setAuxError(err);
            return;
          }
          cerrarAuxModal();
        }
      }
    } finally {
      setAuxGuardando(false);
    }
  };


  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    presentacion_id: '',
    cantidad_por_presentacion: '',
    unidad_medida: 'unidades',
    costo_compra: '',
    stock_inicial: '',
    stock_minimo: '',
    activo: true,
  });

  const stockTotalInsumoForm = () => parseNumeroFormateado(formData.stock_inicial);
  const sumUbicacionesInsumo = () =>
    ubicacionesInsumo.reduce((s, p) => s + parseNumeroFormateado(p.cantidad), 0);

  const abrirAjusteStock = () => {
    if (!insumoEditando) return;
    const ubDefault =
      ubicacionCatalogoSeleccionada ||
      ubicacionesInsumo[0]?.ubicacion_id ||
      insumoEditando.ubicacion_almacenamiento_id ||
      '';
    setAjusteTipo('SUMAR');
    setAjusteUbicacionId(ubDefault);
    setAjusteCantidad('');
    setAjusteMotivo('');
    setModalAjusteStockAbierto(true);
  };

  const aplicarAjusteStock = async () => {
    if (!insumoEditando) return;
    const qtyRaw = parseNumeroFormateado(ajusteCantidad);
    const qty = Math.max(0, round2(qtyRaw));
    if (!ajusteUbicacionId) {
      alert('Elige una ubicación.');
      return;
    }
    if (!qty || qty <= 0) {
      alert('Indica una cantidad mayor a 0.');
      return;
    }

    const delta = ajusteTipo === 'SUMAR' ? qty : -qty;
    const prev = ubicacionesInsumo.find((u) => u.ubicacion_id === ajusteUbicacionId);
    const prevQty = prev ? round2(parseNumeroFormateado(prev.cantidad)) : 0;
    const nextQty = round2(prevQty + delta);
    if (nextQty < 0) {
      alert(
        `No puedes restar ${formatoNumeroDesdeDb(qty)} porque en esa ubicación solo hay ${formatoNumeroDesdeDb(prevQty)}.`
      );
      return;
    }

    try {
      const { data: existing, error: exErr } = await supabase
        .from('insumo_ubicaciones')
        .select('id')
        .eq('insumo_id', insumoEditando.id)
        .eq('ubicacion_almacenamiento_id', ajusteUbicacionId)
        .maybeSingle();
      if (exErr) throw exErr;

      if (existing?.id) {
        if (nextQty <= 0) {
          const { error: delErr } = await supabase.from('insumo_ubicaciones').delete().eq('id', existing.id);
          if (delErr) throw delErr;
        } else {
          const { error: updErr } = await supabase
            .from('insumo_ubicaciones')
            .update({ cantidad: nextQty })
            .eq('id', existing.id);
          if (updErr) throw updErr;
        }
      } else if (nextQty > 0) {
        const { error: insErr } = await supabase.from('insumo_ubicaciones').insert({
          insumo_id: insumoEditando.id,
          ubicacion_almacenamiento_id: ajusteUbicacionId,
          cantidad: nextQty,
        });
        if (insErr) throw insErr;
      }

      const { data: filasUb, error: errUb } = await supabase
        .from('insumo_ubicaciones')
        .select('id, ubicacion_almacenamiento_id, cantidad')
        .eq('insumo_id', insumoEditando.id);
      if (errUb) throw errUb;

      const nextUi = (filasUb || []).map((f: any) => ({
        tempId: f.id,
        ubicacion_id: f.ubicacion_almacenamiento_id,
        cantidad: formatoNumeroDesdeDb(Number(f.cantidad ?? 0)),
      }));
      setUbicacionesInsumo(nextUi);

      const nextTotal = round2((filasUb || []).reduce((s: number, f: any) => s + (Number(f.cantidad) || 0), 0));
      const { error: upInsumoErr } = await supabase
        .from('insumos')
        .update({ stock: nextTotal, stock_inicial: nextTotal })
        .eq('id', insumoEditando.id);
      if (upInsumoErr) throw upInsumoErr;

      setFormData((fd) => ({ ...fd, stock_inicial: formatoNumeroDesdeDb(nextTotal) }));
      setModalAjusteStockAbierto(false);
      alert(
        `✅ Ajuste aplicado (${ajusteTipo === 'SUMAR' ? '+' : '−'}${formatoNumeroDesdeDb(qty)}).` +
          (ajusteMotivo.trim() ? `\nMotivo: ${ajusteMotivo.trim()}` : '')
      );
    } catch (e: any) {
      console.error(e);
      alert(`❌ No se pudo aplicar el ajuste de stock: ${e?.message || e}`);
    }
  };

  const agregarUbicacionSeleccionadaAlInsumo = () => {
    const id = ubicacionCatalogoSeleccionada;
    if (!id) {
      alert('Elige una ubicación en el listado.');
      return;
    }
    const total = stockTotalInsumoForm();
    if (total <= 0) {
      alert(
        'Con stock en 0 no hace falta agregar ubicaciones. Si ya agregaste alguna con cantidad 0, quítala con «Quitar» o borra el campo de stock y vuelve a intentar.'
      );
      return;
    }
    if (ubicacionesInsumo.some((u) => u.ubicacion_id === id)) return;
    const sumOtros = ubicacionesInsumo.reduce(
      (s, p) => s + parseNumeroFormateado(p.cantidad),
      0
    );
    const restante = Math.max(0, round2(total - sumOtros));
    setUbicacionesInsumo((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ubicacion_id: id,
        cantidad: formatoNumeroDesdeDb(restante),
      },
    ]);
  };

  useEffect(() => {
    const cargarUbicacionesInsumo = async () => {
      if (!mostrarFormulario || !insumoEditando) {
        setUbicacionesInsumo([]);
        setUbicacionCatalogoSeleccionada('');
        return;
      }
      try {
        const { data: filasUb, error: errUb } = await supabase
          .from('insumo_ubicaciones')
          .select('id, ubicacion_almacenamiento_id, cantidad')
          .eq('insumo_id', insumoEditando.id);

        if (errUb) {
          console.error('insumo_ubicaciones:', errUb);
          setUbicacionesInsumo([]);
        } else if (filasUb && filasUb.length > 0) {
          setUbicacionesInsumo(
            filasUb.map((f) => ({
              tempId: f.id,
              ubicacion_id: f.ubicacion_almacenamiento_id,
              cantidad: formatoNumeroDesdeDb(Number(f.cantidad ?? 0)),
            }))
          );
        } else if (
          insumoEditando.ubicacion_almacenamiento_id &&
          Number(insumoEditando.stock ?? insumoEditando.stock_inicial ?? 0) > 0
        ) {
          setUbicacionesInsumo([
            {
              tempId: `legacy-${insumoEditando.id}`,
              ubicacion_id: insumoEditando.ubicacion_almacenamiento_id,
              cantidad: formatoNumeroDesdeDb(
                Number(insumoEditando.stock ?? insumoEditando.stock_inicial ?? 0)
              ),
            },
          ]);
        } else {
          setUbicacionesInsumo([]);
        }
        setUbicacionCatalogoSeleccionada(insumoEditando.ubicacion_almacenamiento_id || '');
      } catch (e) {
        console.error(e);
        setUbicacionesInsumo([]);
      }
    };
    cargarUbicacionesInsumo();
  }, [mostrarFormulario, insumoEditando?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');

    // Stock existente y mínimo permiten 0 (alta sin inventario / sin umbral de alerta). Nunca negativos (CHECK en BD).
    const totalStock = Math.max(0, round2(parseNumeroFormateado(formData.stock_inicial)));
    const stockMinimo = Math.max(0, round2(parseNumeroFormateado(formData.stock_minimo)));
    const partidasConInventario = ubicacionesInsumo.filter(
      (p) => round2(parseNumeroFormateado(p.cantidad)) > 0
    );
    const sumDistrib = ubicacionesInsumo.reduce(
      (s, p) => s + parseNumeroFormateado(p.cantidad),
      0
    );

    // Stock 0: permitir guardar aunque queden filas en UI con cantidad 0 (p. ej. tras usar «Al insumo» antes de corregir).
    if (totalStock === 0) {
      if (partidasConInventario.length > 0) {
        setMensajeError(
          '❌ Con stock en 0 no puede haber cantidades por ubicación mayores a 0. Ajusta las partidas o indica el stock total correcto.'
        );
        setModalErrorAbierto(true);
        return;
      }
    } else if (totalStock > 0) {
      if (partidasConInventario.length === 0) {
        setMensajeError(
          '❌ Con stock mayor a 0, agrega al menos una ubicación y reparte la cantidad.'
        );
        setModalErrorAbierto(true);
        return;
      }
      if (round2(sumDistrib) !== round2(totalStock)) {
        setMensajeError(
          `❌ La suma por ubicación (${formatoNumeroDesdeDb(sumDistrib)}) debe ser igual al stock existente (${formatoNumeroDesdeDb(totalStock)}).`
        );
        setModalErrorAbierto(true);
        return;
      }
    }

    const insumoData = {
      nombre: formData.nombre,
      codigo: formData.codigo,
      descripcion: formData.descripcion || null,
      presentacion_id: formData.presentacion_id.trim() ? formData.presentacion_id : null,
      cantidad_por_presentacion:
        insumoEditando != null
          ? insumoEditando.cantidad_por_presentacion
          : 1,
      unidad_medida: (formData.unidad_medida || 'unidades').trim() || 'unidades',
      costo_compra: parseNumeroFormateado(formData.costo_compra),
      stock_inicial: totalStock,
      stock: totalStock,
      stock_minimo: stockMinimo,
      ubicacion_almacenamiento_id: null as string | null,
      activo: formData.activo,
    };

    const aplicarUbicacionesInsumo = async (insumoId: string) => {
      const { error: delErr } = await supabase
        .from('insumo_ubicaciones')
        .delete()
        .eq('insumo_id', insumoId);
      if (delErr) throw delErr;
      if (totalStock > 0 && ubicacionesInsumo.length > 0) {
        const inserts = ubicacionesInsumo
          .map((p) => ({
            insumo_id: insumoId,
            ubicacion_almacenamiento_id: p.ubicacion_id,
            cantidad: round2(parseNumeroFormateado(p.cantidad)),
          }))
          .filter((row) => row.cantidad > 0);
        if (inserts.length > 0) {
          const { error: insErr } = await supabase.from('insumo_ubicaciones').insert(inserts);
          if (insErr) throw insErr;
        }
      }
    };

    const resetTrasExito = () => {
      setModalExitoAbierto(false);
      setMensajeExito('');
      setFormData({
        nombre: '',
        codigo: '',
        descripcion: '',
        presentacion_id: '',
        cantidad_por_presentacion: '',
        unidad_medida: 'unidades',
        costo_compra: '',
        stock_inicial: '',
        stock_minimo: '',
        activo: true,
      });
      setUbicacionesInsumo([]);
      setUbicacionCatalogoSeleccionada('');
      setMostrarFormulario(false);
      setInsumoEditando(null);
      setBotonEstado('normal');
      setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
    };

    if (insumoEditando) {
      const { error } = await updateInsumo(insumoEditando.id, insumoData);
      if (error) {
        setMensajeError(`❌ Error al actualizar: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      try {
        await aplicarUbicacionesInsumo(insumoEditando.id);
      } catch (err: any) {
        setMensajeError(`❌ Insumo guardado pero falló guardar ubicaciones: ${err.message}`);
        setModalErrorAbierto(true);
        return;
      }
      setMensajeExito('✅ Insumo actualizado correctamente');
      setModalExitoAbierto(true);
      setTimeout(resetTrasExito, 2000);
    } else {
      const { data, error } = await createInsumo(insumoData);
      if (error) {
        setMensajeError(`❌ Error al crear: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      if (!data?.id) {
        setMensajeError('❌ No se obtuvo el id del insumo creado.');
        setModalErrorAbierto(true);
        return;
      }
      try {
        await aplicarUbicacionesInsumo(data.id);
      } catch (err: any) {
        setMensajeError(`❌ Insumo creado pero falló guardar ubicaciones: ${err.message}`);
        setModalErrorAbierto(true);
        return;
      }
      setMensajeExito('✅ Insumo creado correctamente');
      setModalExitoAbierto(true);
      setTimeout(resetTrasExito, 2000);
    }
  };

  const handleEditar = (insumo: Insumo) => {
    setInsumoEditando(insumo);
    const totalNum = Number(insumo.stock ?? insumo.stock_inicial ?? 0);
    const minNum = Number(insumo.stock_minimo ?? 0);
    setFormData({
      nombre: insumo.nombre,
      codigo: insumo.codigo,
      descripcion: insumo.descripcion || '',
      presentacion_id: insumo.presentacion_id ?? '',
      cantidad_por_presentacion: insumo.cantidad_por_presentacion.toString(),
      unidad_medida: (insumo.unidad_medida && insumo.unidad_medida.trim()) || 'unidades',
      costo_compra: formatoNumeroDesdeDb(Number(insumo.costo_compra ?? 0)),
      stock_inicial: formatoNumeroDesdeDb(totalNum),
      stock_minimo: formatoNumeroDesdeDb(minNum),
      activo: insumo.activo,
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este insumo?')) {
      const { error } = await deleteInsumo(id);
      if (!error) {
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleNuevo = () => {
    setInsumoEditando(null);
    setUbicacionesInsumo([]);
    setUbicacionCatalogoSeleccionada('');
    setFormData({
      nombre: '',
      codigo: '',
      descripcion: '',
      presentacion_id: '',
      cantidad_por_presentacion: '',
      unidad_medida: 'unidades',
      costo_compra: '',
      stock_inicial: '',
      stock_minimo: '',
      activo: true,
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  // Manejar cambio en el nombre para generar código automático
  const handleNombreChange = (nombre: string) => {
    const nombreMayusculas = nombre.toUpperCase();
    if (!insumoEditando && nombreMayusculas) {
      const codigoGenerado = generarCodigo(nombreMayusculas, insumos);
      setFormData({ ...formData, nombre: nombreMayusculas, codigo: codigoGenerado });
    } else {
      setFormData({ ...formData, nombre: nombreMayusculas });
    }
  };

  // Auto-focus en el input de búsqueda al cargar la página
  useEffect(() => {
    if (!loading && inputBusquedaRef.current) {
      const timer = setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Filtrar insumos según la búsqueda
  const insumosFiltrados = insumos.filter((insumo) => {
    const q = busqueda.toLowerCase();
    const textoUb = textoAlmacenInsumo(insumo).toLowerCase();
    return (
      insumo.nombre.toLowerCase().includes(q) ||
      (insumo.codigo && insumo.codigo.toLowerCase().includes(q)) ||
      (insumo.descripcion && insumo.descripcion.toLowerCase().includes(q)) ||
      (insumo.presentacion?.nombre && insumo.presentacion.nombre.toLowerCase().includes(q)) ||
      (insumo.unidad_medida && insumo.unidad_medida.toLowerCase().includes(q)) ||
      textoUb.includes(q)
    );
  });

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="main-container">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1rem', textAlign: 'center' }}>
            🧵 Catálogo de Insumos
          </h1>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por nombre, código, descripción, proveedor, unidad o almacén..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {insumosFiltrados.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron insumos</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {insumosFiltrados.length} insumo{insumosFiltrados.length !== 1 ? 's' : ''} encontrado{insumosFiltrados.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los insumos: {error}
          </div>
        )}

        {/* Formulario Modal */}
        {mostrarFormulario && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto',
            }}
            onClick={() => {
              setMostrarFormulario(false);
              setInsumoEditando(null);
              setUbicacionesInsumo([]);
              setUbicacionCatalogoSeleccionada('');
              setFormData({
                nombre: '',
                codigo: '',
                descripcion: '',
                presentacion_id: '',
                cantidad_por_presentacion: '',
                unidad_medida: 'unidades',
                costo_compra: '',
                stock_inicial: '',
                stock_minimo: '',
                activo: true,
              });
              setTimeout(() => {
                inputBusquedaRef.current?.focus();
              }, 100);
            }}
          >
            <div
              className="form-container"
              style={{
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '2rem auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="form-title">
                {insumoEditando ? 'Editar Insumo' : 'Nuevo Insumo'}
              </h2>
              
              <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre del Insumo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  placeholder="Ej: Botones Blancos, Tela Azul, Hilo Poliéster, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Se genera automáticamente"
                  required
                  style={{
                    backgroundColor: insumoEditando ? '#f0f0f0' : 'white',
                    cursor: insumoEditando ? 'not-allowed' : 'text',
                    color: insumoEditando ? '#666' : 'inherit'
                  }}
                  readOnly={!!insumoEditando}
                />
                {insumoEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    ⚠️ El código no se puede modificar en modo edición
                  </small>
                )}
                {!insumoEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    El código se genera automáticamente al escribir el nombre
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'stretch',
                    marginBottom: '0.35rem',
                  }}
                >
                  <select
                    className="form-select"
                    value={formData.presentacion_id}
                    onChange={(e) => setFormData({ ...formData, presentacion_id: e.target.value })}
                    disabled={loadingPresentaciones || auxGuardando}
                    style={{ flex: '1 1 200px', minWidth: 'min(100%, 12rem)' }}
                  >
                    <option value="">Sin proveedor (opcional)</option>
                    {presentaciones.map((pres) => (
                      <option key={pres.id} value={pres.id}>
                        {pres.nombre}
                        {!pres.activo ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={abrirNuevaPresentacion}
                    disabled={loadingPresentaciones || auxGuardando}
                  >
                    + Nueva
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={abrirEditarPresentacion}
                    disabled={!formData.presentacion_id || loadingPresentaciones || auxGuardando}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={() => void eliminarPresentacionSeleccionada(false)}
                    disabled={!formData.presentacion_id || loadingPresentaciones || auxGuardando}
                  >
                    Eliminar
                  </button>
                </div>
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Opcional. Puedes crear o editar entradas del catálogo con + Nueva / Editar sin salir del formulario.
                </small>
              </div>

              {/*
              <div className="form-group">
                <label className="form-label">Cantidad por presentación *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.cantidad_por_presentacion}
                  onChange={(e) => setFormData({ ...formData, cantidad_por_presentacion: e.target.value })}
                  placeholder="Ej: 500 o 10000"
                  required
                  min="0"
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Cuánto trae cada presentación según el número de arriba (ej. 500 botones por bolsa, 10 000 metros por rollo).
                </small>
              </div>
              */}

              <div className="form-group">
                <label className="form-label">Unidad de medida *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.unidad_medida}
                  onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                  placeholder="Ej: metros, unidades, kg, rollos"
                  required
                  style={{ borderLeft: '4px solid #0ea5e9' }}
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  En qué mides el insumo (metros, botones, agujas, etc.). Ej.: <strong>metros</strong> para hilo, <strong>unidades</strong> para piezas sueltas.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">💰 Costo de Compra</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="form-input"
                  value={formData.costo_compra}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costo_compra: formatearNumeroMilesDecimalesAlEscribir(e.target.value),
                    })
                  }
                  placeholder="Ej: 1,500.00"
                  style={{
                    borderLeft: '4px solid #10b981',
                  }}
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Costo de compra por presentación (Ej: si una bolsa de 500 botones cuesta $150.00, ingresar 150.00). Si no se ingresa, se establece en $0.00
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">📦 Stock Existente</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="form-input"
                    value={formData.stock_inicial}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_inicial: formatearNumeroMilesDecimalesAlEscribir(e.target.value),
                      })
                    }
                    placeholder="Ej: 10,000.5 (opcional, por defecto 0)"
                    style={{
                      borderLeft: '4px solid #3b82f6',
                      flex: '1 1 220px',
                      minWidth: 'min(100%, 16rem)',
                    }}
                  />
                  {insumoEditando && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={abrirAjusteStock}
                      title="Sumar o restar piezas al stock existente"
                      style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}
                    >
                      ⚙️ Ajustes de stock
                    </button>
                  )}
                </div>
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Total del inventario (puede ser <strong>0</strong> en el alta). Con stock &gt; 0 debes repartirlo en las
                  ubicaciones de abajo; la suma debe coincidir con este número (igual que en Prendas → Configurar stock).
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">⚠️ Stock Mínimo</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="form-input"
                  value={formData.stock_minimo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_minimo: formatearNumeroMilesDecimalesAlEscribir(e.target.value),
                    })
                  }
                  placeholder="Ej: 100.5 (opcional, por defecto 0)"
                  style={{
                    borderLeft: '4px solid #f59e0b',
                  }}
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Puede ser <strong>0</strong> (sin alerta por mínimo). Si hay valor, cuando el stock actual caiga por debajo
                  se generará una <strong>alerta</strong> en el dashboard. Vacío equivale a 0.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">📍 Ubicaciones (talleres / bodegas)</label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'stretch',
                    marginBottom: '0.35rem',
                  }}
                >
                  <select
                    className="form-select"
                    value={ubicacionCatalogoSeleccionada}
                    onChange={(e) => setUbicacionCatalogoSeleccionada(e.target.value)}
                    disabled={loadingUbicaciones || auxGuardando}
                    style={{
                      borderLeft: '4px solid #8b5cf6',
                      flex: '1 1 200px',
                      minWidth: 'min(100%, 12rem)',
                    }}
                  >
                    <option value="">Elige una ubicación del catálogo…</option>
                    {ubicaciones.map((ubic) => (
                      <option key={ubic.id} value={ubic.id}>
                        {ubic.nombre}
                        {!ubic.activo ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={abrirNuevaUbicacion}
                    disabled={loadingUbicaciones || auxGuardando}
                  >
                    + Nueva
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={abrirEditarUbicacion}
                    disabled={!ubicacionCatalogoSeleccionada || loadingUbicaciones || auxGuardando}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={() => void eliminarUbicacionSeleccionada(false)}
                    disabled={!ubicacionCatalogoSeleccionada || loadingUbicaciones || auxGuardando}
                  >
                    Eliminar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={agregarUbicacionSeleccionadaAlInsumo}
                    disabled={
                      !ubicacionCatalogoSeleccionada ||
                      loadingUbicaciones ||
                      auxGuardando ||
                      stockTotalInsumoForm() <= 0
                    }
                    title={
                      stockTotalInsumoForm() <= 0
                        ? 'Indica stock mayor a 0 para repartir en ubicaciones'
                        : undefined
                    }
                  >
                    ➕ Al insumo
                  </button>
                </div>
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Administras el catálogo con Nueva / Editar / Eliminar. Con <strong>Al insumo</strong> agregas una partida: se
                  sugiere el <strong>restante</strong> del stock no asignado (puedes cambiarlo). Cada nueva ubicación trae en el
                  input lo que falta por repartir.
                </small>
                {stockTotalInsumoForm() > 0 && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: '#f0fdfa',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      color: '#0f766e',
                    }}
                  >
                    Distribuido:{' '}
                    <strong>{formatoNumeroDesdeDb(sumUbicacionesInsumo())}</strong> · Restante:{' '}
                    <strong>
                      {formatoNumeroDesdeDb(
                        Math.max(0, round2(stockTotalInsumoForm() - sumUbicacionesInsumo()))
                      )}
                    </strong>{' '}
                    · Total stock: <strong>{formatoNumeroDesdeDb(stockTotalInsumoForm())}</strong>
                  </div>
                )}
                {ubicacionesInsumo.length > 0 ? (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                      Reparto por ubicación:
                    </span>
                    {ubicacionesInsumo.map((p) => {
                      const nombreUb =
                        ubicaciones.find((u) => u.id === p.ubicacion_id)?.nombre || 'Ubicación';
                      return (
                        <div
                          key={p.tempId}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.65rem 0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#fafafa',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#334155', minWidth: '120px' }}>{nombreUb}</span>
                          <label style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Cantidad</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={p.cantidad}
                            onChange={(e) => {
                              const val = formatearNumeroMilesDecimalesAlEscribir(e.target.value);
                              setUbicacionesInsumo((prev) =>
                                prev.map((row) =>
                                  row.tempId === p.tempId ? { ...row, cantidad: val } : row
                                )
                              );
                            }}
                            style={{
                              width: '110px',
                              padding: '0.45rem 0.5rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setUbicacionesInsumo((prev) =>
                                prev.filter((row) => row.tempId !== p.tempId)
                              )
                            }
                            style={{
                              marginLeft: 'auto',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.85rem',
                              border: '1px solid #fecaca',
                              background: '#fff1f2',
                              color: '#b91c1c',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '0.75rem' }}>
                    {stockTotalInsumoForm() > 0
                      ? 'Aún no hay ubicaciones. Elige una en el catálogo y pulsa «Al insumo» (se sugerirá el stock completo o el restante).'
                      : 'Con stock 0 no se requieren ubicaciones.'}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción detallada del insumo, características, color, material, etc."
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>Insumo Activo</span>
                </label>
              </div>

              <div className="btn-group">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    backgroundColor: botonEstado === 'exito' ? '#28a745' : undefined,
                    color: botonEstado === 'exito' ? 'white' : undefined,
                    borderColor: botonEstado === 'exito' ? '#28a745' : undefined,
                  }}
                >
                  {botonEstado === 'exito' 
                    ? '✓ Guardado' 
                    : insumoEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Insumo'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setInsumoEditando(null);
                    setUbicacionesInsumo([]);
                    setUbicacionCatalogoSeleccionada('');
                    setFormData({
                      nombre: '',
                      codigo: '',
                      descripcion: '',
                      presentacion_id: '',
                      cantidad_por_presentacion: '',
                      unidad_medida: 'unidades',
                      costo_compra: '',
                      stock_inicial: '',
                      stock_minimo: '',
                      activo: true,
                    });
                    setTimeout(() => {
                      inputBusquedaRef.current?.focus();
                    }, 100);
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
            </div>
          </div>
        )}

        {modalAjusteStockAbierto && insumoEditando && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1100,
              padding: '1rem',
              overflowY: 'auto',
            }}
            onClick={() => setModalAjusteStockAbierto(false)}
          >
            <div
              className="form-container"
              style={{
                maxWidth: '520px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '2rem auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="form-title" style={{ marginBottom: '0.75rem' }}>
                Ajustes de stock
              </h2>

              <p style={{ marginTop: 0, color: '#475569', fontSize: '0.9rem' }}>
                Insumo: <strong>{insumoEditando.nombre}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Movimiento</label>
                <select className="form-select" value={ajusteTipo} onChange={(e) => setAjusteTipo(e.target.value as any)}>
                  <option value="SUMAR">Sumar (Entrada)</option>
                  <option value="RESTAR">Restar (Salida)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ubicación</label>
                <select
                  className="form-select"
                  value={ajusteUbicacionId}
                  onChange={(e) => setAjusteUbicacionId(e.target.value)}
                >
                  <option value="">Elige una ubicación…</option>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                      {!u.activo ? ' (inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="form-input"
                  value={ajusteCantidad}
                  onChange={(e) => setAjusteCantidad(formatearNumeroMilesDecimalesAlEscribir(e.target.value))}
                  placeholder="Ej: 25"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Motivo (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  placeholder="Ej: Compra / Merma / Ajuste inventario"
                />
              </div>

              <div className="btn-group" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalAjusteStockAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void aplicarAjusteStock()}>
                  Aplicar ajuste
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Insumos */}
        <div className="table-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={handleNuevo}>
              ➕ Nuevo Insumo
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Unidad</th>
                {/* <th>Cantidad</th> — cantidad por presentación (columna oculta; ver formulario comentado) */}
                <th>Stock existente</th>
                <th>Almacenado</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron insumos con ese criterio.' : 'No hay insumos registrados. Crea tu primer insumo.'}
                  </td>
                </tr>
              ) : (
                insumosFiltrados.map((insumo) => (
                  <tr key={insumo.id}>
                    <td data-label="Código" style={{ fontFamily: 'monospace', fontWeight: '600' }}>{insumo.codigo}</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{insumo.nombre}</td>
                    <td data-label="Proveedor"><span className="badge badge-info">{insumo.presentacion?.nombre || '-'}</span></td>
                    <td data-label="Unidad">
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#dbeafe',
                          color: '#1e3a8a',
                          border: '1px solid #93c5fd',
                          fontWeight: 600,
                        }}
                      >
                        {(insumo.unidad_medida && insumo.unidad_medida.trim()) || 'unidades'}
                      </span>
                    </td>
                    {/*
                    <td data-label="Cantidad" style={{ fontWeight: '600', color: '#3b82f6' }}>
                      {Number(insumo.cantidad_por_presentacion).toLocaleString('es-MX')}
                    </td>
                    */}
                    <td data-label="Stock existente" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {stockExistenteInsumo(insumo).toLocaleString('es-MX')}
                    </td>
                    <td data-label="Almacenado" title={textoAlmacenInsumo(insumo)}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#ede9fe',
                          color: '#5b21b6',
                          border: '1px solid #c4b5fd',
                          fontWeight: 600,
                          maxWidth: '14rem',
                          display: 'inline-block',
                          whiteSpace: 'normal',
                          textAlign: 'left',
                          lineHeight: 1.35,
                        }}
                      >
                        {textoAlmacenInsumo(insumo)}
                      </span>
                    </td>
                    <td data-label="Descripción">{insumo.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${insumo.activo ? 'badge-success' : 'badge-danger'}`}>
                        {insumo.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones" style={{ verticalAlign: 'middle' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          maxWidth: '100%',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 0.75rem', flex: '1 1 auto', minWidth: 'min(100%, 7.5rem)' }}
                          onClick={() => handleEditar(insumo)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 0.75rem', flex: '1 1 auto', minWidth: 'min(100%, 7.5rem)' }}
                          onClick={() => handleEliminar(insumo.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de Error */}
        {modalErrorAbierto && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
            }}
            onClick={() => {
              setModalErrorAbierto(false);
              setMensajeError('');
              setMostrarFormulario(false);
              setInsumoEditando(null);
              setUbicacionesInsumo([]);
              setUbicacionCatalogoSeleccionada('');
              setFormData({
                nombre: '',
                codigo: '',
                descripcion: '',
                presentacion_id: '',
                cantidad_por_presentacion: '',
                unidad_medida: 'unidades',
                costo_compra: '',
                stock_inicial: '',
                stock_minimo: '',
                activo: true,
              });
              setBotonEstado('normal');
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#dc3545' }}>
                {mensajeError}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setModalErrorAbierto(false);
                  setMensajeError('');
                  setMostrarFormulario(false);
                  setInsumoEditando(null);
                  setUbicacionesInsumo([]);
                  setUbicacionCatalogoSeleccionada('');
                  setFormData({
                    nombre: '',
                    codigo: '',
                    descripcion: '',
                    presentacion_id: '',
                    cantidad_por_presentacion: '',
                    unidad_medida: 'unidades',
                    costo_compra: '',
                    stock_inicial: '',
                    stock_minimo: '',
                    activo: true,
                  });
                  setBotonEstado('normal');
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Éxito */}
        {modalExitoAbierto && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
            }}
            onClick={() => setModalExitoAbierto(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#28a745', fontWeight: '600' }}>
                {mensajeExito}
              </p>
            </div>
          </div>
        )}

        <AuxiliarCatalogoModal
          open={auxTipo !== null}
          titulo={
            auxTipo === 'presentacion'
              ? auxModo === 'crear'
                ? '➕ Nuevo proveedor'
                : '✏️ Editar proveedor'
              : auxModo === 'crear'
                ? '➕ Nueva ubicación'
                : '✏️ Editar ubicación'
          }
          nombre={auxForm.nombre}
          descripcion={auxForm.descripcion}
          activo={auxForm.activo}
          mayusculasNombre={auxTipo === 'presentacion'}
          onNombreChange={(v) => setAuxForm((f) => ({ ...f, nombre: v }))}
          onDescripcionChange={(v) => setAuxForm((f) => ({ ...f, descripcion: v }))}
          onActivoChange={(v) => setAuxForm((f) => ({ ...f, activo: v }))}
          onSubmit={handleAuxSubmit}
          onClose={cerrarAuxModal}
          onDelete={() => {
            if (auxTipo === 'presentacion') void eliminarPresentacionSeleccionada(true);
            else void eliminarUbicacionSeleccionada(true);
          }}
          mostrarEliminar={auxModo === 'editar'}
          guardando={auxGuardando}
          errorLinea={auxError}
        />
      </div>
    </LayoutWrapper>
  );
}

