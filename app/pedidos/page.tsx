'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import ModalDevolucion from '@/components/ModalDevolucion';
import { insforgeDb } from '@/lib/insforgeBrowser';
import {
  handlersTapSeleccionDropdown,
  instalarCierrePointerFuera,
  mergePropsDropdownPortal,
  posicionDropdownFijo,
  suscribirReposicionDropdownViewport,
  type PosicionDropdown,
} from '@/lib/cotizacionUi';
import { useCostos } from '@/lib/hooks/useCostos';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import { usePedidos } from '@/lib/hooks/usePedidos';
import type { Prenda } from '@/lib/types';

// Interfaces de tipos
interface Pedido {
  id: string;
  folio?: string | null;
  fecha: string;
  cliente_id: string;
  cliente_tipo: 'alumno' | 'externo';
  cliente_nombre: string;
  total: number;
  estado: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO' | 'CANCELADO_PARCIAL';
  tipo_cliente?: string;
  subtotal?: number;
  observaciones?: string;
  modalidad_pago?: 'TOTAL';
  efectivo_recibido?: number | string;
  cliente?: string; // Para compatibilidad con código existente
}

interface DetallePedido {
  prenda: string;
  prenda_id: string;
  talla: string;
  talla_id: string;
  especificaciones: string;
  cantidad: number;
  pendiente: number;
  precio: number;
  total: number;
  costoId?: string;
  tiene_stock?: boolean; // Flag para indicar si tiene stock disponible
  cantidad_con_stock?: number; // Cantidad que sí tiene stock
  cantidad_pendiente?: number; // Cantidad pendiente por falta de stock
}

export const dynamic = 'force-dynamic';

// Componente para detectar parámetros de búsqueda
function SearchParamsDetector({ setMostrarFormulario }: { setMostrarFormulario: (value: boolean) => void }) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    if (searchParams.get('nuevo') === 'true') {
      setMostrarFormulario(true);
    }
  }, [searchParams, setMostrarFormulario]);
  
  return null;
}

