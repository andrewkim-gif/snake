package game

import (
	"fmt"
	"math"
	"math/rand"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 5 — ResourceSpawner: 국가별 고유 자원 스폰/채취 관리
//
// 맵 내 자원 노드를 배치하고, 재생/고갈/채취를 관리한다.
// PvE 페이즈에서만 채취 가능하며, BR 중에는 채취 불가.
//
// 자원 노드 타입: minerals, energy, data, biotech, rare_earth, cultural, military
// 지역별 고유 자원 70% + 공통 자원 30% 비율로 배치.
//
// OrbManager 패턴을 따르되, 자원 노드는 고정 위치 + 재스폰 로직.
// ============================================================

// ── 자원 노드 상태 ──

// NodeState represents the lifecycle state of a resource node.
type NodeState string

const (
	NodeActive     NodeState = "active"     // 채취 가능
	NodeDepleted   NodeState = "depleted"   // 고갈 (재스폰 대기)
	NodeExhausted  NodeState = "exhausted"  // 영구 소멸 (최대 채취 횟수 초과)
	NodeGathering  NodeState = "gathering"  // 누군가 채취 중
)

// ── 채취 세션 ──

// GatherSession tracks an active gathering operation by a player.
type GatherSession struct {
	PlayerID    string  // 채취 중인 플레이어 ID
	NodeID      string  // 채취 대상 노드 ID
	Progress    float64 // 채취 진행도 (0.0 ~ 1.0)
	Duration    float64 // 총 채취 시간 (초, 기본 3.0)
	Elapsed     float64 // 경과 시간 (초)
	Completed   bool    // 채취 완료 여부
	Cancelled   bool    // 채취 취소 여부
}

// ── 자원 노드 확장 (region_types.go의 ResourceNode 필드 추가) ──

// SpawnableNode extends ResourceNode with spawner-specific fields.
type SpawnableNode struct {
	ResourceNode                       // 기본 노드 데이터 (region_types.go)
	State          NodeState           // 노드 상태
	DepletedTimer  float64             // 고갈 후 재스폰 타이머 (초)
	HarvestCount   int                 // 총 채취 횟수
	MaxHarvests    int                 // 최대 채취 횟수 (이후 영구 소멸)
	GathererID     string              // 현재 채취 중인 플레이어 ID (비어있으면 없음)
	RegionType     RegionType          // 소속 지역 유형 (밀도 계산용)
}

// ── ResourceSpawner ──

// ResourceSpawner manages resource node spawning, harvesting, and lifecycle
// for a single region arena.
type ResourceSpawner struct {
	mu sync.RWMutex

	regionId      string              // 지역 ID (예: "KOR_seoul")
	countryCode   string              // 국가 코드 (예: "KOR")
	specialtyType string              // 국가별 특산 자원 (예: "semiconductor")
	regionType    RegionType          // 지역 유형 (capital, resource 등)
	arenaSize     int                 // 아레나 크기 (px)

	nodes         map[string]*SpawnableNode // nodeId → 노드
	nextNodeID    int                       // 다음 노드 ID

	config        ResourceSpawnConfig       // 스폰 설정
	gatherRate    float64                   // 지역 효과 채취 속도 배율

	// 채취 세션 관리
	gatherSessions map[string]*GatherSession // playerID → 세션

	// 이벤트 콜백
	onHarvestComplete func(playerID string, resourceType string, amount int, isSpecialty bool)
	onNodeDepleted    func(nodeId string)
	onNodeRespawned   func(node *SpawnableNode)
}

// ResourceSpawnerConfig holds initialization parameters for the spawner.
type ResourceSpawnerConfig struct {
	RegionId      string
	CountryCode   string
	SpecialtyType string
	RegionType    RegionType
	ArenaSize     int
	GatherRate    float64             // 지역 효과 채취 속도 배율 (1.0 기본)
	SpawnConfig   ResourceSpawnConfig
}

// NewResourceSpawner creates a new ResourceSpawner for a region.
func NewResourceSpawner(cfg ResourceSpawnerConfig) *ResourceSpawner {
	if cfg.SpawnConfig.BasicNodes == 0 {
		cfg.SpawnConfig = DefaultResourceSpawnConfig()
	}
	if cfg.GatherRate <= 0 {
		cfg.GatherRate = 1.0
	}

	rs := &ResourceSpawner{
		regionId:       cfg.RegionId,
		countryCode:    cfg.CountryCode,
		specialtyType:  cfg.SpecialtyType,
		regionType:     cfg.RegionType,
		arenaSize:      cfg.ArenaSize,
		nodes:          make(map[string]*SpawnableNode),
		nextNodeID:     1,
		config:         cfg.SpawnConfig,
		gatherRate:     cfg.GatherRate,
		gatherSessions: make(map[string]*GatherSession),
	}

	return rs
}

// ── 노드 ID 생성 ──

func (rs *ResourceSpawner) generateNodeID() string {
	id := fmt.Sprintf("res_%s_%d", rs.regionId, rs.nextNodeID)
	rs.nextNodeID++
	return id
}

// ── 초기 스폰 ──

// SpawnInitialNodes places all resource nodes on the map at round start.
// Applies the 70% specialty / 30% common distribution rule.
func (rs *ResourceSpawner) SpawnInitialNodes() {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// 기존 노드 클리어
	rs.nodes = make(map[string]*SpawnableNode)
	rs.nextNodeID = 1

	totalNodes := rs.config.BasicNodes + rs.config.SpecialtyNodes

	// 지역 유형별 밀도 계수 적용
	densityMult := rs.getRegionDensityMultiplier()
	adjustedTotal := int(float64(totalNodes) * densityMult)
	if adjustedTotal < 5 {
		adjustedTotal = 5
	}

	// 70% 특산 자원, 30% 공통 자원
	specialtyCount := int(float64(adjustedTotal) * 0.7)
	commonCount := adjustedTotal - specialtyCount

	// 특산 자원 노드 스폰
	for i := 0; i < specialtyCount; i++ {
		rs.spawnNode(rs.specialtyType, true)
	}

	// 공통 자원 노드 스폰 (6종 기본 자원에서 랜덤 선택)
	basicTypes := []string{"minerals", "tech", "food", "oil", "gold", "influence"}
	for i := 0; i < commonCount; i++ {
		resType := basicTypes[rand.Intn(len(basicTypes))]
		rs.spawnNode(resType, false)
	}
}

// spawnNode creates and places a single resource node. Must be called with lock held.
func (rs *ResourceSpawner) spawnNode(resourceType string, isSpecialty bool) *SpawnableNode {
	pos := rs.randomPosition()

	amount := 3 // 기본 채취량
	if isSpecialty {
		amount = 5 // 특산 자원은 더 많은 채취량
	}

	maxHarvests := 8 // 기본 최대 채취 횟수
	if isSpecialty {
		maxHarvests = 12 // 특산 자원은 더 오래 유지
	}

	node := &SpawnableNode{
		ResourceNode: ResourceNode{
			Id:           rs.generateNodeID(),
			Position:     pos,
			ResourceType: resourceType,
			Amount:       amount,
			MaxAmount:    amount,
			RespawnTimer: 0,
			IsSpecialty:  isSpecialty,
			GatherTime:   rs.config.GatherDuration,
		},
		State:        NodeActive,
		DepletedTimer: 0,
		HarvestCount:  0,
		MaxHarvests:   maxHarvests,
		RegionType:    rs.regionType,
	}

	rs.nodes[node.Id] = node
	return node
}

// randomPosition generates a random position within the arena bounds.
func (rs *ResourceSpawner) randomPosition() domain.Position {
	padding := 200.0 // 경계 패딩
	size := float64(rs.arenaSize)
	return domain.Position{
		X: padding + rand.Float64()*(size-2*padding),
		Y: padding + rand.Float64()*(size-2*padding),
	}
}

// getRegionDensityMultiplier returns the resource density multiplier based on region type.
// 자원지역=높음(1.5), 산업=보통(1.2), 수도=낮음(0.7), 기타=1.0
func (rs *ResourceSpawner) getRegionDensityMultiplier() float64 {
	switch rs.regionType {
	case RegionResource:
		return 1.5
	case RegionIndustrial:
		return 1.2
	case RegionPort:
		return 1.1
	case RegionAgricultural:
		return 1.0
	case RegionMilitary:
		return 0.9
	case RegionCultural:
		return 0.8
	case RegionCapital:
		return 0.7
	default:
		return 1.0
	}
}

// ── 틱 업데이트 ──

// Tick updates all resource nodes: respawn timers, gather sessions, etc.
// Called at server tick rate (20Hz). pvpEnabled=true means BR phase (채취 불가).
func (rs *ResourceSpawner) Tick(dt float64, pvpEnabled bool) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// BR 중 모든 채취 세션 취소
	if pvpEnabled {
		for pid, sess := range rs.gatherSessions {
			sess.Cancelled = true
			// 노드 상태 복원
			if n, ok := rs.nodes[sess.NodeID]; ok && n.GathererID == pid {
				n.GathererID = ""
				if n.State == NodeGathering {
					n.State = NodeActive
				}
			}
			delete(rs.gatherSessions, pid)
		}
		return
	}

	// 고갈 노드 재스폰 타이머 업데이트
	for id, node := range rs.nodes {
		if node.State == NodeDepleted {
			node.DepletedTimer -= dt
			if node.DepletedTimer <= 0 {
				// 재스폰: 양 복원, 상태 리셋
				node.Amount = node.MaxAmount
				node.State = NodeActive
				node.DepletedTimer = 0
				if rs.onNodeRespawned != nil {
					rs.onNodeRespawned(node)
				}
			}
		}

		// 영구 소멸 노드는 새 위치에 재스폰
		if node.State == NodeExhausted {
			delete(rs.nodes, id)
			rs.spawnNode(node.ResourceType, node.IsSpecialty)
		}
	}

	// 채취 세션 진행
	for pid, sess := range rs.gatherSessions {
		if sess.Completed || sess.Cancelled {
			delete(rs.gatherSessions, pid)
			continue
		}

		sess.Elapsed += dt
		sess.Progress = sess.Elapsed / sess.Duration

		if sess.Progress >= 1.0 {
			sess.Progress = 1.0
			sess.Completed = true
			rs.completeHarvest(pid, sess)
		}
	}
}

