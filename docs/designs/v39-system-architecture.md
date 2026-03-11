# SYSTEM ARCHITECTURE: v39 — 팩션 기반 영토 지배 시스템

> 상세 시스템 아키텍처 — C4 Level 2-3, API Spec, Data Model, Migration Strategy
> 기반 문서: `v39-faction-territory-plan.md` (1,068줄), `v39-verification-report.md` (27건 이슈)
> 작성일: 2026-03-11

---

## 1. Overview

v39 팩션 기반 영토 지배 시스템은 기존 v33 Online Matrix Engine 위에 **지역 분할 아레나**, **15분 라운드 사이클**, **팩션 팀 PvP**, **영토 지배 정산** 레이어를 추가하는 확장이다.

### 핵심 변경 요약

| 기존 (v33~v37) | v39 |
|----------------|-----|
| EpochManager (10m15s, 6페이즈) | **RoundEngine** (15m, 3페이즈: PvE→BR→Settlement) |
| CountryArena (국가=아레나 1:1) | **RegionArena** (국가 1개 = 3~7개 지역 아레나) |
| 개인 PvP (War 페이즈) | **팩션 기반 배틀로얄** (같은 팩션 공격 면역) |
| DominationEngine (6에폭 평가) | **TerritoryEngine** (일일 정산 UTC 00:00) |
| 범용 XP/Orb 파밍 | **국가별 고유 자원** 채취 + 팩션 경제 |

### 설계 원칙

1. **하위 호환**: 기존 MatrixEngine, KillValidator, OnlineSyncSystem 인터페이스를 최대한 유지
2. **점진적 마이그레이션**: EpochManager를 폐기(deprecate)하되, RoundEngine이 동일 인터페이스를 구현
3. **서버 권위**: 모든 팩션 면역/영토 판정은 서버에서 수행, 클라이언트는 표시만
4. **Lazy Init**: 플레이어 없는 지역 아레나는 메모리에서 해제 (60초 유휴 후)

---

## 2. Goals / Non-Goals

### Goals

1. 국가를 3~7개 지역으로 분할하여 각 지역이 독립적인 RegionArena로 동작
2. 15분 라운드 사이클 (PvE 600s → BR 300s → Settlement 15s) 구현
3. 팩션 기반 PvP — 같은 팩션 멤버 간 데미지/킬 면역
4. 일일 지배 정산 — RP(Region Points) 기반 지배 판정 + Sovereignty Escalation Ladder
5. 국가별 고유 자원 스폰/채취/팩션 국고 연결
6. 기존 v33 EpochManager → RoundEngine 점진적 마이그레이션
7. 검증 보고서 27건 이슈 해결 (Critical 6건 + High 7건 우선)

### Non-Goals

1. v39에서 Cross-Arena Invasion 구현 (전쟁 선포 시 다른 국가 원정 → v41 이후)
2. 3D 지역 선택 UI 구현 (2D RegionSelector 패널 우선, 3D Globe 통합은 v40)
3. 팩션 간 실시간 자원 교역 DEX (v42 이후)
4. AI Agent 팩션 자동 전략 (v43 이후)
5. 모바일 전용 UI 최적화 (기존 반응형 레이아웃으로 대응)

---

## 3. Architecture — C4 Level 2 (Container Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Next.js / R3F)                      │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐│
│  │GlobeScene │→│RegionSelector│→│ MatrixCanvas  │  │  HUD/UI  ││
│  │(3D Globe) │  │  (2D Panel)  │  │(RegionArena) │  │(Round/   ││
│  └──────────┘  └──────────────┘  └──────┬───────┘  │ Territory)││
│                                         │           └──────────┘│
│  ┌──────────────────────────────────────┴────────────────────┐  │
│  │              useMatrixSocket (WebSocket Client)            │  │
│  │  matrix_join_region / matrix_region_state / matrix_round_* │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │ WSS (20Hz state, 1Hz territory)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Go / Gorilla WS)                      │
│                                                                 │
│  ┌───────────┐     ┌──────────────────────────────────────┐    │
│  │  WSHub     │────→│        MatrixEngine (확장)            │    │
│  │(protocol)  │     │                                      │    │
│  └───────────┘     │  ┌────────────┐  ┌────────────────┐  │    │
│                     │  │RoundEngine │  │ FactionCombat  │  │    │
│                     │  │(15m cycle) │  │ System         │  │    │
│                     │  └──────┬─────┘  └────────────────┘  │    │
│                     │         │                             │    │
│                     │  ┌──────▼──────────────────────────┐  │    │
│                     │  │     RegionArenaManager           │  │    │
│                     │  │  ┌─────────┐  ┌─────────┐       │  │    │
│                     │  │  │Region-1 │  │Region-N │ ...   │  │    │
│                     │  │  │(Arena)  │  │(Arena)  │       │  │    │
│                     │  │  └─────────┘  └─────────┘       │  │    │
│                     │  └─────────────────────────────────┘  │    │
│                     │                                      │    │
│                     │  ┌────────────┐  ┌────────────────┐  │    │
│                     │  │Territory   │  │ Resource       │  │    │
│                     │  │Engine      │  │ Spawner        │  │    │
│                     │  └────────────┘  └────────────────┘  │    │
│                     └──────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Supabase   │  │  Redis    │  │ Faction  │  │ Sovereignty│  │
│  │ (persist)  │  │ (cache)   │  │ Manager  │  │ Engine     │  │
│  └────────────┘  └───────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Container 역할 요약

| Container | 기술 | 역할 |
|-----------|------|------|
| **GlobeScene** | R3F + three-globe | 3D 지구본 — 국가 선택, 팩션 영토 시각화 |
| **RegionSelector** | React + shadcn/ui | 국가 내 지역 선택 패널 (2D, 지역 상태/인원 표시) |
| **MatrixCanvas** | Canvas 2D | RegionArena 게임 렌더링 (기존 아키텍처 재사용) |
| **useMatrixSocket** | WebSocket | 서버 통신 — `matrix_*` 네이밍 컨벤션 유지 |
| **WSHub** | Gorilla WebSocket | 클라이언트 연결 관리, 프로토콜 라우팅 |
| **MatrixEngine** | Go | 기존 엔진 확장 — RoundEngine, RegionArena 통합 |
| **RoundEngine** | Go | 15분 라운드 사이클 관리 (EpochManager 대체) |
| **RegionArenaManager** | Go | 국가별 지역 아레나 Lazy Init/Teardown |
| **FactionCombatSystem** | Go | 팩션 면역 검사, 데미지 매트릭스 |
| **TerritoryEngine** | Go | RP 누적, 일일 정산, Sovereignty Ladder |
| **ResourceSpawner** | Go | 국가별 고유 자원 노드 스폰/채취 관리 |
| **Supabase** | PostgreSQL | 영토 상태, 팩션 데이터, 시즌 데이터 영속화 |
| **Redis** | In-memory | 실시간 RP 캐시, 지역 상태, 팩션 온라인 멤버 |

---

## 4. Component Design — C4 Level 3

### 4.1 RoundEngine (신규)

**파일**: `server/internal/game/round_engine.go`
**대체 대상**: `server/internal/game/epoch.go` (EpochManager)

RoundEngine은 EpochManager를 **완전 대체**한다. 기존 EpochManager의 인터페이스(`IEpochManager`)를 구현하되, 내부 타이밍과 페이즈 정의를 v39 라운드 사이클로 변경한다.

