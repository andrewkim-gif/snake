package game

// ArenaShrink manages the arena boundary shrink over time.
type ArenaShrink struct {
	initialRadius float64
	currentRadius float64
	minRadius     float64
	startDelayTicks uint64 // ticks before shrink begins
	shrinkRate    float64  // px per tick
	elapsedTicks  uint64
	shrinking     bool

	// Warning tracking
	warningTicksBefore uint64 // ticks before shrink to warn
	lastWarningTick    uint64
	warningSent        bool
}

// NewArenaShrink creates a new ArenaShrink manager.
func NewArenaShrink() *ArenaShrink {
	return &ArenaShrink{
		initialRadius:      ArenaRadius,
		currentRadius:      ArenaRadius,
		minRadius:          ArenaMinRadius,
		startDelayTicks:    uint64(ShrinkStartDelaySec * TickRate),
		shrinkRate:         ShrinkRatePerTick,
		elapsedTicks:       0,
		shrinking:          false,
		warningTicksBefore: uint64(ShrinkWarningSecondsBefore * TickRate),
		lastWarningTick:    0,
		warningSent:        false,
	}
}

// Update advances the shrink timer by one tick and returns the current radius.
// Also returns true if a shrink warning should be sent this tick.
func (as *ArenaShrink) Update() (radius float64, shouldWarn bool) {
	as.elapsedTicks++

	// Before shrink starts
	if as.elapsedTicks < as.startDelayTicks {
		// Check if we should warn about upcoming shrink
		ticksUntilShrink := as.startDelayTicks - as.elapsedTicks
		if ticksUntilShrink <= as.warningTicksBefore && !as.warningSent {
			as.warningSent = true
			return as.currentRadius, true
		}
		return as.currentRadius, false
	}

	// Shrink has started
	if !as.shrinking {
		as.shrinking = true
		as.warningSent = false // reset for future warnings
	}

	// Apply shrink
	if as.currentRadius > as.minRadius {
		as.currentRadius -= as.shrinkRate
		if as.currentRadius < as.minRadius {
			as.currentRadius = as.minRadius
		}
	}

	return as.currentRadius, false
}

// GetCurrentRadius returns the current arena radius.
func (as *ArenaShrink) GetCurrentRadius() float64 {
	return as.currentRadius
}

// GetElapsedTicks returns the total ticks since the shrink timer started.
func (as *ArenaShrink) GetElapsedTicks() uint64 {
	return as.elapsedTicks
}

// IsShrinking returns true if the arena is actively shrinking.
func (as *ArenaShrink) IsShrinking() bool {
	return as.shrinking
}

// GetSecondsUntilShrink returns seconds until shrink begins, or 0 if already shrinking.
func (as *ArenaShrink) GetSecondsUntilShrink() int {
	if as.shrinking || as.elapsedTicks >= as.startDelayTicks {
		return 0
	}
	ticksRemaining := as.startDelayTicks - as.elapsedTicks
	return int(ticksRemaining / uint64(TickRate))
}

// GetShrinkRate returns the shrink rate in px/tick.
func (as *ArenaShrink) GetShrinkRate() float64 {
	return as.shrinkRate
}

// Reset resets the shrink system to initial state.
func (as *ArenaShrink) Reset() {
	as.currentRadius = as.initialRadius
	as.elapsedTicks = 0
	as.shrinking = false
	as.warningSent = false
	as.lastWarningTick = 0
}

// GetRadiusAtTick calculates what the arena radius would be at a given tick.
// Useful for preview/prediction.
func GetRadiusAtTick(tick uint64) float64 {
	delayTicks := uint64(ShrinkStartDelaySec * TickRate)
	if tick < delayTicks {
		return ArenaRadius
	}
	shrinkTicks := tick - delayTicks
	radius := ArenaRadius - float64(shrinkTicks)*ShrinkRatePerTick
	if radius < ArenaMinRadius {
		radius = ArenaMinRadius
	}
	return radius
}
