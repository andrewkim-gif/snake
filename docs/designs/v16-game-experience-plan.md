# PLAN: v16 — Game Experience Overhaul

> **버전**: v16 | **작성일**: 2026-03-07
> **범위**: 캐릭터 애니메이션 + 조작 체계 + 지형 시스템 + 부가 시스템

---

## 1. 개요

### 배경
v15까지 AI World War의 3D 렌더링 파이프라인(R3F + InstancedMesh)과 게임 시스템(에폭, 무기, 전투)은 완성되었으나, **플레이어가 실제 조작하는 게임 경험**이 부족하다:

- 캐릭터 애니메이션이 수학적/절차적이라 **부자연스러움** — 주파수는 속도 연동(`walkFreq = velocity/80`)이지만 **진폭이 고정**(0.44 rad), 2차 모션/개성 없음
- **WASD 존재하지만 절대 방향** — 카메라 상대가 아닌 화면 고정 방향이라 카메라 회전 시 직관성 부족. 마우스 위치→angle 조작도 뱀 게임 잔재
- **지형이 사실상 평면** — 120x120 voxel 바닥 + 장식물만 존재, 전략적 지형 요소 없음
- **서버/클라이언트 상수 불일치** — ArenaRadius(3000 vs 6000), TurnRate(0.15 vs 0.25), InitialMass(30 vs 10) 등 주요 상수가 다름

### 핵심 목표
1. **생동감 있는 캐릭터 애니메이션** — 2차 모션, 지형 반응, 개성 표현
2. **FPS/TPS 스타일 조작** — WASD 이동 + 마우스 카메라/조준, 직관적 컨트롤
3. **마크 스타일 다이내믹 지형** — 높낮이, 바이옴, 장애물, 수역, 구조물
4. **플레이어가 체감하는 몰입감** — 사운드, 파티클, 날씨, 카메라 이펙트

---

## 2. 요구사항

### 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | WASD 키보드로 캐릭터 이동 (카메라 기준 상대 방향) | P0 |
| FR-2 | 마우스 드래그/이동으로 카메라 공전 (yaw/pitch) | P0 |
| FR-3 | 키 바인딩: Shift=부스트, E=대시(v14 시스템 연결), Space=점프, 좌클릭=스킬 | P0 |
| FR-4 | 이동 방향 ≠ 조준 방향 분리 (서버 프로토콜 변경) | P0 |
| FR-5 | 걷기/달리기 애니메이션 속도가 실제 이동속도에 동기화 | P0 |
| FR-6 | 2차 모션 (관성 지연, 장비 흔들림, 머리 회전 지연) | P1 |
| FR-7 | 지형 반응 애니메이션 (오르막 기울기, 수영, 미끄러짐) | P1 |
| FR-8 | Heightmap 기반 지형 생성 (서버/클라이언트 공유) | P0 |
| FR-9 | 바이옴 구역제 — 한 맵에 2-3개 바이옴 공존 | P1 |
| FR-10 | 콜리전 가능 지형 오브젝트 (나무, 바위, 건물, 벽) | P0 |
| FR-11 | 수역 (강, 호수) — 이동속도 감소, 수영 애니메이션 | P1 |
| FR-12 | 높이 차에 따른 전투 보너스 (고지대 +10% DPS) | P2 |
| FR-13 | 기본 사운드 시스템 (발걸음, 전투, 환경음) | P1 |
| FR-14 | 날씨 이펙트 (비, 눈, 모래폭풍 — 바이옴별) | P2 |
| FR-15 | 카메라 셰이크 + 히트 이펙트 (피격/킬 시 화면 연출) | P1 |
| FR-16 | 미니맵에 지형 정보 표시 | P1 |
| FR-17 | 점프/수직 이동 (장애물 위 올라가기, 낙하) | P2 |
| FR-18 | 파괴 가능 환경 오브젝트 (나무 베기, 상자 부수기) | P2 |

### 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 60 에이전트 + 지형에서 60fps 유지 | 모바일: 30fps |
| NFR-2 | 지형 메시 생성 3초 이내 | 청크 기반 점진 로딩 |
| NFR-3 | 서버 틱 20Hz 유지 | 지형 충돌 포함 |
| NFR-4 | 네트워크 대역폭 증가 < 20% | 이동/조준 분리에 따른 추가 |
| NFR-5 | 첫 로딩 시간 < 5초 | 지형 에셋 경량화 |
| NFR-6 | 메모리 사용량 < 512MB | GPU 텍스처 포함 |

---

## 3. 기술 방향

| 영역 | 현재 | 변경 |
|------|------|------|
| **조작** | 마우스 angle → 서버 input(a, b) | WASD → moveAngle + mouse → aimAngle, 서버 input(ma, aa, b, d) |
| **카메라** | 고정 3/4뷰 PlayCamera (자동 추적) | TPS 오비탈 카메라 (마우스 yaw/pitch + WASD 상대 이동) |
| **애니메이션** | 순수 수학 AnimationStateMachine | 동일 아키텍처 + 2차 모션 레이어, 속도 동기화, 지형 반응 |
| **지형 (클라이언트)** | VoxelTerrain 120x120 flat + deco | Heightmap Mesh + Biome Chunks + Collidable Objects |
| **지형 (서버)** | 2D 평면, terrain_bonus만 | Heightmap 배열 + 장애물 충돌맵 + 수역 맵 공유 |
| **좌표계** | 2D (x, y) → 3D (x, 0, y) | 2D (x, y) + height(x,y) → 3D (x, h, y) |
| **봇 AI** | 직선 이동 + 타겟 추적 | A* 경로 탐색 + 장애물 회피 + 지형 인식 |
| **사운드** | 없음 | Web Audio API + Howler.js (3D positional audio) |
| **이펙트** | MCParticles (500 풀) | + 지형 파티클, 날씨, 카메라 셰이크 |

