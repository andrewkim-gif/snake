package city

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// CityManager orchestrates 195 CitySimEngine instances.
type CityManager struct {
	mu      sync.RWMutex
	engines map[string]*CitySimEngine // iso3 → engine

	// Tick management
	activeEngines   []*CitySimEngine // player-managed (10s tick)
	inactiveEngines []*CitySimEngine // AI-only (60s tick)

	// External references
	worldMgr   WorldSyncer
	econEngine EconomySyncer
	warMgr     WarEventReceiver

	// Lifecycle
	cancel context.CancelFunc
}

// NewCityManager creates a new city manager.
func NewCityManager() *CityManager {
	return &CityManager{
		engines: make(map[string]*CitySimEngine),
	}
}

// SetExternalRefs sets external engine references for the manager.
func (m *CityManager) SetExternalRefs(world WorldSyncer, econ EconomySyncer, war WarEventReceiver) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.worldMgr = world
	m.econEngine = econ
	m.warMgr = war
}

// InitializeCountry creates a CitySimEngine for a country.
func (m *CityManager) InitializeCountry(iso3, tier string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	engine := NewCitySimEngine(iso3, tier)
	engine.SetExternalRefs(m.worldMgr, m.econEngine, m.warMgr)
	m.engines[iso3] = engine
	m.inactiveEngines = append(m.inactiveEngines, engine)
}

// GetEngine returns the engine for a country.
func (m *CityManager) GetEngine(iso3 string) *CitySimEngine {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.engines[iso3]
}

// GetAllEngines returns a snapshot of all engines.
func (m *CityManager) GetAllEngines() map[string]*CitySimEngine {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]*CitySimEngine, len(m.engines))
	for k, v := range m.engines {
		result[k] = v
	}
	return result
}

// ActivateCity moves a city to the active tick list (player management).
func (m *CityManager) ActivateCity(iso3, clientID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	engine, ok := m.engines[iso3]
	if !ok {
		return nil
	}

	engine.SetMode(ModePlayerManaged, clientID)

	// Move from inactive to active
	m.removeFromInactive(iso3)
	m.activeEngines = append(m.activeEngines, engine)

	slog.Info("city activated",
		"iso3", iso3,
		"clientId", clientID,
		"activeCount", len(m.activeEngines),
	)

	return nil
}

// SpectateCity marks a city as spectated and moves it to the active tick list.
// Returns true if spectation was set up (city exists and is in AI mode).
func (m *CityManager) SpectateCity(iso3, clientID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	engine, ok := m.engines[iso3]
	if !ok {
		return false
	}

	// Only allow spectating AI-managed cities (not player-managed ones)
	engine.mu.RLock()
	currentMode := engine.mode
	engine.mu.RUnlock()

	if currentMode == ModePlayerManaged {
		// Already player-managed; spectating is handled by the client
		return true
	}

	engine.SetMode(ModeSpectated, clientID)

	// Move to active list for full ticks while being spectated
	m.removeFromInactive(iso3)
	m.activeEngines = append(m.activeEngines, engine)

	slog.Info("city spectated",
		"iso3", iso3,
		"clientId", clientID,
		"activeCount", len(m.activeEngines),
	)

	return true
}

// DeactivateCity moves a city back to the inactive tick list.
func (m *CityManager) DeactivateCity(iso3 string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	engine, ok := m.engines[iso3]
	if !ok {
		return
	}

	engine.SetMode(ModeAI, "")

	// Move from active to inactive
	m.removeFromActive(iso3)
	m.inactiveEngines = append(m.inactiveEngines, engine)

	slog.Info("city deactivated",
		"iso3", iso3,
		"inactiveCount", len(m.inactiveEngines),
	)
}

// HandleCommand routes a player command to the correct engine.
func (m *CityManager) HandleCommand(iso3 string, cmd CityCommand) error {
	engine := m.GetEngine(iso3)
	if engine == nil {
		return nil
	}
	return engine.HandleCommand(cmd)
}

// GetCityState returns the serializable state for a country.
func (m *CityManager) GetCityState(iso3 string) *CityState {
	engine := m.GetEngine(iso3)
	if engine == nil {
		return nil
	}
	state := engine.GetCityState()
	return &state
}

// GetActiveISO3s returns the list of actively managed country codes.
func (m *CityManager) GetActiveISO3s() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]string, 0, len(m.activeEngines))
	for _, e := range m.activeEngines {
		result = append(result, e.GetISO3())
	}
	return result
}

// CountryCount returns the total number of initialized countries.
func (m *CityManager) CountryCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.engines)
}

// Start begins the tick loops for active and inactive cities.
func (m *CityManager) Start(ctx context.Context) {
	workerCtx, cancel := context.WithCancel(ctx)
	m.cancel = cancel

	go m.runTickLoop(workerCtx)
	slog.Info("city manager started", "countries", len(m.engines))
}

