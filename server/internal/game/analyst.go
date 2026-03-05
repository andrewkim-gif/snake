package game

import (
	"encoding/json"
	"math"
	"net/http"
)

// ─── Round Analysis ───

// RoundAnalysis contains the AI analysis of a player's round performance.
type RoundAnalysis struct {
	BuildEfficiency  float64  `json:"buildEfficiency"`  // 0-100
	CombatScore      float64  `json:"combatScore"`      // 0-100
	PositioningScore float64  `json:"positioningScore"` // 0-100
	Suggestions      []string `json:"suggestions"`
}

// AnalyzeRound performs AI analysis on a round result.
func AnalyzeRound(result RoundResult, roundDurationSec float64) RoundAnalysis {
	analysis := RoundAnalysis{
		Suggestions: make([]string, 0, 3),
	}

	// Build efficiency: synergies achieved as a fraction of max possible (10 synergies)
	maxSynergies := 10.0
	synCount := float64(len(result.Synergies))
	analysis.BuildEfficiency = math.Min(100, (synCount/maxSynergies)*100)

	// Also factor in tome stacking (max stacks per tome is 5, 8 tomes)
	totalStacks := 0
	for _, stacks := range result.Tomes {
		totalStacks += stacks
	}
	tomeEfficiency := math.Min(100, float64(totalStacks)/20.0*100)
	analysis.BuildEfficiency = (analysis.BuildEfficiency + tomeEfficiency) / 2

	// Combat score: kills weighted by level
	if result.FinalLevel > 0 {
		killsPerLevel := float64(result.Kills) / float64(result.FinalLevel)
		analysis.CombatScore = math.Min(100, killsPerLevel*50)
	}
	// Bonus for high kill count
	if result.Kills >= 5 {
		analysis.CombatScore = math.Min(100, analysis.CombatScore+20)
	}

	// Positioning score: survival time as fraction of round duration
	if roundDurationSec > 0 {
		survivalRatio := result.SurvivalTimeSec / roundDurationSec
		analysis.PositioningScore = math.Min(100, survivalRatio*100)
	}
	// Bonus for top rank
	if result.Rank <= 3 {
		analysis.PositioningScore = math.Min(100, analysis.PositioningScore+15)
	}

	// Generate 3 suggestions based on weakest areas
	type scoredArea struct {
		name  string
		score float64
	}
	areas := []scoredArea{
		{"build", analysis.BuildEfficiency},
		{"combat", analysis.CombatScore},
		{"positioning", analysis.PositioningScore},
	}

	// Sort ascending (weakest first)
	for i := 0; i < len(areas); i++ {
		for j := i + 1; j < len(areas); j++ {
			if areas[j].score < areas[i].score {
				areas[i], areas[j] = areas[j], areas[i]
			}
		}
	}

	for _, area := range areas {
		switch area.name {
		case "build":
			if area.score < 40 {
				analysis.Suggestions = append(analysis.Suggestions, "Focus on completing synergy combos for bonus power.")
			} else if area.score < 70 {
				analysis.Suggestions = append(analysis.Suggestions, "Try stacking tomes higher for stronger effects.")
			} else {
				analysis.Suggestions = append(analysis.Suggestions, "Great build! Consider experimenting with new combos.")
			}
		case "combat":
			if area.score < 30 {
				analysis.Suggestions = append(analysis.Suggestions, "Upgrade damage tomes and engage weaker opponents.")
			} else if area.score < 60 {
				analysis.Suggestions = append(analysis.Suggestions, "Use dash attacks on low-health targets for efficient kills.")
			} else {
				analysis.Suggestions = append(analysis.Suggestions, "Strong combat performance! Target high-value opponents.")
			}
		case "positioning":
			if area.score < 40 {
				analysis.Suggestions = append(analysis.Suggestions, "Stay closer to center for safety and resources.")
			} else if area.score < 70 {
				analysis.Suggestions = append(analysis.Suggestions, "Watch the arena shrink timer and reposition early.")
			} else {
				analysis.Suggestions = append(analysis.Suggestions, "Excellent positioning! Use edge awareness to trap others.")
			}
		}
	}

	// Cap to 3 suggestions
	if len(analysis.Suggestions) > 3 {
		analysis.Suggestions = analysis.Suggestions[:3]
	}

	// Round scores to 1 decimal
	analysis.BuildEfficiency = math.Round(analysis.BuildEfficiency*10) / 10
	analysis.CombatScore = math.Round(analysis.CombatScore*10) / 10
	analysis.PositioningScore = math.Round(analysis.PositioningScore*10) / 10

	return analysis
}

// ─── HTTP Handler (on MetaAPI) ───

// HandleAnalyze handles POST /api/meta/analyze.
func (m *MetaAPI) HandleAnalyze(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RoundResult      RoundResult `json:"roundResult"`
		RoundDurationSec float64     `json:"roundDurationSec"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if req.RoundDurationSec <= 0 {
		req.RoundDurationSec = 300 // default 5 minutes
	}

	analysis := AnalyzeRound(req.RoundResult, req.RoundDurationSec)
	writeJSON(w, http.StatusOK, analysis)
}

// decodeJSON is a helper to decode request body.
func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
