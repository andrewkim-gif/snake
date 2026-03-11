package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v39 Phase 9 — IntelMissionSystem: 인텔 미션 확장
//
// 기존 IntelSystem에 v39 지역 정보를 연동한다.
// 인텔 포인트로 교환 가능한 정보:
//   - EnemyPresence:   적 팩션 주둔 정보 (인원 수, 팩션 ID)
//   - ResourceMap:     자원 분포 정보 (노드 위치 + 유형)
//   - GarrisonStrength: NPC 수비대 강도 정보 (수량, HP, 레벨)
//   - BuildingIntel:   적 건물 정보 (위치, 유형, HP)
//   - TacticalScan:    전술 스캔 — 종합 인텔 (위 모든 정보)
//
// 인텔 미션 비용 (인텔 포인트):
//   정찰(Scout):       20 포인트
//   자원 분석(Analyze): 30 포인트
//   수비대 정찰(Recon): 35 포인트
//   건물 정찰:          25 포인트
//   전술 스캔:          80 포인트 (종합, 할인)
//
// 인텔 포인트 획득: PvE 킬, 자원 채취, 정찰소(ScoutPost) 건물 보너스
// ============================================================

// ── 인텔 미션 종류 ──

// IntelMissionType classifies the type of intel mission.
type IntelMissionType string

const (
	IntelEnemyPresence    IntelMissionType = "enemy_presence"    // 적 팩션 주둔 정보
	IntelResourceMap      IntelMissionType = "resource_map"      // 자원 분포 정보
	IntelGarrisonStrength IntelMissionType = "garrison_strength" // NPC 수비대 강도
	IntelBuildingIntel    IntelMissionType = "building_intel"    // 적 건물 정보
	IntelTacticalScan     IntelMissionType = "tactical_scan"     // 종합 전술 스캔
)

// ── 인텔 포인트 비용 ──

const (
	// IntelCostEnemyPresence는 적 팩션 주둔 정찰 비용 (인텔 포인트)
	IntelCostEnemyPresence = 20
	// IntelCostResourceMap는 자원 분포 분석 비용
	IntelCostResourceMap = 30
	// IntelCostGarrisonStrength는 수비대 정찰 비용
	IntelCostGarrisonStrength = 35
	// IntelCostBuildingInfo는 건물 정찰 비용
	IntelCostBuildingInfo = 25
	// IntelCostTacticalScan는 종합 전술 스캔 비용
	IntelCostTacticalScan = 80

	// ── 인텔 포인트 획득량 ──

	// IntelPointsPerPvEKill은 PvE 몹 처치 시 인텔 포인트
	IntelPointsPerPvEKill = 2
	// IntelPointsPerGather는 자원 채취 1회 시 인텔 포인트
	IntelPointsPerGather = 1
	// IntelPointsScoutPostBonus는 정찰소 보유 시 라운드당 보너스
	IntelPointsScoutPostBonus = 10

	// ── 인텔 유효 기간 ──

	// IntelResultDuration은 인텔 결과 유효 시간 (초)
	IntelResultDuration = 300.0 // 5분
)

// ── 인텔 미션 정의 ──

// IntelMissionDef defines an intel mission template.
type IntelMissionDef struct {
	Type        IntelMissionType `json:"type"`
	Name        string           `json:"name"`
	NameKo      string           `json:"nameKo"`
	Description string           `json:"description"`
	Cost        int              `json:"cost"` // 인텔 포인트 비용
	Duration    float64          `json:"duration"` // 결과 유효 시간 (초)
}

