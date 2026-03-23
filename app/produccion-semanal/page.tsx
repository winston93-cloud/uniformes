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
  DollarSign,
  Settings,
  Wrench,
  Sun,
  Moon,
  TrendingUp,
} from 'lucide-react';
import ModalGastosFijos from '@/components/ModalGastosFijos';
import ModalProduccion, { type ItemProduccion } from '@/components/ModalProduccion';
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
  const [modalGastosAbierto, setModalGastosAbierto] = useState(false);
  const [modalProduccionAbierto, setModalProduccionAbierto] = useState(false);
  const [itemsProduccion, setItemsProduccion] = useState<ItemProduccion[]>([]);
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
                title="Próximamente: gastos fijos semanales, producción, métricas en tiempo real, reportes."
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
            <motion.button
              type="button"
              className={`${styles.actionCard} ${styles.actionCardEntrada}`}
              onClick={() => setModalGastosAbierto(true)}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              whileTap={{ scale: 0.99 }}
              aria-label="Gastos fijos semanales"
              style={{ border: 'none', font: 'inherit', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <div className={styles.actionIcon}>
                <DollarSign size={24} strokeWidth={2} />
              </div>
              <h2 className={styles.actionTitle} style={{ fontFamily: 'var(--font-outfit)' }}>
                Gastos fijos Semanales
              </h2>
              <p className={styles.actionDesc}>
                Control y registro de gastos fijos recurrentes cada semana
              </p>
              <div className={styles.actionMetric}>—</div>
            </motion.button>

            {modalGastosAbierto && (
              <ModalGastosFijos onClose={() => setModalGastosAbierto(false)} />
            )}

            <motion.button
              type="button"
              className={`${styles.actionCard} ${styles.actionCardSalida}`}
              onClick={() => setModalProduccionAbierto(true)}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              whileTap={{ scale: 0.99 }}
              aria-label="Producción"
              style={{ border: 'none', font: 'inherit', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <div className={styles.actionIcon}>
                <Settings size={24} strokeWidth={2} />
              </div>
              <h2 className={styles.actionTitle} style={{ fontFamily: 'var(--font-outfit)' }}>
                Producción
              </h2>
              <p className={styles.actionDesc}>
                Seguimiento y planificación de la producción semanal
              </p>
              <div className={styles.actionMetric}>
                {itemsProduccion.length > 0 ? `${itemsProduccion.length} ítems` : '—'}
              </div>
            </motion.button>

            {modalProduccionAbierto && (
              <ModalProduccion
                onClose={() => setModalProduccionAbierto(false)}
                onGuardar={(items) => setItemsProduccion(items)}
              />
            )}
          </motion.section>

          {/* Dashboard de Producción - items seleccionados */}
          {itemsProduccion.length > 0 && (
            <motion.section
              className={styles.calendarSection}
              variants={fadeUp}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className={styles.sectionTitle}>Dashboard de producción</h3>
              <div
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '1.5rem',
                  overflow: 'hidden',
                  boxShadow: 'var(--glass-shadow)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: 'var(--text)',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Modelo
                      </th>
                      <th
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'left',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: 'var(--text)',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Nº Cotización
                      </th>
                      <th
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: 'var(--text)',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        Piezas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsProduccion.map((item) => (
                      <tr key={`${item.cotizacion_id}-${item.detalle_id}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{item.modelo}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{item.folio}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                          {item.piezas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          )}

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
