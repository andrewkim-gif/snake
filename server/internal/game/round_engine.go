package game

import (
	"log/slog"
	"math"
	"sync"
	"time"
)

// ============================================================
// v39 Phase 2 — RoundEngine: 15분 라운드 사이클 (EpochManager 대체)
//
// 3-Phase Round Cycle:
//   PvE (600s, 10분) → BR (300s, 5분) → Settlement (15s)
//
// BR SubPhases:
//   Skirmish (0-90s) → Engagement (90-210s) → FinalBattle (210-300s)
//
// SafeZone shrink:
//   100%→80% (Phase 1) → 50% (Phase 2) → 25% (Phase 3) → 10% (Phase 4)
//
// IEpochManager 호환: 기존 EpochManager 사용 코드와 교체 가능
// ============================================================

// ── IEpochManager 인터페이스 (하위 호환) ──

// IEpochManager defines the interface that both EpochManager and RoundEngine
// implement, allowing gradual migration from epoch-based to round-based cycle.
type IEpochManager interface {
	// Tick advances the timer by one server tick (called at 20Hz).
	Tick(tick uint64)
	// Start begins a new cycle.
	Start()
	// Stop halts the cycle.
	Stop()
	// Reset resets to initial state.
	Reset()
	// GetPhase returns the current phase as EpochPhase (for backward compat).
	GetPhase() EpochPhase
	// GetEpochNumber returns the current epoch/round number.
	GetEpochNumber() int
	// IsPvPEnabled returns whether PvP is currently active.
	IsPvPEnabled() bool
	// GetOrbMultiplier returns the current orb/resource spawn multiplier.
	GetOrbMultiplier() float64
	// GetCurrentRadius returns the current arena radius.
	GetCurrentRadius() float64
	// GetTimeRemaining returns seconds remaining in the current cycle.
	GetTimeRemaining() int
	// GetPhaseTimeRemaining returns seconds remaining in the current phase.
	GetPhaseTimeRemaining() int
	// IsRunning returns whether the cycle is active.
	IsRunning() bool
	// IsPeacePhase returns true during non-PvP phases.
	IsPeacePhase() bool
	// IsWarPhase returns true during PvP phases.
	IsWarPhase() bool
}

// ── RoundEngine 이벤트 타입 ──

// RoundEventType classifies round engine events.
type RoundEventType string

const (
	RoundEvtRoundStart     RoundEventType = "round_start"
	RoundEvtRoundEnd       RoundEventType = "round_end"
	RoundEvtPhaseChange    RoundEventType = "round_phase_change"
	RoundEvtBRCountdown    RoundEventType = "round_br_countdown"
	RoundEvtBRSubPhase     RoundEventType = "round_br_subphase"
	RoundEvtSafeZoneUpdate RoundEventType = "round_safezone_update"
	RoundEvtWarWarning     RoundEventType = "round_war_warning"
	RoundEvtSettlement     RoundEventType = "round_settlement"
)

// RoundEvent represents an event emitted by the RoundEngine.
type RoundEvent struct {
	Type        RoundEventType
	CountryCode string
	Data        interface{}
}

// RoundStartData is the payload for round_start events.
type RoundStartData struct {
	RoundNumber   int       `json:"roundNumber"`
	Phase         string    `json:"phase"`
	PvEDuration   float64   `json:"pveDurationSec"`
	BRDuration    float64   `json:"brDurationSec"`
	SettleDuration float64  `json:"settleDurationSec"`
	TotalDuration float64   `json:"totalDurationSec"`
	StartedAt     time.Time `json:"startedAt"`
}

// RoundPhaseChangeData is the payload for phase change events.
type RoundPhaseChangeData struct {
	RoundNumber int    `json:"roundNumber"`
	Phase       string `json:"phase"`
	SubPhase    string `json:"subPhase,omitempty"`
	Duration    int    `json:"durationSec"`
	PvPEnabled  bool   `json:"pvpEnabled"`
}

// RoundSafeZoneData is the payload for safe zone update events.
type RoundSafeZoneData struct {
	CenterX       float64 `json:"centerX"`
	CenterY       float64 `json:"centerY"`
	CurrentRadius float64 `json:"currentRadius"`
	TargetRadius  float64 `json:"targetRadius"`
	Phase         int     `json:"phase"`
	DPS           float64 `json:"dps"`
	IsShrinking   bool    `json:"isShrinking"`
	IsWarning     bool    `json:"isWarning"`
}

// ── BR SubPhase 설정 ──

// BRSubPhaseConfig defines a sub-phase within the BR phase.
type BRSubPhaseConfig struct {
	Name            string  // "skirmish" | "engagement" | "final_battle"
	StartTime       float64 // BR 시작 후 초
	Duration        float64 // 초
	GoldMultiplier  float64 // Gold 배율
	ScoreMultiplier float64 // Score 배율
	SafeZonePhase   int     // 연결된 세이프존 수축 단계
}

