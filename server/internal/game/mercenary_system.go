package game

import (
	"fmt"
	"log/slog"
	"math/rand"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 8 — MercenarySystem: 용병 고용 시스템
//
// 소규모 팩션이 골드로 NPC 용병을 고용할 수 있다.
// 용병은 배틀로얄에서 같은 팩션으로 전투에 참여한다.
//
// 3단계 용병 등급:
//   - Recruit (신병): 저렴, 약한 스탯
//   - Veteran (숙련병): 중간 가격, 보통 스탯
//   - Elite (정예병): 비싼, 강한 스탯
//
// 제한 사항:
//   - 라운드당 팩션 최대 용병 수: 5체
//   - 용병은 라운드 종료 시 해제 (매 라운드 재고용 필요)
//   - Underdog 팩션은 용병 비용 30% 할인
// ============================================================

// ── 용병 등급 ──

// MercenaryTier은 용병 등급을 나타낸다.
type MercenaryTier string

const (
	MercTierRecruit MercenaryTier = "recruit" // 신병
	MercTierVeteran MercenaryTier = "veteran" // 숙련병
	MercTierElite   MercenaryTier = "elite"   // 정예병
)

// ── 용병 상수 ──

const (
	// MercMaxPerFaction은 팩션당 라운드 최대 용병 수
	MercMaxPerFaction = 5

	// ── 신병 (Recruit) 스탯 ──
	MercRecruitHP     = 100
	MercRecruitDMG    = 8
	MercRecruitSpeed  = 90.0
	MercRecruitCost   = 50 // Round Gold 기준

	// ── 숙련병 (Veteran) 스탯 ──
	MercVeteranHP     = 180
	MercVeteranDMG    = 14
	MercVeteranSpeed  = 110.0
	MercVeteranCost   = 120

	// ── 정예병 (Elite) 스탯 ──
	MercEliteHP       = 280
	MercEliteDMG      = 22
	MercEliteSpeed    = 130.0
	MercEliteCost     = 250

	// ── 공통 ──
	MercAgroRange     = 180.0 // 적 감지 범위 (px)
	MercAttackRange   = 75.0  // 공격 사거리 (px)
	MercAttackCD      = 1.2   // 공격 쿨다운 (초)

	// MercUnderdogDiscount는 Underdog 팩션의 용병 할인율 (30%)
	MercUnderdogDiscount = 0.30
)

// MercenaryTierConfig holds stat configuration for a mercenary tier.
type MercenaryTierConfig struct {
	Tier     MercenaryTier `json:"tier"`
	HP       int           `json:"hp"`
	Damage   int           `json:"damage"`
	Speed    float64       `json:"speed"`
	Cost     int           `json:"cost"` // Round Gold 비용
	NameTag  string        `json:"nameTag"`
}

// MercTierConfigs는 등급별 설정을 정의한다.
var MercTierConfigs = map[MercenaryTier]MercenaryTierConfig{
	MercTierRecruit: {
		Tier:    MercTierRecruit,
		HP:      MercRecruitHP,
		Damage:  MercRecruitDMG,
		Speed:   MercRecruitSpeed,
		Cost:    MercRecruitCost,
		NameTag: "Recruit",
	},
	MercTierVeteran: {
		Tier:    MercTierVeteran,
		HP:      MercVeteranHP,
		Damage:  MercVeteranDMG,
		Speed:   MercVeteranSpeed,
		Cost:    MercVeteranCost,
		NameTag: "Veteran",
	},
	MercTierElite: {
		Tier:    MercTierElite,
		HP:      MercEliteHP,
		Damage:  MercEliteDMG,
		Speed:   MercEliteSpeed,
		Cost:    MercEliteCost,
		NameTag: "Elite",
	},
}

// GetMercTierConfig returns the configuration for a mercenary tier.
func GetMercTierConfig(tier MercenaryTier) (MercenaryTierConfig, bool) {
	cfg, ok := MercTierConfigs[tier]
	return cfg, ok
}

// ── 용병 엔티티 ──

// MercenaryState은 용병의 현재 상태를 나타낸다.
type MercenaryState string

const (
	MercStateReady   MercenaryState = "ready"   // 배치 대기 (고용 완료, BR 대기)
	MercStateCombat  MercenaryState = "combat"  // 전투 중 (BR 페이즈)
	MercStateDead    MercenaryState = "dead"    // 사망
)

// Mercenary는 단일 용병 NPC를 나타낸다.
type Mercenary struct {
	Id           string          `json:"id"`           // "merc_KR-seoul_faction1_0"
	RegionId     string          `json:"regionId"`     // 배치된 지역 ID
	FactionId    string          `json:"factionId"`    // 소속 팩션 ID
	FactionColor string          `json:"factionColor"` // 팩션 컬러
	HirerId      string          `json:"hirerId"`      // 고용한 플레이어 ID
	Tier         MercenaryTier   `json:"tier"`         // 등급
	Position     domain.Position `json:"position"`     // 현재 위치

	// 스탯
	HP           int     `json:"hp"`
	MaxHP        int     `json:"maxHp"`
	Damage       int     `json:"damage"`
	Speed        float64 `json:"speed"`
	AgroRange    float64 `json:"agroRange"`
	AttackRange  float64 `json:"attackRange"`
	AttackCD     float64 `json:"attackCd"`

	// 상태
	State        MercenaryState `json:"state"`
	TargetId     string         `json:"targetId,omitempty"` // 현재 타겟
	AttackTimer  float64        `json:"-"`                  // 공격 쿨다운 타이머
	HireCost     int            `json:"hireCost"`           // 실제 지불 비용
}

// IsAlive는 용병이 살아있는지 확인한다.
func (m *Mercenary) IsAlive() bool {
	return m.State != MercStateDead
}

// TakeDamage는 용병에 데미지를 적용한다. 사망 시 true 반환.
func (m *Mercenary) TakeDamage(dmg int) bool {
	m.HP -= dmg
	if m.HP <= 0 {
		m.HP = 0
		m.State = MercStateDead
		m.TargetId = ""
		return true
	}
	return false
}

// ── MercenaryManager ──

// MercenaryManager manages mercenary NPCs across all regions.
type MercenaryManager struct {
	mu sync.RWMutex

	// 지역별 용병 목록: regionId → []Mercenary
	mercenaries map[string][]*Mercenary

	// 팩션별 용병 수 추적: regionId → factionId → count
	factionMercCount map[string]map[string]int

	// 설정
	enabled bool
}

// NewMercenaryManager creates a new mercenary manager.
func NewMercenaryManager() *MercenaryManager {
	return &MercenaryManager{
		mercenaries:      make(map[string][]*Mercenary),
		factionMercCount: make(map[string]map[string]int),
		enabled:          true,
	}
}

// SetEnabled enables or disables the mercenary system.
func (mm *MercenaryManager) SetEnabled(enabled bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()
	mm.enabled = enabled
}

// HireMercResult는 용병 고용 결과를 담는다.
type HireMercResult struct {
	Success   bool           `json:"success"`
	Mercenary *Mercenary     `json:"mercenary,omitempty"` // 고용된 용병
	Cost      int            `json:"cost"`                // 실제 비용
	Error     string         `json:"error,omitempty"`
}

// HireMercenary attempts to hire a mercenary for a faction in a region.
// Returns the result including actual cost (may be discounted for underdogs).
func (mm *MercenaryManager) HireMercenary(
	regionId string,
	factionId string,
	factionColor string,
	hirerId string,
	tier MercenaryTier,
	availableGold int,
	isUnderdog bool,
	arenaSize int,
) *HireMercResult {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	if !mm.enabled {
		return &HireMercResult{Success: false, Error: "mercenary system disabled"}
	}

	// 등급 설정 확인
	cfg, ok := MercTierConfigs[tier]
	if !ok {
		return &HireMercResult{Success: false, Error: "invalid mercenary tier: " + string(tier)}
	}

	// 팩션당 최대 용병 수 확인
	if mm.factionMercCount[regionId] == nil {
		mm.factionMercCount[regionId] = make(map[string]int)
	}
	currentCount := mm.factionMercCount[regionId][factionId]
	if currentCount >= MercMaxPerFaction {
		return &HireMercResult{
			Success: false,
			Error:   fmt.Sprintf("faction at max mercenary limit (%d/%d)", currentCount, MercMaxPerFaction),
		}
	}

	// 비용 계산 (Underdog 할인 적용)
	cost := cfg.Cost
	if isUnderdog {
		cost = int(float64(cost) * (1.0 - MercUnderdogDiscount))
	}

	// 골드 확인
	if availableGold < cost {
		return &HireMercResult{
			Success: false,
			Cost:    cost,
			Error:   fmt.Sprintf("insufficient gold: need %d, have %d", cost, availableGold),
		}
	}

	// 용병 생성
	mercIdx := len(mm.mercenaries[regionId])
	merc := mm.createMercenary(regionId, factionId, factionColor, hirerId, tier, cfg, mercIdx, arenaSize, cost)

	mm.mercenaries[regionId] = append(mm.mercenaries[regionId], merc)
	mm.factionMercCount[regionId][factionId]++

	slog.Info("mercenary: hired",
		"regionId", regionId,
		"factionId", factionId,
		"hirerId", hirerId,
		"tier", string(tier),
		"cost", cost,
		"isUnderdog", isUnderdog,
		"factionMercCount", mm.factionMercCount[regionId][factionId],
	)

	return &HireMercResult{
		Success:   true,
		Mercenary: merc,
		Cost:      cost,
	}
}

// createMercenary creates a new mercenary NPC.
func (mm *MercenaryManager) createMercenary(
	regionId, factionId, factionColor, hirerId string,
	tier MercenaryTier,
	cfg MercenaryTierConfig,
	index, arenaSize, cost int,
) *Mercenary {
	// 랜덤 스폰 위치 (아레나 중심 부근)
	halfSize := float64(arenaSize) / 2.0
	spawnX := halfSize + (rand.Float64()-0.5)*halfSize*0.4
	spawnY := halfSize + (rand.Float64()-0.5)*halfSize*0.4

	return &Mercenary{
		Id:           fmt.Sprintf("merc_%s_%s_%d", regionId, factionId, index),
		RegionId:     regionId,
		FactionId:    factionId,
		FactionColor: factionColor,
		HirerId:      hirerId,
		Tier:         tier,
		Position:     domain.Position{X: spawnX, Y: spawnY},
		HP:           cfg.HP,
		MaxHP:        cfg.HP,
		Damage:       cfg.Damage,
		Speed:        cfg.Speed,
		AgroRange:    MercAgroRange,
		AttackRange:  MercAttackRange,
		AttackCD:     MercAttackCD,
		State:        MercStateReady,
		HireCost:     cost,
	}
}

// ActivateForBR transitions all mercenaries in a region to combat mode.
func (mm *MercenaryManager) ActivateForBR(regionId string) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	mercs := mm.mercenaries[regionId]
	for _, merc := range mercs {
		if merc.State == MercStateReady {
			merc.State = MercStateCombat
			merc.TargetId = ""
			merc.AttackTimer = 0
		}
	}

	slog.Debug("mercenary: activated for BR",
		"regionId", regionId,
		"mercCount", len(mercs),
	)
}

