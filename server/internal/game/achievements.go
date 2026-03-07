package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 9 — S40: Achievement System
// 30 permanent achievements, title/emoji/badge rewards.
// achievements_update S→C event on unlock.
// ============================================================

// AchievementID uniquely identifies an achievement.
type AchievementID string

// Achievement categories
const (
	AchCatCombat      = "combat"
	AchCatProgression = "progression"
	AchCatDomination  = "domination"
	AchCatSocial      = "social"
	AchCatMastery     = "mastery"
	AchCatSpecial     = "special"
)

// Achievement reward types
const (
	AchRewardTitle   = "title"
	AchRewardEmoji   = "emoji"
	AchRewardBadge   = "badge"
	AchRewardCoins   = "coins"
	AchRewardXPBoost = "xp_boost"
)

// AchievementDef defines a single achievement.
type AchievementDef struct {
	ID          AchievementID `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Category    string        `json:"category"`
	RewardType  string        `json:"rewardType"`
	RewardValue string        `json:"rewardValue"`
	RewardCoins int           `json:"rewardCoins,omitempty"`
	Hidden      bool          `json:"hidden"` // hidden until unlocked
	Target      int           `json:"target"` // numeric target for progress tracking
}

// AllAchievements defines all 30 achievements.
var AllAchievements = []AchievementDef{
	// ─── Combat (8) ───
	{ID: "first_kill", Name: "First Blood", Description: "Get your first kill", Category: AchCatCombat, RewardType: AchRewardBadge, RewardValue: "first_blood_badge", RewardCoins: 10, Target: 1},
	{ID: "kill_100", Name: "Centurion", Description: "Accumulate 100 kills", Category: AchCatCombat, RewardType: AchRewardTitle, RewardValue: "Centurion", RewardCoins: 50, Target: 100},
	{ID: "kill_500", Name: "Warmonger", Description: "Accumulate 500 kills", Category: AchCatCombat, RewardType: AchRewardTitle, RewardValue: "Warmonger", RewardCoins: 100, Target: 500},
	{ID: "kill_1000", Name: "Death Incarnate", Description: "Accumulate 1000 kills", Category: AchCatCombat, RewardType: AchRewardTitle, RewardValue: "Death Incarnate", RewardCoins: 250, Target: 1000},
	{ID: "kill_streak_10", Name: "Unstoppable", Description: "Get a 10 kill streak in one epoch", Category: AchCatCombat, RewardType: AchRewardEmoji, RewardValue: "skull_fire", RewardCoins: 30, Target: 10},
	{ID: "kill_streak_20", Name: "Godlike", Description: "Get a 20 kill streak in one epoch", Category: AchCatCombat, RewardType: AchRewardTitle, RewardValue: "Godlike", RewardCoins: 75, Target: 20},
	{ID: "assists_50", Name: "Support Specialist", Description: "Accumulate 50 assists", Category: AchCatCombat, RewardType: AchRewardBadge, RewardValue: "support_badge", RewardCoins: 25, Target: 50},
	{ID: "zero_deaths", Name: "Untouchable", Description: "Complete a war phase with 0 deaths", Category: AchCatCombat, RewardType: AchRewardEmoji, RewardValue: "shield_gold", RewardCoins: 40, Target: 1},

	// ─── Progression (7) ───
	{ID: "level_10", Name: "Rising Star", Description: "Reach account level 10", Category: AchCatProgression, RewardType: AchRewardBadge, RewardValue: "star_bronze", RewardCoins: 20, Target: 10},
	{ID: "level_25", Name: "Seasoned Warrior", Description: "Reach account level 25", Category: AchCatProgression, RewardType: AchRewardBadge, RewardValue: "star_silver", RewardCoins: 50, Target: 25},
	{ID: "level_50", Name: "Living Legend", Description: "Reach account level 50", Category: AchCatProgression, RewardType: AchRewardTitle, RewardValue: "Living Legend", RewardCoins: 100, Target: 50},
	{ID: "level_100", Name: "Immortal", Description: "Reach account level 100", Category: AchCatProgression, RewardType: AchRewardTitle, RewardValue: "Immortal", RewardCoins: 250, Target: 100},
	{ID: "max_match_level", Name: "Fully Loaded", Description: "Reach match level 20", Category: AchCatProgression, RewardType: AchRewardEmoji, RewardValue: "crown_gold", RewardCoins: 35, Target: 20},
	{ID: "all_weapons_lv5", Name: "Arsenal Master", Description: "Evolve all 10 weapons to Lv5 (lifetime)", Category: AchCatProgression, RewardType: AchRewardTitle, RewardValue: "Arsenal Master", RewardCoins: 200, Target: 10},
	{ID: "all_synergies", Name: "Synergy Sage", Description: "Activate all 10 synergies (lifetime)", Category: AchCatProgression, RewardType: AchRewardTitle, RewardValue: "Synergy Sage", RewardCoins: 150, Target: 10},

	// ─── Domination (5) ───
	{ID: "first_hegemony", Name: "First Hegemony", Description: "Be part of a nation that achieves hegemony", Category: AchCatDomination, RewardType: AchRewardTitle, RewardValue: "Hegemonic", RewardCoins: 100, Target: 1},
	{ID: "sovereignty_3", Name: "Sovereign Veteran", Description: "Participate in 3 sovereignty achievements", Category: AchCatDomination, RewardType: AchRewardBadge, RewardValue: "sovereign_badge", RewardCoins: 75, Target: 3},
	{ID: "domination_10", Name: "Nation Builder", Description: "Contribute to 10 domination victories", Category: AchCatDomination, RewardType: AchRewardTitle, RewardValue: "Nation Builder", RewardCoins: 50, Target: 10},
	{ID: "war_victory", Name: "Victor", Description: "Win a war", Category: AchCatDomination, RewardType: AchRewardEmoji, RewardValue: "sword_cross", RewardCoins: 40, Target: 1},
	{ID: "war_veteran", Name: "War Veteran", Description: "Participate in 5 wars", Category: AchCatDomination, RewardType: AchRewardBadge, RewardValue: "war_vet_badge", RewardCoins: 60, Target: 5},

	// ─── Social (4) ───
	{ID: "epochs_100", Name: "Dedicated", Description: "Complete 100 epochs", Category: AchCatSocial, RewardType: AchRewardBadge, RewardValue: "dedication_badge", RewardCoins: 30, Target: 100},
	{ID: "epochs_500", Name: "Devoted", Description: "Complete 500 epochs", Category: AchCatSocial, RewardType: AchRewardTitle, RewardValue: "Devoted", RewardCoins: 75, Target: 500},
	{ID: "mvp_10", Name: "Star Player", Description: "Earn MVP 10 times", Category: AchCatSocial, RewardType: AchRewardEmoji, RewardValue: "star_sparkle", RewardCoins: 50, Target: 10},
	{ID: "mvp_50", Name: "Hall of Fame", Description: "Earn MVP 50 times", Category: AchCatSocial, RewardType: AchRewardTitle, RewardValue: "Hall of Famer", RewardCoins: 150, Target: 50},

	// ─── Mastery (3) ───
	{ID: "challenges_30", Name: "Challenge Accepted", Description: "Complete 30 daily challenges", Category: AchCatMastery, RewardType: AchRewardBadge, RewardValue: "challenger_badge", RewardCoins: 40, Target: 30},
	{ID: "challenges_100", Name: "Challenge Seeker", Description: "Complete 100 daily challenges", Category: AchCatMastery, RewardType: AchRewardTitle, RewardValue: "Challenge Seeker", RewardCoins: 100, Target: 100},
	{ID: "top_three_50", Name: "Consistent", Description: "Finish top 3 in 50 epochs", Category: AchCatMastery, RewardType: AchRewardTitle, RewardValue: "The Consistent", RewardCoins: 80, Target: 50},

	// ─── Special (3) ───
	{ID: "first_epoch", Name: "Welcome to War", Description: "Complete your first epoch", Category: AchCatSpecial, RewardType: AchRewardBadge, RewardValue: "welcome_badge", RewardCoins: 5, Target: 1},
	{ID: "play_24h", Name: "No Sleep", Description: "Accumulate 24 hours of play time", Category: AchCatSpecial, RewardType: AchRewardTitle, RewardValue: "Insomniac", RewardCoins: 100, Hidden: true, Target: 1440},
	{ID: "capture_all_3", Name: "Full Control", Description: "Capture all 3 strategic points in one epoch", Category: AchCatSpecial, RewardType: AchRewardEmoji, RewardValue: "flag_gold", RewardCoins: 60, Hidden: true, Target: 3},
}

// GetAchievementDef returns the definition for an achievement ID.
func GetAchievementDef(id AchievementID) *AchievementDef {
	for i := range AllAchievements {
		if AllAchievements[i].ID == id {
			return &AllAchievements[i]
		}
	}
	return nil
}

// ============================================================
// Player Achievement State
// ============================================================

// PlayerAchievement tracks a player's progress on a single achievement.
type PlayerAchievement struct {
	ID         AchievementID `json:"id"`
	Progress   int           `json:"progress"`
	Unlocked   bool          `json:"unlocked"`
	UnlockedAt time.Time     `json:"unlockedAt,omitempty"`
}

// PlayerAchievementState holds all achievement data for a player.
type PlayerAchievementState struct {
	PlayerID     string                           `json:"playerId"`
	Achievements map[AchievementID]*PlayerAchievement `json:"achievements"`

	// Cumulative trackers (used across sessions)
	TotalKills         int     `json:"totalKills"`
	TotalAssists       int     `json:"totalAssists"`
	TotalEpochs        int     `json:"totalEpochs"`
	TotalMVPs          int     `json:"totalMvps"`
	TotalTopThree      int     `json:"totalTopThree"`
	TotalChallenges    int     `json:"totalChallenges"`
	TotalDominations   int     `json:"totalDominations"`
	TotalSovereignties int     `json:"totalSovereignties"`
	TotalWars          int     `json:"totalWars"`
	TotalWarWins       int     `json:"totalWarWins"`
	TotalPlayTimeMin   float64 `json:"totalPlayTimeMin"`
	MaxKillStreak      int     `json:"maxKillStreak"`
	UniqueWeaponsLv5   map[string]bool `json:"uniqueWeaponsLv5"`
	UniqueSynergies    map[string]bool `json:"uniqueSynergies"`
}

// ============================================================
// AchievementProgress input
// ============================================================

// AchievementEpochData contains data from an epoch for achievement checking.
type AchievementEpochData struct {
	PlayerID        string
	Kills           int
	Deaths          int
	Assists         int
	KillStreak      int
	Level           int
	SurvivalMinutes float64
	CapturePoints   int
	IsMVP           bool
	Rank            int
	TotalPlayers    int
	AccountLevel    int
	WeaponsAtLv5    []string // weapon type names at Lv5
	ActiveSynergies []string // synergy type names
	InWarPhase      bool
	ZeroDeathsInWar bool
}

// ============================================================
// AchievementManager
// ============================================================

// AchievementUnlockEvent is emitted when an achievement is unlocked.
type AchievementUnlockEvent struct {
	PlayerID    string        `json:"playerId"`
	Achievement AchievementDef `json:"achievement"`
	Timestamp   int64         `json:"timestamp"`
}

// AchievementManager manages achievements for all players.
type AchievementManager struct {
	mu      sync.RWMutex
	players map[string]*PlayerAchievementState

	// Callback for unlocks (triggers achievements_update S→C)
	OnUnlock func(event AchievementUnlockEvent)

	// Reference to account level manager for coin rewards
	accountLevelMgr *AccountLevelManager
}

// NewAchievementManager creates a new achievement manager.
func NewAchievementManager(alm *AccountLevelManager) *AchievementManager {
	return &AchievementManager{
		players:         make(map[string]*PlayerAchievementState),
		accountLevelMgr: alm,
	}
}

// getOrCreateState returns (or creates) the achievement state for a player.
func (am *AchievementManager) getOrCreateState(playerID string) *PlayerAchievementState {
	state, ok := am.players[playerID]
	if ok {
		return state
	}

	state = &PlayerAchievementState{
		PlayerID:       playerID,
		Achievements:   make(map[AchievementID]*PlayerAchievement),
		UniqueWeaponsLv5: make(map[string]bool),
		UniqueSynergies:  make(map[string]bool),
	}

	// Initialize all achievements
	for _, def := range AllAchievements {
		state.Achievements[def.ID] = &PlayerAchievement{
			ID: def.ID,
		}
	}

	am.players[playerID] = state
	return state
}

// ProcessEpochData checks and updates achievements based on epoch results.
// Returns list of newly unlocked achievement IDs.
func (am *AchievementManager) ProcessEpochData(data *AchievementEpochData) []AchievementID {
	am.mu.Lock()
	defer am.mu.Unlock()

	state := am.getOrCreateState(data.PlayerID)

	// Update cumulative stats
	state.TotalKills += data.Kills
	state.TotalAssists += data.Assists
	state.TotalEpochs++
	state.TotalPlayTimeMin += data.SurvivalMinutes
	if data.IsMVP {
		state.TotalMVPs++
	}
	if data.Rank <= 3 && data.TotalPlayers > 3 {
		state.TotalTopThree++
	}
	if data.KillStreak > state.MaxKillStreak {
		state.MaxKillStreak = data.KillStreak
	}
	for _, w := range data.WeaponsAtLv5 {
		state.UniqueWeaponsLv5[w] = true
	}
	for _, s := range data.ActiveSynergies {
		state.UniqueSynergies[s] = true
	}

	// Check all achievements
	var unlocked []AchievementID

	checkAndUnlock := func(id AchievementID, currentValue int) {
		ach := state.Achievements[id]
		if ach == nil || ach.Unlocked {
			return
		}
		def := GetAchievementDef(id)
		if def == nil {
			return
		}
		ach.Progress = currentValue
		if currentValue >= def.Target {
			ach.Unlocked = true
			ach.UnlockedAt = time.Now()
			unlocked = append(unlocked, id)

			// Award coins
			if def.RewardCoins > 0 && am.accountLevelMgr != nil {
				am.accountLevelMgr.AddCosmeticCoins(data.PlayerID, def.RewardCoins)
			}

			slog.Info("achievement unlocked",
				"playerId", data.PlayerID,
				"achievement", def.Name,
				"id", def.ID,
			)

			// Emit unlock event
			if am.OnUnlock != nil {
				am.OnUnlock(AchievementUnlockEvent{
					PlayerID:    data.PlayerID,
					Achievement: *def,
					Timestamp:   time.Now().UnixMilli(),
				})
			}
		}
	}

	// ─── Combat achievements ───
	checkAndUnlock("first_kill", state.TotalKills)
	checkAndUnlock("kill_100", state.TotalKills)
	checkAndUnlock("kill_500", state.TotalKills)
	checkAndUnlock("kill_1000", state.TotalKills)
	checkAndUnlock("kill_streak_10", data.KillStreak) // per-epoch max
	checkAndUnlock("kill_streak_20", data.KillStreak)
	checkAndUnlock("assists_50", state.TotalAssists)
	if data.ZeroDeathsInWar && data.InWarPhase {
		checkAndUnlock("zero_deaths", 1)
	}

	// ─── Progression achievements ───
	checkAndUnlock("level_10", data.AccountLevel)
	checkAndUnlock("level_25", data.AccountLevel)
	checkAndUnlock("level_50", data.AccountLevel)
	checkAndUnlock("level_100", data.AccountLevel)
	checkAndUnlock("max_match_level", data.Level)
	checkAndUnlock("all_weapons_lv5", len(state.UniqueWeaponsLv5))
	checkAndUnlock("all_synergies", len(state.UniqueSynergies))

	// ─── Domination achievements (updated via RecordDomination* methods) ───
	checkAndUnlock("first_hegemony", state.TotalSovereignties) // proxy: updated externally
	checkAndUnlock("sovereignty_3", state.TotalSovereignties)
	checkAndUnlock("domination_10", state.TotalDominations)
	checkAndUnlock("war_victory", state.TotalWarWins)
	checkAndUnlock("war_veteran", state.TotalWars)

	// ─── Social achievements ───
	checkAndUnlock("epochs_100", state.TotalEpochs)
	checkAndUnlock("epochs_500", state.TotalEpochs)
	checkAndUnlock("mvp_10", state.TotalMVPs)
	checkAndUnlock("mvp_50", state.TotalMVPs)

	// ─── Mastery achievements ───
	checkAndUnlock("challenges_30", state.TotalChallenges)
	checkAndUnlock("challenges_100", state.TotalChallenges)
	checkAndUnlock("top_three_50", state.TotalTopThree)

	// ─── Special achievements ───
	checkAndUnlock("first_epoch", state.TotalEpochs)
	checkAndUnlock("play_24h", int(state.TotalPlayTimeMin))
	checkAndUnlock("capture_all_3", data.CapturePoints)

	return unlocked
}

// RecordDominationVictory records a domination win for a player.
func (am *AchievementManager) RecordDominationVictory(playerID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	state := am.getOrCreateState(playerID)
	state.TotalDominations++
}

// RecordSovereignty records a sovereignty achievement for a player.
func (am *AchievementManager) RecordSovereignty(playerID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	state := am.getOrCreateState(playerID)
	state.TotalSovereignties++
}

// RecordHegemony records a hegemony achievement for a player.
func (am *AchievementManager) RecordHegemony(playerID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	state := am.getOrCreateState(playerID)
	// Hegemony counts as a sovereignty too
	state.TotalSovereignties++
}

// RecordWarParticipation records war participation for a player.
func (am *AchievementManager) RecordWarParticipation(playerID string, isWin bool) {
	am.mu.Lock()
	defer am.mu.Unlock()
	state := am.getOrCreateState(playerID)
	state.TotalWars++
	if isWin {
		state.TotalWarWins++
	}
}

// RecordChallengeCompleted increments the challenge completion counter.
func (am *AchievementManager) RecordChallengeCompleted(playerID string) {
	am.mu.Lock()
	defer am.mu.Unlock()
	state := am.getOrCreateState(playerID)
	state.TotalChallenges++
}

// ============================================================
// Achievement Snapshot (for client)
// ============================================================

// AchievementSnapshot is a single achievement entry for the client.
type AchievementSnapshot struct {
	ID          AchievementID `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Category    string        `json:"category"`
	RewardType  string        `json:"rewardType"`
	RewardValue string        `json:"rewardValue"`
	Target      int           `json:"target"`
	Progress    int           `json:"progress"`
	Unlocked    bool          `json:"unlocked"`
	UnlockedAt  int64         `json:"unlockedAt,omitempty"`
	Hidden      bool          `json:"hidden"`
}

