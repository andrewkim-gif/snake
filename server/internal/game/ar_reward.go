package game

import "math"

// ============================================================
// Arena Token Reward System — Phase 6 (v18)
// ============================================================
//
// Integrates with the dual token economy:
//   $AWW (master token) — platform governance + premium purchases
//   $KOR, $USA, ... (195 country tokens) — country-specific economy
//
// Reward sources:
//   - PvE survival reward → country token
//   - PvP kill reward → country token
//   - Sovereignty defense → $AWW
//   - Sovereignty capture → $AWW
//   - Boss contribution → country token + $AWW
//   - Season ranking → $AWW

// ── Reward Constants ────────────────────────────────────────

const (
	// PvE Survival rewards (country tokens)
	ARRewardSurvivalPerMin = 10.0 // country tokens per minute survived

	// PvP Kill rewards (country tokens)
	ARRewardPvPKillBase        = 50.0 // base country tokens per PvP kill
	ARRewardPvPKillEnemyFacMul = 2.0  // multiplier for killing enemy faction

	// PvE Kill rewards (country tokens)
	ARRewardPvEKillBase     = 2.0  // base tokens per normal kill
	ARRewardPvEEliteKillMul = 5.0  // multiplier for elite kill
	ARRewardPvEMinibossMul  = 15.0 // multiplier for miniboss kill
	ARRewardPvEBossKillMul  = 50.0 // multiplier for boss kill contribution

	// Sovereignty rewards ($AWW)
	ARRewardSovereigntyDefend  = 200.0 // $AWW for defending sovereignty
	ARRewardSovereigntyCapture = 500.0 // $AWW for capturing sovereignty

	// Level-based rewards
	ARRewardPerLevel = 5.0 // country tokens per battle level

	// Ranking bonus (top-N multipliers)
	ARRewardRank1Bonus = 3.0
	ARRewardRank2Bonus = 2.0
	ARRewardRank3Bonus = 1.5

	// Daily token cap per tier
	ARDailyCapTierS = 5000.0
	ARDailyCapTierA = 3500.0
	ARDailyCapTierB = 2500.0
	ARDailyCapTierC = 1500.0
	ARDailyCapTierD = 800.0

	// Profile XP formula components
	ARProfileXPPerMinSurvived = 10.0
	ARProfileXPPerKill        = 20.0
	ARProfileXPPerLevel       = 5.0
	ARProfileXPRankBonus1     = 200.0
	ARProfileXPRankBonus2     = 120.0
	ARProfileXPRankBonus3     = 80.0
	ARProfileXPFactionWinMul  = 1.5

	// Permanent boost (deflationary token sink)
	ARBoostBaseCost       = 500.0  // country tokens to purchase
	ARBoostEffectBase     = 0.05   // +5% base effect
	ARBoostDiminishing    = 0.7    // effect(n) = base * n^0.7
)

// ── Reward Types ────────────────────────────────────────────

// ARTokenType distinguishes master vs country tokens.
type ARTokenType string

const (
	ARTokenAWW     ARTokenType = "aww"     // $AWW master token
	ARTokenCountry ARTokenType = "country" // country-specific token ($KOR, $USA, etc.)
)

// ARRewardEntry is a single reward line item.
type ARRewardEntry struct {
	TokenType   ARTokenType `json:"tokenType"`
	Amount      float64     `json:"amount"`
	Source      string      `json:"source"`      // human-readable source description
	CountryCode string      `json:"countryCode"` // ISO alpha-3, only for country tokens
}

// ARBattleRewards is the complete reward summary for a player after a battle.
type ARBattleRewards struct {
	PlayerID    string           `json:"playerId"`
	Entries     []ARRewardEntry  `json:"entries"`
	TotalAWW    float64          `json:"totalAww"`
	TotalCountry float64         `json:"totalCountry"`
	ProfileXP   float64          `json:"profileXp"`
	QuestProgress []ARQuestDelta `json:"questProgress,omitempty"`
}

// ARQuestDelta reports progress on a quest.
type ARQuestDelta struct {
	QuestID  string `json:"questId"`
	Delta    int    `json:"delta"`
	Complete bool   `json:"complete"`
}

