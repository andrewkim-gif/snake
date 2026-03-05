# Snake Arena v8 — Full 3D Transformation

> **버전**: v8.0 (Minecraft-Style 3D + Spectator Mode)
> **작성일**: 2026-03-05
> **상태**: Draft (Updated)
> **기반**: v7 Multi-Room Tournament

---

## 1. Overview

현재 Snake Arena는 **HTML5 Canvas 2D** 기반 멀티플레이어 게임.
v8에서는 **React Three Fiber (R3F)** 기반 **마인크래프트 스타일 복셀 3D**로 전환하여
복셀 기반 뱀, 블록 월드, **관전(Spectator) 모드**를 포함한 완전한 3D 경험을 제공합니다.

### 핵심 원칙
- **서버 변경 최소화**: 서버는 2D 시뮬레이션 유지, 3D는 순수 클라이언트 렌더링 (관전 모드만 서버 추가)
- **네트워크 변경 최소화**: Position `{x, y}` → Three.js `Vector3(x, 0, z)` 매핑 + `spectate` 이벤트 추가
- **마인크래프트 비주얼**: 복셀 기반 뱀 + 블록 지형 + 픽셀 텍스처 + 앰비언트 오클루전
- **관전 모드**: 사망 후 또는 로비에서 프리 카메라로 실시간 관전 가능

### 핵심 변경
| AS-IS (v7) | TO-BE (v8) |
|------------|------------|
| HTML5 Canvas 2D | React Three Fiber 3D WebGL |
| 크레용/스케치 스타일 | **마인크래프트 복셀 스타일** |
| 탑다운 평면 뷰 | 틸트 퍼스펙티브 + **관전 프리캠** |
| 2D 원형 세그먼트 뱀 | **복셀 큐브 체인 뱀** |
| Canvas 그리드 배경 | **복셀 블록 지형 + 환경 오브젝트** |
| 사망 → 즉시 리스폰 | 사망 → **관전 모드 선택** → 리스폰 |
| 관전 없음 | **풀 Spectator 모드** (프리캠/플레이어 팔로우) |

---

## 2. Technology Stack Decision

### 2.1 3D 엔진 비교 평가

| 기준 | Three.js | Babylon.js | R3F | PlayCanvas | Threlte |
|------|----------|------------|-----|------------|---------|
| React 통합 | Poor (명령형) | Weak | **Native** | None | None (Svelte) |
| 번들 크기 | ~150KB | ~500KB+ | ~160KB (+Three) | ~300KB | ~160KB (+Three) |
| 뱀 렌더링 (Tube) | Excellent | Good | **Excellent** | Good | Good |
| 커스텀 셰이더 | Full GLSL | Node + GLSL | Full GLSL (via Three) | GLSL | Full GLSL |
| 커뮤니티 | **최대** | Large | Very Large | Medium | Small |
| 팀 학습 곡선 | Medium | High | **Low** (React 기반) | Very High | Very High |
| 모바일 성능 | Good | Good | Good (= Three.js) | Best | Good |

### 2.2 최종 결정: React Three Fiber (R3F)

**선정 근거:**
1. **Next.js + React 아키텍처 그대로 유지** — 프론트엔드 재작성 불필요
2. **"There is no overhead"** — R3F는 React 렌더러이지 래퍼가 아님
3. **useFrame 훅** — requestAnimationFrame 루프를 React 방식으로 제공
4. **drei 에코시스템** — InstancedMesh, AdaptiveDpr, PerformanceMonitor 등 즉시 사용
5. **Three.js 전체 접근** — ref를 통해 임페러티브 Three.js도 필요시 사용 가능
6. **TypeScript 완벽 지원** — 기존 타입 시스템과 호환

### 2.3 핵심 패키지

| 패키지 | 용도 | 크기 (gzip) |
|--------|------|-------------|
| `three` | 3D 엔진 코어 | ~150KB |
| `@react-three/fiber` | React ↔ Three.js 바인딩 | ~15KB |
| `@react-three/drei` | 유틸 (InstancedMesh, Camera, Html 등) | 필요분만 |
| `@react-three/postprocessing` | AO, pixelation, Vertex AO | ~40KB |
| `@types/three` | TypeScript 타입 | dev only |

**추가 번들 예상: ~200KB gzipped** (3D 게임으로서 매우 합리적)

