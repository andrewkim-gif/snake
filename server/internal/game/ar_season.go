package game

import (
	"fmt"
	"time"
)

// ============================================================
// Arena Season Pass System — Phase 6 (v18)
// ============================================================
//
// 4-week 4-Era season system integrated with AI World War seasons:
//   Era 1: Discovery (week 1) — lower difficulty, exploration focus
//   Era 2: Expansion (week 2) — faction growth, territory control
//   Era 3: Empires (week 3) — full-scale warfare, alliance focus
//   Era 4: Reckoning (week 4) — climax battles, final sovereignty
//
// Season pass: 100 levels, free + premium tracks
// XP from: battles, quests, daily logins, special events

// ── Season Constants ────────────────────────────────────────

const (
	// Season structure
	ARSeasonDurationDays = 28        // 4 weeks
	ARSeasonEraCount     = 4         // 4 Eras
	ARSeasonEraDays      = 7         // 1 week per Era
	ARSeasonMaxLevel     = 100       // max season pass level
	ARSeasonPremiumCost  = 3000.0    // $AWW to unlock premium track

	// XP per season level (linear scaling)
	ARSeasonBaseXP     = 100.0  // XP for level 1
	ARSeasonXPPerLevel = 25.0   // additional XP per level

	// XP sources
	ARSeasonXPPerBattle    = 50.0   // base XP per battle completion
	ARSeasonXPPerWin       = 100.0  // bonus for rank 1
	ARSeasonXPPerDailyQuest = 30.0  // per daily quest
	ARSeasonXPPerWeeklyQuest = 80.0 // per weekly quest
	ARSeasonXPDailyLogin    = 20.0  // first battle of the day
	ARSeasonXPEraBonus      = 200.0 // bonus at each Era transition
)

// ── Season Types ────────────────────────────────────────────

// ARSeasonEra represents one of the four season eras.
type ARSeasonEra string

const (
	AREraDiscovery ARSeasonEra = "discovery"
	AREraExpansion ARSeasonEra = "expansion"
	AREraEmpires   ARSeasonEra = "empires"
	AREraReckoning ARSeasonEra = "reckoning"
)

// ARSeasonDef defines a season's metadata.
type ARSeasonDef struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	Theme     string      `json:"theme"`
	StartDate time.Time   `json:"startDate"`
	EndDate   time.Time   `json:"endDate"`
	Eras      []AREra     `json:"eras"`
}

// AREra defines one era within a season.
type AREra struct {
	Era       ARSeasonEra `json:"era"`
	Name      string      `json:"name"`
	StartDay  int         `json:"startDay"` // day offset from season start
	EndDay    int         `json:"endDay"`
	Modifier  string      `json:"modifier"` // gameplay modifier description
}

// ARSeasonPass tracks a player's season pass progress.
type ARSeasonPass struct {
	PlayerID    string     `json:"playerId"`
	SeasonID    string     `json:"seasonId"`
	Level       int        `json:"level"`
	XP          float64    `json:"xp"`
	XPToNext    float64    `json:"xpToNext"`
	IsPremium   bool       `json:"isPremium"`
	ClaimedFree []int      `json:"claimedFree"`    // levels where free reward was claimed
	ClaimedPrem []int      `json:"claimedPremium"` // levels where premium reward was claimed
	DailyLoginAt *time.Time `json:"dailyLoginAt,omitempty"` // last daily login XP claim
}

// ARSeasonRewardTrack distinguishes free vs premium.
type ARSeasonRewardTrack string

const (
	ARTrackFree    ARSeasonRewardTrack = "free"
	ARTrackPremium ARSeasonRewardTrack = "premium"
)

// ARSeasonReward is a single reward at a season pass level.
type ARSeasonReward struct {
	Level       int                 `json:"level"`
	Track       ARSeasonRewardTrack `json:"track"`
	RewardType  ARQuestRewardType   `json:"rewardType"`
	Amount      float64             `json:"amount,omitempty"`
	ItemID      string              `json:"itemId,omitempty"`
	Description string              `json:"description"`
}

// ── Season Pass XP ──────────────────────────────────────────

// SeasonXPToNext calculates XP needed for the next season pass level.
func SeasonXPToNext(level int) float64 {
	return ARSeasonBaseXP + float64(level)*ARSeasonXPPerLevel
}

