# 🐍 Snake Arena - 전략 기획서 (PLAN.md)

> **프로젝트명**: Snake Arena
> **버전**: v2.0 (Complete Redesign — snake.io/slither.io 스타일)
> **작성일**: 2026-02-26
> **수정일**: 2026-02-27
> **상태**: Revised

---

## 1. 프로젝트 개요

### 1.1 비전
**snake.io / slither.io 스타일**의 실시간 대규모 멀티플레이어 스네이크 게임.
브라우저에서 바로 접속하여 수십 명의 플레이어가 **거대한 원형 아레나**에서 경쟁.
마우스/터치로 뱀을 조종하며 먹이를 먹고 성장하고, 다른 뱀의 몸통에 상대 머리를 충돌시켜 처치.

### 1.2 레퍼런스 게임: snake.io
- **개발사**: Kooapps (2016년 iOS/Android, 2021년 WebGL)
- **플랫폼**: 브라우저, iOS, Android, Nintendo Switch, Apple TV
- **핵심 메카닉**: 연속 이동, 마우스 추적, 먹이(Orb) 흡수, 부스트, 감싸기 킬
- **플레이어 수**: 한 아레나에 수십~수백 명 동시 플레이
- **조작**: 마우스 이동(방향), 마우스 클릭/스페이스바(부스트), WASD/방향키(대체)

### 1.3 핵심 가치
- **즉시 접근**: 설치 없이 브라우저에서 바로 플레이 (익명 First)
- **대규모 실시간**: 50-100명이 하나의 거대 아레나에서 동시 경쟁
- **직관적 조작**: 마우스/터치로 뱀이 커서를 따라가는 자연스러운 조작
- **무한 성장**: 먹이를 먹고 끝없이 성장, 거대한 뱀이 되는 쾌감
- **전략적 킬**: 다른 뱀을 감싸거나 앞을 가로막아 처치하는 전략성

### 1.4 타겟 사용자
- 캐주얼 브라우저 게이머 (snake.io, slither.io 유저)
- 모바일 게이머 (터치 조작 최적화)
- 짧은 시간에 즐길 수 있는 게임을 찾는 사용자
- 경쟁형 리더보드를 즐기는 사용자

---

## 2. 게임 메카닉 상세 (snake.io 분석 기반)

### 2.1 이동 시스템 (CRITICAL — 기존 설계와 가장 큰 차이)

```yaml
Movement_Type: 연속 이동 (Continuous Movement)
  ❌ 기존(WRONG): 그리드 기반, 4방향, 셀 단위 이동
  ✅ 정확한 구현: 연속 좌표, 각도 기반, 부드러운 곡선 이동

Direction_Control:
  - 뱀 머리가 마우스/터치 위치를 향해 점진적으로 회전
  - 즉시 방향 전환이 아닌, 최대 회전 속도(turn_rate) 제한
  - 뱀 머리 위치 = 월드 좌표 (float x, float y)
  - 뱀 머리 각도 = heading angle (0~2π radian)

Body_Following:
  - 머리가 이동한 경로(path)를 몸통이 그대로 따라감
  - 각 세그먼트는 머리의 이전 위치를 순차적으로 따라감
  - 결과적으로 뱀 몸통이 부드러운 곡선을 형성
  - 세그먼트 간 거리는 일정하게 유지 (segment_spacing)

Speed:
  - 기본 속도: ~200 px/s (서버 설정값)
  - 부스트 속도: ~400 px/s (2x, 부스트 중)
  - 뱀 크기가 커져도 속도는 동일 (공정성)
```

### 2.2 부스트 메카닉 (Speed Boost)

```yaml
Activation:
  - 데스크톱: 마우스 왼쪽 클릭 홀드 OR 스페이스바 홀드
  - 모바일: 화면 더블탭 후 홀드

Effect:
  - 이동 속도 2배 증가
  - 뱀의 길이(mass)가 점진적으로 감소 (부스트 비용)
  - 감소된 mass는 뱀 뒤에 작은 Orb로 떨어짐
  - 다른 플레이어가 이 Orb를 먹을 수 있음

Strategy:
  - 공격: 상대 앞을 가로막거나 감쌀 때 부스트
  - 도주: 위험 상황에서 빠르게 탈출
  - 리스크: 부스트할수록 뱀이 짧아짐 → 죽기 쉬워짐
  - Orb 수확: 부스트하는 뱀 뒤를 따라가며 Orb 수집
```