// ── 채취 시작 ──

// StartGather begins a resource gathering operation for a player.
// Returns nil if gathering cannot start (wrong phase, too far, already gathering, etc.)
func (rs *ResourceSpawner) StartGather(playerID string, playerPos domain.Position, pvpEnabled bool) *GatherSession {
	if pvpEnabled {
		return nil // BR 중 채취 불가
	}

	rs.mu.Lock()
	defer rs.mu.Unlock()

	// 이미 채취 중이면 불가
	if _, exists := rs.gatherSessions[playerID]; exists {
		return nil
	}

	// 가장 가까운 활성 노드 찾기 (60px 이내)
	var closest *SpawnableNode
	minDist := math.MaxFloat64
	gatherRange := 60.0

	for _, node := range rs.nodes {
		if node.State != NodeActive {
			continue
		}
		if node.GathererID != "" {
			continue // 누군가 이미 채취 중
		}

		dx := playerPos.X - node.Position.X
		dy := playerPos.Y - node.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)

		if dist <= gatherRange && dist < minDist {
			minDist = dist
			closest = node
		}
	}

	if closest == nil {
		return nil
	}

	// 채취 세션 생성
	duration := closest.GatherTime / rs.gatherRate // 지역 효과 적용
	if duration < 1.0 {
		duration = 1.0
	}

	sess := &GatherSession{
		PlayerID:  playerID,
		NodeID:    closest.Id,
		Progress:  0,
		Duration:  duration,
		Elapsed:   0,
		Completed: false,
		Cancelled: false,
	}

	closest.GathererID = playerID
	closest.State = NodeGathering
	rs.gatherSessions[playerID] = sess

	return sess
}

