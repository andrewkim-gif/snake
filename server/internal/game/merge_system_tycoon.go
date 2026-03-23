package game

import (
	"context"
	"fmt"
	"math"
	"math/rand"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonMergeSystem: 건물 합병/재개발 + 경제 대시보드 시스템
//
// 합병(Merge): 2~4개 건물을 합병하여 상위 등급 건물 생성
// 재개발(Redevelop): 1개 건물의 등급을 확률 기반 재굴림
// 경제 대시보드: 플레이어 경제 현황 종합 조회
//
// TS MergeSystem 설계를 Go로 포팅.
// ============================================================

// ── 합병/재개발 상수 ──

const (
	// MergeCostRate는 합병 비용: 재료 건물 총 가치의 20%
	MergeCostRate = 0.20
	// MergeSynergyBonus는 같은 구역 합병 보너스 x1.3
	MergeSynergyBonus = 1.3
	// RedevelopCostRate는 재개발 비용: 건물 가치의 15%
	RedevelopCostRate = 0.15
	// MinMergeBuildings는 합병 최소 건물 수
	MinMergeBuildings = 2
	// MaxMergeBuildings는 합병 최대 건물 수
	MaxMergeBuildings = 4
)

// rarityOrder는 등급 순서 (낮은 → 높은)
var rarityOrder = []string{"common", "uncommon", "rare", "epic", "legendary"}

// rarityIndex는 등급 이름 → 인덱스 매핑
var rarityIndex = map[string]int{
	"common": 0, "uncommon": 1, "rare": 2, "epic": 3, "legendary": 4,
}

// ── 합병 결과 미리보기 ──

// MergePreview는 합병 결과 미리보기 구조체
type MergePreview struct {
	InputBuildings []string `json:"input_buildings"`
	ResultRarity   string   `json:"result_rarity"`
	ResultIncome   int      `json:"result_income"`
	MergeCost      int64    `json:"merge_cost"`
	SynergyApplied bool     `json:"synergy_applied"`
	SynergyBonus   float64  `json:"synergy_bonus"`
}

// RedevelopProbability는 재개발 등급 변동 확률
type RedevelopProbability struct {
	UpgradeChance   float64 `json:"upgrade_chance"`
	SameChance      float64 `json:"same_chance"`
	DowngradeChance float64 `json:"downgrade_chance"`
}

// EconomyDashboard는 플레이어 경제 현황 대시보드
type EconomyDashboard struct {
	PlayerID        string `json:"player_id"`
	MCBalance       int64  `json:"mc_balance"`
	TotalAssetValue int64  `json:"total_asset_value"`
	HourlyIncome    int64  `json:"hourly_income"`
	HourlyExpense   int64  `json:"hourly_expense"`
	NetHourly       int64  `json:"net_hourly"`
	BuildingCount   int    `json:"building_count"`
	ArmyCount       int    `json:"army_count"`
	RegionsOwned    int    `json:"regions_owned"`
}

// ── 매니저 ──

// TycoonMergeSystem은 합병/재개발/경제 대시보드 매니저
type TycoonMergeSystem struct {
	pg       *pgxpool.Pool
	bm       *TycoonBuildingManager
	military *MilitarySystem
}

// NewTycoonMergeSystem은 새 TycoonMergeSystem을 생성한다.
func NewTycoonMergeSystem(pg *pgxpool.Pool, bm *TycoonBuildingManager, military *MilitarySystem) *TycoonMergeSystem {
	return &TycoonMergeSystem{pg: pg, bm: bm, military: military}
}

// ── 합병 ──

// PreviewMerge는 합병 결과를 미리 계산한다 (실행하지 않음).
// 1. 모든 건물이 ownerID 소유인지 확인
// 2. 2~4개 범위 확인
// 3. 결과 등급 계산 (재료 최고 등급 기준 + 수량 보너스)
// 4. 비용 계산 (재료 건물 가치 합 * MergeCostRate)
// 5. 시너지: 모든 건물이 같은 regionCode면 MergeSynergyBonus 적용
func (ms *TycoonMergeSystem) PreviewMerge(ctx context.Context, ownerID string, buildingIDs []string) (*MergePreview, error) {
	// 2~4개 범위 확인
	if len(buildingIDs) < MinMergeBuildings || len(buildingIDs) > MaxMergeBuildings {
		return nil, fmt.Errorf("merge requires %d~%d buildings, got %d", MinMergeBuildings, MaxMergeBuildings, len(buildingIDs))
	}

	// 건물 조회 + 소유 확인
	buildings := make([]*TycoonBuilding, 0, len(buildingIDs))
	for _, bid := range buildingIDs {
		b, err := ms.bm.GetBuildingByID(ctx, bid)
		if err != nil {
			return nil, fmt.Errorf("merge preview: get building %s: %w", bid, err)
		}
		if b.OwnerID == nil || *b.OwnerID != ownerID {
			return nil, fmt.Errorf("building %s is not owned by %s", bid, ownerID)
		}
		buildings = append(buildings, b)
	}

	// 최고 등급 찾기
	maxRarityIdx := 0
	for _, b := range buildings {
		idx, ok := rarityIndex[b.Rarity]
		if ok && idx > maxRarityIdx {
			maxRarityIdx = idx
		}
	}

	// 결과 등급 계산:
	// - 재료 수 3개 이상이면 한 단계 업그레이드 보장
	// - 재료 수 2개이면 50% 확률 업그레이드
	resultRarityIdx := maxRarityIdx
	if len(buildings) >= 3 {
		resultRarityIdx = maxRarityIdx + 1
	} else if len(buildings) == 2 {
		if rand.Float64() < 0.5 {
			resultRarityIdx = maxRarityIdx + 1
		}
	}
	// legendary 상한
	if resultRarityIdx >= len(rarityOrder) {
		resultRarityIdx = len(rarityOrder) - 1
	}
	resultRarity := rarityOrder[resultRarityIdx]

	// 비용 계산: 재료 건물 가치 합 * MergeCostRate
	var totalValue int64
	for _, b := range buildings {
		totalValue += ms.bm.CalculateFairValue(b)
	}
	mergeCost := int64(math.Round(float64(totalValue) * MergeCostRate))

	// 시너지 판별: 모든 건물이 같은 regionCode인지 확인
	firstRegion := buildings[0].RegionCode
	synergyApplied := true
	for _, b := range buildings[1:] {
		if b.RegionCode != firstRegion {
			synergyApplied = false
			break
		}
	}

	// 결과 수익 계산: 첫 번째 건물의 base_income 기준, 결과 등급 배율 적용
	baseIncome := buildings[0].BaseIncome
	rarityMult := TycoonRarityIncomeMult[resultRarity]
	if rarityMult == 0 {
		rarityMult = 1.0
	}
	resultIncomeF := float64(baseIncome) * rarityMult
	if synergyApplied {
		resultIncomeF *= MergeSynergyBonus
	}
	resultIncome := int(math.Round(resultIncomeF))

	synergyBonusVal := 0.0
	if synergyApplied {
		synergyBonusVal = MergeSynergyBonus
	}

	return &MergePreview{
		InputBuildings: buildingIDs,
		ResultRarity:   resultRarity,
		ResultIncome:   resultIncome,
		MergeCost:      mergeCost,
		SynergyApplied: synergyApplied,
		SynergyBonus:   synergyBonusVal,
	}, nil
}

// ExecuteMerge는 합병을 실행한다. PG 트랜잭션 보장.
// 1. PreviewMerge로 결과 계산
// 2. 비용 차감
// 3. 재료 건물 삭제 (owner_id NULL로)
// 4. 첫 번째 건물을 업그레이드 (rarity, base_income, level 변경)
// 5. transactions 기록
func (ms *TycoonMergeSystem) ExecuteMerge(ctx context.Context, ownerID string, buildingIDs []string) (*TycoonBuilding, error) {
	// 1. 미리보기로 결과 계산
	preview, err := ms.PreviewMerge(ctx, ownerID, buildingIDs)
	if err != nil {
		return nil, fmt.Errorf("execute merge preview: %w", err)
	}

	// 2. PG 트랜잭션 시작
	tx, err := ms.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("merge begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 2a. 비용 차감 (잔고 확인 포함)
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", ownerID,
	).Scan(&balance)
	if err != nil {
		return nil, fmt.Errorf("merge query balance: %w", err)
	}
	if balance < preview.MergeCost {
		return nil, fmt.Errorf("insufficient balance for merge: has %d, needs %d", balance, preview.MergeCost)
	}
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		preview.MergeCost, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("merge deduct balance: %w", err)
	}

	// 3. 재료 건물 소유 해제 (첫 번째 건물 제외)
	for _, bid := range buildingIDs[1:] {
		_, err = tx.Exec(ctx,
			"UPDATE buildings SET owner_id = NULL, owner_name = NULL, is_auctioning = false WHERE id = $1",
			bid,
		)
		if err != nil {
			return nil, fmt.Errorf("merge release building %s: %w", bid, err)
		}
	}

	// 4. 첫 번째 건물을 업그레이드 (등급 + base_income + level 리셋)
	newBaseIncome := preview.ResultIncome
	_, err = tx.Exec(ctx,
		"UPDATE buildings SET rarity = $1, base_income = $2, level = 1 WHERE id = $3",
		preview.ResultRarity, newBaseIncome, buildingIDs[0],
	)
	if err != nil {
		return nil, fmt.Errorf("merge upgrade building: %w", err)
	}

	// 5. 거래 기록
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, building_id, description) VALUES ($1, $2, $3, $4, $5)",
		ownerID, "building_merge", -preview.MergeCost, buildingIDs[0],
		fmt.Sprintf("Merged %d buildings → %s (cost %d MC)", len(buildingIDs), preview.ResultRarity, preview.MergeCost),
	)
	if err != nil {
		return nil, fmt.Errorf("merge insert transaction: %w", err)
	}

	// 6. 커밋
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("merge commit: %w", err)
	}

	// 7. 결과 건물 반환
	result, err := ms.bm.GetBuildingByID(ctx, buildingIDs[0])
	if err != nil {
		return nil, fmt.Errorf("merge get result building: %w", err)
	}
	return result, nil
}

