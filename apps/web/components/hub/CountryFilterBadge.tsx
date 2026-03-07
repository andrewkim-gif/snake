'use client';

/**
 * CountryFilterBadge — 국가 필터 뱃지
 * economy, governance 등에서 공유
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

interface CountryFilterBadgeProps {
  countryCode: string;
  /** "Filtered: KOR" 형태의 라벨 텍스트 */
  label: string;
  /** "Clear" 클릭 시 이동할 URL */
  clearHref: string;
  /** "Clear" 버튼 텍스트 */
  clearText?: string;
  accentColor?: string;
}

export function CountryFilterBadge({
  label,
  clearHref,
  clearText = 'Clear',
  accentColor = SK.orange,
}: CountryFilterBadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '8px',
        background: `${accentColor}15`,
        border: `1px solid ${accentColor}30`,
        fontSize: '12px',
        color: accentColor,
        fontWeight: 600,
        fontFamily: bodyFont,
      }}
    >
      {label}
      <a
        href={clearHref}
        style={{
          color: SK.textSecondary,
          textDecoration: 'none',
          fontSize: '11px',
          marginLeft: '4px',
        }}
      >
        {clearText}
      </a>
    </div>
  );
}
