'use client';

/**
 * CountryPanel — 국가 상세 패널 (슬라이드)
 * S08: 국가 클릭 시 우측 슬라이드, 정보 표시, Enter Arena / Spectate 버튼
 */

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { McButton } from '@/components/lobby/McButton';
import { SK, SKFont, bodyFont, sketchBorder, handDrawnRadius } from '@/lib/sketch-ui';
import { tierColors, battleStatusColors, resourceLabels, resourceIcons } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';

interface CountryPanelProps {
  country: CountryClientState | null;
  open: boolean;
  onClose: () => void;
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
}

// 자원 바 컴포넌트
function ResourceBar({ label, icon, value, color }: {
  label: string;
  icon: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textSecondary,
        width: '32px',
        textAlign: 'right',
        fontWeight: 600,
      }}>
        {icon}
      </span>
      <div style={{
        flex: 1,
        height: '8px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textPrimary,
        width: '28px',
        textAlign: 'right',
        fontWeight: 700,
      }}>
        {value}
      </span>
    </div>
  );
}

// 전투 상태 인디케이터
function BattleStatusIndicator({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
    idle: { label: 'IDLE', color: SK.textMuted, pulse: false },
    preparing: { label: 'PREPARING', color: '#F59E0B', pulse: true },
    in_battle: { label: 'IN BATTLE', color: '#EF4444', pulse: true },
    cooldown: { label: 'COOLDOWN', color: '#3B82F6', pulse: false },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: `${cfg.color}15`,
      borderRadius: handDrawnRadius(2),
      border: `1px solid ${cfg.color}30`,
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: cfg.color,
        boxShadow: cfg.pulse ? `0 0 8px ${cfg.color}` : 'none',
        animation: cfg.pulse ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: cfg.color,
        fontWeight: 700,
        letterSpacing: '2px',
      }}>
        {cfg.label}
      </span>
    </div>
  );
}

export function CountryPanel({
  country,
  open,
  onClose,
  onEnterArena,
  onSpectate,
}: CountryPanelProps) {
  const [visible, setVisible] = useState(false);

  // 슬라이드 애니메이션
  useEffect(() => {
    if (open) {
      // 마운트 후 애니메이션 트리거
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open && !visible) return null;

  const tierColor = country?.tier ? tierColors[country.tier] : SK.textMuted;
  const resources = country?.resources || { oil: 0, minerals: 0, food: 0, tech: 0, manpower: 0 };

  const resourceColors: Record<string, string> = {
    oil: '#1E1E1E',
    minerals: '#7C7C7C',
    food: '#4A9E4A',
    tech: '#4488AA',
    manpower: '#CC9933',
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 'min(400px, 90vw)',
        height: '100vh',
        zIndex: 101,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        background: SK.bg,
        borderLeft: sketchBorder(),
        overflowY: 'auto',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${SK.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: bodyFont,
              fontWeight: 800,
              fontSize: SKFont.h2,
              color: SK.textPrimary,
              letterSpacing: '1px',
              marginBottom: '4px',
            }}>
              {country?.name || 'Unknown'}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>{country?.iso3}</span>
              <span style={{
                color: tierColor,
                fontWeight: 700,
                padding: '1px 6px',
                border: `1px solid ${tierColor}40`,
                borderRadius: '2px',
                fontSize: SKFont.xs,
              }}>
                TIER {country?.tier}
              </span>
              <span style={{ opacity: 0.5 }}>{country?.continent}</span>
            </div>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              borderRadius: '3px',
              color: SK.textSecondary,
              cursor: 'pointer',
              padding: '4px 8px',
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              fontWeight: 700,
            }}
          >
            X
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '16px 20px', flex: 1 }}>
          {/* 전투 상태 */}
          <div style={{ marginBottom: '16px' }}>
            <BattleStatusIndicator status={country?.battleStatus || 'idle'} />
          </div>

          {/* 지배 팩션 */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: SK.cardBg,
            borderRadius: handDrawnRadius(2),
            border: sketchBorder(),
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
              letterSpacing: '2px',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}>
              Sovereignty
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.body,
              color: country?.sovereignFaction ? SK.textPrimary : SK.textMuted,
              fontWeight: 700,
            }}>
              {country?.sovereignFaction || 'Unclaimed'}
            </div>
            {country?.sovereigntyLevel !== undefined && country.sovereigntyLevel > 0 && (
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.orange,
                marginTop: '4px',
              }}>
                Sovereignty Lv.{country.sovereigntyLevel}
              </div>
            )}
          </div>

          {/* GDP & 에이전트 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '16px',
          }}>
            <div style={{
              padding: '10px',
              background: SK.cardBg,
              borderRadius: handDrawnRadius(2),
              border: sketchBorder(),
            }}>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textMuted,
                letterSpacing: '1px',
                marginBottom: '4px',
              }}>
                GDP
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.h3,
                color: SK.gold,
                fontWeight: 700,
              }}>
                {country?.gdp ? `$${(country.gdp / 1000).toFixed(0)}B` : '$0'}
              </div>
            </div>

            <div style={{
              padding: '10px',
              background: SK.cardBg,
              borderRadius: handDrawnRadius(2),
              border: sketchBorder(),
            }}>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textMuted,
                letterSpacing: '1px',
                marginBottom: '4px',
              }}>
                AGENTS
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.h3,
                color: SK.green,
                fontWeight: 700,
              }}>
                {country?.activeAgents || 0}
              </div>
            </div>
          </div>

          {/* 자원 프로필 */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: SK.cardBg,
            borderRadius: handDrawnRadius(2),
            border: sketchBorder(),
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
              letterSpacing: '2px',
              marginBottom: '10px',
              textTransform: 'uppercase',
            }}>
              Resources
            </div>
            {Object.entries(resources).map(([key, value]) => (
              <ResourceBar
                key={key}
                label={resourceLabels[key] || key}
                icon={resourceIcons[key] || key.slice(0, 3).toUpperCase()}
                value={value}
                color={resourceColors[key] || SK.textSecondary}
              />
            ))}
          </div>

          {/* 지형 테마 */}
          {country?.terrainTheme && (
            <div style={{
              marginBottom: '16px',
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textSecondary,
            }}>
              <span style={{ color: SK.textMuted, letterSpacing: '1px', fontSize: SKFont.xs }}>
                TERRAIN:{' '}
              </span>
              <span style={{ color: SK.textPrimary, textTransform: 'uppercase', fontWeight: 600 }}>
                {country.terrainTheme}
              </span>
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div style={{
          padding: '16px 20px 24px',
          borderTop: `1px solid ${SK.border}`,
          display: 'flex',
          gap: '10px',
        }}>
          <McButton
            variant="green"
            onClick={() => country?.iso3 && onEnterArena?.(country.iso3)}
            disabled={!country}
            style={{ flex: 1, fontSize: SKFont.sm }}
          >
            ENTER ARENA
          </McButton>
          <McButton
            variant="default"
            onClick={() => country?.iso3 && onSpectate?.(country.iso3)}
            disabled={!country}
            style={{ flex: 1, fontSize: SKFont.sm }}
          >
            SPECTATE
          </McButton>
        </div>
      </div>

      {/* Pulse 애니메이션 CSS */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
