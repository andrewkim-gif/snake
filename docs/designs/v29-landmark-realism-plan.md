# PLAN: v29 Globe Landmark Realism Enhancement

> **Version**: v29 | **Date**: 2026-03-09
> **Goal**: 3D 구체 위 랜드마크/건물의 시각적 사실감과 다양성을 대폭 향상

---

## 1. 개요

### 현재 문제점

3D 지구본 위의 195개국 랜드마크 건물이 **시각적으로 이질적**이다:

1. **색상 일관성 (Color Monotony)**: 같은 아키타입(예: MOSQUE)을 공유하는 12개국이 완전히 동일한 색상 — 사우디 사막의 모스크와 인도네시아 열대 모스크가 구분 불가
2. **텍스처 단조로움**: 32x32 절차적 텍스처가 6가지 패턴(noise/brick/wood/crystal/stripe/plain)으로만 구성 — 클로즈업 시 해상도 부족
3. **환경 부조화**: 바이옴/기후 정보가 전혀 반영되지 않아, 눈 덮인 노르웨이와 사하라 사막의 건물이 동일한 분위기
4. **스케일 균일성**: 모든 건물이 동일 크기(LANDMARK_SCALE=1.5) — 바티칸 성당과 태평양 섬 오두막이 같은 크기
5. **형태 반복**: 같은 아키타입은 geometry까지 100% 동일 — 회전/스케일 변형조차 없음
6. **정적 존재감**: 애니메이션 없이 완전 정지 — 주변 이펙트(미사일, 펄스, 빔)의 역동성과 대비되어 더 이질적
7. **조명 단순성**: 단방향 태양광 + 고정 AO만 존재 — 환경광(안개, 대기산란) 없음
8. **아웃라인 성능**: 42 아키타입 × 2 드로콜(메쉬+엣지) = 최대 84 드로콜

### 핵심 목표

| 목표 | 측정 기준 |
|------|----------|
| 바이옴 기반 색조 변형 | 6개 바이옴별 고유한 시각적 분위기 |
| 인스턴스별 변형 | 같은 아키타입도 국가마다 미묘하게 다름 |
| 텍스처 고도화 | 64x64 셀 + 바이옴 틴트 오버레이 |
| 스케일 차등화 | Tier별 크기 차이 (S급 1.8x, C급 1.0x) |
| 환경 통합 | 바이옴별 대기/안개 느낌이 건물에 반영 |
| 성능 유지 | 데스크탑 60fps, 모바일 30fps 보장 |

---

## 2. 요구사항

### 기능 요구사항

- [FR-1] **바이옴 색조 시스템**: 6개 바이옴(temperate/arid/tropical/arctic/mediterranean/urban)별 건물 색조 변형
- [FR-2] **인스턴스 변형**: 같은 아키타입의 각 인스턴스가 미세한 회전/스케일/색조 차이를 가짐
- [FR-3] **티어 기반 스케일**: S급(Tier1) 건물은 크게, C급(Tier3)은 작게
- [FR-4] **텍스처 해상도 업그레이드**: 32x32 → 64x64 셀 (아틀라스 256→512)
- [FR-5] **환경광 통합**: 바이옴별 안개색/대기색이 건물 셰이더에 영향
- [FR-6] **바이옴 블록 변형**: 같은 STONE 블록도 arctic에서는 눈 덮인 색, arid에서는 모래 빛깔
- [FR-7] **미세 애니메이션**: 깃발 펄럭임, 창문 반짝임 등 서틀한 움직임 (선택적)

### 비기능 요구사항

- [NFR-1] 성능: 추가 드로콜 ≤ 5, GPU 메모리 증가 ≤ 2MB
- [NFR-2] 호환성: 기존 LOD 시스템(3단계 + 히스테리시스)과 완전 호환
- [NFR-3] 모바일: 바이옴 틴트는 적용, 텍스처 업그레이드는 선택적
- [NFR-4] 점진적 적용: Phase별 독립 빌드 가능, 롤백 안전

---

## 3. 기술 방향

### 핵심 전략: "셰이더 기반 바이옴 틴트 + 인스턴스 속성 확장"