```go
// IEpochManager — 기존 인터페이스 (하위 호환용)
type IEpochManager interface {
    Tick(dt float64)
    GetPhase() string
    GetCountdown() float64
    IsPvPEnabled() bool
    GetOrbMultiplier() float64
    Reset()
}

// RoundEngine — v39 15분 라운드 사이클
type RoundEngine struct {
    phase         RoundPhase    // 현재 페이즈
    elapsed       float64       // 현재 페이즈 경과 시간
    roundNumber   int           // 현재 라운드 번호
    roundStartAt  time.Time     // 라운드 시작 시각
    config        RoundConfig   // 라운드 설정
    callbacks     RoundCallbacks
    safeZone      *BRSafeZone   // BR 페이즈 세이프존
}

// RoundPhase — 3개 페이즈 (기존 6개 → 3개로 단순화)
type RoundPhase string
const (
    PhasePvE        RoundPhase = "pve"        // 600초 (10분)
    PhaseBR         RoundPhase = "br"         // 300초 (5분)
    PhaseSettlement RoundPhase = "settlement" // 15초
)

// RoundConfig — 라운드 설정 (런타임 변경 가능)
type RoundConfig struct {
    PvEDuration        float64 // 600.0 (초)
    BRDuration         float64 // 300.0 (초)
    SettlementDuration float64 // 15.0 (초)
    BRSubPhases        []BRSubPhase // BR 내부 sub-phase (v37 Match Phase 통합)
}

// BRSubPhase — BR 내부 서브 페이즈 (v37 Match Phase 통합, H-04 해결)
type BRSubPhase struct {
    Name          string  // "skirmish" | "engagement" | "final_battle"
    Duration      float64 // 초
    GoldMultiplier float64
    ScoreMultiplier float64
    SafeZonePhase  int    // 세이프존 수축 단계
}
```

**BR SubPhase 기본값** (H-04 해결):
| Sub-Phase | 시간 | Gold 배율 | Score 배율 | 세이프존 |
|-----------|------|----------|-----------|---------|
| Skirmish | 0~90s | x1.0 | x1.0 | Phase 1 (경고) |
| Engagement | 90~210s | x1.5 | x1.5 | Phase 2 (수축) |
| Final Battle | 210~300s | x2.5 | x3.0 | Phase 3+4 (급수축) |

**EpochManager → RoundEngine 변환표** (C-01, H-05 해결):
| EpochManager | RoundEngine | 비고 |
|-------------|------------|------|
| peace (5분) | pve (10분) | 확장 |
| war_countdown (10초) | pve→br 전환 시 10초 카운트다운 (내부 이벤트) | 유지 |
| war (3분) | br (5분) | 확장 |
| shrink (2분) | br 내 sub-phase로 통합 | 통합 |
| end (5초) | settlement (15초) | 확장 |
| transition (10초) | settlement 후 자동 pve 전환 | 제거 |

**DominationEngine 호환** (H-05 해결):
- 기존 "6에폭(=1시간) 평가" → **폐기**
- v39 일일 정산(UTC 00:00)으로 완전 대체
- TerritoryEngine이 DominationEngine 역할을 흡수

### 4.2 RegionArena (신규)

**파일**: `server/internal/game/region_arena.go`
**확장 대상**: `server/internal/game/country_arena.go` (CountryArena)

RegionArena는 CountryArena를 확장하여 **한 국가 내 여러 지역 아레나**를 관리한다.

```go
// RegionArenaManager — 국가별 지역 아레나 관리
type RegionArenaManager struct {
    countryCode  string                      // "KR", "US" 등
    countryTier  CountryTier                 // S/A/B/C/D
    regions      map[string]*RegionArena     // regionId → 아레나
    roundEngine  *RoundEngine                // 공유 라운드 엔진 (국가 단위)
    resourceConf *CountryResourceConfig      // 국가별 자원 설정
    mu           sync.RWMutex
}

// RegionArena — 개별 지역 아레나
type RegionArena struct {
    regionId     string           // "KR-seoul", "KR-busan" 등
    regionName   string           // "서울", "부산" 등
    arenaSize    int              // px (티어별 차등, C-03 해결)
    maxPlayers   int              // 지역별 최대 인원
    players      map[string]*MatrixPlayer
    factions     map[string]*FactionPresence // factionId → 팩션 현황
    enemies      []*NpcMonster
    resources    []*ResourceNode
    safeZone     *BRSafeZone
    state        RegionState      // idle | active | br | settling
    rpScores     map[string]int   // factionId → 이 라운드 RP
    buildings    []*RegionBuilding
    lastActivity time.Time        // Lazy teardown용
}

// RegionState — 지역 아레나 상태
type RegionState string
const (
    RegionIdle     RegionState = "idle"     // 플레이어 없음 (Lazy 해제 대상)
    RegionActive   RegionState = "active"   // PvE 페이즈 활성
    RegionBR       RegionState = "br"       // 배틀로얄 페이즈
    RegionSettling RegionState = "settling" // 정산 중
)
```

**지역 아레나 크기 (C-03 해결 — 티어별 차등화)**:
| 국가 티어 | 지역 수 | 아레나 크기 (px) | 최대 인원/지역 |
|----------|---------|-----------------|--------------|
| S (8개국) | 7 | 6,000 | 30 |
| A (20개국) | 5 | 5,000 | 25 |
| B (40개국) | 4 | 4,000 | 20 |
| C (80개국) | 3 | 3,000 | 15 |
| D (47개국) | 3 | 2,500 | 10 |

**Lazy Init / Teardown**:
- 첫 플레이어 `matrix_join_region` 시 RegionArena 초기화
- 60초간 플레이어 0명 → 메모리에서 해제 (상태는 Redis에 캐시)
- 재진입 시 Redis 캐시에서 복원

**인원 초과 처리 (M-01 해결)**:
- 지역 아레나 maxPlayers 초과 시 → 대기열(Queue) 진입
- 대기열 5명 이상 → 지역 인스턴스 복제 (Region-1a, Region-1b)
- 인스턴스 간 RP는 합산하여 TerritoryEngine에 보고

### 4.3 FactionCombatSystem (신규)

**파일**: `server/internal/game/faction_combat.go`
**확장 대상**: `server/internal/game/ar_combat.go`, `server/internal/game/matrix_validator.go`

FactionCombatSystem은 기존 KillValidator 파이프라인에 **팩션 면역 검사**를 Step 0으로 추가한다 (M-08 해결).

```go
// FactionCombatSystem — 팩션 기반 데미지 매트릭스
type FactionCombatSystem struct {
    factionRegistry  *FactionRegistry        // 글로벌 팩션 정보
    allianceRegistry *AllianceRegistry       // 동맹 정보
    immunityRules    FactionImmunityRules
}

// FactionImmunityRules — 면역 규칙 (M-02 해결)
type FactionImmunityRules struct {
    SameFactionImmune    bool // true: 같은 팩션 공격 불가
    AllianceImmuneInBR   bool // false: 배틀로얄에서 동맹 면역 없음 (M-02)
    AllianceImmuneInPvE  bool // true: PvE 중 동맹 면역 유지
    MaxAlliancesPerFaction int // 2: 동맹 최대 2개 팩션 (M-02)
}

// ValidateKill — KillValidator Step 0 (팩션 검사)
func (fcs *FactionCombatSystem) ValidateKill(
    killerId, targetId string,
    phase RoundPhase,
) (bool, string) {
    killerFaction := fcs.factionRegistry.GetFactionId(killerId)
    targetFaction := fcs.factionRegistry.GetFactionId(targetId)

    // Step 0-a: 같은 팩션 면역
    if killerFaction == targetFaction {
        return false, "same_faction_immune"
    }

    // Step 0-b: PvE 중 동맹 면역
    if phase == PhasePvE && fcs.allianceRegistry.IsAllied(killerFaction, targetFaction) {
        return false, "allied_immune_pve"
    }

    // Step 0-c: BR에서 동맹 면역 없음 (M-02 해결)
    // → 별도 처리 없이 통과

    return true, "" // 나머지 검증은 기존 KillValidator가 처리
}

// DamageMatrix — 팩션 간 데미지 배율
func (fcs *FactionCombatSystem) GetDamageMultiplier(
    attackerFaction, targetFaction string,
    phase RoundPhase,
) float64 {
    if attackerFaction == targetFaction {
        return 0.0 // 아군 데미지 0
    }
    // PvE 페이즈: PvP 데미지 0 (모든 팩션)
    if phase == PhasePvE {
        return 0.0
    }
    return 1.0 // BR 페이즈: 정상 데미지
}
```

