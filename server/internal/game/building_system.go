package game

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 9 — BuildingSystem: 지역 건설 시스템
//
// 지배 팩션이 지역에 건물을 건설할 수 있다 (자원 소비).
// 건물 종류:
//   - DefenseTower:       방어탑 — 적 진입 시 자동 공격
//   - ResourceAccelerator: 자원 가속기 — 자원 채취 속도 +30%
//   - HealingStation:     치유소 — 주변 아군 HP 재생 +2/s
//   - ScoutPost:          정찰소 — 미니맵에 적 위치 표시 (반경 확장)
//
// 건물 슬롯 (주권 레벨별):
//   Active Domination = 2 슬롯
//   Sovereignty       = 3 슬롯
//   Hegemony          = 5 슬롯
//
// 건물 파괴:
//   - BR 페이즈에서 적 팩션이 공격하여 HP 0으로 파괴 가능
//   - 주권 변경 시 모든 건물 비활성화 (새 지배 팩션이 인수 가능)
//
// TerritoryEngine과 연동하여 주권 변경 시 건물 인수/비활성화 처리.
// ============================================================

// ── 건물 유형 ──

// BuildingType classifies the type of region building.
type BuildingType string

const (
	BuildDefenseTower       BuildingType = "defense_tower"
	BuildResourceAccelerator BuildingType = "resource_accelerator"
	BuildHealingStation     BuildingType = "healing_station"
	BuildScoutPost          BuildingType = "scout_post"
)

// ── 건물 슬롯 상수 ──

const (
	// BuildingSlotsActiveDom은 Active Domination 레벨의 건물 슬롯 수
	BuildingSlotsActiveDom = 2
	// BuildingSlotsSovereignty는 Sovereignty 레벨의 건물 슬롯 수
	BuildingSlotsSovereignty = 3
	// BuildingSlotsHegemony는 Hegemony 레벨의 건물 슬롯 수
	BuildingSlotsHegemony = 5

	// BuildingActivationCostRatio는 비활성 건물 인수 시 원래 비용 대비 비율 (50%)
	BuildingActivationCostRatio = 0.5
)

// ── 건물 정의 ──

// BuildingDef defines the template for a building type.
type BuildingDef struct {
	Type        BuildingType   `json:"type"`
	Name        string         `json:"name"`
	NameKo      string         `json:"nameKo"`
	Description string         `json:"description"`
	Icon        string         `json:"icon"`
	MaxHP       int            `json:"maxHp"`
	Cost        ResourceBundle `json:"cost"`       // 건설 비용
	Effect      BuildingEffect `json:"effect"`     // 건물 효과
	BuildTime   float64        `json:"buildTime"`  // 건설 시간 (초, 실시간)
}

// BuildingEffect defines the gameplay effect of a building.
type BuildingEffect struct {
	// DefenseTower: 자동 공격 데미지
	AttackDamage int     `json:"attackDamage,omitempty"`
	// DefenseTower: 공격 사거리 (px)
	AttackRange  float64 `json:"attackRange,omitempty"`
	// DefenseTower: 공격 쿨다운 (초)
	AttackCD     float64 `json:"attackCd,omitempty"`

	// ResourceAccelerator: 채취 속도 배율 보너스
	GatherRateBonus float64 `json:"gatherRateBonus,omitempty"`

	// HealingStation: 초당 HP 재생량
	HealPerSec float64 `json:"healPerSec,omitempty"`
	// HealingStation: 효과 범위 (px)
	HealRange  float64 `json:"healRange,omitempty"`

	// ScoutPost: 미니맵 적 감지 범위 추가 (px)
	ScoutRange float64 `json:"scoutRange,omitempty"`
}

