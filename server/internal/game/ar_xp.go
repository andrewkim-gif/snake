package game

import (
	"fmt"
	"math"
	"math/rand"
)

// ============================================================
// Arena XP & Level-Up System (v18)
// ============================================================

// ARLevelSystem manages XP collection and level-up for Arena players.
type ARLevelSystem struct {
	nextCrystalID int
}

// NewARLevelSystem creates a new level system.
func NewARLevelSystem() *ARLevelSystem {
	return &ARLevelSystem{}
}

// XPToNextLevel calculates XP required for the next level.
// Formula: 50 + (currentLevel * 30)
func XPToNextLevel(level int) float64 {
	return ARBaseXPToLevel + float64(level)*ARXPPerLevel
}

// SpawnXPCrystal creates an XP crystal at the given position.
func (ls *ARLevelSystem) SpawnXPCrystal(pos ARVec3, value float64) *ARXPCrystal {
	ls.nextCrystalID++
	return &ARXPCrystal{
		ID:    fmt.Sprintf("xp_%d", ls.nextCrystalID),
		Pos:   pos,
		Value: value,
		Alive: true,
	}
}

// CollectXP attempts to collect nearby XP crystals for a player.
// Returns the total XP collected and whether the player leveled up.
func (ls *ARLevelSystem) CollectXP(player *ARPlayer, crystals []*ARXPCrystal) (collected float64, leveledUp bool) {
	magnetRange := ARXPMagnetBase + float64(player.Tomes[ARTomeMagnet])*ARXPMagnetPerTome
	xpMult := 1.0 + float64(player.Tomes[ARTomeXP])*0.15

	for _, c := range crystals {
		if !c.Alive {
			continue
		}
		dist := player.Pos.DistTo(c.Pos)
		if dist <= magnetRange {
			xpGain := c.Value * xpMult
			player.XP += xpGain
			collected += xpGain
			c.Alive = false
		}
	}

	// Check level-up
	for player.XP >= player.XPToNext && player.Level < 99 {
		player.XP -= player.XPToNext
		player.Level++
		player.XPToNext = XPToNextLevel(player.Level)
		leveledUp = true

		// Generate level-up choices
		player.PendingLevelUp = true
		player.LevelUpChoices = ls.GenerateTomeChoices(player)

		// HP increase on level-up
		hpBonus := player.MaxHP * 0.05 // +5% max HP per level
		player.MaxHP += hpBonus
		player.HP += hpBonus
	}

	return collected, leveledUp
}

// GenerateTomeChoices generates 3 tome options for level-up selection.
func (ls *ARLevelSystem) GenerateTomeChoices(player *ARPlayer) []ARTomeOffer {
	allTomes := []ARTomeID{
		ARTomeDamage, ARTomeAttackSpeed, ARTomeCritChance, ARTomeCritDamage,
		ARTomeArea, ARTomeProjectile, ARTomeSpeed, ARTomeHP,
		ARTomeShield, ARTomeThorns, ARTomeKnockback, ARTomeXP,
		ARTomeLuck, ARTomeMagnet, ARTomeDodge, ARTomeCursed,
	}

	maxStacks := map[ARTomeID]int{
		ARTomeDamage: 10, ARTomeAttackSpeed: 10, ARTomeCritChance: 15,
		ARTomeCritDamage: 10, ARTomeArea: 10, ARTomeProjectile: 5,
		ARTomeSpeed: 10, ARTomeHP: 10, ARTomeShield: 5,
		ARTomeThorns: 5, ARTomeKnockback: 5, ARTomeXP: 10,
		ARTomeLuck: 10, ARTomeMagnet: 10, ARTomeDodge: 10,
		ARTomeCursed: 5,
	}

	// Filter out maxed tomes
	available := make([]ARTomeID, 0, len(allTomes))
	for _, t := range allTomes {
		if player.Tomes[t] < maxStacks[t] {
			available = append(available, t)
		}
	}

	// Shuffle and pick 3
	rand.Shuffle(len(available), func(i, j int) {
		available[i], available[j] = available[j], available[i]
	})

	count := 3
	if len(available) < count {
		count = len(available)
	}

	choices := make([]ARTomeOffer, count)
	luckStacks := player.Tomes[ARTomeLuck]
	for i := 0; i < count; i++ {
		choices[i] = ARTomeOffer{
			TomeID: available[i],
			Rarity: rollRarity(luckStacks),
			Stacks: 1,
		}
	}

	return choices
}

