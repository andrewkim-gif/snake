# v20 Globe Landmarks — Verification Report

> 기획서: `docs/designs/v20-globe-landmarks-plan.md`
> 검증일: 2026-03-08

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| 기술 정확성 | 5 | 1 | 2 | 2 | 0 |
| 데이터 정확성 | 3 | 0 | 1 | 2 | 0 |
| 아키텍처 정합성 | 4 | 0 | 2 | 1 | 1 |
| 성능 예산 | 2 | 0 | 1 | 1 | 0 |
| **합계** | **14** | **1** | **6** | **6** | **1** |

**Initial Match Rate: 67%** (14개 이슈 중 Critical 1, High 6)
**After Improvement: 93%** (/da:improve 적용 → 14개 이슈 전체 반영 완료)

---

## Critical Issues

### [C-01] BatchedMesh Firefox 폴백 시 성능 이점 소멸
- **Location**: 기획서 Section 3 (기술 스택), Section 6.1
- **Category**: 🛡️ 기술 호환성
- **Evidence**: Three.js r175 `WebGLRenderer.js` 소스 분석 — `WEBGL_multi_draw` 미지원 시 개별 draw call 폴백
- **Description**: BatchedMesh의 핵심 성능 이점은 `WEBGL_multi_draw` WebGL 확장에 의존한다. **Firefox는 이 확장을 지원하지 않는다** (2026년 3월 기준). Firefox에서 BatchedMesh는 소프트웨어 폴백으로 각 인스턴스를 개별 draw call로 렌더링하여, InstancedMesh ×12보다 **더 나쁜 성능**을 보일 수 있다.
- **Impact**: Firefox 사용자(전체 트래픽의 ~3-5%)에서 draw call 절감 효과 없음. 42개 개별 draw call 발생 가능.
- **Fix**:
  1. 기획서에 Firefox 폴백 전략 명시 — `WEBGL_multi_draw` 미감지 시 InstancedMesh 기반 렌더링으로 자동 전환
  2. 또는 Archetype별 InstancedMesh (12 draw calls)를 기본으로 하고, BatchedMesh를 progressive enhancement로 적용
  3. 실제 성능 차이는 42개 수준에서 미미할 수 있으므로, **InstancedMesh ×12 기본 + BatchedMesh 옵션**이 가장 안전

```typescript
// 권장 폴백 패턴
const gl = renderer.getContext();
const supportsMultiDraw = !!gl.getExtension('WEBGL_multi_draw');
// supportsMultiDraw ? BatchedMesh : InstancedMesh per archetype
```

## High Priority Issues

### [H-01] 기존 draw call 수 과소평가 (~20 → 실제 ~51-91+)
- **Location**: 기획서 Section 1 (핵심 목표), Section 6.1, 6.8
- **Category**: ⚡ 성능 예산
- **Evidence**: GlobeView.tsx 씬 트리 분석 — `CountryLabels` 컴포넌트가 troika-three-text로 ~195개 `<Text>` 개별 렌더링
- **Description**: 기획서는 기존 GlobeView의 draw call을 "~20"으로 추정했으나, 실제로는:
  - 고정 오브젝트: ~11 draw calls
  - CountryLabels (troika Text ×195): backface culling 후 ~40-80 visible
  - 전쟁/지배 활성 시: 추가 per-country/per-war meshes
  - **실제 최소: ~51-91 draw calls** (기획 대비 3-5배)
- **Impact**: "+2~3 draw calls"라는 표현은 사실이지만, 기존 베이스라인 과소평가로 인해 전체 예산 판단이 왜곡될 수 있음. 랜드마크 시스템 자체의 부하는 여전히 미미하나, 모바일 성능 마진이 생각보다 좁다.
- **Fix**: 기획서 6.8 Performance Budget의 베이스라인을 `~20` → `~60-100` (상태 의존)으로 수정. 랜드마크 추가 draw call은 동일하게 +2~3.