// DefaultBRSubPhases returns the default BR sub-phase configuration.
// Skirmish: 0~90s, Engagement: 90~210s, FinalBattle: 210~300s
var DefaultBRSubPhases = []BRSubPhaseConfig{
	{Name: "skirmish", StartTime: 0, Duration: 90, GoldMultiplier: 1.0, ScoreMultiplier: 1.0, SafeZonePhase: 1},
	{Name: "engagement", StartTime: 90, Duration: 120, GoldMultiplier: 1.5, ScoreMultiplier: 1.5, SafeZonePhase: 2},
	{Name: "final_battle", StartTime: 210, Duration: 90, GoldMultiplier: 2.5, ScoreMultiplier: 3.0, SafeZonePhase: 3},
}

// ── RoundEngine 콜백 ──

// RoundCallbacks holds optional callbacks for round lifecycle events.
type RoundCallbacks struct {
	// OnPhaseChange is called when the round phase changes.
	OnPhaseChange func(phase RoundPhase, subPhase BRSubPhase)
	// OnRoundStart is called when a new round begins.
	OnRoundStart func(roundNumber int)
	// OnRoundEnd is called when a round ends (entering settlement).
	OnRoundEnd func(roundNumber int)
	// OnBRCountdown is called during the PvE→BR countdown (10→1).
	OnBRCountdown func(secondsLeft int)
	// OnSafeZoneUpdate is called when the safe zone state changes.
	OnSafeZoneUpdate func(safeZone *BRSafeZone)
	// OnWarWarning is called at the 9-minute war warning.
	OnWarWarning func()
}

// ── RoundConfig ──

// RoundEngineConfig holds the round timing configuration.
type RoundEngineConfig struct {
	PvEDuration        float64            // PvE 페이즈 (초), default 600
	BRDuration         float64            // BR 페이즈 (초), default 300
	SettlementDuration float64            // 정산 페이즈 (초), default 15
	BRCountdownDuration float64           // BR 전환 카운트다운 (초), default 10
	WarWarningAt       float64            // 전쟁 경고 시점 (PvE 시작 후, 초), default 540
	ArenaSize          float64            // 아레나 크기 (px), default 3000
	SubPhases          []BRSubPhaseConfig // BR 서브 페이즈 설정
	SafeZonePhases     []BRSafeZonePhase  // 세이프존 수축 단계
}

// DefaultRoundEngineConfig returns the default round engine configuration.
func DefaultRoundEngineConfig() RoundEngineConfig {
	return RoundEngineConfig{
		PvEDuration:         RoundPvEDuration,
		BRDuration:          RoundBRDuration,
		SettlementDuration:  RoundSettlementDuration,
		BRCountdownDuration: RoundBRCountdownDuration,
		WarWarningAt:        RoundWarWarningAt,
		ArenaSize:           ArenaRadius * 2, // diameter
		SubPhases:           DefaultBRSubPhases,
		SafeZonePhases:      BRSafeZonePhases,
	}
}

// ── RoundEngine 본체 ──

// RoundEngine manages the v39 15-minute round cycle.
// Replaces EpochManager while maintaining IEpochManager compatibility.
type RoundEngine struct {
	mu sync.RWMutex

	countryCode string
	config      RoundEngineConfig
	callbacks   RoundCallbacks

	// 상태
	roundNumber  int
	phase        RoundPhase
	brSubPhase   BRSubPhase
	phaseTick    uint64  // 현재 페이즈 내 경과 틱
	totalTick    uint64  // 라운드 전체 경과 틱
	running      bool
	pvpEnabled   bool
	orbMultiplier float64
	roundStartAt time.Time

	// 세이프존 상태
	safeZone         BRSafeZone
	safeZonePhaseIdx int // 현재 진행 중인 세이프존 페이즈 인덱스

	// 이벤트 버퍼 (EpochManager 패턴 호환)
	events   []RoundEvent
	OnEvents func(events []RoundEvent)

	// EpochEvent 호환 이벤트 (기존 코드와의 브릿지)
	epochEvents   []EpochEvent
	OnEpochEvents func(events []EpochEvent)

	// 전쟁 경고 발송 여부
	warWarningSent bool
	// BR 카운트다운 마지막 발송 초
	lastBRCountdownSec int
}

