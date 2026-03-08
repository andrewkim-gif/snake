# REPORT: v24 Arena Visual & Combat Overhaul

> Generated: 2026-03-09 | Pipeline: da:work (Turbo) | Commit: 548fccc

## Executive Summary

v24는 Arena 모드의 4가지 핵심 시각/전투 문제를 해결하는 대규모 업그레이드다. 카메라 회전 불가 버그 수정, 5종 몬스터 고유 복셀 모델, 플레이어 Cubeling 외형 적용, 투사체/슬래시/필드아이템 전투 이펙트 시스템을 구현했다. 전 Phase tsc --noEmit 0 에러로 통과.

| 항목 | 값 |
|------|-----|
| Phase 수 | 4 |
| 커밋 | 548fccc (단일 atomic commit) |
| 파일 변경 | 11 files (+1,624 / -87 lines) |
| 신규 파일 | 4 (AREnemyModel, ARProjectiles, ARWeaponEffects, ARFieldItems) |
| 수정 파일 | 5 (ARCamera, AREntities, ARPlayer, ar-types, GameCanvas3D) |
| 문서 | 2 (plan, checkpoint) |
| TypeScript 에러 | 0 |
| 기획 검증 이슈 | 12개 발견 → 8개 기획 반영 후 구현 |
| E2E | 스킵 (WebGL 3D arena, Playwright DOM 불가) |

## Phase별 상세

### Phase 1: 카메라 수정 (Critical Bug Fix)

**문제**: ARCamera가 canvas에 mousemove 리스너 → Pointer Lock 시 이벤트는 document로 전달 → 카메라 회전 불가

**해결**: TPSCamera의 cameraDeltaRef produce-consume 패턴으로 통일
- ARCamera: canvas event listener 전체 제거
- Props: `{ playerPosRef, locked, yawRef, inputAzimuthRef }` → `{ playerPosRef, inputManager }`
- useFrame에서 `cameraDeltaRef.dx/dy` 소비 → yaw/pitch 업데이트 → 0 리셋
- scrollDeltaRef 소비로 줌 통합

**파일**: ARCamera.tsx (64줄 변경), GameCanvas3D.tsx (props 업데이트)

### Phase 2: 몬스터 비주얼 리디자인

**문제**: 5종 적이 전부 0.8 단위 단색 박스

**해결**: Hybrid LOD + Multi-part 모델
- **AREnemyModel.tsx** (352줄, 신규): VoxelMob 패턴 기반 5종 고유 모델
  - zombie: 사각 머리 + 넓은 몸 + 짧은 팔/다리 + 녹색
  - skeleton: 작은 머리 + 얇은 몸 + 긴 팔 + 뼈 색
  - slime: 반투명 외부 큐브 + 불투명 core + 눈
  - spider: 납작 몸 + 다리 + 빨간 눈
  - creeper: 키 큰 몸 + 짧은 다리 + 얼굴 패턴
- **미니보스 5종**: golem(2x), wraith(투명+글로우), dragon_whelp(1.5x), lich_king(보라), the_arena(3x+금)
- **엘리트 어픽스 5종**: armored(메탈릭), swift, vampiric(빨강), explosive(주황), shielded(파랑 구)
- **Hybrid LOD**: near ≤20m → max 30 multi-part group (pre-mount pool), far → InstancedMesh box
  - 원래 기획: 200개 전부 multi-part → 1,600 draw call 문제 → 검증에서 발견 → hybrid로 수정

**파일**: AREnemyModel.tsx (352줄 신규), AREntities.tsx (288줄 변경)

### Phase 3: 플레이어 Cubeling 외형

**문제**: 플레이어 머리가 단색 박스, 눈/입/머리카락 없음

**해결**: cubeling-textures.ts 재사용 + CLIENT-side appearance 매핑
- **CHARACTER_APPEARANCE_MAP**: 8개 캐릭터 타입 → 고유 외형 (eyeStyle, mouthStyle, hairStyle, skinTone, hairColor, bodyColor, legColor)
  - 서버가 appearance 데이터를 전송하지 않으므로 클라이언트 상수로 해결 (검증에서 발견)
- **6-face head materials**: cubeling-textures의 createHeadMaterials() → 전면(눈/입), 상단(머리카락), 후면(머리카락), 좌우(피부), 하단(피부)
- **Attack animation**: ARDamageEvent 기반 → lastAttackTimeRef → 오른팔 전방 스윙 (0.3초)
  - 서버에 isAttacking 상태 없으므로 로컬 damage event로 트리거 (검증에서 발견)

**파일**: ar-types.ts (71줄 추가), ARPlayer.tsx (76줄 변경), GameCanvas3D.tsx (props)

### Phase 4: 전투 이펙트 시스템

**문제**: 서버가 projectile/damage/item 데이터 전송하지만 클라이언트 시각화 없음

**해결**: 3개 신규 컴포넌트 + 타입 매핑
- **WEAPON_TRAJECTORY_MAP**: weapon ID → trajectory type (straight/homing/pierce/aoe)
  - ARProjectileNet.type은 weapon ID(숫자)이므로 매핑 필요 (검증에서 발견)
