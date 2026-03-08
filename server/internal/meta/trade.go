package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// OrderSide defines buy or sell.
type OrderSide string

const (
	OrderBuy  OrderSide = "buy"
	OrderSell OrderSide = "sell"
)

// OrderStatus defines order lifecycle.
type OrderStatus string

const (
	OrderOpen      OrderStatus = "open"
	OrderFilled    OrderStatus = "filled"
	OrderPartial   OrderStatus = "partial"
	OrderCancelled OrderStatus = "cancelled"
	OrderExpired   OrderStatus = "expired"
)

// TradeRouteType defines how resources are transported.
type TradeRouteType string

const (
	RouteSea  TradeRouteType = "sea"
	RouteLand TradeRouteType = "land"
)

// TradeOrder represents a buy/sell order on the global exchange.
type TradeOrder struct {
	ID         string       `json:"id"`
	FactionID  string       `json:"faction_id"`
	UserID     string       `json:"user_id"`
	Side       OrderSide    `json:"side"`
	Resource   ResourceType `json:"resource"`
	Quantity   int64        `json:"quantity"`
	Filled     int64        `json:"filled"`
	PricePerUnit float64    `json:"price_per_unit"` // Gold per unit
	Status     OrderStatus  `json:"status"`
	CreatedAt  time.Time    `json:"created_at"`
	ExpiresAt  time.Time    `json:"expires_at"`
}

// TradeExecution records a completed trade.
type TradeExecution struct {
	ID          string       `json:"id"`
	BuyOrderID  string       `json:"buy_order_id"`
	SellOrderID string       `json:"sell_order_id"`
	BuyerFaction  string     `json:"buyer_faction"`
	SellerFaction string     `json:"seller_faction"`
	Resource    ResourceType `json:"resource"`
	Quantity    int64        `json:"quantity"`
	PricePerUnit float64    `json:"price_per_unit"`
	TotalGold   int64        `json:"total_gold"`
	RouteFee    int64        `json:"route_fee"`
	RouteType   TradeRouteType `json:"route_type"`
	ExecutedAt  time.Time    `json:"executed_at"`
}

// MarketSnapshot holds the current market state for a resource.
type MarketSnapshot struct {
	Resource     ResourceType `json:"resource"`
	Price        float64      `json:"price"`
	PrevPrice    float64      `json:"prev_price"`
	PriceDelta   float64      `json:"price_delta"`
	Volume24h    int64        `json:"volume_24h"`
	BuyOrders    int          `json:"buy_orders"`
	SellOrders   int          `json:"sell_orders"`
	HighPrice24h float64      `json:"high_price_24h"`
	LowPrice24h  float64      `json:"low_price_24h"`
}

// PriceHistory records a price point for charting.
type PriceHistory struct {
	Timestamp time.Time `json:"timestamp"`
	Price     float64   `json:"price"`
	Volume    int64     `json:"volume"`
}

// TradeRouteConfig defines fees for trade routes.
type TradeRouteConfig struct {
	SeaBaseFee  float64 // 5% base fee for sea routes
	LandBaseFee float64 // 3% base fee for land routes
	DistanceMult float64 // Additional fee per "hop" between countries
}

// DefaultTradeRouteConfig returns default trade route fees.
func DefaultTradeRouteConfig() TradeRouteConfig {
	return TradeRouteConfig{
		SeaBaseFee:   0.05,
		LandBaseFee:  0.03,
		DistanceMult: 0.01,
	}
}

// TradeConfig holds trade system settings.
type TradeConfig struct {
	OrderExpiration time.Duration // Default order TTL (24 hours)
	MaxOrdersPerFaction int      // Max open orders per faction (20)
	MinOrderQuantity int64       // Minimum quantity per order (10)
	PriceFloor     float64       // Minimum price per unit (0.01)
	PriceCeiling   float64       // Maximum price per unit (10000)
	RouteConfig    TradeRouteConfig
}

