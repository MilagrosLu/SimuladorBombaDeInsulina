// ============================================================
// TIPOS DEL SISTEMA DE CONTROL – Bomba MiniMed 780G
// ============================================================

/** Parámetros del controlador PID */
export interface PIDParams {
  kp: number;  // Ganancia proporcional
  ki: number;  // Ganancia integral
  kd: number;  // Ganancia derivativa
}

/** Parámetros físicos del actuador (micromotor de la bomba) */
export interface ActuatorParams {
  stepsPerUnit: number;  // pasos del motor por Unidad de insulina
  volumePerStep: number; // µL por paso
  unitsPerStep: number;  // U por paso (= 1/stepsPerUnit)
}

/** Estado completo del sistema en un instante dado */
export interface SimulationState {
  // Tiempo
  time: number;          // Tiempo simulado en minutos

  // Señales del lazo de control
  setpoint: number;      // Referencia (mg/dL)
  glucoseReal: number;      // Glucosa real en sangre (mg/dL)
  glucoseMeasured: number;  // Lectura filtrada del sensor (mg/dL)
  glucosePredicted: number; // Predicción a 30 minutos (mg/dL)
  error: number;            // Error = medición filtrada - setpoint

  // Términos del PID
  pTerm: number;
  iTerm: number;
  dTerm: number;
  pidOutput: number;     // Salida total del controlador

  // Actuador físico
  totalRate: number;         // Tasa total = Basal PID + Bolo, tras saturación (U/h)
  insulinRate: number;       // Tasa efectiva entregada (0 si oclusión) (U/h)
  basalRate: number;         // Componente basal del PID (U/h)
  bolusAmount: number;       // Bolo feedforward calculado (U)
  bolusInsulin: number;      // Insulina de bolo añadida al sub-Q (U)
  motorSteps: number;        // Pasos del micromotor en este tick
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

  // Tiempo continuo en zona de falla
  hypoTime: number;   // minutos continuos con glucosa < 70 mg/dL
  hyperTime: number;  // minutos continuos con glucosa > 180 mg/dL

  // Falla del sistema: cuando el organismo ya sufre el efecto del desvio
  systemFailure: boolean;
  failureReason: string; // descripción clínica de la falla

  qosFailure: boolean;
  qosReason: string;

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
  bolusGiven?: boolean;   // ya se aplicó el bolo feedforward
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
  glucoseReal: number;
  glucoseMeasured: number;
  glucosePredicted: number;
  error: number;
  pidOutput: number;
  totalRate: number;
  insulinRate: number;
  basalRate: number;
  bolusAmount: number;
  motorSteps: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  perturbMeal: number;
  perturbStress: number;
  perturbExercise: number;
  perturbOcclusion: number;
  perturbBLE: number;
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
  actuator: ActuatorParams;
  setpoint: number;
  initialGlucose: number;
  maxInsulinRate: number;
  minInsulinRate: number;
  basalRate: number;
  sensorNoiseLevel: number;
  sensorUpdateInterval: number;
  timeScale: number;
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
