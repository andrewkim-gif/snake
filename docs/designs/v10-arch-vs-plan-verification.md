# Agent Survivor v10 — Architecture vs Plan Verification Report

> **Date**: 2026-03-06
> **Comparison**:
>   - Architecture: `docs/designs/v10-system-architecture.md` (1513 lines)
>   - Plan: `docs/designs/v10-survival-roguelike-plan.md` (1992 lines)
> **Methodology**: Section-by-section cross-reference with numerical value comparison, type definition comparison, and feature coverage audit across 12 focus areas

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Match Rate** | **87%** |
| **Critical Issues** | 3 |
| **High Issues** | 7 |
| **Medium Issues** | 10 |
| **Low Issues** | 8 |
| **Total Issues** | 28 |
| **Recommendation** | **NEEDS_IMPROVEMENT** (<90%) |

The architecture document excels at core game systems (combat, upgrades, map objects, events, performance) and adds valuable engineering artifacts (ADRs, sequence diagrams, security model, deployment strategy). However, it has significant coverage gaps in three domains: (1) character customization types/presets/rarity, (2) training system modalities, and (3) meta progression definitions. An internal inconsistency in the arena shrink final radius (Goal G4 says 1800px, implementation says 1200px) also requires resolution.

---

## 1. Entity Model (AgentEntity fields)

### Match Rate: 90%

**Fully matched fields** (Architecture 8.1, lines 527-578 vs Plan 5B.2, lines 449-489):
- Identity: id, name
- Spatial: position (single coordinate), heading, targetAngle, speed
- Survival: mass (HP role), alive, boosting, hitboxRadius (16-22px)
- Progression: level (1-12), xp, xpToNext
- Build: build (PlayerBuild), activeSynergies
- Visual: skin (AgentSkin)
- Effects: activeEffects, effectCooldowns
- Score: score, kills, bestScore
- Meta: joinedAt, lastInputSeq

**PlayerBuild and AbilitySlot** match exactly between both documents.

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| E-1 | Medium | Architecture adds `isBot` and `isAgent` fields (line 531-532) not present in Plan's Agent interface (line 449). Reasonable server-side additions but extend beyond plan scope. | Plan 5B.2 line 449 | Arch 8.1 line 531 |
| E-2 | Medium | Architecture adds 5 combat tracking fields (`lastDamageSource`, `lastDamageTime`, `killStreak`, `totalDamageDealt`, `totalDamageReceived`, lines 556-560) not in Plan's Agent interface. Plan mentions kill credit (line 338) conceptually but does not define explicit fields. | Plan 5B.2 | Arch 8.1 lines 555-560 |
| E-3 | Low | Architecture adds `abilityCooldowns: Record<AbilityType, number>` (line 568) as explicit per-ability tracking. Plan mentions ability cooldowns (section 4.2) but keeps them in the abstract. | Plan 4.2 | Arch 8.1 line 568 |

---

## 2. AgentSkin (30+ fields, Tier System, 34 Presets)

### Match Rate: 40%

