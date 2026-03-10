'use client';

/**
 * SkillIconSVG.tsx - SVG 기반 스킬 아이콘 컴포넌트
 *
 * v37 인게임 오버홀: lucide-react 아이콘 기반 통합 아이콘 시스템
 *
 * 기능:
 * - WeaponType → lucide-react 아이콘 자동 매핑
 * - 카테고리별 컬러 코딩
 * - 레벨별 시각 상태 (미보유/기본/진화/궁극)
 * - 쿨다운 sweep 오버레이
 * - disabled 상태
 * - fallback: 아이콘 없을 때 카테고리 컬러 + 첫 글자 표시
 */

import { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WeaponType } from '@/lib/matrix/types';
import { getWeaponIconName } from '@/lib/matrix/config/skills/weapon-icons.config';
import { getCategoryDisplayColor } from '@/lib/matrix/config/skills/category-display.config';
import { getSkillCategory } from '@/lib/matrix/utils/skill-icons';

// ============================================
// 아이콘 리졸버
// ============================================

/**
 * lucide-react 아이콘 이름으로 컴포넌트를 가져온다.
 * 없으면 null 반환 → fallback 사용.
 */
function resolveLucideIcon(iconName: string): LucideIcon | null {
  const icon = (LucideIcons as Record<string, unknown>)[iconName];
  if (typeof icon === 'function') {
    return icon as LucideIcon;
  }
  return null;
}

// ============================================
// Props 인터페이스
// ============================================

export interface SkillIconSVGProps {
  /** 무기/스킬 타입 */
  type: WeaponType;
  /** 아이콘 크기 (px) — 기본 24 */
  size?: number;
  /** 무기 레벨 (0=미보유, 1~10=기본, 11~19=진화, 20=궁극) */
  level?: number;
  /** 쿨다운 진행률 (0=쿨다운없음, 0~1=진행중) */
  cooldownPercent?: number;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 추가 CSS className */
  className?: string;
  /** 추가 인라인 스타일 */
  style?: React.CSSProperties;
  /** 카테고리 컬러 오버라이드 (지정 안 하면 자동 탐지) */
  color?: string;
}

// ============================================
// 상태별 스타일 계산
// ============================================

/** 레벨 기반 시각 상태 */
type IconVisualState = 'unowned' | 'basic' | 'evolved' | 'ultimate';

function getVisualState(level: number): IconVisualState {
  if (level <= 0) return 'unowned';
  if (level >= 20) return 'ultimate';
  if (level >= 11) return 'evolved';
  return 'basic';
}

/**
 * 시각 상태에 따른 아이콘 컬러와 opacity 결정
 */
function getStateStyle(
  state: IconVisualState,
  categoryColor: string,
): { iconColor: string; opacity: number; glowColor?: string; showCrown?: boolean } {
  switch (state) {
    case 'unowned':
      return { iconColor: '#71717A', opacity: 0.5 };
    case 'basic':
      return { iconColor: categoryColor, opacity: 1 };
    case 'evolved':
      return { iconColor: categoryColor, opacity: 1, glowColor: categoryColor };
    case 'ultimate':
      return { iconColor: categoryColor, opacity: 1, glowColor: '#F59E0B', showCrown: true };
  }
}

// ============================================
// SkillIconSVG 컴포넌트
// ============================================

