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
