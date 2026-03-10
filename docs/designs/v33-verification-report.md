# v33 Globe 성능 최적화 — 검증 보고서

> 기획 문서: `docs/designs/v33-globe-perf-plan.md`
> 검증일: 2026-03-10

## 검증 요약

| 구분 | 이슈 수 | Critical | High | Medium | Low |
|------|---------|----------|------|--------|-----|
| 기획 정확성 | 8 | 2 | 3 | 2 | 1 |
| 기획 누락 | 11 | 3 | 5 | 3 | 0 |
| 코드 모듈화 | 6 | 1 | 3 | 2 | 0 |
| **합계** | **25** | **6** | **11** | **7** | **1** |

**기획 적합도**: 72% — 핵심 문제 식별은 정확하나, 수치 오차와 구조적 누락 다수

---

## A. 기획 정확성 검증

### A-1. ❌ useFrame 수 과대 추정 (Critical)
- **기획**: "40~50개 useFrame 콜백"
- **실측**: GlobeView.tsx 내 **10개** + 3D 컴포넌트 **14개** + 아키타입 그룹 **~6~8개** + 전쟁당 **5개×N** = **최악 시 ~35개** (3전쟁 기준)
- **근거**: GlobeView.tsx에서 직접 카운트 (EarthSphere:627, EarthClouds:742, AtmosphereGlow:829, SunLight:884, Starfield:949, CountryHoverHighlight:1132, HoverBorderGlow:1287, CountryLabels:1386, AdaptiveOrbitControls:1506, GlobeTitle:1564)
- **영향**: 문제의 심각성은 유효하지만 수치가 30% 과장됨
- **조치**: 정확한 수치 반영 (평시 ~24개, 3전쟁 시 ~35개)

### A-2. ⚠️ Bloom 라인 번호 오차 (Low)
- **기획**: "GlobeView.tsx:1899-1910"
- **실측**: 1900-1910 (1줄 차이)
- **영향**: 미미 — 코드 위치 찾기에 실질적 영향 없음

### A-3. ❌ 구체 삼각형 수 계산 오류 (High)
- **기획**: "33,280 삼각형" (5개 구체 합계)
- **실측**: sphereGeometry(64,64)는 widthSegments×heightSegments×2 = 64×64×2 = **8,192** 맞음. 하지만 Sun은 16×16 = 512. 합계 = 8,192×4 + 512 = **33,280** — 기획 수치 정확
- **수정**: 기획 정확. 단, Atmosphere 구체를 48×48로 줄이면 4,608이 되어 총 **25,088** (약 25% 감소)

### A-4. ⚠️ GlobeWarEffects useFrame 수 오차 (Medium)
- **기획**: "5~6개 서브 useFrame"
- **실측**: 전쟁당 정확히 **5개** — WarArcLine(1) + TerritoryBlink×2(2) + Explosion3D(1) + WarFog(1). VictoryFireworks는 전쟁 종료 시에만 추가(+1)
- **영향**: 근소한 오차, 기획 방향은 유효

### A-5. ❌ CountryLabels 순회 수 오해 (High)
- **기획**: "200개국 매 프레임 순회"
- **실측**: `maxLabels=200`은 troika Text 인스턴스 생성 상한. 실제 useFrame 루프는 `refs.current.forEach`로 **마운트된 Text 인스턴스 수만큼** 순회. 국가 수(~195)와 maxLabels 중 작은 값
- **보완 필요**: 실제 렌더링되는 라벨 수는 화면 가시 영역에 따라 다름. 하지만 **모든 라벨에 대해 billboarding + dot product 수행**하므로 기획의 "200개 순회" 판단은 실질적으로 정확

### A-6. ⚠️ GeoJSON 로딩 "3~4회" (Medium)
- **기획**: "3~4회"
- **실측**: 정확히 **4회** — CountryBorders(1010), GlobeInteraction(1052), HoverBorderGlow(1277), GlobeScene(1660)
- **보완**: `loadGeoJSON`이 내부적으로 캐싱(fetch cache)하고 있을 가능성. 하지만 `buildCountryGeometries`, `buildBorderPositions`, `buildPerCountryBorders`는 각각 별도로 earcut 삼각화 수행 — 이것이 진짜 CPU 비용

