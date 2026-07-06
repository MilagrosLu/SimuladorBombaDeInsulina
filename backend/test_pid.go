package main

import (
	"fmt"
	"insulinsim/simulation"
)

func main() {
	cfg := simulation.SimConfig{
		BasalRate:          0.8,
		MinInsulinRate:     0.0,
		MaxInsulinRate:     5.0,
		Setpoint:           100.0,
		SensorNoiseLevel:   0.0,
		SensorUpdateInterval: 5.0,
		Plant: simulation.PlantParams{
			GlucoseSensitivity: 28.0,
			SubcutaneousTimeConstant: 50.0,
		},
	}

	eng := simulation.NewEngine()
	cfg.PID = simulation.PIDParams{Kp: 10.0, Ki: 5.0, Kd: 0.0}
	state := eng.CreateInitialState(100.0, 100.0, cfg)
	
	state.Perturbations = []simulation.PerturbationEvent{
		{Type: "meal_small", StartTime: 10, Duration: 30, Magnitude: 1.0},
	}

	for t := 0.0; t < 1440.0; t += 30.0 {
		for i := 0; i < 240; i++ {
			state = eng.Step(state, cfg)
		}
		fmt.Printf("Time %4.0f | G: %6.1f | PID Out: %5.2f | I_accum: %6.1f | SystemState: %s\n", t, state.GlucoseReal, state.PIDOutput, state.ITerm, state.SystemState)
	}
}
