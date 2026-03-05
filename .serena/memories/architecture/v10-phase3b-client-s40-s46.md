# v10 Phase 3B Client UI (S40-S46) Summary

## S40: CharacterCreator
- **File**: `apps/web/components/lobby/CharacterCreator.tsx` (NEW)
- Replaces inline SkinGrid/SkinThumbnail from page.tsx
- Left side: AgentPreview (120x120 Canvas2D, 4x scaled sprite)
- Right side: SkinGrid (8/page, paginated with dots)
- Uses `getAgentSprite()` from sprites.ts for preview

## S41: LevelUpOverlay
- **File**: `apps/web/components/game/LevelUpOverlay.tsx` (NEW)
- 3-card upgrade choice UI (Tome/Ability types)
- Type badge (green=Tome, blue=Ability)
- Icon area with type abbreviation + accent color
- Stack count for Tomes, level indicator for Abilities
- Timeout progress bar (timeoutTicks/20 = seconds)
- Semi-transparent dark background (game visible behind)

## S42: BuildHUD + XPBar
- **Files**: `apps/web/components/game/BuildHUD.tsx`, `XPBar.tsx` (NEW)
- BuildHUD: bottom-left, shows Tome stacks + Ability slots + active synergies
- XPBar: full-width bottom bar, level number + XP progress
- Level-up flash animation (green glow 600ms)

## S43: ShrinkWarning + SynergyPopup
- **Files**: `apps/web/components/game/ShrinkWarning.tsx`, `SynergyPopup.tsx` (NEW)
- ShrinkWarning: red pulsing vignette when near/outside arena edge
- "DANGER ZONE" text when outside safe radius
- "ARENA SHRINKING" indicator when shrink active + near edge
- SynergyPopup: toast notification (top-right), 3s auto-dismiss, fade in/out

## S44: RoundResultOverlay Extension
- **File**: `apps/web/components/game/RoundResultOverlay.tsx` (REWRITE)
- MC dark panel styling (was crayon sketch)
- Added BuildSummary section (tomes, abilities, synergies)
- Death cause display (killer name + damage source label)
- "BEST BUILD" badge when 2+ synergies
- Final level display

## S45: Aura/Effect/MapObject Rendering
- **File**: `apps/web/lib/renderer/entities.ts` (EXTENDED)
- Dash afterimage (3 fading sprite copies behind agent)
- Enhanced magnet effect (8 radial pulling lines + dashed circle)
- `drawMapObjects()` function: Shrine=golden diamond+beam, Spring=blue drops+pool, Altar=fire particles+block, Gate=purple portal ring
- Interaction radius dashed circle indicator
- `MapObjectNetworkData` type added to shared events.ts

## S46: Lobby Redesign
- **File**: `apps/web/app/page.tsx` (REWRITE)
- "CROSNAKE" -> "AGENT SURVIVOR" title
- "SLITHER GROW WIN" -> "FIGHT EVOLVE SURVIVE"
- Default name: `Agent${random}` instead of `Snake${random}`
- CharacterCreator replaces inline SkinGrid
- WelcomeTutorial modal (3-step: Move, Level Up, Survive)
- LobbySnakePreview import removed
- RoomList: "SERVERS" -> "ARENAS", "Room N" -> "Arena N"
- RecentWinnersPanel: "RECENT WINNERS" -> "RECENT CHAMPIONS"
- Controls hint: "Boost" -> "Dash"

## useSocket.ts Extensions
- GameData/UiState: +levelUp, +arenaShrink, +synergyPopups
- New events: `level_up`, `arena_shrink`, `synergy_activated`
- New methods: `chooseUpgrade(choiceId)`, `dismissSynergyPopup(synergyId)`
- Cleanup on death/round_reset/leaveRoom

## GameCanvas3D.tsx Updates
- New props: `chooseUpgrade`, `dismissSynergyPopup`
- Integrates: LevelUpOverlay, BuildHUD, XPBar, ShrinkWarning, SynergyPopup
- Player distance calculation for ShrinkWarning
- RoundResultOverlay now receives deathInfo prop

## Shared Type Changes
- `MapObjectNetworkData` interface added to events.ts
- `StatePayload.mo?: MapObjectNetworkData[]` added
