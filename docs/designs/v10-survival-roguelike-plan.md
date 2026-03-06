# Agent Survivor v10 — Multiplayer Auto-Combat Roguelike

> **Version**: v10.0 (Agent Survivor Rebranding + Survival Roguelike)
> **Date**: 2026-03-06
> **Status**: Draft → **Go 서버 재설계 확정** (TS 프로토타입 완료 → Go 포팅 예정)
> **Based on**: v9 Agent API Platform + Megabonk 게임 기획 분석
> **Inspiration**: Megabonk (3D Vampire Survivors) + **Minecraft 전체 비주얼 스타일** (캐릭터+맵+UI+파티클)
> **Rebranding**: Snake Arena → **Agent Survivor** / 뱀 캐릭터 → 마인크래프트 스타일 에이전트
> **Tech Stack**: **Go 1.24 + gorilla/websocket + chi** (서버) / Next.js 15 + R3F (클라이언트) / Railway + Vercel (배포)
> **Server Design**: [`docs/designs/v10-go-server-plan.md`](v10-go-server-plan.md) — 상세 Go 서버 아키텍처
> **3D Graphics**: [`docs/designs/v10-3d-graphics-plan.md`](v10-3d-graphics-plan.md) — 3D 렌더링 아키텍처 + 전투/맵/UI 수치 상세
> **Development Roadmap**: [`docs/designs/v10-development-roadmap.md`](v10-development-roadmap.md) — S01~S59 단계별 구현 순서 (DAG 의존관계)
> **UI/UX Design**: [`docs/designs/v10-ui-ux-plan.md`](v10-ui-ux-plan.md) — 전체 화면 설계, 컴포넌트 스펙, 모바일 반응형, 접근성
>
> ### ⚡ 구현 현황
> | 시스템 | TS 프로토타입 | Go 서버 | 비고 |
> |--------|:---:|:---:|------|
> | AgentEntity (단일 위치 엔티티) | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/agent.go` |
> | UpgradeSystem (8 Tome + 6 Ability + 10 시너지) | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/upgrade.go` |
> | ArenaShrink (아레나 수축) | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/shrink.go` |
> | CollisionSystem (오라 DPS + 대시 충돌) | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/collision.go` |
> | BotBehaviors (봇 빌드 패스 + 레벨업) | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/bot.go` |
> | SpatialHash + StateSerializer | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/spatial_hash.go` |
> | WebSocket Hub + Protocol | ❌ Socket.IO | ⏳ 설계 완료 | `server/internal/ws/hub.go` (channel-based) |
> | Room State Machine + RoomManager | ✅ 완료 | ⏳ 포팅 예정 | `server/internal/game/room.go` |
> | 클라이언트 렌더링 (MC 캐릭터) | ❌ 미구현 | — | Phase 3 |
> | 클라이언트 WS 어댑터 (Socket.IO→native) | ❌ 미구현 | — | Phase 3 |
> | 로비 재설계 (캐릭터 커스터마이저) | ❌ 미구현 | — | Phase 3 |
> | Agent API (LLM 통합) | ❌ 미구현 | ⏳ | Phase 4 |
>
> **TS 프로토타입 역할**: Go 포팅 시 1:1 참조 코드. 로직/상수/타입을 Go로 옮기는 레퍼런스.

---

## 1. Vision & Core Concept

### 1.1 한 줄 요약

> **"Agent Survivor" — AI 에이전트가 전략을 짜고 싸우는 멀티플레이어 자동전투 서바이벌 로그라이크**
>
> 마인크래프트 스타일 캐릭터("에이전트")가 아레나를 돌아다니며 자동으로 전투하고,
> XP를 수집해 레벨업하며, 무작위 업그레이드(Tome + Ability) 중 하나를 선택해
> 시너지 빌드를 완성하고, 5분 라운드에서 최후의 1인이 될 때까지 생존한다.

### 1.2 리브랜딩: Snake Arena → Agent Survivor

| 항목 | Before (Snake Arena) | After (Agent Survivor) |
|------|---------------------|----------------------|
| **게임 이름** | Snake Arena | **Agent Survivor** |
| **캐릭터** | 뱀 (세그먼트 연결체) | **마인크래프트 스타일 에이전트** (단일 캐릭터) |
| **엔티티 구조** | segments: Position[] (머리+몸통) | **position: Position (단일 위치)** + hitbox |
| **충돌 모델** | 머리-몸통 충돌 (복잡) | **캐릭터 히트박스 근접 전투** (단순) |
| **시각적 크기** | mass = 세그먼트 수 = 길이 | **mass = HP** (시각적 약간의 스케일링) |
| **이동 모델** | 연속 이동 + 세그먼트 추적 | **연속 이동** (세그먼트 없음, 훨씬 단순) |
| **아이덴티티** | slither.io 클론 느낌 | **"AI 에이전트 배틀로얄"** 고유 정체성 |
| **스킨** | 뱀 무늬 24종 | **MC 캐릭터 커스터마이징** (모자/갑옷/색상) |
| **게임 루프** | 오브 먹고 커지기 | **자동전투 + 레벨업 + 빌드 전략** |

### 1.3 왜 "Agent Survivor"인가?

| 기존 방향 | Megabonk 영감 | Agent Survivor 결합 |
|----------|-------------|-------------------|
| 오브 수집 → 성장 | XP → 레벨업 → 업그레이드 | 오브 = XP + 레벨업 → Tome/Ability 선택 |
| 뱀 대시 킬 | 자동전투 (오토 어택) | 에이전트 근접 자동 공격 + 대시 킬 |
| 파워업 오브 | 29종 무기 + Tome 스택 | 6 Ability + 8 Tome 풀 |
| 5분 라운드 | 10분 서바이벌 런 | 5분 라운드 + 아레나 수축 |
| 봇 AI | 빌드 전략 | AI 에이전트 전략적 빌드 선택 |

**"Agent"의 이중 의미**:
1. **게임 캐릭터**: 마인크래프트 스타일 복셀 에이전트 — 플레이 가능한 캐릭터
2. **AI 에이전트**: Claude, GPT, 커스텀 LLM이 조종하는 자율 플레이어

→ 게임 이름 자체가 AI 에이전트 플랫폼의 정체성을 내포

### 1.4 핵심 차별점

1. **자동전투 에이전트**: MC 스타일 캐릭터가 근접 시 자동으로 전투 → 전략이 핵심
2. **AI가 전략가**: LLM 에이전트가 레벨업 때 업그레이드를 선택하고, 사냥/수집 전략 결정
3. **사용자가 코치**: "빌드 프로필"을 가르침 (e.g. "공격적, Speed+Venom 우선")
4. **시너지 발견**: 특정 업그레이드 조합이 히든 보너스 발동 → 실험과 탐색
5. **메타 경쟁**: 에이전트 빌드 메타 형성 → 카운터 전략 등장
6. **MC 비주얼**: 마인크래프트 복셀 스타일 = 로비와 인게임 통일된 아트 디렉션

### 1.5 Success Metrics

| 지표 | 목표 | 측정 |
|------|------|------|
| 평균 레벨 도달 | Lv 8~12 (5분 라운드) | 라운드당 평균 레벨 |
| 시너지 발동률 | 30%+ 라운드 | 시너지 보너스 횟수 |
| 에이전트 빌드 다양성 | 5종+ 메타 빌드 | 에이전트 업그레이드 패턴 분석 |
| 에이전트 훈련 사용률 | 40%+ 에이전트 | 커스텀 빌드 프로필 설정 비율 |
| 평균 라운드 킬 | 3+ kills/round | 자동전투 킬 카운트 |

### 1.6 아트 디렉션 — "Everything is Minecraft"

> **핵심 원칙**: 캐릭터, 맵, 환경, UI, 파티클 — **모든 시각 요소가 마인크래프트 복셀 스타일**.
> 로비와 인게임의 아트 디렉션이 완전히 통일되어야 함.

#### 1.6.1 비주얼 스타일 가이드

| 영역 | MC 스타일 적용 | 구체 예시 |
|------|---------------|----------|
| **캐릭터** | 복셀 휴머노이드 (Steve/Alex 비율) | 8×8×12 블록 비율, 4px 팔, 16×16 텍스처 |
| **맵 지형** | 복셀 그리드 타일 | 잔디 블록, 흙, 돌, 모래 — MC 텍스처 팔레트 |
| **맵 오브젝트** | 블록 구조물 | Shrine=석재 기둥, Altar=옵시디언 제단, Gate=네더 포탈 |
| **파티클** | MC 정사각형 파티클 | 4×4 픽셀 파티클, MC 표준 색상 |
| **UI/HUD** | MC 인벤토리 스타일 | McPanel 다크 배경, 픽셀 폰트, 엠보스 보더 |
| **하늘/배경** | MC 하늘 그라데이션 | 낮하늘 파랑→하양, 구름 블록 |
| **수축 경계** | 월드 보더 이펙트 | MC 빨간 투명 벽 + 워프 파티클 (엔드 포탈 느낌) |

#### 1.6.2 컬러 팔레트 (MC 표준 기반)

```
지형 팔레트:
  잔디:    #5D9B47 (상단) + #8B6A3E (측면/흙)
  돌:      #7F7F7F (stone) + #5F5F5F (cobblestone)
  모래:    #DBD3A0
  물:      #3F76E4 (반투명 0.6)
  용암:    #CF4E0A (Core Zone 데코)

존별 지형 테마:
  Edge Zone:  잔디+참나무 — 안전한 평원 느낌
  Mid Zone:   돌+자갈 — 전장 느낌
  Core Zone:  네더랙+용암 — 고위험 느낌

UI 팔레트 (기존 lib/minecraft-ui.ts 확장):
  패널 배경:  rgba(0, 0, 0, 0.75) + 3D 엠보스
  XP 바:     #7FFF00 (MC 경험치 바 초록)
  HP 바:     #FF3333 (MC 하트 빨강)
  쿨다운:    #AAAAAA (비활성 회색)
  시너지:    #FFD700 (금색 글로우)
```

#### 1.6.3 카메라 & 뷰포트

```
현재 Phase (2D Canvas):
  - 시점: Top-Down 직교 (기존 유지)
  - 줌: 동적 줌 (mass 기반, 기존 camera.ts 유지)
  - 배경: MC 잔디 블록 타일 패턴 (16×16 반복)
  - 존 경계: 색상 변화 (잔디→돌→네더랙)

향후 Phase (3D R3F):
  - 시점: 45° 쿼터뷰 (경사 탑뷰)
  - 카메라: 에이전트 추적, 높이 고정
  - 배경: MC 복셀 지형 + 하늘 + 구름 (기존 LobbyScene3D 기반)
```

#### 1.6.4 맵 오브젝트 비주얼 디자인

| 오브젝트 | MC 블록 구성 | 크기 | 비주얼 효과 |
|---------|-------------|------|-----------|
| **XP Shrine** | 석재 기둥 3×3×4 + 인챈트 테이블 상단 | 48×64 px | 보라 인챈트 파티클 상시 |
| **Healing Spring** | 청록 물 블록 2×2 + 석재 테두리 | 48×48 px | 하트 파티클 + 물결 애니메이션 |
| **Upgrade Altar** | 옵시디언 3×3 + 엔더 크리스탈 상단 | 48×72 px | 보라 빔 + 엔더 파티클 (MC 엔드) |
| **Speed Gate** | 네더 포탈 프레임 (옵시디언 아치) | 32×64 px | 보라 포탈 이펙트 + 소용돌이 |

#### 1.6.5 아레나 수축 비주얼

```
수축 경고 (10초 전):
  - 미니맵: 빨간 점선 원 (새 경계선)
  - HUD: "⚠️ 아레나 수축 10초" MC 레드스톤 텍스트

수축 진행 중:
  - 경계: MC 월드 보더 이펙트 — 빨간 반투명 벽 (opacity 0.3)
  - 파티클: 경계선 따라 빨간 레드스톤 파티클 흩뿌림
  - 경계 밖: 화면 가장자리 빨간 비네팅 + mass 감소 표시

수축 완료:
  - 새 경계 안정화, 벽 opacity 0.15로 감소
```

#### 1.6.6 게임 내 HUD 스타일 (MC 인벤토리 기반)

```
┌──────────────────────────────────────────────────────────┐
│  [HP 바 — MC 하트 스타일]  [XP 바 — MC 경험치 바 초록]     │
│  ❤️❤️❤️❤️❤️ mass:85      ████████░░ Lv.7 (65%)           │
│                                                          │
│  좌하단: Tome 스택 아이콘                                   │
│  ┌──┬──┬──┬──┐                                           │
│  │⚔️×3│🛡️×2│⚡×1│💀×1│  ← MC 아이템 슬롯 스타일 (다크 배경)│
│  └──┴──┴──┴──┘                                           │
│                                                          │
│  우하단: Ability 슬롯 (쿨다운 오버레이)                     │
│  ┌──┬──┬──┐                                              │
│  │🟢│🔵│⬜│  ← 활성/쿨다운/빈슬롯                          │
│  └──┴──┴──┘                                              │
│                                                          │
│  상단 중앙: 라운드 타이머                                   │
│  ⏱️ 3:24 | 🏆 #4/18                                      │
│                                                          │
│  시너지 발동 시: 금색 텍스트 팝업 + MC 인챈트 글로우         │
│  "⚡ Glass Cannon 시너지 발동! DPS +50%"                   │
└──────────────────────────────────────────────────────────┘

디자인 시스템: 기존 McPanel/McButton 확장
  - HP/XP 바: MC 표준 (하트+초록 바)
  - Tome 아이콘: 16×16 MC 아이템 스프라이트
  - Ability 슬롯: MC 핫바 스타일 (다크 배경 + 밝은 보더)
  - 폰트: "Press Start 2P" (제목), "Inter" (수치)
```

---

## 2. Core Game Loop — 자동전투 서바이벌

### 2.1 핵심 루프 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    v10 Core Game Loop                            │
│                                                                 │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐  │
│  │  이동    │───▷│ 자동전투  │───▷│ XP 수집  │───▷│  레벨업   │  │
│  │(조향+부스트)│  │(근접 오라) │   │(오브+킬XP)│   │(3택 업그레이드)│ │
│  └─────────┘    └──────────┘    └──────────┘    └───────────┘  │
│       ▲                                              │          │
│       │         ┌──────────┐    ┌──────────┐         │          │
│       └─────────│ 시너지   │◁───│ 빌드 누적 │◁────────┘          │
│                 │ 발동 체크  │   │(Tome+Ability)│                │
│                 └──────────┘    └──────────┘                    │
│                                                                 │
│  ⏱️ 5분 타이머: 난이도 곡선 상승 → 아레나 수축 → 최후 1인 생존  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 루프 상세

| 단계 | 설명 | Tick 빈도 |
|------|------|----------|
| **이동** | 에이전트 조향 + 대시(부스트) | 매 tick (20Hz) |
| **자동전투** | 에이전트 오라 반경 내 적에게 자동 DPS 적용 | 매 tick |
| **XP 수집** | 오브 수집 시 XP 획득 + 킬 보너스 XP | 이벤트 기반 |
| **레벨업** | XP 바 가득 참 → 3개 랜덤 업그레이드 제시 → 1개 선택 | 이벤트 기반 |
| **빌드 누적** | 선택한 Tome 스택/Ability 추가 → 스탯 재계산 | 레벨업 시 |
| **시너지 체크** | 보유 업그레이드 조합이 시너지 조건 충족 시 보너스 발동 | 레벨업 시 |
| **난이도 곡선** | 시간 경과 → 적 봇 강화 (30초마다) + 아레나 수축 (1분마다 -600px) | 30초/1분 |

### 2.3 기존 vs v10 비교

```
v7 (Snake Arena): 뱀 이동 → 오브 수집 → 세그먼트 성장 → 대시 킬 → 사망 → 리스폰
v10 (Agent Survivor): 에이전트 이동 → 자동전투+오브 → XP → 레벨업 → 빌드 선택 → 시너지 → 생존
                                                             ↑ 핵심 결정 포인트
```

**핵심 변화**:
- 엔티티: 세그먼트 연결 뱀 → **단일 캐릭터 에이전트** (MC 스타일)
- 성장: 크기(세그먼트 수) → **빌드 깊이** (Tome 스택 + Ability 조합)
- 전투: 머리-몸통 충돌 → **자동 근접 전투 (히트박스 오라)**
- mass: 길이 = 시각적 크기 → **HP 풀** (시각적 약간의 스케일링만)

---

## 3. XP & 레벨업 시스템

### 3.1 XP 소스

| 소스 | XP 량 | 비고 |
|------|-------|------|
| Natural Orb 수집 | 1~2 XP | 기존 오브 value 재사용 |
| Death Orb 수집 | 3~5 XP | 처치된 에이전트의 분해 오브 |
| Power-Up Orb 수집 | 5 XP | 마그넷/스피드/고스트 오브 |
| Upgrade Altar 수집 | 15 XP | 기존 mega orb 대체 — 맵 오브젝트(§9)로 전환 |
| 자동전투 킬 | 10 + (적 레벨 × 3) XP | 높은 레벨 적 처치 보상 |
| 대시 킬 | 15 + (적 레벨 × 3) XP | 대시(부스트) 충돌 킬 (프리미엄 보상) |
| Kill Streak 보너스 | ×1.5 / ×2.0 / ×3.0 | 3연속 / 5연속 / 10연속 킬 |

### 3.2 레벨업 곡선

```
Level  Required XP  Cumulative   예상 도달 시간 (5분 라운드)
─────  ───────────  ──────────   ─────────────────────────
  1        0            0        시작
  2       20           20        ~15초
  3       30           50        ~30초
  4       45           95        ~50초
  5       65          160        ~1분 15초
  6       90          250        ~1분 45초
  7      120          370        ~2분 15초
  8      155          525        ~2분 50초
  9      195          720        ~3분 25초
 10      240          960        ~4분 00초
 11      290         1250        ~4분 35초
 12      345         1595        ~5분 (라운드 종료)
```