// NewRoundEngine creates a new RoundEngine for a country/region arena.
func NewRoundEngine(countryCode string, config RoundEngineConfig) *RoundEngine {
	arenaHalf := config.ArenaSize / 2
	return &RoundEngine{
		countryCode:   countryCode,
		config:        config,
		roundNumber:   0,
		phase:         PhasePvE,
		phaseTick:     0,
		totalTick:     0,
		running:       false,
		pvpEnabled:    false,
		orbMultiplier: 2.0, // PvE 시작 시 2x
		events:        make([]RoundEvent, 0, 16),
		epochEvents:   make([]EpochEvent, 0, 8),
		safeZone: BRSafeZone{
			CenterX:       arenaHalf,
			CenterY:       arenaHalf,
			CurrentRadius: arenaHalf,
			TargetRadius:  arenaHalf,
			Phase:         0,
			DPS:           0,
			IsShrinking:   false,
			IsWarning:     false,
		},
		lastBRCountdownSec: -1,
	}
}

// NewRoundEngineDefault creates a RoundEngine with default configuration.
func NewRoundEngineDefault(countryCode string) *RoundEngine {
	return NewRoundEngine(countryCode, DefaultRoundEngineConfig())
}

// ── Lifecycle Methods ──

// Start begins a new round.
func (re *RoundEngine) Start() {
	re.mu.Lock()
	defer re.mu.Unlock()

	re.roundNumber++
	re.phase = PhasePvE
	re.brSubPhase = ""
	re.phaseTick = 0
	re.totalTick = 0
	re.running = true
	re.pvpEnabled = false
	re.orbMultiplier = 2.0
	re.roundStartAt = time.Now()
	re.warWarningSent = false
	re.lastBRCountdownSec = -1
	re.safeZonePhaseIdx = 0

	// 세이프존 초기화 (아레나 전체)
	arenaHalf := re.config.ArenaSize / 2
	re.safeZone = BRSafeZone{
		CenterX:       arenaHalf,
		CenterY:       arenaHalf,
		CurrentRadius: arenaHalf,
		TargetRadius:  arenaHalf,
		Phase:         0,
		DPS:           0,
		IsShrinking:   false,
		IsWarning:     false,
	}

	// 라운드 시작 이벤트
	re.emitRoundEvent(RoundEvent{
		Type:        RoundEvtRoundStart,
		CountryCode: re.countryCode,
		Data: RoundStartData{
			RoundNumber:    re.roundNumber,
			Phase:          string(PhasePvE),
			PvEDuration:    re.config.PvEDuration,
			BRDuration:     re.config.BRDuration,
			SettleDuration: re.config.SettlementDuration,
			TotalDuration:  re.config.PvEDuration + re.config.BRDuration + re.config.SettlementDuration,
			StartedAt:      re.roundStartAt,
		},
	})

	// EpochManager 호환 이벤트
	re.emitEpochEvent(EpochEvent{
		Type:        EpochEvtEpochStart,
		CountryCode: re.countryCode,
		Data: EpochStartData{
			EpochNumber:   re.roundNumber,
			Phase:         EpochPhasePeace, // PvE → Peace 매핑
			DurationSec:   int(re.config.PvEDuration + re.config.BRDuration + re.config.SettlementDuration),
			PeaceDuration: int(re.config.PvEDuration),
			WarDuration:   int(re.config.BRDuration),
			ShrinkDuration: 0, // v39: shrink은 BR 내 sub-phase로 통합
		},
	})

	slog.Info("round started",
		"country", re.countryCode,
		"round", re.roundNumber,
	)
}

// Stop stops the round engine.
func (re *RoundEngine) Stop() {
	re.mu.Lock()
	defer re.mu.Unlock()
	re.running = false
}

// Reset resets the round engine to initial state.
func (re *RoundEngine) Reset() {
	re.mu.Lock()
	defer re.mu.Unlock()

	re.roundNumber = 0
	re.phase = PhasePvE
	re.brSubPhase = ""
	re.phaseTick = 0
	re.totalTick = 0
	re.running = false
	re.pvpEnabled = false
	re.orbMultiplier = 1.0
	re.warWarningSent = false
	re.lastBRCountdownSec = -1
	re.safeZonePhaseIdx = 0

	arenaHalf := re.config.ArenaSize / 2
	re.safeZone = BRSafeZone{
		CenterX:       arenaHalf,
		CenterY:       arenaHalf,
		CurrentRadius: arenaHalf,
		TargetRadius:  arenaHalf,
	}
}

// ── Tick (20Hz) ──

// Tick advances the round engine by one tick (called at 20Hz).
func (re *RoundEngine) Tick(tick uint64) {
	re.mu.Lock()
	defer re.mu.Unlock()

	if !re.running {
		return
	}

	re.phaseTick++
	re.totalTick++
	re.events = re.events[:0]
	re.epochEvents = re.epochEvents[:0]

	switch re.phase {
	case PhasePvE:
		re.tickPvE()
	case PhaseBRCountdown:
		re.tickBRCountdown()
	case PhaseBR:
		re.tickBR()
	case PhaseSettlement:
		re.tickSettlement()
	}

	// 이벤트 플러시
	if re.OnEvents != nil && len(re.events) > 0 {
		eventsCopy := make([]RoundEvent, len(re.events))
		copy(eventsCopy, re.events)
		re.OnEvents(eventsCopy)
	}
	if re.OnEpochEvents != nil && len(re.epochEvents) > 0 {
		eventsCopy := make([]EpochEvent, len(re.epochEvents))
		copy(eventsCopy, re.epochEvents)
		re.OnEpochEvents(eventsCopy)
	}
}

