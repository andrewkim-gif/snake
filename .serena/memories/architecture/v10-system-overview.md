# v10 System Architecture Overview

## Key Architecture Decisions
1. **ADR-001**: Snake→Agent full entity rewrite (segments[] → position single)
2. **ADR-002**: 100% server-authoritative combat and upgrades
3. **ADR-003**: 2D Canvas first (Phase 1-3), R3F 3D migration (Phase 4+)
4. **ADR-004**: In-memory + JSON persistence (Phase 1-4), PostgreSQL (Phase 5+)
5. **ADR-005**: 5 bot build paths (Berserker/Tank/Speedster/Vampire/Scholar)

## New Server Modules
- `AgentEntity.ts` — replaces Snake.ts (position single, mass=HP, level/xp/build)
- `UpgradeSystem.ts` — Tome stacks + Ability slots + synergy engine (~250 LOC)
- `ArenaShrink.ts` — Arena radius reduction over 5 minutes (~60 LOC)
- `MapObjects.ts` — XP Shrine, Healing Spring, Upgrade Altar, Speed Gate (~100 LOC)
- `CollisionSystem.ts` — REWRITE: aura DPS exchange + dash burst + boundary penalty

## Phase 4 Server Modules (Meta + Coach/Analyst)
- `RPSystem.ts` — RP (Reputation Points) meta progression, unlock tracking, round-end RP awards
- `QuestSystem.ts` — Daily/weekly/milestone quests, progress tracking, RP rewards
- `CoachSystem.ts` — Real-time coaching (60-tick intervals), rate-limited tips per player
- `AnalystSystem.ts` — Post-round analysis (build/combat/positioning/XP scores, MVP stats, suggestions)

## Phase 4 Integration Points
- Arena: CoachSystem in game loop (step 10.5), consumeLastTickCoachMessages()
- Room: RPSystem, QuestSystem, AnalystSystem per room, processRoundEnd() on ending
- Broadcaster: coach_message (per-tick), round_analysis/rp_update/quest_update (round end)
- Shared: CoachMessagePayload, RoundAnalysisPayload, RPUpdatePayload, QuestUpdatePayload

## New Client Components
- `LevelUpOverlay.tsx` — 3 upgrade cards, 5s timer
- `BuildHUD.tsx` — Tome stacks + Ability slots display
- `XPBar.tsx` — Experience bar
- `ShrinkWarning.tsx` — Arena shrink countdown
- `SynergyPopup.tsx` — Synergy activation notification

## New Shared Types
- `Agent` (replaces `Snake`), `AgentSkin` (30+ fields), `PlayerBuild`
- `TomeType` (8 enums), `AbilityType` (6 enums), `SynergyDef` (10 defs)
- `UpgradeChoice`, `MapObject`, `SHRINK_CONFIG`, `UPGRADE_CONFIG`

## Architecture Doc Location
- `docs/designs/v10-system-architecture.md`
- `docs/adr/ADR-001-agent-entity-transformation.md`
- `docs/adr/ADR-002-server-authoritative-combat.md`
- `docs/adr/ADR-003-2d-first-rendering.md`
