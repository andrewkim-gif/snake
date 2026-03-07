package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 4 — S20: Kill Reward System
// Kill rewards: XP (100+targetLv×10), Gold (50+targetLv×5), NationScore (10+targetLv×2)
// Assist: 5s damage window → 40% rewards
// Kill drops: 20% of victim's XP as orbs
// ============================================================

// Kill reward constants
const (
	KillGoldBase     = 50
	KillGoldPerLevel = 5

	KillNationScoreBase     = 10
	KillNationScorePerLevel = 2

	KillXPOrbDropFraction = 0.20 // 20% of victim's XP drops as orbs

	// Assist tracking
	AssistWindowTicks  = 5 * TickRate // 5 seconds
	AssistRewardFraction = 0.40       // 40% of kill rewards
)

// KillReward holds the computed rewards for a kill.
type KillReward struct {
	XP          int `json:"xp"`
	Gold        int `json:"gold"`
	NationScore int `json:"nationScore"`
	XPOrbDrop   int `json:"xpOrbDrop"` // XP to drop as orbs at kill location
}

// CalcKillReward computes the full reward package for killing a target.
func CalcKillReward(targetLevel int) KillReward {
	return KillReward{
		XP:          CalcKillXP(targetLevel),
		Gold:        KillGoldBase + targetLevel*KillGoldPerLevel,
		NationScore: KillNationScoreBase + targetLevel*KillNationScorePerLevel,
	}
}

// CalcKillXPOrbDrop returns the XP amount to drop as orbs at kill location.
// Based on victim's current XP (20% of their accumulated XP in the epoch).
func CalcKillXPOrbDrop(victimXP int) int {
	drop := int(float64(victimXP) * KillXPOrbDropFraction)
	if drop < 5 {
		drop = 5 // minimum 5 XP orbs
	}
	if drop > 500 {
		drop = 500 // cap at 500
	}
	return drop
}

// CalcAssistReward returns a fraction (40%) of the kill reward.
func CalcAssistReward(targetLevel int) KillReward {
	full := CalcKillReward(targetLevel)
	return KillReward{
		XP:          int(float64(full.XP) * AssistRewardFraction),
		Gold:        int(float64(full.Gold) * AssistRewardFraction),
		NationScore: int(float64(full.NationScore) * AssistRewardFraction),
		XPOrbDrop:   0, // assists don't drop additional orbs
	}
}

// ============================================================
// Assist Tracker — tracks damage contributors within 5s window
// ============================================================

// DamageContribution records a damage event for assist tracking.
type DamageContribution struct {
	AttackerID string
	Damage     float64
	Tick       uint64
}

// AssistTracker tracks recent damage to each agent for assist determination.
type AssistTracker struct {
	// victimID → list of recent damage contributions
	contributions map[string][]DamageContribution
}

// NewAssistTracker creates a new assist tracker.
func NewAssistTracker() *AssistTracker {
	return &AssistTracker{
		contributions: make(map[string][]DamageContribution),
	}
}

// RecordDamage records a damage event from attacker to victim.
func (at *AssistTracker) RecordDamage(attackerID, victimID string, damage float64, currentTick uint64) {
	at.contributions[victimID] = append(at.contributions[victimID], DamageContribution{
		AttackerID: attackerID,
		Damage:     damage,
		Tick:       currentTick,
	})
}

// GetAssists returns the list of attacker IDs who dealt damage to the victim
// within the assist window, EXCLUDING the killer.
func (at *AssistTracker) GetAssists(victimID, killerID string, currentTick uint64) []string {
	contribs, ok := at.contributions[victimID]
	if !ok {
		return nil
	}

	seen := make(map[string]bool)
	var assists []string

	cutoff := uint64(0)
	if currentTick > uint64(AssistWindowTicks) {
		cutoff = currentTick - uint64(AssistWindowTicks)
	}

	for _, c := range contribs {
		if c.Tick < cutoff {
			continue
		}
		if c.AttackerID == killerID || c.AttackerID == victimID {
			continue
		}
		if !seen[c.AttackerID] {
			seen[c.AttackerID] = true
			assists = append(assists, c.AttackerID)
		}
	}

	return assists
}

// ClearVictim removes all contributions for a victim (after death processing).
func (at *AssistTracker) ClearVictim(victimID string) {
	delete(at.contributions, victimID)
}

// CleanupOld removes expired contributions across all victims (call periodically).
func (at *AssistTracker) CleanupOld(currentTick uint64) {
	cutoff := uint64(0)
	if currentTick > uint64(AssistWindowTicks)*2 {
		cutoff = currentTick - uint64(AssistWindowTicks)*2
	}

	for victimID, contribs := range at.contributions {
		// Filter out old entries
		filtered := contribs[:0]
		for _, c := range contribs {
			if c.Tick >= cutoff {
				filtered = append(filtered, c)
			}
		}
		if len(filtered) == 0 {
			delete(at.contributions, victimID)
		} else {
			at.contributions[victimID] = filtered
		}
	}
}

// ============================================================
// Apply Kill Rewards
// ============================================================

// ApplyKillReward grants kill rewards to the killer agent.
func ApplyKillReward(killer *domain.Agent, reward KillReward) {
	// XP: use V14AddXP for Fortune passive bonus
	V14AddXP(killer, reward.XP)

	// Gold
	killer.Gold += reward.Gold

	// Kill streak
	killer.KillStreak++
	killer.Kills++
}

// ApplyAssistReward grants assist rewards to an assisting agent.
func ApplyAssistReward(assistant *domain.Agent, reward KillReward) {
	V14AddXP(assistant, reward.XP)
	assistant.Gold += reward.Gold
	assistant.Assists++
}
