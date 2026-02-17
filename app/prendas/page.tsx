'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCategorias } from '@/lib/hooks/useCategorias';
import { useTallas } from '@/lib/hooks/useTallas';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendaTallaInsumos } from '@/lib/hooks/usePrendaTallaInsumos';
import { supabase } from '@/lib/supabase';
import type { Prenda } from '@/lib/types';
import ModalInsumosTalla from '@/components/ModalInsumosTalla';

export const dynamic = 'force-dynamic';

// Función para generar código automático basado en el nombre
const generarCodigo = (nombre: string): string => {
  if (!nombre || nombre.trim() === '') return '';
  
  // Remover acentos y caracteres especiales
  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // Extraer palabras clave comunes
  const palabras = sinAcentos.split(/\s+/);
  let codigo = '';
  
  // Buscar palabras clave conocidas
  const palabrasClave: { [key: string]: string } = {
    'CAMISA': 'CAM',
    'PANTALON': 'PAN',
    'PANTALÓN': 'PAN',
    'PANTS': 'PAN',
    'SUETER': 'SUE',
    'SUÉTER': 'SUE',
    'FALDA': 'FAL',
    'DEPORTIVO': 'DEP',
    'DEPORTIVA': 'DEP',
    'ACCESORIO': 'ACC',
    'BLUSA': 'BLU',
    'PLAYERA': 'PLA',
    'POLO': 'POL',
    'CHALECO': 'CHA',
    'SACO': 'SAC',
    'ABRIGO': 'ABR',
  };
  
  // Buscar palabra clave
  for (const palabra of palabras) {
    const clave = Object.keys(palabrasClave).find(k => palabra.includes(k));
    if (clave) {
      codigo = palabrasClave[clave];
      break;
    }
  }
  
  // Si no se encontró palabra clave, usar primeras 3 letras
  if (!codigo) {
    codigo = palabras[0].substring(0, 3).toUpperCase();
  }
  
  // Agregar número secuencial (por ahora solo el código base)
  // En producción, podrías buscar el último número usado
  return codigo;
};

