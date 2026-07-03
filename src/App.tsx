// ============================================================
// APP – Componente raíz, orquestador de la simulación
// ============================================================
// Gestiona el loop de simulación usando setInterval.
// Cada tick del timer:
//   1) Avanza el estado de la simulación (simulationStep)
//   2) Extrae el punto de datos para los gráficos
//   3) Actualiza el estado de React → re-render de los paneles
//
// La velocidad del timer se controla con `timeScale`:
//   timeScale = 1 → 1 tick/s = 1 min simulado/s (DT=0.5min → 2 ticks/s)
//   timeScale = 4 → 4×, etc.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

import type { SimulationState, SimConfig, DataPoint, PerturbationType } from './types/simulation';
import { simulationStep, createInitialState, extractDataPoint } from './engine/simulationEngine';
import { DEFAULT_CONFIG, PERTURBATION_EXPLANATIONS } from './engine/config';

import { Header } from './components/Header';
import { BlockDiagram } from './components/BlockDiagram';
import { MetricsPanel } from './components/MetricsPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { PerturbationsPanel, PerturbationNotification } from './components/PerturbationsPanel';
import { UnifiedChart } from './components/Charts';

// ── Duración de las perturbaciones (minutos simulados) ───────
const PERTURBATION_DURATIONS: Record<PerturbationType, number> = {
  meal_small: 45,
  meal_normal: 90,
  meal_large: 120,
  stress: 60,
  exercise: 40,
  occlusion: 30,
  ble_interference: 20,
  sensor_noise: 25,
};

// ── Magnitud de las perturbaciones ───────────────────────────
const PERTURBATION_MAGNITUDES: Record<PerturbationType, number> = {
  meal_small: 1.5,
  meal_normal: 3.5,
  meal_large: 7.0,
  stress: 1.2,
  exercise: 1.5,
  occlusion: 0,
  ble_interference: 0,
  sensor_noise: 0,
};

// Tiempo entre ticks en ms → DT=0.5min, timeScale=1 → 500ms
function tickInterval(timeScale: number): number {
  return Math.round(500 / timeScale);
}