// AllIntelMissionDefs contains all available intel mission definitions.
var AllIntelMissionDefs = map[IntelMissionType]IntelMissionDef{
	IntelEnemyPresence: {
		Type:        IntelEnemyPresence,
		Name:        "Enemy Presence",
		NameKo:      "적 팩션 정찰",
		Description: "Reveals enemy faction presence in target region",
		Cost:        IntelCostEnemyPresence,
		Duration:    IntelResultDuration,
	},
	IntelResourceMap: {
		Type:        IntelResourceMap,
		Name:        "Resource Analysis",
		NameKo:      "자원 분포 분석",
		Description: "Reveals resource node positions and types in target region",
		Cost:        IntelCostResourceMap,
		Duration:    IntelResultDuration,
	},
	IntelGarrisonStrength: {
		Type:        IntelGarrisonStrength,
		Name:        "Garrison Recon",
		NameKo:      "수비대 정찰",
		Description: "Reveals NPC garrison count, strength, and sovereignty level",
		Cost:        IntelCostGarrisonStrength,
		Duration:    IntelResultDuration,
	},
	IntelBuildingIntel: {
		Type:        IntelBuildingIntel,
		Name:        "Building Intel",
		NameKo:      "건물 정찰",
		Description: "Reveals enemy buildings, types, and HP status",
		Cost:        IntelCostBuildingInfo,
		Duration:    IntelResultDuration,
	},
	IntelTacticalScan: {
		Type:        IntelTacticalScan,
		Name:        "Tactical Scan",
		NameKo:      "전술 스캔",
		Description: "Comprehensive intel: enemies, resources, garrison, buildings",
		Cost:        IntelCostTacticalScan,
		Duration:    IntelResultDuration,
	},
}

// GetIntelMissionDef returns the mission definition for a given type.
func GetIntelMissionDef(mt IntelMissionType) *IntelMissionDef {
	if def, ok := AllIntelMissionDefs[mt]; ok {
		return &def
	}
	return nil
}

// ── 인텔 결과 타입 ──

// IntelEnemyPresenceResult contains enemy faction presence data.
type IntelEnemyPresenceResult struct {
	RegionId string                   `json:"regionId"`
	Factions []IntelFactionInfo       `json:"factions"`
	ScannedAt time.Time              `json:"scannedAt"`
}

// IntelFactionInfo represents faction presence info from intel.
type IntelFactionInfo struct {
	FactionId   string `json:"factionId"`
	FactionName string `json:"factionName"`
	MemberCount int    `json:"memberCount"`
	AliveCount  int    `json:"aliveCount"`
	Color       string `json:"color"`
}

// IntelResourceMapResult contains resource distribution data.
type IntelResourceMapResult struct {
	RegionId      string             `json:"regionId"`
	TotalNodes    int                `json:"totalNodes"`
	ActiveNodes   int                `json:"activeNodes"`
	NodesByType   map[string]int     `json:"nodesByType"`
	SpecialtyType string             `json:"specialtyType"`
	SpecialtyNodes int               `json:"specialtyNodes"`
	ScannedAt     time.Time          `json:"scannedAt"`
}

// IntelGarrisonResult contains NPC garrison strength data.
type IntelGarrisonResult struct {
	RegionId         string           `json:"regionId"`
	ControllerFaction string          `json:"controllerFaction,omitempty"`
	SovereigntyLevel SovereigntyLevel `json:"sovereigntyLevel"`
	TotalGuards      int              `json:"totalGuards"`
	AliveGuards      int              `json:"aliveGuards"`
	AvgHP            int              `json:"avgHp"`
	StatMultiplier   float64          `json:"statMultiplier"`
	ScannedAt        time.Time        `json:"scannedAt"`
}

// IntelBuildingResult contains enemy building data.
type IntelBuildingResult struct {
	RegionId  string              `json:"regionId"`
	Buildings []IntelBuildingInfo `json:"buildings"`
	ScannedAt time.Time           `json:"scannedAt"`
}

// IntelBuildingInfo represents a single building's intel data.
type IntelBuildingInfo struct {
	Type         BuildingType `json:"type"`
	OwnerFaction string       `json:"ownerFaction"`
	HP           int          `json:"hp"`
	MaxHP        int          `json:"maxHp"`
	Active       bool         `json:"active"`
	Building     bool         `json:"building"`
	X            float64      `json:"x"`
	Y            float64      `json:"y"`
}

// IntelTacticalScanResult contains comprehensive intel data.
type IntelTacticalScanResult struct {
	RegionId  string                   `json:"regionId"`
	Enemies   *IntelEnemyPresenceResult `json:"enemies"`
	Resources *IntelResourceMapResult   `json:"resources"`
	Garrison  *IntelGarrisonResult      `json:"garrison"`
	Buildings *IntelBuildingResult      `json:"buildings"`
	ScannedAt time.Time                `json:"scannedAt"`
}

// ── 인텔 결과 인스턴스 ──

