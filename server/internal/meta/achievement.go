package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// --- Achievement Definitions ---

// AchievementType distinguishes personal vs faction achievements.
type AchievementType string

const (
	AchievementPersonal AchievementType = "personal"
	AchievementFaction  AchievementType = "faction"
)

// AchievementTier indicates rarity / difficulty.
type AchievementTier string

const (
	TierBronze   AchievementTier = "bronze"
	TierSilver   AchievementTier = "silver"
	TierGold     AchievementTier = "gold"
	TierPlatinum AchievementTier = "platinum"
	TierLegend   AchievementTier = "legend"
)

// AchievementDefinition defines an achievement and its unlock criteria.
type AchievementDefinition struct {
	Key         string          `json:"key"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        AchievementType `json:"type"`
	Tier        AchievementTier `json:"tier"`
	Icon        string          `json:"icon"`
	Threshold   int64           `json:"threshold"`   // Target value to unlock
	Hidden      bool            `json:"hidden"`       // Hidden until unlocked
	Repeatable  bool            `json:"repeatable"`   // Can be earned multiple times
}

// DefaultAchievements returns all 24 achievement definitions.
func DefaultAchievements() []AchievementDefinition {
	return []AchievementDefinition{
		// --- Personal Achievements (13) ---
		{Key: "first_blood", Name: "First Blood", Description: "Get your first kill in battle", Type: AchievementPersonal, Tier: TierBronze, Icon: "sword", Threshold: 1},
		{Key: "centurion", Name: "Centurion", Description: "Accumulate 100 kills across all battles", Type: AchievementPersonal, Tier: TierSilver, Icon: "skull", Threshold: 100},
		{Key: "world_traveler", Name: "World Traveler", Description: "Deploy agents to 50 different countries", Type: AchievementPersonal, Tier: TierGold, Icon: "globe", Threshold: 50},
		{Key: "undying", Name: "Undying", Description: "Survive 10 consecutive battles", Type: AchievementPersonal, Tier: TierGold, Icon: "shield", Threshold: 10},
		{Key: "kingmaker", Name: "Kingmaker", Description: "Participate in a successful Capital Siege", Type: AchievementPersonal, Tier: TierPlatinum, Icon: "crown", Threshold: 1},
		{Key: "economist", Name: "Economist", Description: "Earn 10,000 Gold in a single season", Type: AchievementPersonal, Tier: TierSilver, Icon: "coin", Threshold: 10000},
		{Key: "diplomat", Name: "Diplomat", Description: "Be part of a faction with 5 active treaties", Type: AchievementPersonal, Tier: TierSilver, Icon: "scroll", Threshold: 5},
		{Key: "lone_wolf", Name: "Lone Wolf", Description: "Win a battle as the only agent from your faction", Type: AchievementPersonal, Tier: TierGold, Icon: "wolf", Threshold: 1},
		{Key: "speedrunner", Name: "Speedrunner", Description: "Reach max level in a single battle", Type: AchievementPersonal, Tier: TierSilver, Icon: "lightning", Threshold: 1},
		{Key: "marathon", Name: "Marathon Runner", Description: "Participate in 100 battles in a single season", Type: AchievementPersonal, Tier: TierGold, Icon: "run", Threshold: 100},
		{Key: "first_dawn", Name: "First Dawn", Description: "Join on day 1 of a new season", Type: AchievementPersonal, Tier: TierBronze, Icon: "sunrise", Threshold: 1},
		{Key: "clutch_master", Name: "Clutch Master", Description: "Win a battle with less than 10% HP remaining", Type: AchievementPersonal, Tier: TierGold, Icon: "heart", Threshold: 1},
		{Key: "five_star", Name: "Five Star General", Description: "Reach Commander rank in your faction", Type: AchievementPersonal, Tier: TierSilver, Icon: "star", Threshold: 1},

		// --- Faction Achievements (11) ---
		{Key: "rising_power", Name: "Rising Power", Description: "Capture your first S-tier country", Type: AchievementFaction, Tier: TierGold, Icon: "flag", Threshold: 1},
		{Key: "empire_builder", Name: "Empire Builder", Description: "Control 20 countries simultaneously", Type: AchievementFaction, Tier: TierPlatinum, Icon: "castle", Threshold: 20},
		{Key: "trade_empire", Name: "Trade Empire", Description: "Achieve #1 GDP ranking", Type: AchievementFaction, Tier: TierGold, Icon: "chart", Threshold: 1},
		{Key: "peacekeeper", Name: "Peacekeeper", Description: "Hold territory for 7 consecutive days without war", Type: AchievementFaction, Tier: TierSilver, Icon: "dove", Threshold: 7},
		{Key: "legacy", Name: "Legacy", Description: "Finish Top 5 in 3 consecutive seasons", Type: AchievementFaction, Tier: TierLegend, Icon: "trophy", Threshold: 3},
		{Key: "continental", Name: "Continental Power", Description: "Control all countries in one continent", Type: AchievementFaction, Tier: TierPlatinum, Icon: "map", Threshold: 1},
		{Key: "iron_curtain", Name: "Iron Curtain", Description: "Successfully defend 50 battles in a row", Type: AchievementFaction, Tier: TierGold, Icon: "wall", Threshold: 50},
		{Key: "nuclear_option", Name: "Nuclear Option", Description: "Win a Capital Siege against the #1 faction", Type: AchievementFaction, Tier: TierLegend, Icon: "explosion", Threshold: 1},
		{Key: "united_nations", Name: "United Nations", Description: "Have active alliances with 5 different factions", Type: AchievementFaction, Tier: TierSilver, Icon: "handshake", Threshold: 5},
		{Key: "war_economy", Name: "War Economy", Description: "Earn 1,000,000 Gold from territory income", Type: AchievementFaction, Tier: TierGold, Icon: "bank", Threshold: 1000000},
		{Key: "founding_fathers", Name: "Founding Fathers", Description: "Recruit 30 members to your faction", Type: AchievementFaction, Tier: TierSilver, Icon: "people", Threshold: 30},
	}
}

// --- Achievement Record ---

// AchievementRecord is an unlocked achievement for a user or faction.
type AchievementRecord struct {
	ID             string          `json:"id"`
	AchievementKey string          `json:"achievement_key"`
	OwnerID        string          `json:"owner_id"`       // User ID or Faction ID
	OwnerType      AchievementType `json:"owner_type"`     // "personal" or "faction"
	Progress       int64           `json:"progress"`        // Current progress toward threshold
	Unlocked       bool            `json:"unlocked"`
	UnlockedAt     time.Time       `json:"unlocked_at,omitempty"`
	SeasonID       string          `json:"season_id,omitempty"` // Season when unlocked (if seasonal)
}

// AchievementNotification is sent to the client when an achievement unlocks.
type AchievementNotification struct {
	AchievementKey string          `json:"achievement_key"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Tier           AchievementTier `json:"tier"`
	Icon           string          `json:"icon"`
	OwnerID        string          `json:"owner_id"`
	Timestamp      int64           `json:"timestamp"`
}

