package game

import (
	"log/slog"
	"sort"
	"sync"
	"time"
)

// ============================================================
// v39 Phase 6 — BREliminationSystem: 팩션 전멸 판정 + 승리 연출
//
// 배틀로얄 페이즈 팩션 전멸 판정:
//   - 팩션의 마지막 멤버 사망 → 전멸 판정
//   - 전멸 순서 역순 = 순위 (먼저 전멸 = 낮은 순위)
//   - 최후 1팩션 생존 → 라운드 즉시 종료 → Settlement
//
// 승리 보상:
//   - 1위: 100% 보상 + 10 RP
//   - 2위: 60% 보상 + 5 RP
//   - 3위: 30% 보상 + 3 RP
//
// 관전 모드:
//   - 전멸된 팩션 멤버 → 관전 모드 전환
//   - 자동으로 생존 팩션의 플레이어를 추적
// ============================================================

// ── 보상 상수 ──

const (
	// VictoryRP1st는 1위 팩션 Region Point 보상
	VictoryRP1st = 10
	// VictoryRP2nd는 2위 팩션 Region Point 보상
	VictoryRP2nd = 5
	// VictoryRP3rd는 3위 팩션 Region Point 보상
	VictoryRP3rd = 3

	// VictoryReward1st는 1위 보상 비율 (100%)
	VictoryReward1st = 1.0
	// VictoryReward2nd는 2위 보상 비율 (60%)
	VictoryReward2nd = 0.6
	// VictoryReward3rd는 3위 보상 비율 (30%)
	VictoryReward3rd = 0.3
)

// ── 전멸 기록 ──

// FactionEliminationRecord은 팩션 전멸 기록을 담는다.
type FactionEliminationRecord struct {
	FactionId     string    `json:"factionId"`
	FactionName   string    `json:"factionName"`
	Color         string    `json:"color"`
	EliminatedAt  time.Time `json:"eliminatedAt"`
	Rank          int       `json:"rank"`     // 최종 순위 (1-based, 1=우승)
	MemberCount   int       `json:"memberCount"`
	SurvivalTime  float64   `json:"survivalTimeSec"` // BR 시작 이후 생존 시간 (초)
}

// ── 개인 기여 점수 ──

// PlayerContribution은 개인 기여 점수를 나타낸다.
type PlayerContribution struct {
	PlayerId     string  `json:"playerId"`
	PlayerName   string  `json:"playerName"`
	FactionId    string  `json:"factionId"`
	Kills        int     `json:"kills"`
	Assists      int     `json:"assists"`
	ResourceGathered int `json:"resourceGathered"` // 자원 채취량
	SurvivalTime float64 `json:"survivalTimeSec"` // 개인 생존 시간 (초)
	Score        float64 `json:"score"`           // 종합 기여 점수
}

// ── 승리 결과 ──

// BRVictoryResult는 배틀로얄 최종 결과를 나타낸다.
type BRVictoryResult struct {
	// 승리 팩션 정보
	WinnerFactionId   string `json:"winnerFactionId"`
	WinnerFactionName string `json:"winnerFactionName"`
	WinnerColor       string `json:"winnerColor"`

	// 팩션별 순위
	Rankings []FactionEliminationRecord `json:"rankings"`

	// 순위별 보상
	Rewards []FactionReward `json:"rewards"`

	// 개인 기여 (상위 10명)
	TopContributors []PlayerContribution `json:"topContributors"`

	// 라운드 정보
	RoundNumber  int       `json:"roundNumber"`
	RegionId     string    `json:"regionId"`
	BRDuration   float64   `json:"brDurationSec"`
	CompletedAt  time.Time `json:"completedAt"`
	EarlyFinish  bool      `json:"earlyFinish"` // 시간 만료 전 종료 여부
}

// FactionReward는 팩션별 보상 정보를 담는다.
type FactionReward struct {
	FactionId   string  `json:"factionId"`
	FactionName string  `json:"factionName"`
	Rank        int     `json:"rank"`
	RP          int     `json:"rp"`           // Region Point 보상
	RewardRatio float64 `json:"rewardRatio"`  // 보상 비율 (1.0 = 100%)
	Gold        int     `json:"gold"`         // Gold 보상
}

