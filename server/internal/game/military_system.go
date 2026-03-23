package game

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// MilitarySystem: 유닛 생산 + 군대 이동 + 방어 시설 관리 엔진
//
// 핵심 기능:
//   - 유닛 4종 (Infantry, Armor, Air, Special) 생산/유지비
//   - 방어 시설 5종 (Bunker, Turret, AntiAir, Wall, HQ) 배치
//   - 군대 이동 (march) → 도착 → 전투 트리거
//   - 30초 주기 도착 체크 루프
// ============================================================

// ── 유닛 타입 4종 ──

// UnitType은 군사 유닛 종류를 나타낸다.
type UnitType string

const (
	UnitInfantry UnitType = "infantry" // 보병: 저비용, 약함, 빠른 생산
	UnitArmor    UnitType = "armor"    // 기갑: 중비용, 강함, 느린 생산
	UnitAir      UnitType = "air"      // 공중: 고비용, 매우 강함, 성벽 무시
	UnitSpecial  UnitType = "special"  // 특수: 최고비용, 특수 능력
)

// UnitConfig는 유닛 타입별 능력치/비용 설정
type UnitConfig struct {
	Type            UnitType
	Name            string
	NameKo          string
	AttackPower     int     // 공격력
	DefensePower    int     // 방어력
	HP              int     // 체력
	Speed           float64 // 이동속도 (km/h)
	ProductionCost  int64   // MC 비용
	ProductionTime  int     // 생산 시간 (초)
	MaintenanceCost int64   // 시간당 유지비
	IgnoresWalls    bool    // 성벽 무시 여부
}

// UnitConfigs는 유닛 타입별 전체 설정 맵
var UnitConfigs = map[UnitType]UnitConfig{
	UnitInfantry: {UnitInfantry, "Infantry", "보병", 10, 8, 100, 50, 500, 60, 5, false},
	UnitArmor:    {UnitArmor, "Armor", "기갑", 30, 25, 300, 30, 2000, 180, 20, false},
	UnitAir:      {UnitAir, "Air Force", "공군", 40, 15, 200, 100, 5000, 300, 50, true},
	UnitSpecial:  {UnitSpecial, "Special Ops", "특수부대", 50, 20, 150, 80, 10000, 600, 100, false},
}

// ── 방어 시설 5종 ──

// DefenseType은 방어 시설 종류를 나타낸다.
type DefenseType string

const (
	DefBunker  DefenseType = "bunker"   // 보병 방어 +50%
	DefTurret  DefenseType = "turret"   // 자동 공격, DPS 20
	DefAntiAir DefenseType = "anti_air" // 공중 유닛 2배 피해
	DefWall    DefenseType = "wall"     // 근접 유닛 이동 차단 (Air 무시)
	DefHQ      DefenseType = "hq"       // 추가 HP + 자동 공격, 1개만
)

// DefenseConfig는 방어 시설별 능력치/비용 설정
type DefenseConfig struct {
	Type      DefenseType
	Name      string
	HP        int
	AttackDPS int   // 초당 피해 (0이면 비공격)
	BuildCost int64 // MC 비용
	BuildTime int   // 초
}

// DefenseConfigs는 방어 시설별 전체 설정 맵
var DefenseConfigs = map[DefenseType]DefenseConfig{
	DefBunker:  {DefBunker, "Bunker", 500, 0, 1000, 120},
	DefTurret:  {DefTurret, "Turret", 300, 20, 2000, 180},
	DefAntiAir: {DefAntiAir, "Anti-Air", 250, 30, 3000, 240},
	DefWall:    {DefWall, "Wall", 1000, 0, 1500, 90},
	DefHQ:      {DefHQ, "HQ Fortress", 2000, 15, 10000, 600},
}

// ── 군대 이동 정보 ──

// ArmyMarch는 이동 중인 군대 정보
type ArmyMarch struct {
	ArmyID     string
	OwnerID    string
	UnitType   string
	Count      int
	FromRegion string
	ToRegion   string
	DepartedAt time.Time
	ArrivalAt  time.Time
}

// GarrisonInfo는 주둔 유닛 정보
type GarrisonInfo struct {
	OwnerID  string
	UnitType string
	Count    int
	Level    int
}

// ── 군사 매니저 ──

// MilitarySystem은 pgxpool 기반 군사 시스템 매니저
type MilitarySystem struct {
	pg *pgxpool.Pool
}

