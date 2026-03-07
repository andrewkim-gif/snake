'use client';

/**
 * FilterBar — 통합 필터 버튼 바
 * governance, hall-of-fame 등에서 공유
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

interface FilterOption<T extends string = string> {
  key: T;
  label: string;
}

interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'pill' (기본) | 'tab' (탭 스타일) */
  variant?: 'pill' | 'tab';
  accentColor?: string;
}

export function FilterBar<T extends string = string>({
  options,
  value,
  onChange,
  variant = 'pill',
  accentColor = SK.blue,
}: FilterBarProps<T>) {
  const isTab = variant === 'tab';

  return (
    <div
      style={{
        display: 'flex',
        gap: isTab ? 0 : '6px',
        marginBottom: '20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        paddingBottom: '4px',
        ...(isTab ? { borderBottom: `1px solid ${SK.border}` } : {}),
      }}
    >
      {options.map((opt) => {
        const isActive = value === opt.key;

        if (isTab) {
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              style={{
                padding: '10px 18px',
                fontFamily: bodyFont,
                fontSize: '12px',
                fontWeight: isActive ? 700 : 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: isActive ? accentColor : SK.textSecondary,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 150ms ease, border-color 150ms ease',
              }}
            >
              {opt.label}
            </button>
          );
        }

        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: `1px solid ${isActive ? accentColor + '40' : SK.border}`,
              background: isActive ? `${accentColor}15` : 'transparent',
              color: isActive ? accentColor : SK.textSecondary,
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: bodyFont,
              whiteSpace: 'nowrap',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 150ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
