# PLAN: V45 — 텍스처 & 에셋 품질 개선

## 1. 개요

### 배경
V44에서 파티클/적AI/아이템 형태/블록 텍스처를 개선했으나,
모든 게임 오브젝트(몬스터, 아이템, 이펙트)가 **순수 색상 기반**이라 시각적 퀄리티가 낮습니다.
블록 텍스처도 기본 MC 16x16으로 단조롭고, 이펙트에는 텍스처 스프라이트가 전혀 없습니다.

### 핵심 목표
5가지 축으로 시각 품질을 대폭 개선합니다:
1. **블록 텍스처 개선** — Gemini로 고품질 블록 텍스처 생성 + 변형(잔디/돌/흙)으로 단조로움 해소
2. **몬스터 텍스처** — 프로시저럴 CanvasTexture로 12종 템플릿에 픽셀아트 질감 추가
3. **이펙트 스프라이트** — 파티클/공격/환경용 투명 PNG 텍스처 생성 (Gemini + rembg 배경 제거)
4. **아이템 텍스처** — 아이템별 고유 텍스처로 식별성 강화
5. **식물/환경 다양화** — 나무 종류 추가, 꽃/풀/버섯 등 장식 오브젝트

### 검증된 기술 컨텍스트
| 항목 | 현재 상태 | 목표 |
|------|----------|------|
| 블록 텍스처 | 16개 PNG (212~3617 bytes), 기본 MC 품질 | Gemini 생성 32x32 고품질 + 잔디/돌/흙 변형 3종씩 |
| 몬스터 텍스처 | 없음 — MeshStandardMaterial 단색 | 12종 템플릿별 프로시저럴 CanvasTexture (16x16 얼굴/몸통) |
| 이펙트 텍스처 | 없음 — 지오메트리+색상만 | spark/flame/smoke/slash 등 8종 스프라이트 PNG |
| 아이템 텍스처 | 없음 — emissive 색상만 | 아이템별 CanvasTexture 또는 Gemini 생성 PNG |
| 나무/식물 | oak 1종만 (oak_log + oak_leaves) | birch, spruce 추가 + 꽃/풀/버섯 장식 |
| 구름 | 흰색 MeshBasicMaterial 박스 | 반투명 구름 텍스처 빌보드 |
| arena 디렉토리 | fx/, items/, mobs/, miniboss/ 전부 비어있음 | 각 디렉토리에 텍스처 배치 |
| Gemini API | GEMINI_API_KEY 미설정 | 환경변수 설정 후 da:asset 활용 |
| rembg | v2.0.72 설치됨 | 이펙트 PNG 배경 제거에 활용 |
| ImageMagick | 미설치 | rembg로 대체 (AI 기반 배경 제거) |

## 2. 요구사항

### 기능 요구사항
| ID | 요구사항 | Priority |
|----|----------|----------|
| FR-01 | Gemini API로 블록 텍스처 32x32 재생성: grass_top, grass_side, dirt, stone, sand, coal_ore, bedrock, cobblestone, gravel (9종). 기존 텍스처를 레퍼런스로 "pixel art minecraft style" 프롬프트 | High |
| FR-02 | 잔디 변형 텍스처 3종: grass_top_dark(진한 초록), grass_top_dry(마른 풀), grass_top_lush(진녹) — 노이즈 기반 랜덤 배치로 단조로움 해소 | High |
| FR-03 | 돌/흙 변형 텍스처: stone_mossy, stone_cracked, dirt_mossy, dirt_path (4종) — 바이옴/깊이별 차등 적용 | Medium |
| FR-04 | 몬스터 CanvasTexture: 12종 템플릿(humanoid_small/medium/large, flying, crawler, sphere, quadruped, turret, boss_small/medium/large, cube)별 16x16 프로시저럴 얼굴/몸통 텍스처 생성. agent-textures.ts 패턴 재사용 | High |
| FR-05 | 몬스터 텍스처 적용: EnemyRenderer의 template pool MeshStandardMaterial에 map 속성 추가. 기존 per-instance color 시스템과 공존 (color * map 블렌딩) | High |
| FR-06 | 이펙트 스프라이트 텍스처 8종: spark.png, flame.png, smoke.png, dust.png, slash_trail.png, bullet_trail.png, hit_flash.png, xp_glow.png — Gemini 생성(검은 배경) → rembg 배경 제거 → 투명 PNG | High |
| FR-07 | 이펙트 텍스처 적용: DeathParticles의 PointsMaterial.map에 spark/flame 텍스처 적용. SwingArc에 slash_trail 텍스처 오버레이 | High |
| FR-08 | 아이템 CanvasTexture: chicken(닭다리 픽셀아트), chest(보물상자), bomb(도화선+폭탄), magnet(빨강/파랑 극), xp_orb(발광 그라디언트) — 5종 프로시저럴 텍스처 | Medium |
| FR-09 | 아이템 텍스처 적용: PickupRenderer의 각 타입별 material.map에 CanvasTexture 적용. 기존 emissive 색상 시스템과 공존 | Medium |
| FR-10 | 나무 종류 추가: birch(자작나무 — 흰 줄기/밝은 잎), spruce(가문비 — 어두운 줄기/짙은 잎). 텍스처 4종(birch_log, birch_leaves, spruce_log, spruce_leaves) + MCNoise에 바이옴별 나무 종류 분기 | Medium |
| FR-11 | 바닥 장식 오브젝트: flower_red, flower_yellow, tall_grass, mushroom_red — 4종 빌보드 스프라이트. 전투 구역 외곽에 랜덤 배치 | Low |
| FR-12 | 구름 텍스처 개선: 현재 흰색 BoxGeometry → 반투명 구름 텍스처 PlaneGeometry 빌보드. Gemini 생성 or 프로시저럴 | Low |

