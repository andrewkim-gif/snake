'use client';

/**
 * v26 Phase 5 — Politics Panel
 * 파벌 분포 4축 바, 칙령 발행/취소 카드, 지지율/불만도, 정치 이벤트 로그
 * 다크 전술 패널 + SK 디자인 토큰
 */

import { useState } from 'react';
import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont, sketchShadow } from '@/lib/sketch-ui';
import {
  FACTION_AXIS_LABELS,
  FACTION_AXIS_COLORS,
  type FactionAxisKey,
  type EdictDef,
  type ActiveEdict,
  type PoliticalEvent,
} from '@agent-survivor/shared/types/city';

// ─── Sub-components ───

/** 4축 파벌 분포 바 */
function FactionAxisBar({
  axisKey,
  value,
}: {
  axisKey: FactionAxisKey;
  value: number;
}) {
  const [leftLabel, rightLabel] = FACTION_AXIS_LABELS[axisKey];
  const [leftColor, rightColor] = FACTION_AXIS_COLORS[axisKey];

  // value: -1 ~ +1, center = 50%, left side = negative, right side = positive
  const pct = ((value + 1) / 2) * 100; // 0~100 scale
  const isPositive = value >= 0;

  return (
    <div style={{ marginBottom: '10px' }}>
      {/* 라벨 행 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3px',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: !isPositive ? leftColor : SK.textMuted,
          fontWeight: !isPositive ? 700 : 400,
          letterSpacing: '0.3px',
        }}>
          {leftLabel}
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textSecondary,
          fontWeight: 700,
        }}>
          {value > 0 ? '+' : ''}{value.toFixed(2)}
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: isPositive ? rightColor : SK.textMuted,
          fontWeight: isPositive ? 700 : 400,
          letterSpacing: '0.3px',
        }}>
          {rightLabel}
        </span>
      </div>
      {/* 바 */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '8px',
        background: 'rgba(255,255,255,0.06)',
      }}>
        {/* 중앙 마커 */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: '1px',
          background: 'rgba(255,255,255,0.15)',
          zIndex: 1,
        }} />
        {/* 값 바 (중앙에서 좌/우로 확장) */}
        <div style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          left: isPositive ? '50%' : `${pct}%`,
          width: `${Math.abs(pct - 50)}%`,
          background: isPositive ? rightColor : leftColor,
          opacity: 0.8,
          transition: 'all 300ms ease',
        }} />
      </div>
    </div>
  );
}

