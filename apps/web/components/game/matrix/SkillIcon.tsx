'use client';

/**
 * SkillIcon.tsx - 커스텀 스킬 아이콘 컴포넌트
 *
 * assets/skills/{category}/{id}.png 이미지를 렌더링하고,
 * 이미지 로드 실패 또는 경로가 없는 경우 lucide-react Zap 아이콘으로 폴백.
 */

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { getSkillIconPath } from '@/lib/matrix/utils/skill-icons';
import type { WeaponType } from '@/lib/matrix/types';

interface SkillIconProps {
  type: WeaponType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkillIcon({ type, size = 24, className, style }: SkillIconProps) {
  const [error, setError] = useState(false);
  const path = getSkillIconPath(type);

  if (error || !path) {
    return <Zap size={size} className={className} style={style} />;
  }

  return (
    <img
      src={path}
      alt={type}
      width={size}
      height={size}
      className={className}
      onError={() => setError(true)}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  );
}