**Underdog Boost** (무소속/소규모 팩션 보호, M-04):
```go
type UnderdogBoost struct {
    HPMultiplier  float64 // +30% (1인 팩션)
    DMGMultiplier float64 // +20%
    NPCSupport    int     // 2명 NPC 지원
}

func CalculateUnderdogBoost(factionSize, regionAvgSize int) UnderdogBoost {
    if factionSize >= regionAvgSize {
        return UnderdogBoost{1.0, 1.0, 0}
    }
    ratio := float64(factionSize) / float64(regionAvgSize)
    return UnderdogBoost{
        HPMultiplier:  1.0 + (1.0-ratio)*0.3,  // 최대 +30%
        DMGMultiplier: 1.0 + (1.0-ratio)*0.2,  // 최대 +20%
        NPCSupport:    int(math.Ceil((1.0-ratio) * 3)), // 최대 3명
    }
}
```

**팩션 멤버 상한** (H-02 해결): 팩션당 최대 **50명**
**인원/지역 상한** (M-06): `max(10, total_members / country_region_count)` — `regions_count`는 해당 국가 지역 수

### 4.4 TerritoryEngine (신규)

**파일**: `server/internal/game/territory_engine.go`
**대체 대상**: `server/internal/game/domination.go` (DominationEngine)

TerritoryEngine은 DominationEngine을 **완전 대체**한다. 기존 "6에폭(1시간) 평가" 대신 **일일 정산(UTC 00:00)** 기반 영토 지배 시스템을 구현한다 (C-02, H-05 해결).

```go
// TerritoryEngine — 영토 지배 정산 엔진
type TerritoryEngine struct {
    regionStates    map[string]*RegionTerritoryState  // regionId → 상태
    countryStates   map[string]*CountryTerritoryState  // countryCode → 상태
    dailyScheduler  *DailyScheduler                    // UTC 00:00 정산
    streakTracker   *StreakTracker                      // 연속 지배 추적
    db              *store.Repository
    redis           *cache.Redis
}

// RegionTerritoryState — 지역 영토 상태
type RegionTerritoryState struct {
    RegionId           string
    CountryCode        string
    CurrentController  string    // 현재 지배 팩션 ID (없으면 "")
    DailyRP            map[string]int // factionId → 오늘 누적 RP
    ControlStreak      int       // 연속 지배 일수
    LastSettlementAt   time.Time
    Buildings          []*RegionBuilding
}

// CountryTerritoryState — 국가 영토 상태
type CountryTerritoryState struct {
    CountryCode       string
    CountryTier       CountryTier
    RegionCount       int
    SovereignFaction  string    // 모든 지역 지배 시 주권 팩션
    SovereigntyLevel  SovereigntyLevel
    LastSovereignAt   time.Time
}

// SovereigntyLevel — 주권 에스컬레이션 래더 (C-02 해결)
type SovereigntyLevel string
const (
    SovNone              SovereigntyLevel = "none"
    SovActiveDomination  SovereigntyLevel = "active_domination"  // 일일 정산 1회 지배
    SovSovereignty       SovereigntyLevel = "sovereignty"        // 3일 연속 지배
    SovHegemony          SovereigntyLevel = "hegemony"           // 14일 연속 지배
)
```

**일일 정산 로직**:
```go
func (te *TerritoryEngine) DailySettlement() {
    for regionId, state := range te.regionStates {
        // 1. 최다 RP 팩션 결정
        winnerId, maxRP := "", 0
        for factionId, rp := range state.DailyRP {
            if rp > maxRP { winnerId, maxRP = factionId, rp }
        }

        // 2. 최소 RP 임계값 (100 RP) — 너무 적은 활동으로 지배 방지
        if maxRP < 100 { winnerId = "" }

        // 3. 지배 변경 처리
        if winnerId != state.CurrentController {
            te.onControlChange(regionId, state.CurrentController, winnerId)
            state.ControlStreak = 1
        } else if winnerId != "" {
            state.ControlStreak++
        }

        state.CurrentController = winnerId
        state.DailyRP = make(map[string]int) // 리셋

        // 4. 건물 인수 처리 (M-05 해결)
        for _, building := range state.Buildings {
            if building.OwnerFaction != winnerId {
                building.Active = false // 중립화
                building.ActivationCost = building.OriginalCost / 2 // 50% 비용으로 인수 가능
            }
        }
    }

    // 5. 국가 주권 판정
    for countryCode, cs := range te.countryStates {
        allRegionsControlled := te.checkAllRegionsControlled(countryCode)
        if allRegionsControlled != "" {
            te.updateSovereignty(cs, allRegionsControlled)
        } else {
            cs.SovereignFaction = ""
            cs.SovereigntyLevel = SovNone
        }
    }
}
```

**라운드별 RP 누적** (매 라운드 settlement 페이즈에서 호출):
```go
func (te *TerritoryEngine) OnRoundSettlement(regionId string, results *RoundResult) {
    state := te.regionStates[regionId]
    for _, fr := range results.FactionResults {
        rp := fr.SurvivalRP + fr.KillRP + fr.ResourceRP
        // Underdog 보너스: 소규모 팩션 RP +50%
        if fr.MemberCount <= 3 {
            rp = int(float64(rp) * 1.5)
        }
        state.DailyRP[fr.FactionId] += rp
    }
    // Redis 실시간 업데이트
    te.redis.HSet("territory:daily:"+regionId, state.DailyRP)
}
```

**Sovereignty Escalation Ladder** (C-02 해결):
| 단계 | 조건 | 보상 |
|------|------|------|
| None | - | - |
| Active Domination | 일일 정산 1회 지배 | 지역 자원 수확량 +20% |
| Sovereignty | 3일 연속 일일 정산 지배 | 국가 토큰 +100/일, 건물 할인 30% |
| Hegemony | 14일 연속 | 100 $AWW + 10/멤버, 국가 정책 투표권 |

### 4.5 ResourceSpawner (신규)

**파일**: `server/internal/game/resource_spawner.go`
**확장 대상**: `server/internal/city/resource.go`, `server/internal/game/orb.go`

ResourceSpawner는 기존 Orb(XP 젬) 스폰 시스템을 확장하여 **국가별 고유 자원 노드**를 아레나에 스폰한다.

```go
// ResourceSpawner — 국가별 고유 자원 스폰 관리
type ResourceSpawner struct {
    regionId      string
    countryCode   string
    specialtyType string            // "semiconductor", "oil", "automobile" 등
    nodes         []*ResourceNode
    spawnTimer    float64
    config        ResourceSpawnConfig
}

// ResourceNode — 자원 노드 (아레나 내 채취 가능 오브젝트)
type ResourceNode struct {
    Id           string
    Position     Vector2
    ResourceType string    // 6종 기본 자원 or 특산 자원
    Amount       int       // 남은 채취량
    MaxAmount    int       // 최대 채취량
    RespawnTimer float64   // 재생 타이머
    IsSpecialty  bool      // 국가별 특산 자원 여부
    GatherTime   float64   // 채취 소요 시간 (초)
}

// ResourceSpawnConfig — 스폰 설정
type ResourceSpawnConfig struct {
    BasicNodes       int     // 기본 6종 자원 노드 수 (10~20)
    SpecialtyNodes   int     // 특산 자원 노드 수 (3~5)
    RespawnInterval  float64 // 재생 간격 (120초)
    GatherDuration   float64 // 채취 시간 (3초)
    MaxPerPlayer     int     // 인벤토리 자원 유형별 상한 (H-07 해결)
}
```

**자원 인벤토리 규격** (H-07 해결):
- 인벤토리 상한: **자원 유형별** 50 단위 (합산이 아님)
- PvE 사망 시: 보유 자원의 50% 드롭 (바닥에 ResourcePickup 생성)
- BR 사망 시: 보유 자원 100% 드롭
- **Base Camp (팩션 야영지)**: PvE 중 팩션 야영지(맵 중앙 근처)에서 자원 임시 입금 가능 → BR 전 자원 보호

**국가별 특산 자원 매핑** (예시):
| 국가 | 특산 자원 | 용도 |
|------|----------|------|
| 한국 | 반도체(Semiconductor) | 테크 연구 가속, 건물 업그레이드 비용 -20% |
| 미국 | 석유(Oil) | 군사 작전 비용 -30%, 이동속도 버프 |
| 일본 | 자동차(Automobile) | 생산 효율 +25%, 자원 수확량 +15% |
| 독일 | 정밀기계(Precision) | 무기 데미지 +10%, 건물 내구도 +20% |
| 브라질 | 바이오연료(Biofuel) | HP 재생 +20%, 식량 효율 +30% |

