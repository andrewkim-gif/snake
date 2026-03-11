package game

import (
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
)

// ============================================================
// v39 Phase 9 — RoundEventEngine: 라운드 랜덤 이벤트 시스템
//
// 매 라운드마다 1~2개의 랜덤 이벤트를 발동한다.
// 이벤트 종류:
//   - ResourceSurge:  자원 노드 2배 (PvE 중)
//   - FastShrink:     세이프존 빠른 수축 (BR 중)
//   - NPCRage:        NPC 수비대 강화 (BR 중)
//   - BonusAirdrop:   보너스 에어드롭 5개 투하 (BR 중)
//   - FogOfWar:       안개 전쟁 — 미니맵 비활성 + 시야 50% (BR 중)
//   - TradeOpen:      무역 개방 — 자원 교역 수수료 0% (PvE 중)
//
// 이벤트 라이프사이클:
//   Pending(예고 30초 전) → Announced(30초 예고) → Active(지속) → Expired
//
// RoundEngine 콜백을 통해 페이즈 전환 시 이벤트를 발동/해제한다.
// ============================================================

// ── 이벤트 종류 ──

// RoundEventKind classifies the type of round event.
type RoundEventKind string

const (
	EventResourceSurge RoundEventKind = "resource_surge"  // 자원 2배
	EventFastShrink    RoundEventKind = "fast_shrink"     // 세이프존 빠른 수축
	EventNPCRage       RoundEventKind = "npc_rage"        // NPC 강화
	EventBonusAirdrop  RoundEventKind = "bonus_airdrop"   // 보너스 에어드롭
	EventFogOfWar      RoundEventKind = "fog_of_war"      // 안개 전쟁
	EventTradeOpen     RoundEventKind = "trade_open"      // 무역 개방
)

// ── 이벤트 페이즈 ──

// RoundEventPhase represents the lifecycle phase of a round event.
type RoundEventPhase string

const (
	EventPhasePending   RoundEventPhase = "pending"   // 이벤트 예정 (아직 예고 안 됨)
	EventPhaseAnnounced RoundEventPhase = "announced" // 30초 예고 중
	EventPhaseActive    RoundEventPhase = "active"    // 발동 중
	EventPhaseExpired   RoundEventPhase = "expired"   // 종료됨
)

// ── 이벤트 적용 대상 페이즈 ──

// RoundEventTarget indicates which round phase the event applies to.
type RoundEventTarget string

const (
	EventTargetPvE RoundEventTarget = "pve" // PvE 페이즈에서 발동
	EventTargetBR  RoundEventTarget = "br"  // BR 페이즈에서 발동
)

// ── 이벤트 상수 ──

const (
	// EventAnnounceDuration은 이벤트 예고 시간 (초)
	EventAnnounceDuration = 30.0

	// EventMinPerRound는 라운드당 최소 이벤트 수
	EventMinPerRound = 1
	// EventMaxPerRound는 라운드당 최대 이벤트 수
	EventMaxPerRound = 2

	// ── 개별 이벤트 설정 ──

	// ResourceSurge: 자원 노드 스폰 배율
	ResourceSurgeMultiplier = 2.0
	// ResourceSurge: 지속 시간 (전체 PvE 페이즈)
	ResourceSurgeDuration = 600.0

	// FastShrink: 세이프존 수축 가속 배율
	FastShrinkSpeedMult = 1.5
	// FastShrink: 지속 시간 (전체 BR 페이즈)
	FastShrinkDuration = 300.0

	// NPCRage: NPC 데미지/HP 강화 배율
	NPCRageStatMult = 1.5
	// NPCRage: 지속 시간 (전체 BR 페이즈)
	NPCRageDuration = 300.0

	// BonusAirdrop: 추가 에어드롭 수
	BonusAirdropCount = 5
	// BonusAirdrop: 지속 시간 (발동 즉시)
	BonusAirdropDuration = 10.0

	// FogOfWar: 시야 축소 비율
	FogOfWarVisionMult = 0.5
	// FogOfWar: 지속 시간 (전체 BR 페이즈)
	FogOfWarDuration = 300.0

	// TradeOpen: 교역 수수료 할인
	TradeOpenDiscount = 1.0 // 100% 할인 = 수수료 0%
	// TradeOpen: 지속 시간 (전체 PvE 페이즈)
	TradeOpenDuration = 600.0
)

// ── 이벤트 정의 ──

