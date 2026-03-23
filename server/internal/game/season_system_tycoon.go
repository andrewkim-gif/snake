package game

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonSeasonSystem: 시즌 관리 + 리더보드 서버
//
// 시즌:
//   - 기본 90일 (SeasonDurationDays)
//   - 활성 시즌 1개만 존재
//   - 시즌 종료 시 리더보드 TOP 3 보상 지급 + 새 시즌 자동 시작
//
// 리더보드:
//   - richest:   MC 잔고 기준
//   - landlord:  보유 건물 수 기준
//   - conqueror: 전투 승리 수 기준
//   - empire:    지배 영토 수 기준
//   - alliance:  동맹 총 자산 기준
//
// 주기적 처리:
//   StartSeasonChecker: 1시간 간격 시즌 종료 조건 확인
// ============================================================

// ── 시즌 상수 ──

const (
	// SeasonDurationDays는 시즌 기본 기간 (90일 = 3개월)
	SeasonDurationDays = 90

	// SeasonCheckInterval은 시즌 종료 확인 주기
	SeasonCheckInterval = 1 * time.Hour

	// SeasonRewardFirst는 시즌 1위 보상 MC
	SeasonRewardFirst = 1_000_000
	// SeasonRewardSecond는 시즌 2위 보상 MC
	SeasonRewardSecond = 500_000
	// SeasonRewardThird는 시즌 3위 보상 MC
	SeasonRewardThird = 250_000
)

// ── 시즌 구조체 ──

// TycoonSeason은 시즌 레코드
type TycoonSeason struct {
	ID       string    `json:"id"`
	Number   int       `json:"number"`
	StartAt  time.Time `json:"start_at"`
	EndAt    time.Time `json:"end_at"`
	IsActive bool      `json:"is_active"`
}

// ── 리더보드 ──

// LeaderboardEntry는 리더보드 한 행
type LeaderboardEntry struct {
	Rank       int    `json:"rank"`
	PlayerID   string `json:"player_id"`
	PlayerName string `json:"player_name"`
	Value      int64  `json:"value"`
}

// LeaderboardType은 리더보드 분류
type LeaderboardType string

const (
	// LBRichest는 MC 잔고 순위
	LBRichest LeaderboardType = "richest"
	// LBLandlord는 건물 보유 수 순위
	LBLandlord LeaderboardType = "landlord"
	// LBConqueror는 전투 승리 수 순위
	LBConqueror LeaderboardType = "conqueror"
	// LBEmpire는 영토 지배 수 순위
	LBEmpire LeaderboardType = "empire"
	// LBAlliance는 동맹 총 자산 순위
	LBAlliance LeaderboardType = "alliance"
)

// ── TycoonSeasonSystem ──

// TycoonSeasonSystem은 시즌/리더보드 관리를 담당
type TycoonSeasonSystem struct {
	pg    *pgxpool.Pool
	event *TycoonEventSystem
}

// NewTycoonSeasonSystem은 TycoonSeasonSystem을 생성한다.
func NewTycoonSeasonSystem(pg *pgxpool.Pool, event *TycoonEventSystem) *TycoonSeasonSystem {
	return &TycoonSeasonSystem{pg: pg, event: event}
}

// GetCurrentSeason은 현재 활성 시즌을 조회한다.
// 활성 시즌이 없으면 nil, nil을 반환한다.
func (ss *TycoonSeasonSystem) GetCurrentSeason(ctx context.Context) (*TycoonSeason, error) {
	row := ss.pg.QueryRow(ctx,
		`SELECT id, number, start_at, end_at, is_active
		 FROM tycoon_seasons
		 WHERE is_active = TRUE
		 LIMIT 1`,
	)
	s := &TycoonSeason{}
	err := row.Scan(&s.ID, &s.Number, &s.StartAt, &s.EndAt, &s.IsActive)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("query current season: %w", err)
	}
	return s, nil
}

