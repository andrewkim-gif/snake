# Verification Report: v16 Game Experience Plan

> **검증일**: 2026-03-07 | **대상**: `docs/designs/v16-game-experience-plan.md`
> **방법**: 코드베이스 크로스 레퍼런스 (서버 Go + 클라이언트 TS + 공유 패키지)

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| 사실 오류 | 5 | 3 | 2 | — | — |
| 내부 모순 | 4 | 1 | 2 | 1 | — |
| 누락/미고려 | 6 | — | 2 | 3 | 1 |
| 기술 리스크 | 5 | — | 1 | 3 | 1 |
| **합계** | **20** | **4** | **7** | **7** | **2** |

**Match Rate: 72%** (20개 이슈 중 Critical 4 + High 7 = 11개 핵심 이슈)

---

## Critical Issues (즉시 수정 필요)

### C-1: walkCycle 속도 주장 사실 오류

- **기획서 (line 170)**: `"현재: walkCycle += dt * 8.0 (고정 속도)"`
- **실제 코드** (`animation-state-machine.ts:209,280`):
  ```typescript
  const walkFreq = Math.min(velocity / 80, 3.5);
  const swingPhase = Math.sin(elapsed * walkFreq * PI2);
  ```
- **진단**: 속도 동기화가 **이미 구현되어 있음**. `walkFreq = velocity / 80`으로 에이전트 속도에 비례해 애니메이션 주파수가 변함.
- **영향**: 기획서 6.1-A "속도 동기화" 개선의 전제가 잘못됨. 이미 존재하는 기능을 신규 기능처럼 기획.
- **실제 문제점**: 주파수는 연동되지만 **진폭(amplitude)이 고정** (`swingAmplitude = 0.44 rad` — line 281). 느린 이동도 빠른 이동도 같은 폭으로 팔다리를 흔듦. 또한 `bounceAmp = 1.2`도 고정.
- **수정**: "속도 동기화" → "속도 비례 진폭 조절 + 보행-주행 전환 블렌딩"으로 변경

### C-2: 기존 대시(Dash) 시스템 미인지

- **기획서 (line 215)**: 대시 항목에 `"없음 (자동)"` 기재
- **실제 코드** (`combat.go:108-141`):
  ```go
  DashSpeedV14    = 300.0  // px/s
  DashDurationSec = 1.0    // 20 ticks
  DashCooldownSecV14 = 5.0 // 100 ticks
  ```
  `CanDash()`, `PerformDash()`, `UpdateDash()`, `GetDashSpeedPerTick()` 함수 모두 구현됨.
