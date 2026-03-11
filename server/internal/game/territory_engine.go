package game

import (
	"log/slog"
	"sort"
	"sync"
	"time"
)

// ============================================================
// v39 Phase 7 — TerritoryEngine: 영토 지배 정산 엔진
//
// DominationEngine을 완전 대체한다.
// 기존 "6에폭(1시간) 평가" 대신 일일 정산(UTC 00:00) 기반
// 영토 지배 시스템을 구현한다.
//
// 핵심 흐름:
//   라운드 종료(Settlement) → OnRoundSettlement() → RP 누적
//   매일 UTC 00:00 → DailySettlement() → 지배 판정 + 주권 업데이트
//
// Sovereignty Escalation Ladder:
//   None → Active Domination (1일) → Sovereignty (3일) → Hegemony (14일)
//
// 국가 주권:
//   한 팩션이 국가의 모든 지역을 동시 지배 → National Sovereignty
// ============================================================

// ── TerritoryEngine 상수 ──

const (
	// TerritoryMinRP는 지배 확정에 필요한 최소 RP (너무 적은 활동 방지)
	TerritoryMinRP = 100

	// TerritoryDominanceGapPct는 지배 확정에 필요한 최소 격차 비율 (10%)
	TerritoryDominanceGapPct = 0.10

	// TerritoryInertiaGapPct는 연속 3일+ 지배 시 교체에 필요한 격차 (20%)
	TerritoryInertiaGapPct = 0.20

	// TerritoryInertiaThresholdDays는 지배 관성 발동 일수
	TerritoryInertiaThresholdDays = 3

	// SovereigntyActiveDomDays는 Active Domination 필요 연속 일수
	SovereigntyActiveDomDays = 1
	// SovereigntySovDays는 Sovereignty 필요 연속 일수
	SovereigntySovDays = 3
	// SovereigntyHegDays는 Hegemony 필요 연속 일수
	SovereigntyHegDays = 14

	// UnderdogRPThreshold는 소규모 팩션 RP 보너스 인원 기준
	UnderdogRPThreshold = 3
	// UnderdogRPBonus는 소규모 팩션 RP 배율 (1.5 = +50%)
	UnderdogRPBonus = 1.5
)

// ── 일일 정산 결과 ──

// DailySettlementResult는 일일 정산 결과를 담는다.
type DailySettlementResult struct {
	// SettledAt는 정산 시각
	SettledAt time.Time `json:"settledAt"`
	// RegionResults는 지역별 정산 결과
	RegionResults []RegionSettlementResult `json:"regionResults"`
	// SovereigntyChanges는 국가 주권 변동 목록
	SovereigntyChanges []SovereigntyChange `json:"sovereigntyChanges"`
}

// RegionSettlementResult는 개별 지역의 정산 결과.
type RegionSettlementResult struct {
	RegionId          string         `json:"regionId"`
	CountryCode       string         `json:"countryCode"`
	WinnerFactionId   string         `json:"winnerFactionId,omitempty"`
	PreviousController string        `json:"previousController,omitempty"`
	IsContested       bool           `json:"isContested"`
	ControlStreak     int            `json:"controlStreak"`
	SovereigntyLevel  SovereigntyLevel `json:"sovereigntyLevel"`
	FinalScores       map[string]int `json:"finalScores"`
}

// SovereigntyChange는 국가 주권 변동 이벤트.
type SovereigntyChange struct {
	CountryCode     string           `json:"countryCode"`
	OldFaction      string           `json:"oldFaction,omitempty"`
	NewFaction      string           `json:"newFaction,omitempty"`
	OldLevel        SovereigntyLevel `json:"oldLevel"`
	NewLevel        SovereigntyLevel `json:"newLevel"`
}

// ── TerritoryEngine 콜백 ──

// TerritoryCallbacks holds optional callbacks for territory events.
type TerritoryCallbacks struct {
	// OnRegionControlChange is called when a region's controlling faction changes.
	OnRegionControlChange func(regionId, oldFaction, newFaction string)
	// OnSovereigntyChange is called when a country's sovereignty level changes.
	OnSovereigntyChange func(countryCode string, change SovereigntyChange)
	// OnDailySettlement is called when daily settlement completes.
	OnDailySettlement func(result *DailySettlementResult)
}