// AddSeasonXP adds XP to a season pass and processes level-ups.
// Returns the number of levels gained.
func AddSeasonXP(pass *ARSeasonPass, xp float64) int {
	if xp <= 0 || pass.Level >= ARSeasonMaxLevel {
		return 0
	}

	pass.XP += xp
	levelsGained := 0

	for pass.XP >= pass.XPToNext && pass.Level < ARSeasonMaxLevel {
		pass.XP -= pass.XPToNext
		pass.Level++
		levelsGained++
		pass.XPToNext = SeasonXPToNext(pass.Level)
	}

	return levelsGained
}

// CalcSeasonBattleXP calculates season XP earned from a battle.
func CalcSeasonBattleXP(result *ARBattleResult) float64 {
	xp := ARSeasonXPPerBattle

	// Win bonus
	if result.Rank == 1 {
		xp += ARSeasonXPPerWin
	} else if result.Rank <= 3 {
		xp += ARSeasonXPPerWin * 0.5
	}

	// Sovereignty bonus
	if result.SovereigntyEvt != "" {
		xp += 50.0
	}

	return xp
}

// ── Season Pass Rewards (100 levels) ────────────────────────

// GenerateSeasonRewards generates the full reward table for a season.
// Free track: 100 levels of country tokens, basic skins, emotes, profile XP
// Premium track: 100 levels of legendary skins, $AWW, characters, special effects
func GenerateSeasonRewards() []ARSeasonReward {
	rewards := make([]ARSeasonReward, 0, 200)

	for level := 1; level <= ARSeasonMaxLevel; level++ {
		// Free track rewards
		freeReward := generateFreeReward(level)
		rewards = append(rewards, freeReward)

		// Premium track rewards
		premReward := generatePremiumReward(level)
		rewards = append(rewards, premReward)
	}

	return rewards
}

func generateFreeReward(level int) ARSeasonReward {
	r := ARSeasonReward{
		Level: level,
		Track: ARTrackFree,
	}

	switch {
	case level%10 == 0:
		// Every 10 levels: skin
		r.RewardType = ARQRewardSkin
		r.ItemID = fmt.Sprintf("season_skin_free_%d", level)
		r.Description = fmt.Sprintf("Season Skin (Free Tier %d)", level/10)
	case level%5 == 0:
		// Every 5 levels: emote
		r.RewardType = ARQRewardEmote
		r.ItemID = fmt.Sprintf("season_emote_%d", level)
		r.Description = fmt.Sprintf("Season Emote %d", level/5)
	case level%3 == 0:
		// Every 3 levels: profile XP
		r.RewardType = ARQRewardProfileXP
		r.Amount = float64(level) * 10
		r.Description = fmt.Sprintf("%d Profile XP", int(r.Amount))
	default:
		// Other levels: country tokens
		r.RewardType = ARQRewardCountryToken
		r.Amount = float64(level) * 20
		r.Description = fmt.Sprintf("%d Country Tokens", int(r.Amount))
	}

	return r
}

func generatePremiumReward(level int) ARSeasonReward {
	r := ARSeasonReward{
		Level: level,
		Track: ARTrackPremium,
	}

	switch {
	case level == 100:
		// Max level: legendary season character
		r.RewardType = ARQRewardCharUnlock
		r.ItemID = "season_char_legendary"
		r.Description = "Legendary Season Character"
	case level == 50:
		// Midpoint: epic skin set
		r.RewardType = ARQRewardSkin
		r.ItemID = "season_skin_epic_set"
		r.Description = "Epic Season Skin Set"
	case level%10 == 0:
		// Every 10 levels: $AWW tokens
		r.RewardType = ARQRewardAWW
		r.Amount = float64(level) * 10
		r.Description = fmt.Sprintf("%d $AWW", int(r.Amount))
	case level%5 == 0:
		// Every 5 levels: legendary skin
		r.RewardType = ARQRewardSkin
		r.ItemID = fmt.Sprintf("season_skin_prem_%d", level)
		r.Description = fmt.Sprintf("Premium Season Skin %d", level/5)
	case level%3 == 0:
		// Every 3 levels: season XP boost
		r.RewardType = ARQRewardSeasonXP
		r.Amount = float64(level) * 5
		r.Description = fmt.Sprintf("%d Season XP Boost", int(r.Amount))
	default:
		// Other levels: country tokens (premium amount)
		r.RewardType = ARQRewardCountryToken
		r.Amount = float64(level) * 40 // 2x free track
		r.Description = fmt.Sprintf("%d Country Tokens (Premium)", int(r.Amount))
	}

	return r
}

// ── Era System ──────────────────────────────────────────────

