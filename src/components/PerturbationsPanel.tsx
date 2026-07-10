// ============================================================
// PANEL DE PERTURBACIONES – Botones de eventos del sistema
// ============================================================
import { useState } from 'react';
import type { PerturbationType } from '../types/simulation';

// Duraciones configurables solo para perturbaciones de fallo técnico
const CONFIGURABLE_DURATION_TYPES: PerturbationType[] = ['occlusion', 'ble_interference', 'sensor_noise'];

interface PerturbationsPanelProps {
  onPerturbation: (type: PerturbationType, duration?: number, magnitude?: number) => void;
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

  const [customDurations, setCustomDurations] = useState<Record<string, number>>({
    occlusion: 30,
    ble_interference: 20,
    sensor_noise: 25,
  });

  const [customMagnitudes, setCustomMagnitudes] = useState<Record<string, number>>({
    sensor_noise: 40, // Base default para el slider (hasta 200 mg/dL de ruido si quiere)
  });

  const fmtDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  };

  const buttons: Array<{
    type: PerturbationType;
    icon: string;
    label: string;
    sublabel: string;
    color: string;
    section: string;
  }> = [
      {
        type: 'meal_small', icon: '',
        label: 'Comida Pequeña', sublabel: '20g CHO · pico moderado',
        color: '#f59e0b', section: 'Comidas',
      },
      {
        type: 'meal_normal', icon: ' ',
        label: 'Comida Normal', sublabel: '50g CHO · pico pronunciado',
        color: '#f97316', section: 'Comidas',
      },
      {
        type: 'meal_large', icon: '',
        label: 'Comida Grande', sublabel: '100g CHO · perturbación máxima',
        color: '#ef4444', section: 'Comidas',
      },
      {
        type: 'stress', icon: ' ',
        label: 'Estrés Agudo', sublabel: 'Cortisol → glucosa sube lentamente',
        color: '#a78bfa', section: 'Fisiología',
      },
      {
        type: 'exercise', icon: ' ',
        label: 'Ejercicio', sublabel: 'Consumo muscular → baja glucosa',
        color: '#22d3a6', section: 'Fisiología',
      },
      {
        type: 'occlusion', icon: ' ',
        label: 'Oclusión de Cánula', sublabel: 'Insulina bloqueada · insulina inyectada = 0',
        color: '#dc2626', section: 'Comunicación',
      },
      {
        type: 'ble_interference', icon: ' ',
        label: 'Interferencia BLE', sublabel: 'Pérdida de comunicación con sensor',
        color: '#6366f1', section: 'Comunicación',
      },
      {
        type: 'sensor_noise', icon: ' ',
        label: 'Ruido del Sensor', sublabel: 'Medición errática → término D oscila',
        color: '#64748b', section: 'Comunicación',
      },
    ];

  const sections = ['Comidas', 'Fisiología', 'Comunicación'];

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
              {section === 'Comidas' ? ' ' : section === 'Fisiología' ? ' ' : ' '} {section}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sectionBtns.map(b => {
                const isConfigurable = CONFIGURABLE_DURATION_TYPES.includes(b.type);
                return (
                  <div key={b.type}>
                    <PerturbButton
                      {...b}
                      active={activeTypes.has(b.type)}
                      onClick={() => onPerturbation(
                        b.type, 
                        isConfigurable ? customDurations[b.type] : undefined,
                        b.type === 'sensor_noise' ? customMagnitudes[b.type] : undefined
                      )}
                    />
                    {/* Control de duración solo para fallos técnicos */}
                    {isConfigurable && (
                      <div style={{
                        marginTop: 4, paddingLeft: 8,
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 45 }}>
                            Duración:
                          </span>
                          <input
                            type="range"
                            min={5} max={2880} step={15}
                            value={customDurations[b.type]}
                            onChange={e => setCustomDurations(prev => ({
                              ...prev, [b.type]: parseInt(e.target.value)
                            }))}
                            style={{
                              flex: 1, accentColor: b.color, cursor: 'pointer',
                              background: `linear-gradient(90deg, ${b.color}88 ${((customDurations[b.type] - 5) / 2875) * 100}%, var(--bg-input) 0%)`,
                            }}
                          />
                          <span style={{ fontSize: 10, color: b.color, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                            {fmtDuration(customDurations[b.type])}
                          </span>
                        </div>

                        {/* Slider extra de Magnitud solo para ruido del sensor */}
                        {b.type === 'sensor_noise' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 45 }}>
                              Magnitud:
                            </span>
                            <input
                              type="range"
                              min={5} max={500} step={5}
                              value={customMagnitudes[b.type]}
                              onChange={e => setCustomMagnitudes(prev => ({
                                ...prev, [b.type]: parseInt(e.target.value)
                              }))}
                              style={{
                                flex: 1, accentColor: b.color, cursor: 'pointer',
                                background: `linear-gradient(90deg, ${b.color}88 ${((customMagnitudes[b.type] - 5) / 495) * 100}%, var(--bg-input) 0%)`,
                              }}
                            />
                            <span style={{ fontSize: 10, color: b.color, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                              ±{customMagnitudes[b.type]}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{
        padding: 10, background: 'var(--bg-input)', borderRadius: 6,
        border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
        marginTop: 4,
      }}>
        💡 Las perturbaciones de <strong style={{ color: 'var(--yellow)' }}>comida</strong> y <strong style={{ color: 'var(--green)' }}>fisiología</strong> tienen duración fija.
        Las de <strong style={{ color: 'var(--red)' }}>fallos técnicos</strong> permiten configurar la duración.
      </div>
    </div>
  );
}

// Componente vacío para compatibilidad con imports existentes
export function PerturbationNotification() { return null; }
