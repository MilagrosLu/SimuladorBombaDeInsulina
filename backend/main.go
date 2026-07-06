// ============================================================
// BACKEND – Servidor WebSocket para la simulación de insulina
// ============================================================
// ARQUITECTURA DE RENDIMIENTO (Procesamiento en Servidor):
//
//   El backend mantiene TODO el historial en RAM (buffer de 2400 puntos).
//   El frontend no guarda NADA del historial (uso de RAM ~0).
//
//   Cada 250ms, el backend corta la "ventana visible" del historial,
//   le aplica LTTB (downsampling a 80 puntos) y lo envía a los clientes.
//   Si un cliente navega al pasado (viewOffset), el backend calcula
//   su ventana específica y se la manda solo a él.
// ============================================================
package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"insulinsim/simulation"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 16 * 1024,
}

// Constantes de rendimiento (iguales a las de React previamente)
const (
	WINDOW_POINTS = 300
	MAX_HISTORY   = 2400
	CHART_POINTS  = 80
	RENDER_MS     = 250
)

// ── Mensajes del protocolo ────────────────────────────────────
type IncomingMsg struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type OutgoingMsg struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type ViewPayload struct {
	Offset int `json:"offset"`
}

// BolusEvent – evento discreto de bolo (no se pierde con LTTB)
type BolusEvent struct {
	Time   float64 `json:"time"`
	Amount float64 `json:"amount"`
}

type UpdatePayload struct {
	Points       []simulation.DataPoint     `json:"points"`
	State        simulation.SimulationState `json:"state"`
	TotalBuffered int                       `json:"totalBuffered"`
	BolusEvents  []BolusEvent               `json:"bolusEvents"`
}

type StartPayload struct {
	TimeScale float64 `json:"timeScale"`
}

type TimeScalePayload struct {
	TimeScale float64 `json:"timeScale"`
}

type ResetCmdPayload struct {
	Setpoint       float64 `json:"setpoint"`
	InitialGlucose float64 `json:"initialGlucose"`
}

// ── Comandos internos ─────────────────────────────────────────
type cmdKind int

const (
	cmdStart cmdKind = iota
	cmdPause
	cmdReset
	cmdConfig
	cmdPerturbation
	cmdTimeScale
)

type command struct {
	kind         cmdKind
	timeScale    float64
	config       simulation.SimConfig
	perturbation simulation.PerturbationEvent
	resetSP      float64
	resetIG      float64
}

// ── Cliente conectado ────────────────────────────────────────
type Client struct {
	conn       *websocket.Conn
	ch         chan []byte
	viewOffset int
	mu         sync.Mutex // Protege viewOffset
}

// ── Hub de clientes ───────────────────────────────────────────
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
}

func newHub() *Hub {
	return &Hub{clients: make(map[*Client]bool)}
}

func (h *Hub) add(conn *websocket.Conn) *Client {
	c := &Client{
		conn:       conn,
		ch:         make(chan []byte, 8),
		viewOffset: 0,
	}
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
	return c
}

func (h *Hub) remove(c *Client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		close(c.ch)
		delete(h.clients, c)
	}
	h.mu.Unlock()
}

// ── Loop de simulación ────────────────────────────────────────
type simLoop struct {
	hub         *Hub
	history     []simulation.DataPoint
	bolusEvents []BolusEvent
	lastState   simulation.SimulationState
	mu          sync.RWMutex
}

func newSimLoop(hub *Hub) *simLoop {
	return &simLoop{
		hub:         hub,
		history:     make([]simulation.DataPoint, 0, MAX_HISTORY),
		bolusEvents: []BolusEvent{},
	}
}

func (sl *simLoop) run(cmdCh <-chan command) {
	engine := simulation.NewEngine()
	cfg := simulation.DefaultConfig()
	state := engine.CreateInitialState(cfg.Setpoint, cfg.InitialGlucose, cfg)

	running := false
	timeScale := 1.0

	tickInterval := func(ts float64) time.Duration {
		ms := math.Round(50.0 / ts)
		if ms < 1 {
			ms = 1
		}
		return time.Duration(ms) * time.Millisecond
	}

	ticker := time.NewTicker(tickInterval(timeScale))
	defer ticker.Stop()

	sl.mu.Lock()
	sl.lastState = state
	sl.mu.Unlock()

	for {
		select {
		case cmd, ok := <-cmdCh:
			if !ok {
				return
			}
			switch cmd.kind {
			case cmdStart:
				if cmd.timeScale > 0 {
					timeScale = cmd.timeScale
					ticker.Reset(tickInterval(timeScale))
				}
				running = true

			case cmdPause:
				running = false

			case cmdTimeScale:
				if cmd.timeScale > 0 {
					timeScale = cmd.timeScale
					ticker.Reset(tickInterval(timeScale))
				}

			case cmdConfig:
				cfg = cmd.config
				state.Setpoint = cfg.Setpoint

			case cmdReset:
				running = false
				cfg.Setpoint = cmd.resetSP
				cfg.InitialGlucose = cmd.resetIG
				state = engine.CreateInitialState(cmd.resetSP, cmd.resetIG, cfg)

				sl.mu.Lock()
				sl.history = sl.history[:0]
				sl.bolusEvents = []BolusEvent{}
				sl.lastState = state
				sl.mu.Unlock()
				sl.broadcastUpdate()

			case cmdPerturbation:
				state.Perturbations = append(state.Perturbations, cmd.perturbation)
			}

		case <-ticker.C:
			if !running {
				continue
			}

			state.Setpoint = cfg.Setpoint
			state = engine.Step(state, cfg)
			dp := simulation.ExtractDataPoint(state)

			sl.mu.Lock()
			// Registrar bolo como evento independiente (no se pierde con LTTB)
			if state.BolusAmount > 0 {
				sl.bolusEvents = append(sl.bolusEvents, BolusEvent{
					Time:   state.Time,
					Amount: state.BolusAmount,
				})
			}
			if len(sl.history) >= MAX_HISTORY {
				// Circular buffer shift
				copy(sl.history, sl.history[1:])
				sl.history = sl.history[:len(sl.history)-1]
			}
			sl.history = append(sl.history, dp)
			sl.lastState = state
			sl.mu.Unlock()
		}
	}
}