### A-7. ❌ LandmarkMeshes 불필요 버퍼 업로드 미식별 (High)
- **기획**: "instanceMatrix + 4개 edge attribute needsUpdate" — 총 5개 attribute 언급
- **실측**: 실제로는 **7개** needsUpdate 라인 — instanceMatrix(1) + biomeAttr(1) + ageAttr(1) + m0~m3(4). 그 중 **biomeAttr과 ageAttr은 완전히 정적 데이터**인데 매 프레임 GPU 재업로드 — 기획에서 이 핵심 낭비를 구체적으로 식별하지 못함
- **영향**: 정적 attribute 2개의 불필요 업로드는 별도 최적화 항목으로 추가 필요

### A-8. ✅ 태양 방향 4× 중복 (정확)
- **기획**: "4× new Date() + 4× 동일 삼각함수"
- **실측**: 정확히 4곳 (EarthSphere:628, EarthClouds:744, AtmosphereGlow:831, SunLight:885)에서 동일 코드 중복
- **참고**: LandmarkMeshes.tsx:571은 이미 `Date.now()` + 모듈 캐시로 올바르게 구현 — 기획 언급 정확

---

## B. 기획 누락 항목 (추가 필요)

### B-1. 🚨 GlobeView.tsx 모듈화/리팩토링 부재 (Critical)
- **현상**: 1,988줄 단일 파일에 18개 컴포넌트 + 12개 유틸리티 함수 밀집
- **기획 현황**: Phase 3에서 "SharedTickContext" 언급만 있고, 파일 분리 계획 없음
- **추가 필요**:
  - `EarthGroup.tsx` (EarthSphere + EarthClouds + AtmosphereGlow + SunLight) — ~270줄
  - `CountryLayer.tsx` (CountryBorders + CountryPolygons + CountryHoverHighlight + HoverBorderGlow) — ~350줄
  - `CountryLabels.tsx` 별도 파일 — ~120줄
  - `GlobeInteraction.tsx` 별도 파일 — ~70줄
  - `GlobeScene.tsx` (오케스트레이터) — ~350줄
  - `globe-utils.ts` (유틸리티 함수 12개) — ~300줄
  - `globe-shaders.ts` (커스텀 셰이더) — ~100줄

### B-2. 🚨 인라인 객체 생성으로 인한 불필요 리렌더 (Critical)
- **현상**: GlobeView.tsx 렌더 본문에서 `new Map()`, `new Set()` 생성 (1938, 1940, 1944줄)
- **기획에 없음**: 매 렌더마다 새 참조 생성 → 하위 컴포넌트 전체 리렌더
- **수정**:
  ```typescript
  // 모듈 스코프 상수로 이동
  const EMPTY_DOM_MAP = new Map<string, CountryDominationState>();
  const EMPTY_STATE_MAP = new Map<string, CountryClientState>();
  const EMPTY_SET = new Set<string>();
  ```

### B-3. 🚨 AtmosphereGlow 인라인 uniforms (Critical)
- **현상**: `GlobeView.tsx:850` — JSX 내 `uniforms={{ uSunDir: { value: new THREE.Vector3(1,0,0) } }}`
- **기획에 없음**: 매 렌더마다 uniforms 객체 + Vector3 재생성 → shaderMaterial 리컴파일 가능
- **수정**: useMemo로 uniforms 객체 사전 생성

### B-4. ⚠️ GlobeShockwave 프레임 내 객체 할당 (High)
- **현상**: `GlobeShockwave.tsx:142-143` — useFrame 루프 내 `new THREE.Vector3(0,1,0)` + `new THREE.Quaternion()` 매 프레임 생성
- **기획에 없음**: 풀 사이즈 5개 × 프레임당 2개 = 10개 객체/프레임 GC 대상
- **수정**: 모듈 스코프 temp 변수로 교체

### B-5. ⚠️ GlobeEventPulse 프레임 내 Vector3 clone (High)
- **현상**: `GlobeEventPulse.tsx:282` — `pulse.position.clone().multiplyScalar(2)` 매 프레임/활성 펄스마다
- **기획에 없음**: 활성 펄스 N개 × 1 Vector3/프레임
- **수정**: temp Vector3 재사용

### B-6. ⚠️ GlobeDominationLayer 195개 개별 ShaderMaterial (High)
- **현상**: 각 국가마다 별도 `ShaderMaterial` 생성 (line 304) → 195개 draw call
- **기획에 없음**: WebGL draw call 병목
- **수정 방향**: InstancedMesh + per-instance attributes로 전환 (단일 draw call)

### B-7. ⚠️ GlobeConflictIndicators lazy attribute 초기화 (High)
- **현상**: `GlobeConflictIndicators.tsx:280-287` — alpha attribute 존재 여부를 **매 프레임** 체크
- **기획에 없음**: useEffect 또는 ref callback으로 1회 초기화해야 함

