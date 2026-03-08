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

// CouncilSeatType defines the type of UN council seat.
type CouncilSeatType string

const (
	SeatPermanent   CouncilSeatType = "permanent"    // S-tier country sovereign (veto power)
	SeatNonPermanent CouncilSeatType = "non_permanent" // A-tier country sovereign
	SeatObserver    CouncilSeatType = "observer"       // Other factions
)

// CouncilSeat represents a seat in the UN council.
type CouncilSeat struct {
	FactionID   string          `json:"faction_id"`
	FactionName string          `json:"faction_name"`
	SeatType    CouncilSeatType `json:"seat_type"`
	CountryISO  string          `json:"country_iso"` // Which S/A-tier country grants this seat
	HasVeto     bool            `json:"has_veto"`
}

// ResolutionType defines the types of UN resolutions.
type ResolutionType string

const (
	ResNuclearBan     ResolutionType = "nuclear_ban"      // Disable capital siege
	ResFreeTradeAct   ResolutionType = "free_trade"       // Trade fees -50%
	ResPeacekeeping   ResolutionType = "peacekeeping"     // War declaration ban 48h
	ResEconomicSanction ResolutionType = "economic_sanction" // Block a faction's trade
	ResClimateAccord  ResolutionType = "climate_accord"    // Resources -10%, Tech +20%
)