**왜 셰이더인가?**
- 42개 아키타입 × 6개 바이옴 = 252개 geometry 생성? → **불가능** (메모리 폭발)
- 대신: geometry는 유지 + **셰이더 uniform/attribute로 바이옴별 시각 변형**
- InstancedMesh의 `instanceColor`와 커스텀 attribute로 per-instance 데이터 전달

### 기술 스택

| 영역 | 현재 | 변경 |
|------|------|------|
| 텍스처 아틀라스 | 256×256 (32px/셀) | **512×512 (64px/셀)** |
| 셰이더 | 단순 diffuse + AO | **+ 바이옴 틴트 + 환경광 + 풍화 노이즈** |
| 인스턴스 데이터 | position/rotation/scale만 | **+ biomeIndex + tintColor + ageSeed** |
| 바이옴 데이터 | 없음 (게임뷰만 사용) | **country-biome-map.ts 재활용** |
| 스케일 | 균일 1.5 | **Tier 기반: 1.8/1.4/1.0** |

### 바이옴 시각 정의 (새로 정의)

```
temperate:  base tint #D4C9A8 (warm stone), fog #8BA4B8 (cool mist)
arid:       base tint #E8D5A3 (sand wash), fog #C4A872 (dust haze)
tropical:   base tint #A8C4A0 (moss green), fog #7BA68C (humid mist)
arctic:     base tint #C8D8E8 (ice blue),  fog #B0C4D8 (snow fog)
mediterranean: base tint #E0C8A0 (terra warm), fog #A0B8C8 (sea haze)
urban:      base tint #B8B8B8 (concrete), fog #909090 (smog)
```

---

## 4. 아키텍처 개요

### 데이터 플로우 (변경 후)

```
country-biome-map.ts ──→ landmark-data.ts (Landmark + biome 필드 추가)
                              │
mc-blocks.ts ─→ mc-texture-atlas.ts (512x512 업그레이드)
                              │
landmark-geometries.ts ────→ LandmarkMeshes.tsx
                              │
  [NEW] biome-tint-table.ts ─┤  (바이옴별 틴트 색상/환경광 테이블)
                              │
                              ▼
                    Enhanced ShaderMaterial
                    ├─ uMap (512x512 atlas)
                    ├─ uSunDir (기존)
                    ├─ uBiomeTints[6] (바이옴별 색조)
                    ├─ uBiomeFogs[6] (바이옴별 안개)
                    ├─ instanceColor (per-instance biome tint)
                    └─ aBiomeIndex (per-instance float attribute)
```

### 셰이더 변경 핵심

```glsl
// 새로운 uniform/attribute
uniform vec3 uBiomeTint;     // 현재 인스턴스의 바이옴 틴트
uniform vec3 uBiomeFog;      // 현재 인스턴스의 바이옴 안개색
attribute float aBiomeIdx;   // 바이옴 인덱스 (0-5)
attribute float aAgeSeed;    // 풍화/노화 시드 (0-1)

// Fragment shader 변경:
// 1. albedo에 바이옴 틴트를 소프트 믹스
color = mix(color, color * biomeTint, 0.25);

// 2. 풍화 효과 (노이즈 기반 어둡게/밝게)
float weathering = hash(vUv * 100.0 + aAgeSeed) * 0.15;
color *= (1.0 - weathering);

// 3. 대기 산란 (거리 기반 안개)
float fogFactor = smoothstep(0.0, 0.4, distFromCamera);
color = mix(color, biomeFog, fogFactor * 0.15);
```

---

## 5. 리스크

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| InstancedMesh에 커스텀 attribute 추가 시 호환성 | High | THREE.InstancedBufferAttribute 사용 (공식 API) |
| 512x512 아틀라스가 모바일에서 무거움 | Medium | 모바일은 256x256 유지 (조건부 분기) |
| 바이옴 틴트가 MC 픽셀 미학을 해칠 수 있음 | Medium | 틴트 강도를 0.15~0.25로 서틀하게 제한 |
| 기존 밤 이미시브 + 바이옴 틴트 충돌 | Low | 이미시브는 틴트 적용 전에 별도 계산 |
| 42 아키타입 geometry 재생성 (텍스처 업그레이드) | Medium | UV만 리맵, geometry 구조는 불변 |
| 퍼포먼스 하락 (추가 attribute 대역폭) | Low | float 2개 추가뿐 (biomeIdx + ageSeed = 8 bytes/instance) |