**기존 6종 자원과의 통합** (H-06 해결):
```go
// PlayerInventory — 플레이어 자원 인벤토리
type PlayerInventory struct {
    Basic     ResourceBundle           // 기존 6종 (Gold/Oil/Minerals/Food/Tech/Influence)
    Specialty map[string]int           // 특산 자원 (타입별 최대 50)
    Capacity  int                      // 유형별 상한 (50)
}

// ResourceBundle — 기존 v35 호환
type ResourceBundle struct {
    Gold      int
    Oil       int
    Minerals  int
    Food      int
    Tech      int
    Influence int
}
```

특산 자원은 기존 ResourceBundle에 **별도 필드** (`Specialty map[string]int`)로 추가.
팩션 국고(Treasury)에도 동일하게 `Specialty` 필드를 추가하여 저장.

### 4.6 EpochManager → RoundEngine Migration

**마이그레이션 전략**: EpochManager를 **폐기(deprecate)** 하고 RoundEngine으로 완전 대체 (C-01 해결).

### Phase 1: 인터페이스 추출
```go
// IEpochManager 인터페이스를 epoch.go에서 추출
// RoundEngine이 이 인터페이스를 구현
type IEpochManager interface {
    Tick(dt float64)
    GetPhase() string
    GetCountdown() float64
    IsPvPEnabled() bool
    GetOrbMultiplier() float64
    Reset()
}
```

### Phase 2: RoundEngine 구현
- `round_engine.go`에서 `IEpochManager` 구현
- `GetPhase()`: pve → "peace" 매핑, br → "war" 매핑 (기존 코드 호환)
- `IsPvPEnabled()`: pve → false, br → true

### Phase 3: CountryArena 교체
```go
// country_arena.go 변경
type CountryArena struct {
    // epochManager *EpochManager  // 폐기
    roundEngine  *RoundEngine      // 신규
    regions      *RegionArenaManager // 신규
    // ...
}
```

### Phase 4: 클라이언트 EpochUIBridge 확장
- `epoch-ui-bridge.ts`에 RoundPhase 매핑 추가
- 기존 6개 페이즈 → 3개 페이즈 + BR sub-phase
- `MatrixEpochPhase` 타입에 `"pve" | "br" | "settlement"` 추가

### 영향 분석 (기존 코드)
| 파일 | 변경 | 영향도 |
|------|------|--------|
| `server/internal/game/epoch.go` | Deprecated | High |
| `server/internal/game/country_arena.go` | RoundEngine 주입 | High |
| `server/internal/game/domination.go` | TerritoryEngine으로 대체 | High |
| `server/internal/game/matrix_engine.go` | RegionArena 라우팅 추가 | Medium |
| `server/internal/game/matrix_handler.go` | matrix_join_region 핸들러 추가 | Medium |
| `apps/web/lib/matrix/systems/epoch-ui-bridge.ts` | RoundPhase 매핑 추가 | Medium |
| `apps/web/components/game/matrix/EpochHUD.tsx` | RoundHUD로 교체 | Medium |
| `apps/web/hooks/useMatrixSocket.ts` | 신규 이벤트 구독 추가 | Low |

### 전쟁 시스템과의 관계 (C-06 해결)
- **배틀로얄 PvP** = 자동 PvP (매 라운드, 별도 선포 불필요)
- **전쟁 선포 PvP** = Cross-Arena Invasion (다른 국가 지역 원정, v41 이후)
  - v39에서는 전쟁 선포 시: 해당 국가 내 지역 BR에서 데미지 +10% 보너스만 적용
  - 기존 `server/internal/game/war.go`, `server/internal/game/war_state.go` 유지

### 캡처 포인트 처분 (C-05 해결)
- PvE 페이즈: 캡처 포인트 **자원 노드로 대체** (ResourceNode가 캡처 포인트 역할)
- BR 페이즈: 세이프존 중심에 **Airdrop Zone** (에어드롭 위치) 표시
- 기존 `server/internal/game/capture_point.go` → v39에서 Deprecated
- `apps/web/components/game/matrix/CapturePointUI.tsx` → ResourceNodeUI로 교체

---

## 5. Data Model

### 5.1 Server-Side (Go)

**신규 Go 구조체** (`server/internal/game/region_types.go`):

```go
// ── 지역 정의 (정적 데이터, countries_seed.go 확장) ──

type RegionDef struct {
    RegionId    string      `json:"regionId"`    // "KR-seoul"
    CountryCode string      `json:"countryCode"` // "KR"
    Name        string      `json:"name"`        // "서울"
    NameEn      string      `json:"nameEn"`      // "Seoul"
    ArenaSize   int         `json:"arenaSize"`   // 6000 (px)
    MaxPlayers  int         `json:"maxPlayers"`  // 30
    Biome       string      `json:"biome"`       // "urban" | "forest" | "desert" | ...
    MobSkins    []string    `json:"mobSkins"`    // 지역별 몹 스킨 매핑
}

// ── 라운드 결과 ──

type RoundResult struct {
    RegionId       string
    RoundNumber    int
    FactionResults []FactionRoundResult
    Timestamp      time.Time
}

type FactionRoundResult struct {
    FactionId     string
    MemberCount   int
    SurvivorsCount int   // BR 생존자 수
    SurvivalRP    int    // 생존 RP (최후 팩션 +50, 생존자 +10/명)
    KillRP        int    // 킬 RP (적 팩션 킬 1회 = +5 RP)
    ResourceRP    int    // 자원 RP (팩션 국고 입금 10단위 = +1 RP)
    TotalRP       int    // SurvivalRP + KillRP + ResourceRP
}

// ── 팩션 현황 (아레나 내 실시간) ──

type FactionPresence struct {
    FactionId     string
    FactionName   string
    Color         string   // 팩션 색상 (아군 하이라이트용)
    Members       []string // playerIds
    AliveCount    int
    TotalKills    int
    IsEliminated  bool     // BR에서 전멸 여부
}

// ── 건물 ──

type RegionBuilding struct {
    Id              string
    Type            string  // "barracks" | "watchtower" | "market" | "fortress"
    Position        Vector2
    OwnerFaction    string
    Level           int
    HP              int
    MaxHP           int
    Active          bool     // 지배 상실 시 false (M-05)
    OriginalCost    int
    ActivationCost  int      // 인수 비용 (50%)
}

// ── 인게임 Gold 분리 (H-03 해결) ──

type PlayerEconomy struct {
    RoundGold   int  // 라운드 내 획득 Gold (매 라운드 리셋)
    AccountGold int  // 계정 Gold (누적, 팩션 기여/토큰 교환용)
}
```

**S티어 국가 확정** (C-04 해결): v35 기준 **8개국** 확정
- 미국, 중국, 러시아, 인도, 일본, 독일, 영국, 프랑스

### 5.2 Client-Side (TypeScript)

**신규 TypeScript 타입** (`apps/web/lib/matrix/types/region.ts`):

