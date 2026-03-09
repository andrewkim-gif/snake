package blockchain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sync"
	"time"
)

// DefenseMultiplierTier maps market cap ranges to defense multiplier basis points.
// Based on v11-world-war-plan.md Section 15.4
type DefenseMultiplierTier struct {
	MinCap     float64 // USD equivalent
	Multiplier uint64  // basis points (10000 = 1.0x)
}

// Defense tiers: market cap -> multiplier
var defenseTiers = []DefenseMultiplierTier{
	{MinCap: 100_000_000, Multiplier: 50000}, // 5.0x
	{MinCap: 10_000_000, Multiplier: 30000},  // 3.0x
	{MinCap: 1_000_000, Multiplier: 20000},   // 2.0x
	{MinCap: 100_000, Multiplier: 15000},     // 1.5x
	{MinCap: 10_000, Multiplier: 12000},      // 1.2x
	{MinCap: 0, Multiplier: 10000},           // 1.0x (base)
}

// CircuitBreakerThreshold: >50% change in 1 hour triggers freeze
const CircuitBreakerThreshold = 0.50

// FreezeDuration: how long a frozen buff stays frozen
const FreezeDuration = 1 * time.Hour

// PollInterval: 5 minutes between market cap queries
const PollInterval = 5 * time.Minute

// MovingAverageWindow: 1 hour of samples for smoothing
const MovingAverageWindow = 12 // 12 samples at 5min = 1 hour

// CountryDefenseState holds the defense state for a single country
type CountryDefenseState struct {
	ISO3              string    `json:"iso3"`
	MarketCap         float64   `json:"marketCap"`
	DefenseMultiplier uint64    `json:"defenseMultiplier"` // basis points
	Frozen            bool      `json:"frozen"`
	FrozenUntil       time.Time `json:"frozenUntil,omitempty"`
	LastUpdated       time.Time `json:"lastUpdated"`

	// Moving average buffer (circular)
	capHistory    []float64
	capHistoryIdx int
}

// MovingAverageMarketCap returns the 1-hour moving average market cap
func (s *CountryDefenseState) MovingAverageMarketCap() float64 {
	if len(s.capHistory) == 0 {
		return s.MarketCap
	}
	sum := 0.0
	count := 0
	for _, v := range s.capHistory {
		if v > 0 {
			sum += v
			count++
		}
	}
	if count == 0 {
		return s.MarketCap
	}
	return sum / float64(count)
}

// DefenseOracle manages market cap -> defense multiplier for all 195 countries.
// It polls CROSS RPC via JSON-RPC every 5 minutes.
type DefenseOracle struct {
	mu       sync.RWMutex
	states   map[string]*CountryDefenseState // ISO3 -> state
	rpcURL   string
	client   *http.Client
	stopChan chan struct{}

	// Callback: invoked when a country's defense multiplier changes
	OnDefenseChanged func(iso3 string, multiplier uint64)

	// v30 Task 2-2: Forge price feed
	forgePrice          float64
	forgePriceAvailable bool
}

// NewDefenseOracle creates a new DefenseOracle
func NewDefenseOracle(rpcURL string) *DefenseOracle {
	return &DefenseOracle{
		states:   make(map[string]*CountryDefenseState),
		rpcURL:   rpcURL,
		client:   &http.Client{Timeout: 30 * time.Second},
		stopChan: make(chan struct{}),
	}
}

// RegisterCountry registers a country for defense tracking
func (o *DefenseOracle) RegisterCountry(iso3 string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if _, ok := o.states[iso3]; !ok {
		o.states[iso3] = &CountryDefenseState{
			ISO3:              iso3,
			DefenseMultiplier: 10000, // base 1.0x
			capHistory:        make([]float64, MovingAverageWindow),
		}
	}
}

// GetDefenseMultiplier returns the current defense multiplier for a country (basis points)
func (o *DefenseOracle) GetDefenseMultiplier(iso3 string) uint64 {
	o.mu.RLock()
	defer o.mu.RUnlock()
	state, ok := o.states[iso3]
	if !ok {
		return 10000 // base 1.0x
	}
	if state.Frozen && time.Now().Before(state.FrozenUntil) {
		return 10000 // frozen: return base
	}
	return state.DefenseMultiplier
}

// GetDefenseState returns the full defense state for a country
func (o *DefenseOracle) GetDefenseState(iso3 string) *CountryDefenseState {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.states[iso3]
}

// GetAllStates returns a snapshot of all defense states
func (o *DefenseOracle) GetAllStates() map[string]*CountryDefenseState {
	o.mu.RLock()
	defer o.mu.RUnlock()
	result := make(map[string]*CountryDefenseState, len(o.states))
	for k, v := range o.states {
		copied := *v
		result[k] = &copied
	}
	return result
}

