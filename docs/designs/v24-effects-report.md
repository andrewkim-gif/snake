# v24 Globe Effects Overhaul — Final Report

> Generated: 2026-03-09 | Pipeline: da:work (Turbo Mode) | 7 Phases

## Executive Summary

v24 Globe Effects Overhaul은 AI World War 지구본의 13개 3D 이펙트 + 7개 2D 오버레이를 **"Holographic War Room"** 통일 디자인 언어로 전면 리디자인한 프로젝트다. 카메라 레이스 컨디션 해결, 아크 높이 1.2~2.3배 상향, 통일 색상 체계(8 이벤트 타입), 3단계 LOD, Material 풀링, InstancedMesh 전환, prefers-reduced-motion 접근성까지 7개 Phase를 Turbo 모드로 완주했다.

| 지표 | 값 |
|------|-----|
| **총 Phase** | 7/7 완료 |
| **총 커밋** | 8개 (아키텍처 1 + 구현 7) |
| **신규 파일** | 7개 |
| **수정 파일** | 30+개 |
| **코드 변경** | +6,982 / -750 (순 +6,232줄) |
| **빌드 상태** | ✅ TypeScript strict 에러 0, 전체 빌드 성공 |
| **파이프라인 모드** | Turbo (Stage 2 아키텍처 검증 루프 생략) |

## DAVINCI Cycle Summary

| Stage | 스킬 | 상태 | 커밋 |
|-------|------|------|------|
| Stage 0 | Plan Parsing | ✅ v24-effects-overhaul-plan.md 파싱 | — |
| Stage 1 | da:system (아키텍처) | ✅ 1,018줄 아키텍처 문서 | `27e0219` |
| Stage 3-P1 | da:game (공유 인프라) | ✅ 3개 신규 파일 (580줄) | `48500b0` |
| Stage 3-P2 | da:game (카메라) | ✅ CameraController 354줄 | `eb11bfe` |
| Stage 3-P3 | da:game (아크 이펙트) | ✅ 6개 컴포넌트 통일 (-168줄 순감소) | `0b35e70` |
| Stage 3-P4 | da:game (표면 이펙트) | ✅ 6개 컴포넌트 통일 | `ab39573` |
| Stage 3-P5 | da:game (2D 오버레이) | ✅ 7개 파일 토큰 적용 | `6ef9c4c` |
| Stage 3-P6 | da:game (성능+LOD) | ✅ LOD 3단계 + Material풀링 | `b5fb1a9` |
| Stage 3-P7 | da:game (좌표검증) | ✅ 디버그 유틸 + 사운드 인터페이스 | `9deea77` |
| Stage 5 | da:report | ✅ 최종 리포트 | — |

## Phase Delivery Details

### Phase 1: 공유 인프라 추출 + 디자인 토큰 (`48500b0`)
- `lib/effect-constants.ts` (220줄): 8 이벤트 색상(hex/HDR/CSS), 6 아크 높이, 3 표면 고도, 8 renderOrder 레이어, 애니메이션 타이밍, 카메라 우선순위
- `lib/effect-utils.ts` (190줄): 공유 아크 생성(createArcCurve/createArcPoints/getArcPointGCFree), easing, orientToSurface, GC-prevention 객체
- `lib/overlay-tokens.ts` (170줄): 2D 토큰(bg/blur/border/transition), 뉴스 색상 동기화, 공유 키프레임

### Phase 2: 카메라 시스템 통합 (`eb11bfe`)
- **CameraController.tsx** (354줄): CameraAutoFocus + CameraShake → 단일 상태 머신 (idle/focusing/shaking/intro)
- 5단계 우선순위 큐 (nuke=5 > war=4 > epoch=3 > alliance=2 > trade=1)
- OrbitControls.target + update() 동기화 (스냅백 해결)
- introActive 중 이벤트 큐잉
- GlobeWarEffects에서 CameraShake 73줄 제거

### Phase 3: 아크 이펙트 통일 (`0b35e70`)
- 6개 아크 컴포넌트에서 중복 arc 함수 완전 제거 → 공유 effect-utils.ts 사용
- 아크 높이 상향: trade 0.15→**0.35**(2.3x), alliance 0.30→**0.50**(1.7x), war 0.25→**0.45**(1.8x), missile 0.35→**0.60**(1.7x)
- 색상 통일: 6개 컴포넌트 모두 EFFECT_COLORS 참조
- 순 168줄 감소 (105 추가, 273 삭제)

