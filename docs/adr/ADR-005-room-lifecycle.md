# ADR-005: Persistent Arena (Supersedes Room Lifecycle)

## Status
Superseded (v2.0 — 2026-02-27)

## Context
v1 used round-based GameRooms (waiting→countdown→playing→ended, 3-5 minute rounds). snake.io uses a **persistent arena** model where the game never ends and players freely join/leave.

### v1→v2 Change
- v1: GameRoom with 4-phase lifecycle, 8-12 players, round timer, winner
- v2: Persistent Arena, always running, 50-100 players, free join/leave, no rounds

## Decision
Replace the Room lifecycle with a **Persistent Arena** model:

1. **Always Running**: Arena game loop starts on server boot and never stops
2. **Free Join**: Players connect and immediately enter the arena (no waiting room)
3. **Instant Respawn**: Death → score screen → click "Play Again" → new snake
4. **No Rounds**: No timer, no winner announcement, continuous play
5. **Dynamic Capacity**: Players join/leave freely, up to max capacity (100)

### Arena Lifecycle
```
Server Boot → Arena.init()
  → Game loop starts (20Hz, infinite)
  → Accept player connections at any time
  → Players spawn at random safe positions
  → Players die → convert to orbs → can respawn immediately
  → Server shutdown → graceful disconnect all
```

## Consequences
- **Positive**: Matches snake.io experience exactly
- **Positive**: Simpler server code (no room management, matchmaking, phases)
- **Positive**: No waiting time for players
- **Negative**: No clear "win" condition (leaderboard is the competition)
- **Negative**: Harder to balance with varying player counts

## Alternatives Considered
- **Timed rounds in arena**: Adds unnecessary complexity, unlike snake.io
- **Room-based with auto-refill**: Hybrid approach, but confusing UX
