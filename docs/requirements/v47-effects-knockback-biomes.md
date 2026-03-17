# V47 — Effects, Enemy Knockback Enhancement, Biome Map Redesign

## Executive Summary
Three-pillar game feel enhancement: (1) procedural hit/death particle effects replacing unusable Unity assets, (2) amplified enemy knockback visibility for satisfying "손맛", (3) KayKit BlockBits GLTF texture integration with expanded biome system for cohesive map aesthetics.

---

## Asset Analysis

### Cartoon FX Pack PC DEMO — NOT USABLE
- Unity compiled binary (.exe + DLLs), no extractable PNG/sprite/texture assets
- **Decision**: Build procedural Three.js particle effects instead (hit sparks, death bursts, slash trails)
- This is actually superior for performance — no asset loading, infinite variety, zero texture memory

### KayKit BlockBits 1.0 FREE — USABLE
- 40 GLTF block models sharing `block_bits_texture.png` atlas
- Key terrain blocks: dirt, dirt_with_grass, grass, sand_A, sand_B, stone, stone_dark, gravel, snow, lava, water
- Transition blocks: sand_with_grass, gravel_with_grass, dirt_with_snow, grass_with_snow, gravel_with_snow, sand_with_snow
- Nature: tree, tree_with_snow
- Building: bricks_A, bricks_B, wood, metal, glass
- Ore: stone_with_copper, stone_with_gold, stone_with_silver
- **Integration method**: Extract UV-mapped faces from GLTF models → bake into per-face textures for existing InstancedMesh BoxGeometry system (more efficient than loading 40 separate GLTF models)

---

## Pillar 1: Procedural Particle Effects

### FR-01: Hit Spark Particles (High Priority)
- On enemy hit → spawn 5-8 small bright particles at impact point
- Direction: scatter from hit angle (player→enemy vector)
- Color: weapon-type tint (white-yellow for physical, blue for magic, green for poison)
- Lifetime: 0.2-0.4s, size: 0.1-0.3 world units
- Use InstancedMesh particle pool (max 200 particles) for zero GC pressure

### FR-02: Death Burst Particles (High Priority)
- On enemy death → spawn 15-25 particles bursting outward from enemy position
- Color: enemy template tint color
- Mix of fast (outer) + slow (inner) particles
- Lifetime: 0.3-0.6s
- Boss death: 40-60 particles, larger, with slight camera shake

### FR-03: Slash Trail Effect (Medium Priority)
- Melee weapons (punch, axe, whip) show brief arc trail on swing
- Fade from weapon color to transparent over 0.15s
- Use 3-4 point ribbon mesh with alpha decay

### FR-04: XP Orb Collection Sparkle (Low Priority)
- When XP orb is collected → 3-5 tiny sparkle particles fly toward player
- Gold-green color, fast converge toward player position

---

## Pillar 2: Enemy Knockback Enhancement ("손맛")

### Current State Analysis
Knockback physics ALREADY EXISTS in 2D game logic:
- `damageEnemy()` in `combat.ts` applies velocity impulse: `force = (knockback * 10) / enemy.mass`
- Enemy enters `'stunned'` state (0.15s), velocity decays at 0.90 friction/frame
- Death knockback: 3x force multiplier with `deathVelocity`

