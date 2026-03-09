/**
 * game/rendering/environment/terrain/admin.ts - 본관 지형지물 (Stage 21-25)
 *
 * 사무 책상, 서류함, 트로피 진열장
 */

import type { TerrainParams } from './classroom';

export function drawAdminTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash } = params;

  if (hash < 0.4) {
    // 사무 책상 (Office Desk)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 12, cy + 12, 26, 4);

    // 책상 서랍장 (왼쪽)
    ctx.fillStyle = '#78716c';
    ctx.fillRect(cx - 14, cy - 4, 10, 16);
    ctx.fillStyle = '#a8a29e';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx - 12, cy - 2 + i * 5, 6, 4);
      // 손잡이
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(cx - 10, cy + i * 5, 2, 1);
      ctx.fillStyle = '#a8a29e';
    }

    // 책상 상판
    ctx.fillStyle = '#57534e';
    ctx.fillRect(cx - 14, cy - 6, 28, 4);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(cx - 14, cy - 6, 28, 1);

    // 책상 다리 (오른쪽)
    ctx.fillStyle = '#44403c';
    ctx.fillRect(cx + 10, cy - 2, 4, 14);

    // 모니터
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx, cy - 14, 12, 8);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(cx + 1, cy - 13, 10, 6);
    ctx.fillRect(cx + 4, cy - 6, 4, 2);

  } else if (hash < 0.75) {
    // 서류함 (File Cabinet)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 7, cy + 16, 16, 3);

    // 본체
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 9, cy - 16, 18, 32);
    // 하이라이트
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx - 9, cy - 16, 2, 32);

    // 서랍 4단
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(cx - 7, cy - 14 + i * 8, 14, 6);
      // 손잡이
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(cx - 2, cy - 12 + i * 8, 4, 2);
      // 라벨
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(cx + 2, cy - 11 + i * 8, 4, 3);
    }

  } else {
    // 트로피 진열장 (Trophy Case)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 10, cy + 16, 22, 3);

    // 캐비닛 프레임 (나무)
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cx - 12, cy - 16, 24, 32);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx - 12, cy - 16, 2, 32);

    // 유리창
    ctx.fillStyle = 'rgba(147, 197, 253, 0.3)';
    ctx.fillRect(cx - 10, cy - 14, 20, 28);

    // 선반
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 10, cy - 2, 20, 2);
    ctx.fillRect(cx - 10, cy + 10, 20, 2);

    // 트로피들
    ctx.fillStyle = '#fbbf24';
    // 큰 트로피 (위)
    ctx.fillRect(cx - 2, cy - 12, 4, 2);
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 10);
    ctx.lineTo(cx + 4, cy - 10);
    ctx.lineTo(cx + 2, cy - 4);
    ctx.lineTo(cx - 2, cy - 4);
    ctx.closePath();
    ctx.fill();
    // 작은 트로피 (아래)
    ctx.fillRect(cx - 6, cy + 4, 3, 6);
    ctx.fillRect(cx + 3, cy + 4, 3, 6);
  }
}
