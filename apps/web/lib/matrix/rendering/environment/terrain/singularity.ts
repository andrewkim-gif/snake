/**
 * game/rendering/environment/terrain/singularity.ts - 한계돌파 지형지물 (Singularity Mode)
 *
 * 전복된 버스, 군용 바리케이드, 감염 구역, 추락한 헬기
 */

import type { TerrainParams } from './classroom';

export function drawSingularityTerrain(params: TerrainParams): void {
  const { ctx, cx, cy, hash, time } = params;

  if (hash < 0.25) {
    // 전복된 버스 (Overturned Bus) - 대형 장애물
    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 16, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 버스 본체 (옆으로 누운 상태)
    ctx.fillStyle = '#fbbf24'; // 스쿨버스 노란색
    ctx.fillRect(cx - 24, cy - 10, 48, 20);

    // 버스 지붕 (위로 향함)
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cx - 24, cy - 14, 48, 4);

    // 창문들 (깨진 상태)
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(cx - 20 + i * 8, cy - 8, 6, 10);
      // 깨진 유리 효과
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(147, 197, 253, 0.4)';
        ctx.fillRect(cx - 18 + i * 8, cy - 6, 2, 4);
        ctx.fillStyle = '#1e293b';
      }
    }

    // 바퀴 (위로 향함)
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx - 16, cy - 16, 4, 0, Math.PI * 2);
    ctx.arc(cx + 16, cy - 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // "SCHOOL BUS" 텍스트
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCHOOL', cx, cy + 4);

    // 연기/불꽃 효과
    const smoke = Math.sin(time * 3) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(107, 114, 128, ${smoke * 0.5})`;
    ctx.beginPath();
    ctx.arc(cx - 20, cy - 18, 4 + smoke * 2, 0, Math.PI * 2);
    ctx.fill();

  } else if (hash < 0.5) {
    // 군용 바리케이드 (Military Barrier)
    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(cx - 14, cy + 12, 30, 4);

    // 콘크리트 블록
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 16, cy - 8, 32, 20);
    // 질감
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cx - 16, cy - 8, 32, 2);

    // 철조망
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 14 + i * 4, cy - 12);
      ctx.lineTo(cx - 12 + i * 4, cy - 8);
      ctx.stroke();
    }

    // 가시철조망 (위)
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - 16, cy - 14, 32, 4);
    // 가시
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(cx - 14 + i * 4, cy - 16, 2, 2);
    }

    // 경고 표지
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 6, cy - 4, 12, 8);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STOP', cx, cy + 2);

    // 군용 페인트 패턴
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - 14, cy + 4, 6, 4);
    ctx.fillRect(cx + 8, cy + 4, 6, 4);

  } else if (hash < 0.75) {
    // 감염 구역 (Infected Zone) - 바이오해저드
    const pulse = Math.sin(time * 2) * 0.3 + 0.7;

    // 오염된 바닥 웅덩이
    const zoneGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    zoneGlow.addColorStop(0, `rgba(132, 204, 22, ${0.5 * pulse})`);
    zoneGlow.addColorStop(0.5, `rgba(163, 230, 53, ${0.3 * pulse})`);
    zoneGlow.addColorStop(1, 'rgba(22, 101, 52, 0.2)');
    ctx.fillStyle = zoneGlow;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 바이오해저드 심볼
    ctx.fillStyle = `rgba(234, 179, 8, ${pulse})`;
    // 중앙 원
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    // 세 개의 호
    for (let i = 0; i < 3; i++) {
      const angle = i * (Math.PI * 2 / 3) - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 10, angle - 0.4, angle + 0.4);
      ctx.lineTo(cx + Math.cos(angle) * 6, cy - 4 + Math.sin(angle) * 6);
      ctx.fill();
    }

    // 기포 효과
    for (let i = 0; i < 4; i++) {
      const bubbleY = cy + 6 - ((time * 15 + i * 4) % 12);
      const bubbleX = cx - 8 + i * 5 + Math.sin(time * 2 + i) * 2;
      ctx.fillStyle = `rgba(163, 230, 53, ${0.6 - (cy + 6 - bubbleY) / 15})`;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 경고 표지판
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 4, cy - 16, 8, 8);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', cx, cy - 10);

  } else {
    // 추락한 헬기 (Helicopter Wreck)
    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 헬기 본체 (부서진 상태)
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 8, cy - 8);
    ctx.lineTo(cx + 12, cy - 8);
    ctx.lineTo(cx + 20, cy);
    ctx.lineTo(cx + 16, cy + 12);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.closePath();
    ctx.fill();

    // 캐노피 (깨진 유리)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 6);
    ctx.lineTo(cx + 8, cy - 6);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.closePath();
    ctx.fill();

    // 로터 블레이드 (부러짐)
    ctx.fillStyle = '#1f2937';
    ctx.save();
    ctx.translate(cx, cy - 10);
    ctx.rotate(hash * Math.PI);
    ctx.fillRect(-20, -2, 18, 4);
    ctx.fillRect(4, -2, 12, 4);
    ctx.restore();

    // 테일붐
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx + 16, cy - 2, 8, 4);
    ctx.fillRect(cx + 22, cy - 6, 2, 8);

    // 연기/불
    const fireFlicker = Math.sin(time * 8) > 0;
    if (fireFlicker) {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(cx - 10, cy + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(107, 114, 128, ${0.4 + Math.sin(time * 2) * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx - 10, cy + 2, 6, 0, Math.PI * 2);
    ctx.fill();

    // 스키드
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 14, cy + 12, 4, 4);
    ctx.fillRect(cx + 10, cy + 12, 4, 4);
  }
}
