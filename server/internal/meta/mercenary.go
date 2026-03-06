package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// MercenaryTier defines the quality tiers of mercenaries.
type MercenaryTier string

const (
	MercTierBronze    MercenaryTier = "bronze"
	MercTierSilver    MercenaryTier = "silver"
	MercTierGold      MercenaryTier = "gold"
	MercTierLegendary MercenaryTier = "legendary"
)

// AllMercenaryTiers lists every tier in ascending order.
var AllMercenaryTiers = []MercenaryTier{MercTierBronze, MercTierSilver, MercTierGold, MercTierLegendary}

// MercenaryTierConfig defines tier-specific properties.
type MercenaryTierConfig struct {
	Tier         MercenaryTier `json:"tier"`
	HireCost     int64         `json:"hire_cost"`    // Gold
	ContractHours int          `json:"contract_hours"` // Duration before expiry
	DPSRange     [2]float64    `json:"dps_range"`     // min-max DPS
	HPRange      [2]float64    `json:"hp_range"`      // min-max HP
	LevelRange   [2]int        `json:"level_range"`   // min-max level
	SpawnWeight  float64       `json:"spawn_weight"`  // Rarity: higher = more common
}

// DefaultTierConfigs returns the mercenary tier configurations.
func DefaultTierConfigs() map[MercenaryTier]MercenaryTierConfig {
	return map[MercenaryTier]MercenaryTierConfig{
		MercTierBronze: {
			Tier: MercTierBronze, HireCost: 50, ContractHours: 24,
			DPSRange: [2]float64{8, 15}, HPRange: [2]float64{80, 120},
			LevelRange: [2]int{1, 5}, SpawnWeight: 0.50,
		},
		MercTierSilver: {
			Tier: MercTierSilver, HireCost: 150, ContractHours: 24,
			DPSRange: [2]float64{15, 25}, HPRange: [2]float64{120, 180},
			LevelRange: [2]int{5, 10}, SpawnWeight: 0.30,
		},
		MercTierGold: {
			Tier: MercTierGold, HireCost: 500, ContractHours: 24,
			DPSRange: [2]float64{25, 40}, HPRange: [2]float64{180, 280},
			LevelRange: [2]int{10, 15}, SpawnWeight: 0.15,
		},
		MercTierLegendary: {
			Tier: MercTierLegendary, HireCost: 2000, ContractHours: 24,
			DPSRange: [2]float64{40, 60}, HPRange: [2]float64{280, 400},
			LevelRange: [2]int{15, 20}, SpawnWeight: 0.05,
		},
	}
}

// Mercenary represents an NPC agent for hire.
type Mercenary struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Tier        MercenaryTier `json:"tier"`
	DPS         float64       `json:"dps"`
	HP          float64       `json:"hp"`
	Level       int           `json:"level"`
	Build       string        `json:"build"`       // Preset build description
	HireCost    int64         `json:"hire_cost"`

	// Deployment state
	HiredBy       string    `json:"hired_by,omitempty"`     // Faction ID
	DeployedAt    string    `json:"deployed_at,omitempty"`  // Country ISO3
	HiredAt       time.Time `json:"hired_at,omitempty"`
	ContractEndsAt time.Time `json:"contract_ends_at,omitempty"`
	IsDeployed    bool      `json:"is_deployed"`

	// Auto-defense AI settings
	AutoDefend    bool      `json:"auto_defend"`   // Active when owner is offline
	DefendRadius  float64   `json:"defend_radius"` // Patrol radius
}

// IsContractExpired returns true if the mercenary's contract has expired.
func (m *Mercenary) IsContractExpired() bool {
	if m.ContractEndsAt.IsZero() {
		return false
	}
	return time.Now().After(m.ContractEndsAt)
}

