# PLAN: Arena Experience Critical Fixes (v19)

## 1. 개요

게임 아레나 모드에 진입하면 5가지 심각한 문제가 발생한다:
1. **극심한 프레임 드랍** — 12개 성능 병목 발견
2. **고루틴 구조** — 서버 Go 고루틴은 적절하나, 클라이언트 렌더링이 병목
3. **맵이 MC 블록 지형이 아님** — ARTerrain(평면) 이 MC블록 지형을 가림/덮어씀
4. **ESC 메뉴 디자인 불일치** — 구버전 "sketch" 스타일 (크림색, Patrick Hand 폰트)
5. **ESC 즉시 로비 퇴장** — page.tsx ESC 핸들러가 PauseMenu 없이 바로 퇴장시킴

## 2. 요구사항

### 기능 요구사항
- [FR-1] 아레나 60fps 유지 (현재 추정 15-25fps)
- [FR-2] MC 스타일 블록 지형이 아레나 바닥으로 표시
- [FR-3] ESC → PauseMenu 표시 (Resume / Exit to Lobby)
- [FR-4] PauseMenu가 Dark Tactical 테마로 렌더링
- [FR-5] Exit to Lobby 버튼 클릭 시에만 로비 복귀

### 비기능 요구사항
- [NFR-1] 성능: 60fps @ 20 bots + 100 enemies + radius 80 blocks
- [NFR-2] GC: 프레임 내 객체 할당 zero (useFrame 내 new 금지)

## 3. 근본 원인 분석

### Issue 1: 프레임 드랍 (12개 병목)

| 우선 | ID | 위치 | 문제 | 영향 |
|------|-----|------|------|------|
| P0 | PERF-1 | ARCamera useFrame | `new THREE.Vector3()` 매 프레임 | GC 60회/초 |
| P0 | PERF-2 | ARPlayer JSX | 3개 IIFE → 새 배열 → memo 무효화 | 매 렌더 리렌더 |
| P0 | PERF-3 | ARNameTags | `<Html>` 컴포넌트 × N명 + 개별 useFrame | 20+ DOM overlay + 20+ hooks |
| P1 | PERF-4 | Dual Terrain | ARTerrain + MCTerrain 동시 렌더 | 중복 지오메트리 |
| P1 | PERF-5 | ARTerrain fog | `<fog attach="fog">` 씬 fog 덮어씀 | MC 지형 안보임 |
| P1 | PERF-6 | MCTerrain radius 80 | ~22K 블록 인스턴스 (face cull 없음) | GPU 과부하 |
| P1 | PERF-7 | ARStatusEffects | O(N×M) 선형 탐색 매 프레임 | 20K+ 비교/프레임 |
| P1 | PERF-8 | ARDamageNumbers | useFrame 내 Sprite/Material/텍스처 할당 | GC 전투 중 급증 |
| P2 | PERF-9 | buildMinimapEntities | 렌더마다 새 배열 → ARMinimap memo 무효화 | 불필요한 리렌더 |
| P2 | PERF-10 | Dual rAF loops | R3F 외부 별도 requestAnimationFrame 2개 | CPU 낭비 |
| P2 | PERF-11 | ARTerrain obstacles | 개별 mesh (InstancedMesh 아님) | 추가 draw call |
| P3 | PERF-12 | aliveAgentsForSpectator | Arena 모드에서도 IIFE 실행 | 불필요한 연산 |

### Issue 2: 고루틴 구조 (서버)

서버는 적절한 고루틴 구조:
- Room 당 1개 전용 고루틴 (20Hz tick)
- Hub 1개 채널 기반 고루틴 (lock-free broadcast)
- 클라이언트 당 2개 고루틴 (ReadPump + WritePump)
- WorldManager 3개 백그라운드 고루틴 (broadcast, redis, auto-battle)
- Bot AI: Tactical 2Hz + Reflexive 20Hz (같은 고루틴, 적절한 최적화)

**결론: 서버 고루틴은 정상. 성능 병목은 100% 클라이언트 렌더링.**

### Issue 3: 맵 지형 문제

- ARTerrain: Y=0 평면 + 자체 fog/light → MCTerrain의 fog 덮어씀
- MCTerrain: Y=25~35 MC 블록 → 실제로 생성되지만 ARTerrain fog 때문에 안보임
- ARTerrain이 `<fog attach="fog">` 로 씬 fog를 짧은 거리로 교체 → MC 블록 소멸
- **해법: ARTerrain 제거, MCTerrain만 사용**

### Issue 4: ESC 메뉴 디자인

