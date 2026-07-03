// ============================================================
// PANEL DE VALORES ACTUALES – Métricas del sistema
// ============================================================
import type { SimulationState } from '../types/simulation';

interface MetricsPanelProps {
  state: SimulationState;
}

interface MetricRowProps {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  highlight?: boolean;
}

function MetricRow({ label, value, unit, color, highlight }: MetricRowProps) {
  return (
    <div className="metric-item" style={highlight ? { border: `1px solid ${color}44` } : {}}>
      <span className="metric-label">{label}</span>
      <span className="metric-value mono" style={{ color: color || 'var(--text-primary)' }}>
        {value}{unit && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

function GlucoseBar({ value, setpoint }: { value: number; setpoint: number }) {
  const pct = Math.min(100, (value / 300) * 100);
  const spPct = Math.min(100, (setpoint / 300) * 100);
  const color =
    value < 70 ? 'var(--purple)' :
    value <= 140 ? 'var(--green)' :
    value <= 200 ? 'var(--yellow)' :
    'var(--red)';

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}>Hipoglucemia</span>
        <span style={{ color: 'var(--text-muted)' }}>Normal</span>
        <span style={{ color: 'var(--text-muted)' }}>Hiperglucemia</span>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'visible',
        background: 'linear-gradient(90deg, #4c1d95 0%, #14532d 23%, #16a34a 46%, #ca8a04 66%, #dc2626 100%)',
        opacity: 0.3 }}>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden',
        background: 'var(--bg-input)', border: '1px solid var(--border)', marginTop: -12 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, background: color, borderRadius: 6, transition: 'all 0.4s ease', opacity: 0.9 }} />
        {/* Marcador setpoint */}
        <div style={{
          position: 'absolute', left: `${spPct}%`, top: 0, height: '100%',
          width: 2, background: 'var(--cyan)', opacity: 0.8,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 9, color: 'var(--text-muted)' }}>
        <span>40</span><span>70</span><span>100 (SP)</span><span>180</span><span>300+ mg/dL</span>
      </div>
    </div>
  );
}

export function MetricsPanel({ state }: MetricsPanelProps) {
  const glucoseColor =
    state.glucoseReal < 70 ? 'var(--purple)' :
    state.glucoseReal <= 140 ? 'var(--green)' :
    state.glucoseReal <= 200 ? 'var(--yellow)' :
    'var(--red)';

  const errorColor = Math.abs(state.error) > 30 ? 'var(--red)'
    : Math.abs(state.error) > 10 ? 'var(--yellow)'
    : 'var(--green)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── Glucosa principal ── */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 4 }}>Glucosa en Sangre</div>
        <span className="value-display" style={{ color: glucoseColor }}>
          {state.glucoseReal.toFixed(1)}
        </span>
        <span className="value-unit">mg/dL</span>
      </div>

      {/* ── Barra de glucosa ── */}
      <GlucoseBar value={state.glucoseReal} setpoint={state.setpoint} />

      <div className="divider" />

      {/* ── Métricas del lazo ── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
        <MetricRow
          label="Glucosa Medida (Sensor)"
          value={state.glucoseMeasured.toFixed(1)}
          unit="mg/dL"
          color="var(--green)"
        />
        <MetricRow
          label="Setpoint (Referencia)"
          value={state.setpoint.toString()}
          unit="mg/dL"
          color="var(--cyan)"
        />
        <MetricRow
          label="Error e(t) = G − SP"
          value={(state.error > 0 ? '+' : '') + state.error.toFixed(1)}
          unit="mg/dL"
          color={errorColor}
          highlight
        />
      </div>

      <div className="divider" />

      {/* ── PID ── */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
        Controlador PID
      </div>
      <div className="metrics-grid">
        <MetricRow label="Término P" value={state.pTerm.toFixed(3)} color="var(--blue)" />
        <MetricRow label="Término I" value={state.iTerm.toFixed(3)} color="var(--purple)" />
        <MetricRow label="Término D" value={state.dTerm.toFixed(3)} color="var(--orange)" />
        <MetricRow
          label="Salida PID u(t)"
          value={state.pidOutput.toFixed(3)}
          color="var(--cyan)"
          highlight
        />
      </div>

      <div className="divider" />

      {/* ── Actuador ── */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
        Actuador – Micromotor
      </div>
      <div className="metrics-grid">
        <MetricRow
          label="Tasa Infusión Total"
          value={state.insulinRate.toFixed(2)}
          unit="U/h"
          color={state.actuatorSaturated ? 'var(--red)' : 'var(--text-primary)'}
        />
        <MetricRow label="Tasa Basal" value={state.basalRate.toFixed(2)} unit="U/h" />
        <MetricRow label="Bolo Automático" value={state.bolusAmount.toFixed(2)} unit="U" color="var(--yellow)" />
        <div className="metric-item" style={state.actuatorSaturated ? { borderColor: 'var(--red)' } : {}}>
          <span className="metric-label">Saturación</span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: state.actuatorSaturated ? 'var(--red)' : 'var(--green)',
          }}>
            {state.actuatorSaturated ? '⚠ SATURADO' : '✓ Normal'}
          </span>
        </div>
      </div>

      <div className="divider" />

      {/* ── Sensor y BLE ── */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
        Sensor & Comunicación
      </div>
      <div className="metrics-grid">
        <MetricRow
          label="Lectura Sensor (ISF)"
          value={state.sensorReading.toFixed(1)}
          unit="mg/dL"
          color="var(--green)"
        />
        <div className="metric-item">
          <span className="metric-label">BLE</span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: state.bleConnected ? 'var(--blue)' : 'var(--red)',
          }}>
            {state.bleConnected ? '📶 Conectado' : '📵 Desconectado'}
          </span>
        </div>
        <MetricRow
          label="Pérdida Paquetes"
          value={(state.blePacketLoss * 100).toFixed(0)}
          unit="%"
        />
      </div>

      <div className="divider" />

      {/* ── Estado del sistema ── */}
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <span
          className={`badge ${state.systemState === 'stable' ? 'badge-stable' : 'badge-transient'}`}
          style={{ fontSize: 11, padding: '6px 16px' }}
        >
          <span className="pulse-dot" style={{
            background: state.systemState === 'stable' ? 'var(--green)' : 'var(--yellow)',
          }} />
          {state.systemState === 'stable' ? '✓ ESTADO ESTABLE' : '~ ESTADO TRANSITORIO'}
        </span>
        {state.systemState === 'stable' && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Estable por {state.stableTime.toFixed(0)} min
          </div>
        )}
      </div>
    </div>
  );
}
