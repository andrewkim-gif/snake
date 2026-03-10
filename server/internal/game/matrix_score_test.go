package game

import (
	"testing"
)

// ============================================================
// v33 Phase 8 — ScoreAggregator Integration Tests
//
// Tests score computation, nation score accumulation,
// snapshot/reset lifecycle, history ring buffer, player ranking.
// ============================================================

func TestScoreAggregator_BasicScoring(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	t.Run("kill adds 15 points to nation", func(t *testing.T) {
		sa.AddKill("p1", "Player1", "KOR", false, true)

		scores := sa.GetNationScores()
		if scores["KOR"] != MatrixScorePerKill {
			t.Errorf("KOR score = %d, want %d", scores["KOR"], MatrixScorePerKill)
		}
	})

	t.Run("level adds level*10 to nation (incremental)", func(t *testing.T) {
		sa.AddLevel("p1", "Player1", "KOR", 5, false, true) // level 0→5 = +50 points (initial level is 0)

		scores := sa.GetNationScores()
		expected := MatrixScorePerKill + 5*MatrixScorePerLevel // 15 + 50 = 65
		if scores["KOR"] != expected {
			t.Errorf("KOR score = %d, want %d", scores["KOR"], expected)
		}
	})

	t.Run("damage adds damage*0.5 to nation", func(t *testing.T) {
		sa.AddDamage("p1", "Player1", "KOR", 100, false, true) // 100 * 0.5 = 50

		scores := sa.GetNationScores()
		expected := MatrixScorePerKill + 5*MatrixScorePerLevel + int(100*MatrixScorePerDamage)
		if scores["KOR"] != expected {
			t.Errorf("KOR score = %d, want %d", scores["KOR"], expected)
		}
	})

	t.Run("survival adds 100 to nation", func(t *testing.T) {
		sa.AddSurvival("p1", "Player1", "KOR", false, true)

		scores := sa.GetNationScores()
		expected := MatrixScorePerKill + 5*MatrixScorePerLevel + int(100*MatrixScorePerDamage) + MatrixScoreSurvivalBonus
		if scores["KOR"] != expected {
			t.Errorf("KOR score = %d, want %d", scores["KOR"], expected)
		}
	})

	t.Run("capture adds 30 to nation", func(t *testing.T) {
		sa.AddCapture("p1", "Player1", "KOR", false, true)

		scores := sa.GetNationScores()
		expected := MatrixScorePerKill + 5*MatrixScorePerLevel + int(100*MatrixScorePerDamage) + MatrixScoreSurvivalBonus + MatrixScorePerCapture
		if scores["KOR"] != expected {
			t.Errorf("KOR score = %d, want %d", scores["KOR"], expected)
		}
	})
}

func TestScoreAggregator_MultiNation(t *testing.T) {
	sa := NewScoreAggregator("ARENA1")

	// Add scores for multiple nations
	sa.AddKill("p1", "KOR_Player", "KOR", false, true)
	sa.AddKill("p1", "KOR_Player", "KOR", false, true)
	sa.AddKill("p2", "USA_Player", "USA", false, true)
	sa.AddKill("p3", "JPN_Player", "JPN", false, true)
	sa.AddKill("p3", "JPN_Player", "JPN", false, true)
	sa.AddKill("p3", "JPN_Player", "JPN", false, true)

	t.Run("nation scores are separate", func(t *testing.T) {
		scores := sa.GetNationScores()
		if scores["KOR"] != 30 {
			t.Errorf("KOR = %d, want 30", scores["KOR"])
		}
		if scores["USA"] != 15 {
			t.Errorf("USA = %d, want 15", scores["USA"])
		}
		if scores["JPN"] != 45 {
			t.Errorf("JPN = %d, want 45", scores["JPN"])
		}
	})

	t.Run("rankings ordered by score descending", func(t *testing.T) {
		rankings := sa.GetNationRankings()
		if len(rankings) != 3 {
			t.Fatalf("rankings len = %d, want 3", len(rankings))
		}
		if rankings[0].Nationality != "JPN" || rankings[0].Score != 45 {
			t.Errorf("rank 1 = %v, want JPN:45", rankings[0])
		}
		if rankings[1].Nationality != "KOR" || rankings[1].Score != 30 {
			t.Errorf("rank 2 = %v, want KOR:30", rankings[1])
		}
		if rankings[2].Nationality != "USA" || rankings[2].Score != 15 {
			t.Errorf("rank 3 = %v, want USA:15", rankings[2])
		}
	})
}

func TestScoreAggregator_PlayerScore(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	sa.AddKill("p1", "Player1", "KOR", false, true) // 15
	sa.AddKill("p1", "Player1", "KOR", false, true) // 15
	sa.AddLevel("p1", "Player1", "KOR", 3, false, true) // level 0→3 = +30
	sa.AddDamage("p1", "Player1", "KOR", 50, false, true) // 50*0.5 = 25

	t.Run("get player score", func(t *testing.T) {
		score, ok := sa.GetPlayerScore("p1")
		if !ok {
			t.Fatal("player p1 not found")
		}
		// kills=2*15=30, level=3*10=30, damage=25, survival=0 = 85
		expected := 2*MatrixScorePerKill + 3*MatrixScorePerLevel + int(50*MatrixScorePerDamage)
		if score != expected {
			t.Errorf("score = %d, want %d", score, expected)
		}
	})

	t.Run("player rank", func(t *testing.T) {
		// Only one player, so rank should be 1
		rank := sa.GetPlayerRank("p1")
		if rank != 1 {
			t.Errorf("rank = %d, want 1", rank)
		}
	})

	t.Run("unknown player rank", func(t *testing.T) {
		// Unknown player has score=0, p1 has score>0, so unknown is rank 2
		rank := sa.GetPlayerRank("unknown")
		if rank != 2 {
			t.Errorf("unknown player rank = %d, want 2 (p1 is above)", rank)
		}
	})
}

