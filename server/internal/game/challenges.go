package game

import (
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 9 — S40: Daily Challenge System
// 3 random challenges per day, XP boost + cosmetic coin rewards.
// Challenges rotate every 24 hours (00:00 UTC).
// ============================================================

// DailyChallengesPerDay is the number of active daily challenges.
const DailyChallengesPerDay = 3

// ChallengeType identifies a challenge template.
type ChallengeType string

const (
	ChallengeKills          ChallengeType = "kills"
	ChallengeAssists        ChallengeType = "assists"
	ChallengeEpochsSurvived ChallengeType = "epochs_survived"
	ChallengeCapturePoints  ChallengeType = "capture_points"
	ChallengeLevelReach     ChallengeType = "level_reach"
	ChallengeDamageDealt    ChallengeType = "damage_dealt"
	ChallengeOrbsCollected  ChallengeType = "orbs_collected"
	ChallengeSynergies      ChallengeType = "synergies"
	ChallengeWeaponLv5      ChallengeType = "weapon_lv5"
	ChallengeMVPs           ChallengeType = "mvps"
	ChallengeWinStreak      ChallengeType = "win_streak"
	ChallengeTopThree       ChallengeType = "top_three"
)

// ChallengeRewardType defines what kind of reward a challenge gives.
type ChallengeRewardType string

const (
	RewardAccountXPBoost  ChallengeRewardType = "account_xp_boost"
	RewardCosmeticCoins   ChallengeRewardType = "cosmetic_coins"
)

// ChallengeDef defines a challenge template with target and rewards.
type ChallengeDef struct {
	Type        ChallengeType       `json:"type"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Target      int                 `json:"target"`
	RewardType  ChallengeRewardType `json:"rewardType"`
	RewardValue int                 `json:"rewardValue"`
	Difficulty  string              `json:"difficulty"` // "easy", "medium", "hard"
}

// AllChallengeDefs defines the pool of possible daily challenges.
var AllChallengeDefs = []ChallengeDef{
	// Easy challenges
	{Type: ChallengeKills, Name: "Bloodthirsty", Description: "Get 10 kills", Target: 10, RewardType: RewardAccountXPBoost, RewardValue: 50, Difficulty: "easy"},
	{Type: ChallengeAssists, Name: "Team Player", Description: "Get 5 assists", Target: 5, RewardType: RewardCosmeticCoins, RewardValue: 15, Difficulty: "easy"},
	{Type: ChallengeEpochsSurvived, Name: "Survivor", Description: "Survive 3 epochs", Target: 3, RewardType: RewardAccountXPBoost, RewardValue: 40, Difficulty: "easy"},
	{Type: ChallengeOrbsCollected, Name: "Collector", Description: "Collect 100 orbs", Target: 100, RewardType: RewardCosmeticCoins, RewardValue: 10, Difficulty: "easy"},
	{Type: ChallengeLevelReach, Name: "Quick Learner", Description: "Reach level 10 in one epoch", Target: 10, RewardType: RewardAccountXPBoost, RewardValue: 30, Difficulty: "easy"},

	// Medium challenges
	{Type: ChallengeKills, Name: "Slayer", Description: "Get 25 kills", Target: 25, RewardType: RewardAccountXPBoost, RewardValue: 100, Difficulty: "medium"},
	{Type: ChallengeCapturePoints, Name: "Strategist", Description: "Capture 3 strategic points", Target: 3, RewardType: RewardCosmeticCoins, RewardValue: 25, Difficulty: "medium"},
	{Type: ChallengeDamageDealt, Name: "Heavy Hitter", Description: "Deal 5000 total damage", Target: 5000, RewardType: RewardAccountXPBoost, RewardValue: 75, Difficulty: "medium"},
	{Type: ChallengeSynergies, Name: "Combo Master", Description: "Activate 2 synergies in one epoch", Target: 2, RewardType: RewardCosmeticCoins, RewardValue: 30, Difficulty: "medium"},
	{Type: ChallengeTopThree, Name: "Podium Finisher", Description: "Finish top 3 in 2 epochs", Target: 2, RewardType: RewardAccountXPBoost, RewardValue: 80, Difficulty: "medium"},
	{Type: ChallengeEpochsSurvived, Name: "Marathon Runner", Description: "Survive 5 epochs", Target: 5, RewardType: RewardCosmeticCoins, RewardValue: 20, Difficulty: "medium"},

	// Hard challenges
	{Type: ChallengeKills, Name: "Annihilator", Description: "Get 50 kills", Target: 50, RewardType: RewardAccountXPBoost, RewardValue: 200, Difficulty: "hard"},
	{Type: ChallengeWeaponLv5, Name: "Ultimate Weapon", Description: "Evolve a weapon to Lv5", Target: 1, RewardType: RewardCosmeticCoins, RewardValue: 50, Difficulty: "hard"},
	{Type: ChallengeMVPs, Name: "Most Valuable", Description: "Earn MVP in 2 epochs", Target: 2, RewardType: RewardAccountXPBoost, RewardValue: 150, Difficulty: "hard"},
	{Type: ChallengeLevelReach, Name: "Maxed Out", Description: "Reach level 20 in one epoch", Target: 20, RewardType: RewardCosmeticCoins, RewardValue: 75, Difficulty: "hard"},
	{Type: ChallengeWinStreak, Name: "Dominator", Description: "Win 3 epochs in a row", Target: 3, RewardType: RewardAccountXPBoost, RewardValue: 250, Difficulty: "hard"},
}

// ============================================================
// Player Challenge State
// ============================================================

// PlayerChallenge tracks a player's progress on a single challenge.
type PlayerChallenge struct {
	Def       ChallengeDef `json:"def"`
	Progress  int          `json:"progress"`
	Completed bool         `json:"completed"`
	Claimed   bool         `json:"claimed"`
}

// PlayerDailyChallenges holds a player's daily challenges and progress.
type PlayerDailyChallenges struct {
	PlayerID    string             `json:"playerId"`
	Challenges  [DailyChallengesPerDay]PlayerChallenge `json:"challenges"`
	DayKey      string             `json:"dayKey"` // "2026-03-07" UTC date
	CompletedCount int             `json:"completedCount"`
}

// ============================================================
// ChallengeProgress — tracks what happened in an epoch
// ============================================================

// ChallengeEpochProgress reports what a player did in an epoch for challenge tracking.
type ChallengeEpochProgress struct {
	PlayerID        string  `json:"playerId"`
	Kills           int     `json:"kills"`
	Assists         int     `json:"assists"`
	EpochsSurvived  int     `json:"epochsSurvived"`   // always 1 (counts as surviving)
	CapturePoints   int     `json:"capturePoints"`
	LevelReached    int     `json:"levelReached"`
	DamageDealt     float64 `json:"damageDealt"`
	OrbsCollected   int     `json:"orbsCollected"`
	SynergiesActive int     `json:"synergiesActive"`
	WeaponLv5Count  int     `json:"weaponLv5Count"`
	IsMVP           bool    `json:"isMvp"`
	Rank            int     `json:"rank"`
	TotalPlayers    int     `json:"totalPlayers"`
	IsWin           bool    `json:"isWin"` // rank == 1
}

// ============================================================
// DailyChallengeManager
// ============================================================

// DailyChallengeManager manages daily challenges for all players.
type DailyChallengeManager struct {
	mu         sync.RWMutex
	players    map[string]*PlayerDailyChallenges
	todayKey   string
	todayDefs  [DailyChallengesPerDay]ChallengeDef

	// Callback for rewards
	accountLevelMgr *AccountLevelManager
}

// NewDailyChallengeManager creates a new daily challenge manager.
func NewDailyChallengeManager(alm *AccountLevelManager) *DailyChallengeManager {
	dcm := &DailyChallengeManager{
		players:         make(map[string]*PlayerDailyChallenges),
		accountLevelMgr: alm,
	}
	dcm.rotateChallenges()
	return dcm
}

// rotateChallenges generates today's 3 random challenges.
func (dcm *DailyChallengeManager) rotateChallenges() {
	dcm.todayKey = time.Now().UTC().Format("2006-01-02")

	// Select 3 challenges: 1 easy, 1 medium, 1 hard
	easy := filterByDifficulty("easy")
	medium := filterByDifficulty("medium")
	hard := filterByDifficulty("hard")

	dcm.todayDefs[0] = easy[rand.Intn(len(easy))]
	dcm.todayDefs[1] = medium[rand.Intn(len(medium))]
	dcm.todayDefs[2] = hard[rand.Intn(len(hard))]

	slog.Info("daily challenges rotated",
		"day", dcm.todayKey,
		"easy", dcm.todayDefs[0].Name,
		"medium", dcm.todayDefs[1].Name,
		"hard", dcm.todayDefs[2].Name,
	)
}

func filterByDifficulty(diff string) []ChallengeDef {
	var result []ChallengeDef
	for _, d := range AllChallengeDefs {
		if d.Difficulty == diff {
			result = append(result, d)
		}
	}
	return result
}

// checkAndRotate ensures today's challenges are fresh.
func (dcm *DailyChallengeManager) checkAndRotate() {
	today := time.Now().UTC().Format("2006-01-02")
	if today != dcm.todayKey {
		dcm.rotateChallenges()
		// Clear all player daily state
		dcm.players = make(map[string]*PlayerDailyChallenges)
	}
}

// GetPlayerChallenges returns the daily challenges for a player.
func (dcm *DailyChallengeManager) GetPlayerChallenges(playerID string) *PlayerDailyChallenges {
	dcm.mu.Lock()
	defer dcm.mu.Unlock()

	dcm.checkAndRotate()

	pc, ok := dcm.players[playerID]
	if !ok {
		pc = &PlayerDailyChallenges{
			PlayerID: playerID,
			DayKey:   dcm.todayKey,
		}
		for i := 0; i < DailyChallengesPerDay; i++ {
			pc.Challenges[i] = PlayerChallenge{
				Def:       dcm.todayDefs[i],
				Progress:  0,
				Completed: false,
				Claimed:   false,
			}
		}
		dcm.players[playerID] = pc
	}

	return pc
}

// ProcessEpochProgress updates challenge progress based on epoch results.
// Returns list of newly completed challenge indices.
func (dcm *DailyChallengeManager) ProcessEpochProgress(progress *ChallengeEpochProgress) []int {
	dcm.mu.Lock()
	defer dcm.mu.Unlock()

	dcm.checkAndRotate()

	pc, ok := dcm.players[progress.PlayerID]
	if !ok {
		// Create player challenges first
		pc = &PlayerDailyChallenges{
			PlayerID: progress.PlayerID,
			DayKey:   dcm.todayKey,
		}
		for i := 0; i < DailyChallengesPerDay; i++ {
			pc.Challenges[i] = PlayerChallenge{
				Def: dcm.todayDefs[i],
			}
		}
		dcm.players[progress.PlayerID] = pc
	}

	var newlyCompleted []int

	for i := range pc.Challenges {
		ch := &pc.Challenges[i]
		if ch.Completed {
			continue
		}

		// Update progress based on challenge type
		switch ch.Def.Type {
		case ChallengeKills:
			ch.Progress += progress.Kills
		case ChallengeAssists:
			ch.Progress += progress.Assists
		case ChallengeEpochsSurvived:
			ch.Progress += progress.EpochsSurvived
		case ChallengeCapturePoints:
			ch.Progress += progress.CapturePoints
		case ChallengeLevelReach:
			if progress.LevelReached > ch.Progress {
				ch.Progress = progress.LevelReached
			}
		case ChallengeDamageDealt:
			ch.Progress += int(progress.DamageDealt)
		case ChallengeOrbsCollected:
			ch.Progress += progress.OrbsCollected
		case ChallengeSynergies:
			if progress.SynergiesActive > ch.Progress {
				ch.Progress = progress.SynergiesActive
			}
		case ChallengeWeaponLv5:
			ch.Progress += progress.WeaponLv5Count
		case ChallengeMVPs:
			if progress.IsMVP {
				ch.Progress++
			}
		case ChallengeWinStreak:
			if progress.IsWin {
				ch.Progress++
			} else {
				ch.Progress = 0 // streak broken
			}
		case ChallengeTopThree:
			if progress.Rank <= 3 && progress.TotalPlayers > 3 {
				ch.Progress++
			}
		}

		// Check completion
		if ch.Progress >= ch.Def.Target && !ch.Completed {
			ch.Completed = true
			pc.CompletedCount++
			newlyCompleted = append(newlyCompleted, i)

			slog.Info("daily challenge completed",
				"playerId", progress.PlayerID,
				"challenge", ch.Def.Name,
				"type", ch.Def.Type,
			)
		}
	}

	return newlyCompleted
}

// ClaimReward claims the reward for a completed challenge.
// Returns the reward description or an error message.
func (dcm *DailyChallengeManager) ClaimReward(playerID string, challengeIndex int) (string, error) {
	dcm.mu.Lock()
	defer dcm.mu.Unlock()

	pc, ok := dcm.players[playerID]
	if !ok {
		return "", fmt.Errorf("no challenges found for player %s", playerID)
	}

	if challengeIndex < 0 || challengeIndex >= DailyChallengesPerDay {
		return "", fmt.Errorf("invalid challenge index: %d", challengeIndex)
	}

	ch := &pc.Challenges[challengeIndex]
	if !ch.Completed {
		return "", fmt.Errorf("challenge not completed: %s", ch.Def.Name)
	}
	if ch.Claimed {
		return "", fmt.Errorf("reward already claimed: %s", ch.Def.Name)
	}

	ch.Claimed = true

	// Apply reward
	switch ch.Def.RewardType {
	case RewardAccountXPBoost:
		if dcm.accountLevelMgr != nil {
			// Award bonus account XP
			result := &EpochAccountResult{
				PlayerID:   playerID,
				PlayerName: playerID,
			}
			_ = result // XP boost is applied as direct coins
			dcm.accountLevelMgr.AddCosmeticCoins(playerID, 0) // placeholder
			// Actually add the XP: process a synthetic epoch result with bonus XP
			prof := dcm.accountLevelMgr.GetProfile(playerID, playerID)
			dcm.accountLevelMgr.mu.Lock()
			prof.AccountXP += ch.Def.RewardValue
			prof.TotalAccountXP += ch.Def.RewardValue
			// Check for level-up
			for prof.AccountXP >= prof.AccountXPToNext && prof.AccountXPToNext > 0 {
				prof.AccountXP -= prof.AccountXPToNext
				prof.AccountLevel++
				prof.AccountXPToNext = AccountXPForLevel(prof.AccountLevel)
				coins := CosmeticCoinsPerLevel
				if prof.AccountLevel%5 == 0 {
					coins += CosmeticCoinsBonusEvery5
				}
				prof.CosmeticCoins += coins
			}
			dcm.accountLevelMgr.mu.Unlock()
		}
		return fmt.Sprintf("+%d Account XP", ch.Def.RewardValue), nil

	case RewardCosmeticCoins:
		if dcm.accountLevelMgr != nil {
			dcm.accountLevelMgr.AddCosmeticCoins(playerID, ch.Def.RewardValue)
		}
		return fmt.Sprintf("+%d Cosmetic Coins", ch.Def.RewardValue), nil
	}

	return "", fmt.Errorf("unknown reward type: %s", ch.Def.RewardType)
}

// GetTodayDefs returns today's challenge definitions.
func (dcm *DailyChallengeManager) GetTodayDefs() [DailyChallengesPerDay]ChallengeDef {
	dcm.mu.RLock()
	defer dcm.mu.RUnlock()
	return dcm.todayDefs
}

// ============================================================
// Daily Challenge Snapshot (for client)
// ============================================================

// DailyChallengeSnapshot is the client-facing daily challenge data.
type DailyChallengeSnapshot struct {
	DayKey     string                    `json:"dayKey"`
	Challenges [DailyChallengesPerDay]ChallengeSnapshotEntry `json:"challenges"`
	CompletedCount int                   `json:"completedCount"`
}

// ChallengeSnapshotEntry is a single challenge in the snapshot.
type ChallengeSnapshotEntry struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Type        ChallengeType       `json:"type"`
	Difficulty  string              `json:"difficulty"`
	Target      int                 `json:"target"`
	Progress    int                 `json:"progress"`
	Completed   bool                `json:"completed"`
	Claimed     bool                `json:"claimed"`
	RewardType  ChallengeRewardType `json:"rewardType"`
	RewardValue int                 `json:"rewardValue"`
}

// GetSnapshot returns a client-facing snapshot of daily challenges.
func (dcm *DailyChallengeManager) GetSnapshot(playerID string) *DailyChallengeSnapshot {
	pc := dcm.GetPlayerChallenges(playerID)

	snap := &DailyChallengeSnapshot{
		DayKey:         pc.DayKey,
		CompletedCount: pc.CompletedCount,
	}

	for i, ch := range pc.Challenges {
		snap.Challenges[i] = ChallengeSnapshotEntry{
			Name:        ch.Def.Name,
			Description: ch.Def.Description,
			Type:        ch.Def.Type,
			Difficulty:  ch.Def.Difficulty,
			Target:      ch.Def.Target,
			Progress:    ch.Progress,
			Completed:   ch.Completed,
			Claimed:     ch.Claimed,
			RewardType:  ch.Def.RewardType,
			RewardValue: ch.Def.RewardValue,
		}
	}

	return snap
}