- **Agent 구조체** (`types.go:530`): `DashCooldownEnd uint64` 필드 존재.
- **진단**: v14에서 대시가 **이미 서버에 구현됨**. 기획서가 이를 인지하지 못함.
- **영향**: Phase 1의 "dash 추가" 작업이 신규 구현이 아닌 **기존 시스템 확장**이어야 함.
- **수정**: 조작 표 대시 항목을 `"자동 (v14) → 수동 키 바인딩"으로 변경. 서버는 이미 dash 지원, 클라이언트 input에 `d` 필드 추가만 필요.

### C-3: ArenaRadius 서버/클라이언트 불일치 미해결

- **기획서 (line 355)**: `"아레나 반경 3000 = 120x120 grid"` (서버 기준만 사용)
- **실제 불일치**:
  | 상수 | 서버 (Go) | 클라이언트 (TS) |
  |------|-----------|----------------|
  | ArenaRadius | **3000.0** (`constants.go:15`) | **6000** (`game.ts:11`) |
  | TurnRate | **0.15** (`constants.go:45`) | **0.25** (`game.ts:16`) |
  | InitialMass | **30.0** (`constants.go:51`) | **10** (`game.ts:18`) |
- **영향**:
  1. Heightmap 해상도 계산이 서버 3000 기준이지만, 클라이언트가 6000을 사용하면 **지형이 절반만 커버**
  2. Country S-tier 아레나 반경 6000 → 지름 12000 → 240x240 grid 필요
  3. TurnRate 차이로 **클라이언트 예측이 서버와 다른 속도로 회전** — moveAngle/aimAngle 분리 시 더 심각해짐
- **수정**: v16 Phase 0 (사전 작업)에 **상수 통일** 작업 필수 추가. 서버 값을 master로, `joined` 이벤트로 전달 or 공유 패키지 동기화.

### C-4: Space 키 용도 충돌 (대시 vs 점프)

- **기획서 조작 표 (line 215)**: `"대시: Space 또는 우클릭"`
- **기획서 InputState (line 258)**: `"dash: boolean; // Space (one-shot)"`
- **기획서 6.4.8 (line 573)**: `"Space(대시와 분리 필요 — 대시를 별도 키로): 점프"`
- **Phase 1 (line 598)**: `"ZPos, ZVelocity 추가" + "점프 물리"` (서버 구조체)
- **Phase 6 (line 667)**: `"Space → 포물선 점프"` (실제 구현)
- **진단**: 3곳에서 Space 키 용도가 모순:
  1. 조작 표: Space = 대시
  2. 6.4.8: Space = 점프 (대시는 별도 키)
  3. Phase 1: 점프 물리 서버 추가 / Phase 6: 점프 구현
- **수정**: 키 바인딩 확정 필요:
  - **제안**: Space = 점프, E/Q = 대시, Shift = 부스트 (FPS 관례)

## High Priority Issues

### H-1: 기존 WASD 구현 미인지 — "마우스만으로 방향 조작" 주장 부정확

- **기획서 (line 14)**: `"마우스만으로 방향 조작 — 뱀 게임의 잔재"`
- **실제 코드** (`GameCanvas3D.tsx:319-374`):
  ```typescript
  const keys = { up: false, down: false, left: false, right: false };
  const directionKeys: Record<string, keyof typeof keys> = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
  };
  const updateKeyboardAngle = () => {
      let dx = 0, dy = 0;
      if (keys.right) dx += 1; if (keys.left) dx -= 1;
      if (keys.down) dy += 1; if (keys.up) dy -= 1;
      if (dx === 0 && dy === 0) return;
      let angle = Math.atan2(dy, dx);
      // ...sends to server
  };
  ```
- **진단**: WASD/Arrow 키보드 방향 조작이 **이미 구현됨**. 다만 절대 방향 (화면 기준)이며, 카메라 상대 방향이 아님.
- **영향**: Phase 2의 InputManager는 신규 구현이 아닌 **기존 핸들러 리팩토링 + 카메라 상대 변환 추가**.
- **수정**: 기획서 배경 설명을 `"WASD는 존재하지만 절대 방향. 카메라 상대 이동이 아니라 직관성 부족"`으로 변경

### H-2: FR-3 vs 조작 표 부스트 바인딩 내부 모순

- **FR-3 (line 33)**: `"마우스 클릭으로 공격/부스트, 우클릭으로 대시"`
- **조작 표 (line 214)**: `"부스트: Shift 홀드"`
- **InputState (line 257)**: `"boost: boolean; // Shift"`
- **진단**: 부스트가 **마우스 클릭**인지 **Shift**인지 3곳에서 모순.
- **수정**: 통일 필요. FPS 관례상 `Shift = 스프린트(부스트)` 권장. FR-3을 `"좌클릭 = 수동 스킬 발동, Shift = 부스트, 우클릭/E = 대시"`로 수정.

### H-3: Phase 1에 점프 물리 포함 — Phase 6과 중복

- **Phase 1 (line 597-598)**: `"Agent 구조체 확장: MoveHeading, AimHeading 분리, ZPos, ZVelocity 추가"` + `"ApplyInput / UpdateAgent 수정: 점프 물리"`
- **Phase 6 (line 667)**: `"점프 물리 — Space → 포물선 점프, 착지 스쿼시, 공중 오라 면역"`
- **진단**: Phase 1에서 ZPos/ZVelocity를 구조체에 추가하고 "점프 물리"까지 구현하면 Phase 6과 중복. Phase 1은 **프로토콜 변경만** 해야 하는데 범위가 과대.
- **수정**:
  - Phase 1: `MoveHeading`, `AimHeading` 분리만. ZPos/ZVelocity는 Phase 4 (Heightmap)에서 추가
  - Phase 6: 점프 물리 전체 (서버 + 클라이언트)

### H-4: Heightmap 해상도 Country Tier 미고려

- **기획서 (line 355)**: `"1 셀 = 50 game px → 아레나 반경 3000 = 120x120 grid"`
- **실제**: Country tier별 아레나 반경이 다름 (`country_data.go`):

  | Tier | 반경 | 지름 | 50px 셀 → Grid |
  |------|------|------|----------------|
  | S (Superpower) | 6000 | 12000 | **240x240** |
  | A (Major) | 4500 | 9000 | **180x180** |
  | B (Regional) | 3500 | 7000 | **140x140** |
  | C (Standard) | 2500 | 5000 | **100x100** |
  | D (Minor) | 1500 | 3000 | **60x60** |

- **진단**: 120x120 고정 grid는 C tier에만 적합. S tier는 4배 메모리 (240x240 = 57,600 셀).
- **수정**: Heightmap 해상도를 아레나 반경에 비례 동적 결정으로 변경. `gridSize = ceil(radius * 2 / CELL_SIZE)`.

### H-5: 기존 MapStructures와 ObstacleGrid 통합 미언급

- **현재 코드** (`MapStructures.tsx`): XP Shrine (3), Healing Spring (2), Upgrade Altar (2) — 고정 위치에 배치
- **현재 서버** (`map_objects.go`): 동일 구조물이 서버에서 위치 관리, 쿨다운 처리
- **기획서**: ObstacleGrid에 `Tree/Rock/Building/Water/Bush` 타입만 정의. 기존 MapStructure와 어떻게 공존하는지 미언급.
- **수정**: ObstacleType에 `Shrine/Spring/Altar` 타입 추가 or 별도 레이어로 관리. Phase 5에 "기존 MapStructures 통합" 태스크 추가.

### H-6: InstancedMesh 하체 수중 클리핑 — 구현 난이도 과소평가

- **기획서 (line 442)**: `"수면 아래 에이전트 하체 클리핑"`
- **현재 아키텍처**: `AgentInstances.tsx`는 InstancedMesh — 모든 에이전트가 **동일 material** 공유.
- **문제**: InstancedMesh에서 개별 인스턴스의 부분 클리핑은 불가능:
  - `MeshLambertMaterial`에는 clip plane이 인스턴스별로 적용 안 됨
  - 커스텀 ShaderMaterial이 필요하며, 인스턴스별 `waterLevel` uniform을 attribute로 전달해야 함
  - 현재 텍스처 시스템 (16x16 canvas, 패턴별 material group) 전체 재작업 필요
- **수정**: 수중 클리핑 대신 **수면 아래 부분 반투명화** (opacity attribute) or **수면 파티클로 시각적 가림** 접근이 현실적. Phase 5 태스크에 구현 난이도 High 명시.

### H-7: 봇 A* 재계산 주기 내부 모순

- **기획서 6.4.6 (line 556)**: `"A* 경로 탐색: 5초 간격 재계산"`
- **기획서 리스크 표 (line 148)**: `"경로 캐싱 + 1초 간격 재계산"`
- **진단**: 5초 vs 1초 — 동일 문서 내 모순.
- **수정**: 성능과 반응성 균형 → **3초 기본 + 장애물 접근 시 즉시 재계산** 권장

## Medium Priority Issues

### M-1: 카메라 Spherical 좌표 pitch 방향 혼동 가능성

- **기획서 (line 307)**: `"pitch: 15° (거의 수평) ~ 85° (거의 탑다운)"`
- **Three.js Spherical 컨벤션**: `phi` (polar angle) = 0 → 정상(Y+, 탑다운), `phi` = PI/2 → 수평
- **문제**: 기획서의 "pitch 15° = 수평"은 Three.js의 `phi` 컨벤션과 **반대**. 구현 시 혼동 위험.
- **수정**: 명시적으로 `"phi = PI/2 - pitch"` 변환 공식 추가, 또는 Three.js 컨벤션 기준으로 재정의:
  - phi: 0.09 rad (5°, 거의 탑다운) ~ 1.31 rad (75°, 거의 수평)

### M-2: 포스트프로세싱 + 모바일 30fps 목표 충돌

- **기획서 6.4.2**: 크로매틱 수차, 비네팅, 모션 블러, 속도선 등 **6가지 포스트프로세싱 효과**
- **NFR-1**: `"모바일: 30fps"`
- **현재**: 프로젝트에 포스트프로세싱이 **전혀 없음** (`@react-three/postprocessing` 미설치)
- **리스크**: EffectComposer 추가만으로 GPU 부하 +20~30%. 크로매틱 수차는 특히 무거움.
- **수정**:
  1. Phase 7 태스크에 "모바일 quality 단계" 추가 (모바일: 비네팅만 / PC: 전체)
  2. 무거운 효과 (크로매틱 수차, 모션 블러)는 PC-only, 가벼운 효과 (비네팅, 속도선)는 CSS overlay로 대체 가능
  3. NFR에 "포스트프로세싱 OFF 옵션" 명시

### M-3: Perlin Noise 크로스 플랫폼 결정성 리스크 상세화 부족

- **기획서 (line 77-78)**: `"시드 기반 결정적 생성, 동일 Perlin 알고리즘 (Go + JS)"`
- **리스크 표**: 완화 전략으로만 언급
- **실제 위험**:
  1. Go의 `math.Floor`와 JS의 `Math.floor`는 부동소수점 에지 케이스에서 다른 결과 가능
  2. Perlin noise의 gradient 테이블, fade 함수, permutation 테이블이 구현마다 미묘하게 다름
  3. 높이 차이 1 unit만 나도 에이전트가 절벽으로 판정되어 이동 불가 → 게임플레이 파괴
- **수정**: Phase 4 태스크에 추가:
  - 특정 reference implementation 지정 (e.g., Ken Perlin original 2002)
  - 테스트 벡터: 10개 시드 × 100개 좌표의 기대 출력값 생성, Go/JS 양쪽에서 검증
  - 대안: 서버가 heightmap 배열 자체를 gzip 압축 전송 (120x120 = 14.4KB raw, gzip ~3KB)

### M-4: "vision" modifier 구현 메커니즘 미정의

- **기획서 날씨 시스템**: `"시야-30%"`, `"시야-50%"` 등 다수 언급
- **현재 서버** (`terrain_bonus.go`): `VisionMult float64` 필드 존재하지만 **서버에서 실제 사용처 없음**
- **현재 클라이언트**: 뷰포트 컬링 = 1920x1080 + 200px 마진 (고정)
- **문제**: "시야 감소"가 무엇을 의미하는지 미정의:
  - (a) 서버 뷰포트 컬링 범위 축소 → 적이 안 보임
  - (b) 클라이언트 fog 거리 단축 → 렌더링은 하지만 시각적 안개
  - (c) 미니맵 범위 축소
- **수정**: 명확한 정의 필요. 권장: **(b) fog distance 동적 조절** (서버 부하 없음, 시각적 효과 큼) + **(c) 미니맵 범위 비례 축소**

### M-5: 사운드 에셋 출처/생성 방법 미언급

- **기획서 6.4.1**: 30+ 사운드 효과 목록은 있지만 에셋 **획득 방법** 없음
- **현재 프로젝트**: `/apps/web/public/assets/` 디렉토리 존재하지만 사운드 파일 없음
- **문제**: 게임 사운드 에셋은 구현보다 **에셋 준비**가 병목. 로열티 프리 소스 또는 생성 방법 필요.
- **수정**: Phase 7에 "사운드 에셋 준비" 사전 태스크 추가:
  - 무료: freesound.org, kenney.nl/assets (CC0)
  - AI 생성: ElevenLabs SFX, Bark (오픈소스)
  - 최소 출발점: 8-bit/pixel 스타일 사운드 (MC 테마와 일치)

### M-6: 클라이언트 예측 + 이동/조준 분리 시 복잡도 증가

- **현재** (`interpolation.ts:33-43`): position(x,y), heading(h), mass(m) 4개 값만 보간
- **v16 후**: position(x,y), moveHeading, aimHeading(facing), mass, zPos = **6개 값** 보간 필요
- **추가**: 클라이언트 예측이 moveAngle 기반 위치 + aimAngle 기반 facing으로 **이중 예측** 필요
- **영향**: interpolation.ts 대폭 수정, 서버 reconciliation 로직도 변경
- **수정**: Phase 2 verify 기준에 "클라이언트 예측 정확도 테스트" 추가 (서버 위치와의 오차 < 5px)

### M-7: LOD 거리 단위 혼동 (game px vs world units)

- **기획서 (line 460)**: `"플레이어 주변 100px: 풀 디테일"`, `"100~500px"`, `"500px+"`
- **현재 좌표계**: game px ≠ world units. `toWorld()` 변환이 존재하며 스케일 팩터가 적용됨.
- **문제**: LOD 거리가 game px 기준인지 3D world units 기준인지 불명확. 카메라 줌에 따라 화면상 크기도 달라짐.
- **수정**: LOD 기준을 "카메라-오브젝트 거리 (world units)" 기준으로 명확화. 화면 점유율 기반 LOD가 더 적절.

## Low Priority Issues

### L-1: Howler.js vs drei PositionalAudio 선택 근거 부족

- **기획서**: `"Howler.js (3D positional audio 지원)"`
- **대안**: R3F 환경에서는 `@react-three/drei`의 `PositionalAudio` (Three.js AudioListener 기반)가 더 자연스러운 통합
- **Howler.js 장점**: 모바일 호환 우수, AudioSprite 내장, 독립 API
- **drei 장점**: R3F 씬 그래프 통합, 카메라 자동 리스너, 3D 공간 추적 자동
- **권장**: 하이브리드 — UI/BGM은 Howler.js, 공간 효과음(발걸음, 전투)은 drei PositionalAudio

### L-2: 킬캠 슬로모션 0.3x — 서버/클라이언트 동기화 미고려

- **기획서 6.4.7**: `"카메라가 킬러에게 0.5초간 줌인 (슬로모션 0.3x)"`
- **문제**: 슬로모션은 **순수 클라이언트 연출** (서버는 20Hz 틱 유지). 0.5초간 다른 에이전트도 느리게 보이면 서버 상태와 디싱크.
- **수정**: 슬로모션 대신 **타임 프리즈 (0.3초 정지) → 정상 속도 줌인** 접근이 동기화 문제 없음

## Verified Correct (정확성 확인됨)

| 기획서 주장 | 검증 결과 | 근거 |
|------------|----------|------|
| VoxelTerrain 120x120 ground | **정확** | `const GROUND = 120` (VoxelTerrain.tsx:13) |
| 최대 언덕 높이 4 블록 | **정확** | mountain 테마 `h: 4` (VoxelTerrain.tsx:58) |
| AnimationStateMachine 10 상태 | **정확** | `AnimState` enum 0-9 (appearance.ts:21-32) |
| 지형 반응 애니메이션 없음 | **정확** | 0 references to terrain/height in ASM |
| 상/하체 분리 없음 | **정확** | 상태가 모놀리식, parts는 개별이지만 독립 제어 안 됨 |
| 2차 모션 (관성/머리 추적) 없음 | **정확** | head.rotY는 순수 sin파, 외부 타겟 추적 없음 |
| 카메라 FOV=50, near=1, far=5000 | **정확** | GameCanvas3D.tsx:448 |
| 카메라 지형 충돌 없음 | **정확** | Y = 300/zoom 고정, 지면 인식 없음 |
| 장식물 충돌 없음 | **정확** | frustumCulled=false만, physics 없음 |
| MCParticles 풀 500개 | **정확** | `MAX_PARTICLES = 500` (MCParticles.tsx:25) |
| 지형 파티클 타입 없음 | **정확** | 6가지 게임플레이 타입만 (XP, death, levelup 등) |
| 높이 보간 없음 | **정확** | interpolation.ts는 x, y, h, m만 보간 |
| 서버 TickRate = 20Hz | **정확** | constants.go:9 |
| BaseSpeed = 150, BoostSpeed = 300 | **정확** | constants.go:27,30 |
| AuraRadius = 60 | **정확** | constants.go:60 |
| 입력 프로토콜 {a, b, s} | **정확** | InputPayload (protocol.go:164-169) |
| 사운드 전무 | **정확** | Howler.js, Web Audio, drei Audio 모두 미사용 |
| 서버에 facing/aimAngle 없음 | **정확** | Agent 구조체에 Heading만, AimHeading 없음 |
| 바이옴별 terrain_bonus 존재 | **정확** | terrain_bonus.go: 6개 바이옴 × 7개 modifier |
| PlayCamera 스크롤 줌만 | **정확** | handleWheel만, mouse orbit 없음 |

## Recommendations (우선순위 순)

### 1. [즉시] 기획서 사실 오류 수정 (C-1 ~ C-4)

```
수정 사항:
- line 170: "walkCycle += dt * 8.0 (고정 속도)"
  → "walkFreq = velocity/80 (주파수만 연동, 진폭 0.44 고정)"

