# PLAN: v33 — Matrix Online: Play-to-Earn Multiplayer Arena

## 1. 개요

### 배경
현재 AI World War는 두 개의 분리된 게임 시스템이 존재한다:

1. **Matrix 게임** (싱글플레이어): Vampire Survivors 스타일 자동전투 서바이벌. `apps/web/lib/matrix/`에서 클라이언트 전용으로 작동. 서버 연결 없음.
2. **온라인 시스템** (멀티플레이어): Go 서버 기반 195국 국가별 아레나 전투, 토큰 경제, 팩션/외교/전쟁/거버넌스. `server/internal/`에 구현.

**핵심 문제**: Matrix 게임이 아무리 재미있어도 온라인 시스템과 연결되지 않아 토큰 경제에 기여하지 못한다. 유저가 Matrix를 플레이해도 $AWW/국가 토큰을 벌 수 없고, 벌어들인 토큰으로 Matrix 게임에 영향을 줄 수 없다.

### 목표
**Matrix 게임을 온라인 국가 아레나 시스템과 통합**하여:
- 유저/에이전트가 특정 국가에서 Matrix를 플레이하면 → 해당 국가의 Nation Score에 기여
- 전투 성과에 따라 → 국가 토큰 + $AWW 보상 (Play-to-Earn)
- 토큰으로 → Matrix 게임 내 버프/스킬/장비 구매 (Earn-to-Play)
- 기존 5분/10분 에폭 사이클, 점령/주권/패권 시스템 완전 활용

### 핵심 원칙
1. **기존 서버 시스템 최대 활용**: 이미 구현된 EpochManager, DominationEngine, TokenRewardManager, DefenseOracle 등을 그대로 사용
2. **기존 aww-agent-skill SDK 부분 호환**: Layer 2 (전략 REST API `/api/v11/*`)는 그대로 사용. Layer 1 (전투 WebSocket)은 `MatrixGameClient` + `MatrixStrategy` 신규 구현 필요 (입력 모델/킬 리포팅/에폭 페이즈 인식이 기존과 다름)
3. **Matrix 게임 품질 유지**: 60fps 클라이언트 렌더링, 풍부한 스킬/무기 시스템 그대로
4. **Net Deflationary**: 토큰 발행보다 소각이 더 많은 경제 구조 유지

---

## 2. 요구사항

### 기능 요구사항

[FR-01] **국가 아레나 진입**: 유저가 글로브에서 국가 선택 → 해당 국가 Matrix 아레나에 참가
[FR-02] **에폭 사이클 통합**: 기존 10분 15초 에폭 (4분50초 평화 + 10초 전쟁카운트다운 + 3분 전쟁 + 2분 수축 + 5초 집계 + 10초 전환) 주기로 Matrix 게임 진행
[FR-03] **멀티플레이어 전투**: 같은 국가에 접속한 유저/에이전트가 PvP (전쟁 페이즈) + PvE (평화 페이즈) 동시 진행
[FR-04] **Nation Score 기여**: 전투 성과 (킬, 레벨, 데미지, 생존) → 소속 국적의 Nation Score로 합산
[FR-05] **토큰 보상**: 에폭 종료 시 Nation Score 비례 국가 토큰 지급, 주권/패권 보너스 AWW 지급
[FR-06] **토큰 → 게임 효과**: 보유 토큰량에 따른 XP 부스트, 스탯 버프, 특수 스킬 해금
[FR-07] **에이전트 참여**: aww-agent-skill SDK Layer 2 (전략 API) 그대로 사용 + Layer 1은 `MatrixGameClient` 신규 구현으로 Matrix 전투 자동 참여. 기존 `GameClient`는 heading-only 입력이나 Matrix는 position+heading 보고 필요
[FR-08] **캡처 포인트**: 국가별 3개 전략 거점 (Resource/Buff/Healing) 점령 가능
[FR-09] **주권/패권 시스템**: 24시간 연속 지배 → 주권 (XP+10%, Speed+5%, Capture+20%), 7일 연속 주권 → 패권 (정책 설정권). 바이너리 상태 (있음/없음, 레벨 없음)
[FR-10] **시즌 리셋**: 4주 시즌 종료 시 레벨/빌드/주권 리셋, 온체인 토큰 보존

### 비기능 요구사항

[NFR-01] **성능**: 아레나당 최대 50명, 60fps 클라이언트, 20Hz 서버 틱
[NFR-02] **확장성**: 195개 아레나 동시 운영, 활성 아레나만 틱 처리 (lazy init)
[NFR-03] **지연시간**: 서버→클라이언트 상태 전송 < 50ms
[NFR-04] **보안**: 서버 권위적 (authoritative) 게임 로직, 클라이언트는 렌더링+입력만
[NFR-05] **호환성**: 기존 aww-agent-skill v1/v2 SDK 하위 호환

---

## 3. 기술 방향

### 클라이언트 (Matrix 게임)
- **프레임워크**: Next.js 15 + React 19 (기존 `apps/web/`)
- **렌더링**: HTML5 Canvas 2D (기존 Matrix 엔진 그대로)
- **네트워크**: WebSocket (Socket.IO) — 서버↔클라이언트 실시간 동기화
- **상태 관리**: React Refs (게임 루프) + React State (UI)

### 서버 (게임 + 메타)
- **언어**: Go (기존 `server/` 그대로)
- **게임 서버**: 20Hz 틱 루프, 아레나당 독립 고루틴
- **메타 서버**: REST API (faction, diplomacy, war, economy, governance)
- **DB**: PostgreSQL (유저/팩션/시즌) + Redis (실시간 상태 캐시)

### 블록체인
- **체인**: CROSS Mainnet (기존)
- **토큰**: $AWW (ERC-20) + 195 국가 토큰 (기존 설계)
- **DEX**: CROSS GameToken DEX (기존)
- **지갑**: CROSSx Super App (기존)