// IntelResult represents a completed intel mission result.
type IntelResult struct {
	Id           string           `json:"id"`
	MissionType  IntelMissionType `json:"missionType"`
	RegionId     string           `json:"regionId"`
	FactionId    string           `json:"factionId"`
	PlayerId     string           `json:"playerId"`
	Data         interface{}      `json:"data"` // 미션별 결과 데이터
	ExpiresAt    time.Time        `json:"expiresAt"`
	CreatedAt    time.Time        `json:"createdAt"`
}

// IsExpired returns true if the intel result has expired.
func (ir *IntelResult) IsExpired() bool {
	return time.Now().After(ir.ExpiresAt)
}

// ── IntelMissionSystem ──

// IntelMissionSystem manages intel missions and results.
type IntelMissionSystem struct {
	mu sync.RWMutex

	// 팩션별 인텔 포인트: factionId → points
	factionPoints map[string]int

	// 팩션별 활성 인텔 결과: factionId → []IntelResult
	results map[string][]*IntelResult

	// 참조 (읽기 전용으로 사용)
	garrisonManager *GarrisonManager
	buildingSystem  *BuildingSystem
	// resourceSpawner는 지역별이라 Execute 시 전달 받음

	// 카운터
	nextId int
}

// NewIntelMissionSystem creates a new intel mission system.
func NewIntelMissionSystem(gm *GarrisonManager, bsys *BuildingSystem) *IntelMissionSystem {
	return &IntelMissionSystem{
		factionPoints:   make(map[string]int),
		results:         make(map[string][]*IntelResult),
		garrisonManager: gm,
		buildingSystem:  bsys,
		nextId:          0,
	}
}

// ── 인텔 포인트 관리 ──

// AddPoints adds intel points to a faction.
func (ims *IntelMissionSystem) AddPoints(factionId string, points int) {
	ims.mu.Lock()
	defer ims.mu.Unlock()

	if points > 0 {
		ims.factionPoints[factionId] += points
	}
}

// GetPoints returns the current intel points for a faction.
func (ims *IntelMissionSystem) GetPoints(factionId string) int {
	ims.mu.RLock()
	defer ims.mu.RUnlock()
	return ims.factionPoints[factionId]
}

// DeductPoints deducts intel points from a faction.
// Returns false if insufficient points.
func (ims *IntelMissionSystem) DeductPoints(factionId string, cost int) bool {
	ims.mu.Lock()
	defer ims.mu.Unlock()

	current := ims.factionPoints[factionId]
	if current < cost {
		return false
	}
	ims.factionPoints[factionId] = current - cost
	return true
}

// ── 인텔 미션 실행 ──

// ExecuteMission executes an intel mission for a faction on a target region.
// Returns the intel result or nil if the mission cannot be executed.
//
// 호출자가 제공해야 하는 데이터:
//   - factionPresences: 대상 지역 팩션 목록 (FactionPresence 스냅샷)
//   - resourceSpawner: 대상 지역 ResourceSpawner (자원 정보)
//   - regionState: 대상 지역 영토 상태 (TerritoryEngine에서)
func (ims *IntelMissionSystem) ExecuteMission(
	missionType IntelMissionType,
	factionId string,
	playerId string,
	regionId string,
	factionPresences []FactionPresence,
	resourceSpawner *ResourceSpawner,
	regionTerritoryState *RegionTerritoryState,
) *IntelResult {
	def := GetIntelMissionDef(missionType)
	if def == nil {
		return nil
	}

	// 비용 차감
	if !ims.DeductPoints(factionId, def.Cost) {
		slog.Debug("intel: insufficient points",
			"factionId", factionId,
			"cost", def.Cost,
			"current", ims.GetPoints(factionId),
		)
		return nil
	}

	ims.mu.Lock()
	defer ims.mu.Unlock()

	now := time.Now()
	ims.nextId++
	resultId := fmt.Sprintf("intel_%s_%d", factionId, ims.nextId)

	var data interface{}

	switch missionType {
	case IntelEnemyPresence:
		data = ims.gatherEnemyPresence(regionId, factionId, factionPresences)
	case IntelResourceMap:
		data = ims.gatherResourceMap(regionId, resourceSpawner)
	case IntelGarrisonStrength:
		data = ims.gatherGarrisonStrength(regionId, regionTerritoryState)
	case IntelBuildingIntel:
		data = ims.gatherBuildingIntel(regionId, factionId)
	case IntelTacticalScan:
		data = ims.gatherTacticalScan(regionId, factionId, factionPresences, resourceSpawner, regionTerritoryState)
	}

	result := &IntelResult{
		Id:          resultId,
		MissionType: missionType,
		RegionId:    regionId,
		FactionId:   factionId,
		PlayerId:    playerId,
		Data:        data,
		ExpiresAt:   now.Add(time.Duration(def.Duration) * time.Second),
		CreatedAt:   now,
	}

	ims.results[factionId] = append(ims.results[factionId], result)

	slog.Info("intel mission executed",
		"type", missionType,
		"factionId", factionId,
		"regionId", regionId,
		"cost", def.Cost,
	)

	return result
}

