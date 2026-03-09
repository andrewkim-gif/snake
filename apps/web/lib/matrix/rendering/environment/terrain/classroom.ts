/**
 * game/rendering/environment/terrain/classroom.ts - 교실동 지형지물 (Stage 1-5)
 *
 * 책상, 사물함, 칠판
 */

export interface TerrainParams {
  ctx: CanvasRenderingContext2D;
  cx: number;  // center x
  cy: number;  // center y
  hash: number;
  time: number;
}

export function drawClassroomTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash } = params;

  if (hash < 0.5) {
    // 학생 책상 - 3D 효과
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - 12, cy + 10, 26, 4);

    // 책상 다리 (금속)
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 12, cy + 2, 3, 10);
    ctx.fillRect(cx + 9, cy + 2, 3, 10);

    // 책상 상판 (연한 나무색)
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(cx - 14, cy - 4, 28, 8);
    // 상판 하이라이트
    ctx.fillStyle = '#e5c9a8';
    ctx.fillRect(cx - 14, cy - 4, 28, 2);

    // 책상 위 물건들 (교과서, 연필)
    if (hash > 0.3) {
      // 교과서
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(cx - 6, cy - 8, 10, 4);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(cx - 6, cy - 8, 10, 1);
    }
    if (hash > 0.4) {
      // 연필
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx + 6, cy - 6, 6, 2);
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(cx + 11, cy - 6, 1, 2);
    }

  } else if (hash < 0.8) {
    // 사물함 (Locker) - 녹색 금속
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 6, cy + 16, 14, 3);

    // 사물함 본체
    ctx.fillStyle = '#166534';
    ctx.fillRect(cx - 8, cy - 16, 16, 32);
    // 정면 하이라이트
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - 8, cy - 16, 2, 32);

    // 통풍구
    ctx.fillStyle = '#14532d';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx - 4, cy - 12 + i * 4, 8, 2);
    }

    // 손잡이
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx + 4, cy, 2, 6);

    // 번호판
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(cx - 4, cy + 8, 8, 5);
    ctx.fillStyle = '#1f2937';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.floor(hash * 30 + 1)), cx, cy + 12);

  } else {
    // 칠판 (Chalkboard)
    // 칠판 테두리 (나무)
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cx - 16, cy - 12, 32, 24);

    // 칠판 본체 (짙은 녹색)
    ctx.fillStyle = '#14532d';
    ctx.fillRect(cx - 14, cy - 10, 28, 20);

    // 분필 자국 (희미한 글씨)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(cx - 10, cy - 6, 12, 2);
    ctx.fillRect(cx - 8, cy - 2, 16, 2);
    ctx.fillRect(cx - 10, cy + 2, 10, 2);

    // 분필통
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(cx - 12, cy + 10, 24, 3);
    // 분필들
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 10, cy + 8, 4, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 4, cy + 8, 4, 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx + 2, cy + 8, 4, 2);
  }
}