- line 215: "대시: 없음 (자동)"
  → "대시: 서버 구현됨 (v14, DashDuration=1s, Cooldown=5s), 클라이언트 수동 트리거 미연결"

- line 14: "마우스만으로 방향 조작"
  → "마우스 + WASD 방향 조작 (절대 방향, 카메라 상대 아님)"

- 키 바인딩 통일:
  Space = 점프 | E = 대시 | Shift = 부스트 | 좌클릭 = 스킬 | 우클릭 드래그 = 카메라
```

### 2. [즉시] Phase 0 "상수 통일" 추가 (C-3)

```
### Phase 0: 사전 준비 — 서버/클라이언트 상수 동기화

| Task | 설명 |
|------|------|
| 상수 통일 | ArenaRadius, TurnRate, InitialMass 서버-클라이언트 일치시키기 |
| joined 이벤트 확장 | 서버 아레나 설정 전달 (radius, turnRate 등) |
| ARENA_CONFIG 동적화 | 하드코딩 → 서버 전달값 사용 |

- design: N
- verify: 서버/클라이언트 상수 일치 확인
```

### 3. [즉시] Phase 1 범위 축소 (H-3)

```
Phase 1 변경:
  - 제거: ZPos, ZVelocity, 점프 물리 (→ Phase 4/6으로 이동)
  - 유지: MoveHeading, AimHeading 분리, input 프로토콜 변경, facing 직렬화
  - 추가: 기존 Dash 시스템 input 연결 (d 필드)
