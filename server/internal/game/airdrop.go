package game

import (
	"fmt"
	"math"
	"math/rand"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 6 — AirdropSystem: 배틀로얄 에어드롭 파워업 시스템
//
// BR 시작 후 2분마다 세이프존 내 랜덤 위치에 에어드롭 생성.
// 3종 파워업:
//   - weapon_boost: 데미지 +30%, 60초 지속
//   - shield: 무적 5초
//   - speed: 이속 +50%, 30초 지속
//
// 먼저 접촉한 플레이어가 획득 (서버 권위 판정).
// ============================================================

// ── 에어드롭 상수 ──

const (
	// AirdropSpawnInterval은 에어드롭 스폰 간격 (초, BR 시작 기준)
	AirdropSpawnInterval = 120.0 // 2분

	// AirdropPickupRadius는 에어드롭 획득 거리 (px)
	AirdropPickupRadius = 60.0

	// AirdropFallDuration은 낙하 애니메이션 시간 (초)
	AirdropFallDuration = 3.0

	// AirdropLifetime은 에어드롭 존재 시간 (초)
	AirdropLifetime = 90.0

	// AirdropMaxActive는 동시 활성 에어드롭 최대 수
	AirdropMaxActive = 5
)

// ── 파워업 유형 ──

// AirdropPowerupType은 에어드롭 파워업의 종류를 나타낸다.
type AirdropPowerupType string

const (
	PowerupWeaponBoost AirdropPowerupType = "weapon_boost" // 데미지 +30%, 60초
	PowerupShield      AirdropPowerupType = "shield"       // 무적 5초
	PowerupSpeed       AirdropPowerupType = "speed"        // 이속 +50%, 30초
)

// PowerupConfig는 파워업 종류별 설정을 담는다.
type PowerupConfig struct {
	Type     AirdropPowerupType `json:"type"`
	Duration float64            `json:"duration"` // 효과 지속 시간 (초)
	Value    float64            `json:"value"`    // 보정 배율 (0.3 = +30%)
	Weight   int                // 스폰 가중치 (총합 대비 확률)
}

// DefaultPowerupConfigs는 기본 파워업 설정 목록을 반환한다.
var DefaultPowerupConfigs = []PowerupConfig{
	{Type: PowerupWeaponBoost, Duration: 60.0, Value: 0.30, Weight: 40},
	{Type: PowerupShield, Duration: 5.0, Value: 1.0, Weight: 25},
	{Type: PowerupSpeed, Duration: 30.0, Value: 0.50, Weight: 35},
}

// ── 에어드롭 상태 ──

// AirdropState는 에어드롭 인스턴스의 상태를 나타낸다.
type AirdropState string

const (
	AirdropFalling  AirdropState = "falling"  // 낙하 중
	AirdropLanded   AirdropState = "landed"   // 착지 (획득 가능)
	AirdropPickedUp AirdropState = "picked_up" // 획득 완료
	AirdropExpired  AirdropState = "expired"  // 시간 만료
)

// ── 에어드롭 인스턴스 ──

// Airdrop은 맵에 생성된 에어드롭 아이템을 나타낸다.
type Airdrop struct {
	Id          string             `json:"id"`
	Position    domain.Position    `json:"position"`
	PowerupType AirdropPowerupType `json:"powerupType"`
	Config      PowerupConfig      `json:"config"`
	State       AirdropState       `json:"state"`
	SpawnedAt   float64            `json:"spawnedAt"`   // BR 경과 시간 기준 (초)
	Lifetime    float64            `json:"lifetime"`    // 남은 수명 (초)
	FallTimer   float64            `json:"fallTimer"`   // 낙하 타이머 (초)
	PickedUpBy  string             `json:"pickedUpBy,omitempty"`
}

// ── 활성 파워업 (플레이어별) ──

// ActivePowerup은 플레이어에게 적용 중인 파워업 효과를 나타낸다.
type ActivePowerup struct {
	Type      AirdropPowerupType `json:"type"`
	Value     float64            `json:"value"`     // 보정 배율
	Remaining float64            `json:"remaining"` // 남은 시간 (초)
	Duration  float64            `json:"duration"`  // 총 지속 시간
}

// ── 에어드롭 이벤트 ──

// AirdropEventType은 에어드롭 관련 이벤트 분류이다.
type AirdropEventType string

const (
	AirdropEvtSpawned  AirdropEventType = "airdrop_spawned"
	AirdropEvtLanded   AirdropEventType = "airdrop_landed"
	AirdropEvtPickedUp AirdropEventType = "airdrop_picked_up"
	AirdropEvtExpired  AirdropEventType = "airdrop_expired"
)

// AirdropEvent는 에어드롭 이벤트 데이터이다.
type AirdropEvent struct {
	Type     AirdropEventType `json:"type"`
	Airdrop  *Airdrop         `json:"airdrop"`
	PlayerId string           `json:"playerId,omitempty"`
}

// ── AirdropSystem ──

// AirdropSystem은 배틀로얄 에어드롭을 관리하는 시스템이다.
type AirdropSystem struct {
	mu sync.RWMutex

	// 에어드롭 목록 (활성)
	airdrops map[string]*Airdrop

	// 플레이어별 활성 파워업
	playerPowerups map[string][]*ActivePowerup

	// 설정
	configs       []PowerupConfig
	totalWeight   int
	spawnInterval float64
	nextSpawnAt   float64 // 다음 에어드롭 스폰 시간 (BR 경과 기준)
	arenaSize     float64

	// 세이프존 참조 (스폰 위치 제한)
	safeZoneCenterX float64
	safeZoneCenterY float64
	safeZoneRadius  float64

	// 이벤트 버퍼
	events []AirdropEvent

	// 카운터
	nextId int
}

// NewAirdropSystem은 새로운 에어드롭 시스템을 생성한다.
func NewAirdropSystem(arenaSize float64) *AirdropSystem {
	totalWeight := 0
	for _, c := range DefaultPowerupConfigs {
		totalWeight += c.Weight
	}

	half := arenaSize / 2
	return &AirdropSystem{
		airdrops:        make(map[string]*Airdrop),
		playerPowerups:  make(map[string][]*ActivePowerup),
		configs:         DefaultPowerupConfigs,
		totalWeight:     totalWeight,
		spawnInterval:   AirdropSpawnInterval,
		nextSpawnAt:     AirdropSpawnInterval, // 첫 스폰: BR 시작 후 2분
		arenaSize:       arenaSize,
		safeZoneCenterX: half,
		safeZoneCenterY: half,
		safeZoneRadius:  half,
		events:          make([]AirdropEvent, 0, 8),
		nextId:          0,
	}
}

// ── Lifecycle ──

// Reset은 에어드롭 시스템을 초기화한다 (라운드 시작 시 호출).
func (as *AirdropSystem) Reset() {
	as.mu.Lock()
	defer as.mu.Unlock()

	as.airdrops = make(map[string]*Airdrop)
	as.playerPowerups = make(map[string][]*ActivePowerup)
	as.nextSpawnAt = as.spawnInterval
	as.events = as.events[:0]
	as.nextId = 0
}

// UpdateSafeZone은 세이프존 상태를 업데이트한다 (에어드롭 스폰 범위 제한).
func (as *AirdropSystem) UpdateSafeZone(cx, cy, radius float64) {
	as.mu.Lock()
	defer as.mu.Unlock()

	as.safeZoneCenterX = cx
	as.safeZoneCenterY = cy
	as.safeZoneRadius = radius
}

// ── Tick (20Hz) ──

// Tick은 에어드롭 시스템을 업데이트한다 (20Hz 호출).
func (as *AirdropSystem) Tick(brElapsedSec float64, dt float64) {
	as.mu.Lock()
	defer as.mu.Unlock()

	as.events = as.events[:0]

	// 1. 에어드롭 스폰 체크
	if brElapsedSec >= as.nextSpawnAt && len(as.airdrops) < AirdropMaxActive {
		as.spawnAirdrop(brElapsedSec)
		as.nextSpawnAt += as.spawnInterval
	}

	// 2. 기존 에어드롭 업데이트
	for id, ad := range as.airdrops {
		switch ad.State {
		case AirdropFalling:
			ad.FallTimer -= dt
			if ad.FallTimer <= 0 {
				ad.State = AirdropLanded
				ad.FallTimer = 0
				as.events = append(as.events, AirdropEvent{
					Type:    AirdropEvtLanded,
					Airdrop: ad,
				})
			}
		case AirdropLanded:
			ad.Lifetime -= dt
			if ad.Lifetime <= 0 {
				ad.State = AirdropExpired
				as.events = append(as.events, AirdropEvent{
					Type:    AirdropEvtExpired,
					Airdrop: ad,
				})
				delete(as.airdrops, id)
			}
		case AirdropPickedUp, AirdropExpired:
			delete(as.airdrops, id)
		}
	}

	// 3. 플레이어 파워업 타이머 감소
	for pid, powerups := range as.playerPowerups {
		active := powerups[:0]
		for _, p := range powerups {
			p.Remaining -= dt
			if p.Remaining > 0 {
				active = append(active, p)
			}
		}
		if len(active) == 0 {
			delete(as.playerPowerups, pid)
		} else {
			as.playerPowerups[pid] = active
		}
	}
}

// ── 에어드롭 스폰 ──

func (as *AirdropSystem) spawnAirdrop(brElapsedSec float64) {
	// 랜덤 파워업 선택 (가중치 기반)
	config := as.pickRandomPowerup()

	// 세이프존 내 랜덤 위치 생성
	pos := as.randomPositionInSafeZone()

	as.nextId++
	id := fmt.Sprintf("ad_%d", as.nextId)

	airdrop := &Airdrop{
		Id:          id,
		Position:    pos,
		PowerupType: config.Type,
		Config:      config,
		State:       AirdropFalling,
		SpawnedAt:   brElapsedSec,
		Lifetime:    AirdropLifetime,
		FallTimer:   AirdropFallDuration,
	}

	as.airdrops[id] = airdrop
	as.events = append(as.events, AirdropEvent{
		Type:    AirdropEvtSpawned,
		Airdrop: airdrop,
	})
}

func (as *AirdropSystem) pickRandomPowerup() PowerupConfig {
	r := rand.Intn(as.totalWeight)
	cumulative := 0
	for _, c := range as.configs {
		cumulative += c.Weight
		if r < cumulative {
			return c
		}
	}
	return as.configs[0] // fallback
}

func (as *AirdropSystem) randomPositionInSafeZone() domain.Position {
	// 세이프존 내 랜덤 위치 (원형 범위 내)
	radius := as.safeZoneRadius * 0.8 // 세이프존 경계에서 약간 내부
	if radius < 100 {
		radius = 100
	}

	angle := rand.Float64() * 2 * math.Pi
	dist := math.Sqrt(rand.Float64()) * radius // 균일 분포

	x := as.safeZoneCenterX + math.Cos(angle)*dist
	y := as.safeZoneCenterY + math.Sin(angle)*dist

	// 아레나 경계 클램핑
	margin := 100.0
	x = math.Max(margin, math.Min(as.arenaSize-margin, x))
	y = math.Max(margin, math.Min(as.arenaSize-margin, y))

	return domain.Position{X: x, Y: y}
}

// ── 에어드롭 획득 ──

// TryPickup은 플레이어가 에어드롭에 접촉했는지 확인하고 획득 처리한다.
// 반환: 획득한 에어드롭 (nil이면 획득 실패)
func (as *AirdropSystem) TryPickup(playerId string, playerPos domain.Position) *Airdrop {
	as.mu.Lock()
	defer as.mu.Unlock()

	for _, ad := range as.airdrops {
		if ad.State != AirdropLanded {
			continue
		}

		dx := playerPos.X - ad.Position.X
		dy := playerPos.Y - ad.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)

		if dist <= AirdropPickupRadius {
			ad.State = AirdropPickedUp
			ad.PickedUpBy = playerId

			// 파워업 적용
			powerup := &ActivePowerup{
				Type:      ad.PowerupType,
				Value:     ad.Config.Value,
				Remaining: ad.Config.Duration,
				Duration:  ad.Config.Duration,
			}

			as.playerPowerups[playerId] = append(as.playerPowerups[playerId], powerup)

			as.events = append(as.events, AirdropEvent{
				Type:     AirdropEvtPickedUp,
				Airdrop:  ad,
				PlayerId: playerId,
			})

			return ad
		}
	}

	return nil
}

