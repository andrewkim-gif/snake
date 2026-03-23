package game

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// BattleSimulator: 배치형 자동전투 시뮬레이션 엔진
//
// 공격 흐름:
//   1. 공격자: 유닛 선택 + 대상 구역 선택
//   2. 서버: 이동 시간 계산 (MilitarySystem에서 처리)
//   3. 도착: BattleSimulator 실행
//   4. 3분 시뮬레이션 (180틱, 1틱=1초)
//   5. 결과: 승/패 + MC 약탈 + 건물 소유권 이전
//
// 방어 우위:
//   - 방어측 30% 전투력 보너스
//   - 방어 시설이 선제 공격 (첫 10틱)
//   - 성벽: 지상 유닛 이동 차단 (Air 유닛만 통과)
//   - 본부(HQ): 추가 HP 5000 + DPS 30
//
// Anti-Grief:
//   - 공격 쿨다운: 같은 대상 12시간
//   - 일일 공격 제한: 3회/일
//   - 약탈 상한: 적 MC의 10%
// ============================================================

const (
	BattleDurationTicks = 180          // 3분 = 180틱
	BattleTickDuration  = time.Second  // 1틱 = 1초
	DefenseBonus        = 0.30         // 방어측 30% 보너스
	DefensePreemptTicks = 10           // 방어 시설 선제 공격 틱
	MaxLootPct          = 0.10         // 약탈 상한 10%
	AttackCooldownHours = 12           // 같은 대상 공격 쿨다운 (시간)
	DailyAttackLimit    = 3            // 일일 공격 제한
	ReplaySnapshotEvery = 10           // 10틱마다 리플레이 스냅샷
	LootPerSurvivor     = int64(1000)  // 생존 유닛당 약탈 가능 MC
	HQBonusHP           = 5000         // HQ 추가 HP
	HQBonusDPS          = 30           // HQ 추가 DPS
)

// ── 전투 유닛 상태 ──

// BattleUnit은 전투 시뮬레이션 내 유닛 상태를 나타낸다.
type BattleUnit struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Count   int    `json:"count"`
	HP      int    `json:"hp"`
	MaxHP   int    `json:"max_hp"`
	Attack  int    `json:"attack"`
	Defense int    `json:"defense"`
	IsAir   bool   `json:"is_air"`
	Side    string `json:"side"` // "attacker" | "defender"
}

// ── 방어 시설 상태 ──

// BattleDefense는 전투 시뮬레이션 내 방어 시설 상태를 나타낸다.
type BattleDefense struct {
	Type   string `json:"type"`
	HP     int    `json:"hp"`
	MaxHP  int    `json:"max_hp"`
	DPS    int    `json:"dps"`
	Active bool   `json:"active"`
}

// ── 틱 프레임 (리플레이 데이터) ──

// BattleTickFrame은 리플레이용 틱 스냅샷이다.
type BattleTickFrame struct {
	Tick          int              `json:"tick"`
	AttackerUnits []*BattleUnit    `json:"attacker_units"`
	DefenderUnits []*BattleUnit    `json:"defender_units"`
	Defenses      []*BattleDefense `json:"defenses"`
	Events        []string         `json:"events"`
}

// ── 전투 결과 ──

// BattleResult는 전투 시뮬레이션 최종 결과를 나타낸다.
type BattleResult struct {
	ID                string             `json:"id"`
	AttackerID        string             `json:"attacker_id"`
	DefenderID        string             `json:"defender_id"`
	TargetRegion      string             `json:"target_region"`
	Result            string             `json:"result"` // "attacker_win" | "defender_win" | "draw"
	AttackerSurvivors []*BattleUnit      `json:"attacker_survivors"`
	DefenderSurvivors []*BattleUnit      `json:"defender_survivors"`
	MCLooted          int64              `json:"mc_looted"`
	BuildingsCaptured []string           `json:"buildings_captured"`
	ReplayFrames      []*BattleTickFrame `json:"replay_frames"`
	Duration          int                `json:"duration_ticks"`
}

// ── BattleSimulator ──

// BattleSimulator는 배치형 자동전투 시뮬레이션 엔진이다.
type BattleSimulator struct {
	pg *pgxpool.Pool
}

// NewBattleSimulator는 새 BattleSimulator를 생성한다.
func NewBattleSimulator(pg *pgxpool.Pool) *BattleSimulator {
	return &BattleSimulator{pg: pg}
}

// ── Anti-Grief: 쿨다운 + 일일 제한 ──