// ── 인텔 데이터 수집 (내부) ──

func (ims *IntelMissionSystem) gatherEnemyPresence(
	regionId, myFactionId string,
	factionPresences []FactionPresence,
) *IntelEnemyPresenceResult {
	var factions []IntelFactionInfo
	for _, fp := range factionPresences {
		if fp.FactionId == myFactionId {
			continue // 자기 팩션 정보는 제외
		}
		factions = append(factions, IntelFactionInfo{
			FactionId:   fp.FactionId,
			FactionName: fp.FactionName,
			MemberCount: len(fp.Members),
			AliveCount:  fp.AliveCount,
			Color:       fp.Color,
		})
	}

	return &IntelEnemyPresenceResult{
		RegionId:  regionId,
		Factions:  factions,
		ScannedAt: time.Now(),
	}
}

func (ims *IntelMissionSystem) gatherResourceMap(
	regionId string,
	spawner *ResourceSpawner,
) *IntelResourceMapResult {
	result := &IntelResourceMapResult{
		RegionId:   regionId,
		NodesByType: make(map[string]int),
		ScannedAt:  time.Now(),
	}

	if spawner == nil {
		return result
	}

	nodes := spawner.GetNodes()
	result.TotalNodes = len(nodes)

	for _, node := range nodes {
		result.NodesByType[node.ResourceType]++
		if node.Amount > 0 {
			result.ActiveNodes++
		}
		if node.IsSpecialty {
			result.SpecialtyNodes++
			result.SpecialtyType = node.ResourceType
		}
	}

	return result
}

func (ims *IntelMissionSystem) gatherGarrisonStrength(
	regionId string,
	territoryState *RegionTerritoryState,
) *IntelGarrisonResult {
	result := &IntelGarrisonResult{
		RegionId:  regionId,
		ScannedAt: time.Now(),
	}

	if territoryState != nil {
		result.ControllerFaction = territoryState.CurrentController
		result.SovereigntyLevel = territoryState.SovereigntyLevel
	}

	if ims.garrisonManager != nil {
		guards := ims.garrisonManager.GetGarrison(regionId)
		result.TotalGuards = len(guards)

		totalHP := 0
		aliveCount := 0
		for _, g := range guards {
			if g.IsAlive() {
				aliveCount++
				totalHP += g.HP
			}
			result.StatMultiplier = g.StatMult // 모든 가드 동일 배율
		}
		result.AliveGuards = aliveCount
		if aliveCount > 0 {
			result.AvgHP = totalHP / aliveCount
		}
	}

	return result
}

func (ims *IntelMissionSystem) gatherBuildingIntel(
	regionId, myFactionId string,
) *IntelBuildingResult {
	result := &IntelBuildingResult{
		RegionId:  regionId,
		ScannedAt: time.Now(),
	}

	if ims.buildingSystem != nil {
		buildings := ims.buildingSystem.GetBuildings(regionId)
		for _, b := range buildings {
			if b.OwnerFaction == myFactionId {
				continue // 자기 건물은 제외 (이미 알고 있음)
			}
			result.Buildings = append(result.Buildings, IntelBuildingInfo{
				Type:         b.Type,
				OwnerFaction: b.OwnerFaction,
				HP:           b.HP,
				MaxHP:        b.MaxHP,
				Active:       b.Active,
				Building:     b.Building,
				X:            b.Position.X,
				Y:            b.Position.Y,
			})
		}
	}

	return result
}

func (ims *IntelMissionSystem) gatherTacticalScan(
	regionId, myFactionId string,
	factionPresences []FactionPresence,
	spawner *ResourceSpawner,
	territoryState *RegionTerritoryState,
) *IntelTacticalScanResult {
	return &IntelTacticalScanResult{
		RegionId:  regionId,
		Enemies:   ims.gatherEnemyPresence(regionId, myFactionId, factionPresences),
		Resources: ims.gatherResourceMap(regionId, spawner),
		Garrison:  ims.gatherGarrisonStrength(regionId, territoryState),
		Buildings: ims.gatherBuildingIntel(regionId, myFactionId),
		ScannedAt: time.Now(),
	}
}

