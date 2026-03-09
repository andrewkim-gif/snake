# Minecraft R3F — 기획의도 및 아키텍처

## 기획의도

### 프로젝트 목적

브라우저에서 실행되는 마인크래프트 스타일 복셀 월드를 React Three Fiber로 구현.
서버 없이 순수 클라이언트사이드로 동작하며, 프로시저럴 터레인 생성과
블록 상호작용(배치/파괴)을 핵심 메카닉으로 제공합니다.

### 핵심 설계 철학

1. **브라우저 네이티브**: 설치 없이 URL 접속만으로 플레이
2. **프로시저럴 생성**: 시드 기반 무한 터레인, 매번 다른 월드
3. **성능 우선**: Web Worker + InstancedMesh + 면 제거 최적화
4. **React 선언적 3D**: Three.js를 직접 다루지 않고 R3F 컴포넌트로 추상화

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────┐
│                  Next.js App                 │
│  ┌───────────────────────────────────────┐  │
│  │            page.tsx (상태 관리)         │  │
│  │  - isPlaying, locked, mode            │  │
│  │  - customBlocks, terrainBlocks        │  │
│  │  - selectedSlot, seed                 │  │
│  └───────────┬───────────────────────────┘  │
│              │                               │
│  ┌───────────▼───────────────────────────┐  │
│  │         R3F Canvas (WebGL)            │  │
│  │  ┌─────────┐  ┌──────────────┐       │  │
│  │  │ MCScene  │  │  MCTerrain   │       │  │
│  │  │ 조명/안개 │  │ 청크 생성/렌더│       │  │
│  │  └─────────┘  └──────┬───────┘       │  │
│  │                      │                │  │
│  │  ┌─────────┐  ┌──────▼───────┐       │  │
│  │  │MCCamera │  │MCBlockInteract│       │  │
│  │  │FPS+물리  │  │  배치/파괴    │       │  │
│  │  └─────────┘  └──────────────┘       │  │
│  └───────────────────────────────────────┘  │
│              │                               │
│  ┌───────────▼───────────────────────────┐  │
│  │       HTML UI 오버레이 (DOM)          │  │
│  │  MCMenu | MCHotbar | MCCrosshair | FPS│  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │
    ┌────▼────┐
    │Web Worker│  ← 오프스레드 터레인 생성
    │mc-terrain│
    │-worker.ts│
    └─────────┘
```

---

## 핵심 시스템 상세

### 1. 터레인 생성 (Procedural Terrain)

**알고리즘**: Perlin 노이즈 기반 높이맵 + 바이옴 분류

```
시드 → Mulberry32 PRNG → ImprovedNoise
  → 높이맵 (다중 옥타브)
  → 바이옴 분류 (Plains / Desert / Forest)
  → 블록 배치 (bedrock → stone → surface → trees)
  → 광석 생성 (coal, diamond)
