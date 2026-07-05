// ============================================================
// TIPOS DEL SISTEMA DE CONTROL – Bomba MiniMed 780G
// ============================================================

/** Parámetros del controlador PID */
export interface PIDParams {
  kp: number;  // Ganancia proporcional
  ki: number;  // Ganancia integral
  kd: number;  // Ganancia derivativa
}

/** Estado completo del sistema en un instante dado */
export interface SimulationState {
  // Tiempo
  time: number;          // Tiempo simulado en minutos

  // Señales del lazo de control
  setpoint: number;      // Referencia (mg/dL)
  glucoseReal: number;   // Glucosa real en sangre (mg/dL)
  glucoseMeasured: number; // Lectura del sensor (glucosa intersticial, mg/dL)
  error: number;         // Error = medición - setpoint

  // Términos del PID
  pTerm: number;
  iTerm: number;
  dTerm: number;
  pidOutput: number;     // Salida total del controlador

  // Actuador
  insulinRate: number;   // Tasa de infusión (U/h)
  basalRate: number;     // Tasa basal (U/h)
  bolusAmount: number;   // Bolo automático (U)
  actuatorSaturated: boolean;

  // Planta – estados internos
  subcutaneousInsulin: number;  // Insulina en tejido subcutáneo
  plasmaInsulin: number;        // Insulina en plasma
  glucoseMetabolism: number;    // Estado del metabolismo

  // Sensor
  sensorNoise: number;
  sensorReading: number;
  lastSensorUpdate: number;

  // BLE
  bleConnected: boolean;
  blePacketLoss: number;   // probabilidad 0-1
  bleDelay: number;        // ms de demora
  lastValidReading: number;

  // Perturbaciones activas
  perturbations: PerturbationEvent[];

  // Estado del sistema
  systemState: 'out_of_band' | 'in_band' | 'stable';
  stableTime: number;  // cuánto tiempo lleva dentro de la banda
  timeSinceLastDisturbance: number;
  transientTime: number;
  lastTransientTime: number;

  // Alarmas
  alarms: string[];

  // Métricas de desempeño de control
  metrics: {
    settlingTime: number | null;
    riseTime: number | null;
    overshoot: number;
    steadyStateError: number;
    iae: number;
    ise: number;
    itae: number;
    maxError: number;
    timeInRange: number;
    timeOutOfRange: number;
    recoveryTime: number | null;
  };
}

/** Evento de perturbación */
export interface PerturbationEvent {
  type: PerturbationType;
  magnitude: number;
  startTime: number;
  duration: number;       // minutos
  description: string;
}

export type PerturbationType =
  | 'meal_small'
  | 'meal_normal'
  | 'meal_large'
  | 'stress'
  | 'exercise'
  | 'occlusion'
  | 'ble_interference'
  | 'sensor_noise';

/** Punto de datos histórico para los gráficos */
export interface DataPoint {
  time: number;
  setpoint: number;        // referencia (puede cambiar en el tiempo)
  glucoseReal: number;     // salida del proceso (planta)
  glucoseMeasured: number; // salida del elemento de medición (sensor + ruido)
  error: number;           // e(t) = glucoseMeasured − setpoint
  pidOutput: number;
  insulinRate: number;  // tasa total = basal + bolo (U/h)
  basalRate: number;    // tasa basal continua de fondo (U/h)
  bolusAmount: number;  // bolo de corrección en este instante (U/h por encima del basal)
  pTerm: number;
  iTerm: number;
  dTerm: number;
  // Señales de perturbación individuales (mg/dL/min de efecto en glucosa)
  perturbMeal: number;     // efecto acumulado de comidas activas
  perturbStress: number;   // efecto de estrés
  perturbExercise: number; // efecto de ejercicio (negativo)
  perturbOcclusion: number; // 1 si oclusión activa, 0 si no
  perturbBLE: number;      // 1 si interferencia BLE activa, 0 si no
}

/** Parámetros de la planta */
export interface PlantParams {
  // Absorción subcutánea
  subcutaneousTimeConstant: number; // min
  absorptionDelay: number;          // min (tiempo muerto)

  // Metabolismo
  glucoseSensitivity: number;       // caída de glucosa por U de insulina
  glucoseBasalProduction: number;   // producción endógena (mg/dL/min)
  metabolismTimeConstant: number;   // inercia metabólica (min)
}

/** Configuración global de la simulación */
export interface SimConfig {
  pid: PIDParams;
  plant: PlantParams;
  setpoint: number;
  initialGlucose: number;     // glucosa al inicio de la simulación (mg/dL)
  maxInsulinRate: number;   // U/h máximo del actuador
  minInsulinRate: number;   // 0 – no puede extraer insulina
  basalRate: number;        // Tasa basal de fondo [U/h]
  sensorNoiseLevel: number; // desviación estándar del ruido (mg/dL)
  sensorUpdateInterval: number; // cada cuántos minutos el sensor actualiza
  timeScale: number;        // segundos reales por minuto simulado
}

/** Descripción de perturbación para el panel de explicaciones */
export interface PerturbationExplanation {
  type: PerturbationType;
  title: string;
  physiology: string;
  signalChanged: string;
  pidResponse: string;
  errorEvolution: string;
  plantResponse: string;
  color: string;
}
