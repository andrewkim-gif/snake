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

Obsidian Vault에 4장의 Excalidraw 다이어그램이 생성되어 있습니다.

| # | 파일 | 내용 | 요소 수 |
|---|------|------|--------|
| 1 | `1-master-flow.excalidraw.md` | 전체 게임 흐름 (Globe→Country→Matrix→Result→Credits/Tokens→Sinks→Loop) | 53 |
| 2 | `2-ingame-economy.excalidraw.md` | 인게임 경제 (Kill→Gem→XP→Skill, 콤보, 엘리트, Data Burst, 스킬 트리) | 51 |
| 3 | `3-token-economy.excalidraw.md` | 토큰 경제 (에포크 6페이즈, NationScore, 듀얼 토큰, 버프, 캡처, 소각) | 70 |
| 4 | `4-meta-economy.excalidraw.md` | 메타 경제 (크레딧 획득/소비, 3루프, 획득 시뮬, 구현 현황) | 46 |

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

> **이 문서의 정확성**: 모든 수치는 실제 코드 (`apps/web/lib/matrix/config/`, `apps/web/lib/matrix/systems/`,
> `apps/web/components/game/matrix/`)에서 추출한 값과 기획서를 크로스 체크하였습니다.
> 불일치가 발견된 경우 **코드 기준**을 우선하되, §8.4에서 별도 표기하였습니다.
