# PLAN: v33 Globe 3D 성능 최적화

> 로비 Globe 3D 씬 프레임 드랍 근본 개선

## 1. 개요

### 배경
로비 GlobeView 씬이 **1,988줄 단일 파일 (18개 컴포넌트 + 12개 유틸리티)** + 16개 이상의 외부 3D 이펙트 컴포넌트로 구성되어 있으며, **매 프레임 평시 ~24개, 전쟁 3건 시 ~35개의 useFrame 콜백**이 동시 실행되면서 심각한 프레임 드랍이 발생하고 있습니다. 또한 파일 구조의 모듈화 부재로 유지보수성이 심각하게 저하되어 있습니다.

### 핵심 목표
- 데스크탑 60 FPS 안정 유지 (현재 추정 30~45 FPS)
- 모바일 30 FPS 안정 유지
- 기존 비주얼 품질 최대한 유지하면서 렌더링 효율 극대화

### 분석 대상 파일
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `components/lobby/GlobeView.tsx` | ~2,000 | 메인 Globe 씬 (Earth, Clouds, Atmosphere, Labels, Interaction) |
| `components/3d/LandmarkMeshes.tsx` | ~611 | 복셀 랜드마크 (N개 ArchetypeGroup useFrame) |
| `components/3d/GlobeWarEffects.tsx` | ~1,200 | 전쟁 이펙트 (Arc, Territory, Fog, Fireworks, Explosion) |
| `components/3d/GlobeMissileEffect.tsx` | — | 미사일 궤적 |
| `components/3d/GlobeShockwave.tsx` | — | 충격파 링 |
| `components/3d/GlobeCountryLabels.tsx` | — | 국기 라벨 |
| `components/3d/GlobeTradeRoutes.tsx` | — | 무역 루트 |
| `components/3d/GlobeEventPulse.tsx` | — | 이벤트 펄스 |
| `components/3d/GlobeEventLabels.tsx` | — | 뉴스 라벨 |
| `components/3d/GlobeAllianceBeam.tsx` | — | 동맹 빔 |
| `components/3d/GlobeSanctionBarrier.tsx` | — | 제재 배리어 |
| `components/3d/GlobeResourceGlow.tsx` | — | 자원 글로우 |
| `components/3d/GlobeSpyTrail.tsx` | — | 첩보 트레일 |
| `components/3d/GlobeNukeEffect.tsx` | — | 핵 이펙트 |
| `components/3d/GlobeConflictIndicators.tsx` | — | 충돌 인디케이터 |
| `components/3d/GlobeDominationLayer.tsx` | — | 지배 오버레이 |
| `components/3d/GlobeIntroCamera.tsx` | — | 인트로 카메라 |
| `hooks/useGlobeLOD.ts` | 250 | LOD 시스템 (디바이스+거리) |

---

## 2. 문제 분석 (우선순위 순)

### P0 — Critical (FPS 10~20 영향)

#### P0-1: useFrame 콜백 폭발 (평시 ~24개, 최악 ~35개/프레임)
- **문제**: GlobeView(10) + 3D 컴포넌트(14) + 아키타입 그룹(~6-8) + 전쟁당(5×N) → 프레임당 24~35회 JS 함수 호출
- **원인**: 컴포넌트별 독립 애니메이션 루프 설계
- **영향**: JS main thread 과부하, 함수 호출 오버헤드, ref 룩업 비용 누적
- **측정 항목**: `performance.now()` 기준 useFrame 총 실행시간

#### P0-2: Bloom 포스트프로세싱 (렌더링 비용 2배)
- **문제**: `EffectComposer > Bloom(mipmapBlur)` → 전체 씬 이중 렌더링
- **위치**: `GlobeView.tsx:1899-1910`
- **설정**: `luminanceThreshold=0.4` (낮음), `radius=0.75`, `intensity=1.2`
- **영향**: GPU 부하 2배, 밉맵 체인 생성 + 다단계 블러 + 합성

#### P0-3: LandmarkMeshes N개 useFrame + 매 프레임 버퍼 업로드
- **문제**: Archetype×Biome 조합별 별도 `ArchetypeInstancedMesh` → 각각 useFrame
- **위치**: `LandmarkMeshes.tsx` — `ArchetypeInstancedMesh` 컴포넌트
- **세부**: `instanceMatrix.needsUpdate = true` + 4개 edge attr(m0~m3) + **정적 데이터 biomeAttr/ageAttr까지** `needsUpdate = true` → 총 7개 attribute 매 프레임 GPU 재업로드
- **핵심**: biomeIdx와 ageSeed는 useMemo에서 1회 계산되는 **완전 정적 데이터**인데 매 프레임 GPU 전송 — 가장 불필요한 낭비
- **영향**: 카메라 정지 시에도 불필요한 GPU 전송 지속