// AllBuildingDefs contains all available building definitions.
var AllBuildingDefs = map[BuildingType]BuildingDef{
	BuildDefenseTower: {
		Type:        BuildDefenseTower,
		Name:        "Defense Tower",
		NameKo:      "방어탑",
		Description: "Auto-attacks enemies within range during BR",
		Icon:        "tower",
		MaxHP:       500,
		Cost:        ResourceBundle{Minerals: 100, Tech: 50},
		Effect: BuildingEffect{
			AttackDamage: 15,
			AttackRange:  200.0,
			AttackCD:     2.0,
		},
		BuildTime: 30.0,
	},
	BuildResourceAccelerator: {
		Type:        BuildResourceAccelerator,
		Name:        "Resource Accelerator",
		NameKo:      "자원 가속기",
		Description: "Increases resource gather rate by 30%",
		Icon:        "accelerator",
		MaxHP:       300,
		Cost:        ResourceBundle{Minerals: 80, Gold: 60},
		Effect: BuildingEffect{
			GatherRateBonus: 0.30,
		},
		BuildTime: 20.0,
	},
	BuildHealingStation: {
		Type:        BuildHealingStation,
		Name:        "Healing Station",
		NameKo:      "치유소",
		Description: "Heals nearby allies for 2 HP/s",
		Icon:        "heal",
		MaxHP:       250,
		Cost:        ResourceBundle{Food: 80, Influence: 30},
		Effect: BuildingEffect{
			HealPerSec: 2.0,
			HealRange:  150.0,
		},
		BuildTime: 25.0,
	},
	BuildScoutPost: {
		Type:        BuildScoutPost,
		Name:        "Scout Post",
		NameKo:      "정찰소",
		Description: "Reveals enemy positions on minimap within extended range",
		Icon:        "scout",
		MaxHP:       200,
		Cost:        ResourceBundle{Gold: 50, Tech: 40},
		Effect: BuildingEffect{
			ScoutRange: 300.0,
		},
		BuildTime: 15.0,
	},
}

// GetBuildingDef returns the building definition for a given type.
func GetBuildingDef(bt BuildingType) *BuildingDef {
	if def, ok := AllBuildingDefs[bt]; ok {
		return &def
	}
	return nil
}

// ── 건물 인스턴스 (런타임) ──

// BuildingInstance represents an active building in a region.
type BuildingInstance struct {
	Id           string          `json:"id"`
	Type         BuildingType    `json:"type"`
	RegionId     string          `json:"regionId"`
	OwnerFaction string          `json:"ownerFaction"`
	FactionColor string          `json:"factionColor"`
	Position     domain.Position `json:"position"`
	HP           int             `json:"hp"`
	MaxHP        int             `json:"maxHp"`
	Active       bool            `json:"active"`
	Building     bool            `json:"building"`     // 건설 중 여부
	BuildTimer   float64         `json:"buildTimer"`   // 건설 남은 시간 (초)
	AttackTimer  float64         `json:"-"`            // 방어탑 공격 쿨다운
	OriginalCost ResourceBundle  `json:"originalCost"` // 원래 비용 (인수 비용 계산용)
}

// IsOperational returns true if the building is active and not under construction.
func (bi *BuildingInstance) IsOperational() bool {
	return bi.Active && !bi.Building && bi.HP > 0
}

// TakeDamage applies damage to the building. Returns true if destroyed.
func (bi *BuildingInstance) TakeDamage(dmg int) bool {
	bi.HP -= dmg
	if bi.HP <= 0 {
		bi.HP = 0
		bi.Active = false
		return true
	}
	return false
}

// ── BuildingSystem ──

// BuildingSystem manages region buildings for all regions.
type BuildingSystem struct {
	mu sync.RWMutex

	// 지역별 건물 목록: regionId → []BuildingInstance
	buildings map[string][]*BuildingInstance

	// 이벤트 버퍼
	events []BuildingEvent

	// 카운터
	nextId int
}

// BuildingEventType classifies building-related events.
type BuildingEventType string

const (
	BuildEvtConstructStart BuildingEventType = "build_start"
	BuildEvtConstructDone  BuildingEventType = "build_done"
	BuildEvtDamaged        BuildingEventType = "build_damaged"
	BuildEvtDestroyed      BuildingEventType = "build_destroyed"
	BuildEvtDeactivated    BuildingEventType = "build_deactivated"
	BuildEvtActivated      BuildingEventType = "build_activated"
)

// BuildingEvent represents a building lifecycle event.
type BuildingEvent struct {
	Type     BuildingEventType `json:"type"`
	Building *BuildingInstance `json:"building"`
	RegionId string           `json:"regionId"`
}

// NewBuildingSystem creates a new building system.
func NewBuildingSystem() *BuildingSystem {
	return &BuildingSystem{
		buildings: make(map[string][]*BuildingInstance),
		events:    make([]BuildingEvent, 0, 8),
		nextId:    0,
	}
}

// ── 건물 슬롯 ──

// GetBuildingSlotsForLevel returns the number of building slots
// for a given sovereignty level.
func GetBuildingSlotsForLevel(level SovereigntyLevel) int {
	switch level {
	case SovLevelHegemony:
		return BuildingSlotsHegemony
	case SovLevelSovereignty:
		return BuildingSlotsSovereignty
	case SovLevelActiveDomination:
		return BuildingSlotsActiveDom
	default:
		return 0 // None 레벨에서는 건설 불가
	}
}

