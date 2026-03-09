/**
 * game/rendering/environment/terrain/cafeteria.ts - 급식실 지형지물 (Stage 6-10)
 *
 * 급식 테이블, 배식 카트, 자판기
 */

import type { TerrainParams } from './classroom';

export function drawCafeteriaTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash } = params;

  if (hash < 0.45) {
    // 급식 테이블 (스테인리스)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 14, cy + 10, 30, 4);

    // 테이블 다리
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx - 14, cy + 4, 3, 8);
    ctx.fillRect(cx + 11, cy + 4, 3, 8);

    // 테이블 상판 (스테인리스 스틸)
    const steelGrad = ctx.createLinearGradient(cx - 16, cy - 4, cx + 16, cy - 4);
    steelGrad.addColorStop(0, '#9ca3af');
    steelGrad.addColorStop(0.5, '#e5e7eb');
    steelGrad.addColorStop(1, '#9ca3af');
    ctx.fillStyle = steelGrad;
    ctx.fillRect(cx - 16, cy - 4, 32, 10);

    // 급식판들
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(cx - 12, cy - 8, 10, 4);
    ctx.fillRect(cx + 2, cy - 8, 10, 4);
    // 음식 (색깔 점들)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 10, cy - 7, 3, 2);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - 6, cy - 7, 3, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx + 4, cy - 7, 3, 2);

  } else if (hash < 0.75) {
    // 배식 카트
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 10, cy + 12, 22, 3);

    // 바퀴
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx - 8, cy + 12, 3, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy + 12, 3, 0, Math.PI * 2);
    ctx.fill();

    // 카트 본체
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(cx - 12, cy - 8, 24, 20);
    // 금속 질감
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(cx - 12, cy - 8, 24, 2);

    // 배식통들
    const foodColors = ['#ef4444', '#22c55e', '#fbbf24', '#8b5cf6'];
    foodColors.forEach((color, i) => {
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(cx - 10 + i * 5, cy - 6, 4, 8);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 9 + i * 5, cy - 4, 2, 4);
    });

    // 손잡이
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 14, cy - 2, 2, 10);
    ctx.fillRect(cx + 12, cy - 2, 2, 10);

  } else {
    // 자판기 (Vending Machine)
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 8, cy + 16, 18, 3);

    // 본체
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 10, cy - 16, 20, 32);
    // 하이라이트
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 10, cy - 16, 3, 32);

    // 유리창 (음료 디스플레이)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 7, cy - 14, 14, 18);
    // 음료들
    const drinkColors = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6'];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = drinkColors[(row + col) % 4];
        ctx.fillRect(cx - 5 + col * 4, cy - 12 + row * 5, 3, 4);
      }
    }

    // 동전 투입구
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx + 2, cy + 6, 4, 6);
    // 버튼
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - 6, cy + 8, 6, 4);
  }
}