func TestScoreAggregator_SnapshotAndReset(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	// Accumulate some scores
	sa.AddKill("p1", "Player1", "KOR", false, true)
	sa.AddKill("p2", "Player2", "USA", false, true)
	sa.AddSurvival("p1", "Player1", "KOR", false, true)
	sa.AddLevel("p1", "Player1", "KOR", 5, false, true)

	t.Run("snapshot captures scores", func(t *testing.T) {
		snapshot := sa.SnapshotAndReset(1)
		if snapshot == nil {
			t.Fatal("snapshot should not be nil")
		}
		if snapshot.EpochNumber != 1 {
			t.Errorf("epoch = %d, want 1", snapshot.EpochNumber)
		}
		if len(snapshot.PlayerScores) != 2 {
			t.Errorf("players = %d, want 2", len(snapshot.PlayerScores))
		}
		if snapshot.MVP == nil {
			t.Fatal("MVP should not be nil")
		}
		if snapshot.MVP.PlayerID != "p1" {
			t.Errorf("MVP = %s, want p1", snapshot.MVP.PlayerID)
		}
	})

	t.Run("scores reset after snapshot", func(t *testing.T) {
		scores := sa.GetNationScores()
		if len(scores) != 0 {
			t.Errorf("expected 0 nation scores after reset, got %d", len(scores))
		}

		count := sa.GetTotalPlayers()
		if count != 0 {
			t.Errorf("expected 0 players after reset, got %d", count)
		}
	})

	t.Run("history retained", func(t *testing.T) {
		hist := sa.GetHistory()
		if len(hist) != 1 {
			t.Errorf("history len = %d, want 1", len(hist))
		}
	})

	t.Run("last snapshot accessible", func(t *testing.T) {
		last := sa.GetLastSnapshot()
		if last == nil {
			t.Fatal("last snapshot should not be nil")
		}
		if last.EpochNumber != 1 {
			t.Errorf("last epoch = %d, want 1", last.EpochNumber)
		}
	})
}

func TestScoreAggregator_HistoryRingBuffer(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	// Fill beyond MaxScoreHistory
	for i := 0; i < MaxScoreHistory+5; i++ {
		sa.AddKill("p1", "Player1", "KOR", false, true)
		sa.SnapshotAndReset(i + 1)
	}

	hist := sa.GetHistory()
	if len(hist) != MaxScoreHistory {
		t.Errorf("history len = %d, want %d (ring buffer)", len(hist), MaxScoreHistory)
	}

	// First entry should be epoch 6 (oldest 5 evicted)
	if hist[0].EpochNumber != 6 {
		t.Errorf("oldest epoch = %d, want 6", hist[0].EpochNumber)
	}
}

func TestScoreAggregator_SurvivalNotDouble(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	// AddSurvival twice should only count once
	sa.AddSurvival("p1", "Player1", "KOR", false, true)
	sa.AddSurvival("p1", "Player1", "KOR", false, true)

	scores := sa.GetNationScores()
	if scores["KOR"] != MatrixScoreSurvivalBonus {
		t.Errorf("survival called twice should only add %d, got %d",
			MatrixScoreSurvivalBonus, scores["KOR"])
	}
}

func TestScoreAggregator_LevelIncrementalOnly(t *testing.T) {
	sa := NewScoreAggregator("KOR")

	sa.AddLevel("p1", "Player1", "KOR", 5, false, true) // level 0→5 = +50
	sa.AddLevel("p1", "Player1", "KOR", 5, false, true) // same level = 0 additional
	sa.AddLevel("p1", "Player1", "KOR", 3, false, true) // lower level = 0 additional

	scores := sa.GetNationScores()
	expected := 5 * MatrixScorePerLevel // only first level-up counts (0→5 = 50)
	if scores["KOR"] != expected {
		t.Errorf("KOR = %d, want %d (no double/down level scoring)", scores["KOR"], expected)
	}
}

func TestScoreAggregator_ComputePlayerScore(t *testing.T) {
	ps := &MatrixPlayerScore{
		Kills:    3,
		Level:    5,
		Damage:   200,
		Survived: true,
		Captures: 2,
	}

	score := ps.ComputeScore()
	expected := 3*15 + 5*10 + int(200*0.5) + 100 + 2*30 // 45+50+100+100+60 = 355
	if score != expected {
		t.Errorf("computed score = %d, want %d", score, expected)
	}
}

func TestScoreAggregator_Reset(t *testing.T) {
	sa := NewScoreAggregator("KOR")
	sa.AddKill("p1", "Player1", "KOR", false, true)
	sa.SnapshotAndReset(1)

	sa.Reset()

	if len(sa.GetHistory()) != 0 {
		t.Error("history should be cleared after Reset()")
	}
	if len(sa.GetNationScores()) != 0 {
		t.Error("nation scores should be cleared after Reset()")
	}
}