### 비기능 요구사항
| ID | 요구사항 |
|----|----------|
| NFR-01 | 텍스처 해상도: 블록=32x32, 이펙트 스프라이트=32x32, 몬스터 CanvasTexture=16x16 |
| NFR-02 | 성능: 새 텍스처 추가로 draw call 증가 ≤ 3, 텍스처 메모리 총 합 ≤ 2MB |
| NFR-03 | 로딩: 모든 텍스처 NearestFilter + no mipmaps (픽셀아트 일관성) |
| NFR-04 | 60fps 유지: 적 50마리 + 파티클 + 새 텍스처 적용 시에도 프레임 드롭 없음 |
| NFR-05 | 이펙트 PNG는 RGBA 투명 배경 필수. Gemini 생성 후 rembg 후처리 파이프라인 적용 |
| NFR-06 | Fallback: Gemini API 키 미설정 시에도 CanvasTexture 프로시저럴 접근으로 최소 기능 보장 |

## 3. 기술 방향

### 텍스처 생성 파이프라인
```
[블록/이펙트 텍스처]
  Gemini API (gemini-3.1-flash-image-preview)
    → "32x32 pixel art, minecraft style, [block_name]" 프롬프트
    → base64 디코딩 → PNG 저장
    → 이펙트의 경우: rembg i input.png output.png (배경 제거)
    → /textures/blocks/ 또는 /textures/arena/fx/ 에 배치

[몬스터/아이템 텍스처]
  프로시저럴 CanvasTexture (agent-textures.ts 패턴)
    → createCanvas(16, 16) → px()/fillRect() 픽셀 드로잉
    → toCanvasTexture() → NearestFilter + SRGBColorSpace
    → 런타임 생성, 캐싱

[Fallback — API 키 없을 때]
  모든 텍스처를 프로시저럴 CanvasTexture로 생성
    → 블록: 노이즈+그라디언트로 돌/흙/풀 질감 시뮬레이션
    → 이펙트: 원형 그라디언트 + AdditiveBlending
```

### 이펙트 배경 제거 파이프라인
```
Step 1: Gemini에 "on solid black background" 프롬프트로 생성
Step 2: rembg i input.png output.png  (AI 기반 배경 제거)
Step 3: 검증 — 파일 크기 > 500bytes && alpha 채널 존재 확인
Step 4: /textures/arena/fx/ 에 배치
```

### 코드 적용 방식
- **블록 텍스처**: 기존 loadBlockTexture() 그대로 사용, 파일만 교체/추가
- **몬스터 텍스처**: 새 `mob-textures.ts` 파일 생성 → EnemyRenderer에서 import → material.map 설정
- **이펙트 텍스처**: DeathParticles의 PointsMaterial.map에 spark 텍스처 적용, SwingArc에 별도 Sprite 오버레이
- **아이템 텍스처**: 새 `item-textures.ts` 파일 생성 → PickupRenderer에서 material.map 설정
- **잔디 변형**: MCNoise에서 x,z 좌표 기반 해시로 변형 인덱스 결정 → MCVoxelTerrain에서 변형별 InstancedMesh 추가

