# Verification Report: V38 — Canvas 2D → Three.js 3D Voxel 기획

> **검증일**: 2026-03-11
> **대상 문서**: `v38-3d-voxel-plan.md`, `v38-3d-voxel-roadmap.md`
> **연구 보고서**: `v38-3d-conversion-research.md`

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| Codebase Accuracy | 4 | 2 | 0 | 2 | 0 |
| Roadmap Completeness | 3 | 3 | 0 | 0 | 0 |
| Roadmap Structure | 5 | 0 | 0 | 5 | 0 |
| Tech Feasibility | 4 | 0 | 0 | 4 | 0 |
| da:work Compatibility | 0 | 0 | 0 | 0 | 0 |
| **Total** | **16** | **5** | **0** | **11** | **0** |

**Overall Confidence**: Medium-High (기획 방향은 건전하나, 수치 오류 + 누락 시스템 수정 필요)

---

## 🚨 Critical Issues (5)

<!-- CRITICAL_SECTION -->

### C1: 적 타입 수 오류 — 166 → 173

- **Location**: `v38-3d-voxel-plan.md:33,125,189,194,197,222,284` + `v38-3d-voxel-roadmap.md` 다수
- **Category**: 🔍 Codebase Accuracy
- **Evidence**: `enemies.config.ts` 실제 export 배열 길이 = **173개** 타입
- **Impact**: 에셋 매핑 테이블 불일치, 7개 타입 누락 가능
- **Fix**: 모든 "166" → "173"으로 수정

### C2: MatrixCanvasProps 수 오류 — 68 → 53

- **Location**: `v38-3d-voxel-plan.md:87` ("↓ 68 props")
- **Category**: 🔍 Codebase Accuracy
- **Evidence**: `MatrixCanvas.tsx` 인터페이스 실제 props = **53개**
- **Impact**: MatrixScene 인터페이스 설계 시 잘못된 규모 예측
- **Fix**: "68 props" → "53 props"

### C3: Turret 시스템 로드맵 누락

- **Location**: Roadmap 전체
- **Category**: 🔍 Roadmap Completeness
- **Evidence**: `systems/turret.ts`, `rendering/projectiles/weapons/turret.ts` 존재 확인. Turret은 플레이어가 설치하는 자동 포탑으로, 독립 투사체 + 엔티티 렌더링 필요
- **Impact**: Turret의 3D 모델, 배치 비주얼, 회전 애니메이션, 발사 이펙트가 누락되면 게임 기능 불완전
- **Fix**: Phase 4(Projectiles)에 **S32.5: Turret 3D Rendering** 추가
  - Turret base model (.glb) + rotation animation
  - 배치 시 ground placement indicator
  - 자동 조준 + 발사 이펙트 연동

### C4: Pickup/Item 3D 비주얼 누락

- **Location**: Roadmap 전체
- **Category**: 🔍 Roadmap Completeness
- **Evidence**: `systems/pickup.ts`, `rendering/pickups/` 디렉토리 존재. 경험치 구슬, 아이템 드롭, 보석 등 지상 오브젝트의 3D 렌더링이 로드맵에 없음
- **Impact**: 픽업 아이템이 3D 씬에서 보이지 않으면 게임 코어 루프 불완전
- **Fix**: Phase 2(Terrain) 또는 Phase 4에 **Pickup 3D Rendering** Step 추가
  - XP orb: glowing sphere (InstancedMesh)
  - Item drops: small voxel cube + floating animation + glow
  - Vacuum effect: scale-down + lerp toward player

### C5: S35 의존성 병목 — blocked_by S19 과도

- **Location**: `v38-3d-voxel-roadmap.md:388` (S35 blocked_by: S19)
- **Category**: 🔍 Roadmap Completeness
- **Evidence**: S35(CSS2DRenderer 통합)가 S19(Character 통합 테스트)에 의존하도록 설정됨. 실제로 drei `<Html>` 사용에는 캐릭터 완성이 불필요 — R3F Canvas만 있으면 됨 (S06)
- **Impact**: Phase 6 전체가 Phase 2 완료까지 불필요하게 대기, 크리티컬 패스 2-3주 연장
- **Fix**: S35 `blocked_by: S19` → `blocked_by: S06`

---

## ⚠️ Medium Issues (11)

### M1: systems/ 모듈 수 오류 — 25 → 24

- **Location**: `v38-3d-voxel-plan.md:21`
- **Category**: 🔍 Codebase Accuracy
- **Evidence**: `systems/` 디렉토리 실제 파일 수 = **24개** 모듈
- **Fix**: "25개 모듈" → "24개 모듈"

### M2: update() 끝 줄 번호 미세 오차 — 2914 → 2916

