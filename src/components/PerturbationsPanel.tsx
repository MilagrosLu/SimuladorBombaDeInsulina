// ============================================================
// PANEL DE PERTURBACIONES – Botones de eventos del sistema
// ============================================================
import type { PerturbationType } from '../types/simulation';
import { PERTURBATION_EXPLANATIONS } from '../engine/config';

interface PerturbationsPanelProps {
  onPerturbation: (type: PerturbationType) => void;
  activePerturbations: { type: PerturbationType }[];
}

interface PerturbButtonProps {
  type: PerturbationType;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

function PerturbButton({ icon, label, sublabel, color, active, onClick }: PerturbButtonProps) {
  return (
    <button
      className="perturb-btn"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '10px 12px',
        background: active ? `${color}22` : 'var(--bg-input)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: active ? color : 'var(--text-secondary)',
        textAlign: 'left',
        width: '100%',
        boxShadow: active ? `0 0 12px ${color}33` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? color : 'var(--text-primary)' }}>
          {label}
        </span>
        {active && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            background: `${color}33`, color, padding: '1px 5px', borderRadius: 4,
            marginLeft: 'auto', animation: 'pulse-alarm 1s ease infinite',
          }}>
            ACTIVO
          </span>
        )}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 22 }}>
        {sublabel}
      </span>
    </button>
  );
}

export function PerturbationsPanel({ onPerturbation, activePerturbations }: PerturbationsPanelProps) {
  const activeTypes = new Set(activePerturbations.map(p => p.type));

  const buttons: Array<{
    type: PerturbationType;
    icon: string;
    label: string;
    sublabel: string;
    color: string;
    section: string;
  }> = [
      {
        type: 'meal_small', icon: '🥗',
        label: 'Comida Pequeña', sublabel: '20g CHO · pico moderado',
        color: '#f59e0b', section: 'Comidas',
      },
      {
        type: 'meal_normal', icon: '🍽️',
        label: 'Comida Normal', sublabel: '50g CHO · pico pronunciado',
        color: '#f97316', section: 'Comidas',
      },
      {
        type: 'meal_large', icon: '🍔',
        label: 'Comida Grande', sublabel: '100g CHO · perturbación máxima',
        color: '#ef4444', section: 'Comidas',
      },
      {
        type: 'stress', icon: '😰',
        label: 'Estrés Agudo', sublabel: 'Cortisol → glucosa sube lentamente',
        color: '#a78bfa', section: 'Fisiología',
      },
      {
        type: 'exercise', icon: '🏃',
        label: 'Ejercicio', sublabel: 'Consumo muscular → baja glucosa',
        color: '#22d3a6', section: 'Fisiología',
      },
      {
        type: 'occlusion', icon: '🚫',
        label: 'Oclusión de Cánula', sublabel: 'Insulina no llega · error crece',
        color: '#dc2626', section: 'Fallos',
      },
      {
        type: 'ble_interference', icon: '📵',
        label: 'Interferencia BLE', sublabel: 'Pérdida de comunicación',
        color: '#6366f1', section: 'Fallos',
      },
      {
        type: 'sensor_noise', icon: '📉',
        label: 'Ruido del Sensor', sublabel: 'Medición errática → D oscila',
        color: '#64748b', section: 'Fallos',
      },
    ];

  // Agrupar por sección
  const sections = ['Comidas', 'Fisiología', 'Fallos'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map(section => {
        const sectionBtns = buttons.filter(b => b.section === section);
        const sectionColor =
          section === 'Comidas' ? 'var(--yellow)' :
            section === 'Fisiología' ? 'var(--green)' :
              'var(--red)';

        return (
          <div key={section}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: sectionColor, marginBottom: 8,
            }}>
              {section === 'Comidas' ? '🍴' : section === 'Fisiología' ? '🧬' : '⚠️'} {section}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sectionBtns.map(b => (
                <PerturbButton
                  key={b.type}
                  {...b}
                  active={activeTypes.has(b.type)}
                  onClick={() => onPerturbation(b.type)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div style={{
        padding: 10, background: 'var(--bg-input)', borderRadius: 6,
        border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
        marginTop: 4,
      }}>
        💡 Las perturbaciones tienen una duración limitada y se eliminan automáticamente.
        Puede activar varias simultáneamente para simular escenarios complejos.
      </div>
    </div>
  );
}

// ── Notificación explicativa de perturbación ─────────────────
interface PerturbationNotificationProps {
  perturbationType: PerturbationType | null;
  onClose: () => void;
}

export function PerturbationNotification({ perturbationType, onClose }: PerturbationNotificationProps) {
  if (!perturbationType) return null;

  const info = PERTURBATION_EXPLANATIONS.find(p => p.type === perturbationType);
  if (!info) return null;

  return (
    <div className="notification">
      <div className="notification-card" style={{ borderLeftColor: info.color }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="notification-title" style={{ color: info.color }}>
            ⚡ {info.title}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div className="notification-body">
          <div className="notification-section">
            <div className="notification-section-label">🔬 Fisiología</div>
            <div>{info.physiology}</div>
          </div>
          <div className="notification-section">
            <div className="notification-section-label">📊 Señal afectada</div>
            <div>{info.signalChanged}</div>
          </div>
          <div className="notification-section">
            <div className="notification-section-label">⚙️ Respuesta PID</div>
            <div>{info.pidResponse}</div>
          </div>
          <div className="notification-section">
            <div className="notification-section-label">📈 Evolución del error</div>
            <div>{info.errorEvolution}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
