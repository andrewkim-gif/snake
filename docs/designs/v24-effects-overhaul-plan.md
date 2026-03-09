# PLAN: v24 Globe Effects Overhaul — 통일 디자인 & 고도화

> AI World War 지구본 이펙트 시스템 전면 리디자인 + 버그 수정 + 최적화

## 1. 개요

현재 지구본 위 13개 3D 이펙트 + 7개 2D 오버레이가 서로 다른 시점에 독립적으로 개발되어
시각적 일관성이 부족하고, 카메라 자동 포커스 좌표가 부정확하며, 아크 높이가 낮아 시인성이 떨어진다.

**핵심 목표:**
1. 전체 이펙트를 "홀로그래픽 워룸" 통일 디자인 언어로 리디자인
2. 카메라 자동 포커스 + 좌표 정확성 전면 수정
3. 국가간 아크 라인 높이 상향 (더 극적인 시각)
4. 2D 오버레이 이펙트도 동일한 디자인 언어로 통일
5. 3D 이펙트 최적화 (InstancedMesh 통합, draw call 최소화)
6. 사용자가 생각못한 확장: 이펙트 사운드 큐, LOD 3단계, 이펙트 우선순위 시스템

## 2. 현황 분석 및 문제점

### 2.1 카메라 자동 포커스 버그 (Critical)

| 버그 | 원인 | 영향 |
|------|------|------|
| **CameraShake + CameraAutoFocus 레이스 컨디션** | 전쟁 선포 시 두 시스템이 동시에 camera.position을 덮어씀. CameraShake가 origPos로 리셋하면서 slerp 애니메이션 방해 | 카메라가 엉뚱한 위치에 멈추거나 점프 |
| **OrbitControls 내부 상태 비동기** | CameraAutoFocus가 controls.target을 갱신하지 않음. 애니메이션 후 OrbitControls 재활성화 시 스냅 발생 | 포커스 완료 후 카메라가 갑자기 튐 |
| **인트로 중 이벤트 발생** | globeGroupRef 회전이 반영 안 된 좌표로 카메라 이동 | 인트로 중 포커스 위치 불일치 |
| **동시 이벤트 충돌** | 여러 이벤트가 cameraTargetRef를 동시에 덮어씀 (우선순위 없음) | 카메라가 이벤트 사이에서 방황 |

### 2.2 이펙트 시각적 비일관성

| 문제 | 현황 | 영향 |
|------|------|------|
| **표면 고도 불일치** | 0.3 ~ 2.0+ (7종류+) 제각각. LandmarkMeshes(+0.3), Trade/Nuke/Resource(+0.5), EventPulse/SpyTrail(+0.8), Alliance/War(+1.0), Missile(*1.02), ConflictIndicators/Sanction(+1.5), LandmarkSprites(+2.0) | 이펙트들이 서로 다른 높이에 떠 있어 부자연스러움 |
| **아크 높이 편차** | ARC_HEIGHT_FACTOR: 0.15~0.35 (5종류) | 교역/동맹/전쟁 라인이 비슷해 보여 구분 어려움 |
| **색상 체계 부재** | 각 이펙트가 독립적으로 색상 결정 | 파란색이 동맹인지 교역인지 혼동 |
| **renderOrder 혼란** | 3~110 범위에 비체계적 배정 | 이펙트 간 z-fighting, 깜빡임 |
| **아크 생성 함수 중복** | 동일한 베지어 아크 로직이 5~6곳에 복붙 (Alliance, Trade, War, Spy, Sanction, Missile) | 유지보수 어려움 |
| **centroid prop 이름 불일치** | `countryCentroids` (7곳) vs `centroidsMap` (5곳) | 혼란, 타입 에러 가능성 |

### 2.3 성능 문제

