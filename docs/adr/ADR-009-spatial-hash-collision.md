# ADR-009: Spatial Hash Grid for Collision Detection

## Status
Accepted (v2.0 — 2026-02-27)

## Context
With 100 snakes averaging 50 segments each (5,000 entities), plus 2,000+ orbs, brute-force collision detection (O(n²)) would require ~500,000 distance checks per tick. At 20Hz this is computationally prohibitive.

## Decision
Use a **Spatial Hash Grid** for O(1) average-case neighbor queries:

### Configuration
```
Cell size: 200 × 200 world units
Grid: 60 × 60 cells (covers 12,000 × 12,000 arena diameter)
Total cells: 3,600
```

### Algorithm
```
Per tick:
  1. Clear all cells
  2. Insert all snake segments → cell based on position
  3. Insert all orbs → cell based on position
  4. For each snake head:
     a. Query head's cell + 8 neighboring cells
     b. Check distance to each entity in those cells
     c. If distance < collision threshold → collision detected
```

### Performance
```
Entities: ~7,000 (5,000 snake segments + 2,000 orbs)
Entities per cell: ~2 average (7,000 / 3,600)
Neighbor query: 9 cells × 2 entities = 18 checks per head
Total checks: 100 heads × 18 = 1,800 per tick
vs brute force: 100 × 7,000 = 700,000
→ ~389x improvement
```

## Consequences
- **Positive**: O(1) average neighbor queries, handles 100+ players
- **Positive**: Simple implementation (~150 lines)
- **Positive**: Memory efficient (~50KB for grid structure)
- **Negative**: Requires full rebuild each tick (but O(n) is fast)
- **Negative**: Cell size tuning needed (too small = many cells, too large = many per cell)

## Alternatives Considered
- **Quadtree**: Better for non-uniform distributions but higher overhead for rebuild
- **R-tree**: Overkill for this use case, complex implementation
- **Grid with dirty tracking**: Complex, marginal improvement for 20Hz rebuild
