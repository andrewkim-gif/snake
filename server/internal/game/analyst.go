package game

import (
	"fmt"
	"sort"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// Analyst Agent (S58)
// Rule-based post-round analysis for human players.
// Generates build efficiency, positioning, and improvement suggestions.
// Phase 5+ will integrate LLM for richer analysis.
// ============================================================

// RoundAnalysis is the analysis payload sent to a player after a round.
type RoundAnalysis struct {
	PlayerID     string              `json:"playerId"`
	BuildAnalysis BuildAnalysisData  `json:"buildAnalysis"`
	CombatAnalysis CombatAnalysisData `json:"combatAnalysis"`
	Suggestions  []Suggestion        `json:"suggestions"`
	OverallGrade string              `json:"overallGrade"` // "S", "A", "B", "C", "D"
}

// BuildAnalysisData evaluates the player's build choices.
type BuildAnalysisData struct {
	BuildPath      string   `json:"buildPath"`      // classified build path
	Efficiency     float64  `json:"efficiency"`      // 0-100 score
	SynergyStatus  string   `json:"synergyStatus"`   // "completed", "partial", "none"
	ActiveSynergies []string `json:"activeSynergies"`
	TomeDistribution map[string]int `json:"tomeDistribution"`
	Assessment     string   `json:"assessment"` // human-readable summary
}

// CombatAnalysisData evaluates combat performance.
type CombatAnalysisData struct {
	KillDeathRatio float64 `json:"killDeathRatio"`
	DamageDealt    float64 `json:"damageDealt,omitempty"`
	SurvivalTime   int     `json:"survivalTime"` // seconds
	PositionScore  float64 `json:"positionScore"` // 0-100 based on zone choices
	Assessment     string  `json:"assessment"`    // human-readable summary
}

// Suggestion is a single improvement suggestion.
type Suggestion struct {
	Priority int    `json:"priority"` // 1=highest
	Icon     string `json:"icon"`
	Text     string `json:"text"`
}

// AnalystAgent generates post-round analysis for human players.
type AnalystAgent struct{}

// NewAnalystAgent creates a new analyst agent.
func NewAnalystAgent() *AnalystAgent {
	return &AnalystAgent{}
}

// AnalyzeRound generates a complete analysis for a player's round performance.
func (a *AnalystAgent) AnalyzeRound(
	agent *domain.Agent,
	rank int,
	totalPlayers int,
	survivalTime int,
	roundDuration int,
) *RoundAnalysis {
	if agent == nil {
		return nil
	}

	analysis := &RoundAnalysis{
		PlayerID: agent.ID,
	}

	// Build analysis
	analysis.BuildAnalysis = a.analyzeBuild(agent)

	// Combat analysis
	analysis.CombatAnalysis = a.analyzeCombat(agent, rank, survivalTime, roundDuration)

	// Generate suggestions (top 3)
	analysis.Suggestions = a.generateSuggestions(agent, rank, totalPlayers, survivalTime, roundDuration)

	// Overall grade
	analysis.OverallGrade = a.computeGrade(rank, totalPlayers, agent.Level, agent.Kills, survivalTime, roundDuration)

	return analysis
}

// analyzeBuild evaluates the player's build choices.
func (a *AnalystAgent) analyzeBuild(agent *domain.Agent) BuildAnalysisData {
	buildType := classifyBuildType(agent.Build)
	efficiency := computeBuildEfficiency(agent)

	synergyStatus := "none"
	if len(agent.ActiveSynergies) > 0 {
		synergyStatus = "completed"
	} else {
		nearbySynergies := computeNearbySynergies(agent)
		if len(nearbySynergies) > 0 {
			synergyStatus = "partial"
		}
	}

	tomeDistribution := make(map[string]int)
	for tomeType, stacks := range agent.Build.Tomes {
		if stacks > 0 {
			tomeDistribution[string(tomeType)] = stacks
		}
	}

	assessment := generateBuildAssessment(buildType, efficiency, synergyStatus, agent.Level)

	return BuildAnalysisData{
		BuildPath:      buildType,
		Efficiency:     efficiency,
		SynergyStatus:  synergyStatus,
		ActiveSynergies: agent.ActiveSynergies,
		TomeDistribution: tomeDistribution,
		Assessment:     assessment,
	}
}

// analyzeCombat evaluates combat performance.
func (a *AnalystAgent) analyzeCombat(
	agent *domain.Agent,
	rank int,
	survivalTime int,
	roundDuration int,
) CombatAnalysisData {
	kdr := float64(agent.Kills)
	if !agent.Alive {
		kdr = float64(agent.Kills) / 1.0 // 1 death
	}

	// Position score: survival time / round duration * 100
	positionScore := 0.0
	if roundDuration > 0 {
		positionScore = float64(survivalTime) / float64(roundDuration) * 100
		if positionScore > 100 {
			positionScore = 100
		}
	}

	assessment := generateCombatAssessment(kdr, rank, survivalTime, roundDuration)

	return CombatAnalysisData{
		KillDeathRatio: kdr,
		SurvivalTime:   survivalTime,
		PositionScore:  positionScore,
		Assessment:     assessment,
	}
}

// generateSuggestions creates 3 improvement suggestions.
func (a *AnalystAgent) generateSuggestions(
	agent *domain.Agent,
	rank int,
	totalPlayers int,
	survivalTime int,
	roundDuration int,
) []Suggestion {
	var suggestions []Suggestion

	// Suggestion 1: Build-related
	if len(agent.ActiveSynergies) == 0 {
		nearbySynergies := computeNearbySynergies(agent)
		if len(nearbySynergies) > 0 {
			suggestions = append(suggestions, Suggestion{
				Priority: 1,
				Icon:     "build",
				Text:     fmt.Sprintf("You were 1 upgrade away from completing a synergy! Focus your build path for synergy bonuses."),
			})
		} else {
			suggestions = append(suggestions, Suggestion{
				Priority: 1,
				Icon:     "build",
				Text:     "Try focusing on a specific build path (e.g., Berserker or Tank) to unlock synergy bonuses.",
			})
		}
	} else {
		suggestions = append(suggestions, Suggestion{
			Priority: 3,
			Icon:     "build",
			Text:     fmt.Sprintf("Great synergy activation! Consider stacking more of your core tomes for even stronger effects."),
		})
	}

	// Suggestion 2: Survival-related
	survivalRatio := float64(survivalTime) / float64(roundDuration)
	if survivalRatio < 0.5 {
		suggestions = append(suggestions, Suggestion{
			Priority: 1,
			Icon:     "survival",
			Text:     "You died early. Try staying near the center and avoiding stronger enemies until you level up.",
		})
	} else if survivalRatio < 0.8 {
		suggestions = append(suggestions, Suggestion{
			Priority: 2,
			Icon:     "survival",
			Text:     "Consider picking more defensive upgrades (Armor, Regen) in the late game to survive longer.",
		})
	} else {
		suggestions = append(suggestions, Suggestion{
			Priority: 3,
			Icon:     "survival",
			Text:     "Excellent survival! Keep using zone awareness and avoiding the boundary.",
		})
	}

	// Suggestion 3: Kill/positioning-related
	if agent.Kills == 0 && rank > totalPlayers/2 {
		suggestions = append(suggestions, Suggestion{
			Priority: 2,
			Icon:     "combat",
			Text:     "No kills this round. Try engaging enemies weaker than you or use dash attacks for burst damage.",
		})
	} else if agent.Kills >= 5 {
		suggestions = append(suggestions, Suggestion{
			Priority: 3,
			Icon:     "combat",
			Text:     fmt.Sprintf("Impressive %d kills! You might benefit from a more aggressive build path like Berserker.", agent.Kills),
		})
	} else {
		suggestions = append(suggestions, Suggestion{
			Priority: 2,
			Icon:     "combat",
			Text:     "Look for Speed Gate map objects to chase down weakened enemies for kills.",
		})
	}

	// Sort by priority
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Priority < suggestions[j].Priority
	})

	// Keep top 3
	if len(suggestions) > 3 {
		suggestions = suggestions[:3]
	}

	return suggestions
}

