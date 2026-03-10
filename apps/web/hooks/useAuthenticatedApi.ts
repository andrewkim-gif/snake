'use client';

/**
 * useAuthenticatedApi — 인증된 API 호출 + walletStore 연동 공통 훅
 *
 * 사용법:
 *   const { authFetch, playerId, isConnected, factionId } = useAuthenticatedApi();
 *   const result = await authFetch('/api/council/propose', { method: 'POST', body: ... });
 */

import { useCallback, useEffect, useState } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
import { apiFetch } from '@/lib/api-client';

interface FactionMember {
  user_id: string;
  role: string;
}

interface FactionDetail {
  id: string;
  name: string;
  members: FactionMember[];
}

interface UseAuthenticatedApiReturn {
  /** wallet address (연결 안 되면 'local-user') */
  playerId: string;
  /** wallet 연결 상태 */
  isConnected: boolean;
  /** wallet address (raw) */
  walletAddress: string;
  /** 소속 팩션 ID (없으면 null) */
  factionId: string | null;
  /** 팩션 내 역할 (없으면 null) */
  factionRole: string | null;
  /** Council 이상 권한 여부 */
  hasCouncilPermission: boolean;
  /** 인증된 apiFetch 래퍼 (wallet address를 자동으로 Bearer 토큰에 포함) */
  authFetch: <T>(path: string, opts?: RequestInit) => Promise<T | null>;
}

/** 역할 레벨 매핑 (서버 faction.go와 동일) */
const ROLE_LEVELS: Record<string, number> = {
  member: 1,
  commander: 2,
  council: 3,
  supreme_leader: 4,
};

export function useAuthenticatedApi(): UseAuthenticatedApiReturn {
  const { address, isConnected } = useWalletStore();
  const playerId = isConnected && address ? address : 'local-user';

  const [factionId, setFactionId] = useState<string | null>(null);
  const [factionRole, setFactionRole] = useState<string | null>(null);

  // 소속 팩션 조회
  useEffect(() => {
    if (!isConnected || !address) {
      setFactionId(null);
      setFactionRole(null);
      return;
    }

    let cancelled = false;

    async function findMyFaction() {
      const factions = await apiFetch<FactionDetail[]>('/api/factions');
      if (cancelled || !factions) return;

      for (const faction of factions) {
        if (!faction.members) continue;
        const member = faction.members.find(
          (m) => m.user_id.toLowerCase() === address.toLowerCase(),
        );
        if (member) {
          setFactionId(faction.id);
          setFactionRole(member.role);
          return;
        }
      }
      setFactionId(null);
      setFactionRole(null);
    }

    findMyFaction();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const hasCouncilPermission =
    factionRole !== null && (ROLE_LEVELS[factionRole] ?? 0) >= ROLE_LEVELS.council;

  const authFetch = useCallback(
    <T,>(path: string, opts: RequestInit = {}): Promise<T | null> => {
      return apiFetch<T>(path, {
        ...opts,
        authenticated: true,
      });
    },
    [],
  );

  return {
    playerId,
    isConnected,
    walletAddress: address,
    factionId,
    factionRole,
    hasCouncilPermission,
    authFetch,
  };
}