### 핵심 기술 결정
- **상수 통일 (Phase 0 필수)**: 서버 Go 값을 마스터로, `joined` 이벤트로 전달. 클라이언트 `ARENA_CONFIG` 하드코딩 제거
  - ArenaRadius: 서버 3000 기준 → `joined`에서 동적 전달 (Country tier별 1500~6000)
  - TurnRate: 서버 0.15 기준 → 클라이언트 0.25 수정
  - InitialMass: 서버 30 기준 → 클라이언트 10 수정
- **Heightmap 전송**: 서버가 heightmap 배열을 gzip 압축 전송 (`joined` 이벤트 or 별도 HTTP)
  - C tier (100x100 × 4B = 40KB → gzip ~8KB), S tier (240x240 → gzip ~50KB)
  - 시드 기반 크로스 플랫폼 결정적 생성은 부동소수점 오차 리스크 → 직접 전송이 안전
- **충돌맵**: heightmap과 별도로 2D uint8 grid (장애물 타입) 서버가 생성, gzip 전송
- **카메라**: Three.js Spherical 좌표 기반 오비탈 카메라 (drei OrbitControls 대신 커스텀, 게임 로직 통합)
- **사운드**: 하이브리드 — UI/BGM은 Howler.js, 공간 효과음(발걸음, 전투)은 drei PositionalAudio (R3F 통합)

---

## 4. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (R3F)                             │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────────────┐ │
│  │ InputMgr │──▶│  TPSCamera   │──▶│    AgentInstances        │ │
│  │ WASD+    │   │ yaw/pitch    │   │ + SecondaryMotion        │ │
│  │ Mouse    │   │ orbit player │   │ + TerrainReactive        │ │
│  └────┬─────┘   └──────────────┘   └─────────────────────────┘ │
│       │                                                         │
│       │ moveAngle + aimAngle        ┌─────────────────────────┐ │
│       │                             │   HeightmapTerrain      │ │
│       ▼                             │ + BiomeChunks           │ │
│  ┌──────────┐                       │ + CollidableObjects     │ │
│  │ WebSocket│◀─────────────────────▶│ + WaterBodies           │ │
│  │ input()  │    state 20Hz         │ + WeatherFX             │ │
│  └────┬─────┘                       └─────────────────────────┘ │
│       │                                                         │
│       │         ┌──────────────┐   ┌─────────────────────────┐  │
│       │         │  SoundEngine │   │   CameraEffects         │  │
│       │         │  Howler.js   │   │   Shake/Flash/Vignette  │  │
│       │         └──────────────┘   └─────────────────────────┘  │
└───────┼─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (Go, 20Hz)                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ InputHandler │  │ HeightmapGen │  │  CollisionSystem      │ │
│  │ moveAngle +  │  │ 시드 기반    │  │ + TerrainCollision    │ │
│  │ aimAngle     │  │ Perlin Noise │  │ + ObstacleGrid        │ │
│  └──────┬───────┘  └──────┬───────┘  │ + HeightQuery         │ │
│         │                 │          └───────────────────────┘ │
│         ▼                 ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Arena.processTick()                    │  │
│  │  1. ApplyInput (moveAngle→heading, aimAngle→facing)      │  │
│  │  2. MoveAgent (+ height lookup + obstacle check)         │  │
│  │  3. CollectOrbs                                          │  │
│  │  4. CombatProcess (+ height advantage)                   │  │
│  │  5. BotAI (A* pathfinding around obstacles)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**주요 데이터 흐름 변경:**
1. `input` 이벤트: `{a, b, s}` → `{ma, aa, b, d, j, s}` (moveAngle, aimAngle, boost, dash, jump, seq)
2. `state` 이벤트: Agent에 `f` (facing/aimAngle) 필드 추가
3. `joined` 이벤트: `terrainSeed` + `biomeLayout` 추가 (클라이언트 지형 생성용)

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 조작 체계 전환으로 기존 플레이 감각 상실 | 높음 | 레거시 모드 토글 옵션 제공, 점진적 전환 |
| Heightmap 서버/클라이언트 동기화 오차 | ~~높음~~ 해결 | 서버 → gzip 직접 전송으로 100% 동기화 보장 (시드 기반은 v17 최적화 후보) |
| 지형 충돌로 서버 틱 성능 저하 | 중간 | 충돌맵을 2D boolean grid로 사전 계산, O(1) lookup |
| 60 에이전트 + 복잡한 지형에서 GPU 부하 | 높음 | LOD 시스템, 청크 기반 frustum culling, 모바일 quality 단계 |
| 봇 A* 경로 탐색 CPU 비용 | 중간 | 경로 캐싱 + 3초 간격 재계산 + 장애물 접근 시 즉시 재계산 + NavGrid 사전 계산 |
| 사운드 에셋 로딩 시간 | 낮음 | AudioSprite (하나의 파일에 합침) + lazy load |
| 높이 기반 전투 밸런스 깨짐 | 중간 | 높이 보너스를 미미하게 (10%) + 노출 패널티 상쇄 |
| 모바일 터치 조작과의 호환 | 높음 | 듀얼 조이스틱 UI (왼쪽 이동, 오른쪽 조준) |

---

## 6. 상세 기획

### 6.1 캐릭터 애니메이션 오버홀

#### 문제 진단