// ── Phase Tick Handlers ──

func (re *RoundEngine) tickPvE() {
	elapsedSec := float64(re.phaseTick) / float64(TickRate)

	// 9분(540초) 전쟁 경고
	if !re.warWarningSent && elapsedSec >= re.config.WarWarningAt {
		re.warWarningSent = true
		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtWarWarning,
			CountryCode: re.countryCode,
			Data: map[string]interface{}{
				"roundNumber":    re.roundNumber,
				"warInSeconds":   int(re.config.PvEDuration - elapsedSec),
			},
		})
		if re.callbacks.OnWarWarning != nil {
			re.callbacks.OnWarWarning()
		}
	}

	// BR 카운트다운 진입 (PvE 마지막 10초)
	brCountdownStart := re.config.PvEDuration - re.config.BRCountdownDuration
	if elapsedSec >= brCountdownStart {
		re.transitionTo(PhaseBRCountdown)
		return
	}
}

func (re *RoundEngine) tickBRCountdown() {
	// phaseTick은 PvE에서 계속 누적 (리셋하지 않음 — 카운트다운은 PvE의 마지막 10초)
	elapsedSec := float64(re.phaseTick) / float64(TickRate)

	// PvE 종료 체크
	if elapsedSec >= re.config.PvEDuration {
		re.transitionTo(PhaseBR)
		return
	}

	// 매 초마다 카운트다운 이벤트 발송
	secondsLeft := int(math.Ceil(re.config.PvEDuration - elapsedSec))
	if secondsLeft != re.lastBRCountdownSec && secondsLeft <= int(re.config.BRCountdownDuration) {
		re.lastBRCountdownSec = secondsLeft
		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtBRCountdown,
			CountryCode: re.countryCode,
			Data: map[string]interface{}{
				"countdown":   secondsLeft,
				"roundNumber": re.roundNumber,
			},
		})
		// EpochManager 호환: WarCountdown 이벤트
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtWarCountdown,
			CountryCode: re.countryCode,
			Data:        map[string]interface{}{"countdown": secondsLeft},
		})
		if re.callbacks.OnBRCountdown != nil {
			re.callbacks.OnBRCountdown(secondsLeft)
		}
	}
}

func (re *RoundEngine) tickBR() {
	brElapsedSec := float64(re.phaseTick) / float64(TickRate)

	// BR 종료 체크
	if brElapsedSec >= re.config.BRDuration {
		re.transitionTo(PhaseSettlement)
		return
	}

	// BR SubPhase 업데이트
	re.updateBRSubPhase(brElapsedSec)

	// 세이프존 수축 업데이트
	re.updateSafeZone(brElapsedSec)
}

func (re *RoundEngine) tickSettlement() {
	elapsedSec := float64(re.phaseTick) / float64(TickRate)

	if elapsedSec >= re.config.SettlementDuration {
		// 정산 완료 → 새 라운드 시작
		slog.Info("round ended, starting next",
			"country", re.countryCode,
			"round", re.roundNumber,
		)

		// 라운드 종료 이벤트 (EpochManager 호환)
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtEpochEnd,
			CountryCode: re.countryCode,
			Data: EpochEndData{
				EpochNumber: re.roundNumber,
				CountryCode: re.countryCode,
				PvPEnabled:  false,
			},
		})

		// 새 라운드 시작 (자동)
		re.roundNumber++
		re.phase = PhasePvE
		re.brSubPhase = ""
		re.phaseTick = 0
		re.totalTick = 0
		re.pvpEnabled = false
		re.orbMultiplier = 2.0
		re.roundStartAt = time.Now()
		re.warWarningSent = false
		re.lastBRCountdownSec = -1
		re.safeZonePhaseIdx = 0

		arenaHalf := re.config.ArenaSize / 2
		re.safeZone = BRSafeZone{
			CenterX:       arenaHalf,
			CenterY:       arenaHalf,
			CurrentRadius: arenaHalf,
			TargetRadius:  arenaHalf,
			Phase:         0,
			DPS:           0,
			IsShrinking:   false,
			IsWarning:     false,
		}

		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtRoundStart,
			CountryCode: re.countryCode,
			Data: RoundStartData{
				RoundNumber:    re.roundNumber,
				Phase:          string(PhasePvE),
				PvEDuration:    re.config.PvEDuration,
				BRDuration:     re.config.BRDuration,
				SettleDuration: re.config.SettlementDuration,
				TotalDuration:  re.config.PvEDuration + re.config.BRDuration + re.config.SettlementDuration,
				StartedAt:      re.roundStartAt,
			},
		})

		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtEpochStart,
			CountryCode: re.countryCode,
			Data: EpochStartData{
				EpochNumber:   re.roundNumber,
				Phase:         EpochPhasePeace,
				DurationSec:   int(re.config.PvEDuration + re.config.BRDuration + re.config.SettlementDuration),
				PeaceDuration: int(re.config.PvEDuration),
				WarDuration:   int(re.config.BRDuration),
			},
		})

		if re.callbacks.OnRoundStart != nil {
			re.callbacks.OnRoundStart(re.roundNumber)
		}

		slog.Info("round started",
			"country", re.countryCode,
			"round", re.roundNumber,
		)
	}
}

