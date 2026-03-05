package game

import (
	"testing"
)

func TestDefaultArenaConfig_MatchesTS(t *testing.T) {
	cfg := DefaultArenaConfig()

	// Values must match packages/shared/src/constants/game.ts ARENA_CONFIG
	checks := []struct {
		name string
		got  float64
		want float64
	}{
		{"ArenaRadius", cfg.ArenaRadius, 6000},
		{"BaseSpeed", cfg.BaseSpeed, 150},
		{"BoostSpeed", cfg.BoostSpeed, 300},
		{"TurnRate", cfg.TurnRate, 0.25},
		{"InitialMass", cfg.InitialMass, 10},
		{"MinBoostMass", cfg.MinBoostMass, 15},
		{"BoostCostPerTick", cfg.BoostCostPerTick, 0.5},
		{"CollectRadius", cfg.CollectRadius, 20},
		{"AuraRadius", cfg.AuraRadius, 60},
		{"AuraDPSPerTick", cfg.AuraDPSPerTick, 2.0},
		{"DashDamageRatio", cfg.DashDamageRatio, 0.30},
		{"HitboxBaseRadius", cfg.HitboxBaseRadius, 16},
		{"HitboxMaxRadius", cfg.HitboxMaxRadius, 22},
		{"ShrinkRatePerMin", cfg.ShrinkRatePerMin, 600},
		{"ShrinkMinRadius", cfg.ShrinkMinRadius, 1200},
		{"ShrinkPerTick", cfg.ShrinkPerTick, 0.5},
		{"BoundaryPenaltyPerTick", cfg.BoundaryPenaltyPerTick, 0.0025},
	}

	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, c.got, c.want)
		}
	}

	intChecks := []struct {
		name string
		got  int
		want int
	}{
		{"MaxPlayers", cfg.MaxPlayers, 100},
		{"TickRate", cfg.TickRate, 20},
		{"NaturalOrbTarget", cfg.NaturalOrbTarget, 2000},
		{"UpgradeChoiceTimeout", cfg.UpgradeChoiceTimeout, 100},
		{"GracePeriodTicks", cfg.GracePeriodTicks, 600},
	}

	for _, c := range intChecks {
		if c.got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, c.got, c.want)
		}
	}

	if !cfg.ShrinkEnabled {
		t.Error("ShrinkEnabled should be true")
	}
}

func TestDefaultRoomConfig_MatchesTS(t *testing.T) {
	cfg := DefaultRoomConfig()

	// Values must match packages/shared/src/constants/game.ts ROOM_CONFIG
	checks := []struct {
		name string
		got  int
		want int
	}{
		{"MaxRooms", cfg.MaxRooms, 5},
		{"MaxPlayersPerRoom", cfg.MaxPlayersPerRoom, 50},
		{"RoundDuration", cfg.RoundDuration, 300},
		{"CountdownDuration", cfg.CountdownDuration, 10},
		{"EndingDuration", cfg.EndingDuration, 5},
		{"CooldownDuration", cfg.CooldownDuration, 15},
		{"MinPlayersToStart", cfg.MinPlayersToStart, 1},
		{"BotsPerRoom", cfg.BotsPerRoom, 15},
		{"RoomOrbTarget", cfg.RoomOrbTarget, 1000},
		{"LobbyUpdateMs", cfg.LobbyUpdateMs, 1000},
		{"RecentWinnersCount", cfg.RecentWinnersCount, 10},
	}

	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, c.got, c.want)
		}
	}
}