### 핵심 결정: 서버 권위적 하이브리드 모델

**왜 완전 서버사이드가 아닌가**: Matrix의 55개 스킬, 20+무기, 150+적 타입, 물리/충돌 시스템을 서버에서 50명분 동시에 시뮬레이션하면 Go 서버 부하가 극심하다.

**하이브리드 접근**:
```
┌──────────────────────────────────────────────────────────────┐
│ CLIENT (렌더링 + 로컬 시뮬레이션)                              │
│ - 60fps 렌더링 (Canvas 2D)                                    │
│ - 자기 캐릭터의 물리/충돌/무기 로컬 시뮬레이션                    │
│ - 몬스터 AI/스폰은 서버가 시드 동기화                            │
│ - 다른 플레이어는 서버 위치 보간                                 │
│ - 킬/데미지 이벤트 → 서버에 보고                                │
└──────────────┬───────────────────────────────────────────────┘
               │ WebSocket (20Hz 양방향)
               │ ↑ input (position, angle, boost, kills, damage)
               │ ↓ world_state (other_players, epoch_phase, score)
┌──────────────┴───────────────────────────────────────────────┐
│ SERVER (권위적 판정 + 글로벌 상태)                              │
│ - 위치 검증 (speed hack 탐지)                                  │
│ - 킬/데미지 검증 (범위/쿨다운 체크)                              │
│ - Nation Score 집계                                           │
│ - 에폭 사이클 관리                                             │
│ - 토큰 보상 계산/지급                                          │
│ - 캡처 포인트 상태                                             │
│ - 주권/패권 판정                                               │
│ - 몬스터 스폰 시드 배포                                         │
└──────────────────────────────────────────────────────────────┘
```

**핵심**: 클라이언트는 자기 캐릭터를 로컬에서 시뮬레이션하되, 서버가 결과를 **검증**한다. 킬이 실제로 유효한지 (거리, 무기 쿨다운, 데미지 범위), 이동 속도가 정상인지 서버가 판정한다. 치팅 방지와 성능의 균형.

---

## 4. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI WORLD WAR v33                             │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────┐    │
│  │  Web Client  │   │  Agent SDK   │   │  CROSSx Wallet App   │    │
│  │  (Next.js)   │   │  (Node.js)   │   │  (Mobile)            │    │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘    │
│         │ WS/HTTP          │ WS/HTTP              │ Deep Link       │
│  ┌──────┴──────────────────┴──────────────────────┴───────────┐    │
│  │                    GO GAME SERVER                           │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │ CountryArenaManager (195 arenas, lazy init)         │   │    │
│  │  │  ├─ Room (state machine)                            │   │    │
│  │  │  ├─ EpochManager (10min cycle)                      │   │    │
│  │  │  ├─ CapturePointSystem (3 points/arena)             │   │    │
│  │  │  ├─ OnlineMatrixEngine ★ NEW                        │   │    │
│  │  │  │   ├─ PlayerSession (per-player state)            │   │    │
│  │  │  │   ├─ MonsterSeedSync (deterministic spawn)       │   │    │
│  │  │  │   ├─ KillValidator (anti-cheat)                  │   │    │
│  │  │  │   └─ ScoreAggregator (nation score)              │   │    │
│  │  │  ├─ DominationEngine (1hr eval)                     │   │    │
│  │  │  └─ NationScoreTracker                              │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │  ┌───────────────────┐  ┌──────────────────────────────┐   │    │
│  │  │ Meta Systems      │  │ Token Economy               │   │    │
│  │  │ ├─ FactionManager │  │ ├─ TokenRewardManager       │   │    │
│  │  │ ├─ WarManager     │  │ ├─ StakingManager           │   │    │
│  │  │ ├─ DiplomacyMgr   │  │ ├─ DefenseOracle            │   │    │
│  │  │ ├─ EconomyEngine  │  │ ├─ BuybackEngine            │   │    │
│  │  │ ├─ SeasonManager  │  │ └─ AuctionManager           │   │    │
│  │  │ └─ IntelSystem    │  └──────────────────────────────┘   │    │
│  │  └───────────────────┘                                     │    │
│  └────────────────────────────────┬───────────────────────────┘    │
│                                   │ RPC                             │
│  ┌────────────────────────────────┴───────────────────────────┐    │
│  │                 CROSS Mainnet                               │    │
│  │  $AWW Token ─── 195 National Tokens ─── GameToken DEX      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 새로 추가되는 핵심 컴포넌트: `OnlineMatrixEngine`

기존 `CountryArena`에 들어가는 새 모듈. Matrix 게임의 서버사이드 핵심 로직:

| 컴포넌트 | 역할 |
|----------|------|
| `PlayerSession` | 플레이어별 상태 (HP, 레벨, 무기, 위치, 킬수, 데미지) 서버 트래킹 |
| `MonsterSeedSync` | 결정론적 몬스터 스폰 시드를 모든 클라이언트에 동기화 |
| `KillValidator` | 킬/데미지 이벤트를 거리/쿨다운/무기 범위로 검증 (치팅 방지) |
| `ScoreAggregator` | 전투 성과를 Nation Score로 실시간 합산 (별도 히스토리 유지 — DominationEngine Reset 독립) |
| `EpochRewardCalculator` | 에폭 종료 시 토큰 보상 계산 |
| `TokenBuffApplier` | 보유 토큰량 → 인게임 버프 변환 |

### CountryArenaWrapper 확장 필요

현재 `CountryArenaWrapper` 구조체에 `SovereigntyTracker` 필드가 **없음**. v33에서 추가 필요:

```go
// 현재 (country_arena.go)
type CountryArenaWrapper struct {
    Room, Epoch, Respawn, CapturePoints, Domination, NationScore
    // ❌ SovereigntyTracker 없음
}

// v33 확장
type CountryArenaWrapper struct {
    // ... 기존 필드 ...
    Sovereignty    *SovereigntyTracker  // ★ 추가
    MatrixEngine   *OnlineMatrixEngine  // ★ 추가
}
```

