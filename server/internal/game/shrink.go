package game

import (
	"math"
)

// ArenaShrink manages the shrinking arena boundary.
type ArenaShrink struct {
	currentRadius float64
	minRadius     float64
	shrinkPerTick float64
	penaltyRate   float64 // mass fraction lost per tick when outside
	enabled       bool
}

// NewArenaShrink creates a new arena shrink system from config.
func NewArenaShrink(cfg ArenaConfig) *ArenaShrink {
	return &ArenaShrink{
		currentRadius: cfg.ArenaRadius,
		minRadius:     cfg.ShrinkMinRadius,
		shrinkPerTick: cfg.ShrinkPerTick,
		penaltyRate:   cfg.BoundaryPenaltyPerTick,
		enabled:       cfg.ShrinkEnabled,
	}
}

// Update shrinks the arena and penalizes agents outside the boundary.
func (s *ArenaShrink) Update(agents map[string]*Agent) {
	if !s.enabled {
		return
	}

	// Shrink radius
	if s.currentRadius > s.minRadius {
		s.currentRadius = math.Max(s.minRadius, s.currentRadius-s.shrinkPerTick)
	}

	// Penalize agents outside boundary
	for _, agent := range agents {
		if !agent.Alive {
			continue
		}

		dist := distanceFromOrigin(agent.Position)
		if dist > s.currentRadius {
			// Mass penalty
			penalty := agent.Mass * s.penaltyRate
			agent.Mass -= penalty

			// Push toward center
			if dist > 0 {
				pushRatio := s.currentRadius / dist * 0.99
				agent.Position.X *= pushRatio
				agent.Position.Y *= pushRatio
			}

			if agent.Mass < 0 {
				agent.Mass = 0
			}
		}
	}
}

// CurrentRadius returns the current arena boundary radius.
func (s *ArenaShrink) CurrentRadius() float64 {
	return s.currentRadius
}

// Start enables the shrink system.
func (s *ArenaShrink) Start() {
	s.enabled = true
}

// Stop disables the shrink system.
func (s *ArenaShrink) Stop() {
	s.enabled = false
}

// Reset restores the arena to its initial radius.
func (s *ArenaShrink) Reset(initialRadius float64) {
	s.currentRadius = initialRadius
}
