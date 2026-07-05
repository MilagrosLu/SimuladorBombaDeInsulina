import re

path = '/home/mili/Documents/Tecnologías para la automatización/Simulación/src/engine/simulationEngine.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update STABLE_THRESHOLD
c = c.replace('const STABLE_THRESHOLD = 8;', 'const STABLE_THRESHOLD = 5;')
c = c.replace('const STABLE_TIME_REQ = 20;', 'const STABLE_TIME_REQ = 20;')

# 2. Update PID Output (only lower bound = 0, no upper bound)
old_pid_output = '''  // ── Salida (Actuador Ideal, sin saturación) ──────────────────
  // Salida directa del PID matemático, permitiendo operar en la región 
  // puramente lineal sin recortes (incluso si da negativo, para análisis teórico).
  const output = p + i + d;
  const saturated = false;'''
new_pid_output = '''  // ── Salida (Actuador Ideal con Tope Inferior 0) ──────────────────
  // Salida del PID matemático. Se evita la inyección negativa (imposible físicamente).
  // No hay límite superior de saturación para enfocarnos en la respuesta pura del controlador.
  const rawOutput = p + i + d;
  const output = Math.max(0, rawOutput);
  const saturated = rawOutput < 0;'''
if old_pid_output in c:
    c = c.replace(old_pid_output, new_pid_output)

# 3. Update Steady-State and State computation
old_ss_logic = '''  // ── 9) Error para gráfico y estado estable ─────────────────
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
  const systemState = stableTime >= STABLE_TIME_REQ ? 'stable' : 'transient';'''

new_ss_logic = '''  // ── 9) Error para gráfico y estado estable ─────────────────
  const measuredError = newGlucoseMeasured - state.setpoint;
  const realError = newGlucose - state.setpoint; 
  
  // Métrica de derivada de glucosa para estado estable robusto
  const glucoseVelocity = (newGlucose - state.glucoseReal) / dt;

  // ── A) Perturbaciones ──
  const activeDisturbances = state.perturbations.filter(
    p => newTime >= p.startTime && newTime <= p.startTime + p.duration && p.type !== 'sensor_noise'
  );
  const hasActiveDisturbance = activeDisturbances.length > 0;
  
  const timeSinceLastDisturbance = hasActiveDisturbance ? 0 : state.timeSinceLastDisturbance + dt;

  // ── B) Banda de Tolerancia y Estado Estacionario ──
  const isInsideBand = Math.abs(realError) <= STABLE_THRESHOLD;
  let stableTime = state.stableTime;
  
  if (isInsideBand) {
    stableTime += dt;
  } else {
    stableTime = 0;
  }

  // Criterio de Estado Permanente (Régimen Estacionario):
  // 1. Error dentro de la banda de ±5 mg/dL.
  // 2. Lleva al menos STABLE_TIME_REQ minutos continuos dentro de la banda.
  // 3. Derivada cercana a cero (no está cruzando rápido la banda).
  // 4. No hay perturbaciones activas afectando el sistema.
  const isPhysiologicallyStable = stableTime >= STABLE_TIME_REQ && 
                                  Math.abs(glucoseVelocity) < 0.2 && 
                                  !hasActiveDisturbance;

  let systemState: 'out_of_band' | 'in_band' | 'stable';
  if (isPhysiologicallyStable) {
    systemState = 'stable';
  } else if (isInsideBand) {
    systemState = 'in_band';
  } else {
    systemState = 'out_of_band';
  }'''

if old_ss_logic in c:
    c = c.replace(old_ss_logic, new_ss_logic)
else:
    print("Could not replace SS logic")

# 4. Update InitialState to add new properties
old_init = '''    systemState: 'transient',
    stableTime: 0,'''
new_init = '''    systemState: 'out_of_band',
    stableTime: 0,
    timeSinceLastDisturbance: 0,'''
if old_init in c:
    c = c.replace(old_init, new_init)

old_init2 = '''      timeOutOfRange: 0,
    },
  };'''
new_init2 = '''      timeOutOfRange: 0,
      recoveryTime: null,
    },
  };'''
if old_init2 in c:
    c = c.replace(old_init2, new_init2)

# 5. Return block
old_ret = '''    stableTime,
    systemState,
    alarms,'''
new_ret = '''    stableTime,
    timeSinceLastDisturbance,
    systemState,
    alarms,'''
if old_ret in c:
    c = c.replace(old_ret, new_ret)

# 6. Metrics logic recoveryTime
old_settling = '''    if (m.settlingTime === null || activeDisturbances.length > 0) {
      m.settlingTime = newTime;
    }
  } else {
    // Si sale de estable por una perturbación, reiniciamos el settling time para medir el nuevo
    if (activeDisturbances.length > 0) {
      m.settlingTime = null;
    }
  }'''
new_settling = '''    if (m.settlingTime === null) {
      m.settlingTime = newTime;
    }
    if (m.recoveryTime === null && timeSinceLastDisturbance >= STABLE_TIME_REQ) {
      // El tiempo de recuperación es el tiempo desde la última perturbación hasta entrar en estable.
      // Ya que state.timeSinceLastDisturbance crece desde que termina la perturbación, sumamos la duración real.
      m.recoveryTime = newTime;
    }
  } else {
    if (hasActiveDisturbance) {
      m.settlingTime = null;
      m.recoveryTime = null;
    }
  }'''
if old_settling in c:
    c = c.replace(old_settling, new_settling)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print("done")