// RoundEventDef defines a round event template.
type RoundEventDef struct {
	Kind        RoundEventKind   `json:"kind"`
	Name        string           `json:"name"`
	NameKo      string           `json:"nameKo"`
	Description string           `json:"description"`
	Icon        string           `json:"icon"`
	Target      RoundEventTarget `json:"target"`   // pve or br
	Weight      int              `json:"weight"`    // 스폰 가중치
	Duration    float64          `json:"duration"`  // 효과 지속 시간 (초)
	Value       float64          `json:"value"`     // 배율/수량 등
}

// AllRoundEventDefs contains all available round event definitions.
var AllRoundEventDefs = []RoundEventDef{
	{
		Kind:        EventResourceSurge,
		Name:        "Resource Surge",
		NameKo:      "자원 폭등",
		Description: "Resource nodes spawn at 2x rate",
		Icon:        "surge",
		Target:      EventTargetPvE,
		Weight:      25,
		Duration:    ResourceSurgeDuration,
		Value:       ResourceSurgeMultiplier,
	},
	{
		Kind:        EventFastShrink,
		Name:        "Fast Shrink",
		NameKo:      "빠른 수축",
		Description: "Safe zone shrinks 50% faster",
		Icon:        "shrink",
		Target:      EventTargetBR,
		Weight:      15,
		Duration:    FastShrinkDuration,
		Value:       FastShrinkSpeedMult,
	},
	{
		Kind:        EventNPCRage,
		Name:        "NPC Rage",
		NameKo:      "NPC 광폭화",
		Description: "Garrison NPCs gain +50% stats",
		Icon:        "rage",
		Target:      EventTargetBR,
		Weight:      15,
		Duration:    NPCRageDuration,
		Value:       NPCRageStatMult,
	},
	{
		Kind:        EventBonusAirdrop,
		Name:        "Bonus Airdrop",
		NameKo:      "보너스 에어드롭",
		Description: "5 bonus airdrops deploy immediately",
		Icon:        "airdrop",
		Target:      EventTargetBR,
		Weight:      20,
		Duration:    BonusAirdropDuration,
		Value:       float64(BonusAirdropCount),
	},
	{
		Kind:        EventFogOfWar,
		Name:        "Fog of War",
		NameKo:      "안개 전쟁",
		Description: "Minimap disabled, vision reduced 50%",
		Icon:        "fog",
		Target:      EventTargetBR,
		Weight:      15,
		Duration:    FogOfWarDuration,
		Value:       FogOfWarVisionMult,
	},
	{
		Kind:        EventTradeOpen,
		Name:        "Trade Open",
		NameKo:      "무역 개방",
		Description: "Trade fees reduced to 0%",
		Icon:        "trade",
		Target:      EventTargetPvE,
		Weight:      10,
		Duration:    TradeOpenDuration,
		Value:       TradeOpenDiscount,
	},
}

// ── 라운드 이벤트 인스턴스 ──

// RoundEventInstance represents an active round event instance.
type RoundEventInstance struct {
	Id             string          `json:"id"`
	Def            RoundEventDef   `json:"def"`
	Phase          RoundEventPhase `json:"phase"`
	AnnounceTimer  float64         `json:"announceTimer"`  // 예고 남은 시간 (초)
	ActiveTimer    float64         `json:"activeTimer"`    // 활성 남은 시간 (초)
	ActivatedAt    float64         `json:"activatedAt"`    // 발동 시점 (라운드 경과 초)
	RoundNumber    int             `json:"roundNumber"`
}

// IsActive returns true if the event is currently active.
func (e *RoundEventInstance) IsActive() bool {
	return e.Phase == EventPhaseActive
}

// IsAnnounced returns true if the event is being announced.
func (e *RoundEventInstance) IsAnnounced() bool {
	return e.Phase == EventPhaseAnnounced
}

// ── 이벤트 엔진 콜백 ──

// RoundEventCallbacks holds optional callbacks for event lifecycle.
type RoundEventCallbacks struct {
	// OnEventAnnounced is called when an event is announced (30s before activation).
	OnEventAnnounced func(event *RoundEventInstance)
	// OnEventActivated is called when an event becomes active.
	OnEventActivated func(event *RoundEventInstance)
	// OnEventExpired is called when an event expires.
	OnEventExpired func(event *RoundEventInstance)
}

// ── RoundEventEngine ──

// RoundEventEngine manages random events within rounds.
// It selects 1-2 events per round and manages their lifecycle:
// announce → activate → expire.
type RoundEventEngine struct {
	mu sync.RWMutex

	// 현재 라운드의 활성 이벤트 목록
	events []*RoundEventInstance

	// 콜백
	callbacks RoundEventCallbacks

	// 설정
	enabled     bool
	totalWeight int

	// 이벤트 버퍼 (브로드캐스트용)
	pendingNotifications []RoundEventNotification

	// 카운터
	nextId int
}

