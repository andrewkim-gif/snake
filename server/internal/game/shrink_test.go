package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestArenaShrink_RadiusDecreases(t *testing.T) {
	cfg := DefaultArenaConfig()
	shrink := NewArenaShrink(cfg)

	initial := shrink.CurrentRadius()
	agents := map[string]*Agent{}

	// Run 200 ticks
	for i := 0; i < 200; i++ {
		shrink.Update(agents)
	}

	after := shrink.CurrentRadius()
	if after >= initial {
		t.Errorf("radius should decrease after 200 ticks, was %f, now %f", initial, after)
	}

	expectedDecrease := 200 * cfg.ShrinkPerTick
	actualDecrease := initial - after
	if actualDecrease < expectedDecrease*0.99 || actualDecrease > expectedDecrease*1.01 {
		t.Errorf("expected decrease ~%f, got %f", expectedDecrease, actualDecrease)
	}
}

func TestArenaShrink_MinRadius(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.ShrinkMinRadius = 1000
	cfg.ShrinkPerTick = 100 // fast shrink for test
	shrink := NewArenaShrink(cfg)

	agents := map[string]*Agent{}
	for i := 0; i < 10000; i++ {
		shrink.Update(agents)
	}

	if shrink.CurrentRadius() < cfg.ShrinkMinRadius {
		t.Errorf("radius should not go below min %f, got %f", cfg.ShrinkMinRadius, shrink.CurrentRadius())
	}
}

func TestArenaShrink_OutsideAgentPenalty(t *testing.T) {
	cfg := DefaultArenaConfig()
	shrink := NewArenaShrink(cfg)

	// Place agent outside the boundary
	a := NewAgent("outside", "OutsideAgent", 0, domain.Position{X: cfg.ArenaRadius + 100, Y: 0}, 0)
	a.InitWithConfig(cfg, 0)
	a.Mass = 100

	agents := map[string]*Agent{"outside": a}
	massBefore := a.Mass

	shrink.Update(agents)

	if a.Mass >= massBefore {
		t.Error("agent outside boundary should lose mass")
	}

	// Agent should have been pushed inward
	if a.Position.X >= cfg.ArenaRadius+100 {
		t.Error("agent should have been pushed toward center")
	}
}

func TestArenaShrink_Disabled(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.ShrinkEnabled = false
	shrink := NewArenaShrink(cfg)

	initial := shrink.CurrentRadius()
	agents := map[string]*Agent{}

	for i := 0; i < 100; i++ {
		shrink.Update(agents)
	}

	if shrink.CurrentRadius() != initial {
		t.Error("radius should not change when shrink is disabled")
	}
}

func TestArenaShrink_Reset(t *testing.T) {
	cfg := DefaultArenaConfig()
	shrink := NewArenaShrink(cfg)

	agents := map[string]*Agent{}
	for i := 0; i < 100; i++ {
		shrink.Update(agents)
	}

	shrink.Reset(cfg.ArenaRadius)
	if shrink.CurrentRadius() != cfg.ArenaRadius {
		t.Errorf("expected radius %f after reset, got %f", cfg.ArenaRadius, shrink.CurrentRadius())
	}
}
