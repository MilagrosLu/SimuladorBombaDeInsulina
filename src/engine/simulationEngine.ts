// ============================================================
// MOTOR DE SIMULACIÓN – Bomba de Insulina MiniMed 780G
// ============================================================
//
// CONVENCIÓN DE SIGNOS (CRÍTICO):
//   error e(t) = G_medida(t) − SP  (positivo cuando la MEDICIÓN supera el setpoint)
//   El controlador solo ve la señal del sensor (glucosaMedida), no la glucosa real.
//   Cuando glucosa medida está ALTA → error > 0 → PID inyecta MÁS insulina
//   Cuando glucosa medida está BAJA → error < 0 → PID reduce insulina (mínimo 0)
//
// MODELO FISIOLÓGICO – Bergman Minimal Model:
//   dG/dt = −p1·(G − Gb) − X·G·Ks + D(t)   [mg/dL/min]
//   dX/dt = −p2·X + p3·I                     [insulina activa en tejido]
//   dI/dt = (u − I) / τ_sub                  [absorción subcutánea]
//
//   p1 = 0.028 min⁻¹   clearance natural de glucosa
//   p2 = 0.025 min⁻¹   clearance de insulina activa
//   p3 = 0.013 U⁻¹min⁻² efecto insulina → tejido
//   Gb = 100 mg/dL      glucosa basal de referencia
//   Ks = sensibilidad escalada (ajustable en slider)
//
// ============================================================

import type {
  SimulationState,
  SimConfig,
  PerturbationEvent,
  DataPoint,
} from '../types/simulation';

// ── Paso de integración ──────────────────────────────────────
const DT = 0.5;           // minutos simulados por paso

// ── Criterios de estado estable ──────────────────────────────
const STABLE_THRESHOLD = 8;   // ±mg/dL de banda de estado estable
const STABLE_TIME_REQ = 20;  // minutos continuos dentro de la banda

// ── Parámetros del modelo Bergman ────────────────────────────
const p1 = 0.022;   // min⁻¹  — clearance de glucosa (más lento = transitorio más largo)
const p2 = 0.025;   // min⁻¹  — clearance de insulina activa
const p3 = 0.018;   // U⁻¹·min⁻² — ganancia insulina→efecto (aumentado para mejor visibilidad)

// ── Utilidades ───────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gaussianNoise(std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return std * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ── Estado persistente entre pasos ──────────────────────────
let integralAccum = 0;
let prevPIDError = 0;
let filteredDerivative = 0;  // filtro pasa-bajos de la derivada
let tissueInsulinEffect = 0; // X(t): insulina activa en tejido

// ── Sensor: sin buffer de retardo (sensor mide la salida del proceso directamente) ──
// El Guardian 4 tiene MARD ~10.6%. Se modela como ruido gaussiano σ = 8 mg/dL,
// que representa la variabilidad aleatoria del sensor sobre la glucosa real.
// No se modela retardo de transporte (ISF vs plasma) para simplificar la visualización.

// ── Última lectura BLE válida ────────────────────────────────
let lastBLEReading = 100;

// ============================================================
// CONTROLADOR PID
// ============================================================
// u(t) = Kp·e(t) + Ki·∫e·dt + Kd·de/dt
//
// donde e(t) = G(t) − SP  (positivo = glucosa alta = inyectar insulina)
//
// Salida en U/h, clampada al rango [minRate, maxRate].
// ============================================================
function computePID(
  pidError: number,   // e(t) = glucosa − setpoint
  dt: number,
  config: SimConfig,
): { p: number; i: number; d: number; output: number; saturated: boolean } {
  const { kp, ki, kd } = config.pid;

  // ── Proporcional ─────────────────────────────────────────
  const p = kp * pidError;

  // ── Integral (Ideal, sin saturación) ─────────────────────
  // Anti-windup: limita el acumulador integral
  const INTEGRAL_LIMIT = 1500;
  integralAccum += pidError * dt;
  integralAccum = clamp(integralAccum, -INTEGRAL_LIMIT, INTEGRAL_LIMIT);
  const i = ki * integralAccum;

  // ── Derivativo con filtro pasa-bajos ─────────────────────
  // α = 0.15 → atenúa frecuencias del ruido del sensor
  const ALPHA_D = 0.15;
  const rawDeriv = (pidError - prevPIDError) / dt;
  filteredDerivative = ALPHA_D * rawDeriv + (1 - ALPHA_D) * filteredDerivative;
  const d = kd * filteredDerivative;

  prevPIDError = pidError;

  // ── Salida (Actuador ideal, solo limitamos a >= 0) ───────
  const rawOutput = p + i + d;
  const output = Math.max(0, rawOutput);
  const saturated = false; // Sin saturación superior

  return { p, i, d, output, saturated };
}

