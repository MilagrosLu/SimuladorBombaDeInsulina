// ============================================================
// GRÁFICO UNIFICADO – 5 paneles apilados con scroll
// ============================================================
// ① Salida del Proceso + Setpoint (dinámico)
// ② Salida del Sensor (elemento de medición)
// ③ Señal de Error e(t) = Medición − Setpoint
// ④ Señales de Perturbación por tipo
// ⑤ Insulina Administrada (Basal continua + Bolo de corrección)
// ============================================================
import { useMemo } from 'react';
import {
  ComposedChart, LineChart, Line, Area, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import type { DataPoint } from '../types/simulation';

// ── Tooltip personalizado ─────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: number;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(8,15,30,0.97)',
      border: '1px solid rgba(100,130,180,0.3)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#4a6080', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        t = {(label ?? 0).toFixed(1)} min
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{p.name}:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: p.color, fontWeight: 700, fontSize: 11 }}>
            {p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

const axisStyle = {
  tick: { fill: '#3d5470', fontSize: 9, fontFamily: 'var(--font-mono)' },
  axisLine: { stroke: '#1a2840' },
  tickLine: { stroke: '#1a2840' },
};

// ── Etiqueta de encabezado de cada sub-panel ──────────────────
function SubLabel({ title, badge, badgeColor, badgeBg }: {
  title: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0 2px 0', flexShrink: 0,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-secondary)',
      }}>{title}</span>
      <span style={{
        fontSize: 9, padding: '1px 7px', borderRadius: 100,
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        background: badgeBg, color: badgeColor, flexShrink: 0,
      }}>{badge}</span>
    </div>
  );
}

// Altura del área de gráfico de cada sub-panel
const CHART_H = 165;

