/**
 * canvas-icon-renderer.ts - Canvas 2D 아이콘 렌더링 유틸리티
 *
 * v37 인게임 오버홀: lucide-react 아이콘을 Canvas 2D에 렌더링
 *
 * lucide-react의 SVG path 데이터를 추출하여 OffscreenCanvas에 캐시하고,
 * 게임 루프에서 drawImage()로 빠르게 그린다.
 *
 * 사용법:
 *   import { drawWeaponIcon, preloadWeaponIcons } from './canvas-icon-renderer';
 *   // 초기화 (선택)
 *   preloadWeaponIcons(['whip', 'knife', 'wand']);
 *   // 렌더링
 *   drawWeaponIcon(ctx, 'whip', x, y, { size: 24, level: 5 });
 */

import type { WeaponType, SkillCategory } from '../types';
import { getWeaponIconName } from '../config/skills/weapon-icons.config';
import { CATEGORY_DISPLAY_COLORS } from '../config/skills/category-display.config';
import { getSkillCategory } from './skill-icons';

// ============================================
// lucide SVG path data (빌드 타임에 추출 불가하므로 런타임 변환)
// ============================================

/**
 * lucide-react 아이콘에서 SVG 엘리먼트를 생성한다.
 * React 컴포넌트를 DOM SVG로 변환 — 브라우저 환경에서만 동작.
 */
function createSVGFromLucideName(iconName: string, size: number, color: string): SVGSVGElement | null {
  if (typeof document === 'undefined') return null;

  // lucide-react의 아이콘은 createElementNS로 직접 만든다
  // 모든 lucide 아이콘은 viewBox="0 0 24 24" 기준
  try {
    // lucide icons를 동적으로 임포트하는 대신,
    // 아이콘 path 데이터를 정적으로 참조하기 위해
    // react-dom/server 없이 SVG를 직접 생성한다.
    // 실제 path data는 LUCIDE_PATH_CACHE에서 관리.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const pathData = LUCIDE_PATH_CACHE[iconName];
    if (!pathData) return null;

    for (const pd of pathData) {
      if (pd.tag === 'path') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        if (pd.d) path.setAttribute('d', pd.d);
        svg.appendChild(path);
      } else if (pd.tag === 'circle') {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        if (pd.cx) circle.setAttribute('cx', pd.cx);
        if (pd.cy) circle.setAttribute('cy', pd.cy);
        if (pd.r) circle.setAttribute('r', pd.r);
        svg.appendChild(circle);
      } else if (pd.tag === 'line') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        if (pd.x1) line.setAttribute('x1', pd.x1);
        if (pd.y1) line.setAttribute('y1', pd.y1);
        if (pd.x2) line.setAttribute('x2', pd.x2);
        if (pd.y2) line.setAttribute('y2', pd.y2);
        svg.appendChild(line);
      } else if (pd.tag === 'polyline') {
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        if (pd.points) polyline.setAttribute('points', pd.points);
        svg.appendChild(polyline);
      } else if (pd.tag === 'rect') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        if (pd.x) rect.setAttribute('x', pd.x);
        if (pd.y) rect.setAttribute('y', pd.y);
        if (pd.width) rect.setAttribute('width', pd.width);
        if (pd.height) rect.setAttribute('height', pd.height);
        if (pd.rx) rect.setAttribute('rx', pd.rx);
        if (pd.ry) rect.setAttribute('ry', pd.ry);
        svg.appendChild(rect);
      } else if (pd.tag === 'polygon') {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        if (pd.points) polygon.setAttribute('points', pd.points);
        svg.appendChild(polygon);
      } else if (pd.tag === 'ellipse') {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        if (pd.cx) ellipse.setAttribute('cx', pd.cx);
        if (pd.cy) ellipse.setAttribute('cy', pd.cy);
        if (pd.rx) ellipse.setAttribute('rx', pd.rx);
        if (pd.ry) ellipse.setAttribute('ry', pd.ry);
        svg.appendChild(ellipse);
      }
    }
    return svg;
  } catch {
    return null;
  }
}

// ============================================
// SVG Path 데이터 캐시 (핵심 아이콘만)
// ============================================

interface SVGElementData {
  tag: string;
  d?: string;
  cx?: string;
  cy?: string;
  r?: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
  points?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  rx?: string;
  ry?: string;
}

/**
 * lucide-react 아이콘의 SVG path 데이터 캐시
 * 가장 빈번하게 사용되는 아이콘만 포함.
 * 나머지는 fallback (첫 글자 + 원) 으로 처리.
 */