// GetUsedSlots returns the number of active buildings for a faction in a region.
func (bs *BuildingSystem) GetUsedSlots(regionId, factionId string) int {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	count := 0
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.Active {
			count++
		}
	}
	return count
}

// ── 건설 ──

// CanBuild checks if a faction can build at the given region.
// Returns error message if cannot build, empty string if OK.
func (bs *BuildingSystem) CanBuild(
	regionId string,
	factionId string,
	buildingType BuildingType,
	sovLevel SovereigntyLevel,
) string {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	// 1. 건물 정의 확인
	def := GetBuildingDef(buildingType)
	if def == nil {
		return "unknown building type"
	}

	// 2. 주권 레벨 확인 (None이면 건설 불가)
	maxSlots := GetBuildingSlotsForLevel(sovLevel)
	if maxSlots == 0 {
		return "no domination — cannot build"
	}

	// 3. 슬롯 확인
	usedSlots := 0
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.Active {
			usedSlots++
		}
	}
	if usedSlots >= maxSlots {
		return fmt.Sprintf("max building slots reached (%d/%d)", usedSlots, maxSlots)
	}

	// 4. 같은 유형의 건물이 이미 있는지 확인
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.Type == buildingType && b.Active {
			return "building of this type already exists"
		}
	}

	return "" // 건설 가능
}

// StartBuild begins construction of a building in a region.
// Returns the building instance or nil if construction cannot start.
// Caller must verify resources and deduct them before calling.
func (bs *BuildingSystem) StartBuild(
	regionId string,
	factionId string,
	factionColor string,
	buildingType BuildingType,
	position domain.Position,
) *BuildingInstance {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	def := GetBuildingDef(buildingType)
	if def == nil {
		return nil
	}

	bs.nextId++
	building := &BuildingInstance{
		Id:           fmt.Sprintf("bld_%s_%d", regionId, bs.nextId),
		Type:         buildingType,
		RegionId:     regionId,
		OwnerFaction: factionId,
		FactionColor: factionColor,
		Position:     position,
		HP:           def.MaxHP,
		MaxHP:        def.MaxHP,
		Active:       true,
		Building:     true,
		BuildTimer:   def.BuildTime,
		OriginalCost: def.Cost,
	}

	bs.buildings[regionId] = append(bs.buildings[regionId], building)

	bs.events = append(bs.events, BuildingEvent{
		Type:     BuildEvtConstructStart,
		Building: building,
		RegionId: regionId,
	})

	slog.Info("building construction started",
		"regionId", regionId,
		"factionId", factionId,
		"type", buildingType,
		"buildTime", def.BuildTime,
	)

	return building
}

// ── Tick (20Hz) ──

// Tick updates building timers and effects. Called at server tick rate (20Hz).
func (bs *BuildingSystem) Tick(dt float64) {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	bs.events = bs.events[:0]

	for regionId, buildings := range bs.buildings {
		for _, b := range buildings {
			if !b.Active {
				continue
			}

			// 건설 중 건물 타이머 감소
			if b.Building {
				b.BuildTimer -= dt
				if b.BuildTimer <= 0 {
					b.Building = false
					b.BuildTimer = 0

					bs.events = append(bs.events, BuildingEvent{
						Type:     BuildEvtConstructDone,
						Building: b,
						RegionId: regionId,
					})

					slog.Info("building construction completed",
						"buildingId", b.Id,
						"type", b.Type,
						"regionId", regionId,
					)
				}
			}

			// 방어탑 공격 쿨다운 감소
			if b.Type == BuildDefenseTower && b.AttackTimer > 0 {
				b.AttackTimer -= dt
			}
		}
	}
}

// ── 건물 데미지 ──

// DamageBuilding applies damage to a specific building.
// Returns true if the building was destroyed.
func (bs *BuildingSystem) DamageBuilding(regionId, buildingId string, dmg int) bool {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	for _, b := range bs.buildings[regionId] {
		if b.Id == buildingId {
			destroyed := b.TakeDamage(dmg)

			if destroyed {
				bs.events = append(bs.events, BuildingEvent{
					Type:     BuildEvtDestroyed,
					Building: b,
					RegionId: regionId,
				})

				slog.Info("building destroyed",
					"buildingId", buildingId,
					"type", b.Type,
					"regionId", regionId,
				)
			} else {
				bs.events = append(bs.events, BuildingEvent{
					Type:     BuildEvtDamaged,
					Building: b,
					RegionId: regionId,
				})
			}

			return destroyed
		}
	}
	return false
}

