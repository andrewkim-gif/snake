# ADR-004: Viewport-Based State Sync Strategy (Revised)

## Status
Accepted (Revised v2.0 — 2026-02-27)

## Context
With 50-100 players in a single arena (vs 8-12 in rooms), broadcasting full arena state to every player is prohibitively expensive. Each snake has ~50 segments, creating ~250KB/tick full state. At 20Hz, this would consume 5MB/s per player.

### v1→v2 Change
- v1: Delta Compression + Periodic Full Snapshot (room-based, 8-12 players)
- v2: Viewport-Based Culling + Binary Protocol (arena-based, 50-100 players)

## Decision
Use **viewport-based state culling** as the primary bandwidth optimization strategy:

1. **Per-Player Viewport**: Calculate each player's visible area based on screen size and zoom level
2. **Entity Filtering**: Only send snakes and orbs within the player's viewport (+200px margin)
3. **Binary Protocol**: Use compact ArrayBuffer encoding instead of JSON for state updates
4. **Leaderboard Batching**: Send leaderboard data every 5th tick (not every tick)

### Bandwidth Budget
```
Per player per tick:
  15 visible snakes × (header + 30 segments) ≈ 1,900B
  200 visible orbs × 6B ≈ 1,200B
  Leaderboard (1/5 ticks) ≈ 40B amortized
  Total: ~3.1KB/tick → ~62KB/s at 20Hz
```

## Consequences
- **Positive**: 88% bandwidth reduction vs full broadcast, supports 100 players
- **Positive**: Binary protocol reduces encoding/decoding overhead
- **Negative**: Snakes entering viewport may "pop in" — mitigated by 200px margin buffer
- **Negative**: Server CPU cost for per-player viewport calculation — mitigated by spatial hash

## Alternatives Considered
- **Full broadcast with delta compression**: Still too expensive at 100 players
- **Interest management (pub/sub grid cells)**: More complex, similar results
- **Client-side prediction only**: Unacceptable for multiplayer fairness
