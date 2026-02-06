'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import TarjetaInsumosFaltantes from '@/components/TarjetaInsumosFaltantes';
import TarjetaAlertasStock from '@/components/TarjetaAlertasStock';
import TarjetaAlertasStockPrendas from '@/components/TarjetaAlertasStockPrendas';

export default function Dashboard() {
  const router = useRouter();
  const { sesion, loading } = useAuth();
  const [tarjetaExpandida, setTarjetaExpandida] = useState<'insumos' | 'alertas' | 'prendas' | null>(null);

  // Protección de ruta: redirigir a login si no hay sesión
  useEffect(() => {
    if (!loading && !sesion) {
      router.push('/login');
    }
  }, [sesion, loading, router]);

  const handleToggleInsumos = () => {
    setTarjetaExpandida(prev => prev === 'insumos' ? null : 'insumos');
  };

  const handleToggleAlertas = () => {
    setTarjetaExpandida(prev => prev === 'alertas' ? null : 'alertas');
  };

  const handleTogglePrendas = () => {
    setTarjetaExpandida(prev => prev === 'prendas' ? null : 'prendas');
  };

  // Mostrar loading mientras verifica sesión
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white',
          fontSize: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          Verificando sesión...
        </div>
      </div>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 className="page-title">
          Sistema de Uniformes Winston Churchill
          <span className="title-icon">✨</span>
        </h1>

        {/* ⭐ MÓDULOS PRINCIPALES VIP - Layout Dinámico con 3 Tarjetas ⭐ */}
        <div 
          className="modulos-vip-grid"
          style={{
            display: 'flex',
            flexWrap: 'nowrap', // No envolver, mantener en una fila
            gap: '1.5rem',
            marginBottom: '2rem',
            width: '100%',
            alignItems: 'stretch',
            height: tarjetaExpandida ? 'auto' : '280px', // Altura fija cuando no expandido
          }}
        >
          {/* Insumos Necesarios para Producción */}
          <div style={{ 
            flex: tarjetaExpandida === 'insumos' ? '1 1 100%' : 
                  tarjetaExpandida ? '0 0 auto' :
                  '1 1 calc(33.333% - 1rem)',
            minWidth: (tarjetaExpandida && tarjetaExpandida !== 'insumos') ? '100px' : '320px',
            transition: 'all 0.3s ease',
            height: '100%',
          }}>
            <TarjetaInsumosFaltantes 
              expandido={tarjetaExpandida === 'insumos'}
              minimizado={!!tarjetaExpandida && tarjetaExpandida !== 'insumos'}
              onToggle={handleToggleInsumos}
            />
          </div>
          
          {/* Alertas de Stock Mínimo - Insumos */}
          <div style={{ 
            flex: tarjetaExpandida === 'alertas' ? '1 1 100%' : 
                  tarjetaExpandida ? '0 0 auto' :
                  '1 1 calc(33.333% - 1rem)',
            minWidth: (tarjetaExpandida && tarjetaExpandida !== 'alertas') ? '100px' : '320px',
            transition: 'all 0.3s ease',
            height: '100%',
          }}>
            <TarjetaAlertasStock 
              expandido={tarjetaExpandida === 'alertas'}
              minimizado={!!tarjetaExpandida && tarjetaExpandida !== 'alertas'}
              onToggle={handleToggleAlertas}
            />
          </div>

          {/* Alertas de Stock Mínimo - Prendas */}
          <div style={{ 
            flex: tarjetaExpandida === 'prendas' ? '1 1 100%' : 
                  tarjetaExpandida ? '0 0 auto' :
                  '1 1 calc(33.333% - 1rem)',
            minWidth: (tarjetaExpandida && tarjetaExpandida !== 'prendas') ? '100px' : '320px',
            transition: 'all 0.3s ease',
            height: '100%',
          }}>
            <TarjetaAlertasStockPrendas 
              expandido={tarjetaExpandida === 'prendas'}
              minimizado={!!tarjetaExpandida && tarjetaExpandida !== 'prendas'}
              onToggle={handleTogglePrendas}
              sucursalId={sesion?.sucursal_id}
            />
          </div>
        </div>

        {/* Media Query para móvil */}
        <style jsx>{`
          @media (max-width: 1024px) {
            .modulos-vip-grid {
              flex-wrap: wrap !important;
            }
            .modulos-vip-grid > div {
              flex: 1 1 100% !important;
              min-width: 100% !important;
            }
          }
        `}</style>

        <div className="cards-grid">
          {/* Pedidos - Tarjeta Destacada */}
          <Link 
            href="/pedidos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: '#1f2937',
              transform: 'scale(1.15)',
              transformOrigin: 'center',
              boxShadow: '0 10px 30px rgba(251, 191, 36, 0.5)',
              border: '3px solid rgba(255, 255, 255, 0.5)',
              zIndex: 1,
            }}
          >
            <div 
              style={{
                fontSize: '3rem',
                background: 'rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              🛒
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
              color: '#1f2937',
            }}>
              Pedidos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '1rem',
              color: '#374151',
              fontWeight: '500',
            }}>
              Gestión de pedidos de alumnos y clientes externos
            </p>
          </Link>

          {/* Tallas - Módulo de Productos */}
          <Link 
            href="/tallas" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #b19cd9 0%, #9370db 100%)',
              border: '2px solid rgba(177, 156, 217, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📏
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Tallas
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Gestión y configuración de tallas disponibles para uniformes
            </p>
          </Link>

          {/* Prendas - Módulo de Productos */}
          <Link 
            href="/prendas" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #b19cd9 0%, #9370db 100%)',
              border: '2px solid rgba(177, 156, 217, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              👕
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Prendas
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Catálogo completo de prendas y uniformes escolares
            </p>
          </Link>

          {/* Costos - Módulo de Productos */}
          <Link 
            href="/costos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #b19cd9 0%, #9370db 100%)',
              border: '2px solid rgba(177, 156, 217, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              💰
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Costos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Administración de precios y costos por talla y prenda
            </p>
          </Link>

          {/* Stock - Módulo de Productos */}
          <Link 
            href="/stock" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #b19cd9 0%, #9370db 100%)',
              border: '2px solid rgba(177, 156, 217, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📦
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Stock
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Asignación y gestión de stock inicial por prenda y talla
            </p>
          </Link>

          {/* Inventario - Módulo de Productos */}
          <Link 
            href="/inventario" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #b19cd9 0%, #9370db 100%)',
              border: '2px solid rgba(177, 156, 217, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📦
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Inventario
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Control de stock y movimientos de inventario
            </p>
          </Link>

          {/* Alumnos - Módulo de Clientes */}
          <Link 
            href="/alumnos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #6ba3d8 0%, #4a8cc7 100%)',
              border: '2px solid rgba(107, 163, 216, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              👨‍🎓
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Alumnos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Registro y gestión de estudiantes del instituto
            </p>
          </Link>

          {/* Clientes Externos - Módulo de Clientes */}
          <Link 
            href="/externos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #6ba3d8 0%, #4a8cc7 100%)',
              border: '2px solid rgba(107, 163, 216, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              👤
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Clientes Externos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Gestión de clientes externos y público general
            </p>
          </Link>

          {/* Sucursales - Módulo Multi-Sucursal */}
          <Link 
            href="/sucursales" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #f09090 0%, #e57373 100%)',
              border: '2px solid rgba(240, 144, 144, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              🏢
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Sucursales
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Catálogo y gestión de sucursales del sistema
            </p>
          </Link>

          {/* Transferencias - Módulo Multi-Sucursal */}
          <Link 
            href="/transferencias" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #f09090 0%, #e57373 100%)',
              border: '2px solid rgba(240, 144, 144, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              🚚
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Transferencias
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Traspaso de mercancía entre sucursales
            </p>
          </Link>

          {/* Cortes de Caja - Módulo Financiero */}
          <Link 
            href="/cortes" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #66d9a6 0%, #50c878 100%)',
              border: '2px solid rgba(102, 217, 166, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              💵
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Cortes de Caja
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Control y registro de cortes de caja diarios
            </p>
          </Link>

          {/* Ciclos Escolares - Módulo de Configuración */}
          <Link 
            href="/ciclos-escolares" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #fff59d 0%, #ffeb3b 100%)',
              border: '2px solid rgba(255, 245, 157, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📚
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Ciclos Escolares
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Catálogo y gestión de ciclos escolares
            </p>
          </Link>

          {/* Reportes y Estadísticas - Módulo de Análisis */}
          <Link 
            href="/reportes" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #ffb366 0%, #ff9933 100%)',
              border: '2px solid rgba(255, 179, 102, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📈
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Reportes y Estadísticas
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Análisis de datos y reportes ejecutivos
            </p>
          </Link>

          {/* Presentaciones - Módulo de Insumos */}
          <Link 
            href="/presentaciones" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7dd3c0 0%, #5fb8a6 100%)',
              border: '2px solid rgba(127, 211, 192, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📦
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Presentaciones
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Unidades de medida y presentaciones para insumos
            </p>
          </Link>

          {/* Insumos - Módulo de Insumos */}
          <Link 
            href="/insumos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7dd3c0 0%, #5fb8a6 100%)',
              border: '2px solid rgba(127, 211, 192, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              🧵
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Insumos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Catálogo de materiales e insumos para fabricación de prendas
            </p>
          </Link>
        </div>
      </div>
    </LayoutWrapper>
  );
}
