'use client';

/**
 * v26 Phase 4 — Construction Panel
 * 좌측 건설 메뉴: 카테고리 탭 + 건물 그리드 + 비용/요구사항 표시
 */

import { useState } from 'react';
import { useCityStore, type ConstructionCategory } from '@/stores/cityStore';
import { SK, bodyFont, headingFont, sketchShadow } from '@/lib/sketch-ui';
import {
  CLIENT_BUILDING_DEFS,
  BUILDING_DEF_MAP,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  RESOURCE_LABELS,
  RESOURCE_ICONS,
  getBuildingsByCategory,
  type ClientBuildingDef,
} from './buildingDefs';

/** 카테고리 탭 목록 */
const CATEGORIES: ConstructionCategory[] = [
  'all', 'raw_extraction', 'processing', 'advanced',
  'service', 'infrastructure', 'military', 'government',
];

/** 건물 카드 */
function BuildingCard({
  def,
  selected,
  treasury,
  onSelect,
}: {
  def: ClientBuildingDef;
  selected: boolean;
  treasury: number;
  onSelect: (defId: string) => void;
}) {
  const canAfford = treasury >= def.buildCost;
  const catColor = CATEGORY_COLORS[def.category] ?? SK.textMuted;

  return (
    <button
      onClick={() => onSelect(def.id)}
      disabled={!canAfford}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px',
        background: selected
          ? 'rgba(204, 153, 51, 0.15)'
          : canAfford
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(255, 255, 255, 0.01)',
        border: selected
          ? `1px solid ${SK.gold}`
          : `1px solid ${SK.glassBorder}`,
        cursor: canAfford ? 'pointer' : 'not-allowed',
        opacity: canAfford ? 1 : 0.5,
        transition: 'all 150ms ease',
        width: '100%',
        textAlign: 'left',
      }}
    >
      {/* 상단: 이름 + 카테고리 라인 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
      }}>
        <div style={{
          width: '3px',
          height: '14px',
          background: catColor,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: bodyFont,
          fontSize: '11px',
          fontWeight: 700,
          color: selected ? SK.gold : SK.textPrimary,
          letterSpacing: '0.3px',
        }}>
          {def.name}
        </span>
        {def.tier > 1 && (
          <span style={{
            fontFamily: bodyFont,
            fontSize: '8px',
            color: SK.textMuted,
            background: 'rgba(255,255,255,0.05)',
            padding: '1px 4px',
          }}>
            T{def.tier}
          </span>
        )}
      </div>

      {/* 중앙: 생산/소비 요약 */}
      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        marginBottom: '4px',
        minHeight: '16px',
      }}>
        {def.produces.map(p => (
          <span key={p.resource} style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.green,
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '1px 4px',
          }}>
            {RESOURCE_ICONS[p.resource] ?? ''} +{p.amount}
          </span>
        ))}
        {def.consumes.map(c => (
          <span key={c.resource} style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.red,
            background: 'rgba(239, 68, 68, 0.08)',
            padding: '1px 4px',
          }}>
            {RESOURCE_ICONS[c.resource] ?? ''} -{c.amount}
          </span>
        ))}
        {def.powerGen > 0 && (
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.gold,
            background: 'rgba(245, 158, 11, 0.1)',
            padding: '1px 4px',
          }}>
            ⚡+{def.powerGen}
          </span>
        )}
      </div>

      {/* 하단: 비용 + 크기 + 인력 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          fontWeight: 700,
          color: canAfford ? SK.gold : SK.red,
        }}>
          ${def.buildCost.toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
          }}>
            {def.sizeW}x{def.sizeH}
          </span>
          {def.maxWorkers > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
            }}>
              👷{def.maxWorkers}
            </span>
          )}
          {def.powerUse > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
            }}>
              ⚡{def.powerUse}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface ConstructionPanelProps {
  onClose: () => void;
  onSelectBuilding: (defId: string) => void;
  selectedDefId: string | null;
}

export function ConstructionPanel({ onClose, onSelectBuilding, selectedDefId }: ConstructionPanelProps) {
  const constructionCategory = useCityStore(s => s.constructionCategory);
  const setConstructionCategory = useCityStore(s => s.setConstructionCategory);
  const treasury = useCityStore(s => s.treasury);

  const filteredDefs = getBuildingsByCategory(constructionCategory);

  return (
    <div style={{
      position: 'absolute',
      top: 100,
      left: 16,
      width: '260px',
      maxHeight: 'calc(100vh - 200px)',
      background: 'rgba(9, 9, 11, 0.92)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${SK.glassBorder}`,
      boxShadow: sketchShadow('lg'),
      zIndex: 30,
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        <span style={{
          fontFamily: headingFont,
          fontSize: '13px',
          fontWeight: 700,
          color: SK.textPrimary,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Construction
        </span>
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

      {/* 카테고리 탭 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2px',
        padding: '6px 8px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        {CATEGORIES.map(cat => {
          const isActive = constructionCategory === cat;
          const catColor = CATEGORY_COLORS[cat] ?? SK.textMuted;
          return (
            <button
              key={cat}
              onClick={() => setConstructionCategory(cat)}
              style={{
                padding: '3px 8px',
                fontFamily: bodyFont,
                fontSize: '9px',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                background: isActive ? `${catColor}20` : 'transparent',
                border: isActive ? `1px solid ${catColor}40` : `1px solid transparent`,
                color: isActive ? catColor : SK.textMuted,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          );
        })}
      </div>

      {/* 건물 리스트 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {filteredDefs.map(def => (
          <BuildingCard
            key={def.id}
            def={def}
            selected={selectedDefId === def.id}
            treasury={treasury}
            onSelect={onSelectBuilding}
          />
        ))}
        {filteredDefs.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            fontFamily: bodyFont,
            fontSize: '11px',
            color: SK.textMuted,
          }}>
            No buildings in this category
          </div>
        )}
      </div>

      {/* 하단: 건물 수 + 국고 */}
      <div style={{
        padding: '6px 12px',
        borderTop: `1px solid ${SK.glassBorder}`,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textMuted,
        }}>
          {filteredDefs.length} buildings
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          fontWeight: 700,
          color: SK.gold,
        }}>
          Treasury: ${treasury.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