```typescript
// ── 라운드 페이즈 (EpochPhase 대체) ──

export type RoundPhase = 'pve' | 'br_countdown' | 'br' | 'settlement';

export type BRSubPhase = 'skirmish' | 'engagement' | 'final_battle';

// ── 지역 정보 ──

export interface IRegionInfo {
  regionId: string;          // "KR-seoul"
  countryCode: string;       // "KR"
  name: string;              // "서울"
  nameEn: string;            // "Seoul"
  arenaSize: number;         // 6000
  maxPlayers: number;        // 30
  currentPlayers: number;    // 현재 접속자
  state: RegionState;
  controllerFaction: string | null;  // 현재 지배 팩션
  controllerColor: string | null;
  biome: string;
}

export type RegionState = 'idle' | 'pve' | 'br' | 'settling';

// ── 팩션 표시 정보 ──

export interface IFactionPresence {
  factionId: string;
  factionName: string;
  color: string;
  memberCount: number;
  aliveCount: number;
  isEliminated: boolean;
  isMyFaction: boolean;       // 클라이언트 로컬 판정
}

// ── 라운드 HUD 상태 ──

export interface IRoundHUDState {
  phase: RoundPhase;
  brSubPhase: BRSubPhase | null;
  countdown: number;          // 남은 시간 (초)
  timerDisplay: string;       // "MM:SS"
  roundNumber: number;
  pvpEnabled: boolean;
  factions: IFactionPresence[];
  myFactionRP: number;        // 이번 라운드 내 팩션 RP
  brCountdown: number | null; // BR 전환 카운트다운 (10~1)
}

// ── 자원 노드 (렌더링용) ──

export interface IResourceNode {
  id: string;
  position: { x: number; y: number };
  resourceType: string;
  amount: number;
  maxAmount: number;
  isSpecialty: boolean;
  gatherProgress: number;     // 0~1 (채취 진행도)
}

// ── 플레이어 인벤토리 ──

export interface IPlayerInventory {
  basic: {
    gold: number;
    oil: number;
    minerals: number;
    food: number;
    tech: number;
    influence: number;
  };
  specialty: Record<string, number>; // 특산 자원
  capacity: number;                  // 유형별 상한 (50)
}

// ── 영토 지배 상태 (Globe 표시용) ──

export interface ITerritoryState {
  regionId: string;
  controllerFaction: string | null;
  controllerColor: string | null;
  controlStreak: number;
  dailyRP: Record<string, number>; // factionId → RP
}

export interface ICountrySovereignty {
  countryCode: string;
  sovereignFaction: string | null;
  sovereigntyLevel: 'none' | 'active_domination' | 'sovereignty' | 'hegemony';
  allRegionsControlled: boolean;
}
```

### 5.3 Database Schema (PostgreSQL)

**신규 테이블** (Supabase PostgreSQL):

```sql
-- 지역 정의 (정적 시드 데이터)
CREATE TABLE regions (
    region_id    TEXT PRIMARY KEY,       -- "KR-seoul"
    country_code TEXT NOT NULL REFERENCES countries(code),
    name         TEXT NOT NULL,
    name_en      TEXT NOT NULL,
    arena_size   INT NOT NULL DEFAULT 4000,
    max_players  INT NOT NULL DEFAULT 20,
    biome        TEXT NOT NULL DEFAULT 'urban',
    mob_skins    JSONB DEFAULT '[]',
    sort_order   INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_regions_country ON regions(country_code);

-- 영토 지배 상태 (매일 정산 업데이트)
CREATE TABLE territory_control (
    region_id           TEXT PRIMARY KEY REFERENCES regions(region_id),
    controller_faction  UUID REFERENCES factions(id),
    control_streak      INT NOT NULL DEFAULT 0,
    last_settlement_at  TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 일일 RP 기록 (정산 후 아카이브)
CREATE TABLE daily_rp_log (
    id           BIGSERIAL PRIMARY KEY,
    region_id    TEXT NOT NULL REFERENCES regions(region_id),
    faction_id   UUID NOT NULL REFERENCES factions(id),
    rp_total     INT NOT NULL,
    rp_survival  INT NOT NULL DEFAULT 0,
    rp_kills     INT NOT NULL DEFAULT 0,
    rp_resources INT NOT NULL DEFAULT 0,
    settled_date DATE NOT NULL,            -- 정산 날짜
    is_winner    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_daily_rp_region_date ON daily_rp_log(region_id, settled_date);
CREATE INDEX idx_daily_rp_faction ON daily_rp_log(faction_id, settled_date);

-- 국가 주권 상태
CREATE TABLE country_sovereignty (
    country_code      TEXT PRIMARY KEY REFERENCES countries(code),
    sovereign_faction UUID REFERENCES factions(id),
    sovereignty_level TEXT NOT NULL DEFAULT 'none',
    sovereign_since   TIMESTAMPTZ,
    streak_days       INT NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 지역 건물
CREATE TABLE region_buildings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id       TEXT NOT NULL REFERENCES regions(region_id),
    building_type   TEXT NOT NULL,
    position_x      INT NOT NULL,
    position_y      INT NOT NULL,
    owner_faction   UUID REFERENCES factions(id),
    level           INT NOT NULL DEFAULT 1,
    hp              INT NOT NULL,
    max_hp          INT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    activation_cost INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_buildings_region ON region_buildings(region_id);

-- 팩션 국고 확장 (기존 faction_treasury 테이블에 컬럼 추가)
ALTER TABLE faction_treasury
    ADD COLUMN specialty_resources JSONB DEFAULT '{}';

-- 라운드 결과 로그
CREATE TABLE round_results (
    id            BIGSERIAL PRIMARY KEY,
    region_id     TEXT NOT NULL REFERENCES regions(region_id),
    round_number  INT NOT NULL,
    results_json  JSONB NOT NULL,    -- FactionRoundResult[]
    started_at    TIMESTAMPTZ NOT NULL,
    ended_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_round_results_region ON round_results(region_id, ended_at DESC);
```

**Redis 키 설계**:
```
territory:daily:{regionId}          → Hash { factionId: rpTotal }     TTL: 25h
territory:control:{regionId}        → String factionId                TTL: none
territory:sovereignty:{countryCode} → Hash { faction, level, streak } TTL: none
region:state:{regionId}             → Hash { state, players, round }  TTL: 5m (idle 시)
region:queue:{regionId}             → List [playerId, ...]            TTL: 30m
faction:online:{factionId}          → Set { playerId, ... }           TTL: none
round:results:{regionId}:{roundNum} → JSON RoundResult                TTL: 1h
```

---

## 6. API Design — WebSocket Protocol

기존 `{e: event, d: data}` 커스텀 JSON 프레이밍 유지. 이벤트명은 `matrix_*` 컨벤션 준수 (H-01 해결).

### 6.1 Client → Server 이벤트

| 이벤트 | Payload | 설명 |
|--------|---------|------|
| `matrix_join_region` | `{ countryCode: string, regionId: string }` | 지역 아레나 진입 |
| `matrix_leave_region` | `{}` | 지역 아레나 퇴장 |
| `matrix_input` | `{ dx: number, dy: number, seq: number }` | 이동 입력 (기존 20Hz 유지) |
| `matrix_gather_start` | `{ nodeId: string }` | 자원 채취 시작 |
| `matrix_gather_cancel` | `{}` | 자원 채취 취소 |
| `matrix_deposit_resource` | `{ resources: Record<string, number> }` | Base Camp 자원 입금 |
| `matrix_build` | `{ buildingType: string, position: { x, y } }` | 건물 건설 |

### 6.2 Server → Client 이벤트

| 이벤트 | 주기 | Payload | 설명 |
|--------|------|---------|------|
| `matrix_region_state` | 20Hz | (아래 상세) | 지역 아레나 게임 상태 |
| `matrix_round_phase` | 이벤트 | `{ phase, countdown, brSubPhase?, config }` | 라운드 페이즈 전환 |
| `matrix_faction_eliminated` | 이벤트 | `{ factionId, factionName, survivorCount }` | 팩션 전멸 알림 |
| `matrix_round_result` | 이벤트 | `{ roundNumber, factionResults[], myRP, mvpPlayerId }` | 라운드 결과 |
| `matrix_resource_gathered` | 이벤트 | `{ nodeId, resourceType, amount, total }` | 자원 채취 완료 |
| `matrix_territory_update` | 1Hz | `{ regions: ITerritoryState[] }` | 영토 상태 업데이트 |
| `matrix_region_info` | 이벤트 | `{ regions: IRegionInfo[] }` | 국가 내 지역 목록 (진입 시 1회) |
| `matrix_br_countdown` | 이벤트 | `{ seconds: number }` | BR 전환 카운트다운 (10→1) |
| `matrix_daily_settlement` | 이벤트 | `{ results: DailySettlementResult }` | 일일 정산 결과 (UTC 00:00) |

### 6.3 `matrix_region_state` Payload (20Hz)