// CanAttack checks whether the attacker can initiate a battle.
// Returns (ok, reason, error).
//   - 12시간 쿨다운: 같은 target_region에 대한 최근 전투 확인
//   - 일일 3회 제한: 당일 공격 횟수 확인
func (bs *BattleSimulator) CanAttack(ctx context.Context, attackerID, targetRegion string) (bool, string, error) {
	// 1. 쿨다운 체크: 같은 대상 region에 대해 12시간 이내 완료된 전투가 있는지
	var cooldownCount int
	err := bs.pg.QueryRow(ctx, `
		SELECT COUNT(*) FROM battles
		WHERE attacker_id = $1
		  AND target_region = $2
		  AND completed_at > NOW() - INTERVAL '1 hour' * $3
	`, attackerID, targetRegion, AttackCooldownHours).Scan(&cooldownCount)
	if err != nil {
		return false, "", fmt.Errorf("check cooldown: %w", err)
	}
	if cooldownCount > 0 {
		return false, fmt.Sprintf("attack cooldown: must wait %d hours between attacks on same region", AttackCooldownHours), nil
	}

	// 2. 일일 공격 제한: 당일 총 공격 횟수 확인
	var dailyCount int
	err = bs.pg.QueryRow(ctx, `
		SELECT COUNT(*) FROM battles
		WHERE attacker_id = $1
		  AND DATE(started_at) = CURRENT_DATE
	`, attackerID).Scan(&dailyCount)
	if err != nil {
		return false, "", fmt.Errorf("check daily limit: %w", err)
	}
	if dailyCount >= DailyAttackLimit {
		return false, fmt.Sprintf("daily attack limit reached: %d/%d attacks today", dailyCount, DailyAttackLimit), nil
	}

	return true, "", nil
}

// ── 유닛/시설 변환 헬퍼 ──

// garrisonToBattleUnits는 GarrisonInfo 슬라이스를 BattleUnit 슬라이스로 변환한다.
// side는 "attacker" 또는 "defender".
func garrisonToBattleUnits(garrisons []*GarrisonInfo, side string) []*BattleUnit {
	units := make([]*BattleUnit, 0, len(garrisons))
	for _, g := range garrisons {
		ut := UnitType(g.UnitType)
		cfg, ok := UnitConfigs[ut]
		if !ok {
			slog.Warn("battle: unknown unit type in garrison, skipping",
				"unitType", g.UnitType,
			)
			continue
		}

		bu := &BattleUnit{
			ID:      uuid.New().String(),
			Type:    g.UnitType,
			Count:   g.Count,
			HP:      cfg.HP * g.Count,
			MaxHP:   cfg.HP * g.Count,
			Attack:  cfg.AttackPower,
			Defense: cfg.DefensePower,
			IsAir:   cfg.IgnoresWalls,
			Side:    side,
		}
		units = append(units, bu)
	}
	return units
}

// garrisonToDefenses는 방어 시설 GarrisonInfo를 BattleDefense로 변환한다.
// GarrisonInfo.UnitType에 DefenseType 문자열이 들어온다.
func garrisonToDefenses(garrisons []*GarrisonInfo) []*BattleDefense {
	defs := make([]*BattleDefense, 0, len(garrisons))
	for _, g := range garrisons {
		dt := DefenseType(g.UnitType)
		cfg, ok := DefenseConfigs[dt]
		if !ok {
			slog.Warn("battle: unknown defense type, skipping",
				"defenseType", g.UnitType,
			)
			continue
		}

		hp := cfg.HP * g.Count
		dps := cfg.AttackDPS * g.Count

		// HQ 보너스 적용
		if dt == DefHQ {
			hp += HQBonusHP
			dps += HQBonusDPS
		}

		bd := &BattleDefense{
			Type:   g.UnitType,
			HP:     hp,
			MaxHP:  hp,
			DPS:    dps,
			Active: true,
		}
		defs = append(defs, bd)
	}
	return defs
}

// applyDefenseBonus는 방어측 유닛에 30% 전투력 보너스를 적용한다.
func applyDefenseBonus(units []*BattleUnit) {
	for _, u := range units {
		u.Attack = int(float64(u.Attack) * (1.0 + DefenseBonus))
		u.Defense = int(float64(u.Defense) * (1.0 + DefenseBonus))
	}
}

// ── 메인 전투 시뮬레이션 ──

