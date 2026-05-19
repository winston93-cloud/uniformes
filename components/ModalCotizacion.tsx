'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCotizaciones, type PartidaCotizacion } from '@/lib/hooks/useCotizaciones';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCostos } from '@/lib/hooks/useCostos';
import type { Costo } from '@/lib/types';
import { compareCotizacionesPorFechaCotizacionDesc } from '@/lib/cotizacionesSort';
import { obtenerEstadosCotizacionPermitidosDesde } from '@/lib/cotizacionesEstados';
import {
  calcularMontosImpuestosCotizacion,
  TASA_IVA_TRASLADADO,
  TASA_ISR_RETENCION,
} from '@/lib/cotizacionesImpuestos';
import type { Cotizacion } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import ModalDatosFiscalesCliente from '@/components/ModalDatosFiscalesCliente';
import {
  datosClientePdfDesdeFiscalesYContacto,
  obtenerDatosFiscalesClienteParaPdf,
} from '@/lib/datosFiscalesPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Moneda en PDF cotización: miles con separador y 2 decimales (es-MX). */
function formatoMonedaPdfCotizacion(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

interface ModalCotizacionProps {
  onClose: () => void;
}

/** Resalta visualmente el control de estatus en historial (colores alineados al flujo del negocio). */
function estilosEstadoCotizacion(estado: string) {
  switch (estado) {
    case 'emitido':
      return { chip: '#10b981', wrapBg: '#ecfdf5', wrapBorder: '#34d399', text: '#047857', soft: '#d1fae5' };
    case 'aprobado':
      return { chip: '#3b82f6', wrapBg: '#eff6ff', wrapBorder: '#60a5fa', text: '#1e40af', soft: '#dbeafe' };
    case 'trabajando':
      return { chip: '#f59e0b', wrapBg: '#fffbeb', wrapBorder: '#fbbf24', text: '#b45309', soft: '#fde68a' };
    case 'terminado':
      return { chip: '#64748b', wrapBg: '#f1f5f9', wrapBorder: '#94a3b8', text: '#334155', soft: '#e2e8f0' };
    default:
      return { chip: '#6b7280', wrapBg: '#f9fafb', wrapBorder: '#d1d5db', text: '#374151', soft: '#f3f4f6' };
  }
}

export default function ModalCotizacion({ onClose }: ModalCotizacionProps) {
  // Estados principales
  const [vista, setVista] = useState<'nueva' | 'historial'>('nueva');
  const [tipoPrecio, setTipoPrecio] = useState<'mayoreo' | 'menudeo' | null>('menudeo');
  const [tipoCliente, setTipoCliente] = useState<'alumno' | 'externo'>('externo');
  const [cotizacionDirecta, setCotizacionDirecta] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [indiceSeleccionadoCliente, setIndiceSeleccionadoCliente] = useState(-1);
  
  // Estados para modo Cotización Directa (manual)
  const [prendaManual, setPrendaManual] = useState('');
  const [tallaManual, setTallaManual] = useState('');
  const [precioManual, setPrecioManual] = useState('');
  const [cantidadManual, setCantidadManual] = useState('1');
  
  // Partidas
  const [partidas, setPartidas] = useState<PartidaCotizacion[]>([]);
  
  // Estados para integración con costos
  const [prendaSeleccionada, setPrendaSeleccionada] = useState<string | null>(null);
  const [costosDisponibles, setCostosDisponibles] = useState<Costo[]>([]);
  const [errorCargaCostos, setErrorCargaCostos] = useState<string | null>(null);
  
  // NUEVO: Sub-partidas multi-talla
  interface SubPartida {
    id: string;
    costo_id: string;
    talla: string;
    cantidad: number;
    precio_unitario: number;
  }
  
  const [subPartidas, setSubPartidas] = useState<SubPartida[]>([
    { id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 }
  ]);
  
  // Estados para autocomplete de prenda
  const [busquedaPrenda, setBusquedaPrenda] = useState('');
  const [dropdownPrendaVisible, setDropdownPrendaVisible] = useState(false);
  const [indiceSeleccionadoPrenda, setIndiceSeleccionadoPrenda] = useState(-1);
  
  // Estados globales para color y especificaciones (ya no por talla)
  const [colorGlobal, setColorGlobal] = useState('');
  const [especificacionesGlobales, setEspecificacionesGlobales] = useState('');
  
  // Estados para accesibilidad
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  
  // Estado para mini-modal de cambio de precio
  const [miniModalPrecioAbierto, setMiniModalPrecioAbierto] = useState<number | null>(null);
  const [miniModalPrecioPos, setMiniModalPrecioPos] = useState<{ top: number; left: number; width: number } | null>(null);
  
  // Estados para filtros de historial
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  
  // Refs para manejo de foco y posicionamiento de dropdowns
  const inputTallaRef = useRef<HTMLInputElement>(null);
  const inputClienteRef = useRef<HTMLInputElement>(null);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  const inputPrendaManualRef = useRef<HTMLInputElement>(null);
  const inputColorRef = useRef<HTMLInputElement>(null);
  const inputEspecificacionesRef = useRef<HTMLInputElement>(null);
  const primeraSubPartidaInputRef = useRef<HTMLInputElement>(null);
  const primeraSubPartidaSelectRef = useRef<HTMLSelectElement>(null);
  const fondoCotizacionDataUrlRef = useRef<string | null>(null);
  const fondoHojaCotizacionDataUrlRef = useRef<string | null>(null);
  const [cargandoFondoCotizacionPdf, setCargandoFondoCotizacionPdf] = useState(false);
  
  // Estados para posicionamiento de dropdowns en portal
  const [dropdownClientePos, setDropdownClientePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [dropdownPrendaPos, setDropdownPrendaPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Información adicional
  const [observaciones, setObservaciones] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('50% anticipo, 50% contra entrega');
  const [tiempoEntrega, setTiempoEntrega] = useState('5-7 días hábiles');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [fechaVigencia, setFechaVigencia] = useState('');

  const [generando, setGenerando] = useState(false);
  const [incluirIva, setIncluirIva] = useState(false);
  const [incluirIsr, setIncluirIsr] = useState(false);
  /** Si no es null, estamos editando una cotización existente (mismo folio al guardar). */
  const [cotizacionEditId, setCotizacionEditId] = useState<string | null>(null);
  const [modalDatosFiscalesAbierto, setModalDatosFiscalesAbierto] = useState(false);
  const esModoEdicion = cotizacionEditId !== null;
  
  const { cicloEscolar, sesion } = useAuth();
  const {
    crearCotizacion,
    cotizaciones,
    obtenerCotizacion,
    cargando,
    error: errorCotizacionesLista,
    obtenerCotizaciones,
    actualizarEstado,
    actualizarCotizacionCompleta,
    eliminarCotizacion,
  } = useCotizaciones();
  const [actualizandoEstadoId, setActualizandoEstadoId] = useState<string | null>(null);
  const [eliminandoCotizacionId, setEliminandoCotizacionId] = useState<string | null>(null);
  const { searchAlumnos } = useAlumnos(cicloEscolar);
  const { searchExternos } = useExternos();
  const { prendas } = usePrendas();
  const { getCostosByPrenda } = useCostos(sesion?.sucursal_id);
  type CostoSlim = {
    id: string;
    prenda_id: string;
    talla_id: string;
    precio_mayoreo: number;
    precio_menudeo: number;
    activo?: boolean | null;
    talla?: { nombre?: string | null } | null;
  };
  const [costosPorPrendaId, setCostosPorPrendaId] = useState<Record<string, CostoSlim[]>>({});
  const [editPartidaIdx, setEditPartidaIdx] = useState<number | null>(null);
  const [busquedaPrendaEdit, setBusquedaPrendaEdit] = useState('');
  const [dropdownPrendaEditVisible, setDropdownPrendaEditVisible] = useState(false);
  const [indiceSeleccionadoPrendaEdit, setIndiceSeleccionadoPrendaEdit] = useState(-1);
  const [dropdownPrendaEditPos, setDropdownPrendaEditPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const editColorRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const editTallaRefs = useRef<Record<number, HTMLElement | null>>({});

  // Optimización: Memoizar filtrado de prendas para evitar recálculos
  const prendasMostrar = useMemo(() => {
    const prendasActivas = prendas
      .filter(p => p.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    const prendasFiltradas = busquedaPrenda.trim()
      ? prendasActivas.filter(p => 
          p.nombre.toLowerCase().includes(busquedaPrenda.toLowerCase())
        )
      : prendasActivas;
    
    return prendasFiltradas.slice(0, 10);
  }, [prendas, busquedaPrenda]);

  const prendasEditMostrar = useMemo(() => {
    const prendasActivas = prendas
      .filter(p => p.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const prendasFiltradas = busquedaPrendaEdit.trim()
      ? prendasActivas.filter(p => p.nombre.toLowerCase().includes(busquedaPrendaEdit.toLowerCase()))
      : prendasActivas;

    return prendasFiltradas.slice(0, 10);
  }, [prendas, busquedaPrendaEdit]);

  // Filtrar cotizaciones por cliente y fecha
  const cotizacionesFiltradas = useMemo(() => {
    const filtradas = cotizaciones.filter((cot) => {
      // Filtro por cliente
      const nombreCliente = (cot.alumno?.nombre || cot.externo?.nombre || '').toLowerCase();
      const cumpleFiltroCliente = !filtroCliente.trim() || nombreCliente.includes(filtroCliente.toLowerCase());

      // Filtro por fecha
      const fechaCotizacion = new Date(cot.fecha_cotizacion).toISOString().split('T')[0];
      const cumpleFiltroFecha = !filtroFecha || fechaCotizacion === filtroFecha;

      return cumpleFiltroCliente && cumpleFiltroFecha;
    });
    return [...filtradas].sort(compareCotizacionesPorFechaCotizacionDesc);
  }, [cotizaciones, filtroCliente, filtroFecha]);

  // Montar componente (necesario para portales)
  useEffect(() => {
    setMounted(true);
    // Auto-focus a búsqueda de cliente al abrir el modal
    setTimeout(() => {
      if (inputClienteRef.current) {
        inputClienteRef.current.focus();
      }
    }, 150);
    // Precargar fondo del PDF (no bloquea)
    void (async () => {
      try {
        setCargandoFondoCotizacionPdf(true);
        await Promise.all([obtenerFondoCotizacionDataUrl(), obtenerFondoHojaCotizacionDataUrl()]);
      } finally {
        setCargandoFondoCotizacionPdf(false);
      }
    })();
  }, []);

  // En modo edición, precargar costos de prendas ya presentes en partidas (para selectors de prenda/talla/tipo).
  useEffect(() => {
    if (!esModoEdicion) return;
    const prendaIds = Array.from(
      new Set(
        partidas
          .filter((p) => !p.es_manual && Boolean(p.prenda_id))
          .map((p) => String(p.prenda_id))
      )
    ).filter((id) => !costosPorPrendaId[id]);

    if (prendaIds.length === 0) return;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('costos')
          .select('id, prenda_id, talla_id, precio_mayoreo, precio_menudeo, activo, talla:tallas(nombre)')
          .in('prenda_id', prendaIds);
        if (error) throw error;
        const rows = (data || []) as CostoSlim[];
        const grouped: Record<string, CostoSlim[]> = {};
        for (const r of rows) {
          if (!grouped[r.prenda_id]) grouped[r.prenda_id] = [];
          grouped[r.prenda_id].push(r);
        }
        // Ordenar tallas de forma estable (alfabética) para UI
        for (const k of Object.keys(grouped)) {
          grouped[k] = grouped[k]
            .slice()
            .sort((a, b) => String(a.talla?.nombre || '').localeCompare(String(b.talla?.nombre || '')));
        }
        setCostosPorPrendaId((prev) => ({ ...prev, ...grouped }));
      } catch (e) {
        console.error('Error al precargar costos para edición:', e);
      }
    })();
  }, [esModoEdicion, partidas, costosPorPrendaId]);

  async function cargarImagenComoDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar imagen (${res.status})`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  }

  async function obtenerFondoCotizacionDataUrl(): Promise<string> {
    if (fondoCotizacionDataUrlRef.current) return fondoCotizacionDataUrlRef.current;
    const dataUrl = await cargarImagenComoDataUrl('/cotizacion-fondo.jpg');
    fondoCotizacionDataUrlRef.current = dataUrl;
    return dataUrl;
  }

  /** Fondo para hojas de partidas: mismo formato sin rótulos SUBTOTAL/IVA/TOTAL del JPG. */
  async function obtenerFondoHojaCotizacionDataUrl(): Promise<string> {
    if (fondoHojaCotizacionDataUrlRef.current) return fondoHojaCotizacionDataUrlRef.current;
    const dataUrl = await cargarImagenComoDataUrl('/cotizacion-fondo-hoja.jpg?v=3');
    fondoHojaCotizacionDataUrlRef.current = dataUrl;
    return dataUrl;
  }

  // Calcular posición del dropdown de clientes cuando se muestra
  useEffect(() => {
    console.log('📍 [POSICIÓN] Calculando posición dropdown...', { 
      resultadosLength: resultadosBusqueda.length, 
      clienteSeleccionado: !!clienteSeleccionado, 
      inputRef: !!inputClienteRef.current 
    });
    if (resultadosBusqueda.length > 0 && !clienteSeleccionado && inputClienteRef.current) {
      const rect = inputClienteRef.current.getBoundingClientRect();
      const pos = {
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      };
      console.log('📍 [POSICIÓN] Posición calculada:', pos);
      setDropdownClientePos(pos);
    } else {
      console.log('📍 [POSICIÓN] Limpiando posición');
      setDropdownClientePos(null);
    }
  }, [resultadosBusqueda, clienteSeleccionado]);

  // Cerrar dropdown de clientes al hacer scroll o resize (UX estándar)
  useEffect(() => {
    if (resultadosBusqueda.length > 0 && !clienteSeleccionado) {
      const handleScrollOrResize = () => {
        setResultadosBusqueda([]);
        setIndiceSeleccionadoCliente(-1);
      };

      window.addEventListener('scroll', handleScrollOrResize, true); // Capture phase
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [resultadosBusqueda, clienteSeleccionado]);

  // Calcular posición del dropdown de prendas cuando se muestra
  useEffect(() => {
    if (dropdownPrendaVisible && inputPrendaRef.current) {
      const rect = inputPrendaRef.current.getBoundingClientRect();
      setDropdownPrendaPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    } else {
      setDropdownPrendaPos(null);
    }
  }, [dropdownPrendaVisible]);

  // Cerrar dropdown de prendas al hacer scroll o resize (UX estándar)
  useEffect(() => {
    if (dropdownPrendaVisible) {
      const handleScrollOrResize = () => {
        setDropdownPrendaVisible(false);
        setIndiceSeleccionadoPrenda(-1);
      };

      window.addEventListener('scroll', handleScrollOrResize, true); // Capture phase
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [dropdownPrendaVisible]);

  // Cerrar mini-modal de precio al hacer clic fuera o scroll
  useEffect(() => {
    if (miniModalPrecioAbierto !== null) {
      const handleClickOutside = () => {
        setMiniModalPrecioAbierto(null);
        setMiniModalPrecioPos(null);
      };
      const handleScroll = () => {
        setMiniModalPrecioAbierto(null);
        setMiniModalPrecioPos(null);
      };
      
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
      }, 0);

      return () => {
        document.removeEventListener('click', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [miniModalPrecioAbierto]);

  // Buscar clientes
  useEffect(() => {
    console.log('🔍 [BÚSQUEDA] Iniciando búsqueda...', { busquedaCliente, tipoCliente });
    const buscar = async () => {
      if (busquedaCliente.length < 2) {
        console.log('🔍 [BÚSQUEDA] Muy corto, limpiando resultados');
        setResultadosBusqueda([]);
        return;
      }

      console.log('🔍 [BÚSQUEDA] Ejecutando búsqueda...', { busquedaCliente, tipoCliente });
      try {
        if (tipoCliente === 'alumno') {
          console.log('🔍 [BÚSQUEDA] Buscando alumnos...');
          const resultados = await searchAlumnos(busquedaCliente);
          console.log('🔍 [BÚSQUEDA] Resultados alumnos:', resultados);
          setResultadosBusqueda(resultados);
        } else {
          console.log('🔍 [BÚSQUEDA] Buscando externos...');
          const resultados = await searchExternos(busquedaCliente);
          console.log('🔍 [BÚSQUEDA] Resultados externos:', resultados);
          setResultadosBusqueda(resultados);
        }
      } catch (err) {
        console.error('❌ [BÚSQUEDA] Error al buscar:', err);
        setResultadosBusqueda([]);
      }
    };

    const timeout = setTimeout(buscar, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaCliente, tipoCliente]);

  // Cargar costos cuando se selecciona una prenda
  useEffect(() => {
    if (prendaSeleccionada) {
      setErrorCargaCostos(null); // Reset error
      getCostosByPrenda(prendaSeleccionada).then(({ data, error }) => {
        if (error) {
          console.error('Error al cargar costos:', error);
          setCostosDisponibles([]);
          setErrorCargaCostos('Error al cargar tallas. Por favor, intenta de nuevo.');
        } else if (!data || data.length === 0) {
          setCostosDisponibles([]);
          setErrorCargaCostos(null); // No es error, simplemente no hay tallas
        } else {
          setCostosDisponibles(data);
          setErrorCargaCostos(null);
          // Resetear sub-partidas con una fila vacía
          setSubPartidas([
            { id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 }
          ]);
        }
      });
    } else {
      setCostosDisponibles([]);
      setErrorCargaCostos(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prendaSeleccionada, sesion?.sucursal_id]);

  // NUEVO: Funciones para manejar sub-partidas
  const agregarSubPartida = () => {
    const nuevasSubPartidas = [...subPartidas, {
      id: crypto.randomUUID(),
      costo_id: '',
      talla: '',
      cantidad: 0,
      precio_unitario: 0
    }];
    setSubPartidas(nuevasSubPartidas);
    
    // Auto-focus a la nueva talla agregada (última fila)
    setTimeout(() => {
      const filas = document.querySelectorAll('.subpartidas-grid-row');
      if (filas.length > 0) {
        const ultimaFila = filas[filas.length - 1];
        const inputTalla = ultimaFila.querySelector('input[type="text"], select') as HTMLElement;
        if (inputTalla) {
          inputTalla.focus();
        }
      }
    }, 50);
  };

  const eliminarSubPartida = (id: string) => {
    // Mantener al menos una fila
    if (subPartidas.length > 1) {
      setSubPartidas(subPartidas.filter(sp => sp.id !== id));
    }
  };

  const actualizarSubPartida = (id: string, campo: keyof SubPartida, valor: any) => {
    setSubPartidas(subPartidas.map(sp => {
      if (sp.id === id) {
        const actualizada = { ...sp, [campo]: valor };
        
        // Si cambia costo_id (talla), actualizar precio automáticamente
        if (campo === 'costo_id' && valor && tipoPrecio) {
          const costo = costosDisponibles.find(c => c.id === valor);
          if (costo) {
            actualizada.talla = costo.talla?.nombre || '';
            actualizada.precio_unitario = tipoPrecio === 'mayoreo' 
              ? costo.precio_mayoreo 
              : costo.precio_menudeo;
          }
        }
        
        return actualizada;
      }
      return sp;
    }));
  };

  const guardarTodasSubPartidas = () => {
    if (!tipoPrecio) {
      alert('⚠️ Debes seleccionar un tipo de precio (Mayoreo o Menudeo) antes de agregar partidas');
      return;
    }

    // Validar prenda según el modo
    if (cotizacionDirecta) {
      if (!prendaManual.trim()) {
        alert('⚠️ Debes ingresar el nombre de la prenda');
        return;
      }
    } else {
      if (!prendaSeleccionada) {
        alert('⚠️ Debes seleccionar una prenda');
        return;
      }
    }

    if (!colorGlobal.trim()) {
      alert('⚠️ Debes especificar el Color de la prenda');
      return;
    }

    // Validar que todas las sub-partidas estén completas según el modo
    const incompletas = cotizacionDirecta
      ? subPartidas.filter(sp => !sp.talla.trim() || sp.cantidad <= 0 || sp.precio_unitario <= 0)
      : subPartidas.filter(sp => !sp.costo_id || !sp.talla || sp.cantidad <= 0);

    if (incompletas.length > 0) {
      const mensaje = cotizacionDirecta
        ? `⚠️ Hay ${incompletas.length} fila(s) incompleta(s). Por favor completa Talla, Cantidad (>0) y Precio (>0) en todas las filas.`
        : `⚠️ Hay ${incompletas.length} fila(s) incompleta(s). Por favor completa Talla y Cantidad (>0) en todas las filas.`;
      alert(mensaje);
      return;
    }

    // Obtener nombre de la prenda según el modo
    let nombrePrenda: string;
    if (cotizacionDirecta) {
      nombrePrenda = prendaManual;
    } else {
      const prenda = prendas.find(p => p.id === prendaSeleccionada);
      if (!prenda) {
        alert('⚠️ Error: Prenda no encontrada');
        return;
      }
      nombrePrenda = prenda.nombre;
    }

    // Convertir sub-partidas a partidas y agregar al array
    const nuevasPartidas: PartidaCotizacion[] = subPartidas.map((sp, index) => ({
      prenda_nombre: nombrePrenda,
      talla: sp.talla,
      color: colorGlobal,
      especificaciones: especificacionesGlobales,
      cantidad: sp.cantidad,
      precio_unitario: sp.precio_unitario,
      subtotal: sp.cantidad * sp.precio_unitario,
      orden: partidas.length + index + 1,
      tipo_precio_usado: tipoPrecio!,
      prenda_id: cotizacionDirecta ? null : prendaSeleccionada,
      costo_id: cotizacionDirecta ? null : sp.costo_id,
      es_manual: cotizacionDirecta,
    }));

    setPartidas([...partidas, ...nuevasPartidas]);
    
    // Limpiar formulario según el modo
    if (cotizacionDirecta) {
      setPrendaManual('');
    } else {
      setPrendaSeleccionada(null);
      setBusquedaPrenda('');
      setCostosDisponibles([]);
    }
    setColorGlobal('');
    setEspecificacionesGlobales('');
    setSubPartidas([
      { id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 }
    ]);
    
    // Auto-focus al input de prenda para agregar otra partida
    setTimeout(() => {
      if (cotizacionDirecta && inputPrendaManualRef.current) {
        inputPrendaManualRef.current.focus();
      } else if (inputPrendaRef.current) {
        inputPrendaRef.current.focus();
      }
    }, 100);
  };

  // Eliminar partida
  const eliminarPartida = (index: number) => {
    setPartidas(partidas.filter((_, i) => i !== index));
  };

  const normalizarNumero = (raw: string, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const actualizarPartida = <K extends keyof PartidaCotizacion>(
    index: number,
    campo: K,
    valor: PartidaCotizacion[K]
  ) => {
    setPartidas((prev) => {
      const next = [...prev];
      const actual = next[index];
      if (!actual) return prev;
      const actualizado: PartidaCotizacion = { ...actual, [campo]: valor } as PartidaCotizacion;

      // Recalcular subtotal si cambia cantidad / precio
      const cantidad = actualizado.cantidad;
      const precio = actualizado.precio_unitario;
      actualizado.subtotal = cantidad * precio;

      next[index] = actualizado;
      return next;
    });
  };

  const forzarPartidaManual = (index: number) => {
    setPartidas((prev) => {
      const next = [...prev];
      const actual = next[index];
      if (!actual) return prev;
      next[index] = {
        ...actual,
        es_manual: true,
        prenda_id: null,
        costo_id: null,
        // tipo_precio_usado se conserva como referencia visual
        subtotal: actual.cantidad * actual.precio_unitario,
      };
      return next;
    });
  };

  const seleccionarPrendaSistemaParaPartida = async (index: number, prendaId: string, prendaNombre: string) => {
    let costos = costosPorPrendaId[prendaId];
    if (!costos) {
      const { data, error } = await supabase
        .from('costos')
        .select('id, prenda_id, talla_id, precio_mayoreo, precio_menudeo, activo, talla:tallas(nombre)')
        .eq('prenda_id', prendaId);
      if (error) {
        console.error('Error al cargar costos para prenda (edición):', error);
        return;
      }
      costos = (data || []) as CostoSlim[];
      setCostosPorPrendaId((prev) => ({
        ...prev,
        [prendaId]: costos!
          .slice()
          .sort((a, b) => String(a.talla?.nombre || '').localeCompare(String(b.talla?.nombre || ''))),
      }));
    }

    const lista = (costos || []).filter((c) => c.activo !== false);
    if (lista.length === 0) {
      actualizarPartida(index, 'prenda_nombre', prendaNombre);
      forzarPartidaManual(index);
      return;
    }

    const partida = partidas[index];
    const tallaDeseada = String(partida?.talla || '');
    const costoMatch =
      (partida?.costo_id ? lista.find((c) => String(c.id) === String(partida.costo_id)) : undefined) ||
      lista.find((c) => String(c.talla?.nombre || '') === tallaDeseada) ||
      lista[0];
    const tipo = (partida?.tipo_precio_usado || 'menudeo') as 'menudeo' | 'mayoreo';
    const precio = tipo === 'mayoreo' ? costoMatch.precio_mayoreo : costoMatch.precio_menudeo;

    aplicarCostoSistema(index, {
      prenda_id: prendaId,
      prenda_nombre: prendaNombre,
      costo_id: costoMatch.id,
      talla: String(costoMatch.talla?.nombre || ''),
      tipo_precio_usado: tipo,
      precio_unitario: precio,
    });
  };

  const aplicarCostoSistema = (
    index: number,
    patch: {
      prenda_id: string;
      prenda_nombre: string;
      costo_id: string | null;
      talla: string;
      tipo_precio_usado: 'mayoreo' | 'menudeo';
      precio_unitario: number;
    }
  ) => {
    setPartidas((prev) => {
      const next = [...prev];
      const actual = next[index];
      if (!actual) return prev;
      const actualizado: PartidaCotizacion = {
        ...actual,
        ...patch,
        es_manual: false,
        subtotal: actual.cantidad * patch.precio_unitario,
      };
      next[index] = actualizado;
      return next;
    });
  };

  // Cambiar tipo de precio de una partida
  const cambiarTipoPrecioPartida = async (index: number, nuevoTipoPrecio: 'mayoreo' | 'menudeo') => {
    const partida = partidas[index];
    
    // Solo permitir cambio en partidas del sistema (no manuales)
    if (partida.es_manual || !partida.prenda_id || !partida.costo_id) {
      return;
    }

    // Buscar el costo correspondiente
    const { data: costo, error } = await supabase
      .from('costos')
      .select('precio_mayoreo, precio_menudeo')
      .eq('id', partida.costo_id)
      .single();

    if (error || !costo) {
      alert('Error al obtener precios alternativos');
      return;
    }

    // Obtener el nuevo precio según el tipo
    const nuevoPrecioUnitario = nuevoTipoPrecio === 'mayoreo' 
      ? costo.precio_mayoreo 
      : costo.precio_menudeo;

    // Actualizar la partida
    const partidasActualizadas = [...partidas];
    partidasActualizadas[index] = {
      ...partida,
      tipo_precio_usado: nuevoTipoPrecio,
      precio_unitario: nuevoPrecioUnitario,
      subtotal: partida.cantidad * nuevoPrecioUnitario,
    };

    setPartidas(partidasActualizadas);
  };

  // Calcular totales (partidas + IVA / ISR opcionales)
  const subtotal = partidas.reduce((sum, p) => sum + p.subtotal, 0);
  const totalesCotizacion = useMemo(
    () => calcularMontosImpuestosCotizacion(subtotal, incluirIva, incluirIsr),
    [subtotal, incluirIva, incluirIsr]
  );

  type DatosPdfCotizacion = {
    folio: string;
    fechaComprobante: string;
    cliente: {
      nombre: string;
      domicilio?: string;
      rfc?: string;
      telefono?: string;
    };
    comprobante: {
      lugarExpedicion: string;
      metodoPago: string;
      formaPago: string;
      tipoCambio: string;
      moneda: string;
    };
    partidas: PartidaCotizacion[];
    totales: ReturnType<typeof calcularMontosImpuestosCotizacion>;
    incluirIva: boolean;
    incluirIsr: boolean;
    condicionesPago: string;
    tiempoEntrega: string;
    fechaEntregaTexto: string;
    observaciones?: string;
  };

  const generarPdfCotizacion = async (data: DatosPdfCotizacion) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const [fondoCierre, fondoHoja] = await Promise.all([
      obtenerFondoCotizacionDataUrl(),
      obtenerFondoHojaCotizacionDataUrl(),
    ]);

    /** partidas = sin rótulos de totales; cierre = formato completo (solo última hoja). */
    const pintarFondo = (variante: 'partidas' | 'cierre' = 'partidas') => {
      const img = variante === 'cierre' ? fondoCierre : fondoHoja;
      doc.addImage(img, 'JPEG', 0, 0, pageW, pageH);
    };

    // Columna de importes alineada a SUBTOTAL / DESCUENTO / IVA / TOTAL del JPG (mm, baseline).
    const xImportesTotales = 176;
    const yImportesTotalesCierre = {
      subtotal: 276.4,
      descuento: 277.2,
      iva: 279.1,
      total: 281.3,
    };

    const pintarHeader = () => {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);

      const noComprobante = (() => {
        // Preferimos mostrar el consecutivo (ej. 0141 -> 141) como en tu ejemplo.
        const m = String(data.folio || '').match(/(\d{1,})$/);
        if (!m) return data.folio || '';
        const n = Number.parseInt(m[1], 10);
        return Number.isFinite(n) ? String(n) : (data.folio || '');
      })();

      // Caja izquierda (cliente)
      // Coordenadas calibradas al JPG (mm, A4)
      // Ajuste fino: subir ~3 renglones y mover a la derecha
      const xL = 37;
      const clienteNombre = data.cliente.nombre || '';
      const clienteDomicilio = data.cliente.domicilio || '';
      const clienteRfc = data.cliente.rfc || '';
      const clienteTelefono = data.cliente.telefono || '';
      // Interlineado izquierdo: domicilio un poco más arriba (menos hueco bajo el nombre)
      const yNombre = 35;
      const yDomicilio = 39;
      const yRfc = 47;
      // Subir ~1.5 renglones para evitar encimarse con la etiqueta del formato
      const yTel = 50.5;
      if (clienteNombre) doc.text(doc.splitTextToSize(clienteNombre, 100), xL, yNombre);
      if (clienteDomicilio) doc.text(doc.splitTextToSize(clienteDomicilio, 100), xL, yDomicilio);
      if (clienteRfc) doc.text(doc.splitTextToSize(clienteRfc, 100), xL, yRfc);
      if (clienteTelefono) doc.text(doc.splitTextToSize(clienteTelefono, 100), xL, yTel);

      // Caja derecha (comprobante / pago)
      // NOTA: el fondo tiene una columna de "rótulos" y otra de "valores".
      // xR debe iniciar en la columna de valores para evitar encimar etiquetas.
      const xR = 176;
      // Ajuste fino: interlineado del bloque derecho
      const shiftYRight = -11;
      const stepRight = 4.8; // separación entre renglones (más compacta)
      const gapRight = 6.2; // separación entre bloque superior e inferior (quitar ~1 renglón)
      const yNo = 26.5 + shiftYRight;
      const yLugar = yNo + stepRight;
      // Ajuste fino solicitado:
      // - "Fecha de comprobante": bajar un poco
      // - Bloque inferior completo: bajar 1.5 renglones
      const yFecha = yNo + stepRight * 2 + 1.2;
      // Subir 1 renglón a partir de "Método de pago"
      const shiftInferior = stepRight * 0.5;
      const yMetodo = yFecha + gapRight + shiftInferior;
      const yForma = yMetodo + stepRight;
      const ajustarAbajoTipoCambioYMoneda = 0.9;
      const yTipoCambio = yForma + stepRight + ajustarAbajoTipoCambioYMoneda;
      const yMoneda = yTipoCambio + stepRight + ajustarAbajoTipoCambioYMoneda;

      // Bloque superior derecho
      const lugarExp = data.comprobante.lugarExpedicion || '';
      const fechaComp = data.fechaComprobante || '';
      if (noComprobante) doc.text(doc.splitTextToSize(noComprobante, 28), xR, yNo);
      if (lugarExp) doc.text(doc.splitTextToSize(lugarExp, 28), xR, yLugar);
      if (fechaComp) doc.text(doc.splitTextToSize(fechaComp, 28), xR, yFecha);
      // Bloque inferior derecho
      const metodo = data.comprobante.metodoPago || '';
      const forma = data.comprobante.formaPago || '';
      const tipoCambio = data.comprobante.tipoCambio || '';
      const moneda = data.comprobante.moneda || '';
      if (metodo) doc.text(doc.splitTextToSize(metodo, 28), xR, yMetodo);
      if (forma) doc.text(doc.splitTextToSize(forma, 28), xR, yForma);
      if (tipoCambio) doc.text(doc.splitTextToSize(tipoCambio, 28), xR, yTipoCambio);
      if (moneda) doc.text(doc.splitTextToSize(moneda, 28), xR, yMoneda);
    };

    // El JPG del formato ya trae impresos los títulos de columna en la franja azul.
    // No dibujar fila de encabezado con autoTable (evita empalme/duplicado CANT./CANTIDAD, etc.).
    // Sin fila `head` de autoTable, la tabla subía; calibración respecto al JPG del formato.
    const tableTopY = 62;
    autoTable(doc, {
      // Importante: startY solo aplica a la primera página.
      // Para páginas siguientes, hay que usar margin.top para que el encabezado
      // de la tabla NO se vaya hasta arriba y quede alineado al bloque azul del formato.
      startY: tableTopY,
      margin: { left: 14, right: 14, top: tableTopY, bottom: 28 },
      showHead: false,
      body: data.partidas.map((p) => [
        String(p.cantidad),
        p.prenda_nombre + (p.especificaciones ? `\n${p.especificaciones}` : ''),
        p.talla,
        p.color || '-',
        formatoMonedaPdfCotizacion(p.precio_unitario),
        formatoMonedaPdfCotizacion(p.subtotal),
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 16, halign: 'right' },
        1: { cellWidth: 78 },
        2: { cellWidth: 18 },
        3: { cellWidth: 20 },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
      },
      willDrawPage: () => {
        pintarFondo('partidas');
      },
      didDrawPage: () => {
        pintarHeader();
      },
    });

    const margenInferior = 12;
    const yTrasTabla = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? tableTopY + 10;
    const paginaFinalTabla = doc.getNumberOfPages();

    /** Si no cabe el bloque, nueva página con el mismo encabezado (cliente + comprobante). */
    const asegurarEspacioVertical = (
      y: number,
      altoNecesario: number,
      fondoNuevaPagina: 'partidas' | 'cierre' = 'partidas'
    ) => {
      if (y + altoNecesario <= pageH - margenInferior) return { y, paginaCierre: false };
      doc.addPage();
      pintarFondo(fondoNuevaPagina);
      pintarHeader();
      doc.setTextColor(15, 23, 42);
      return { y: tableTopY + 6, paginaCierre: fondoNuevaPagina === 'cierre' };
    };

    // Totales siempre debajo de la última fila de partidas (sin tope fijo que los empuje hacia arriba).
    const altoTotales =
      10 + (data.incluirIva ? 7 : 0) + (data.incluirIsr ? 7 : 0) + 12 + 6;
    const espacioTotales = asegurarEspacioVertical(yTrasTabla + 8, altoTotales, 'cierre');
    const paginaCierreTotales =
      espacioTotales.paginaCierre || doc.getNumberOfPages() > paginaFinalTabla;

    const lineasObs = data.observaciones
      ? doc.splitTextToSize(data.observaciones, 180)
      : [];
    const altoCondiciones = 16 + 7 + 13 + 7 + 13 + 7 + (data.observaciones ? 13 + lineasObs.length * 5 : 0);

    const dibujarCondiciones = (yCond: number) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Condiciones de Pago:', 14, yCond);
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(data.condicionesPago || '—', 180), 14, yCond + 7);

      doc.setFont('helvetica', 'bold');
      doc.text('Tiempo de Entrega:', 14, yCond + 20);
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(data.tiempoEntrega || '—', 180), 14, yCond + 27);

      doc.setFont('helvetica', 'bold');
      doc.text('Fecha de Entrega:', 14, yCond + 40);
      doc.setFont('helvetica', 'normal');
      doc.text(data.fechaEntregaTexto || '—', 14, yCond + 47);

      if (data.observaciones) {
        doc.setFont('helvetica', 'bold');
        doc.text('Observaciones:', 14, yCond + 60);
        doc.setFont('helvetica', 'normal');
        doc.text(lineasObs, 14, yCond + 67);
      }
    };

    const dibujarImportesTotalesCierre = () => {
      const { subtotal, descuento, iva, total } = yImportesTotalesCierre;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(formatoMonedaPdfCotizacion(data.totales.subtotal), xImportesTotales, subtotal);

      // Ret. ISR RESICO en fila DESCUENTO del formato (no hay descuento comercial en cotización).
      if (data.incluirIsr) {
        doc.setFont('helvetica', 'normal');
        doc.text(
          `−${formatoMonedaPdfCotizacion(data.totales.montoIsrRet)}`,
          xImportesTotales,
          descuento
        );
      }

      if (data.incluirIva) {
        doc.setFont('helvetica', 'normal');
        doc.text(formatoMonedaPdfCotizacion(data.totales.montoIva), xImportesTotales, iva);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(formatoMonedaPdfCotizacion(data.totales.total), xImportesTotales, total);
    };

    if (paginaCierreTotales) {
      // Hoja de cierre: condiciones arriba (zona libre), importes al pie junto a rótulos del JPG.
      dibujarCondiciones(espacioTotales.y);
      dibujarImportesTotalesCierre();
    } else {
      let yTot = espacioTotales.y;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal: ${formatoMonedaPdfCotizacion(data.totales.subtotal)}`, 140, yTot);
      if (data.incluirIva) {
        yTot += 7;
        doc.setFont('helvetica', 'normal');
        doc.text(
          `IVA (${(TASA_IVA_TRASLADADO * 100).toFixed(0)}%): ${formatoMonedaPdfCotizacion(data.totales.montoIva)}`,
          140,
          yTot
        );
      }
      if (data.incluirIsr) {
        yTot += 7;
        doc.text(
          `Ret. ISR RESICO (${(TASA_ISR_RETENCION * 100).toFixed(2)}% s/importe sin IVA): −${formatoMonedaPdfCotizacion(data.totales.montoIsrRet)}`,
          140,
          yTot
        );
      }
      yTot += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`TOTAL: ${formatoMonedaPdfCotizacion(data.totales.total)}`, 140, yTot);

      const espacioCond = asegurarEspacioVertical(yTot + 14, altoCondiciones, 'partidas');
      dibujarCondiciones(espacioCond.y);
    }

    return doc;
  };

  // Crear cotización
  const handleCrearCotizacion = async () => {
    if (!tipoPrecio) {
      alert('⚠️ Debes seleccionar un tipo de precio (Mayoreo o Menudeo) antes de crear la cotización');
      return;
    }

    if (!clienteSeleccionado) {
      alert('Por favor selecciona un cliente');
      return;
    }

    if (partidas.length === 0) {
      alert('Por favor agrega al menos una partida');
      return;
    }

    try {
      setGenerando(true);

      const nuevaCotizacion = {
        alumno_id: tipoCliente === 'alumno' ? clienteSeleccionado.id : undefined,
        alumno_referencia:
          tipoCliente === 'alumno' ? clienteSeleccionado.referencia || clienteSeleccionado.alumno_ref : undefined,
        alumno_nombre: tipoCliente === 'alumno' ? clienteSeleccionado.nombre : undefined,
        externo_id: tipoCliente === 'externo' ? clienteSeleccionado.id : undefined,
        tipo_cliente: tipoCliente,
        fecha_vigencia: fechaVigencia || undefined,
        fecha_entrega: fechaEntrega || undefined,
        observaciones,
        condiciones_pago: condicionesPago,
        tiempo_entrega: tiempoEntrega,
        partidas,
        incluir_iva: incluirIva,
        incluir_isr: incluirIsr,
      };

      const { data, error } = cotizacionEditId
        ? await actualizarCotizacionCompleta(cotizacionEditId, nuevaCotizacion)
        : await crearCotizacion(nuevaCotizacion);

      if (error || !data) {
        throw new Error(error || 'Error al guardar cotización');
      }

      // Generar y mostrar PDF en pantalla (mismo folio al editar)
      const fiscalesPdf = await obtenerDatosFiscalesClienteParaPdf(tipoCliente, clienteSeleccionado);
      const bloqueClientePdf = datosClientePdfDesdeFiscalesYContacto(clienteSeleccionado, fiscalesPdf);
      const pdf = await generarPdfCotizacion({
        folio: data.folio,
        fechaComprobante: new Date().toLocaleDateString('es-MX'),
        cliente: {
          nombre: clienteSeleccionado?.nombre || 'Cliente General',
          domicilio: bloqueClientePdf.domicilio,
          rfc: bloqueClientePdf.rfc,
          telefono: bloqueClientePdf.telefono,
        },
        comprobante: {
          lugarExpedicion: 'CD. MADERO',
          metodoPago: 'EFECTIVO',
          formaPago: 'EFECTIVO',
          tipoCambio: '$-------------',
          moneda: 'PESOS',
        },
        partidas,
        totales: totalesCotizacion,
        incluirIva,
        incluirIsr,
        condicionesPago,
        tiempoEntrega,
        fechaEntregaTexto: fechaEntrega
          ? new Date(fechaEntrega + 'T12:00:00').toLocaleDateString('es-MX')
          : '—',
        observaciones: observaciones || undefined,
      });
      const pdfUrl = pdf.output('bloburl');
      window.open(pdfUrl, '_blank');

      alert(
        cotizacionEditId
          ? `✅ Cotización ${data.folio} actualizada (folio conservado)`
          : `✅ Cotización ${data.folio} generada exitosamente`
      );

      limpiarCotizacionNueva();
      setVista('historial');
    } catch (err) {
      console.error('Error:', err);
      alert('Error al crear cotización: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setGenerando(false);
    }
  };

  // Ver PDF de cotización
  const verPDF = async (cotizacion: any) => {
    try {
      const { detalle } = await obtenerCotizacion(cotizacion.id);
      
      const partidasFormateadas: PartidaCotizacion[] = detalle.map((d: any) => ({
        prenda_nombre: d.prenda_nombre,
        talla: d.talla,
        color: d.color || '',
        especificaciones: d.especificaciones || '',
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
        orden: d.orden,
        tipo_precio_usado: d.tipo_precio_usado || 'menudeo', // Default para cotizaciones viejas
        prenda_id: d.prenda_id || null,
        costo_id: d.costo_id || null,
        es_manual: d.es_manual || false,
      }));

      const fechaCotizacion = new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-MX');
      const subPdf = partidasFormateadas.reduce((s, p) => s + p.subtotal, 0);
      const conIva = cotizacion.incluir_iva === true;
      const conIsr = cotizacion.incluir_isr === true;
      const tPdf = calcularMontosImpuestosCotizacion(subPdf, conIva, conIsr);

      const nombreCliente = cotizacion.alumno?.nombre || cotizacion.externo?.nombre || 'Cliente General';
      const clienteParaFiscal =
        cotizacion.tipo_cliente === 'alumno'
          ? { ...(cotizacion.alumno || {}), id: cotizacion.alumno_id }
          : { ...(cotizacion.externo || {}), id: cotizacion.externo_id };
      const fiscalesHistorial = await obtenerDatosFiscalesClienteParaPdf(cotizacion.tipo_cliente, clienteParaFiscal);
      const bloqueHistorial = datosClientePdfDesdeFiscalesYContacto(clienteParaFiscal, fiscalesHistorial);
      const doc = await generarPdfCotizacion({
        folio: cotizacion.folio,
        fechaComprobante: fechaCotizacion,
        cliente: {
          nombre: nombreCliente,
          domicilio: bloqueHistorial.domicilio,
          rfc: bloqueHistorial.rfc,
          telefono: bloqueHistorial.telefono,
        },
        comprobante: {
          lugarExpedicion: 'CD. MADERO',
          metodoPago: 'EFECTIVO',
          formaPago: 'EFECTIVO',
          tipoCambio: '$-------------',
          moneda: 'PESOS',
        },
        partidas: partidasFormateadas,
        totales: tPdf,
        incluirIva: conIva,
        incluirIsr: conIsr,
        condicionesPago: cotizacion.condiciones_pago || '—',
        tiempoEntrega: cotizacion.tiempo_entrega || '—',
        fechaEntregaTexto: cotizacion.fecha_entrega
          ? new Date(String(cotizacion.fecha_entrega).split('T')[0] + 'T12:00:00').toLocaleDateString('es-MX')
          : '—',
        observaciones: cotizacion.observaciones || undefined,
      });

      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Error al generar PDF');
    }
  };

  const iniciarEdicionDesdeHistorial = async (cot: Cotizacion) => {
    if (cot.estado !== 'emitido') return;
    try {
      const { detalle } = await obtenerCotizacion(cot.id);
      const partidasFormateadas: PartidaCotizacion[] = detalle.map((d: any) => ({
        prenda_nombre: d.prenda_nombre,
        talla: d.talla,
        color: d.color || '',
        especificaciones: d.especificaciones || '',
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
        orden: d.orden,
        tipo_precio_usado: d.tipo_precio_usado || 'menudeo',
        prenda_id: d.prenda_id || null,
        costo_id: d.costo_id || null,
        es_manual: d.es_manual || false,
      }));
      setPartidas(partidasFormateadas);
      setTipoCliente(cot.tipo_cliente);
      if (cot.tipo_cliente === 'alumno' && cot.alumno && cot.alumno_id) {
        setClienteSeleccionado({ ...cot.alumno, id: cot.alumno_id });
      } else if (cot.tipo_cliente === 'externo' && cot.externo && cot.externo_id) {
        setClienteSeleccionado({ ...cot.externo, id: cot.externo_id });
      }
      setTipoPrecio(partidasFormateadas[0]?.tipo_precio_usado || 'menudeo');
      setObservaciones(cot.observaciones || '');
      setCondicionesPago(cot.condiciones_pago || '50% anticipo, 50% contra entrega');
      setTiempoEntrega(cot.tiempo_entrega || '5-7 días hábiles');
      setFechaEntrega(cot.fecha_entrega ? String(cot.fecha_entrega).split('T')[0] : '');
      setFechaVigencia(cot.fecha_vigencia ? String(cot.fecha_vigencia).split('T')[0] : '');
      setIncluirIva(cot.incluir_iva === true);
      setIncluirIsr(cot.incluir_isr === true);
      setCotizacionEditId(cot.id);
      setBusquedaCliente(cot.alumno?.nombre || cot.externo?.nombre || '');
      setCotizacionDirecta(partidasFormateadas.some((p) => p.es_manual));
      setVista('nueva');
    } catch (e) {
      console.error(e);
      alert('No se pudo cargar la cotización para editar');
    }
  };

  const confirmarYEliminarCotizacion = async (cot: Cotizacion) => {
    if (cot.estado !== 'emitido') {
      alert('Solo puedes eliminar cotizaciones en estado "Emitido".');
      return;
    }
    const folio = cot.folio || '(sin folio)';
    const ok1 = confirm(
      `⚠️ ELIMINACIÓN DEFINITIVA\n\nSe eliminará la cotización ${folio} y todas sus partidas.\n\n¿Deseas continuar?`
    );
    if (!ok1) return;
    const typed = prompt(`Escribe ELIMINAR para confirmar borrar ${folio} definitivamente:`, '');
    if (typed !== 'ELIMINAR') {
      alert('Cancelado. No se eliminó la cotización.');
      return;
    }

    try {
      setEliminandoCotizacionId(cot.id);
      const { error } = await eliminarCotizacion(cot.id);
      if (error) {
        alert(`No se pudo eliminar: ${error}`);
        return;
      }
      alert(`✅ Cotización ${folio} eliminada definitivamente.`);
    } finally {
      setEliminandoCotizacionId(null);
    }
  };

  const limpiarCotizacionNueva = () => {
    setModalDatosFiscalesAbierto(false);
    setCotizacionEditId(null);
    setIncluirIva(false);
    setIncluirIsr(false);
    setTipoPrecio(null);
    setClienteSeleccionado(null);
    setBusquedaCliente('');
    setPartidas([]);
    setObservaciones('');
    setCondicionesPago('50% anticipo, 50% contra entrega');
    setTiempoEntrega('5-7 días hábiles');
    setFechaEntrega('');
    setFechaVigencia('');
    setCotizacionDirecta(false);
    setPrendaSeleccionada(null);
    setBusquedaPrenda('');
    setCostosDisponibles([]);
    setColorGlobal('');
    setEspecificacionesGlobales('');
    setSubPartidas([
      { id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 },
    ]);
    setPrendaManual('');
    setTallaManual('');
    setPrecioManual('');
    setCantidadManual('1');
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div 
        className="modal-cotizacion-container"
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          maxWidth: '1400px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '2.5rem', 
            color: '#667eea',
            fontWeight: '900',
            textShadow: '2px 2px 4px rgba(102, 126, 234, 0.2)',
            letterSpacing: '-0.5px'
          }}>
            📄 Módulo de Cotizaciones
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Botón de Accesibilidad */}
            <button 
              onClick={() => setMostrarAyuda(!mostrarAyuda)}
              style={{
                background: '#667eea',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: 'white',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
              }}
              title="Atajos de teclado"
            >
              ?
            </button>
            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '2rem',
                cursor: 'pointer',
                color: '#999',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #eee' }}>
          <button
            type="button"
            onClick={() => {
              limpiarCotizacionNueva();
              setVista('nueva');
            }}
            style={{
              padding: '1rem 2rem',
              background: vista === 'nueva' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: vista === 'nueva' ? 'white' : '#666',
              border: 'none',
              borderBottom: vista === 'nueva' ? '3px solid #667eea' : 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            ➕ Nueva Cotización
          </button>
          <button
            onClick={() => setVista('historial')}
            style={{
              padding: '1rem 2rem',
              background: vista === 'historial' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: vista === 'historial' ? 'white' : '#666',
              border: 'none',
              borderBottom: vista === 'historial' ? '3px solid #667eea' : 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            📋 Historial ({cotizaciones.length})
          </button>
        </div>

        {/* Contenido */}
        {vista === 'nueva' ? (
          <div>
            {cotizacionEditId && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                  border: '2px solid #34d399',
                  borderRadius: '10px',
                  color: '#065f46',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                ✏️ Editando cotización en estado <strong>Emitido</strong>: al guardar se conserva el mismo folio y se
                actualizan datos y partidas.
              </div>
            )}
            {/* Fila superior: Tipo de Precio | Tipo de Cliente | Cotización Directa */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr auto 1fr auto 1fr', 
              gap: '1.5rem', 
              marginBottom: '2rem',
              alignItems: 'start'
            }}>
              {/* Tipo de precio */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#667eea' }}>
                  💰 Tipo de Precio:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  <button
                    onClick={() => {
                      setTipoPrecio('mayoreo');
                      // Auto-focus a búsqueda de cliente
                      setTimeout(() => {
                        if (inputClienteRef.current) {
                          inputClienteRef.current.focus();
                        }
                      }, 100);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: tipoPrecio === 'mayoreo' 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
                      color: tipoPrecio === 'mayoreo' ? 'white' : '#667eea',
                      border: tipoPrecio === 'mayoreo' ? '2px solid #4c51bf' : '2px solid #c7d2fe',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    📦 Mayoreo
                  </button>
                  <button
                    onClick={() => {
                      setTipoPrecio('menudeo');
                      // Auto-focus a búsqueda de cliente
                      setTimeout(() => {
                        if (inputClienteRef.current) {
                          inputClienteRef.current.focus();
                        }
                      }, 100);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: tipoPrecio === 'menudeo' 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
                      color: tipoPrecio === 'menudeo' ? 'white' : '#667eea',
                      border: tipoPrecio === 'menudeo' ? '2px solid #4c51bf' : '2px solid #c7d2fe',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    🛍️ Menudeo
                  </button>
                </div>
              </div>

              {/* Separador 1 */}
              <div style={{ width: '3px', background: 'linear-gradient(to bottom, #667eea, #764ba2)', alignSelf: 'stretch', borderRadius: '3px', marginTop: '2rem' }}></div>

              {/* Tipo de cliente */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#06b6d4' }}>
                  👥 Tipo de Cliente:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  <button
                    onClick={() => {
                      setTipoCliente('externo');
                      setClienteSeleccionado(null);
                      setBusquedaCliente('');
                      // Auto-focus a búsqueda de cliente
                      setTimeout(() => {
                        if (inputClienteRef.current) {
                          inputClienteRef.current.focus();
                        }
                      }, 100);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: tipoCliente === 'externo' 
                        ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' 
                        : 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
                      color: tipoCliente === 'externo' ? 'white' : '#06b6d4',
                      border: tipoCliente === 'externo' ? '2px solid #0e7490' : '2px solid #67e8f9',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    👤 Externo
                  </button>
                  <button
                    onClick={() => {
                      setTipoCliente('alumno');
                      setClienteSeleccionado(null);
                      setBusquedaCliente('');
                      // Auto-focus a búsqueda de cliente
                      setTimeout(() => {
                        if (inputClienteRef.current) {
                          inputClienteRef.current.focus();
                        }
                      }, 100);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: tipoCliente === 'alumno' 
                        ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' 
                        : 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
                      color: tipoCliente === 'alumno' ? 'white' : '#06b6d4',
                      border: tipoCliente === 'alumno' ? '2px solid #0e7490' : '2px solid #67e8f9',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    👨‍🎓 Alumno
                  </button>
                </div>
              </div>

              {/* Separador 2 */}
              <div style={{ width: '3px', background: 'linear-gradient(to bottom, #06b6d4, #0891b2)', alignSelf: 'stretch', borderRadius: '3px', marginTop: '2rem' }}></div>

              {/* Cotización Directa */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#10b981' }}>
                  ⚡ Acción Rápida:
                </label>
                <button
                  onClick={() => {
                    const nuevoModo = !cotizacionDirecta;
                    setCotizacionDirecta(nuevoModo);
                    // Limpiar campos al cambiar de modo
                    if (nuevoModo) {
                      // Activando modo manual
                      setPrendaSeleccionada(null);
                      setBusquedaPrenda('');
                      setCostosDisponibles([]);
                      setSubPartidas([{ id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 }]);
                      // Auto-focus a prenda manual
                      setTimeout(() => {
                        if (inputPrendaManualRef.current) {
                          inputPrendaManualRef.current.focus();
                        }
                      }, 100);
                    } else {
                      // Desactivando modo manual
                      setPrendaManual('');
                      setTallaManual('');
                      setPrecioManual('');
                      setCantidadManual('1');
                      // Auto-focus a búsqueda de prenda normal
                      setTimeout(() => {
                        if (inputPrendaRef.current) {
                          inputPrendaRef.current.focus();
                        }
                      }, 100);
                    }
                    setColorGlobal('');
                    setEspecificacionesGlobales('');
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    background: cotizacionDirecta 
                      ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: cotizacionDirecta ? '2px solid #1e3a8a' : '2px solid #047857',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    width: '100%',
                    boxShadow: cotizacionDirecta 
                      ? '0 4px 12px rgba(245, 158, 11, 0.3)' 
                      : '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = cotizacionDirecta 
                      ? '0 6px 16px rgba(245, 158, 11, 0.4)' 
                      : '0 6px 16px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = cotizacionDirecta 
                      ? '0 4px 12px rgba(245, 158, 11, 0.3)' 
                      : '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  {cotizacionDirecta ? '✏️ Modo Manual' : '📋 Cotización Directa'}
                </button>
                <div style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.5rem', 
                  backgroundColor: cotizacionDirecta ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  color: cotizacionDirecta ? '#1e3a8a' : '#059669', 
                  textAlign: 'center' 
                }}>
                  {cotizacionDirecta ? 'Prenda NO en sistema' : 'Prenda en sistema'}
                </div>
              </div>
            </div>

            {/* Búsqueda de cliente - RESALTADO */}
            <div style={{ 
              marginBottom: '2rem', 
              position: 'relative',
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
              borderRadius: '12px',
              border: '3px solid #667eea',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
            }}>
              <label style={{ 
                fontWeight: 'bold', 
                display: 'block', 
                marginBottom: '0.75rem',
                fontSize: '1.1rem',
                color: '#667eea'
              }}>
                🔍 Buscar {tipoCliente === 'alumno' ? 'Alumno' : 'Cliente'}:
              </label>
              <input
                ref={inputClienteRef}
                type="text"
                value={busquedaCliente}
                onChange={(e) => {
                  setBusquedaCliente(e.target.value);
                  setIndiceSeleccionadoCliente(-1); // Reset al escribir
                }}
                onFocus={() => setIndiceSeleccionadoCliente(-1)}
                onKeyDown={(e) => {
                  if (resultadosBusqueda.length === 0) return;

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIndiceSeleccionadoCliente(prev => 
                      prev < resultadosBusqueda.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIndiceSeleccionadoCliente(prev => prev > 0 ? prev - 1 : -1);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (indiceSeleccionadoCliente >= 0 && resultadosBusqueda[indiceSeleccionadoCliente]) {
                      const cliente = resultadosBusqueda[indiceSeleccionadoCliente];
                      setClienteSeleccionado(cliente);
                      setBusquedaCliente(cliente.nombre || cliente.alumno_nombre || '');
                      setResultadosBusqueda([]);
                      setIndiceSeleccionadoCliente(-1);
                      // Auto-focus al siguiente input (prenda)
                      setTimeout(() => {
                        if (cotizacionDirecta && inputPrendaManualRef.current) {
                          inputPrendaManualRef.current.focus();
                        } else if (inputPrendaRef.current) {
                          inputPrendaRef.current.focus();
                        }
                      }, 100);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setResultadosBusqueda([]);
                    setIndiceSeleccionadoCliente(-1);
                  }
                }}
                placeholder="Escribe nombre o referencia..."
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.1rem',
                  border: '3px solid #667eea',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  fontWeight: '500',
                }}
              />
              
              {/* Resultados búsqueda se renderizan en Portal (ver final del componente) */}

              {/* Cliente seleccionado */}
              {clienteSeleccionado && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {clienteSeleccionado.nombre || clienteSeleccionado.alumno_nombre || 'Sin nombre'}
                    </div>
                    {(clienteSeleccionado.referencia || clienteSeleccionado.alumno_ref) && (
                      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                        Ref: {clienteSeleccionado.referencia || clienteSeleccionado.alumno_ref}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setClienteSeleccionado(null);
                      setBusquedaCliente('');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.3)',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {cotizacionEditId && clienteSeleccionado && (
                <div style={{ marginTop: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => setModalDatosFiscalesAbierto(true)}
                    style={{
                      padding: '0.6rem 1.1rem',
                      borderRadius: '8px',
                      border: '2px solid #0f766e',
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      color: '#065f46',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                    }}
                  >
                    📋 Agregar datos fiscales
                  </button>
                  <span
                    style={{
                      display: 'block',
                      marginTop: '0.35rem',
                      fontSize: '0.8rem',
                      color: '#64748b',
                    }}
                  >
                    RFC, régimen fiscal, CP y uso CFDI (SAT); se guardan en el cliente de esta cotización.
                  </span>
                </div>
              )}
            </div>

            {/* Banner de aviso para Cotización Directa */}
            {cotizacionDirecta && (
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                color: 'white',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
                border: '2px solid #1e3a8a',
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  ⚡ MODO COTIZACIÓN DIRECTA ACTIVO
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.95 }}>
                  Esta prenda NO existe en el sistema. Ingresa todos los datos manualmente.
                </div>
              </div>
            )}

            {/* NUEVO: Agregar partida (Multi-talla) */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
              background: '#f8f9fa',
              borderRadius: '12px',
              border: cotizacionDirecta ? '2px dashed #1e40af' : '2px dashed #667eea',
            }}>
              <h3 style={{ marginTop: 0, color: cotizacionDirecta ? '#1e3a8a' : '#667eea' }}>
                {cotizacionDirecta ? '✏️ Agregar Partida (Manual)' : '➕ Agregar Partida (Multi-talla)'}
              </h3>
              
              {/* NIVEL 1: Datos de la prenda */}
              {cotizacionDirecta ? (
                /* MODO MANUAL: Multi-partidas con prenda manual */
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#1e3a8a' }}>
                    1. Ingresa el Nombre de la Prenda, Color y Especificaciones *
                  </label>
                  
                  {/* Grid horizontal: Prenda | Color | Especificaciones */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.5fr',
                    gap: '1rem',
                    alignItems: 'end'
                  }}>
                    {/* Nombre de Prenda Manual */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#1e3a8a' }}>
                        👕 Nombre Prenda:
                      </label>
                      <input
                        ref={inputPrendaManualRef}
                        type="text"
                        value={prendaManual}
                        onChange={(e) => {
                          const nuevoNombre = e.target.value;
                          // Si hay sub-partidas llenas y cambia la prenda, confirmar
                          if (prendaManual && (subPartidas.some(sp => sp.cantidad > 0) || colorGlobal.trim())) {
                            if (confirm('⚠️ Cambiar de prenda limpiará las tallas y datos ingresados. ¿Continuar?')) {
                              setPrendaManual(nuevoNombre);
                              setColorGlobal('');
                              setEspecificacionesGlobales('');
                              setSubPartidas([{ id: crypto.randomUUID(), costo_id: '', talla: '', cantidad: 0, precio_unitario: 0 }]);
                            }
                          } else {
                            setPrendaManual(nuevoNombre);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && prendaManual.trim()) {
                            e.preventDefault();
                            if (inputColorRef.current) {
                              inputColorRef.current.focus();
                            }
                          }
                        }}
                        placeholder="Ej: Camisa polo"
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          borderRadius: '8px', 
                          border: '2px solid #1e40af', 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                        }}
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#1e3a8a' }}>
                        🎨 Color: *
                      </label>
                      <input
                        ref={inputColorRef}
                        type="text"
                        value={colorGlobal}
                        onChange={(e) => setColorGlobal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (inputEspecificacionesRef.current) {
                              inputEspecificacionesRef.current.focus();
                            }
                          }
                        }}
                        placeholder="Ej: Azul marino"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #1e40af',
                          fontSize: '1rem',
                        }}
                      />
                    </div>

                    {/* Especificaciones */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#1e3a8a' }}>
                        📝 Especificaciones:
                      </label>
                      <input
                        ref={inputEspecificacionesRef}
                        type="text"
                        value={especificacionesGlobales}
                        onChange={(e) => setEspecificacionesGlobales(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Auto-focus a primera talla
                            setTimeout(() => {
                              if (primeraSubPartidaInputRef.current) {
                                primeraSubPartidaInputRef.current.focus();
                              }
                            }, 50);
                          }
                        }}
                        placeholder="Ej: Logo bordado, etc."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #1e40af',
                          fontSize: '1rem',
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Badge de prenda manual ingresada */}
                  {prendaManual.trim() && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                      color: 'white',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 'bold',
                    }}>
                      ✓ {prendaManual}
                    </div>
                  )}
                </div>
              ) : (
                /* MODO NORMAL: Sistema de autocomplete y multi-talla */
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#667eea' }}>
                    1. Selecciona la Prenda, Color y Especificaciones *
                  </label>
                  
                  {/* Grid horizontal: Prenda | Color | Especificaciones */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.5fr',
                    gap: '1rem',
                    alignItems: 'end'
                  }}>
                    {/* Búsqueda de Prenda */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#667eea' }}>
                        👕 Prenda:
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          ref={inputPrendaRef}
                          type="text"
                          value={busquedaPrenda}
                          onChange={(e) => {
                            const nuevaBusqueda = e.target.value;
                            // Si hay sub-partidas llenas y cambia la prenda, confirmar
                            if (prendaSeleccionada && (subPartidas.some(sp => sp.cantidad > 0) || colorGlobal.trim())) {
                              if (confirm('⚠️ Cambiar de prenda limpiará las tallas y datos ingresados. ¿Continuar?')) {
                                setBusquedaPrenda(nuevaBusqueda);
                                setPrendaSeleccionada(null);
                                setColorGlobal('');
                                setEspecificacionesGlobales('');
                              }
                            } else {
                              setBusquedaPrenda(nuevaBusqueda);
                            }
                            setDropdownPrendaVisible(true);
                            setIndiceSeleccionadoPrenda(-1);
                          }}
                          onFocus={() => {
                            setDropdownPrendaVisible(true);
                            setIndiceSeleccionadoPrenda(-1);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setDropdownPrendaVisible(false);
                              setIndiceSeleccionadoPrenda(-1);
                            }, 200);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setIndiceSeleccionadoPrenda(prev => 
                                prev < prendasMostrar.length - 1 ? prev + 1 : prev
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setIndiceSeleccionadoPrenda(prev => prev > 0 ? prev - 1 : -1);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (indiceSeleccionadoPrenda >= 0 && prendasMostrar[indiceSeleccionadoPrenda]) {
                                const prenda = prendasMostrar[indiceSeleccionadoPrenda];
                                setPrendaSeleccionada(prenda.id);
                                setBusquedaPrenda(prenda.nombre);
                                setDropdownPrendaVisible(false);
                                setIndiceSeleccionadoPrenda(-1);
                                // Auto-focus a color
                                setTimeout(() => {
                                  if (inputColorRef.current) {
                                    inputColorRef.current.focus();
                                  }
                                }, 100);
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setDropdownPrendaVisible(false);
                              setIndiceSeleccionadoPrenda(-1);
                            }
                          }}
                          placeholder="Buscar prenda..."
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            borderRadius: '8px', 
                            border: '2px solid #667eea', 
                            backgroundColor: 'white',
                            fontSize: '1rem',
                          }}
                        />
                        {/* Dropdown de prendas se renderiza en Portal (ver final del componente) */}
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#667eea' }}>
                        🎨 Color: *
                      </label>
                      <input
                        ref={cotizacionDirecta ? null : inputColorRef}
                        type="text"
                        value={colorGlobal}
                        onChange={(e) => setColorGlobal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (inputEspecificacionesRef.current) {
                              inputEspecificacionesRef.current.focus();
                            }
                          }
                        }}
                        placeholder="Ej: Azul marino"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #667eea',
                          fontSize: '1rem',
                        }}
                      />
                    </div>

                    {/* Especificaciones */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#667eea' }}>
                        📝 Especificaciones:
                      </label>
                      <input
                        ref={cotizacionDirecta ? null : inputEspecificacionesRef}
                        type="text"
                        value={especificacionesGlobales}
                        onChange={(e) => setEspecificacionesGlobales(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Auto-focus a primera talla
                            setTimeout(() => {
                              if (primeraSubPartidaSelectRef.current) {
                                primeraSubPartidaSelectRef.current.focus();
                              }
                            }, 50);
                          }
                        }}
                        placeholder="Ej: Logo bordado, etc."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #667eea',
                          fontSize: '1rem',
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Badge de prenda seleccionada */}
                  {prendaSeleccionada && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 'bold',
                    }}>
                      ✓ {busquedaPrenda}
                    </div>
                  )}
                </div>
              )}

              {/* NIVEL 2: Sub-partidas (Tallas) */}
              {((cotizacionDirecta && prendaManual.trim()) || (!cotizacionDirecta && prendaSeleccionada && costosDisponibles.length > 0)) && (
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: cotizacionDirecta ? '#1e3a8a' : '#667eea' }}>
                    2. Agrega las Tallas, Cantidades y Precios *
                  </label>
                  
                  {/* Header de la tabla */}
                  <div className="subpartidas-grid-header" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px 40px',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: cotizacionDirecta ? '#1e40af' : '#667eea',
                    color: 'white',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                  }}>
                    <div>Talla</div>
                    <div>Cantidad</div>
                    <div>Precio</div>
                    <div></div>
                  </div>

                  {/* Filas de sub-partidas */}
                  {subPartidas.map((sp, index) => (
                    <div 
                      key={sp.id}
                      className="subpartidas-grid-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 100px 40px',
                        gap: '0.5rem',
                        padding: '0.75rem 0.5rem',
                        background: 'white',
                        borderBottom: '1px solid #e5e7eb',
                        alignItems: 'center',
                      }}
                    >
                      {/* Talla */}
                      {cotizacionDirecta ? (
                        /* Modo manual: Input de texto */
                        <input
                          ref={index === 0 ? primeraSubPartidaInputRef : null}
                          type="text"
                          value={sp.talla}
                          onChange={(e) => actualizarSubPartida(sp.id, 'talla', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && sp.talla.trim()) {
                              e.preventDefault();
                              // Auto-focus a cantidad
                              const inputElement = e.target as HTMLInputElement;
                              const fila = inputElement.closest('.subpartidas-grid-row');
                              if (fila) {
                                const inputCantidad = fila.querySelector('input[type="number"]') as HTMLInputElement;
                                if (inputCantidad) {
                                  inputCantidad.focus();
                                  inputCantidad.select();
                                }
                              }
                            }
                          }}
                          placeholder="Ej: M"
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #1e40af',
                            fontSize: '0.9rem',
                          }}
                        />
                      ) : (
                        /* Modo normal: Select del sistema */
                        <select
                          ref={index === 0 ? primeraSubPartidaSelectRef : null}
                          value={sp.costo_id}
                          onChange={(e) => {
                            actualizarSubPartida(sp.id, 'costo_id', e.target.value);
                            // Auto-focus a cantidad después de seleccionar talla
                            if (e.target.value) {
                              setTimeout(() => {
                                const selectElement = e.target as HTMLSelectElement;
                                const fila = selectElement.closest('.subpartidas-grid-row');
                                if (fila) {
                                  const inputCantidad = fila.querySelector('input[type="number"]') as HTMLInputElement;
                                  if (inputCantidad) {
                                    inputCantidad.focus();
                                    inputCantidad.select();
                                  }
                                }
                              }, 50);
                            }
                          }}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '0.9rem',
                          }}
                        >
                          <option value="">Selecciona...</option>
                          {costosDisponibles
                            .filter(c => c.activo !== false)
                            .map(costo => (
                              <option key={costo.id} value={costo.id}>
                                {costo.talla?.nombre || 'Sin talla'}
                              </option>
                            ))}
                        </select>
                      )}

                      {/* Cantidad */}
                      <input
                        type="number"
                        value={sp.cantidad || ''}
                        onChange={(e) => actualizarSubPartida(sp.id, 'cantidad', parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cotizacionDirecta) {
                            e.preventDefault();
                            // En modo manual, saltar a precio
                            const inputElement = e.target as HTMLInputElement;
                            const fila = inputElement.closest('.subpartidas-grid-row');
                            if (fila) {
                              const inputs = fila.querySelectorAll('input[type="number"]');
                              if (inputs.length >= 2) {
                                const inputPrecio = inputs[1] as HTMLInputElement;
                                inputPrecio.focus();
                                inputPrecio.select();
                              }
                            }
                          }
                        }}
                        min="0"
                        placeholder="0"
                        style={{
                          padding: '0.5rem',
                          borderRadius: '4px',
                          border: cotizacionDirecta ? '1px solid #1e40af' : '1px solid #ddd',
                          fontSize: '0.9rem',
                          textAlign: 'center',
                        }}
                      />

                      {/* Precio */}
                      {cotizacionDirecta ? (
                        /* Modo manual: Input editable */
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sp.precio_unitario || ''}
                          onChange={(e) => actualizarSubPartida(sp.id, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #1e40af',
                            fontSize: '0.9rem',
                            textAlign: 'right',
                          }}
                        />
                      ) : (
                        /* Modo normal: Precio readonly del sistema */
                        <input
                          type="text"
                          value={sp.precio_unitario ? `$${sp.precio_unitario.toFixed(2)}` : '$0.00'}
                          readOnly
                          disabled
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '0.9rem',
                            backgroundColor: '#f5f5f5',
                            color: '#333',
                            fontWeight: 'bold',
                            textAlign: 'right',
                          }}
                        />
                      )}

                      {/* Botón eliminar */}
                      <button
                        onClick={() => eliminarSubPartida(sp.id)}
                        disabled={subPartidas.length === 1}
                        title="Eliminar fila"
                        style={{
                          padding: '0.5rem',
                          background: subPartidas.length === 1 ? '#e5e7eb' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: subPartidas.length === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  {/* Botones de acción */}
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginTop: '1rem',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '0 0 8px 8px',
                  }}>
                    <button
                      onClick={agregarSubPartida}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'white',
                        color: cotizacionDirecta ? '#1e40af' : '#667eea',
                        border: cotizacionDirecta ? '2px solid #1e40af' : '2px solid #667eea',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = cotizacionDirecta ? '#1e40af' : '#667eea';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = cotizacionDirecta ? '#1e40af' : '#667eea';
                      }}
                    >
                      ➕ Agregar otra talla
                    </button>

                    <button
                      onClick={guardarTodasSubPartidas}
                      disabled={
                        !tipoPrecio ||
                        (cotizacionDirecta ? !prendaManual.trim() : !prendaSeleccionada) ||
                        !colorGlobal.trim() ||
                        (cotizacionDirecta 
                          ? subPartidas.every(sp => !sp.talla.trim() || sp.cantidad <= 0 || sp.precio_unitario <= 0)
                          : subPartidas.every(sp => !sp.costo_id || sp.cantidad <= 0)
                        )
                      }
                      style={{
                        padding: '0.75rem 2rem',
                        background: (
                          !tipoPrecio ||
                          (cotizacionDirecta ? !prendaManual.trim() : !prendaSeleccionada) ||
                          !colorGlobal.trim() ||
                          (cotizacionDirecta 
                            ? subPartidas.every(sp => !sp.talla.trim() || sp.cantidad <= 0 || sp.precio_unitario <= 0)
                            : subPartidas.every(sp => !sp.costo_id || sp.cantidad <= 0)
                          )
                        ) ? '#9ca3af' : (
                          cotizacionDirecta 
                            ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        ),
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (
                          !tipoPrecio ||
                          (cotizacionDirecta ? !prendaManual.trim() : !prendaSeleccionada) ||
                          !colorGlobal.trim() ||
                          (cotizacionDirecta 
                            ? subPartidas.every(sp => !sp.talla.trim() || sp.cantidad <= 0 || sp.precio_unitario <= 0)
                            : subPartidas.every(sp => !sp.costo_id || sp.cantidad <= 0)
                          )
                        ) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      💾 Guardar Todo ({subPartidas.filter(sp => sp.costo_id && sp.cantidad > 0).length} {subPartidas.filter(sp => sp.costo_id && sp.cantidad > 0).length === 1 ? 'partida' : 'partidas'})
                    </button>
                  </div>
                </div>
              )}

              {/* Mensaje si no hay prenda seleccionada - Solo en modo normal */}
              {!cotizacionDirecta && !prendaSeleccionada && (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '0.95rem',
                }}>
                  👆 Selecciona una prenda para comenzar a agregar tallas
                </div>
              )}

              {/* Mensaje de error al cargar costos - Solo en modo normal */}
              {!cotizacionDirecta && prendaSeleccionada && errorCargaCostos && (
                <div style={{
                  padding: '1.5rem',
                  background: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  color: '#991b1b',
                  textAlign: 'center',
                  fontWeight: '500',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}>
                  <div>🚨 {errorCargaCostos}</div>
                  <button
                    onClick={() => {
                      // Forzar recarga
                      const prendaActual = prendaSeleccionada;
                      setPrendaSeleccionada(null);
                      setTimeout(() => setPrendaSeleccionada(prendaActual), 100);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    🔄 Reintentar
                  </button>
                </div>
              )}

              {/* Mensaje si prenda no tiene costos */}
              {prendaSeleccionada && !errorCargaCostos && costosDisponibles.length === 0 && (
                <div style={{
                  padding: '1.5rem',
                  background: '#fef3c7',
                  border: '2px solid #1e40af',
                  borderRadius: '8px',
                  color: '#92400e',
                  textAlign: 'center',
                  fontWeight: '500',
                }}>
                  ⚠️ Esta prenda no tiene tallas/costos configurados. Por favor, agrega tallas en el módulo de Costos primero.
                </div>
              )}
            </div>

            {/* Lista de partidas */}
            {partidas.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#667eea' }}>📋 Partidas ({partidas.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#667eea', color: 'white' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Prenda</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Talla</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Color</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Especificaciones</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Cant.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>P. Unit.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Tipo</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partidas.map((partida, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.75rem' }}>{index + 1}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                            {esModoEdicion ? (
                              <input
                                value={editPartidaIdx === index ? busquedaPrendaEdit : partida.prenda_nombre}
                                onChange={(e) => {
                                  const q = e.target.value;
                                  setEditPartidaIdx(index);
                                  setBusquedaPrendaEdit(q);
                                  setDropdownPrendaEditVisible(true);
                                  setIndiceSeleccionadoPrendaEdit(-1);
                                  // Si es manual, permitimos editar el texto directamente
                                  if (partida.es_manual) {
                                    actualizarPartida(index, 'prenda_nombre', q);
                                  }
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownPrendaEditPos({
                                    top: rect.bottom + window.scrollY + 8,
                                    left: rect.left + window.scrollX,
                                    width: rect.width,
                                  });
                                  setEditPartidaIdx(index);
                                  setBusquedaPrendaEdit(partida.prenda_nombre);
                                  setDropdownPrendaEditVisible(true);
                                  setIndiceSeleccionadoPrendaEdit(-1);
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setDropdownPrendaEditVisible(false);
                                    setIndiceSeleccionadoPrendaEdit(-1);
                                  }, 200);
                                }}
                                onKeyDown={(e) => {
                                  if (!dropdownPrendaEditVisible) return;
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setIndiceSeleccionadoPrendaEdit((prev) =>
                                      Math.min(prev + 1, prendasEditMostrar.length - 1)
                                    );
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setIndiceSeleccionadoPrendaEdit((prev) => Math.max(prev - 1, 0));
                                  } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (indiceSeleccionadoPrendaEdit < 0 || !prendasEditMostrar[indiceSeleccionadoPrendaEdit]) {
                                      return;
                                    }
                                    const pick = prendasEditMostrar[indiceSeleccionadoPrendaEdit];
                                    const prendaId = String(pick.id);
                                    const prendaNombre = pick.nombre;
                                    setBusquedaPrendaEdit(prendaNombre);
                                    setDropdownPrendaEditVisible(false);
                                    setIndiceSeleccionadoPrendaEdit(-1);

                                    if (partida.es_manual) {
                                      actualizarPartida(index, 'prenda_nombre', prendaNombre);
                                    } else {
                                      void seleccionarPrendaSistemaParaPartida(index, prendaId, prendaNombre);
                                    }

                                    // Foco a talla para seguir flujo de teclado
                                    setTimeout(() => {
                                      const node = editTallaRefs.current[index] as any;
                                      if (node?.focus) node.focus();
                                    }, 80);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setDropdownPrendaEditVisible(false);
                                    setIndiceSeleccionadoPrendaEdit(-1);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                  fontWeight: 700,
                                }}
                                aria-label={`Prenda partida ${index + 1}`}
                              />
                            ) : (
                              partida.prenda_nombre
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {esModoEdicion ? (
                              !partida.es_manual && partida.prenda_id ? (
                                <select
                                  value={partida.costo_id || ''}
                                  ref={(el) => {
                                    editTallaRefs.current[index] = el;
                                  }}
                                  onChange={(e) => {
                                    const prendaId = String(partida.prenda_id);
                                    const lista = (costosPorPrendaId[prendaId] || []).filter((c) => c.activo !== false);
                                    const costoMatch = lista.find((c) => String(c.id) === String(e.target.value));
                                    if (!costoMatch) return;
                                    const tipo = partida.tipo_precio_usado || 'menudeo';
                                    const precio =
                                      tipo === 'mayoreo' ? costoMatch.precio_mayoreo : costoMatch.precio_menudeo;
                                    aplicarCostoSistema(index, {
                                      prenda_id: prendaId,
                                      prenda_nombre: partida.prenda_nombre,
                                      costo_id: costoMatch.id,
                                      talla: String(costoMatch.talla?.nombre || ''),
                                      tipo_precio_usado: tipo,
                                      precio_unitario: precio,
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      setTimeout(() => {
                                        const node = editColorRefs.current[index];
                                        if (node) node.focus();
                                      }, 60);
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                    background: 'white',
                                    cursor: 'pointer',
                                  }}
                                  aria-label={`Talla partida ${index + 1}`}
                                >
                                  <option value="">Selecciona...</option>
                                  {(costosPorPrendaId[String(partida.prenda_id)] || [])
                                    .filter((c) => c.activo !== false)
                                    .map((costo) => (
                                      <option key={String(costo.id)} value={String(costo.id)}>
                                        {costo.talla?.nombre || 'Sin talla'}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <input
                                  value={partida.talla}
                                  onChange={(e) => actualizarPartida(index, 'talla', e.target.value)}
                                  ref={(el) => {
                                    editTallaRefs.current[index] = el;
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                  }}
                                  aria-label={`Talla partida ${index + 1}`}
                                />
                              )
                            ) : (
                              partida.talla
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {esModoEdicion ? (
                              <input
                                value={partida.color || ''}
                                onChange={(e) => actualizarPartida(index, 'color', e.target.value)}
                                ref={(el) => {
                                  editColorRefs.current[index] = el;
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                }}
                                aria-label={`Color partida ${index + 1}`}
                              />
                            ) : (
                              partida.color || '-'
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#555' }}>
                            {esModoEdicion ? (
                              <input
                                value={partida.especificaciones || ''}
                                onChange={(e) => actualizarPartida(index, 'especificaciones', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                }}
                                aria-label={`Especificaciones partida ${index + 1}`}
                              />
                            ) : (
                              partida.especificaciones || '-'
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {esModoEdicion ? (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={String(partida.cantidad)}
                                onChange={(e) => {
                                  const n = Math.max(0, Math.floor(normalizarNumero(e.target.value, partida.cantidad)));
                                  actualizarPartida(index, 'cantidad', n);
                                }}
                                style={{
                                  width: 90,
                                  textAlign: 'right',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                }}
                                aria-label={`Cantidad partida ${index + 1}`}
                              />
                            ) : (
                              partida.cantidad
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {esModoEdicion ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.01}
                                value={String(partida.precio_unitario)}
                                onChange={(e) => {
                                  const n = Math.max(0, normalizarNumero(e.target.value, partida.precio_unitario));
                                  actualizarPartida(index, 'precio_unitario', n);
                                  // Si el usuario toca el precio unitario, lo tratamos como override manual.
                                  if (!partida.es_manual) {
                                    forzarPartidaManual(index);
                                  }
                                }}
                                style={{
                                  width: 120,
                                  textAlign: 'right',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                }}
                                aria-label={`Precio unitario partida ${index + 1}`}
                              />
                            ) : (
                              `$${partida.precio_unitario.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {esModoEdicion ? (
                              <select
                                value={partida.tipo_precio_usado}
                                onChange={async (e) => {
                                  const nuevo = e.target.value as 'mayoreo' | 'menudeo';
                                  // Si es partida del sistema, recalcular desde costos; si es manual, solo cambiar etiqueta.
                                  if (!partida.es_manual && partida.prenda_id && partida.costo_id) {
                                    await cambiarTipoPrecioPartida(index, nuevo);
                                    return;
                                  }
                                  actualizarPartida(index, 'tipo_precio_usado', nuevo);
                                }}
                                style={{
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 6,
                                  border: '1px solid #d1d5db',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  background: 'white',
                                }}
                                aria-label={`Tipo de precio partida ${index + 1}`}
                              >
                                <option value="menudeo">Menudeo</option>
                                <option value="mayoreo">Mayoreo</option>
                              </select>
                            ) : !partida.es_manual && partida.prenda_id && partida.costo_id ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMiniModalPrecioPos({
                                    top: rect.bottom + window.scrollY + 5,
                                    left: rect.left + window.scrollX,
                                    width: 150,
                                  });
                                  setMiniModalPrecioAbierto(miniModalPrecioAbierto === index ? null : index);
                                }}
                                title="Cambiar tipo de precio"
                                style={{
                                  background: partida.tipo_precio_usado === 'mayoreo' 
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                {partida.tipo_precio_usado === 'mayoreo' ? '📦 Mayoreo' : '🛍️ Menudeo'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: '#999' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                            ${partida.subtotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => eliminarPartida(index)}
                              style={{
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '1rem 2rem',
                  fontSize: '1.05rem',
                  fontWeight: 'bold',
                }}>
                  <div>Subtotal: ${totalesCotizacion.subtotal.toFixed(2)}</div>
                  {incluirIva && (
                    <div>IVA: ${totalesCotizacion.montoIva.toFixed(2)}</div>
                  )}
                  {incluirIsr && (
                    <div>Ret. ISR: −${totalesCotizacion.montoIsrRet.toFixed(2)}</div>
                  )}
                  <div style={{ fontSize: '1.2rem' }}>TOTAL: ${totalesCotizacion.total.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Información adicional */}
            <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Vigencia de la cotización:
                </label>
                <input
                  type="date"
                  value={fechaVigencia}
                  onChange={(e) => setFechaVigencia(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Condiciones de Pago:
                </label>
                <input
                  type="text"
                  value={condicionesPago}
                  onChange={(e) => setCondicionesPago(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                    Tiempo de Entrega:
                  </label>
                  <input
                    type="text"
                    value={tiempoEntrega}
                    onChange={(e) => setTiempoEntrega(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                    Fecha de Entrega:
                  </label>
                  <input
                    type="date"
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                Observaciones:
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }}
              />
            </div>

            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#334155' }}>
                Impuestos (opcional)
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={incluirIva}
                  onChange={(e) => setIncluirIva(e.target.checked)}
                />
                <span>
                  Incluir IVA ({(TASA_IVA_TRASLADADO * 100).toFixed(0)}% sobre subtotal de partidas)
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={incluirIsr}
                  onChange={(e) => setIncluirIsr(e.target.checked)}
                />
                <span>
                  Aplicar retención ISR RESICO ({(TASA_ISR_RETENCION * 100).toFixed(2)}% sobre el importe que cobra el emisor sin IVA; retención al emisor, se resta del total a pagar)
                </span>
              </label>
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
                Subtotal partidas: <strong>${totalesCotizacion.subtotal.toFixed(2)}</strong>
                {incluirIva && (
                  <> · IVA: <strong>${totalesCotizacion.montoIva.toFixed(2)}</strong></>
                )}
                {incluirIsr && (
                  <> · Ret. ISR: <strong>−${totalesCotizacion.montoIsrRet.toFixed(2)}</strong></>
                )}
                {' · '}
                <strong style={{ color: '#667eea' }}>Total: ${totalesCotizacion.total.toFixed(2)}</strong>
              </div>
            </div>

            {/* Botón generar */}
            <button
              type="button"
              onClick={handleCrearCotizacion}
              disabled={generando || !clienteSeleccionado || partidas.length === 0}
              style={{
                width: '100%',
                padding: '1rem 2rem',
                background: generando ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: generando ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              }}
            >
              {generando
                ? '⏳ Generando...'
                : cotizacionEditId
                  ? '💾 Guardar cambios (mismo folio)'
                  : '📄 Generar Cotización'}
            </button>
          </div>
        ) : (
          /* Historial */
          <div>
            <h3 style={{ color: '#667eea', marginBottom: '1rem' }}>
              Cotizaciones Generadas ({cotizacionesFiltradas.length}{cotizacionesFiltradas.length !== cotizaciones.length ? ` de ${cotizaciones.length}` : ''})
            </h3>

            {errorCotizacionesLista && (
              <div
                role="alert"
                style={{
                  marginBottom: '1rem',
                  padding: '0.85rem 1rem',
                  background: '#fef2f2',
                  border: '2px solid #f87171',
                  borderRadius: '10px',
                  color: '#991b1b',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <span style={{ flex: '1 1 220px' }}>{errorCotizacionesLista}</span>
                <button
                  type="button"
                  onClick={() => void obtenerCotizaciones()}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid #991b1b',
                    background: 'white',
                    color: '#991b1b',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Filtros de búsqueda */}
            <div style={{ 
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  🔍 Buscar por Cliente:
                </label>
                <input
                  type="text"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Nombre del cliente..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#764ba2'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#667eea'}
                />
              </div>
              
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  📅 Buscar por Fecha:
                </label>
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#764ba2'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#667eea'}
                />
              </div>
            </div>

            {cargando ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem' }}>⏳</div>
                <div>Cargando...</div>
              </div>
            ) : cotizaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                <div style={{ fontSize: '4rem' }}>📄</div>
                <div>No hay cotizaciones generadas aún</div>
                <p style={{ marginTop: '1rem', fontSize: '0.88rem', color: '#64748b', maxWidth: '36rem', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                  Si en el panel de Supabase ves filas en <code style={{ fontSize: '0.85em' }}>cotizaciones</code> pero aquí sigue en cero, suele ser{' '}
                  <strong>Row Level Security</strong>: la app usa la clave <em>anon</em> sin sesión Supabase Auth. Aplica la migración{' '}
                  <code style={{ fontSize: '0.85em' }}>20260428_rls_cotizaciones_externos_detalle_anon.sql</code> en el proyecto SQL o equivalente para permitir SELECT (y el resto que uses) con anon en{' '}
                  <code style={{ fontSize: '0.85em' }}>cotizaciones</code>, <code style={{ fontSize: '0.85em' }}>detalle_cotizacion</code> y <code style={{ fontSize: '0.85em' }}>externos</code>.
                </p>
              </div>
            ) : cotizacionesFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                <div style={{ fontSize: '3rem' }}>🔍</div>
                <div>No se encontraron cotizaciones con los filtros aplicados</div>
                <button
                  onClick={() => { setFiltroCliente(''); setFiltroFecha(''); }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: '#667eea', color: 'white' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem' }}>Folio</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem' }}>Cliente</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem' }}>Fecha</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.9rem' }}>Total</th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.9rem',
                          minWidth: '200px',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            background: 'rgba(255,255,255,0.22)',
                            borderRadius: '999px',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            border: '1px solid rgba(255,255,255,0.45)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                          }}
                          title="Cambiar estatus afecta producción y seguimiento"
                        >
                          Estado
                        </span>
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizacionesFiltradas.map((cot) => {
                      const est = estilosEstadoCotizacion(cot.estado);
                      const opcionesEstado = obtenerEstadosCotizacionPermitidosDesde(cot.estado);
                      const estatusBloqueado = opcionesEstado.length <= 1;
                      return (
                      <tr key={cot.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#667eea', fontSize: '0.9rem' }}>
                          {cot.folio}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                          {cot.alumno?.nombre || cot.externo?.nombre || 'Cliente General'}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                          {new Date(cot.fecha_cotizacion).toLocaleDateString('es-MX')}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          ${cot.total.toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: '0.65rem 0.75rem',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            minWidth: '200px',
                            background: est.soft,
                            borderLeft: `4px solid ${est.chip}`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              gap: '0.35rem',
                              maxWidth: '220px',
                              margin: '0 auto',
                              padding: '0.5rem 0.55rem',
                              borderRadius: '12px',
                              background: est.wrapBg,
                              border: `2px solid ${est.wrapBorder}`,
                              boxShadow:
                                '0 4px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(255,255,255,0.6) inset',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: est.text,
                                opacity: 0.85,
                                textAlign: 'center',
                              }}
                            >
                              Estatus
                            </span>
                            <select
                              value={cot.estado}
                              disabled={actualizandoEstadoId === cot.id || estatusBloqueado}
                              title={
                                estatusBloqueado
                                  ? 'En Terminado no se puede cambiar el estatus'
                                  : 'Solo puedes avanzar el estatus, no retroceder'
                              }
                              onChange={async (e) => {
                                const nuevo = e.target.value as 'emitido' | 'aprobado' | 'trabajando' | 'terminado';
                                if (nuevo === cot.estado) return;
                                setActualizandoEstadoId(cot.id);
                                const { error } = await actualizarEstado(cot.id, nuevo);
                                setActualizandoEstadoId(null);
                                if (error) {
                                  alert(`No se pudo actualizar el estatus: ${error}`);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.65rem',
                                borderRadius: '10px',
                                border: `2px solid ${est.wrapBorder}`,
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                background: estatusBloqueado ? '#f1f5f9' : '#ffffff',
                                cursor:
                                  actualizandoEstadoId === cot.id
                                    ? 'wait'
                                    : estatusBloqueado
                                      ? 'not-allowed'
                                      : 'pointer',
                                color: est.text,
                                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
                                outline: 'none',
                              }}
                              aria-label={`Estatus de cotización ${cot.folio}`}
                            >
                              {opcionesEstado.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {actualizandoEstadoId === cot.id && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.68rem',
                                  color: est.text,
                                  fontWeight: 600,
                                  textAlign: 'center',
                                }}
                              >
                                Guardando…
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => verPDF(cot)}
                              style={{
                                background: '#667eea',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                              }}
                            >
                              📄 Ver PDF
                            </button>
                            {cot.estado === 'emitido' ? (
                              <button
                                type="button"
                                onClick={() => iniciarEdicionDesdeHistorial(cot)}
                                style={{
                                  background: '#059669',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                }}
                                title="Editar datos conservando el mismo folio"
                              >
                                ✏️ Modificar
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => confirmarYEliminarCotizacion(cot)}
                              disabled={eliminandoCotizacionId === cot.id || cot.estado !== 'emitido'}
                              style={{
                                background:
                                  eliminandoCotizacionId === cot.id || cot.estado !== 'emitido'
                                    ? '#e5e7eb'
                                    : '#dc2626',
                                color:
                                  eliminandoCotizacionId === cot.id || cot.estado !== 'emitido'
                                    ? '#6b7280'
                                    : 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                cursor:
                                  eliminandoCotizacionId === cot.id || cot.estado !== 'emitido'
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontWeight: 'bold',
                              }}
                              title={
                                cot.estado !== 'emitido'
                                  ? 'Solo se permite eliminar en estado Emitido'
                                  : 'Eliminar definitivamente'
                              }
                            >
                              {eliminandoCotizacionId === cot.id ? '⏳ Eliminando…' : '🗑 Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal de Ayuda - Atajos de Teclado */}
        {mostrarAyuda && (
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              zIndex: 2000,
              minWidth: '400px',
              maxWidth: '600px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#667eea', fontSize: '1.5rem' }}>
                ⌨️ Atajos de Teclado
              </h3>
              <button 
                onClick={() => setMostrarAyuda(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '1rem', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#667eea', marginBottom: '0.75rem' }}>🔍 Búsqueda de Clientes y Prendas:</h4>
                <div style={{ paddingLeft: '1rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <kbd style={{ 
                      padding: '0.4rem 0.8rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      border: '2px solid #4c51bf',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>↑</kbd> / <kbd style={{ 
                      padding: '0.4rem 0.8rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      border: '2px solid #4c51bf',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>↓</kbd> : Navegar entre opciones
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <kbd style={{ 
                      padding: '0.4rem 0.8rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      border: '2px solid #4c51bf',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>Enter</kbd> : Seleccionar opción destacada
                  </div>
                  <div>
                    <kbd style={{ 
                      padding: '0.4rem 0.8rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      border: '2px solid #4c51bf',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>Esc</kbd> : Cerrar lista de opciones
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#667eea', marginBottom: '0.75rem' }}>💡 Flujo Recomendado:</h4>
                <div style={{ paddingLeft: '1rem', color: '#555' }}>
                  <p style={{ margin: '0.5rem 0' }}>1. Selecciona <strong>Tipo de Precio</strong> (Mayoreo/Menudeo)</p>
                  <p style={{ margin: '0.5rem 0' }}>2. Elige <strong>Tipo de Cliente</strong> (Externo/Alumno)</p>
                  <p style={{ margin: '0.5rem 0' }}>3. Busca y selecciona al <strong>Cliente</strong></p>
                  <p style={{ margin: '0.5rem 0' }}>4. Agrega <strong>Partidas</strong> (Prenda → Talla → Cantidad → Color)</p>
                  <p style={{ margin: '0.5rem 0' }}>5. Genera la <strong>Cotización</strong></p>
                </div>
              </div>

              <div style={{ 
                padding: '1rem',
                background: '#f0f9ff',
                borderRadius: '8px',
                border: '2px solid #667eea',
              }}>
                <p style={{ margin: 0, color: '#1e40af', fontSize: '0.95rem' }}>
                  <strong>💡 Tip:</strong> Puedes usar el mouse o el teclado de forma independiente. El resaltado visual te indica la opción activa.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PORTALES: Dropdowns renderizados fuera del modal para evitar overflow: auto */}
      {(() => {
        const shouldShow = mounted && dropdownClientePos && resultadosBusqueda.length > 0 && !clienteSeleccionado;
        console.log('🖼️ [PORTAL] Renderizando Portal de clientes:', { mounted, dropdownClientePos: !!dropdownClientePos, resultadosLength: resultadosBusqueda.length, clienteSeleccionado: !!clienteSeleccionado, shouldShow });
        return shouldShow;
      })() && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: dropdownClientePos!.top,
            left: dropdownClientePos!.left,
            width: dropdownClientePos!.width,
            maxHeight: '250px',
            overflow: 'auto',
            zIndex: 10000,
            background: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 8px 16px rgba(102, 126, 234, 0.3)',
          }}
        >
          {resultadosBusqueda.map((cliente, index) => {
            const nombreCliente = cliente.nombre || cliente.alumno_nombre || 'Sin nombre';
            const referenciaCliente = cliente.referencia || cliente.alumno_ref || null;
            
            return (
              <div
                key={cliente.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setClienteSeleccionado(cliente);
                  setBusquedaCliente(nombreCliente);
                  setResultadosBusqueda([]);
                  setIndiceSeleccionadoCliente(-1);
                  // Auto-focus al siguiente input (prenda)
                  setTimeout(() => {
                    if (cotizacionDirecta && inputPrendaManualRef.current) {
                      inputPrendaManualRef.current.focus();
                    } else if (inputPrendaRef.current) {
                      inputPrendaRef.current.focus();
                    }
                  }, 100);
                }}
                onMouseEnter={() => setIndiceSeleccionadoCliente(index)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: index < resultadosBusqueda.length - 1 ? '1px solid #eee' : 'none',
                  backgroundColor: indiceSeleccionadoCliente === index ? '#667eea' : '#fff',
                  color: indiceSeleccionadoCliente === index ? 'white' : 'black',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {nombreCliente}
                </div>
                {referenciaCliente && (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: indiceSeleccionadoCliente === index ? '#e0e7ff' : '#666' 
                  }}>
                    Ref: {referenciaCliente}
                  </div>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {mounted && dropdownPrendaPos && dropdownPrendaVisible && createPortal(
        prendasMostrar.length > 0 ? (
          <div style={{
            position: 'fixed',
            top: dropdownPrendaPos.top,
            left: dropdownPrendaPos.left,
            width: dropdownPrendaPos.width,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            zIndex: 10000,
          }}>
            {prendasMostrar.map((prenda, index) => (
              <div
                key={prenda.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPrendaSeleccionada(prenda.id);
                  setBusquedaPrenda(prenda.nombre);
                  setDropdownPrendaVisible(false);
                  setIndiceSeleccionadoPrenda(-1);
                  // Auto-focus a color
                  setTimeout(() => {
                    if (inputColorRef.current) {
                      inputColorRef.current.focus();
                    }
                  }, 100);
                }}
                onMouseEnter={() => setIndiceSeleccionadoPrenda(index)}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderBottom: index < prendasMostrar.length - 1 ? '1px solid #f0f0f0' : 'none',
                  transition: 'all 0.15s',
                  background: indiceSeleccionadoPrenda === index ? '#667eea' : 'white',
                  color: indiceSeleccionadoPrenda === index ? 'white' : 'black',
                  fontWeight: indiceSeleccionadoPrenda === index ? 'bold' : 'normal',
                }}
              >
                {prenda.nombre}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            position: 'fixed',
            top: dropdownPrendaPos.top,
            left: dropdownPrendaPos.left,
            width: dropdownPrendaPos.width,
            background: 'white',
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '0.75rem',
            color: '#999',
            fontSize: '0.9rem',
            zIndex: 10000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            No se encontraron prendas
          </div>
        ),
        document.body
      )}

      {/* Portal: Autocomplete de prenda en edición de partidas */}
      {mounted && dropdownPrendaEditPos && dropdownPrendaEditVisible && createPortal(
        prendasEditMostrar.length > 0 ? (
          <div style={{
            position: 'fixed',
            top: dropdownPrendaEditPos.top,
            left: dropdownPrendaEditPos.left,
            width: dropdownPrendaEditPos.width,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            zIndex: 10000,
          }}>
            {prendasEditMostrar.map((prenda, idx) => (
              <div
                key={prenda.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (editPartidaIdx === null) return;
                  const prendaId = String(prenda.id);
                  const prendaNombre = prenda.nombre;
                  setBusquedaPrendaEdit(prendaNombre);
                  setDropdownPrendaEditVisible(false);
                  setIndiceSeleccionadoPrendaEdit(-1);

                  const partida = partidas[editPartidaIdx];
                  if (partida?.es_manual) {
                    actualizarPartida(editPartidaIdx, 'prenda_nombre', prendaNombre);
                  } else {
                    void seleccionarPrendaSistemaParaPartida(editPartidaIdx, prendaId, prendaNombre);
                  }

                  // Foco a talla para seguir flujo
                  setTimeout(() => {
                    const node = editTallaRefs.current[editPartidaIdx] as any;
                    if (node?.focus) node.focus();
                  }, 80);
                }}
                onMouseEnter={() => setIndiceSeleccionadoPrendaEdit(idx)}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderBottom: idx < prendasEditMostrar.length - 1 ? '1px solid #f0f0f0' : 'none',
                  transition: 'all 0.15s',
                  background: indiceSeleccionadoPrendaEdit === idx ? '#667eea' : 'white',
                  color: indiceSeleccionadoPrendaEdit === idx ? 'white' : 'black',
                  fontWeight: indiceSeleccionadoPrendaEdit === idx ? 'bold' : 'normal',
                }}
              >
                {prenda.nombre}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            position: 'fixed',
            top: dropdownPrendaEditPos.top,
            left: dropdownPrendaEditPos.left,
            width: dropdownPrendaEditPos.width,
            background: 'white',
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '0.75rem',
            color: '#999',
            fontSize: '0.9rem',
            zIndex: 10000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            No se encontraron prendas
          </div>
        ),
        document.body
      )}

      {/* Portal: Mini-modal de cambio de tipo de precio */}
      {mounted && miniModalPrecioAbierto !== null && miniModalPrecioPos && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: miniModalPrecioPos.top,
            left: miniModalPrecioPos.left,
            width: miniModalPrecioPos.width,
            background: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
            zIndex: 10000,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const partida = partidas[miniModalPrecioAbierto];
              if (partida.tipo_precio_usado !== 'mayoreo') {
                cambiarTipoPrecioPartida(miniModalPrecioAbierto, 'mayoreo');
              }
              setMiniModalPrecioAbierto(null);
              setMiniModalPrecioPos(null);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'mayoreo' ? '#3b82f6' : 'white',
              color: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'mayoreo' ? 'white' : '#333',
              border: 'none',
              borderBottom: '1px solid #eee',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'mayoreo' ? 'bold' : 'normal',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (partidas[miniModalPrecioAbierto].tipo_precio_usado !== 'mayoreo') {
                e.currentTarget.style.background = '#f0f0f0';
              }
            }}
            onMouseOut={(e) => {
              if (partidas[miniModalPrecioAbierto].tipo_precio_usado !== 'mayoreo') {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            📦 Mayoreo
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const partida = partidas[miniModalPrecioAbierto];
              if (partida.tipo_precio_usado !== 'menudeo') {
                cambiarTipoPrecioPartida(miniModalPrecioAbierto, 'menudeo');
              }
              setMiniModalPrecioAbierto(null);
              setMiniModalPrecioPos(null);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'menudeo' ? '#f97316' : 'white',
              color: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'menudeo' ? 'white' : '#333',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: partidas[miniModalPrecioAbierto].tipo_precio_usado === 'menudeo' ? 'bold' : 'normal',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (partidas[miniModalPrecioAbierto].tipo_precio_usado !== 'menudeo') {
                e.currentTarget.style.background = '#f0f0f0';
              }
            }}
            onMouseOut={(e) => {
              if (partidas[miniModalPrecioAbierto].tipo_precio_usado !== 'menudeo') {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            🛍️ Menudeo
          </button>
        </div>,
        document.body
      )}

      {mounted &&
        modalDatosFiscalesAbierto &&
        createPortal(
          <ModalDatosFiscalesCliente
            open={modalDatosFiscalesAbierto}
            onClose={() => setModalDatosFiscalesAbierto(false)}
            tipoCliente={tipoCliente}
            cliente={clienteSeleccionado as Record<string, unknown> | null}
          />,
          document.body
        )}
    </div>
  );
}