- **Location**: `v38-3d-voxel-roadmap.md:26` ("line 1760-2914")
- **Category**: 🔍 Codebase Accuracy
- **Evidence**: 실제 update() 함수 끝 = line 2916 (±2줄)
- **Fix**: "line 1760-2914" → "line 1760-2916" (minor)

### M3: drei `<Html>` ≠ CSS2DRenderer

- **Location**: `v38-3d-voxel-plan.md:36,63,219` + roadmap 다수
- **Category**: ⚡ Tech Accuracy
- **Evidence**: drei의 `<Html>` 컴포넌트는 **CSS2DRenderer를 사용하지 않음**. 내부적으로 `project()` + CSS transform 기반 자체 구현. "CSS2DRenderer 기반"이라는 표현은 기술적으로 부정확
- **Impact**: 구현 시 혼동 가능성은 낮으나, 문서 정확성 저하
- **Fix**: "CSS2DRenderer 기반" → "drei `<Html>` 기반 (world-to-screen projection)"

### M4: MagicaVoxel → .glb 직접 export 불가

- **Location**: `v38-3d-voxel-plan.md:61` ("MagicaVoxel → .glb export")
- **Category**: ⚡ Tech Accuracy
- **Evidence**: MagicaVoxel은 .vox, .obj, .ply 등만 지원. .glb 직접 export 불가. **MagicaVoxel → .obj → Blender → .glb** 또는 **MagicaVoxel → .vox → gltf-voxel-converter → .glb** 파이프라인 필요
- **Impact**: 에셋 파이프라인 예측 오차, 추가 변환 도구 필요
- **Fix**: "MagicaVoxel → .glb export" → "MagicaVoxel → .obj → Blender (glTF export) → .glb"

### M5: BatchedMesh 미성숙 경고

- **Location**: `v38-3d-voxel-roadmap.md:250-254` (S23)
- **Category**: ⚡ Tech Accuracy
- **Evidence**: Three.js BatchedMesh는 r163+(2024)에 도입된 비교적 새 API. InstancedMesh 대비 사례/문서가 적고, per-instance color 지원이 제한적. 검색 결과에서도 "less mature, experiment first" 권고
- **Impact**: S23 구현 시 예상보다 시간 소요 가능
- **Fix**: S23에 "실험적 — A/B 벤치마크 후 InstancedMesh fallback 유지" 명시 (이미 부분적으로 있으나 강화)

### M6: Quality Ladder 구현 — renderer.info 대신 drei PerformanceMonitor

- **Location**: `v38-3d-voxel-roadmap.md:133,285` (renderer.info 측정)
- **Category**: ⚡ Tech Accuracy
- **Evidence**: R3F 생태계에서는 drei의 `<PerformanceMonitor>` 컴포넌트가 FPS 기반 자동 품질 전환의 표준 접근. renderer.info는 draw call/triangle 측정용이지 FPS 모니터링용이 아님
- **Impact**: Quality Ladder 구현 방향 오해
- **Fix**: S45에 `drei <PerformanceMonitor>` 사용 명시, renderer.info는 벤치마크 측정용으로만 사용

### M7: 파일명 kebab-case 위반 6건

- **Location**: 로드맵 전체
- **Category**: 🔍 Naming Convention
- **Evidence**: 프로젝트 규칙 = kebab-case 파일명. 위반 목록:
  - `characterConfig.ts` → `character-config.ts`
  - `enemyTemplates.ts` → `enemy-templates.ts`
  - `enemyColors.ts` → `enemy-colors.ts`
  - `skinSystem.ts` → `skin-system.ts`
  - `ProjectilePool.ts` → `projectile-pool.ts`
  - `qualityLadder.ts` → `quality-ladder.ts`
- **Fix**: 위 6파일 kebab-case로 변경

### M8: S38 Safe Zone 의존성 — terrain 필요

- **Location**: `v38-3d-voxel-roadmap.md:421` (S38 blocked_by: S33)
- **Category**: 🔍 Dependency
- **Evidence**: Safe Zone 3D는 바닥 경계를 표시해야 하므로 terrain(S07+)이 있어야 시각적으로 의미 있음. 현재 S33(Post-Processing)에만 의존
- **Fix**: S38 `blocked_by: S33` → `blocked_by: S33, S07`

### M9: Canvas 2D effects 커버리지 미확인

- **Location**: Plan Phase 5
- **Category**: 🔍 Completeness
- **Evidence**: 기존 Canvas 2D의 `rendering/effects/` 에는 canvasEffects.ts (screen flash, color invert, slow-mo), screenShake.ts, warning indicators 등이 있음. 이들의 3D 대응이 명시적으로 매핑되지 않음
- **Fix**: S33에 canvas effect → 3D post-processing 매핑 테이블 추가

