# v13 Navigation Integration — Deep System Architecture

> **Version**: v13.0
> **Date**: 2026-03-07
> **Status**: APPROVED
> **Based on**: `v13-navigation-integration-plan.md` (718 lines, 10 sections)
> **Scope**: C4 Level 2-3, Provider Architecture, Route Structure, Component Wiring, Data Flow
> **Predecessor**: `v11-system-architecture.md` (v11 deep architecture)
> **Type**: GAME (Frontend Architecture — Navigation & Feature Integration)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-Goals](#2-goals--non-goals)
3. [C4 Level 2 — Container Diagram](#3-c4-level-2--container-diagram)
4. [C4 Level 3 — Component Design](#4-c4-level-3--component-design)
5. [Provider & State Architecture](#5-provider--state-architecture)
6. [Route Architecture](#6-route-architecture)
7. [Navigation Component Design](#7-navigation-component-design)
8. [CountryPanel Tab Architecture](#8-countrypanel-tab-architecture)
9. [Data Flow & Sequence Diagrams](#9-data-flow--sequence-diagrams)
10. [Lazy Loading & Code Splitting](#10-lazy-loading--code-splitting)
11. [Responsive Architecture](#11-responsive-architecture)
12. [Design System Integration](#12-design-system-integration)
13. [Performance Budget](#13-performance-budget)
14. [Security Considerations](#14-security-considerations)
15. [ADR Summary](#15-adr-summary)
16. [Verification Matrix](#16-verification-matrix)
17. [Open Questions](#17-open-questions)

---

## 1. Overview

v13 transforms the AI World War frontend from a **single-page state-machine** (`mode: lobby | transitioning | playing`) into a **multi-route hub architecture** with persistent global state. The core challenge: 24 orphaned components (~150KB) built during v11 Phase 9-10 are unreachable because the app has zero navigation links (`<Link>` count: 0, `router.push()` count: 0).

### 1.1 Current State (v12)

```
app/layout.tsx          ← bare HTML shell, no providers
  └── app/page.tsx      ← EVERYTHING lives here
       ├── useSocket()  ← local hook, dies on route change
       ├── mode state   ← local useState, not shared
       ├── countryStates ← local Map, not shared
       └── lobby | game  ← mode-based conditional render

app/dashboard/page.tsx   ← URL-only access, no socket
app/economy/tokens/      ← URL-only access, no socket
```

### 1.2 Target State (v13)

```
app/layout.tsx
  └── <SocketProvider>           ← NEW: global WebSocket + state
       ├── app/page.tsx          ← WORLD (lobby + game), uses useSocketContext()
       ├── app/(hub)/layout.tsx  ← NEW: shared hub chrome (nav, sub-tabs, bg)
       │   ├── economy/*         ← 3 sub-routes
       │   ├── governance/*      ← 3 sub-routes
       │   ├── factions/*        ← 3 sub-routes (1 dynamic)
       │   ├── hall-of-fame/*    ← 1 route
       │   ├── profile/*         ← 1 route
       │   └── dashboard/*       ← existing, moved under hub
       └── 24 orphaned components → wired into 13 routes
```

### 1.3 Key Technical Shifts

| Aspect | v12 (Before) | v13 (After) |
|--------|-------------|-------------|
| **State Scope** | `page.tsx` local | `SocketProvider` global (Context) |
| **Navigation** | `mode` useState | Next.js App Router + `<Link>` |
| **Route Count** | 3 (1 functional) | 13 routes across 6 hub groups |
| **Socket Lifecycle** | Mount/unmount with page | Persist across all routes |
| **CountryPanel** | 1 view (basic info) | 4 tabs (OVERVIEW/TOKEN/VOTE/FACTION) |
| **Orphaned Components** | 24 files, 0 imports | 24 files, 13 route connections |
| **Mobile Nav** | None | Bottom Tab Bar (5 items) |
| **Desktop Nav** | None | Top Nav Bar (LobbyHeader extension) |

## 2. Goals / Non-Goals

### Goals

1. **G1**: Wire all 24 orphaned components into navigable routes (0 dead code)
2. **G2**: WebSocket connection persists across all route transitions (no disconnect)
3. **G3**: `countryStates`, `gameMode`, `currentRoomId` available globally via Context
4. **G4**: Desktop top-nav + mobile bottom-tab navigation with SK design system
5. **G5**: CountryPanel expanded to 4-tab inline information hub
6. **G6**: Game start from any page auto-redirects to `/` (lobby)
7. **G7**: Country context preserved via URL params (`?country=KOR`)
8. **G8**: Code splitting — hub pages lazy-loaded, initial bundle unchanged
9. **G9**: Mobile-first responsive (3 breakpoints: <768, 768-1024, >1024)

### Non-Goals

1. **NG1**: Server-side changes — v13 is frontend-only (Go server untouched)
2. **NG2**: New game mechanics — no gameplay changes
3. **NG3**: Blockchain wallet integration — WalletConnect UI wired but no real transactions
4. **NG4**: SSR/SSG for hub pages — all client-rendered (WebSocket dependency)
5. **NG5**: Authentication system — no login/session management
6. **NG6**: i18n — English-only UI (Korean comments in code)

## 3. C4 Level 2 — Container Diagram

v13 does not add new backend containers. The change is entirely within the **Next.js Client** container.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                              │
│                                                                      │
│  ┌─ Next.js App Shell ────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  ┌─ RootLayout ─────────────────────────────────────────────┐  │  │
│  │  │  <SocketProvider>  ← NEW: wraps entire app               │  │  │
│  │  │    ↓ provides: socket, countryStates, gameMode,          │  │  │
│  │  │                  currentRoomId, joinRoom, leaveRoom       │  │  │
│  │  │                                                          │  │  │
│  │  │  ┌─ Route: / ──────────────────────────────────────┐     │  │  │
│  │  │  │  LobbyHeader (extended w/ TopNavBar)            │     │  │  │
│  │  │  │  WorldView (Globe/Map) + AgentSetup + NewsFeed  │     │  │  │
│  │  │  │  CountryPanel (4-tab expansion)                 │     │  │  │
│  │  │  │  GameCanvas3D (when mode=playing)               │     │  │  │
│  │  │  └─────────────────────────────────────────────────┘     │  │  │
│  │  │                                                          │  │  │
│  │  │  ┌─ Route Group: (hub) ────────────────────────────┐     │  │  │
│  │  │  │  HubLayout: TopNavBar + SubTabs + dark grid bg  │     │  │  │
│  │  │  │  ├── /economy/*     (3 sub-pages)               │     │  │  │
│  │  │  │  ├── /governance/*  (3 sub-pages)               │     │  │  │
│  │  │  │  ├── /factions/*    (3 sub-pages, 1 dynamic)    │     │  │  │
│  │  │  │  ├── /hall-of-fame  (1 page)                    │     │  │  │
│  │  │  │  ├── /profile       (1 page)                    │     │  │  │
│  │  │  │  └── /dashboard     (1 page, existing)          │     │  │  │
│  │  │  └─────────────────────────────────────────────────┘     │  │  │
│  │  │                                                          │  │  │
│  │  │  BottomTabBar (mobile only, fixed bottom)                │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ↕ WebSocket (persistent, managed by SocketProvider)                 │
└──────────────────────────────────────────────────────────────────────┘
         │
         │ WSS (20Hz state, 1Hz country_states)
         ▼
┌──────────────────────┐
│  Go Game Server      │  ← UNCHANGED in v13
│  (port 9000)         │
└──────────────────────┘
```

### 3.1 Container Boundaries

| Container | Technology | v13 Change |
|-----------|-----------|------------|
| Next.js Client | Next.js 15, React 19, R3F | **Major**: SocketProvider, Hub Layout, 13 new routes |
| Go Game Server | Go 1.24, gorilla/websocket | **None** |
| Shared Package | TypeScript types + constants | **None** (existing types sufficient) |
| CDN (Vercel) | Edge network | **None** (auto-code-split by Next.js) |

## 4. C4 Level 3 — Component Design

### 4.1 Provider Layer (NEW)

```
providers/
  └── SocketProvider.tsx          ← Context provider
       ├── creates GameSocket instance (singleton)
       ├── manages connection lifecycle
       ├── exposes useSocketContext() hook
       ├── game start redirect (joined → router.push('/'))
       └── news event subscription
```

**SocketContext Interface:**

```typescript
interface SocketContextValue {
  // Connection
  socket: GameSocket | null;
  connected: boolean;

  // Global State (lifted from page.tsx)
  countryStates: Map<string, CountryClientState>;
  gameMode: 'idle' | 'lobby' | 'transitioning' | 'playing';
  currentRoomId: string | null;

  // Game Data (ref-based for 60fps reads)
  dataRef: React.MutableRefObject<GameData>;
  uiState: UiState;

  // Actions
  joinRoom: (iso3: string, name: string, skinId: number, appearance: string) => void;
  leaveRoom: () => void;
  sendInput: (input: InputPayload) => void;
  respawn: () => void;
  chooseUpgrade: (id: string) => void;
  dismissSynergyPopup: () => void;
}
```

### 4.2 Layout Layer

```
app/
  layout.tsx                      ← RootLayout + <SocketProvider>
  page.tsx                        ← WORLD route (lobby + game)
  (hub)/
    layout.tsx                    ← HubLayout (nav chrome + sub-tabs + bg)
    economy/
      layout.tsx                  ← EconomyLayout (sub-tab: TOKENS/TRADE/POLICY)
      page.tsx                    ← redirect → /economy/tokens
      tokens/page.tsx             ← existing dashboard (migrated)
      trade/page.tsx              ← TradeMarket component
      policy/page.tsx             ← PolicyPanel component
    governance/
      layout.tsx                  ← GovernanceLayout (sub-tab: PROPOSALS/NEW/HISTORY)
      page.tsx                    ← ProposalList + VoteInterface
      new/page.tsx                ← ProposalForm
      history/page.tsx            ← VoteHistory
    factions/
      layout.tsx                  ← FactionsLayout (sub-tab: OVERVIEW/TECH TREE/MERCENARY)
      page.tsx                    ← FactionList + FactionDashboard
      [id]/page.tsx               ← FactionDetail + TechTree
      market/page.tsx             ← MercenaryMarket
    hall-of-fame/
      page.tsx                    ← HallOfFame + SeasonTimeline
    profile/
      page.tsx                    ← Achievements + WalletConnect + Stats
    dashboard/
      page.tsx                    ← existing Agent API dashboard (migrated)
```

### 4.3 Navigation Layer (NEW)

```
components/navigation/
  ├── TopNavBar.tsx               ← Desktop nav (extends LobbyHeader center area)
  ├── BottomTabBar.tsx            ← Mobile bottom tab (5 items)
  ├── MoreMenu.tsx                ← Desktop dropdown / Mobile bottom sheet
  ├── SubTabBar.tsx               ← Hub sub-navigation (reusable)
  ├── NavItem.tsx                 ← Single nav item (icon + label + active state)
  └── WalletButton.tsx            ← Header wallet connect/status
```

### 4.4 CountryPanel Extension (MODIFIED)

```
components/world/
  └── CountryPanel.tsx            ← MODIFIED: add tab system
       ├── CountryPanelHeader     ← Flag + name + tier + faction + close
       ├── CountryPanelTabs       ← [OVERVIEW] [TOKEN] [VOTE] [FACTION]
       ├── OverviewTab            ← existing content (enhanced)
       ├── TokenTab               ← CountryTokenInfo + StakingPanel (compact)
       ├── VoteTab                ← ProposalList (filtered) + VoteInterface (inline)
       ├── FactionTab             ← Faction info + diplomacy + tech tree (summary)
       └── CountryPanelActions    ← [ENTER ARENA] [SPECTATE] (sticky bottom)
```

### 4.5 Component Wiring Matrix

| Orphaned Component | Target Route/Location | Import Type | Props Required |
|---|---|---|---|
| `blockchain/WalletConnectButton` | `navigation/WalletButton` + `/profile` | Direct | `onConnect`, `onDisconnect` |
| `blockchain/TokenBalanceList` | `navigation/WalletButton` dropdown + `/profile` | Direct | `walletAddress` |
| `blockchain/StakingPanel` | CountryPanel TOKEN tab (compact) + `/economy/tokens` (full) | Direct | `countryCode`, `compact?` |
| `blockchain/CountryTokenInfo` | CountryPanel TOKEN tab | Direct | `countryCode`, `countryStates` |
| `governance/ProposalForm` | `/governance/new` | Page content | `countryCode?` |
| `governance/ProposalList` | `/governance` + CountryPanel VOTE tab | Direct | `countryFilter?`, `limit?` |
| `governance/VoteInterface` | `/governance` inline + CountryPanel VOTE tab | Direct | `proposalId` |
| `governance/VoteHistory` | `/governance/history` | Page content | `userId?` |
| `governance/types` | All governance components | Type import | N/A |
| `economy/TradeMarket` | `/economy/trade` | Lazy (dynamic) | `countryCode?` |
| `economy/PolicyPanel` | `/economy/policy` | Lazy (dynamic) | `countryCode?` |
| `faction/FactionList` | `/factions` | Page content | — |
| `faction/FactionDetail` | `/factions/[id]` | Page content | `factionId` (from params) |
| `faction/TechTree` | `/factions/[id]` | Page content | `factionId` |
| `faction/FactionDashboard` | `/factions` (top summary) | Page content | — |
| `market/MercenaryMarket` | `/factions/market` | Lazy (dynamic) | — |
| `profile/Achievements` | `/profile` | Page content | `userId?` |
| `hall-of-fame/HallOfFame` | `/hall-of-fame` | Page content | — |
| `hall-of-fame/SeasonTimeline` | `/hall-of-fame` | Page content | — |
| `world/UNCouncil` | CountryPanel OVERVIEW tab (conditional) | Lazy | `countryCode` |
| `app/economy/tokens/*` | `/economy/tokens` (migrated to hub) | Route migration | — |
| `app/dashboard/*` | `/dashboard` (migrated to hub) | Route migration | — |

**Result: 24/24 orphaned components wired, 0 deletions**

## 5. Provider & State Architecture

### 5.1 SocketProvider Design

The critical architectural change in v13. Lifts `useSocket()` from `page.tsx` local scope into a React Context that wraps the entire application tree.

**File**: `apps/web/providers/SocketProvider.tsx`

```typescript
// Simplified structure — actual implementation follows this contract

'use client';

import { createContext, useContext, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const socketData = useSocket(); // existing hook, unchanged

  // Game start redirect: any page → /
  useEffect(() => {
    if (socketData.uiState.currentRoomId) {
      router.push('/');
    }
  }, [socketData.uiState.currentRoomId, router]);

  return (
    <SocketContext.Provider value={socketData}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be inside SocketProvider');
  return ctx;
}
```

### 5.2 State Ownership Transfer

| State | v12 Owner | v13 Owner | Access Pattern |
|-------|----------|----------|---------------|
| `socket` (GameSocket) | `useSocket()` ref in `page.tsx` | `SocketProvider` ref (singleton) | `useSocketContext().socket` |
| `connected` | `uiState` in `page.tsx` | `SocketProvider` context | `useSocketContext().uiState.connected` |
| `countryStates` | `uiState.countryStates` in `page.tsx` | `SocketProvider` context | `useSocketContext().uiState.countryStates` |
| `gameMode` | `mode` useState in `page.tsx` | **Derived** from `currentRoomId` + connection state | `useSocketContext().gameMode` |
| `currentRoomId` | `uiState.currentRoomId` in `page.tsx` | `SocketProvider` context | `useSocketContext().uiState.currentRoomId` |
| `dataRef` (60fps game data) | `useSocket().dataRef` in `page.tsx` | `SocketProvider` context (ref passthrough) | `useSocketContext().dataRef` |
| `playerName` | `useState` in `page.tsx` | **Stays local** to `page.tsx` (lobby-only) | Not in context |
| `appearance` | `useState` in `page.tsx` | **Stays local** to `page.tsx` (lobby-only) | Not in context |

**Key Decision**: Only network-related and globally-needed state goes into SocketProvider. UI-specific state (playerName, appearance, setupOpen) stays local to the pages that own them.

### 5.3 Socket Lifecycle

```
App Mount → SocketProvider Mount → GameSocket.connect()
  │
  ├── Route: / (WORLD) ───────── useSocketContext() ── renders lobby/game
  ├── Route: /economy/* ──────── useSocketContext() ── reads countryStates
  ├── Route: /governance/* ───── useSocketContext() ── reads countryStates
  ├── Route: /factions/* ─────── useSocketContext() ── reads countryStates
  ├── Route: /profile ────────── useSocketContext() ── reads connected
  └── ... all routes have socket access

Route Transition (e.g., / → /economy/tokens):
  1. Next.js App Router soft-navigates (no full reload)
  2. SocketProvider stays mounted (layout.tsx level)
  3. GameSocket connection stays alive
  4. countryStates Map keeps receiving 1Hz updates
  5. New route component mounts, calls useSocketContext()
  6. ✅ No socket disconnect, no data loss

Game Start Redirect (e.g., /economy/tokens → /):
  1. User somehow triggers joinRoom from another page
     OR server pushes `joined` event (e.g., auto-match)
  2. SocketProvider detects currentRoomId change
  3. router.push('/') fires automatically
  4. page.tsx mounts, reads currentRoomId from context
  5. Transitions to mode='playing'
```

### 5.4 Context Performance Considerations

**Problem**: `uiState` updates at varying frequencies (countryStates at 1Hz, game state at 20Hz during play). Re-rendering all consumers on every update would be expensive.

**Solution**: Split context into two layers:

```typescript
// Layer 1: Stable context (changes rarely)
interface SocketStableContext {
  connected: boolean;
  gameMode: 'idle' | 'lobby' | 'transitioning' | 'playing';
  currentRoomId: string | null;
  joinRoom: (...) => void;
  leaveRoom: () => void;
}

// Layer 2: Ref-based (no re-renders, read in useFrame/callbacks)
interface SocketRefContext {
  dataRef: MutableRefObject<GameData>;
  uiStateRef: MutableRefObject<UiState>;
  countryStatesRef: MutableRefObject<Map<string, CountryClientState>>;
}
```

- Hub pages (economy, governance, etc.) subscribe to **Layer 1** (stable) — re-renders only on connection/game state changes
- Game components (`GameCanvas3D`, `Scene`) read from **Layer 2** (refs) — zero re-renders, direct ref access in `useFrame`
- CountryPanel subscribes to `countryStatesRef` and reads on tab switch — no continuous re-renders

## 6. Route Architecture

### 6.1 Next.js App Router Structure

v13 uses Next.js **Route Groups** (`(hub)`) to share a layout across all non-WORLD pages without affecting the URL.

```
apps/web/app/
├── layout.tsx                    ← RootLayout: <SocketProvider> wrapper
├── page.tsx                      ← / (WORLD — lobby + game, NO hub layout)
│
├── (hub)/                        ← Route Group (no URL segment)
│   ├── layout.tsx                ← HubLayout: TopNavBar + SubTabs + bg
│   │
│   ├── economy/
│   │   ├── layout.tsx            ← EconomyLayout: sub-tabs
│   │   ├── page.tsx              ← redirect → /economy/tokens
│   │   ├── tokens/
│   │   │   └── page.tsx          ← TokenDashboard (migrated from app/economy/tokens/)
│   │   ├── trade/
│   │   │   └── page.tsx          ← TradeMarket
│   │   └── policy/
│   │       └── page.tsx          ← PolicyPanel
│   │
│   ├── governance/
│   │   ├── layout.tsx            ← GovernanceLayout: sub-tabs
│   │   ├── page.tsx              ← ProposalList + VoteInterface
│   │   ├── new/
│   │   │   └── page.tsx          ← ProposalForm
│   │   └── history/
│   │       └── page.tsx          ← VoteHistory
│   │
│   ├── factions/
│   │   ├── layout.tsx            ← FactionsLayout: sub-tabs
│   │   ├── page.tsx              ← FactionList + FactionDashboard
│   │   ├── [id]/
│   │   │   └── page.tsx          ← FactionDetail + TechTree
│   │   └── market/
│   │       └── page.tsx          ← MercenaryMarket
│   │
│   ├── hall-of-fame/
│   │   └── page.tsx              ← HallOfFame + SeasonTimeline
│   │
│   ├── profile/
│   │   └── page.tsx              ← Achievements + Wallet + Stats
│   │
│   └── dashboard/
│       └── page.tsx              ← Agent API Dashboard (migrated)
```

### 6.2 Layout Nesting Hierarchy

```
RootLayout (app/layout.tsx)
├── SocketProvider
│   ├── page.tsx (/) ────────────────── WORLD (no hub chrome)
│   │    └── LobbyHeader (extended with TopNavBar)
│   │        WorldView, AgentSetup, NewsFeed, CountryPanel, GameCanvas3D
│   │
│   └── HubLayout (app/(hub)/layout.tsx)
│        ├── TopNavBar (desktop) / BottomTabBar (mobile)
│        ├── HubHeader (title + sub-tabs)
│        ├── Content Area (max-width: 1200px, centered)
│        │
│        ├── EconomyLayout → [tokens|trade|policy] page
│        ├── GovernanceLayout → [proposals|new|history] page
│        ├── FactionsLayout → [overview|[id]|market] page
│        ├── HallOfFamePage
│        ├── ProfilePage
│        └── DashboardPage
```

### 6.3 Route-to-Component Mapping

| Route | Page Component | Orphaned Components Used | Sub-Tab |
|-------|---------------|------------------------|---------|
| `/` | `Home` | (none — all inline) | N/A |
| `/economy` | Redirect | — | → `/economy/tokens` |
| `/economy/tokens` | `TokensPage` | `app/economy/tokens/components.tsx` (migrated) | TOKENS |
| `/economy/trade` | `TradePage` | `economy/TradeMarket` | TRADE |
| `/economy/policy` | `PolicyPage` | `economy/PolicyPanel` | POLICY |
| `/governance` | `GovernancePage` | `governance/ProposalList`, `governance/VoteInterface` | PROPOSALS |
| `/governance/new` | `NewProposalPage` | `governance/ProposalForm` | NEW |
| `/governance/history` | `HistoryPage` | `governance/VoteHistory` | HISTORY |
| `/factions` | `FactionsPage` | `faction/FactionList`, `faction/FactionDashboard` | OVERVIEW |
| `/factions/[id]` | `FactionDetailPage` | `faction/FactionDetail`, `faction/TechTree` | — |
| `/factions/market` | `MercenaryPage` | `market/MercenaryMarket` | MERCENARY |
| `/hall-of-fame` | `HallOfFamePage` | `hall-of-fame/HallOfFame`, `hall-of-fame/SeasonTimeline` | — |
| `/profile` | `ProfilePage` | `profile/Achievements`, `blockchain/WalletConnectButton`, `blockchain/TokenBalanceList` | — |
| `/dashboard` | `DashboardPage` | `app/dashboard/page.tsx` (migrated) | — |

### 6.4 Migration Plan for Existing Routes

**`app/economy/tokens/`** (existing):
- Move `app/economy/tokens/page.tsx` → `app/(hub)/economy/tokens/page.tsx`
- Move `app/economy/tokens/components.tsx` → same directory
- Update imports (relative paths stay the same)
- Add `'use client'` if not present

**`app/dashboard/`** (existing):
- Move `app/dashboard/page.tsx` → `app/(hub)/dashboard/page.tsx`
- Update imports
- Wrap with HubLayout chrome

**Old route paths preserved**: Next.js App Router `(hub)` route group does NOT affect URLs. `/economy/tokens` stays `/economy/tokens`.

## 7. Navigation Component Design

### 7.1 TopNavBar (Desktop: >768px)

Extends the existing `LobbyHeader` by inserting navigation items in the center area.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo+ALPHA]   WORLD  ECONOMY  GOVERN  FACTIONS  MORE▼    [Wallet] [●] │
│                 ━━━━                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Component**: `components/navigation/TopNavBar.tsx`

```typescript
interface TopNavBarProps {
  activeRoute: string;  // derived from usePathname()
}

// Nav items definition
const NAV_ITEMS = [
  { label: 'WORLD',    href: '/',           icon: '🌍' },
  { label: 'ECONOMY',  href: '/economy',    icon: '💰' },
  { label: 'GOVERN',   href: '/governance', icon: '🏛️' },
  { label: 'FACTIONS', href: '/factions',   icon: '⚔️' },
] as const;

const MORE_ITEMS = [
  { label: 'HALL OF FAME', href: '/hall-of-fame', icon: '🏆' },
  { label: 'PROFILE',      href: '/profile',      icon: '👤' },
  { label: 'DASHBOARD',    href: '/dashboard',    icon: '🤖' },
] as const;
```

**Style Tokens** (SK design system):
- Font: `Inter Bold 13px`, `text-transform: uppercase`, `letter-spacing: 2px`
- Inactive: `SK.textSecondary` (#8B8D98)
- Hover: `SK.textPrimary` (#ECECEF) + 2px bottom glow (`SK.gold` at 40% opacity)
- Active: `SK.gold` (#F59E0B) + 2px solid bottom bar
- Gap: 24px between items
- Transition: `color 150ms ease`

**Integration with LobbyHeader**:
- LobbyHeader's center area (currently empty) receives TopNavBar
- LobbyHeader right area gains WalletButton
- On WORLD route (`/`), TopNavBar renders inside LobbyHeader
- On hub routes, TopNavBar renders inside HubLayout header

### 7.2 BottomTabBar (Mobile: <768px)

```
┌─────────────────────────────────────────────────────┐
│  🌍       💰        🏛️        ⚔️       ●●●        │
│ WORLD   ECONOMY   GOVERN   FACTIONS   MORE         │
│  ━━━                                                │
└─────────────────────────────────────────────────────┘
```

**Component**: `components/navigation/BottomTabBar.tsx`

```typescript
// Renders at fixed bottom on mobile viewports
// Hidden on desktop (display: none at >768px)
```

**Style Tokens**:
- Height: `56px` + `env(safe-area-inset-bottom)`
- Background: `SK.cardBg` (#141418) + top 1px border (`SK.border`)
- Icon: 24px
- Label: `10px uppercase Inter Bold`
- Inactive: `SK.textMuted` (#55565E)
- Active: `SK.gold` (#F59E0B) + 2px top gold bar
- `backdrop-filter: blur(12px)`
- `z-index: 80` (above content, below modals)

### 7.3 MoreMenu Component

**Desktop**: Dropdown from TopNavBar MORE button
```
┌──────────────────┐
│ 🏆 HALL OF FAME  │
│ 👤 PROFILE       │
│ 🤖 DASHBOARD     │
│ ──────────────── │
│ ⚙️ SETTINGS      │
└──────────────────┘
```
- McPanel styling (SK.cardBg + SK.border + shadow)
- Outside click → close
- `position: absolute`, `z-index: 90`
- Items: icon + text, hover background `SK.cardBgHover`

**Mobile**: Bottom sheet slide-up
- 3 items: HALL OF FAME, PROFILE, DASHBOARD
- Drag handle (5px x 40px, SK.textMuted)
- Outside click/swipe-down → close
- `transform: translateY()` animation, 300ms cubic-bezier

### 7.4 SubTabBar (Reusable)

Used inside each hub section layout for sub-navigation.

```typescript
interface SubTabBarProps {
  tabs: Array<{ label: string; href: string }>;
  activeHref: string;
}
```

**Style**: Gold underline style matching CharacterCreator's 7-tab pattern:
- Font: `Inter 600 12px`, uppercase
- Active: `SK.gold` text + 2px bottom bar
- Inactive: `SK.textSecondary`
- Gap: 16px
- Mobile: horizontal scroll (`overflow-x: auto`, no scrollbar)

### 7.5 WalletButton

Located in header right area (desktop) or Profile page (mobile).

```typescript
// Disconnected state
<button>[🔗 CONNECT]</button>  // SK.gold border, SK.bg fill

// Connected state
<button>[💰 0x1234...]</button>  // truncated address, click → dropdown
  └── TokenBalanceList dropdown
       ├── $AWW: 1,240
       ├── $KOR: 50,000
       └── [DISCONNECT]
```

- Wraps existing `blockchain/WalletConnectButton` component
- Connected state shows `blockchain/TokenBalanceList` in dropdown
- CROSSx deep link (`crossx://`) for mobile wallet connection
- Mobile: hidden from header, accessible in `/profile`

### 7.6 Navigation on WORLD Route (/)

The WORLD route (`/`) is special — it does NOT use the hub layout. Navigation is embedded directly in the extended LobbyHeader:

```
WORLD route:
  LobbyHeader (56px, absolute top, z-index 70)
    ├── Left: Logo + ALPHA badge
    ├── Center: TopNavBar (WORLD active)  ← NEW
    ├── Right: WalletButton + Online + ViewToggle  ← WalletButton NEW
    └── Background: gradient overlay (transparent bottom)

  WorldView (full screen behind header)
  AgentSetup (left panel)
  CountryPanel (right slide-in)
  NewsFeed (bottom ticker)
  BottomTabBar (mobile, fixed bottom)  ← NEW
```

## 8. CountryPanel Tab Architecture

### 8.1 Tab System Design

Extends existing `CountryPanel.tsx` with a tab bar. The panel stays at 400px width (desktop), slide-in from right.

```typescript
type CountryPanelTab = 'overview' | 'token' | 'vote' | 'faction';

interface ExtendedCountryPanelProps extends CountryPanelProps {
  activeTab: CountryPanelTab;
  onTabChange: (tab: CountryPanelTab) => void;
}
```

**Tab Bar**: Positioned below panel header, above content.
- Same gold underline style as SubTabBar
- 4 equal-width tabs: `[OVERVIEW] [TOKEN] [VOTE] [FACTION]`
- Tap on tab switches content with 150ms opacity transition

### 8.2 OVERVIEW Tab (Enhanced Existing)

Existing CountryPanel content with additions:

```
┌─ OVERVIEW ─────────────────────────┐
│ Country Info (existing)            │
│   Population, GDP, Military...     │
│                                    │
│ Sovereignty Level (existing)       │
│   ████████░░ Level 4 (78%)         │
│                                    │
│ Faction Affiliation (NEW)          │
│   ⚔️ East Asia Coalition           │
│   Alliance: Japan, Taiwan          │
│                                    │
│ Recent Battles (NEW)               │
│   #1: Victory (Score 2,450)        │
│   #2: Defeat (Score 1,200)         │
│   #3: Victory (Score 3,100)        │
│                                    │
│ [VIEW FULL STATS →]  → /factions   │
└────────────────────────────────────┘
```

### 8.3 TOKEN Tab (New — CountryTokenInfo + StakingPanel)

```
┌─ TOKEN ────────────────────────────┐
│ ┌─ CountryTokenInfo ─────────────┐ │
│ │ $KOR Token                     │ │
│ │ Market Cap: $2.4M              │ │
│ │ 24h Change: +5.2% 📈          │ │
│ │ Defense Buff: 1.8x             │ │
│ │ Total Staked: 1.2M $KOR        │ │
│ │ APR: 12.5%                     │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌─ StakingPanel (compact) ───────┐ │
│ │ My Stake: 50,000 $KOR          │ │
│ │ [STAKE] [UNSTAKE]              │ │
│ │ Pending Rewards: 230 $KOR      │ │
│ │ [CLAIM]                        │ │
│ └────────────────────────────────┘ │
│                                    │
│ [VIEW TOKEN DASHBOARD →]          │
│   → /economy/tokens?country=KOR   │
└────────────────────────────────────┘
```

**Data Flow**: `countryCode` prop → `CountryTokenInfo` reads from `useSocketContext().uiState.countryStates.get(iso3)` for live data, mock data fallback for token-specific fields.

### 8.4 VOTE Tab (New — ProposalList + VoteInterface)

```
┌─ VOTE ─────────────────────────────┐
│ Active Proposals for 🇰🇷 Korea    │
│                                    │
│ ┌─ Proposal #042 ──────────────┐  │
│ │ Tax Rate 5% → 3%             │  │
│ │ ████████░░ 73% Yes           │  │
│ │ Remaining: 2d 14h            │  │
│ │ [VOTE YES] [VOTE NO]         │  │
│ └──────────────────────────────┘  │
│                                    │
│ ┌─ Proposal #041 ──────────────┐  │
│ │ Japan-Korea Trade Deal       │  │
│ │ ████████████ 91% Yes         │  │
│ │ Status: Passed               │  │
│ └──────────────────────────────┘  │
│                                    │
│ [NEW PROPOSAL]                     │
│   → /governance/new?country=KOR    │
│ [ALL PROPOSALS →]                  │
│   → /governance?country=KOR        │
└────────────────────────────────────┘
```

**Components**: `ProposalList` (with `countryFilter={iso3}`, `limit={3}`) + `VoteInterface` (inline, triggered on proposal click).

### 8.5 FACTION Tab (New)

```
┌─ FACTION ──────────────────────────┐
│ ┌─ Faction Info ─────────────────┐ │
│ │ ⚔️ East Asia Coalition         │ │
│ │ Members: 38 countries          │ │
│ │ Military: ★★★★☆               │ │
│ │ Economy: ★★★★★                │ │
│ └────────────────────────────────┘ │
│                                    │
│ Diplomacy                          │
│   🤝 Allied: Japan, Taiwan, ...   │
│   ⚔️ Hostile: NATO Alliance       │
│   🔘 Neutral: African Union       │
│                                    │
│ Tech Tree Progress                 │
│   ███████░░░ Military 70%         │
│   █████░░░░░ Economy 50%          │
│   ████░░░░░░ Espionage 40%       │
│                                    │
│ [VIEW FACTION →]                   │
│   → /factions/{factionId}          │
└────────────────────────────────────┘
```

### 8.6 Mobile Bottom Sheet Behavior

On viewports <768px, CountryPanel renders as a bottom sheet instead of right slide-in:

```typescript
// 3-stage snap points
type SheetStage = 'peek' | 'half' | 'full';
// peek: 20vh — shows header + action buttons
// half: 50vh — shows header + active tab content
// full: 85vh — full scrollable content

// Gesture: swipe down to dismiss, swipe up to expand
// Drag handle: 5px × 40px gray bar at top
```

### 8.7 CountryPanel Architecture Summary

```
CountryPanel (400px right slide-in / mobile bottom sheet)
│
├── CountryPanelHeader
│   ├── Flag emoji + Country name
│   ├── Tier badge + Faction name
│   ├── Sovereignty bar
│   └── Close button (×)
│
├── CountryPanelTabs [OVERVIEW | TOKEN | VOTE | FACTION]
│   └── Gold underline active indicator
│
├── Tab Content (scrollable area)
│   ├── OverviewTab (enhanced existing)
│   ├── TokenTab (CountryTokenInfo + StakingPanel compact)
│   ├── VoteTab (ProposalList filtered + VoteInterface inline)
│   └── FactionTab (faction info + diplomacy + tech summary)
│
└── CountryPanelActions (sticky bottom)
    ├── [ENTER ARENA] — McButton primary
    └── [SPECTATE] — McButton secondary
```

## 9. Data Flow & Sequence Diagrams

### 9.1 App Bootstrap Sequence

```
Browser Load
  │
  ├─1→ Next.js hydrates RootLayout
  ├─2→ SocketProvider mounts
  │     ├─ Creates GameSocket singleton
  │     ├─ Connects to Go server (WSS)
  │     └─ Sets up event handlers (joined, state, country_states, etc.)
  ├─3→ Route component mounts (e.g., page.tsx for /)
  │     └─ Calls useSocketContext() to access global state
  ├─4→ GameSocket.onConnect fires
  │     └─ SocketProvider sets connected=true
  ├─5→ Server pushes country_states (1Hz)
  │     └─ SocketProvider updates countryStates Map
  └─6→ UI renders with live data
```

### 9.2 Route Transition: WORLD → Economy Hub

```
User clicks "ECONOMY" in TopNavBar
  │
  ├─1→ Next.js <Link href="/economy"> triggers client-side navigation
  ├─2→ App Router soft-navigates (no full page reload)
  │     ├─ page.tsx (/) unmounts
  │     ├─ HubLayout (app/(hub)/layout.tsx) mounts
  │     ├─ EconomyLayout mounts
  │     └─ /economy/page.tsx → redirect to /economy/tokens
  ├─3→ SocketProvider stays mounted (layout.tsx level)
  │     └─ GameSocket connection persists
  ├─4→ TokensPage mounts
  │     ├─ Calls useSocketContext()
  │     ├─ Reads countryStates for country-filtered display
  │     └─ Renders existing token dashboard components
  └─5→ countryStates keeps updating at 1Hz (no interruption)
```

### 9.3 Game Start Redirect Flow

```
User is on /governance page, server pushes `joined` event
  │
  ├─1→ SocketProvider receives `joined` event via useSocket()
  │     └─ uiState.currentRoomId becomes non-null
  ├─2→ SocketProvider's useEffect detects currentRoomId change
  │     └─ Calls router.push('/')
  ├─3→ Next.js navigates to /
  │     ├─ HubLayout unmounts
  │     ├─ GovernancePage unmounts
  │     └─ page.tsx (/) mounts
  ├─4→ page.tsx reads currentRoomId from useSocketContext()
  │     └─ Sets local mode='playing'
  ├─5→ GameCanvas3D renders
  │     └─ Reads dataRef for 60fps game state
  └─ Socket connection never dropped
```

### 9.4 Country Context Propagation

```
User clicks Korea on Globe (WORLD page)
  │
  ├─1→ WorldView fires onCountrySelect('KOR')
  ├─2→ CountryPanel opens with country=countryStates.get('KOR')
  ├─3→ User clicks "TOKEN" tab
  │     └─ CountryTokenInfo renders with countryCode='KOR'
  ├─4→ User clicks "VIEW TOKEN DASHBOARD →"
  │     └─ <Link href="/economy/tokens?country=KOR">
  ├─5→ Next.js navigates to /economy/tokens?country=KOR
  │     ├─ TokensPage reads searchParams.country
  │     ├─ Highlights Korea in dashboard
  │     └─ countryStates available via useSocketContext()
  └─6→ User clicks "WORLD" in nav
       └─ Returns to / with CountryPanel still showing KOR (if stored in URL/state)
```

### 9.5 WebSocket Event Flow (Unchanged)

v13 does NOT modify the WebSocket protocol. All existing events continue unchanged:

```
Server → Client (via SocketProvider):
  ├── country_states (1Hz) ──→ countryStates Map update
  ├── joined ─────────────────→ currentRoomId + game start redirect
  ├── state (20Hz) ───────────→ dataRef.current (game loop)
  ├── death ───────────────────→ uiState.deathInfo
  ├── kill ────────────────────→ uiState.killFeed
  ├── minimap (1Hz) ──────────→ dataRef.current.minimap
  ├── battle_complete ─────────→ uiState.battleComplete
  ├── ability_triggered ───────→ game effects
  └── pong ────────────────────→ RTT calculation

Client → Server (via SocketProvider actions):
  ├── join_room ───────────────→ joinRoom()
  ├── leave_room ──────────────→ leaveRoom()
  ├── input (30Hz) ────────────→ sendInput()
  └── ping ────────────────────→ automatic (heartbeat)
```

## 10. Lazy Loading & Code Splitting

### 10.1 Strategy

All hub page components are lazy-loaded via `next/dynamic` to keep the initial bundle (WORLD route) unchanged. The existing `lib/lazy-components.ts` is extended.

### 10.2 Extended Lazy Components Registry

**File**: `apps/web/lib/lazy-components.ts` (modified)

```typescript
// Existing (unchanged)
export const LazyGlobeView = dynamic(...);
export const LazyWorldMap = dynamic(...);
export const LazyWorldView = dynamic(...);
export const LazyCountryPanel = dynamic(...);
export const LazySpectatorView = dynamic(...);
export const LazyFactionDashboard = dynamic(...);

// NEW: Hub page components
export const LazyTradeMarket = dynamic(
  () => import('@/components/economy/TradeMarket'),
  { ssr: false, loading: () => <HubSkeleton /> }
);

export const LazyPolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  { ssr: false, loading: () => <HubSkeleton /> }
);

export const LazyProposalList = dynamic(
  () => import('@/components/governance/ProposalList'),
  { loading: () => <HubSkeleton /> }
);

export const LazyProposalForm = dynamic(
  () => import('@/components/governance/ProposalForm'),
  { loading: () => <HubSkeleton /> }
);

export const LazyVoteInterface = dynamic(
  () => import('@/components/governance/VoteInterface'),
  { loading: () => <HubSkeleton /> }
);

export const LazyVoteHistory = dynamic(
  () => import('@/components/governance/VoteHistory'),
  { loading: () => <HubSkeleton /> }
);

export const LazyFactionList = dynamic(
  () => import('@/components/faction/FactionList'),
  { loading: () => <HubSkeleton /> }
);

export const LazyFactionDetail = dynamic(
  () => import('@/components/faction/FactionDetail'),
  { loading: () => <HubSkeleton /> }
);

export const LazyTechTree = dynamic(
  () => import('@/components/faction/TechTree'),
  { loading: () => <HubSkeleton /> }
);

export const LazyMercenaryMarket = dynamic(
  () => import('@/components/market/MercenaryMarket'),
  { loading: () => <HubSkeleton /> }
);

export const LazyHallOfFame = dynamic(
  () => import('@/components/hall-of-fame/HallOfFame'),
  { loading: () => <HubSkeleton /> }
);

export const LazySeasonTimeline = dynamic(
  () => import('@/components/hall-of-fame/SeasonTimeline'),
  { loading: () => <HubSkeleton /> }
);

export const LazyAchievements = dynamic(
  () => import('@/components/profile/Achievements'),
  { loading: () => <HubSkeleton /> }
);

export const LazyWalletConnect = dynamic(
  () => import('@/components/blockchain/WalletConnectButton'),
  { ssr: false, loading: () => <HubSkeleton /> }
);

export const LazyTokenBalanceList = dynamic(
  () => import('@/components/blockchain/TokenBalanceList'),
  { ssr: false, loading: () => <HubSkeleton /> }
);
```

### 10.3 Bundle Impact Analysis

| Route | Components Loaded | Estimated Size | Load Trigger |
|-------|------------------|----------------|-------------|
| `/` (WORLD) | GlobeView OR WorldMap, GameCanvas3D | ~600KB | Initial (unchanged) |
| `/economy/tokens` | Token Dashboard (5 charts) | ~150KB | Nav click |
| `/economy/trade` | TradeMarket | ~80KB | Nav click |
| `/economy/policy` | PolicyPanel | ~40KB | Nav click |
| `/governance` | ProposalList + VoteInterface | ~60KB | Nav click |
| `/governance/new` | ProposalForm | ~30KB | Nav click |
| `/governance/history` | VoteHistory | ~30KB | Nav click |
| `/factions` | FactionList + FactionDashboard | ~70KB | Nav click |
| `/factions/[id]` | FactionDetail + TechTree | ~90KB | Nav click |
| `/factions/market` | MercenaryMarket | ~50KB | Nav click |
| `/hall-of-fame` | HallOfFame + SeasonTimeline | ~60KB | Nav click |
| `/profile` | Achievements + WalletConnect + TokenBalance | ~80KB | Nav click |
| `/dashboard` | Agent API Dashboard (5 tabs) | ~120KB | Nav click |

**Shared chunk**: Navigation components (TopNavBar, BottomTabBar, SubTabBar) — ~15KB, loaded with any route.

### 10.4 HubSkeleton Component

Shimmer loading placeholder for hub pages:

```typescript
// components/navigation/HubSkeleton.tsx
export function HubSkeleton() {
  return (
    <div style={{
      display: 'grid',
      gap: '16px',
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: SK.cardBg,
          borderRadius: '12px',
          height: i === 1 ? '200px' : '160px',
          animation: 'shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  );
}
```

## 11. Responsive Architecture

### 11.1 Breakpoint System

| Name | Range | Nav Type | CountryPanel | Content Grid | Padding |
|------|-------|---------|-------------|-------------|---------|
| **Mobile** | <768px | BottomTabBar (56px + safe-area) | Bottom sheet (3-stage) | 1-col | 16px |
| **Tablet** | 768-1024px | TopNavBar (condensed labels) | Right slide (360px) | 2-col | 24px |
| **Desktop** | >1024px | TopNavBar (full labels) | Right slide (400px) | 2-3 col, max 1200px | 32px |

### 11.2 Mobile-Specific Adaptations

**Bottom Tab vs NewsFeed Collision**:
- WORLD route: NewsFeed renders as 24px single-line ticker ABOVE BottomTabBar
- Hub routes: NewsFeed hidden (not relevant outside WORLD)
- Stack: BottomTabBar (z:80) > NewsFeed (z:60) > Content

**CountryPanel Bottom Sheet**:
```
Stage 1 (peek):  20vh — header + action buttons visible
Stage 2 (half):  50vh — header + active tab content
Stage 3 (full):  85vh — full scrollable content

Gesture: Swipe up to expand, swipe down to dismiss
Drag handle: 5px × 40px bar, SK.textMuted color, centered
```

**Hub Content**: Single column, cards fill width minus 32px padding, vertical scroll

**Sub-tabs**: Horizontal scroll with `overflow-x: auto`, hidden scrollbar, touch-friendly 44px tap targets

### 11.3 Safe Area Handling

```css
/* Bottom Tab */
padding-bottom: env(safe-area-inset-bottom);

/* Top header */
padding-top: env(safe-area-inset-top);

/* Applied in RootLayout body or individual components */
```

### 11.4 Responsive Component Map

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| TopNavBar | Hidden | Condensed (icons only) | Full (icon + label) |
| BottomTabBar | Shown (56px) | Hidden | Hidden |
| MoreMenu | Bottom sheet | Dropdown | Dropdown |
| CountryPanel | Bottom sheet | Right 360px | Right 400px |
| Hub content | 1-col scroll | 2-col grid | 2-3 col grid |
| SubTabBar | Horizontal scroll | Horizontal | Horizontal |
| WalletButton | In Profile page | In header | In header |
| NewsFeed | 24px ticker (WORLD only) | 36px ticker | 36px ticker |

## 12. Design System Integration

### 12.1 SK Palette Usage (Existing — No Changes)

All new components use the established SK design tokens from `lib/sketch-ui.ts`:

```typescript
import { SK, SKFont, bodyFont, headingFont } from '@/lib/sketch-ui';

// Backgrounds
SK.bg        // #09090B — page background
SK.cardBg    // #141418 — McPanel card background
SK.glassBg   // rgba(14,14,18,0.80) — glass overlay

// Text
SK.textPrimary   // #ECECEF — primary text
SK.textSecondary // #8B8D98 — secondary/inactive text
SK.textMuted     // #55565E — muted/disabled text

// Accents
SK.gold      // #F59E0B — active state, CTAs, highlights
SK.green     // #10B981 — success, online status
SK.red       // #EF4444 — danger, error
SK.blue      // #6366F1 — links, focus rings

// Borders
SK.border     // rgba(255,255,255,0.06) — subtle dividers
SK.borderDark // rgba(255,255,255,0.03) — extra subtle
```

### 12.2 New Component Styling Rules

All new navigation/hub components follow these rules:

1. **McPanel** for card containers (dark bg + subtle border + rounded corners)
2. **McButton** for interactive elements (left color stripe + dark fill + hover)
3. **Inter Bold** for navigation labels, **Inter 400** for body text
4. **Black Ops One** for hub page titles (matching LobbyHeader)
5. Gold underline for active states (tabs, nav items)
6. 150ms transition on color/opacity changes
7. No shadows lighter than `SK.shadow` — dark theme consistency
8. `backdrop-filter: blur(12px)` on floating elements (nav bars, panels)

### 12.3 Hub Page Background

Hub pages use a dark grid texture background instead of the Globe:

```css
background:
  /* Micro grid pattern */
  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
  SK.bg;
background-size: 40px 40px;
```

### 12.4 Page Transition Animations

| Transition | Method | Duration |
|-----------|--------|----------|
| WORLD → Hub | Globe fade-out (200ms) → Content fade-in (150ms) | 350ms total |
| Hub → Hub | Content cross-fade | 200ms |
| Hub → WORLD | Content fade-out (150ms) → Globe fade-in (200ms) | 350ms total |
| Sub-tab switch | Content opacity transition | 150ms |
| CountryPanel open | `translateX(100%) → 0` | 300ms ease-out |
| CountryPanel close | `translateX(0) → 100%` | 200ms ease-in |
| Mobile bottom sheet | `translateY(100%) → target%` | 300ms cubic-bezier(0.32, 0.72, 0, 1) |
| MORE dropdown | `opacity: 0→1` + `translateY(-8px→0)` | 150ms |

### 12.5 Loading & Error States

**Loading**: McPanel skeleton with shimmer animation (CSS keyframe, no JS dependency)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

**Error**: Red-bordered McPanel with retry button
```
┌─ ⚠️ Failed to load ─────────────────┐
│ Could not fetch faction data.        │
│ [RETRY]                              │
└──────────────────────────────────────┘
```
Border: `SK.red` at 30% opacity, button: McButton with red accent

## 13. Performance Budget

### 13.1 Core Web Vitals Targets

| Metric | Target | Current (v12) | Risk |
|--------|--------|---------------|------|
| **LCP** (Largest Contentful Paint) | <2.5s | ~2.0s (Globe) | Low — Globe route unchanged |
| **FID** (First Input Delay) | <100ms | ~50ms | Low — no heavy JS on nav |
| **CLS** (Cumulative Layout Shift) | <0.1 | ~0.05 | Medium — nav bar layout must be stable |
| **TTI** (Time to Interactive) | <3.5s | ~3.0s | Low — hub pages are lazy |

### 13.2 Bundle Size Budget

| Chunk | Budget | Notes |
|-------|--------|-------|
| Initial (WORLD route) | <800KB (gzipped) | Must NOT increase from v12 |
| Navigation shared chunk | <20KB | TopNavBar + BottomTabBar + SubTabBar |
| Hub page chunk (each) | <150KB | Lazy loaded on route transition |
| SocketProvider | <5KB | Thin wrapper, most logic in existing useSocket |

### 13.3 Runtime Performance

| Metric | Target | Method |
|--------|--------|--------|
| Route transition | <200ms | Next.js client-side navigation + prefetch |
| Socket reconnection | 0 occurrences during nav | SocketProvider at layout level |
| countryStates update | <1ms processing | Map update, no deep clone |
| Context re-renders | 0 unnecessary | Ref-based data for game loop, stable context split |
| Memory (hub pages) | <50MB additional | Lazy-loaded, unmounted on route change |

### 13.4 Prefetching Strategy

Next.js `<Link>` automatically prefetches routes on hover/viewport visibility:
- TopNavBar links prefetch on hover (100ms debounce)
- BottomTabBar links prefetch on mount (all 5 visible)
- SubTabBar links prefetch on parent route mount
- Dynamic route `/factions/[id]` prefetches on card hover

## 14. Security Considerations

### 14.1 Threat Surface (v13-Specific)

v13 is frontend-only and does not introduce new API endpoints. Security considerations:

| Threat | Risk | Mitigation |
|--------|------|-----------|
| XSS via URL params (`?country=`) | Low | Validate ISO3 codes against known list before rendering |
| WebSocket hijacking | Unchanged | Existing Go server CORS + origin validation |
| Wallet address spoofing | Low | WalletConnect button is UI-only (no real transactions in v13) |
| Route access control | N/A | No authentication system — all routes public |
| CountryStates data tampering | Low | Read-only from server, no client mutation path |

### 14.2 Input Validation

```typescript
// URL parameter validation
function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && KNOWN_COUNTRIES.has(code);
}

// Used in hub pages when reading ?country= param
const countryParam = searchParams.get('country');
const validCountry = countryParam && isValidCountryCode(countryParam) ? countryParam : null;
```

### 14.3 Content Security

- No `dangerouslySetInnerHTML` in new components
- All dynamic text rendered as text nodes (React auto-escapes)
- External links (CROSSx deep link) use `rel="noopener noreferrer"`

## 15. ADR Summary

### ADR-013-001: SocketProvider at RootLayout Level

**Status**: Accepted
**Context**: WebSocket connection dies on route transition because `useSocket()` is called in `page.tsx`.
**Decision**: Wrap entire app in `<SocketProvider>` at `layout.tsx` level. Provider creates socket once, shares via Context.
**Consequences**: Socket persists across all routes. All pages can access countryStates. Slight increase in root bundle (~5KB). Trade-off: socket connects even on hub pages where game data is not needed — acceptable because connection is lightweight (heartbeat only when not in game).

### ADR-013-002: Next.js Route Groups for Hub Layout

**Status**: Accepted
**Context**: Hub pages need shared navigation chrome (top nav, sub-tabs, background) but WORLD route (/) needs a completely different layout (full-screen Globe, no sub-tabs).
**Decision**: Use `(hub)` route group to isolate hub layout from WORLD route. The `(hub)` group name does NOT appear in URLs.
**Consequences**: Clean URL structure preserved (`/economy/tokens` not `/hub/economy/tokens`). Two distinct layout trees: RootLayout → page.tsx (WORLD) and RootLayout → HubLayout → hub pages. Existing route paths unchanged.
**Alternatives Considered**:
- Single layout with conditional rendering — rejected (complex, breaks separation of concerns)
- Separate `_app.tsx` pages — rejected (not compatible with App Router)

### ADR-013-003: Dual-Layer Context (Stable + Ref)

**Status**: Accepted
**Context**: `countryStates` updates at 1Hz, game state at 20Hz during play. If all consumers subscribe to one context, hub pages re-render unnecessarily during gameplay.
**Decision**: Split into stable context (connection state, game mode — changes rarely) and ref context (dataRef, uiStateRef, countryStatesRef — never triggers re-render).
**Consequences**: Hub pages only re-render on connection/game mode changes. Game components read from refs in `useFrame`. Slight API complexity (two hooks or combined hook with selective subscription). Prevents performance degradation as hub page count grows.

### ADR-013-004: CountryPanel Tab Extension (Inline vs Routing)

**Status**: Accepted
**Context**: CountryPanel could either (a) show tabs inline in the slide-in panel, or (b) route to separate pages (`/country/KOR/token`, `/country/KOR/vote`).
**Decision**: Inline tabs within the existing slide-in panel. No new routes for country detail views.
**Consequences**: Panel stays ephemeral (open/close without URL change). Country context does NOT survive page refresh (acceptable for alpha). Keeps route count manageable (13 vs 13+4N). Links from tabs to full hub pages preserve country via `?country=` URL param.

### ADR-013-005: Mobile Bottom Tab (5 Items Max)

**Status**: Accepted
**Context**: 7 top-level sections exist. iOS HIG and Material Design both recommend 3-5 bottom tab items.
**Decision**: 5 bottom tabs: WORLD, ECONOMY, GOVERN, FACTIONS, MORE. MORE opens a bottom sheet with remaining 3 items.
**Consequences**: Clean mobile navigation within guidelines. Users need one extra tap for Hall of Fame, Profile, Dashboard. These are lower-frequency features — acceptable trade-off.

## 16. Verification Matrix

### 16.1 Functional Verification

| ID | Requirement | Verification Method | Success Criteria |
|----|------------|-------------------|-----------------|
| V01 | Socket persists across route transitions | Manual test: navigate / → /economy → /governance while checking WS DevTools | WS connection ID unchanged, no disconnect events |
| V02 | countryStates accessible on hub pages | Dev console: log `useSocketContext().uiState.countryStates.size` on /economy | Size > 0 (countries loaded) |
| V03 | Game start redirect from hub | Trigger joinRoom while on /governance | Auto-navigates to /, game starts |
| V04 | All 24 orphaned components rendered | Visit each of 13 routes, check component mount | All components visible (even with mock data) |
| V05 | TopNavBar active state | Click each nav item | Gold underline on active route |
| V06 | BottomTabBar responsive | Resize to <768px | Bottom tab appears, top nav hides |
| V07 | CountryPanel 4 tabs | Click country on Globe, cycle tabs | All 4 tabs render content |
| V08 | Country URL param | Navigate to `/economy/tokens?country=KOR` | Korea highlighted in dashboard |
| V09 | MORE menu | Click MORE on desktop and mobile | Dropdown (desktop) / bottom sheet (mobile) |
| V10 | Lazy loading | Check Network tab on first hub visit | Chunk loaded on demand, not in initial bundle |

### 16.2 Non-Functional Verification

| ID | Requirement | Verification Method | Success Criteria |
|----|------------|-------------------|-----------------|
| NV01 | Initial bundle unchanged | `next build` → check `.next/analyze` | Main chunk size delta < 5KB |
| NV02 | LCP < 2.5s | Lighthouse mobile audit on / | LCP < 2.5s |
| NV03 | Mobile Lighthouse > 80 | Lighthouse mobile audit on /economy/tokens | Performance > 80 |
| NV04 | No layout shift on nav | CLS check during route transition | CLS < 0.1 |
| NV05 | Safe area support | Test on iPhone simulator (notch) | Bottom tab respects safe area |

### 16.3 Integration Verification

| ID | Requirement | Verification Method | Success Criteria |
|----|------------|-------------------|-----------------|
| IV01 | E2E tests find nav links | Run Playwright, check link detection | No `.catch(() => false)` silent skips |
| IV02 | Go server unchanged | `go build` server | Compiles without changes |
| IV03 | Shared types unchanged | `tsc --noEmit` on shared package | No type errors |

## 17. Open Questions

| # | Question | Impact | Proposed Resolution |
|---|----------|--------|-------------------|
| Q1 | Should SocketProvider connect immediately or lazy-connect on first socket-needing interaction? | Performance on first load | Connect immediately — connection is lightweight, and countryStates is needed on WORLD route which is the default landing page |
| Q2 | How to handle deep links to hub pages when user has never visited WORLD? | UX — user lands on /governance from shared link | SocketProvider connects automatically, countryStates populates; WORLD-specific state (appearance, name) not needed on hub pages |
| Q3 | Should CountryPanel state (selected tab) persist across close/reopen? | UX micro-detail | Reset to OVERVIEW on close — simpler implementation, matches expectation of "fresh panel" |
| Q4 | Should hub pages show a mini-globe or map preview? | Visual continuity | Deferred to v14 — dark grid background is sufficient for alpha |
| Q5 | Wallet integration: mock-only or real CROSSx connection in v13? | Scope | Mock-only (NG3) — WalletConnect button renders but shows "Coming Soon" on real connect attempts |

---

## Self-Verification Report

### Pass 1: Plan Coverage Check

| Plan Section | Architecture Coverage | Status |
|-------------|---------------------|--------|
| S1. Current State Analysis | S1.1-1.3 Overview | Covered |
| S2. Problem Definition | S2 Goals | Covered |
| S3. Design Principles | S12 Design System Integration | Covered |
| S4. Information Architecture | S6 Route Architecture | Covered |
| S5. Navigation System | S7 Navigation Components | Covered |
| S6. CountryPanel Extension | S8 CountryPanel Tabs | Covered |
| S7. Hub Page Details | S4.2 Layout Layer + S6.3 Route Mapping | Covered |
| S8. Responsive & Mobile | S11 Responsive Architecture | Covered |
| S9. Transition & Animation | S12.4 Page Transitions | Covered |
| S10. Orphaned Component Mapping | S4.5 Component Wiring Matrix | Covered |
| Implementation Roadmap (6 Phases) | Architecture supports all phases | Covered |

### Pass 2: Consistency & Completeness Check

| Check | Result | Notes |
|-------|--------|-------|
| All 24 orphaned components mapped? | 24/24 | Section 4.5 wiring matrix |
| All 13 routes defined? | 13/13 | Section 6.3 route mapping |
| SocketProvider API covers all page.tsx state? | Yes | Section 5.2 state ownership |
| SK design tokens referenced correctly? | Yes | Section 12.1 matches lib/sketch-ui.ts |
| Mobile breakpoints consistent? | Yes | 768px boundary consistent across S7, S8, S11 |
| WebSocket events unchanged? | Yes | Section 9.5 confirms no protocol changes |
| Lazy loading for all heavy components? | Yes | Section 10.2 registry |
| ADRs for all major decisions? | 5 ADRs | Sufficient for scope |
| Performance targets realistic? | Yes | Based on v12 baselines |
| No server changes required? | Confirmed | NG1 + Section 3.1 |

### Self-Improvement Applied

1. **Added dual-layer context design** (ADR-013-003) — original plan mentioned SocketProvider but didn't address re-render performance. Added stable vs ref context split.
2. **Added HubSkeleton component** (Section 10.4) — plan mentioned shimmer loading but no concrete component design. Added McPanel-based skeleton.
3. **Added prefetching strategy** (Section 13.4) — plan mentioned performance but no prefetch details. Added Next.js Link prefetch behavior.
4. **Clarified WORLD route navigation integration** (Section 7.6) — plan designed TopNavBar for hub but didn't specify how it integrates with existing LobbyHeader on the WORLD route. Clarified that TopNavBar embeds in LobbyHeader center area.
5. **Added input validation for URL params** (Section 14.2) — plan used `?country=KOR` throughout but didn't specify validation. Added ISO3 validation function.
