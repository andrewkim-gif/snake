'use client';

/**
 * LobbyHeader — 프리미엄 다크 헤더 바 (간소화)
 * 좌측: 로고 + ALPHA 뱃지
 * 우측: LanguageSwitcher + 연결 상태
 * GAME SYSTEM 버튼은 page.tsx에서 에이전트 설정 패널 위에 배치
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import { useTranslations } from 'next-intl';

interface LobbyHeaderProps {
  connected: boolean;
}

export function LobbyHeader({ connected }: LobbyHeaderProps) {
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
      borderBottom: '1px solid rgba(239,68,68,0.3)',
      boxShadow: '0 1px 12px rgba(239,68,68,0.04)',
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/generated/logo-v2.png"
          alt="AI WORLD WAR"
          style={{
            height: '30px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
          }}
        />
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
