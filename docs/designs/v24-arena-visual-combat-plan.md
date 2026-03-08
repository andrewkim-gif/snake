# PLAN: v24 Arena Visual & Combat Overhaul

## 1. 개요

Arena 모드의 4가지 핵심 이슈를 해결하는 시각 + 전투 피드백 대규모 업그레이드.

**현재 문제 (조사 완료)**:
1. **몬스터가 전부 색깔 박스** — zombie/skeleton/slime/spider/creeper 5종 모두 0.8단위 단색 상자
2. **플레이어 캐릭터 얼굴 없음** — 6개 박스(머리/몸/팔/다리)로만 구성, 로비의 풍부한 Cubeling 시스템(12눈/8입/16머리카락) 미사용
3. **카메라 회전 불가** — ARCamera가 canvas에 mousemove 리스너 + useInputManager가 document에 별도 리스너 → 이중 시스템 충돌. Pointer Lock 시 movementX/Y는 document에만 전달 → canvas 리스너 수신 불가. 또한 cameraDeltaRef/scrollDeltaRef가 ARCamera props에 없어 소비자 부재
4. **공격 이펙트 미구현** — 서버가 projectile/damage/status 데이터 전송하지만 클라이언트 렌더링 없음

**핵심 원칙**: 기존 모듈을 최대한 재사용
- VoxelMob.tsx 패턴 → 몬스터 다중 파트 모델 **(하이브리드 LOD: 근거리 multi-part + 원거리 InstancedMesh)**
- cubeling-textures.ts `generateFaceTexture()` + `createHeadMaterials()` → 플레이어 외형 **(서버 appearance 미전송 → 캐릭터 타입별 고정 외형 매핑)**
- cameraDeltaRef produce-consume 패턴 → 카메라 수정 **(inputManager 전체 전달, TPSCamera 패턴 통일)**
- ARState.projectiles/items 데이터 → 이펙트 렌더링 **(ARProjectileNet.type은 weapon ID → trajectory type 매핑 필요)**

## 2. 요구사항

### 기능 요구사항
- [FR-1] 5종 적 + 5종 미니보스가 고유 다중파트 복셀 모델 보유
- [FR-2] 플레이어 캐릭터가 눈/입/머리카락/피부색 가진 Cubeling 외형
- [FR-3] 마우스 이동 → 카메라 회전 (데스크탑 + 모바일 터치)
- [FR-4] 투사체 시각화 (4종: straight/homing/pierce/aoe)
- [FR-5] 근접 공격 이펙트 (slash VFX)
- [FR-6] 필드 아이템 렌더링 (ARFieldItemNet)
- [FR-7] 엘리트/미니보스 시각 차별화 (크기, 색상, 특수 이펙트)

### 비기능 요구사항
- [NFR-1] 60fps 유지 (InstancedMesh 패턴 유지)
- [NFR-2] 200 적 + 50 투사체 동시 렌더링
- [NFR-3] 모바일 터치 카메라 회전 작동
- [NFR-4] tsc --noEmit 0 에러

## 3. 기술 방향
- **프레임워크**: React Three Fiber v9 (기존)
- **적 모델**: 하이브리드 LOD — 근거리(≤20m) 최대 30개 multi-part group + 원거리 InstancedMesh box 폴백
- **플레이어 외형**: cubeling-textures.ts의 `generateFaceTexture()` + `createHeadMaterials()` → ARPlayer 머리 6-material 적용
- **카메라**: ARCamera에 `inputManager: InputManagerReturn` 전체 prop 전달 (TPSCamera 패턴 통일)
- **이펙트**: 별도 AR 컴포넌트 (ARProjectiles, ARWeaponEffects) + weapon ID → trajectory type 매핑 테이블
- **Appearance**: 서버 미전송 → `CHARACTER_APPEARANCE_MAP` 클라이언트 상수 (ARCharacterType → 고정 외형)

## 4. 근본 원인 분석

### 4.1 카메라 회전 불가 (Critical Bug)

