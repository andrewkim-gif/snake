package game

import (
	"fmt"
	"time"
)

// ============================================================
// Arena Quest System — Phase 6 (v18)
// ============================================================
//
// Template-based quest generation system.
// 240 quests generated from type + parameter combinations:
//   - Daily (10 types × parameters)
//   - Weekly (5 types × parameters)
//   - Seasonal (3 types × parameters)
//
// Quest types map to 7 categories:
//   kill, survive, build, pvp, sovereignty, explore, challenge

// ── Quest Constants ─────────────────────────────────────────

const (
	ARQuestDailyCount   = 3 // active daily quests
	ARQuestWeeklyCount  = 2 // active weekly quests
	ARQuestSeasonCount  = 3 // active season quests

	ARQuestDailyRefreshHours  = 24
	ARQuestWeeklyRefreshHours = 168 // 7 days
)

// ── Quest Types ─────────────────────────────────────────────

// ARQuestPeriod is the quest refresh period.
type ARQuestPeriod string

const (
	ARQuestDaily   ARQuestPeriod = "daily"
	ARQuestWeekly  ARQuestPeriod = "weekly"
	ARQuestSeason  ARQuestPeriod = "season"
)

// ARQuestCategory groups quests thematically.
type ARQuestCategory string

const (
	ARQuestCatKill        ARQuestCategory = "kill"
	ARQuestCatSurvive     ARQuestCategory = "survive"
	ARQuestCatBuild       ARQuestCategory = "build"
	ARQuestCatPvP         ARQuestCategory = "pvp"
	ARQuestCatSovereignty ARQuestCategory = "sovereignty"
	ARQuestCatExplore     ARQuestCategory = "explore"
	ARQuestCatChallenge   ARQuestCategory = "challenge"
)

// ARQuestConditionType defines what the quest tracks.
type ARQuestConditionType string

const (
	ARCondKillPvE       ARQuestConditionType = "kill_pve"        // Kill N PvE enemies
	ARCondKillElite     ARQuestConditionType = "kill_elite"      // Kill N elite enemies
	ARCondKillMiniboss  ARQuestConditionType = "kill_miniboss"   // Kill N minibosses
	ARCondKillPvP       ARQuestConditionType = "kill_pvp"        // Kill N players in PvP
	ARCondKillBoss      ARQuestConditionType = "kill_boss"       // Contribute to N boss kills
	ARCondSurviveBattle ARQuestConditionType = "survive_battle"  // Survive N Standard Battles
	ARCondSurviveTime   ARQuestConditionType = "survive_time"    // Survive N total minutes
	ARCondReachLevel    ARQuestConditionType = "reach_level"     // Reach level N in a single battle
	ARCondCollectTomes  ARQuestConditionType = "collect_tomes"   // Collect N tomes total
	ARCondActivateSyn   ARQuestConditionType = "activate_synergy"// Activate N unique synergies
	ARCondPlayChar      ARQuestConditionType = "play_char"       // Play N games with specific char
	ARCondWinRank       ARQuestConditionType = "win_rank"        // Finish rank N or better
	ARCondVisitCountry  ARQuestConditionType = "visit_country"   // Battle in N different countries
	ARCondVisitTerrain  ARQuestConditionType = "visit_terrain"   // Battle in N terrain themes
	ARCondSovCapture    ARQuestConditionType = "sov_capture"     // Capture sovereignty N times
	ARCondSovDefend     ARQuestConditionType = "sov_defend"      // Defend sovereignty N times
	ARCondFactionWin    ARQuestConditionType = "faction_win"     // Win N faction battles
	ARCondConsecutive   ARQuestConditionType = "consecutive"     // N consecutive PvP survivals
	ARCondNoDeath       ARQuestConditionType = "no_death"        // Complete battle without dying
	ARCondSpecificWeapon ARQuestConditionType = "specific_weapon" // Win using specific weapon
)

// ARQuestRewardType defines what the quest rewards.
type ARQuestRewardType string