**설계 의도**: 평균 플레이어는 Lv 8~10, 숙련자/좋은 빌드는 Lv 11~12 도달.
에이전트의 "빌드 전략"이 레벨 도달 속도에 직접 영향 (XP Tome 선택 시 가속).

### 3.3 레벨업 선택 UI

레벨업 시 **3개 랜덤 업그레이드 카드**가 표시되며 1개를 선택:

```
┌──────────────────────────────────────────────────────────┐
│                    LEVEL UP! (Lv 5)                       │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ 🟢 Speed │   │ 🔴 Venom │   │ 🔵 XP    │            │
│  │   Tome   │   │ Ability  │   │   Tome   │            │
│  │          │   │          │   │          │            │
│  │ +15%     │   │ 근접 독   │   │ XP +20% │            │
│  │ 이동속도  │   │ 데미지    │   │ 획득량   │            │
│  │          │   │          │   │          │            │
│  │ [1]      │   │ [2]      │   │ [3]      │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│                                                          │
│  ⏱️ 선택 시간: 5초 (타임아웃 시 랜덤 선택)               │
└──────────────────────────────────────────────────────────┘
```

**에이전트 통합**: 에이전트는 `level_up` 이벤트를 받고 `choose_upgrade` 명령으로 응답.
타임아웃(5초) 내 응답 못하면 서버가 랜덤 선택 → LLM 에이전트도 충분한 시간.

### 3.4 기존 시스템 매핑

```
기존 mass 시스템:
  오브 수집 → mass 증가 → 크기/속도 스케일링

v10 듀얼 시스템:
  오브 수집 → mass 증가 (HP 역할, 기존 유지)
           → XP 증가 (레벨업 트리거, 신규)

  mass = 생존력 (높은 mass = 더 오래 버팀)
  level = 빌드 깊이 (높은 레벨 = 더 강한 업그레이드 조합)
```

---

## 4. 업그레이드 시스템 — Tomes & Abilities

### 4.1 Tome (패시브 스택 업그레이드)

Megabonk의 Tome 시스템을 Agent Survivor에 맞게 변환. **패시브 스택형 스탯 부스트**.
슬롯 제한 없이 같은 Tome을 여러 번 선택해 스택 가능.

| Tome | 티어 | 1스택 효과 | 최대 스택 | 풀스택 효과 | 에이전트 전략 가치 |
|------|------|-----------|----------|-----------|------------------|
| **XP Tome** | S | XP 획득 +20% | 10 | +200% XP | 극초반 필수 (복리 효과) |
| **Speed Tome** | S | 이동속도 +10% | 5 | +50% 속도 (225px/s) | 회피/추격 핵심 (max 5로 밸런스 조정) |
| **Damage Tome** | S | 오라 DPS +15% | 10 | +150% 데미지 | 공격 빌드 핵심 |
| **Armor Tome** | A | 받는 데미지 -10% | 8 | -80% 피해감소 | 탱크 빌드 |
| **Magnet Tome** | A | 오브 수집 반경 +25% | 6 | +150% 반경 | XP 빌드 시너지 |
| **Luck Tome** | A | 레어 업그레이드 확률 +15% | 6 | +90% 확률 | 시너지 빌드 핵심 |
| **Regen Tome** | B | 매초 mass +0.5 회복 | 5 | +2.5/s 회복 | 지구전 빌드 |
| **Cursed Tome** | S* | DPS +25%, 받는 피해 +20% | 5 | +125% DPS, +100% 피해 | **리스크/리워드** |

**Cursed Tome 특별 룰**: Megabonk의 Holy Trinity 참고.
- 리스크가 크지만 Armor Tome과 조합하면 피해 증가를 상쇄 → **시너지 발견 유도**
- 에이전트 훈련의 핵심 테스트: "언제 Cursed Tome을 집어야 하는가?"

**스택 공식**:
```
최종 스탯 = 기본값 × (1 + Σ tome_stack_i × effect_per_stack_i)
예: Speed = 150 × (1 + 3 × 0.10) = 150 × 1.30 = 195 px/s (max 5스택: 225 px/s, 대시 300과 안전 마진)
```

### 4.2 Ability (액티브 스킬)

기존 파워업 오브(magnet/speed/ghost)를 **영구 보유 Ability로 전환**.
레벨업 시 Tome 대신 Ability를 선택할 수 있음. **기본 2 Ability 슬롯** (RP로 3번째 슬롯 해금 가능, §10.2 참조).

| Ability | 효과 | 쿨다운 | 자동 발동 조건 | 에이전트 전략 |
|---------|------|--------|---------------|-------------|
| **Venom Aura** | 근접 적에게 독 DoT (3s) | 없음 (패시브) | 항상 활성 | 공격 빌드 핵심 |
| **Shield Burst** | 3초간 무적 + 주변 적 밀침 | 15초 | 체력 30% 이하 시 | 방어 빌드 |
| **Lightning Strike** | 가장 가까운 적에게 순간 데미지 | 8초 | 사거리 내 적 감지 시 | 원거리 킬 |
| **Speed Dash** | 2초간 3배 속도 + 충돌 면역 | 12초 | 적 추격/도주 시 | 기동 빌드 |
| **Mass Drain** | 터치한 적의 mass 10% 흡수 | 10초 | 머리 충돌 시 | 탱크 빌드 시너지 |
| **Gravity Well** | 3초간 주변 오브+적을 끌어당김 | 20초 | 오브 밀집 지역 | XP 가속 빌드 |

**자동 발동 시스템**:
- Ability는 **자동으로 발동** → 에이전트 조종에만 집중
- 각 Ability에 우선순위 기반 트리거 조건이 있음
- 에이전트는 `set_ability_priority` 명령으로 발동 순서 조정 가능

**Ability 업그레이드**:
- 이미 보유한 Ability가 다시 등장하면 → **강화** (데미지 +30%, 쿨다운 -20%)
- 최대 3회 강화 (Lv1 → Lv2 → Lv3 → Lv4)

```
Ability Slot 예시:
  [1] Venom Aura Lv3   — DPS 45/s (기본 15 × 3강)
  [2] Shield Burst Lv2  — 4초 무적 (기본 3초 + 강화)
  [3] Lightning Lv1     — 50 데미지, 8초 쿨다운
```

### 4.3 시너지 시스템

Megabonk의 "Holy Trinity" 개념 확장. 특정 업그레이드 조합이 **히든 시너지 보너스** 발동.
에이전트와 인간 모두 **실험과 발견**을 통해 시너지를 찾아야 함.

#### 공개 시너지 (힌트 제공)

| 시너지 이름 | 조건 | 보너스 | 전략 의미 |
|------------|------|--------|----------|
| **Holy Trinity** | XP Tome×3 + Luck Tome×2 + Cursed Tome×1 | 모든 XP +50% 추가 | Megabonk 오마주, 고위험 고보상 |
| **Glass Cannon** | Damage Tome×5 + Cursed Tome×3 | DPS ×2.0 (피해도 ×2.0) | 극 공격, 초저 생존 |
| **Iron Fortress** | Armor Tome×4 + Regen Tome×3 + Shield Burst | 받는 피해 추가 -30% | 풀 탱크 빌드 |
| **Speedster** | Speed Tome×4 + Speed Dash + Magnet Tome×2 | 부스트 비용 -50% | 고속 수집+도주 |
| **Vampire** | Venom Aura + Mass Drain + Regen Tome×2 | 독 피해의 20%를 mass 회복 | 지속전 빌드 |
| **Storm** | Lightning Strike Lv3 + Damage Tome×3 | 번개 연쇄 (3 적까지) | AoE 킬 빌드 |

#### 히든 시너지 (발견형)

- 총 4개의 히든 시너지 존재 → **에이전트 탐색 콘텐츠**
- 힌트: 라운드 끝 결과 화면에서 "???에 근접한 조합 발견!" 표시
- 에이전트 메모리에 시너지 시도 결과 저장 → 점진적 발견

#### 시너지 체크 로직 (서버)

```typescript
interface SynergyDef {
  id: string;
  name: string;
  requirements: {
    tomes?: Record<TomeType, number>;      // 최소 스택 수
    abilities?: Record<AbilityType, number>; // 최소 레벨
  };
  bonus: SynergyBonus;
  hidden: boolean;
}

// 레벨업 때마다 체크
function checkSynergies(build: PlayerBuild): SynergyDef[] {
  return ALL_SYNERGIES.filter(s => meetsSynergyRequirements(build, s));
}
```

---

## 5. 자동전투(Auto-Combat) 메카닉

### 5.1 에이전트 전투 시스템

모든 에이전트는 캐릭터 주위에 **전투 오라(Combat Aura)**를 가짐.
뱀의 복잡한 머리-몸통 충돌 대신, **단순한 원형 히트박스 기반 근접 전투**.

```
┌─────────────────────────────────────────────┐
│        Agent Combat Aura 다이어그램          │
│                                             │
│          ╭─── 전투 오라 반경 (60px) ───╮    │
│         ╱                              ╲   │
│        │    ╭── 히트박스 (16px) ──╮     │  │
│        │    │   ╔═══╗            │     │  │
│        │    │   ║ A ║ ← MC Agent │     │  │
│        │    │   ╚═══╝            │     │  │
│        │    ╰────────────────────╯     │  │
│        │      ← 자동 DPS 영역 →        │  │
│         ╲                              ╱   │
│          ╰────────────────────────────╯    │
│                                             │
│  기본 DPS: 2.0/tick (40 mass/s @ 20Hz)     │
│  Damage Tome ×3: 5.0/tick (100 mass/s)     │
└─────────────────────────────────────────────┘
```

### 5.2 전투 규칙

| 규칙 | 설명 |
|------|------|
| **기본 오라 DPS** | 2.0 mass/tick (40 mass/s) → Damage Tome으로 스케일 |
| **전투 오라 반경** | 60px (고정, Tome으로 확장 불가) |
| **상호 피해** | 두 에이전트가 서로 오라 범위 내 → 양쪽 모두 피해 |
| **레벨 보너스** | 고레벨 에이전트(Lv8+)는 DPS +20% |
| **대시 킬** | 부스트 돌진 시 히트박스 충돌 → **추가 버스트 데미지** (mass 30% 즉시 피해) |
| **킬 크레딧** | 오라 데미지로 mass 0 도달 시 → 마지막 가해자에게 킬 |
| **Venom 상호작용** | Venom Aura 보유 시 → 기본 오라에 독 DoT 추가 |

**대시 킬**: 기존 뱀의 "머리-몸통 충돌 즉사"를 대체.
- 부스트 상태로 상대 히트박스에 돌진 → 상대 mass의 30% 즉시 피해
- 즉사는 아니지만, 자동전투 오라와 조합하면 빠른 킬 가능
- 리스크: 대시 후 자신도 상대 오라 범위에 진입 → 상호 피해

### 5.3 Mass = HP 시스템

```
v10 (Agent Survivor):
  mass = HP (히트 포인트) — 세그먼트 개념 없음
  mass 0 → 사망 (킬 크레딧은 마지막 가해자)
  mass < 15 → 대시(부스트) 불가
  mass > 0 → 오라 전투로 점진적 감소

  시각적 스케일링:
    mass 10 (초기) → 1.0× 크기
    mass 50         → 1.2× 크기
    mass 100+       → 1.4× 크기 (최대)

  사망 시: mass의 80%가 XP Orb로 분해 + 킬러에게 XP 보너스
```

### 5.4 전투 밸런스

- **초반** (Lv1~3): 오라 DPS 낮음 → 오브 수집이 주 활동, 전투 회피 유리
- **중반** (Lv4~7): Damage Tome 스택으로 전투 의미 있음 → 킬 보상 매력적
- **후반** (Lv8+): 고 DPS vs 탱크 빌드 대결 → 빌드 카운터 중요
- **아레나 수축**: 강제 밀집 → 전투 빈도 증가 → 생존 압박

### 5.5 파생 상수 테이블 (Derived Constants)

기획서 수치에서 도출되는 서버 틱 단위 상수 (TICK_RATE = 20Hz):

| 상수 | 계산 | 값 | 용도 |
|------|------|-----|------|
| `BASE_SPEED_PER_TICK` | 150px/s ÷ 20 | 7.5 px/tick | 에이전트 기본 이동 |
| `MAX_SPEED_PER_TICK` (Speed×5) | 225px/s ÷ 20 | 11.25 px/tick | Speed Tome 풀스택 |
| `BOOST_SPEED_PER_TICK` | 300px/s ÷ 20 | 15.0 px/tick | 대시 속도 |
| `BASE_AURA_DPS_PER_TICK` | 40 mass/s ÷ 20 | 2.0 mass/tick | 오라 기본 데미지 |
| `AURA_RADIUS` | 고정 | 60 px | 전투 오라 반경 |
| `HITBOX_RADIUS` | mass 기반 | 16~22 px | 대시 충돌 판정 |
| `SHRINK_RATE` | 600px/min ÷ 20 ÷ 60 | 0.5 px/tick | 아레나 수축 속도 |
| `BOUNDARY_PENALTY_PER_TICK` | 5%/s ÷ 20 | 0.25% mass/tick | 경계 밖 패널티 |
| `XP_ORB_COLLECT_RADIUS` | 기존 유지 | 50 px | 오브 수집 범위 |
| `REGEN_PER_TICK` (Regen×1) | 0.5/s ÷ 20 | 0.025 mass/tick | 회복 Tome |

### 5.6 CollisionSystem 전면 개편

```
기존 (Snake Arena):
  - 경계 충돌 (벽)
  - 머리-몸통 충돌 (세그먼트 기반 — 복잡)
  - 머리-머리 충돌 (크기 비교)

v10 (Agent Survivor):
  - 경계 충돌 (유지 + 수축 경계)
  - 오라-오라 충돌 (DPS 교환) ← 핵심 전투
  - 대시 충돌 (부스트 돌진 → 버스트 데미지) ← 뱀 충돌 킬 대체
  - 세그먼트 기반 충돌 완전 제거 ← 대폭 단순화!

  SpatialHash: 세그먼트 → 에이전트 위치만 관리 (훨씬 가벼움)
  DeathEvent: damageSource: 'aura' | 'dash' | 'boundary' 추가
```

---

## 5B. Agent 캐릭터 디자인 (마인크래프트 스타일)

### 5B.1 캐릭터 컨셉

기존의 **뱀 세그먼트** 대신 **마인크래프트 스타일 복셀 캐릭터**를 사용.
로비에서 이미 MC 디자인 시스템(McPanel, McButton, LobbyScene3D)을 사용하고 있어 자연스러운 통일.

```
┌─────────────────────────────────────────────────────┐
│           Agent Character Design                     │
│                                                     │
│    Top-Down View          Isometric View             │
│                                                     │
│       ┌───┐                  ╔═══╗                  │
│       │ O │ ← 머리 (눈)      ║   ║ ← 복셀 상체     │
│       ├───┤                  ╠═══╣                  │
│       │   │ ← 몸통           ║   ║ ← 복셀 하체     │
│       │   │                  ╚═══╝                  │
│       └─┬─┘                  ╱   ╲ ← 다리          │
│        ╱ ╲ ← 이동 방향       ▼                      │
│                                                     │
│    16×16 pixel sprite    또는 3D voxel model         │
│    (2D Canvas 렌더링)    (Three.js/R3F 렌더링)       │
│                                                     │
│    2가지 렌더링 옵션 중 선택 (Phase별 결정)           │
└─────────────────────────────────────────────────────┘
```

### 5B.2 엔티티 구조 변경 — Snake → Agent

```typescript
// ❌ 기존 Snake 인터페이스 (제거)
interface Snake {
  segments: Position[];  // [0]=head, [n]=tail ← 제거!
  heading: number;
  targetAngle: number;
  speed: number;
  mass: number;          // = 세그먼트 수
  // ...
}

// ✅ 새로운 Agent 인터페이스
interface Agent {
  id: string;
  name: string;

  // 단일 위치 + 이동
  position: Position;       // ← segments 대신 단일 좌표!
  heading: number;          // current angle (0~2π)
  targetAngle: number;      // input-requested angle
  speed: number;            // current speed (px/s)

  // 전투 & 생존
  mass: number;             // HP 역할 (오라 피해로 감소)
  level: number;            // ← NEW: 현재 레벨
  xp: number;               // ← NEW: 현재 XP
  xpToNext: number;         // ← NEW: 다음 레벨까지 필요 XP
  boosting: boolean;        // 대시 (기존 부스트)
  alive: boolean;

  // 빌드 시스템
  build: PlayerBuild;       // ← NEW: Tome 스택 + Ability 슬롯
  activeSynergies: string[]; // ← NEW: 발동 중인 시너지

  // 비주얼
  skin: AgentSkin;           // ← 변경: SnakeSkin → AgentSkin

  // 파워업 효과 (기존 유지, Ability와 통합 예정)
  activeEffects: ActiveEffect[];
  effectCooldowns: EffectCooldown[];

  // 점수
  score: number;
  kills: number;
  bestScore: number;

  // 메타
  joinedAt: number;
  lastInputSeq: number;

  // 히트박스 (파생값)
  hitboxRadius: number;     // ← NEW: mass 기반 동적 크기
}

// 빌드 상태
interface PlayerBuild {
  tomes: Record<TomeType, number>;    // Tome별 스택 수
  abilities: AbilitySlot[];            // 최대 3개
}

interface AbilitySlot {
  type: AbilityType;
  level: number;  // 1~4 (강화 횟수)
}
```

### 5B.3 이동 모델 — 세그먼트 없는 이동

