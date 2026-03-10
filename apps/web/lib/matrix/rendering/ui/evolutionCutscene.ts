/**
 * evolutionCutscene.ts - v37 Phase 9: 진화 컷씬 연출
 *
 * Tier 3 (진화) 달성 시 0.5초 모프 애니메이션.
 * Canvas 2D 기반: 무기 아이콘 확대 → 파티클 폭발 → 새 아이콘.
 *
 * comboCanvas.ts / goldTextCanvas.ts 패턴 참조.
 *
 * 사용법:
 *   import { triggerEvolutionCutscene, updateAndDrawEvolutionCutscene } from './evolutionCutscene';
 *   triggerEvolutionCutscene('CODE', '전투 채찍', '전자기 채찍');
 *   // 매 프레임 호출:
 *   updateAndDrawEvolutionCutscene(ctx, now);
 */

// ============================================
// 타입 정의
// ============================================

/** 카테고리 키 (progressive-tree.config의 ProgressiveCategory) */
type CategoryKey = 'CODE' | 'DATA' | 'NETWORK' | 'SECURITY' | 'SYSTEM';

/** 진화 컷씬 상태 */
interface EvolutionCutsceneState {
  /** 활성 여부 */
  active: boolean;
  /** 카테고리 키 */
  category: CategoryKey;
  /** 기존 무기 이름 */
  oldName: string;
  /** 진화 무기 이름 */
  newName: string;
  /** 시작 시각 (performance.now) */
  startTime: number;
  /** 총 지속 시간 (ms) */
  duration: number;
  /** 파티클 배열 */
  particles: EvolutionParticle[];
  /** 마지막 업데이트 시각 (실제 dt 계산용) */
  lastUpdateTime: number;
}

/** 진화 파티클 */
interface EvolutionParticle {
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
  shape: 'circle' | 'diamond' | 'spark';
}

// ============================================
// 상수
// ============================================

const CUTSCENE_DURATION = 500; // 0.5초
const PARTICLE_COUNT = 24;
const ICON_MAX_SCALE = 2.5;

/** 카테고리별 컬러 (progressive-tree.config 기반) */
const CATEGORY_COLORS: Record<CategoryKey, { main: string; highlight: string; deep: string }> = {
  CODE:     { main: '#EF4444', highlight: '#FCA5A5', deep: '#7F1D1D' },
  DATA:     { main: '#3B82F6', highlight: '#93C5FD', deep: '#1E3A8A' },
  NETWORK:  { main: '#8B5CF6', highlight: '#C4B5FD', deep: '#4C1D95' },
  SECURITY: { main: '#22C55E', highlight: '#86EFAC', deep: '#14532D' },
  SYSTEM:   { main: '#06B6D4', highlight: '#67E8F9', deep: '#164E63' },
};

/** 카테고리별 파티클 형태 */
const CATEGORY_PARTICLE_SHAPES: Record<CategoryKey, ('circle' | 'diamond' | 'spark')[]> = {
  CODE:     ['spark', 'diamond', 'circle'],     // 금속 파편 + 불꽃 스파크
  DATA:     ['circle', 'spark', 'circle'],       // 에너지 링 + 전기 아크
  NETWORK:  ['diamond', 'circle', 'spark'],      // 체인 연결 + 보라색 오라
  SECURITY: ['diamond', 'diamond', 'circle'],    // 육각형 실드 조각 + 파동
  SYSTEM:   ['spark', 'circle', 'spark'],        // 별 파티클 + 충격파
};

// ============================================
// 컷씬 상태 (싱글턴)
// ============================================

let cutsceneState: EvolutionCutsceneState = {
  active: false,
  category: 'CODE',
  oldName: '',
  newName: '',
  startTime: 0,
  duration: CUTSCENE_DURATION,
  particles: [],
  lastUpdateTime: 0,
};

// ============================================
// 파티클 생성
// ============================================

function createEvolutionParticles(category: CategoryKey): EvolutionParticle[] {
  const colors = CATEGORY_COLORS[category];
  const shapes = CATEGORY_PARTICLE_SHAPES[category];
  const particles: EvolutionParticle[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.3;
    const speed = 80 + Math.random() * 120;
    const colorOptions = [colors.main, colors.highlight, colors.deep];
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];

    particles.push({
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 5,
      color,
      alpha: 1,
      life: 300 + Math.random() * 200,
      maxLife: 300 + Math.random() * 200,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 10,
      shape: shapes[i % shapes.length],
    });
  }

  return particles;
}

// ============================================
// Public API
// ============================================

/**
 * 진화 컷씬 트리거
 * @param category 카테고리 키 (CODE, DATA, NETWORK, SECURITY, SYSTEM)
 * @param oldName 기존 무기 이름
 * @param newName 진화 무기 이름
 */
