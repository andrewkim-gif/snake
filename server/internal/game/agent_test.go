package game

import (
	"math"
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- Test helpers ---

func newTestAgent(id, name string) *domain.Agent {
	pos := domain.Position{X: 0, Y: 0}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, false, 0)
}

func newTestAgentAt(id, name string, x, y float64) *domain.Agent {
	pos := domain.Position{X: x, Y: y}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, false, 0)
}

func newTestBotAgent(id, name string) *domain.Agent {
	pos := domain.Position{X: 0, Y: 0}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, true, 0)
}

// --- TestNewAgent ---

func TestNewAgent(t *testing.T) {
	t.Run("initial state", func(t *testing.T) {
		a := newTestAgent("p1", "TestPlayer")

		if !a.Alive {
			t.Error("new agent should be alive")
		}
		if a.Mass != InitialMass {
			t.Errorf("mass = %v, want %v", a.Mass, InitialMass)
		}
		if a.Level != InitialLevel {
			t.Errorf("level = %v, want %v", a.Level, InitialLevel)
		}
		if a.XP != 0 {
			t.Errorf("xp = %v, want 0", a.XP)
		}
		if a.Position.X != 0 || a.Position.Y != 0 {
			t.Errorf("position = (%v, %v), want (0, 0)", a.Position.X, a.Position.Y)
		}
		if a.ID != "p1" {
			t.Errorf("id = %v, want p1", a.ID)
		}
		if a.Name != "TestPlayer" {
			t.Errorf("name = %v, want TestPlayer", a.Name)
		}
		if a.Speed != BaseSpeed {
			t.Errorf("speed = %v, want %v", a.Speed, BaseSpeed)
		}
		if a.Boosting {
			t.Error("new agent should not be boosting")
		}
		if a.HitboxRadius != HitboxMinRadius {
			t.Errorf("hitbox = %v, want %v", a.HitboxRadius, HitboxMinRadius)
		}
	})

	t.Run("grace period set", func(t *testing.T) {
		a := NewAgent("p1", "Test", domain.Position{}, domain.DefaultSkin(), false, 100)
		expected := uint64(100 + GracePeriodTicks)
		if a.GracePeriodEnd != expected {
			t.Errorf("gracePeriodEnd = %v, want %v", a.GracePeriodEnd, expected)
		}
	})

	t.Run("bot flag", func(t *testing.T) {
		bot := newTestBotAgent("bot1", "BotName")
		if !bot.IsBot {
			t.Error("bot agent should have IsBot = true")
		}
		human := newTestAgent("p1", "Human")
		if human.IsBot {
			t.Error("human agent should have IsBot = false")
		}
	})

	t.Run("build initialized", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		if a.Build.Tomes == nil {
			t.Error("build.Tomes should be initialized (not nil)")
		}
		if a.Build.AbilitySlots == nil {
			t.Error("build.AbilitySlots should be initialized (not nil)")
		}
		if a.Build.MaxAbilities != AbilityBaseSlots {
			t.Errorf("maxAbilities = %v, want %v", a.Build.MaxAbilities, AbilityBaseSlots)
		}
	})
}

// --- TestApplyInput ---

func TestApplyInput(t *testing.T) {
	t.Run("sets target angle and boost", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		ApplyInput(a, 1.5, true)

		if math.Abs(a.TargetAngle-1.5) > 0.001 {
			t.Errorf("targetAngle = %v, want 1.5", a.TargetAngle)
		}
		if !a.Boosting {
			t.Error("boosting should be true")
		}
	})

	t.Run("normalizes angle", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		ApplyInput(a, 4*math.Pi, false) // should normalize to ~0

		if a.TargetAngle > math.Pi || a.TargetAngle < -math.Pi {
			t.Errorf("targetAngle = %v, should be in [-pi, pi]", a.TargetAngle)
		}
	})

	t.Run("dead agent ignores input", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Alive = false
		ApplyInput(a, 2.0, true)

		if a.TargetAngle != 0 {
			t.Errorf("dead agent targetAngle changed to %v, want 0", a.TargetAngle)
		}
		if a.Boosting {
			t.Error("dead agent should not boost")
		}
	})
}

