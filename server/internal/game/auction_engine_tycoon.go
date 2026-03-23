package game

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonAuctionEngine: 타이쿤 경매 생성/입찰/정산/NPC AI
//
// TS AuctionEngine의 인메모리 Map → Railway PostgreSQL 재구현.
// - auctions 테이블: 경매 CRUD
// - auction_bids 테이블: 입찰 이력
// - NPC 타이머: time.AfterFunc (인스턴스별 관리)
// ============================================================

// ── 경매 타입/상태 열거 ──

// TycoonAuctionType은 경매 유형
type TycoonAuctionType string

const (
	AuctionRegular    TycoonAuctionType = "regular"
	AuctionPremium    TycoonAuctionType = "premium"
	AuctionLegendary  TycoonAuctionType = "legendary"
	AuctionPlayerSell TycoonAuctionType = "player_sell"
	AuctionFlashSale  TycoonAuctionType = "flash_sale"
)

// TycoonAuctionStatus는 경매 상태
type TycoonAuctionStatus string

const (
	AuctionStatusActive    TycoonAuctionStatus = "active"
	AuctionStatusEnded     TycoonAuctionStatus = "ended"
	AuctionStatusFailed    TycoonAuctionStatus = "failed"
	AuctionStatusCancelled TycoonAuctionStatus = "cancelled"
)

// ── 경매 상수 ──

const (
	AuctionDurationRegular    = 4 * time.Hour
	AuctionDurationPremium    = 12 * time.Hour
	AuctionDurationLegendary  = 24 * time.Hour
	AuctionDurationFlash      = 1 * time.Hour
	AuctionMinBidIncrementPct = 0.05
	AuctionAntiSnipeWindow    = 30 * time.Second
	AuctionAntiSnipeExtension = 30 * time.Second
	AuctionMaxAntiSnipe       = 3
	AuctionBuyerFeePct        = 0.05
	AuctionSellerFeePct       = 0.10
)

// npcCountByType은 경매 유형별 NPC 수 범위
var npcCountByType = map[TycoonAuctionType][2]int{
	AuctionRegular:    {2, 5},
	AuctionPremium:    {5, 8},
	AuctionLegendary:  {8, 12},
	AuctionPlayerSell: {2, 5},
	AuctionFlashSale:  {0, 0},
}

// npcMaxBidPct은 경매 유형별 NPC 입찰 상한 (fair value 대비)
var npcMaxBidPct = map[TycoonAuctionType][2]float64{
	AuctionRegular:    {0.60, 0.80},
	AuctionPremium:    {0.85, 0.90},
	AuctionLegendary:  {0.90, 0.95},
	AuctionPlayerSell: {0.60, 0.80},
	AuctionFlashSale:  {0.0, 0.0},
}

// npcNames은 NPC 이름 풀
var npcNames = []string{
	"NPC_Warren", "NPC_Soros", "NPC_Lynch", "NPC_Buffett",
	"NPC_Dalio", "NPC_Ackman", "NPC_Icahn", "NPC_Tudor",
	"NPC_Citadel", "NPC_Renaissance", "NPC_Bridgewater",
	"NPC_BlackRock", "NPC_Vanguard", "NPC_Fidelity",
}

// ── DB 엔티티 ──

// TycoonAuction은 auctions 테이블 매핑
type TycoonAuction struct {
	ID                  string              `json:"id"`
	BuildingID          string              `json:"buildingId"`
	AuctionType         TycoonAuctionType   `json:"auctionType"`
	Status              TycoonAuctionStatus `json:"status"`
	StartingBid         int64               `json:"startingBid"`
	CurrentBid          int64               `json:"currentBid"`
	BidIncrement        int64               `json:"bidIncrement"`
	WinnerID            *string             `json:"winnerId"`
	WinnerName          *string             `json:"winnerName"`
	SellerID            *string             `json:"sellerId"`
	StartAt             time.Time           `json:"startAt"`
	EndAt               time.Time           `json:"endAt"`
	SnipeExtensionCount int                 `json:"snipeExtensionCount"`
}