### P1 — High (FPS 3~8 영향)

#### P1-1: 4×`new Date()` 할당 + 4× 동일 태양 방향 계산
- **문제**: EarthSphere, EarthClouds, AtmosphereGlow, SunLight가 각각 `new Date()` 2회 생성 + 삼각함수 계산
- **위치**: `GlobeView.tsx:628, 744, 831, 885`
- **영향**: 프레임당 8개 Date 객체 = 480/초 GC 대상 + 4× 중복 sin/cos 연산
- **참고**: `LandmarkMeshes.tsx`는 이미 `Date.now()` + 모듈 스코프 캐싱으로 올바르게 구현

#### P1-2: 5× 고해상도 구체 지오메트리 (33,280 삼각형)
- **문제**: Earth, Clouds, Atmosphere, Sun, Interaction 구체가 모두 64×64 세그먼트
- **위치**: `GlobeView.tsx:644, 759, 845, 905, 1109`
- **세부**: Interaction 구체 (투명, colorWrite=false) — 레이캐스팅 전용인데 8,192 삼각형
- **영향**: 불필요한 GPU vertex 처리

#### P1-3: GlobeWarEffects 5~6개 서브 useFrame (전쟁당 N배)
- **문제**: WarArc, TerritoryBlink, WarFog, VictoryFireworks, Explosion 각각 useFrame
- **위치**: `GlobeWarEffects.tsx`
- **세부**: 활성 전쟁 N개 × 3~5 = 최대 15~30 추가 useFrame
- **영향**: 전쟁 활성화 시 급격한 FPS 하락

### P2 — Medium (FPS 1~3 영향)

#### P2-1: CountryLabels 200개국 매 프레임 순회
- **문제**: 데스크탑 maxLabels=200, 매 프레임 200× (dot product + quaternion + projection + lerp)
- **위치**: `GlobeView.tsx:1386-1453`
- **영향**: CPU 바운드 루프, troika Text 렌더링 비용 추가

#### P2-2: GeoJSON 3~4회 중복 로딩
- **문제**: CountryBorders, GlobeInteraction, HoverBorderGlow, GlobeScene이 각각 `loadGeoJSON()`
- **위치**: `GlobeView.tsx` 내 여러 컴포넌트
- **영향**: 초기 로딩 지연, earcut 삼각화 중복 실행

#### P2-3: 메모리 누수 (Material/Geometry dispose 미흡)
- **문제**: useMemo로 생성한 셰이더 머티리얼, 캔버스 텍스처 등 cleanup 없음
- **위치**: EarthClouds, AtmosphereGlow, SunLight 등
- **영향**: 장시간 사용 시 점진적 성능 저하

---

## 3. 기술 방향

### 핵심 전략: "하나의 틱, 하나의 루프"

```
현재: Component₁.useFrame() + Component₂.useFrame() + ... + Component₅₀.useFrame()
목표: GlobeTickSystem.useFrame() → tick(EarthGroup) → tick(Effects) → tick(Labels)
```

- **중앙 집중 틱 시스템**: 1~3개의 useFrame으로 통합
- **Dirty Flag 패턴**: 변화 없으면 GPU 업로드 스킵
- **공유 연산 캐시**: 태양 방향, 카메라 위치 등 프레임당 1회만 계산
- **적응형 품질**: 런타임 FPS 모니터링 → 자동 품질 조절

### 프레임워크
- React Three Fiber (기존 유지)
- `@react-three/postprocessing` (Bloom 최적화 또는 제거)
- Three.js InstancedMesh (기존 유지, 업데이트 로직 개선)

---

## 4. 아키텍처 개요