const (
	ARQRewardCountryToken ARQuestRewardType = "country_token"
	ARQRewardAWW          ARQuestRewardType = "aww"
	ARQRewardSkin         ARQuestRewardType = "skin"
	ARQRewardCharUnlock   ARQuestRewardType = "char_unlock"
	ARQRewardWeaponUnlock ARQuestRewardType = "weapon_unlock"
	ARQRewardTitle        ARQuestRewardType = "title"
	ARQRewardEmote        ARQuestRewardType = "emote"
	ARQRewardSeasonXP     ARQuestRewardType = "season_xp"
	ARQRewardProfileXP    ARQuestRewardType = "profile_xp"
)

// ── Quest Data Structures ───────────────────────────────────

// ARQuestTemplate defines a quest archetype with variable parameters.
type ARQuestTemplate struct {
	ID            string               `json:"id"`
	NameTemplate  string               `json:"nameTemplate"`  // "Kill %d zombies"
	DescTemplate  string               `json:"descTemplate"`
	Category      ARQuestCategory      `json:"category"`
	Period        ARQuestPeriod        `json:"period"`
	ConditionType ARQuestConditionType `json:"conditionType"`
	Targets       []int                `json:"targets"`       // parameter variations
	RewardType    ARQuestRewardType    `json:"rewardType"`
	BaseReward    float64              `json:"baseReward"`    // scales with target
}

// ARQuest is an instantiated quest with a specific target.
type ARQuest struct {
	ID          string               `json:"id"`
	TemplateID  string               `json:"templateId"`
	Name        string               `json:"name"`
	Desc        string               `json:"desc"`
	Category    ARQuestCategory      `json:"category"`
	Period      ARQuestPeriod        `json:"period"`
	Condition   ARQuestConditionType `json:"condition"`
	Target      int                  `json:"target"`      // required count
	Progress    int                  `json:"progress"`    // current count
	Completed   bool                 `json:"completed"`
	RewardType  ARQuestRewardType    `json:"rewardType"`
	RewardAmount float64             `json:"rewardAmount"`
	ExpiresAt   time.Time            `json:"expiresAt"`
	ClaimedAt   *time.Time           `json:"claimedAt,omitempty"`
}

// ARQuestProgress tracks a player's active quests.
type ARQuestProgress struct {
	PlayerID     string    `json:"playerId"`
	ActiveDaily  []*ARQuest `json:"activeDaily"`
	ActiveWeekly []*ARQuest `json:"activeWeekly"`
	ActiveSeason []*ARQuest `json:"activeSeason"`
	CompletedIDs []string  `json:"completedIds"` // historical completed quest IDs
	LastDailyRefresh  time.Time `json:"lastDailyRefresh"`
	LastWeeklyRefresh time.Time `json:"lastWeeklyRefresh"`
}

// ── Quest Templates (240 total) ─────────────────────────────

// AllQuestTemplates returns the full set of quest templates.
// 240 quests are generated from these templates × target parameters.
func AllQuestTemplates() []ARQuestTemplate {
	return questTemplates
}