// ── 주권 변경 시 건물 비활성화 ──

// OnSovereigntyChange deactivates all buildings when sovereignty changes.
// The new dominant faction can reactivate them at 50% cost.
func (bs *BuildingSystem) OnSovereigntyChange(regionId, newFactionId string) {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	buildings := bs.buildings[regionId]
	for _, b := range buildings {
		if b.OwnerFaction != newFactionId && b.Active {
			b.Active = false
			// 건설 중인 건물은 완전 제거
			if b.Building {
				b.Building = false
				b.HP = 0

				bs.events = append(bs.events, BuildingEvent{
					Type:     BuildEvtDestroyed,
					Building: b,
					RegionId: regionId,
				})

				slog.Info("building under construction destroyed on sovereignty change",
					"buildingId", b.Id,
					"regionId", regionId,
				)
			} else {
				bs.events = append(bs.events, BuildingEvent{
					Type:     BuildEvtDeactivated,
					Building: b,
					RegionId: regionId,
				})

				slog.Info("building deactivated on sovereignty change",
					"buildingId", b.Id,
					"regionId", regionId,
				)
			}
		}
	}

	// 파괴된(HP=0) 건물 제거
	activeBuildings := buildings[:0]
	for _, b := range buildings {
		if b.HP > 0 {
			activeBuildings = append(activeBuildings, b)
		}
	}
	bs.buildings[regionId] = activeBuildings
}

// ── 건물 인수 ──

// ActivateBuilding reactivates a deactivated building for the new owner.
// Returns the activation cost (ResourceBundle) or nil if not possible.
func (bs *BuildingSystem) ActivateBuilding(regionId, buildingId, factionId, factionColor string) *ResourceBundle {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	for _, b := range bs.buildings[regionId] {
		if b.Id == buildingId && !b.Active && b.HP > 0 {
			// 인수 비용 계산 (원래 비용의 50%)
			cost := ResourceBundle{
				Gold:      int(float64(b.OriginalCost.Gold) * BuildingActivationCostRatio),
				Oil:       int(float64(b.OriginalCost.Oil) * BuildingActivationCostRatio),
				Minerals:  int(float64(b.OriginalCost.Minerals) * BuildingActivationCostRatio),
				Food:      int(float64(b.OriginalCost.Food) * BuildingActivationCostRatio),
				Tech:      int(float64(b.OriginalCost.Tech) * BuildingActivationCostRatio),
				Influence: int(float64(b.OriginalCost.Influence) * BuildingActivationCostRatio),
			}

			b.Active = true
			b.OwnerFaction = factionId
			b.FactionColor = factionColor

			bs.events = append(bs.events, BuildingEvent{
				Type:     BuildEvtActivated,
				Building: b,
				RegionId: regionId,
			})

			slog.Info("building activated by new faction",
				"buildingId", buildingId,
				"factionId", factionId,
				"regionId", regionId,
			)

			return &cost
		}
	}
	return nil
}

// ── Public Getters (Thread-Safe) ──

// GetBuildings returns all buildings in a region.
func (bs *BuildingSystem) GetBuildings(regionId string) []*BuildingInstance {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	buildings := bs.buildings[regionId]
	if len(buildings) == 0 {
		return nil
	}

	result := make([]*BuildingInstance, len(buildings))
	for i, b := range buildings {
		cp := *b
		result[i] = &cp
	}
	return result
}

// GetActiveBuildings returns only active, operational buildings for a region.
func (bs *BuildingSystem) GetActiveBuildings(regionId string) []*BuildingInstance {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	var active []*BuildingInstance
	for _, b := range bs.buildings[regionId] {
		if b.IsOperational() {
			cp := *b
			active = append(active, &cp)
		}
	}
	return active
}

// GetBuildingsByFaction returns all active buildings owned by a faction in a region.
func (bs *BuildingSystem) GetBuildingsByFaction(regionId, factionId string) []*BuildingInstance {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	var result []*BuildingInstance
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.Active {
			cp := *b
			result = append(result, &cp)
		}
	}
	return result
}

// GetGatherRateBonus returns the total gather rate bonus from resource accelerators
// owned by a faction in a region.
func (bs *BuildingSystem) GetGatherRateBonus(regionId, factionId string) float64 {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	bonus := 0.0
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.IsOperational() && b.Type == BuildResourceAccelerator {
			def := GetBuildingDef(b.Type)
			if def != nil {
				bonus += def.Effect.GatherRateBonus
			}
		}
	}
	return bonus
}

