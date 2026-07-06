// ============================================================
// APP – FRONTEND PURO (solo visualización con Chart.js)
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

import type { SimulationState, SimConfig, DataPoint, PerturbationType } from './types/simulation';

export interface BolusEvent { time: number; amount: number; }

import { Header } from './components/Header';
import { BlockDiagram } from './components/BlockDiagram';
import { MetricsPanel } from './components/MetricsPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { PerturbationsPanel } from './components/PerturbationsPanel';
import { UnifiedChart } from './components/Charts';

const WS_URL = 'ws://localhost:8080/ws';

const PERTURBATION_DURATIONS: Record<PerturbationType, number> = {
  meal_small: 45, meal_normal: 90, meal_large: 120,
  stress: 60, exercise: 40, occlusion: 30,
  ble_interference: 20, sensor_noise: 25,
};
const PERTURBATION_MAGNITUDES: Record<PerturbationType, number> = {
  meal_small: 1.5, meal_normal: 3.5, meal_large: 7.0,
  stress: 1.2, exercise: 1.5, occlusion: 0,
  ble_interference: 0, sensor_noise: 0,
};

const WINDOW_POINTS = 300;
const CONFIG_URL = 'http://localhost:8080/config';

// Config vacía mientras se carga del backend
const EMPTY_CONFIG: SimConfig = {
  pid: { kp: 0, ki: 0, kd: 0 },
  plant: { subcutaneousTimeConstant: 20, absorptionDelay: 10, glucoseSensitivity: 28, glucoseBasalProduction: 0.8, metabolismTimeConstant: 60 },
  setpoint: 100, initialGlucose: 180,
  maxInsulinRate: 4, minInsulinRate: 0,
  basalRate: 0.8, sensorNoiseLevel: 8, sensorUpdateInterval: 5, timeScale: 1,
};