현재 `AnimationStateMachine`(1089줄)은 **10가지 상태**를 갖지만 모든 모션이 `sin/cos` 수학 함수 기반:
- 걷기: 팔다리 진자 운동 + Y 바운스 → **모든 에이전트가 동일한 리듬**
- 전환: smoothstep 블렌딩 있지만 **관성/지연 없음** → 로봇처럼 즉각 전환
- 지형 무관: 오르막/내리막/물 위에서도 **동일한 모션**

#### 개선 방향

**A. 속도 비례 진폭 + 보행-주행 전환 (Speed-Proportional Amplitude)**
```
현재: walkFreq = velocity / 80 (주파수는 연동됨)
      swingAmplitude = 0.44 rad (고정!)
      bounceAmp = 1.2 (고정!)

개선:
  // 진폭을 속도에 비례
  swingAmplitude = lerp(0.25, 0.55, clamp(velocity / boostSpeed, 0, 1))
  bounceAmp = lerp(0.6, 2.0, clamp(velocity / boostSpeed, 0, 1))

  // 걷기 → 달리기 전환 블렌딩 (threshold가 아닌 smooth)
  runBlend = smoothstep(walkThreshold, boostSpeed * 0.6, velocity)
  // runBlend 0 = 걷기 자세, 1 = 달리기 자세 (팔 더 크게, 전경 기울기)
```
- 느리게 걸으면 작은 동작, 부스트면 과장된 동작으로 **체감 속도** 증가
- 정지 시 자연스럽게 IDLE로 블렌딩 (현재 WALK_THRESHOLD=5 기반 즉각 전환 → smoothstep)

**B. 2차 모션 레이어 (Secondary Motion)**
- **관성 지연**: heading 변경 시 상체가 0.1초 뒤에 따라감 (lerp 기반)
- **머리 추적**: aimAngle(조준 방향)을 향해 머리가 독립 회전
- **장비 흔들림**: 무기/모자가 이동에 따라 미세 진동 (spring physics)
- **착지 스쿼시**: 점프/낙하 후 Y축 압축 + 복원 (0.15초)
- **히트 리코일**: 피격 시 뒤로 밀리는 2차 모션 (현재는 shake만)

**C. 개성 표현 (Per-Agent Variation)**
```
현재: idleSeed로 위상만 다름
개선:
  - armSwingAmplitude: 0.8~1.2 (팔 흔드는 폭 랜덤)
  - strideLength: 0.9~1.1 (보폭 랜덤)
  - idleQuirk: 0~4 (대기 시 고유 동작 — 고개 갸우뚱, 발 구르기, 스트레칭 등)
  - bodyType에 따른 모션 차이 (tank는 묵직하게, speedster는 경쾌하게)
```

**D. 지형 반응 애니메이션 (Terrain-Reactive)**
- **경사 기울기**: heightmap gradient 방향으로 상체 기울임 (최대 ±15도)
- **수영**: 수역 진입 시 하체 사라짐 + 팔 수영 모션
- **미끄러짐**: arctic/ice 지형에서 발이 살짝 미끄러지는 모션
- **모래/눈**: desert/arctic에서 발이 약간 빠지는 느낌 (Y offset)

**E. 전투 모션 강화**
- **이동 방향 ≠ 조준 방향**: 상체는 aimAngle, 하체는 moveAngle (분리)
- **사격 반동**: 무기 발사 시 상체 뒤로 젖혀짐
- **회피 롤**: 대시 시 구르기 모션 (BOOST → DODGE_ROLL 상태 추가)
- **킬 모션**: 적 처치 시 짧은 포효 (0.3초)

### 6.2 조작 체계 전환 (WASD + Mouse)

#### 현재 → 목표 비교

| 항목 | 현재 (v15) | 목표 (v16) |
|------|-----------|-----------|
| 이동 | WASD 존재 (절대 방향) + 마우스 angle | WASD (카메라 기준 상대 방향) |
| 카메라 | 고정 3/4뷰, 스크롤 줌만 | TPS 오비탈 (우클릭 드래그 회전, 스크롤 줌) |
| 조준 | 이동 방향 = 조준 방향 (단일 heading) | 마우스 커서 위치 → 월드 레이캐스트 = 조준점 (분리) |
| 부스트 | 마우스 클릭/홀드 | **Shift 홀드** |
| 대시 | 서버 구현됨 (v14: 1초, 5초 쿨) — 클라이언트 수동 트리거 미연결 | **E 키** (서버 기존 시스템에 클라이언트 바인딩) |
| 점프 | 없음 | **Space** (포물선 궤적, Phase 6에서 구현) |
| 공격 | 자동 (오라 범위 + v14 무기 자동 발사) | 자동 + **좌클릭** 수동 스킬 발동 |
| 모바일 | 터치 = 마우스 대체 | 듀얼 버추얼 조이스틱 |

> **키 바인딩 확정**: `WASD`=이동, `Shift`=부스트, `Space`=점프, `E`=대시, `좌클릭`=스킬, `우클릭 드래그`=카메라

#### 서버 프로토콜 변경

```
// v15: input 이벤트
{ "e": "input", "d": { "a": 1.57, "b": 1, "s": 42 } }

// v16: input 이벤트 (이동/조준 분리)
{ "e": "input", "d": {
  "ma": 1.57,   // moveAngle: WASD 기반 이동 방향 (rad), null이면 정지
  "aa": 0.78,   // aimAngle: 마우스 기반 조준 방향 (rad)
  "b": 1,       // boost (Shift)
  "d": 0,       // dash (E) — 서버 v14 CanDash()/PerformDash() 트리거
  "j": 0,       // jump (Space) — Phase 6에서 활성화
  "s": 42       // sequence
}}
```