// GetLeaderboard는 특정 리더보드 타입의 TOP N을 조회한다.
func (ss *TycoonSeasonSystem) GetLeaderboard(
	ctx context.Context,
	lbType LeaderboardType,
	limit int,
) ([]*LeaderboardEntry, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	var query string
	switch lbType {
	case LBRichest:
		query = `SELECT id, name, mc_balance
			FROM players
			ORDER BY mc_balance DESC
			LIMIT $1`
	case LBLandlord:
		query = `SELECT b.owner_id, COALESCE(p.name, b.owner_id), COUNT(*) AS cnt
			FROM buildings b
			LEFT JOIN players p ON p.id = b.owner_id
			WHERE b.owner_id IS NOT NULL
			GROUP BY b.owner_id, p.name
			ORDER BY cnt DESC
			LIMIT $1`
	case LBConqueror:
		query = `SELECT bt.attacker_id, COALESCE(p.name, bt.attacker_id), COUNT(*) AS cnt
			FROM battles bt
			LEFT JOIN players p ON p.id = bt.attacker_id
			WHERE bt.result = 'attacker_win'
			GROUP BY bt.attacker_id, p.name
			ORDER BY cnt DESC
			LIMIT $1`
	case LBEmpire:
		query = `SELECT t.controller_id, COALESCE(p.name, t.controller_id), COUNT(*) AS cnt
			FROM territories t
			LEFT JOIN players p ON p.id = t.controller_id
			WHERE t.controller_id IS NOT NULL
			GROUP BY t.controller_id, p.name
			ORDER BY cnt DESC
			LIMIT $1`
	case LBAlliance:
		query = `SELECT a.id, a.name, COALESCE(SUM(p.mc_balance), 0) AS total
			FROM alliances a
			JOIN alliance_members am ON am.alliance_id = a.id
			JOIN players p ON p.id = am.player_id
			GROUP BY a.id, a.name
			ORDER BY total DESC
			LIMIT $1`
	default:
		return nil, fmt.Errorf("unknown leaderboard type: %s", lbType)
	}

	rows, err := ss.pg.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query leaderboard %s: %w", lbType, err)
	}
	defer rows.Close()

	var entries []*LeaderboardEntry
	rank := 1
	for rows.Next() {
		e := &LeaderboardEntry{Rank: rank}
		if err := rows.Scan(&e.PlayerID, &e.PlayerName, &e.Value); err != nil {
			return nil, fmt.Errorf("scan leaderboard entry: %w", err)
		}
		entries = append(entries, e)
		rank++
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate leaderboard: %w", err)
	}
	return entries, nil
}

// EndSeason은 현재 시즌을 종료하고 TOP 3 보상을 지급한 뒤
// 새 시즌을 자동 시작한다.
func (ss *TycoonSeasonSystem) EndSeason(ctx context.Context) error {
	current, err := ss.GetCurrentSeason(ctx)
	if err != nil {
		return fmt.Errorf("get current season: %w", err)
	}
	if current == nil {
		return fmt.Errorf("no active season to end")
	}

	// 1) 현재 시즌 비활성화
	_, err = ss.pg.Exec(ctx,
		`UPDATE tycoon_seasons SET is_active = FALSE WHERE id = $1`,
		current.ID,
	)
	if err != nil {
		return fmt.Errorf("deactivate season %d: %w", current.Number, err)
	}

	// 2) 시즌 종료 이벤트
	if ss.event != nil {
		_, _ = ss.event.EmitEvent(ctx, EventSeasonEnd,
			fmt.Sprintf("시즌 %d 종료!", current.Number),
			map[string]any{"season_number": current.Number},
		)
	}

	// 3) TOP 3 보상 지급 (richest 리더보드 기준)
	top3, err := ss.GetLeaderboard(ctx, LBRichest, 3)
	if err != nil {
		slog.Warn("failed to get season top3 for rewards", "err", err)
	} else {
		rewards := []int64{SeasonRewardFirst, SeasonRewardSecond, SeasonRewardThird}
		for i, entry := range top3 {
			if i >= len(rewards) {
				break
			}
			_, rewardErr := ss.pg.Exec(ctx,
				`UPDATE players SET mc_balance = mc_balance + $1 WHERE id = $2`,
				rewards[i], entry.PlayerID,
			)
			if rewardErr != nil {
				slog.Warn("failed to grant season reward",
					"rank", entry.Rank, "player", entry.PlayerID, "err", rewardErr)
			} else {
				slog.Info("season reward granted",
					"season", current.Number,
					"rank", entry.Rank,
					"player", entry.PlayerID,
					"reward", rewards[i],
				)
			}
		}
	}

	// 4) 새 시즌 시작
	return ss.startNewSeason(ctx, current.Number+1)
}

