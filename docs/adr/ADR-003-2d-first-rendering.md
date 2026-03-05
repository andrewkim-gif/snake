# ADR-003: 2D-First Rendering with 3D Migration Path

## Status
Accepted

## Context
The lobby already uses React Three Fiber (R3F) for 3D Minecraft-style backgrounds. The v10 game view could:

1. Go full 3D immediately (matching lobby aesthetics)
2. Start with 2D Canvas and migrate to 3D later
3. Maintain both renderers permanently

The core gameplay (auto-combat, level-up, build strategy) is independent of rendering technology.

## Decision
Phase 1-3 use 2D Canvas with 16x16 MC-style pixel sprites for the game view. Phase 4+ migrates to 3D R3F. The rendering layer is organized as a swappable module to enable clean switching.

### Rendering Architecture:
```
Phase 1-3:  lib/renderer/ (2D Canvas)
  entities.ts  → 16x16 agent sprites + aura circles
  background.ts → zone tints + shrink boundary
  ui.ts        → nametags + build indicators

Phase 4+:   components/3d/ (R3F)
  AgentModel3D.tsx  → MC voxel character
  CombatAura3D.tsx  → Translucent sphere
  VoxelTerrain.tsx  → Block world
```

## Consequences

### Positive
- Phase 1-3 ships significantly faster (sprites vs voxel models)
- Core gameplay can be validated without 3D performance concerns
- Mobile performance is guaranteed in 2D
- Reduces Phase 1-3 scope to focus on game mechanics

### Negative
- Visual disconnect between 3D lobby and 2D game (Phase 1-3)
- Some features deferred (depth, 3D effects, camera angles)
- Players may perceive 2D as lower quality

### Mitigation
- 2D renderer uses MC pixel art aesthetics (NearestFilter, 16x16) matching lobby theme
- 3D migration is architecturally planned from day 1
- Renderer abstraction ensures no game logic depends on rendering technology

## Alternatives Considered

1. **Full 3D from Phase 1**: Rejected — would add 2-3 weeks to Phase 1 for AgentModel3D, textures, camera system, performance optimization. Core gameplay validation is the priority.

2. **Permanent dual renderer**: Rejected — maintenance burden of two renderers is unsustainable long-term. 2D becomes legacy after Phase 4.

---

*Created by DAVINCI /da:system — 2026-03-06*