// DefaultTradeConfig returns default trade configuration.
func DefaultTradeConfig() TradeConfig {
	return TradeConfig{
		OrderExpiration:     24 * time.Hour,
		MaxOrdersPerFaction: 20,
		MinOrderQuantity:    10,
		PriceFloor:          0.01,
		PriceCeiling:        10000.0,
		RouteConfig:         DefaultTradeRouteConfig(),
	}
}

// TradeBroadcaster is an interface for broadcasting trade route updates via WS.
// This avoids importing the ws package directly.
type TradeBroadcaster interface {
	BroadcastTradeRoute(from, to, routeType string, volume int64, resource string)
}

// TradeEngine manages the global resource exchange.
type TradeEngine struct {
	mu sync.RWMutex

	config TradeConfig

	// Order books: resource → list of open orders (sorted by price)
	buyOrders  map[ResourceType][]*TradeOrder  // Sorted by price DESC (highest first)
	sellOrders map[ResourceType][]*TradeOrder  // Sorted by price ASC (lowest first)

	// All orders by ID
	allOrders map[string]*TradeOrder

	// Execution history
	executions []TradeExecution

	// Price tracking
	currentPrices map[ResourceType]float64
	priceHistory  map[ResourceType][]PriceHistory
	volume24h     map[ResourceType]int64
	highPrice24h  map[ResourceType]float64
	lowPrice24h   map[ResourceType]float64

	// External references
	factionManager  *FactionManager
	diplomacyEngine *DiplomacyEngine
	economyEngine   *EconomyEngine

	// v15: WS broadcaster for trade route updates
	broadcaster TradeBroadcaster
}

// NewTradeEngine creates a new trade engine.
func NewTradeEngine(cfg TradeConfig) *TradeEngine {
	te := &TradeEngine{
		config:        cfg,
		buyOrders:     make(map[ResourceType][]*TradeOrder),
		sellOrders:    make(map[ResourceType][]*TradeOrder),
		allOrders:     make(map[string]*TradeOrder),
		executions:    make([]TradeExecution, 0, 1000),
		currentPrices: make(map[ResourceType]float64),
		priceHistory:  make(map[ResourceType][]PriceHistory),
		volume24h:     make(map[ResourceType]int64),
		highPrice24h:  make(map[ResourceType]float64),
		lowPrice24h:   make(map[ResourceType]float64),
	}

	// Initialize with default prices
	defaultPrices := map[ResourceType]float64{
		ResOil: 10.0, ResMinerals: 8.0, ResFood: 5.0,
		ResTech: 15.0, ResManpower: 3.0, ResInfluence: 12.0,
	}
	for res, price := range defaultPrices {
		te.currentPrices[res] = price
		te.highPrice24h[res] = price
		te.lowPrice24h[res] = price
	}

	return te
}

// SetFactionManager sets the faction manager reference.
func (te *TradeEngine) SetFactionManager(fm *FactionManager) {
	te.factionManager = fm
}

// SetDiplomacyEngine sets the diplomacy engine reference for sanctions.
func (te *TradeEngine) SetDiplomacyEngine(de *DiplomacyEngine) {
	te.diplomacyEngine = de
}

// SetEconomyEngine sets the economy engine reference for market price sync.
func (te *TradeEngine) SetEconomyEngine(ee *EconomyEngine) {
	te.economyEngine = ee
}

// SetBroadcaster sets the WS broadcaster for real-time trade route updates.
func (te *TradeEngine) SetBroadcaster(b TradeBroadcaster) {
	te.broadcaster = b
}

// --- Order Management ---

