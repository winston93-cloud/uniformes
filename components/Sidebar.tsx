'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { esAdministrador } from '@/lib/permisos';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', adminOnly: false },
  { href: '/insumos', label: 'Insumos', icon: '🧵', adminOnly: true },
  { href: '/tallas', label: 'Tallas', icon: '📏', adminOnly: true },
  { href: '/prendas', label: 'Prendas', icon: '👕', adminOnly: true },
  { href: '/costos', label: 'Costos', icon: '💰', adminOnly: true },
  { href: '/stock', label: 'Stock', icon: '📦', adminOnly: true },
  { href: '/pedidos', label: 'Pedidos', icon: '🛒', adminOnly: true },
  { href: '/inventario', label: 'Inventario', icon: '📦', adminOnly: true },
  { href: '/alumnos', label: 'Alumnos', icon: '👨‍🎓', adminOnly: true },
  { href: '/externos', label: 'Clientes Externos', icon: '👤', adminOnly: true },
  { href: '/usuarios', label: 'Usuarios', icon: '👥', adminOnly: true },
  { href: '/cortes', label: 'Cortes de Caja', icon: '💵', adminOnly: true },
  { href: '/reportes', label: 'Reportes', icon: '📈', adminOnly: true },
  { href: '/produccion-semanal', label: 'Producción Semanal', icon: '📅', adminOnly: true },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { sesion } = useAuth();
  const admin = esAdministrador(sesion);
  const items = menuItems.filter((item) => !item.adminOnly || admin);

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
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-menu-item ${pathname === item.href ? 'active' : ''}`}
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

