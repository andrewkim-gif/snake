package game

import (
	"context"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// TycoonTerritoryEngine: 건물 소유 비율 기반 영토 지배 계산 엔진
//
// 기존 TerritoryEngine이 전투 RP 기반 일일정산 패턴을 사용하는 반면,
// TycoonTerritoryEngine은 건물 소유 비율(>50%)로 지배도를 결정한다.
//
// 핵심 흐름:
//   60초 주기 RefreshTerritoryState() → 건물 소유 비율 재계산
//   매일 UTC 00:00 DailySettlement() → 주권 에스컬레이션 업데이트
//   1Hz BuildTerritoryBroadcast() → WebSocket 브로드캐스트
//
// Sovereignty Escalation Ladder (기존과 동일):
//   None → Active (1일) → Sovereignty (3일) → Hegemony (14일)
//
// 시너지/보너스:
//   District Synergy: 같은 region에 3+ 건물 → +20% income
//   City Domination:  같은 city에 10+ 건물 → +30% income
//   Sovereignty 보너스: Active +10%/+5%, Sovereignty +30%/+15%, Hegemony +50%/+20%
// ============================================================

// ── Tycoon Sovereignty Level ──

// TycoonSovereigntyLevel mirrors the existing sovereignty escalation system.
type TycoonSovereigntyLevel string

const (
	TycoonSovNone       TycoonSovereigntyLevel = "none"
	TycoonSovActive     TycoonSovereigntyLevel = "active"      // 1+ day control
	TycoonSovSovereignty TycoonSovereigntyLevel = "sovereignty" // 3+ days
	TycoonSovHegemony   TycoonSovereigntyLevel = "hegemony"    // 14+ days
)

// ── Tycoon Sovereignty 상수 ──

const (
	// TycoonSovActiveDays는 Active 레벨 필요 연속 일수
	TycoonSovActiveDays = 1
	// TycoonSovSovereigntyDays는 Sovereignty 레벨 필요 연속 일수
	TycoonSovSovereigntyDays = 3
	// TycoonSovHegemonyDays는 Hegemony 레벨 필요 연속 일수
	TycoonSovHegemonyDays = 14

	// TycoonControlThreshold는 지역 지배 확정에 필요한 최소 소유 비율 (50%)
	TycoonControlThreshold = 0.50

	// TycoonDistrictSynergyThreshold는 District Synergy 발동 건물 수
	TycoonDistrictSynergyThreshold = 3
	// TycoonDistrictSynergyBonus는 District Synergy income 보너스 (+20%)
	TycoonDistrictSynergyBonus = 0.20

	// TycoonCityDominationThreshold는 City Domination 발동 건물 수
	TycoonCityDominationThreshold = 10
	// TycoonCityDominationBonus는 City Domination income 보너스 (+30%)
	TycoonCityDominationBonus = 0.30

	// TycoonRefreshInterval는 자동 갱신 간격 (60초)
	TycoonRefreshInterval = 60 * time.Second
)

// ── Region Control ──

// RegionControl represents the building ownership breakdown for a single region.
type RegionControl struct {
	RegionCode     string         `json:"region_code"`
	TotalBuildings int            `json:"total_buildings"`
	ControllerID   string         `json:"controller_id,omitempty"`   // 최다 건물 소유 플레이어
	ControllerName string         `json:"controller_name,omitempty"` // 표시 이름
	ControlPct     float64        `json:"control_pct"`               // 0.0 ~ 1.0
	BuildingCounts map[string]int `json:"building_counts"`           // playerID → 건물 수
}

// ── Territory State (DB 연동) ──

// tycoonRegionState는 DB의 territories 테이블과 대응하는 내부 상태.
type tycoonRegionState struct {
	RegionCode       string
	ControllerID     string
	ControllerName   string
	ControlStreak    int
	SovereigntyLevel TycoonSovereigntyLevel
	LastSettledAt    time.Time
}

// ── TycoonTerritoryEngine 본체 ──

// TycoonTerritoryEngine calculates territory control based on building ownership.
// A player controls a region when they own >50% of buildings in that region.
// City control = majority of region control. National control = capital city control.
type TycoonTerritoryEngine struct {
	pg *pgxpool.Pool
	mu sync.RWMutex

	// cached territory state (refreshed on demand or every 60s)
	regionCache map[string]*RegionControl
	// cached sovereignty state (from DB, refreshed with regionCache)
	sovereigntyCache map[string]*tycoonRegionState
	lastRefresh      time.Time
}

// NewTycoonTerritoryEngine creates a new TycoonTerritoryEngine.
func NewTycoonTerritoryEngine(pg *pgxpool.Pool) *TycoonTerritoryEngine {
	return &TycoonTerritoryEngine{
		pg:               pg,
		regionCache:      make(map[string]*RegionControl),
		sovereigntyCache: make(map[string]*tycoonRegionState),
	}
}

// ── 실시간 지배도 계산 ──

// RefreshTerritoryState recalculates all region control from building ownership.
// Called periodically (every 60s) and on building ownership changes.
func (e *TycoonTerritoryEngine) RefreshTerritoryState(ctx context.Context) error {
	// SQL: 각 region의 owner별 건물 수를 집계
	rows, err := e.pg.Query(ctx, `
		SELECT region_code, owner_id, COUNT(*) AS cnt
		FROM buildings
		WHERE owner_id IS NOT NULL
		GROUP BY region_code, owner_id
		ORDER BY region_code, cnt DESC
	`)
	if err != nil {
		slog.Error("tycoon-territory: failed to query building ownership",
			"error", err,
		)
		return err
	}
	defer rows.Close()

	// region별 건물 소유 현황 수집
	regionOwners := make(map[string][]ownerCount)

	for rows.Next() {
		var regionCode, ownerID string
		var cnt int
		if err := rows.Scan(&regionCode, &ownerID, &cnt); err != nil {
			slog.Error("tycoon-territory: failed to scan row",
				"error", err,
			)
			return err
		}
		regionOwners[regionCode] = append(regionOwners[regionCode], ownerCount{
			ownerID: ownerID,
			count:   cnt,
		})
	}
	if err := rows.Err(); err != nil {
		slog.Error("tycoon-territory: row iteration error",
			"error", err,
		)
		return err
	}

	// owner_id → display name 매핑 (컨트롤러 이름 조회)
	playerNames, err := e.fetchPlayerNames(ctx, regionOwners)
	if err != nil {
		slog.Warn("tycoon-territory: failed to fetch player names, using IDs",
			"error", err,
		)
		// 이름 조회 실패해도 계속 진행 (ID를 이름 대신 사용)
		playerNames = make(map[string]string)
	}

	// region별 RegionControl 계산
	newCache := make(map[string]*RegionControl, len(regionOwners))

	for regionCode, owners := range regionOwners {
		totalBuildings := 0
		buildingCounts := make(map[string]int, len(owners))

		for _, oc := range owners {
			totalBuildings += oc.count
			buildingCounts[oc.ownerID] = oc.count
		}

		rc := &RegionControl{
			RegionCode:     regionCode,
			TotalBuildings: totalBuildings,
			BuildingCounts: buildingCounts,
		}

		// 최다 소유 플레이어 결정 (이미 cnt DESC 정렬됨)
		if len(owners) > 0 && totalBuildings > 0 {
			topOwner := owners[0]
			pct := float64(topOwner.count) / float64(totalBuildings)

			if pct > TycoonControlThreshold {
				rc.ControllerID = topOwner.ownerID
				rc.ControlPct = pct
				if name, ok := playerNames[topOwner.ownerID]; ok {
					rc.ControllerName = name
				}
			} else {
				// 과반수 미달 — 지배자 없음
				rc.ControlPct = pct
			}
		}

		newCache[regionCode] = rc
	}

	// 캐시 교체 (atomic swap)
	e.mu.Lock()
	e.regionCache = newCache
	e.lastRefresh = time.Now()
	e.mu.Unlock()

	slog.Debug("tycoon-territory: state refreshed",
		"regions", len(newCache),
	)

	return nil
}

// ownerCount는 region별 소유자-건물 수 쌍.
type ownerCount struct {
	ownerID string
	count   int
}

// fetchPlayerNames는 region 소유자 목록에서 고유 playerID를 추출하여
// players 테이블에서 display_name을 조회한다.
func (e *TycoonTerritoryEngine) fetchPlayerNames(
	ctx context.Context,
	regionOwners map[string][]ownerCount,
) (map[string]string, error) {
	// 고유 player ID 수집
	idSet := make(map[string]struct{})
	for _, owners := range regionOwners {
		for _, oc := range owners {
			idSet[oc.ownerID] = struct{}{}
		}
	}

	if len(idSet) == 0 {
		return make(map[string]string), nil
	}

	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	rows, err := e.pg.Query(ctx,
		`SELECT id, display_name FROM players WHERE id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	names := make(map[string]string, len(ids))
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		names[id] = name
	}

	return names, rows.Err()
}

// GetRegionControl returns the current control state for a region.
func (e *TycoonTerritoryEngine) GetRegionControl(regionCode string) *RegionControl {
	e.mu.RLock()
	defer e.mu.RUnlock()

	rc, ok := e.regionCache[regionCode]
	if !ok {
		return nil
	}

	// 복사본 반환 (thread-safe)
	cp := *rc
	cp.BuildingCounts = make(map[string]int, len(rc.BuildingCounts))
	for k, v := range rc.BuildingCounts {
		cp.BuildingCounts[k] = v
	}
	return &cp
}

// GetAllRegionControls returns all region controls (for 1Hz broadcast).
func (e *TycoonTerritoryEngine) GetAllRegionControls() []*RegionControl {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]*RegionControl, 0, len(e.regionCache))
	for _, rc := range e.regionCache {
		cp := *rc
		cp.BuildingCounts = make(map[string]int, len(rc.BuildingCounts))
		for k, v := range rc.BuildingCounts {
			cp.BuildingCounts[k] = v
		}
		result = append(result, &cp)
	}

	// 안정적인 순서 보장
	sort.Slice(result, func(i, j int) bool {
		return result[i].RegionCode < result[j].RegionCode
	})

	return result
}

// GetPlayerTerritories returns all regions controlled by a player.
func (e *TycoonTerritoryEngine) GetPlayerTerritories(ctx context.Context, playerID string) ([]string, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var regions []string
	for regionCode, rc := range e.regionCache {
		if rc.ControllerID == playerID {
			regions = append(regions, regionCode)
		}
	}

	sort.Strings(regions)
	return regions, nil
}

// ── 일일 정산 (UTC 00:00) ──

// DailySettlement performs daily sovereignty escalation.
// Sovereignty ladder: None -> Active (1 day) -> Sovereignty (3 days) -> Hegemony (14 days)
func (e *TycoonTerritoryEngine) DailySettlement(ctx context.Context) error {
	// 먼저 최신 상태로 갱신
	if err := e.RefreshTerritoryState(ctx); err != nil {
		return err
	}

	e.mu.Lock()
	currentRegions := make(map[string]*RegionControl, len(e.regionCache))
	for k, v := range e.regionCache {
		currentRegions[k] = v
	}
	e.mu.Unlock()

	now := time.Now().UTC()

	// DB에서 현재 sovereignty 상태 조회
	rows, err := e.pg.Query(ctx, `
		SELECT region_code, controller_id, control_streak, sovereignty_level, last_settled_at
		FROM territories
	`)
	if err != nil {
		slog.Error("tycoon-territory: failed to query territories for settlement",
			"error", err,
		)
		return err
	}
	defer rows.Close()

	existingStates := make(map[string]*tycoonRegionState)
	for rows.Next() {
		var s tycoonRegionState
		var sovLevel string
		if err := rows.Scan(&s.RegionCode, &s.ControllerID, &s.ControlStreak, &sovLevel, &s.LastSettledAt); err != nil {
			slog.Error("tycoon-territory: failed to scan territory row",
				"error", err,
			)
			return err
		}
		s.SovereigntyLevel = TycoonSovereigntyLevel(sovLevel)
		existingStates[s.RegionCode] = &s
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// 각 region에 대해 sovereignty 업데이트
	for regionCode, rc := range currentRegions {
		existing, hasExisting := existingStates[regionCode]

		newControllerID := rc.ControllerID
		var streak int
		var sovLevel TycoonSovereigntyLevel

		if hasExisting {
			if newControllerID != "" && newControllerID == existing.ControllerID {
				// 기존 지배 유지 → streak 증가
				streak = existing.ControlStreak + 1
			} else if newControllerID != "" {
				// 지배자 변경 → streak 리셋
				streak = 1
			} else {
				// 지배자 없음 → 기존 유지하되 streak 변경 없음
				newControllerID = existing.ControllerID
				streak = existing.ControlStreak
			}
		} else {
			// 새 region → 첫 정산
			if newControllerID != "" {
				streak = 1
			}
		}

		// Sovereignty 에스컬레이션
		sovLevel = calculateTycoonSovereignty(streak)

		// DB 업서트 (UPSERT)
		_, err := e.pg.Exec(ctx, `
			INSERT INTO territories (region_code, controller_id, control_streak, sovereignty_level, last_settled_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (region_code) DO UPDATE SET
				controller_id = EXCLUDED.controller_id,
				control_streak = EXCLUDED.control_streak,
				sovereignty_level = EXCLUDED.sovereignty_level,
				last_settled_at = EXCLUDED.last_settled_at
		`, regionCode, newControllerID, streak, string(sovLevel), now)
		if err != nil {
			slog.Error("tycoon-territory: failed to upsert territory",
				"region", regionCode,
				"error", err,
			)
			return err
		}

		// 로컬 캐시 업데이트
		e.mu.Lock()
		e.sovereigntyCache[regionCode] = &tycoonRegionState{
			RegionCode:       regionCode,
			ControllerID:     newControllerID,
			ControllerName:   rc.ControllerName,
			ControlStreak:    streak,
			SovereigntyLevel: sovLevel,
			LastSettledAt:    now,
		}
		e.mu.Unlock()

		slog.Info("tycoon-territory: daily settlement for region",
			"region", regionCode,
			"controller", newControllerID,
			"streak", streak,
			"sovereignty", sovLevel,
		)
	}

	slog.Info("tycoon-territory: daily settlement completed",
		"regions", len(currentRegions),
	)

	return nil
}

// calculateTycoonSovereignty determines sovereignty level from streak days.
func calculateTycoonSovereignty(streakDays int) TycoonSovereigntyLevel {
	switch {
	case streakDays >= TycoonSovHegemonyDays:
		return TycoonSovHegemony
	case streakDays >= TycoonSovSovereigntyDays:
		return TycoonSovSovereignty
	case streakDays >= TycoonSovActiveDays:
		return TycoonSovActive
	default:
		return TycoonSovNone
	}
}

// ── 시너지/보너스 계산 ──

// GetDistrictSynergy checks if a player owns 3+ buildings in same region → +20% income.
func (e *TycoonTerritoryEngine) GetDistrictSynergy(ctx context.Context, playerID, regionCode string) (bool, error) {
	var cnt int
	err := e.pg.QueryRow(ctx, `
		SELECT COUNT(*) FROM buildings
		WHERE owner_id = $1 AND region_code = $2
	`, playerID, regionCode).Scan(&cnt)
	if err != nil {
		slog.Error("tycoon-territory: failed to query district synergy",
			"playerID", playerID,
			"region", regionCode,
			"error", err,
		)
		return false, err
	}

	return cnt >= TycoonDistrictSynergyThreshold, nil
}

// GetCityDomination checks if a player controls 10+ buildings in a city → +30% income.
// cityCode = region_code의 첫 부분 (e.g., "seoul" from "seoul-gangnam")
func (e *TycoonTerritoryEngine) GetCityDomination(ctx context.Context, playerID, cityCode string) (bool, error) {
	// city는 region_code의 '-' 앞부분과 매칭 (e.g., "seoul-gangnam" → city "seoul")
	var cnt int
	err := e.pg.QueryRow(ctx, `
		SELECT COUNT(*) FROM buildings
		WHERE owner_id = $1 AND region_code LIKE $2
	`, playerID, cityCode+"-%").Scan(&cnt)
	if err != nil {
		slog.Error("tycoon-territory: failed to query city domination",
			"playerID", playerID,
			"city", cityCode,
			"error", err,
		)
		return false, err
	}

	return cnt >= TycoonCityDominationThreshold, nil
}

// GetSovereigntyBonuses returns the sovereignty-based bonuses for a player.
// Returns (incomeMult, militaryMult) based on the highest sovereignty level across all controlled regions.
//   - Active:      income +10%, military +5%
//   - Sovereignty: income +30%, military +15%
//   - Hegemony:    income +50%, military +20%
func (e *TycoonTerritoryEngine) GetSovereigntyBonuses(ctx context.Context, playerID string) (incomeMult float64, militaryMult float64) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// 플레이어가 지배하는 region 중 최고 sovereignty 레벨 탐색
	var highestLevel TycoonSovereigntyLevel
	highestRank := 0

	for regionCode, rc := range e.regionCache {
		if rc.ControllerID != playerID {
			continue
		}
		if state, ok := e.sovereigntyCache[regionCode]; ok {
			rank := tycoonSovRank(state.SovereigntyLevel)
			if rank > highestRank {
				highestRank = rank
				highestLevel = state.SovereigntyLevel
			}
		}
	}

	// 보너스 계산
	switch highestLevel {
	case TycoonSovHegemony:
		return 1.50, 1.20
	case TycoonSovSovereignty:
		return 1.30, 1.15
	case TycoonSovActive:
		return 1.10, 1.05
	default:
		return 1.00, 1.00
	}
}

// tycoonSovRank returns a numeric rank for sovereignty level comparison.
func tycoonSovRank(level TycoonSovereigntyLevel) int {
	switch level {
	case TycoonSovHegemony:
		return 3
	case TycoonSovSovereignty:
		return 2
	case TycoonSovActive:
		return 1
	default:
		return 0
	}
}

// ── 1Hz 브로드캐스트 데이터 생성 ──

// RegionTerritoryBroadcast는 WebSocket 브로드캐스트용 region 영토 데이터.
type RegionTerritoryBroadcast struct {
	RegionCode       string  `json:"region_code"`
	ControllerID     string  `json:"controller_id,omitempty"`
	ControllerName   string  `json:"controller_name,omitempty"`
	ControlPct       float64 `json:"control_pct"`
	SovereigntyLevel string  `json:"sovereignty_level"`
}

// BuildTerritoryBroadcast creates the territory_update payload for WebSocket broadcast.
func (e *TycoonTerritoryEngine) BuildTerritoryBroadcast() []RegionTerritoryBroadcast {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]RegionTerritoryBroadcast, 0, len(e.regionCache))

	for regionCode, rc := range e.regionCache {
		broadcast := RegionTerritoryBroadcast{
			RegionCode:     regionCode,
			ControllerID:   rc.ControllerID,
			ControllerName: rc.ControllerName,
			ControlPct:     rc.ControlPct,
		}

		// sovereignty 레벨 첨부
		if state, ok := e.sovereigntyCache[regionCode]; ok {
			broadcast.SovereigntyLevel = string(state.SovereigntyLevel)
		} else {
			broadcast.SovereigntyLevel = string(TycoonSovNone)
		}

		result = append(result, broadcast)
	}

	// 안정적인 순서 보장
	sort.Slice(result, func(i, j int) bool {
		return result[i].RegionCode < result[j].RegionCode
	})

	return result
}

// ── 주기적 업데이트 루프 ──

// StartPeriodicRefresh starts a background goroutine that refreshes territory state every 60s.
// Blocks until ctx is cancelled.
func (e *TycoonTerritoryEngine) StartPeriodicRefresh(ctx context.Context) {
	ticker := time.NewTicker(TycoonRefreshInterval)
	defer ticker.Stop()

	slog.Info("tycoon-territory: periodic refresh started",
		"interval", TycoonRefreshInterval,
	)

	for {
		select {
		case <-ctx.Done():
			slog.Info("tycoon-territory: periodic refresh stopped")
			return
		case <-ticker.C:
			if err := e.RefreshTerritoryState(ctx); err != nil {
				slog.Error("tycoon-territory: periodic refresh failed",
					"error", err,
				)
			}
		}
	}
}

// ── 유틸리티 ──

// ExtractCityCode extracts the city portion from a region code.
// e.g., "seoul-gangnam" → "seoul", "tokyo-shibuya" → "tokyo"
func ExtractCityCode(regionCode string) string {
	if idx := strings.Index(regionCode, "-"); idx > 0 {
		return regionCode[:idx]
	}
	return regionCode
}