// SimulateBattle는 전체 전투 시뮬레이션을 실행한다.
// 180틱(3분) 동안 공격자 vs 방어자 자동전투를 수행하고 결과를 반환한다.
func (bs *BattleSimulator) SimulateBattle(
	ctx context.Context,
	attackerID, defenderID, targetRegion string,
	attackerArmies []*GarrisonInfo,
	defenderArmies []*GarrisonInfo,
	defenses []*GarrisonInfo,
) (*BattleResult, error) {

	battleID := uuid.New().String()

	// 1. 유닛을 BattleUnit으로 변환
	attackers := garrisonToBattleUnits(attackerArmies, "attacker")
	defenders := garrisonToBattleUnits(defenderArmies, "defender")

	// 2. 방어 시설을 BattleDefense로 변환
	battleDefenses := garrisonToDefenses(defenses)

	// 3. 방어측 DefenseBonus 적용 (+30% attack/defense)
	applyDefenseBonus(defenders)

	// 4. 리플레이 프레임 + 이벤트 저장소
	replayFrames := make([]*BattleTickFrame, 0, BattleDurationTicks/ReplaySnapshotEvery+1)
	finalTick := BattleDurationTicks

	// 5. 180틱 시뮬레이션 루프
	for tick := 0; tick < BattleDurationTicks; tick++ {
		// 매 ReplaySnapshotEvery 틱마다 스냅샷 저장
		if tick%ReplaySnapshotEvery == 0 {
			replayFrames = append(replayFrames, captureSnapshot(tick, attackers, defenders, battleDefenses))
		}

		// 틱 처리
		events := bs.processTick(tick, attackers, defenders, battleDefenses)

		// 사망 유닛 제거
		attackers = removeDead(attackers)
		defenders = removeDead(defenders)
		battleDefenses = removeDeadDefenses(battleDefenses)

		// 조기 종료 체크
		if len(attackers) == 0 || (len(defenders) == 0 && len(battleDefenses) == 0) {
			// 마지막 틱 스냅샷 (이벤트 포함)
			frame := captureSnapshot(tick+1, attackers, defenders, battleDefenses)
			frame.Events = events
			replayFrames = append(replayFrames, frame)
			finalTick = tick + 1
			break
		}

		// 스냅샷에 이벤트 첨부 (가장 최근 프레임)
		if len(replayFrames) > 0 && tick%ReplaySnapshotEvery == 0 {
			replayFrames[len(replayFrames)-1].Events = events
		}
	}

	// 6. 결과 판정
	result := determineResult(attackers, defenders, battleDefenses)

	// 7. 약탈 계산 (공격 승리 시)
	var mcLooted int64
	if result == "attacker_win" {
		mcLooted = bs.calculateLoot(ctx, defenderID, attackers)
	}

	// 8. BattleResult 구성
	battleResult := &BattleResult{
		ID:                battleID,
		AttackerID:        attackerID,
		DefenderID:        defenderID,
		TargetRegion:      targetRegion,
		Result:            result,
		AttackerSurvivors: attackers,
		DefenderSurvivors: defenders,
		MCLooted:          mcLooted,
		BuildingsCaptured: nil, // 건물 점령은 상위 레이어에서 처리
		ReplayFrames:      replayFrames,
		Duration:          finalTick,
	}

	slog.Info("battle: simulation completed",
		"battleID", battleID,
		"attacker", attackerID,
		"defender", defenderID,
		"region", targetRegion,
		"result", result,
		"duration", finalTick,
		"mcLooted", mcLooted,
		"attackerSurvivors", len(attackers),
		"defenderSurvivors", len(defenders),
	)

	return battleResult, nil
}

// ── 틱 처리 로직 ──

