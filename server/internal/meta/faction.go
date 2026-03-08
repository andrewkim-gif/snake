package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// FactionRole defines the hierarchy within a faction.
type FactionRole string

const (
	RoleSupremeLeader FactionRole = "supreme_leader"
	RoleCouncil       FactionRole = "council"
	RoleCommander     FactionRole = "commander"
	RoleMember        FactionRole = "member"
)

// Faction represents a player organization (clan/guild).
type Faction struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Tag         string            `json:"tag"`       // Short tag (max 8 chars)
	Color       string            `json:"color"`     // Hex color code
	BannerURL   string            `json:"banner_url,omitempty"`
	LeaderID    string            `json:"leader_id"`
	Treasury    ResourceBundle    `json:"treasury"`
	Prestige    int               `json:"prestige"`
	MemberCount int               `json:"member_count"`
	CreatedAt   time.Time         `json:"created_at"`

	// Computed fields (from world state)
	TerritoryCount int            `json:"territory_count"`
	TotalGDP       int64          `json:"total_gdp"`
}

// FactionMember represents a member within a faction.
type FactionMember struct {
	UserID   string      `json:"user_id"`
	Username string      `json:"username"`
	Role     FactionRole `json:"role"`
	JoinedAt time.Time   `json:"joined_at"`
}

// ResourceBundle holds economic resources.
type ResourceBundle struct {
	Gold      int64 `json:"gold"`
	Oil       int64 `json:"oil"`
	Minerals  int64 `json:"minerals"`
	Food      int64 `json:"food"`
	Tech      int64 `json:"tech"`
	Influence int64 `json:"influence"`
}

// FactionManager manages faction CRUD and membership operations.
// In Phase 0, this is an in-memory implementation.
// Phase 1+ will integrate with PostgreSQL via the db package.
type FactionManager struct {
	mu       sync.RWMutex
	factions map[string]*Faction        // factionID → Faction
	members  map[string][]FactionMember // factionID → members
	userFaction map[string]string        // userID → factionID
}

// NewFactionManager creates a new FactionManager.
func NewFactionManager() *FactionManager {
	return &FactionManager{
		factions:    make(map[string]*Faction),
		members:     make(map[string][]FactionMember),
		userFaction: make(map[string]string),
	}
}

// CreateFaction creates a new faction. The creator becomes the Supreme Leader.
func (fm *FactionManager) CreateFaction(id, name, tag, color, leaderID string) (*Faction, error) {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	// Check if user already has a faction
	if _, exists := fm.userFaction[leaderID]; exists {
		return nil, fmt.Errorf("user %s already belongs to a faction", leaderID)
	}

	// Check name uniqueness
	for _, f := range fm.factions {
		if f.Name == name {
			return nil, fmt.Errorf("faction name %q already taken", name)
		}
		if f.Tag == tag {
			return nil, fmt.Errorf("faction tag %q already taken", tag)
		}
	}

	faction := &Faction{
		ID:          id,
		Name:        name,
		Tag:         tag,
		Color:       color,
		LeaderID:    leaderID,
		Treasury:    ResourceBundle{Gold: 0},
		Prestige:    0,
		MemberCount: 1,
		CreatedAt:   time.Now(),
	}

	fm.factions[id] = faction
	fm.members[id] = []FactionMember{{
		UserID:   leaderID,
		Role:     RoleSupremeLeader,
		JoinedAt: time.Now(),
	}}
	fm.userFaction[leaderID] = id

	slog.Info("faction created", "id", id, "name", name, "leader", leaderID)

	return faction, nil
}

// GetFaction returns a faction by ID.
func (fm *FactionManager) GetFaction(id string) *Faction {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	return fm.factions[id]
}

// GetAllFactions returns all factions.
func (fm *FactionManager) GetAllFactions() []*Faction {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	result := make([]*Faction, 0, len(fm.factions))
	for _, f := range fm.factions {
		result = append(result, f)
	}
	return result
}

// GetMembers returns the members of a faction.
func (fm *FactionManager) GetMembers(factionID string) []FactionMember {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	members := fm.members[factionID]
	result := make([]FactionMember, len(members))
	copy(result, members)
	return result
}

// GetUserFaction returns the faction ID for a user, or empty string.
func (fm *FactionManager) GetUserFaction(userID string) string {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	return fm.userFaction[userID]
}

