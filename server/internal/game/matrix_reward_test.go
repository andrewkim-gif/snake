package game

import (
	"math"
	"testing"
)

// ============================================================
// v33 Phase 8 — EpochRewardCalculator Integration Tests
//
// Tests reward formula: base × multipliers × population adj
// Including: war victory, MVP, direct play, top-3, sovereignty,
// hegemony, underdog bonus, population sqrt, clamping.
// ============================================================

func makeRewardSnapshot(players map[string]*MatrixPlayerScore) *MatrixEpochSnapshot {
	// Compute total scores
	for _, ps := range players {
		ps.TotalScore = ps.ComputeScore()
	}

	nationScores := make(map[string]int)
	for _, ps := range players {
		nationScores[ps.Nationality] += ps.TotalScore
	}

	return &MatrixEpochSnapshot{
		EpochNumber:  1,
		CountryCode:  "KOR",
		NationScores: nationScores,
		PlayerScores: players,
	}
}

func TestRewardCalculator_BaseReward(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:     "p1",
			Name:         "Player1",
			Nationality:  "KOR",
			Kills:        2,
			Level:        3,
			Damage:       100,
			Survived:     true,
			IsDirectPlay: true,
		},
	}

	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        "KOR",
		EpochNumber:        1,
		NationPlayerCounts: map[string]int{"KOR": 1},
	}

	result := erc.Calculate(input)

	if len(result.Rewards) != 1 {
		t.Fatalf("expected 1 reward, got %d", len(result.Rewards))
	}

	reward := result.Rewards[0]
	// Score: kills=30, level=30, damage=50, survival=100 = 210
	expectedScore := 2*15 + 3*10 + int(100*0.5) + 100
	if reward.RawScore != expectedScore {
		t.Errorf("rawScore = %d, want %d", reward.RawScore, expectedScore)
	}

	// Base: 210 * 0.01 = 2.1
	expectedBase := float64(expectedScore) * DominationTokenBaseRate
	if math.Abs(reward.BaseAmount-expectedBase) > 0.001 {
		t.Errorf("baseAmount = %f, want %f", reward.BaseAmount, expectedBase)
	}
}

func TestRewardCalculator_WarVictoryMultiplier(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:     "p1",
			Name:         "Player1",
			Nationality:  "KOR",
			Kills:        5,
			Level:        5,
			IsDirectPlay: false,
			IsAgent:      false,
		},
	}

	snapshot := makeRewardSnapshot(players)

	t.Run("without war victory", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        1,
			DominantNation:     "USA", // not KOR
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected at least 1 reward")
		}
		// MVP multiplier (1.5x) + no war victory
		// Multiplier should include MVP (since only 1 player, they are MVP)
		r := result.Rewards[0]
		if r.Multiplier >= 2.0 {
			t.Errorf("multiplier = %f, should not include war victory", r.Multiplier)
		}
	})

	t.Run("with war victory", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        2,
			DominantNation:     "KOR",
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected at least 1 reward")
		}
		r := result.Rewards[0]
		// Should include 2.0x war victory
		if r.Multiplier < 2.0 {
			t.Errorf("multiplier = %f, should include 2.0x war victory", r.Multiplier)
		}
	})
}

func TestRewardCalculator_MVPBonus(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:     "p1",
			Name:         "MVP",
			Nationality:  "KOR",
			Kills:        10,
			Level:        10,
			IsDirectPlay: false,
		},
		"p2": {
			PlayerID:     "p2",
			Name:         "Regular",
			Nationality:  "USA",
			Kills:        1,
			Level:        2,
			IsDirectPlay: false,
		},
	}

	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        "KOR",
		EpochNumber:        1,
		NationPlayerCounts: map[string]int{"KOR": 1, "USA": 1},
	}

	result := erc.Calculate(input)
	if result.MVP == nil {
		t.Fatal("expected MVP to be set")
	}
	if result.MVP.PlayerID != "p1" {
		t.Errorf("MVP = %s, want p1", result.MVP.PlayerID)
	}
	if !result.MVP.IsMVP {
		t.Error("MVP.IsMVP should be true")
	}
}

