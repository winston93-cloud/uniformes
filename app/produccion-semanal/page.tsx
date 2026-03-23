'use client';

import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import { Fira_Sans } from 'next/font/google';
import {
  Calendar,
  ArrowLeft,
  LogIn,
  LogOut,
  Wrench,
} from 'lucide-react';
import styles from './produccion.module.css';

const firaSans = Fira_Sans({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-fira',
});

export default function ProduccionSemanalPage() {
  const { sesion } = useAuth();

  return (
    <LayoutWrapper>
      <div className={`main-container ${firaSans.variable} ${firaSans.className}`}>
        <article className={styles.wrapper} role="main">
          {/* Header con badge En Desarrollo */}
          <header className={styles.header}>
            <h1 className={styles.title}>
              <Calendar size={28} strokeWidth={2} aria-hidden />
              Módulo de Producción Semanal
            </h1>
            <p className={styles.subtitle}>
              Planificación y seguimiento de la producción semanal
            </p>
            <div className={styles.badgeWrapper}>
              <span
                className={styles.badge}
                title="Este módulo está en desarrollo. Próximamente: registro entrada/salida, calendario semanal, métricas y reportes."
                aria-label="Módulo en desarrollo. Más información al pasar el cursor."
              >
                <Wrench size={14} aria-hidden />
                En Desarrollo
              </span>
            </div>
          </header>

          {/* Botón Volver */}
          <div style={{ textAlign: 'center' }}>
            <Link
              href="/dashboard"
              className={styles.backButton}
              aria-label="Volver al panel principal del sistema"
            >
              <ArrowLeft size={18} aria-hidden />
              Volver al Panel Principal
            </Link>
          </div>

          {/* KPIs con métricas visuales */}
          <section className={styles.kpiRow} aria-label="Métricas de producción">
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Insumos esta semana</p>
              <div className={styles.kpiValue} aria-busy="true">
                —
              </div>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Prendas terminadas</p>
              <div className={styles.kpiValue} aria-busy="true">
                —
              </div>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>En producción</p>
              <div className={styles.kpiValue} aria-busy="true">
                —
              </div>
            </div>
          </section>

          {/* Tarjetas Entrada / Salida — Claymorphism con iconos SVG */}
          <section className={styles.bentoGrid} aria-label="Acciones de producción">
            <a
              href="#"
              className={`${styles.card} ${styles.cardEntrada}`}
              onClick={(e) => e.preventDefault()}
              aria-label="Registro de entrada: insumos y materiales que ingresan a producción"
              tabIndex={0}
            >
              <div className={styles.cardIcon} aria-hidden>
                <LogIn size={22} strokeWidth={2.5} />
              </div>
              <h2 className={styles.cardTitle}>Entrada</h2>
              <p className={styles.cardDesc}>
                Registro de insumos y materiales que ingresan a producción
              </p>
              <p className={styles.cardMetric} aria-hidden>
                —
              </p>
            </a>

            <a
              href="#"
              className={`${styles.card} ${styles.cardSalida}`}
              onClick={(e) => e.preventDefault()}
              aria-label="Registro de salida: prendas terminadas y productos que salen de producción"
              tabIndex={0}
            >
              <div className={styles.cardIcon} aria-hidden>
                <LogOut size={22} strokeWidth={2.5} />
              </div>
              <h2 className={styles.cardTitle}>Salida</h2>
              <p className={styles.cardDesc}>
                Registro de prendas terminadas y productos que salen de producción
              </p>
              <p className={styles.cardMetric} aria-hidden>
                —
              </p>
            </a>
          </section>

          {/* Calendario semanal — skeleton visual atractivo */}
          <section className={styles.calendarSection} aria-label="Calendario semanal">
            <h3 className={styles.sectionTitle}>Calendario semanal (próximamente)</h3>
            <div className={styles.calendarSkeleton}>
              <div className={styles.calendarHeader}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className={styles.calendarDayLabel} />
                ))}
              </div>
              <div className={styles.calendarGrid}>
                {Array.from({ length: 21 }).map((_, i) => (
                  <div key={i} className={styles.calendarCell} />
                ))}
              </div>
            </div>
          </section>

          {/* Tabla de producción skeleton */}
          <section aria-label="Vista de producción">
            <h3 className={styles.sectionTitle}>Vista de producción (próximamente)</h3>
            <div className={styles.tableSkeleton}>
              <div className={styles.tableRow}>
                <div className={styles.tableCell} style={{ flex: 2 }} />
                <div className={styles.tableCell} />
                <div className={styles.tableCell} />
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell} style={{ flex: 2 }} />
                <div className={styles.tableCell} />
                <div className={styles.tableCell} />
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell} style={{ flex: 2 }} />
                <div className={styles.tableCell} />
                <div className={styles.tableCell} />
              </div>
            </div>
          </section>

          <p className={styles.footerText}>
            Módulo en desarrollo — funcionalidades próximamente
          </p>
        </article>
      </div>
    </LayoutWrapper>
  );
}
