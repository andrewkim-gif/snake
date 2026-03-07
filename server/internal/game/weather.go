package game

import (
	"math"
	"math/rand"
)

// ============================================================
// WeatherSystem — v16 Phase 8: 5분 주기 날씨 전환
// ============================================================

// WeatherType identifies the current weather condition.
type WeatherType string

const (
	WeatherClear     WeatherType = "clear"
	WeatherRain      WeatherType = "rain"
	WeatherSnow      WeatherType = "snow"
	WeatherSandstorm WeatherType = "sandstorm"
	WeatherFog       WeatherType = "fog"
)

// WeatherCycleTicks is the number of ticks per weather cycle (5 minutes at 20Hz).
const WeatherCycleTicks = 5 * 60 * TickRate // 6000 ticks

// WeatherTransitionTicks is the smooth transition duration between weather states (10 seconds).
const WeatherTransitionTicks = 10 * TickRate // 200 ticks

// WeatherState holds the current weather condition and modifiers.
type WeatherState struct {
	Type         WeatherType `json:"type"`
	Intensity    float64     `json:"intensity"`    // 0.0 ~ 1.0 (transition blend)
	SpeedMult    float64     `json:"speedMult"`    // speed modifier (e.g., 0.85 = -15%)
	VisionMult   float64     `json:"visionMult"`   // vision modifier (e.g., 0.6 = -40%)
}

// WeatherSystem manages weather cycling for an arena.
type WeatherSystem struct {
	current       WeatherType
	next          WeatherType
	intensity     float64 // 0 = fully current, 1 = fully next
	ticksInCycle  int     // ticks since last weather change
	rng           *rand.Rand
	biomeWeights  map[string][]weightedWeather // per-biome weather probabilities
}

type weightedWeather struct {
	weather WeatherType
	weight  float64
}

// NewWeatherSystem creates a weather system with biome-aware probabilities.
func NewWeatherSystem(seed int64) *WeatherSystem {
	ws := &WeatherSystem{
		current:      WeatherClear,
		next:         WeatherClear,
		intensity:    1.0, // fully settled
		ticksInCycle: 0,
		rng:          rand.New(rand.NewSource(seed)),
	}

	// Biome-specific weather distributions
	ws.biomeWeights = map[string][]weightedWeather{
		"forest": {
			{WeatherClear, 0.50},
			{WeatherRain, 0.30},
			{WeatherFog, 0.20},
		},
		"desert": {
			{WeatherClear, 0.55},
			{WeatherSandstorm, 0.35},
			{WeatherFog, 0.10},
		},
		"mountain": {
			{WeatherClear, 0.40},
			{WeatherSnow, 0.30},
			{WeatherFog, 0.30},
		},
		"urban": {
			{WeatherClear, 0.60},
			{WeatherRain, 0.25},
			{WeatherFog, 0.15},
		},
		"arctic": {
			{WeatherClear, 0.35},
			{WeatherSnow, 0.45},
			{WeatherFog, 0.20},
		},
		"island": {
			{WeatherClear, 0.50},
			{WeatherRain, 0.35},
			{WeatherFog, 0.15},
		},
	}

	return ws
}

// Update advances the weather system by one tick. Call every arena tick.
func (ws *WeatherSystem) Update(biome string) {
	ws.ticksInCycle++

	// Transition phase: blend from current to next
	if ws.intensity < 1.0 {
		ws.intensity += 1.0 / float64(WeatherTransitionTicks)
		if ws.intensity >= 1.0 {
			ws.intensity = 1.0
			ws.current = ws.next
		}
		return
	}

	// Check if it's time to change weather
	if ws.ticksInCycle >= WeatherCycleTicks {
		ws.ticksInCycle = 0
		ws.next = ws.pickNextWeather(biome)
		if ws.next != ws.current {
			ws.intensity = 0.0 // start transition
		}
	}
}

// pickNextWeather selects the next weather type based on biome weights.
func (ws *WeatherSystem) pickNextWeather(biome string) WeatherType {
	weights, ok := ws.biomeWeights[biome]
	if !ok {
		// Default distribution
		weights = ws.biomeWeights["forest"]
	}

	// Weighted random selection
	total := 0.0
	for _, w := range weights {
		total += w.weight
	}
	roll := ws.rng.Float64() * total
	cumulative := 0.0
	for _, w := range weights {
		cumulative += w.weight
		if roll <= cumulative {
			return w.weather
		}
	}
	return WeatherClear
}

// GetState returns the current weather state with modifiers.
func (ws *WeatherSystem) GetState() WeatherState {
	// During transition, blend modifiers between current and next
	currentMods := weatherModifiers(ws.current)
	nextMods := weatherModifiers(ws.next)

	t := ws.intensity // 0 = current, 1 = next
	blendedSpeed := currentMods.SpeedMult*(1-t) + nextMods.SpeedMult*t
	blendedVision := currentMods.VisionMult*(1-t) + nextMods.VisionMult*t

	// Active weather type is whichever has more influence
	activeType := ws.current
	if t > 0.5 {
		activeType = ws.next
	}

	return WeatherState{
		Type:       activeType,
		Intensity:  math.Min(1.0, t*2), // peak at mid-transition
		SpeedMult:  blendedSpeed,
		VisionMult: blendedVision,
	}
}

// weatherModifiers returns speed and vision multipliers for a weather type.
func weatherModifiers(w WeatherType) WeatherState {
	switch w {
	case WeatherClear:
		return WeatherState{SpeedMult: 1.0, VisionMult: 1.0}
	case WeatherRain:
		return WeatherState{SpeedMult: 0.95, VisionMult: 0.70}
	case WeatherSnow:
		return WeatherState{SpeedMult: 0.85, VisionMult: 0.50}
	case WeatherSandstorm:
		return WeatherState{SpeedMult: 0.90, VisionMult: 0.50}
	case WeatherFog:
		return WeatherState{SpeedMult: 1.0, VisionMult: 0.40}
	default:
		return WeatherState{SpeedMult: 1.0, VisionMult: 1.0}
	}
}