// ── 관전 요청 ──

// SpectateTarget은 관전 대상 정보를 담는다.
type SpectateTarget struct {
	PlayerId  string `json:"playerId"`
	FactionId string `json:"factionId"`
}

// ── 전멸 이벤트 ──

// EliminationEventType은 전멸 관련 이벤트 분류이다.
type EliminationEventType string

const (
	ElimEvtFactionEliminated EliminationEventType = "faction_eliminated"
	ElimEvtRoundEndEarly     EliminationEventType = "round_end_early"
	ElimEvtVictory           EliminationEventType = "br_victory"
	ElimEvtSpectateSwitch    EliminationEventType = "spectate_switch"
)

// EliminationEvent는 전멸 관련 이벤트 데이터이다.
type EliminationEvent struct {
	Type     EliminationEventType `json:"type"`
	Data     interface{}          `json:"data"`
}

// ── BREliminationSystem ──

// BREliminationSystem은 배틀로얄 팩션 전멸 및 승리를 관리한다.
type BREliminationSystem struct {
	mu sync.RWMutex

	// 팩션 레지스트리 참조
	factionRegistry *FactionRegistry

	// 전멸 기록 (전멸 순서대로 추가)
	eliminations []FactionEliminationRecord

	// 참가 팩션 목록 (BR 시작 시 초기화)
	participatingFactions map[string]bool

	// 플레이어 생존 상태 (true = 생존)
	playerAlive map[string]bool

	// 개인 기여 추적
	contributions map[string]*PlayerContribution

	// 관전 모드 플레이어 (playerId → spectateTarget)
	spectators map[string]string

	// 이벤트 버퍼
	events []EliminationEvent

	// BR 시작 시각 (생존 시간 계산용)
	brStartTime time.Time

	// 라운드 정보
	roundNumber int
	regionId    string

	// 승리 결과 (라운드 종료 시 설정)
	victoryResult *BRVictoryResult

	// 라운드 종료 콜백
	onRoundEndEarly func()
}

// NewBREliminationSystem은 새로운 전멸 판정 시스템을 생성한다.
func NewBREliminationSystem(
	factionRegistry *FactionRegistry,
) *BREliminationSystem {
	return &BREliminationSystem{
		factionRegistry:       factionRegistry,
		eliminations:          make([]FactionEliminationRecord, 0, 8),
		participatingFactions: make(map[string]bool),
		playerAlive:           make(map[string]bool),
		contributions:         make(map[string]*PlayerContribution),
		spectators:            make(map[string]string),
		events:                make([]EliminationEvent, 0, 8),
	}
}

// SetOnRoundEndEarly는 라운드 조기 종료 콜백을 설정한다.
func (bes *BREliminationSystem) SetOnRoundEndEarly(fn func()) {
	bes.mu.Lock()
	defer bes.mu.Unlock()
	bes.onRoundEndEarly = fn
}

// ── Lifecycle ──

// StartBR은 배틀로얄 시작 시 호출한다. 참가 팩션 및 생존 상태를 초기화한다.
func (bes *BREliminationSystem) StartBR(
	roundNumber int,
	regionId string,
	alivePlayers map[string]bool,
) {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	bes.roundNumber = roundNumber
	bes.regionId = regionId
	bes.brStartTime = time.Now()
	bes.eliminations = bes.eliminations[:0]
	bes.spectators = make(map[string]string)
	bes.events = bes.events[:0]
	bes.victoryResult = nil

	// 플레이어 생존 상태 복사
	bes.playerAlive = make(map[string]bool, len(alivePlayers))
	for pid, alive := range alivePlayers {
		bes.playerAlive[pid] = alive
	}

	// 참가 팩션 식별
	bes.participatingFactions = make(map[string]bool)
	for pid, alive := range alivePlayers {
		if !alive {
			continue
		}
		fid := bes.factionRegistry.GetFactionId(pid)
		if fid != "" {
			bes.participatingFactions[fid] = true
		}
	}

	// 개인 기여 초기화
	bes.contributions = make(map[string]*PlayerContribution, len(alivePlayers))
	for pid := range alivePlayers {
		fid := bes.factionRegistry.GetFactionId(pid)
		bes.contributions[pid] = &PlayerContribution{
			PlayerId:  pid,
			FactionId: fid,
		}
	}

	slog.Info("BR elimination system started",
		"round", roundNumber,
		"region", regionId,
		"factions", len(bes.participatingFactions),
		"players", len(alivePlayers),
	)
}

