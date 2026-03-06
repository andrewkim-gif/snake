/**
 * S40: Code Splitting — Lazy Load Heavy Components
 *
 * Heavy components are loaded on-demand:
 *   - GlobeView (three-globe + R3F): ~400KB
 *   - WorldMap (MapLibre GL): ~350KB
 *   - BattleView (game canvas): ~200KB
 *   - Dashboard charts: ~150KB
 *
 * Usage in pages:
 *   const GlobeView = LazyGlobeView;
 *   <Suspense fallback={<LoadingSkeleton />}>
 *     <GlobeView {...props} />
 *   </Suspense>
 */

import dynamic from 'next/dynamic';

// ============================================================
// 1. Globe View (three-globe + R3F) — largest bundle
// ============================================================

export const LazyGlobeView = dynamic(
  () => import('@/components/lobby/GlobeView').then((mod) => ({ default: mod.GlobeView })),
  {
    ssr: false, // WebGL requires browser
    loading: () => null,
  },
);

// ============================================================
// 2. World Map (MapLibre GL JS)
// ============================================================

export const LazyWorldMap = dynamic(
  () => import('@/components/world/WorldMap').then((mod) => ({ default: mod.WorldMap })),
  {
    ssr: false, // MapLibre requires browser
    loading: () => null,
  },
);

// ============================================================
// 3. World View (Globe + Map combined)
// ============================================================

export const LazyWorldView = dynamic(
  () => import('@/components/world/WorldView').then((mod) => ({ default: mod.WorldView })),
  {
    ssr: false,
    loading: () => null,
  },
);

// ============================================================
// 4. Country Detail Panel
// ============================================================

export const LazyCountryPanel = dynamic(
  () => import('@/components/world/CountryPanel').then((mod) => ({ default: mod.CountryPanel })),
  {
    loading: () => null,
  },
);

// ============================================================
// 5. Spectator View (battle canvas)
// ============================================================

export const LazySpectatorView = dynamic(
  () =>
    import('@/components/spectator/SpectatorView').then((mod) => ({
      default: mod.SpectatorView,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

// ============================================================
// 6. Faction Dashboard
// ============================================================

export const LazyFactionDashboard = dynamic(
  () => import('@/components/faction/FactionDashboard'),
  {
    loading: () => null,
  },
);

// ============================================================
// v13: Hub Page Components — Orphaned → Lazy Loaded
// ============================================================

// 7. Economy — TradeMarket (오더북 UI)
export const LazyTradeMarket = dynamic(
  () => import('@/components/economy/TradeMarket'),
  { loading: () => null },
);

// 8. Economy — PolicyPanel (경제 정책)
export const LazyPolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  { loading: () => null },
);

// 9. Governance — ProposalList (제안 목록)
export const LazyProposalList = dynamic(
  () => import('@/components/governance/ProposalList'),
  { loading: () => null },
);

// 10. Governance — ProposalForm (새 제안 작성)
export const LazyProposalForm = dynamic(
  () => import('@/components/governance/ProposalForm'),
  { loading: () => null },
);

// 11. Governance — VoteInterface (투표 UI)
export const LazyVoteInterface = dynamic(
  () => import('@/components/governance/VoteInterface'),
  { loading: () => null },
);

// 12. Governance — VoteHistory (투표 이력)
export const LazyVoteHistory = dynamic(
  () => import('@/components/governance/VoteHistory'),
  { loading: () => null },
);

// 13. Faction — FactionList (팩션 목록)
export const LazyFactionList = dynamic(
  () => import('@/components/faction/FactionList'),
  { loading: () => null },
);

// 14. Faction — FactionDetail (팩션 상세)
export const LazyFactionDetail = dynamic(
  () => import('@/components/faction/FactionDetail'),
  { loading: () => null },
);

// 15. Market — MercenaryMarket (용병 시장)
export const LazyMercenaryMarket = dynamic(
  () => import('@/components/market/MercenaryMarket'),
  { loading: () => null },
);

// 16. Hall of Fame (명예의 전당)
export const LazyHallOfFame = dynamic(
  () => import('@/components/hall-of-fame/HallOfFame'),
  { loading: () => null },
);

// 17. Profile — Achievements (업적)
export const LazyAchievements = dynamic(
  () => import('@/components/profile/Achievements'),
  { loading: () => null },
);
