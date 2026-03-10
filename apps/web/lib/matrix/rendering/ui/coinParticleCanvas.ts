/**
 * coinParticleCanvas.ts - v37 Phase 6: 킬→Gold 코인 파티클 시스템
 *
 * 킬 유형별 금색 코인 파티클을 Canvas 2D로 렌더링.
 * 오브젝트 풀링으로 성능 최적화 (파티클 상한 500개).
 *
 * 킬 유형별 코인 수:
 * - 일반 킬: 1 코인
 * - 크리티컬 킬: 3 코인
 * - 콤보 킬: 5 코인
 * - 궁극 킬: 10 코인
 *
 * 코인은 사망 위치에서 방사형으로 퍼진 뒤 아래로 떨어짐.
 */

// ============================================
// Types
// ============================================

export type KillType = 'normal' | 'critical' | 'combo' | 'ultimate';

interface CoinParticle {
  /** 월드 좌표 X */
  worldX: number;
  /** 월드 좌표 Y */
  worldY: number;
  /** X 속도 */
  vx: number;
  /** Y 속도 */
  vy: number;
  /** 코인 크기 (반지름) */
  size: number;
  /** 생성 시각 */
  createdAt: number;
  /** 수명 (ms) */
  lifetime: number;
  /** 회전 각도 */
  rotation: number;
  /** 회전 속도 */
  rotSpeed: number;
  /** 활성 여부 (풀 재활용) */
  active: boolean;
}

// ============================================
// 상수
// ============================================

const MAX_PARTICLES = 500;
const GRAVITY = 120; // px/s^2
const COIN_LIFETIME = 800; // ms

/** 킬 유형별 코인 수 */
const KILL_COIN_COUNTS: Record<KillType, number> = {
  normal: 1,
  critical: 3,
  combo: 5,
  ultimate: 10,
};

/** 킬 유형별 코인 크기 */
const KILL_COIN_SIZES: Record<KillType, number> = {
  normal: 4,
  critical: 5,
  combo: 5,
  ultimate: 6,
};

/** 킬 유형별 초기 속도 범위 */
const KILL_VELOCITY: Record<KillType, number> = {
  normal: 60,
  critical: 90,
  combo: 100,
  ultimate: 140,
};

// ============================================
// 파티클 풀
// ============================================

const particlePool: CoinParticle[] = [];
// Free index stack — O(1) 비활성 파티클 탐색
const freeIndices: number[] = [];

// 풀 초기화
function initPool(): void {
  if (particlePool.length >= MAX_PARTICLES) return;
  for (let i = particlePool.length; i < MAX_PARTICLES; i++) {
    particlePool.push({
      worldX: 0, worldY: 0, vx: 0, vy: 0,
      size: 4, createdAt: 0, lifetime: COIN_LIFETIME,
      rotation: 0, rotSpeed: 0, active: false,
    });
    freeIndices.push(i);
  }
}

/**
 * 비활성 파티클을 풀에서 가져오기 (O(1))
 */
function getInactiveParticle(): CoinParticle | null {
  if (freeIndices.length === 0) return null;
  const idx = freeIndices.pop()!;
  return particlePool[idx];
}

// ============================================
// Public API
// ============================================

/**
 * 킬 이벤트에 대한 코인 파티클 생성
 *
 * @param worldX - 적 사망 월드 X 좌표
 * @param worldY - 적 사망 월드 Y 좌표
 * @param killType - 킬 유형 (normal / critical / combo / ultimate)
 */
export function spawnCoinParticles(
  worldX: number,
  worldY: number,
  killType: KillType = 'normal',
): void {
  initPool();

  const count = KILL_COIN_COUNTS[killType];
  const baseSize = KILL_COIN_SIZES[killType];
  const velocity = KILL_VELOCITY[killType];
  const now = performance.now();

  for (let i = 0; i < count; i++) {
    const particle = getInactiveParticle();
    if (!particle) break; // 풀 소진

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = velocity * (0.6 + Math.random() * 0.4);

    particle.worldX = worldX + (Math.random() - 0.5) * 10;
    particle.worldY = worldY + (Math.random() - 0.5) * 10;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed - 40; // 초기 위쪽 편향
    particle.size = baseSize * (0.8 + Math.random() * 0.4);
    particle.createdAt = now;
    particle.lifetime = COIN_LIFETIME + Math.random() * 200;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotSpeed = (Math.random() - 0.5) * 8;
    particle.active = true;
  }
}

/**
 * 파티클 업데이트 + 렌더링
 *
 * @param ctx - Canvas 2D context
 * @param camera - 카메라 오프셋 { x, y }
 * @param deltaMs - 프레임 간격 (ms)
 * @param now - performance.now()
 */
export function updateAndDrawCoinParticles(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  deltaMs: number,
  now?: number,
): void {
  const t = now ?? performance.now();
  const dt = deltaMs / 1000; // seconds

  ctx.save();

  let activeCount = 0;

  // Viewport 캐시 (루프 밖)
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;

  for (let pi = 0; pi < particlePool.length; pi++) {
    const p = particlePool[pi];
    if (!p.active) continue;

    const elapsed = t - p.createdAt;
    if (elapsed > p.lifetime) {
      p.active = false;
      freeIndices.push(pi); // free index 반환
      continue;
    }

    activeCount++;

    // 물리 업데이트
    p.vy += GRAVITY * dt;
    p.worldX += p.vx * dt;
    p.worldY += p.vy * dt;
    p.rotation += p.rotSpeed * dt;

    // 감속 (공기저항)
    p.vx *= 0.98;

    // 화면 좌표
    const screenX = p.worldX - camera.x;
    const screenY = p.worldY - camera.y;
    if (screenX < -20 || screenX > vpW + 20 || screenY < -20 || screenY > vpH + 20) {
      continue;
    }

    // 페이드아웃 (수명의 마지막 30%)
    const progress = elapsed / p.lifetime;
    const fadeStart = 0.7;
    const alpha = progress > fadeStart ? 1 - (progress - fadeStart) / (1 - fadeStart) : 1;

    ctx.globalAlpha = alpha;

    // 코인 렌더링 (타원형 금화)
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(p.rotation);

    // 코인 그림자
    ctx.beginPath();
    ctx.ellipse(1, 1, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // 코인 본체 (금색 그라디언트)
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#CC9933';
    ctx.fill();

    // 코인 하이라이트
    ctx.beginPath();
    ctx.ellipse(-p.size * 0.25, -p.size * 0.15, p.size * 0.4, p.size * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.fill();

    // 코인 테두리
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 모든 코인 파티클 초기화 (매치 시작/종료 시)
 */
export function clearCoinParticles(): void {
  for (const p of particlePool) {
    p.active = false;
  }
}

/**
 * 현재 활성 파티클 수 반환 (디버그/성능 모니터링)
 */
export function getActiveCoinParticleCount(): number {
  let count = 0;
  for (const p of particlePool) {
    if (p.active) count++;
  }
  return count;
}