export function SkillIconSVG({
  type,
  size = 24,
  level = 1,
  cooldownPercent = 0,
  disabled = false,
  className,
  style,
  color,
}: SkillIconSVGProps) {
  // 카테고리 컬러 결정
  const categoryColor = useMemo(() => {
    if (color) return color;
    const cat = getSkillCategory(type);
    return cat ? getCategoryDisplayColor(cat) : '#666666';
  }, [type, color]);

  // lucide 아이콘 리졸브
  const iconName = getWeaponIconName(type);
  const IconComponent = useMemo(() => resolveLucideIcon(iconName), [iconName]);

  // 시각 상태
  const visualState = getVisualState(level);
  const stateStyle = getStateStyle(visualState, categoryColor);

  // disabled 시 그레이 처리
  const finalColor = disabled ? '#52525B' : stateStyle.iconColor;
  const finalOpacity = disabled ? 0.4 : stateStyle.opacity;

  // 쿨다운 오버레이 각도 (0~360도, 시계방향 sweep)
  const cooldownAngle = Math.min(1, Math.max(0, cooldownPercent)) * 360;
  const showCooldown = cooldownPercent > 0 && cooldownPercent < 1;

  // glow 필터 ID (진화/궁극 상태)
  const showGlow = !disabled && stateStyle.glowColor;
  const filterId = `glow-${type}-${size}`;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* SVG 래퍼 — glow 필터 + 아이콘 */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* glow 필터 정의 (진화/궁극) */}
        {showGlow && (
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.08} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* 진화 상태: 방사선 빛줄기 */}
        {visualState === 'evolved' && !disabled && (
          <g opacity={0.3}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1={size / 2}
                y1={size / 2}
                x2={size / 2 + Math.cos((angle * Math.PI) / 180) * size * 0.45}
                y2={size / 2 + Math.sin((angle * Math.PI) / 180) * size * 0.45}
                stroke={categoryColor}
                strokeWidth={1}
                strokeLinecap="round"
              />
            ))}
          </g>
        )}
      </svg>

      {/* lucide 아이콘 (또는 fallback) */}
      {IconComponent ? (
        <IconComponent
          size={size * 0.65}
          color={finalColor}
          strokeWidth={size <= 20 ? 1.5 : 2}
          style={{
            opacity: finalOpacity,
            filter: showGlow ? `url(#${filterId})` : undefined,
            position: 'relative',
            zIndex: 1,
          }}
        />
      ) : (
        /* Fallback: 카테고리 컬러 원 + 첫 글자 */
        <div
          style={{
            width: size * 0.65,
            height: size * 0.65,
            borderRadius: '50%',
            backgroundColor: `${finalColor}33`,
            border: `1.5px solid ${finalColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: finalOpacity,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span
            style={{
              color: finalColor,
              fontSize: size * 0.3,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {type.charAt(0)}
          </span>
        </div>
      )}

      {/* 궁극 크라운 오버레이 */}
      {stateStyle.showCrown && !disabled && (
        <svg
          width={size * 0.4}
          height={size * 0.4}
          viewBox="0 0 16 16"
          style={{
            position: 'absolute',
            top: -size * 0.1,
            right: -size * 0.1,
            zIndex: 2,
          }}
        >
          <path
            d="M2 12L3 6L5.5 8L8 4L10.5 8L13 6L14 12H2Z"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth={0.8}
          />
        </svg>
      )}

      {/* 쿨다운 sweep 오버레이 */}
      {showCooldown && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        >
          <clipPath id={`cd-clip-${type}-${size}`}>
            <CooldownWedge cx={size / 2} cy={size / 2} r={size / 2} angleDeg={cooldownAngle} />
          </clipPath>
          <rect
            x={0}
            y={0}
            width={size}
            height={size}
            fill="rgba(0,0,0,0.6)"
            clipPath={`url(#cd-clip-${type}-${size})`}
          />
        </svg>
      )}

      {/* disabled X 오버레이 */}
      {disabled && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, zIndex: 4 }}
        >
          <line
            x1={size * 0.25}
            y1={size * 0.25}
            x2={size * 0.75}
            y2={size * 0.75}
            stroke="#EF4444"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
          <line
            x1={size * 0.75}
            y1={size * 0.25}
            x2={size * 0.25}
            y2={size * 0.75}
            stroke="#EF4444"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        </svg>
      )}
    </div>
  );
}

// ============================================
// 쿨다운 Wedge SVG Path (시계 방향 sweep)
// ============================================

/**
 * 쿨다운 웨지 — 12시 방향에서 시계 방향으로 채워지는 부채꼴
 */
function CooldownWedge({
  cx,
  cy,
  r,
  angleDeg,
}: {
  cx: number;
  cy: number;
  r: number;
  angleDeg: number;
}) {
  if (angleDeg <= 0) return null;
  if (angleDeg >= 360) {
    return <circle cx={cx} cy={cy} r={r} />;
  }

  const startAngle = -90; // 12시 방향
  const endAngle = startAngle + angleDeg;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const largeArc = angleDeg > 180 ? 1 : 0;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const d = [
    `M ${cx} ${cy}`,
    `L ${x1} ${y1}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
    'Z',
  ].join(' ');

  return <path d={d} />;
}

// ============================================
// 하위 호환성: SkillIcon alias
// ============================================

/**
 * 기존 SkillIcon과 동일한 props 인터페이스 제공
 * (drop-in replacement)
 */
export function SkillIcon({
  type,
  size = 24,
  className,
  style,
}: {
  type: WeaponType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <SkillIconSVG
      type={type}
      size={size}
      level={1}
      className={className}
      style={style}
    />
  );
}