// ── TerritoryEngine 본체 ──

// TerritoryEngine manages territory domination and daily settlement.
// Replaces DominationEngine with round-based RP accumulation
// and UTC 00:00 daily settlement.
type TerritoryEngine struct {
	mu sync.RWMutex

	// 지역별 영토 상태 (regionId → state)
	regionStates map[string]*RegionTerritoryState
	// 국가별 주권 상태 (countryCode → state)
	countryStates map[string]*CountryTerritoryState
	// 국가별 지역 ID 목록 (countryCode → []regionId)
	countryRegions map[string][]string

	// 콜백
	callbacks TerritoryCallbacks

	// 마지막 일일 정산 시각
	lastDailySettlement time.Time
}

// RegionTerritoryState는 지역 영토 상태를 관리한다.
type RegionTerritoryState struct {
	RegionId          string         `json:"regionId"`
	CountryCode       string         `json:"countryCode"`
	CurrentController string         `json:"currentController,omitempty"` // 현재 지배 팩션 ID
	ControllerColor   string         `json:"controllerColor,omitempty"`   // 지배 팩션 컬러
	DailyRP           map[string]int `json:"dailyRP"`                     // factionId → 오늘 누적 RP
	ControlStreak     int            `json:"controlStreak"`               // 연속 지배 일수
	SovereigntyLevel  SovereigntyLevel `json:"sovereigntyLevel"`
	LastSettlementAt  time.Time      `json:"lastSettlementAt"`
	ControlSince      *time.Time     `json:"controlSince,omitempty"`
	// 건물 목록 (지배 변경 시 인수 처리)
	Buildings []*RegionBuilding `json:"buildings,omitempty"`
}

// CountryTerritoryState는 국가 주권 상태를 관리한다.
type CountryTerritoryState struct {
	CountryCode      string           `json:"countryCode"`
	CountryTier      CountryTier      `json:"countryTier"`
	RegionCount      int              `json:"regionCount"`
	SovereignFaction string           `json:"sovereignFaction,omitempty"`
	SovereigntyLevel SovereigntyLevel `json:"sovereigntyLevel"`
	SovereignSince   *time.Time       `json:"sovereignSince,omitempty"`
	StreakDays       int              `json:"streakDays"`
}

// NewTerritoryEngine creates a new TerritoryEngine.
func NewTerritoryEngine() *TerritoryEngine {
	return &TerritoryEngine{
		regionStates:   make(map[string]*RegionTerritoryState),
		countryStates:  make(map[string]*CountryTerritoryState),
		countryRegions: make(map[string][]string),
	}
}

// SetCallbacks sets the territory event callbacks.
func (te *TerritoryEngine) SetCallbacks(cb TerritoryCallbacks) {
	te.mu.Lock()
	defer te.mu.Unlock()
	te.callbacks = cb
}

// ── 초기화 ──

// RegisterRegion registers a region for territory tracking.
func (te *TerritoryEngine) RegisterRegion(regionId, countryCode string) {
	te.mu.Lock()
	defer te.mu.Unlock()

	if _, exists := te.regionStates[regionId]; exists {
		return // 이미 등록됨
	}

	te.regionStates[regionId] = &RegionTerritoryState{
		RegionId:         regionId,
		CountryCode:      countryCode,
		DailyRP:          make(map[string]int),
		SovereigntyLevel: SovLevelNone,
	}

	// 국가-지역 매핑 업데이트
	te.countryRegions[countryCode] = append(te.countryRegions[countryCode], regionId)

	slog.Debug("territory: region registered",
		"regionId", regionId,
		"countryCode", countryCode,
	)
}

