// ============================================================
// DEFINICIÓN DE PASOS DEL TUTORIAL
// Agregar un nuevo paso = agregar un objeto al array.
// ============================================================

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  /** Selector CSS del elemento a resaltar. Sin target → centrado. */
  target?: string;
  /** Lado donde aparece el tooltip respecto al elemento. */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenido al Simulador MiniMed™ 780G',
    content: 'Este simulador recrea el sistema de lazo cerrado de una bomba de insulina moderna. El controlador PID regula la glucosa en sangre de forma automática, tal como lo haría el dispositivo real.',
    position: 'center',
  },
  {
    id: 'play-controls',
    title: 'Controles de Simulación',
    content: '▶ Simular inicia el avance del tiempo. ⏸ Pausar lo detiene sin perder el estado interno. ↺ Reset reinicia desde la glucosa inicial configurada.',
    target: '.header-controls',
    position: 'bottom',
  },
  {
    id: 'time-scale',
    title: 'Velocidad de Simulación',
    content: 'Los botones x1, x2, x4 y x8 multiplican la velocidad del tiempo simulado. También podés escribir directamente los minutos simulados por segundo. Útil para ver efectos de largo plazo en segundos.',
    target: '#tut-speed-controls',
    position: 'bottom',
  },
  {
    id: 'left-panel',
    title: 'Panel de Estado y Controles',
    content: 'Muestra en tiempo real el estado fisiológico del paciente y permite configurar el controlador. Podés ocultarlo con el botón ◀ Ocultar en la parte superior para ampliar los gráficos.',
    target: '.col-left',
    position: 'right',
  },
  {
    id: 'glucose-display',
    title: 'Glucosa en Sangre',
    content: 'La glucosa real simulada en mg/dL. El color indica el estado clínico: verde = normal (70–140), amarillo = elevada, rojo = hiperglucemia, violeta = hipoglucemia.',
    target: '#tut-glucose-display',
    position: 'right',
  },
  {
    id: 'loop-metrics',
    title: 'Métricas del Lazo',
    content: 'Aquí podés ver la lectura del sensor (Glucosa Medida), la referencia (Setpoint) y el Error e(t). El error es la diferencia exacta entre la glucosa medida y el objetivo, y es lo que el PID usa de entrada.',
    target: '#tut-loop-metrics',
    position: 'right',
  },
  {
    id: 'setpoint',
    title: 'Setpoint — Glucosa Objetivo',
    content: 'Define la glucosa a la que el PID intenta llevar al paciente (estándar: 100 mg/dL). Moviendo el ciruclo hacia la derecha se aumenta el objetivo, hacia la izquierda se disminuye.',
    target: '#tut-setpoint-wrapper',
    position: 'right',
  },
  {
    id: 'initial-glucose',
    title: 'Glucosa Inicial',
    content: 'Permite configurar el nivel de glucosa con el que arrancará el paciente. Si difiere del Setpoint, generará un error inicial e(0) inmediato.',
    target: '#tut-initial-glucose-wrapper',
    position: 'right',
  },
  {
    id: 'pid-controls',
    title: 'Ganancias del Controlador PID',
    content: 'Aca podés modificar los valores de las ganancias del controlador, escribiendo los valores en su box correspondiente. Podés ajustarlos en tiempo real.',
    target: '#tut-pid-inputs',
    position: 'right',
  },
  {
    id: 'pid-presets',
    title: 'Valores de Referencia PID',
    content: 'Estos son casos ejemplo de referencia para probar las respuestas del control en el simulador. \n ✅ Óptimo: Ajuste estándar robusto.\n⚠️ Lento: Respuesta amortiguada, tarda en llegar.\n🔴 Inestable: Oscila continuamente sin estabilizarse.',
    target: '#tut-pid-presets',
    position: 'right',
  },
  {
    id: 'block-diagram',
    title: 'Diagrama de Lazo Cerrado',
    content: 'Representación del diagrama de bloques de lazo cerrado del sistema. Las lineas animadas muestran el flujo de señales: Setpoint → Punto Suma → PID → Actuador → Proceso → Elemento de Medición. Podés ocultar este diagrama desde su encabezado superior (▲/▼).',
    target: '#tut-block-diagram-wrapper',
    position: 'bottom',
  },
  {
    id: 'charts',
    title: 'Gráficos en Tiempo Real',
    content: 'Cinco gráficos apilados sincronizados: ① Glucosa real vs setpoint, ② Salida del sensor, ③ Error e(t), ④ Perturbaciones activas, ⑤ Insulina administrada.',
    target: '.charts-unified',
    position: 'top',
  },
  {
    id: 'history-slider',
    title: 'Navegación del Historial',
    content: 'Este slider te permite navegar libremente por el tiempo pasado. Deslizalo para revisar cómo respondió el controlador a perturbaciones anteriores. TIP: Si lo moves a la derecha vas atras en el tiempo, si lo moves a la izquierda vas hacia el presente. Solo podras navergar si paso el suficiente tiempo para que el grafico se haya "ido de la pantalla"',
    target: '#tut-history-slider',
    position: 'top',
  },
  {
    id: 'right-panel',
    title: 'Panel de Perturbaciones',
    content: 'Inyectá eventos del mundo real. Las comidas elevan la glucosa, el ejercicio la reduce, y los errores de comunicación alteran las mediciones y la insulina administrada. Al igual que el panel izquierdo, podés colapsar este panel con su botón Ocultar ▶ para maximizar el área de los gráficos.',
    target: '.col-right',
    position: 'left',
  },
  {
    id: 'pert-durations',
    title: 'Duración de Fallos Técnicos',
    content: 'A diferencia de las comidas (que tienen duración fija), podés configurar cuánto tiempo durará una Oclusión, Pérdida conexión BLE o Ruido de sensor.',
    target: '#tut-pert-durations-occlusion',
    position: 'left',
  },
  {
    id: 'pert-noise',
    title: 'Magnitud del Ruido',
    content: 'Específicamente para el Ruido del Sensor, podés ajustar su intensidad (magnitud dB).',
    target: '#tut-pert-noise',
    position: 'left',
  },
  {
    id: 'finish',
    title: '¡Todo listo para simular!',
    content: 'Configurá la glucosa inicial, elegí un preset del PID, iniciá la simulación y agregá perturbaciones para observar la respuesta del controlador.',
    position: 'center',
  },
];
