/**
 * v30 Phase 0 — Wallet Store (Zustand + Persist)
 * 글로벌 지갑 상태 관리: CROSSx 연결 상태를 localStorage에 영속화합니다.
 *
 * 사용법:
 *   const { address, isConnected, connect, disconnect } = useWalletStore();
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CROSS_CHAIN_CONFIG } from '@/lib/crossx-config';

// ─── State 타입 ───

interface WalletStoreState {
  /** 지갑 주소 (0x...) */
  address: string;
  /** CROSS Mainnet 체인 ID */
  chainId: number;
  /** 연결 상태 */
  isConnected: boolean;
  /** 연결 중 상태 */
  isConnecting: boolean;
}

interface WalletStoreActions {
  /** 지갑 연결 (mock 모드 기본, Phase 3+에서 CROSSx 콜백 연동) */
  connect: () => void;
  /** 지갑 해제 */
  disconnect: () => void;
  /** 외부에서 직접 주소를 설정합니다 (CROSSx 콜백용) */
  setAddress: (address: string) => void;
  /** 연결 중 상태를 설정합니다 */
  setConnecting: (connecting: boolean) => void;
}

type WalletStore = WalletStoreState & WalletStoreActions;

// ─── Store ───

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      // 초기 상태
      address: '',
      chainId: CROSS_CHAIN_CONFIG.chainId,
      isConnected: false,
      isConnecting: false,

      connect: () => {
        set({ isConnecting: true });

        // Mock 모드: 랜덤 주소 생성 (Phase 3+에서 CROSSx 콜백으로 교체 예정)
        const mockAddress =
          '0x' +
          Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join('');

        // 1초 후 연결 완료 시뮬레이션
        setTimeout(() => {
          set({
            address: mockAddress,
            chainId: CROSS_CHAIN_CONFIG.chainId,
            isConnected: true,
            isConnecting: false,
          });
        }, 1000);
      },

      disconnect: () => {
        set({
          address: '',
          chainId: CROSS_CHAIN_CONFIG.chainId,
          isConnected: false,
          isConnecting: false,
        });
      },

      setAddress: (address: string) => {
        set({
          address,
          isConnected: !!address,
          isConnecting: false,
        });
      },

      setConnecting: (connecting: boolean) => {
        set({ isConnecting: connecting });
      },
    }),
    {
      name: 'aww-wallet', // localStorage 키
      // isConnecting은 영속화하지 않습니다 (새로고침 시 항상 false)
      partialize: (state) => ({
        address: state.address,
        chainId: state.chainId,
        isConnected: state.isConnected,
      }),
    },
  ),
);
