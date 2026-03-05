package game

import (
	"math"
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func newTestAgent(id string) *Agent {
	cfg := DefaultArenaConfig()
	a := NewAgent(id, "test", 0, domain.Position{X: 0, Y: 0}, 0)
	a.InitWithConfig(cfg, 0)
	return a
}

func TestAgent_NewAgent(t *testing.T) {
	a := newTestAgent("a1")

	if a.ID != "a1" {
		t.Errorf("expected ID 'a1', got %s", a.ID)
	}
	if a.Mass != 10 {
		t.Errorf("expected initial mass 10, got %f", a.Mass)
	}
	if a.Level != 1 {
		t.Errorf("expected level 1, got %d", a.Level)
	}
	if !a.Alive {
		t.Error("expected alive=true")
	}
	if a.HitboxRadius < 16 {
		t.Errorf("expected hitbox radius >= 16, got %f", a.HitboxRadius)
	}
}

func TestAgent_Update_MovesPosition(t *testing.T) {
	cfg := DefaultArenaConfig()
	a := newTestAgent("a1")

	startX := a.Position.X
	startY := a.Position.Y

	// Set target angle to 0 (right)
	a.TargetAngle = 0
	a.Heading = 0

	a.Update(cfg)

	// Position should have moved to the right
	if a.Position.X <= startX {
		t.Errorf("expected X to increase, was %f, now %f", startX, a.Position.X)
	}
	// Y should stay roughly the same (heading = 0 means movement along X)
	if math.Abs(a.Position.Y-startY) > 0.01 {
		t.Errorf("expected Y to stay same, was %f, now %f", startY, a.Position.Y)
	}
}

func TestAgent_Update_BoostReducesMass(t *testing.T) {
	cfg := DefaultArenaConfig()
	a := newTestAgent("a1")
	a.Mass = 50 // enough to boost

	a.Boosting = true
	startMass := a.Mass

	a.Update(cfg)

	if a.Mass >= startMass {
		t.Errorf("expected mass to decrease during boost, was %f, now %f", startMass, a.Mass)
	}
}

func TestAgent_TakeDamage(t *testing.T) {
	a := newTestAgent("a1")
	startMass := a.Mass

	a.TakeDamage(3.0, "attacker1")

	if a.Mass >= startMass {
		t.Errorf("expected mass to decrease after damage")
	}
	if a.LastDamagedBy != "attacker1" {
		t.Errorf("expected LastDamagedBy='attacker1', got %s", a.LastDamagedBy)
	}
}

func TestAgent_TakeDamage_WithArmor(t *testing.T) {
	a := newTestAgent("a1")
	a.Mass = 100

	// Give 3 stacks of armor (30% reduction)
	a.Build.Tomes[domain.TomeArmor] = 3

	startMass := a.Mass
	a.TakeDamage(10.0, "attacker")

	actualDamage := startMass - a.Mass
	expectedDamage := 10.0 * (1 - 0.30) // 7.0

	if math.Abs(actualDamage-expectedDamage) > 0.01 {
		t.Errorf("expected damage %.2f with 30%% armor, got %.2f", expectedDamage, actualDamage)
	}
}

func TestAgent_AddXP_LevelUp(t *testing.T) {
	a := newTestAgent("a1")

	// XPTable[1] = 20
	leveled := a.AddXP(25)
	if !leveled {
		t.Error("expected level up with 25 XP (threshold is 20)")
	}
	if a.Level != 2 {
		t.Errorf("expected level 2, got %d", a.Level)
	}
}

func TestAgent_AddXP_NoLevelUp(t *testing.T) {
	a := newTestAgent("a1")

	leveled := a.AddXP(5)
	if leveled {
		t.Error("should not level up with only 5 XP")
	}
	if a.Level != 1 {
		t.Errorf("expected level 1, got %d", a.Level)
	}
}

func TestAgent_GetAuraDPS(t *testing.T) {
	cfg := DefaultArenaConfig()
	a := newTestAgent("a1")

	baseDPS := a.GetAuraDPS(cfg)
	if baseDPS != cfg.AuraDPSPerTick {
		t.Errorf("expected base DPS %f, got %f", cfg.AuraDPSPerTick, baseDPS)
	}

	// Add damage tome
	a.Build.Tomes[domain.TomeDamage] = 2
	boostedDPS := a.GetAuraDPS(cfg)
	if boostedDPS <= baseDPS {
		t.Errorf("expected DPS to increase with damage tome, base=%f, boosted=%f", baseDPS, boostedDPS)
	}
}

func TestAgent_HasEffect(t *testing.T) {
	a := newTestAgent("a1")

	if a.HasEffect(domain.EffectGhost) {
		t.Error("should not have ghost effect initially")
	}

	a.AddEffect(domain.EffectGhost, 60, 100)

	if !a.HasEffect(domain.EffectGhost) {
		t.Error("should have ghost effect after adding")
	}
}

func TestAgent_Respawn(t *testing.T) {
	cfg := DefaultArenaConfig()
	a := newTestAgent("a1")
	a.Mass = 100
	a.Level = 5
	a.Kills = 10
	a.Alive = false

	a.Respawn(cfg, domain.Position{X: 500, Y: 500}, 100)

	if !a.Alive {
		t.Error("expected alive after respawn")
	}
	if a.Mass != cfg.InitialMass {
		t.Errorf("expected mass %f after respawn, got %f", cfg.InitialMass, a.Mass)
	}
	if a.Level != 1 {
		t.Errorf("expected level 1 after respawn, got %d", a.Level)
	}
}

func TestAgent_GetCollectRadius(t *testing.T) {
	cfg := DefaultArenaConfig()
	a := newTestAgent("a1")

	baseRadius := a.GetCollectRadius(cfg)
	if baseRadius != cfg.CollectRadius {
		t.Errorf("expected base collect radius %f, got %f", cfg.CollectRadius, baseRadius)
	}

	a.Build.Tomes[domain.TomeMagnet] = 2
	boostedRadius := a.GetCollectRadius(cfg)
	if boostedRadius <= baseRadius {
		t.Errorf("expected increased collect radius with magnet tome")
	}
}

func TestAngleDiff(t *testing.T) {
	tests := []struct {
		from, to, want float64
	}{
		{0, 0, 0},
		{0, math.Pi / 2, math.Pi / 2},
		{0, -math.Pi / 2, -math.Pi / 2},
		{math.Pi * 0.9, -math.Pi * 0.9, math.Pi * 0.2},
	}

	for _, tt := range tests {
		got := angleDiff(tt.from, tt.to)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("angleDiff(%f, %f) = %f, want %f", tt.from, tt.to, got, tt.want)
		}
	}
}