---

## 3. Architecture: What Changes vs What Stays

### 3.1 변경 없음

```
apps/server/src/game/   — Arena, Snake, CollisionSystem, SpatialHash, OrbManager 등 100% 유지
packages/shared/        — 기존 타입/상수 유지 (관전 이벤트만 추가)
components/lobby/       — 로비 UI 유지 (관전 버튼 추가)
components/game/RoundTimerHUD.tsx     — 유지
components/game/CountdownOverlay.tsx  — 유지
components/game/RoundResultOverlay.tsx — 유지
```

### 3.1.1 서버 소폭 추가 (관전 모드)

```
apps/server/src/network/SocketHandler.ts — spectate_room / stop_spectate 이벤트 추가
packages/shared/src/types/events.ts     — SpectateEvents 타입 추가
```

> 관전자는 서버에서 "입력 없는 플레이어"가 아닌 **별도 spectator 목록**으로 관리.
> 관전자에게는 `state` 이벤트를 뷰포트 컬링 없이 전체 맵 데이터로 전송 (선택적 최적화).

### 3.2 교체 대상 (클라이언트 렌더링만)

| 현재 (2D) | 3D 대체 | 비고 |
|-----------|---------|------|
| `components/game/GameCanvas.tsx` | `components/game/GameCanvas3D.tsx` | R3F `<Canvas>` 컴포넌트 |
| `lib/renderer/index.ts` | `components/3d/Scene.tsx` | R3F 씬 루트 |
| `lib/renderer/background.ts` | `components/3d/VoxelTerrain.tsx` | 복셀 블록 지형 |
| `lib/renderer/entities.ts` | `components/3d/VoxelSnake.tsx` + `VoxelOrbs.tsx` | 복셀 큐브 기반 |
| `lib/renderer/ui.ts` | HTML 오버레이 유지 (drei `<Html>`) | HUD는 DOM으로 |
| `lib/camera.ts` | `components/3d/CameraSystem.tsx` | 플레이 + 관전 카메라 |
| `lib/interpolation.ts` | 로직 재사용 (useFrame 내) | 보간 수학은 동일 |
| — (없음) | `components/3d/SpectatorControls.tsx` | **NEW**: 관전 모드 UI+조작 |
| `components/game/DeathOverlay.tsx` | `components/game/DeathOverlay.tsx` | 리스폰 or 관전 선택 추가 |

### 3.3 새로운 디렉토리 구조

```
apps/web/
├── components/
│   ├── game/           # 기존 오버레이 + 관전 UI
│   │   ├── GameCanvas3D.tsx    # NEW: R3F Canvas 래퍼
│   │   ├── DeathOverlay.tsx    # 수정: 리스폰 + 관전 선택
│   │   ├── SpectatorHUD.tsx    # NEW: 관전 모드 UI (플레이어 목록/카메라 컨트롤)
│   │   └── ...existing...
│   ├── 3d/             # NEW: 마인크래프트 스타일 3D
│   │   ├── Scene.tsx           # 씬 루트 (조명, 안개, 하늘)
│   │   ├── CameraSystem.tsx    # 플레이 카메라 + 관전 카메라 통합
│   │   ├── VoxelTerrain.tsx    # 복셀 블록 지형 (잔디/흙/돌)
│   │   ├── VoxelBoundary.tsx   # 베드록 벽 경계
│   │   ├── VoxelSnake.tsx      # 복셀 큐브 체인 뱀
│   │   ├── VoxelSnakeHead.tsx  # 뱀 머리 (마크 스타일 얼굴 텍스처)
│   │   ├── VoxelOrbs.tsx       # 복셀 큐브 아이템 (InstancedMesh)
│   │   ├── VoxelDecor.tsx      # 환경 장식 (나무, 꽃, 버섯 등)
│   │   ├── SkyBox.tsx          # 마크 스타일 하늘
│   │   ├── Effects.tsx         # AO, 안개, 픽셀화 포스트프로세싱
│   │   └── DeathParticles.tsx  # 사망 시 복셀 파편 폭발
│   └── lobby/          # 소폭 수정 (관전 버튼 추가)
├── lib/
│   ├── shaders/        # NEW: 마인크래프트 셰이더
│   │   ├── voxel-ao.vert/frag          # 앰비언트 오클루전
│   │   └── pixelate.frag               # 픽셀화 포스트프로세싱
│   ├── 3d/             # NEW: 3D 유틸리티
│   │   ├── voxel-geometry.ts           # 복셀 큐브 생성/최적화
│   │   ├── voxel-textures.ts           # 텍스처 아틀라스 관리
│   │   ├── spectator-camera.ts         # 관전 카메라 로직
│   │   └── lod.ts                      # LOD 레벨 계산
│   └── renderer/       # 기존 유지 (2D 폴백용)
└── app/
    └── page.tsx        # 수정 (GameCanvas3D + 관전 모드 라우팅)
```