## 4. 아키텍처 개요

```
텍스처 에셋 구조:
  /textures/blocks/          ← ★ 기존 16종 + 신규 변형 ~10종 (Gemini 생성)
  /textures/arena/
    ├── fx/                  ← ★ 이펙트 스프라이트 8종 (Gemini + rembg)
    ├── items/               ← (프로시저럴이므로 비어도 OK)
    ├── mobs/                ← (프로시저럴이므로 비어도 OK)
    └── miniboss/            ← (프로시저럴이므로 비어도 OK)

코드 구조:
  lib/3d/mob-textures.ts     ← ★ 신규: 몬스터 CanvasTexture 생성기
  lib/3d/item-textures.ts    ← ★ 신규: 아이템 CanvasTexture 생성기
  lib/3d/effect-textures.ts  ← ★ 신규: 이펙트 텍스처 로더 + fallback
  lib/3d/mc-noise.ts         ← ★ 수정: 바이옴별 나무/풀 변형
  lib/3d/mc-types.ts         ← ★ 수정: birch/spruce BlockType 추가

  components/game/matrix/3d/
    MCVoxelTerrain.tsx        ← ★ 수정: 잔디 변형 + 나무 종류 + 꽃/풀 장식
    EnemyRenderer.tsx         ← ★ 수정: material.map 추가
    PickupRenderer.tsx        ← ★ 수정: material.map 추가
    DeathParticles.tsx        ← ★ 수정: PointsMaterial.map 추가
    SwingArc.tsx              ← ★ 수정: 슬래시 텍스처 오버레이
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Gemini API 키 미설정 | 높음 | Phase 1에서 키 설정 확인. 미설정 시 CanvasTexture 프로시저럴 fallback 사용 |
| Gemini 생성 텍스처 품질 불일치 | 중간 | "minecraft pixel art 32x32" 일관된 프롬프트 + 기존 텍스처를 스타일 레퍼런스로 제공 |
| rembg 배경 제거 품질 | 중간 | 검은 배경 프롬프트 → rembg → 결과 검증. 실패 시 CanvasTexture fallback |
| 텍스처 메모리 증가 | 낮음 | 32x32 PNG = 약 4KB. 30종 추가해도 ~120KB. CanvasTexture는 런타임이라 번들에 미포함 |
| 몬스터 텍스처 + color 블렌딩 | 중간 | MeshStandardMaterial.map * color 자연 블렌딩. 흰색 베이스 텍스처 + 컬러 오버라이드 |
| draw call 증가 (잔디 변형 등) | 중간 | 변형 3종 = InstancedMesh 3개 추가. MAX_INSTANCES 적절 분배로 총 블록 수 유지 |

## 구현 로드맵
<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: Gemini 환경 설정 + 블록 텍스처 생성
| Task | 설명 |
|------|------|
| GEMINI_API_KEY 환경 설정 | .env.local에 키 설정, da:asset 파이프라인 테스트 |
| 블록 텍스처 재생성 (9종) | Gemini로 32x32 블록 텍스처 생성: grass_top, grass_side, dirt, stone, sand, coal_ore, bedrock, cobblestone, gravel. "pixel art, minecraft style, seamless tileable" 프롬프트 |
| 잔디 변형 텍스처 (3종) | grass_top_dark, grass_top_dry, grass_top_lush. 기존 grass_top 레퍼런스로 색조 변형 |
| 돌/흙 변형 텍스처 (4종) | stone_mossy, stone_cracked, dirt_mossy, dirt_path |
| MCVoxelTerrain 변형 적용 | 잔디 변형 3종 InstancedMesh 추가. MCNoise x,z 해시로 변형 인덱스 결정 |

- **design**: N
- **verify**: 1) 새 텍스처 파일 존재 확인 (32x32, >500bytes) 2) 잔디 블록에 변형 3종 랜덤 표시 3) 기존 블록 텍스처 정상 렌더링 4) tsc --noEmit 0 errors

### Phase 2: 이펙트 스프라이트 생성 + 적용
| Task | 설명 |
|------|------|
| 이펙트 스프라이트 생성 (8종) | Gemini로 생성 → rembg 배경 제거 → /textures/arena/fx/ 저장. spark, flame, smoke, dust, slash_trail, bullet_trail, hit_flash, xp_glow |
| effect-textures.ts 신규 | 이펙트 텍스처 로더 + 캐싱. Gemini 실패 시 CanvasTexture 프로시저럴 fallback (원형 그라디언트) |
| DeathParticles 텍스처 적용 | PointsMaterial.map에 spark.png 적용. sizeAttenuation + AdditiveBlending 유지 |
| SwingArc 텍스처 오버레이 | 슬래시 궤적에 slash_trail 텍스처 Sprite 추가 (기존 RingGeometry 위에 오버레이) |

- **design**: N
- **verify**: 1) /textures/arena/fx/ 에 8종 PNG 존재 2) 이펙트 PNG가 투명 배경 (alpha 채널 확인) 3) 파티클에 텍스처 스프라이트 렌더링 4) 60fps 유지

### Phase 3: 몬스터 프로시저럴 텍스처
| Task | 설명 |
|------|------|
| mob-textures.ts 신규 | 12종 몬스터 템플릿별 CanvasTexture 생성기. 16x16 픽셀아트로 얼굴(눈/입), 몸통(갑옷/패턴), 다리(부츠) 그리기. agent-textures.ts 패턴 재사용 |
| humanoid 텍스처 (3종) | small=고블린 얼굴, medium=전사 갑옷, large=거인 문신 |
| 특수 템플릿 텍스처 (5종) | flying=날개 무늬, crawler=벌레 눈, sphere=에너지 소용돌이, turret=기계 패널, quadruped=짐승 모피 |
| boss 텍스처 (3종) | boss_small=왕관+갑옷, boss_medium=용 비늘, boss_large=마왕 문양. 고유 색상 팔레트 |
| cube 텍스처 (1종) | 기본 큐브 적 — 글리치/디지털 노이즈 패턴 |
| EnemyRenderer 텍스처 연결 | template pool material.map에 mob-textures 적용. 기존 per-instance color 시스템은 map과 자연 블렌딩 (흰색 베이스 텍스처 * instance color) |

- **design**: N
- **verify**: 1) 12종 몬스터 템플릿에 텍스처 매핑 확인 2) 기존 색상 시스템과 블렌딩 정상 3) LOD LOW는 텍스처 생략 (성능) 4) 60fps 유지

### Phase 4: 아이템 텍스처 + 식물 다양화
| Task | 설명 |
|------|------|
| item-textures.ts 신규 | 5종 아이템 CanvasTexture: chicken(뼈+고기), chest(나무결+자물쇠), bomb(도화선+금속), magnet(빨강/파랑), xp_orb(방사형 글로우) |
| PickupRenderer 텍스처 적용 | 각 타입별 material.map 설정. 기존 emissive 색상과 공존 |
| 나무 종류 추가 | birch_log/leaves, spruce_log/leaves 텍스처 (Gemini 생성). mc-types.ts에 BlockType.birch_tree/birch_leaf/spruce_tree/spruce_leaf 추가 |
| MCNoise 바이옴별 나무 분기 | FOREST=oak(60%)+birch(40%), PLAINS=birch(70%)+oak(30%). 좌표 해시 기반 결정적 선택 |
| MCVoxelTerrain 나무 렌더링 | birch/spruce용 InstancedMesh + 텍스처 추가 (4개 InstancedMesh 추가) |
| 바닥 장식 오브젝트 | flower_red, flower_yellow, tall_grass, mushroom_red — PlaneGeometry 빌보드 스프라이트. 전투 구역 밖 랜덤 배치. MCNoise 기반 분포 |

- **design**: N
- **verify**: 1) 아이템에 텍스처 매핑 확인 2) 자작나무/가문비나무 렌더링 3) 바이옴별 나무 종류 차이 확인 4) 꽃/풀 장식 표시 5) 60fps 유지

### Phase 5: 구름 개선 + E2E 검증
| Task | 설명 |
|------|------|
| 구름 텍스처 개선 | BoxGeometry → PlaneGeometry 빌보드. 반투명 구름 텍스처 (Gemini 생성 or CanvasTexture 프로시저럴 그라디언트) |
| TypeScript strict 검증 | tsc --noEmit 0 errors |
| 전체 시각 품질 검증 | 브라우저에서 모든 텍스처 렌더링 확인 |
| 성능 프로파일링 | 적 50마리 + 파티클 + 새 텍스처 60fps 확인 |
| draw call 검증 | 새 InstancedMesh 추가로 인한 draw call 증가 ≤ 10 |

- **design**: N
- **verify**: TypeScript 0 errors, 전체 텍스처 렌더링 정상, 60fps 유지, draw call 합리적 범위
