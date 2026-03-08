/**
 * v26 Phase 4 — City Store (Zustand)
 * 아이소메트릭 도시 상태 관리 + 경제 UI 상태
 *
 * Phase 1: 기본 맵/건물 상태
 * Phase 4: 자원 HUD, 건물 정보, 경제 대시보드, 건설 패널 UI 상태
 */

import { create } from 'zustand';
import type { BuildingInstance, MapTier, TileCoord } from '@/components/game/iso/types';
import type {
  Building,
  CityResourceType,
  CityEconomyStats,
  TradeRoute,
} from '@agent-survivor/shared/types/city';

// ─── UI 상태 타입 ───

/** 건설 패널 카테고리 필터 */
export type ConstructionCategory = 'all' | 'raw_extraction' | 'processing' | 'advanced' | 'service' | 'infrastructure' | 'military' | 'government';

// ─── State ───

interface CityState {
  /** 현재 관리 중인 국가 ISO3 */
  activeCountryIso3: string | null;
  /** 국가 이름 */
  activeCountryName: string | null;
  /** 맵 tier */
  mapTier: MapTier;
  /** 건물 목록 (Phase 1 로컬 인스턴스) */
  buildings: BuildingInstance[];
  /** 선택된 타일 */
  selectedTile: TileCoord | null;
  /** 현재 배치 중인 건물 ID */
  placingBuildingId: string | null;

  // ── Phase 4: 서버 동기화 상태 ──
  /** 서버 건물 목록 (CityClientState.buildings) */
  serverBuildings: Building[];
  /** 자원 재고 (CityClientState.resources) */
  resources: Record<string, number>;
  /** 국고 잔액 */
  treasury: number;
  /** GDP */
  gdp: number;
  /** 인구 */
  population: number;
  /** 행복도 (0~100) */
  happiness: number;
  /** 발전 용량 */
  powerGen: number;
  /** 전력 사용량 */
  powerUse: number;
  /** 고용 인구 */
  employed: number;
  /** 실업 인구 */
  unemployed: number;
  /** 세율 (0~1) */
  taxRate: number;
  /** 교역 루트 */
  tradeRoutes: TradeRoute[];
  /** 경제 통계 (직전 틱) */
  economyStats: CityEconomyStats | null;

  // ── Phase 4: UI 상태 ──
  /** 선택된 건물 ID (건물 정보 패널용) */
  selectedBuildingId: string | null;
  /** 경제 대시보드 표시 */
  showEconomyDashboard: boolean;
  /** 건설 패널 표시 */
  showConstructionPanel: boolean;
  /** 생산 체인 오버레이 표시 */
  showProductionChain: boolean;
  /** 건설 패널 카테고리 필터 */
  constructionCategory: ConstructionCategory;
}

// ─── Actions ───

interface CityActions {
  /** 국가 진입 (Globe → Iso 전환 시) */
  enterCountry: (iso3: string, name: string, tier?: MapTier) => void;
  /** 국가 퇴장 (Iso → Globe 복귀 시) */
  leaveCountry: () => void;
  /** 건물 추가 (Phase 1 로컬) */
  addBuilding: (building: BuildingInstance) => void;
  /** 타일 선택 */
  selectTile: (tile: TileCoord | null) => void;
  /** 배치 모드 설정 */
  setPlacingBuilding: (defId: string | null) => void;

  // ── Phase 4: 서버 상태 업데이트 ──
  /** 서버 city_state 수신 시 전체 동기화 */
  syncCityState: (data: {
    buildings: Building[];
    resources: Record<string, number>;
    treasury: number;
    gdp: number;
    population: number;
    happiness: number;
    powerGen: number;
    powerUse: number;
    employed: number;
    unemployed: number;
    taxRate: number;
    tradeRoutes: TradeRoute[];
  }) => void;
  /** 경제 통계 업데이트 */
  setEconomyStats: (stats: CityEconomyStats) => void;

