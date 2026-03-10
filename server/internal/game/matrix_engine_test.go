package game

import (
	"fmt"
	"testing"
)

// ============================================================
// v33 Phase 8 — OnlineMatrixEngine Integration Tests
//
// End-to-end tests for the full engine lifecycle:
//   - Player join/leave
//   - Input processing + speed validation
//   - Kill report → validate → score → events
//   - Epoch phase transitions
//   - Epoch end → reward calculation → result event
//   - Tick + seed resync
//   - Buff application
// ============================================================

func TestEngine_PlayerLifecycle(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	t.Run("join player", func(t *testing.T) {
		session, buffs := engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:     "p1",
			Name:         "Player1",
			Nationality:  "KOR",
			IsAgent:      false,
			IsDirectPlay: true,
			TokenBalance: 500,
		})

		if session == nil {
			t.Fatal("expected session to be created")
		}
		if session.ClientID != "p1" {
			t.Errorf("clientID = %s, want p1", session.ClientID)
		}
		if session.Nationality != "KOR" {
			t.Errorf("nationality = %s, want KOR", session.Nationality)
		}
		if buffs == nil {
			t.Fatal("expected buffs to be returned")
		}
		// 500 tokens = Tier 2 (1000+ needed), actually 500 > 100 = Tier 1
		if buffs.Tier != 1 {
			t.Errorf("buff tier = %d, want 1 for balance 500", buffs.Tier)
		}
	})

	t.Run("player count", func(t *testing.T) {
		if engine.GetPlayerCount() != 1 {
			t.Errorf("count = %d, want 1", engine.GetPlayerCount())
		}
	})

	t.Run("get session", func(t *testing.T) {
		s := engine.GetSession("p1")
		if s == nil {
			t.Fatal("expected session to exist")
		}
	})

	t.Run("leave player", func(t *testing.T) {
		engine.OnPlayerLeave("p1")
		if engine.GetPlayerCount() != 0 {
			t.Errorf("count = %d, want 0 after leave", engine.GetPlayerCount())
		}
	})
}

func TestEngine_MaxPlayers(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Fill arena to capacity
	for i := 0; i < 50; i++ {
		session, _ := engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:    fmt.Sprintf("p%d", i),
			Name:        fmt.Sprintf("Player%d", i),
			Nationality: "KOR",
		})
		if session == nil {
			t.Fatalf("failed to add player %d", i)
		}
	}

	// 51st should be rejected
	session, _ := engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "overflow",
		Name:        "Overflow",
		Nationality: "KOR",
	})
	if session != nil {
		t.Error("expected 51st player to be rejected (arena full)")
	}
}

func TestEngine_InputProcessing(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "p1",
		Name:        "Player1",
		Nationality: "KOR",
	})

	t.Run("valid input updates position", func(t *testing.T) {
		engine.OnPlayerInput("p1", MatrixInputData{
			X: 100, Y: 200, Angle: 1.5, Boost: false, Tick: 1,
		})

		s := engine.GetSession("p1")
		if s.X != 100 || s.Y != 200 {
			t.Errorf("position = (%f, %f), want (100, 200)", s.X, s.Y)
		}
	})

	t.Run("input for unknown player ignored", func(t *testing.T) {
		// Should not panic
		engine.OnPlayerInput("unknown", MatrixInputData{
			X: 999, Y: 999, Angle: 0, Boost: false, Tick: 2,
		})
	})
}

