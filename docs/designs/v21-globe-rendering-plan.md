# PLAN: v21 — Globe Rendering Quality Upgrade

## 1. 개요

현재 지구본은 `meshBasicMaterial` (조명 무반응) + 단일 텍스처 + 가짜 야간 오버레이로 구성되어 시각적 품질이 낮음.
이 업그레이드로 사실적 라이팅, 야간 도시 불빛, 대기 산란, 태양 광채를 구현하여 "우주에서 본 지구" 수준으로 끌어올림.

### 현재 상태 (AS-IS)
| 항목 | 현재 | 문제 |
|------|------|------|
| 지구 머티리얼 | `meshBasicMaterial` | 조명에 전혀 반응하지 않음 (flat texture) |
| 텍스처 | blue-marble.jpg 1장 | 야간 불빛, 범프맵, 스페큘러 없음 |
| 야간 효과 | ShaderMaterial 오버레이 (단색 어둡게) | 도시 불빛 없음, 밋밋한 어둠 |
| 대기 | BackSide 림 셰이더 (고정 방향) | 태양 반대편에도 동일 강도, 비사실적 |
| 태양 조명 | DirectionalLight 1.15 | 빛 잔사광(림라이트) 없음, 약함 |
| 포스트프로세싱 | 없음 | Bloom/Vignette 없음 |
| Canvas 설정 | R3F 기본 ACESFilmic (exposure 미조정) | exposure 1.0 기본값, dpr 미지정 |

### 목표 (TO-BE)
```
☀️ 태양 방향에서 강한 조명 → 지구 표면에 사실적 음영
🌃 야간 면에 도시 불빛 텍스처 (밤에 비행기에서 보는 모습)
🌅 터미네이터(낮/밤 경계)에 오렌지빛 잔사광
🌏 대기 산란: 태양 방향에서 밝고, 반대편에서 어두운 림 글로우
✨ Bloom 포스트프로세싱으로 태양/도시 불빛 발광
🎨 ACESFilmic 톤매핑 + 높은 DPR
```

## 2. 요구사항

### 기능 요구사항
- [FR-1] 지구 구체가 태양 DirectionalLight에 반응하는 PBR 머티리얼
- [FR-2] 야간 면에 도시 불빛 (earth-night-lights 텍스처)
- [FR-3] 낮/밤 경계(터미네이터)에 오렌지빛 잔사광 효과
- [FR-4] 태양 방향 인식 대기 산란 (프레넬 림 + 방향성)
- [FR-5] Bloom 포스트프로세싱 (태양 코로나 + 도시 불빛 발광)
- [FR-6] 태양 DirectionalLight 강화 + 색온도 개선

### 비기능 요구사항
- [NFR-1] 60fps 유지 (모바일 포함)
- [NFR-2] 추가 텍스처 총량 < 3MB (성능)
- [NFR-3] 기존 GlobeView 레이어(국가 폴리곤, 라벨, 랜드마크 등) 영향 없음

## 3. 기술 방향

- **프레임워크**: React Three Fiber (R3F) 9.x + @react-three/postprocessing 3.x (이미 설치됨)
- **지구 머티리얼**: Custom `ShaderMaterial` (day/night 혼합 + PBR 라이팅)
- **텍스처 추가**: NASA earth-night-lights 텍스처 (2048x1024 또는 4096x2048)
- **대기**: 기존 AtmosphereGlow 셰이더를 태양 방향 인식으로 업그레이드
- **포스트프로세싱**: EffectComposer + Bloom + Vignette (선택적 ToneMapping)

## 4. 아키텍처 개요

```
Canvas (toneMapping: ACESFilmic, dpr: [1,2])
├── EarthSphere (Custom ShaderMaterial)
│   ├── uniform: uDayMap (blue-marble.jpg)
│   ├── uniform: uNightMap (earth-night-lights.jpg) ← NEW
│   ├── uniform: uSunDir (vec3, 매 프레임 갱신)
│   ├── Phong 디퓨즈 + 스페큘러 (바다 반사)
│   ├── 낮/밤 혼합: mix(dayColor, nightColor, terminator)
│   └── 터미네이터 잔사광: smoothstep orange rim
│
├── NightOverlay → 제거 (EarthSphere 셰이더에 통합)
│
├── AtmosphereGlow (업그레이드)
│   ├── uniform: uSunDir → 태양 방향 인식 림
│   └── 태양 쪽 밝은 cyan/white + 반대편 어두운 blue
│
├── SunLight (강화)
│   ├── DirectionalLight intensity 1.15 → 2.5
│   └── 코로나 스프라이트 강화
│
├── Lights
│   ├── ambientLight 0.35 → 0.12 (낮추기 — PBR 전환)
│   └── hemisphereLight 유지
│
├── [기존 레이어 그대로]
│   ├── CountryPolygons, GlobeDominationLayer
│   ├── LandmarkMeshes, GlobeCountryLabels, CountryLabels
│   └── GlobeWarEffects, GlobeTradeRoutes 등
│
└── EffectComposer ← NEW
    ├── Bloom (luminanceThreshold: 0.8, radius: 0.6, intensity: 0.5)
    └── Vignette (offset: 0.3, darkness: 0.6)
```