// TycoonBid는 auction_bids 테이블 매핑
type TycoonBid struct {
	ID         string    `json:"id"`
	AuctionID  string    `json:"auctionId"`
	BidderID   string    `json:"bidderId"`
	BidderName string    `json:"bidderName"`
	Amount     int64     `json:"amount"`
	IsNPC      bool      `json:"isNpc"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ── 엔진 ──

// TycoonAuctionEngine은 pgxpool 기반 경매 엔진
type TycoonAuctionEngine struct {
	pg *pgxpool.Pool
	bm *TycoonBuildingManager

	// NPC 타이머 관리 (auctionID → []*time.Timer)
	mu        sync.Mutex
	npcTimers map[string][]*time.Timer
}

// NewTycoonAuctionEngine은 새 TycoonAuctionEngine을 생성한다.
func NewTycoonAuctionEngine(pg *pgxpool.Pool, bm *TycoonBuildingManager) *TycoonAuctionEngine {
	return &TycoonAuctionEngine{
		pg:        pg,
		bm:        bm,
		npcTimers: make(map[string][]*time.Timer),
	}
}

// ── 내부 헬퍼 ──

// auctionSelectCols는 auctions 테이블 SELECT 컬럼
const auctionSelectCols = `id, building_id, auction_type, status, starting_bid,
	current_bid, bid_increment, winner_id, winner_name, seller_id,
	start_at, end_at, snipe_extension_count`

// scanAuction은 pgx Row를 TycoonAuction으로 스캔한다.
func scanAuction(row pgx.Row) (*TycoonAuction, error) {
	a := &TycoonAuction{}
	err := row.Scan(
		&a.ID, &a.BuildingID, &a.AuctionType, &a.Status,
		&a.StartingBid, &a.CurrentBid, &a.BidIncrement,
		&a.WinnerID, &a.WinnerName, &a.SellerID,
		&a.StartAt, &a.EndAt, &a.SnipeExtensionCount,
	)
	if err != nil {
		return nil, fmt.Errorf("scan auction: %w", err)
	}
	return a, nil
}

// scanAuctions은 pgx.Rows를 []*TycoonAuction으로 스캔한다.
func scanAuctions(rows pgx.Rows) ([]*TycoonAuction, error) {
	defer rows.Close()
	var result []*TycoonAuction
	for rows.Next() {
		a := &TycoonAuction{}
		err := rows.Scan(
			&a.ID, &a.BuildingID, &a.AuctionType, &a.Status,
			&a.StartingBid, &a.CurrentBid, &a.BidIncrement,
			&a.WinnerID, &a.WinnerName, &a.SellerID,
			&a.StartAt, &a.EndAt, &a.SnipeExtensionCount,
		)
		if err != nil {
			return nil, fmt.Errorf("scan auctions row: %w", err)
		}
		result = append(result, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan auctions iteration: %w", err)
	}
	return result, nil
}

// durationByType은 경매 유형별 기본 지속 시간을 반환한다.
func durationByType(t TycoonAuctionType) time.Duration {
	switch t {
	case AuctionPremium:
		return AuctionDurationPremium
	case AuctionLegendary:
		return AuctionDurationLegendary
	case AuctionFlashSale:
		return AuctionDurationFlash
	default:
		return AuctionDurationRegular
	}
}

// randRange은 [min, max) 범위의 float64를 반환한다.
func randRange(min, max float64) float64 {
	return min + rand.Float64()*(max-min)
}

// randInt은 [min, max] 범위의 int를 반환한다.
func randInt(min, max int) int {
	if min >= max {
		return min
	}
	return min + rand.Intn(max-min+1)
}

// pickRandomName은 used에 없는 NPC 이름을 하나 반환한다.
func pickRandomName(used map[string]bool) string {
	for i := 0; i < 50; i++ {
		name := npcNames[rand.Intn(len(npcNames))]
		if !used[name] {
			return name
		}
	}
	// 모두 사용됨 — 인덱스 접미사 추가
	return fmt.Sprintf("NPC_Agent%d", rand.Intn(1000))
}

// ── 경매 생성 ──

// CreateAuction은 건물에 대한 경매를 생성한다.
// 1. 건물 존재 + 경매 중 아님 검증
// 2. auctions INSERT
// 3. buildings.is_auctioning = true
// 4. NPC 입찰 스케줄
func (e *TycoonAuctionEngine) CreateAuction(
	ctx context.Context,
	buildingID string,
	auctionType TycoonAuctionType,
	startingBid int64,
	sellerID *string,
) (*TycoonAuction, error) {
	// 건물 조회 + 검증
	building, err := e.bm.GetBuildingByID(ctx, buildingID)
	if err != nil {
		return nil, fmt.Errorf("create auction — building lookup: %w", err)
	}
	if building.IsAuctioning {
		return nil, fmt.Errorf("building %s is already auctioning", buildingID)
	}

	now := time.Now().UTC()
	dur := durationByType(auctionType)
	endAt := now.Add(dur)
	increment := int64(math.Max(1, math.Round(float64(startingBid)*AuctionMinBidIncrementPct)))
	auctionID := fmt.Sprintf("auction-%d-%s", now.UnixMilli(), buildingID[:8])

	// INSERT auction
	_, err = e.pg.Exec(ctx, `
		INSERT INTO auctions (
			id, building_id, auction_type, status, starting_bid,
			current_bid, bid_increment, winner_id, winner_name, seller_id,
			start_at, end_at, snipe_extension_count
		) VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10, $11,$12,$13)`,
		auctionID, buildingID, string(auctionType), string(AuctionStatusActive), startingBid,
		int64(0), increment, nil, nil, sellerID,
		now, endAt, 0,
	)
	if err != nil {
		return nil, fmt.Errorf("create auction — insert: %w", err)
	}

	// 건물 경매 플래그 ON
	if err := e.bm.SetAuctioning(ctx, buildingID, true); err != nil {
		return nil, fmt.Errorf("create auction — set auctioning: %w", err)
	}

	auction := &TycoonAuction{
		ID:           auctionID,
		BuildingID:   buildingID,
		AuctionType:  auctionType,
		Status:       AuctionStatusActive,
		StartingBid:  startingBid,
		CurrentBid:   0,
		BidIncrement: increment,
		SellerID:     sellerID,
		StartAt:      now,
		EndAt:        endAt,
	}

	// NPC 입찰 스케줄링 (비동기)
	go e.GenerateNpcBids(ctx, auction, building)

	return auction, nil
}

// ── 입찰 ──

// PlaceBid는 PG 트랜잭션으로 입찰을 처리한다.
// 1. SELECT auction FOR UPDATE (active + 종료시간 검증)
// 2. 최소 입찰액 검증
// 3. INSERT auction_bids
// 4. UPDATE auctions (current_bid, winner, bid_increment)
// 5. Anti-snipe 연장 (마지막 30초 → +30초, 최대 3회)
func (e *TycoonAuctionEngine) PlaceBid(
	ctx context.Context,
	auctionID, bidderID, bidderName string,
	amount int64,
	isNPC bool,
) (*TycoonBid, error) {
	var bid *TycoonBid

	err := pgx.BeginTxFunc(ctx, e.pg, pgx.TxOptions{}, func(tx pgx.Tx) error {
		// 1. SELECT FOR UPDATE
		a := &TycoonAuction{}
		err := tx.QueryRow(ctx, fmt.Sprintf(
			"SELECT %s FROM auctions WHERE id = $1 FOR UPDATE", auctionSelectCols,
		), auctionID).Scan(
			&a.ID, &a.BuildingID, &a.AuctionType, &a.Status,
			&a.StartingBid, &a.CurrentBid, &a.BidIncrement,
			&a.WinnerID, &a.WinnerName, &a.SellerID,
			&a.StartAt, &a.EndAt, &a.SnipeExtensionCount,
		)
		if err != nil {
			return fmt.Errorf("lock auction: %w", err)
		}

		if a.Status != AuctionStatusActive {
			return fmt.Errorf("auction %s is not active (status=%s)", auctionID, a.Status)
		}
		now := time.Now().UTC()
		if now.After(a.EndAt) {
			return fmt.Errorf("auction %s has ended", auctionID)
		}

		// 2. 최소 입찰액 검증
		var minBid int64
		if a.CurrentBid > 0 {
			minBid = a.CurrentBid + a.BidIncrement
		} else {
			minBid = a.StartingBid
		}
		if amount < minBid {
			return fmt.Errorf("minimum bid is %d (current=%d + increment=%d)", minBid, a.CurrentBid, a.BidIncrement)
		}

		// 3. INSERT bid
		bidID := fmt.Sprintf("bid-%d-%s", now.UnixMilli(), bidderID[:min(8, len(bidderID))])
		_, err = tx.Exec(ctx, `
			INSERT INTO auction_bids (id, auction_id, bidder_id, bidder_name, amount, is_npc, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			bidID, auctionID, bidderID, bidderName, amount, isNPC, now,
		)
		if err != nil {
			return fmt.Errorf("insert bid: %w", err)
		}

		// 4. UPDATE auction
		newIncrement := int64(math.Max(1, math.Round(float64(amount)*AuctionMinBidIncrementPct)))
		endAt := a.EndAt
		snipeCount := a.SnipeExtensionCount

		// 5. Anti-snipe
		timeToEnd := a.EndAt.Sub(now)
		if timeToEnd <= AuctionAntiSnipeWindow && snipeCount < AuctionMaxAntiSnipe {
			endAt = endAt.Add(AuctionAntiSnipeExtension)
			snipeCount++
		}

		_, err = tx.Exec(ctx, `
			UPDATE auctions SET
				current_bid = $1, winner_id = $2, winner_name = $3,
				bid_increment = $4, end_at = $5, snipe_extension_count = $6
			WHERE id = $7`,
			amount, bidderID, bidderName,
			newIncrement, endAt, snipeCount,
			auctionID,
		)
		if err != nil {
			return fmt.Errorf("update auction: %w", err)
		}

		bid = &TycoonBid{
			ID:         bidID,
			AuctionID:  auctionID,
			BidderID:   bidderID,
			BidderName: bidderName,
			Amount:     amount,
			IsNPC:      isNPC,
			CreatedAt:  now,
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return bid, nil
}

