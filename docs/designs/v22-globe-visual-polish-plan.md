# PLAN: v22 — Globe Visual Polish (건물 라이팅 + 태양 플레어 + 밀키웨이 감쇠)

## 1. 개요

v21에서 지구본 PBR 셰이더, 야간 도시 불빛, 대기 산란, Bloom을 구현했으나 3가지 시각적 부족함이 남아 있음:

1. **건물(랜드마크) 라이팅 부재** — MC 복셀 건물이 `MeshLambertMaterial`이지만 태양 방향에 따른 명암 대비가 약하고, 야간에도 동일하게 보임
2. **태양 플레어 부재** — 태양이 코로나 스프라이트 2장뿐, 렌즈 플레어(광선 줄기)가 없어 드라마틱하지 않음
3. **밀키웨이 과도 선명** — `scene.background`로 equirectangular 텍스처를 100% 밝기로 표시, 줌아웃해도 동일 강도라 눈이 아픔

### 현재 상태 (AS-IS)
| 항목 | 현재 | 문제 |
|------|------|------|
| 랜드마크 머티리얼 | `MeshLambertMaterial` (atlas + vertexColors + flatShading) | 태양 반응은 하지만 야간면에서도 밝음, emissive 없음 |
| 랜드마크 엣지 | Custom ShaderMaterial (고정색 `vec4(0.08, 0.08, 0.08, 0.5)`) | 라이팅 무관 |
| 태양 비주얼 | DirectionalLight 2.5 + 코어 구체 r=3 + 코로나 스프라이트 2장 (50x50, 20x20) | 렌즈 플레어 없음, 광선 줄기 없음 |
| 밀키웨이 배경 | `scene.background = equirectangularTexture` | 항상 100% 밝기, 거리/줌 무관, 과도하게 선명 |

### 목표 (TO-BE)
```
🏗️ 건물이 태양 방향에 따라 명암 대비 + 야간면에서 창문 불빛 emissive
☀️ 태양에서 6~8개 광선 줄기(God rays) + 외부 디퓨전 헤일로
🌌 밀키웨이가 줌인(지구 가까이)하면 어둡고, 줌아웃하면 자연스럽게 보임
```

## 2. 요구사항

### 기능 요구사항
- [FR-1] 랜드마크가 태양 방향(uSunDir)에 따른 명확한 명암 대비를 보여야 함
- [FR-2] 랜드마크 야간면(NdotL < 0)에서 창문 불빛 emissive 발광 효과
- [FR-3] 태양 주변에 렌즈 플레어(광선 줄기 6~8개) 연출
- [FR-4] 태양 외부에 넓은 디퓨전 헤일로(확산 글로우)
- [FR-5] 밀키웨이 배경 밝기가 카메라 거리에 따라 자동 조절

### 비기능 요구사항
- [NFR-1] 60fps 유지 (모바일 포함)
- [NFR-2] 기존 v21 셰이더(EarthSphere, AtmosphereGlow, EarthClouds) 영향 없음
- [NFR-3] 추가 텍스처 없음 (Canvas 프로시져럴 생성)

## 3. 기술 방향

- **프레임워크**: React Three Fiber v9 + @react-three/postprocessing (기존)
- **랜드마크 라이팅**: `MeshLambertMaterial` → Custom `ShaderMaterial` (태양 방향 인식 + emissive 야간)
- **태양 플레어**: Canvas 프로시져럴 텍스처 (광선 줄기) + 추가 스프라이트 레이어
- **밀키웨이 감쇠**: `scene.background` 유지 + `scene.backgroundIntensity` (R3F v9/Three.js r155+)를 카메라 거리로 보간

## 4. 아키텍처 개요

