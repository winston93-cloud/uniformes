'use client';

interface PartidaAccionesToolbarProps {
  index: number;
  totalPartidas: number;
  insertarActivo: boolean;
  onInsertar: () => void;
  onSubir: () => void;
  onBajar: () => void;
  onEliminar: () => void;
}

function IconInsertar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconSubir() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBajar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEliminar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

export default function PartidaAccionesToolbar({
  index,
  totalPartidas,
  insertarActivo,
  onInsertar,
  onSubir,
  onBajar,
  onEliminar,
}: PartidaAccionesToolbarProps) {
  const esPrimera = index === 0;
  const esUltima = index === totalPartidas - 1;

  return (
    <div className="cotizacion-partida-acciones">
      <button
        type="button"
        className="cotizacion-partida-btn cotizacion-partida-btn--eliminar"
        onClick={onEliminar}
        title="Eliminar partida"
        aria-label={`Eliminar partida ${index + 1}`}
      >
        <IconEliminar />
      </button>
      <div className="cotizacion-partida-acciones-orden" role="group" aria-label={`Acciones posición partida ${index + 1}`}>
        <button
          type="button"
          className={`cotizacion-partida-btn cotizacion-partida-btn--insert${insertarActivo ? ' is-active' : ''}`}
          onClick={onInsertar}
          title={`Insertar nueva partida después de la #${index + 1}`}
          aria-label={`Insertar después de partida ${index + 1}`}
          aria-pressed={insertarActivo}
        >
          <IconInsertar />
        </button>
        <button
          type="button"
          className="cotizacion-partida-btn cotizacion-partida-btn--mover"
          onClick={onSubir}
          disabled={esPrimera}
          title="Subir una posición"
          aria-label="Subir partida"
        >
          <IconSubir />
        </button>
        <button
          type="button"
          className="cotizacion-partida-btn cotizacion-partida-btn--mover"
          onClick={onBajar}
          disabled={esUltima}
          title="Bajar una posición"
          aria-label="Bajar partida"
        >
          <IconBajar />
        </button>
      </div>
    </div>
  );
}