| 문제 | 현황 | 영향 |
|------|------|------|
| **개별 Mesh 생성** | SanctionBarrier, SpyTrail, TradeRoutes가 이벤트당 개별 THREE.Mesh 생성 | draw call 폭증 (30개 교역 = 60 draw calls) |
| **머티리얼 과다 생성** | ResourceGlow, NukeEffect가 이벤트당 새 Material clone | GPU 메모리 낭비 |
| **CanvasTexture (수정됨)** | SpyTrail은 이미 모듈 스코프 `_eyeTexture` 싱글톤으로 캐싱 중. 단 SpriteMaterial은 이벤트당 clone (opacity 개별 제어) | Material clone 최소화 여지 있음 |
| **useFrame 콜백 13개** | 모든 이펙트 컴포넌트가 개별 useFrame 등록 | 프레임당 13번 콜백 오버헤드 |

### 2.4 아크 라인 시인성 부족

현재 ARC_HEIGHT_FACTOR가 0.15~0.35로 지구 표면에 너무 가깝게 붙어 있어
멀리서 보면 거의 안 보임. 특히 교역 라인(0.15)은 거의 표면에 깔려 있음.

### 2.5 2D 오버레이 비일관성

| 문제 | 현황 |
|------|------|
| **CSS 애니메이션 키프레임 중복** | `pulse`가 2곳, `fadeIn`이 3곳에서 각각 정의 |
| **배경 투명도 불일치** | rgba(14,14,18) 기반이지만 0.85~0.95 불일치 |
| **blur 강도 불일치** | 8px~24px 제각각 |
| **전환 타이밍 불일치** | 150ms~600ms 범위 혼재 |
| **뉴스피드 색상 코딩** | 3D 이펙트 색상 체계와 무관하게 독립 정의 |

## 3. 디자인 컨셉: "Holographic War Room"

모든 이펙트를 **"위성에서 내려다본 전술 홀로그램"** 컨셉으로 통일한다.
실제 군사 작전 시각화 + SF 홀로그래픽 오버레이 = **"Holographic War Room"**

### 3.1 통일 색상 체계 (Event Color Language)

| 이벤트 유형 | 색상 | Hex | HDR 배수 | 용도 |
|-------------|------|-----|----------|------|
| **전쟁/공격** | 위험 적색 | `#FF3333` | 2.5x | 전쟁 아크, 미사일, 폭발, 충격파, 충돌 아이콘 |
| **동맹/외교** | 전술 청색 | `#3388FF` | 2.5x | 동맹 빔, 조약 이벤트 |
| **교역/경제** | 에너지 녹색 | `#33CC66` | 2.0x | 교역 라인, 자원 카고 |
| **자원/채굴** | 금광 황색 | `#CCAA33` | 2.5x | 자원 글로우, 채굴 파티클 |
| **첩보/스파이** | 암자색 | `#9955CC` | 2.0x | 스파이 트레일, 눈 아이콘 |
| **제재/차단** | 경고 오렌지 | `#CC6633` | 2.0x | 제재 X마크, 차단선 |
| **핵/대량살상** | 백열 백색→오렌지 | `#FFAA33→#666666` | 3.0x→1.0x | 핵 버섯구름, 충격파 |
| **시대/에포크** | 금색 | `#FFCC44` | 2.5x | 에포크 전환 펄스 |

### 3.2 통일 아크 높이 체계

사용자 요청: **"국가간 라인 아크를 좀더 위로 솟아오르게"**

| 이벤트 유형 | 현재 ARC_HEIGHT | 신규 ARC_HEIGHT | 변경 이유 |
|-------------|-----------------|-----------------|-----------|
| 교역(무역선) | 0.15 (표면 가까움) | **0.35** | 교역 라인도 뚜렷하게 보이도록 |
| 스파이(은밀) | 0.20 | **0.25** | 은밀함 유지하되 약간 상향 |
| 동맹(우호) | 0.30 | **0.50** | 동맹 빔은 가장 높고 우아하게 |
| 전쟁(적대) | 0.25 | **0.45** | 전쟁 아크는 공격적으로 높게 |
| 미사일(공격) | 0.35 | **0.60** | 미사일은 가장 극적인 포물선 |
| 제재(차단) | 0.25 | **0.30** | 제재는 낮고 무거운 느낌 |

