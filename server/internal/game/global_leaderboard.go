package game

import (
	"sort"
	"sync"
)

// ============================================================
// Global Leaderboard Extension (S55)
// Build win-rate, synergy discovery, agent RP ranking
// ============================================================

// GlobalLeaderboardEntry represents an entry in the global leaderboard.
type GlobalLeaderboardEntry struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Value    float64 `json:"value"`    // win rate, count, or RP
	Label    string  `json:"label"`    // human-readable value description
	Detail   string  `json:"detail,omitempty"` // additional info
	Rank     int     `json:"rank"`
}

// BuildWinRateEntry tracks a build path's win statistics.
type BuildWinRateEntry struct {
	BuildPath string  `json:"buildPath"`
	Wins      int     `json:"wins"`
	Rounds    int     `json:"rounds"`
	WinRate   float64 `json:"winRate"`
}

// SynergyDiscoveryEntry tracks an agent's synergy discoveries.
type SynergyDiscoveryEntry struct {
	PlayerID       string `json:"playerId"`
	PlayerName     string `json:"playerName"`
	TotalSynergies int    `json:"totalSynergies"`
	UniqueSynergies int   `json:"uniqueSynergies"`
}

// GlobalLeaderboardResponse is the API response for GET /api/leaderboard.
type GlobalLeaderboardResponse struct {
	Type    string                   `json:"type"`
	Entries []GlobalLeaderboardEntry `json:"entries"`
}

// ============================================================
// Global Leaderboard Store
// ============================================================

// GlobalLeaderboard manages multiple leaderboard types.
type GlobalLeaderboard struct {
	mu sync.RWMutex

	// Build win-rate data: buildPath -> wins/rounds
	buildStats map[string]*BuildWinRateEntry

	// Synergy discovery data: playerID -> discovery stats
	synergyStats map[string]*SynergyDiscoveryEntry

	// Agent RP ranking: uses ProgressionStore
	progressionStore *ProgressionStore

	// Player name cache: playerID -> name
	playerNames map[string]string
}

// NewGlobalLeaderboard creates a new global leaderboard.
func NewGlobalLeaderboard(ps *ProgressionStore) *GlobalLeaderboard {
	return &GlobalLeaderboard{
		buildStats:       make(map[string]*BuildWinRateEntry),
		synergyStats:     make(map[string]*SynergyDiscoveryEntry),
		progressionStore: ps,
		playerNames:      make(map[string]string),
	}
}

// RecordRoundResult updates leaderboard data from a round result.
func (gl *GlobalLeaderboard) RecordRoundResult(
	playerID string,
	playerName string,
	buildPath string,
	rank int,
	synergies []string,
	uniqueSynergies int,
) {
	gl.mu.Lock()
	defer gl.mu.Unlock()

	// Cache player name
	gl.playerNames[playerID] = playerName

	// Update build win-rate
	if buildPath != "" {
		entry, ok := gl.buildStats[buildPath]
		if !ok {
			entry = &BuildWinRateEntry{BuildPath: buildPath}
			gl.buildStats[buildPath] = entry
		}
		entry.Rounds++
		if rank == 1 {
			entry.Wins++
		}
		if entry.Rounds > 0 {
			entry.WinRate = float64(entry.Wins) / float64(entry.Rounds)
		}
	}

	// Update synergy discovery
	synEntry, ok := gl.synergyStats[playerID]
	if !ok {
		synEntry = &SynergyDiscoveryEntry{
			PlayerID:   playerID,
			PlayerName: playerName,
		}
		gl.synergyStats[playerID] = synEntry
	}
	synEntry.PlayerName = playerName
	synEntry.TotalSynergies += len(synergies)
	if uniqueSynergies > synEntry.UniqueSynergies {
		synEntry.UniqueSynergies = uniqueSynergies
	}
}

// GetLeaderboard returns a leaderboard by type.
func (gl *GlobalLeaderboard) GetLeaderboard(lbType string) *GlobalLeaderboardResponse {
	switch lbType {
	case "build":
		return gl.getBuildLeaderboard()
	case "synergy":
		return gl.getSynergyLeaderboard()
	case "agent":
		return gl.getAgentLeaderboard()
	default:
		return gl.getAgentLeaderboard()
	}
}

