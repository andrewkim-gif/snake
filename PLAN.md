# PLAN: V47 — Game Feel 3대축 (Effects + Knockback + Biome Map)

## 1. 개요

### 배경
게임의 시각적 피드백과 맵 다양성을 한 단계 끌어올리는 3대축 업그레이드:
1. **Particle Effects** — Cartoon FX Pack이 Unity 바이너리라 사용 불가, Three.js procedural 파티클로 대체
2. **Enemy Knockback 강화** — 넉백 물리는 이미 존재하지만 시각적으로 미약 → 파라미터 튜닝 + 카메라/히트스톱
3. **KayKit Biome Map** — 3바이옴→6바이옴, KayKit 아틀라스에서 추출한 텍스처로 지역별 일관성 있는 맵

### 핵심 기술 발견
- **KayKit GLTF 모델**: 423~2217 vertices의 디테일 메시 (beveled edge 포함) → BoxGeometry(1,1,1)에 직접 대체 불가
- **KayKit 텍스처 아틀라스**: 1024x1024 PNG, 각 블록 타입이 특정 UV 영역 점유 → 영역별 crop하여 새 PNG 텍스처 생성
- **기존 넉백**: `combat.ts`에서 `force = (knockback * 10) / mass`, `stunTimer = 0.15s`, `friction = 0.90`
- **3D 렌더러**: dying 적은 EnemyRenderer에서 skip됨 (`enemy.state === 'dying' → continue`)
- **카메라 shake**: MCGameCamera에 이미 구현 (`screenShakeTimerRef` + `screenShakeIntensityRef`)
- **Screen flash + slomo**: PostProcessing.tsx에 이미 구현 (elite/boss 처치 시 동작)

## 2. 요구사항

### 기능 요구사항
- [FR-01] Hit spark particles — 적 피격 시 5-8개 밝은 파티클 산란
- [FR-02] Death burst particles — 적 사망 시 15-25개 파티클 폭발
- [FR-03] Slash trail effect — 근접 무기 스윙 아크 트레일
- [FR-05] Knockback force 증폭 — force multiplier 10→18, stun 0.15→0.25s, friction 0.90→0.85
- [FR-06] Camera micro-shake on melee hit — 근접 타격 시 미세 화면 흔들림
- [FR-07] Hit-stop (frame freeze) — 강타 시 30-50ms 시간 스케일 감속
- [FR-08] Enemy tilt on knockback — stun 중 넉백 방향으로 10-15도 기울기
- [FR-09] 6 biome system — PLAINS/FOREST/DESERT/TUNDRA/MOUNTAINS/SWAMP
- [FR-10] KayKit texture integration — 아틀라스 crop → 새 PNG 텍스처
- [FR-11] Biome transition zones — 경계에 전환 블록 (sand_with_grass 등)
- [FR-12] Region consistency — 지역당 하나의 표면 타일 일관성

### 비기능 요구사항
- [NFR-1] 파티클 시스템: InstancedMesh 풀, max 200, zero GC
- [NFR-2] 텍스처: 새 PNG 12장 이내, NearestFilter
- [NFR-3] 바이옴 확장: noise 연산 O(1), 추가 draw call 최소화

## 3. 기술 방향

### Particle System
- **InstancedMesh 기반 파티클 풀** — 단일 `PlaneGeometry` + `AdditiveBlending` material
- CPU-driven (useFrame에서 위치/크기/투명도 업데이트)
- 글로벌 `HitParticleSystem` 컴포넌트로 MatrixScene에 마운트
- 파티클 스폰은 `hitFlashMap` 이벤트와 동기화

### Knockback Enhancement
- **combat.ts 파라미터 튜닝** — force multiplier, stun duration, friction
- **MCGameCamera 확장** — melee hit 시 shake 트리거 (기존 인프라 재사용)
- **GameLogic useFrame** — hit-stop을 `gameSpeed` 임시 감속으로 구현
- **EnemyRenderer** — stun 중 velocity 방향 기반 Z-rotation tilt 추가

### Biome Map
- **build script** — KayKit 아틀라스에서 블록 UV 영역 crop → `/textures/blocks/` PNG 생성
- **mc-noise.ts** — `Biome` enum 확장 + `getBiome()` 2D noise 다중 threshold
- **MCVoxelTerrain.tsx** — 새 블록 타입 + InstancedMesh + material 추가
- **decoration-textures.ts** — 바이옴별 decoration 분기 확장

## 4. 아키텍처 개요

