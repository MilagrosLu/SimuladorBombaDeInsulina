package simulation

// ============================================================
// CONFIGURACIÓN POR DEFECTO – MiniMed 780G-inspired
// ============================================================
//
// Presets calibrados para el nuevo ciclo de simulación con
// actuador físico (micromotor) y compartimentos sub-Q/plasma separados.
//
// ── PRESET ÓPTIMO ──────────────────────────────────────────
//   Kp=1.0, Ki=0.005, Kd=8.0
//   Settling típico < 60 min. Respuesta amortiguada críticamente.
//
// ── PRESET LENTO ───────────────────────────────────────────
//   Kp=0.08, Ki=0.0005, Kd=0.5
//   Settling > 4 h. El integrador arrastra lentamente al setpoint.
//   Sin sobreimpulso pero con error estacionario prolongado.
//
// ── PRESET INESTABLE (CICLO LÍMITE) ────────────────────────
//   Kp=10.0, Ki=5.0, Kd=0.0
//   Ganancias positivas extremas que causan windup agresivo.
//   El sistema oscila entre ~90 y ~130 mg/dL indefinidamente.
//   La protección Suspend Before Low evita el coma hipoglucémico.
//
// ── ACTUADOR FÍSICO ────────────────────────────────────────
//   stepsPerUnit = 200   (200 pasos del motor = 1 U de insulina)
//   volumePerStep = 0.5  (0.5 µL por paso)
//   unitsPerStep = 0.005 (= 1/200 U por paso)
//   Esto representa un micromotor de paso típico en bombas comerciales.
// ============================================================

func DefaultConfig() SimConfig {
	return SimConfig{
		PID: PIDParams{
			Kp: 1.0,
			Ki: 0.005,
			Kd: 8.0,
		},
		Plant: PlantParams{
			SubcutaneousTimeConstant: 3.0,
			AbsorptionDelay:          3.0,
			GlucoseSensitivity:       18,
			GlucoseBasalProduction:   0.8,
			MetabolismTimeConstant:   20.0,
		},
		Actuator: ActuatorParams{
			StepsPerUnit:  200.0,  // 200 pasos = 1 U
			VolumePerStep: 0.5,    // µL por paso
			UnitsPerStep:  0.005,  // = 1/200 U por paso
		},
		Setpoint:             100,
		InitialGlucose:       180,
		MaxInsulinRate:       30.0,
		MinInsulinRate:       0.0,
		BasalRate:            2.4,
		SensorNoiseLevel:     1,
		SensorUpdateInterval: 5,
		TimeScale:            1,
	}
}
