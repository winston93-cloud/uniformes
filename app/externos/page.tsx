'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';

interface ClienteExterno {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

export default function ExternosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [clientes, setClientes] = useState<ClienteExterno[]>([
    { id: 1, nombre: 'Pedro López Martínez', telefono: '555-9876', email: 'pedro@ejemplo.com', direccion: 'Calle 123, Col. Centro' },
    { id: 2, nombre: 'Ana Rodríguez Silva', telefono: '555-5432', email: 'ana@ejemplo.com', direccion: 'Av. Principal 456' },
  ]);

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevoCliente: ClienteExterno = {
      id: Date.now(),
      ...formData,
    };
    setClientes([...clientes, nuevoCliente]);
    setFormData({ nombre: '', telefono: '', email: '', direccion: '' });
    setMostrarFormulario(false);
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            👤 Clientes Externos
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Cliente
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Registrar Cliente Externo</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre completo del cliente"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="555-1234"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@ejemplo.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dirección</label>
                <textarea
                  className="form-textarea"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Dirección completa del cliente..."
                />
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Registrar Cliente
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarFormulario(false)}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{cliente.id}</td>
                  <td style={{ fontWeight: '600' }}>{cliente.nombre}</td>
                  <td>{cliente.telefono}</td>
                  <td>{cliente.email}</td>
                  <td>{cliente.direccion}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}