```
기존 (Snake):
  1. 입력: targetAngle
  2. heading을 targetAngle 쪽으로 turnRate만큼 회전
  3. head 이동: heading 방향 × speed
  4. 세그먼트 추적: 각 세그먼트가 앞 세그먼트의 위치를 따라감 ← 복잡
  5. trail 오브 생성: 부스트 시 마지막 세그먼트에서 오브 드롭

v10 (Agent):
  1. 입력: targetAngle (변경 없음)
  2. heading을 targetAngle 쪽으로 turnRate만큼 회전 (변경 없음)
  3. position 이동: heading 방향 × speed (변경 없음)
  4. 세그먼트 추적: 없음! ← 대폭 단순화
  5. trail: 없음 (대시 시 mass 소비만) ← 단순화

  → update() 메서드가 ~70줄에서 ~25줄로 감소
  → SpatialHash에 세그먼트 등록/제거 불필요
```

### 5B.4 AgentSkin — MC 스타일 캐릭터 커스터마이징 시스템

> **설계 원칙**: Minecraft Bedrock Character Creator + .io 게임 코스메틱 시스템을 결합.
> 모든 커스터마이징은 **순수 장식**이며 게임플레이에 영향 없음.
> 조합 가능 수 (Tier 1+2+4 장비만): **~2.19B 조합** (15 피부 × 2 체형 × 3 크기 × 8 패턴 × 16 모자 × 14 등 × 17 의상 × 10 악세 × 10 손 × 8 신발)
> Tier 3(얼굴) + Tier 5(이펙트) + Tier 6(네임태그) 포함 시 **수조 단위**. Phase별 실제 조합 수는 §5B.4.5 참조.

```typescript
// ❌ 기존 SnakeSkin (뱀 전용 — 제거)
interface SnakeSkin {
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'cute' | 'angry' | 'cool' | 'wink' | 'dot';
  headShape?: 'round' | 'arrow' | 'diamond';
  tailEffect?: 'bubble' | 'trail' | 'spark' | 'fade';
}

// ✅ 새로운 AgentSkin — 5-Tier 커스터마이징 시스템
interface AgentSkin {
  id: number;
  name: string;                               // 프리셋 이름 또는 "Custom"
  rarity: SkinRarity;                         // 코스메틱 희귀도

  // ═══════════════════════════════════════
  // TIER 1: BASE (기본 체형)
  // ═══════════════════════════════════════
  bodyType: 'standard' | 'slim';              // MC Steve(4px팔) vs Alex(3px팔)
  bodySize: 'small' | 'medium' | 'large';     // 체형 비율 (히트박스 불변)
  skinTone: SkinTone;                         // 15종 피부색

  // ═══════════════════════════════════════
  // TIER 2: COLORS & SURFACE (색상 + 표면)
  // ═══════════════════════════════════════
  bodyColor: BodyColor;                        // 메인 상의 색상 (12색 팔레트)
  legColor: BodyColor;                        // 하의 색상 (12색 팔레트)
  pattern: SurfacePattern;                    // 패턴 (8종)
  patternColor?: BodyColor;                   // 패턴 보조 색상 (12-color MC wool 팔레트)

  // ═══════════════════════════════════════
  // TIER 3: FACE (얼굴 커스터마이징)
  // ═══════════════════════════════════════
  eyeStyle: EyeStyle;                        // 눈 스타일 (8종)
  eyeColor?: EyeColor;                       // 눈 색상 (일부 스타일은 고정 — visor→시안, enderman→보라)
  mouthStyle: MouthStyle;                    // 입 스타일 (6종)
  markings: FaceMarkings;                    // MC 몹 테마 페이스 마킹 (8종)

  // ═══════════════════════════════════════
  // TIER 4: EQUIPMENT (장비 — 순수 장식)
  // ═══════════════════════════════════════
  hat: HeadwearType;                         // 모자/헬멧 (16종)
  backItem: BackItemType;                    // 등 장비 (14종)
  bodyOverlay: BodyOverlayType;              // 의상 오버레이 (17종)
  accessory: AccessoryType;                  // 목/얼굴 악세서리 (10종)
  handItem: HandItemType;                    // 손 아이템 (10종)
  footwear: FootwearType;                    // 신발 (8종)

  // ═══════════════════════════════════════
  // TIER 5: EFFECTS (이펙트 — 일부 빌드 자동 연동)
  // ═══════════════════════════════════════
  auraColor?: string;                        // 전투 오라 (빌드 기반 자동)
  weaponVisual?: string;                     // Ability 기반 무기 비주얼 (자동)
  trailEffect: TrailEffect;                  // 이동 궤적 (8종)
  deathEffect: DeathEffect;                  // 사망 연출 (6종)
  killEffect: KillEffect;                    // 킬 이펙트 (6종)
  spawnEffect: SpawnEffect;                  // 등장 이펙트 (8종)
  emote: EmoteType;                          // 감정 표현 (8종)

  // ═══════════════════════════════════════
  // TIER 6: NAMETAG (네임태그 커스텀)
  // ═══════════════════════════════════════
  nametagStyle: NametagStyle;                // 네임태그 스타일 (6종)
  nametagColor?: McTextColor;                // 네임태그 글자 색상 (MC §색상 코드 기반)
  title?: string;                            // 칭호 ("The Destroyer", "Tome Master" 등)
}

// ── 서브 타입 정의 ──

type SkinRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

type BodyColor =
  | 'white' | 'light_gray' | 'gray' | 'black'
  | 'red' | 'orange' | 'yellow' | 'green'
  | 'cyan' | 'blue' | 'purple' | 'brown';
  // MC 양털 12색 기반 팔레트

type EyeColor =
  | 'brown' | 'blue' | 'green' | 'gray' | 'hazel' | 'amber'
  | 'violet' | 'red';  // visor→시안 고정, enderman→보라 고정 (eyeStyle에 따라 override)

type McTextColor =
  | 'white' | 'gray' | 'dark_gray' | 'black'
  | 'gold' | 'yellow' | 'green' | 'dark_green'
  | 'aqua' | 'dark_aqua' | 'blue' | 'dark_blue'
  | 'red' | 'dark_red' | 'light_purple' | 'dark_purple';
  // MC §색상 코드 16색 기반

type SkinTone =
  | 'pale' | 'light' | 'fair' | 'medium_light' | 'medium'
  | 'olive' | 'tan' | 'brown' | 'dark_brown' | 'deep'
  | 'warm_beige' | 'cool_pink' | 'golden' | 'ashen' | 'otherworldly';

type SurfacePattern =
  | 'solid' | 'striped' | 'checkered' | 'dotted'
  | 'marble' | 'scales' | 'camo' | 'gradient';

type EyeStyle =
  | 'default' | 'cute' | 'angry' | 'cool'
  | 'wink' | 'dot' | 'visor' | 'enderman';

type MouthStyle =
  | 'smile' | 'neutral' | 'determined'
  | 'open' | 'fangs' | 'none';

type FaceMarkings =
  | 'none' | 'blaze_stripes' | 'skeleton_face' | 'creeper_face'
  | 'enderman_eyes' | 'wither_scars' | 'piglin_snout' | 'guardian_spikes';

type HeadwearType =
  | 'none'
  | 'helmet_iron' | 'helmet_gold' | 'helmet_diamond' | 'helmet_netherite'
  | 'crown' | 'tophat' | 'wizard_hat' | 'headband' | 'antenna'
  | 'pumpkin' | 'flower_crown' | 'straw_hat' | 'viking' | 'santa' | 'graduation';

type BackItemType =
  | 'none'
  | 'cape_red' | 'cape_blue' | 'cape_purple' | 'cape_gold'
  | 'wings_angel' | 'wings_bat' | 'wings_elytra' | 'wings_butterfly' | 'wings_ender' | 'wings_phoenix'
  | 'backpack' | 'quiver' | 'jetpack';

type BodyOverlayType =
  | 'none'
  | 'knight_armor' | 'pirate_coat' | 'ninja_suit' | 'astronaut_suit' | 'chef_apron'
  | 'scientist_coat' | 'wizard_robe' | 'samurai_armor' | 'hoodie' | 'tuxedo'
  | 'creeper_hoodie' | 'enderman_suit' | 'blaze_armor' | 'wither_cloak'
  | 'diamond_armor' | 'netherite_armor';

type AccessoryType =
  | 'none'
  | 'scarf' | 'necklace' | 'goggles' | 'mask_creeper' | 'mask_pumpkin'
  | 'monocle' | 'bandana' | 'flower_pin' | 'earring';

type HandItemType =
  | 'none'
  | 'sword_diamond' | 'pickaxe_iron' | 'torch' | 'shield_iron'
  | 'enchanted_book' | 'fishing_rod' | 'bow' | 'trident' | 'totem_of_undying';

type FootwearType =
  | 'none' | 'boots_iron' | 'boots_gold' | 'boots_diamond' | 'boots_netherite'
  | 'sneakers' | 'sandals' | 'roller_skates';

type TrailEffect =
  | 'none' | 'sparkle' | 'smoke' | 'hearts'
  | 'fire' | 'ice_crystals' | 'ender_particles' | 'redstone_dust';

type DeathEffect =
  | 'none' | 'explosion' | 'poof' | 'shatter' | 'dissolve' | 'firework';

type KillEffect =
  | 'none' | 'lightning_strike' | 'confetti' | 'skull_popup' | 'gold_burst' | 'ender_flash';

type SpawnEffect =
  | 'none' | 'beam_down' | 'portal_emerge' | 'block_build' | 'nether_gate'
  | 'lightning_strike' | 'soul_fire' | 'ender_teleport';

type EmoteType =
  | 'none' | 'wave' | 'dance' | 'taunt' | 'clap'
  | 'bow' | 'spin' | 'flex';

type NametagStyle =
  | 'default' | 'gold_outline' | 'enchanted_glow' | 'fire_text'
  | 'ice_text' | 'rainbow_cycle';
```

#### 5B.4.1 코스메틱 카탈로그 — 카테고리별 상세

**Tier 1: Base (기본 체형)** — 모든 플레이어 무료

| 카테고리 | 옵션 수 | 목록 |
|----------|---------|------|
| Body Type | 2 | Standard (Steve 4px팔), Slim (Alex 3px팔) |
| Body Size | 3 | Small (0.85x), Medium (1.0x), Large (1.15x) — 히트박스 불변 |
| Skin Tone | 15 | pale, light, fair, medium_light, medium, olive, tan, brown, dark_brown, deep, warm_beige, cool_pink, golden, ashen, otherworldly |

**Tier 2: Surface (색상 + 패턴)** — 대부분 무료, 일부 Uncommon

| 패턴 | 설명 | 희귀도 |
|------|------|--------|
| Solid | 단색 | Common |
| Striped | 가로 줄무늬 (2색) | Common |
| Checkered | MC 체크 패턴 | Common |
| Dotted | 도트 패턴 | Common |
| Marble | 대리석 텍스처 | Uncommon |
| Scales | 비늘/다이아 블록 패턴 | Uncommon |
| Camo | 위장 패턴 | Uncommon |
| Gradient | 그라데이션 | Uncommon |

**Tier 3: Face (얼굴)** — Common~Rare

| 카테고리 | 옵션 | 특이사항 |
|----------|------|----------|
| Eyes (8종) | default, cute, angry, cool, wink, dot, visor, enderman | visor=반사 바이저, enderman=보라 발광 |
| Eye Color (8색) | brown, blue, green, gray, hazel, amber, violet, red | visor→시안 고정, enderman→보라 고정 (EyeColor 타입) |
| Mouth (6종) | smile, neutral, determined, open, fangs, none | fangs=뱀파이어/피글린 테마 |
| Markings (8종) | none, blaze_stripes, skeleton_face, creeper_face, enderman_eyes, wither_scars, piglin_snout, guardian_spikes | MC 몹 테마 페이스페인트 |

> **MC 몹 마킹 시스템**: 캐릭터에 MC 몹 정체성을 부여하는 핵심 차별화 요소.
> Creeper 면상 + 초록 hoodie = 완전한 "크리퍼 에이전트" 완성.

**Tier 4: Equipment (장비)** — Uncommon~Legendary

| 카테고리 | 수량 | 상세 목록 |
|----------|------|----------|
| **Headwear** (16) | 모자/헬멧 | none, helmet_iron, helmet_gold, helmet_diamond, helmet_netherite, crown, tophat, wizard_hat, headband, antenna, pumpkin, flower_crown, straw_hat, viking, santa, graduation |
| **Back Item** (14) | 등 장비 | none, cape_(red/blue/purple/gold), wings_(angel/bat/elytra/butterfly/ender/phoenix), backpack, quiver, jetpack |
| **Body Overlay** (17) | 의상 | none, knight/pirate/ninja/astronaut/chef/scientist/wizard_robe/samurai/hoodie/tuxedo, + MC: creeper_hoodie/enderman_suit/blaze_armor/wither_cloak/diamond_armor/netherite_armor |
| **Accessory** (10) | 악세서리 | none, scarf, necklace, goggles, mask_creeper, mask_pumpkin, monocle, bandana, flower_pin, earring |
| **Hand Item** (10) | 손 장식 | none, sword_diamond, pickaxe_iron, torch, shield_iron, enchanted_book, fishing_rod, bow, trident, totem_of_undying |
| **Footwear** (8) | 신발 | none, boots_(iron/gold/diamond/netherite), sneakers, sandals, roller_skates |

**Tier 5: Effects (이펙트)** — Rare~Mythic

| 카테고리 | 수량 | 상세 목록 |
|----------|------|----------|
| **Trail** (8) | 이동 궤적 | none, sparkle, smoke, hearts, fire, ice_crystals, ender_particles, redstone_dust |
| **Death** (6) | 사망 연출 | none, explosion, poof, shatter, dissolve, firework |
| **Kill** (6) | 킬 이펙트 | none, lightning_strike, confetti, skull_popup, gold_burst, ender_flash |
| **Spawn** (5) | 등장 | none, beam_down, portal_emerge, block_build, nether_gate |
| **Emote** (8) | 감정 | none, wave, dance, taunt, clap, bow, spin, flex |

**Tier 6: Nametag (네임태그)** — Uncommon~Epic

| 스타일 | 설명 | 희귀도 |
|--------|------|--------|
| default | 흰색 기본 태그 | Common |
| gold_outline | MC 금색 테두리 | Uncommon |
| enchanted_glow | 인챈트 보라색 빛남 | Rare |
| fire_text | 불꽃 글자 | Epic |
| ice_text | 얼음 결정 글자 | Epic |
| rainbow_cycle | 무지개 순환 | Legendary |

#### 5B.4.2 희귀도 시스템 & 획득 경로

> **희귀도 범위**: 희귀도는 **프리셋 캐릭터**에만 적용됩니다.
> 개별 아이템(모자, 날개 등)은 프리셋에 포함되어 해금되며, 해금 후 자유롭게 조합 가능.
> 업적 보상은 항상 **프리셋 캐릭터 해금** 형태로 제공됩니다.

```
┌──────────────┬───────┬──────────────────────────────────────────┐
│   희귀도      │ 색상   │ 획득 방법                                │
├──────────────┼───────┼──────────────────────────────────────────┤
│ Common       │ ⬜ 흰  │ 기본 제공 (첫 시작 시 전부 해금)            │
│ Uncommon     │ 🟩 초  │ 게임 10회 플레이 / 첫 승리 등 쉬운 업적      │
│ Rare         │ 🟦 파  │ 킬 50회 / 연속 3승 / 5000 XP 등 중급 업적   │
│ Epic         │ 🟪 보  │ 시너지 5종 발견 / 토너먼트 우승 / 특수 퀘스트  │
│ Legendary    │ 🟧 금  │ 누적 1000킬 / 전 시너지 발견 / 전설 업적     │
│ Mythic       │ 🟥 빨  │ 누적 10,000킬 / 100 토너먼트 우승 (Phase 4+) │
└──────────────┴───────┴──────────────────────────────────────────┘
```

**업적 기반 해금 예시** (보상은 프리셋 캐릭터 해금, 해금 후 개별 아이템 자유 조합 가능):
| 업적 | 보상 프리셋 | 희귀도 |
|------|-------------|--------|
| 첫 번째 킬 | "Knight" 프리셋 (ID 20) | Uncommon |
| 10연속 생존 | "Ninja" 프리셋 (ID 23) | Uncommon |
| 킬 50회 누적 | "Creeper Agent" 프리셋 (ID 12) | Rare |
| 시너지 "Holy Trinity" 달성 | "Holy Paladin" 프리셋 (ID 30, Epic) | Epic |
| 토너먼트 우승 3회 | "Gladiator" 프리셋 (ID 31, Epic) | Epic |
| 전 시너지 발견 (10/10) | "Phoenix" 프리셋 (ID 28) | Legendary |
| 1000킬 누적 | "Wither Storm" 프리셋 (ID 18) | Legendary |
| 10,000킬 누적 (Phase 4+) | "Ender Dragon" 프리셋 (ID 26) | Mythic |

#### 5B.4.3 프리셋 캐릭터 (34종)

**기본 캐릭터 (12종 — Common, 시작 시 전부 해금)**:
```
ID 00: "Steve"      — standard/medium, 파랑 상의, 회색 하의, default eyes
ID 01: "Alex"       — slim/medium, 초록 상의, 갈색 하의, cute eyes
ID 02: "Iron Guard" — standard/large, 실버 상의, 회색 하의, determined mouth
ID 03: "Gold Elite" — slim/small, 금색 상의, 갈색 하의, cool eyes
ID 04: "Diamond"    — standard/medium, 시안 상의, 남색 하의, default eyes
ID 05: "Emerald"    — slim/medium, 에메랄드 상의, 짙은초록 하의, cute eyes
ID 06: "Redstone"   — standard/medium, 빨강 상의, 짙은빨강 하의, angry eyes
ID 07: "Obsidian"   — standard/large, 보라 상의, 검정 하의, dot eyes
ID 08: "Prismarine" — slim/small, 틸 상의, 청록 하의, wink eyes
ID 09: "Sand"       — standard/medium, 베이지 상의, 갈색 하의, neutral mouth
ID 10: "Netherite"  — standard/large, 다크브라운 상의, 검정 하의, determined mouth
ID 11: "Amethyst"   — slim/medium, 라벤더 상의, 보라 하의, cute eyes
```

