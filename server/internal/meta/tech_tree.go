package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
)

// TechBranch represents one of the three research branches.
type TechBranch string

const (
	BranchMilitary   TechBranch = "military"
	BranchEconomic   TechBranch = "economic"
	BranchDiplomatic TechBranch = "diplomatic"
)

// AllBranches lists every tech branch for iteration.
var AllBranches = []TechBranch{BranchMilitary, BranchEconomic, BranchDiplomatic}

// TechNodeDef defines a single node in the tech tree (static definition).
type TechNodeDef struct {
	ID          string     `json:"id"`
	Branch      TechBranch `json:"branch"`
	Level       int        `json:"level"` // 1-4
	Name        string     `json:"name"`
	Description string     `json:"description"`
	TechCost    int64      `json:"tech_cost"` // Total Tech resource needed
	Prereq      string     `json:"prereq"`    // ID of prerequisite node (empty for Lv.1)
}

// TechBonus describes the effect of completing a research node.
type TechBonus struct {
	NodeID      string  `json:"node_id"`
	BonusType   string  `json:"bonus_type"`   // "dps_mult", "synergy_mult", "siege_mult", etc.
	BonusValue  float64 `json:"bonus_value"`  // e.g. 0.05 = +5%
	Description string  `json:"description"`
}

// DefaultTechTree returns the full 12-node tech tree (3 branches x 4 levels).
func DefaultTechTree() []TechNodeDef {
	return []TechNodeDef{
		// Military Path
		{ID: "mil_1", Branch: BranchMilitary, Level: 1, Name: "Enhanced Weapons", Description: "Agent DPS +5%", TechCost: 100, Prereq: ""},
		{ID: "mil_2", Branch: BranchMilitary, Level: 2, Name: "Tactical Formations", Description: "Team synergy bonus +10%", TechCost: 300, Prereq: "mil_1"},
		{ID: "mil_3", Branch: BranchMilitary, Level: 3, Name: "Siege Engines", Description: "Siege attack bonus +20%", TechCost: 700, Prereq: "mil_2"},
		{ID: "mil_4", Branch: BranchMilitary, Level: 4, Name: "Nuclear Option", Description: "Capital siege special weapon", TechCost: 2000, Prereq: "mil_3"},

		// Economic Path
		{ID: "eco_1", Branch: BranchEconomic, Level: 1, Name: "Trade Networks", Description: "Trade fee -25%", TechCost: 100, Prereq: ""},
		{ID: "eco_2", Branch: BranchEconomic, Level: 2, Name: "Industrial Revolution", Description: "Resource production +15%", TechCost: 300, Prereq: "eco_1"},
		{ID: "eco_3", Branch: BranchEconomic, Level: 3, Name: "Global Markets", Description: "All resource types tradeable", TechCost: 700, Prereq: "eco_2"},
		{ID: "eco_4", Branch: BranchEconomic, Level: 4, Name: "Economic Hegemony", Description: "GDP x2", TechCost: 2000, Prereq: "eco_3"},

		// Diplomatic Path
		{ID: "dip_1", Branch: BranchDiplomatic, Level: 1, Name: "Spy Network", Description: "Intel success +20%", TechCost: 100, Prereq: ""},
		{ID: "dip_2", Branch: BranchDiplomatic, Level: 2, Name: "Cultural Influence", Description: "Influence production +30%", TechCost: 300, Prereq: "dip_1"},
		{ID: "dip_3", Branch: BranchDiplomatic, Level: 3, Name: "Peacekeeping Force", Description: "Alliance defense +25%", TechCost: 700, Prereq: "dip_2"},
		{ID: "dip_4", Branch: BranchDiplomatic, Level: 4, Name: "World Government", Description: "UN resolutions auto-pass", TechCost: 2000, Prereq: "dip_3"},
	}
}

// DefaultTechBonuses returns the bonus effects for each completed node.
func DefaultTechBonuses() map[string]TechBonus {
	return map[string]TechBonus{
		"mil_1": {NodeID: "mil_1", BonusType: "agent_dps_mult", BonusValue: 0.05, Description: "Agent DPS +5%"},
		"mil_2": {NodeID: "mil_2", BonusType: "synergy_mult", BonusValue: 0.10, Description: "Team synergy +10%"},
		"mil_3": {NodeID: "mil_3", BonusType: "siege_attack_mult", BonusValue: 0.20, Description: "Siege attack +20%"},
		"mil_4": {NodeID: "mil_4", BonusType: "nuclear_weapon", BonusValue: 1.0, Description: "Nuclear weapon unlocked"},
		"eco_1": {NodeID: "eco_1", BonusType: "trade_fee_reduction", BonusValue: 0.25, Description: "Trade fee -25%"},
		"eco_2": {NodeID: "eco_2", BonusType: "resource_production_mult", BonusValue: 0.15, Description: "Resource production +15%"},
		"eco_3": {NodeID: "eco_3", BonusType: "global_trade_unlock", BonusValue: 1.0, Description: "All resources tradeable"},
		"eco_4": {NodeID: "eco_4", BonusType: "gdp_mult", BonusValue: 2.0, Description: "GDP x2"},
		"dip_1": {NodeID: "dip_1", BonusType: "intel_success_mult", BonusValue: 0.20, Description: "Intel success +20%"},
		"dip_2": {NodeID: "dip_2", BonusType: "influence_production_mult", BonusValue: 0.30, Description: "Influence +30%"},
		"dip_3": {NodeID: "dip_3", BonusType: "alliance_defense_mult", BonusValue: 0.25, Description: "Alliance defense +25%"},
		"dip_4": {NodeID: "dip_4", BonusType: "un_auto_pass", BonusValue: 1.0, Description: "UN auto-pass"},
	}
}

