package game

import (
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 8 — GarrisonSystem: NPC 수비대 시스템
//
// 지배 중인 지역에 NPC 수비대를 자동 배치한다.
// 배틀로얄 시 수비대도 같은 팩션으로 참전한다.
// 주권 레벨에 따라 NPC 강도가 증가한다:
//   - Active Domination: 3체
//   - Sovereignty: 5체
//   - Hegemony: 8체
//
// 수비대는 서버 권위 엔티티로, 클라이언트는 렌더링만 수행한다.
// ============================================================

// ── 수비대 상수 ──

const (
	// GarrisonCountActive는 Active Domination 레벨의 수비대 수
	GarrisonCountActive = 3
	// GarrisonCountSovereignty는 Sovereignty 레벨의 수비대 수
	GarrisonCountSovereignty = 5
	// GarrisonCountHegemony는 Hegemony 레벨의 수비대 수
	GarrisonCountHegemony = 8

	// GarrisonBaseHP는 수비대 기본 HP
	GarrisonBaseHP = 150
	// GarrisonBaseDMG는 수비대 기본 공격력
	GarrisonBaseDMG = 12
	// GarrisonBaseSpeed는 수비대 기본 이동 속도 (px/s)
	GarrisonBaseSpeed = 100.0
	// GarrisonAgroRange는 수비대 적 감지 범위 (px)
	GarrisonAgroRange = 200.0
	// GarrisonAttackRange는 수비대 공격 사거리 (px)
	GarrisonAttackRange = 80.0
	// GarrisonAttackCooldown는 수비대 공격 쿨다운 (초)
	GarrisonAttackCooldown = 1.5
	// GarrisonRespawnDelay는 수비대 리스폰 딜레이 (초)
	GarrisonRespawnDelay = 60.0

	// ── 주권 레벨별 수비대 스탯 배율 ──

	// GarrisonActiveMult는 Active Domination 스탯 배율
	GarrisonActiveMult = 1.0
	// GarrisonSovereigntyMult는 Sovereignty 스탯 배율
	GarrisonSovereigntyMult = 1.3
	// GarrisonHegemonyMult는 Hegemony 스탯 배율
	GarrisonHegemonyMult = 1.6
)

// ── NPC 수비대 엔티티 ──

// NPCGuardState은 NPC 수비대의 현재 상태를 나타낸다.
type NPCGuardState string

const (
	GuardStateIdle      NPCGuardState = "idle"       // 대기 중 (PvE 페이즈)
	GuardStatePatrol    NPCGuardState = "patrol"      // 순찰 중
	GuardStateCombat    NPCGuardState = "combat"      // 전투 중 (BR 페이즈)
	GuardStateDead      NPCGuardState = "dead"        // 사망 (리스폰 대기)
	GuardStateRespawning NPCGuardState = "respawning" // 리스폰 중
)

// NPCGuard는 단일 NPC 수비대 유닛을 나타낸다.
type NPCGuard struct {
	Id           string         `json:"id"`           // "garrison_KR-seoul_1"
	RegionId     string         `json:"regionId"`     // 배치된 지역 ID
	FactionId    string         `json:"factionId"`    // 소속 팩션 ID
	FactionColor string         `json:"factionColor"` // 팩션 컬러
	Position     domain.Position `json:"position"`     // 현재 위치
	SpawnPoint   domain.Position `json:"spawnPoint"`   // 스폰 위치 (리스폰 시 복귀)

	// 스탯
	HP           int     `json:"hp"`
	MaxHP        int     `json:"maxHp"`
	Damage       int     `json:"damage"`
	Speed        float64 `json:"speed"`
	AgroRange    float64 `json:"agroRange"`
	AttackRange  float64 `json:"attackRange"`
	AttackCD     float64 `json:"attackCd"`

	// 상태
	State        NPCGuardState `json:"state"`
	TargetId     string        `json:"targetId,omitempty"` // 현재 타겟 플레이어 ID
	AttackTimer  float64       `json:"-"`                  // 공격 쿨다운 타이머
	RespawnTimer float64       `json:"-"`                  // 리스폰 타이머
	StatMult     float64       `json:"-"`                  // 주권 레벨 스탯 배율
}

// IsAlive는 수비대가 살아있는지 확인한다.
func (g *NPCGuard) IsAlive() bool {
	return g.State != GuardStateDead && g.State != GuardStateRespawning
}

// TakeDamage는 수비대에 데미지를 적용한다. 사망 시 true 반환.
func (g *NPCGuard) TakeDamage(dmg int) bool {
	g.HP -= dmg
	if g.HP <= 0 {
		g.HP = 0
		g.State = GuardStateDead
		g.RespawnTimer = GarrisonRespawnDelay
		g.TargetId = ""
		return true
	}
	return false
}

// ── GarrisonManager ──

// GarrisonManager manages NPC garrison units across all regions.
type GarrisonManager struct {
	mu sync.RWMutex

	// 지역별 수비대 목록: regionId → []NPCGuard
	garrisons map[string][]*NPCGuard

	// 설정
	enabled bool
}

// NewGarrisonManager creates a new garrison manager.
func NewGarrisonManager() *GarrisonManager {
	return &GarrisonManager{
		garrisons: make(map[string][]*NPCGuard),
		enabled:   true,
	}
}

// SetEnabled enables or disables the garrison system.
func (gm *GarrisonManager) SetEnabled(enabled bool) {
	gm.mu.Lock()
	defer gm.mu.Unlock()
	gm.enabled = enabled
}

// GetGarrisonCountForLevel returns the number of garrison guards
// for a given sovereignty level.
func GetGarrisonCountForLevel(level SovereigntyLevel) int {
	switch level {
	case SovLevelHegemony:
		return GarrisonCountHegemony
	case SovLevelSovereignty:
		return GarrisonCountSovereignty
	case SovLevelActiveDomination:
		return GarrisonCountActive
	default:
		return 0 // None 레벨에서는 수비대 없음
	}
}

// getStatMultForLevel returns the stat multiplier for a sovereignty level.
func getStatMultForLevel(level SovereigntyLevel) float64 {
	switch level {
	case SovLevelHegemony:
		return GarrisonHegemonyMult
	case SovLevelSovereignty:
		return GarrisonSovereigntyMult
	case SovLevelActiveDomination:
		return GarrisonActiveMult
	default:
		return 1.0
	}
}

// DeployGarrison deploys or updates garrison units for a region based on
// the controlling faction and sovereignty level.
// 주권 레벨이 변경되면 수비대 수를 조정한다.
func (gm *GarrisonManager) DeployGarrison(
	regionId string,
	factionId string,
	factionColor string,
	level SovereigntyLevel,
	arenaSize int,
) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	if !gm.enabled {
		return
	}

	targetCount := GetGarrisonCountForLevel(level)
	statMult := getStatMultForLevel(level)

	if targetCount == 0 || factionId == "" {
		// 수비대 제거
		delete(gm.garrisons, regionId)
		slog.Debug("garrison: removed garrison",
			"regionId", regionId,
		)
		return
	}

	existing := gm.garrisons[regionId]

	// 팩션이 변경되었으면 전체 교체
	if len(existing) > 0 && existing[0].FactionId != factionId {
		existing = nil
	}

	// 수량 조정
	if len(existing) < targetCount {
		// 추가 배치
		for i := len(existing); i < targetCount; i++ {
			guard := gm.createGuard(regionId, factionId, factionColor, i, arenaSize, statMult)
			existing = append(existing, guard)
		}
	} else if len(existing) > targetCount {
		// 초과분 제거
		existing = existing[:targetCount]
	}

	// 스탯 배율 업데이트 (주권 레벨 변경 시)
	for _, guard := range existing {
		guard.FactionId = factionId
		guard.FactionColor = factionColor
		guard.StatMult = statMult
		guard.MaxHP = int(float64(GarrisonBaseHP) * statMult)
		guard.Damage = int(float64(GarrisonBaseDMG) * statMult)
		guard.Speed = GarrisonBaseSpeed * statMult
		// HP는 최대치 이하로 유지
		if guard.HP > guard.MaxHP {
			guard.HP = guard.MaxHP
		}
	}

	gm.garrisons[regionId] = existing

	slog.Info("garrison: deployed/updated garrison",
		"regionId", regionId,
		"factionId", factionId,
		"level", string(level),
		"count", len(existing),
		"statMult", statMult,
	)
}