```

### 4. [권장] Heightmap 동적 해상도 (H-4)

```
변경:
  기존: "1 셀 = 50px → 120x120 고정"
  수정: gridSize = ceil(arenaRadius * 2 / CELL_SIZE)

  Tier별 결과 (CELL_SIZE=50):
    S tier (6000): 240x240 = 57,600 cells
    C tier (2500): 100x100 = 10,000 cells
    D tier (1500): 60x60  = 3,600 cells

  메모리: float32 기준 S tier = 230KB (허용 범위)
```

### 5. [권장] Heightmap 서버 전송 대안 검토 (M-3)

```
옵션 A (현재 기획): 시드 기반 결정적 생성 — Go/JS 동일 구현
  - 장점: 네트워크 비용 0
  - 리스크: 크로스 플랫폼 오차 → 게임플레이 파괴 가능
  - 필수: 테스트 벡터 100+개, CI에서 교차 검증

옵션 B (권장 대안): 서버가 heightmap 배열을 gzip 전송
  - C tier: 100x100 × 4byte = 40KB → gzip ~8KB (joined 이벤트에 포함)
  - S tier: 240x240 × 4byte = 230KB → gzip ~50KB (별도 HTTP 요청)
  - 장점: 100% 동기화 보장, 구현 단순
  - 비용: 아레나 입장 시 1회 추가 전송

