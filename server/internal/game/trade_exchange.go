package game

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TradeExchange: P2P 건물 거래소 (오더북 매칭 시스템)
//
// 판매자가 소유 건물을 매물로 등록(Sell Order) →
// 구매자가 매수 주문(Buy Order) 등록 →
// 매수가 >= 매도가일 때 자동 체결
//
// 수수료: 판매자 10%, 구매자 5%
// 체결가: 매도가 (판매자 유리 원칙)
// 주문 유효기간: 최대 72시간
// ============================================================

// ── 거래소 상수 ──

const (
	TradeSellerFeeRate = 0.10           // 판매자 수수료 10%
	TradeBuyerFeeRate  = 0.05           // 구매자 수수료 5%
	TradeMaxDuration   = 72 * time.Hour // 최대 주문 유효기간
)

// ── 주문 타입/상태 ──

type TradeOrderType string

const (
	TradeOrderSell TradeOrderType = "sell"
	TradeOrderBuy  TradeOrderType = "buy"
)

type TradeOrderStatus string

const (
	TradeStatusActive    TradeOrderStatus = "active"
	TradeStatusMatched   TradeOrderStatus = "matched"
	TradeStatusCancelled TradeOrderStatus = "cancelled"
	TradeStatusExpired   TradeOrderStatus = "expired"
)

// ── 거래 주문 ──

type TradeOrder struct {
	ID          string           `json:"id"`
	BuildingID  string           `json:"building_id"`
	OrderType   TradeOrderType   `json:"order_type"`
	PlayerID    string           `json:"player_id"`
	PlayerName  string           `json:"player_name"`
	Price       int64            `json:"price"`
	Status      TradeOrderStatus `json:"status"`
	CreatedAt   time.Time        `json:"created_at"`
	ExpiresAt   time.Time        `json:"expires_at"`
	MatchedWith *string          `json:"matched_with,omitempty"`
}

// ── 체결 결과 ──

type TradeMatch struct {
	SellOrder  *TradeOrder `json:"sell_order"`
	BuyOrder   *TradeOrder `json:"buy_order"`
	FinalPrice int64       `json:"final_price"`
	SellerFee  int64       `json:"seller_fee"`
	BuyerFee   int64       `json:"buyer_fee"`
	SellerNet  int64       `json:"seller_net"`
	BuyerTotal int64       `json:"buyer_total"`
}

// ── 매니저 ──

type TradeExchange struct {
	pg *pgxpool.Pool
	bm *TycoonBuildingManager
}

// NewTradeExchange는 새 TradeExchange를 생성한다.
func NewTradeExchange(pg *pgxpool.Pool, bm *TycoonBuildingManager) *TradeExchange {
	return &TradeExchange{pg: pg, bm: bm}
}

// ── 주문 등록 ──