**MC 몹 테마 캐릭터 (8종 — Rare, 업적 해금)**:
```
ID 12: "Creeper Agent"   — creeper_face + creeper_hoodie + sparkle trail
ID 13: "Enderman"        — enderman_eyes + enderman_suit + ender_particles trail
ID 14: "Blaze Runner"    — blaze_stripes + blaze_armor + fire trail
ID 15: "Skeleton King"   — skeleton_face + wither_cloak + smoke trail
ID 16: "Piglin Brute"    — piglin_snout + knight_armor + gold_burst kill
ID 17: "Guardian"        — guardian_spikes + knight_armor (aqua tint) + ice_crystals trail
     (NOTE: astronaut_suit→knight_armor 변경 — MC Guardian(수중 몹) 테마에 갑옷이 적합)
ID 18: "Wither Storm"    — wither_scars + netherite_armor + skull_popup kill
ID 19: "Phantom Shade"   — enderman_eyes + ninja_suit + dissolve death
```

**직업 테마 캐릭터 (6종 — Uncommon, 쉬운 업적)**:
```
ID 20: "Knight"     — helmet_iron + knight_armor + shield_iron + boots_iron
ID 21: "Wizard"     — wizard_hat + wizard_robe + enchanted_book + sparkle trail
ID 22: "Pirate"     — straw_hat + pirate_coat + sword_diamond + bandana
ID 23: "Ninja"      — headband + ninja_suit + bow + smoke trail
ID 24: "Astronaut"  — helmet_diamond + astronaut_suit + jetpack + beam_down spawn
ID 25: "Viking"     — viking + knight_armor + trident + lightning_strike kill
```

**업적 테마 캐릭터 (4종 — Epic, 도전적 업적 해금)**:
```
ID 30: "Holy Paladin"   — crown + wizard_robe (white) + shield_iron + gold_burst kill + sparkle trail
ID 31: "Gladiator"      — helmet_netherite + samurai_armor + sword_diamond + explosion death
ID 32: "Shadow Assassin" — headband + ninja_suit (black) + bow + dissolve death + smoke trail
ID 33: "Archmage"       — wizard_hat + wizard_robe (blue) + enchanted_book + ender_flash kill + sparkle trail
```

**시즌 한정 캐릭터 (4종 — Legendary~Mythic)**:
```
ID 26: "Ender Dragon"    — 🟥 Mythic — wings_ender + netherite_armor + ender_flash kill + portal_emerge spawn
ID 27: "Santa Agent"     — 🟧 Legendary — santa + hoodie (red) + backpack + hearts trail
ID 28: "Phoenix"         — 🟧 Legendary — crown (gold) + wings_phoenix + fire trail + firework death
     (NOTE: flower_crown→crown 변경 — 불사조 테마에 왕관이 적합. 꽃관은 자연/요정 테마용)
ID 29: "The Glitch"      — 🟥 Mythic — visor + scientist_coat + rainbow nametag + shatter death + confetti kill
```

#### 5B.4.4 사용자가 생각 못 했을 창의적 요소들

**1. 인챈트 글로우 시스템**
- MC의 인챈트 아이템처럼 장비에 보라색 글로우 오버레이
- Tome 3스택 이상 시 해당 아이템 슬롯이 인챈트 빛남
- ex) Speed Tome ×4 → boots가 인챈트 글로우 + 잔상
- ex) Damage Tome ×5 → hand item이 인챈트 글로우

**2. 킬 스트릭 시각 변화**
- 3연속 킬: 이름 위에 🔥 아이콘
- 5연속 킬: 몸 전체 금색 테두리
- 10연속 킬: 캐릭터 주변 번개 파티클 (다른 플레이어에게 위협적)
- 킬 스트릭은 사망 시 리셋

**3. 칭호(Title) 시스템**
- 네임태그 아래 작은 글씨로 표시
- 업적 기반 자동 부여: "Tome Master" (모든 Tome 5스택), "One Shot" (첫 킬로 우승)
- 시즌 칭호: "Season 1 Champion", "Beta Tester"
- 재미 칭호: "Creeper Cosplayer" (크리퍼 풀셋 착용), "Naked & Afraid" (장비 0으로 우승)

**4. 커스텀 사망 메시지**
- 킬 시 채팅에 표시되는 메시지 커스터마이징
- 기본: "{killer} eliminated {victim}"
- 해금: "{killer} bonked {victim} 💥", "{killer} sent {victim} to the Nether 🌋"
- MC 테마: "{killer} mined {victim} ⛏️", "{killer} enchanted {victim} into oblivion ✨"

**5. 로비 전용 코스메틱** (Phase 4+)
- 로비에서만 보이는 펫 (미니 MC 몹: 아기 좀비, 앵무새, 고양이, 여우, 벌)
- 로비 대기 포즈 (서 있기, 앉기, 팔짱, 기대기)
- 로비 파티클 (발밑 꽃, 눈, 하트)

```typescript
// Phase 4+ placeholder types
type LobbyPetType = 'none' | 'baby_zombie' | 'parrot' | 'cat' | 'fox' | 'bee';
type LobbyPoseType = 'standing' | 'sitting' | 'arms_crossed' | 'leaning';
type LobbyParticle = 'none' | 'flowers' | 'snow' | 'hearts' | 'sparkles';
```

**6. 진화형 코스메틱 (Progressive Cosmetics)** (Phase 4+)
- 사용할수록 "진화"하는 스킨
- ex) Iron Boots → 100킬 후 자동으로 Diamond Boots로 시각 변화
- ex) Angel Wings → 50승 후 금빛 날개로 변화
- 스탯 트래커 기능: 해당 스킨으로 킬/승리 수 표시

```typescript
// Progressive Cosmetics 백엔드 데이터 모델
interface PlayerCosmeticStats {
  playerId: string;
  presetStats: Record<number, {  // presetId → stats
    kills: number;
    wins: number;
    gamesPlayed: number;
    currentTier: number;  // 0=base, 1=evolved, 2=final
  }>;
}
// 저장: JSON 파일 (Phase 4) → DB (Phase 5+)
```

**7. 시너지 테마 코스메틱 세트** (Phase 3+)
- Holy Trinity 시너지 달성 → 금색 후광 + 특수 네임태그
- Venomancer 시너지 → 보라색 독안개 상시 이펙트
- Glass Cannon 시너지 → 깨지는 유리 파티클

```typescript
// 시너지 비주얼 오버라이드 (게임 중 자동 적용)
interface SynergyVisualOverride {
  synergyId: string;
  auraOverride?: string;     // 오라 색상 강제
  trailOverride?: TrailEffect;
  nametagOverride?: NametagStyle;
  particleOverride?: string;  // 추가 파티클 이펙트명
}
```

**8. 관전자/사망 후 유령 스킨** (Phase 3+)
- 사망 후 관전 시 반투명 유령 모드 적용
- 유령 스킨도 커스터마이징 가능 (투명도, 색상, 글로우)

```typescript
// 유령 스타일 설정
interface GhostStyleConfig {
  opacity: number;        // 0.2~0.5
  tintColor: string;      // 반투명 색조
  glowEnabled: boolean;
}
```

**9. 헤어스타일에 대한 의도적 생략 노트**
> MC Character Creator에는 헤어 옵션이 있으나, Agent Survivor에서는 **의도적으로 생략**.
> 이유: (1) 16×16 픽셀 스케일에서 헤어 ≈ 모자와 구분 불가, (2) Headwear가 사실상 헤어 역할,
> (3) 복셀 캐릭터 특성상 모자가 머리 전체를 덮으므로 중복. Phase 4+ 3D 전환 시 재검토.

#### 5B.4.5 코스메틱 구현 페이즈

```
Phase 1 (MVP — 2D Canvas):
  - Tier 1 (체형): bodyType(2) + skinTone(15) — bodySize는 medium 고정
  - Tier 2 (색상): bodyColor(12 팔레트) + legColor(12) + pattern(4종: solid/striped/checkered/dotted)
  - Tier 3 (얼굴): eyeStyle(8) + mouthStyle(6) — markings 없음
  - Tier 4 (장비): hat(6종) + accessory(4종) — 간단 2D 스프라이트
  - 프리셋: 12 Common 기본 캐릭터
  - 이펙트: 없음 (Tier 5~6 비활성)
  → 2D 16×16 스프라이트, 풀조합 ~138K (장비만: 2×4×6×4 = 192 프리셋급)

Phase 2 (업적 + 확장):
  - Tier 2 확장: 전체 8 패턴
  - Tier 3 확장: markings 8종
  - Tier 4 확장: 전체 카테고리 (backItem, bodyOverlay, handItem, footwear)
  - 프리셋: 12 Common + 6 직업 + 8 몹테마 + 4 Epic = 30종
  - 업적 해금 시스템 연결
  - 희귀도 + 코스메틱 인벤토리 UI
  → Tier 1-4 전체: ~2.19B 조합 (실제 유의미 조합은 프리셋 + 소수 커스텀)

Phase 3 (3D R3F 전환):
  - 3D MC 복셀 모델로 전환 (기존 LobbySnakePreview 기술 기반)
  - 모든 장비 3D 렌더링
  - Tier 5 이펙트: trail + death + kill + spawn + emote (파티클 시스템)
  - Tier 6 네임태그: 글로우 셰이더
  - 시즌 한정 캐릭터 (4종)
  → ~2.19B+ 조합 (Tier 5 이펙트 포함 시 더 증가), 완전한 MC 캐릭터 시스템
  ⚠️ NOTE: 현재 이펙트 시스템(sketch-style 연필 이펙트)은 0% 호환.
  MC 파티클 시스템(sparkle/smoke/fire/ice/ender/redstone) 완전 신규 개발 필요.
  기존 spark/trail/bubble/fade 재사용 불가 → Phase 3 파티클 엔진 별도 설계.

Phase 4+ (라이브 서비스):
  - 시즌별 배틀패스 코스메틱
  - 커뮤니티 스킨 투표
  - 진화형 코스메틱 (Progressive)
  - 로비 펫 + 포즈 + 파티클
  - 킬 스트릭 시각 변화
  - 커스텀 사망 메시지
```

### 5B.5 렌더링 방향 — MC 스타일 통일

> **원칙**: "Everything is Minecraft" — 모든 렌더링이 MC 복셀 스타일 (§1.6 참조)

| 옵션 | 장점 | 단점 | MC 느낌 | 난이도 |
|------|------|------|---------|--------|
| **A: 2D Canvas (MC 스프라이트)** | 빠름, 성능 좋음 | 3D 아닌 MC | ★★★☆☆ | 낮음 |
| **B: 2.5D Canvas (아이소메트릭)** | MC 느낌 좋음, 성능 양호 | 새 에셋 필요 | ★★★★☆ | 중 |
| **C: 3D R3F (추천)** | 로비와 완전 통일, 진짜 MC | 성능 최적화 | ★★★★★ | 높음 |

**추천: 2D MC 스프라이트 → 3D R3F 점진 전환**
1. Phase 1~2: **2D Canvas** — MC 스타일 16×16 스프라이트 (탑다운, 블록 체형 보존)
2. Phase 3: **2D→3D 전환 준비** — 스프라이트 에셋 + R3F 프로토타입
3. Phase 4+: **3D R3F** — 로비와 통일, 진짜 MC 복셀 월드

```
Phase 1 (2D MC 스프라이트):
  ┌──────┐
  │ ■■■■ │ ← 16×16 MC 캐릭터 스프라이트 (탑다운)
  │ ■  ■ │    머리+몸통+다리 구분 가능한 블록 실루엣
  │ ■■■■ │    장비/색상 2D로 표현
  └──────┘
  배경: MC 잔디 블록 타일 패턴 (16×16 반복 타일)

Phase 4+ (3D R3F):
  ╔═══╗
  ║ ● ║ ← MC 복셀 캐릭터 (8×8×12 블록)
  ╠═══╣    로비 LobbyScene3D 기술 기반
  ║   ║    → AgentModel3D.tsx
  ╚═══╝
  배경: MC 복셀 지형 + 하늘 + 구름 (LobbyScene3D 재활용)
```

**2D Phase에서 MC 느낌 극대화 방법**:
- 캐릭터: 원형이 아닌 **사각형 실루엣** (MC 블록 느낌)
- 배경: 잔디/돌/네더랙 **16×16 타일 반복** (존별 다른 타일)
- 맵 오브젝트: **블록 구조물 스프라이트** (§9.1 비주얼 참조)
- 파티클: **4×4 정사각형 픽셀** (MC 파티클 표준)
- 수축 경계: **빨간 반투명 라인** + 레드스톤 파티클

### 5B.6 빌드 시각적 피드백

에이전트의 현재 빌드가 **시각적으로 표현**됨:

| 빌드 | 시각 효과 | 설명 |
|------|----------|------|
| Damage Tome ×3+ | 빨간 전투 오라 | 공격적 빌드 |
| Armor Tome ×3+ | 파란 보호막 셰이더 | 방어 빌드 |
| Speed Tome ×3+ | 잔상 이펙트 (afterimage) | 고속 빌드 |
| Venom Ability | 초록 독안개 | 독 공격 |
| Lightning Ability | 파란 전기 스파크 | 번개 공격 |
| Shield Ability | 반투명 구체 | 무적 순간 |
| 시너지 활성 | 금색 파티클 후광 | 시너지 발동 중 |
| Cursed Tome ×2+ | 보라색 균열 이펙트 | 저주 리스크 표시 |

→ 다른 플레이어/에이전트의 빌드를 **시각적으로 읽을 수 있음** → 전략적 판단

---

## 6. Agent 전략 레이어

### 6.1 레벨업 시 업그레이드 선택 전략

에이전트의 **핵심 결정 포인트**. 레벨업 시 3개 업그레이드 중 하나를 선택.
v9 Commander Mode와 통합하여 에이전트가 전략적 빌드 선택을 수행.

#### 레벨업 이벤트 프로토콜

```typescript
// 서버 → 에이전트 (레벨업 시)
interface LevelUpEvent {
  type: 'level_up';
  level: number;
  choices: UpgradeChoice[];  // 3개
  currentBuild: {
    tomes: Record<TomeType, number>;    // 현재 Tome 스택
    abilities: AbilitySlot[];            // 현재 Ability (최대 3)
    activeSynergies: string[];           // 활성 시너지
    nearbySynergies: string[];           // "1개 더 모으면 발동" 시너지
  };
  gameContext: {
    timeRemaining: number;  // 남은 시간 (초)
    myRank: number;         // 현재 순위
    myMass: number;         // 현재 HP
    nearbyThreats: number;  // 근처 위협 수
    arenaRadius: number;    // 현재 아레나 크기
  };
  deadline: number;  // 선택 제한 시간 (5000ms)
}

// 에이전트 → 서버
interface ChooseUpgradeCommand {
  type: 'choose_upgrade';
  choiceIndex: 0 | 1 | 2;
  reasoning?: string;  // 선택 이유 (로그/분석용, 선택적)
}
```

#### 에이전트 의사결정 흐름

```
레벨업 이벤트 수신
  ↓
현재 빌드 상태 확인
  ↓
┌─ 시너지 근접 체크: "1개 더 모으면 시너지?" → YES → 그 업그레이드 우선
│
├─ 빌드 프로필 체크: 사용자가 지정한 우선순위와 매칭 → 매칭되면 선택
│
├─ 게임 상황 판단:
│   ├─ 초반(>3분 남음): XP/Luck Tome 우선 (성장 가속)
│   ├─ 중반(1~3분 남음): Damage/Ability 우선 (전투력)
│   └─ 후반(<1분 남음): Armor/Shield 우선 (생존)
│
└─ 기본 전략: 가장 높은 시너지 점수 업그레이드 선택
```

### 6.2 자동사냥 전략 (Commander Mode 확장)

v9 Commander Mode의 전략 명령을 v10 자동전투 시스템에 맞게 확장.

#### 확장된 Commander Mode 명령

```typescript
// v9에서 유지되는 명령
type BaseCommands =
  | { cmd: 'go_to'; x: number; y: number }
  | { cmd: 'go_center' }
  | { cmd: 'flee' }
  | { cmd: 'hunt'; targetId: string }
  | { cmd: 'hunt_nearest' }
  | { cmd: 'gather' }
  | { cmd: 'set_boost'; enabled: boolean };

// v10 신규 전략 명령
type SurvivalCommands =
  | { cmd: 'engage_weak' }           // 자기보다 약한 적과 오라 전투
  | { cmd: 'avoid_strong' }           // 자기보다 강한 적 회피
  | { cmd: 'farm_orbs'; zone: 'safe' | 'center' | 'edge' }  // 안전한 구역에서 오브 파밍
  | { cmd: 'kite'; targetId: string }  // 적 주위를 돌며 오라 피해만 입히고 도주
  | { cmd: 'camp_shrinkage' }          // 아레나 수축 경계에서 대기 (밀려오는 적 킬)
  | { cmd: 'priority_target'; targetType: 'weakest' | 'highest_xp' | 'lowest_hp' }
  | { cmd: 'set_combat_style'; style: 'aggressive' | 'defensive' | 'balanced' }
  | { cmd: 'set_ability_priority'; order: number[] }  // Ability 자동발동 우선순위 [slotIdx]
  | { cmd: 'choose_upgrade'; choiceIndex: 0 | 1 | 2; reasoning?: string };  // 레벨업 선택
```

