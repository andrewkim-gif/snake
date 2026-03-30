package debug

import (
	"log/slog"
	"sync"
)

// SystemInfo는 디버그 토글 가능한 시스템의 메타데이터를 정의합니다.
type SystemInfo struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

// 시스템 ID 상수
const (
	SystemWar       = "war"
	SystemEconomy   = "economy"
	SystemEvents    = "events"
	SystemSeason    = "season"
	SystemNationalAI = "national_ai"
	SystemArena     = "arena"
	SystemTycoon    = "tycoon"
)

// systemLabels는 각 시스템의 사람이 읽을 수 있는 표시 이름입니다.
var systemLabels = map[string]string{
	SystemWar:       "War System",
	SystemEconomy:   "Economy Engine",
	SystemEvents:    "Random Events",
	SystemSeason:    "Season Engine",
	SystemNationalAI: "National AI",
	SystemArena:     "Arena Epoch Ticker",
	SystemTycoon:    "Tycoon Engines",
}

// allSystemIDs는 등록된 시스템 ID의 순서 목록입니다.
var allSystemIDs = []string{
	SystemWar, SystemEconomy, SystemEvents,
	SystemSeason, SystemNationalAI, SystemArena, SystemTycoon,
}

// 글로벌 토글 상태
var (
	mu      sync.RWMutex
	systems map[string]bool
	isDev   bool
)

// Init은 디버그 토글 시스템을 초기화합니다.
// isDevelopment=true이면 모든 시스템이 OFF로 시작합니다.
// isDevelopment=false이면 모든 시스템이 ON으로 시작합니다.
func Init(isDevelopment bool) {
	mu.Lock()
	defer mu.Unlock()

	isDev = isDevelopment
	systems = make(map[string]bool, len(allSystemIDs))

	defaultState := !isDevelopment // production=ON, development=OFF
	for _, id := range allSystemIDs {
		systems[id] = defaultState
	}

	slog.Info("debug toggle initialized",
		"isDevelopment", isDevelopment,
		"defaultState", defaultState,
		"systems", len(allSystemIDs),
	)
}

// IsEnabled는 지정된 시스템이 활성화되어 있는지 확인합니다.
// 초기화되지 않았거나 알 수 없는 시스템은 true를 반환합니다 (프로덕션 안전).
func IsEnabled(system string) bool {
	mu.RLock()
	defer mu.RUnlock()

	if systems == nil {
		return true // 초기화 전에는 모든 시스템 활성화 (안전 기본값)
	}
	enabled, exists := systems[system]
	if !exists {
		return true // 알 수 없는 시스템은 활성화 (프로덕션 안전)
	}
	return enabled
}

// SetEnabled는 개별 시스템의 활성화 상태를 설정합니다.
func SetEnabled(system string, enabled bool) bool {
	mu.Lock()
	defer mu.Unlock()

	if systems == nil {
		return false
	}
	if _, exists := systems[system]; !exists {
		return false
	}
	systems[system] = enabled
	slog.Info("debug toggle changed",
		"system", system,
		"enabled", enabled,
	)
	return true
}

// SetAll은 모든 시스템의 활성화 상태를 일괄 설정합니다.
func SetAll(enabled bool) {
	mu.Lock()
	defer mu.Unlock()

	if systems == nil {
		return
	}
	for id := range systems {
		systems[id] = enabled
	}
	slog.Info("debug toggle all changed", "enabled", enabled)
}

// GetAll은 모든 시스템의 현재 상태를 반환합니다.
func GetAll() []SystemInfo {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]SystemInfo, 0, len(allSystemIDs))
	for _, id := range allSystemIDs {
		result = append(result, SystemInfo{
			ID:      id,
			Label:   systemLabels[id],
			Enabled: systems[id],
		})
	}
	return result
}

// IsDevelopment는 현재 개발 모드인지 반환합니다.
func IsDevelopment() bool {
	mu.RLock()
	defer mu.RUnlock()
	return isDev
}