// PlaceOrder places a buy or sell order on the exchange.
func (te *TradeEngine) PlaceOrder(factionID, userID string, side OrderSide, resource ResourceType, quantity int64, pricePerUnit float64) (*TradeOrder, error) {
	te.mu.Lock()
	defer te.mu.Unlock()

	// Validate quantity
	if quantity < te.config.MinOrderQuantity {
		return nil, fmt.Errorf("minimum order quantity is %d", te.config.MinOrderQuantity)
	}

	// Validate price
	if pricePerUnit < te.config.PriceFloor || pricePerUnit > te.config.PriceCeiling {
		return nil, fmt.Errorf("price must be between %.2f and %.2f", te.config.PriceFloor, te.config.PriceCeiling)
	}

	// Check max open orders
	openCount := 0
	for _, order := range te.allOrders {
		if order.FactionID == factionID && (order.Status == OrderOpen || order.Status == OrderPartial) {
			openCount++
		}
	}
	if openCount >= te.config.MaxOrdersPerFaction {
		return nil, fmt.Errorf("max %d open orders per faction", te.config.MaxOrdersPerFaction)
	}

	// Check sanctions
	// Sanctioned factions cannot trade
	if te.diplomacyEngine != nil {
		// We check if anyone has sanctioned this faction globally
		// (simplified: factions can still place orders, but matching is blocked)
	}

	// For sell orders: check that faction has enough resources
	if side == OrderSell && te.factionManager != nil {
		faction := te.factionManager.GetFaction(factionID)
		if faction == nil {
			return nil, fmt.Errorf("faction not found")
		}
		if !hasEnoughResource(faction.Treasury, resource, quantity) {
			return nil, fmt.Errorf("insufficient %s in treasury (need %d)", resource, quantity)
		}
		// Reserve resources (withdraw from treasury)
		cost := ResourceBundle{}
		setResourceField(&cost, resource, quantity)
		if err := te.factionManager.WithdrawFromTreasury(factionID, cost); err != nil {
			return nil, fmt.Errorf("failed to reserve resources: %w", err)
		}
	}

	// For buy orders: reserve gold
	if side == OrderBuy && te.factionManager != nil {
		totalGold := int64(math.Ceil(float64(quantity) * pricePerUnit))
		if err := te.factionManager.WithdrawFromTreasury(factionID, ResourceBundle{Gold: totalGold}); err != nil {
			return nil, fmt.Errorf("insufficient gold (need %d)", totalGold)
		}
	}

	order := &TradeOrder{
		ID:           uuid.New().String(),
		FactionID:    factionID,
		UserID:       userID,
		Side:         side,
		Resource:     resource,
		Quantity:     quantity,
		Filled:       0,
		PricePerUnit: pricePerUnit,
		Status:       OrderOpen,
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(te.config.OrderExpiration),
	}

	te.allOrders[order.ID] = order

	// Insert into order book
	if side == OrderBuy {
		te.buyOrders[resource] = insertBuyOrder(te.buyOrders[resource], order)
	} else {
		te.sellOrders[resource] = insertSellOrder(te.sellOrders[resource], order)
	}

	slog.Info("trade order placed",
		"id", order.ID,
		"faction", factionID,
		"side", side,
		"resource", resource,
		"qty", quantity,
		"price", pricePerUnit,
	)

	// Try to match orders
	te.matchOrders(resource)

	return order, nil
}

// CancelOrder cancels an open order and refunds reserved resources.
func (te *TradeEngine) CancelOrder(orderID, factionID string) error {
	te.mu.Lock()
	defer te.mu.Unlock()

	order, ok := te.allOrders[orderID]
	if !ok {
		return fmt.Errorf("order %s not found", orderID)
	}
	if order.FactionID != factionID {
		return fmt.Errorf("order belongs to a different faction")
	}
	if order.Status != OrderOpen && order.Status != OrderPartial {
		return fmt.Errorf("order is not open")
	}

	remaining := order.Quantity - order.Filled
	order.Status = OrderCancelled

	// Remove from order book
	if order.Side == OrderBuy {
		te.buyOrders[order.Resource] = removeOrder(te.buyOrders[order.Resource], orderID)
	} else {
		te.sellOrders[order.Resource] = removeOrder(te.sellOrders[order.Resource], orderID)
	}

	// Refund reserved resources
	if te.factionManager != nil && remaining > 0 {
		if order.Side == OrderSell {
			refund := ResourceBundle{}
			setResourceField(&refund, order.Resource, remaining)
			_ = te.factionManager.DepositToTreasury(factionID, refund)
		} else {
			refundGold := int64(math.Ceil(float64(remaining) * order.PricePerUnit))
			_ = te.factionManager.DepositToTreasury(factionID, ResourceBundle{Gold: refundGold})
		}
	}

	slog.Info("trade order cancelled", "id", orderID, "refunded", remaining)
	return nil
}

