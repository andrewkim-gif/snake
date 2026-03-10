'use client';

/**
 * EconomyMilestoneBanner.tsx - v37 Phase 6: Gold 마일스톤 배너
 *
 * 1000G / 5000G / 10000G 마일스톤 도달 시 화면 상단에 2초간 배너 표시.
 * Phase 5의 PhaseBanner와 유사한 애니메이션 패턴.
 *
 * 디자인: SK 팔레트, Chakra Petch heading, border-radius: 0
 */

import { memo, useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';

// ============================================
// 마일스톤 설정
// ============================================

interface MilestoneConfig {
  threshold: number;
  label: string;
  sublabel: string;
  color: string;
  intensity: 'normal' | 'high' | 'max';
}

const MILESTONES: MilestoneConfig[] = [
  { threshold: 1000,  label: 'GOLD MILESTONE',   sublabel: '1,000',  color: SK.gold,  intensity: 'normal' },
  { threshold: 5000,  label: 'WAR CHEST',         sublabel: '5,000',  color: '#FFD700', intensity: 'high' },
  { threshold: 10000, label: 'TREASURY FULL!',    sublabel: '10,000', color: '#FFD700', intensity: 'max' },
];

// ============================================
// Props
// ============================================

export interface EconomyMilestoneBannerProps {
  /** 현재 Gold 보유량 */
  gold: number;
}

// ============================================
// CSS Keyframes (주입 1회)
// ============================================

const KEYFRAMES_INJECTED = typeof window !== 'undefined' ? (() => {
  const styleId = 'economy-milestone-v37-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes milestoneSlideIn {
        from { opacity: 0; transform: translate(-50%, -20px) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, 0) scale(1); }
      }
      @keyframes milestoneFadeOut {
        from { opacity: 1; }
        to { opacity: 0; transform: translate(-50%, -10px); }
      }
      @keyframes milestoneShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes milestonePulse {
        0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
        50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.5); }
      }
    `;
    document.head.appendChild(style);
  }
  return true;
})() : false;

// Prevent unused variable warning
void KEYFRAMES_INJECTED;

// ============================================
// Component
// ============================================

function EconomyMilestoneBannerInner({ gold }: EconomyMilestoneBannerProps) {
  const [visible, setVisible] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneConfig | null>(null);
  const reachedRef = useRef<Set<number>>(new Set());
  const prevGoldRef = useRef(0);

  useEffect(() => {
    // 골드가 증가할 때만 체크
    if (gold <= prevGoldRef.current) {
      prevGoldRef.current = gold;
      return;
    }
    prevGoldRef.current = gold;

    // 아직 도달하지 않은 마일스톤 중 가장 높은 것 체크
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      const ms = MILESTONES[i];
      if (gold >= ms.threshold && !reachedRef.current.has(ms.threshold)) {
        reachedRef.current.add(ms.threshold);
        setActiveMilestone(ms);
        setVisible(true);

        const timer = setTimeout(() => setVisible(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [gold]);

  if (!visible || !activeMilestone) return null;

  const isMax = activeMilestone.intensity === 'max';
  const isHigh = activeMilestone.intensity === 'high' || isMax;

  return (
    <div style={{
      position: 'absolute',
      top: 60,
      left: '50%',
      transform: 'translate(-50%, 0)',
      zIndex: 90,
      pointerEvents: 'none',
      animation: 'milestoneSlideIn 0.4s ease-out, milestoneFadeOut 0.6s ease-in 1.4s forwards',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: isMax
          ? `linear-gradient(135deg, ${SK.cardBg}, rgba(245, 158, 11, 0.15))`
          : SK.cardBg,
        border: `1px solid ${activeMilestone.color}40`,
        borderRadius: 0,
        paddingLeft: 16,
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 10,
        animation: isHigh ? 'milestonePulse 0.8s ease-in-out infinite' : undefined,
      }}>
        {/* Left accent stripe */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: activeMilestone.color,
        }} />

        {/* Coin icon */}
        <div style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${activeMilestone.color}20`,
          border: `1px solid ${activeMilestone.color}40`,
          borderRadius: 0,
          flexShrink: 0,
        }}>
          <Coins size={20} style={{ color: activeMilestone.color }} />
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontFamily: headingFont,
            fontSize: isMax ? 18 : 15,
            fontWeight: 800,
            color: activeMilestone.color,
            letterSpacing: '0.12em',
            textShadow: isHigh ? `0 0 16px ${activeMilestone.color}60` : undefined,
          }}>
            {activeMilestone.label}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: 11,
            color: SK.textSecondary,
          }}>
            {activeMilestone.sublabel} GOLD
          </span>
        </div>
      </div>

      {/* Gold vignette for max milestone */}
      {isMax && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(245, 158, 11, 0.1) 100%)',
          animation: 'milestoneFadeOut 1s ease-in 1s forwards',
          zIndex: -1,
        }} />
      )}
    </div>
  );
}

const EconomyMilestoneBanner = memo(EconomyMilestoneBannerInner);
export default EconomyMilestoneBanner;
