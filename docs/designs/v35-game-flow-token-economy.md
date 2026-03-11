# AI World War — 전체 게임 흐름 & 토큰 이코노미 정밀 분석

> **v35 — 전체 시스템 정밀 분석 문서**
> 기존 기획서 132건(v10~v37) + 실제 코드베이스 크로스 레퍼런스 기반
> 작성일: 2026-03-10
>
> **이 문서의 목적**: 게임의 모든 시스템 간 관계를 하나의 그림으로 통합하여,
> 어떤 플레이어 행동이 어떤 재화/보상/경제적 결과로 이어지는지 **완전한 순환 경제**를 가시화한다.
>
> **v35.1 업데이트**: 메타게임 시스템(팩션/외교/전쟁/경제/인텔/거버넌스/월드) +
> AI 에이전트 SDK + Go 서버 아키텍처 전체 추가 (2026-03-10)

---

## 목차

### Part A: 전투 계층 (Battle Layer)
1. [게임 전체 흐름 (Master Flow)](#1-게임-전체-흐름)
2. [3-Layer 게임 구조](#2-3-layer-게임-구조)
3. [인게임 경제 루프 (매치 내부)](#3-인게임-경제-루프)
4. [온라인 토큰 경제 (에포크 시스템)](#4-온라인-토큰-경제)
5. [메타 경제 & 재화 흐름](#5-메타-경제--재화-흐름)
6. [3-Tier 재화 체계](#6-3-tier-재화-체계)

### Part B: 메타게임 계층 (Meta-Game Layer) — NEW
7. [팩션 시스템 (Faction System)](#7-팩션-시스템)
8. [외교 시스템 (Diplomacy System)](#8-외교-시스템)
9. [전쟁 시스템 (War System)](#9-전쟁-시스템)
10. [경제 시스템 (Economy System)](#10-경제-시스템)
11. [인텔 시스템 (Intel System)](#11-인텔-시스템)
12. [거버넌스 & 주권 시스템 (Governance)](#12-거버넌스--주권-시스템)
13. [월드 시스템 (World System)](#13-월드-시스템)

### Part C: 에이전트 계층 (Agent Layer) — NEW
14. [AI 에이전트 SDK (Agent Skill)](#14-ai-에이전트-sdk)
15. [Go 서버 아키텍처](#15-go-서버-아키텍처)
16. [블록체인 & 토큰 시스템](#16-블록체인--토큰-시스템)

### Part D: 분석 & 현황
17. [밸런스 분석 & 핵심 수치](#17-밸런스-분석--핵심-수치)
18. [구현 현황 Gap 분석](#18-구현-현황-gap-분석)
19. [Excalidraw 다이어그램 인덱스](#19-excalidraw-다이어그램-인덱스)

---

## 1. 게임 전체 흐름 (Master Flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI WORLD WAR — MASTER FLOW                          │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │ 1. GLOBE │───→│ 2.COUNTRY│───→│ 3.MATRIX │───→│ 4. EPOCH RESULT     │  │
│  │ 3D 지구본 │    │ 국가 선택│    │ 전투 진입│    │ (10분15초 사이클)    │  │
│  │ 195개국  │    │ 아레나   │    │ PvE+PvP │    │ Nation Score 집계   │  │
│  └──────────┘    └──────────┘    └──────────┘    └─────────┬────────────┘  │
│       ▲                                                      │              │
│       │           ┌────────────────────────────────────────┘              │
│       │           ▼                                                       │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐                     │
│  │ 8.LOBBY  │←───│ 7. SPEND    │←───│ 6. BRIDGE    │                     │
│  │ 다시 출격│    │ 소비/투자   │    │ 토큰 교환   │                     │
│  │ 더 강해짐│    │ 업그레이드  │    │ Score→Token  │                     │
│  └──────────┘    │ 전쟁선포    │    │ Epoch정산    │                     │
│                  │ GDP부스트   │    │ Season정산   │                     │
│                  └──────────────┘    └──────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘

핵심 루프: PLAY → EARN → BRIDGE → SPEND → PLAY (무한 순환)
```

### 1.0 전체 시스템 상호연결도 (v35.1 추가)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI WORLD WAR — COMPLETE SYSTEM MAP                    │
│                                                                          │
│ ┌── AGENT LAYER (Layer 1) ──────────────────────────────────────────┐   │
│ │  AWW Agent SDK (@aww/agent-sdk)                                    │   │
│ │  ├── GameClient (WS v1, 10Hz Combat)                               │   │
│ │  ├── MetaClient (REST v11, 46 Endpoints)                           │   │
│ │  ├── 6 Domains (Faction/Diplomacy/War/Economy/Intel/World)         │   │
│ │  ├── LLM Bridge (Claude/GPT/Gemini/OpenRouter/Llama)               │   │
│ │  └── NationAgent (30s Strategic Tick, 16 Actions, 5 Personalities) │   │
│ └──────────────────────────┬────────────────────────────────────────┘   │
│                             │ REST + WebSocket                           │
│ ┌── GO SERVER (20Hz) ──────┴───────────────────────────────────────┐   │
│ │  WorldManager (195국)                                              │   │
│ │  ├── CountryArena (50 concurrent, on-demand pool)                  │   │
│ │  ├── EpochManager (10m15s cycle, 6 phases)                         │   │
│ │  ├── DominationEngine (1hr eval) → SovereigntyTracker (24h→7d)     │   │
│ │  ├── WarSystem (state machine: declare→prep→active→end)            │   │
│ │  ├── CrossArenaManager (invasion during war)                       │   │
│ │  └── MatrixEngine (6 subsystems: session/spawn/kill/score/reward)  │   │
│ │                                                                     │   │
│ │  Meta Systems                                                       │   │
│ │  ├── FactionManager (CRUD + treasury + 6 resources)                │   │
│ │  ├── DiplomacySystem (5 treaty types, war declarations)            │   │
│ │  ├── EconomyEngine (GDP + Trade OrderBook + TechTree 12 nodes)     │   │
│ │  ├── PolicyEngine (4 sliders + 10 civ categories × 3 levels)       │   │
│ │  ├── IntelSystem (scout/sabotage/counter-intel)                    │   │
│ │  ├── CouncilSystem (UN Security Council, 5 resolution types)       │   │
│ │  ├── SeasonEngine (4 Era × 4 weeks)                                │   │
│ │  ├── EventEngine (6 event types, max 10 concurrent)                │   │
│ │  └── AuctionEngine (48h sovereignty auction, 80% burn)             │   │
│ │                                                                     │   │
│ │  Blockchain Bridge                                                  │   │
│ │  ├── ForgePriceService ($AWW price, 5min poll)                     │   │
│ │  ├── DefenseOracle (market cap → defense ×1.0~5.0)                 │   │
│ │  ├── BuybackEngine (5% GDP tax → token buyback)                    │   │
│ │  └── CROSS Ramp (HMAC webhooks, mint/burn)                         │   │
│ └──────────────────────────┬────────────────────────────────────────┘   │
│                             │ WS 20Hz + REST + 1Hz Broadcast             │
│ ┌── CLIENT (Next.js) ──────┴──────────────────────────────────────┐    │
│ │  3D Globe (three-globe + R3F)                                     │    │
│ │  ├── 20 Globe* components (interaction/labels/effects/trails)     │    │
│ │  ├── War effects (missiles/shockwaves/nukes)                      │    │
│ │  └── Diplomacy visuals (alliance beams/sanction barriers/trade)   │    │
│ │                                                                    │    │
│ │  Lobby/Hub UI                                                      │    │
│ │  ├── FactionList/Detail (join/create/treasury)                     │    │
│ │  ├── UNCouncil (vote/propose/veto)                                 │    │
│ │  ├── PolicyManager (10 civ policies)                               │    │
│ │  ├── MercenaryMarket (hire/deploy)                                 │    │
│ │  └── CivilizationPanel (stats/policies/domination)                 │    │
│ │                                                                    │    │
│ │  Matrix Battle UI                                                  │    │
│ │  ├── MatrixGameCanvas (WebSocket 10Hz sync)                        │    │
│ │  ├── EpochHUD + NationScoreboard + CapturePointUI                  │    │
│ │  ├── TokenBuffDisplay + RewardHistoryPanel                         │    │
│ │  └── 57 Skill Icons + 55 Military-themed Skills                    │    │
│ └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│ ┌── BLOCKCHAIN (CROSS Mainnet) ───────────────────────────────────┐    │
│ │  $AWW Token (0xfD48...) | 1B Supply | Forge Pool Price           │    │
│ │  195 National Tokens ($KOR, $USA, ...) | CROSSx Wallet            │    │
│ │  Settlement Gate: Score → Token → On-chain → DEX                  │    │
│ └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 플레이어 여정 상세

| 단계 | 행동 | 획득 재화 | 소모 재화 | 연결 시스템 |
|------|------|----------|----------|------------|
| **① 접속** | CROSSx 지갑 연결 → 팩션 선택/생성 | — | — | Auth + Faction |
| **② 글로브** | 3D 지구본에서 국가 선택 | — | Oil (원거리 배치 비용) | MapLibre + three-globe |
| **③ 아레나 진입** | 캐릭터(9종) 선택 → Matrix 전투 | — | — | Character Select |
| **④ 전투** | PvE 파밍 (Peace) → PvP 킬 (War) | XP, Gold, Score | HP, 시간 | Matrix Engine |
| **⑤ 에포크 종료** | Nation Score 집계 → 토큰 보상 | $AWW, 국가토큰 | — | Epoch + Token Reward |
| **⑥ 정산** | 토큰 온체인 브릿지 (선택) | 온체인 자산 | 5% 소각 수수료 | Settlement Gate |
| **⑦ 소비** | 업그레이드, 전쟁 선포, 거버넌스 | 게임 내 효과 | $AWW, 국가토큰 | Economy Systems |
| **⑧ 재출격** | 더 강해진 상태로 재진입 | — | — | Persistent Upgrades |

---

## 2. 3-Layer 게임 구조

AI World War는 3개의 레이어가 중첩된 구조입니다.

### Layer 1: AGENT (에이전트 레이어)
> 출처: v11-world-war-plan.md §8, aww-agent-skill SDK

```
에이전트 훈련 → 빌드 프로필 설정 → 전투 규칙 정의 → 배치
- REST API: /api/v11/* (전략 커맨드)
- WebSocket: MatrixGameClient (전투 실시간)
- LLM 통합: Claude/GPT/Gemini (30초 주기 의사결정)
- Commander Mode: AI→수동 전환 (1초 무적, 30초 유휴 시 AI 복귀)
```

### Layer 2: BATTLE (전투 레이어)
> 출처: v10 plan, v29 faithful port, v32 matrix gameplay, v33 online matrix

```
5분 매치 사이클 (에포크 내 Peace 4:50 + War 3:00 + Shrink 2:00)
- Vampire Survivors 스타일 자동전투 서바이벌
- 9 캐릭터 클래스 (Neo, Morpheus, Trinity, Tank, Cypher, Niobe, Oracle, Mouse, Dozer)
- 25 무기 (5 카테고리 × Tier 1~4) + 14 분기 진화 (A/B at Lv11) + 궁극 (Lv20)
- 150+ 적 유형 + 엘리트 3단계 (Silver/Gold/Diamond)
- 10단계 콤보 (Bronze~Transcendent) + Data Burst (x3 스폰, x2 XP) + Kernel Panic (궁극기)
- 퀴즈 미션 (30~60초 주기) + 캡처 포인트 3개 (Resource/Buff/Healing)
- PvP: 전쟁 페이즈에서 0.5x 데미지 배율, 킬=15 NationScore
```

### Layer 3: META GAME (메타 레이어)
> 출처: v11 §5~7, v36 token bridge

```
세계 지도 → 국가 점령 → 팩션 경쟁 → 경제 운영 → 시즌 순환
- 195개국 (S/A/B/C/D 5티어), 5단계 주권 (Occupied→Capital)
- 6종 자원: Food, Oil, Steel, Tech, Gold, Influence
- 팩션: 3~50명, 4계층 (Supreme Leader/Council/Commander/Member)
- 외교: 불가침/무역/동맹/제재/전쟁선포/항복/조공
- 토큰 경제: $AWW 마스터 + 195 국가토큰 (CROSS Mainnet)
- 시즌: 4주 (Discovery→Expansion→Empires→Reckoning)
```

### Layer 간 상호작용 다이어그램

```
LAYER 1 (AGENT)                 LAYER 2 (BATTLE)              LAYER 3 (META)
┌─────────────┐                ┌───────────────┐              ┌──────────────┐
│ Agent SDK   │───배치 명령──→│ Matrix 전투   │──Score──────→│ Nation Score │
│ LLM Brain   │                │ PvE + PvP     │              │ 점수 합산    │
│ Build Config│←─전투 결과───│ XP/Gold/Kill  │              │              │
│ Strategy    │                │ Combo/Elite   │              │              │
└─────────────┘                └───────────────┘              └──────┬───────┘
                                       │                             │
                                   Gold/Score                   토큰 보상
                                       │                             │
                                       ▼                             ▼
                              ┌───────────────┐              ┌──────────────┐
                              │ 매치 정산     │              │ 에포크 정산  │
                              │ Credits 계산  │              │ Token 배분   │
                              │ RP 누적       │              │ 주권 판정    │
                              └───────────────┘              └──────────────┘
```

---

## 3. 인게임 경제 루프 (매치 내부)

> 출처: `combat.ts`, `game.config.ts`, `enemies.config.ts`, `items.config.ts`, `weapons.config.ts`,
> `progressive-tree.config.ts`, `combo.config.ts`, `breaktime.config.ts`, `spawn-controller.ts`,
> `elite-monster.ts`, `agent-combat.ts`, `arena-mode.ts`, `MatrixResult.tsx`

### 3.1 핵심 루프: Kill → Gem → XP → Level → Skill → Kill

```
     킬 Kill ──────────────────────┐
       │                            │
       ▼                            │ (더 강한 무기)
  젬 드롭 Gem Drop                  │
  (1~5 XP value)                    │
       │                            │
       ▼                            │
  XP 획득 & 레벨업                  │
  (20레벨, 지수 커브)               │
       │                            │
       ▼                            │
  스킬 선택 (3지선다)               │
  (5 카테고리 × Tier 1~4)          │
       │                            │
       ▼                            │
  무기 강화 / 신규 획득 ────────────┘
```

### 3.2 XP 테이블 (실제 코드 기준)

> 출처: `game.config.ts` XP_THRESHOLDS

| 레벨 | 필요 누적 XP | 레벨 간 XP | 비고 |
|------|-------------|-----------|------|
| 1 | 0 | — | 시작 |
| 2 | 100 | 100 | |
| 3 | 220 | 120 | |
| 4 | 360 | 140 | |
| 5 | 520 | 160 | Tier 2 무기 선택 가능 |
| 6 | 700 | 180 | |
| 7 | 900 | 200 | |
| 8 | 1,120 | 220 | |
| 9 | 1,360 | 240 | |
| 10 | 1,620 | 260 | Tier 3 무기 선택 가능 |
| 11 | 1,620 | — | **BRANCH 진화** (A/B 선택) |
| 15 | ~2,100 | ~120 | |
| 20 | 2,580 | — | **ULTIMATE** 해금 |

### 3.3 적 처치 보상 체계 (실제 코드 기준)

> 출처: `enemies.config.ts`, `combat.ts`, `elite-monster.ts`

**일반 적 (PvE)**

| 적 유형 | HP | Speed | Damage | Score | XP |
|---------|-----|-------|--------|-------|-----|
| glitch | 5 | 55 | 4 | 3 | 0.5 |
| bot | 15 | 50 | 8 | 8 | 1.0 |
| malware | 25 | 45 | 12 | 15 | 1.5 |
| bitling | 10 | 65 | 6 | 5 | 0.8 |
| spammer | 8 | 70 | 3 | 4 | 0.6 |
| worm | 20 | 40 | 10 | 12 | 1.2 |
| crypter | 30 | 35 | 15 | 20 | 2.0 |

**엘리트 몬스터 (Diablo 스타일 드롭)**

| 티어 | HP 배율 | Size 배율 | Speed 배율 | Damage 배율 | 드롭 개수 |
|------|---------|----------|-----------|-------------|----------|
| Silver | `avgWeaponDmg × 3` | 1.3x | 0.9x | 1.5x | 3~5 |
| Gold | `avgWeaponDmg × 6` | 1.5x | 0.8x | 2.0x | 5~8 |
| Diamond | `avgWeaponDmg × 10` | 1.8x | 0.7x | 3.0x | 8~12 |

- 출현 조건: 100~300킬 사이 (랜덤), 최소 게임 시간 충족
- 드롭 물리: 부채꼴 산개 (gravity, bounce, friction)
- 수집 지연: 드롭 후 일정 시간(ms) 경과 후 수집 가능

**PvP 킬 보상 (전쟁 페이즈 전용)**

> 출처: `agent-combat.ts`

| 항목 | 값 | 비고 |
|------|-----|------|
| PvP 데미지 배율 | 0.5x | PvE의 절반 |
| 킬 기본 Score | 15 NationScore | 고정 |
| 레벨 차이 보너스 | `levelDiff × config.levelDifferenceBonus` | 높은 레벨 적 처치 시 |
| 복수 킬 보너스 | 1.5x | 마지막으로 나를 죽인 적 처치 |
| 셧다운 보너스 | `victim.kills × 10%` | 연쇄 킬 중인 적 처치 |
| 캡처 포인트 | +30 NationScore | 거점 점령 |

### 3.4 콤보 시스템 (10단계)

> 출처: `combo.config.ts`

| 티어 | 연쇄 킬 수 | 보너스 배율 | 시각 효과 |
|------|-----------|-----------|----------|
| Bronze | 5+ | 1.1x | 기본 |
| Silver | 10+ | 1.2x | 반짝임 |
| Gold | 20+ | 1.3x | 금색 발광 |
| Diamond | 35+ | 1.5x | 다이아 파티클 |
| Platinum | 50+ | 1.7x | 플래티넘 아우라 |
| Master | 75+ | 2.0x | 에너지 폭발 |
| Grandmaster | 100+ | 2.3x | 대형 쉐이크 |
| Legend | 150+ | 2.7x | 레전드 아우라 |
| Mythic | 200+ | 3.0x | 화면 전체 효과 |
| Transcendent | 300+ | 3.5x | 초월 이펙트 |

### 3.5 특수 시스템

**Data Burst (브레이크타임)**
- 경고: 3초 카운트다운
- 활성: 10초간 적 스폰 ×3, XP ×2
- 주기: ~60초마다

**Kernel Panic (궁극기 게이지)**
- 게이지: 0~100%, 킬/콤보로 충전
- 100% 도달 시: 자동 궁극기 발동
- 궁극기: 해당 카테고리 Tier 4 스킬 (전 카테고리 T4 시 Singularity Core)

**퀴즈 미션**
- 유형: kill(N마리 처치), survive(N초 생존), combo(N콤보 달성), time_boss(N초 내 보스킬), no_hit(N초 무피격)
- 난이도: easy/medium/hard
- 보상: levelUp, heal, weapon, buff, xp, gold
- 주기: 30~60초마다

**캡처 포인트 (3종)**

| 유형 | 효과 | 컬러 | NationScore |
|------|------|------|-------------|
| Resource | +50% XP | #FBBF24 (노랑) | +30 |
| Buff | +25% DMG | #EF4444 (빨강) | +30 |
| Healing | +3 HP/s | #4ADE80 (초록) | +30 |

### 3.6 무기 진화 체계

> 출처: `progressive-tree.config.ts`, `branches.ts`, `weapons.config.ts`

```
Tier 1 (Lv1~5)   기본 무기, 3개 시작 무기 중 선택
    ↓
Tier 2 (Lv6~10)  고급 무기 해금, 스텟 가속 + 보조 효과
    ↓
Tier 3 (Lv11)    BRANCH 분기 — A(광역/멀티) vs B(화력/단일)
    ↓              14개 무기가 A/B 분기 보유
Tier 4 (Lv20)    ULTIMATE — 카테고리 궁극기
                   5종: hotfix(STEEL), big_data(TERRITORY), vpn_tunnel(ALLIANCE),
                        honeypot(SOVEREIGNTY), multithreading(MORALE)
```

**시너지 (카테고리 조합 보너스)**

| 시너지 | 요구 조건 | 효과 |
|--------|----------|------|
| neural_net | DATA T3 + SYSTEM T2 | 전 적 위치 표시 + 크리티컬 +50% |
| chatgpt | NETWORK T3 + DATA T2 | 적 AI 혼란 (서로 공격) |
| deepfake | CODE T3 + DATA T3 | 적 1체 아군 전환 |
| singularity_core | **전 카테고리 T4** | 30초간 전 스텟 +100%, 무적 |

### 3.7 크레딧 계산 (매치 종료 시)

> 출처: `MatrixResult.tsx`

```
totalCredits = score + (kills × 20) + (floor(survivalTime / 60) × 50)
```

| 구성 요소 | 계산 | 예시 (200킬, 3분, 5000점) |
|----------|------|--------------------------|
| Score 기반 | 누적 score | 5,000 |
| Kill Bonus | kills × 20 | 200 × 20 = 4,000 |
| Time Bonus | floor(분) × 50 | 3 × 50 = 150 |
| **합계** | | **9,150 cr** |

---

## 4. 온라인 토큰 경제 (에포크 시스템)

> 출처: `epoch-ui-bridge.ts`, `online-sync.ts`, `kill-reporter.ts`, `EpochResultScreen.tsx`,
> `TokenBuffDisplay.tsx`, `NationScoreboard.tsx`, `RewardHistoryPanel.tsx`,
> v33-online-matrix-plan.md, v36-token-economy-bridge-plan.md

### 4.1 에포크 사이클 (1 Epoch = 10분 15초 = 615초)

```
┌────────┐   ┌────────┐   ┌─────────┐   ┌─────────┐   ┌──────┐   ┌────────┐
│ PEACE  │──→│WAR CD  │──→│  WAR    │──→│ SHRINK  │──→│ END  │──→│ TRANS  │
│ 4분50초│   │  10초  │   │  3분    │   │  2분    │   │ 5초  │   │  10초  │
│ PvP OFF│   │ 사이렌 │   │ PvP ON │   │존 수축  │   │ 집계 │   │ 전환   │
│ orb×2  │   │ 경고   │   │킬=15Sc │   │5%HP/sDPS│   │ 결과 │   │ 리셋   │
│ 파밍기 │   │        │   │캡처+30 │   │→1000px │   │ 보상 │   │ 새에폭 │
└────────┘   └────────┘   └─────────┘   └─────────┘   └──────┘   └────────┘
     ▲                                                                  │
     └──────────────────────── 무한 반복 ──────────────────────────────┘
```

### 4.2 Nation Score 공식

> 출처: v33 plan §FR-04, v11 plan §4.1

```
NationScore = (kills × 15) + (level × 10) + (totalDamage × 0.5) + (survival × 100) + (capture × 30)
```

| 기여 항목 | 단위당 점수 | 숙련자 기대값 (5분) |
|----------|-----------|-------------------|
| PvP 킬 | 15 / kill | 50킬 × 15 = 750 |
| PvE 킬 (레벨 기여) | 10 / level | Lv15 × 10 = 150 |
| 총 데미지 | 0.5 / dmg | 50,000dmg × 0.5 = 25,000 |
| 생존 | 100 / survival | 1 × 100 = 100 |
| 캡처 | 30 / capture | 2캡 × 30 = 60 |
| **합계** | | **~26,060** |

### 4.3 토큰 보상 공식

> 출처: v33 plan, `EpochResultScreen.tsx`, `RewardHistoryPanel.tsx`

```
Step 1: baseAmount   = 0.01 × rawNationScore
Step 2: popAdjust    = rawScore / √(activePlayerCount)    ← 반제르그 보정
Step 3: multiplier   = 전쟁승리(2×) × MVP(1.5×) × 직접플레이(1.5×)
                       × 주권보유(+20%) × 패권보유(+50%)
Step 4: finalAmount  = baseAmount × multiplier × popAdjust

⚠️ 일일 한도: 5,000 토큰/일/인
```

**보상 시뮬레이션 (에포크당)**

| 유형 | Nation Score | 보상 (10명 아레나) | 보상 (50명 아레나) |
|------|-------------|-------------------|-------------------|
| 초보 | 5,000 | ~15.8 토큰 | ~7.1 토큰 |
| 평균 | 15,000 | ~47.4 토큰 | ~21.2 토큰 |
| 숙련 | 26,000 | ~82.2 토큰 | ~36.8 토큰 |
| MVP (승리팩션) | 26,000 + 승리 | ~246.6 토큰 | ~110.4 토큰 |

### 4.4 듀얼 토큰 구조

> 출처: v11 §15, v36 §2

**$AWW 마스터 토큰**
- 체인: CROSS Mainnet (chainId 8851)
- 주소: `0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7`
- 총 공급: 1,000,000,000 (10억)
- 용도: 전쟁 선포, 거버넌스, GDP 부스트, 크로스체인 거래

**195 국가 토큰 ($KOR, $USA, $JPN ...)**
- 티어별 공급: S=100M, A=50M, B=20M, C=10M, D=5M (**v11 §15.2 기준**)
- 용도: 에포크 보상, 보유 시 인게임 버프, DEX 거래, 주권 경매

> ⚠️ **불일치 발견**: v11 §15.1에서는 S=100M이지만 §15.2 테이블에서는 S=50M. v36은 미지정.
> 이 문서에서는 v11 §15.1의 S=100M을 기준으로 합니다.

### 4.5 토큰 보유 버프 (4단계)

> 출처: `TokenBuffDisplay.tsx`, v11 §15.4A

| 보유량 | XP 보너스 | 스탯 보너스 | 특수 효과 |
|--------|----------|-----------|----------|
| 100+ | +10% | — | 투표권 |
| 1,000+ | — | +5% 전체 스탯 | 제안권 |
| 10,000+ | +15% | — | "Rally" 스킬 해금, 2× 투표 |
| 100,000+ | +20% | +10% 전체 스탯 | "Inspire" 스킬 해금 |

### 4.6 주권 & 패권

> 출처: v11 §5, v33 §FR-09

| 등급 | 조건 | 버프 |
|------|------|------|
| **주권 Sovereignty** | 24시간 연속 Nation Score 1위 | +10% XP, +5% Speed, +20% 캡처, +5 토큰/일 |
| **패권 Hegemony** | 7일 연속 주권 유지 | 100 $AWW + 10 $AWW/멤버 + 정책 설정권 |

> ⚠️ **v11 vs v33 차이**: v11은 5단계 주권 레벨 (Occupied→Capital), v33은 바이너리 (있음/없음).
> 현재 코드 구현은 **v33 바이너리 방식**입니다.

### 4.7 토큰 소각 메커니즘 (디플레이션)

> 출처: v11 §15.4C, v36 §8

| 소각 경로 | 비용 | 소각 비율 |
|----------|------|----------|
| 전쟁 선포 | 500~2,000 $AWW | 100% 소각 |
| GDP 부스트 | 100~1,000 $AWW | 50% 소각 + 50% 국고 |
| 거버넌스 투표 | 스테이킹량 기반 | 10% 소각 |
| 조기 언스테이킹 | 스테이킹량 기반 | 20% 패널티 소각 |
| 주권 경매 | 입찰금 | 80% 소각 |
| 정산 출금 (v36) | 토큰 출금 시 | 5% 소각 수수료 |

---

## 5. 메타 경제 & 재화 흐름

> 출처: v11 §6, v36 §4~7, `items.config.ts`, `classes.config.ts`, `skins.config.ts`

### 5.1 크레딧 소비처 (Sinks)

**캐릭터 해금**

| 캐릭터 | 비용 | 비고 |
|--------|------|------|
| Neo | 무료 | 시작 캐릭터 |
| Morpheus | 무료 | 시작 캐릭터 |
| Trinity | 무료 | 시작 캐릭터 |
| Tank | 200,000 cr | 방어형 |
| Cypher | 1,000,000 cr | 전략형 |
| Niobe | 미정 | 기동형 |
| Oracle | 미정 | 지원형 |
| Mouse | 미정 | 정보형 |
| Dozer | 미정 | 중장형 |

> ⚠️ 6캐릭터 가격 미정 — v37에서 확정 필요

**영구 업그레이드 (Permanent Upgrades)**

> 출처: `items.config.ts` PERMANENT_UPGRADES

```
비용 = baseCost × 2^currentLevel  (지수 증가)
```

| 업그레이드 | 기본 비용 | 효과/레벨 | 최대 레벨 | Max 레벨 비용 |
|-----------|----------|----------|----------|-------------|
| 이동속도 | 1,000 cr | +3%/lv | 20 | ~524,288,000 cr |
| 공격력 | 2,000 cr | +5%/lv | 20 | ~1,048,576,000 cr |
| 체력 | 1,500 cr | +4%/lv | 20 | ~786,432,000 cr |
| 크리티컬 | 3,000 cr | +2%/lv | 20 | ~1,572,864,000 cr |

> ⚠️ **구현 현황**: `MatrixApp.tsx`에서 `PersistentUpgrades` 전부 0으로 하드코딩.
> 실제로 영구 업그레이드가 적용되지 않고 있음.

**소모품 (Consumables)**

> 출처: `items.config.ts`

| 소모품 | 비용 | 효과 |
|--------|------|------|
| 부활 Revive | 10,000 cr | 게임오버 시 즉시 부활 |
| EXP 부스터 | 5,000 cr | 1판 XP +50% |
| 크레딧 부스터 | 3,000 cr | 1판 크레딧 +50% |
| 스킬 리롤 | 2,500 cr | 레벨업 선택지 재생성 |

**에이전트 & 터렛 구매**

> 출처: `agents.config.ts`, `turrets.config.ts`

| 레어리티 | 구매 비용 | 최대 레벨 |
|---------|----------|----------|
| Common | 500 cr | Lv5 |
| Rare | 1,200 cr | Lv8 |
| Epic | 3,000 cr | Lv12 |
| Legendary | 8,000 cr | Lv15 |
| Mythic | 20,000 cr | Lv20 |

**바이브 코딩 타임 (Vibe Time)**

> 출처: `items.config.ts` VIBE_TIME_PRICES

| 시간 | 비용 | 비고 |
|------|------|------|
| 1분 | 300 cr | |
| 5분 | 1,200 cr | 20% 할인 |
| 10분 | 2,000 cr | 33% 할인 |
| 1시간 | 8,000 cr | 56% 할인 |
| 광고 시청 | 무료 | 일 5회 제한 |
| 일일 무료 | — | 3분 무료 지급 |

**스킨 (72종)**

> 출처: `skins.config.ts`

| 레어리티 | 스킨 수 | 스탯 보너스 | 특수 효과 |
|---------|---------|-----------|----------|
| Common | 기본 제공 | — | — |
| Rare | 각 캐릭터 2~3종 | +3~5% | — |
| Epic | 각 캐릭터 2종 | +4~7% | — |
| Legendary | 각 캐릭터 1종 | +8~15% | 보너스 스킬 |

### 5.2 3단계 경제 순환 루프

```
⚡ 단기 루프 (1판 = 5분)          💰 중기 루프 (세션 = 수 판)       🪙 장기 루프 (일/주 단위)
┌────────────────────┐          ┌────────────────────┐          ┌────────────────────┐
│ Kill → Gem → XP    │          │ Credits → 소모품   │          │ Token 축적 → 버프  │
│ → LevelUp → Skill  │    ──→   │ → 에이전트/터렛    │    ──→   │ → 주권/패권 획득   │
│ → Combo → 더빠른킬 │          │ → 영구 강화        │          │ → DEX 거래         │
│ → 브레이크타임     │          │ → 기본 스탯 ↑      │          │ → 거버넌스 참여     │
└────────────────────┘          └────────────────────┘          └────────────────────┘
```

---

## 6. 3-Tier 재화 체계

> 출처: v36-token-economy-bridge-plan.md §3

### 6.1 재화 분류

```
┌──────────────────────────────────────────────────────────────────┐
│ T1: MATCH (매치 한정)         T2: ACCOUNT (영구)     T3: CHAIN   │
│ ┌────────────────────┐       ┌──────────────┐       ┌─────────┐ │
│ │ XP (레벨업 전용)   │       │ RP (평판)     │       │ $AWW    │ │
│ │ Gold (매치 내 소비) │──→   │ Cosmetic Coin │──→   │ 국가토큰│ │
│ │ Score (순위 결정)   │       │ Account XP   │       │         │ │
│ │ HP (생존)          │       │ Credits (cr)  │       │         │ │
│ └────────────────────┘       └──────────────┘       └─────────┘ │
│                                                                   │
│ 리셋: 매치 종료 시            영구 보존                온체인 보존 │
│ 무한 발행 가능 (Soft)         서버 관리 (Soft)         공급 한정   │
│                                                       (Hard)      │
└──────────────────────────────────────────────────────────────────┘

변환 방향: T1 → T2 → T3 (단방향). T3 → T1 역변환 불가 (P2W 방지)
```

### 6.2 재화별 상세

| Tier | 재화 | 획득 경로 | 소비처 | 리셋 |
|------|------|----------|--------|------|
| **T1** | XP | 젬, 킬, NPC, 거점 | 인매치 레벨업 (max 20) | 매치 |
| **T1** | Gold | 킬 보상 (50+lv×5) | 필드 상점 (v36 예정) | 매치 |
| **T1** | Score | 킬, 데미지, 생존, 캡처 | Nation Score 입력 | 매치 |
| **T1** | HP | 시작 체력 | 피격 시 감소 | 매치 |
| **T2** | Credits (cr) | Score 기반 정산 | 업그레이드, 소모품, 캐릭터 | 영구 |
| **T2** | RP (Reputation) | 매치 참여, 순위, 시너지 | 능력 슬롯, 빌드 기록 | 영구 |
| **T2** | Account XP | 매치 성과 종합 | 계정 레벨업 → Cosmetic Coin | 영구 |
| **T2** | Cosmetic Coin | 계정 레벨업 보상 | 코스메틱 구매 (예정) | 영구 |
| **T3** | $AWW | 에포크 보상, 주권/패권 | 전쟁선포, 거버넌스, GDP | 영구(온체인) |
| **T3** | 국가 토큰 | 에포크 보상 | 보유 버프, DEX 거래 | 영구(온체인) |

### 6.3 T1 → T2 변환 (매치 정산)

```
매치 종료 시:
  Score → Credits:  totalCredits = score + (kills×20) + (floor(min)×50)
  성과 → RP:        참여RP + 순위RP + 시너지발견RP
  성과 → AccountXP: 종합 성과 점수
  AccountXP → CC:   레벨업 시 Cosmetic Coin 지급
```

### 6.4 T2 → T3 변환 (에포크/시즌 정산)

```
에포크 종료 시:
  NationScore → 국가토큰:  finalAmount = 0.01 × rawScore × multiplier × popAdjust
  주권 보유 → $AWW:        +5 $AWW/일 (주권 보유 보너스)
  패권 보유 → $AWW:        100 $AWW + 10 $AWW/멤버 (패권 달성 보상)

시즌 종료 시:
  시즌 순위 → $AWW:        시즌 리더보드 보상 (미확정)
  스테이킹 → 이자:         스테이킹 비율에 따른 보너스 (최대 +20%)
```

### 6.5 Settlement Gate (정산 게이트) — v36 설계

```
온체인 출금 조건:
  - 최소 출금: 100 $AWW
  - 일일 한도: 5,000 $AWW
  - 수수료: 5% 소각
  - 쿨다운: 24시간
  - 최소 계정 레벨: 5
```

---

# Part B: 메타게임 계층 (Meta-Game Layer)

> **이 파트는 v35.1에서 추가되었습니다.** 로비/글로브에서 작동하는 7개 메타게임 시스템의
> 전체 구조를 실제 코드 기반으로 문서화합니다.

## 7. 팩션 시스템 (Faction System)

> 서버: `server/internal/meta/faction.go` | 클라이언트: `components/faction/` | SDK: `aww-agent-skill/src/domains/faction.ts`

### 7.1 팩션 구조

```
┌─────────────────────────────────────────────────────────────┐
│ FACTION (팩션 = 동맹/길드)                                    │
│                                                               │
│ 역할 계층: Supreme Leader → Council → Commander → Member      │
│ 비용: 팩션 생성 = 1,000 Gold                                   │
│                                                               │
│ ┌───────────────────┐   ┌───────────────────┐                │
│ │ Treasury (국고)    │   │ Territory (영토)   │                │
│ │ 6종 자원 보관      │   │ 주권 국가 목록    │                │
│ │ Deposit/Withdraw   │   │ 총 GDP 합산       │                │
│ │ 역할별 권한 차등   │   │ Prestige 계산     │                │
│ └───────────────────┘   └───────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 6종 자원 (ResourceBundle)

| 자원 | 용도 | 주요 소비처 |
|------|------|------------|
| **Gold** | 범용 통화 | 팩션 생성, 인텔 미션, 용병 고용 |
| **Oil** | 군사 행동 | 전쟁 선포(500), 인텔(20), 배치 비용 |
| **Minerals** | 건설/생산 | 기술 투자, 시설 건설 |
| **Food** | 인력 유지 | 인구 유지, 용병 급여 |
| **Tech** | 연구/정보 | 기술 트리 투자, 카운터 인텔(100) |
| **Influence** | 외교/정치 | 전쟁 선포(300), UN 투표, 조약 |

### 7.3 API 엔드포인트 (9개)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v11/factions` | 팩션 목록 |
| GET | `/api/v11/factions/:id` | 팩션 상세 (멤버+국고+영토) |
| POST | `/api/v11/factions` | 팩션 생성 (name, tag) |
| POST | `/api/v11/factions/:id/join` | 가입 |
| POST | `/api/v11/factions/:id/leave` | 탈퇴 |
| POST | `/api/v11/factions/:id/kick` | 추방 (Council 이상) |
| POST | `/api/v11/factions/:id/promote` | 승급 (Leader만) |
| POST | `/api/v11/factions/:id/deposit` | 국고 입금 (resource, amount) |
| POST | `/api/v11/factions/:id/withdraw` | 국고 출금 (Council 이상) |

### 7.4 클라이언트 UI

| 컴포넌트 | 파일 | 기능 |
|----------|------|------|
| FactionList | `components/faction/FactionList.tsx` | 팩션 목록, 멤버/영토/GDP 표시, 생성 버튼 |
| FactionDetail | `components/faction/FactionDetail.tsx` | 국고 6자원, 멤버 역할 배지, 가입/탈퇴 |
| FactionScoreboard | `components/game/FactionScoreboard.tsx` | 인게임 팩션별 킬/생존/레벨 집계 |

---

## 8. 외교 시스템 (Diplomacy System)

> 서버: `server/internal/meta/diplomacy.go` | SDK: `aww-agent-skill/src/domains/diplomacy.ts`

### 8.1 조약 유형 (5종)

| 조약 | 효과 | 기본 기간 |
|------|------|----------|
| **Non-Aggression** (불가침) | 상호 공격 불가 | 7일 |
| **Trade Agreement** (무역) | 교역 수수료 감소 | 7일 |
| **Military Alliance** (군사동맹) | 방어 시 자동 참전, 동맹 빔 3D 표시 | 7일 |
| **Economic Sanction** (경제제재) | 대상 교역 차단, 제재 장벽 3D 표시 | 7일 |
| **Tribute** (조공) | 자원 자동 이전 | 7일 |

### 8.2 조약 라이프사이클

```
Proposed → Active → Expired
              ↓
           Broken (패널티: prestige -50)
```

- `WarPrepDuration`: 48시간 (전쟁 준비 기간)
- `WarDeclareCostOil`: 500 Oil
- `WarDeclareCostInfluence`: 300 Influence

### 8.3 3D 글로브 시각화

| 컴포넌트 | 파일 | 시각 효과 |
|----------|------|----------|
| AllianceBeam | `GlobeAllianceBeam.tsx` | 동맹국 간 빛 빔 연결 |
| SanctionBarrier | `GlobeSanctionBarrier.tsx` | 제재 대상 국가 주변 장벽 |
| TradeRoutes | `GlobeTradeRoutes.tsx` | 무역 루트 곡선 표시 |

---

## 9. 전쟁 시스템 (War System)

> 서버: `server/internal/meta/war.go` + `game/war.go` + `game/cross_arena.go` + `game/capture_point.go`

### 9.1 전쟁 상태 머신

```
선포 → 준비(24h) → 활성(max 72h) → 종료 → 쿨다운(24h) → 가능
  Declaration   Preparation    Active        Ended      Cooldown

종료 사유: surrender(항복) | ceasefire(휴전) | capital_fall(수도함락) | timeout(72h)
자동 항복: 점수 3배 차이 시 auto_surrender
```

### 9.2 전쟁 선포 조건

| 조건 | 값 |
|------|------|
| 패권국(Hegemony) 단독 선포 | ✅ |
| 연합(Coalition) 선포 | 최소 3국 + 각국 Sovereignty 필요 |
| 대상 제한 | 인접국 또는 같은 대륙 |
| 비용 | 300 Influence + 500 Oil |
| $AWW 비용 | 소규모 500 / 경제 1,000 / 대규모 2,000 |

### 9.3 전쟁 점수 체계

| 행동 | 점수 |
|------|------|
| 킬 (적국 플레이어) | 15점 |
| 캡처 포인트 점령 | 30점 |
| 방어 (자국 방어 킬) | 10점 |

### 9.4 크로스 아레나 침공 (Cross-Arena)

전쟁 중 적국 아레나에 직접 진입 가능:
- `CrossArenaRole`: native(원주민), invader(침략자), defender(방어자)
- 침략자: fatigue 페널티 적용 (72h 후 -5%/일 DPS, 최대 50%)
- 방어자: +30% defense bonus (siege 중)
- 전쟁 시 아레나 용량 +20명 추가

### 9.5 캡처 포인트 (3종)

| 유형 | 효과 | 반경 | 점령 시간 | 유지 시간 |
|------|------|------|----------|----------|
| Resource | +50% XP | 80px | 5초 | 2분 |
| Buff | +25% DMG | 80px | 5초 | 2분 |
| Healing | +3 HP/s | 80px | 5초 | 2분 |

### 9.6 3D 글로브 전쟁 이펙트

| 컴포넌트 | 시각 효과 |
|----------|----------|
| GlobeWarEffects | 전쟁 중인 국가 전체 이펙트 |
| GlobeMissileEffect | 미사일 궤적 |
| GlobeShockwave | 충격파 |
| GlobeNukeEffect | 핵무기 효과 |
| GlobeConflictIndicators | 분쟁 표시기 |

---

## 10. 경제 시스템 (Economy System)

> 서버: `server/internal/meta/economy.go` + `gdp.go` + `trade.go` + `tech_tree.go` + `policy.go` + `auction.go`
> 클라이언트: `components/civilization/` + `components/market/`

### 10.1 경제 정책 슬라이더 (4종)

| 정책 | 범위 | 효과 |
|------|------|------|
| **Tax Rate** | 0~50% | GDP↓ (세금 드래그), 국고 수입↑ |
| **Trade Openness** | 0~100% | GDP↑ (무역 보너스), 방어↓ |
| **Military Spend** | 0~50% | 군사력↑, GDP↓ (군비 비용) |
| **Tech Invest** | 0~30% | 기술 진보↑, 단기 GDP↓ |

기본값: Tax 10%, Trade 50%, Military 20%, Tech 10%
정책 변경 시 GDP 즉시 재계산

### 10.2 GDP 계산 공식

```
GDP = BaseProduction
    × TradeOpennessFactor     (무역 개방도 보너스)
    × TechBonusFactor         (기술 레벨 보너스)
    × CapitalBonusFactor      (수도 보너스 — 주권국)
    - MilitaryCostFactor      (군비 지출 차감)
    - TaxDragFactor           (과도한 세금 드래그)
```

- `GDPBreakdown`: 각 요소별 투명한 분해
- `FactionEconomicReport`: 팩션 전체 GDP 합산 리포트
- `WorldEconomicSummary`: 세계 총 GDP, 평균, 상위 랭킹

### 10.3 교역 시스템 (Trade)

**주문서 기반 거래소 (Order Book)**:
- 6종 자원 각각 독립 시장
- Buy/Sell 주문, 만료 시간 설정 가능
- `MarketSnapshot`: 현재가, 24h 거래량, 고가/저가, 변동률

**교역 루트 수수료**:
| 루트 | 수수료 | 비고 |
|------|--------|------|
| Sea (해상) | 5% | + 거리 곱수 |
| Land (육상) | 3% | + 거리 곱수 |

### 10.4 기술 트리 (Tech Tree — 3분기 × 4레벨)

```
Military (군사)           Economic (경제)           Diplomatic (외교)
├ Lv1: Enhanced Weapons   ├ Lv1: Trade Networks     ├ Lv1: Spy Network
│      DPS +5% (100pt)    │      수수료 -25% (100)  │      인텔 +20% (100)
├ Lv2: Tactical Formation ├ Lv2: Industrial Rev     ├ Lv2: Cultural Influence
│      시너지 +10% (300)  │      생산 +15% (300)    │      영향력 +30% (300)
├ Lv3: Siege Engines      ├ Lv3: Global Markets     ├ Lv3: Peacekeeping Force
│      공성 +20% (700)    │      시장 확장 (700)    │      동맹방어 +25% (700)
└ Lv4: Nuclear Option     └ Lv4: Economic Hegemony  └ Lv4: World Government
       핵무기 (2000)             GDP ×2 (2000)             UN 자동 통과 (2000)
```

### 10.5 문명 정책 (Civilization Policy — 10카테고리 × 3레벨)

> 서버: `server/internal/domain/policies.go` | 클라이언트: `components/civilization/PolicyManager.tsx`

| 카테고리 | 예시 레벨 | 영향 스탯 |
|----------|----------|----------|
| Religion | 무종교/다종교/국교 | happiness, loyalty |
| Language | 자유/공용어/강제 | techLevel, internationalRep |
| Government | 민주/과두/독재 | militaryPower, happiness, gdp |
| Tax Rate | 저세/중세/고세 | gdp, population |
| Military | 방어/균형/공격 | militaryPower, happiness |
| Education | 기초/중등/고등 | techLevel, birthRate |
| Trade | 보호/혼합/자유 | gdp, internationalRep |
| Environment | 방치/균형/보호 | happiness, population |
| Immigration | 폐쇄/선별/개방 | population, loyalty |
| Culture | 전통/혼합/세계화 | happiness, internationalRep |

- **패권국(Hegemony)만** 정책 변경 가능 (+ 14일 유예기간)
- 각 정책 변경 시 8종 스탯에 즉시 반영

### 10.6 주권 경매 (Sovereignty Auction)

- 48시간 영국식 경매 (English Auction)
- 주권이 없는 국가를 입찰로 획득

| 국가 티어 | 최소 입찰가 |
|----------|------------|
| S (초강대국) | 10,000 $AWW |
| A (강대국) | 5,000 $AWW |
| B (지역 강국) | 2,000 $AWW |
| C (일반국) | 500 $AWW |
| D (소국) | 200 $AWW |

- **소각률 80%**: 낙찰 금액의 80% 즉시 소각, 20% 국고
- GDP 부스트: 70% 소각, 30% 국고 잠금

---

## 11. 인텔 시스템 (Intel System)

> 서버: `server/internal/meta/intel.go` | SDK: `aww-agent-skill/src/domains/intel.ts`

### 11.1 미션 유형 (3종)

| 미션 | 비용 | 쿨다운 | 정확도 | 탐지 확률 | 효과 |
|------|------|--------|--------|----------|------|
| **Scout** (정찰) | 50G + 20Oil | 5분 | 80% | 10% | 적국 병력/레벨/방어력 정보 |
| **Sabotage** (사보타주) | 200G + 50Oil | 15분 | 70% | 30% | 적국 자원/시설 파괴 |
| **Counter-Intel** (방첩) | 100 Tech | 30분 | — | — | 24시간 방어 (적 정찰 차단) |

### 11.2 미션 라이프사이클

```
Pending → Active → Completed (성공 → IntelReport / SabotageEffect)
                 → Failed (실패)
                 → Detected (탐지됨 → 외교적 결과)
```

- 정찰 결과 (`IntelReport`): agent_count, average_level, defense_strength, sovereignty_level
- ⚠️ 정확도에 따라 결과가 부정확할 수 있음 (80% scout = 20% 부정확 데이터)
- 3D 시각화: `GlobeSpyTrail.tsx` — 스파이 궤적 효과

---

## 12. 거버넌스 & 주권 시스템 (Governance & Sovereignty)

> 서버: `server/internal/meta/council.go` + `game/sovereignty.go` + `game/domination.go`
> 클라이언트: `components/world/UNCouncil.tsx` + `GlobeDominationLayer.tsx`

### 12.1 UN 안전보장이사회 (Security Council)

| 좌석 유형 | 자격 | 특권 |
|----------|------|------|
| **Permanent** (상임) | S-Tier 초강대국 | 거부권 (Veto) |
| **Non-Permanent** (비상임) | A-Tier 강대국 | 일반 투표 |
| **Observer** (옵서버) | B-Tier 이하 | 발언권만 |

### 12.2 결의안 유형 (5종)

| 결의안 | 기간 | 게임플레이 효과 |
|--------|------|----------------|
| Nuclear Ban (핵무기 금지) | 48h | 핵 공격 불가 |
| Free Trade (자유무역) | 72h | 전 세계 교역 수수료 -50% |
| Peacekeeping (평화유지) | 168h | 특정 지역 전쟁 금지 |
| Economic Sanction (경제제재) | 72h | 대상국 교역 차단 |
| Climate Accord (기후 협약) | 168h | 환경 관련 보너스 |

- UI: 3탭 (이사회 좌석 / 진행 중 투표 / 역사)
- 투표 시 토큰 소각: `council/vote-with-burn` → 10% 소각

### 12.3 주권/패권 에스컬레이션 사다리

```
도미네이션 (None)
    ↓ 에포크 6회(1시간) 연속 우세
Active Domination (활성 도미네이션)
    ↓ 24시간 연속 도미네이션
Sovereignty (주권) ← +10% XP, +5% Speed, +20% Capture, +5 토큰/일
    ↓ 7일 연속 주권 유지
Hegemony (패권) ← 정책 설정권, 100 $AWW + 10/멤버
```

**도미네이션 평가**: 6에포크(1시간)마다, 최소 100점 이상
- 방어 보너스: 현 지배국 +10%
- 전환 방어: 교체 직후 15분간 +20%

### 12.4 주권 버프 (코드 확인 값)

| 버프 | 값 | 출처 |
|------|------|------|
| XP 배율 | ×1.10 (+10%) | `sovereignty.go:SovereigntyXPBonus` |
| 이동속도 배율 | ×1.05 (+5%) | `sovereignty.go:SovereigntySpeedBonus` |
| 캡처 배율 | ×1.20 (+20%) | `sovereignty.go:SovereigntyCaptureBonus` |

---

## 13. 월드 시스템 (World System)

> 서버: `server/internal/world/` + `server/internal/meta/season.go` + `meta/events.go`
> 클라이언트: `components/world/` + `components/3d/Globe*.tsx` (20개 파일)

### 13.1 195개국 티어 시스템

| 티어 | 국가 수 | 아레나 반경 | 최대 에이전트 | 자원 배율 | 예시 |
|------|---------|-----------|-------------|----------|------|
| **S** (초강대국) | 8 | 6,000px | 50 | ×3.0 | USA, CHN, RUS, IND, GBR, FRA, DEU, JPN |
| **A** (강대국) | 20 | 4,500px | 35 | ×2.0 | KOR, BRA, CAN, AUS, ITA ... |
| **B** (지역 강국) | 40 | 3,500px | 25 | ×1.5 | THA, VNM, POL, ARG ... |
| **C** (일반국) | 80 | 2,500px | 15 | ×1.0 | PER, ECU, CMR ... |
| **D** (소국) | ~47 | 1,500px | 8 | ×0.5 | MCO, LUX, BRN ... |

- 인구 기반 최대 에이전트 보정: `floor(tierMax × clamp(log10(pop/1e6) / log10(refPop/1e6), 0.3, 1.0))`, 최소 5명
- 국가별 5종 자원 (Oil/Minerals/Food/Tech/Manpower, 0~100 스케일)
- 방어 보너스: S=10%, A=15%, B=20%, C=25%, D=30% + 주권 레벨당 +5%

### 13.2 시즌 시스템 (4-Era, 4주)

| Era | 주차 | 전쟁 | 특수 규칙 |
|-----|------|------|----------|
| **Discovery** (탐험) | 1주 | ❌ 불가 | 자원 수집, 동맹 형성 |
| **Expansion** (확장) | 2주 | ✅ (비용 ×2) | 국경 충돌, 영토 확장 |
| **Empires** (제국) | 3주 | ✅ (풀) | 수도 공성, UN 이사회 활성 |
| **Reckoning** (심판) | 4주 | ✅ (풀) | 파이널 러시, 3분 배틀 사이클 |

### 13.3 월드 이벤트 (6종)

| 이벤트 | 범위 | 효과 | 확률 |
|--------|------|------|------|
| **Earthquake** (지진) | 국가 | 자원 -30% | 낮음 |
| **Pandemic** (팬데믹) | 대륙 | HP -10% | 매우 낮음 |
| **Gold Rush** (골드 러시) | 국가 | Gold ×5 | 중간 |
| **Tech Boom** (기술 붐) | 국가 | Tech ×3 | 중간 |
| **Volcanic Eruption** (화산) | 국가 | 아레나 용암 장애물 | 낮음 |
| **Solar Flare** (태양 폭풍) | 글로벌 | LLM 비활성화 (AI 에이전트 전략 중단) | 매우 낮음 |

- 최대 동시 이벤트: 10개
- 이벤트 엔진: 백그라운드 루프, 확률 기반 롤링
- API: `/api/v11/events/active`, `/api/v11/events/country/:iso`, `/api/v11/events/history`

### 13.4 에이전트 배치 (Deployment)

| 규칙 | 값 |
|------|------|
| 최대 동시 배치 | 3개국 |
| 배치 비용 | Oil × 하버사인(Haversine) 거리 비례 |
| 사망 후 자동 재배치 | ✅ |
| 리콜 쿨다운 | 30초 |

### 13.5 3D 글로브 컴포넌트 (20개)

| 컴포넌트 | 기능 |
|----------|------|
| GlobeInteractionLayer | 클릭/호버 상호작용 |
| GlobeHoverPanel | 국가 툴팁 |
| GlobeCountryLabels | 국가 레이블 |
| GlobeLandmarks | 수도 랜드마크 |
| GlobeEventPulse / EventLabels | 이벤트 시각화 |
| GlobeIntroCamera | 인트로 카메라 애니메이션 |
| GlobeDominationLayer | 도미네이션 상태 시각화 |
| GlobeResourceGlow | 자원 글로우 효과 |
| GlobeAllianceBeam | 동맹 빔 |
| GlobeSanctionBarrier | 제재 장벽 |
| GlobeTradeRoutes | 무역 루트 |
| GlobeWarEffects | 전쟁 이펙트 |
| GlobeMissileEffect | 미사일 |
| GlobeShockwave | 충격파 |
| GlobeSpyTrail | 스파이 궤적 |

---

# Part C: 에이전트 계층 (Agent Layer)

> AI 에이전트가 게임에 참여하는 SDK, 서버 아키텍처, 블록체인 연동을 문서화합니다.

## 14. AI 에이전트 SDK (Agent Skill)

> 패키지: `@aww/agent-sdk` v0.1.0 | 위치: `aww-agent-skill/`

### 14.1 3-Layer 에이전트 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    AI AGENT 3-LAYER                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ LAYER 1      │  │ LAYER 2      │  │ LAYER 3      │       │
│  │ Combat       │  │ Meta-Game    │  │ LLM Strategy │       │
│  │              │  │              │  │              │       │
│  │ GameClient   │  │ MetaClient   │  │ NationAgent  │       │
│  │ WebSocket v1 │  │ REST v11     │  │ 30s Tick     │       │
│  │ 10Hz Input   │  │ 46 Endpoints │  │ 5 LLM 지원   │       │
│  │ 자동전투     │  │ 6 Domain     │  │ 16 Actions   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  구성: AWWAgent → GameClient + MetaClient + 6 Domains        │
│        + LLMBridge + AgentMemory + NationAgent               │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 6개 도메인 클래스

| 도메인 | 파일 | 메서드 수 | 핵심 기능 |
|--------|------|----------|----------|
| **FactionDomain** | `domains/faction.ts` | 9 | 팩션 CRUD, 국고 입출금 |
| **DiplomacyDomain** | `domains/diplomacy.ts` | 6 | 조약 제안/수락/파기 |
| **WarDomain** | `domains/war.ts` | 6 | 전쟁 선포/항복/휴전 |
| **EconomyDomain** | `domains/economy.ts` | 15+ | 정책/교역/GDP/기술트리 |
| **IntelDomain** | `domains/intel.ts` | 3 | 정찰/사보타주/방첩 |
| **WorldDomain** | `domains/world.ts` | 7 | 국가/이벤트/시즌/UN |

### 14.3 LLM 전략 에이전트 (NationAgent)

**30초 전략 틱 루프**:
```
1. ensureFaction()           → 팩션 자동 생성/가입 + 주권 Lv3 선언
2. gatherState()             → 6개 병렬 API 호출 + 5개 조건부 호출
3. buildStrategicPrompt()    → 10개 섹션의 전략 컨텍스트 조립
4. LLM Query                 → Claude/GPT/Gemini/OpenRouter/Llama
5. parseActions()            → 4-전략 JSON 추출 (최대 3 액션)
6. executeActions()          → 13개 도메인 메서드 디스패치
7. wireDiplomaticMemory()    → 외교 이벤트 메모리 기록
```

### 14.4 LLM 지원 프로바이더

| 프로바이더 | 기본 모델 | 특이사항 |
|-----------|----------|---------|
| **Claude** (Anthropic) | claude-sonnet-4-6 | Messages API |
| **OpenAI** | gpt-4o | Chat Completions |
| **OpenRouter** | gemini-2.5-flash-lite | 멀티 모델 게이트웨이 |
| **Gemini** (Google) | gemini-2.5-flash | JSON 모드 + thinkingBudget: 0 |
| **Llama** | llama-3.1-70b | Ollama/vLLM 호환 |

### 14.5 16개 전략 액션 (틱당 최대 3개)

| 액션 | 파라미터 | 도메인 |
|------|----------|--------|
| `set_policy` | tax_rate, trade_openness, military_spend, tech_invest | Economy |
| `propose_treaty` | target(팩션ID), type(5종) | Diplomacy |
| `accept_treaty` / `reject_treaty` / `break_treaty` | treatyId | Diplomacy |
| `declare_war` | target(팩션ID) | War |
| `surrender` / `propose_ceasefire` | warId | War |
| `place_trade_order` | resource, side(buy/sell), quantity, price | Economy |
| `cancel_order` | orderId | Economy |
| `invest_tech` | node(12개 노드ID), amount | Economy |
| `launch_intel` | type(3종), target(국가ISO) | Intel |
| `hire_mercenary` | — | (정의됨, 미구현) |
| `deposit_resource` / `withdraw_resource` | — | (정의됨, 미구현) |
| `do_nothing` | — | — |

### 14.6 에이전트 퍼스낼리티 (5종)

| 성격 | 전략 특성 |
|------|----------|
| **Aggressive** | 군사 우선, 전쟁 추구, 항복 불가 |
| **Diplomat** | 동맹 형성, 평화 협상, 집단 안보 |
| **Economist** | GDP 극대화, 교역 활발, 전쟁 회피 |
| **Opportunist** | 약점 공략, 기회주의적 배신, 예측 불가 |
| **Default** | 군사/경제/외교 균형 |

### 14.7 시뮬레이션 시스템

- `SimRunner`: 최대 300 에이전트 동시 실행
- 8시간 오버나이트 시뮬레이션 가능
- 최근 결과: 187 에이전트, 6,101 액션, 57.9% 성공률

### 14.8 전체 API 엔드포인트 수

| 카테고리 | 엔드포인트 수 |
|----------|-------------|
| Faction | 9 |
| Diplomacy | 6 |
| War | 6 |
| Policy | 3 |
| Trade | 7 |
| GDP | 4 |
| Tech Tree | 3 |
| Intel | 3 |
| World/Season/Event/Council | 6 |
| Simulation | 1 |
| **Total** | **48** |

---

## 15. Go 서버 아키텍처

> 위치: `server/` | 언어: Go | 틱레이트: 20Hz (50ms)

### 15.1 서버 핵심 상수

| 파라미터 | 값 | 출처 |
|----------|------|------|
| **TickRate** | 20Hz (50ms) | `constants.go` |
| **ArenaRadius** | 3,000px | `constants.go` |
| **BaseSpeed** | 150 px/s (7.5 px/tick) | `constants.go` |
| **BoostSpeed** | 300 px/s | `constants.go` |
| **AuraRadius** | 60px | `constants.go` |
| **AuraDPS** | 40 mass/s (2.0/tick) | `constants.go` |
| **GracePeriod** | 30초 (600 ticks) | `constants.go` |
| **MaxConcurrentArenas** | 50 | `WorldConfig` |
| **MaxPlayersPerRoom** | 100 (85 human + 15 bot) | `constants.go` |

### 15.2 에포크 사이클 (서버 구현)

> `server/internal/game/epoch.go` — 20Hz 틱 기반

| 페이즈 | 시간 | 틱 수 | PvP | 오브 배율 |
|--------|------|-------|-----|----------|
| **Peace** | 5분 | 6,000 | OFF | ×2.0 |
| **War Countdown** | 10초 | 200 | OFF | ×1.0 |
| **War** | 3분 | 3,600 | ON | ×1.0 |
| **Shrink** | 2분 | 2,400 | ON | ×1.0 |
| **End** | 5초 | 100 | OFF | ×1.0 |
| **Transition** | 10초 | 200 | OFF | ×1.0 |
| **합계** | **10분 15초** | **12,500** | — | — |

- Shrink: 3,000px → 1,000px (선형 보간)
- War Siren: 전쟁 3초 전 사이렌 경보 (60 ticks)

### 15.3 World Manager (195국 관리)

```
WorldManager
├── 195 CountryState[]          ← 국가별 상태 (배틀/아이들/쿨다운)
├── ArenaPool (max 50개)         ← 온디맨드 아레나 생성/재활용
├── Redis Sync (5초 간격)        ← 195개 국가 파이프라인 SET
├── 1Hz Countries Broadcast      ← 활동 중인 국가만 브로드캐스트
└── Auto-Battle Scheduler        ← 랜덤 국가 자동 배틀 시작 (0~180초 시차)
```

- 국가별 독립 배틀 사이클: `idle → preparing → in_battle(5분) → ending(5초) → cooldown(60초) → idle`
- 봇/인간 비율: 60% 봇 / 40% 인간 (최소 5봇)

### 15.4 WebSocket 프로토콜 요약

**와이어 포맷**: `{"e":"event_name","d":{...}}`

**클라이언트 → 서버** (25개 이벤트):
| 그룹 | 이벤트 | 빈도 |
|------|--------|------|
| 로비 | join_room, leave_room, select_nationality, join_country_arena | 1회 |
| 인풋 | input(30Hz), choose_upgrade, respawn | 매 프레임 |
| 에이전트 | agent_auth, agent_command, agent_choose_upgrade, observe_game | 비정기 |
| 매트릭스 | matrix_join, matrix_leave, matrix_input(10Hz), matrix_kill, matrix_damage, matrix_capture, matrix_level_up | v33 |
| 도시 | city_command, city_subscribe, city_unsubscribe | v26 |
| 아레나 | ar_input, ar_choose, switch_arena, declare_war | v19 |

**서버 → 클라이언트** (40+ 이벤트):
- 상태: `state(20Hz)`, `minimap(1Hz)`, `countries_state(1Hz)`, `matrix_state(20Hz)`
- 전투: `death`, `kill`, `level_up`, `ability_triggered`, `ar_*`
- 에포크: `epoch_start/end`, `war_phase_start/end`, `nation_score_update`
- 전쟁: `war_declared/ended`, `capture_point_update`, `domination_update`
- 매트릭스: `matrix_epoch/spawn_seed/kill_confirmed/kill_rejected/score/result/buff`

### 15.5 HTTP API 총괄 (100+ 엔드포인트)

| 카테고리 | 경로 패턴 | 인증 | 비고 |
|----------|----------|------|------|
| Health/Metrics | `/health`, `/metrics` | 공개 | Prometheus |
| Meta API v11 | `/api/v11/*` | DualAuth (JWT/API Key) | 17개 서브라우트 그룹 |
| Frontend Aliases | `/api/factions` 등 | 공개 (읽기전용) | v11과 동일 데이터 |
| Agent API | `/api/v1/agents/*`, `/api/agents/*` | DualAuth | 등록/관리 |
| In-Game v14 | `/api/v14/*` | 혼합 | 계정/챌린지/보상/성과 |
| Blockchain | `/api/buyback/*`, `/api/defense/*`, `/api/token/*` | 공개 | 가격/소각/방어 |
| Token Economy | `/api/country/:iso/boost`, `/api/staking/*`, `/api/auction/*` | 인증 | GDP/스테이킹/경매 |
| CROSS Ramp | `/api/ramp/*` | HMAC-SHA256 | 웹훅 |
| Matrix | `/api/matrix/*` | 공개 | 버프/잔고/보상 |

---

## 16. 블록체인 & 토큰 시스템

> 서버: `server/internal/blockchain/` | 체인: CROSS Mainnet

### 16.1 $AWW 토큰

| 항목 | 값 |
|------|------|
| 토큰 주소 | `0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7` |
| 총 공급량 | 1,000,000,000 (10억) |
| 체인 | CROSS Mainnet |
| 가격 소스 | Forge Pool (5분 폴링) |
| 가격 폴백 | GDP 기반 시뮬: `totalWorldGDP / 1B × 0.001` |

### 16.2 Forge 가격 서비스

- `ForgePriceService`: 5분 간격 Forge Pool 가격 폴링
- 24시간 가격 이력 (288 엔트리, 5분 간격)
- Forge API: `GET /api/forge/token/{address}/price`
- 실패 시 GDP 기반 시뮬레이션 가격 사용

### 16.3 Defense Oracle (시가총액 → 방어 배율)

| 시가총액 | 방어 배율 |
|----------|----------|
| $100M+ | ×5.0 |
| $10M+ | ×3.0 |
| $1M+ | ×2.0 |
| $100K+ | ×1.5 |
| $10K+ | ×1.2 |
| $0+ | ×1.0 (기본) |

- **서킷 브레이커**: 1시간 내 50% 변동 시 1시간 동결
- **이동평균**: 12 샘플 윈도우 (1시간)
- **방어 버프 캡**: 최대 30%
- JSON-RPC: `aww_getTokenMarketCaps`

### 16.4 Buyback Engine (GDP 세금 환매)

```
GDP Revenue → 5% Tax 적립 → 배치 환매 (20국/배치)
                                ↓
                        JSON-RPC: aww_executeBatchBuyback
                                ↓
                        토큰 구매 → 국고로 분배
```

- `BuybackTaxRate`: 5%
- `BurnRateOnVictory`: 전쟁 승리 시 국고 1% 소각
- 이력 저장: 최대 10,000건

### 16.5 토큰 소각 사유 (5종)

| 사유 | 소각률/금액 |
|------|------------|
| **War Victory** (전쟁 승리) | 국고 잔액의 1% |
| **GDP Boost** | 입금액의 70% |
| **Staking Early Withdraw** | 20% 패널티 |
| **Governance Vote** | 스테이킹의 10% |
| **Sovereignty Auction** | 낙찰가의 80% |

### 16.6 CROSS Ramp 웹훅

| 엔드포인트 | 기능 |
|-----------|------|
| `POST /api/ramp/get-assets` | 유저 인게임 Credits 잔고 반환 |
| `POST /api/ramp/validate-order` | Mint/Burn 주문 검증 (잔고 확인) |
| `POST /api/ramp/order-result` | 트랜잭션 완료 처리 (Mint→Credits 추가, Burn→차감) |

- HMAC-SHA256 서명 검증 (`X-Ramp-Signature`)
- OrderID 기반 멱등성 (중복 방지)
- Rate Limit: 30 req/min per IP

---

# Part D: 분석 & 현황

## 17. 밸런스 분석 & 핵심 수치

### 17.1 크레딧 획득 시뮬레이션 (판당)

| 등급 | 킬 수 | 생존 시간 | Score | Credits | 시간당 |
|------|-------|----------|-------|---------|--------|
| 🟢 초보 | 30 | 1분 | 300 | ~950 cr | ~11,400/hr |
| 🟡 평균 | 100 | 3분 | 1,500 | ~3,650 cr | ~43,800/hr |
| 🟠 숙련 | 200 | 5분 | 5,000 | ~9,250 cr | ~111,000/hr |
| 🔴 고수 | 400 | 5분(풀킬) | 12,000 | ~20,250 cr | ~243,000/hr |

### 17.2 크레딧 소비 마일스톤 (누적)

| 목표 | 필요 크레딧 | 평균 플레이어 소요 |
|------|-----------|------------------|
| Tank 해금 | 200,000 cr | ~55판 (~4.5시간) |
| 영구 업그레이드 Lv5 (1종) | ~62,000 cr | ~17판 |
| 영구 업그레이드 Lv10 (1종) | ~2,046,000 cr | ~560판 (~47시간) |
| Cypher 해금 | 1,000,000 cr | ~274판 (~23시간) |
| 영구 업그레이드 Lv20 (1종) | ~524,288,000 cr | 장기 목표 |
| 전 업그레이드 Max | ~3.9B cr | 극한 엔드게임 |

### 17.3 토큰 일일 획득 시뮬레이션

| 등급 | 에포크/일 | 에포크당 토큰 | 일일 합계 | 일일 한도 |
|------|----------|-------------|----------|----------|
| 캐주얼 (2hr) | 12 | ~15 | ~180 | 5,000 |
| 하드코어 (8hr) | 47 | ~50 | ~2,350 | 5,000 |
| MVP (8hr) | 47 | ~110 | ~5,170 | **5,000 (캡)** |
| 봇 방지 | — | — | — | 5,000 |

### 17.4 토큰 소각 vs 발행 분석

**일일 발행 (Faucet)**

| 경로 | 일일 추정량 (1000 활성 유저) |
|------|---------------------------|
| 에포크 보상 | ~50,000 국가토큰 |
| 주권 보너스 | ~195 × 5 = 975 $AWW |
| 패권 보상 | ~10 × 100 = 1,000 $AWW |
| **합계** | ~1,975 $AWW + 50,000 국가토큰 |

**일일 소각 (Sink)**

| 경로 | 일일 추정량 |
|------|-----------|
| 전쟁 선포 | ~10 × 1,000 = 10,000 $AWW |
| GDP 부스트 | ~20 × 500 × 50% = 5,000 $AWW |
| 거버넌스 스테이킹 소각 | ~1,000 $AWW |
| 정산 출금 수수료 | ~500 $AWW |
| **합계** | ~16,500 $AWW |

**결론**: 소각(~16,500) > 발행(~1,975) → **Net Deflationary** 설계 확인 ✅

### 17.5 핵심 밸런스 상수 (코드 기준)

| 상수 | 값 | 출처 |
|------|-----|------|
| 틱 레이트 | 20Hz (서버), 60fps (클라이언트) | game.config.ts |
| PvP 데미지 배율 | 0.5x | agent-combat.ts |
| PvP 킬 Score | 15 | agent-combat.ts |
| 에포크 길이 | 615초 (10분15초) | epoch-ui-bridge.ts |
| Peace 지속 | 290초 (4분50초) | epoch-ui-bridge.ts |
| War 지속 | 180초 (3분) | epoch-ui-bridge.ts |
| Shrink 지속 | 120초 (2분) | epoch-ui-bridge.ts |
| Shrink 목표 | 1000px | epoch-ui-bridge.ts |
| Shrink DPS | 5% HP/s | epoch-ui-bridge.ts |
| 일일 토큰 한도 | 5,000 | RewardHistoryPanel.tsx |
| 출금 최소 | 100 $AWW | v36 설계 |
| 출금 수수료 | 5% | v36 설계 |
| 토큰 버프 1단계 | 100+ → +10% XP | TokenBuffDisplay.tsx |
| 토큰 버프 2단계 | 1K+ → +5% 스탯 | TokenBuffDisplay.tsx |
| 토큰 버프 3단계 | 10K+ → +15% XP | TokenBuffDisplay.tsx |
| 토큰 버프 4단계 | 100K+ → +20% XP +10% 스탯 | TokenBuffDisplay.tsx |
| 콤보 최대 배율 | 3.5x (Transcendent) | combo.config.ts |
| Data Burst 스폰 배율 | 3x | breaktime.config.ts |
| Data Burst XP 배율 | 2x | breaktime.config.ts |
| 엘리트 출현 | 100~300킬 | elite-monster.ts |
| 브랜치 진화 레벨 | 11 | branches.ts |
| 궁극기 레벨 | 20 | branches.ts |
| 패시브 최대 레벨 | 10 | progressive-tree.config.ts |
| Client Prediction 무시 | <50px | client-prediction.ts |
| Client Prediction Lerp | 50~100px (speed 0.15) | client-prediction.ts |
| Client Prediction Snap | >=100px | client-prediction.ts |
| 킬 확인 타임아웃 | 3000ms | kill-reporter.ts |

---

## 18. 구현 현황 Gap 분석

### 18.1 구현 완료 (✅ Implemented)

| 시스템 | 파일 | 상태 |
|--------|------|------|
| Matrix 전투 엔진 | combat.ts, weapons.ts, movement.ts | ✅ 완전 동작 |
| 25개 무기 + 14 분기 진화 | weapons.config.ts, branches.ts | ✅ 완전 동작 |
| 55개 스킬 정의 | definitions.ts, progressive-tree.config.ts | ✅ 완전 동작 |
| 150+ 적 유형 | enemies.config.ts | ✅ 완전 동작 |
| 10단계 콤보 | combo.config.ts, useCombo | ✅ 로직+UI |
| Data Burst / Kernel Panic | breaktime.config.ts, BreakTimeOverlay.tsx | ✅ 로직+UI |
| 퀴즈 미션 | quiz.config.ts, QuizChallengeCard.tsx | ✅ 로직+UI |
| 엘리트 몬스터 (Diablo 드롭) | elite-monster.ts | ✅ 완전 동작 |
| 스폰 컨트롤러 (웨이브 풀) | spawn-controller.ts | ✅ 완전 동작 |
| 에포크 UI (6 페이즈) | epoch-ui-bridge.ts, EpochHUD.tsx | ✅ 완전 동작 |
| Nation Scoreboard | NationScoreboard.tsx | ✅ UI 완성 |
| 캡처 포인트 UI | CapturePointUI.tsx | ✅ UI 완성 |
| 토큰 버프 표시 | TokenBuffDisplay.tsx | ✅ UI 완성 |
| 에포크 결과 화면 | EpochResultScreen.tsx | ✅ UI 완성 |
| 보상 히스토리 | RewardHistoryPanel.tsx | ✅ UI 완성 |
| 크레딧 정산 | MatrixResult.tsx | ✅ 공식 동작 |
| 시드 기반 스폰 (멀티 동기화) | seeded-spawning.ts | ✅ v33 |
| 클라이언트 예측 | client-prediction.ts | ✅ v33 |
| 온라인 동기화 | online-sync.ts | ✅ v33 |
| 킬 리포트 + 검증 | kill-reporter.ts | ✅ v33 |
| WebSocket 훅 | useMatrixSocket.ts | ✅ v33 |
| 스킬 리테마 (군사/전략) | v34-skill-retheme-spec.md 기반 | ✅ v34 |
| AI 스킬 아이콘 생성 (57개) | Gemini API 생성, /assets/skills/ | ✅ v35 |
| 에이전트 채팅 (OpenRouter) | agent-chat.ts | ✅ Gemini Flash |
| 72종 스킨 | skins.config.ts | ✅ 정의 완료 |
| 14 빌드 프리셋 | presets.ts | ✅ 정의 완료 |

### 18.1-B 메타게임 서버 구현 완료 (✅ Go Server)

| 시스템 | 서버 파일 | 클라이언트 UI | SDK | 상태 |
|--------|----------|-------------|-----|------|
| **팩션** (CRUD+국고) | `meta/faction.go` | FactionList, FactionDetail, FactionScoreboard | FactionDomain (9 API) | ✅ 3-tier 완성 |
| **외교** (5종 조약) | `meta/diplomacy.go` | Globe 3D (빔/장벽/루트) | DiplomacyDomain (6 API) | ✅ 서버+SDK (2D 패널 미완) |
| **전쟁** (상태머신) | `meta/war.go` + `game/war.go` + `cross_arena.go` | Globe 5종 이펙트 | WarDomain (6 API) | ✅ 3-tier 완성 |
| **경제** (GDP+교역+기술) | `meta/economy.go` + `gdp.go` + `trade.go` + `tech_tree.go` | PolicyManager, CivilizationPanel | EconomyDomain (15+ API) | ✅ 3-tier 완성 |
| **인텔** (3종 미션) | `meta/intel.go` | GlobeSpyTrail (3D) | IntelDomain (3 API) | ✅ 서버+SDK (2D 패널 미완) |
| **거버넌스** (UN 이사회) | `meta/council.go` + `sovereignty.go` + `domination.go` | UNCouncil, GlobeDominationLayer | WorldDomain (partial) | ✅ 3-tier 완성 |
| **월드** (195국+시즌+이벤트) | `world/` + `meta/season.go` + `meta/events.go` | WorldView, CountryPanel, 20 Globe* | WorldDomain (7 API) | ✅ 3-tier 완성 |
| **문명 정책** (10카테고리) | `domain/policies.go` | PolicyManager.tsx (10카드) | — | ✅ 서버+UI |
| **용병** (고용/배치) | `meta/mercenary.go` | MercenaryMarket.tsx | WorldDomain | ✅ 서버+UI |
| **주권 경매** (48h 경매) | `meta/auction.go` | — | — | ✅ 서버 (UI 미완) |
| **에이전트 배치** (3국 동시) | `world/deployment.go` | — | — | ✅ 서버 |
| **에이전트 SDK** | — | — | `@aww/agent-sdk` (46 endpoint) | ✅ 완성 |
| **AI 전략 에이전트** | — | — | NationAgent (5 LLM, 16 액션) | ✅ 시뮬 검증 (187봇) |
| **블록체인** (가격/방어/환매) | `blockchain/` (4파일) | — | — | ✅ 서버 (체인 미연결) |

### 18.2 서버 코드 완성 but Dead Code (⚠️ Implemented but Not Connected)

| 시스템 | 서버 파일 | 문제 |
|--------|----------|------|
| TokenRewardManager | server/internal/ | Queue* 함수 미호출 |
| BuybackEngine | server/internal/ | GDP → 토큰 매입 로직 미연결 |
| DefenseOracle | server/internal/ | 시가총액→방어보너스 미연결 |
| PlayerAWWBalance | server/internal/ | 인메모리만, 영속 안됨 |
| Staking System | server/internal/ | 인메모리, 재시작 시 소멸 |
| GDP Boost | economy.go | 50% 소각 로직 있으나 미사용 |
| War Declaration Cost | server/internal/ | 비용 차감 로직만 존재 |
| Governance Vote | UI 완성 | 잔고 하드코딩 10000 |

### 18.3 미구현 (❌ Not Yet Implemented)

| 시스템 | 기획서 | 현황 |
|--------|--------|------|
| **로비/상점 UI** | v36 §5 | 미구현 |
| **영구 업그레이드 화면** | items.config.ts | 하드코딩 0, UI 없음 |
| **코스메틱 상점** | v36 §5 | Cosmetic Coin 발행만 존재 |
| **필드 상점 (인매치 Gold)** | v36 §3 | 설계만, 미구현 |
| **Settlement Gate (온체인 출금)** | v36 §3.2 | 설계만 |
| **국가 토큰 배포 (195개)** | v11 §15, v36 §6 | S-tier 7국 계획, 미배포 |
| **주권 경매** | v11 §15 | 설계만 |
| **전쟁 베팅** | v36 §7 | 설계만 |
| **에이전트 마켓플레이스** | v36 §9 | 설계만 |
| **배틀 패스** | v36 §5 | 설계만 |
| **v37 스킬 이펙트 리디자인** | v37 §3 | 설계 완료, 미구현 |
| **v37 경제형 패시브** | v37 §2.3 | 설계 완료, 미구현 |
| **v37 HUD 경제 피드백 레이어** | v37 §4 | 설계 완료, 미구현 |

### 18.4 기획서 간 불일치 (⚠️ Discrepancies)

| 항목 | 문서 A | 문서 B | 해결 필요 |
|------|--------|--------|----------|
| 자원 수 | v11 §5: 5종 (Energy,Metal,Food,Tech,Gold) | v11 §6.1: 6종 (+Influence) | 6종으로 통일 |
| S-tier 토큰 공급 | v11 §15.1: 100M | v11 §15.2 테이블: 50M | 100M 채택 (§15.1) |
| 블록체인 | v11 §15.1: "Base (Ethereum L2)" | v36: CROSS Mainnet (8851) | CROSS 확정 |
| 주권 레벨 | v11: 5단계 (Occupied→Capital) | v33: 바이너리 (있음/없음) | v33 바이너리 (현재 코드) |
| S-tier 국가 수 | v11: 8국 (USA,CHN,RUS,IND,BRA,JPN,DEU,GBR) | v36 §6: 7국 (GBR 제외) | 확인 필요 |
| 거버넌스 권한 | v11 §5: 팩션 리더 결정 | v11 §15.4D: 토큰 홀더 투표 | 이중 권한 충돌 미해결 |
| 경제 틱 | v11: 1시간 | v36: 10분 에포크 | 다른 시스템 (국가경제 vs 매치보상) |
| 스킬 테마 | v34: IT→군사 리스킨 (55개) | v37: 25→20 무기 통합 + 경제 연결 | v37이 최신 |

### 18.5 핵심 파이프라인 끊김 지점

> 출처: v36 §2.3

```
끊김 1: [전투 Score 계산됨] ──✖──(Queue* 미호출)──✖──→ [토큰 보상 지급]
끊김 2: [토큰 보상 지급] ──✖──(WS 이벤트 미수신)──✖──→ [클라이언트 표시]
끊김 3: [토큰 잔고 표시] ──✖──(온체인 미연결)──✖──→ [실제 자산화]
끊김 4: [토큰 보유] ──✖──(소비처 부족)──✖──→ [플레이어 동기 부여]
```

**결론**: 4개 끊김 지점 모두 연결해야 순환 경제 완성. v36이 이 연결 설계를 담당.

---

## 19. Excalidraw 다이어그램 인덱스

Obsidian Vault에 9장의 Excalidraw 다이어그램이 있습니다. 전부 한글, 프로세스 흐름 화살표 포함.

| # | 파일 | 내용 | 요소 수 |
|---|------|------|--------|
| 1 | `1-master-flow.excalidraw.md` | **전체 게임 흐름** — 지구본→국가→전투→에포크→보상 순환, 오프라인/온라인 분기, 5대 소비처 | 57 |
| 2 | `2-ingame-economy.excalidraw.md` | **인게임 경제 루프** — 킬→젬→XP→레벨업→스킬→강화 순환, 6단계 콤보, 6카테고리 스킬, 드롭/엘리트 | 76 |
| 3 | `3-token-economy.excalidraw.md` | **토큰 경제 에포크** — 6페이즈 순환(평화→경고→전쟁→수축→종료→전환), NationScore 공식, 듀얼 토큰, 5대 소각 | 65 |
| 4 | `4-meta-economy.excalidraw.md` | **메타 경제 재화** — 3-Tier(크레딧→토큰→전략자원), 3루프 순환(인게임→매치간→메타), 획득 시뮬레이션 | 55 |
| 5 | `5-complete-system-map.excalidraw.md` | **전체 시스템 맵** — 3계층 구조, Master Flow 6단계 순환, 3단계 재화, 에포크 6페이즈, 메타게임 7시스템, 서버/블록체인 | 101 |
| 6 | `6-metagame-systems.excalidraw.md` | **메타게임 7대 시스템** — 15개 프로세스 화살표 연결(팩션↔외교↔전쟁↔경제↔인텔↔거버넌스↔월드), 6자원 범례 | 73 |
| 7 | `7-agent-sdk-architecture.excalidraw.md` | **AI 에이전트 전략 루프** — 3계층→6도메인→Go서버, 7단계 30초 틱 순환, 16행동, 5 LLM, 5성격 | 92 |
| 8 | `8-war-diplomacy-system.excalidraw.md` | **전쟁·외교 상태 머신** — 전쟁 5단계 순환+루프백, 크로스아레나 침공, 조약 생명주기 분기, 8 글로브 이펙트 | 92 |
| 9 | `9-economy-governance.excalidraw.md` | **경제·거버넌스 순환** — GDP→거래→기술→주권→소각 전체 순환, 정책 슬라이더↔GDP 되먹임, 기술트리 3×4 | 115 |

**위치**: `/Users/andrew.kim/Documents/Obsidian Vault/DAVINCI/AI World War/diagrams/`

---

## 부록: 문서 계보 (Version History)

이 분석은 다음 기획서들을 크로스 레퍼런스하여 작성되었습니다:

| 버전 | 문서 | 핵심 내용 | 크기 |
|------|------|----------|------|
| v10 | survival-roguelike-plan.md | Agent Survivor 원본 기획 (Tome/Ability/Synergy) | 122K |
| v11 | world-war-plan.md | AI World War 전체 기획 (15개 섹션, 블록체인) | 73K |
| v11 | world-war-roadmap.md | S01~S53 구현 로드맵 (10 Phase) | 26K |
| v11 | verification-report.md | 기획 검증 (47 이슈, 14 Critical) | 16K |
| v29 | matrix-faithful-port-plan.md | app_ingame → Matrix 엔진 이식 | 16K |
| v32 | matrix-gameplay-plan.md | 스킬/HUD/v3시스템 완성 | 20K |
| v33 | online-matrix-plan.md | Matrix ↔ 온라인 통합 (에포크, PvP) | 43K |
| v34 | skill-retheme-spec.md | 55개 스킬 IT→군사 리테마 | 24K |
| v36 | token-economy-bridge-plan.md | 3-Tier 재화, 순환 경제, Settlement Gate | 41K |
| v37 | ingame-overhaul-plan.md | 스킬/이펙트/UI 전면 리디자인 + 경제 통합 | 55K |

**총 분석 문서**: 132건 (기획 54, 아키텍처 11, 로드맵 3, 보고서/검증 26, ADR 10, 기타 28)
**총 문서 크기**: ~3.5MB

---

> **이 문서의 정확성**: 모든 수치는 실제 코드에서 추출한 값과 기획서를 크로스 체크하였습니다.
> - Part A (전투): `apps/web/lib/matrix/config/`, `apps/web/lib/matrix/systems/`, `apps/web/components/game/matrix/`
> - Part B (메타게임): `server/internal/meta/`, `server/internal/game/`, `server/internal/world/`, `server/internal/domain/`
> - Part C (에이전트): `aww-agent-skill/src/`, `server/internal/blockchain/`, `server/cmd/server/router.go`
> 불일치가 발견된 경우 **코드 기준**을 우선하되, §18.4에서 별도 표기하였습니다.