### 3.3 통일 표면 고도 (Surface Altitude)

모든 이펙트의 표면 고도를 **3단계**로 통일:

| 레벨 | 고도 offset | 용도 |
|------|------------|------|
| **Ground** | `+0.5` | 표면 부착형: 글로우 링, 충격파, 지배 오버레이 |
| **Low** | `+1.0` | 저공형: 교역 카고, 스파이 점선, 제재 X마크 |
| **High** | `+1.5` | 고공형: 충돌 아이콘, 이벤트 펄스, 동맹/전쟁 아크 기점 |

### 3.4 통일 renderOrder 체계

| 범위 | 용도 |
|------|------|
| **1-9** | 지배 레이어 (DominationLayer) |
| **10-19** | 표면 이펙트 (글로우 링, 충격파) |
| **20-29** | 아크 라인 (교역, 동맹, 전쟁, 제재, 스파이) |
| **30-39** | 비행 오브젝트 (미사일, 카고, 파티클) |
| **40-49** | 폭발/핵/파이어웍스 |
| **50-59** | 아이콘 (충돌 레티클, 제재 X) |
| **90-99** | 랜드마크 건물 |
| **100** | 국가 라벨 (최상위) |

### 3.5 통일 애니메이션 타이밍

| 유형 | 지속 시간 | easing |
|------|-----------|--------|
| 펄스/글로우 | 1.5~3.0s 무한반복 | sin wave |
| 이벤트 등장 | 300ms | easeOutCubic |
| 이벤트 퇴장 | 500ms | easeInQuad |
| 아크 라인 생성 | 800ms | easeOutQuart |
| 카메라 이동 | 2.0s | easeInOutCubic |
| 카메라 쉐이크 | 0.4s | linear decay |

### 3.6 2D 오버레이 디자인 토큰 통일

| 속성 | 통일값 |
|------|--------|
| 배경색 | `rgba(9, 9, 11, 0.90)` |
| 블러 | `blur(12px)` |
| 보더 | `1px solid rgba(255,255,255,0.08)` |
| 전환 속도 | `300ms ease` |
| 액센트 글로우 | 이벤트 색상 체계 따름 |
| 뉴스 태그 색상 | 3D 이펙트 통일 색상 체계와 동일 |

## 4. 요구사항

### 기능 요구사항

- [FR-1] 카메라 자동 포커스 레이스 컨디션 해결 (쉐이크와 포커스 순차 실행)
- [FR-2] 카메라 이벤트 우선순위 큐 시스템 (nuke > war > epoch > alliance > trade)
- [FR-3] 아크 높이 상향 (섹션 3.2 기준 적용)
- [FR-4] 통일 색상 체계 적용 (전체 13개 3D + 7개 2D 이펙트)
- [FR-5] 공유 아크 유틸리티 함수 추출 (`lib/effect-utils.ts`)
- [FR-6] 표면 고도 3단계 통일
- [FR-7] renderOrder 체계 재배정
- [FR-8] centroid prop 이름 통일 (`centroidsMap`으로)
- [FR-9] 2D 오버레이 디자인 토큰 통일 (`lib/overlay-tokens.ts`)
- [FR-10] 뉴스피드 이벤트 색상을 3D 이펙트 색상과 일치시킴
- [FR-11] OrbitControls 상태를 CameraAutoFocus와 동기화
- [FR-12] 인트로 완료 전 카메라 포커스 이벤트 큐잉 (defer)

### 비기능 요구사항

- [NFR-1] **성능**: 30개 동시 이펙트에서 60fps 유지 (모바일 30fps)
- [NFR-2] **draw call**: 이펙트 전체 draw call 50% 감소 (InstancedMesh 통합)
- [NFR-3] **메모리**: 머티리얼 풀링으로 GPU 메모리 사용 30% 감소
- [NFR-4] **LOD**: 카메라 거리에 따른 이펙트 3단계 LOD (close/mid/far)
- [NFR-5] **빌드**: TypeScript strict 에러 0개, 빌드 성공

