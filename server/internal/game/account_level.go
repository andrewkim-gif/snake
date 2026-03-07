package game

import (
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 9 — S39: Account Level System
// Match results → account XP (epoch performance-based)
// Account level 1→∞ (in-memory, session-based — future DB)
// Level-up rewards: cosmetic coins, title unlocks
// Profile displays account level
// ============================================================

// Account XP source weights (from epoch performance)
const (
	// AccountXPPerKill is the account XP earned per kill in an epoch.
	AccountXPPerKill = 5

	// AccountXPPerAssist is the account XP earned per assist.
	AccountXPPerAssist = 2

	// AccountXPPerLevel is the account XP earned per in-match level reached.
	AccountXPPerLevel = 3

	// AccountXPPerSurvivalMin is the account XP earned per minute survived.
	AccountXPPerSurvivalMin = 1

	// AccountXPPerObjective is the account XP earned per objective point.
	AccountXPPerObjective = 2

	// AccountXPParticipation is the flat XP earned for completing an epoch.
	AccountXPParticipation = 10

	// AccountXPMVPBonus is the bonus XP for being the epoch MVP.
	AccountXPMVPBonus = 25

	// AccountXPTopThreeBonus is the bonus XP for placing top 3 in an epoch.
	AccountXPTopThreeBonus = 15

	// CosmeticCoinsPerLevel is the number of cosmetic coins earned per level-up.
	CosmeticCoinsPerLevel = 10

	// CosmeticCoinsBonusEvery5 is the bonus coins every 5 levels.
	CosmeticCoinsBonusEvery5 = 25

	// MaxTitleUnlocks is the maximum number of title tiers.
	MaxTitleUnlocks = 20
)

// ============================================================
// Account XP Curve: level N requires N*50 + (N-1)*25 XP
// This gives a smooth, ever-increasing curve without a hard cap.
// Level 1→2: 75 XP, Level 2→3: 125 XP, Level 10→11: 725 XP
// ============================================================

// AccountXPForLevel returns the XP required to advance from `level` to `level+1`.
func AccountXPForLevel(level int) int {
	if level < 1 {
		return 75
	}
	return level*50 + (level-1)*25 + 25
}

// AccountCumulativeXP returns total XP from level 1 to reach `level`.
func AccountCumulativeXP(level int) int {
	if level <= 1 {
		return 0
	}
	total := 0
	for i := 1; i < level; i++ {
		total += AccountXPForLevel(i)
	}
	return total
}

// ============================================================
// Title Definitions (unlocked at milestone levels)
// ============================================================

// AccountTitle represents a title earned at a certain account level.
type AccountTitle struct {
	Level       int    `json:"level"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

// AccountTitles defines all unlockable titles at milestone levels.
var AccountTitles = []AccountTitle{
	{Level: 1, Title: "Recruit", Description: "Welcome to the battlefield"},
	{Level: 5, Title: "Soldier", Description: "Proven in combat"},
	{Level: 10, Title: "Veteran", Description: "Battle-hardened warrior"},
	{Level: 15, Title: "Elite", Description: "Top-tier combatant"},
	{Level: 20, Title: "Commander", Description: "Born to lead"},
	{Level: 25, Title: "Strategist", Description: "Master of tactics"},
	{Level: 30, Title: "Warlord", Description: "Feared across nations"},
	{Level: 40, Title: "Conqueror", Description: "Nations tremble at your name"},
	{Level: 50, Title: "Overlord", Description: "Supreme ruler of the arena"},
	{Level: 60, Title: "Titan", Description: "A legend among warriors"},
	{Level: 75, Title: "Mythic", Description: "Stories are told of your deeds"},
	{Level: 100, Title: "Eternal", Description: "Beyond mortal comprehension"},
	{Level: 125, Title: "Ascendant", Description: "Transcended the battlefield"},
	{Level: 150, Title: "Celestial", Description: "Among the stars of war"},
	{Level: 200, Title: "Primordial", Description: "Origin of all conflict"},
	{Level: 250, Title: "Omega", Description: "The end and the beginning"},
	{Level: 300, Title: "Infinite", Description: "Without limit or measure"},
	{Level: 400, Title: "Singularity", Description: "A point of infinite power"},
	{Level: 500, Title: "Architect", Description: "Shapes the world itself"},
	{Level: 1000, Title: "God of War", Description: "The ultimate being"},
}

// GetTitleForLevel returns the highest title unlocked at the given level.
func GetTitleForLevel(level int) *AccountTitle {
	var best *AccountTitle
	for i := range AccountTitles {
		if AccountTitles[i].Level <= level {
			best = &AccountTitles[i]
		}
	}
	return best
}

// GetNewTitlesForLevel returns titles newly unlocked at exactly this level.
func GetNewTitlesForLevel(level int) []AccountTitle {
	var titles []AccountTitle
	for _, t := range AccountTitles {
		if t.Level == level {
			titles = append(titles, t)
		}
	}
	return titles
}

// ============================================================
// Account Profile
// ============================================================

// AccountProfile holds a player's account-level progression data.
type AccountProfile struct {
	PlayerID       string    `json:"playerId"`
	PlayerName     string    `json:"playerName"`
	AccountLevel   int       `json:"accountLevel"`
	AccountXP      int       `json:"accountXP"`
	AccountXPToNext int      `json:"accountXpToNext"`
	TotalAccountXP int       `json:"totalAccountXp"`
	CosmeticCoins  int       `json:"cosmeticCoins"`
	CurrentTitle   string    `json:"currentTitle"`
	UnlockedTitles []string  `json:"unlockedTitles"`
	SelectedTitle  string    `json:"selectedTitle,omitempty"`

	// Cumulative stats
	TotalEpochs    int       `json:"totalEpochs"`
	TotalKills     int       `json:"totalKills"`
	TotalDeaths    int       `json:"totalDeaths"`
	TotalAssists   int       `json:"totalAssists"`
	TotalMVPs      int       `json:"totalMvps"`
	TopThreeCount  int       `json:"topThreeCount"`
	BestEpochScore int       `json:"bestEpochScore"`
	TotalPlayTime  float64   `json:"totalPlayTimeMin"` // minutes

	CreatedAt      time.Time `json:"createdAt"`
	LastActiveAt   time.Time `json:"lastActiveAt"`
}

// ============================================================
// Epoch Result (input to account XP calculation)
// ============================================================

// EpochAccountResult holds the summarized result of an epoch for account XP.
type EpochAccountResult struct {
	PlayerID        string  `json:"playerId"`
	PlayerName      string  `json:"playerName"`
	EpochNumber     int     `json:"epochNumber"`
	CountryCode     string  `json:"countryCode"`
	Kills           int     `json:"kills"`
	Deaths          int     `json:"deaths"`
	Assists         int     `json:"assists"`
	Level           int     `json:"level"`
	SurvivalMinutes float64 `json:"survivalMinutes"`
	ObjectivePoints int     `json:"objectivePoints"`
	EpochScore      int     `json:"epochScore"`
	Rank            int     `json:"rank"`
	TotalPlayers    int     `json:"totalPlayers"`
	IsMVP           bool    `json:"isMvp"`
	IsBot           bool    `json:"isBot"`
}

// CalcAccountXPFromEpoch calculates account XP earned from an epoch result.
func CalcAccountXPFromEpoch(result *EpochAccountResult) int {
	if result.IsBot {
		return 0
	}

	xp := AccountXPParticipation
	xp += result.Kills * AccountXPPerKill
	xp += result.Assists * AccountXPPerAssist
	xp += result.Level * AccountXPPerLevel
	xp += int(math.Floor(result.SurvivalMinutes)) * AccountXPPerSurvivalMin
	xp += result.ObjectivePoints * AccountXPPerObjective

	// Bonus for MVP
	if result.IsMVP {
		xp += AccountXPMVPBonus
	}

	// Bonus for top 3
	if result.Rank <= 3 && result.TotalPlayers > 3 {
		xp += AccountXPTopThreeBonus
	}

	// Minimum 10 XP per epoch
	if xp < 10 {
		xp = 10
	}

	return xp
}

// ============================================================
// Account Level-Up Result
// ============================================================

// AccountLevelUpResult holds the rewards from a level-up.
type AccountLevelUpResult struct {
	NewLevel       int      `json:"newLevel"`
	CosmeticCoins  int      `json:"cosmeticCoins"`
	NewTitles      []string `json:"newTitles,omitempty"`
	CurrentTitle   string   `json:"currentTitle"`
}

// ============================================================
// AccountLevelManager — manages all player account levels in-memory
// ============================================================

// AccountLevelManager manages account-level progression for all players.
type AccountLevelManager struct {
	mu       sync.RWMutex
	profiles map[string]*AccountProfile
}

// NewAccountLevelManager creates a new account level manager.
func NewAccountLevelManager() *AccountLevelManager {
	return &AccountLevelManager{
		profiles: make(map[string]*AccountProfile),
	}
}

// GetProfile returns the account profile for a player (creates if not found).
func (alm *AccountLevelManager) GetProfile(playerID, playerName string) *AccountProfile {
	alm.mu.RLock()
	prof, ok := alm.profiles[playerID]
	alm.mu.RUnlock()

	if ok {
		return prof
	}

	// Create new profile
	now := time.Now()
	prof = &AccountProfile{
		PlayerID:       playerID,
		PlayerName:     playerName,
		AccountLevel:   1,
		AccountXP:      0,
		AccountXPToNext: AccountXPForLevel(1),
		TotalAccountXP: 0,
		CosmeticCoins:  0,
		CurrentTitle:   "Recruit",
		UnlockedTitles: []string{"Recruit"},
		CreatedAt:      now,
		LastActiveAt:   now,
	}

	alm.mu.Lock()
	alm.profiles[playerID] = prof
	alm.mu.Unlock()

	return prof
}

// GetProfileReadOnly returns a copy of the profile (thread-safe read).
func (alm *AccountLevelManager) GetProfileReadOnly(playerID string) *AccountProfile {
	alm.mu.RLock()
	defer alm.mu.RUnlock()

	prof, ok := alm.profiles[playerID]
	if !ok {
		return nil
	}
	copy := *prof
	copy.UnlockedTitles = make([]string, len(prof.UnlockedTitles))
	for i, t := range prof.UnlockedTitles {
		copy.UnlockedTitles[i] = t
	}
	return &copy
}

// ProcessEpochResult awards account XP based on epoch performance.
// Returns the XP earned and any level-up results.
func (alm *AccountLevelManager) ProcessEpochResult(result *EpochAccountResult) (int, []AccountLevelUpResult) {
	if result.IsBot {
		return 0, nil
	}

	xpEarned := CalcAccountXPFromEpoch(result)
	prof := alm.GetProfile(result.PlayerID, result.PlayerName)

	alm.mu.Lock()
	defer alm.mu.Unlock()

	prof.LastActiveAt = time.Now()

	// Update cumulative stats
	prof.TotalEpochs++
	prof.TotalKills += result.Kills
	prof.TotalDeaths += result.Deaths
	prof.TotalAssists += result.Assists
	prof.TotalPlayTime += result.SurvivalMinutes
	if result.IsMVP {
		prof.TotalMVPs++
	}
	if result.Rank <= 3 && result.TotalPlayers > 3 {
		prof.TopThreeCount++
	}
	if result.EpochScore > prof.BestEpochScore {
		prof.BestEpochScore = result.EpochScore
	}

	// Add XP
	prof.AccountXP += xpEarned
	prof.TotalAccountXP += xpEarned

	// Check for level-ups (can be multiple)
	var levelUps []AccountLevelUpResult
	for prof.AccountXP >= prof.AccountXPToNext && prof.AccountXPToNext > 0 {
		prof.AccountXP -= prof.AccountXPToNext
		prof.AccountLevel++
		prof.AccountXPToNext = AccountXPForLevel(prof.AccountLevel)

		// Level-up rewards
		coins := CosmeticCoinsPerLevel
		if prof.AccountLevel%5 == 0 {
			coins += CosmeticCoinsBonusEvery5
		}
		prof.CosmeticCoins += coins

		// Check for new title unlocks
		var newTitleNames []string
		newTitles := GetNewTitlesForLevel(prof.AccountLevel)
		for _, t := range newTitles {
			prof.UnlockedTitles = append(prof.UnlockedTitles, t.Title)
			prof.CurrentTitle = t.Title
			newTitleNames = append(newTitleNames, t.Title)
		}

		levelUp := AccountLevelUpResult{
			NewLevel:      prof.AccountLevel,
			CosmeticCoins: coins,
			NewTitles:     newTitleNames,
			CurrentTitle:  prof.CurrentTitle,
		}
		levelUps = append(levelUps, levelUp)

		slog.Info("account level up",
			"playerId", prof.PlayerID,
			"newLevel", prof.AccountLevel,
			"coins", coins,
			"titles", len(newTitleNames),
		)
	}

	return xpEarned, levelUps
}

// SelectTitle allows a player to select a previously unlocked title.
func (alm *AccountLevelManager) SelectTitle(playerID, title string) error {
	alm.mu.Lock()
	defer alm.mu.Unlock()

	prof, ok := alm.profiles[playerID]
	if !ok {
		return fmt.Errorf("account not found: %s", playerID)
	}

	// Check title is unlocked
	for _, t := range prof.UnlockedTitles {
		if t == title {
			prof.SelectedTitle = title
			return nil
		}
	}

	return fmt.Errorf("title not unlocked: %s", title)
}

// AddCosmeticCoins adds coins to a player's account (for external rewards).
func (alm *AccountLevelManager) AddCosmeticCoins(playerID string, coins int) {
	alm.mu.Lock()
	defer alm.mu.Unlock()

	if prof, ok := alm.profiles[playerID]; ok {
		prof.CosmeticCoins += coins
	}
}

// SpendCosmeticCoins deducts coins from a player's account.
// Returns false if insufficient balance.
func (alm *AccountLevelManager) SpendCosmeticCoins(playerID string, coins int) bool {
	alm.mu.Lock()
	defer alm.mu.Unlock()

	prof, ok := alm.profiles[playerID]
	if !ok || prof.CosmeticCoins < coins {
		return false
	}
	prof.CosmeticCoins -= coins
	return true
}

// GetLeaderboard returns the top N players by account level.
func (alm *AccountLevelManager) GetLeaderboard(n int) []AccountProfile {
	alm.mu.RLock()
	defer alm.mu.RUnlock()

	// Collect all profiles
	all := make([]AccountProfile, 0, len(alm.profiles))
	for _, prof := range alm.profiles {
		all = append(all, *prof)
	}

	// Sort by level descending, then total XP
	for i := 0; i < len(all); i++ {
		for j := i + 1; j < len(all); j++ {
			if all[j].AccountLevel > all[i].AccountLevel ||
				(all[j].AccountLevel == all[i].AccountLevel && all[j].TotalAccountXP > all[i].TotalAccountXP) {
				all[i], all[j] = all[j], all[i]
			}
		}
	}

	if n > len(all) {
		n = len(all)
	}
	return all[:n]
}

// GetPlayerCount returns the total number of tracked players.
func (alm *AccountLevelManager) GetPlayerCount() int {
	alm.mu.RLock()
	defer alm.mu.RUnlock()
	return len(alm.profiles)
}

// ============================================================
// Account Level Snapshot (for client serialization)
// ============================================================

// AccountLevelSnapshot is the client-facing account level data.
type AccountLevelSnapshot struct {
	AccountLevel    int      `json:"accountLevel"`
	AccountXP       int      `json:"accountXp"`
	AccountXPToNext int      `json:"accountXpToNext"`
	XPProgress      float64  `json:"xpProgress"` // 0.0~1.0
	CosmeticCoins   int      `json:"cosmeticCoins"`
	CurrentTitle    string   `json:"currentTitle"`
	SelectedTitle   string   `json:"selectedTitle,omitempty"`
	TotalEpochs     int      `json:"totalEpochs"`
	TotalKills      int      `json:"totalKills"`
	TotalMVPs       int      `json:"totalMvps"`
}

// GetSnapshot returns a client-facing snapshot for a player.
func (alm *AccountLevelManager) GetSnapshot(playerID string) *AccountLevelSnapshot {
	alm.mu.RLock()
	defer alm.mu.RUnlock()

	prof, ok := alm.profiles[playerID]
	if !ok {
		return nil
	}

	progress := 0.0
	if prof.AccountXPToNext > 0 {
		progress = float64(prof.AccountXP) / float64(prof.AccountXPToNext)
	}

	title := prof.CurrentTitle
	if prof.SelectedTitle != "" {
		title = prof.SelectedTitle
	}

	return &AccountLevelSnapshot{
		AccountLevel:    prof.AccountLevel,
		AccountXP:       prof.AccountXP,
		AccountXPToNext: prof.AccountXPToNext,
		XPProgress:      progress,
		CosmeticCoins:   prof.CosmeticCoins,
		CurrentTitle:    title,
		SelectedTitle:   prof.SelectedTitle,
		TotalEpochs:     prof.TotalEpochs,
		TotalKills:      prof.TotalKills,
		TotalMVPs:       prof.TotalMVPs,
	}
}