```
┌─────────────────── MatrixScene.tsx ───────────────────┐
│                                                        │
│  MCGameCamera ←──── screenShakeRef (melee hit 확장)    │
│                                                        │
│  MCVoxelTerrain ←── mc-noise (6 biome)                 │
│       ↑              getBiome() 다중 threshold          │
│   new textures       generateChunkBlocks() 확장        │
│   (KayKit crop)      generateDecorations() 확장        │
│                                                        │
│  EnemyRenderer ←── hitFlashMap + velocity tilt          │
│       ↑                                                │
│  HitParticleSystem ←── hitFlashMap (파티클 스폰)       │
│       (NEW)                                            │
│                                                        │
│  GameLogic useFrame ←── hit-stop (gameSpeed 감속)      │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─── combat.ts (game logic) ────┐
│ damageEnemy():                 │
│   force = (kb * 18) / mass    │  ← multiplier 10→18
│   stunTimer = 0.25            │  ← 0.15→0.25
│   friction → 0.85             │  ← 0.90→0.85
│   + melee shake trigger       │  ← NEW
│   + hit-stop trigger          │  ← NEW
└───────────────────────────────┘
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 넉백 증폭이 게임 밸런스 파괴 | 높음 | mass별 cap 적용, 보스/엘리트 별도 배수 |
| 파티클 과다로 FPS 저하 | 중간 | 200 pool cap + Quality Ladder 연동 |
| KayKit 텍스처 crop 품질 | 낮음 | crop 후 수동 검수, 필요시 canvas fallback |
| 6바이옴이 기존 전투존 간섭 | 중간 | flatZone(반경30) 내부는 PLAINS 고정 |
| hit-stop이 UX 불쾌감 유발 | 낮음 | 30-50ms로 최소화, 중무기만 적용 |

## 구현 로드맵

### Phase 1: Enemy Knockback 물리 강화
| Task | 설명 |
|------|------|
| combat.ts 파라미터 튜닝 | force multiplier 10→18, stunTimer 0.15→0.25, min knockback distance |
| game.config.ts STUN_FRICTION 추가 | stun 전용 friction 0.85 (기존 0.90 유지, stunned 시만 0.85) |
| MatrixCanvas.tsx stunned loop 수정 | 새 STUN_FRICTION 적용 |
| combat.ts melee shake trigger | 근접 무기 타격 시 screenShakeTimer/Intensity 설정 |
| combat.ts hit-stop trigger | punch/axe 타격 시 gameSpeed 임시 0.1 (30-50ms) |
| mass 기반 knockback cap | 보스(mass>50): force cap 적용으로 밸런스 보호 |

- **design**: N
- **verify**: 적 피격 시 육안 확인 가능한 밀림, 보스 넉백은 제한적, 카메라 흔들림, 히트스톱 체감

### Phase 2: Hit/Death Particle System
| Task | 설명 |
|------|------|
| HitParticleSystem.tsx 생성 | InstancedMesh 파티클 풀 (PlaneGeometry, AdditiveBlending, max 200) |
| 파티클 스폰 로직 | hitFlashMap 변경 감지 → 적 위치에 5-8개 파티클 분산 |
| Death burst 로직 | dying 상태 진입 감지 → 15-25개 파티클 방사형 버스트 |
| 무기별 파티클 색상 | physical=white-yellow, magic=blue-cyan, poison=green |
| MatrixScene.tsx 통합 | HitParticleSystem을 Scene에 마운트, refs 전달 |

- **design**: N
- **verify**: 적 피격 시 파티클 산란, 사망 시 버스트 확인, FPS 저하 없음 (200 cap)

### Phase 3: Enemy Visual Knockback (3D Renderer)
| Task | 설명 |
|------|------|
| EnemyRenderer tilt 추가 | stun 중 enemy.velocity 방향 기반 Z-rotation 10-15도 |
| Dying enemy 렌더링 | `state === 'dying'` skip 제거 → deathScale로 축소 + 투명도 fade |
| Death slide 시각화 | dying 상태에서 deathVelocity 방향 이동 렌더링 |

- **design**: N
- **verify**: 적 피격 시 기울어짐, 사망 시 밀려나면서 축소, 갑자기 사라지지 않음

### Phase 4: KayKit 텍스처 추출 + Build Script
| Task | 설명 |
|------|------|
| build-kaykit-textures.mjs 생성 | GLTF .bin에서 UV bounds 읽기 → atlas crop → 16x16 PNG 저장 |
| 대상 텍스처 추출 | snow, stone_dark, sand_A, sand_B, lava, water + 전환 블록 6종 |
| /textures/blocks/ 배치 | 추출된 PNG를 기존 텍스처 디렉토리에 추가 |
| 텍스처 품질 검수 | crop 결과를 NearestFilter로 확인, 필요시 canvas fallback |

- **design**: N
- **verify**: 12장 이내 새 PNG 생성, NearestFilter에서 픽셀아트 미학 유지

### Phase 5: 6-Biome System 확장
| Task | 설명 |
|------|------|
| mc-noise.ts Biome enum 확장 | TUNDRA, MOUNTAINS, SWAMP 추가 |
| getBiome() 2D noise 재설계 | 온도(temperature) + 습도(moisture) 2축 noise로 6바이옴 매핑 |
| generateChunkBlocks() 확장 | 바이옴별 surface/subsurface 블록 분기 |
| generateDecorations() 확장 | TUNDRA: snow tree, MOUNTAINS: boulder, SWAMP: dead tree |
| flatZone PLAINS 고정 | 전투 구역 내부는 무조건 PLAINS로 강제 |

- **design**: N
- **verify**: 맵 탐색 시 6종 바이옴 확인, 전투존은 PLAINS, 바이옴 간 자연스러운 전환

### Phase 6: MCVoxelTerrain 신규 블록 통합
| Task | 설명 |
|------|------|
| mc-types.ts BlockType 확장 | snow, stone_dark, lava, water + transition 블록 추가 |
| MCVoxelTerrain 신규 InstancedMesh | 새 블록 타입별 mesh + material 생성 |
| BLOCK_TO_MESH 매핑 확장 | 새 블록 → mesh key 연결 |
| MAX_INSTANCES 조정 | snow:20000, stone_dark:10000, 전환블록:5000 등 |
| Biome transition 렌더링 | 경계 8-12블록에 sand_with_grass/grass_with_snow 자동 배치 |
| Region consistency 보장 | 바이옴 zone 내 단일 surface 타일, decoration으로 시각적 변화 |

- **design**: N
- **verify**: 6바이옴 각각 고유 텍스처 확인, 전환 지대 자연스러움, 지역 내 일관성