### 2.3 먹이(Orb) 시스템

```yaml
Orb_Types:
  Static_Orbs:
    - 맵에 자연 생성되는 작은 점/Orb
    - 먹으면 약간의 길이/점수 증가
    - 맵 전체에 균일 분포, 지속적으로 리스폰

  Death_Orbs:
    - 뱀이 사망하면 몸체가 대량의 Orb로 분해
    - 큰 뱀일수록 더 많은 Orb 생성 (고가치)
    - 주변 플레이어들이 경쟁적으로 수집
    - 한 판에서 급격한 성장의 핵심 메카닉

  Boost_Trail_Orbs:
    - 부스트 중 뱀 뒤에서 떨어지는 작은 Orb
    - 다른 플레이어가 수집 가능

Growth_Rate:
  - Static Orb 1개 = +1~2 mass
  - Death Orb 1개 = +3~5 mass (크기 비례)
  - 뱀의 길이 = mass에 비례하여 세그먼트 추가
```

### 2.4 사망/킬 메카닉

```yaml
Death_Condition:
  - 뱀의 머리(head)가 다른 뱀의 몸통(body)에 충돌
  - 맵 경계(원형 경계)에 머리가 닿으면 사망
  ❌ 자기 몸에 충돌해도 사망하지 않음 (snake.io 규칙)

Kill_Strategies:
  Encircle (감싸기):
    - 상대 뱀을 자기 몸통으로 완전히 감쌈
    - 상대가 빠져나올 수 없으면 결국 내 몸에 충돌하여 사망
    - 가장 효과적이지만 긴 뱀이 필요

  Cut_Off (앞막기):
    - 상대 뱀 앞을 부스트로 가로막음
    - 상대 머리가 내 몸통에 부딪히면 킬 성공
    - 부스트 타이밍이 핵심

  Head_Chase (추격):
    - 상대 머리 근처에서 압박
    - 상대가 방향을 급전환하다 내 몸에 충돌하도록 유도

On_Death:
  - 뱀 전체가 Orb로 분해
  - 총 mass의 ~80%가 Orb로 변환 (일부 손실)
  - 킬한 플레이어에게 직접 보상 없음 (Orb를 빨리 먹어야 함)
  - 사망한 플레이어: 즉시 리스폰 가능 (작은 뱀으로 재시작)
```

### 2.5 맵/아레나 설계

```yaml
Map_Shape: 원형 (Circular Arena)
  ❌ 기존(WRONG): 40x40 정사각형 그리드, 벽 충돌
  ✅ 정확한 구현: 거대한 원형 맵, 경계 밖으로 나가면 사망

Map_Size:
  - 반지름: ~6000 단위 (논리적 좌표)
  - 실제 렌더링: 뷰포트 = 화면 크기, 카메라가 플레이어 추적
  - 줌 레벨: 뱀이 커질수록 약간 줌 아웃 (더 넓은 시야)

Map_Boundary:
  - 원형 경계에 접근하면 시각적 경고 (경계선 표시)
  - 경계를 넘으면 즉사
  - 경계 근처에서 부스트하여 상대를 경계로 몰아넣기 전략

Viewport_Camera:
  - 항상 플레이어 뱀 머리를 중심으로 추적
  - 부드러운 카메라 이동 (lerp interpolation)
  - 뱀 크기에 따른 동적 줌 (선택적)
```

### 2.6 비주얼 스타일

```yaml
Visual_Style: "Colorful Cartoon" (snake.io 스타일)
  ❌ 기존(WRONG): 16x16px 픽셀아트, 그리드 렌더링
  ✅ 정확한 구현: 부드러운 원형 세그먼트, 네온/글로우 효과, 컬러풀

Snake_Rendering:
  - 머리: 큰 원 + 눈(표정) 렌더링
  - 몸통: 연속된 원형 세그먼트가 이어진 형태
  - 세그먼트 크기: 뱀 mass에 비례하여 두께 증가
  - 컬러: 플레이어별 고유 색상/패턴 (줄무늬, 그라데이션)
  - 글로우 효과: 뱀 주변 약한 발광 (Canvas shadow/glow)

Orb_Rendering:
  - 작은 원형 파티클, 부드러운 글로우
  - 색상 다양 (랜덤 컬러)
  - Death Orb는 사망한 뱀의 색상 유지

Background:
  - 어두운 배경 (딥 네이비/블랙)
  - 미세한 도트 패턴 또는 헥사곤 그리드 (이동감 표현)
  - 배경 패턴이 카메라와 함께 스크롤되어 이동감 제공

Effects:
  - 부스트 시 속도감 이펙트 (파티클 트레일)
  - 사망 시 폭발 이펙트 (Orb 흩어짐 애니메이션)
  - 성장 시 부드러운 크기 전환
```

