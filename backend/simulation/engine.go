package simulation

// ============================================================
// MOTOR DE SIMULACIÓN EN GO
// ============================================================
// Puerto fiel de simulationEngine.ts al lenguaje Go.
//
// CONVENCIÓN DE SIGNOS:
//   error e(t) = G_medida(t) − SP
//   error > 0 → glucosa alta → PID inyecta MÁS insulina
//   error < 0 → glucosa baja → PID reduce insulina (mínimo 0)
//
// MODELO FISIOLÓGICO (Bergman Minimal Model):
//   dG/dt = −p1·(G − Gb) − X·G·Ks + D(t)
//   dX/dt = −p2·X + p3·I
//   dI/dt = (u − I) / τ_sub
// ============================================================

import (
	"math"
	"math/rand"
)

// ── Parámetros del modelo de Bergman ────────────────────────
// Valores de referencia: Cobelli et al. (2009), parámetros promedio
// para adulto T1D de 70 kg.
const (
	dt              = 0.25  // min simulados por paso
	stableTimeReq   = 10.0  // minutos continuos dentro de la banda (óptimo para settling <90 min)

	// p1: clearance de glucosa endógena. Se ajusta levemente para dar una caída base.
	p1 = 0.030

	// p2: clearance de insulina en tejido.
	// ACADÉMICO: El valor fisiológico real (0.025) produce un retardo de ~40 minutos (1/p2).
	// Para un simulador de lazo cerrado rápido (settling < 60 min), necesitamos reducir el polo.
	// Se aumenta p2 a 0.08 (retardo de ~12 min).
	p2 = 0.080

	// p3: ganancia de sensibilidad insulínica.
	// Se escala proporcionalmente al aumento de p2 para mantener la ganancia estática (p3/p2).
	p3 = 0.020
)

// Engine mantiene el estado mutable entre pasos (equivalente a
// las variables globales de simulationEngine.ts).
type Engine struct {
	integralAccum      float64
	prevPIDError       float64
	filteredDerivative float64
	tissueInsulinEffect float64
	lastBLEReading     float64
}

// NewEngine crea un motor con estado limpio.
func NewEngine() *Engine {
	return &Engine{}
}

// ── Utilidades ───────────────────────────────────────────────

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// gaussianNoise genera ruido gaussiano con Box-Muller.
func gaussianNoise(std float64) float64 {
	u1 := rand.Float64()
	if u1 < 1e-10 {
		u1 = 1e-10
	}
	u2 := rand.Float64()
	return std * math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)
}

// ── PID ──────────────────────────────────────────────────────
type pidResult struct {
	p, i, d, output float64
	saturated        bool
}