// --- TestUpdateAgent ---

func TestUpdateAgent(t *testing.T) {
	t.Run("moves agent by BaseSpeedPerTick", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Heading = 0 // heading right
		a.TargetAngle = 0
		a.GracePeriodEnd = 0 // clear grace period
		startX := a.Position.X

		// Advance past grace period
		UpdateAgent(a, GracePeriodTicks+1)

		movedX := a.Position.X - startX
		if math.Abs(movedX-BaseSpeedPerTick) > 0.01 {
			t.Errorf("moved X = %v, want ~%v", movedX, BaseSpeedPerTick)
		}
	})

	t.Run("dead agent does not move", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Alive = false
		UpdateAgent(a, 1000)

		if a.Position.X != 0 || a.Position.Y != 0 {
			t.Errorf("dead agent moved to (%v, %v)", a.Position.X, a.Position.Y)
		}
	})

	t.Run("boosting costs mass", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Boosting = true
		startMass := a.Mass
		UpdateAgent(a, 1000)

		if a.Mass >= startMass {
			t.Errorf("boosting should cost mass: mass = %v, startMass = %v", a.Mass, startMass)
		}
	})

	t.Run("boosting stops when mass too low", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Mass = MinBoostMass - 1
		a.Boosting = true
		UpdateAgent(a, 1000)

		if a.Boosting {
			t.Error("boosting should stop when mass < MinBoostMass")
		}
	})

	t.Run("regen tome adds mass", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Build.Tomes[domain.TomeRegen] = 3
		startMass := a.Mass
		UpdateAgent(a, 1000)

		expectedRegen := 3.0 * RegenPerTickPerStack
		massGain := a.Mass - startMass
		// The agent also moves but doesn't lose mass (no boost), so gain = regen
		if massGain < expectedRegen-0.01 {
			t.Errorf("regen mass gain = %v, want >= %v", massGain, expectedRegen)
		}
	})
}

// --- TestTakeDamage ---

func TestTakeDamage(t *testing.T) {
	t.Run("reduces mass", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		startMass := a.Mass
		dealt := TakeDamage(a, 10.0, "attacker", 1000)

		if a.Mass >= startMass {
			t.Errorf("mass should decrease: %v >= %v", a.Mass, startMass)
		}
		if dealt < 9.99 || dealt > 10.01 {
			t.Errorf("dealt = %v, want ~10.0", dealt)
		}
	})

	t.Run("grace period immunity", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		// GracePeriodEnd defaults to GracePeriodTicks
		startMass := a.Mass
		dealt := TakeDamage(a, 10.0, "attacker", 100) // tick 100 < GracePeriodTicks

		if a.Mass != startMass {
			t.Errorf("grace period should prevent damage: mass = %v, want %v", a.Mass, startMass)
		}
		if dealt != 0 {
			t.Errorf("dealt = %v, want 0 during grace period", dealt)
		}
	})

	t.Run("dead agent ignores damage", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Alive = false
		dealt := TakeDamage(a, 10.0, "attacker", 1000)

		if dealt != 0 {
			t.Errorf("dealt to dead agent = %v, want 0", dealt)
		}
	})

	t.Run("armor reduces damage", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		a.Build.Tomes[domain.TomeArmor] = 3

		dmgAmount := 10.0
		dealt := TakeDamage(a, dmgAmount, "attacker", 1000)

		// 3 stacks * 0.10 = 30% reduction => dealt should be ~7.0
		expectedReduction := 3.0 * 0.10
		expectedDamage := dmgAmount * (1.0 - expectedReduction)
		if math.Abs(dealt-expectedDamage) > 0.01 {
			t.Errorf("dealt = %v, want ~%v (armor reduction)", dealt, expectedDamage)
		}
	})

	t.Run("cursed tome increases damage taken", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		a.Build.Tomes[domain.TomeCursed] = 2

		dmgAmount := 10.0
		dealt := TakeDamage(a, dmgAmount, "attacker", 1000)

		// 2 stacks * 0.20 = 40% more damage => dealt should be ~14.0
		expectedDamage := dmgAmount * (1.0 + 2*0.20)
		if math.Abs(dealt-expectedDamage) > 0.01 {
			t.Errorf("dealt = %v, want ~%v (cursed vulnerability)", dealt, expectedDamage)
		}
	})

	t.Run("iron_fortress synergy reduces damage", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		a.ActiveSynergies = []string{"iron_fortress"}

		dmgAmount := 10.0
		dealt := TakeDamage(a, dmgAmount, "attacker", 1000)

		// iron_fortress: -30% reduction => dealt should be ~7.0
		expectedDamage := dmgAmount * (1.0 - 0.30)
		if math.Abs(dealt-expectedDamage) > 0.01 {
			t.Errorf("dealt = %v, want ~%v (iron_fortress)", dealt, expectedDamage)
		}
	})

	t.Run("death on zero mass", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		a.Mass = 5.0
		TakeDamage(a, 100.0, "attacker", 1000)

		if a.Mass != 0 {
			t.Errorf("mass should be 0 after lethal damage, got %v", a.Mass)
		}
	})

	t.Run("sets LastDamagedBy", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.GracePeriodEnd = 0
		TakeDamage(a, 5.0, "killer1", 1000)

		if a.LastDamagedBy != "killer1" {
			t.Errorf("lastDamagedBy = %v, want killer1", a.LastDamagedBy)
		}
	})
}

