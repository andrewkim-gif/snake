package game

// ============================================================
// v33 Phase 1 — TokenBuffApplier: Converts a player's country
// token balance into in-game buffs for the Matrix arena.
//
// Buff tiers (cumulative):
//   Tier 1:   100+ tokens → +10% XP
//   Tier 2:  1000+ tokens → +5% all stats
//   Tier 3: 10000+ tokens → +15% XP, Rally skill
//   Tier 4: 100000+ tokens → +20% XP, +10% stats, Inspire skill
//
// Buffs are computed on join and cached in PlayerSession.
// They do NOT affect server-side physics/combat directly —
// they modify XP gain and are informational for the client.
// ============================================================

// Buff tier thresholds
const (
	BuffTier1Threshold = 100.0
	BuffTier2Threshold = 1000.0
	BuffTier3Threshold = 10000.0
	BuffTier4Threshold = 100000.0
)

// Buff values per tier
const (
	// Tier 1: +10% XP
	Tier1XPBoost = 0.10

	// Tier 2: +5% all stats
	Tier2StatBoost = 0.05

	// Tier 3: +15% XP (replaces Tier 1)
	Tier3XPBoost = 0.15

	// Tier 4: +20% XP (replaces Tier 3), +10% stats (replaces Tier 2)
	Tier4XPBoost   = 0.20
	Tier4StatBoost = 0.10
)

// TokenBuffs holds the active buffs derived from token balance.
type TokenBuffs struct {
	XPBoost       float64  `json:"xpBoost"`       // XP multiplier bonus (0.0 = no bonus)
	StatBoost     float64  `json:"statBoost"`      // all-stat multiplier bonus
	SpecialSkills []string `json:"specialSkills"`  // unlocked special skills
	Tier          int      `json:"tier"`           // current buff tier (0-4)
}

// NoTokenBuff returns a zero-buff state.
func NoTokenBuff() TokenBuffs {
	return TokenBuffs{
		XPBoost:       0,
		StatBoost:     0,
		SpecialSkills: make([]string, 0),
		Tier:          0,
	}
}

// HasBuffs returns true if any buff is active.
func (tb TokenBuffs) HasBuffs() bool {
	return tb.Tier > 0
}

// GetXPMultiplier returns the total XP multiplier (1.0 + boost).
func (tb TokenBuffs) GetXPMultiplier() float64 {
	return 1.0 + tb.XPBoost
}

// GetStatMultiplier returns the total stat multiplier (1.0 + boost).
func (tb TokenBuffs) GetStatMultiplier() float64 {
	return 1.0 + tb.StatBoost
}

// BuffTier defines a single tier's threshold and effects.
type BuffTier struct {
	Threshold float64  // minimum token balance
	XPBoost   float64  // XP multiplier bonus
	StatBoost float64  // stat multiplier bonus
	Skills    []string // special skills unlocked
	TierNum   int      // tier number (1-4)
}

// TokenBuffApplier computes in-game buffs from player token balances.
type TokenBuffApplier struct {
	tiers []BuffTier
}

// NewTokenBuffApplier creates a new buff applier with default tiers.
func NewTokenBuffApplier() *TokenBuffApplier {
	return &TokenBuffApplier{
		tiers: []BuffTier{
			{
				Threshold: BuffTier4Threshold,
				XPBoost:   Tier4XPBoost,
				StatBoost: Tier4StatBoost,
				Skills:    []string{"rally", "inspire"},
				TierNum:   4,
			},
			{
				Threshold: BuffTier3Threshold,
				XPBoost:   Tier3XPBoost,
				StatBoost: Tier2StatBoost,
				Skills:    []string{"rally"},
				TierNum:   3,
			},
			{
				Threshold: BuffTier2Threshold,
				XPBoost:   Tier1XPBoost,
				StatBoost: Tier2StatBoost,
				Skills:    nil,
				TierNum:   2,
			},
			{
				Threshold: BuffTier1Threshold,
				XPBoost:   Tier1XPBoost,
				StatBoost: 0,
				Skills:    nil,
				TierNum:   1,
			},
		},
	}
}

// GetBuffs computes the active buffs for a given token balance.
// Tiers are evaluated highest-first; the first matching tier wins.
func (tba *TokenBuffApplier) GetBuffs(balance float64) TokenBuffs {
	if balance <= 0 {
		return NoTokenBuff()
	}

	for _, tier := range tba.tiers {
		if balance >= tier.Threshold {
			skills := make([]string, 0, len(tier.Skills))
			if tier.Skills != nil {
				skills = append(skills, tier.Skills...)
			}
			return TokenBuffs{
				XPBoost:       tier.XPBoost,
				StatBoost:     tier.StatBoost,
				SpecialSkills: skills,
				Tier:          tier.TierNum,
			}
		}
	}

	return NoTokenBuff()
}

// GetTierForBalance returns the tier number for a given balance (0 if none).
func (tba *TokenBuffApplier) GetTierForBalance(balance float64) int {
	if balance <= 0 {
		return 0
	}
	for _, tier := range tba.tiers {
		if balance >= tier.Threshold {
			return tier.TierNum
		}
	}
	return 0
}

// GetTierThreshold returns the threshold for the next tier above the current one.
// Returns 0 if already at max tier.
func (tba *TokenBuffApplier) GetNextTierThreshold(balance float64) float64 {
	currentTier := tba.GetTierForBalance(balance)
	for i := len(tba.tiers) - 1; i >= 0; i-- {
		if tba.tiers[i].TierNum == currentTier+1 {
			return tba.tiers[i].Threshold
		}
	}
	return 0 // at max tier or invalid
}