### 3.4 좌표 매핑

```typescript
// 서버 2D → 클라이언트 3D 매핑
// 서버: Position { x: number, y: number }
// 클라이언트: THREE.Vector3(x, HEIGHT, z)

function toWorld(pos: Position): THREE.Vector3 {
  return new THREE.Vector3(pos.x, 0, pos.y)  // y → z (지면)
}

// Three.js Y축 = 높이 (항상 0, 지면 위 오브젝트는 약간 올림)
// Three.js X축 = 서버 X축 (동일)
// Three.js Z축 = 서버 Y축 (매핑)
```

---

## 4. Minecraft Voxel Rendering Strategy

### 4.1 뱀 렌더링: 복셀 큐브 체인

```
세그먼트 배열 → 각 세그먼트 = 1×1×1 큐브 → InstancedMesh
```

- **뱀 몸통**: 각 세그먼트를 **정육면체(BoxGeometry)** 로 렌더링
- **큐브 크기**: 기본 1×1×1 유닛, mass에 따라 스케일 (작은 뱀 0.8, 큰 뱀 1.2)
- **인스턴싱**: 동일 스킨의 뱀 세그먼트는 InstancedMesh로 배칭 (드로우콜 절감)
- **회전**: 각 세그먼트는 다음 세그먼트를 향해 Y축 회전 → 자연스러운 방향 전환
- **머리**: 약간 큰 큐브 (1.2×1.2×1.2) + **마크 스타일 얼굴 텍스처** (정면에 눈+입 UV맵)
- **꼬리**: 점진적 크기 감소 (0.9 → 0.7 → 0.5) → 마크 엔더드래곤 꼬리 느낌
- **텍스처**: 16×16 픽셀 텍스처 아틀라스 (스킨별 색상 변형)

### 4.2 오브 렌더링: 복셀 아이템 블록

```
1000+ 오브 → 단 1회 드로우콜 (InstancedMesh, BoxGeometry)
```

- **기하**: BoxGeometry(0.6, 0.6, 0.6) — 작은 정육면체
- **인스턴싱**: 전체 오브를 1개 InstancedMesh로 배칭
- **Y축 회전**: 매 프레임 천천히 회전 (마크 드랍 아이템처럼)
- **Y축 부유**: sin(time) * 0.1 → 위아래 살짝 부유
- **오브 타입**: 색상+텍스처로 구분 (다이아=파랑, 에메랄드=초록, 금=노랑, 레드스톤=빨강)

### 4.3 복셀 지형 & 경계

- **바닥**: 잔디 블록 타일 (상단=초록, 측면=흙갈색, 16×16 텍스처)
- **지형 변형**: 아레나 중심부 평탄, 외곽은 약간 높낮이 (1-2블록 고도차)
- **장식**: 나무, 꽃, 버섯, 횃불 → InstancedMesh로 배치 (마크 평원 바이옴 느낌)
- **경계**: **베드록 벽** (3블록 높이) + 상단 울타리 → 아레나 테두리
- **하늘**: 그라디언트 하늘 (연한 파랑 → 흰색) + 박스형 구름 (마크 구름 스타일)

### 4.4 드로우콜 예산

| 요소 | 드로우콜 | 버텍스 | GPU 부하 |
|------|---------|--------|---------|
| 20 뱀 (InstancedMesh 큐브) | 1-4 (스킨 그룹) | ~24K | Low |
| 1000 오브 (InstancedMesh) | 1 | ~6K | Very Low |
| 지형 타일 (InstancedMesh) | 1-3 | ~10K | Low |
| 장식 오브젝트 | 2-4 | ~5K | Low |
| 경계 벽 | 1 | ~2K | Negligible |
| 하늘/구름 | 2 | ~1K | Negligible |
| HUD (HTML 오버레이) | 0 (DOM) | 0 | Negligible |
| 포스트 프로세싱 (안개) | 0-1 | fullscreen | Low (AO는 vertex-color) |
| **합계** | **~15** | **~48K** | **낮음** |

