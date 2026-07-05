// ============================================================
// CONFIGURACIÓN DE LA SIMULACIÓN
// ============================================================
import type { PerturbationExplanation } from '../types/simulation';

// La configuración inicial por defecto (DEFAULT_CONFIG) se ha movido
// íntegramente al backend (backend/simulation/config.go).
// El frontend realiza un GET a /config al arrancar para inicializar
// los valores.

// ── Metadatos de perturbaciones ─────────────────────────────
export const PERTURBATION_EXPLANATIONS: PerturbationExplanation[] = [
  {
    type: 'meal_small',
    title: 'Comida Pequeña (20g CHO)',
    physiology: 'Los carbohidratos se absorben en el intestino y pasan a la sangre como glucosa. Una comida pequeña genera un pico moderado en 15-30 min.',
    signalChanged: 'La glucosa real (planta) sube rápidamente → el sensor la detecta con retardo de ~2 min.',
    pidResponse: 'El error aumenta. El término P reacciona de inmediato. El término I comienza a acumular. El término D detecta la variación positiva.',
    errorEvolution: 'El error crece hasta el pico de glucosa y luego disminuye a medida que la insulina actúa.',
    plantResponse: 'La glucosa sube 20–30 mg/dL. La insulina subcutánea absorbe en 20 min. La glucosa vuelve al setpoint en 45–60 min.',
    color: '#f59e0b',
  },
  {
    type: 'meal_normal',
    title: 'Comida Normal (50g CHO)',
    physiology: 'Una comida completa genera una absorción sostenida de glucosa durante 1–2 horas, con un pico pronunciado.',
    signalChanged: 'La glucosa sube 40–80 mg/dL. El sensor reporta con retardo de ~2 min y ruido mínimo.',
    pidResponse: 'El PID emite un bolo automático significativo. El actuador puede acercarse a saturación.',
    errorEvolution: 'El error alcanza valores altos (+50 mg/dL) antes de que la insulina actúe. La corrección lleva 60–90 min.',
    plantResponse: 'Respuesta pronunciada. La inercia metabólica hace que el retorno al setpoint sea gradual.',
    color: '#f97316',
  },
  {
    type: 'meal_large',
    title: 'Comida Grande (100g CHO)',
    physiology: 'Una cena abundante o comida rica en carbohidratos genera una perturbación máxima. Puede requerir bolo manual adicional.',
    signalChanged: 'La glucosa puede superar 200 mg/dL. Riesgo de activar alarma de hiperglucemia.',
    pidResponse: 'El actuador se satura. El PID no puede corregir tan rápido como sube la glucosa.',
    errorEvolution: 'El error puede superar +100 mg/dL. La corrección requiere 90–120 min.',
    plantResponse: 'Respuesta muy pronunciada. El término I juega un rol clave en la recuperación.',
    color: '#ef4444',
  },
  {
    type: 'stress',
    title: 'Estrés Agudo',
    physiology: 'El cortisol y la adrenalina liberados durante el estrés aumentan la producción hepática de glucosa y reducen la sensibilidad a la insulina.',
    signalChanged: 'La glucosa sube lentamente durante 20–40 min. El aumento es moderado pero sostenido.',
    pidResponse: 'El término I es crucial: detecta el error acumulado y aumenta gradualmente la infusión basal.',
    errorEvolution: 'Error crece lentamente. Sin acción I, el sistema no puede compensar la perturbación constante.',
    plantResponse: 'La glucosa se estabiliza en un nivel más alto si la perturbación persiste. El PID eventualmente la baja.',
    color: '#8b5cf6',
  },
  {
    type: 'exercise',
    title: 'Ejercicio Físico',
    physiology: 'El músculo consume glucosa directamente durante el ejercicio, sin necesitar insulina. Además aumenta la sensibilidad a la insulina.',
    signalChanged: 'La glucosa baja. El sensor detecta la caída. El error se vuelve positivo (glucosa < setpoint).',
    pidResponse: 'El PID debe reducir la infusión. La salida cae hacia 0 o la tasa mínima basal.',
    errorEvolution: 'Riesgo de hipoglucemia si el ejercicio es intenso. El error puede invertirse.',
    plantResponse: 'La glucosa baja 20–50 mg/dL. Si cae a <70 mg/dL, se activa alarma de hipoglucemia.',
    color: '#10b981',
  },
  {
    type: 'occlusion',
    title: 'Oclusión de Cánula',
    physiology: 'La cánula subcutánea se dobla o tapa. La bomba acciona el motor pero la insulina no llega al tejido.',
    signalChanged: 'La actuación se desconecta de la planta. La glucosa sube como si el sistema estuviera en lazo abierto.',
    pidResponse: 'El controlador aumenta su salida al máximo (saturación) pero no tiene efecto. El error crece sin freno.',
    errorEvolution: 'El error crece monotónicamente. Alarma de oclusión en el dispositivo real.',
    plantResponse: 'La glucosa sube sin control hasta superar 250 mg/dL. Situación de emergencia médica.',
    color: '#dc2626',
  },
  {
    type: 'ble_interference',
    title: 'Interferencia BLE',
    physiology: 'Pérdida de comunicación entre el sensor Guardian 4 y la bomba MiniMed 780G.',
    signalChanged: 'El controlador no recibe nuevas mediciones. Usa la última lectura válida (hold-last-value).',
    pidResponse: 'El PID opera con información desactualizada. El error calculado puede no reflejar la realidad.',
    errorEvolution: 'El error "congelado" hace que el controlador sobreactúe o subeactúe.',
    plantResponse: 'La glucosa puede desviarse durante la pérdida de comunicación. Al recuperar BLE, se produce una corrección brusca.',
    color: '#6366f1',
  },
  {
    type: 'sensor_noise',
    title: 'Ruido del Sensor',
    physiology: 'El sensor de glucosa intersticial puede verse afectado por movimiento físico, temperatura o calibración incorrecta.',
    signalChanged: 'La señal de medición fluctúa con mayor amplitud. El error tiene componentes espurios.',
    pidResponse: 'El término D amplifica el ruido (alta frecuencia). Puede causar oscilaciones en la salida del controlador.',
    errorEvolution: 'El error oscila rápidamente. El sistema parece inestable aunque la glucosa real esté estable.',
    plantResponse: 'La planta no cambia significativamente, pero el controlador reacciona al ruido con inyecciones erráticas.',
    color: '#64748b',
  },
];
