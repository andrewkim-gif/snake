# ADR-013: Per-Room Goroutine Game Loop

## Status
Proposed

## Date
2026-03-06

## Context

The Agent Survivor game server manages up to 50 rooms, each running a 20Hz game loop.
The key architectural question is how to schedule these game loops:

**Option A**: Single goroutine with a multiplexed ticker, iterating through all rooms sequentially.
**Option B**: Dedicated goroutine per room, each with its own `time.Ticker(50ms)`.
**Option C**: Worker pool with N goroutines processing room ticks from a queue.

## Decision

**Option B: Per-Room Goroutine**. Each Room runs in its own goroutine with an independent
`time.Ticker(50ms)`. The Room goroutine exclusively owns all game state for that room
(Arena, Agents, Orbs, SpatialHash, etc.).

```go
func (r *Room) Run(ctx context.Context, hub *ws.Hub) {
    gameTicker := time.NewTicker(50 * time.Millisecond)  // 20Hz
    stateTicker := time.NewTicker(1 * time.Second)       // 1Hz
    for {
        select {
        case <-ctx.Done(): return
        case input := <-r.inputChan:    r.arena.ApplyInput(input)
        case join := <-r.joinChan:      r.handleJoin(join, hub)
        case id := <-r.leaveChan:       r.handleLeave(id, hub)
        case <-gameTicker.C:            r.arena.Tick(); r.broadcastState(hub)
        case <-stateTicker.C:           r.tickState(hub)
        }
    }
}
```

## Consequences

### Positive
- **True parallelism**: Rooms are distributed across CPU cores by the Go runtime scheduler.
  A 4-core machine can process 4 room ticks simultaneously.
- **No synchronization**: Each room's game state has a single writer (its goroutine).
  No mutexes, no deadlocks, no race conditions within game logic.
- **Simple lifecycle**: Starting a room = `go room.Run(ctx, hub)`. Stopping = `cancel()`.
- **Proven pattern**: Used in agent_arena production with stable 20Hz ticks.
- **Fault isolation**: A panic in one room's goroutine (with recovery) does not affect others.

### Negative
- **Goroutine count**: 50 rooms = 50 goroutines. Minimal overhead (~2KB stack each = 100KB total).
- **Timer drift**: Independent tickers may drift slightly. Not a problem for a game
  where rooms are independent and clients interpolate.
- **Cross-room coordination**: If future features need cross-room state (e.g., global leaderboard),
  it must go through channels. Currently no such requirement exists.

### Metrics
- 50 rooms x 20Hz = 1,000 tick/s total. Each tick ~2.6ms. Total CPU: ~2.6s/s across all cores.
  On 4 vCPU: ~65% idle.

## Alternatives Considered

**Option A (Sequential)**: Simpler but serial. At 50 rooms x 2.6ms = 130ms per round,
which exceeds the 50ms tick budget. Not viable at scale.

**Option C (Worker Pool)**: Over-engineered for this case. Adds scheduling complexity
without meaningful benefit since goroutines are already lightweight.