const LUCIDE_PATH_CACHE: Record<string, SVGElementData[]> = {
  // Zap (번개) — fallback 아이콘
  Zap: [
    { tag: 'path', d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' },
  ],
  // Crosshair (조준)
  Crosshair: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'line', x1: '22', y1: '12', x2: '18', y2: '12' },
    { tag: 'line', x1: '6', y1: '12', x2: '2', y2: '12' },
    { tag: 'line', x1: '12', y1: '6', x2: '12', y2: '2' },
    { tag: 'line', x1: '12', y1: '22', x2: '12', y2: '18' },
  ],
  // Shield (방패)
  Shield: [
    { tag: 'path', d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' },
  ],
  // Sword (검)
  Sword: [
    { tag: 'polyline', points: '14.5 17.5 3 6 3 3 6 3 17.5 14.5' },
    { tag: 'line', x1: '13', y1: '19', x2: '19', y2: '13' },
    { tag: 'line', x1: '16', y1: '16', x2: '20', y2: '20' },
    { tag: 'line', x1: '19', y1: '21', x2: '21', y2: '19' },
  ],
  // Target (타겟)
  Target: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'circle', cx: '12', cy: '12', r: '6' },
    { tag: 'circle', cx: '12', cy: '12', r: '2' },
  ],
  // Swords (교차 검)
  Swords: [
    { tag: 'polyline', points: '14.5 17.5 3 6 3 3 6 3 17.5 14.5' },
    { tag: 'line', x1: '13', y1: '19', x2: '19', y2: '13' },
    { tag: 'line', x1: '16', y1: '16', x2: '20', y2: '20' },
    { tag: 'line', x1: '19', y1: '21', x2: '21', y2: '19' },
    { tag: 'polyline', points: '14.5 6.5 18 3 21 3 21 6 17.5 9.5' },
    { tag: 'line', x1: '5', y1: '14', x2: '9', y2: '18' },
    { tag: 'line', x1: '7', y1: '17', x2: '4', y2: '20' },
    { tag: 'line', x1: '3', y1: '19', x2: '5', y2: '21' },
  ],
  // Waves (파도)
  Waves: [
    { tag: 'path', d: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' },
    { tag: 'path', d: 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' },
    { tag: 'path', d: 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' },
  ],
  // Radio (라디오/파동)
  Radio: [
    { tag: 'path', d: 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9' },
    { tag: 'path', d: 'M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5' },
    { tag: 'circle', cx: '12', cy: '12', r: '2' },
    { tag: 'path', d: 'M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5' },
    { tag: 'path', d: 'M19.1 4.9C23 8.8 23 15.1 19.1 19' },
  ],
  // Bomb (폭탄)
  Bomb: [
    { tag: 'circle', cx: '11', cy: '13', r: '9' },
    { tag: 'path', d: 'M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95' },
    { tag: 'path', d: 'M22 2 17.5 6.5' },
  ],
  // Eye (눈)
  Eye: [
    { tag: 'path', d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' },
    { tag: 'circle', cx: '12', cy: '12', r: '3' },
  ],
  // Brain (뇌)
  Brain: [
    { tag: 'path', d: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z' },
    { tag: 'path', d: 'M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z' },
    { tag: 'path', d: 'M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4' },
    { tag: 'path', d: 'M17.599 6.5a3 3 0 0 0 .399-1.375' },
    { tag: 'path', d: 'M6.003 5.125A3 3 0 0 0 6.401 6.5' },
    { tag: 'path', d: 'M3.477 10.896a4 4 0 0 1 .585-.396' },
    { tag: 'path', d: 'M19.938 10.5a4 4 0 0 1 .585.396' },
    { tag: 'path', d: 'M6 18a4 4 0 0 1-1.967-.516' },
    { tag: 'path', d: 'M19.967 17.484A4 4 0 0 1 18 18' },
  ],
  // Coins (코인)
  Coins: [
    { tag: 'circle', cx: '8', cy: '8', r: '6' },
    { tag: 'path', d: 'M18.09 10.37A6 6 0 1 1 10.34 18' },
    { tag: 'path', d: 'M7 6h1v4' },
    { tag: 'path', d: 'm16.71 13.88.7.71-2.82 2.82' },
  ],
};

// ============================================
// Canvas 이미지 캐시 (OffscreenCanvas / 일반 Canvas)
// ============================================

interface CacheKey {
  iconName: string;
  size: number;
  color: string;
}

function makeCacheKey(k: CacheKey): string {
  return `${k.iconName}_${k.size}_${k.color}`;
}

const imageCache = new Map<string, HTMLCanvasElement | null>();

/**
 * SVG를 Canvas에 래스터화하여 캐시한다.
 */
function rasterizeIcon(iconName: string, size: number, color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const key = makeCacheKey({ iconName, size, color });
  if (imageCache.has(key)) return imageCache.get(key) ?? null;

  const svg = createSVGFromLucideName(iconName, size, color);
  if (!svg) {
    // path 데이터가 없으면 fallback 원+글자 생성
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFallbackIcon(ctx, iconName.charAt(0).toUpperCase(), size, color);
    }
    imageCache.set(key, canvas);
    return canvas;
  }

  // SVG → data URL → Image → Canvas
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, size, size);
    }
  };
  img.src = dataUrl;

  imageCache.set(key, canvas);
  return canvas;
}

/**
 * Fallback: 원형 배경 + 첫 글자
 */
function drawFallbackIcon(
  ctx: CanvasRenderingContext2D,
  letter: string,
  size: number,
  color: string,
): void {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  // 반투명 원
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color + '33';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 글자
  ctx.fillStyle = color;
  ctx.font = `bold ${size * 0.35}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, cy);
}

// ============================================
// 공개 API
// ============================================

export interface DrawIconOptions {
  /** 아이콘 크기 (기본 24) */
  size?: number;
  /** 무기 레벨 (0=미보유, 1~10=기본, 11+=진화, 20=궁극) */
  level?: number;
  /** 쿨다운 진행률 (0~1) */
  cooldownPercent?: number;
  /** 컬러 오버라이드 */
  color?: string;
  /** 투명도 (0~1) */
  alpha?: number;
}

/**
 * Canvas 2D 컨텍스트에 무기 아이콘을 그린다.
 *
 * @param ctx - Canvas 2D 렌더링 컨텍스트
 * @param weaponType - 무기 타입
 * @param x - 중앙 X 좌표 (월드 좌표)
 * @param y - 중앙 Y 좌표 (월드 좌표)
 * @param options - 렌더링 옵션
 */
export function drawWeaponIcon(
  ctx: CanvasRenderingContext2D,
  weaponType: WeaponType,
  x: number,
  y: number,
  options: DrawIconOptions = {},
): void {
  const {
    size = 24,
    level = 1,
    cooldownPercent = 0,
    alpha = 1,
  } = options;

  // 카테고리 컬러 결정
  let color = options.color;
  if (!color) {
    const cat = getSkillCategory(weaponType);
    color = cat ? (CATEGORY_DISPLAY_COLORS[cat] ?? '#666') : '#666';
  }

  // 레벨 기반 시각 상태
  const isUnowned = level <= 0;
  const isEvolved = level >= 11 && level < 20;
  const isUltimate = level >= 20;

  if (isUnowned) {
    color = '#71717A';
  }

  const finalAlpha = isUnowned ? alpha * 0.5 : alpha;

  ctx.save();
  ctx.globalAlpha = finalAlpha;

  // 진화/궁극: glow 효과
  if ((isEvolved || isUltimate) && !isUnowned) {
    const glowColor = isUltimate ? '#F59E0B' : color;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = size * 0.3;
  }

  // 캐시된 아이콘 이미지 그리기
  const iconName = getWeaponIconName(weaponType);
  const cached = rasterizeIcon(iconName, size, color);
  if (cached) {
    ctx.drawImage(cached, x - size / 2, y - size / 2, size, size);
  } else {
    // 즉시 fallback
    drawFallbackIcon(ctx, weaponType.charAt(0).toUpperCase(), size, color);
  }

  ctx.shadowBlur = 0;

  // 쿨다운 오버레이
  if (cooldownPercent > 0 && cooldownPercent < 1) {
    const angleDeg = cooldownPercent * 360;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (angleDeg * Math.PI) / 180;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, size / 2, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fill();
  }

  // 궁극 크라운
  if (isUltimate) {
    const crownSize = size * 0.35;
    const crownX = x + size * 0.25;
    const crownY = y - size * 0.35;

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(crownX - crownSize / 2, crownY + crownSize * 0.6);
    ctx.lineTo(crownX - crownSize * 0.35, crownY);
    ctx.lineTo(crownX - crownSize * 0.1, crownY + crownSize * 0.3);
    ctx.lineTo(crownX, crownY - crownSize * 0.1);
    ctx.lineTo(crownX + crownSize * 0.1, crownY + crownSize * 0.3);
    ctx.lineTo(crownX + crownSize * 0.35, crownY);
    ctx.lineTo(crownX + crownSize / 2, crownY + crownSize * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 지정된 무기 아이콘들을 미리 래스터화하여 캐시에 넣는다.
 * 게임 시작 시 호출하면 첫 프레임 지연을 방지할 수 있다.
 */
export function preloadWeaponIcons(
  weaponTypes: WeaponType[],
  size = 24,
): void {
  for (const wt of weaponTypes) {
    const cat = getSkillCategory(wt);
    const color = cat ? (CATEGORY_DISPLAY_COLORS[cat] ?? '#666') : '#666';
    const iconName = getWeaponIconName(wt);
    rasterizeIcon(iconName, size, color);
  }
}

/**
 * 아이콘 캐시를 클리어한다.
 */
export function clearIconCache(): void {
  imageCache.clear();
}
