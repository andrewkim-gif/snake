'use client';

/**
 * DashboardPage — 통합 페이지 템플릿
 * PageHeader + StatCard grid + optional filters + content
 * 모든 허브 페이지의 일관된 래퍼
 */

import { SK, bodyFont, grid } from '@/lib/sketch-ui';
import { PageHeader } from './PageHeader';
import { StatCard } from './StatCard';
import type { LucideIcon } from 'lucide-react';

interface StatItem {
  label: string;
  value: string;
  color?: string;
  icon?: LucideIcon;
  subtext?: string;
}

interface DashboardPageProps {
  /** PageHeader icon */
  icon: LucideIcon;
  /** PageHeader 제목 */
  title: string;
  /** PageHeader 설명 */
  description: string;
  /** 액센트 컬러 */
  accentColor?: string;
  /** 히어로 이미지 (우측) */
  heroImage?: string;
  /** PageHeader 내부 추가 콘텐츠 (country badge 등) */
  headerChildren?: React.ReactNode;
  /** StatCard 배열 */
  stats?: StatItem[];
  /** 콘텐츠 최대 너비 (기본: none = 부모 레이아웃 따름) */
  maxWidth?: number;
  /** 메인 콘텐츠 */
  children: React.ReactNode;
}

export function DashboardPage({
  icon,
  title,
  description,
  accentColor = SK.blue,
  heroImage,
  headerChildren,
  stats,
  maxWidth,
  children,
}: DashboardPageProps) {
  return (
    <div
      style={{
        fontFamily: bodyFont,
        ...(maxWidth ? { maxWidth, margin: '0 auto' } : {}),
      }}
    >
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        accentColor={accentColor}
        heroImage={heroImage}
      >
        {headerChildren}
      </PageHeader>

      {/* StatCard grid */}
      {stats && stats.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: grid.stat,
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              color={stat.color}
              icon={stat.icon}
              subtext={stat.subtext}
            />
          ))}
        </div>
      )}

      {/* 메인 콘텐츠 */}
      {children}
    </div>
  );
}
