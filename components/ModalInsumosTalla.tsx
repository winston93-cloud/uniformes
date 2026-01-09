'use client';

import { useState, useEffect } from 'react';
import { usePrendaTallaInsumos } from '@/lib/hooks/usePrendaTallaInsumos';
import { useInsumos } from '@/lib/hooks/useInsumos';

interface ModalInsumosTallaProps {
  isOpen: boolean;
  onClose: () => void;
  prendaId: string;
  prendaNombre: string;
  tallaId: string;
  tallaNombre: string;
}

export default function ModalInsumosTalla({
  isOpen,
  onClose,
  prendaId,
  prendaNombre,
  tallaId,
  tallaNombre
}: ModalInsumosTallaProps) {
  const { insumos: insumosAsignados, loading, createInsumo, updateInsumo, deleteInsumo, refetch } = usePrendaTallaInsumos(prendaId, tallaId);
  const { insumos: todosInsumos } = useInsumos();
  
  const [insumoSeleccionado, setInsumoSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [cantidadEdit, setCantidadEdit] = useState('');

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAgregarInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!insumoSeleccionado || !cantidad || parseFloat(cantidad) <= 0) {
      alert('Por favor, selecciona un insumo y una cantidad válida');
      return;
    }

    try {
      setGuardando(true);
      await createInsumo(insumoSeleccionado, parseFloat(cantidad));
      setInsumoSeleccionado('');
      setCantidad('');
      alert('Insumo agregado exitosamente');
    } catch (error: any) {
      console.error('Error:', error);
      if (error.message?.includes('duplicate key')) {
        alert('Este insumo ya está asignado a esta talla. Puedes editarlo en la lista.');
      } else {
        alert('Error al agregar insumo: ' + error.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleActualizarCantidad = async (id: string) => {
    if (!cantidadEdit || parseFloat(cantidadEdit) <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    try {
      await updateInsumo(id, parseFloat(cantidadEdit));
      setEditando(null);
      setCantidadEdit('');
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message);
    }
  };

  const handleEliminar = async (id: string, nombreInsumo: string) => {
    if (!confirm(`¿Eliminar ${nombreInsumo} de esta talla?`)) return;

    try {
      await deleteInsumo(id);
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const getUnidadMedida = (insumo: any) => {
    return insumo?.presentacion?.nombre || 'unidad';
  };

  // Filtrar insumos que no están ya asignados
  const insumosDisponibles = todosInsumos.filter(insumo => 
    insumo.activo && !insumosAsignados.some(ia => ia.insumo_id === insumo.id)
  );

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
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '2px solid #e5e7eb',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                🧵 Insumos de la Talla
              </h2>
              <p style={{ margin: '0.5rem 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem' }}>
                <strong>{prendaNombre}</strong> - Talla <strong>{tallaNombre}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                fontSize: '1.5rem',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Formulario para agregar insumo */}
          <form onSubmit={handleAgregarInsumo} style={{ marginBottom: '2rem' }}>
            <div style={{
              background: '#f8fafc',
              padding: '1.5rem',
              borderRadius: '10px',
              border: '2px dashed #cbd5e1'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#1e293b' }}>
                ➕ Agregar Nuevo Insumo
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                    Insumo *
                  </label>
                  <select
                    value={insumoSeleccionado}
                    onChange={(e) => setInsumoSeleccionado(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">Seleccionar insumo...</option>
                    {insumosDisponibles.map(insumo => (
                      <option key={insumo.id} value={insumo.id}>
                        {insumo.nombre} ({insumo.presentacion?.nombre || 'Sin presentación'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: guardando ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    opacity: guardando ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  {guardando ? '...' : 'Agregar'}
                </button>
              </div>
            </div>
          </form>

          {/* Lista de insumos asignados */}
          <div>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 Insumos Asignados 
              <span style={{ 
                background: '#667eea', 
                color: 'white', 
                borderRadius: '20px', 
                padding: '0.25rem 0.75rem', 
                fontSize: '0.85rem',
                fontWeight: '600'
              }}>
                {insumosAsignados.length}
              </span>
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                Cargando insumos...
              </div>
            ) : insumosAsignados.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '3rem 2rem', 
                background: '#f8fafc', 
                borderRadius: '10px',
                border: '2px dashed #cbd5e1'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                <p style={{ color: '#64748b', margin: 0 }}>
                  No hay insumos asignados a esta talla todavía
                </p>
                <p style={{ color: '#94a3b8', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                  Usa el formulario de arriba para agregar insumos
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {insumosAsignados.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'white',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                          {item.insumo?.nombre || 'Insumo desconocido'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {item.insumo?.presentacion?.nombre || 'Sin presentación'}
                        </div>
                      </div>
                      
                      {editando === item.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={cantidadEdit}
                            onChange={(e) => setCantidadEdit(e.target.value)}
                            min="0"
                            step="0.01"
                            style={{
                              width: '100px',
                              padding: '0.5rem',
                              border: '2px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '0.9rem'
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleActualizarCantidad(item.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditando(null);
                              setCantidadEdit('');
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#94a3b8',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#667eea' }}>
                              {item.cantidad}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'lowercase' }}>
                              {getUnidadMedida(item.insumo)}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditando(item.id);
                              setCantidadEdit(item.cantidad.toString());
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                            title="Editar cantidad"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleEliminar(item.id, item.insumo?.nombre || 'este insumo')}
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
