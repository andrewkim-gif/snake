'use client';

/**
 * MinimapHUD — 우하단 미니맵 + 국가 이름 표시
 * v12 S23: 미니맵 상단에 "KOREA (Tier A)" 국가 이름 표시
 * GameMinimap을 감싸며 국가 레이블 추가
 * NOTE: GameMinimap은 position:absolute(bottom:12, right:12)를 가지므로
 *       MinimapHUD는 그 위에 국가 레이블만 추가 배치
 */

import type { GameData } from '@/hooks/useSocket';
import type { ArenaShrinkPayload } from '@agent-survivor/shared';

interface MinimapHUDProps {
  dataRef: React.MutableRefObject<GameData>;
  arenaRadius: number;
  shrinkData: ArenaShrinkPayload | null;
  countryName?: string;
  countryTier?: string;
}

const MAP_SIZE = 140; // GameMinimap과 동일한 크기

const TIER_COLORS: Record<string, string> = {
  S: '#FF5555',
  A: '#CC9933',
  B: '#55FFFF',
  C: '#AAAAAA',
  D: '#666666',
};

export function MinimapHUD({
  countryName,
  countryTier,
}: MinimapHUDProps) {
  // GameMinimap은 별도로 마운트됨 (GameCanvas3D에서)
  // 이 컴포넌트는 미니맵 위에 국가 이름 레이블만 표시
  const tierColor = TIER_COLORS[countryTier ?? 'C'] ?? '#AAAAAA';

  if (!countryName) return null;

  return (
    <div style={{
      position: 'absolute',
      // GameMinimap 바로 위에 배치 (bottom: 12px + MAP_SIZE + gap)
      bottom: `${12 + MAP_SIZE + 4}px`,
      right: '12px',
      zIndex: 15,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
      width: MAP_SIZE,
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", "Inter", sans-serif',
        fontSize: '11px',
        fontWeight: 700,
        color: '#E8E0D4',
        backgroundColor: 'rgba(17, 17, 17, 0.8)',
        padding: '2px 8px',
        border: '1px solid rgba(255,255,255,0.15)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        whiteSpace: 'nowrap',
      }}>
        <span>{countryName}</span>
        {countryTier && (
          <span style={{
            fontSize: '9px',
            color: tierColor,
            border: `1px solid ${tierColor}60`,
            padding: '0 3px',
            lineHeight: '14px',
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontWeight: 600,
          }}>
            Tier {countryTier}
          </span>
        )}
      </div>
    </div>
  );
}