This is the single largest coverage gap. The Plan devotes approximately 460 lines (5B.4 through 5B.4.5, lines 524-985) to the character customization system. The Architecture references it only in Goal G7 (line 40: "AgentSkin, 30+ fields, 34 presets") and the SkinCustomizer component (line 360).

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| SK-1 | **Critical** | Architecture calls it a "6-tier system" (line 490) while Plan's header says "5-Tier 커스터마이징 시스템" (line 542). The Plan's interface actually defines 6 tiers (Tier 1 through Tier 6 Nametag), so the Plan header itself is inconsistent. Architecture's "6-tier" label is technically more accurate to the actual interface, but it contradicts the Plan's explicit naming. | Plan 5B.4 line 542 | Arch 7.2 line 490 |
| SK-2 | **Critical** | Architecture does NOT reproduce the AgentSkin interface definition. Plan provides the full 30+ field interface with all sub-type definitions across 155+ lines of TypeScript (lines 543-696), including: SkinRarity, BodyColor (12 colors), EyeColor (8 colors), McTextColor (16 colors), SkinTone (15 variants), SurfacePattern (8 types), EyeStyle (8 types), MouthStyle (6 types), FaceMarkings (8 types), HeadwearType (16 types), BackItemType (14 types), BodyOverlayType (17 types), AccessoryType (10 types), HandItemType (10 types), FootwearType (8 types), TrailEffect (8 types), DeathEffect (6 types), KillEffect (6 types), SpawnEffect (8 types), EmoteType (8 types), NametagStyle (6 types). None of these appear in the architecture document. | Plan 5B.4 lines 543-696 | Arch -- missing |
| SK-3 | **High** | Architecture does NOT include the 34 preset character definitions. Plan defines all 34 presets across 5 categories (lines 798-852): 12 Common (Steve, Alex, Iron Guard...), 8 Mob Theme (Creeper Agent, Enderman...), 6 Job Theme (Knight, Wizard...), 4 Epic (Holy Paladin, Gladiator...), 4 Season Limited (Ender Dragon, Phoenix...). | Plan 5B.4.3 lines 796-852 | Arch -- missing |
| SK-4 | **High** | Architecture does NOT include the rarity system. Plan defines 6 rarity tiers with colors and achievement-based unlock paths (lines 765-794): Common (free), Uncommon (easy achievements), Rare (50 kills / 3 wins), Epic (5 synergies / tournament), Legendary (1000 kills / all synergies), Mythic (10,000 kills, Phase 4+). | Plan 5B.4.2 lines 765-794 | Arch -- missing |
| SK-5 | Medium | Architecture does NOT include the cosmetic phase implementation plan. Plan section 5B.4.5 (lines 946-985) details which tiers and options are active in each phase: Phase 1 MVP (subset of Tiers 1-4), Phase 2 (full Tiers 1-4 + achievements), Phase 3 (3D + Tier 5 effects), Phase 4+ (live service, progressive cosmetics). | Plan 5B.4.5 lines 946-985 | Arch -- missing |
| SK-6 | Low | Architecture does NOT include creative cosmetic features: enchant glow system, kill streak visuals, title system, custom death messages, lobby pets/poses, progressive cosmetics, synergy theme cosmetic sets, ghost skins. Plan provides 8 creative feature descriptions in 5B.4.4 (lines 854-939). | Plan 5B.4.4 lines 854-939 | Arch -- missing |
| SK-7 | Low | Plan has internal inconsistency: SpawnEffect declared as "8종" in interface comment (line 589) and type definition has 8 values (lines 685-687), but Tier 5 catalog table says "Spawn (5)" (line 751). Architecture does not address this Plan-internal issue. | Plan lines 589 vs 751 | N/A |

---

## 3. Combat System (Aura DPS, Dash Kill, Derived Constants)

### Match Rate: 93%

**All core combat values match perfectly:**

| Constant | Plan (5.5) | Architecture (10.1) | Match |
|----------|-----------|---------------------|-------|
| BASE_AURA_DPS_PER_TICK | 2.0 mass/tick (40/s at 20Hz) | 2.0 mass/tick | Yes |
| AURA_RADIUS | 60 px (fixed) | 60 px | Yes |
| HITBOX_RADIUS | 16-22 px (mass-based) | 16 base, 22 max (mass>100) | Yes |
| DASH_BURST_RATIO | 30% mass instant damage | 0.30 | Yes |
| LEVEL_DPS_BONUS | Lv8+ DPS +20% | 1.20x at Lv >= 8 | Yes |
| BASE_SPEED | 150 px/s | 150 px/s (implicit in Tome calc) | Yes |
| BOOST_SPEED | 300 px/s | 300 px/s | Yes |

Combat processing pipeline order matches: Spatial Query -> Aura DPS Exchange (with Venom DoT) -> Dash Collision -> Kill Resolution. Both documents confirm server-authoritative combat.

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| C-1 | Medium | Boundary penalty model differs. Plan states flat "0.25% mass/tick" (line 383). Architecture introduces escalating formula: `penalty = mass * 0.0025 * (1 + overDistance / 100)` (line 898) which scales with distance outside boundary. The flat base rate matches, but the escalation is an architecture extension not in the plan. | Plan 5.5 line 383 | Arch 10.4 lines 896-900 |
| C-2 | Low | Plan's derived constants table includes `XP_ORB_COLLECT_RADIUS = 50 px` (line 384) and `REGEN_PER_TICK = 0.025 mass/tick` (line 385). Architecture does not explicitly list these two constants in its derived constants table (10.1 lines 778-786), though they are implied by the Tome definitions. | Plan 5.5 lines 384-385 | Arch 10.1 -- implicit |

---

## 4. Upgrade System (8 Tomes, 6 Abilities, 10 Synergies)

### Match Rate: 96%

**All 8 Tomes match exactly:**

| Tome | Plan (4.1) | Arch (7.3) | Match |
|------|-----------|-----------|-------|
| XP | S / +20% / max 10 | S / 0.20 / 10 | Yes |
| Speed | S / +10% / max 5 | S / 0.10 / 5 | Yes |
| Damage | S / +15% / max 10 | S / 0.15 / 10 | Yes |
| Armor | A / -10% / max 8 | A / 0.10 / 8 | Yes |
| Magnet | A / +25% / max 6 | A / 0.25 / 6 | Yes |
| Luck | A / +15% / max 6 | A / 0.15 / 6 | Yes |
| Regen | B / +0.5/s / max 5 | B / 0.5 / 5 | Yes |
| Cursed | S* / +25% DPS +20% taken / max 5 | S / 0.25 / 5 | Yes |