// ── Phase Transition ──

func (re *RoundEngine) transitionTo(newPhase RoundPhase) {
	oldPhase := re.phase
	re.phase = newPhase

	switch newPhase {
	case PhaseBRCountdown:
		// PvE 마지막 10초: 페이즈 변경이지만 phaseTick은 리셋하지 않음
		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtPhaseChange,
			CountryCode: re.countryCode,
			Data: RoundPhaseChangeData{
				RoundNumber: re.roundNumber,
				Phase:       string(PhaseBRCountdown),
				Duration:    int(re.config.BRCountdownDuration),
				PvPEnabled:  false,
			},
		})
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtPhaseChange,
			CountryCode: re.countryCode,
			Data: map[string]interface{}{
				"phase":    string(EpochPhaseWarCountdown),
				"duration": int(re.config.BRCountdownDuration),
			},
		})

	case PhaseBR:
		re.phaseTick = 0 // BR 페이즈 틱 리셋
		re.pvpEnabled = true
		re.orbMultiplier = 1.0
		re.brSubPhase = BRSubSkirmish

		// 세이프존 초기화 (아레나 전체 크기에서 시작)
		arenaHalf := re.config.ArenaSize / 2
		re.safeZone = BRSafeZone{
			CenterX:       arenaHalf,
			CenterY:       arenaHalf,
			CurrentRadius: arenaHalf,
			TargetRadius:  arenaHalf,
			Phase:         0,
			DPS:           0,
			IsShrinking:   false,
			IsWarning:     false,
		}
		re.safeZonePhaseIdx = 0

		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtPhaseChange,
			CountryCode: re.countryCode,
			Data: RoundPhaseChangeData{
				RoundNumber: re.roundNumber,
				Phase:       string(PhaseBR),
				SubPhase:    string(BRSubSkirmish),
				Duration:    int(re.config.BRDuration),
				PvPEnabled:  true,
			},
		})
		// EpochManager 호환: War 시작
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtWarPhaseStart,
			CountryCode: re.countryCode,
			Data: WarPhaseData{
				EpochNumber: re.roundNumber,
				WarDuration: int(re.config.BRDuration),
			},
		})

		if re.callbacks.OnPhaseChange != nil {
			re.callbacks.OnPhaseChange(PhaseBR, BRSubSkirmish)
		}

	case PhaseSettlement:
		re.phaseTick = 0 // Settlement 페이즈 틱 리셋
		re.pvpEnabled = false
		re.orbMultiplier = 0

		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtSettlement,
			CountryCode: re.countryCode,
			Data: RoundPhaseChangeData{
				RoundNumber: re.roundNumber,
				Phase:       string(PhaseSettlement),
				Duration:    int(re.config.SettlementDuration),
				PvPEnabled:  false,
			},
		})
		// EpochManager 호환: War 종료 + 에폭 종료
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtWarPhaseEnd,
			CountryCode: re.countryCode,
			Data: WarPhaseData{
				EpochNumber: re.roundNumber,
			},
		})

		if re.callbacks.OnRoundEnd != nil {
			re.callbacks.OnRoundEnd(re.roundNumber)
		}
		if re.callbacks.OnPhaseChange != nil {
			re.callbacks.OnPhaseChange(PhaseSettlement, "")
		}
	}

	slog.Info("round phase transition",
		"country", re.countryCode,
		"round", re.roundNumber,
		"from", oldPhase,
		"to", newPhase,
	)
}

// ── BR SubPhase Update ──

