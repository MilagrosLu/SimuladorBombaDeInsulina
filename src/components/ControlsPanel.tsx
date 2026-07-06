// ============================================================
// PANEL DE CONTROLES – PID, Setpoint, Actuador
// ============================================================
import type { SimConfig } from '../types/simulation';

interface ControlsPanelProps {
  config: SimConfig;
  onConfigChange: (newConfig: SimConfig) => void;
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: string;
  description?: string;
}

function Slider({ id, label, value, min, max, step, onChange, color, description }: SliderProps) {
  return (
    <div className="slider-wrapper">
      <div className="slider-label-row">
        <label htmlFor={id} className="slider-label" title={description}>{label}</label>
        <span className="slider-value" style={{ color: color || 'var(--cyan)' }}>
          {value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          background: `linear-gradient(90deg, ${color || 'var(--cyan)'} ${((value - min) / (max - min)) * 100}%, var(--bg-input) 0%)`,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function ControlsPanel({ config, onConfigChange }: ControlsPanelProps) {
  function updatePID(key: 'kp' | 'ki' | 'kd', value: number) {
    onConfigChange({ ...config, pid: { ...config.pid, [key]: value } });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Setpoint + Glucosa inicial ── */}
      <section>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--cyan)', marginBottom: 10 }}>
          🎯 Entrada – Referencia
        </div>
        <Slider
          id="setpoint"
          label="Setpoint (Glucosa objetivo)"
          value={config.setpoint}
          min={70}
          max={180}
          step={1}
          onChange={v => onConfigChange({ ...config, setpoint: v })}
          color="var(--cyan)"
          description="Glucosa de referencia que el sistema intenta mantener"
        />

        <div style={{ marginTop: 10 }}>
          <Slider
            id="initialGlucose"
            label="Glucosa inicial (al hacer Reset)"
            value={config.initialGlucose}
            min={70}
            max={300}
            step={1}
            onChange={v => onConfigChange({ ...config, initialGlucose: v })}
            color="var(--yellow)"
            description="Nivel de glucosa con el que arranca la simulación al presionar Reset. Si es igual al Setpoint, el error inicial es 0."
          />
        </div>

        {/* Indicador de error inicial */}
        {(() => {
          const initErr = config.initialGlucose - config.setpoint;
          const color = initErr === 0 ? 'var(--green)' : Math.abs(initErr) < 20 ? 'var(--yellow)' : 'var(--red)';
          return (
            <div style={{ marginTop: 6, padding: '5px 8px', background: 'var(--bg-input)',
              borderRadius: 6, border: `1px solid ${color}33`, fontSize: 10,
              color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Error inicial e(0)</span>
              <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>
                {initErr > 0 ? '+' : ''}{initErr.toFixed(0)} mg/dL
              </span>
            </div>
          );
        })()}
      </section>

      <div className="divider" />

      {/* ── Controlador PID ── */}
      <section>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--blue)', marginBottom: 10 }}>
          ⚙️ Controlador PID
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Slider
            id="kp"
            label="Kp — Ganancia Proporcional [U/h / (mg/dL)]"
            value={config.pid.kp}
            min={0}
            max={2.0}
            step={0.01}
            onChange={v => updatePID('kp', v)}
            color="var(--blue)"
            description="Respuesta proporcional al error actual. Mayor Kp = respuesta más rápida pero puede oscilar."
          />
          <Slider
            id="ki"
            label="Ki — Ganancia Integral [U/h / (mg/dL·min)]"
            value={config.pid.ki}
            min={0}
            max={0.05}
            step={0.0001}
            onChange={v => updatePID('ki', v)}
            color="var(--purple)"
            description="Elimina el error en estado estacionario. Demasiado alto → oscilaciones e inestabilidad."
          />
          <Slider
            id="kd"
            label="Kd — Ganancia Derivativa [U/h / (mg/dL/min)]"
            value={config.pid.kd}
            min={0}
            max={5.0}
            step={0.05}
            onChange={v => updatePID('kd', v)}
            color="var(--orange)"
            description="Anticipa cambios del error. Demasiado alto + ruido → señal errática."
          />
        </div>

        {/* Ayuda visual PID */}
        <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-input)', borderRadius: 6,
          border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>💡 Valores de referencia:</strong><br />
          ✅ <strong style={{ color: 'var(--green)' }}>Óptimo (actual):</strong> Kp=0.23, Ki=0.020, Kd=0.35<br />
          ⚠️ <strong style={{ color: 'var(--yellow)' }}>Lento:</strong> Kp=0.015, Ki=0.0005, Kd=0.40<br />
          🔴 <strong style={{ color: 'var(--red)' }}>Inestable (Hipo):</strong> Kp=1.20, Ki=0.040, Kd=0.00
        </div>
      </section>
    </div>
  );
}