// startNewSeason은 새 시즌 레코드를 생성한다.
func (ss *TycoonSeasonSystem) startNewSeason(ctx context.Context, number int) error {
	now := time.Now().UTC()
	season := &TycoonSeason{
		ID:       uuid.New().String(),
		Number:   number,
		StartAt:  now,
		EndAt:    now.AddDate(0, 0, SeasonDurationDays),
		IsActive: true,
	}

	_, err := ss.pg.Exec(ctx,
		`INSERT INTO tycoon_seasons (id, number, start_at, end_at, is_active)
		 VALUES ($1, $2, $3, $4, $5)`,
		season.ID, season.Number, season.StartAt, season.EndAt, season.IsActive,
	)
	if err != nil {
		return fmt.Errorf("insert new season %d: %w", number, err)
	}

	// 시즌 시작 이벤트
	if ss.event != nil {
		_, _ = ss.event.EmitEvent(ctx, EventSeasonStart,
			fmt.Sprintf("시즌 %d 시작! (%s ~ %s)",
				number,
				season.StartAt.Format("2006-01-02"),
				season.EndAt.Format("2006-01-02"),
			),
			map[string]any{
				"season_number": number,
				"start_at":      season.StartAt,
				"end_at":        season.EndAt,
			},
		)
	}

	slog.Info("new season started",
		"number", number,
		"start", season.StartAt,
		"end", season.EndAt,
	)
	return nil
}

// EnsureSeasonExists는 활성 시즌이 없으면 시즌 1을 생성한다.
// 서버 시작 시 호출용.
func (ss *TycoonSeasonSystem) EnsureSeasonExists(ctx context.Context) error {
	current, err := ss.GetCurrentSeason(ctx)
	if err != nil {
		return err
	}
	if current != nil {
		slog.Info("active season found", "number", current.Number)
		return nil
	}
	slog.Info("no active season, creating season 1")
	return ss.startNewSeason(ctx, 1)
}

// StartSeasonChecker는 1시간 간격으로 시즌 종료 조건을 확인한다.
// 별도 goroutine으로 실행되며 ctx 취소 시 종료.
func (ss *TycoonSeasonSystem) StartSeasonChecker(ctx context.Context) {
	ticker := time.NewTicker(SeasonCheckInterval)
	defer ticker.Stop()

	slog.Info("season checker started", "interval", SeasonCheckInterval)

	for {
		select {
		case <-ctx.Done():
			slog.Info("season checker stopped")
			return
		case <-ticker.C:
			ss.checkAndEndSeason(ctx)
		}
	}
}

// checkAndEndSeason은 현재 시즌이 종료 시각을 지났으면 EndSeason을 호출한다.
func (ss *TycoonSeasonSystem) checkAndEndSeason(ctx context.Context) {
	current, err := ss.GetCurrentSeason(ctx)
	if err != nil {
		slog.Warn("season check error", "err", err)
		return
	}
	if current == nil {
		slog.Warn("no active season during check, attempting to create one")
		if err := ss.EnsureSeasonExists(ctx); err != nil {
			slog.Error("failed to ensure season exists", "err", err)
		}
		return
	}

	now := time.Now().UTC()
	if now.After(current.EndAt) {
		slog.Info("season expired, ending",
			"number", current.Number,
			"end_at", current.EndAt,
		)
		if err := ss.EndSeason(ctx); err != nil {
			slog.Error("failed to end season", "err", err)
		}
	}
}
