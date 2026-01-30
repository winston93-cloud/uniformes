'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Sucursal } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { setSesion } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    const { data } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activo', true)
      .order('es_matriz', { ascending: false })
      .order('nombre');
    
    if (data) {
      setSucursales(data);
      if (data.length > 0) {
        setSucursalId(data[0].id); // Seleccionar primera por defecto
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Buscar usuario
      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('usuario_username', username)
        .eq('usuario_password', password)
        .eq('activo', true)
        .single();

      if (errorUsuario || !usuario) {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }

      // Buscar sucursal
      const { data: sucursal, error: errorSucursal } = await supabase
        .from('sucursales')
        .select('*')
        .eq('id', sucursalId)
        .single();

      if (errorSucursal || !sucursal) {
        setError('Sucursal no encontrada');
        setLoading(false);
        return;
      }

      // Crear sesión
      setSesion({
        usuario_id: usuario.usuario_id,
        usuario_username: usuario.usuario_username,
        usuario_email: usuario.usuario_email || '',
        sucursal_id: sucursal.id,
        sucursal_codigo: sucursal.codigo,
        sucursal_nombre: sucursal.nombre,
        es_matriz: sucursal.es_matriz,
      });

      // Redirigir al dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        padding: '3rem',
        maxWidth: '450px',
        width: '100%',
      }}>
        {/* Logo y título */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
          }}>
            🎓
          </div>
          <h1 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.8rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Sistema de Uniformes
          </h1>
          <p style={{
            margin: 0,
            color: '#6b7280',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}>
            WINSTON CHURCHILL
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#991b1b',
              fontSize: '0.9rem',
            }}>
              ❌ {error}
            </div>
          )}

          {/* Usuario */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#374151',
              fontSize: '0.9rem',
            }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border 0.3s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              placeholder="Ingresa tu usuario"
            />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#374151',
              fontSize: '0.9rem',
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border 0.3s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              placeholder="Ingresa tu contraseña"
            />
          </div>

          {/* Sucursal */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#374151',
              fontSize: '0.9rem',
            }}>
              Sucursal
            </label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border 0.3s',
                cursor: 'pointer',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.es_matriz ? '🏛️' : '📍'} {sucursal.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? '⏳ Iniciando sesión...' : '🔐 Iniciar Sesión'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '0.85rem',
        }}>
          © 2026 Sistema de Uniformes Winston Churchill
        </div>
      </div>
    </div>
  );
}