// Reset은 시스템을 초기화한다 (라운드 사이 호출).
func (bes *BREliminationSystem) Reset() {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	bes.eliminations = bes.eliminations[:0]
	bes.participatingFactions = make(map[string]bool)
	bes.playerAlive = make(map[string]bool)
	bes.contributions = make(map[string]*PlayerContribution)
	bes.spectators = make(map[string]string)
	bes.events = bes.events[:0]
	bes.victoryResult = nil
}

// ── 플레이어 사망 처리 ──

// OnPlayerDeath은 BR 중 플레이어 사망을 처리한다.
// 팩션 전멸 여부를 확인하고, 최후 1팩션이면 라운드 종료 신호를 보낸다.
// 반환: (전멸된 팩션 ID, 라운드 즉시 종료 여부)
func (bes *BREliminationSystem) OnPlayerDeath(
	playerId string,
	killerPlayerId string,
) (eliminatedFactionId string, roundShouldEnd bool) {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	// 생존 상태 업데이트
	bes.playerAlive[playerId] = false

	// 개인 생존 시간 기록
	if contrib, ok := bes.contributions[playerId]; ok {
		contrib.SurvivalTime = time.Since(bes.brStartTime).Seconds()
	}

	// 킬러 기여 점수 기록
	if killerPlayerId != "" {
		if contrib, ok := bes.contributions[killerPlayerId]; ok {
			contrib.Kills++
		}
	}

	// 팩션 전멸 체크
	factionId := bes.factionRegistry.GetFactionId(playerId)
	if factionId == "" {
		return "", false
	}

	// 해당 팩션에 살아있는 멤버가 있는지 확인
	members := bes.factionRegistry.GetFactionMembers(factionId)
	aliveCount := 0
	for _, m := range members {
		if bes.playerAlive[m] {
			aliveCount++
		}
	}

	if aliveCount > 0 {
		return "", false // 아직 생존자 있음
	}

	// 팩션 전멸 처리
	survivalTime := time.Since(bes.brStartTime).Seconds()
	record := FactionEliminationRecord{
		FactionId:    factionId,
		FactionName:  bes.factionRegistry.GetFactionName(factionId),
		Color:        bes.factionRegistry.GetFactionColor(factionId),
		EliminatedAt: time.Now(),
		MemberCount:  len(members),
		SurvivalTime: survivalTime,
	}
	bes.eliminations = append(bes.eliminations, record)

	// 전멸된 팩션의 모든 멤버를 관전 모드로 전환
	spectateTarget := bes.findSpectateTarget(factionId)
	for _, m := range members {
		if spectateTarget != "" {
			bes.spectators[m] = spectateTarget
		}
	}

	bes.events = append(bes.events, EliminationEvent{
		Type: ElimEvtFactionEliminated,
		Data: record,
	})

	slog.Info("faction eliminated",
		"faction", factionId,
		"name", record.FactionName,
		"survival", survivalTime,
		"eliminated_order", len(bes.eliminations),
	)

	// 생존 팩션 수 확인
	aliveFactions := bes.countAliveFactions()

	if aliveFactions <= 1 {
		// 최후 1팩션 → 라운드 즉시 종료
		bes.finalizeVictory()
		roundShouldEnd = true

		bes.events = append(bes.events, EliminationEvent{
			Type: ElimEvtRoundEndEarly,
			Data: map[string]interface{}{
				"roundNumber": bes.roundNumber,
				"reason":      "last_faction_standing",
			},
		})

		// 콜백 호출 (잠금 해제 후)
		if bes.onRoundEndEarly != nil {
			go bes.onRoundEndEarly()
		}
	}

	return factionId, roundShouldEnd
}

// ── 어시스트 기록 ──