// ── 자동 채취 체크 ──

// CheckAutoGather checks if a player is within gathering range of an active node.
// Returns the nearest node ID if auto-gather should trigger, or empty string.
func (rs *ResourceSpawner) CheckAutoGather(playerID string, playerPos domain.Position) string {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	// 이미 채취 중이면 스킵
	if _, exists := rs.gatherSessions[playerID]; exists {
		return ""
	}

	gatherRange := 60.0
	var closestID string
	minDist := math.MaxFloat64

	for _, node := range rs.nodes {
		if node.State != NodeActive || node.GathererID != "" {
			continue
		}

		dx := playerPos.X - node.Position.X
		dy := playerPos.Y - node.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)

		if dist <= gatherRange && dist < minDist {
			minDist = dist
			closestID = node.Id
		}
	}

	return closestID
}

// ── 채취 완료 ──

// completeHarvest finalizes a gather session. Must be called with lock held.
func (rs *ResourceSpawner) completeHarvest(playerID string, sess *GatherSession) {
	node, ok := rs.nodes[sess.NodeID]
	if !ok {
		return
	}

	// 채취량 결정
	harvestAmount := 1
	if node.Amount > 0 {
		node.Amount--
	}
	node.HarvestCount++
	node.GathererID = ""

	// 고갈 체크
	if node.Amount <= 0 {
		if node.HarvestCount >= node.MaxHarvests {
			// 영구 소멸 → 새 위치에 스폰 (다음 Tick에서 처리)
			node.State = NodeExhausted
		} else {
			// 일시 고갈 → 쿨다운 후 재스폰
			node.State = NodeDepleted
			node.DepletedTimer = rs.config.RespawnInterval
		}
	} else {
		node.State = NodeActive
	}

	// 콜백 호출
	if rs.onHarvestComplete != nil {
		rs.onHarvestComplete(playerID, node.ResourceType, harvestAmount, node.IsSpecialty)
	}
}