// ClearRegionMercenaries removes all mercenaries from a region.
// Called at round end (settlement phase).
func (mm *MercenaryManager) ClearRegionMercenaries(regionId string) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	delete(mm.mercenaries, regionId)
	delete(mm.factionMercCount, regionId)

	slog.Debug("mercenary: cleared region",
		"regionId", regionId,
	)
}

// GetMercenaries returns all mercenaries in a region (snapshot).
func (mm *MercenaryManager) GetMercenaries(regionId string) []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	mercs := mm.mercenaries[regionId]
	if len(mercs) == 0 {
		return nil
	}

	result := make([]*Mercenary, len(mercs))
	for i, m := range mercs {
		cp := *m
		result[i] = &cp
	}
	return result
}

// GetAliveMercenaries returns only alive mercenaries for a region.
func (mm *MercenaryManager) GetAliveMercenaries(regionId string) []*Mercenary {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	mercs := mm.mercenaries[regionId]
	if len(mercs) == 0 {
		return nil
	}

	var alive []*Mercenary
	for _, m := range mercs {
		if m.IsAlive() {
			cp := *m
			alive = append(alive, &cp)
		}
	}
	return alive
}

// GetFactionMercCount returns the number of mercenaries a faction has in a region.
func (mm *MercenaryManager) GetFactionMercCount(regionId, factionId string) int {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	if mm.factionMercCount[regionId] == nil {
		return 0
	}
	return mm.factionMercCount[regionId][factionId]
}