## 5. 기술 방향

- **프레임워크**: React Three Fiber (R3F) + Three.js r160+
- **3D 최적화**: InstancedMesh 통합, 공유 BufferGeometry/Material 풀
- **셰이더**: 기존 커스텀 ShaderMaterial 유지, uniform 통일 (uTime, uColor, uOpacity)
- **좌표계**: `latLngToVector3` 단일 함수 사용 (geoToXYZ 내부용으로 격리)
- **카메라**: CameraAutoFocus + CameraShake 통합 컨트롤러로 리팩토링
- **상태관리**: 이펙트 우선순위 큐 (useRef 기반, 리렌더링 없음)
- **2D 토큰**: CSS 변수 또는 TS 토큰 파일 (`lib/overlay-tokens.ts`)

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 13개 이펙트 동시 리팩토링 시 회귀 버그 | 높음 | Phase별 순차 적용 + 각 Phase에서 빌드 검증 |
| InstancedMesh 통합 시 기존 애니메이션 깨짐 | 중간 | 기존 동작 보존 테스트 (시각적 비교) |
| 카메라 시스템 리팩토링 시 기존 인트로 깨짐 | 높음 | CameraAutoFocus를 먼저 수정, 인트로는 별도 |
| 아크 높이 상향 시 지구 반대편 아크가 부자연스러움 | 낮음 | 최대 높이 cap (globeRadius * 0.3) |
| 2D 토큰 변경 시 기존 UI 레이아웃 깨짐 | 중간 | 토큰 파일 먼저 생성, 점진적 적용 |

### 6.1 추가 리스크 (검증에서 발견)

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| GlobeLandmarks.tsx (레거시) + LandmarkSprites + LandmarkMeshes 3개 랜드마크 시스템 공존 | 중간 | Phase 4에서 LOD 통합 시 정리 (LandmarkMeshes 유지, 나머지 deprecate) |
| GlobeTitle 컴포넌트 색상/위치 미반영 | 낮음 | Phase 5에서 2D 오버레이 통일 시 포함 |
| 기존 색상 팔레트 충돌 (map-style.ts, sketch-ui.ts, globe-data.ts) | 높음 | Phase 1에서 effect-constants.ts 생성 시 기존 팔레트와 매핑 테이블 작성 |
| Bloom 후처리와 HDR 색상 상호작용 | 중간 | Phase 3에서 HDR 배수 조정 시 Bloom 설정 함께 확인 |
| prefers-reduced-motion 접근성 | 낮음 | Phase 6에서 LOD와 함께 모션 감소 모드 추가 |
| 사운드/SFX 큐 연동 | 낮음 | Phase 7에서 사운드 훅 포인트만 정의 (구현은 별도 버전) |

## 구현 로드맵

### Phase 1: 공유 인프라 추출 + 디자인 토큰 정의

| Task | 설명 |
|------|------|
| `lib/effect-constants.ts` 생성 | 통일 색상, 고도, renderOrder, 타이밍 상수 정의 |
| `lib/effect-utils.ts` 생성 | 공유 아크 생성 함수 (`createArcCurve`), 표면 좌표 함수, GC-prevention 객체 풀 |
| `lib/overlay-tokens.ts` 생성 | 2D 오버레이 공유 배경색, blur, border, transition 토큰 |
| centroid prop 이름 통일 | `centroidsMap` (5곳)을 모두 `countryCentroids`로 통일 (GlobeView prop 전달 포함) |
| 기존 색상 팔레트 매핑 | `map-style.ts`, `sketch-ui.ts`, `globe-data.ts`의 기존 색상 체계와 effect-constants.ts 간 매핑 테이블 작성. 충돌 색상 조정 |

- **design**: N
- **verify**: 빌드 성공, import 에러 없음, 기존 동작 변경 없음 (상수만 추출)