export default function App() {
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<SimulationState>(
    createInitialState(DEFAULT_CONFIG.setpoint, DEFAULT_CONFIG.initialGlucose),
  );
  const [history, setHistory] = useState<DataPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [notification, setNotification] = useState<PerturbationType | null>(null);
  // Offset de vista (0 = más reciente, >0 = pasos hacia atrás en el buffer)
  const [viewOffset, setViewOffset] = useState(0);

  // Refs para el loop de simulación (evitar closures obsoletas)
  const stateRef = useRef(state);
  const configRef = useRef(config);
  const runningRef = useRef(running);
  const timeScaleRef = useRef(timeScale);

  stateRef.current = state;
  configRef.current = config;
  runningRef.current = running;
  timeScaleRef.current = timeScale;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Buffer circular de historial ─────────────────────────────
  // WINDOW_POINTS: puntos visibles en el gráfico (150 min = 2.5 h)
  // MAX_HISTORY:   buffer circular en memoria (1200 min = 10 h)
  // El buffer es un ref → no causa re-renders, NO satura la RAM.
  const WINDOW_POINTS = 300;
  const MAX_HISTORY   = 1200;
  const circularBufferRef = useRef<DataPoint[]>([]);

  // Función que extrae la ventana visible del buffer circular
  const getView = useCallback((offset: number): DataPoint[] => {
    const buf = circularBufferRef.current;
    const end = Math.max(0, buf.length - offset);
    const start = Math.max(0, end - WINDOW_POINTS);
    return buf.slice(start, end);
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    const currentState = stateRef.current;
    const currentConfig = configRef.current;

    // Sincronizar el setpoint del config al estado
    const stateWithSP = { ...currentState, setpoint: currentConfig.setpoint };

    const nextState = simulationStep(stateWithSP, currentConfig);
    const dataPoint = extractDataPoint(nextState);

    setState(nextState);

    // Agregar al buffer circular; descartar el más viejo si está lleno
    const buf = circularBufferRef.current;
    if (buf.length >= MAX_HISTORY) buf.shift();
    buf.push(dataPoint);

    // Cuando corre → siempre mostrar los últimos WINDOW_POINTS (offset = 0)
    setViewOffset(0);
    setHistory(buf.slice(-WINDOW_POINTS));
  }, []);

  // Cambiar la vista hacia atrás/adelante en el buffer (solo cuando pausado)
  function handleViewChange(newOffset: number) {
    const buf = circularBufferRef.current;
    const maxOffset = Math.max(0, buf.length - WINDOW_POINTS);
    const clamped = Math.max(0, Math.min(newOffset, maxOffset));
    setViewOffset(clamped);
    setHistory(getView(clamped));
  }

  // ── Gestión del timer ────────────────────────────────────────
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(tick, tickInterval(timeScale));
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, timeScale, tick]);

  // ── Handlers ─────────────────────────────────────────────────
  function handlePlay() { setRunning(true); }
  function handlePause() { setRunning(false); }

  function handleReset() {
    setRunning(false);
    const initial = createInitialState(config.setpoint, config.initialGlucose);
    setState(initial);
    circularBufferRef.current = [];
    setHistory([]);
    setViewOffset(0);
    setNotification(null);
  }

  function handleTimeScale(v: number) {
    setTimeScale(v);
  }

  function handleConfigChange(newConfig: SimConfig) {
    setConfig(newConfig);
    // Si la simulación no ha avanzado, actualizar el estado inicial directamente
    // para que se refleje de inmediato en los gráficos y métricas.
    if (stateRef.current.time === 0) {
      const initial = createInitialState(newConfig.setpoint, newConfig.initialGlucose);
      setState(initial);
      circularBufferRef.current = [];
      setHistory([]);
      setViewOffset(0);
    }
  }

  // ── Perturbaciones ───────────────────────────────────────────
  function handlePerturbation(type: PerturbationType) {
    const currentState = stateRef.current;

    setState(prev => ({
      ...prev,
      perturbations: [
        ...prev.perturbations,
        {
          type,
          magnitude: PERTURBATION_MAGNITUDES[type],
          startTime: currentState.time,
          duration: PERTURBATION_DURATIONS[type],
          description: PERTURBATION_EXPLANATIONS.find(p => p.type === type)?.title ?? type,
        },
      ],
    }));

    setNotification(type);
    // Auto-cerrar notificación después de 8 segundos
    setTimeout(() => setNotification(null), 8000);
  }

  return (
    <div className="app-root">
      {/* ── Barra superior ── */}
      <Header
        state={state}
        config={config}
        running={running}
        timeScale={timeScale}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onTimeScaleChange={handleTimeScale}
      />

      <div className="app-body">
        {/* ════════════════════════════════════════
            COLUMNA IZQUIERDA – Controles & Métricas
            ════════════════════════════════════════ */}
        <div className="col-left">
          {/* Métricas */}
          <div className="panel-header">
            <span style={{ color: 'var(--cyan)' }}>📊</span>
            <span className="panel-header-title">Estado del Sistema</span>
          </div>
          <div className="col-scroll" style={{ flex: '0 0 auto', maxHeight: '45%' }}>
            <MetricsPanel state={state} />
          </div>

          {/* Controles */}
          <div className="panel-header" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--blue)' }}>🎛️</span>
            <span className="panel-header-title">Parámetros</span>
          </div>
          <div className="col-scroll">
            <ControlsPanel config={config} onConfigChange={handleConfigChange} />
          </div>
        </div>

        {/* ════════════════════════════════════════
            COLUMNA CENTRAL – Diagrama + Gráficos
            ════════════════════════════════════════ */}
        <div className="col-center">
          {/* Panel 1: Diagrama de bloques */}
          <div className="block-diagram-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'var(--blue)', fontSize: 12 }}>🔗</span>
              <span className="panel-header-title">
                Panel 1 — Diagrama de Lazo Cerrado
              </span>
              <span
                className={`badge ${state.systemState === 'stable' ? 'badge-stable' : 'badge-transient'}`}
                style={{ marginLeft: 'auto' }}
              >
                <span className="pulse-dot" style={{
                  background: state.systemState === 'stable' ? 'var(--green)' : 'var(--yellow)',
                  width: 6, height: 6,
                }} />
                {state.systemState === 'stable' ? 'Estado Estable' : 'Estado Transitorio'}
              </span>
            </div>
            <BlockDiagram state={state} running={running} />
          </div>

          {/* Gráfico unificado apilado */}
          <div className="charts-unified">
            <UnifiedChart
              data={history}
              setpoint={config.setpoint}
              running={running}
              totalBuffered={circularBufferRef.current.length}
              viewOffset={viewOffset}
              maxOffset={Math.max(0, circularBufferRef.current.length - 300)}
              onViewChange={handleViewChange}
            />
          </div>
        </div>

        {/* ════════════════════════════════════════
            COLUMNA DERECHA – Perturbaciones
            ════════════════════════════════════════ */}
        <div className="col-right">
          <div className="panel-header">
            <span style={{ color: 'var(--yellow)' }}>⚡</span>
            <span className="panel-header-title">Perturbaciones</span>
          </div>
          <div className="col-scroll">
            <PerturbationsPanel
              onPerturbation={handlePerturbation}
              activePerturbations={state.perturbations}
            />
          </div>
        </div>
      </div>

      {/* ── Notificación flotante ── */}
      <PerturbationNotification
        perturbationType={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}