// CreateSellOrder는 판매자가 소유 건물을 매물로 등록한다.
// 소유 확인 → 경매/중복 주문 검증 → INSERT + is_auctioning 플래그 설정
func (te *TradeExchange) CreateSellOrder(ctx context.Context, buildingID, sellerID, sellerName string, askPrice int64) (*TradeOrder, error) {
	tx, err := te.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("create sell order begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 건물 소유 확인 (FOR UPDATE 락)
	var ownerID *string
	var isAuctioning bool
	err = tx.QueryRow(ctx,
		"SELECT owner_id, is_auctioning FROM buildings WHERE id = $1 FOR UPDATE",
		buildingID,
	).Scan(&ownerID, &isAuctioning)
	if err != nil {
		return nil, fmt.Errorf("sell order query building: %w", err)
	}
	if ownerID == nil || *ownerID != sellerID {
		return nil, fmt.Errorf("player %s does not own building %s", sellerID, buildingID)
	}

	// 2. 이미 경매 중이면 거절
	if isAuctioning {
		return nil, fmt.Errorf("building %s is already in auction", buildingID)
	}

	// 3. 이미 활성 매도 주문 있으면 거절
	var existingCount int
	err = tx.QueryRow(ctx,
		"SELECT COUNT(*) FROM trade_orders WHERE building_id = $1 AND order_type = 'sell' AND status = 'active'",
		buildingID,
	).Scan(&existingCount)
	if err != nil {
		return nil, fmt.Errorf("sell order check existing: %w", err)
	}
	if existingCount > 0 {
		return nil, fmt.Errorf("building %s already has an active sell order", buildingID)
	}

	// 4. INSERT trade_orders + 건물 is_auctioning=true 설정
	order := &TradeOrder{
		ID:         uuid.New().String(),
		BuildingID: buildingID,
		OrderType:  TradeOrderSell,
		PlayerID:   sellerID,
		PlayerName: sellerName,
		Price:      askPrice,
		Status:     TradeStatusActive,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(TradeMaxDuration),
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO trade_orders (id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		order.ID, order.BuildingID, string(order.OrderType),
		order.PlayerID, order.PlayerName, order.Price,
		string(order.Status), order.CreatedAt, order.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("sell order insert: %w", err)
	}

	_, err = tx.Exec(ctx,
		"UPDATE buildings SET is_auctioning = true WHERE id = $1",
		buildingID,
	)
	if err != nil {
		return nil, fmt.Errorf("sell order set auctioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("sell order commit: %w", err)
	}
	return order, nil
}

// CreateBuyOrder는 구매자가 특정 건물에 매수 주문을 등록한다.
// 잔고 확인 → INSERT trade_orders
func (te *TradeExchange) CreateBuyOrder(ctx context.Context, buildingID, buyerID, buyerName string, bidPrice int64) (*TradeOrder, error) {
	tx, err := te.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("create buy order begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 건물 존재 확인
	var exists bool
	err = tx.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM buildings WHERE id = $1)",
		buildingID,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("buy order check building: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("building %s not found", buildingID)
	}

	// 2. 잔고 확인 (수수료 포함)
	totalCost := bidPrice + int64(math.Ceil(float64(bidPrice)*TradeBuyerFeeRate))
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE",
		buyerID,
	).Scan(&balance)
	if err != nil {
		return nil, fmt.Errorf("buy order query balance: %w", err)
	}
	if balance < totalCost {
		return nil, fmt.Errorf("insufficient balance: has %d, needs %d (price %d + fee)", balance, totalCost, bidPrice)
	}

	// 3. INSERT trade_orders
	order := &TradeOrder{
		ID:         uuid.New().String(),
		BuildingID: buildingID,
		OrderType:  TradeOrderBuy,
		PlayerID:   buyerID,
		PlayerName: buyerName,
		Price:      bidPrice,
		Status:     TradeStatusActive,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(TradeMaxDuration),
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO trade_orders (id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		order.ID, order.BuildingID, string(order.OrderType),
		order.PlayerID, order.PlayerName, order.Price,
		string(order.Status), order.CreatedAt, order.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("buy order insert: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("buy order commit: %w", err)
	}
	return order, nil
}

// ── 주문 매칭 ──

// MatchOrders는 특정 건물의 활성 매도/매수 주문을 매칭한다.
// 최저 매도가 vs 최고 매수가 비교 → 매수가 >= 매도가이면 체결
// 체결가 = 매도가 (판매자 유리 원칙)
func (te *TradeExchange) MatchOrders(ctx context.Context, buildingID string) (*TradeMatch, error) {
	tx, err := te.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("match orders begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 최저 매도 주문 조회
	sellOrder, err := te.scanOrder(tx.QueryRow(ctx,
		`SELECT id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at, matched_with
		 FROM trade_orders
		 WHERE building_id = $1 AND order_type = 'sell' AND status = 'active'
		 ORDER BY price ASC, created_at ASC
		 LIMIT 1
		 FOR UPDATE`,
		buildingID,
	))
	if err != nil {
		return nil, nil // 매도 주문 없음 — 매칭 불가
	}

	// 2. 최고 매수 주문 조회
	buyOrder, err := te.scanOrder(tx.QueryRow(ctx,
		`SELECT id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at, matched_with
		 FROM trade_orders
		 WHERE building_id = $1 AND order_type = 'buy' AND status = 'active'
		 ORDER BY price DESC, created_at ASC
		 LIMIT 1
		 FOR UPDATE`,
		buildingID,
	))
	if err != nil {
		return nil, nil // 매수 주문 없음 — 매칭 불가
	}

	// 3. 매수가 >= 매도가 확인
	if buyOrder.Price < sellOrder.Price {
		return nil, nil // 가격 불일치 — 매칭 불가
	}

	// 4. 체결가 = 매도가 (판매자 유리)
	finalPrice := sellOrder.Price
	sellerFee := int64(math.Ceil(float64(finalPrice) * TradeSellerFeeRate))
	buyerFee := int64(math.Ceil(float64(finalPrice) * TradeBuyerFeeRate))
	sellerNet := finalPrice - sellerFee
	buyerTotal := finalPrice + buyerFee

	// 5. 구매자 잔고 재확인 (수수료 포함)
	var buyerBalance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE",
		buyOrder.PlayerID,
	).Scan(&buyerBalance)
	if err != nil {
		return nil, fmt.Errorf("match query buyer balance: %w", err)
	}
	if buyerBalance < buyerTotal {
		// 잔고 부족 — 매수 주문 취소
		_, _ = tx.Exec(ctx,
			"UPDATE trade_orders SET status = 'cancelled' WHERE id = $1",
			buyOrder.ID,
		)
		_ = tx.Commit(ctx)
		return nil, fmt.Errorf("buyer %s insufficient balance for match: has %d, needs %d", buyOrder.PlayerID, buyerBalance, buyerTotal)
	}

	// 6. 소유권 이전: 건물 owner 변경 + is_auctioning=false
	_, err = tx.Exec(ctx,
		"UPDATE buildings SET owner_id = $1, owner_name = $2, is_auctioning = false WHERE id = $3",
		buyOrder.PlayerID, buyOrder.PlayerName, buildingID,
	)
	if err != nil {
		return nil, fmt.Errorf("match transfer building: %w", err)
	}

	// 7. 구매자 잔고 차감 (체결가 + 수수료)
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		buyerTotal, buyOrder.PlayerID,
	)
	if err != nil {
		return nil, fmt.Errorf("match deduct buyer: %w", err)
	}

	// 8. 판매자 잔고 증가 (체결가 - 수수료)
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance + $1 WHERE id = $2",
		sellerNet, sellOrder.PlayerID,
	)
	if err != nil {
		return nil, fmt.Errorf("match credit seller: %w", err)
	}

	// 9. 주문 상태 변경
	_, err = tx.Exec(ctx,
		"UPDATE trade_orders SET status = 'matched', matched_with = $1 WHERE id = $2",
		buyOrder.PlayerID, sellOrder.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("match update sell order: %w", err)
	}
	_, err = tx.Exec(ctx,
		"UPDATE trade_orders SET status = 'matched', matched_with = $1 WHERE id = $2",
		sellOrder.PlayerID, buyOrder.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("match update buy order: %w", err)
	}

	// 10. 거래 기록 삽입 (구매자)
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, ref_id, description) VALUES ($1, $2, $3, $4, $5)",
		buyOrder.PlayerID, "trade_buy", -buyerTotal, buildingID,
		fmt.Sprintf("P2P trade buy building %s for %d MC (fee %d)", buildingID, finalPrice, buyerFee),
	)
	if err != nil {
		return nil, fmt.Errorf("match insert buyer tx: %w", err)
	}

	// 11. 거래 기록 삽입 (판매자)
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, ref_id, description) VALUES ($1, $2, $3, $4, $5)",
		sellOrder.PlayerID, "trade_sell", sellerNet, buildingID,
		fmt.Sprintf("P2P trade sell building %s for %d MC (fee %d)", buildingID, finalPrice, sellerFee),
	)
	if err != nil {
		return nil, fmt.Errorf("match insert seller tx: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("match commit: %w", err)
	}

	// 결과 반환
	sellOrder.Status = TradeStatusMatched
	sellOrder.MatchedWith = &buyOrder.PlayerID
	buyOrder.Status = TradeStatusMatched
	buyOrder.MatchedWith = &sellOrder.PlayerID

	return &TradeMatch{
		SellOrder:  sellOrder,
		BuyOrder:   buyOrder,
		FinalPrice: finalPrice,
		SellerFee:  sellerFee,
		BuyerFee:   buyerFee,
		SellerNet:  sellerNet,
		BuyerTotal: buyerTotal,
	}, nil
}