export default function PrendasPage() {
  const { sesion } = useAuth();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prendaEditando, setPrendaEditando] = useState<Prenda | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { prendas, loading, error, createPrenda, updatePrenda, deletePrenda } = usePrendas();
  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();
  const { tallas } = useTallas();
  const { createMultipleCostos, getCostosByPrenda, deleteCosto } = useCostos();
  
  // Cargar todas las categorías (activas e inactivas) para el select
  const [todasLasCategorias, setTodasLasCategorias] = useState<typeof categorias>([]);
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState<string[]>([]);
  const [tallasAsociadas, setTallasAsociadas] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'letras' | 'numeros'>('todos');
  const [filtroNumeros, setFiltroNumeros] = useState<'todos' | 'pares' | 'nones' | 'combinados'>('todos');
  
  // Estados para modal de insumos
  const [modalInsumosAbierto, setModalInsumosAbierto] = useState(false);
  const [tallaSeleccionadaModal, setTallaSeleccionadaModal] = useState<{ id: string; nombre: string } | null>(null);
  const [conteoInsumosPorTalla, setConteoInsumosPorTalla] = useState<Record<string, number>>({});
  const { getInsumosByPrendaTalla } = usePrendaTallaInsumos();
  
  // Estados para modal de stock
  const [modalStockAbierto, setModalStockAbierto] = useState(false);
  const [tallaSeleccionadaStock, setTallaSeleccionadaStock] = useState<{ id: string; nombre: string } | null>(null);
  const [stockData, setStockData] = useState({
    stock_inicial: '',
    stock_minimo: ''
  });
  const [mensajeExitoStock, setMensajeExitoStock] = useState<string>('');
  const [modalExitoStockAbierto, setModalExitoStockAbierto] = useState(false);
  
  useEffect(() => {
    const cargarTodasCategorias = async () => {
      const { data } = await supabase
        .from('categorias_prendas')
        .select('*')
        .order('nombre', { ascending: true });
      if (data) setTodasLasCategorias(data);
    };
    if (mostrarFormulario) {
      cargarTodasCategorias();
      refetchCategorias();
    }
  }, [mostrarFormulario]);

  // Cargar valores de stock cuando se abre el modal
  useEffect(() => {
    const cargarStockExistente = async () => {
      if (modalStockAbierto && prendaEditando && tallaSeleccionadaStock && sesion?.sucursal_id) {
        try {
          const { data: costoExistente } = await supabase
            .from('costos')
            .select('stock_inicial, stock_minimo')
            .eq('prenda_id', prendaEditando.id)
            .eq('talla_id', tallaSeleccionadaStock.id)
            .eq('sucursal_id', sesion.sucursal_id)
            .single();

          if (costoExistente) {
            setStockData({
              stock_inicial: costoExistente.stock_inicial?.toString() || '',
              stock_minimo: costoExistente.stock_minimo?.toString() || ''
            });
          } else {
            setStockData({
              stock_inicial: '',
              stock_minimo: ''
            });
          }
        } catch (err) {
          console.error('Error cargando stock:', err);
        }
      }
    };

    cargarStockExistente();
  }, [modalStockAbierto, prendaEditando, tallaSeleccionadaStock, sesion?.sucursal_id]);

  // Cargar conteo de insumos por talla cuando se edita una prenda
  useEffect(() => {
    const cargarConteoInsumos = async () => {
      if (prendaEditando && tallasAsociadas.length > 0) {
        const conteos: Record<string, number> = {};
        for (const tallaId of tallasAsociadas) {
          const insumos = await getInsumosByPrendaTalla(prendaEditando.id, tallaId);
          conteos[tallaId] = insumos.length;
        }
        setConteoInsumosPorTalla(conteos);
      }
    };
    cargarConteoInsumos();
  }, [prendaEditando, tallasAsociadas, getInsumosByPrendaTalla]);

  // Cargar tallas asociadas cuando se edita una prenda
  useEffect(() => {
    const cargarTallasAsociadas = async () => {
      if (prendaEditando) {
        const { data } = await getCostosByPrenda(prendaEditando.id);
        if (data) {
          const tallasIds = data.map(c => c.talla_id);
          setTallasAsociadas(tallasIds);
          setTallasSeleccionadas(tallasIds);
        }
      } else {
        setTallasAsociadas([]);
        setTallasSeleccionadas([]);
      }
    };
    if (mostrarFormulario && prendaEditando) {
      cargarTallasAsociadas();
    }
  }, [prendaEditando, mostrarFormulario]);

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    categoria_id: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    setMensajeError('');
    
    // Validar que se haya seleccionado al menos una talla
    if (tallasSeleccionadas.length === 0) {
      setMensajeError('❌ Por favor selecciona al menos una talla para la prenda');
      setModalErrorAbierto(true);
      return;
    }
    
    const prendaData = {
      nombre: formData.nombre.trim(),
      codigo: formData.codigo?.trim() || null,
      descripcion: formData.descripcion?.trim() || null,
      categoria_id: formData.categoria_id || null,
      activo: formData.activo,
    };

    // Validar duplicados por nombre
    const nombreExiste = prendas.some(p => 
      p.nombre.toLowerCase() === prendaData.nombre.toLowerCase() && 
      (!prendaEditando || p.id !== prendaEditando.id)
    );

    if (nombreExiste) {
      setMensajeError(`❌ Ya existe una prenda con el nombre "${prendaData.nombre}"`);
      setModalErrorAbierto(true);
      return;
    }

    // Validar duplicados por código (si hay código)
    if (prendaData.codigo) {
      const codigoExiste = prendas.some(p => 
        p.codigo?.toLowerCase() === prendaData.codigo?.toLowerCase() && 
        (!prendaEditando || p.id !== prendaEditando.id)
      );

      if (codigoExiste) {
        setMensajeError(`❌ Ya existe una prenda con el código "${prendaData.codigo}"`);
        setModalErrorAbierto(true);
        return;
      }
    }

    if (prendaEditando) {
      const { error } = await updatePrenda(prendaEditando.id, prendaData);
      if (error) {
        if (error.includes('duplicate') || error.includes('unique')) {
          setMensajeError(`❌ Ya existe una prenda con ese nombre o código`);
        } else {
          setMensajeError(`❌ Error al actualizar: ${error}`);
        }
        setModalErrorAbierto(true);
        return;
      }
      
      // Gestionar tallas: eliminar las que se quitaron y agregar las nuevas
      const tallasAEliminar = tallasAsociadas.filter(t => !tallasSeleccionadas.includes(t));
      const tallasAAgregar = tallasSeleccionadas.filter(t => !tallasAsociadas.includes(t));
      
      // Eliminar costos de tallas que se quitaron
      if (tallasAEliminar.length > 0) {
        const { data: costosExistentes } = await getCostosByPrenda(prendaEditando.id);
        if (costosExistentes) {
          const costosAEliminar = costosExistentes
            .filter(c => tallasAEliminar.includes(c.talla_id))
            .map(c => c.id);
          
          for (const costoId of costosAEliminar) {
            await deleteCosto(costoId);
          }
        }
      }
      
      // Agregar costos para nuevas tallas en TODAS las sucursales
      if (tallasAAgregar.length > 0) {
        // Obtener todas las sucursales activas
        const { data: sucursales, error: sucursalesError } = await supabase
          .from('sucursales')
          .select('id')
          .eq('activo', true);
        
        if (sucursalesError || !sucursales || sucursales.length === 0) {
          setMensajeError('❌ Error: No se pudieron cargar las sucursales');
          setModalErrorAbierto(true);
          return;
        }
        
        // Crear costos para cada combinación de talla x sucursal
        const costosData = [];
        for (const sucursal of sucursales) {
          for (const talla_id of tallasAAgregar) {
            costosData.push({
              prenda_id: prendaEditando.id,
              talla_id: talla_id,
              sucursal_id: sucursal.id,
              precio_venta: 0,
              precio_compra: 0,
              precio_mayoreo: 0,
              precio_menudeo: 0,
              stock_inicial: 0,
              stock: 0,
              cantidad_venta: 0,
              stock_minimo: 0,
              activo: true,
            });
          }
        }
        
        const resultadoCreacion = await createMultipleCostos(costosData);
        if (resultadoCreacion.error) {
          setMensajeError(`❌ Error al agregar tallas: ${resultadoCreacion.error}`);
          setModalErrorAbierto(true);
          return;
        }
      }
      
      setBotonEstado('exito');
      await refetchCategorias(); // Recargar lista de prendas
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
        setTallasSeleccionadas([]);
        setTallasAsociadas([]);
        setMostrarFormulario(false);
        setPrendaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { data: nuevaPrenda, error } = await createPrenda(prendaData);
      if (error) {
        setMensajeError(`❌ Error al crear prenda: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      
      // Crear costos para cada talla seleccionada en TODAS las sucursales
      if (nuevaPrenda && tallasSeleccionadas.length > 0) {
        // Obtener todas las sucursales
        const { data: sucursales, error: sucursalesError } = await supabase
          .from('sucursales')
          .select('id')
          .eq('activo', true);
        
        if (sucursalesError || !sucursales || sucursales.length === 0) {
          setMensajeError('❌ Error: No se pudieron cargar las sucursales');
          setModalErrorAbierto(true);
          return;
        }
        
        // Crear costos para cada combinación de talla x sucursal
        const costosData = [];
        for (const sucursal of sucursales) {
          for (const talla_id of tallasSeleccionadas) {
            costosData.push({
              prenda_id: nuevaPrenda.id,
              talla_id: talla_id,
              sucursal_id: sucursal.id,
              precio_venta: 0,
              precio_compra: 0,
              precio_mayoreo: 0,
              precio_menudeo: 0,
              stock_inicial: 0,
              stock: 0,
              cantidad_venta: 0,
              stock_minimo: 0,
              activo: true,
            });
          }
        }
        
        await createMultipleCostos(costosData);
      }
      
      setBotonEstado('exito');
      await refetchCategorias(); // Recargar categorías
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
        setTallasSeleccionadas([]);
        setMostrarFormulario(false);
        setPrendaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
  };

  const handleEditar = async (prenda: Prenda) => {
    setPrendaEditando(prenda);
    setFormData({
      nombre: prenda.nombre,
      codigo: prenda.codigo || '',
      descripcion: prenda.descripcion || '',
      categoria_id: prenda.categoria_id || '',
      activo: prenda.activo,
    });
    
    // Resetear estados de UI
    setBotonEstado('normal');
    setMensajeError('');
    
    // Cargar tallas asociadas
    const { data: costos } = await getCostosByPrenda(prenda.id);
    if (costos) {
      const tallasIds = costos.map(c => c.talla_id);
      setTallasAsociadas(tallasIds);
      setTallasSeleccionadas(tallasIds);
    } else {
      setTallasAsociadas([]);
      setTallasSeleccionadas([]);
    }
    
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('⚠️ ¿Estás seguro de eliminar esta prenda? Se eliminará TODA su información incluyendo historial de pedidos. Esta acción NO se puede deshacer.')) {
      const { error } = await deletePrenda(id);
      if (error) {
        console.error('Error al eliminar prenda:', error);
        alert(`❌ Error al eliminar: ${error}`);
      } else {
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
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

  // Manejar cambio en el nombre para generar código automático
  const handleNombreChange = (nombre: string) => {
    if (!prendaEditando && nombre) {
      const codigoGenerado = generarCodigo(nombre);
      if (codigoGenerado) {
        // Buscar el siguiente número secuencial
        const codigosSimilares = prendas
          .filter(p => p.codigo && p.codigo.startsWith(codigoGenerado))
          .map(p => {
            const match = p.codigo?.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
          });
        const siguienteNumero = codigosSimilares.length > 0 
          ? Math.max(...codigosSimilares) + 1 
          : 1;
        const codigoFinal = `${codigoGenerado}-${String(siguienteNumero).padStart(3, '0')}`;
        setFormData({ ...formData, nombre, codigo: codigoFinal });
      } else {
        setFormData({ ...formData, nombre });
      }
    } else {
      setFormData({ ...formData, nombre });
    }
  };


  // Filtrar prendas según la búsqueda
  const prendasFiltradas = prendas.filter(prenda =>
    prenda.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (prenda.codigo && prenda.codigo.toLowerCase().includes(busqueda.toLowerCase())) ||
    (prenda.categoria?.nombre && prenda.categoria.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

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
            👕 Gestión de Prendas
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
            placeholder="🔍 Buscar prenda por nombre, código o categoría..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {prendasFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron prendas</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {prendasFiltradas.length} prenda{prendasFiltradas.length !== 1 ? 's' : ''} encontrada{prendasFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar las prendas: {error}
          </div>
        )}

        {mostrarFormulario && (
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
            zIndex: 1000,
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div className="form-container" style={{
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '2rem auto',
              position: 'relative'
            }}>
              <h2 className="form-title">
                {prendaEditando ? 'Editar Prenda' : 'Nueva Prenda'}
              </h2>
              
              <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Prenda *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => handleNombreChange(e.target.value.toUpperCase())}
                  placeholder="Ej: CAMISA BLANCA, PANTALÓN AZUL, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código de Producto</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Se genera automáticamente basado en el nombre"
                  style={{
                    backgroundColor: prendaEditando ? '#f0f0f0' : 'white',
                    cursor: prendaEditando ? 'not-allowed' : 'text',
                    color: prendaEditando ? '#666' : 'inherit'
                  }}
                  readOnly={!!prendaEditando}
                />
                {prendaEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    ⚠️ El código no se puede modificar en modo edición
                  </small>
                )}
                {!prendaEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    El código se genera automáticamente al escribir el nombre
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select
                  className="form-select"
                  value={formData.categoria_id}
                  onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                  required
                  disabled={loadingCategorias}
                >
                  <option value="">Seleccionar categoría</option>
                  {todasLasCategorias.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre} {!cat.activo ? '(Inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tallas Disponibles *</label>
                
                {/* Filtros de tallas */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Tipo de Talla
                    </label>
                    <select
                      className="form-select"
                      value={filtroTipo}
                      onChange={(e) => {
                        setFiltroTipo(e.target.value as 'todos' | 'letras' | 'numeros');
                        if (e.target.value !== 'numeros') {
                          setFiltroNumeros('todos');
                        }
                      }}
                      style={{ width: '100%' }}
                    >
                      <option value="todos">Todas</option>
                      <option value="numeros">Números</option>
                      <option value="letras">Letras</option>
                    </select>
                  </div>
                  
                  {filtroTipo === 'numeros' && (
                    <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                        Filtro de Números
                      </label>
                      <select
                        className="form-select"
                        value={filtroNumeros}
                        onChange={(e) => {
                          setFiltroNumeros(e.target.value as 'todos' | 'pares' | 'nones' | 'combinados');
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="todos">Todos</option>
                        <option value="pares">Pares</option>
                        <option value="nones">Nones</option>
                        <option value="combinados">Combinados</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {/* Tabla de todas las tallas en 4 columnas (responsive) */}
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }} className="tallas-grid-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(() => {
                        // Filtrar tallas según los filtros
                        let tallasFiltradas = tallas.filter(t => t.activo);
                        
                        // Filtrar por tipo (letras o números)
                        if (filtroTipo === 'letras') {
                          tallasFiltradas = tallasFiltradas.filter(t => isNaN(Number(t.nombre)));
                        } else if (filtroTipo === 'numeros') {
                          tallasFiltradas = tallasFiltradas.filter(t => !isNaN(Number(t.nombre)));
                          
                          // Filtrar por pares/nones/combinados
                          if (filtroNumeros === 'pares') {
                            tallasFiltradas = tallasFiltradas.filter(t => {
                              const num = Number(t.nombre);
                              return num % 2 === 0;
                            });
                          } else if (filtroNumeros === 'nones') {
                            tallasFiltradas = tallasFiltradas.filter(t => {
                              const num = Number(t.nombre);
                              return num % 2 !== 0;
                            });
                          } else if (filtroNumeros === 'combinados') {
                            // Combinados: números que no son pares ni nones puros (ej: 6-8, 10-12)
                            // Por ahora, mostrar todos los números si es combinados
                            // O puedes definir tu propia lógica aquí
                          }
                        }
                        
                        // Ordenar tallas: primero números, luego letras, ascendente
                        const tallasOrdenadas = tallasFiltradas.sort((a, b) => {
                          const aEsNumero = !isNaN(Number(a.nombre));
                          const bEsNumero = !isNaN(Number(b.nombre));
                          
                          if (aEsNumero && !bEsNumero) return -1;
                          if (!aEsNumero && bEsNumero) return 1;
                          if (aEsNumero && bEsNumero) {
                            return Number(a.nombre) - Number(b.nombre);
                          }
                          return a.nombre.localeCompare(b.nombre);
                        });
                        
                        // Dividir en filas de 4 columnas
                        const filas = [];
                        for (let i = 0; i < tallasOrdenadas.length; i += 4) {
                          filas.push(tallasOrdenadas.slice(i, i + 4));
                        }
                        
                        if (filas.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                                No hay tallas que coincidan con los filtros seleccionados
                              </td>
                            </tr>
                          );
                        }
                        
                        return filas.map((fila, filaIndex) => (
                          <tr key={filaIndex} style={{ borderBottom: filaIndex < filas.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                            {fila.map(talla => (
                              <td 
                                key={talla.id} 
                                style={{ 
                                  padding: '0.75rem',
                                  width: '25%',
                                  borderRight: fila.indexOf(talla) < fila.length - 1 ? '1px solid #f0f0f0' : 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                                <label style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.5rem',
                                  cursor: 'pointer',
                                    userSelect: 'none',
                                    flex: 1
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={tallasSeleccionadas.includes(talla.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setTallasSeleccionadas([...tallasSeleccionadas, talla.id]);
                                      } else {
                                        setTallasSeleccionadas(tallasSeleccionadas.filter(id => id !== talla.id));
                                      }
                                    }}
                                    style={{ 
                                      width: '18px', 
                                      height: '18px', 
                                      cursor: 'pointer' 
                                    }}
                                  />
                                  <span style={{ 
                                    fontWeight: tallasSeleccionadas.includes(talla.id) ? '600' : '400',
                                    color: tallasSeleccionadas.includes(talla.id) ? '#007bff' : 'inherit'
                                  }}>
                                    {talla.nombre}
                                  </span>
                                </label>
                                  {tallasSeleccionadas.includes(talla.id) && prendaEditando && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTallaSeleccionadaStock({ id: talla.id, nombre: talla.nombre });
                                          setModalStockAbierto(true);
                                        }}
                                        title="Configurar stock de esta talla"
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          transition: 'all 0.2s',
                                          whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={(e) => {
                                          e.currentTarget.style.transform = 'scale(1.05)';
                                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseOut={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                          e.currentTarget.style.boxShadow = 'none';
                                        }}
                                      >
                                        📦 Stock
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTallaSeleccionadaModal({ id: talla.id, nombre: talla.nombre });
                                          setModalInsumosAbierto(true);
                                        }}
                                        title="Gestionar insumos de esta talla"
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          background: conteoInsumosPorTalla[talla.id] > 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                                          color: conteoInsumosPorTalla[talla.id] > 0 ? 'white' : '#64748b',
                                          border: 'none',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          transition: 'all 0.2s',
                                          whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={(e) => {
                                          e.currentTarget.style.transform = 'scale(1.05)';
                                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseOut={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                          e.currentTarget.style.boxShadow = 'none';
                                        }}
                                      >
                                        🧵 {conteoInsumosPorTalla[talla.id] || 0}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            ))}
                            {/* Rellenar celdas vacías si la última fila no tiene 4 elementos */}
                            {Array.from({ length: 4 - fila.length }).map((_, index) => (
                              <td key={`empty-${index}`} style={{ padding: '0.75rem', width: '25%' }}></td>
                            ))}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                  Marca las tallas disponibles para esta prenda. Se crearán registros automáticamente.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción detallada de la prenda..."
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Prenda Activa</span>
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
                    : prendaEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Prenda'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setPrendaEditando(null);
                    setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
                    setTallasSeleccionadas([]);
                    setTallasAsociadas([]);
                    setMensajeError('');
                    // Volver a poner focus en el input de búsqueda
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

        <div className="table-container">
          <div style={{ marginBottom: '1rem', textAlign: 'right', padding: '0 1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button 
                className="btn btn-secondary" 
                onClick={() => window.location.href = '/categorias-prendas'}
                style={{ backgroundColor: '#6c757d', borderColor: '#6c757d', minWidth: '200px' }}
              >
                🏷️ Gestionar Categorías
              </button>
              <button className="btn btn-primary" onClick={() => {
                setPrendaEditando(null);
                setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
                setTallasSeleccionadas([]);
                setTallasAsociadas([]);
                setBotonEstado('normal');
                setMensajeError('');
                setMostrarFormulario(true);
              }} style={{ minWidth: '200px' }}>
                ➕ Nueva Prenda
              </button>
          </div>
          
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron prendas con ese criterio.' : 'No hay prendas registradas. Crea tu primera prenda.'}
                  </td>
                </tr>
              ) : (
                prendasFiltradas.map((prenda) => (
                  <tr key={prenda.id}>
                    <td data-label="Código" style={{ fontFamily: 'monospace', fontWeight: '600' }}>{prenda.codigo || '-'}</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{prenda.nombre}</td>
                    <td data-label="Categoría"><span className="badge badge-info">{prenda.categoria?.nombre || '-'}</span></td>
                    <td data-label="Descripción">{prenda.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${prenda.activo ? 'badge-success' : 'badge-danger'}`}>
                        {prenda.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEditar(prenda)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEliminar(prenda.id)}
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
      </div>

      {/* Modal de insumos por talla */}
      {modalInsumosAbierto && prendaEditando && tallaSeleccionadaModal && (
        <ModalInsumosTalla
          isOpen={modalInsumosAbierto}
          onClose={() => {
            setModalInsumosAbierto(false);
            setTallaSeleccionadaModal(null);
            // Recargar conteo de insumos
            const recargarConteo = async () => {
              if (prendaEditando && tallasAsociadas.length > 0) {
                const conteos: Record<string, number> = {};
                for (const tallaId of tallasAsociadas) {
                  const insumos = await getInsumosByPrendaTalla(prendaEditando.id, tallaId);
                  conteos[tallaId] = insumos.length;
                }
                setConteoInsumosPorTalla(conteos);
              }
            };
            recargarConteo();
          }}
          prendaId={prendaEditando.id}
          prendaNombre={prendaEditando.nombre}
          tallaId={tallaSeleccionadaModal.id}
          tallaNombre={tallaSeleccionadaModal.nombre}
        />
      )}

      {/* Modal de Stock */}
      {modalStockAbierto && prendaEditando && tallaSeleccionadaStock && sesion?.sucursal_id && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              color: '#0891b2', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📦 Configurar Stock
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              <strong>{prendaEditando.nombre}</strong> - Talla <strong>{tallaSeleccionadaStock.nombre}</strong>
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              
              try {
                // Buscar el costo existente para esta combinación prenda/talla/sucursal
                const { data: costoExistente, error: errorBusqueda } = await supabase
                  .from('costos')
                  .select('id, stock_inicial, stock_minimo, stock')
                  .eq('prenda_id', prendaEditando.id)
                  .eq('talla_id', tallaSeleccionadaStock.id)
                  .eq('sucursal_id', sesion.sucursal_id)
                  .single();

                if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
                  throw errorBusqueda;
                }

                if (!costoExistente) {
                  setMensajeError('❌ No se encontró el registro de costo para esta combinación. Asegúrate de que la talla esté asociada a la prenda.');
                  setModalErrorAbierto(true);
                  setModalStockAbierto(false);
                  return;
                }

                // Actualizar el stock
                const stockInicial = parseFloat(stockData.stock_inicial) || 0;
                const stockMinimo = parseFloat(stockData.stock_minimo) || 0;
                
                // Si el stock inicial es diferente al existente, actualizar también el stock actual
                const actualizarStock = costoExistente.stock_inicial !== stockInicial;

                const { error: errorActualizacion } = await supabase
                  .from('costos')
                  .update({
                    stock_inicial: stockInicial,
                    stock_minimo: stockMinimo,
                    ...(actualizarStock ? { stock: stockInicial } : {})
                  })
                  .eq('id', costoExistente.id);

                if (errorActualizacion) throw errorActualizacion;

                // Mostrar modal de éxito
                setMensajeExitoStock('✅ Stock configurado correctamente');
                setModalExitoStockAbierto(true);
                
                // Cerrar después de 2 segundos
                setTimeout(() => {
                  setModalExitoStockAbierto(false);
                  setMensajeExitoStock('');
                  setModalStockAbierto(false);
                  setTallaSeleccionadaStock(null);
                  setStockData({ stock_inicial: '', stock_minimo: '' });
                }, 2000);
              } catch (err: any) {
                setMensajeError(`❌ Error al configurar stock: ${err.message}`);
                setModalErrorAbierto(true);
                setModalStockAbierto(false);
              }
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#334155'
                }}>
                  Stock Inicial *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={stockData.stock_inicial}
                  onChange={(e) => setStockData({ ...stockData, stock_inicial: e.target.value })}
                  placeholder="Ej: 50"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
                <small style={{ color: '#64748b', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                  Cantidad inicial de unidades disponibles
                </small>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#334155'
                }}>
                  Stock Mínimo *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={stockData.stock_minimo}
                  onChange={(e) => setStockData({ ...stockData, stock_minimo: e.target.value })}
                  placeholder="Ej: 10"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
                <small style={{ color: '#64748b', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                  Alerta cuando el stock llegue a esta cantidad
                </small>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalStockAbierto(false);
                    setTallaSeleccionadaStock(null);
                    setStockData({ stock_inicial: '', stock_minimo: '' });
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e2e8f0',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  ❌ Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  💾 Guardar Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Error */}
      {modalErrorAbierto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              color: '#dc3545', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              Error
            </h3>
            <p style={{ 
              color: '#333', 
              marginBottom: '2rem',
              fontSize: '1.1rem',
              lineHeight: '1.5'
            }}>
              {mensajeError}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setModalErrorAbierto(false);
                setMensajeError('');
                setMostrarFormulario(false);
                setPrendaEditando(null);
                setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
                setTallasSeleccionadas([]);
                setTallasAsociadas([]);
                setBotonEstado('normal');
                setTimeout(() => {
                  inputBusquedaRef.current?.focus();
                }, 100);
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Éxito Stock */}
      {modalExitoStockAbierto && (
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
          zIndex: 3000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#28a745', fontWeight: '600' }}>
              {mensajeExitoStock}
            </p>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}
