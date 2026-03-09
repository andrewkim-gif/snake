package blockchain

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// AWWTokenAddress is the deployed $AWW token contract address on CROSS Mainnet.
const AWWTokenAddress = "0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7"

// AWWTotalSupply is the total supply of $AWW tokens.
const AWWTotalSupply = 1_000_000_000.0

// ForgePollInterval defines how often the Forge price is polled.
const ForgePollInterval = 5 * time.Minute

// PriceFactor is a scaling factor for GDP-based simulated price.
const PriceFactor = 0.001

// ForgeTokenPrice represents $AWW token price data.
type ForgeTokenPrice struct {
	Price     float64 `json:"price"`
	Volume24h float64 `json:"volume24h"`
	Change24h float64 `json:"change24h"`
	MarketCap float64 `json:"marketCap"`
	Source    string  `json:"source"` // "forge" or "simulation"
	UpdatedAt int64   `json:"updatedAt"`
}

// GDPProvider is an interface for getting total world GDP (to avoid circular import).
type GDPProvider interface {
	GetTotalWorldGDP() int64
}

// ForgePriceService polls the Forge Pool for $AWW price and provides a GDP-based fallback.
type ForgePriceService struct {
	mu sync.RWMutex

	forgeURL string
	client   *http.Client
	price    ForgeTokenPrice
	stopChan chan struct{}

	// GDP provider for simulation fallback
	gdpProvider GDPProvider

	// Price history (last 24h, 5min intervals = 288 entries)
	priceHistory []ForgeTokenPrice
}

// NewForgePriceService creates a new Forge price polling service.
func NewForgePriceService(forgeURL string) *ForgePriceService {
	return &ForgePriceService{
		forgeURL:     forgeURL,
		client:       &http.Client{Timeout: 15 * time.Second},
		stopChan:     make(chan struct{}),
		priceHistory: make([]ForgeTokenPrice, 0, 300),
		price: ForgeTokenPrice{
			Source: "simulation",
		},
	}
}

// SetGDPProvider sets the economy engine as GDP provider for simulation pricing.
func (fps *ForgePriceService) SetGDPProvider(provider GDPProvider) {
	fps.mu.Lock()
	defer fps.mu.Unlock()
	fps.gdpProvider = provider
}

// Start begins the 5-minute price polling loop.
func (fps *ForgePriceService) Start() {
	go fps.pollLoop()
	slog.Info("[ForgePriceService] Started polling", "interval", ForgePollInterval, "forgeURL", fps.forgeURL)
}

// Stop stops the polling loop.
func (fps *ForgePriceService) Stop() {
	close(fps.stopChan)
}

// GetCurrentPrice returns the latest cached price.
func (fps *ForgePriceService) GetCurrentPrice() ForgeTokenPrice {
	fps.mu.RLock()
	defer fps.mu.RUnlock()
	return fps.price
}

// GetPriceHistory returns recent price history.
func (fps *ForgePriceService) GetPriceHistory(limit int) []ForgeTokenPrice {
	fps.mu.RLock()
	defer fps.mu.RUnlock()
	if limit <= 0 || limit > len(fps.priceHistory) {
		limit = len(fps.priceHistory)
	}
	start := len(fps.priceHistory) - limit
	result := make([]ForgeTokenPrice, limit)
	copy(result, fps.priceHistory[start:])
	return result
}

func (fps *ForgePriceService) pollLoop() {
	// Initial fetch
	fps.fetchAndUpdate()

	ticker := time.NewTicker(ForgePollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			fps.fetchAndUpdate()
		case <-fps.stopChan:
			slog.Info("[ForgePriceService] Stopped")
			return
		}
	}
}

func (fps *ForgePriceService) fetchAndUpdate() {
	now := time.Now()

	// Try Forge API first
	if fps.forgeURL != "" {
		price, err := fps.fetchForgePrice()
		if err == nil {
			fps.mu.Lock()
			// Calculate 24h change from history
			change24h := fps.calc24hChange(price.Price)
			price.Change24h = change24h
			price.UpdatedAt = now.UnixMilli()
			fps.price = price
			fps.recordPrice(price)
			fps.mu.Unlock()
			slog.Debug("[ForgePriceService] Forge price updated", "price", price.Price, "source", "forge")
			return
		}
		slog.Warn("[ForgePriceService] Forge API failed, falling back to simulation", "error", err)
	}

	// Fallback: GDP-based simulation price
	simPrice := fps.calculateSimulatedPrice()
	fps.mu.Lock()
	change24h := fps.calc24hChange(simPrice.Price)
	simPrice.Change24h = change24h
	simPrice.UpdatedAt = now.UnixMilli()
	fps.price = simPrice
	fps.recordPrice(simPrice)
	fps.mu.Unlock()
	slog.Debug("[ForgePriceService] Simulation price updated", "price", simPrice.Price, "source", "simulation")
}

func (fps *ForgePriceService) fetchForgePrice() (ForgeTokenPrice, error) {
	url := fmt.Sprintf("%s/api/forge/token/%s/price", fps.forgeURL, AWWTokenAddress)
	resp, err := fps.client.Get(url)
	if err != nil {
		return ForgeTokenPrice{}, fmt.Errorf("forge request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ForgeTokenPrice{}, fmt.Errorf("forge returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ForgeTokenPrice{}, fmt.Errorf("read forge response: %w", err)
	}

	var result ForgeTokenPrice
	if err := json.Unmarshal(body, &result); err != nil {
		return ForgeTokenPrice{}, fmt.Errorf("parse forge response: %w", err)
	}

	result.Source = "forge"
	return result, nil
}

func (fps *ForgePriceService) calculateSimulatedPrice() ForgeTokenPrice {
	var totalWorldGDP int64
	if fps.gdpProvider != nil {
		totalWorldGDP = fps.gdpProvider.GetTotalWorldGDP()
	}

	// Simulated price: totalWorldGDP / 1B * 0.001
	simulatedPrice := float64(totalWorldGDP) / 1_000_000_000.0 * PriceFactor
	if simulatedPrice < 0.000001 {
		simulatedPrice = 0.000001 // minimum floor price
	}

	simulatedMarketCap := simulatedPrice * AWWTotalSupply

	return ForgeTokenPrice{
		Price:     simulatedPrice,
		Volume24h: 0,
		MarketCap: simulatedMarketCap,
		Source:    "simulation",
	}
}

// calc24hChange calculates 24h price change percentage.
// Must be called with lock held (reads priceHistory).
func (fps *ForgePriceService) calc24hChange(currentPrice float64) float64 {
	if len(fps.priceHistory) == 0 || currentPrice == 0 {
		return 0
	}

	// Find price ~24h ago (288 entries at 5-min intervals)
	target := len(fps.priceHistory) - 288
	if target < 0 {
		target = 0
	}

	oldPrice := fps.priceHistory[target].Price
	if oldPrice == 0 {
		return 0
	}

	return ((currentPrice - oldPrice) / oldPrice) * 100.0
}

// recordPrice adds a price entry to history. Must be called with lock held.
func (fps *ForgePriceService) recordPrice(price ForgeTokenPrice) {
	const maxHistory = 300 // ~25 hours at 5-min intervals
	fps.priceHistory = append(fps.priceHistory, price)
	if len(fps.priceHistory) > maxHistory {
		fps.priceHistory = fps.priceHistory[len(fps.priceHistory)-maxHistory:]
	}
}