// ARBattleResult captures a player's performance in a single battle.
type ARBattleResult struct {
	PlayerID       string  `json:"playerId"`
	CountryCode    string  `json:"countryCode"`    // which country arena
	CountryTier    string  `json:"countryTier"`     // S/A/B/C/D
	FactionID      string  `json:"factionId"`
	SurvivalTimeSec float64 `json:"survivalTime"`   // seconds survived
	PvEKills       int     `json:"pveKills"`
	PvEEliteKills  int     `json:"pveEliteKills"`
	PvEMinibossKills int   `json:"pveMinibossKills"`
	PvPKills       int     `json:"pvpKills"`
	BossContrib    float64 `json:"bossContrib"`     // 0.0~1.0 share of boss damage
	FinalLevel     int     `json:"finalLevel"`
	Rank           int     `json:"rank"`            // 1-based rank in battle
	FactionWon     bool    `json:"factionWon"`      // whether player's faction won PvP
	SovereigntyEvt string  `json:"sovereigntyEvt"`  // "defend" | "capture" | ""
	TonesCollected int     `json:"tomesCollected"`
	SynergiesHit   int     `json:"synergiesHit"`
	TerrainThemes  int     `json:"terrainThemes"`   // unique themes visited (for quests)
}

// ── Reward Calculation ──────────────────────────────────────

// CalcBattleRewards computes the complete reward breakdown for a battle result.
func CalcBattleRewards(result *ARBattleResult) *ARBattleRewards {
	rewards := &ARBattleRewards{
		PlayerID: result.PlayerID,
		Entries:  make([]ARRewardEntry, 0, 8),
	}

	cc := result.CountryCode

	// 1. PvE Survival reward (country token)
	survivalMins := result.SurvivalTimeSec / 60.0
	survivalReward := survivalMins * ARRewardSurvivalPerMin
	if survivalReward > 0 {
		rewards.addCountry(survivalReward, "PvE survival", cc)
	}

	// 2. PvE Kill rewards (country token)
	normalKillReward := float64(result.PvEKills) * ARRewardPvEKillBase
	if normalKillReward > 0 {
		rewards.addCountry(normalKillReward, "PvE kills", cc)
	}

	eliteKillReward := float64(result.PvEEliteKills) * ARRewardPvEKillBase * ARRewardPvEEliteKillMul
	if eliteKillReward > 0 {
		rewards.addCountry(eliteKillReward, "Elite kills", cc)
	}

	minibossKillReward := float64(result.PvEMinibossKills) * ARRewardPvEKillBase * ARRewardPvEMinibossMul
	if minibossKillReward > 0 {
		rewards.addCountry(minibossKillReward, "Miniboss kills", cc)
	}

	// 3. PvP Kill rewards (country token)
	pvpKillReward := float64(result.PvPKills) * ARRewardPvPKillBase
	if result.FactionWon {
		pvpKillReward *= ARRewardPvPKillEnemyFacMul
	}
	if pvpKillReward > 0 {
		rewards.addCountry(pvpKillReward, "PvP kills", cc)
	}

	// 4. Boss contribution reward (country + $AWW)
	if result.BossContrib > 0 {
		bossCountryReward := result.BossContrib * ARRewardPvEKillBase * ARRewardPvEBossKillMul * 100.0
		rewards.addCountry(bossCountryReward, "Boss contribution", cc)

		// Top contributors also get $AWW
		if result.BossContrib > 0.10 {
			bossAWW := result.BossContrib * 100.0
			rewards.addAWW(bossAWW, "Boss contribution")
		}
	}

	// 5. Level-based reward (country token)
	levelReward := float64(result.FinalLevel) * ARRewardPerLevel
	if levelReward > 0 {
		rewards.addCountry(levelReward, "Battle level", cc)
	}

	// 6. Rank bonus (multiplier on total country tokens)
	rankMul := calcRankMultiplier(result.Rank)
	if rankMul > 1.0 {
		bonusAmount := rewards.TotalCountry * (rankMul - 1.0)
		rewards.addCountry(bonusAmount, "Rank bonus", cc)
	}

	// 7. Sovereignty event ($AWW)
	switch result.SovereigntyEvt {
	case "defend":
		rewards.addAWW(ARRewardSovereigntyDefend, "Sovereignty defense")
	case "capture":
		rewards.addAWW(ARRewardSovereigntyCapture, "Sovereignty capture")
	}

	// 8. Faction win bonus (country token)
	if result.FactionWon {
		factionBonus := rewards.TotalCountry * 0.2 // +20% bonus
		rewards.addCountry(factionBonus, "Faction victory", cc)
	}

	// Apply daily cap
	dailyCap := getDailyCap(result.CountryTier)
	if rewards.TotalCountry > dailyCap {
		rewards.TotalCountry = dailyCap
	}

	// Calculate profile XP
	rewards.ProfileXP = calcProfileXP(result)

	return rewards
}

