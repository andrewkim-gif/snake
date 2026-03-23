package game

import (
	"context"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonBuildingManager: 타이쿤 건물 소유/거래/가치 계산 매니저
//
// Railway PostgreSQL(pgxpool)을 통해 건물 CRUD, 소유권 이전,
// 경매 상태 관리, 수익/가치 계산을 수행한다.
//
// 핵심 기능:
//   - 건물 조회 (ID, 지역, 소유자, 구매 가능, 경매 가능)
//   - 소유권 관리 (구매, 이전, 해제) — PG 트랜잭션 보장
//   - 가치 계산 (공정가치, 시간당 수익, 고정가격) — 순수 함수
//   - 경매 상태 토글
// ============================================================

// ── 등급별 수익/가치 상수 ──

// TycoonRarityIncomeMult는 등급별 수익 배율
var TycoonRarityIncomeMult = map[string]float64{
	"common": 1.0, "uncommon": 1.5, "rare": 2.5, "epic": 5.0, "legendary": 10.0,
}

// TycoonLevelMult는 레벨별 수익 배율 (Level 1~5)
var TycoonLevelMult = []float64{1.0, 1.3, 1.7, 2.2, 3.0}

// TycoonRarityValueMult는 등급별 가치 배율
var TycoonRarityValueMult = map[string]float64{
	"common": 1.0, "uncommon": 2.0, "rare": 5.0, "epic": 15.0, "legendary": 50.0,
}

// ── 건물 구조체 ──

// TycoonBuilding은 타이쿤 모드의 건물 엔티티
type TycoonBuilding struct {
	ID               string
	Name             string
	NameKo           string
	RegionCode       string
	Rarity           string
	BaseIncome       int
	Level            int
	OwnerID          *string
	OwnerName        *string
	IsAuctioning     bool
	DefensePower     int
	GarrisonCapacity int
	VisualHeight     int
	VisualWidth      int
	VisualDepth      int
	PositionX        float64
	PositionZ        float64
}

// ── 컬럼 목록 ──

// buildingSelectCols는 buildings 테이블 SELECT 시 사용하는 컬럼 목록
const buildingSelectCols = `id, name, name_ko, region_code, rarity, base_income, level,
	owner_id, owner_name, is_auctioning, defense_power, garrison_capacity,
	visual_height, visual_width, visual_depth, position_x, position_z`

// ── 매니저 ──

// TycoonBuildingManager는 pgxpool 기반 건물 관리 매니저
type TycoonBuildingManager struct {
	pg *pgxpool.Pool
}

// NewTycoonBuildingManager는 새 TycoonBuildingManager를 생성한다.
func NewTycoonBuildingManager(pg *pgxpool.Pool) *TycoonBuildingManager {
	return &TycoonBuildingManager{pg: pg}
}

// ── 내부 헬퍼 ──

// scanBuilding은 pgx Row를 TycoonBuilding으로 스캔한다.
func scanBuilding(row pgx.Row) (*TycoonBuilding, error) {
	b := &TycoonBuilding{}
	err := row.Scan(
		&b.ID, &b.Name, &b.NameKo, &b.RegionCode, &b.Rarity,
		&b.BaseIncome, &b.Level, &b.OwnerID, &b.OwnerName,
		&b.IsAuctioning, &b.DefensePower, &b.GarrisonCapacity,
		&b.VisualHeight, &b.VisualWidth, &b.VisualDepth,
		&b.PositionX, &b.PositionZ,
	)
	if err != nil {
		return nil, fmt.Errorf("scan building: %w", err)
	}
	return b, nil
}

// scanBuildings는 pgx.Rows를 []*TycoonBuilding 슬라이스로 스캔한다.
func scanBuildings(rows pgx.Rows) ([]*TycoonBuilding, error) {
	defer rows.Close()
	var result []*TycoonBuilding
	for rows.Next() {
		b := &TycoonBuilding{}
		err := rows.Scan(
			&b.ID, &b.Name, &b.NameKo, &b.RegionCode, &b.Rarity,
			&b.BaseIncome, &b.Level, &b.OwnerID, &b.OwnerName,
			&b.IsAuctioning, &b.DefensePower, &b.GarrisonCapacity,
			&b.VisualHeight, &b.VisualWidth, &b.VisualDepth,
			&b.PositionX, &b.PositionZ,
		)
		if err != nil {
			return nil, fmt.Errorf("scan buildings row: %w", err)
		}
		result = append(result, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan buildings iteration: %w", err)
	}
	return result, nil
}

// ── 조회 메서드 ──

// GetBuildingByID는 ID로 건물 1개를 조회한다.
func (m *TycoonBuildingManager) GetBuildingByID(ctx context.Context, id string) (*TycoonBuilding, error) {
	query := fmt.Sprintf("SELECT %s FROM buildings WHERE id = $1", buildingSelectCols)
	row := m.pg.QueryRow(ctx, query, id)
	b, err := scanBuilding(row)
	if err != nil {
		return nil, fmt.Errorf("get building by id %s: %w", id, err)
	}
	return b, nil
}

// GetBuildingsByRegion은 특정 지역의 모든 건물을 조회한다.
func (m *TycoonBuildingManager) GetBuildingsByRegion(ctx context.Context, regionCode string) ([]*TycoonBuilding, error) {
	query := fmt.Sprintf("SELECT %s FROM buildings WHERE region_code = $1 ORDER BY id", buildingSelectCols)
	rows, err := m.pg.Query(ctx, query, regionCode)
	if err != nil {
		return nil, fmt.Errorf("get buildings by region %s: %w", regionCode, err)
	}
	return scanBuildings(rows)
}

// GetBuildingsByOwner는 특정 소유자의 모든 건물을 조회한다.
func (m *TycoonBuildingManager) GetBuildingsByOwner(ctx context.Context, ownerID string) ([]*TycoonBuilding, error) {
	query := fmt.Sprintf("SELECT %s FROM buildings WHERE owner_id = $1 ORDER BY region_code, id", buildingSelectCols)
	rows, err := m.pg.Query(ctx, query, ownerID)
	if err != nil {
		return nil, fmt.Errorf("get buildings by owner %s: %w", ownerID, err)
	}
	return scanBuildings(rows)
}

// GetAvailableForPurchase는 특정 지역에서 구매 가능한 (소유자 없는) 건물을 조회한다.
func (m *TycoonBuildingManager) GetAvailableForPurchase(ctx context.Context, regionCode string) ([]*TycoonBuilding, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM buildings WHERE region_code = $1 AND owner_id IS NULL AND is_auctioning = false ORDER BY rarity, id",
		buildingSelectCols,
	)
	rows, err := m.pg.Query(ctx, query, regionCode)
	if err != nil {
		return nil, fmt.Errorf("get available for purchase in %s: %w", regionCode, err)
	}
	return scanBuildings(rows)
}

// GetAvailableForAuction은 경매 중인 모든 건물을 조회한다.
func (m *TycoonBuildingManager) GetAvailableForAuction(ctx context.Context) ([]*TycoonBuilding, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM buildings WHERE is_auctioning = true ORDER BY rarity DESC, id",
		buildingSelectCols,
	)
	rows, err := m.pg.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("get available for auction: %w", err)
	}
	return scanBuildings(rows)
}