// ── 재개발 ──

// GetRedevelopProbability는 재개발 등급 변동 확률을 반환한다 (순수 함수).
// common:    60% up, 30% same, 10% down
// uncommon:  40% up, 40% same, 20% down
// rare:      30% up, 40% same, 30% down
// epic:      15% up, 50% same, 35% down
// legendary:  0% up, 70% same, 30% down
func (ms *TycoonMergeSystem) GetRedevelopProbability(rarity string) *RedevelopProbability {
	switch rarity {
	case "common":
		return &RedevelopProbability{UpgradeChance: 0.60, SameChance: 0.30, DowngradeChance: 0.10}
	case "uncommon":
		return &RedevelopProbability{UpgradeChance: 0.40, SameChance: 0.40, DowngradeChance: 0.20}
	case "rare":
		return &RedevelopProbability{UpgradeChance: 0.30, SameChance: 0.40, DowngradeChance: 0.30}
	case "epic":
		return &RedevelopProbability{UpgradeChance: 0.15, SameChance: 0.50, DowngradeChance: 0.35}
	case "legendary":
		return &RedevelopProbability{UpgradeChance: 0.00, SameChance: 0.70, DowngradeChance: 0.30}
	default:
		// 알 수 없는 등급 → 기본값 (common과 동일)
		return &RedevelopProbability{UpgradeChance: 0.60, SameChance: 0.30, DowngradeChance: 0.10}
	}
}

