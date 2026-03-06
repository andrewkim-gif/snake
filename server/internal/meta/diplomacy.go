package meta

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// DiplomacyType defines the types of diplomatic relations.
type DiplomacyType string

const (
	DiplomacyNonAggression  DiplomacyType = "non_aggression"
	DiplomacyTradeAgreement DiplomacyType = "trade_agreement"
	DiplomacyAlliance       DiplomacyType = "military_alliance"
	DiplomacySanction       DiplomacyType = "economic_sanction"
	DiplomacyTribute        DiplomacyType = "tribute"
)

// DiplomacyStatus represents the state of a diplomatic relation.
type DiplomacyStatus string

const (
	StatusProposed DiplomacyStatus = "proposed"
	StatusActive   DiplomacyStatus = "active"
	StatusExpired  DiplomacyStatus = "expired"
	StatusBroken   DiplomacyStatus = "broken"
)

// Treaty represents a diplomatic agreement between two factions.
type Treaty struct {
	ID         string          `json:"id"`
	Type       DiplomacyType   `json:"type"`
	FactionA   string          `json:"faction_a"`  // Proposer
	FactionB   string          `json:"faction_b"`  // Receiver
	Status     DiplomacyStatus `json:"status"`
	ProposedBy string          `json:"proposed_by"` // User ID
	Terms      map[string]interface{} `json:"terms,omitempty"`
	StartedAt  time.Time       `json:"started_at,omitempty"`
	ExpiresAt  time.Time       `json:"expires_at,omitempty"`
	BrokenAt   time.Time       `json:"broken_at,omitempty"`
	BrokenBy   string          `json:"broken_by,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

// War represents a formal war between two factions.
type War struct {
	ID          string    `json:"id"`
	AttackerID  string    `json:"attacker_id"`
	DefenderID  string    `json:"defender_id"`
	Status      string    `json:"status"` // "preparing", "active", "ended"
	DeclaredAt  time.Time `json:"declared_at"`
	PrepEndsAt  time.Time `json:"prep_ends_at"` // 48h after declaration
	EndedAt     time.Time `json:"ended_at,omitempty"`
	Terms       map[string]interface{} `json:"terms,omitempty"`
}

// DiplomacyConfig holds diplomacy system settings.
type DiplomacyConfig struct {
	TreatyDefaultDuration time.Duration // Default treaty duration (7 days)
	WarPrepDuration       time.Duration // War preparation time (48 hours)
	WarDeclareCostOil     int64         // Oil cost to declare war
	WarDeclareCostInfluence int64       // Influence cost to declare war
}

// DefaultDiplomacyConfig returns default diplomacy configuration.
func DefaultDiplomacyConfig() DiplomacyConfig {
	return DiplomacyConfig{
		TreatyDefaultDuration:  7 * 24 * time.Hour,
		WarPrepDuration:        48 * time.Hour,
		WarDeclareCostOil:      500,
		WarDeclareCostInfluence: 300,
	}
}

// DiplomacyEngine manages inter-faction relations: treaties, wars, sanctions.
type DiplomacyEngine struct {
	mu sync.RWMutex

	config   DiplomacyConfig
	treaties map[string]*Treaty // treatyID → Treaty
	wars     map[string]*War    // warID → War

	// Relationship index: "factionA:factionB" → list of active treaty IDs
	relations map[string][]string
}

// NewDiplomacyEngine creates a new diplomacy engine.
func NewDiplomacyEngine(cfg DiplomacyConfig) *DiplomacyEngine {
	return &DiplomacyEngine{
		config:    cfg,
		treaties:  make(map[string]*Treaty),
		wars:      make(map[string]*War),
		relations: make(map[string][]string),
	}
}

// ProposeTreaty creates a new treaty proposal.
func (de *DiplomacyEngine) ProposeTreaty(id string, treatyType DiplomacyType, factionA, factionB, proposedBy string) (*Treaty, error) {
	de.mu.Lock()
	defer de.mu.Unlock()

	if factionA == factionB {
		return nil, fmt.Errorf("cannot create treaty with yourself")
	}

	treaty := &Treaty{
		ID:         id,
		Type:       treatyType,
		FactionA:   factionA,
		FactionB:   factionB,
		Status:     StatusProposed,
		ProposedBy: proposedBy,
		CreatedAt:  time.Now(),
	}

	de.treaties[id] = treaty

	slog.Info("treaty proposed",
		"id", id,
		"type", treatyType,
		"from", factionA,
		"to", factionB,
	)

	return treaty, nil
}

// AcceptTreaty activates a proposed treaty.
func (de *DiplomacyEngine) AcceptTreaty(treatyID string) error {
	de.mu.Lock()
	defer de.mu.Unlock()

	treaty, ok := de.treaties[treatyID]
	if !ok {
		return fmt.Errorf("treaty %s not found", treatyID)
	}
	if treaty.Status != StatusProposed {
		return fmt.Errorf("treaty %s is not in proposed state", treatyID)
	}

	treaty.Status = StatusActive
	treaty.StartedAt = time.Now()
	treaty.ExpiresAt = time.Now().Add(de.config.TreatyDefaultDuration)

	// Index the relation
	key := de.relationKey(treaty.FactionA, treaty.FactionB)
	de.relations[key] = append(de.relations[key], treatyID)

	slog.Info("treaty accepted", "id", treatyID, "type", treaty.Type)

	return nil
}

// BreakTreaty breaks an active treaty (with diplomatic consequences).
func (de *DiplomacyEngine) BreakTreaty(treatyID, brokenBy string) error {
	de.mu.Lock()
	defer de.mu.Unlock()

	treaty, ok := de.treaties[treatyID]
	if !ok {
		return fmt.Errorf("treaty %s not found", treatyID)
	}
	if treaty.Status != StatusActive {
		return fmt.Errorf("treaty %s is not active", treatyID)
	}

	treaty.Status = StatusBroken
	treaty.BrokenAt = time.Now()
	treaty.BrokenBy = brokenBy

	slog.Info("treaty broken", "id", treatyID, "by", brokenBy)

	return nil
}

// DeclareWar creates a war declaration between two factions.
func (de *DiplomacyEngine) DeclareWar(id, attackerID, defenderID string) (*War, error) {
	de.mu.Lock()
	defer de.mu.Unlock()

	if attackerID == defenderID {
		return nil, fmt.Errorf("cannot declare war on yourself")
	}

	// Check for existing active war
	for _, w := range de.wars {
		if w.Status == "active" || w.Status == "preparing" {
			if (w.AttackerID == attackerID && w.DefenderID == defenderID) ||
				(w.AttackerID == defenderID && w.DefenderID == attackerID) {
				return nil, fmt.Errorf("war already exists between these factions")
			}
		}
	}

	// Check for non-aggression pact
	key := de.relationKey(attackerID, defenderID)
	for _, tid := range de.relations[key] {
		if t, ok := de.treaties[tid]; ok {
			if t.Status == StatusActive && t.Type == DiplomacyNonAggression {
				return nil, fmt.Errorf("non-aggression pact prevents war declaration")
			}
		}
	}

	war := &War{
		ID:         id,
		AttackerID: attackerID,
		DefenderID: defenderID,
		Status:     "preparing",
		DeclaredAt: time.Now(),
		PrepEndsAt: time.Now().Add(de.config.WarPrepDuration),
	}

	de.wars[id] = war

	slog.Info("war declared",
		"id", id,
		"attacker", attackerID,
		"defender", defenderID,
		"prepEnds", war.PrepEndsAt,
	)

	return war, nil
}

// GetWar returns a war by ID.
func (de *DiplomacyEngine) GetWar(id string) *War {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.wars[id]
}

// GetActiveTreaties returns all active treaties for a faction.
func (de *DiplomacyEngine) GetActiveTreaties(factionID string) []*Treaty {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var result []*Treaty
	for _, treaty := range de.treaties {
		if treaty.Status != StatusActive {
			continue
		}
		if treaty.FactionA == factionID || treaty.FactionB == factionID {
			result = append(result, treaty)
		}
	}
	return result
}

// GetActiveWars returns all active wars involving a faction.
func (de *DiplomacyEngine) GetActiveWars(factionID string) []*War {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var result []*War
	for _, war := range de.wars {
		if war.Status != "active" && war.Status != "preparing" {
			continue
		}
		if war.AttackerID == factionID || war.DefenderID == factionID {
			result = append(result, war)
		}
	}
	return result
}

// AreAllied returns true if two factions have a military alliance.
func (de *DiplomacyEngine) AreAllied(factionA, factionB string) bool {
	de.mu.RLock()
	defer de.mu.RUnlock()

	key := de.relationKey(factionA, factionB)
	for _, tid := range de.relations[key] {
		if t, ok := de.treaties[tid]; ok {
			if t.Status == StatusActive && t.Type == DiplomacyAlliance {
				return true
			}
		}
	}
	return false
}

// AreAtWar returns true if two factions are at war.
func (de *DiplomacyEngine) AreAtWar(factionA, factionB string) bool {
	de.mu.RLock()
	defer de.mu.RUnlock()

	for _, war := range de.wars {
		if war.Status != "active" {
			continue
		}
		if (war.AttackerID == factionA && war.DefenderID == factionB) ||
			(war.AttackerID == factionB && war.DefenderID == factionA) {
			return true
		}
	}
	return false
}

// ExpireOldTreaties checks and expires treaties past their expiration date.
func (de *DiplomacyEngine) ExpireOldTreaties() int {
	de.mu.Lock()
	defer de.mu.Unlock()

	now := time.Now()
	count := 0

	for _, treaty := range de.treaties {
		if treaty.Status == StatusActive && !treaty.ExpiresAt.IsZero() && now.After(treaty.ExpiresAt) {
			treaty.Status = StatusExpired
			count++
			slog.Info("treaty expired", "id", treaty.ID, "type", treaty.Type)
		}
	}

	return count
}

// relationKey creates a canonical key for a faction pair (order-independent).
func (de *DiplomacyEngine) relationKey(a, b string) string {
	if a < b {
		return a + ":" + b
	}
	return b + ":" + a
}