// computeGrade assigns an overall grade.
func (a *AnalystAgent) computeGrade(rank, totalPlayers, level, kills, survivalTime, roundDuration int) string {
	score := 0

	// Rank score (0-40)
	if totalPlayers > 0 {
		rankPercent := float64(totalPlayers-rank) / float64(totalPlayers)
		score += int(rankPercent * 40)
	}

	// Level score (0-20)
	levelScore := level * 2
	if levelScore > 20 {
		levelScore = 20
	}
	score += levelScore

	// Kill score (0-20)
	killScore := kills * 4
	if killScore > 20 {
		killScore = 20
	}
	score += killScore

	// Survival score (0-20)
	if roundDuration > 0 {
		survivalScore := int(float64(survivalTime) / float64(roundDuration) * 20)
		if survivalScore > 20 {
			survivalScore = 20
		}
		score += survivalScore
	}

	switch {
	case score >= 85:
		return "S"
	case score >= 70:
		return "A"
	case score >= 50:
		return "B"
	case score >= 30:
		return "C"
	default:
		return "D"
	}
}

// --- Assessment text generators ---

func computeBuildEfficiency(agent *domain.Agent) float64 {
	if agent.Level <= 1 {
		return 0
	}

	// Build efficiency: how focused was the build?
	totalStacks := 0
	maxStacks := 0
	for _, stacks := range agent.Build.Tomes {
		totalStacks += stacks
		if stacks > maxStacks {
			maxStacks = stacks
		}
	}

	if totalStacks == 0 {
		return 0
	}

	// Higher focus = higher efficiency (max stack / total * 100)
	focusRatio := float64(maxStacks) / float64(totalStacks) * 100

	// Synergy bonus
	synergyBonus := float64(len(agent.ActiveSynergies)) * 15

	efficiency := focusRatio + synergyBonus
	if efficiency > 100 {
		efficiency = 100
	}

	return efficiency
}