**DominationEngine → SovereigntyTracker 연동**: 현재 수동 호출 방식. DominationEngine의 `OnEvents` 콜백에서 `sovereignty.OnDominationUpdate(dominantNation, dominationStart)`를 자동 호출하도록 연결 필요.

---

## 5. 게임 플로우 상세

### 유저 플레이 플로우 (전체 루프)

```
글로브 로비 → 국가 클릭 → "ENTER ARENA" →
  Matrix 아레나 로딩 (해당 국가 방 입장) →
    ┌─── 에폭 사이클 시작 (총 10분 15초 = 12,200 ticks @ 20Hz) ──┐
    │                                                            │
    │  [평화 페이즈] 0:00 ~ 4:50 (5,800 ticks)                    │
    │  - PvP OFF (아군/적군 구분 없이 PvE)                          │
    │  - 몬스터 x2 스폰 (orbMultiplier=2.0, 팜 타임)               │
    │  - 캡처 포인트 점령 가능 (PvE 보너스)                          │
    │  - 오토헌트 ON (안전하게 레벨업)                               │
    │  - ★ 레벨업 → 스킬/무기 선택 (기존 55개 스킬)                 │
    │                                                            │
    │  [전쟁 카운트다운] 4:50 ~ 5:00 (200 ticks)                   │
    │  - "WAR INCOMING" 10초 카운트다운 (매초 이벤트)               │
    │  - 사이렌 3초 전 (war_siren 이벤트)                          │
    │  - PvP 아직 OFF                                            │
    │                                                            │
    │  [전쟁 페이즈] 5:00 ~ 8:00 (3,600 ticks)                    │
    │  - PvP ON (다른 국적 = 적), orbMultiplier → 1.0              │
    │  - 같은 국적 = 아군 (팩션 동맹 포함)                           │
    │  - 킬/데미지 → Nation Score 대량 적립                         │
    │  - 캡처 포인트 점령 → 30 war score 보너스                     │
    │  - ★ 몬스터도 계속 스폰 (PvP+PvE 동시)                      │
    │                                                            │
    │  [수축 페이즈] 8:00 ~ 10:00 (2,400 ticks)                   │
    │  - 아레나 반경 3000px → 1000px (선형 보간 수축)               │
    │  - 존 밖 대미지 (초당 HP 5%), PvP 유지                       │
    │  - 최종 서바이벌                                             │
    │                                                            │
    │  [집계 페이즈] 10:00 ~ 10:05 (100 ticks)                    │
    │  - PvP OFF, Nation Score 합산                               │
    │  - 토큰 보상 계산 & 지급                                      │
    │  - MVP 보너스 (1.5x)                                        │
    │                                                            │
    │  [전환 페이즈] 10:05 ~ 10:15 (200 ticks)                    │
    │  - 결과 화면 (5초) + 다음 에폭 준비 (5초)                     │
    │  - 레벨/무기/HP 리셋 → 새 에폭 시작                           │
    │                                                            │
    │  ⚠️ 에폭 페이즈 틱은 절대 오프셋 방식 (컴파일 타임 상수)        │
    │  런타임에 페이즈 시간 조정 불가 — 변경 시 서버 재빌드 필요       │
    └────────────────────────────────────────────────────────────┘
```

### 에이전트 플레이 플로우

에이전트는 **Layer 2는 기존 SDK 그대로, Layer 1은 신규 MatrixGameClient** 사용:

```
AgentSDK (Node.js)
  │
  ├─ Layer 1 (Combat): ★ MatrixGameClient (신규) — WebSocket 10Hz
  │   - 기존 GameClient와 다른 프로토콜:
  │     - 입력: { angle, boost } → { x, y, angle, boost, tick } (위치 보고)
  │     - 킬: 서버 감지 → 클라이언트 보고 + 서버 검증 (matrix_kill)
  │     - 상태: agent_state → matrix_state (다른 스키마)
  │   - MatrixStrategy 인터페이스 (에폭 페이즈 인식):
  │     - onPeace(): 파밍 전략 (기존 aggressive/balanced/defensive 매핑)
  │     - onWar(): PvP 전략 (아군/적군 판별, 킬 리포팅)
  │     - onShrink(): 서바이벌 전략 (세이프존 이동)
  │   - matrix_level_up → 55개 스킬/20+ 무기 선택 (확장된 선택지)
  │
  └─ Layer 2 (Strategic): REST API 30초 틱 — ✅ 기존 SDK 100% 호환
      - 어느 국가에 배치할지 LLM이 결정
      - 팩션 관리, 외교, 전쟁 선포 (/api/v11/* 그대로)
      - 경제 정책, 기술 투자
      - 인텔 미션 (정찰/사보타주)
```

### 참여 방식 비교

| 구분 | 직접 플레이 (Warrior) | 에이전트 배치 (Strategist) |
|------|----------------------|--------------------------|
| 입력 | WASD + 마우스 | SDK API (10Hz) |
| 보상 배율 | 1.5x (직접 플레이 보너스) | 1.0x |
| 최대 동시 | 1개 국가 | 3개 국가 (에이전트 3마리) |
| 전략 자유도 | 리얼타임 반응 | LLM 기반 자율 판단 |
| 토큰 소비 | 무료 입장 | 배치 비용 (50 Oil/에이전트) |
| 수익 구조 | 높은 단가/낮은 빈도 | 낮은 단가/높은 빈도 |

### 에폭별 상세 게임 메카닉