### Phase 2: 카메라 시스템 전면 수정

| Task | 설명 |
|------|------|
| CameraAutoFocus + CameraShake 통합 | 단일 `CameraController`로 병합. shake는 focus 완료 후에만 실행. 우선순위 큐 내장 |
| OrbitControls 동기화 | 카메라 이동 후 `controls.target` 갱신 + `controls.update()` 호출 |
| 이벤트 우선순위 큐 | nuke(5) > war(4) > epoch(3) > alliance(2) > trade(1). 높은 우선순위가 현재 애니메이션 중단 가능 |
| 인트로 중 이벤트 큐잉 | introActive=true일 때 카메라 이벤트를 큐에 저장, 인트로 완료 후 최상위 1개만 실행 |
| GlobeWarEffects에서 shake 분리 | CameraShake를 GlobeWarEffects 내부에서 제거, CameraController로 이관 |

- **design**: N
- **verify**: 전쟁 이벤트 시 카메라가 정확한 국가 위치로 이동, shake 후 점프 없음, 인트로 중 이벤트 큐잉 확인

### Phase 3: 아크 이펙트 통일 리디자인 (교역/동맹/전쟁/제재/스파이)

| Task | 설명 |
|------|------|
| 아크 높이 상향 적용 | 6개 아크 컴포넌트에 신규 ARC_HEIGHT_FACTOR 적용 (섹션 3.2) |
| 공유 아크 함수 사용 | 4개 중복 아크 생성 코드를 `lib/effect-utils.ts`의 공유 함수로 교체 |
| 색상 체계 적용 | 각 아크 이펙트에 통일 색상 (섹션 3.1) 적용 |
| GlobeTradeRoutes 최적화 | 개별 Mesh → InstancedMesh (카고별 archetype 그룹). 최대 30개 교역 라인 → 5 draw calls 이하 |
| GlobeAllianceBeam 개선 | Line + 파티클 시스템 유지, 높이 0.50 적용, 색상 통일 |
| GlobeWarEffects 아크 개선 | 전쟁 아크 높이 0.45, 대시 패턴을 공격적으로 변경 (짧은 dash, 빠른 애니메이션) |
| GlobeSanctionBarrier 개선 | 아크 높이 0.30, 오렌지 색상 적용, X마크 크기 통일 |
| GlobeSpyTrail 개선 | 아크 높이 0.25, 보라색 통일 (눈 아이콘 CanvasTexture는 이미 모듈 스코프 캐싱됨. SpriteMaterial clone만 최적화) |

- **design**: N
- **verify**: 빌드 성공, 모든 아크가 이전보다 높게 솟아오름, 색상 구분 명확, 검은박스 없음

### Phase 4: 표면 이펙트 통일 리디자인 (폭발/자원/핵/충격파/펄스)

| Task | 설명 |
|------|------|
| 표면 고도 3단계 적용 | 모든 이펙트에 Ground/Low/High 고도 통일 |
| renderOrder 체계 적용 | 전체 13개 이펙트에 신규 renderOrder 범위 배정 |
| GlobeResourceGlow 최적화 | 이벤트당 개별 Material → 공유 Material + color uniform |
| GlobeNukeEffect 최적화 | 공유 Geometry 풀, 색상 전이를 uniform으로 처리 |
| GlobeShockwave 유지 | 이미 풀링 사용 중. renderOrder만 재배정 |
| GlobeEventPulse 색상 통일 | 이벤트 타입별 색상을 통일 색상 체계로 교체 |
| GlobeConflictIndicators 색상 통일 | 전쟁 적색 통일 적용 |
| LandmarkMeshes/LandmarkSprites/GlobeLandmarks 정리 | LandmarkMeshes(MC 복셀) 기준으로 통합. LandmarkSprites는 LOD far 용으로 유지. GlobeLandmarks(레거시) deprecate. 고도 +0.3 → Ground(+0.5) 통일 |