// NewMilitarySystem은 새 MilitarySystem을 생성한다.
func NewMilitarySystem(pg *pgxpool.Pool) *MilitarySystem {
	return &MilitarySystem{pg: pg}
}

// ── 유닛 생산 ──

// ProduceUnits는 유닛을 생산한다.
// PG 트랜잭션: 잔고 확인 → 차감 → armies INSERT/UPDATE
func (ms *MilitarySystem) ProduceUnits(ctx context.Context, ownerID string, unitType UnitType, count int) error {
	config, ok := UnitConfigs[unitType]
	if !ok {
		return fmt.Errorf("unknown unit type: %s", unitType)
	}
	if count <= 0 {
		return fmt.Errorf("count must be positive, got %d", count)
	}

	totalCost := config.ProductionCost * int64(count)

	tx, err := ms.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("produce units begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 잔고 확인 (SELECT FOR UPDATE로 락 획득)
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", ownerID,
	).Scan(&balance)
	if err != nil {
		return fmt.Errorf("produce units query balance: %w", err)
	}
	if balance < totalCost {
		return fmt.Errorf("insufficient balance: has %d, needs %d", balance, totalCost)
	}

	// 2. 잔고 차감
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		totalCost, ownerID,
	)
	if err != nil {
		return fmt.Errorf("produce units deduct balance: %w", err)
	}

	// 3. armies INSERT (새 군대 생성)
	armyID := uuid.New().String()
	_, err = tx.Exec(ctx,
		`INSERT INTO armies (id, owner_id, unit_type, count, level, status, created_at)
		 VALUES ($1, $2, $3, $4, 1, 'idle', NOW())`,
		armyID, ownerID, string(unitType), count,
	)
	if err != nil {
		return fmt.Errorf("produce units insert army: %w", err)
	}

	// 4. 거래 기록
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (player_id, type, amount, ref_id, description, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		ownerID, "unit_production", -totalCost, armyID,
		fmt.Sprintf("Produced %d %s units for %d MC", count, unitType, totalCost),
	)
	if err != nil {
		return fmt.Errorf("produce units insert transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("produce units commit: %w", err)
	}
	return nil
}

// ── 이동 시간 계산 헬퍼 ──

// CalculateTravelTime은 출발/도착 지역 코드 기반 이동 시간을 계산한다.
// 같은 city prefix (e.g. "seoul-*"): 15분
// 같은 country prefix (e.g. "kr-*"): 1시간
// 다른 country: 3시간
func (ms *MilitarySystem) CalculateTravelTime(fromRegion, toRegion string) time.Duration {
	if fromRegion == toRegion {
		return 0
	}

	fromParts := strings.SplitN(fromRegion, "-", 3)
	toParts := strings.SplitN(toRegion, "-", 3)

	// 같은 도시 내 (e.g. "kr-seoul-gangnam" → "kr-seoul-jongno")
	if len(fromParts) >= 2 && len(toParts) >= 2 &&
		fromParts[0] == toParts[0] && fromParts[1] == toParts[1] {
		return 15 * time.Minute
	}

	// 같은 나라 내 (e.g. "kr-seoul-gangnam" → "kr-busan-haeundae")
	if len(fromParts) >= 1 && len(toParts) >= 1 && fromParts[0] == toParts[0] {
		return 1 * time.Hour
	}

	// 다른 나라
	return 3 * time.Hour
}

// ── 군대 이동 (공격 명령) ──

// MarchArmy는 idle 상태의 군대를 목표 지역으로 이동시킨다.
func (ms *MilitarySystem) MarchArmy(ctx context.Context, armyID, targetRegion string) (*ArmyMarch, error) {
	// 1. army 조회 (status=idle 확인)
	var (
		ownerID        string
		unitType       string
		count          int
		stationedRegion *string
		status         string
	)
	err := ms.pg.QueryRow(ctx,
		"SELECT owner_id, unit_type, count, stationed_region, status FROM armies WHERE id = $1",
		armyID,
	).Scan(&ownerID, &unitType, &count, &stationedRegion, &status)
	if err != nil {
		return nil, fmt.Errorf("march army query: %w", err)
	}
	if status != "idle" {
		return nil, fmt.Errorf("army %s is not idle (status=%s)", armyID, status)
	}

	// 2. 이동 시간 계산
	fromRegion := ""
	if stationedRegion != nil {
		fromRegion = *stationedRegion
	}
	travelTime := ms.CalculateTravelTime(fromRegion, targetRegion)
	if travelTime == 0 {
		// 같은 지역이면 즉시 도착 (최소 1분)
		travelTime = 1 * time.Minute
	}

	now := time.Now()
	arrivalAt := now.Add(travelTime)

	// 3. UPDATE armies SET status='marching', target_region, arrival_at
	_, err = ms.pg.Exec(ctx,
		`UPDATE armies SET status = 'marching', target_region = $1, arrival_at = $2
		 WHERE id = $3`,
		targetRegion, arrivalAt, armyID,
	)
	if err != nil {
		return nil, fmt.Errorf("march army update: %w", err)
	}

	return &ArmyMarch{
		ArmyID:     armyID,
		OwnerID:    ownerID,
		UnitType:   unitType,
		Count:      count,
		FromRegion: fromRegion,
		ToRegion:   targetRegion,
		DepartedAt: now,
		ArrivalAt:  arrivalAt,
	}, nil
}

