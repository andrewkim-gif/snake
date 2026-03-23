package game

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonEventSystem: 글로벌 이벤트 + 뉴스 시스템
//
// 건물 매매, 영토 변경, 전쟁 선포, 전투 결과, 동맹 결성,
// 시즌 시작/종료 등 서버 전역 이벤트를 PostgreSQL에 기록하고
// 최근 이벤트를 조회할 수 있는 시스템.
//
// 사용법:
//   es := NewTycoonEventSystem(pgPool)
//   ev, _ := es.EmitEvent(ctx, EventBuildingSold, "건물 매각 완료", data)
//   recent, _ := es.GetRecentEvents(ctx, 20)
// ============================================================

// ── 이벤트 타입 열거 ──

// TycoonEventType은 글로벌 이벤트 분류
type TycoonEventType string

const (
	// EventTerritoryChange는 영토 지배권 변경
	EventTerritoryChange TycoonEventType = "territory_change"
	// EventWarDeclared는 전쟁 선포
	EventWarDeclared TycoonEventType = "war_declared"
	// EventBuildingSold는 건물 매각/경매 낙찰
	EventBuildingSold TycoonEventType = "building_sold"
	// EventBattleResult는 전투 결과
	EventBattleResult TycoonEventType = "battle_result"
	// EventAllianceFormed는 동맹 결성
	EventAllianceFormed TycoonEventType = "alliance_formed"
	// EventSeasonStart는 시즌 시작
	EventSeasonStart TycoonEventType = "season_start"
	// EventSeasonEnd는 시즌 종료
	EventSeasonEnd TycoonEventType = "season_end"
)

// ── 이벤트 구조체 ──

// TycoonEvent는 서버 전역 이벤트 레코드
type TycoonEvent struct {
	ID        string          `json:"id"`
	Type      TycoonEventType `json:"type"`
	Message   string          `json:"message"`
	Data      map[string]any  `json:"data,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

// ── TycoonEventSystem ──

// TycoonEventSystem은 글로벌 이벤트의 생성/조회를 담당
type TycoonEventSystem struct {
	pg *pgxpool.Pool
}

// NewTycoonEventSystem은 TycoonEventSystem을 생성한다.
func NewTycoonEventSystem(pg *pgxpool.Pool) *TycoonEventSystem {
	return &TycoonEventSystem{pg: pg}
}

// EmitEvent는 글로벌 이벤트를 생성하고 DB에 저장한다.
// 저장된 TycoonEvent를 반환하며, 이후 WebSocket 브로드캐스트에 활용 가능.
func (es *TycoonEventSystem) EmitEvent(
	ctx context.Context,
	eventType TycoonEventType,
	message string,
	data map[string]any,
) (*TycoonEvent, error) {
	ev := &TycoonEvent{
		ID:        uuid.New().String(),
		Type:      eventType,
		Message:   message,
		Data:      data,
		CreatedAt: time.Now().UTC(),
	}

	// data를 JSONB로 직렬화
	var dataJSON []byte
	var err error
	if data != nil {
		dataJSON, err = json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("marshal event data: %w", err)
		}
	}

	_, err = es.pg.Exec(ctx,
		`INSERT INTO tycoon_events (id, type, message, data, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		ev.ID, string(ev.Type), ev.Message, dataJSON, ev.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert tycoon_event: %w", err)
	}

	slog.Info("tycoon event emitted",
		"type", eventType,
		"id", ev.ID,
		"message", message,
	)
	return ev, nil
}

// GetRecentEvents는 최근 N개 이벤트를 생성 시간 역순으로 조회한다.
func (es *TycoonEventSystem) GetRecentEvents(ctx context.Context, limit int) ([]*TycoonEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	rows, err := es.pg.Query(ctx,
		`SELECT id, type, message, data, created_at
		 FROM tycoon_events
		 ORDER BY created_at DESC
		 LIMIT $1`, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query tycoon_events: %w", err)
	}
	defer rows.Close()

	var events []*TycoonEvent
	for rows.Next() {
		ev := &TycoonEvent{}
		var dataJSON []byte
		if err := rows.Scan(&ev.ID, &ev.Type, &ev.Message, &dataJSON, &ev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan tycoon_event: %w", err)
		}
		if len(dataJSON) > 0 {
			if err := json.Unmarshal(dataJSON, &ev.Data); err != nil {
				slog.Warn("unmarshal event data failed", "id", ev.ID, "err", err)
			}
		}
		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tycoon_events: %w", err)
	}
	return events, nil
}

// GetRecentEventsByType는 특정 타입의 최근 N개 이벤트를 조회한다.
func (es *TycoonEventSystem) GetRecentEventsByType(
	ctx context.Context,
	eventType TycoonEventType,
	limit int,
) ([]*TycoonEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	rows, err := es.pg.Query(ctx,
		`SELECT id, type, message, data, created_at
		 FROM tycoon_events
		 WHERE type = $1
		 ORDER BY created_at DESC
		 LIMIT $2`, string(eventType), limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query tycoon_events by type: %w", err)
	}
	defer rows.Close()

	var events []*TycoonEvent
	for rows.Next() {
		ev := &TycoonEvent{}
		var dataJSON []byte
		if err := rows.Scan(&ev.ID, &ev.Type, &ev.Message, &dataJSON, &ev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan tycoon_event: %w", err)
		}
		if len(dataJSON) > 0 {
			if err := json.Unmarshal(dataJSON, &ev.Data); err != nil {
				slog.Warn("unmarshal event data failed", "id", ev.ID, "err", err)
			}
		}
		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tycoon_events by type: %w", err)
	}
	return events, nil
}

// PurgeOldEvents는 지정 기간보다 오래된 이벤트를 삭제한다.
// 주기적 정리에 활용 (예: 30일 이전 이벤트 삭제).
func (es *TycoonEventSystem) PurgeOldEvents(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	tag, err := es.pg.Exec(ctx,
		`DELETE FROM tycoon_events WHERE created_at < $1`, cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("purge tycoon_events: %w", err)
	}
	count := tag.RowsAffected()
	if count > 0 {
		slog.Info("purged old tycoon events", "deleted", count, "cutoff", cutoff)
	}
	return count, nil
}