---

## 3. 기능 요구사항

### 3.1 핵심 기능 (MVP)

| ID | 기능 | 우선순위 | 설명 |
|----|------|---------|------|
| F-01 | 연속 이동 시스템 | P0 | 마우스/터치 추적 연속 이동, 각도 기반 회전, 부드러운 곡선 |
| F-02 | 실시간 멀티플레이어 | P0 | 50-100명 동시 아레나, 서버 상태 동기화 |
| F-03 | Orb 시스템 | P0 | 자연 Orb 생성/수집, 성장 메카닉 |
| F-04 | 충돌 시스템 | P0 | 머리↔몸통 충돌 = 사망, 경계 충돌 = 사망, 자기 몸 무시 |
| F-05 | 사망/Orb 분해 | P0 | 사망 시 몸체가 Orb로 분해, 수집 가능 |
| F-06 | 부스트 메카닉 | P0 | 클릭/스페이스 홀드 = 속도 2배, mass 소모, Orb 흘림 |
| F-07 | 리더보드 (인게임) | P0 | 실시간 상위 10명 표시 (이름 + 점수/길이) |
| F-08 | 카메라 시스템 | P0 | 뱀 머리 추적, 부드러운 팔로우, 줌 |
| F-09 | 미니맵 | P1 | 전체 맵에서 자기 위치 + 큰 뱀 위치 표시 |
| F-10 | 즉시 리스폰 | P1 | 사망 후 클릭 한 번으로 작은 뱀으로 재시작 |

### 3.2 확장 기능 (Post-MVP)

| ID | 기능 | 우선순위 | 설명 |
|----|------|---------|------|
| F-11 | 스킨/캐릭터 시스템 | P2 | 다양한 뱀 스킨 (패턴, 컬러, 테마) |
| F-12 | 사용자 인증 | P2 | Supabase Auth (닉네임 저장, 통계 추적) |
| F-13 | 글로벌 리더보드 | P2 | 역대 최고 점수, 일간/주간 랭킹 |
| F-14 | 이벤트/시즌 | P3 | 한정 스킨, 시즌 랭킹, 특수 이벤트 맵 |
| F-15 | 관전 모드 | P3 | 사망 후 다른 플레이어 관전 |
| F-16 | 프라이빗 룸 | P3 | 친구와 비공개 아레나 생성 |

---

## 4. 비기능 요구사항

### 4.1 성능

```yaml
Server:
  Tick_Rate: 20Hz (50ms 간격) — 게임 로직 업데이트
  Max_Players_Per_Arena: 100명
  State_Update_Rate: 10-20Hz (클라이언트에 상태 전송)
  Spatial_Partitioning: 필수 (관심 영역만 업데이트)

Client:
  Frame_Rate: 60 FPS 렌더링
  Input_Latency: <50ms (마우스→방향 반영)
  Interpolation: 서버 상태 간 부드러운 보간
  Bundle_Size: <300KB gzip

Network:
  State_Payload: ~200-500B/tick/player (뷰포트 내 엔티티만)
  Bandwidth_Per_Player: ~50-100 KB/s
  Reconnect: 자동 재연결 (5초 이내)
```

### 4.2 확장성
- 단일 서버: 100명 동시 접속 (1 아레나)
- 수평 확장: 여러 아레나 서버 인스턴스 (로드밸런서)
- 상태 비공유: 각 아레나 서버가 독립적

### 4.3 보안
- Server-Authoritative: 모든 게임 로직 서버 처리
- 입력 검증: 클라이언트 입력은 각도(angle)만 전송, 서버가 이동 계산
- Rate Limiting: 입력 이벤트 초당 30회 제한
- Anti-Speed-Hack: 서버가 이동 속도 제한 검증

