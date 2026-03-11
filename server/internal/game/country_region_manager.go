package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v39 Phase 4 — CountryRegionManager: 국가 → 지역 매핑 + RegionArena 관리
//
// 역할:
//   1. 국가별 지역 목록/메타데이터 제공
//   2. RegionArena Lazy Init (첫 플레이어 진입 시 생성)
//   3. RegionArena Teardown (60초 유휴 시 해제)
//   4. 지역 상태 조회 API (지배 팩션, 접속 인원, 라운드 상태)
//   5. WebSocket join_region / leave_region 처리
//
// 통합: CountryArenaManager 와 함께 동작 — 국가 진입 후 지역 선택 단계 추가.
// ============================================================

// RegionArenaState represents the runtime state of a single region arena.
type RegionArenaState struct {
	RegionId     string
	CountryCode  string
	RegionName   string
	RegionNameEn string
	RegionType   RegionType
	ArenaSize    int
	MaxPlayers   int

	// 런타임 상태
	State          RegionState
	Players        map[string]*RegionPlayer // clientId → player
	PlayerCount    int
	LastActivity   time.Time
	RoundNumber    int
	RoundPhase     RoundPhase
	RoundCountdown float64

	// 지배 정보
	ControllingFactionId    string
	ControllingFactionColor string
	ControlStreak           int

	// 자원 정보
	PrimaryResource   string
	SpecialtyResource string

	mu sync.RWMutex
}

// RegionPlayer represents a player within a region arena.
type RegionPlayer struct {
	ClientID    string
	Name        string
	FactionId   string
	FactionName string
	JoinedAt    time.Time
}

// RegionListEntry is the payload for country_regions response.
type RegionListEntry struct {
	RegionId              string `json:"regionId"`
	Name                  string `json:"name"`
	NameEn                string `json:"nameEn"`
	Type                  string `json:"type"`
	ArenaSize             int    `json:"arenaSize"`
	MaxPlayers            int    `json:"maxPlayers"`
	CurrentPlayers        int    `json:"currentPlayers"`
	State                 string `json:"state"`
	ControllingFactionId  string `json:"controllingFactionId,omitempty"`
	ControllingFactionColor string `json:"controllingFactionColor,omitempty"`
	ControlStreak         int    `json:"controlStreak"`
	PrimaryResource       string `json:"primaryResource"`
	SpecialtyResource     string `json:"specialtyResource"`
	Biome                 string `json:"biome"`
	SpecialEffect         string `json:"specialEffect"`
}

// RegionJoinRequest contains data for a region join request.
type RegionJoinRequest struct {
	ClientID    string
	Name        string
	CountryCode string
	RegionId    string
	FactionId   string
	FactionName string
}

// RegionJoinResult is the response after joining a region arena.
type RegionJoinResult struct {
	Success     bool   `json:"success"`
	RegionId    string `json:"regionId"`
	CountryCode string `json:"countryCode"`
	Phase       string `json:"phase"`
	ArenaSize   int    `json:"arenaSize"`
	Error       string `json:"error,omitempty"`
}

// CountryRegionManager manages region arenas for all countries.
type CountryRegionManager struct {
	mu sync.RWMutex

	// 활성 지역 아레나: regionId → RegionArenaState
	regions map[string]*RegionArenaState

	// 플레이어 라우팅: clientId → regionId
	playerRegion map[string]string

	// 국가별 지역 정의 (정적, Phase 1 region_types.go 참조)
	countryRegionDefs map[string]*CountryRegionsDef

	// 설정
	idleTimeoutSec float64 // 유휴 해제 시간 (초)

	// 이벤트 콜백
	OnRegionStateChange func(regionId string, state *RegionArenaState)
}