// Stop stops the tick loops.
func (m *CityManager) Stop() {
	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}
	slog.Info("city manager stopped")
}

// runTickLoop runs the 2-tier tick scheduler.
func (m *CityManager) runTickLoop(ctx context.Context) {
	ticker10s := time.NewTicker(10 * time.Second)
	ticker60s := time.NewTicker(60 * time.Second)
	defer ticker10s.Stop()
	defer ticker60s.Stop()

	for {
		select {
		case <-ticker10s.C:
			m.tickActive()
		case <-ticker60s.C:
			m.tickInactive()
		case <-ctx.Done():
			return
		}
	}
}

// tickActive runs full ticks on all active (player-managed) cities.
func (m *CityManager) tickActive() {
	m.mu.RLock()
	engines := make([]*CitySimEngine, len(m.activeEngines))
	copy(engines, m.activeEngines)
	m.mu.RUnlock()

	if len(engines) == 0 {
		return
	}

	var wg sync.WaitGroup
	for _, engine := range engines {
		wg.Add(1)
		go func(e *CitySimEngine) {
			defer wg.Done()
			e.FullTick()
		}(engine)
	}
	wg.Wait()

	slog.Debug("active cities ticked", "count", len(engines))
}

// tickInactive runs lightweight ticks on all inactive (AI) cities.
func (m *CityManager) tickInactive() {
	m.mu.RLock()
	engines := make([]*CitySimEngine, len(m.inactiveEngines))
	copy(engines, m.inactiveEngines)
	m.mu.RUnlock()

	if len(engines) == 0 {
		return
	}

	var wg sync.WaitGroup
	for _, engine := range engines {
		wg.Add(1)
		go func(e *CitySimEngine) {
			defer wg.Done()
			e.LightTick()
		}(engine)
	}
	wg.Wait()

	slog.Debug("inactive cities ticked", "count", len(engines))
}

// removeFromActive removes a city from the active list by iso3.
// Must be called with write lock held.
func (m *CityManager) removeFromActive(iso3 string) {
	for i, e := range m.activeEngines {
		if e.GetISO3() == iso3 {
			m.activeEngines = append(m.activeEngines[:i], m.activeEngines[i+1:]...)
			return
		}
	}
}

// GlobeSummary contains aggregated city data for the Globe view.
type GlobeSummary struct {
	GDP        float64 `json:"gdp"`
	Population int     `json:"population"`
	Happiness  float64 `json:"happiness"`
	Military   float64 `json:"military"`
	Treasury   float64 `json:"treasury"`
	AtWar      bool    `json:"atWar"`
	Mode       ControlMode `json:"mode"`
}

// GetSummaryForGlobe returns a lightweight summary of a city's stats for Globe rendering.
func (m *CityManager) GetSummaryForGlobe(iso3 string) *GlobeSummary {
	engine := m.GetEngine(iso3)
	if engine == nil {
		return nil
	}

	engine.mu.RLock()
	defer engine.mu.RUnlock()

	atWar := false
	if engine.warMgr != nil {
		atWar = engine.warMgr.IsAtWar(iso3)
	}

	return &GlobeSummary{
		GDP:        engine.gdp,
		Population: engine.citizenCount,
		Happiness:  engine.happiness,
		Military:   engine.militaryPower,
		Treasury:   engine.treasury,
		AtWar:      atWar,
		Mode:       engine.mode,
	}
}

// GetAllGlobeSummaries returns summaries for all initialized countries.
func (m *CityManager) GetAllGlobeSummaries() map[string]*GlobeSummary {
	m.mu.RLock()
	engines := make(map[string]*CitySimEngine, len(m.engines))
	for k, v := range m.engines {
		engines[k] = v
	}
	m.mu.RUnlock()

	result := make(map[string]*GlobeSummary, len(engines))
	for iso3, engine := range engines {
		engine.mu.RLock()
		atWar := false
		if engine.warMgr != nil {
			atWar = engine.warMgr.IsAtWar(iso3)
		}
		result[iso3] = &GlobeSummary{
			GDP:        engine.gdp,
			Population: engine.citizenCount,
			Happiness:  engine.happiness,
			Military:   engine.militaryPower,
			Treasury:   engine.treasury,
			AtWar:      atWar,
			Mode:       engine.mode,
		}
		engine.mu.RUnlock()
	}
	return result
}

// removeFromInactive removes a city from the inactive list by iso3.
// Must be called with write lock held.
func (m *CityManager) removeFromInactive(iso3 string) {
	for i, e := range m.inactiveEngines {
		if e.GetISO3() == iso3 {
			m.inactiveEngines = append(m.inactiveEngines[:i], m.inactiveEngines[i+1:]...)
			return
		}
	}
}