### 4.4 접근성
- 마우스 + 키보드(WASD/방향키) 동시 지원
- 모바일 터치: 조이스틱 or 터치 방향 추적
- 색약 모드: 뱀 색상 대비 강화, 패턴 구분자 추가

---

## 5. 기술 스택

### 5.1 기술 스택 (변경 없음, 구현 방식만 변경)

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| **프론트엔드** | Next.js 15 (App Router) | React 생태계, Vercel 최적화 |
| **게임 렌더링** | HTML5 Canvas API | 부드러운 2D 렌더링, 원형/곡선 드로잉 |
| **실시간 통신** | Socket.IO v4 | 자동 재연결, 바이너리 지원, fallback |
| **게임 서버** | Node.js + Express | 이벤트 루프 활용, Socket.IO 네이티브 |
| **데이터베이스** | Supabase (PostgreSQL) | Auth + DB + Realtime 통합 |
| **배포(FE)** | Vercel | Next.js 최적 배포 |
| **배포(BE)** | Railway | WebSocket 장기 연결 지원 |
| **언어** | TypeScript | 프론트/백엔드 공유 타입 |
| **프로젝트 구조** | Turborepo monorepo | 공유 패키지 관리 |

### 5.2 ADR-001: Canvas vs Phaser (유지, 근거 수정)

```
Status: Accepted (Revised)

Context:
  - snake.io 스타일은 부드러운 원형 렌더링 필요
  - 복잡한 물리 엔진 불필요 (충돌 = 원-원/원-선 체크)
  - Canvas 2D로 원형 세그먼트 + 글로우 이펙트 충분

Decision:
  - 순수 HTML5 Canvas API 사용

Consequences:
  ✅ 번들 사이즈 절약 (Phaser ~1MB)
  ✅ arc(), bezierCurveTo() 등으로 부드러운 곡선 직접 렌더링
  ✅ shadowBlur로 글로우 이펙트 구현
  ❌ 복잡한 파티클 이펙트 직접 구현 필요
```

### 5.3 ADR-002: Server-Authoritative (유지)

```
Status: Accepted

기존 ADR-002 유지. 차이점:
  - 클라이언트 입력: 방향(direction) → 목표 각도(target_angle)로 변경
  - 서버가 각도 기반 연속 이동 계산
  - 서버가 원형 충돌 판정 (BVH/Grid 파티셔닝 필요)
```

### 5.4 ADR-003: 클라이언트 보간 (수정)

```
Status: Accepted (Revised)

Context:
  - 연속 이동에서 보간이 더 중요 (그리드 기반보다 복잡)
  - 서버 20Hz ↔ 클라이언트 60FPS 간 부드러운 전환 필수

Decision:
  - Entity Interpolation: 서버 상태 간 위치/각도 lerp
  - Client-Side Prediction: 로컬 뱀은 즉시 이동 반영
  - Dead Reckoning: 마지막 알려진 속도/각도로 예측 이동
  - Server Reconciliation: 서버 상태와 동기화 시 부드러운 보정

Key_Difference:
  - 그리드: 셀 단위 스냅 → 보간 간단
  - 연속: 위치/각도 lerp → 더 정밀한 보간 필요
  - 곡선 몸통: 세그먼트별 위치 배열 보간 필요
```

---

## 6. 시스템 아키텍처 (C4 Level 1)

### 6.1 시스템 컨텍스트 다이어그램

```
                    ┌──────────────┐
                    │   Players    │
                    │ (Browser /   │
                    │  Mobile)     │
                    └──────┬───────┘
                           │ WebSocket + HTTPS
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
     ┌──────────────────┐   ┌──────────────────┐
     │   Next.js App    │   │  Arena Server(s)  │
     │   (Vercel)       │   │  (Railway)        │
     │                  │   │                   │
     │ - Landing/Lobby  │   │ - Arena Game Loop │
     │ - Game Canvas    │   │ - Physics (move/  │
     │ - Leaderboard UI │   │   collide)        │
     │ - Client Predict │   │ - State Broadcast │
     │ - Interpolation  │   │ - Spatial Index   │
     └─────────┬────────┘   └─────────┬─────────┘
               │                      │
               └──────────┬───────────┘
                          │
                          ▼
                ┌──────────────────┐
                │    Supabase      │
                │                  │
                │ - Auth (OAuth)   │
                │ - Player Stats   │
                │ - Leaderboard    │
                └──────────────────┘
```

