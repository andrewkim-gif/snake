'use client';

/**
 * useTerritoryVisualization — 서버 영토 데이터(ITerritoryRegion[])를
 * GlobeDominationLayer가 요구하는 Map<string, CountryDominationState>로 변환하는 훅.
 *
 * useTycoonSocket의 territories 배열을 받아서 국가 단위로 집계한 뒤
 * GlobeDominationLayer에 바로 전달할 수 있는 dominationStates를 반환한다.
 *
 * 집계 규칙:
 * - region_code → countryISO3 매핑으로 국가별 그룹핑
 * - 가장 많은 region을 지배하는 controller가 dominant player
 * - control_pct 가중 평균으로 국가 전체 지배도 결정
 * - sovereignty_level: 국가 내 최고 sovereignty를 대표값으로 사용
 * - contested: 2명 이상 controller가 region을 나눠 가지면 true
 */

import { useMemo, useRef } from 'react';
import type { ITerritoryRegion } from '@/hooks/useTycoonSocket';
import type { CountryDominationState, DominationLevel } from '@/components/3d/GlobeDominationLayer';
import { getNationColor } from '@/components/3d/GlobeDominationLayer';

// ─── region_code → country ISO3 매핑 ───

const REGION_TO_COUNTRY: Record<string, string> = {
  // 서울 구역들 → KOR
  'seoul-gangnam': 'KOR',
  'seoul-jongno': 'KOR',
  'seoul-songpa': 'KOR',
  'seoul-mapo': 'KOR',
  'seoul-yongsan': 'KOR',
  // 도쿄 구역들 → JPN
  'tokyo-shibuya': 'JPN',
  'tokyo-shinjuku': 'JPN',
  'tokyo-akihabara': 'JPN',
  'tokyo-roppongi': 'JPN',
  'tokyo-ginza': 'JPN',
  // 뉴욕 구역들 → USA
  'newyork-manhattan': 'USA',
  'newyork-brooklyn': 'USA',
  'newyork-queens': 'USA',
  'newyork-bronx': 'USA',
  'newyork-staten': 'USA',
};

// ─── sovereignty_level 순서 (인덱스가 높을수록 상위) ───

const SOVEREIGNTY_RANK: Record<string, number> = {
  'none': 0,
  'active': 1,
  'sovereignty': 2,
  'hegemony': 3,
};

// ─── 훅 반환 타입 ───

export interface IUseTerritoryVisualization {
  /** GlobeDominationLayer에 바로 전달 가능한 dominationStates */
  dominationStates: Map<string, CountryDominationState>;
}

/**
 * 서버 영토 데이터를 Globe domination 시각화 형태로 변환.
 *
 * @param territories - useTycoonSocket에서 받은 ITerritoryRegion 배열
 * @returns dominationStates — Map<string, CountryDominationState>
 */
export function useTerritoryVisualization(
  territories: ITerritoryRegion[],
): IUseTerritoryVisualization {
  // 이전 상태를 ref로 유지 (전환 애니메이션용)
  const prevStatesRef = useRef<Map<string, CountryDominationState>>(new Map());

  const dominationStates = useMemo(() => {
    if (!territories || territories.length === 0) {
      return new Map<string, CountryDominationState>();
    }

    const previousStates = prevStatesRef.current;

    // 1단계: 국가별 region 그룹핑
    const countryGroups = new Map<string, ITerritoryRegion[]>();
    for (const t of territories) {
      const iso3 = REGION_TO_COUNTRY[t.region_code];
      if (!iso3) continue;
      if (!countryGroups.has(iso3)) countryGroups.set(iso3, []);
      countryGroups.get(iso3)!.push(t);
    }

    // 2단계: 국가별 CountryDominationState 생성
    const states = new Map<string, CountryDominationState>();

    for (const [iso3, regions] of countryGroups) {
      const prevState = previousStates.get(iso3);

      // controller별 region 수 집계
      const controllerCounts = new Map<string, { count: number; name: string }>();
      let maxSovereigntyRank = 0;
      let maxSovereigntyLevel: DominationLevel = 'none';
      let totalControlled = 0;

      for (const r of regions) {
        // sovereignty_level 최고값 추적
        const rank = SOVEREIGNTY_RANK[r.sovereignty_level] ?? 0;
        if (rank > maxSovereigntyRank) {
          maxSovereigntyRank = rank;
          maxSovereigntyLevel = r.sovereignty_level as DominationLevel;
        }

        // controller 집계
        if (r.controller_id) {
          totalControlled++;
          const existing = controllerCounts.get(r.controller_id);
          if (existing) {
            existing.count++;
          } else {
            controllerCounts.set(r.controller_id, {
              count: 1,
              name: r.controller_name || '',
            });
          }
        }
      }

      // 지배 controller가 없는 경우
      if (totalControlled === 0) {
        const prevColor = prevState?.color || '#666666';
        states.set(iso3, {
          iso3,
          dominantNation: '',
          level: 'none',
          color: '#666666',
          transitionProgress: prevColor !== '#666666' ? 0.0 : 1.0,
          previousColor: prevColor,
          contested: false,
          previousLevel: prevState?.level ?? 'none',
        });
        continue;
      }

      // 가장 많은 region을 지배한 controller 찾기
      let dominantId = '';
      let maxCount = 0;
      for (const [cid, data] of controllerCounts) {
        if (data.count > maxCount) {
          maxCount = data.count;
          dominantId = cid;
        }
      }

      // 분쟁 판정: 2명 이상 controller가 region을 나눠 가짐
      const contested = controllerCounts.size > 1;

      // 색상 결정: dominant controller가 있으면 국가 대표색 사용
      // getNationColor는 unknown ISO3에도 해시 기반 색상을 반환
      const color = dominantId ? getNationColor(iso3) : '#666666';
      const prevColor = prevState?.color || '#666666';
      const isTransition = prevColor !== color;

      // sovereignty level: 전체 지배 시 최고 sovereignty, 부분 지배 시 active
      const level: DominationLevel =
        totalControlled === regions.length && maxSovereigntyLevel !== 'none'
          ? maxSovereigntyLevel
          : totalControlled > 0
            ? 'active'
            : 'none';

      states.set(iso3, {
        iso3,
        dominantNation: dominantId,
        level,
        color,
        transitionProgress: isTransition ? 0.0 : 1.0,
        previousColor: prevColor,
        contested,
        previousLevel: prevState?.level ?? 'none',
      });
    }

    // 현재 상태를 다음 전환용으로 저장
    prevStatesRef.current = states;
    return states;
  }, [territories]);

  return { dominationStates };
}