// ── 정산 ──

// SettleAuction은 경매를 정산한다.
// 낙찰자 있으면 → 소유권 이전 + 수수료 차감 + status=ended
// 낙찰자 없으면 → status=failed
// 항상 buildings.is_auctioning = false
func (e *TycoonAuctionEngine) SettleAuction(ctx context.Context, auctionID string) error {
	// 경매 조회
	a, err := e.GetAuctionByID(ctx, auctionID)
	if err != nil {
		return fmt.Errorf("settle — get auction: %w", err)
	}
	if a.Status != AuctionStatusActive {
		return fmt.Errorf("auction %s is not active (status=%s)", auctionID, a.Status)
	}

	// NPC 타이머 정리
	e.clearNpcTimers(auctionID)

	// 유찰 체크
	if a.WinnerID == nil || a.CurrentBid <= 0 {
		_, err = e.pg.Exec(ctx,
			"UPDATE auctions SET status = $1 WHERE id = $2",
			string(AuctionStatusFailed), auctionID,
		)
		if err != nil {
			return fmt.Errorf("settle — mark failed: %w", err)
		}
		return e.bm.SetAuctioning(ctx, a.BuildingID, false)
	}

	// 낙찰 — 소유권 이전
	winnerName := "Unknown"
	if a.WinnerName != nil {
		winnerName = *a.WinnerName
	}
	if err := e.bm.TransferOwnership(ctx, a.BuildingID, *a.WinnerID, winnerName, a.CurrentBid); err != nil {
		return fmt.Errorf("settle — transfer: %w", err)
	}

	// 경매 완료
	_, err = e.pg.Exec(ctx,
		"UPDATE auctions SET status = $1 WHERE id = $2",
		string(AuctionStatusEnded), auctionID,
	)
	if err != nil {
		return fmt.Errorf("settle — mark ended: %w", err)
	}

	return e.bm.SetAuctioning(ctx, a.BuildingID, false)
}