// JoinFaction adds a user to a faction as a member.
func (fm *FactionManager) JoinFaction(factionID, userID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	if _, exists := fm.userFaction[userID]; exists {
		return fmt.Errorf("user %s already belongs to a faction", userID)
	}

	fm.members[factionID] = append(fm.members[factionID], FactionMember{
		UserID:   userID,
		Role:     RoleMember,
		JoinedAt: time.Now(),
	})
	fm.userFaction[userID] = factionID
	faction.MemberCount++

	return nil
}

// LeaveFaction removes a user from their faction.
func (fm *FactionManager) LeaveFaction(userID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	factionID, ok := fm.userFaction[userID]
	if !ok {
		return fmt.Errorf("user %s not in a faction", userID)
	}

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	// Leaders cannot leave (must transfer leadership or disband)
	if faction.LeaderID == userID {
		return fmt.Errorf("leader cannot leave faction; transfer leadership first")
	}

	// Remove from members
	members := fm.members[factionID]
	for i, m := range members {
		if m.UserID == userID {
			fm.members[factionID] = append(members[:i], members[i+1:]...)
			break
		}
	}

	delete(fm.userFaction, userID)
	faction.MemberCount--

	return nil
}

// PromoteMember promotes a member to a higher role.
func (fm *FactionManager) PromoteMember(factionID, userID string, newRole FactionRole) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	members, ok := fm.members[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	for i, m := range members {
		if m.UserID == userID {
			fm.members[factionID][i].Role = newRole
			return nil
		}
	}

	return fmt.Errorf("user %s not in faction %s", userID, factionID)
}

// FactionCount returns the total number of factions.
func (fm *FactionManager) FactionCount() int {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	return len(fm.factions)
}

// FactionCreationCost is the Gold required to create a faction.
const FactionCreationCost int64 = 1000

// RoleHierarchy returns a numeric rank for permission checks. Higher = more authority.
func RoleHierarchy(role FactionRole) int {
	switch role {
	case RoleSupremeLeader:
		return 4
	case RoleCouncil:
		return 3
	case RoleCommander:
		return 2
	case RoleMember:
		return 1
	default:
		return 0
	}
}

// GetMemberRole returns the role of a user in a faction, or empty string.
func (fm *FactionManager) GetMemberRole(factionID, userID string) FactionRole {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	members := fm.members[factionID]
	for _, m := range members {
		if m.UserID == userID {
			return m.Role
		}
	}
	return ""
}

// HasPermission checks if a user has at least the given role in a faction.
func (fm *FactionManager) HasPermission(factionID, userID string, minRole FactionRole) bool {
	role := fm.GetMemberRole(factionID, userID)
	if role == "" {
		return false
	}
	return RoleHierarchy(role) >= RoleHierarchy(minRole)
}

// KickMember removes a member from a faction. Requires Commander+ permission
// and the kicker must outrank the target.
func (fm *FactionManager) KickMember(factionID, kickerID, targetID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	if kickerID == targetID {
		return fmt.Errorf("cannot kick yourself")
	}

	// Leader cannot be kicked
	if faction.LeaderID == targetID {
		return fmt.Errorf("cannot kick the Supreme Leader")
	}

	// Find both roles
	var kickerRole, targetRole FactionRole
	members := fm.members[factionID]
	for _, m := range members {
		if m.UserID == kickerID {
			kickerRole = m.Role
		}
		if m.UserID == targetID {
			targetRole = m.Role
		}
	}

	if kickerRole == "" {
		return fmt.Errorf("kicker %s not in faction", kickerID)
	}
	if targetRole == "" {
		return fmt.Errorf("target %s not in faction", targetID)
	}

	// Must be Commander+ and outrank target
	if RoleHierarchy(kickerRole) < RoleHierarchy(RoleCommander) {
		return fmt.Errorf("insufficient permission (need Commander+)")
	}
	if RoleHierarchy(kickerRole) <= RoleHierarchy(targetRole) {
		return fmt.Errorf("cannot kick a member of equal or higher rank")
	}

	// Remove target
	for i, m := range members {
		if m.UserID == targetID {
			fm.members[factionID] = append(members[:i], members[i+1:]...)
			break
		}
	}

	delete(fm.userFaction, targetID)
	faction.MemberCount--

	slog.Info("member kicked", "faction", factionID, "kicker", kickerID, "target", targetID)
	return nil
}

// DepositToTreasury adds resources to a faction's treasury.
func (fm *FactionManager) DepositToTreasury(factionID string, resources ResourceBundle) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	faction.Treasury.Gold += resources.Gold
	faction.Treasury.Oil += resources.Oil
	faction.Treasury.Minerals += resources.Minerals
	faction.Treasury.Food += resources.Food
	faction.Treasury.Tech += resources.Tech
	faction.Treasury.Influence += resources.Influence

	slog.Info("treasury deposit", "faction", factionID, "gold", resources.Gold)
	return nil
}