export default function App() {
  const [config, setConfig]     = useState<SimConfig>(EMPTY_CONFIG);
  const [, setConfigReady] = useState(false);
  // simState empieza con valores neutros; el primer mensaje 'update' del backend
  // lo sobreescribe con datos reales. Esto evita null checks en toda la UI.
  const [simState, setSimState] = useState<SimulationState>({
    time: 0, setpoint: 100, glucoseReal: 180, glucoseMeasured: 180,
    error: 80, pTerm: 0, iTerm: 0, dTerm: 0, pidOutput: 0,
    insulinRate: 0, basalRate: 0.8, bolusAmount: 0, bolusInsulin: 0, actuatorSaturated: false,
    subcutaneousInsulin: 0, plasmaInsulin: 0, glucoseMetabolism: 180,
    sensorNoise: 0, sensorReading: 180, lastSensorUpdate: 0,
    bleConnected: true, blePacketLoss: 0.02, bleDelay: 50, lastValidReading: 180,
    perturbations: [], systemState: 'out_of_band', stableTime: 0,
    timeSinceLastDisturbance: 0, transientTime: 0, lastTransientTime: 0,
    hypoTime: 0, hyperTime: 0, systemFailure: false, failureReason: '',
    qosFailure: false, qosReason: '',
    alarms: [],
    metrics: { iae: 0, ise: 0, itae: 0, maxError: 80, overshoot: 0, timeInRange: 0, timeOutOfRange: 0, steadyStateError: 80, settlingTime: null, riseTime: null, recoveryTime: null },
  });
  // Solo se guarda la ventana actual visible (80 puntos procesados en el backend)
  const [history, setHistory]   = useState<DataPoint[]>([]);
  const [bolusEvents, setBolusEvents] = useState<BolusEvent[]>([]);
  const [totalBuffered, setTotalBuffered] = useState(0);

  const [running, setRunning]   = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [viewOffset, setViewOffset] = useState(0);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const simStateRef = useRef(simState);
  simStateRef.current = simState;
  const configRef = useRef(config);
  configRef.current = config;

  // ── Cargar config desde el backend al arrancar ──
  useEffect(() => {
    fetch(CONFIG_URL)
      .then(r => r.json())
      .then((backendCfg: any) => {
        // El backend envía el JSON en camelCase gracias a los json tags en Go,
        // por lo que coincide exactamente con la interfaz SimConfig.
        setConfig(backendCfg as SimConfig);
        setConfigReady(true);
      })
      .catch(() => {
        // Si falla (backend no levantó todavía), usar valores de EMPTY_CONFIG
        // y marcar igualmente como listo para no bloquear la UI.
        setConfigReady(true);
      });
  }, []);

  const send = useCallback((type: string, payload?: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'config', payload: configRef.current }));
      };

      ws.onclose = () => {
        setConnected(false);
        setRunning(false);
        reconnect = setTimeout(connect, 2000);
      };

      ws.onerror = () => { /* onclose dispara después */ };

      ws.onmessage = (event: MessageEvent) => {
        if (wsRef.current !== ws) return;

        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload: any;
        };

        if (msg.type === 'update') {
          // El backend manda a tasa fija (250ms) la info procesada
          setSimState(msg.payload.state);
          setHistory(msg.payload.points);
          setTotalBuffered(msg.payload.totalBuffered);
          if (msg.payload.bolusEvents) setBolusEvents(msg.payload.bolusEvents);

          // Si hay falla mortal, detener la simulación
          if (msg.payload.state.systemFailure) {
            setRunning(false);
            ws.send(JSON.stringify({ type: 'pause' }));
          }
        } else if (msg.type === 'ready') {
          // Backend ready
        }
      };
    }

    connect();
    return () => {
      if (reconnect) clearTimeout(reconnect);
      ws?.close();
    };
  }, []);

  function handleViewChange(newOffset: number) {
    const maxOffset = Math.max(0, totalBuffered - WINDOW_POINTS);
    const clamped = Math.max(0, Math.min(newOffset, maxOffset));
    setViewOffset(clamped);
    send('setView', { offset: clamped });
  }

  function handlePlay()   { setRunning(true);  send('start', { timeScale }); }
  function handlePause()  { setRunning(false); send('pause'); }

  function handleReset() {
    setRunning(false);
    setBolusEvents([]);
    send('reset', { setpoint: config.setpoint, initialGlucose: config.initialGlucose });
    setViewOffset(0);
  }

  function handleTimeScale(v: number) {
    setTimeScale(v);
    send('timeScale', { timeScale: v });
  }

  function handleConfigChange(newConfig: SimConfig) {
    setConfig(newConfig);
    send('config', newConfig);
    if ((simStateRef.current?.time ?? 0) === 0) {
      send('reset', { setpoint: newConfig.setpoint, initialGlucose: newConfig.initialGlucose });
    }
  }

  function handlePerturbation(type: PerturbationType, duration?: number, magnitude?: number) {
    send('perturbation', {
      type,
      magnitude:   magnitude ?? PERTURBATION_MAGNITUDES[type],
      startTime:   simStateRef.current.time,
      duration:    duration ?? PERTURBATION_DURATIONS[type],
      description: type,
    });
  }

  return (
    <div className="app-root">
      {!connected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(220,38,38,0.92)', color: '#fff',
          padding: '6px 16px', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(6px)',
        }}>
          ⚠️ Desconectado del backend Go. Ejecutá: 
          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4 }}>
            cd backend && ~/go/bin/go run .
          </code>
        </div>
      )}

      <Header
        state={simState}
        config={config}
        running={running}
        timeScale={timeScale}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onTimeScaleChange={handleTimeScale}
      />

      <div className="app-body">
        <div className="col-left">
          <div className="panel-header">
            <span style={{ color: 'var(--cyan)' }}>📊</span>
            <span className="panel-header-title">Estado del Sistema</span>
          </div>
          <div className="col-scroll" style={{ flex: '0 0 auto', maxHeight: '45%' }}>
            <MetricsPanel state={simState} />
          </div>

          <div className="panel-header" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--blue)' }}>🎛️</span>
            <span className="panel-header-title">Parámetros</span>
          </div>
          <div className="col-scroll">
            <ControlsPanel config={config} onConfigChange={handleConfigChange} />
          </div>
        </div>

        <div className="col-center">
          <div className="block-diagram-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'var(--blue)', fontSize: 12 }}>🔗</span>
              <span className="panel-header-title">Panel 1 — Diagrama de Lazo Cerrado</span>
              <span className={`badge ${simState.systemState === 'stable' ? 'badge-stable' : 'badge-transient'}`} style={{ marginLeft: 'auto' }}>
                <span className="pulse-dot" style={{
                  background: simState.systemState === 'stable' ? 'var(--green)' : 'var(--yellow)',
                  width: 6, height: 6,
                }} />
                {simState.systemState === 'stable'
                  ? `Estado Estable` + (simState.lastTransientTime > 0 ? ` (último transitorio: ${simState.lastTransientTime.toFixed(1)} min)` : '')
                  : `Estado Transitorio (${simState.transientTime.toFixed(1)} min)`}
              </span>
            </div>
            <BlockDiagram state={simState} running={running} />
          </div>

          <div className="charts-unified">
            <UnifiedChart
              data={history}
              setpoint={config.setpoint}
              running={running}
              totalBuffered={totalBuffered}
              viewOffset={viewOffset}
              maxOffset={Math.max(0, totalBuffered - WINDOW_POINTS)}
              onViewChange={handleViewChange}
              bolusEvents={bolusEvents}
            />
          </div>
        </div>

        <div className="col-right">
          <div className="panel-header">
            <span style={{ color: 'var(--yellow)' }}>⚡</span>
            <span className="panel-header-title">Perturbaciones</span>
          </div>
          <div className="col-scroll">
            <PerturbationsPanel
              onPerturbation={handlePerturbation}
              activePerturbations={simState.perturbations}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