// --- Achievement Engine ---

// AchievementEngine tracks achievement progress and unlocks.
type AchievementEngine struct {
	mu sync.RWMutex

	// Achievement definitions (key → definition)
	definitions map[string]AchievementDefinition

	// Achievement records (ownerID → key → record)
	records map[string]map[string]*AchievementRecord

	// Notification queue (buffered for broadcast)
	notifications []AchievementNotification

	// Callback for real-time notifications
	OnAchievementUnlocked func(notification AchievementNotification)
}

// NewAchievementEngine creates a new AchievementEngine with default definitions.
func NewAchievementEngine() *AchievementEngine {
	defs := DefaultAchievements()
	defMap := make(map[string]AchievementDefinition, len(defs))
	for _, d := range defs {
		defMap[d.Key] = d
	}

	return &AchievementEngine{
		definitions:   defMap,
		records:       make(map[string]map[string]*AchievementRecord),
		notifications: make([]AchievementNotification, 0),
	}
}

// --- Progress Tracking ---

// IncrementProgress adds to an achievement's progress for an owner.
// If the threshold is reached, the achievement is unlocked.
// Returns true if the achievement was newly unlocked.
func (ae *AchievementEngine) IncrementProgress(ownerID, achievementKey string, amount int64) bool {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	def, ok := ae.definitions[achievementKey]
	if !ok {
		return false
	}

	// Get or create record
	ownerRecords, ok := ae.records[ownerID]
	if !ok {
		ownerRecords = make(map[string]*AchievementRecord)
		ae.records[ownerID] = ownerRecords
	}

	record, ok := ownerRecords[achievementKey]
	if !ok {
		record = &AchievementRecord{
			ID:             uuid.New().String(),
			AchievementKey: achievementKey,
			OwnerID:        ownerID,
			OwnerType:      def.Type,
		}
		ownerRecords[achievementKey] = record
	}

	// Already unlocked and not repeatable
	if record.Unlocked && !def.Repeatable {
		return false
	}

	// Increment progress
	record.Progress += amount

	// Check threshold
	if record.Progress >= def.Threshold && !record.Unlocked {
		record.Unlocked = true
		record.UnlockedAt = time.Now()

		notification := AchievementNotification{
			AchievementKey: achievementKey,
			Name:           def.Name,
			Description:    def.Description,
			Tier:           def.Tier,
			Icon:           def.Icon,
			OwnerID:        ownerID,
			Timestamp:      time.Now().UnixMilli(),
		}

		ae.notifications = append(ae.notifications, notification)

		slog.Info("achievement unlocked",
			"owner", ownerID,
			"achievement", achievementKey,
			"name", def.Name,
			"tier", string(def.Tier),
		)

		// Fire callback for real-time notification
		if ae.OnAchievementUnlocked != nil {
			go ae.OnAchievementUnlocked(notification)
		}

		return true
	}

	return false
}