### 6.2 핵심 데이터 흐름

```
Player Input Flow (연속 이동):
  Player → [Mouse Move: angle=2.35rad] → Socket.IO → Arena Server
  Player → [Mouse Click: boost=true] → Socket.IO → Arena Server
  Arena Server: validate → update heading → calculate movement
  Arena Server → [State Update: positions, angles, lengths] → Players in viewport
  Players: interpolate → render smooth curves on Canvas

Game Loop (Server, 20Hz):
  1. Receive & queue player inputs (target angles, boost flags)
  2. Update snake headings (apply turn_rate limit)
  3. Move all snakes forward (speed × dt, add new head positions)
  4. Handle boost (reduce mass, drop trail orbs)
  5. Check collisions (head↔body, head↔boundary)
  6. Process deaths (convert to orbs)
  7. Check orb collection (head near orbs)
  8. Spawn new natural orbs if needed
  9. Build per-player state updates (viewport-based)
  10. Broadcast state updates

Arena Lifecycle (No Rooms — Persistent Arena):
  Arena Always Running → Players Join/Leave Freely
  → New Player: spawn at random safe position (small snake)
  → Death: convert to orbs → player can rejoin immediately
  → No rounds, no timer — infinite continuous play
  → Leaderboard updates in real-time
```

---

## 7. 핵심 데이터 구조 (방향)

```typescript
// 연속 좌표 기반 위치
interface Position {
  x: number;  // float, world coordinates
  y: number;  // float, world coordinates
}

// 뱀 엔티티 (서버 권위적)
interface Snake {
  id: string;
  name: string;
  segments: Position[];      // 머리(index 0)부터 꼬리까지 연속 좌표
  heading: number;           // 현재 이동 각도 (radian)
  targetAngle: number;       // 클라이언트가 요청한 목표 각도
  speed: number;             // 현재 속도
  mass: number;              // 총 질량 (길이/두께 결정)
  boosting: boolean;         // 부스트 중 여부
  alive: boolean;
  skin: SnakeSkin;           // 외형 정보
  score: number;
  kills: number;
}

// Orb (먹이)
interface Orb {
  id: string;
  position: Position;
  value: number;             // 흡수 시 mass 증가량
  color: string;
  type: 'natural' | 'death' | 'boost_trail';
}

// 아레나 상태
interface ArenaState {
  snakes: Map<string, Snake>;
  orbs: Orb[];               // Spatial index로 관리
  boundary: { center: Position; radius: number };
  leaderboard: LeaderboardEntry[];
}
```

---

## 8. 프로젝트 구조 (Revised)