// mercenary name parts for random generation
var (
	mercFirstNames = []string{
		"Iron", "Shadow", "Storm", "Blaze", "Frost", "Thunder", "Viper",
		"Hawk", "Wolf", "Raven", "Phoenix", "Ghost", "Titan", "Crimson",
		"Azure", "Obsidian", "Platinum", "Emerald", "Scarlet", "Onyx",
	}
	mercLastNames = []string{
		"Guard", "Blade", "Shield", "Fang", "Claw", "Strike", "Watch",
		"Warden", "Knight", "Sentinel", "Defender", "Hunter", "Ranger",
		"Warrior", "Champion", "Paladin", "Berserker", "Assassin",
	}
	mercBuilds = []string{
		"Tank", "DPS", "Bruiser", "Assassin", "Support", "Sniper",
		"Brawler", "Guardian", "Juggernaut", "Skirmisher",
	}
)

// MercenaryMarket manages the mercenary NPC system.
type MercenaryMarket struct {
	mu sync.RWMutex

	tierConfigs   map[MercenaryTier]MercenaryTierConfig
	available     map[string]*Mercenary // mercID → available mercenaries (not hired)
	deployed      map[string]*Mercenary // mercID → hired and deployed mercenaries
	factionMercs  map[string][]string   // factionID → list of hired merc IDs

	// External references
	factionManager *FactionManager

	rng *rand.Rand

	// Market refresh
	lastRefreshAt time.Time
	refreshInterval time.Duration
}

// NewMercenaryMarket creates a new mercenary market.
func NewMercenaryMarket() *MercenaryMarket {
	mm := &MercenaryMarket{
		tierConfigs:    DefaultTierConfigs(),
		available:      make(map[string]*Mercenary),
		deployed:       make(map[string]*Mercenary),
		factionMercs:   make(map[string][]string),
		rng:            rand.New(rand.NewSource(time.Now().UnixNano())),
		refreshInterval: 6 * time.Hour,
	}

	// Generate initial market
	mm.refreshMarket()

	return mm
}

// SetFactionManager sets the faction manager reference.
func (mm *MercenaryMarket) SetFactionManager(fm *FactionManager) {
	mm.mu.Lock()
	defer mm.mu.Unlock()
	mm.factionManager = fm
}

// refreshMarket generates a new batch of available mercenaries.
// Must be called with write lock held.
func (mm *MercenaryMarket) refreshMarket() {
	mm.available = make(map[string]*Mercenary)

	// Generate 8-12 mercenaries
	count := 8 + mm.rng.Intn(5)
	for i := 0; i < count; i++ {
		merc := mm.generateMercenary()
		mm.available[merc.ID] = merc
	}

	mm.lastRefreshAt = time.Now()
	slog.Info("mercenary market refreshed", "count", count)
}

// generateMercenary creates a random mercenary NPC.
func (mm *MercenaryMarket) generateMercenary() *Mercenary {
	// Roll tier based on spawn weights
	tier := mm.rollTier()
	cfg := mm.tierConfigs[tier]

	// Generate stats within tier ranges
	dps := cfg.DPSRange[0] + mm.rng.Float64()*(cfg.DPSRange[1]-cfg.DPSRange[0])
	hp := cfg.HPRange[0] + mm.rng.Float64()*(cfg.HPRange[1]-cfg.HPRange[0])
	level := cfg.LevelRange[0] + mm.rng.Intn(cfg.LevelRange[1]-cfg.LevelRange[0]+1)

	// Generate name
	firstName := mercFirstNames[mm.rng.Intn(len(mercFirstNames))]
	lastName := mercLastNames[mm.rng.Intn(len(mercLastNames))]
	build := mercBuilds[mm.rng.Intn(len(mercBuilds))]

	return &Mercenary{
		ID:           uuid.New().String(),
		Name:         firstName + " " + lastName,
		Tier:         tier,
		DPS:          dps,
		HP:           hp,
		Level:        level,
		Build:        build,
		HireCost:     cfg.HireCost,
		AutoDefend:   true,
		DefendRadius: 500 + float64(level)*50,
	}
}

// rollTier selects a tier based on spawn weights.
func (mm *MercenaryMarket) rollTier() MercenaryTier {
	roll := mm.rng.Float64()
	cumulative := 0.0

	for _, tier := range AllMercenaryTiers {
		cfg := mm.tierConfigs[tier]
		cumulative += cfg.SpawnWeight
		if roll < cumulative {
			return tier
		}
	}
	return MercTierBronze // fallback
}