```typescript
// 기존 matrix_state 확장
interface MatrixRegionStatePayload {
  // 기존 필드 (호환 유지)
  players: CompressedPlayerState[];
  enemies: CompressedEnemyState[];
  projectiles: CompressedProjectileState[];
  gems: CompressedGemState[];
  pickups: CompressedPickupState[];
  timer: number;

  // v39 신규 필드
  round: {
    phase: RoundPhase;
    brSubPhase: BRSubPhase | null;
    countdown: number;
    roundNumber: number;
  };
  factions: {
    id: string;
    alive: number;
    eliminated: boolean;
  }[];
  resources: {
    id: string;
    x: number;
    y: number;
    type: string;
    amount: number;
  }[];
  safeZone?: {             // BR 페이즈에서만 전송
    cx: number;
    cy: number;
    r: number;
    tr: number;            // target radius
    dps: number;
  };
}
```

### 6.4 대역폭 최적화

- `resources` 배열: 변경된 노드만 delta 전송 (첫 전송 시 full, 이후 delta)
- `factions` 배열: 5~10개 팩션 × 3필드 = 최소 바이트
- PvE 페이즈: `safeZone` 필드 생략 (null)
- 서버 틱 레이트: 기존 20Hz 유지 (명시, M-09 하단 참고)

---

## 7. Client Architecture

### 7.1 UX Flow (Globe → Country → Region → Arena)

```
┌──────────┐    클릭 국가    ┌──────────────┐   선택 지역   ┌──────────────┐
│ GlobeScene│─────────────→│RegionSelector │─────────────→│ MatrixCanvas │
│ (3D 지구본)│              │ (지역 목록 패널) │              │ (게임 아레나)  │
└──────────┘              └──────────────┘              └──────────────┘
      ▲                         │                            │
      │    뒤로가기 / ESC        │   matrix_join_region       │
      └─────────────────────────┘                            │
      ▲                                                      │
      │              matrix_leave_region / ESC                │
      └──────────────────────────────────────────────────────┘
```

**상세 흐름**:
1. **Globe** → 국가 클릭 → `matrix_region_info` 요청 → 서버가 해당 국가의 지역 목록 반환
2. **RegionSelector** → 지역 선택 → `matrix_join_region` 전송 → 서버가 RegionArena 할당
3. **MatrixCanvas** → 기존 게임 루프 시작 (PvE 페이즈부터)
4. **ESC / 나가기** → `matrix_leave_region` 전송 → RegionSelector로 복귀
5. **ESC / 뒤로** → Globe로 복귀

**Globe에서 영토 시각화**:
- 지배 팩션 색상으로 국가 하이라이트 (기존 GlobeDominationLayer 확장)
- 지역별 미니 도트로 지배 상태 표시 (hover 시 지역 상세)
- Sovereignty 달성 국가: 특수 이펙트 (기존 GlobeShockwave 재사용)

### 7.2 New Components

**신규 컴포넌트 목록**:

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `RegionSelector.tsx` | `components/game/matrix/` | 국가 내 지역 선택 패널 (지역 카드, 상태, 인원) |
| `RoundHUD.tsx` | `components/game/matrix/` | 라운드 타이머 + 페이즈 표시 (EpochHUD 대체) |
| `FactionIndicator.tsx` | `components/game/matrix/` | BR 시 팩션 생존 현황 표시 |
| `ResourceNodeUI.tsx` | `components/game/matrix/` | 자원 노드 채취 UI (프로그레스 바) |
| `InventoryPanel.tsx` | `components/game/matrix/` | 자원 인벤토리 HUD (기본 6종 + 특산) |
| `RoundResultScreen.tsx` | `components/game/matrix/` | 라운드 결과 화면 (팩션 순위, RP) |
| `BaseCampUI.tsx` | `components/game/matrix/` | 팩션 야영지 자원 입금 UI |
| `TerritoryPanel.tsx` | `components/game/matrix/` | 영토 지배 현황 패널 |
| `GlobeRegionDots.tsx` | `components/3d/` | Globe에 지역별 지배 도트 표시 |

**수정 컴포넌트**:

| 컴포넌트 | 변경 내용 |
|----------|----------|
| `MatrixApp.tsx` | RegionSelector 라우팅 추가, RoundHUD 교체 |
| `MatrixCanvas.tsx` | ResourceNode 렌더링, FactionColor 하이라이트 |
| `EpochHUD.tsx` | Deprecated → RoundHUD로 이관 |
| `GlobeDominationLayer.tsx` | 지역별 지배 색상 표시 확장 |
| `GlobeInteractionLayer.tsx` | 국가 클릭 → RegionSelector 연결 |
| `NationScoreboard.tsx` | 팩션별 RP 표시 추가 |
| `ArenaHUD.tsx` | BR 페이즈 팩션 생존 현황 추가 |

### 7.3 State Management

**상태 관리 전략**: 기존 패턴 유지 — React hooks + refs (Zustand 미사용)

```typescript
// useRegionArena.ts — 지역 아레나 상태 관리 (신규 훅)
function useRegionArena(socket: MatrixSocket) {
  // 서버 상태 (ref — 렌더링 트리거 최소화)
  const roundStateRef = useRef<IRoundHUDState>(defaultRoundState);
  const factionsRef = useRef<IFactionPresence[]>([]);
  const resourcesRef = useRef<IResourceNode[]>([]);
  const inventoryRef = useRef<IPlayerInventory>(defaultInventory);
  const territoryRef = useRef<ITerritoryState[]>([]);

  // UI 트리거 상태 (state — 렌더링 필요)
  const [currentPhase, setCurrentPhase] = useState<RoundPhase>('pve');
  const [showResult, setShowResult] = useState(false);
  const [brCountdown, setBRCountdown] = useState<number | null>(null);

  // 이벤트 핸들러
  useEffect(() => {
    socket.on('matrix_round_phase', handlePhaseChange);
    socket.on('matrix_round_result', handleRoundResult);
    socket.on('matrix_faction_eliminated', handleFactionEliminated);
    socket.on('matrix_resource_gathered', handleResourceGathered);
    socket.on('matrix_territory_update', handleTerritoryUpdate);
    socket.on('matrix_br_countdown', handleBRCountdown);
    return () => { /* cleanup */ };
  }, [socket]);

  return {
    roundStateRef, factionsRef, resourcesRef, inventoryRef,
    currentPhase, showResult, brCountdown,
    joinRegion, leaveRegion, startGather, depositResource,
  };
}
```

**EpochUIBridge 확장** (`epoch-ui-bridge.ts`):
- `RoundUIBridge` 클래스 추가 (EpochUIBridge 상속)
- `MatrixEpochPhase` 타입에 `"pve" | "br" | "settlement"` 추가
- `onRoundPhase()` 메서드: `matrix_round_phase` 이벤트 파싱
- 기존 `onEpochEvent()`는 호환 래퍼로 유지 (내부에서 `onRoundPhase()` 호출)

---

## 8. Security Considerations

### 8.1 서버 권위 원칙

모든 게임 로직 판정은 서버에서 수행. 클라이언트는 표시(렌더링)만 담당.

| 판정 항목 | 서버 검증 | 클라이언트 역할 |
|----------|----------|----------------|
| 팩션 면역 | FactionCombatSystem.ValidateKill() | 아군 투사체 관통 표시만 |
| RP 누적 | TerritoryEngine.OnRoundSettlement() | HUD 표시만 |
| 자원 채취 | ResourceSpawner.ValidateGather() | 프로그레스 바 표시만 |
| BR 생존 판정 | RoundEngine + SafeZone | 존 밖 데미지 시각 효과만 |
| 일일 정산 | TerritoryEngine.DailySettlement() | 결과 수신 + 표시만 |
| 건물 건설 | RegionArena.ValidateBuild() | 건설 UI + 미리보기만 |

### 8.2 Anti-Cheat

- **이동 속도 검증**: 기존 MatrixValidator 유지 (서버 틱 기반 위치 검증)
- **자원 채취 검증**: 노드 근접 거리(100px 이내) + 채취 시간(3초) 서버 검증
- **팩션 변경 악용 방지**: 팩션 변경 시 24시간 쿨다운 (시즌 중 최대 3회)
- **RP 어뷰징 방지**: 최소 라운드 참여 시간(5분) 미충족 시 RP 0 처리
- **Rate Limiting**: matrix_gather_start — 3초 쿨다운, matrix_build — 30초 쿨다운

