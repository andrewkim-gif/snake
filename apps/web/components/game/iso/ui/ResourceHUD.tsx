'use client';

/**
 * v26 Phase 4 — Resource HUD
 * 화면 상단 자원 바: 국고, 식량, 원자재, 전력, 인구, 행복도
 * 다크 반투명 + 밀리터리 스타일
 */

import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont } from '@/lib/sketch-ui';
import { HUD_RESOURCES } from './buildingDefs';

/** 숫자 포맷 (1000 → 1.0K, 1000000 → 1.0M) */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toLocaleString();
}

export function ResourceHUD() {
  const resources = useCityStore(s => s.resources);
  const treasury = useCityStore(s => s.treasury);
  const population = useCityStore(s => s.population);
  const happiness = useCityStore(s => s.happiness);
  const powerGen = useCityStore(s => s.powerGen);
  const powerUse = useCityStore(s => s.powerUse);
  const gdp = useCityStore(s => s.gdp);
  const employed = useCityStore(s => s.employed);
  const unemployed = useCityStore(s => s.unemployed);

  const getValue = (key: string): number => {
    if (key === '_treasury') return treasury;
    if (key === '_population') return population;
    if (key === '_happiness') return happiness;
    if (key === '_power') return powerGen - powerUse;
    return resources[key] ?? 0;
  };

  const getSubtext = (key: string): string | null => {
    if (key === '_power') {
      return `${formatNumber(powerGen)}/${formatNumber(powerUse)}`;
    }
    if (key === '_population') {
      return `${employed}E / ${unemployed}U`;
    }
    if (key === '_happiness') {
      return `${happiness.toFixed(0)}%`;
    }
    return null;
  };

  const getValueColor = (key: string, value: number): string => {
    if (key === '_power') {
      return value >= 0 ? SK.green : SK.red;
    }
    if (key === '_happiness') {
      if (value >= 70) return SK.green;
      if (value >= 40) return SK.orange;
      return SK.red;
    }
    return SK.textPrimary;
  };

  return (
    <div style={{
      position: 'absolute',
      top: 48,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '4px 8px',
        background: 'rgba(9, 9, 11, 0.88)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${SK.glassBorder}`,
        pointerEvents: 'auto',
      }}>
        {/* GDP 인디케이터 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 12px',
          borderRight: `1px solid ${SK.glassBorder}`,
          minWidth: '70px',
        }}>
          <span style={{
            fontFamily: headingFont,
            fontSize: '8px',
            color: SK.gold,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            GDP
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            fontWeight: 700,
            color: SK.gold,
          }}>
            {formatNumber(gdp)}
          </span>
        </div>

        {/* 자원 아이템 */}
        {HUD_RESOURCES.map(({ key, label, icon, iconAsset, color }) => {
          const value = getValue(key);
          const subtext = getSubtext(key);
          const valueColor = getValueColor(key, value);

          return (
            <div
              key={key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 10px',
                minWidth: '58px',
                borderRight: `1px solid ${SK.glassBorder}`,
                cursor: 'default',
              }}
              title={label}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                {iconAsset ? (
                  <img
                    src={iconAsset}
                    alt={label}
                    width={14}
                    height={14}
                    style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
                    onError={(e) => {
                      // 아이콘 로드 실패 시 이모지 폴백
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'inline';
                    }}
                  />
                ) : null}
                <span style={{ fontSize: '11px', display: iconAsset ? 'none' : 'inline' }}>{icon}</span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.textMuted,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  {label}
                </span>
              </div>
              <span style={{
                fontFamily: bodyFont,
                fontSize: '13px',
                fontWeight: 700,
                color: valueColor,
              }}>
                {key === '_happiness' ? `${happiness.toFixed(0)}%` : formatNumber(value)}
              </span>
              {subtext && (
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: color,
                  opacity: 0.7,
                }}>
                  {subtext}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