// ProcessExpiredAuctions은 종료 시간이 지난 모든 활성 경매를 정산한다.
// 주기적으로 호출 (예: 1분 간격 ticker). 정산된 경매 수를 반환.
func (e *TycoonAuctionEngine) ProcessExpiredAuctions(ctx context.Context) (int, error) {
	rows, err := e.pg.Query(ctx, fmt.Sprintf(
		"SELECT %s FROM auctions WHERE status = 'active' AND end_at < NOW()", auctionSelectCols,
	))
	if err != nil {
		return 0, fmt.Errorf("process expired — query: %w", err)
	}
	expired, err := scanAuctions(rows)
	if err != nil {
		return 0, fmt.Errorf("process expired — scan: %w", err)
	}

	settled := 0
	for _, a := range expired {
		if err := e.SettleAuction(ctx, a.ID); err != nil {
			// 개별 정산 실패는 로그 후 계속
			fmt.Printf("[AuctionEngine] settle %s failed: %v\n", a.ID, err)
			continue
		}
		settled++
	}
	return settled, nil
}

// ── 조회 ──

// GetActiveAuctions은 모든 활성 경매를 종료시간 ASC로 반환한다.
func (e *TycoonAuctionEngine) GetActiveAuctions(ctx context.Context) ([]*TycoonAuction, error) {
	rows, err := e.pg.Query(ctx, fmt.Sprintf(
		"SELECT %s FROM auctions WHERE status = 'active' ORDER BY end_at ASC", auctionSelectCols,
	))
	if err != nil {
		return nil, fmt.Errorf("get active auctions: %w", err)
	}
	return scanAuctions(rows)
}