function PedidosPageContent() {
  const router = useRouter();
  const { sesion, cicloEscolar } = useAuth();
  const [mostrarFormulario, setMostrarFormulario] = useState(true); // Abrir automáticamente al entrar
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalDevolucion, setMostrarModalDevolucion] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any>(null);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [indiceClienteSeleccionado, setIndiceClienteSeleccionado] = useState(-1);
  const [indicePrendaSeleccionada, setIndicePrendaSeleccionada] = useState(-1);
  const [mostrarModalAgregarStock, setMostrarModalAgregarStock] = useState(false);
  const [cantidadAgregar, setCantidadAgregar] = useState('');
  const [stockActualDetalle, setStockActualDetalle] = useState<any>(null);
  const [partidaParaAgregarStock, setPartidaParaAgregarStock] = useState<number | null>(null);
  const [mostrarExitoStock, setMostrarExitoStock] = useState(false);
  const [mensajeExitoStock, setMensajeExitoStock] = useState('');
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const enviandoPedidoRef = useRef(false);
  const inventarioOpts = { sucursalId: sesion?.sucursal_id, esMatriz: sesion?.es_matriz };
  const { costos, getCostosByPrenda, refetch: refetchCostos } = useCostos(
    sesion?.sucursal_id,
    sesion?.es_matriz
  );
  const { alumnos, searchAlumnos } = useAlumnos(cicloEscolar);
  const { searchExternos } = useExternos();
  const { prendas, loading: prendasLoading, error: prendasError, refetch: refetchPrendas } = usePrendas(inventarioOpts);
  const { tallas } = useTallas();
  const { pedidos: pedidosDB, loading: loadingPedidos, crearPedido, actualizarEstadoPedido, eliminarPedidoDefinitivo } =
    usePedidos(sesion?.sucursal_id);

  // Estados para filtro de mes/año
  const fechaActual = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaActual.getMonth() + 1); // 1-12
  const [añoSeleccionado, setAñoSeleccionado] = useState(fechaActual.getFullYear());
  
  // Filtrar pedidos por mes y año (fecha legible es es-MX; usar siempre timestamp ISO de API)
  const pedidos = pedidosDB.filter((pedido: any) => {
    const raw =
      pedido.created_at ??
      pedido.createdAt ??
      (typeof pedido.fecha === 'string' && pedido.fecha.includes('-')
        ? pedido.fecha
        : pedido.updated_at ?? pedido.updatedAt);
    const fechaPedido = raw ? new Date(raw) : null;
    if (!fechaPedido || Number.isNaN(fechaPedido.getTime())) return true;
    return (
      fechaPedido.getMonth() + 1 === mesSeleccionado &&
      fechaPedido.getFullYear() === añoSeleccionado
    );
  }).map((p: any) => ({
    ...p,
    fecha: p.fecha || new Date(p.created_at).toISOString().split('T')[0],
  }));

  // Generar lista de años (últimos 5 años + año actual)
  const años = Array.from({ length: 6 }, (_, i) => fechaActual.getFullYear() - i);

  const meses = [
    { valor: 1, nombre: 'Enero' },
    { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' },
    { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' },
    { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' },
    { valor: 12, nombre: 'Diciembre' }
  ];

  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_tipo: '' as 'alumno' | 'externo' | '',
    cliente_nombre: '',
    detalles: [] as DetallePedido[],
    observaciones: '',
    modalidad_pago: 'TOTAL' as const,
    efectivo_recibido: '',
  });

  // Estados para búsqueda de cliente
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Array<{
    id: string;
    nombre: string;
    tipo: 'alumno' | 'externo';
    datos: any;
  }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const inputClienteRef = useRef<HTMLInputElement>(null);

  const [detalleActual, setDetalleActual] = useState({
    prenda_id: '',
    prenda_nombre: '',
    talla_id: '',
    talla_nombre: '',
    especificaciones: '',
    cantidad: '',
    precio: '0',
  });

  // Estados NUEVOS para búsqueda de prendas (implementación desde cero)
  const [textoPrendaBusqueda, setTextoPrendaBusqueda] = useState('');
  const [prendasEncontradas, setPrendasEncontradas] = useState<Prenda[]>([]);
  const [mostrarListaPrendas, setMostrarListaPrendas] = useState(false);
  const [posDropdownPrenda, setPosDropdownPrenda] = useState<PosicionDropdown | null>(null);
  const [posDropdownCliente, setPosDropdownCliente] = useState<PosicionDropdown | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const contenedorClienteRef = useRef<HTMLDivElement>(null);
  const [tallasDisponibles, setTallasDisponibles] = useState<any[]>([]);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  const contenedorPrendaRef = useRef<HTMLDivElement>(null);
  const dropdownPrendaRef = useRef<HTMLDivElement>(null);
  const dropdownClienteRef = useRef<HTMLDivElement>(null);
  const interaccionDropdownPortalRef = useRef(false);
  const selectTallaRef = useRef<HTMLSelectElement>(null);
  const inputEspecificacionesRef = useRef<HTMLInputElement>(null);
  const inputCantidadRef = useRef<HTMLInputElement>(null);
  const inputEfectivoRef = useRef<HTMLInputElement>(null);

  // Función para buscar clientes (alumnos y externos)
  useEffect(() => {
    let isMounted = true;
    
    const buscarClientes = async () => {
      if (busquedaCliente.trim().length < 2) {
        if (isMounted) {
          setResultadosBusqueda([]);
          setMostrarResultados(false);
        }
        return;
      }

      const query = busquedaCliente.trim().toLowerCase();
      const resultados: Array<{
        id: string;
        nombre: string;
        tipo: 'alumno' | 'externo';
        datos: any;
      }> = [];

      try {
        // Buscar en alumnos
        const alumnosEncontrados = await searchAlumnos(query);
        if (isMounted && alumnosEncontrados) {
          alumnosEncontrados.slice(0, 10).forEach(alumno => {
            resultados.push({
              id: alumno.id,
              nombre: alumno.nombre,
              tipo: 'alumno',
              datos: alumno,
            });
          });
        }

        // Buscar en externos (servidor; la tabla puede no tener columna `activo`)
        const externosEncontrados = await searchExternos(query);
        if (isMounted && externosEncontrados?.length) {
          externosEncontrados.slice(0, 10 - resultados.length).forEach((externo) => {
            if (externo.activo === false) return;
            resultados.push({
              id: externo.id,
              nombre: externo.nombre,
              tipo: 'externo',
              datos: externo,
            });
          });
        }

        if (isMounted) {
          setResultadosBusqueda(resultados.slice(0, 10));
          setMostrarResultados(resultados.length > 0);
        }
      } catch (error) {
        console.error('Error buscando clientes:', error);
        if (isMounted) {
          setResultadosBusqueda([]);
          setMostrarResultados(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      buscarClientes();
    }, 300); // Debounce de 300ms

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaCliente]);

  const seleccionarCliente = (cliente: typeof resultadosBusqueda[0]) => {
    setFormData({
      ...formData,
      cliente_id: cliente.id,
      cliente_tipo: cliente.tipo,
      cliente_nombre: cliente.nombre,
    });
    setClienteSeleccionado(cliente.datos);
    setBusquedaCliente(cliente.nombre); // Dejar el nombre del cliente en el input
    setMostrarResultados(false);
    
    // Mover foco al input de prenda
    setTimeout(() => {
      inputPrendaRef.current?.focus();
    }, 100);
  };

  // NUEVA IMPLEMENTACIÓN: Búsqueda simple y directa de prendas
  const sincronizarPosDropdownPrenda = useCallback(() => {
    const anchor = inputPrendaRef.current;
    if (!anchor) return;
    setPosDropdownPrenda(posicionDropdownFijo(anchor, 280, 300));
  }, []);

  const sincronizarPosDropdownCliente = useCallback(() => {
    const anchor = inputClienteRef.current;
    if (!anchor) return;
    setPosDropdownCliente(posicionDropdownFijo(anchor, 280, 280));
  }, []);

  const ejecutarBusquedaPrenda = useCallback(
    (texto: string) => {
      if (!texto || texto.trim().length === 0) {
        setPrendasEncontradas([]);
        setMostrarListaPrendas(false);
        return;
      }

      const textoMinuscula = texto.trim().toLowerCase();
      const resultados = prendas
        .filter(
          (prenda) =>
            prenda.activo !== false &&
            (prenda.nombre?.toLowerCase().includes(textoMinuscula) ||
              (prenda.codigo && prenda.codigo.toLowerCase().includes(textoMinuscula)))
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .slice(0, 15);

      setPrendasEncontradas(resultados);
      setMostrarListaPrendas(true);
      requestAnimationFrame(() => sincronizarPosDropdownPrenda());
    },
    [prendas, sincronizarPosDropdownPrenda]
  );

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  // iPad/Safari: si el catálogo tarda en cargar, re-filtrar cuando ya hay prendas en memoria
  useEffect(() => {
    if (textoPrendaBusqueda.trim()) {
      ejecutarBusquedaPrenda(textoPrendaBusqueda);
    }
    // Solo re-filtrar cuando llega el catálogo; el texto lo maneja onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prendas, ejecutarBusquedaPrenda]);

  useEffect(() => {
    if (mostrarResultados && resultadosBusqueda.length > 0) {
      requestAnimationFrame(() => sincronizarPosDropdownCliente());
    } else {
      setPosDropdownCliente(null);
    }
  }, [mostrarResultados, resultadosBusqueda, sincronizarPosDropdownCliente]);

  useEffect(() => {
    if (!mostrarResultados) return;
    return suscribirReposicionDropdownViewport(sincronizarPosDropdownCliente);
  }, [mostrarResultados, sincronizarPosDropdownCliente]);

  useEffect(() => {
    if (!mostrarListaPrendas) return;
    return suscribirReposicionDropdownViewport(sincronizarPosDropdownPrenda);
  }, [mostrarListaPrendas, sincronizarPosDropdownPrenda]);

  // NUEVA: Manejar cambio en el input de búsqueda
  const handleCambioBusquedaPrenda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoTexto = e.target.value;
    setTextoPrendaBusqueda(nuevoTexto);
    setIndicePrendaSeleccionada(-1);
    ejecutarBusquedaPrenda(nuevoTexto);
  };

  // NUEVA: Seleccionar una prenda del dropdown
  const seleccionarPrendaDelDropdown = async (prenda: Prenda) => {
    console.log('🎯 Prenda seleccionada:', prenda.nombre);
    
    setTextoPrendaBusqueda(prenda.nombre);
    setDetalleActual({
      ...detalleActual,
      prenda_id: prenda.id,
      prenda_nombre: prenda.nombre,
      talla_id: '',
      talla_nombre: '',
      precio: '0',
    });
    setMostrarListaPrendas(false);
    
    // Cargar tallas asociadas a esta prenda
    const { data } = await getCostosByPrenda(prenda.id);
    if (data) {
      const tallasIds = data.map(c => c.talla_id);
      const tallasFiltradas = tallas
        .filter(t => t.activo && tallasIds.includes(t.id))
        .sort((a, b) => {
          const aEsNumero = !isNaN(Number(a.nombre));
          const bEsNumero = !isNaN(Number(b.nombre));
          if (aEsNumero && !bEsNumero) return -1;
          if (!aEsNumero && bEsNumero) return 1;
          if (aEsNumero && bEsNumero) return Number(a.nombre) - Number(b.nombre);
          return a.nombre.localeCompare(b.nombre);
        });
      setTallasDisponibles(tallasFiltradas);
      
      // Mover foco al select de talla
      setTimeout(() => {
        selectTallaRef.current?.focus();
      }, 100);
    }
  };

  // Cerrar dropdowns al tocar fuera (sin cerrar al hacer scroll dentro del portal)
  useEffect(() => {
    return instalarCierrePointerFuera(
      [contenedorPrendaRef, dropdownPrendaRef, contenedorClienteRef, dropdownClienteRef],
      () => {
        setMostrarListaPrendas(false);
        setMostrarResultados(false);
      },
      interaccionDropdownPortalRef
    );
  }, []);

  // Enfocar automáticamente el input de cliente al abrir el modal
  useEffect(() => {
    if (mostrarFormulario) {
      setTimeout(() => {
        inputClienteRef.current?.focus();
      }, 100);
    }
  }, [mostrarFormulario]);

  // Manejar teclas F1 para ayuda y Ctrl+S para guardar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' && mostrarFormulario) {
        e.preventDefault();
        setMostrarAyuda(true);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && mostrarFormulario) {
        e.preventDefault();
        if (enviandoPedidoRef.current) return;
        const form = document.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarFormulario]);

  // ELIMINADO: useEffect y seleccionarPrenda viejos - ahora se usa seleccionarPrendaDelDropdown

  const seleccionarTalla = (tallaId: string) => {
    const talla = tallasDisponibles.find(t => t.id === tallaId);
    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === tallaId
    );
    
    if (costo) {
      setDetalleActual({
        ...detalleActual,
        talla_id: tallaId,
        talla_nombre: talla?.nombre || '',
        precio: costo.precio_venta.toString(),
      });
      
      // Mover foco a especificaciones
      setTimeout(() => {
        inputEspecificacionesRef.current?.focus();
      }, 100);
    }
  };

  const agregarDetalle = () => {
    console.log('➕ Intentando agregar detalle:', detalleActual);
    console.log('   - prenda_id:', detalleActual.prenda_id);
    console.log('   - talla_id:', detalleActual.talla_id);
    console.log('   - cantidad:', detalleActual.cantidad);
    console.log('   - precio:', detalleActual.precio);
    
    if (!detalleActual.prenda_id) {
      console.log('❌ Falta prenda_id');
      return;
    }
    if (!detalleActual.talla_id) {
      console.log('❌ Falta talla_id');
      return;
    }
    if (!detalleActual.cantidad || parseFloat(detalleActual.cantidad) <= 0) {
      console.log('❌ Falta cantidad válida');
      return;
    }

    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === detalleActual.talla_id
    );

    if (!costo) {
      console.log('❌ No se encontró costo');
      alert('No se encontró el costo para esta prenda y talla');
      return;
    }

    const cantidadSolicitada = parseFloat(detalleActual.cantidad);
    
    // División automática: calcular cuánto se puede vender y cuánto queda pendiente
    const stockDisponible = costo.stock || 0;
    const cantidadConStock = Math.min(stockDisponible, cantidadSolicitada);
    const cantidadPendiente = Math.max(0, cantidadSolicitada - stockDisponible);
    
    console.log(`📊 División automática: Total ${cantidadSolicitada} = ${cantidadConStock} con stock + ${cantidadPendiente} pendiente`);

    const cantidad = parseFloat(detalleActual.cantidad);
    const precio = parseFloat(detalleActual.precio);
    const total = cantidad * precio;

    const nuevoDetalle: DetallePedido = {
      prenda: detalleActual.prenda_nombre,
      prenda_id: detalleActual.prenda_id,
      talla: detalleActual.talla_nombre,
      talla_id: detalleActual.talla_id,
      especificaciones: detalleActual.especificaciones,
      cantidad: cantidad,
      pendiente: cantidadPendiente, // Solo lo que no tiene stock
      precio: precio,
      total: total,
      costoId: costo.id,
      tiene_stock: cantidadConStock > 0,
      cantidad_con_stock: cantidadConStock,
      cantidad_pendiente: cantidadPendiente,
    };

    console.log('✅ Agregando detalle:', nuevoDetalle);
    console.log('📋 Detalles actuales:', formData.detalles);
    
    setFormData({ 
      ...formData, 
      detalles: [...formData.detalles, nuevoDetalle] 
    });
    
    console.log('🧹 Limpiando campos de entrada');
    setDetalleActual({ 
      prenda_id: '', 
      prenda_nombre: '',
      talla_id: '', 
      talla_nombre: '',
      especificaciones: '',
      cantidad: '', 
      precio: '0' 
    });
    setTextoPrendaBusqueda('');
    setTallasDisponibles([]);
    
    // Mover foco al input de prenda para agregar otra partida
    setTimeout(() => {
      inputPrendaRef.current?.focus();
    }, 100);
  };

  const limpiarCamposParaNuevaPartida = () => {
    console.log('🆕 Nueva Partida - Limpiando campos');
    console.log('📋 Detalles antes de limpiar:', formData.detalles);
    setDetalleActual({ 
      prenda_id: '', 
      prenda_nombre: '',
      talla_id: '', 
      talla_nombre: '',
      especificaciones: '',
      cantidad: '', 
      precio: '0' 
    });
    setTextoPrendaBusqueda('');
    setTallasDisponibles([]);
    console.log('✅ Campos limpiados, detalles siguen igual');
  };

  const eliminarDetalle = (index: number) => {
    setFormData({
      ...formData,
      detalles: formData.detalles.filter((_, i) => i !== index)
    });
  };

  const abrirModalAgregarStock = async () => {
    if (!detalleActual.prenda_id || !detalleActual.talla_id) {
      alert('Primero selecciona una prenda y talla');
      return;
    }

    // Obtener stock actual
    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === detalleActual.talla_id
    );

    if (costo) {
      setStockActualDetalle(costo.stock || 0);
      setCantidadAgregar('');
      setMostrarModalAgregarStock(true);
    }
  };

  const guardarStockAgregado = async () => {
    if (!cantidadAgregar || parseFloat(cantidadAgregar) <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    try {
      // Buscar el costo correcto
      let costo = stockActualDetalle; // Si viene de una partida agregada
      
      if (!costo && detalleActual.prenda_id && detalleActual.talla_id) {
        // Si viene del flujo de agregar nueva partida
        costo = costos.find(c => 
          c.prenda_id === detalleActual.prenda_id && 
          c.talla_id === detalleActual.talla_id
        );
      }

      if (!costo) {
        alert('No se encontró el registro de costo');
        return;
      }

      const nuevaCantidad = parseFloat(cantidadAgregar);
      const nuevoStock = (costo.stock || 0) + nuevaCantidad;

      // Actualizar stock en la base de datos
      const { error } = await insforgeDb()
        .from('costos')
        .update({ stock: nuevoStock })
        .eq('id', costo.id);

      if (error) throw error;

      // Recargar TODOS los costos para actualizar la información
      await refetchCostos();

      // Si estamos agregando stock a una partida existente, recalcular división
      if (partidaParaAgregarStock !== null) {
        const partida = formData.detalles[partidaParaAgregarStock];
        const cantidadTotal = partida.cantidad;
        const cantidadConStock = Math.min(nuevoStock, cantidadTotal);
        const cantidadPendiente = Math.max(0, cantidadTotal - nuevoStock);

        // Actualizar la partida
        const nuevosDetalles = [...formData.detalles];
        nuevosDetalles[partidaParaAgregarStock] = {
          ...partida,
          cantidad_con_stock: cantidadConStock,
          cantidad_pendiente: cantidadPendiente,
          tiene_stock: cantidadConStock > 0,
        };

        setFormData({ ...formData, detalles: nuevosDetalles });
        setPartidaParaAgregarStock(null);
      }

      // Cerrar modal de agregar stock
      setMostrarModalAgregarStock(false);
      setCantidadAgregar('');
      setStockActualDetalle(null);

      // Mostrar modal de éxito
      setMensajeExitoStock(`Stock actualizado: ${costo.stock} → ${nuevoStock} (+${nuevaCantidad})`);
      setMostrarExitoStock(true);

      // Auto-cerrar modal de éxito después de 2 segundos
      setTimeout(() => {
        setMostrarExitoStock(false);
      }, 2000);

      // Enfocar en input de prenda para continuar agregando partidas
      setTimeout(() => {
        inputPrendaRef.current?.focus();
      }, 100);
    } catch (error: any) {
      console.error('Error al actualizar stock:', error);
      alert('Error al actualizar el stock: ' + error.message);
    }
  };

  const calcularTotal = () => {
    return formData.detalles.reduce((total, detalle) => 
      total + detalle.total, 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviandoPedidoRef.current) return;

    console.log('🚀 Iniciando creación de pedido...');
    console.log('📋 FormData:', formData);
    console.log('🛍️ Detalles:', formData.detalles);
    
    if (!formData.cliente_id || !formData.cliente_tipo) {
      console.log('❌ Error: No hay cliente seleccionado');
      alert('Por favor selecciona un cliente');
      return;
    }
    
    // Si hay un detalle actual sin agregar, avisar al usuario
    if (detalleActual.prenda_id && detalleActual.talla_id && parseFloat(detalleActual.cantidad) > 0) {
      console.log('❌ Error: Hay una prenda sin agregar');
      alert('Tienes una prenda sin agregar. Por favor da clic en "Nueva Partida" o limpia los campos.');
      return;
    }
    
    if (formData.detalles.length === 0) {
      console.log('❌ Error: No hay detalles en el pedido');
      alert('Debes agregar al menos un producto al pedido');
      return;
    }
    
    console.log('✅ Validaciones pasadas, preparando datos...');
    
    // Determinar estado automáticamente basado en pendientes
    const hayPendientes = formData.detalles.some(d => (d.cantidad_pendiente || 0) > 0);
    const estadoPedido = hayPendientes ? 'PENDIENTE' : 'COMPLETADO';
    
    console.log(`📊 Estado determinado: ${estadoPedido} (¿Hay pendientes? ${hayPendientes})`);
    
    // Preparar datos del pedido para la base de datos
    const pedidoParaDB = {
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: formData.cliente_id,
      cliente_tipo: formData.cliente_tipo,
      cliente_nombre: formData.cliente_nombre,
      total: calcularTotal(),
      estado: estadoPedido as 'PENDIENTE' | 'COMPLETADO',
      observaciones: formData.observaciones,
      modalidad_pago: formData.modalidad_pago,
      efectivo_recibido: parseFloat(formData.efectivo_recibido as string) || 0,
    };

    // Preparar detalles para la base de datos
    const detallesParaDB = formData.detalles.map(detalle => ({
      prenda_id: detalle.prenda_id,
      talla_id: detalle.talla_id,
      cantidad: detalle.cantidad,
      // IMPORTANTE: usar nullish coalescing, porque 0 es un valor válido (todo pendiente)
      cantidad_con_stock: detalle.cantidad_con_stock ?? detalle.cantidad, // Cuánto descontar del inventario
      cantidad_pendiente: detalle.cantidad_pendiente ?? 0, // Cuánto queda pendiente
      precio_unitario: detalle.precio,
      subtotal: detalle.total,
      pendiente: detalle.cantidad_pendiente ?? 0, // Campo pendiente en BD
      especificaciones: detalle.especificaciones,
      tiene_stock: (detalle.cantidad_con_stock ?? 0) > 0, // Tiene stock si hay al menos algo disponible
    }));

    // Crear el pedido en la base de datos
    console.log('💾 Llamando a crearPedido...');
    enviandoPedidoRef.current = true;
    setGuardandoPedido(true);
    try {
      const resultado = await crearPedido(
        pedidoParaDB,
        detallesParaDB,
        sesion?.sucursal_id,
        sesion?.usuario_id
      );
      console.log('📦 Resultado:', resultado);

      if (resultado.success && resultado.data) {
        console.log('✅ Pedido creado exitosamente, ID:', resultado.data.id);
        console.log('🔀 Navegando a /pedidos/' + resultado.data.id);
        router.push(`/pedidos/${resultado.data.id}`);
      } else {
        console.error('❌ Error al crear pedido:', resultado.error);

        const errorMsg =
          typeof resultado.error === 'string'
            ? resultado.error
            : resultado.error?.message || 'Error desconocido al crear el pedido';

        alert(`❌ Error al crear el pedido\n\n${errorMsg}`);
        console.error('Error completo:', resultado.error);
      }
    } finally {
      enviandoPedidoRef.current = false;
      setGuardandoPedido(false);
    }
  };

  const cambiarEstado = async (id: string, nuevoEstado: Pedido['estado']) => {
    console.log('🔄 Cambiando estado del pedido:', id, 'a', nuevoEstado);
    const resultado = await actualizarEstadoPedido(id, nuevoEstado, (sesion as any)?.usuario_id ?? null);

    if (resultado.success) {
      console.log('✅ Estado actualizado correctamente');
      if (nuevoEstado === 'COMPLETADO') {
        const avisos =
          'warnings' in resultado && Array.isArray(resultado.warnings) && resultado.warnings.length
            ? '\n\n⚠️ Sin descontar inventario:\n' + resultado.warnings.join('\n')
            : '';
        alert('✅ Pedido marcado como COMPLETADO' + avisos);
      } else {
        alert('✅ Pedido actualizado correctamente');
      }
    } else {
      const msg = typeof resultado.error === 'string' ? resultado.error : 'Error desconocido';
      console.error('❌ Error al actualizar estado:', msg);
      alert(`❌ Error al actualizar el estado del pedido\n\n${msg}`);
    }
  };

  const verDetallePedido = async (pedido: Pedido) => {
    try {
      console.log('🔍 Buscando detalles del pedido:', pedido.id);
      
      // Obtener los detalles del pedido
      const { data: detalles, error } = await insforgeDb()
        .from('detalle_pedidos')
        .select('*')
        .eq('pedido_id', pedido.id);

      if (error) {
        console.error('❌ Error completo:', JSON.stringify(error, null, 2));
        console.error('❌ Mensaje:', error.message);
        console.error('❌ Detalles:', error.details);
        console.error('❌ Hint:', error.hint);
        console.error('❌ Code:', error.code);
        alert(`Error al cargar los detalles del pedido: ${error.message || 'Error desconocido'}`);
        return;
      }
      
      console.log('✅ Detalles obtenidos:', detalles);

      // Enriquecer los detalles con nombres de prendas y tallas
      const detallesEnriquecidos = await Promise.all(
        (detalles || []).map(async (detalle) => {
          // Buscar prenda
          const prenda = prendas.find(p => p.id === detalle.prenda_id);
          // Buscar talla
          const talla = tallas.find(t => t.id === detalle.talla_id);
          
          return {
            ...detalle,
            prenda: { nombre: prenda?.nombre || 'N/A' },
            talla: { nombre: talla?.nombre || 'N/A' }
          };
        })
      );

      // Guardar el pedido con sus detalles
      setPedidoSeleccionado({
        ...pedido,
        detalles: detallesEnriquecidos
      });
      setMostrarModal(true);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar los detalles del pedido');
    }
  };

  return (
    <>
    <LayoutWrapper>
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
      `}</style>
      <Suspense fallback={null}>
        <SearchParamsDetector setMostrarFormulario={setMostrarFormulario} />
      </Suspense>
      <div className="main-container" style={{ paddingTop: '1rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', textAlign: 'center', marginBottom: '1rem' }}>
          🛒 Gestión de Pedidos
        </h1>

        {sesion?.sucursal_nombre && (
          <div
            style={{
              marginBottom: '1.25rem',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #dbeafe',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '10px',
              padding: '0.85rem 1.15rem',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
              fontSize: '0.92rem',
            }}
          >
            Mostrando pedidos de <strong style={{ color: '#1e40af' }}>{sesion.sucursal_nombre}</strong> únicamente.
            Cada tienda tiene su propio historial y folios (ej. PED-MAT-MAD-… / PED-SUC-WIN-…).
          </div>
        )}

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
              zIndex: 9999,
              padding: '1rem',
              overflowY: 'auto'
            }}
          >
            <div 
              className="form-container" 
              style={{ 
                maxWidth: '1400px', 
                width: '100%', 
                maxHeight: '95vh',
                overflowY: 'auto',
                padding: '1.5rem', 
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #e0e0e0'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#374151' }}>
                  ➕ Nuevo Pedido
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarAyuda(true)}
                    style={{
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      color: 'white',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Ayuda (F1)"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setFormData({ 
                        cliente_id: '', 
                        cliente_tipo: '', 
                        cliente_nombre: '', 
                        detalles: [],
                  observaciones: '',
                  modalidad_pago: 'TOTAL',
                  efectivo_recibido: ''
                      });
                      setBusquedaCliente('');
                      setClienteSeleccionado(null);
                    }}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      color: 'white',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', fontSize: '0.9rem' }}>Alumno/Externo *</label>
                <div ref={contenedorClienteRef} style={{ position: 'relative' }}>
                  <input
                    ref={inputClienteRef}
                    type="text"
                    className="form-input"
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      setIndiceClienteSeleccionado(-1);
                      if (e.target.value === '') {
                        setFormData({ ...formData, cliente_id: '', cliente_tipo: '', cliente_nombre: '' });
                        setClienteSeleccionado(null);
                      }
                    }}
                    onFocus={() => {
                      setBusquedaCliente('');
                      setFormData({ ...formData, cliente_id: '', cliente_tipo: '', cliente_nombre: '' });
                      setClienteSeleccionado(null);
                      setIndiceClienteSeleccionado(-1);
                      if (resultadosBusqueda.length > 0) {
                        setMostrarResultados(true);
                        requestAnimationFrame(() => sincronizarPosDropdownCliente());
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!mostrarResultados || resultadosBusqueda.length === 0) return;
                      
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setIndiceClienteSeleccionado(prev => 
                          prev < resultadosBusqueda.length - 1 ? prev + 1 : prev
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setIndiceClienteSeleccionado(prev => prev > 0 ? prev - 1 : -1);
                      } else if (e.key === 'Enter' && indiceClienteSeleccionado >= 0) {
                        e.preventDefault();
                        seleccionarCliente(resultadosBusqueda[indiceClienteSeleccionado]);
                      } else if (e.key === 'Escape') {
                        setMostrarResultados(false);
                        setIndiceClienteSeleccionado(-1);
                      }
                    }}
                    placeholder="🔍 Buscar alumno o externo..."
                    style={{ width: '100%', padding: '0.5rem', fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                {/* Mostrar datos del cliente seleccionado */}
                {clienteSeleccionado && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '600' }}>
                      {formData.cliente_tipo === 'alumno' ? '🎓 Datos del Alumno' : '👤 Datos del Cliente'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Nombre:</strong> {clienteSeleccionado.nombre}
                      </div>
                      {formData.cliente_tipo === 'alumno' && (
                        <>
                          {clienteSeleccionado.referencia && (
                            <div>
                              <strong>Referencia:</strong> {clienteSeleccionado.referencia}
                            </div>
                          )}
                          {clienteSeleccionado.nivel && (
                            <div>
                              <strong>Nivel:</strong> {clienteSeleccionado.nivel}
                            </div>
                          )}
                          {clienteSeleccionado.grado && (
                            <div>
                              <strong>Grado:</strong> {clienteSeleccionado.grado}
                            </div>
                          )}
                          {clienteSeleccionado.grupo && (
                            <div>
                              <strong>Grupo:</strong> {clienteSeleccionado.grupo}
                            </div>
                          )}
                        </>
                      )}
                      {formData.cliente_tipo === 'externo' && (
                        <>
                          {clienteSeleccionado.telefono && (
                            <div>
                              <strong>Teléfono:</strong> {clienteSeleccionado.telefono}
                            </div>
                          )}
                          {clienteSeleccionado.email && (
                            <div>
                              <strong>Email:</strong> {clienteSeleccionado.email}
                            </div>
                          )}
                          {clienteSeleccionado.direccion && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong>Dirección:</strong> {clienteSeleccionado.direccion}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📄 Detalles del Pedido
                  </h3>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={limpiarCamposParaNuevaPartida}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    + Nueva Partida
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>🗑️</th>
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>👕 Prenda</th>
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>📏 Talla</th>
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>ℹ️ Especif.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>📦 Stock</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>🔢 Cant.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>✅ Entreg.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>⚠️ Pend.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'right', fontWeight: '600', fontSize: '0.75rem' }}>$ Precio</th>
                        <th style={{ padding: '0.3rem', textAlign: 'right', fontWeight: '600', fontSize: '0.75rem' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Encabezado de nueva partida */}
                      <tr>
                        <td colSpan={10} style={{ padding: '0.75rem 0 0.5rem 0', backgroundColor: '#f0f9ff', borderBottom: '2px solid #3b82f6' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            paddingLeft: '0.5rem'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              animation: 'pulse 2s infinite'
                            }} />
                            <span style={{
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              color: '#1e40af',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              ➕ Agregar Nueva Partida
                            </span>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Fila para agregar nuevo detalle */}
                      <tr style={{ borderBottom: '2px solid #3b82f6', backgroundColor: '#f8fafc' }}>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDetalleActual({ 
                                prenda_id: '', 
                                prenda_nombre: '',
                                talla_id: '', 
                                talla_nombre: '',
                                especificaciones: '',
                                cantidad: '', 
                                precio: '0' 
                              });
                              setTextoPrendaBusqueda('');
                              setTallasDisponibles([]);
                            }}
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            🗑️
                          </button>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <div ref={contenedorPrendaRef} style={{ position: 'relative' }}>
                            <input
                              ref={inputPrendaRef}
                              type="text"
                              className="form-input"
                              value={textoPrendaBusqueda}
                              onChange={handleCambioBusquedaPrenda}
                              onFocus={() => {
                                if (textoPrendaBusqueda.trim()) {
                                  ejecutarBusquedaPrenda(textoPrendaBusqueda);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (!mostrarListaPrendas || prendasEncontradas.length === 0) {
                                  if (e.key === 'Enter' && !detalleActual.prenda_id && formData.detalles.length > 0) {
                                    e.preventDefault();
                                    inputEfectivoRef.current?.focus();
                                  }
                                  return;
                                }

                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setIndicePrendaSeleccionada(prev => 
                                    prev < prendasEncontradas.length - 1 ? prev + 1 : prev
                                  );
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setIndicePrendaSeleccionada(prev => prev > 0 ? prev - 1 : -1);
                                } else if (e.key === 'Enter' && indicePrendaSeleccionada >= 0) {
                                  e.preventDefault();
                                  seleccionarPrendaDelDropdown(prendasEncontradas[indicePrendaSeleccionada]);
                                } else if (e.key === 'Escape') {
                                  setMostrarListaPrendas(false);
                                  setIndicePrendaSeleccionada(-1);
                                }
                              }}
                              placeholder="SELECCIONAR PRENDA..."
                              style={{ width: '100%', fontSize: '16px', fontWeight: '600', padding: '0.3rem' }}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                            />
                            {prendasLoading && prendas.length === 0 && (
                              <small style={{ display: 'block', marginTop: '0.25rem', color: '#64748b' }}>
                                Cargando catálogo de prendas…
                              </small>
                            )}
                            {!prendasLoading && prendasError && (
                              <button
                                type="button"
                                onClick={() => void refetchPrendas()}
                                style={{
                                  marginTop: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: '#b91c1c',
                                  background: 'none',
                                  border: 'none',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                Error al cargar prendas — reintentar
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <select
                            ref={selectTallaRef}
                            className="form-select"
                            value={detalleActual.talla_id}
                            onChange={(e) => seleccionarTalla(e.target.value)}
                            disabled={!detalleActual.prenda_id}
                            style={{ width: '100%', fontSize: '0.85rem', padding: '0.3rem' }}
                          >
                            <option value="">Seleccionar</option>
                            {tallasDisponibles.map(talla => (
                              <option key={talla.id} value={talla.id}>
                                {talla.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            ref={inputEspecificacionesRef}
                            type="text"
                            className="form-input"
                            value={detalleActual.especificaciones}
                            onChange={(e) => setDetalleActual({ ...detalleActual, especificaciones: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                inputCantidadRef.current?.focus();
                              }
                            }}
                            placeholder="Color, bordado, notas..."
                            style={{ width: '100%', fontSize: '0.85rem', padding: '0.3rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {(() => {
                            const costo = costos.find(c => 
                              c.prenda_id === detalleActual.prenda_id && 
                              c.talla_id === detalleActual.talla_id
                            );
                            const stock = costo?.stock || 0;
                            return (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.3rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                backgroundColor: stock === 0 ? '#fee2e2' : stock < 10 ? '#fef3c7' : '#d1fae5',
                                color: stock === 0 ? '#991b1b' : stock < 10 ? '#92400e' : '#065f46'
                              }}>
                                {stock}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            ref={inputCantidadRef}
                            type="number"
                            className="form-input"
                            value={detalleActual.cantidad}
                            onChange={(e) => {
                              const cantidad = e.target.value;
                              setDetalleActual({ ...detalleActual, cantidad });
                            }}
                            onBlur={(e) => {
                              const cantidad = e.target.value;
                              // Agregar automáticamente cuando todos los campos están completos al salir del input
                              if (detalleActual.prenda_id && detalleActual.talla_id && parseFloat(cantidad) > 0) {
                                agregarDetalle();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const cantidad = (e.target as HTMLInputElement).value;
                                // Agregar automáticamente al presionar Enter (mismo comportamiento que TAB)
                                if (detalleActual.prenda_id && detalleActual.talla_id && parseFloat(cantidad) > 0) {
                                  agregarDetalle();
                                  // agregarDetalle() ya enfoca inputPrendaRef automáticamente
                                }
                              }
                            }}
                            min="0"
                            style={{ width: '80px', textAlign: 'center', fontSize: '0.85rem', padding: '0.3rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                          -
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                          -
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={detalleActual.precio}
                            onChange={(e) => setDetalleActual({ ...detalleActual, precio: e.target.value })}
                            readOnly
                            style={{ width: '100px', textAlign: 'right', fontSize: '0.85rem', padding: '0.3rem', backgroundColor: '#f8f9fa' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}>
                          ${((parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0)).toFixed(2)}
                        </td>
                      </tr>

                      {/* Separador visual elegante */}
                      {formData.detalles.length > 0 && (
                        <tr>
                          <td colSpan={10} style={{ padding: '1rem 0', position: 'relative' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1rem',
                              margin: '0.5rem 0'
                            }}>
                              <div style={{
                                flex: 1,
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)',
                                opacity: 0.3
                              }} />
                              <span style={{
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                padding: '0.5rem 1.5rem',
                                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                                borderRadius: '20px',
                                border: '1px solid #cbd5e1',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                whiteSpace: 'nowrap'
                              }}>
                                📦 Partidas Agregadas ({formData.detalles.length})
                              </span>
                              <div style={{
                                flex: 1,
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)',
                                opacity: 0.3
                              }} />
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Filas de detalles agregados */}
                      {formData.detalles.map((detalle, index) => (
                        <tr 
                          key={index} 
                          style={{ 
                            borderBottom: '1px solid #e0e0e0', 
                            backgroundColor: (detalle.cantidad_pendiente || 0) > 0 ? '#fef2f2' : '#fafafa',
                            borderLeft: (detalle.cantidad_pendiente || 0) > 0 ? '4px solid #ef4444' : 'none'
                          }}
                        >
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => eliminarDetalle(index)}
                              className="btn btn-danger"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            >
                              🗑️
                            </button>
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                            {(detalle.cantidad_pendiente || 0) > 0 && (
                              <span style={{ 
                                display: 'inline-block',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                marginRight: '0.5rem'
                              }}>
                                ⚠️ PENDIENTE
                              </span>
                            )}
                            {detalle.prenda}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className="badge badge-info">{detalle.talla}</span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                            {detalle.especificaciones || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {(() => {
                              const costo = costos.find(c => 
                                c.prenda_id === detalle.prenda_id && 
                                c.talla_id === detalle.talla_id
                              );
                              const stock = costo?.stock || 0;
                              return (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: '700',
                                  backgroundColor: stock === 0 ? '#fee2e2' : stock < 10 ? '#fef3c7' : '#d1fae5',
                                  color: stock === 0 ? '#991b1b' : stock < 10 ? '#92400e' : '#065f46'
                                }}>
                                  {stock}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>
                            {detalle.cantidad}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {(() => {
                              const entregado = detalle.cantidad_con_stock || 0;
                              return (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: '700',
                                  backgroundColor: '#d1fae5',
                                  color: '#065f46'
                                }}>
                                  {entregado}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {(() => {
                              const pendiente = detalle.cantidad_pendiente || 0;
                              const hayPendientes = pendiente > 0;
                              
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '0.3rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    backgroundColor: hayPendientes ? '#fee2e2' : '#f3f4f6',
                                    color: hayPendientes ? '#991b1b' : '#6b7280'
                                  }}>
                                    {pendiente}
                                  </span>
                                  {hayPendientes && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStockActualDetalle(costos.find(c => 
                                          c.prenda_id === detalle.prenda_id && 
                                          c.talla_id === detalle.talla_id
                                        ));
                                        setPartidaParaAgregarStock(index);
                                        setCantidadAgregar('');
                                        setMostrarModalAgregarStock(true);
                                      }}
                                      style={{
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(59,130,246,0.3)',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#3b82f6';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }}
                                      title="Agregar stock"
                                    >
                                      📦+
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${detalle.precio.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: (detalle.cantidad_pendiente || 0) > 0 ? '#f59e0b' : '#10b981' }}>
                            ${detalle.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección de Observaciones y Resumen */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '0.75rem', 
                marginTop: '0.75rem' 
              }}>
                {/* Observaciones del Pedido */}
                <div style={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  backgroundColor: '#fafafa'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💬 Observaciones del Pedido
                  </h3>
                  <textarea
                    className="form-input"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Agregar observaciones o notas especiales..."
                    rows={3}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem', padding: '0.4rem' }}
                  />
                </div>

                {/* Resumen del Pedido */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                  borderRadius: '12px', 
                  padding: '1.25rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  border: '2px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h3 style={{ 
                    fontSize: '1.15rem', 
                    fontWeight: '700', 
                    marginBottom: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.6rem',
                    color: '#1e40af',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    📊 Resumen del Pedido
                  </h3>
                  
                  {/* Subtotal */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '1rem',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '8px',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}>
                    <span>💵 Subtotal:</span>
                    <span>
                      ${(() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        return (totalDetalles + totalActual).toFixed(2);
                      })()}
                    </span>
                  </div>

                  {/* Modalidad de Pago - Solo Pago Total */}
                  <div style={{ 
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>💳</span>
                    <span style={{ fontWeight: '700', color: '#1e40af', fontSize: '0.95rem' }}>
                      Pago Total
                    </span>
                  </div>

                  {/* Efectivo Recibido */}
                  <div style={{ 
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.6rem', 
                      fontWeight: '700',
                      color: '#1e40af',
                      fontSize: '0.95rem'
                    }}>
                      💰 Efectivo Recibido:
                    </label>
                    <input
                      ref={inputEfectivoRef}
                      type="number"
                      className="form-input"
                      value={formData.efectivo_recibido}
                      onChange={(e) => setFormData({ ...formData, efectivo_recibido: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      style={{ 
                        width: '100%', 
                        padding: '0.6rem',
                        fontSize: '1.05rem',
                        fontWeight: '600',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#1f2937'
                      }}
                    />
                  </div>

                  {/* Cambio a Entregar */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: (() => {
                      const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                      const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                      const totalGeneral = totalDetalles + totalActual;
                      const efectivoRecibido = parseFloat(formData.efectivo_recibido as string) || 0;
                      return efectivoRecibido < totalGeneral 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                    })(),
                    borderRadius: '8px',
                    fontSize: '1.15rem',
                    fontWeight: '700',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    <span>🔄 Cambio a Entregar:</span>
                    <span>
                      $                      {(() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        const totalGeneral = totalDetalles + totalActual;
                        const efectivoRecibido = parseFloat(formData.efectivo_recibido as string) || 0;
                        return Math.max(0, efectivoRecibido - totalGeneral).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formData.detalles.length === 0 || guardandoPedido}
                >
                  {guardandoPedido ? '⏳ Guardando pedido…' : '💾 Crear Pedido'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setFormData({ 
                      cliente_id: '', 
                      cliente_tipo: '', 
                      cliente_nombre: '', 
                      detalles: [],
                  observaciones: '',
                  modalidad_pago: 'TOTAL',
                  efectivo_recibido: ''
                    });
                    setBusquedaCliente('');
                    setClienteSeleccionado(null);
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
            </div>
          </div>
        )}

        {/* Botón Nuevo Pedido */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
          >
            ➕ Nuevo Pedido
          </button>
        </div>

        {/* Filtro de mes y año */}
        <div style={{ 
          display: 'flex', 
          gap: '1.5rem', 
          marginBottom: '1.5rem',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ 
              fontWeight: '700', 
              fontSize: '1.1rem',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>🎯 Filtrar por:</span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>Mes:</label>
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
              className="form-select"
              style={{ 
                width: '140px',
                fontWeight: '600',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
              }}
            >
              {meses.map(mes => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.nombre}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>Año:</label>
            <select
              value={añoSeleccionado}
              onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
              className="form-select"
              style={{ 
                width: '100px',
                fontWeight: '600',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
              }}
            >
              {años.map(año => (
                <option key={año} value={año}>
                  {año}
                </option>
              ))}
            </select>
          </div>

          <div style={{ 
            marginLeft: 'auto',
            fontSize: '1rem',
            color: 'white',
            fontWeight: '700',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}>
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} encontrado{pedidos.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <td data-label="Folio" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {pedido.folio || `— ${String(pedido.id).slice(0, 8)}…`}
                  </td>
                  <td data-label="Fecha">{pedido.fecha}</td>
                  <td data-label="Cliente" style={{ fontWeight: '600' }}>{pedido.cliente_nombre || pedido.cliente || 'N/A'}</td>
                  <td data-label="Tipo">
                    <span className={`badge ${pedido.cliente_tipo === 'alumno' ? 'badge-info' : 'badge-warning'}`}>
                      {pedido.cliente_tipo === 'alumno' ? '🎓 Alumno' : '👤 Externo'}
                    </span>
                  </td>
                  <td data-label="Total" style={{ fontWeight: '700', color: '#10b981' }}>${pedido.total.toFixed(2)}</td>
                  <td data-label="Estado">
                    <span className={`badge ${
                      pedido.estado === 'PENDIENTE' ? 'badge-warning' :
                      pedido.estado === 'COMPLETADO' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {pedido.estado}
                    </span>
                  </td>
                  <td>
                    <div className="pedidos-acciones-cell">
                    {/* Acciones: select según estado (estilo en globals.css) */}
                    {pedido.estado !== 'CANCELADO' && pedido.estado !== 'CANCELADO_PARCIAL' && (
                      <span className="pedidos-acciones-wrap">
                      <select
                        className="pedidos-acciones-select"
                        aria-label="Acciones del pedido"
                        defaultValue=""
                        onChange={async (e) => {
                          const v = e.target.value;
                          e.currentTarget.value = '';
                          if (!v) return;
                          if (v === 'COMPLETAR') {
                            await cambiarEstado(pedido.id, 'COMPLETADO');
                            return;
                          }
                          if (v === 'ELIMINAR') {
                            const pin = prompt('PIN de seguridad para eliminar el pedido:', '');
                            if (pin !== '9207') {
                              alert('PIN incorrecto. Cancelado.');
                              return;
                            }
                            const devolver = confirm(
                              '¿Deseas devolver al stock las prendas descontadas por esta venta? (Recomendado: Sí)'
                            );
                            if (!devolver) {
                              alert('Cancelado. No se eliminó el pedido.');
                              return;
                            }
                            const folio = pedido.folio || `#${String(pedido.id).slice(0, 8)}…`;
                            const ok = confirm(
                              `⚠️ ELIMINACIÓN DEFINITIVA\n\nSe eliminará el pedido ${folio} y sus partidas.\nSe repondrá el stock entregado.\n\n¿Continuar?`
                            );
                            if (!ok) return;

                            const res = await eliminarPedidoDefinitivo(pedido.id, 'ELIMINADO DESDE UI');
                            if (!res.success) {
                              alert(`No se pudo eliminar: ${res.error || 'Error desconocido'}`);
                              return;
                            }
                            alert(`✅ Pedido ${folio} eliminado definitivamente.`);
                            return;
                          }
                          if (v === 'DEVOLUCION') {
                            // Cargar detalles del pedido con JOIN de prendas y tallas (incluye pendiente)
                            const { data: detalles, error } = await insforgeDb()
                              .from('detalle_pedidos')
                              .select(
                                `
                                  *,
                                  prenda:prendas(id, nombre, codigo),
                                  talla:tallas(id, nombre)
                                `
                              )
                              .eq('pedido_id', pedido.id);

                            if (!error && detalles) {
                              const detallesEnriquecidos = detalles.map((det: any) => {
                                const prendaObj = Array.isArray(det.prenda) ? det.prenda[0] : det.prenda;
                                const tallaObj = Array.isArray(det.talla) ? det.talla[0] : det.talla;
                                const prendaNombre = prendaObj?.nombre || 'Sin nombre';
                                const prendaCodigo = prendaObj?.codigo || '';
                                const tallaNombre = tallaObj?.nombre || 'N/A';
                                const precioUnitario = det.precio_unitario || det.precio || 0;
                                const cantidad = det.cantidad || 1;
                                const pendiente = det.pendiente || 0;
                                return {
                                  id: det.id,
                                  detalle_pedido_id: det.id,
                                  prenda_id: det.prenda_id,
                                  talla_id: det.talla_id,
                                  prenda_nombre: prendaNombre,
                                  prenda_codigo: prendaCodigo,
                                  talla_nombre: tallaNombre,
                                  precio: precioUnitario,
                                  precio_unitario: precioUnitario,
                                  cantidad: cantidad,
                                  cantidad_original: cantidad,
                                  pendiente,
                                  subtotal: det.subtotal || precioUnitario * cantidad,
                                  especificaciones: det.especificaciones || '',
                                };
                              });

                              setPedidoSeleccionado({ ...pedido, detalles: detallesEnriquecidos });
                              setMostrarModalDevolucion(true);
                            } else {
                              console.error('❌ Error al cargar detalles:', error);
                              alert('Error al cargar detalles del pedido: ' + (error?.message || 'Desconocido'));
                            }
                            return;
                          }
                        }}
                      >
                        <option value="">Acciones…</option>
                        {pedido.estado === 'PENDIENTE' && <option value="COMPLETAR">✓ Completar (descuenta pendientes)</option>}
                        {(pedido.estado === 'PENDIENTE' || pedido.estado === 'COMPLETADO') && (
                          <option value="DEVOLUCION">🔄 Devolución / Cambio</option>
                        )}
                        {(pedido.estado === 'PENDIENTE' || pedido.estado === 'COMPLETADO') && (
                          <option value="ELIMINAR">🗑 Eliminar (definitivo)</option>
                        )}
                      </select>
                      </span>
                    )}
                    
                    {/* Botón Ver - Siempre visible para ver el recibo */}
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 1rem' }}
                      onClick={() => router.push(`/pedidos/${pedido.id}`)}
                    >
                      👁️ Ver
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalles del Pedido */}
      {mostrarModal && pedidoSeleccionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '2rem'
        }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
              padding: '1.5rem',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                📋 Pedido {pedidoSeleccionado.folio || `#${pedidoSeleccionado.id}`}
              </h2>
              <button
                onClick={() => setMostrarModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  color: 'white',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>

            {/* Contenido del Modal */}
            <div style={{ padding: '2rem' }}>
              {/* Información del Pedido */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>📅 Fecha</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{pedidoSeleccionado.fecha}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>👤 Cliente</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{pedidoSeleccionado.cliente}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>📊 Estado</div>
                  <div>
                    <span style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      backgroundColor: pedidoSeleccionado.estado === 'PENDIENTE' ? '#fef3c7' :
                                       pedidoSeleccionado.estado === 'COMPLETADO' ? '#d1fae5' : '#fee2e2',
                      color: pedidoSeleccionado.estado === 'PENDIENTE' ? '#92400e' :
                             pedidoSeleccionado.estado === 'COMPLETADO' ? '#065f46' : '#991b1b'
                    }}>
                      {pedidoSeleccionado.estado}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>💰 Total</div>
                  <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#10b981' }}>
                    ${pedidoSeleccionado.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Tabla de Productos */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#374151' }}>
                  🛍️ Productos
                </h3>
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem' }}>Prenda</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', fontSize: '0.85rem' }}>Talla</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem' }}>Especificaciones</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', fontSize: '0.85rem' }}>Cantidad</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}>Precio Unit.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidoSeleccionado.detalles && pedidoSeleccionado.detalles.map((detalle: any, index: number) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '600' }}>{detalle.prenda?.nombre || 'N/A'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{ 
                              backgroundColor: '#dbeafe', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}>
                              {detalle.talla?.nombre || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                            {detalle.especificaciones || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>
                            {detalle.cantidad}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${detalle.precio_unitario.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                            ${detalle.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botón Cerrar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  onClick={() => setMostrarModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Devoluciones */}
      <ModalDevolucion
        isOpen={mostrarModalDevolucion}
        onClose={() => {
          setMostrarModalDevolucion(false);
          setPedidoSeleccionado(null);
        }}
        pedido={pedidoSeleccionado}
        onSuccess={() => {
          // Recargar pedidos después de registrar la devolución
          window.location.reload();
        }}
      />

      {/* Modal para Agregar Stock Rápido */}
      {mostrarModalAgregarStock && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10002,
            padding: '1rem'
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '2rem',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>📦</div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700' }}>
                Agregar Stock
              </h2>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  backgroundColor: '#f0fdf4', 
                  borderRadius: '12px', 
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  border: '2px solid #bbf7d0'
                }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Prenda:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#065f46' }}>
                      {partidaParaAgregarStock !== null 
                        ? formData.detalles[partidaParaAgregarStock].prenda
                        : detalleActual.prenda_nombre}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Talla:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#065f46' }}>
                      {partidaParaAgregarStock !== null 
                        ? formData.detalles[partidaParaAgregarStock].talla
                        : detalleActual.talla_nombre}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Stock actual:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '700', color: (stockActualDetalle?.stock || 0) === 0 ? '#dc2626' : '#059669' }}>
                      {stockActualDetalle?.stock || 0} unidades
                    </span>
                  </div>
                </div>

                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem', 
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '1.05rem'
                }}>
                  Cantidad a agregar:
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={cantidadAgregar}
                  onChange={(e) => setCantidadAgregar(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarStockAgregado();
                    }
                  }}
                  min="1"
                  placeholder="Ingresa cantidad..."
                  autoFocus
                  style={{ 
                    width: '100%', 
                    padding: '0.875rem',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    textAlign: 'center',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    marginBottom: '1rem'
                  }}
                />

                {cantidadAgregar && parseFloat(cantidadAgregar) > 0 && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#dbeafe', 
                    borderRadius: '12px',
                    marginBottom: '1rem',
                    borderLeft: '4px solid #3b82f6',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e40af' }}>
                      Stock nuevo: <strong style={{ fontSize: '1.2rem' }}>
                        {stockActualDetalle + parseFloat(cantidadAgregar)} unidades
                      </strong>
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setMostrarModalAgregarStock(false);
                    setCantidadAgregar('');
                    setStockActualDetalle(null);
                    setPartidaParaAgregarStock(null);
                    
                    // Volver al input de prenda para continuar
                    setTimeout(() => {
                      inputPrendaRef.current?.focus();
                    }, 100);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    borderRadius: '12px',
                    border: '2px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarStockAgregado}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    fontSize: '1.05rem',
                    fontWeight: '700',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  💾 Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Éxito - Stock Actualizado */}
      {mostrarExitoStock && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10003,
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div 
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '2rem 3rem',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(16, 185, 129, 0.5)',
              textAlign: 'center',
              minWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: '700',
              marginBottom: '0.75rem'
            }}>
              Stock Actualizado
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '1.1rem',
              opacity: 0.95
            }}>
              {mensajeExitoStock}
            </p>
          </div>
        </div>
      )}

      {/* Modal de Ayuda - Shortcuts de Teclado */}
      {mostrarAyuda && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              padding: '1.5rem',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                ⌨️ Atajos de Teclado
              </h2>
              <button
                onClick={() => setMostrarAyuda(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  color: 'white',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#1e40af' }}>
                  🔍 Búsqueda (Cliente/Prenda)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>↓ Flecha Abajo</span>
                    <span style={{ color: '#666' }}>Siguiente resultado</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>↑ Flecha Arriba</span>
                    <span style={{ color: '#666' }}>Resultado anterior</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Enter</span>
                    <span style={{ color: '#666' }}>Seleccionar elemento</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Escape</span>
                    <span style={{ color: '#666' }}>Cerrar resultados</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#1e40af' }}>
                  📝 Formulario de Pedido
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Tab</span>
                    <span style={{ color: '#666' }}>Siguiente campo</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Shift + Tab</span>
                    <span style={{ color: '#666' }}>Campo anterior</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Enter (en cantidad)</span>
                    <span style={{ color: '#666' }}>Agregar partida automáticamente</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#1e40af' }}>
                  ⚡ Atajos Generales
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>F1</span>
                    <span style={{ color: '#666' }}>Abrir esta ayuda</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Ctrl + S</span>
                    <span style={{ color: '#666' }}>Guardar pedido</span>
                  </div>
                </div>
              </div>

              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#dbeafe', 
                borderRadius: '8px',
                borderLeft: '4px solid #3b82f6'
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', fontWeight: '600' }}>
                  💡 Tip: Todo el sistema puede operarse completamente con el teclado para mayor eficiencia.
                </p>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button
                  onClick={() => setMostrarAyuda(false)}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutWrapper>
    {portalMounted &&
      mostrarFormulario &&
      mostrarResultados &&
      posDropdownCliente &&
      resultadosBusqueda.length > 0 &&
      createPortal(
        <div
          ref={dropdownClienteRef}
          role="listbox"
          aria-label="Resultados de búsqueda de cliente"
          {...mergePropsDropdownPortal(interaccionDropdownPortalRef, {
            position: 'fixed',
            top: posDropdownCliente.top,
            left: posDropdownCliente.left,
            width: posDropdownCliente.width,
            maxHeight: posDropdownCliente.maxHeight,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 10050,
            overflowY: 'auto',
          })}
        >
          {resultadosBusqueda.map((cliente, index) => (
            <div
              key={`${cliente.tipo}-${cliente.id}`}
              role="option"
              aria-selected={indiceClienteSeleccionado === index}
              {...handlersTapSeleccionDropdown(
                () => seleccionarCliente(cliente),
                interaccionDropdownPortalRef
              )}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: index < resultadosBusqueda.length - 1 ? '1px solid #f0f0f0' : 'none',
                backgroundColor:
                  indiceClienteSeleccionado === index
                    ? '#dbeafe'
                    : formData.cliente_id === cliente.id
                      ? '#e7f3ff'
                      : 'white',
                borderLeft: indiceClienteSeleccionado === index ? '4px solid #3b82f6' : 'none',
              }}
              onMouseEnter={() => setIndiceClienteSeleccionado(index)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{cliente.tipo === 'alumno' ? '🎓' : '👤'}</span>
                <span style={{ fontWeight: '600' }}>{cliente.nombre}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#666',
                    marginLeft: 'auto',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: cliente.tipo === 'alumno' ? '#dbeafe' : '#fef3c7',
                    borderRadius: '4px',
                  }}
                >
                  {cliente.tipo === 'alumno' ? 'Alumno' : 'Externo'}
                </span>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    {portalMounted &&
      mostrarFormulario &&
      mostrarListaPrendas &&
      posDropdownPrenda &&
      createPortal(
        <div
          ref={dropdownPrendaRef}
          role="listbox"
          aria-label="Resultados de búsqueda de prenda"
          {...mergePropsDropdownPortal(interaccionDropdownPortalRef, {
            position: 'fixed',
            top: posDropdownPrenda.top,
            left: posDropdownPrenda.left,
            width: posDropdownPrenda.width,
            backgroundColor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 10050,
            maxHeight: posDropdownPrenda.maxHeight,
            overflowY: 'auto',
          })}
        >
          {prendasEncontradas.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
              {prendasLoading || prendas.length === 0
                ? 'Cargando catálogo…'
                : 'Sin coincidencias para esa búsqueda'}
            </div>
          ) : (
            prendasEncontradas.map((prenda, idx) => (
              <div
                key={prenda.id}
                role="option"
                aria-selected={indicePrendaSeleccionada === idx}
                {...handlersTapSeleccionDropdown(
                  () => {
                    void seleccionarPrendaDelDropdown(prenda);
                  },
                  interaccionDropdownPortalRef
                )}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderBottom: idx < prendasEncontradas.length - 1 ? '1px solid #e5e7eb' : 'none',
                  backgroundColor:
                    indicePrendaSeleccionada === idx
                      ? '#dbeafe'
                      : detalleActual.prenda_id === prenda.id
                        ? '#e0f2fe'
                        : 'white',
                  borderLeft: indicePrendaSeleccionada === idx ? '4px solid #3b82f6' : 'none',
                }}
                onMouseEnter={() => setIndicePrendaSeleccionada(idx)}
              >
                <div style={{ fontWeight: '600', color: '#1f2937' }}>{prenda.nombre}</div>
                {prenda.codigo && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    Código: {prenda.codigo}
                  </div>
                )}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
  </>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PedidosPageContent />
    </Suspense>
  );
}