// RegisterCountry registers a country for sovereignty tracking.
func (te *TerritoryEngine) RegisterCountry(countryCode string, tier CountryTier, regionCount int) {
	te.mu.Lock()
	defer te.mu.Unlock()

	if _, exists := te.countryStates[countryCode]; exists {
		return
	}

	te.countryStates[countryCode] = &CountryTerritoryState{
		CountryCode:      countryCode,
		CountryTier:      tier,
		RegionCount:      regionCount,
		SovereigntyLevel: SovLevelNone,
	}

	slog.Debug("territory: country registered",
		"countryCode", countryCode,
		"tier", tier,
		"regionCount", regionCount,
	)
}

// ── 라운드별 RP 누적 ──

// OnRoundSettlement is called at the end of each round (Settlement phase)
// to accumulate RP from the round result into daily totals.
func (te *TerritoryEngine) OnRoundSettlement(regionId string, result *RegionRoundResult) {
	te.mu.Lock()
	defer te.mu.Unlock()

	state, ok := te.regionStates[regionId]
	if !ok {
		slog.Warn("territory: unknown region in round settlement",
			"regionId", regionId,
		)
		return
	}

	for _, fr := range result.FactionResults {
		rp := fr.SurvivalRP + fr.KillRP + fr.ResourceRP

		// Underdog 보너스: 소규모 팩션(3명 이하) RP +50%
		if fr.MemberCount > 0 && fr.MemberCount <= UnderdogRPThreshold {
			rp = int(float64(rp) * UnderdogRPBonus)
		}

		if rp > 0 {
			state.DailyRP[fr.FactionId] += rp
		}
	}

	slog.Debug("territory: round RP accumulated",
		"regionId", regionId,
		"round", result.RoundNumber,
		"factions", len(result.FactionResults),
	)
}

// AddRP manually adds RP for a faction in a region (e.g., from kill events).
func (te *TerritoryEngine) AddRP(regionId, factionId string, rp int) {
	te.mu.Lock()
	defer te.mu.Unlock()

	state, ok := te.regionStates[regionId]
	if !ok {
		return
	}

	if rp > 0 {
		state.DailyRP[factionId] += rp
	}
}

// ── 일일 정산 (UTC 00:00) ──

// DailySettlement performs the daily territory settlement.
// Should be called once per day at UTC 00:00.
// Returns the settlement result for broadcasting.
func (te *TerritoryEngine) DailySettlement() *DailySettlementResult {
	te.mu.Lock()
	defer te.mu.Unlock()

	now := time.Now().UTC()
	result := &DailySettlementResult{
		SettledAt:          now,
		RegionResults:      make([]RegionSettlementResult, 0, len(te.regionStates)),
		SovereigntyChanges: make([]SovereigntyChange, 0),
	}

	// 1. 각 지역별 정산
	for regionId, state := range te.regionStates {
		regionResult := te.settleRegion(regionId, state, now)
		result.RegionResults = append(result.RegionResults, regionResult)
	}

	// 2. 국가 주권 판정
	for countryCode, cs := range te.countryStates {
		change := te.updateCountrySovereignty(countryCode, cs, now)
		if change != nil {
			result.SovereigntyChanges = append(result.SovereigntyChanges, *change)
		}
	}

	te.lastDailySettlement = now

	// 3. 콜백 호출
	if te.callbacks.OnDailySettlement != nil {
		te.callbacks.OnDailySettlement(result)
	}

	slog.Info("territory: daily settlement completed",
		"regions", len(result.RegionResults),
		"sovereigntyChanges", len(result.SovereigntyChanges),
	)

	return result
}

