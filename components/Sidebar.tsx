'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { esAdministrador } from '@/lib/permisos';
import { MODULOS_MENU_LATERAL, moduloMenuActivo } from '@/lib/modulosNavegacion';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { sesion } = useAuth();
  const admin = esAdministrador(sesion);
  const modulos = MODULOS_MENU_LATERAL.filter((item) => !item.adminOnly || admin);

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Sistema de Uniformes</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Instituto Winston Churchill
          </p>
        </div>

        <nav className="sidebar-menu">
          <Link
            href="/dashboard"
            className={`sidebar-menu-item ${pathname === '/dashboard' ? 'active' : ''}`}
            onClick={onClose}
          >
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <span>Dashboard</span>
          </Link>

          {modulos.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-menu-item ${moduloMenuActivo(pathname, item) ? 'active' : ''}`}
              onClick={onClose}
            >
              <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