// NewCountryRegionManager creates a new manager.
func NewCountryRegionManager() *CountryRegionManager {
	crm := &CountryRegionManager{
		regions:           make(map[string]*RegionArenaState),
		playerRegion:      make(map[string]string),
		countryRegionDefs: make(map[string]*CountryRegionsDef),
		idleTimeoutSec:    60.0,
	}

	// 정적 데이터 초기화 — S/A 티어 국가를 등록한다.
	// 나머지 국가들은 첫 접근 시 자동 생성된다.
	crm.initStaticRegionDefs()

	return crm
}

// initStaticRegionDefs registers static region definitions from region_types.go.
func (crm *CountryRegionManager) initStaticRegionDefs() {
	// S 티어 국가들 — 7 지역
	for _, code := range STierCountries {
		tc := GetTierConfig(TierS)
		crm.countryRegionDefs[code] = crm.generateCountryDef(code, TierS, tc)
	}
	// A 티어 국가들 — 5 지역
	for _, code := range ATierCountries {
		tc := GetTierConfig(TierA)
		crm.countryRegionDefs[code] = crm.generateCountryDef(code, TierA, tc)
	}
}

// generateCountryDef creates a CountryRegionsDef from tier config.
func (crm *CountryRegionManager) generateCountryDef(
	countryCode string,
	tier CountryTier,
	tc TierConfig,
) *CountryRegionsDef {
	regions := make([]RegionDef, 0, tc.RegionCount)

	// 7가지 지역 유형 순환
	types := []RegionType{
		RegionCapital, RegionIndustrial, RegionPort,
		RegionAgricultural, RegionMilitary, RegionResource, RegionCultural,
	}
	resources := map[RegionType]ResourceType{
		RegionCapital:      ResourceTech,
		RegionIndustrial:   ResourceMinerals,
		RegionPort:         ResourceGold,
		RegionAgricultural: ResourceFood,
		RegionMilitary:     ResourceOil,
		RegionResource:     ResourceMinerals,
		RegionCultural:     ResourceInfluence,
	}

	for i := 0; i < tc.RegionCount; i++ {
		rType := types[i%len(types)]
		regionId := fmt.Sprintf("%s_region_%d", countryCode, i+1)
		regions = append(regions, RegionDef{
			RegionId:          regionId,
			CountryCode:       countryCode,
			Name:              fmt.Sprintf("%s Region %d", countryCode, i+1),
			NameEn:            fmt.Sprintf("%s Region %d", countryCode, i+1),
			Type:              rType,
			PrimaryResource:   resources[rType],
			SpecialtyResource: "generic",
			Biome:             "urban",
			SpecialEffect:     "",
			ArenaSize:         tc.ArenaSize,
			MaxPlayers:        tc.MaxPlayers,
		})
	}

	return &CountryRegionsDef{
		CountryCode:       countryCode,
		Tier:              tier,
		Regions:           regions,
		SpecialtyResource: "generic",
		ArenaSize:         tc.ArenaSize,
		MaxPlayers:        tc.MaxPlayers,
	}
}

// GetCountryRegions returns region definitions for a country.
// Auto-generates for unknown countries using default tier D.
func (crm *CountryRegionManager) GetCountryRegions(countryCode string) *CountryRegionsDef {
	crm.mu.RLock()
	def, ok := crm.countryRegionDefs[countryCode]
	crm.mu.RUnlock()

	if ok {
		return def
	}

	// 미등록 국가 → 기본 D 티어로 자동 생성
	crm.mu.Lock()
	defer crm.mu.Unlock()

	// Double-check after acquiring write lock
	if def, ok := crm.countryRegionDefs[countryCode]; ok {
		return def
	}

	tc := GetTierConfig(TierD)
	def = crm.generateCountryDef(countryCode, TierD, tc)
	crm.countryRegionDefs[countryCode] = def
	return def
}

