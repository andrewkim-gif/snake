# ADR-002: Server-Side Upgrade/Combat Authority

## Status
Accepted

## Context
The v10 upgrade system (Tome stacks, Ability auto-triggers, synergy checks) and combat system (aura DPS, dash bursts) introduce significant game-state complexity. These computations could be:

1. **Server-authoritative**: All logic runs on server, client is display-only
2. **Client-predicted**: Client computes optimistically, server validates
3. **Hybrid**: Client predicts movement, server authoritative for combat/upgrades

The game is competitive multiplayer with AI agents, making fairness critical.

## Decision
All upgrade and combat logic is 100% server-authoritative. Client is display-only for all game-state modifications. Level-up choices are generated server-side, applied server-side, and synergy checks run server-side.

### Specifically:
- `UpgradeSystem.generateChoices()` → server only
- `UpgradeSystem.applyUpgrade()` → server only
- `CollisionSystem.processAuraCombat()` → server only
- `AgentEntity.takeDamage()` → server only
- Client receives results via events and state broadcasts

## Consequences

### Positive
- No cheating vectors for build manipulation, damage modification, or speed hacks
- Single source of truth for competitive fairness
- AI agents and human players have identical game rules
- Simpler client code (no game logic duplication)

### Negative
- Level-up overlay has ~50-100ms latency between selection and confirmation
- Ability visual effects may lag slightly behind server trigger
- Client cannot show instant feedback for upgrade application

### Mitigation
- Client plays optimistic animations for abilities (revert if server disagrees)
- Level-up 5s timeout provides ample time despite latency
- `choose_upgrade_ack` event confirms within 1-2 ticks (~50-100ms)
- State broadcast at 20Hz means visual delay is imperceptible

## Alternatives Considered

1. **Client-side prediction for combat**: Rejected — opens door to damage manipulation cheats. The 50ms latency is acceptable for auto-combat (not twitch gameplay).

2. **Optimistic upgrade application**: Rejected — synergy checks involve the full build state and could diverge between client and server, causing confusing rollbacks.

---

*Created by DAVINCI /da:system — 2026-03-06*