// RecordAssist는 어시스트를 개인 기여에 추가한다.
func (bes *BREliminationSystem) RecordAssist(playerId string) {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	if contrib, ok := bes.contributions[playerId]; ok {
		contrib.Assists++
	}
}

// RecordResourceGather는 자원 채취를 개인 기여에 추가한다.
func (bes *BREliminationSystem) RecordResourceGather(playerId string, amount int) {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	if contrib, ok := bes.contributions[playerId]; ok {
		contrib.ResourceGathered += amount
	}
}

// ── 승리 판정 ──

func (bes *BREliminationSystem) countAliveFactions() int {
	aliveFactions := make(map[string]bool)
	for pid, alive := range bes.playerAlive {
		if !alive {
			continue
		}
		fid := bes.factionRegistry.GetFactionId(pid)
		if fid != "" {
			aliveFactions[fid] = true
		}
	}
	return len(aliveFactions)
}

func (bes *BREliminationSystem) findSpectateTarget(excludeFaction string) string {
	// 생존 중인 다른 팩션의 플레이어를 찾아 관전 대상으로 반환
	for pid, alive := range bes.playerAlive {
		if !alive {
			continue
		}
		fid := bes.factionRegistry.GetFactionId(pid)
		if fid != excludeFaction {
			return pid
		}
	}
	return ""
}

// finalizeVictory는 최종 순위를 확정하고 보상을 계산한다.
func (bes *BREliminationSystem) finalizeVictory() {
	// 생존 팩션 찾기
	aliveFactions := make(map[string]bool)
	for pid, alive := range bes.playerAlive {
		if !alive {
			continue
		}
		fid := bes.factionRegistry.GetFactionId(pid)
		if fid != "" {
			aliveFactions[fid] = true
		}
	}

	totalFactions := len(bes.eliminations) + len(aliveFactions)

	// 순위 계산: 전멸 순서 역순
	// 먼저 전멸 = 낮은 순위 (마지막 전멸 = 2위, 생존 = 1위)
	rankings := make([]FactionEliminationRecord, 0, totalFactions)

	// 생존 팩션 = 1위 (여러 팩션 생존 시 동률)
	rank := 1
	for fid := range aliveFactions {
		rankings = append(rankings, FactionEliminationRecord{
			FactionId:    fid,
			FactionName:  bes.factionRegistry.GetFactionName(fid),
			Color:        bes.factionRegistry.GetFactionColor(fid),
			Rank:         rank,
			MemberCount:  bes.factionRegistry.GetFactionMemberCount(fid),
			SurvivalTime: time.Since(bes.brStartTime).Seconds(),
		})
	}
	rank += len(aliveFactions)

	// 전멸된 팩션: 역순으로 순위 부여
	for i := len(bes.eliminations) - 1; i >= 0; i-- {
		elim := bes.eliminations[i]
		elim.Rank = rank
		rankings = append(rankings, elim)
		rank++
	}

	// 순위순 정렬
	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Rank < rankings[j].Rank
	})

	// 보상 계산
	rewards := make([]FactionReward, 0, len(rankings))
	for _, r := range rankings {
		rp, ratio := getRewardByRank(r.Rank)
		gold := int(float64(100) * ratio) // 기본 Gold 100 × 비율
		rewards = append(rewards, FactionReward{
			FactionId:   r.FactionId,
			FactionName: r.FactionName,
			Rank:        r.Rank,
			RP:          rp,
			RewardRatio: ratio,
			Gold:        gold,
		})
	}

	// 개인 기여 점수 계산 및 정렬
	topContributors := bes.calcTopContributors()

	// 승리 결과 구성
	winnerFactionId := ""
	winnerFactionName := ""
	winnerColor := ""
	if len(rankings) > 0 {
		winnerFactionId = rankings[0].FactionId
		winnerFactionName = rankings[0].FactionName
		winnerColor = rankings[0].Color
	}

	bes.victoryResult = &BRVictoryResult{
		WinnerFactionId:   winnerFactionId,
		WinnerFactionName: winnerFactionName,
		WinnerColor:       winnerColor,
		Rankings:          rankings,
		Rewards:           rewards,
		TopContributors:   topContributors,
		RoundNumber:       bes.roundNumber,
		RegionId:          bes.regionId,
		BRDuration:        time.Since(bes.brStartTime).Seconds(),
		CompletedAt:       time.Now(),
		EarlyFinish:       true,
	}

	bes.events = append(bes.events, EliminationEvent{
		Type: ElimEvtVictory,
		Data: bes.victoryResult,
	})

	slog.Info("BR victory finalized",
		"winner", winnerFactionId,
		"winnerName", winnerFactionName,
		"totalFactions", totalFactions,
		"duration", bes.victoryResult.BRDuration,
	)
}