- **design**: N
- **verify**: 빌드 성공, 이펙트 간 z-fighting 없음, 같은 고도에서 정렬됨

### Phase 5: 2D 오버레이 디자인 통일

| Task | 설명 |
|------|------|
| NewsFeed 색상 태그 통일 | 이벤트 타입 색상을 `lib/effect-constants.ts` 색상 체계와 동기화 |
| 오버레이 배경/blur 통일 | 모든 패널에 `overlay-tokens.ts` 토큰 적용 (GlobeHoverPanel, AgentSetup, LeftBar 등) |
| CSS 애니메이션 통합 | 중복 keyframe (`pulse`, `fadeIn`) 제거 → 글로벌 CSS 또는 토큰 유틸리티 |
| 전환 타이밍 통일 | 모든 전환을 300ms ease로 통일 (예외: 인트로 시퀀스) |
| GlobeTitle 통일 | GlobeTitle 컴포넌트 색상/폰트/위치를 디자인 토큰 체계에 맞춤 |

- **design**: Y (UI 토큰 변경)
- **verify**: 뉴스피드 이벤트 색상이 3D 이펙트와 일치, 패널 배경 일관성, 전환 부드러움

### Phase 6: 성능 최적화 + LOD

| Task | 설명 |
|------|------|
| InstancedMesh 통합 검토 | SanctionBarrier X마크 → InstancedMesh 전환 |
| Material 풀링 | ResourceGlow, NukeEffect의 이벤트당 Material clone 제거 → 공유 Material |
| SpyTrail SpriteMaterial 최적화 | CanvasTexture는 이미 캐싱됨. SpriteMaterial clone 수 최소화 (opacity를 uniform으로 처리) |
| 이펙트 LOD 3단계 | close(<200): 풀 디테일, mid(200-350): 파티클 수 50%, 아크 포인트 수 50%, far(>350): 아크만 표시 (파티클 숨김) |
| useFrame 통합 검토 | 가능한 이펙트끼리 단일 useFrame으로 병합 (성능 측정 후 결정) |
| Bloom 후처리 HDR 조정 | HDR 배수(2.0x~3.0x) 변경 시 UnrealBloomPass threshold/strength와 상호작용 확인. 과도한 글로우 방지 |
| prefers-reduced-motion 접근성 | `window.matchMedia('(prefers-reduced-motion: reduce)')` 감지 → 파티클/쉐이크/펄스 비활성화, 아크는 정적 라인으로 |
| LOD 2단계→3단계 브릿지 | 기존 `useGlobeLOD`가 2단계(close/far)인 경우 → 3단계(close/mid/far) 확장. LandmarkMeshes(close) ↔ LandmarkSprites(far) 전환 포함 |

- **design**: N
- **verify**: 30개 동시 이펙트에서 60fps (데스크탑), draw call 카운트 측정

### Phase 7: 좌표 검증 + 최종 통합 테스트

| Task | 설명 |
|------|------|
| 전체 이펙트 좌표 검증 | 주요 20개국 centroid에 디버그 마커 배치, 이펙트 위치와 일치 확인 |
| 카메라 포커스 전수 테스트 | 전쟁/동맹/핵/에포크 이벤트 시 카메라 목표 좌표 검증 |
| 동시 이펙트 스트레스 테스트 | 전쟁+교역+동맹+핵 동시 발생 시 시각적 충돌/성능 확인 |
| 모바일 성능 확인 | 모바일 LOD에서 30fps 유지 확인 |
| 검은박스 회귀 테스트 | 전체 이펙트 활성화 상태에서 모든 카메라 각도에서 검은박스 없음 확인 |
| 사운드 훅 포인트 정의 | 주요 이벤트(전쟁선포/핵발사/에포크전환)에 `onSoundCue` 콜백 인터페이스 정의 (실제 사운드 구현은 별도 버전) |

- **design**: N
- **verify**: 좌표 정확, 카메라 포커스 정확, 30개 동시 이펙트 60fps, 검은박스 없음
