'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sesion, loading, iniciarSesion, sesionError } = useAuth();

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((r) => r.json())
      .then((d: { needsSetup?: boolean }) => setNeedsSetup(Boolean(d.needsSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (!loading && sesion) {
      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    }
  }, [loading, sesion, router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setEnviando(true);
    try {
      const r = await iniciarSesion(usuario.trim(), password);
      if (!r.ok) {
        setErrorLocal(r.message ?? 'Error al iniciar sesión.');
        return;
      }
      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    } finally {
      setEnviando(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          usuario: usuario.trim(),
          correo: correo.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setErrorLocal(data.message ?? 'No se pudo crear el administrador.');
        return;
      }
      window.location.href = '/dashboard';
    } finally {
      setEnviando(false);
    }
  };

  if (loading || needsSetup === null) {
    return (
      <div className="login-shell">
        <p className="login-loading">Cargando…</p>
      </div>
    );
  }

  const error = errorLocal ?? sesionError;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <GraduationCap size={40} strokeWidth={2} aria-hidden />
          <div>
            <h1>Sistema de Uniformes</h1>
            <p>Winston Churchill</p>
          </div>
        </div>

        {needsSetup ? (
          <>
            <h2 className="login-title">Primer administrador</h2>
            <p className="login-hint">No hay usuarios en el sistema. Crea la cuenta de administrador.</p>
            <form onSubmit={handleBootstrap} className="login-form">
              <label>
                Nombre completo
                <input className="form-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
              </label>
              <label>
                Usuario (login)
                <input className="form-input" value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoComplete="username" />
              </label>
              <label>
                Correo
                <input type="email" className="form-input" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" />
              </label>
              <label>
                Contraseña
                <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </label>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
                {enviando ? 'Creando…' : 'Crear administrador e ingresar'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="login-title">Iniciar sesión</h2>
            <form onSubmit={handleLogin} className="login-form">
              <label>
                Usuario
                <input className="form-input" value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoComplete="username" />
              </label>
              <label>
                Contraseña
                <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </label>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </>
        )}
      </div>

      <style jsx>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .login-loading {
          color: white;
          font-size: 1.1rem;
        }
        .login-card {
          width: min(420px, 100%);
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          color: #4338ca;
        }
        .login-brand h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: #1e1b4b;
        }
        .login-brand p {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
          color: #6366f1;
          font-weight: 600;
        }
        .login-title {
          margin: 0 0 0.5rem;
          font-size: 1.35rem;
          color: #0f172a;
        }
        .login-hint {
          margin: 0 0 1.25rem;
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .login-form label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #334155;
        }
        .login-error {
          margin: 0;
          color: #b91c1c;
          font-size: 0.9rem;
        }
        .login-submit {
          width: 100%;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
}
