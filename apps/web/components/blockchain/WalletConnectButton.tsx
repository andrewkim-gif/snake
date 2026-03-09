'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
import {
  CROSSX_LINKS,
  isCrossxAvailable,
  openCrossx,
} from '@/lib/crossx-config';

/** 연결 시도 타임아웃 (5초) */
const CONNECT_TIMEOUT_MS = 5000;

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

/**
 * CROSSx Wallet Connect Button
 * zustand 글로벌 스토어(useWalletStore)를 사용하여 지갑 연결 상태를 관리합니다.
 * 5초 타임아웃 + 언마운트 시 클린업을 포함합니다.
 */
export default function WalletConnectButton({
  onConnect,
  onDisconnect,
  className = '',
}: WalletConnectButtonProps) {
  const { address, isConnected, isConnecting, connect, disconnect, setConnecting } =
    useWalletStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 타이머 클린업
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // 연결 성공 시 콜백 호출
  useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address);
    }
  }, [isConnected, address, onConnect]);

  const handleClick = useCallback(() => {
    if (isConnected) {
      // 연결 해제
      disconnect();
      onDisconnect?.();
      return;
    }

    if (isConnecting) return;

    if (isCrossxAvailable()) {
      // CROSSx 딥링크 (Phase 3+에서 콜백 처리 추가 예정)
      const callbackUrl = typeof window !== 'undefined' ? window.location.href : '';
      openCrossx(CROSSX_LINKS.connect(callbackUrl));
      setConnecting(true);
    } else {
      // Mock 모드: zustand 스토어의 connect() 사용
      connect();
    }

    // 5초 타임아웃: 연결 중 상태가 계속되면 자동으로 해제합니다
    timeoutRef.current = setTimeout(() => {
      const state = useWalletStore.getState();
      if (state.isConnecting) {
        setConnecting(false);
      }
      timeoutRef.current = null;
    }, CONNECT_TIMEOUT_MS);
  }, [isConnected, isConnecting, connect, disconnect, setConnecting, onDisconnect]);

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: 0,
        border: isConnected ? '1px solid #4A9E4A' : '1px solid #CC9933',
        background: isConnected
          ? 'rgba(74, 158, 74, 0.15)'
          : 'rgba(204, 153, 51, 0.15)',
        color: isConnected ? '#4A9E4A' : '#CC9933',
        fontFamily: '"Rajdhani", sans-serif',
        fontWeight: 600,
        fontSize: '14px',
        cursor: isConnecting ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: isConnecting ? 0.6 : 1,
      }}
    >
      {/* Wallet icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 4V3C4 1.895 4.895 1 6 1H10C11.105 1 12 1.895 12 3V4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="9" r="1.5" fill="currentColor" />
      </svg>

      {isConnecting
        ? 'Connecting...'
        : isConnected
          ? shortenAddress(address)
          : 'Connect CROSSx'}
    </button>
  );
}