// ============================================================
// PLANTA – Modelo de Bergman (Euler explícito)
// ============================================================
function stepPlant(
  glucose: number,
  subcutaneousInsulin: number,   // I_sub (ya actualizado)
  perturbationEffect: number,
  sensitivityScale: number,
  dt: number,
): number {
  const Gb = 100;  // glucosa basal de referencia

  // Estado 2: Insulina activa en tejido
  //   dX/dt = −p2·X + p3·I_sub
  const dX = -p2 * tissueInsulinEffect + p3 * subcutaneousInsulin;
  tissueInsulinEffect += dX * dt;

  // Estado 3: Glucosa en sangre
  //   dG/dt = −p1·(G − Gb) − X·G·Ks + D(t)
  const dG = -p1 * (glucose - Gb)
    - tissueInsulinEffect * glucose * sensitivityScale
    + perturbationEffect;

  return clamp(glucose + dG * dt, 20, 400);
}

// ============================================================
// SENSOR GUARDIAN 4 – Medición directa + ruido gaussiano
// ============================================================
// El sensor mide la salida actual del proceso (glucoseReal) con:
//   • Ruido gaussiano: σ = noiseLevel mg/dL (configurable por slider)
//     Basado en MARD real del Guardian 4 (~10.6%), equivalente a σ ≈ 8 mg/dL
//   • Sin retardo de transporte (simplificación educativa: sensor = proceso + ruido)
//
// La lectura se actualiza en CADA paso de simulación (DT = 0.5 min).
// El intervalo BLE solo afecta cuándo el controlador recibe la señal.
// ============================================================
function stepSensor(
  processOutput: number, // salida actual del proceso = glucoseReal
  noiseLevel: number,    // σ del ruido en mg/dL (Guardian 4 real: ~8 mg/dL)
  config: SimConfig,
  time: number,
  lastSensorUpdate: number,
): { reading: number; updated: boolean } {
  // Medición = salida del proceso + ruido gaussiano (modelo Guardian 4)
  const noise = gaussianNoise(noiseLevel);
  const reading = clamp(processOutput + noise, 20, 400);

  // El controlador recibe una nueva lectura según el intervalo de comunicación
  const updated = (time - lastSensorUpdate) >= config.sensorUpdateInterval;

  return { reading, updated };
}

// ============================================================
// PERTURBACIONES
// ============================================================
// Retorna el efecto total en glucosa Y los efectos individuales por tipo,
// para poder graficar cada señal de perturbación por separado con color propio.
// ============================================================
function computePerturbationEffect(
  perturbations: PerturbationEvent[],
  time: number,
): {
  glucoseEffect: number;
  mealEffect: number;
  stressEffect: number;
  exerciseEffect: number;
  occlusionActive: boolean;
  bleInterferenceActive: boolean;
} {
  let mealEffect = 0;
  let stressEffect = 0;
  let exerciseEffect = 0;
  let occlusionActive = false;
  let bleInterferenceActive = false;

  for (const p of perturbations) {
    if (time < p.startTime || time > p.startTime + p.duration) continue;
    const progress = (time - p.startTime) / p.duration;

    switch (p.type) {
      case 'meal_small':
      case 'meal_normal':
      case 'meal_large':
        // Curva gaussiana: pico al 15% del tiempo, caída exponencial
        mealEffect += p.magnitude * Math.exp(-5 * (progress - 0.15) ** 2);
        break;
      case 'stress':
        stressEffect += p.magnitude * Math.sin(progress * Math.PI);
        break;
      case 'exercise':
        exerciseEffect -= p.magnitude * Math.sin(progress * Math.PI);
        break;
      case 'occlusion':
        occlusionActive = true;
        break;
      case 'ble_interference':
        bleInterferenceActive = true;
        break;
      case 'sensor_noise':
        break;
    }
  }

  return {
    glucoseEffect: mealEffect + stressEffect + exerciseEffect,
    mealEffect,
    stressEffect,
    exerciseEffect,
    occlusionActive,
    bleInterferenceActive,
  };
}