```
현재 흐름 (BROKEN — 이중 시스템 충돌):
  useInputManager (useInputManager.ts:145-149):
    document.addEventListener('mousemove') → cameraDeltaRef.dx/dy 누적
    document.addEventListener('wheel') → scrollDeltaRef 누적
  ARCamera (ARCamera.tsx:51-77):
    gl.domElement.addEventListener('mousemove') → 자체 yaw/pitch refs (별도)
    gl.domElement.addEventListener('wheel') → 자체 distance ref (별도)
  문제 1: pointer lock 활성 시 movementX/Y는 document에만 전달 → canvas 리스너 수신 불가
  문제 2: cameraDeltaRef/scrollDeltaRef가 ARCamera props에 존재하지 않음 → 소비자 없이 무한 누적
  문제 3: 모바일 handleARMobileCameraRotate → cameraDeltaRef에 쓰지만 ARCamera가 안 읽음

  현재 ARCamera props (GameCanvas3D.tsx:899-904):
    playerPosRef, locked, yawRef, inputAzimuthRef  ← cameraDeltaRef/scrollDeltaRef 없음!

수정 후 흐름 (FIXED — TPSCamera 패턴 통일):
  useInputManager: document.addEventListener('mousemove') → cameraDeltaRef.dx/dy 누적
  ARCamera: inputManager prop 수신 → useFrame에서 cameraDeltaRef.dx/dy 소비 → 0 리셋
  ARCamera: inputManager.scrollDeltaRef 소비 → distance 업데이트 → 0 리셋
  ARCamera: inputManager.azimuthRef에 yaw 동기화
  결과: 데스크탑 pointer lock + 모바일 터치 모두 동일 파이프라인
```

파일: `ARCamera.tsx` (111줄) — mousemove/wheel 리스너 useEffect 전체 제거, useFrame에서 cameraDeltaRef/scrollDeltaRef 소비
파일: `GameCanvas3D.tsx` — ARCamera에 `inputManager` prop 전달 추가

### 4.2 몬스터 단색 박스 (Visual)

```
현재: AREntities.tsx line 184
  <boxGeometry args={[0.8, 0.8, 0.8]} /> — 모든 적 동일 box
  색상만 다름: zombie=#4CAF50, skeleton=#E0E0E0, slime=#8BC34A ...

⚠ 성능 제약: multi-part group (5-8 mesh per mob) × 200 = 1,000~1,600 draw calls → 불가
  VoxelMob 패턴(pig/sheep/chicken)은 소수 정적 오브젝트용이므로 200+에 부적합

수정: 하이브리드 LOD 렌더링
  근거리 (≤20m, MAX_DETAIL_ENEMIES=30):
    AREnemyModel group — 타입별 multi-part VoxelMob 스타일
    30 × 5 파트 = 150 draw calls (허용 범위)
  원거리 (20-60m):
    기존 InstancedMesh 유지 — 단색 box + instanceColor (변경 없음)
    차별점: 타입별 geometry 크기만 다르게 (slime=납작, spider=넓적 등)
  60m+: 렌더링 스킵 (기존 LOD_CULL 유지)

  몬스터 모델 (파트 최소화: 3-5 파트/종):
    zombie: 머리(0.5) + 몸(0.6x0.8x0.4) + 다리×2 = 4 파트
    skeleton: 머리(0.35) + 몸(0.3x0.9x0.25) + 팔×2 = 4 파트
    slime: 외부 반투명(0.9) + 내부 core(0.4) + 눈×2 = 4 파트
    spider: 몸(0.7x0.3x0.5) + 다리×4 = 5 파트
    creeper: 머리(0.5) + 몸(0.5x1.0x0.35) + 다리×2 = 4 파트
```

### 4.3 플레이어 얼굴 없음 (Visual)