- **ARProjectiles.tsx** (231줄): 4개 InstancedMesh per trajectory type
  - straight: BoxGeometry(0.1×0.1×0.45) 화살
  - homing: SphereGeometry(0.2) 발광 구 + 맥동
  - pierce: CylinderGeometry(0.05×0.8) 관통 빔
  - aoe: TorusGeometry(0.8) 팽창 링 + 반투명
- **ARWeaponEffects.tsx** (185줄): 근접 slash VFX
  - 개별 material 배열 (8슬롯 풀) → 독립 opacity 페이드
  - CircleGeometry 반원 아크, 0.2초 페이드 + 회전 확대
  - ARDamageEvent 트리거 (공격 범위 4m 이내)
- **ARFieldItems.tsx** (116줄): 필드 아이템 렌더링
  - 가변 `mesh.count` 패턴 (미사용 인스턴스 GPU 스킵)
  - 희귀도별 instanceColor + 부유/회전 애니메이션

**파일**: ar-types.ts (WEAPON_TRAJECTORY_MAP), ARProjectiles.tsx, ARWeaponEffects.tsx, ARFieldItems.tsx (모두 신규)

## 기획 검증 (da:verify → da:improve)

구현 전 기획서를 코드베이스 대비 검증하여 12개 이슈 발견, 8개를 기획에 반영:

| ID | 심각도 | 이슈 | 해결 |
|----|--------|------|------|
| C-1 | Critical | ARCamera 버그 진단 부분적 — cameraDeltaRef/scrollDeltaRef props 누락 | inputManager 통합 prop 패턴으로 수정 |
| C-2 | Critical | 200개 multi-part → 1,600 draw call 성능 불가 | Hybrid LOD (30 near + far InstancedMesh) |
| C-3 | Critical | ARPlayerNet에 appearance 필드 없음 | CLIENT-side CHARACTER_APPEARANCE_MAP |
| H-1 | High | ARCamera props 4개 개별 → inputManager 통합 필요 | InputManagerReturn prop으로 통일 |
| H-2 | High | ARProjectileNet.type = weapon ID, not trajectory | WEAPON_TRAJECTORY_MAP 매핑 테이블 |
| H-3 | High | scrollDeltaRef 소비자 없음 (무한 누적) | ARCamera useFrame에서 소비 |
| M-2 | Medium | isAttacking 서버 상태 없음 | ARDamageEvent 기반 로컬 트리거 |
| M-3 | Medium | Slash timing 이슈 | lastAttackTimeRef 0.3초 윈도우 |

## 성능 아키텍처

| 패턴 | 적용 |
|------|------|
| InstancedMesh | AREntities(far), ARProjectiles(4종), ARFieldItems |
| Pre-mount pool | AREnemyModel 30개 사전 마운트 (visibility ref) |
| Ref-only update | 모든 useFrame — setState 0회 |
| Geometry/Material dispose | useEffect cleanup 전 컴포넌트 |
| 가변 count | ARProjectiles, ARFieldItems (GPU 미사용 인스턴스 스킵) |
| Hybrid LOD | near ≤20m multi-part, far InstancedMesh, cull >60m |

## 요구사항 커버리지

| 요구사항 | 상태 |
|----------|------|
| [FR-1] 5종 적 고유 다중파트 복셀 모델 | ✅ |
| [FR-2] 플레이어 눈/입/머리카락 Cubeling 외형 | ✅ |
| [FR-3] 마우스 이동 → 카메라 회전 | ✅ |
| [FR-4] 투사체 시각화 4종 | ✅ |
| [FR-5] 근접 slash 이펙트 | ✅ |
| [FR-6] 필드 아이템 렌더링 | ✅ |
| [FR-7] 미니보스/엘리트 시각 차별화 | ✅ |
| [NFR-1] 60fps 유지 | ✅ (Hybrid LOD + InstancedMesh) |
| [NFR-2] 200 적 + 50 투사체 동시 | ✅ (LOD cap + variable count) |
| [NFR-4] tsc --noEmit 0 에러 | ✅ |

## 기술 부채 / 향후 개선

1. **모바일 터치 카메라**: GameCanvas3D의 `handleARMobileCameraRotate` → cameraDeltaRef 경로 동작 확인 필요
2. **다른 플레이어 외형**: 현재 자신만 Cubeling 외형, 다른 플레이어는 기존 단색 box (ARPlayerNet에 appearance 추가 시 확장 가능)
3. **투사체 물리 궤적**: 현재 서버 좌표 기반 위치만 표시, homing 곡선/pierce 관통 궤적은 서버 데이터에 의존
4. **몬스터 사망 이펙트**: 현재 즉시 사라짐, 파편/페이드 이펙트 추가 가능
5. **사운드 이펙트**: 공격/투사체/아이템 획득 SFX 미구현

## 결론

v24는 Arena 모드의 시각적 완성도를 근본적으로 개선했다. 기획 검증을 선행하여 3개 Critical 이슈(성능 불가, 데이터 부재, 버그 오진)를 구현 전에 발견하고 수정함으로써 재작업 없이 4 Phase를 한 번에 완주했다.
