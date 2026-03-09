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
	"github.com/google/uuid"
)

// WarStatus defines the lifecycle phases of a war.
type WarStatus string

const (
	WarStatusDeclared  WarStatus = "declared"
	WarStatusPreparing WarStatus = "preparing"
	WarStatusActive    WarStatus = "active"
	WarStatusEnded     WarStatus = "ended"
)

// WarEndReason explains how a war ended.
type WarEndReason string

const (
	WarEndSurrender WarEndReason = "surrender"
	WarEndCeasefire WarEndReason = "ceasefire"
	WarEndCapitalFall WarEndReason = "capital_fall"
	WarEndTimeout   WarEndReason = "timeout"
)

// WarDeclarationCost defines the resources needed to declare war.
var WarDeclarationCost = ResourceBundle{
	Influence: 300,
	Oil:       500,
}

// AWWWarDeclarationCost defines type-differentiated $AWW costs for war declarations.
// v30 Task 1-12: 전쟁 유형별 차등 비용.
const (
	AWWWarCostSmall    = 500.0  // 소규모 전쟁 (기본)
	AWWWarCostEconomic = 1000.0 // 경제 전쟁
	AWWWarCostLarge    = 2000.0 // 대규모 전쟁
)

// getAWWWarCost returns the $AWW cost based on war type string.
func getAWWWarCost(warType string) float64 {
	switch warType {
	case "economic":
		return AWWWarCostEconomic
	case "large":
		return AWWWarCostLarge
	default:
		return AWWWarCostSmall
	}
}

// WarRecord is the full war record extending the base War struct.
type WarRecord struct {
	ID              string       `json:"id"`
	AttackerID      string       `json:"attacker_id"`
	AttackerName    string       `json:"attacker_name,omitempty"`
	DefenderID      string       `json:"defender_id"`
	DefenderName    string       `json:"defender_name,omitempty"`
	Status          WarStatus    `json:"status"`
	DeclaredAt      time.Time    `json:"declared_at"`
	PrepEndsAt      time.Time    `json:"prep_ends_at"`
	ActiveAt        time.Time    `json:"active_at,omitempty"`
	EndedAt         time.Time    `json:"ended_at,omitempty"`
	EndReason       WarEndReason `json:"end_reason,omitempty"`
	WinnerID        string       `json:"winner_id,omitempty"`

	// War stats
	AttackerScore   int          `json:"attacker_score"`
	DefenderScore   int          `json:"defender_score"`
	BattlesWon      map[string]int `json:"battles_won"` // factionID → battles won
	TerritoriesTaken int         `json:"territories_taken"`

	// Reparations / terms
	Reparations     ResourceBundle `json:"reparations,omitempty"`
	TerritoryCeded  []string     `json:"territory_ceded,omitempty"`
}

// SiegeRecord tracks a siege battle on a specific country.
type SiegeRecord struct {
	ID             string    `json:"id"`
	WarID          string    `json:"war_id"`
	CountryISO     string    `json:"country_iso"`
	AttackerID     string    `json:"attacker_id"`
	DefenderID     string    `json:"defender_id"`
	Status         string    `json:"status"` // "pending", "active", "completed"
	Phase          int       `json:"phase"`  // 1-3 (three gates)
	DefenseBonus   float64   `json:"defense_bonus"` // +30% for defender
	TimerSec       int       `json:"timer_sec"`     // 15 minutes = 900 seconds
	StartedAt      time.Time `json:"started_at,omitempty"`
	EndedAt        time.Time `json:"ended_at,omitempty"`
	WinnerID       string    `json:"winner_id,omitempty"`
	IsCapitalSiege bool      `json:"is_capital_siege"`
}

// WarManager manages all wars and siege battles.
type WarManager struct {
	mu sync.RWMutex

	wars   map[string]*WarRecord   // warID → WarRecord
	sieges map[string]*SiegeRecord  // siegeID → SiegeRecord

	// Configuration
	prepDuration    time.Duration // 48 hours default
	siegeTimerSec   int           // 900 seconds (15 min)
	siegeDefBonus   float64       // 0.30 = +30%

	// External references (injected)
	factionManager  *FactionManager
	diplomacyEngine *DiplomacyEngine

	// v18: EventLog callbacks for live news feed
	OnWarDeclared func(attackerName, defenderName string)
	OnWarEnded    func(winnerName, loserName, reason string)

	// v30 Task 1-12: $AWW 포인트 잔고 추적 (전쟁 선포 비용)
	awwBalanceTracker AWWBalanceChecker
}