### M10: Collision 시스템 좌표 변환 미언급

- **Location**: Plan 전체
- **Category**: 🔍 Completeness
- **Evidence**: 기존 collision 시스템은 2D 좌표 (x, y) 기반. 3D 모드에서도 game logic은 2D 좌표를 사용하므로 collision은 변경 불필요하지만, 이를 명시적으로 선언하지 않음
- **Fix**: Plan §3 기술 방향에 "Collision: 2D 좌표 기반 유지, 변경 불필요 (렌더링만 3D)" 명시

### M11: Sprite 시스템 deprecation 미언급

- **Location**: Plan 전체
- **Category**: 🔍 Completeness
- **Evidence**: 3D 모드에서 기존 sprite 로딩/렌더링 시스템은 사용되지 않음. 하지만 2D fallback 모드에서는 유지 필요. 이 관계가 문서에 명확하지 않음
- **Fix**: Plan §1 변환 범위에 "2D 모드 유지를 위해 sprites/ 삭제하지 않음, 3D 모드에서만 미사용" 추가

---

## ✅ Verified Claims (코드베이스 검증 통과)

| # | Claim | Status | Evidence |
|---|-------|--------|----------|
| 1 | update()와 draw() 분리 | ✅ VERIFIED | MatrixCanvas.tsx에 명확히 분리된 update()/draw() 존재 |
| 2 | useGameRefs 중앙 상태 | ✅ VERIFIED | useGameRefs.ts에 42개 ref 관리 |
| 3 | Web Worker 타이머 | ✅ VERIFIED | game-timer.worker.ts 33줄 |
| 4 | 9 플레이어 클래스 | ✅ VERIFIED | classes.config.ts 9개 클래스 정의 |
| 5 | Isometric Transform | ✅ VERIFIED | ctx.transform(1, 0.5, -1, 0.5, ...) 확인 |
| 6 | 24 skin palette | ✅ VERIFIED | skins.config.ts 24종 |
| 7 | Arena safe zone | ✅ VERIFIED | safeZone.ts 존재 + shrink 로직 |

---

## ✅ Tech Feasibility (기술 검증 통과)

| # | Claim | Status | Notes |
|---|-------|--------|-------|
| 1 | InstancedMesh 10K cubes 60fps | ✅ VERIFIED | Three.js 벤치마크 + R3F showcase 확인 |
| 2 | R3F + Next.js 통합 | ✅ VERIFIED | 공식 지원, @react-three/next 패키지 존재 |
| 3 | OrthographicCamera isometric | ✅ VERIFIED | Three.js 표준 카메라 타입 |
| 4 | drei Html world anchoring | ✅ VERIFIED | drei 공식 문서 확인 |
| 5 | @react-three/postprocessing Bloom | ✅ VERIFIED | pmndrs 생태계 |
| 6 | useFrame priority=0 auto-render | ✅ VERIFIED | R3F v9 동작 확인 (MEMORY.md) |

---

## 📋 da:work Compatibility

| Check | Status |
|-------|--------|
| `## 구현 로드맵` 섹션 존재 | ✅ |
| `### Phase N:` 헤딩 형식 | ✅ |
| Phase 내 tasks 테이블 | ✅ |
| `design: Y/N` 필드 | ✅ (all N) |
| `verify:` 필드 | ✅ |
| Roadmap `### SNN:` 형식 | ✅ |
| `file/ref/blocked_by/do/verify` 필드 | ✅ |
| **Overall** | **✅ 완전 호환** |

---

## Recommendations (우선순위)

1. **[MUST]** 수치 오류 수정: 166→173, 68→53, 25→24
2. **[MUST]** Turret 3D Rendering Step 추가 (Phase 4)
3. **[MUST]** Pickup/Item 3D Rendering Step 추가 (Phase 2 또는 4)
4. **[MUST]** S35 의존성 완화: S19 → S06
5. **[SHOULD]** CSS2DRenderer 표현 수정 → drei Html 기반
6. **[SHOULD]** MagicaVoxel 파이프라인 명확화 (.vox → .obj → Blender → .glb)
7. **[SHOULD]** 파일명 kebab-case 6건 수정
8. **[SHOULD]** Quality Ladder에 drei PerformanceMonitor 명시
9. **[NICE]** Collision 좌표 변환 불필요 명시
10. **[NICE]** Sprite deprecation 관계 명시

---

## Confidence Level: Medium-High

**Sources**:
- 코드베이스 직접 분석 (Serena symbols + search)
- Three.js / R3F / drei 공식 문서 (Context7)
- 웹 검색 기술 검증 (Tavily)
- 프로젝트 MEMORY.md (R3F useFrame gotchas)
