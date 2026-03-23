package game

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonIncomeCalculator: 패시브 수익 정산 엔진
//
// TS IncomeCalculator 설계를 Go로 포팅.
// 수익 공식: base_income * rarity_mult * level_mult * regionMod * (1 + synergyBonus)
// 유지비, 시너지 보너스, 주권 보너스를 반영한 순수익 정산.
//
// 핵심 기능:
//   - CalculateBuildingIncome: 단일 건물 시간당 총수익 (순수 함수)
//   - CalculatePlayerIncome: 플레이어 전체 포트폴리오 수익 계산
//   - SettleIncome: 플레이어 수익 정산 (PG 트랜잭션)
//   - SettleAllPlayers: 전체 건물 소유자 일괄 정산
//   - StartPeriodicSettlement: 1시간 주기 자동 정산 루프
// ============================================================

// ── 수익 정산 상수 ──

const (
	// TycoonMaintenanceRate는 유지비: 총 수익의 10%
	TycoonMaintenanceRate = 0.10
	// TycoonDepreciationWeekly는 감가상각: 주간 -2%
	TycoonDepreciationWeekly = 0.02
	// TycoonMaxDepreciation는 최대 감가상각 50%
	TycoonMaxDepreciation = 0.50
	// TycoonIncomeTickInterval는 수익 정산 주기 (1시간)
	TycoonIncomeTickInterval = time.Hour
	// TycoonDistrictSynergyBonusRate는 구역 3+ 건물 보너스 (+20%)
	TycoonDistrictSynergyBonusRate = 0.20
	// TycoonCityDominationBonusRate는 도시 10+ 건물 보너스 (+30%)
	TycoonCityDominationBonusRate = 0.30
)

// ── 결과 구조체 ──

// TycoonIncomeResult는 플레이어 수익 정산 결과
type TycoonIncomeResult struct {
	PlayerID      string `json:"player_id"`
	GrossIncome   int64  `json:"gross_income"`
	Maintenance   int64  `json:"maintenance"`
	SynergyBonus  int64  `json:"synergy_bonus"`
	NetIncome     int64  `json:"net_income"`
	BuildingCount int    `json:"building_count"`
	NewBalance    int64  `json:"new_balance"`
}

// ── TycoonIncomeCalculator 본체 ──

// TycoonIncomeCalculator는 건물 소유 기반 패시브 수익 정산 엔진
type TycoonIncomeCalculator struct {
	pg        *pgxpool.Pool
	bm        *TycoonBuildingManager
	territory *TycoonTerritoryEngine
}

// NewTycoonIncomeCalculator는 새 TycoonIncomeCalculator를 생성한다.
func NewTycoonIncomeCalculator(
	pg *pgxpool.Pool,
	bm *TycoonBuildingManager,
	territory *TycoonTerritoryEngine,
) *TycoonIncomeCalculator {
	return &TycoonIncomeCalculator{
		pg:        pg,
		bm:        bm,
		territory: territory,
	}
}

// ── 단일 건물 수익 계산 (순수 함수) ──

// CalculateBuildingIncome은 단일 건물의 시간당 총수익을 계산한다.
// 공식: base_income * rarity_mult * level_mult * regionMod * (1 + synergyBonus)
// regionMod: 지역 보정 배율 (기본 1.0)
// synergyBonus: 시너지 보너스 비율 (0.0 ~ 1.0+)
func (c *TycoonIncomeCalculator) CalculateBuildingIncome(
	b *TycoonBuilding,
	regionMod float64,
	synergyBonus float64,
) int64 {
	// 등급별 수익 배율 (building_manager_tycoon.go에 정의된 TycoonRarityIncomeMult 사용)
	rarityMult := TycoonRarityIncomeMult[b.Rarity]
	if rarityMult == 0 {
		rarityMult = 1.0
	}

	// 레벨별 수익 배율 (building_manager_tycoon.go에 정의된 TycoonLevelMult 사용)
	levelIdx := b.Level - 1
	if levelIdx < 0 {
		levelIdx = 0
	}
	if levelIdx >= len(TycoonLevelMult) {
		levelIdx = len(TycoonLevelMult) - 1
	}
	levelMult := TycoonLevelMult[levelIdx]

	income := float64(b.BaseIncome) * rarityMult * levelMult * regionMod * (1.0 + synergyBonus)
	return int64(math.Round(income))
}