**서버 처리 변경:**
- `Agent.Heading` → `Agent.MoveHeading` (이동 방향, WASD)
- 새로 추가: `Agent.AimHeading` (조준 방향, 마우스)
- 이동: `MoveHeading` 기준으로 position 업데이트
- 전투: `AimHeading` 기준으로 무기 발사 방향
- 오라 DPS: 기존처럼 위치 기반 (heading 무관)
- `AgentNetworkData`에 `f` (facing = aimAngle) 필드 추가

#### 클라이언트 InputManager 설계

```typescript
// 핵심 상태
interface InputState {
  // WASD → 이동 방향 (카메라 yaw 기준 상대 변환)
  moveAngle: number | null;  // null = 정지
  moveKeys: { w: boolean; a: boolean; s: boolean; d: boolean };

  // 마우스 → 조준 방향 (화면→월드 레이캐스트)
  aimAngle: number;
  aimWorldPos: Vector3;  // 지면 교차점

  // 액션
  boost: boolean;   // Shift 홀드
  dash: boolean;    // E (one-shot, 서버 v14 Dash 시스템에 연결, 5초 쿨)
  jump: boolean;    // Space (one-shot, Phase 6에서 구현)

  // 카메라 제어
  cameraYaw: number;    // 마우스 우클릭 드래그 → yaw
  cameraPitch: number;  // 마우스 우클릭 드래그 → pitch (15°~75°)
  cameraZoom: number;   // 스크롤
}
```

**WASD → moveAngle 변환 (카메라 상대):**
```
W: forward  = cameraYaw
A: left     = cameraYaw + π/2
S: backward = cameraYaw + π
D: right    = cameraYaw - π/2
WA: forward-left = cameraYaw + π/4
WD: forward-right = cameraYaw - π/4
... (8방향 + 정지)
```

**마우스 → aimAngle 변환:**
```
1. 마우스 스크린 좌표 → NDC (-1~1)
2. THREE.Raycaster.setFromCamera(ndc, camera)
3. raycaster.intersectPlane(groundPlane) → worldPos
4. aimAngle = atan2(worldPos.z - playerZ, worldPos.x - playerX)
```

#### TPS 오비탈 카메라 설계

```
현재 PlayCamera:
  position = (targetX, 300/zoom, targetZ + 180/zoom)
  lookAt(targetX, 0, targetZ)

v16 TPSCamera:
  // Spherical 좌표
  offset.x = distance * sin(pitch) * sin(yaw)
  offset.y = distance * cos(pitch)
  offset.z = distance * sin(pitch) * cos(yaw)
  position = playerPos + offset
  lookAt(playerPos)

  // 기본값
  yaw = 0 (북쪽)
  pitch = 55° (기본 — 현재 3/4뷰와 유사한 각도)
  distance = 25 (zoom 연동)

  // 제약 (Three.js Spherical 기준: phi=0 → 탑다운, phi=PI/2 → 수평)
  phi: 0.09 rad (5°, 거의 탑다운) ~ 1.31 rad (75°, 거의 수평)
  // 사용자 직관적 pitch: 15° (수평에 가까움) ~ 85° (탑다운에 가까움) = phi = PI/2 - pitch
  distance: 10 (근접) ~ 60 (원거리)

  // 지형 충돌
  camera → player 방향으로 raycast
  지형과 교차 시 카메라를 교차점 앞으로 당김
```

#### 모바일 듀얼 조이스틱

```
┌─────────────────────────────────┐
│                                 │
│   ┌───┐               ┌───┐    │
│   │ L │               │ R │    │
│   │Joy│               │Joy│    │
│   │stk│               │stk│    │
│   └───┘               └───┘    │
│  이동 방향           조준 방향   │
│                                 │
│         [Boost] [Dash]          │
└─────────────────────────────────┘
- 왼쪽 조이스틱: moveAngle 제어
- 오른쪽 조이스틱: aimAngle 제어
- 조이스틱 놓으면: 해당 입력 중지
```

### 6.3 지형 시스템

#### 현재 한계

- VoxelTerrain: 120x120 **평면** + 높이 최대 4 블록의 언덕 (장식 수준)
- TerrainDeco: 나무/선인장/건물이 있지만 **통과 가능** (충돌 없음)
- ZoneTerrain: 3개 동심원 ring → 시각적 구분만, 전략적 의미 없음
- 서버: 2D (x, y) 평면, `terrain_bonus.go`의 전역 modifier만

#### Heightmap 시스템

**생성 알고리즘 (서버/클라이언트 공유):**
```
seed → Perlin Noise (다층)
  Layer 1: 대지형 (octave=2, scale=0.005, amp=40)  — 산/계곡
  Layer 2: 중지형 (octave=4, scale=0.02, amp=15)   — 언덕/요철
  Layer 3: 디테일 (octave=6, scale=0.08, amp=3)    — 미세 굴곡

height(x, y) = Σ layers + biome_modifier(x, y)
```

**해상도**: 동적 — `gridSize = ceil(arenaRadius * 2 / CELL_SIZE)`, CELL_SIZE = 50 game px

| Country Tier | 반경 | Grid Size | 셀 수 | gzip 전송 크기 |
|-------------|------|-----------|-------|---------------|
| S (Superpower) | 6000 | 240x240 | 57,600 | ~50KB |
| A (Major) | 4500 | 180x180 | 32,400 | ~30KB |
| B (Regional) | 3500 | 140x140 | 19,600 | ~18KB |
| C (Standard) | 2500 | 100x100 | 10,000 | ~8KB |
| D (Minor) | 1500 | 60x60 | 3,600 | ~3KB |