// createGuard creates a new garrison guard unit.
func (gm *GarrisonManager) createGuard(
	regionId, factionId, factionColor string,
	index, arenaSize int,
	statMult float64,
) *NPCGuard {
	// 스폰 위치: 아레나 중심 주변에 분산 배치
	halfSize := float64(arenaSize) / 2.0
	spawnRadius := halfSize * 0.3 // 중심에서 30% 반경 내
	angle := float64(index) * (2.0 * math.Pi / 8.0) // 8등분 원형 배치
	spawnX := halfSize + spawnRadius*math.Cos(angle)
	spawnY := halfSize + spawnRadius*math.Sin(angle)

	hp := int(float64(GarrisonBaseHP) * statMult)
	dmg := int(float64(GarrisonBaseDMG) * statMult)
	speed := GarrisonBaseSpeed * statMult

	return &NPCGuard{
		Id:           fmt.Sprintf("garrison_%s_%d", regionId, index),
		RegionId:     regionId,
		FactionId:    factionId,
		FactionColor: factionColor,
		Position:     domain.Position{X: spawnX, Y: spawnY},
		SpawnPoint:   domain.Position{X: spawnX, Y: spawnY},
		HP:           hp,
		MaxHP:        hp,
		Damage:       dmg,
		Speed:        speed,
		AgroRange:    GarrisonAgroRange,
		AttackRange:  GarrisonAttackRange,
		AttackCD:     GarrisonAttackCooldown,
		State:        GuardStateIdle,
		StatMult:     statMult,
	}
}

