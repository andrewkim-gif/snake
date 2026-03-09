# PLAN: v29 Phase 7 — 색상 사실감 & 다양성 고도화

> **Version**: v29.7 | **Date**: 2026-03-09
> **Goal**: 랜드마크 건물의 색상 균일성(노란 편향), 재질 단조로움, 환경 부조화를 근본 해결

---

## 1. 현재 문제 분석 (Root Cause)

v29 Phase 1~6에서 바이옴 틴트, 인스턴스 변형, 텍스처 512px 업그레이드, 환경 조명을 적용했지만,
**세 가지 근본 원인**이 아직 해결되지 않아 건물이 여전히 균일하고 이질적으로 보인다:

### 원인 1: 블록 타입 분포의 따뜻한 색 편향 (Block Palette Warm Bias)

42개 아키타입의 블록 사용 빈도:
- **QUARTZ (#EEE8DD)**: 55+ voxels — 거의 모든 아키타입에 사용 (따뜻한 백색)
- **GOLD (#FFD700)**: 50+ voxels — 아키타입 팁/돔/악센트에 범용 사용 (노란색)
- **SANDSTONE (#D4A017)**: 25+ voxels (황토색)
- **IRON (#CCCCCC)**: 25+ voxels (중립)
- **STONE (#888888)**: 35+ voxels (중립)
- 전체 블록의 50.5%가 따뜻한 톤, GOLD만 16.4% 차지
- **11개 블록 타입(29%)이 아예 미사용** — 새로 추가한 바이옴 변형 6종 포함

### 원인 2: 셰이더 조명의 따뜻한 색 편향 (Shader Warm Bias)

```glsl
// 스페큘러 — 순수 흰색이 아니라 따뜻한 백색
vec3(1.0, 0.95, 0.85) * spec  // ← R>G>B = warm tint

// 밤 이미시브 — 순수 앰버/노란색
vec3(1.0, 0.85, 0.5) * windowLight  // ← 강한 yellow-orange

// 하늘 간접광 — 시원한 톤이지만 8% max로 너무 약함
vec3(0.5, 0.6, 0.9) * max(-NdotL, 0.0) * 0.08  // ← 거의 영향 없음
```

세 조명 레이어 모두 따뜻한 방향으로 편향 → 쿨톤 블록(GLASS, DIAMOND, PACKED_ICE)도 따뜻하게 보임.

### 원인 3: 재질 구분 없는 단일 라이팅 모델 (No Material Differentiation)

현재 셰이더는 **모든 블록을 동일한 방식으로 조명**:
- GOLD (금속)도 STONE (돌)도 같은 ambient/diffuse/specular
- 스페큘러 여부가 `texColor.r` (밝기)로만 결정 — 재질 속성이 아님
- 풍화(weathering)가 바이옴 무관 고정 12% — biome-landmark-tints의 weathering 값 미사용
- Face AO가 0.7~1.0으로 압축 → 입체감 부족

### 원인 4: 바이옴 틴트의 따뜻한 편향

| 바이옴 | 틴트 색상 | 색온도 |
|--------|----------|--------|
| temperate | #D4C9A8 | warm |
| arid | #E8D5A3 | warm |
| tropical | #A8C4A0 | cool-warm green |
| arctic | #C8D8E8 | cool |
| mediterranean | #E0C8A0 | warm |
| urban | #B8B8B8 | neutral |

4/6 바이옴이 따뜻한 톤 → 글로벌 평균이 노란색 방향으로 치우침.

---

## 2. 개선 전략 (7개 Sub-Phase)

### Sub-Phase 7A: 블록 팔레트 리밸런싱 (Block Palette Rebalance)

**목표**: GOLD 의존도 감소, 아키타입별 고유 악센트 블록 사용

| 현재 | 변경 | 이유 |
|------|------|------|
| 거의 모든 아키타입 팁 = GOLD | 아키타입 성격에 맞는 악센트 | 시각적 다양성 |
| MOSQUE/TEMPLE 팁 = GOLD | MOSQUE → SANDSTONE, TEMPLE → EMERALD | 문화적 적합성 |
| TOWER/NEEDLE 팁 = GOLD | TOWER → IRON, NEEDLE → DIAMOND | 현대 건축 = 메탈릭 |
| PAGODA 팁 = GOLD | 유지 (금 장식이 실제 동양 건축) | 적합함 |
| CASTLE/FORTRESS 팁 = GOLD | CASTLE → STONE, FORTRESS → NETHER_BRICK | 중세 = 돌 |
| CATHEDRAL 팁 = GOLD | COPPER (녹청) | 유럽 성당 = 구리 지붕 |

동시에 **미사용 블록 활성화**:
- OBSIDIAN → FORTRESS, WALL 기반부에 추가
- PACKED_ICE → ARCTIC 바이옴 건물 지붕
- GRAVEL → 기초부/도로 느낌
- GRASS_SIDE → 열대 건물 하단 자연 융합

### Sub-Phase 7B: 셰이더 색온도 중립화 (Shader Color Neutralization)

```glsl
// BEFORE (warm-biased)
vec3 specColor = vec3(1.0, 0.95, 0.85);
vec3 nightEmissive = vec3(1.0, 0.85, 0.5);
float skyIndirect = 0.08;

// AFTER (neutral with material-aware variation)
vec3 specColor = vec3(1.0, 0.98, 0.95);    // near-white, minimal warm
vec3 nightEmissive = vec3(0.95, 0.9, 0.75); // softer, less saturated amber
float skyIndirect = 0.15;                   // doubled sky influence
```

### Sub-Phase 7C: 재질 기반 라이팅 분화 (Material-Aware Lighting)

블록 패턴(pattern) 속성을 셰이더에 전달하여 재질별 조명 차등화:

| 패턴 | 재질 특성 | 스페큘러 | 풍화 반응 |
|------|----------|---------|----------|
| crystal (GOLD, IRON, DIAMOND, EMERALD) | 금속/보석 | 강함 (0.4) | 약함 (0.06) |
| brick (RED_BRICK, NETHER_BRICK, BRICK, SAND_BRICK) | 거친 돌 | 없음 (0.0) | 강함 (0.18) |
| wood (OAK, BAMBOO, DARK_OAK, BIRCH, MOSS_WOOD) | 나무 | 약함 (0.1) | 중간 (0.12) |
| noise (STONE, QUARTZ, CLAY 등) | 돌/흙 | 약함 (0.1) | 중간 (0.12) |
| plain (GLASS, SNOW) | 매끄러움 | 강함 (0.5) — 환경 반사 느낌 | 없음 (0.0) |
| stripe (HAY, GRASS_SIDE) | 유기물 | 없음 (0.0) | 강함 (0.20) |

구현: 텍스처 아틀라스에 **재질 인덱스를 알파 채널**로 인코딩하거나,
UV좌표에서 blockType을 역산하여 셰이더 내 lookup.

### Sub-Phase 7D: Face AO 복원 + 앰비언트 오클루전 강화

```glsl
// BEFORE: 입체감 부족
float ao = mix(0.7, 1.0, vColor.r);  // 0.5→0.7, 1.0→1.0 (range: 0.3)

// AFTER: 입체감 복원
float ao = mix(0.45, 1.0, vColor.r); // 0.5→0.45, 1.0→1.0 (range: 0.55)
```

바닥면(0.5) → 0.45로 매핑 = 바닥이 눈에 띄게 어두워짐 → 박스 형태 입체감 대폭 강화.

### Sub-Phase 7E: 바이옴 weathering 필드 실제 연결

현재 `BiomeLandmarkTint.weathering` 값이 정의되어 있지만 셰이더에서 미사용.

```glsl
// BEFORE: 고정 12%
float weathering = hash21(vUv * 100.0 + vAgeSeed) * 0.12;

// AFTER: 바이옴별 차등 + 재질 보정
uniform float uBiomeWeathering[6];
float baseWeathering = uBiomeWeathering[biomeId];
float materialFactor = materialWeatheringLookup; // Sub-Phase 7C
float weathering = hash21(vUv * 100.0 + vAgeSeed) * baseWeathering * materialFactor;
```

결과: arid(0.18) → 사막 건물이 가장 풍화됨 / arctic(0.08) → 얼음 건물 깨끗 / urban(0.05) → 도시 건물 깨끗

### Sub-Phase 7F: 바이옴 틴트 리밸런싱

| 바이옴 | 현재 틴트 | 개선 틴트 | 변화 |
|--------|----------|----------|------|
| temperate | #D4C9A8 (warm stone) | #C8C4B8 (neutral stone) | 따뜻함 ↓ |
| arid | #E8D5A3 (sand wash) | #E0D0A8 (light sand) | 약간 중립화 |
| tropical | #A8C4A0 (moss green) | #98C098 (deeper green) | 녹색 강화 |
| arctic | #C8D8E8 (ice blue) | #C0D4F0 (stronger blue) | 푸른색 강화 |
| mediterranean | #E0C8A0 (terra warm) | #D8C8B0 (warmer neutral) | 약간 중립화 |
| urban | #B8B8B8 (concrete) | #B0B4B8 (slight cool) | 약간 시원하게 |

### Sub-Phase 7G: 바이옴별 블록 치환 (Biome Block Substitution)

아키타입의 특정 블록을 바이옴에 따라 런타임 치환:

| 원본 블록 | arctic | arid | tropical | 비고 |
|----------|--------|------|----------|------|
| STONE | SNOW_STONE | SANDSTONE | MOSSY_STONE | 기반 석재 바이옴화 |
| OAK_PLANKS | BIRCH_WOOD | SAND_BRICK | MOSS_WOOD | 나무 바이옴화 |
| BRICK | PACKED_ICE | GLAZED_TERRACOTTA | TERRACOTTA | 벽돌 바이옴화 |
| QUARTZ | SNOW | QUARTZ (유지) | PRISMARINE | 장식 바이옴화 |

구현 방식: LandmarkMeshes.tsx의 geometry 생성 시 바이옴별 블록 매핑 테이블 적용.
(geometry 캐시 키에 바이옴 포함 필요 → `${archetype}_${biome}`)

---

## 3. 구현 우선순위 (임팩트 순)

| 순서 | Sub-Phase | 시각적 임팩트 | 난이도 | 변경 범위 |
|------|-----------|-------------|--------|----------|
| 1 | **7B** 셰이더 색온도 중립화 | ★★★★★ | 쉬움 | LandmarkMeshes.tsx |
| 2 | **7D** Face AO 복원 | ★★★★☆ | 쉬움 | LandmarkMeshes.tsx |
| 3 | **7E** 바이옴 weathering 연결 | ★★★☆☆ | 쉬움 | LandmarkMeshes.tsx |
| 4 | **7F** 바이옴 틴트 리밸런싱 | ★★★☆☆ | 쉬움 | biome-landmark-tints.ts |
| 5 | **7A** 블록 팔레트 리밸런싱 | ★★★★☆ | 중간 | landmark-geometries.ts |
| 6 | **7C** 재질 기반 라이팅 | ★★★★★ | 어려움 | mc-blocks.ts + atlas + shader |
| 7 | **7G** 바이옴별 블록 치환 | ★★★★★ | 어려움 | LandmarkMeshes + geometries |

---

## 4. 예상 결과

### Before (현재)
- 글로브 전체가 황금빛/모래색으로 균일
- 모든 건물이 같은 방식으로 빛남 (재질 무관)
- 바이옴 차이가 미미 (25% 틴트만)
- 입체감 부족 (AO 압축)

### After (개선 후)
- 바이옴별 뚜렷한 색조 차이: arctic 건물 = 푸른빛, arid = 모래빛, tropical = 녹색빛
- 금속 블록은 반짝, 돌 블록은 무광, 나무는 따뜻한 중간톤
- 같은 MOSQUE도 사우디(arid) vs 인도네시아(tropical)에서 색감이 다름
- 강한 면 AO로 박스 형태의 입체감 뚜렷
- 밤 이미시브가 덜 노랗고 더 자연스러운 따뜻함
- 풍화가 바이옴/재질별 차등 → 사막 건물은 거칠고, 도시 건물은 깨끗

---

## 5. 성능 영향

| 항목 | 변화 | 비용 |
|------|------|------|
| 셰이더 uniform | +uBiomeWeathering[6] (float×6) | 미미 |
| 셰이더 복잡도 | material lookup 추가 | ALU +5~8 instructions |
| geometry 캐시 | 바이옴별 분기 시 ×6 (최대) | 메모리 +0.5MB (선택적) |
| 텍스처 | 변경 없음 (기존 512x512) | 0 |
| 드로콜 | 변경 없음 | 0 |

**결론**: Phase 7A~7F는 성능 영향 거의 없음. 7G만 geometry 캐시 증가 우려 → 주요 바이옴 3개만 적용하면 OK.

---

## 6. 추가 확장 아이디어 (v30+)

### 6-A. 지구 텍스처 색상 샘플링 (Earth Texture Sampling)
건물 위치의 지구 표면 색상을 GPU에서 직접 샘플링하여 자동 틴트.
바이옴 테이블 없이 연속적 색상 변화 — 사하라→지중해→알프스 그라데이션.

### 6-B. 건물 기초 플레이트 (Foundation Plate)
각 건물 아래 원형 그라디언트 그림자 + 바이옴 색상 기초판.
접지감(grounding) 대폭 향상. InstancedMesh 1개 추가 (드로콜 +1).

### 6-C. 계절 변화 연동
실시간 날짜 또는 게임 시즌에 따라:
- 겨울: arctic 이외 바이옴에도 눈 오버레이 (위도 기반)
- 가을: temperate 건물에 갈색/주황 틴트 추가
- 여름: tropical 건물에 채도 부스트

### 6-D. PBR 머티리얼 텍스처 채널
알파 채널에 roughness/metalness 인코딩하여 진정한 PBR 라이팅.
현재 단일 albedo 텍스처 → albedo + roughness + metalness 3채널.

### 6-E. 전쟁 상태 시각 피드백
전쟁 중 국가 건물에 desaturation + 적색 틴트 + 이미시브 감소(정전).
`aWarState` attribute 추가로 구현 가능 (셰이더 슬롯 예비 필요).