// ExecuteRedevelop는 재개발을 실행한다 (등급 재굴림). PG 트랜잭션 보장.
// 1. 건물 소유 확인
// 2. 비용 차감 (건물 가치 * RedevelopCostRate)
// 3. 확률에 따라 등급 변경
// 4. base_income 재계산
// 5. transactions 기록
// 반환: 새 등급 문자열
func (ms *TycoonMergeSystem) ExecuteRedevelop(ctx context.Context, ownerID, buildingID string) (string, error) {
	// 1. 건물 조회 + 소유 확인
	b, err := ms.bm.GetBuildingByID(ctx, buildingID)
	if err != nil {
		return "", fmt.Errorf("redevelop get building: %w", err)
	}
	if b.OwnerID == nil || *b.OwnerID != ownerID {
		return "", fmt.Errorf("building %s is not owned by %s", buildingID, ownerID)
	}

	// 2. 비용 계산
	fairValue := ms.bm.CalculateFairValue(b)
	cost := int64(math.Round(float64(fairValue) * RedevelopCostRate))

	// 3. 확률 롤로 새 등급 결정
	prob := ms.GetRedevelopProbability(b.Rarity)
	roll := rand.Float64()
	currentIdx := rarityIndex[b.Rarity]
	var newRarityIdx int

	switch {
	case roll < prob.UpgradeChance:
		// 등급 상승
		newRarityIdx = currentIdx + 1
		if newRarityIdx >= len(rarityOrder) {
			newRarityIdx = len(rarityOrder) - 1
		}
	case roll < prob.UpgradeChance+prob.SameChance:
		// 등급 유지
		newRarityIdx = currentIdx
	default:
		// 등급 하락
		newRarityIdx = currentIdx - 1
		if newRarityIdx < 0 {
			newRarityIdx = 0
		}
	}
	newRarity := rarityOrder[newRarityIdx]

	// 4. base_income 재계산: 원본 base_income에 새 등급 배율 반영
	newRarityMult := TycoonRarityIncomeMult[newRarity]
	oldRarityMult := TycoonRarityIncomeMult[b.Rarity]
	if oldRarityMult == 0 {
		oldRarityMult = 1.0
	}
	if newRarityMult == 0 {
		newRarityMult = 1.0
	}
	// base_income 비율 보정: 원본 베이스에서 등급 비율만 변경
	newBaseIncome := int(math.Round(float64(b.BaseIncome) * newRarityMult / oldRarityMult))

	// 5. PG 트랜잭션
	tx, err := ms.pg.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("redevelop begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 5a. 잔고 확인 + 차감
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", ownerID,
	).Scan(&balance)
	if err != nil {
		return "", fmt.Errorf("redevelop query balance: %w", err)
	}
	if balance < cost {
		return "", fmt.Errorf("insufficient balance for redevelop: has %d, needs %d", balance, cost)
	}
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		cost, ownerID,
	)
	if err != nil {
		return "", fmt.Errorf("redevelop deduct balance: %w", err)
	}

	// 5b. 건물 등급 + base_income 업데이트
	_, err = tx.Exec(ctx,
		"UPDATE buildings SET rarity = $1, base_income = $2 WHERE id = $3",
		newRarity, newBaseIncome, buildingID,
	)
	if err != nil {
		return "", fmt.Errorf("redevelop update building: %w", err)
	}

	// 5c. 거래 기록
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, building_id, description) VALUES ($1, $2, $3, $4, $5)",
		ownerID, "building_redevelop", -cost, buildingID,
		fmt.Sprintf("Redeveloped building %s: %s → %s (cost %d MC)", buildingID, b.Rarity, newRarity, cost),
	)
	if err != nil {
		return "", fmt.Errorf("redevelop insert transaction: %w", err)
	}

	// 6. 커밋
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("redevelop commit: %w", err)
	}

	return newRarity, nil
}

