'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCategorias } from '@/lib/hooks/useCategorias';
import { useTallas } from '@/lib/hooks/useTallas';
import { useCostos } from '@/lib/hooks/useCostos';
import { fetchConteoInsumosPorPrenda } from '@/lib/hooks/usePrendaTallaInsumos';
import { useUbicacionesAlmacenamiento } from '@/lib/hooks/useUbicacionesAlmacenamiento';
import {
  fetchCostoStockModal,
  fetchCostosIdsParaEliminarTallas,
  fetchCostosPrendaSucursal,
  extraerTallasActivasDeCostos,
  costoPrendaTallaDesdeFilas,
  prendaTieneCostosEnOtraSucursal,
  normalizarCamposCostoApi,
} from '@/lib/costoQueries';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Prenda } from '@/lib/types';
import { sortTallas } from '@/lib/ordenTallas';
import ModalInsumosTalla from '@/components/ModalInsumosTalla';
import ModalConjuntos from '@/components/ModalConjuntos';
import {
  parseEnteroFormateado,
  formatearEnteroMilesAlEscribir,
  parseSignedEnteroFormateado,
  formatearSignedEnteroAlEscribir,
} from '@/lib/formatNumericInput';
import { opcionesInventarioDesdeSesion, sucursalIdParaCostosSesion } from '@/lib/inventarioSucursal';
import { esCuentaWinston } from '@/lib/winstonLineaVenta';
import {
  asignarSiguienteCodigoGlobal,
  buscarPrendaPorCodigo,
  buscarPrendaPorNombreExacto,
  prefijoCodigoDesdeNombre,
  type PrendaCatalogoResumen,
} from '@/lib/prendasCodigo';

export const dynamic = 'force-dynamic';

const generarCodigo = (nombre: string): string => prefijoCodigoDesdeNombre(nombre);

