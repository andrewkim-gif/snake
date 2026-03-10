/**
 * ultimateCutscene.ts - v37 Phase 9: 궁극 컷씬 연출
 *
 * Tier 4 (궁극) 달성 시 1초 화면 플래시 + 타이틀 표시.
 * Canvas 2D 기반: 전체 화면 화이트 플래시 → 무기명 + "ULTIMATE" 텍스트 → 파티클 폭발.
 *
 * evolutionCutscene.ts와 동일한 패턴이나, 더 크고 화려한 연출.
 *
 * 사용법:
 *   import { triggerUltimateCutscene, updateAndDrawUltimateCutscene } from './ultimateCutscene';
 *   triggerUltimateCutscene('CODE', '플라즈마 래쉬');
 *   // 매 프레임 호출:
 *   updateAndDrawUltimateCutscene(ctx, now);
 */

// ============================================
// 타입 정의
// ============================================

type CategoryKey = 'CODE' | 'DATA' | 'NETWORK' | 'SECURITY' | 'SYSTEM';

/** 궁극 컷씬 상태 */
interface UltimateCutsceneState {
  active: boolean;
  category: CategoryKey;
  weaponName: string;
  startTime: number;
  duration: number;
  particles: UltimateParticle[];
  lastUpdateTime: number;
}

/** 궁극 파티클 */
interface UltimateParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
  ring: boolean; // 링 형태 파티클 여부
}

// ============================================
// 상수
// ============================================

const CUTSCENE_DURATION = 1000; // 1초
const PARTICLE_COUNT = 40;
const RING_PARTICLE_COUNT = 12;

/** 카테고리별 컬러 */
const CATEGORY_COLORS: Record<CategoryKey, { main: string; highlight: string; deep: string }> = {
  CODE:     { main: '#EF4444', highlight: '#FCA5A5', deep: '#7F1D1D' },
  DATA:     { main: '#3B82F6', highlight: '#93C5FD', deep: '#1E3A8A' },
  NETWORK:  { main: '#8B5CF6', highlight: '#C4B5FD', deep: '#4C1D95' },
  SECURITY: { main: '#22C55E', highlight: '#86EFAC', deep: '#14532D' },
  SYSTEM:   { main: '#06B6D4', highlight: '#67E8F9', deep: '#164E63' },
};

/** 금색 (ULTIMATE 공통) */
const GOLD = '#FFD700';
const GOLD_DARK = '#CC9933';

// ============================================
// 컷씬 상태 (싱글턴)
// ============================================

let cutsceneState: UltimateCutsceneState = {
  active: false,
  category: 'CODE',
  weaponName: '',
  startTime: 0,
  duration: CUTSCENE_DURATION,
  particles: [],
  lastUpdateTime: 0,
};

// ============================================
// 파티클 생성
// ============================================

function createUltimateParticles(category: CategoryKey): UltimateParticle[] {
  const colors = CATEGORY_COLORS[category];
  const particles: UltimateParticle[] = [];

  // 방사형 폭발 파티클
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.2;
    const speed = 120 + Math.random() * 200;
    const colorOptions = [colors.main, colors.highlight, GOLD, GOLD_DARK];
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];

    particles.push({
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 7,
      color,
      alpha: 1,
      life: 500 + Math.random() * 400,
      maxLife: 500 + Math.random() * 400,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 12,
      ring: false,
    });
  }

  // 확산 링 파티클 (큰 원형)
  for (let i = 0; i < RING_PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / RING_PARTICLE_COUNT;
    const speed = 200 + Math.random() * 100;

    particles.push({
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 8 + Math.random() * 4,
      color: GOLD,
      alpha: 0.8,
      life: 600,
      maxLife: 600,
      rotation: angle,
      rotSpeed: 0,
      ring: true,
    });
  }

  return particles;
}

// ============================================
// Public API
// ============================================

/**
 * 궁극 컷씬 트리거
 * @param category 카테고리 키
 * @param weaponName 궁극 무기 이름 (예: '플라즈마 래쉬')
 */
