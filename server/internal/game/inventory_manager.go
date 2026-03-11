package game

import (
	"fmt"
	"math"
	"math/rand"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 5 — InventoryManager: 플레이어별 자원 인벤토리 관리
//
// 각 플레이어의 자원 보관, 사망 시 드롭, 라운드 종료 시 팩션 국고 입금.
// ResourceSpawner와 연동하여 채취 완료 시 자원을 인벤토리에 추가한다.
//
// 핵심 규칙:
//   - 유형별 상한 50개
//   - PvE 사망 → 50% 드롭 (근처에 자원 오브로 떨어짐)
//   - BR 사망 → 100% 드롭
//   - 라운드 종료 → 잔여 자원 팩션 국고(Base Camp)에 자동 입금
// ============================================================

// ── 드롭 비율 상수 ──

const (
	// PvEDeathDropRatio is the fraction of resources dropped on PvE death.
	PvEDeathDropRatio = 0.5

	// BRDeathDropRatio is the fraction of resources dropped on BR death.
	BRDeathDropRatio = 1.0
)

// ── 드롭 아이템 ──

// DroppedResource represents a resource pickup dropped on the ground.
type DroppedResource struct {
	Id           string          `json:"id"`
	Position     domain.Position `json:"position"`
	ResourceType string          `json:"resourceType"`
	Amount       int             `json:"amount"`
	IsSpecialty  bool            `json:"isSpecialty"`
}

// ── InventoryManager ──

// InventoryManager manages per-player resource inventories for a region arena.
type InventoryManager struct {
	mu          sync.RWMutex
	inventories map[string]*PlayerInventory // playerID → inventory
	config      ResourceSpawnConfig         // 설정 (Capacity 참조)
}

// NewInventoryManager creates a new inventory manager.
func NewInventoryManager(config ResourceSpawnConfig) *InventoryManager {
	return &InventoryManager{
		inventories: make(map[string]*PlayerInventory),
		config:      config,
	}
}

// ── 플레이어 인벤토리 생성/조회 ──

// GetOrCreate returns the inventory for a player, creating one if needed.
func (im *InventoryManager) GetOrCreate(playerID string) *PlayerInventory {
	im.mu.Lock()
	defer im.mu.Unlock()

	inv, ok := im.inventories[playerID]
	if !ok {
		inv = NewPlayerInventory()
		inv.Capacity = im.config.MaxPerPlayer
		im.inventories[playerID] = inv
	}
	return inv
}

// Get returns the inventory for a player (nil if not found).
func (im *InventoryManager) Get(playerID string) *PlayerInventory {
	im.mu.RLock()
	defer im.mu.RUnlock()
	return im.inventories[playerID]
}

// ── 자원 추가 (채취 완료 시) ──

// AddResource adds a harvested resource to a player's inventory.
// Returns the actual amount added (capped by capacity).
func (im *InventoryManager) AddResource(playerID string, resourceType string, amount int, isSpecialty bool) int {
	inv := im.GetOrCreate(playerID)

	im.mu.Lock()
	defer im.mu.Unlock()

	return AddToInventory(inv, resourceType, amount, isSpecialty)
}

// ── 사망 시 드롭 ──

// OnPlayerDeath handles resource drop when a player dies.
// Returns the list of dropped resource pickups.
// isBR: true = BR phase (100% drop), false = PvE (50% drop).
func (im *InventoryManager) OnPlayerDeath(
	playerID string,
	deathPos domain.Position,
	isBR bool,
) []DroppedResource {
	im.mu.Lock()
	defer im.mu.Unlock()

	inv, ok := im.inventories[playerID]
	if !ok {
		return nil
	}

	dropRatio := PvEDeathDropRatio
	if isBR {
		dropRatio = BRDeathDropRatio
	}

	dropped := ApplyDeathPenalty(inv, dropRatio)
	if dropped == nil {
		return nil
	}

	var result []DroppedResource
	nextID := 0

	// 기본 자원 드롭
	basicResources := map[string]int{
		"gold":      dropped.Basic.Gold,
		"oil":       dropped.Basic.Oil,
		"minerals":  dropped.Basic.Minerals,
		"food":      dropped.Basic.Food,
		"tech":      dropped.Basic.Tech,
		"influence": dropped.Basic.Influence,
	}

	for resType, amount := range basicResources {
		if amount <= 0 {
			continue
		}

		result = append(result, DroppedResource{
			Id:           fmt.Sprintf("drop_%s_%d", playerID, nextID),
			Position:     randomDropPosition(deathPos),
			ResourceType: resType,
			Amount:       amount,
			IsSpecialty:  false,
		})
		nextID++
	}

	// 특산 자원 드롭
	for resType, amount := range dropped.Specialty {
		if amount <= 0 {
			continue
		}

		result = append(result, DroppedResource{
			Id:           fmt.Sprintf("drop_%s_%d", playerID, nextID),
			Position:     randomDropPosition(deathPos),
			ResourceType: resType,
			Amount:       amount,
			IsSpecialty:  true,
		})
		nextID++
	}

	return result
}

// ── 라운드 종료 시 팩션 국고 입금 ──

// CollectAllForTreasury collects all player inventories at round end.
// Returns a map of playerID → deposited inventory.
func (im *InventoryManager) CollectAllForTreasury() map[string]*PlayerInventory {
	im.mu.Lock()
	defer im.mu.Unlock()

	deposits := make(map[string]*PlayerInventory)

	for playerID, inv := range im.inventories {
		deposited := DepositToFactionTreasury(inv)
		if deposited != nil {
			deposits[playerID] = deposited
		}
	}

	return deposits
}

// CollectForTreasury collects a single player's inventory for treasury deposit.
func (im *InventoryManager) CollectForTreasury(playerID string) *PlayerInventory {
	im.mu.Lock()
	defer im.mu.Unlock()

	inv, ok := im.inventories[playerID]
	if !ok {
		return nil
	}

	return DepositToFactionTreasury(inv)
}

// ── 인벤토리 스냅샷 (브로드캐스트용) ──

// GetSnapshot returns a copy of a player's inventory for serialization.
func (im *InventoryManager) GetSnapshot(playerID string) *PlayerInventory {
	im.mu.RLock()
	defer im.mu.RUnlock()

	inv, ok := im.inventories[playerID]
	if !ok {
		return nil
	}

	snapshot := &PlayerInventory{
		Basic:    inv.Basic,
		Specialty: make(map[string]int),
		Capacity: inv.Capacity,
	}
	for k, v := range inv.Specialty {
		snapshot.Specialty[k] = v
	}
	return snapshot
}

// ── 플레이어 제거 ──

// RemovePlayer removes a player's inventory (on disconnect).
func (im *InventoryManager) RemovePlayer(playerID string) {
	im.mu.Lock()
	defer im.mu.Unlock()
	delete(im.inventories, playerID)
}

// ── 리셋 ──

// Reset clears all inventories (between rounds).
func (im *InventoryManager) Reset() {
	im.mu.Lock()
	defer im.mu.Unlock()
	im.inventories = make(map[string]*PlayerInventory)
}

// ── 통계 ──

// PlayerCount returns the number of players with inventories.
func (im *InventoryManager) PlayerCount() int {
	im.mu.RLock()
	defer im.mu.RUnlock()
	return len(im.inventories)
}

// TotalResources returns the total resources across all players.
func (im *InventoryManager) TotalResources() int {
	im.mu.RLock()
	defer im.mu.RUnlock()

	total := 0
	for _, inv := range im.inventories {
		total += inv.Basic.Gold + inv.Basic.Oil + inv.Basic.Minerals +
			inv.Basic.Food + inv.Basic.Tech + inv.Basic.Influence
		for _, v := range inv.Specialty {
			total += v
		}
	}
	return total
}

// ── 헬퍼 ──

// randomDropPosition creates a position scattered around the death position.
func randomDropPosition(center domain.Position) domain.Position {
	angle := rand.Float64() * 2 * math.Pi
	dist := rand.Float64() * 30
	return domain.Position{
		X: center.X + math.Cos(angle)*dist,
		Y: center.Y + math.Sin(angle)*dist,
	}
}