// settleRegion performs daily settlement for a single region.
func (te *TerritoryEngine) settleRegion(
	regionId string,
	state *RegionTerritoryState,
	now time.Time,
) RegionSettlementResult {
	result := RegionSettlementResult{
		RegionId:    regionId,
		CountryCode: state.CountryCode,
		FinalScores: make(map[string]int),
	}

	// 점수 복사 (정산 후 리셋 전)
	for fid, rp := range state.DailyRP {
		result.FinalScores[fid] = rp
	}

	// 1. 최다 RP 팩션 결정
	winnerId, maxRP := te.findWinner(state.DailyRP)

	// 2. 최소 RP 임계값 검사
	if maxRP < TerritoryMinRP {
		winnerId = ""
	}

	// 3. 격차 검사 — 2위와의 격차가 일정 비율 이상이어야 지배 확정
	if winnerId != "" {
		isContested := te.checkContested(state, winnerId, maxRP)
		if isContested {
			winnerId = ""
			result.IsContested = true
		}
	}

	// 4. 지배 변경 처리
	previousController := state.CurrentController
	result.PreviousController = previousController

	if winnerId != "" && winnerId != state.CurrentController {
		// 지배 팩션 교체
		te.onControlChange(state, previousController, winnerId, now)
		result.WinnerFactionId = winnerId
		result.ControlStreak = 1
	} else if winnerId != "" && winnerId == state.CurrentController {
		// 기존 지배 유지 → 연속 일수 증가
		state.ControlStreak++
		result.WinnerFactionId = winnerId
		result.ControlStreak = state.ControlStreak
	} else if winnerId == "" && state.CurrentController != "" {
		// 경합 또는 활동 부족 → 기존 지배 유지하되 연속 일수 증가 안 함
		result.WinnerFactionId = state.CurrentController
		result.ControlStreak = state.ControlStreak
	}

	// 5. 주권 에스컬레이션 레벨 업데이트
	state.SovereigntyLevel = te.calculateSovereigntyLevel(state.ControlStreak)
	result.SovereigntyLevel = state.SovereigntyLevel

	// 6. 건물 인수 처리 (지배 변경 시)
	if winnerId != "" && winnerId != previousController && previousController != "" {
		te.handleBuildingTransfer(state, winnerId)
	}

	// 7. DailyRP 리셋
	state.DailyRP = make(map[string]int)
	state.LastSettlementAt = now

	return result
}

// findWinner finds the faction with the most RP.
func (te *TerritoryEngine) findWinner(dailyRP map[string]int) (string, int) {
	winnerId := ""
	maxRP := 0

	for factionId, rp := range dailyRP {
		if rp > maxRP {
			winnerId = factionId
			maxRP = rp
		}
	}

	return winnerId, maxRP
}

// checkContested checks if the winner's lead is large enough.
// Returns true if the territory is contested (lead too small).
func (te *TerritoryEngine) checkContested(
	state *RegionTerritoryState,
	winnerId string,
	maxRP int,
) bool {
	// 전체 RP 합산
	totalRP := 0
	secondRP := 0
	for fid, rp := range state.DailyRP {
		totalRP += rp
		if fid != winnerId && rp > secondRP {
			secondRP = rp
		}
	}

	if totalRP == 0 {
		return true // 활동 없음
	}

	// 지배 관성: 연속 3일+ 지배 시 교체에 필요한 격차 증가
	requiredGap := TerritoryDominanceGapPct
	if state.CurrentController == winnerId && state.ControlStreak >= TerritoryInertiaThresholdDays {
		// 기존 지배 팩션이 다시 1위 → 관성 불필요 (기존 유지)
		return false
	}
	if state.CurrentController != "" && state.CurrentController != winnerId &&
		state.ControlStreak >= TerritoryInertiaThresholdDays {
		// 다른 팩션이 교체하려면 더 큰 격차 필요
		requiredGap = TerritoryInertiaGapPct
	}

	// 1위와 2위 간 격차 비율
	winnerPct := float64(maxRP) / float64(totalRP)
	secondPct := float64(secondRP) / float64(totalRP)
	gap := winnerPct - secondPct

	return gap < requiredGap
}

// onControlChange handles a change in the controlling faction of a region.
func (te *TerritoryEngine) onControlChange(
	state *RegionTerritoryState,
	oldFaction, newFaction string,
	now time.Time,
) {
	state.CurrentController = newFaction
	state.ControlStreak = 1
	state.ControlSince = &now

	if te.callbacks.OnRegionControlChange != nil {
		te.callbacks.OnRegionControlChange(state.RegionId, oldFaction, newFaction)
	}

	slog.Info("territory: region control changed",
		"regionId", state.RegionId,
		"from", oldFaction,
		"to", newFaction,
	)
}