// ── 채취 취소 (피격 캔슬) ──

// CancelGather cancels an active gather session (e.g., player took damage).
func (rs *ResourceSpawner) CancelGather(playerID string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	sess, exists := rs.gatherSessions[playerID]
	if !exists {
		return
	}

	sess.Cancelled = true

	// 노드 상태 복원
	if node, ok := rs.nodes[sess.NodeID]; ok {
		node.GathererID = ""
		if node.State == NodeGathering {
			node.State = NodeActive
		}
	}

	delete(rs.gatherSessions, playerID)
}

// ── 사망 시 자원 드롭 ──

// DropResourceOrbs creates resource pickup orbs when a player dies.
// dropRatio: 0.5 = 50% (PvE 사망), 1.0 = 100% (BR 사망)
func (rs *ResourceSpawner) DropResourceOrbs(pos domain.Position, inv *PlayerInventory, dropRatio float64) []*SpawnableNode {
	if inv == nil {
		return nil
	}

	rs.mu.Lock()
	defer rs.mu.Unlock()

	var dropped []*SpawnableNode

	// 기본 자원 드롭
	basicResources := map[string]int{
		"gold":      inv.Basic.Gold,
		"oil":       inv.Basic.Oil,
		"minerals":  inv.Basic.Minerals,
		"food":      inv.Basic.Food,
		"tech":      inv.Basic.Tech,
		"influence": inv.Basic.Influence,
	}

	for resType, amount := range basicResources {
		dropAmount := int(float64(amount) * dropRatio)
		if dropAmount <= 0 {
			continue
		}

		// 드롭된 자원을 노드로 생성 (채취 시간 짧게, 즉시 회수 가능)
		angle := rand.Float64() * 2 * math.Pi
		dist := rand.Float64() * 30
		dropPos := domain.Position{
			X: pos.X + math.Cos(angle)*dist,
			Y: pos.Y + math.Sin(angle)*dist,
		}

		node := &SpawnableNode{
			ResourceNode: ResourceNode{
				Id:           rs.generateNodeID(),
				Position:     dropPos,
				ResourceType: resType,
				Amount:       dropAmount,
				MaxAmount:    dropAmount,
				RespawnTimer: 0,
				IsSpecialty:  false,
				GatherTime:   0.5, // 드롭 자원은 즉시 회수 (0.5초)
			},
			State:       NodeActive,
			MaxHarvests: 1, // 1회 회수 후 소멸
			RegionType:  rs.regionType,
		}

		rs.nodes[node.Id] = node
		dropped = append(dropped, node)
	}

	// 특산 자원 드롭
	for resType, amount := range inv.Specialty {
		dropAmount := int(float64(amount) * dropRatio)
		if dropAmount <= 0 {
			continue
		}

		angle := rand.Float64() * 2 * math.Pi
		dist := rand.Float64() * 30
		dropPos := domain.Position{
			X: pos.X + math.Cos(angle)*dist,
			Y: pos.Y + math.Sin(angle)*dist,
		}

		node := &SpawnableNode{
			ResourceNode: ResourceNode{
				Id:           rs.generateNodeID(),
				Position:     dropPos,
				ResourceType: resType,
				Amount:       dropAmount,
				MaxAmount:    dropAmount,
				RespawnTimer: 0,
				IsSpecialty:  true,
				GatherTime:   0.5,
			},
			State:       NodeActive,
			MaxHarvests: 1,
			RegionType:  rs.regionType,
		}

		rs.nodes[node.Id] = node
		dropped = append(dropped, node)
	}

	return dropped
}

