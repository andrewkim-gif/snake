package game

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"

	"github.com/to-nexus/snake-server/internal/domain"
)

// AgentAPI provides HTTP endpoints for external agent control.
type AgentAPI struct {
	roomManager *RoomManager
}

// NewAgentAPI creates a new AgentAPI instance.
func NewAgentAPI(rm *RoomManager) *AgentAPI {
	return &AgentAPI{roomManager: rm}
}

// ─── Commander Mode ───

// CommandRequest is the JSON body for POST /api/agent/command.
type CommandRequest struct {
	AgentID string                 `json:"agentId"`
	RoomID  string                 `json:"roomId"`
	Command string                 `json:"command"`
	Params  map[string]interface{} `json:"params,omitempty"`
}

// CommandResponse is the JSON response for command execution.
type CommandResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

const (
	// Default command TTL in ticks (5 seconds at 20Hz)
	DefaultCommandTTL uint64 = 100
)

// HandleCommand processes POST /api/agent/command.
func (a *AgentAPI) HandleCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, CommandResponse{Error: "method not allowed"})
		return
	}

	var req CommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, CommandResponse{Error: "invalid JSON: " + err.Error()})
		return
	}

	if req.AgentID == "" || req.RoomID == "" || req.Command == "" {
		writeJSON(w, http.StatusBadRequest, CommandResponse{Error: "agentId, roomId, and command are required"})
		return
	}

	room := a.roomManager.GetRoom(req.RoomID)
	if room == nil {
		writeJSON(w, http.StatusNotFound, CommandResponse{Error: "room not found"})
		return
	}

	arena := room.GetArena()
	agent, ok := arena.GetAgent(req.AgentID)
	if !ok {
		writeJSON(w, http.StatusNotFound, CommandResponse{Error: "agent not found"})
		return
	}

	if !agent.Alive {
		writeJSON(w, http.StatusConflict, CommandResponse{Error: "agent is dead"})
		return
	}

	// Validate command
	if err := validateCommand(req.Command, req.Params); err != nil {
		writeJSON(w, http.StatusBadRequest, CommandResponse{Error: err.Error()})
		return
	}

	// Calculate TTL
	ttl := DefaultCommandTTL
	if rawTTL, ok := req.Params["ttl"]; ok {
		if ttlFloat, ok := rawTTL.(float64); ok && ttlFloat > 0 {
			ttl = uint64(ttlFloat * 20) // convert seconds to ticks
		}
	}

	// Set the AI override on the agent
	agent.AIOverride = &domain.AIOverride{
		Command:   req.Command,
		Params:    req.Params,
		ExpiresAt: arena.GetTick() + ttl,
	}

	// Handle immediate commands
	switch req.Command {
	case "choose_upgrade":
		choiceID, _ := req.Params["choiceId"].(string)
		if choiceID == "" {
			writeJSON(w, http.StatusBadRequest, CommandResponse{Error: "choiceId param required"})
			return
		}
		ok := arena.ChooseUpgrade(req.AgentID, choiceID)
		if !ok {
			writeJSON(w, http.StatusConflict, CommandResponse{Error: "upgrade choice failed"})
			return
		}
		agent.AIOverride = nil // one-shot command

	case "set_boost":
		enabled, _ := req.Params["enabled"].(bool)
		if enabled {
			agent.Boosting = true
		} else {
			agent.Boosting = false
		}
		agent.AIOverride = nil // one-shot command

	case "set_combat_style":
		style, _ := req.Params["style"].(string)
		if style != "aggressive" && style != "defensive" && style != "balanced" {
			writeJSON(w, http.StatusBadRequest, CommandResponse{Error: "style must be aggressive/defensive/balanced"})
			return
		}
		agent.AIOverride.CombatStyle = style
	}

	writeJSON(w, http.StatusOK, CommandResponse{
		OK:      true,
		Message: fmt.Sprintf("command '%s' applied to agent '%s'", req.Command, req.AgentID),
	})
}