// DefaultEras returns the standard 4-era structure for a season.
func DefaultEras() []AREra {
	return []AREra{
		{
			Era: AREraDiscovery, Name: "Discovery",
			StartDay: 0, EndDay: 7,
			Modifier: "Lower difficulty, +50% XP, exploration quests",
		},
		{
			Era: AREraExpansion, Name: "Expansion",
			StartDay: 7, EndDay: 14,
			Modifier: "Faction formation, territory bonuses, alliance quests",
		},
		{
			Era: AREraEmpires, Name: "Empires",
			StartDay: 14, EndDay: 21,
			Modifier: "Full warfare, sovereignty battles, empire quests",
		},
		{
			Era: AREraReckoning, Name: "Reckoning",
			StartDay: 21, EndDay: 28,
			Modifier: "Final battles, 2x sovereignty rewards, championship",
		},
	}
}

// GetCurrentEra returns the current era based on season start and current time.
func GetCurrentEra(seasonStart time.Time) ARSeasonEra {
	daysSinceStart := int(time.Since(seasonStart).Hours() / 24)

	switch {
	case daysSinceStart < ARSeasonEraDays:
		return AREraDiscovery
	case daysSinceStart < ARSeasonEraDays*2:
		return AREraExpansion
	case daysSinceStart < ARSeasonEraDays*3:
		return AREraEmpires
	default:
		return AREraReckoning
	}
}

// GetEraModifiers returns gameplay modifiers for the current era.
func GetEraModifiers(era ARSeasonEra) AREraModifiers {
	switch era {
	case AREraDiscovery:
		return AREraModifiers{
			XPMultiplier:       1.5,
			DifficultyMult:     0.8,
			SovereigntyMult:    0.5,
			SpecialQuestsAvail: true,
		}
	case AREraExpansion:
		return AREraModifiers{
			XPMultiplier:       1.0,
			DifficultyMult:     1.0,
			SovereigntyMult:    1.0,
			SpecialQuestsAvail: true,
		}
	case AREraEmpires:
		return AREraModifiers{
			XPMultiplier:       1.0,
			DifficultyMult:     1.2,
			SovereigntyMult:    1.5,
			SpecialQuestsAvail: true,
		}
	case AREraReckoning:
		return AREraModifiers{
			XPMultiplier:       1.0,
			DifficultyMult:     1.5,
			SovereigntyMult:    2.0,
			SpecialQuestsAvail: true,
		}
	default:
		return AREraModifiers{
			XPMultiplier:    1.0,
			DifficultyMult:  1.0,
			SovereigntyMult: 1.0,
		}
	}
}

// AREraModifiers defines gameplay adjustments per era.
type AREraModifiers struct {
	XPMultiplier       float64 `json:"xpMultiplier"`
	DifficultyMult     float64 `json:"difficultyMult"`
	SovereigntyMult    float64 `json:"sovereigntyMult"`
	SpecialQuestsAvail bool    `json:"specialQuestsAvail"`
}

// ── Season Final Ranking ────────────────────────────────────

// ARSeasonRankReward defines end-of-season ranking rewards.
type ARSeasonRankReward struct {
	MinRank     int     `json:"minRank"`
	MaxRank     int     `json:"maxRank"`
	AWWReward   float64 `json:"awwReward"`
	SkinReward  string  `json:"skinReward,omitempty"`
	TitleReward string  `json:"titleReward,omitempty"`
}

// SeasonRankRewards returns the end-of-season ranking rewards.
func SeasonRankRewards() []ARSeasonRankReward {
	return []ARSeasonRankReward{
		{MinRank: 1, MaxRank: 1, AWWReward: 10000, SkinReward: "season_champion", TitleReward: "Season Champion"},
		{MinRank: 2, MaxRank: 3, AWWReward: 5000, SkinReward: "season_elite", TitleReward: "Season Elite"},
		{MinRank: 4, MaxRank: 10, AWWReward: 2000, TitleReward: "Season Top 10"},
		{MinRank: 11, MaxRank: 50, AWWReward: 1000, TitleReward: "Season Top 50"},
		{MinRank: 51, MaxRank: 100, AWWReward: 500},
		{MinRank: 101, MaxRank: 500, AWWReward: 200},
		{MinRank: 501, MaxRank: 1000, AWWReward: 100},
	}
}

// NewSeasonPass creates a new season pass for a player.
func NewSeasonPass(playerID, seasonID string) *ARSeasonPass {
	return &ARSeasonPass{
		PlayerID:    playerID,
		SeasonID:    seasonID,
		Level:       0,
		XP:          0,
		XPToNext:    SeasonXPToNext(0),
		IsPremium:   false,
		ClaimedFree: make([]int, 0),
		ClaimedPrem: make([]int, 0),
	}
}
