'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import TarjetaInsumosFaltantes from '@/components/TarjetaInsumosFaltantes';
import TarjetaAlertasStock from '@/components/TarjetaAlertasStock';

export default function Dashboard() {
  const [tarjetaExpandida, setTarjetaExpandida] = useState<'insumos' | 'alertas' | null>(null);

  const handleToggleInsumos = () => {
    setTarjetaExpandida(prev => prev === 'insumos' ? null : 'insumos');
  };

  const handleToggleAlertas = () => {
    setTarjetaExpandida(prev => prev === 'alertas' ? null : 'alertas');
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 className="page-title">
          Sistema de Uniformes Winston Churchill
          <span className="title-icon">✨</span>
        </h1>

        {/* ⭐ MÓDULOS PRINCIPALES VIP - Layout 2 Columnas (responsive) ⭐ */}
        <div 
          className="modulos-vip-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
            width: '100%',
          }}
        >
          {/* Insumos Necesarios para Producción */}
          <div style={{ width: '100%', minWidth: 0 }}>
            <TarjetaInsumosFaltantes 
              expandido={tarjetaExpandida === 'insumos'}
              onToggle={handleToggleInsumos}
            />
          </div>
          
          {/* Alertas de Stock Mínimo */}
          <div style={{ width: '100%', minWidth: 0 }}>
            <TarjetaAlertasStock 
              expandido={tarjetaExpandida === 'alertas'}
              onToggle={handleToggleAlertas}
            />
          </div>
        </div>

        <div className="cards-grid">
          {/* Presentaciones */}
          <Link href="/presentaciones" className="card">
            <div className="card-icon blue">
              📦
            </div>
            <h3 className="card-title">Presentaciones</h3>
            <p className="card-description">
              Unidades de medida y presentaciones para insumos
            </p>
          </Link>

          {/* Insumos */}
          <Link href="/insumos" className="card">
            <div className="card-icon purple">
              🧵
            </div>
            <h3 className="card-title">Insumos</h3>
            <p className="card-description">
              Catálogo de materiales e insumos para fabricación de prendas
            </p>
          </Link>

          {/* Tallas */}
          <Link href="/tallas" className="card">
            <div className="card-icon orange">
              📏
            </div>
            <h3 className="card-title">Tallas</h3>
            <p className="card-description">
              Gestión y configuración de tallas disponibles para uniformes
            </p>
          </Link>

          {/* Prendas */}
          <Link href="/prendas" className="card">
            <div className="card-icon purple">
              👕
            </div>
            <h3 className="card-title">Prendas</h3>
            <p className="card-description">
              Catálogo completo de prendas y uniformes escolares
            </p>
          </Link>

          {/* Costos */}
          <Link href="/costos" className="card">
            <div className="card-icon green">
              💰
            </div>
            <h3 className="card-title">Costos</h3>
            <p className="card-description">
              Administración de precios y costos por talla y prenda
            </p>
          </Link>

          {/* Stock */}
          <Link href="/stock" className="card">
            <div className="card-icon yellow">
              📦
            </div>
            <h3 className="card-title">Stock</h3>
            <p className="card-description">
              Asignación y gestión de stock inicial por prenda y talla
            </p>
          </Link>

          {/* Pedidos */}
          <Link href="/pedidos" className="card">
            <div className="card-icon blue">
              🛒
            </div>
            <h3 className="card-title">Pedidos</h3>
            <p className="card-description">
              Gestión de pedidos de alumnos y clientes externos
            </p>
          </Link>

          {/* Inventario */}
          <Link href="/inventario" className="card">
            <div className="card-icon yellow">
              📦
            </div>
            <h3 className="card-title">Inventario</h3>
            <p className="card-description">
              Control de stock y movimientos de inventario
            </p>
          </Link>

          {/* Alumnos */}
          <Link href="/alumnos" className="card">
            <div className="card-icon purple">
              👨‍🎓
            </div>
            <h3 className="card-title">Alumnos</h3>
            <p className="card-description">
              Registro y gestión de estudiantes del instituto
            </p>
          </Link>

          {/* Clientes Externos */}
          <Link href="/externos" className="card">
            <div className="card-icon blue">
              👤
            </div>
            <h3 className="card-title">Clientes Externos</h3>
            <p className="card-description">
              Gestión de clientes externos y público general
            </p>
          </Link>

          {/* Cortes de Caja */}
          <Link href="/cortes" className="card">
            <div className="card-icon green">
              💵
            </div>
            <h3 className="card-title">Cortes de Caja</h3>
            <p className="card-description">
              Control y registro de cortes de caja diarios
            </p>
          </Link>

          {/* Reportes */}
          <Link href="/reportes" className="card">
            <div className="card-icon orange">
              📈
            </div>
            <h3 className="card-title">Reportes y Estadísticas</h3>
            <p className="card-description">
              Análisis de datos y reportes ejecutivos
            </p>
          </Link>
        </div>
      </div>
    </LayoutWrapper>
  );
}