export default function PrendasPage() {
  const { sesion } = useAuth();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prendaEditando, setPrendaEditando] = useState<Prenda | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const [modalConfirmDuplicado, setModalConfirmDuplicado] = useState(false);
  const [prendaExistenteCatalogo, setPrendaExistenteCatalogo] = useState<PrendaCatalogoResumen | null>(
    null
  );
  const [existenteYaEnTienda, setExistenteYaEnTienda] = useState(false);
  const [tallasExistentesEnTienda, setTallasExistentesEnTienda] = useState<string[]>([]);
  const reutilizarPrendaIdRef = useRef<string | null>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const inventarioOpts = opcionesInventarioDesdeSesion(sesion, 'gestion');
  const puedeEditarCatalogo = Boolean(sesion?.es_matriz) || esCuentaWinston(sesion);
  const esWinston = esCuentaWinston(sesion);
  const usarUbicacionesStock = !esWinston;
  const {
    prendas,
    loading,
    error,
    createPrenda,
    updatePrenda,
    deletePrenda,
    refetch: refetchPrendas,
  } = usePrendas(inventarioOpts);
  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();
  const { tallas } = useTallas();
  const { createMultipleCostos, deleteCosto } = useCostos(
    sesion?.sucursal_id,
    sesion?.es_matriz,
    {
      catalogoCompleto: inventarioOpts.catalogoCompleto,
      incluirStockCero: inventarioOpts.incluirStockCero,
    }
  );
  
  // Cargar todas las categorías (activas e inactivas) para el select
  const [todasLasCategorias, setTodasLasCategorias] = useState<typeof categorias>([]);
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState<string[]>([]);
  const [tallasAsociadas, setTallasAsociadas] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'letras' | 'numeros'>('todos');
  const [filtroNumeros, setFiltroNumeros] = useState<'todos' | 'pares' | 'nones' | 'combinados'>('todos');
  
  // Estados para modal de insumos
  const [modalInsumosAbierto, setModalInsumosAbierto] = useState(false);
  const [modalConjuntosAbierto, setModalConjuntosAbierto] = useState(false);
  const [tallaSeleccionadaModal, setTallaSeleccionadaModal] = useState<{ id: string; nombre: string } | null>(null);
  const [conteoInsumosPorTalla, setConteoInsumosPorTalla] = useState<Record<string, number>>({});
  const [costosEdicionCache, setCostosEdicionCache] = useState<Record<string, unknown>[]>([]);
  const [cargandoEdicionPrenda, setCargandoEdicionPrenda] = useState(false);
  const [cargandoModalStock, setCargandoModalStock] = useState(false);
  const { ubicaciones, loading: loadingUbicaciones } = useUbicacionesAlmacenamiento();

  // Estados para modal de stock
  const [modalStockAbierto, setModalStockAbierto] = useState(false);
  const [tallaSeleccionadaStock, setTallaSeleccionadaStock] = useState<{ id: string; nombre: string } | null>(null);
  const [stockData, setStockData] = useState({
    stock_inicial: '',
    stock_minimo: '',
  });
  /** Partidas de stock por ubicación (modal configurar stock) */
  const [partidasUbicacion, setPartidasUbicacion] = useState<
    Array<{ tempId: string; ubicacion_id: string; cantidad: string }>
  >([]);
  const [mensajeExitoStock, setMensajeExitoStock] = useState<string>('');
  const [modalExitoStockAbierto, setModalExitoStockAbierto] = useState(false);
  const [modalAjusteStockAbierto, setModalAjusteStockAbierto] = useState(false);
  const [cantidadAjusteStock, setCantidadAjusteStock] = useState('');
  const [ubicacionAjusteStock, setUbicacionAjusteStock] = useState('');
  const [errorAjusteStock, setErrorAjusteStock] = useState('');

  const limpiarCacheEdicion = () => {
    setCostosEdicionCache([]);
    setConteoInsumosPorTalla({});
    setTallasAsociadas([]);
    setTallasSeleccionadas([]);
    setCargandoEdicionPrenda(false);
  };

  const cargarDatosEdicionPrenda = useCallback(async (prendaId: string) => {
    const sid = sucursalIdParaCostosSesion(sesion);
    setCargandoEdicionPrenda(true);
    try {
      const [costosRows, conteos] = await Promise.all([
        fetchCostosPrendaSucursal(insforgeDb(), prendaId, sid),
        fetchConteoInsumosPorPrenda(prendaId),
      ]);
      setCostosEdicionCache(costosRows);
      const tallasIds = extraerTallasActivasDeCostos(costosRows);
      setTallasAsociadas(tallasIds);
      setTallasSeleccionadas(tallasIds);
      setConteoInsumosPorTalla(conteos);
    } catch (err) {
      console.error('Error cargando edición prenda:', err);
    } finally {
      setCargandoEdicionPrenda(false);
    }
  }, [sesion]);
  
  useEffect(() => {
    const cargarTodasCategorias = async () => {
      const { data } = await insforgeDb()
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

  // Cargar valores de stock y partidas por ubicación cuando se abre el modal
  useEffect(() => {
    const cargarStockExistente = async () => {
      if (!modalStockAbierto || !prendaEditando || !tallaSeleccionadaStock) return;
      setCargandoModalStock(true);
      try {
          const costoExistente = await fetchCostoStockModal(insforgeDb(), {
            prendaId: prendaEditando.id,
            tallaId: tallaSeleccionadaStock.id,
            sucursalId: sesion?.sucursal_id ?? null,
            costosPrecargados: costosEdicionCache,
          });

          if (costoExistente) {
            const totalNum = Number(costoExistente.stock ?? costoExistente.stock_inicial ?? 0);
            const minNum = Number(costoExistente.stock_minimo ?? 0);
            setStockData({
              stock_inicial: Number.isFinite(totalNum) ? totalNum.toLocaleString('en-US') : '',
              stock_minimo: Number.isFinite(minNum) ? minNum.toLocaleString('en-US') : '',
            });

            const { data: filasUb, error: errUb } = await insforgeDb()
              .from('costo_ubicaciones')
              .select('id, ubicacion_almacenamiento_id, cantidad')
              .eq('costo_id', costoExistente.id);

            if (errUb) {
              console.error('costo_ubicaciones:', errUb);
            }

            if (!errUb && filasUb && filasUb.length > 0) {
              setPartidasUbicacion(
                filasUb.map((f) => {
                  const c = Number(f.cantidad ?? 0);
                  return {
                    tempId: f.id,
                    ubicacion_id: f.ubicacion_almacenamiento_id,
                    cantidad: Number.isFinite(c) ? c.toLocaleString('en-US') : '0',
                  };
                })
              );
            } else if (
              costoExistente.ubicacion_almacenamiento_id &&
              Number(costoExistente.stock ?? 0) > 0
            ) {
              setPartidasUbicacion([
                {
                  tempId: `legacy-${costoExistente.id}`,
                  ubicacion_id: String(
                    costoExistente.ubicacion_almacenamiento_id ??
                      (costoExistente as Record<string, unknown>).ubicacionAlmacenamientoId ??
                      ''
                  ),
                  cantidad: (() => {
                    const c = Number(costoExistente.stock ?? 0);
                    return Number.isFinite(c) ? c.toLocaleString('en-US') : '0';
                  })(),
                },
              ]);
            } else {
              setPartidasUbicacion([]);
            }
          } else {
            setStockData({
              stock_inicial: '',
              stock_minimo: '',
            });
            setPartidasUbicacion([]);
          }
        } catch (err) {
          console.error('Error cargando stock:', err);
        } finally {
          setCargandoModalStock(false);
        }
    };

    cargarStockExistente();
  }, [modalStockAbierto, prendaEditando, tallaSeleccionadaStock, sesion?.sucursal_id, costosEdicionCache]);

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    categoria_id: '',
    activo: true,
  });

  const stockTotalModalNum = () => parseEnteroFormateado(stockData.stock_inicial);
  const sumPartidasDistribuidas = () =>
    partidasUbicacion.reduce((s, p) => s + parseEnteroFormateado(p.cantidad), 0);

  const cerrarModalAjusteStock = () => {
    setModalAjusteStockAbierto(false);
    setCantidadAjusteStock('');
    setUbicacionAjusteStock('');
    setErrorAjusteStock('');
  };

  const abrirModalAjusteStock = () => {
    setCantidadAjusteStock('');
    setUbicacionAjusteStock('');
    setErrorAjusteStock('');
    setModalAjusteStockAbierto(true);
  };

  /** Matriz: al sumar siempre pedir ubicación (permite agregar a otra bodega aunque ya exista solo 1). Al restar, pedir si hay 2+ ubicaciones con stock. */
  const requiereUbicacionEnAjuste = (delta: number): boolean => {
    if (!usarUbicacionesStock || delta === 0) return false;
    if (delta > 0) return true;
    return partidasUbicacion.filter((p) => parseEnteroFormateado(p.cantidad) > 0).length > 1;
  };

  const aplicarAjusteStock = () => {
    const delta = parseSignedEnteroFormateado(cantidadAjusteStock);
    if (delta === 0) {
      setErrorAjusteStock('Indica una cantidad distinta de 0 (usa − para restar).');
      return;
    }

    const actual = stockTotalModalNum();
    const nuevo = actual + delta;
    if (nuevo < 0) {
      setErrorAjusteStock('El stock no puede quedar en negativo.');
      return;
    }

    if (esWinston) {
      setStockData((prev) => ({
        ...prev,
        stock_inicial: nuevo.toLocaleString('en-US'),
      }));
      cerrarModalAjusteStock();
      return;
    }

    let partidas = [...partidasUbicacion];

    if (delta < 0 && partidas.length === 0) {
      setErrorAjusteStock('No hay stock que restar.');
      return;
    }

    if (delta > 0) {
      const ubId = ubicacionAjusteStock.trim();
      if (!ubId) {
        setErrorAjusteStock('Selecciona la ubicación donde entra el stock.');
        return;
      }
      const idx = partidas.findIndex((p) => p.ubicacion_id === ubId);
      if (idx >= 0) {
        const cant = parseEnteroFormateado(partidas[idx].cantidad) + delta;
        partidas[idx] = { ...partidas[idx], cantidad: cant.toLocaleString('en-US') };
      } else {
        partidas.push({
          tempId: crypto.randomUUID(),
          ubicacion_id: ubId,
          cantidad: delta.toLocaleString('en-US'),
        });
      }
    } else {
      const abs = Math.abs(delta);
      const conStock = partidas.filter((p) => parseEnteroFormateado(p.cantidad) > 0);
      const ubId =
        conStock.length === 1 ? conStock[0].ubicacion_id : ubicacionAjusteStock.trim();
      if (!ubId) {
        setErrorAjusteStock('Selecciona la ubicación de donde se descuenta.');
        return;
      }
      const idx = partidas.findIndex((p) => p.ubicacion_id === ubId);
      if (idx < 0) {
        setErrorAjusteStock('Ubicación no válida.');
        return;
      }
      const disponible = parseEnteroFormateado(partidas[idx].cantidad);
      if (abs > disponible) {
        setErrorAjusteStock(`Solo hay ${disponible.toLocaleString('en-US')} en esa ubicación.`);
        return;
      }
      const cant = disponible - abs;
      if (cant === 0) {
        partidas = partidas.filter((p) => p.ubicacion_id !== ubId);
      } else {
        partidas[idx] = { ...partidas[idx], cantidad: cant.toLocaleString('en-US') };
      }
    }

    setPartidasUbicacion(partidas);
    setStockData((prev) => ({
      ...prev,
      stock_inicial: nuevo.toLocaleString('en-US'),
    }));
    cerrarModalAjusteStock();
  };

  const cerrarFormularioTrasExito = () => {
    setTimeout(() => {
      setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
      setTallasSeleccionadas([]);
      setTallasAsociadas([]);
      setMostrarFormulario(false);
      setPrendaEditando(null);
      setBotonEstado('normal');
      setMensajeError('');
      reutilizarPrendaIdRef.current = null;
      setPrendaExistenteCatalogo(null);
      setModalConfirmDuplicado(false);
      setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
    }, 1500);
  };

  const crearCostosSeleccionadosParaPrenda = async (prendaId: string) => {
    const sucursalActiva = sucursalIdParaCostosSesion(sesion);
    if (!sucursalActiva) {
      return { error: 'No hay sucursal activa en la sesión' };
    }

    const costosActuales = await fetchCostosPrendaSucursal(
      insforgeDb(),
      prendaId,
      sucursalActiva
    );
    const tallasYa = new Set(
      costosActuales
        .map((c) => String(normalizarCamposCostoApi(c).talla_id ?? '').trim())
        .filter(Boolean)
    );
    const tallasAAgregar = tallasSeleccionadas.filter((t) => !tallasYa.has(t));

    if (tallasAAgregar.length === 0) {
      return { error: null, agregadas: 0, yaEstaban: tallasSeleccionadas.length };
    }

    const costosData = tallasAAgregar.map((talla_id) => ({
      prenda_id: prendaId,
      talla_id,
      sucursal_id: sucursalActiva,
      precio_venta: 0,
      precio_compra: 0,
      precio_mayoreo: 0,
      precio_menudeo: 0,
      stock_inicial: 0,
      stock: 0,
      cantidad_venta: 0,
      stock_minimo: 0,
      activo: true,
    }));

    const resultado = await createMultipleCostos(costosData);
    if (resultado.error) {
      return { error: resultado.error, agregadas: 0, yaEstaban: tallasYa.size };
    }
    return { error: null, agregadas: tallasAAgregar.length, yaEstaban: tallasYa.size };
  };

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

    // Winston: si ya existe en catálogo (mismo nombre), pedir confirmación clara antes de reutilizar
    if (!prendaEditando && esWinston && !reutilizarPrendaIdRef.current) {
      const existente = await buscarPrendaPorNombreExacto(prendaData.nombre);

      if (existente) {
        const sid = sucursalIdParaCostosSesion(sesion);
        const costosTienda = sid
          ? await fetchCostosPrendaSucursal(insforgeDb(), existente.id, sid)
          : [];
        const tallasYa = costosTienda
          .map((c) => String(normalizarCamposCostoApi(c).talla_id ?? '').trim())
          .filter(Boolean);
        setPrendaExistenteCatalogo(existente);
        setExistenteYaEnTienda(costosTienda.length > 0);
        setTallasExistentesEnTienda(tallasYa);
        setModalConfirmDuplicado(true);
        return;
      }
    }

    // Matriz (u otras): bloquear duplicado local por nombre
    if (!esWinston || prendaEditando) {
      const nombreExiste = prendas.some(
        (p) =>
          p.nombre.toLowerCase() === prendaData.nombre.toLowerCase() &&
          (!prendaEditando || p.id !== prendaEditando.id)
      );

      if (nombreExiste) {
        setMensajeError(`❌ Ya existe una prenda con el nombre "${prendaData.nombre}"`);
        setModalErrorAbierto(true);
        return;
      }
    }

    // Código único global al crear (solo si no estamos reutilizando)
    if (prendaData.codigo && !prendaEditando && !reutilizarPrendaIdRef.current) {
      const conflicto = await buscarPrendaPorCodigo(prendaData.codigo);
      if (conflicto) {
        // Mismo nombre → ya debió salir el modal; si llega aquí es otro nombre con mismo código
        const prefijo = generarCodigo(prendaData.nombre) || prendaData.codigo.split('-')[0];
        const codigoLibre = prefijo ? await asignarSiguienteCodigoGlobal(prefijo) : '';
        if (codigoLibre && codigoLibre.toLowerCase() !== prendaData.codigo.toLowerCase()) {
          prendaData.codigo = codigoLibre;
          setFormData((prev) => ({ ...prev, codigo: codigoLibre }));
        } else {
          setMensajeError(
            `❌ El código "${conflicto.codigo}" ya existe en el catálogo (${conflicto.nombre}). Elige otro código.`
          );
          setModalErrorAbierto(true);
          return;
        }
      }
    } else if (prendaData.codigo && prendaEditando) {
      const codigoExisteLocal = prendas.some(
        (p) =>
          p.codigo?.toLowerCase() === prendaData.codigo?.toLowerCase() &&
          p.id !== prendaEditando.id
      );
      if (codigoExisteLocal) {
        setMensajeError(`❌ Ya existe una prenda con el código "${prendaData.codigo}"`);
        setModalErrorAbierto(true);
        return;
      }
      const conflicto = await buscarPrendaPorCodigo(prendaData.codigo);
      if (conflicto && conflicto.id !== prendaEditando.id) {
        setMensajeError(
          `❌ El código "${conflicto.codigo}" ya lo usa "${conflicto.nombre}" en el catálogo.`
        );
        setModalErrorAbierto(true);
        return;
      }
    }

    if (prendaEditando) {
      const sucursalSesion = sucursalIdParaCostosSesion(sesion);
      const compartidaEnOtraTienda =
        Boolean(sucursalSesion) &&
        (await prendaTieneCostosEnOtraSucursal(insforgeDb(), prendaEditando.id, sucursalSesion!));

      if (!compartidaEnOtraTienda) {
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
      }
      
      // Gestionar tallas: eliminar las que se quitaron y agregar las nuevas
      const tallasAEliminar = tallasAsociadas.filter(t => !tallasSeleccionadas.includes(t));
      const tallasAAgregar = tallasSeleccionadas.filter(t => !tallasAsociadas.includes(t));

      // Eliminar costos de tallas quitadas solo en la tienda de la sesión
      if (tallasAEliminar.length > 0) {
        const costosAEliminar = await fetchCostosIdsParaEliminarTallas(
          insforgeDb(),
          prendaEditando.id,
          tallasAEliminar,
          sucursalIdParaCostosSesion(sesion)
        );

        for (const costoId of costosAEliminar) {
          const resultado = await deleteCosto(costoId);
          if (resultado.error) {
            setMensajeError(`❌ Error al quitar talla: ${resultado.error}`);
            setModalErrorAbierto(true);
            return;
          }
        }
      }
      
      // Agregar costos para nuevas tallas solo en la tienda de la sesión
      if (tallasAAgregar.length > 0) {
        const sucursalActiva = sucursalIdParaCostosSesion(sesion);
        if (!sucursalActiva) {
          setMensajeError('❌ Error: No hay sucursal activa en la sesión');
          setModalErrorAbierto(true);
          return;
        }
        const sucursales = [{ id: sucursalActiva }];
        
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

      await refetchPrendas();
      
      setBotonEstado('exito');
      
      // Actualizar tallasAsociadas con las tallas actuales después del guardado
      setTallasAsociadas([...tallasSeleccionadas]);
      
      await refetchCategorias();
      cerrarFormularioTrasExito();
    } else {
      const reutilizarId = reutilizarPrendaIdRef.current;

      if (reutilizarId) {
        const resultado = await crearCostosSeleccionadosParaPrenda(reutilizarId);
        if (resultado.error) {
          setMensajeError(`❌ Error al dar de alta en tu tienda: ${resultado.error}`);
          setModalErrorAbierto(true);
          reutilizarPrendaIdRef.current = null;
          return;
        }
        if (resultado.agregadas === 0) {
          setMensajeError(
            'ℹ️ Esta prenda ya estaba en tu tienda con las tallas seleccionadas. No se creó nada nuevo.'
          );
          setModalErrorAbierto(true);
          reutilizarPrendaIdRef.current = null;
          await refetchPrendas();
          return;
        }
        await refetchPrendas();
        setBotonEstado('exito');
        await refetchCategorias();
        cerrarFormularioTrasExito();
        return;
      }

      let { data: nuevaPrenda, error } = await createPrenda(prendaData);
      if (error && (error.includes('duplicate') || error.includes('unique') || error.includes('prendas_codigo'))) {
        const prefijo = generarCodigo(prendaData.nombre || '') || (prendaData.codigo || '').split('-')[0];
        if (prefijo) {
          const codigoLibre = await asignarSiguienteCodigoGlobal(prefijo);
          if (codigoLibre) {
            prendaData.codigo = codigoLibre;
            ({ data: nuevaPrenda, error } = await createPrenda(prendaData));
          }
        }
      }
      if (error) {
        if (error.includes('duplicate') || error.includes('unique') || error.includes('prendas_codigo')) {
          const existente = prendaData.codigo
            ? await buscarPrendaPorCodigo(prendaData.codigo)
            : null;
          setMensajeError(
            existente
              ? `❌ El código "${existente.codigo}" ya existe (${existente.nombre}). Está en otra tienda o quedó en el catálogo; no se puede repetir. Usa otro código.`
              : `❌ Ya existe una prenda con ese código o nombre en el catálogo (puede estar en otra tienda).`
          );
        } else {
          setMensajeError(`❌ Error al crear prenda: ${error}`);
        }
        setModalErrorAbierto(true);
        return;
      }
      
      if (nuevaPrenda && tallasSeleccionadas.length > 0) {
        const resultadoCostos = await crearCostosSeleccionadosParaPrenda(nuevaPrenda.id);
        if (resultadoCostos.error) {
          setMensajeError(
            `❌ La prenda se creó, pero falló al registrar tallas en tu tienda: ${resultadoCostos.error}`
          );
          setModalErrorAbierto(true);
          await refetchPrendas();
          return;
        }
      }

      await refetchPrendas();
      
      setBotonEstado('exito');
      await refetchCategorias();
      cerrarFormularioTrasExito();
    }
  };

  const handleEditar = (prenda: Prenda) => {
    setPrendaEditando(prenda);
    setFormData({
      nombre: prenda.nombre,
      codigo: prenda.codigo || '',
      descripcion: prenda.descripcion || '',
      categoria_id: prenda.categoria_id || '',
      activo: prenda.activo,
    });
    
    setBotonEstado('normal');
    setMensajeError('');
    limpiarCacheEdicion();
    setMostrarFormulario(true);
    void cargarDatosEdicionPrenda(prenda.id);
  };

  const handleEliminar = async (id: string) => {
    const soloTienda = inventarioOpts.inventarioSoloSucursal;
    const msg = soloTienda
      ? '⚠️ ¿Eliminar esta prenda de tu tienda? Si también existe en otra sucursal, solo se quitará de tu inventario local.'
      : '⚠️ ¿Estás seguro de eliminar esta prenda? Se eliminará TODA su información incluyendo historial de pedidos. Esta acción NO se puede deshacer.';
    if (confirm(msg)) {
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

  // Código automático: siguiente libre en el catálogo global (no solo esta tienda)
  const handleNombreChange = (nombre: string) => {
    if (!prendaEditando && nombre) {
      const prefijo = generarCodigo(nombre);
      setFormData((prev) => ({ ...prev, nombre }));
      if (prefijo) {
        void asignarSiguienteCodigoGlobal(prefijo).then((codigoFinal) => {
          setFormData((prev) =>
            prev.nombre === nombre ? { ...prev, codigo: codigoFinal } : prev
          );
        });
      }
    } else {
      setFormData((prev) => ({ ...prev, nombre }));
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
              setPrendaEditando(null);
              setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
              setTallasSeleccionadas([]);
              setTallasAsociadas([]);
              setMensajeError('');
              setTimeout(() => {
                inputBusquedaRef.current?.focus();
              }, 100);
            }}
          >
            <div
              className="form-container"
              style={{
                maxWidth: '980px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '2rem auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
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
                {prendaEditando && cargandoEdicionPrenda && (
                  <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.9rem' }}>
                    Cargando tallas y stock…
                  </p>
                )}
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    maxHeight: '400px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}
                  className="tallas-grid-container"
                >
                  {(() => {
                    let tallasFiltradas = tallas.filter((t) => t.activo);

                    if (filtroTipo === 'letras') {
                      tallasFiltradas = tallasFiltradas.filter((t) => isNaN(Number(t.nombre)));
                    } else if (filtroTipo === 'numeros') {
                      tallasFiltradas = tallasFiltradas.filter((t) => !isNaN(Number(t.nombre)));
                      if (filtroNumeros === 'pares') {
                        tallasFiltradas = tallasFiltradas.filter((t) => Number(t.nombre) % 2 === 0);
                      } else if (filtroNumeros === 'nones') {
                        tallasFiltradas = tallasFiltradas.filter((t) => Number(t.nombre) % 2 !== 0);
                      }
                    }

                    const tallasOrdenadas = sortTallas(tallasFiltradas);

                    if (tallasOrdenadas.length === 0) {
                      return (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                          No hay tallas que coincidan con los filtros seleccionados
                        </div>
                      );
                    }

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: '0.5rem',
                          padding: '0.75rem',
                          minWidth: 'min(100%, 480px)',
                        }}
                      >
                        {tallasOrdenadas.map((talla) => (
                          <div
                            key={talla.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.6rem',
                              border: '1px solid #f0f0f0',
                              borderRadius: '8px',
                              background: tallasSeleccionadas.includes(talla.id) ? '#f8fbff' : 'white',
                              minWidth: 0,
                            }}
                          >
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                cursor: 'pointer',
                                userSelect: 'none',
                                minWidth: 0,
                                flex: '1 1 auto',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={tallasSeleccionadas.includes(talla.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTallasSeleccionadas([...tallasSeleccionadas, talla.id]);
                                  } else {
                                    setTallasSeleccionadas(
                                      tallasSeleccionadas.filter((id) => id !== talla.id)
                                    );
                                  }
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontWeight: tallasSeleccionadas.includes(talla.id) ? '600' : '400',
                                  color: tallasSeleccionadas.includes(talla.id) ? '#007bff' : 'inherit',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {talla.nombre}
                              </span>
                            </label>
                            {tallasSeleccionadas.includes(talla.id) && prendaEditando && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.35rem',
                                  alignItems: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {!cargandoEdicionPrenda && costosEdicionCache.length > 0 && (
                                  <span
                                    title="Stock en esta sucursal"
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '600',
                                      color: '#0891b2',
                                      background: '#ecfeff',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {Number(
                                      costoPrendaTallaDesdeFilas(costosEdicionCache, talla.id)?.stock ?? 0
                                    )}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTallaSeleccionadaStock({ id: talla.id, nombre: talla.nombre });
                                    setModalStockAbierto(true);
                                  }}
                                  title="Configurar stock de esta talla"
                                  style={{
                                    padding: '0.25rem 0.45rem',
                                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
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
                                    padding: '0.25rem 0.45rem',
                                    background:
                                      conteoInsumosPorTalla[talla.id] > 0
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : '#e2e8f0',
                                    color: conteoInsumosPorTalla[talla.id] > 0 ? 'white' : '#64748b',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  🧵 {conteoInsumosPorTalla[talla.id] || 0}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
            {puedeEditarCatalogo && (
              <>
              <button
                className="btn btn-secondary"
                onClick={() => setModalConjuntosAbierto(true)}
                style={{ backgroundColor: '#0f766e', borderColor: '#0f766e', minWidth: '200px', color: '#fff' }}
              >
                🧩 Conjuntos
              </button>
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
              </>
            )}
          </div>
          
          <table className="table">
            <thead>
              <tr>
                <th className="table-col-eliminar" aria-label="Eliminar" />
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda
                      ? 'No se encontraron prendas con ese criterio.'
                        : puedeEditarCatalogo
                          ? 'No hay prendas registradas. Crea tu primera prenda.'
                          : 'No hay prendas en el inventario de esta sucursal. Aparecerán cuando recibas transferencias desde matriz.'}
                  </td>
                </tr>
              ) : (
                prendasFiltradas.map((prenda) => (
                  <tr key={prenda.id}>
                    <td className="table-col-eliminar" data-label="">
                      {puedeEditarCatalogo ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-eliminar-fila"
                          onClick={() => handleEliminar(prenda.id)}
                          title="Eliminar prenda"
                          aria-label="Eliminar prenda"
                        >
                          🗑️
                        </button>
                      ) : null}
                    </td>
                    <td data-label="Código" style={{ fontFamily: 'monospace', fontWeight: '600' }}>{prenda.codigo || '-'}</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{prenda.nombre}</td>
                    <td data-label="Categoría"><span className="badge badge-info">{prenda.categoria?.nombre || '-'}</span></td>
                    <td data-label="Descripción">{prenda.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${prenda.activo ? 'badge-success' : 'badge-danger'}`}>
                        {prenda.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      {puedeEditarCatalogo ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEditar(prenda)}
                        >
                          ✏️ Editar
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Inventario de sucursal</span>
                      )}
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
            if (prendaEditando) {
              void fetchConteoInsumosPorPrenda(prendaEditando.id).then(setConteoInsumosPorTalla);
            }
          }}
          prendaId={prendaEditando.id}
          prendaNombre={prendaEditando.nombre}
          tallaId={tallaSeleccionadaModal.id}
          tallaNombre={tallaSeleccionadaModal.nombre}
        />
      )}

      <ModalConjuntos
        abierto={modalConjuntosAbierto}
        onClose={() => setModalConjuntosAbierto(false)}
        prendas={prendas}
        tallas={tallas}
      />

      {/* Modal de Stock */}
      {modalStockAbierto && prendaEditando && tallaSeleccionadaStock && (
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
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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

            {cargandoModalStock ? (
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Cargando stock…</p>
            ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              try {
                const costoExistente = await fetchCostoStockModal(insforgeDb(), {
                  prendaId: prendaEditando.id,
                  tallaId: tallaSeleccionadaStock.id,
                  sucursalId: sesion?.sucursal_id ?? null,
                  costosPrecargados: costosEdicionCache,
                });

                if (!costoExistente) {
                  setMensajeError('❌ No se encontró el registro de costo para esta combinación. Asegúrate de que la talla esté asociada a la prenda.');
                  setModalErrorAbierto(true);
                  setModalStockAbierto(false);
                  return;
                }

                const total = parseEnteroFormateado(stockData.stock_inicial);
                const stockMinimo = parseEnteroFormateado(stockData.stock_minimo);
                const sumDistrib = partidasUbicacion.reduce(
                  (s, p) => s + parseEnteroFormateado(p.cantidad),
                  0
                );

                if (total < 0) {
                  setMensajeError('❌ El stock existente no puede ser negativo.');
                  setModalErrorAbierto(true);
                  return;
                }

                if (usarUbicacionesStock) {
                  if (total === 0 && partidasUbicacion.length > 0) {
                    setMensajeError(
                      '❌ Con stock en 0 no debe haber cantidades por ubicación. Quita las partidas o indica un stock mayor a 0.'
                    );
                    setModalErrorAbierto(true);
                    return;
                  }

                  if (total > 0) {
                    if (partidasUbicacion.length === 0) {
                      setMensajeError('❌ Con stock mayor a 0, agrega stock con «Actualizar stock» y asigna ubicación.');
                      setModalErrorAbierto(true);
                      return;
                    }
                    if (sumDistrib !== total) {
                      setMensajeError(
                        `❌ La suma por ubicación (${sumDistrib}) debe ser igual al stock existente (${total}).`
                      );
                      setModalErrorAbierto(true);
                      return;
                    }
                  }
                }

                const partidas = partidasUbicacion
                  .map((p) => ({
                    ubicacion_almacenamiento_id: p.ubicacion_id,
                    cantidad: parseEnteroFormateado(p.cantidad),
                  }))
                  .filter((row) => row.cantidad > 0);

                const res = await fetch('/api/costos/configurar-stock', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    costo_id: String(costoExistente.id),
                    stock: total,
                    stock_minimo: stockMinimo,
                    partidas,
                    omitir_ubicaciones: !usarUbicacionesStock,
                  }),
                });
                const json = await res.json().catch(() => null);
                if (!json?.success) {
                  throw new Error(String(json?.error || `No se pudo configurar el stock (HTTP ${res.status})`));
                }

                setMensajeExitoStock('✅ Stock configurado correctamente');
                setModalExitoStockAbierto(true);
                void cargarDatosEdicionPrenda(prendaEditando.id);
                
                setTimeout(() => {
                  setModalExitoStockAbierto(false);
                  setMensajeExitoStock('');
                  setModalStockAbierto(false);
                  setTallaSeleccionadaStock(null);
                  setStockData({
                    stock_inicial: '',
                    stock_minimo: '',
                  });
                  setPartidasUbicacion([]);
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
                  Stock Existente *
                </label>
                <div
                  style={{
                    display: 'inline-flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    maxWidth: '100%',
                  }}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="form-input"
                    value={stockData.stock_inicial}
                    readOnly
                    placeholder="0"
                    style={{
                      width: '7.5rem',
                      flexShrink: 0,
                      padding: '0.55rem 0.65rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                    }}
                  />
                  <button
                    type="button"
                    onClick={abrirModalAjusteStock}
                    title="Sumar o restar unidades al stock"
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.75rem',
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      lineHeight: 1.2,
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(2, 132, 199, 0.35)';
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '1.15rem',
                        height: '1.15rem',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.25)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                      aria-hidden
                    >
                      ±
                    </span>
                    Ajustar
                  </button>
                </div>
                <small style={{ color: '#64748b', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                  {usarUbicacionesStock
                    ? 'Pulsa «Ajustar» para sumar o restar unidades y asignar ubicación en matriz.'
                    : 'Pulsa «Ajustar» para sumar o restar (ej. 5 suma, −5 resta).'}
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
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="form-input"
                  value={stockData.stock_minimo}
                  onChange={(e) =>
                    setStockData({
                      ...stockData,
                      stock_minimo: formatearEnteroMilesAlEscribir(e.target.value),
                    })
                  }
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

              {usarUbicacionesStock && (
              <div style={{ marginBottom: '2rem' }}>
                <label
                  className="form-label"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  📍 Distribución por ubicación
                </label>
                {stockTotalModalNum() > 0 && (
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#f0fdfa',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      color: '#0f766e',
                      marginBottom: '0.75rem',
                    }}
                  >
                    Total stock:{' '}
                    <strong>{stockTotalModalNum().toLocaleString('en-US')}</strong>
                    {' · '}
                    Distribuido:{' '}
                    <strong>{sumPartidasDistribuidas().toLocaleString('en-US')}</strong>
                  </div>
                )}
                {partidasUbicacion.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {partidasUbicacion.map((p) => {
                      const nombreUb =
                        ubicaciones.find((u) => u.id === p.ubicacion_id)?.nombre || 'Ubicación';
                      return (
                        <div
                          key={p.tempId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.65rem 0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#fafafa',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>{nombreUb}</span>
                          <span style={{ color: '#0f766e', fontWeight: 600 }}>
                            {parseEnteroFormateado(p.cantidad).toLocaleString('en-US')} uds.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    {stockTotalModalNum() > 0
                      ? 'Sin ubicaciones asignadas. Usa «Actualizar stock» para repartir.'
                      : 'Con stock 0 no hay ubicaciones asignadas.'}
                  </p>
                )}
              </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalStockAbierto(false);
                    cerrarModalAjusteStock();
                    setTallaSeleccionadaStock(null);
                    setStockData({
                      stock_inicial: '',
                      stock_minimo: '',
                    });
                    setPartidasUbicacion([]);
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
            )}
          </div>
        </div>
      )}

      {/* Modal ajustar stock (+ / −) */}
      {modalAjusteStockAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2100,
            padding: '1rem',
          }}
          onClick={cerrarModalAjusteStock}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.75rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#2563eb', marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
              Actualizar stock
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Stock actual: <strong>{stockTotalModalNum().toLocaleString('en-US')}</strong>
              {cantidadAjusteStock.trim() && (
                <>
                  {' → '}
                  <strong>
                    {Math.max(
                      0,
                      stockTotalModalNum() + parseSignedEnteroFormateado(cantidadAjusteStock)
                    ).toLocaleString('en-US')}
                  </strong>
                </>
              )}
            </p>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>
              Cantidad a sumar o restar
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={cantidadAjusteStock}
              onChange={(e) => {
                setCantidadAjusteStock(formatearSignedEnteroAlEscribir(e.target.value));
                setErrorAjusteStock('');
              }}
              placeholder="Ej: 5 o -5"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                marginBottom: '0.75rem',
              }}
            />
            <small style={{ color: '#64748b', display: 'block', marginBottom: '1rem' }}>
              Número positivo suma; con signo − resta (ej. tenías 10 y pones −5 → quedan 5).
            </small>

            {usarUbicacionesStock &&
              requiereUbicacionEnAjuste(parseSignedEnteroFormateado(cantidadAjusteStock)) && (
                <>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>
                    Ubicación
                  </label>
                  <select
                    value={ubicacionAjusteStock}
                    onChange={(e) => {
                      setUbicacionAjusteStock(e.target.value);
                      setErrorAjusteStock('');
                    }}
                    disabled={loadingUbicaciones}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <option value="">Selecciona ubicación…</option>
                    {parseSignedEnteroFormateado(cantidadAjusteStock) < 0
                      ? partidasUbicacion
                          .filter((p) => parseEnteroFormateado(p.cantidad) > 0)
                          .map((p) => {
                            const nombre =
                              ubicaciones.find((u) => u.id === p.ubicacion_id)?.nombre || 'Ubicación';
                            return (
                              <option key={p.tempId} value={p.ubicacion_id}>
                                {nombre} ({parseEnteroFormateado(p.cantidad).toLocaleString('en-US')} uds.)
                              </option>
                            );
                          })
                      : ubicaciones
                          .filter((u) => u.activo)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre}
                            </option>
                          ))}
                  </select>
                </>
              )}

            {errorAjusteStock && (
              <p style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '1rem' }}>{errorAjusteStock}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={cerrarModalAjusteStock}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarAjusteStock}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación: prenda ya existe (Winston) */}
      {modalConfirmDuplicado && prendaExistenteCatalogo && (
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
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                color: '#b45309',
                marginBottom: '0.75rem',
                fontSize: '1.4rem',
                fontWeight: '700',
              }}
            >
              Esta prenda ya existe
            </h3>
            <p style={{ color: '#333', marginBottom: '1.25rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
              En el catálogo ya hay una prenda con el mismo nombre. Revisa sus datos y confirma si
              deseas darla de alta en <strong>Sucursal Winston</strong> (se usará la existente; no se
              creará un duplicado).
            </p>
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fdba74',
                borderRadius: '10px',
                padding: '1rem 1.15rem',
                marginBottom: '1.25rem',
                fontSize: '0.98rem',
                lineHeight: 1.55,
                color: '#1f2937',
              }}
            >
              <div>
                <strong>Código:</strong> {prendaExistenteCatalogo.codigo || '—'}
              </div>
              <div>
                <strong>Nombre:</strong> {prendaExistenteCatalogo.nombre}
              </div>
              <div>
                <strong>Categoría:</strong> {prendaExistenteCatalogo.categoriaNombre || 'Sin categoría'}
              </div>
              <div>
                <strong>Descripción:</strong>{' '}
                {prendaExistenteCatalogo.descripcion?.trim() || 'Sin descripción'}
              </div>
              <div>
                <strong>Estado:</strong>{' '}
                {prendaExistenteCatalogo.activo ? 'Activa' : 'Inactiva'}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <strong>En tu tienda ahora:</strong>{' '}
                {existenteYaEnTienda
                  ? `Sí (${tallasExistentesEnTienda.length} talla${tallasExistentesEnTienda.length === 1 ? '' : 's'} registrada${tallasExistentesEnTienda.length === 1 ? '' : 's'})`
                  : 'No — aún no está en el inventario de Winston'}
              </div>
              {tallasExistentesEnTienda.length > 0 && (
                <div style={{ marginTop: '0.35rem', color: '#4b5563' }}>
                  Tallas ya en Winston:{' '}
                  {tallasExistentesEnTienda
                    .map((id) => tallas.find((t) => t.id === id)?.nombre || id)
                    .join(', ')}
                </div>
              )}
            </div>
            <p style={{ color: '#4b5563', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Al confirmar se agregarán solo las tallas seleccionadas que aún no existan en tu tienda.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  reutilizarPrendaIdRef.current = prendaExistenteCatalogo.id;
                  setModalConfirmDuplicado(false);
                  void handleSubmit({ preventDefault() {} } as React.FormEvent);
                }}
                style={{
                  flex: '1 1 200px',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                }}
              >
                Sí, dar de alta en mi tienda
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  reutilizarPrendaIdRef.current = null;
                  setModalConfirmDuplicado(false);
                  setPrendaExistenteCatalogo(null);
                }}
                style={{
                  flex: '1 1 140px',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#111827',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Error */}
      {modalErrorAbierto && (
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
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ 
              color: mensajeError.startsWith('ℹ️') ? '#b45309' : '#dc3545', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              {mensajeError.startsWith('ℹ️') ? 'Aviso' : 'Error'}
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
            zIndex: 3000,
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
