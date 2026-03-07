package game

import (
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 8 — S37: Capture Point System
// 3 strategic points per arena: Resource (+XP), Buff (+DMG), Healing (+HP/s)
// Capture: 5s dwell (contested → interrupt)
// Held for 2 minutes then neutralizes
// During war: capture points become war objectives
// ============================================================

// CapturePointType defines the strategic benefit of a capture point.
type CapturePointType string

const (
	CapturePointResource CapturePointType = "resource" // +50% XP gain
	CapturePointBuff     CapturePointType = "buff"     // +25% damage
	CapturePointHealing  CapturePointType = "healing"  // +3 HP/s regen
)

// Capture point timing constants
const (
	// CaptureTimeTicks is the time to capture a point (5 seconds at 20Hz).
	CaptureTimeTicks = 5 * TickRate // 100 ticks

	// CaptureHoldDurationTicks is how long a capture is held before neutralizing (2 minutes).
	CaptureHoldDurationTicks = 2 * 60 * TickRate // 2400 ticks

	// CapturePointRadius is the area of influence around a capture point (px).
	CapturePointRadius = 80.0

	// CapturePointXPBonus is the XP multiplier for resource point holder.
	CapturePointXPBonus = 0.50

	// CapturePointDMGBonus is the damage multiplier for buff point holder.
	CapturePointDMGBonus = 0.25

	// CapturePointHealRate is the HP/s for healing point holder.
	CapturePointHealRate = 3.0

	// CapturePointHealPerTick is CapturePointHealRate / TickRate.
	CapturePointHealPerTick = CapturePointHealRate / TickRate

	// CapturePointWarScoreOnCapture is the war score awarded for capturing during war.
	CapturePointWarScoreOnCapture = 30
)

// CapturePointState represents the current state of a capture point.
type CapturePointState string

const (
	CaptureStateNeutral   CapturePointState = "neutral"   // Unclaimed
	CaptureStateCapturing CapturePointState = "capturing"  // Being captured
	CaptureStateContested CapturePointState = "contested"  // Multiple nations in area
	CaptureStateCaptured  CapturePointState = "captured"   // Held by a nation
)

// CapturePoint represents a single strategic point in an arena.
type CapturePoint struct {
	ID         string            `json:"id"`
	Type       CapturePointType  `json:"type"`
	X          float64           `json:"x"`
	Y          float64           `json:"y"`
	State      CapturePointState `json:"state"`
	Owner      string            `json:"owner,omitempty"`      // nationality ISO3 of holder
	Progress   float64           `json:"progress"`              // 0.0 → 1.0 capture progress
	HoldTicks  int               `json:"holdTicks"`             // ticks since capture
	Capturer   string            `json:"capturer,omitempty"`    // nationality currently capturing
	IsWarPoint bool              `json:"isWarPoint,omitempty"`  // true during war → counts as war objective
}

// CapturePointSnapshot is the serializable state for client transmission.
type CapturePointSnapshot struct {
	ID         string            `json:"id"`
	Type       CapturePointType  `json:"type"`
	X          float64           `json:"x"`
	Y          float64           `json:"y"`
	State      CapturePointState `json:"state"`
	Owner      string            `json:"owner,omitempty"`
	Progress   float64           `json:"progress"`
	Capturer   string            `json:"capturer,omitempty"`
	IsWarPoint bool              `json:"isWarPoint,omitempty"`
}

// CapturePointEvent is emitted when a capture point state changes.
type CapturePointEvent struct {
	PointID     string           `json:"pointId"`
	Type        CapturePointType `json:"type"`
	EventType   string           `json:"eventType"` // "captured", "neutralized", "contested", "progress"
	Nation      string           `json:"nation,omitempty"`
	PrevOwner   string           `json:"prevOwner,omitempty"`
	CountryCode string           `json:"countryCode"`
	Timestamp   time.Time        `json:"timestamp"`
}

// CapturePointSystem manages all capture points in a single arena.
type CapturePointSystem struct {
	mu sync.RWMutex

	// The 3 strategic points
	points []*CapturePoint

	// Arena metadata
	countryCode string
	arenaRadius float64

	// Event callback
	OnEvent func(event CapturePointEvent)
}

// NewCapturePointSystem creates a capture point system for an arena.
// Places 3 points in a triangle pattern around the arena center.
func NewCapturePointSystem(countryCode string, arenaRadius float64) *CapturePointSystem {
	cps := &CapturePointSystem{
		countryCode: countryCode,
		arenaRadius: arenaRadius,
	}

	// Place 3 points in equilateral triangle at 60% of arena radius
	placement := arenaRadius * 0.6
	types := []CapturePointType{CapturePointResource, CapturePointBuff, CapturePointHealing}
	labels := []string{"RESOURCE", "BUFF", "HEALING"}

	for i, cpType := range types {
		angle := float64(i)*2.0*math.Pi/3.0 - math.Pi/2.0 // Start from top
		cps.points = append(cps.points, &CapturePoint{
			ID:    fmt.Sprintf("cp_%s_%s", countryCode, labels[i]),
			Type:  cpType,
			X:     placement * math.Cos(angle),
			Y:     placement * math.Sin(angle),
			State: CaptureStateNeutral,
		})
	}

	return cps
}

// Tick updates all capture points based on nearby agents.
// agentNationalities maps agentID → nationality for agents within each point's radius.
func (cps *CapturePointSystem) Tick(nearbyAgents map[string][]string) {
	cps.mu.Lock()
	defer cps.mu.Unlock()

	for _, point := range cps.points {
		nationalities := nearbyAgents[point.ID]
		cps.tickPoint(point, nationalities)
	}
}

// tickPoint processes a single capture point tick.
func (cps *CapturePointSystem) tickPoint(point *CapturePoint, nationalities []string) {
	// Count unique nations in area
	nationCount := make(map[string]int)
	for _, nat := range nationalities {
		nationCount[nat]++
	}

	numNations := len(nationCount)

	switch point.State {
	case CaptureStateNeutral:
		if numNations == 1 {
			// Single nation → start capturing
			for nat := range nationCount {
				point.State = CaptureStateCapturing
				point.Capturer = nat
				point.Progress = 1.0 / float64(CaptureTimeTicks)
			}
		} else if numNations > 1 {
			point.State = CaptureStateContested
			point.Progress = 0
		}

	case CaptureStateCapturing:
		if numNations == 0 {
			// Nobody in area → slowly decay progress
			point.Progress -= 2.0 / float64(CaptureTimeTicks)
			if point.Progress <= 0 {
				point.State = CaptureStateNeutral
				point.Capturer = ""
				point.Progress = 0
			}
		} else if numNations == 1 {
			// Check if same nation still capturing
			for nat := range nationCount {
				if nat == point.Capturer {
					// Continue capture
					point.Progress += 1.0 / float64(CaptureTimeTicks)
					if point.Progress >= 1.0 {
						// Capture complete
						point.State = CaptureStateCaptured
						point.Owner = nat
						point.Progress = 1.0
						point.HoldTicks = 0

						slog.Info("capture point taken",
							"pointId", point.ID,
							"type", point.Type,
							"nation", nat,
							"country", cps.countryCode,
						)

						cps.emitEvent(CapturePointEvent{
							PointID:     point.ID,
							Type:        point.Type,
							EventType:   "captured",
							Nation:      nat,
							CountryCode: cps.countryCode,
							Timestamp:   time.Now(),
						})
					}
				} else {
					// Different nation → contest
					point.State = CaptureStateContested
					point.Progress = 0
					point.Capturer = ""
				}
			}
		} else {
			// Multiple nations → contested
			point.State = CaptureStateContested
			point.Progress = 0
			point.Capturer = ""
		}

	case CaptureStateContested:
		if numNations <= 1 {
			if numNations == 0 {
				point.State = CaptureStateNeutral
				point.Capturer = ""
			} else {
				// Single nation → start capturing
				for nat := range nationCount {
					point.State = CaptureStateCapturing
					point.Capturer = nat
					point.Progress = 1.0 / float64(CaptureTimeTicks)
				}
			}
		}
		// Still contested: no progress changes

	case CaptureStateCaptured:
		point.HoldTicks++

		// Check if hold duration exceeded → neutralize
		if point.HoldTicks >= CaptureHoldDurationTicks {
			prevOwner := point.Owner
			point.State = CaptureStateNeutral
			point.Owner = ""
			point.Progress = 0
			point.HoldTicks = 0

			slog.Info("capture point neutralized",
				"pointId", point.ID,
				"type", point.Type,
				"prevOwner", prevOwner,
				"country", cps.countryCode,
			)

			cps.emitEvent(CapturePointEvent{
				PointID:     point.ID,
				Type:        point.Type,
				EventType:   "neutralized",
				PrevOwner:   prevOwner,
				CountryCode: cps.countryCode,
				Timestamp:   time.Now(),
			})
		}

		// Check if enemy nation is contesting
		if numNations > 0 {
			hasEnemy := false
			for nat := range nationCount {
				if nat != point.Owner {
					hasEnemy = true
					break
				}
			}
			if hasEnemy {
				// Enemy present → start decapture (accelerated if no friendly units)
				hasFriendly := nationCount[point.Owner] > 0
				if !hasFriendly {
					// No defender → faster decapture
					point.Progress -= 3.0 / float64(CaptureTimeTicks)
				} else {
					// Contested but defended → slower decapture
					point.Progress -= 1.0 / float64(CaptureTimeTicks)
				}

				if point.Progress <= 0 {
					prevOwner := point.Owner
					point.State = CaptureStateNeutral
					point.Owner = ""
					point.Progress = 0
					point.HoldTicks = 0

					cps.emitEvent(CapturePointEvent{
						PointID:     point.ID,
						Type:        point.Type,
						EventType:   "neutralized",
						PrevOwner:   prevOwner,
						CountryCode: cps.countryCode,
						Timestamp:   time.Now(),
					})
				}
			}
		}
	}
}

// GetSnapshot returns the current state of all capture points for client transmission.
func (cps *CapturePointSystem) GetSnapshot() []CapturePointSnapshot {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	snapshots := make([]CapturePointSnapshot, len(cps.points))
	for i, pt := range cps.points {
		snapshots[i] = CapturePointSnapshot{
			ID:         pt.ID,
			Type:       pt.Type,
			X:          pt.X,
			Y:          pt.Y,
			State:      pt.State,
			Owner:      pt.Owner,
			Progress:   pt.Progress,
			Capturer:   pt.Capturer,
			IsWarPoint: pt.IsWarPoint,
		}
	}
	return snapshots
}

// GetPointOwner returns the owning nationality of a point, or empty string.
func (cps *CapturePointSystem) GetPointOwner(pointID string) string {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	for _, pt := range cps.points {
		if pt.ID == pointID && pt.State == CaptureStateCaptured {
			return pt.Owner
		}
	}
	return ""
}

// HasBuff returns true if the given nationality holds the buff point.
func (cps *CapturePointSystem) HasBuff(nationality string) bool {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	for _, pt := range cps.points {
		if pt.Type == CapturePointBuff && pt.State == CaptureStateCaptured && pt.Owner == nationality {
			return true
		}
	}
	return false
}

// HasResource returns true if the given nationality holds the resource point.
func (cps *CapturePointSystem) HasResource(nationality string) bool {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	for _, pt := range cps.points {
		if pt.Type == CapturePointResource && pt.State == CaptureStateCaptured && pt.Owner == nationality {
			return true
		}
	}
	return false
}

// HasHealing returns true if the given nationality holds the healing point.
func (cps *CapturePointSystem) HasHealing(nationality string) bool {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	for _, pt := range cps.points {
		if pt.Type == CapturePointHealing && pt.State == CaptureStateCaptured && pt.Owner == nationality {
			return true
		}
	}
	return false
}

// SetWarMode toggles all points to war objectives.
func (cps *CapturePointSystem) SetWarMode(active bool) {
	cps.mu.Lock()
	defer cps.mu.Unlock()

	for _, pt := range cps.points {
		pt.IsWarPoint = active
	}
}

// GetAgentsNearPoints determines which agents are near which capture points.
// Returns a map of pointID → list of nationalities in range.
func (cps *CapturePointSystem) GetAgentsNearPoints(agents []AgentPosition) map[string][]string {
	cps.mu.RLock()
	defer cps.mu.RUnlock()

	result := make(map[string][]string)
	for _, pt := range cps.points {
		for _, agent := range agents {
			dx := agent.X - pt.X
			dy := agent.Y - pt.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist <= CapturePointRadius {
				result[pt.ID] = append(result[pt.ID], agent.Nationality)
			}
		}
	}
	return result
}

// AgentPosition is a minimal agent representation for capture point calculations.
type AgentPosition struct {
	ID          string
	X           float64
	Y           float64
	Nationality string
	Alive       bool
}

// Reset resets all capture points to neutral.
func (cps *CapturePointSystem) Reset() {
	cps.mu.Lock()
	defer cps.mu.Unlock()

	for _, pt := range cps.points {
		pt.State = CaptureStateNeutral
		pt.Owner = ""
		pt.Progress = 0
		pt.HoldTicks = 0
		pt.Capturer = ""
		pt.IsWarPoint = false
	}
}

func (cps *CapturePointSystem) emitEvent(event CapturePointEvent) {
	if cps.OnEvent != nil {
		cps.OnEvent(event)
	}
}