```
현재 ARPlayer.tsx:
  머리 = 0.625 box + 단색 headMat(MeshLambertMaterial color:0xffe0bd)
  눈, 입, 머리카락, 피부톤 변화 없음

로비 시스템 (이미 존재):
  cubeling-textures.ts: generateFaceTexture(eye, mouth) → CanvasTexture
  cubeling-textures.ts: createHeadMaterials(eye, mouth, marking, hair) → 6-material 배열
  cubeling-textures.ts: generateHairTopTexture/BackTexture/SideTexture(hairStyle)
  AgentInstances.tsx: HeadGroupManager (face atlas + InstancedMesh → 다수 에이전트용, 직접 사용 안함)

⚠ Appearance 데이터 경로 부재:
  ARPlayerNet (ar-types.ts:129-147)에 appearance 필드 없음
  서버가 eyeStyle/mouthStyle/hairStyle 등을 전송하지 않음
  ARCharacterSelect에서 선택하는 것은 ARCharacterType (전투 캐릭터, 외형 아님)

수정: CHARACTER_APPEARANCE_MAP — 캐릭터 타입별 고정 외형 매핑
  - 클라이언트 상수로 ARCharacterType → { eyeStyle, mouthStyle, hairStyle, skinTone, hairColor, bodyColor } 매핑
  - cubeling-textures.ts의 createHeadMaterials() → ARPlayer 머리 6면 material
  - 서버 변경 불필요 (클라이언트 전용)
  - 예: striker → { eye:0(Default), mouth:0(Smile), hair:1(Spiky), skin:#ffe0bd, hairColor:#3A3028 }
```

### 4.4 공격 이펙트 미구현 (Combat Feedback)

```
서버 전송 데이터 (이미 있음):
  ARState.projectiles: ARProjectileNet[] — id, x, z, type (⚠ type = weapon ID, NOT trajectory type)
  ARState.items: ARFieldItemNet[] — id, itemId, x, z
  damage events → ARDamageNumbers (작동 중)
  status effects → ARStatusEffects (작동 중)

⚠ ARProjectileNet.type 필드 주의:
  ar-types.ts:174 — `type: string; // weapon ID for visual selection`
  ARProjectileType ('straight'|'homing'|'pierce'|'aoe') 정의는 있지만
  네트워크 데이터에는 trajectory type이 아닌 weapon ID가 전송됨
  → WEAPON_TRAJECTORY_MAP 필요: { bow:'straight', lightning_staff:'homing', ... }

⚠ 공격 애니메이션 트리거 — isAttacking 상태 없음:
  ARPlayerNet에 isAttacking 필드 없음 (서버 미전송)
  → ARDamageEvent 수신 시 자기 ID가 attacker면 공격 애니메이션 트리거 (로컬)
  → 또는 weapon의 attack_speed 기반 주기적 slash (로컬 타이머)

미구현:
  - 투사체 비주얼 (weapon ID → trajectory type 매핑 후 4종 mesh)
  - 근접 공격 slash 이펙트 (ARDamageEvent 기반 트리거)
  - 필드 아이템 렌더링
  - 공격 시 플레이어 애니메이션 (오른팔 스윙)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 몬스터 multi-part → 200개 draw call 폭증 | Critical 성능 | **하이브리드 LOD**: 근거리 30개만 multi-part, 나머지 InstancedMesh box |
| cubeling texture 로딩 지연 | 첫 프레임 깜빡임 | preload + fallback 단색 headMat |
| 투사체 200개 → draw call 폭증 | fps 하락 | InstancedMesh + MAX_PROJECTILES=100 cap |
| 카메라 수정 → 기존 동작 변경 | 조작감 차이 | sensitivity 동일 (0.003) + inputManager 패턴 통일 |
| ARPlayerNet에 appearance 없음 | 외형 미적용 | CHARACTER_APPEARANCE_MAP 클라이언트 상수 (서버 변경 불필요) |
| ARProjectileNet.type = weapon ID | 렌더링 분기 오류 | WEAPON_TRAJECTORY_MAP 매핑 테이블 추가 |
| isAttacking 서버 미전송 | 공격 애니메이션 불가 | ARDamageEvent 수신 기반 로컬 트리거 |

## 구현 로드맵