func (e *Engine) computePID(pidError float64, cfg SimConfig, subcutaneousInsulin float64) pidResult {
	kp, ki, kd := cfg.PID.Kp, cfg.PID.Ki, cfg.PID.Kd
	controllerReading := pidError + cfg.Setpoint

	// 1. Derivativo y Tendencia (Trend)
	// Se calcula primero para usar la tendencia en predicciones de seguridad.
	const alphaD = 0.15
	rawDeriv := (pidError - e.prevPIDError) / dt
	e.filteredDerivative = alphaD*rawDeriv + (1-alphaD)*e.filteredDerivative
	d := kd * e.filteredDerivative
	glucoseTrend := e.filteredDerivative // mg/dL por minuto

	e.prevPIDError = pidError

	// 2. Suspensión antes del límite bajo (Suspend Before Low)
	// Comportamiento clave de bombas comerciales: corta toda infusión si
	// el paciente está en hipoglucemia (< 75) o se proyecta que lo estará.
	predictionHorizon := 30.0 // minutos
	predictedGlucose := controllerReading + glucoseTrend*predictionHorizon

	if controllerReading < 75 || predictedGlucose < 70 {
		// Vaciar el integrador para evitar un pico cuando vuelva a encenderse
		e.integralAccum = 0
		return pidResult{p: 0, i: 0, d: 0, output: 0, saturated: true}
	}

	// 3. Zona Muerta (Deadband)
	// Si estamos muy cerca del setpoint (±3 mg/dL), consideramos el error 0.
	// Esto evita micro-correcciones constantes que causan oscilación.
	deadband := 3.0
	var effectiveError float64
	if pidError > deadband {
		effectiveError = pidError - deadband
	} else if pidError < -deadband {
		effectiveError = pidError + deadband
	} else {
		effectiveError = 0
	}

	// 4. IOB (Insulin On Board)
	// Descontamos la insulina "en vuelo" del error efectivo solo cuando
	// el paciente está alto y requiere más insulina.
	iobEquivalent := subcutaneousInsulin * (1800.0 / cfg.Plant.GlucoseSensitivity)
	if effectiveError > 0 && iobEquivalent > 0 {
		effectiveError = math.Max(0, effectiveError-iobEquivalent)
	}

	// Proporcional
	p := kp * effectiveError

	// 5. Integral con Anti-Windup Inteligente
	// - No se acumula si el error efectivo es cero (en zona muerta).
	// - No se acumula error positivo si la glucosa está cayendo rápidamente.
	const integralLimit = 3000.0
	if effectiveError != 0 {
		isFallingFast := effectiveError > 0 && glucoseTrend < -1.0
		if !isFallingFast {
			e.integralAccum += effectiveError * dt
			e.integralAccum = clamp(e.integralAccum, -integralLimit, integralLimit)
		}
	} else {
		// Leakage (decaimiento): en la zona muerta, la memoria del integrador
		// decae para asegurar que la insulina administrada tienda al basal.
		e.integralAccum *= 0.98
	}
	i := ki * e.integralAccum

	// 6. Cálculo de salida y saturación
	// Se suma la Tasa Basal (esfuerzo nominal) por defecto. De esta forma, si el
	// error es 0, el PID entrega la basal, y el integrador no necesita "remar"
	// desde cero para empatar la producción de glucosa.
	rawOutput := cfg.BasalRate + p + i + d
	output := clamp(rawOutput, cfg.MinInsulinRate, cfg.MaxInsulinRate)

	return pidResult{p: p, i: i, d: d, output: output, saturated: output != rawOutput}
}

// ── Planta (Bergman, Euler explícito) ───────────────────────
func (e *Engine) stepPlant(glucose, subcutaneousInsulin, perturbEffect, sensitivityScale float64, cfg SimConfig) float64 {
	const Gb = 100.0

	// En el modelo de Bergman, la insulina que afecta a la glucosa es
	// la insulina ACTIVA POR ENCIMA del nivel basal (exceso de insulina).
	// Si el paciente recibe exactamente su tasa basal, el exceso es 0,
	// y la glucosa tenderá naturalmente a Gb.
	basalInsulinMin := cfg.BasalRate / 60.0 // U/min
	excessInsulin := subcutaneousInsulin - basalInsulinMin

	// dX/dt = −p2·X + p3·(I - Ib)
	dX := -p2*e.tissueInsulinEffect + p3*excessInsulin
	e.tissueInsulinEffect += dX * dt

	// dG/dt = −p1·(G − Gb) − X·G·Ks + D(t)
	dG := -p1*(glucose-Gb) - e.tissueInsulinEffect*glucose*sensitivityScale + perturbEffect

	return clamp(glucose+dG*dt, 20, 400)
}

// ── Sensor ───────────────────────────────────────────────────
func stepSensor(processOutput, noiseLevel float64, cfg SimConfig, time, lastSensorUpdate float64) (reading float64, updated bool) {
	noise := gaussianNoise(noiseLevel)
	reading = clamp(processOutput+noise, 20, 400)
	updated = (time - lastSensorUpdate) >= cfg.SensorUpdateInterval
	return
}

// ── Perturbaciones ───────────────────────────────────────────
type perturbResult struct {
	glucoseEffect     float64
	mealEffect        float64
	stressEffect      float64
	exerciseEffect    float64
	occlusionActive   bool
	bleInterference   bool
}

func computePerturbationEffect(perturbations []PerturbationEvent, time float64) perturbResult {
	var r perturbResult
	for _, p := range perturbations {
		if time < p.StartTime || time > p.StartTime+p.Duration {
			continue
		}
		progress := (time - p.StartTime) / p.Duration
		switch p.Type {
		case "meal_small", "meal_normal", "meal_large":
			r.mealEffect += p.Magnitude * math.Exp(-5*math.Pow(progress-0.15, 2))
		case "stress":
			r.stressEffect += p.Magnitude * math.Sin(progress*math.Pi)
		case "exercise":
			r.exerciseEffect -= p.Magnitude * math.Sin(progress*math.Pi)
		case "occlusion":
			r.occlusionActive = true
		case "ble_interference":
			r.bleInterference = true
		}
	}
	r.glucoseEffect = r.mealEffect + r.stressEffect + r.exerciseEffect
	return r
}