// GetAvailableMercenaries returns all mercenaries available for hire.
func (mm *MercenaryMarket) GetAvailableMercenaries() []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	// Check if market needs refresh
	if time.Since(mm.lastRefreshAt) > mm.refreshInterval {
		mm.mu.RUnlock()
		mm.mu.Lock()
		if time.Since(mm.lastRefreshAt) > mm.refreshInterval {
			mm.refreshMarket()
		}
		mm.mu.Unlock()
		mm.mu.RLock()
	}

	result := make([]*Mercenary, 0, len(mm.available))
	for _, m := range mm.available {
		result = append(result, m)
	}

	// Sort by tier (legendary first)
	tierOrder := map[MercenaryTier]int{
		MercTierLegendary: 0, MercTierGold: 1, MercTierSilver: 2, MercTierBronze: 3,
	}
	sort.Slice(result, func(i, j int) bool {
		return tierOrder[result[i].Tier] < tierOrder[result[j].Tier]
	})

	return result
}

// HireMercenary hires an available mercenary for a faction.
func (mm *MercenaryMarket) HireMercenary(factionID, mercID string) (*Mercenary, error) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	merc, ok := mm.available[mercID]
	if !ok {
		return nil, fmt.Errorf("mercenary %s not available", mercID)
	}

	// Check faction hire limit (max 5 active mercenaries per faction)
	if len(mm.factionMercs[factionID]) >= 5 {
		return nil, fmt.Errorf("maximum 5 active mercenaries per faction")
	}

	// Deduct gold from faction treasury
	if mm.factionManager != nil {
		err := mm.factionManager.WithdrawFromTreasury(factionID, ResourceBundle{Gold: merc.HireCost})
		if err != nil {
			return nil, fmt.Errorf("insufficient gold: %w", err)
		}
	}

	// Transfer from available to deployed
	delete(mm.available, mercID)

	cfg := mm.tierConfigs[merc.Tier]
	merc.HiredBy = factionID
	merc.HiredAt = time.Now()
	merc.ContractEndsAt = time.Now().Add(time.Duration(cfg.ContractHours) * time.Hour)

	mm.deployed[mercID] = merc
	mm.factionMercs[factionID] = append(mm.factionMercs[factionID], mercID)

	slog.Info("mercenary hired",
		"id", mercID,
		"tier", merc.Tier,
		"faction", factionID,
		"cost", merc.HireCost,
	)

	return merc, nil
}

// DeployMercenary deploys a hired mercenary to a specific country.
func (mm *MercenaryMarket) DeployMercenary(factionID, mercID, countryISO string) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	merc, ok := mm.deployed[mercID]
	if !ok {
		return fmt.Errorf("mercenary %s not hired", mercID)
	}
	if merc.HiredBy != factionID {
		return fmt.Errorf("mercenary not owned by your faction")
	}
	if merc.IsContractExpired() {
		return fmt.Errorf("contract has expired")
	}

	merc.DeployedAt = countryISO
	merc.IsDeployed = true

	slog.Info("mercenary deployed",
		"id", mercID,
		"country", countryISO,
		"faction", factionID,
	)

	return nil
}

// GetFactionMercenaries returns all mercenaries hired by a faction.
func (mm *MercenaryMarket) GetFactionMercenaries(factionID string) []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	mercIDs := mm.factionMercs[factionID]
	result := make([]*Mercenary, 0, len(mercIDs))
	for _, id := range mercIDs {
		if merc, ok := mm.deployed[id]; ok {
			result = append(result, merc)
		}
	}
	return result
}

// GetDeployedMercenaries returns all mercenaries deployed at a specific country.
func (mm *MercenaryMarket) GetDeployedMercenaries(countryISO string) []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	var result []*Mercenary
	for _, merc := range mm.deployed {
		if merc.DeployedAt == countryISO && merc.IsDeployed && !merc.IsContractExpired() {
			result = append(result, merc)
		}
	}
	return result
}

// GetAutoDefenders returns all active auto-defend mercenaries for a country.
// Used by the arena system for offline protection.
func (mm *MercenaryMarket) GetAutoDefenders(countryISO string) []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	var defenders []*Mercenary
	for _, merc := range mm.deployed {
		if merc.DeployedAt == countryISO &&
			merc.IsDeployed &&
			merc.AutoDefend &&
			!merc.IsContractExpired() {
			defenders = append(defenders, merc)
		}
	}
	return defenders
}

