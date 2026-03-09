/**
 * game/rendering/environment/terrain/science.ts - 과학실 지형지물 (Stage 16-20)
 *
 * 실험대, 현미경, 인체 모형
 */

import type { TerrainParams } from './classroom';

export function drawScienceTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash, time } = params;

  if (hash < 0.4) {
    // 실험대 (Lab Table)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 12, cy + 10, 26, 4);

    // 테이블 다리
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 12, cy + 2, 3, 10);
    ctx.fillRect(cx + 9, cy + 2, 3, 10);

    // 테이블 상판 (검은색 화학 실험대)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 14, cy - 4, 28, 8);
    ctx.fillStyle = '#374151';
    ctx.fillRect(cx - 14, cy - 4, 28, 2);

    // 실험 도구들
    // 비커
    ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
    ctx.fillRect(cx - 10, cy - 10, 6, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - 9, cy - 8, 4, 3);

    // 삼각 플라스크
    ctx.fillStyle = 'rgba(252, 211, 77, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 10);
    ctx.lineTo(cx + 10, cy - 4);
    ctx.lineTo(cx + 4, cy - 4);
    ctx.closePath();
    ctx.fill();

    // 버너
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx + 2, cy - 6, 4, 2);
    const flame = Math.sin(time * 8) > 0;
    if (flame) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(cx + 3, cy - 10, 2, 4);
    }

  } else if (hash < 0.7) {
    // 현미경 (Microscope)
    // 베이스
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 8, cy + 6, 16, 6);
    ctx.fillRect(cx - 6, cy + 4, 12, 2);

    // 스테이지
    ctx.fillStyle = '#374151';
    ctx.fillRect(cx - 6, cy, 12, 4);

    // 암 (지지대)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx + 2, cy - 12, 4, 16);

    // 접안렌즈
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx, cy - 16, 8, 6);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(cx + 2, cy - 18, 4, 2);

    // 대물렌즈
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 2, cy - 4, 4, 4);

    // 조명
    const lightOn = Math.sin(time * 2) > -0.5;
    ctx.fillStyle = lightOn ? '#fef3c7' : '#78716c';
    ctx.fillRect(cx - 4, cy + 8, 8, 2);

  } else {
    // 인체 모형 (Skeleton Model)
    // 스탠드
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 6, cy + 14, 12, 4);
    ctx.fillRect(cx - 1, cy - 18, 2, 36);

    // 해골
    ctx.fillStyle = '#f5f5f4';
    // 두개골
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    // 눈구멍
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 4, cy - 14, 2, 2);
    ctx.fillRect(cx + 2, cy - 14, 2, 2);
    // 코
    ctx.fillRect(cx - 1, cy - 11, 2, 2);

    // 척추
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(cx - 1, cy - 6, 2, 12);

    // 갈비뼈
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 5, cy - 4 + i * 3, 10, 1);
    }

    // 골반
    ctx.fillRect(cx - 4, cy + 6, 8, 3);

    // 다리뼈
    ctx.fillRect(cx - 3, cy + 9, 2, 5);
    ctx.fillRect(cx + 1, cy + 9, 2, 5);
  }
}