export function triggerEvolutionCutscene(
  category: CategoryKey,
  oldName: string,
  newName: string,
): void {
  const now = performance.now();
  cutsceneState = {
    active: true,
    category,
    oldName,
    newName,
    startTime: now,
    duration: CUTSCENE_DURATION,
    particles: createEvolutionParticles(category),
    lastUpdateTime: now,
  };
}

/**
 * 진화 컷씬 활성 여부
 */
export function isEvolutionCutsceneActive(): boolean {
  return cutsceneState.active;
}

/**
 * 진화 컷씬 업데이트 + 렌더링
 *
 * 화면 중앙에 렌더링됩니다.
 * 매 프레임 호출해야 합니다.
 *
 * @param ctx - Canvas 2D context
 * @param now - performance.now()
 */
export function updateAndDrawEvolutionCutscene(
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

  const { category, oldName, newName, particles } = cutsceneState;
  const colors = CATEGORY_COLORS[category];
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const centerX = vpW / 2;
  const centerY = vpH / 2;

  ctx.save();

  // ─── 배경 디밍 (반투명 어두움) ───
  const dimAlpha = progress < 0.3
    ? progress / 0.3 * 0.3
    : progress > 0.7
      ? (1 - progress) / 0.3 * 0.3
      : 0.3;
  ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
  ctx.fillRect(0, 0, vpW, vpH);

  // ─── Phase 1: 아이콘 확대 (0% ~ 40%) ───
  if (progress < 0.4) {
    const phaseProgress = progress / 0.4;
    const eased = 1 - Math.pow(1 - phaseProgress, 3); // easeOutCubic
    const scale = 1 + (ICON_MAX_SCALE - 1) * eased;
    const shakeX = (Math.random() - 0.5) * phaseProgress * 6;
    const shakeY = (Math.random() - 0.5) * phaseProgress * 6;

    ctx.save();
    ctx.translate(centerX + shakeX, centerY + shakeY);
    ctx.scale(scale, scale);

    // 발광 배경 원
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = `${colors.main}40`;
    ctx.fill();

    // 무기 이름 (확대되는)
    ctx.font = `bold 24px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 아웃라인
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(oldName, 0, 0);

    // 글로우
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 10 + phaseProgress * 20;

    // 텍스트
    ctx.fillStyle = colors.main;
    ctx.fillText(oldName, 0, 0);

    ctx.restore();
  }

  // ─── Phase 2: 파티클 폭발 (40% ~ 70%) ───
  if (progress >= 0.3 && progress < 0.8) {
    const burstPhase = Math.min(1, (progress - 0.3) / 0.5);
    const dtMs = Math.min(t - cutsceneState.lastUpdateTime, 50); // 최대 50ms 클램프
    cutsceneState.lastUpdateTime = t;
    const dt = dtMs / 1000;

    for (const p of particles) {
      // 물리 업데이트
      p.x += p.vx * dt * burstPhase;
      p.y += p.vy * dt * burstPhase;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.rotation += p.rotSpeed * dt;

      // 페이드
      const pLife = Math.max(0, 1 - burstPhase * 1.2);
      p.alpha = pLife;

      if (p.alpha <= 0) continue;

      const screenX = centerX + p.x;
      const screenY = centerY + p.y;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;

      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.6, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          break;

        case 'spark':
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 0.5);
          ctx.lineTo(0, p.size * 0.5);
          ctx.stroke();
          break;
      }

      ctx.restore();
    }

    // 중앙 플래시
    if (burstPhase < 0.3) {
      const flashAlpha = (1 - burstPhase / 0.3) * 0.6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60 + burstPhase * 100, 0, Math.PI * 2);
      ctx.fillStyle = `${colors.highlight}`;
      ctx.globalAlpha = flashAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ─── Phase 3: 새 아이콘 표시 (60% ~ 100%) ───
  if (progress >= 0.6) {
    const appearPhase = (progress - 0.6) / 0.4;
    const eased = 1 - Math.pow(1 - appearPhase, 2); // easeOutQuad
    const scale = 0.5 + eased * 0.5;
    const alpha = Math.min(1, appearPhase * 2);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    // 발광 배경 링
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 3;
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 15;
    ctx.stroke();

    // 진화 무기 이름
    ctx.font = `bold 28px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 아웃라인
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(newName, 0, 0);

    // 글로우 + 텍스트
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 20;
    ctx.fillStyle = colors.highlight;
    ctx.fillText(newName, 0, 0);

    // EVOLVED 라벨
    ctx.font = `bold 12px "Chakra Petch", sans-serif`;
    ctx.shadowBlur = 8;
    ctx.fillStyle = colors.main;
    ctx.fillText('EVOLVED', 0, 30);

    ctx.restore();
  }

  ctx.restore();
}

/**
 * 컷씬 상태 초기화 (매치 시작/종료 시)
 */
export function clearEvolutionCutscene(): void {
  cutsceneState.active = false;
  cutsceneState.particles = [];
}
