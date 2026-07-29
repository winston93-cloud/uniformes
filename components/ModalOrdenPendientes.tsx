'use client';

export type OrdenReportePendientes = 'folio' | 'prenda';

interface ModalOrdenPendientesProps {
  onClose: () => void;
  onSelect: (orden: OrdenReportePendientes) => void;
  cargando?: boolean;
  etiquetaCuenta?: string;
}

export default function ModalOrdenPendientes({
  onClose,
  onSelect,
  cargando = false,
  etiquetaCuenta,
}: ModalOrdenPendientesProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          padding: '1.75rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            gap: '1rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e40af' }}>
              Pedidos Pendientes
            </h2>
            {etiquetaCuenta && (
              <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Cuenta: <strong style={{ color: '#334155' }}>{etiquetaCuenta}</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              fontSize: '1.35rem',
              cursor: cargando ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 1.25rem', color: '#475569', fontSize: '0.95rem' }}>
          ¿Cómo quieres ordenar el reporte?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            disabled={cargando}
            onClick={() => onSelect('folio')}
            style={{
              padding: '1rem 1.15rem',
              borderRadius: '12px',
              border: '2px solid #3b82f6',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: cargando ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: cargando ? 0.7 : 1,
            }}
          >
            Ordenado por folio
            <div style={{ fontWeight: 400, fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.95 }}>
              Lista completa ordenada por folio (wu / wt / rt…)
            </div>
          </button>

          <button
            type="button"
            disabled={cargando}
            onClick={() => onSelect('prenda')}
            style={{
              padding: '1rem 1.15rem',
              borderRadius: '12px',
              border: '2px solid #7c3aed',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: cargando ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: cargando ? 0.7 : 1,
            }}
          >
            Agrupado por prenda
            <div style={{ fontWeight: 400, fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.95 }}>
              Secciones por tipo de prenda, con sus folios pendientes
            </div>
          </button>
        </div>

        {cargando && (
          <p style={{ margin: '1rem 0 0', color: '#64748b', textAlign: 'center', fontSize: '0.9rem' }}>
            Generando reporte…
          </p>
        )}
      </div>
    </div>
  );
}