---

## 구현 로드맵

### Phase 1: 바이옴 데이터 파이프라인 연결

| Task | 설명 |
|------|------|
| Landmark 인터페이스 확장 | `biome: BiomeType` 필드 추가 to Landmark interface |
| generateLandmarksFromCentroids 수정 | `getCountryBiome(iso3)` 호출하여 바이옴 할당 |
| 바이옴 틴트 테이블 생성 | `lib/biome-landmark-tints.ts` — 6개 바이옴별 tint/fog/weathering 상수 |
| LandmarkMeshes에 바이옴 데이터 전달 | 그룹화 시 바이옴 정보 포함 |

- **design**: N (데이터 파이프라인)
- **verify**: 빌드 성공, 각 Landmark 객체에 biome 필드 존재 확인

### Phase 2: 셰이더 고도화 — 바이옴 틴트 + 풍화

| Task | 설명 |
|------|------|
| InstancedBufferAttribute 추가 | `aBiomeIdx`(float), `aAgeSeed`(float) per-instance attribute |
| Fragment shader 바이옴 틴트 적용 | biome index → tint color lookup → soft mix with albedo |
| 풍화(Weathering) 노이즈 | hash 함수 기반 per-pixel 변형 (건물별 고유 시드) |
| 환경 안개(Atmospheric Fog) | 바이옴별 fog color을 거리 기반으로 블렌딩 |
| instanceColor 활용 | THREE.InstancedMesh.instanceColor로 per-instance tint 전달 |

- **design**: N (셰이더 엔지니어링)
- **verify**: 6개 바이옴 국가의 건물이 각각 다른 색조, 같은 아키타입 건물 간 미세한 색상 차이 확인

### Phase 3: 텍스처 아틀라스 업그레이드

| Task | 설명 |
|------|------|
| 아틀라스 512×512 확대 | mc-texture-atlas.ts — canvas 크기 + 셀 크기 64×64 |
| 패턴 디테일 강화 | 기존 6패턴의 해상도 향상 (brick mortar 디테일, wood grain 등) |
| 바이옴 변형 블록 추가 | SNOW_STONE, SAND_BRICK, MOSS_WOOD 등 바이옴 특화 블록 6~8종 |
| UV 리맵핑 호환 | buildVoxelGeometry의 getBlockUV가 새 아틀라스 좌표 사용 |
| 모바일 분기 | 모바일은 기존 256×256 유지 (useGlobeLOD 조건) |

- **design**: N (텍스처 생성 로직)
- **verify**: 아틀라스 텍스처 크기 512×512 확인, 클로즈업 시 디테일 향상 확인, 모바일에서 256 유지

### Phase 4: 인스턴스 변형 + 스케일 차등화

| Task | 설명 |
|------|------|
| Tier 기반 스케일 | TIER_1: 1.8, TIER_2: 1.4, TIER_3: 1.0 (기존 균일 1.5 대체) |
| Y축 회전 변형 | iso3 해시 기반 0~360° 랜덤 회전 (같은 아키타입도 방향 다르게) |
| 스케일 미세 변형 | ±10% 랜덤 스케일 jitter (iso3 시드 기반 결정론적) |
| 바이옴별 블록 치환 | arid 국가의 STONE → SANDSTONE, arctic의 지붕 → SNOW 톱 추가 |
| 도시 국가 특수 처리 | urban 바이옴 → SKYSCRAPER 아키타입 강제 + 1.2x 추가 스케일 |

- **design**: N (로직)
- **verify**: 같은 MOSQUE 아키타입 국가들이 서로 다른 회전/크기로 렌더링, Tier1이 눈에 띄게 큼

### Phase 5: 환경 조명 고도화 + 미세 애니메이션

