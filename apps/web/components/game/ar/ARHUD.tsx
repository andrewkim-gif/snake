'use client';

/**
 * ARHUD — Arena 전투 HUD (HTML 오버레이)
 *
 * 화면 하단/모서리에 배치:
 * - HP 바 (하단 중앙)
 * - XP 바 (HP 바 아래)
 * - 레벨 표시
 * - 타이머 (상단 중앙)
 * - 페이즈 표시
 * - 웨이브 카운터
 * - 킬 카운터
 */

import type { ARPhase } from '@/lib/3d/ar-types';

interface ARHUDProps {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  phase: ARPhase;
  timer: number;
  wave: number;
  kills: number;
  alive: boolean;
}

const PHASE_LABELS: Record<ARPhase, string> = {
  deploy: 'DEPLOY',
  pve: 'PvE COMBAT',
  pvp_warning: 'PvP WARNING',
  pvp: 'PvP ARENA',
  settlement: 'SETTLEMENT',
};

const PHASE_COLORS: Record<ARPhase, string> = {
  deploy: '#4CAF50',
  pve: '#2196F3',
  pvp_warning: '#FF9800',
  pvp: '#F44336',
  settlement: '#9C27B0',
};

function formatTimer(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ARHUD({
  hp,
  maxHp,
  xp,
  xpToNext,
  level,
  phase,
  timer,
  wave,
  kills,
  alive,
}: ARHUDProps) {
  const hpRatio = maxHp > 0 ? hp / maxHp : 0;
  const xpRatio = xpToNext > 0 ? xp / xpToNext : 0;
  const phaseColor = PHASE_COLORS[phase] || '#2196F3';

  return (
    <>
      {/* 상단: 타이머 + 페이즈 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
        {/* 페이즈 뱃지 */}
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Black Ops One", monospace',
            color: phaseColor,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {PHASE_LABELS[phase] || phase}
        </div>

        {/* 타이머 */}
        <div
          style={{
            fontSize: 32,
            fontFamily: '"Rajdhani", sans-serif',
            fontWeight: 700,
            color: timer < 10 ? '#F44336' : '#E8E0D4',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {formatTimer(timer)}
        </div>
      </div>

      {/* 좌상: 웨이브 + 킬 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          pointerEvents: 'none',
          zIndex: 50,
          fontFamily: '"Rajdhani", sans-serif',
          color: '#E8E0D4',
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.7 }}>WAVE</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{wave}</div>
        <div style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>KILLS</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#CC9933' }}>{kills}</div>
      </div>

      {/* 하단 중앙: HP + XP + 레벨 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 50,
          width: 320,
        }}
      >
        {/* 레벨 */}
        <div
          style={{
            fontSize: 14,
            fontFamily: '"Black Ops One", monospace',
            color: '#FFD700',
            marginBottom: 6,
          }}
        >
          LV.{level}
        </div>

        {/* HP 바 */}
        <div
          style={{
            width: '100%',
            height: 16,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.15)',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: `${hpRatio * 100}%`,
              height: '100%',
              backgroundColor:
                hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.25 ? '#FF9800' : '#F44336',
              transition: 'width 0.2s',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '100%',
              textAlign: 'center',
              fontSize: 11,
              fontFamily: '"Rajdhani", sans-serif',
              fontWeight: 600,
              color: '#fff',
              lineHeight: '16px',
              top: 0,
            }}
          >
            {Math.ceil(hp)} / {Math.ceil(maxHp)}
          </div>
        </div>

        {/* XP 바 */}
        <div
          style={{
            width: '100%',
            height: 8,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${xpRatio * 100}%`,
              height: '100%',
              backgroundColor: '#6EC6FF',
              transition: 'width 0.1s',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#888',
            marginTop: 2,
            fontFamily: '"Rajdhani", sans-serif',
          }}
        >
          XP: {Math.floor(xp)} / {Math.floor(xpToNext)}
        </div>
      </div>

      {/* 사망 시 오버레이 */}
      {!alive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 90,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: '"Black Ops One", monospace',
              fontSize: 48,
              color: '#F44336',
              textShadow: '0 4px 16px rgba(244,67,54,0.4)',
              letterSpacing: 4,
            }}
          >
            DEFEATED
          </div>
          <div
            style={{
              fontSize: 16,
              color: '#E8E0D4',
              marginTop: 8,
              fontFamily: '"Rajdhani", sans-serif',
            }}
          >
            Kills: {kills} | Level: {level}
          </div>
        </div>
      )}
    </>
  );
}