// RoundEventNotification is a broadcast-ready event notification.
type RoundEventNotification struct {
	Type  string              `json:"type"` // "announced" | "activated" | "expired"
	Event *RoundEventInstance `json:"event"`
}

// NewRoundEventEngine creates a new round event engine.
func NewRoundEventEngine() *RoundEventEngine {
	totalWeight := 0
	for _, def := range AllRoundEventDefs {
		totalWeight += def.Weight
	}

	return &RoundEventEngine{
		events:               make([]*RoundEventInstance, 0, 4),
		enabled:              true,
		totalWeight:          totalWeight,
		pendingNotifications: make([]RoundEventNotification, 0, 8),
		nextId:               0,
	}
}

// SetCallbacks sets event lifecycle callbacks.
func (ree *RoundEventEngine) SetCallbacks(cb RoundEventCallbacks) {
	ree.mu.Lock()
	defer ree.mu.Unlock()
	ree.callbacks = cb
}

// SetEnabled enables or disables the event engine.
func (ree *RoundEventEngine) SetEnabled(enabled bool) {
	ree.mu.Lock()
	defer ree.mu.Unlock()
	ree.enabled = enabled
}

// ── 라운드 시작 시 이벤트 선택 ──

// OnRoundStart selects 1-2 random events for the new round.
// Should be called when RoundEngine starts a new round.
func (ree *RoundEventEngine) OnRoundStart(roundNumber int) {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	if !ree.enabled {
		return
	}

	// 기존 이벤트 클리어
	ree.events = ree.events[:0]
	ree.pendingNotifications = ree.pendingNotifications[:0]

	// 1~2개 이벤트 선택
	count := EventMinPerRound + rand.Intn(EventMaxPerRound-EventMinPerRound+1)

	// 중복 방지를 위한 선택된 종류 추적
	selected := make(map[RoundEventKind]bool)

	for i := 0; i < count; i++ {
		def := ree.pickRandomEvent(selected)
		if def == nil {
			break // 더 이상 선택할 이벤트 없음
		}

		selected[def.Kind] = true
		ree.nextId++

		event := &RoundEventInstance{
			Id:            fmt.Sprintf("revt_%d_%d", roundNumber, ree.nextId),
			Def:           *def,
			Phase:         EventPhasePending,
			AnnounceTimer: EventAnnounceDuration,
			ActiveTimer:   def.Duration,
			RoundNumber:   roundNumber,
		}

		ree.events = append(ree.events, event)

		slog.Info("round event selected",
			"round", roundNumber,
			"event", def.Kind,
			"target", def.Target,
		)
	}
}

// pickRandomEvent selects a random event definition, excluding already-selected kinds.
// Must be called with lock held.
func (ree *RoundEventEngine) pickRandomEvent(exclude map[RoundEventKind]bool) *RoundEventDef {
	// 사용 가능한 이벤트의 총 가중치 계산
	availableWeight := 0
	for _, def := range AllRoundEventDefs {
		if !exclude[def.Kind] {
			availableWeight += def.Weight
		}
	}
	if availableWeight == 0 {
		return nil
	}

	r := rand.Intn(availableWeight)
	cumulative := 0
	for i := range AllRoundEventDefs {
		if exclude[AllRoundEventDefs[i].Kind] {
			continue
		}
		cumulative += AllRoundEventDefs[i].Weight
		if r < cumulative {
			return &AllRoundEventDefs[i]
		}
	}

	return nil
}

// ── 페이즈 전환 시 이벤트 발동 ──

// OnPhaseChange is called when the round phase changes.
// PvE events are announced immediately at round start and activated after 30s.
// BR events are announced at BR start and activated after 30s.
func (ree *RoundEventEngine) OnPhaseChange(phase RoundPhase, roundElapsedSec float64) {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	if !ree.enabled {
		return
	}

	for _, event := range ree.events {
		if event.Phase != EventPhasePending {
			continue
		}

		target := event.Def.Target
		shouldAnnounce := false

		switch {
		case target == EventTargetPvE && phase == PhasePvE:
			// PvE 이벤트: PvE 시작 시 예고
			shouldAnnounce = true
		case target == EventTargetBR && phase == PhaseBR:
			// BR 이벤트: BR 시작 시 예고
			shouldAnnounce = true
		}

		if shouldAnnounce {
			event.Phase = EventPhaseAnnounced
			event.AnnounceTimer = EventAnnounceDuration

			ree.pendingNotifications = append(ree.pendingNotifications, RoundEventNotification{
				Type:  "announced",
				Event: event,
			})

			if ree.callbacks.OnEventAnnounced != nil {
				ree.callbacks.OnEventAnnounced(event)
			}

			slog.Info("round event announced",
				"event", event.Def.Kind,
				"roundElapsed", roundElapsedSec,
			)
		}
	}
}