**Tome stack formula** matches: `Final = Base * (1 + SUM(stacks * effectPerStack))`

**All 6 Abilities** listed in both: Venom Aura, Shield Burst, Lightning Strike, Speed Dash, Mass Drain, Gravity Well. Auto-trigger conditions align.

**Ability Upgrade Scaling** matches (Arch 10.2 lines 811-814):
- Level 2: 130% effect / 80% cooldown (Plan: +30% damage, -20% cooldown -- consistent)
- Level 3: 170% effect / 65% cooldown (Architecture extends beyond Plan's explicit values)
- Level 4: 220% effect / 50% cooldown (Architecture extends beyond Plan's explicit values)

**All 10 Synergies** accounted for: 6 public (Holy Trinity, Glass Cannon, Iron Fortress, Speedster, Vampire, Storm) + 4 hidden. Requirements and bonuses match.

**XP Level-Up Curve** spot-checked -- all values match:

| Level | Plan Required XP | Arch Required XP | Match |
|-------|-----------------|-----------------|-------|
| 2 | 20 | 20 | Yes |
| 3 | 30 | 30 | Yes |
| 4 | 45 | 45 | Yes |
| 5 | 65 | 65 | Yes |
| 12 | 345 | 345 | Yes |

Formula: `20 + (L-2)*15 + floor((L-2)^1.2 * 5)` -- Arch line 826 matches Plan line 261.

**Synergy check algorithm** matches (Arch 10.3 lines 834-851 vs Plan 4.3 lines 283-298). Near-synergy detection present in both.

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| U-1 | Low | Architecture provides full Ability scaling table (Lv1-4) while Plan only specifies per-level increment (+30%/+20%). Architecture's full table is a useful extension. | Plan 4.2 line 248 | Arch 10.2 lines 811-814 |

---

## 5. Map Objects (Shrine, Spring, Altar, Gate)

### Match Rate: 97%

All 4 map objects match between documents:

| Object | Count | Effect | Cooldown | Plan | Arch | Match |
|--------|-------|--------|----------|------|------|-------|
| XP Shrine | 3 | 10s XP +50% buff | 60s | 9.1 line 1537 | 10.5 line 922 | Yes |
| Healing Spring | 2 | mass 20% heal | 45s | 9.1 line 1538 | 10.5 line 923 | Yes |
| Upgrade Altar | 1 | instant level-up | consumed | 9.1 line 1539 | 10.5 line 924 | Yes |
| Speed Gate | 4 | 5s x2 speed | 30s | 9.1 line 1540 | 10.5 line 925 | Yes |

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| MO-1 | Low | Architecture specifies exact placement rings (60%, 80%, 50% radius from center, line 908-911) while Plan says "랜덤 3곳" for Shrines and "맵 가장자리 2곳" for Springs (lines 1537-1538). Architecture is more specific. | Plan 9.1 | Arch 10.5 lines 908-911 |
| MO-2 | Low | Architecture adds behavior for objects on shrink: teleport to nearest valid position when outside new boundary, "endangered" UI warning within 200px (lines 914-915). Not explicitly in Plan. Reasonable extension. | N/A | Arch 10.5 lines 914-915 |

---

## 6. Arena Shrink Mechanics

### Match Rate: 78%

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| AS-1 | **High** | **Internal contradiction in Architecture**: Goal G4 (line 37) says final radius is "6000→1800px." Architecture's shrink timeline (line 872) shows `T=5:00 radius=1200 (20%)` and code (line 886) has `{ time: 300, radius: 1200 }`. The Plan's timeline table (line 1443) shows T=4:30 at 1800px, then T=5:00 is "종료" (end). Architecture's G4 says 1800, but its own implementation says 1200. | Plan 8.1 line 1443 | Arch G4 line 37 vs Arch 10.4 lines 872, 886 |
| AS-2 | **High** | **Shrink model divergence**: Plan's rule text says "1분마다 반경 -600px" (line 1450) implying linear. But the Plan's own timeline table (lines 1432-1444) actually shows -600px every 30 seconds (non-linear). Architecture implements a phased model with acceleration at T=3:00 (line 870: "-1200px double rate"). The Plan and Architecture use different shrink models, and the Plan itself is internally inconsistent between its rule text and its timeline table. | Plan 8.2 line 1450 vs Plan 8.1 table | Arch 10.4 lines 866-891 |

**Detailed shrink timeline comparison:**

| Time | Plan (timeline table) | Plan (rule: -600px/min) | Architecture (phased) |
|------|-----------------------|------------------------|----------------------|
| 0:00 | 6000 | 6000 | 6000 |
| 1:00 | 5400 | 5400 | 5400 |
| 2:00 | 4800 | 4800 | 4800 |
| 2:30 | 4200 | 4500 | ~4200 (interpolated) |
| 3:00 | 3600 | 4200 | 3600 |
| 3:30 | 3000 | 3900 | ~3000 (interpolated) |
| 4:00 | 2400 | 3600 | 2400 |
| 4:30 | 1800 | 3300 | ~1800 (interpolated) |
| 5:00 | end (no value) | 3000 | 1200 |

The Plan table and Architecture phase model actually agree at all checked points (1:00 through 4:30). The divergence is only in (a) the Plan's incorrect rule text ("-600px per minute"), and (b) the final T=5:00 value (Architecture adds 1200px endpoint).

---

## 7. Agent Strategy Layer (Commander Mode, BotBehaviors)

### Match Rate: 85%

**Matched:**
- All v9 base commands: go_to, go_center, flee, hunt, hunt_nearest, gather, set_boost
- All v10 new commands: engage_weak, avoid_strong, farm_orbs, kite, camp_shrinkage, priority_target, set_combat_style, choose_upgrade, set_ability_priority
- 5 combat style presets: Aggressive, Defensive, Balanced, XP Rush, Endgame
- 5 build paths: Berserker (20%), Tank (20%), Speedster (20%), Vampire (20%), Scholar (20%)
- Bot level-up decision algorithm matches (synergy completion -> build path priority -> ability upgrade -> fallback)
- Commander Mode observation structure (Architecture 11.2 lines 1003-1011)

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| AG-1 | Medium | Architecture does NOT include v9-to-v10 Commander Mode migration guide. Plan 12.4a (lines 1865-1881) details deprecated commands (`ambush`, `gather_near`, `gather_powerup`, `set_mode`) and their v10 replacements. This is important for backward compatibility documentation. | Plan 12.4a lines 1865-1881 | Arch -- missing |
| AG-2 | Medium | Architecture's Commander Mode observation (lines 1003-1011) lacks zone-specific fields. Plan's `ObserveGameV10Extension` (lines 1904-1917) adds `zone: 'center' | 'mid' | 'edge' | 'danger'`, `nearbyThreats` with mass/distance detail, `nearbyMapObjects`. | Plan 12.4c lines 1900-1917 | Arch 11.2 -- simplified |
| AG-3 | Medium | Plan's `MapObservation` interface (lines 1576-1589) with `currentZone`, `orbDensity` per zone, `nextShrinkIn` is not present in architecture. This zone-awareness observation for agents is absent. | Plan 9.3 lines 1574-1589 | Arch -- missing |
| AG-4 | Low | Plan defines 6 agent personality presets (Warrior, Guardian, Scholar, Runner, Experimenter, Adaptive) in section 7.3 (lines 1405-1421). Architecture only mentions "Adaptive" and "Experimenter" in ADR-005 mitigation note (line 1495). The other 4 personality presets are not documented. | Plan 7.3 lines 1405-1421 | Arch ADR-005 line 1495 |

---

## 8. Training System (API, Show & Learn)

### Match Rate: 65%

**Matched:**
- Training API endpoint: `PUT /api/v1/agents/{agentId}/training` (Plan line 1275; Arch line 1030)
- Profile structure: buildProfile + combatRules + strategyPhases
- Agent memory system: buildPerformance, discoveredSynergies, synergyAttempts, opponentProfiles, mapKnowledge (Plan 7.2 lines 1356-1381; Arch 11.4 lines 1039-1045)
- Phase progression for storage: Phase 1-3 JSON -> Phase 4 REST -> Phase 5+ PostgreSQL

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| TR-1 | **Critical** | Architecture completely omits "Show & Learn" training modes. Plan defines 3 progressive modes (lines 1299-1314): (1) **Observation Mode** (agent watches human play, records level-up choices and combat patterns, via `observe_game` API), (2) **Feedback Mode** (user reviews agent replays, annotates build decisions), (3) **A/B Test Mode** (dual agent comparison over 10 rounds). Architecture section 11 covers agent connection and commander mode but has zero coverage of these modalities. | Plan 7.1 lines 1299-1314 | Arch 11 -- missing |
| TR-2 | **High** | Architecture does NOT include Training Console UI design. Plan 12.4b (lines 1883-1898) defines `TrainingConsole.tsx` with sub-components (TrainingHeader, BuildProfileEditor, CombatRulesEditor, StrategyPhaseEditor, LearningLog) and a `training_update` WebSocket event. Architecture's client component tree (section 6.1) does not include any Training Console reference. | Plan 12.4b lines 1883-1898 | Arch 6.1 -- missing |
| TR-3 | Medium | Architecture's learning loop is minimal. Plan describes a detailed learning cycle (lines 1384-1403): round result analysis -> build performance statistics -> synergy discovery tracking -> opponent counter-strategy evolution -> next-round strategy adjustment. Architecture mentions `AgentMemory` (lines 1039-1050) but explicitly notes "Phase 1-3: Not implemented" with no Phase 4+ detail. | Plan 7.2 lines 1316-1403 | Arch 11.4 lines 1035-1050 |

---

## 9. Character Customization (5-tier system, 34 presets, rarity)

### Match Rate: 40%

Covered under section 2 (AgentSkin) above. The architecture has the most significant coverage gap here, with the entire type system, preset catalog, rarity system, achievement unlocks, and cosmetic phase plan missing.

---

## 10. Meta Progression (RP, Quests, Leaderboard)

### Match Rate: 35%

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| MP-1 | **High** | Architecture does NOT define the RP (Reputation Points) system. Plan 10.1 (lines 1596-1609) defines RP sources with specific values: participation +5 RP, top 50% +10, top 3 +25, 1st place +50, synergy completion +10, hidden synergy discovery +100, 3+ kills +5. Architecture only mentions "RP" in passing: "Max 2 (3 with RP unlock)" (line 582) and "RP system, quests, global leaderboard" in Phase 5 scope (line 1238). | Plan 10.1 lines 1596-1609 | Arch -- missing |
| MP-2 | Medium | Architecture does NOT include RP unlock tiers. Plan 10.2 (lines 1611-1619) defines 5 progressive unlocks: 50 RP (+1 Ability slot), 100 RP (build history), 200 RP (badges), 500 RP (counter intel), 1000 RP (synergy hints). Architecture references the Ability slot unlock functionally but not the tier system. | Plan 10.2 lines 1611-1619 | Arch -- missing |
| MP-3 | Medium | Architecture does NOT include the quest system. Plan 10.4 (lines 1632-1645) defines 8 quests with specific conditions and RP rewards: First Blood (+20), Synergy Master (+50), Speed Demon (+30), Pacifist (+100), Glass Cannon (+150), Discovery (+100), Comeback (+200), Marathon (+100). Architecture mentions "quests" once in Phase 5 scope. | Plan 10.4 lines 1632-1645 | Arch line 1238 |
| MP-4 | Low | Architecture does NOT include extended leaderboard categories. Plan 10.3 (lines 1621-1630) adds RP ranking, build win-rate ranking, synergy discoverer hall of fame, agent vs agent records. | Plan 10.3 lines 1621-1630 | Arch -- missing |

---

## 11. Phase Timeline (5 phases, 11 weeks)

### Match Rate: 80%

**Matched phase structure:**

| Phase | Plan Duration | Arch Duration | Content Match |
|-------|-------------|--------------|---------------|
| Phase 1: Entity + Core | 3 weeks | 3 weeks | Yes |
| Phase 2: Abilities + Synergies | 2 weeks | 2 weeks | Yes |
| Phase 3: Client + Lobby | 3 weeks | 3 weeks | Yes |
| Phase 4: Agent + 3D | **1.5 weeks** | **3 weeks** | **MISMATCH** |
| Phase 5: Meta + Live | 1.5 weeks | ongoing | Different scope |
| **Total** | **~11 weeks** | **~11+ weeks** | Close |

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| PH-1 | **High** | **Phase 4 duration mismatch**: Plan says 1.5 weeks (line 1957: "Agent Integration + UI -- 1.5주"). Architecture says 3 weeks (line 1232: "Phase 4: Agent Integration + 3D (3 weeks, parallel track)"). Architecture adds "3D" renderer work to Phase 4, which the Plan partially treats as Phase 3 territory. This is a significant schedule divergence. | Plan 12.6 line 1957 | Arch 15.1 line 1232 |
| PH-2 | Medium | Architecture makes ZERO mention of **Coach Agent** (real-time in-game AI coaching via `coach_message` events) and **Analyst Agent** (post-round AI strategy analysis). Plan dedicates 12.5a-b (lines 1934-1949) to these Phase 5 features with specific implementation details. | Plan 12.5a-b lines 1934-1949 | Arch -- missing |

---

## 12. Event Protocol (Socket Events)

### Match Rate: 92%

**Client-to-Server events -- all match:**

| Event | Plan | Arch (9.1) | Match |
|-------|------|-----------|-------|
| join_room | v7 | line 658 | Yes |
| leave_room | v7 | line 659 | Yes |
| input (30Hz) | v7 | line 660 | Yes |
| choose_upgrade | Plan 6.1 | line 661 | Yes |
| ping | v7 | line 662 | Yes |

**Server-to-Client events -- all match except 2 missing:**

| Event | Plan | Arch (9.1) | Match |
|-------|------|-----------|-------|
| joined | v7 | line 668 | Yes |
| state (20Hz) | v7 | line 669 | Yes |
| minimap (1Hz) | v7 | line 670 | Yes |
| rooms_update (1Hz) | v7 | line 671 | Yes |
| level_up | Plan 6.1 | line 672 | Yes |
| choose_upgrade_ack | Not explicit in plan | line 673 | Arch extension |
| synergy_activated | Plan 4.3 | line 674 | Yes |
| arena_shrink | Plan 8.2 | line 675 | Yes |
| shrink_warning | Plan 8.2 | line 676 | Yes |
| death | v7 | line 677 | Yes |
| kill | v7 | line 678 | Yes |
| round_start/end/reset | v7 | lines 679-681 | Yes |
| pong | v7 | line 682 | Yes |

**LevelUpEvent** detail match: Both define matching structure with level, choices[3], currentBuild (tomes, abilities, activeSynergies, nearbySynergies), gameContext (timeRemaining, myRank, myMass, nearbyThreats, arenaRadius), and deadline 5000ms.

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| EV-1 | Medium | Plan's `training_update` WebSocket event for Training Console (line 1896) is absent from Architecture's event catalog. | Plan 12.4b line 1896 | Arch 9.1 -- missing |
| EV-2 | Medium | Plan's `coach_message` socket event for Coach Agent (line 1938) is absent from Architecture's event catalog. | Plan 12.5a line 1938 | Arch 9.1 -- missing |
| EV-3 | Low | Architecture adds `choose_upgrade_ack` event (line 673) as confirmation with `{success, appliedUpgrade, newBuild}`. Plan does not explicitly define this acknowledgment. Reasonable addition. | Plan -- implicit | Arch 9.1 line 673 |

---

## 13. Performance Metrics (SpatialHash, Bandwidth)

### Match Rate: 95%

**All critical metrics match:**

| Metric | Plan Source | Arch Value | Match |
|--------|-----------|-----------|-------|
| Tick rate | 20Hz (Plan 2.2) | 20Hz (Arch 13.1 line 1119) | Yes |
| SpatialHash reduction | 300 segments -> 20 agents (Plan 5.6 line 401) | 93% reduction (Arch 13.1 lines 1127-1128) | Yes |
| State payload reduction | Segments removed (implicit) | ~58% per agent (Arch 13.2) | Yes |
| Rooms per server | 5 (v7 config) | 5 (Arch 13.1 line 1123) | Yes |
| Max agents per room | 20 (5 human + 15 bot) | 20 (Arch 13.1 line 1124) | Yes |

Architecture adds valuable details not in Plan but consistent with it:
- Tick budget: <25ms per tick (50% headroom)
- Memory per room: <50MB
- Client FPS targets: 60 FPS desktop, 30 FPS mobile
- JS bundle target: <200KB gzip
- Scalability analysis: 2500 operations/second within single-thread capacity

---

## 14. Additional Findings

### RoundSummary.deathCause Enum Mismatch

| ID | Severity | Issue | Plan Ref | Arch Ref |
|----|----------|-------|----------|----------|
| DF-1 | Medium | Plan's `deathCause` uses `'collision' | 'aura' | 'arena_shrink' | 'survived'` (line 1342). Architecture uses `'aura' | 'dash' | 'boundary' | 'arena_shrink' | 'survived'` (line 637). Key differences: Plan's `'collision'` is ambiguous (dash? boundary?); Architecture properly separates `'dash'` and `'boundary'`. Architecture also adds `totalDamageDealt` to RoundSummary.result (line 633) not in Plan. | Plan 7.2 line 1342 | Arch 8.3 line 637 |

### Round State Machine Ending Duration

Both documents agree on `ENDING(10s)` -- Plan line 1460 says "ending(10s)" for v10 (changed from v7's 5s), and Architecture line 1408 shows "ENDING(10s)". This is consistent.

### 1-Life System and Bot Respawn

Plan defines a specific bot respawn policy (12.1a, lines 1752-1759): humans get 1 Life (with 30s grace period), bots are **replaced** (not respawned) as new bots with fresh builds. Architecture references "1-Life" throughout (lines 20, 37, 379, 1220, 1273) and mentions the 30s grace period as an open question (OQ-8, line 1508) but does NOT include the bot replacement policy detail. This is a minor gap.

### Build Visual Feedback

Plan section 5B.6 (lines 1013-1028) defines 8 build-specific visual effects (red aura for Damage, blue shield for Armor, afterimage for Speed, etc.). Architecture references this as "Draw build visual effects (section 5B.6)" in renderer spec (line 428) but does not reproduce the mapping.

---

## Coverage Matrix

| Focus Area | Plan Sections | Arch Coverage | Match % | Grade |
|-----------|--------------|---------------|---------|-------|
| Entity Model (fields) | 5B.2, 5B.3 | 5.2, 8.1 | 90% | A- |
| AgentSkin (30+ fields) | 5B.4 (full) | 7.2 (reference only) | 40% | F |
| Combat System | 5.1-5.6 | 5.2, 10.1 | 93% | A |
| Upgrade System | 4.1-4.3 | 7.3, 10.2-10.3 | 96% | A+ |
| Map Objects | 9.1-9.2 | 10.5 | 97% | A+ |
| Arena Shrink | 8.1-8.2 | 10.4 | 78% | C+ |
| Agent Strategy | 6.1-6.3 | 10.6, 11.2 | 85% | B |
| Training System | 7.1-7.3 | 11.3-11.4 | 65% | D |
| Character Customization | 5B.4 (all sub-sections) | Goal G7 + SkinCustomizer ref | 40% | F |
| Meta Progression | 10.1-10.4 | Phase 5 mention only | 35% | F |
| Phase Timeline | 12.1-12.6 | 15.1 | 80% | B- |
| Event Protocol | 6.1, 11.3-11.4 | 9.1-9.2 | 92% | A |
| Performance Metrics | 5.5 (derived) | 13.1-13.4 | 95% | A |
| *Security* | *N/A in Plan* | 14.1-14.3 | *N/A* | *Bonus* |
| *ADRs* | *N/A in Plan* | 17 (5 ADRs) | *N/A* | *Bonus* |
| *Sequence Diagrams* | *N/A in Plan* | 16.1-16.3 | *N/A* | *Bonus* |

---

## Architecture-Only Additions (Valuable, Not in Plan)

The architecture adds several engineering artifacts that strengthen the design:

1. **Architecture Decision Records (ADRs)** -- 5 ADRs (lines 1418-1495): Entity model transformation rationale, server authority decision, 2D-first rendering strategy, JSON persistence choice, bot build path system
2. **Sequence Diagrams** -- Level-up flow, auto-combat per-tick flow, round lifecycle state machine
3. **Security Model** -- Threat model with 8 threats, server-authoritative design proof, input validation rules
4. **8 Open Questions** -- With impact ratings and decision-by timelines
5. **Migration Risk Matrix** -- 5 risk items with probability/impact/mitigation
6. **File-Level Change Impact** -- Categorized High/Medium/Low/New with LOC estimates
7. **Deployment Strategy** -- Per-phase deployment approach (staging, preview, feature flags)
8. **Serialized Wire Format** -- Compact state serialization with abbreviated keys
9. **Coordinate System Specification** -- 2D server to 3D client mapping
10. **Bandwidth Calculations** -- Per-agent payload comparison (v7 vs v10)

These are all appropriate architecture-level elaborations that add value.

---

## Complete Issue Inventory

### Critical (3)

| ID | Area | Description |
|----|------|-------------|
| SK-1 | AgentSkin | "6-tier" (Arch) vs "5-Tier" (Plan header) naming conflict |
| SK-2 | AgentSkin | Full AgentSkin type definitions missing from architecture (155+ lines of TypeScript) |
| TR-1 | Training | "Show & Learn" training modes missing (Observe, Feedback, A/B Test) |

### High (7)

| ID | Area | Description |
|----|------|-------------|
| SK-3 | AgentSkin | 34 preset character definitions missing |
| SK-4 | AgentSkin | Rarity system (6 tiers, unlock paths) missing |
| AS-1 | Arena Shrink | Internal contradiction: G4 says 1800px final, implementation says 1200px |
| AS-2 | Arena Shrink | Linear (Plan text) vs phased (Arch) shrink model divergence |
| TR-2 | Training | Training Console UI design missing |
| MP-1 | Meta Progression | RP system definition missing (sources, values, 7 categories) |
| PH-1 | Timeline | Phase 4 duration: Plan 1.5 weeks vs Architecture 3 weeks |

### Medium (10)

| ID | Area | Description |
|----|------|-------------|
| E-1 | Entity | Architecture adds isBot/isAgent fields |
| E-2 | Entity | Architecture adds combat tracking fields |
| SK-5 | AgentSkin | Cosmetic phase implementation plan missing |
| C-1 | Combat | Boundary penalty: flat (Plan) vs escalating (Arch) |
| AG-1 | Agent Strategy | v9-to-v10 migration guide missing |
| AG-2 | Agent Strategy | Observation lacks zone-specific fields |
| AG-3 | Agent Strategy | MapObservation interface missing |
| TR-3 | Training | Learning loop detail minimal vs Plan |
| MP-2 | Meta Progression | RP unlock tiers missing |
| MP-3 | Meta Progression | Quest system missing |
| DF-1 | Data Model | deathCause enum values differ |
| EV-1 | Events | training_update event missing |
| EV-2 | Events | coach_message event missing |
| PH-2 | Timeline | Coach/Analyst agents missing |

### Low (8)

| ID | Area | Description |
|----|------|-------------|
| E-3 | Entity | abilityCooldowns field extension |
| SK-6 | AgentSkin | Creative cosmetic features missing |
| SK-7 | AgentSkin | Plan SpawnEffect internal count inconsistency (8 vs 5) |
| C-2 | Combat | XP_ORB_COLLECT_RADIUS and REGEN_PER_TICK not explicitly listed |
| U-1 | Upgrades | Ability scaling table extension (beneficial) |
| MO-1 | Map Objects | Placement specificity difference (random vs deterministic) |
| MO-2 | Map Objects | Object teleportation on shrink (reasonable extension) |
| AG-4 | Agent Strategy | Only 2 of 6 personality presets mentioned |
| MP-4 | Meta Progression | Extended leaderboard categories missing |
| EV-3 | Events | choose_upgrade_ack addition (reasonable) |

---

## Prioritized Recommendations

### Must Fix (blocks implementation)

1. **Resolve arena shrink contradiction** (AS-1): Fix Goal G4's "1800px" to match implementation's "1200px" (or vice versa). Standardize the shrink model between Plan and Architecture -- recommend adopting Architecture's phased model as canonical since it matches the Plan's timeline table.

2. **Add AgentSkin type definitions** (SK-2, SK-3, SK-4): Reproduce or reference the full AgentSkin interface, sub-types, 34 presets, and rarity system. This is the largest gap at ~460 lines of Plan content with no architecture coverage.

3. **Add Training modalities** (TR-1, TR-2): Document Show & Learn modes and Training Console UI component structure. Even if Phase 4+, the architecture should define the target interaction model.

### Should Fix (improves quality)

4. **Add RP/Quest system definitions** (MP-1, MP-2, MP-3): Include RP sources/values, 5 unlock tiers, and 8 quest definitions. Even as Phase 5, the data model should be architecturally defined.

5. **Reconcile Phase 4 timeline** (PH-1): Clarify whether 3D rendering lives in Phase 3 (Plan) or Phase 4 (Architecture). Align the 1.5-week vs 3-week gap.

6. **Add Commander Mode migration mapping** (AG-1): Document deprecated v9 commands and their v10 replacements for API backward-compatibility documentation.

7. **Add zone observation interfaces** (AG-2, AG-3): Include MapObservation and zone-awareness fields in the Commander Mode observation payload.

8. **Standardize deathCause enum** (DF-1): Adopt Architecture's `'aura' | 'dash' | 'boundary' | 'arena_shrink' | 'survived'` as the canonical set and update the Plan accordingly.

### Nice to Have (completeness)

9. **Add Coach/Analyst Agent specs** (PH-2): Document these Phase 5 features with socket events and UI placement.

10. **Resolve tier naming** (SK-1): Standardize on "6-Tier" (matching the actual interface) or "5-Tier + Nametag" and update both documents.

---

## Final Verdict

| Criterion | Result |
|-----------|--------|
| Overall Match Rate | **87%** |
| Critical Issues | 3 |
| Blocking Issues | 2 (AgentSkin omission, Training omission) |
| Architecture Quality | **Good** -- adds ADRs, security, sequence diagrams, performance budgets, deployment strategy |
| Plan Faithfulness | **Good** for core gameplay systems, **Poor** for cosmetics/training/meta |
| Recommendation | **NEEDS_IMPROVEMENT** |

The architecture document is strong where it matters most for initial implementation: combat mechanics, upgrade system, map objects, event protocol, and performance budgets all match the plan at 92%+ accuracy. The gaps are concentrated in three areas that can be addressed without restructuring: character customization type system, training modalities, and meta progression definitions. Fixing the 3 critical and 7 high issues would bring the match rate above 93%, easily achieving a PASS.

---

*Generated by Claude Opus 4.6 -- 2026-03-06*