#### 평화 페이즈 (5분) — 파밍 & 준비
- 몬스터 스폰률 2x (기존 Matrix 스폰 시스템)
- 경험치 젬, 픽업 드롭 (기존 시스템)
- 레벨업 시 4개 스킬/무기 선택 (기존 55개 스킬, 20+ 무기)
- 캡처 포인트: Resource(+50% XP), Buff(+25% DMG), Healing(+3 HP/s)
- PvP OFF → 다른 플레이어와 부딪혀도 데미지 없음
- **오토헌트** 활성화 가능 (기존 Auto Hunt AI)

#### 전쟁 페이즈 (3분) — PvP 전투
- PvP ON: 다른 국적 플레이어를 공격 가능
- 같은 국적/동맹 = 아군 (공격 불가)
- **킬 스코어**: 적 플레이어 킬 = 15점 Nation Score
- **레벨 스코어**: 현재 레벨 × 10점
- **데미지 스코어**: 총 데미지 × 0.5점
- **생존 스코어**: 생존 시간 보너스 100점
- 몬스터도 계속 스폰 → PvE와 PvP를 동시에 처리하는 멀티태스킹
- 캡처 포인트 점령 = 30 war score 추가

#### 수축 페이즈 (2분) — 배틀로얄
- 아레나 반경: 3000px → 1000px (기존 arena shrink 시스템)
- 존 밖 대미지: 초당 HP 5%
- 최종 생존자가 가장 높은 Nation Score 기여
- 데이터 버스트 이벤트 (기존 BreakTime): x3 스폰, x2 XP

### v3 시스템 온라인 처리 방침

| 시스템 | 온라인 모드 | 이유 |
|--------|-----------|------|
| **ComboCounter** | 클라이언트 로컬 유지 | PvE 전용 시각 피드백, PvP에 영향 없음 |
| **BreakTime (데이터 버스트)** | 서버 동기화 (에폭 타이머 기반) | 모든 클라이언트 동시 발동 필요 |
| **QuizChallenge** | 클라이언트 로컬 유지 | 개인 미션, 보상은 로컬 버프 |

---

## 6. 토큰 경제 통합

### 토큰 수익 구조 (Play-to-Earn)

#### A. 에폭 보상 (10분마다)
```
에폭 종료 →
  1. Nation Score 합산 (킬×15 + 레벨×10 + 데미지×0.5 + 생존 100)
  2. 지배 국적 판정 (1위 국적)
  3. 보상 계산:
     - 기본: 0.01 국가토큰 / Nation Score 포인트
     - 전쟁 승리: 2x 배율
     - MVP (에폭 1위): 1.5x 배율
     - 직접 플레이: 1.5x 배율
     - 주권 보너스: +20%, 패권 보너스: +50%
  4. 일일 상한: 5,000 토큰/플레이어/일
  5. 보상 큐: MaxPendingRewards=1,000 (FIFO — 초과 시 가장 오래된 보상 evict)
```

> ⚠️ **구현 주의**: `NationScoreTracker.Reset()`이 에폭마다 호출되므로,
> `ScoreAggregator`는 독립적인 히스토리를 유지해야 합니다 (tracker 직접 참조 X).
> 에폭 종료 시점에 `GetScores()` 스냅샷을 저장한 뒤 `Reset()` 호출.

#### B. 주권/패권 보상 (지속 보유)
| 보상 유형 | 조건 | 보상 |
|-----------|------|------|
| 주권 일일 보너스 | 24시간 연속 지배 | 5 국가토큰/일 |
| 패권 주간 보너스 | 7일 연속 주권 | 100 $AWW + 10 $AWW/멤버 |
| 국가 방어 보너스 | 토큰 시가총액 기반 | 토큰 발행량 조절 (issuanceMod = 1.0 - buff×0.5, 최소 50% 발행). ※ 인게임 방어력 직접 버프가 아닌 **Anti-Inflation 메커니즘** |

#### C. 시즌 보상 (4주 시즌 종료)
- 최종 순위별 $AWW 에어드롭
- 시즌 스테이킹 수익 (1.25x ~ 2.5x 배율)
- Hall of Fame 기록

### 토큰 소비 구조 (Earn-to-Play)

#### A. 인게임 직접 효과 (토큰 보유량 기반 — 소각 아님)
| 보유량 | XP 부스트 | 스탯 버프 | 특수 스킬 | 거버넌스 |
|--------|----------|----------|----------|---------|
| 100+ | +10% | — | — | 투표 가능 |
| 1,000+ | +10% | +5% 전체 | — | 제안 가능 |
| 10,000+ | +15% | +5% 전체 | "Rally" 스킬 | 2x 투표 가중 |
| 100,000+ | +20% | +10% 전체 | "Inspire" 스킬 | 거버넌스 마스터 |

#### B. 토큰 소각 (5대 Sink)
| Sink | 소각량 | 메커니즘 |
|------|--------|---------|
| 전쟁 선포 | 500~2,000 $AWW | 소형/경제/대형 전쟁 비용 (meta WarManager — 팩션 기반. ※ v14 WarSystem(국적 기반)과 별개 시스템) |
| GDP 부스트 | 100~1,000 $AWW | 50% 소각, 50% 국고 |
| 거버넌스 투표 | 사용 토큰의 10% | 제곱근 가중 투표 |
| 조기 언스테이킹 | 스테이킹의 20% | 시즌 중도 해지 페널티 |
| 주권 경매 | 낙찰가의 80% | 48시간 영국식 경매 |

#### C. 자동 바이백 (GDP Tax)
- 국가 GDP 세금의 5% → $AWW 자동 매입 (기존 BuybackEngine)
- 시즌당 순소각 > 순발행 (디플레이션 설계)

