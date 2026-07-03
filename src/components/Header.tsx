// ============================================================
// HEADER – Barra superior con estado en tiempo real
// ============================================================
import './Header.css';
import type { SimulationState, SimConfig } from '../types/simulation';

interface HeaderProps {
  state: SimulationState;
  config: SimConfig;
  running: boolean;
  timeScale: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onTimeScaleChange: (v: number) => void;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getGlucoseColor(g: number): string {
  if (g < 70)  return 'var(--purple)';
  if (g <= 140) return 'var(--green)';
  if (g <= 200) return 'var(--yellow)';
  return 'var(--red)';
}

export function Header({
  state, config, running, timeScale,
  onPlay, onPause, onReset, onTimeScaleChange,
}: HeaderProps) {
  const stateLabel = state.systemState === 'stable' ? 'ESTABLE' : 'TRANSITORIO';
  const stateColor = state.systemState === 'stable' ? 'var(--green)' : 'var(--yellow)';

  return (
    <header className="header">
      {/* ── Logo y título ── */}
      <div className="header-brand">
        <div className="header-logo">💉</div>
        <div>
          <div className="header-title">Medtronic MiniMed™ 780G</div>
          <div className="header-subtitle">Simulador de Control PID — Sistema de Lazo Cerrado</div>
        </div>
      </div>

      {/* ── Métricas en tiempo real ── */}
      <div className="header-status">
        <div className="header-stat">
          <span className="header-stat-label">Glucosa Real</span>
          <span
            className="header-stat-value mono"
            style={{ color: getGlucoseColor(state.glucoseReal) }}
          >
            {state.glucoseReal.toFixed(1)}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}> mg/dL</span>
          </span>
        </div>

        <div className="header-stat">
          <span className="header-stat-label">Setpoint</span>
          <span className="header-stat-value mono" style={{ color: 'var(--cyan)' }}>
            {config.setpoint}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}> mg/dL</span>
          </span>
        </div>

        <div className="header-stat">
          <span className="header-stat-label">Error</span>
          <span
            className="header-stat-value mono"
            style={{ color: Math.abs(state.error) > 20 ? 'var(--red)' : 'var(--text-primary)' }}
          >
            {state.error > 0 ? '+' : ''}{state.error.toFixed(1)}
          </span>
        </div>

        <div className="header-stat">
          <span className="header-stat-label">Insulina</span>
          <span className="header-stat-value mono" style={{ color: 'var(--blue)' }}>
            {state.insulinRate.toFixed(2)}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}> U/h</span>
          </span>
        </div>

        <div className="header-stat">
          <span className="header-stat-label">Estado</span>
          <span className="header-stat-value" style={{ fontSize: '11px', color: stateColor, fontWeight: 700 }}>
            {stateLabel}
          </span>
        </div>
      </div>

      {/* ── Alarmas ── */}
      {state.alarms.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {state.alarms.map(a => (
            <span key={a} className="alarm-chip">⚠ {a}</span>
          ))}
        </div>
      )}

      {/* ── Tiempo simulado ── */}
      <div className="time-display">
        ⏱ {formatTime(state.time)}
      </div>

      {/* ── Velocidad ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vel:</span>
        {[1, 2, 4, 8].map(v => (
          <button
            key={v}
            className={`btn btn-sm ${timeScale === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onTimeScaleChange(v)}
          >
            {v}×
          </button>
        ))}
      </div>

      {/* ── Controles de simulación ── */}
      <div className="header-controls">
        {running ? (
          <button className="btn btn-ghost" onClick={onPause} id="btn-pause">
            ⏸ Pausar
          </button>
        ) : (
          <button className="btn btn-success" onClick={onPlay} id="btn-play">
            ▶ Simular
          </button>
        )}
        <button className="btn btn-danger" onClick={onReset} id="btn-reset">
          ↺ Reset
        </button>
      </div>
    </header>
  );
}