// FactionResearch tracks a faction's research state for all nodes.
type FactionResearch struct {
	FactionID     string                    `json:"faction_id"`
	NodeProgress  map[string]*ResearchNode  `json:"node_progress"` // nodeID → progress
	CompletedIDs  []string                  `json:"completed_ids"` // list of completed node IDs
	ActiveBonuses map[string]TechBonus      `json:"active_bonuses"`
}

// ResearchNode tracks investment progress for a single tech node.
type ResearchNode struct {
	NodeID       string    `json:"node_id"`
	TechInvested int64     `json:"tech_invested"`
	TechRequired int64     `json:"tech_required"`
	IsCompleted  bool      `json:"is_completed"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
	StartedAt    time.Time `json:"started_at,omitempty"`
}

// Progress returns 0.0~1.0 progress ratio.
func (rn *ResearchNode) Progress() float64 {
	if rn.TechRequired <= 0 {
		return 1.0
	}
	p := float64(rn.TechInvested) / float64(rn.TechRequired)
	if p > 1.0 {
		return 1.0
	}
	return p
}

// TechTreeManager manages tech research for all factions.
type TechTreeManager struct {
	mu sync.RWMutex

	nodeDefs map[string]TechNodeDef        // nodeID → definition (static)
	bonuses  map[string]TechBonus           // nodeID → bonus (static)
	research map[string]*FactionResearch    // factionID → research state

	// External references
	factionManager *FactionManager

	// v18: EventLog callback for live news feed
	OnTechCompleted func(factionName, techName, nodeID string)
}

// NewTechTreeManager creates a new tech tree manager.
func NewTechTreeManager() *TechTreeManager {
	defs := DefaultTechTree()
	defMap := make(map[string]TechNodeDef, len(defs))
	for _, d := range defs {
		defMap[d.ID] = d
	}

	return &TechTreeManager{
		nodeDefs: defMap,
		bonuses:  DefaultTechBonuses(),
		research: make(map[string]*FactionResearch),
	}
}

// SetFactionManager sets the faction manager reference.
func (ttm *TechTreeManager) SetFactionManager(fm *FactionManager) {
	ttm.mu.Lock()
	defer ttm.mu.Unlock()
	ttm.factionManager = fm
}

// GetNodeDefs returns all tech node definitions (for UI rendering).
func (ttm *TechTreeManager) GetNodeDefs() []TechNodeDef {
	return DefaultTechTree()
}

// GetFactionResearch returns the research state for a faction.
func (ttm *TechTreeManager) GetFactionResearch(factionID string) *FactionResearch {
	ttm.mu.RLock()
	defer ttm.mu.RUnlock()

	fr, ok := ttm.research[factionID]
	if !ok {
		return &FactionResearch{
			FactionID:     factionID,
			NodeProgress:  make(map[string]*ResearchNode),
			CompletedIDs:  []string{},
			ActiveBonuses: make(map[string]TechBonus),
		}
	}

	// Return a copy
	copy := *fr
	return &copy
}

// ensureFactionResearch initializes research state for a faction if needed.
// Must be called with write lock held.
func (ttm *TechTreeManager) ensureFactionResearch(factionID string) *FactionResearch {
	fr, ok := ttm.research[factionID]
	if !ok {
		fr = &FactionResearch{
			FactionID:     factionID,
			NodeProgress:  make(map[string]*ResearchNode),
			CompletedIDs:  []string{},
			ActiveBonuses: make(map[string]TechBonus),
		}
		ttm.research[factionID] = fr
	}
	return fr
}

// InvestTech invests Tech resources into a research node.
// Returns the new progress ratio and whether the node just completed.
func (ttm *TechTreeManager) InvestTech(factionID, nodeID string, techAmount int64) (progress float64, justCompleted bool, err error) {
	ttm.mu.Lock()
	defer ttm.mu.Unlock()

	// Validate node exists
	def, ok := ttm.nodeDefs[nodeID]
	if !ok {
		return 0, false, fmt.Errorf("unknown tech node: %s", nodeID)
	}

	fr := ttm.ensureFactionResearch(factionID)

	// Check if already completed
	for _, cid := range fr.CompletedIDs {
		if cid == nodeID {
			return 1.0, false, fmt.Errorf("node %s already completed", nodeID)
		}
	}

	// Check prerequisite
	if def.Prereq != "" {
		prereqDone := false
		for _, cid := range fr.CompletedIDs {
			if cid == def.Prereq {
				prereqDone = true
				break
			}
		}
		if !prereqDone {
			return 0, false, fmt.Errorf("prerequisite %s not completed", def.Prereq)
		}
	}

	// Deduct Tech from faction treasury
	if ttm.factionManager != nil {
		err := ttm.factionManager.WithdrawFromTreasury(factionID, ResourceBundle{Tech: techAmount})
		if err != nil {
			return 0, false, fmt.Errorf("insufficient tech resources: %w", err)
		}
	}

	// Get or create node progress
	node, ok := fr.NodeProgress[nodeID]
	if !ok {
		node = &ResearchNode{
			NodeID:       nodeID,
			TechRequired: def.TechCost,
			StartedAt:    time.Now(),
		}
		fr.NodeProgress[nodeID] = node
	}

	// Apply investment
	node.TechInvested += techAmount

	// Check completion
	if node.TechInvested >= node.TechRequired && !node.IsCompleted {
		node.IsCompleted = true
		node.CompletedAt = time.Now()
		fr.CompletedIDs = append(fr.CompletedIDs, nodeID)

		// Apply bonus
		if bonus, ok := ttm.bonuses[nodeID]; ok {
			fr.ActiveBonuses[nodeID] = bonus
		}

		slog.Info("tech research completed",
			"faction", factionID,
			"node", nodeID,
			"name", def.Name,
		)

		// v18: Notify EventLog for live news feed
		if ttm.OnTechCompleted != nil {
			go ttm.OnTechCompleted(factionID, def.Name, nodeID)
		}

		return 1.0, true, nil
	}

	return node.Progress(), false, nil
}

// GetFactionBonus returns a specific bonus value if the faction has it.
// Returns 0 if the bonus is not active.
func (ttm *TechTreeManager) GetFactionBonus(factionID, bonusType string) float64 {
	ttm.mu.RLock()
	defer ttm.mu.RUnlock()

	fr, ok := ttm.research[factionID]
	if !ok {
		return 0
	}

	for _, bonus := range fr.ActiveBonuses {
		if bonus.BonusType == bonusType {
			return bonus.BonusValue
		}
	}
	return 0
}

// HasBonus returns true if the faction has the specified bonus type active.
func (ttm *TechTreeManager) HasBonus(factionID, bonusType string) bool {
	return ttm.GetFactionBonus(factionID, bonusType) > 0
}

// GetAllActiveBonuses returns all active bonuses for a faction.
func (ttm *TechTreeManager) GetAllActiveBonuses(factionID string) []TechBonus {
	ttm.mu.RLock()
	defer ttm.mu.RUnlock()

	fr, ok := ttm.research[factionID]
	if !ok {
		return nil
	}

	result := make([]TechBonus, 0, len(fr.ActiveBonuses))
	for _, b := range fr.ActiveBonuses {
		result = append(result, b)
	}
	return result
}

// ResetFactionResearch clears all research progress for a faction (used during season reset).
func (ttm *TechTreeManager) ResetFactionResearch(factionID string) {
	ttm.mu.Lock()
	defer ttm.mu.Unlock()
	delete(ttm.research, factionID)
	slog.Info("faction research reset", "faction", factionID)
}

// --- HTTP API ---

// TechTreeRoutes returns a chi.Router with tech tree endpoints.
func (ttm *TechTreeManager) TechTreeRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()

	// Public: get tech tree definitions
	r.Get("/nodes", ttm.handleGetNodes)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/research/{factionID}", ttm.handleGetResearch)
		r.Post("/invest", ttm.handleInvest(fm))
	})

	return r
}

// handleGetNodes returns all tech node definitions.
func (ttm *TechTreeManager) handleGetNodes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"nodes":    ttm.GetNodeDefs(),
		"branches": AllBranches,
	})
}

// handleGetResearch returns research state for a faction.
func (ttm *TechTreeManager) handleGetResearch(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	research := ttm.GetFactionResearch(factionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"research": research,
	})
}

// InvestRequest is the HTTP request body for tech investment.
type InvestRequest struct {
	NodeID string `json:"node_id"`
	Amount int64  `json:"amount"`
}

func (ttm *TechTreeManager) handleInvest(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		// Need Council+ to invest in tech
		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req InvestRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if req.Amount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "amount must be positive"})
			return
		}

		progress, completed, err := ttm.InvestTech(factionID, req.NodeID, req.Amount)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"node_id":        req.NodeID,
			"progress":       progress,
			"just_completed": completed,
			"research":       ttm.GetFactionResearch(factionID),
		})
	}
}