### 토큰 플로우 다이어그램
```
           ┌────────────────────────┐
           │  PLAY (Matrix Arena)   │
           │  킬/생존/캡처          │
           └──────────┬─────────────┘
                      │ Nation Score
                      ▼
           ┌────────────────────────┐
           │  EARN (Token Rewards)  │
           │  국가토큰 + $AWW       │
           └──────────┬─────────────┘
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
   ┌────────────────┐  ┌─────────────────┐
   │  HOLD (Buffs)  │  │  SPEND (Burns)  │
   │  XP/스탯 부스트  │  │  전쟁/GDP/투표   │
   │  특수 스킬      │  │  경매/언스테이크  │
   └────────┬───────┘  └────────┬────────┘
            │                   │
            ▼                   ▼
   ┌────────────────┐  ┌─────────────────┐
   │  INVEST (DEX)  │  │  BURN (소각)    │
   │  토큰 매입      │  │  영구 제거       │
   │  방어력 증가    │  │  디플레이션      │
   └────────────────┘  └─────────────────┘
```

### Anti-Cheat 토큰 보호

| 위협 | 대응 |
|------|------|
| 봇 파밍 | 최소 계정 레벨 3 필수, CAPTCHA 주기적 |
| 킬 위조 | 서버 KillValidator (거리/쿨다운/무기범위 검증) |
| 속도 핵 | 서버 위치 검증 (이동속도 상한 체크) |
| 담합 (윈트레이딩) | 같은 IP/디바이스 동일 팩션 제한, 킬 패턴 분석 |
| 토큰 인플레이션 | DefenseOracle (시가총액↑ → 발행량↓), 일일 5,000 상한 |
| 세탁 거래 | TWAP 가격, 1시간 이동평균, 시즈 시 48시간 전송 잠금 |

---

## 7. Matrix ↔ 서버 동기화 설계

### 7.1 WebSocket 프로토콜

기존 Socket.IO 프로토콜을 확장한다. 새 이벤트만 추가하고 기존 이벤트는 유지.

#### 클라이언트 → 서버 (Uplink, 10Hz)

| 이벤트 | 페이로드 | 설명 |
|--------|---------|------|
| `matrix_join` | `{ countryCode, build?, agentId? }` | 국가 아레나 입장 |
| `matrix_leave` | `{}` | 아레나 퇴장 |
| `matrix_input` | `{ x, y, angle, boost, tick }` | 플레이어 위치+입력 (10Hz) |
| `matrix_kill` | `{ targetId, weaponId, damage, distance, tick }` | 킬 리포트 (서버 검증) |
| `matrix_damage` | `{ targetId, weaponId, damage, tick }` | PvP 데미지 리포트 |
| `matrix_capture` | `{ pointId }` | 캡처 포인트 진입 |
| `matrix_level_up` | `{ choiceId }` | 레벨업 스킬 선택 |

#### 서버 → 클라이언트 (Downlink, 20Hz)

| 이벤트 | 페이로드 | 설명 |
|--------|---------|------|
| `matrix_state` | `{ players[], epochPhase, timer, scores }` | 월드 상태 (20Hz) |
| `matrix_epoch` | `{ phase, countdown, config }` | 에폭 전환 알림 |
| `matrix_spawn_seed` | `{ seed, waveId, tick }` | 몬스터 스폰 시드 |
| `matrix_kill_confirmed` | `{ killerId, targetId, score }` | 킬 확정 (서버 검증 통과) |
| `matrix_kill_rejected` | `{ reason }` | 킬 거부 (치팅 의심) |
| `matrix_score` | `{ nationScores, personalScore, rank }` | 실시간 스코어 |
| `matrix_result` | `{ rankings[], rewards[], mvp }` | 에폭 결과 |
| `matrix_capture_state` | `{ points[]{id, owner, progress} }` | 캡처 포인트 상태 |
| `matrix_buff` | `{ tokenBuffs, captureBuffs }` | 활성 버프 목록 |

### 7.2 상태 동기화 포맷

#### `matrix_state` 패킷 (20Hz, 아레나당)
```json
{
  "tick": 12345,
  "phase": "war",
  "timer": 142.5,
  "players": [
    {
      "id": "p1",
      "x": 1500, "y": 2300,
      "hp": 85, "maxHp": 100,
      "level": 12,
      "nation": "KOR",
      "isAlly": true,
      "weapons": ["cannon", "orb"],
      "status": ["haste", "shield"]
    }
  ],
  "captures": [
    { "id": "resource", "owner": "KOR", "progress": 0.75 },
    { "id": "buff", "owner": null, "progress": 0 },
    { "id": "healing", "owner": "USA", "progress": 1.0 }
  ],
  "nationScores": { "KOR": 4500, "USA": 3200, "JPN": 2800 },
  "safeZoneRadius": 2500
}
```

**최적화**:
- Delta compression: 변경된 플레이어만 전송 (풀 스테이트 5초마다)
- 뷰포트 컬링: 플레이어 화면 범위 밖의 엔티티 생략
- Binary: JSON → MessagePack 압축 (50% 감소)

### 7.3 결정론적 몬스터 스폰 시드

```
서버 (EpochManager)
  │
  │ epoch_start → seed = hash(epochId + arenaCode + timestamp)
  │
  │ matrix_spawn_seed { seed: 0xA3F2..., waveId: 1, tick: 0 }
  ├──────────────────────────────────────────────────►
  │                                    Client A
  │                                    seedRNG(0xA3F2...)
  │                                    spawnWave(waveId=1)
  │                                    → 동일한 적 타입/위치/수
  │
  ├──────────────────────────────────────────────────►
  │                                    Client B
  │                                    seedRNG(0xA3F2...)
  │                                    spawnWave(waveId=1)
  │                                    → 동일한 적 타입/위치/수
  │
  │ 매 30초마다 새 waveId + seed 배포
```

모든 클라이언트가 동일한 RNG 시드를 사용하여 같은 몬스터를 로컬에서 스폰한다. 서버는 스폰 자체를 시뮬레이션하지 않고 **시드만 배포**하면 되므로 부하 최소화.

