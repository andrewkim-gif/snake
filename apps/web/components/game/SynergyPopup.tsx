'use client';

/**
 * SynergyPopup — 시너지 발동 토스트 알림
 * MC 골드 스타일, 3초 자동 사라짐
 */

import { useState, useEffect, useRef } from 'react';
import type { SynergyActivatedPayload } from '@snake-arena/shared';
import { MC, pixelFont, bodyFont, mcPanelShadow } from '@/lib/minecraft-ui';

interface SynergyPopupProps {
  synergies: SynergyActivatedPayload[];
  onDismiss: (synergyId: string) => void;
}

export function SynergyPopup({ synergies, onDismiss }: SynergyPopupProps) {
  if (synergies.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: '80px', right: '16px',
      display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 18, pointerEvents: 'none',
    }}>
      {synergies.map((synergy) => (
        <SynergyToast key={synergy.synergyId} synergy={synergy} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function SynergyToast({
  synergy, onDismiss,
}: {
  synergy: SynergyActivatedPayload;
  onDismiss: (synergyId: string) => void;
}) {
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    timerRef.current = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => onDismiss(synergy.synergyId), 300);
    }, 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [synergy.synergyId, onDismiss]);

  return (
    <div style={{
      backgroundColor: MC.panelBg, boxShadow: mcPanelShadow(),
      border: `2px solid ${MC.textGold}`, padding: '8px 14px', maxWidth: '240px',
      opacity, transition: 'opacity 300ms ease', pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGold,
          backgroundColor: 'rgba(255,170,0,0.2)', padding: '1px 5px', letterSpacing: '0.06em',
        }}>
          SYNERGY
        </span>
        <span style={{
          fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textGold,
          textShadow: '1px 1px 0 #553300',
        }}>
          {synergy.name}
        </span>
      </div>
      <div style={{
        fontFamily: bodyFont, fontSize: '0.7rem', color: MC.textSecondary, lineHeight: '1.3',
      }}>
        {synergy.description}
      </div>
    </div>
  );
}
