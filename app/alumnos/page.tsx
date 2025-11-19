'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAlumnos } from '@/lib/hooks/useAlumnos';

export default function AlumnosPage() {
  const { alumnos, loading, error, searchAlumnos } = useAlumnos();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(alumnos);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults(alumnos);
      return;
    }
    
    const results = await searchAlumnos(query);
    setSearchResults(results);
  };

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

  const alumnosToShow = searchQuery ? searchResults : alumnos;

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            👨‍🎓 Gestión de Alumnos
          </h1>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los alumnos: {error}
          </div>
        )}

        {/* Búsqueda */}
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 30px var(--card-shadow)', marginBottom: '2rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Buscar Alumno</label>
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por referencia, nombre, apellido..."
            />
          </div>
          {searchQuery && (
            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {searchResults.length} resultado(s) encontrado(s)
            </p>
          )}
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Nombre Completo</th>
                <th>Grado</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {alumnosToShow.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {searchQuery ? 'No se encontraron alumnos con esa búsqueda' : 'No hay alumnos registrados'}
                  </td>
                </tr>
              ) : (
                alumnosToShow.map((alumno) => (
                  <tr key={alumno.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{alumno.referencia}</td>
                    <td style={{ fontWeight: '600' }}>{alumno.nombre}</td>
                    <td><span className="badge badge-info">{alumno.grado || '-'}</span></td>
                    <td><span className="badge badge-info">{alumno.grupo || '-'}</span></td>
                    <td>
                      <span className={`badge ${alumno.activo ? 'badge-success' : 'badge-danger'}`}>
                        {alumno.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                        👁️ Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {!searchQuery && alumnos.length > 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Mostrando {alumnos.length} de {alumnos.length} alumnos (máximo 1000)
            </div>
          )}
        </div>
      </div>
    </LayoutWrapper>
  );
}
