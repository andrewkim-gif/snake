'use client';

/**
 * v26 Phase 4 — Building Info Panel
 * 건물 클릭 시 우측 패널: 생산/소비, 효율, 고용, 레벨, 업그레이드
 */

import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont, sketchShadow } from '@/lib/sketch-ui';
import { BUILDING_DEF_MAP, RESOURCE_LABELS, RESOURCE_ICONS, CATEGORY_COLORS } from './buildingDefs';
import type { Building } from '@agent-survivor/shared/types/city';

/** 효율 바 색상 */
function efficiencyColor(eff: number): string {
  if (eff >= 0.8) return SK.green;
  if (eff >= 0.5) return SK.orange;
  return SK.red;
}

/** 효율 바 컴포넌트 */
function EfficiencyBar({ value }: { value: number }) {
  const pct = Math.min(value * 100, 150);
  return (
    <div style={{
      width: '100%',
      height: '6px',
      background: 'rgba(255,255,255,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        background: efficiencyColor(value),
        transition: 'width 300ms ease',
      }} />
      {/* 100% 초과 표시 (레벨 보너스) */}
      {pct > 100 && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: `${pct - 100}%`,
          height: '100%',
          background: SK.gold,
          opacity: 0.5,
        }} />
      )}
    </div>
  );
}

/** 자원 IO 행 */
function ResourceRow({ resource, amount, type }: { resource: string; amount: number; type: 'in' | 'out' }) {
  const label = RESOURCE_LABELS[resource] ?? resource;
  const icon = RESOURCE_ICONS[resource] ?? '';
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px' }}>{icon}</span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '11px',
          color: SK.textSecondary,
        }}>
          {label}
        </span>
      </div>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '12px',
        fontWeight: 700,
        color: type === 'out' ? SK.green : SK.red,
      }}>
        {type === 'out' ? '+' : '-'}{amount.toFixed(1)}/tick
      </span>
    </div>
  );
}

interface BuildingInfoPanelProps {
  building: Building;
  onClose: () => void;
  onUpgrade?: (buildingId: string) => void;
  onToggle?: (buildingId: string) => void;
  onDemolish?: (buildingId: string) => void;
}

export function BuildingInfoPanel({ building, onClose, onUpgrade, onToggle, onDemolish }: BuildingInfoPanelProps) {
  const def = BUILDING_DEF_MAP[building.defId];
  if (!def) return null;

  const catColor = CATEGORY_COLORS[def.category] ?? SK.textMuted;

  return (
    <div style={{
      position: 'absolute',
      top: 100,
      right: 16,
      width: '280px',
      background: 'rgba(9, 9, 11, 0.92)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${SK.glassBorder}`,
      boxShadow: sketchShadow('lg'),
      zIndex: 30,
      pointerEvents: 'auto',
      overflow: 'hidden',
    }}>
      {/* 헤더 — 좌측 카테고리 컬러 스트라이프 */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
      }}>
        <div style={{
          width: '4px',
          background: catColor,
          flexShrink: 0,
        }} />
        <div style={{
          flex: 1,
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${SK.glassBorder}`,
        }}>
          <div>
            <div style={{
              fontFamily: headingFont,
              fontSize: '14px',
              fontWeight: 700,
              color: SK.textPrimary,
              letterSpacing: '0.5px',
            }}>
              {def.name}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: catColor,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}>
              {def.category.replace('_', ' ')} / Tier {def.tier}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: SK.textMuted,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 상태 정보 */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${SK.glassBorder}` }}>
        {/* 효율 */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}>
            <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Efficiency
            </span>
            <span style={{ fontFamily: bodyFont, fontSize: '11px', fontWeight: 700, color: efficiencyColor(building.efficiency) }}>
              {(building.efficiency * 100).toFixed(0)}%
            </span>
          </div>
          <EfficiencyBar value={building.efficiency} />
        </div>

        {/* 고용/레벨/전력 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
        }}>
          {/* 레벨 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Level
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: '16px', fontWeight: 700, color: SK.gold }}>
              {building.level}
              <span style={{ fontSize: '10px', color: SK.textMuted }}>/{def.maxLevel}</span>
            </div>
          </div>
          {/* 고용 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Workers
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: '16px', fontWeight: 700, color: building.workers >= def.maxWorkers ? SK.green : SK.orange }}>
              {building.workers}
              <span style={{ fontSize: '10px', color: SK.textMuted }}>/{def.maxWorkers}</span>
            </div>
          </div>
          {/* 전력 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Power
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: '16px', fontWeight: 700, color: building.powered ? SK.green : SK.red }}>
              {def.powerGen > 0 ? `+${def.powerGen}` : def.powerUse > 0 ? `-${def.powerUse}` : '0'}
            </div>
          </div>
        </div>

        {/* 건설 중 표시 */}
        {building.underConstruction && (
          <div style={{
            marginTop: '8px',
            padding: '6px 8px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: `1px solid rgba(245, 158, 11, 0.25)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.orange, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Under Construction
            </span>
            <span style={{ fontFamily: bodyFont, fontSize: '11px', fontWeight: 700, color: SK.orange }}>
              {building.constructionLeft} ticks
            </span>
          </div>
        )}
      </div>

      {/* 생산 */}
      {def.produces.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${SK.glassBorder}` }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.green,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Production
          </div>
          {def.produces.map(p => (
            <ResourceRow key={p.resource} resource={p.resource} amount={p.amount * building.efficiency} type="out" />
          ))}
        </div>
      )}

      {/* 소비 */}
      {def.consumes.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${SK.glassBorder}` }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.red,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Consumption
          </div>
          {def.consumes.map(c => (
            <ResourceRow key={c.resource} resource={c.resource} amount={c.amount * building.efficiency} type="in" />
          ))}
        </div>
      )}

      {/* 유지비 */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${SK.glassBorder}` }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Maintenance
          </span>
          <span style={{ fontFamily: bodyFont, fontSize: '11px', fontWeight: 700, color: SK.red }}>
            -{def.maintenance}/tick
          </span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
      }}>
        {/* 업그레이드 */}
        {building.level < def.maxLevel && !building.underConstruction && (
          <button
            onClick={() => onUpgrade?.(building.id)}
            style={{
              flex: 1,
              padding: '6px',
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              background: 'rgba(245, 158, 11, 0.12)',
              border: `1px solid rgba(245, 158, 11, 0.25)`,
              color: SK.orange,
              cursor: 'pointer',
            }}
          >
            Upgrade (${def.buildCost * building.level})
          </button>
        )}
        {/* 활성/비활성 토글 */}
        <button
          onClick={() => onToggle?.(building.id)}
          style={{
            flex: 1,
            padding: '6px',
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            background: building.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(85, 86, 94, 0.15)',
            border: `1px solid ${building.enabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(85, 86, 94, 0.25)'}`,
            color: building.enabled ? SK.green : SK.textMuted,
            cursor: 'pointer',
          }}
        >
          {building.enabled ? 'Disable' : 'Enable'}
        </button>
        {/* 철거 */}
        <button
          onClick={() => onDemolish?.(building.id)}
          style={{
            padding: '6px 10px',
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            background: 'rgba(239, 68, 68, 0.08)',
            border: `1px solid rgba(239, 68, 68, 0.25)`,
            color: SK.red,
            cursor: 'pointer',
          }}
        >
          Demolish
        </button>
      </div>
    </div>
  );
}