func TestRewardCalculator_DirectPlayBonus(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"human": {
			PlayerID:     "human",
			Name:         "Human",
			Nationality:  "KOR",
			Kills:        5,
			Level:        5,
			IsDirectPlay: true,
			IsAgent:      false,
		},
		"agent": {
			PlayerID:     "agent",
			Name:         "Agent",
			Nationality:  "USA",
			Kills:        5,
			Level:        5,
			IsDirectPlay: false,
			IsAgent:      true,
		},
	}

	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        "KOR",
		EpochNumber:        1,
		NationPlayerCounts: map[string]int{"KOR": 1, "USA": 1},
	}

	result := erc.Calculate(input)
	var humanReward, agentReward *MatrixPlayerReward
	for i := range result.Rewards {
		if result.Rewards[i].PlayerID == "human" {
			humanReward = &result.Rewards[i]
		}
		if result.Rewards[i].PlayerID == "agent" {
			agentReward = &result.Rewards[i]
		}
	}

	if humanReward == nil || agentReward == nil {
		t.Fatal("expected both human and agent rewards")
	}

	// Human should have a higher multiplier (1.5x direct play bonus)
	if humanReward.Multiplier <= agentReward.Multiplier {
		t.Errorf("human multiplier (%f) should be > agent multiplier (%f)",
			humanReward.Multiplier, agentReward.Multiplier)
	}
}

func TestRewardCalculator_PopulationAdjustment(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	// Single player from a large nation vs small nation
	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:    "p1",
			Name:        "BigNation",
			Nationality: "USA",
			Kills:       5,
			Level:       5,
		},
		"p2": {
			PlayerID:    "p2",
			Name:        "SmallNation",
			Nationality: "ISL",
			Kills:       5,
			Level:       5,
		},
	}

	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:    snapshot,
		CountryCode: "KOR",
		EpochNumber: 1,
		NationPlayerCounts: map[string]int{
			"USA": 20, // large
			"ISL": 2,  // small (underdog)
		},
	}

	result := erc.Calculate(input)
	var usaReward, islReward *MatrixPlayerReward
	for i := range result.Rewards {
		if result.Rewards[i].PlayerID == "p1" {
			usaReward = &result.Rewards[i]
		}
		if result.Rewards[i].PlayerID == "p2" {
			islReward = &result.Rewards[i]
		}
	}

	if usaReward == nil || islReward == nil {
		t.Fatal("expected both rewards")
	}

	// ISL should get underdog bonus (1.3x) + lower sqrt divisor
	// USA: popAdjust = 1/sqrt(20) = 0.2236
	// ISL: popAdjust = 1/sqrt(2) * 1.3 = 0.919
	if islReward.FinalAmount <= usaReward.FinalAmount {
		t.Errorf("small nation reward (%f) should be > large nation reward (%f) due to population adjustment",
			islReward.FinalAmount, usaReward.FinalAmount)
	}
}

func TestRewardCalculator_SovereigntyHegemonyBonus(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:    "p1",
			Name:        "DomNation",
			Nationality: "KOR",
			Kills:       5,
			Level:       5,
		},
	}

	snapshot := makeRewardSnapshot(players)

	t.Run("sovereignty adds +20%", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        1,
			DominantNation:     "KOR",
			IsSovereignty:      true,
			IsHegemony:         false,
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected reward")
		}
		// Multiplier should include war victory (2x) + MVP (1.5x) + sovereignty (+0.2)
		r := result.Rewards[0]
		if r.Multiplier < 3.0 {
			t.Errorf("multiplier = %f, should include sovereignty bonus", r.Multiplier)
		}
	})

	t.Run("hegemony adds +50%", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        2,
			DominantNation:     "KOR",
			IsSovereignty:      true,
			IsHegemony:         true,
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected reward")
		}
		// Should include both sovereignty (+0.2) and hegemony (+0.5)
		r := result.Rewards[0]
		if r.Multiplier < 3.5 {
			t.Errorf("multiplier = %f, should include sovereignty+hegemony", r.Multiplier)
		}
	})
}