// WithdrawFromTreasury removes resources from a faction's treasury.
// Requires Council+ permission (checked by caller).
func (fm *FactionManager) WithdrawFromTreasury(factionID string, resources ResourceBundle) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}

	// Check sufficient funds
	if faction.Treasury.Gold < resources.Gold {
		return fmt.Errorf("insufficient gold (%d < %d)", faction.Treasury.Gold, resources.Gold)
	}
	if faction.Treasury.Oil < resources.Oil {
		return fmt.Errorf("insufficient oil (%d < %d)", faction.Treasury.Oil, resources.Oil)
	}
	if faction.Treasury.Minerals < resources.Minerals {
		return fmt.Errorf("insufficient minerals")
	}
	if faction.Treasury.Food < resources.Food {
		return fmt.Errorf("insufficient food")
	}
	if faction.Treasury.Tech < resources.Tech {
		return fmt.Errorf("insufficient tech")
	}
	if faction.Treasury.Influence < resources.Influence {
		return fmt.Errorf("insufficient influence")
	}

	faction.Treasury.Gold -= resources.Gold
	faction.Treasury.Oil -= resources.Oil
	faction.Treasury.Minerals -= resources.Minerals
	faction.Treasury.Food -= resources.Food
	faction.Treasury.Tech -= resources.Tech
	faction.Treasury.Influence -= resources.Influence

	slog.Info("treasury withdrawal", "faction", factionID, "gold", resources.Gold)
	return nil
}

// TransferLeadership transfers the Supreme Leader role to another member.
func (fm *FactionManager) TransferLeadership(factionID, currentLeaderID, newLeaderID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}
	if faction.LeaderID != currentLeaderID {
		return fmt.Errorf("only the Supreme Leader can transfer leadership")
	}

	members := fm.members[factionID]
	foundNew := false
	for i, m := range members {
		if m.UserID == currentLeaderID {
			fm.members[factionID][i].Role = RoleCouncil
		}
		if m.UserID == newLeaderID {
			fm.members[factionID][i].Role = RoleSupremeLeader
			foundNew = true
		}
	}
	if !foundNew {
		return fmt.Errorf("user %s not in faction", newLeaderID)
	}

	faction.LeaderID = newLeaderID
	slog.Info("leadership transferred", "faction", factionID, "from", currentLeaderID, "to", newLeaderID)
	return nil
}

// DisbandFaction removes a faction entirely. Only the Supreme Leader can do this.
func (fm *FactionManager) DisbandFaction(factionID, leaderID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return fmt.Errorf("faction %s not found", factionID)
	}
	if faction.LeaderID != leaderID {
		return fmt.Errorf("only the Supreme Leader can disband")
	}

	// Remove all members' references
	for _, m := range fm.members[factionID] {
		delete(fm.userFaction, m.UserID)
	}
	delete(fm.members, factionID)
	delete(fm.factions, factionID)

	slog.Info("faction disbanded", "id", factionID, "name", faction.Name)
	return nil
}

// --- HTTP API Handlers ---

// FactionRoutes returns a chi.Router with all faction HTTP endpoints.
func (fm *FactionManager) FactionRoutes() chi.Router {
	r := chi.NewRouter()

	// Public routes (no auth needed)
	r.Get("/", fm.handleListFactions)
	r.Get("/{factionID}", fm.handleGetFaction)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/", fm.handleCreateFaction)
		r.Post("/{factionID}/join", fm.handleJoinFaction)
		r.Post("/{factionID}/leave", fm.handleLeaveFaction)
		r.Post("/{factionID}/kick", fm.handleKickMember)
		r.Post("/{factionID}/promote", fm.handlePromoteMember)
		r.Post("/{factionID}/deposit", fm.handleDeposit)
		r.Post("/{factionID}/withdraw", fm.handleWithdraw)
	})

	return r
}

// handleListFactions — GET /api/factions
func (fm *FactionManager) handleListFactions(w http.ResponseWriter, r *http.Request) {
	factions := fm.GetAllFactions()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"factions": factions,
		"count":    len(factions),
	})
}

// handleGetFaction — GET /api/factions/{factionID}
func (fm *FactionManager) handleGetFaction(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	faction := fm.GetFaction(factionID)
	if faction == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "faction not found"})
		return
	}

	members := fm.GetMembers(factionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"faction": faction,
		"members": members,
	})
}

// CreateFactionRequest is the HTTP request body for faction creation.
type CreateFactionRequest struct {
	Name      string `json:"name"`
	Tag       string `json:"tag"`
	Color     string `json:"color"`
	BannerURL string `json:"banner_url,omitempty"`
}

