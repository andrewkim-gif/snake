package game

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TycoonManager는 모든 타이쿤 엔진을 통합 관리한다.
// main.go에서 한 번에 초기화/시작/종료할 수 있다.
type TycoonManager struct {
	Buildings *TycoonBuildingManager
	Territory *TycoonTerritoryEngine
	Auction   *TycoonAuctionEngine
	Income    *TycoonIncomeCalculator
	Military  *MilitarySystem
	Battle    *BattleSimulator
	Trade     *TradeExchange
	Merge     *TycoonMergeSystem
	Diplomacy *TycoonDiplomacySystem

	cancel context.CancelFunc
}

// NewTycoonManager는 모든 엔진을 초기화한다.
// 의존성 순서: bm → (auction, income, trade, merge), territory → income, military → merge
func NewTycoonManager(pg *pgxpool.Pool) *TycoonManager {
	bm := NewTycoonBuildingManager(pg)
	territory := NewTycoonTerritoryEngine(pg)
	military := NewMilitarySystem(pg)

	return &TycoonManager{
		Buildings: bm,
		Territory: territory,
		Auction:   NewTycoonAuctionEngine(pg, bm),
		Income:    NewTycoonIncomeCalculator(pg, bm, territory),
		Military:  military,
		Battle:    NewBattleSimulator(pg),
		Trade:     NewTradeExchange(pg, bm),
		Merge:     NewTycoonMergeSystem(pg, bm, military),
		Diplomacy: NewTycoonDiplomacySystem(pg),
	}
}

// Start는 모든 백그라운드 루프를 시작한다.
func (tm *TycoonManager) Start(ctx context.Context) {
	ctx, tm.cancel = context.WithCancel(ctx)

	slog.Info("Tycoon engines starting...")

	// 백그라운드 루프들
	go tm.Territory.StartPeriodicRefresh(ctx) // 60초 영토 갱신
	go tm.Income.StartPeriodicSettlement(ctx) // 1시간 수익 정산
	go tm.Military.StartArrivalChecker(ctx)   // 30초 도착 체크
	go tm.Trade.StartMatchingLoop(ctx)        // 30초 거래 매칭
	go tm.Diplomacy.StartWarProcessor(ctx)    // 1분 전쟁 처리

	slog.Info("Tycoon engines started", "engines", 9)
}

// Stop은 모든 백그라운드 루프를 중지한다.
func (tm *TycoonManager) Stop() {
	if tm.cancel != nil {
		tm.cancel()
		slog.Info("Tycoon engines stopped")
	}
}
