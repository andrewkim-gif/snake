package meta

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// EventType defines the types of global/natural events.
type EventType string

const (
	EventEarthquake       EventType = "earthquake"
	EventPandemic         EventType = "pandemic"
	EventGoldRush         EventType = "gold_rush"
	EventTechBoom         EventType = "tech_boom"
	EventVolcanicEruption EventType = "volcanic_eruption"
	EventSolarFlare       EventType = "solar_flare"
)

// AllEventTypes lists every event type.
var AllEventTypes = []EventType{
	EventEarthquake, EventPandemic, EventGoldRush,
	EventTechBoom, EventVolcanicEruption, EventSolarFlare,
}

// EventScope defines whether an event affects a country, continent, or the whole world.
type EventScope string

const (
	ScopeCountry   EventScope = "country"
	ScopeContinent EventScope = "continent"
	ScopeGlobal    EventScope = "global"
)

// EventDef defines the static properties of an event type.
type EventDef struct {
	Type            EventType  `json:"type"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	Scope           EventScope `json:"scope"`
	DailyProbability float64   `json:"daily_probability"` // Per-country or per-continent or global
	Duration        time.Duration `json:"duration"`
	Effects         EventEffects  `json:"effects"`
}

// EventEffects describes the gameplay effects of an event.
type EventEffects struct {
	ResourceProductionMult float64 `json:"resource_production_mult,omitempty"` // e.g. 0.70 = -30%
	GoldProductionMult     float64 `json:"gold_production_mult,omitempty"`     // e.g. 5.0 = x5
	TechProductionMult     float64 `json:"tech_production_mult,omitempty"`     // e.g. 3.0 = x3
	AgentHPMult            float64 `json:"agent_hp_mult,omitempty"`            // e.g. 0.90 = -10%
	ArenaHazard            string  `json:"arena_hazard,omitempty"`             // e.g. "lava"
	LLMDisabled            bool    `json:"llm_disabled,omitempty"`             // solar flare
}

// DefaultEventDefs returns the definitions for all event types.
func DefaultEventDefs() []EventDef {
	return []EventDef{
		{
			Type:            EventEarthquake,
			Name:            "Earthquake",
			Description:     "Terrain shifts reduce resource production",
			Scope:           ScopeCountry,
			DailyProbability: 0.05,
			Duration:        24 * time.Hour,
			Effects: EventEffects{
				ResourceProductionMult: 0.70, // -30%
			},
		},
		{
			Type:            EventPandemic,
			Name:            "Pandemic",
			Description:     "Disease spreads across the continent, weakening agents",
			Scope:           ScopeContinent,
			DailyProbability: 0.02 / 7.0, // 2%/week → daily
			Duration:        48 * time.Hour,
			Effects: EventEffects{
				AgentHPMult: 0.90, // -10%
			},
		},
		{
			Type:            EventGoldRush,
			Name:            "Gold Rush",
			Description:     "Massive gold deposits discovered!",
			Scope:           ScopeCountry,
			DailyProbability: 0.03,
			Duration:        12 * time.Hour,
			Effects: EventEffects{
				GoldProductionMult: 5.0, // x5
			},
		},
		{
			Type:            EventTechBoom,
			Name:            "Tech Boom",
			Description:     "Innovation wave boosts technology output",
			Scope:           ScopeCountry,
			DailyProbability: 0.03,
			Duration:        24 * time.Hour,
			Effects: EventEffects{
				TechProductionMult: 3.0, // x3
			},
		},
		{
			Type:            EventVolcanicEruption,
			Name:            "Volcanic Eruption",
			Description:     "Lava zones appear in the arena, dealing damage",
			Scope:           ScopeCountry,
			DailyProbability: 0.01,
			Duration:        12 * time.Hour,
			Effects: EventEffects{
				ArenaHazard: "lava",
			},
		},
		{
			Type:            EventSolarFlare,
			Name:            "Solar Flare",
			Description:     "Global communication disruption — AI agents revert to basic mode",
			Scope:           ScopeGlobal,
			DailyProbability: 0.01 / 7.0, // 1%/week → daily
			Duration:        1 * time.Hour,
			Effects: EventEffects{
				LLMDisabled: true,
			},
		},
	}
}

// ActiveEvent represents an event that is currently in effect.
type ActiveEvent struct {
	ID              string      `json:"id"`
	Type            EventType   `json:"type"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	Scope           EventScope  `json:"scope"`
	TargetCountry   string      `json:"target_country,omitempty"`   // ISO3 (for country scope)
	TargetContinent string      `json:"target_continent,omitempty"` // (for continent scope)
	Effects         EventEffects `json:"effects"`
	StartedAt       time.Time   `json:"started_at"`
	ExpiresAt       time.Time   `json:"expires_at"`
}

