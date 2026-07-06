package simulation

// ============================================================
// MOTOR DE SIMULACIÓN – MiniMed 780G-inspired
// ============================================================
// Ciclo de control por tick (ver orden en Step):
//  1. Perturbaciones externas
//  2. Modelo de Bergman (planta fisiológica)
//  3. Sensor CGM + ruido
//  4. Comunicación BLE
//  5. Filtro EMA sobre glucosa medida
//  6. Tendencia de glucosa
//  7. Predicción a 30 min
//  8. Protect: Suspend Before Low
//  9. Controlador PID (P + I con anti-windup + D)
// 10. Bolo feedforward (comidas, separado del PID)
// 11. Tasa Total = Basal PID + Bolo
// 12. Saturación de salida
// 13. Oclusión del actuador
// 14. Actuador físico: tasa → pasos del micromotor → insulina sub-Q
// 15. Absorción subcutánea (compartimento sub-Q → plasma)
// 16. Siguiente tick usa insulina plasmática del paso anterior
// 17. Actualización de UI (métricas, estado, alarmas)
// ============================================================

import (
	"math"
	"math/rand"
)

// ── Constantes del modelo fisiológico de Bergman ─────────────
const (
	dt            = 0.125 // min por paso de simulación
	stableTimeReq = 5.0   // min continuos dentro de la banda para declarar estable

	// p1: clearance de glucosa endógena
	p1 = 0.030
	// p2: clearance de insulina en tejido (acelerado para respuesta académica)
	p2 = 0.080
	// p3: sensibilidad insulínica (escalado junto con p2)
	p3 = 0.020

	// EGP: producción hepática de glucosa [mg/dL/min]
	EGP = 1.5

	// Umbral Suspend Before Low [mg/dL]
	suspendThreshold = 90.0
	// Horizonte de predicción [min]
	predictionHorizon = 30.0

	// Filtro EMA del sensor (α pequeño = mayor suavizado)
	alphaEMA = 0.20
	// Filtro EMA de la derivada (α pequeño = mayor inmunidad al ruido)
	alphaD = 0.05
)

// ── Engine – estado mutable entre ticks ──────────────────────
type Engine struct {
	// PID
	integralAccum      float64
	prevFilteredGlucose float64
	filteredDerivative float64
	lastPIDOutput      pidResult

	// Sensor / BLE
	filteredGlucose float64
	lastBLEReading  float64

	// Actuador
	motorStepAccum float64 // acumulador de pasos fraccionarios del micromotor

	// Planta fisiológica
	tissueInsulinEffect float64 // X(t): efecto de insulina en tejido [mU/L/min]
	plasmaInsulin       float64 // I_plasma(t): insulina en plasma [U/min]
}

func NewEngine() *Engine { return &Engine{} }

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

func gaussianNoise(std float64) float64 {
	u1 := rand.Float64()
	if u1 < 1e-10 {
		u1 = 1e-10
	}
	return std * math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*rand.Float64())
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

// ── pidResult ────────────────────────────────────────────────
type pidResult struct {
	p, i, d, output float64
	saturated        bool
}

// ── perturbResult ────────────────────────────────────────────
type perturbResult struct {
	glucoseEffect   float64
	mealEffect      float64
	stressEffect    float64
	exerciseEffect  float64
	occlusionActive bool
	bleInterference bool
}