// AchievementsUpdatePayload is the S→C event payload for achievements_update.
type AchievementsUpdatePayload struct {
	PlayerID     string                `json:"playerId"`
	Achievements []AchievementSnapshot `json:"achievements"`
	UnlockedCount int                  `json:"unlockedCount"`
	TotalCount   int                   `json:"totalCount"`
	NewUnlocks   []AchievementSnapshot `json:"newUnlocks,omitempty"`
}

// GetSnapshot returns the full achievement snapshot for a player.
func (am *AchievementManager) GetSnapshot(playerID string) *AchievementsUpdatePayload {
	am.mu.RLock()
	defer am.mu.RUnlock()

	state, ok := am.players[playerID]
	if !ok {
		// Return empty state
		return &AchievementsUpdatePayload{
			PlayerID:   playerID,
			TotalCount: len(AllAchievements),
		}
	}

	payload := &AchievementsUpdatePayload{
		PlayerID:   playerID,
		TotalCount: len(AllAchievements),
	}

	for _, def := range AllAchievements {
		ach, ok := state.Achievements[def.ID]
		snap := AchievementSnapshot{
			ID:          def.ID,
			Name:        def.Name,
			Description: def.Description,
			Category:    def.Category,
			RewardType:  def.RewardType,
			RewardValue: def.RewardValue,
			Target:      def.Target,
			Hidden:      def.Hidden,
		}

		if ok {
			snap.Progress = ach.Progress
			snap.Unlocked = ach.Unlocked
			if ach.Unlocked {
				snap.UnlockedAt = ach.UnlockedAt.UnixMilli()
				payload.UnlockedCount++
			}
		}

		// Hide details of hidden achievements until unlocked
		if def.Hidden && !snap.Unlocked {
			snap.Name = "???"
			snap.Description = "Hidden achievement"
		}

		payload.Achievements = append(payload.Achievements, snap)
	}

	return payload
}

