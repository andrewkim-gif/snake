package game

import (
	"math"
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestSpatialHash_InsertAndQueryAgents(t *testing.T) {
	h := NewSpatialHash(6000, 200)

	// Insert 100 agents in a grid pattern
	for i := 0; i < 100; i++ {
		x := float64(i%10)*100 - 450
		y := float64(i/10)*100 - 450
		h.InsertAgent("agent-"+string(rune('A'+i)), domain.Position{X: x, Y: y})
	}

	// Query around center (0, 0) with radius 250 — should find agents near center
	results := h.QueryAgents(domain.Position{X: 0, Y: 0}, 250)
	if len(results) == 0 {
		t.Fatal("expected to find agents near center, got 0")
	}

	// SpatialHash is a broadphase: it returns cell-level candidates.
	// Verify that agents truly within radius ARE included (no false negatives for close agents).
	trueNearbyCount := 0
	for _, entry := range results {
		dist := math.Sqrt(entry.X*entry.X + entry.Y*entry.Y)
		if dist <= 250 {
			trueNearbyCount++
		}
	}
	if trueNearbyCount == 0 {
		t.Error("expected at least some agents truly within 250px radius")
	}
}

func TestSpatialHash_InsertAndQueryOrbs(t *testing.T) {
	h := NewSpatialHash(6000, 200)

	// Insert orbs at known positions
	for i := 0; i < 50; i++ {
		orb := &domain.Orb{
			ID:       uint64(i),
			Position: domain.Position{X: float64(i * 10), Y: float64(i * 10)},
			Value:    1.0,
			Color:    0,
			Type:     domain.OrbNatural,
		}
		h.InsertOrb(orb)
	}

	results := h.QueryOrbs(domain.Position{X: 100, Y: 100}, 300)
	if len(results) == 0 {
		t.Fatal("expected to find orbs near (100,100)")
	}
}

func TestSpatialHash_Clear(t *testing.T) {
	h := NewSpatialHash(6000, 200)

	h.InsertAgent("a1", domain.Position{X: 100, Y: 200})
	h.InsertAgent("a2", domain.Position{X: 300, Y: 400})

	results := h.QueryAgents(domain.Position{X: 100, Y: 200}, 50)
	if len(results) == 0 {
		t.Fatal("expected agents before clear")
	}

	h.Clear()

	results = h.QueryAgents(domain.Position{X: 100, Y: 200}, 50)
	if len(results) != 0 {
		t.Fatalf("expected 0 agents after clear, got %d", len(results))
	}
}

func TestSpatialHash_QueryRadius(t *testing.T) {
	h := NewSpatialHash(6000, 200)

	// Place agent at (0,0)
	h.InsertAgent("near", domain.Position{X: 0, Y: 0})
	// Place agent far away
	h.InsertAgent("far", domain.Position{X: 5000, Y: 5000})

	results := h.QueryAgents(domain.Position{X: 0, Y: 0}, 100)

	foundNear := false
	foundFar := false
	for _, e := range results {
		if e.AgentID == "near" {
			foundNear = true
		}
		if e.AgentID == "far" {
			foundFar = true
		}
	}

	if !foundNear {
		t.Error("should find 'near' agent")
	}
	if foundFar {
		t.Error("should NOT find 'far' agent with radius 100")
	}
}