**높이 범위**: -5 (수면 아래) ~ +60 (산꼭대기) game units
**수면 레벨**: 0 (기본 지면 = 5, 수면 아래가 있으면 물)

**서버-클라이언트 동기화 (gzip 직접 전송 방식):**
1. 서버가 아레나 생성 시 Perlin Noise로 heightmap float32 배열 생성
2. heightmap + obstacleGrid를 gzip 압축 (C tier ~8KB, S tier ~50KB)
3. `joined` 이벤트에 `terrainData` (base64-encoded gzip) 포함
4. 클라이언트가 디코딩 → Float32Array로 복원
5. 양쪽 모두 `getHeight(x, y)` → bilinear interpolation으로 정밀 높이 조회
6. **100% 동기화 보장** — Go/JS 부동소수점 크로스 플랫폼 오차 제거

> **시드 기반 대안**: 향후 최적화로 검토 가능 (테스트 벡터 100개 이상 교차 검증 필수)

#### 바이옴 구역제

한 아레나에 2~3개 바이옴이 공존 (현재는 1 아레나 = 1 테마):

```
아레나를 Voronoi 셀로 분할:
  - 3~5개 시드 포인트 랜덤 배치
  - 각 시드에 바이옴 타입 할당 (forest, desert, mountain, urban, arctic, island)
  - 경계: 부드러운 블렌딩 (50px transition zone)

바이옴별 heightmap modifier:
  forest:   기본 지형 + 완만한 언덕
  desert:   낮고 평탄 + 듄(모래 언덕)
  mountain: 높고 가파름 (높이 x2.5)
  urban:    완전 평탄 (높이 x0.1) + 건물 배치
  arctic:   중간 높이 + 빙하 구조
  island:   수면 아래 영역 많음 + 중앙 화산
```

#### 콜리전 가능 지형 오브젝트

**서버 장애물 그리드 (ObstacleGrid):**
```go
type ObstacleGrid struct {
    cells    [][]ObstacleType   // 50px 셀 단위
    width    int
    height   int
}

type ObstacleType uint8
const (
    Empty    ObstacleType = 0
    Tree     ObstacleType = 1  // 통과 불가, 파괴 가능
    Rock     ObstacleType = 2  // 통과 불가, 파괴 불가
    Building ObstacleType = 3  // 통과 불가, 부분 파괴
    Water    ObstacleType = 4  // 통과 가능 (감속)
    Bush     ObstacleType = 5  // 통과 가능 (은신)
    Shrine   ObstacleType = 6  // 기존 MapStructures — XP Shrine
    Spring   ObstacleType = 7  // 기존 MapStructures — Healing Spring
    Altar    ObstacleType = 8  // 기존 MapStructures — Upgrade Altar
)
```

**바이옴별 오브젝트 분포:**

| 바이옴 | 나무 | 바위 | 건물 | 수역 | 수풀 |
|--------|------|------|------|------|------|
| Forest | 40~60 | 10~15 | 0 | 1~2 호수 | 30~40 |
| Desert | 5~10 선인장 | 20~30 | 3~5 폐허 | 0~1 오아시스 | 5~10 |
| Mountain | 15~25 침엽수 | 30~40 | 0 | 2~3 계곡 물 | 10~15 |
| Urban | 0 | 0 | 20~30 | 0 | 0 |
| Arctic | 0 | 15~20 빙하 | 2~3 이글루 | 1~2 얼음 호수 | 0 |
| Island | 10~15 야자수 | 5~10 | 0 | 해안선 전체 | 15~20 |

**에이전트 충돌 처리 (서버):**
```
MoveAgent() 수정:
  1. 새 위치 계산: newX, newY = pos + heading * speed * dt
  2. ObstacleGrid.Query(newX, newY) 확인
  3. 장애물 셀이면:
     - 슬라이딩: X축/Y축 분리 시도 (벽 타기)
     - 둘 다 막히면: 정지
  4. 수역이면: speed *= 0.5
  5. 높이 변화: abs(newHeight - curHeight) > CLIMB_MAX(10) 이면 이동 불가 (절벽)
```

#### 수역 시스템

```
수면 높이 = 0 (게임 유닛)
물 깊이 = max(0, waterLevel - heightmap(x, y))

이동 효과:
  깊이 0~2:  걸어서 건너기 (속도 70%)
  깊이 2~5:  수영 (속도 50%, 수영 애니메이션)
  깊이 5+:   깊은 물 (속도 30%, 점진적 HP 감소)

시각 효과:
  - ShaderMaterial 반투명 수면 (법선 맵 애니메이션)
  - 수중 에이전트 처리 (InstancedMesh 개별 클리핑 불가하므로 대안):
    → 수심에 비례해 에이전트 전체 Y offset 내림 (수면에 상체만 노출)
    → 수면 높이에 스플래시 파티클 레이어로 시각적 차폐
    → 반투명 수면 PlaneGeometry가 자연스럽게 하체를 가림
  - 입수/이탈 시 스플래시 파티클
```

#### 클라이언트 지형 렌더링

```
현재: VoxelTerrain (BoxGeometry 개별 블록)
변경: PlaneGeometry + displacement

1. PlaneGeometry(arenaSize, arenaSize, gridRes, gridRes)
2. 각 vertex.y = getHeight(vertex.x, vertex.z)
3. 바이옴별 vertex color (Voronoi 영역에 따라)
4. MeshLambertMaterial({ vertexColors: true })
5. 장애물: InstancedMesh (나무, 바위, 건물 각각)
6. 물: 별도 PlaneGeometry at y=0, transparent shader

LOD (카메라-오브젝트 3D 거리 기준, world units):
  - 카메라 거리 < 15: 풀 디테일 (모든 장식, 풀, 꽃)
  - 15~50: 지형 + 주요 장애물 (나무, 바위, 건물)
  - 50+: 지형 메시만 (장식 InstancedMesh frustum cull)
```

