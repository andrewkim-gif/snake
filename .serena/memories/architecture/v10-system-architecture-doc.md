# v10 System Architecture Document

## Location
- `docs/designs/v10-system-architecture.md` (1499 lines)
- `docs/adr/ADR-011-go-raw-websocket.md`
- `docs/adr/ADR-012-channel-based-hub.md`

## Key Architecture Decisions (ADR-011~018)
1. Go + Raw WebSocket (Socket.IO 제거)
2. Channel-based Hub (lock-free)
3. Per-Room Goroutine (독립 20Hz)
4. Separate server/ folder
5. JSON first (Phase 2에서 Binary)
6. Monolithic (마이크로서비스 거부)
7. In-Memory + JSON files (DB 없음)
8. 2D Canvas first → 3D R3F gradual

## Performance SLOs
- Tick: P99 < 5ms/Room
- Memory: ~67MB / 5000 CCU
- Network: ~81KB/s per player
- Goroutines: ~10,055 @ 5,000 CCU