// validateCommand checks if a command name is valid.
func validateCommand(cmd string, params map[string]interface{}) error {
	validCommands := map[string]bool{
		"go_to":           true,
		"go_center":       true,
		"flee":            true,
		"hunt_nearest":    true,
		"engage_weak":     true,
		"avoid_strong":    true,
		"farm_orbs":       true,
		"kite":            true,
		"camp_shrinkage":  true,
		"set_boost":       true,
		"choose_upgrade":  true,
		"set_combat_style": true,
	}

	if !validCommands[cmd] {
		return fmt.Errorf("unknown command: %s", cmd)
	}

	// Validate go_to params
	if cmd == "go_to" {
		if _, ok := params["x"]; !ok {
			return fmt.Errorf("go_to requires 'x' param")
		}
		if _, ok := params["y"]; !ok {
			return fmt.Errorf("go_to requires 'y' param")
		}
	}

	return nil
}

// ProcessAIOverride applies AI override commands during bot update.
// Returns a BotAction if the override produces one, or nil if default AI should run.
func ProcessAIOverride(agent *Agent, arena *Arena, tick uint64) *BotAction {
	if agent.AIOverride == nil {
		return nil
	}

	// Check TTL expiry
	if tick >= agent.AIOverride.ExpiresAt {
		agent.AIOverride = nil
		return nil
	}

	pos := agent.Position
	cfg := arena.Config

	switch agent.AIOverride.Command {
	case "go_to":
		x, _ := agent.AIOverride.Params["x"].(float64)
		y, _ := agent.AIOverride.Params["y"].(float64)
		angle := math.Atan2(y-pos.Y, x-pos.X)
		dist := distance(pos, domain.Position{X: x, Y: y})
		return &BotAction{
			TargetAngle: angle,
			Boost:       dist > 200 && agent.Mass > cfg.MinBoostMass,
		}

	case "go_center":
		angle := math.Atan2(-pos.Y, -pos.X)
		dist := distanceFromOrigin(pos)
		return &BotAction{
			TargetAngle: angle,
			Boost:       dist > 300 && agent.Mass > cfg.MinBoostMass,
		}

	case "flee":
		nearest := arena.FindNearbyAgent(agent.ID, pos, 400)
		if nearest != nil {
			fleeAngle := math.Atan2(pos.Y-nearest.Position.Y, pos.X-nearest.Position.X)
			return &BotAction{
				TargetAngle: fleeAngle,
				Boost:       agent.Mass > cfg.MinBoostMass,
			}
		}
		// No threat: go toward center
		return &BotAction{
			TargetAngle: math.Atan2(-pos.Y, -pos.X),
			Boost:       false,
		}

	case "hunt_nearest":
		nearest := arena.FindNearbyAgent(agent.ID, pos, 600)
		if nearest != nil {
			angle := math.Atan2(nearest.Position.Y-pos.Y, nearest.Position.X-pos.X)
			dist := distance(pos, nearest.Position)
			return &BotAction{
				TargetAngle: angle,
				Boost:       dist < 200 && agent.Mass > cfg.MinBoostMass,
			}
		}
		return nil // fall through to default AI

	case "engage_weak":
		agents := arena.GetAgents()
		var bestTarget *Agent
		bestDist := 600.0
		for _, other := range agents {
			if other.ID == agent.ID || !other.Alive {
				continue
			}
			if other.Mass >= agent.Mass {
				continue
			}
			d := distance(pos, other.Position)
			if d < bestDist {
				bestDist = d
				bestTarget = other
			}
		}
		if bestTarget != nil {
			angle := math.Atan2(bestTarget.Position.Y-pos.Y, bestTarget.Position.X-pos.X)
			return &BotAction{
				TargetAngle: angle,
				Boost:       bestDist < 150 && agent.Mass > cfg.MinBoostMass,
			}
		}
		return nil

	case "avoid_strong":
		agents := arena.GetAgents()
		var strongest *Agent
		strongDist := 400.0
		for _, other := range agents {
			if other.ID == agent.ID || !other.Alive {
				continue
			}
			if other.Mass <= agent.Mass {
				continue
			}
			d := distance(pos, other.Position)
			if d < strongDist {
				strongDist = d
				strongest = other
			}
		}
		if strongest != nil {
			fleeAngle := math.Atan2(pos.Y-strongest.Position.Y, pos.X-strongest.Position.X)
			return &BotAction{
				TargetAngle: fleeAngle,
				Boost:       strongDist < 150 && agent.Mass > cfg.MinBoostMass,
			}
		}
		return nil

	case "farm_orbs":
		nearestOrb := arena.FindNearestOrb(pos, 400)
		if nearestOrb != nil {
			angle := math.Atan2(nearestOrb.Y-pos.Y, nearestOrb.X-pos.X)
			return &BotAction{TargetAngle: angle, Boost: false}
		}
		return nil

	case "kite":
		nearest := arena.FindNearbyAgent(agent.ID, pos, 300)
		if nearest == nil {
			return nil
		}
		dist := distance(pos, nearest.Position)
		if dist < 80 {
			// Too close: flee
			fleeAngle := math.Atan2(pos.Y-nearest.Position.Y, pos.X-nearest.Position.X)
			return &BotAction{TargetAngle: fleeAngle, Boost: true}
		}
		// Approach to aura range
		angle := math.Atan2(nearest.Position.Y-pos.Y, nearest.Position.X-pos.X)
		return &BotAction{TargetAngle: angle, Boost: false}

	case "camp_shrinkage":
		currentRadius := arena.GetCurrentRadius()
		// Position at 85% of shrink edge
		targetDist := currentRadius * 0.85
		currentDist := distanceFromOrigin(pos)
		if currentDist < targetDist-50 {
			// Move outward
			outAngle := math.Atan2(pos.Y, pos.X)
			return &BotAction{TargetAngle: outAngle, Boost: false}
		}
		if currentDist > targetDist+50 {
			// Move inward
			inAngle := math.Atan2(-pos.Y, -pos.X)
			return &BotAction{TargetAngle: inAngle, Boost: false}
		}
		// Patrol along the edge
		tangent := math.Atan2(pos.Y, pos.X) + math.Pi/2
		return &BotAction{TargetAngle: tangent, Boost: false}
	}

	return nil
}