### 6.4 부가 시스템 (사용자 미고려 영역)

사용자가 언급하지 않았지만 게임 경험에 큰 영향을 미치는 시스템들:

#### 6.4.1 사운드 시스템

현재 게임에 **소리가 전혀 없음** — 가장 큰 몰입감 저하 요인.

**사운드 카테고리:**

| 카테고리 | 소리 | 트리거 |
|---------|------|--------|
| 발걸음 | grass_step, sand_step, stone_step, water_splash, snow_crunch | 이동 시 바이옴별 |
| 전투 | hit_melee, hit_ranged, shield_block, critical_hit, death_cry | 전투 이벤트 |
| 환경 | wind_loop, rain_loop, bird_ambient, fire_crackle | 바이옴/날씨별 |
| UI | level_up_chime, orb_collect, ability_ready, countdown_tick | 게임 이벤트 |
| 음악 | lobby_bgm, combat_bgm, tension_bgm, victory_fanfare | 게임 상태별 |

**기술 구현:**
- Howler.js (3D positional audio 지원)
- AudioSprite 형식 (단일 파일에 모든 효과음, JSON 매핑)
- 거리 감쇠: 200px 이내만 재생
- 발걸음: 이동 속도 동기화 (walkCycle에 맞춰 트리거)
- 사운드 풀링: 동시 재생 최대 16개
- **에셋 출처**: kenney.nl/assets (CC0, 8-bit/pixel 스타일 — MC 테마와 일치), freesound.org (CC0 검색)
- **AI 생성 대안**: ElevenLabs SFX API, Bark (오픈소스 TTS/SFX)

#### 6.4.2 카메라 이펙트

| 이펙트 | 트리거 | 강도 | 지속 |
|--------|--------|------|------|
| 화면 흔들림 | 피격 | mass damage 비례 | 0.2초 |
| 줌 펀치 | 킬 확정 | 1.05x 순간 줌인 | 0.3초 |
| 크로매틱 수차 | 저체력 (<20%) | HP 비례 강도 | 지속 |
| 비네팅 | 부스트 | 0.3 강도 | 부스트 동안 |
| 모션 블러 | 대시 | 방향성 블러 | 대시 동안 |
| 속도선 | 부스트 | 화면 가장자리 라인 | 부스트 동안 |

**구현 (품질 단계별 분리):**
- **PC (High)**: R3F `@react-three/postprocessing` EffectComposer — 크로매틱 수차, 모션 블러, 비네팅
- **모바일 (Low)**: CSS overlay — 비네팅(`radial-gradient`), 속도선(`border` 효과), 카메라 셰이크(position offset만)
- **줌 펀치**: FOV 변경만 (포스트프로세싱 불필요, 모든 기기 지원)
- **설정 메뉴**: "비주얼 효과: Off / Low / High" 옵션 제공

#### 6.4.3 날씨 시스템

바이옴별 날씨 사이클 (5분 주기):

| 바이옴 | 맑음 (60%) | 흐림 (25%) | 극한 (15%) |
|--------|-----------|-----------|-----------|
| Forest | 햇살 | 비 (속도-5%) | 폭풍 (시야-30%) |
| Desert | 열파 | 모래바람 (시야-20%) | 모래폭풍 (시야-50%, 속도-10%) |
| Mountain | 맑음 | 안개 (시야-40%) | 눈보라 (시야-50%, 속도-15%) |
| Urban | 맑음 | 스모그 | 정전 (어둠) |
| Arctic | 맑음 | 눈 | 블리자드 (시야-60%, 속도-20%) |
| Island | 맑음 | 소나기 | 태풍 (시야-40%, 속도-10%) |

**시각 효과:**
- 비: 파티클 시스템 (낙하 + 지면 튀김)
- 안개: Scene fog density 동적 조절
- 눈: 파티클 + 지면 적설 (vertex color 점진 변화)
- 모래폭풍: 방향성 파티클 + 카메라 틴트

**게임플레이 영향**: 서버에서 날씨 상태를 관리하고, speed/vision modifier 적용

**"시야(vision)" modifier 정의:**
- 서버: `VisionMult` (terrain_bonus.go에 이미 필드 존재, 현재 미사용) 활성화
- 클라이언트 구현: **fog distance 동적 조절** — `fog.far = baseFogFar * visionMult`
  - 맑음: fog.far = 500 (기본)
  - 시야-30%: fog.far = 350
  - 시야-60%: fog.far = 200
- 미니맵: vision 비례 범위 축소 (맑음: 전체, 시야-50%: 절반 범위)
- 서버 컬링은 변경 없음 (뷰포트 1920x1080 유지) — 순수 클라이언트 시각 효과

#### 6.4.4 지형 파티클

에이전트 이동 시 바이옴별 발밑 파티클:

| 바이옴 | 파티클 | 색상 | 빈도 |
|--------|--------|------|------|
| Forest | 풀잎 튀김 | 초록 | 걸음마다 |
| Desert | 모래 먼지 | 황갈 | 걸음마다 |
| Mountain | 돌가루 | 회색 | 걸음마다 |
| Urban | — | — | — |
| Arctic | 눈 흩날림 | 백색 | 걸음마다 |
| Water | 물 튀김 | 파랑 | 걸음마다 (수역만) |

기존 MCParticles(500 풀)에 terrain 파티클 타입 추가.

#### 6.4.5 미니맵 지형 표시

현재 미니맵: 에이전트 점만 표시 → 지형 정보 없음.