// processTick는 1틱의 전투를 처리한다.
// 틱 0~9: 방어 시설만 선제 공격 (DefensePreemptTicks)
// 틱 10~179: 양측 유닛 + 방어 시설 동시 교전
func (bs *BattleSimulator) processTick(
	tick int,
	attackers, defenders []*BattleUnit,
	defenses []*BattleDefense,
) []string {
	events := make([]string, 0, 8)

	// 성벽 존재 확인
	wallHP := totalWallHP(defenses)

	// ── 방어 시설 공격 (모든 틱에서 활성) ──
	for _, def := range defenses {
		if !def.Active || def.HP <= 0 || def.DPS <= 0 {
			continue
		}
		// 방어 시설 DPS를 살아있는 공격 유닛에 분산
		aliveAttackers := aliveUnits(attackers)
		if len(aliveAttackers) == 0 {
			break
		}
		dpsPerUnit := def.DPS / len(aliveAttackers)
		if dpsPerUnit < 1 {
			dpsPerUnit = 1
		}
		for _, target := range aliveAttackers {
			dmg := dpsPerUnit - target.Defense/4
			if dmg < 1 {
				dmg = 1
			}
			target.HP -= dmg
		}
		events = append(events, fmt.Sprintf("%s_fires", def.Type))
	}

	// ── 선제 공격 구간 (첫 10틱): 공격측 유닛은 아직 교전 불가 ──
	if tick < DefensePreemptTicks {
		return events
	}

	// ── 공격측 유닛 전투 ──
	for _, atk := range attackers {
		if atk.HP <= 0 || atk.Count <= 0 {
			continue
		}

		// 성벽이 살아있으면 지상 유닛은 성벽을 공격해야 한다
		if wallHP > 0 && !atk.IsAir {
			dmg := calcDamage(atk.Attack, atk.Count, 0)
			wallDef := findActiveWall(defenses)
			if wallDef != nil {
				wallDef.HP -= dmg
				events = append(events, fmt.Sprintf("%s_attacks_wall", atk.Type))
			}
			continue
		}

		// Air 유닛 또는 성벽 파괴 후 → 적 유닛 공격
		target := pickRandomTarget(defenders)
		if target == nil {
			// 적 유닛 없으면 방어 시설 공격
			defTarget := pickRandomDefenseTarget(defenses)
			if defTarget != nil {
				dmg := calcDamage(atk.Attack, atk.Count, 0)
				defTarget.HP -= dmg
				events = append(events, fmt.Sprintf("%s_attacks_%s", atk.Type, defTarget.Type))
			}
			continue
		}
		dmg := calcDamage(atk.Attack, atk.Count, target.Defense)
		target.HP -= dmg
		events = append(events, fmt.Sprintf("%s_attacks_%s", atk.Type, target.Type))
	}

	// ── 방어측 유닛 전투 ──
	for _, def := range defenders {
		if def.HP <= 0 || def.Count <= 0 {
			continue
		}
		target := pickRandomTarget(attackers)
		if target == nil {
			continue
		}
		dmg := calcDamage(def.Attack, def.Count, target.Defense)
		target.HP -= dmg
		events = append(events, fmt.Sprintf("%s_defends_%s", def.Type, target.Type))
	}

	// 성벽 HP 재계산 (파괴 체크)
	recalcWallHP(defenses)

	return events
}

// ── 전투 유틸리티 함수 ──

// calcDamage는 피해를 계산한다.
// 피해 = attack * count * (0.9 + rand*0.2) - targetDefense * 0.5
func calcDamage(attack, count, targetDefense int) int {
	rawDmg := float64(attack) * float64(count) * (0.9 + rand.Float64()*0.2)
	reduction := float64(targetDefense) * 0.5
	dmg := int(rawDmg - reduction)
	if dmg < 1 {
		dmg = 1
	}
	return dmg
}

// pickRandomTarget는 HP > 0인 유닛 중 랜덤 선택
func pickRandomTarget(units []*BattleUnit) *BattleUnit {
	alive := aliveUnits(units)
	if len(alive) == 0 {
		return nil
	}
	return alive[rand.Intn(len(alive))]
}

// pickRandomDefenseTarget는 활성 방어 시설 중 랜덤 선택
func pickRandomDefenseTarget(defenses []*BattleDefense) *BattleDefense {
	alive := make([]*BattleDefense, 0)
	for _, d := range defenses {
		if d.Active && d.HP > 0 {
			alive = append(alive, d)
		}
	}
	if len(alive) == 0 {
		return nil
	}
	return alive[rand.Intn(len(alive))]
}

// aliveUnits는 HP > 0인 유닛만 반환
func aliveUnits(units []*BattleUnit) []*BattleUnit {
	alive := make([]*BattleUnit, 0, len(units))
	for _, u := range units {
		if u.HP > 0 {
			alive = append(alive, u)
		}
	}
	return alive
}

// removeDead는 HP <= 0인 유닛을 제거하고 살아있는 유닛만 반환
func removeDead(units []*BattleUnit) []*BattleUnit {
	alive := make([]*BattleUnit, 0, len(units))
	for _, u := range units {
		if u.HP > 0 {
			alive = append(alive, u)
		}
	}
	return alive
}

// removeDeadDefenses는 HP <= 0인 방어 시설을 비활성화
func removeDeadDefenses(defenses []*BattleDefense) []*BattleDefense {
	for _, d := range defenses {
		if d.HP <= 0 {
			d.Active = false
		}
	}
	return defenses
}