#### 전략 모드 프리셋

에이전트는 **전체 전략 모드**를 설정하거나 세부 명령을 개별 발행:

| 전략 모드 | 행동 | 적합 빌드 |
|----------|------|----------|
| **Aggressive** | 적극 추격 + engage_weak + hunt_nearest | Damage+Venom 빌드 |
| **Defensive** | 회피 우선 + farm_orbs safe + avoid_strong | Armor+Regen 빌드 |
| **Balanced** | 상황 판단 (강한 적 회피, 약한 적 추격) | 범용 |
| **XP Rush** | 오브만 수집 + 전투 최소화 + farm_orbs center | XP+Luck+Magnet 빌드 |
| **Endgame** | 아레나 중앙 확보 + camp_shrinkage | 후반 특화 |

#### SurvivalCommands → BotBehaviors 매핑

봇 AI의 기존 행동 트리 함수와 v10 명령의 매핑:

| SurvivalCommand | BotBehaviors 함수 | 구현 노트 |
|-----------------|-------------------|----------|
| `engage_weak` | `behaviorHunt()` + mass 비교 필터 | hunt 대상을 mass < self로 제한 |
| `avoid_strong` | `behaviorSurvive()` 확장 | 위협 감지 반경에 mass 비교 추가 |
| `farm_orbs {zone}` | `behaviorGather()` + zone 제한 | 존 경계 내 오브만 타겟팅 |
| `kite {targetId}` | NEW `behaviorKite()` | 타겟 hitbox 밖 + 오라 범위 내 유지 |
| `camp_shrinkage` | NEW `behaviorCamp()` | 수축 경계 -200px 위치 유지 |
| `priority_target` | `behaviorHunt()` 필터 변경 | 정렬 기준 교체 (mass/xp/hp) |
| `set_combat_style` | 모드별 행동 가중치 변경 | aggressive=hunt 80%, defensive=survive 80% |

#### 빌드-전략 연동

```
에이전트 빌드에 따라 자동사냥 전략 최적화:

빌드: Damage×5 + Venom + Cursed×2
  → 추천 전략: Aggressive
  → 이유: 높은 DPS, 접근전 유리, 오래 버티기 어려움

빌드: Armor×4 + Regen×3 + Shield
  → 추천 전략: Defensive → Endgame
  → 이유: 느린 킬, 높은 생존, 후반 유리

빌드: XP×3 + Luck×2 + Magnet×2
  → 추천 전략: XP Rush → Balanced (Lv8+에서 전환)
  → 이유: 빠른 레벨업, 충분히 강해지면 전투 전환
```

### 6.3 빌드 패스 시스템

사전 정의된 **빌드 패스(Build Path)**로 에이전트의 업그레이드 선택을 가이드.
Megabonk의 캐릭터별 최적 빌드 개념을 에이전트 설정으로 변환.

#### 빌드 패스 정의

```typescript
interface BuildPath {
  id: string;
  name: string;
  description: string;
  priority: UpgradeType[];  // 우선순위 순서
  synergyTarget: string;    // 목표 시너지
  phaseStrategy: {
    early: CombatStyle;    // 0~2분
    mid: CombatStyle;      // 2~4분
    late: CombatStyle;     // 4~5분
  };
}
```

#### 기본 제공 빌드 패스 (5종)

| 빌드 패스 | 우선순위 | 목표 시너지 | 전략 전환 |
|-----------|---------|-----------|----------|
| **Berserker** | Damage > Cursed > Venom > Speed | Glass Cannon | XP Rush → Aggressive |
| **Tank** | Armor > Regen > Shield > Mass Drain | Iron Fortress | Balanced → Defensive → Endgame |
| **Speedster** | Speed > Magnet > XP > Speed Dash | Speedster 시너지 | XP Rush → XP Rush → Balanced |
| **Vampire** | Venom > Mass Drain > Regen > Damage | Vampire 시너지 | Balanced → Aggressive → Aggressive |
| **Scholar** | XP > Luck > Magnet > (상황 판단) | Holy Trinity | XP Rush → Balanced → Endgame |

#### 에이전트 빌드 선택 알고리즘

```
function chooseUpgrade(choices, buildPath, gameContext):
  // 1. 시너지 근접 체크 (1개 더 모으면 시너지 발동?)
  for choice in choices:
    if wouldCompleteSynergy(choice, currentBuild):
      return choice  // 시너지 완성 최우선

  // 2. 빌드 패스 우선순위 매칭
  for priorityType in buildPath.priority:
    match = choices.find(c => c.type === priorityType)
    if match:
      return match

  // 3. Ability 슬롯 한도 체크
  if (currentAbilityCount >= maxAbilitySlots):
    // 슬롯 풀 → 새 Ability 선택지 무시, Tome 또는 기존 Ability 강화만
    choices = choices.filter(c => !isNewAbility(c))

  // 4. 이미 보유한 Ability 강화 체크
  for choice in choices:
    if isAbilityUpgrade(choice) && alreadyHas(choice):
      return choice  // Ability 강화 (Lv2→Lv3)

  // 5. 게임 상황 기반 폴백
  if gameContext.timeRemaining < 60:
    return mostDefensiveChoice(choices)
  else:
    return highestSynergyScore(choices)
```

---

## 7. 에이전트 훈련(Training) 시스템

### 7.1 사용자 → 에이전트 교육

사용자가 자신의 에이전트를 "코치"처럼 훈련하는 시스템.
에이전트에게 빌드 프로필, 전략 우선순위, 상황별 행동 규칙을 설정.

#### 훈련 인터페이스

```
┌──────────────────────────────────────────────────┐
│          🐍 Agent Training Console                │
│                                                  │
│  Agent: "my-claude-agent-01"                     │
│  Status: 🟢 Online | Win Rate: 34% | Avg Lv: 9  │
│                                                  │
│  ┌─── Build Profile ───────────────────────┐     │
│  │ Primary Path: Scholar (XP Rush)          │     │
│  │ Fallback Path: Tank (if Lv < 5 at 2min) │     │
│  │ Banned Upgrades: Cursed Tome             │     │
│  │ Priority Override: Always pick XP Tome   │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─── Combat Rules ────────────────────────┐     │
│  │ If mass > 2× enemy: engage               │     │
│  │ If mass < 0.5× enemy: flee                │     │
│  │ If time < 60s: go center + defensive      │     │
│  │ Never boost below mass 20                 │     │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  ┌─── Learning Log ────────────────────────┐     │
│  │ Round #47: Lv11, 4 kills, #2 (Berserker) │     │
│  │ Round #46: Lv9, 2 kills, #5 (Scholar)     │     │
│  │ Round #45: Lv7, 0 kills, #12 (Scholar)    │     │
│  │ → Insight: Scholar 빌드 후반 약함 → 전환 추천│    │
│  └──────────────────────────────────────────┘     │
│                                                  │
│  [Save Profile]  [Reset]  [Watch Live]           │
└──────────────────────────────────────────────────┘
```

#### 훈련 API

```typescript
// 사용자가 REST API로 에이전트 훈련 프로필 설정
PUT /api/v1/agents/{agentId}/training
{
  "buildProfile": {
    "primaryPath": "scholar",
    "fallbackPath": "tank",
    "fallbackCondition": { "levelBelow": 5, "timeElapsed": 120 },
    "bannedUpgrades": ["cursed_tome"],
    "alwaysPick": ["xp_tome"],
    "neverPick": []
  },
  "combatRules": [
    { "condition": "mass_ratio > 2.0", "action": "engage" },
    { "condition": "mass_ratio < 0.5", "action": "flee" },
    { "condition": "time_remaining < 60", "action": "go_center" },
    { "condition": "mass < 20", "action": "no_boost" }
  ],
  "strategyPhases": {
    "early": "xp_rush",
    "mid": "balanced",
    "late": "endgame"
  }
}
```

#### 훈련 모드 — "Show & Learn" (Phase 4~5)

1. **관전 모드** (Phase 4): 사용자가 직접 플레이하는 것을 에이전트가 관찰
   - 레벨업 시 사용자의 선택을 기록 → "이 상황에서 이 빌드를 선호"
   - 전투/도주 패턴을 기록 → 전략 규칙으로 변환
   - 구현: `observe_game` API + 클라이언트 입력 이벤트 로깅

2. **피드백 모드** (Phase 4): 에이전트 플레이 후 사용자가 리플레이를 보며 피드백
   - "레벨 5에서 Venom 대신 XP Tome을 골라야 했어" → 규칙 추가
   - "이 상황에서 도망치지 말고 싸워야 해" → 전투 규칙 조정
   - 구현: `RoundSummary.buildHistory` 기반 타임라인 + 사용자 어노테이션 UI
   - ⚠️ 리플레이 시스템 범위: tick-by-tick 리플레이는 Phase 5+. Phase 4에서는 빌드 히스토리 타임라인(텍스트) + 주요 이벤트 목록으로 대체.

3. **A/B 테스트 모드** (Phase 5): 같은 에이전트 2개를 다른 빌드 프로필로 돌림
   - 10라운드 후 통계 비교 → 더 나은 프로필 자동 채택
   - 구현: 에이전트 2개 동시 등록 + 라운드별 `RoundSummary` 비교 대시보드

### 7.2 에이전트 메모리 & 학습

에이전트가 라운드를 거듭하며 학습하는 **지속적 메모리 시스템**.
Megabonk의 메타 프로그레션을 에이전트 학습으로 재해석.

#### 라운드 결과 기록

매 라운드 종료 시 에이전트에게 전송:

```typescript
interface RoundSummary {
  roundId: string;
  result: {
    rank: number;
    level: number;
    kills: number;
    survivalTime: number;  // 초
    totalXP: number;
  };
  buildHistory: {
    level: number;
    choice: UpgradeType;
    alternatives: UpgradeType[];  // 다른 선택지
    gameState: 'early' | 'mid' | 'late';
  }[];
  activeSynergies: string[];
  deathCause: 'collision' | 'aura' | 'arena_shrink' | 'survived';
  keyMoments: {
    tick: number;
    event: 'kill' | 'death' | 'synergy_activated' | 'level_up';
    context: string;
  }[];
}
```

#### 에이전트 학습 데이터

에이전트가 자체적으로 축적하는 메모리:

```typescript
interface AgentMemory {
  // 빌드 성과 기록 (빌드 패턴 → 평균 순위)
  buildPerformance: Record<string, {
    avgRank: number;
    avgLevel: number;
    avgKills: number;
    sampleCount: number;
  }>;

  // 시너지 발견 기록
  discoveredSynergies: string[];
  synergyAttempts: Record<string, { attempts: number; completions: number }>;

  // 상대 분석 (자주 만나는 에이전트의 빌드 패턴)
  opponentProfiles: Record<string, {
    preferredBuild: string;
    winRateAgainst: number;
    counterStrategy: string;
  }>;

  // 맵 지식 (시간대별 안전/위험 구역)
  mapKnowledge: {
    safeZones: { time: 'early' | 'mid' | 'late'; zone: 'center' | 'edge' }[];
    dangerZones: { time: string; zone: string; reason: string }[];
  };
}
```

#### 학습 루프

```
라운드 종료 → RoundSummary 수신
  ↓
결과 분석:
  - "이 빌드로 평균 순위가 올랐나/떨어졌나?"
  - "시너지를 완성했을 때와 못 했을 때의 차이?"
  - "어떤 상대에게 잘/못 맞았나?"
  ↓
메모리 업데이트:
  - buildPerformance 통계 갱신
  - 새로운 시너지 발견 시 기록
  - 상대 프로필 갱신
  ↓
다음 라운드 전략 조정:
  - 성과 좋은 빌드 가중치 증가
  - 카운터 전략 발견 시 적용
  - 히든 시너지 탐색 시도
```

### 7.3 에이전트 성격 프리셋

사전 정의된 에이전트 성격 프리셋으로 빠른 시작 지원.
사용자가 처음부터 세부 설정 없이도 에이전트를 돌릴 수 있음.

| 성격 | 빌드 패스 | 전략 | 설명 |
|------|----------|------|------|
| **🗡️ Warrior** | Berserker | Aggressive 내내 | "먼저 공격, 나중에 생각" |
| **🛡️ Guardian** | Tank | Defensive → Endgame | "끝까지 살아남는 것이 승리" |
| **📚 Scholar** | Scholar | XP Rush → Balanced | "지식이 힘이다, 먼저 성장" |
| **🏃 Runner** | Speedster | XP Rush 내내 | "빠르게 모으고, 빠르게 도망" |
| **🧪 Experimenter** | 랜덤 | 랜덤 | "매 라운드 다른 빌드 시도 → 히든 시너지 탐색" |
| **🎯 Adaptive** | 메모리 기반 | 메모리 기반 | "과거 데이터로 최적 빌드 자동 선택" |

**Adaptive 성격**이 가장 고급: 에이전트 메모리의 `buildPerformance`를 분석하여
매 라운드 가장 높은 성과를 보인 빌드 패스를 자동 선택.
충분한 데이터(20+ 라운드) 이후 "메타 파악"이 가능.

---

## 8. 라운드 구조 변경

### 8.1 난이도 곡선 — 아레나 수축

Megabonk의 시간 압박을 "아레나 수축"으로 구현. 라운드 진행에 따라 맵이 좁아짐.

```
시간     아레나 반경    난이도     주요 이벤트
───────  ──────────   ────────   ─────────────
0:00     6000 (100%)  ★☆☆☆☆   라운드 시작, 오브 파밍
0:30     6000         ★☆☆☆☆   첫 레벨업 (대부분 Lv2~3)
1:00     5400 (90%)   ★★☆☆☆   수축 시작, 첫 전투 발생
1:30     5400         ★★☆☆☆   중급 업그레이드 등장
2:00     4800 (80%)   ★★★☆☆   중반, 빌드 방향 결정
2:30     4200 (70%)   ★★★☆☆   전투 빈번, 시너지 발동 시작
3:00     3600 (60%)   ★★★★☆   후반 진입, 약한 에이전트 탈락
3:30     3000 (50%)   ★★★★☆   고밀도 전투
4:00     2400 (40%)   ★★★★★   최후 생존전
4:30     1800 (30%)   ★★★★★   극단적 밀집
5:00     종료         -        최후 1인 승리 (또는 가장 높은 mass)
```

### 8.2 수축 메카닉

```
- 수축 속도: 1분마다 반경 -600px (1:00부터 시작)
- 경계 밖 패널티: 초당 mass 5% 감소 (빠르게 복귀 유도)
- 경고: 수축 10초 전 UI 경고 + 미니맵에 새 경계선 표시
- 봇 AI: behaveSurvive에 수축 인식 추가 (새 경계 기준으로 회피)
```

### 8.3 라운드 상태 머신 변경

```
기존: waiting → countdown(10s) → playing(5min) → ending(5s) → cooldown(15s)
v10:  waiting → countdown(10s) → playing(5min, 수축 포함) → ending(10s) → cooldown(15s)
                                    ↑                          ↑
                              난이도 곡선 추가           결과 + 빌드 분석 표시
```

### 8.4 리스폰 변경

```
기존: 사망 → 2초 후 리스폰 (mass 초기화)
v10:  사망 → 리스폰 금지 (서바이벌 — 1 Life)
      단, 초반 30초 이내 사망 시 → 1회 리스폰 허용 (grace period)

이유: 서바이벌 긴장감 + 빌드 선택의 무게감
      1 Life이므로 에이전트의 "생존 전략"이 핵심
```

### 8.5 라운드 결과 화면 확장

```
┌──────────────────────────────────────────┐
│          🏆 Round Result                  │
│                                          │
│  #1  🐍 player-alpha   Lv12  8 kills    │
│     Build: Damage×5 + Venom Lv3          │
│     Synergy: Glass Cannon ⚡              │
│                                          │
│  #2  🤖 claude-agent   Lv11  6 kills    │
│     Build: XP×3 + Luck×2 + Cursed×1     │
│     Synergy: Holy Trinity 📜             │
│                                          │
│  #3  🐍 player-beta    Lv10  5 kills    │
│     Build: Armor×4 + Regen×3             │
│     Synergy: Iron Fortress 🛡️            │
│                                          │
│  ❓ Hidden Synergy Hint:                  │
│     "Venom + Gravity 조합이 뭔가..."      │
│                                          │
│  [Play Again]  [View Build Stats]        │
└──────────────────────────────────────────┘
```

#### Build Stats Viewer (View Build Stats 클릭 시)

```
┌──────────────────────────────────────────┐
│  📊 Build Stats Viewer                   │
│                                          │
│  [빌드 타임라인]  [킬 로그]  [데미지 차트] │
│  ────────────────────────────────────     │
│  Lv1 → XP Tome (15s)                    │
│  Lv2 → Speed Tome (30s)                 │
│  Lv3 → XP Tome (50s)                    │
│  Lv4 → Venom Ability (1:15) ← 시너지 근접│
│  Lv5 → Damage Tome (1:45)               │
│  ...                                     │
│                                          │
│  총 데미지: 1,250 | 총 힐: 340           │
│  오라 킬: 5 | 대시 킬: 3                 │
│  시너지 발동: 2회 (Glass Cannon, Holy)    │
│                                          │
│  [닫기]                                   │
└──────────────────────────────────────────┘
```

> Phase 3에서 RoundResultOverlay 하위 컴포넌트로 구현.
> `RoundSummary.buildHistory[]`를 타임라인으로 시각화.

---

## 9. 맵 환경 시스템 — Minecraft 아레나

> **아트 디렉션**: 아레나 전체가 MC 복셀 월드. §1.6 비주얼 스타일 가이드 참조.

