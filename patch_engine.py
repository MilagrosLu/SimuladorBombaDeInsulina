import re

path = '/home/mili/Documents/Tecnologías para la automatización/Simulación/src/engine/simulationEngine.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update createInitialState to include metrics
old_init = '''    stableTime: 0,
    alarms: [],
  };
}'''
new_init = '''    stableTime: 0,
    alarms: [],
    metrics: {
      settlingTime: null,
      riseTime: null,
      overshoot: 0,
      steadyStateError: initError,
      iae: 0,
      ise: 0,
      itae: 0,
      maxError: Math.abs(initError),
      timeInRange: 0,
      timeOutOfRange: 0,
    },
  };
}'''
if old_init in c:
    c = c.replace(old_init, new_init)

# 2. Update PID function with true saturation and conditional integration (anti-windup)
old_pid = '''function computePID(
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
}'''

new_pid = '''function computePID(
  pidError: number,   // e(t) = glucosa − setpoint
  dt: number,
  config: SimConfig,
): { p: number; i: number; d: number; output: number; saturated: boolean } {
  const { kp, ki, kd } = config.pid;

  // ── Proporcional ─────────────────────────────────────────
  const p = kp * pidError;

  // ── Derivativo con filtro pasa-bajos ─────────────────────
  // α = 0.15 → atenúa frecuencias del ruido del sensor
  const ALPHA_D = 0.15;
  const rawDeriv = (pidError - prevPIDError) / dt;
  filteredDerivative = ALPHA_D * rawDeriv + (1 - ALPHA_D) * filteredDerivative;
  const d = kd * filteredDerivative;

  // ── Integral (con Clamping Anti-Windup) ──────────────────
  const INTEGRAL_LIMIT = 2000;
  
  // Anti-windup clamping: no integramos si el actuador está saturado 
  // y el error intenta empujarlo más hacia la saturación.
  const provisionalI = ki * (integralAccum + pidError * dt);
  const provisionalOutput = p + provisionalI + d;
  
  let isSaturatedHigh = provisionalOutput > config.maxInsulinRate && pidError > 0;
  let isSaturatedLow = provisionalOutput < config.minInsulinRate && pidError < 0;
  
  if (!isSaturatedHigh && !isSaturatedLow) {
    integralAccum += pidError * dt;
    integralAccum = clamp(integralAccum, -INTEGRAL_LIMIT, INTEGRAL_LIMIT);
  }
  const i = ki * integralAccum;

  prevPIDError = pidError;

  // ── Salida (Actuador con saturación real) ────────────────
  const rawOutput = p + i + d;
  let output = rawOutput;
  let saturated = false;
  
  if (output > config.maxInsulinRate) {
    output = config.maxInsulinRate;
    saturated = true;
  } else if (output < config.minInsulinRate) {
    output = config.minInsulinRate;
    saturated = true;
  }

  return { p, i, d, output, saturated };
}'''

if old_pid in c:
    c = c.replace(old_pid, new_pid)

# 3. Update simulationStep to compute metrics and advanced steady state
old_sim_step = '''  // ── 9) Error para gráfico y estado estable ─────────────────
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

  // ── 10) Alarmas ───────────────────────────────────────────'''

new_sim_step = '''  // ── 9) Error para gráfico y estado estable ─────────────────
  const measuredError = newGlucoseMeasured - state.setpoint;
  const realError = newGlucose - state.setpoint; 
  
  // Métrica de derivada de glucosa para estado estable robusto
  const glucoseVelocity = (newGlucose - state.glucoseReal) / dt;

  // Para considerar estado estacionario:
  // 1. El error real está dentro de ±STABLE_THRESHOLD (8 mg/dL)
  // 2. La derivada de la glucosa es pequeña (< 0.2 mg/dL/min, sin grandes fluctuaciones)
  // 3. No hay perturbaciones activas (comida, ejercicio, oclusión, etc.) excluyendo ruido de sensor
  const activeDisturbances = state.perturbations.filter(
    p => newTime >= p.startTime && newTime <= p.startTime + p.duration && p.type !== 'sensor_noise'
  );
  const isPhysiologicallyStable = Math.abs(realError) <= STABLE_THRESHOLD && 
                                  Math.abs(glucoseVelocity) < 0.2 && 
                                  activeDisturbances.length === 0;

  let stableTime = state.stableTime;
  if (isPhysiologicallyStable) {
    stableTime += dt;
  } else {
    stableTime = 0;
  }
  const systemState = stableTime >= STABLE_TIME_REQ ? 'stable' : 'transient';

  // ── 9b) Métricas de desempeño ─────────────────────────────
  const m = { ...state.metrics };
  const absError = Math.abs(realError);
  
  // ISE, IAE, ITAE
  m.iae += absError * dt;
  m.ise += (realError * realError) * dt;
  m.itae += newTime * absError * dt;
  
  // Max Error y Overshoot
  if (absError > m.maxError) {
    m.maxError = absError;
  }
  // Overshoot (si superamos el setpoint o subimos más de lo esperado)
  const currentOvershoot = ((newGlucose - state.setpoint) / state.setpoint) * 100;
  if (currentOvershoot > m.overshoot && realError > 0) {
    m.overshoot = currentOvershoot;
  }
  
  // Time in Range (70-180 mg/dL)
  if (newGlucose >= 70 && newGlucose <= 180) {
    m.timeInRange += dt;
  } else {
    m.timeOutOfRange += dt;
  }
  
  // Steady state error
  if (systemState === 'stable') {
    m.steadyStateError = realError;
    // Settling time se fija cuando entra en estado estable y no se ha fijado antes para la perturbación actual
    if (m.settlingTime === null || activeDisturbances.length > 0) {
      m.settlingTime = newTime;
    }
  } else {
    // Si sale de estable por una perturbación, reiniciamos el settling time para medir el nuevo
    if (activeDisturbances.length > 0) {
      m.settlingTime = null;
    }
  }

  // Rise time: tiempo en llegar por primera vez al 90% del setpoint desde abajo (solo si empezamos bajo, pero acá suele ser bajar la glucosa)
  // Adaptaremos Rise Time para la estabilización inicial: tiempo en cruzar el setpoint por primera vez
  if (m.riseTime === null && Math.sign(state.error) !== Math.sign(realError)) {
    m.riseTime = newTime;
  }

  // ── 10) Alarmas ───────────────────────────────────────────'''

if old_sim_step in c:
    c = c.replace(old_sim_step, new_sim_step)

# 4. update return block to include metrics
old_ret = '''    alarms,
    perturbations: activePerturbations,
    lastValidReading: lastBLEReading,
  };'''
new_ret = '''    alarms,
    perturbations: activePerturbations,
    lastValidReading: lastBLEReading,
    metrics: m,
  };'''
if old_ret in c:
    c = c.replace(old_ret, new_ret)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Engine patched")