// ── 주문 취소 ──

// CancelOrder는 플레이어 본인의 활성 주문을 취소한다.
// 매도 주문 취소 시 건물 is_auctioning=false 복원
func (te *TradeExchange) CancelOrder(ctx context.Context, orderID, playerID string) error {
	tx, err := te.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("cancel order begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var orderType string
	var buildingID string
	var ownerID string
	err = tx.QueryRow(ctx,
		"SELECT order_type, building_id, player_id FROM trade_orders WHERE id = $1 AND status = 'active' FOR UPDATE",
		orderID,
	).Scan(&orderType, &buildingID, &ownerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("order %s not found or not active", orderID)
		}
		return fmt.Errorf("cancel order query: %w", err)
	}
	if ownerID != playerID {
		return fmt.Errorf("player %s does not own order %s", playerID, orderID)
	}

	_, err = tx.Exec(ctx,
		"UPDATE trade_orders SET status = 'cancelled' WHERE id = $1",
		orderID,
	)
	if err != nil {
		return fmt.Errorf("cancel order update: %w", err)
	}

	// 매도 주문 취소 시 건물 경매 플래그 해제
	if orderType == string(TradeOrderSell) {
		_, err = tx.Exec(ctx,
			"UPDATE buildings SET is_auctioning = false WHERE id = $1",
			buildingID,
		)
		if err != nil {
			return fmt.Errorf("cancel order reset auctioning: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("cancel order commit: %w", err)
	}
	return nil
}

// ── 만료 처리 ──

// ProcessExpiredOrders는 유효기간이 지난 활성 주문을 만료 처리한다.
// 매도 주문 만료 시 건물 is_auctioning=false 복원. 처리된 주문 수를 반환한다.
func (te *TradeExchange) ProcessExpiredOrders(ctx context.Context) (int, error) {
	tx, err := te.pg.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("expire orders begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 만료된 매도 주문의 건물 ID 수집 (is_auctioning 복원용)
	rows, err := tx.Query(ctx,
		"SELECT building_id FROM trade_orders WHERE status = 'active' AND order_type = 'sell' AND expires_at <= NOW()",
	)
	if err != nil {
		return 0, fmt.Errorf("expire orders query sell: %w", err)
	}
	var buildingIDs []string
	for rows.Next() {
		var bid string
		if err := rows.Scan(&bid); err != nil {
			rows.Close()
			return 0, fmt.Errorf("expire orders scan building_id: %w", err)
		}
		buildingIDs = append(buildingIDs, bid)
	}
	rows.Close()

	// 건물 is_auctioning=false 복원
	for _, bid := range buildingIDs {
		_, err = tx.Exec(ctx,
			"UPDATE buildings SET is_auctioning = false WHERE id = $1",
			bid,
		)
		if err != nil {
			return 0, fmt.Errorf("expire orders reset auctioning %s: %w", bid, err)
		}
	}

	// 일괄 만료 처리
	tag, err := tx.Exec(ctx,
		"UPDATE trade_orders SET status = 'expired' WHERE status = 'active' AND expires_at <= NOW()",
	)
	if err != nil {
		return 0, fmt.Errorf("expire orders update: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("expire orders commit: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// ── 조회 ──

// GetActiveOrdersForBuilding은 특정 건물의 활성 주문 목록을 반환한다.
func (te *TradeExchange) GetActiveOrdersForBuilding(ctx context.Context, buildingID string) ([]*TradeOrder, error) {
	rows, err := te.pg.Query(ctx,
		`SELECT id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at, matched_with
		 FROM trade_orders
		 WHERE building_id = $1 AND status = 'active'
		 ORDER BY order_type, price ASC, created_at ASC`,
		buildingID,
	)
	if err != nil {
		return nil, fmt.Errorf("get active orders for building: %w", err)
	}
	return te.scanOrders(rows)
}

// GetPlayerOrders는 플레이어의 전체 주문 목록을 반환한다 (활성 + 최근 체결).
func (te *TradeExchange) GetPlayerOrders(ctx context.Context, playerID string) ([]*TradeOrder, error) {
	rows, err := te.pg.Query(ctx,
		`SELECT id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at, matched_with
		 FROM trade_orders
		 WHERE player_id = $1
		 ORDER BY created_at DESC
		 LIMIT 50`,
		playerID,
	)
	if err != nil {
		return nil, fmt.Errorf("get player orders: %w", err)
	}
	return te.scanOrders(rows)
}

// GetRecentTrades는 최근 체결된 거래를 조회한다.
func (te *TradeExchange) GetRecentTrades(ctx context.Context, limit int) ([]*TradeOrder, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := te.pg.Query(ctx,
		`SELECT id, building_id, order_type, player_id, player_name, price, status, created_at, expires_at, matched_with
		 FROM trade_orders
		 WHERE status = 'matched'
		 ORDER BY created_at DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("get recent trades: %w", err)
	}
	return te.scanOrders(rows)
}

// ── 주기적 매칭 루프 ──

// StartMatchingLoop는 30초마다 활성 주문을 매칭하고 만료 주문을 처리한다.
// ctx가 취소되면 루프가 종료된다.
func (te *TradeExchange) StartMatchingLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	slog.Info("[TradeExchange] matching loop started (interval=30s)")

	for {
		select {
		case <-ctx.Done():
			slog.Info("[TradeExchange] matching loop stopped")
			return
		case <-ticker.C:
			te.runMatchCycle(ctx)
		}
	}
}

// runMatchCycle은 한 번의 매칭 사이클을 실행한다.
func (te *TradeExchange) runMatchCycle(ctx context.Context) {
	// 1. 만료 처리
	expired, err := te.ProcessExpiredOrders(ctx)
	if err != nil {
		slog.Error("[TradeExchange] expire orders failed", "error", err)
	} else if expired > 0 {
		slog.Info("[TradeExchange] expired orders", "count", expired)
	}

	// 2. 활성 매도 주문이 있는 건물 목록 조회
	rows, err := te.pg.Query(ctx,
		"SELECT DISTINCT building_id FROM trade_orders WHERE status = 'active' AND order_type = 'sell'",
	)
	if err != nil {
		slog.Error("[TradeExchange] query active buildings failed", "error", err)
		return
	}
	defer rows.Close()

	var buildingIDs []string
	for rows.Next() {
		var bid string
		if err := rows.Scan(&bid); err != nil {
			slog.Error("[TradeExchange] scan building_id failed", "error", err)
			continue
		}
		buildingIDs = append(buildingIDs, bid)
	}

	// 3. 건물별 매칭 시도
	for _, bid := range buildingIDs {
		match, err := te.MatchOrders(ctx, bid)
		if err != nil {
			slog.Error("[TradeExchange] match failed", "building_id", bid, "error", err)
			continue
		}
		if match != nil {
			slog.Info("[TradeExchange] trade matched",
				"building_id", bid,
				"seller", match.SellOrder.PlayerID,
				"buyer", match.BuyOrder.PlayerID,
				"price", match.FinalPrice,
				"seller_net", match.SellerNet,
				"buyer_total", match.BuyerTotal,
			)
		}
	}
}

// ── 내부 헬퍼 ──

// scanOrder는 단일 pgx Row를 TradeOrder로 스캔한다.
func (te *TradeExchange) scanOrder(row pgx.Row) (*TradeOrder, error) {
	o := &TradeOrder{}
	var orderType string
	var status string
	err := row.Scan(
		&o.ID, &o.BuildingID, &orderType, &o.PlayerID, &o.PlayerName,
		&o.Price, &status, &o.CreatedAt, &o.ExpiresAt, &o.MatchedWith,
	)
	if err != nil {
		return nil, err
	}
	o.OrderType = TradeOrderType(orderType)
	o.Status = TradeOrderStatus(status)
	return o, nil
}

// scanOrders는 pgx.Rows를 []*TradeOrder 슬라이스로 스캔한다.
func (te *TradeExchange) scanOrders(rows pgx.Rows) ([]*TradeOrder, error) {
	defer rows.Close()
	var result []*TradeOrder
	for rows.Next() {
		o := &TradeOrder{}
		var orderType string
		var status string
		err := rows.Scan(
			&o.ID, &o.BuildingID, &orderType, &o.PlayerID, &o.PlayerName,
			&o.Price, &status, &o.CreatedAt, &o.ExpiresAt, &o.MatchedWith,
		)
		if err != nil {
			return nil, fmt.Errorf("scan trade order row: %w", err)
		}
		o.OrderType = TradeOrderType(orderType)
		o.Status = TradeOrderStatus(status)
		result = append(result, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan trade orders iteration: %w", err)
	}
	return result, nil
}
