# Roadmap: V38 — Canvas 2D → Three.js 3D Voxel 변환

> da:work roadmap 모드 자동 파싱 호환. 각 Step은 `### SNN: [이름]` 형식.
> **연구 보고서**: `docs/designs/v38-3d-conversion-research.md`
> **기획서**: `docs/designs/v38-3d-voxel-plan.md`

---

## Phase 0 — Foundation (R3F 환경 + 게임 루프 추출)

### S01: R3F 패키지 설치 + Canvas 마운트
- **file**: apps/web/package.json, apps/web/components/game/matrix/MatrixScene.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §5.1
- **blocked_by**: none
- **do**:
  1. `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `three` 설치
  2. 기본 `MatrixScene.tsx` 스캐폴딩 (R3F `<Canvas>` + 빈 scene)
  3. MatrixApp에서 MatrixScene import 경로 준비 (아직 미사용, 2D 유지)
- **verify**: `npm run build` 성공, three.js import 정상

### S02: useGameLoop 훅 추출
- **file**: apps/web/lib/matrix/hooks/useGameLoop.ts
- **ref**: docs/designs/v38-3d-conversion-research.md §6.1
- **blocked_by**: S01
- **do**:
  1. MatrixCanvas의 `update()` 함수 (line 1760-2916) 를 독립 훅으로 추출
  2. 의존하는 모든 refs, callbacks를 파라미터로 전달
  3. 기존 MatrixCanvas에서 추출된 훅을 import하여 동작 확인 (리그레션 0)
- **verify**: 기존 2D 게임이 useGameLoop 훅 사용 후 동일하게 동작

### S03: MatrixScene R3F 컴포넌트
- **file**: apps/web/components/game/matrix/MatrixScene.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.1
- **blocked_by**: S01
- **do**:
  1. MatrixCanvasProps 인터페이스 재사용
  2. R3F `<Canvas>` 래퍼 + useGameRefs() + useGameLoop() 통합
  3. Web Worker 타이머 연결 (기존 패턴 유지)
  4. 빈 scene 렌더링 (배경색만)
- **verify**: MatrixScene 마운트, useGameLoop 실행, 콘솔 에러 없음

### S04: GameCamera 컴포넌트
- **file**: apps/web/components/game/matrix/3d/GameCamera.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.2
- **blocked_by**: S03
- **do**:
  1. OrthographicCamera 생성 (isometric 45° 각도)
  2. LERP 기반 player follow (playerRef.current.x, y → camera x, z)
  3. Dynamic zoom (0.6-1.1, LERP factor 0.008)
  4. Screen shake (camera position random offset + decay)
- **verify**: 카메라가 (0,0) 기준 isometric 뷰, zoom 동작, shake 테스트

### S05: 기본 조명 세팅
- **file**: apps/web/components/game/matrix/3d/GameLighting.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §3.2.A
- **blocked_by**: S03
- **do**:
  1. AmbientLight intensity=0.4 (base visibility)
  2. DirectionalLight intensity=1.0 (main sun, 45° angle, shadow)
  3. DirectionalLight intensity=0.5 (fill, 반대 방향)
  4. Shadow map 2048x2048, PCFSoftShadowMap
- **verify**: 3D 오브젝트에 그림자 캐스팅 확인

### S06: Foundation 통합 테스트
- **file**: apps/web/components/game/matrix/MatrixScene.tsx
- **ref**: —
- **blocked_by**: S02, S04, S05
- **do**:
  1. MatrixScene에 테스트용 BoxGeometry 배치 (플레이어 위치)
  2. useGameLoop 실행 → 플레이어 이동 → 카메라 추적 확인
  3. MatrixApp에서 3D 모드 토글 (임시 flag)
  4. 기존 2D 모드와 3D 모드 전환 확인
- **verify**: 3D 씬에서 큐브가 플레이어 위치를 따르며 이동, 카메라 추적 정상

## Phase 1 — Terrain (Voxel 지형)

### S07: Ground Plane Chunked Mesh
- **file**: apps/web/components/game/matrix/3d/VoxelTerrain.tsx, apps/web/lib/matrix/rendering3d/terrain.ts
- **ref**: docs/designs/v38-3d-conversion-research.md §6.7
- **blocked_by**: S06
- **do**:
  1. 200×200 unit chunk 시스템 (카메라 주변 visible chunks만 렌더)
  2. PlaneGeometry per chunk + biome color vertex colors
  3. Chunk 생성/파괴 로직 (플레이어 이동에 따라)
- **verify**: 무한 지형 스크롤, chunk 생성/파괴, 메모리 누수 없음

### S08: Biome Texture Atlas
- **file**: apps/web/lib/matrix/rendering3d/terrain.ts, public/assets/3d/biome-atlas.png
- **ref**: docs/designs/v38-3d-conversion-research.md §6.7
- **blocked_by**: S07
- **do**:
  1. 7 biome 타일 텍스처 → 단일 atlas 이미지
  2. UV 매핑으로 chunk 내 타일별 biome 적용
  3. Merged Geometry로 chunk 내 타일 통합 (1 draw call per chunk)
- **verify**: biome 변화 시각적 확인, atlas 텍스처 로딩 정상

### S09: Simplex Noise Biome 통합
- **file**: apps/web/lib/matrix/rendering3d/terrain.ts
- **ref**: apps/web/lib/matrix/map/noise.ts (기존 재사용)
- **blocked_by**: S07
- **do**:
  1. 기존 `noise.ts` import, chunk 좌표 → biome type 결정
  2. Biome transition (인접 biome 블렌딩)
  3. 기존 `biomes.ts` 데이터 재사용
- **verify**: simplex noise 기반 biome 분포, 기존 2D와 동일한 패턴

### S10: Terrain Object .glb Templates
- **file**: public/assets/3d/terrain/*.glb
- **ref**: docs/designs/v38-3d-conversion-research.md §6.7
- **blocked_by**: S07
- **do**:
  1. 7 terrain type × 3-5 variations = 25-35개 voxel prop 제작 (MagicaVoxel→.obj→Blender→.glb)
  2. classroom: desk, locker, chalkboard / cafeteria: table, chair 등
  3. Asset registry JSON 생성 (terrain type → .glb path 매핑)
- **verify**: 모든 .glb 파일 로드 성공, 파일 크기 < 50KB each

### S11: Terrain Object Instancing
- **file**: apps/web/components/game/matrix/3d/TerrainObjects.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.7
- **blocked_by**: S10
- **do**:
  1. 기존 hash-based placement 패턴 재사용 (terrain objects.ts)
  2. 같은 타입 prop → InstancedMesh (1 draw call per type)
  3. Frustum culling + distance culling (>1500px 숨김)
- **verify**: 지형 위 prop 배치 정상, instancing 확인 (draw calls < 10 for terrain)

### S11b: Pickup 3D Rendering
- **file**: apps/web/components/game/matrix/3d/PickupRenderer.tsx
- **ref**: apps/web/lib/matrix/systems/pickup.ts, apps/web/lib/matrix/rendering/pickups/
- **blocked_by**: S11
- **do**:
  1. XP orb: glowing SphereGeometry (InstancedMesh, capacity: 200)
  2. Item drops: small voxel cube + floating animation (y-axis sine wave) + color glow
  3. Gem/chest: larger cube with emissive + particle trail
  4. Vacuum effect: lerp toward player + scale-down on collect
  5. LOD: 거리 >1200px 시 point sprite로 대체
- **verify**: XP orb 수집 동작, item drop 표시, vacuum 이펙트, 200 pickup 시 FPS 영향 < 5%

### S12: Terrain 성능 벤치마크
- **file**: —
- **ref**: docs/designs/v38-3d-conversion-research.md §7.1
- **blocked_by**: S11
- **do**:
  1. 2000×2000 월드, 100+ terrain prop 배치
  2. `renderer.info.render.calls` 측정 → < 15 목표
  3. FPS 측정 (mid-tier 기기) → ≥ 60fps
  4. 메모리 사용량 측정
- **verify**: draw calls < 15, FPS ≥ 60, 메모리 정상

## Phase 2 — Characters (Voxel 플레이어)

### S13: Base Voxel Character Model
- **file**: public/assets/3d/characters/base-character.glb
- **ref**: docs/designs/v38-3d-conversion-research.md §6.3
- **blocked_by**: S06
- **do**:
  1. MagicaVoxel로 3-head chibi 기본 캐릭터 제작 (높이 ~16 voxels)
  2. .obj export → Blender glTF export → .glb (gltfpack 압축)
  3. useGLTF()로 로드 테스트
- **verify**: 모델 로드 성공, 3D 씬에 표시, 비율 적절

### S14: 9 Class Variations
- **file**: public/assets/3d/characters/{class}.glb, apps/web/lib/matrix/rendering3d/character-config.ts
- **ref**: apps/web/lib/matrix/config/classes.config.ts
- **blocked_by**: S13
- **do**:
  1. 9 클래스별 색상/장비 변형 (neo, tank, cypher, morpheus, niobe, oracle, trinity, mouse, dozer)
  2. 기존 CHARACTER_COLORS 데이터 → material color 매핑
  3. 클래스 선택 시 모델 교체 로직
- **verify**: 9 클래스 모두 고유 외형, 색상 차이 명확

### S15: Frame Swap Animation
- **file**: public/assets/3d/characters/anims/{action}-{frame}.glb
- **ref**: docs/designs/v38-3d-conversion-research.md §5.3
- **blocked_by**: S13
- **do**:
  1. 4 액션 × N 프레임: idle(2f), walk(4f), hit(2f), death(3f)
  2. 프레임당 별도 .glb (총 11 프레임)
  3. AnimationController: 프레임 타이밍에 맞춰 geometry swap
- **verify**: walk 주기 ~600ms, idle 부드러운 전환, hit 반응

### S16: VoxelCharacterRenderer
- **file**: apps/web/components/game/matrix/3d/VoxelCharacter.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.3
- **blocked_by**: S14, S15
- **do**:
  1. R3F 컴포넌트: position 동기화 (gameRefs.player → mesh.position)
  2. Frame swap animation controller (useFrame에서 프레임 전환)
  3. 8방향 facing: velocity 기반 model.rotation.y 계산
  4. Hit flash effect (material emissive 변경)
- **verify**: 캐릭터 이동 시 walk 애니메이션, 정지 시 idle, 피격 시 hit flash

### S17: Skin Color System
- **file**: apps/web/lib/matrix/rendering3d/skin-system.ts
- **ref**: apps/web/lib/matrix/config/skins.config.ts
- **blocked_by**: S16
- **do**:
  1. 24종 skin palette → material color override
  2. Pattern skins (stripes, dots, stars 등) → vertex color 또는 texture swap
  3. Runtime skin 변경 API
- **verify**: 24 skin 적용 확인, pattern 시각적 구분

### S18: Player Split Rendering
- **file**: apps/web/components/game/matrix/3d/VoxelCharacter.tsx
- **ref**: MatrixCanvas.tsx line 3937-4088
- **blocked_by**: S16
- **do**:
  1. Upper/Lower body 분리 렌더링
  2. 플레이어 중심 스킬(garlic, pool, beam 등) → lower와 upper 사이에 3D 이펙트 배치
  3. 렌더 순서: lower body → skill effects → upper body
- **verify**: garlic AOE가 캐릭터 발 아래 표시, upper body가 이펙트 위에 렌더

### S19: Character 통합 테스트
- **file**: —
- **ref**: —
- **blocked_by**: S17, S18, S12
- **do**:
  1. 지형 위 플레이어 이동 (WASD + 조이스틱)
  2. 8방향 facing 전환 확인
  3. Walk/idle/hit 애니메이션 전환
  4. 9 클래스 × 24 skin 조합 테스트
  5. 스킬 이펙트와 캐릭터 depth 관계 확인
- **verify**: 모든 기능 정상 동작, 시각적 깨짐 없음

## Phase 3 — Enemies (Voxel 적 시스템)

### S20: Enemy Base Templates
- **file**: public/assets/3d/enemies/*.glb, apps/web/lib/matrix/rendering3d/enemy-templates.ts
- **ref**: docs/designs/v38-3d-conversion-research.md §6.4
- **blocked_by**: S13
- **do**:
  1. 10-15 base body templates: humanoid_small, humanoid_medium, humanoid_large, flying, crawler, sphere, quadruped, boss_small, boss_medium, boss_large
  2. 각 template .glb 제작 (MagicaVoxel→.obj→Blender→.glb)
  3. Template registry: enemyType → templateId 매핑 (173 타입)
- **verify**: 모든 template 로드 성공, 크기/비율 적절

### S21: Color Mapping System
- **file**: apps/web/lib/matrix/rendering3d/enemy-colors.ts
- **ref**: apps/web/lib/matrix/rendering/enemies/pixelMonster.ts (CYBER_PALETTE)
- **blocked_by**: S20
- **do**:
  1. CYBER_PALETTE 30색 → Three.js Color 매핑
  2. 166 적 타입별 primary/secondary color 정의
  3. per-instance color 적용 (InstancedMesh.setColorAt)
- **verify**: 적 타입별 고유 색상 차이 확인

### S22: InstancedMesh Enemy Renderer
- **file**: apps/web/components/game/matrix/3d/EnemyRenderer.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.4
- **blocked_by**: S21
- **do**:
  1. Template별 InstancedMesh 생성 (같은 base body → 1 draw call)
  2. useFrame에서 enemiesRef → InstancedMesh matrix 업데이트
  3. setMatrixAt(index, matrix) + setColorAt(index, color)
  4. Visible count 관리 (count = active enemies of this template)
- **verify**: 50+ 적 렌더링, draw calls < 15

### S23: BatchedMesh Integration
- **file**: apps/web/components/game/matrix/3d/EnemyRenderer.tsx
- **ref**: Three.js BatchedMesh docs
- **blocked_by**: S22
- **do**:
  1. 서로 다른 template의 적을 BatchedMesh로 통합 (선택적)
  2. addGeometry/addInstance API 활용
  3. A/B 벤치마크: InstancedMesh(per-template) vs BatchedMesh(unified)
  4. ⚠️ BatchedMesh는 Three.js r163+ 실험적 API — per-instance color 지원 제한. InstancedMesh fallback 반드시 유지
- **verify**: 성능 비교, 더 나은 방식 선택. BatchedMesh 불안정 시 InstancedMesh 유지

### S24: LOD 3-Tier System
- **file**: apps/web/components/game/matrix/3d/EnemyRenderer.tsx
- **ref**: apps/web/lib/matrix/rendering/enemies/renderContext.ts (기존 LOD 데이터)
- **blocked_by**: S22
- **do**:
  1. HIGH (<800px): Full voxel model + 색상 + animation
  2. MID (800-1400px): Simplified model (절반 복셀) + 색상
  3. LOW (>1400px): 단일 colored cube (1 voxel)
  4. 거리 기반 LOD 전환 (카메라 거리 계산)
  5. 적응형: 총 엔티티 수 > 150이면 MID 거리 축소
- **verify**: LOD 전환 시각적 확인, 200적에서 draw calls < 30

### S25: Elite Effects
- **file**: apps/web/components/game/matrix/3d/EliteEffects.tsx
- **ref**: apps/web/lib/matrix/rendering/enemies/eliteEffects.ts
- **blocked_by**: S22
- **do**:
  1. Silver: subtle emissive glow (material.emissive)
  2. Gold: bright glow + orbiting particle (3-4개)
  3. Diamond: intense bloom + trail + 6 orbiting particles
  4. LOD 연동: MID에서 glow만, LOW에서 none
- **verify**: 3 tier elite 시각적 구분, bloom 정상

### S26: Enemy 성능 벤치마크
- **file**: —
- **ref**: docs/designs/v38-3d-conversion-research.md §7.1
- **blocked_by**: S24
- **do**:
  1. 200 적 (173 타입 혼합) + 지형 + 플레이어
  2. renderer.info 측정: draw calls, triangles, textures
  3. FPS 측정 (desktop ≥ 60, mobile ≥ 30)
  4. 메모리 사용량, GC 빈도 측정
- **verify**: Arena 시나리오 60fps, draw calls < 40

## Phase 4 — Projectiles (투사체 3D)

### S27: Projectile Object Pool
- **file**: apps/web/lib/matrix/rendering3d/projectile-pool.ts
- **ref**: docs/designs/v38-3d-conversion-research.md §6.5
- **blocked_by**: S06
- **do**:
  1. InstancedMesh 기반 ObjectPool 클래스 (spawn/despawn)
  2. 무기 카테고리별 pool: melee(1), ranged(1), magic(1), special(1), skills(6) = 10 pools
  3. 각 pool 최대 capacity: 200 instances
  4. 비활성 인스턴스는 scale(0,0,0)으로 숨김
- **verify**: spawn/despawn 정상, 메모리 누수 없음, draw calls = pool 수

### S28: Melee Weapons 3D (4)
- **file**: apps/web/components/game/matrix/3d/weapons/MeleeWeapons.tsx
- **ref**: apps/web/lib/matrix/rendering/projectiles/weapons/melee.ts
- **blocked_by**: S27
- **do**:
  1. whip: Trail mesh (TubeGeometry 기반 chain path)
  2. punch: Shockwave ring (RingGeometry expand + fade)
  3. axe: Scatter projectile (instanced small cubes)
  4. sword: Arc slash (custom arc geometry + bloom)
- **verify**: 4 근접 무기 시각적 확인, 위치/각도 정확

### S29: Ranged Weapons 3D (6)
- **file**: apps/web/components/game/matrix/3d/weapons/RangedWeapons.tsx
- **ref**: apps/web/lib/matrix/rendering/projectiles/weapons/ranged.ts
- **blocked_by**: S27
- **do**:
  1. knife: Small cube projectile + trail
  2. bow: Arrow mesh (elongated cone)
  3. ping: Concentric wave rings (expanding torus)
  4. shard: Large shell + impact explosion
  5. airdrop: Drop marker + shockwave (uses existing Z-axis)
  6. fork: Branching energy bolts (line geometry + glow)
- **verify**: 6 원거리 무기 비주얼, 궤적/회전 정상

### S30: Magic Weapons 3D (4)
- **file**: apps/web/components/game/matrix/3d/weapons/MagicWeapons.tsx
- **ref**: apps/web/lib/matrix/rendering/projectiles/weapons/magic.ts
- **blocked_by**: S27
- **do**:
  1. wand: Glowing orb projectile (SphereGeometry + emissive)
  2. bible: Orbiting pages (instanced planes rotating around player)
  3. garlic: AOE ground decal (CircleGeometry + semi-transparent)
  4. pool: Damage zone ground decal (CircleGeometry + animated shader)
- **verify**: 4 마법 무기 비주얼, orbit 동작, AOE 크기 정확

### S31: Special Weapons 3D (3)
- **file**: apps/web/components/game/matrix/3d/weapons/SpecialWeapons.tsx
- **ref**: apps/web/lib/matrix/rendering/projectiles/weapons/special.ts
- **blocked_by**: S27
- **do**:
  1. bridge: Barrier/freeze mesh (BoxGeometry wall)
  2. beam: Continuous beam (CylinderGeometry + bloom + stretch)
  3. laser: Recursive loop beam (CylinderGeometry + intense bloom)
- **verify**: 3 특수 무기 비주얼, beam 방향/길이 정확

### S32: Skill Weapons 3D (30+)
- **file**: apps/web/components/game/matrix/3d/weapons/SkillWeapons.tsx
- **ref**: apps/web/lib/matrix/rendering/projectiles/weapons/skills.ts
- **blocked_by**: S27
- **do**:
  1. 6 카테고리별 통합 렌더러: CODE(green), DATA(cyan), NETWORK(purple), SECURITY(red), AI(amber), SYSTEM(pink)
  2. 카테고리별 base projectile shape + color 변형으로 30+ 스킬 커버
  3. 개별 스킬의 특수 비주얼은 Phase별로 점진 추가 (v39+)
- **verify**: 6 카테고리 색상 구분, 기본 projectile 동작

### S32b: Turret 3D Rendering
- **file**: apps/web/components/game/matrix/3d/weapons/TurretWeapon.tsx
- **ref**: apps/web/lib/matrix/systems/turret.ts, apps/web/lib/matrix/rendering/projectiles/weapons/turret.ts
- **blocked_by**: S27
- **do**:
  1. Turret base model (.glb): 설치형 포탑 복셀 모델 (base + barrel)
  2. 배치 indicator: ground placement ring (CircleGeometry + semi-transparent)
  3. 회전 애니메이션: barrel이 가장 가까운 적 방향으로 Y-axis rotation
  4. 발사 이펙트: muzzle flash (point light + particle) + projectile spawn
  5. 파괴 이펙트: shatter burst (instanced particles)
- **verify**: turret 배치, 자동 회전, 발사 비주얼, 파괴 이펙트

## Phase 5 — Effects (이펙트 + 후처리)

### S33: Post-Processing Pipeline
- **file**: apps/web/components/game/matrix/3d/PostProcessing.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.6
- **blocked_by**: S06
- **do**:
  1. EffectComposer + RenderPass 기본 세팅
  2. UnrealBloomPass: strength=0.5, radius=0.4, threshold=0.85 (selective bloom)
  3. Vignette: 기존 radial gradient 대체
  4. Screen Flash: custom pass (white overlay + opacity decay)
  5. Canvas 2D effect 매핑: canvasEffects.ts screen flash → ShaderPass, color invert → custom pass, slow-mo → global time scale
  6. Warning indicators: screen-edge red glow (기존 radial gradient → post-processing vignette color)
- **verify**: bloom이 emissive 오브젝트에만 적용, vignette 시각적 확인, screen flash 동작

### S34: Particle System
- **file**: apps/web/components/game/matrix/3d/ParticleSystem.tsx
- **ref**: apps/web/lib/matrix/rendering/effects/ (easing, glow presets)
- **blocked_by**: S27
- **do**:
  1. InstancedMesh 기반 particle system (capacity: 500)
  2. 기존 ExtendedParticle 속성 매핑: easing, trail, fade, glow, drag, bounce
  3. Burst styles: data, pixel, slime, spark, smoke, shatter, electric, gold
  4. 기존 EASING 함수 + PULSE_PATTERNS 재사용 (순수 수학)
  5. LOD 연동: LOW에서 파티클 수 50% 감소
- **verify**: 8 burst style 시각적 확인, 500 파티클 60fps

## Phase 6 — UI & HUD (인터페이스)

### S35: drei Html World UI 통합
- **file**: apps/web/components/game/matrix/3d/WorldUI.tsx
- **ref**: docs/designs/v38-3d-conversion-research.md §6.6
- **blocked_by**: S06
- **do**:
  1. drei `<Html>` 컴포넌트 기반 world-to-screen 앵커링 시스템
  2. 엔티티 머리 위 고정점 계산 (position.y + height offset)
  3. 가시 범위 외 자동 숨김 (occlude prop)
  4. Z-index 관리 (HUD overlay 위에 표시 방지)
- **verify**: 3D 오브젝트에 HTML 요소 앵커링, 카메라 회전 시 따라감

### S36: Damage Numbers
- **file**: apps/web/components/game/matrix/3d/DamageNumbers.tsx
- **ref**: MatrixCanvas.tsx draw() damage numbers section
- **blocked_by**: S35
- **do**:
  1. Object pool 기반 DOM 요소 재사용
  2. CSS animation: float-up + fade-out + scale
  3. 색상: white(일반), red(적 공격), green(힐), gold(크리티컬)
  4. 최대 40개 동시 표시 (기존 MAX_DAMAGE_NUMBERS)
- **verify**: 데미지 표시 정상, 크리티컬 확대 효과, 성능 영향 최소

### S37: Health Bars & Nametags
- **file**: apps/web/components/game/matrix/3d/EntityUI.tsx
- **ref**: apps/web/lib/matrix/rendering/multiplayer/nametag.ts
- **blocked_by**: S35
- **do**:
  1. HP바: 적/에이전트 머리 위 (green→yellow→red)
  2. Nametag: 이름 + 레벨 배지
  3. LOD 연동: HIGH=full, MID=bar only, LOW=dot
  4. Nation color stripe (12개국 색상)
- **verify**: HP 변동 시 바 업데이트, LOD 전환, nation color

### S38: Safe Zone 3D
- **file**: apps/web/components/game/matrix/3d/SafeZone3D.tsx
- **ref**: apps/web/lib/matrix/rendering/arena/safeZone.ts
- **blocked_by**: S33, S07
- **do**:
  1. 반투명 실린더 mesh (안전지대 경계)
  2. 바깥 영역: red fog/shader effect (stencil or custom shader)
  3. Shrink animation: radius 감소 + target radius 표시
  4. Warning vignette: post-processing pass (플레이어 outside 시)
  5. Direction arrow: billboard sprite pointing to safe center
- **verify**: 4 phase shrink 동작, warning vignette, 방향 화살표

### S39: HUD Overlay 통합
- **file**: apps/web/components/game/matrix/MatrixScene.tsx
- **ref**: —
- **blocked_by**: S35
- **do**:
  1. 기존 React HUD 컴포넌트 그대로 overlay (MatrixHUD, ArenaHUD, KillFeed 등)
  2. R3F Canvas 위에 absolute positioning
  3. 조이스틱 overlay (모바일)
  4. 일시정지/레벨업/결과 화면 overlay
- **verify**: 모든 HUD 요소 정상 표시, 3D 씬과 겹침 없음

## Phase 7 — Multiplayer (멀티플레이어)

### S40: Remote Player 3D Rendering
- **file**: apps/web/components/game/matrix/3d/RemotePlayer3D.tsx
- **ref**: apps/web/lib/matrix/rendering/multiplayer/remote-player.ts
- **blocked_by**: S16, S24
- **do**:
  1. Voxel character (S16 재사용) + nation color
  2. LOD 3단계: HIGH(full model), MID(simplified), LOW(colored cube)
  3. 적응형 LOD threshold (31+ 플레이어 시 20-35% 축소)
  4. 최대 35 remote players 렌더링 (기존 제한 유지)
  5. PvP 모드 시 적/아군 구분 (blue=ally, red=enemy aura)
- **verify**: 멀티플레이어 연결 시 remote player 3D 표시, LOD 전환

### S41: PvP Visual Effects
- **file**: apps/web/components/game/matrix/3d/PvpEffects3D.tsx
- **ref**: apps/web/lib/matrix/rendering/multiplayer/pvp-effects.ts
- **blocked_by**: S34
- **do**:
  1. Hit effect: Expanding ring geometry (TorusGeometry) + bloom
  2. Kill effect: Double ring + radial particle burst (8방향)
  3. Critical effect: ring + particles + slow-mo (기존 timeScale 재사용)
  4. Damage numbers: S36 재사용 (PvP 색상)
  5. 최대 30 hit effects, 40 damage numbers (기존 hard cap)
- **verify**: PvP hit/kill 이펙트 시각적 확인, performance cap 동작

### S42: Agent Chat Bubbles
- **file**: apps/web/components/game/matrix/3d/ChatBubble3D.tsx
- **ref**: apps/web/lib/matrix/systems/agent-chat.ts
- **blocked_by**: S35
- **do**:
  1. CSS2DRenderer 기반 speech bubble (drei Html)
  2. 에이전트 머리 위 앵커링 + offset
  3. Fade-in/out animation (CSS transition)
  4. 최대 3 bubbles 동시 표시
- **verify**: 에이전트 채팅 메시지 표시, fade 정상

### S43: Kill Feed & War Border
- **file**: apps/web/components/game/matrix/3d/ArenaOverlays.tsx
- **ref**: apps/web/lib/matrix/rendering/multiplayer/pvp-effects.ts (kill feed, war border)
- **blocked_by**: S39
- **do**:
  1. Kill feed: 기존 HTML overlay 그대로 (DOM 렌더링)
  2. War border: 4-side gradient border (CSS) + corner marks
  3. War countdown: Vignette + text + siren flash
  4. 기존 PvpEffectsManager 상태 관리 로직 재사용
- **verify**: kill feed 스크롤, war border 펄스, countdown 표시

### S44: Arena 통합 테스트
- **file**: —
- **ref**: —
- **blocked_by**: S40, S41, S42, S43
- **do**:
  1. Arena 모드 full flow: 9 에이전트 + safe zone + PvP
  2. Safe zone 4 phase shrink 확인
  3. 에이전트 AI 전투 + 채팅 + kill feed
  4. 플레이어 PvP kill/death 시나리오
  5. FPS 측정: 9 에이전트 + 200 적 + safe zone ≥ 60fps
- **verify**: Arena 전체 플로우 정상, 60fps 유지

## Phase 8 — Optimization (최적화 + 마무리)

### S45: Quality Ladder
- **file**: apps/web/lib/matrix/rendering3d/quality-ladder.ts
- **ref**: docs/designs/v38-3d-conversion-research.md §7.2.F
- **blocked_by**: S44
- **do**:
  1. 3-tier 품질 시스템: Tier1(Full), Tier2(Reduced), Tier3(Minimal)
  2. Tier1: bloom + shadows + particles + HIGH LOD
  3. Tier2: reduced bloom + no shadows + fewer particles + MID LOD 확장
  4. Tier3: no post-processing + minimal particles + LOW LOD only
  5. drei `<PerformanceMonitor>` 활용: FPS 30 미만 5초 지속 시 자동 tier 하향
  6. 수동 설정 override (Settings UI)
- **verify**: 자동 tier 전환 동작, 각 tier 시각적 차이, FPS 회복

### S46: Mobile Optimization
- **file**: apps/web/components/game/matrix/3d/MobileOptimizer.tsx
- **ref**: —
- **blocked_by**: S45
- **do**:
  1. Touch input 유지 (기존 useInput.ts 재사용)
  2. 모바일 감지 → 자동 Tier2 또는 Tier3
  3. 저해상도 렌더링 (devicePixelRatio cap = 1)
  4. Particle count 50% 감소
  5. Shadow map 해상도 축소 (1024)
- **verify**: iOS Safari + Android Chrome 30fps+, 터치 입력 정상

### S47: 2D/3D Mode Switch
- **file**: apps/web/components/game/matrix/MatrixApp.tsx
- **ref**: —
- **blocked_by**: S45
- **do**:
  1. Settings에서 Classic(Canvas 2D) / Enhanced(Three.js 3D) 선택
  2. localStorage에 preference 저장
  3. MatrixApp에서 renderMode에 따라 MatrixCanvas(2D) 또는 MatrixScene(3D) 렌더
  4. 200ms transition fade between modes
  5. WebGL 미지원 브라우저 자동 2D fallback
- **verify**: 모드 전환 정상, 설정 persist, WebGL 미지원 시 2D fallback

### S48: Final Benchmark & Report
- **file**: docs/designs/v38-benchmark-report.md
- **ref**: —
- **blocked_by**: S47
- **do**:
  1. 4 시나리오 벤치마크: Normal / Arena / Stress / Mobile
  2. 지표: FPS, draw calls, triangles, memory, GC frequency
  3. 2D vs 3D 성능 비교표
  4. 잔여 이슈 목록
  5. v39 추가 개선 계획 (3D 전용 기능: 지형 높이, 환경 파괴 등)
- **verify**: 벤치마크 데이터 수집 완료, 리포트 작성