### Phase 4: 표면 이펙트 통일 (`ab39573`)
- 고도 3단계 적용: GROUND(+0.5), LOW(+1.0), HIGH(+1.5)
- renderOrder 체계 재배정: 6개 컴포넌트 → RENDER_ORDER 상수
- 색상 통일: ResourceGlow(금색), NukeEffect(핵백열), ConflictIndicators(전쟁적색), EventPulse(타입별), Shockwave(전쟁적색)
- GlobeConflictIndicators GLSL하드코딩 → uniform 전환

### Phase 5: 2D 오버레이 통일 (`6ef9c4c`)
- 7개 파일: NewsFeed, GlobeHoverPanel, LobbyHeader, BgmPlayer, WelcomeTutorial, page.tsx, CountryPanel
- 배경: `rgba(14,14,18,0.85~0.95)` → `rgba(9,9,11,0.90)` 단일값
- blur: `8~24px` → `12px`, transition: `150~600ms` → `300ms`
- NewsFeed 8개 이벤트 색상 → 3D EFFECT_COLORS와 100% 동기화
- 중복 `@keyframes pulse/fadeIn` → 공유 effectPulse/effectFadeIn

### Phase 6: 성능 + LOD + 접근성 (`b5fb1a9`)
- **LOD 3단계**: close(<200) / mid(200-350) / far(>350) + 히스테리시스
- **InstancedMesh 전환**: GlobeSanctionBarrier 개별 Mesh → InstancedMesh (draw call ~66% 감소)
- **Material 풀링**: SpyTrail/ResourceGlow/SanctionBarrier O(N)→O(1)
- **useReducedMotion 훅**: prefers-reduced-motion 감지, 파티클/쉐이크 비활성화
- Bloom HDR 호환성 확인 (threshold 0.4 vs HDR 2.0~3.0x: 호환)

### Phase 7: 좌표 검증 + 사운드 인터페이스 (`9deea77`)
- `lib/effect-debug.ts` (254줄): 20개국 centroid 디버그 마커, 좌표 유효성 검증, 디버그 아크
- `SoundCue` 인터페이스: 5종 이벤트 타입 + intensity + position (구현은 별도 버전)
- 전체 빌드 최종 확인: TS strict 에러 0, 19 라우트 정상

## Quality Metrics

| 지표 | 결과 |
|------|------|
| TypeScript strict 에러 | **0** |
| 빌드 성공 | **✅** 모든 Phase에서 `npx next build` 통과 |
| 중복 아크 함수 | 5~6개 → **1개** (effect-utils.ts) |
| 색상 하드코딩 | 30+곳 → **0** (effect-constants.ts 단일 소스) |
| centroid prop 타입 | CountryCentroidsMap 타입 정의 완료 |
| renderOrder 충돌 | 비체계적 3~110 → **체계적 8레이어 배정** |
| 표면 고도 변종 | 7+종 → **3단계** (GROUND/LOW/HIGH) |
| 2D blur 변종 | 8/16/20/24px → **12px 단일** |
| CSS 키프레임 중복 | pulse(3곳) + fadeIn(1곳) → **공유 2개** |

## Performance Improvements

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| SanctionBarrier draw calls (N 제재) | 3N+N | 3+N | ~66% 감소 |
| SanctionBarrier Materials | 3N clone | 2 shared | O(N)→O(1) |
| SpyTrail Materials | N clone | 1 shared | O(N)→O(1) |
| ResourceGlow Materials | N clone | 1 shared | O(N)→O(1) |
| 파티클 (far LOD) | 항상 렌더 | 0개 | 100% 감소 |
| 파티클 (mid LOD) | 풀 카운트 | 50% | 50% 감소 |
| 카메라 레이스 컨디션 | 2개 컴포넌트 경쟁 | 단일 CameraController | 해결 |
| 아크 높이 (trade) | 0.15 (표면 가까움) | 0.35 | 2.3x 상향 |
| 아크 높이 (missile) | 0.35 | 0.60 | 1.7x 상향 |

## File Inventory