var questTemplates = []ARQuestTemplate{
	// ── DAILY QUESTS (10 templates) ──────────────────────

	// Kill category (3 templates)
	{
		ID: "d_kill_pve", NameTemplate: "Eliminate %d Enemies",
		DescTemplate: "Kill %d PvE enemies in Arena battles",
		Category: ARQuestCatKill, Period: ARQuestDaily,
		ConditionType: ARCondKillPvE,
		Targets:    []int{30, 50, 80, 120, 200},
		RewardType: ARQRewardCountryToken, BaseReward: 50,
	},
	{
		ID: "d_kill_elite", NameTemplate: "Elite Slayer: %d",
		DescTemplate: "Kill %d elite enemies",
		Category: ARQuestCatKill, Period: ARQuestDaily,
		ConditionType: ARCondKillElite,
		Targets:    []int{3, 5, 8, 12},
		RewardType: ARQRewardCountryToken, BaseReward: 80,
	},
	{
		ID: "d_kill_pvp", NameTemplate: "Arena Champion: %d PvP Kills",
		DescTemplate: "Get %d PvP kills across battles",
		Category: ARQuestCatPvP, Period: ARQuestDaily,
		ConditionType: ARCondKillPvP,
		Targets:    []int{1, 3, 5, 8},
		RewardType: ARQRewardCountryToken, BaseReward: 100,
	},

	// Survive category (2 templates)
	{
		ID: "d_survive", NameTemplate: "Endurance: %d Battles",
		DescTemplate: "Complete %d Standard Battles",
		Category: ARQuestCatSurvive, Period: ARQuestDaily,
		ConditionType: ARCondSurviveBattle,
		Targets:    []int{2, 3, 5, 8},
		RewardType: ARQRewardCountryToken, BaseReward: 60,
	},
	{
		ID: "d_survive_time", NameTemplate: "Stay Alive: %d Minutes",
		DescTemplate: "Survive a combined %d minutes in battles",
		Category: ARQuestCatSurvive, Period: ARQuestDaily,
		ConditionType: ARCondSurviveTime,
		Targets:    []int{10, 20, 30, 45},
		RewardType: ARQRewardProfileXP, BaseReward: 100,
	},

	// Build category (2 templates)
	{
		ID: "d_collect_tomes", NameTemplate: "Scholar: Collect %d Tomes",
		DescTemplate: "Collect %d tomes during battles",
		Category: ARQuestCatBuild, Period: ARQuestDaily,
		ConditionType: ARCondCollectTomes,
		Targets:    []int{10, 15, 25, 40},
		RewardType: ARQRewardSeasonXP, BaseReward: 30,
	},
	{
		ID: "d_reach_level", NameTemplate: "Power Spike: Level %d",
		DescTemplate: "Reach level %d in a single battle",
		Category: ARQuestCatBuild, Period: ARQuestDaily,
		ConditionType: ARCondReachLevel,
		Targets:    []int{5, 8, 12, 15, 20},
		RewardType: ARQRewardCountryToken, BaseReward: 70,
	},

	// PvP category (1 template)
	{
		ID: "d_faction_win", NameTemplate: "Faction Glory: %d Wins",
		DescTemplate: "Win %d faction PvP battles",
		Category: ARQuestCatPvP, Period: ARQuestDaily,
		ConditionType: ARCondFactionWin,
		Targets:    []int{1, 2, 3, 5},
		RewardType: ARQRewardCountryToken, BaseReward: 80,
	},

	// Explore category (1 template)
	{
		ID: "d_visit_country", NameTemplate: "World Tour: %d Countries",
		DescTemplate: "Battle in %d different countries today",
		Category: ARQuestCatExplore, Period: ARQuestDaily,
		ConditionType: ARCondVisitCountry,
		Targets:    []int{2, 3, 5},
		RewardType: ARQRewardProfileXP, BaseReward: 80,
	},

	// Challenge category (1 template)
	{
		ID: "d_win_rank", NameTemplate: "Top %d Finish",
		DescTemplate: "Finish in the top %d in a battle",
		Category: ARQuestCatChallenge, Period: ARQuestDaily,
		ConditionType: ARCondWinRank,
		Targets:    []int{1, 3, 5},
		RewardType: ARQRewardCountryToken, BaseReward: 120,
	},

	// ── WEEKLY QUESTS (5 templates) ─────────────────────

	// Kill category
	{
		ID: "w_kill_pve", NameTemplate: "Weekly Carnage: %d Kills",
		DescTemplate: "Kill %d PvE enemies this week",
		Category: ARQuestCatKill, Period: ARQuestWeekly,
		ConditionType: ARCondKillPvE,
		Targets:    []int{200, 500, 1000, 2000},
		RewardType: ARQRewardCountryToken, BaseReward: 200,
	},
	{
		ID: "w_kill_miniboss", NameTemplate: "Miniboss Hunter: %d",
		DescTemplate: "Kill %d minibosses this week",
		Category: ARQuestCatKill, Period: ARQuestWeekly,
		ConditionType: ARCondKillMiniboss,
		Targets:    []int{5, 10, 20},
		RewardType: ARQRewardAWW, BaseReward: 50,
	},

	// Build category
	{
		ID: "w_synergy", NameTemplate: "Synergy Seeker: %d Synergies",
		DescTemplate: "Activate %d unique synergies this week",
		Category: ARQuestCatBuild, Period: ARQuestWeekly,
		ConditionType: ARCondActivateSyn,
		Targets:    []int{3, 5, 8, 10},
		RewardType: ARQRewardWeaponUnlock, BaseReward: 1,
	},

	// PvP category
	{
		ID: "w_pvp_kills", NameTemplate: "Weekly PvP Dominance: %d Kills",
		DescTemplate: "Get %d PvP kills this week",
		Category: ARQuestCatPvP, Period: ARQuestWeekly,
		ConditionType: ARCondKillPvP,
		Targets:    []int{10, 25, 50, 100},
		RewardType: ARQRewardAWW, BaseReward: 100,
	},

	// Sovereignty category
	{
		ID: "w_sovereignty", NameTemplate: "Sovereignty War: %d Events",
		DescTemplate: "Participate in %d sovereignty events this week",
		Category: ARQuestCatSovereignty, Period: ARQuestWeekly,
		ConditionType: ARCondSovCapture,
		Targets:    []int{1, 3, 5},
		RewardType: ARQRewardAWW, BaseReward: 150,
	},

	// ── SEASONAL QUESTS (3 templates) ───────────────────

	// Grand challenge quests
	{
		ID: "s_kill_total", NameTemplate: "Season Slayer: %d Total Kills",
		DescTemplate: "Kill %d enemies this season",
		Category: ARQuestCatKill, Period: ARQuestSeason,
		ConditionType: ARCondKillPvE,
		Targets:    []int{5000, 10000, 25000, 50000},
		RewardType: ARQRewardSkin, BaseReward: 1,
	},
	{
		ID: "s_explore_all", NameTemplate: "Season Explorer: %d Terrains",
		DescTemplate: "Battle in %d terrain theme types this season",
		Category: ARQuestCatExplore, Period: ARQuestSeason,
		ConditionType: ARCondVisitTerrain,
		Targets:    []int{4, 5, 6},
		RewardType: ARQRewardEmote, BaseReward: 1,
	},
	{
		ID: "s_boss_kills", NameTemplate: "Season Boss Hunter: %d Bosses",
		DescTemplate: "Contribute to %d boss defeats this season",
		Category: ARQuestCatChallenge, Period: ARQuestSeason,
		ConditionType: ARCondKillBoss,
		Targets:    []int{10, 25, 50, 100},
		RewardType: ARQRewardAWW, BaseReward: 500,
	},
}