**⚠️ 구현 주의사항**: 현재 `spawning.ts`는 `Math.random()` 직접 사용 — 시드 RNG 없음. 엔티티 ID도 `Math.random().toString()`. 구현 시:
1. **시드 RNG 라이브러리 도입** (예: `seedrandom` 또는 커스텀 xoshiro256) → `spawning.ts` 래핑
2. **엔티티 ID 서버화**: 몬스터 ID는 `seed + waveId + spawnIndex`로 결정론적 생성
3. **대안**: 시드 방식이 복잡하면 서버가 직접 `matrix_spawn` 이벤트로 스폰 명령 전송 (부하 증가하지만 확실한 동기화)

### 7.4 킬 검증 파이프라인

```
Client: matrix_kill { targetId: "p2", weaponId: "cannon", damage: 45, distance: 150, tick: 12345 }
  │
  ▼
Server KillValidator:
  1. 틱 검증: |server_tick - client_tick| < 5 (250ms 이내)
  2. 거리 검증: distance(killer.pos, target.pos) < weapon.range × 1.2
  3. 쿨다운 검증: lastFire[weapon] + cooldown < current_tick
  4. 데미지 검증: damage <= weapon.maxDamage × 1.1 (10% 허용 오차)
  5. 상태 검증: killer.alive && target.alive
  │
  ├─ 모두 통과 → matrix_kill_confirmed { score: 15 }
  └─ 하나라도 실패 → matrix_kill_rejected { reason: "distance" }
     + suspicion_score[killer] += 1
     + suspicion >= 10 → 자동 킥 + 24시간 밴
```

### 7.5 클라이언트 예측 + 서버 보정

```
Client (60fps):
  - 자기 캐릭터: 로컬 물리/충돌 시뮬레이션 (즉각 반응)
  - 다른 플레이어: 서버 위치를 보간 (lerp, 50ms 딜레이)
  - 몬스터: 로컬 AI 시뮬레이션 (시드 기반, 서버와 동일)
  - 킬/데미지: 로컬 즉시 적용 → 서버 확인 대기 → rejected면 롤백

Server (20Hz):
  - 플레이어 위치 수신 → 속도 검증 → 다른 클라이언트에 배포
  - 킬 리포트 수신 → KillValidator → confirmed/rejected 전송
  - 에폭 상태 전환 → 전체 브로드캐스트
  - 스코어 집계 → 5초마다 스코어보드 전송
```

---

## 8. 리스크

| # | 리스크 | 영향도 | 발생확률 | 완화 전략 |
|---|--------|--------|---------|----------|
| R1 | **서버 부하 폭증**: 195개 아레나 × 50명 × 20Hz = 서버 메모리/CPU 과부하 | Critical | Medium | Lazy init (활성 아레나만), 비활성 아레나 5초→30초 틱 다운그레이드, Go 고루틴 풀 제한 |
| R2 | **네트워크 지연**: 글로벌 유저 대상 50ms 미만 보장 어려움 | High | High | 클라이언트 예측(로컬 시뮬), 위치 보간 100ms 버퍼, 킬 검증에 250ms 허용 오차 |
| R3 | **치팅/핵**: 클라이언트 로컬 시뮬의 메모리 조작, 속도핵, 데미지핵 | Critical | High | KillValidator 서버 검증, 속도 상한 검증, suspicion score 누적 → 자동 밴, 킬캠 리플레이 |
| R4 | **토큰 인플레이션**: 봇 파밍으로 토큰 과잉 발행 | Critical | Medium | 일일 5,000 상한, DefenseOracle 동적 발행량 조절, CAPTCHA, 계정 레벨 3 필수 |
| R5 | **클라이언트 성능**: 50명 + 200 몬스터 + 투사체 Canvas 2D 렌더링 부하 | High | Medium | 뷰포트 컬링, LOD 시스템, 오프스크린 엔티티 스킵, 파티클 상한 200개 |
| R6 | **동기화 오차**: 시드 기반 몬스터 스폰의 클라이언트간 불일치 | Medium | Low | 고정소수점 RNG, 30초마다 시드 재동기화, 서버 시드 권위적 |
| R7 | **경제 불균형**: 인구 많은 국가(US/CN/KR)가 보상 독점 | High | High | 인구 가중 스코어: `adjustedScore = rawScore / sqrt(activePlayerCount)`, 소규모 국가(5명 이하) 언더독 보너스 +30% |
| R8 | **에이전트 vs 인간 밸런스**: SDK 에이전트가 24/7 파밍으로 인간 이점 잠식 | Medium | Medium | 직접 플레이 1.5x 배율, 에이전트 배치 비용(50 Oil), 에이전트 3마리 상한 |
| R9 | **DB 병목**: 에폭당 195개 아레나 × 50명 보상 동시 쓰기 | High | Medium | 보상 배치 처리(에폭당 1회 벌크 INSERT), Redis 캐시 중간 집계, PG 파티셔닝 |
| R10 | **시즌 리셋 혼란**: 토큰은 온체인 보존인데 레벨/빌드 리셋 → 유저 이탈 | Medium | Medium | 시즌 프리뷰 1주 전 공지, 시즌 보상 매력적(에어드롭), 리셋 범위 명확 안내 |

---

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: 서버 OnlineMatrixEngine 코어
| Task | 설명 |
|------|------|
| PlayerSession 구현 | `server/internal/game/matrix_session.go` — 플레이어별 상태 관리 (HP, 레벨, 무기, 위치, 킬, 데미지), 입장/퇴장 라이프사이클 |
| MonsterSeedSync 구현 | `server/internal/game/matrix_seed.go` — 에폭 시작 시 결정론적 RNG 시드 생성, 30초마다 waveId 갱신, 시드 배포 함수 |
| KillValidator 구현 | `server/internal/game/matrix_validator.go` — 거리/쿨다운/데미지/상태 4단계 검증, suspicion score 누적, 자동 밴 |
| ScoreAggregator 구현 | `server/internal/game/matrix_score.go` — 킬(15점)+레벨(×10)+데미지(×0.5)+생존(100점) 합산, Nation Score 연동 |
| EpochRewardCalculator 구현 | `server/internal/game/matrix_reward.go` — 에폭 종료 시 보상 계산 (배율: 전쟁승리 2x, MVP 1.5x, 직접플레이 1.5x, 주권/패권 보너스), TokenRewardManager 연동 |
| TokenBuffApplier 구현 | `server/internal/game/matrix_buff.go` — 토큰 보유량 → XP 부스트/스탯 버프/특수 스킬 해금 변환 |

