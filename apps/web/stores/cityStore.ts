/**
 * v26 Phase 1 — City Store (Zustand)
 * 아이소메트릭 도시 상태 관리 뼈대
 *
 * Phase 2+에서 경제·생산·시민·파벌 확장 예정
 */

import { create } from 'zustand';
import type { BuildingInstance, MapTier, TileCoord } from '@/components/game/iso/types';

// ─── State ───

interface CityState {
  /** 현재 관리 중인 국가 ISO3 */
  activeCountryIso3: string | null;
  /** 국가 이름 */
  activeCountryName: string | null;
  /** 맵 tier */
  mapTier: MapTier;
  /** 건물 목록 */
  buildings: BuildingInstance[];
  /** 선택된 타일 */
  selectedTile: TileCoord | null;
  /** 현재 배치 중인 건물 ID */
  placingBuildingId: string | null;
}

// ─── Actions ───

interface CityActions {
  /** 국가 진입 (Globe → Iso 전환 시) */
  enterCountry: (iso3: string, name: string, tier?: MapTier) => void;
  /** 국가 퇴장 (Iso → Globe 복귀 시) */
  leaveCountry: () => void;
  /** 건물 추가 */
  addBuilding: (building: BuildingInstance) => void;
  /** 타일 선택 */
  selectTile: (tile: TileCoord | null) => void;
  /** 배치 모드 설정 */
  setPlacingBuilding: (defId: string | null) => void;
}

// ─── Store ───

export const useCityStore = create<CityState & CityActions>((set) => ({
  // 초기 상태
  activeCountryIso3: null,
  activeCountryName: null,
  mapTier: 'C',
  buildings: [],
  selectedTile: null,
  placingBuildingId: null,

  // 액션
  enterCountry: (iso3, name, tier = 'C') =>
    set({
      activeCountryIso3: iso3,
      activeCountryName: name,
      mapTier: tier,
      buildings: [],
      selectedTile: null,
      placingBuildingId: null,
    }),

  leaveCountry: () =>
    set({
      activeCountryIso3: null,
      activeCountryName: null,
      buildings: [],
      selectedTile: null,
      placingBuildingId: null,
    }),

  addBuilding: (building) =>
    set((state) => ({ buildings: [...state.buildings, building] })),

  selectTile: (tile) =>
    set({ selectedTile: tile }),

  setPlacingBuilding: (defId) =>
    set({ placingBuildingId: defId }),
}));