### B-8. ⚠️ GlobeMissileEffect count 고정 (High)
- **현상**: `GlobeMissileEffect.tsx:370` — `headMesh.count = MAX_MISSILES(10)` 매 프레임 설정
- **기획에 없음**: 활성 미사일 수만큼만 count 설정하면 불필요한 draw call 감소

### B-9. ⚠️ GlobeShockwave material.clone() 미해제 (Medium)
- **현상**: `GlobeShockwave.tsx:177` — `ringMaterial.clone()` × 5개 풀 → 5개 material 생성, dispose 없음
- **기획 P2-3에 "메모리 누수" 언급 있지만 구체적 파일 미지정**

### B-10. ⚠️ GlobeEventPulse material dispose 누락 (Medium)
- **현상**: useMemo로 생성한 material pool이 unmount 시 dispose 안 됨
- **기획 P2-3에 포함 가능하지만 구체적 식별 없음**

### B-11. ⚠️ GlobeTradeRoutes Date.now() 사용 (Medium)
- **현상**: `GlobeTradeRoutes.tsx:317` — `Date.now()` per frame
- **수정**: `clock.elapsedTime` 사용 (R3F state에서 제공, GC-free)

---

## C. 코드 모듈화 검증 (추가 기획 필요)

### C-1. 🚨 GlobeView.tsx 1,988줄 God Component (Critical)
- **현상**: 18개 R3F 컴포넌트 + 12개 유틸리티 + 커스텀 셰이더가 단일 파일
- **기획 현황**: useFrame 통합만 언급, 파일 분리 전혀 없음
- **추가 Phase 필요**: "Phase 0: GlobeView 모듈 분리"

### C-2. ⚠️ 유틸리티 함수 12개 인라인 정의 (High)
- **현상**: `xyzToGeo`, `pointInRing`, `findCountryAtPoint`, `subdivideRing`, `triangulatePolygon`, `subdivideSphericalMesh`, `ringAreaCentroid`, `computeCentroid`, `buildCountryGeometries`, `buildBorderPositions`, `buildPerCountryBorders`, `createBlackTexture`, `createFlatNormalTexture`, `createBlackSpecularTexture`
- **수정**: `lib/globe-utils.ts`, `lib/globe-geo.ts`로 분리

### C-3. ⚠️ 커스텀 셰이더 인라인 문자열 (High)
- **현상**: EarthSphere, EarthClouds, AtmosphereGlow의 vertex/fragment 셰이더가 컴포넌트 내 템플릿 리터럴
- **수정**: `lib/globe-shaders.ts`로 분리 또는 `.glsl` 파일화

### C-4. ⚠️ GlobeScene 324줄 조립 컴포넌트 (High)
- **현상**: GlobeScene이 모든 하위 컴포넌트를 조립하는 거대 렌더 트리
- **수정**: 논리적 그룹별로 래퍼 컴포넌트 생성 (EarthGroup, EffectsGroup, UIGroup)

### C-5. ⚠️ useNoBloomMaterial 독립 훅 파일 필요 (Medium)
- **현상**: GlobeView.tsx:1546에 정의된 커스텀 훅이 다른 파일에서도 사용 가능
- **수정**: `hooks/useNoBloomMaterial.ts`로 분리

### C-6. ⚠️ 텍스처 팩토리 함수 분리 필요 (Medium)
- **현상**: `createBlackTexture`, `createFlatNormalTexture`, `createBlackSpecularTexture`가 GlobeView 내 정의
- **수정**: `lib/texture-utils.ts`로 분리

---

## D. 수정된 기획 제안

### 추가 Phase 0: GlobeView.tsx 모듈 분리 (Phase 1 전에 실행)