// ResolutionDef defines the static properties of a resolution type.
type ResolutionDef struct {
	Type        ResolutionType `json:"type"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Duration    time.Duration  `json:"duration"`
	RequiresTarget bool        `json:"requires_target"` // e.g. sanction needs target faction
}

// DefaultResolutionDefs returns all resolution type definitions.
func DefaultResolutionDefs() []ResolutionDef {
	return []ResolutionDef{
		{
			Type:        ResNuclearBan,
			Name:        "Nuclear Ban",
			Description: "Disables Capital Siege for the duration",
			Duration:    72 * time.Hour,
		},
		{
			Type:        ResFreeTradeAct,
			Name:        "Free Trade Act",
			Description: "All trade fees reduced by 50%",
			Duration:    48 * time.Hour,
		},
		{
			Type:        ResPeacekeeping,
			Name:        "Peacekeeping Resolution",
			Description: "War declarations prohibited for 48 hours",
			Duration:    48 * time.Hour,
		},
		{
			Type:        ResEconomicSanction,
			Name:        "Economic Sanction",
			Description: "Block target faction from all trade",
			Duration:    168 * time.Hour, // 7 days
			RequiresTarget: true,
		},
		{
			Type:        ResClimateAccord,
			Name:        "Climate Accord",
			Description: "Resource production -10%, Tech production +20%",
			Duration:    72 * time.Hour,
		},
	}
}

// ResolutionStatus represents the lifecycle of a resolution.
type ResolutionStatus string

const (
	ResStatusVoting   ResolutionStatus = "voting"
	ResStatusPassed   ResolutionStatus = "passed"
	ResStatusVetoed   ResolutionStatus = "vetoed"
	ResStatusRejected ResolutionStatus = "rejected"
	ResStatusExpired  ResolutionStatus = "expired"
)

// Resolution represents a UN council resolution.
type Resolution struct {
	ID             string           `json:"id"`
	Type           ResolutionType   `json:"type"`
	Name           string           `json:"name"`
	Description    string           `json:"description"`
	Status         ResolutionStatus `json:"status"`
	ProposedBy     string           `json:"proposed_by"`      // Faction ID
	ProposerName   string           `json:"proposer_name"`
	TargetFaction  string           `json:"target_faction,omitempty"` // For sanctions
	Votes          map[string]bool  `json:"votes"`            // factionID → true=yes, false=no
	VetoedBy       string           `json:"vetoed_by,omitempty"`
	CreatedAt      time.Time        `json:"created_at"`
	VotingEndsAt   time.Time        `json:"voting_ends_at"`   // 24h voting period
	EffectStartsAt time.Time        `json:"effect_starts_at,omitempty"`
	EffectExpiresAt time.Time       `json:"effect_expires_at,omitempty"`
}

// VoteCount returns the yes/no/total vote counts.
func (r *Resolution) VoteCount() (yes, no, total int) {
	for _, v := range r.Votes {
		total++
		if v {
			yes++
		} else {
			no++
		}
	}
	return
}

// UNCouncil manages the UN council system.
type UNCouncil struct {
	mu sync.RWMutex

	resolutionDefs map[ResolutionType]ResolutionDef
	seats          []CouncilSeat                     // Current council seats
	resolutions    map[string]*Resolution            // resolutionID → resolution
	activeEffects  map[string]*Resolution            // resolutionID → passed resolutions still in effect

	// S-tier country ISO3 codes (seats that grant veto power)
	sTierCountries []string

	// External: maps countryISO → sovereign factionID
	sovereigntyLookup func(countryISO string) string

	// Voting period
	votingDuration time.Duration
}

// NewUNCouncil creates a new UN council.
func NewUNCouncil() *UNCouncil {
	defs := DefaultResolutionDefs()
	defMap := make(map[ResolutionType]ResolutionDef, len(defs))
	for _, d := range defs {
		defMap[d.Type] = d
	}

	return &UNCouncil{
		resolutionDefs: defMap,
		seats:          make([]CouncilSeat, 0),
		resolutions:    make(map[string]*Resolution),
		activeEffects:  make(map[string]*Resolution),
		sTierCountries: []string{"USA", "CHN", "RUS", "IND", "BRA", "JPN", "DEU", "GBR"},
		votingDuration: 24 * time.Hour,
	}
}

// SetSovereigntyLookup sets the function to look up sovereign factions.
func (uc *UNCouncil) SetSovereigntyLookup(fn func(countryISO string) string) {
	uc.mu.Lock()
	defer uc.mu.Unlock()
	uc.sovereigntyLookup = fn
}

// RefreshSeats recalculates council seats based on current sovereignty.
// Should be called periodically or when sovereignty changes.
func (uc *UNCouncil) RefreshSeats(aTierCountries []string) {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	if uc.sovereigntyLookup == nil {
		return
	}

	seats := make([]CouncilSeat, 0)
	seen := make(map[string]bool)

	// S-tier: permanent seats with veto
	for _, iso := range uc.sTierCountries {
		factionID := uc.sovereigntyLookup(iso)
		if factionID == "" || seen[factionID] {
			continue
		}
		seen[factionID] = true
		seats = append(seats, CouncilSeat{
			FactionID:  factionID,
			SeatType:   SeatPermanent,
			CountryISO: iso,
			HasVeto:    true,
		})
	}

	// A-tier: non-permanent seats (no veto)
	for _, iso := range aTierCountries {
		factionID := uc.sovereigntyLookup(iso)
		if factionID == "" || seen[factionID] {
			continue
		}
		seen[factionID] = true
		seats = append(seats, CouncilSeat{
			FactionID:  factionID,
			SeatType:   SeatNonPermanent,
			CountryISO: iso,
			HasVeto:    false,
		})
	}

	uc.seats = seats
	slog.Info("UN council seats refreshed", "count", len(seats))
}

// GetSeats returns the current council seats.
func (uc *UNCouncil) GetSeats() []CouncilSeat {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	result := make([]CouncilSeat, len(uc.seats))
	copy(result, uc.seats)
	return result
}

// getSeatType returns the seat type for a faction. Returns "" if not a member.
func (uc *UNCouncil) getSeatType(factionID string) CouncilSeatType {
	for _, seat := range uc.seats {
		if seat.FactionID == factionID {
			return seat.SeatType
		}
	}
	return ""
}

// hasVeto returns true if the faction has veto power.
func (uc *UNCouncil) hasVeto(factionID string) bool {
	for _, seat := range uc.seats {
		if seat.FactionID == factionID && seat.HasVeto {
			return true
		}
	}
	return false
}

// ProposeResolution submits a new resolution for voting.
// Only council members (permanent or non-permanent) can propose.
func (uc *UNCouncil) ProposeResolution(factionID, factionName string, resType ResolutionType, targetFaction string) (*Resolution, error) {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	// Verify faction has a council seat
	seatType := uc.getSeatType(factionID)
	if seatType == "" || seatType == SeatObserver {
		return nil, fmt.Errorf("only council members can propose resolutions")
	}

	// Verify resolution type
	def, ok := uc.resolutionDefs[resType]
	if !ok {
		return nil, fmt.Errorf("unknown resolution type: %s", resType)
	}

	// Verify target if required
	if def.RequiresTarget && targetFaction == "" {
		return nil, fmt.Errorf("this resolution type requires a target faction")
	}

	// Check for existing active voting for same type
	for _, res := range uc.resolutions {
		if res.Type == resType && res.Status == ResStatusVoting {
			return nil, fmt.Errorf("a %s resolution is already being voted on", resType)
		}
	}

	res := &Resolution{
		ID:            uuid.New().String(),
		Type:          resType,
		Name:          def.Name,
		Description:   def.Description,
		Status:        ResStatusVoting,
		ProposedBy:    factionID,
		ProposerName:  factionName,
		TargetFaction: targetFaction,
		Votes:         make(map[string]bool),
		CreatedAt:     time.Now(),
		VotingEndsAt:  time.Now().Add(uc.votingDuration),
	}

	// Proposer auto-votes yes
	res.Votes[factionID] = true

	uc.resolutions[res.ID] = res

	slog.Info("UN resolution proposed",
		"id", res.ID,
		"type", resType,
		"by", factionName,
	)

	return res, nil
}

// CastVote records a vote on a resolution.
// Only council members (permanent or non-permanent) can vote.
func (uc *UNCouncil) CastVote(resolutionID, factionID string, inFavor bool) error {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	res, ok := uc.resolutions[resolutionID]
	if !ok {
		return fmt.Errorf("resolution %s not found", resolutionID)
	}
	if res.Status != ResStatusVoting {
		return fmt.Errorf("resolution is not in voting state")
	}
	if time.Now().After(res.VotingEndsAt) {
		return fmt.Errorf("voting period has ended")
	}

	// Verify council membership
	seatType := uc.getSeatType(factionID)
	if seatType == "" || seatType == SeatObserver {
		return fmt.Errorf("only council members can vote")
	}

	// Check for veto
	if !inFavor && uc.hasVeto(factionID) {
		// Permanent member voting no = veto
		res.Status = ResStatusVetoed
		res.VetoedBy = factionID
		res.Votes[factionID] = false

		slog.Info("UN resolution vetoed",
			"id", resolutionID,
			"by", factionID,
		)
		return nil
	}

	res.Votes[factionID] = inFavor
	return nil
}

// ResolveVoting checks all resolutions and finalizes votes past deadline.
// Should be called periodically.
func (uc *UNCouncil) ResolveVoting() {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	now := time.Now()

	for _, res := range uc.resolutions {
		if res.Status != ResStatusVoting {
			continue
		}
		if now.Before(res.VotingEndsAt) {
			continue
		}

		// Voting period ended — tally
		yes, no, _ := res.VoteCount()

		if yes > no {
			// Passed
			def := uc.resolutionDefs[res.Type]
			res.Status = ResStatusPassed
			res.EffectStartsAt = now
			res.EffectExpiresAt = now.Add(def.Duration)
			uc.activeEffects[res.ID] = res

			slog.Info("UN resolution passed",
				"id", res.ID,
				"type", res.Type,
				"yes", yes,
				"no", no,
			)
		} else {
			res.Status = ResStatusRejected
			slog.Info("UN resolution rejected",
				"id", res.ID,
				"type", res.Type,
				"yes", yes,
				"no", no,
			)
		}
	}

	// Expire old effects
	for id, res := range uc.activeEffects {
		if now.After(res.EffectExpiresAt) {
			res.Status = ResStatusExpired
			delete(uc.activeEffects, id)
			slog.Info("UN resolution effect expired", "id", id, "type", res.Type)
		}
	}
}

// --- Effect Queries ---

// IsCapitalSiegeDisabled returns true if a nuclear ban is in effect.
func (uc *UNCouncil) IsCapitalSiegeDisabled() bool {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	for _, res := range uc.activeEffects {
		if res.Type == ResNuclearBan {
			return true
		}
	}
	return false
}

// GetTradeFeeReduction returns the trade fee reduction from Free Trade Act.
// Returns 0.0 if not active, 0.50 if active.
func (uc *UNCouncil) GetTradeFeeReduction() float64 {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	for _, res := range uc.activeEffects {
		if res.Type == ResFreeTradeAct {
			return 0.50
		}
	}
	return 0.0
}

// IsWarDeclarationBanned returns true if peacekeeping is in effect.
func (uc *UNCouncil) IsWarDeclarationBanned() bool {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	for _, res := range uc.activeEffects {
		if res.Type == ResPeacekeeping {
			return true
		}
	}
	return false
}

// IsFactionSanctioned returns true if the faction is under UN economic sanctions.
func (uc *UNCouncil) IsFactionSanctioned(factionID string) bool {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	for _, res := range uc.activeEffects {
		if res.Type == ResEconomicSanction && res.TargetFaction == factionID {
			return true
		}
	}
	return false
}

// GetClimateAccordEffects returns (resourceMult, techMult) if climate accord is active.
// Returns (1.0, 1.0) if not active.
func (uc *UNCouncil) GetClimateAccordEffects() (resourceMult, techMult float64) {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	for _, res := range uc.activeEffects {
		if res.Type == ResClimateAccord {
			return 0.90, 1.20 // -10% resources, +20% tech
		}
	}
	return 1.0, 1.0
}

// GetActiveResolutions returns all active (in-effect) resolutions.
func (uc *UNCouncil) GetActiveResolutions() []*Resolution {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	result := make([]*Resolution, 0, len(uc.activeEffects))
	for _, r := range uc.activeEffects {
		result = append(result, r)
	}
	return result
}

// GetVotingResolutions returns all resolutions currently in voting.
func (uc *UNCouncil) GetVotingResolutions() []*Resolution {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	var result []*Resolution
	for _, r := range uc.resolutions {
		if r.Status == ResStatusVoting {
			result = append(result, r)
		}
	}
	return result
}

// GetAllResolutions returns all resolutions (for history).
func (uc *UNCouncil) GetAllResolutions() []*Resolution {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	result := make([]*Resolution, 0, len(uc.resolutions))
	for _, r := range uc.resolutions {
		result = append(result, r)
	}
	return result
}

// --- HTTP API ---

// CouncilRoutes returns a chi.Router with UN council endpoints.
func (uc *UNCouncil) CouncilRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()

	// Public
	r.Get("/seats", uc.handleGetSeats)
	r.Get("/resolutions", uc.handleGetResolutions)
	r.Get("/active", uc.handleGetActiveEffects)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/propose", uc.handlePropose(fm))
		r.Post("/vote", uc.handleVote(fm))
	})

	return r
}

func (uc *UNCouncil) handleGetSeats(w http.ResponseWriter, r *http.Request) {
	seats := uc.GetSeats()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"seats": seats,
		"count": len(seats),
	})
}

func (uc *UNCouncil) handleGetResolutions(w http.ResponseWriter, r *http.Request) {
	voting := uc.GetVotingResolutions()
	all := uc.GetAllResolutions()
	if voting == nil {
		voting = []*Resolution{}
	}
	if all == nil {
		all = []*Resolution{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"voting":  voting,
		"history": all,
	})
}

func (uc *UNCouncil) handleGetActiveEffects(w http.ResponseWriter, r *http.Request) {
	active := uc.GetActiveResolutions()
	if active == nil {
		active = []*Resolution{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"active_effects": active,
		"capital_siege_disabled": uc.IsCapitalSiegeDisabled(),
		"war_declaration_banned": uc.IsWarDeclarationBanned(),
		"trade_fee_reduction":    uc.GetTradeFeeReduction(),
	})
}

// ProposeResolutionRequest is the HTTP request body for proposing a resolution.
type ProposeResolutionRequest struct {
	Type          ResolutionType `json:"type"`
	TargetFaction string         `json:"target_faction,omitempty"`
}

func (uc *UNCouncil) handlePropose(fm *FactionManager) http.HandlerFunc {
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

		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req ProposeResolutionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		faction := fm.GetFaction(factionID)
		factionName := ""
		if faction != nil {
			factionName = faction.Name
		}

		res, err := uc.ProposeResolution(factionID, factionName, req.Type, req.TargetFaction)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"resolution": res,
		})
	}
}

// VoteRequest is the HTTP request body for casting a vote.
type VoteRequest struct {
	ResolutionID string `json:"resolution_id"`
	InFavor      bool   `json:"in_favor"`
}

func (uc *UNCouncil) handleVote(fm *FactionManager) http.HandlerFunc {
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

		if !fm.HasPermission(factionID, userID, RoleCouncil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
			return
		}

		var req VoteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if err := uc.CastVote(req.ResolutionID, factionID, req.InFavor); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "vote recorded"})
	}
}