// totalWallHP는 활성 성벽의 총 HP를 반환
func totalWallHP(defenses []*BattleDefense) int {
	total := 0
	for _, d := range defenses {
		if d.Active && d.HP > 0 && DefenseType(d.Type) == DefWall {
			total += d.HP
		}
	}
	return total
}

// findActiveWall는 첫 번째 활성 성벽을 반환
func findActiveWall(defenses []*BattleDefense) *BattleDefense {
	for _, d := range defenses {
		if d.Active && d.HP > 0 && DefenseType(d.Type) == DefWall {
			return d
		}
	}
	return nil
}

// recalcWallHP는 성벽 파괴 여부를 체크하여 비활성화
func recalcWallHP(defenses []*BattleDefense) {
	for _, d := range defenses {
		if DefenseType(d.Type) == DefWall && d.HP <= 0 {
			d.Active = false
		}
	}
}

// captureSnapshot는 현재 전투 상태 스냅샷을 생성한다 (deep copy).
func captureSnapshot(tick int, attackers, defenders []*BattleUnit, defenses []*BattleDefense) *BattleTickFrame {
	frame := &BattleTickFrame{
		Tick:          tick,
		AttackerUnits: make([]*BattleUnit, len(attackers)),
		DefenderUnits: make([]*BattleUnit, len(defenders)),
		Defenses:      make([]*BattleDefense, len(defenses)),
		Events:        nil,
	}
	for i, u := range attackers {
		cp := *u
		frame.AttackerUnits[i] = &cp
	}
	for i, u := range defenders {
		cp := *u
		frame.DefenderUnits[i] = &cp
	}
	for i, d := range defenses {
		cp := *d
		frame.Defenses[i] = &cp
	}
	return frame
}

// ── 결과 판정 ──

// determineResult는 전투 결과를 판정한다.
//   - 공격자 유닛 전멸 → "defender_win"
//   - 방어자 유닛+시설 전멸 → "attacker_win"
//   - 타임아웃 → 생존 HP 비교 → 높은 쪽 승리, 동률이면 "draw"
func determineResult(attackers, defenders []*BattleUnit, defenses []*BattleDefense) string {
	atkHP := totalUnitHP(attackers)
	defHP := totalUnitHP(defenders)
	defStructHP := totalDefenseHP(defenses)

	// 공격자 전멸
	if atkHP <= 0 {
		return "defender_win"
	}
	// 방어자 유닛 + 방어 시설 전멸
	if defHP <= 0 && defStructHP <= 0 {
		return "attacker_win"
	}
	// 타임아웃: HP 비교
	totalDefSide := defHP + defStructHP
	if atkHP > totalDefSide {
		return "attacker_win"
	} else if totalDefSide > atkHP {
		return "defender_win"
	}
	return "draw"
}

// totalUnitHP는 모든 유닛의 총 HP를 반환
func totalUnitHP(units []*BattleUnit) int {
	total := 0
	for _, u := range units {
		if u.HP > 0 {
			total += u.HP
		}
	}
	return total
}

// totalDefenseHP는 활성 방어 시설의 총 HP를 반환
func totalDefenseHP(defenses []*BattleDefense) int {
	total := 0
	for _, d := range defenses {
		if d.Active && d.HP > 0 {
			total += d.HP
		}
	}
	return total
}

// ── 약탈 계산 ──

// calculateLoot는 공격 승리 시 약탈량을 계산한다.
// 약탈량 = min(defender MC * MaxLootPct, 생존 공격 유닛 수 * LootPerSurvivor)
func (bs *BattleSimulator) calculateLoot(ctx context.Context, defenderID string, survivors []*BattleUnit) int64 {
	// 방어자 MC 잔고 조회
	var defenderMC int64
	err := bs.pg.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1", defenderID,
	).Scan(&defenderMC)
	if err != nil {
		slog.Warn("battle: failed to query defender balance for loot calc",
			"defenderID", defenderID,
			"error", err,
		)
		return 0
	}

	maxFromDefender := int64(float64(defenderMC) * MaxLootPct)

	// 생존 유닛 수 합산
	var totalSurvivors int
	for _, u := range survivors {
		if u.HP > 0 {
			totalSurvivors += u.Count
		}
	}
	maxFromSurvivors := int64(totalSurvivors) * LootPerSurvivor

	// 적은 쪽 선택
	loot := maxFromDefender
	if maxFromSurvivors < loot {
		loot = maxFromSurvivors
	}
	if loot < 0 {
		loot = 0
	}
	return loot
}