// calculateSovereigntyLevel determines the sovereignty level from streak days.
func (te *TerritoryEngine) calculateSovereigntyLevel(streakDays int) SovereigntyLevel {
	switch {
	case streakDays >= SovereigntyHegDays:
		return SovLevelHegemony
	case streakDays >= SovereigntySovDays:
		return SovLevelSovereignty
	case streakDays >= SovereigntyActiveDomDays:
		return SovLevelActiveDomination
	default:
		return SovLevelNone
	}
}

// handleBuildingTransfer neutralizes buildings when control changes.
func (te *TerritoryEngine) handleBuildingTransfer(state *RegionTerritoryState, newFaction string) {
	for _, building := range state.Buildings {
		if building.OwnerFaction != newFaction {
			building.Active = false
			building.ActivationCost = building.OriginalCost / 2 // 50% 비용으로 인수 가능
		}
	}
}

// ── 국가 주권 판정 ──

// updateCountrySovereignty checks if a faction controls all regions of a country.
func (te *TerritoryEngine) updateCountrySovereignty(
	countryCode string,
	cs *CountryTerritoryState,
	now time.Time,
) *SovereigntyChange {
	regionIds, ok := te.countryRegions[countryCode]
	if !ok || len(regionIds) == 0 {
		return nil
	}

	oldFaction := cs.SovereignFaction
	oldLevel := cs.SovereigntyLevel

	// 모든 지역의 지배 팩션 확인
	controllerFaction := te.checkAllRegionsControlled(countryCode)

	if controllerFaction != "" {
		// 모든 지역을 한 팩션이 지배 → 국가 주권 후보
		if controllerFaction == cs.SovereignFaction {
			// 기존 주권 유지 → 연속 일수 증가
			cs.StreakDays++
		} else {
			// 새 팩션이 전 지역 통일
			cs.SovereignFaction = controllerFaction
			cs.StreakDays = 1
			cs.SovereignSince = &now
		}

		// 주권 레벨 업데이트
		cs.SovereigntyLevel = te.calculateSovereigntyLevel(cs.StreakDays)
	} else {
		// 전 지역 통일 실패 → 주권 상실
		cs.SovereignFaction = ""
		cs.SovereigntyLevel = SovLevelNone
		cs.StreakDays = 0
		cs.SovereignSince = nil
	}

	// 변경 감지
	if cs.SovereignFaction != oldFaction || cs.SovereigntyLevel != oldLevel {
		change := &SovereigntyChange{
			CountryCode: countryCode,
			OldFaction:  oldFaction,
			NewFaction:  cs.SovereignFaction,
			OldLevel:    oldLevel,
			NewLevel:    cs.SovereigntyLevel,
		}

		if te.callbacks.OnSovereigntyChange != nil {
			te.callbacks.OnSovereigntyChange(countryCode, *change)
		}

		slog.Info("territory: sovereignty changed",
			"country", countryCode,
			"oldFaction", oldFaction,
			"newFaction", cs.SovereignFaction,
			"oldLevel", oldLevel,
			"newLevel", cs.SovereigntyLevel,
		)

		return change
	}

	return nil
}

// checkAllRegionsControlled checks if a single faction controls all regions
// of a country. Returns the faction ID or "" if not unified.
func (te *TerritoryEngine) checkAllRegionsControlled(countryCode string) string {
	regionIds, ok := te.countryRegions[countryCode]
	if !ok || len(regionIds) == 0 {
		return ""
	}

	var controller string
	for _, regionId := range regionIds {
		state, ok := te.regionStates[regionId]
		if !ok || state.CurrentController == "" {
			return "" // 미지배 지역 존재
		}
		if controller == "" {
			controller = state.CurrentController
		} else if state.CurrentController != controller {
			return "" // 서로 다른 팩션이 지배
		}
	}

	return controller
}

// ── Public Getters (Thread-Safe) ──

