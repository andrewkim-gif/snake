package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 4 — S21: Anti-Snowball Mechanics
// 1. Underdog bonus: level diff × 20% extra XP when lower-level kills higher
// 2. Bounty: 5 consecutive kills → minimap reveal + 3× kill reward
// 3. Respawn protection: build preserved on death (no loss)
// 4. Peace-phase NPC farming guaranteed (can't fight? farm NPCs)
// ============================================================

// Anti-snowball constants
const (
	// Underdog bonus: +20% XP per level difference (lower kills higher)
	UnderdogBonusPerLevel = 0.20

	// Bounty system
	BountyKillStreakThreshold = 5   // Consecutive kills to trigger bounty
	BountyRewardMultiplier   = 3.0 // Kill reward multiplier for killing a bountied player
	BountyMinimapReveal      = true // Bountied player's position shown on minimap

	// Max underdog bonus cap (to prevent extreme scaling)
	MaxUnderdogBonusMultiplier = 3.0 // 300% max (15 level difference)
)

// BountyInfo holds bounty state for a player.
type BountyInfo struct {
	AgentID     string `json:"agentId"`
	KillStreak  int    `json:"killStreak"`
	IsBountied  bool   `json:"isBountied"`
	BountyValue int    `json:"bountyValue"` // bonus XP for killing this player
}

// BountyManager tracks bounty states across all agents in an arena.
type BountyManager struct {
	bounties map[string]*BountyInfo // agentID → bounty info
}

// NewBountyManager creates a new bounty manager.
func NewBountyManager() *BountyManager {
	return &BountyManager{
		bounties: make(map[string]*BountyInfo),
	}
}

// OnKill updates bounty state when an agent gets a kill.
// Returns true if the agent just became bountied.
func (bm *BountyManager) OnKill(killerID string) bool {
	info, ok := bm.bounties[killerID]
	if !ok {
		info = &BountyInfo{AgentID: killerID}
		bm.bounties[killerID] = info
	}

	info.KillStreak++
	wasBountied := info.IsBountied

	if info.KillStreak >= BountyKillStreakThreshold && !info.IsBountied {
		info.IsBountied = true
		info.BountyValue = info.KillStreak * 50 // Scales with streak
		return true // Newly bountied
	}

	if info.IsBountied {
		// Update bounty value as streak continues
		info.BountyValue = info.KillStreak * 50
	}

	_ = wasBountied
	return false
}

// OnDeath resets the bounty for a killed agent.
// Returns the bounty info if the killed player was bountied (for reward calculation).
func (bm *BountyManager) OnDeath(victimID string) *BountyInfo {
	info, ok := bm.bounties[victimID]
	if !ok || !info.IsBountied {
		// Reset streak even if not bountied
		if ok {
			info.KillStreak = 0
			info.IsBountied = false
			info.BountyValue = 0
		}
		return nil
	}

	// Capture bounty info before reset
	captured := &BountyInfo{
		AgentID:     info.AgentID,
		KillStreak:  info.KillStreak,
		IsBountied:  true,
		BountyValue: info.BountyValue,
	}

	// Reset bounty
	info.KillStreak = 0
	info.IsBountied = false
	info.BountyValue = 0

	return captured
}

// IsBountied returns whether a player has an active bounty.
func (bm *BountyManager) IsBountied(agentID string) bool {
	info, ok := bm.bounties[agentID]
	return ok && info.IsBountied
}

// GetBountyInfo returns the bounty info for a player.
func (bm *BountyManager) GetBountyInfo(agentID string) *BountyInfo {
	return bm.bounties[agentID]
}

// GetAllBountied returns all currently bountied players (for minimap reveal).
func (bm *BountyManager) GetAllBountied() []*BountyInfo {
	var result []*BountyInfo
	for _, info := range bm.bounties {
		if info.IsBountied {
			result = append(result, info)
		}
	}
	return result
}

// Reset clears all bounty data (new epoch / session reset).
func (bm *BountyManager) Reset() {
	bm.bounties = make(map[string]*BountyInfo)
}

// ============================================================
// Underdog Bonus Calculation
// ============================================================

// CalcUnderdogXPBonus returns the extra XP percentage when a lower-level
// player kills a higher-level player.
// Level difference × 20% extra XP.
func CalcUnderdogXPBonus(killerLevel, victimLevel int) float64 {
	diff := victimLevel - killerLevel
	if diff <= 0 {
		return 0 // No bonus when killing equal or lower level
	}
	bonus := float64(diff) * UnderdogBonusPerLevel
	if bonus > MaxUnderdogBonusMultiplier {
		bonus = MaxUnderdogBonusMultiplier
	}
	return bonus
}

// ApplyUnderdogBonus modifies a kill reward with underdog bonus if applicable.
func ApplyUnderdogBonus(reward *KillReward, killerLevel, victimLevel int) {
	bonus := CalcUnderdogXPBonus(killerLevel, victimLevel)
	if bonus > 0 {
		extraXP := int(float64(reward.XP) * bonus)
		reward.XP += extraXP
	}
}

// ============================================================
// Bounty Kill Reward Enhancement
// ============================================================

// ApplyBountyMultiplier multiplies kill rewards by BountyRewardMultiplier (3x)
// when killing a bountied player.
func ApplyBountyMultiplier(reward *KillReward) {
	reward.XP = int(float64(reward.XP) * BountyRewardMultiplier)
	reward.Gold = int(float64(reward.Gold) * BountyRewardMultiplier)
	reward.NationScore = int(float64(reward.NationScore) * BountyRewardMultiplier)
}

// ============================================================
// Full Kill Processing with Anti-Snowball
// ============================================================

// ProcessKillWithAntiSnowball computes the final kill reward with all anti-snowball
// mechanics applied (underdog + bounty).
func ProcessKillWithAntiSnowball(
	killer *domain.Agent,
	victim *domain.Agent,
	bm *BountyManager,
) KillReward {
	// 1. Base kill reward
	reward := CalcKillReward(victim.Level)

	// 2. Underdog bonus (lower level kills higher)
	ApplyUnderdogBonus(&reward, killer.Level, victim.Level)

	// 3. Bounty multiplier (if victim was bountied)
	bountyInfo := bm.OnDeath(victim.ID)
	if bountyInfo != nil {
		ApplyBountyMultiplier(&reward)
		// Add extra bounty value as bonus XP
		reward.XP += bountyInfo.BountyValue
	}

	// 4. XP orb drop from victim
	reward.XPOrbDrop = CalcKillXPOrbDrop(victim.XP)

	// 5. Update killer's bounty (streak continues)
	bm.OnKill(killer.ID)

	return reward
}

// ============================================================
// Respawn Protection
// ============================================================

// RespawnProtection ensures build is preserved on respawn.
// In v14 deathmatch, level, weapons, passives, and synergies are always kept.
// This function is a documentation-level assertion; the actual preservation
// happens in RespawnAgent (combat.go) which only resets HP and position.
func RespawnProtection(a *domain.Agent) {
	// Verify: level, weapons, passives, synergies should be unchanged.
	// HP is reset to MaxHP. Position is randomized. Deaths counter incremented.
	// No field zeroing here — RespawnAgent handles the actual respawn.
	// This is called AFTER RespawnAgent to verify integrity.
	if a.Level < 1 {
		a.Level = 1
	}
	if a.WeaponSlots == nil {
		a.WeaponSlots = make([]domain.WeaponSlot, 0, domain.MaxWeaponSlots)
	}
	if a.Passives == nil {
		a.Passives = make(map[domain.PassiveType]int)
	}
}
