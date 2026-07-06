package main

import (
	"fmt"
	"math"
	"insulinsim/simulation"
)

func main() {
	cfg := simulation.SimConfig{
		BasalRate:          0.8,
		MinInsulinRate:     0.0,
		MaxInsulinRate:     10.0, // or 5.0? Let's check typical MaxInsulinRate in config
		Setpoint:           100.0,
		SensorNoiseLevel:   1.0,
		SensorUpdateInterval: 5.0,
		Plant: simulation.PlantParams{
			GlucoseSensitivity: 28.0,
			SubcutaneousTimeConstant: 50.0,
		},
	}

	eng := simulation.NewEngine()
	// test multiple Ki, Kp
	for kp := 0.1; kp <= 10.0; kp += 1.0 {
		for ki := 0.01; ki <= 1.0; ki += 0.05 {
			for kd := 0.0; kd <= 5.0; kd += 1.0 {
				cfg.PID = simulation.PIDParams{Kp: kp, Ki: ki, Kd: kd}
				state := eng.CreateInitialState(100.0, 100.0, cfg)
				// Add a meal perturbation at t=10 to trigger the instability
				state.Perturbations = []simulation.PerturbationEvent{
					{Type: "meal_normal", StartTime: 10, Duration: 30, Magnitude: 3.0},
				}

				failed := false
				minG := 1000.0
				for t := 0.0; t < 1440.0; t += 0.125 { // run for 24h
					state = eng.Step(state, cfg)
					if state.GlucoseReal < minG {
						minG = state.GlucoseReal
					}
					if state.SystemFailure {
						fmt.Printf("FAILURE: Kp=%.2f, Ki=%.3f, Kd=%.2f -> Min Glucose: %.1f\n", kp, ki, kd, minG)
						failed = true
						break
					}
				}
			}
		}
	}
}
