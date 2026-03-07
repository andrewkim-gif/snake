package game

import (
	"log/slog"
	"time"
)

// ============================================================
// v14 Phase 7 — S33: War Resolution
// War end effects: winner (+30% GDP, +20% military, +10 happiness)
//                  loser  (-30% GDP, -20% military, -20 happiness)
// Auto-surrender at 3x score gap.
// Reputation effects based on war type (defensive vs aggressive).
// ============================================================

// War resolution reward/penalty constants
const (
	// Winner rewards
	WarWinnerGDPBonus      = 30.0  // +30% GDP for 7 days
	WarWinnerMilitaryBonus = 20.0  // +20% military for 7 days
	WarWinnerHappiness     = 10.0  // +10 happiness

	// Loser penalties
	WarLoserGDPPenalty      = -30.0 // -30% GDP for 7 days
	WarLoserMilitaryPenalty = -20.0 // -20% military for 7 days
	WarLoserHappiness       = -20.0 // -20 happiness

	// Reputation effects
	WarRepDefensiveWin  = 20.0  // winning a defensive war
	WarRepAggressiveWin = -10.0 // winning an aggressive war
	WarRepLoser         = -5.0  // losing any war

	// Duration of war effect bonuses
	WarEffectDurationDays = 7
)

// WarResolutionResult holds the result of war resolution.
type WarResolutionResult struct {
	WarID          string     `json:"warId"`
	Outcome        WarOutcome `json:"outcome"`
	Winner         string     `json:"winner"`
	Loser          string     `json:"loser"`
	AttackerScore  int        `json:"attackerScore"`
	DefenderScore  int        `json:"defenderScore"`
	WinnerRewards  WarEffects `json:"winnerRewards"`
	LoserPenalties WarEffects `json:"loserPenalties"`
	Timestamp      time.Time  `json:"timestamp"`
}

// WarEffects describes the stat changes applied after war.
type WarEffects struct {
	GDPPercent      float64 `json:"gdpPercent"`      // percentage modifier
	MilitaryPercent float64 `json:"militaryPercent"`  // percentage modifier
	HappinessDelta  float64 `json:"happinessDelta"`   // absolute modifier
	ReputationDelta float64 `json:"reputationDelta"`  // absolute modifier
	DurationDays    int     `json:"durationDays"`     // how long the effect lasts
}

// WarResolver handles war resolution and applies outcomes.
type WarResolver struct {
	// Dependency: get nation stats engine for a country
	getNationStats func(countryCode string) *NationStatsEngine

	// Dependency: get sovereignty tracker for domination transfer
	getSovereignty func(countryCode string) *SovereigntyTracker

	// Event callback for resolution events
	OnResolution func(result WarResolutionResult)
}

// NewWarResolver creates a new war resolution handler.
func NewWarResolver(
	getNationStats func(string) *NationStatsEngine,
	getSovereignty func(string) *SovereigntyTracker,
) *WarResolver {
	return &WarResolver{
		getNationStats: getNationStats,
		getSovereignty: getSovereignty,
	}
}

