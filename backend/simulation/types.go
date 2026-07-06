package simulation

// ============================================================
// TIPOS DEL SISTEMA – Puerto Go de simulation.ts
// ============================================================

// PIDParams – parámetros del controlador PID
type PIDParams struct {
	Kp float64 `json:"kp"`
	Ki float64 `json:"ki"`
	Kd float64 `json:"kd"`
}

// PlantParams – parámetros de la planta (modelo Bergman)
type PlantParams struct {
	SubcutaneousTimeConstant float64 `json:"subcutaneousTimeConstant"`
	AbsorptionDelay          float64 `json:"absorptionDelay"`
	GlucoseSensitivity       float64 `json:"glucoseSensitivity"`
	GlucoseBasalProduction   float64 `json:"glucoseBasalProduction"`
	MetabolismTimeConstant    float64 `json:"metabolismTimeConstant"`
}

// SimConfig – configuración global de la simulación
type SimConfig struct {
	PID                 PIDParams   `json:"pid"`
	Plant               PlantParams `json:"plant"`
	Setpoint            float64     `json:"setpoint"`
	InitialGlucose      float64     `json:"initialGlucose"`
	MaxInsulinRate      float64     `json:"maxInsulinRate"`
	MinInsulinRate      float64     `json:"minInsulinRate"`
	BasalRate           float64     `json:"basalRate"`
	SensorNoiseLevel    float64     `json:"sensorNoiseLevel"`
	SensorUpdateInterval float64    `json:"sensorUpdateInterval"`
	TimeScale           float64     `json:"timeScale"`
}

// PerturbationEvent – perturbación activa
type PerturbationEvent struct {
	Type        string  `json:"type"`
	Magnitude   float64 `json:"magnitude"`
	StartTime   float64 `json:"startTime"`
	Duration    float64 `json:"duration"`
	Description string  `json:"description"`
	BolusGiven  bool    `json:"bolusGiven"` // ya se inyectó el bolo feedforward
}

// PerformanceMetrics – métricas de desempeño
type PerformanceMetrics struct {
	SettlingTime    *float64 `json:"settlingTime"`
	RiseTime        *float64 `json:"riseTime"`
	Overshoot       float64  `json:"overshoot"`
	SteadyStateError float64 `json:"steadyStateError"`
	IAE             float64  `json:"iae"`
	ISE             float64  `json:"ise"`
	ITAE            float64  `json:"itae"`
	MaxError        float64  `json:"maxError"`
	TimeInRange     float64  `json:"timeInRange"`
	TimeOutOfRange  float64  `json:"timeOutOfRange"`
	RecoveryTime    *float64 `json:"recoveryTime"`
}

// SimulationState – estado completo en un instante
type SimulationState struct {
	Time    float64 `json:"time"`
	Setpoint float64 `json:"setpoint"`

	GlucoseReal     float64 `json:"glucoseReal"`
	GlucoseMeasured float64 `json:"glucoseMeasured"`
	Error           float64 `json:"error"`

	PTerm     float64 `json:"pTerm"`
	ITerm     float64 `json:"iTerm"`
	DTerm     float64 `json:"dTerm"`
	PIDOutput float64 `json:"pidOutput"`

	InsulinRate float64 `json:"insulinRate"`
	BasalRate   float64 `json:"basalRate"`
	BolusAmount float64 `json:"bolusAmount"`   // Bolo de correción feedforward [U]
	BolusInsulin float64 `json:"bolusInsulin"` // Insulina de bolo aún en I_sub [U/min]
	ActuatorSaturated bool `json:"actuatorSaturated"`

	SubcutaneousInsulin float64 `json:"subcutaneousInsulin"`
	PlasmaInsulin       float64 `json:"plasmaInsulin"`
	GlucoseMetabolism   float64 `json:"glucoseMetabolism"`

	SensorNoise     float64 `json:"sensorNoise"`
	SensorReading   float64 `json:"sensorReading"`
	LastSensorUpdate float64 `json:"lastSensorUpdate"`

	BLEConnected    bool    `json:"bleConnected"`
	BLEPacketLoss   float64 `json:"blePacketLoss"`
	BLEDelay        float64 `json:"bleDelay"`
	LastValidReading float64 `json:"lastValidReading"`

	Perturbations []PerturbationEvent `json:"perturbations"`

	SystemState             string  `json:"systemState"` // "out_of_band" | "in_band" | "stable"
	StableTime              float64 `json:"stableTime"`
	TimeSinceLastDisturbance float64 `json:"timeSinceLastDisturbance"`
	TransientTime           float64 `json:"transientTime"`
	LastTransientTime       float64 `json:"lastTransientTime"`

	// Contadores de tiempo en zona de falla (minutos continuos)
	HypoTime  float64 `json:"hypoTime"`  // min continuos con glucosa < 70 mg/dL
	HyperTime float64 `json:"hyperTime"` // min continuos con glucosa > 180 mg/dL

	// Falla del sistema: cuando el organismo ya sufre el efecto del desvio
	SystemFailure bool   `json:"systemFailure"`
	FailureReason string `json:"failureReason"` // descripción clínica de la falla

	QoSFailure bool   `json:"qosFailure"`
	QoSReason  string `json:"qosReason"`

	Alarms  []string           `json:"alarms"`
	Metrics PerformanceMetrics `json:"metrics"`
}

// DataPoint – punto de datos para los gráficos
type DataPoint struct {
	Time     float64 `json:"time"`
	Setpoint float64 `json:"setpoint"`

	GlucoseReal     float64 `json:"glucoseReal"`
	GlucoseMeasured float64 `json:"glucoseMeasured"`
	Error           float64 `json:"error"`

	PIDOutput   float64 `json:"pidOutput"`
	InsulinRate float64 `json:"insulinRate"`
	BasalRate   float64 `json:"basalRate"`
	BolusAmount float64 `json:"bolusAmount"`

	PTerm float64 `json:"pTerm"`
	ITerm float64 `json:"iTerm"`
	DTerm float64 `json:"dTerm"`

	PerturbMeal     float64 `json:"perturbMeal"`
	PerturbStress   float64 `json:"perturbStress"`
	PerturbExercise float64 `json:"perturbExercise"`
	PerturbOcclusion float64 `json:"perturbOcclusion"`
	PerturbBLE      float64 `json:"perturbBLE"`
}