// AWWBalanceChecker is an interface for checking/deducting AWW point balances.
// v30 Task 1-12: game.PlayerAWWBalance가 이 인터페이스를 구현합니다.
type AWWBalanceChecker interface {
	GetBalance(playerID string) float64
	DeductBalance(playerID string, amount float64) error
}

// SetAWWBalanceTracker sets the AWW balance tracker.
func (wm *WarManager) SetAWWBalanceTracker(tracker AWWBalanceChecker) {
	wm.mu.Lock()
	defer wm.mu.Unlock()
	wm.awwBalanceTracker = tracker
}

// NewWarManager creates a new WarManager.
func NewWarManager(fm *FactionManager, de *DiplomacyEngine) *WarManager {
	return &WarManager{
		wars:            make(map[string]*WarRecord),
		sieges:          make(map[string]*SiegeRecord),
		prepDuration:    48 * time.Hour,
		siegeTimerSec:   900,
		siegeDefBonus:   0.30,
		factionManager:  fm,
		diplomacyEngine: de,
	}
}

// DeclareWar initiates a war declaration between two factions.
// warType determines the AWW cost: "small" (500), "economic" (1000), "large" (2000).
func (wm *WarManager) DeclareWar(attackerID, defenderID string, warType ...string) (*WarRecord, error) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if attackerID == defenderID {
		return nil, fmt.Errorf("cannot declare war on yourself")
	}

	// Check for existing active war
	for _, w := range wm.wars {
		if w.Status == WarStatusActive || w.Status == WarStatusPreparing || w.Status == WarStatusDeclared {
			if (w.AttackerID == attackerID && w.DefenderID == defenderID) ||
				(w.AttackerID == defenderID && w.DefenderID == attackerID) {
				return nil, fmt.Errorf("war already exists between these factions")
			}
		}
	}

	// Check non-aggression pact via diplomacy engine
	if wm.diplomacyEngine != nil && wm.diplomacyEngine.HasNonAggressionPact(attackerID, defenderID) {
		return nil, fmt.Errorf("non-aggression pact prevents war declaration; break it first")
	}

	// Check costs (deducted by caller — FactionManager treasury)
	if wm.factionManager != nil {
		err := wm.factionManager.WithdrawFromTreasury(attackerID, WarDeclarationCost)
		if err != nil {
			return nil, fmt.Errorf("insufficient resources: %w", err)
		}
	}

	// v30 Task 1-12: $AWW 포인트 소각 비용 (전쟁 선포 시, 유형별 차등)
	if wm.awwBalanceTracker != nil {
		wt := "small"
		if len(warType) > 0 && warType[0] != "" {
			wt = warType[0]
		}
		awwCost := getAWWWarCost(wt)
		if err := wm.awwBalanceTracker.DeductBalance(attackerID, awwCost); err != nil {
			// W9 fix: AWW 부족 시 이미 차감된 자원 환불
			if wm.factionManager != nil {
				_ = wm.factionManager.DepositToTreasury(attackerID, WarDeclarationCost)
			}
			return nil, fmt.Errorf("insufficient AWW points for war declaration (need %.0f): %w", awwCost, err)
		}
		slog.Info("war declaration AWW cost deducted",
			"attacker", attackerID,
			"warType", wt,
			"cost", awwCost,
		)
	}

	now := time.Now()
	war := &WarRecord{
		ID:          uuid.New().String(),
		AttackerID:  attackerID,
		DefenderID:  defenderID,
		Status:      WarStatusDeclared,
		DeclaredAt:  now,
		PrepEndsAt:  now.Add(wm.prepDuration),
		BattlesWon:  make(map[string]int),
	}

	// Resolve names
	if wm.factionManager != nil {
		if f := wm.factionManager.GetFaction(attackerID); f != nil {
			war.AttackerName = f.Name
		}
		if f := wm.factionManager.GetFaction(defenderID); f != nil {
			war.DefenderName = f.Name
		}
	}

	wm.wars[war.ID] = war

	// Schedule transition to preparing → active
	go wm.scheduleWarPhases(war.ID)

	slog.Info("war declared",
		"id", war.ID,
		"attacker", attackerID,
		"defender", defenderID,
		"prepEnds", war.PrepEndsAt,
	)

	// v18: Notify EventLog for live news feed
	if wm.OnWarDeclared != nil {
		go wm.OnWarDeclared(war.AttackerName, war.DefenderName)
	}

	return war, nil
}

