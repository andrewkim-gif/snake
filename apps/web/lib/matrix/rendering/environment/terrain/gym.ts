/**
 * game/rendering/environment/terrain/gym.ts - 체육관 지형지물 (Stage 11-15)
 *
 * 농구대, 체육 매트, 관람석
 */

import type { TerrainParams } from './classroom';

export function drawGymTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash } = params;

  if (hash < 0.35) {
    // 농구대 (Basketball Hoop)
    // 지지대
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 2, cy - 18, 4, 36);

    // 백보드
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(cx - 10, cy - 16, 20, 14);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 5, cy - 12, 10, 8);

    // 림 (주황)
    ctx.fillStyle = '#f97316';
    ctx.fillRect(cx - 8, cy - 2, 16, 2);
    // 네트 (간단화)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(cx - 6 + i * 3, cy);
      ctx.lineTo(cx - 4 + i * 2, cy + 10);
    }
    ctx.stroke();

  } else if (hash < 0.7) {
    // 체육 매트 (Gym Mat) - 파란색 폴딩 매트
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx - 12, cy + 10, 26, 3);

    // 매트 본체 (접힌 상태)
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(cx - 14, cy - 6, 28, 16);
    // 접힌 부분 라인
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(cx - 14, cy + 2, 28, 2);
    // 하이라이트
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(cx - 14, cy - 6, 28, 2);

    // 패딩 질감
    ctx.fillStyle = '#1e40af';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 12 + i * 7, cy - 4, 5, 4);
    }

  } else {
    // 관람석 (Bleachers) - 계단식
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 14, cy + 14, 30, 3);

    // 금속 프레임
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 16, cy - 14, 2, 28);
    ctx.fillRect(cx + 14, cy - 14, 2, 28);

    // 좌석 단 (나무)
    const seatColors = ['#d4a574', '#c9956c', '#be8764'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = seatColors[i];
      ctx.fillRect(cx - 14, cy - 10 + i * 8, 28, 6);
      // 좌석 하이라이트
      ctx.fillStyle = '#e5c9a8';
      ctx.fillRect(cx - 14, cy - 10 + i * 8, 28, 1);
    }

    // 등받이 지지대
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - 12, cy - 14, 2, 4);
    ctx.fillRect(cx + 10, cy - 14, 2, 4);
  }
}