func TestEngine_KillReportFlow(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Set up PvP mode
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

	// Add players
	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "k1",
		Name:        "Killer",
		Nationality: "KOR",
	})
	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "t1",
		Name:        "Target",
		Nationality: "USA",
	})

	// Set positions close enough
	engine.OnPlayerInput("k1", MatrixInputData{X: 100, Y: 100, Tick: 10})
	engine.OnPlayerInput("t1", MatrixInputData{X: 150, Y: 100, Tick: 10})

	// Advance tick to match
	engine.Tick(10)

	t.Run("valid kill confirmed", func(t *testing.T) {
		report := KillReport{
			KillerID: "k1",
			TargetID: "t1",
			WeaponID: "cannon",
			Damage:   40,
			Distance: 50,
			Tick:     10,
		}

		result := engine.OnKillReport(report)
		if !result.Valid {
			t.Errorf("expected valid kill, got rejected: %v", result.Reason)
		}
	})

	t.Run("kill confirm event queued", func(t *testing.T) {
		confirms := engine.ConsumePendingKillConfirms()
		if len(confirms) != 1 {
			t.Fatalf("expected 1 confirm, got %d", len(confirms))
		}
		if confirms[0].KillerID != "k1" {
			t.Errorf("killerID = %s, want k1", confirms[0].KillerID)
		}
		if confirms[0].Score != MatrixScorePerKill {
			t.Errorf("score = %d, want %d", confirms[0].Score, MatrixScorePerKill)
		}
	})

	t.Run("killer session updated", func(t *testing.T) {
		s := engine.GetSession("k1")
		if s.Kills != 1 {
			t.Errorf("kills = %d, want 1", s.Kills)
		}
	})

	t.Run("score aggregator updated", func(t *testing.T) {
		scores := engine.GetScoreAggregator().GetNationScores()
		if scores["KOR"] < MatrixScorePerKill {
			t.Errorf("KOR score = %d, want >= %d", scores["KOR"], MatrixScorePerKill)
		}
	})
}

func TestEngine_EpochPhaseTransitions(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	t.Run("initial phase is peace", func(t *testing.T) {
		if engine.GetCurrentPhase() != EpochPhasePeace {
			t.Errorf("phase = %v, want peace", engine.GetCurrentPhase())
		}
	})

	t.Run("peace → PvP disabled", func(t *testing.T) {
		if engine.IsPvPEnabled() {
			t.Error("PvP should be disabled during peace")
		}
	})

	t.Run("war countdown → PvP still disabled", func(t *testing.T) {
		engine.OnEpochPhaseChange(EpochPhaseWarCountdown, 1, 3000)
		if engine.IsPvPEnabled() {
			t.Error("PvP should be disabled during countdown")
		}
	})

	t.Run("war → PvP enabled", func(t *testing.T) {
		engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)
		if !engine.IsPvPEnabled() {
			t.Error("PvP should be enabled during war")
		}
	})

	t.Run("shrink → PvP still enabled", func(t *testing.T) {
		engine.OnEpochPhaseChange(EpochPhaseShrink, 1, 2000)
		if !engine.IsPvPEnabled() {
			t.Error("PvP should be enabled during shrink")
		}
	})

	t.Run("end → PvP disabled", func(t *testing.T) {
		engine.OnEpochPhaseChange(EpochPhaseEnd, 1, 1000)
		if engine.IsPvPEnabled() {
			t.Error("PvP should be disabled during end")
		}
	})

	t.Run("phase change events queued", func(t *testing.T) {
		events := engine.ConsumePendingPhaseChanges()
		if len(events) == 0 {
			t.Error("expected phase change events to be queued")
		}
	})

	t.Run("seed event on peace phase", func(t *testing.T) {
		engine.OnEpochPhaseChange(EpochPhasePeace, 2, 3000)
		seeds := engine.ConsumePendingSeedEvents()
		if len(seeds) == 0 {
			t.Error("expected seed event on epoch start (peace phase)")
		}
	})
}

func TestEngine_EpochEnd(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Add players and generate scores
	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:     "p1",
		Name:         "Player1",
		Nationality:  "KOR",
		IsDirectPlay: true,
	})
	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:     "p2",
		Name:         "Player2",
		Nationality:  "USA",
		IsDirectPlay: true,
	})

	// Set up war phase and generate kills
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)
	engine.OnPlayerInput("p1", MatrixInputData{X: 100, Y: 100, Tick: 10})
	engine.OnPlayerInput("p2", MatrixInputData{X: 150, Y: 100, Tick: 10})
	engine.Tick(10)

	engine.OnKillReport(KillReport{
		KillerID: "p1", TargetID: "p2",
		WeaponID: "cannon", Damage: 40, Tick: 10,
	})
	engine.OnLevelUp("p1", 5)

	t.Run("epoch end produces result", func(t *testing.T) {
		result := engine.OnEpochEnd(1, "KOR", false, false)
		if result == nil {
			t.Fatal("expected result from epoch end")
		}
		if len(result.Rankings) == 0 {
			t.Error("expected rankings in result")
		}
		if len(result.Rewards) == 0 {
			t.Error("expected rewards in result")
		}
	})

	t.Run("result event queued", func(t *testing.T) {
		results := engine.ConsumePendingResults()
		if len(results) != 1 {
			t.Fatalf("expected 1 result, got %d", len(results))
		}
	})

	t.Run("sessions reset after epoch", func(t *testing.T) {
		s := engine.GetSession("p1")
		if s != nil {
			if s.Kills != 0 {
				t.Errorf("kills should be reset to 0, got %d", s.Kills)
			}
			if s.Level != 1 {
				t.Errorf("level should be reset to 1, got %d", s.Level)
			}
		}
	})
}