// ── CreateInitialState ────────────────────────────────────────
// Crea el estado inicial y reinicia el motor interno.
func (e *Engine) CreateInitialState(setpoint, initialGlucose float64) SimulationState {
	initError := initialGlucose - setpoint

	// Reiniciar estado interno del motor
	e.integralAccum = 0
	e.prevPIDError = initError
	e.filteredDerivative = 0
	e.tissueInsulinEffect = 0
	e.lastBLEReading = initialGlucose

	return SimulationState{
		Time:             0,
		Setpoint:         setpoint,
		GlucoseReal:      initialGlucose,
		GlucoseMeasured:  initialGlucose,
		Error:            initError,
		GlucoseMetabolism: initialGlucose,
		SensorReading:    initialGlucose,
		BLEConnected:     true,
		BLEPacketLoss:    0.02,
		BLEDelay:         50,
		LastValidReading: initialGlucose,
		Perturbations:    []PerturbationEvent{},
		SystemState:      "out_of_band",
		Alarms:           []string{},
		Metrics: PerformanceMetrics{
			SteadyStateError: initError,
			MaxError:         math.Abs(initError),
		},
		TransientTime:     0,
		LastTransientTime: 0,
	}
}

// ── Step – paso principal ─────────────────────────────────────
// Equivalente exacto a simulationStep() de simulationEngine.ts.
func (e *Engine) Step(state SimulationState, cfg SimConfig) SimulationState {
	newTime := state.Time + dt

	// 1) Perturbaciones
	pr := computePerturbationEffect(state.Perturbations, state.Time)

	// 2) BLE
	bleConnected := !pr.bleInterference
	controllerReading := state.GlucoseMeasured
	if bleConnected {
		if rand.Float64() < state.BLEPacketLoss {
			// paquete perdido → mantener última lectura
		} else {
			e.lastBLEReading = state.SensorReading
		}
		controllerReading = e.lastBLEReading
	} else {
		controllerReading = e.lastBLEReading
	}

	// 3) Error de control
	pidError := controllerReading - state.Setpoint

	// 4) PID – regulación continua de la tasa basal (Feedback)
	// El PID trabaja siempre en lazo cerrado sobre la tasa basal.
	// El bolo (feedforward) se gestiona por separado abajo.
	pid := e.computePID(pidError, cfg, state.SubcutaneousInsulin)

	// 5) Actuador (oclusión bloquea salida del PID)
	effectiveRate := pid.output
	if pr.occlusionActive {
		effectiveRate = 0
	}

	// 6) Bolo Feedforward ante comidas
	// Estrategia: detectar el PRIMER paso en el que una comida está activa
	// (StartTime <= state.Time < StartTime+dt) y BolusGiven==false.
	// El flag BolusGiven se conserva en newPerts que se devuelve como estado.
	bolusInjectedNow := 0.0
	newPerts := make([]PerturbationEvent, len(state.Perturbations))
	copy(newPerts, state.Perturbations)
	for i := range newPerts {
		p := &newPerts[i]
		isMeal := p.Type == "meal_small" || p.Type == "meal_normal" || p.Type == "meal_large"
		// Detectar inicio de comida: es el primer paso donde state.Time cae dentro del rango
		// y el bolo aún no fue dado.
		if !isMeal || p.BolusGiven {
			continue
		}
		// Ventana de detección: cualquier paso dentro de la duración de la comida
		// (el flag asegura que solo se ejecuta una vez)
		if state.Time < p.StartTime || state.Time > p.StartTime+p.Duration {
			continue
		}
		// Cálculo correcto del bolo feedforward:
		// La perturbación es una gaussiana: mealEffect = Magnitude * exp(-5*(progress-0.15)^2)
		// El área total ≈ Magnitude * Duration * 0.44 [mg/dL*min]
		// Para evitar que la insulina actúe más rápido que la digestión y cause una bajada
		// inicial (dip), administramos solo un "Bolo Parcial" (40%). 
		// El PID agresivo se encargará del 60% restante de forma dinámica.
		gaussianArea := 0.44 
		totalGlucoseRise := p.Magnitude * p.Duration * gaussianArea
		bolusUnits := (totalGlucoseRise / cfg.Plant.GlucoseSensitivity) * 0.40
		bolusInjectedNow = bolusUnits
		p.BolusGiven = true
	}

	// 7) Absorción subcutánea (primer orden, τ = SubcutaneousTimeConstant)
	tauSub := cfg.Plant.SubcutaneousTimeConstant
	uNorm := effectiveRate / 60.0 // U/h → U/min
	newSubQ := state.SubcutaneousInsulin + (dt/tauSub)*(uNorm-state.SubcutaneousInsulin)
	// Inyección del bolo en I_sub con dimensiones correctas:
	// I_sub está en U/min. Un bolo de B unidades eleva I_sub en B/τ_sub U/min,
	// que el modelo absorbe exponencialmente con constante de tiempo τ_sub.
	newSubQ += bolusInjectedNow / tauSub

	// 7) Planta
	// GlucoseSensitivity=28 es la sensibilidad nominal. La dividimos por 28
	// (en lugar de 35 original) para mantener la escala correcta con el
	// nuevo p3 reducido. Con sensitivityScale=1.0 el modelo es el estándar.
	sensitivityScale := cfg.Plant.GlucoseSensitivity / 28.0
	newGlucose := e.stepPlant(state.GlucoseReal, newSubQ, pr.glucoseEffect, sensitivityScale, cfg)

	// 8) Sensor – ruido aumentado si hay perturbación de ruido
	noiseLevel := cfg.SensorNoiseLevel
	for _, p := range state.Perturbations {
		if p.Type == "sensor_noise" && state.Time >= p.StartTime && state.Time <= p.StartTime+p.Duration {
			noiseLevel *= 5
			break
		}
	}
	sensorReading, sensorUpdated := stepSensor(newGlucose, noiseLevel, cfg, newTime, state.LastSensorUpdate)
	newLastSensorUpdate := state.LastSensorUpdate
	if sensorUpdated {
		newLastSensorUpdate = newTime
	}
	newGlucoseMeasured := sensorReading

	// 9) Estado estable
	measuredError := newGlucoseMeasured - state.Setpoint
	realError := newGlucose - state.Setpoint
	glucoseVelocity := (newGlucose - state.GlucoseReal) / dt

	// Perturbaciones activas (no sensor_noise)
	hasActiveDisturbance := false
	for _, p := range state.Perturbations {
		if p.Type != "sensor_noise" && newTime >= p.StartTime && newTime <= p.StartTime+p.Duration {
			hasActiveDisturbance = true
			break
		}
	}
	timeSinceLastDisturbance := state.TimeSinceLastDisturbance + dt
	if hasActiveDisturbance {
		timeSinceLastDisturbance = 0
	}

	// El umbral estable ahora es ±5% del setpoint en lugar de un valor absoluto
	stableThreshold := state.Setpoint * 0.05
	isInsideBand := math.Abs(realError) <= stableThreshold
	stableTime := state.StableTime
	if isInsideBand {
		stableTime += dt
	} else {
		stableTime = 0
	}

	isPhysiologicallyStable := stableTime >= stableTimeReq &&
		math.Abs(glucoseVelocity) < 0.2 &&
		!hasActiveDisturbance

	systemState := "out_of_band"
	if isPhysiologicallyStable {
		systemState = "stable"
	} else if isInsideBand {
		systemState = "in_band"
	}

	transientTime := state.TransientTime
	lastTransientTime := state.LastTransientTime

	if systemState != "stable" {
		transientTime += dt
	} else {
		if transientTime > 0 {
			lastTransientTime = transientTime
		}
		transientTime = 0
	}

	// 9b) Métricas
	m := state.Metrics
	absError := math.Abs(realError)
	m.IAE += absError * dt
	m.ISE += realError * realError * dt
	m.ITAE += newTime * absError * dt
	if absError > m.MaxError {
		m.MaxError = absError
	}

	currentOvershoot := ((newGlucose - state.Setpoint) / state.Setpoint) * 100
	if currentOvershoot > m.Overshoot && realError > 0 {
		m.Overshoot = currentOvershoot
	}

	if newGlucose >= 70 && newGlucose <= 180 {
		m.TimeInRange += dt
	} else {
		m.TimeOutOfRange += dt
	}

	if systemState == "stable" {
		m.SteadyStateError = realError
		if m.SettlingTime == nil {
			v := newTime
			m.SettlingTime = &v
		}
		if m.RecoveryTime == nil && timeSinceLastDisturbance >= stableTimeReq {
			v := newTime
			m.RecoveryTime = &v
		}
	} else if hasActiveDisturbance {
		m.SettlingTime = nil
		m.RecoveryTime = nil
	}

	// Rise time: primera vez que el error cambia de signo
	if m.RiseTime == nil && sign(state.Error) != sign(realError) {
		v := newTime
		m.RiseTime = &v
	}

	// 10) Alarmas
	alarms := []string{}
	if newGlucose < 70 {
		alarms = append(alarms, "HIPOGLUCEMIA")
	}
	if newGlucose > 250 {
		alarms = append(alarms, "HIPERGLUCEMIA")
	}
	if pid.saturated {
		alarms = append(alarms, "ACTUADOR SATURADO")
	}
	if pr.occlusionActive {
		alarms = append(alarms, "OCLUSIÓN DE CÁNULA")
	}
	if !bleConnected {
		alarms = append(alarms, "SIN COMUNICACIÓN BLE")
	}

	// 11) Limpiar perturbaciones expiradas (preservando flags BolusGiven)
	activePerts := []PerturbationEvent{}
	for _, p := range newPerts {
		if newTime <= p.StartTime+p.Duration {
			activePerts = append(activePerts, p)
		}
	}

	// 12) Separación basal/bolo para el gráfico
	// BasalRate = salida continua del PID (siempre)
	// BolusAmount = el bolo feedforward del paso actual (impulso discreto)
	bolusActual := bolusInjectedNow

	return SimulationState{
		Time:                     newTime,
		Setpoint:                 state.Setpoint,
		GlucoseReal:              newGlucose,
		GlucoseMeasured:          newGlucoseMeasured,
		Error:                    measuredError,
		PTerm:                    pid.p,
		ITerm:                    pid.i,
		DTerm:                    pid.d,
		PIDOutput:                pid.output,
		InsulinRate:              pid.output,
		BasalRate:                pid.output, // tasa basal = salida del PID (feedback continuo)
		BolusAmount:              bolusActual, // impulso feedforward de comida (discreto)
		BolusInsulin:             bolusInjectedNow,
		ActuatorSaturated:        pid.saturated,
		SubcutaneousInsulin:      newSubQ,
		PlasmaInsulin:            newSubQ,
		GlucoseMetabolism:        newGlucose,
		SensorNoise:              0,
		SensorReading:            sensorReading,
		LastSensorUpdate:         newLastSensorUpdate,
		BLEConnected:             bleConnected,
		BLEPacketLoss:            state.BLEPacketLoss,
		BLEDelay:                 state.BLEDelay,
		LastValidReading:         e.lastBLEReading,
		Perturbations:            activePerts,
		SystemState:              systemState,
		StableTime:               stableTime,
		TimeSinceLastDisturbance: timeSinceLastDisturbance,
		TransientTime:            transientTime,
		LastTransientTime:        lastTransientTime,
		Alarms:                   alarms,
		Metrics:                  m,
	}
}

