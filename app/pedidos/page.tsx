'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LayoutWrapper from '@/components/LayoutWrapper';
import { supabase } from '@/lib/supabase';
import { useCostos } from '@/lib/hooks/useCostos';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import { usePedidos } from '@/lib/hooks/usePedidos';

interface Pedido {
  id: number;
  fecha: string;
  cliente: string;
  tipoCliente: 'alumno' | 'externo';
  total: number;
  estado: 'PEDIDO' | 'ENTREGADO' | 'LIQUIDADO' | 'CANCELADO';
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
}

export const dynamic = 'force-dynamic';

export default function PedidosPage() {
  const router = useRouter();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any>(null);
  const { costos, getCostosByPrenda } = useCostos();
  const { alumnos, searchAlumnos } = useAlumnos();
  const { externos } = useExternos();
  const { prendas } = usePrendas();
  const { tallas } = useTallas();
  const { pedidos: pedidosDB, loading: loadingPedidos, crearPedido, actualizarEstadoPedido } = usePedidos();

  // Estados para filtro de mes/año
  const fechaActual = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaActual.getMonth() + 1); // 1-12
  const [añoSeleccionado, setAñoSeleccionado] = useState(fechaActual.getFullYear());
  
  // Transformar pedidos de la base de datos al formato de la interfaz
  const todosPedidos: Pedido[] = pedidosDB.map((p: any) => ({
    id: parseInt(p.id.substring(0, 13), 16), // Convertir UUID a número para compatibilidad
    fecha: new Date(p.created_at).toISOString().split('T')[0],
    fechaCompleta: new Date(p.created_at),
    cliente: p.cliente_nombre || 'Sin nombre',
    tipoCliente: p.tipo_cliente,
    total: p.total,
    estado: p.estado,
  }));

  // Filtrar pedidos por mes y año
  const pedidos = todosPedidos.filter((pedido: any) => {
    const fechaPedido = pedido.fechaCompleta;
    return fechaPedido.getMonth() + 1 === mesSeleccionado && 
           fechaPedido.getFullYear() === añoSeleccionado;
  });

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
    modalidad_pago: 'TOTAL' as 'TOTAL' | 'ANTICIPO',
    efectivo_recibido: 0,
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
    cantidad: '0',
    precio: '0',
  });

  // Estados NUEVOS para búsqueda de prendas (implementación desde cero)
  const [textoPrendaBusqueda, setTextoPrendaBusqueda] = useState('');
  const [prendasEncontradas, setPrendasEncontradas] = useState<any[]>([]);
  const [mostrarListaPrendas, setMostrarListaPrendas] = useState(false);
  const [tallasDisponibles, setTallasDisponibles] = useState<any[]>([]);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  const contenedorPrendaRef = useRef<HTMLDivElement>(null);
  const selectTallaRef = useRef<HTMLSelectElement>(null);
  const inputEspecificacionesRef = useRef<HTMLInputElement>(null);
  const inputCantidadRef = useRef<HTMLInputElement>(null);

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

        // Buscar en externos
        const externosFiltrados = externos
          .filter(e => e.activo && (
            e.nombre.toLowerCase().includes(query) ||
            (e.email && e.email.toLowerCase().includes(query)) ||
            (e.telefono && e.telefono.includes(query))
          ))
          .slice(0, 10 - resultados.length);

        externosFiltrados.forEach(externo => {
          resultados.push({
            id: externo.id,
            nombre: externo.nombre,
            tipo: 'externo',
            datos: externo,
          });
        });

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
    setBusquedaCliente(''); // Limpiar el input después de seleccionar
    setMostrarResultados(false);
  };

  // NUEVA IMPLEMENTACIÓN: Búsqueda simple y directa de prendas
  const ejecutarBusquedaPrenda = (texto: string) => {
    console.log('🆕 Búsqueda nueva - texto:', texto);
    
    // Si no hay texto, mostrar todas las prendas ordenadas alfabéticamente
    if (!texto || texto.trim().length === 0) {
      const todasPrendas = prendas
        .filter(prenda => prenda.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .slice(0, 15);
      
      setPrendasEncontradas(todasPrendas);
      setMostrarListaPrendas(todasPrendas.length > 0);
      return;
    }

    // Filtrar prendas según el texto ingresado
    const textoMinuscula = texto.trim().toLowerCase();
    const resultados = prendas
      .filter(prenda => 
        prenda.activo && 
        (prenda.nombre.toLowerCase().includes(textoMinuscula) || 
         (prenda.codigo && prenda.codigo.toLowerCase().includes(textoMinuscula)))
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(0, 15);

    console.log('✨ Resultados encontrados:', resultados.length, resultados.map(p => p.nombre));
    setPrendasEncontradas(resultados);
    setMostrarListaPrendas(resultados.length > 0);
  };

  // NUEVA: Manejar cambio en el input de búsqueda
  const handleCambioBusquedaPrenda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoTexto = e.target.value;
    setTextoPrendaBusqueda(nuevoTexto);
    ejecutarBusquedaPrenda(nuevoTexto);
  };

  // NUEVA: Seleccionar una prenda del dropdown
  const seleccionarPrendaDelDropdown = async (prenda: any) => {
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

  // NUEVA: Detectar clics fuera del contenedor para ocultar dropdown
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (contenedorPrendaRef.current && !contenedorPrendaRef.current.contains(event.target as Node)) {
        setMostrarListaPrendas(false);
      }
    };

    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

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
    if (!detalleActual.prenda_id || !detalleActual.talla_id || !detalleActual.cantidad || parseFloat(detalleActual.cantidad) <= 0) {
      return; // Solo retorna sin alerta
    }

    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === detalleActual.talla_id
    );

    if (!costo) {
      alert('No se encontró el costo para esta prenda y talla');
      return;
    }

    if (costo.stock < parseFloat(detalleActual.cantidad)) {
      alert('Stock insuficiente');
      return;
    }

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
      pendiente: cantidad, // Inicialmente pendiente = cantidad
      precio: precio,
      total: total,
      costoId: costo.id,
    };

    setFormData({ 
      ...formData, 
      detalles: [...formData.detalles, nuevoDetalle] 
    });
    
    setDetalleActual({ 
      prenda_id: '', 
      prenda_nombre: '',
      talla_id: '', 
      talla_nombre: '',
      especificaciones: '',
      cantidad: '0', 
      precio: '0' 
    });
    setTextoPrendaBusqueda('');
    setTallasDisponibles([]);
  };

  const limpiarCamposParaNuevaPartida = () => {
    setDetalleActual({ 
      prenda_id: '', 
      prenda_nombre: '',
      talla_id: '', 
      talla_nombre: '',
      especificaciones: '',
      cantidad: '0', 
      precio: '0' 
    });
    setTextoPrendaBusqueda('');
    setTallasDisponibles([]);
  };

  const eliminarDetalle = (index: number) => {
    setFormData({
      ...formData,
      detalles: formData.detalles.filter((_, i) => i !== index)
    });
  };

  const calcularTotal = () => {
    return formData.detalles.reduce((total, detalle) => 
      total + detalle.total, 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.cliente_tipo) {
      alert('Por favor selecciona un cliente');
      return;
    }
    
    // Si hay un detalle actual sin agregar, avisar al usuario
    if (detalleActual.prenda_id && detalleActual.talla_id && parseFloat(detalleActual.cantidad) > 0) {
      alert('Tienes una prenda sin agregar. Por favor da clic en "Agregar Prenda" o limpia los campos.');
      return;
    }
    
    if (formData.detalles.length === 0) {
      alert('Debes agregar al menos un producto al pedido');
      return;
    }
    
    // Preparar datos del pedido para la base de datos
    const pedidoParaDB = {
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: formData.cliente_id,
      cliente_tipo: formData.cliente_tipo,
      cliente_nombre: formData.cliente_nombre,
      total: calcularTotal(),
      estado: 'PEDIDO' as const,
      observaciones: formData.observaciones,
      modalidad_pago: formData.modalidad_pago,
      efectivo_recibido: formData.efectivo_recibido,
    };

    // Preparar detalles para la base de datos
    const detallesParaDB = formData.detalles.map(detalle => ({
      prenda_id: detalle.prenda_id,
      talla_id: detalle.talla_id,
      cantidad: detalle.cantidad,
      precio_unitario: detalle.precio,
      subtotal: detalle.total,
      pendiente: detalle.pendiente,
      especificaciones: detalle.especificaciones,
    }));

    // Crear el pedido en la base de datos
    const resultado = await crearPedido(pedidoParaDB, detallesParaDB);

    if (resultado.success) {
      // Redirigir a la página de detalles del pedido
      router.push(`/pedidos/${resultado.data.id}`);
    } else {
      alert('❌ Error al crear el pedido. Por favor intenta de nuevo.');
      console.error('Error:', resultado.error);
    }
  };

  const cambiarEstado = async (id: number, nuevoEstado: Pedido['estado']) => {
    if (nuevoEstado === 'CANCELADO') {
      if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) {
        return;
      }
    }
    
    // Buscar el UUID del pedido en la base de datos
    const pedidoDB = pedidosDB.find((p: any) => parseInt(p.id.substring(0, 13), 16) === id);
    if (pedidoDB) {
      const resultado = await actualizarEstadoPedido(pedidoDB.id, nuevoEstado);
      if (!resultado.success) {
        alert('❌ Error al actualizar el estado del pedido');
        console.error('Error:', resultado.error);
      }
    }
  };

  const verDetallePedido = async (pedido: Pedido) => {
    try {
      console.log('🔍 Buscando detalles del pedido:', pedido.id);
      
      // Obtener los detalles del pedido
      const { data: detalles, error } = await supabase
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
    <LayoutWrapper>
      <div className="main-container" style={{ paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            🛒 Gestión de Pedidos
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Pedido
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container" style={{ maxWidth: '1600px', width: '95%', padding: '1rem', marginTop: '0.5rem' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', fontSize: '0.9rem' }}>Cliente *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputClienteRef}
                    type="text"
                    className="form-input"
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      if (e.target.value === '') {
                        setFormData({ ...formData, cliente_id: '', cliente_tipo: '', cliente_nombre: '' });
                        setClienteSeleccionado(null);
                      }
                    }}
                    onFocus={() => {
                      if (resultadosBusqueda.length > 0) {
                        setMostrarResultados(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setMostrarResultados(false), 200);
                    }}
                    placeholder="🔍 Buscar cliente (alumno o externo)..."
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                  />

                  {/* Dropdown de resultados */}
                  {mostrarResultados && resultadosBusqueda.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                      maxHeight: '300px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {resultadosBusqueda.map((cliente, index) => (
                        <div
                          key={`${cliente.tipo}-${cliente.id}`}
                          onClick={() => seleccionarCliente(cliente)}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            borderBottom: index < resultadosBusqueda.length - 1 ? '1px solid #f0f0f0' : 'none',
                            transition: 'background-color 0.2s',
                            backgroundColor: formData.cliente_id === cliente.id ? '#e7f3ff' : 'white'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.cliente_id !== cliente.id) {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.cliente_id !== cliente.id) {
                              e.currentTarget.style.backgroundColor = 'white';
                            } else {
                              e.currentTarget.style.backgroundColor = '#e7f3ff';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{cliente.tipo === 'alumno' ? '🎓' : '👤'}</span>
                            <span style={{ fontWeight: '600' }}>{cliente.nombre}</span>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#666',
                              marginLeft: 'auto',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: cliente.tipo === 'alumno' ? '#dbeafe' : '#fef3c7',
                              borderRadius: '4px'
                            }}>
                              {cliente.tipo === 'alumno' ? 'Alumno' : 'Externo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>👕 Prenda</th>
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>📏 Talla</th>
                        <th style={{ padding: '0.3rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>ℹ️ Especif.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>🔢 Cant.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>⏰ Pend.</th>
                        <th style={{ padding: '0.3rem', textAlign: 'right', fontWeight: '600', fontSize: '0.75rem' }}>$ Precio</th>
                        <th style={{ padding: '0.3rem', textAlign: 'right', fontWeight: '600', fontSize: '0.75rem' }}>Total</th>
                        <th style={{ padding: '0.3rem', textAlign: 'center', fontWeight: '600', fontSize: '0.75rem' }}>🗑️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Fila para agregar nuevo detalle */}
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <div ref={contenedorPrendaRef} style={{ position: 'relative' }}>
                            <input
                              ref={inputPrendaRef}
                              type="text"
                              className="form-input"
                              value={textoPrendaBusqueda}
                              onChange={handleCambioBusquedaPrenda}
                              onFocus={() => {
                                // Mostrar todas las prendas ordenadas alfabéticamente al hacer focus
                                ejecutarBusquedaPrenda(textoPrendaBusqueda);
                              }}
                              placeholder="SELECCIONAR PRENDA..."
                              style={{ width: '100%', fontSize: '0.85rem', fontWeight: '600', padding: '0.3rem' }}
                            />
                            
                            {mostrarListaPrendas && prendasEncontradas.length > 0 && (() => {
                              const rect = inputPrendaRef.current?.getBoundingClientRect();
                              return (
                                <div style={{
                                  position: 'fixed',
                                  top: rect ? `${rect.bottom + 4}px` : 'auto',
                                  left: rect ? `${rect.left}px` : 'auto',
                                  width: rect ? `${rect.width}px` : 'auto',
                                  backgroundColor: 'white',
                                  border: '2px solid #3b82f6',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 9999,
                                  maxHeight: '300px',
                                  overflowY: 'auto'
                                }}>
                                {prendasEncontradas.map((prenda, idx) => (
                                  <div
                                    key={prenda.id}
                                    onClick={() => seleccionarPrendaDelDropdown(prenda)}
                                    style={{
                                      padding: '0.75rem 1rem',
                                      cursor: 'pointer',
                                      borderBottom: idx < prendasEncontradas.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      backgroundColor: detalleActual.prenda_id === prenda.id ? '#dbeafe' : 'white'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 
                                        detalleActual.prenda_id === prenda.id ? '#dbeafe' : 'white';
                                    }}
                                  >
                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                      {prenda.nombre}
                                    </div>
                                    {prenda.codigo && (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                        Código: {prenda.codigo}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                </div>
                              );
                            })()}
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
                          <input
                            ref={inputCantidadRef}
                            type="number"
                            className="form-input"
                            value={detalleActual.cantidad}
                            onChange={(e) => {
                              const cantidad = e.target.value;
                              const newDetalle = { ...detalleActual, cantidad };
                              setDetalleActual(newDetalle);
                              
                              // Agregar automáticamente cuando todos los campos están completos
                              if (newDetalle.prenda_id && newDetalle.talla_id && parseFloat(cantidad) > 0) {
                                setTimeout(() => agregarDetalle(), 100);
                              }
                            }}
                            min="0"
                            style={{ width: '80px', textAlign: 'center', fontSize: '0.85rem', padding: '0.3rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: parseFloat(detalleActual.cantidad) > 0 ? '#f59e0b' : '#e0e0e0'
                          }}></span>
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
                          ${(parseFloat(detalleActual.cantidad) * parseFloat(detalleActual.precio)).toFixed(2)}
                        </td>
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
                                cantidad: '0', 
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
                      </tr>

                      {/* Filas de detalles agregados */}
                      {formData.detalles.map((detalle, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '600' }}>{detalle.prenda}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className="badge badge-info">{detalle.talla}</span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                            {detalle.especificaciones || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>
                            {detalle.cantidad}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: detalle.pendiente > 0 ? '#f59e0b' : '#10b981'
                            }}></span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${detalle.precio.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                            ${detalle.total.toFixed(2)}
                          </td>
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

                  {/* Modalidad de Pago */}
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
                      💳 Modalidad de Pago:
                    </label>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        cursor: 'pointer',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        <input
                          type="radio"
                          name="modalidad_pago"
                          value="TOTAL"
                          checked={formData.modalidad_pago === 'TOTAL'}
                          onChange={(e) => setFormData({ ...formData, modalidad_pago: 'TOTAL' })}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                        Pago Total
                      </label>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        cursor: 'pointer',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        <input
                          type="radio"
                          name="modalidad_pago"
                          value="ANTICIPO"
                          checked={formData.modalidad_pago === 'ANTICIPO'}
                          onChange={(e) => setFormData({ ...formData, modalidad_pago: 'ANTICIPO' })}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                        Anticipo
                      </label>
                    </div>
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
                      type="number"
                      className="form-input"
                      value={formData.efectivo_recibido}
                      onChange={(e) => setFormData({ ...formData, efectivo_recibido: parseFloat(e.target.value) || 0 })}
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
                      return formData.efectivo_recibido < totalGeneral 
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
                      ${(() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        const totalGeneral = totalDetalles + totalActual;
                        return Math.max(0, formData.efectivo_recibido - totalGeneral).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={formData.detalles.length === 0}>
                  💾 Crear Pedido
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
                      efectivo_recibido: 0
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
        )}

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
                <th>ID</th>
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
                  <td style={{ fontFamily: 'monospace' }}>#{pedido.id}</td>
                  <td>{pedido.fecha}</td>
                  <td style={{ fontWeight: '600' }}>{pedido.cliente}</td>
                  <td>
                    <span className={`badge ${pedido.tipoCliente === 'alumno' ? 'badge-info' : 'badge-warning'}`}>
                      {pedido.tipoCliente === 'alumno' ? '🎓 Alumno' : '👤 Externo'}
                    </span>
                  </td>
                  <td style={{ fontWeight: '700', color: '#10b981' }}>${pedido.total.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      pedido.estado === 'PEDIDO' ? 'badge-warning' :
                      pedido.estado === 'ENTREGADO' ? 'badge-info' :
                      pedido.estado === 'LIQUIDADO' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {pedido.estado}
                    </span>
                  </td>
                  <td>
                    {pedido.estado === 'PEDIDO' && (
                      <>
                        <button
                          className="btn btn-success"
                          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
                          onClick={() => cambiarEstado(pedido.id, 'ENTREGADO')}
                        >
                          ✓ Entregar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
                          onClick={() => cambiarEstado(pedido.id, 'CANCELADO')}
                        >
                          ✕ Cancelar
                        </button>
                      </>
                    )}
                    {pedido.estado === 'ENTREGADO' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
                        onClick={() => cambiarEstado(pedido.id, 'LIQUIDADO')}
                      >
                        💵 Liquidar
                      </button>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 1rem' }}
                      onClick={() => verDetallePedido(pedido)}
                    >
                      👁️ Ver
                    </button>
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
        onClick={() => setMostrarModal(false)}
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
                📋 Pedido #{pedidoSeleccionado.id}
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
                      backgroundColor: pedidoSeleccionado.estado === 'PEDIDO' ? '#fef3c7' :
                                       pedidoSeleccionado.estado === 'ENTREGADO' ? '#d1fae5' :
                                       pedidoSeleccionado.estado === 'LIQUIDADO' ? '#dbeafe' : '#fee2e2',
                      color: pedidoSeleccionado.estado === 'PEDIDO' ? '#92400e' :
                             pedidoSeleccionado.estado === 'ENTREGADO' ? '#065f46' :
                             pedidoSeleccionado.estado === 'LIQUIDADO' ? '#1e40af' : '#991b1b'
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
    </LayoutWrapper>
  );
}

