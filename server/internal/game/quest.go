package game

import (
	"net/http"
	"sync"
)

// ─── Quest Definitions ───

// QuestDef defines a single quest.
type QuestDef struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Requirement int    `json:"requirement"`
	RPReward    int    `json:"rpReward"`
}

// AllQuests defines the 8 available quests.
var AllQuests = []QuestDef{
	{ID: "triple_kill", Name: "Triple Threat", Description: "Get 3 kills in one round", Requirement: 3, RPReward: 50},
	{ID: "level_eight", Name: "Master Scholar", Description: "Reach level 8", Requirement: 8, RPReward: 75},
	{ID: "double_synergy", Name: "Synergy Seeker", Description: "Activate 2 synergies", Requirement: 2, RPReward: 100},
	{ID: "survivor", Name: "Iron Will", Description: "Survive 5 minutes", Requirement: 300, RPReward: 60},
	{ID: "tome_master", Name: "Tome Master", Description: "Stack a tome to 5", Requirement: 5, RPReward: 40},
	{ID: "ability_collector", Name: "Arsenal Ready", Description: "Equip 3 abilities", Requirement: 3, RPReward: 80},
	{ID: "podium", Name: "Podium Finish", Description: "Finish Top 3", Requirement: 3, RPReward: 30},
	{ID: "dedicated", Name: "Dedicated Agent", Description: "Play 5 rounds", Requirement: 5, RPReward: 120},
}

// QuestProgress tracks progress for a single quest.
type QuestProgress struct {
	QuestID   string `json:"questId"`
	Progress  int    `json:"progress"`
	Completed bool   `json:"completed"`
	Claimed   bool   `json:"claimed"`
}

// CompletedQuest describes a quest completed in the current round.
type CompletedQuest struct {
	QuestID  string `json:"questId"`
	Name     string `json:"name"`
	RPReward int    `json:"rpReward"`
}

// ─── Quest Tracker ───

// QuestTracker manages quest progress per player.
type QuestTracker struct {
	progress map[string]map[string]*QuestProgress // playerName -> questID -> progress
	rpStore  *RPStore
	mu       sync.RWMutex
}

// NewQuestTracker creates a new QuestTracker.
func NewQuestTracker(rpStore *RPStore) *QuestTracker {
	return &QuestTracker{
		progress: make(map[string]map[string]*QuestProgress),
		rpStore:  rpStore,
	}
}

// GetProgress returns quest progress for a player.
func (qt *QuestTracker) GetProgress(name string) []QuestProgress {
	qt.mu.RLock()
	defer qt.mu.RUnlock()

	result := make([]QuestProgress, 0, len(AllQuests))
	playerProgress := qt.progress[name]

	for _, q := range AllQuests {
		if playerProgress != nil {
			if p, ok := playerProgress[q.ID]; ok {
				result = append(result, *p)
				continue
			}
		}
		result = append(result, QuestProgress{
			QuestID:   q.ID,
			Progress:  0,
			Completed: false,
			Claimed:   false,
		})
	}

	return result
}

// CheckQuests evaluates quest completion after a round.
func (qt *QuestTracker) CheckQuests(name string, result RoundResult) []CompletedQuest {
	qt.mu.Lock()
	defer qt.mu.Unlock()

	if qt.progress[name] == nil {
		qt.progress[name] = make(map[string]*QuestProgress)
	}
	pp := qt.progress[name]

	var completed []CompletedQuest

	for _, q := range AllQuests {
		if pp[q.ID] == nil {
			pp[q.ID] = &QuestProgress{QuestID: q.ID}
		}
		p := pp[q.ID]
		if p.Completed {
			continue // already done
		}

		// Evaluate quest
		switch q.ID {
		case "triple_kill":
			if result.Kills >= q.Requirement {
				p.Progress = result.Kills
				p.Completed = true
			} else {
				p.Progress = result.Kills
			}

		case "level_eight":
			if result.FinalLevel >= q.Requirement {
				p.Progress = result.FinalLevel
				p.Completed = true
			} else if result.FinalLevel > p.Progress {
				p.Progress = result.FinalLevel
			}

		case "double_synergy":
			synCount := len(result.Synergies)
			if synCount >= q.Requirement {
				p.Progress = synCount
				p.Completed = true
			} else if synCount > p.Progress {
				p.Progress = synCount
			}

		case "survivor":
			if result.SurvivalTimeSec >= float64(q.Requirement) {
				p.Progress = q.Requirement
				p.Completed = true
			} else if int(result.SurvivalTimeSec) > p.Progress {
				p.Progress = int(result.SurvivalTimeSec)
			}

		case "tome_master":
			maxStack := 0
			for _, stacks := range result.Tomes {
				if stacks > maxStack {
					maxStack = stacks
				}
			}
			if maxStack >= q.Requirement {
				p.Progress = maxStack
				p.Completed = true
			} else if maxStack > p.Progress {
				p.Progress = maxStack
			}

		case "ability_collector":
			abilityCount := len(result.Abilities)
			if abilityCount >= q.Requirement {
				p.Progress = abilityCount
				p.Completed = true
			} else if abilityCount > p.Progress {
				p.Progress = abilityCount
			}

		case "podium":
			if result.Rank <= q.Requirement && result.Rank > 0 {
				p.Progress = 1 // binary: finished or not
				p.Completed = true
			}

		case "dedicated":
			p.Progress++
			if p.Progress >= q.Requirement {
				p.Completed = true
			}
		}

		if p.Completed && !p.Claimed {
			p.Claimed = true
			// Award RP
			qt.rpStore.RecordRP(name, q.RPReward)
			completed = append(completed, CompletedQuest{
				QuestID:  q.ID,
				Name:     q.Name,
				RPReward: q.RPReward,
			})
		}
	}

	return completed
}

// ─── HTTP Handlers (on MetaAPI) ───

// HandleGetQuests handles GET /api/meta/quests?name=X.
func (m *MetaAPI) HandleGetQuests(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}

	progress := m.questTracker.GetProgress(name)

	// Combine quest definitions with progress
	type QuestWithProgress struct {
		QuestDef
		Progress  int  `json:"progress"`
		Completed bool `json:"completed"`
		Claimed   bool `json:"claimed"`
	}

	result := make([]QuestWithProgress, 0, len(AllQuests))
	for i, q := range AllQuests {
		qp := QuestWithProgress{
			QuestDef: q,
		}
		if i < len(progress) {
			qp.Progress = progress[i].Progress
			qp.Completed = progress[i].Completed
			qp.Claimed = progress[i].Claimed
		}
		result = append(result, qp)
	}

	writeJSON(w, http.StatusOK, result)
}
