'use client';

/**
 * v26 Phase 4 — Production Chain Overlay
 * 선택된 건물의 입출력 자원 흐름 시각화
 * 건물 선택 시 하단에 input→building→output 체인 다이어그램 표시
 */

import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont } from '@/lib/sketch-ui';
import { BUILDING_DEF_MAP, RESOURCE_LABELS, RESOURCE_ICONS, CATEGORY_COLORS, CLIENT_BUILDING_DEFS } from './buildingDefs';
import type { Building } from '@agent-survivor/shared/types/city';

/** 자원 흐름 노드 */
function ResourceNode({
  resource,
  amount,
  type,
  stockpile,
}: {
  resource: string;
  amount: number;
  type: 'input' | 'output';
  stockpile: number;
}) {
  const icon = RESOURCE_ICONS[resource] ?? '📦';
  const label = RESOURCE_LABELS[resource] ?? resource;
  const color = type === 'input' ? SK.red : SK.green;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '6px 10px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${SK.glassBorder}`,
      minWidth: '70px',
    }}>
      <span style={{ fontSize: '18px', marginBottom: '2px' }}>{icon}</span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '9px',
        color: SK.textSecondary,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '12px',
        fontWeight: 700,
        color,
      }}>
        {type === 'input' ? '-' : '+'}{amount.toFixed(1)}
      </span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '8px',
        color: SK.textMuted,
        marginTop: '2px',
      }}>
        Stock: {Math.floor(stockpile)}
      </span>
    </div>
  );
}

/** 연결 화살표 */
function Arrow({ direction }: { direction: 'right' | 'left' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px',
      color: SK.textMuted,
      fontSize: '16px',
    }}>
      {direction === 'right' ? '→' : '←'}
    </div>
  );
}

/** 관련 건물 탐색: 이 자원을 생산/소비하는 다른 건물 찾기 */
function findRelatedBuildings(resource: string, type: 'producer' | 'consumer', excludeDefId: string): string[] {
  const results: string[] = [];
  for (const def of CLIENT_BUILDING_DEFS) {
    if (def.id === excludeDefId) continue;
    if (type === 'producer' && def.produces.some(p => p.resource === resource)) {
      results.push(def.name);
    }
    if (type === 'consumer' && def.consumes.some(c => c.resource === resource)) {
      results.push(def.name);
    }
  }
  return results.slice(0, 3); // 최대 3개까지만 표시
}

interface ProductionChainOverlayProps {
  building: Building;
  onClose: () => void;
}

export function ProductionChainOverlay({ building, onClose }: ProductionChainOverlayProps) {
  const resources = useCityStore(s => s.resources);
  const def = BUILDING_DEF_MAP[building.defId];

  if (!def) return null;

  const catColor = CATEGORY_COLORS[def.category] ?? SK.textMuted;
  const hasInputs = def.consumes.length > 0;
  const hasOutputs = def.produces.length > 0;

  // 자원을 공급하는 건물과 소비하는 건물 찾기
  const inputSuppliers = def.consumes.map(c => ({
    resource: c.resource,
    suppliers: findRelatedBuildings(c.resource, 'producer', def.id),
  }));

  const outputConsumers = def.produces.map(p => ({
    resource: p.resource,
    consumers: findRelatedBuildings(p.resource, 'consumer', def.id),
  }));

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(9, 9, 11, 0.94)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${SK.glassBorder}`,
      zIndex: 35,
      pointerEvents: 'auto',
      maxWidth: '700px',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', background: catColor }} />
          <span style={{
            fontFamily: headingFont,
            fontSize: '11px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Production Chain — {def.name}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
            background: 'rgba(255,255,255,0.05)',
            padding: '1px 6px',
          }}>
            Eff: {(building.efficiency * 100).toFixed(0)}%
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: SK.textMuted,
            fontSize: '14px',
            cursor: 'pointer',
            padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* 체인 다이어그램 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 16px',
        gap: '4px',
      }}>
        {/* 입력 자원 */}
        {hasInputs && (
          <>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {def.consumes.map(c => (
                <ResourceNode
                  key={c.resource}
                  resource={c.resource}
                  amount={c.amount * building.efficiency}
                  type="input"
                  stockpile={resources[c.resource] ?? 0}
                />
              ))}
            </div>
            <Arrow direction="right" />
          </>
        )}

        {/* 중앙: 건물 노드 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 16px',
          background: `${catColor}15`,
          border: `2px solid ${catColor}40`,
          minWidth: '100px',
        }}>
          <span style={{
            fontFamily: headingFont,
            fontSize: '12px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}>
            {def.name}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: catColor,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginTop: '2px',
          }}>
            Lv.{building.level} / {building.workers}/{def.maxWorkers} workers
          </span>
          {def.powerUse > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: building.powered ? SK.gold : SK.red,
              marginTop: '2px',
            }}>
              ⚡ {def.powerUse} {building.powered ? '(ON)' : '(OFF)'}
            </span>
          )}
          {def.powerGen > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.gold,
              marginTop: '2px',
            }}>
              ⚡ +{def.powerGen} gen
            </span>
          )}
        </div>

        {/* 출력 자원 */}
        {hasOutputs && (
          <>
            <Arrow direction="right" />
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {def.produces.map(p => (
                <ResourceNode
                  key={p.resource}
                  resource={p.resource}
                  amount={p.amount * building.efficiency}
                  type="output"
                  stockpile={resources[p.resource] ?? 0}
                />
              ))}
            </div>
          </>
        )}

        {/* 생산도 소비도 없는 건물 (도로 등) */}
        {!hasInputs && !hasOutputs && (
          <div style={{
            padding: '8px 12px',
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
          }}>
            No production chain (infrastructure/service)
          </div>
        )}
      </div>

      {/* 관련 건물 참조 */}
      {(inputSuppliers.some(s => s.suppliers.length > 0) || outputConsumers.some(c => c.consumers.length > 0)) && (
        <div style={{
          padding: '6px 16px 10px',
          borderTop: `1px solid ${SK.glassBorder}`,
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {inputSuppliers
            .filter(s => s.suppliers.length > 0)
            .map(s => (
              <div key={s.resource} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.textMuted,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  {RESOURCE_LABELS[s.resource] ?? s.resource} from:
                </span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '9px',
                  color: SK.textSecondary,
                }}>
                  {s.suppliers.join(', ')}
                </span>
              </div>
            ))}
          {outputConsumers
            .filter(c => c.consumers.length > 0)
            .map(c => (
              <div key={c.resource} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.textMuted,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  {RESOURCE_LABELS[c.resource] ?? c.resource} to:
                </span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '9px',
                  color: SK.textSecondary,
                }}>
                  {c.consumers.join(', ')}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
