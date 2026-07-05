package simulation

// ============================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================
//
// GANANCIAS PID CALIBRADAS PARA UN ADULTO T1D (70 kg):
//
//   Kp = 0.035  (antes: 0.10)
//     Problema original: con error inicial de 80 mg/dL, el término P
//     pedía 0.10×80 = 8 U/h desde el primer instante. Una bomba de
//     insulina sana no aumenta la dosis de 0.8→8 U/h de golpe.
//     Con Kp=0.035 la demanda P inicial es 2.8 U/h, mucho más gradual.
//
//   Ki = 0.0008  (antes: 0.004)
//     El término I acumulaba error muy rápido (integralLimit=3000 * ki).
//     Con Ki pequeño, la corrección integral tarda ~45 min en ser
//     significativa, igual que en los sistemas APS comerciales.
//
//   Kd = 0.4  (sin cambio significativo, se usa para frenar la caída)
//     El derivativo ya estaba razonable. Se sube levemente para que
//     cuando la glucosa caiga rápido, el controlador frene antes.
//
//   MaxInsulinRate = 4.0 U/h  (antes: 30.0 U/h)
//     El MiniMed 780G tiene un límite automático de ~3.5–4× la tasa
//     basal del paciente. Con basal=0.8, el tope real es ≈3.2 U/h.
//     4.0 U/h es un margen clínicamente razonable.
//
func DefaultConfig() SimConfig {
	return SimConfig{
		PID: PIDParams{
			Kp: 0.04,  // respuesta proporcional suave al arranque
			Ki: 0.005, // integrador lento, sin windup en el transitorio
			Kd: 0.05,   // modificado a 0.05 a pedido
		},
		Plant: PlantParams{
			SubcutaneousTimeConstant: 30.0, // τ_sub = 30 min
			AbsorptionDelay:          15.0, // tiempo muerto de 15 min
			GlucoseSensitivity:       15, // ISF nominal (28 → Ks=1.0)
			GlucoseBasalProduction:   0.8,
			MetabolismTimeConstant:   50.0, // ajustado a 50 min
		},
		Setpoint:             100,  // target glicémico [mg/dL]
		InitialGlucose:       180,  // glucosa inicial hiperglucémica
		MaxInsulinRate:       4.0,  // tope clínico (~4×basal, MiniMed 780G)
		MinInsulinRate:       0.0,
		BasalRate:            0.8,  // tasa basal de fondo [U/h]
		SensorNoiseLevel:     8,    // Guardian 4 σ≈8 mg/dL
		SensorUpdateInterval: 5,    // CGM: actualización cada 5 min
		TimeScale:            1,
	}
}
