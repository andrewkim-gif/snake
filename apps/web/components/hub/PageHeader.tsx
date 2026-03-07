'use client';

/**
 * PageHeader — 대시보드 페이지 헤더
 * 아이콘 + 제목 + 설명 + 우측 히어로 이미지 (선택)
 * 글래스모피즘 카드 스타일
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
  accentColor = SK.blue,
  heroImage,
  children,
}: PageHeaderProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        background: SK.glassBg,
        border: `1px solid ${SK.glassBorder}`,
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* 상단 액센트 라인 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40, transparent)`,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 좌측: 아이콘 + 제목 + 설명 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
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
              }}
            >
              {title}
            </h1>
          </div>
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: '13px',
              color: SK.textSecondary,
              margin: 0,
              lineHeight: 1.5,
              maxWidth: '560px',
            }}
          >
            {description}
          </p>

          {/* 추가 콘텐츠 (통계, 필터 등) */}
          {children && <div style={{ marginTop: '16px' }}>{children}</div>}
        </div>

        {/* 우측: 히어로 이미지 (선택) */}
        {heroImage && !imgError && (
          <div
            style={{
              flexShrink: 0,
              marginLeft: '20px',
              width: '140px',
              height: '140px',
              borderRadius: '12px',
              overflow: 'hidden',
              opacity: 0.8,
              display: 'none',
            }}
            className="page-header-hero"
          >
            <style>{`
              @media (min-width: 768px) {
                .page-header-hero { display: block !important; }
              }
            `}</style>
            <Image
              src={heroImage}
              alt=""
              width={280}
              height={280}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'saturate(0.8)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
