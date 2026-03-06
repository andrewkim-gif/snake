# ADR-014: Go Monolith in server/ Directory

## Status
Proposed

## Date
2026-03-06

## Context

The Agent Survivor project is a JavaScript/TypeScript monorepo managed with npm workspaces:
- `apps/web/` — Next.js 15 frontend
- `apps/server/` — TypeScript game server (legacy, Socket.IO)
- `packages/shared/` — Shared TypeScript types and constants

The Go game server needs a home in this monorepo. Options considered:

**Option A**: Replace `apps/server/` with Go code directly.
**Option B**: Create `server/` at project root as an independent Go module.
**Option C**: Create `apps/go-server/` within the apps/ directory.

## Decision

**Option B: `server/` at project root** with its own `go.mod`.

The Go server is a completely independent module that shares no code with the TypeScript
ecosystem. It has its own dependency management (go.mod), build tooling (go build),
and deployment pipeline (Docker multi-stage).

```
snake/
├── server/              # Go game server (independent go.mod)
│   ├── cmd/server/
│   ├── internal/
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── apps/
│   ├── web/             # Next.js frontend (kept)
│   └── server/          # TypeScript server (removed after migration)
└── packages/shared/     # TypeScript types (kept for web client)
```

## Consequences

### Positive
- **Zero conflict**: `go.mod` is completely isolated from `package.json`. No tooling conflicts.
- **Independent development**: Go server can be built, tested, and deployed without touching
  the Node.js ecosystem.
- **Parallel operation**: During migration, both servers can run simultaneously for A/B testing.
- **Clean Docker build**: `COPY server/ .` in Dockerfile. No need to filter out JS files.
- **Railway compatibility**: Single Dockerfile path in railway.json.

### Negative
- **No shared types**: Go and TypeScript cannot share type definitions. The `domain/` package
  in Go must manually mirror `packages/shared/src/types/`. Changes require updating both.
- **Two build systems**: `go build` for server, `npm run build` for web. The `game.sh` script
  orchestrates both locally.
- **apps/server/ removal**: Must wait until Go server is verified in production before
  deleting the TypeScript server code.

### Migration Strategy
1. Develop Go server in `server/` (no impact on existing code)
2. Deploy Go server as new Railway service
3. Update `NEXT_PUBLIC_SERVER_URL` to point to Go server
4. Verify in production for 1 week
5. Remove `apps/server/` from repository
6. Update monorepo workspace config

## Alternatives Considered

**Option A (Replace apps/server/)**: Confusing — mixing Go files in a JS workspace directory.
npm workspace tools would try to process it.

**Option C (apps/go-server/)**: Unnecessarily nested. The `apps/` convention is for JS workspace
packages. Go does not participate in the workspace.
