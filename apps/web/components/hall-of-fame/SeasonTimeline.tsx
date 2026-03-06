'use client';

/**
 * SeasonTimeline — 시즌 타임라인 표시 컴포넌트 (stub)
 * TODO: 시즌별 타임라인 데이터 구현
 */

import React from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';

interface SeasonTimelineProps {
  serverUrl: string;
  seasonId: string;
}

export default function SeasonTimeline({ serverUrl, seasonId }: SeasonTimelineProps) {
  void serverUrl; // will be used when timeline data is fetched
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        fontFamily: bodyFont,
        color: SK.textMuted,
        fontSize: '14px',
      }}
    >
      Season {seasonId} timeline coming soon...
    </div>
  );
}