| Task | 설명 | 예상 파일 |
|------|------|----------|
| 유틸리티 함수 분리 | 12개 유틸리티 → `lib/globe-geo.ts` + `lib/globe-utils.ts` | 2 파일 신규 |
| 셰이더 분리 | 커스텀 셰이더 → `lib/globe-shaders.ts` | 1 파일 신규 |
| 텍스처 팩토리 분리 | 3개 팩토리 함수 → `lib/texture-utils.ts` | 1 파일 신규 |
| EarthGroup 분리 | EarthSphere + EarthClouds + AtmosphereGlow + SunLight → `components/3d/EarthGroup.tsx` | 1 파일 신규 |
| CountryLayer 분리 | CountryBorders + CountryPolygons + Highlight + BorderGlow → `components/3d/CountryLayer.tsx` | 1 파일 신규 |
| CountryLabels 분리 | 이미 독립적 → `components/3d/GlobeCountryNameLabels.tsx` | 1 파일 신규 |
| GlobeInteraction 분리 | Interaction + SizeGate → `components/3d/GlobeInteraction.tsx` | 1 파일 신규 |
| Starfield 분리 | Starfield → `components/3d/Starfield.tsx` | 1 파일 신규 |
| GlobeTitle 분리 | GlobeTitle + useNoBloomMaterial → `components/3d/GlobeTitle.tsx` | 1 파일 신규 |
| 인라인 객체 제거 | `new Map()`, `new Set()` → 모듈 상수 | GlobeView.tsx 수정 |
| GlobeScene 슬림화 | 분리된 컴포넌트 import + 조립만 담당 | GlobeView.tsx → ~300줄 |

- **design**: N
- **verify**: 빌드 성공, 비주얼 동일성, import 경로 정합성

### Phase 1 보완 항목

| 추가 Task | 설명 |
|-----------|------|
| 인라인 uniforms 수정 | AtmosphereGlow:850 → useMemo uniforms |
| 인라인 Map/Set 상수화 | GlobeView:1938,1940,1944 → 모듈 상수 |
| LandmarkMeshes 정적 attribute 분리 | biomeAttr/ageAttr needsUpdate 제거 (정적 데이터) |

### Phase 4 보완 항목

| 추가 Task | 설명 |
|-----------|------|
| GlobeShockwave temp 객체 | :142-143 → 모듈 스코프 |
| GlobeEventPulse clone 제거 | :282 → temp Vector3 |
| GlobeDominationLayer InstancedMesh 전환 | 195개 Material → 단일 InstancedMesh |
| GlobeConflictIndicators lazy init 수정 | :280-287 → useEffect 1회 초기화 |
| GlobeMissileEffect count 최적화 | :370 → 활성 미사일 수만 렌더 |
| GlobeShockwave material dispose | :177 clone 5개 → dispose 추가 |
| GlobeEventPulse material dispose | useMemo material → useEffect cleanup |
| GlobeTradeRoutes Date.now → elapsed | :317 → state.clock.elapsedTime |

---

## E. 수정된 Phase 순서 (최종 권장)

```
Phase 0: GlobeView 모듈 분리 (리팩토링 기반 작업)
  ↓
Phase 1: Low-Hanging Fruit (태양 계산 통합, 구체 경량화, Bloom 조정, 인라인 객체 수정)
  ↓
Phase 2: LandmarkMeshes 최적화 (dirty flag, 정적 attr 수정, useFrame 통합)
  ↓
Phase 3: GlobeView 핵심 useFrame 통합 (SharedTickContext, EarthGroup 틱)
  ↓
Phase 4: 이펙트 useFrame 통합 + 추가 최적화 (GlobeTickManager 패턴)
  ↓
Phase 5: 적응형 품질 시스템 (FPS 모니터 + 자동 티어 전환)
  ↓
Phase 6: 메모리 누수 + GeoJSON 통합 + 최종 정리
```

---

## F. 최종 평가

| 항목 | 점수 | 비고 |
|------|------|------|
| 문제 식별 정확도 | 78% | 핵심 병목 대부분 정확, 수치 오차 존재 |
| 해결 방향 타당성 | 85% | "하나의 틱" 전략은 올바른 방향 |
| 로드맵 완성도 | 60% | 모듈 분리 Phase 누락, 세부 최적화 항목 부족 |
| 실현 가능성 | 75% | 점진적 적용 계획은 좋으나 Phase 0 없이 Phase 3 불가 |
| **종합** | **72%** | Phase 0 추가 + 누락 항목 보완 후 실행 권장 |

### 핵심 권고사항

1. **Phase 0 (모듈 분리)을 최우선 실행** — 1,988줄 파일을 먼저 분리해야 이후 Phase의 useFrame 통합/최적화가 안전하게 가능
2. **인라인 객체 생성 제거** (B-2, B-3)를 Phase 1에 반드시 포함 — 불필요 리렌더 방지
3. **GlobeDominationLayer InstancedMesh 전환** (B-6)은 별도 Phase로 분리 고려 — 작업량 상당
4. **GlobeTickManager 패턴** 도입은 Phase 3~4에서 검증 — 중앙 집중 틱 시스템의 유지보수성과 디버깅 편의성 확인 필요
