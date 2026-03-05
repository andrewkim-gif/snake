package game

import (
	"os"
	"testing"
)

func TestTrainingStore_DefaultConfig(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	store := NewTrainingStore(dir)
	cfg := store.GetConfig("unknown-agent")

	if cfg.BuildPath != "balanced" {
		t.Errorf("expected default buildPath=balanced, got %s", cfg.BuildPath)
	}
	if cfg.CombatStyle != "balanced" {
		t.Errorf("expected default combatStyle=balanced, got %s", cfg.CombatStyle)
	}
	if len(cfg.StrategyPhases) != 3 {
		t.Errorf("expected 3 strategy phases, got %d", len(cfg.StrategyPhases))
	}
}

func TestTrainingStore_SetAndGetConfig(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	store := NewTrainingStore(dir)
	cfg := TrainingConfig{
		BuildPath:   "berserker",
		CombatStyle: "aggressive",
		StrategyPhases: []StrategyPhase{
			{Phase: "early", Strategy: "gather"},
		},
	}

	store.SetConfig("agent-1", cfg)

	got := store.GetConfig("agent-1")
	if got.BuildPath != "berserker" {
		t.Errorf("expected berserker, got %s", got.BuildPath)
	}
	if got.CombatStyle != "aggressive" {
		t.Errorf("expected aggressive, got %s", got.CombatStyle)
	}
}

func TestTrainingStore_RoundHistory(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	store := NewTrainingStore(dir)

	for i := 0; i < 15; i++ {
		store.AddRoundResult("agent-1", RoundResult{
			FinalLevel: i + 1,
			Kills:      i,
			Rank:       15 - i,
			Score:      (i + 1) * 100,
		})
	}

	// Get last 10
	history := store.GetHistory("agent-1", 10)
	if len(history) != 10 {
		t.Errorf("expected 10 results, got %d", len(history))
	}

	// All history
	allHistory := store.GetHistory("agent-1", 0)
	if len(allHistory) != 15 {
		t.Errorf("expected 15 total results, got %d", len(allHistory))
	}
}

func TestTrainingStore_Metrics(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	store := NewTrainingStore(dir)

	store.AddRoundResult("agent-1", RoundResult{
		FinalLevel:      5,
		Kills:           3,
		Rank:            1,
		Score:           500,
		SurvivalTimeSec: 120.0,
		Synergies:       []string{"glass_cannon"},
	})
	store.AddRoundResult("agent-1", RoundResult{
		FinalLevel:      3,
		Kills:           1,
		Rank:            5,
		Score:           300,
		SurvivalTimeSec: 60.0,
		Synergies:       []string{},
	})

	metrics := store.GetMetrics("agent-1")
	if metrics.TotalRounds != 2 {
		t.Errorf("expected 2 rounds, got %d", metrics.TotalRounds)
	}
	if metrics.AvgLevel != 4.0 {
		t.Errorf("expected avg level 4.0, got %.1f", metrics.AvgLevel)
	}
	if metrics.AvgKills != 2.0 {
		t.Errorf("expected avg kills 2.0, got %.1f", metrics.AvgKills)
	}
	if metrics.BuildWinRate != 50.0 {
		t.Errorf("expected win rate 50.0%%, got %.1f%%", metrics.BuildWinRate)
	}
	if metrics.SynergyActivationRate != 50.0 {
		t.Errorf("expected synergy rate 50.0%%, got %.1f%%", metrics.SynergyActivationRate)
	}
}

func TestTrainingStore_Persistence(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	// Store 1: write data
	store1 := NewTrainingStore(dir)
	store1.SetConfig("agent-1", TrainingConfig{
		BuildPath:   "fortress",
		CombatStyle: "defensive",
	})
	store1.AddRoundResult("agent-1", RoundResult{FinalLevel: 7, Score: 700})

	// Store 2: load from same dir
	store2 := NewTrainingStore(dir)
	cfg := store2.GetConfig("agent-1")
	if cfg.BuildPath != "fortress" {
		t.Errorf("expected persisted buildPath=fortress, got %s", cfg.BuildPath)
	}

	history := store2.GetHistory("agent-1", 10)
	if len(history) != 1 {
		t.Errorf("expected 1 persisted result, got %d", len(history))
	}
	if history[0].FinalLevel != 7 {
		t.Errorf("expected persisted level=7, got %d", history[0].FinalLevel)
	}
}

func TestTrainingStore_EmptyMetrics(t *testing.T) {
	dir, _ := os.MkdirTemp("", "training_test")
	defer os.RemoveAll(dir)

	store := NewTrainingStore(dir)
	metrics := store.GetMetrics("nonexistent")
	if metrics.TotalRounds != 0 {
		t.Errorf("expected 0 rounds for nonexistent agent, got %d", metrics.TotalRounds)
	}
}