// SetProgress sets absolute progress (useful for snapshot-based checks).
func (ae *AchievementEngine) SetProgress(ownerID, achievementKey string, value int64) bool {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	def, ok := ae.definitions[achievementKey]
	if !ok {
		return false
	}

	ownerRecords, ok := ae.records[ownerID]
	if !ok {
		ownerRecords = make(map[string]*AchievementRecord)
		ae.records[ownerID] = ownerRecords
	}

	record, ok := ownerRecords[achievementKey]
	if !ok {
		record = &AchievementRecord{
			ID:             uuid.New().String(),
			AchievementKey: achievementKey,
			OwnerID:        ownerID,
			OwnerType:      def.Type,
		}
		ownerRecords[achievementKey] = record
	}

	if record.Unlocked && !def.Repeatable {
		return false
	}

	record.Progress = value

	if record.Progress >= def.Threshold && !record.Unlocked {
		record.Unlocked = true
		record.UnlockedAt = time.Now()

		notification := AchievementNotification{
			AchievementKey: achievementKey,
			Name:           def.Name,
			Description:    def.Description,
			Tier:           def.Tier,
			Icon:           def.Icon,
			OwnerID:        ownerID,
			Timestamp:      time.Now().UnixMilli(),
		}
		ae.notifications = append(ae.notifications, notification)

		if ae.OnAchievementUnlocked != nil {
			go ae.OnAchievementUnlocked(notification)
		}

		return true
	}

	return false
}

// --- Event Handlers (called by game systems) ---

// OnKill should be called when a player gets a kill.
func (ae *AchievementEngine) OnKill(userID string, totalKills int64) {
	ae.IncrementProgress(userID, "first_blood", 1)
	ae.SetProgress(userID, "centurion", totalKills)
}

