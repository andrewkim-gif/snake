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

// DiplomacyDBRow is a DB-loaded treaty record.
type DiplomacyDBRow struct {
	ID         string
	Type       string
	FactionA   string
	FactionB   string
	Status     string
	ProposedBy string
	TermsJSON  []byte
	StartedAt  *time.Time
	ExpiresAt  *time.Time
	BrokenAt   *time.Time
	BrokenBy   *string
	CreatedAt  time.Time
}

// WarDBRow is a DB-loaded war record.
type WarDBRow struct {
	ID         string
	AttackerID string
	DefenderID string
	SeasonID   *string
	Status     string
	DeclaredAt time.Time
	PrepEndsAt time.Time
	EndedAt    *time.Time
	TermsJSON  []byte
	CreatedAt  time.Time
}

// DiplomacyStore is the persistence interface for diplomacy.
type DiplomacyStore interface {
	UpsertTreaty(d DiplomacyDBRow) error
	UpsertWar(w WarDBRow) error
	LoadActiveTreaties() ([]DiplomacyDBRow, error)
	LoadActiveWars() ([]WarDBRow, error)
}

// DiplomacyEngine manages inter-faction relations: treaties, wars, sanctions.
type DiplomacyEngine struct {
	mu sync.RWMutex

	config   DiplomacyConfig
	treaties map[string]*Treaty // treatyID → Treaty
	wars     map[string]*War    // warID → War

	// Relationship index: "factionA:factionB" → list of active treaty IDs
	relations map[string][]string

	// Persistence
	store DiplomacyStore

	// v18: EventLog callbacks for live news feed
	OnTreatySigned func(factionA, factionB, treatyType string)
	OnTreatyBroken func(breaker, otherFaction, treatyType string)
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

	go de.persistTreatyAsync(id)

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

	// v18: Notify EventLog for live news feed
	if de.OnTreatySigned != nil {
		go de.OnTreatySigned(treaty.FactionA, treaty.FactionB, string(treaty.Type))
	}

	go de.persistTreatyAsync(treatyID)

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

	// v18: Notify EventLog for live news feed
	if de.OnTreatyBroken != nil {
		otherFaction := treaty.FactionA
		if brokenBy == treaty.FactionA {
			otherFaction = treaty.FactionB
		}
		go de.OnTreatyBroken(brokenBy, otherFaction, string(treaty.Type))
	}

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

	go de.persistWarAsync(id)

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

// --- Extended Diplomacy: Treaty Effects ---

// TributeTerms defines the tribute payment terms.
type TributeTerms struct {
	GoldPerTick      int64 `json:"gold_per_tick"`
	OilPerTick       int64 `json:"oil_per_tick"`
	MineralsPerTick  int64 `json:"minerals_per_tick"`
	PayerFaction     string `json:"payer_faction"`
	ReceiverFaction  string `json:"receiver_faction"`
}

// TradeAgreementTerms defines trade agreement details.
type TradeAgreementTerms struct {
	FeeReduction float64 `json:"fee_reduction"` // 0.5 = 50% reduction
}

// ReputationPenalty is the prestige penalty for breaking treaties.
const ReputationPenalty = 50

// BreakTreatyWithReputation breaks a treaty and applies reputation penalty to the breaker's faction.
func (de *DiplomacyEngine) BreakTreatyWithReputation(treatyID, brokenByFaction string, factionManager *FactionManager) error {
	de.mu.Lock()

	treaty, ok := de.treaties[treatyID]
	if !ok {
		de.mu.Unlock()
		return fmt.Errorf("treaty %s not found", treatyID)
	}
	if treaty.Status != StatusActive {
		de.mu.Unlock()
		return fmt.Errorf("treaty %s is not active", treatyID)
	}

	treaty.Status = StatusBroken
	treaty.BrokenAt = time.Now()
	treaty.BrokenBy = brokenByFaction

	// Remove from relations index
	key := de.relationKey(treaty.FactionA, treaty.FactionB)
	activeIDs := de.relations[key]
	for i, id := range activeIDs {
		if id == treatyID {
			de.relations[key] = append(activeIDs[:i], activeIDs[i+1:]...)
			break
		}
	}

	de.mu.Unlock()

	// Apply reputation penalty
	if factionManager != nil {
		factionManager.mu.Lock()
		if f, ok := factionManager.factions[brokenByFaction]; ok {
			f.Prestige -= ReputationPenalty
			if f.Prestige < 0 {
				f.Prestige = 0
			}
		}
		factionManager.mu.Unlock()
	}

	slog.Info("treaty broken with reputation penalty",
		"id", treatyID,
		"by", brokenByFaction,
		"penalty", ReputationPenalty,
	)
	return nil
}

// HasNonAggressionPact checks if two factions have an active non-aggression pact.
func (de *DiplomacyEngine) HasNonAggressionPact(factionA, factionB string) bool {
	de.mu.RLock()
	defer de.mu.RUnlock()

	key := de.relationKey(factionA, factionB)
	for _, tid := range de.relations[key] {
		if t, ok := de.treaties[tid]; ok {
			if t.Status == StatusActive && t.Type == DiplomacyNonAggression {
				return true
			}
		}
	}
	return false
}

// HasTradeAgreement checks if two factions have an active trade agreement.
func (de *DiplomacyEngine) HasTradeAgreement(factionA, factionB string) bool {
	de.mu.RLock()
	defer de.mu.RUnlock()

	key := de.relationKey(factionA, factionB)
	for _, tid := range de.relations[key] {
		if t, ok := de.treaties[tid]; ok {
			if t.Status == StatusActive && t.Type == DiplomacyTradeAgreement {
				return true
			}
		}
	}
	return false
}

// GetTradeFeeReduction returns the trade fee reduction for two factions.
// Returns 0.5 (50%) if they have a trade agreement, 0 otherwise.
func (de *DiplomacyEngine) GetTradeFeeReduction(factionA, factionB string) float64 {
	if de.HasTradeAgreement(factionA, factionB) {
		return 0.5
	}
	return 0.0
}

// HasSanction checks if factionA has imposed sanctions on factionB.
func (de *DiplomacyEngine) HasSanction(sanctioner, sanctioned string) bool {
	de.mu.RLock()
	defer de.mu.RUnlock()

	for _, treaty := range de.treaties {
		if treaty.Status != StatusActive || treaty.Type != DiplomacySanction {
			continue
		}
		if treaty.FactionA == sanctioner && treaty.FactionB == sanctioned {
			return true
		}
	}
	return false
}

// IsTradeBlocked returns true if trade between two factions is blocked by sanctions.
func (de *DiplomacyEngine) IsTradeBlocked(factionA, factionB string) bool {
	return de.HasSanction(factionA, factionB) || de.HasSanction(factionB, factionA)
}

// GetTributeObligations returns all active tribute treaties where the given faction is paying.
func (de *DiplomacyEngine) GetTributeObligations(payerFactionID string) []*Treaty {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var result []*Treaty
	for _, treaty := range de.treaties {
		if treaty.Status != StatusActive || treaty.Type != DiplomacyTribute {
			continue
		}
		// The proposer (FactionA) in a tribute treaty is the one who demands tribute
		// so FactionB is the payer
		if treaty.FactionB == payerFactionID {
			result = append(result, treaty)
		}
	}
	return result
}

// GetPendingProposals returns all pending proposals for a faction.
func (de *DiplomacyEngine) GetPendingProposals(factionID string) []*Treaty {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var result []*Treaty
	for _, treaty := range de.treaties {
		if treaty.Status != StatusProposed {
			continue
		}
		// Receiver (FactionB) sees pending proposals
		if treaty.FactionB == factionID {
			result = append(result, treaty)
		}
	}
	return result
}

// GetTreaty returns a treaty by ID.
func (de *DiplomacyEngine) GetTreaty(id string) *Treaty {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.treaties[id]
}

// RejectTreaty rejects a proposed treaty.
func (de *DiplomacyEngine) RejectTreaty(treatyID, rejectedByFaction string) error {
	de.mu.Lock()
	defer de.mu.Unlock()

	treaty, ok := de.treaties[treatyID]
	if !ok {
		return fmt.Errorf("treaty %s not found", treatyID)
	}
	if treaty.Status != StatusProposed {
		return fmt.Errorf("treaty %s is not in proposed state", treatyID)
	}
	if treaty.FactionB != rejectedByFaction {
		return fmt.Errorf("only the receiving faction can reject a proposal")
	}

	// Just delete the proposal
	delete(de.treaties, treatyID)

	slog.Info("treaty proposal rejected", "id", treatyID, "by", rejectedByFaction)
	return nil
}

// ProcessTributeTick is called during economy ticks to transfer tribute resources.
// Returns a list of (payerFactionID, receiverFactionID, ResourceBundle) transfers.
func (de *DiplomacyEngine) ProcessTributeTick() []TributeTransfer {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var transfers []TributeTransfer
	for _, treaty := range de.treaties {
		if treaty.Status != StatusActive || treaty.Type != DiplomacyTribute {
			continue
		}

		// Parse tribute terms from treaty.Terms
		termsData, _ := json.Marshal(treaty.Terms)
		var terms TributeTerms
		if err := json.Unmarshal(termsData, &terms); err != nil {
			continue
		}

		if terms.GoldPerTick > 0 || terms.OilPerTick > 0 || terms.MineralsPerTick > 0 {
			transfers = append(transfers, TributeTransfer{
				PayerFaction:    treaty.FactionB,
				ReceiverFaction: treaty.FactionA,
				Resources: ResourceBundle{
					Gold:     terms.GoldPerTick,
					Oil:      terms.OilPerTick,
					Minerals: terms.MineralsPerTick,
				},
			})
		}
	}
	return transfers
}

// TributeTransfer represents a tribute payment in a single tick.
type TributeTransfer struct {
	PayerFaction    string         `json:"payer_faction"`
	ReceiverFaction string         `json:"receiver_faction"`
	Resources       ResourceBundle `json:"resources"`
}

// GetAllActiveWars returns all active or preparing wars.
func (de *DiplomacyEngine) GetAllActiveWars() []*War {
	de.mu.RLock()
	defer de.mu.RUnlock()

	var result []*War
	for _, war := range de.wars {
		if war.Status == "active" || war.Status == "preparing" {
			result = append(result, war)
		}
	}
	return result
}

// --- Persistence ---

// SetStore sets the optional persistence store.
func (de *DiplomacyEngine) SetStore(s DiplomacyStore) {
	de.mu.Lock()
	defer de.mu.Unlock()
	de.store = s
}

// LoadFromDB loads active treaties and wars from the database.
func (de *DiplomacyEngine) LoadFromDB() error {
	if de.store == nil {
		return nil
	}

	treaties, err := de.store.LoadActiveTreaties()
	if err != nil {
		return fmt.Errorf("load treaties from DB: %w", err)
	}

	wars, err := de.store.LoadActiveWars()
	if err != nil {
		return fmt.Errorf("load wars from DB: %w", err)
	}

	de.mu.Lock()
	defer de.mu.Unlock()

	for _, t := range treaties {
		var terms map[string]interface{}
		if len(t.TermsJSON) > 0 {
			json.Unmarshal(t.TermsJSON, &terms)
		}

		treaty := &Treaty{
			ID:         t.ID,
			Type:       DiplomacyType(t.Type),
			FactionA:   t.FactionA,
			FactionB:   t.FactionB,
			Status:     DiplomacyStatus(t.Status),
			ProposedBy: t.ProposedBy,
			Terms:      terms,
			CreatedAt:  t.CreatedAt,
		}
		if t.StartedAt != nil {
			treaty.StartedAt = *t.StartedAt
		}
		if t.ExpiresAt != nil {
			treaty.ExpiresAt = *t.ExpiresAt
		}
		if t.BrokenAt != nil {
			treaty.BrokenAt = *t.BrokenAt
		}
		if t.BrokenBy != nil {
			treaty.BrokenBy = *t.BrokenBy
		}

		de.treaties[t.ID] = treaty

		// Index active relations
		if treaty.Status == StatusActive {
			key := de.relationKey(treaty.FactionA, treaty.FactionB)
			de.relations[key] = append(de.relations[key], treaty.ID)
		}
	}

	for _, w := range wars {
		war := &War{
			ID:         w.ID,
			AttackerID: w.AttackerID,
			DefenderID: w.DefenderID,
			Status:     w.Status,
			DeclaredAt: w.DeclaredAt,
			PrepEndsAt: w.PrepEndsAt,
		}
		if w.EndedAt != nil {
			war.EndedAt = *w.EndedAt
		}

		de.wars[w.ID] = war
	}

	slog.Info("diplomacy loaded from DB", "treaties", len(treaties), "wars", len(wars))
	return nil
}

// persistTreatyAsync writes a treaty to the database in the background.
func (de *DiplomacyEngine) persistTreatyAsync(treatyID string) {
	if de.store == nil {
		return
	}

	de.mu.RLock()
	treaty, ok := de.treaties[treatyID]
	if !ok {
		de.mu.RUnlock()
		return
	}
	tCopy := *treaty
	de.mu.RUnlock()

	go func() {
		termsJSON, _ := json.Marshal(tCopy.Terms)
		row := DiplomacyDBRow{
			ID: tCopy.ID, Type: string(tCopy.Type),
			FactionA: tCopy.FactionA, FactionB: tCopy.FactionB,
			Status: string(tCopy.Status), ProposedBy: tCopy.ProposedBy,
			TermsJSON: termsJSON, CreatedAt: tCopy.CreatedAt,
		}
		if !tCopy.StartedAt.IsZero() {
			row.StartedAt = &tCopy.StartedAt
		}
		if !tCopy.ExpiresAt.IsZero() {
			row.ExpiresAt = &tCopy.ExpiresAt
		}
		if !tCopy.BrokenAt.IsZero() {
			row.BrokenAt = &tCopy.BrokenAt
		}
		if tCopy.BrokenBy != "" {
			row.BrokenBy = &tCopy.BrokenBy
		}

		if err := de.store.UpsertTreaty(row); err != nil {
			slog.Warn("persist treaty failed", "id", tCopy.ID, "error", err)
		}
	}()
}

// persistWarAsync writes a war to the database in the background.
func (de *DiplomacyEngine) persistWarAsync(warID string) {
	if de.store == nil {
		return
	}

	de.mu.RLock()
	war, ok := de.wars[warID]
	if !ok {
		de.mu.RUnlock()
		return
	}
	wCopy := *war
	de.mu.RUnlock()

	go func() {
		row := WarDBRow{
			ID: wCopy.ID, AttackerID: wCopy.AttackerID, DefenderID: wCopy.DefenderID,
			Status: wCopy.Status, DeclaredAt: wCopy.DeclaredAt, PrepEndsAt: wCopy.PrepEndsAt,
			CreatedAt: wCopy.DeclaredAt,
		}
		if !wCopy.EndedAt.IsZero() {
			row.EndedAt = &wCopy.EndedAt
		}

		if err := de.store.UpsertWar(row); err != nil {
			slog.Warn("persist war failed", "id", wCopy.ID, "error", err)
		}
	}()
}

// --- HTTP API ---

// DiplomacyRoutes returns a chi.Router with diplomacy HTTP endpoints.
// Requires a FactionManager reference for permission and reputation checks.
func (de *DiplomacyEngine) DiplomacyRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()
	r.Use(auth.RequireAuth)

	r.Post("/propose", de.handlePropose(fm))
	r.Post("/accept", de.handleAccept(fm))
	r.Post("/reject", de.handleReject(fm))
	r.Post("/break", de.handleBreak(fm))
	r.Get("/treaties/{factionID}", de.handleGetTreaties)
	r.Get("/pending/{factionID}", de.handleGetPending)

	return r
}