// ─── Observe Game ───

// ObserveResponse is the enriched game state for agent observation.
type ObserveResponse struct {
	// Standard state
	Agents []ObserveAgent `json:"agents"`
	Orbs   int            `json:"orbCount"`

	// Agent's own info
	Self *ObserveSelf `json:"self,omitempty"`

	// Arena info
	ArenaRadius float64 `json:"arenaRadius"`
	Zone        string  `json:"zone"` // center/mid/edge/danger
	Tick        uint64  `json:"tick"`

	// Nearby threats
	NearbyThreats []NearbyThreat `json:"nearbyThreats"`

	// Nearby map objects
	NearbyMapObjects []NearbyMapObject `json:"nearbyMapObjects"`

	// Pending upgrade choices (if level-up active)
	PendingChoices []domain.UpgradeChoice `json:"pendingChoices,omitempty"`
}

// ObserveAgent is a simplified agent representation for observation.
type ObserveAgent struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Mass     float64 `json:"mass"`
	Level    int     `json:"level"`
	Alive    bool    `json:"alive"`
	Boosting bool    `json:"boosting"`
	IsBot    bool    `json:"isBot"`
}

// ObserveSelf contains the observing agent's detailed info.
type ObserveSelf struct {
	ID              string             `json:"id"`
	Level           int                `json:"level"`
	XP              int                `json:"xp"`
	XPToNext        int                `json:"xpToNext"`
	Mass            float64            `json:"mass"`
	Alive           bool               `json:"alive"`
	Build           domain.PlayerBuild `json:"build"`
	ActiveSynergies []string           `json:"activeSynergies"`
	Kills           int                `json:"kills"`
	Score           int                `json:"score"`
	KillStreak      int                `json:"killStreak"`
}