// ── Public Getters (Thread-Safe) ──

// GetActiveResults returns non-expired intel results for a faction.
func (ims *IntelMissionSystem) GetActiveResults(factionId string) []*IntelResult {
	ims.mu.RLock()
	defer ims.mu.RUnlock()

	var active []*IntelResult
	for _, r := range ims.results[factionId] {
		if !r.IsExpired() {
			cp := *r
			active = append(active, &cp)
		}
	}
	return active
}

// GetResultsByRegion returns non-expired intel results for a faction in a specific region.
func (ims *IntelMissionSystem) GetResultsByRegion(factionId, regionId string) []*IntelResult {
	ims.mu.RLock()
	defer ims.mu.RUnlock()

	var results []*IntelResult
	for _, r := range ims.results[factionId] {
		if r.RegionId == regionId && !r.IsExpired() {
			cp := *r
			results = append(results, &cp)
		}
	}
	return results
}

// ── 만료 정리 ──

// CleanupExpired removes expired intel results. Should be called periodically.
func (ims *IntelMissionSystem) CleanupExpired() {
	ims.mu.Lock()
	defer ims.mu.Unlock()

	for factionId, results := range ims.results {
		active := results[:0]
		for _, r := range results {
			if !r.IsExpired() {
				active = append(active, r)
			}
		}
		if len(active) == 0 {
			delete(ims.results, factionId)
		} else {
			ims.results[factionId] = active
		}
	}
}

// ── 라운드 전환 시 보너스 포인트 지급 ──

// OnRoundEnd grants bonus intel points to factions with scout posts.
func (ims *IntelMissionSystem) OnRoundEnd(regionId string, factionIds []string) {
	if ims.buildingSystem == nil {
		return
	}

	for _, factionId := range factionIds {
		if ims.buildingSystem.HasScoutPost(regionId, factionId) {
			ims.AddPoints(factionId, IntelPointsScoutPostBonus)
			slog.Debug("intel: scout post bonus granted",
				"factionId", factionId,
				"regionId", regionId,
				"points", IntelPointsScoutPostBonus,
			)
		}
	}
}

// ── 스냅샷 (클라이언트 전송용) ──

// IntelMissionSnapshot is the serialized form for client display.
type IntelMissionSnapshot struct {
	Type        IntelMissionType `json:"type"`
	Name        string           `json:"name"`
	NameKo      string           `json:"nameKo"`
	Description string           `json:"description"`
	Cost        int              `json:"cost"`
	Available   bool             `json:"available"` // 포인트 충분한지
}

// GetAvailableMissions returns the list of available intel missions for a faction.
func (ims *IntelMissionSystem) GetAvailableMissions(factionId string) []IntelMissionSnapshot {
	ims.mu.RLock()
	defer ims.mu.RUnlock()

	points := ims.factionPoints[factionId]
	missions := make([]IntelMissionSnapshot, 0, len(AllIntelMissionDefs))

	for _, def := range AllIntelMissionDefs {
		missions = append(missions, IntelMissionSnapshot{
			Type:        def.Type,
			Name:        def.Name,
			NameKo:      def.NameKo,
			Description: def.Description,
			Cost:        def.Cost,
			Available:   points >= def.Cost,
		})
	}

	return missions
}

// IntelPointsSnapshot returns intel points snapshot for a faction.
type IntelPointsSnapshot struct {
	FactionId string `json:"factionId"`
	Points    int    `json:"points"`
}

// GetPointsSnapshot returns the intel points for a faction.
func (ims *IntelMissionSystem) GetPointsSnapshot(factionId string) IntelPointsSnapshot {
	ims.mu.RLock()
	defer ims.mu.RUnlock()

	return IntelPointsSnapshot{
		FactionId: factionId,
		Points:    ims.factionPoints[factionId],
	}
}

// Reset clears all intel data (called at season reset).
func (ims *IntelMissionSystem) Reset() {
	ims.mu.Lock()
	defer ims.mu.Unlock()

	ims.factionPoints = make(map[string]int)
	ims.results = make(map[string][]*IntelResult)
}