func generateBuildAssessment(buildType string, efficiency float64, synergyStatus string, level int) string {
	if level <= 2 {
		return "Not enough levels to evaluate your build. Try to survive longer!"
	}

	assessments := map[string]string{
		"berserker": "Aggressive DPS build detected.",
		"tank":      "Defensive survival build detected.",
		"speedster": "Speed-focused evasion build detected.",
		"farmer":    "XP farming build detected.",
		"balanced":  "Mixed build with no clear specialization.",
	}

	base := assessments[buildType]
	if base == "" {
		base = "Mixed build detected."
	}

	switch {
	case efficiency >= 80:
		base += " Excellent focus!"
	case efficiency >= 50:
		base += " Good focus, but could be tighter."
	default:
		base += " Try concentrating on fewer tome types for better synergy chances."
	}

	if synergyStatus == "partial" {
		base += " You were close to completing a synergy!"
	}

	return base
}

func generateCombatAssessment(kdr float64, rank int, survivalTime, roundDuration int) string {
	if survivalTime < 30 {
		return "Very early death. Focus on positioning and avoiding stronger enemies."
	}

	survivalRatio := float64(survivalTime) / float64(roundDuration)

	switch {
	case rank == 1:
		return "Victory! Outstanding combat performance."
	case rank <= 3:
		return fmt.Sprintf("Top 3 finish with %.0f kills. Strong performance!", kdr)
	case survivalRatio > 0.8:
		return "Good survival, but consider being more aggressive to climb ranks."
	case kdr >= 3:
		return fmt.Sprintf("%.0f kills is impressive, but focus on staying alive longer.", kdr)
	default:
		return "Room for improvement in both survival and combat. Try a focused build path."
	}
}

// Note: synergyCompletionScore is defined in bot.go (shared utility).