> InstancedMesh 활용으로 수천 개 큐브도 드로우콜 최소화. 마크 스타일의 단순한 기하이므로 성능 여유 충분.

---

## 5. Minecraft Visual System

마인크래프트의 핵심 비주얼 요소를 WebGL로 재현합니다.

### 5.1 텍스처 시스템

**16×16 픽셀 텍스처 아틀라스:**
- 모든 블록 텍스처를 하나의 아틀라스(256×256)에 패킹
- `THREE.NearestFilter` (매그/민 필터) → 픽셀이 선명하게 보이는 마크 특유의 룩
- UV 좌표로 아틀라스 내 개별 텍스처 참조

```typescript
// 마크 스타일 픽셀 텍스처 설정
texture.magFilter = THREE.NearestFilter  // 확대 시 픽셀 유지 (핵심!)
texture.minFilter = THREE.NearestFilter
texture.generateMipmaps = false
```

**텍스처 종류:**
| 블록 | 상단 | 측면 | 하단 |
|------|------|------|------|
| 잔디 | 초록 픽셀 | 흙+잔디 | 흙 |
| 돌 | 회색 픽셀 | 회색 픽셀 | 회색 픽셀 |
| 베드록 | 암흑 패턴 | 암흑 패턴 | 암흑 패턴 |
| 뱀 몸통 | 스킨색 | 스킨색+패턴 | 스킨색 |
| 뱀 머리 | 스킨색 | **눈+입 얼굴** | 스킨색 |

### 5.2 라이팅 & 앰비언트 오클루전

**마크 스타일 라이팅:**
- `DirectionalLight` (태양) — 약간 기울어진 각도, 부드러운 그림자
- `AmbientLight` — 기본 밝기 (어두운 면도 완전히 까맣지 않게)
- **Face-based shading**: 각 큐브 면의 방향에 따라 밝기 차등 (마크 기본 셰이딩)
  - 상단: 100% / 측면(남북): 80% / 측면(동서): 60% / 하단: 50%

**간단 AO (Ambient Occlusion):**
- 블록 접합부에 어두운 그림자 → 깊이감
- 버텍스 컬러로 구현 (셰이더 불필요, 성능 최적)

### 5.3 안개 & 하늘

- **거리 안개**: `THREE.Fog` — 먼 거리 점진적 페이드아웃 (마크 기본 안개)
- **하늘**: 그라디언트 또는 BoxGeometry 스카이박스 (연한 파랑 → 흰색)
- **구름**: 흰색 플랫 BoxGeometry 그룹 → 천천히 이동

### 5.4 포스트 프로세싱

| 효과 | 용도 | 성능 비용 |
|------|------|---------|
| Per-Vertex AO (마크 방식) | 블록 접합부 음영 (런타임 비용 0) | None |
| 안개 | 원거리 페이드아웃 | Negligible (built-in) |
| 선택적 Pixelation | 저해상도 레트로 느낌 (옵션) | Low |

### 5.5 스킨 시스템 (복셀 버전)

기존 24종 스킨을 복셀 큐브 텍스처로 변환:
- **primaryColor** → 큐브 본체 색상 (16×16 텍스처의 주요 픽셀 색)
- **secondaryColor** → 패턴 색상 (줄무늬, 점박이 등 텍스처 패턴)
- **eyeStyle** → 머리 정면 텍스처의 눈 디자인 (6종 유지)
- **pattern** → 몸통 큐브 텍스처 패턴 (solid, striped, dotted, checkered)

> **핵심 인사이트**: 마인크래프트 스타일은 **16×16 픽셀 텍스처 + NearestFilter + BoxGeometry**
> 3가지 조합으로 달성. 커스텀 셰이더 없이도 90% 완성되며, AO만 추가하면 충분.

---

## 6. Camera System (Play + Spectator)

### 6.1 플레이 카메라: 틸트 탑다운 퍼스펙티브