```
GlobeScene
├── Lights
│   ├── ambientLight (0.12)
│   └── hemisphereLight (0.25)
│
├── SunLight (강화)
│   ├── DirectionalLight (2.5, 기존 유지)
│   ├── Sun Core (sphere r=3, 기존)
│   ├── Corona Inner (sprite 20x20, 기존)
│   ├── Corona Outer (sprite 50x50, 기존)
│   ├── ★ Lens Flare 스프라이트 (광선 줄기 텍스처, ~120x120) ← NEW
│   └── ★ Diffusion Halo 스프라이트 (넓은 소프트 글로우, ~200x200) ← NEW
│
├── Starfield (업그레이드)
│   ├── scene.background = milkyWayTexture (기존)
│   └── ★ useFrame: scene.backgroundIntensity = f(cameraDistance) ← NEW
│
├── EarthSphere (기존 유지)
├── EarthClouds (기존 유지)
│
├── LandmarkMeshes (업그레이드)
│   ├── ★ MeshLambertMaterial → Custom ShaderMaterial ← NEW
│   │   ├── uniform: uSunDir (태양 방향)
│   │   ├── Lambertian diffuse (flatShading)
│   │   ├── vertexColors 유지 (면별 밝기)
│   │   ├── atlas texture 유지
│   │   └── 야간 emissive (NdotL < 0 → 창문 불빛 발광)
│   └── 엣지 ShaderMaterial (기존 유지)
│
├── [기존 레이어 그대로]
│
└── EffectComposer
    └── Bloom (기존 설정 유지 — 플레어/야간 건물이 자동 bloom)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 랜드마크 커스텀 셰이더 전환 시 기존 vertexColors/atlas UV 깨짐 | 건물 외형 손상 | 기존 Lambert 로직을 GLSL로 1:1 재현 후 확장 |
| 플레어 스프라이트가 Bloom과 겹쳐 과발광 | 눈부심 | toneMapped=false + opacity 0.15~0.25로 제한 |
| scene.backgroundIntensity 미지원 Three.js 버전 | 밀키웨이 감쇠 불가 | Three.js r155+ 확인, 미지원 시 별도 배경 메시 + opacity 조절 |
| 랜드마크 야간 emissive가 Bloom에 과도 반응 | 건물 번짐 | emissive 강도를 0.3~0.5로 제한, luminanceThreshold 0.92가 자연 필터 |

## 구현 로드맵

### Phase 1: 랜드마크 태양 라이팅 셰이더
| Task | 설명 |
|------|------|
| LandmarkMeshes 셰이더 교체 | MeshLambertMaterial → Custom ShaderMaterial (Lambertian + vertexColors + atlas) |
| uSunDir uniform 연결 | EarthSphere와 동일한 태양 방향 계산, useFrame에서 갱신 |
| 야간 emissive | NdotL < 0 영역에서 창문 불빛 emissive (atlas 밝은 영역 기반 * emissive factor) |
| 명암 대비 강화 | 태양 방향 diffuse 0.0~1.0 범위, ambient 최소 0.08 (야간면 실루엣 유지) |

- **design**: N (셰이더 코드 중심)
- **verify**: 빌드 성공, 건물 낮면 밝고 밤면 어두움 + 창문 불빛 확인, 기존 아틀라스 텍스처 정상

### Phase 2: 태양 렌즈 플레어 + 디퓨전 헤일로
| Task | 설명 |
|------|------|
| 플레어 텍스처 생성 | Canvas 프로시져럴: 중심에서 6~8개 광선 줄기 (star burst 패턴) |
| 플레어 스프라이트 추가 | SunLight 그룹에 3번째 스프라이트 (~120x120), AdditiveBlending, opacity 0.2 |
| 디퓨전 헤일로 추가 | 넓고 부드러운 외부 글로우 스프라이트 (~200x200), opacity 0.1 |
| 플레어 회전 애니메이션 | useFrame에서 플레어 스프라이트 느린 회전 (0.02 rad/s) |

- **design**: N (프로시져럴 텍스처)
- **verify**: 빌드 성공, 태양 주변에 광선 줄기 보임, Bloom과 조합 시 과발광 없음

### Phase 3: 밀키웨이 거리 감쇠
| Task | 설명 |
|------|------|
| backgroundIntensity 지원 확인 | Three.js 버전 체크, scene.backgroundIntensity API 가용성 검증 |
| 거리 기반 감쇠 로직 | useFrame에서 camera.position.length() → backgroundIntensity 보간 (가까이=0.15, 멀리=0.6) |
| 폴백 구현 | backgroundIntensity 미지원 시 scene.background 투명도 조절 또는 별도 메시 |
| 감쇠 커브 튜닝 | smoothstep(150, 400, distance) → 자연스러운 전환 |

- **design**: N (로직 중심)
- **verify**: 빌드 성공, 줌인 시 배경 어둡고 줌아웃 시 밝아짐, 전환 부드러움
