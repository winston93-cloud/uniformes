/** Módulos operativos: misma fuente para menú lateral y tarjetas del dashboard. */

export type ModuloNavegacion = {
  href: string;
  label: string;
  icon: string;
  adminOnly: boolean;
  /** Rutas hijas que también marcan el ítem como activo en el menú */
  rutasActivas?: string[];
};

/** Orden alineado con las tarjetas del dashboard (sin «Actualizar base de datos», acción aparte). */
export const MODULOS_MENU_LATERAL: ModuloNavegacion[] = [
  { href: '/pedidos', label: 'Pedidos', icon: '🛒', adminOnly: true },
  { href: '/tallas', label: 'Tallas', icon: '📏', adminOnly: true },
  { href: '/prendas', label: 'Prendas', icon: '👕', adminOnly: true },
  { href: '/costos', label: 'Costos', icon: '💰', adminOnly: true },
  {
    href: '/modulo-insumos',
    label: 'Insumos',
    icon: '🧵',
    adminOnly: true,
    rutasActivas: ['/insumos', '/presentaciones', '/inventario-insumos', '/ubicaciones-almacenamiento'],
  },
  { href: '/alumnos', label: 'Alumnos', icon: '👨‍🎓', adminOnly: true },
  { href: '/externos', label: 'Clientes Externos', icon: '👤', adminOnly: true },
  { href: '/sucursales', label: 'Sucursales', icon: '🏢', adminOnly: true },
  { href: '/transferencias', label: 'Transferencias', icon: '🚚', adminOnly: true },
  { href: '/usuarios', label: 'Usuarios', icon: '👥', adminOnly: true },
  { href: '/cortes', label: 'Cortes de Caja', icon: '💵', adminOnly: true },
  { href: '/ciclos-escolares', label: 'Ciclos Escolares', icon: '📚', adminOnly: true },
  { href: '/reportes', label: 'Reportes', icon: '📈', adminOnly: true },
  { href: '/produccion-semanal', label: 'Producción Semanal', icon: '📅', adminOnly: true },
];

export function moduloMenuActivo(pathname: string, item: ModuloNavegacion): boolean {
  if (pathname === item.href) return true;
  return item.rutasActivas?.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ?? false;
}
