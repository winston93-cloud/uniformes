'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCotizaciones, type PartidaCotizacion } from '@/lib/hooks/useCotizaciones';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCostos } from '@/lib/hooks/useCostos';
import type { Costo } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ModalCotizacionProps {
  onClose: () => void;
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
  
  // Refs para manejo de foco y posicionamiento de dropdowns
  const inputTallaRef = useRef<HTMLInputElement>(null);
  const inputClienteRef = useRef<HTMLInputElement>(null);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  
  // Estados para posicionamiento de dropdowns en portal
  const [dropdownClientePos, setDropdownClientePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [dropdownPrendaPos, setDropdownPrendaPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Información adicional
  const [observaciones, setObservaciones] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('50% anticipo, 50% contra entrega');
  const [tiempoEntrega, setTiempoEntrega] = useState('5-7 días hábiles');
  const [fechaVigencia, setFechaVigencia] = useState('');

  const [generando, setGenerando] = useState(false);
  
  const { crearCotizacion, cotizaciones, obtenerCotizacion, cargando } = useCotizaciones();
  const { searchAlumnos } = useAlumnos();
  const { searchExternos } = useExternos();
  const { prendas } = usePrendas();
  const { getCostosByPrenda } = useCostos();

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

  // Montar componente (necesario para portales)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posición del dropdown de clientes cuando se muestra
  useEffect(() => {
    console.log('📍 [DROPDOWN POS] Calculando posición...', {
      resultadosLength: resultadosBusqueda.length,
      clienteSeleccionado: !!clienteSeleccionado,
      inputRefExists: !!inputClienteRef.current
    });
    
    if (resultadosBusqueda.length > 0 && !clienteSeleccionado && inputClienteRef.current) {
      const rect = inputClienteRef.current.getBoundingClientRect();
      const pos = {
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      };
      console.log('📍 [DROPDOWN POS] Posición calculada:', pos);
      setDropdownClientePos(pos);
    } else {
      console.log('📍 [DROPDOWN POS] Limpiando posición (no se cumplen condiciones)');
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
  }, [prendaSeleccionada]);

  // NUEVO: Funciones para manejar sub-partidas
  const agregarSubPartida = () => {
    setSubPartidas([...subPartidas, {
      id: crypto.randomUUID(),
      costo_id: '',
      talla: '',
      cantidad: 0,
      precio_unitario: 0
    }]);
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
  };

  // Eliminar partida
  const eliminarPartida = (index: number) => {
    setPartidas(partidas.filter((_, i) => i !== index));
  };

  // Calcular totales
  const subtotal = partidas.reduce((sum, p) => sum + p.subtotal, 0);
  const total = subtotal;

  // Generar PDF
  const generarPDF = (folioGenerado: string) => {
    const doc = new jsPDF();
    const fechaHoy = new Date().toLocaleDateString('es-MX');

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Uniformes Winston Churchill', 105, 28, { align: 'center' });

    // Folio y fecha
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Folio: ${folioGenerado}`, 14, 45);
    doc.text(`Fecha: ${fechaHoy}`, 14, 52);
    if (fechaVigencia) {
      doc.text(`Vigencia: ${new Date(fechaVigencia).toLocaleDateString('es-MX')}`, 14, 59);
    }

    // Cliente
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 14, 70);
    doc.setFont('helvetica', 'normal');
    const nombreCliente = clienteSeleccionado?.nombre || 'Cliente General';
    doc.text(nombreCliente, 14, 77);
    if (clienteSeleccionado?.referencia) {
      doc.text(`Ref: ${clienteSeleccionado.referencia}`, 14, 84);
    }

    // Tabla de partidas
    autoTable(doc, {
      startY: 95,
      head: [['#', 'Descripción', 'Talla', 'Color', 'Cantidad', 'P. Unit.', 'Subtotal']],
      body: partidas.map((p, i) => [
        i + 1,
        p.prenda_nombre + (p.especificaciones ? `\n${p.especificaciones}` : ''),
        p.talla,
        p.color || '-',
        p.cantidad,
        `$${p.precio_unitario.toFixed(2)}`,
        `$${p.subtotal.toFixed(2)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [102, 126, 234], fontSize: 10 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
        6: { cellWidth: 30 },
      },
    });

    // Totales
    const finalY = (doc as any).lastAutoTable.finalY || 95;
    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 140, finalY + 10);
    doc.setFontSize(14);
    doc.text(`TOTAL: $${total.toFixed(2)}`, 140, finalY + 20);

    // Condiciones
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Condiciones de Pago:', 14, finalY + 35);
    doc.setFont('helvetica', 'normal');
    doc.text(condicionesPago, 14, finalY + 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Tiempo de Entrega:', 14, finalY + 52);
    doc.setFont('helvetica', 'normal');
    doc.text(tiempoEntrega, 14, finalY + 59);

    if (observaciones) {
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones:', 14, finalY + 69);
      doc.setFont('helvetica', 'normal');
      const lineas = doc.splitTextToSize(observaciones, 180);
      doc.text(lineas, 14, finalY + 76);
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
        externo_id: tipoCliente === 'externo' ? clienteSeleccionado.id : undefined,
        tipo_cliente: tipoCliente,
        fecha_vigencia: fechaVigencia || undefined,
        observaciones,
        condiciones_pago: condicionesPago,
        tiempo_entrega: tiempoEntrega,
        partidas,
      };

      const { data, error } = await crearCotizacion(nuevaCotizacion);

      if (error || !data) {
        throw new Error(error || 'Error al crear cotización');
      }

      // Generar PDF
      const pdf = generarPDF(data.folio);
      pdf.save(`Cotizacion-${data.folio}.pdf`);

      alert(`✅ Cotización ${data.folio} generada exitosamente`);

      // Limpiar formulario
      setTipoPrecio(null);
      setClienteSeleccionado(null);
      setBusquedaCliente('');
      setPartidas([]);
      setObservaciones('');
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
      }));

      // Generar PDF temporal
      const doc = new jsPDF();
      const fechaCotizacion = new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-MX');

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('COTIZACIÓN', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema de Uniformes Winston Churchill', 105, 28, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Folio: ${cotizacion.folio}`, 14, 45);
      doc.text(`Fecha: ${fechaCotizacion}`, 14, 52);

      doc.setFont('helvetica', 'bold');
      doc.text('Cliente:', 14, 70);
      doc.setFont('helvetica', 'normal');
      const nombreCliente = cotizacion.alumno?.nombre || cotizacion.externo?.nombre || 'Cliente General';
      doc.text(nombreCliente, 14, 77);

      autoTable(doc, {
        startY: 95,
        head: [['#', 'Descripción', 'Talla', 'Color', 'Cantidad', 'P. Unit.', 'Subtotal']],
        body: partidasFormateadas.map((p, i) => [
          i + 1,
          p.prenda_nombre + (p.especificaciones ? `\n${p.especificaciones}` : ''),
          p.talla,
          p.color || '-',
          p.cantidad,
          `$${p.precio_unitario.toFixed(2)}`,
          `$${p.subtotal.toFixed(2)}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 95;
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL: $${cotizacion.total.toFixed(2)}`, 140, finalY + 20);

      doc.save(`Cotizacion-${cotizacion.folio}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Error al generar PDF');
    }
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
          <h2 style={{ margin: 0, fontSize: '2rem', color: '#667eea' }}>
            📄 Sistema de Cotizaciones
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
            onClick={() => setVista('nueva')}
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
                    onClick={() => setTipoPrecio('mayoreo')}
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
                    onClick={() => setTipoPrecio('menudeo')}
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
                    } else {
                      // Desactivando modo manual
                      setPrendaManual('');
                      setTallaManual('');
                      setPrecioManual('');
                      setCantidadManual('1');
                    }
                    setColorGlobal('');
                    setEspecificacionesGlobales('');
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    background: cotizacionDirecta 
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: cotizacionDirecta ? '2px solid #b45309' : '2px solid #047857',
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
                  color: cotizacionDirecta ? '#d97706' : '#059669', 
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
                      // Mantener foco en input
                      e.currentTarget.blur();
                      setTimeout(() => e.currentTarget.focus(), 0);
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
            </div>

            {/* Banner de aviso para Cotización Directa */}
            {cotizacionDirecta && (
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                border: '2px solid #b45309',
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
              border: cotizacionDirecta ? '2px dashed #f59e0b' : '2px dashed #667eea',
            }}>
              <h3 style={{ marginTop: 0, color: cotizacionDirecta ? '#d97706' : '#667eea' }}>
                {cotizacionDirecta ? '✏️ Agregar Partida (Manual)' : '➕ Agregar Partida (Multi-talla)'}
              </h3>
              
              {/* NIVEL 1: Datos de la prenda */}
              {cotizacionDirecta ? (
                /* MODO MANUAL: Multi-partidas con prenda manual */
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: '#d97706' }}>
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
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#d97706' }}>
                        👕 Nombre Prenda:
                      </label>
                      <input
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
                        placeholder="Ej: Camisa polo"
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          borderRadius: '8px', 
                          border: '2px solid #f59e0b', 
                          backgroundColor: 'white',
                          fontSize: '1rem',
                        }}
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#d97706' }}>
                        🎨 Color: *
                      </label>
                      <input
                        type="text"
                        value={colorGlobal}
                        onChange={(e) => setColorGlobal(e.target.value)}
                        placeholder="Ej: Azul marino"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #f59e0b',
                          fontSize: '1rem',
                        }}
                      />
                    </div>

                    {/* Especificaciones */}
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#d97706' }}>
                        📝 Especificaciones:
                      </label>
                      <input
                        type="text"
                        value={especificacionesGlobales}
                        onChange={(e) => setEspecificacionesGlobales(e.target.value)}
                        placeholder="Ej: Logo bordado, etc."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '2px solid #f59e0b',
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
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
                        type="text"
                        value={colorGlobal}
                        onChange={(e) => setColorGlobal(e.target.value)}
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
                        type="text"
                        value={especificacionesGlobales}
                        onChange={(e) => setEspecificacionesGlobales(e.target.value)}
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
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem', fontSize: '1rem', color: cotizacionDirecta ? '#d97706' : '#667eea' }}>
                    2. Agrega las Tallas, Cantidades y Precios *
                  </label>
                  
                  {/* Header de la tabla */}
                  <div className="subpartidas-grid-header" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px 40px',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: cotizacionDirecta ? '#f59e0b' : '#667eea',
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
                  {subPartidas.map((sp) => (
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
                          type="text"
                          value={sp.talla}
                          onChange={(e) => actualizarSubPartida(sp.id, 'talla', e.target.value)}
                          placeholder="Ej: M"
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #f59e0b',
                            fontSize: '0.9rem',
                          }}
                        />
                      ) : (
                        /* Modo normal: Select del sistema */
                        <select
                          value={sp.costo_id}
                          onChange={(e) => actualizarSubPartida(sp.id, 'costo_id', e.target.value)}
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
                        min="0"
                        placeholder="0"
                        style={{
                          padding: '0.5rem',
                          borderRadius: '4px',
                          border: cotizacionDirecta ? '1px solid #f59e0b' : '1px solid #ddd',
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
                            border: '1px solid #f59e0b',
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
                        color: cotizacionDirecta ? '#f59e0b' : '#667eea',
                        border: cotizacionDirecta ? '2px solid #f59e0b' : '2px solid #667eea',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = cotizacionDirecta ? '#f59e0b' : '#667eea';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = cotizacionDirecta ? '#f59e0b' : '#667eea';
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
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
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
                  border: '2px solid #f59e0b',
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
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partidas.map((partida, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.75rem' }}>{index + 1}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                            {partida.prenda_nombre}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{partida.talla}</td>
                          <td style={{ padding: '0.75rem' }}>{partida.color || '-'}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#555' }}>
                            {partida.especificaciones || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{partida.cantidad}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${partida.precio_unitario.toFixed(2)}
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
                  justifyContent: 'flex-end',
                  gap: '2rem',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                }}>
                  <div>Subtotal: ${subtotal.toFixed(2)}</div>
                  <div>TOTAL: ${total.toFixed(2)}</div>
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

            {/* Botón generar */}
            <button
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
              {generando ? '⏳ Generando...' : '📄 Generar Cotización y Descargar PDF'}
            </button>
          </div>
        ) : (
          /* Historial */
          <div>
            <h3 style={{ color: '#667eea', marginBottom: '1rem' }}>
              Cotizaciones Generadas ({cotizaciones.length})
            </h3>

            {cargando ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem' }}>⏳</div>
                <div>Cargando...</div>
              </div>
            ) : cotizaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                <div style={{ fontSize: '4rem' }}>📄</div>
                <div>No hay cotizaciones generadas aún</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#667eea', color: 'white' }}>
                      <th style={{ padding: '1rem', textAlign: 'left' }}>Folio</th>
                      <th style={{ padding: '1rem', textAlign: 'left' }}>Cliente</th>
                      <th style={{ padding: '1rem', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((cot) => (
                      <tr key={cot.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: '#667eea' }}>
                          {cot.folio}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {cot.alumno?.nombre || cot.externo?.nombre || 'Cliente General'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {new Date(cot.fecha_cotizacion).toLocaleDateString('es-MX')}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>
                          ${cot.total.toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            background: 
                              cot.estado === 'vigente' ? '#10b981' :
                              cot.estado === 'aceptada' ? '#3b82f6' :
                              cot.estado === 'rechazada' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                          }}>
                            {cot.estado.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
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
                        </td>
                      </tr>
                    ))}
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
      {mounted && dropdownClientePos && resultadosBusqueda.length > 0 && !clienteSeleccionado && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: dropdownClientePos.top,
            left: dropdownClientePos.left,
            width: dropdownClientePos.width,
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
    </div>
  );
}