// GetRegionList returns a list of RegionListEntry for client display.
func (crm *CountryRegionManager) GetRegionList(countryCode string) []RegionListEntry {
	def := crm.GetCountryRegions(countryCode)
	if def == nil {
		return nil
	}

	crm.mu.RLock()
	defer crm.mu.RUnlock()

	entries := make([]RegionListEntry, 0, len(def.Regions))
	for _, rd := range def.Regions {
		entry := RegionListEntry{
			RegionId:          rd.RegionId,
			Name:              rd.Name,
			NameEn:            rd.NameEn,
			Type:              string(rd.Type),
			ArenaSize:         rd.ArenaSize,
			MaxPlayers:        rd.MaxPlayers,
			CurrentPlayers:    0,
			State:             string(RegionIdle),
			PrimaryResource:   string(rd.PrimaryResource),
			SpecialtyResource: rd.SpecialtyResource,
			Biome:             rd.Biome,
			SpecialEffect:     rd.SpecialEffect,
		}

		// 활성 아레나가 있으면 실시간 정보 반영
		if arena, ok := crm.regions[rd.RegionId]; ok {
			arena.mu.RLock()
			entry.CurrentPlayers = arena.PlayerCount
			entry.State = string(arena.State)
			entry.ControllingFactionId = arena.ControllingFactionId
			entry.ControllingFactionColor = arena.ControllingFactionColor
			entry.ControlStreak = arena.ControlStreak
			arena.mu.RUnlock()
		}

		entries = append(entries, entry)
	}

	return entries
}

// JoinRegion handles a player joining a specific region arena.
func (crm *CountryRegionManager) JoinRegion(req RegionJoinRequest) *RegionJoinResult {
	// 지역 정의 확인
	def := crm.GetCountryRegions(req.CountryCode)
	if def == nil {
		return &RegionJoinResult{
			Success: false,
			Error:   "country not found: " + req.CountryCode,
		}
	}

	// 지역 ID 유효성 검증
	var regionDef *RegionDef
	for i := range def.Regions {
		if def.Regions[i].RegionId == req.RegionId {
			regionDef = &def.Regions[i]
			break
		}
	}
	if regionDef == nil {
		return &RegionJoinResult{
			Success: false,
			Error:   "region not found: " + req.RegionId,
		}
	}

	crm.mu.Lock()
	defer crm.mu.Unlock()

	// 이미 다른 지역에 있으면 먼저 퇴장
	if oldRegion, ok := crm.playerRegion[req.ClientID]; ok {
		crm.leaveRegionLocked(req.ClientID, oldRegion)
	}

	// Lazy Init: 아레나가 없으면 생성
	arena, ok := crm.regions[req.RegionId]
	if !ok {
		arena = crm.createRegionArenaLocked(regionDef)
	}

	// 인원 초과 확인
	arena.mu.Lock()
	if arena.PlayerCount >= arena.MaxPlayers {
		arena.mu.Unlock()
		return &RegionJoinResult{
			Success: false,
			Error:   "region full",
		}
	}

	// 플레이어 추가
	arena.Players[req.ClientID] = &RegionPlayer{
		ClientID:    req.ClientID,
		Name:        req.Name,
		FactionId:   req.FactionId,
		FactionName: req.FactionName,
		JoinedAt:    time.Now(),
	}
	arena.PlayerCount = len(arena.Players)
	arena.LastActivity = time.Now()
	if arena.State == RegionIdle {
		arena.State = RegionActive
	}
	phase := string(arena.RoundPhase)
	arenaSize := arena.ArenaSize
	arena.mu.Unlock()

	// 라우팅 등록
	crm.playerRegion[req.ClientID] = req.RegionId

	slog.Info("player joined region",
		"clientId", req.ClientID,
		"regionId", req.RegionId,
		"countryCode", req.CountryCode,
		"players", arena.PlayerCount,
	)

	return &RegionJoinResult{
		Success:     true,
		RegionId:    req.RegionId,
		CountryCode: req.CountryCode,
		Phase:       phase,
		ArenaSize:   arenaSize,
	}
}

// LeaveRegion handles a player leaving a region arena.
func (crm *CountryRegionManager) LeaveRegion(clientID string) {
	crm.mu.Lock()
	defer crm.mu.Unlock()

	regionId, ok := crm.playerRegion[clientID]
	if !ok {
		return
	}

	crm.leaveRegionLocked(clientID, regionId)
}

