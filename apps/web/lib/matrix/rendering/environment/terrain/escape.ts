/**
 * game/rendering/environment/terrain/escape.ts - 탈출 지형지물 (Stage 26-30)
 *
 * 바리케이드, 잔해, 비상구 표지판
 */

import type { TerrainParams } from './classroom';

export function drawEscapeTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash, time } = params;

  if (hash < 0.4) {
    // 바리케이드 (Barricade) - 책상/의자로 만든 임시 장벽
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 14, cy + 10, 30, 4);

    // 뒤집힌 책상
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(cx - 16, cy - 6, 32, 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 14, cy, 4, 10);
    ctx.fillRect(cx + 10, cy, 4, 10);

    // 쌓인 의자
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 8, cy - 12, 8, 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 6, cy - 6, 2, 4);

    // 경고 테이프
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 14, cy - 8, 28, 2);
    ctx.fillStyle = '#1f2937';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(cx - 12 + i * 4, cy - 8, 2, 2);
    }

  } else if (hash < 0.7) {
    // 잔해/파편 (Debris) - 무너진 천장, 부서진 물건들
    // 콘크리트 조각들
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx - 10, cy - 4, 12, 8);
    ctx.fillRect(cx - 6, cy + 4, 8, 6);
    ctx.fillRect(cx + 4, cy - 8, 8, 12);

    // 철근
    ctx.fillStyle = '#78716c';
    ctx.fillRect(cx - 14, cy - 6, 2, 16);
    ctx.fillRect(cx + 8, cy - 10, 2, 20);

    // 먼지/파편
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(cx - 8, cy - 10, 4, 4);
    ctx.fillRect(cx + 2, cy + 8, 4, 4);

    // 유리 파편 (반짝임)
    const glint = Math.sin(time * 4 + hash * 10) > 0.5;
    if (glint) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(cx - 4, cy - 2, 2, 2);
      ctx.fillRect(cx + 6, cy + 2, 2, 2);
    }

  } else {
    // 비상구 표지판 (Exit Sign) - 녹색 발광
    const glow = Math.sin(time * 3) * 0.2 + 0.8;

    // 글로우 효과
    ctx.fillStyle = `rgba(34, 197, 94, ${0.3 * glow})`;
    ctx.fillRect(cx - 12, cy - 10, 24, 16);

    // 표지판 본체
    ctx.fillStyle = '#166534';
    ctx.fillRect(cx - 10, cy - 8, 20, 12);

    // 비상구 아이콘 (달리는 사람)
    ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
    // 머리
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    // 몸
    ctx.fillRect(cx - 5, cy - 2, 2, 4);
    // 다리 (달리는 자세)
    ctx.fillRect(cx - 6, cy + 2, 2, 3);
    ctx.fillRect(cx - 4, cy + 2, 3, 2);
    // 팔
    ctx.fillRect(cx - 3, cy - 1, 3, 1);

    // 화살표
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 2);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.lineTo(cx + 6, cy + 2);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx + 6, cy - 4);
    ctx.lineTo(cx + 6, cy - 2);
    ctx.closePath();
    ctx.fill();

    // "EXIT" 텍스트
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', cx, cy + 7);
  }
}