### 신규 파일 (7개)
| 파일 | 줄수 | 역할 |
|------|------|------|
| `lib/effect-constants.ts` | 340 | 통일 상수 (색상, 고도, renderOrder, 타이밍, 카메라 우선순위, SoundCue) |
| `lib/effect-utils.ts` | 187 | 공유 아크/표면 유틸, GC-prevention, easing |
| `lib/overlay-tokens.ts` | 136 | 2D 오버레이 토큰, 뉴스 색상, 공유 키프레임 |
| `lib/effect-debug.ts` | 254 | 좌표 검증 디버그 유틸 (dev-only) |
| `components/3d/CameraController.tsx` | 354 | 카메라 통합 컨트롤러 (포커스+쉐이크+큐) |
| `hooks/useReducedMotion.ts` | 37 | prefers-reduced-motion 감지 훅 |
| `docs/designs/v24-effects-architecture.md` | 1,018 | 시스템 아키텍처 문서 |

### 수정된 주요 파일 (20+개)
| 파일 | 변경 유형 |
|------|-----------|
| `GlobeAllianceBeam.tsx` | 아크 높이+색상+공유함수 |
| `GlobeTradeRoutes.tsx` | 아크 높이+색상+공유함수 |
| `GlobeWarEffects.tsx` | 아크+CameraShake 제거 (-165줄) |
| `GlobeSanctionBarrier.tsx` | InstancedMesh+아크+색상+LOD |
| `GlobeSpyTrail.tsx` | Material풀링+아크+색상+LOD |
| `GlobeMissileEffect.tsx` | 아크 높이+색상 |
| `GlobeResourceGlow.tsx` | Material풀링+고도+색상+LOD |
| `GlobeNukeEffect.tsx` | 고도+색상+renderOrder |
| `GlobeShockwave.tsx` | 색상+renderOrder |
| `GlobeEventPulse.tsx` | 고도+색상+renderOrder+카메라우선순위 |
| `GlobeConflictIndicators.tsx` | GLSL uniform+고도+renderOrder |
| `GlobeDominationLayer.tsx` | renderOrder |
| `GlobeHoverPanel.tsx` | 오버레이 토큰 |
| `GlobeView.tsx` | CameraController+LOD훅+reducedMotion |
| `NewsFeed.tsx` | 이벤트 색상 동기화 |
| `BgmPlayer.tsx` | 오버레이 토큰 |
| `WelcomeTutorial.tsx` | 오버레이 토큰+키프레임 |
| `LobbyHeader.tsx` | blur 통일 |
| `CountryPanel.tsx` | 키프레임 통합 |
| `page.tsx` | 오버레이 토큰+키프레임 |
| `useGlobeLOD.ts` | 3단계 distance LOD 확장 |

## Lessons Learned & Technical Debt

### 발견된 패턴
1. **"상수 먼저" 패턴**: Phase 1에서 상수/유틸을 먼저 추출하면 후속 Phase에서 import만으로 통일 가능. 순 코드 감소 효과.
2. **카메라 단일 책임**: 여러 컴포넌트가 camera.position을 직접 수정하면 반드시 레이스 컨디션 발생. 단일 CameraController 패턴 필수.
3. **InstancedMesh 전환 타이밍**: 초기 설계 시 InstancedMesh로 시작하는 것이 나중에 전환하는 것보다 훨씬 쉬움.

### 남은 기술 부채
| 항목 | 우선순위 | 비고 |
|------|----------|------|
| LandmarkMeshes/LandmarkSprites/GlobeLandmarks 3중 시스템 | 중간 | LandmarkMeshes 기준 통합 필요 |
| 사운드 시스템 실제 구현 | 낮음 | SoundCue 인터페이스만 정의됨 |
| centroid prop 이름 통일 (countryCentroids vs centroidsMap) | 낮음 | 타입만 정의, 실제 리네임 미완 |
| useFrame 통합 | 낮음 | 13개 개별 useFrame → 성능 측정 후 결정 |
| E2E 테스트 미작성 | 중간 | 시각적 이펙트 E2E는 스냅샷 기반 필요 |

### 향후 개선 기회
- **셰이더 통합**: 여러 이펙트의 ShaderMaterial을 UberShader로 통합 (uber material)
- **이펙트 풀링**: 이벤트 소멸 시 이펙트 오브젝트를 풀에 반환 (GC 압력 감소)
- **GPU 파티클**: CPU 기반 파티클 → GPU compute shader 전환 (대규모 동시 이펙트)
- **사운드 연동**: Web Audio API + spatial audio로 3D 이펙트에 위치 기반 사운드 부여