// GetAuctionByID는 ID로 경매 1건을 조회한다.
func (e *TycoonAuctionEngine) GetAuctionByID(ctx context.Context, id string) (*TycoonAuction, error) {
	row := e.pg.QueryRow(ctx, fmt.Sprintf(
		"SELECT %s FROM auctions WHERE id = $1", auctionSelectCols,
	), id)
	a, err := scanAuction(row)
	if err != nil {
		return nil, fmt.Errorf("get auction by id %s: %w", id, err)
	}
	return a, nil
}

// GetBidHistory는 경매의 입찰 이력을 시간순으로 반환한다.
func (e *TycoonAuctionEngine) GetBidHistory(ctx context.Context, auctionID string) ([]*TycoonBid, error) {
	rows, err := e.pg.Query(ctx, `
		SELECT id, auction_id, bidder_id, bidder_name, amount, is_npc, created_at
		FROM auction_bids WHERE auction_id = $1 ORDER BY created_at ASC`,
		auctionID,
	)
	if err != nil {
		return nil, fmt.Errorf("get bid history: %w", err)
	}
	defer rows.Close()

	var bids []*TycoonBid
	for rows.Next() {
		b := &TycoonBid{}
		if err := rows.Scan(&b.ID, &b.AuctionID, &b.BidderID, &b.BidderName, &b.Amount, &b.IsNPC, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan bid: %w", err)
		}
		bids = append(bids, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("bid rows iteration: %w", err)
	}
	return bids, nil
}

// ── NPC 입찰 (서버 사이드) ──

// GenerateNpcBids는 fair value 기반 NPC를 생성하고
// time.AfterFunc로 경매 시간의 30~80% 시점에 자동 입찰을 스케줄한다.
func (e *TycoonAuctionEngine) GenerateNpcBids(ctx context.Context, auction *TycoonAuction, building *TycoonBuilding) {
	fairValue := e.bm.CalculateFairValue(building)

	// 경매 유형별 NPC 수 범위
	countRange, ok := npcCountByType[auction.AuctionType]
	if !ok {
		countRange = [2]int{2, 5}
	}
	if countRange[1] == 0 {
		return // Flash Sale은 NPC 없음
	}

	bidPctRange, ok := npcMaxBidPct[auction.AuctionType]
	if !ok {
		bidPctRange = [2]float64{0.60, 0.80}
	}

	npcCount := randInt(countRange[0], countRange[1])
	duration := auction.EndAt.Sub(auction.StartAt)

	usedNames := make(map[string]bool)
	var timers []*time.Timer

	for i := 0; i < npcCount; i++ {
		name := pickRandomName(usedNames)
		usedNames[name] = true

		// 개별 NPC 입찰 상한선
		maxBidPct := randRange(bidPctRange[0], bidPctRange[1])
		npcMaxBid := int64(math.Round(float64(fairValue) * maxBidPct))

		// 입찰 타이밍: 경매 시간의 30~80%
		bidTiming := randRange(0.30, 0.80)
		delay := time.Duration(float64(duration) * bidTiming)

		npcID := fmt.Sprintf("npc-%d-%s", time.Now().UnixMilli(), name)

		// 클로저 캡처
		capturedID := npcID
		capturedName := name
		capturedMax := npcMaxBid
		capturedAuctionID := auction.ID
		capturedStartingBid := auction.StartingBid

		timer := time.AfterFunc(delay, func() {
			e.executeNpcBid(capturedAuctionID, capturedID, capturedName, capturedMax, capturedStartingBid)
		})
		timers = append(timers, timer)
	}

	e.mu.Lock()
	e.npcTimers[auction.ID] = timers
	e.mu.Unlock()
}

// executeNpcBid는 NPC 자동 입찰을 실행하고, 상한선 미만이면 재입찰을 스케줄한다.
func (e *TycoonAuctionEngine) executeNpcBid(auctionID, npcID, npcName string, maxBid, startingBid int64) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 현재 경매 상태 조회
	a, err := e.GetAuctionByID(ctx, auctionID)
	if err != nil || a.Status != AuctionStatusActive {
		return
	}
	if time.Now().UTC().After(a.EndAt) {
		return
	}
	// 자기 경쟁 방지
	if a.WinnerID != nil && *a.WinnerID == npcID {
		return
	}

	// 최소 입찰 금액
	var minBid int64
	if a.CurrentBid > 0 {
		minBid = a.CurrentBid + a.BidIncrement
	} else {
		minBid = a.StartingBid
	}
	if minBid > maxBid {
		return
	}

	// 입찰 금액: minBid ~ min(maxBid, minBid + increment*2)
	bidAmount := minBid + int64(randRange(0, float64(a.BidIncrement*2)))
	if bidAmount > maxBid {
		bidAmount = maxBid
	}

	_, err = e.PlaceBid(ctx, auctionID, npcID, npcName, bidAmount, true)
	if err != nil {
		return
	}

	// 상한선 미만이면 30~120초 뒤 재입찰 스케줄
	if bidAmount < maxBid {
		retryDelay := time.Duration(randRange(30, 120)) * time.Second
		remaining := time.Until(a.EndAt)
		if retryDelay < remaining {
			timer := time.AfterFunc(retryDelay, func() {
				e.executeNpcBid(auctionID, npcID, npcName, maxBid, startingBid)
			})
			e.mu.Lock()
			e.npcTimers[auctionID] = append(e.npcTimers[auctionID], timer)
			e.mu.Unlock()
		}
	}
}

// clearNpcTimers는 경매의 NPC 타이머를 정리한다.
func (e *TycoonAuctionEngine) clearNpcTimers(auctionID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	timers, ok := e.npcTimers[auctionID]
	if !ok {
		return
	}
	for _, t := range timers {
		t.Stop()
	}
	delete(e.npcTimers, auctionID)
}