// ── 도착 처리 ──

// GetArrivingArmies는 도착 시간이 지난 marching 상태 군대를 조회한다.
func (ms *MilitarySystem) GetArrivingArmies(ctx context.Context) ([]*ArmyMarch, error) {
	rows, err := ms.pg.Query(ctx,
		`SELECT id, owner_id, unit_type, count, stationed_region, target_region, created_at, arrival_at
		 FROM armies WHERE status = 'marching' AND arrival_at <= NOW()`,
	)
	if err != nil {
		return nil, fmt.Errorf("get arriving armies query: %w", err)
	}
	defer rows.Close()

	var results []*ArmyMarch
	for rows.Next() {
		m := &ArmyMarch{}
		var stationedRegion *string
		err := rows.Scan(
			&m.ArmyID, &m.OwnerID, &m.UnitType, &m.Count,
			&stationedRegion, &m.ToRegion, &m.DepartedAt, &m.ArrivalAt,
		)
		if err != nil {
			return nil, fmt.Errorf("get arriving armies scan: %w", err)
		}
		if stationedRegion != nil {
			m.FromRegion = *stationedRegion
		}
		results = append(results, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get arriving armies iteration: %w", err)
	}
	return results, nil
}

// CompleteArrival은 도착한 군대의 상태를 fighting으로 변경하고 주둔 지역을 갱신한다.
func (ms *MilitarySystem) CompleteArrival(ctx context.Context, armyID string) error {
	tag, err := ms.pg.Exec(ctx,
		`UPDATE armies SET status = 'fighting', stationed_region = target_region
		 WHERE id = $1 AND status = 'marching'`,
		armyID,
	)
	if err != nil {
		return fmt.Errorf("complete arrival update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("army %s not found or not marching", armyID)
	}
	return nil
}

// ── 유닛 유지비 계산 ──

// CalculateMaintenanceCost는 소유자의 전체 군대 시간당 유지비를 합산한다.
func (ms *MilitarySystem) CalculateMaintenanceCost(ctx context.Context, ownerID string) (int64, error) {
	rows, err := ms.pg.Query(ctx,
		"SELECT unit_type, count FROM armies WHERE owner_id = $1",
		ownerID,
	)
	if err != nil {
		return 0, fmt.Errorf("calc maintenance query: %w", err)
	}
	defer rows.Close()

	var totalCost int64
	for rows.Next() {
		var ut string
		var cnt int
		if err := rows.Scan(&ut, &cnt); err != nil {
			return 0, fmt.Errorf("calc maintenance scan: %w", err)
		}
		config, ok := UnitConfigs[UnitType(ut)]
		if !ok {
			// 방어 시설이거나 알 수 없는 유닛이면 스킵
			continue
		}
		totalCost += config.MaintenanceCost * int64(cnt)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("calc maintenance iteration: %w", err)
	}
	return totalCost, nil
}

// ── 방어 시설 배치 ──

// BuildDefense는 방어 시설을 지정 지역에 배치한다.
// armies 테이블에 unit_type="defense_<type>" 형태로 저장한다.
func (ms *MilitarySystem) BuildDefense(ctx context.Context, ownerID, regionCode string, defType DefenseType) error {
	config, ok := DefenseConfigs[defType]
	if !ok {
		return fmt.Errorf("unknown defense type: %s", defType)
	}

	// HQ는 지역당 1개만 허용
	if defType == DefHQ {
		var existingCount int
		err := ms.pg.QueryRow(ctx,
			`SELECT COUNT(*) FROM armies
			 WHERE owner_id = $1 AND stationed_region = $2 AND unit_type = $3`,
			ownerID, regionCode, "defense_hq",
		).Scan(&existingCount)
		if err != nil {
			return fmt.Errorf("build defense check hq: %w", err)
		}
		if existingCount > 0 {
			return fmt.Errorf("HQ already exists in region %s", regionCode)
		}
	}

	tx, err := ms.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("build defense begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 잔고 확인
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE", ownerID,
	).Scan(&balance)
	if err != nil {
		return fmt.Errorf("build defense query balance: %w", err)
	}
	if balance < config.BuildCost {
		return fmt.Errorf("insufficient balance: has %d, needs %d", balance, config.BuildCost)
	}

	// 2. 잔고 차감
	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		config.BuildCost, ownerID,
	)
	if err != nil {
		return fmt.Errorf("build defense deduct balance: %w", err)
	}

	// 3. armies에 방어 시설 INSERT
	defenseID := uuid.New().String()
	defenseUnitType := "defense_" + string(defType)
	_, err = tx.Exec(ctx,
		`INSERT INTO armies (id, owner_id, unit_type, count, level, stationed_region, status, created_at)
		 VALUES ($1, $2, $3, 1, 1, $4, 'stationed', NOW())`,
		defenseID, ownerID, defenseUnitType, regionCode,
	)
	if err != nil {
		return fmt.Errorf("build defense insert: %w", err)
	}

	// 4. 거래 기록
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (player_id, type, amount, ref_id, description, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		ownerID, "defense_build", -config.BuildCost, defenseID,
		fmt.Sprintf("Built %s in %s for %d MC", config.Name, regionCode, config.BuildCost),
	)
	if err != nil {
		return fmt.Errorf("build defense insert transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("build defense commit: %w", err)
	}
	return nil
}

// ── 주둔 유닛 조회 ──

// GetGarrison은 특정 지역에 주둔 중인 유닛 목록을 조회한다.
func (ms *MilitarySystem) GetGarrison(ctx context.Context, regionCode string) ([]*GarrisonInfo, error) {
	rows, err := ms.pg.Query(ctx,
		`SELECT owner_id, unit_type, count, level
		 FROM armies
		 WHERE stationed_region = $1 AND status IN ('idle', 'stationed', 'fighting')
		 ORDER BY owner_id, unit_type`,
		regionCode,
	)
	if err != nil {
		return nil, fmt.Errorf("get garrison query: %w", err)
	}
	defer rows.Close()

	var results []*GarrisonInfo
	for rows.Next() {
		g := &GarrisonInfo{}
		if err := rows.Scan(&g.OwnerID, &g.UnitType, &g.Count, &g.Level); err != nil {
			return nil, fmt.Errorf("get garrison scan: %w", err)
		}
		results = append(results, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get garrison iteration: %w", err)
	}
	return results, nil
}

// ── 주기적 도착 체크 루프 ──

// StartArrivalChecker는 30초마다 도착한 군대를 확인하고 도착 처리를 실행한다.
// context 취소 시 중단된다.
func (ms *MilitarySystem) StartArrivalChecker(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	slog.Info("[MilitarySystem] arrival checker started (30s interval)")

	for {
		select {
		case <-ctx.Done():
			slog.Info("[MilitarySystem] arrival checker stopped")
			return
		case <-ticker.C:
			ms.processArrivals(ctx)
		}
	}
}

// processArrivals는 도착한 군대를 일괄 처리한다.
func (ms *MilitarySystem) processArrivals(ctx context.Context) {
	armies, err := ms.GetArrivingArmies(ctx)
	if err != nil {
		slog.Error("[MilitarySystem] get arriving armies failed", "error", err)
		return
	}
	if len(armies) == 0 {
		return
	}

	slog.Info("[MilitarySystem] processing arrivals", "count", len(armies))
	for _, army := range armies {
		if err := ms.CompleteArrival(ctx, army.ArmyID); err != nil {
			slog.Error("[MilitarySystem] complete arrival failed",
				"armyID", army.ArmyID, "error", err)
			continue
		}
		slog.Info("[MilitarySystem] army arrived",
			"armyID", army.ArmyID,
			"owner", army.OwnerID,
			"unitType", army.UnitType,
			"count", army.Count,
			"region", army.ToRegion,
		)
	}
}
