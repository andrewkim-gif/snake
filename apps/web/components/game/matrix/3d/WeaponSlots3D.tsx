'use client';

/**
 * WeaponSlots3D.tsx — 3D 모드용 무기 슬롯 표시
 *
 * 화면 하단 중앙에 장착 무기 아이콘 + 쿨다운 게이지.
 * playerRef에서 weapons / weaponCooldowns를 읽어 표시.
 * 쿨다운은 bottom-up sweep 오버레이.
 *
 * MatrixScene의 matrix-scene-hud-overlay div 안에 렌더링.
 */

import { memo, useState, useEffect, useRef } from 'react';
import type { Player, WeaponType } from '@/lib/matrix/types';
import { WEAPON_DATA } from '@/lib/matrix/constants';
import { SK, headingFont, apexClip } from '@/lib/sketch-ui';

// ============================================
// Props
// ============================================

export interface WeaponSlots3DProps {
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
}

// ============================================
// 슬롯 데이터 타입
// ============================================

interface SlotData {
  type: WeaponType;
  level: number;
  cooldownPct: number; // 0~1 (0=준비됨, 1=풀 쿨다운)
  name: string;
  color: string;
}

// ============================================
// Main Component
// ============================================

function WeaponSlots3DInner({ playerRef }: WeaponSlots3DProps) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const animRef = useRef<number>(0);

  // playerRef에서 무기 정보 읽기 (~6fps)
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const p = playerRef.current;
      const weaponEntries = Object.entries(p.weapons ?? {}) as [WeaponType, any][];
      const cooldowns = p.weaponCooldowns ?? {};

      const newSlots: SlotData[] = [];
      for (const [type, instance] of weaponEntries) {
        if (!instance || instance.level <= 0) continue;

        const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
        const maxCd = data?.stats?.[instance.level - 1]?.cooldown ?? 1;
        const currentCd = (cooldowns as any)[type] ?? 0;
        const cdPct = maxCd > 0 ? Math.min(1, Math.max(0, currentCd / maxCd)) : 0;

        newSlots.push({
          type,
          level: instance.level,
          cooldownPct: cdPct,
          name: data?.name ?? type,
          color: data?.color ?? '#888',
        });
      }

      setSlots(newSlots);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [playerRef]);

  // 무기가 없으면 렌더링 안함
  if (slots.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30,
      display: 'flex',
      gap: 3,
      backgroundColor: SK.glassBg,
      backdropFilter: 'blur(8px)',
      border: `1px solid ${SK.border}`,
      padding: 4,
      clipPath: apexClip.sm,
      pointerEvents: 'none',
    }}>
      {slots.map((slot) => {
        const isEvolved = slot.level >= 11;
        const isUltimate = slot.level >= 20;
        const cdPct = Math.min(100, slot.cooldownPct * 100);

        return (
          <div key={slot.type} style={{ position: 'relative', flexShrink: 0 }}>
            {/* 카테고리 상단 컬러 스트라이프 */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              backgroundColor: slot.color,
              zIndex: 2,
              opacity: 0.8,
            }} />

            <div style={{
              width: 40,
              height: 40,
              backgroundColor: SK.cardBg,
              border: `1px solid ${isEvolved ? slot.color + '60' : SK.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isEvolved ? `0 0 8px ${slot.color}30` : 'none',
            }}>
              {/* 무기 아이콘 (텍스트 fallback) */}
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: headingFont,
                color: slot.color,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                textAlign: 'center',
                padding: '0 2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 36,
              }}>
                {slot.name.slice(0, 3)}
              </span>

              {/* 쿨다운 오버레이 — bottom-up fill */}
              {cdPct > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0,
                  width: '100%',
                  height: `${cdPct}%`,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  transition: 'height 0.1s linear',
                }} />
              )}

              {/* 레벨 뱃지 */}
              <div style={{
                position: 'absolute',
                bottom: 0, right: 0,
                backgroundColor: 'rgba(9, 9, 11, 0.9)',
                fontSize: 8,
                paddingLeft: 3,
                paddingRight: 3,
                paddingTop: 1,
                paddingBottom: 0,
                color: isUltimate ? SK.gold : isEvolved ? slot.color : SK.textSecondary,
                fontFamily: headingFont,
                fontWeight: 700,
                borderTop: `1px solid ${SK.border}`,
                borderLeft: `1px solid ${SK.border}`,
                lineHeight: '12px',
              }}>
                {slot.level}
              </div>

              {/* 진화 표시 */}
              {isEvolved && !isUltimate && (
                <div style={{
                  position: 'absolute',
                  top: 1, left: 1,
                  fontSize: 7,
                  lineHeight: 1,
                  color: slot.color,
                }}>
                  *
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WeaponSlots3D = memo(WeaponSlots3DInner);
export { WeaponSlots3D };
export default WeaponSlots3D;
