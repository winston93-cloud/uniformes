'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';

interface Alumno {
  id: number;
  nombre: string;
  referencia: string;
  grado: string;
  grupo: string;
  telefono: string;
  email: string;
}

export default function AlumnosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [alumnos, setAlumnos] = useState<Alumno[]>([
    { id: 1, nombre: 'Juan Pérez García', referencia: '45678', grado: '6°', grupo: 'A', telefono: '555-1234', email: 'juan@ejemplo.com' },
    { id: 2, nombre: 'María González López', referencia: '45679', grado: '5°', grupo: 'B', telefono: '555-5678', email: 'maria@ejemplo.com' },
  ]);

  const [formData, setFormData] = useState({
    nombre: '',
    grado: '',
    grupo: '',
    telefono: '',
    email: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevoAlumno: Alumno = {
      id: Date.now(),
      nombre: formData.nombre,
      referencia: Math.floor(Math.random() * 90000 + 10000).toString(),
      grado: formData.grado,
      grupo: formData.grupo,
      telefono: formData.telefono,
      email: formData.email,
    };
    setAlumnos([...alumnos, nuevoAlumno]);
    setFormData({ nombre: '', grado: '', grupo: '', telefono: '', email: '' });
    setMostrarFormulario(false);
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            👨‍🎓 Gestión de Alumnos
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Alumno
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Registrar Nuevo Alumno</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre(s) y Apellidos"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Grado *</label>
                  <select
                    className="form-select"
                    value={formData.grado}
                    onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="1°">1°</option>
                    <option value="2°">2°</option>
                    <option value="3°">3°</option>
                    <option value="4°">4°</option>
                    <option value="5°">5°</option>
                    <option value="6°">6°</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Grupo *</label>
                  <select
                    className="form-select"
                    value={formData.grupo}
                    onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="555-1234"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alumno@ejemplo.com"
                  />
                </div>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Registrar Alumno
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
                <th>Referencia</th>
                <th>Nombre</th>
                <th>Grado</th>
                <th>Grupo</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((alumno) => (
                <tr key={alumno.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{alumno.referencia}</td>
                  <td style={{ fontWeight: '600' }}>{alumno.nombre}</td>
                  <td><span className="badge badge-info">{alumno.grado}</span></td>
                  <td><span className="badge badge-info">{alumno.grupo}</span></td>
                  <td>{alumno.telefono}</td>
                  <td>{alumno.email}</td>
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