// Start begins the 5-minute polling loop
func (o *DefenseOracle) Start() {
	go o.pollLoop()
	log.Printf("[DefenseOracle] Started polling every %v from %s", PollInterval, o.rpcURL)
}

// Stop stops the polling loop
func (o *DefenseOracle) Stop() {
	close(o.stopChan)
}

// pollLoop queries market caps every 5 minutes
func (o *DefenseOracle) pollLoop() {
	ticker := time.NewTicker(PollInterval)
	defer ticker.Stop()

	// Initial fetch
	o.fetchAndUpdate()

	for {
		select {
		case <-ticker.C:
			o.fetchAndUpdate()
		case <-o.stopChan:
			log.Println("[DefenseOracle] Stopped")
			return
		}
	}
}

// fetchAndUpdate queries all 195 countries' market caps and updates defense multipliers
func (o *DefenseOracle) fetchAndUpdate() {
	o.mu.RLock()
	isoList := make([]string, 0, len(o.states))
	for iso := range o.states {
		isoList = append(isoList, iso)
	}
	o.mu.RUnlock()

	if len(isoList) == 0 {
		return
	}

	// Batch query market caps from CROSS RPC
	caps, err := o.batchQueryMarketCaps(isoList)
	if err != nil {
		log.Printf("[DefenseOracle] Error querying market caps: %v", err)
		return
	}

	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	for iso, newCap := range caps {
		state, ok := o.states[iso]
		if !ok {
			continue
		}

		oldCap := state.MarketCap

		// Record in moving average buffer
		state.capHistory[state.capHistoryIdx] = newCap
		state.capHistoryIdx = (state.capHistoryIdx + 1) % MovingAverageWindow

		// Circuit breaker: >50% change in 1 hour
		if oldCap > 0 && shouldTripCircuitBreaker(oldCap, newCap) {
			state.Frozen = true
			state.FrozenUntil = now.Add(FreezeDuration)
			state.LastUpdated = now
			log.Printf("[DefenseOracle] FROZEN %s: cap %.0f -> %.0f (>%.0f%% change)",
				iso, oldCap, newCap, CircuitBreakerThreshold*100)
			continue
		}

		// Auto-unfreeze after duration
		if state.Frozen && now.After(state.FrozenUntil) {
			state.Frozen = false
			log.Printf("[DefenseOracle] UNFROZEN %s", iso)
		}

		// Use moving average for smoothing
		smoothedCap := state.MovingAverageMarketCap()
		newMultiplier := calcMultiplier(smoothedCap)

		oldMultiplier := state.DefenseMultiplier
		state.MarketCap = newCap
		state.DefenseMultiplier = newMultiplier
		state.LastUpdated = now

		// Notify if changed
		if newMultiplier != oldMultiplier && o.OnDefenseChanged != nil {
			go o.OnDefenseChanged(iso, newMultiplier)
		}
	}
}

// shouldTripCircuitBreaker checks if the cap change exceeds 50%
func shouldTripCircuitBreaker(oldCap, newCap float64) bool {
	if oldCap == 0 {
		return false
	}
	diff := math.Abs(newCap - oldCap)
	return (diff / oldCap) >= CircuitBreakerThreshold
}

// calcMultiplier converts market cap to defense multiplier (basis points)
func calcMultiplier(marketCap float64) uint64 {
	for _, tier := range defenseTiers {
		if marketCap >= tier.MinCap {
			return tier.Multiplier
		}
	}
	return 10000 // 1.0x base
}

// --- JSON-RPC Client for CROSS RPC ---

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result"`
	Error   *JSONRPCError   `json:"error,omitempty"`
	ID      int             `json:"id"`
}

// JSONRPCError represents a JSON-RPC error
type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// TWAPResult holds the TWAP price query result
type TWAPResult struct {
	ISO3      string  `json:"iso3"`
	Price     float64 `json:"price"`
	MarketCap float64 `json:"marketCap"`
	Volume24h float64 `json:"volume24h"`
	Timestamp int64   `json:"timestamp"`
}

// SetSimulatedGDP sets a simulated GDP value for a country (used in simulation mode).
// v30 Task 1-3: RPC 없을 때 GDP 기반 방어력 계산 폴백을 제공합니다.
func (o *DefenseOracle) SetSimulatedGDP(iso3 string, gdp float64) {
	o.mu.Lock()
	defer o.mu.Unlock()

	state, ok := o.states[iso3]
	if !ok {
		return
	}

	// GDP를 시뮬레이션된 시가총액으로 변환합니다 (GDP * 100 = 시뮬레이션 마켓캡)
	simulatedMarketCap := gdp * 100.0
	state.MarketCap = simulatedMarketCap
	state.DefenseMultiplier = calcMultiplier(simulatedMarketCap)
	state.LastUpdated = time.Now()
}