// scheduleWarPhases handles automatic war phase transitions.
func (wm *WarManager) scheduleWarPhases(warID string) {
	wm.mu.RLock()
	war, ok := wm.wars[warID]
	if !ok {
		wm.mu.RUnlock()
		return
	}
	prepDelay := time.Until(war.PrepEndsAt)
	wm.mu.RUnlock()

	// Phase 1: declared → preparing (immediate)
	wm.mu.Lock()
	if w, ok := wm.wars[warID]; ok && w.Status == WarStatusDeclared {
		w.Status = WarStatusPreparing
	}
	wm.mu.Unlock()

	// Phase 2: preparing → active (after prep period)
	if prepDelay > 0 {
		time.Sleep(prepDelay)
	}

	wm.mu.Lock()
	if w, ok := wm.wars[warID]; ok && w.Status == WarStatusPreparing {
		w.Status = WarStatusActive
		w.ActiveAt = time.Now()
		slog.Info("war now active", "id", warID)
	}
	wm.mu.Unlock()
}

// Surrender ends a war with one faction surrendering.
func (wm *WarManager) Surrender(warID, surrenderingFactionID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	war, ok := wm.wars[warID]
	if !ok {
		return fmt.Errorf("war %s not found", warID)
	}
	if war.Status == WarStatusEnded {
		return fmt.Errorf("war already ended")
	}

	// Verify the faction is part of this war
	if war.AttackerID != surrenderingFactionID && war.DefenderID != surrenderingFactionID {
		return fmt.Errorf("faction %s is not part of war %s", surrenderingFactionID, warID)
	}

	war.Status = WarStatusEnded
	war.EndedAt = time.Now()
	war.EndReason = WarEndSurrender

	// Winner is the other faction
	if surrenderingFactionID == war.AttackerID {
		war.WinnerID = war.DefenderID
	} else {
		war.WinnerID = war.AttackerID
	}

	// Calculate reparations (loser pays 20% of treasury gold)
	if wm.factionManager != nil {
		if loser := wm.factionManager.GetFaction(surrenderingFactionID); loser != nil {
			reparationGold := loser.Treasury.Gold / 5 // 20%
			war.Reparations = ResourceBundle{Gold: reparationGold}

			// Transfer reparations
			_ = wm.factionManager.WithdrawFromTreasury(surrenderingFactionID, war.Reparations)
			_ = wm.factionManager.DepositToTreasury(war.WinnerID, war.Reparations)
		}
	}

	slog.Info("war ended by surrender",
		"id", warID,
		"surrendered", surrenderingFactionID,
		"winner", war.WinnerID,
	)

	// v18: Notify EventLog for live news feed
	if wm.OnWarEnded != nil {
		winnerName, loserName := war.AttackerName, war.DefenderName
		if war.WinnerID == war.DefenderID {
			winnerName, loserName = war.DefenderName, war.AttackerName
		}
		go wm.OnWarEnded(winnerName, loserName, string(WarEndSurrender))
	}

	return nil
}

// Ceasefire ends a war with mutual agreement (no winner, no reparations).
func (wm *WarManager) Ceasefire(warID, proposingFactionID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	war, ok := wm.wars[warID]
	if !ok {
		return fmt.Errorf("war %s not found", warID)
	}
	if war.Status == WarStatusEnded {
		return fmt.Errorf("war already ended")
	}

	if war.AttackerID != proposingFactionID && war.DefenderID != proposingFactionID {
		return fmt.Errorf("faction %s is not part of war %s", proposingFactionID, warID)
	}

	war.Status = WarStatusEnded
	war.EndedAt = time.Now()
	war.EndReason = WarEndCeasefire
	// No winner in ceasefire

	slog.Info("war ended by ceasefire", "id", warID)

	// v18: Notify EventLog for live news feed
	if wm.OnWarEnded != nil {
		go wm.OnWarEnded(war.AttackerName, war.DefenderName, string(WarEndCeasefire))
	}

	return nil
}