// ============================================================
// PASO PRINCIPAL DE SIMULACIÓN
// ============================================================
export function simulationStep(
  state: SimulationState,
  config: SimConfig,
): SimulationState {
  const dt = DT;
  const newTime = state.time + dt;

  // ── 1) Perturbaciones ─────────────────────────────────────
  const {
    glucoseEffect, mealEffect, stressEffect, exerciseEffect,
    occlusionActive, bleInterferenceActive,
  } = computePerturbationEffect(state.perturbations, state.time);

  // ── 2) Comunicación BLE ───────────────────────────────────
  const bleConnected = !bleInterferenceActive;
  let controllerReading = state.glucoseMeasured;

  if (bleConnected) {
    const packetLost = Math.random() < state.blePacketLoss;
    lastBLEReading = packetLost ? lastBLEReading : state.sensorReading;
    controllerReading = lastBLEReading;
  } else {
    controllerReading = lastBLEReading;
  }

  // ── 3) Error de control ───────────────────────────────────
  // e(t) = G_medida − SP  (positivo → glucosa alta → inyectar insulina)
  const pidError = controllerReading - state.setpoint;

  // ── 4) Controlador PID ────────────────────────────────────
  const { p, i, d, output: pidOutput, saturated } = computePID(
    pidError,
    dt,
    config,
  );

  // ── 5) Actuador ───────────────────────────────────────────
  const effectiveRate = occlusionActive ? 0 : pidOutput;

  // ── 6) Absorción subcutánea (primer orden) ────────────────
  //    dI/dt = (u − I) / τ_sub
  const tauSub = config.plant.subcutaneousTimeConstant;
  const uNorm = effectiveRate / 60.0;   // U/h → U/min
  const newSubQ = state.subcutaneousInsulin + (dt / tauSub) * (uNorm - state.subcutaneousInsulin);

  // ── 7) Planta – glucosa + tejido ──────────────────────────
  const sensitivityScale = config.plant.glucoseSensitivity / 35.0;
  const newGlucose = stepPlant(state.glucoseReal, newSubQ, glucoseEffect, sensitivityScale, dt);

  // ── 8) Sensor ─────────────────────────────────────────────
  const sensorNoiseLevel = state.perturbations.some(
    p => p.type === 'sensor_noise' &&
      state.time >= p.startTime &&
      state.time <= p.startTime + p.duration,
  ) ? config.sensorNoiseLevel * 5 : config.sensorNoiseLevel;

  const { reading: sensorReading, updated: sensorUpdated } = stepSensor(
    newGlucose, sensorNoiseLevel, config, newTime, state.lastSensorUpdate,
  );

  // El sensor siempre entrega su lectura actual (salida del proceso + retardo + ruido)
  const newLastSensorUpdate = sensorUpdated ? newTime : state.lastSensorUpdate;
  // glucoseMeasured = salida del elemento de medicion, actualizada en cada paso
  const newGlucoseMeasured = sensorReading;

  // ── 9) Error para gráfico y estado estable ─────────────────
  // El error mostrado en el gráfico es la señal de salida del bloque de medición
  // menos el setpoint: e(t) = G_medida(t) - SP.
  // Esto es lo que se representa en el panel de error y en la métrica del sistema.
  const measuredError = newGlucoseMeasured - state.setpoint;
  const realError = newGlucose - state.setpoint; // solo para banda de estabilidad

  let stableTime = state.stableTime;
  if (Math.abs(realError) <= STABLE_THRESHOLD) {
    stableTime += dt;
  } else {
    stableTime = 0;
  }
  const systemState = stableTime >= STABLE_TIME_REQ ? 'stable' : 'transient';

  // ── 10) Alarmas ───────────────────────────────────────────
  const alarms: string[] = [];
  if (newGlucose < 70) alarms.push('HIPOGLUCEMIA');
  if (newGlucose > 250) alarms.push('HIPERGLUCEMIA');
  if (saturated) alarms.push('ACTUADOR SATURADO');
  if (occlusionActive) alarms.push('OCLUSIÓN DE CÁNULA');
  if (!bleConnected) alarms.push('SIN COMUNICACIÓN BLE');

  // ── 11) Limpiar perturbaciones expiradas ──────────────────
  const activePerturbations = state.perturbations.filter(
    p => newTime <= p.startTime + p.duration,
  );

  return {
    ...state,
    time: newTime,
    glucoseReal: newGlucose,
    glucoseMeasured: newGlucoseMeasured,
    sensorReading,
    lastSensorUpdate: newLastSensorUpdate,
    error: measuredError,  // error de la MEDICIÓN del sensor (lo que ve el PID)
    pTerm: p,
    iTerm: i,
    dTerm: d,
    pidOutput,
    // ── Descomposición Basal / Bolo ──────────────────────────
    // La bomba entrega siempre una tasa basal de fondo (config.basalRate).
    // Cualquier corrección por encima del basal se considera bolo automático.
    insulinRate: pidOutput,
    basalRate: Math.min(config.basalRate, pidOutput),
    bolusAmount: Math.max(0, pidOutput - config.basalRate),
    actuatorSaturated: saturated,
    subcutaneousInsulin: newSubQ,
    plasmaInsulin: newSubQ,
    bleConnected,
    stableTime,
    systemState,
    alarms,
    perturbations: activePerturbations,
    lastValidReading: lastBLEReading,
  };
}