// DamageMercenary applies damage to a specific mercenary. Returns true if dead.
func (mm *MercenaryManager) DamageMercenary(regionId, mercId string, dmg int) bool {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	mercs := mm.mercenaries[regionId]
	for _, merc := range mercs {
		if merc.Id == mercId {
			return merc.TakeDamage(dmg)
		}
	}
	return false
}

// TickMercenaries updates mercenary state for the given region.
// Should be called each server tick during BR phase.
func (mm *MercenaryManager) TickMercenaries(regionId string, delta float64) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	mercs := mm.mercenaries[regionId]
	for _, merc := range mercs {
		if merc.State == MercStateCombat && merc.AttackTimer > 0 {
			merc.AttackTimer -= delta
		}
	}
}

// GetMercenarySnapshot returns serializable mercenary data for a region.
func (mm *MercenaryManager) GetMercenarySnapshot(regionId string) []MercenarySnapshot {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	mercs := mm.mercenaries[regionId]
	if len(mercs) == 0 {
		return nil
	}

	snapshots := make([]MercenarySnapshot, 0, len(mercs))
	for _, m := range mercs {
		snapshots = append(snapshots, MercenarySnapshot{
			Id:           m.Id,
			FactionId:    m.FactionId,
			FactionColor: m.FactionColor,
			Tier:         string(m.Tier),
			X:            m.Position.X,
			Y:            m.Position.Y,
			HP:           m.HP,
			MaxHP:        m.MaxHP,
			State:        string(m.State),
			TargetId:     m.TargetId,
		})
	}
	return snapshots
}

