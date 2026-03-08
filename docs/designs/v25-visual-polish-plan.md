# PLAN: v25 Arena Visual Polish & AI Texture Overhaul

## 1. 개요

v24에서 Arena 모드의 기본 시각 체계(몬스터 모델, 플레이어 외형, 카메라, 전투 이펙트)를 완성했다. v25는 이를 **질감 수준**에서 고도화한다.

**핵심 전략**: Gemini da:asset으로 AI 텍스처를 생성하고, 투명 배경을 활용한 알파 마스크 기법으로 단순 박스에 풍부한 시각적 디테일을 부여한다.

**현재 문제점 (조사 완료)**:

1. **몬스터가 단색 박스 덩어리** — AREnemyModel은 multi-part이지만 전부 `MeshStandardMaterial({ color })` 단색. 마인크래프트 스타일 질감(픽셀 텍스처)이 전혀 없음
2. **아레나 지형이 밋밋** — ARTerrain은 단색 CircleGeometry + 랜덤 박스 장애물. MC 블록 텍스처(grass/dirt/stone)가 있지만 아레나에서 미사용
3. **아레나 환경 이펙트 부재** — 테마별 특색 없음 (forest에 나뭇잎 파티클 없음, arctic에 눈 없음, desert에 열기 없음)
4. **투사체/아이템 시각이 기본 geometry** — 화살이 박스, 구체가 구체 그대로. 텍스처/글로우/트레일 없음
5. **몬스터 사망 이펙트 없음** — 즉시 사라짐, 파편/페이드/파티클 없음
6. **플레이어 캐릭터 몸통/팔/다리가 단색** — 로비의 body pattern 텍스처(striped/dotted/gradient)가 아레나에서 미사용

**활용할 기존 자산**:
- `cubeling-textures.ts` (1374줄): 12 eye, 8 mouth, 16 hair, 8 body pattern 절차적 텍스처 시스템
- `public/textures/blocks/` (16종 MC 블록 PNG): grass, dirt, stone, sand, oak_log 등
- Gemini da:asset 파이프라인: AI 이미지 생성 → 투명 배경 → 알파 텍스처
- `MCParticles` 시스템: 기존 게임 모드의 파티클 시스템

## 2. 요구사항

### 기능 요구사항
- [FR-1] 5종 적 몬스터에 MC 스타일 픽셀 텍스처 적용 (얼굴/몸통/사지)
- [FR-2] 미니보스 5종에 고유 AI 생성 텍스처 (da:asset 활용)
- [FR-3] 아레나 지형에 MC 블록 텍스처 적용 (grass/dirt/sand 테마별)
- [FR-4] 테마별 환경 파티클 시스템 (forest: 나뭇잎, arctic: 눈, desert: 모래바람)
- [FR-5] 투사체 4종에 트레일 이펙트 + 글로우 개선
- [FR-6] 몬스터 사망 이펙트 (파편 폭발 + 페이드)
- [FR-7] 플레이어 몸통에 body pattern 텍스처 적용 (cubeling-textures 재사용)
- [FR-8] 엘리트/미니보스 아우라 파티클 이펙트
- [FR-9] 필드 아이템에 AI 생성 아이콘 텍스처 (da:asset → PlaneGeometry billboard)

### 비기능 요구사항
- [NFR-1] 60fps 유지 (200 적 + 50 투사체 + 파티클)
- [NFR-2] 텍스처 메모리 ≤ 32MB 추가 (모바일 고려)
- [NFR-3] tsc --noEmit 0 에러
- [NFR-4] AI 생성 텍스처는 16x16 ~ 64x64 픽셀 (MC 스타일 유지)

## 3. 기술 방향

### AI 텍스처 생성 전략 (da:asset)
```
Gemini da:asset 파이프라인:
  1. 프롬프트: "16x16 pixel art [subject], minecraft style, transparent background"
  2. 생성: gemini-3.1-flash-image-preview → base64 PNG
  3. 후처리: 투명 배경 자동 감지 (배경색 ≈ 흰색/검은색 → alpha=0)
  4. 저장: public/textures/arena/[category]/[name].png
  5. 로딩: TextureLoader + NearestFilter (픽셀 아트 보존)
```

### 텍스처 카테고리
| 카테고리 | 대상 | 크기 | 생성 방법 |
|----------|------|------|----------|
| mob-faces | 5종 적 얼굴 | 16x16 | da:asset |
| mob-bodies | 5종 적 몸통 | 16x16 | da:asset |
| miniboss | 5종 미니보스 전용 | 32x32 | da:asset |
| projectiles | 4종 투사체 | 16x16 | da:asset |
| items | 아이템 아이콘 | 32x32 | da:asset |
| effects | 파티클/이펙트 | 16x16 | da:asset (일부 절차적) |
| terrain | 아레나 바닥 | 16x16 | 기존 blocks/ 재사용 |