// ============================================================
// ESTADO INICIAL
// ============================================================
export function createInitialState(
  setpoint: number = 100,
  initialGlucose: number = setpoint,  // por defecto = setpoint → error inicial = 0
): SimulationState {
  const initError = initialGlucose - setpoint;

  integralAccum = 0;
  prevPIDError = initError;
  filteredDerivative = 0;
  tissueInsulinEffect = 0;
  lastBLEReading = initialGlucose;

  return {
    time: 0,
    setpoint,
    glucoseReal: initialGlucose,
    glucoseMeasured: initialGlucose,
    error: initError,  // G_medida − SP al inicio
    pTerm: 0,
    iTerm: 0,
    dTerm: 0,
    pidOutput: 0,
    insulinRate: 0,
    basalRate: 0,
    bolusAmount: 0,
    actuatorSaturated: false,
    subcutaneousInsulin: 0,
    plasmaInsulin: 0,
    glucoseMetabolism: initialGlucose,
    sensorNoise: 0,
    sensorReading: initialGlucose,
    lastSensorUpdate: 0,
    bleConnected: true,
    blePacketLoss: 0.02,
    bleDelay: 50,
    lastValidReading: initialGlucose,
    perturbations: [],
    systemState: 'transient',
    stableTime: 0,
    alarms: [],
  };
}

// ============================================================
// EXTRACCIÓN DE DATOS PARA GRÁFICOS
// ============================================================
export function extractDataPoint(state: SimulationState): DataPoint {
  // Calcular efectos individuales de perturbación para los gráficos
  const {
    mealEffect, stressEffect, exerciseEffect,
    occlusionActive, bleInterferenceActive,
  } = computePerturbationEffect(state.perturbations, state.time);

  return {
    time: state.time,
    setpoint: state.setpoint,
    glucoseReal: state.glucoseReal,
    glucoseMeasured: state.glucoseMeasured,
    error: state.error,
    pidOutput: state.pidOutput,
    insulinRate: state.insulinRate,
    basalRate: state.basalRate,
    bolusAmount: state.bolusAmount,
    pTerm: state.pTerm,
    iTerm: state.iTerm,
    dTerm: state.dTerm,
    // Señales de perturbación individuales
    perturbMeal: mealEffect,
    perturbStress: stressEffect,
    perturbExercise: exerciseEffect,
    perturbOcclusion: occlusionActive ? 1 : 0,
    perturbBLE: bleInterferenceActive ? 1 : 0,
  };
}

export function isOcclusionActive(state: SimulationState): boolean {
  return state.perturbations.some(
    p => p.type === 'occlusion' &&
      state.time >= p.startTime &&
      state.time <= p.startTime + p.duration,
  );
}