// OnBattleSurvived should be called when a player survives a battle.
func (ae *AchievementEngine) OnBattleSurvived(userID string, consecutiveSurvivals int64) {
	ae.SetProgress(userID, "undying", consecutiveSurvivals)
}

// OnBattleParticipated should be called for each battle participation.
func (ae *AchievementEngine) OnBattleParticipated(userID string, totalBattles int64) {
	ae.SetProgress(userID, "marathon", totalBattles)
}

// OnCountryVisited should be called when a player deploys to a new country.
func (ae *AchievementEngine) OnCountryVisited(userID string, totalCountries int64) {
	ae.SetProgress(userID, "world_traveler", totalCountries)
}

// OnGoldEarned should be called periodically with the player's season gold total.
func (ae *AchievementEngine) OnGoldEarned(userID string, totalGold int64) {
	ae.SetProgress(userID, "economist", totalGold)
}

// OnCapitalSiegeWin should be called when a capital siege is won.
func (ae *AchievementEngine) OnCapitalSiegeWin(userID string) {
	ae.IncrementProgress(userID, "kingmaker", 1)
}

// OnTreaties should be called with the current number of active treaties.
func (ae *AchievementEngine) OnTreaties(userID string, treatyCount int64) {
	ae.SetProgress(userID, "diplomat", treatyCount)
}

// OnLoneWolfWin should be called when a player wins as the sole faction member.
func (ae *AchievementEngine) OnLoneWolfWin(userID string) {
	ae.IncrementProgress(userID, "lone_wolf", 1)
}

// OnMaxLevel should be called when a player reaches max level in a battle.
func (ae *AchievementEngine) OnMaxLevel(userID string) {
	ae.IncrementProgress(userID, "speedrunner", 1)
}

// OnSeasonFirstDay should be called when a player joins on day 1.
func (ae *AchievementEngine) OnSeasonFirstDay(userID string) {
	ae.IncrementProgress(userID, "first_dawn", 1)
}

// OnClutchWin should be called when a player wins with <10% HP.
func (ae *AchievementEngine) OnClutchWin(userID string) {
	ae.IncrementProgress(userID, "clutch_master", 1)
}

// OnPromotedToCommander should be called when a member reaches Commander rank.
func (ae *AchievementEngine) OnPromotedToCommander(userID string) {
	ae.IncrementProgress(userID, "five_star", 1)
}

// --- Faction Event Handlers ---

// OnSTierCapture should be called when a faction captures an S-tier country.
func (ae *AchievementEngine) OnSTierCapture(factionID string) {
	ae.IncrementProgress(factionID, "rising_power", 1)
}

// OnTerritoryCount should be called with faction's current territory count.
func (ae *AchievementEngine) OnTerritoryCount(factionID string, count int64) {
	ae.SetProgress(factionID, "empire_builder", count)
}

// OnGDPRank1 should be called when a faction reaches #1 GDP.
func (ae *AchievementEngine) OnGDPRank1(factionID string) {
	ae.IncrementProgress(factionID, "trade_empire", 1)
}

// OnPeaceDays should be called with consecutive peace days for a faction.
func (ae *AchievementEngine) OnPeaceDays(factionID string, days int64) {
	ae.SetProgress(factionID, "peacekeeper", days)
}

// OnConsecutiveTopFinish should be called with consecutive top-5 season count.
func (ae *AchievementEngine) OnConsecutiveTopFinish(factionID string, count int64) {
	ae.SetProgress(factionID, "legacy", count)
}

// OnContinentControl should be called when a faction controls an entire continent.
func (ae *AchievementEngine) OnContinentControl(factionID string) {
	ae.IncrementProgress(factionID, "continental", 1)
}

// OnConsecutiveDefenses should be called with consecutive defense wins.
func (ae *AchievementEngine) OnConsecutiveDefenses(factionID string, count int64) {
	ae.SetProgress(factionID, "iron_curtain", count)
}