// ── DB 저장/조회 ──

// SaveBattleResult는 전투 결과를 DB에 저장한다.
func (bs *BattleSimulator) SaveBattleResult(ctx context.Context, result *BattleResult) error {
	// 공격자/방어자 유닛 JSON 직렬화
	atkJSON, err := json.Marshal(result.AttackerSurvivors)
	if err != nil {
		return fmt.Errorf("marshal attacker survivors: %w", err)
	}
	defJSON, err := json.Marshal(result.DefenderSurvivors)
	if err != nil {
		return fmt.Errorf("marshal defender survivors: %w", err)
	}
	replayJSON, err := json.Marshal(result.ReplayFrames)
	if err != nil {
		return fmt.Errorf("marshal replay frames: %w", err)
	}

	_, err = bs.pg.Exec(ctx, `
		INSERT INTO battles (
			id, attacker_id, defender_id, target_region, status, result,
			attacker_units, defender_units, replay_data,
			mc_looted, buildings_captured,
			started_at, completed_at
		) VALUES (
			$1, $2, $3, $4, 'completed', $5,
			$6, $7, $8,
			$9, $10,
			NOW(), NOW()
		)
	`,
		result.ID, result.AttackerID, result.DefenderID, result.TargetRegion, result.Result,
		atkJSON, defJSON, replayJSON,
		result.MCLooted, result.BuildingsCaptured,
	)
	if err != nil {
		return fmt.Errorf("insert battle result: %w", err)
	}

	slog.Info("battle: result saved to DB",
		"battleID", result.ID,
		"result", result.Result,
	)
	return nil
}

// GetBattleHistory는 플레이어의 최근 전투 기록을 조회한다.
func (bs *BattleSimulator) GetBattleHistory(ctx context.Context, playerID string, limit int) ([]*BattleResult, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := bs.pg.Query(ctx, `
		SELECT id, attacker_id, defender_id, target_region, result,
		       attacker_units, defender_units, mc_looted, buildings_captured,
		       completed_at
		FROM battles
		WHERE (attacker_id = $1 OR defender_id = $1)
		  AND status = 'completed'
		ORDER BY completed_at DESC
		LIMIT $2
	`, playerID, limit)
	if err != nil {
		return nil, fmt.Errorf("query battle history: %w", err)
	}
	defer rows.Close()

	results := make([]*BattleResult, 0)
	for rows.Next() {
		br := &BattleResult{}
		var atkJSON, defJSON []byte
		var completedAt *time.Time

		err := rows.Scan(
			&br.ID, &br.AttackerID, &br.DefenderID, &br.TargetRegion, &br.Result,
			&atkJSON, &defJSON, &br.MCLooted, &br.BuildingsCaptured,
			&completedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan battle row: %w", err)
		}

		// JSON 역직렬화 (리플레이는 포함하지 않음 — 목록 조회)
		if len(atkJSON) > 0 {
			_ = json.Unmarshal(atkJSON, &br.AttackerSurvivors)
		}
		if len(defJSON) > 0 {
			_ = json.Unmarshal(defJSON, &br.DefenderSurvivors)
		}

		results = append(results, br)
	}

	return results, rows.Err()
}

// GetBattleReplay는 전투 리플레이 데이터를 포함한 전체 결과를 조회한다.
func (bs *BattleSimulator) GetBattleReplay(ctx context.Context, battleID string) (*BattleResult, error) {
	br := &BattleResult{}
	var atkJSON, defJSON, replayJSON []byte
	var completedAt *time.Time

	err := bs.pg.QueryRow(ctx, `
		SELECT id, attacker_id, defender_id, target_region, result,
		       attacker_units, defender_units, replay_data,
		       mc_looted, buildings_captured,
		       completed_at
		FROM battles
		WHERE id = $1
	`, battleID).Scan(
		&br.ID, &br.AttackerID, &br.DefenderID, &br.TargetRegion, &br.Result,
		&atkJSON, &defJSON, &replayJSON,
		&br.MCLooted, &br.BuildingsCaptured,
		&completedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query battle replay: %w", err)
	}

	// JSON 역직렬화
	if len(atkJSON) > 0 {
		_ = json.Unmarshal(atkJSON, &br.AttackerSurvivors)
	}
	if len(defJSON) > 0 {
		_ = json.Unmarshal(defJSON, &br.DefenderSurvivors)
	}
	if len(replayJSON) > 0 {
		_ = json.Unmarshal(replayJSON, &br.ReplayFrames)
	}

	return br, nil
}