// ResolveWar processes the end of a war and applies rewards/penalties.
func (wr *WarResolver) ResolveWar(war *War) *WarResolutionResult {
	if war == nil || war.State != WarStateEnded {
		return nil
	}

	now := time.Now()

	// Determine winner and loser based on outcome
	var winner, loser string
	switch war.Outcome {
	case WarOutcomeAttackerWin, WarOutcomeAutoSurrender:
		if war.AttackerScore >= war.DefenderScore {
			winner = war.Attacker
			loser = war.Defender
		} else {
			winner = war.Defender
			loser = war.Attacker
		}
	case WarOutcomeDefenderWin:
		winner = war.Defender
		loser = war.Attacker
	case WarOutcomeFatigueEnd:
		// Higher score wins; if tied, defender advantage
		if war.AttackerScore > war.DefenderScore {
			winner = war.Attacker
			loser = war.Defender
		} else {
			winner = war.Defender
			loser = war.Attacker
		}
	case WarOutcomeTruce:
		// No clear winner in a truce — apply reduced penalties to both
		wr.applyTruceEffects(war, now)
		return &WarResolutionResult{
			WarID:         war.ID,
			Outcome:       war.Outcome,
			AttackerScore: war.AttackerScore,
			DefenderScore: war.DefenderScore,
			Timestamp:     now,
		}
	default:
		return nil
	}

	// Calculate reputation based on war type
	winnerRep := WarRepAggressiveWin
	if winner == war.Defender {
		winnerRep = WarRepDefensiveWin // defensive wins get positive rep
	}

	winnerRewards := WarEffects{
		GDPPercent:      WarWinnerGDPBonus,
		MilitaryPercent: WarWinnerMilitaryBonus,
		HappinessDelta:  WarWinnerHappiness,
		ReputationDelta: winnerRep,
		DurationDays:    WarEffectDurationDays,
	}

	loserPenalties := WarEffects{
		GDPPercent:      WarLoserGDPPenalty,
		MilitaryPercent: WarLoserMilitaryPenalty,
		HappinessDelta:  WarLoserHappiness,
		ReputationDelta: WarRepLoser,
		DurationDays:    WarEffectDurationDays,
	}

	// Apply effects to nation stats
	wr.applyEffects(winner, winnerRewards)
	wr.applyEffects(loser, loserPenalties)

	// Apply effects to allies
	for _, ally := range war.AttackerAllies {
		if winner == war.Attacker {
			wr.applyAllyEffects(ally, winnerRewards, 0.5) // allies get 50%
		} else {
			wr.applyAllyEffects(ally, loserPenalties, 0.5)
		}
	}
	for _, ally := range war.DefenderAllies {
		if winner == war.Defender {
			wr.applyAllyEffects(ally, winnerRewards, 0.5)
		} else {
			wr.applyAllyEffects(ally, loserPenalties, 0.5)
		}
	}

	result := &WarResolutionResult{
		WarID:          war.ID,
		Outcome:        war.Outcome,
		Winner:         winner,
		Loser:          loser,
		AttackerScore:  war.AttackerScore,
		DefenderScore:  war.DefenderScore,
		WinnerRewards:  winnerRewards,
		LoserPenalties: loserPenalties,
		Timestamp:      now,
	}

	slog.Info("war resolved",
		"warId", war.ID,
		"outcome", war.Outcome,
		"winner", winner,
		"loser", loser,
		"attackerScore", war.AttackerScore,
		"defenderScore", war.DefenderScore,
	)

	if wr.OnResolution != nil {
		wr.OnResolution(*result)
	}

	return result
}

// applyEffects applies war outcome effects to a nation's stats.
func (wr *WarResolver) applyEffects(countryCode string, effects WarEffects) {
	if wr.getNationStats == nil {
		return
	}

	stats := wr.getNationStats(countryCode)
	if stats == nil {
		return
	}

	stats.ApplyWarResult(
		effects.GDPPercent,
		effects.MilitaryPercent,
		effects.HappinessDelta,
		effects.ReputationDelta,
	)

	slog.Info("war effects applied",
		"country", countryCode,
		"gdp%", effects.GDPPercent,
		"military%", effects.MilitaryPercent,
		"happiness", effects.HappinessDelta,
		"reputation", effects.ReputationDelta,
	)
}

// applyAllyEffects applies scaled effects to allied nations.
func (wr *WarResolver) applyAllyEffects(countryCode string, effects WarEffects, scale float64) {
	if wr.getNationStats == nil {
		return
	}

	stats := wr.getNationStats(countryCode)
	if stats == nil {
		return
	}

	stats.ApplyWarResult(
		effects.GDPPercent*scale,
		effects.MilitaryPercent*scale,
		effects.HappinessDelta*scale,
		effects.ReputationDelta*scale,
	)
}

// applyTruceEffects applies reduced penalties to both sides in a truce.
func (wr *WarResolver) applyTruceEffects(war *War, _ time.Time) {
	// Both sides take minor GDP/military hits
	truceEffects := WarEffects{
		GDPPercent:      -10.0, // -10% GDP
		MilitaryPercent: -10.0, // -10% military
		HappinessDelta:  -5.0,  // -5 happiness
		ReputationDelta: 0.0,
		DurationDays:    3,
	}

	wr.applyEffects(war.Attacker, truceEffects)
	wr.applyEffects(war.Defender, truceEffects)
}