// ── 소유권 관리 ──

// PurchaseBuilding은 PG 트랜잭션으로 건물 구매를 처리한다.
// 잔고 확인 → 건물 소유자 설정 → 잔고 차감 → 거래 기록 삽입을 원자적으로 수행한다.
func (m *TycoonBuildingManager) PurchaseBuilding(ctx context.Context, buildingID, buyerID, buyerName string, price int64) error {
	tx, err := m.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("purchase begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback on defer is safe

	// 1. 잔고 확인 (SELECT FOR UPDATE로 락 획득)
	var balance int64
	err = tx.QueryRow(ctx, "SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", buyerID).Scan(&balance)
	if err != nil {
		return fmt.Errorf("purchase query balance: %w", err)
	}
	if balance < price {
		return fmt.Errorf("insufficient balance: has %d, needs %d", balance, price)
	}

	// 2. 건물 소유자 설정
	tag, err := tx.Exec(ctx,
		"UPDATE buildings SET owner_id = $1, owner_name = $2 WHERE id = $3 AND owner_id IS NULL",
		buyerID, buyerName, buildingID,
	)
	if err != nil {
		return fmt.Errorf("purchase update building: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("building %s is not available for purchase", buildingID)
	}

	// 3. 잔고 차감
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		price, buyerID,
	)
	if err != nil {
		return fmt.Errorf("purchase deduct balance: %w", err)
	}

	// 4. 거래 기록 삽입
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, building_id, description) VALUES ($1, $2, $3, $4, $5)",
		buyerID, "building_purchase", -price, buildingID,
		fmt.Sprintf("Purchased building %s for %d MC", buildingID, price),
	)
	if err != nil {
		return fmt.Errorf("purchase insert transaction: %w", err)
	}

	// 5. 커밋
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("purchase commit: %w", err)
	}
	return nil
}