- **design**: N (서버 로직)
- **verify**: `cd server && go build ./...` 성공, 유닛 테스트 통과

### Phase 2: WebSocket 프로토콜 확장
| Task | 설명 |
|------|------|
| matrix 이벤트 라우터 | `server/internal/network/matrix_handler.go` — matrix_join/leave/input/kill/damage/capture/level_up 이벤트 핸들링 |
| Uplink 처리 | matrix_input (10Hz 위치 수신 + 속도 검증), matrix_kill (KillValidator 호출), matrix_damage (PvP 데미지 처리) |
| Downlink 브로드캐스터 | matrix_state (20Hz, 초기 풀스냅샷 후 delta only), matrix_epoch (에폭 전환), matrix_spawn_seed, matrix_score, matrix_result. ⚠️ 50명×20Hz 시 대역폭 부하 — Phase 2에서 기본 delta 구현 필수 (Phase 8에서 MessagePack 고도화) |
| CountryArena 통합 | 기존 `country_arena.go`에 OnlineMatrixEngine 마운트, Room state machine에 matrix 상태 추가 |
| 에폭 연동 | EpochManager phase 전환 → matrix 클라이언트에 `matrix_epoch` 브로드캐스트, 평화/전쟁/수축 PvP 토글 |

- **design**: N (네트워크 프로토콜)
- **verify**: WebSocket 연결 테스트, 이벤트 라운드트립 확인, `go build ./...` 성공

### Phase 3: 클라이언트 온라인 연결 레이어
| Task | 설명 |
|------|------|
| MatrixSocket 훅 | `apps/web/hooks/useMatrixSocket.ts` — matrix_join/leave/input/kill 전송, matrix_state/epoch/result 수신, 연결 상태 관리. ⚠️ 기존 WebSocket은 raw WS (Socket.IO 아님), 커스텀 JSON 프레이밍 `{e: event, d: data}` |
| 서버 상태 동기화 | `apps/web/lib/matrix/systems/online-sync.ts` — 서버 matrix_state → 다른 플레이어 보간, 스코어 업데이트, 에폭 페이즈 반영 |
| 시드 RNG 라이브러리 도입 | `seedrandom` 또는 커스텀 xoshiro256 도입 → `spawning.ts`를 래핑하는 `seeded-spawning.ts` 생성. 엔티티 ID도 `seed+waveId+index` 결정론적 생성 (현재 `Math.random()` 직접 사용 중이므로 리팩토링 필요) |
| MatrixApp 온라인 모드 분기 | MatrixApp.tsx (5200줄)에 `online` 모드 분기 추가: 로컬 Ref → 서버 상태 통합, 게임 루프에 "서버 상태 처리" 경로 추가, Web Worker 틱에 서버 이벤트 큐 처리 |
| 클라이언트 예측/보정 프레임워크 | `apps/web/lib/matrix/systems/client-prediction.ts` — 자기 캐릭터 로컬 시뮬 + 서버 위치 보정 (snap/lerp), 킬 confirm/reject 롤백 시스템 (현재 3D 모드는 단순 보간만 사용, 풀 예측+롤백은 신규 개발) |
| 킬 리포트 시스템 | 로컬 킬 발생 → matrix_kill 전송 → 서버 confirmed/rejected 수신 → rejected면 킬 롤백 + suspicion 카운터 |
| 레벨업 서버화 | 레벨업 선택지를 서버에서 생성하여 전송 (공정성 보장). 현재 `useSkillBuild` 훅이 클라이언트에서 `Math.random()`으로 생성 → 서버 `matrix_level_up_choices` 이벤트로 교체 |
| 에폭 UI 연동 | matrix_epoch 수신 → 6개 페이즈 전환 (peace/war_countdown/war/shrink/end/transition), PvP 토글, 카운트다운 타이머, 전쟁 경고 |

- **design**: N (로직 레이어)
- **verify**: `cd apps/web && npx next build` 성공, 로컬에서 서버 연결 + 에폭 수신 확인

### Phase 4: 멀티플레이어 렌더링
| Task | 설명 |
|------|------|
| 다른 플레이어 렌더링 | 서버에서 수신한 players[] → Canvas 2D에 캐릭터 렌더링, 국적별 색상, 아군/적군 표시, 체력바 |
| 위치 보간 (lerp) | 20Hz 서버 상태 → 60fps 클라이언트에서 부드럽게 보간, 100ms 보간 버퍼 |
| PvP 전투 시각효과 | 전쟁 페이즈 PvP 히트 이펙트, 킬 알림 팝업, 킬피드 UI |
| 네임태그 + 국적 | 다른 플레이어 머리 위 닉네임, 국적 코드, HP바, 레벨 표시 |
| 뷰포트 컬링 최적화 | 화면 밖 플레이어/몬스터 렌더링 스킵, LOD 기반 원거리 단순화 |

- **design**: Y (PvP 시각 효과, 킬피드 UI)
- **verify**: 2명+ 동시 접속 시 상대방 캐릭터 보이는지, 전쟁 페이즈 PvP 히트 이펙트 확인