```
PerspectiveCamera (fov: 55°)
위치: 플레이어 뒤쪽 + 위쪽 (약간 비스듬히)
각도: 수평에서 ~55° 기울임
LookAt: 플레이어 진행 방향 약간 앞
```

- 기존 `lib/camera.ts`의 lerp 추적 + 동적 줌 로직을 그대로 재사용

| 상황 | 카메라 동작 |
|------|-----------|
| 일반 이동 | 부드러운 추적 (lerp 0.05) |
| 부스트 중 | 줌아웃 + 약간 위로 (속도감) |
| 몸집 커짐 | 점진적 줌아웃 (더 넓은 시야) |
| 사망 순간 | 슬로우 줌아웃 → 관전 전환 프롬프트 |

### 6.2 관전(Spectator) 카메라 — 3가지 모드

#### Mode A: 프리캠 (Free Camera)
```
마인크래프트 크리에이티브 모드 비행과 동일한 조작감
WASD = 수평 이동, Space/Shift = 상승/하강
마우스 드래그 = 시점 회전, 스크롤 = 이동 속도 조절
```
- 아레나 전체를 자유롭게 날아다니며 관전
- 이동 범위: 아레나 경계 + 상공 50블록까지
- 이동 속도: 기본 200u/s, 스크롤로 50~500u/s 조절

#### Mode B: 플레이어 팔로우 (Follow Cam)
```
특정 플레이어를 선택하면 해당 뱀의 뒤를 따라감
플레이 카메라와 동일한 틸트 퍼스펙티브
Tab/클릭으로 다른 플레이어로 전환
```
- 리더보드 상위 플레이어 자동 추천
- 팔로우 중인 플레이어 사망 → 자동으로 1등 전환

#### Mode C: 탑다운 전체 뷰 (Overview)
```
아레나 전체를 위에서 내려다보는 미니맵 확대판
줌 인/아웃으로 범위 조절
```
- 라운드 전체 흐름 파악에 최적
- 마우스 드래그로 패닝

### 6.3 관전 모드 진입 경로

```
┌─────────────┐
│ 사망 화면     │ → [관전하기] → Spectator Mode (Follow → 킬러 자동 팔로우)
│ DeathOverlay │ → [리스폰]   → 즉시 리스폰 (기존 동작)
└─────────────┘

┌─────────────┐
│ 로비          │ → 룸 카드 [👁 관전] → Spectator Mode (Overview 시작)
│ Lobby        │ → 룸 카드 [JOIN]    → 플레이어로 입장 (기존 동작)
└─────────────┘
```

### 6.4 관전 HUD

```
┌──────────────────────────────────────────────┐
│ 👁 SPECTATING                    [Exit]       │
│                                               │
│  [Free] [Follow: PlayerName ▼] [Overview]     │
│                                               │
│  ┌─────────────┐                              │
│  │ Leaderboard │  (클릭 → 해당 플레이어 팔로우) │
│  │ 1. Player1  │                              │
│  │ 2. Player2  │                              │
│  │ 3. Bot_Alex │                              │
│  └─────────────┘                              │
│                                               │
│           [🎮 리스폰하기]  (관전 종료)           │
└──────────────────────────────────────────────┘
```

### 6.5 관전 소켓 프로토콜

| 이벤트 | 방향 | 페이로드 | 설명 |
|--------|------|---------|------|
| `spectate_room` | C→S | `{ roomId }` | 관전 시작 |
| `stop_spectate` | C→S | — | 관전 종료 |
| `spectating` | S→C | `{ roomId, state }` | 관전 확인 + 초기 상태 |
| `state` | S→C | (기존) | 관전자에게도 동일 state 전송 (뷰포트 컬링 완화) |

> 관전자는 서버에서 **spectator 소켓 Set**으로 별도 관리.
> 게임 로직(충돌, 입력)에 영향 ZERO. state 브로드캐스팅만 수신.

---

## 7. Performance & Mobile Optimization

### 7.1 성능 목표

| 플랫폼 | 목표 FPS | 최소 FPS |
|--------|---------|---------|
| 데스크탑 (2020+) | 60fps | 30fps |
| 모바일 (iOS 15+, Android Chrome) | 30fps | 24fps |
| 저사양 모바일 | 폴백 → 2D 렌더러 | - |

### 7.2 자동 품질 조정 (Render Distance)

마인크래프트의 렌더 거리 개념 차용:

```
FPS > 55  → Far (전체 아레나, Vertex AO ON, 장식 ON, 구름 ON)
FPS 30-55 → Normal (렌더 거리 70%, Vertex AO OFF, 장식 감소)
FPS < 30  → Short (렌더 거리 50%, 장식 OFF, 그림자 OFF)
FPS < 20  → Tiny (최소 렌더, 2D 폴백 제안)
```

### 7.3 LOD 전략 (복셀 특화)

```typescript
// 복셀 LOD는 단순: 거리에 따라 렌더 여부만 결정 (큐브는 LOD 불필요)
distance < 500   → 풀 렌더 (뱀 이름태그 표시, 파티클 ON)
distance < 1500  → 큐브 렌더 (이름 숨김, 파티클 OFF)
distance > 1500  → 비표시 (안개로 자연스럽게 페이드아웃)
```

> 복셀의 장점: 큐브 = BoxGeometry 1종류만 사용 → LOD 복잡도 없음.
> 대신 **렌더 거리(안개)**로 품질 조절.

### 7.4 모바일 최적화

- `<AdaptiveDpr>`: 기기 성능에 따라 자동 해상도 조절
- 모바일: Vertex AO OFF, 안개 거리 단축, 장식 오브젝트 50% 감소
- 텍스처 아틀라스 16×16 픽셀 → 이미 극도로 경량 (모바일 최적)
- 터치 조작: 관전 모드에서 두 손가락 핀치=줌, 스와이프=회전
- WebGL context loss 핸들링

### 7.5 물리 엔진: 불필요

현재 충돌 시스템 (`SpatialHash` + `CollisionSystem`)이 커버하는 물리:
- 원-원 충돌 감지 (머리 vs 몸통)
- 원형 아레나 경계
- 각도 기반 이동

→ 모두 **단순 수학** (물리 엔진 오버헤드 불필요)
→ 미래에 폭발/충격파 등 추가 시 Rapier (`@react-three/rapier`) 검토

---

## 8. Migration Plan (Phased)

### Phase 1: 마인크래프트 3D 기본 (1-2주)

**목표**: R3F Canvas + 복셀 뱀/오브/지형 기본 렌더링

1. R3F 패키지 설치 + Next.js SSR 설정 (`dynamic import, ssr: false`)
2. 16×16 픽셀 텍스처 아틀라스 제작 (잔디/돌/베드록/뱀스킨)
3. `GameCanvas3D.tsx` — R3F `<Canvas>` 래퍼
4. `Scene.tsx` — 마크 스타일 조명 (DirectionalLight + AmbientLight + 면별 밝기)
5. `CameraSystem.tsx` — 플레이 카메라 (틸트 퍼스펙티브 + lerp 추적)
6. `VoxelSnake.tsx` — BoxGeometry InstancedMesh 뱀 + 세그먼트 회전
7. `VoxelSnakeHead.tsx` — 머리 큐브 + 얼굴 텍스처
8. `VoxelOrbs.tsx` — 복셀 아이템 (InstancedMesh + 회전 + 부유)
9. `VoxelTerrain.tsx` — 잔디 블록 바닥 타일
10. `VoxelBoundary.tsx` — 베드록 벽 경계
11. `SkyBox.tsx` — 그라디언트 하늘 + 복셀 구름
12. `page.tsx` — GameCanvas3D 연결, 기존 오버레이 유지

### Phase 2: 관전(Spectator) 모드 (1주)

**목표**: 사망 후 관전 + 로비 관전 + 3가지 카메라 모드

13. 서버: `spectate_room` / `stop_spectate` 이벤트 추가 (SocketHandler)
14. 서버: spectator 소켓 Set 관리 + state 브로드캐스트 확장
15. `SpectatorControls.tsx` — 프리캠 WASD + 마우스 컨트롤
16. `CameraSystem.tsx` 확장 — Follow Cam + Overview 모드 추가
17. `SpectatorHUD.tsx` — 모드 전환 UI + 플레이어 목록 + 리스폰 버튼
18. `DeathOverlay.tsx` 수정 — [리스폰] + [관전하기] 선택지
19. 로비 `RoomList.tsx` 수정 — 각 룸에 [👁 관전] 버튼 추가
20. `useSocket.ts` — spectate 이벤트 핸들링 추가

### Phase 3: 비주얼 폴리시 (1주)

