# Snake Arena — Security Threat Model v2.0

> **Version**: 2.0 (Revised for snake.io style — continuous movement arena)
> **Date**: 2026-02-27
> **Methodology**: STRIDE + OWASP Game Security Framework

---

## 1. Attack Surface

```
┌───────────────────────────────────────────────────────┐
│                    Attack Surface Map                   │
│                                                        │
│  Client (Browser)          Network          Server     │
│  ┌──────────────┐    ┌──────────────┐  ┌───────────┐  │
│  │ JS Console   │    │ WebSocket    │  │ Socket.IO │  │
│  │ DevTools     │────│ Messages     │──│ Handler   │  │
│  │ Memory Edit  │    │ (tamper)     │  │           │  │
│  │ Bot Scripts  │    │              │  │ Arena     │  │
│  │ Input Spoof  │    │ HTTP API     │  │ Engine    │  │
│  └──────────────┘    └──────────────┘  │           │  │
│                                        │ Supabase  │  │
│                                        │ API       │  │
│                                        └───────────┘  │
└───────────────────────────────────────────────────────┘
```

---

## 2. STRIDE Threat Analysis

### S — Spoofing

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| S-01 | Impersonate another player | Low | Server assigns unique IDs; names are display-only |
| S-02 | Replay join events | Low | Socket.IO session binding; rate limit 1 join/connection |
| S-03 | Fake auth tokens | Medium | Supabase JWT validation; anonymous-first reduces incentive |

### T — Tampering

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| T-01 | **Modified input angle** (aim assist) | Medium | Server clamps angle to valid range (0~2π); TURN_RATE limits rapid changes |
| T-02 | **Fake position** (teleport hack) | High | **Server-Authoritative**: client sends only angle, server calculates position |
| T-03 | **Speed hack** (modified speed) | High | **Server-Authoritative**: speed is server-controlled constant |
| T-04 | **Modified orb collection** | High | Server validates orb proximity; client has no orb interaction logic |
| T-05 | **Boosting without mass cost** | High | Server enforces mass deduction per tick during boost |

### R — Repudiation

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| R-01 | Deny kill/death | Low | Server is single source of truth; game_sessions table logs all events |
| R-02 | Dispute leaderboard | Low | Server calculates all scores; Supabase stores verified sessions |

### I — Information Disclosure

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| I-01 | **See all snakes** (maphack) | Medium | **Viewport culling**: server only sends entities within player's viewport |
| I-02 | See server-side data | Low | Client receives only necessary game state |
| I-03 | Sniff other players' data | Low | WSS (TLS) encryption in production |

### D — Denial of Service

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| D-01 | **Input flooding** (30+ events/s) | High | Rate limit: max 30 input events/second; drop excess |
| D-02 | Connection spam | High | Max 5 connections/minute per IP; connection limit per arena |
| D-03 | Respawn spam | Medium | Respawn cooldown: 2 seconds between respawns |
| D-04 | WebSocket frame bombing | Medium | Socket.IO maxHttpBufferSize: 1KB; message size limit |

### E — Elevation of Privilege

| ID | Threat | Risk | Mitigation |
|----|--------|------|------------|
| E-01 | Admin command injection | Low | No admin commands in WebSocket; server console only |
| E-02 | Supabase RLS bypass | Medium | service_role key only on server; RLS policies enforced |

---

## 3. Game-Specific Threats (snake.io Focus)

### 3.1 Bot Detection

```yaml
Threat: Automated bots playing the game
Risk: High (ruins experience for human players)

Bot_Indicators:
  - Perfect angle tracking (no human mouse jitter)
  - Inhuman reaction time (< 50ms direction changes)
  - Unnatural movement patterns (always optimal)
  - No idle time (humans pause occasionally)

Detection_Strategy:
  - Input pattern analysis:
    - Human: angle changes are noisy, small random variations
    - Bot: angle changes are mathematically precise
  - Timing analysis:
    - Human: variable input intervals (30-100ms)
    - Bot: exact intervals (16.67ms or 33.33ms)
  - Behavioral heuristics:
    - Perfect orb collection paths (unlikely for humans)
    - Never dying to boundaries (always perfect avoidance)

Mitigation:
  - Soft detection: flag suspicious accounts for review
  - Hard detection: kick + temporary IP ban (30 minutes)
  - Future: ML-based pattern recognition
```

### 3.2 Aim Assist / Auto-Steering

```yaml
Threat: Client-side scripts that auto-steer to avoid collisions
Risk: Medium

Mitigation:
  - Server-Authoritative movement (client can only request angle)
  - TURN_RATE limit prevents instant 180° turns
  - Input jitter analysis (too-smooth = suspicious)
  - Accept but monitor: aim assist is hard to fully prevent
    in angle-based games; focus on bots instead
```

### 3.3 Zoom/Vision Hacks

```yaml
Threat: Client modifies viewport to see more of the map
Risk: Low (mitigated by viewport culling)

Mitigation:
  - Server only sends entities within calculated viewport
  - Even if client renders wider view, no additional data available
  - Server-side viewport calculation based on player's mass/zoom
```

---

## 4. Input Validation Rules

```typescript
// Server-side input validation
function validateInput(input: InputPayload): boolean {
  // 1. Angle range
  if (input.a < 0 || input.a > Math.PI * 2) return false;

  // 2. Boost flag
  if (input.b !== 0 && input.b !== 1) return false;

  // 3. Sequence number (monotonically increasing)
  if (input.s <= lastSequence) return false;

  // 4. Rate limit (max 30/second per player)
  if (inputCountThisSecond >= 30) return false;

  return true;
}
```

---

## 5. Security Architecture Summary

```
┌─────────────────────────────────────────┐
│           Security Layers                │
│                                          │
│  Layer 1: Transport (TLS/WSS)            │
│  Layer 2: Authentication (Supabase JWT)  │
│  Layer 3: Rate Limiting (30/s input)     │
│  Layer 4: Input Validation (angle/boost) │
│  Layer 5: Server-Authoritative Logic     │
│  Layer 6: Viewport Culling (anti-hack)   │
│  Layer 7: Behavioral Analysis (anti-bot) │
│  Layer 8: Audit Logging (game sessions)  │
└─────────────────────────────────────────┘
```

---

*Generated by DAVINCI /da:system v2.0*