// ── Tick (20Hz) ──

// Tick updates the event engine. Called at server tick rate (20Hz).
func (ree *RoundEventEngine) Tick(dt float64) {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	if !ree.enabled {
		return
	}

	ree.pendingNotifications = ree.pendingNotifications[:0]

	for _, event := range ree.events {
		switch event.Phase {
		case EventPhaseAnnounced:
			// 예고 타이머 감소
			event.AnnounceTimer -= dt
			if event.AnnounceTimer <= 0 {
				event.Phase = EventPhaseActive
				event.AnnounceTimer = 0

				ree.pendingNotifications = append(ree.pendingNotifications, RoundEventNotification{
					Type:  "activated",
					Event: event,
				})

				if ree.callbacks.OnEventActivated != nil {
					ree.callbacks.OnEventActivated(event)
				}

				slog.Info("round event activated",
					"event", event.Def.Kind,
				)
			}

		case EventPhaseActive:
			// 활성 타이머 감소
			event.ActiveTimer -= dt
			if event.ActiveTimer <= 0 {
				event.Phase = EventPhaseExpired
				event.ActiveTimer = 0

				ree.pendingNotifications = append(ree.pendingNotifications, RoundEventNotification{
					Type:  "expired",
					Event: event,
				})

				if ree.callbacks.OnEventExpired != nil {
					ree.callbacks.OnEventExpired(event)
				}

				slog.Info("round event expired",
					"event", event.Def.Kind,
				)
			}
		}
	}
}

// ── 라운드 종료 시 정리 ──

// OnRoundEnd clears all events at round end.
func (ree *RoundEventEngine) OnRoundEnd() {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	// 활성 이벤트 모두 만료 처리
	for _, event := range ree.events {
		if event.Phase == EventPhaseActive || event.Phase == EventPhaseAnnounced {
			event.Phase = EventPhaseExpired
			event.ActiveTimer = 0
			event.AnnounceTimer = 0
		}
	}

	ree.events = ree.events[:0]
	ree.pendingNotifications = ree.pendingNotifications[:0]
}

// ── Public Getters (Thread-Safe) ──

// GetActiveEvents returns currently active events.
func (ree *RoundEventEngine) GetActiveEvents() []*RoundEventInstance {
	ree.mu.RLock()
	defer ree.mu.RUnlock()

	var active []*RoundEventInstance
	for _, event := range ree.events {
		if event.Phase == EventPhaseActive || event.Phase == EventPhaseAnnounced {
			cp := *event
			active = append(active, &cp)
		}
	}
	return active
}

// GetAllEvents returns all events for the current round (any phase).
func (ree *RoundEventEngine) GetAllEvents() []*RoundEventInstance {
	ree.mu.RLock()
	defer ree.mu.RUnlock()

	result := make([]*RoundEventInstance, len(ree.events))
	for i, event := range ree.events {
		cp := *event
		result[i] = &cp
	}
	return result
}

// IsEventActive checks if a specific event kind is currently active.
func (ree *RoundEventEngine) IsEventActive(kind RoundEventKind) bool {
	ree.mu.RLock()
	defer ree.mu.RUnlock()

	for _, event := range ree.events {
		if event.Def.Kind == kind && event.Phase == EventPhaseActive {
			return true
		}
	}
	return false
}

// GetEventValue returns the value of an active event, or 0 if not active.
func (ree *RoundEventEngine) GetEventValue(kind RoundEventKind) float64 {
	ree.mu.RLock()
	defer ree.mu.RUnlock()

	for _, event := range ree.events {
		if event.Def.Kind == kind && event.Phase == EventPhaseActive {
			return event.Def.Value
		}
	}
	return 0
}

// FlushNotifications returns and clears pending notifications for broadcasting.
func (ree *RoundEventEngine) FlushNotifications() []RoundEventNotification {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	if len(ree.pendingNotifications) == 0 {
		return nil
	}

	result := make([]RoundEventNotification, len(ree.pendingNotifications))
	copy(result, ree.pendingNotifications)
	ree.pendingNotifications = ree.pendingNotifications[:0]
	return result
}

