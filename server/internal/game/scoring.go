package game

// CalcBattleScore computes a player's battle score for sovereignty determination.
//
// Scoring formula (v11 §4.1):
//   - Survived the round: 100 + kills*15 + level*10 + int(damage*0.5)
//   - Died during round:  kills*15 + level*10 + int(damage*0.5) + int(survivalSec*2)
func CalcBattleScore(alive bool, kills, level int, damage, survivalSec float64) int {
	base := 0
	if alive {
		base = 100
	}

	killScore := kills * 15
	levelScore := level * 10
	damageScore := int(damage * 0.5)

	score := base + killScore + levelScore + damageScore

	// Dead players get survival time bonus instead of alive bonus
	if !alive {
		score += int(survivalSec * 2)
	}

	return score
}

// TopPlayerInfo holds summarized player info for round_end.
type TopPlayerInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Score    int    `json:"score"`
	Kills    int    `json:"kills"`
	Level    int    `json:"level"`
	Alive    bool   `json:"alive"`
	Faction  string `json:"faction,omitempty"`
}