### 투명 배경 활용 기법
```
1. AlphaTest 방식 (단순):
   material.alphaTest = 0.5
   material.transparent = false  // 정렬 문제 방지
   → 투명 픽셀 완전 제거, 불투명 픽셀만 렌더

2. Transparent 방식 (반투명 필요 시):
   material.transparent = true
   material.depthWrite = true
   material.side = DoubleSide
   → 고스트/슬라임 같은 반투명 효과

3. Billboard 방식 (아이템/이펙트):
   PlaneGeometry + 알파 텍스처
   useFrame에서 camera.quaternion 복사
   → 항상 카메라를 향하는 2D 스프라이트 느낌
```

- **프레임워크**: React Three Fiber v9 (기존)
- **텍스처 로딩**: useTexture (drei) + NearestFilter
- **파티클**: InstancedMesh 기반 (PointsMaterial 대신 — 모바일 호환)
- **성능**: LOD 시스템 유지 (원거리 적은 기존 단색 box 유지)

## 4. 아키텍처 개요

```
텍스처 파이프라인:
  da:asset → PNG (transparent bg) → public/textures/arena/
      ↓
  TextureLoader + NearestFilter
      ↓
  MeshLambertMaterial({ map, alphaTest: 0.5 })
      ↓
  AREnemyModel (faces/bodies), ARProjectiles (sprites),
  ARFieldItems (billboards), ARDeathEffect (particles)

환경 파이프라인:
  기존 blocks/ PNGs → ARTerrain (바닥 텍스처)
  da:asset → 환경 스프라이트 → AREnvironmentFX (파티클)

파티클 시스템:
  InstancedMesh + useFrame ref 업데이트
  → ARDeathEffect (적 사망 파편)
  → AREnvironmentFX (테마별 파티클)
  → ARProjectileTrails (투사체 꼬리)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Gemini 텍스처 품질 불일치 | MC 스타일 깨짐 | 16x16 강제 + "pixel art" 프롬프트 + 후처리 다운스케일 |
| 투명 배경 제거 실패 | 하얀 테두리 | alphaTest threshold 조절 + 수동 후처리 스크립트 |
| 텍스처 수 과다 → 로딩 지연 | 첫 프레임 지연 | 텍스처 아틀라스 + preload + fallback 단색 |
| 파티클 과다 → fps 하락 | 성능 저하 | MAX cap + LOD (원거리 파티클 스킵) |
| da:asset API 키 없음 | 텍스처 생성 불가 | 절차적 fallback (cubeling-textures 패턴) |

## 구현 로드맵

### Phase 1: AI 텍스처 에셋 생성 (da:asset)
| Task | 설명 |
|------|------|
| 몬스터 얼굴 텍스처 5종 | da:asset으로 zombie/skeleton/slime/spider/creeper 얼굴 16x16 픽셀아트 생성 |
| 몬스터 몸통 텍스처 5종 | 각 몬스터 타입별 몸통 패턴 16x16 생성 |
| 미니보스 텍스처 5종 | golem/wraith/dragon/lich/arena 전용 32x32 고해상도 |
| 투사체 스프라이트 4종 | straight(화살)/homing(마법구)/pierce(빔)/aoe(폭발) 16x16 |
| 아이템 아이콘 텍스처 | 포션/무기/방어구 등 32x32 아이콘 (투명배경) |
| 이펙트 스프라이트 | 파편/연기/불꽃/눈/나뭇잎 16x16 파티클 텍스처 |
| 투명 배경 후처리 유틸 | PNG 로드 → 배경색 감지 → alpha=0 변환 Node 스크립트 |

- **design**: N (AI 생성 + 후처리 파이프라인)
- **verify**: 모든 텍스처 파일 존재, 16x16/32x32 크기, 투명 배경 확인

### Phase 2: 몬스터 텍스처 적용 + 사망 이펙트
| Task | 설명 |
|------|------|
| AREnemyModel 텍스처 적용 | 5종 적 머리/몸통에 AI 텍스처 map + alphaTest 적용 |
| 미니보스 텍스처 적용 | 5종 미니보스에 32x32 고유 텍스처 |
| 엘리트 아우라 파티클 | armored(금속 파편)/vampiric(빨간 입자)/explosive(불꽃)/shielded(파란 오브) |
| ARDeathEffect 컴포넌트 | 적 사망 시 파편 InstancedMesh 폭발 (0.5초) + 페이드 |
| 텍스처 프리로더 | useTexture로 아레나 진입 시 모든 몬스터 텍스처 일괄 프리로드 |

- **design**: N
- **verify**: 적 5종이 텍스처 보유. 미니보스 고유 텍스처. 사망 시 파편 이펙트. tsc 0 에러.

### Phase 3: 플레이어 외형 고도화 + 아레나 환경
| Task | 설명 |
|------|------|
| ARPlayer body pattern 텍스처 | cubeling-textures의 generateBodyBase() → 몸통 MeshLambertMaterial map 적용 |
| ARPlayer arm/leg 텍스처 | generateArmBase()/generateLegBase() → 팔/다리 패턴 적용 |
| ARTerrain 블록 텍스처 | 테마별 바닥에 MC 블록 텍스처 타일링 (grass/sand/stone/snow) |
| AREnvironmentFX 컴포넌트 | 테마별 환경 파티클 InstancedMesh (forest→나뭇잎, arctic→눈, desert→모래) |
| 아레나 조명 개선 | 테마별 조명 색온도 + 그림자 힌트 (PointLight 또는 HemisphereLight) |

- **design**: N
- **verify**: 플레이어 몸통에 패턴 텍스처. 바닥에 MC 블록 질감. 테마별 파티클 동작.

### Phase 4: 투사체/아이템 비주얼 고도화
| Task | 설명 |
|------|------|
| ARProjectiles 텍스처 적용 | 4종 투사체에 AI 스프라이트 텍스처 (billboard PlaneGeometry) |
| ARProjectileTrails 컴포넌트 | 투사체 뒤에 페이드 트레일 InstancedMesh (0.3초 잔상 5개) |
| ARFieldItems 아이콘 텍스처 | billboard PlaneGeometry + AI 아이콘 텍스처 (투명배경) |
| ARWeaponEffects 글로우 강화 | slash에 emissive 색상 + 무기 타입별 색 차별화 |
| 빌드 + tsc 통합 검증 | tsc --noEmit + 전체 흐름 확인 |

- **design**: N
- **verify**: 투사체에 스프라이트 텍스처 + 트레일. 아이템에 아이콘. slash에 색상. tsc 0 에러.

## Key Technical Decisions

### 텍스처 포맷 (Phase 1)
16x16 PNG with transparent background. NearestFilter로 로드하여 MC 픽셀아트 느낌 유지. alphaTest=0.5로 투명 영역 완전 제거 (정렬 문제 없음).

### 몬스터 텍스처 적용 방식 (Phase 2)
AREnemyModel의 기존 `<meshStandardMaterial color={...}>` → `<meshLambertMaterial map={texture} alphaTest={0.5}>`로 교체. MeshStandardMaterial → MeshLambertMaterial 다운그레이드는 성능 개선 + MC 스타일 일관성.

### 사망 이펙트 (Phase 2)
InstancedMesh 기반 파편 시스템. 적 사망 좌표에서 8~12개 작은 큐브가 방사형으로 퍼지며 0.5초간 페이드. 적 타입별 파편 색상. MAX_DEATH_EFFECTS=20 cap.

### 환경 파티클 (Phase 3)
테마별 InstancedMesh 파티클 (MAX=100). forest: 초록/갈색 나뭇잎 낙하, arctic: 흰 눈송이 낙하, desert: 모래 입자 횡이동, urban: 없음(깨끗), island: 물방울. useFrame ref 업데이트.

### 투사체 트레일 (Phase 4)
각 투사체 뒤에 5개 잔상 InstancedMesh. 이전 프레임 위치 기록(ring buffer). 잔상은 점점 투명해지며 작아짐. 타입별 트레일 색상.

## Verification Checklist
1. `npx tsc --noEmit` — 0 errors
2. `./game.sh` 재시작
3. Arena 진입 → 적 5종에 텍스처 보임 (단색 X, 픽셀 패턴 O)
4. 미니보스 → 고유 32x32 텍스처 + 아우라
5. 적 사망 → 파편 폭발 이펙트 (0.5초)
6. 투사체 → 스프라이트 텍스처 + 트레일
7. 필드 아이템 → 아이콘 빌보드
8. 플레이어 → 몸통에 패턴, 팔/다리에 질감
9. 바닥 → MC 블록 텍스처 타일링
10. 테마별 파티클 → forest(나뭇잎), arctic(눈) 등
11. 60fps 유지 (200 적 + 파티클)