// ExpireContracts removes expired mercenary contracts.
// Should be called periodically.
func (mm *MercenaryMarket) ExpireContracts() int {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	expired := 0
	for id, merc := range mm.deployed {
		if merc.IsContractExpired() {
			// Remove from faction's list
			factionMercs := mm.factionMercs[merc.HiredBy]
			for i, mid := range factionMercs {
				if mid == id {
					mm.factionMercs[merc.HiredBy] = append(factionMercs[:i], factionMercs[i+1:]...)
					break
				}
			}
			delete(mm.deployed, id)
			expired++

			slog.Info("mercenary contract expired",
				"id", id,
				"tier", merc.Tier,
				"faction", merc.HiredBy,
			)
		}
	}
	return expired
}

// DismissMercenary releases a hired mercenary before contract expiry.
func (mm *MercenaryMarket) DismissMercenary(factionID, mercID string) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	merc, ok := mm.deployed[mercID]
	if !ok {
		return fmt.Errorf("mercenary %s not deployed", mercID)
	}
	if merc.HiredBy != factionID {
		return fmt.Errorf("mercenary not owned by your faction")
	}

	// Remove from faction's list
	factionMercs := mm.factionMercs[factionID]
	for i, mid := range factionMercs {
		if mid == mercID {
			mm.factionMercs[factionID] = append(factionMercs[:i], factionMercs[i+1:]...)
			break
		}
	}
	delete(mm.deployed, mercID)

	slog.Info("mercenary dismissed", "id", mercID, "faction", factionID)
	return nil
}

// --- HTTP API ---

// MercenaryRoutes returns a chi.Router with mercenary market endpoints.
func (mm *MercenaryMarket) MercenaryRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()

	// Public
	r.Get("/available", mm.handleGetAvailable)
	r.Get("/tiers", mm.handleGetTiers)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/hire", mm.handleHire(fm))
		r.Post("/deploy", mm.handleDeploy(fm))
		r.Post("/dismiss", mm.handleDismiss(fm))
		r.Get("/my-mercs", mm.handleGetMyMercs(fm))
	})

	return r
}

func (mm *MercenaryMarket) handleGetAvailable(w http.ResponseWriter, r *http.Request) {
	mercs := mm.GetAvailableMercenaries()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"mercenaries": mercs,
		"count":       len(mercs),
	})
}

func (mm *MercenaryMarket) handleGetTiers(w http.ResponseWriter, r *http.Request) {
	configs := DefaultTierConfigs()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tiers": configs,
	})
}

// HireRequest is the HTTP request body for hiring a mercenary.
type HireRequest struct {
	MercenaryID string `json:"mercenary_id"`
}

func (mm *MercenaryMarket) handleHire(fm *FactionManager) http.HandlerFunc {
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

		if !fm.HasPermission(factionID, userID, RoleCommander) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Commander+ permission"})
			return
		}

		var req HireRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		merc, err := mm.HireMercenary(factionID, req.MercenaryID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"mercenary": merc,
		})
	}
}

// DeployRequest is the HTTP request body for deploying a mercenary.
type DeployMercRequest struct {
	MercenaryID string `json:"mercenary_id"`
	CountryISO  string `json:"country_iso"`
}

func (mm *MercenaryMarket) handleDeploy(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		var req DeployMercRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if err := mm.DeployMercenary(factionID, req.MercenaryID, req.CountryISO); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "deployed"})
	}
}

// DismissRequest is the HTTP request body for dismissing a mercenary.
type DismissRequest struct {
	MercenaryID string `json:"mercenary_id"`
}

func (mm *MercenaryMarket) handleDismiss(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		var req DismissRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if err := mm.DismissMercenary(factionID, req.MercenaryID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "dismissed"})
	}
}

func (mm *MercenaryMarket) handleGetMyMercs(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		mercs := mm.GetFactionMercenaries(factionID)
		if mercs == nil {
			mercs = []*Mercenary{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"mercenaries": mercs,
			"count":       len(mercs),
		})
	}
}