func (re *RoundEngine) updateBRSubPhase(brElapsedSec float64) {
	var newSubPhase BRSubPhase
	var newMultiplier float64 = 1.0

	for _, sp := range re.config.SubPhases {
		if brElapsedSec >= sp.StartTime && brElapsedSec < sp.StartTime+sp.Duration {
			newSubPhase = BRSubPhase(sp.Name)
			newMultiplier = sp.GoldMultiplier
			break
		}
	}
	// 범위 벗어나면 마지막 서브페이즈 유지
	if newSubPhase == "" && len(re.config.SubPhases) > 0 {
		last := re.config.SubPhases[len(re.config.SubPhases)-1]
		newSubPhase = BRSubPhase(last.Name)
		newMultiplier = last.GoldMultiplier
	}

	if newSubPhase != re.brSubPhase {
		oldSub := re.brSubPhase
		re.brSubPhase = newSubPhase
		re.orbMultiplier = newMultiplier

		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtBRSubPhase,
			CountryCode: re.countryCode,
			Data: map[string]interface{}{
				"roundNumber": re.roundNumber,
				"subPhase":    string(newSubPhase),
				"oldSubPhase": string(oldSub),
				"goldMult":    newMultiplier,
			},
		})

		if re.callbacks.OnPhaseChange != nil {
			re.callbacks.OnPhaseChange(PhaseBR, newSubPhase)
		}

		slog.Info("BR sub-phase change",
			"country", re.countryCode,
			"round", re.roundNumber,
			"subPhase", newSubPhase,
		)
	}
}

// ── SafeZone Update ──

func (re *RoundEngine) updateSafeZone(brElapsedSec float64) {
	phases := re.config.SafeZonePhases
	if len(phases) == 0 {
		return
	}

	arenaHalf := re.config.ArenaSize / 2

	// 현재 활성 세이프존 페이즈 찾기
	for i := re.safeZonePhaseIdx; i < len(phases); i++ {
		sp := phases[i]
		phaseStart := sp.StartTime
		warningEnd := phaseStart + sp.WarningDur
		shrinkEnd := warningEnd + sp.ShrinkDur

		if brElapsedSec < phaseStart {
			// 이 페이즈 아직 시작 안 함
			break
		}

		if brElapsedSec >= phaseStart && brElapsedSec < warningEnd {
			// 경고 구간
			re.safeZone.Phase = sp.Phase
			re.safeZone.TargetRadius = sp.TargetRadius * arenaHalf
			re.safeZone.DPS = sp.DPS
			re.safeZone.IsWarning = true
			re.safeZone.IsShrinking = false
			re.safeZonePhaseIdx = i
			break
		}

		if brElapsedSec >= warningEnd && brElapsedSec < shrinkEnd {
			// 수축 구간: 선형 보간
			shrinkProgress := (brElapsedSec - warningEnd) / sp.ShrinkDur
			shrinkProgress = math.Min(1.0, math.Max(0.0, shrinkProgress))

			targetRadius := sp.TargetRadius * arenaHalf
			var startRadius float64
			if i > 0 {
				startRadius = phases[i-1].TargetRadius * arenaHalf
			} else {
				startRadius = arenaHalf // 100%에서 시작
			}

			re.safeZone.Phase = sp.Phase
			re.safeZone.CurrentRadius = startRadius - (startRadius-targetRadius)*shrinkProgress
			re.safeZone.TargetRadius = targetRadius
			re.safeZone.DPS = sp.DPS
			re.safeZone.IsWarning = false
			re.safeZone.IsShrinking = true
			re.safeZonePhaseIdx = i
			break
		}

		if brElapsedSec >= shrinkEnd {
			// 이 페이즈 수축 완료
			re.safeZone.CurrentRadius = sp.TargetRadius * arenaHalf
			re.safeZone.TargetRadius = sp.TargetRadius * arenaHalf
			re.safeZone.IsShrinking = false
			re.safeZone.IsWarning = false
			re.safeZonePhaseIdx = i + 1
			// 다음 페이즈 확인을 위해 계속
		}
	}

	// 매 초(1Hz)마다 세이프존 이벤트 발송
	if re.phaseTick%uint64(TickRate) == 0 {
		re.emitRoundEvent(RoundEvent{
			Type:        RoundEvtSafeZoneUpdate,
			CountryCode: re.countryCode,
			Data: RoundSafeZoneData{
				CenterX:       re.safeZone.CenterX,
				CenterY:       re.safeZone.CenterY,
				CurrentRadius: re.safeZone.CurrentRadius,
				TargetRadius:  re.safeZone.TargetRadius,
				Phase:         re.safeZone.Phase,
				DPS:           re.safeZone.DPS,
				IsShrinking:   re.safeZone.IsShrinking,
				IsWarning:     re.safeZone.IsWarning,
			},
		})
		// EpochManager 호환: ShrinkUpdate
		re.emitEpochEvent(EpochEvent{
			Type:        EpochEvtShrinkUpdate,
			CountryCode: re.countryCode,
			Data: map[string]interface{}{
				"currentRadius": re.safeZone.CurrentRadius,
				"minRadius":     re.safeZone.TargetRadius,
			},
		})

		if re.callbacks.OnSafeZoneUpdate != nil {
			sz := re.safeZone // copy
			re.callbacks.OnSafeZoneUpdate(&sz)
		}
	}
}

