package game

import (
	"math"
	"time"
)

// ============================================================
// Arena Player Profile System — Phase 6 (v18)
// ============================================================
//
// Persistent player profile tracking:
//   - Profile level & XP
//   - Lifetime stats (kills, deaths, wins, etc.)
//   - Preferred character & best builds
//   - Achievement tracking
//   - Character unlock state

// ── Profile Constants ───────────────────────────────────────

const (
	// Profile level XP formula: baseXP + level * growthXP
	ARProfileBaseXP   = 100.0
	ARProfileGrowthXP = 50.0
	ARProfileMaxLevel = 999

	// Profile level rewards
	ARProfileTokensPerLevel    = 100.0 // country tokens per level-up
	ARProfileSkinEvery         = 5     // skin/effect reward every 5 levels
	ARProfileCharUnlockEvery   = 10    // character/weapon unlock every 10 levels
)

// ── Profile Types ───────────────────────────────────────────

// ARPlayerProfile is the persistent player profile.
type ARPlayerProfile struct {
	PlayerID   string    `json:"playerId"`
	Username   string    `json:"username"`
	CreatedAt  time.Time `json:"createdAt"`

	// Profile progression
	ProfileLevel int     `json:"profileLevel"`
	ProfileXP    float64 `json:"profileXp"`
	ProfileXPMax float64 `json:"profileXpMax"` // XP needed for next level

	// Lifetime stats
	Stats ARLifetimeStats `json:"stats"`

	// Character preferences
	PreferredChar ARCharacterType `json:"preferredChar"`
	MostPlayedMap string          `json:"mostPlayedMap"` // country code

	// Unlocks
	UnlockedChars   []ARCharacterType `json:"unlockedChars"`
	UnlockedWeapons []ARWeaponID      `json:"unlockedWeapons"`
	UnlockedSkins   []string          `json:"unlockedSkins"`
	UnlockedEmotes  []string          `json:"unlockedEmotes"`

	// Achievements
	Achievements []ARAchievement `json:"achievements"`

	// Permanent boosts (from token sink)
	PermanentBoosts map[ARTomeID]int `json:"permanentBoosts"`

	// Token balances (off-chain tracking)
	AWWBalance      float64            `json:"awwBalance"`
	CountryBalances map[string]float64 `json:"countryBalances"` // country code → balance

	// Season data
	CurrentSeasonID string `json:"currentSeasonId"`
	SeasonPassLevel int    `json:"seasonPassLevel"`
	HasPremiumPass  bool   `json:"hasPremiumPass"`
}

// ARLifetimeStats tracks all-time player statistics.
type ARLifetimeStats struct {
	TotalBattles     int     `json:"totalBattles"`
	TotalWins        int     `json:"totalWins"`
	TotalKills       int     `json:"totalKills"`
	TotalPvPKills    int     `json:"totalPvpKills"`
	TotalDeaths      int     `json:"totalDeaths"`
	TotalEliteKills  int     `json:"totalEliteKills"`
	TotalBossKills   int     `json:"totalBossKills"`
	HighestLevel     int     `json:"highestLevel"`
	LongestSurvival  float64 `json:"longestSurvival"`  // seconds
	TotalSurvivalSec float64 `json:"totalSurvivalSec"`
	TotalXPEarned    float64 `json:"totalXpEarned"`
	BestRank         int     `json:"bestRank"`
	FactionWins      int     `json:"factionWins"`
	SovereigntyCaptures int `json:"sovereigntyCaptures"`
	SovereigntyDefends  int `json:"sovereigntyDefends"`
	UniqueCountries  int    `json:"uniqueCountries"`  // unique arenas visited
	SynergiesUnlocked int  `json:"synergiesUnlocked"`
	TomesCollected   int    `json:"tomesCollected"`

	// Per-character stats
	CharacterStats map[ARCharacterType]*ARCharacterStats `json:"characterStats"`
}

