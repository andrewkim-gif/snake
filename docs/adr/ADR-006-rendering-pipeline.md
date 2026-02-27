# ADR-006: Smooth Curve Rendering Pipeline (Revised)

## Status
Accepted (Revised v2.0 — 2026-02-27)

## Context
v1 used a 3-stage pixel art pipeline (16x16 grid tiles, spritesheet, scanline upscaling). snake.io style requires smooth circular segments with glow effects, no grid.

### v1→v2 Change
- v1: Pixel art grid (fillRect, image-rendering: pixelated, 16px tiles)
- v2: Smooth circles + glow (arc, shadowBlur, bezierCurveTo)

## Decision
Use a **6-stage rendering pipeline** optimized for smooth snake.io visuals:

```
Stage 1: Clear Canvas
Stage 2: Render Background (hex dot pattern, scrolling with camera)
Stage 3: Render Arena Boundary (red warning zone)
Stage 4: Render Orbs (glowing circles, color-coded by type)
Stage 5: Render Snakes (circle segments, eyes, glow, boost trail)
Stage 6: HUD Overlay (DOM-based: score, leaderboard, minimap)
```

### Snake Rendering Detail
```
For each snake (back-to-front z-order by mass):
  1. Body: ctx.arc(x, y, radius, 0, 2π) per segment
     - Alternating primary/secondary colors for pattern
     - ctx.shadowBlur = 8 for glow effect
  2. Head: larger circle with eye rendering
     - Eyes direction based on heading angle
  3. Boost trail: fading smaller circles behind tail
```

### Performance Optimizations
- Skip glow (shadowBlur=0) if FPS drops below 45
- Reduce segment rendering for distant snakes (LOD)
- Use offscreen canvas for static background pattern
- Batch similar draw calls (all same-color segments together)

## Consequences
- **Positive**: Matches snake.io visual quality
- **Positive**: Canvas 2D API fully sufficient (no WebGL needed)
- **Negative**: shadowBlur is expensive on mobile — adaptive quality needed
- **Negative**: Many arc() calls per frame — ~5000 for 100 snakes

## Alternatives Considered
- **WebGL renderer**: Better performance but much higher complexity
- **PixiJS**: Good abstraction but adds ~300KB bundle
- **Pre-rendered segment sprites**: Loses dynamic glow and size scaling