// ── Event Helpers ──

func (re *RoundEngine) emitRoundEvent(evt RoundEvent) {
	re.events = append(re.events, evt)
}

func (re *RoundEngine) emitEpochEvent(evt EpochEvent) {
	re.epochEvents = append(re.epochEvents, evt)
}

// ── Public Getters (Thread-Safe, IEpochManager Compatible) ──

// GetPhase returns the current phase as EpochPhase (backward compat).
func (re *RoundEngine) GetPhase() EpochPhase {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.roundPhaseToEpochPhase()
}

// GetRoundPhase returns the current v39 RoundPhase.
func (re *RoundEngine) GetRoundPhase() RoundPhase {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.phase
}

// GetBRSubPhase returns the current BR sub-phase.
func (re *RoundEngine) GetBRSubPhase() BRSubPhase {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.brSubPhase
}

// GetEpochNumber returns the current round number (alias for backward compat).
func (re *RoundEngine) GetEpochNumber() int {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.roundNumber
}

// GetRoundNumber returns the current round number.
func (re *RoundEngine) GetRoundNumber() int {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.roundNumber
}

// IsPvPEnabled returns whether PvP is currently active.
func (re *RoundEngine) IsPvPEnabled() bool {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.pvpEnabled
}

// GetOrbMultiplier returns the current orb/resource spawn multiplier.
func (re *RoundEngine) GetOrbMultiplier() float64 {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.orbMultiplier
}

// GetCurrentRadius returns the current safe zone radius.
func (re *RoundEngine) GetCurrentRadius() float64 {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.safeZone.CurrentRadius
}

// GetSafeZone returns a copy of the current safe zone state.
func (re *RoundEngine) GetSafeZone() BRSafeZone {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.safeZone
}

// GetTimeRemaining returns seconds remaining in the current round.
func (re *RoundEngine) GetTimeRemaining() int {
	re.mu.RLock()
	defer re.mu.RUnlock()

	totalDurationTicks := uint64((re.config.PvEDuration + re.config.BRDuration + re.config.SettlementDuration) * float64(TickRate))
	if re.totalTick >= totalDurationTicks {
		return 0
	}
	remaining := totalDurationTicks - re.totalTick
	return int(remaining / uint64(TickRate))
}

// GetPhaseTimeRemaining returns seconds remaining in the current phase.
func (re *RoundEngine) GetPhaseTimeRemaining() int {
	re.mu.RLock()
	defer re.mu.RUnlock()

	var phaseDuration float64
	switch re.phase {
	case PhasePvE:
		phaseDuration = re.config.PvEDuration
	case PhaseBRCountdown:
		phaseDuration = re.config.PvEDuration // BR카운트다운은 PvE의 마지막 10초
	case PhaseBR:
		phaseDuration = re.config.BRDuration
	case PhaseSettlement:
		phaseDuration = re.config.SettlementDuration
	}

	elapsedSec := float64(re.phaseTick) / float64(TickRate)
	remaining := phaseDuration - elapsedSec
	if remaining < 0 {
		return 0
	}
	return int(remaining)
}

// IsRunning returns whether the round engine is active.
func (re *RoundEngine) IsRunning() bool {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.running
}

// IsPeacePhase returns true during PvE phase (no PvP).
func (re *RoundEngine) IsPeacePhase() bool {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.phase == PhasePvE || re.phase == PhaseBRCountdown
}

// IsWarPhase returns true during BR phase (PvP active).
func (re *RoundEngine) IsWarPhase() bool {
	re.mu.RLock()
	defer re.mu.RUnlock()
	return re.phase == PhaseBR
}

// GetRoundState returns the current round state for serialization.
func (re *RoundEngine) GetRoundState() *RoundState {
	re.mu.RLock()
	defer re.mu.RUnlock()

	elapsedSec := float64(re.phaseTick) / float64(TickRate)
	var countdown float64
	var brCountdown int

	switch re.phase {
	case PhasePvE:
		countdown = re.config.PvEDuration - elapsedSec
	case PhaseBRCountdown:
		countdown = re.config.PvEDuration - elapsedSec
		brCountdown = int(math.Ceil(countdown))
		if brCountdown > int(re.config.BRCountdownDuration) {
			brCountdown = int(re.config.BRCountdownDuration)
		}
	case PhaseBR:
		countdown = re.config.BRDuration - elapsedSec
	case PhaseSettlement:
		countdown = re.config.SettlementDuration - elapsedSec
	}

	state := &RoundState{
		RoundNumber:  re.roundNumber,
		Phase:        re.phase,
		BRSubPhase:   re.brSubPhase,
		Elapsed:      elapsedSec,
		Countdown:    math.Max(0, countdown),
		PvPEnabled:   re.pvpEnabled,
		RoundStartAt: re.roundStartAt,
	}
	if re.phase == PhaseBRCountdown {
		state.BRCountdown = brCountdown
	}
	return state
}