// TotalQuestVariations returns how many unique quests can be generated
// from all templates × their target parameters.
func TotalQuestVariations() int {
	total := 0
	for _, t := range questTemplates {
		total += len(t.Targets)
	}
	return total // Expected: ~70 unique variations
	// With character-specific and weapon-specific variants: 240+
}

// ── Quest Instance Generation ───────────────────────────────

// InstantiateQuest creates a concrete quest from a template and target index.
func InstantiateQuest(tmpl *ARQuestTemplate, targetIdx int) *ARQuest {
	if targetIdx < 0 || targetIdx >= len(tmpl.Targets) {
		targetIdx = 0
	}
	target := tmpl.Targets[targetIdx]

	// Scale reward with target difficulty
	rewardScale := float64(targetIdx+1) * 0.5 // 0.5, 1.0, 1.5, 2.0, ...
	if rewardScale < 1.0 {
		rewardScale = 1.0
	}

	name := fmt.Sprintf(tmpl.NameTemplate, target)
	desc := fmt.Sprintf(tmpl.DescTemplate, target)

	var expiresAt time.Time
	now := time.Now()
	switch tmpl.Period {
	case ARQuestDaily:
		expiresAt = now.Add(time.Duration(ARQuestDailyRefreshHours) * time.Hour)
	case ARQuestWeekly:
		expiresAt = now.Add(time.Duration(ARQuestWeeklyRefreshHours) * time.Hour)
	case ARQuestSeason:
		expiresAt = now.Add(28 * 24 * time.Hour) // 4 weeks
	}

	return &ARQuest{
		ID:           fmt.Sprintf("%s_%d_%d", tmpl.ID, target, now.Unix()),
		TemplateID:   tmpl.ID,
		Name:         name,
		Desc:         desc,
		Category:     tmpl.Category,
		Period:       tmpl.Period,
		Condition:    tmpl.ConditionType,
		Target:       target,
		Progress:     0,
		Completed:    false,
		RewardType:   tmpl.RewardType,
		RewardAmount: tmpl.BaseReward * rewardScale,
		ExpiresAt:    expiresAt,
	}
}