// matchOrders tries to match buy and sell orders for a resource.
// Must be called with write lock held.
func (te *TradeEngine) matchOrders(resource ResourceType) {
	buys := te.buyOrders[resource]
	sells := te.sellOrders[resource]

	for len(buys) > 0 && len(sells) > 0 {
		bestBuy := buys[0]
		bestSell := sells[0]

		// Match only if buy price >= sell price
		if bestBuy.PricePerUnit < bestSell.PricePerUnit {
			break
		}

		// Check sanctions between buyer and seller
		if te.diplomacyEngine != nil && te.diplomacyEngine.IsTradeBlocked(bestBuy.FactionID, bestSell.FactionID) {
			// Skip this pair — move to next sell order
			sells = sells[1:]
			continue
		}

		// Determine fill quantity
		buyRemaining := bestBuy.Quantity - bestBuy.Filled
		sellRemaining := bestSell.Quantity - bestSell.Filled
		fillQty := min64(buyRemaining, sellRemaining)

		// Execute at the midpoint price (fair for both sides)
		execPrice := (bestBuy.PricePerUnit + bestSell.PricePerUnit) / 2.0
		totalGold := int64(math.Ceil(float64(fillQty) * execPrice))

		// Calculate trade route fee (simplified: sea route by default)
		routeType := RouteSea
		feeRate := te.config.RouteConfig.SeaBaseFee
		routeFee := int64(math.Ceil(float64(totalGold) * feeRate))

		// Apply trade agreement discount
		if te.diplomacyEngine != nil {
			reduction := te.diplomacyEngine.GetTradeFeeReduction(bestBuy.FactionID, bestSell.FactionID)
			routeFee = int64(float64(routeFee) * (1.0 - reduction))
		}

		// Execute the trade
		execution := TradeExecution{
			ID:            uuid.New().String(),
			BuyOrderID:    bestBuy.ID,
			SellOrderID:   bestSell.ID,
			BuyerFaction:  bestBuy.FactionID,
			SellerFaction: bestSell.FactionID,
			Resource:      resource,
			Quantity:      fillQty,
			PricePerUnit:  execPrice,
			TotalGold:     totalGold,
			RouteFee:      routeFee,
			RouteType:     routeType,
			ExecutedAt:    time.Now(),
		}
		te.executions = append(te.executions, execution)

		// Transfer resources
		if te.factionManager != nil {
			// Buyer receives resources (withdrawn at order time, now deliver)
			buyerResources := ResourceBundle{}
			setResourceField(&buyerResources, resource, fillQty)
			_ = te.factionManager.DepositToTreasury(bestBuy.FactionID, buyerResources)

			// Seller receives gold minus route fee
			sellerGold := totalGold - routeFee
			_ = te.factionManager.DepositToTreasury(bestSell.FactionID, ResourceBundle{Gold: sellerGold})

			// Refund excess gold to buyer if execution price < order price
			if execPrice < bestBuy.PricePerUnit {
				refund := int64(math.Ceil(float64(fillQty) * (bestBuy.PricePerUnit - execPrice)))
				_ = te.factionManager.DepositToTreasury(bestBuy.FactionID, ResourceBundle{Gold: refund})
			}
		}

		// Update orders
		bestBuy.Filled += fillQty
		bestSell.Filled += fillQty

		if bestBuy.Filled >= bestBuy.Quantity {
			bestBuy.Status = OrderFilled
			buys = buys[1:]
		} else {
			bestBuy.Status = OrderPartial
		}

		if bestSell.Filled >= bestSell.Quantity {
			bestSell.Status = OrderFilled
			sells = sells[1:]
		} else {
			bestSell.Status = OrderPartial
		}

		// Update market price
		te.updateMarketPrice(resource, execPrice, fillQty)

		slog.Info("trade executed",
			"resource", resource,
			"qty", fillQty,
			"price", execPrice,
			"buyer", bestBuy.FactionID,
			"seller", bestSell.FactionID,
			"fee", routeFee,
		)

		// v15: Broadcast trade route update via WS
		if te.broadcaster != nil {
			te.broadcaster.BroadcastTradeRoute(
				bestSell.FactionID, // from (seller)
				bestBuy.FactionID,  // to (buyer)
				string(routeType),
				fillQty,
				string(resource),
			)
		}
	}

	// Update order book references
	te.buyOrders[resource] = buys
	te.sellOrders[resource] = sells
}

