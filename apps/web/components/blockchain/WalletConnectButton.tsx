'use client';

import { useState, useCallback } from 'react';
import {
  CROSSX_LINKS,
  isCrossxAvailable,
  openCrossx,
  type WalletState,
} from '@/lib/crossx-config';

interface WalletConnectButtonProps {
  onConnect?: (wallet: WalletState) => void;
  onDisconnect?: () => void;
  className?: string;
}

/**
 * CROSSx Wallet Connect Button
 * Deep links to CROSSx Super App for wallet connection
 */
export default function WalletConnectButton({
  onConnect,
  onDisconnect,
  className = '',
}: WalletConnectButtonProps) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(() => {
    if (wallet) {
      // Disconnect
      setWallet(null);
      onDisconnect?.();
      return;
    }

    setConnecting(true);

    if (isCrossxAvailable()) {
      // Deep link to CROSSx app
      const callbackUrl = typeof window !== 'undefined' ? window.location.href : '';
      openCrossx(CROSSX_LINKS.connect(callbackUrl));
    } else {
      // Simulate connection for dev/demo
      setTimeout(() => {
        const mockWallet: WalletState = {
          connected: true,
          address: '0x' + Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join(''),
          chainId: 0,
          balance: '0',
        };
        setWallet(mockWallet);
        onConnect?.(mockWallet);
        setConnecting(false);
      }, 1000);
    }
  }, [wallet, onConnect, onDisconnect]);

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        border: wallet ? '1px solid #4A9E4A' : '1px solid #CC9933',
        background: wallet
          ? 'rgba(74, 158, 74, 0.15)'
          : 'rgba(204, 153, 51, 0.15)',
        color: wallet ? '#4A9E4A' : '#CC9933',
        fontFamily: '"Rajdhani", sans-serif',
        fontWeight: 600,
        fontSize: '14px',
        cursor: connecting ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: connecting ? 0.6 : 1,
      }}
    >
      {/* Wallet icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 4V3C4 1.895 4.895 1 6 1H10C11.105 1 12 1.895 12 3V4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="9" r="1.5" fill="currentColor" />
      </svg>

      {connecting
        ? 'Connecting...'
        : wallet
          ? shortenAddress(wallet.address)
          : 'Connect CROSSx'}
    </button>
  );
}
