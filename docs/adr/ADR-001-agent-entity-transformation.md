# ADR-001: Snake→Agent Entity Model Transformation

## Status
Accepted

## Context
The v7 snake entity uses `segments: Position[]` (head + body chain) which permeates every system: SpatialHash indexes segments individually, CollisionSystem checks head-body intersections, StateSerializer transmits all segment positions, renderers draw circles along the path. The v10 Agent Survivor design replaces this with a single-position agent with an aura-based combat model.

The segment model was appropriate for a Slither.io-style game but is fundamentally incompatible with the v10 vision of MC-style characters with auto-combat auras, level-up builds, and AI agent integration.

## Decision
Full entity rewrite rather than incremental adaptation. Replace `SnakeEntity` class with `AgentEntity` class. Remove all segment-related code paths simultaneously in Phase 1.

### Key Changes:
- `segments: Position[]` → `position: Position` (single coordinate)
- `mass = segment count` → `mass = HP` (hit points, combat-driven)
- Head-body collision → Aura DPS exchange + Dash burst damage
- Segment rendering → Single agent sprite/model rendering
- SpatialHash: segment entries → agent position entries only

## Consequences

### Positive
- 93% reduction in SpatialHash entities (300 → 20)
- ~58% network bandwidth reduction (no segment arrays in state)
- Dramatically simpler movement code (~170 LOC → ~120 LOC)
- Cleaner combat model (circle-circle proximity vs segment-chain intersection)
- Enables MC-style character rendering (single sprite vs segment chain)

### Negative
- Breaking change: all downstream systems must update simultaneously
- No backward compatibility with v7 clients
- Phase 1 is a high-risk 3-week sprint

### Risk Mitigation
- Comprehensive bot-only testing (50+ rounds) before human exposure
- Feature branch deployment to preview environment
- 2D debug wireframe renderer for early integration testing

## Alternatives Considered

1. **Incremental migration** (keep segments, add agent fields gradually)
   - Rejected: Dual entity model would be more complex than either alone
   - segments are fundamentally incompatible with aura combat

2. **Adapter pattern** (AgentEntity wraps SnakeEntity)
   - Rejected: Entity internals are too different
   - An adapter would be more code than a clean rewrite

3. **New game alongside v7** (separate codebase)
   - Rejected: Would lose all existing infrastructure, deployment, and lobby code
   - The movement/input/networking layer is highly reusable

---

*Created by DAVINCI /da:system — 2026-03-06*
