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
//   MaxInsulinRate = 12.0 U/h
//     Tope alto para saturar libremente en el transitorio y proveer toda la energía.
//
func DefaultConfig() SimConfig {
	return SimConfig{
		PID: PIDParams{
			Kp: 0.23,
			Ki: 0.020,
			Kd: 0.35,
		},
		Plant: PlantParams{
			SubcutaneousTimeConstant: 5.0,  // τ_sub = 5 min (muy rápido, simplificación académica)
			AbsorptionDelay:          3.0,  // retardo puro minimizado
			GlucoseSensitivity:       18,   // ISF más responsivo
			GlucoseBasalProduction:   0.8,
			MetabolismTimeConstant:   20.0, // dinámica de digestión muy rápida
		},
		Setpoint:             100,
		InitialGlucose:       180,
		MaxInsulinRate:       12.0, // Permite acción de control agresiva
		MinInsulinRate:       0.0,
		BasalRate:            0.8,  // tasa basal de fondo [U/h]
		SensorNoiseLevel:     8,    // Guardian 4 σ≈8 mg/dL
		SensorUpdateInterval: 5,    // CGM: actualización cada 5 min
		TimeScale:            1,
	}
}