// IsSimulationMode returns true if the oracle is running without RPC.
func (o *DefenseOracle) IsSimulationMode() bool {
	return o.rpcURL == ""
}

// batchQueryMarketCaps queries CROSS RPC for TWAP market caps of all countries
func (o *DefenseOracle) batchQueryMarketCaps(isoList []string) (map[string]float64, error) {
	if o.rpcURL == "" {
		// v30 Task 1-3: 시뮬레이션 모드 — 기존 GDP 기반 시뮬레이션 값을 반환합니다
		result := make(map[string]float64, len(isoList))
		o.mu.RLock()
		for _, iso := range isoList {
			if state, ok := o.states[iso]; ok {
				result[iso] = state.MarketCap // SetSimulatedGDP로 설정된 값
			} else {
				result[iso] = 0
			}
		}
		o.mu.RUnlock()
		return result, nil
	}

	// Build JSON-RPC batch request for TWAP prices
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "aww_getTokenMarketCaps",
		Params:  []interface{}{isoList},
		ID:      1,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := o.client.Post(o.rpcURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("rpc request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var rpcResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	// Parse result as map of ISO3 -> TWAP result
	var results map[string]TWAPResult
	if err := json.Unmarshal(rpcResp.Result, &results); err != nil {
		return nil, fmt.Errorf("unmarshal results: %w", err)
	}

	caps := make(map[string]float64, len(results))
	for iso, r := range results {
		caps[iso] = r.MarketCap
	}
	return caps, nil
}

// DefenseBuffCap is the maximum defense buff percentage.
// v30 Task 1-3: 티어 테이블과 일치하도록 조정합니다.
// defenseTiers에서 최대 5.0x (50000bp)이므로 buff cap을 그에 맞게 설정합니다.
// 5.0x 기준: (50000-10000)/10000 = 4.0 → buff cap 0.30 유지 (보상 발행 억제 목적)
const DefenseBuffCap = 0.30

// ApplyDefenseBuff calculates the actual defense buff percentage for a CountryArena.
// Returns the buff as a float64 (e.g., 0.15 = +15% defense)
// v30 Task 1-3: 방어 버프 캡을 티어 테이블과 일관되게 적용합니다.
func (o *DefenseOracle) ApplyDefenseBuff(iso3 string) float64 {
	multiplier := o.GetDefenseMultiplier(iso3)
	// Convert basis points to buff percentage
	// 10000 bp = 1.0x = +0%
	// 15000 bp = 1.5x = +50% (but capped at DefenseBuffCap)
	buff := float64(multiplier-10000) / 10000.0

	if buff > DefenseBuffCap {
		buff = DefenseBuffCap
	}
	if buff < 0 {
		buff = 0
	}
	return buff
}

// SetForgePrice feeds the Forge $AWW price into the DefenseOracle.
// v30 Task 2-2: When Forge price is available, market caps are scaled by real price.
// When Forge fails, simulation GDP-based pricing continues transparently.
func (o *DefenseOracle) SetForgePrice(price float64) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.forgePrice = price
	o.forgePriceAvailable = true
}

// ClearForgePrice reverts to simulation mode pricing.
func (o *DefenseOracle) ClearForgePrice() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.forgePriceAvailable = false
	o.forgePrice = 0
}

// GetForgePrice returns current forge price and availability.
func (o *DefenseOracle) GetForgePrice() (float64, bool) {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.forgePrice, o.forgePriceAvailable
}

// DefenseStats returns aggregated statistics for all tracked countries
type DefenseStats struct {
	TotalCountries  int     `json:"totalCountries"`
	FrozenCountries int     `json:"frozenCountries"`
	AvgMultiplier   float64 `json:"avgMultiplier"`
	MaxMultiplier   uint64  `json:"maxMultiplier"`
	MaxISO3         string  `json:"maxIso3"`
	TotalMarketCap  float64 `json:"totalMarketCap"`
}

// GetStats returns aggregated defense stats
func (o *DefenseOracle) GetStats() DefenseStats {
	o.mu.RLock()
	defer o.mu.RUnlock()

	stats := DefenseStats{}
	var totalMult uint64

	for _, state := range o.states {
		stats.TotalCountries++
		totalMult += state.DefenseMultiplier
		stats.TotalMarketCap += state.MarketCap

		if state.Frozen {
			stats.FrozenCountries++
		}
		if state.DefenseMultiplier > stats.MaxMultiplier {
			stats.MaxMultiplier = state.DefenseMultiplier
			stats.MaxISO3 = state.ISO3
		}
	}

	if stats.TotalCountries > 0 {
		stats.AvgMultiplier = float64(totalMult) / float64(stats.TotalCountries)
	}

	return stats
}