### Phase 1: 카메라 수정 (Critical Bug Fix)
| Task | 설명 |
|------|------|
| ARCameraProps 변경 | `locked` + `yawRef` + `inputAzimuthRef` 제거 → `inputManager: InputManagerReturn` 단일 prop (TPSCamera 패턴 통일) |
| ARCamera useEffect 전체 제거 | canvas mousemove + wheel 리스너 등록/해제 useEffect 블록 (line 51-77) 삭제 |
| ARCamera useFrame에서 cameraDeltaRef 소비 | `inputManager.cameraDeltaRef.current.dx/dy` 읽고 → yaw/pitch 업데이트 → `md.dx=0; md.dy=0;` 리셋 (TPSCamera line 290-295 패턴) |
| ARCamera useFrame에서 scrollDeltaRef 소비 | `inputManager.scrollDeltaRef.current` 읽고 → distance 업데이트 → `= 0` 리셋 (TPSCamera line 299-303 패턴) |
| ARCamera azimuthRef 동기화 | useFrame 끝에서 `inputManager.azimuthRef.current = yaw.current;` (WASD 방향 계산용) |
| GameCanvas3D ARCamera prop 수정 | `<ARCamera inputManager={inputManager} playerPosRef={arPlayerPosRef} />` (기존 4 props → 2 props) |
| 모바일 터치 자동 연결 확인 | `handleARMobileCameraRotate` → `inputManager.cameraDeltaRef` → ARCamera useFrame 소비 (코드 변경 불필요, 파이프라인 자동 연결) |

- **design**: N
- **verify**: 마우스 이동 → 카메라 회전. ESC로 포인터 락 해제. 모바일 터치 회전. WASD가 카메라 방향 기준 이동. scrollDeltaRef 무한 누적 없음.