// IsExpired returns true if the event has passed its expiration.
func (ae *ActiveEvent) IsExpired() bool {
	return time.Now().After(ae.ExpiresAt)
}

// EventEngineConfig holds configuration for the event engine.
type EventEngineConfig struct {
	CheckInterval time.Duration // How often to roll for new events (default: 1 hour)
	MaxActiveEvents int         // Max simultaneous events (default: 10)
}

// DefaultEventEngineConfig returns default event engine configuration.
func DefaultEventEngineConfig() EventEngineConfig {
	return EventEngineConfig{
		CheckInterval:   1 * time.Hour,
		MaxActiveEvents: 10,
	}
}

// EventCallback is called when a new event starts or expires.
type EventCallback func(event *ActiveEvent, started bool)

// EventEngine manages random global/natural events.
type EventEngine struct {
	mu sync.RWMutex

	config    EventEngineConfig
	eventDefs map[EventType]EventDef
	active    map[string]*ActiveEvent // eventID → active event
	history   []*ActiveEvent          // past events (limited to 100)

	// Country/continent lists (from world data)
	countries  []string // ISO3 codes
	continents []string

	// Callback for event notifications
	OnEvent EventCallback

	// Random source
	rng *rand.Rand

	// Lifecycle
	cancel context.CancelFunc
}

// NewEventEngine creates a new event engine.
func NewEventEngine(cfg EventEngineConfig) *EventEngine {
	defs := DefaultEventDefs()
	defMap := make(map[EventType]EventDef, len(defs))
	for _, d := range defs {
		defMap[d.Type] = d
	}

	return &EventEngine{
		config:    cfg,
		eventDefs: defMap,
		active:    make(map[string]*ActiveEvent),
		history:   make([]*ActiveEvent, 0, 100),
		continents: []string{
			"Asia", "Europe", "Africa", "North America",
			"South America", "Oceania",
		},
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// SetCountries sets the list of country ISO3 codes for event targeting.
func (ee *EventEngine) SetCountries(countries []string) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	ee.countries = countries
}

// Start begins the event engine background worker.
func (ee *EventEngine) Start(ctx context.Context) {
	workerCtx, cancel := context.WithCancel(ctx)
	ee.cancel = cancel

	go ee.eventLoop(workerCtx)
	slog.Info("event engine started", "checkInterval", ee.config.CheckInterval)
}

// Stop stops the event engine background worker.
func (ee *EventEngine) Stop() {
	if ee.cancel != nil {
		ee.cancel()
		ee.cancel = nil
	}
	slog.Info("event engine stopped")
}

// eventLoop periodically checks for new events and expires old ones.
func (ee *EventEngine) eventLoop(ctx context.Context) {
	ticker := time.NewTicker(ee.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ee.Tick()
		}
	}
}

// Tick processes one event cycle: expire old events, roll for new ones.
func (ee *EventEngine) Tick() {
	ee.expireEvents()
	ee.rollNewEvents()
}

// expireEvents removes events past their expiration.
func (ee *EventEngine) expireEvents() {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	for id, event := range ee.active {
		if event.IsExpired() {
			slog.Info("event expired",
				"type", event.Type,
				"target", event.TargetCountry,
			)
			if ee.OnEvent != nil {
				ee.OnEvent(event, false)
			}
			// Move to history
			ee.history = append(ee.history, event)
			if len(ee.history) > 100 {
				ee.history = ee.history[len(ee.history)-100:]
			}
			delete(ee.active, id)
		}
	}
}