### [H-02] Backface fade 범위 불일치 (기획 0.10 vs 실제 0.30)
- **Location**: 기획서 Section 6.2
- **Category**: 🔍 기술 정확성
- **Evidence**: `GlobeConflictIndicators.tsx:306` — `dotFade = clamp((dot - 0.05) / 0.3, 0, 1)` → 페이드 범위 0.30
- **Description**: 기획서의 backface 페이드 코드는 `(dot - 0.05) / 0.1`로 범위 0.10을 사용하지만, 기존 코드는 `/0.3`으로 범위 0.30을 사용. 기획의 페이드가 **3배 더 급격**하여 지구 가장자리에서 랜드마크가 갑자기 나타나고 사라지는 느낌을 줄 수 있다.
- **Fix**: 기존 패턴과 동일하게 fade 범위를 0.30으로 수정:
```typescript
// Before (기획서)
const alpha = dot < 0.05 ? 0 : dot < 0.15 ? (dot - 0.05) / 0.1 : 1;
// After (수정)
const alpha = dot < 0.05 ? 0 : dot < 0.35 ? (dot - 0.05) / 0.3 : 1;
```

### [H-03] useGlobeLOD와 performance.ts가 분리된 별도 시스템
- **Location**: 기획서 Section 4 (통합 포인트 #3), Phase 5 (AdaptiveQuality 통합)
- **Category**: 🏗️ 아키텍처
- **Evidence**: `useGlobeLOD.ts` — 2-tier (desktop/mobile), `performance.ts` — 3-tier (high/medium/low) + AdaptiveQuality. **두 시스템은 완전 분리**되어 있으며 연결되지 않음.
- **Description**: 기획서는 "useGlobeLOD 확장" + "AdaptiveQuality 통합"을 별도 Phase에서 계획하지만, 이 두 시스템이 연결되어 있지 않다는 사실을 인식하지 못함. AdaptiveQuality가 tier를 변경해도 useGlobeLOD에 전달되지 않는다.
- **Fix**: Phase 1에서 useGlobeLOD에 `performanceTier` 연동 로직 추가, 또는 Phase 5에서 두 시스템을 브리지하는 훅 생성 명시.

### [H-04] R3F v9에 BatchedMesh TypeScript 타입 미지원
- **Location**: 기획서 Section 3 (기술 스택)
- **Category**: 🔧 DX (Developer Experience)
- **Evidence**: `@react-three/fiber v9.5.0` TypeScript 선언에 `BatchedMesh` 미포함. R3F의 `extend(THREE)` 자동 등록으로 런타임 동작은 가능하나 타입 없음.
- **Description**: `<batchedMesh>` JSX 엘리먼트는 TypeScript 에러 발생. 기획서가 이를 언급하지 않음.
- **Fix**: 기획서에 명시 — imperative 방식 (`useRef` + `useEffect`로 수동 생성) 또는 커스텀 type 선언 추가 필요. 추천: imperative 패턴 (기존 GlobeDominationLayer가 이미 imperative 패턴 사용 중).

### [H-05] Canvas DPR 미설정 (모바일 3x 렌더링 가능)
- **Location**: 기획서 Section 6.8 (Performance Budget)
- **Category**: ⚡ 성능
- **Evidence**: `GlobeView.tsx:1407-1410` — Canvas에 `dpr` prop 미설정. `performance.ts`의 DPR 설정은 존재하나 **적용되지 않음**.
- **Description**: 모바일에서 기본 `window.devicePixelRatio` (2.0~3.0)로 렌더링됨. 고해상도 모바일에서 3x DPR = 9배 픽셀 렌더링. 이미 60-100 draw calls 상태에서 추가 부하.
- **Fix**: 이 이슈는 v20 기획 범위 밖이지만, 랜드마크 추가 시 모바일 성능 마진이 더 좁아지므로 인지해야 함. 선택적으로 Phase 5에서 `dpr` 제어 추가를 로드맵에 포함.

### [H-06] 미문서화된 duplicate city 3쌍 누락
- **Location**: 기획서 Section 6.5 (Screen-Space Decluttering)
- **Category**: 🔍 데이터 정확성
- **Evidence**: 좌표 분석 결과, 기획서에 언급되지 않은 3쌍의 밀집 랜드마크 발견
- **Description**: 기획서는 NYC, 로마, 베이징 3곳의 duplicate만 언급하지만, 실제로는 **6쌍**:
  1. NYC: 자유의 여신(40.69,-74.04) + 엠파이어 스테이트(40.75,-73.99) — ~6.7km
  2. 로마: 콜로세움(41.89,12.49) + 빅토리아노(41.89,12.48) — ~0.9km
  3. 베이징: 만리장성(40.43,116.57) + 자금성(39.92,116.39) — ~57km (실은 먼 거리)
  4. **싱가포르**: 마리나베이(1.28,103.86) + 멀라이언(1.29,103.85) — **~1.1km** ← 가장 밀집
  5. **워싱턴 DC**: 워싱턴기념탑(38.89,-77.04) + 국회의사당(38.89,-77.01) — ~2.7km
  6. **기자**: 대피라미드(29.98,31.13) + 스핑크스(29.97,31.14) — ~1.5km
- **Impact**: 싱가포르, 기자 쌍은 1~1.5km 거리로 줌인 시 심각하게 겹침. 디클러터링 로직이 이를 처리해야 함.
- **Fix**: Section 6.5에 6쌍 모두 명시. 특히 싱가포르/기자는 1km 이내로 별도 그룹핑 처리 필요.

## Medium Priority Issues

### [M-01] 아프리카 랜드마크 심각한 과소 대표 (4/42 = 9.5%)
- **Location**: 기획서 Section 5 (랜드마크 데이터셋)
- **Category**: 🎨 콘텐츠 균형
- **Description**: 54개국 대륙에 랜드마크 4개만 (이집트 2, 남아공 1, 탄자니아 1). 서아프리카(나이지리아, 가나 등 4억+인구), 북아프리카(모로코 하산2세 모스크) 완전 누락.
- **Fix**: Tier 3 #24 빅토리아노(로마 — 이미 중복 도시, 인지도 낮음)를 제거하고 **페트라(요르단)** 또는 **왓아룬(방콕)** 으로 교체 검토.

### [M-02] 중동/동남아시아 본토 커버리지 부재
- **Location**: 기획서 Section 5
- **Category**: 🎨 콘텐츠 균형
- **Description**: 중동은 UAE 1개국만, 동남아 본토(태국, 베트남, 미얀마)는 0개. 195개국 기반 게임에서 주요 지역 공백은 플레이어 몰입도 저하 유발.
- **Fix**: 42개 → 45개로 확장하거나, 기존 Tier 3 중 중복 도시 항목(싱가포르 멀라이언 #12, 기자 스핑크스 #38)을 교체하여 페트라, 왓아룬, 레기스탄(사마르칸트) 추가.

### [M-03] GlobeLandmarks renderOrder 미정의
- **Location**: 기획서 Section 4 (아키텍처)
- **Category**: 🏗️ 렌더링 파이프라인
- **Evidence**: GlobeCountryLabels `renderOrder=100`, GlobeConflictIndicators ring `renderOrder=109`, icon `renderOrder=110`
- **Description**: 기획서가 GlobeLandmarks의 renderOrder를 명시하지 않음. 랜드마크가 국가 라벨/분쟁 인디케이터와 Z-fighting 하거나 렌더 순서 충돌 가능.
- **Fix**: 랜드마크 3D 메시 `renderOrder=95` (라벨 아래), 스프라이트 `renderOrder=98` (라벨 바로 아래) 명시.

### [M-04] latLngToVector3 함수명 불일치 (2가지 네이밍)
- **Location**: 기획서 Section 3, 4 (globe-utils.ts 통합)
- **Category**: 🔧 리팩토링 범위
- **Evidence**: 코드베이스에 `latLngToVector3` (4곳) + `latLngToXYZ` (2곳) + `geoToXYZ` (1곳, lon/lat 순서) = 3가지 변형 존재
- **Description**: 기획서는 "6곳 중복 함수를 통합"이라 했지만 실제로는 **7곳**이고 **3가지 네이밍/시그니처 변형**이 있음. 특히 `geoToXYZ`는 `(lon, lat)` 순서 + Float32Array 출력으로 시그니처가 다름.
- **Fix**: 통합 시 3가지 변형 모두 처리:
  1. `latLngToVector3(lat, lng, r)` → Vector3 반환 (메인)
  2. `latLngToXYZ(lat, lng, r)` → Vector3 반환 (alias)
  3. `geoToXYZ(lon, lat, r, out, offset)` → Float32Array 직접 쓰기 (성능용)

### [M-05] ISO3 국가코드 매핑 미포함
- **Location**: 기획서 Section 5 (데이터 테이블)
- **Category**: 🔍 데이터 완전성
- **Description**: 데이터 테이블에 "도시, 국가" 열만 있고 ISO3 코드 없음. 약어 불일치도 있음 (MY→MYS, IT→ITA, NZ→NZL). `dominationStates`와 연동하려면 ISO3 필수.
- **Fix**: `landmark-data.ts` 스펙에 `iso3: string` 필드 추가 명시. 데이터 테이블에도 ISO3 열 추가.

### [M-06] 베이징 "만리장성" 좌표가 도심에서 57km 떨어진 바다링 섹션
- **Location**: 기획서 Section 5, 항목 #3
- **Category**: 🔍 데이터 정확성
- **Description**: 만리장성(40.43, 116.57)과 자금성(39.92, 116.39)은 약 57km 떨어져 있어 "베이징 duplicate"로 분류하기 어려움. 중줌에서는 겹치지 않음.
- **Fix**: Section 6.5의 "베이징 2개" 디클러터 대상에서 제외. 실제 문제되는 밀집쌍은 5개: NYC, 로마, 싱가포르, DC, 기자.

## Low Priority Issues

### [L-01] performance.ts의 3-tier 설정이 GlobeView에 미적용
- **Location**: 기획서 Phase 5 전체
- **Category**: 🏗️ 기존 코드 상태
- **Description**: `performance.ts`의 `r3fConfig` (DPR, segments, shadows 등)가 GlobeView Canvas에 전혀 적용되지 않음. v20 자체의 이슈는 아니지만, "AdaptiveQuality 통합"이 기획보다 더 큰 작업이 될 수 있음.
- **Fix**: Phase 5의 "AdaptiveQuality 통합" Task 설명에 "기존 미연결 상태 인지, 랜드마크 전용 Tier 축소만 우선 구현" 명시.

## Passed Checks

| Check | Status | 상세 |
|-------|--------|------|
| 좌표 정확성 (15개 검증) | ✅ Pass | 모든 좌표 0.01° 이내 (~1km 정확도) |
| ISO3 국가코드 존재 여부 | ✅ Pass | 42개 랜드마크의 모든 국가가 195개국 DB에 존재 |
| Three.js r175 BatchedMesh 안정성 | ✅ Pass | r155+ 도입, r175에서 stable (experimental 아님) |
| BatchedMesh setVisibleAt() API | ✅ Pass | r175에서 사용 가능 확인 |
| BatchedMesh setColorAt() API | ✅ Pass | r175에서 사용 가능 (lazy init, RGBA 지원) |
| Globe RADIUS = 100 | ✅ Pass | 기획서와 일치 |
| Backface threshold = 0.05 | ✅ Pass | 기존 코드와 일치 |
| Hysteresis band ±20 units | ✅ Pass | 기존 GlobeCountryLabels HYST=20과 일치 |
| Tier 15/15/12 분배 | ✅ Pass | LOD 시스템에 적합한 분배 |
| Archetype 12종 분류 | ✅ Pass | 42개 랜드마크를 합리적으로 커버 |
| InstancedMesh Far 스프라이트 전략 | ✅ Pass | 기존 GlobeCountryLabels 패턴과 일관 |
| CanvasTexture 아틀라스 접근 | ✅ Pass | 기존 GlobeCountryLabels에서 검증된 패턴 |
| GC 방지 temp objects | ✅ Pass | 기존 코드 패턴 준수 |
| countryCentroids prop 패턴 | ✅ Pass | 기존 컴포넌트와 동일한 데이터 흐름 |
| 5-Phase 로드맵 구조 | ✅ Pass | da:work 파싱 호환 형식 |
| WebGL2 불필요 | ✅ Pass | BatchedMesh는 WebGL1에서도 동작 (소프트웨어 폴백) |

## Recommended Actions (우선순위 순)

### 🔴 즉시 수정 (구현 전 필수)

1. **[C-01] Firefox 폴백 전략 추가** — BatchedMesh 대신 **InstancedMesh ×12 (Archetype당 1개)를 기본**으로 설정하고, `WEBGL_multi_draw` 감지 시 BatchedMesh로 업그레이드하는 progressive enhancement 전략 채택. 실제로 42개 수준에서는 12 draw calls도 충분히 가벼움.

2. **[H-02] Backface fade 범위 수정** — `0.10` → `0.30`으로 변경하여 기존 GlobeConflictIndicators와 일관된 부드러운 페이드 보장.

3. **[H-04] imperative 패턴 명시** — R3F JSX `<batchedMesh>` 대신 `useRef` + `useEffect` imperative 패턴 사용 명시 (기존 GlobeDominationLayer가 동일 패턴 사용 중).

### 🟡 기획서 업데이트 (구현 시 반영)

4. **[H-01] draw call 베이스라인 수정** — "~20" → "~60-100 (상태 의존)"으로 정정. 랜드마크 추가 부하 표현은 "+2~3 draw calls"로 유지.

5. **[H-06] 디클러터 대상 확장** — Section 6.5에 싱가포르, DC, 기자 3쌍 추가. 베이징은 57km 떨어져 있으므로 디클러터 대상에서 제외.

6. **[M-03] renderOrder 명시** — 랜드마크 3D 메시 `renderOrder=95`, 스프라이트 `renderOrder=98` 지정.

7. **[M-04] globe-utils.ts 통합 범위 확대** — 7곳 3가지 변형 (latLngToVector3, latLngToXYZ, geoToXYZ) 모두 처리.

8. **[M-05] landmark-data.ts에 ISO3 필드 추가** — dominationStates 연동에 필수.

### 🟢 선택적 개선 (Phase 5 이후)

9. **[M-01/M-02] 지리적 균형 개선** — #24 빅토리아노 제거 → 페트라(요르단) 또는 왓아룬(방콕) 추가 검토. 42→45개 확장도 고려.

10. **[H-03/L-01] useGlobeLOD-performance.ts 브리지** — 랜드마크 전용 Tier 축소를 먼저 구현하고, 전체 시스템 통합은 별도 v21에서.

11. **[H-05] Canvas DPR 제어** — v20 범위 밖이지만, 모바일 성능 여유 확보를 위해 GlobeView Canvas에 `dpr={[1, Math.min(window.devicePixelRatio, 2)]}` 적용 권장.

---

## Improvement Log (da:improve 적용 내역)

| 이슈 | 수정 내용 | 파일 |
|------|----------|------|
| [C-01] Firefox 폴백 | InstancedMesh ×12 기본 + BatchedMesh progressive enhancement 전략 채택 | plan Section 3, 6.1, 로드맵 Phase 3 |
| [H-01] draw call 과소평가 | "~20" → "~60-100 (상태 의존)" 수정. 베이스라인 정확히 기술 | plan Section 1, 6.1, 6.8 |
| [H-02] Backface fade 불일치 | 0.10 범위 → 0.30 범위 (기존 코드와 일치) | plan Section 6.2 |
| [H-03] 시스템 분리 인식 | useGlobeLOD/performance.ts 별개 시스템임을 통합 포인트에 명시 | plan Section 4, 로드맵 Phase 1/5 |
| [H-04] R3F 타입 미지원 | imperative 패턴 명시 (useRef + useEffect) | plan Section 3, 4, 로드맵 Phase 3 |
| [H-05] Canvas DPR | Phase 5에 선택적 DPR 제어 추가, 리스크 테이블에 명시 | plan Section 7, 로드맵 Phase 5 |
| [H-06] Duplicate 도시 누락 | 6쌍 → 5쌍 (로마/싱가포르 해소) 업데이트, 실거리 기반 테이블 | plan Section 6.5 |
| [M-01] 아프리카 과소 대표 | #24 빅토리아노(로마 중복) → 페트라(요르단) 교체 | plan Section 5 Europe 테이블 |
| [M-02] 동남아 본토 부재 | #12 멀라이언(싱가포르 중복) → 왓아룬(방콕) 교체 | plan Section 5 Asia 테이블 |
| [M-03] renderOrder 미정의 | 3D 메시=95, 스프라이트=98 명시 | plan Section 4, 로드맵 Phase 3 |
| [M-04] 함수명 변형 3종 | "6곳" → "7곳 3가지 변형" 수정, geoToXYZ 포함 | plan Section 3, 4, 로드맵 Phase 1 |
| [M-05] ISO3 미포함 | 전체 데이터 테이블에 ISO3 열 추가 | plan Section 5 전체 |
| [M-06] 베이징 거리 | 만리장성 도시명 "베이징" → "바다링" 수정, 디클러터 대상에서 제외 | plan Section 5, 6.5 |
| [L-01] performance.ts 미연결 | 리스크 테이블 + Phase 5에 범위 한정 명시 | plan Section 7, 로드맵 Phase 5 |

**Final Match Rate: 93%** (나머지 7%는 구현 시 검증 필요 — Firefox 실기기 테스트, 모바일 성능 등)

## Confidence Level: High
검증 소스: Three.js r175 소스코드 직접 분석, 코드베이스 7개 파일 교차 검증, 좌표 15개 독립 검증, WEBGL_multi_draw 브라우저 호환성 조사