// ── 인벤토리 관리 ──

// AddToInventory adds a harvested resource to the player's inventory.
// Returns the actual amount added (capped by capacity).
func AddToInventory(inv *PlayerInventory, resourceType string, amount int, isSpecialty bool) int {
	if inv == nil {
		return 0
	}

	if isSpecialty {
		current := inv.Specialty[resourceType]
		space := inv.Capacity - current
		if space <= 0 {
			return 0
		}
		actual := amount
		if actual > space {
			actual = space
		}
		inv.Specialty[resourceType] = current + actual
		return actual
	}

	// 기본 6종 자원
	var current *int
	switch resourceType {
	case "gold":
		current = &inv.Basic.Gold
	case "oil":
		current = &inv.Basic.Oil
	case "minerals":
		current = &inv.Basic.Minerals
	case "food":
		current = &inv.Basic.Food
	case "tech":
		current = &inv.Basic.Tech
	case "influence":
		current = &inv.Basic.Influence
	default:
		// 알 수 없는 타입은 특산 자원으로 처리
		curSpec := inv.Specialty[resourceType]
		space := inv.Capacity - curSpec
		if space <= 0 {
			return 0
		}
		actual := amount
		if actual > space {
			actual = space
		}
		inv.Specialty[resourceType] = curSpec + actual
		return actual
	}

	space := inv.Capacity - *current
	if space <= 0 {
		return 0
	}
	actual := amount
	if actual > space {
		actual = space
	}
	*current += actual
	return actual
}