export function triggerUltimateCutscene(
  category: CategoryKey,
  weaponName: string,
): void {
  const now = performance.now();
  cutsceneState = {
    active: true,
    category,
    weaponName,
    startTime: now,
    duration: CUTSCENE_DURATION,
    particles: createUltimateParticles(category),
    lastUpdateTime: now,
  };
}

/**
 * 궁극 컷씬 활성 여부
 */
export function isUltimateCutsceneActive(): boolean {
  return cutsceneState.active;
}

/**
 * 궁극 컷씬 업데이트 + 렌더링
 *
 * 화면 중앙에 풀스크린 렌더링됩니다.
 * 매 프레임 호출해야 합니다.
 *
 * @param ctx - Canvas 2D context
 * @param now - performance.now()
 */
export function updateAndDrawUltimateCutscene(
  ctx: CanvasRenderingContext2D,
  now?: number,
): void {
  if (!cutsceneState.active) return;

  const t = now ?? performance.now();
  const elapsed = t - cutsceneState.startTime;
  const progress = Math.min(1, elapsed / cutsceneState.duration);

  // 컷씬 종료
  if (progress >= 1) {
    cutsceneState.active = false;
    return;
  }

  const { category, weaponName, particles } = cutsceneState;
  const colors = CATEGORY_COLORS[category];
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const centerX = vpW / 2;
  const centerY = vpH / 2;

  ctx.save();

  // ─── Phase 1: 화이트 플래시 (0% ~ 25%) ───
  if (progress < 0.25) {
    const flashPhase = progress / 0.25;

    // 강렬한 화이트 플래시
    const flashAlpha = flashPhase < 0.5
      ? flashPhase * 2 * 0.8  // 0 → 0.8 (페이드인)
      : (1 - (flashPhase - 0.5) * 2) * 0.8; // 0.8 → 0 (페이드아웃)

    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, vpW, vpH);

    // 카테고리 컬러 플래시 (화이트 위에)
    const catAlpha = flashAlpha * 0.3;
    ctx.fillStyle = colors.main;
    ctx.globalAlpha = catAlpha;
    ctx.fillRect(0, 0, vpW, vpH);
    ctx.globalAlpha = 1;
  }

  // ─── 배경 디밍 (25% ~ 100%) ───
  if (progress >= 0.2) {
    const dimPhase = Math.min(1, (progress - 0.2) / 0.3);
    const dimFade = progress > 0.8 ? (1 - progress) / 0.2 : 1;
    const dimAlpha = dimPhase * 0.5 * dimFade;
    ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, vpW, vpH);
  }

  // ─── Phase 2: 충격파 링 확산 (20% ~ 60%) ───
  if (progress >= 0.2 && progress < 0.6) {
    const ringPhase = (progress - 0.2) / 0.4;
    const ringRadius = ringPhase * Math.max(vpW, vpH) * 0.4;
    const ringAlpha = Math.max(0, 1 - ringPhase);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4 - ringPhase * 3;
    ctx.globalAlpha = ringAlpha * 0.7;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 20;
    ctx.stroke();

    // 내부 링 (카테고리 컬러)
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.globalAlpha = ringAlpha * 0.5;
    ctx.shadowColor = colors.main;
    ctx.stroke();

    ctx.restore();
  }

  // ─── Phase 3: 파티클 폭발 (25% ~ 85%) ───
  if (progress >= 0.25 && progress < 0.85) {
    const burstPhase = (progress - 0.25) / 0.6;
    const dtMs = Math.min(t - cutsceneState.lastUpdateTime, 50);
    cutsceneState.lastUpdateTime = t;
    const dt = dtMs / 1000;

    for (const p of particles) {
      // 물리 업데이트
      p.x += p.vx * dt * Math.min(1, burstPhase * 2);
      p.y += p.vy * dt * Math.min(1, burstPhase * 2);
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.rotation += p.rotSpeed * dt;

      // 페이드
      p.alpha = Math.max(0, 1 - burstPhase * 1.3);

      if (p.alpha <= 0) continue;

      const screenX = centerX + p.x;
      const screenY = centerY + p.y;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.ring ? 10 : 5;

      if (p.ring) {
        // 링 파티클: 큰 원형 + 트레일
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        // 트레일
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.beginPath();
        ctx.arc(-p.vx * dt * 3, -p.vy * dt * 3, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 일반 파티클: 별 / 다이아몬드
        ctx.beginPath();
        if (p.size > 6) {
          // 큰 파티클: 별 형태
          for (let j = 0; j < 5; j++) {
            const a = (Math.PI * 2 * j) / 5 - Math.PI / 2;
            const outerX = Math.cos(a) * p.size;
            const outerY = Math.sin(a) * p.size;
            const innerA = a + Math.PI / 5;
            const innerX = Math.cos(innerA) * p.size * 0.4;
            const innerY = Math.sin(innerA) * p.size * 0.4;
            if (j === 0) {
              ctx.moveTo(outerX, outerY);
            } else {
              ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // 작은 파티클: 원
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  // ─── Phase 4: 무기명 + ULTIMATE 텍스트 (30% ~ 100%) ───
  if (progress >= 0.3) {
    const textPhase = (progress - 0.3) / 0.7;
    const appearEase = Math.min(1, textPhase * 3); // 빠르게 나타남
    const fadeOut = progress > 0.85 ? (1 - progress) / 0.15 : 1;
    const textAlpha = appearEase * fadeOut;

    // 스케일 애니메이션 (약간 바운스)
    const scaleEase = textPhase < 0.2
      ? 0.8 + 0.3 * (textPhase / 0.2) // 0.8 → 1.1
      : textPhase < 0.3
        ? 1.1 - 0.1 * ((textPhase - 0.2) / 0.1) // 1.1 → 1.0
        : 1.0;

    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.translate(centerX, centerY);
    ctx.scale(scaleEase, scaleEase);

    // "ULTIMATE" 라벨 (위쪽)
    ctx.font = `bold 16px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // letterSpacing: Canvas 2D spec (Chrome 99+, Safari 미지원 시 무시됨)
    try { (ctx as any).letterSpacing = '0.5em'; } catch { /* noop */ }

    // 아웃라인
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText('ULTIMATE', 0, -30);

    // 글로우 + 텍스트
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 20;
    ctx.fillStyle = GOLD;
    ctx.fillText('ULTIMATE', 0, -30);

    // 무기 이름 (크게)
    ctx.shadowBlur = 0;
    ctx.font = `bold 36px "Chakra Petch", sans-serif`;
    try { (ctx as any).letterSpacing = '0.1em'; } catch { /* noop */ }

    // 아웃라인
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(weaponName, 0, 10);

    // 글로우 + 텍스트
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 25;
    ctx.fillStyle = colors.highlight;
    ctx.fillText(weaponName, 0, 10);

    // 장식 라인 (좌우 수평선)
    ctx.shadowBlur = 0;
    const nameWidth = ctx.measureText(weaponName).width;
    const lineY = 10;
    const lineGap = nameWidth / 2 + 20;
    const lineLen = 60;

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = textAlpha * 0.7;

    ctx.beginPath();
    ctx.moveTo(-lineGap - lineLen, lineY);
    ctx.lineTo(-lineGap, lineY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lineGap, lineY);
    ctx.lineTo(lineGap + lineLen, lineY);
    ctx.stroke();

    // 크라운 이모지 대신 금색 작은 다이아몬드
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = textAlpha;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(6, -44);
    ctx.lineTo(0, -36);
    ctx.lineTo(-6, -44);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * 컷씬 상태 초기화 (매치 시작/종료 시)
 */
export function clearUltimateCutscene(): void {
  cutsceneState.active = false;
  cutsceneState.particles = [];
}
