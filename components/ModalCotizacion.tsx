'use client';

import { useState, useEffect } from 'react';
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
  const [tipoPrecio, setTipoPrecio] = useState<'mayoreo' | 'menudeo' | null>(null);
  const [tipoCliente, setTipoCliente] = useState<'alumno' | 'externo'>('externo');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [indiceSeleccionadoCliente, setIndiceSeleccionadoCliente] = useState(-1);
  
  // Partidas
  const [partidas, setPartidas] = useState<PartidaCotizacion[]>([]);
  const [partidaActual, setPartidaActual] = useState<Partial<PartidaCotizacion>>({
    prenda_nombre: '',
    talla: '',
    color: '',
    especificaciones: '',
    cantidad: 1,
    precio_unitario: 0,
  });
  
  // Estados para integración con costos
  const [prendaSeleccionada, setPrendaSeleccionada] = useState<string | null>(null);
  const [costosDisponibles, setCostosDisponibles] = useState<Costo[]>([]);
  const [costoSeleccionado, setCostoSeleccionado] = useState<Costo | null>(null);

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

  // Buscar clientes
  useEffect(() => {
    const buscar = async () => {
      if (busquedaCliente.length < 2) {
        setResultadosBusqueda([]);
        return;
      }

      try {
        if (tipoCliente === 'alumno') {
          const resultados = await searchAlumnos(busquedaCliente);
          setResultadosBusqueda(resultados);
        } else {
          const resultados = await searchExternos(busquedaCliente);
          setResultadosBusqueda(resultados);
        }
      } catch (err) {
        console.error('Error al buscar:', err);
        setResultadosBusqueda([]);
      }
    };

    const timeout = setTimeout(buscar, 300);
    return () => clearTimeout(timeout);
  }, [busquedaCliente, tipoCliente, searchAlumnos, searchExternos]);

  // Cargar costos cuando se selecciona una prenda
  useEffect(() => {
    if (prendaSeleccionada) {
      getCostosByPrenda(prendaSeleccionada).then(({ data, error }) => {
        if (error) {
          console.error('Error al cargar costos:', error);
          setCostosDisponibles([]);
        } else {
          setCostosDisponibles(data);
        }
      });
    } else {
      setCostosDisponibles([]);
      setCostoSeleccionado(null);
    }
  }, [prendaSeleccionada, getCostosByPrenda]);

  // Actualizar precio cuando cambia tipoPrecio o costoSeleccionado
  useEffect(() => {
    if (costoSeleccionado && tipoPrecio) {
      const precio = tipoPrecio === 'mayoreo' 
        ? costoSeleccionado.precio_mayoreo 
        : costoSeleccionado.precio_menudeo;
      
      setPartidaActual(prev => ({
        ...prev,
        precio_unitario: precio,
      }));
    }
  }, [tipoPrecio, costoSeleccionado]);

  // Agregar partida
  const agregarPartida = () => {
    if (!tipoPrecio) {
      alert('⚠️ Debes seleccionar un tipo de precio (Mayoreo o Menudeo) antes de agregar partidas');
      return;
    }

    if (!costoSeleccionado) {
      alert('⚠️ Debes seleccionar una prenda y talla para obtener el precio');
      return;
    }

    const precio = tipoPrecio === 'mayoreo' 
      ? costoSeleccionado.precio_mayoreo 
      : costoSeleccionado.precio_menudeo;

    if (!precio || precio === 0) {
      alert(`⚠️ No hay precio de ${tipoPrecio} disponible para esta prenda y talla`);
      return;
    }
    
    if (!partidaActual.prenda_nombre || !partidaActual.talla || !partidaActual.cantidad) {
      alert('Por favor completa todos los campos obligatorios de la partida');
      return;
    }

    const nuevaPartida: PartidaCotizacion = {
      prenda_nombre: partidaActual.prenda_nombre!,
      talla: partidaActual.talla!,
      color: partidaActual.color || '',
      especificaciones: partidaActual.especificaciones || '',
      cantidad: partidaActual.cantidad!,
      precio_unitario: partidaActual.precio_unitario!,
      subtotal: partidaActual.cantidad! * partidaActual.precio_unitario!,
      orden: partidas.length + 1,
    };

    setPartidas([...partidas, nuevaPartida]);
    
    // Limpiar formulario
    setPartidaActual({
      prenda_nombre: '',
      talla: '',
      color: '',
      especificaciones: '',
      cantidad: 1,
      precio_unitario: 0,
    });
    setPrendaSeleccionada(null);
    setCostoSeleccionado(null);
    setCostosDisponibles([]);
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
            {/* Tipo de precio */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: tipoPrecio ? '#f0f9ff' : '#fff5f5', border: `2px solid ${tipoPrecio ? '#3b82f6' : '#ef4444'}`, borderRadius: '12px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', color: tipoPrecio ? '#1e40af' : '#dc2626' }}>
                💰 Tipo de Precio: {!tipoPrecio && <span style={{ color: '#dc2626', fontSize: '0.9rem' }}>(Requerido)</span>}
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setTipoPrecio('mayoreo')}
                  style={{
                    padding: '1rem 2rem',
                    background: tipoPrecio === 'mayoreo' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f0f0f0',
                    color: tipoPrecio === 'mayoreo' ? 'white' : '#666',
                    border: tipoPrecio === 'mayoreo' ? '3px solid #4c51bf' : '2px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (tipoPrecio !== 'mayoreo') e.currentTarget.style.backgroundColor = '#e0e0e0';
                  }}
                  onMouseOut={(e) => {
                    if (tipoPrecio !== 'mayoreo') e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }}
                >
                  📦 Mayoreo
                </button>
                <button
                  onClick={() => setTipoPrecio('menudeo')}
                  style={{
                    padding: '1rem 2rem',
                    background: tipoPrecio === 'menudeo' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f0f0f0',
                    color: tipoPrecio === 'menudeo' ? 'white' : '#666',
                    border: tipoPrecio === 'menudeo' ? '3px solid #4c51bf' : '2px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (tipoPrecio !== 'menudeo') e.currentTarget.style.backgroundColor = '#e0e0e0';
                  }}
                  onMouseOut={(e) => {
                    if (tipoPrecio !== 'menudeo') e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }}
                >
                  🛍️ Menudeo
                </button>
              </div>
              {tipoPrecio && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(102, 126, 234, 0.1)', borderRadius: '6px', fontSize: '0.9rem', color: '#4c51bf' }}>
                  ✓ Tipo seleccionado: <strong>{tipoPrecio === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</strong>
                </div>
              )}
            </div>

            {/* Tipo de cliente */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                Tipo de Cliente:
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setTipoCliente('externo');
                    setClienteSeleccionado(null);
                    setBusquedaCliente('');
                  }}
                  style={{
                    padding: '0.75rem 2rem',
                    background: tipoCliente === 'externo' ? '#667eea' : '#f0f0f0',
                    color: tipoCliente === 'externo' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
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
                    padding: '0.75rem 2rem',
                    background: tipoCliente === 'alumno' ? '#667eea' : '#f0f0f0',
                    color: tipoCliente === 'alumno' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  👨‍🎓 Alumno
                </button>
              </div>
            </div>

            {/* Búsqueda de cliente */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                Buscar {tipoCliente === 'alumno' ? 'Alumno' : 'Cliente'}:
              </label>
              <input
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
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                }}
              />
              
              {/* Resultados búsqueda */}
              {resultadosBusqueda.length > 0 && !clienteSeleccionado && (
                <div style={{
                  marginTop: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}>
                  {resultadosBusqueda.map((cliente, index) => (
                    <div
                      key={cliente.id}
                      onClick={() => {
                        setClienteSeleccionado(cliente);
                        setBusquedaCliente(cliente.nombre || cliente.alumno_nombre || '');
                        setResultadosBusqueda([]);
                        setIndiceSeleccionadoCliente(-1);
                      }}
                      onMouseEnter={() => setIndiceSeleccionadoCliente(index)}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        backgroundColor: indiceSeleccionadoCliente === index ? '#667eea' : '#fff',
                        color: indiceSeleccionadoCliente === index ? 'white' : 'black',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>
                        {cliente.nombre || cliente.alumno_nombre || 'Sin nombre'}
                      </div>
                      {cliente.referencia && (
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: indiceSeleccionadoCliente === index ? '#e0e7ff' : '#666' 
                        }}>
                          Ref: {cliente.referencia}
                        </div>
                      )}
                      {cliente.alumno_ref && (
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: indiceSeleccionadoCliente === index ? '#e0e7ff' : '#666' 
                        }}>
                          Ref: {cliente.alumno_ref}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                      {clienteSeleccionado.nombre}
                    </div>
                    {clienteSeleccionado.referencia && (
                      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                        Ref: {clienteSeleccionado.referencia}
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

            {/* Agregar partida */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
              background: '#f8f9fa',
              borderRadius: '12px',
              border: '2px dashed #667eea',
            }}>
              <h3 style={{ marginTop: 0, color: '#667eea' }}>➕ Agregar Partida</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Prenda *
                  </label>
                  <select
                    value={prendaSeleccionada || ''}
                    onChange={(e) => {
                      const prenda_id = e.target.value;
                      setPrendaSeleccionada(prenda_id || null);
                      const prenda = prendas.find(p => p.id === prenda_id);
                      setPartidaActual({ 
                        ...partidaActual, 
                        prenda_nombre: prenda?.nombre || '',
                        talla: '',
                        precio_unitario: 0,
                      });
                      setCostoSeleccionado(null);
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: 'white' }}
                  >
                    <option value="">Selecciona una prenda...</option>
                    {prendas.filter(p => p.activo).map(prenda => (
                      <option key={prenda.id} value={prenda.id}>
                        {prenda.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Talla *
                  </label>
                  <select
                    value={costoSeleccionado?.id || ''}
                    onChange={(e) => {
                      const costo_id = e.target.value;
                      const costo = costosDisponibles.find(c => c.id === costo_id);
                      setCostoSeleccionado(costo || null);
                      if (costo) {
                        // Validar que tipoPrecio esté seleccionado antes de asignar precio
                        const precio = tipoPrecio 
                          ? (tipoPrecio === 'mayoreo' ? costo.precio_mayoreo : costo.precio_menudeo)
                          : 0;
                        
                        setPartidaActual({ 
                          ...partidaActual, 
                          talla: costo.talla?.nombre || '',
                          precio_unitario: precio,
                        });
                      }
                    }}
                    disabled={!prendaSeleccionada || costosDisponibles.length === 0}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      border: '1px solid #ddd', 
                      backgroundColor: (!prendaSeleccionada || costosDisponibles.length === 0) ? '#f5f5f5' : 'white',
                      cursor: (!prendaSeleccionada || costosDisponibles.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">
                      {!prendaSeleccionada 
                        ? 'Primero selecciona una prenda' 
                        : costosDisponibles.length === 0 
                          ? 'No hay tallas disponibles' 
                          : 'Selecciona una talla...'}
                    </option>
                    {costosDisponibles
                      .filter(costo => costo.activo !== false) // Filtrar costos activos
                      .map(costo => (
                        <option key={costo.id} value={costo.id}>
                          {costo.talla?.nombre || 'Sin talla'} - ${tipoPrecio === 'mayoreo' ? costo.precio_mayoreo : costo.precio_menudeo}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Color
                  </label>
                  <input
                    type="text"
                    value={partidaActual.color || ''}
                    onChange={(e) => setPartidaActual({ ...partidaActual, color: e.target.value })}
                    placeholder="Ej: Azul marino"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={partidaActual.cantidad || 1}
                    onChange={(e) => setPartidaActual({ ...partidaActual, cantidad: parseInt(e.target.value) || 1 })}
                    min="1"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Precio {tipoPrecio ? `(${tipoPrecio === 'mayoreo' ? 'Mayoreo' : 'Menudeo'})` : 'Unitario'} *
                  </label>
                  <input
                    type="number"
                    value={partidaActual.precio_unitario || 0}
                    readOnly
                    disabled
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      border: '1px solid #ddd',
                      backgroundColor: '#f5f5f5',
                      color: '#333',
                      fontWeight: 'bold',
                      cursor: 'not-allowed',
                    }}
                  />
                  {!tipoPrecio && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                      ⚠️ Selecciona tipo de precio primero
                    </div>
                  )}
                  {tipoPrecio && !costoSeleccionado && (
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                      ℹ️ Selecciona prenda y talla para ver el precio
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Especificaciones (bordados, logos, etc.)
                </label>
                <textarea
                  value={partidaActual.especificaciones || ''}
                  onChange={(e) => setPartidaActual({ ...partidaActual, especificaciones: e.target.value })}
                  placeholder="Ej: Bordado del logo en el pecho..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                />
              </div>

              <button
                onClick={agregarPartida}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 2rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                ➕ Agregar Partida
              </button>
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
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold' }}>{partida.prenda_nombre}</div>
                            {partida.especificaciones && (
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                {partida.especificaciones}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{partida.talla}</td>
                          <td style={{ padding: '0.75rem' }}>{partida.color || '-'}</td>
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
      </div>
    </div>
  );
}