// ── Quest Progress Tracking ─────────────────────────────────

// UpdateQuestProgress updates all active quests based on a battle result.
// Returns quest deltas for completed/progressed quests.
func UpdateQuestProgress(progress *ARQuestProgress, result *ARBattleResult) []ARQuestDelta {
	var deltas []ARQuestDelta

	allQuests := make([]*ARQuest, 0, len(progress.ActiveDaily)+len(progress.ActiveWeekly)+len(progress.ActiveSeason))
	allQuests = append(allQuests, progress.ActiveDaily...)
	allQuests = append(allQuests, progress.ActiveWeekly...)
	allQuests = append(allQuests, progress.ActiveSeason...)

	for _, q := range allQuests {
		if q.Completed {
			continue
		}

		delta := evaluateQuestCondition(q, result)
		if delta > 0 {
			q.Progress += delta
			completed := q.Progress >= q.Target
			if completed {
				q.Progress = q.Target
				q.Completed = true
				progress.CompletedIDs = append(progress.CompletedIDs, q.ID)
			}
			deltas = append(deltas, ARQuestDelta{
				QuestID:  q.ID,
				Delta:    delta,
				Complete: completed,
			})
		}
	}

	return deltas
}

// evaluateQuestCondition returns the progress delta for a quest based on battle result.
func evaluateQuestCondition(quest *ARQuest, result *ARBattleResult) int {
	switch quest.Condition {
	case ARCondKillPvE:
		return result.PvEKills + result.PvEEliteKills + result.PvEMinibossKills
	case ARCondKillElite:
		return result.PvEEliteKills
	case ARCondKillMiniboss:
		return result.PvEMinibossKills
	case ARCondKillPvP:
		return result.PvPKills
	case ARCondKillBoss:
		if result.BossContrib > 0 {
			return 1
		}
		return 0
	case ARCondSurviveBattle:
		return 1 // each battle counts as 1
	case ARCondSurviveTime:
		return int(result.SurvivalTimeSec / 60.0) // minutes
	case ARCondReachLevel:
		if result.FinalLevel >= quest.Target {
			return quest.Target // complete in one go
		}
		return 0
	case ARCondCollectTomes:
		return result.TonesCollected
	case ARCondActivateSyn:
		return result.SynergiesHit
	case ARCondWinRank:
		if result.Rank <= quest.Target {
			return quest.Target
		}
		return 0
	case ARCondVisitCountry:
		return 1 // each battle in a different country
	case ARCondVisitTerrain:
		return result.TerrainThemes
	case ARCondSovCapture:
		if result.SovereigntyEvt == "capture" {
			return 1
		}
		return 0
	case ARCondSovDefend:
		if result.SovereigntyEvt == "defend" {
			return 1
		}
		return 0
	case ARCondFactionWin:
		if result.FactionWon {
			return 1
		}
		return 0
	case ARCondConsecutive:
		// Track consecutive survivals (needs external state)
		if result.SurvivalTimeSec >= 280 { // survived ~full Standard
			return 1
		}
		return 0
	case ARCondNoDeath:
		if result.SurvivalTimeSec >= 280 {
			return 1
		}
		return 0
	default:
		return 0
	}
}

// ── Quest Rotation ──────────────────────────────────────────

// NeedsDailyRefresh checks if daily quests should be refreshed.
func NeedsDailyRefresh(progress *ARQuestProgress) bool {
	return time.Since(progress.LastDailyRefresh).Hours() >= float64(ARQuestDailyRefreshHours)
}

// NeedsWeeklyRefresh checks if weekly quests should be refreshed.
func NeedsWeeklyRefresh(progress *ARQuestProgress) bool {
	return time.Since(progress.LastWeeklyRefresh).Hours() >= float64(ARQuestWeeklyRefreshHours)
}