const panelBase: React.CSSProperties = {
  background: 'var(--bg-card)',
  padding: '4px 10px 8px 10px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function UnifiedChart({ data, setpoint }: { data: DataPoint[]; setpoint: number }) {

  // ── Dominio Y para glucosa (mg/dL) ───────────────────────────
  const glucoseDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [60, 220];
    const vals = data.flatMap(p => [p.glucoseReal, p.glucoseMeasured, p.setpoint]);
    const lo = Math.floor(Math.min(...vals) / 10) * 10;
    const hi = Math.ceil(Math.max(...vals) / 10) * 10;
    return [Math.max(40, lo - 10), Math.min(350, hi + 20)];
  }, [data]);

  // ── Dominio Y para el error ───────────────────────────────────
  const errorDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [-30, 30];
    const maxAbs = Math.max(...data.map(p => Math.abs(p.error ?? 0)), 10);
    return [-(Math.ceil(maxAbs / 5) * 5 + 5), Math.ceil(maxAbs / 5) * 5 + 5];
  }, [data]);

  // ── Dominio Y para perturbaciones ────────────────────────────
  const perturbDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [-2, 8];
    const vals = data.flatMap(p => [
      p.perturbMeal ?? 0, p.perturbStress ?? 0, p.perturbExercise ?? 0,
      p.perturbOcclusion ?? 0, p.perturbBLE ?? 0,
    ]);
    return [Math.floor(Math.min(...vals, -0.5)) - 0.5, Math.ceil(Math.max(...vals, 0.5)) + 0.5];
  }, [data]);

  // ── Dominio Y para insulina (U/h) ────────────────────────────
  const insulinDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 12];
    const vals = data.flatMap(p => [p.insulinRate ?? 0, p.basalRate ?? 0]);
    const hi = Math.ceil(Math.max(...vals, 2) / 2) * 2 + 1;
    return [0, hi];
  }, [data]);

  // ── Flags de presencia por tipo de perturbación ───────────────
  const hasMeal     = data.some(p => (p.perturbMeal ?? 0) !== 0);
  const hasStress   = data.some(p => (p.perturbStress ?? 0) !== 0);
  const hasExercise = data.some(p => (p.perturbExercise ?? 0) !== 0);
  const hasOccl     = data.some(p => (p.perturbOcclusion ?? 0) !== 0);
  const hasBLE      = data.some(p => (p.perturbBLE ?? 0) !== 0);
  const hasAny = hasMeal || hasStress || hasExercise || hasOccl || hasBLE;

  // ── Eventos de inicio de bolo para anotaciones ───────────────
  const bolusEvents = useMemo(() => {
    const events: { time: number; bolus: number }[] = [];
    let prevWasBolus = false;
    for (const p of data) {
      const isBolus = (p.bolusAmount ?? 0) > 0.15;
      if (isBolus && !prevWasBolus) {
        events.push({ time: p.time, bolus: parseFloat((p.bolusAmount ?? 0).toFixed(2)) });
      }
      prevWasBolus = isBolus;
    }
    return events;
  }, [data]);

  return (
    <div>

      {/* ━━━━━ ① SALIDA DEL PROCESO + SETPOINT ━━━━━ */}
      <div style={panelBase}>
        <SubLabel
          title="① Salida del Proceso"
          badge="mg/dL"
          badgeColor="var(--green)"
          badgeBg="rgba(34,211,166,0.12)"
        />
        <div style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 56, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(30,45,77,0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="time" {...axisStyle} hide />
              <YAxis {...axisStyle} domain={glucoseDomain} unit=" mg" width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
              <ReferenceLine y={70}  stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: 'Hipo 70',   position: 'right', fill: '#7c3aed', fontSize: 8 }} />
              <ReferenceLine y={180} stroke="#d97706" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: 'Hiper 180', position: 'right', fill: '#d97706', fontSize: 8 }} />
              {/* Setpoint como serie de datos → se desplaza si cambia */}
              <Line type="stepAfter" dataKey="setpoint"
                stroke="var(--cyan)" strokeWidth={2} strokeDasharray="7 3" dot={false}
                name={`Setpoint (${setpoint} mg/dL)`} isAnimationActive={false} />
              <Line type="monotone" dataKey="glucoseReal"
                stroke="var(--green)" strokeWidth={2} dot={false}
                name="Sal. Proceso (glucosa real)" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ━━━━━ ② SALIDA DEL SENSOR ━━━━━ */}
      <div style={panelBase}>
        <SubLabel
          title="② Salida del Sensor  (Guardian 4 – σ≈8 mg/dL)"
          badge="mg/dL"
          badgeColor="var(--blue)"
          badgeBg="rgba(59,130,246,0.12)"
        />
        <div style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 56, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(30,45,77,0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="time" {...axisStyle} hide />
              <YAxis {...axisStyle} domain={glucoseDomain} unit=" mg" width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
              <ReferenceLine y={setpoint} stroke="var(--cyan)" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: 'SP', position: 'right', fill: 'var(--cyan)', fontSize: 8 }} />
              <Line type="monotone" dataKey="glucoseMeasured"
                stroke="var(--blue)" strokeWidth={1.5} dot={false} strokeDasharray="5 2"
                name="Sal. Sensor (medición)" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ━━━━━ ③ SEÑAL DE ERROR e(t) ━━━━━ */}
      <div style={panelBase}>
        <SubLabel
          title="③ Error  e(t) = Medición − Setpoint"
          badge="e(t)"
          badgeColor="var(--red)"
          badgeBg="rgba(244,63,94,0.12)"
        />
        <div style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 56, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(30,45,77,0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="time" {...axisStyle} hide />
              <YAxis {...axisStyle} domain={errorDomain} unit=" mg" width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
              <ReferenceLine y={0}  stroke="var(--cyan)" strokeWidth={1.5}
                label={{ value: 'e = 0', position: 'right', fill: 'var(--cyan)', fontSize: 8 }} />
              <ReferenceLine y={8}  stroke="var(--green)" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: '+8', position: 'right', fill: 'var(--green)', fontSize: 7 }} />
              <ReferenceLine y={-8} stroke="var(--green)" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: '-8', position: 'right', fill: 'var(--green)', fontSize: 7 }} />
              <Line type="monotone" dataKey="error"
                stroke="var(--red)" strokeWidth={2} dot={false}
                name="Error e(t)" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ━━━━━ ④ SEÑALES DE PERTURBACIÓN ━━━━━ */}
      <div style={panelBase}>
        <SubLabel
          title="④ Señal de Perturbación"
          badge="mg/dL·min⁻¹"
          badgeColor="var(--yellow)"
          badgeBg="rgba(251,191,36,0.12)"
        />
        <div style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 56, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(30,45,77,0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="time" {...axisStyle} hide />
              <YAxis {...axisStyle} domain={perturbDomain} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
              <ReferenceLine y={0} stroke="rgba(100,130,180,0.4)" strokeWidth={1} />
              {!hasAny && (
                <ReferenceLine y={0}
                  label={{ value: 'Sin perturbaciones activas', position: 'insideTopLeft', fill: '#4a6080', fontSize: 10 }} />
              )}
              {hasMeal && (
                <Line type="monotone" dataKey="perturbMeal"
                  stroke="#f97316" strokeWidth={2} dot={false}
                  name="Comida (D_meal)" isAnimationActive={false} />
              )}
              {hasStress && (
                <Line type="monotone" dataKey="perturbStress"
                  stroke="#a855f7" strokeWidth={2} dot={false}
                  name="Estrés (D_stress)" isAnimationActive={false} />
              )}
              {hasExercise && (
                <Line type="monotone" dataKey="perturbExercise"
                  stroke="#84cc16" strokeWidth={2} dot={false}
                  name="Ejercicio (D_exercise)" isAnimationActive={false} />
              )}
              {hasOccl && (
                <Line type="stepAfter" dataKey="perturbOcclusion"
                  stroke="#ef4444" strokeWidth={2} dot={false}
                  name="Oclusión cánula" isAnimationActive={false} />
              )}
              {hasBLE && (
                <Line type="stepAfter" dataKey="perturbBLE"
                  stroke="#6366f1" strokeWidth={2} dot={false}
                  name="Interferencia BLE" isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ━━━━━ ⑤ INSULINA ADMINISTRADA (Basal + Bolo) ━━━━━ */}
      <div style={{ ...panelBase, borderBottom: 'none' }}>
        <SubLabel
          title="⑤ Insulina Administrada"
          badge="U/h"
          badgeColor="#22d3ee"
          badgeBg="rgba(34,211,238,0.10)"
        />
        <div style={{ height: CHART_H + 30 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.map(p => ({
                ...p,
                basalRate:   p.basalRate   ?? 0,
                bolusAmount: p.bolusAmount ?? 0,
                insulinRate: p.insulinRate ?? 0,
              }))}
              margin={{ top: 4, right: 56, left: -8, bottom: 18 }}
            >
              <CartesianGrid stroke="rgba(30,45,77,0.8)" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                {...axisStyle}
                label={{ value: 'tiempo (min)', position: 'insideBottomRight', offset: -4, fill: '#3d5470', fontSize: 9 }}
              />
              <YAxis {...axisStyle} domain={insulinDomain} unit=" U/h" width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />

              {/* Área rellena: tasa basal continua de fondo */}
              <Area
                type="stepAfter"
                dataKey="basalRate"
                stroke="#0891b2"
                strokeWidth={1.5}
                fill="rgba(8,145,178,0.18)"
                dot={false}
                name="Tasa Basal"
                isAnimationActive={false}
              />

              {/* Barras: bolo de corrección (por encima del basal) */}
              <Bar
                dataKey="bolusAmount"
                fill="rgba(251,146,60,0.55)"
                stroke="#f97316"
                strokeWidth={0}
                name="Bolo Corrección"
                isAnimationActive={false}
                maxBarSize={5}
              />

              {/* Línea: tasa total administrada = basal + bolo */}
              <Line
                type="stepAfter"
                dataKey="insulinRate"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                name="Total (Basal + Bolo)"
                isAnimationActive={false}
              />

              {/* Marcas verticales con valor al inicio de cada bolo */}
              {bolusEvents.map(ev => (
                <ReferenceLine
                  key={ev.time}
                  x={ev.time}
                  stroke="rgba(251,146,60,0.45)"
                  strokeDasharray="3 2"
                  strokeWidth={1}
                  label={{
                    value: `${ev.bolus.toFixed(1)} U/h`,
                    position: 'top',
                    fill: '#f97316',
                    fontSize: 8,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// ── Exportaciones legacy (compatibilidad) ─────────────────────
export function GlucoseChart({ data, setpoint }: { data: DataPoint[]; setpoint: number }) {
  return <UnifiedChart data={data} setpoint={setpoint} />;
}
export function ErrorChart(_: { data: DataPoint[] }) { return <></>; }
export function ControlEffortChart(_: { data: DataPoint[] }) { return <></>; }
export function PIDTermsChart(_: { data: DataPoint[] }) { return <></>; }