// ApplyDeathPenalty removes a fraction of the inventory (PvE: 50%, BR: 100%).
// Returns the removed inventory for drop creation.
func ApplyDeathPenalty(inv *PlayerInventory, dropRatio float64) *PlayerInventory {
	if inv == nil {
		return nil
	}

	dropped := NewPlayerInventory()

	// 기본 자원
	dropped.Basic.Gold = int(float64(inv.Basic.Gold) * dropRatio)
	inv.Basic.Gold -= dropped.Basic.Gold

	dropped.Basic.Oil = int(float64(inv.Basic.Oil) * dropRatio)
	inv.Basic.Oil -= dropped.Basic.Oil

	dropped.Basic.Minerals = int(float64(inv.Basic.Minerals) * dropRatio)
	inv.Basic.Minerals -= dropped.Basic.Minerals

	dropped.Basic.Food = int(float64(inv.Basic.Food) * dropRatio)
	inv.Basic.Food -= dropped.Basic.Food

	dropped.Basic.Tech = int(float64(inv.Basic.Tech) * dropRatio)
	inv.Basic.Tech -= dropped.Basic.Tech

	dropped.Basic.Influence = int(float64(inv.Basic.Influence) * dropRatio)
	inv.Basic.Influence -= dropped.Basic.Influence

	// 특산 자원
	for resType, amount := range inv.Specialty {
		dropAmount := int(float64(amount) * dropRatio)
		if dropAmount > 0 {
			dropped.Specialty[resType] = dropAmount
			inv.Specialty[resType] -= dropAmount
		}
	}

	return dropped
}

// DepositToFactionTreasury transfers all remaining inventory to faction treasury.
// Called at round end — returns the deposited inventory.
func DepositToFactionTreasury(inv *PlayerInventory) *PlayerInventory {
	if inv == nil {
		return nil
	}

	deposited := &PlayerInventory{
		Basic:    inv.Basic,
		Specialty: make(map[string]int),
		Capacity: inv.Capacity,
	}

	for k, v := range inv.Specialty {
		deposited.Specialty[k] = v
	}

	// 인벤토리 초기화
	inv.Basic = ResourceBundle{}
	inv.Specialty = make(map[string]int)

	return deposited
}

// ── 쿼리 메서드 ──

// GetNodes returns a snapshot of all active resource nodes (for state broadcast).
func (rs *ResourceSpawner) GetNodes() []ResourceNode {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	result := make([]ResourceNode, 0, len(rs.nodes))
	for _, node := range rs.nodes {
		if node.State == NodeExhausted {
			continue
		}
		rn := node.ResourceNode
		result = append(result, rn)
	}
	return result
}

// GetGatherSession returns the active gather session for a player.
func (rs *ResourceSpawner) GetGatherSession(playerID string) *GatherSession {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	if sess, ok := rs.gatherSessions[playerID]; ok {
		return &GatherSession{
			PlayerID:  sess.PlayerID,
			NodeID:    sess.NodeID,
			Progress:  sess.Progress,
			Duration:  sess.Duration,
			Elapsed:   sess.Elapsed,
			Completed: sess.Completed,
			Cancelled: sess.Cancelled,
		}
	}
	return nil
}

// GetNodeCount returns the number of active, non-exhausted nodes.
func (rs *ResourceSpawner) GetNodeCount() int {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	count := 0
	for _, n := range rs.nodes {
		if n.State != NodeExhausted {
			count++
		}
	}
	return count
}

// SetOnHarvestComplete sets the callback for harvest completion.
func (rs *ResourceSpawner) SetOnHarvestComplete(fn func(playerID string, resourceType string, amount int, isSpecialty bool)) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.onHarvestComplete = fn
}

// SetOnNodeDepleted sets the callback for node depletion.
func (rs *ResourceSpawner) SetOnNodeDepleted(fn func(nodeId string)) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.onNodeDepleted = fn
}

// SetOnNodeRespawned sets the callback for node respawn.
func (rs *ResourceSpawner) SetOnNodeRespawned(fn func(node *SpawnableNode)) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.onNodeRespawned = fn
}

// Reset clears all nodes and sessions (called between rounds).
func (rs *ResourceSpawner) Reset() {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	rs.nodes = make(map[string]*SpawnableNode)
	rs.gatherSessions = make(map[string]*GatherSession)
	rs.nextNodeID = 1
}