// getBuildLeaderboard returns build paths sorted by win rate.
func (gl *GlobalLeaderboard) getBuildLeaderboard() *GlobalLeaderboardResponse {
	gl.mu.RLock()
	defer gl.mu.RUnlock()

	entries := make([]*BuildWinRateEntry, 0, len(gl.buildStats))
	for _, entry := range gl.buildStats {
		if entry.Rounds >= 5 { // minimum 5 rounds for ranking
			entries = append(entries, entry)
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].WinRate > entries[j].WinRate
	})

	resp := &GlobalLeaderboardResponse{
		Type:    "build",
		Entries: make([]GlobalLeaderboardEntry, 0, len(entries)),
	}

	for i, entry := range entries {
		if i >= 20 {
			break
		}
		bp := GetBuildPath(entry.BuildPath)
		name := entry.BuildPath
		if bp != nil {
			name = bp.Name
		}
		resp.Entries = append(resp.Entries, GlobalLeaderboardEntry{
			ID:     entry.BuildPath,
			Name:   name,
			Value:  entry.WinRate * 100, // percentage
			Label:  formatPercent(entry.WinRate),
			Detail: formatRounds(entry.Wins, entry.Rounds),
			Rank:   i + 1,
		})
	}

	return resp
}

// getSynergyLeaderboard returns players sorted by synergy discoveries.
func (gl *GlobalLeaderboard) getSynergyLeaderboard() *GlobalLeaderboardResponse {
	gl.mu.RLock()
	defer gl.mu.RUnlock()

	entries := make([]*SynergyDiscoveryEntry, 0, len(gl.synergyStats))
	for _, entry := range gl.synergyStats {
		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].TotalSynergies != entries[j].TotalSynergies {
			return entries[i].TotalSynergies > entries[j].TotalSynergies
		}
		return entries[i].UniqueSynergies > entries[j].UniqueSynergies
	})

	resp := &GlobalLeaderboardResponse{
		Type:    "synergy",
		Entries: make([]GlobalLeaderboardEntry, 0, len(entries)),
	}

	for i, entry := range entries {
		if i >= 20 {
			break
		}
		resp.Entries = append(resp.Entries, GlobalLeaderboardEntry{
			ID:     entry.PlayerID,
			Name:   entry.PlayerName,
			Value:  float64(entry.TotalSynergies),
			Label:  formatCount(entry.TotalSynergies, "synergy activations"),
			Detail: formatCount(entry.UniqueSynergies, "unique synergies"),
			Rank:   i + 1,
		})
	}

	return resp
}

// getAgentLeaderboard returns agents sorted by total RP.
func (gl *GlobalLeaderboard) getAgentLeaderboard() *GlobalLeaderboardResponse {
	gl.mu.RLock()
	defer gl.mu.RUnlock()

	type rpEntry struct {
		id   string
		name string
		rp   int
	}

	var entries []rpEntry

	if gl.progressionStore != nil {
		gl.progressionStore.mu.RLock()
		for id, prog := range gl.progressionStore.progressions {
			name := id
			if n, ok := gl.playerNames[id]; ok {
				name = n
			}
			entries = append(entries, rpEntry{
				id:   id,
				name: name,
				rp:   prog.TotalRP,
			})
		}
		gl.progressionStore.mu.RUnlock()
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].rp > entries[j].rp
	})

	resp := &GlobalLeaderboardResponse{
		Type:    "agent",
		Entries: make([]GlobalLeaderboardEntry, 0, len(entries)),
	}

	for i, entry := range entries {
		if i >= 20 {
			break
		}
		resp.Entries = append(resp.Entries, GlobalLeaderboardEntry{
			ID:    entry.id,
			Name:  entry.name,
			Value: float64(entry.rp),
			Label: formatCount(entry.rp, "RP"),
			Rank:  i + 1,
		})
	}

	return resp
}

// --- Formatting helpers ---

func formatPercent(v float64) string {
	return formatFloat(v*100, 1) + "%"
}

func formatFloat(v float64, decimals int) string {
	if decimals == 1 {
		return floatToString(v, 1)
	}
	return floatToString(v, 0)
}

func floatToString(v float64, decimals int) string {
	if decimals == 0 {
		return intToString(int(v))
	}
	whole := int(v)
	frac := int((v - float64(whole)) * 10)
	if frac < 0 {
		frac = -frac
	}
	return intToString(whole) + "." + intToString(frac)
}

func intToString(n int) string {
	if n == 0 {
		return "0"
	}
	negative := false
	if n < 0 {
		negative = true
		n = -n
	}
	digits := make([]byte, 0, 10)
	for n > 0 {
		digits = append(digits, byte('0'+n%10))
		n /= 10
	}
	// Reverse
	for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
		digits[i], digits[j] = digits[j], digits[i]
	}
	if negative {
		return "-" + string(digits)
	}
	return string(digits)
}

func formatRounds(wins, rounds int) string {
	return intToString(wins) + "W / " + intToString(rounds) + " rounds"
}

func formatCount(n int, label string) string {
	return intToString(n) + " " + label
}