```
┌─ GlobeCanvas (R3F Canvas) ─────────────────────────┐
│                                                      │
│  ┌─ GlobeTickSystem (useFrame ×1) ──────────────┐   │
│  │                                                │   │
│  │  1. computeSharedState()                       │   │
│  │     - sunDirection (1회 계산)                   │   │
│  │     - cameraPos, cameraDist                    │   │
│  │     - deltaTime, elapsedTime                   │   │
│  │                                                │   │
│  │  2. tickEarthGroup(shared)                     │   │
│  │     - Earth rotation, Cloud rotation           │   │
│  │     - Atmosphere glow update                   │   │
│  │     - SunLight position                        │   │
│  │                                                │   │
│  │  3. tickEffects(shared)                        │   │
│  │     - War effects (arc, fog, particles)        │   │
│  │     - Landmarks (dirty flag 기반)              │   │
│  │     - Labels (spatial culling)                 │   │
│  │                                                │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Static Render Tree (useFrame 없음) ──────────┐   │
│  │  Earth mesh, Cloud mesh, Atmosphere mesh       │   │
│  │  Country borders, Landmarks (InstancedMesh)    │   │
│  │  Labels (troika Text)                          │   │
│  │  Effects (conditional render)                  │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ PostProcessing (조건부) ─────────────────────┐   │
│  │  Bloom: threshold↑, quality↓ 또는 UnrealBloom  │   │
│  │  FPS < 45 → 자동 비활성화                       │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 중앙 틱 시스템 리팩토링 범위가 너무 큼 | 진행 지연, 회귀 버그 | Phase별 점진 적용 (P0만 먼저) |
| Bloom 제거 시 비주얼 품질 저하 | 사용자 만족도 하락 | Threshold 조정 + FPS 기반 토글로 타협 |
| LandmarkMeshes dirty flag 도입 복잡성 | 카메라 이동 시 업데이트 누락 | 카메라 delta 임계값 기반 dirty 판정 |
| useFrame 통합 시 컴포넌트 독립성 상실 | 유지보수 어려움 | SharedTickContext로 느슨한 결합 유지 |

---

## 구현 로드맵

> ★ 검증 보고서 반영: Phase 0 추가, 누락 항목 보완, 수치 정정 완료

### Phase 0: GlobeView.tsx 모듈 분리 (리팩토링 기반)
| Task | 설명 |
|------|------|
| 유틸리티 함수 분리 | 12개 유틸 (xyzToGeo, pointInRing, findCountryAtPoint, subdivide*, build*, compute*) → `lib/globe-geo.ts` + `lib/globe-utils.ts` |
| 셰이더 분리 | EarthSphere/EarthClouds/AtmosphereGlow 커스텀 셰이더 → `lib/globe-shaders.ts` |
| 텍스처 팩토리 분리 | createBlackTexture, createFlatNormalTexture, createBlackSpecularTexture → `lib/texture-utils.ts` |
| EarthGroup 분리 | EarthSphere + EarthClouds + AtmosphereGlow + SunLight → `components/3d/EarthGroup.tsx` (~270줄) |
| CountryLayer 분리 | CountryBorders + CountryPolygons + CountryHoverHighlight + HoverBorderGlow → `components/3d/CountryLayer.tsx` (~350줄) |
| CountryLabels 분리 | 독립 컴포넌트 → `components/3d/GlobeCountryNameLabels.tsx` (~120줄) |
| GlobeInteraction 분리 | Interaction + SizeGate → `components/3d/GlobeInteractionLayer.tsx` (~70줄) |
| Starfield 분리 | → `components/3d/Starfield.tsx` |
| GlobeTitle 분리 | GlobeTitle + useNoBloomMaterial → `components/3d/GlobeTitle.tsx` |
| 인라인 객체 상수화 | `new Map()`, `new Set()` (1938,1940,1944줄) → 모듈 스코프 상수 `EMPTY_DOM_MAP`, `EMPTY_STATE_MAP`, `EMPTY_SET` |
| GlobeScene 슬림화 | 분리된 컴포넌트 import + 조립만 → GlobeView.tsx ~300줄 |

- **design**: N (구조 리팩토링)
- **verify**: 빌드 성공, 비주얼 동일성, import 경로 정합성, 기존 기능 회귀 없음

### Phase 1: 즉각 성능 개선 — Low-Hanging Fruit
| Task | 설명 |
|------|------|
| 태양 방향 계산 통합 | 4× 중복 `new Date()` + 삼각함수 → `useSunDirection` 훅 1개로 통합, `Date.now()` + 모듈 캐시 사용 |
| Interaction 구체 경량화 | 64×64 → 16×16 세그먼트 (8,192 → 512 삼각형), 레이캐스팅 전용 |
| Bloom 임계값 상향 + 적응형 | `luminanceThreshold` 0.4 → 0.7, FPS < 45시 자동 비활성화 로직 |
| Atmosphere 세그먼트 감소 | 64×64 → 48×48 (Atmosphere만, Clouds 유지) |
| AtmosphereGlow 인라인 uniforms 수정 | :850 인라인 `uniforms={{...}}` → useMemo uniforms 사전 생성 |
| GlobeShockwave temp 객체 수정 | :142-143 `new Vector3/Quaternion` → 모듈 스코프 temp |
| GlobeEventPulse clone 제거 | :282 `position.clone()` → temp Vector3 재사용 |
| GlobeTradeRoutes Date.now 교체 | :317 `Date.now()` → `state.clock.elapsedTime` |

- **design**: N (코드 최적화 중심)
- **verify**: FPS 측정 비교 (before/after), 비주얼 회귀 체크

### Phase 2: LandmarkMeshes 최적화
| Task | 설명 |
|------|------|
| 정적 attribute needsUpdate 제거 | biomeAttr/ageAttr은 정적 데이터 — needsUpdate 초기 세팅 후 매 프레임 업로드 중단 |
| Dirty flag 도입 | 카메라 이동 delta > 임계값일 때만 instanceMatrix + edge attribute 업데이트 |
| Archetype useFrame 통합 | N개 ArchetypeInstancedMesh useFrame → 부모 1개 useFrame에서 일괄 처리 |
| LOD 연동 강화 | far 거리 시 랜드마크 업데이트 주기 낮춤 (매 2~3프레임) |

- **design**: N
- **verify**: 랜드마크 표시 정상, 카메라 회전 시 깜빡임 없음, FPS 개선 측정

### Phase 3: GlobeView 핵심 컴포넌트 useFrame 통합
| Task | 설명 |
|------|------|
| SharedTickContext 생성 | `sunDir`, `cameraPos`, `cameraDist`, `delta`, `elapsed` 공유 컨텍스트 |
| EarthGroup 틱 통합 | EarthSphere + EarthClouds + AtmosphereGlow + SunLight → 단일 useFrame |
| CountryLabels 최적화 | 뷰 프러스텀 + 거리 기반 공간 컬링, 매 프레임 전체 순회 → 가시 라벨만 |
| Starfield + HoverBorderGlow 통합 | 독립 useFrame → SharedTick 콜백으로 편입 |

- **design**: N
- **verify**: 비주얼 동일성, useFrame 콜백 수 15개 이하, FPS 개선 측정

### Phase 4: 이펙트 컴포넌트 useFrame 통합 + 세부 최적화
| Task | 설명 |
|------|------|
| GlobeWarEffects 통합 | 전쟁당 5개 서브 useFrame → 부모 1개에서 전쟁 루프 처리 |
| GlobeMissileEffect 통합 | useFrame 1개 유지, count를 활성 미사일 수로 동적 조정 |
| 나머지 이펙트 통합 | TradeRoutes, EventPulse, AllianceBeam 등 → SharedTick 패턴 |
| 조건부 틱 스킵 | 비활성 이펙트는 useFrame 등록 자체 방지 (early return이 아닌 조건부 마운트) |
| GlobeConflictIndicators lazy init | :280-287 매 프레임 attribute 존재 확인 → useEffect 1회 초기화 |
| GlobeShockwave material dispose | :177 clone 5개 → unmount 시 dispose 추가 |
| GlobeEventPulse material dispose | useMemo material pool → useEffect cleanup |

- **design**: N
- **verify**: 전쟁/미사일/이벤트 이펙트 정상 동작, useFrame 총 10개 이하

### Phase 5: 적응형 품질 시스템 (AdaptiveQuality)
| Task | 설명 |
|------|------|
| FPS 모니터 구현 | 이동평균 FPS 측정 (30프레임 윈도우), 품질 티어 자동 전환 |
| 3단계 품질 프리셋 | Ultra(현재) / High(Bloom off, 라벨 100개) / Medium(이펙트 50% 감소) |
| 기존 LOD 시스템 통합 | `useGlobeLOD` + `useGlobeLODDistance` + AdaptiveQuality 통합 |
| 사용자 수동 설정 UI | 설정 패널에서 품질 강제 선택 옵션 |

- **design**: Y (설정 UI)
- **verify**: FPS 모니터링 정확도, 품질 전환 시 깜빡임 없음, 저사양에서 안정 30 FPS

### Phase 6: 메모리 누수 수정 + GeoJSON 로딩 통합
| Task | 설명 |
|------|------|
| Material/Geometry dispose 전면 적용 | GlobeView 내 5개 useMemo 리소스(601,719,867,1243,1547줄) + 외부 컴포넌트 누수 일괄 수정 |
| GeoJSON 로딩 중앙화 | 4회 `loadGeoJSON()` → 1회 로딩 + React Context로 공유, earcut 삼각화 결과 캐시 |
| 캔버스 텍스처 정리 | SunLight glowTexture 등 dispose 추가 |

- **design**: N
- **verify**: Chrome DevTools Memory 프로파일, 로비 재진입 시 메모리 증가 없음

### Phase 7 (선택): GlobeDominationLayer InstancedMesh 전환
| Task | 설명 |
|------|------|
| 195개 개별 ShaderMaterial → 단일 InstancedMesh | per-instance color/phase/fade uniform → InstancedBufferAttribute로 전환 |
| Draw call 최적화 | 195 draw call → 1 draw call |

- **design**: N
- **verify**: 지배 오버레이 시각 동일성, 195국 동시 활성화 시 FPS 측정