// ProcessCapitalFall handles when an attacker conquers the defender's capital during a siege.
// Triggers: all defender territories lose 2 sovereignty levels.
func (wm *WarManager) ProcessCapitalFall(warID, capitalISO string) error {
	wm.mu.Lock()

	war, ok := wm.wars[warID]
	if !ok {
		wm.mu.Unlock()
		return fmt.Errorf("war %s not found", warID)
	}

	war.Status = WarStatusEnded
	war.EndedAt = time.Now()
	war.EndReason = WarEndCapitalFall
	war.WinnerID = war.AttackerID

	wm.mu.Unlock()

	slog.Info("capital fell",
		"warId", warID,
		"capital", capitalISO,
		"winner", war.WinnerID,
		"loser", war.DefenderID,
	)

	return nil
}

// --- Siege Battle Management ---

// CreateSiege creates a siege battle record for a country during a war.
func (wm *WarManager) CreateSiege(warID, countryISO, attackerID, defenderID string, isCapital bool) (*SiegeRecord, error) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	// Verify war exists and is active
	war, ok := wm.wars[warID]
	if !ok {
		return nil, fmt.Errorf("war %s not found", warID)
	}
	if war.Status != WarStatusActive {
		return nil, fmt.Errorf("war %s is not active", warID)
	}

	siege := &SiegeRecord{
		ID:             uuid.New().String(),
		WarID:          warID,
		CountryISO:     countryISO,
		AttackerID:     attackerID,
		DefenderID:     defenderID,
		Status:         "pending",
		Phase:          1,
		DefenseBonus:   wm.siegeDefBonus,
		TimerSec:       wm.siegeTimerSec,
		IsCapitalSiege: isCapital,
	}

	wm.sieges[siege.ID] = siege

	slog.Info("siege created",
		"siegeId", siege.ID,
		"warId", warID,
		"country", countryISO,
		"isCapital", isCapital,
	)

	return siege, nil
}

// StartSiege activates a siege battle.
func (wm *WarManager) StartSiege(siegeID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	siege, ok := wm.sieges[siegeID]
	if !ok {
		return fmt.Errorf("siege %s not found", siegeID)
	}

	siege.Status = "active"
	siege.StartedAt = time.Now()

	slog.Info("siege started", "siegeId", siegeID, "country", siege.CountryISO)
	return nil
}

// AdvanceSiegePhase moves the siege to the next gate phase (1→2→3).
func (wm *WarManager) AdvanceSiegePhase(siegeID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	siege, ok := wm.sieges[siegeID]
	if !ok {
		return fmt.Errorf("siege %s not found", siegeID)
	}

	if siege.Phase >= 3 {
		return fmt.Errorf("siege already at final phase")
	}

	siege.Phase++
	slog.Info("siege phase advanced", "siegeId", siegeID, "phase", siege.Phase)
	return nil
}

// CompleteSiege ends a siege with a winner.
func (wm *WarManager) CompleteSiege(siegeID, winnerID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	siege, ok := wm.sieges[siegeID]
	if !ok {
		return fmt.Errorf("siege %s not found", siegeID)
	}

	siege.Status = "completed"
	siege.EndedAt = time.Now()
	siege.WinnerID = winnerID

	// Update war battle count
	if war, wOk := wm.wars[siege.WarID]; wOk {
		if war.BattlesWon == nil {
			war.BattlesWon = make(map[string]int)
		}
		war.BattlesWon[winnerID]++

		// If attacker won a capital siege, trigger capital fall
		if siege.IsCapitalSiege && winnerID == siege.AttackerID {
			slog.Info("capital siege won by attacker, triggering capital fall",
				"siegeId", siegeID,
				"warId", siege.WarID,
			)
		}
	}

	slog.Info("siege completed",
		"siegeId", siegeID,
		"winner", winnerID,
		"isCapital", siege.IsCapitalSiege,
	)
	return nil
}

// GetWar returns a war by ID.
func (wm *WarManager) GetWar(id string) *WarRecord {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.wars[id]
}