// ── Render Ticker (250ms fijo) ────────────────────────────────
func (sl *simLoop) startRenderTicker() {
	ticker := time.NewTicker(RENDER_MS * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		sl.broadcastUpdate()
	}
}

func (sl *simLoop) broadcastUpdate() {
	sl.mu.RLock()
	n := len(sl.history)
	state := sl.lastState
	// Crear una copia temporal de todo el array es rápido en Go
	histCopy := make([]simulation.DataPoint, n)
	copy(histCopy, sl.history)
	bolusEvsCopy := make([]BolusEvent, len(sl.bolusEvents))
	copy(bolusEvsCopy, sl.bolusEvents)
	sl.mu.RUnlock()

	sl.hub.mu.RLock()
	defer sl.hub.mu.RUnlock()

	for c := range sl.hub.clients {
		c.mu.Lock()
		offset := c.viewOffset
		c.mu.Unlock()

		// Calcular la ventana visible para este cliente
		end := n - offset
		if end < 0 {
			end = 0
		}
		start := end - WINDOW_POINTS
		if start < 0 {
			start = 0
		}

		windowed := histCopy[start:end]
		downsampled := simulation.LTTBDownsample(windowed, CHART_POINTS)

		// Filtrar bolos que caen en la ventana de tiempo visible
		var windowedBoluses []BolusEvent
		if len(windowed) > 0 {
			tStart := windowed[0].Time
			tEnd := windowed[len(windowed)-1].Time
			for _, b := range bolusEvsCopy {
				if b.Time >= tStart && b.Time <= tEnd {
					windowedBoluses = append(windowedBoluses, b)
				}
			}
		}
		if windowedBoluses == nil {
			windowedBoluses = []BolusEvent{}
		}

		msg := OutgoingMsg{
			Type: "update",
			Payload: UpdatePayload{
				Points:        downsampled,
				State:         state,
				TotalBuffered: n,
				BolusEvents:   windowedBoluses,
			},
		}

		data, err := json.Marshal(msg)
		if err == nil {
			select {
			case c.ch <- data:
			default:
				// Cliente lento, descartar frame
			}
		}
	}
}

// ── Handler WebSocket ─────────────────────────────────────────
func wsHandler(hub *Hub, cmdCh chan<- command) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		c := hub.add(conn)
		defer hub.remove(c)

		// Goroutine para escribir
		go func() {
			for data := range c.ch {
				conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					return
				}
			}
		}()

		ready, _ := json.Marshal(OutgoingMsg{Type: "ready"})
		c.ch <- ready

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var msg IncomingMsg
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "start":
				var p StartPayload
				json.Unmarshal(msg.Payload, &p)
				if p.TimeScale == 0 { p.TimeScale = 1 }
				cmdCh <- command{kind: cmdStart, timeScale: p.TimeScale}
			case "pause":
				cmdCh <- command{kind: cmdPause}
			case "timeScale":
				var p TimeScalePayload
				json.Unmarshal(msg.Payload, &p)
				if p.TimeScale > 0 {
					cmdCh <- command{kind: cmdTimeScale, timeScale: p.TimeScale}
				}
			case "reset":
				var p ResetCmdPayload
				json.Unmarshal(msg.Payload, &p)
				cmdCh <- command{kind: cmdReset, resetSP: p.Setpoint, resetIG: p.InitialGlucose}
				c.mu.Lock()
				c.viewOffset = 0
				c.mu.Unlock()
			case "config":
				var cfg simulation.SimConfig
				json.Unmarshal(msg.Payload, &cfg)
				cmdCh <- command{kind: cmdConfig, config: cfg}
			case "perturbation":
				var pe simulation.PerturbationEvent
				json.Unmarshal(msg.Payload, &pe)
				cmdCh <- command{kind: cmdPerturbation, perturbation: pe}
			case "setView":
				var p ViewPayload
				json.Unmarshal(msg.Payload, &p)
				c.mu.Lock()
				c.viewOffset = p.Offset
				c.mu.Unlock()
			}
		}
	}
}

// ── Main ──────────────────────────────────────────────────────
func main() {
	hub := newHub()
	sl := newSimLoop(hub)
	cmdCh := make(chan command, 256)

	go sl.run(cmdCh)
	go sl.startRenderTicker()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", wsHandler(hub, cmdCh))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		cfg := simulation.DefaultConfig()
		json.NewEncoder(w).Encode(cfg)
	})

	addr := ":8080"
	log.Printf("🩺 Backend con LTTB y Chart.js escuchando en %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