// rollNewEvents randomly generates new events based on probabilities.
func (ee *EventEngine) rollNewEvents() {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	if len(ee.active) >= ee.config.MaxActiveEvents {
		return
	}

	// Compute how many intervals per day (to scale probability correctly)
	intervalsPerDay := 24.0 * float64(time.Hour) / float64(ee.config.CheckInterval)

	for _, def := range ee.eventDefs {
		// Scale daily probability to per-tick probability
		tickProb := def.DailyProbability / intervalsPerDay

		switch def.Scope {
		case ScopeCountry:
			// Roll for each country
			for _, iso := range ee.countries {
				if ee.rng.Float64() < tickProb {
					// Check if already an active event of this type on this country
					if ee.hasActiveEventOn(def.Type, iso) {
						continue
					}
					ee.createEvent(def, iso, "")
					if len(ee.active) >= ee.config.MaxActiveEvents {
						return
					}
				}
			}

		case ScopeContinent:
			for _, continent := range ee.continents {
				if ee.rng.Float64() < tickProb {
					if ee.hasActiveEventOnContinent(def.Type, continent) {
						continue
					}
					ee.createEvent(def, "", continent)
					if len(ee.active) >= ee.config.MaxActiveEvents {
						return
					}
				}
			}

		case ScopeGlobal:
			if ee.rng.Float64() < tickProb {
				if ee.hasActiveGlobalEvent(def.Type) {
					continue
				}
				ee.createEvent(def, "", "")
			}
		}
	}
}

// hasActiveEventOn checks if there's already an active event of this type on a country.
func (ee *EventEngine) hasActiveEventOn(etype EventType, iso string) bool {
	for _, e := range ee.active {
		if e.Type == etype && e.TargetCountry == iso {
			return true
		}
	}
	return false
}

// hasActiveEventOnContinent checks continent-scope duplicate.
func (ee *EventEngine) hasActiveEventOnContinent(etype EventType, continent string) bool {
	for _, e := range ee.active {
		if e.Type == etype && e.TargetContinent == continent {
			return true
		}
	}
	return false
}

// hasActiveGlobalEvent checks global-scope duplicate.
func (ee *EventEngine) hasActiveGlobalEvent(etype EventType) bool {
	for _, e := range ee.active {
		if e.Type == etype && e.Scope == ScopeGlobal {
			return true
		}
	}
	return false
}

// createEvent creates and registers a new active event.
// Must be called with write lock held.
func (ee *EventEngine) createEvent(def EventDef, countryISO, continent string) {
	event := &ActiveEvent{
		ID:              uuid.New().String(),
		Type:            def.Type,
		Name:            def.Name,
		Description:     def.Description,
		Scope:           def.Scope,
		TargetCountry:   countryISO,
		TargetContinent: continent,
		Effects:         def.Effects,
		StartedAt:       time.Now(),
		ExpiresAt:       time.Now().Add(def.Duration),
	}

	ee.active[event.ID] = event

	slog.Info("new event started",
		"type", def.Type,
		"scope", def.Scope,
		"country", countryISO,
		"continent", continent,
		"expiresAt", event.ExpiresAt,
	)

	if ee.OnEvent != nil {
		ee.OnEvent(event, true)
	}
}

// --- Queries ---

// GetActiveEvents returns all currently active events.
func (ee *EventEngine) GetActiveEvents() []*ActiveEvent {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	result := make([]*ActiveEvent, 0, len(ee.active))
	for _, e := range ee.active {
		result = append(result, e)
	}
	return result
}

// GetActiveEventsForCountry returns active events affecting a specific country.
func (ee *EventEngine) GetActiveEventsForCountry(iso string) []*ActiveEvent {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	var result []*ActiveEvent
	for _, e := range ee.active {
		if e.TargetCountry == iso || e.Scope == ScopeGlobal {
			result = append(result, e)
		}
	}
	return result
}

// GetActiveEventsForContinent returns active events affecting a continent.
func (ee *EventEngine) GetActiveEventsForContinent(continent string) []*ActiveEvent {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	var result []*ActiveEvent
	for _, e := range ee.active {
		if e.TargetContinent == continent || e.Scope == ScopeGlobal {
			result = append(result, e)
		}
	}
	return result
}

// GetResourceMultiplier returns the combined resource production multiplier
// from all active events affecting a country.
// Returns 1.0 if no events affect production.
func (ee *EventEngine) GetResourceMultiplier(countryISO, continent string) float64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	mult := 1.0
	for _, e := range ee.active {
		affects := false
		if e.TargetCountry == countryISO {
			affects = true
		}
		if e.TargetContinent == continent {
			affects = true
		}
		if e.Scope == ScopeGlobal {
			affects = true
		}

		if affects && e.Effects.ResourceProductionMult != 0 {
			mult *= e.Effects.ResourceProductionMult
		}
	}
	return mult
}