### 8.3 토큰 보상 보안 (M-07 해결)

- 영토 보상은 **팩션 국고에 입금** (개인 일일 상한 5,000 토큰과 별도)
- 개인은 팩션 국고에서 분배받는 구조 (팩션 리더 또는 자동 균등 분배)
- DefenseOracle (v35 §16.3) 그대로 유지 — 인플레이션 방지

---

## 9. Performance Budget

### 9.1 서버 성능 목표

| 지표 | 목표 | 비고 |
|------|------|------|
| 서버 틱 레이트 | 20Hz | 기존 유지 |
| 틱당 처리 시간 | < 30ms (P95) | 50ms 예산 중 60% |
| 지역 아레나당 메모리 | < 5MB | 30명 + 80몬스터 + 20노드 |
| 국가당 피크 메모리 | < 35MB | 7지역 × 5MB |
| WebSocket 대역폭/플레이어 | < 8KB/s | 20Hz × ~400B (delta 전송) |
| 일일 정산 처리 시간 | < 10s | 195국 × 평균 4지역 = ~780 지역 |

### 9.2 클라이언트 성능 목표

| 지표 | 목표 | 비고 |
|------|------|------|
| 게임 FPS | 60fps (데스크톱), 30fps (모바일) | 기존 목표 유지 |
| RegionSelector 렌더링 | < 50ms | 7개 지역 카드 |
| Globe → RegionSelector 전환 | < 200ms | 3D→2D 전환 |
| RegionSelector → Arena 전환 | < 500ms | Arena 초기화 포함 |
| 자원 노드 렌더링 | < 2ms | 최대 25개 노드 |

### 9.3 Lazy Init 성능 전략

```
[국가 선택] → region_info 조회 (Redis, < 5ms)
[지역 진입] → RegionArena 초기화 (첫 진입 시 ~50ms, 이후 < 5ms)
[60초 유휴] → RegionArena 메모리 해제, 상태 Redis 캐시
[재진입]   → Redis에서 복원 (~10ms)
```

### 9.4 라운드 수 보정 (M-03 해결)

- 1라운드 = PvE 600s + BR 300s + Settlement 15s = **915초**
- 24시간 / 915초 = **~94.4라운드/일**
- 서버 재시작/유지보수 감안: **~90라운드/일** (보수적 추정)

---

## 10. Migration Strategy

### 10.1 마이그레이션 단계

| 단계 | 작업 | 위험도 |
|------|------|--------|
| 1 | `IEpochManager` 인터페이스 추출 + RoundEngine 구현 | Low |
| 2 | RegionDef 시드 데이터 생성 (195국 × 3~7지역) | Low |
| 3 | DB 마이그레이션: regions, territory_control 테이블 생성 | Low |
| 4 | RegionArenaManager 구현 + CountryArena 확장 | **High** |
| 5 | FactionCombatSystem 구현 + KillValidator 통합 | **High** |
| 6 | TerritoryEngine 구현 + DominationEngine 폐기 | **High** |
| 7 | ResourceSpawner 구현 + Orb 시스템 확장 | Medium |
| 8 | 클라이언트 RegionSelector + RoundHUD 구현 | Medium |
| 9 | WebSocket 프로토콜 확장 + useRegionArena 훅 | Medium |
| 10 | Globe 영토 시각화 확장 | Low |

### 10.2 Feature Flag 전략

```go
// config/feature_flags.go
var FeatureFlags = struct {
    V39RegionSystem    bool  // 지역 분할 시스템 활성
    V39RoundEngine     bool  // RoundEngine 사용 (false면 기존 EpochManager)
    V39FactionCombat   bool  // 팩션 면역 검사 활성
    V39TerritoryEngine bool  // 일일 정산 활성
    V39Resources       bool  // 국가별 자원 스폰 활성
}{
    V39RegionSystem:    false,
    V39RoundEngine:     false,
    V39FactionCombat:   false,
    V39TerritoryEngine: false,
    V39Resources:       false,
}
```

Feature flag가 false인 동안 기존 시스템(EpochManager, DominationEngine) 사용.
각 flag를 독립적으로 활성화하여 점진적 배포 가능.

### 10.3 롤백 전략

- 모든 v39 테이블은 별도 생성 (기존 테이블 수정 최소화)
- `faction_treasury`의 `specialty_resources` 컬럼은 nullable JSONB (롤백 시 무시)
- Feature flag OFF → 즉시 기존 시스템으로 복원
- Redis 키는 `territory:` 접두사로 격리 (롤백 시 `KEYS territory:*` 삭제)

---

## 11. ADRs (Architecture Decision Records)

### ADR-001: EpochManager 폐기 → RoundEngine 신규

**Status**: Accepted
**Context**: 기존 EpochManager는 10m15s 6페이즈 고정 사이클. v39의 15분 3페이즈 라운드와 근본적으로 다름. "내부 타이밍만 변경"은 사실상 신규 시스템.
**Decision**: EpochManager를 Deprecated 처리하고, RoundEngine을 신규 구현. `IEpochManager` 인터페이스를 추출하여 RoundEngine이 구현 → 기존 코드 호환.
**Consequences**: 기존 EpochManager 참조 코드 모두 인터페이스 기반으로 전환 필요. DominationEngine의 "6에폭 평가"도 TerritoryEngine으로 대체 필수.

### ADR-002: 지역 아레나 크기 티어별 차등화

**Status**: Accepted
**Context**: 기획서 초안에서 모든 지역을 8,000×8,000px로 통일했으나, D티어 소국(기존 1,500px)이 5.3배 확대되면 파밍/전투 밀도 극히 저하.
**Decision**: 국가 티어에 비례하여 아레나 크기 차등화 (S:6000, A:5000, B:4000, C:3000, D:2500).
**Consequences**: 서버 부하 균일화, 소국에서도 적절한 전투 밀도 유지. 지역 아레나 크기가 고정값이 아니므로 RegionDef에 arenaSize 필드 필요.

### ADR-003: 배틀로얄에서 동맹 면역 없음

**Status**: Accepted
**Context**: Military Alliance 체결 시 배틀로얄에서도 공격 면역이면 3~4개 팩션 연합 → 사실상 단일 팩션 → 다른 팩션 승리 불가.
**Decision**: PvE 중 동맹 면역 유지, **BR에서는 동맹 면역 없음**. 동맹은 영토 방어 협력만.
**Consequences**: 밸런스 보장, 배신 전략 가능. 동맹 관계가 있어도 BR에서는 모든 팩션이 적.

### ADR-004: Sovereignty Escalation Ladder 재정의

**Status**: Accepted
**Context**: v35의 "연속 지배 시간" 기반 Sovereignty 모델과 v39의 "일일 정산 점수" 기반 모델이 근본적으로 다름.
**Decision**: v39 일일 정산 모델이 v35를 **완전 대체**. 래더: None → Active Domination(1일) → Sovereignty(3일 연속) → Hegemony(14일 연속).
**Consequences**: v35의 "6에폭 연속 1시간 지배 → Active Domination" 조건 폐기. 일 단위 정산으로 단순화.

### ADR-005: 인게임 Gold와 계정 Gold 분리

**Status**: Accepted
**Context**: 필드 상점 아이템을 매 라운드 Gold로 구매하는데, Gold가 누적되면 후반 라운드 밸런스 붕괴.
**Decision**: "인게임 Gold(Round Gold)"와 "계정 Gold(Account Gold)"를 분리. 필드 상점은 Round Gold만 사용. Account Gold는 팩션 기여/토큰 교환용.
**Consequences**: 매 라운드 Round Gold 리셋, 필드 상점 밸런스 유지. PlayerEconomy 구조체 필요.

---

## 12. Verification Report Resolutions

검증 보고서 27건에 대한 아키텍처 설계 수준 해결 현황:

### Critical (6/6 해결)