// GetNewUnlocksSnapshot returns only the newly unlocked achievements.
func (am *AchievementManager) GetNewUnlocksSnapshot(playerID string, achievementIDs []AchievementID) []AchievementSnapshot {
	am.mu.RLock()
	defer am.mu.RUnlock()

	var result []AchievementSnapshot
	for _, id := range achievementIDs {
		def := GetAchievementDef(id)
		if def == nil {
			continue
		}
		result = append(result, AchievementSnapshot{
			ID:          def.ID,
			Name:        def.Name,
			Description: def.Description,
			Category:    def.Category,
			RewardType:  def.RewardType,
			RewardValue: def.RewardValue,
			Target:      def.Target,
			Unlocked:    true,
			UnlockedAt:  time.Now().UnixMilli(),
		})
	}

	return result
}

// GetUnlockedCount returns the number of unlocked achievements for a player.
func (am *AchievementManager) GetUnlockedCount(playerID string) int {
	am.mu.RLock()
	defer am.mu.RUnlock()

	state, ok := am.players[playerID]
	if !ok {
		return 0
	}

	count := 0
	for _, ach := range state.Achievements {
		if ach.Unlocked {
			count++
		}
	}
	return count
}

// GetCompletionPercentage returns the achievement completion percentage.
func (am *AchievementManager) GetCompletionPercentage(playerID string) float64 {
	total := len(AllAchievements)
	if total == 0 {
		return 0
	}
	unlocked := am.GetUnlockedCount(playerID)
	return float64(unlocked) / float64(total) * 100.0
}

// FormatAchievementUnlock returns a human-readable unlock message.
func FormatAchievementUnlock(def *AchievementDef) string {
	reward := ""
	switch def.RewardType {
	case AchRewardTitle:
		reward = fmt.Sprintf("Title: %s", def.RewardValue)
	case AchRewardEmoji:
		reward = fmt.Sprintf("Emoji: %s", def.RewardValue)
	case AchRewardBadge:
		reward = fmt.Sprintf("Badge: %s", def.RewardValue)
	}
	if def.RewardCoins > 0 {
		if reward != "" {
			reward += fmt.Sprintf(" + %d Coins", def.RewardCoins)
		} else {
			reward = fmt.Sprintf("%d Coins", def.RewardCoins)
		}
	}
	return fmt.Sprintf("Achievement Unlocked: %s — %s [%s]", def.Name, def.Description, reward)
}
