'use client';

/**
 * LobbyHeader — 프리미엄 다크 헤더 바
 * 다크 글래스모피즘 + 로고 + 상태 + 뷰 토글
 */

import { useState } from 'react';
import Image from 'next/image';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

interface LobbyHeaderProps {
  connected: boolean;
  viewMode: 'globe' | 'map';
  onToggleView: () => void;
}

export function LobbyHeader({ connected, viewMode, onToggleView }: LobbyHeaderProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <header style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 70,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: 'linear-gradient(to bottom, rgba(9,9,11,0.92) 0%, rgba(9,9,11,0.6) 80%, transparent 100%)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${SK.borderDark}`,
      pointerEvents: 'none',
    }}>
      {/* 좌측: 로고 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'auto',
      }}>
        {!imgError ? (
          <Image
            src="/images/logo-ww-mc.png"
            alt="AI World War"
            width={160}
            height={65}
            priority
            onError={() => setImgError(true)}
            style={{
              height: '36px',
              width: 'auto',
              filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))',
            }}
          />
        ) : (
          <span style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: '18px',
            color: SK.textPrimary,
            letterSpacing: '2px',
          }}>
            AI WORLD WAR
          </span>
        )}

        {/* 버전 뱃지 */}
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
          ALPHA
        </span>
      </div>

      {/* 우측: 상태 + 뷰 토글 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        pointerEvents: 'auto',
      }}>
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
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* 뷰 토글 */}
        <button
          onClick={onToggleView}
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: '10px',
            color: SK.textSecondary,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            padding: '6px 14px',
            border: `1px solid rgba(255, 255, 255, 0.08)`,
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = SK.textPrimary;
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = SK.textSecondary;
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
        >
          {viewMode === 'globe' ? '2D MAP' : '3D GLOBE'}
        </button>
      </div>
    </header>
  );
}