// ── 이벤트 효과 쿼리 (다른 시스템 연동용) ──

// GetResourceMultiplier returns the resource spawn multiplier.
// Returns 1.0 if ResourceSurge is not active.
func (ree *RoundEventEngine) GetResourceMultiplier() float64 {
	if ree.IsEventActive(EventResourceSurge) {
		return ResourceSurgeMultiplier
	}
	return 1.0
}

// GetShrinkSpeedMultiplier returns the safe zone shrink speed multiplier.
// Returns 1.0 if FastShrink is not active.
func (ree *RoundEventEngine) GetShrinkSpeedMultiplier() float64 {
	if ree.IsEventActive(EventFastShrink) {
		return FastShrinkSpeedMult
	}
	return 1.0
}

// GetNPCStatMultiplier returns the NPC stat multiplier from NPCRage event.
// Returns 1.0 if NPCRage is not active.
func (ree *RoundEventEngine) GetNPCStatMultiplier() float64 {
	if ree.IsEventActive(EventNPCRage) {
		return NPCRageStatMult
	}
	return 1.0
}

// IsFogOfWarActive returns true if the Fog of War event is active.
func (ree *RoundEventEngine) IsFogOfWarActive() bool {
	return ree.IsEventActive(EventFogOfWar)
}

// GetVisionMultiplier returns the vision range multiplier.
// Returns 1.0 if FogOfWar is not active, 0.5 if active.
func (ree *RoundEventEngine) GetVisionMultiplier() float64 {
	if ree.IsEventActive(EventFogOfWar) {
		return FogOfWarVisionMult
	}
	return 1.0
}

// IsTradeOpen returns true if the Trade Open event is active.
func (ree *RoundEventEngine) IsTradeOpen() bool {
	return ree.IsEventActive(EventTradeOpen)
}

// GetTradeDiscount returns the trade fee discount multiplier.
// Returns 0.0 (no discount) if TradeOpen is not active, 1.0 (full discount) if active.
func (ree *RoundEventEngine) GetTradeDiscount() float64 {
	if ree.IsEventActive(EventTradeOpen) {
		return TradeOpenDiscount
	}
	return 0.0
}

// ShouldSpawnBonusAirdrops returns the number of bonus airdrops to spawn.
// Returns 0 if BonusAirdrop is not active or already processed.
func (ree *RoundEventEngine) ShouldSpawnBonusAirdrops() int {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	for _, event := range ree.events {
		if event.Def.Kind == EventBonusAirdrop && event.Phase == EventPhaseActive {
			// 한 번만 5개 스폰하고, 이후 즉시 만료
			count := int(event.Def.Value)
			event.Phase = EventPhaseExpired
			event.ActiveTimer = 0
			return count
		}
	}
	return 0
}

// ── 스냅샷 (클라이언트 전송용) ──

// RoundEventSnapshot is the serialized form for WebSocket broadcasting.
type RoundEventSnapshot struct {
	Id            string         `json:"id"`
	Kind          RoundEventKind `json:"kind"`
	Name          string         `json:"name"`
	NameKo        string         `json:"nameKo"`
	Description   string         `json:"description"`
	Icon          string         `json:"icon"`
	Phase         RoundEventPhase `json:"phase"`
	AnnounceTimer float64        `json:"announceTimer,omitempty"`
	ActiveTimer   float64        `json:"activeTimer,omitempty"`
	Value         float64        `json:"value"`
}

// GetSnapshot returns a snapshot of all active/announced events for broadcasting.
func (ree *RoundEventEngine) GetSnapshot() []RoundEventSnapshot {
	ree.mu.RLock()
	defer ree.mu.RUnlock()

	var snapshots []RoundEventSnapshot
	for _, event := range ree.events {
		if event.Phase == EventPhaseExpired {
			continue
		}
		snapshots = append(snapshots, RoundEventSnapshot{
			Id:            event.Id,
			Kind:          event.Def.Kind,
			Name:          event.Def.Name,
			NameKo:        event.Def.NameKo,
			Description:   event.Def.Description,
			Icon:          event.Def.Icon,
			Phase:         event.Phase,
			AnnounceTimer: event.AnnounceTimer,
			ActiveTimer:   event.ActiveTimer,
			Value:         event.Def.Value,
		})
	}
	return snapshots
}

// Reset clears all events and state.
func (ree *RoundEventEngine) Reset() {
	ree.mu.Lock()
	defer ree.mu.Unlock()

	ree.events = ree.events[:0]
	ree.pendingNotifications = ree.pendingNotifications[:0]
}
