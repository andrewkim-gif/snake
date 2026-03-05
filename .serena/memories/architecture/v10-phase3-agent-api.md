# v10 Phase 3: Agent Integration + Training System

## New Server Files

### AgentAPI.ts (`apps/server/src/game/AgentAPI.ts`)
- `AgentAPI` class: External AI agent registration + game observation + command execution
- `registerAgent(agentId, apiKey, config)` — register external agent
- `getObserveData(agentId)` — full game context (position, build, nearby entities, pending upgrades)
- `executeCommand(agentId, command)` — Commander Mode commands (go_to, hunt, flee, gather, etc.)
- ObserveGameResponse interface: zone (center/mid/edge/danger), nearbyAgents, nearbyOrbs, pendingUpgrade
- 14 Commander Mode commands: go_to, go_center, flee, hunt, hunt_nearest, gather, set_boost, engage_weak, avoid_strong, farm_orbs, kite, camp_shrinkage, set_combat_style, choose_upgrade

### BuildPathSystem.ts (`apps/server/src/game/BuildPathSystem.ts`)
- 5 preset build paths: Berserker, Tank, Speedster, Vampire, Scholar
- `chooseBestUpgrade(choices, buildPath, currentBuild, gameContext)` — smart upgrade selection
- Score-based system: build priority + game context weighting (early/late, threats, rank)
- Support for bannedUpgrades/alwaysPick overrides
- `calcSynergyProgress()` for tracking build path completion

### TrainingSystem.ts (`apps/server/src/game/TrainingSystem.ts`)
- `TrainingSystem` class: Profile CRUD + combat rule evaluation + strategy phases
- `TrainingProfile`: buildProfile (primaryPath/fallbackPath), combatRules, strategyPhases
- `evaluateCombatRules(agentId, context)` — condition-based action resolution
- Condition variables: mass_ratio, nearby_threats, health_ratio, arena_radius_ratio, time_ratio, level, distance
- `getStrategyForPhase()` — early/mid/late (40%/80% thresholds)
- `getActiveBuildPath()` — fallback condition evaluation
- Round history + performance stats (avgRank, avgLevel, winRate, topSynergies)

## Modified Files

### events.ts (shared)
- New interfaces: AgentCommandPayload, SetTrainingProfilePayload, TrainingProfileSavedPayload, ObserveGamePayload
- ClientToServerEvents: +observe_game, +agent_command, +set_training_profile
- ServerToClientEvents: +training_profile_saved

### SocketHandler.ts
- Now accepts `options?: { agentAPI?, trainingSystem? }` parameter
- New socket events: observe_game (callback), agent_command, set_training_profile
- AgentAPI and TrainingSystem stored on roomManager as `_agentAPI`, `_trainingSystem`

### index.ts
- `express.json()` middleware added
- REST API v1 endpoints:
  - POST /api/v1/agents/:agentId/register
  - GET /api/v1/agents/:agentId/observe
  - POST /api/v1/agents/:agentId/command
  - DELETE /api/v1/agents/:agentId
  - GET /api/v1/agents/:agentId/training
  - PUT /api/v1/agents/:agentId/training
  - GET /api/v1/agents/:agentId/training/history
  - GET /api/v1/agents/:agentId/training/stats
- Legacy compat: GET/PUT /api/training, GET /api/training/history

### useSocket.ts (client)
- New method: `setTrainingProfile(agentId, profile)` — socket.emit('set_training_profile')

### TrainingConsole.tsx (client)
- Full rewrite with tabbed interface: Build / Combat / Strategy / Log
- BuildTab: 5 preset paths with icons, fallback path, banned/alwaysPick chips
- CombatTab: Editable rule list (condition + action), condition reference table
- StrategyTab: Phase time ranges with strategy dropdowns
- LogTab: Performance stats grid + round history table
- Props: `onSaveProfile` callback (socket-based saving)

### page.tsx (client)
- Destructures `setTrainingProfile` from useSocket
- Passes `onSaveProfile={setTrainingProfile}` to TrainingConsole
