'use client';

/**
 * LanguageSwitcher — EN/KO 언어 전환 토글
 * LobbyHeader + (hub)/layout.tsx 양쪽에서 재사용
 * useLocale() 훅으로 client-side 전환 (WebSocket 안전)
 */

import { useLocale } from '@/providers/I18nClientWrapper';
import { SK, bodyFont } from '@/lib/sketch-ui';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === 'ko' ? 'en' : 'ko');
  };

  return (
    <button
      onClick={toggleLocale}
      aria-label={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
      style={{
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: '10px',
        color: SK.textSecondary,
        letterSpacing: '1px',
        padding: '4px 10px',
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        borderRadius: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.color = SK.textPrimary;
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.color = SK.textSecondary;
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
      }}
    >
      <span style={{ fontSize: '12px' }}>&#127760;</span>
      <span>{locale === 'ko' ? 'EN' : 'KO'}</span>
    </button>
  );
}