// RemoveGarrison removes all garrison units from a region.
func (gm *GarrisonManager) RemoveGarrison(regionId string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()
	delete(gm.garrisons, regionId)
}

// GetGarrison returns the garrison units for a region (snapshot).
func (gm *GarrisonManager) GetGarrison(regionId string) []*NPCGuard {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	guards := gm.garrisons[regionId]
	if len(guards) == 0 {
		return nil
	}

	result := make([]*NPCGuard, len(guards))
	for i, g := range guards {
		cp := *g
		result[i] = &cp
	}
	return result
}

// GetAliveGuards returns only alive garrison units for a region.
func (gm *GarrisonManager) GetAliveGuards(regionId string) []*NPCGuard {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	guards := gm.garrisons[regionId]
	if len(guards) == 0 {
		return nil
	}

	var alive []*NPCGuard
	for _, g := range guards {
		if g.IsAlive() {
			cp := *g
			alive = append(alive, &cp)
		}
	}
	return alive
}

// GetAliveGuardCount returns the number of alive guards in a region.
func (gm *GarrisonManager) GetAliveGuardCount(regionId string) int {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	count := 0
	for _, g := range gm.garrisons[regionId] {
		if g.IsAlive() {
			count++
		}
	}
	return count
}

// ActivateForBR transitions all garrison guards in a region to combat mode
// at the start of Battle Royale phase.
func (gm *GarrisonManager) ActivateForBR(regionId string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	guards := gm.garrisons[regionId]
	for _, guard := range guards {
		if guard.IsAlive() {
			guard.State = GuardStateCombat
			guard.TargetId = ""
			guard.AttackTimer = 0
		}
	}

	slog.Debug("garrison: activated for BR",
		"regionId", regionId,
		"guards", len(guards),
	)
}

// DeactivateForPvE transitions all garrison guards back to idle mode
// at the start of PvE phase. Respawns dead guards.
func (gm *GarrisonManager) DeactivateForPvE(regionId string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	guards := gm.garrisons[regionId]
	for _, guard := range guards {
		guard.State = GuardStateIdle
		guard.TargetId = ""
		guard.AttackTimer = 0
		// 사망한 수비대 부활
		if guard.HP <= 0 {
			guard.HP = guard.MaxHP
			guard.Position = guard.SpawnPoint
			guard.RespawnTimer = 0
		}
	}
}

