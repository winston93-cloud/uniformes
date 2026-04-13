'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';

/**
 * Tarjeta del dashboard hacia la gobernanza de usuarios (tabla usuarios_uniformes).
 */
export default function UserCard() {
  return (
    <Link
      href="/usuarios"
      className="card"
      style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
        border: '2px solid rgba(13, 148, 136, 0.45)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: '2.5rem',
          background: 'rgba(255, 255, 255, 0.22)',
          borderRadius: '12px',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
        }}
      >
        <Users size={32} color="white" strokeWidth={2} aria-hidden />
      </div>
      <h3
        style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.3rem',
          fontWeight: '600',
          color: 'white',
        }}
      >
        Usuarios
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: '0.95rem',
          color: 'rgba(255, 255, 255, 0.92)',
        }}
      >
        Perfiles y roles del sistema (base para login y gobernanza)
      </p>
    </Link>
  );
}
