# Snake Arena — Deployment & Infrastructure v2.0

> **Version**: 2.0 (Revised for arena-based architecture)
> **Date**: 2026-02-27

---

## 1. Deployment Topology

```
                    ┌─────────────────────┐
                    │   DNS (Cloudflare)   │
                    │  snake-arena.com     │
                    └──────┬──────┬───────┘
                           │      │
              HTTPS/CDN    │      │  WSS
                    ┌──────┴──┐ ┌─┴──────────┐
                    │ Vercel  │ │  Railway    │
                    │ (Next)  │ │ (Arena Svr) │
                    └─────────┘ └──────┬─────┘
                                       │ HTTPS
                                ┌──────┴─────┐
                                │  Supabase  │
                                │  (DB/Auth) │
                                └────────────┘
```

## 2. Vercel (Frontend)

```yaml
Project: snake-arena-web
Framework: Next.js 15 (App Router)
Build: next build (static export for game page)
Output: Static HTML + JS bundle

Settings:
  Build_Command: cd apps/web && npm run build
  Output_Directory: apps/web/.next
  Node_Version: 20
  Install_Command: npm install

Environment_Variables:
  NEXT_PUBLIC_WS_URL: wss://snake-arena-server.up.railway.app
  NEXT_PUBLIC_SUPABASE_URL: https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJ...

Performance:
  Bundle_Target: <300KB gzip
  Edge_Caching: Static assets cached globally
  Revalidation: Landing page ISR (60s)
  Game_Page: Pure CSR (no SSR for Canvas)
```

## 3. Railway (Arena Server)

```yaml
Project: snake-arena-server
Runtime: Node.js 20

Settings:
  Build_Command: cd apps/server && npm run build
  Start_Command: cd apps/server && node dist/index.js
  Health_Check: GET /health → 200
  Port: 3001

Resources:
  RAM: 512MB (per instance)
  CPU: 1 vCPU
  Disk: Not needed (stateless)

Scaling:
  MVP: Single instance (1 arena, 100 players)
  Growth: Horizontal scaling (1 instance per arena)
  Strategy: New instance per arena via Railway service replicas
  Load_Balancer: Not needed MVP (single instance)
  Future: nginx/HAProxy for multi-arena routing

Environment_Variables:
  PORT: 3001
  NODE_ENV: production
  CORS_ORIGIN: https://snake-arena.com
  SUPABASE_URL: https://xxx.supabase.co
  SUPABASE_SERVICE_KEY: eyJ... (server-side only)
  ARENA_MAX_PLAYERS: 100
  ARENA_RADIUS: 6000
  TICK_RATE: 20

Networking:
  WebSocket: Native support (Railway supports long-lived connections)
  Timeout: No idle timeout for WebSocket connections
  SSL: Automatic via Railway (*.up.railway.app)
```

## 4. Supabase (Database & Auth)

```yaml
Project: snake-arena
Plan: Free tier (MVP) → Pro (production)

Features_Used:
  PostgreSQL: player_profiles, game_sessions, skins
  Auth: Anonymous + OAuth (Google, GitHub)
  Realtime: Not used (game state via Socket.IO)

Connection:
  Server → Supabase: service_role key (full access, RLS bypass)
  Client → Supabase: anon key (RLS enforced)

Backup:
  Free: Daily automatic backup
  Pro: Point-in-time recovery (PITR)
```

## 5. CI/CD Pipeline

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Push   │────>│  Lint &  │────>│  Build   │────>│  Deploy  │
│  to     │     │  Type    │     │  & Test  │     │  (auto)  │
│  main   │     │  Check   │     │          │     │          │
└─────────┘     └──────────┘     └──────────┘     └──────────┘

GitHub Actions:
  1. Install: npm ci
  2. Lint: turbo run lint
  3. TypeCheck: turbo run typecheck
  4. Test: turbo run test (unit tests)
  5. Build:
     - apps/web: next build
     - apps/server: tsc (TypeScript → JS)
  6. Deploy:
     - Vercel: auto-deploy on push to main (git integration)
     - Railway: auto-deploy on push to main (git integration)
```

## 6. Monitoring & Observability

```yaml
Server_Metrics (exposed at /metrics):
  arena_player_count: Gauge
  arena_orb_count: Gauge
  arena_tick_duration_ms: Histogram
  arena_memory_usage_bytes: Gauge
  arena_uptime_seconds: Counter
  socket_connections_total: Counter
  socket_messages_per_second: Gauge

Health_Check:
  GET /health → { status: "ok", players: N, uptime: S, tickMs: T }
  Alert if tick_duration > 40ms (approaching 50ms budget)
  Alert if memory > 400MB (approaching 512MB limit)

Logging:
  Structured JSON logs (pino)
  Log levels: error, warn, info
  Key events: join, death, kill, disconnect, rate_limit
  NO logging of game state (too verbose)

Alerting:
  Railway built-in: crash restart, memory alerts
  Uptime monitoring: Ping /health every 60s
  Custom: Discord webhook for player count milestones
```

## 7. Disaster Recovery

```yaml
RTO: 5 minutes (Railway auto-restart)
RPO: 0 (game state is ephemeral; only persistent data is in Supabase)

Scenarios:
  Server Crash:
    - Railway auto-restarts the service
    - All connected players disconnected
    - Players reconnect and rejoin (new snake)
    - No data loss (game state is ephemeral)

  Supabase Outage:
    - Game continues to work (game logic is independent)
    - Stats/leaderboard writes queued and retried
    - Auth: anonymous play unaffected; OAuth login fails

  Vercel Outage:
    - Game page served from CDN cache
    - New deployments blocked
    - Existing players unaffected (WebSocket direct to Railway)
```

---

*Generated by DAVINCI /da:system v2.0*