// GetHealingStations returns operational healing stations for a faction in a region.
func (bs *BuildingSystem) GetHealingStations(regionId, factionId string) []*BuildingInstance {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	var stations []*BuildingInstance
	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.IsOperational() && b.Type == BuildHealingStation {
			cp := *b
			stations = append(stations, &cp)
		}
	}
	return stations
}

// HasScoutPost returns true if the faction has an operational scout post in the region.
func (bs *BuildingSystem) HasScoutPost(regionId, factionId string) bool {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.IsOperational() && b.Type == BuildScoutPost {
			return true
		}
	}
	return false
}

// GetScoutRange returns the scout range bonus if the faction has a scout post.
func (bs *BuildingSystem) GetScoutRange(regionId, factionId string) float64 {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	for _, b := range bs.buildings[regionId] {
		if b.OwnerFaction == factionId && b.IsOperational() && b.Type == BuildScoutPost {
			def := GetBuildingDef(b.Type)
			if def != nil {
				return def.Effect.ScoutRange
			}
		}
	}
	return 0
}

// ── 방어탑 공격 판정 ──

// GetDefenseTowerTargets returns defense towers that can attack at this tick.
// Returns towers that are operational with cooldown expired.
func (bs *BuildingSystem) GetDefenseTowerTargets(regionId string) []*BuildingInstance {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	var towers []*BuildingInstance
	for _, b := range bs.buildings[regionId] {
		if b.IsOperational() && b.Type == BuildDefenseTower && b.AttackTimer <= 0 {
			cp := *b
			towers = append(towers, &cp)
		}
	}
	return towers
}

// ResetTowerCooldown resets the attack cooldown for a defense tower.
func (bs *BuildingSystem) ResetTowerCooldown(regionId, buildingId string) {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	def := GetBuildingDef(BuildDefenseTower)
	if def == nil {
		return
	}

	for _, b := range bs.buildings[regionId] {
		if b.Id == buildingId {
			b.AttackTimer = def.Effect.AttackCD
			break
		}
	}
}

// ── 이벤트 플러시 ──

// FlushEvents returns and clears pending building events.
func (bs *BuildingSystem) FlushEvents() []BuildingEvent {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	if len(bs.events) == 0 {
		return nil
	}

	result := make([]BuildingEvent, len(bs.events))
	copy(result, bs.events)
	bs.events = bs.events[:0]
	return result
}

// ── 스냅샷 (클라이언트 전송용) ──

// BuildingSnapshot is the serialized form for WebSocket broadcasting.
type BuildingSnapshot struct {
	Id           string       `json:"id"`
	Type         BuildingType `json:"type"`
	OwnerFaction string       `json:"ownerFaction"`
	FactionColor string       `json:"factionColor"`
	X            float64      `json:"x"`
	Y            float64      `json:"y"`
	HP           int          `json:"hp"`
	MaxHP        int          `json:"maxHp"`
	Active       bool         `json:"active"`
	Building     bool         `json:"building"`
	BuildTimer   float64      `json:"buildTimer,omitempty"`
}

// GetSnapshot returns a snapshot of all buildings in a region for broadcasting.
func (bs *BuildingSystem) GetSnapshot(regionId string) []BuildingSnapshot {
	bs.mu.RLock()
	defer bs.mu.RUnlock()

	buildings := bs.buildings[regionId]
	if len(buildings) == 0 {
		return nil
	}

	snapshots := make([]BuildingSnapshot, 0, len(buildings))
	for _, b := range buildings {
		if b.HP <= 0 {
			continue
		}
		snapshots = append(snapshots, BuildingSnapshot{
			Id:           b.Id,
			Type:         b.Type,
			OwnerFaction: b.OwnerFaction,
			FactionColor: b.FactionColor,
			X:            b.Position.X,
			Y:            b.Position.Y,
			HP:           b.HP,
			MaxHP:        b.MaxHP,
			Active:       b.Active,
			Building:     b.Building,
			BuildTimer:   b.BuildTimer,
		})
	}
	return snapshots
}

// Reset clears all buildings (called at season reset or testing).
func (bs *BuildingSystem) Reset() {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	bs.buildings = make(map[string][]*BuildingInstance)
	bs.events = bs.events[:0]
}

// RemoveAllInRegion removes all buildings in a region.
func (bs *BuildingSystem) RemoveAllInRegion(regionId string) {
	bs.mu.Lock()
	defer bs.mu.Unlock()

	delete(bs.buildings, regionId)
}
