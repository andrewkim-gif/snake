package game

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/debug"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonDiplomacySystem: 동맹 + 전쟁 PG 영속화 시스템
//
// 기존 AllianceManager (in-memory, nation 기반)을 건물 소유 기반
// 타이쿤 모드로 재작성. PostgreSQL 트랜잭션으로 영속화.
//
// 동맹:
//   - 최대 5명, 리더 1명
//   - 탈퇴 후 72시간 배신 쿨다운 (alliance_members.left_at 추적)
//   - 리더 탈퇴 시 자동 해산
//
// 전쟁:
//   - 선전포고 비용 50,000 MC
//   - Declaration → 24h Preparation → Active (max 72h) → Ended
//   - 건물 탈취 10점, 전투 승리 5점
//   - 점수 차 50+ → 즉시 종료
//   - 항복 → 패배자 건물 30% 승자에게 이전
//
// 주기적 처리:
//   StartWarProcessor: 1분 간격 상태 전환 (prep→active, active→ended)
// ============================================================

// ── 동맹 상수 ──

const (
	// TycoonMaxAllianceMembers는 동맹 최대 인원
	TycoonMaxAllianceMembers = 5

	// TycoonBetrayalCooldown는 탈퇴 후 재가입 불가 기간 (72시간)
	TycoonBetrayalCooldown = 72 * time.Hour
)

// ── 전쟁 상수 ──

const (
	// TycoonWarPreparationTime는 선전포고 후 준비 기간 (24시간)
	TycoonWarPreparationTime = 24 * time.Hour

	// TycoonWarDuration는 전쟁 최대 지속 시간 (72시간)
	TycoonWarDuration = 72 * time.Hour

	// TycoonWarDeclareCost는 선전포고 비용 MC
	TycoonWarDeclareCost = int64(50000)

	// TycoonWarScoreBuilding는 건물 탈취 시 전쟁 점수
	TycoonWarScoreBuilding = 10

	// TycoonWarScoreBattle는 전투 승리 시 전쟁 점수
	TycoonWarScoreBattle = 5

	// TycoonWarScoreAutoEnd는 점수 차 이 값 이상 시 자동 종료
	TycoonWarScoreAutoEnd = 50

	// TycoonWarSurrenderTransferPct는 항복 시 건물 이전 비율 (30%)
	TycoonWarSurrenderTransferPct = 0.30

	// TycoonWarProcessorInterval는 전쟁 프로세서 실행 간격 (1분)
	TycoonWarProcessorInterval = 1 * time.Minute
)

// ── 타이쿤 전쟁 상태 (기존 WarState 재사용) ──
// WarStatePreparation, WarStateActive, WarStateEnded는 war_state.go에 정의

// ── 구조체 ──

// TycoonAlliance는 PG 영속 동맹 엔티티
type TycoonAlliance struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	LeaderID string    `json:"leader_id"`
	Members  []string  `json:"members"`
	FormedAt time.Time `json:"formed_at"`
}

// TycoonWar는 PG 영속 전쟁 엔티티
type TycoonWar struct {
	ID            string     `json:"id"`
	State         WarState   `json:"state"`
	AttackerID    string     `json:"attacker_id"`
	DefenderID    string     `json:"defender_id"`
	AttackerScore int        `json:"attacker_score"`
	DefenderScore int        `json:"defender_score"`
	DeclaredAt    time.Time  `json:"declared_at"`
	ActivatedAt   *time.Time `json:"activated_at,omitempty"`
	EndedAt       *time.Time `json:"ended_at,omitempty"`
	Outcome       *string    `json:"outcome,omitempty"`
}

// TycoonDiplomacySystem는 pgxpool 기반 동맹+전쟁 매니저
type TycoonDiplomacySystem struct {
	pg *pgxpool.Pool
}

// NewTycoonDiplomacySystem는 새 TycoonDiplomacySystem을 생성한다.
func NewTycoonDiplomacySystem(pg *pgxpool.Pool) *TycoonDiplomacySystem {
	return &TycoonDiplomacySystem{pg: pg}
}