// GetGoldMultiplier returns the combined gold production multiplier.
func (ee *EventEngine) GetGoldMultiplier(countryISO string) float64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	mult := 1.0
	for _, e := range ee.active {
		if (e.TargetCountry == countryISO || e.Scope == ScopeGlobal) && e.Effects.GoldProductionMult != 0 {
			mult *= e.Effects.GoldProductionMult
		}
	}
	return mult
}

// GetTechMultiplier returns the combined tech production multiplier.
func (ee *EventEngine) GetTechMultiplier(countryISO string) float64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	mult := 1.0
	for _, e := range ee.active {
		if (e.TargetCountry == countryISO || e.Scope == ScopeGlobal) && e.Effects.TechProductionMult != 0 {
			mult *= e.Effects.TechProductionMult
		}
	}
	return mult
}

// IsLLMDisabled returns true if a solar flare event is active (global).
func (ee *EventEngine) IsLLMDisabled() bool {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	for _, e := range ee.active {
		if e.Scope == ScopeGlobal && e.Effects.LLMDisabled {
			return true
		}
	}
	return false
}

// HasArenaHazard returns the active hazard type for a country, or empty string.
func (ee *EventEngine) HasArenaHazard(countryISO string) string {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	for _, e := range ee.active {
		if e.TargetCountry == countryISO && e.Effects.ArenaHazard != "" {
			return e.Effects.ArenaHazard
		}
	}
	return ""
}

// GetEventHistory returns the most recent historical events.
func (ee *EventEngine) GetEventHistory(limit int) []*ActiveEvent {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	if limit <= 0 || limit > len(ee.history) {
		limit = len(ee.history)
	}

	// Return most recent first
	result := make([]*ActiveEvent, limit)
	for i := 0; i < limit; i++ {
		result[i] = ee.history[len(ee.history)-1-i]
	}
	return result
}

// TriggerEvent manually triggers an event (for admin/testing).
func (ee *EventEngine) TriggerEvent(eventType EventType, countryISO, continent string) (*ActiveEvent, error) {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	def, ok := ee.eventDefs[eventType]
	if !ok {
		return nil, fmt.Errorf("unknown event type: %s", eventType)
	}

	ee.createEvent(def, countryISO, continent)

	// Return the most recently created event
	var latest *ActiveEvent
	for _, e := range ee.active {
		if e.Type == eventType {
			if latest == nil || e.StartedAt.After(latest.StartedAt) {
				latest = e
			}
		}
	}
	return latest, nil
}

// --- HTTP API ---

// EventRoutes returns a chi.Router with event endpoints.
func (ee *EventEngine) EventRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/active", ee.handleGetActive)
	r.Get("/country/{countryISO}", ee.handleGetCountryEvents)
	r.Get("/history", ee.handleGetHistory)

	return r
}

func (ee *EventEngine) handleGetActive(w http.ResponseWriter, r *http.Request) {
	events := ee.GetActiveEvents()
	if events == nil {
		events = []*ActiveEvent{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"events": events,
		"count":  len(events),
	})
}

func (ee *EventEngine) handleGetCountryEvents(w http.ResponseWriter, r *http.Request) {
	countryISO := chi.URLParam(r, "countryISO")
	events := ee.GetActiveEventsForCountry(countryISO)
	if events == nil {
		events = []*ActiveEvent{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"country_iso": countryISO,
		"events":      events,
		"count":       len(events),
		"resource_mult": ee.GetResourceMultiplier(countryISO, ""),
		"gold_mult":     ee.GetGoldMultiplier(countryISO),
		"tech_mult":     ee.GetTechMultiplier(countryISO),
		"arena_hazard":  ee.HasArenaHazard(countryISO),
	})
}

func (ee *EventEngine) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	history := ee.GetEventHistory(50)
	if history == nil {
		history = []*ActiveEvent{}
	}
	// Suppress unused import for json
	_ = json.Marshal
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"history": history,
		"count":   len(history),
	})
}