// ── BLOQUE 1: Perturbaciones ─────────────────────────────────
func computePerturbations(perturbations []PerturbationEvent, t float64) perturbResult {
	var r perturbResult
	for _, p := range perturbations {
		if t < p.StartTime || t > p.StartTime+p.Duration {
			continue
		}
		progress := (t - p.StartTime) / p.Duration
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

// ── BLOQUE 2: Modelo de Bergman (planta fisiológica) ─────────
// Utiliza la insulina plasmática I_plasma del tick anterior.
func (e *Engine) stepPlant(glucose, plasmaInsulin, perturbEffect, sensitivityScale float64) float64 {
	dX := -p2*e.tissueInsulinEffect + p3*plasmaInsulin
	e.tissueInsulinEffect += dX * dt

	var dG float64
	if plasmaInsulin < 0.001 {
		dG = EGP + perturbEffect
	} else {
		dG = EGP - 0.005*glucose - e.tissueInsulinEffect*glucose*sensitivityScale + perturbEffect
	}
	return clamp(glucose+dG*dt, 20, 800)
}

// ── BLOQUE 3: Sensor CGM ─────────────────────────────────────
func stepSensor(glucoseReal, noiseLevel, t, lastUpdate, updateInterval float64) (reading float64, updated bool) {
	reading = clamp(glucoseReal+gaussianNoise(noiseLevel), 20, 400)
	updated = (t - lastUpdate) >= updateInterval
	return
}

// ── BLOQUE 5+6+7: Filtro EMA + Tendencia + Predicción ────────
func (e *Engine) filterAndPredict(sensorReading float64) (filtered, trend, predicted float64) {
	// Filtro EMA sobre la lectura del sensor
	filtered = alphaEMA*sensorReading + (1-alphaEMA)*e.filteredGlucose
	e.filteredGlucose = filtered

	// Tendencia: derivada filtrada con EMA
	rawDeriv := (filtered - e.prevFilteredGlucose) / dt
	e.filteredDerivative = alphaD*rawDeriv + (1-alphaD)*e.filteredDerivative
	e.prevFilteredGlucose = filtered
	trend = e.filteredDerivative // mg/dL/min

	// Predicción lineal a 30 min
	predicted = filtered + trend*predictionHorizon
	return
}

// ── BLOQUE 9: Controlador PID ────────────────────────────────
func (e *Engine) computePID(pidError, trend float64, cfg SimConfig) pidResult {
	kp, ki, kd := cfg.PID.Kp, cfg.PID.Ki, cfg.PID.Kd

	p := kp * pidError

	const integralLimit = 3000.0
	if pidError != 0 {
		// Anti-windup: congelar integral si la glucosa cae rápido
		isFallingFast := pidError > 0 && trend < -1.0
		if !isFallingFast {
			e.integralAccum += pidError * dt
			e.integralAccum = clamp(e.integralAccum, -integralLimit, integralLimit)
		}
	}
	i := ki * e.integralAccum
	d := kd * e.filteredDerivative

	// La basal nominal se suma para que el PID opere alrededor del punto de equilibrio
	raw := cfg.BasalRate + p + i + d
	out := clamp(raw, cfg.MinInsulinRate, cfg.MaxInsulinRate)
	saturated := raw != out

	return pidResult{p: p, i: i, d: d, output: out, saturated: saturated}
}

// ── BLOQUE 10: Bolo feedforward (comidas) ────────────────────
// Detecta el primer tick de cada comida y calcula un bolo parcial (40%).
// Completamente separado del PID.
func computeMealBolus(perts []PerturbationEvent, t float64, occluded bool, sensitivity float64) (bolusIntended, bolusEffective float64, updatedPerts []PerturbationEvent) {
	updatedPerts = make([]PerturbationEvent, len(perts))
	copy(updatedPerts, perts)

	for idx := range updatedPerts {
		p := &updatedPerts[idx]
		isMeal := p.Type == "meal_small" || p.Type == "meal_normal" || p.Type == "meal_large"
		if !isMeal || p.BolusGiven || t < p.StartTime || t > p.StartTime+p.Duration {
			continue
		}
		gaussianArea := 0.44
		totalRise := p.Magnitude * p.Duration * gaussianArea
		bolus := (totalRise / sensitivity) * 0.40
		bolusIntended = bolus
		if !occluded {
			bolusEffective = bolus
		}
		p.BolusGiven = true
	}
	return
}

// ── BLOQUE 14: Actuador físico (micromotor) ──────────────────
// Convierte tasa [U/h] → pasos del motor → insulina sub-Q entregada [U/min].
// Usa un acumulador de pasos para representar tasas pequeñas con precisión.
func (e *Engine) stepActuator(rateUh float64, act ActuatorParams) (stepsThisTick, insulinDelivered float64) {
	// U/h → U/min → U por tick
	uPerTick := (rateUh / 60.0) * dt

	// Convertir a pasos fraccionarios y acumular
	fractionalSteps := uPerTick * act.StepsPerUnit
	e.motorStepAccum += fractionalSteps

	// Solo ejecutar pasos enteros (el micromotor es discreto)
	wholeSteps := math.Floor(e.motorStepAccum)
	e.motorStepAccum -= wholeSteps

	stepsThisTick = wholeSteps
	insulinDelivered = wholeSteps * act.UnitsPerStep // U entregadas en este tick
	return
}

// ── BLOQUE 15: Absorción subcutánea → plasma ─────────────────
// Compartimento sub-Q (primer orden, τ = SubcutaneousTimeConstant).
// La insulina pasa gradualmente de sub-Q al plasma.
func stepAbsorption(subQ, insulinDelivered float64, cfg SimConfig) (newSubQ, newPlasma float64) {
	tau := cfg.Plant.SubcutaneousTimeConstant
	// Convertir insulina entregada [U] al compartimento sub-Q [U/min]
	uPerMin := insulinDelivered / dt
	newSubQ = subQ + (dt/tau)*(uPerMin-subQ)
	// El plasma recibe la misma cantidad que fluye fuera del compartimento sub-Q
	newPlasma = newSubQ
	return
}

// ── CreateInitialState ────────────────────────────────────────
func (e *Engine) CreateInitialState(setpoint, initialGlucose float64, cfg SimConfig) SimulationState {
	initError := initialGlucose - setpoint

	// Pre-cargar insulina sub-Q al equilibrio basal
	subQ := cfg.BasalRate / 60.0
	tissue := (p3 / p2) * subQ
	e.tissueInsulinEffect = tissue
	e.plasmaInsulin = subQ

	e.prevFilteredGlucose = initialGlucose
	e.filteredGlucose = initialGlucose
	e.filteredDerivative = 0
	e.lastBLEReading = initialGlucose
	e.motorStepAccum = 0
	e.integralAccum = 0
	e.lastPIDOutput = pidResult{output: cfg.BasalRate}

	return SimulationState{
		Time:                0,
		Setpoint:            setpoint,
		GlucoseReal:         initialGlucose,
		GlucoseMeasured:     initialGlucose,
		GlucosePredicted:    initialGlucose,
		Error:               initError,
		GlucoseMetabolism:   initialGlucose,
		SensorReading:       initialGlucose,
		BLEConnected:        true,
		BLEPacketLoss:       0.02,
		BLEDelay:            50,
		LastValidReading:    initialGlucose,
		Perturbations:       []PerturbationEvent{},
		SystemState:         "out_of_band",
		Alarms:              []string{},
		Metrics: PerformanceMetrics{
			SteadyStateError: initError,
			MaxError:         math.Abs(initError),
		},
		SubcutaneousInsulin: subQ,
		PlasmaInsulin:       subQ,
	}
}

// ── Step – ciclo completo de simulación ──────────────────────
func (e *Engine) Step(state SimulationState, cfg SimConfig) SimulationState {
	newTime := state.Time + dt

	// Congelar si hubo fallo catastrófico
	if state.SystemFailure {
		state.Time = newTime
		return state
	}

	// ── 1. PERTURBACIONES ────────────────────────────────────
	pr := computePerturbations(state.Perturbations, state.Time)

	// ── 2. MODELO DE BERGMAN ─────────────────────────────────
	// Usa plasmaInsulin del tick anterior (separación física correcta)
	sensitivityScale := cfg.Plant.GlucoseSensitivity / 28.0
	newGlucose := e.stepPlant(state.GlucoseReal, state.PlasmaInsulin, pr.glucoseEffect, sensitivityScale)

	// ── 3. SENSOR CGM ────────────────────────────────────────
	noiseLevel := cfg.SensorNoiseLevel
	for _, p := range state.Perturbations {
		if p.Type == "sensor_noise" && state.Time >= p.StartTime && state.Time <= p.StartTime+p.Duration {
			if p.Magnitude > 0 {
				noiseLevel = p.Magnitude
			} else {
				noiseLevel *= 5
			}
			break
		}
	}
	sensorReading, sensorUpdated := stepSensor(newGlucose, noiseLevel, newTime, state.LastSensorUpdate, cfg.SensorUpdateInterval)
	newLastSensorUpdate := state.LastSensorUpdate
	if sensorUpdated {
		newLastSensorUpdate = newTime
	}

	// ── 4. COMUNICACIÓN BLE ──────────────────────────────────
	bleConnected := !pr.bleInterference
	var bleReading float64
	if bleConnected {
		if rand.Float64() >= state.BLEPacketLoss {
			e.lastBLEReading = sensorReading
		}
		bleReading = e.lastBLEReading
	} else {
		bleReading = e.lastBLEReading
	}

	// ── 5+6+7. FILTRO EMA + TENDENCIA + PREDICCIÓN ───────────
	filtered, trend, predicted := e.filterAndPredict(bleReading)

	// ── 8. SUSPEND BEFORE LOW ────────────────────────────────
	suspendActive := filtered < suspendThreshold || predicted < suspendThreshold

	// ── 9. CONTROLADOR PID ───────────────────────────────────
	pidError := filtered - state.Setpoint
	var pid pidResult
	if bleConnected && !suspendActive {
		pid = e.computePID(pidError, trend, cfg)
		e.lastPIDOutput = pid
	} else if !bleConnected {
		// Sin comunicación: congelar última salida conocida
		pid = e.lastPIDOutput
	} else {
		// Suspend Before Low activo: output = 0
		pid = pidResult{p: 0, i: 0, d: 0, output: 0, saturated: false}
		e.integralAccum = 0 // reset integral para evitar windup durante la suspensión
	}

	// ── 10. BOLO FEEDFORWARD ─────────────────────────────────
	bolusIntended, bolusEffective, newPerts := computeMealBolus(
		state.Perturbations, state.Time, pr.occlusionActive, cfg.Plant.GlucoseSensitivity,
	)

	// ── 11. TASA TOTAL = BASAL PID + BOLO ────────────────────
	totalRateRaw := pid.output + bolusIntended

	// ── 12. SATURACIÓN ───────────────────────────────────────
	totalRate := clamp(totalRateRaw, cfg.MinInsulinRate, cfg.MaxInsulinRate)

	// ── 13. OCLUSIÓN ─────────────────────────────────────────
	// El PID sigue calculando pero el actuador no entrega insulina
	effectiveRate := totalRate
	if pr.occlusionActive {
		effectiveRate = 0
		bolusEffective = 0
	}

	// ── 14. ACTUADOR FÍSICO (micromotor) ─────────────────────
	motorSteps, insulinDelivered := e.stepActuator(effectiveRate, cfg.Actuator)
	// Añadir bolo como insulina entregada directamente al sub-Q
	insulinDelivered += bolusEffective

	// ── 15. ABSORCIÓN SUBCUTÁNEA → PLASMA ────────────────────
	newSubQ, newPlasma := stepAbsorption(state.SubcutaneousInsulin, insulinDelivered, cfg)

	// ── 16. El siguiente tick de Bergman usará newPlasma ─────
	// (newPlasma queda guardado en SimulationState.PlasmaInsulin)

	// ── 17. ACTUALIZACIÓN DE MÉTRICAS Y ESTADO ───────────────
	realError := newGlucose - state.Setpoint
	measuredError := filtered - state.Setpoint

	// Estado estable: ±5 mg/dL durante stableTimeReq minutos continuos
	stableThreshold := 5.0
	isInsideBand := math.Abs(realError) <= stableThreshold
	stableTime := state.StableTime
	if isInsideBand {
		stableTime += dt
	} else {
		stableTime = 0
	}

	systemState := "out_of_band"
	if stableTime >= stableTimeReq {
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

	// Perturbaciones activas (excluir sensor_noise)
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

	// Métricas de desempeño
	m := state.Metrics
	absError := math.Abs(realError)
	m.IAE += absError * dt
	m.ISE += realError * realError * dt
	m.ITAE += newTime * absError * dt
	if absError > m.MaxError {
		m.MaxError = absError
	}
	overshoot := ((newGlucose - state.Setpoint) / state.Setpoint) * 100
	if overshoot > m.Overshoot && realError > 0 {
		m.Overshoot = overshoot
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
	if m.RiseTime == nil && sign(state.Error) != sign(realError) {
		v := newTime
		m.RiseTime = &v
	}

	// Detección de falla catastrófica
	hypoTime := state.HypoTime
	hyperTime := state.HyperTime
	if newGlucose < 70.0 {
		hypoTime += dt
	} else {
		hypoTime = 0
	}
	if newGlucose >= 300.0 {
		hyperTime += dt
	} else {
		hyperTime = 0
	}

	systemFailure := state.SystemFailure
	failureReason := state.FailureReason
	if !systemFailure {
		if newGlucose <= 55.0 {
			systemFailure = true
			failureReason = "FALLO CATASTRÓFICO: Hipoglucemia severa (<= 55 mg/dL) – Coma instantáneo"
		} else if newGlucose >= 300.0 && hyperTime >= 240.0 {
			systemFailure = true
			failureReason = "FALLO CATASTRÓFICO: Hiperglucemia prolongada (>= 300 mg/dL por 4h) – Cetoacidosis diabética"
		}
	}

	qosFailure := false
	qosReason := ""
	if newGlucose < 70.0 {
		qosFailure = true
		qosReason = "Fallo de QoS: Hipoglucemia sintomática (< 70 mg/dL)"
	} else if newGlucose > 180.0 {
		qosFailure = true
		qosReason = "Fallo de QoS: Hiperglucemia sintomática (> 180 mg/dL)"
	}

	// Alarmas
	alarms := []string{}
	if newGlucose < 70 {
		alarms = append(alarms, "HIPOGLUCEMIA")
	}
	if newGlucose > 250 {
		alarms = append(alarms, "HIPERGLUCEMIA")
	}
	if pr.occlusionActive {
		alarms = append(alarms, "OCLUSIÓN DE CÁNULA")
	}
	if !bleConnected {
		alarms = append(alarms, "SIN COMUNICACIÓN BLE")
	}
	if suspendActive {
		alarms = append(alarms, "SUSPEND BEFORE LOW ACTIVO")
	}

	// Limpiar perturbaciones expiradas
	activePerts := []PerturbationEvent{}
	for _, p := range newPerts {
		if newTime <= p.StartTime+p.Duration {
			activePerts = append(activePerts, p)
		}
	}

	return SimulationState{
		Time:                     newTime,
		Setpoint:                 state.Setpoint,
		GlucoseReal:              newGlucose,
		GlucoseMeasured:          filtered,
		GlucosePredicted:         predicted,
		Error:                    measuredError,
		PTerm:                    pid.p,
		ITerm:                    pid.i,
		DTerm:                    pid.d,
		PIDOutput:                pid.output,
		BasalRate:                pid.output,
		BolusAmount:              bolusIntended,
		BolusInsulin:             bolusEffective,
		TotalRate:                totalRate,
		InsulinRate:              effectiveRate,
		MotorSteps:               motorSteps,
		ActuatorSaturated:        pid.saturated,
		SubcutaneousInsulin:      newSubQ,
		PlasmaInsulin:            newPlasma,
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
		HypoTime:                 hypoTime,
		HyperTime:                hyperTime,
		SystemFailure:            systemFailure,
		FailureReason:            failureReason,
		QoSFailure:               qosFailure,
		QoSReason:                qosReason,
		Alarms:                   alarms,
		Metrics:                  m,
	}
}

// ── ExtractDataPoint ──────────────────────────────────────────
func ExtractDataPoint(state SimulationState) DataPoint {
	pr := computePerturbations(state.Perturbations, state.Time)
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
		GlucosePredicted: state.GlucosePredicted,
		Error:            state.Error,
		PIDOutput:        state.PIDOutput,
		TotalRate:        state.TotalRate,
		InsulinRate:      state.InsulinRate,
		BasalRate:        state.BasalRate,
		BolusAmount:      state.BolusAmount,
		MotorSteps:       state.MotorSteps,
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
