// ============================================================
// GRÁFICO UNIFICADO (CHART.JS)
// ============================================================
import { memo, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController
} from 'chart.js';
import { Chart, Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import type { DataPoint } from '../types/simulation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  annotationPlugin
);

const CHART_H = 120;

// Lee una variable CSS del :root para pasar al chart.js
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getPanelBase(): React.CSSProperties {
  return {
    background: cssVar('--chart-panel-bg') || 'rgba(15, 23, 42, 0.4)',
    borderBottom: '1px solid var(--border)',
    padding: '8px 12px 12px',
    position: 'relative',
    transition: 'background 0.4s ease',
  };
}

function SubLabel({ title, badge, badgeColor, badgeBg }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.5 }}>{title}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px',
        borderRadius: 4, color: badgeColor, background: badgeBg
      }}>{badge}</div>
    </div>
  );
}

// ── Opciones Comunes ──────────────────────────────────────────────────
const getCommonOptions = (yMin?: number, yMax?: number, hideX = true): any => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  elements: { point: { radius: 0, hitRadius: 10, hoverRadius: 4 } },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      align: 'start',
      labels: { color: cssVar('--chart-legend') || '#a0aec0', boxWidth: 8, font: { size: 10 } }
    },
    tooltip: {
      backgroundColor: cssVar('--chart-tooltip-bg') || 'rgba(15,23,42,0.9)',
      titleColor: cssVar('--cyan') || '#38bdf8',
      bodyColor: cssVar('--text-primary') || '#e8eeff',
      callbacks: {
        title: (items: any[]) => {
          if (!items.length) return '';
          const label = items[0].label as string;
          return `⏱ ${label}`;
        }
      }
    },
  },
  scales: {
    x: {
      type: 'category',
      display: !hideX,
      grid: { color: cssVar('--chart-grid') || 'rgba(30,45,77,0.5)' },
      ticks: { color: cssVar('--chart-tick') || '#718096', maxTicksLimit: 10 }
    },
    y: {
      type: 'linear',
      min: yMin,
      max: yMax,
      grid: { color: cssVar('--chart-grid') || 'rgba(30,45,77,0.5)' },
      ticks: { color: cssVar('--chart-tick') || '#718096', font: { size: 10 } }
    }
  }
});