// ProposeRequest is the HTTP request body for proposing a treaty.
type ProposeRequest struct {
	Type     DiplomacyType          `json:"type"`
	TargetID string                 `json:"target_faction_id"`
	Terms    map[string]interface{} `json:"terms,omitempty"`
}

func (de *DiplomacyEngine) handlePropose(fm *FactionManager) http.HandlerFunc {
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

		// Need Council+ to propose treaties
		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req ProposeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if req.TargetID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "target_faction_id required"})
			return
		}

		// Validate target faction exists
		if fm.GetFaction(req.TargetID) == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "target faction not found"})
			return
		}

		// For sanctions — one-sided, no acceptance needed
		if req.Type == DiplomacySanction {
			id := uuid.New().String()
			treaty, err := de.ProposeTreaty(id, req.Type, factionID, req.TargetID, userID)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			// Auto-activate sanctions
			if err := de.AcceptTreaty(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, map[string]interface{}{
				"treaty": treaty,
				"status": "active",
			})
			return
		}

		id := uuid.New().String()
		treaty, err := de.ProposeTreaty(id, req.Type, factionID, req.TargetID, userID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Set terms if provided
		if len(req.Terms) > 0 {
			de.mu.Lock()
			treaty.Terms = req.Terms
			de.mu.Unlock()
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"treaty": treaty,
			"status": "proposed",
		})
	}
}