// ── 플레이어 전체 수익 계산 ──

// CalculatePlayerIncome은 한 플레이어의 전체 포트폴리오 수익을 계산한다.
// 1. 소유 건물 목록 조회
// 2. 건물별 시너지 보너스 계산
// 3. 건물별 수익 합산
// 4. 유지비 차감 (총 수익의 10%)
// 5. 주권 보너스 반영
func (c *TycoonIncomeCalculator) CalculatePlayerIncome(
	ctx context.Context,
	playerID string,
) (*TycoonIncomeResult, error) {
	// 1. 소유 건물 목록 조회
	buildings, err := c.bm.GetBuildingsByOwner(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("income calc: get buildings for %s: %w", playerID, err)
	}

	if len(buildings) == 0 {
		return &TycoonIncomeResult{
			PlayerID:      playerID,
			BuildingCount: 0,
		}, nil
	}

	// 2. region별 건물 수 집계 (시너지 보너스 판별용)
	regionCounts := make(map[string]int)
	for _, b := range buildings {
		regionCounts[b.RegionCode]++
	}

	// 3. 건물별 수익 합산
	var grossIncome int64
	var totalSynergyBonus int64

	for _, b := range buildings {
		// 시너지 보너스 계산: 같은 region에 3+ 건물 소유 시 +20%
		var synergyBonus float64
		if regionCounts[b.RegionCode] >= TycoonDistrictSynergyThreshold {
			synergyBonus += TycoonDistrictSynergyBonusRate
		}

		// 도시 지배 보너스: 같은 city에 10+ 건물 소유 시 +30%
		cityCode := ExtractCityCode(b.RegionCode)
		cityHasDomination, err := c.territory.GetCityDomination(ctx, playerID, cityCode)
		if err != nil {
			slog.Warn("income calc: city domination check failed",
				"playerID", playerID,
				"city", cityCode,
				"error", err,
			)
			// 에러 시 보너스 미적용, 계속 진행
		} else if cityHasDomination {
			synergyBonus += TycoonCityDominationBonusRate
		}

		// regionMod 기본 1.0 (향후 지역별 보정값 확장 가능)
		regionMod := 1.0

		buildingIncome := c.CalculateBuildingIncome(b, regionMod, synergyBonus)
		grossIncome += buildingIncome

		// 시너지 보너스 금액 역산 (synergyBonus 비중만큼)
		if synergyBonus > 0 {
			baseIncome := c.CalculateBuildingIncome(b, regionMod, 0)
			totalSynergyBonus += buildingIncome - baseIncome
			_ = baseIncome
		}
	}

	// 4. 유지비 차감 (총 수익의 10%)
	maintenance := int64(math.Round(float64(grossIncome) * TycoonMaintenanceRate))

	// 5. 주권 보너스 반영 (최고 sovereignty 레벨 기준)
	sovIncomeMult, _ := c.territory.GetSovereigntyBonuses(ctx, playerID)

	// 순수익 = (총수익 - 유지비) * 주권 배율
	netIncome := int64(math.Round(float64(grossIncome-maintenance) * sovIncomeMult))

	return &TycoonIncomeResult{
		PlayerID:      playerID,
		GrossIncome:   grossIncome,
		Maintenance:   maintenance,
		SynergyBonus:  totalSynergyBonus,
		NetIncome:     netIncome,
		BuildingCount: len(buildings),
	}, nil
}

// ── 수익 정산 (PG 트랜잭션) ──