// NearbyThreat represents a nearby agent that could be a threat.
type NearbyThreat struct {
	ID       string  `json:"id"`
	Mass     float64 `json:"mass"`
	Distance float64 `json:"distance"`
	Level    int     `json:"level"`
}

// NearbyMapObject represents a map object near the agent.
type NearbyMapObject struct {
	Type     string  `json:"type"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Distance float64 `json:"distance"`
	Active   bool    `json:"active"`
}

// HandleObserve processes GET /api/agent/observe?agentId=X&roomId=Y.
func (a *AgentAPI) HandleObserve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, CommandResponse{Error: "method not allowed"})
		return
	}

	agentID := r.URL.Query().Get("agentId")
	roomID := r.URL.Query().Get("roomId")

	if agentID == "" || roomID == "" {
		writeJSON(w, http.StatusBadRequest, CommandResponse{Error: "agentId and roomId query params required"})
		return
	}

	room := a.roomManager.GetRoom(roomID)
	if room == nil {
		writeJSON(w, http.StatusNotFound, CommandResponse{Error: "room not found"})
		return
	}

	arena := room.GetArena()
	self, hasSelf := arena.GetAgent(agentID)

	resp := ObserveResponse{
		Agents:           make([]ObserveAgent, 0, len(arena.GetAgents())),
		Orbs:             arena.GetOrbCount(),
		ArenaRadius:      arena.GetCurrentRadius(),
		Tick:             arena.GetTick(),
		NearbyThreats:    make([]NearbyThreat, 0, 10),
		NearbyMapObjects: make([]NearbyMapObject, 0, 10),
	}

	// Build agent list
	for _, ag := range arena.GetAgents() {
		resp.Agents = append(resp.Agents, ObserveAgent{
			ID:       ag.ID,
			Name:     ag.Name,
			X:        ag.Position.X,
			Y:        ag.Position.Y,
			Mass:     ag.Mass,
			Level:    ag.Level,
			Alive:    ag.Alive,
			Boosting: ag.Boosting,
			IsBot:    ag.IsBot,
		})
	}

	if hasSelf {
		// Self info
		resp.Self = &ObserveSelf{
			ID:              self.ID,
			Level:           self.Level,
			XP:              self.XP,
			XPToNext:        self.XPToNext,
			Mass:            self.Mass,
			Alive:           self.Alive,
			Build:           self.Build,
			ActiveSynergies: self.ActiveSynergies,
			Kills:           self.Kills,
			Score:           self.Score,
			KillStreak:      self.KillStreak,
		}

		// Zone calculation
		selfDist := distanceFromOrigin(self.Position)
		ratio := selfDist / arena.GetCurrentRadius()
		switch {
		case ratio < 0.3:
			resp.Zone = "center"
		case ratio < 0.6:
			resp.Zone = "mid"
		case ratio < 0.85:
			resp.Zone = "edge"
		default:
			resp.Zone = "danger"
		}

		// Nearby threats (within 200px)
		for _, ag := range arena.GetAgents() {
			if ag.ID == agentID || !ag.Alive {
				continue
			}
			d := distance(self.Position, ag.Position)
			if d <= 200 {
				resp.NearbyThreats = append(resp.NearbyThreats, NearbyThreat{
					ID:       ag.ID,
					Mass:     ag.Mass,
					Distance: math.Round(d*10) / 10,
					Level:    ag.Level,
				})
			}
		}

		// Nearby map objects (within 300px)
		for _, mo := range arena.GetMapObjectStates() {
			moPos := domain.Position{X: mo.X, Y: mo.Y}
			d := distance(self.Position, moPos)
			if d <= 300 {
				resp.NearbyMapObjects = append(resp.NearbyMapObjects, NearbyMapObject{
					Type:     string(mo.Type),
					X:        mo.X,
					Y:        mo.Y,
					Distance: math.Round(d*10) / 10,
					Active:   mo.Active,
				})
			}
		}

		// Pending choices
		if self.PendingChoices != nil {
			resp.PendingChoices = self.PendingChoices
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// ─── JSON helpers ───

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
