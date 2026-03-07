package game

import (
	"log/slog"
	"runtime"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 10 — S43: Server Performance Optimization
// Target: 50-agent tick < 50ms, bandwidth < 50KB/s
// ============================================================

// --- Tick Profiler ---

// TickProfiler measures per-tick performance metrics.
type TickProfiler struct {
	mu              sync.Mutex
	enabled         bool
	sampleCount     int
	totalDuration   time.Duration
	maxDuration     time.Duration
	budgetExceeded  int
	lastReport      time.Time
	reportInterval  time.Duration
	tickBudget      time.Duration
	phaseTimings    map[string]time.Duration
	phaseSamples    map[string]int
}

// NewTickProfiler creates a new tick profiler.
func NewTickProfiler() *TickProfiler {
	return &TickProfiler{
		enabled:        true,
		lastReport:     time.Now(),
		reportInterval: 30 * time.Second,
		tickBudget:     50 * time.Millisecond, // NFR-01: 50ms/tick budget
		phaseTimings:   make(map[string]time.Duration),
		phaseSamples:   make(map[string]int),
	}
}

// StartTick begins timing a tick.
func (tp *TickProfiler) StartTick() time.Time {
	if !tp.enabled {
		return time.Time{}
	}
	return time.Now()
}

// EndTick records the tick duration.
func (tp *TickProfiler) EndTick(start time.Time) {
	if !tp.enabled || start.IsZero() {
		return
	}
	elapsed := time.Since(start)

	tp.mu.Lock()
	defer tp.mu.Unlock()

	tp.sampleCount++
	tp.totalDuration += elapsed
	if elapsed > tp.maxDuration {
		tp.maxDuration = elapsed
	}
	if elapsed > tp.tickBudget {
		tp.budgetExceeded++
	}

	// Periodic report
	if time.Since(tp.lastReport) >= tp.reportInterval {
		tp.report()
		tp.reset()
	}
}

// RecordPhase records timing for a named phase within a tick.
func (tp *TickProfiler) RecordPhase(name string, d time.Duration) {
	if !tp.enabled {
		return
	}
	tp.mu.Lock()
	defer tp.mu.Unlock()
	tp.phaseTimings[name] += d
	tp.phaseSamples[name]++
}

func (tp *TickProfiler) report() {
	if tp.sampleCount == 0 {
		return
	}
	avgMs := float64(tp.totalDuration.Microseconds()) / float64(tp.sampleCount) / 1000.0
	maxMs := float64(tp.maxDuration.Microseconds()) / 1000.0
	overPct := float64(tp.budgetExceeded) / float64(tp.sampleCount) * 100

	slog.Info("tick profiler report",
		"samples", tp.sampleCount,
		"avg_ms", avgMs,
		"max_ms", maxMs,
		"budget_exceeded_pct", overPct,
	)

	// Log per-phase breakdown
	for phase, total := range tp.phaseTimings {
		samples := tp.phaseSamples[phase]
		if samples > 0 {
			avgPhaseMs := float64(total.Microseconds()) / float64(samples) / 1000.0
			slog.Info("tick phase",
				"phase", phase,
				"avg_ms", avgPhaseMs,
				"samples", samples,
			)
		}
	}
}

func (tp *TickProfiler) reset() {
	tp.sampleCount = 0
	tp.totalDuration = 0
	tp.maxDuration = 0
	tp.budgetExceeded = 0
	tp.lastReport = time.Now()
	tp.phaseTimings = make(map[string]time.Duration)
	tp.phaseSamples = make(map[string]int)
}

// GetStats returns current profiler statistics.
func (tp *TickProfiler) GetStats() TickProfileStats {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	avgMs := 0.0
	if tp.sampleCount > 0 {
		avgMs = float64(tp.totalDuration.Microseconds()) / float64(tp.sampleCount) / 1000.0
	}
	return TickProfileStats{
		SampleCount:    tp.sampleCount,
		AvgTickMs:      avgMs,
		MaxTickMs:      float64(tp.maxDuration.Microseconds()) / 1000.0,
		BudgetExceeded: tp.budgetExceeded,
	}
}

// TickProfileStats holds profiler statistics snapshot.
type TickProfileStats struct {
	SampleCount    int     `json:"sampleCount"`
	AvgTickMs      float64 `json:"avgTickMs"`
	MaxTickMs      float64 `json:"maxTickMs"`
	BudgetExceeded int     `json:"budgetExceeded"`
}

// --- Bandwidth Monitor ---

// BandwidthMonitor tracks per-client network usage.
type BandwidthMonitor struct {
	mu             sync.RWMutex
	clientBytes    map[string]int64
	clientMessages map[string]int
	startTime      time.Time
	maxBytesPerSec int64 // 50KB/s = 51200 bytes/s
}

// NewBandwidthMonitor creates a new bandwidth monitor.
func NewBandwidthMonitor() *BandwidthMonitor {
	return &BandwidthMonitor{
		clientBytes:    make(map[string]int64),
		clientMessages: make(map[string]int),
		startTime:      time.Now(),
		maxBytesPerSec: 51200, // 50 KB/s
	}
}

// RecordOutbound records outbound bytes for a client.
func (bm *BandwidthMonitor) RecordOutbound(clientID string, bytes int) {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	bm.clientBytes[clientID] += int64(bytes)
	bm.clientMessages[clientID]++
}

// GetClientBPS returns the bytes per second for a client.
func (bm *BandwidthMonitor) GetClientBPS(clientID string) float64 {
	bm.mu.RLock()
	defer bm.mu.RUnlock()
	elapsed := time.Since(bm.startTime).Seconds()
	if elapsed < 1 {
		elapsed = 1
	}
	return float64(bm.clientBytes[clientID]) / elapsed
}

// IsOverBudget returns true if a client exceeds the bandwidth budget.
func (bm *BandwidthMonitor) IsOverBudget(clientID string) bool {
	return bm.GetClientBPS(clientID) > float64(bm.maxBytesPerSec)
}

// Reset resets all tracking data.
func (bm *BandwidthMonitor) Reset() {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	bm.clientBytes = make(map[string]int64)
	bm.clientMessages = make(map[string]int)
	bm.startTime = time.Now()
}

// RemoveClient removes a client from tracking.
func (bm *BandwidthMonitor) RemoveClient(clientID string) {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	delete(bm.clientBytes, clientID)
	delete(bm.clientMessages, clientID)
}

// --- State Delta Compression ---

// StateDelta represents compressed state changes between ticks.
type StateDelta struct {
	Tick           uint64               `json:"t"`
	MovedAgents    []AgentMoveDelta     `json:"m,omitempty"`   // position+heading changes
	HPChanges      []HPDelta            `json:"h,omitempty"`   // HP changes only
	NewAgents      []domain.Agent       `json:"n,omitempty"`   // newly added agents
	RemovedAgents  []string             `json:"r,omitempty"`   // removed agent IDs
	WeaponEvents   []domain.WeaponDamageEvent `json:"w,omitempty"` // weapon fire events
}

// AgentMoveDelta is a compressed movement update (12 bytes vs full agent ~200 bytes).
type AgentMoveDelta struct {
	ID string  `json:"i"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	H  float64 `json:"h"` // heading (radians)
}

// HPDelta tracks HP changes.
type HPDelta struct {
	ID string  `json:"i"`
	HP float64 `json:"hp"`
}

// ComputeStateDelta computes the delta between previous and current agent states.
func ComputeStateDelta(
	prevPositions map[string]domain.Position,
	prevHP map[string]float64,
	agents map[string]*domain.Agent,
	tick uint64,
) StateDelta {
	delta := StateDelta{Tick: tick}

	for id, agent := range agents {
		if !agent.Alive {
			continue
		}
		prev, existed := prevPositions[id]
		if !existed {
			// New agent
			delta.NewAgents = append(delta.NewAgents, *agent)
			continue
		}

		// Position change detection (threshold: 0.5px)
		dx := agent.Position.X - prev.X
		dy := agent.Position.Y - prev.Y
		if dx*dx+dy*dy > 0.25 {
			delta.MovedAgents = append(delta.MovedAgents, AgentMoveDelta{
				ID: id,
				X:  agent.Position.X,
				Y:  agent.Position.Y,
				H:  agent.MoveHeading,
			})
		}

		// HP change detection
		prevHPVal := prevHP[id]
		if agent.HP != prevHPVal {
			delta.HPChanges = append(delta.HPChanges, HPDelta{
				ID: id,
				HP: agent.HP,
			})
		}
	}

	// Removed agents
	for id := range prevPositions {
		if _, exists := agents[id]; !exists {
			delta.RemovedAgents = append(delta.RemovedAgents, id)
		} else if agent := agents[id]; !agent.Alive {
			delta.RemovedAgents = append(delta.RemovedAgents, id)
		}
	}

	return delta
}

// --- Inactive Arena Memory Release ---

// InactiveArenaReaper periodically checks for and releases inactive arenas.
type InactiveArenaReaper struct {
	mu             sync.Mutex
	lastActivity   map[string]time.Time // countryCode → last activity time
	idleTimeout    time.Duration
	checkInterval  time.Duration
}

// NewInactiveArenaReaper creates a reaper with 1-minute idle timeout.
func NewInactiveArenaReaper() *InactiveArenaReaper {
	return &InactiveArenaReaper{
		lastActivity:  make(map[string]time.Time),
		idleTimeout:   60 * time.Second, // release after 1 min idle
		checkInterval: 30 * time.Second,
	}
}

// RecordActivity marks a country arena as active.
func (r *InactiveArenaReaper) RecordActivity(countryCode string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lastActivity[countryCode] = time.Now()
}

// GetIdleArenas returns country codes that have been idle past the timeout.
func (r *InactiveArenaReaper) GetIdleArenas() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	var idle []string
	now := time.Now()
	for code, last := range r.lastActivity {
		if now.Sub(last) > r.idleTimeout {
			idle = append(idle, code)
		}
	}
	return idle
}

// RemoveTracking stops tracking a country code.
func (r *InactiveArenaReaper) RemoveTracking(countryCode string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.lastActivity, countryCode)
}

// --- Object Pool for Weapon Events ---

// WeaponEventPool pools WeaponDamageEvent slices to reduce GC pressure.
var WeaponEventPool = sync.Pool{
	New: func() interface{} {
		s := make([]domain.WeaponDamageEvent, 0, 64)
		return &s
	},
}

// GetWeaponEventSlice gets a weapon event slice from the pool.
func GetWeaponEventSlice() *[]domain.WeaponDamageEvent {
	return WeaponEventPool.Get().(*[]domain.WeaponDamageEvent)
}

// PutWeaponEventSlice returns a weapon event slice to the pool.
func PutWeaponEventSlice(s *[]domain.WeaponDamageEvent) {
	*s = (*s)[:0]
	WeaponEventPool.Put(s)
}

// CollisionEventPool pools collision event slices.
var CollisionEventPool = sync.Pool{
	New: func() interface{} {
		s := make([]CollisionEvent, 0, 16)
		return &s
	},
}

// --- Memory Stats for Monitoring ---

// GetMemoryStats returns current memory usage statistics.
func GetMemoryStats() MemoryStats {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return MemoryStats{
		AllocMB:      float64(ms.Alloc) / 1024 / 1024,
		TotalAllocMB: float64(ms.TotalAlloc) / 1024 / 1024,
		SysMB:        float64(ms.Sys) / 1024 / 1024,
		NumGC:        ms.NumGC,
		GoroutineCount: runtime.NumGoroutine(),
	}
}

// MemoryStats holds memory usage information.
type MemoryStats struct {
	AllocMB        float64 `json:"allocMB"`
	TotalAllocMB   float64 `json:"totalAllocMB"`
	SysMB          float64 `json:"sysMB"`
	NumGC          uint32  `json:"numGC"`
	GoroutineCount int     `json:"goroutineCount"`
}

// --- Spatial Hash LOD for Weapon Effects ---

// LODLevel determines the level of detail for weapon effects based on distance.
type LODLevel int

const (
	LODFull    LODLevel = 0 // Full effects (< 300px from camera)
	LODMedium  LODLevel = 1 // Reduced particles (300-800px)
	LODLow     LODLevel = 2 // Minimal effects (800-1500px)
	LODNone    LODLevel = 3 // No effects (> 1500px)
)

// LODDistanceThresholds defines the camera distance thresholds for each LOD level.
var LODDistanceThresholds = [4]float64{300, 800, 1500, 99999}

// DetermineLOD calculates the LOD level based on distance from camera center.
func DetermineLOD(distFromCamera float64) LODLevel {
	for i, threshold := range LODDistanceThresholds {
		if distFromCamera < threshold {
			return LODLevel(i)
		}
	}
	return LODNone
}

// LODParticleCount returns the number of particles to use at a given LOD level.
func LODParticleCount(basCount int, lod LODLevel) int {
	switch lod {
	case LODFull:
		return basCount
	case LODMedium:
		return basCount / 2
	case LODLow:
		return basCount / 4
	case LODNone:
		return 0
	default:
		return basCount
	}
}

// --- Viewport Culling Optimization ---

// ViewportCullResult efficiently determines which agents are visible.
type ViewportCullResult struct {
	VisibleIDs   []string
	NearbyIDs    []string // Within LODMedium range (for reduced effects)
	FarIDs       []string // Within LODLow range
}

// CullAgentsForViewport returns agents categorized by distance from viewport center.
func CullAgentsForViewport(
	agents map[string]*domain.Agent,
	cameraX, cameraY float64,
	viewportW, viewportH float64,
) ViewportCullResult {
	result := ViewportCullResult{
		VisibleIDs: make([]string, 0, len(agents)/2),
		NearbyIDs:  make([]string, 0, len(agents)/4),
		FarIDs:     make([]string, 0, len(agents)/4),
	}

	halfW := viewportW/2 + ViewportMargin
	halfH := viewportH/2 + ViewportMargin
	mediumDist := LODDistanceThresholds[1]
	lowDist := LODDistanceThresholds[2]

	for id, agent := range agents {
		if !agent.Alive {
			continue
		}

		dx := agent.Position.X - cameraX
		dy := agent.Position.Y - cameraY

		// Viewport bounds check
		if dx > -halfW && dx < halfW && dy > -halfH && dy < halfH {
			result.VisibleIDs = append(result.VisibleIDs, id)
		} else {
			dist := dx*dx + dy*dy
			if dist < mediumDist*mediumDist {
				result.NearbyIDs = append(result.NearbyIDs, id)
			} else if dist < lowDist*lowDist {
				result.FarIDs = append(result.FarIDs, id)
			}
		}
	}

	return result
}