**목표**: 마인크래프트 분위기 완성 + 성능 최적화

21. Per-Vertex AO — 블록 접합부 음영 (마크 방식, 런타임 비용 0)
22. 안개 시스템 (THREE.Fog) — 렌더 거리 기반
23. `VoxelDecor.tsx` — 환경 장식 (나무, 꽃, 버섯, 횃불)
24. `DeathParticles.tsx` — 사망 시 복셀 파편 폭발 + 아이템 드랍 이펙트
25. 스킨 시스템 복셀 변환 (24종 → 픽셀 텍스처)
26. `<AdaptiveDpr>` + `<PerformanceMonitor>` + 렌더 거리 자동 조정
27. 모바일 최적화 (Vertex AO 조건부, 장식 감소)
28. 기존 2D 렌더러 폴백 보존

### Phase 4: 확장 기능 (선택)

29. 지형 고도 변형 (외곽 1-2블록 높낮이)
30. 주야 사이클 (5분 라운드 = 하루, 해 위치 변화)
31. 물 블록 지역 (이동 속도 감소 효과)
32. 관전 모드 채팅 (관전자끼리)
33. 뱀 사망 시 묘비 블록 일시적 생성

---

## 9. New Dependencies

```json
{
  "dependencies": {
    "three": "^0.172.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^9.0.0",
    "@react-three/postprocessing": "^3.0.0"
  },
  "devDependencies": {
    "@types/three": "^0.172.0"
  }
}
```

**번들 영향**: +~200KB gzipped (code splitting으로 3D Canvas 지연 로딩)

**텍스처 에셋** (별도 제작 필요):
- `public/textures/atlas.png` — 16×16 블록 텍스처 아틀라스 (256×256)
- `public/textures/snake-skins/` — 24종 뱀 스킨 텍스처
- `public/textures/sky.png` — 스카이박스 (선택)

---

## 10. Risk & Mitigation

| 리스크 | 가능성 | 영향 | 완화 전략 |
|--------|--------|------|----------|
| 모바일 성능 부족 | Medium | High | AdaptiveDpr + 렌더 거리 + PerformanceMonitor 자동 품질 조정 |
| 복셀 텍스처 제작 공수 | Medium | Medium | 16×16 픽셀이므로 도트 수준, AI 생성 도구 활용 가능 |
| R3F + Next.js SSR 충돌 | Low | Low | dynamic import + `ssr: false` (표준 패턴) |
| 번들 크기 증가 (+200KB) | Certain | Low | code splitting, 3D Canvas lazy load |
| 관전자 다수 시 서버 부하 | Medium | Medium | 관전자 state 전송 주기 낮춤 (10Hz→5Hz), 뷰포트 컬링 유지 |
| 관전→플레이 전환 UX 끊김 | Medium | Medium | 카메라 부드러운 전환 애니메이션, 소켓 연결 유지 |
| 프리캠 조작감 어색함 | Medium | Low | 마크 Creative 모드 조작 그대로 차용 (검증된 UX) |
| WebGL context loss (모바일) | Low | Medium | `webglcontextlost` 이벤트 핸들링 + 자동 복구 |
| 기존 2D 기능 회귀 | Medium | High | 2D 렌더러 폴백 보존, A/B 전환 가능 |

---

## 11. Non-Goals (v8 범위 아님)

- 서버 3D 시뮬레이션 (서버는 2D 유지, 관전 이벤트만 추가)
- 네트워크 프로토콜 대규모 변경 (Position은 {x,y} 유지)
- VR/AR 지원
- 외부 3D 모델 파일 (GLTF/GLB) — 모두 BoxGeometry + 텍스처
- 물리 엔진 도입 (기존 충돌 시스템 유지)
- 실시간 월드 편집 (마크의 블록 배치/파괴)
- 관전자 채팅 (Phase 4에서 선택 검토)
- 로비 3D화 (로비는 HTML/React 유지)
- WebGPU 전용 (WebGL2 기반)

---

**Next Step**: `/da:system` → 상세 R3F 컴포넌트 트리, 텍스처 아틀라스 스펙, 관전 모드 시퀀스 설계 → `/da:dev` Phase별 구현

*Generated by DAVINCI /da:plan — 2026-03-05 (Updated: Minecraft Style + Spectator Mode)*