// handleCreateFaction — POST /api/factions
func (fm *FactionManager) handleCreateFaction(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req CreateFactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// Validate fields
	req.Name = strings.TrimSpace(req.Name)
	req.Tag = strings.TrimSpace(req.Tag)
	if req.Name == "" || len(req.Name) > 64 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required (max 64 chars)"})
		return
	}
	if req.Tag == "" || len(req.Tag) > 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tag required (max 8 chars)"})
		return
	}
	if req.Color == "" {
		req.Color = "#FF0000"
	}

	id := uuid.New().String()
	faction, err := fm.CreateFaction(id, req.Name, req.Tag, req.Color, userID)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}

	// Set banner if provided
	if req.BannerURL != "" {
		fm.mu.Lock()
		faction.BannerURL = req.BannerURL
		fm.mu.Unlock()
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"faction": faction,
		"cost":    FactionCreationCost,
	})
}

// handleJoinFaction — POST /api/factions/{factionID}/join
func (fm *FactionManager) handleJoinFaction(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	factionID := chi.URLParam(r, "factionID")

	if err := fm.JoinFaction(factionID, userID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "joined", "faction_id": factionID})
}

// handleLeaveFaction — POST /api/factions/{factionID}/leave
func (fm *FactionManager) handleLeaveFaction(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	if err := fm.LeaveFaction(userID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "left"})
}

// KickRequest is the HTTP request body for kicking a member.
type KickRequest struct {
	TargetUserID string `json:"target_user_id"`
}

// handleKickMember — POST /api/factions/{factionID}/kick
func (fm *FactionManager) handleKickMember(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	factionID := chi.URLParam(r, "factionID")

	var req KickRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := fm.KickMember(factionID, userID, req.TargetUserID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "kicked", "target": req.TargetUserID})
}

// PromoteRequest is the HTTP request body for promoting a member.
type PromoteRequest struct {
	TargetUserID string      `json:"target_user_id"`
	NewRole      FactionRole `json:"new_role"`
}

// handlePromoteMember — POST /api/factions/{factionID}/promote
func (fm *FactionManager) handlePromoteMember(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	factionID := chi.URLParam(r, "factionID")

	var req PromoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// Validate requester has permission (must outrank new role)
	if !fm.HasPermission(factionID, userID, RoleCouncil) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
		return
	}

	requesterRole := fm.GetMemberRole(factionID, userID)
	if RoleHierarchy(requesterRole) <= RoleHierarchy(req.NewRole) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "cannot promote to equal or higher rank"})
		return
	}

	if err := fm.PromoteMember(factionID, req.TargetUserID, req.NewRole); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "promoted", "new_role": string(req.NewRole)})
}

// TreasuryRequest is the HTTP request body for treasury deposit/withdraw.
type TreasuryRequest struct {
	Gold      int64 `json:"gold"`
	Oil       int64 `json:"oil"`
	Minerals  int64 `json:"minerals"`
	Food      int64 `json:"food"`
	Tech      int64 `json:"tech"`
	Influence int64 `json:"influence"`
}

// handleDeposit — POST /api/factions/{factionID}/deposit
func (fm *FactionManager) handleDeposit(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	factionID := chi.URLParam(r, "factionID")

	// Must be a member
	if fm.GetUserFaction(userID) != factionID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "not a member of this faction"})
		return
	}

	var req TreasuryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	resources := ResourceBundle{
		Gold: req.Gold, Oil: req.Oil, Minerals: req.Minerals,
		Food: req.Food, Tech: req.Tech, Influence: req.Influence,
	}

	if err := fm.DepositToTreasury(factionID, resources); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	faction := fm.GetFaction(factionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "deposited",
		"treasury": faction.Treasury,
	})
}

// handleWithdraw — POST /api/factions/{factionID}/withdraw
func (fm *FactionManager) handleWithdraw(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	factionID := chi.URLParam(r, "factionID")

	// Must be Council+
	if !fm.HasPermission(factionID, userID, RoleCouncil) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Council+ permission"})
		return
	}

	var req TreasuryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	resources := ResourceBundle{
		Gold: req.Gold, Oil: req.Oil, Minerals: req.Minerals,
		Food: req.Food, Tech: req.Tech, Influence: req.Influence,
	}

	if err := fm.WithdrawFromTreasury(factionID, resources); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	faction := fm.GetFaction(factionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "withdrawn",
		"treasury": faction.Treasury,
	})
}

// writeJSON is a helper to write JSON responses.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