## 5. Phase별 상세 기획

### Phase 1: 지구 PBR 셰이더 (day/night 혼합)

**현재**: `meshBasicMaterial` + 별도 `nightOverlay` ShaderMaterial
**목표**: 단일 Custom ShaderMaterial에 통합

**EarthSphere 셰이더 설계:**
```glsl
// Vertex Shader
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  vUv = uv;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment Shader
uniform sampler2D uDayMap;      // blue-marble.jpg
uniform sampler2D uNightMap;    // earth-night-lights.jpg (NEW)
uniform vec3 uSunDir;           // 정규화된 태양 방향

void main() {
  vec3 N = normalize(vWorldNormal);
  float NdotL = dot(N, uSunDir);

  // 낮/밤 혼합 팩터 (터미네이터 부드러운 전환)
  float dayFactor = smoothstep(-0.15, 0.25, NdotL);

  // 낮: 디퓨즈 라이팅
  vec3 dayColor = texture2D(uDayMap, vUv).rgb;
  float diffuse = max(NdotL, 0.0) * 0.8 + 0.2;  // 최소 0.2 앰비언트
  dayColor *= diffuse;

  // 밤: 도시 불빛 (emissive, 조명 무관)
  vec3 nightColor = texture2D(uNightMap, vUv).rgb;
  nightColor *= 1.5;  // 부스트 (Bloom이 잡아서 발광)

  // 터미네이터 잔사광 (오렌지 림)
  float terminator = 1.0 - smoothstep(-0.05, 0.15, abs(NdotL));
  vec3 terminatorColor = vec3(1.0, 0.4, 0.1) * terminator * 0.3;

  // 최종 혼합
  vec3 color = mix(nightColor, dayColor, dayFactor) + terminatorColor;

  // 바다 스페큘러 (선택적 — Phase 1에서는 생략 가능)
  gl_FragColor = vec4(color, 1.0);
}
```

**야간 텍스처 소싱:**
- NASA Visible Earth "Earth at Night" (Black Marble)
- 2048x1024 JPG (~500KB-1MB), equirectangular projection
- public/textures/earth-night-lights.jpg 로 저장

### Phase 2: 대기 산란 업그레이드

**현재**: 고정 방향 (z축) rim glow
**목표**: 태양 방향 인식 프레넬 대기

```glsl
// 현재
float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
gl_FragColor = vec4(0.1, 0.3, 0.6, 1.0) * intensity;

// 업그레이드
uniform vec3 uSunDir;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

float rim = 1.0 - abs(dot(vViewDir, vWorldNormal));
rim = pow(rim, 3.0);

// 태양 방향에 따른 대기 밝기
float sunAlignment = max(dot(vWorldNormal, uSunDir), 0.0);
float atmosphereBright = 0.3 + 0.7 * sunAlignment;

// 태양 쪽: 밝은 시안/화이트, 반대편: 어두운 블루
vec3 dayAtmo = mix(vec3(0.1, 0.3, 0.8), vec3(0.4, 0.7, 1.0), sunAlignment);
vec3 atmoColor = dayAtmo * rim * atmosphereBright;
```

### Phase 3: 태양 강화 + Canvas 설정

**DirectionalLight:**
- intensity: 1.15 → **2.5** (PBR 머티리얼에서 충분한 명암대비)
- ambientLight: 0.35 → **0.12** (너무 밝으면 명암 감소)

**Canvas 설정:**
- R3F v9 기본값이 이미 ACESFilmicToneMapping → `toneMapping` 명시 불필요
- 실제로 필요한 것: `toneMappingExposure: 1.2` + `dpr: [1, 2]`
```tsx
<Canvas
  gl={{
    antialias: true,
    alpha: false,
    toneMappingExposure: 1.2,
  }}
  dpr={[1, 2]}
>
```