// ARCharacterStats tracks per-character performance.
type ARCharacterStats struct {
	CharType    ARCharacterType `json:"charType"`
	GamesPlayed int             `json:"gamesPlayed"`
	Wins        int             `json:"wins"`
	Kills       int             `json:"kills"`
	HighestLvl  int             `json:"highestLvl"`
	AvgSurvival float64         `json:"avgSurvival"` // average survival seconds
}

// ARAchievement represents an unlocked achievement.
type ARAchievement struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Desc       string    `json:"desc"`
	UnlockedAt time.Time `json:"unlockedAt"`
	Rarity     ARRarity  `json:"rarity"`
}

// ARAchievementDef defines an achievement with unlock condition.
type ARAchievementDef struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Desc     string   `json:"desc"`
	Rarity   ARRarity `json:"rarity"`
	Category string   `json:"category"` // combat, survival, build, pvp, explore
	// CheckFunc is evaluated against lifetime stats to determine unlock
}

// ── Profile Operations ──────────────────────────────────────

// NewPlayerProfile creates a new profile with defaults.
func NewPlayerProfile(playerID, username string) *ARPlayerProfile {
	return &ARPlayerProfile{
		PlayerID:     playerID,
		Username:     username,
		CreatedAt:    time.Now(),
		ProfileLevel: 1,
		ProfileXP:    0,
		ProfileXPMax: ProfileXPToNext(1),
		Stats: ARLifetimeStats{
			CharacterStats: make(map[ARCharacterType]*ARCharacterStats),
		},
		PreferredChar:   ARCharStriker,
		UnlockedChars:   []ARCharacterType{ARCharStriker, ARCharGuardian}, // 2 default chars
		UnlockedWeapons: []ARWeaponID{ARWeaponKatana, ARWeaponAegis},     // starter weapons
		UnlockedSkins:   []string{"default"},
		UnlockedEmotes:  []string{"wave"},
		Achievements:    make([]ARAchievement, 0),
		PermanentBoosts: make(map[ARTomeID]int),
		CountryBalances: make(map[string]float64),
	}
}

// ProfileXPToNext calculates XP needed to reach the next profile level.
func ProfileXPToNext(level int) float64 {
	return ARProfileBaseXP + float64(level)*ARProfileGrowthXP
}

// AddProfileXP adds XP to a profile and processes level-ups.
// Returns the number of levels gained.
func AddProfileXP(profile *ARPlayerProfile, xp float64) int {
	if xp <= 0 || profile.ProfileLevel >= ARProfileMaxLevel {
		return 0
	}

	profile.ProfileXP += xp
	levelsGained := 0

	for profile.ProfileXP >= profile.ProfileXPMax && profile.ProfileLevel < ARProfileMaxLevel {
		profile.ProfileXP -= profile.ProfileXPMax
		profile.ProfileLevel++
		levelsGained++
		profile.ProfileXPMax = ProfileXPToNext(profile.ProfileLevel)
	}

	return levelsGained
}

// UpdateProfileFromBattle updates profile stats after a battle.
func UpdateProfileFromBattle(profile *ARPlayerProfile, result *ARBattleResult) {
	s := &profile.Stats
	s.TotalBattles++
	s.TotalKills += result.PvEKills + result.PvEEliteKills + result.PvEMinibossKills
	s.TotalPvPKills += result.PvPKills
	s.TotalEliteKills += result.PvEEliteKills
	s.TotalSurvivalSec += result.SurvivalTimeSec
	s.TomesCollected += result.TonesCollected
	s.SynergiesUnlocked += result.SynergiesHit

	if result.FinalLevel > s.HighestLevel {
		s.HighestLevel = result.FinalLevel
	}
	if result.SurvivalTimeSec > s.LongestSurvival {
		s.LongestSurvival = result.SurvivalTimeSec
	}
	if result.Rank == 1 {
		s.TotalWins++
	}
	if s.BestRank == 0 || result.Rank < s.BestRank {
		s.BestRank = result.Rank
	}
	if result.FactionWon {
		s.FactionWins++
	}
	if result.BossContrib > 0 {
		s.TotalBossKills++
	}

	switch result.SovereigntyEvt {
	case "capture":
		s.SovereigntyCaptures++
	case "defend":
		s.SovereigntyDefends++
	}

	// Update per-character stats
	if s.CharacterStats == nil {
		s.CharacterStats = make(map[ARCharacterType]*ARCharacterStats)
	}
	// Use preferred char for now (actual char would come from battle data)
	charType := profile.PreferredChar
	cs, ok := s.CharacterStats[charType]
	if !ok {
		cs = &ARCharacterStats{CharType: charType}
		s.CharacterStats[charType] = cs
	}
	cs.GamesPlayed++
	cs.Kills += result.PvEKills + result.PvPKills
	if result.FinalLevel > cs.HighestLvl {
		cs.HighestLvl = result.FinalLevel
	}
	if result.Rank == 1 {
		cs.Wins++
	}
	// Running average survival
	cs.AvgSurvival = cs.AvgSurvival + (result.SurvivalTimeSec-cs.AvgSurvival)/float64(cs.GamesPlayed)

	// Determine preferred character (most played)
	maxPlayed := 0
	for ct, stat := range s.CharacterStats {
		if stat.GamesPlayed > maxPlayed {
			maxPlayed = stat.GamesPlayed
			profile.PreferredChar = ct
		}
	}
}