// addCountry adds a country token reward entry.
func (r *ARBattleRewards) addCountry(amount float64, source, countryCode string) {
	amount = math.Round(amount*100) / 100 // round to 2 decimals
	r.Entries = append(r.Entries, ARRewardEntry{
		TokenType:   ARTokenCountry,
		Amount:      amount,
		Source:      source,
		CountryCode: countryCode,
	})
	r.TotalCountry += amount
}

// addAWW adds a $AWW master token reward entry.
func (r *ARBattleRewards) addAWW(amount float64, source string) {
	amount = math.Round(amount*100) / 100
	r.Entries = append(r.Entries, ARRewardEntry{
		TokenType: ARTokenAWW,
		Amount:    amount,
		Source:    source,
	})
	r.TotalAWW += amount
}

// calcRankMultiplier returns the reward multiplier for a battle rank.
func calcRankMultiplier(rank int) float64 {
	switch rank {
	case 1:
		return ARRewardRank1Bonus
	case 2:
		return ARRewardRank2Bonus
	case 3:
		return ARRewardRank3Bonus
	default:
		return 1.0
	}
}

// getDailyCap returns the daily token earning cap for a country tier.
func getDailyCap(tier string) float64 {
	switch tier {
	case "S":
		return ARDailyCapTierS
	case "A":
		return ARDailyCapTierA
	case "B":
		return ARDailyCapTierB
	case "C":
		return ARDailyCapTierC
	case "D":
		return ARDailyCapTierD
	default:
		return ARDailyCapTierC
	}
}

// calcProfileXP computes the profile XP earned from a battle.
func calcProfileXP(result *ARBattleResult) float64 {
	xp := 0.0

	// Survival time contribution
	xp += (result.SurvivalTimeSec / 60.0) * ARProfileXPPerMinSurvived

	// Kill contribution
	totalKills := result.PvEKills + result.PvEEliteKills + result.PvEMinibossKills + result.PvPKills
	xp += float64(totalKills) * ARProfileXPPerKill

	// Level contribution
	xp += float64(result.FinalLevel) * ARProfileXPPerLevel

	// Rank bonus
	switch result.Rank {
	case 1:
		xp += ARProfileXPRankBonus1
	case 2:
		xp += ARProfileXPRankBonus2
	case 3:
		xp += ARProfileXPRankBonus3
	}

	// Faction win multiplier
	if result.FactionWon {
		xp *= ARProfileXPFactionWinMul
	}

	return math.Round(xp)
}

// ── Permanent Boost (Token Sink) ────────────────────────────

// ARBoostPurchase represents a permanent stat boost purchase.
type ARBoostPurchase struct {
	TomeID        ARTomeID `json:"tomeId"`
	CurrentStacks int      `json:"currentStacks"`
}

// CalcBoostCost returns the country token cost for the next boost stack.
// Uses flat cost — the diminishing returns are on the effect, not cost.
func CalcBoostCost(currentStacks int) float64 {
	return ARBoostBaseCost
}

// CalcBoostEffect returns the total boost effect for N stacks.
// effect(n) = base * n^0.7 (diminishing returns)
func CalcBoostEffect(stacks int) float64 {
	if stacks <= 0 {
		return 0
	}
	return ARBoostEffectBase * math.Pow(float64(stacks), ARBoostDiminishing)
}

// ── Token Sink Summary ──────────────────────────────────────

// ARTokenSinkType enumerates all token consumption methods.
type ARTokenSinkType string

const (
	ARSinkPermanentBoost  ARTokenSinkType = "permanent_boost"  // country token burn
	ARSinkCharacterUnlock ARTokenSinkType = "character_unlock"  // $AWW spend
	ARSinkWeaponUnlock    ARTokenSinkType = "weapon_unlock"     // country token spend
	ARSinkSkinPurchase    ARTokenSinkType = "skin_purchase"     // $AWW spend
	ARSinkEmotePurchase   ARTokenSinkType = "emote_purchase"    // country token spend
	ARSinkSeasonPass      ARTokenSinkType = "season_pass"       // $AWW spend
)

// ARTokenSink records a token consumption event.
type ARTokenSink struct {
	SinkType    ARTokenSinkType `json:"sinkType"`
	TokenType   ARTokenType     `json:"tokenType"`
	Amount      float64         `json:"amount"`
	CountryCode string          `json:"countryCode,omitempty"` // for country token burns
	ItemID      string          `json:"itemId,omitempty"`      // what was purchased
}
