package game

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log/slog"
	"sync"
)

// ============================================================
// v33 Phase 1 — MonsterSeedSync: Deterministic RNG seed
// generation and distribution for synchronized PvE monster
// spawning across all clients in a Matrix arena.
//
// All clients use the same seed to spawn identical monsters
// at identical positions — the server only distributes seeds,
// not individual spawn commands (minimal bandwidth).
// ============================================================

// Seed sync constants
const (
	// SeedResyncIntervalTicks is how often to generate a new wave seed (30s @ 20Hz).
	SeedResyncIntervalTicks = 30 * TickRate // 600 ticks

	// MaxWaveID is the maximum wave ID before wrapping.
	MaxWaveID = 999999
)

// SpawnSeedEvent represents a seed distribution event for clients.
type SpawnSeedEvent struct {
	Seed    string `json:"seed"`    // hex-encoded seed
	WaveID  int    `json:"waveId"`  // monotonically increasing wave identifier
	Tick    uint64 `json:"tick"`    // server tick at generation time
	EpochID int    `json:"epochId"` // current epoch number
}

// MonsterSeedSync manages deterministic RNG seed generation and distribution
// for synchronized monster spawning across all clients in an arena.
type MonsterSeedSync struct {
	mu sync.RWMutex

	countryCode  string
	currentSeed  uint64
	seedHex      string // pre-computed hex string of currentSeed
	waveID       int
	epochID      int
	lastSeedTick uint64

	// Event buffer for pending seed distributions
	pendingEvent *SpawnSeedEvent
}

// NewMonsterSeedSync creates a new seed sync for a country arena.
func NewMonsterSeedSync(countryCode string) *MonsterSeedSync {
	return &MonsterSeedSync{
		countryCode: countryCode,
		waveID:      0,
		epochID:     0,
	}
}

// GenerateSeed creates a new deterministic seed based on epoch and arena context.
// Called at epoch start and every 30 seconds thereafter.
func (mss *MonsterSeedSync) GenerateSeed(epochID int, tick uint64) SpawnSeedEvent {
	mss.mu.Lock()
	defer mss.mu.Unlock()

	mss.epochID = epochID
	mss.waveID++
	if mss.waveID > MaxWaveID {
		mss.waveID = 1
	}

	// Deterministic seed: hash(epochID + countryCode + waveID + tick)
	input := fmt.Sprintf("%d:%s:%d:%d", epochID, mss.countryCode, mss.waveID, tick)
	hash := sha256.Sum256([]byte(input))
	mss.currentSeed = binary.BigEndian.Uint64(hash[:8])
	mss.seedHex = fmt.Sprintf("%016x", mss.currentSeed)
	mss.lastSeedTick = tick

	event := SpawnSeedEvent{
		Seed:    mss.seedHex,
		WaveID:  mss.waveID,
		Tick:    tick,
		EpochID: epochID,
	}

	mss.pendingEvent = &event

	slog.Debug("monster seed generated",
		"country", mss.countryCode,
		"epoch", epochID,
		"wave", mss.waveID,
		"seed", mss.seedHex,
	)

	return event
}

// NextWave advances to the next wave with a new seed.
// This is a convenience wrapper around GenerateSeed.
func (mss *MonsterSeedSync) NextWave(tick uint64) SpawnSeedEvent {
	mss.mu.RLock()
	epochID := mss.epochID
	mss.mu.RUnlock()

	return mss.GenerateSeed(epochID, tick)
}

// ShouldReseed returns true if enough time has passed since the last seed (30s).
func (mss *MonsterSeedSync) ShouldReseed(currentTick uint64) bool {
	mss.mu.RLock()
	defer mss.mu.RUnlock()

	if mss.lastSeedTick == 0 {
		return true // never seeded
	}
	return currentTick-mss.lastSeedTick >= SeedResyncIntervalTicks
}

// GetCurrentSeed returns the current seed as a hex string.
func (mss *MonsterSeedSync) GetCurrentSeed() string {
	mss.mu.RLock()
	defer mss.mu.RUnlock()
	return mss.seedHex
}

// GetCurrentSeedRaw returns the current seed as a uint64.
func (mss *MonsterSeedSync) GetCurrentSeedRaw() uint64 {
	mss.mu.RLock()
	defer mss.mu.RUnlock()
	return mss.currentSeed
}

// GetWaveID returns the current wave ID.
func (mss *MonsterSeedSync) GetWaveID() int {
	mss.mu.RLock()
	defer mss.mu.RUnlock()
	return mss.waveID
}

// GetEpochID returns the epoch ID associated with the current seed.
func (mss *MonsterSeedSync) GetEpochID() int {
	mss.mu.RLock()
	defer mss.mu.RUnlock()
	return mss.epochID
}

// ConsumePendingEvent returns and clears the pending seed event (if any).
// Used by the engine's Tick to check if a new seed needs broadcasting.
func (mss *MonsterSeedSync) ConsumePendingEvent() *SpawnSeedEvent {
	mss.mu.Lock()
	defer mss.mu.Unlock()

	event := mss.pendingEvent
	mss.pendingEvent = nil
	return event
}

// OnEpochStart resets the wave counter and generates the first seed for a new epoch.
func (mss *MonsterSeedSync) OnEpochStart(epochID int, tick uint64) SpawnSeedEvent {
	mss.mu.Lock()
	mss.waveID = 0 // reset wave counter for new epoch
	mss.mu.Unlock()

	return mss.GenerateSeed(epochID, tick)
}

// Reset clears all seed state.
func (mss *MonsterSeedSync) Reset() {
	mss.mu.Lock()
	defer mss.mu.Unlock()

	mss.currentSeed = 0
	mss.seedHex = ""
	mss.waveID = 0
	mss.epochID = 0
	mss.lastSeedTick = 0
	mss.pendingEvent = nil
}
