# v10 Phase 3 Client Adaptation (S34-S39) Summary

## S34: WebSocket Adapter
- **File**: `apps/web/hooks/useWebSocket.ts` (NEW)
- `GameSocket` class: connect, emit, on, off, disconnect
- JSON frame protocol: `{e: event, d: data}`
- Auto-reconnect with exponential backoff (max 5 attempts)
- Connection state callbacks: onConnect, onDisconnect

## S35: useSocket.ts Modification
- **File**: `apps/web/hooks/useSocket.ts`
- socket.io-client import removed, replaced with GameSocket
- `toWsUrl()` helper: HTTP/HTTPS URL to WS/WSS + /ws endpoint
- All existing events preserved (join_room, leave_room, input, state, death, etc.)

## S36: socket.io-client Removal
- Removed from `apps/web/package.json`
- No socket.io references remain in codebase

## S37: Agent Character Rendering
- **File**: `apps/web/lib/renderer/entities.ts` (REWRITE)
- `drawSnakes()` replaced with `drawAgents()`
- Agent single-character rendering: 16x16 MC-style sprite
- Mass-based scaling (1.0x at mass 10, up to 1.6x at 150+)
- Aura visualization (pulsing translucent circle)
- HP bar (mass visualization with color coding)
- Nameplate + level badge
- Boost trails effect
- Effect visualizations (speed, magnet, ghost)

## S38: Sprite System
- **File**: `apps/web/lib/sprites.ts` (NEW)
- Procedural 16x16 pixel art generation (64x64 render scale)
- MC-style block character: head(6 rows) + body(6 rows) + legs(4 rows)
- Eye styles: default, dot, angry, cute, cool, wink
- Pattern support: solid, striped, gradient, dotted
- Sprite caching by skinId

## S39: Interpolation Rewrite
- **File**: `apps/web/lib/interpolation.ts`
- `interpolateSnakes()` renamed to `interpolateAgents()`
- Segment array interpolation replaced with single position lerp
- Heading angle interpolation (shortest path)
- Mass interpolation (smooth HP changes)
- `applyClientPrediction()` simplified for single position
- Backward compat alias: `export const interpolateSnakes = interpolateAgents`

## Type Changes
- `StatePayload.s` type: `SnakeNetworkData[]` -> `AgentNetworkData[]`
- `RenderState.snakes` -> `RenderState.agents`
- All client code updated: SnakeNetworkData -> AgentNetworkData
- ui.ts: drawHUD updated for AgentNetworkData (lv instead of p.length)
- 3D components (GameLoop, SnakeGroup, VoxelSnake, GameCanvas3D) updated