// ── Achievement Definitions ─────────────────────────────────

// AllAchievementDefs returns the full list of achievements.
func AllAchievementDefs() []ARAchievementDef {
	return achievementDefs
}

var achievementDefs = []ARAchievementDef{
	// Combat achievements
	{ID: "first_blood", Name: "First Blood", Desc: "Get your first kill", Rarity: ARRarityCommon, Category: "combat"},
	{ID: "centurion", Name: "Centurion", Desc: "Reach 100 lifetime kills", Rarity: ARRarityUncommon, Category: "combat"},
	{ID: "thousand_kills", Name: "Warlord", Desc: "Reach 1,000 lifetime kills", Rarity: ARRarityRare, Category: "combat"},
	{ID: "ten_thousand", Name: "Annihilator", Desc: "Reach 10,000 lifetime kills", Rarity: ARRarityEpic, Category: "combat"},
	{ID: "elite_hunter", Name: "Elite Hunter", Desc: "Kill 50 elite enemies", Rarity: ARRarityUncommon, Category: "combat"},
	{ID: "boss_slayer", Name: "Boss Slayer", Desc: "Contribute to 10 boss kills", Rarity: ARRarityRare, Category: "combat"},

	// Survival achievements
	{ID: "survivor", Name: "Survivor", Desc: "Survive a Standard Battle", Rarity: ARRarityCommon, Category: "survival"},
	{ID: "iron_will", Name: "Iron Will", Desc: "Survive 10 Standard Battles", Rarity: ARRarityUncommon, Category: "survival"},
	{ID: "undying", Name: "Undying", Desc: "Win 50 battles (#1 rank)", Rarity: ARRarityRare, Category: "survival"},
	{ID: "level_20", Name: "Powered Up", Desc: "Reach level 20 in a battle", Rarity: ARRarityUncommon, Category: "survival"},
	{ID: "level_50", Name: "Transcendent", Desc: "Reach level 50 in a battle", Rarity: ARRarityEpic, Category: "survival"},

	// Build achievements
	{ID: "tome_collector", Name: "Tome Collector", Desc: "Collect 100 tomes total", Rarity: ARRarityUncommon, Category: "build"},
	{ID: "synergy_master", Name: "Synergy Master", Desc: "Activate all 10 synergies", Rarity: ARRarityEpic, Category: "build"},
	{ID: "all_chars", Name: "Renaissance", Desc: "Play all 8 characters", Rarity: ARRarityRare, Category: "build"},

	// PvP achievements
	{ID: "pvp_first", Name: "Duelist", Desc: "Get a PvP kill", Rarity: ARRarityCommon, Category: "pvp"},
	{ID: "pvp_ace", Name: "PvP Ace", Desc: "Get 5 PvP kills in one battle", Rarity: ARRarityRare, Category: "pvp"},
	{ID: "pvp_centurion", Name: "PvP Centurion", Desc: "100 lifetime PvP kills", Rarity: ARRarityEpic, Category: "pvp"},
	{ID: "faction_champion", Name: "Faction Champion", Desc: "Win 25 faction battles", Rarity: ARRarityRare, Category: "pvp"},

	// Sovereignty achievements
	{ID: "conqueror", Name: "Conqueror", Desc: "Capture sovereignty once", Rarity: ARRarityRare, Category: "pvp"},
	{ID: "defender", Name: "Defender", Desc: "Defend sovereignty 5 times", Rarity: ARRarityRare, Category: "pvp"},
	{ID: "world_dominator", Name: "World Dominator", Desc: "Capture sovereignty in 10 countries", Rarity: ARRarityLegendary, Category: "pvp"},

	// Exploration achievements
	{ID: "explorer", Name: "Explorer", Desc: "Battle in 10 different countries", Rarity: ARRarityUncommon, Category: "explore"},
	{ID: "globetrotter", Name: "Globetrotter", Desc: "Battle in all 6 terrain themes", Rarity: ARRarityRare, Category: "explore"},
	{ID: "veteran", Name: "Veteran", Desc: "Complete 100 battles", Rarity: ARRarityRare, Category: "explore"},
	{ID: "legend", Name: "Legend", Desc: "Reach profile level 100", Rarity: ARRarityLegendary, Category: "explore"},
}