- 현재: 크림색 배경, 갈색 테두리, Patrick Hand 폰트 (구 sketch 테마)
- 필요: SK.bg (#09090B), SK.accent (#EF4444), Chakra Petch / Black Ops One 폰트

### Issue 5: ESC 동작

- `page.tsx`에 ESC 핸들러가 즉시 `handleExitToLobby()` 호출
- `GameCanvas3D.tsx`에도 ESC 핸들러가 `setMenuOpen()` 토글
- 둘 다 window.addEventListener으로 등록 → **동시 발동**
- **해법: page.tsx ESC 핸들러 제거, GameCanvas3D의 PauseMenu만 사용**

## 4. 기술 방향

- **프레임워크**: React Three Fiber v9 + Three.js r175
- **최적화**: useFrame 내 zero-alloc, InstancedMesh, ref 기반 업데이트
- **지형**: MCTerrain 단독 사용 (ARTerrain 제거)
- **UI**: SK 디자인 토큰 (sketch-ui.ts) 적용
- **폰트**: Chakra Petch (heading) + Space Grotesk (body)

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| ARTerrain 제거 시 obstacles 누락 | 게임플레이 변화 | MCTerrain 나무/돌이 자연 장애물 역할 |
| ARNameTags Html→Sprite 전환 | 텍스트 품질 저하 | Billboard sprite + SDF 텍스트 or troika-three-text |
| face culling 아레나 모드 활성화 | Worker 변경 필요 | 기존 dense 배열 로직 재활용 |

## 구현 로드맵

### Phase 1: 지형 통합 — ARTerrain 제거 + MCTerrain 단독 사용

| Task | 설명 |
|------|------|
| ARTerrain 제거 | GameCanvas3D에서 `<ARTerrain>` 마운트 제거, ARTerrain의 fog/light가 씬 오버라이드하는 문제 해결 |
| MCTerrain arena face culling | `mc-terrain-worker.ts`에서 `useDense = !arenaMode` → `true`로 변경, 아레나 모드에서도 면 제거 최적화 적용 |
| MCTerrain radius 조정 | arenaRadius를 80→50으로 축소 or face cull로 보완. BLOCK_ALLOC_FACTORS 검토 |
| 아레나 바운더리 링 | MCTerrain 위에 반투명 원형 바운더리 표시 (기존 ARTerrain의 빨간 링을 독립 컴포넌트로) |
| Scene fog 검증 | ARTerrain 제거 후 MCScene의 sky-blue fog (0x87ceeb, near=1 far=120)가 정상 적용되는지 확인 |

- **design**: N
- **verify**: 아레나 진입 시 MC 블록 지형 (잔디/돌/나무) 보임, fog 정상, 60fps 이상

### Phase 2: 렌더링 성능 — P0 Critical Fixes

| Task | 설명 |
|------|------|
| ARCamera temp vector | `new THREE.Vector3()` → 재사용 가능한 `useRef(new THREE.Vector3())` |
| ARPlayer ref 기반 props | 3개 IIFE 제거 → `useRef`로 position/rotation/moving 관리, memo가 작동하도록 |
| ARNameTags Html→Sprite | `<Html>` 컴포넌트 → Three.js SpriteMaterial + CanvasTexture (캐시) 또는 troika-three-text Billboard. 개별 useFrame → 단일 useFrame 배치 업데이트 |
| Dual rAF 통합 | GameCanvas3D의 2개 외부 requestAnimationFrame → 단일 useFrame으로 통합 |

- **design**: N
- **verify**: Chrome DevTools Performance 프로파일에서 60fps 안정, GC 이벤트 감소

### Phase 3: 렌더링 성능 — P1 High Priority

| Task | 설명 |
|------|------|
| ARDamageNumbers 풀링 | useFrame 내 Sprite/Material 생성 제거 → 사전 할당 풀 (max 50개) + 텍스처 캐시 Map |
| ARStatusEffects Map 인덱스 | `enemies.find()` → `Map<id, enemy>` 빌드 (per tick), O(1) 조회 |
| buildMinimapEntities 메모 | 렌더 내 호출 → `useRef` + arState 변경 시에만 재계산 |
| aliveAgentsForSpectator 가드 | `isArenaMode` 가드 추가 → arena 모드에서 불필요한 classic 연산 스킵 |

- **design**: N
- **verify**: 전투 중 (적 20+, 데미지 다수) 60fps 유지

### Phase 4: ESC 메뉴 수정 — 디자인 + 동작

| Task | 설명 |
|------|------|
| page.tsx ESC 핸들러 제거 | `mode === 'playing'` 시 ESC 즉시 퇴장 핸들러 삭제 (lines 214-227) |
| PauseMenu Dark Tactical 리디자인 | 크림 배경 → SK.bg (#09090B), Patrick Hand → Chakra Petch, 갈색 → SK.accent (#EF4444) |
| PauseMenu 버튼 | RESUME (primary, SK.accent) + EXIT TO LOBBY (secondary, ghost). SK 디자인 토큰 사용 |
| ESC 토글 검증 | ESC 1회 → 메뉴 표시, ESC 다시 → 메뉴 닫기, EXIT TO LOBBY 클릭 → 로비 복귀 |

- **design**: Y (UI 리디자인)
- **verify**: ESC → PauseMenu 표시 (Dark Tactical 테마), Resume 클릭 → 게임 복귀, Exit 클릭 → 로비 복귀

### Phase 5: 통합 검증

| Task | 설명 |
|------|------|
| 서버 빌드 검증 | `cd server && go build ./...` 에러 없음 |
| 클라이언트 빌드 검증 | `npx tsc --noEmit` 에러 없음 |
| E2E 플레이 테스트 | 로비 → 국가 클릭 → 아레나 진입 → MC 지형 확인 → 봇 전투 → ESC 메뉴 → 로비 복귀 |
| FPS 측정 | Chrome DevTools에서 아레나 모드 60fps 확인 |

- **design**: N
- **verify**: 전체 플로우 정상 동작, tsc 0 에러, go build 0 에러, 60fps 유지
