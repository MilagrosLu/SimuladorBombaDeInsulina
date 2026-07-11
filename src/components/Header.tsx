// ============================================================
// HEADER – Barra superior con estado en tiempo real
// ============================================================
import { useState, useEffect } from 'react';
import './Header.css';
import type { SimulationState, SimConfig } from '../types/simulation';

interface HeaderProps {
  state: SimulationState;
  config: SimConfig;
  running: boolean;
  timeScale: number;
  darkMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onTimeScaleChange: (v: number) => void;
  onToggleTheme: () => void;
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
  state, config, running, timeScale, darkMode,
  onPlay, onPause, onReset, onTimeScaleChange, onToggleTheme,
}: HeaderProps) {
  const stateLabel = state.systemState === 'stable' ? 'ESTABLE' : 'TRANSITORIO';
  const stateColor = state.systemState === 'stable' ? 'var(--green)' : 'var(--yellow)';

  const [localTimeInput, setLocalTimeInput] = useState((timeScale * 5).toString());

  useEffect(() => {
    const expected = timeScale * 5;
    if (parseFloat(localTimeInput) !== expected && localTimeInput !== '') {
      setLocalTimeInput(expected.toString());
    }
  }, [timeScale]);

  return (
    <header className="header">
      {/* ── Logo y título ── */}
      <div className="header-brand">
        <div className="header-logo">
          {/* Bomba de insulina – SVG inline */}
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cuerpo de la bomba */}
            <rect x="14" y="4" width="26" height="42" rx="6" fill="white" opacity="0.9"/>
            <rect x="14" y="4" width="26" height="42" rx="6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/>
            {/* Ventana reservorio */}
            <rect x="19" y="9" width="16" height="16" rx="3" fill="rgba(0,60,120,0.35)"/>
            {/* Nivel de insulina */}
            <rect x="20" y="16" width="14" height="8" rx="2" fill="rgba(180,230,255,0.8)"/>
            <circle cx="25" cy="19" r="1.5" fill="white" opacity="0.5"/>
            {/* Pantalla */}
            <rect x="19" y="28" width="16" height="11" rx="2" fill="rgba(0,20,50,0.6)"/>
            {/* Onda de glucosa en pantalla */}
            <polyline
              points="20,34 22,34 23.5,31 25,36 26.5,31 28,34.5 29.5,34 34,34"
              stroke="#22d3a6" strokeWidth="1.3" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Botón lateral */}
            <rect x="40" y="18" width="6" height="10" rx="3" fill="rgba(255,255,255,0.7)"/>
            {/* Conector inferior */}
            <rect x="23" y="46" width="8" height="4" rx="2" fill="rgba(255,255,255,0.6)"/>
            {/* Tubo */}
            <path d="M27 50 Q27 56 32 56 L46 56"
              stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            {/* Punta cánula */}
            <circle cx="46" cy="56" r="3" fill="rgba(255,255,255,0.8)"/>
            <circle cx="46" cy="56" r="1.2" fill="rgba(0,150,200,0.8)"/>
          </svg>
        </div>
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

      {/* ── Alarmas ──
      {state.alarms.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {state.alarms.map(a => (
            <span key={a} className="alarm-chip">⚠ {a}</span>
          ))}
        </div>
      )} */}

      {/* ── Tiempo simulado ── */}
      <div className="time-display">
        ⏱ {formatTime(state.time)}
      </div>

      {/* ── Velocidad + relación tiempo real/simulado ── */}
      <div id="tut-speed-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>

        {/* Botones rápidos */}
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
          {/* Input de valor personalizado (Minutos simulados por segundo) */}
          <div style={{
            display: 'flex', alignItems: 'center', background: 'var(--bg-input)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', gap: 4
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>1s =</span>
            <input
              type="number"
              min={1}
              max={5000}
              step={5}
              value={localTimeInput}
              onChange={e => {
                const val = e.target.value;
                setLocalTimeInput(val);
                const parsed = parseFloat(val);
                if (!isNaN(parsed)) {
                  const mins = Math.max(0.5, Math.min(5000, parsed));
                  onTimeScaleChange(mins / 5);
                }
              }}
              title="Minutos simulados por cada segundo real"
              style={{
                width: 48, padding: '2px 0',
                background: 'transparent', border: 'none',
                color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 11,
                textAlign: 'center', outline: 'none'
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>min</span>
          </div>
        </div>
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
        <button
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          id="btn-theme-toggle"
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {darkMode ? '🌙' : '☀️'}
          <span style={{ fontSize: 11 }}>{darkMode ? 'Oscuro' : 'Claro'}</span>
        </button>
      </div>
    </header>
  );
}