### 9.1 맵 오브젝트 — Megabonk Shrine/Shop 영감

기존 원형 아레나에 **MC 블록 구조물** 형태의 인터랙션 가능 맵 오브젝트 추가.

| 오브젝트 | 효과 | 위치 | 리스폰 | MC 비주얼 |
|---------|------|------|--------|----------|
| **XP Shrine** | 10초간 XP +50% 버프 | 랜덤 3곳 | 60초 | 석재 기둥 3×3×4 + 인챈트 테이블 상단, 보라 파티클 |
| **Healing Spring** | 접촉 시 mass 20% 회복 | 맵 가장자리 2곳 | 45초 | 청록 물 블록 2×2 + 석재 테두리, 하트 파티클 |
| **Upgrade Altar** | 즉시 레벨업 1회 (강력) | 정중앙 | 라운드당 1회 | 옵시디언 3×3 + 엔더 크리스탈, 보라 빔 |
| **Speed Gate** | 통과 시 5초간 ×2 속도 | 4방향 링 | 30초 | 옵시디언 아치 + 보라 네더 포탈 이펙트 |

### 9.2 지형 존 시스템 — MC 바이옴 테마

원형 아레나를 동심원 기반 3 존으로 분류, 각 존은 **다른 MC 바이옴 테마**:

```
┌──────────────────────────────────────────────┐
│  🌿 Edge Zone (외곽 40%) — "평원 바이옴"       │
│    지형: 잔디 블록 + 참나무 + 꽃               │
│    - 안전, 오브 밀도 낮음                       │
│    - Healing Spring (물 블록 구조물)            │
│    - 수축 시 먼저 사라짐 (빨간 월드 보더)       │
│                                              │
│  ┌──────────────────────────────┐            │
│  │  🪨 Mid Zone (중간 35%) — "석재 바이옴"│     │
│  │    지형: 돌+자갈 블록 + 횃불 조명          │
│  │    - 오브 밀도 보통                        │
│  │    - XP Shrine (석재 기둥 구조물)          │
│  │    - 적당한 전투 빈도                      │
│  │                                          │
│  │  ┌──────────────────────┐                │
│  │  │  🔥 Core (중앙 25%)   │                │
│  │  │  — "네더 바이옴"       │                │
│  │  │  지형: 네더랙+용암 데코│                │
│  │  │  - 오브 밀도 높음      │                │
│  │  │  - Upgrade Altar       │                │
│  │  │  (옵시디언+엔더크리스탈)│                │
│  │  │  - 전투 밀집, 고위험   │                │
│  │  └──────────────────────┘                │
│  └──────────────────────────────┘            │
└──────────────────────────────────────────────┘
```

**존별 MC 블록 팔레트**:
| 존 | 바닥 블록 | 장식 블록 | 조명 | 분위기 |
|----|----------|---------|------|--------|
| Edge (평원) | 잔디 블록 | 참나무, 꽃, 덤불 | 자연광 | 평화로운 시작 구역 |
| Mid (석재) | 돌, 자갈 | 석재 벽, 철 울타리 | 횃불 | 전투 준비 구역 |
| Core (네더) | 네더랙, 소울 샌드 | 용암 웅덩이(데코), 흑요석 | 용암 발광 | 위험한 보스 구역 |

### 9.3 에이전트의 맵 인식

Commander Mode observation에 존 정보 추가:

```typescript
interface MapObservation {
  currentZone: 'edge' | 'mid' | 'core';
  nearbyObjects: {
    type: 'xp_shrine' | 'healing_spring' | 'upgrade_altar' | 'speed_gate';
    distance: number;
    available: boolean;  // 쿨다운 여부
  }[];
  arenaRadius: number;        // 현재 수축 상태
  nextShrinkIn: number;       // 다음 수축까지 초
  orbDensity: {
    edge: number;
    mid: number;
    core: number;
  };
}
```

### 9.4 아레나 환경 & 분위기 — MC 월드 디테일

§1.6 아트 디렉션의 구체적 적용. 2D Phase에서도 MC 느낌을 살리는 환경 요소:

**바닥 타일 (2D Canvas)**:
- 16×16 반복 타일 — 존별 다른 텍스처
- Edge: 잔디 블록 타일 (#5D9B47 상단 + #8B6A3E 측면 디테일)
- Mid: 돌 블록 타일 (#7F7F7F + 균열 디테일)
- Core: 네더랙 타일 (#6B3030 + 금빛 광맥 디테일)

**환경 장식 (비충돌 데코)**:
| 존 | 장식 | 수량 | 렌더링 |
|----|------|------|--------|
| Edge | 참나무 (16×24 스프라이트) | 8~12개 | 반투명, 에이전트 뒤 레이어 |
| Edge | 꽃+덤불 (8×8 스프라이트) | 20~30개 | 바닥 데코 |
| Mid | 횃불 (8×16, 불 애니메이션 2프레임) | 12~16개 | 미약한 발광 이펙트 |
| Mid | 석재 벽 파편 (16×16) | 6~8개 | 부서진 벽 느낌 |
| Core | 용암 웅덩이 (32×32, 데코 전용) | 3~5개 | 오렌지 글로우 |
| Core | 흑요석 기둥 (16×32) | 4~6개 | 코어 랜드마크 |

**하늘/배경 (2D)**:
- Canvas 배경: MC 하늘 그라데이션 (밝은 파랑→흰)
- 수축 후 배경: 점진적 어두워짐 (파랑→진파랑→보라)
- 시간에 따른 분위기 변화로 라운드 긴장감 표현

**3D Phase 전환 시**:
- 모든 2D 데코를 3D 복셀 오브젝트로 교체
- 기존 LobbyScene3D의 VoxelTerrain + SkyBox 재활용
- 동적 라이팅 (Core=용암 발광, Edge=자연광)

---

## 10. 메타 프로그레션

### 10.1 에이전트 메타 프로그레션

Megabonk의 Silver 통화 → 에이전트의 **Reputation Points (RP)** 시스템.
라운드 결과에 따라 RP를 획득하고, RP로 영구 혜택 잠금 해제.

| RP 소스 | 획득량 |
|---------|-------|
| 라운드 참여 | +5 RP |
| Top 50% 진입 | +10 RP |
| Top 3 진입 | +25 RP |
| 1위 우승 | +50 RP |
| 시너지 완성 | +10 RP |
| 히든 시너지 최초 발견 | +100 RP |
| 킬 3+ | +5 RP |

### 10.2 RP 잠금 해제

| RP 요구 | 잠금 해제 | 설명 |
|---------|---------|------|
| 50 | **Ability Slot +1** | 2 → 3 Ability 슬롯 (기본 2개에서 시작) |
| 100 | **빌드 히스토리** | 지난 50 라운드의 빌드 통계 열람 |
| 200 | **에이전트 배지** | 승률 기반 배지 (Bronze/Silver/Gold/Diamond) |
| 500 | **카운터 인텔** | 현재 룸 에이전트들의 최근 빌드 패턴 정보 |
| 1000 | **커스텀 시너지 탐색** | 히든 시너지 힌트 3개 미리 제공 |

### 10.3 글로벌 리더보드 확장

```
기존: kills/score 기반 라운드 리더보드
v10 추가:
  - 에이전트 총 RP 랭킹
  - 빌드 승률 랭킹 (가장 많이 이긴 빌드 조합)
  - 시너지 발견자 명예의 전당
  - 에이전트 vs 에이전트 상대 전적
```

### 10.4 퀘스트 시스템 (Megabonk 240 퀘스트 참고)

간단한 퀘스트로 목표 부여:

| 퀘스트 | 조건 | 보상 |
|--------|------|------|
| First Blood | 첫 킬 달성 | +20 RP |
| Synergy Master | 3종 시너지 완성 | +50 RP |
| Speed Demon | Speed Tome ×5 달성 | +30 RP |
| Pacifist | 0킬로 Top 3 | +100 RP |
| Glass Cannon | Cursed Tome ×5로 1위 | +150 RP |
| Discovery | 히든 시너지 1개 발견 | +100 RP |
| Comeback | Lv3 이하에서 1위 역전 | +200 RP |
| Marathon | 연속 20 라운드 참여 | +100 RP |

---

## 11. 기존 시스템 대비 변경점

### 11.1 서버 변경점

| 파일 | 변경 | 규모 |
|------|------|------|
| `game/Snake.ts` → **`game/AgentEntity.ts`** | **전면 리라이트**: SnakeEntity → AgentEntity, segments 제거, position 단일 좌표, level/xp/build 추가, update() 대폭 단순화 | 대 (재작성) |
| `game/Arena.ts` | snakes Map → agents Map, `processAuraCombat()`, `processLevelUp()`, `processAbilities()` 추가 | 대 (~200줄) |
| `game/CollisionSystem.ts` | **전면 개편**: 세그먼트 기반 충돌 제거 → 원형 히트박스 전투 + 대시 충돌 | 대 (재작성) |
| `game/SpatialHash.ts` | 세그먼트 등록 제거 → 에이전트 위치만 관리 (대폭 단순화) | 중 (~40줄 감소) |
| `game/OrbManager.ts` | XP 값 속성 추가, Shrine/맵 오브젝트 관리 | 중 (~50줄) |
| `game/BotBehaviors.ts` | 봇 레벨업 선택 로직, 수축 인식, snake→agent 참조 변경 | 중 (~80줄) |
| `game/BotManager.ts` | 봇 빌드 프로필 할당, 레벨업 자동 선택 | 소 (~30줄) |
| `game/Room.ts` | 아레나 수축 로직, 리스폰 제한 (1 Life) | 중 (~50줄) |
| `game/StateSerializer.ts` | segments→position 직렬화 변경, 레벨/빌드/시너지 추가 | 중 (~40줄) |
| `game/LeaderboardManager.ts` | snake→agent 참조 변경 | 소 (~10줄) |
| `network/SocketHandler.ts` | `choose_upgrade`, `set_combat_style` 이벤트 | 소 (~30줄) |
| `network/Broadcaster.ts` | `level_up` 이벤트 브로드캐스트 | 소 (~20줄) |
| **NEW** `game/UpgradeSystem.ts` | Tome/Ability 정의, 시너지 체크, 랜덤 선택지 | 대 (~250줄) |
| **NEW** `game/MapObjects.ts` | Shrine/Spring/Altar/Gate 관리 | 중 (~100줄) |
| **NEW** `game/ArenaShrink.ts` | 수축 로직 (타이머, 경계 밖 패널티) | 소 (~60줄) |

### 11.2 공유 패키지 변경점

| 파일 | 변경 |
|------|------|
| `types/game.ts` | **`Snake` → `Agent` 인터페이스 전면 교체**, `SnakeSkin` → `AgentSkin`, `PlayerBuild`, `TomeType`, `AbilityType`, `SynergyDef`, `MapObject` 타입 추가 |
| `types/events.ts` | `level_up`, `choose_upgrade`, `synergy_activated`, `arena_shrink` 이벤트 추가 |
| `constants/game.ts` | `ARENA_CONFIG` 에서 `segmentSpacing`/`headRadius` → `hitboxRadius`로 변경, `UPGRADE_CONFIG`, `SYNERGY_CONFIG`, `SHRINK_CONFIG`, `MAP_OBJECT_CONFIG` 추가 |
| `constants/game.ts` | `DEFAULT_SKINS` → `DEFAULT_AGENT_SKINS` (MC 스타일로 전면 교체) — 현재 24종 SnakeSkin(8필드) → 34종 AgentSkin(30+필드) 완전 재작성. 기존 SnakeSkin 호환 불가. |
| `constants/upgrades.ts` | **NEW** Tome/Ability/시너지 전체 정의 |

### 11.3 클라이언트 변경점

| 컴포넌트 | 변경 |
|---------|------|
| `lib/renderer/entities.ts` | **전면 리라이트**: 뱀 세그먼트 렌더링 → 에이전트 캐릭터 렌더링 (16×16 스프라이트 or 3D) |
| `lib/interpolation.ts` | `interpolateSnakes` → `interpolateAgents` (세그먼트 보간 제거, 위치만) |
| `lib/camera.ts` | snake → agent 참조 변경 (로직은 동일) |
| `components/game/GameCanvas.tsx` | snake 렌더 → agent 렌더 |
| `components/game/LevelUpOverlay.tsx` | **NEW** 3택 업그레이드 선택 UI |
| `components/game/BuildHUD.tsx` | **NEW** 현재 Tome 스택 + Ability 표시 |
| `components/game/XPBar.tsx` | **NEW** 경험치 바 |
| `components/game/ShrinkWarning.tsx` | **NEW** 아레나 수축 경고 |
| `components/game/SynergyPopup.tsx` | **NEW** 시너지 발동 알림 |
| `components/game/RoundResultOverlay.tsx` | 빌드 정보 + 시너지 표시 추가 |
| `lib/renderer/ui.ts` | 수축 경계선, 존 표시, 전투 오라 |
| `hooks/useSocket.ts` | level_up/choose_upgrade/synergy 이벤트 + snake→agent 참조 변경 |
| `components/lobby/*` | "Snake Arena" 텍스트 → "Agent Survivor" |
| `components/lobby/LobbySnakePreview.tsx` → `LobbyAgentPreview.tsx` | 뱀 프리뷰 → MC 에이전트 프리뷰 |

### 11.4 엔티티 변경 요약 (핵심)

**완전 제거 (뱀 전용 코드)**:
- `segments: Position[]` — 세그먼트 배열 및 모든 관련 로직
- `segmentSpacing` — 세그먼트 간격
- `trailCounter` / `trailOrbInterval` — 부스트 시 꼬리 오브 드롭
- `headRadius` → `hitboxRadius` 로 대체
- 머리-몸통 충돌 감지 (세그먼트 기반 SpatialHash 순회)
- 뱀 세그먼트 렌더링 (캔버스 연속 원 그리기)
- 뱀 스킨 패턴 (striped/gradient/dotted 세그먼트 텍스처)

**보존 (변수명만 변경)**:
- 기본 이동 메카닉 (heading, targetAngle, speed, turnRate) — 100% 동일
- 부스트 (boosting, boostSpeed, boostCostPerTick) — "대시"로 리브랜딩
- 오브 수집 물리 (collectRadius) — 100% 동일
- 미니맵 — agent 위치 표시로 변경
- 봇 행동 트리 (survive/hunt/gather/wander) — 확장만

**신규 추가**:
- level, xp, xpToNext, build, activeSynergies — 빌드 시스템
- hitboxRadius — mass 기반 동적 히트박스
- AgentSkin — MC 스타일 커스터마이징
- 오라 전투 + 대시 킬 — 새로운 전투 모델

---

## 12. 구현 우선순위 & 마이그레이션

> ### ⚡ 아키텍처 전환: TypeScript → Go 서버
> **결정**: 서버를 Go로 재작성. TS 프로토타입 코드를 1:1 레퍼런스로 Go 포팅.
> **근거**: 대규모 동시접속 (5,000 CCU), goroutine 기반 per-room parallelism, 기존 Go 서버 운영 경험 (agent_arena/agent_verse).
> **상세 설계**: [`v10-go-server-plan.md`](v10-go-server-plan.md) — Hub 설계, 동시성 모델, 성능 예산, ADR 5건.
>
> ### 📋 TS 프로토타입 현황 (Go 포팅 레퍼런스)
> AgentEntity, UpgradeSystem, ArenaShrink, CollisionSystem, BotBehaviors,
> StateSerializer, SpatialHash, SocketHandler 모두 TypeScript로 검증 완료.
> 이 코드는 Go 포팅 시 **로직/상수/타입의 1:1 레퍼런스**로 활용됨.

---

### 12.0 Phase 0 — Go 서버 코어 인프라 (2주) ⏳ NEW

**목표**: Go 프로젝트 초기화 + WebSocket Hub + HTTP Router + 타입 시스템

> 📐 상세 설계: [`v10-go-server-plan.md`](v10-go-server-plan.md) §3 Directory Structure, §4 Concurrency Model, §6 WS Protocol

| 태스크 | Go 파일 | TS 레퍼런스 | 예상 |
|--------|---------|------------|------|
| Go 프로젝트 초기화 (go.mod, 디렉토리) | `server/` | — | 0.5일 |
| Config + Main + Graceful Shutdown | `cmd/server/main.go`, `config/` | `index.ts` | 0.5일 |
| HTTP Router + Middleware (CORS, Health) | `server/router.go` | `index.ts` | 0.5일 |
| **WebSocket Hub** (channel-based, lock-free) | `ws/hub.go` | Socket.IO 대체 | 1.5일 |
| Client ReadPump + WritePump | `ws/client.go` | — | 1일 |
| WS Protocol (JSON `{e, d}` 프레임) | `ws/protocol.go` | Socket.IO 이벤트 매핑 | 0.5일 |
| Domain Types (Agent, Orb, Position 등) | `domain/types.go` | `types/game.ts` | 1일 |
| Event Types (JSON 태그) | `domain/events.go` | `types/events.ts` | 0.5일 |
| Skin + Upgrade 정의 테이블 | `domain/skins.go`, `domain/upgrades.go` | `constants/` | 0.5일 |
| Game Constants | `game/constants.go` | `constants/game.ts` | 0.5일 |
| Rate Limiter | `ws/client.go` 내장 | `network/RateLimiter.ts` | 0.5일 |
| Dockerfile + Railway 배포 설정 | `server/Dockerfile` | `railway.json` | 0.5일 |

---

### 12.1 Phase 1 — Go 게임 시스템 포팅 (2주) ⏳ NEW

**목표**: 전체 게임 로직을 Go로 포팅 (TS 코드 1:1 레퍼런스)

> 📐 상세 설계: [`v10-go-server-plan.md`](v10-go-server-plan.md) §5 Core Systems Design

| 태스크 | Go 파일 | TS 레퍼런스 | 예상 |
|--------|---------|------------|------|
| **Agent Entity** (물리, 전투, 빌드) | `game/agent.go` | `AgentEntity.ts` ✅ | 1.5일 |
| **SpatialHash** (Grid 기반) | `game/spatial_hash.go` | `SpatialHash.ts` ✅ | 0.5일 |
| **CollisionSystem** (Aura + Dash) | `game/collision.go` | `CollisionSystem.ts` ✅ | 1.5일 |
| **OrbManager** (스폰, 수집, death orb) | `game/orb.go` | `OrbManager.ts` ✅ | 1일 |
| **ArenaShrink** (수축 + 페널티) | `game/shrink.go` | `ArenaShrink.ts` ✅ | 0.5일 |
| **UpgradeSystem** (Tome/Ability/Synergy) | `game/upgrade.go` | `UpgradeSystem.ts` ✅ | 1.5일 |
| **Arena** (20Hz game loop 오케스트레이터) | `game/arena.go` | `Arena.ts` ✅ | 1.5일 |
| **StateSerializer** (뷰포트 컬링) | `game/serializer.go` | `StateSerializer.ts` ✅ | 1일 |
| **Leaderboard** | `game/leaderboard.go` | `LeaderboardManager.ts` ✅ | 0.5일 |

> **TS 레퍼런스 ✅**: 해당 로직이 TypeScript로 검증 완료되어 포팅 시 로직 참조 가능

---

### 12.1a Phase 1-ext — Go Room & Bot System (1주) ⏳ NEW

**목표**: Room 상태 머신 + RoomManager + Bot AI를 Go로 포팅

| 태스크 | Go 파일 | TS 레퍼런스 | 예상 |
|--------|---------|------------|------|
| **Room State Machine** | `game/room.go` | `Room.ts` ✅ | 1일 |
| **RoomManager** (생명주기, Quick Join) | `game/room_manager.go` | `RoomManager.ts` ✅ | 1일 |
| **BotManager + BotBehaviors** | `game/bot.go` | `BotManager.ts` + `BotBehaviors.ts` ✅ | 1.5일 |
| Lobby Broadcasting (1Hz rooms_update) | `game/room_manager.go` | `Broadcaster.ts` ✅ | 0.5일 |
| **로컬 통합 테스트** (Go 서버 + 기존 클라이언트) | — | — | 1일 |

#### 12.1a 1 Life 모드 봇 리스폰 정책

| 엔티티 | 리스폰 정책 | 이유 |
|--------|-----------|------|
| 인간 플레이어 | 1 Life (30초 Grace Period 내 1회만) | 서바이벌 긴장감 |
| AI 봇 | 사망 후 **새 봇으로 교체** (동일 이름, 새 빌드) | 플레이어 수 유지, 전투 밀도 보장 |
| 외부 에이전트 | 1 Life (인간과 동일) | 공정한 경쟁 |

> 봇은 "리스폰"이 아닌 "교체"로 처리. 사망한 봇의 XP/빌드는 리셋되어 약한 상태로 재등장 → 후반 플레이어에게 파밍 기회 제공.

### 12.2 Phase 2 — Abilities + Synergies + 밸런스 (1주)

**목표**: Go 서버에서 Ability/Synergy 검증 + 맵 오브젝트 + 밸런스 튜닝

> ✅ Ability/Synergy 로직은 TS 프로토타입에서 검증됨 (Phase 1 Go 포팅에 포함).
> 이 Phase는 Go 서버 위에서 **통합 테스트 + 밸런스 + 맵 오브젝트 추가** 집중.

| 태스크 | 파일 | 예상 |
|--------|------|------|
| 맵 오브젝트 (Shrine/Spring/Altar/Gate) | `game/map_objects.go` | 1.5일 |
| Tome vs Ability 의사결정 로직 (§12.2a) | `game/upgrade.go` | 0.5일 |
| Go 서버 밸런스 1차 튜닝 + 봇 전략 테스트 | — | 1.5일 |
| Go 서버 부하 테스트 (100+ 봇 동시접속) | — | 0.5일 |
| **game.sh 업데이트** (Go 빌드+실행) | `game.sh` | 0.5일 |
| Railway Go 서버 배포 + 헬스체크 | `server/Dockerfile` | 0.5일 |

#### 12.2a Tome 스택 vs 새 Ability 획득 의사결정

에이전트(봇 포함)의 레벨업 핵심 트레이드오프:

```
if (currentAbilitySlots < maxSlots && 선택지에 새Ability):
  synergyScore = 시너지 기여도 계산
  tomeValue = 최고 Tome의 (현재스택+1) × 효과
  if synergyScore > tomeValue × 1.5:
    → 새 Ability (시너지 완성이 Tome보다 가치 높음)
  else:
    → Tome 스택 (확실한 스탯 증가)
else:
  → Tome 스택 또는 기존 Ability 강화
```

### 12.3 Phase 3 — Client 통합 + Rendering + Lobby Redesign (3.5주)

**목표**: WebSocket 어댑터 + Agent 캐릭터 렌더링 + 레벨업 UI + 로비 전체 재설계

> ⚠️ **NOTE**: Socket.IO→native WebSocket 전환 + 렌더러 764줄 전면 재작성 + 로비 10개 항목 재설계 포함.
> 📐 WS 어댑터 설계: [`v10-go-server-plan.md`](v10-go-server-plan.md) §7 Client Adaptation

| 태스크 | 컴포넌트 | 예상 |
|--------|---------|------|
| **🔗 WebSocket 어댑터** (Socket.IO → native WS) | NEW `hooks/useWebSocket.ts` (~80줄) | 0.5일 |
| **🔗 useSocket.ts 수정** (어댑터 연동) | `hooks/useSocket.ts` | 0.5일 |
| **🔗 socket.io-client 제거** + 통합 테스트 | `package.json` + 전체 연동 확인 | 0.5일 |
| **Agent 캐릭터 렌더링** (2D 16×16 스프라이트) | renderer/entities.ts 전면 리라이트 (764줄) | 2일 |
| **AgentSkin 30종 스프라이트** 제작 | MC 스타일 2D 캐릭터 에셋 (12 Common + 18 해금) | 1.5일 |
| **interpolateAgents** (세그먼트→위치 보간) | lib/interpolation.ts | 0.5일 |
| **캐릭터 커스터마이저 UI** (§12.3a 참조) | NEW CharacterCreator.tsx | 1.5일 |
| LevelUpOverlay (3택 카드) | NEW | 1일 |
| BuildHUD + XPBar | NEW ×2 | 1일 |
| ShrinkWarning + SynergyPopup | NEW ×2 | 0.5일 |
| RoundResult 확장 (빌드+시너지+AI분석) | 기존 수정 | 0.5일 |
| 오라/이펙트 시각화 + 맵 오브젝트 | renderer/entities.ts + ui.ts | 1일 |
| **로비 전체 재설계** (§12.3b 참조) | lobby 컴포넌트 10개+ | 3.5일 |

#### 12.3a 캐릭터 커스터마이저 UI

기존 SkinGrid (28×28 캔버스, 4×2 그리드, 24종 페이지네이션) → 탭 기반 캐릭터 크리에이터:

```
┌───────────────────────────────────────────────────┐
│  캐릭터 커스터마이징                    [프리셋 ▾]  │
├───────────┬───────────────────────────────────────┤
│           │  [체형] [색상] [얼굴] [장비] [이펙트]  │
│  ┌─────┐  │  ─────────────────────────────────     │
│  │Agent│  │  모자: [none][helmet][crown][wizard]... │
│  │ 3D  │  │  등:   [none][cape_red][wings]...      │
│  │Preview│ │  의상: [none][knight][ninja]...        │
│  │130×130│ │  악세: [none][scarf][goggles]...      │
│  └─────┘  │  손:   [none][sword][torch]...         │
│  [◀ 회전 ▶]│  신발: [none][boots_iron]...           │
├───────────┴───────────────────────────────────────┤
│  희귀도: ⬜ Common — 12/30 해금               [저장] │
└───────────────────────────────────────────────────┘
```

- 왼쪽: LobbyAgentPreview (기존 LobbySnakePreview R3F 기반, Y축 회전)
- 오른쪽: 탭별 옵션 그리드 (Phase 1: 체형+색상+얼굴+장비 4탭)
- 하단: 해금 진행도 + 저장 버튼

#### 12.3b 로비 전체 재설계 상세 (CRIT-01 해결)

| 항목 | 현재 | v10 변경 | 예상 |
|------|------|---------|------|
| **LobbyIdleSnakes→LobbyIdleAgents** | 3마리 아이들 뱀 3D | 3 MC 에이전트 아이들 모션 | 0.5일 |
| **LobbySnakePreview→LobbyAgentPreview** | R3F 뱀 회전+표정 | R3F MC 캐릭터 회전+장비 표시 | 0.5일 |
| **SkinGrid→CharacterCreator** | 24종 색상 스와치 | 탭 기반 크리에이터 (§12.3a) | 1일 |
| **RoomList 테마** | MC 서버리스트 스타일 | 에이전트 아이콘 + 빌드 표시 추가 | 0.3일 |
| **RecentWinnersPanel** | 이름+점수 | +승리 빌드 아이콘 + 시너지 배지 | 0.3일 |
| **로고** | "CROSNAKE" SVG | "Agent Survivor" MC 스타일 SVG | 0.2일 |
| **Welcome 튜토리얼** | 없음 | 첫 방문 시 3단계 가이드 모달 | 0.3일 |
| **에이전트 성격 선택** | 없음 | 로비에서 봇 성격 프리셋 선택 UI | 0.2일 |
| **텍스트 리브랜딩** | "뱀"/"Snake Arena" | "에이전트"/"Agent Survivor" 전체 교체 | 0.2일 |
| 합계 | | | **3.5일** |

### 12.4 Phase 4 — Agent Integration + Training UI (1.5주)

**목표**: v9 Agent API + v10 업그레이드 + Training Console 클라이언트

| 태스크 | 파일 (Go 서버) | 예상 |
|--------|---------------|------|
| 에이전트 level_up 이벤트 + choose_upgrade 명령 | `ws/protocol.go` + `game/arena.go` | 1일 |
| Commander Mode 확장 (전투 스타일, 존 이동) | `game/agent_api.go` (NEW) | 1일 |
| **v9→v10 Commander Mode 마이그레이션** (§12.4a) | `game/agent_api.go` + docs | 0.5일 |
| 빌드 패스 시스템 | `game/build_path.go` (NEW) | 1일 |
| 에이전트 훈련 API (PUT /training) | `server/router.go` + `game/training.go` (NEW) | 1일 |
| 에이전트 메모리/학습 데이터 저장 | JSON 파일 | 0.5일 |
| **Training Console UI** (§12.4b 참조) | NEW `TrainingConsole.tsx` (클라이언트) | 1.5일 |
| observe_game 응답 확장 (§12.4c) | `game/agent_api.go` | 0.5일 |

#### 12.4a v9→v10 Commander Mode 마이그레이션 가이드 (AGENT-HIGH-01 해결)

| v9 명령 | v10 상태 | 마이그레이션 |
|---------|---------|-------------|
| `go_to {x,y}` | ✅ 유지 | 변경 없음 |
| `go_center` | ✅ 유지 | 변경 없음 |
| `flee` | ✅ 유지 | 변경 없음 |
| `hunt {targetId}` | ✅ 유지 | 변경 없음 |
| `hunt_nearest` | ✅ 유지 | 변경 없음 |
| `gather` | ✅ 유지 | 변경 없음 |
| `set_boost` | ✅ 유지 | "대시"로 리브랜딩만 |
| `ambush` | ❌ **삭제** | 세그먼트 길막 불가 → `kite` 또는 `camp_shrinkage`로 대체 |
| `gather_near {x,y}` | ❌ **삭제** | `farm_orbs {zone}` 으로 대체 (좌표→존 기반) |
| `gather_powerup` | ❌ **삭제** | 파워업 오브 제거 → Ability 자동 획득. `choose_upgrade`로 대체 |
| `set_mode` | ⚠️ **변경** | `set_combat_style` 로 대체. farming→balanced, aggressive→aggressive |

**v10 신규 명령**: `engage_weak`, `avoid_strong`, `farm_orbs`, `kite`, `camp_shrinkage`, `priority_target`, `set_combat_style`, `choose_upgrade`, `set_ability_priority`

#### 12.4b Training Console UI 컴포넌트 설계 (CRIT-02 해결)

로비 RoomList 아래에 **접이식 패널**로 배치:

```
TrainingConsole.tsx (접이식 McPanel)
├── TrainingHeader — 에이전트 상태 (온라인/승률/평균레벨)
├── BuildProfileEditor — 빌드 패스 선택 + 금지/필수 업그레이드
├── CombatRulesEditor — if/then 규칙 리스트 + 추가/삭제
├── StrategyPhaseEditor — early/mid/late 전략 드롭다운
└── LearningLog — 최근 10라운드 결과 테이블
```

- WebSocket `training_update` 이벤트로 실시간 반영
- McPanel 스타일 (기존 디자인 시스템 재사용)
- 모바일: 전체 화면 모달로 전환

#### 12.4c observe_game 확장 응답 (AGENT-MED-01 해결)

```typescript
// v10 확장 필드 (기존 v9 응답에 추가)
interface ObserveGameV10Extension {
  level: number;
  xp: number;
  xpToNext: number;
  build: {
    tomes: Record<TomeType, number>;
    abilities: AbilitySlot[];
    activeSynergies: string[];
  };
  arenaRadius: number;
  zone: 'center' | 'mid' | 'edge' | 'danger';
  nearbyThreats: { id: string; mass: number; distance: number; buildType: string }[];
  nearbyMapObjects: { type: string; x: number; y: number; distance: number }[];
}
```

### 12.5 Phase 5 — Meta + Coach/Analyst + Polish (1.5주)

**목표**: RP 시스템, 퀘스트, 코치/분석가 에이전트, 밸런스

| 태스크 | 예상 |
|--------|------|
| RP 시스템 + 잠금 해제 | 1일 |
| 퀘스트 시스템 (8종) | 1일 |
| 글로벌 리더보드 확장 (빌드 승률, 시너지 발견) | 1일 |
| 에이전트 성격 프리셋 (6종) | 0.5일 |
| **Coach Agent** — 실시간 조언 채팅 오버레이 (§12.5a) | 1.5일 |
| **Analyst Agent** — 라운드 결과 AI 분석 패널 (§12.5b) | 1일 |
| 밸런스 튜닝 + 통합 테스트 | 1일 |

#### 12.5a Coach Agent (NEW)

인간 플레이어에게 실시간 AI 코칭:
- `coach_message` socket 이벤트로 전달
- 게임 화면 하단에 작은 채팅 버블 UI
- 트리거: 위험 접근(⚠️), 레벨업 추천(💡), 전략 전환(🔄), 킬 기회(🎯)
- Commander Mode의 `observe_game` 응답을 읽고 조언 생성
- 0.5~1Hz 빈도 (채팅 스팸 방지)

#### 12.5b Analyst Agent (NEW)

라운드 종료 후 AI 전략 분석:
- RoundResult 화면에 "🤖 AI 분석" 확장 패널
- `RoundSummary` 데이터 기반 빌드/전투/포지셔닝 분석
- 개선 제안 3개 출력 (ex: "시너지 1개 부족했음", "2분 이후 중앙 이동 추천")
- LLM 호출 1회 (라운드 종료 시점, 비실시간)

### 12.6 총 일정 (Go 서버 전환 반영, v3)

```
Phase 0: Go 서버 코어 인프라 ──────── 2주 ──▷ ⏳ 다음 단계 (Hub, WS, Types, Config)
Phase 1: Go 게임 시스템 포팅 ──────── 2주 ──▷ ⏳ (Agent, Collision, Orb, Upgrade, Arena)
Phase 1a: Go Room/Bot + 통합 테스트 ── 1주 ──▷ ⏳ (Room, RoomManager, Bot AI)
Phase 2: Abilities + 밸런스 + 배포 ─── 1주 ──▷ ⏳ (MapObjects, 밸런스, Railway 배포)
Phase 3: Client 통합 + 렌더링 ──────── 3.5주 ▷ ⏳ (WS 어댑터 + MC 렌더러 + 로비)
Phase 4: Agent Integration + UI ──── 1.5주 ▷ ⏳ (Agent API, Training Console)
Phase 5: Meta + AI Agents + Polish ── 1.5주 ▷ ⏳ (Coach, Analyst, 메타)

총: ~13주 (Go 서버 5주 + 클라이언트 6주 + Agent/Meta 3주)
병렬화: Phase 2~3 일부 병렬 가능 → 실질 ~11주
```

**상세 일정**:
| Phase | 기간 | 상태 | 핵심 산출물 |
|-------|------|:---:|------------|
| **Phase 0** | 2주 | ⏳ | Go 프로젝트, Hub, WS Protocol, Domain Types |
| **Phase 1** | 2주 | ⏳ | 9개 게임 시스템 Go 포팅 (TS 레퍼런스 활용) |
| **Phase 1a** | 1주 | ⏳ | Room/Bot + 로컬 통합 테스트 통과 |
| **Phase 2** | 1주 | ⏳ | 맵 오브젝트 + 밸런스 + Railway Go 배포 |
| **Phase 3** | 3.5주 | ⏳ | WS 어댑터 + MC 렌더러 + 로비 재설계 |
| **Phase 4** | 1.5주 | ⏳ | Agent API + Training Console |
| **Phase 5** | 1.5주 | ⏳ | Coach/Analyst + RP/퀘스트 + 최종 밸런스 |
| **합계** | **~13주** | | **병렬화 시 ~11주** |

**타임라인 변경 근거** (v1 → v2 → v3):
| 항목 | v1 | v2 | v3 (Go 전환) | 이유 |
|------|-----|-----|-------------|------|
| 서버 인프라 | — | — | **5주 (Phase 0-1a)** | Go 재작성 (TS 레퍼런스로 포팅 가속) |
| 밸런스+배포 | 1주 | 2주 | **1주** | Go 서버 위 밸런스 + Railway 배포 |
| 클라이언트 | 1.5주 | 3주 | **3.5주** | WS 어댑터 추가 (+0.5주) |
| Agent API | 1주 | 1.5주 | **1.5주** | 변경 없음 |
| Meta/Polish | 1주 | 1.5주 | **1.5주** | 변경 없음 |

> **TS 프로토타입 처분**: Go 서버 Phase 2 완료 + 통합 테스트 통과 후 `apps/server/` 폴더 제거.
> 그 전까지는 로직 레퍼런스로 유지.

---

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->
<!-- 상세 SNN 스텝: docs/designs/v10-development-roadmap.md (S01~S59) -->
<!-- 각 Phase의 세부 태스크 설명은 §12 참조 -->

> **모드**: roadmap (별도 로드맵 파일 참조)
> **로드맵 파일**: [`docs/designs/v10-development-roadmap.md`](v10-development-roadmap.md)
> **총 일정**: ~13주 (병렬화 시 ~11주)
> **Phase 수**: 7개 (Phase 0 ~ Phase 5)
> **Step 수**: S01 ~ S59

### Phase 0: Go 서버 코어 인프라

| Task | 설명 |
|------|------|
| Go 프로젝트 초기화 | go.mod, 디렉토리 구조, Config, Main, Graceful Shutdown |
| HTTP Router + Middleware | chi/v5 라우터, CORS, Health 엔드포인트 |
| WebSocket Hub | channel-based, lock-free Hub + Client ReadPump/WritePump |
| WS Protocol | JSON `{e, d}` 프레임, Socket.IO 이벤트 1:1 매핑 |
| Domain Types + Constants | Agent, Orb, Position, Event 타입 + 게임 상수 |
| Rate Limiter + Dockerfile | 입력 제한 + Railway 배포 설정 |

- **design**: N (서버 인프라 중심)
- **verify**: `go build ./...` 성공, WebSocket echo 테스트 통과, Health 엔드포인트 200 응답
- **ref**: `v10-go-server-plan.md` §3-4, §6
- **blocked_by**: none
- **예상**: 2주

### Phase 1: Go 게임 시스템 포팅

| Task | 설명 |
|------|------|
| Agent Entity | 물리, 전투, 빌드 — TS `AgentEntity.ts` 1:1 포팅 |
| SpatialHash | Grid 기반 공간 해시 |
| CollisionSystem | Aura DPS + Dash 충돌 |
| OrbManager | 스폰, 수집, death orb |
| ArenaShrink | 수축 타이머 + 경계 밖 패널티 |
| UpgradeSystem | Tome/Ability/Synergy 정의 + 레벨업 로직 |
| Arena | 20Hz game loop 오케스트레이터 |
| StateSerializer | 뷰포트 컬링 + 직렬화 |
| Leaderboard | 정렬 + 캐싱 |

- **design**: N (서버 로직 포팅)
- **verify**: 각 시스템 유닛 테스트 통과, Arena 20Hz 루프 < 2ms/tick, TS 레퍼런스 대비 로직 동일성 확인
- **ref**: `v10-go-server-plan.md` §5, TS 프로토타입 (`apps/server/src/game/`)
- **blocked_by**: Phase 0
- **예상**: 2주

### Phase 1a: Go Room & Bot System

| Task | 설명 |
|------|------|
| Room State Machine | waiting→countdown→playing→ending→cooldown 상태 전이 |
| RoomManager | 5개 Room 생명주기, Quick Join, 플레이어-룸 매핑 |
| BotManager + BotBehaviors | 봇 생성, 자동조종, 빌드 패스, 1 Life 교체 정책 |
| Lobby Broadcasting | 1Hz rooms_update 브로드캐스트 |
| 로컬 통합 테스트 | Go 서버 + 기존 클라이언트 연동 확인 |

- **design**: N (서버 로직)
- **verify**: Room 상태 전이 테스트, 봇 15마리 룸 참여 확인, 기존 클라이언트(Socket.IO) 임시 어댑터 연결 통과
- **ref**: TS 프로토타입 (`Room.ts`, `RoomManager.ts`, `BotManager.ts`)
- **blocked_by**: Phase 1
- **예상**: 1주

### Phase 2: Abilities + 밸런스 + 배포

| Task | 설명 |
|------|------|
| 맵 오브젝트 | XP Shrine, Healing Spring, Upgrade Altar, Speed Gate |
| Tome vs Ability 의사결정 로직 | 봇 레벨업 시 시너지/빌드패스 기반 선택 알고리즘 |
| 밸런스 1차 튜닝 | 100+ 봇 시뮬레이션, DPS/HP/XP 커브 조정 |
| Railway Go 서버 배포 | Dockerfile + 헬스체크 + CORS 설정 |

- **design**: N (로직 + 배포)
- **verify**: 맵 오브젝트 스폰/리스폰 확인, 100봇 5분 라운드 완주, Railway 배포 성공 + 헬스체크 200
- **ref**: `v10-survival-roguelike-plan.md` §9, §12.2a
- **blocked_by**: Phase 1a
- **예상**: 1주

### Phase 3: Client 통합 + Rendering + Lobby

| Task | 설명 |
|------|------|
| WebSocket 어댑터 | Socket.IO → native WebSocket 전환 (useWebSocket.ts) |
| useSocket.ts 수정 | 어댑터 연동 + snake→agent 리네이밍 |
| Agent 캐릭터 렌더링 | 2D 16×16 MC 스프라이트 렌더러 전면 리라이트 (764줄) |
| AgentSkin 스프라이트 제작 | 12 Common + 18 해금 = 30종 MC 캐릭터 에셋 |
| interpolateAgents | 세그먼트→위치 보간 전환 |
| 캐릭터 커스터마이저 UI | 탭 기반 CharacterCreator (체형/색상/얼굴/장비) |
| 인게임 UI 컴포넌트 | LevelUpOverlay, BuildHUD, XPBar, ShrinkWarning, SynergyPopup |
| RoundResult 확장 | 빌드+시너지+AI분석 표시 |
| 오라/이펙트/맵 오브젝트 | 전투 오라, 빌드 비주얼, MC 블록 구조물 렌더링 |
| 로비 전체 재설계 | 10개 항목 — 에이전트 프리뷰, 크리에이터, 리브랜딩 |

- **design**: Y (캐릭터 렌더링 + 인게임 HUD + 로비 UI 전면 재설계)
- **verify**: WS 연결 + 게임 상태 수신 확인, MC 캐릭터 렌더링 정상, 레벨업 UI 동작, 로비→게임 전환 정상, 모바일 반응형 확인
- **ref**: `v10-3d-graphics-plan.md` Part A, `v10-ui-ux-plan.md` §3-7, `v10-survival-roguelike-plan.md` §5B, §12.3
- **blocked_by**: Phase 2
- **예상**: 3.5주

### Phase 4: Agent Integration + Training UI

| Task | 설명 |
|------|------|
| Agent level_up + choose_upgrade | 에이전트 레벨업 이벤트 프로토콜 구현 |
| Commander Mode 확장 | v9→v10 마이그레이션, 전투 스타일/존 이동 명령 |
| 빌드 패스 시스템 | 5종 프리셋 빌드 패스 + 선택 알고리즘 |
| 에이전트 훈련 API | PUT /training, 빌드 프로필, 규칙 편집 |
| 메모리/학습 데이터 저장 | 에이전트별 JSON 파일 기반 |
| Training Console UI | 접이식 패널 — BuildProfileEditor, CombatRulesEditor 등 |
| observe_game 확장 | v10 필드 추가 (build, zone, nearbyThreats, mapObjects) |

- **design**: Y (Training Console UI)
- **verify**: 에이전트 WebSocket 접속 + level_up/choose_upgrade 정상, Training Console CRUD, observe_game v10 필드 확인
- **ref**: `v10-survival-roguelike-plan.md` §6-7, §12.4
- **blocked_by**: Phase 3
- **예상**: 1.5주

### Phase 5: Meta + Coach/Analyst + Polish

| Task | 설명 |
|------|------|
| RP 시스템 + 잠금 해제 | Reputation Points 누적 + 3번째 Ability 슬롯 등 해금 |
| 퀘스트 시스템 (8종) | 도전 과제 + RP 보상 |
| 글로벌 리더보드 확장 | 빌드 승률, 시너지 발견, 에이전트 순위 |
| 에이전트 성격 프리셋 (6종) | Aggro/Cautious/Scholar/Gambler/Balanced/Adaptive |
| Coach Agent | 실시간 AI 코칭 채팅 버블 (0.5~1Hz) |
| Analyst Agent | 라운드 종료 후 AI 전략 분석 패널 |
| 최종 밸런스 + 통합 테스트 | 전체 시스템 E2E, 멀티플레이어 QA |

- **design**: Y (Coach/Analyst UI)
- **verify**: RP 누적/해금 동작, 퀘스트 완료 보상 지급, Coach 메시지 수신, Analyst 분석 표시, 5분 풀 라운드 E2E 통과
- **ref**: `v10-survival-roguelike-plan.md` §10, §12.5
- **blocked_by**: Phase 4
- **예상**: 1.5주

---

## 13. Open Questions & Risks

### 13.1 Open Questions

| # | 질문 | 옵션 | 추천 |
|---|------|------|------|
| Q1 | 오라 전투를 기존 충돌 킬과 공존? | A: 공존 (둘 다), B: 오라만 | A: 공존 (다양한 킬 방식 유지) |
| Q2 | 레벨업 시 게임 일시정지? | A: 개인만 정지, B: 실시간 유지 | B: 실시간 (5초 자동선택) |
| Q3 | 1 Life vs 제한적 리스폰? | A: 1 Life, B: 3 Life, C: 기존 유지 | A: 1 Life (서바이벌 긴장감) |
| Q4 | Ability 슬롯 기본값? | A: 2슬롯 (RP로 +1), B: 3슬롯 (고정) | ✅ **확정: A** — 기본 2슬롯, RP 50으로 3번째 해금 |
| Q5 | 히든 시너지 발견 시 공개? | A: 발견자만 사용, B: 전체 공개 | B: 48시간 독점 후 공개 |
| Q6 | 인간 플레이어의 레벨업 UI 스타일? | A: 팝업 카드, B: 사이드 패널 | A: 팝업 카드 (Megabonk 스타일) |

### 13.2 Risks & Mitigation

| 리스크 | 영향 | 확률 | 완화 |
|--------|------|------|------|
| **밸런스 붕괴** | 특정 빌드가 압도적 | 높음 | 1주 밸런스 패치 + 에이전트 메타 데이터 분석 |
| **복잡도 증가** | 신규 유저 혼란 | 중 | 첫 3 라운드 가이드 + 기본 빌드 추천 |
| **오라 전투 렉** | 밀집 시 CPU 폭증 | 중 | SpatialHash 기반 + 최대 5대상 DPS 제한 |
| **에이전트 5초 타임아웃** | LLM 느린 응답 | 중 | Commander Mode 자동 선택 폴백 |
| **1 Life 스트레스** | 초보자 이탈 | 중 | Grace period + "관전 모드" 제공 |
| **수축 불공정** | 가장자리 시작 불리 | 낮음 | 스폰 위치를 mid zone으로 제한 |

### 13.3 "내가 생각못한 것" — Creative Additions

위 본문에 자연스럽게 포함된 창의적 추가 요소들:

1. **Kill Streak 보너스** (§3.1): 연속 킬 시 XP 배율 증가 → 공격적 플레이 보상
2. **Cursed Tome 리스크/리워드** (§4.1): Megabonk Holy Trinity의 핵심을 재현
3. **Ability 자동 발동** (§4.2): 캐릭터 조종만, 스킬은 자동 → 모바일 친화
4. **히든 시너지 탐색** (§4.3): 에이전트가 실험을 통해 발견 → 탐색 콘텐츠
5. **아레나 수축** (§8.1): 배틀로얄 스타일 강제 교전 → 캠핑 방지
6. **맵 오브젝트** (§9): Shrine/Altar/Spring → 전략적 포지셔닝 추가
7. **존 시스템** (§9.2): 안전/위험 구역 → 에이전트 의사결정 깊이
8. **에이전트 성격** (§7.3): 프리셋으로 빠른 시작 + Adaptive 자동 학습
9. **Show & Learn 훈련** (§7.1): 사용자 플레이 관찰 → 에이전트 학습
10. **A/B 테스트 모드** (§7.1): 빌드 프로필 비교 실험
11. **RP 메타 프로그레션** (§10): 장기 목표 + 잠금 해제 동기 부여
12. **퀘스트 시스템** (§10.4): 도전 과제 + RP 보상
13. **상대 분석 메모리** (§7.2): 에이전트가 자주 만나는 상대의 빌드 패턴 기억
14. **라운드 결과에 빌드 공개** (§8.5): 다른 플레이어/에이전트의 빌드 학습 기회
15. **Grace Period** (§8.4): 초반 30초 1회 리스폰 → 즉사 방지

---

## 부록 A: v9 Agent API 와의 통합 관계

```
v9 Agent API Platform (에이전트 인프라):
  - 에이전트 등록/인증 (API key)
  - Direct Mode / Commander Mode
  - Socket.IO 프로토콜
  - skill.md 자율 가입

v10 Agent Survivor (게임 시스템):
  - MC 스타일 에이전트 캐릭터
  - 자동전투 + 레벨업
  - Tome/Ability/시너지
  - 에이전트 빌드 전략
  - 훈련 시스템

v9 + v10 = Agent Survivor 완전체:
  AI 에이전트가 v9 인프라로 접속 → v10 게임에서 MC 캐릭터로 전략적 플레이
```

**구현 순서**: v10 Phase 1~3 (게임 시스템 + 엔티티 리모델) → v9 (에이전트 인프라) → v10 Phase 4~5 (에이전트 통합)

---

## 부록 B: Megabonk → Agent Survivor 매핑 테이블

| Megabonk | Agent Survivor v10 | 변환 이유 |
|----------|-------------------|----------|
| 3D 캐릭터 | **MC 스타일 에이전트** | Minecraft 아트 통일, AI "에이전트" 이중 의미 |
| XP 크리스탈 | 오브(XP 값 추가) | 기존 오브 재사용 |
| Tome (패시브) | Tome (8종) | 직접 차용, 에이전트 빌드 시스템 |
| Weapon (29종) | Ability (6종) | 자동전투에 맞게 단순화 |
| 4무기+4Tome 슬롯 | 3 Ability+무제한 Tome | Ability 슬롯 제한으로 희소성 |
| 10분 런 | 5분 라운드 | 멀티플레이어 짧은 사이클 |
| 난이도 곡선 | 아레나 수축 | 시간 압박 메카닉 동일 |
| Holy Trinity | 6 공개 + 4 히든 시너지 | 메타 전략 층 추가 |
| 캐릭터 패시브 | 에이전트 성격 프리셋 | AI 에이전트 = 게임 캐릭터 |
| Silver 메타 통화 | Reputation Points | 장기 진행 동기 |
| 240 퀘스트 | 8종 퀘스트 (확장 가능) | MVP 규모 조정 |
| Shrine | XP Shrine, Healing Spring | 맵 인터랙션 |
| AFK 모드 | Commander Mode (AI 에이전트) | AI가 대신 플레이 |

---

## 부록 C: 리브랜딩 체크리스트 (Snake → Agent)

### 코드 리네이밍

| 기존 | 변경 | 위치 |
|------|------|------|
| `Snake` (interface) | `Agent` | `packages/shared/src/types/game.ts` |
| `SnakeSkin` (interface) | `AgentSkin` | `packages/shared/src/types/game.ts` |
| `SnakeEntity` (class) | `AgentEntity` | `apps/server/src/game/Snake.ts` → `AgentEntity.ts` |
| `snakes` (Map) | `agents` | `Arena.ts`, `Room.ts`, `StateSerializer.ts` |
| `getSnakeById` | `getAgentById` | `Arena.ts` |
| `getSnakeMass` | `getAgentMass` | `Arena.ts` |
| `getSnakeName` | `getAgentName` | `Arena.ts` |
| `getNearbySnakes` | `getNearbyAgents` | `Arena.ts` |
| `findNearbySnakeHead` | `findNearbyAgent` | `Arena.ts` |
| `interpolateSnakes` | `interpolateAgents` | `lib/interpolation.ts` |
| `DEFAULT_SKINS` | `DEFAULT_AGENT_SKINS` | `constants/game.ts` |
| `LobbySnakePreview` | `LobbyAgentPreview` | `components/lobby/` |
| Socket event `snakes` | `agents` | 프로토콜 전체 |

### UI/텍스트 리브랜딩

| 기존 | 변경 |
|------|------|
| "Snake Arena" | "Agent Survivor" |
| "뱀" / "snake" (UI 텍스트) | "에이전트" / "agent" |
| 뱀 아이콘/로고 | MC 스타일 에이전트 아이콘 |
| 스킨 선택: "뱀 스킨" | "캐릭터 커스터마이징" |
| 리더보드: "가장 큰 뱀" | "최강 에이전트" |
| 사망 메시지: "에게 잡아먹혔습니다" | "에게 처치당했습니다" |

### 레포지토리 (향후)

| 항목 | 현재 | 향후 |
|------|------|------|
| Repo name | `snake` | `agent-survivor` (선택적) |
| Package name | `@snake/shared` | 유지 가능 (내부용) |
| Vercel URL | `snake-tonexus.vercel.app` | 커스텀 도메인 추천 |