// OnCapitalSiegeVsRank1 should be called when winning a capital siege vs the #1 faction.
func (ae *AchievementEngine) OnCapitalSiegeVsRank1(factionID string) {
	ae.IncrementProgress(factionID, "nuclear_option", 1)
}

// OnAllianceCount should be called with current active alliance count.
func (ae *AchievementEngine) OnAllianceCount(factionID string, count int64) {
	ae.SetProgress(factionID, "united_nations", count)
}

// OnTerritoryIncome should be called with total gold earned from territory.
func (ae *AchievementEngine) OnTerritoryIncome(factionID string, totalGold int64) {
	ae.SetProgress(factionID, "war_economy", totalGold)
}

// OnMemberCount should be called with current member count.
func (ae *AchievementEngine) OnMemberCount(factionID string, count int64) {
	ae.SetProgress(factionID, "founding_fathers", count)
}

// --- Queries ---

// GetDefinitions returns all achievement definitions.
func (ae *AchievementEngine) GetDefinitions() []AchievementDefinition {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	defs := make([]AchievementDefinition, 0, len(ae.definitions))
	for _, d := range ae.definitions {
		defs = append(defs, d)
	}

	// Sort: personal first, then by tier, then by key
	sort.Slice(defs, func(i, j int) bool {
		if defs[i].Type != defs[j].Type {
			return defs[i].Type < defs[j].Type
		}
		if defs[i].Tier != defs[j].Tier {
			return tierRank(defs[i].Tier) < tierRank(defs[j].Tier)
		}
		return defs[i].Key < defs[j].Key
	})

	return defs
}

// GetOwnerAchievements returns all achievement records for an owner (user or faction).
func (ae *AchievementEngine) GetOwnerAchievements(ownerID string) []AchievementRecord {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	ownerRecords, ok := ae.records[ownerID]
	if !ok {
		return nil
	}

	result := make([]AchievementRecord, 0, len(ownerRecords))
	for _, record := range ownerRecords {
		result = append(result, *record)
	}

	sort.Slice(result, func(i, j int) bool {
		// Unlocked first, then by unlock time
		if result[i].Unlocked != result[j].Unlocked {
			return result[i].Unlocked
		}
		return result[i].UnlockedAt.After(result[j].UnlockedAt)
	})

	return result
}

// GetOwnerAchievementWithDefinitions returns records enriched with definition data.
func (ae *AchievementEngine) GetOwnerAchievementWithDefinitions(ownerID string) []AchievementDisplay {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	ownerRecords := ae.records[ownerID]

	// Include all definitions, with progress if exists
	displays := make([]AchievementDisplay, 0, len(ae.definitions))
	for _, def := range ae.definitions {
		display := AchievementDisplay{
			Definition: def,
			Progress:   0,
			Unlocked:   false,
		}
		if ownerRecords != nil {
			if record, ok := ownerRecords[def.Key]; ok {
				display.Progress = record.Progress
				display.Unlocked = record.Unlocked
				display.UnlockedAt = record.UnlockedAt
			}
		}
		displays = append(displays, display)
	}

	// Sort: unlocked first, then by tier
	sort.Slice(displays, func(i, j int) bool {
		if displays[i].Unlocked != displays[j].Unlocked {
			return displays[i].Unlocked
		}
		return tierRank(displays[i].Definition.Tier) > tierRank(displays[j].Definition.Tier)
	})

	return displays
}

// AchievementDisplay combines definition with progress for API responses.
type AchievementDisplay struct {
	Definition AchievementDefinition `json:"definition"`
	Progress   int64                 `json:"progress"`
	Unlocked   bool                  `json:"unlocked"`
	UnlockedAt time.Time             `json:"unlocked_at,omitempty"`
}

// GetRecentNotifications returns and clears the notification queue.
func (ae *AchievementEngine) GetRecentNotifications(limit int) []AchievementNotification {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	if len(ae.notifications) == 0 {
		return nil
	}

	count := len(ae.notifications)
	if count > limit {
		count = limit
	}

	result := make([]AchievementNotification, count)
	copy(result, ae.notifications[len(ae.notifications)-count:])

	return result
}

