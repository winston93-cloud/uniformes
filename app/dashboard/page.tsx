'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import TarjetaInsumosFaltantes from '@/components/TarjetaInsumosFaltantes';
import TarjetaAlertasStock from '@/components/TarjetaAlertasStock';
import TarjetaAlertasStockPrendas from '@/components/TarjetaAlertasStockPrendas';
import UserCard from '@/components/UserCard';

export default function Dashboard() {
  const { sesion, loading, sesionError, recargarSesion } = useAuth();
  const [tarjetaExpandida, setTarjetaExpandida] = useState<'insumos' | 'alertas' | 'prendas' | null>(null);

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
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
          Cargando…
        </div>
      </div>
    );
  }

  if (!sesion) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center', color: 'white', maxWidth: '520px' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>No se pudo cargar la sucursal por defecto (matriz).</p>
          <p style={{ fontSize: '0.95rem', opacity: 0.92, marginBottom: '1rem', lineHeight: 1.5 }}>
            {sesionError ??
              'Comprueba en Vercel que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY correspondan a este proyecto. Tras superar el límite de egress o cambiar de plan, a veces hace falta republicar o revisar la clave anon en Supabase → Settings → API.'}
          </p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: '1.25rem', lineHeight: 1.45 }}>
            Opcional: en Vercel añade <code style={{ background: 'rgba(255,255,255,0.15)', padding: '0.15rem 0.35rem', borderRadius: 4 }}>NEXT_PUBLIC_DEFAULT_SUCURSAL_ID</code> con el UUID de la matriz (tabla sucursales en Supabase) para que arranque aunque falle la consulta.
          </p>
          <button
            type="button"
            onClick={() => void recargarSesion()}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: 'white',
              color: '#5b21b6',
            }}
          >
            Reintentar
          </button>
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
              height: auto !important;
              margin-bottom: 2rem !important;
            }
            .modulos-vip-grid > div {
              flex: 1 1 100% !important;
              min-width: 100% !important;
              height: auto !important;
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

          <UserCard />

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
              color: '#1f2937',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
            }}>
              Ciclos Escolares
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: '#374151',
              fontWeight: '500',
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

          {/* Módulo de Insumos */}
          <Link 
            href="/modulo-insumos" 
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
              Gestión completa de materiales, presentaciones e inventario
            </p>
          </Link>

          {/* Módulo de Producción Semanal - Módulo especial (acceso restringido) */}
          <Link 
            href="/produccion-semanal" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7986cb 0%, #5c6bc0 100%)',
              border: '2px solid rgba(121, 134, 203, 0.4)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                fontSize: '1.5rem',
                zIndex: 10,
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '8px',
                padding: '0.25rem 0.4rem',
                lineHeight: 1,
              }}
              title="Módulo especial - acceso restringido"
            >
              🔒
            </div>
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
              📅
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Módulo de Producción Semanal
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Planificación y seguimiento de la producción semanal
            </p>
          </Link>
        </div>
      </div>
    </LayoutWrapper>
  );
}