// AcceptRequest is the HTTP request body for accepting a treaty.
type AcceptRequest struct {
	TreatyID string `json:"treaty_id"`
}

func (de *DiplomacyEngine) handleAccept(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req AcceptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		treaty := de.GetTreaty(req.TreatyID)
		if treaty == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "treaty not found"})
			return
		}

		// Must be the receiving faction
		if treaty.FactionB != factionID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only the receiving faction can accept"})
			return
		}

		if err := de.AcceptTreaty(req.TreatyID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": "accepted",
			"treaty": de.GetTreaty(req.TreatyID),
		})
	}
}

// RejectRequest is the HTTP request body for rejecting a treaty.
type RejectRequest struct {
	TreatyID string `json:"treaty_id"`
}

func (de *DiplomacyEngine) handleReject(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		var req RejectRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if err := de.RejectTreaty(req.TreatyID, factionID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
	}
}

// BreakRequest is the HTTP request body for breaking a treaty.
type BreakRequest struct {
	TreatyID string `json:"treaty_id"`
}

func (de *DiplomacyEngine) handleBreak(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req BreakRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		// Verify this faction is part of the treaty
		treaty := de.GetTreaty(req.TreatyID)
		if treaty == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "treaty not found"})
			return
		}
		if treaty.FactionA != factionID && treaty.FactionB != factionID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "your faction is not part of this treaty"})
			return
		}

		if err := de.BreakTreatyWithReputation(req.TreatyID, factionID, fm); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":           "broken",
			"reputation_penalty": ReputationPenalty,
		})
	}
}

// handleGetTreaties — GET /api/diplomacy/treaties/{factionID}
func (de *DiplomacyEngine) handleGetTreaties(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	treaties := de.GetActiveTreaties(factionID)
	if treaties == nil {
		treaties = []*Treaty{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"treaties": treaties,
		"count":    len(treaties),
	})
}

// handleGetPending — GET /api/diplomacy/pending/{factionID}
func (de *DiplomacyEngine) handleGetPending(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	pending := de.GetPendingProposals(factionID)
	if pending == nil {
		pending = []*Treaty{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"proposals": pending,
		"count":     len(pending),
	})
}
