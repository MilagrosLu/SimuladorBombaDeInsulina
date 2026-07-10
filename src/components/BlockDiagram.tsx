// ============================================================
// DIAGRAMA DE BLOQUES ANIMADO – Lazo de control cerrado
// ============================================================
// Muestra el flujo de señales:
//
//  Setpoint → [Σ] → [PID] → [Actuador] → [Planta] → [Sensor]
//               ↑                                        |
//               └──────────── [BLE] ◄──────────────────┘
//
// Las flechas tienen partículas animadas que muestran la
// dirección del flujo de señales en tiempo real.
// ============================================================
import './BlockDiagram.css';
import type { SimulationState } from '../types/simulation';

interface BlockDiagramProps {
  state: SimulationState;
  running: boolean;
}

// ── Flecha con partícula animada ─────────────────────────────
function Arrow({ color = 'var(--cyan)', label = '', animating = true }: {
  color?: string;
  label?: string;
  animating?: boolean;
}) {
  return (
    <div className="ctrl-arrow">
      {label && <span className="signal-label">{label}</span>}
      <div className="ctrl-arrow-line" style={{ background: color + '44' }}>
        {animating && (
          <div
            className="ctrl-arrow-particle"
            style={{ background: color }}
          />
        )}
      </div>
      <div className="ctrl-arrow-head" style={{ borderLeftColor: color }} />
    </div>
  );
}

// ── Bloque individual del diagrama ──────────────────────────
function Block({
  icon, label, value, color, active = false,
}: {
  icon: string;
  label: string;
  value?: string;
  color: string;
  active?: boolean;
}) {
  return (
    <div
      className={`ctrl-block ${active ? 'active' : ''}`}
      style={{ color, borderColor: active ? color : undefined }}
    >
      <div className="ctrl-block-icon">{icon}</div>
      <div className="ctrl-block-label" style={{ color }}>{label}</div>
      {value && <div className="ctrl-block-value">{value}</div>}
    </div>
  );
}

// ── Animación BLE ─────────────────────────────────────────────
function BLEBlock({ connected }: { connected: boolean }) {
  return (
    <div className={`ble-container ${connected ? '' : 'ble-disconnected'}`}>
      <div className="ble-label" style={{ color: connected ? 'var(--blue)' : 'var(--red)' }}>
        BLE
      </div>
      <div className="ble-wave">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="ble-wave-bar"
            style={{ background: connected ? 'var(--blue)' : 'var(--red)' }}
          />
        ))}
      </div>
    </div>
  );
}

export function BlockDiagram({ state, running }: BlockDiagramProps) {
  const hasError = Math.abs(state.error) > 15;
  const isAnimating = running;

  // Color dinámico según estado
  const glucoseColor = state.glucoseReal < 70
    ? 'var(--purple)'
    : state.glucoseReal > 180
    ? 'var(--red)'
    : state.glucoseReal > 140
    ? 'var(--yellow)'
    : 'var(--green)';

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* ── Lazo principal (izquierda a derecha) ── */}
      <div className="block-diagram">

        {/* Entrada / Setpoint */}
        <Block
          icon=""
          label="Setpoint"
          value={`${state.setpoint} mg/dL`}
          color="var(--cyan)"
          active
        />

        <Arrow color="var(--cyan)" label="r(t)" animating={isAnimating} />

        {/* Comparador */}
        <div
          className={`comparator ${hasError ? 'has-error' : ''}`}
          title={`Error = ${state.error.toFixed(1)} mg/dL`}
        >
          Σ
        </div>

        <Arrow
          color={hasError ? 'var(--red)' : 'var(--cyan-dim)'}
          label={`e=${state.error.toFixed(0)}`}
          animating={isAnimating}
        />

        {/* Controlador PID */}
        <Block
          icon=""
          label="PID"
          value={`u=${state.pidOutput.toFixed(2)}`}
          color="var(--blue)"
          active={isAnimating}
        />

        <Arrow color="var(--blue)" label="u(t)" animating={isAnimating} />

        {/* Actuador */}
        <Block
          icon=""
          label="Actuador"
          value={`${state.insulinRate.toFixed(2)} U/h`}
          color="var(--purple)"
          active={isAnimating}
        />

        <Arrow color="var(--purple)" label="I(t)" animating={isAnimating} />

        {/* Planta */}
        <Block
          icon=""
          label="Planta"
          value={`SubQ: ${state.subcutaneousInsulin.toFixed(3)}`}
          color="var(--orange)"
          active={isAnimating}
        />

        <Arrow color={glucoseColor} label="G(t)" animating={isAnimating} />

        {/* Sensor */}
        <Block
          icon=""
          label="Guardian 4"
          value={`${state.glucoseMeasured.toFixed(1)} mg/dL`}
          color="var(--green)"
          active={isAnimating}
        />

      </div>

      {/* ── Rama de realimentación ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
        padding: '0 12px',
      }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Realimentación
        </span>
        <div className="feedback-line">
          {isAnimating && (
            <div
              className="ctrl-arrow-particle"
              style={{ background: 'var(--green)', animationDirection: 'reverse', animationDuration: '2s' }}
            />
          )}
        </div>

        <BLEBlock connected={state.bleConnected} />

        <div className="feedback-line">
          {isAnimating && (
            <div
              className="ctrl-arrow-particle"
              style={{ background: 'var(--green)', animationDirection: 'reverse', animationDuration: '2s', animationDelay: '1s' }}
            />
          )}
        </div>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ← y(t)
        </span>
      </div>

      {/* ── Perturbaciones activas ── */}
      {state.perturbations.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginTop: 6,
          flexWrap: 'wrap',
        }}>
          {state.perturbations.map((p, i) => (
            <span
              key={i}
              style={{
                fontSize: '9px',
                padding: '2px 8px',
                borderRadius: '100px',
                background: 'rgba(251,191,36,0.1)',
                color: 'var(--yellow)',
                border: '1px solid rgba(251,191,36,0.3)',
                fontWeight: 600,
              }}
            >
              ⚡ {p.type.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
