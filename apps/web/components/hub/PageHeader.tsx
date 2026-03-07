'use client';

/**
 * PageHeader — 대시보드 페이지 헤더
 * 아이콘 + 제목 + 설명
 * heroImage 존재 시: 풀 배경 이미지 + 그라데이션 오버레이
 * heroImage 없을 시: 글래스모피즘 카드 스타일
 */

import { useState } from 'react';
import Image from 'next/image';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
  heroImage?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  accentColor = SK.accent,
  heroImage,
  children,
}: PageHeaderProps) {
  const [imgError, setImgError] = useState(false);
  const hasHero = !!heroImage && !imgError;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 0,
        overflow: 'hidden',
        marginBottom: '24px',
        minHeight: hasHero ? '200px' : undefined,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: hasHero ? 'flex-end' : 'flex-start',
        ...(!hasHero
          ? {
              background: SK.glassBg,
              border: `1px solid ${SK.glassBorder}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }
          : {}),
      }}
    >
      {/* 히어로 배경 이미지 + 그라데이션 오버레이 */}
      {hasHero && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            onError={() => setImgError(true)}
            style={{
              objectFit: 'cover',
              objectPosition: 'center 30%',
            }}
          />
          {/* 하단 그라데이션: 이미지 → 다크 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to bottom, transparent 0%, ${SK.bg}66 35%, ${SK.bg}CC 60%, ${SK.bg} 100%)`,
            }}
          />
        </div>
      )}

      {/* 상단 액센트 라인 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 2,
          background: accentColor,
        }}
      />

      {/* 콘텐츠 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: hasHero ? '80px 24px 24px' : '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 0,
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} strokeWidth={1.8} color={accentColor} />
          </div>
          <h1
            style={{
              fontFamily: headingFont,
              fontWeight: 700,
              fontSize: '22px',
              color: SK.textPrimary,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              margin: 0,
              textShadow: hasHero ? '0 1px 8px rgba(0,0,0,0.6)' : 'none',
            }}
          >
            {title}
          </h1>
        </div>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '13px',
            color: hasHero ? SK.textPrimary : SK.textSecondary,
            margin: 0,
            lineHeight: 1.5,
            maxWidth: '560px',
            textShadow: hasHero ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {description}
        </p>

        {/* 추가 콘텐츠 (통계, 필터 등) */}
        {children && <div style={{ marginTop: '16px' }}>{children}</div>}
      </div>
    </div>
  );
}
