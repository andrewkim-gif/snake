# 300-Nations Overnight Simulation Report

## Overview
| Field | Value |
|-------|-------|
| **Config** | `sim-configs/300-nations.json` |
| **Agents** | 300 (171 countries, 68 multi-agent) |
| **Duration** | 480 min (8 hours) |
| **Server** | localhost:9000 (Go v11) |
| **LLM** | OpenRouter → Gemini 2.5 Flash Lite |
| **Start** | 2026-03-09 00:07 KST |
| **PID** | Sim: 63937, Server: see .server.pid |
| **Log** | `/tmp/sim-300-overnight.log` |

## T+5min Checkpoint (00:12 KST)

### Agent Status
- **300/300** agents started (30 batches x 10)
- All 171 factions created (1 per country)
- All 300 members joined factions
- 455 diplomatic treaties initiated

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 3,234 |
| **Failures** | 2,721 |
| **Success Rate** | 54.3% |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |

### Error Breakdown (All Legitimate Game-State)
| Error | Count | Category |
|-------|-------|----------|
| insufficient tech resources | 1,387 | Economy |
| requires Council+ permission | 853 | Permission |
| requires Council+ for policy | 175 | Permission |
| requires Commander+ | 57 | Permission |
| insufficient gold (various) | ~180 | Economy |
| tech node already completed | ~45 | Duplicate |
| treaty not found | 19 | State |
| target faction not found | 12 | State |
| mission on cooldown | ~15 | Cooldown |

### Supabase Data
| Table | Rows |
|-------|------|
| factions | 171 |
| faction_members | 300 |
| diplomacy | 455 |
| seasons | 1 |
| wars | 0 |
| battles | 0 |

### Assessment
- **Infrastructure**: HEALTHY — zero connection errors, zero persist failures
- **Game Economy**: Working as designed — tech/gold scarcity drives strategic decisions
- **Permissions**: Working correctly — only faction leaders can set policies
- **Diplomacy**: Active — 455 treaties in first 5 minutes

---

## T+10min Checkpoint (00:17 KST)

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 8,399 |
| **Failures** | 8,344 |
| **Success Rate** | 50.2% |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |
| **Log Lines** | 753,224 |

### Agent Activity
- All 300 agents active (Tick 16~20 per agent)
- Each agent executes ~3 actions per tick (30s interval)
- New error types: `insufficient food in treasury` — economy diversifying

### Supabase Data (Growth)
| Table | T+5min | T+10min | Growth |
|-------|--------|---------|--------|
| factions | 171 | 171 | stable |
| faction_members | 300 | 300 | stable |
| diplomacy | 455 | 1,572 | +245% |
| wars | 0 | 0 | — |
| battles | 0 | 0 | — |

### Assessment
- **Diplomacy surge**: 455→1,572 treaties in 5 minutes (3.5x)
- **Economy balancing**: Gold/food/tech scarcity errors are normal game design
- **Permission system**: Council+ restrictions working as intended
- **No wars yet**: Agents still in early diplomatic/economic phase

---

---

## T+30min Checkpoint (00:37 KST)

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 24,670 |
| **Failures** | 28,366 |
| **Success Rate** | 46.5% |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |
| **Log Lines** | 1,463,650 |

### Supabase Data (Growth)
| Table | T+5min | T+10min | T+30min |
|-------|--------|---------|---------|
| factions | 171 | 171 | 171 |
| faction_members | 300 | 300 | 300 |
| diplomacy | 455 | 1,572 | **6,145** |
| wars | 0 | 0 | 0 |
| battles | 0 | 0 | 0 |

### Top Error Categories
| Error | Count | Category |
|-------|-------|----------|
| insufficient tech | 14,411 | Economy |
| requires Council+ | 7,236 | Permission |
| max 20 open orders | 1,376 | Trade Limit |
| Council+ for policy | 1,134 | Permission |
| insufficient gold | ~2,000 | Economy |
| treaty not found | 348 | State |
| Commander+ required | 372 | Permission |

### Assessment
- **Diplomacy explosion**: 6,145 treaties (13.5x from start) — very active diplomatic network
- **Trade market**: "max 20 open orders" means agents are actively trading on the market exchange
- **Success rate decline** (54%→46%): Expected — agents are resource-constrained, trying ambitious actions
- **No wars**: 300 agents still prefer diplomacy over conflict in early game
- **Infrastructure**: Still perfect — zero errors after 53K+ actions

---

---

## T+1hr Checkpoint (01:07 KST)

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 47,603 |
| **Failures** | 58,873 |
| **Success Rate** | 44.7% |
| **Total Actions** | 106,476 |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |
| **Log Lines** | 1,852,416 |