// updateMarketPrice updates the current price based on execution.
func (te *TradeEngine) updateMarketPrice(resource ResourceType, price float64, volume int64) {
	te.currentPrices[resource] = price
	te.volume24h[resource] += volume

	if price > te.highPrice24h[resource] {
		te.highPrice24h[resource] = price
	}
	if price < te.lowPrice24h[resource] || te.lowPrice24h[resource] == 0 {
		te.lowPrice24h[resource] = price
	}

	// Record price history
	te.priceHistory[resource] = append(te.priceHistory[resource], PriceHistory{
		Timestamp: time.Now(),
		Price:     price,
		Volume:    volume,
	})

	// Keep last 720 entries (30 days at hourly aggregation)
	const maxHistory = 720
	if len(te.priceHistory[resource]) > maxHistory {
		te.priceHistory[resource] = te.priceHistory[resource][len(te.priceHistory[resource])-maxHistory:]
	}

	// Sync price to economy engine
	if te.economyEngine != nil {
		te.economyEngine.SetMarketPrice(resource, price)
	}
}

// ExpireOldOrders expires orders past their expiration and refunds.
func (te *TradeEngine) ExpireOldOrders() int {
	te.mu.Lock()
	defer te.mu.Unlock()

	now := time.Now()
	expired := 0

	for _, order := range te.allOrders {
		if (order.Status == OrderOpen || order.Status == OrderPartial) && now.After(order.ExpiresAt) {
			remaining := order.Quantity - order.Filled
			order.Status = OrderExpired

			// Remove from order book
			if order.Side == OrderBuy {
				te.buyOrders[order.Resource] = removeOrder(te.buyOrders[order.Resource], order.ID)
			} else {
				te.sellOrders[order.Resource] = removeOrder(te.sellOrders[order.Resource], order.ID)
			}

			// Refund
			if te.factionManager != nil && remaining > 0 {
				if order.Side == OrderSell {
					refund := ResourceBundle{}
					setResourceField(&refund, order.Resource, remaining)
					_ = te.factionManager.DepositToTreasury(order.FactionID, refund)
				} else {
					refundGold := int64(math.Ceil(float64(remaining) * order.PricePerUnit))
					_ = te.factionManager.DepositToTreasury(order.FactionID, ResourceBundle{Gold: refundGold})
				}
			}

			expired++
		}
	}

	if expired > 0 {
		slog.Info("trade orders expired", "count", expired)
	}
	return expired
}

// Reset24hStats resets 24-hour volume and price range. Called daily.
func (te *TradeEngine) Reset24hStats() {
	te.mu.Lock()
	defer te.mu.Unlock()

	for res := range te.volume24h {
		te.volume24h[res] = 0
		te.highPrice24h[res] = te.currentPrices[res]
		te.lowPrice24h[res] = te.currentPrices[res]
	}
}

// --- Queries ---

// GetMarketSnapshot returns the current market state for a resource.
func (te *TradeEngine) GetMarketSnapshot(resource ResourceType) MarketSnapshot {
	te.mu.RLock()
	defer te.mu.RUnlock()

	buyCount := 0
	for _, o := range te.buyOrders[resource] {
		if o.Status == OrderOpen || o.Status == OrderPartial {
			buyCount++
		}
	}
	sellCount := 0
	for _, o := range te.sellOrders[resource] {
		if o.Status == OrderOpen || o.Status == OrderPartial {
			sellCount++
		}
	}

	price := te.currentPrices[resource]
	// Previous price from history
	prevPrice := price
	if history := te.priceHistory[resource]; len(history) >= 2 {
		prevPrice = history[len(history)-2].Price
	}

	return MarketSnapshot{
		Resource:     resource,
		Price:        price,
		PrevPrice:    prevPrice,
		PriceDelta:   price - prevPrice,
		Volume24h:    te.volume24h[resource],
		BuyOrders:    buyCount,
		SellOrders:   sellCount,
		HighPrice24h: te.highPrice24h[resource],
		LowPrice24h:  te.lowPrice24h[resource],
	}
}