// FinalizeOnTimeout은 BR 시간 만료 시 승리를 판정한다 (생존자 기준 순위).
func (bes *BREliminationSystem) FinalizeOnTimeout() *BRVictoryResult {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	// 이미 승리 결과가 있으면 반환
	if bes.victoryResult != nil {
		return bes.victoryResult
	}

	bes.finalizeVictory()
	if bes.victoryResult != nil {
		bes.victoryResult.EarlyFinish = false
	}
	return bes.victoryResult
}

// ── 보상 계산 헬퍼 ──

func getRewardByRank(rank int) (rp int, ratio float64) {
	switch rank {
	case 1:
		return VictoryRP1st, VictoryReward1st
	case 2:
		return VictoryRP2nd, VictoryReward2nd
	case 3:
		return VictoryRP3rd, VictoryReward3rd
	default:
		// 4위 이하: 1 RP, 10% 보상
		return 1, 0.10
	}
}

func (bes *BREliminationSystem) calcTopContributors() []PlayerContribution {
	contribs := make([]PlayerContribution, 0, len(bes.contributions))
	for _, c := range bes.contributions {
		// 종합 점수: 킬×15 + 어시스트×5 + 자원÷10 + 생존(초)÷10
		c.Score = float64(c.Kills)*15 +
			float64(c.Assists)*5 +
			float64(c.ResourceGathered)/10 +
			c.SurvivalTime/10
		contribs = append(contribs, *c)
	}

	sort.Slice(contribs, func(i, j int) bool {
		return contribs[i].Score > contribs[j].Score
	})

	// 상위 10명
	if len(contribs) > 10 {
		contribs = contribs[:10]
	}
	return contribs
}

// ── 조회 메서드 ──

// GetVictoryResult는 최종 승리 결과를 반환한다.
func (bes *BREliminationSystem) GetVictoryResult() *BRVictoryResult {
	bes.mu.RLock()
	defer bes.mu.RUnlock()
	return bes.victoryResult
}

// GetEliminations는 현재 전멸 기록 목록을 반환한다.
func (bes *BREliminationSystem) GetEliminations() []FactionEliminationRecord {
	bes.mu.RLock()
	defer bes.mu.RUnlock()

	result := make([]FactionEliminationRecord, len(bes.eliminations))
	copy(result, bes.eliminations)
	return result
}

// GetSpectateTarget은 관전 대상 플레이어 ID를 반환한다.
func (bes *BREliminationSystem) GetSpectateTarget(playerId string) string {
	bes.mu.RLock()
	defer bes.mu.RUnlock()
	return bes.spectators[playerId]
}

// IsPlayerSpectating은 플레이어가 관전 모드인지 확인한다.
func (bes *BREliminationSystem) IsPlayerSpectating(playerId string) bool {
	bes.mu.RLock()
	defer bes.mu.RUnlock()
	_, ok := bes.spectators[playerId]
	return ok
}

// GetAliveFactionCount는 생존 팩션 수를 반환한다.
func (bes *BREliminationSystem) GetAliveFactionCount() int {
	bes.mu.RLock()
	defer bes.mu.RUnlock()
	return bes.countAliveFactions()
}

// FlushEvents는 이벤트 버퍼를 반환하고 비운다.
func (bes *BREliminationSystem) FlushEvents() []EliminationEvent {
	bes.mu.Lock()
	defer bes.mu.Unlock()

	if len(bes.events) == 0 {
		return nil
	}
	result := make([]EliminationEvent, len(bes.events))
	copy(result, bes.events)
	bes.events = bes.events[:0]
	return result
}
