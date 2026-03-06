package game

import (
	"math/rand"
	"sync"
	"time"
)

// ============================================================
// Quest System (S54)
// 8 base quests + daily rotation + RP rewards
// ============================================================

// QuestID uniquely identifies a quest.
type QuestID string

const (
	QuestFirstBlood    QuestID = "first_blood"
	QuestSynergyMaster QuestID = "synergy_master"
	QuestSpeedDemon    QuestID = "speed_demon"
	QuestPacifist      QuestID = "pacifist"
	QuestGlassCannon   QuestID = "glass_cannon"
	QuestDiscovery     QuestID = "discovery"
	QuestComeback      QuestID = "comeback"
	QuestMarathon      QuestID = "marathon"
)

// QuestDef defines a quest template.
type QuestDef struct {
	ID          QuestID `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	RPReward    int     `json:"rpReward"`
	Repeatable  bool    `json:"repeatable"` // can be completed more than once
}

// AllQuests defines all 8 base quests.
var AllQuests = []QuestDef{
	{
		ID:          QuestFirstBlood,
		Name:        "First Blood",
		Description: "Get your first kill in a round",
		RPReward:    20,
		Repeatable:  true,
	},
	{
		ID:          QuestSynergyMaster,
		Name:        "Synergy Master",
		Description: "Activate 3 different synergies across rounds",
		RPReward:    50,
		Repeatable:  false,
	},
	{
		ID:          QuestSpeedDemon,
		Name:        "Speed Demon",
		Description: "Reach Speed Tome x5 in a single round",
		RPReward:    30,
		Repeatable:  true,
	},
	{
		ID:          QuestPacifist,
		Name:        "Pacifist",
		Description: "Finish in Top 3 with 0 kills",
		RPReward:    100,
		Repeatable:  true,
	},
	{
		ID:          QuestGlassCannon,
		Name:        "Glass Cannon",
		Description: "Win with Cursed Tome x5",
		RPReward:    150,
		Repeatable:  true,
	},
	{
		ID:          QuestDiscovery,
		Name:        "Discovery",
		Description: "Discover a hidden synergy for the first time",
		RPReward:    100,
		Repeatable:  false,
	},
	{
		ID:          QuestComeback,
		Name:        "Comeback",
		Description: "Win from level 3 or below at the 3-minute mark",
		RPReward:    200,
		Repeatable:  true,
	},
	{
		ID:          QuestMarathon,
		Name:        "Marathon",
		Description: "Participate in 20 consecutive rounds",
		RPReward:    100,
		Repeatable:  false,
	},
}

// GetQuestDef returns a quest definition by ID.
func GetQuestDef(id QuestID) *QuestDef {
	for i := range AllQuests {
		if AllQuests[i].ID == id {
			return &AllQuests[i]
		}
	}
	return nil
}

// ============================================================
// Player Quest State
// ============================================================

// PlayerQuestProgress tracks a single quest's progress.
type PlayerQuestProgress struct {
	QuestID     QuestID `json:"questId"`
	Progress    int     `json:"progress"`    // current count toward completion
	Target      int     `json:"target"`      // count needed to complete
	Completed   bool    `json:"completed"`
	CompletedAt string  `json:"completedAt,omitempty"`
}

// PlayerQuestState holds all quest state for a player.
type PlayerQuestState struct {
	PlayerID       string                         `json:"playerId"`
	ActiveDaily    []QuestID                      `json:"activeDaily"`     // 3 daily quests
	DailyResetDate string                         `json:"dailyResetDate"` // "2006-01-02"
	Quests         map[QuestID]*PlayerQuestProgress `json:"quests"`
	ConsecutiveRounds int                          `json:"consecutiveRounds"` // for marathon tracking
	TotalSynergies    int                          `json:"totalSynergies"`    // for synergy_master tracking
}

// PlayerQuestsResponse is the API response for GET /api/player/:id/quests.
type PlayerQuestsResponse struct {
	DailyQuests []QuestWithProgress `json:"dailyQuests"`
	AllQuests   []QuestWithProgress `json:"allQuests"`
	ResetIn     int                 `json:"resetIn"` // seconds until daily reset
}

// QuestWithProgress combines quest definition with player progress.
type QuestWithProgress struct {
	QuestDef
	Progress  int  `json:"progress"`
	Target    int  `json:"target"`
	Completed bool `json:"completed"`
}

// ============================================================
// Quest Store
// ============================================================

// QuestStore manages quest state for all players.
type QuestStore struct {
	mu     sync.RWMutex
	states map[string]*PlayerQuestState
	ps     *ProgressionStore // for awarding RP
}

// NewQuestStore creates a new quest store.
func NewQuestStore(ps *ProgressionStore) *QuestStore {
	return &QuestStore{
		states: make(map[string]*PlayerQuestState),
		ps:     ps,
	}
}

// getOrCreateState returns or creates player quest state.
func (qs *QuestStore) getOrCreateState(playerID string) *PlayerQuestState {
	qs.mu.Lock()
	defer qs.mu.Unlock()

	state, ok := qs.states[playerID]
	if !ok {
		state = &PlayerQuestState{
			PlayerID: playerID,
			Quests:   make(map[QuestID]*PlayerQuestProgress),
		}
		qs.states[playerID] = state
	}

	// Check and rotate daily quests
	today := time.Now().UTC().Format("2006-01-02")
	if state.DailyResetDate != today {
		state.ActiveDaily = selectDailyQuests(3)
		state.DailyResetDate = today

		// Reset daily quest progress for repeatable quests
		for _, qid := range state.ActiveDaily {
			def := GetQuestDef(qid)
			if def != nil && def.Repeatable {
				state.Quests[qid] = &PlayerQuestProgress{
					QuestID: qid,
					Target:  getQuestTarget(qid),
				}
			}
		}
	}

	return state
}

// selectDailyQuests picks n random quests from the pool.
func selectDailyQuests(n int) []QuestID {
	available := make([]QuestID, len(AllQuests))
	for i, q := range AllQuests {
		available[i] = q.ID
	}

	// Shuffle
	rand.Shuffle(len(available), func(i, j int) {
		available[i], available[j] = available[j], available[i]
	})

	if n > len(available) {
		n = len(available)
	}
	return available[:n]
}

// getQuestTarget returns the target count for a quest.
func getQuestTarget(id QuestID) int {
	switch id {
	case QuestFirstBlood:
		return 1 // 1 kill
	case QuestSynergyMaster:
		return 3 // 3 different synergies
	case QuestSpeedDemon:
		return 1 // reach speed tome x5
	case QuestPacifist:
		return 1 // finish top 3 with 0 kills
	case QuestGlassCannon:
		return 1 // win with cursed x5
	case QuestDiscovery:
		return 1 // discover hidden synergy
	case QuestComeback:
		return 1 // win from behind
	case QuestMarathon:
		return 20 // 20 consecutive rounds
	default:
		return 1
	}
}

// RoundQuestContext holds round data for quest evaluation.
type RoundQuestContext struct {
	PlayerID       string
	RoundID        string
	Rank           int
	TotalPlayers   int
	Kills          int
	Level          int
	Synergies      []string
	HiddenSynergies []string
	SpeedTomeStacks int
	CursedTomeStacks int
	LevelAt3Min     int // level at the 3-minute mark (0 if not tracked)
}

// ProcessRoundForQuests evaluates quest completion based on round results.
// Returns list of completed quest IDs.
func (qs *QuestStore) ProcessRoundForQuests(ctx RoundQuestContext) []QuestID {
	state := qs.getOrCreateState(ctx.PlayerID)

	qs.mu.Lock()
	defer qs.mu.Unlock()

	var completed []QuestID
	now := time.Now().UTC().Format(time.RFC3339)

	// Track consecutive rounds for marathon
	state.ConsecutiveRounds++

	for _, qid := range state.ActiveDaily {
		progress, ok := state.Quests[qid]
		if !ok {
			progress = &PlayerQuestProgress{
				QuestID: qid,
				Target:  getQuestTarget(qid),
			}
			state.Quests[qid] = progress
		}
		if progress.Completed {
			continue
		}

		switch qid {
		case QuestFirstBlood:
			if ctx.Kills >= 1 {
				progress.Progress = 1
			}

		case QuestSynergyMaster:
			state.TotalSynergies += len(ctx.Synergies)
			progress.Progress = state.TotalSynergies
			if progress.Progress > progress.Target {
				progress.Progress = progress.Target
			}

		case QuestSpeedDemon:
			if ctx.SpeedTomeStacks >= 5 {
				progress.Progress = 1
			}

		case QuestPacifist:
			if ctx.Kills == 0 && ctx.Rank <= 3 {
				progress.Progress = 1
			}

		case QuestGlassCannon:
			if ctx.CursedTomeStacks >= 5 && ctx.Rank == 1 {
				progress.Progress = 1
			}

		case QuestDiscovery:
			if len(ctx.HiddenSynergies) > 0 {
				progress.Progress = 1
			}

		case QuestComeback:
			if ctx.Rank == 1 && ctx.LevelAt3Min > 0 && ctx.LevelAt3Min <= 3 {
				progress.Progress = 1
			}

		case QuestMarathon:
			progress.Progress = state.ConsecutiveRounds
			if progress.Progress > progress.Target {
				progress.Progress = progress.Target
			}
		}

		// Check completion
		if progress.Progress >= progress.Target && !progress.Completed {
			progress.Completed = true
			progress.CompletedAt = now
			completed = append(completed, qid)

			// Award RP
			if qs.ps != nil {
				def := GetQuestDef(qid)
				if def != nil {
					qs.ps.AwardRP(ctx.PlayerID, RPSourceQuestComplete, def.RPReward, ctx.RoundID)
				}
			}
		}
	}

	return completed
}

// GetPlayerQuestsResponse builds the API response for quest state.
func (qs *QuestStore) GetPlayerQuestsResponse(playerID string) *PlayerQuestsResponse {
	state := qs.getOrCreateState(playerID)

	qs.mu.RLock()
	defer qs.mu.RUnlock()

	resp := &PlayerQuestsResponse{
		DailyQuests: make([]QuestWithProgress, 0),
		AllQuests:   make([]QuestWithProgress, 0),
	}

	// Calculate reset time (next midnight UTC)
	now := time.Now().UTC()
	nextMidnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	resp.ResetIn = int(nextMidnight.Sub(now).Seconds())

	// Daily quests
	for _, qid := range state.ActiveDaily {
		def := GetQuestDef(qid)
		if def == nil {
			continue
		}
		progress := state.Quests[qid]
		qwp := QuestWithProgress{
			QuestDef: *def,
			Target:   getQuestTarget(qid),
		}
		if progress != nil {
			qwp.Progress = progress.Progress
			qwp.Completed = progress.Completed
		}
		resp.DailyQuests = append(resp.DailyQuests, qwp)
	}

	// All quests
	for _, def := range AllQuests {
		progress := state.Quests[def.ID]
		qwp := QuestWithProgress{
			QuestDef: def,
			Target:   getQuestTarget(def.ID),
		}
		if progress != nil {
			qwp.Progress = progress.Progress
			qwp.Completed = progress.Completed
		}
		resp.AllQuests = append(resp.AllQuests, qwp)
	}

	return resp
}