func TestRewardCalculator_Clamping(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	t.Run("minimum payout enforced", func(t *testing.T) {
		players := map[string]*MatrixPlayerScore{
			"p1": {
				PlayerID:    "p1",
				Name:        "LowScorer",
				Nationality: "KOR",
				Kills:       0,
				Level:       1,
				Damage:      1,
			},
		}
		snapshot := makeRewardSnapshot(players)
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        1,
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected reward even for low scorer")
		}
		if result.Rewards[0].FinalAmount < DominationTokenMinPayout {
			t.Errorf("reward %f should be at least %f", result.Rewards[0].FinalAmount, DominationTokenMinPayout)
		}
	})

	t.Run("maximum payout capped", func(t *testing.T) {
		players := map[string]*MatrixPlayerScore{
			"p1": {
				PlayerID:     "p1",
				Name:         "MaxScorer",
				Nationality:  "KOR",
				Kills:        1000,
				Level:        99,
				Damage:       100000,
				Survived:     true,
				Captures:     100,
				IsDirectPlay: true,
			},
		}
		snapshot := makeRewardSnapshot(players)
		input := &MatrixRewardInput{
			Snapshot:           snapshot,
			CountryCode:        "KOR",
			EpochNumber:        1,
			DominantNation:     "KOR",
			IsSovereignty:      true,
			IsHegemony:         true,
			NationPlayerCounts: map[string]int{"KOR": 1},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) == 0 {
			t.Fatal("expected reward")
		}
		if result.Rewards[0].FinalAmount > DominationTokenMaxPayout {
			t.Errorf("reward %f should be capped at %f",
				result.Rewards[0].FinalAmount, DominationTokenMaxPayout)
		}
	})
}

func TestRewardCalculator_EmptySnapshot(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	t.Run("nil snapshot", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot: nil,
		}
		result := erc.Calculate(input)
		if len(result.Rewards) != 0 {
			t.Error("expected 0 rewards for nil snapshot")
		}
	})

	t.Run("empty players", func(t *testing.T) {
		input := &MatrixRewardInput{
			Snapshot: &MatrixEpochSnapshot{
				PlayerScores: map[string]*MatrixPlayerScore{},
			},
		}
		result := erc.Calculate(input)
		if len(result.Rewards) != 0 {
			t.Error("expected 0 rewards for empty players")
		}
	})
}

func TestRewardCalculator_Stats(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {
			PlayerID:    "p1",
			Name:        "Player1",
			Nationality: "KOR",
			Kills:       5,
			Level:       5,
		},
	}
	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        "KOR",
		EpochNumber:        1,
		NationPlayerCounts: map[string]int{"KOR": 1},
	}

	erc.Calculate(input)

	epochs, rewards, tokens := erc.GetStats()
	if epochs != 1 {
		t.Errorf("epochs = %d, want 1", epochs)
	}
	if rewards != 1 {
		t.Errorf("rewards = %d, want 1", rewards)
	}
	if tokens <= 0 {
		t.Errorf("tokens = %f, want > 0", tokens)
	}

	erc.Reset()
	epochs2, rewards2, tokens2 := erc.GetStats()
	if epochs2 != 0 || rewards2 != 0 || tokens2 != 0 {
		t.Error("expected all stats to be 0 after reset")
	}
}

func TestRewardCalculator_RewardsOrderedDescending(t *testing.T) {
	erc := NewEpochRewardCalculator("KOR")

	players := map[string]*MatrixPlayerScore{
		"p1": {PlayerID: "p1", Name: "Low", Nationality: "KOR", Kills: 1, Level: 1},
		"p2": {PlayerID: "p2", Name: "Mid", Nationality: "USA", Kills: 5, Level: 5},
		"p3": {PlayerID: "p3", Name: "High", Nationality: "JPN", Kills: 10, Level: 10},
	}
	snapshot := makeRewardSnapshot(players)
	input := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        "KOR",
		EpochNumber:        1,
		NationPlayerCounts: map[string]int{"KOR": 1, "USA": 1, "JPN": 1},
	}

	result := erc.Calculate(input)
	if len(result.Rewards) < 3 {
		t.Fatalf("expected 3 rewards, got %d", len(result.Rewards))
	}

	for i := 1; i < len(result.Rewards); i++ {
		if result.Rewards[i].FinalAmount > result.Rewards[i-1].FinalAmount {
			t.Errorf("rewards not sorted descending: [%d]=%f > [%d]=%f",
				i, result.Rewards[i].FinalAmount, i-1, result.Rewards[i-1].FinalAmount)
		}
	}
}
