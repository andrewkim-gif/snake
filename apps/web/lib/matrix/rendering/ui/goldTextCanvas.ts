/**
 * goldTextCanvas.ts - v37 Phase 6: Gold 플로팅 텍스트 Canvas 렌더러
 *
 * 적 사망 위치에서 "+25G" 형태의 텍스트가 위로 떠오르며 페이드아웃.
 * comboCanvas.ts 패턴을 참조한 Canvas 2D 렌더링.
 *
 * 기능:
 * - 골드 텍스트 풀 관리 (동시 최대 20개, 초과 시 가장 오래된 것 제거)
 * - 일반: "+25G" (금색 #CC9933)
 * - 크리티컬: "+38G CRIT!" (금색 + 크기 1.5배)
 * - 콤보: "+25G x2.5" (금색 + 콤보 배율 표시)
 * - 1초간 위로 이동 후 페이드아웃
 */

// ============================================
// Types
// ============================================

export interface GoldTextEntry {
  /** 월드 좌표 X */
  worldX: number;
  /** 월드 좌표 Y */
  worldY: number;
  /** 골드 양 */
  amount: number;
  /** 크리티컬 킬 여부 */
  isCritical: boolean;
  /** 콤보 배율 (0이면 미표시) */
  comboMultiplier: number;
  /** 생성 시각 (performance.now) */
  createdAt: number;
  /** 지속 시간 (ms) — 기본 1000 */
  duration: number;
}

// ============================================
// 상수
// ============================================

const MAX_FLOATING_TEXTS = 20;
const DEFAULT_DURATION = 1000;
const FLOAT_DISTANCE = 60; // 위로 올라가는 거리 (px)
const GOLD_COLOR = '#CC9933';
const GOLD_BRIGHT = '#FFD700';
const CRIT_SCALE = 1.5;

// ============================================
// 텍스트 풀
// ============================================

const textPool: GoldTextEntry[] = [];

/**
 * 골드 플로팅 텍스트를 풀에 추가
 */
export function addGoldFloatingText(
  worldX: number,
  worldY: number,
  amount: number,
  isCritical: boolean = false,
  comboMultiplier: number = 0,
): void {
  // 풀 상한 초과 시 가장 오래된 것 제거
  while (textPool.length >= MAX_FLOATING_TEXTS) {
    textPool.shift();
  }

  textPool.push({
    worldX,
    worldY,
    amount,
    isCritical,
    comboMultiplier,
    createdAt: performance.now(),
    duration: DEFAULT_DURATION,
  });
}

/**
 * 만료된 텍스트 제거
 */
function pruneExpired(now: number): void {
  // 역순 순회로 splice O(n²) 방지
  for (let i = textPool.length - 1; i >= 0; i--) {
    if (now - textPool[i].createdAt > textPool[i].duration) {
      textPool.splice(i, 1);
    }
  }
}

/**
 * 모든 골드 플로팅 텍스트 렌더링
 *
 * @param ctx - Canvas 2D context
 * @param camera - 카메라 오프셋 { x, y }
 * @param now - performance.now() (외부에서 전달하여 프레임 일관성)
 */
export function drawGoldFloatingTexts(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  now?: number,
): void {
  const t = now ?? performance.now();
  pruneExpired(t);

  if (textPool.length === 0) return;

  ctx.save();

  for (const entry of textPool) {
    const elapsed = t - entry.createdAt;
    const progress = Math.min(1, elapsed / entry.duration);

    // 위로 떠오름 (easeOut)
    const eased = 1 - Math.pow(1 - progress, 3);
    const offsetY = -FLOAT_DISTANCE * eased;

    // 페이드아웃 (후반 40%에서 시작)
    const fadeStart = 0.6;
    const alpha = progress > fadeStart ? 1 - (progress - fadeStart) / (1 - fadeStart) : 1;

    // 화면 좌표 계산
    const screenX = entry.worldX - camera.x;
    const screenY = entry.worldY - camera.y + offsetY;

    // 화면 밖이면 스킵
    if (screenX < -100 || screenX > (typeof window !== 'undefined' ? window.innerWidth : 1920) + 100 ||
        screenY < -100 || screenY > (typeof window !== 'undefined' ? window.innerHeight : 1080) + 100) {
      continue;
    }

    ctx.globalAlpha = alpha;

    // 크기: 크리티컬이면 1.5배
    const baseSize = entry.isCritical ? 20 * CRIT_SCALE : 20;

    // 텍스트 구성
    let text = `+${entry.amount}G`;
    if (entry.isCritical) text += ' CRIT!';
    if (entry.comboMultiplier > 0) text += ` x${entry.comboMultiplier.toFixed(1)}`;

    ctx.font = `bold ${Math.round(baseSize)}px "Chakra Petch", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 아웃라인 (가독성)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = entry.isCritical ? 4 : 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, screenX, screenY);

    // 글로우 (크리티컬 시)
    if (entry.isCritical) {
      ctx.shadowColor = GOLD_BRIGHT;
      ctx.shadowBlur = 12;
    }

    // 메인 텍스트
    ctx.fillStyle = entry.isCritical ? GOLD_BRIGHT : GOLD_COLOR;
    ctx.fillText(text, screenX, screenY);

    // 글로우 리셋
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 텍스트 풀 초기화 (매치 시작/종료 시)
 */
export function clearGoldFloatingTexts(): void {
  textPool.length = 0;
}

/**
 * 현재 활성 텍스트 수 반환 (디버그용)
 */
export function getActiveGoldTextCount(): number {
  return textPool.length;
}