// ================================================================
// 동맹 시스템
// ================================================================

// CreateAlliance는 새 동맹을 생성하고 리더를 첫 멤버로 추가한다.
func (ds *TycoonDiplomacySystem) CreateAlliance(ctx context.Context, leaderID, name string) (*TycoonAlliance, error) {
	// 이미 동맹에 속해있는지 확인
	existing, _ := ds.GetPlayerAlliance(ctx, leaderID)
	if existing != nil {
		return nil, fmt.Errorf("player %s is already in alliance %s", leaderID, existing.ID)
	}

	allianceID := uuid.New().String()
	now := time.Now()

	tx, err := ds.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("create alliance begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// INSERT alliances
	_, err = tx.Exec(ctx,
		"INSERT INTO alliances (id, name, leader_id, formed_at) VALUES ($1, $2, $3, $4)",
		allianceID, name, leaderID, now,
	)
	if err != nil {
		return nil, fmt.Errorf("create alliance insert: %w", err)
	}

	// INSERT alliance_members (리더)
	_, err = tx.Exec(ctx,
		"INSERT INTO alliance_members (alliance_id, player_id, joined_at) VALUES ($1, $2, $3)",
		allianceID, leaderID, now,
	)
	if err != nil {
		return nil, fmt.Errorf("create alliance insert leader member: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("create alliance commit: %w", err)
	}

	slog.Info("tycoon-diplomacy: alliance created",
		"allianceId", allianceID,
		"name", name,
		"leader", leaderID,
	)

	return &TycoonAlliance{
		ID:       allianceID,
		Name:     name,
		LeaderID: leaderID,
		Members:  []string{leaderID},
		FormedAt: now,
	}, nil
}

// JoinAlliance는 플레이어를 기존 동맹에 추가한다.
// 멤버 수 제한(5명)과 배신 쿨다운(72시간)을 확인한다.
func (ds *TycoonDiplomacySystem) JoinAlliance(ctx context.Context, allianceID, playerID string) error {
	// 이미 동맹에 속해있는지 확인
	existing, _ := ds.GetPlayerAlliance(ctx, playerID)
	if existing != nil {
		return fmt.Errorf("player %s is already in alliance %s", playerID, existing.ID)
	}

	// 배신 쿨다운 확인: left_at이 72시간 이내인 기록이 있는지
	var cooldownCount int
	err := ds.pg.QueryRow(ctx,
		`SELECT COUNT(*) FROM alliance_members
		 WHERE player_id = $1 AND left_at IS NOT NULL
		   AND left_at > NOW() - INTERVAL '72 hours'`,
		playerID,
	).Scan(&cooldownCount)
	if err != nil {
		return fmt.Errorf("join alliance check cooldown: %w", err)
	}
	if cooldownCount > 0 {
		return fmt.Errorf("player %s is in betrayal cooldown (72h after leaving alliance)", playerID)
	}

	// 현재 멤버 수 확인
	var memberCount int
	err = ds.pg.QueryRow(ctx,
		"SELECT COUNT(*) FROM alliance_members WHERE alliance_id = $1 AND left_at IS NULL",
		allianceID,
	).Scan(&memberCount)
	if err != nil {
		return fmt.Errorf("join alliance count members: %w", err)
	}
	if memberCount >= TycoonMaxAllianceMembers {
		return fmt.Errorf("alliance %s is full (%d/%d)", allianceID, memberCount, TycoonMaxAllianceMembers)
	}

	// INSERT alliance_members
	_, err = ds.pg.Exec(ctx,
		"INSERT INTO alliance_members (alliance_id, player_id, joined_at) VALUES ($1, $2, NOW())",
		allianceID, playerID,
	)
	if err != nil {
		return fmt.Errorf("join alliance insert member: %w", err)
	}

	slog.Info("tycoon-diplomacy: player joined alliance",
		"allianceId", allianceID,
		"player", playerID,
	)
	return nil
}

// LeaveAlliance는 플레이어를 동맹에서 탈퇴시킨다.
// 리더 탈퇴 시 자동 해산한다. left_at을 기록하여 배신 쿨다운을 추적한다.
func (ds *TycoonDiplomacySystem) LeaveAlliance(ctx context.Context, allianceID, playerID string) error {
	// 동맹 조회
	alliance, err := ds.GetAlliance(ctx, allianceID)
	if err != nil {
		return fmt.Errorf("leave alliance get: %w", err)
	}

	// 리더가 탈퇴 → 자동 해산
	if alliance.LeaderID == playerID {
		return ds.DisbandAlliance(ctx, allianceID, playerID)
	}

	// 일반 멤버 탈퇴: left_at 기록 (soft delete)
	tag, err := ds.pg.Exec(ctx,
		"UPDATE alliance_members SET left_at = NOW() WHERE alliance_id = $1 AND player_id = $2 AND left_at IS NULL",
		allianceID, playerID,
	)
	if err != nil {
		return fmt.Errorf("leave alliance update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("player %s is not an active member of alliance %s", playerID, allianceID)
	}

	slog.Info("tycoon-diplomacy: player left alliance",
		"allianceId", allianceID,
		"player", playerID,
	)
	return nil
}

// DisbandAlliance는 동맹을 해산한다. 리더만 실행 가능.
// 모든 멤버의 left_at을 기록한 후 동맹을 삭제한다.
func (ds *TycoonDiplomacySystem) DisbandAlliance(ctx context.Context, allianceID, leaderID string) error {
	tx, err := ds.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("disband alliance begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 리더 확인
	var dbLeaderID string
	err = tx.QueryRow(ctx, "SELECT leader_id FROM alliances WHERE id = $1", allianceID).Scan(&dbLeaderID)
	if err != nil {
		return fmt.Errorf("disband alliance query leader: %w", err)
	}
	if dbLeaderID != leaderID {
		return fmt.Errorf("player %s is not the leader of alliance %s", leaderID, allianceID)
	}

	// 모든 활성 멤버 left_at 기록 (배신 쿨다운 추적)
	_, err = tx.Exec(ctx,
		"UPDATE alliance_members SET left_at = NOW() WHERE alliance_id = $1 AND left_at IS NULL",
		allianceID,
	)
	if err != nil {
		return fmt.Errorf("disband alliance update members: %w", err)
	}

	// 동맹 삭제 (CASCADE로 alliance_members 행도 삭제)
	_, err = tx.Exec(ctx, "DELETE FROM alliances WHERE id = $1", allianceID)
	if err != nil {
		return fmt.Errorf("disband alliance delete: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("disband alliance commit: %w", err)
	}

	slog.Info("tycoon-diplomacy: alliance disbanded",
		"allianceId", allianceID,
		"leader", leaderID,
	)
	return nil
}

// GetAlliance는 동맹 ID로 동맹을 조회한다. 활성 멤버 목록을 포함한다.
func (ds *TycoonDiplomacySystem) GetAlliance(ctx context.Context, allianceID string) (*TycoonAlliance, error) {
	var a TycoonAlliance
	err := ds.pg.QueryRow(ctx,
		"SELECT id, name, leader_id, formed_at FROM alliances WHERE id = $1",
		allianceID,
	).Scan(&a.ID, &a.Name, &a.LeaderID, &a.FormedAt)
	if err != nil {
		return nil, fmt.Errorf("get alliance %s: %w", allianceID, err)
	}

	// 활성 멤버 목록 조회
	rows, err := ds.pg.Query(ctx,
		"SELECT player_id FROM alliance_members WHERE alliance_id = $1 AND left_at IS NULL ORDER BY joined_at",
		allianceID,
	)
	if err != nil {
		return nil, fmt.Errorf("get alliance members %s: %w", allianceID, err)
	}
	defer rows.Close()

	for rows.Next() {
		var pid string
		if err := rows.Scan(&pid); err != nil {
			return nil, fmt.Errorf("get alliance scan member: %w", err)
		}
		a.Members = append(a.Members, pid)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get alliance members iteration: %w", err)
	}

	return &a, nil
}

// GetPlayerAlliance는 플레이어가 속한 동맹을 조회한다.
// 활성 멤버십(left_at IS NULL)만 검색한다.
func (ds *TycoonDiplomacySystem) GetPlayerAlliance(ctx context.Context, playerID string) (*TycoonAlliance, error) {
	var allianceID string
	err := ds.pg.QueryRow(ctx,
		"SELECT alliance_id FROM alliance_members WHERE player_id = $1 AND left_at IS NULL",
		playerID,
	).Scan(&allianceID)
	if err != nil {
		return nil, fmt.Errorf("get player alliance for %s: %w", playerID, err)
	}
	return ds.GetAlliance(ctx, allianceID)
}

// ================================================================
// 전쟁 시스템
// ================================================================

// DeclareWar는 선전포고를 처리한다.
// 1. 비용 차감 (50,000 MC)
// 2. INSERT wars (state=preparation)
func (ds *TycoonDiplomacySystem) DeclareWar(ctx context.Context, attackerID, defenderID string) (*TycoonWar, error) {
	if attackerID == defenderID {
		return nil, fmt.Errorf("cannot declare war on yourself")
	}

	// 이미 진행 중인 전쟁이 있는지 확인
	var activeCount int
	err := ds.pg.QueryRow(ctx,
		`SELECT COUNT(*) FROM wars
		 WHERE state IN ('preparation', 'active')
		   AND ((attacker_id = $1 AND defender_id = $2)
		     OR (attacker_id = $2 AND defender_id = $1))`,
		attackerID, defenderID,
	).Scan(&activeCount)
	if err != nil {
		return nil, fmt.Errorf("declare war check existing: %w", err)
	}
	if activeCount > 0 {
		return nil, fmt.Errorf("war already in progress between %s and %s", attackerID, defenderID)
	}

	tx, err := ds.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("declare war begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. 선전포고 비용 차감 (SELECT FOR UPDATE → UPDATE)
	var balance int64
	err = tx.QueryRow(ctx,
		"SELECT mc_balance FROM players WHERE id = $1 FOR UPDATE",
		attackerID,
	).Scan(&balance)
	if err != nil {
		return nil, fmt.Errorf("declare war query balance: %w", err)
	}
	if balance < TycoonWarDeclareCost {
		return nil, fmt.Errorf("insufficient MC: has %d, needs %d", balance, TycoonWarDeclareCost)
	}

	_, err = tx.Exec(ctx,
		"UPDATE players SET mc_balance = mc_balance - $1 WHERE id = $2",
		TycoonWarDeclareCost, attackerID,
	)
	if err != nil {
		return nil, fmt.Errorf("declare war deduct MC: %w", err)
	}

	// 거래 기록
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, description)
		 VALUES ($1, 'war_declaration', $2, $3, $4, $5)`,
		attackerID, -TycoonWarDeclareCost, balance, balance-TycoonWarDeclareCost,
		fmt.Sprintf("War declaration against %s", defenderID),
	)
	if err != nil {
		return nil, fmt.Errorf("declare war insert transaction: %w", err)
	}

	// 2. INSERT wars
	warID := uuid.New().String()
	now := time.Now()

	_, err = tx.Exec(ctx,
		`INSERT INTO wars (id, state, declaration_type, attacker_id, defender_id, attacker_score, defender_score, declared_at)
		 VALUES ($1, $2, $3, $4, $5, 0, 0, $6)`,
		warID, string(WarStatePreparation), "hegemony", attackerID, defenderID, now,
	)
	if err != nil {
		return nil, fmt.Errorf("declare war insert: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("declare war commit: %w", err)
	}

	slog.Info("tycoon-diplomacy: war declared",
		"warId", warID,
		"attacker", attackerID,
		"defender", defenderID,
		"cost", TycoonWarDeclareCost,
	)

	return &TycoonWar{
		ID:            warID,
		State:         WarStatePreparation,
		AttackerID:    attackerID,
		DefenderID:    defenderID,
		AttackerScore: 0,
		DefenderScore: 0,
		DeclaredAt:    now,
	}, nil
}

// ActivateWar는 전쟁을 preparation → active 상태로 전환한다.
func (ds *TycoonDiplomacySystem) ActivateWar(ctx context.Context, warID string) error {
	now := time.Now()
	tag, err := ds.pg.Exec(ctx,
		"UPDATE wars SET state = $1, activated_at = $2 WHERE id = $3 AND state = $4",
		string(WarStateActive), now, warID, string(WarStatePreparation),
	)
	if err != nil {
		return fmt.Errorf("activate war %s: %w", warID, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("war %s is not in preparation state", warID)
	}

	slog.Info("tycoon-diplomacy: war activated", "warId", warID)
	return nil
}

// AddWarScore는 전쟁 점수를 추가한다.
// side는 "attacker" 또는 "defender"이어야 한다.
func (ds *TycoonDiplomacySystem) AddWarScore(ctx context.Context, warID, side string, points int) error {
	var col string
	switch side {
	case "attacker":
		col = "attacker_score"
	case "defender":
		col = "defender_score"
	default:
		return fmt.Errorf("invalid war side: %s (expected 'attacker' or 'defender')", side)
	}

	query := fmt.Sprintf(
		"UPDATE wars SET %s = %s + $1 WHERE id = $2 AND state = $3",
		col, col,
	)
	tag, err := ds.pg.Exec(ctx, query, points, warID, string(WarStateActive))
	if err != nil {
		return fmt.Errorf("add war score %s/%s: %w", warID, side, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("war %s is not in active state", warID)
	}

	slog.Info("tycoon-diplomacy: war score added",
		"warId", warID,
		"side", side,
		"points", points,
	)
	return nil
}

// EndWar는 전쟁을 종료하고 결과를 판정한다.
// 점수 비교 → 결과 판정 (attacker_win / defender_win / draw).
func (ds *TycoonDiplomacySystem) EndWar(ctx context.Context, warID string) (*TycoonWar, error) {
	war, err := ds.GetWarByID(ctx, warID)
	if err != nil {
		return nil, fmt.Errorf("end war get: %w", err)
	}
	if war.State == WarStateEnded {
		return war, nil // 이미 종료
	}

	// 결과 판정
	var outcome string
	switch {
	case war.AttackerScore > war.DefenderScore:
		outcome = string(WarOutcomeAttackerWin)
	case war.DefenderScore > war.AttackerScore:
		outcome = string(WarOutcomeDefenderWin)
	default:
		outcome = "draw"
	}

	now := time.Now()
	_, err = ds.pg.Exec(ctx,
		"UPDATE wars SET state = $1, ended_at = $2, outcome = $3 WHERE id = $4",
		string(WarStateEnded), now, outcome, warID,
	)
	if err != nil {
		return nil, fmt.Errorf("end war update: %w", err)
	}

	war.State = WarStateEnded
	war.EndedAt = &now
	war.Outcome = &outcome

	slog.Info("tycoon-diplomacy: war ended",
		"warId", warID,
		"outcome", outcome,
		"attackerScore", war.AttackerScore,
		"defenderScore", war.DefenderScore,
	)
	return war, nil
}

// Surrender는 항복을 처리한다.
// 항복한 측의 건물 30%를 상대방에게 이전한다.
func (ds *TycoonDiplomacySystem) Surrender(ctx context.Context, warID, playerID string) error {
	war, err := ds.GetWarByID(ctx, warID)
	if err != nil {
		return fmt.Errorf("surrender get war: %w", err)
	}
	if war.State != WarStateActive {
		return fmt.Errorf("war %s is not active (state: %s)", warID, war.State)
	}

	// 항복자 → 패배자, 상대방 → 승자
	var loserID, winnerID string
	switch playerID {
	case war.AttackerID:
		loserID = war.AttackerID
		winnerID = war.DefenderID
	case war.DefenderID:
		loserID = war.DefenderID
		winnerID = war.AttackerID
	default:
		return fmt.Errorf("player %s is not a participant in war %s", playerID, warID)
	}

	tx, err := ds.pg.Begin(ctx)
	if err != nil {
		return fmt.Errorf("surrender begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 패배자 건물 30% 이전: 랜덤 선택을 위해 LIMIT 계산
	var totalBuildings int
	err = tx.QueryRow(ctx,
		"SELECT COUNT(*) FROM buildings WHERE owner_id = $1",
		loserID,
	).Scan(&totalBuildings)
	if err != nil {
		return fmt.Errorf("surrender count buildings: %w", err)
	}

	transferCount := int(float64(totalBuildings) * TycoonWarSurrenderTransferPct)
	if transferCount < 1 && totalBuildings > 0 {
		transferCount = 1 // 최소 1개 이전
	}

	if transferCount > 0 {
		// 승자 이름 조회
		var winnerName string
		_ = tx.QueryRow(ctx, "SELECT name FROM players WHERE id = $1", winnerID).Scan(&winnerName)

		// 랜덤 건물 선택 → 소유권 이전
		_, err = tx.Exec(ctx,
			`UPDATE buildings SET owner_id = $1, owner_name = $2
			 WHERE id IN (
				SELECT id FROM buildings WHERE owner_id = $3
				ORDER BY RANDOM() LIMIT $4
			 )`,
			winnerID, winnerName, loserID, transferCount,
		)
		if err != nil {
			return fmt.Errorf("surrender transfer buildings: %w", err)
		}
	}

	// 전쟁 종료 (항복 결과)
	outcome := "surrender"
	now := time.Now()
	_, err = tx.Exec(ctx,
		"UPDATE wars SET state = $1, ended_at = $2, outcome = $3 WHERE id = $4",
		string(WarStateEnded), now, outcome, warID,
	)
	if err != nil {
		return fmt.Errorf("surrender update war: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("surrender commit: %w", err)
	}

	slog.Info("tycoon-diplomacy: surrender",
		"warId", warID,
		"loser", loserID,
		"winner", winnerID,
		"buildingsTransferred", transferCount,
	)
	return nil
}

// ================================================================
// 전쟁 조회
// ================================================================

// GetActiveWars는 진행 중(preparation + active)인 모든 전쟁을 반환한다.
func (ds *TycoonDiplomacySystem) GetActiveWars(ctx context.Context) ([]*TycoonWar, error) {
	rows, err := ds.pg.Query(ctx,
		`SELECT id, state, attacker_id, defender_id, attacker_score, defender_score,
		        declared_at, activated_at, ended_at, outcome
		 FROM wars WHERE state IN ('preparation', 'active')
		 ORDER BY declared_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("get active wars: %w", err)
	}
	return ds.scanWars(rows)
}

// GetWarByID는 전쟁 ID로 전쟁을 조회한다.
func (ds *TycoonDiplomacySystem) GetWarByID(ctx context.Context, warID string) (*TycoonWar, error) {
	var w TycoonWar
	err := ds.pg.QueryRow(ctx,
		`SELECT id, state, attacker_id, defender_id, attacker_score, defender_score,
		        declared_at, activated_at, ended_at, outcome
		 FROM wars WHERE id = $1`,
		warID,
	).Scan(
		&w.ID, &w.State, &w.AttackerID, &w.DefenderID,
		&w.AttackerScore, &w.DefenderScore,
		&w.DeclaredAt, &w.ActivatedAt, &w.EndedAt, &w.Outcome,
	)
	if err != nil {
		return nil, fmt.Errorf("get war %s: %w", warID, err)
	}
	return &w, nil
}

// scanWars는 pgx.Rows를 []*TycoonWar 슬라이스로 변환한다.
func (ds *TycoonDiplomacySystem) scanWars(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
	Err() error
}) ([]*TycoonWar, error) {
	defer rows.Close()
	var result []*TycoonWar
	for rows.Next() {
		var w TycoonWar
		if err := rows.Scan(
			&w.ID, &w.State, &w.AttackerID, &w.DefenderID,
			&w.AttackerScore, &w.DefenderScore,
			&w.DeclaredAt, &w.ActivatedAt, &w.EndedAt, &w.Outcome,
		); err != nil {
			return nil, fmt.Errorf("scan war row: %w", err)
		}
		result = append(result, &w)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan wars iteration: %w", err)
	}
	return result, nil
}

// ================================================================
// 주기적 전쟁 프로세서
// ================================================================

// StartWarProcessor는 1분마다 전쟁 상태를 확인하고 전환한다.
// - preparation → active: 24시간 경과
// - active → ended: 72시간 경과 또는 점수 차 50+
// context가 취소되면 프로세서가 종료된다.
func (ds *TycoonDiplomacySystem) StartWarProcessor(ctx context.Context) {
	ticker := time.NewTicker(TycoonWarProcessorInterval)
	defer ticker.Stop()

	slog.Info("tycoon-diplomacy: war processor started",
		"interval", TycoonWarProcessorInterval.String(),
	)

	for {
		select {
		case <-ctx.Done():
			slog.Info("tycoon-diplomacy: war processor stopped")
			return
		case <-ticker.C:
			if !debug.IsEnabled("tycoon") {
				continue
			}
			ds.processWarTransitions(ctx)
		}
	}
}

// processWarTransitions는 단일 실행 주기에서 전쟁 상태 전환을 처리한다.
func (ds *TycoonDiplomacySystem) processWarTransitions(ctx context.Context) {
	// 1. preparation → active (24시간 경과)
	prepTag, err := ds.pg.Exec(ctx,
		`UPDATE wars SET state = $1, activated_at = NOW()
		 WHERE state = $2 AND declared_at + INTERVAL '24 hours' <= NOW()`,
		string(WarStateActive), string(WarStatePreparation),
	)
	if err != nil {
		slog.Error("tycoon-diplomacy: failed to activate wars", "error", err)
	} else if prepTag.RowsAffected() > 0 {
		slog.Info("tycoon-diplomacy: wars activated",
			"count", prepTag.RowsAffected(),
		)
	}

	// 2. active → ended (72시간 경과)
	timeTag, err := ds.pg.Exec(ctx,
		`UPDATE wars SET state = $1, ended_at = NOW(),
		    outcome = CASE
		        WHEN attacker_score > defender_score THEN 'attacker_win'
		        WHEN defender_score > attacker_score THEN 'defender_win'
		        ELSE 'draw'
		    END
		 WHERE state = $2 AND activated_at + INTERVAL '72 hours' <= NOW()`,
		string(WarStateEnded), string(WarStateActive),
	)
	if err != nil {
		slog.Error("tycoon-diplomacy: failed to end timed-out wars", "error", err)
	} else if timeTag.RowsAffected() > 0 {
		slog.Info("tycoon-diplomacy: wars ended (time limit)",
			"count", timeTag.RowsAffected(),
		)
	}

	// 3. active → ended (점수 차 50+)
	scoreTag, err := ds.pg.Exec(ctx,
		`UPDATE wars SET state = $1, ended_at = NOW(),
		    outcome = CASE
		        WHEN attacker_score > defender_score THEN 'attacker_win'
		        ELSE 'defender_win'
		    END
		 WHERE state = $2
		   AND ABS(attacker_score - defender_score) >= $3`,
		string(WarStateEnded), string(WarStateActive), TycoonWarScoreAutoEnd,
	)
	if err != nil {
		slog.Error("tycoon-diplomacy: failed to end score-gap wars", "error", err)
	} else if scoreTag.RowsAffected() > 0 {
		slog.Info("tycoon-diplomacy: wars ended (score gap)",
			"count", scoreTag.RowsAffected(),
		)
	}
}