**개선:**
- heightmap → 256x256 offscreen canvas에 색상 매핑 (낮은=어두운, 높은=밝은)
- 바이옴 경계선 표시
- 수역을 파란색으로
- 장애물을 진한 점으로
- 플레이어 시야 범위 부채꼴 표시

#### 6.4.6 봇 AI 경로 탐색

현재 봇: 직선으로 타겟 추적 → 장애물이 생기면 막힘.

**개선:**
- `NavGrid`: ObstacleGrid에서 이동 가능 셀 추출
- **A* 경로 탐색**: 3초 간격 재계산 + 장애물 접근 시 즉시 재계산, 캐시 보관
- **장애물 회피**: 로컬 회피는 매 틱 (steering behavior)
- **지형 인식**: 높이 보너스를 고려한 전략적 위치 선점
- **수역 회피**: 긴급 상황 아니면 물을 우회

#### 6.4.7 킬캠 / 데스캠

사망 시:
1. 0.3초 타임 프리즈 (클라이언트 보간 일시 정지 — 서버는 계속 20Hz)
2. 카메라가 킬러에게 0.5초간 줌인 (정상 속도)
3. 킬러 주변 공전 1.5초
4. DeathOverlay 표시

> 슬로모션(0.3x) 대신 **타임 프리즈** 사용 — 서버 동기화 문제 없음 (순수 클라이언트 연출)

현재 사망 시 즉시 오버레이만 표시 → 누가 어떻게 죽였는지 체감 없음.

#### 6.4.8 점프 / 수직 이동

```
Space = 점프 (대시는 E 키로 분리됨):
  - 높이: 8 game units (0.5초 체공)
  - 용도: 낮은 장애물 뛰어넘기, 수역 건너뛰기
  - 포물선 궤적: y = jumpVelocity * t - 0.5 * gravity * t²
  - 착지 시 스쿼시 애니메이션 + 지형 파티클
  - 공중에서 이동 속도 80% (약간 제어 가능)
  - 점프 중 오라 DPS 면역 (높이 차로 인해)

서버 처리:
  - Agent에 zPos(높이), zVelocity 필드 추가
  - 매 틱: zPos += zVelocity; zVelocity -= gravity
  - 착지 판정: zPos <= heightmap(x, y)
  - 전투: 높이 차 > 5 이면 오라 DPS 무효
```

---

## 구현 로드맵

### Phase 0: 사전 준비 — 서버/클라이언트 상수 동기화

| Task | 설명 |
|------|------|
| 상수 통일 | ArenaRadius, TurnRate, InitialMass — 서버 Go 값을 마스터로 통일 |
| joined 이벤트 확장 | 아레나 설정 (radius, turnRate, theme, terrainSeed) 동적 전달 |
| ARENA_CONFIG 동적화 | `packages/shared` 하드코딩 → 서버 전달값 우선 사용 |
| 기존 Dash input 연결 | v14 서버 Dash 시스템에 `d` 필드 클라이언트 바인딩 (E 키) |

- **design**: N (설정 동기화)
- **verify**: 서버/클라이언트 상수 일치, E키 대시 작동, 빌드 성공

### Phase 1: 서버 프로토콜 + 이동/조준 분리

| Task | 설명 |
|------|------|
| 서버 input 프로토콜 변경 | `input` 이벤트에 `ma`(moveAngle), `aa`(aimAngle), `j`(jump) 필드 추가, 하위 호환 유지 |
| Agent 구조체 확장 | `Heading` → `MoveHeading` + `AimHeading` 분리 (ZPos/ZVelocity는 Phase 4로 이동) |
| ApplyInput / UpdateAgent 수정 | moveAngle→이동, aimAngle→facing 분리 처리 |
| 상태 직렬화 변경 | `AgentNetworkData`에 `f`(facing = aimAngle) 필드 추가 |
| 클라이언트 interpolation 수정 | facing 보간 추가 (zPos는 Phase 4) |

- **design**: N (서버 로직 중심)
- **verify**: 기존 input 하위 호환 + 새 필드 전달 확인, 빌드 성공

### Phase 2: WASD + TPS 카메라

| Task | 설명 |
|------|------|
| InputManager 구현 | WASD 키 입력 → 카메라 기준 moveAngle 변환, 마우스 레이캐스트 → aimAngle |
| TPSCamera 구현 | Spherical 좌표 오비탈 카메라, 우클릭 드래그 회전, 스크롤 줌 |
| PlayCamera 교체 | 기존 PlayCamera를 TPSCamera로 교체, 지형 클리핑 방지 |
| GameCanvas3D 입력 교체 | 인라인 이벤트 핸들러 → InputManager 훅으로 교체 |
| 클라이언트 예측 수정 | moveAngle 기반 위치 예측, aimAngle 기반 facing 예측 |

- **design**: N (입력/카메라 로직)
- **verify**: WASD 이동 + 마우스 카메라 회전 + 조준 분리 동작 확인, 클라이언트 예측 오차 < 5px (moveAngle + aimAngle 이중 보간)

### Phase 3: 캐릭터 애니메이션 강화

| Task | 설명 |
|------|------|
| 속도 동기화 | walkCycle 속도를 실제 agent speed에 연동 |
| 상/하체 분리 | 하체 = moveAngle, 상체 = aimAngle 기준 회전 |
| 2차 모션 레이어 | 관성 지연 (상체 lag), 머리 추적, 장비 흔들림 (spring) |
| 개성 파라미터 | per-agent variation (armSwing, stride, idleQuirk, bodyType 반영) |
| DODGE_ROLL 상태 추가 | 대시 시 구르기 모션, 0.4초 one-shot |