// GetActiveWarsForFaction returns all non-ended wars involving a faction.
func (wm *WarManager) GetActiveWarsForFaction(factionID string) []*WarRecord {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	var result []*WarRecord
	for _, w := range wm.wars {
		if w.Status == WarStatusEnded {
			continue
		}
		if w.AttackerID == factionID || w.DefenderID == factionID {
			result = append(result, w)
		}
	}
	return result
}

// GetSiege returns a siege by ID.
func (wm *WarManager) GetSiege(id string) *SiegeRecord {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.sieges[id]
}

// GetActiveSiegesForWar returns all active sieges for a given war.
func (wm *WarManager) GetActiveSiegesForWar(warID string) []*SiegeRecord {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	var result []*SiegeRecord
	for _, s := range wm.sieges {
		if s.WarID == warID && s.Status != "completed" {
			result = append(result, s)
		}
	}
	return result
}

// --- HTTP API ---

// WarRoutes returns a chi.Router with war HTTP endpoints.
func (wm *WarManager) WarRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(auth.RequireAuth)

	r.Post("/declare", wm.handleDeclareWar)
	r.Post("/{warID}/surrender", wm.handleSurrender)
	r.Post("/{warID}/ceasefire", wm.handleCeasefire)
	r.Get("/{warID}", wm.handleGetWar)
	r.Get("/faction/{factionID}", wm.handleGetFactionWars)
	r.Get("/{warID}/sieges", wm.handleGetWarSieges)

	return r
}

// DeclareWarRequest is the HTTP request body for declaring war.
type DeclareWarRequest struct {
	DefenderFactionID string `json:"defender_faction_id"`
	WarType           string `json:"war_type,omitempty"` // "small" (default) | "economic" | "large"
}

func (wm *WarManager) handleDeclareWar(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	factionID := ""
	if wm.factionManager != nil {
		factionID = wm.factionManager.GetUserFaction(userID)
	}
	if factionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
		return
	}

	// Supreme Leader or Council only
	if wm.factionManager != nil && !wm.factionManager.HasPermission(factionID, userID, RoleCouncil) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
		return
	}

	var req DeclareWarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.DefenderFactionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "defender_faction_id required"})
		return
	}

	war, err := wm.DeclareWar(factionID, req.DefenderFactionID, req.WarType)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	wt := req.WarType
	if wt == "" {
		wt = "small"
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"war":     war,
		"cost":    WarDeclarationCost,
		"awwCost": getAWWWarCost(wt),
	})
}

func (wm *WarManager) handleSurrender(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	warID := chi.URLParam(r, "warID")

	factionID := ""
	if wm.factionManager != nil {
		factionID = wm.factionManager.GetUserFaction(userID)
	}
	if factionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
		return
	}

	if wm.factionManager != nil && !wm.factionManager.HasPermission(factionID, userID, RoleSupremeLeader) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only Supreme Leader can surrender"})
		return
	}

	if err := wm.Surrender(warID, factionID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	war := wm.GetWar(warID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "surrendered",
		"war":         war,
		"reparations": war.Reparations,
	})
}

func (wm *WarManager) handleCeasefire(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	warID := chi.URLParam(r, "warID")

	factionID := ""
	if wm.factionManager != nil {
		factionID = wm.factionManager.GetUserFaction(userID)
	}
	if factionID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
		return
	}

	if err := wm.Ceasefire(warID, factionID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ceasefire"})
}

func (wm *WarManager) handleGetWar(w http.ResponseWriter, r *http.Request) {
	warID := chi.URLParam(r, "warID")
	war := wm.GetWar(warID)
	if war == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "war not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"war": war})
}

func (wm *WarManager) handleGetFactionWars(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	wars := wm.GetActiveWarsForFaction(factionID)
	if wars == nil {
		wars = []*WarRecord{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wars":  wars,
		"count": len(wars),
	})
}

func (wm *WarManager) handleGetWarSieges(w http.ResponseWriter, r *http.Request) {
	warID := chi.URLParam(r, "warID")
	sieges := wm.GetActiveSiegesForWar(warID)
	if sieges == nil {
		sieges = []*SiegeRecord{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"sieges": sieges,
		"count":  len(sieges),
	})
}