function lineAnnotation(y: number, color: string, label: string, dash = [4, 4]): any {
  return {
    type: 'line',
    yMin: y, yMax: y,
    borderColor: color,
    borderWidth: 1,
    borderDash: dash,
    label: {
      display: true,
      content: label,
      position: 'end',
      backgroundColor: 'transparent',
      color: color,
      font: { size: 9, weight: 'normal' }
    }
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export const UnifiedChart = memo(function UnifiedChart({ data, setpoint, totalBuffered, viewOffset, onViewChange, bolusEvents, darkMode }: any) {
  const bolusList: { time: number; amount: number }[] = bolusEvents || [];
  const panelBase = getPanelBase();

  // Convertir minutos a formato hh:mm para etiquetas y tooltips
  const toHHMM = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const labels = useMemo(() => data.map((p: DataPoint) => toHHMM(p.time)), [data]);

  const glucoseDomain = useMemo(() => {
    if (data.length === 0) return { min: 60, max: 200 };
    const vals = data.flatMap((p: DataPoint) => [p.glucoseReal, p.glucoseMeasured, p.setpoint]);
    let lo = Math.floor(Math.min(...vals) / 10) * 10 - 10;
    let hi = Math.ceil(Math.max(...vals) / 10) * 10 + 10;
    if (lo > 70) lo = 60;
    if (hi < 180) hi = 200;
    return { min: lo, max: hi };
  }, [data]);

  const errorDomain = useMemo(() => {
    if (data.length === 0) return { min: -10, max: 10 };
    const vals = data.map((p: DataPoint) => p.error);
    const maxAbs = Math.ceil(Math.max(...vals.map(Math.abs)) / 5) * 5 + 5;
    return { min: -maxAbs, max: maxAbs };
  }, [data]);

  const perturbDomain = useMemo(() => {
    if (data.length === 0) return { min: -1, max: 1 };
    const vals = data.flatMap((p: DataPoint) => [
      p.perturbMeal || 0, p.perturbStress || 0, p.perturbExercise || 0,
      p.perturbOcclusion || 0, p.perturbBLE || 0
    ]);
    const maxAbs = Math.ceil(Math.max(...vals.map(Math.abs)));
    return { min: -maxAbs - 0.5, max: maxAbs + 0.5 };
  }, [data]);

  const insulinDomain = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 12 };
    const vals = data.flatMap((p: DataPoint) => [p.insulinRate || 0, p.basalRate || 0, p.bolusAmount || 0]);
    const hi = Math.ceil(Math.max(...vals, 2) / 2) * 2 + 1;
    return { min: 0, max: hi };
  }, [data]);

  // Colores de datasets: oscuros en dark mode, saturados en light mode
  const C = darkMode ? {
    cyan:    '#00d4ff',
    green:   '#22d3a6',
    red:     '#f43f5e',
    purple:  '#a855f7',
    orange:  '#f97316',
    lime:    '#84cc16',
    indigo:  '#6366f1',
    sky:     '#0891b2',
    orangeA: 'rgba(251,146,60,0.55)',
    skyA:    'rgba(8,145,178,0.18)',
  } : {
    // Modo claro: mismos tonos, más oscuros y saturados
    cyan:    '#0369a1',  // azul intenso sobre blanco
    green:   '#047857',  // verde oscuro
    red:     '#b91c1c',  // rojo fuerte
    purple:  '#6d28d9',  // violeta profundo
    orange:  '#c2410c',  // naranja quemado
    lime:    '#4d7c0f',  // verde lima oscuro
    indigo:  '#3730a3',  // azul índigo oscuro
    sky:     '#075985',  // azul cielo profundo
    orangeA: 'rgba(194,65,12,0.65)',
    skyA:    'rgba(7,89,133,0.18)',
  };

  // ── PANEL 1: Glucosa ──
  const data1 = {
    labels,
    datasets: [
      {
        label: `Setpoint (${setpoint})`,
        data: data.map((p: DataPoint) => p.setpoint),
        borderColor: C.cyan,
        borderWidth: 2,
        borderDash: [7, 3],
        stepped: 'before' as const
      },
      {
        label: 'Salida Proceso',
        data: data.map((p: DataPoint) => p.glucoseReal),
        borderColor: C.green,
        borderWidth: 2,
        tension: 0.4
      }
    ]
  };
  const options1 = useMemo(() => {
    const opt = getCommonOptions(glucoseDomain.min, glucoseDomain.max, true);
    opt.plugins!.annotation = {
      annotations: {
        hipo: lineAnnotation(70, '#7c3aed', 'Hipo 70'),
        hiper: lineAnnotation(180, '#d97706', 'Hiper 180')
      }
    };
    return opt;
  }, [glucoseDomain, darkMode]);

  // ── PANEL 2: Sensor ──
  const data2 = {
    labels,
    datasets: [
      {
        label: 'Medición Sensor',
        data: data.map((p: DataPoint) => p.glucoseMeasured),
        borderColor: C.cyan,
        borderWidth: 1.5,
        borderDash: [5, 2],
        tension: 0.4
      }
    ]
  };
  const options2 = useMemo(() => {
    const opt = getCommonOptions(glucoseDomain.min, glucoseDomain.max, true);
    opt.plugins!.annotation = {
      annotations: { sp: lineAnnotation(setpoint, '#00d4ff', 'SP', [6,3]) }
    };
    return opt;
  }, [glucoseDomain, setpoint, darkMode]);

  // ── PANEL 3: Error ──
  const data3 = {
    labels,
    datasets: [
      {
        label: 'Error e(t)',
        data: data.map((p: DataPoint) => p.error),
        borderColor: C.red,
        borderWidth: 2,
        tension: 0.4
      }
    ]
  };
  const options3 = useMemo(() => {
    const opt = getCommonOptions(errorDomain.min, errorDomain.max, true);
    opt.plugins!.annotation = {
      annotations: {
        zero: lineAnnotation(0, '#00d4ff', 'e = 0', []),
        p5: lineAnnotation(5, '#22d3a6', '+5', [3,3]),
        m5: lineAnnotation(-5, '#22d3a6', '-5', [3,3])
      }
    };
    return opt;
  }, [errorDomain, darkMode]);

  // ── PANEL 4: Perturbaciones ──
  const { hasMeal, hasStress, hasExercise, hasOccl, hasBLE, hasAny } = useMemo(() => ({
    hasMeal:    data.some((p: DataPoint) => (p.perturbMeal     || 0) !== 0),
    hasStress:  data.some((p: DataPoint) => (p.perturbStress   || 0) !== 0),
    hasExercise:data.some((p: DataPoint) => (p.perturbExercise || 0) !== 0),
    hasOccl:    data.some((p: DataPoint) => (p.perturbOcclusion || 0) !== 0),
    hasBLE:     data.some((p: DataPoint) => (p.perturbBLE      || 0) !== 0),
    hasAny:     data.some((p: DataPoint) => 
      (p.perturbMeal || 0) !== 0 || (p.perturbStress || 0) !== 0 ||
      (p.perturbExercise || 0) !== 0 || (p.perturbOcclusion || 0) !== 0 ||
      (p.perturbBLE || 0) !== 0
    ),
  }), [data]);

  const datasets4: any[] = [];
  if (hasMeal)    datasets4.push({ label: 'Comida',   data: data.map((p: DataPoint) => p.perturbMeal),      borderColor: C.orange,  tension: 0.4 });
  if (hasStress)  datasets4.push({ label: 'Estrés',   data: data.map((p: DataPoint) => p.perturbStress),    borderColor: C.purple,  tension: 0.4 });
  if (hasExercise)datasets4.push({ label: 'Ejercicio', data: data.map((p: DataPoint) => p.perturbExercise),  borderColor: C.lime,    tension: 0.4 });
  if (hasOccl)    datasets4.push({ label: 'Oclusión',  data: data.map((p: DataPoint) => p.perturbOcclusion), borderColor: C.red,     stepped: 'before' as const });
  if (hasBLE)     datasets4.push({ label: 'BLE',       data: data.map((p: DataPoint) => p.perturbBLE),       borderColor: C.indigo,  stepped: 'before' as const });

  const data4 = { labels, datasets: datasets4 };
  const options4 = useMemo(() => {
    const opt = getCommonOptions(perturbDomain.min, perturbDomain.max, true);
    opt.plugins!.annotation = {
      annotations: {
        zero: lineAnnotation(0, 'rgba(100,130,180,0.4)', !hasAny ? 'Sin perturbaciones' : '', [])
      }
    };
    return opt;
  }, [perturbDomain, hasAny, darkMode]);

  // ── PANEL 5: Insulina ──
  const data5 = useMemo(() => {
    const bolusData = new Array(data.length).fill(0);
    bolusList.forEach((b: {time: number, amount: number}) => {
      if (data.length === 0) return;
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < data.length; i++) {
        const diff = Math.abs(data[i].time - b.time);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      if (data[closestIdx].perturbOcclusion === 0) {
        bolusData[closestIdx] += b.amount;
      }
    });

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Bolo',
          data: bolusData,
          backgroundColor: C.orangeA,
          barThickness: 5
        },
        {
          type: 'line' as const,
          label: 'Basal PID',
          data: data.map((p: DataPoint) => p.basalRate || 0),
          borderColor: C.sky,
          borderWidth: 1.5,
          borderDash: [4, 4],
          backgroundColor: C.skyA,
          fill: true,
          stepped: 'before' as const
        },
        {
          type: 'line' as const,
          label: 'Insulina Inyectada',
          data: data.map((p: DataPoint, i: number) => (p.insulinRate || 0) + bolusData[i]),
          borderColor: C.purple,
          borderWidth: 2,
          stepped: 'before' as const
        }
      ]
    };
  }, [data, labels, bolusList, darkMode]);
  const options5 = useMemo(() => {
    const opt = getCommonOptions(insulinDomain.min, insulinDomain.max, false);
    const bolusAnnotations: Record<string, any> = {};
    bolusList.forEach((b, i) => {
      bolusAnnotations[`bolo_${i}`] = {
        type: 'line',
        xMin: b.time.toFixed(1),
        xMax: b.time.toFixed(1),
        borderColor: '#fb923c',
        borderWidth: 3,
        borderDash: [],
        label: {
          display: true,
          content: `Bolo ${b.amount.toFixed(1)}U`,
          position: 'start',
          backgroundColor: 'rgba(251,146,60,0.85)',
          color: '#fff',
          font: { size: 10, weight: 'bold' as const },
          padding: 3,
        },
      };
    });
    opt.plugins!.annotation = { annotations: bolusAnnotations };
    return opt;
  }, [insulinDomain, bolusList, darkMode]);

  // ── UI ──
  return (
    <div style={{ background: 'var(--bg-base)', transition: 'background 0.4s ease' }}>
      <div style={panelBase}>
        <SubLabel title="① Salida del Proceso" badge="mg/dL" badgeColor="var(--green)" badgeBg="rgba(34,211,166,0.12)" />
        <div style={{ height: CHART_H }}><Line data={data1} options={options1} /></div>
      </div>

      <div style={panelBase}>
        <SubLabel title="② Salida del Sensor" badge="mg/dL" badgeColor="var(--blue)" badgeBg="rgba(59,130,246,0.12)" />
        <div style={{ height: CHART_H }}><Line data={data2} options={options2} /></div>
      </div>

      <div style={panelBase}>
        <SubLabel title="③ Error e(t)" badge="e(t)" badgeColor="var(--red)" badgeBg="rgba(244,63,94,0.12)" />
        <div style={{ height: CHART_H }}><Line data={data3} options={options3} /></div>
      </div>

      <div style={panelBase}>
        <SubLabel title="④ Señales de Perturbación" badge="mg/dL·min⁻¹" badgeColor="var(--yellow)" badgeBg="rgba(251,191,36,0.12)" />
        <div style={{ height: CHART_H }}><Line data={data4} options={options4} /></div>
      </div>

      <div style={{ ...panelBase, borderBottom: 'none' }}>
        <SubLabel title="⑤ Insulina Administrada" badge="U/h" badgeColor="#22d3ee" badgeBg="rgba(34,211,238,0.10)" />
        <div style={{ height: CHART_H + 30 }}><Chart type="line" data={data5} options={options5} /></div>
      </div>

      {/* Navegación manual de scroll al pasado */}
      <div id="tut-history-slider" style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', transition: 'background 0.4s ease' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Navegar historial :</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalBuffered - 300)}
          value={viewOffset}
          onChange={(e) => onViewChange?.(parseInt(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 80, textAlign: 'right' }}>
          Offset: {viewOffset} pts
        </span>
      </div>
    </div>
  );
});

// Legacy exports
export function GlucoseChart({ data, setpoint }: { data: DataPoint[]; setpoint: number }) { return <UnifiedChart data={data} setpoint={setpoint} />; }
export function ErrorChart(_: { data: DataPoint[] }) { return <></>; }
export function ControlEffortChart(_: { data: DataPoint[] }) { return <></>; }
export function PIDTermsChart(_: { data: DataPoint[] }) { return <></>; }
