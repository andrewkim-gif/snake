'use client';

/**
 * ARMinimap — Arena combat minimap (HTML overlay)
 *
 * Shows:
 * - Player position (yellow dot)
 * - Allies (green dots)
 * - Enemies/Elites/Minibosses (red/orange/purple dots)
 * - Boss (gold dot)
 * - Items (blue dots)
 * - XP crystals (cyan dots, dimmed)
 * - Arena boundary circle
 * - PvP shrink boundary (during PvP phase)
 */

import { useMemo, memo } from 'react';
import type { ARMinimapEntity, ARPhase } from '@/lib/3d/ar-types';
import { MINIMAP_COLORS } from '@/lib/3d/ar-types';

interface ARMinimapProps {
  entities: ARMinimapEntity[];
  playerX: number;
  playerZ: number;
  arenaRadius: number;
  pvpRadius?: number;
  phase: ARPhase;
  size?: number; // minimap size in px
}

const MINIMAP_RADIUS = 60; // display radius in px
const MINIMAP_PADDING = 8;

function ARMinimapInner({
  entities,
  playerX,
  playerZ,
  arenaRadius,
  pvpRadius,
  phase,
  size = 140,
}: ARMinimapProps) {
  const center = size / 2;
  const mapRadius = center - MINIMAP_PADDING;

  // Scale world coords to minimap coords
  const scale = mapRadius / Math.max(arenaRadius, 1);

  const dots = useMemo(() => {
    return entities
      .filter((e) => e.alive)
      .map((entity) => {
        // Relative to player position
        const relX = (entity.x - playerX) * scale;
        const relZ = (entity.z - playerZ) * scale;

        // Clamp to minimap bounds
        const dist = Math.sqrt(relX * relX + relZ * relZ);
        let drawX = relX;
        let drawZ = relZ;
        if (dist > mapRadius - 4) {
          const clampScale = (mapRadius - 4) / dist;
          drawX *= clampScale;
          drawZ *= clampScale;
        }

        const dotSize =
          entity.type === 'boss'
            ? 5
            : entity.type === 'miniboss'
              ? 4
              : entity.type === 'elite'
                ? 3
                : entity.type === 'crystal'
                  ? 1.5
                  : 2.5;

        return {
          key: entity.id,
          x: center + drawX,
          y: center + drawZ,
          color: MINIMAP_COLORS[entity.type],
          size: dotSize,
          opacity: entity.type === 'crystal' ? 0.4 : 1,
        };
      });
  }, [entities, playerX, playerZ, scale, center, mapRadius]);

  const pvpCircleRadius = pvpRadius ? pvpRadius * scale : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.6)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arena boundary */}
        <circle
          cx={center}
          cy={center}
          r={mapRadius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />

        {/* PvP shrink boundary */}
        {phase === 'pvp' && pvpCircleRadius != null && (
          <circle
            cx={center}
            cy={center}
            r={Math.min(pvpCircleRadius, mapRadius)}
            fill="none"
            stroke="rgba(255, 68, 68, 0.6)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}

        {/* Grid crosshair */}
        <line
          x1={center}
          y1={MINIMAP_PADDING}
          x2={center}
          y2={size - MINIMAP_PADDING}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
        />
        <line
          x1={MINIMAP_PADDING}
          y1={center}
          x2={size - MINIMAP_PADDING}
          y2={center}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
        />

        {/* Entity dots */}
        {dots.map((dot) => (
          <circle
            key={dot.key}
            cx={dot.x}
            cy={dot.y}
            r={dot.size}
            fill={dot.color}
            opacity={dot.opacity}
          />
        ))}

        {/* Player indicator (always center) */}
        <circle
          cx={center}
          cy={center}
          r={3}
          fill={MINIMAP_COLORS.player}
          stroke="#000"
          strokeWidth={0.5}
        />
        {/* Direction indicator */}
        <circle
          cx={center}
          cy={center}
          r={5}
          fill="none"
          stroke={MINIMAP_COLORS.player}
          strokeWidth={0.5}
          opacity={0.5}
        />
      </svg>

      {/* Phase label */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 8,
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {phase}
      </div>
    </div>
  );
}

export const ARMinimap = memo(ARMinimapInner);
