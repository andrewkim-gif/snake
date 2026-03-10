package game

import (
	"sort"
	"sync"
	"time"
)

// ============================================================
// v33 Phase 1 — ScoreAggregator: Independent score tracking
// for Online Matrix epochs. Maintains its own history separate
// from NationScoreTracker (which resets each epoch via
// DominationEngine).
//
// Score formula (v33 Matrix-specific):
//   Kill = 15 points
//   Level = level × 10 points
//   Damage = totalDamage × 0.5 points
//   Survival = 100 points (alive at epoch end)
//
// ⚠️ DESIGN NOTE: NationScoreTracker.Reset() is called each
// epoch by DominationEngine. ScoreAggregator maintains its own
// independent snapshot history so reward calculations don't
// lose data.
// ============================================================

// Matrix score weights (v33 formula, different from v14 NationScore)
const (
	MatrixScorePerKill      = 15
	MatrixScorePerLevel     = 10
	MatrixScorePerDamage    = 0.5
	MatrixScoreSurvivalBonus = 100
	MatrixScorePerCapture   = 30 // war score bonus for capture point

	// MaxScoreHistory is the number of epoch snapshots retained.
	MaxScoreHistory = 12 // ~2 hours of history
)

// MatrixPlayerScore tracks one player's score contributions within an epoch.
type MatrixPlayerScore struct {
	PlayerID    string  `json:"playerId"`
	Name        string  `json:"name"`
	Nationality string  `json:"nationality"`
	Kills       int     `json:"kills"`
	Level       int     `json:"level"`
	Damage      float64 `json:"damage"`
	Survived    bool    `json:"survived"`
	Captures    int     `json:"captures"`
	IsAgent     bool    `json:"isAgent"`
	IsDirectPlay bool   `json:"isDirectPlay"`
	TotalScore  int     `json:"totalScore"` // computed on snapshot
}

// ComputeScore calculates the total Matrix score for a player.
func (mps *MatrixPlayerScore) ComputeScore() int {
	score := mps.Kills*MatrixScorePerKill +
		mps.Level*MatrixScorePerLevel +
		int(mps.Damage*MatrixScorePerDamage) +
		mps.Captures*MatrixScorePerCapture
	if mps.Survived {
		score += MatrixScoreSurvivalBonus
	}
	return score
}

// MatrixEpochSnapshot is a frozen snapshot of scores at epoch end.
type MatrixEpochSnapshot struct {
	EpochNumber  int                          `json:"epochNumber"`
	CountryCode  string                       `json:"countryCode"`
	NationScores map[string]int               `json:"nationScores"`    // nationality → total
	PlayerScores map[string]*MatrixPlayerScore `json:"playerScores"`   // playerID → score
	MVP          *MatrixPlayerScore            `json:"mvp,omitempty"` // top scorer
	Timestamp    time.Time                    `json:"timestamp"`
}

// ScoreAggregator tracks per-player and per-nation scores within Matrix epochs.
// Independent from NationScoreTracker — maintains its own history.
type ScoreAggregator struct {
	mu sync.RWMutex

	countryCode string

	// Current epoch accumulation
	playerScores map[string]*MatrixPlayerScore // playerID → score
	nationScores map[string]int                // nationality → total (running)

	// History (ring buffer)
	history []MatrixEpochSnapshot

	// Current epoch number
	currentEpoch int
}

// NewScoreAggregator creates a new score aggregator for a country arena.
func NewScoreAggregator(countryCode string) *ScoreAggregator {
	return &ScoreAggregator{
		countryCode:  countryCode,
		playerScores: make(map[string]*MatrixPlayerScore),
		nationScores: make(map[string]int),
		history:      make([]MatrixEpochSnapshot, 0, MaxScoreHistory),
	}
}

// ensurePlayer returns or creates the score entry for a player.
func (sa *ScoreAggregator) ensurePlayer(playerID, name, nationality string, isAgent, isDirectPlay bool) *MatrixPlayerScore {
	ps, ok := sa.playerScores[playerID]
	if !ok {
		ps = &MatrixPlayerScore{
			PlayerID:     playerID,
			Name:         name,
			Nationality:  nationality,
			IsAgent:      isAgent,
			IsDirectPlay: isDirectPlay,
		}
		sa.playerScores[playerID] = ps
	}
	return ps
}

// AddKill records a kill for a player. Adds MatrixScorePerKill to nation score.
func (sa *ScoreAggregator) AddKill(playerID, name, nationality string, isAgent, isDirectPlay bool) {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	ps := sa.ensurePlayer(playerID, name, nationality, isAgent, isDirectPlay)
	ps.Kills++
	if nationality != "" {
		sa.nationScores[nationality] += MatrixScorePerKill
	}
}

// AddLevel records a level update for a player.
func (sa *ScoreAggregator) AddLevel(playerID, name, nationality string, level int, isAgent, isDirectPlay bool) {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	ps := sa.ensurePlayer(playerID, name, nationality, isAgent, isDirectPlay)
	prevLevel := ps.Level
	ps.Level = level
	if nationality != "" && level > prevLevel {
		sa.nationScores[nationality] += (level - prevLevel) * MatrixScorePerLevel
	}
}

// AddDamage records damage dealt by a player.
func (sa *ScoreAggregator) AddDamage(playerID, name, nationality string, damage float64, isAgent, isDirectPlay bool) {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	ps := sa.ensurePlayer(playerID, name, nationality, isAgent, isDirectPlay)
	ps.Damage += damage
	if nationality != "" {
		sa.nationScores[nationality] += int(damage * MatrixScorePerDamage)
	}
}