// ── 파워업 효과 조회 ──

// GetDamageMultiplier는 플레이어의 weapon_boost 데미지 배율을 반환한다.
// 기본값 1.0, weapon_boost 보유 시 1.3.
func (as *AirdropSystem) GetDamageMultiplier(playerId string) float64 {
	as.mu.RLock()
	defer as.mu.RUnlock()

	powerups := as.playerPowerups[playerId]
	for _, p := range powerups {
		if p.Type == PowerupWeaponBoost && p.Remaining > 0 {
			return 1.0 + p.Value
		}
	}
	return 1.0
}

// IsShielded는 플레이어가 shield(무적) 상태인지 확인한다.
func (as *AirdropSystem) IsShielded(playerId string) bool {
	as.mu.RLock()
	defer as.mu.RUnlock()

	powerups := as.playerPowerups[playerId]
	for _, p := range powerups {
		if p.Type == PowerupShield && p.Remaining > 0 {
			return true
		}
	}
	return false
}

// GetSpeedMultiplier는 플레이어의 이동속도 배율을 반환한다.
// 기본값 1.0, speed 보유 시 1.5.
func (as *AirdropSystem) GetSpeedMultiplier(playerId string) float64 {
	as.mu.RLock()
	defer as.mu.RUnlock()

	powerups := as.playerPowerups[playerId]
	for _, p := range powerups {
		if p.Type == PowerupSpeed && p.Remaining > 0 {
			return 1.0 + p.Value
		}
	}
	return 1.0
}