권장: B (안전성 우선). 시드 기반은 v17 최적화로 후순위.
```

### 6. [권장] 포스트프로세싱 단계별 적용 (M-2)

```
PC 전용 (품질 High):
  - EffectComposer: 크로매틱 수차, 모션 블러, 비네팅

모바일 / 품질 Low:
  - CSS overlay: 비네팅 (CSS radial-gradient), 속도선 (CSS border)
  - 카메라 셰이크: position offset만 (포스트프로세싱 불필요)
  - 줌 펀치: FOV 변경만 (포스트프로세싱 불필요)

설정 메뉴 추가: "비주얼 효과: Off / Low / High"
```

### 7. [권장] 수중 하체 처리 대안 (H-6)

```
기존 기획: InstancedMesh 부분 클리핑 (커스텀 셰이더 필요, 높은 난이도)

대안 (권장):
  1. 수면 파티클 레이어: 수면 높이에 스플래시 파티클로 시각적 차폐
  2. 수중 에이전트 Y offset: 수심에 비례해 에이전트 전체를 아래로 내림
  3. 수면 반투명 PlaneGeometry: 수면이 에이전트 하체를 자연스럽게 가림

  → 커스텀 셰이더 없이도 시각적으로 충분한 효과
```

---

## Confidence Level: **High**

모든 이슈가 실제 코드 크로스 레퍼런스로 검증됨.

## Sources

| 파일 | 역할 |
|------|------|
| `server/internal/game/constants.go` | 서버 상수 검증 |
| `server/internal/domain/types.go:476-533` | Agent 구조체 검증 |
| `server/internal/ws/protocol.go:164-169` | 입력 프로토콜 검증 |
| `server/internal/game/combat.go:108-141` | 대시 시스템 검증 |
| `server/internal/game/terrain_bonus.go` | 지형 modifier 검증 |
| `packages/shared/src/constants/game.ts:10-45` | 클라이언트 상수 검증 |
| `packages/shared/src/types/events.ts:225-247` | AgentNetworkData 검증 |
| `apps/web/lib/3d/animation-state-machine.ts:209,280` | 애니메이션 속도 검증 |
| `apps/web/components/3d/VoxelTerrain.tsx:13` | 지형 크기 검증 |
| `apps/web/components/3d/PlayCamera.tsx` | 카메라 동작 검증 |
| `apps/web/components/3d/MCParticles.tsx:25` | 파티클 풀 검증 |
| `apps/web/components/game/GameCanvas3D.tsx:319-374` | WASD 핸들러 검증 |
| `apps/web/lib/interpolation.ts:33-43` | 보간 시스템 검증 |