| Task | 설명 |
|------|------|
| 바이옴별 환경광 강도 조정 | arctic 밝은 반사 / tropical 부드러운 그림자 / arid 강한 명암 |
| 하이라이트 스페큘러 힌트 | 금속/크리스탈 블록에 태양 방향 스페큘러 반짝임 |
| 창문 반짝임 애니메이션 | 밤에 창문 발광이 미세하게 깜빡 (time + hash 기반) |
| 깃발/안테나 흔들림 | vertex shader에서 상단 vertex 미세 진동 (선택적, LOD 0만) |
| Bloom 최적화 | 바이옴 틴트가 bloom threshold에 미치는 영향 검증/보정 |

- **design**: N (셰이더 + 애니메이션)
- **verify**: 밤낮 전환 시 건물 분위기 변화, 금속 블록 반짝임, 창문 깜빡임 확인

### Phase 6: 통합 검증 + 성능 최적화

| Task | 설명 |
|------|------|
| 전체 195국 렌더링 테스트 | 모든 바이옴 × 아키타입 조합 시각적 검증 |
| 성능 프로파일링 | FPS 측정 (데스크탑/모바일), 드로콜 카운트, GPU 메모리 |
| LOD 호환성 확인 | 3단계 LOD 전환 시 바이옴 틴트/스케일 정상 적용 |
| 기존 이펙트 충돌 검증 | ConflictIndicators, EventPulse, WarEffects와의 z-order 확인 |
| 에지 케이스 처리 | centroid 없는 국가, 바이옴 매핑 없는 국가 fallback |

- **design**: N (QA)
- **verify**: 60fps 데스크탑 / 30fps 모바일, 드로콜 ≤ 89 (기존 84 + 5), 시각적 아티팩트 없음

---

## 6. 확장 분석: 사용자가 생각하지 못했을 부분들

### 6-A. "왜 이질적으로 보이는가"의 근본 원인

단순히 "색이 같다"가 문제가 아니다. **인지적 부조화(Cognitive Dissonance)** 가 핵심:

1. **지구본 텍스처와의 색온도 충돌**: EarthSphere는 위성 사진 기반으로 자연스러운 색감을 가지는데, 그 위에 MC 스타일의 **순수 디지털 색상**(#FFD700 금, #FFFFFF 백)이 올라가니 "포토샵 합성" 느낌
2. **그림자 부재**: 지구 표면에 건물 그림자가 드리워지지 않아 "붙어있지 않고 떠있는" 느낌 — 접지감(grounding) 부족
3. **대기 원근법 없음**: 실세계에서 먼 건물은 대기 때문에 푸르스름해지는데, 현재 모든 거리의 건물이 동일한 채도 — "2D 스티커" 느낌
4. **스케일 리얼리즘**: 구체 반지름 100 대비 건물 유효 크기 2.7 = 지구 반지름의 2.7% → 실제론 ~170km 높이. 이 초현실적 스케일 자체는 의도된 것이지만, **일관된 스케일이 "장식" 같은 인상**을 준다

### 6-B. 접지감(Grounding) 강화 — 건물 기저부 처리

현재 건물이 구체 표면에 "꽂힌" 느낌이 아니라 "올려놓은" 느낌인 이유:
- 건물 하단이 정확히 구체 표면에서 시작하지만, **기초/플랫폼이 없다**
- 해결: 각 건물 아래에 작은 원형 또는 사각형 **기초 플레이트(Foundation Plate)** 추가
- 기초 색상을 바이옴에 맞춤: arid = 모래색, arctic = 눈색, tropical = 풀색
- 이것만으로도 "떠있는 느낌"이 크게 줄어든다
- 비용: 건물당 PlaneGeometry 1개 추가 (InstancedMesh로 묶으면 1 드로콜)

### 6-C. 대기 원근법(Atmospheric Perspective) — 가장 큰 시각 임팩트

실세계 건축 사진에서 "자연스러움"의 핵심은 대기:
- **근거리**: 원래 색상 100%
- **중거리**: 약간 탈채도 + 바이옴 안개색 5~10% 혼합
- **원거리**: 강한 탈채도 + 안개색 20~30% 혼합

이것을 셰이더에서 구현하면 **단일 변경으로 가장 큰 자연스러움 향상**을 얻는다. Phase 2 셰이더 작업에 포함시킴.

### 6-D. 지구 표면 색상 샘플링

가장 야심찬 아이디어: 건물 위치의 **지구 텍스처 색상을 샘플링**하여 자동 색조 결정
- 건물 lat/lng → 구체 UV → Earth 텍스처에서 색상 읽기
- 그 색상을 건물 틴트로 사용: 사하라 위의 건물은 자동으로 모래색, 시베리아는 눈 색
- **장점**: 바이옴 테이블 불필요, 자연스러운 연속 변화
- **단점**: GPU 텍스처 읽기 필요 (성능), Earth 텍스처가 런타임에 접근 불가할 수 있음
- **결론**: Phase 2의 바이옴 틴트로 충분. 이 아이디어는 v30+ 고도화로 보류

### 6-E. 시간대 기반 활동감

현재 밤 이미시브는 모든 건물이 동일한 강도로 빛남. 실세계에서는:
- **urban 바이옴**: 밤에 매우 밝음 (네온, 조명)
- **arid 바이옴**: 밤에 어둡고 따뜻한 소수 불빛
- **arctic 바이옴**: 밤이 길고, 오로라 반사 느낌
- **tropical 바이옴**: 중간 밝기, 따뜻한 톤

→ 바이옴별 `nightEmissiveIntensity` 상수로 분화 가능 (Phase 5에 포함)

### 6-F. 전쟁 상태 시각 피드백

현재 ConflictIndicators가 적색 표시를 하지만, **건물 자체는 전쟁 중에도 변화 없음**:
- 전쟁 중인 국가의 건물에 미세한 적색 틴트 또는 "파손" 효과 가능
- 셰이더의 `aBiomeIdx` attribute 옆에 `aWarState`(0/1) 추가
- 전쟁 시 → 건물 색조 desaturate + 미세 적색 + 이미시브 감소 (정전 느낌)
- **이것은 v29 스코프 밖이지만**, 셰이더 확장 시 attribute 슬롯을 예비해 두면 좋음

### 6-G. 그림자 매핑 — 비용 대비 효과 분석

건물이 지구에 그림자를 드리우면 접지감이 극적으로 향상되지만:
- **문제**: 195개 건물의 shadow map은 극도로 비싸다 (모바일 불가)
- **대안**: 각 건물 아래에 **원형 그라디언트 Fake Shadow** (기초 플레이트에 합침)
- 태양 방향에 따라 그림자 위치를 미세 오프셋하면 놀라울 정도로 사실적
- 비용: 0 추가 드로콜 (기초 플레이트 텍스처에 그라디언트 포함)

### 6-H. MC 미학과 리얼리즘의 균형점

**주의**: 너무 사실적으로 만들면 MC 복셀 미학이 훼손됨
- 현재 NearestFilter + 32px 텍스처 + 블록 아웃라인 = 의도된 MC 스타일
- 바이옴 틴트는 **색조만 바꾸지 해상도/필터는 유지** → MC 느낌 보존
- 풍화 노이즈는 **매우 서틀(0.1~0.15 강도)** → 블록 패턴을 깨지 않음
- 텍스처 64px 업그레이드도 NearestFilter 유지 → 여전히 픽셀화됨
- **원칙**: "MC 건물이 실제 기후에 놓인 것처럼" — 건물 스타일은 MC, 환경 반응은 리얼

---

## 7. Phase별 예상 임팩트

| Phase | 시각적 임팩트 | 난이도 | 성능 영향 |
|-------|-------------|--------|----------|
| 1. 바이옴 파이프라인 | ★☆☆☆☆ (데이터만) | 쉬움 | 없음 |
| 2. 셰이더 바이옴 틴트 | ★★★★★ (가장 큰 변화) | 중간 | 미미 (+uniform 6개) |
| 3. 텍스처 업그레이드 | ★★★☆☆ (클로즈업 개선) | 중간 | 미미 (+256KB) |
| 4. 인스턴스 변형 | ★★★★☆ (다양성 체감) | 쉬움 | 없음 |
| 5. 조명 + 애니메이션 | ★★★☆☆ (생동감) | 어려움 | 약간 (+셰이더 복잡도) |
| 6. 통합 검증 | — | 중간 | 최적화 |

**권장 순서**: Phase 1 → 2 → 4 → 3 → 5 → 6
(Phase 2가 가장 큰 임팩트이므로 빨리 확인, Phase 4는 쉬우면서 효과 좋음)