- **design**: N (애니메이션 코드)
- **verify**: 60 에이전트에서 자연스러운 모션 확인, 60fps 유지

### Phase 4: Heightmap 지형 시스템

| Task | 설명 |
|------|------|
| 서버 HeightmapGenerator | Perlin Noise → 동적 grid heightmap 생성, getHeight(x,y) bilinear interpolation |
| Heightmap gzip 전송 | joined 이벤트에 base64 gzip heightmap + obstacleGrid 포함 |
| Agent ZPos/ZVelocity 추가 | 서버 Agent 구조체에 ZPos, ZVelocity 필드 추가 (Phase 1에서 분리), AgentNetworkData에 `z` 필드 |
| 서버 이동 로직 수정 | 높이 차 이동 제한 (절벽), 경사 속도 감소 |
| 클라이언트 HeightmapTerrain | PlaneGeometry + vertex displacement, 바이옴별 vertex color |
| VoxelTerrain 교체 | 기존 VoxelTerrain → HeightmapTerrain 교체 |
| 에이전트 높이 동기화 | AgentInstances에서 zPos + heightmap(x,y) → Y 좌표 |

- **design**: N (지형 알고리즘)
- **verify**: gzip 전송 heightmap 디코딩 정상, 에이전트가 지형 위를 걸음, zPos 보간 동작

### Phase 5: 바이옴 + 장애물 시스템

| Task | 설명 |
|------|------|
| 바이옴 Voronoi 분할 | 3~5 시드 포인트 → 바이옴 영역 할당, transition zone 블렌딩 |
| 바이옴별 heightmap modifier | forest=완만, mountain=가파름, desert=듄, urban=평탄 등 |
| 서버 ObstacleGrid | 2D boolean grid, 바이옴별 장애물 분포 생성 |
| 서버 충돌 처리 | MoveAgent에 장애물 충돌 + 슬라이딩 추가 |
| 클라이언트 장애물 렌더링 | 바이옴별 InstancedMesh (나무, 바위, 건물, 수풀) |
| 수역 시스템 | 수면 셰이더, 수영 감속, 깊이별 효과 |
| 기존 MapStructures 통합 | XP Shrine, Healing Spring, Upgrade Altar을 ObstacleGrid에 등록, 기존 map_objects.go와 연동 |
| 봇 AI A* 경로 탐색 | NavGrid 생성, A* 3초 간격 재계산 + 장애물 접근 시 즉시 재계산, 로컬 steering |

- **design**: Y (바이옴별 비주얼 디자인)
- **verify**: 장애물 충돌 작동, 바이옴 시각 구분, 봇 장애물 회피, 기존 MapStructures 정상 동작

### Phase 6: 지형 반응 애니메이션

| Task | 설명 |
|------|------|
| 경사 기울기 | heightmap gradient → 상체 기울임 (±15°) |
| 수영 모션 | 수역 진입 시 하체 숨김 + 팔 수영 모션 전환 |
| 바이옴 발밑 파티클 | 걸음마다 바이옴별 파티클 (풀잎, 모래, 돌가루, 눈) |
| 점프 물리 | Space → 포물선 점프, 착지 스쿼시, 공중 오라 면역 |
| 높이 전투 보너스 | 서버: 고지대 +10% DPS, 클라이언트: 높이 차 시각화 |

- **design**: N (애니메이션/물리)
- **verify**: 경사면 기울기, 수영 전환, 점프 물리 정상 동작

### Phase 7: 사운드 + 카메라 이펙트

| Task | 설명 |
|------|------|
| 사운드 에셋 준비 | kenney.nl (CC0) 8-bit SFX 수집, AudioSprite 패킹, BGM 루프 준비 |
| SoundEngine 구현 | 하이브리드: Howler.js (UI/BGM) + drei PositionalAudio (공간 SFX), 풀링 16개 |
| 발걸음 사운드 | 바이옴별 발걸음 (walkCycle 동기), 수영 스플래시 |
| 전투 사운드 | 피격, 사망, 레벨업, 오브 수집, 능력 발동 |
| 환경 BGM/앰비언스 | 바이옴별 루프, 전투 긴장 BGM 전환 |
| 카메라 셰이크 | 피격/킬 시 화면 흔들림, 줌 펀치 |
| 포스트프로세싱 | PC: EffectComposer (크로매틱 수차, 모션 블러). 모바일: CSS overlay (비네팅, 속도선). 설정 Off/Low/High |

- **design**: N (사운드/이펙트 코드)
- **verify**: 사운드 재생 확인, 카메라 이펙트 60fps 유지

### Phase 8: 날씨 + 미니맵 + 킬캠

| Task | 설명 |
|------|------|
| 서버 날씨 상태 | 5분 주기 날씨 전환, speed/vision modifier, 클라이언트 동기 |
| 날씨 비주얼 | 비/눈/모래 파티클, 안개 동적 조절, 번개 플래시 |
| 미니맵 지형 오버레이 | heightmap → 색상맵, 바이옴 경계, 수역, 장애물 표시 |
| 킬캠 시스템 | 사망 → 킬러 줌인 0.5초 (슬로모) → 공전 2초 → DeathOverlay |
| 파괴 가능 환경 | 나무/상자 HP, 공격으로 파괴, 드롭 아이템, 서버 동기화 |
| 모바일 듀얼 조이스틱 | 왼쪽=이동, 오른쪽=조준, 부스트/대시 버튼 |

- **design**: Y (날씨 비주얼, 모바일 UI)
- **verify**: 날씨 효과 표시, 미니맵 지형 가독성, 킬캠 재생, 모바일 조작