// GetAllMarketSnapshots returns snapshots for all resources.
func (te *TradeEngine) GetAllMarketSnapshots() []MarketSnapshot {
	var snapshots []MarketSnapshot
	for _, res := range AllResourceTypes {
		snapshots = append(snapshots, te.GetMarketSnapshot(res))
	}
	return snapshots
}

// GetOrderBook returns the top N buy and sell orders for a resource.
func (te *TradeEngine) GetOrderBook(resource ResourceType, depth int) (buys, sells []*TradeOrder) {
	te.mu.RLock()
	defer te.mu.RUnlock()

	if depth <= 0 {
		depth = 10
	}

	for i, o := range te.buyOrders[resource] {
		if i >= depth {
			break
		}
		if o.Status == OrderOpen || o.Status == OrderPartial {
			copy := *o
			buys = append(buys, &copy)
		}
	}
	for i, o := range te.sellOrders[resource] {
		if i >= depth {
			break
		}
		if o.Status == OrderOpen || o.Status == OrderPartial {
			copy := *o
			sells = append(sells, &copy)
		}
	}
	return
}

// GetFactionOrders returns all orders for a faction.
func (te *TradeEngine) GetFactionOrders(factionID string) []*TradeOrder {
	te.mu.RLock()
	defer te.mu.RUnlock()

	var orders []*TradeOrder
	for _, o := range te.allOrders {
		if o.FactionID == factionID {
			copy := *o
			orders = append(orders, &copy)
		}
	}

	sort.Slice(orders, func(i, j int) bool {
		return orders[i].CreatedAt.After(orders[j].CreatedAt)
	})
	return orders
}

// GetRecentExecutions returns recent trade executions.
func (te *TradeEngine) GetRecentExecutions(limit int) []TradeExecution {
	te.mu.RLock()
	defer te.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	}

	start := len(te.executions) - limit
	if start < 0 {
		start = 0
	}

	result := make([]TradeExecution, len(te.executions[start:]))
	copy(result, te.executions[start:])

	// Reverse to show most recent first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

// GetPriceHistory returns price history for a resource.
func (te *TradeEngine) GetPriceHistory(resource ResourceType) []PriceHistory {
	te.mu.RLock()
	defer te.mu.RUnlock()

	history := te.priceHistory[resource]
	result := make([]PriceHistory, len(history))
	copy(result, history)
	return result
}

// --- Helpers ---

func hasEnoughResource(treasury ResourceBundle, resource ResourceType, amount int64) bool {
	switch resource {
	case ResOil:
		return treasury.Oil >= amount
	case ResMinerals:
		return treasury.Minerals >= amount
	case ResFood:
		return treasury.Food >= amount
	case ResTech:
		return treasury.Tech >= amount
	case ResInfluence:
		return treasury.Influence >= amount
	default:
		return false
	}
}

func setResourceField(b *ResourceBundle, resource ResourceType, amount int64) {
	switch resource {
	case ResOil:
		b.Oil = amount
	case ResMinerals:
		b.Minerals = amount
	case ResFood:
		b.Food = amount
	case ResTech:
		b.Tech = amount
	case ResInfluence:
		b.Influence = amount
	}
}

func insertBuyOrder(orders []*TradeOrder, order *TradeOrder) []*TradeOrder {
	// Insert maintaining DESC price order
	pos := sort.Search(len(orders), func(i int) bool {
		return orders[i].PricePerUnit < order.PricePerUnit
	})
	orders = append(orders, nil)
	copy(orders[pos+1:], orders[pos:])
	orders[pos] = order
	return orders
}

