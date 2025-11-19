'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/tallas', label: 'Tallas', icon: '📏' },
  { href: '/prendas', label: 'Prendas', icon: '👕' },
  { href: '/costos', label: 'Costos y Precios', icon: '💰' },
  { href: '/pedidos', label: 'Pedidos', icon: '🛒' },
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/alumnos', label: 'Alumnos', icon: '👨‍🎓' },
  { href: '/externos', label: 'Clientes Externos', icon: '👤' },
  { href: '/cortes', label: 'Cortes de Caja', icon: '💵' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

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
          {menuItems.map((item) => (
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