func TestEngine_TickAndSeedResync(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Add a player to make engine active
	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "p1",
		Name:        "Player1",
		Nationality: "KOR",
	})

	// Trigger initial seed via epoch start
	engine.OnEpochPhaseChange(EpochPhasePeace, 1, 3000)
	engine.ConsumePendingSeedEvents() // clear initial seed

	t.Run("seed resync after 600 ticks", func(t *testing.T) {
		// Advance to 600 ticks (30 seconds at 20Hz)
		for i := uint64(1); i <= SeedResyncIntervalTicks; i++ {
			engine.Tick(i)
		}

		seeds := engine.ConsumePendingSeedEvents()
		if len(seeds) == 0 {
			t.Error("expected seed resync after 600 ticks")
		}
	})

	t.Run("tick counter updates", func(t *testing.T) {
		if engine.GetCurrentTick() != SeedResyncIntervalTicks {
			t.Errorf("tick = %d, want %d", engine.GetCurrentTick(), SeedResyncIntervalTicks)
		}
	})
}

func TestEngine_WorldState(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "p1",
		Name:        "Player1",
		Nationality: "KOR",
	})
	engine.OnPlayerInput("p1", MatrixInputData{X: 100, Y: 200, Tick: 1})

	state := engine.GetWorldState()

	t.Run("state contains player", func(t *testing.T) {
		if len(state.Players) != 1 {
			t.Fatalf("players = %d, want 1", len(state.Players))
		}
		if state.Players[0].ClientID != "p1" {
			t.Errorf("clientID = %s, want p1", state.Players[0].ClientID)
		}
	})

	t.Run("state has correct phase", func(t *testing.T) {
		if state.Phase != EpochPhasePeace {
			t.Errorf("phase = %v, want peace", state.Phase)
		}
	})
}

func TestEngine_Reset(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID: "p1", Name: "P1", Nationality: "KOR",
	})
	engine.Tick(100)

	engine.Reset()

	if engine.GetCurrentTick() != 0 {
		t.Errorf("tick = %d, want 0 after reset", engine.GetCurrentTick())
	}
	if engine.IsRunning() {
		t.Error("engine should not be running after reset")
	}
	if engine.IsPvPEnabled() {
		t.Error("PvP should be disabled after reset")
	}
}

func TestEngine_BannedPlayerRejected(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Ban a player via validator
	validator := engine.GetValidator()
	// Generate enough rejections to trigger ban
	for i := 0; i < SuspicionBanThreshold+1; i++ {
		validator.ValidateKill(
			KillReport{KillerID: "cheater", WeaponID: "fake"},
			uint64(i), makeKiller("cheater", "KOR"), makeTarget("t1", "USA"), true, nil,
		)
	}

	// Try to join as banned player
	session, _ := engine.OnPlayerJoin(MatrixJoinInfo{
		ClientID:    "cheater",
		Name:        "Cheater",
		Nationality: "KOR",
	})
	if session != nil {
		t.Error("expected banned player to be rejected on join")
	}
}

func TestEngine_BuffApplication(t *testing.T) {
	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	tests := []struct {
		name    string
		balance float64
		tier    int
	}{
		{"no buff", 50, 0},
		{"tier 1", 150, 1},
		{"tier 2", 1500, 2},
		{"tier 3", 15000, 3},
		{"tier 4", 150000, 4},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session, buffs := engine.OnPlayerJoin(MatrixJoinInfo{
				ClientID:     fmt.Sprintf("p%d", i),
				Name:         tt.name,
				Nationality:  "KOR",
				TokenBalance: tt.balance,
			})
			if session == nil {
				t.Fatal("expected session")
			}
			if buffs.Tier != tt.tier {
				t.Errorf("tier = %d, want %d for balance %f", buffs.Tier, tt.tier, tt.balance)
			}
		})
	}
}
