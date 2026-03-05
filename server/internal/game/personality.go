package game

import (
	"encoding/json"
	"net/http"
	"sync"
)

// ─── Personality Presets ───

// PersonalityWeights defines behavior weights for a personality.
type PersonalityWeights struct {
	Hunt   float64 `json:"hunt"`
	Flee   float64 `json:"flee"`
	Gather float64 `json:"gather"`
	Wander float64 `json:"wander"`
}

// PersonalityPreset defines a personality type with its weights.
type PersonalityPreset struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Weights     PersonalityWeights `json:"weights"`
}

// AllPersonalities defines the 6 personality presets.
var AllPersonalities = []PersonalityPreset{
	{
		ID:          "aggressive",
		Name:        "Aggressive",
		Description: "Seeks combat at every opportunity",
		Weights:     PersonalityWeights{Hunt: 0.6, Flee: 0.1, Gather: 0.2, Wander: 0.1},
	},
	{
		ID:          "defensive",
		Name:        "Defensive",
		Description: "Avoids fights, focuses on survival",
		Weights:     PersonalityWeights{Hunt: 0.1, Flee: 0.4, Gather: 0.3, Wander: 0.2},
	},
	{
		ID:          "opportunist",
		Name:        "Opportunist",
		Description: "Strikes only when advantage is clear",
		Weights:     PersonalityWeights{Hunt: 0.3, Flee: 0.2, Gather: 0.4, Wander: 0.1},
	},
	{
		ID:          "explorer",
		Name:        "Explorer",
		Description: "Wanders the map seeking opportunities",
		Weights:     PersonalityWeights{Hunt: 0.1, Flee: 0.2, Gather: 0.2, Wander: 0.5},
	},
	{
		ID:          "builder",
		Name:        "Builder",
		Description: "Prioritizes gathering resources and leveling",
		Weights:     PersonalityWeights{Hunt: 0.1, Flee: 0.3, Gather: 0.5, Wander: 0.1},
	},
	{
		ID:          "berserker",
		Name:        "Berserker",
		Description: "All-out aggression, never retreats",
		Weights:     PersonalityWeights{Hunt: 0.8, Flee: 0.05, Gather: 0.1, Wander: 0.05},
	},
}

// GetPersonalityByID returns a personality preset by ID, or nil.
func GetPersonalityByID(id string) *PersonalityPreset {
	for _, p := range AllPersonalities {
		if p.ID == id {
			return &p
		}
	}
	return nil
}

// ─── Personality Store (per agent) ───

// PersonalityStore maps agent names to personality IDs.
type PersonalityStore struct {
	data map[string]string // name -> personality ID
	mu   sync.RWMutex
}

// NewPersonalityStore creates a new PersonalityStore.
func NewPersonalityStore() *PersonalityStore {
	return &PersonalityStore{
		data: make(map[string]string),
	}
}

// Get returns the personality ID for an agent. Default is "balanced" (opportunist).
func (ps *PersonalityStore) Get(name string) string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if id, ok := ps.data[name]; ok {
		return id
	}
	return "opportunist"
}

// Set assigns a personality to an agent.
func (ps *PersonalityStore) Set(name, personalityID string) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.data[name] = personalityID
}

// ─── HTTP Handlers (on MetaAPI) ───

// HandleGetPersonalities handles GET /api/meta/personalities.
func (m *MetaAPI) HandleGetPersonalities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, AllPersonalities)
}

// HandleSetPersonality handles PUT /api/agent/personality.
func (m *MetaAPI) HandleSetPersonality(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Personality string `json:"personality"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.Name == "" || req.Personality == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and personality required"})
		return
	}

	if GetPersonalityByID(req.Personality) == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown personality: " + req.Personality})
		return
	}

	if m.personalityStore != nil {
		m.personalityStore.Set(req.Name, req.Personality)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "personality": req.Personality})
}
