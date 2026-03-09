package blockchain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// BuybackTaxRate: 5% of GDP tax revenue goes to buyback
const BuybackTaxRate = 0.05

// BurnRateOnVictory: 1% of treasury tokens burned on war victory
const BurnRateOnVictory = 0.01

// MaxBatchSize: maximum countries per batch transaction
const MaxBatchSize = 20

// BuybackRecord represents a single buyback event
type BuybackRecord struct {
	ISO3           string    `json:"iso3"`
	GDPTaxAmount   float64   `json:"gdpTaxAmount"`   // Gold/currency spent
	TokensReceived float64   `json:"tokensReceived"`  // Tokens bought from DEX
	TxHash         string    `json:"txHash,omitempty"`
	Timestamp      time.Time `json:"timestamp"`
}

// BurnRecord represents a single token burn event
type BurnRecord struct {
	ISO3        string    `json:"iso3"`
	Amount      float64   `json:"amount"` // Tokens burned
	Reason      string    `json:"reason"` // "war_victory", "deflation", etc.
	TxHash      string    `json:"txHash,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// CountryBuybackState tracks buyback/burn stats for a single country
type CountryBuybackState struct {
	ISO3              string    `json:"iso3"`
	TotalBuyback      float64   `json:"totalBuyback"`      // Total tokens bought back
	TotalBurned       float64   `json:"totalBurned"`        // Total tokens burned
	BuybackCount      int       `json:"buybackCount"`
	BurnCount         int       `json:"burnCount"`
	LastBuyback       time.Time `json:"lastBuyback,omitempty"`
	LastBurn          time.Time `json:"lastBurn,omitempty"`
	AccumulatedTax    float64   `json:"accumulatedTax"`     // Pending tax to be used for buyback
}

// BuybackEngine manages GDP-based token buybacks and war victory burns.
// It processes economic ticks from the game server and executes on-chain transactions.
type BuybackEngine struct {
	mu       sync.RWMutex
	states   map[string]*CountryBuybackState // ISO3 -> state
	history  []BuybackRecord                 // Recent buyback history
	burns    []BurnRecord                    // Recent burn history
	rpcURL   string
	client   *http.Client
	stopChan chan struct{}

	// Treasury contract addresses per country
	treasuryAddresses map[string]string // ISO3 -> treasury contract address

	// Config
	maxHistorySize int

	// v30 Task 2-8: Forge price for more accurate token conversion
	forgePrice float64
}

// NewBuybackEngine creates a new BuybackEngine
func NewBuybackEngine(rpcURL string) *BuybackEngine {
	return &BuybackEngine{
		states:            make(map[string]*CountryBuybackState),
		history:           make([]BuybackRecord, 0, 1000),
		burns:             make([]BurnRecord, 0, 1000),
		rpcURL:            rpcURL,
		client:            &http.Client{Timeout: 30 * time.Second},
		stopChan:          make(chan struct{}),
		treasuryAddresses: make(map[string]string),
		maxHistorySize:    10000,
	}
}

// RegisterCountry registers a country for buyback tracking
func (e *BuybackEngine) RegisterCountry(iso3 string, treasuryAddr string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, ok := e.states[iso3]; !ok {
		e.states[iso3] = &CountryBuybackState{ISO3: iso3}
	}
	if treasuryAddr != "" {
		e.treasuryAddresses[iso3] = treasuryAddr
	}
}

// ProcessEconomicTick handles a GDP tax event from the economy engine.
// Called every economic tick (e.g., every 5 minutes) per country.
// gdpRevenue = the country's GDP revenue for this tick.
func (e *BuybackEngine) ProcessEconomicTick(iso3 string, gdpRevenue float64) {
	if gdpRevenue <= 0 {
		return
	}

	taxAmount := gdpRevenue * BuybackTaxRate

	e.mu.Lock()
	state, ok := e.states[iso3]
	if !ok {
		state = &CountryBuybackState{ISO3: iso3}
		e.states[iso3] = state
	}
	state.AccumulatedTax += taxAmount
	e.mu.Unlock()
}

// ExecutePendingBuybacks processes all accumulated tax into buyback transactions.
// Called periodically by the game server (e.g., every 5 minutes).
// BUG FIX (Phase 0): AccumulatedTax는 RPC 호출 성공 확인 후에만 리셋합니다.
// 실패 시 세금이 보존되어 다음 주기에 재시도됩니다.
func (e *BuybackEngine) ExecutePendingBuybacks() []BuybackRecord {
	e.mu.Lock()

	// Collect countries with pending tax (세금을 아직 리셋하지 않습니다)
	var pendingList []buybackItem
	for iso, state := range e.states {
		if state.AccumulatedTax > 0 {
			pendingList = append(pendingList, buybackItem{iso3: iso, amount: state.AccumulatedTax})
		}
	}
	e.mu.Unlock()

	if len(pendingList) == 0 {
		return nil
	}

	// Execute in batches to optimize gas
	var records []BuybackRecord
	for i := 0; i < len(pendingList); i += MaxBatchSize {
		end := i + MaxBatchSize
		if end > len(pendingList) {
			end = len(pendingList)
		}
		batch := pendingList[i:end]

		batchRecords := e.executeBuybackBatch(batch)
		records = append(records, batchRecords...)
	}

	// RPC 호출 성공한 국가만 세금을 리셋하고 이력을 기록합니다
	successISOs := make(map[string]bool, len(records))
	for _, rec := range records {
		successISOs[rec.ISO3] = true
	}

	e.mu.Lock()
	for _, rec := range records {
		if state, ok := e.states[rec.ISO3]; ok {
			// RPC 성공 확인 후에만 AccumulatedTax를 차감합니다
			state.AccumulatedTax -= rec.GDPTaxAmount
			if state.AccumulatedTax < 0 {
				state.AccumulatedTax = 0
			}
			state.TotalBuyback += rec.TokensReceived
			state.BuybackCount++
			state.LastBuyback = rec.Timestamp
		}
	}
	e.history = append(e.history, records...)
	if len(e.history) > e.maxHistorySize {
		e.history = e.history[len(e.history)-e.maxHistorySize:]
	}
	e.mu.Unlock()

	return records
}

// buybackItem represents a pending buyback item
type buybackItem struct {
	iso3   string
	amount float64
}

// executeBuybackBatch executes a batch of buyback transactions via CROSS RPC
func (e *BuybackEngine) executeBuybackBatch(batch []buybackItem) []BuybackRecord {
	now := time.Now()
	records := make([]BuybackRecord, 0, len(batch))

	if e.rpcURL == "" {
		// No RPC configured: record locally without on-chain tx
		// v30 Task 2-8: Use Forge price for more accurate conversion if available
		for _, b := range batch {
			conversionRate := 100.0 // default: 1 gold = 100 tokens
			if e.forgePrice > 0 {
				conversionRate = 1.0 / e.forgePrice // tokens per gold unit
			}
			records = append(records, BuybackRecord{
				ISO3:           b.iso3,
				GDPTaxAmount:   b.amount,
				TokensReceived: b.amount * conversionRate,
				Timestamp:      now,
			})
		}
		return records
	}

	// Build batch transaction for DEX buyback
	type buybackParam struct {
		ISO3            string  `json:"iso3"`
		TreasuryAddress string  `json:"treasuryAddress"`
		Amount          float64 `json:"amount"`
	}

	params := make([]buybackParam, 0, len(batch))
	for _, b := range batch {
		treasuryAddr := e.treasuryAddresses[b.iso3]
		if treasuryAddr == "" {
			continue
		}
		params = append(params, buybackParam{
			ISO3:            b.iso3,
			TreasuryAddress: treasuryAddr,
			Amount:          b.amount,
		})
	}

	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "aww_executeBatchBuyback",
		Params:  []interface{}{params},
		ID:      int(now.UnixMilli()),
	}

	body, err := json.Marshal(req)
	if err != nil {
		log.Printf("[BuybackEngine] Marshal error: %v", err)
		return records
	}

	resp, err := e.client.Post(e.rpcURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[BuybackEngine] RPC error: %v", err)
		return records
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[BuybackEngine] Read error: %v", err)
		return records
	}

	var rpcResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		log.Printf("[BuybackEngine] Unmarshal error: %v", err)
		return records
	}

	if rpcResp.Error != nil {
		log.Printf("[BuybackEngine] RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
		return records
	}

	// Parse buyback results
	var results []struct {
		ISO3           string  `json:"iso3"`
		TokensReceived float64 `json:"tokensReceived"`
		TxHash         string  `json:"txHash"`
	}
	if err := json.Unmarshal(rpcResp.Result, &results); err != nil {
		log.Printf("[BuybackEngine] Result parse error: %v", err)
		return records
	}

	for _, r := range results {
		// Find original amount
		var amount float64
		for _, b := range batch {
			if b.iso3 == r.ISO3 {
				amount = b.amount
				break
			}
		}
		records = append(records, BuybackRecord{
			ISO3:           r.ISO3,
			GDPTaxAmount:   amount,
			TokensReceived: r.TokensReceived,
			TxHash:         r.TxHash,
			Timestamp:      now,
		})
	}

	return records
}

// ExecuteWarVictoryBurn burns 1% of treasury tokens when a country wins a defensive war.
// Called by the war system after a successful siege defense.
func (e *BuybackEngine) ExecuteWarVictoryBurn(iso3 string, treasuryBalance float64) (*BurnRecord, error) {
	burnAmount := treasuryBalance * BurnRateOnVictory
	if burnAmount <= 0 {
		return nil, fmt.Errorf("nothing to burn for %s", iso3)
	}

	now := time.Now()
	record := &BurnRecord{
		ISO3:      iso3,
		Amount:    burnAmount,
		Reason:    "war_victory",
		Timestamp: now,
	}

	if e.rpcURL != "" {
		txHash, err := e.executeBurnTransaction(iso3, burnAmount, "war_victory")
		if err != nil {
			return nil, fmt.Errorf("burn tx failed for %s: %w", iso3, err)
		}
		record.TxHash = txHash
	}

	// Record
	e.mu.Lock()
	if state, ok := e.states[iso3]; ok {
		state.TotalBurned += burnAmount
		state.BurnCount++
		state.LastBurn = now
	}
	e.burns = append(e.burns, *record)
	if len(e.burns) > e.maxHistorySize {
		e.burns = e.burns[len(e.burns)-e.maxHistorySize:]
	}
	e.mu.Unlock()

	log.Printf("[BuybackEngine] BURN %s: %.2f tokens (war_victory)", iso3, burnAmount)
	return record, nil
}

// executeBurnTransaction sends a burn transaction via CROSS RPC
func (e *BuybackEngine) executeBurnTransaction(iso3 string, amount float64, reason string) (string, error) {
	treasuryAddr := e.treasuryAddresses[iso3]
	if treasuryAddr == "" {
		return "", fmt.Errorf("no treasury address for %s", iso3)
	}

	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "aww_burnTokens",
		Params: []interface{}{map[string]interface{}{
			"iso3":            iso3,
			"treasuryAddress": treasuryAddr,
			"amount":          amount,
			"reason":          reason,
		}},
		ID: int(time.Now().UnixMilli()),
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	resp, err := e.client.Post(e.rpcURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var rpcResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return "", err
	}

	if rpcResp.Error != nil {
		return "", fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	var result struct {
		TxHash string `json:"txHash"`
	}
	if err := json.Unmarshal(rpcResp.Result, &result); err != nil {
		return "", err
	}

	return result.TxHash, nil
}

// GetBuybackHistory returns recent buyback records
func (e *BuybackEngine) GetBuybackHistory(limit int) []BuybackRecord {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if limit <= 0 || limit > len(e.history) {
		limit = len(e.history)
	}
	start := len(e.history) - limit
	result := make([]BuybackRecord, limit)
	copy(result, e.history[start:])
	return result
}

// GetBurnHistory returns recent burn records
func (e *BuybackEngine) GetBurnHistory(limit int) []BurnRecord {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if limit <= 0 || limit > len(e.burns) {
		limit = len(e.burns)
	}
	start := len(e.burns) - limit
	result := make([]BurnRecord, limit)
	copy(result, e.burns[start:])
	return result
}

// GetCountryBuybackStats returns buyback stats for a specific country
func (e *BuybackEngine) GetCountryBuybackStats(iso3 string) *CountryBuybackState {
	e.mu.RLock()
	defer e.mu.RUnlock()
	state, ok := e.states[iso3]
	if !ok {
		return nil
	}
	copied := *state
	return &copied
}

// BuybackStats returns aggregated buyback statistics
type BuybackStats struct {
	TotalBuybackValue  float64 `json:"totalBuybackValue"`
	TotalBurnedValue   float64 `json:"totalBurnedValue"`
	TotalBuybackCount  int     `json:"totalBuybackCount"`
	TotalBurnCount     int     `json:"totalBurnCount"`
	ActiveCountries    int     `json:"activeCountries"`
}

// v30 Task 2-8: SetForgePrice sets the Forge $AWW price for more accurate token conversion.
func (e *BuybackEngine) SetForgePrice(price float64) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.forgePrice = price
}

// v30 Task 2-8: GetForgePrice returns the current Forge price.
func (e *BuybackEngine) GetForgePrice() float64 {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.forgePrice
}

// RecordBurn records a generic burn event (for Sink mechanisms).
func (e *BuybackEngine) RecordBurn(reason string, context string, amount float64) {
	now := time.Now()
	record := BurnRecord{
		ISO3:      context,
		Amount:    amount,
		Reason:    reason,
		Timestamp: now,
	}

	e.mu.Lock()
	e.burns = append(e.burns, record)
	if len(e.burns) > e.maxHistorySize {
		e.burns = e.burns[len(e.burns)-e.maxHistorySize:]
	}
	e.mu.Unlock()

	log.Printf("[BuybackEngine] BURN %.2f tokens (%s: %s)", amount, reason, context)
}

// GetStats returns aggregated buyback/burn stats
func (e *BuybackEngine) GetStats() BuybackStats {
	e.mu.RLock()
	defer e.mu.RUnlock()

	stats := BuybackStats{}
	for _, state := range e.states {
		stats.TotalBuybackValue += state.TotalBuyback
		stats.TotalBurnedValue += state.TotalBurned
		stats.TotalBuybackCount += state.BuybackCount
		stats.TotalBurnCount += state.BurnCount
		if state.BuybackCount > 0 || state.BurnCount > 0 {
			stats.ActiveCountries++
		}
	}
	return stats
}