/** 칙령 카드 */
function EdictCard({
  edict,
  isActive,
  treasury,
  onIssue,
  onRevoke,
}: {
  edict: EdictDef;
  isActive: boolean;
  treasury: number;
  onIssue: (edictId: string) => void;
  onRevoke: (edictId: string) => void;
}) {
  const canAfford = treasury >= edict.minTreasury;
  const isOnCooldown = 'onCooldown' in edict && (edict as EdictDef & { onCooldown?: boolean }).onCooldown;

  // 카테고리별 악센트 색상
  const catColor: Record<string, string> = {
    economic: SK.gold,
    social: '#F97316',
    military: '#84CC16',
    environmental: '#10B981',
  };
  const accent = catColor[edict.category] ?? SK.textSecondary;

  // 파벌 효과 아이콘 생성
  const factionIcons: { axis: FactionAxisKey; value: number }[] = [];
  if (edict.factionEffect) {
    const fe = edict.factionEffect as Partial<Record<FactionAxisKey, number>>;
    for (const key of ['economic', 'environment', 'governance', 'social'] as FactionAxisKey[]) {
      const v = fe[key];
      if (v && v !== 0) {
        factionIcons.push({ axis: key, value: v });
      }
    }
  }

  return (
    <div style={{
      padding: '8px 10px',
      background: isActive ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isActive ? 'rgba(245, 158, 11, 0.25)' : SK.glassBorder}`,
      marginBottom: '6px',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '3px',
            height: '14px',
            background: accent,
          }} />
          <span style={{
            fontFamily: bodyFont,
            fontSize: '11px',
            fontWeight: 700,
            color: SK.textPrimary,
          }}>
            {edict.name}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '8px',
            color: accent,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {edict.category}
          </span>
        </div>
        {/* 비용 */}
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: canAfford ? SK.textSecondary : SK.red,
        }}>
          ${edict.costPerTick}/tick
        </span>
      </div>

      {/* 설명 */}
      <div style={{
        fontFamily: bodyFont,
        fontSize: '9px',
        color: SK.textMuted,
        marginBottom: '6px',
        lineHeight: 1.4,
      }}>
        {edict.description}
      </div>

      {/* 파벌 효과 + 버튼 행 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* 파벌 효과 태그 */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {factionIcons.map(({ axis, value }) => {
            const [negColor, posColor] = FACTION_AXIS_COLORS[axis];
            const color = value > 0 ? posColor : negColor;
            const [negLabel, posLabel] = FACTION_AXIS_LABELS[axis];
            const label = value > 0 ? posLabel : negLabel;
            return (
              <span
                key={axis}
                style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color,
                  padding: '1px 4px',
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                }}
              >
                {value > 0 ? '+' : ''}{value.toFixed(2)} {label}
              </span>
            );
          })}
        </div>

        {/* 액션 버튼 */}
        {isActive ? (
          <button
            onClick={() => onRevoke(edict.id)}
            style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              fontWeight: 700,
              color: SK.red,
              background: 'rgba(239, 68, 68, 0.1)',
              border: `1px solid rgba(239, 68, 68, 0.3)`,
              padding: '3px 8px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Revoke
          </button>
        ) : (
          <button
            onClick={() => onIssue(edict.id)}
            disabled={!canAfford || !!isOnCooldown}
            style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              fontWeight: 700,
              color: canAfford && !isOnCooldown ? SK.green : SK.textMuted,
              background: canAfford && !isOnCooldown ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${canAfford && !isOnCooldown ? 'rgba(16, 185, 129, 0.3)' : SK.glassBorder}`,
              padding: '3px 8px',
              cursor: canAfford && !isOnCooldown ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              opacity: canAfford && !isOnCooldown ? 1 : 0.5,
            }}
          >
            {isOnCooldown ? 'Cooldown' : 'Enact'}
          </button>
        )}
      </div>
    </div>
  );
}

/** 이벤트 로그 행 */
function EventRow({ event }: { event: PoliticalEvent }) {
  const severityColor: Record<string, string> = {
    info: SK.textSecondary,
    warning: SK.orange,
    critical: SK.red,
  };
  const color = severityColor[event.severity] ?? SK.textMuted;

  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '3px 0',
      borderBottom: `1px solid ${SK.glassBorder}`,
    }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '8px',
        color: SK.textMuted,
        minWidth: '28px',
      }}>
        T{event.tick}
      </span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '9px',
        color,
        fontWeight: event.severity === 'critical' ? 700 : 400,
      }}>
        {event.message}
      </span>
    </div>
  );
}

// ─── Main Component ───

type EdictFilter = 'all' | 'economic' | 'social' | 'military' | 'environmental';

interface PoliticsPanelProps {
  onClose: () => void;
  onIssueEdict: (edictId: string) => void;
  onRevokeEdict: (edictId: string) => void;
}