```
snake/
├── apps/
│   ├── web/                    # Next.js 프론트엔드 (Vercel)
│   │   ├── app/                # App Router
│   │   │   ├── page.tsx        # 랜딩 (Play 버튼, 닉네임 입력)
│   │   │   └── game/           # 게임 페이지
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── GameCanvas.tsx    # 메인 게임 캔버스
│   │   │   │   ├── HUD.tsx           # 점수, 킬, 부스트 게이지
│   │   │   │   ├── Leaderboard.tsx   # 실시간 리더보드 오버레이
│   │   │   │   ├── MiniMap.tsx       # 미니맵
│   │   │   │   └── DeathScreen.tsx   # 사망 화면 (점수 요약 + Play Again)
│   │   │   └── lobby/
│   │   │       └── NicknameForm.tsx  # 닉네임 입력 폼
│   │   ├── hooks/
│   │   │   ├── useSocket.ts          # Socket.IO 연결 관리
│   │   │   ├── useGameLoop.ts        # requestAnimationFrame 루프
│   │   │   ├── useInput.ts           # 마우스/터치/키보드 입력 → 각도 계산
│   │   │   └── useCamera.ts          # 카메라 위치 & 줌 관리
│   │   └── lib/
│   │       ├── renderer.ts           # Canvas 렌더러 (뱀, Orb, 배경, 이펙트)
│   │       ├── interpolation.ts      # 엔티티 보간 (위치, 각도)
│   │       └── spatial.ts            # 클라이언트 측 공간 인덱싱
│   │
│   └── server/                 # Arena Server (Railway)
│       ├── src/
│       │   ├── index.ts              # 서버 엔트리
│       │   ├── arena/
│       │   │   ├── Arena.ts           # 아레나 관리 (메인 게임 루프)
│       │   │   ├── Snake.ts           # 뱀 엔티티 (이동, 성장, 부스트)
│       │   │   ├── OrbManager.ts      # Orb 생성/수집/소멸 관리
│       │   │   └── Collision.ts       # 충돌 판정 (원형, 공간 파티셔닝)
│       │   ├── physics/
│       │   │   ├── SpatialHash.ts     # 공간 해싱 (충돌 최적화)
│       │   │   └── Movement.ts        # 연속 이동 계산 (각도, 속도, 회전)
│       │   ├── network/
│       │   │   ├── SocketHandler.ts   # Socket.IO 이벤트 처리
│       │   │   └── ViewportCuller.ts  # 뷰포트 기반 상태 필터링
│       │   └── config/
│       │       └── arena.ts           # 아레나 설정값
│       └── package.json
│
├── packages/
│   └── shared/                 # 프론트/백엔드 공유
│       ├── types/
│       │   ├── game.ts         # Snake, Orb, ArenaState 타입
│       │   ├── events.ts       # Socket.IO 이벤트 타입
│       │   └── player.ts       # Player 프로필 타입
│       ├── constants/
│       │   ├── arena.ts        # 아레나 크기, 속도, 제한값
│       │   └── colors.ts       # 뱀 색상 팔레트
│       └── utils/
│           ├── math.ts         # 각도 계산, 거리, lerp, 벡터
│           └── collision.ts    # 공유 충돌 유틸리티
│
├── PLAN.md                     # 이 문서
├── turbo.json
├── package.json
└── tsconfig.json
```

---

## 9. 개발 일정 (마일스톤) — Revised

### Phase 1: Core Engine (Week 1-2) ★ PRIORITY
- [ ] 연속 이동 엔진 (각도 기반 이동, 세그먼트 따라가기)
- [ ] Canvas 렌더러 (원형 세그먼트 뱀, 부드러운 곡선)
- [ ] 마우스/터치 입력 → 각도 계산
- [ ] 카메라 시스템 (뱀 머리 추적, 배경 스크롤)
- [ ] 단일 플레이어 로컬 프로토타입 (뱀 이동 + Orb 먹기)

### Phase 2: Server & Multiplayer (Week 2-3)
- [ ] 서버 아레나 게임 루프 (20Hz)
- [ ] 서버 이동/충돌 로직
- [ ] Socket.IO 연결 (입력 전송, 상태 수신)
- [ ] 공간 해싱/파티셔닝 (충돌 최적화)
- [ ] 뷰포트 기반 상태 컬링 (대역폭 최적화)
- [ ] 클라이언트 보간/예측

### Phase 3: Game Systems (Week 3-4)
- [ ] 부스트 메카닉 (속도 증가, mass 소모, trail orb)
- [ ] 사망 → Orb 분해 시스템
- [ ] 즉시 리스폰
- [ ] 실시간 인게임 리더보드
- [ ] 미니맵
- [ ] HUD (점수, 길이, 킬 수)

### Phase 4: Polish & Deploy (Week 4-5)
- [ ] 비주얼 이펙트 (글로우, 파티클, 부스트 트레일)
- [ ] 스킨/캐릭터 시스템
- [ ] 모바일 터치 최적화
- [ ] 랜딩 페이지 / 닉네임 입력
- [ ] Supabase 연동 (Auth, 리더보드 저장)
- [ ] Vercel + Railway 배포
- [ ] 성능 최적화 & 버그 수정

---

## 10. 기존 코드 대비 변경 사항 요약