// TransferOwnership은 건물 소유권을 다른 플레이어에게 이전한다.
// PG 트랜잭션으로 소유자 변경 + 거래 기록을 원자적으로 처리한다.
func (m *TycoonBuildingManager) TransferOwnership(ctx context.Context, buildingID, newOwnerID, newOwnerName string, price int64) error {
	tx, err := m.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("transfer begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 기존 소유자 확인
	var oldOwnerID *string
	err = tx.QueryRow(ctx, "SELECT owner_id FROM buildings WHERE id = $1 FOR UPDATE", buildingID).Scan(&oldOwnerID)
	if err != nil {
		return fmt.Errorf("transfer query building: %w", err)
	}
	if oldOwnerID == nil {
		return fmt.Errorf("building %s has no owner to transfer from", buildingID)
	}

	// 새 구매자 잔고 확인
	var balance int64
	err = tx.QueryRow(ctx, "SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", newOwnerID).Scan(&balance)
	if err != nil {
		return fmt.Errorf("transfer query buyer balance: %w", err)
	}
	if balance < price {
		return fmt.Errorf("insufficient balance: has %d, needs %d", balance, price)
	}

	// 소유자 변경
	_, err = tx.Exec(ctx,
		"UPDATE buildings SET owner_id = $1, owner_name = $2, is_auctioning = false WHERE id = $3",
		newOwnerID, newOwnerName, buildingID,
	)
	if err != nil {
		return fmt.Errorf("transfer update building: %w", err)
	}

	// 구매자 잔고 차감
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		price, newOwnerID,
	)
	if err != nil {
		return fmt.Errorf("transfer deduct buyer balance: %w", err)
	}

	// 판매자 잔고 증가
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance + $1 WHERE id = $2",
		price, *oldOwnerID,
	)
	if err != nil {
		return fmt.Errorf("transfer credit seller balance: %w", err)
	}

	// 거래 기록 (구매자)
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, building_id, description) VALUES ($1, $2, $3, $4, $5)",
		newOwnerID, "building_transfer_buy", -price, buildingID,
		fmt.Sprintf("Bought building %s for %d MC", buildingID, price),
	)
	if err != nil {
		return fmt.Errorf("transfer insert buyer transaction: %w", err)
	}

	// 거래 기록 (판매자)
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, building_id, description) VALUES ($1, $2, $3, $4, $5)",
		*oldOwnerID, "building_transfer_sell", price, buildingID,
		fmt.Sprintf("Sold building %s for %d MC", buildingID, price),
	)
	if err != nil {
		return fmt.Errorf("transfer insert seller transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("transfer commit: %w", err)
	}
	return nil
}

// ReleaseOwnership은 건물 소유권을 해제한다 (무주 상태로 변경).
func (m *TycoonBuildingManager) ReleaseOwnership(ctx context.Context, buildingID string) error {
	tag, err := m.pg.Exec(ctx,
		"UPDATE buildings SET owner_id = NULL, owner_name = NULL, is_auctioning = false WHERE id = $1",
		buildingID,
	)
	if err != nil {
		return fmt.Errorf("release ownership: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("building %s not found", buildingID)
	}
	return nil
}

// ── 가치 계산 (순수 함수, DB 불필요) ──

// CalculateFairValue는 건물의 공정 가치를 계산한다.
// 공식: BaseIncome * RarityValueMult * LevelMult * (1 + DefensePower/100)
func (m *TycoonBuildingManager) CalculateFairValue(b *TycoonBuilding) int64 {
	rarityMult := TycoonRarityValueMult[b.Rarity]
	if rarityMult == 0 {
		rarityMult = 1.0
	}
	levelIdx := b.Level - 1
	if levelIdx < 0 {
		levelIdx = 0
	}
	if levelIdx >= len(TycoonLevelMult) {
		levelIdx = len(TycoonLevelMult) - 1
	}
	levelMult := TycoonLevelMult[levelIdx]
	defenseFactor := 1.0 + float64(b.DefensePower)/100.0

	value := float64(b.BaseIncome) * rarityMult * levelMult * defenseFactor
	return int64(math.Round(value))
}

// CalculateHourlyIncome은 건물의 시간당 수익을 계산한다.
// 공식: BaseIncome * RarityIncomeMult * LevelMult
func (m *TycoonBuildingManager) CalculateHourlyIncome(b *TycoonBuilding) int64 {
	rarityMult := TycoonRarityIncomeMult[b.Rarity]
	if rarityMult == 0 {
		rarityMult = 1.0
	}
	levelIdx := b.Level - 1
	if levelIdx < 0 {
		levelIdx = 0
	}
	if levelIdx >= len(TycoonLevelMult) {
		levelIdx = len(TycoonLevelMult) - 1
	}
	levelMult := TycoonLevelMult[levelIdx]

	income := float64(b.BaseIncome) * rarityMult * levelMult
	return int64(math.Round(income))
}

// CalculateFixedPrice는 건물의 고정 판매 가격을 계산한다.
// 공식: FairValue * 1.2 (20% 마진)
func (m *TycoonBuildingManager) CalculateFixedPrice(b *TycoonBuilding) int64 {
	fairValue := m.CalculateFairValue(b)
	return int64(math.Round(float64(fairValue) * 1.2))
}

// ── 경매 ──

// SetAuctioning은 건물의 경매 상태를 토글한다.
func (m *TycoonBuildingManager) SetAuctioning(ctx context.Context, buildingID string, isAuctioning bool) error {
	tag, err := m.pg.Exec(ctx,
		"UPDATE buildings SET is_auctioning = $1 WHERE id = $2",
		isAuctioning, buildingID,
	)
	if err != nil {
		return fmt.Errorf("set auctioning: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("building %s not found", buildingID)
	}
	return nil
}
