/**
 * appearance-cache.ts — 네트워크 appearance 캐시
 *
 * 서버 state broadcast의 `ap` 필드(packed BigInt string)를
 * unpack하여 agentId 기반으로 캐싱.
 * AgentInstances에서 resolveAppearance의 fallback 대신 실제 유저 설정 사용.
 *
 * 캐시 전략:
 * - state 수신 시 ap 필드가 있으면 unpack → 캐시 저장
 * - room 전환/disconnect 시 전체 클리어
 * - resolveAppearance에서 캐시 hit → 실제 appearance 반환
 */

import { unpackAppearance } from '@agent-survivor/shared';
import type { CubelingAppearance, AgentNetworkData } from '@agent-survivor/shared';

/** agentId → CubelingAppearance 캐시 */
const networkAppearanceCache = new Map<string, CubelingAppearance>();

/**
 * state 수신 시 에이전트 배열에서 ap 필드를 추출하여 캐시에 저장
 * ap가 빈 문자열이거나 없으면 스킵 (봇 또는 구 클라이언트)
 */
export function populateAppearanceCache(agents: AgentNetworkData[]): void {
  for (const agent of agents) {
    if (agent.ap && agent.ap.length > 0) {
      // 이미 캐시에 있으면 스킵 (같은 agentId의 appearance는 변하지 않음)
      if (networkAppearanceCache.has(agent.i)) continue;
      try {
        const unpacked = unpackAppearance(BigInt(agent.ap));
        networkAppearanceCache.set(agent.i, unpacked);
      } catch {
        // 잘못된 ap 값 — 무시 (skinId fallback 사용)
      }
    }
  }
}

/**
 * agentId로 캐시된 appearance 조회
 * 캐시 미스 시 undefined 반환 → 호출자가 skinId fallback 사용
 */
export function getCachedNetworkAppearance(agentId: string): CubelingAppearance | undefined {
  return networkAppearanceCache.get(agentId);
}

/**
 * 캐시 전체 클리어 (room 전환/disconnect 시 호출)
 */
export function clearAppearanceCache(): void {
  networkAppearanceCache.clear();
}

/**
 * 현재 캐시 사이즈 (디버깅용)
 */
export function getAppearanceCacheSize(): number {
  return networkAppearanceCache.size;
}