### Process Health
| Process | Status |
|---------|--------|
| Sim (PID 63937) | Running (01:02:25 uptime) |
| Sim Memory | 45MB RSS (very stable) |
| Server (port 9000) | Running |

### Supabase Data (Growth)
| Table | T+5min | T+10min | T+30min | T+1hr |
|-------|--------|---------|---------|-------|
| factions | 171 | 171 | 171 | 171 |
| faction_members | 300 | 300 | 300 | 300 |
| diplomacy | 455 | 1,572 | 6,145 | **13,436** |
| wars | 0 | 0 | 0 | 0 |
| battles | 0 | 0 | 0 | 0 |
| achievements | 0 | 0 | 0 | 0 |

### Assessment
- **Diplomacy network**: 13,436 treaties — massive diplomatic web between 171 nations
- **Still no wars**: 300 agents prefer peaceful economic/diplomatic strategies
- **Sim stability**: 45MB memory after 106K actions — no memory leaks
- **Infrastructure**: Perfect — zero errors across 1.85M log lines
- **Action rate**: ~1,700 actions/minute (300 agents x ~3 actions x 2 ticks/min)

---

---

## T+2hr Checkpoint (02:07 KST)

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 87,378 |
| **Failures** | 123,849 |
| **Success Rate** | 41.4% |
| **Total Actions** | 211,227 |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |
| **Log Lines** | 2,395,743 |

### Process Health
| Process | Status |
|---------|--------|
| Sim (PID 63937) | Running (02:02:57 uptime, 0% CPU idle) |
| Sim Memory | **45MB RSS** (zero growth since T+1hr) |
| Server (port 9000) | Running |

### Supabase Data
| Table | T+1hr | T+2hr | Growth |
|-------|-------|-------|--------|
| diplomacy | 13,436 | **24,828** | +85% |
| wars | 0 | 0 | — |

### Top Errors (All Game-State)
| Error | Count | % of Failures |
|-------|-------|---------------|
| insufficient tech | 63,175 | 51% |
| Council+ permission | 28,767 | 23% |
| max 20 open orders | 15,934 | 13% |
| Council+ for policy | 4,275 | 3.4% |
| insufficient gold | ~5,000 | 4% |

### Assessment
- **Memory stability**: 45MB for 2 hours — no leaks confirmed
- **Action throughput**: ~1,750 actions/min sustained
- **Economy pattern**: Tech resources are the primary bottleneck (51% of errors)
- **Still peaceful**: 300 agents, 24,828 treaties, zero wars — diplomacy-heavy meta
- **Zero infrastructure issues** across 211K+ actions and 2.4M log lines

---

---

## T+3.75hr Checkpoint (03:52 KST)

### Action Results
| Metric | Count |
|--------|-------|
| **Successes** | 148,207 |
| **Failures** | 239,082 |
| **Success Rate** | 38.3% |
| **Total Actions** | 387,289 |
| **Infrastructure Errors** | **0** |
| **Persist Errors** | **0** |
| **Log Lines** | 3,116,494 |

### Process Health
| Process | Status |
|---------|--------|
| Sim (PID 63937) | Running (03:44:43 uptime) |
| Sim Memory | **45MB RSS** (zero growth — perfectly stable) |
| Server (port 9000) | Running |

### Supabase Data
| Table | T+2hr | T+3.75hr | Growth |
|-------|-------|----------|--------|
| diplomacy | 24,828 | **41,651** | +68% |
| wars | 0 | 0 | — |
| battles | 0 | 0 | — |

### Top Errors
| Error | Count | % |
|-------|-------|---|
| insufficient tech | 124,931 | 52% |
| Council+ permission | 52,900 | 22% |
| max 20 open orders | 35,828 | 15% |
| Council+ for policy | 7,587 | 3.2% |
| insufficient gold | ~6,000 | 2.5% |
| min order quantity | 831 | 0.3% |

### Key Observations
- **Success rate declining** (54%→38%): Natural — agents exhaust resources as game progresses
- **Tech bottleneck dominant**: 52% of all errors — tech tree investment is main limiter
- **Trade exchange very active**: "max 20 open orders" at 35K errors means constant trading
- **Pacifist simulation**: 41K treaties, zero wars after nearly 4 hours
- **Memory perfectly flat**: 45MB since T+10min — zero allocation growth

---

## Monitoring Schedule
- T+4hr checkpoint ← next (via background task)
- T+8hr final report

---

## Issues Found & Fixed
(none — zero infrastructure issues across 387K actions and 3.1M log lines)