### Phase 5: 에폭 HUD + 스코어보드
| Task | 설명 |
|------|------|
| EpochHUD 리디자인 | 현재 에폭 페이즈 표시 (평화/전쟁/수축), 남은 시간 카운트다운, 전쟁 경고 오버레이 |
| 국가 스코어보드 | 실시간 Nation Score 순위 (3~5개국), 내 국가 하이라이트, 에폭 종료 시 풀 스코어보드 |
| 캡처 포인트 UI | 미니맵에 3개 캡처 포인트 위치, 점령 상태(색상), 점령 중 프로그레스 바 |
| 에폭 결과 화면 | matrix_result 수신 → 국가별 순위, 개인 성과, 토큰 보상액, MVP 표시 |
| 토큰 버프 표시 | 현재 활성 토큰 버프 (XP 부스트, 스탯 버프, 특수 스킬) 아이콘 + 툴팁 |

- **design**: Y (에폭 HUD, 스코어보드, 결과 화면)
- **verify**: 에폭 전환 시 UI 변화 확인, 전쟁 경고 표시, 결과 화면 렌더링

### Phase 6: 토큰 경제 연동
| Task | 설명 |
|------|------|
| 보상 지급 플로우 | 에폭 종료 → EpochRewardCalculator → TokenRewardManager → DB 기록 + 온체인 전송 큐 |
| 토큰 버프 조회 API | GET /api/matrix/buffs — 보유 토큰량 → 버프 테이블 조회, 클라이언트에 matrix_buff 이벤트 |
| 토큰 보유량 캐시 | Redis에 플레이어별 토큰 보유량 캐시 (5분 TTL), DefenseOracle 연동 |
| 보상 히스토리 UI | 마이페이지에서 에폭별 보상 내역 조회, 일/주/시즌 합산 |
| 일일 상한 적용 | 일일 5,000 토큰 상한 체크, 상한 도달 시 "MAX EARNED TODAY" 알림 |

- **design**: N (서버 로직 + API)
- **verify**: 에폭 종료 후 토큰 보상 DB 기록 확인, 일일 상한 작동 확인

### Phase 7: 에이전트 SDK 통합
| Task | 설명 |
|------|------|
| MatrixGameClient 신규 구현 | `aww-agent-skill/src/matrix-client.ts` 신규 생성. 기존 GameClient({angle,boost})와 별개로 matrix 전용 입력({x,y,angle,boost,tick}) + 클라이언트 킬 리포팅 지원. Wire format은 기존과 동일(`{e,d}` JSON) |
| MatrixStrategy 인터페이스 | 기존 Strategy({angle,boost} 반환)와 별개로 MatrixStrategy({x,y,angle,boost} 반환) 인터페이스 정의. 기존 3 전략(aggressive/balanced/defensive)에서 MatrixStrategy 어댑터 생성 |
| matrix_agent_state 이벤트 | 기존 agent_state(x,y,angle,speed,size,kills,rank)와 별개로 matrix 전용 상태 이벤트 추가: HP, 레벨, 무기, 주변 적, 좌표. 서버→에이전트 10Hz 전송 |
| LLM 국가 배치 전략 | Layer 2 strategicTick 확장: "어느 국가 아레나에 배치할지" 판단 (인구, 보상률, 경쟁도 기반). Layer 2 REST API 100% 호환이므로 기존 SDK 수정 없음 |
| 에이전트 배치 비용 | 에이전트 1마리 배치 = 50 Oil 소비, 최대 3마리 동시 배치. Layer 2 API로 배치 요청 |
| 서버 에이전트 핸들러 | Go 서버에 `matrix_agent_input` 이벤트 핸들러 추가. 기존 `agent_input` 핸들러와 별도. KillValidator에 에이전트 입력도 동일 기준 적용 |

- **design**: N (SDK 확장)
- **verify**: MatrixGameClient로 matrix 아레나 입장 → 자동 전투 → 킬 리포팅 → 보상 수신 전체 플로우 확인. Layer 2 strategicTick 국가 배치 동작 확인

### Phase 8: 통합 테스트 + 성능 최적화
| Task | 설명 |
|------|------|
| 멀티플레이어 통합 테스트 | 5명+ 동시 접속 → 에폭 사이클 → PvP → 보상 지급 end-to-end 검증 |
| 서버 부하 테스트 | 50명/아레나 × 10 아레나 동시 시뮬레이션, CPU/메모리 프로파일링 |
| Delta compression | matrix_state 패킷 delta 압축 (변경 필드만 전송), MessagePack 적용 |
| 클라이언트 성능 최적화 | 50명 + 200몬스터 시 60fps 유지, 파티클 상한, 오프스크린 스킵 |
| 안티치트 통합 테스트 | 속도핵/킬위조/데미지핵 시뮬레이션 → KillValidator 탐지 확인 |
| 빌드 최종 검증 | `npx tsc --noEmit` + `go build ./...` + Vercel preview 배포 |

- **design**: N (테스트/최적화)
- **verify**: 50명 동시 접속 시 서버 CPU < 80%, 클라이언트 60fps, 치트 탐지율 > 95%, 빌드 성공

## Verification

1. `cd server && go build ./...` — 0 errors
2. `cd apps/web && npx next build` — 0 errors
3. 글로브 → 국가 클릭 → "ENTER ARENA" → Matrix 아레나 입장
4. 에폭 사이클: 평화(5분) → 전쟁 경고(10초) → 전쟁(3분) → 수축(2분) → 결과(5초)
5. 2명+ 동시 접속 → 상대방 캐릭터 렌더링, 위치 보간 부드러움
6. 전쟁 페이즈 PvP: 다른 국적 공격 가능, 같은 국적 공격 불가
7. 킬 → 서버 검증 → Nation Score 적립
8. 에폭 종료 → 토큰 보상 지급 확인
9. 캡처 포인트 점령 → 버프 적용
10. MatrixGameClient (에이전트 SDK) → 아레나 입장 → 자동 전투 → 킬 리포팅 → 보상 수신
11. 50명/아레나 부하 테스트 → 서버 안정, 60fps 유지
