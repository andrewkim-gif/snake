# Agent Survivor v10 — System Architecture Document

> **Version**: v1.0
> **Date**: 2026-03-06
> **Status**: Proposed
> **Parent**: [v10-survival-roguelike-plan.md](v10-survival-roguelike-plan.md) (전체 기획서)
> **Related**: [v10-go-server-plan.md](v10-go-server-plan.md) | [v10-3d-graphics-plan.md](v10-3d-graphics-plan.md) | [v10-ui-ux-plan.md](v10-ui-ux-plan.md) | [v10-development-roadmap.md](v10-development-roadmap.md)
> **Architect**: System Architect + Backend Architect + Frontend Architect

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-Goals](#2-goals--non-goals)
3. [System Context — C4 Level 1](#3-system-context--c4-level-1)
4. [Container Diagram — C4 Level 2](#4-container-diagram--c4-level-2)
5. [Component Design — C4 Level 3](#5-component-design--c4-level-3)
6. [Data Flow & Sequence Diagrams](#6-data-flow--sequence-diagrams)
7. [API & Protocol Specification](#7-api--protocol-specification)
8. [Data Model](#8-data-model)
9. [Security Architecture](#9-security-architecture)
10. [Scalability & Performance](#10-scalability--performance)
11. [Reliability & Observability](#11-reliability--observability)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Architecture Decision Records](#13-architecture-decision-records)
14. [Open Questions](#14-open-questions)

---

## 1. Overview

Agent Survivor는 **멀티플레이어 자동전투 서바이벌 로그라이크** 게임이다.
마인크래프트 스타일 복셀 에이전트가 아레나에서 자동으로 전투하며, XP를 수집해 레벨업하고,
Tome/Ability 업그레이드를 선택해 시너지 빌드를 완성하는 5분 라운드 배틀로얄이다.

**"Agent"의 이중 의미**: (1) 게임 캐릭터 — MC 스타일 복셀 에이전트, (2) AI 에이전트 — LLM이 조종하는 자율 플레이어.

### 1.1 핵심 아키텍처 특성

| 특성 | 설계 방향 | 근거 |
|------|----------|------|
| **Real-time** | 20Hz 서버 틱, 60fps 클라이언트 보간 | .io 게임 표준, 부드러운 전투 피드백 |
| **Stateful** | 인메모리 게임 상태 (DB 없음) | 게임 서버 특성, 초저지연 필수 |
| **Multi-room** | Room당 독립 goroutine, 최대 50 Room | 격리된 게임 루프, true parallelism |
| **Event-driven** | WebSocket JSON 프레임 {e, d} | 양방향 실시간 통신 |
| **Monolithic** | 단일 Go 바이너리 (마이크로서비스 X) | 게임 서버 복잡성 ≠ 비즈니스 도메인 복잡성 |

### 1.2 기술 스택 요약

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Survivor v10                      │
├──────────────────────┬──────────────────────────────────┤
│  Server (Go 1.24)    │  Client (Next.js 15 + R3F)       │
│  ┌────────────────┐  │  ┌──────────────────────────┐    │
│  │ gorilla/websocket│  │  │ React 19 + TypeScript     │    │
│  │ chi/v5 router    │  │  │ Three.js + React Three    │    │
│  │ encoding/json    │  │  │ Fiber (R3F) 9.5           │    │
│  │ log/slog         │  │  │ Native WebSocket          │    │
│  └────────────────┘  │  └──────────────────────────┘    │
├──────────────────────┴──────────────────────────────────┤
│  Deploy: Railway (Go) + Vercel (Next.js)                 │
│  Monorepo: server/ (Go) + apps/web/ (Next.js)           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Goals / Non-Goals

### 2.1 Goals

| # | Goal | 측정 기준 |
|---|------|----------|
| G1 | **대규모 동시접속**: 50 Room × 100명 = 5,000 CCU/인스턴스 | 부하 테스트 통과 |
| G2 | **안정적 20Hz 틱**: Room당 < 2ms 틱 처리 | P99 < 5ms |
| G3 | **기존 게임 로직 100% 포팅**: TS 프로토타입 → Go | 모든 시스템 테스트 통과 |
| G4 | **최소 클라이언트 변경**: Socket.IO → WebSocket 어댑터 교체만 | useSocket.ts 1개 파일 |
| G5 | **MC 통합 비주얼**: 로비 + 인게임 아트 디렉션 통일 | MC 복셀 스타일 일관성 |
| G6 | **AI Agent 플랫폼**: LLM 에이전트가 전략적으로 플레이 가능 | Agent API 연동 테스트 |
| G7 | **Railway 단일 인스턴스 배포**: Docker 단일 바이너리 | 배포 성공, health 200 |

### 2.2 Non-Goals

| # | Non-Goal | 근거 |
|---|----------|------|
| N1 | 데이터베이스/영구 저장 | 인메모리 게임 서버, JSON 파일 저장으로 충분 |
| N2 | 마이크로서비스 분리 | 단일 게임 서버, 도메인 경계 불필요 |
| N3 | 클라이언트 3D 렌더링 재작성 | Three.js/R3F 기존 스택 유지, 에셋만 교체 |
| N4 | 글로벌 멀티리전 배포 | Phase 1은 단일 리전 (Railway) |
| N5 | 바이너리 프로토콜 (Phase 1) | JSON 우선, 성능 병목 시 Phase 2에서 전환 |
| N6 | 사용자 인증/계정 시스템 | 게스트 플레이 우선, OAuth는 Phase 4+ |

---

## 3. System Context — C4 Level 1

### 3.1 Context Diagram

```
                           ┌───────────────────┐
                           │   Human Player     │
                           │  (웹 브라우저)       │
                           └─────────┬─────────┘
                                     │ HTTPS + WSS
                                     ▼
┌──────────────┐           ┌───────────────────┐           ┌──────────────┐
│  AI Agent    │──WSS────▷│  Agent Survivor    │◁──HTTPS──│   Vercel     │
│  (LLM Bot)  │           │  Game System        │           │   CDN        │
└──────────────┘           └───────────────────┘           └──────────────┘
                                     │
                                     │ Docker
                                     ▼
                           ┌───────────────────┐
                           │    Railway PaaS    │
                           │  (Container Host)   │
                           └───────────────────┘
```

### 3.2 External Actors

| Actor | 설명 | 통신 방식 |
|-------|------|----------|
| **Human Player** | 웹 브라우저에서 게임 플레이. 조향(마우스/터치) + 부스트 + 레벨업 선택 | WebSocket (게임), HTTPS (정적 에셋) |
| **AI Agent** | LLM 기반 자율 플레이어. 빌드 전략, 전투 명령, 레벨업 선택을 자동 수행 | WebSocket (게임 + 명령) |
| **Vercel CDN** | Next.js 프론트엔드 정적 파일 호스팅 + SSR | HTTPS |
| **Railway PaaS** | Go 서버 Docker 컨테이너 호스팅 | Internal |

### 3.3 System Boundary

Agent Survivor 시스템은 크게 **2개 배포 단위**로 구성:

1. **Go Game Server** (Railway) — 게임 로직, WebSocket Hub, Room 관리, AI Bot, Agent API
2. **Next.js Web Client** (Vercel) — 로비 UI, 게임 렌더링 (2D Canvas → 3D R3F), 캐릭터 커스터마이저

---

## 4. Container Diagram — C4 Level 2

### 4.1 Container Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Survivor System                            │
│                                                                         │
│  ┌──────────────────────────────────────┐  ┌─────────────────────────┐  │
│  │         Go Game Server               │  │   Next.js Web Client     │  │
│  │         (Railway Container)           │  │   (Vercel Edge)          │  │
│  │                                      │  │                         │  │
│  │  ┌──────────┐  ┌─────────────────┐  │  │  ┌───────────────────┐  │  │
│  │  │ HTTP      │  │ WebSocket Hub    │  │  │  │ React App          │  │  │
│  │  │ Router    │  │ (channel-based) │  │  │  │ (SSR/CSR)          │  │  │
│  │  │ (chi/v5)  │  │                 │  │  │  └───────┬───────────┘  │  │
│  │  └─────┬────┘  └────────┬────────┘  │  │          │              │  │
│  │        │                │            │  │  ┌───────▼───────────┐  │  │
│  │        │         ┌──────▼──────┐     │  │  │ Game Renderer      │  │  │
│  │  ┌─────▼────┐   │ RoomManager  │     │  │  │ (2D Canvas/3D R3F)│  │  │
│  │  │ REST API  │   │  ┌────────┐ │     │  │  └───────────────────┘  │  │
│  │  │ /health   │   │  │ Room×N │ │     │  │                         │  │
│  │  │ /api/v1/* │   │  │ Arena  │ │     │  │  ┌───────────────────┐  │  │
│  │  └──────────┘   │  │ Bots   │ │     │  │  │ WebSocket Adapter  │  │  │
│  │                  │  └────────┘ │     │  │  │ (Native WS)       │  │  │
│  │                  └─────────────┘     │  │  └───────────────────┘  │  │
│  └──────────────────────────────────────┘  └─────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────┐                               │
│  │       Shared Types (packages/shared) │  ← TypeScript 타입 정의       │
│  │       constants, types, utils         │  (Go는 domain/ 내 재정의)     │
│  └──────────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Container Details

#### Go Game Server (Primary Container)

| 속성 | 값 |
|------|-----|
| **언어/런타임** | Go 1.24, 단일 바이너리 (~10MB) |
| **책임** | 게임 로직, 실시간 상태 관리, WebSocket 통신, Bot AI, Agent API |
| **포트** | `$PORT` (Railway 동적 할당, 기본 8000) |
| **Goroutine 구조** | Main + Hub(1) + RoomManager(1) + Room(N) + Client(M×2) |
| **상태** | 완전 인메모리 (재시작 시 초기화) |
| **배포** | Railway Docker (multi-stage build, `scratch` base) |

**내부 패키지 구조**:
```
server/
├── cmd/server/main.go          ← Composition root
├── internal/
│   ├── config/config.go        ← envconfig 기반 설정
│   ├── server/router.go        ← chi 라우터 + 미들웨어
│   ├── ws/                     ← WebSocket 계층
│   │   ├── hub.go              ← Channel-based Hub (lock-free)
│   │   ├── client.go           ← ReadPump + WritePump goroutine
│   │   └── protocol.go         ← JSON 프레임 직렬화
│   ├── game/                   ← 게임 로직 계층
│   │   ├── room_manager.go     ← Room 생명주기, Quick Join
│   │   ├── room.go             ← Room 상태 머신 + 20Hz 루프
│   │   ├── arena.go            ← 게임 루프 오케스트레이터
│   │   ├── agent.go            ← Agent 엔티티 (물리/전투/빌드)
│   │   ├── collision.go        ← Aura DPS + Dash + 경계
│   │   ├── upgrade.go          ← Tome/Ability/Synergy
│   │   ├── orb.go              ← Orb 관리
│   │   ├── shrink.go           ← 아레나 수축
│   │   ├── spatial_hash.go     ← 공간 인덱싱
│   │   ├── bot.go              ← Bot AI + 빌드 패스
│   │   ├── leaderboard.go      ← 점수 랭킹
│   │   ├── serializer.go       ← 뷰포트 컬링 + 직렬화
│   │   ├── map_objects.go      ← Shrine/Spring/Altar/Gate
│   │   ├── training.go         ← Agent 훈련 프로필
│   │   ├── progression.go      ← RP/퀘스트/해금
│   │   ├── coach.go            ← Coach Agent (규칙 기반)
│   │   ├── analyst.go          ← Analyst Agent (라운드 분석)
│   │   └── constants.go        ← 게임 상수
│   └── domain/                 ← 순수 타입 (의존성 없음)
│       ├── types.go            ← Agent, Orb, Position, Build
│       ├── events.go           ← WS 이벤트 페이로드
│       ├── skins.go            ← 34종 스킨 프리셋
│       └── upgrades.go         ← Tome/Ability/Synergy 정의
├── go.mod / go.sum
└── Dockerfile
```

**패키지 의존성 규칙** (단방향, 순환 금지):
```
cmd/server → internal/config, internal/server, internal/ws, internal/game
internal/server → internal/ws, internal/game
internal/ws → internal/domain
internal/game → internal/domain
internal/domain → (없음, Pure Types)
```

#### Next.js Web Client (Secondary Container)

| 속성 | 값 |
|------|-----|
| **프레임워크** | Next.js 15 + React 19 + TypeScript |
| **렌더링** | SSR (로비) + CSR (게임) |
| **3D 엔진** | Three.js 0.175 + React Three Fiber 9.5 + Drei 10.7 |
| **WebSocket** | Native WebSocket (Socket.IO 제거) |
| **배포** | Vercel Edge Network |

**디렉토리 구조** (주요 변경):
```
apps/web/
├── app/page.tsx                     ← 로비/게임 모드 전환
├── hooks/
│   ├── useWebSocket.ts              ← NEW: Native WS 어댑터
│   └── useSocket.ts                 ← 리팩토링: Socket.IO → useWebSocket
├── lib/
│   ├── renderer/                    ← 2D Canvas 렌더러
│   │   ├── entities.ts              ← 전면 리라이트: Snake→Agent 스프라이트
│   │   ├── background.ts            ← MC 타일 배경
│   │   └── ui.ts                    ← HUD 렌더링
│   ├── interpolation.ts             ← Snake→Agent 보간
│   └── camera.ts                    ← 동적 줌 (유지)
├── components/
│   ├── game/                        ← 인게임 UI
│   │   ├── GameCanvas.tsx
│   │   ├── LevelUpOverlay.tsx       ← NEW: 3택 업그레이드 카드
│   │   ├── BuildHUD.tsx             ← NEW: Tome/Ability 슬롯
│   │   ├── XPBar.tsx                ← NEW: MC 경험치 바
│   │   ├── ShrinkWarning.tsx        ← NEW: 수축 경고
│   │   ├── SynergyPopup.tsx         ← NEW: 시너지 발동 팝업
│   │   ├── CoachBubble.tsx          ← NEW: Coach 조언 버블
│   │   └── AnalystPanel.tsx         ← NEW: 라운드 분석 패널
│   ├── lobby/                       ← 로비 UI
│   │   ├── CharacterCreator.tsx     ← NEW: MC 캐릭터 커스터마이저
│   │   ├── TrainingConsole.tsx      ← NEW: Agent 훈련 콘솔
│   │   ├── RoomList.tsx             ← 리브랜딩
│   │   └── Mc*.tsx                  ← 유지 (McPanel, McButton, McInput)
│   └── 3d/                          ← R3F 3D 컴포넌트
│       ├── LobbyScene3D.tsx         ← 유지 → Agent 아이들로 교체
│       └── LobbyAgentPreview.tsx    ← NEW: MC 에이전트 프리뷰
└── public/sprites/agents/            ← NEW: MC 스프라이트시트
```

#### Shared Types Package

| 속성 | 값 |
|------|-----|
| **위치** | `packages/shared/` |
| **역할** | TypeScript 타입 정의 (클라이언트 전용) |
| **Go 측** | `internal/domain/` 에서 동일 타입을 Go로 재정의 |
| **동기화** | 수동 (JSON 태그 camelCase로 호환 유지) |

### 4.3 컨테이너 간 통신

| From | To | Protocol | 빈도 | 데이터 |
|------|----|----------|------|--------|
| Client | Server | WSS `{e,d}` | 30Hz (input) | 조향 각도, 부스트, 시퀀스 |
| Server | Client | WSS `{e,d}` | 20Hz (state) | 에이전트/오브 상태, 리더보드 |
| Server | Client | WSS `{e,d}` | 1Hz (lobby) | Room 목록, 최근 우승자 |
| Server | Client | WSS `{e,d}` | 이벤트 | death, kill, level_up, synergy |
| Client | Server | WSS `{e,d}` | 이벤트 | join_room, leave_room, choose_upgrade |
| AI Agent | Server | WSS `{e,d}` | 동일 | 동일 프로토콜 (API key 인증 추가) |
| Browser | Vercel | HTTPS | 요청시 | 정적 에셋, SSR 페이지 |
| Browser | Server | HTTPS | 요청시 | REST API (/health, /api/v1/*) |

---

## 5. Component Design — C4 Level 3

### 5.1 Server — WebSocket Layer (`internal/ws/`)

```
┌──────────────────────────────────────────────────────────┐
│                    WebSocket Layer                         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │              Hub (단일 goroutine)                 │     │
│  │                                                 │     │
│  │  rooms: map[roomID]map[*Client]bool             │     │
│  │  lobby: map[*Client]bool                        │     │
│  │                                                 │     │
│  │  Channels:                                      │     │
│  │  ├── register   ← 새 연결 등록                    │     │
│  │  ├── unregister ← 연결 해제                      │     │
│  │  ├── broadcast  ← 전체 브로드캐스트               │     │
│  │  ├── roomcast   ← Room별 브로드캐스트             │     │
│  │  ├── unicast    ← 단일 클라이언트 전송            │     │
│  │  └── done       ← 종료 신호                      │     │
│  └─────────────────────────────────────────────────┘     │
│          ▲              ▲              ▲                  │
│          │              │              │                  │
│  ┌───────┴──┐  ┌───────┴──┐  ┌───────┴──┐              │
│  │ Client A │  │ Client B │  │ Client N │              │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │              │
│  │ │Read  │ │  │ │Read  │ │  │ │Read  │ │              │
│  │ │Pump  │ │  │ │Pump  │ │  │ │Pump  │ │              │
│  │ ├──────┤ │  │ ├──────┤ │  │ ├──────┤ │              │
│  │ │Write │ │  │ │Write │ │  │ │Write │ │              │
│  │ │Pump  │ │  │ │Pump  │ │  │ │Pump  │ │              │
│  │ ├──────┤ │  │ ├──────┤ │  │ ├──────┤ │              │
│  │ │Rate  │ │  │ │Rate  │ │  │ │Rate  │ │              │
│  │ │Limiter│ │  │ │Limiter│ │  │ │Limiter│ │              │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │              Protocol                            │     │
│  │  JSON Frame: {"e": "event", "d": {...}}          │     │
│  │  Event Router: event name → handler function     │     │
│  │  Rate Limits: input 30Hz, respawn 1Hz, ping 5Hz  │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

**핵심 설계 결정**:
- Hub는 **단일 goroutine + channel**로 동작 (lock-free, 데드락 불가)
- Client당 ReadPump + WritePump 2개 goroutine
- WritePump의 send channel 버퍼(64) 초과 시 클라이언트 추방 (backpressure)
- Rate Limiter는 Client 구조체에 내장 (sync.Map 기반)

### 5.2 Server — Game Layer (`internal/game/`)

```
┌──────────────────────────────────────────────────────────────┐
│                      Game Layer                               │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │                  RoomManager                       │       │
│  │  rooms: []*Room (최대 50개)                        │       │
│  │  playerRoom: map[clientID]roomID                   │       │
│  │                                                   │       │
│  │  JoinRoom() | LeaveRoom() | QuickJoin()           │       │
│  │  GetRoomList() | BroadcastLobby() (1Hz)           │       │
│  └───────────────────┬───────────────────────────────┘       │
│                      │ owns N                                │
│           ┌──────────▼──────────┐                            │
│           │     Room (goroutine) │ × N                       │
│           │                     │                            │
│           │  state: RoomState   │  waiting → countdown(10s)  │
│           │  timer: int         │  → playing(5min)           │
│           │  inputChan          │  → ending(10s)             │
│           │  joinChan           │  → cooldown(15s) → waiting │
│           │  leaveChan          │                            │
│           │                     │                            │
│           │  ┌─────────────┐   │                            │
│           │  │   Arena      │   │ ← 20Hz game loop          │
│           │  │              │   │                            │
│           │  │ ┌──────────┐│   │                            │
│           │  │ │ agents   ││   │ map[id]*Agent              │
│           │  │ ├──────────┤│   │                            │
│           │  │ │OrbManager││   │ 오브 스폰/수집/만료         │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Collision ││   │ Aura DPS + Dash + 경계     │
│           │  │ │System    ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Spatial   ││   │ Grid 200px 공간 해시       │
│           │  │ │Hash      ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Upgrade   ││   │ Tome/Ability/Synergy       │
│           │  │ │System    ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Arena     ││   │ 1분마다 -600px             │
│           │  │ │Shrink    ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Bot       ││   │ 최대 15봇/Room             │
│           │  │ │Manager   ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Map       ││   │ Shrine/Spring/Altar/Gate   │
│           │  │ │Objects   ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │Leader    ││   │ Top 10, 1Hz 갱신           │
│           │  │ │board     ││   │                            │
│           │  │ ├──────────┤│   │                            │
│           │  │ │State     ││   │ 뷰포트 컬링 + 직렬화      │
│           │  │ │Serializer││   │                            │
│           │  │ └──────────┘│   │                            │
│           │  └─────────────┘   │                            │
│           └─────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

**Arena Tick 순서** (20Hz, 50ms 간격):
```
1. Bot AI Update → 봇 입력 생성
2. Agent Physics → 이동 + 방향 + 부스트
3. Arena Shrink → 경계 업데이트 + 페널티
4. Spatial Hash Rebuild → 전체 에이전트+오브 재등록
5. Aura Combat → 60px 내 DPS 교환
6. Dash Collision → 부스트 충돌 30% 버스트
7. Death Detection → mass 0 판정 + 킬 크레딧
8. Kill XP Reward → 킬러에게 XP 보상
9. Effect Processing → 버프/디버프 틱
10. Orb Collection → 수집 반경 내 오브 흡수
11. Upgrade Timeout → 5초 타임아웃 처리
12. Leaderboard → 1Hz 정렬 (tick%20==0)
13. Orb Maintenance → 자연 오브 유지/만료
```

### 5.3 Server — Domain Layer (`internal/domain/`)

순수 타입 정의 레이어. 어떤 다른 패키지도 import하지 않음.

| 파일 | 책임 | 주요 타입 |
|------|------|----------|
| `types.go` | 핵심 게임 엔티티 | `Agent`, `Orb`, `Position`, `PlayerBuild`, `AbilitySlot`, `AgentSkin` |
| `events.go` | WebSocket 이벤트 페이로드 | `StateUpdate`, `DeathEvent`, `LevelUpEvent`, `RoundEndEvent` |
| `skins.go` | 스킨 프리셋 정의 | 34종 `AgentSkin` 프리셋 (ID 00~33) |
| `upgrades.go` | 업그레이드 정의 테이블 | 8 `TomeDef`, 6 `AbilityDef`, 10 `SynergyDef` |

### 5.4 Client — Hook/State Layer

```
┌──────────────────────────────────────────────────────────┐
│                  Client State Architecture                 │
│                                                          │
│  page.tsx (App Root)                                     │
│  ├── useSocket() hook ← 모든 게임 상태의 단일 소스       │
│  │   ├── gameState: agents[], orbs[], leaderboard        │
│  │   ├── roomState: rooms[], currentRoom, roundTimer     │
│  │   ├── playerState: myAgent, death, score              │
│  │   ├── buildState: pendingChoices, currentBuild        │
│  │   ├── emit: joinRoom, leaveRoom, input, chooseUpgrade │
│  │   └── connection: connected, latency, reconnecting    │
│  │                                                       │
│  │   내부 의존:                                           │
│  │   └── useWebSocket() ← Native WS 어댑터               │
│  │       ├── connect(url) / disconnect()                 │
│  │       ├── emit(event, data) / on(event, handler)      │
│  │       └── 자동 재연결 (exp backoff, 최대 5회)          │
│  │                                                       │
│  ├── mode === 'lobby' → Lobby Components                 │
│  │   ├── RoomList → rooms from useSocket                 │
│  │   ├── CharacterCreator → localStorage skin            │
│  │   └── TrainingConsole → REST API /api/v1/agents/*     │
│  │                                                       │
│  └── mode === 'playing' → Game Components                │
│      ├── GameCanvas → agents, orbs (props drilling)      │
│      ├── LevelUpOverlay → pendingChoices                 │
│      ├── BuildHUD → currentBuild                         │
│      ├── XPBar → myAgent.xp, myAgent.level               │
│      ├── ShrinkWarning → arenaRadius events              │
│      ├── SynergyPopup → synergy_activated events         │
│      └── DeathOverlay / RoundResultOverlay               │
└──────────────────────────────────────────────────────────┘
```

### 5.5 Client — Rendering Pipeline

```
Phase 1 (2D Canvas):
  requestAnimationFrame (60fps)
  └── render()
      ├── interpolateAgents(prev, curr, alpha) → 부드러운 20→60fps
      ├── updateCamera(myAgent.position) → lerp 추적 + 동적 줌
      ├── drawBackground(camera) → MC 타일 패턴 (존별 색상)
      ├── drawMapObjects(mapObjects) → Shrine/Spring/Altar/Gate 스프라이트
      ├── drawShrinkBoundary(radius) → 빨간 반투명 원 + 파티클
      ├── drawOrbs(orbs, camera) → 뷰포트 내 오브
      ├── drawAgents(agents, camera) → MC 16×16 스프라이트 + 오라
      │   ├── drawAgentBody(skin) → bodyColor, pattern, equipment
      │   ├── drawAura(mass, build) → 전투 오라 (빌드별 색상)
      │   ├── drawBuildVisuals(build) → 잔상/독안개/전기 이펙트
      │   └── drawNametag(name, level) → 이름 + 레벨
      ├── drawHUD() → 미니맵, 타이머, 리더보드
      └── drawParticles() → 킬/시너지/수축 파티클

Phase 4+ (3D R3F):
  R3F Canvas (useFrame)
  └── Scene
      ├── PlayCamera → 45° 쿼터뷰 추적
      ├── VoxelTerrain → MC 복셀 지형
      ├── VoxelAgents → InstancedMesh MC 캐릭터
      ├── VoxelOrbs → 오브 입자
      ├── AuraEffects → 전투 오라 셰이더
      ├── ParticleSystem → MC 파티클
      └── MapObjectMeshes → 블록 구조물
```

---

## 6. Data Flow & Sequence Diagrams

### 6.1 Player Join Flow

```
Browser                    Go Server                    Game
  │                          │                           │
  │ WSS connect /ws          │                           │
  │─────────────────────────▷│                           │
  │                          │ Hub.register (lobby)      │
  │                          │──────────────────────▷    │
  │                          │                           │
  │ {e:"join_room", d:{      │                           │
  │   roomId, name, skinId}} │                           │
  │─────────────────────────▷│                           │
  │                          │ RoomManager.JoinRoom()    │
  │                          │──────────────────────▷    │
  │                          │      Room.joinChan        │
  │                          │      ──────────────▷      │
  │                          │      Arena.AddAgent()     │
  │                          │      ──────────────▷      │
  │                          │                           │
  │ {e:"joined", d:{         │                           │
  │   roomId, id, spawn,     │                           │
  │   arena, tick,           │◁──────────────────────    │
  │   roomState, timeLeft}}  │                           │
  │◁─────────────────────────│                           │
  │                          │                           │
  │ {e:"state", d:{...}}     │  20Hz broadcast           │
  │◁═════════════════════════│◁══════════════════════    │
```

### 6.2 Game Tick Broadcast Flow

```
Room goroutine (20Hz)
  │
  ├── gameTicker.C ───▷ arena.Tick()
  │                      ├── 물리/전투/수집/사망 처리
  │                      └── deathEvents[], levelUps[] 버퍼링
  │
  ├── serializer.Serialize(agents, orbs, clientViewport)
  │     └── 클라이언트별 뷰포트 컬링
  │
  ├── Hub.roomcast ───▷ {e:"state", d:{t, s:[agents], o:[orbs], l:[leaderboard]}}
  │
  ├── deathEvents 발생 시:
  │     ├── Hub.unicast(victim) ──▷ {e:"death", d:{score, kills, killer, level...}}
  │     └── Hub.unicast(killer) ──▷ {e:"kill", d:{victim, victimMass}}
  │
  └── levelUps 발생 시:
        └── Hub.unicast(agent) ──▷ {e:"level_up", d:{level, choices[], deadline}}
```

### 6.3 Level-Up Choice Flow

```
Server                     Client/Agent
  │                           │
  │ Agent XP >= XPToNext      │
  │ GenerateChoices(3)        │
  │                           │
  │ {e:"level_up", d:{       │
  │   level: 5,              │
  │   choices: [Tome,Tome,   │
  │   Ability],              │
  │   timeoutTicks: 100}}    │
  │──────────────────────────▷│
  │                           │ 5초 타이머 시작
  │                           │ UI: 3택 카드 표시
  │                           │
  │ {e:"choose_upgrade",     │ 사용자 선택 또는
  │  d:{choiceId: 1}}        │ 에이전트 자동 선택
  │◁──────────────────────────│
  │                           │
  │ ApplyUpgrade(agent, 1)   │
  │ CheckSynergies()         │
  │                           │
  │ [시너지 발동 시]           │
  │ {e:"synergy_activated",  │
  │  d:{synergyId, name}}    │
  │──────────────────────────▷│
  │                           │
  │ [5초 타임아웃 시]          │
  │ 서버 랜덤 선택 적용       │
```

### 6.4 Room State Machine Flow

```
              MIN_PLAYERS
  waiting ─────────────────▷ countdown (10s)
    ▲                              │
    │                              │ 카운트다운 완료
    │                              ▼
cooldown (15s)              playing (300s / 5분)
    ▲                              │
    │                              │ 시간 만료 OR
    │                              │ 인간 1명 이하
    │                              ▼
    └─────────────── ending (10s)

이벤트:
  countdown → {e:"round_start", d:{countdown: 10}}
  playing   → {e:"state"} 20Hz + {e:"minimap"} 1Hz
  ending    → {e:"round_end", d:{winner, leaderboard, yourRank}}
  cooldown  → {e:"round_reset", d:{roomState: "waiting"}}
```

### 6.5 Input Pipeline (Critical Path Latency)

```
Client mouse/touch event
  │
  ▼ ~1ms (JS event loop)
useSocket.emit("input", {a: angle, b: boost, s: seq})
  │
  ▼ ~5-50ms (네트워크 RTT/2)
Server ReadPump goroutine
  │
  ▼ ~0.01ms (JSON decode)
  │
  ▼ ~0.01ms (Rate limit check)
  │
  ▼ Room.inputChan <- InputMsg
  │
  ▼ ~0-50ms (다음 틱 대기, 평균 25ms)
Room goroutine: agent.ApplyInput(angle, boost, seq)
  │
  Total: ~30-100ms (input → 반영)
  Client 보간으로 시각적 지연 감춤
```

---

## 7. API & Protocol Specification

### 7.1 WebSocket Protocol

**프레임 포맷**: 모든 메시지는 JSON 오브젝트 `{"e": "event_name", "d": {...payload}}`

#### Client → Server Events

| Event | Payload | Rate Limit | 설명 |
|-------|---------|-----------|------|
| `join_room` | `{roomId: string, name: string, skinId: number}` | 1/s | Room 참여 |
| `leave_room` | `{}` | - | Room 퇴장 |
| `input` | `{a: float, b: 0\|1, s: int}` | 30/s | 조향 각도(a), 부스트(b), 시퀀스(s) |
| `respawn` | `{name?: string, skinId?: number}` | 1/s | 리스폰 (grace period 내 1회만) |
| `choose_upgrade` | `{choiceId: int}` | - | 레벨업 선택 (0/1/2) |
| `ping` | `{t: int}` | 5/s | 레이턴시 측정 |

#### Server → Client Events

| Event | Payload | 빈도 | 설명 |
|-------|---------|------|------|
| `joined` | `{roomId, id, spawn, arena, tick, roomState, timeRemaining}` | 1회 | 참여 확인 |
| `state` | `{t: tick, s: Agent[], o: Orb[], l?: Leaderboard[]}` | 20Hz | 게임 상태 (뷰포트 컬링됨) |
| `death` | `{score, kills, duration, rank, killer?, damageSource, level, build}` | 사망시 | 사망 정보 |
| `kill` | `{victim, victimMass}` | 킬시 | 킬 알림 |
| `minimap` | `{agents: [{x,y,m,me}], boundary, mapObjects}` | 1Hz | 미니맵 데이터 |
| `pong` | `{t: clientTs, st: serverTs}` | 응답 | 레이턴시 응답 |
| `rooms_update` | `{rooms: RoomInfo[], recentWinners}` | 1Hz | 로비 Room 목록 |
| `round_start` | `{countdown: int}` | 상태전환 | 라운드 시작 카운트다운 |
| `round_end` | `{winner, finalLeaderboard, yourRank, yourScore, buildStats}` | 상태전환 | 라운드 종료 |
| `round_reset` | `{roomState}` | 상태전환 | 대기 상태 복귀 |
| `level_up` | `{level, choices: UpgradeChoice[], timeoutTicks, currentBuild}` | 레벨업시 | 업그레이드 선택 요청 |
| `synergy_activated` | `{synergyId, name, description, bonus}` | 시너지시 | 시너지 발동 |
| `arena_shrink` | `{currentRadius, minRadius, shrinkRate}` | 1Hz | 아레나 수축 정보 |
| `coach_message` | `{type, message, priority}` | 0.5~1Hz | Coach 조언 |
| `round_analysis` | `{buildEfficiency, positioning, suggestions[]}` | 라운드종료 | Analyst 분석 |
| `error` | `{code: int, message: string}` | 에러시 | 에러 알림 |

### 7.2 REST API Endpoints

#### Health & Monitoring

| Method | Path | Response | 설명 |
|--------|------|----------|------|
| GET | `/health` | `{status, uptime, rooms, totalPlayers, goroutines}` | 헬스체크 |
| GET | `/metrics` | Prometheus text format (선택) | 메트릭 |

#### Agent Training API (Phase 4)

| Method | Path | Body/Response | 설명 |
|--------|------|--------------|------|
| GET | `/api/v1/agents/:id/training` | `TrainingProfile` | 훈련 설정 조회 |
| PUT | `/api/v1/agents/:id/training` | `TrainingProfile` | 훈련 설정 저장 |
| GET | `/api/v1/agents/:id/memory` | `AgentMemory` | 학습 데이터 조회 |
| PUT | `/api/v1/agents/:id/build-path` | `BuildPath` | 빌드 패스 등록 |

#### Progression API (Phase 5)

| Method | Path | Response | 설명 |
|--------|------|----------|------|
| GET | `/api/v1/players/:id/progression` | `{rp, unlocks, achievements}` | RP/해금 조회 |
| GET | `/api/v1/players/:id/quests` | `{daily, progress}` | 퀘스트 상태 |
| GET | `/api/v1/leaderboard` | `{type, entries[]}` | 리더보드 (build/synergy/agent) |

### 7.3 Key Payload Schemas

#### State Update (20Hz — 가장 빈번, 크기 최적화 대상)

```json
{
  "e": "state",
  "d": {
    "t": 12345,
    "s": [
      {
        "i": "agent-uuid",
        "n": "PlayerName",
        "x": 1234.5, "y": 678.9,
        "h": 1.57,
        "m": 85.3,
        "v": 7,
        "b": false,
        "a": true,
        "sk": 4,
        "hr": 18.5,
        "bd": {"t": {"dmg": 3, "spd": 2}, "ab": [{"t": "venom", "l": 2}]},
        "sy": ["vampire"],
        "bot": false
      }
    ],
    "o": [
      {"i": "orb-1", "x": 100, "y": 200, "v": 2, "t": "natural"}
    ],
    "l": [
      {"i": "agent-uuid", "n": "PlayerName", "s": 85, "k": 3}
    ]
  }
}
```

**필드 약어 (대역폭 최적화)**:
- `i`=id, `n`=name, `x`/`y`=position, `h`=heading, `m`=mass
- `v`=level, `b`=boosting, `a`=alive, `sk`=skinId, `hr`=hitboxRadius
- `bd`=build, `sy`=synergies, `t`=type/tick, `s`=score/agents, `o`=orbs, `l`=leaderboard

#### Level Up Event

```json
{
  "e": "level_up",
  "d": {
    "level": 5,
    "choices": [
      {"id": 0, "type": "tome", "name": "Speed Tome", "effect": "+10% 이동속도", "stack": 3},
      {"id": 1, "type": "ability", "name": "Venom Aura", "effect": "근접 독 DoT", "isNew": true},
      {"id": 2, "type": "tome", "name": "XP Tome", "effect": "XP +20%", "stack": 1}
    ],
    "timeoutTicks": 100,
    "currentBuild": {
      "tomes": {"speed": 2, "damage": 1},
      "abilities": [{"type": "shield_burst", "level": 1}],
      "synergies": [],
      "nearbySynergies": ["speedster"]
    }
  }
}
```

---

## 8. Data Model

### 8.1 Core Entity — Agent

```go
type Agent struct {
    // Identity
    ID               string          // UUID
    Name             string          // Display name
    IsBot            bool            // 봇 여부

    // Physics (단일 위치, 세그먼트 없음)
    Position         Position        // {X, Y float64}
    Heading          float64         // 현재 방향 (rad, 0~2π)
    TargetAngle      float64         // 입력 방향
    Speed            float64         // 현재 속도 (px/s)

    // Combat & Survival
    Mass             float64         // HP 역할 (mass 0 → 사망)
    HitboxRadius     float64         // 동적 (16~22px, mass 기반)
    Boosting         bool            // 대시 상태
    Alive            bool
    GracePeriodEnd   uint64          // 무적 만료 틱
    LastDamagedBy    string          // 킬 크레딧 추적

    // Progression
    Level            int             // 1~12
    XP               int
    XPToNext         int             // 레벨업 필요 XP

    // Build System
    Build            PlayerBuild     // Tome 스택 + Ability 슬롯
    ActiveSynergies  []string        // 발동 중인 시너지 ID
    ActiveEffects    []ActiveEffect  // 일시 버프/디버프
    EffectCooldowns  []EffectCooldown

    // Level-Up State
    PendingChoices   []UpgradeChoice // nil = 선택 없음
    UpgradeDeadline  uint64          // 타임아웃 틱

    // Scoring
    Score            int
    Kills            int
    KillStreak       int
    BestScore        int

    // Visual
    Skin             AgentSkin       // 34종 프리셋 또는 커스텀

    // Metadata
    JoinedAt         time.Time
    LastInputSeq     int
}

type PlayerBuild struct {
    Tomes     map[TomeType]int     // Tome별 스택 수
    Abilities []AbilitySlot        // 최대 2~3개
}

type AbilitySlot struct {
    Type      AbilityType
    Level     int                  // 1~4 (강화 횟수)
    Cooldown  int                  // 남은 쿨다운 틱
}
```

### 8.2 Orb Entity

```go
type Orb struct {
    ID        string
    Position  Position
    Value     int        // XP 값 (1~15)
    Type      OrbType    // natural, death, powerup, mega
    SpawnTick uint64
    ExpiresAt uint64     // 만료 틱 (death orb 한정)
}

type OrbType string
const (
    OrbNatural  OrbType = "natural"   // 1~2 XP
    OrbDeath    OrbType = "death"     // 3~5 XP (사망 시 분해)
    OrbPowerUp  OrbType = "powerup"   // 5 XP + 파워업 효과
)
```

### 8.3 Room & Arena

```go
type Room struct {
    ID           string
    Name         string
    State        RoomState       // waiting|countdown|playing|ending|cooldown
    Timer        int             // 남은 초
    Arena        *Arena
    Humans       map[string]*HumanMeta
    LastWinner   *WinnerInfo
    // channels: inputChan, joinChan, leaveChan
}

type RoomState int
const (
    StateWaiting RoomState = iota  // 대기 (MIN_PLAYERS 미만)
    StateCountdown                  // 10초 카운트다운
    StatePlaying                    // 5분 게임 진행
    StateEnding                     // 10초 결과 표시
    StateCooldown                   // 15초 쿨다운
)

type Arena struct {
    Config       ArenaConfig
    Agents       map[string]*Agent
    OrbManager   *OrbManager
    SpatialHash  *SpatialHash
    Collision    *CollisionSystem
    Leaderboard  *Leaderboard
    Shrink       *ArenaShrink
    BotManager   *BotManager
    Upgrade      *UpgradeSystem
    MapObjects   *MapObjectManager
    Tick         uint64
    DeathEvents  []DeathEvent      // 틱별 이벤트 버퍼 (재사용)
    LevelUps     []LevelUpEvent
}
```

### 8.4 Upgrade System Definitions

```go
// 8종 Tome 정의
type TomeDef struct {
    ID         TomeType    // xp, speed, damage, armor, magnet, luck, regen, cursed
    Name       string
    Tier       string      // S, A, B
    EffectPerStack float64 // 스택당 효과 계수
    MaxStack   int         // 최대 스택
    Description string
}

// 6종 Ability 정의
type AbilityDef struct {
    ID         AbilityType // venom, shield, lightning, speed_dash, mass_drain, gravity
    Name       string
    Cooldown   int         // 틱 단위 쿨다운
    AutoTrigger string     // 자동발동 조건 설명
    DamageBase float64
    UpgradeMultiplier float64 // 강화당 배율 (+30%)
    CooldownReduction float64 // 강화당 쿨다운 감소 (-20%)
}

// 10종 Synergy 정의 (6 공개 + 4 히든)
type SynergyDef struct {
    ID           string
    Name         string
    Requirements SynergyReq // Tome 최소 스택 + Ability 최소 레벨
    Bonus        SynergyBonus
    Hidden       bool
    Description  string
}
```

### 8.5 Map Objects

```go
type MapObject struct {
    ID            string
    Type          MapObjectType  // shrine, spring, altar, gate
    Position      Position
    Active        bool           // 현재 사용 가능 여부
    CooldownTimer int            // 남은 쿨다운 (초)
    RespawnTime   int            // 쿨다운 시간 (초)
}

// 4종: XP Shrine(60s), Healing Spring(45s), Upgrade Altar(1회), Speed Gate(30s)
```

### 8.6 Persistent Data (JSON Files)

Phase 1에서는 DB 없이 JSON 파일로 영구 데이터 저장:

| 파일 | 위치 | 내용 |
|------|------|------|
| Agent 훈련 프로필 | `data/agents/{id}.json` | 빌드 프로필, 전투 규칙, 전략 페이즈 |
| Agent 학습 데이터 | `data/agents/{id}.json` | 라운드 결과, 상대 분석, 시너지 시도 |
| Player 진행도 | `data/players/{id}.json` | RP, 해금 상태, 업적, 퀘스트 |

**데이터 크기 예상**: Agent당 ~10KB, Player당 ~5KB → 1,000명 = ~15MB (파일시스템 충분)

---

## 9. Security Architecture

### 9.1 Threat Model (STRIDE Analysis)

| 위협 | 분류 | 공격 벡터 | 완화 전략 | 심각도 |
|------|------|----------|----------|--------|
| WS 메시지 위조 | Spoofing | 다른 플레이어 ID로 input 전송 | 서버 측 세션 바인딩 (Client.AgentID 고정) | High |
| 입력 플러딩 | DoS | 초당 수천 건 input 전송 | Rate Limiter (input 30Hz, 초과 시 드롭) | High |
| 대형 페이로드 | DoS | 수 MB JSON 전송 | ReadLimit 32KB, 초과 시 연결 종료 | Medium |
| 메모리 고갈 | DoS | 수천 WS 연결 후 유지 | WritePump 버퍼 64, 초과 시 추방. 연결당 메모리 ~8KB 제한 | High |
| 봇/치트 | Tampering | 자동화 도구로 최적 input | 서버 권위적 (server-authoritative), 클라이언트 시뮬레이션 없음 | Medium |
| Agent API 남용 | Spoofing | 타인 에이전트 명령 전송 | API Key 인증 + Agent-Session 바인딩 | High |
| CORS 우회 | Spoofing | 허용되지 않은 origin에서 연결 | gorilla/websocket CheckOrigin + chi CORS 미들웨어 | Medium |
| 속도 핵 | Tampering | 비정상적 이동 속도 | 서버가 속도 계산 (클라이언트는 각도만 전송) | Low |

### 9.2 Authentication Strategy

| 사용자 유형 | 인증 방식 | 구현 Phase |
|------------|----------|-----------|
| **게스트 플레이어** | 없음 (WS 연결 = 세션) | Phase 1 |
| **AI Agent** | API Key (HTTP Header `X-Agent-Key`) | Phase 4 |
| **등록 사용자** | OAuth2 (Google/GitHub) → JWT | Phase 5+ (Non-Goal) |

### 9.3 Server-Authoritative Model

```
핵심 원칙: 클라이언트는 "의도"만 전송, 서버가 모든 결과를 계산

Client 전송:     {a: 각도(rad), b: 부스트(0/1), s: 시퀀스}
Server 계산:     위치, 속도, 충돌, 데미지, XP, 레벨업, 사망
Client 수신:     확정된 상태 (20Hz state 이벤트)

→ 클라이언트에서 위치/데미지/속도를 조작해도 서버가 무시
→ 유일한 치트 가능성: 봇 프로그램 (허용 — AI Agent 플랫폼이므로)
```

### 9.4 Rate Limiting Design

```go
// Client 구조체 내장 Rate Limiter
type RateLimiter struct {
    inputLastTime  time.Time  // 최소 33ms 간격 (30Hz)
    respawnLastTime time.Time // 최소 2s 간격
    pingLastTime   time.Time  // 최소 200ms 간격 (5Hz)
}

func (rl *RateLimiter) AllowInput() bool {
    now := time.Now()
    if now.Sub(rl.inputLastTime) < 33*time.Millisecond {
        return false // 드롭 (에러 메시지 없음)
    }
    rl.inputLastTime = now
    return true
}
```

### 9.5 Transport Security

| 계층 | 보안 | 설명 |
|------|------|------|
| **TLS** | Railway + Vercel 자동 HTTPS/WSS | Let's Encrypt 인증서 |
| **CORS** | `CORS_ORIGIN` 환경변수 (쉼표 구분) | Vercel 도메인만 허용 |
| **WS Origin** | `CheckOrigin()` 함수 | CORS_ORIGIN과 동일 검증 |
| **Read Limit** | `conn.SetReadLimit(32 * 1024)` | 32KB 초과 메시지 거부 |
| **Ping/Pong** | 30초 타임아웃 | 연결 유지 확인, 좀비 연결 정리 |

---

## 10. Scalability & Performance

### 10.1 Performance Budget — Tick Processing

| 단계 | 예상 시간 | 비율 (50ms) |
|------|----------|------------|
| Bot AI 업데이트 (15봇) | 0.1ms | 0.2% |
| Agent 물리 (100명) | 0.2ms | 0.4% |
| Arena 수축 + 경계 체크 | 0.05ms | 0.1% |
| Spatial Hash 재구축 | 0.3ms | 0.6% |
| Aura 전투 (100명) | 0.5ms | 1.0% |
| Dash 충돌 | 0.1ms | 0.2% |
| 사망/XP 처리 | 0.05ms | 0.1% |
| Orb 수집 (100명 × ~50 orbs) | 0.2ms | 0.4% |
| 리더보드 정렬 | 0.01ms | 0.02% |
| **State 직렬화 (100명분)** | **1.0ms** | **2.0%** |
| **WebSocket 전송 (Hub channel)** | **0.1ms** | **0.2%** |
| **합계** | **~2.6ms** | **5.2%** |
| **여유** | **47.4ms** | **94.8%** |

**SLO**: P99 틱 처리 < 5ms/Room (50ms 예산의 10%)

### 10.2 Memory Budget (5,000 CCU)

| 컴포넌트 | 단위 크기 | 수량 | 합계 |
|----------|----------|------|------|
| Agent struct | ~512B | 5,000 | 2.5 MB |
| Orb struct | ~64B | 50,000 | 3.2 MB |
| SpatialHash grid | ~4B/cell | 50 × 900 | 0.2 MB |
| Client struct + channels | ~8KB | 5,000 | 40 MB |
| Goroutine stack | ~2KB | ~10,055 | 20 MB |
| JSON serialize buffer | ~16KB/room | 50 | 0.8 MB |
| **합계** | | | **~67 MB** |

Railway Basic (512MB) → 여유 445MB (87%)

### 10.3 Network Bandwidth Budget

| 데이터 | 크기 | 빈도 | 대역폭/플레이어 |
|--------|------|------|-----------------|
| State (50 visible agents) | ~4KB | 20Hz | 80 KB/s |
| Minimap | ~500B | 1Hz | 0.5 KB/s |
| Arena shrink | ~50B | 1Hz | 0.05 KB/s |
| Rooms update (lobby) | ~200B | 1Hz | 0.2 KB/s |
| **합계** | | | **~81 KB/s** |

5,000 CCU → 81 × 5,000 = **~405 MB/s outbound** (1Gbps의 ~40%)

### 10.4 Goroutine Budget

| 컴포넌트 | 수량 | 메모리 |
|----------|------|--------|
| Main / Signal / Hub | 3 | 6 KB |
| RoomManager + Lobby Broadcaster | 2 | 4 KB |
| Room game loops | 50 | 100 KB |
| Client ReadPump | 5,000 | 10 MB |
| Client WritePump | 5,000 | 10 MB |
| **합계** | **~10,055** | **~20 MB** |

### 10.5 Scaling Strategy

```
Phase 1 (현재): 단일 인스턴스 (Railway)
  └── 5,000 CCU / 50 Room / 1 Container

Phase 2 (필요시): Room Sharding
  ┌──────────────┐
  │ Load Balancer │ (Sticky Session by roomID)
  └──────┬───────┘
  ┌──────┴───────┐
  │  Redis Pub/Sub │
  └──┬────────┬──┘
  ┌──▼──┐  ┌──▼──┐
  │ Go #1 │  │ Go #2 │
  │ R1~25 │  │ R26~50│
  └──────┘  └──────┘

Phase 3 (글로벌): CDN + 지역별 인스턴스
  한국(Seoul) / 미국(US-West) / 유럽(EU-West)
```

### 10.6 Optimization Levers (우선순위 순)

| # | 최적화 | 효과 | Phase |
|---|--------|------|-------|
| 1 | State JSON 필드 약어 (i/x/y/m/h) | 페이로드 -40% | Phase 1 |
| 2 | Object pooling (Agent, Orb, []Entry) | GC 압력 -60% | Phase 1 |
| 3 | SpatialHash slice 재사용 (Clear vs new) | 할당 -80% | Phase 1 |
| 4 | MessagePack (state 이벤트만) | 페이로드 추가 -30% | Phase 2 |
| 5 | Delta compression (변경분만 전송) | 대역폭 -50% | Phase 2 |
| 6 | Custom binary protocol (state만) | 페이로드 -75% vs JSON | Phase 3 |

---

## 11. Reliability & Observability

### 11.1 Graceful Shutdown

```go
// Shutdown 순서 (15초 타임아웃)
1. SIGTERM/SIGINT 수신
2. HTTP 서버 Shutdown (새 연결 거부)
3. context.Cancel() → 모든 Room goroutine 종료
4. 각 Room: 진행 중 라운드를 즉시 종료 (round_end 이벤트 전송)
5. Hub.Stop() → 모든 WS 연결에 close frame 전송
6. errgroup.Wait() → 모든 goroutine 종료 확인
7. 프로세스 종료
```

### 11.2 Error Recovery

| 장애 유형 | 감지 | 복구 | 영향 |
|----------|------|------|------|
| **Client 연결 끊김** | ReadPump EOF | Hub.unregister → Room.leaveChan → Agent 제거 | 해당 플레이어만 |
| **Room goroutine 패닉** | recover() + 로깅 | Room 재시작, 진행 중 라운드 손실 | 해당 Room 플레이어 |
| **Hub goroutine 패닉** | recover() + 로깅 | Hub 재시작, 모든 연결 재등록 | 전체 (critical) |
| **OOM** | Railway 모니터링 | 컨테이너 재시작 (자동) | 전체 (모든 상태 손실) |
| **틱 지연 (> 50ms)** | 틱 처리 시간 측정 | slog.Warn + 메트릭 기록 | 해당 Room 랙 |

### 11.3 Observability

#### Structured Logging (slog)

```go
slog.Info("room tick",
    "room", room.ID,
    "tick", arena.Tick,
    "agents", len(arena.Agents),
    "duration_ms", elapsed.Milliseconds(),
)

slog.Warn("tick budget exceeded",
    "room", room.ID,
    "duration_ms", elapsed.Milliseconds(),
    "budget_ms", 50,
)
```

#### Health Endpoint

```json
GET /health
{
  "status": "ok",
  "uptime": "2h34m",
  "rooms": 5,
  "totalPlayers": 127,
  "totalBots": 75,
  "goroutines": 315,
  "memory": {
    "alloc": "45MB",
    "sys": "89MB",
    "gcPause": "0.3ms"
  },
  "tickLatency": {
    "room-1": {"p50": "1.2ms", "p99": "3.1ms"},
    "room-2": {"p50": "0.8ms", "p99": "2.4ms"}
  }
}
```

#### Prometheus Metrics (Phase 2, 선택)

```
game_room_players{room="room-1"} 45
game_tick_duration_ms{room="room-1",quantile="0.99"} 1.2
game_ws_connections_total 2340
game_ws_messages_in_total 45000
game_ws_messages_out_total 890000
game_orbs_total 25000
game_agent_deaths_total{source="aura"} 156
game_agent_deaths_total{source="dash"} 42
game_agent_deaths_total{source="boundary"} 23
game_synergy_activations_total{synergy="glass_cannon"} 15
game_upgrade_choices_total{type="tome"} 1234
game_upgrade_choices_total{type="ability"} 567
```

### 11.4 Disaster Recovery

| 항목 | 값 | 근거 |
|------|-----|------|
| **RTO** | ~30초 | Railway 컨테이너 재시작 시간 |
| **RPO** | 전체 손실 | 인메모리 상태, 게임 라운드 5분 이하 |
| **백업** | 불필요 | 게임 상태는 일시적, 영구 데이터(JSON)는 Railway Volume |
| **DR 전략** | 자동 재시작 | Railway `restartPolicyType: ON_FAILURE` |

**게임 서버 특성**: 상태 손실 시 새 라운드 시작으로 자연 복구. 플레이어 불편은 있지만 데이터 손실 없음 (게스트 플레이, 계정 없음).

---

## 12. Infrastructure & Deployment

### 12.1 Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Environment                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Vercel Edge Network                │    │
│  │                                                     │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐      │    │
│  │  │ Edge Node │  │ Edge Node │  │ Edge Node │      │    │
│  │  │ (Seoul)   │  │ (US-West) │  │ (EU-West) │      │    │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘      │    │
│  │        └───────────┬───┘───────────┘               │    │
│  │                    │                                │    │
│  │         Next.js 15 (SSR + Static)                   │    │
│  │         apps/web/.next                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │ WSS                               │
│  ┌─────────────────────▼───────────────────────────────┐    │
│  │              Railway Container (US-West)              │    │
│  │                                                     │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │        Go Game Server (scratch image)        │    │    │
│  │  │        Single binary ~10MB                   │    │    │
│  │  │                                             │    │    │
│  │  │  PORT=8000  CORS_ORIGIN=snake-tonexus.vercel.app │    │
│  │  │                                             │    │    │
│  │  │  HTTP: /health, /api/v1/*                   │    │    │
│  │  │  WS:   /ws (upgrade)                        │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  │  Resource: 1 vCPU, 512MB RAM                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Docker Build

```dockerfile
# server/Dockerfile — Multi-stage build
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
EXPOSE 8000
ENTRYPOINT ["/server"]
```

**빌드 결과**: ~10MB 바이너리 (scratch 이미지, no OS)

### 12.3 Environment Variables

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 8000 | HTTP/WS 서버 포트 (Railway 동적 할당) |
| `CORS_ORIGIN` | `http://localhost:3000` | 허용 Origin (쉼표 구분 복수 가능) |
| `TICK_RATE` | 20 | 게임 루프 Hz |
| `MAX_ROOMS` | 5 | 최대 Room 수 (Phase 1) |
| `MAX_BOTS_PER_ROOM` | 15 | Room당 최대 봇 수 |
| `LOG_LEVEL` | info | 로그 레벨 (debug/info/warn/error) |

### 12.4 Monorepo Structure

```
snake/                          ← Git 루트
├── apps/
│   └── web/                    ← Next.js 프론트엔드 (Vercel)
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       ├── public/
│       └── package.json
├── server/                     ← Go 게임 서버 (Railway)
│   ├── cmd/server/
│   ├── internal/
│   ├── go.mod
│   └── Dockerfile
├── packages/
│   └── shared/                 ← TypeScript 공유 타입
│       ├── types/
│       ├── constants/
│       └── utils/
├── docs/
│   ├── designs/                ← 기획/설계 문서
│   └── adr/                    ← Architecture Decision Records
├── vercel.json                 ← Vercel 배포 설정
├── railway.json                ← Railway 배포 설정
├── game.sh                     ← 로컬 개발 스크립트
└── package.json                ← Monorepo root
```

### 12.5 CI/CD Pipeline (간소)

```
Git Push (main)
  ├── Vercel: 자동 빌드+배포 (apps/web/)
  │   └── next build → Edge Deploy (~60s)
  │
  └── Railway: 자동 빌드+배포 (server/)
      └── Docker build → Container Deploy (~90s)
```

현재 Phase에서는 별도 CI (GitHub Actions) 없이 PaaS 자동 배포 활용.
Phase 2에서 Go 테스트 + 린트 CI 추가 예정.

### 12.6 Local Development

```bash
# game.sh — 로컬 개발 환경
./game.sh dev    # Go 서버 빌드+실행 + Next.js dev 동시 시작
./game.sh server # Go 서버만 실행
./game.sh build  # Go 바이너리 빌드
./game.sh stop   # 모든 프로세스 종료
```

```bash
# Go 서버 빌드+실행
cd server && go build -o ../bin/server ./cmd/server
PORT=8001 CORS_ORIGIN="http://localhost:3000" ./bin/server

# Next.js 클라이언트
cd apps/web
NEXT_PUBLIC_SERVER_URL="ws://localhost:8001/ws" npx next dev --port 3000
```

---

## 13. Architecture Decision Records

### ADR-011: Go + Raw WebSocket (Socket.IO 대체)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 현재 서버는 TypeScript + Socket.IO. Go 재작성 시 `go-socket.io` 라이브러리는 불안정하고 유지보수 부족. Socket.IO 자체 프로토콜(polling fallback, 패킷 프레이밍) 오버헤드도 불필요 |
| **Decision** | gorilla/websocket + 커스텀 JSON 프로토콜 `{e, d}` 사용. 클라이언트에 경량 WebSocket 어댑터(~80줄) 추가 |
| **Consequences** | (+) 검증된 Go WS 라이브러리, Socket.IO 오버헤드 제거, 바이너리 프로토콜 전환 용이. (-) useSocket.ts 수정 필요 (1파일), 자동 재연결 수동 구현 |

### ADR-012: Channel-based Hub (Lock-free)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | WS 메시지 라우팅에 (A) sync.RWMutex 기반 맵 보호 vs (B) 단일 goroutine + channel 이벤트 루프 |
| **Decision** | agent_arena 검증 패턴인 channel-based Hub 채택. 단일 goroutine이 모든 register/unregister/broadcast 처리 |
| **Consequences** | (+) Lock-free, 데드락 불가, 프로덕션 검증. (-) Hub goroutine이 단일 병목 (5,000 CCU에서 충분, channel 처리 ~0.01ms/msg) |

### ADR-013: Per-Room Goroutine (독립 게임 루프)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 50개 Room의 20Hz 게임 루프 실행 방식. (A) 단일 goroutine에서 순차 처리 vs (B) Room별 독립 goroutine |
| **Decision** | 각 Room이 독립 goroutine에서 `time.Ticker(50ms)` 기반으로 실행. Room goroutine이 해당 Room의 모든 게임 상태를 독점 소유 |
| **Consequences** | (+) True parallelism, 동기화 불필요, Room 추가/제거 단순. (-) goroutine 수 증가 (50개, 무시 가능) |

### ADR-014: 별도 `server/` 폴더 (모노레포 내 Go 프로젝트)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | Go 서버를 기존 `apps/server/` (TypeScript)와 공존시키는 방법 |
| **Decision** | 프로젝트 루트에 `server/` 폴더를 생성, 독립 Go 모듈. 기존 TS 서버는 마이그레이션 완료 후 제거 |
| **Consequences** | (+) 독립 개발, go.mod/package.json 충돌 없음, Railway 별도 서비스. (-) shared types를 Go로 재정의 필요 |

### ADR-015: JSON 우선, Binary 최적화 지연

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 게임 상태 직렬화 포맷: JSON vs Binary (MessagePack/Protobuf) |
| **Decision** | Phase 1에서 JSON 사용 (필드 약어로 최적화). 대역폭 병목 발생 시 Phase 2에서 state 이벤트만 Binary 전환 |
| **Consequences** | (+) 브라우저 네이티브 JSON.parse, 디버깅 용이, 클라이언트 변경 최소. (-) Binary 대비 2-3배 큰 페이로드, 5,000 CCU 시 대역폭 ~405MB/s |

### ADR-016: Monolithic Game Server (마이크로서비스 거부)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 게임 서버를 마이크로서비스로 분리할 것인가 |
| **Decision** | 단일 Go 바이너리로 모든 게임 로직 포함. 서비스 간 통신 오버헤드가 20Hz 틱 예산에 치명적 |
| **Consequences** | (+) 네트워크 홉 없음, 배포 단순, 디버깅 용이. (-) 수평 확장 시 Room Sharding 필요 (Phase 2 Redis Pub/Sub) |

### ADR-017: In-Memory State + JSON File Persistence

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 게임 상태 저장소. (A) PostgreSQL/Redis, (B) 인메모리 + JSON 파일, (C) 완전 인메모리 |
| **Decision** | 게임 상태는 완전 인메모리. 영구 데이터(Agent 훈련, Player 진행도)만 JSON 파일로 디스크 저장 |
| **Consequences** | (+) 초저지연, DB 의존성 없음, 배포 단순. (-) 서버 재시작 시 게임 상태 손실 (5분 라운드이므로 수용 가능), JSON 파일 규모 제한 (~15MB) |

### ADR-018: 2D Canvas First → 3D R3F Gradual Migration

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 인게임 렌더링 방식. (A) 즉시 3D R3F, (B) 2D Canvas → 점진 전환, (C) 2D만 유지 |
| **Decision** | Phase 1~3은 2D Canvas (MC 스프라이트), Phase 4+에서 3D R3F 전환 (로비와 통일). R3F 인프라는 로비에서 이미 검증 |
| **Consequences** | (+) 빠른 MVP, 성능 안정, 점진적 비주얼 개선. (-) 2D 에셋 + 3D 에셋 이중 작업 |

---

## 14. Open Questions

| # | 질문 | 영향 범위 | 결정 시점 |
|---|------|----------|----------|
| Q1 | **MessagePack 전환 시점**: JSON 필드 약어만으로 5,000 CCU 대역폭 충분한가? | 네트워크 | Phase 1 부하 테스트 후 |
| Q2 | **Redis 필요 시점**: 단일 인스턴스 한계 도달 시점? 현실적 CCU 예상? | 인프라 | 서비스 런칭 후 |
| Q3 | **Agent API 인증**: API Key만으로 충분? OAuth2 필요? | 보안 | Phase 4 |
| Q4 | **3D R3F 전환 성능**: 100 에이전트 InstancedMesh 모바일 성능? | 렌더링 | Phase 3 프로토타입 |
| Q5 | **Bot AI 고도화**: 규칙 기반 → 강화학습/ML 전환? | AI | Phase 5+ |
| Q6 | **영구 저장소 전환**: JSON 파일 → SQLite/PostgreSQL 시점? | 데이터 | 사용자 1,000명 초과 시 |
| Q7 | **글로벌 배포**: 한국 사용자 대상 US-West 서버 레이턴시 수용 가능? | 인프라 | 한국 사용자 유입 시 |
| Q8 | **모바일 전용 클라이언트**: React Native / PWA / 웹뷰? | 클라이언트 | Phase 5+ |

---

## Appendix A: Cross-Reference Map

| 아키텍처 섹션 | 참조 기획서 |
|-------------|-----------|
| §5.1 WS Layer | `v10-go-server-plan.md` §4, §6 |
| §5.2 Game Layer | `v10-go-server-plan.md` §5, `v10-survival-roguelike-plan.md` §2-5 |
| §5.4-5.5 Client | `v10-3d-graphics-plan.md` Part A, `v10-ui-ux-plan.md` §3-9 |
| §7 Protocol | `v10-go-server-plan.md` §6.2-6.3 |
| §8 Data Model | `v10-survival-roguelike-plan.md` §5B.2, §4, §9 |
| §10 Performance | `v10-go-server-plan.md` §8-9 |
| §12 Deployment | `v10-go-server-plan.md` §9.3 |

## Appendix B: Concurrency Model Summary

```
main goroutine
├── [1] HTTP Server              (chi.ListenAndServe)
├── [1] WS Hub                  (channel-based, lock-free)
├── [1] RoomManager             (room lifecycle)
│   ├── [N] Room × 50           (독립 20Hz game loop)
│   └── [1] Lobby Broadcaster   (1Hz rooms_update)
├── [1] Signal Watcher          (SIGINT/SIGTERM → graceful shutdown)
│
Per WebSocket Connection:
├── [1] ReadPump                (클라이언트 → 서버)
├── [1] WritePump               (서버 → 클라이언트)
└── [1] Buffered channel (64)   (백프레셔, 느린 클라이언트 추방)

Total (5,000 CCU): ~10,055 goroutines ≈ 20MB stack memory
```

## Appendix C: Development Roadmap Alignment

| Phase | Steps | 아키텍처 의존성 |
|-------|-------|---------------|
| Phase 0 (S01~S12) | Go 인프라 | §4.2 Server Container, §5.1 WS Layer, §12 Deployment |
| Phase 1 (S13~S21) | 게임 시스템 | §5.2 Game Layer, §8 Data Model |
| Phase 1a (S22~S26) | Room/Bot | §5.2 RoomManager, §6.4 Room State Machine |
| Phase 2 (S27~S32) | 밸런스/배포 | §10 Performance, §12 Infrastructure |
| Phase 3 (S33~S45) | 클라이언트 | §4.2 Client Container, §5.4-5.5 Client Layers |
| Phase 4 (S46~S52) | Agent API | §7.2 REST API, §9.2 Authentication |
| Phase 5 (S53~S59) | 메타/AI | §8.6 Persistent Data, §7.2 Progression API |