**Problem**: The knockback IS happening in data, but:
1. Stun duration too short (0.15s = ~9 frames) — movement barely visible
2. Force multiplier too low for heavy enemies (mass dampens it heavily)
3. 3D renderer reads position correctly but visual feedback is too subtle
4. No screen feedback (camera doesn't react to player attacks)

### FR-05: Amplify Knockback Force (High Priority)
- Increase base force multiplier from 10 to 15-18 (in `combat.ts`)
- Increase stun duration from 0.15s to 0.20-0.25s for normal enemies
- Add minimum knockback distance: even high-mass enemies slide at least 0.5 world units
- Reduce friction during stun from 0.90 to 0.85 (slower velocity decay = longer slide)

### FR-06: Camera Micro-Shake on Hit (Medium Priority)
- On melee hit → 1-2px camera shake for 0.1s
- On kill → 3-5px camera shake for 0.15s
- Implemented as offset to camera target position in MatrixScene's useFrame
- Configurable: can be disabled in settings

### FR-07: Hit-Stop / Frame Freeze (Medium Priority)
- On heavy hits (axe, punch) → 30-50ms time scale slowdown (hitstop)
- Creates "impact weight" feel common in action games
- Apply to game delta time, not real time (so UI stays responsive)

### FR-08: Enemy Tilt on Knockback (Low Priority)
- During stun, enemies tilt 10-15 degrees in knockback direction
- Lerp back to upright over stun duration
- Adds visual weight to the push-back

---

## Pillar 3: Biome Map Redesign with KayKit Textures

### Current State
- MCVoxelTerrain uses 3 biomes: PLAINS, DESERT, FOREST
- Biome threshold: noise < -0.8 = DESERT, noise > 0.8 = FOREST, else PLAINS
- Very binary transitions, limited variety

### FR-09: Expanded Biome System (High Priority)
Expand from 3 to 6 biomes with smooth Perlin noise blending:

| Biome | Surface Block | Sub-Surface | KayKit Models | Decoration |
|-------|--------------|-------------|---------------|------------|
| **PLAINS** | grass / dirt_with_grass | dirt | grass, dirt_with_grass | flowers, tall_grass |
| **FOREST** | grass (darker variant) | dirt | grass, gravel_with_grass | trees (dense), mushrooms |
| **DESERT** | sand_A | sand_B | sand_A, sand_B | cacti (new), rocks |
| **TUNDRA** | snow | stone | snow, grass_with_snow | snow trees |
| **MOUNTAINS** | stone | stone_dark | stone, stone_dark, gravel | boulders, ore exposed |
| **SWAMP** | gravel_with_grass | gravel | gravel_with_grass, dirt | water patches, dead trees |

### FR-10: KayKit Texture Atlas Integration (High Priority)
- Extract face UVs from `block_bits_texture.png` atlas (shared across all 40 models)
- Create per-block-type face textures (top/side/bottom) from atlas regions
- Replace current 27 procedural PNG textures with KayKit-derived textures
- Maintain NearestFilter (pixel-art) for consistency
- Texture atlas approach: single texture, UV offsets per block type in shader

### FR-11: Biome Transition Zones (Medium Priority)
- Use KayKit's transition blocks at biome borders:
  - Plains↔Desert: `sand_with_grass`
  - Plains↔Tundra: `grass_with_snow`, `dirt_with_snow`
  - Mountains↔Plains: `gravel_with_grass`
- Transition width: 8-12 blocks (noise interpolation)
- One consistent tile type per zone, natural blending at borders

### FR-12: Region Consistency Rule (High Priority)
- Each biome zone uses ONE primary surface block — no random mixing within zones
- Variety comes from sub-surface exposure (cliff faces, terrain dips)
- Decoration objects provide visual interest, not surface block mixing
- User requirement: "한 지역을 하나의 타일로 일관성있게"

---

## Non-Functional Requirements

### Performance
- Particle system: InstancedMesh pool, max 200 active particles, zero allocation per frame
- Texture atlas: single `block_bits_texture.png` load, UV offset per block type
- Camera shake: pure offset math, no new objects
- Biome expansion: noise already computed per block, adding more thresholds is O(1)

### Compatibility
- All changes must work with existing InstancedMesh rendering pipeline
- Enemy knockback changes in combat.ts affect both 2D (MatrixCanvas) and 3D (MatrixScene) equally
- No new asset downloads required at runtime (KayKit textures baked at build time)

---

## Priority Ranking

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | FR-05: Amplify knockback force | High (core 손맛) | Low |
| P0 | FR-01: Hit spark particles | High (visual feedback) | Medium |
| P0 | FR-02: Death burst particles | High (satisfaction) | Medium |
| P1 | FR-06: Camera micro-shake | Medium (juice) | Low |
| P1 | FR-10: KayKit texture integration | High (visual upgrade) | High |
| P1 | FR-09: Expanded biomes | High (map variety) | Medium |
| P1 | FR-12: Region consistency | High (user request) | Low |
| P2 | FR-07: Hit-stop | Medium (advanced juice) | Low |
| P2 | FR-11: Biome transitions | Medium (polish) | Medium |
| P2 | FR-03: Slash trail | Medium (visual) | Medium |
| P3 | FR-08: Enemy tilt | Low (polish) | Low |
| P3 | FR-04: XP collection sparkle | Low (polish) | Low |

---

## Clarity Breakdown

| Dimension | Score | Status |
|-----------|-------|--------|
| Goal Clarity | 0.95 | Clear — 3 pillars well-defined |
| Constraint Clarity | 0.90 | Clear — existing InstancedMesh pipeline, KayKit atlas |
| Success Criteria | 0.85 | Clear — knockback visible, particles spawning, biomes varied |
| Context (Brownfield) | 0.90 | Clear — MCVoxelTerrain, combat.ts, EnemyRenderer.tsx mapped |
| **Ambiguity Score** | **0.08** | **Ready (< 0.20)** |

## Interview Summary
- Rounds completed: 0 (user provided clear direction)
- Challenge agents used: none
- User request was specific: effects + knockback + biome consistency
- Brownfield context fully analyzed via codebase exploration

## Confidence Level: High
- All target files identified and analyzed
- Existing knockback physics confirmed — enhancement is parameter tuning + visual layer
- KayKit assets verified as GLTF-compatible with existing BoxGeometry pipeline
- Cartoon FX Pack confirmed unusable — procedural alternative is standard practice

---

## Next Steps
1. `/da:plan` → Detailed implementation phases
2. `/da:dev` or `/da:game` → Implementation with P0 items first