// AddSurvival marks a player as having survived the epoch.
func (sa *ScoreAggregator) AddSurvival(playerID, name, nationality string, isAgent, isDirectPlay bool) {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	ps := sa.ensurePlayer(playerID, name, nationality, isAgent, isDirectPlay)
	if !ps.Survived {
		ps.Survived = true
		if nationality != "" {
			sa.nationScores[nationality] += MatrixScoreSurvivalBonus
		}
	}
}

// AddCapture records a capture point scored by a player.
func (sa *ScoreAggregator) AddCapture(playerID, name, nationality string, isAgent, isDirectPlay bool) {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	ps := sa.ensurePlayer(playerID, name, nationality, isAgent, isDirectPlay)
	ps.Captures++
	if nationality != "" {
		sa.nationScores[nationality] += MatrixScorePerCapture
	}
}

// SnapshotAndReset takes a snapshot of current scores, stores in history,
// and resets for the next epoch. Returns the snapshot.
func (sa *ScoreAggregator) SnapshotAndReset(epochNumber int) *MatrixEpochSnapshot {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	// Compute final player scores
	for _, ps := range sa.playerScores {
		ps.TotalScore = ps.ComputeScore()
	}

	// Copy nation scores
	nationScores := make(map[string]int, len(sa.nationScores))
	for k, v := range sa.nationScores {
		nationScores[k] = v
	}

	// Copy player scores
	playerScores := make(map[string]*MatrixPlayerScore, len(sa.playerScores))
	for k, v := range sa.playerScores {
		copied := *v
		playerScores[k] = &copied
	}

	// Find MVP (highest total score)
	var mvp *MatrixPlayerScore
	for _, ps := range playerScores {
		if mvp == nil || ps.TotalScore > mvp.TotalScore {
			copied := *ps
			mvp = &copied
		}
	}

	snapshot := MatrixEpochSnapshot{
		EpochNumber:  epochNumber,
		CountryCode:  sa.countryCode,
		NationScores: nationScores,
		PlayerScores: playerScores,
		MVP:          mvp,
		Timestamp:    time.Now(),
	}

	// Store in history (ring buffer)
	if len(sa.history) >= MaxScoreHistory {
		sa.history = sa.history[1:]
	}
	sa.history = append(sa.history, snapshot)

	// Reset for next epoch
	sa.playerScores = make(map[string]*MatrixPlayerScore)
	sa.nationScores = make(map[string]int)
	sa.currentEpoch = epochNumber

	return &snapshot
}

// GetNationScores returns a snapshot of current nation scores.
func (sa *ScoreAggregator) GetNationScores() map[string]int {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	snapshot := make(map[string]int, len(sa.nationScores))
	for k, v := range sa.nationScores {
		snapshot[k] = v
	}
	return snapshot
}

// GetPlayerScore returns the current score for a specific player.
func (sa *ScoreAggregator) GetPlayerScore(playerID string) (int, bool) {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	ps, ok := sa.playerScores[playerID]
	if !ok {
		return 0, false
	}
	return ps.ComputeScore(), true
}

// GetPlayerRank returns the rank of a player among all players (1-indexed).
func (sa *ScoreAggregator) GetPlayerRank(playerID string) int {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	targetScore := 0
	if ps, ok := sa.playerScores[playerID]; ok {
		targetScore = ps.ComputeScore()
	}

	rank := 1
	for _, ps := range sa.playerScores {
		if ps.PlayerID != playerID && ps.ComputeScore() > targetScore {
			rank++
		}
	}
	return rank
}

// GetNationRankings returns nations sorted by score (descending).
func (sa *ScoreAggregator) GetNationRankings() []NationRanking {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	rankings := make([]NationRanking, 0, len(sa.nationScores))
	for nat, score := range sa.nationScores {
		rankings = append(rankings, NationRanking{
			Nationality: nat,
			Score:       score,
		})
	}

	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Score > rankings[j].Score
	})

	for i := range rankings {
		rankings[i].Rank = i + 1
	}

	return rankings
}

// GetHistory returns the epoch snapshot history.
func (sa *ScoreAggregator) GetHistory() []MatrixEpochSnapshot {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	hist := make([]MatrixEpochSnapshot, len(sa.history))
	copy(hist, sa.history)
	return hist
}

// GetLastSnapshot returns the most recent epoch snapshot, or nil.
func (sa *ScoreAggregator) GetLastSnapshot() *MatrixEpochSnapshot {
	sa.mu.RLock()
	defer sa.mu.RUnlock()

	if len(sa.history) == 0 {
		return nil
	}
	last := sa.history[len(sa.history)-1]
	return &last
}

// GetTotalPlayers returns the number of players with scores in the current epoch.
func (sa *ScoreAggregator) GetTotalPlayers() int {
	sa.mu.RLock()
	defer sa.mu.RUnlock()
	return len(sa.playerScores)
}

// Reset clears all score data including history.
func (sa *ScoreAggregator) Reset() {
	sa.mu.Lock()
	defer sa.mu.Unlock()

	sa.playerScores = make(map[string]*MatrixPlayerScore)
	sa.nationScores = make(map[string]int)
	sa.history = make([]MatrixEpochSnapshot, 0, MaxScoreHistory)
	sa.currentEpoch = 0
}