// GetActivePowerups는 플레이어의 활성 파워업 목록을 반환한다.
func (as *AirdropSystem) GetActivePowerups(playerId string) []*ActivePowerup {
	as.mu.RLock()
	defer as.mu.RUnlock()

	powerups := as.playerPowerups[playerId]
	result := make([]*ActivePowerup, len(powerups))
	for i, p := range powerups {
		cp := *p
		result[i] = &cp
	}
	return result
}

// ── 직렬화 (클라이언트 전송용) ──

// GetActiveAirdrops는 클라이언트 전송용 에어드롭 목록을 반환한다.
func (as *AirdropSystem) GetActiveAirdrops() []*Airdrop {
	as.mu.RLock()
	defer as.mu.RUnlock()

	result := make([]*Airdrop, 0, len(as.airdrops))
	for _, ad := range as.airdrops {
		cp := *ad
		result = append(result, &cp)
	}
	return result
}

// FlushEvents는 이벤트 버퍼를 반환하고 비운다.
func (as *AirdropSystem) FlushEvents() []AirdropEvent {
	as.mu.Lock()
	defer as.mu.Unlock()

	if len(as.events) == 0 {
		return nil
	}
	result := make([]AirdropEvent, len(as.events))
	copy(result, as.events)
	as.events = as.events[:0]
	return result
}

// RemovePlayer는 플레이어 퇴장 시 파워업을 정리한다.
func (as *AirdropSystem) RemovePlayer(playerId string) {
	as.mu.Lock()
	defer as.mu.Unlock()

	delete(as.playerPowerups, playerId)
}
