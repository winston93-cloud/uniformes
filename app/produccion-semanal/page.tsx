'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Outfit, DM_Sans } from 'next/font/google';
import {
  Calendar,
  ArrowLeft,
  LogIn,
  LogOut,
  Wrench,
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import styles from './produccion.module.css';

const outfit = Outfit({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-outfit' });
const dmSans = DM_Sans({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-dm' });

// Get current week dates (Mon-Sun)
function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Mock trend data for mini chart
const TREND_DATA = [40, 65, 45, 80, 55, 70, 60];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export default function ProduccionSemanalPage() {
  const { sesion } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const weekDates = useMemo(getWeekDates, []);

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();


  return (
    <LayoutWrapper>
      <div
        className={`main-container ${outfit.variable} ${dmSans.variable}`}
        style={{ fontFamily: 'var(--font-dm), DM Sans, sans-serif' }}
      >
        <motion.article
          className={`${styles.wrapper} ${styles.panel}`}
          data-theme={darkMode ? 'dark' : 'light'}
          role="main"
          initial="initial"
          animate="animate"
          variants={stagger}
          style={{ fontFamily: 'var(--font-dm)' }}
        >
          {/* Theme toggle */}
          <motion.button
            className={styles.themeToggle}
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>

          <header className={styles.pageHeader}>
            <motion.h1 className={styles.title} variants={fadeUp} style={{ fontFamily: 'var(--font-outfit)' }}>
              <Calendar size={32} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} aria-hidden />
              Módulo de Producción Semanal
            </motion.h1>
            <motion.p className={styles.subtitle} variants={fadeUp}>
              Planificación y seguimiento de la producción semanal
            </motion.p>
            <motion.div variants={fadeUp}>
              <span
                className={styles.badge}
                title="Próximamente: registro entrada/salida, métricas en tiempo real, reportes."
                aria-label="Módulo en desarrollo"
              >
                <Wrench size={14} aria-hidden />
                En Desarrollo
              </span>
            </motion.div>
          </header>

          <div style={{ textAlign: 'center' }}>
            <motion.div variants={fadeUp}>
              <Link href="/dashboard" className={styles.backBtn} aria-label="Volver al panel">
                <ArrowLeft size={18} aria-hidden />
                Volver al Panel Principal
              </Link>
            </motion.div>
          </div>

          {/* KPI Cards with mini charts */}
          <motion.section className={styles.kpiGrid} aria-label="Métricas" variants={fadeUp}>
            <motion.div className={styles.kpiCard} variants={fadeUp} whileHover={{ y: -4 }}>
              <p className={styles.kpiLabel}>Insumos esta semana</p>
              <div className={styles.kpiValue}>—</div>
              <div className={styles.miniChart}>
                {TREND_DATA.map((h, i) => (
                  <motion.div
                    key={i}
                    className={styles.miniBar}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                  />
                ))}
              </div>
            </motion.div>
            <motion.div className={styles.kpiCard} variants={fadeUp} whileHover={{ y: -4 }}>
              <p className={styles.kpiLabel}>Prendas terminadas</p>
              <div className={styles.kpiValue}>—</div>
              <p className={`${styles.kpiTrend} ${styles.kpiTrendUp}`}>
                <TrendingUp size={14} /> Próximamente
              </p>
            </motion.div>
            <motion.div className={styles.kpiCard} variants={fadeUp} whileHover={{ y: -4 }}>
              <p className={styles.kpiLabel}>En producción</p>
              <div className={styles.kpiValue}>—</div>
              <p className={styles.kpiTrend}>
                <TrendingUp size={14} style={{ opacity: 0.5 }} /> —
              </p>
            </motion.div>
          </motion.section>

          {/* Action Cards */}
          <motion.section className={styles.cardsGrid} aria-label="Acciones" variants={fadeUp}>
            <motion.a
              href="#"
              className={`${styles.actionCard} ${styles.actionCardEntrada}`}
              onClick={(e) => e.preventDefault()}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              whileTap={{ scale: 0.99 }}
              aria-label="Registro de entrada"
            >
              <div className={styles.actionIcon}>
                <LogIn size={24} strokeWidth={2} />
              </div>
              <h2 className={styles.actionTitle} style={{ fontFamily: 'var(--font-outfit)' }}>
                Entrada
              </h2>
              <p className={styles.actionDesc}>
                Registro de insumos y materiales que ingresan a producción
              </p>
              <div className={styles.actionMetric}>—</div>
            </motion.a>

            <motion.a
              href="#"
              className={`${styles.actionCard} ${styles.actionCardSalida}`}
              onClick={(e) => e.preventDefault()}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              whileTap={{ scale: 0.99 }}
              aria-label="Registro de salida"
            >
              <div className={styles.actionIcon}>
                <LogOut size={24} strokeWidth={2} />
              </div>
              <h2 className={styles.actionTitle} style={{ fontFamily: 'var(--font-outfit)' }}>
                Salida
              </h2>
              <p className={styles.actionDesc}>
                Registro de prendas terminadas y productos que salen de producción
              </p>
              <div className={styles.actionMetric}>—</div>
            </motion.a>
          </motion.section>

          {/* Real Calendar */}
          <motion.section className={styles.calendarSection} variants={fadeUp}>
            <h3 className={styles.sectionTitle}>
              Semana del {weekDates[0].getDate()} de{' '}
              {weekDates[0].toLocaleDateString('es-MX', { month: 'long' })}
            </h3>
            <div className={styles.calendar}>
              <div className={styles.calendarHeader}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className={styles.calendarDayName}>
                    {d}
                  </div>
                ))}
              </div>
              <div className={styles.calendarGrid}>
                {weekDates.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={`${styles.calendarCell} ${isToday(d) ? styles.calendarCellToday : ''}`}
                  >
                    {d.getDate()}
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.p className={styles.footer} variants={fadeUp}>
            Módulo en desarrollo — funcionalidades próximamente
          </motion.p>
        </motion.article>
      </div>
    </LayoutWrapper>
  );
}