// GetRegionState returns the territory state for a region.
func (te *TerritoryEngine) GetRegionState(regionId string) *RegionTerritoryState {
	te.mu.RLock()
	defer te.mu.RUnlock()

	state, ok := te.regionStates[regionId]
	if !ok {
		return nil
	}

	// 복사본 반환
	copy := *state
	copy.DailyRP = make(map[string]int, len(state.DailyRP))
	for k, v := range state.DailyRP {
		copy.DailyRP[k] = v
	}
	return &copy
}

// GetCountryState returns the sovereignty state for a country.
func (te *TerritoryEngine) GetCountryState(countryCode string) *CountryTerritoryState {
	te.mu.RLock()
	defer te.mu.RUnlock()

	cs, ok := te.countryStates[countryCode]
	if !ok {
		return nil
	}

	copy := *cs
	return &copy
}

// GetAllRegionStates returns all region territory states (snapshot).
func (te *TerritoryEngine) GetAllRegionStates() map[string]*RegionTerritoryState {
	te.mu.RLock()
	defer te.mu.RUnlock()

	result := make(map[string]*RegionTerritoryState, len(te.regionStates))
	for id, state := range te.regionStates {
		s := *state
		s.DailyRP = make(map[string]int, len(state.DailyRP))
		for k, v := range state.DailyRP {
			s.DailyRP[k] = v
		}
		result[id] = &s
	}
	return result
}

// GetAllCountryStates returns all country sovereignty states (snapshot).
func (te *TerritoryEngine) GetAllCountryStates() map[string]*CountryTerritoryState {
	te.mu.RLock()
	defer te.mu.RUnlock()

	result := make(map[string]*CountryTerritoryState, len(te.countryStates))
	for code, cs := range te.countryStates {
		c := *cs
		result[code] = &c
	}
	return result
}

// GetRegionDailyRP returns the current daily RP scores for a region.
func (te *TerritoryEngine) GetRegionDailyRP(regionId string) map[string]int {
	te.mu.RLock()
	defer te.mu.RUnlock()

	state, ok := te.regionStates[regionId]
	if !ok {
		return nil
	}

	result := make(map[string]int, len(state.DailyRP))
	for k, v := range state.DailyRP {
		result[k] = v
	}
	return result
}

// GetCountryRegions returns the region IDs for a country.
func (te *TerritoryEngine) GetCountryRegions(countryCode string) []string {
	te.mu.RLock()
	defer te.mu.RUnlock()

	regions, ok := te.countryRegions[countryCode]
	if !ok {
		return nil
	}

	result := make([]string, len(regions))
	copy(result, regions)
	return result
}

// GetSettlementCountdown returns seconds until next UTC 00:00 settlement.
func (te *TerritoryEngine) GetSettlementCountdown() int {
	now := time.Now().UTC()
	nextSettlement := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	return int(nextSettlement.Sub(now).Seconds())
}

// GetLastSettlementTime returns the time of the last daily settlement.
func (te *TerritoryEngine) GetLastSettlementTime() time.Time {
	te.mu.RLock()
	defer te.mu.RUnlock()
	return te.lastDailySettlement
}

// ── 직렬화용 헬퍼 ──

// GetTerritorySnapshot returns a snapshot of all territory data
// suitable for WebSocket broadcasting.
type TerritorySnapshot struct {
	Regions    []TerritoryRegionSnapshot  `json:"regions"`
	Countries  []TerritorySovereigntySnapshot `json:"countries"`
	Countdown  int                        `json:"settlementCountdown"`
	SettledAt  string                     `json:"lastSettledAt,omitempty"`
}

// TerritoryRegionSnapshot는 개별 지역의 영토 스냅샷.
type TerritoryRegionSnapshot struct {
	RegionId          string           `json:"regionId"`
	CountryCode       string           `json:"countryCode"`
	ControllerFaction string           `json:"controllerFaction,omitempty"`
	ControllerColor   string           `json:"controllerColor,omitempty"`
	ControlStreak     int              `json:"controlStreak"`
	SovereigntyLevel  SovereigntyLevel `json:"sovereigntyLevel"`
	DailyRP           map[string]int   `json:"dailyRP,omitempty"`
}