// AddNationScore is a no-op for backward compat (v39 uses faction RP instead).
func (re *RoundEngine) AddNationScore(_ string, _ int) {
	// v39: Nation scores are replaced by faction RP in TerritoryEngine.
}

// GetNationScores returns empty map (v39 uses faction RP).
func (re *RoundEngine) GetNationScores() map[string]int {
	return make(map[string]int)
}

// ── Phase Mapping (RoundPhase → EpochPhase) ──

func (re *RoundEngine) roundPhaseToEpochPhase() EpochPhase {
	switch re.phase {
	case PhasePvE:
		return EpochPhasePeace
	case PhaseBRCountdown:
		return EpochPhaseWarCountdown
	case PhaseBR:
		return EpochPhaseWar
	case PhaseSettlement:
		return EpochPhaseEnd
	default:
		return EpochPhasePeace
	}
}

// ── EpochAdapter (기존 CountryArena 호환 어댑터) ──

// EpochAdapter wraps RoundEngine to provide exact EpochManager API compatibility.
// Use this when a CountryArenaWrapper expects *EpochManager but you want RoundEngine.
type EpochAdapter struct {
	engine *RoundEngine
}

// NewEpochAdapter creates an adapter that exposes RoundEngine as EpochManager-like API.
func NewEpochAdapter(engine *RoundEngine) *EpochAdapter {
	return &EpochAdapter{engine: engine}
}

// Start begins a new round (delegated to RoundEngine).
func (ea *EpochAdapter) Start() {
	ea.engine.Start()
}

// Tick advances by one tick (delegated to RoundEngine).
func (ea *EpochAdapter) Tick(tick uint64) {
	ea.engine.Tick(tick)
}

// GetPhase returns current phase as EpochPhase.
func (ea *EpochAdapter) GetPhase() EpochPhase {
	return ea.engine.GetPhase()
}

// GetEpochNumber returns current round number.
func (ea *EpochAdapter) GetEpochNumber() int {
	return ea.engine.GetEpochNumber()
}

// IsPvPEnabled returns whether PvP is active.
func (ea *EpochAdapter) IsPvPEnabled() bool {
	return ea.engine.IsPvPEnabled()
}

// GetOrbMultiplier returns the orb spawn multiplier.
func (ea *EpochAdapter) GetOrbMultiplier() float64 {
	return ea.engine.GetOrbMultiplier()
}

// GetCurrentRadius returns the current safe zone radius.
func (ea *EpochAdapter) GetCurrentRadius() float64 {
	return ea.engine.GetCurrentRadius()
}

// GetTimeRemaining returns seconds remaining in round.
func (ea *EpochAdapter) GetTimeRemaining() int {
	return ea.engine.GetTimeRemaining()
}

// GetPhaseTimeRemaining returns seconds remaining in current phase.
func (ea *EpochAdapter) GetPhaseTimeRemaining() int {
	return ea.engine.GetPhaseTimeRemaining()
}

// IsRunning returns whether the engine is active.
func (ea *EpochAdapter) IsRunning() bool {
	return ea.engine.IsRunning()
}

// IsPeacePhase returns true during PvE.
func (ea *EpochAdapter) IsPeacePhase() bool {
	return ea.engine.IsPeacePhase()
}

// IsWarPhase returns true during BR.
func (ea *EpochAdapter) IsWarPhase() bool {
	return ea.engine.IsWarPhase()
}

// Stop halts the engine.
func (ea *EpochAdapter) Stop() {
	ea.engine.Stop()
}

// Reset resets the engine.
func (ea *EpochAdapter) Reset() {
	ea.engine.Reset()
}

// AddNationScore is a no-op (v39 uses faction RP).
func (ea *EpochAdapter) AddNationScore(nationality string, score int) {
	ea.engine.AddNationScore(nationality, score)
}

// GetNationScores returns empty map (v39 uses faction RP).
func (ea *EpochAdapter) GetNationScores() map[string]int {
	return ea.engine.GetNationScores()
}

// OnEvents setter for backward compat.
func (ea *EpochAdapter) SetOnEpochEvents(fn func(events []EpochEvent)) {
	ea.engine.OnEpochEvents = fn
}

// GetEngine returns the underlying RoundEngine for v39-specific access.
func (ea *EpochAdapter) GetEngine() *RoundEngine {
	return ea.engine
}

// ── Compile-time interface checks ──

var _ IEpochManager = (*RoundEngine)(nil)
var _ IEpochManager = (*EpochAdapter)(nil)