### Phase 2: 몬스터 비주얼 리디자인
| Task | 설명 |
|------|------|
| AREnemyModel 컴포넌트 생성 | VoxelMob 패턴 5종 적 multi-part 모델 (파트 최소화: 3-5개/종) |
| zombie 모델 (4파트) | 머리(0.5) + 몸(0.6x0.8x0.4) + 다리×2 + 녹색 톤 |
| skeleton 모델 (4파트) | 머리(0.35) + 몸(0.3x0.9x0.25) + 팔×2 + 뼈 색(#E0E0E0) |
| slime 모델 (4파트) | 외부 반투명 큐브(0.9) + 내부 core(0.4, 불투명) + 눈×2 |
| spider 모델 (5파트) | 납작 몸(0.7x0.3x0.5) + 다리×4(얇은 box) — 빨간 눈은 머티리얼 emissive로 표현 |
| creeper 모델 (4파트) | 머리(0.5) + 키 큰 몸(0.5x1.0x0.35) + 다리×2 + 검정 얼굴 패턴 |
| 미니보스 스케일/이펙트 | golem(2x), wraith(투명+글로우), dragon_whelp(1.5x+빨강), lich_king(보라+파티클), the_arena(3x) |
| 엘리트 어픽스 표시 | armored(메탈릭), swift(잔상), vampiric(빨강 오라), explosive(주황 맥동), shielded(파랑 쉴드) |
| **하이브리드 LOD AREntities 리팩토링** | 근거리(≤20m) MAX_DETAIL=30 → AREnemyModel group 렌더링 / 원거리(20-60m) → 기존 InstancedMesh box / 60m+ → 스킵 |
| 거리 정렬 로직 | useFrame에서 적 배열을 플레이어 거리순 정렬 → 가까운 30개 multi-part, 나머지 InstancedMesh |

- **design**: N (Minecraft 스타일이므로 코드 기반 복셀)
- **verify**: 근거리 5종 적이 고유 형태. 원거리는 기존 색상 box. 미니보스 크고 특수 이펙트. 60fps 유지.

### Phase 3: 플레이어 Cubeling 외형 적용
| Task | 설명 |
|------|------|
| CHARACTER_APPEARANCE_MAP 상수 | `ar-types.ts`에 `ARCharacterType → ARCharacterAppearance` 매핑 (8캐릭터 × {eye, mouth, hair, skinTone, hairColor, bodyColor, legColor}) |
| ARCharacterAppearance 타입 | `{ eyeStyle:number, mouthStyle:number, hairStyle:number, skinTone:string, hairColor:string, bodyColor:string, legColor:string }` |
| ARPlayer에 characterType prop 추가 | `characterType: ARCharacterType` → 내부에서 `CHARACTER_APPEARANCE_MAP[characterType]`로 외형 결정 |
| 머리 6-material 적용 | `createHeadMaterials(eye, mouth, 0, hair)` → 6면 material (정면=얼굴, 측면/후면=헤어) |
| 머리 material.color에 skinTone 적용 | 정면(index 4): skinTone 틴트 + 얼굴 텍스처, 측면/상/후: hairColor 틴트 + 헤어 텍스처 |
| 피부/옷 색상 적용 | skinTone → headMat/limbMat, bodyColor → bodyMat, legColor → legMat |
| 공격 애니메이션 (ARDamageEvent 기반) | `lastAttackTime` ref — ARDamageEvent에서 자기 ID가 attacker일 때 갱신 → 0.3초간 오른팔 전방 스윙 |
| GameCanvas3D에서 characterType 전달 | 아레나 상태에서 현재 플레이어의 `character` 필드 → ARPlayer characterType prop |

- **design**: N (기존 cubeling-textures 모듈 재사용 + 서버 변경 불필요)
- **verify**: 플레이어가 눈/입/머리카락 있는 캐릭터. 캐릭터 타입별 외형 차별. 공격 시 팔 스윙.

### Phase 4: 전투 이펙트 시스템
| Task | 설명 |
|------|------|
| WEAPON_TRAJECTORY_MAP 상수 | `ar-types.ts`에 `ARWeaponID → ARProjectileType` 매핑 (bow→straight, lightning_staff→homing, fire_staff→aoe 등) |
| ARProjectiles 컴포넌트 | ARState.projectiles 렌더링 — InstancedMesh (MAX=100) + `WEAPON_TRAJECTORY_MAP[weaponId]`로 trajectory type 결정 |
| 투사체 타입별 비주얼 | straight(화살 형태 IM), homing(빛나는 구 IM), pierce(길쭉한 광선 IM), aoe(팽창하는 원 — 별도 mesh) |
| ARWeaponEffects 컴포넌트 | 근접 slash 이펙트 — 반원 아크 메쉬 (0.2초 페이드), ARDamageEvent 수신 시 트리거 |
| ARFieldItems 컴포넌트 | ARState.items → InstancedMesh (회전하는 작은 아이콘, MAX=50) |
| 공격 범위 오라 개선 | 정적 원 → 공격 시 맥동 (ARDamageEvent 수신 → 0.3초 pulse) |
| 빌드 + 통합 테스트 | tsc --noEmit + 전체 흐름: 진입 → 캐릭터 선택 → 배치 → 전투 → 사망 → 관전 |

- **design**: N
- **verify**: 투사체가 화면에 보임 (weapon ID→trajectory 매핑 정확). 근접 공격 시 slash 이펙트. 필드 아이템 보임. tsc 0 에러.

## Key Technical Decisions

### 카메라 수정 (Phase 1)
ARCamera의 자체 mousemove/wheel 리스너 useEffect를 완전 제거. `inputManager: InputManagerReturn` 전체를 prop으로 받아 useFrame에서 `cameraDeltaRef`와 `scrollDeltaRef`를 consume-reset. TPSCamera(line 185-303)와 완전 동일한 패턴. `locked`, `yawRef`, `inputAzimuthRef` props는 inputManager 내부 refs로 대체.

### 몬스터 렌더링 (Phase 2) — 하이브리드 LOD (검증 후 변경)
**기존 기획**: 모든 적을 multi-part group → **불가** (200 × 5파트 = 1,000 draw calls).
**수정**: 하이브리드 LOD — 근거리(≤20m) 최대 30개만 AREnemyModel multi-part group + 원거리 기존 InstancedMesh box 유지. useFrame에서 거리순 정렬 후 가까운 30개만 상세 렌더링. 원거리 box에도 타입별 scale 차이 추가 (slime=납작, spider=넓적).

### 플레이어 외형 (Phase 3) — CHARACTER_APPEARANCE_MAP (검증 후 변경)
**기존 기획**: "캐릭터 선택 시 appearance 데이터 전달" → **불가** (서버 ARPlayerNet에 appearance 필드 없음).
**수정**: 클라이언트 상수 `CHARACTER_APPEARANCE_MAP`으로 `ARCharacterType` → 고정 외형 매핑. `createHeadMaterials(eye, mouth, 0, hair)` → 6면 material을 ARPlayer 머리에 적용. 각 material.color에 skinTone/hairColor 틴트. 서버 변경 불필요.

### 전투 이펙트 (Phase 4) — weapon ID → trajectory 매핑 (검증 후 변경)
**기존 기획**: "4종 투사체 타입별 비주얼" → **주의**: `ARProjectileNet.type`이 trajectory type이 아닌 weapon ID.
**수정**: `WEAPON_TRAJECTORY_MAP` 상수로 weapon ID → `ARProjectileType` 매핑 후 비주얼 분기. 근접 이펙트 트리거는 `isAttacking`(서버 미전송) 대신 `ARDamageEvent` 수신 기반으로 로컬 생성.

## Verification Checklist
1. `npx tsc --noEmit` — 0 errors
2. `./game.sh` 재시작
3. Arena 진입 → 캐릭터 선택 → **커서 보임, 버튼 클릭 가능**
4. Deploy → **마우스 이동 = 카메라 회전** (데스크탑, pointer lock 활성)
5. WASD → **카메라 방향 기준 이동**
6. 스크롤 → **줌 인/아웃** (scrollDeltaRef 무한 누적 없음)
7. 모바일 터치 → **카메라 회전** (handleARMobileCameraRotate 경유)
8. 근거리 적 5종 → **각각 고유 multi-part 형태** (zombie≠skeleton≠slime≠spider≠creeper)
9. 원거리 적 → **기존 색상 box** (성능 보장)
10. 미니보스 → **크고 특수 이펙트**
11. 플레이어 → **눈, 입, 머리카락 보임** (캐릭터 타입별 차별화)
12. 공격 시 → **slash/projectile 이펙트 보임** (ARDamageEvent 기반 트리거)
13. 투사체 → **weapon ID 기반 trajectory 매핑 정확** (bow=화살, staff=빛나는 구 등)
14. 60fps 유지 (200 적 기준, 근거리 30개 multi-part + 나머지 InstancedMesh)

## 검증 보고서 반영 사항 (2026-03-08)

| # | 심각도 | 원래 기획 | 수정 내용 | 상태 |
|---|--------|----------|----------|------|
| C-1 | Critical | ARCamera에 cameraDeltaRef prop 추가 | `inputManager: InputManagerReturn` 전체 전달 (TPSCamera 통일) | ✅ 반영 |
| C-2 | Critical | 200개 모두 multi-part group | 하이브리드 LOD: 근거리 30개 multi-part + 원거리 InstancedMesh | ✅ 반영 |
| C-3 | Critical | 서버에서 appearance 전달 | CHARACTER_APPEARANCE_MAP 클라이언트 상수 (서버 변경 불필요) | ✅ 반영 |
| H-1 | High | 4개 개별 props 전달 | inputManager 전체 전달 (C-1에 포함) | ✅ 반영 |
| H-2 | High | trajectory type으로 분기 | WEAPON_TRAJECTORY_MAP 매핑 테이블 추가 | ✅ 반영 |
| H-3 | High | scrollDeltaRef 소비 누락 | inputManager.scrollDeltaRef 소비 패턴 명시 | ✅ 반영 |
| M-2 | Medium | isAttacking 서버 전송 | ARDamageEvent 수신 기반 로컬 트리거 | ✅ 반영 |
| M-3 | Medium | 근접 slash 타이밍 | ARDamageEvent 수신 시 트리거 | ✅ 반영 |
| M-4 | Medium | 다른 플레이어 Cubeling | Phase 3 범위 외 (로컬 플레이어만) | 미반영 (향후) |