**태양 코로나 강화:**
- 스프라이트 스케일: [120, 120, 1] → [160, 160, 1]
- opacity: 0.6 유지 (Phase 4 Bloom과 동시 적용 시 과발광 방지 — Bloom 테스트 후 조정)
- 추가 내부 글로우 레이어 (더 작고 밝은)

### Phase 4: Bloom 포스트프로세싱

```tsx
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

// GlobeScene 내부 마지막에 추가
<EffectComposer>
  <Bloom
    luminanceThreshold={0.8}
    luminanceSmoothing={0.3}
    intensity={0.5}
    radius={0.6}
    mipmapBlur
  />
  <Vignette offset={0.3} darkness={0.5} />
</EffectComposer>
```

**Bloom 대상:**
- 태양 코로나 (toneMapped={false} → HDR 값이 높아 자동 Bloom)
- 야간 도시 불빛 (nightColor *= 1.5로 부스트)
- 랜드마크 등 기존 emissive 요소

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Bloom이 다른 레이어(라벨, 국기)에 번짐 | 시각 품질 저하 | luminanceThreshold 조정, selective bloom layer |
| PBR 전환 시 국가 폴리곤 색상 변화 | 기존 UX 변화 | 폴리곤은 별도 머티리얼 유지 (Basic) |
| 야간 텍스처 추가 로딩 시간 | 초기 로딩 지연 | 2K 해상도 제한 + progressive loading |
| 모바일 성능 저하 (Bloom) | FPS 하락 | dpr 제한 + 모바일 Bloom 비활성 |
| 기존 nightOverlay 제거 시 사이드이펙트 | 야간 연출 깨짐 | Phase 1에서 통합 후 즉시 검증 |
| 랜드마크(MeshLambertMaterial) 과노출 | DirLight 2.5x로 랜드마크 과도하게 밝아짐 | 랜드마크 머티리얼 emissiveIntensity 보정 또는 별도 ambient 기여 조정 |
| 태양 코로나 + Bloom 과발광 | toneMapped=false 코로나가 Bloom에서 극단 luminance | 코로나 opacity 0.6 유지 + Bloom intensity 미세조정 (단계적 접근) |

## 구현 로드맵

### Phase 1: EarthSphere PBR 셰이더 + 야간 텍스처
| Task | 설명 |
|------|------|
| 야간 텍스처 다운로드 | NASA earth-night-lights 2048x1024 JPG → public/textures/ |
| EarthSphere 셰이더 교체 | meshBasicMaterial → Custom ShaderMaterial (day/night 혼합) |
| NightOverlay 통합 | 별도 nightOverlay 메시 제거, EarthSphere에 통합 |
| 터미네이터 잔사광 | 낮/밤 경계 오렌지 림 효과 |
| uSunDir 갱신 | useFrame에서 태양 위치 → uniform 업데이트 |

- **design**: N (셰이더 코드 중심)
- **verify**: 빌드 성공, 지구 낮/밤 전환 확인, 도시 불빛 가시성, 기존 레이어 정상

### Phase 2: 대기 산란 업그레이드
| Task | 설명 |
|------|------|
| AtmosphereGlow 셰이더 교체 | 고정 z축 림 → 태양 방향 인식 프레넬 대기 |
| uSunDir uniform 연결 | AtmosphereGlow에 태양 방향 전달 |
| vViewDir 계산 | 카메라 방향 기반 프레넬 계산 |

- **design**: N
- **verify**: 빌드 성공, 태양 쪽 밝은 대기 + 반대편 어두운 대기 확인

### Phase 3: 태양 강화 + Canvas 설정
| Task | 설명 |
|------|------|
| DirectionalLight 강화 | intensity 2.5, ambient 0.12로 조정 |
| Canvas toneMapping | toneMappingExposure 1.2 설정 (ACES는 R3F 기본값으로 이미 적용) |
| Canvas dpr | [1, 2] 명시적 설정 |
| 태양 코로나 확대 | 스프라이트 스케일 + 내부 글로우 레이어 추가 |

- **design**: N
- **verify**: 빌드 성공, 명암 대비 선명, 태양 코로나 글로우 강화 확인

### Phase 4: Bloom 포스트프로세싱
| Task | 설명 |
|------|------|
| EffectComposer 추가 | @react-three/postprocessing의 EffectComposer |
| Bloom 설정 | luminanceThreshold 0.8, intensity 0.5, radius 0.6 |
| Vignette 추가 | 가장자리 어둡게 (영화적 연출) |
| 모바일 분기 | 모바일에서 Bloom 비활성 또는 낮은 설정 |

- **design**: N
- **verify**: 빌드 성공, 태양 코로나/도시 불빛 Bloom, 라벨 번짐 없음, 60fps 유지