// leaveRegionLocked handles the actual leave logic. Caller must hold crm.mu.
func (crm *CountryRegionManager) leaveRegionLocked(clientID, regionId string) {
	arena, ok := crm.regions[regionId]
	if !ok {
		delete(crm.playerRegion, clientID)
		return
	}

	arena.mu.Lock()
	delete(arena.Players, clientID)
	arena.PlayerCount = len(arena.Players)
	arena.LastActivity = time.Now()
	playerCount := arena.PlayerCount
	arena.mu.Unlock()

	delete(crm.playerRegion, clientID)

	slog.Info("player left region",
		"clientId", clientID,
		"regionId", regionId,
		"remaining", playerCount,
	)
}

// createRegionArenaLocked creates a new RegionArenaState. Caller must hold crm.mu.
func (crm *CountryRegionManager) createRegionArenaLocked(rd *RegionDef) *RegionArenaState {
	arena := &RegionArenaState{
		RegionId:          rd.RegionId,
		CountryCode:       rd.CountryCode,
		RegionName:        rd.Name,
		RegionNameEn:      rd.NameEn,
		RegionType:        rd.Type,
		ArenaSize:         rd.ArenaSize,
		MaxPlayers:        rd.MaxPlayers,
		State:             RegionIdle,
		Players:           make(map[string]*RegionPlayer),
		LastActivity:      time.Now(),
		RoundNumber:       0,
		RoundPhase:        PhasePvE,
		PrimaryResource:   string(rd.PrimaryResource),
		SpecialtyResource: rd.SpecialtyResource,
	}

	crm.regions[rd.RegionId] = arena

	slog.Info("region arena created (lazy)",
		"regionId", rd.RegionId,
		"countryCode", rd.CountryCode,
		"arenaSize", rd.ArenaSize,
		"maxPlayers", rd.MaxPlayers,
	)

	return arena
}

// CleanupIdleRegions removes region arenas that have been idle for longer
// than idleTimeoutSec. Should be called periodically (e.g., every 30s).
func (crm *CountryRegionManager) CleanupIdleRegions() int {
	crm.mu.Lock()
	defer crm.mu.Unlock()

	cleaned := 0
	now := time.Now()

	for regionId, arena := range crm.regions {
		arena.mu.RLock()
		idle := arena.PlayerCount == 0 &&
			now.Sub(arena.LastActivity).Seconds() > crm.idleTimeoutSec
		arena.mu.RUnlock()

		if idle {
			delete(crm.regions, regionId)
			cleaned++
			slog.Info("region arena cleaned up (idle)",
				"regionId", regionId,
			)
		}
	}

	return cleaned
}

// GetPlayerRegion returns the region ID that a player is currently in.
func (crm *CountryRegionManager) GetPlayerRegion(clientID string) (string, bool) {
	crm.mu.RLock()
	defer crm.mu.RUnlock()
	regionId, ok := crm.playerRegion[clientID]
	return regionId, ok
}

// GetRegionState returns the current state of a region arena.
func (crm *CountryRegionManager) GetRegionState(regionId string) *RegionArenaState {
	crm.mu.RLock()
	defer crm.mu.RUnlock()
	return crm.regions[regionId]
}

// GetPlayersInRegion returns client IDs of all players in a region.
func (crm *CountryRegionManager) GetPlayersInRegion(regionId string) []string {
	crm.mu.RLock()
	arena, ok := crm.regions[regionId]
	crm.mu.RUnlock()

	if !ok {
		return nil
	}

	arena.mu.RLock()
	defer arena.mu.RUnlock()

	ids := make([]string, 0, len(arena.Players))
	for id := range arena.Players {
		ids = append(ids, id)
	}
	return ids
}

// GetActiveRegionCount returns the number of currently active region arenas.
func (crm *CountryRegionManager) GetActiveRegionCount() int {
	crm.mu.RLock()
	defer crm.mu.RUnlock()
	return len(crm.regions)
}
