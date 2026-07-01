'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useUsuariosUniformes } from '@/lib/hooks/useUsuariosUniformes';
import type { EstadoUsuarioUniforme, UsuarioUniforme } from '@/lib/types';

const ESTADOS: { value: EstadoUsuarioUniforme; label: string }[] = [
  { value: 'pendiente_validacion', label: 'Pendiente de validación' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
];

function etiquetaEstado(estado: EstadoUsuarioUniforme): string {
  return ESTADOS.find((e) => e.value === estado)?.label ?? estado;
}

export default function UsuariosPage() {
  const { loading: authLoading } = useAuth();
  const { usuarios, roles, loading, error, recargar, crearUsuario, actualizarUsuario, eliminarUsuario } =
    useUsuariosUniformes();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<UsuarioUniforme | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [estado, setEstado] = useState<EstadoUsuarioUniforme>('activo');

  const abrirNuevo = () => {
    setEditando(null);
    setNombre('');
    setUsuarioLogin('');
    setCorreo('');
    setPassword('');
    setRolId(roles.find((r) => r.nombre.toLowerCase() === 'administrador')?.id ?? roles[0]?.id ?? '');
    setEstado('activo');
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirEditar = (u: UsuarioUniforme) => {
    setEditando(u);
    setNombre(u.nombre);
    setUsuarioLogin(u.usuario);
    setCorreo(u.correo);
    setPassword('');
    setRolId(u.rol_id);
    setEstado(u.estado);
    setFormError(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const nombreTrim = nombre.trim();
    const usuarioTrim = usuarioLogin.trim().toLowerCase();
    const correoTrim = correo.trim().toLowerCase();

    if (!nombreTrim) {
      setFormError('Indica el nombre.');
      return;
    }
    if (!usuarioTrim) {
      setFormError('Indica el usuario de login.');
      return;
    }
    if (!correoTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoTrim)) {
      setFormError('Indica un correo válido.');
      return;
    }
    if (!rolId) {
      setFormError('Selecciona un rol.');
      return;
    }
    if (!editando && password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      if (editando) {
        const payload: Parameters<typeof actualizarUsuario>[1] = {
          nombre: nombreTrim,
          usuario: usuarioTrim,
          correo: correoTrim,
          rol_id: rolId,
          estado,
        };
        if (password.length > 0) payload.password = password;
        const r = await actualizarUsuario(editando.id, payload);
        if (!r.ok) {
          setFormError(r.message ?? 'No se pudo actualizar.');
          return;
        }
      } else {
        const r = await crearUsuario({
          nombre: nombreTrim,
          usuario: usuarioTrim,
          correo: correoTrim,
          password,
          rol_id: rolId,
          estado,
        });
        if (!r.ok) {
          setFormError(r.message ?? 'No se pudo crear.');
          return;
        }
      }
      cerrarModal();
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (u: UsuarioUniforme) => {
    if (!confirm(`¿Eliminar el usuario «${u.nombre}»? Esta acción no se puede deshacer.`)) return;
    const r = await eliminarUsuario(u.id);
    if (!r.ok) {
      alert(r.message ?? 'No se pudo eliminar.');
    }
  };

  if (authLoading) {
    return (
      <LayoutWrapper>
        <div className="main-container" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p>Cargando…</p>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 className="page-title">👥 Usuarios del sistema</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '42rem' }}>
              Cuentas con usuario y contraseña para acceder al sistema. Solo usuarios <strong>Activos</strong> pueden
              iniciar sesión. El rol <strong>Administrador</strong> accede a todos los módulos.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo} disabled={roles.length === 0}>
            ➕ Nuevo usuario
          </button>
        </div>

        {roles.length === 0 && !loading && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
              borderLeft: '4px solid #f59e0b',
              background: '#fffbeb',
            }}
          >
            <strong>No hay roles en catálogo.</strong> Aplica la migración de roles en InsForge.
          </div>
        )}

        {error && (
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #dc2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" />
            <p>Cargando usuarios…</p>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h3>No hay usuarios registrados</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Crea el primero para comenzar.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-col-eliminar" aria-label="Eliminar" />
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="table-col-eliminar" data-label="">
                      <button
                        type="button"
                        className="btn btn-danger btn-eliminar-fila"
                        onClick={() => handleEliminar(u)}
                        title="Eliminar usuario"
                        aria-label="Eliminar usuario"
                      >
                        🗑️
                      </button>
                    </td>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td>
                      <code style={{ background: '#f3f4f6', padding: '0.2rem 0.45rem', borderRadius: 4 }}>{u.usuario}</code>
                    </td>
                    <td>{u.correo}</td>
                    <td>
                      <span className="badge badge-info">{u.rol?.nombre ?? '—'}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            u.estado === 'activo' ? '#d1fae5' : u.estado === 'inactivo' ? '#fee2e2' : '#fef3c7',
                          color: u.estado === 'activo' ? '#065f46' : u.estado === 'inactivo' ? '#991b1b' : '#92400e',
                        }}
                      >
                        {etiquetaEstado(u.estado)}
                      </span>
                    </td>
                    <td data-label="Acciones">
                        <button type="button" className="btn btn-secondary" onClick={() => abrirEditar(u)}>
                          ✏️ Editar
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalAbierto && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2100,
              padding: '1rem',
            }}
            onClick={cerrarModal}
            role="presentation"
          >
            <div
              className="card modal-form-shell"
              style={{ maxWidth: 440, width: '100%', margin: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-usuarios-titulo"
            >
              <h2 id="modal-usuarios-titulo" style={{ marginTop: 0 }}>
                {editando ? 'Editar usuario' : 'Nuevo usuario'}
              </h2>
              <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                  <div>
                    <label className="form-label" htmlFor="uu-nombre">
                      Nombre
                    </label>
                    <input
                      id="uu-nombre"
                      className="form-input"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="uu-usuario">
                      Usuario (login)
                    </label>
                    <input
                      id="uu-usuario"
                      className="form-input"
                      value={usuarioLogin}
                      onChange={(e) => setUsuarioLogin(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="uu-correo">
                      Correo
                    </label>
                    <input
                      id="uu-correo"
                      type="email"
                      className="form-input"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="uu-password">
                      Contraseña {editando ? '(vacío = sin cambio)' : ''}
                    </label>
                    <input
                      id="uu-password"
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={editando ? 'new-password' : 'new-password'}
                      required={!editando}
                      minLength={editando ? undefined : 6}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="uu-rol">
                      Rol
                    </label>
                    <select id="uu-rol" className="form-input" value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                      <option value="">— Elegir —</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="uu-estado">
                      Estado
                    </label>
                    <select
                      id="uu-estado"
                      className="form-input"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as EstadoUsuarioUniforme)}
                    >
                      {ESTADOS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formError && (
                    <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.95rem' }} role="alert">
                      {formError}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={guardando}>
                      {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}
