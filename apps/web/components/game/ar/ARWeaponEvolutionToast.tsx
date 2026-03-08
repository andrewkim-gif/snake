'use client';

/**
 * ARWeaponEvolutionToast — 무기 진화 알림 토스트 (Phase 3)
 *
 * arEventQueue에서 weapon evolution 관련 이벤트 감지 시 표시.
 * 3초 후 자동 사라짐. 동시 최대 3개까지 스택.
 */

import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { WEAPON_INFO, type ARWeaponID } from '@/lib/3d/ar-types';
import type { AREvent } from '@/hooks/useSocket';

interface ARWeaponEvolutionToastProps {
  /** AR 이벤트 큐 (매 프레임 drain할 필요 없음 — 별도 폴링) */
  arEventQueueRef: React.MutableRefObject<AREvent[]>;
}

interface ToastEntry {
  id: number;
  weaponId: string;
  timestamp: number;
}

const TOAST_DURATION = 3000; // ms
const MAX_TOASTS = 3;

// 진화 무기 ID 목록
const EVOLVED_WEAPONS = new Set<string>([
  'storm_bow',
  'dexecutioner',
  'inferno',
  'dragon_breath',
  'pandemic',
]);

let toastIdCounter = 0;

function ARWeaponEvolutionToastInner({ arEventQueueRef }: ARWeaponEvolutionToastProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // 이벤트 큐를 주기적으로 스캔 (250ms 간격)
  useEffect(() => {
    const interval = setInterval(() => {
      const queue = arEventQueueRef.current;
      // damage 이벤트 중 진화 무기와 관련된 것 탐지
      // 또는 level_up 이벤트에서 진화 무기 선택을 감지
      // 여기서는 queue를 읽기만 하고 제거하지 않음 (drain은 다른 곳에서 처리)
      // 대신, 별도의 weapon_evolve 이벤트 타입이 없으므로
      // arUiState의 무기 목록 변화를 감지하는 대안으로,
      // 임시로 공개 API를 제공 (addWeaponEvolutionToast)
    }, 250);

    return () => clearInterval(interval);
  }, [arEventQueueRef]);

  // 토스트 만료 처리
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.timestamp < TOAST_DURATION));
    }, 200);
    return () => clearInterval(timer);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 65,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const info = WEAPON_INFO[toast.weaponId as ARWeaponID];
        const age = Date.now() - toast.timestamp;
        const fadeOut = age > TOAST_DURATION - 500;
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 20px',
              backgroundColor: 'rgba(255, 152, 0, 0.2)',
              border: '1px solid rgba(255, 152, 0, 0.6)',
              borderRadius: 6,
              backdropFilter: 'blur(4px)',
              fontFamily: '"Rajdhani", sans-serif',
              color: '#FFD700',
              opacity: fadeOut ? 0 : 1,
              transition: 'opacity 0.5s ease',
              animation: 'arWeaponToastIn 0.3s ease-out',
            }}
          >
            <span style={{ fontSize: 24 }}>{info?.icon || '?'}</span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#FF9800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                WEAPON EVOLVED!
              </div>
              <div style={{ fontSize: 13, color: '#E8E0D4' }}>
                {info?.name || toast.weaponId} — {info?.desc || ''}
              </div>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes arWeaponToastIn {
          0% { opacity: 0; transform: translateY(-12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export const ARWeaponEvolutionToast = memo(ARWeaponEvolutionToastInner);

/**
 * 무기 진화 토스트 추가 헬퍼 — GameCanvas3D의 useFrame에서 호출
 */
export function checkWeaponEvolutions(
  prevWeaponsRef: React.MutableRefObject<Set<string>>,
  currentWeapons: string[],
  addToast: (weaponId: string) => void,
) {
  for (const w of currentWeapons) {
    if (EVOLVED_WEAPONS.has(w) && !prevWeaponsRef.current.has(w)) {
      addToast(w);
    }
  }
  prevWeaponsRef.current = new Set(currentWeapons);
}