// MercenarySnapshot is the serialized form for WebSocket broadcasting.
type MercenarySnapshot struct {
	Id           string  `json:"id"`
	FactionId    string  `json:"factionId"`
	FactionColor string  `json:"factionColor"`
	Tier         string  `json:"tier"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	HP           int     `json:"hp"`
	MaxHP        int     `json:"maxHp"`
	State        string  `json:"state"`
	TargetId     string  `json:"targetId,omitempty"`
}

// GetMercCostForTier returns the cost for a mercenary tier,
// optionally applying the underdog discount.
func GetMercCostForTier(tier MercenaryTier, isUnderdog bool) int {
	cfg, ok := MercTierConfigs[tier]
	if !ok {
		return 0
	}
	cost := cfg.Cost
	if isUnderdog {
		cost = int(float64(cost) * (1.0 - MercUnderdogDiscount))
	}
	return cost
}

// GetAvailableMercTiers returns all available mercenary tiers with costs.
func GetAvailableMercTiers(isUnderdog bool) []MercenaryTierInfo {
	tiers := []MercenaryTier{MercTierRecruit, MercTierVeteran, MercTierElite}
	result := make([]MercenaryTierInfo, 0, len(tiers))
	for _, tier := range tiers {
		cfg := MercTierConfigs[tier]
		cost := cfg.Cost
		if isUnderdog {
			cost = int(float64(cost) * (1.0 - MercUnderdogDiscount))
		}
		result = append(result, MercenaryTierInfo{
			Tier:         string(tier),
			Name:         cfg.NameTag,
			HP:           cfg.HP,
			Damage:       cfg.Damage,
			Speed:        cfg.Speed,
			Cost:         cost,
			OriginalCost: cfg.Cost,
			Discounted:   isUnderdog,
		})
	}
	return result
}

// MercenaryTierInfo is sent to the client for UI display.
type MercenaryTierInfo struct {
	Tier         string  `json:"tier"`
	Name         string  `json:"name"`
	HP           int     `json:"hp"`
	Damage       int     `json:"damage"`
	Speed        float64 `json:"speed"`
	Cost         int     `json:"cost"`
	OriginalCost int     `json:"originalCost"`
	Discounted   bool    `json:"discounted"`
}