func insertSellOrder(orders []*TradeOrder, order *TradeOrder) []*TradeOrder {
	// Insert maintaining ASC price order
	pos := sort.Search(len(orders), func(i int) bool {
		return orders[i].PricePerUnit > order.PricePerUnit
	})
	orders = append(orders, nil)
	copy(orders[pos+1:], orders[pos:])
	orders[pos] = order
	return orders
}

func removeOrder(orders []*TradeOrder, orderID string) []*TradeOrder {
	for i, o := range orders {
		if o.ID == orderID {
			return append(orders[:i], orders[i+1:]...)
		}
	}
	return orders
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// --- HTTP API ---

// TradeRoutes returns a chi.Router with trade HTTP endpoints.
func (te *TradeEngine) TradeRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()

	// Public: market data
	r.Get("/market", te.handleGetMarket)
	r.Get("/market/{resource}", te.handleGetResourceMarket)
	r.Get("/market/{resource}/history", te.handleGetPriceHistory)
	r.Get("/market/{resource}/orderbook", te.handleGetOrderBook)
	r.Get("/executions", te.handleGetExecutions)

	// Authenticated: orders
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Post("/orders", te.handlePlaceOrder(fm))
		r.Delete("/orders/{orderID}", te.handleCancelOrder(fm))
		r.Get("/orders/my", te.handleGetMyOrders(fm))
	})

	return r
}

// handleGetMarket — GET /api/economy/trade/market
func (te *TradeEngine) handleGetMarket(w http.ResponseWriter, r *http.Request) {
	snapshots := te.GetAllMarketSnapshots()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"markets": snapshots,
	})
}

// handleGetResourceMarket — GET /api/economy/trade/market/{resource}
func (te *TradeEngine) handleGetResourceMarket(w http.ResponseWriter, r *http.Request) {
	resource := ResourceType(chi.URLParam(r, "resource"))
	snapshot := te.GetMarketSnapshot(resource)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"market": snapshot,
	})
}

// handleGetPriceHistory — GET /api/economy/trade/market/{resource}/history
func (te *TradeEngine) handleGetPriceHistory(w http.ResponseWriter, r *http.Request) {
	resource := ResourceType(chi.URLParam(r, "resource"))
	history := te.GetPriceHistory(resource)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"history": history,
	})
}

// handleGetOrderBook — GET /api/economy/trade/market/{resource}/orderbook
func (te *TradeEngine) handleGetOrderBook(w http.ResponseWriter, r *http.Request) {
	resource := ResourceType(chi.URLParam(r, "resource"))
	buys, sells := te.GetOrderBook(resource, 20)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"buys":  buys,
		"sells": sells,
	})
}

// handleGetExecutions — GET /api/economy/trade/executions
func (te *TradeEngine) handleGetExecutions(w http.ResponseWriter, r *http.Request) {
	executions := te.GetRecentExecutions(50)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"executions": executions,
		"count":      len(executions),
	})
}

// PlaceOrderRequest is the HTTP request body for placing an order.
type PlaceOrderRequest struct {
	Side         OrderSide    `json:"side"`
	Resource     ResourceType `json:"resource"`
	Quantity     int64        `json:"quantity"`
	PricePerUnit float64     `json:"price_per_unit"`
}

func (te *TradeEngine) handlePlaceOrder(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction to trade"})
			return
		}

		var req PlaceOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		order, err := te.PlaceOrder(factionID, userID, req.Side, req.Resource, req.Quantity, req.PricePerUnit)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"order": order,
		})
	}
}

func (te *TradeEngine) handleCancelOrder(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "not in a faction"})
			return
		}

		orderID := chi.URLParam(r, "orderID")
		if err := te.CancelOrder(orderID, factionID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
	}
}

func (te *TradeEngine) handleGetMyOrders(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"orders": []interface{}{},
			})
			return
		}

		orders := te.GetFactionOrders(factionID)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"orders": orders,
			"count":  len(orders),
		})
	}
}
