# ADR-010: Continuous Movement Physics Engine

## Status
Accepted (v2.0 — 2026-02-27)

## Context
v1 used discrete grid-based movement (4 directions, cell-by-cell, 200ms per cell). snake.io requires continuous floating-point movement where the snake head smoothly follows the mouse cursor at any angle.

## Decision
Implement an **angle-based continuous movement engine** with these properties:

### Movement Model
```
Per tick (dt = 0.05s at 20Hz):
  1. Steering: heading += clamp(targetAngle - heading, -TURN_RATE, +TURN_RATE)
  2. Position: head.x += cos(heading) × speed × dt
              head.y += sin(heading) × speed × dt
  3. Body: segments.unshift(newHead); trim tail to match mass
```

### Key Constants
```
BASE_SPEED:    200 px/s    (normal movement)
BOOST_SPEED:   400 px/s    (2x during boost)
TURN_RATE:     0.06 rad/tick (≈3.4°/tick, ~69°/s max turn speed)
SEGMENT_SPACING: 8 units   (distance between body segments)
```

### Body Following
- Head traces a path through world coordinates
- Each subsequent segment follows the previous segment's historical position
- Segments maintain exactly SEGMENT_SPACING distance apart
- This naturally creates smooth curved bodies

### Why Not Instant Direction Change?
- TURN_RATE limit creates realistic snake-like movement
- Prevents impossible 180° instant turns
- Creates strategic depth: large snakes can't turn as quickly in tight spaces
- Matches snake.io feel precisely

## Consequences
- **Positive**: Smooth, satisfying movement matching snake.io
- **Positive**: Server-authoritative (only angle input from client)
- **Positive**: Simple physics model (no complex rigid body simulation)
- **Negative**: Requires floating-point precision handling
- **Negative**: Segment array management adds memory overhead per snake
- **Negative**: More complex interpolation than grid-based movement

## Alternatives Considered
- **Instant direction change**: Feels wrong, too responsive, unlike snake.io
- **Spline-based movement**: Over-engineered, harder to sync across network
- **Grid with sub-cell interpolation**: Still fundamentally grid-based, doesn't create smooth curves