export function PoliticsPanel({ onClose, onIssueEdict, onRevokeEdict }: PoliticsPanelProps) {
  const politics = useCityStore(s => s.politics);
  const treasury = useCityStore(s => s.treasury);
  const [edictFilter, setEdictFilter] = useState<EdictFilter>('all');

  if (!politics) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        background: 'rgba(9, 9, 11, 0.95)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${SK.glassBorder}`,
        boxShadow: sketchShadow('lg'),
        zIndex: 50,
        pointerEvents: 'auto',
        padding: '24px',
        textAlign: 'center',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '13px',
          color: SK.textMuted,
        }}>
          Politics data not available yet. Waiting for server...
        </span>
      </div>
    );
  }

  const { factions, activeEdicts, availableEdicts, recentEvents } = politics;

  // 활성 칙령 ID Set
  const activeEdictIds = new Set(activeEdicts.filter(ae => ae.active).map(ae => ae.edictId));

  // 필터링된 칙령 목록
  const filteredEdicts = edictFilter === 'all'
    ? availableEdicts
    : availableEdicts.filter(e => e.category === edictFilter);

  // 지지율 색상
  const approvalColor = factions.approval >= 70 ? SK.green
    : factions.approval >= 40 ? SK.orange
    : SK.red;

  // 불만도 색상
  const dissatColor = factions.dissatisfaction >= 80 ? SK.red
    : factions.dissatisfaction >= 60 ? SK.orange
    : SK.green;

  const filterButtons: { key: EdictFilter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'economic', label: 'ECON' },
    { key: 'social', label: 'SOCIAL' },
    { key: 'military', label: 'MILITARY' },
    { key: 'environmental', label: 'ENV' },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '560px',
      maxHeight: '85vh',
      background: 'rgba(9, 9, 11, 0.95)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${SK.glassBorder}`,
      boxShadow: sketchShadow('lg'),
      zIndex: 50,
      pointerEvents: 'auto',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '4px',
            height: '20px',
            background: SK.accent,
          }} />
          <span style={{
            fontFamily: headingFont,
            fontSize: '16px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Politics & Factions
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: SK.textMuted,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          X
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {/* ── 지지율 + 불만도 카드 ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}>
          {/* 지지율 */}
          <div style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Approval Rating
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '24px',
              fontWeight: 700,
              color: approvalColor,
            }}>
              {factions.approval.toFixed(0)}%
            </div>
            {/* 바 */}
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.06)',
              marginTop: '6px',
            }}>
              <div style={{
                width: `${factions.approval}%`,
                height: '100%',
                background: approvalColor,
                transition: 'width 300ms ease',
              }} />
            </div>
          </div>

          {/* 불만도 */}
          <div style={{
            padding: '10px 12px',
            background: factions.dissatisfaction >= 80
              ? 'rgba(239, 68, 68, 0.08)'
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${factions.dissatisfaction >= 80 ? 'rgba(239, 68, 68, 0.25)' : SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Dissatisfaction
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '24px',
              fontWeight: 700,
              color: dissatColor,
            }}>
              {factions.dissatisfaction.toFixed(0)}%
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.06)',
              marginTop: '6px',
            }}>
              <div style={{
                width: `${factions.dissatisfaction}%`,
                height: '100%',
                background: dissatColor,
                transition: 'width 300ms ease',
              }} />
            </div>
            {factions.dissatisfaction >= 80 && (
              <div style={{
                fontFamily: bodyFont,
                fontSize: '8px',
                color: SK.red,
                marginTop: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                DANGER: Ultimatum threshold reached!
              </div>
            )}
          </div>
        </div>

        {/* ── 4축 파벌 분포 ── */}
        <div style={{
          marginBottom: '16px',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${SK.glassBorder}`,
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textSecondary,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '10px',
            paddingBottom: '4px',
            borderBottom: `1px solid ${SK.glassBorder}`,
          }}>
            Population Political Spectrum
          </div>
          <FactionAxisBar axisKey="economic" value={factions.axes.economic} />
          <FactionAxisBar axisKey="environment" value={factions.axes.environment} />
          <FactionAxisBar axisKey="governance" value={factions.axes.governance} />
          <FactionAxisBar axisKey="social" value={factions.axes.social} />
        </div>

        {/* ── 칙령 섹션 ── */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textSecondary,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              Edicts ({activeEdictIds.size}/5 active)
            </div>
            {/* 카테고리 필터 */}
            <div style={{ display: 'flex', gap: '2px' }}>
              {filterButtons.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setEdictFilter(key)}
                  style={{
                    fontFamily: bodyFont,
                    fontSize: '8px',
                    fontWeight: edictFilter === key ? 700 : 400,
                    color: edictFilter === key ? SK.gold : SK.textMuted,
                    background: edictFilter === key ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    border: `1px solid ${edictFilter === key ? 'rgba(245, 158, 11, 0.25)' : 'transparent'}`,
                    padding: '2px 6px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 칙령 카드 목록 */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filteredEdicts.map((edict) => (
              <EdictCard
                key={edict.id}
                edict={edict}
                isActive={activeEdictIds.has(edict.id)}
                treasury={treasury}
                onIssue={onIssueEdict}
                onRevoke={onRevokeEdict}
              />
            ))}
          </div>
        </div>

        {/* ── 정치 이벤트 로그 ── */}
        {recentEvents.length > 0 && (
          <div style={{
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textSecondary,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '6px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${SK.glassBorder}`,
            }}>
              Recent Events
            </div>
            {recentEvents.slice(-5).reverse().map((event, i) => (
              <EventRow key={`${event.tick}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