// --- TestAddXP ---

func TestAddXP(t *testing.T) {
	t.Run("accumulates XP", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		AddXP(a, 5)

		if a.XP != 5 {
			t.Errorf("xp = %v, want 5", a.XP)
		}
	})

	t.Run("returns true on level up", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		// Level 1 -> 2 requires 20 XP
		leveled := AddXP(a, 25)

		if !leveled {
			t.Error("should return true when XP reaches threshold")
		}
	})

	t.Run("returns false below threshold", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		leveled := AddXP(a, 5)

		if leveled {
			t.Error("should return false when XP below threshold")
		}
	})

	t.Run("dead agent gets no XP", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Alive = false
		leveled := AddXP(a, 100)

		if leveled {
			t.Error("dead agent should not level up")
		}
		if a.XP != 0 {
			t.Errorf("dead agent xp = %v, want 0", a.XP)
		}
	})

	t.Run("max level agent gets no XP", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Level = domain.MaxLevel
		leveled := AddXP(a, 100)

		if leveled {
			t.Error("max level agent should not level up")
		}
	})

	t.Run("XP tome bonus", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Build.Tomes[domain.TomeXP] = 2 // +40% XP

		AddXP(a, 10)

		// 10 * 1.40 = 14
		expectedXP := 14
		if a.XP != expectedXP {
			t.Errorf("xp = %v, want %v (with XP tome)", a.XP, expectedXP)
		}
	})

	t.Run("holy_trinity synergy XP bonus", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.ActiveSynergies = []string{"holy_trinity"}

		AddXP(a, 10)

		// 10 * (1.0 + 0.50) = 15
		expectedXP := 15
		if a.XP != expectedXP {
			t.Errorf("xp = %v, want %v (with holy_trinity)", a.XP, expectedXP)
		}
	})
}

// --- TestPerformLevelUp ---