// SettleIncome은 한 플레이어의 수익을 정산하여 MC 잔고에 반영한다.
// PG 트랜잭션으로 잔고 업데이트 + 수익 로그 + 거래 기록을 원자적으로 처리한다.
func (c *TycoonIncomeCalculator) SettleIncome(
	ctx context.Context,
	playerID string,
) (*TycoonIncomeResult, error) {
	// 1. 수익 계산
	result, err := c.CalculatePlayerIncome(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("settle income: %w", err)
	}

	// 건물 없거나 순수익 0 이하 → 스킵
	if result.BuildingCount == 0 || result.NetIncome <= 0 {
		return result, nil
	}

	// 2. PG 트랜잭션으로 잔고 반영
	tx, err := c.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("settle income begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 2a. 잔고 업데이트
	var newBalance int64
	err = tx.QueryRow(ctx,
		"UPDATE players SET mc_balance = mc_balance + $1 WHERE id = $2 RETURNING mc_balance",
		result.NetIncome, playerID,
	).Scan(&newBalance)
	if err != nil {
		return nil, fmt.Errorf("settle income update balance: %w", err)
	}
	result.NewBalance = newBalance

	// 2b. 수익 로그 삽입
	_, err = tx.Exec(ctx, `
		INSERT INTO income_log (player_id, gross_income, maintenance, synergy_bonus, net_income, building_count)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, playerID, result.GrossIncome, result.Maintenance, result.SynergyBonus, result.NetIncome, result.BuildingCount)
	if err != nil {
		return nil, fmt.Errorf("settle income insert log: %w", err)
	}

	// 2c. 거래 기록 삽입
	_, err = tx.Exec(ctx,
		"INSERT INTO transactions (player_id, type, amount, description) VALUES ($1, $2, $3, $4)",
		playerID, "income_settlement", result.NetIncome,
		fmt.Sprintf("Income settlement: %d MC (gross=%d, maintenance=%d, synergy=%d, buildings=%d)",
			result.NetIncome, result.GrossIncome, result.Maintenance, result.SynergyBonus, result.BuildingCount),
	)
	if err != nil {
		return nil, fmt.Errorf("settle income insert transaction: %w", err)
	}

	// 3. 커밋
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("settle income commit: %w", err)
	}

	slog.Info("tycoon-income: settled",
		"playerID", playerID,
		"net", result.NetIncome,
		"gross", result.GrossIncome,
		"buildings", result.BuildingCount,
	)

	return result, nil
}

// ── 전체 플레이어 일괄 정산 ──

// SettleAllPlayers는 건물을 소유한 모든 플레이어의 수익을 일괄 정산한다.
// 정산된 플레이어 수를 반환한다.
func (c *TycoonIncomeCalculator) SettleAllPlayers(ctx context.Context) (int, error) {
	// 건물 소유자 ID 목록 조회
	rows, err := c.pg.Query(ctx,
		"SELECT DISTINCT owner_id FROM buildings WHERE owner_id IS NOT NULL",
	)
	if err != nil {
		return 0, fmt.Errorf("settle all: query owners: %w", err)
	}
	defer rows.Close()

	var ownerIDs []string
	for rows.Next() {
		var ownerID string
		if err := rows.Scan(&ownerID); err != nil {
			return 0, fmt.Errorf("settle all: scan owner: %w", err)
		}
		ownerIDs = append(ownerIDs, ownerID)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("settle all: rows error: %w", err)
	}

	// 각 플레이어 개별 정산
	settled := 0
	for _, ownerID := range ownerIDs {
		_, err := c.SettleIncome(ctx, ownerID)
		if err != nil {
			slog.Error("tycoon-income: settle failed for player",
				"playerID", ownerID,
				"error", err,
			)
			// 한 플레이어 실패해도 나머지 계속 진행
			continue
		}
		settled++
	}

	slog.Info("tycoon-income: batch settlement completed",
		"total_owners", len(ownerIDs),
		"settled", settled,
	)

	return settled, nil
}

// ── 주기적 정산 루프 ──

// StartPeriodicSettlement는 1시간 주기 수익 정산 루프를 시작한다.
// ctx가 취소될 때까지 블로킹한다.
func (c *TycoonIncomeCalculator) StartPeriodicSettlement(ctx context.Context) {
	ticker := time.NewTicker(TycoonIncomeTickInterval)
	defer ticker.Stop()

	slog.Info("tycoon-income: periodic settlement started",
		"interval", TycoonIncomeTickInterval,
	)

	for {
		select {
		case <-ctx.Done():
			slog.Info("tycoon-income: periodic settlement stopped")
			return
		case <-ticker.C:
			settled, err := c.SettleAllPlayers(ctx)
			if err != nil {
				slog.Error("tycoon-income: periodic settlement failed",
					"error", err,
				)
			} else {
				slog.Info("tycoon-income: periodic settlement tick",
					"settled", settled,
				)
			}
		}
	}
}
