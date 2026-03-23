'use client';

import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import { Inter, Poppins } from 'next/font/google';
import styles from './produccion.module.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ weight: ['600', '700'], subsets: ['latin'], variable: '--font-poppins' });

export default function ProduccionSemanalPage() {
  useAuth(); // Mantener sesión para protección de ruta si se añade

  return (
    <LayoutWrapper>
      <div className={`main-container ${inter.variable} ${poppins.variable} ${inter.className}`}>
        <article className={styles.wrapper} role="main">
          {/* Header con badge En Desarrollo */}
          <header className={styles.header}>
            <h1 className={styles.title}>
              <span aria-hidden="true">📅</span>
              Módulo de Producción Semanal
            </h1>
            <p className={styles.subtitle}>
              Planificación y seguimiento de la producción semanal
            </p>
            <div className={styles.badgeWrapper}>
              <span
                className={styles.badge}
                title="Este módulo está en desarrollo. Próximamente incluirá: registro de entrada/salida de insumos, calendario semanal, métricas y reportes de producción."
                aria-label="Módulo en desarrollo. Más información disponible al pasar el cursor."
              >
                🚧 En Desarrollo
              </span>
            </div>
          </header>

          {/* Botón Volver - estilo shadcn Button */}
          <div style={{ textAlign: 'center' }}>
            <Link
              href="/dashboard"
              className={styles.backButton}
              aria-label="Volver al panel principal del sistema"
            >
              ← Volver al Panel Principal
            </Link>
          </div>

          {/* KPIs teaser - placeholders visuales */}
          <section className={styles.kpiRow} aria-label="Métricas de producción">
            <div className={`${styles.kpiCard} ${styles.animateIn} ${styles.animateInDelay1}`}>
              <p className={styles.kpiLabel}>Insumos esta semana</p>
              <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ height: '1.75rem', margin: '0 auto' }} />
            </div>
            <div className={`${styles.kpiCard} ${styles.animateIn} ${styles.animateInDelay2}`}>
              <p className={styles.kpiLabel}>Prendas terminadas</p>
              <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ height: '1.75rem', margin: '0 auto' }} />
            </div>
            <div className={`${styles.kpiCard} ${styles.animateIn} ${styles.animateInDelay3}`}>
              <p className={styles.kpiLabel}>En producción</p>
              <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ height: '1.75rem', margin: '0 auto' }} />
            </div>
          </section>

          {/* Bento Grid - Tarjetas Entrada / Salida */}
          <section className={styles.bentoGrid} aria-label="Acciones de producción">
            {/* Tarjeta Entrada */}
            <a
              href="#"
              className={`${styles.card} ${styles.cardEntrada} ${styles.animateIn} ${styles.animateInDelay2}`}
              onClick={(e) => e.preventDefault()}
              aria-label="Registro de entrada: insumos y materiales que ingresan a producción"
              tabIndex={0}
            >
              <div className={styles.cardIcon} aria-hidden="true">
                📥
              </div>
              <h2 className={styles.cardTitle}>Entrada</h2>
              <p className={styles.cardDesc}>
                Registro de insumos y materiales que ingresan a producción
              </p>
            </a>

            {/* Tarjeta Salida */}
            <a
              href="#"
              className={`${styles.card} ${styles.cardSalida} ${styles.animateIn} ${styles.animateInDelay3}`}
              onClick={(e) => e.preventDefault()}
              aria-label="Registro de salida: prendas terminadas y productos que salen de producción"
              tabIndex={0}
            >
              <div className={styles.cardIcon} aria-hidden="true">
                📤
              </div>
              <h2 className={styles.cardTitle}>Salida</h2>
              <p className={styles.cardDesc}>
                Registro de prendas terminadas y productos que salen de producción
              </p>
            </a>
          </section>

          {/* Teaser: Calendario semanal placeholder */}
          <section className={styles.teaserSection}>
            <h3 className={styles.teaserTitle}>Calendario semanal (próximamente)</h3>
            <div className={`${styles.skeleton} ${styles.skeletonCalendar}`} />
          </section>

          {/* Teaser: Tabla de producción placeholder */}
          <section className={styles.teaserSection}>
            <h3 className={styles.teaserTitle}>Vista de producción (próximamente)</h3>
            <div className={`${styles.skeleton} ${styles.skeletonTable}`} />
          </section>

          <p className={styles.footerText}>
            Módulo en desarrollo — funcionalidades próximamente
          </p>
        </article>
      </div>
    </LayoutWrapper>
  );
}