```yaml
MUST_CHANGE_COMPLETELY:
  packages/shared/src/types/game.ts:
    - Direction enum("UP","DOWN","LEFT","RIGHT") → heading angle(number)
    - Grid Position → 연속 좌표 Position {x: float, y: float}
    - Snake.segments: grid cells → 연속 좌표 배열
    - 신규: mass, boosting, targetAngle, skin 필드
    - Food → Orb (type, value, color 추가)

  packages/shared/src/constants/game.ts:
    - MAP_SIZE: 40 → ARENA_RADIUS: 6000
    - CELL_SIZE: 16 → SEGMENT_SPACING: 8
    - MOVE_INTERVAL → SPEED: 200 (px/s), BOOST_SPEED: 400
    - DIRECTIONS → TURN_RATE: 0.06 (rad/tick)
    - 신규: ORB_SPAWN_RATE, BOOST_COST, DEATH_ORB_RATIO 등

  apps/web/hooks/useInput.ts:
    - 키보드 방향 → 마우스 위치 기반 각도 계산 (atan2)
    - 터치 위치 → 각도 계산
    - 부스트 입력 (클릭 홀드 / 스페이스바)

  apps/web/lib/renderer.ts:
    - 그리드 렌더링 → 원형 세그먼트 뱀 렌더링
    - fillRect → arc(), bezierCurveTo()
    - 글로우/그림자 이펙트 추가
    - 배경: 격자 → 도트/헥사곤 패턴 스크롤

  apps/web/components/game/GameCanvas.tsx:
    - 그리드 기반 단일 뱀 → 멀티플레이어 연속 이동 뱀
    - 소켓 연결, 보간, 카메라 통합

  apps/server/src/game/GameRoom.ts:
    - GameRoom (방 기반) → Arena (영구 아레나)
    - 그리드 충돌 → 원형 충돌 + 공간 해싱
    - 4방향 이동 → 각도 기반 연속 이동
    - Food 시스템 → Orb 매니저 (natural/death/trail)

CAN_REUSE_WITH_MODIFICATION:
  - turbo.json, root package.json, tsconfig 구조
  - apps/server/src/index.ts (Express + Socket.IO 설정)
  - apps/web/app/layout.tsx (Next.js 레이아웃)
  - apps/web/hooks/useGameLoop.ts (rAF 루프 구조)
  - apps/server/src/network/SocketHandler.ts (이벤트 핸들러 구조)
```

---

## 11. 리스크 레지스터 (Revised)

| ID | 리스크 | 영향도 | 발생확률 | 완화 전략 |
|----|--------|--------|---------|----------|
| R-01 | 100명 동시접속 시 서버 성능 | High | High | 공간 파티셔닝, 뷰포트 컬링, 상태 압축 |
| R-02 | 연속 이동 보간 품질 | High | Medium | Dead reckoning + lerp, 다중 버퍼 |
| R-03 | 대역폭 과다 (많은 엔티티) | High | Medium | Delta compression, 뷰포트 기반 전송, Binary protocol |
| R-04 | 모바일 Canvas 성능 | Medium | High | LOD 렌더링, 이펙트 감소, 적응형 품질 |
| R-05 | 스피드핵/텔레포트핵 | Medium | Medium | Server-Authoritative, 입력 검증, 이동 속도 체크 |
| R-06 | Railway WebSocket 불안정 | Medium | Low | 자동 재연결, 상태 복원, graceful degradation |

---

## 12. 성공 지표

```yaml
MVP_Success_Criteria:
  - 50명 이상 동시 접속 한 아레나에서 플레이 가능
  - 60FPS 렌더링 유지 (데스크톱)
  - 마우스 입력→화면 반영 50ms 이하
  - 부드러운 뱀 이동 + 곡선 몸통 렌더링
  - 부스트/킬/Orb 수집 메카닉 정상 작동
  - 실시간 리더보드 업데이트

Quality_Metrics:
  - WebSocket 연결 안정성 > 99%
  - 서버 메모리 < 512MB (100명 기준)
  - 클라이언트 번들 사이즈 < 300KB (gzip)
  - 모바일 30FPS 이상 유지
```

---

## 13. 다음 단계

> **→ `/da:system`으로 심화 설계 수정 진행**
>
> Revised PLAN.md 기반으로:
> 1. C4 Level 2-3 재설계 (Arena 구조, 공간 파티셔닝)
> 2. Socket.IO 이벤트 프로토콜 재설계 (각도 입력, 상태 압축)
> 3. 게임 상태 데이터 구조 상세 (세그먼트 배열, Orb 관리)
> 4. 연속 이동 물리 엔진 상세 설계
> 5. 렌더링 파이프라인 재설계 (원형 뱀, 이펙트)

---

*Generated by DAVINCI /da:plan*
*Revised: 2026-02-27 — snake.io 리서치 기반 완전 재설계*
*Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>*
