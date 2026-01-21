// Tipos para el sistema de uniformes

export interface Talla {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoriaPrenda {
  id: string;
  nombre: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Prenda {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  categoria_id: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  categoria?: CategoriaPrenda;
}

export interface Costo {
  id: string;
  talla_id: string;
  prenda_id: string;
  precio_venta: number;
  precio_compra?: number;
  stock_inicial: number;
  stock: number;
  cantidad_venta: number;
  stock_minimo: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  talla?: Talla;
  prenda?: Prenda;
}

export interface Alumno {
  id: string;
  nombre: string;
  referencia: string;
  grado: string | null;
  grupo: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Externo {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Pedido {
  id: string;
  alumno_id: string | null;
  externo_id: string | null;
  tipo_cliente: 'alumno' | 'externo';
  estado: 'PEDIDO' | 'ENTREGADO' | 'LIQUIDADO' | 'CANCELADO';
  subtotal: number;
  total: number;
  fecha_entrega: string | null;
  fecha_liquidacion: string | null;
  notas: string | null;
  usuario_id: string | null;
  created_at?: string;
  updated_at?: string;
  alumno?: Alumno;
  externo?: Externo;
}

export interface DetallePedido {
  id: string;
  pedido_id: string;
  costo_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at?: string;
  costo?: Costo;
}

export interface Movimiento {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  costo_id: string;
  cantidad: number;
  observaciones: string | null;
  usuario_id: string | null;
  created_at?: string;
  costo?: Costo;
}

export interface Corte {
  id: string;
  fecha: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas: number;
  total_pedidos: number;
  usuario_id: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Presentacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  presentacion_id: string;
  cantidad_por_presentacion: number; // ej: 500 botones en una bolsa
  stock_minimo?: number; // Cantidad mínima de stock para alertas
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  presentacion?: Presentacion;
}