// ── 경제 대시보드 ──

// GetEconomyDashboard는 플레이어 경제 현황을 조회한다.
// 1. SELECT mc_balance FROM players
// 2. bm.GetBuildingsByOwner → 총 가치 + 수익 계산
// 3. 군대 유지비 쿼리 (armies 테이블)
// 4. 영토 수 (territories WHERE controller_id)
func (ms *TycoonMergeSystem) GetEconomyDashboard(ctx context.Context, playerID string) (*EconomyDashboard, error) {
	dash := &EconomyDashboard{PlayerID: playerID}

	// 1. MC 잔고 조회
	err := ms.pg.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1", playerID,
	).Scan(&dash.MCBalance)
	if err != nil {
		return nil, fmt.Errorf("dashboard query balance: %w", err)
	}

	// 2. 소유 건물 목록 → 총 자산 가치 + 시간당 수익
	buildings, err := ms.bm.GetBuildingsByOwner(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("dashboard get buildings: %w", err)
	}
	dash.BuildingCount = len(buildings)

	var totalAssetValue int64
	var hourlyIncome int64
	for _, b := range buildings {
		totalAssetValue += ms.bm.CalculateFairValue(b)
		hourlyIncome += ms.bm.CalculateHourlyIncome(b)
	}
	dash.TotalAssetValue = totalAssetValue
	dash.HourlyIncome = hourlyIncome

	// 3. 군대 유지비 + 군대 수
	var armyMaintenance int64
	if ms.military != nil {
		armyMaintenance, err = ms.military.CalculateMaintenanceCost(ctx, playerID)
		if err != nil {
			// 에러 시 유지비 0으로 계속 진행
			armyMaintenance = 0
		}
	}

	// 군대 수 쿼리
	err = ms.pg.QueryRow(ctx,
		"SELECT COALESCE(SUM(count), 0) FROM armies WHERE owner_id = $1", playerID,
	).Scan(&dash.ArmyCount)
	if err != nil {
		dash.ArmyCount = 0
	}

	// 건물 유지비 (총 수익의 10%) + 군대 유지비
	buildingMaintenance := int64(math.Round(float64(hourlyIncome) * TycoonMaintenanceRate))
	dash.HourlyExpense = buildingMaintenance + armyMaintenance

	// 4. 영토 수 (controller_id 기준)
	err = ms.pg.QueryRow(ctx,
		"SELECT COUNT(*) FROM territories WHERE controller_id = $1", playerID,
	).Scan(&dash.RegionsOwned)
	if err != nil {
		dash.RegionsOwned = 0
	}

	// 순수익 계산
	dash.NetHourly = dash.HourlyIncome - dash.HourlyExpense

	return dash, nil
}