func TestPerformLevelUp(t *testing.T) {
	t.Run("increments level", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.XP = 25
		PerformLevelUp(a)

		if a.Level != 2 {
			t.Errorf("level = %v, want 2", a.Level)
		}
	})

	t.Run("deducts XP cost", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.XP = 25
		xpToNext := a.XPToNext // 20 for level 2
		PerformLevelUp(a)

		expectedXP := 25 - xpToNext
		if a.XP != expectedXP {
			t.Errorf("xp = %v, want %v", a.XP, expectedXP)
		}
	})

	t.Run("updates XPToNext", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.XP = 20
		PerformLevelUp(a)

		expectedNext := domain.XPForLevel(3) // XP for level 3
		if a.XPToNext != expectedNext {
			t.Errorf("xpToNext = %v, want %v", a.XPToNext, expectedNext)
		}
	})

	t.Run("max level stops", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Level = domain.MaxLevel
		a.XP = 999
		PerformLevelUp(a)

		if a.Level != domain.MaxLevel {
			t.Errorf("level = %v, want %v (max)", a.Level, domain.MaxLevel)
		}
	})

	t.Run("XPToNext is 0 at max level", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Level = domain.MaxLevel - 1
		a.XP = 300
		a.XPToNext = domain.XPForLevel(domain.MaxLevel)
		PerformLevelUp(a)

		if a.Level != domain.MaxLevel {
			t.Errorf("level = %v, want %v", a.Level, domain.MaxLevel)
		}
		if a.XPToNext != 0 {
			t.Errorf("xpToNext at max = %v, want 0", a.XPToNext)
		}
	})
}

// --- Test helper functions ---

func TestDistanceBetween(t *testing.T) {
	t.Run("same point", func(t *testing.T) {
		a := domain.Position{X: 10, Y: 20}
		d := DistanceBetween(a, a)
		if d != 0 {
			t.Errorf("distance = %v, want 0", d)
		}
	})

	t.Run("known distance", func(t *testing.T) {
		a := domain.Position{X: 0, Y: 0}
		b := domain.Position{X: 3, Y: 4}
		d := DistanceBetween(a, b)
		if math.Abs(d-5.0) > 0.001 {
			t.Errorf("distance = %v, want 5.0", d)
		}
	})
}

func TestAgentDie(t *testing.T) {
	a := newTestAgent("p1", "Test")
	AgentDie(a)

	if a.Alive {
		t.Error("agent should be dead")
	}
	if a.Boosting {
		t.Error("dead agent should not be boosting")
	}
	if a.Speed != 0 {
		t.Errorf("dead agent speed = %v, want 0", a.Speed)
	}
}

func TestAddKill(t *testing.T) {
	a := newTestAgent("p1", "Test")
	AddKill(a)

	if a.Kills != 1 {
		t.Errorf("kills = %v, want 1", a.Kills)
	}
	if a.KillStreak != 1 {
		t.Errorf("killStreak = %v, want 1", a.KillStreak)
	}
	if a.Score != 100 {
		t.Errorf("score = %v, want 100", a.Score)
	}

	AddKill(a)
	if a.Kills != 2 || a.KillStreak != 2 || a.Score != 200 {
		t.Errorf("second kill: kills=%v, streak=%v, score=%v", a.Kills, a.KillStreak, a.Score)
	}
}

func TestGetEffectiveAuraDPS(t *testing.T) {
	t.Run("base DPS", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		dps := GetEffectiveAuraDPS(a)
		if math.Abs(dps-BaseAuraDPSPerTick) > 0.001 {
			t.Errorf("dps = %v, want %v", dps, BaseAuraDPSPerTick)
		}
	})

	t.Run("damage tome increases DPS", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.Build.Tomes[domain.TomeDamage] = 3
		dps := GetEffectiveAuraDPS(a)
		expectedMult := 1.0 + 3*0.15
		expected := BaseAuraDPSPerTick * expectedMult
		if math.Abs(dps-expected) > 0.001 {
			t.Errorf("dps = %v, want ~%v", dps, expected)
		}
	})

	t.Run("glass_cannon doubles DPS", func(t *testing.T) {
		a := newTestAgent("p1", "Test")
		a.ActiveSynergies = []string{"glass_cannon"}
		dps := GetEffectiveAuraDPS(a)
		expected := BaseAuraDPSPerTick * 2.0
		if math.Abs(dps-expected) > 0.001 {
			t.Errorf("dps = %v, want ~%v", dps, expected)
		}
	})
}