// DrainNotifications returns and clears all pending notifications.
func (ae *AchievementEngine) DrainNotifications() []AchievementNotification {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	result := ae.notifications
	ae.notifications = make([]AchievementNotification, 0)
	return result
}

// GetUnlockedCount returns the number of unlocked achievements for an owner.
func (ae *AchievementEngine) GetUnlockedCount(ownerID string) int {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	count := 0
	if records, ok := ae.records[ownerID]; ok {
		for _, r := range records {
			if r.Unlocked {
				count++
			}
		}
	}
	return count
}

// GetTotalAchievementCount returns the total number of achievement definitions.
func (ae *AchievementEngine) GetTotalAchievementCount() int {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	return len(ae.definitions)
}

// --- Helpers ---

func tierRank(tier AchievementTier) int {
	switch tier {
	case TierBronze:
		return 1
	case TierSilver:
		return 2
	case TierGold:
		return 3
	case TierPlatinum:
		return 4
	case TierLegend:
		return 5
	default:
		return 0
	}
}

// --- HTTP API ---

// AchievementRoutes returns a chi.Router with achievement HTTP endpoints.
func (ae *AchievementEngine) AchievementRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/definitions", ae.handleGetDefinitions)
	r.Get("/user/{userID}", ae.handleGetUserAchievements)
	r.Get("/faction/{factionID}", ae.handleGetFactionAchievements)
	r.Get("/notifications", ae.handleGetNotifications)

	return r
}

// handleGetDefinitions — GET /api/achievements/definitions
func (ae *AchievementEngine) handleGetDefinitions(w http.ResponseWriter, r *http.Request) {
	defs := ae.GetDefinitions()

	// Split by type
	personal := make([]AchievementDefinition, 0)
	faction := make([]AchievementDefinition, 0)
	for _, d := range defs {
		if d.Type == AchievementPersonal {
			personal = append(personal, d)
		} else {
			faction = append(faction, d)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"personal":     personal,
		"faction":      faction,
		"total":        len(defs),
	})
}

// handleGetUserAchievements — GET /api/achievements/user/{userID}
func (ae *AchievementEngine) handleGetUserAchievements(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	achievements := ae.GetOwnerAchievementWithDefinitions(userID)
	unlocked := ae.GetUnlockedCount(userID)
	total := ae.GetTotalAchievementCount()

	// Filter to personal achievements only
	var personalAchievements []AchievementDisplay
	for _, a := range achievements {
		if a.Definition.Type == AchievementPersonal {
			personalAchievements = append(personalAchievements, a)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":      userID,
		"achievements": personalAchievements,
		"unlocked":     unlocked,
		"total":        total,
		"progress_pct": float64(unlocked) / float64(total) * 100,
	})
}

// handleGetFactionAchievements — GET /api/achievements/faction/{factionID}
func (ae *AchievementEngine) handleGetFactionAchievements(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	achievements := ae.GetOwnerAchievementWithDefinitions(factionID)
	unlocked := ae.GetUnlockedCount(factionID)

	// Filter to faction achievements only
	var factionAchievements []AchievementDisplay
	for _, a := range achievements {
		if a.Definition.Type == AchievementFaction {
			factionAchievements = append(factionAchievements, a)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"faction_id":   factionID,
		"achievements": factionAchievements,
		"unlocked":     unlocked,
	})
}

// handleGetNotifications — GET /api/achievements/notifications?limit=10
func (ae *AchievementEngine) handleGetNotifications(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := fmt.Sscanf(l, "%d", &limit); err == nil && parsed > 0 {
			// limit is set
		}
	}

	notifications := ae.GetRecentNotifications(limit)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"notifications": notifications,
		"count":         len(notifications),
	})
}

// --- Ensure json package usage ---
var _ json.Marshaler // reference to avoid unused import