```

**청크 시스템**:
- 청크 크기: 16x16 블록 (MC_CHUNK_SIZE)
- 렌더 거리: 설정 가능 (MC_RENDER_DISTANCE)
- 카메라 위치 추적 → 새 청크 진입 시 재생성
- Web Worker에서 오프스레드 생성 → 메인 스레드 프레임 드롭 방지

**면 제거 최적화**:
- Dense Uint8Array로 3D 그리드 구성
- 6면 모두 불투명 블록에 둘러싸인 블록 → visible 목록에서 제외
- 렌더 대상 블록 수 60-70% 절감

### 2. 렌더링 (InstancedMesh Batching)

블록 타입별로 하나의 InstancedMesh 사용:
- 14개 블록 타입 → 14개 InstancedMesh
- 각 인스턴스의 위치만 Matrix4로 설정
- GPU 드로우콜 최소화 (14회 vs 수천 회)

머티리얼 시스템:
- MeshLambertMaterial (InstancedMesh용, 성능)
- 텍스처: `/textures/blocks/` PNG + NearestFilter (픽셀 미학)
- 글로벌 캐시 + dispose 관리

### 3. 물리 / 카메라 (FPS Controller)

**PointerLockControls** 기반 마우스 시점:
- 좌우 회전 (yaw) + 상하 회전 (pitch)
- 잠금/해제로 메뉴 전환

**AABB 충돌 검출**:
- 플레이어 = 0.6W × 1.8H 바운딩 박스
- 6방향 (±X, ±Y, ±Z) 독립 검사
- terrainBlocks + terrainIdMap 참조

**물리**:
- 중력: -28 m/s² (MC 느낌)
- 점프: 9.5 m/s 초기속도
- 웅크리기: 이동속도 40% 감소
- 비행모드: 중력 무시, Space/Shift로 상승/하강

### 4. 블록 상호작용

**레이캐스팅**:
- 화면 중앙 (0,0) → Raycaster
- 사정거리: INTERACTION_RANGE (5 블록)
- terrainBlocks InstancedMesh 대상 교차 검사

**배치**: 히트 면 법선 방향으로 +1 오프셋
**파괴**: 히트 블록 좌표 → customBlocks에 AIR 마커 추가
**제한**: 베드락 파괴 불가, 플레이어 위치 배치 불가

### 5. 바이옴 시스템

| 바이옴 | 표면 | 특징 |
|--------|------|------|
| Plains | 잔디 | 평탄, 나무 드문 |
| Desert | 모래 | 건조, 나무 없음 |
| Forest | 잔디 | 울창한 나무 |

바이옴 결정: 별도 노이즈 레이어 (해상도 낮음, 넓은 영역)

---

## 파일별 역할

### 3D 컴포넌트 (`components/3d/`)

| 파일 | 줄수 | 역할 |
|------|------|------|
| MCScene.tsx | 42 | 씬 환경: 하늘색 배경, 안개, 조명 |
| MCTerrain.tsx | 454 | 청크 관리, InstancedMesh 렌더, 구름 |
| MCCamera.tsx | 438 | FPS 카메라, WASD 이동, 충돌, 비행 |
| MCBlockInteraction.tsx | 226 | 레이캐스트 블록 배치/파괴, 하이라이트 |
| MCParticles.tsx | 333 | 파티클 엔진, 오브젝트 풀 (500개) |

### UI 컴포넌트 (`components/mc/`)

| 파일 | 줄수 | 역할 |
|------|------|------|
| MCMenu.tsx | 240 | 시작/일시정지 메뉴, 조작법 표시 |
| MCHotbar.tsx | 136 | 10슬롯 블록 선택 (키/스크롤) |
| MCCrosshair.tsx | 46 | 화면 중앙 십자선 |
| MCFPS.tsx | 57 | FPS 카운터 (rAF 기반) |

### 라이브러리 (`lib/`)

| 파일 | 줄수 | 역할 |
|------|------|------|
| mc-types.ts | 380 | 중앙 타입/상수: 블록, 물리, 월드 |
| mc-noise.ts | 395 | Perlin 노이즈 + 바이옴 + 광석 + 나무 |
| mc-materials.ts | 173 | 머티리얼 팩토리 + 텍스처 캐시 |
| mc-terrain-worker.ts | 332 | Web Worker 청크 생성 + 면 제거 |
| mc-blocks.ts | 267 | 32종 블록 정의 (빌딩 시스템용) |
| mc-texture-atlas.ts | 359 | 프로시저럴 텍스처 아틀라스 생성 |
| minecraft-ui.ts | 87 | UI 디자인 토큰 (색상, 폰트, 그림자) |

---

## 향후 확장 방향

- **멀티플레이어**: WebSocket 서버 추가로 협동/PvP
- **인벤토리**: 확장 블록 관리 + 크래프팅
- **몹/NPC**: AI 동물/적 추가
- **저장/불러오기**: IndexedDB 기반 월드 저장
- **셰이더**: 물, 조명, 그림자 고급 효과
- **모바일**: 터치 컨트롤 추가
- **프로시저럴 구조물**: 마을, 던전 자동 생성

---

## 원본

AI World War 프로젝트에서 마인크래프트 스타일 3D 복셀 시스템만 분리.
원본: https://github.com/andrewkim-gif/snake