// CheckAchievements evaluates all achievement conditions against profile stats.
// Returns newly unlocked achievements.
func CheckAchievements(profile *ARPlayerProfile, result *ARBattleResult) []ARAchievement {
	unlocked := profile.achievementSet()
	var newAchievements []ARAchievement
	s := &profile.Stats
	now := time.Now()

	// Helper to check and unlock
	tryUnlock := func(def ARAchievementDef) {
		if unlocked[def.ID] {
			return
		}
		newAchievements = append(newAchievements, ARAchievement{
			ID: def.ID, Name: def.Name, Desc: def.Desc,
			UnlockedAt: now, Rarity: def.Rarity,
		})
	}

	// Combat checks
	if s.TotalKills >= 1 {
		tryUnlock(achievementDefs[0]) // first_blood
	}
	if s.TotalKills >= 100 {
		tryUnlock(achievementDefs[1]) // centurion
	}
	if s.TotalKills >= 1000 {
		tryUnlock(achievementDefs[2]) // thousand_kills
	}
	if s.TotalKills >= 10000 {
		tryUnlock(achievementDefs[3]) // ten_thousand
	}
	if s.TotalEliteKills >= 50 {
		tryUnlock(achievementDefs[4]) // elite_hunter
	}
	if s.TotalBossKills >= 10 {
		tryUnlock(achievementDefs[5]) // boss_slayer
	}

	// Survival checks
	if s.TotalBattles >= 1 {
		tryUnlock(achievementDefs[6]) // survivor
	}
	if s.TotalBattles >= 10 {
		tryUnlock(achievementDefs[7]) // iron_will
	}
	if s.TotalWins >= 50 {
		tryUnlock(achievementDefs[8]) // undying
	}
	if s.HighestLevel >= 20 {
		tryUnlock(achievementDefs[9]) // level_20
	}
	if s.HighestLevel >= 50 {
		tryUnlock(achievementDefs[10]) // level_50
	}

	// Build checks
	if s.TomesCollected >= 100 {
		tryUnlock(achievementDefs[11]) // tome_collector
	}
	if s.SynergiesUnlocked >= 10 {
		tryUnlock(achievementDefs[12]) // synergy_master
	}
	if len(s.CharacterStats) >= 8 {
		tryUnlock(achievementDefs[13]) // all_chars
	}

	// PvP checks
	if s.TotalPvPKills >= 1 {
		tryUnlock(achievementDefs[14]) // pvp_first
	}
	if result != nil && result.PvPKills >= 5 {
		tryUnlock(achievementDefs[15]) // pvp_ace
	}
	if s.TotalPvPKills >= 100 {
		tryUnlock(achievementDefs[16]) // pvp_centurion
	}
	if s.FactionWins >= 25 {
		tryUnlock(achievementDefs[17]) // faction_champion
	}

	// Sovereignty checks
	if s.SovereigntyCaptures >= 1 {
		tryUnlock(achievementDefs[18]) // conqueror
	}
	if s.SovereigntyDefends >= 5 {
		tryUnlock(achievementDefs[19]) // defender
	}
	if s.SovereigntyCaptures >= 10 {
		tryUnlock(achievementDefs[20]) // world_dominator
	}

	// Exploration checks
	if s.UniqueCountries >= 10 {
		tryUnlock(achievementDefs[21]) // explorer
	}
	if s.UniqueCountries >= 6 {
		tryUnlock(achievementDefs[22]) // globetrotter (approximation)
	}
	if s.TotalBattles >= 100 {
		tryUnlock(achievementDefs[23]) // veteran
	}
	if profile.ProfileLevel >= 100 {
		tryUnlock(achievementDefs[24]) // legend
	}

	return newAchievements
}