// rollRarity determines the rarity of a tome offer based on Luck stacks.
func rollRarity(luckStacks int) ARRarity {
	// Base probabilities: Common 50%, Uncommon 30%, Rare 15%, Epic 4%, Legendary 1%
	// Luck shifts probabilities upward
	luckBonus := float64(luckStacks)
	roll := rand.Float64() * 100.0

	legendaryThresh := 1.0 + luckBonus*2.0
	epicThresh := legendaryThresh + 4.0 + luckBonus*3.0
	rareThresh := epicThresh + 15.0 + luckBonus*5.0
	uncommonThresh := rareThresh + 30.0 + luckBonus*3.0

	switch {
	case roll < legendaryThresh:
		return ARRarityLegendary
	case roll < epicThresh:
		return ARRarityEpic
	case roll < rareThresh:
		return ARRarityRare
	case roll < uncommonThresh:
		return ARRarityUncommon
	default:
		return ARRarityCommon
	}
}

// RarityMultiplier returns the effect multiplier for a rarity tier.
func RarityMultiplier(r ARRarity) float64 {
	switch r {
	case ARRarityCommon:
		return 1.0
	case ARRarityUncommon:
		return 1.3
	case ARRarityRare:
		return 1.7
	case ARRarityEpic:
		return 2.2
	case ARRarityLegendary:
		return 3.0
	default:
		return 1.0
	}
}

// ApplyTome applies a tome selection to a player, updating computed stats.
func ApplyTome(player *ARPlayer, tomeID ARTomeID, rarity ARRarity) {
	mult := RarityMultiplier(rarity)
	player.Tomes[tomeID]++

	// Recompute derived stats from all tome stacks
	recomputePlayerStats(player)

	// Special per-tome effects that scale with rarity
	switch tomeID {
	case ARTomeHP:
		hpBonus := player.MaxHP * 0.10 * mult
		player.MaxHP += hpBonus
		player.HP += hpBonus
	case ARTomeShield:
		// Shield effect is handled in combat tick
	case ARTomeSpeed:
		player.MaxStamina += 20.0 * mult
	}
}

// recomputePlayerStats recalculates all derived stats from tomes.
func recomputePlayerStats(player *ARPlayer) {
	// Diminishing returns for stacks >= 5: effect(n) = base * n^0.85
	dimReturn := func(stacks int, perStack float64) float64 {
		n := float64(stacks)
		if n <= 0 {
			return 0
		}
		if n < 5 {
			return perStack * n
		}
		return perStack * math.Pow(n, 0.85)
	}

	player.DamageMult = 1.0 + dimReturn(player.Tomes[ARTomeDamage], 0.15)
	player.AttackSpeedMult = 1.0 + dimReturn(player.Tomes[ARTomeAttackSpeed], 0.10)
	player.CritChance = 5.0 + dimReturn(player.Tomes[ARTomeCritChance], 8.0) // base 5%
	player.CritDamageMult = 2.0 + dimReturn(player.Tomes[ARTomeCritDamage], 0.20)
	player.AreaMult = 1.0 + dimReturn(player.Tomes[ARTomeArea], 0.12)
	player.SpeedMult = 1.0 + dimReturn(player.Tomes[ARTomeSpeed], 0.08)
	player.DodgeChance = dimReturn(player.Tomes[ARTomeDodge], 5.0)
	player.MagnetRange = ARXPMagnetBase + float64(player.Tomes[ARTomeMagnet])*ARXPMagnetPerTome
	player.XPMult = 1.0 + dimReturn(player.Tomes[ARTomeXP], 0.15)
}