// ── ExtractDataPoint ──────────────────────────────────────────
func ExtractDataPoint(state SimulationState) DataPoint {
	pr := computePerturbationEffect(state.Perturbations, state.Time)
	perturbOcclusion := 0.0
	if pr.occlusionActive {
		perturbOcclusion = 1
	}
	perturbBLE := 0.0
	if pr.bleInterference {
		perturbBLE = 1
	}
	return DataPoint{
		Time:             state.Time,
		Setpoint:         state.Setpoint,
		GlucoseReal:      state.GlucoseReal,
		GlucoseMeasured:  state.GlucoseMeasured,
		Error:            state.Error,
		PIDOutput:        state.PIDOutput,
		InsulinRate:      state.InsulinRate,
		BasalRate:        state.BasalRate,
		BolusAmount:      state.BolusAmount,
		PTerm:            state.PTerm,
		ITerm:            state.ITerm,
		DTerm:            state.DTerm,
		PerturbMeal:      pr.mealEffect,
		PerturbStress:    pr.stressEffect,
		PerturbExercise:  pr.exerciseEffect,
		PerturbOcclusion: perturbOcclusion,
		PerturbBLE:       perturbBLE,
	}
}

func sign(v float64) int {
	if v > 0 {
		return 1
	}
	if v < 0 {
		return -1
	}
	return 0
}