// achievementSet returns a set of unlocked achievement IDs for quick lookup.
func (p *ARPlayerProfile) achievementSet() map[string]bool {
	set := make(map[string]bool, len(p.Achievements))
	for _, a := range p.Achievements {
		set[a.ID] = true
	}
	return set
}

// HasCharacter checks if a character is unlocked.
func (p *ARPlayerProfile) HasCharacter(ct ARCharacterType) bool {
	for _, c := range p.UnlockedChars {
		if c == ct {
			return true
		}
	}
	return false
}

// ProfileXPToNextLevel is an alias for ProfileXPToNext, useful externally.
func ProfileXPToNextLevel(level int) float64 {
	return ARProfileBaseXP + float64(level)*ARProfileGrowthXP
}

// CalcProfileDisplayStats returns summary stats for profile display.
type ARProfileDisplayStats struct {
	WinRate       float64 `json:"winRate"`       // percentage
	AvgKillsPerGame float64 `json:"avgKillsPerGame"`
	AvgSurvivalSec  float64 `json:"avgSurvivalSec"`
	KDRatio       float64 `json:"kdRatio"`
	TotalPlayTime string  `json:"totalPlayTime"` // formatted
}

// CalcDisplayStats computes display-friendly stats.
func CalcDisplayStats(stats *ARLifetimeStats) ARProfileDisplayStats {
	ds := ARProfileDisplayStats{}
	if stats.TotalBattles > 0 {
		ds.WinRate = float64(stats.TotalWins) / float64(stats.TotalBattles) * 100.0
		ds.AvgKillsPerGame = float64(stats.TotalKills) / float64(stats.TotalBattles)
		ds.AvgSurvivalSec = stats.TotalSurvivalSec / float64(stats.TotalBattles)
	}
	if stats.TotalDeaths > 0 {
		ds.KDRatio = float64(stats.TotalKills) / float64(stats.TotalDeaths)
	} else if stats.TotalKills > 0 {
		ds.KDRatio = float64(stats.TotalKills)
	}

	// Format play time
	totalHours := stats.TotalSurvivalSec / 3600.0
	if totalHours >= 1 {
		ds.TotalPlayTime = formatHoursMinutes(totalHours)
	} else {
		mins := stats.TotalSurvivalSec / 60.0
		ds.TotalPlayTime = formatMinutes(mins)
	}

	return ds
}

func formatHoursMinutes(hours float64) string {
	h := int(hours)
	m := int(math.Mod(hours*60, 60))
	if h > 0 {
		return formatInt(h) + "h " + formatInt(m) + "m"
	}
	return formatInt(m) + "m"
}

func formatMinutes(mins float64) string {
	return formatInt(int(mins)) + "m"
}

func formatInt(n int) string {
	if n < 10 {
		return string(rune('0'+n))
	}
	// Simple int to string without fmt for small numbers
	result := ""
	for n > 0 {
		result = string(rune('0'+n%10)) + result
		n /= 10
	}
	if result == "" {
		return "0"
	}
	return result
}
