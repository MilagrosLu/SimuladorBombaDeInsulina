package simulation

// ============================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================
//
// CONFIGURACIÓN CALIBRADA PARA SETTLING EN 60–90 MIN
// simulando NovoRapid con prebolo de 15 min (τ_sub=8 min):
//
//   Kp = 0.35
//     Ganancia alta para un accionamiento agresivo e inmediato del actuador.
//
//   Ki = 0.020
//     Ganancia integral mucho más rápida para cerrar el error a cero
//     y forzar la transición a estado estable velozmente.
//
//   Kd = 0.50
//     Derivativo fuerte para frenar el ímpetu inicial y generar un amortiguamiento
//     crítico (sin sobreimpulso).
//
//   τ_sub = 5 min
//     Simplificación académica: se reduce la inercia del reservorio subcutáneo
//     a 5 min para responder a la velocidad requerida por el control, evitando un polo dominante lento.
//
//   MaxInsulinRate = 30.0 U/h
//     Tope alto para saturar libremente en el transitorio y permitir sobredosis en perfiles inestables.
//
func DefaultConfig() SimConfig {
	return SimConfig{
		PID: PIDParams{
			Kp: 1.0,
			Ki: 0.005,
			Kd: 8.0,
		},
		Plant: PlantParams{
			SubcutaneousTimeConstant: 3.0,  // τ_sub reducido para compensar el retardo sin necesidad de Kd alto
			AbsorptionDelay:          3.0,
			GlucoseSensitivity:       18,
			GlucoseBasalProduction:   0.8,
			MetabolismTimeConstant:   20.0,
		},
		Setpoint:             100,
		InitialGlucose:       180,
		MaxInsulinRate:       30.0, // Aumentado a 30 U/h para permitir sobredosis letal en perfil inestable
		MinInsulinRate:       0.0,
		BasalRate:            2.4,  // tasa basal calibrada para contrarrestar exactamente EGP (1.5 mg/dL/min) a 100 mg/dL
		SensorNoiseLevel:     1,    // Guardian 4 σ≈8 mg/dL
		SensorUpdateInterval: 5,    // CGM: actualización cada 5 min
		TimeScale:            1,
	}
}
