import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 className="page-title">
          Sistema de Uniformes Winston Churchill
          <span className="title-icon">✨</span>
        </h1>

        <div className="cards-grid">
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
