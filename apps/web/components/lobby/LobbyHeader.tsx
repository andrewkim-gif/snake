'use client';

/**
 * LobbyHeader — 프리미엄 다크 헤더 바
 * 다크 글래스모피즘 + GameLogo + TopNavBar 8항목 + LanguageSwitcher + 상태
 * v15: EventTicker/viewMode 제거, 심플 props, 인디고 에지 글로우
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import { GameLogo } from '@/components/lobby/GameLogo';
import { useTranslations } from 'next-intl';

interface LobbyHeaderProps {
  connected: boolean;
}

export function LobbyHeader({ connected }: LobbyHeaderProps) {
  const tCommon = useTranslations('common');
  const tLobby = useTranslations('lobby');

  return (
    <header style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: 'linear-gradient(to bottom, rgba(9,9,11,0.95) 0%, rgba(9,9,11,0.7) 70%, transparent 100%)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(99,102,241,0.08)',
      boxShadow: '0 1px 12px rgba(99,102,241,0.04)',
      zIndex: 70,
      pointerEvents: 'none',
    }}>
      {/* 좌측: 로고 + ALPHA 뱃지 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'auto',
      }}>
        <GameLogo variant="compact" />

        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          fontWeight: 700,
          color: SK.blue,
          letterSpacing: '1px',
          padding: '2px 6px',
          border: `1px solid ${SK.blue}30`,
          borderRadius: '4px',
          textTransform: 'uppercase',
        }}>
          {tCommon('alpha')}
        </span>
      </div>

      {/* 중앙: TopNavBar 8 항목 (데스크탑) */}
      <div style={{ pointerEvents: 'auto', height: '100%' }}>
        <TopNavBar />
      </div>

      {/* 우측: Language + Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'auto',
      }}>
        <LanguageSwitcher />

        {/* 연결 상태 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: connected ? SK.statusOnline : SK.statusOffline,
            boxShadow: connected
              ? `0 0 8px ${SK.green}80`
              : `0 0 8px ${SK.red}60`,
          }} />
          <span style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: '10px',
            color: connected ? SK.green : SK.red,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {connected ? tLobby('online') : tLobby('offline')}
          </span>
        </div>
      </div>
    </header>
  );
}