// DamageGuard applies damage to a specific guard. Returns true if the guard died.
func (gm *GarrisonManager) DamageGuard(regionId, guardId string, dmg int) bool {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	guards := gm.garrisons[regionId]
	for _, guard := range guards {
		if guard.Id == guardId {
			return guard.TakeDamage(dmg)
		}
	}
	return false
}

// TickGarrison updates garrison state for the given region.
// Should be called each server tick during BR phase.
func (gm *GarrisonManager) TickGarrison(regionId string, delta float64) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	guards := gm.garrisons[regionId]
	for _, guard := range guards {
		switch guard.State {
		case GuardStateDead:
			guard.RespawnTimer -= delta
			if guard.RespawnTimer <= 0 {
				guard.State = GuardStateRespawning
			}
		case GuardStateRespawning:
			guard.HP = guard.MaxHP
			guard.Position = guard.SpawnPoint
			guard.State = GuardStateCombat
			guard.TargetId = ""
			guard.RespawnTimer = 0
		case GuardStateCombat:
			if guard.AttackTimer > 0 {
				guard.AttackTimer -= delta
			}
		}
	}
}

// GetGarrisonSnapshot returns serializable garrison data for a region.
func (gm *GarrisonManager) GetGarrisonSnapshot(regionId string) []GarrisonSnapshot {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	guards := gm.garrisons[regionId]
	if len(guards) == 0 {
		return nil
	}

	snapshots := make([]GarrisonSnapshot, 0, len(guards))
	for _, g := range guards {
		snapshots = append(snapshots, GarrisonSnapshot{
			Id:           g.Id,
			FactionId:    g.FactionId,
			FactionColor: g.FactionColor,
			X:            g.Position.X,
			Y:            g.Position.Y,
			HP:           g.HP,
			MaxHP:        g.MaxHP,
			State:        string(g.State),
			TargetId:     g.TargetId,
		})
	}
	return snapshots
}

// GarrisonSnapshot is the serialized form for WebSocket broadcasting.
type GarrisonSnapshot struct {
	Id           string  `json:"id"`
	FactionId    string  `json:"factionId"`
	FactionColor string  `json:"factionColor"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	HP           int     `json:"hp"`
	MaxHP        int     `json:"maxHp"`
	State        string  `json:"state"`
	TargetId     string  `json:"targetId,omitempty"`
}

// ── Underdog NPC 지원 ──

// DeployUnderdogSupport deploys NPC support units for underdog factions.
// Called when a small faction needs NPC assistance (from CalculateUnderdogBoost).
func (gm *GarrisonManager) DeployUnderdogSupport(
	regionId string,
	factionId string,
	factionColor string,
	npcCount int,
	arenaSize int,
) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	if !gm.enabled || npcCount <= 0 {
		return
	}

	// Underdog 지원 NPC는 기본 스탯 (배율 1.0)
	for i := 0; i < npcCount; i++ {
		guard := &NPCGuard{
			Id:           fmt.Sprintf("underdog_%s_%s_%d", regionId, factionId, i),
			RegionId:     regionId,
			FactionId:    factionId,
			FactionColor: factionColor,
			HP:           GarrisonBaseHP,
			MaxHP:        GarrisonBaseHP,
			Damage:       GarrisonBaseDMG,
			Speed:        GarrisonBaseSpeed,
			AgroRange:    GarrisonAgroRange,
			AttackRange:  GarrisonAttackRange,
			AttackCD:     GarrisonAttackCooldown,
			State:        GuardStateCombat,
			StatMult:     1.0,
		}

		// 랜덤 스폰 위치
		halfSize := float64(arenaSize) / 2.0
		guard.Position = domain.Position{
			X: halfSize + (rand.Float64()-0.5)*halfSize*0.5,
			Y: halfSize + (rand.Float64()-0.5)*halfSize*0.5,
		}
		guard.SpawnPoint = guard.Position

		gm.garrisons[regionId] = append(gm.garrisons[regionId], guard)
	}

	slog.Info("garrison: deployed underdog support",
		"regionId", regionId,
		"factionId", factionId,
		"count", npcCount,
	)
}
