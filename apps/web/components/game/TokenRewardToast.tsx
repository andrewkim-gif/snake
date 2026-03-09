'use client';

/**
 * v30 Task 1-7: Token Reward Toast
 * 토큰 보상 수신 시 화면 하단에 3초 자동 fade-out 토스트를 표시합니다.
 */

import { useEffect, useState, useCallback } from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';
import type { TokenRewardData } from '@/hooks/useSocket';

interface TokenRewardToastProps {
  rewards: TokenRewardData[];
}

interface ToastItem {
  id: string;
  amount: number;
  tokenType: string;
  reason: string;
  visible: boolean;
}

const TOAST_DURATION = 3000; // 3초 후 fade out
const FADE_DURATION = 500; // 0.5초 fade 애니메이션

export function TokenRewardToast({ rewards }: TokenRewardToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 새 보상이 추가되면 토스트를 생성합니다
  const lastReward = rewards[rewards.length - 1];
  const lastRewardId = lastReward?.id;

  useEffect(() => {
    if (!lastReward || !lastRewardId) return;

    const toast: ToastItem = {
      id: lastRewardId,
      amount: lastReward.amount,
      tokenType: lastReward.tokenType,
      reason: lastReward.reason,
      visible: true,
    };

    setToasts(prev => {
      // 중복 방지
      if (prev.some(t => t.id === toast.id)) return prev;
      return [...prev, toast].slice(-5); // 최대 5개까지 표시
    });

    // 3초 후 fade out 시작
    const fadeTimer = setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === lastRewardId ? { ...t, visible: false } : t))
      );
    }, TOAST_DURATION);

    // fade 완료 후 제거
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== lastRewardId));
    }, TOAST_DURATION + FADE_DURATION);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [lastRewardId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => {
        const tokenLabel = toast.tokenType === 'AWW' ? '$AWW' : `$${toast.tokenType}`;
        return (
          <div
            key={toast.id}
            style={{
              background: 'rgba(17, 17, 17, 0.95)',
              border: `1px solid ${SK.gold}`,
              borderRadius: 8,
              padding: '10px 20px',
              fontFamily: bodyFont,
              fontSize: 14,
              color: SK.gold,
              fontWeight: 700,
              textAlign: 'center',
              opacity: toast.visible ? 1 : 0,
              transition: `opacity ${FADE_DURATION}ms ease-out`,
              boxShadow: `0 0 20px rgba(204, 153, 51, 0.3)`,
              whiteSpace: 'nowrap',
            }}
          >
            +{toast.amount.toFixed(1)} {tokenLabel} tokens
          </div>
        );
      })}
    </div>
  );
}