| ID | 이슈 | 해결 위치 | 해결 방법 |
|----|------|----------|----------|
| C-01 | 에폭 타이밍 호환성 | §4.1, §4.6 | RoundEngine 신규 구현, IEpochManager 인터페이스 호환 |
| C-02 | Sovereignty 모델 불일치 | §4.4, ADR-004 | 일일 정산 기반으로 Sovereignty Ladder 재정의 |
| C-03 | 아레나 크기 충돌 | §4.2, ADR-002 | 티어별 차등화 (S:6000~D:2500) |
| C-04 | S티어 국가 수 불일치 | §5.1 | v35 기준 8개국 확정 |
| C-05 | 캡처 포인트 누락 | §4.6 | 자원 노드로 대체, CapturePointSystem 폐기 |
| C-06 | 전쟁 시스템 관계 미정의 | §4.6 | BR=자동PvP, 전쟁선포=v41 Cross-Arena, v39에서는 보너스만 |

### High (7/7 해결)

| ID | 이슈 | 해결 위치 | 해결 방법 |
|----|------|----------|----------|
| H-01 | WS 네이밍 컨벤션 | §6 | `matrix_*` 접두사 통일 |
| H-02 | 팩션 멤버 상한 | §4.3 | 50명 max 명시 |
| H-03 | 인게임/계정 Gold 분리 | §5.1, ADR-005 | PlayerEconomy 구조체, Round Gold 리셋 |
| H-04 | Match Phase 통합 | §4.1 | BRSubPhase로 통합 (Skirmish/Engagement/FinalBattle) |
| H-05 | DominationEngine 대체 | §4.4 | TerritoryEngine 완전 대체, 일일 정산 |
| H-06 | 특산 자원 저장 | §4.5, §5.1 | PlayerInventory.Specialty + FactionTreasury.specialty |
| H-07 | 인벤토리 상한 | §4.5 | 유형별 50 단위, Base Camp 메커니즘 추가 |

### Medium (9/9 해결)

| ID | 이슈 | 해결 위치 |
|----|------|----------|
| M-01 | 아레나 인원 30 vs 50 | §4.2 (대기열 + 인스턴스 복제) |
| M-02 | 동맹 면역 밸런스 | §4.3, ADR-003 (BR에서 동맹 면역 없음) |
| M-03 | 96→94 라운드 보정 | §9.4 (~90라운드/일) |
| M-04 | 무소속 플레이어 | §4.3 (Underdog Boost + 자동 팩션 배정) |
| M-05 | 건물 인수 밸런스 | §4.4 (중립화 → 50% 비용 인수) |
| M-06 | 인원/지역 상한 수식 | §4.3 (regions_count = 해당 국가 지역 수) |
| M-07 | 토큰 보상 상한 | §8.3 (영토 보상 → 팩션 국고, 개인 상한 별도) |
| M-08 | KillValidator 팩션 검사 | §4.3 (Step 0 팩션 면역 검사) |
| M-09 | Reckoning Era 충돌 | §13 (Reckoning 특별 라운드 규칙 정의) |

---

## 13. Implementation Roadmap (Phase Dependencies)

```
Phase 1: 기반 (서버)
├── S01: IEpochManager 인터페이스 추출
├── S02: RoundEngine 구현 (3페이즈 + BRSubPhase)
├── S03: RegionDef 시드 데이터 생성 (195국 지역)
└── S04: DB 마이그레이션 (regions, territory_control, round_results)

Phase 2: 지역 아레나 (서버)
├── S05: RegionArenaManager 구현 (Lazy Init/Teardown)
├── S06: RegionArena 구현 (CountryArena 확장)
├── S07: 인원 제한 + 대기열 시스템
└── S08: WebSocket 프로토콜 확장 (matrix_join_region 등)
    └── depends: S01~S04

Phase 3: 팩션 전투 (서버)
├── S09: FactionCombatSystem 구현
├── S10: KillValidator Step 0 (팩션 면역) 통합
├── S11: Underdog Boost 시스템
└── S12: 팩션 인원/지역 상한 적용
    └── depends: S05~S08

Phase 4: 영토 엔진 (서버)
├── S13: TerritoryEngine 구현
├── S14: 일일 정산 스케줄러
├── S15: Sovereignty Escalation Ladder
├── S16: DominationEngine Deprecated 처리
└── S17: 건물 시스템 (건설/인수/중립화)
    └── depends: S05~S08

Phase 5: 자원 시스템 (서버)
├── S18: ResourceSpawner 구현
├── S19: PlayerInventory + Base Camp
├── S20: 팩션 국고 specialty 확장
└── S21: 인게임/계정 Gold 분리
    └── depends: S05~S08

Phase 6: 클라이언트 — 지역 선택
├── S22: RegionSelector 컴포넌트
├── S23: useRegionArena 훅
├── S24: MatrixApp 라우팅 확장
└── S25: Globe → RegionSelector 연결
    └── depends: S08

Phase 7: 클라이언트 — 게임 HUD
├── S26: RoundHUD (EpochHUD 대체)
├── S27: FactionIndicator (BR 생존 현황)
├── S28: ResourceNodeUI + InventoryPanel
├── S29: RoundResultScreen
└── S30: BaseCampUI
    └── depends: S22~S25

Phase 8: 클라이언트 — Globe 확장
├── S31: GlobeRegionDots (지역별 지배 도트)
├── S32: GlobeDominationLayer 확장 (팩션 색상)
├── S33: TerritoryPanel (영토 현황)
└── S34: Sovereignty 이펙트
    └── depends: S13~S17

Phase 9: 시즌 통합
├── S35: 시즌 4주 4Era와 라운드 연동
├── S36: Reckoning Era 특별 규칙 (라운드 단축, RP 배율 ×2)
├── S37: 시즌 리셋 시 영토 초기화
└── S38: AI Agent SDK 영토 API 확장
    └── depends: S13~S21

Phase 10: QA + 밸런스
├── S39: 라운드 사이클 E2E 테스트
├── S40: 팩션 면역 검증 테스트
├── S41: 일일 정산 스트레스 테스트
├── S42: 자원 경제 밸런스 시뮬레이션
└── S43: Feature Flag 순차 배포
    └── depends: all
```

**Reckoning Era 특별 규칙** (M-09 해결):
- 라운드 시간 단축: 15분 → **7.5분** (PvE 5분 + BR 2.5분)
- RP 배율: ×2.0 (최종 쟁탈전 느낌)
- 모든 지배 연속 보너스 리셋 (ControlStreak = 0)
- Sovereignty 달성 팩션에게 추가 방어 보너스 없음 (평등한 쟁탈)
- 최종 순위: 시즌 마지막 일일 정산 기준

---

## 14. Open Questions

1. **오프라인 방어 NPC 수비대**: 기획서 §7.4에서 NPC 수비대 메커니즘이 언급되었으나, NPC AI 로직의 상세 사양은 구현 단계에서 결정 예정. RoundEngine이 PvE 페이즈에서 NPC를 "수비 모드"로 전환하는 트리거만 정의.

2. **지역 간 이동**: 한 라운드 내에서 지역 간 이동이 가능한지? 현재 설계: **불가** (라운드 중 지역 고정). Settlement 페이즈에서만 지역 변경 가능.

3. **인스턴스 복제 시 RP 합산**: 지역 인원 초과로 인스턴스가 복제될 때, 각 인스턴스의 RP를 어떻게 합산하는지 정확한 수식은 구현 단계에서 결정. 현재 방향: 인스턴스별 독립 RP → 일일 정산 시 합산.

4. **팩션 자동 배정 알고리즘**: 무소속 신규 유저를 기존 팩션에 자동 배정하는 로직의 상세 (인원 균형? 국적 기반? 랜덤?)는 구현 단계에서 결정.

5. **특산 자원 간 교환 비율**: 한국 반도체 1 = 미국 석유 N의 교환 비율은 게임 밸런스 테스트 후 결정. TerritoryEngine에 교환 비율 테이블 슬롯만 예약.

---

*아키텍처 설계 완료: 2026-03-11*
*검증 보고서 27건 해결: Critical 6/6, High 7/7, Medium 9/9*
*다음 단계: `/da:dev`로 Phase 1 (S01~S04) 구현 시작*