  // ── Phase 4: UI 액션 ──
  /** 건물 선택 (정보 패널용) */
  selectBuilding: (buildingId: string | null) => void;
  /** 경제 대시보드 토글 */
  toggleEconomyDashboard: () => void;
  /** 건설 패널 토글 */
  toggleConstructionPanel: () => void;
  /** 생산 체인 오버레이 토글 */
  toggleProductionChain: () => void;
  /** 건설 패널 카테고리 필터 변경 */
  setConstructionCategory: (cat: ConstructionCategory) => void;
}

// ─── Store ───

export const useCityStore = create<CityState & CityActions>((set) => ({
  // 초기 상태 — Phase 1
  activeCountryIso3: null,
  activeCountryName: null,
  mapTier: 'C',
  buildings: [],
  selectedTile: null,
  placingBuildingId: null,

  // 초기 상태 — Phase 4: 서버 동기화
  serverBuildings: [],
  resources: {},
  treasury: 0,
  gdp: 0,
  population: 0,
  happiness: 50,
  powerGen: 0,
  powerUse: 0,
  employed: 0,
  unemployed: 0,
  taxRate: 0.1,
  tradeRoutes: [],
  economyStats: null,

  // 초기 상태 — Phase 4: UI
  selectedBuildingId: null,
  showEconomyDashboard: false,
  showConstructionPanel: false,
  showProductionChain: false,
  constructionCategory: 'all',

  // ── Phase 1 액션 ──
  enterCountry: (iso3, name, tier = 'C') =>
    set({
      activeCountryIso3: iso3,
      activeCountryName: name,
      mapTier: tier,
      buildings: [],
      selectedTile: null,
      placingBuildingId: null,
      // Phase 4 상태 초기화
      serverBuildings: [],
      resources: {},
      treasury: 0,
      gdp: 0,
      population: 0,
      happiness: 50,
      powerGen: 0,
      powerUse: 0,
      employed: 0,
      unemployed: 0,
      taxRate: 0.1,
      tradeRoutes: [],
      economyStats: null,
      selectedBuildingId: null,
      showEconomyDashboard: false,
      showConstructionPanel: false,
      showProductionChain: false,
      constructionCategory: 'all',
    }),

  leaveCountry: () =>
    set({
      activeCountryIso3: null,
      activeCountryName: null,
      buildings: [],
      selectedTile: null,
      placingBuildingId: null,
      serverBuildings: [],
      resources: {},
      treasury: 0,
      gdp: 0,
      population: 0,
      happiness: 50,
      powerGen: 0,
      powerUse: 0,
      employed: 0,
      unemployed: 0,
      taxRate: 0.1,
      tradeRoutes: [],
      economyStats: null,
      selectedBuildingId: null,
      showEconomyDashboard: false,
      showConstructionPanel: false,
      showProductionChain: false,
      constructionCategory: 'all',
    }),

  addBuilding: (building) =>
    set((state) => ({ buildings: [...state.buildings, building] })),

  selectTile: (tile) =>
    set({ selectedTile: tile }),

  setPlacingBuilding: (defId) =>
    set({ placingBuildingId: defId }),

  // ── Phase 4: 서버 동기화 ──
  syncCityState: (data) =>
    set({
      serverBuildings: data.buildings,
      resources: data.resources,
      treasury: data.treasury,
      gdp: data.gdp,
      population: data.population,
      happiness: data.happiness,
      powerGen: data.powerGen,
      powerUse: data.powerUse,
      employed: data.employed,
      unemployed: data.unemployed,
      taxRate: data.taxRate,
      tradeRoutes: data.tradeRoutes,
    }),

  setEconomyStats: (stats) =>
    set({ economyStats: stats }),

  // ── Phase 4: UI 액션 ──
  selectBuilding: (buildingId) =>
    set({ selectedBuildingId: buildingId, showProductionChain: buildingId !== null }),

  toggleEconomyDashboard: () =>
    set((state) => ({ showEconomyDashboard: !state.showEconomyDashboard })),

  toggleConstructionPanel: () =>
    set((state) => ({ showConstructionPanel: !state.showConstructionPanel })),

  toggleProductionChain: () =>
    set((state) => ({ showProductionChain: !state.showProductionChain })),

  setConstructionCategory: (cat) =>
    set({ constructionCategory: cat }),
}));
