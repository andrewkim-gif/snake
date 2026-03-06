package meta

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
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