// TerritorySovereigntySnapshot는 국가 주권 스냅샷.
type TerritorySovereigntySnapshot struct {
	CountryCode      string           `json:"countryCode"`
	SovereignFaction string           `json:"sovereignFaction,omitempty"`
	SovereigntyLevel SovereigntyLevel `json:"sovereigntyLevel"`
	StreakDays       int              `json:"streakDays"`
	AllControlled    bool             `json:"allControlled"`
}

// GetSnapshot returns a complete territory snapshot for broadcasting.
func (te *TerritoryEngine) GetSnapshot() *TerritorySnapshot {
	te.mu.RLock()
	defer te.mu.RUnlock()

	snapshot := &TerritorySnapshot{
		Regions:   make([]TerritoryRegionSnapshot, 0, len(te.regionStates)),
		Countries: make([]TerritorySovereigntySnapshot, 0, len(te.countryStates)),
		Countdown: te.GetSettlementCountdown(),
	}

	if !te.lastDailySettlement.IsZero() {
		snapshot.SettledAt = te.lastDailySettlement.Format(time.RFC3339)
	}

	// 지역 스냅샷
	for _, state := range te.regionStates {
		rs := TerritoryRegionSnapshot{
			RegionId:          state.RegionId,
			CountryCode:       state.CountryCode,
			ControllerFaction: state.CurrentController,
			ControllerColor:   state.ControllerColor,
			ControlStreak:     state.ControlStreak,
			SovereigntyLevel:  state.SovereigntyLevel,
		}
		// Daily RP 복사 (비어있지 않은 경우만)
		if len(state.DailyRP) > 0 {
			rs.DailyRP = make(map[string]int, len(state.DailyRP))
			for k, v := range state.DailyRP {
				rs.DailyRP[k] = v
			}
		}
		snapshot.Regions = append(snapshot.Regions, rs)
	}

	// 국가 스냅샷
	for _, cs := range te.countryStates {
		allControlled := te.checkAllRegionsControlled(cs.CountryCode) != ""
		snapshot.Countries = append(snapshot.Countries, TerritorySovereigntySnapshot{
			CountryCode:      cs.CountryCode,
			SovereignFaction: cs.SovereignFaction,
			SovereigntyLevel: cs.SovereigntyLevel,
			StreakDays:       cs.StreakDays,
			AllControlled:    allControlled,
		})
	}

	// 정렬 (안정적인 순서)
	sort.Slice(snapshot.Regions, func(i, j int) bool {
		return snapshot.Regions[i].RegionId < snapshot.Regions[j].RegionId
	})
	sort.Slice(snapshot.Countries, func(i, j int) bool {
		return snapshot.Countries[i].CountryCode < snapshot.Countries[j].CountryCode
	})

	return snapshot
}

// ── 일일 정산 스케줄러 헬퍼 ──

// ShouldRunDailySettlement checks if it's time to run daily settlement.
// Should be called periodically (e.g., every minute) from the main game loop.
func (te *TerritoryEngine) ShouldRunDailySettlement() bool {
	te.mu.RLock()
	defer te.mu.RUnlock()

	now := time.Now().UTC()

	// 마지막 정산이 오늘이면 스킵
	if !te.lastDailySettlement.IsZero() {
		lastDate := te.lastDailySettlement.Truncate(24 * time.Hour)
		todayDate := now.Truncate(24 * time.Hour)
		if !lastDate.Before(todayDate) {
			return false // 이미 오늘 정산 완료
		}
	}

	// UTC 00:00~00:05 사이에 정산 실행 (5분 윈도우)
	return now.Hour() == 0 && now.Minute() < 5
}

// ── SetControllerColor: 팩션 컬러 업데이트 ──

// SetRegionControllerColor updates the display color for a region's controlling faction.
func (te *TerritoryEngine) SetRegionControllerColor(regionId, color string) {
	te.mu.Lock()
	defer te.mu.Unlock()

	if state, ok := te.regionStates[regionId]; ok {
		state.ControllerColor = color
	}
}
