/**
 * game/rendering/enemies/pixelMonster.ts - 픽셀 아트 몬스터 렌더링 시스템
 * v6.0: 사이버펑크 스타일 픽셀 아트
 *
 * 디자인 원칙:
 * 1. 매트(무광) 컬러 - 글로우/그라데이션 최소화
 * 2. 1픽셀 단위 렌더링 - fillRect(x, y, pixelSize, pixelSize)
 * 3. 제한된 색상 팔레트 - 사이버펑크 테마
 * 4. 디더링으로 중간톤 표현
 */

import type { EnemyRenderData } from './types';
import { getFrameTime, deterministicRandom, getSeedBase } from './renderContext';

// =====================================================
// 사이버펑크 색상 팔레트 (매트/플랫)
// =====================================================
export const CYBER_PALETTE = {
  // 매트릭스 그린 계열
  matrixGreen: '#00FF41',
  matrixDark: '#003311',
  matrixMid: '#00AA2A',
  matrixLight: '#44FF77',
  matrix: '#00FF41',      // alias for matrixGreen
  matrixDim: '#006622',   // dimmed matrix green

  // 바이러스 레드 계열
  virusRed: '#FF2244',
  virusDark: '#660011',
  virusMid: '#CC1133',
  virusLight: '#FF6677',
  red: '#FF2244',         // alias for virusRed
  danger: '#FF2244',      // semantic alias

  // 데이터 시안 계열
  dataCyan: '#00FFFF',
  dataDark: '#004455',
  dataMid: '#00AAAA',
  dataLight: '#66FFFF',
  cyan: '#00FFFF',        // alias for dataCyan
  cyberCyan: '#00FFFF',   // alias

  // 경고 오렌지 계열
  alertOrange: '#FF8800',
  alertDark: '#663300',
  alertMid: '#CC6600',
  alertLight: '#FFAA44',
  warning: '#FF8800',     // semantic alias
  gold: '#FFD700',        // gold color

  // 코드 퍼플 계열
  codePurple: '#AA44FF',
  codeDark: '#330066',
  codeMid: '#7722CC',
  codeLight: '#CC88FF',
  purple: '#AA44FF',      // alias for codePurple
  cyberPurple: '#AA44FF', // alias
  darkPurple: '#330066',  // alias for codeDark
  magenta: '#FF00FF',     // bright magenta

  // 시스템 그레이 계열
  metalDark: '#1A1A2E',
  metalMid: '#374151',
  metalLight: '#6B7280',
  metalHighlight: '#9CA3AF',
  metal: '#374151',       // alias for metalMid
  steel: '#6B7280',       // alias for metalLight
  darkGray: '#1A1A2E',    // alias for metalDark
  lightGray: '#9CA3AF',   // alias for metalHighlight
  darkBg: '#0D0D0D',      // dark background

  // 바이너리
  black: '#0D0D0D',
  white: '#F0F0F0',
  pureBlack: '#000000',   // v8.0: 검은 아웃라인용

  // 글리치
  glitchPink: '#FF00FF',
  glitchYellow: '#FFFF00',
  cyberPink: '#FF00FF',   // alias for glitchPink
  yellow: '#FFFF00',      // alias for glitchYellow

  // Semantic colors
  primary: '#3B82F6',     // blue primary
  success: '#22C55E',     // green success
  deepBlue: '#1E3A5F',    // deep blue
  blue: '#3B82F6',        // alias for primary
  cream: '#FDF5E6',       // cream/beige

  // v8.0: 고채도 강조 색상 (리디자인용)
  brightRed: '#FF0044',     // 선명한 빨강
  brightCyan: '#00FFFF',    // 선명한 시안
  brightOrange: '#FF8800',  // 선명한 오렌지
  electricBlue: '#0088FF',  // 전기 파랑
  neonPink: '#FF0080',      // 네온 핑크
  acidGreen: '#88FF00',     // 산성 초록
  brightYellow: '#FFDD00',  // 선명한 노랑
} as const;

type CyberColor = keyof typeof CYBER_PALETTE;

// =====================================================
// 픽셀 렌더링 유틸리티
// =====================================================

/**
 * 단일 픽셀 그리기
 */
export function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
}

/**
 * 픽셀 라인 그리기 (수평)
 */
export function drawPixelLineH(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < length; i++) {
    ctx.fillRect(Math.floor(x + i * size), Math.floor(y), size, size);
  }
}

/**
 * 픽셀 라인 그리기 (수직)
 */
export function drawPixelLineV(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < length; i++) {
    ctx.fillRect(Math.floor(x), Math.floor(y + i * size), size, size);
  }
}

/**
 * 픽셀 사각형 그리기 (채움)
 */
export function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      ctx.fillRect(
        Math.floor(x + col * size),
        Math.floor(y + row * size),
        size,
        size
      );
    }
  }
}

/**
 * 픽셀 사각형 그리기 (테두리만)
 * v6.3: 검은색 외곽 테두리 2셀 두께 (더 두꺼운 가시성)
 */
export function drawPixelRectOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: string
): void {
  // v6.3: 검은색 외곽 테두리 2셀 두께
  ctx.fillStyle = '#000000';

  // 외곽 테두리 2겹 (2셀 바깥 + 1셀 바깥)
  for (let layer = 2; layer >= 1; layer--) {
    const bx = x - size * layer;
    const by = y - size * layer;
    const bw = width + layer * 2;
    const bh = height + layer * 2;

    // 상단
    for (let i = 0; i < bw; i++) {
      ctx.fillRect(Math.floor(bx + i * size), Math.floor(by), size, size);
    }
    // 하단
    for (let i = 0; i < bw; i++) {
      ctx.fillRect(Math.floor(bx + i * size), Math.floor(by + (bh - 1) * size), size, size);
    }
    // 좌측
    for (let i = 1; i < bh - 1; i++) {
      ctx.fillRect(Math.floor(bx), Math.floor(by + i * size), size, size);
    }
    // 우측
    for (let i = 1; i < bh - 1; i++) {
      ctx.fillRect(Math.floor(bx + (bw - 1) * size), Math.floor(by + i * size), size, size);
    }
  }

  // 기존 색상 테두리
  ctx.fillStyle = color;
  // 상단
  for (let i = 0; i < width; i++) {
    ctx.fillRect(Math.floor(x + i * size), Math.floor(y), size, size);
  }
  // 하단
  for (let i = 0; i < width; i++) {
    ctx.fillRect(Math.floor(x + i * size), Math.floor(y + (height - 1) * size), size, size);
  }
  // 좌측
  for (let i = 1; i < height - 1; i++) {
    ctx.fillRect(Math.floor(x), Math.floor(y + i * size), size, size);
  }
  // 우측
  for (let i = 1; i < height - 1; i++) {
    ctx.fillRect(Math.floor(x + (width - 1) * size), Math.floor(y + i * size), size, size);
  }
}

/**
 * 픽셀 원 그리기 (채움) - Bresenham 알고리즘 기반
 */
export function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  const r = Math.floor(radius);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        ctx.fillRect(
          Math.floor(cx + x * size),
          Math.floor(cy + y * size),
          size,
          size
        );
      }
    }
  }
}

/**
 * 픽셀 원 그리기 (테두리만)
 */
export function drawPixelCircleOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  const r = Math.floor(radius);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const distSq = x * x + y * y;
      const rSq = r * r;
      const innerRSq = (r - 1) * (r - 1);
      if (distSq <= rSq && distSq > innerRSq) {
        ctx.fillRect(
          Math.floor(cx + x * size),
          Math.floor(cy + y * size),
          size,
          size
        );
      }
    }
  }
}

/**
 * 디더링 패턴 (체크보드) - 중간톤 표현용
 */
export function drawDitheredRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color1: string,
  color2: string
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? color1 : color2;
      ctx.fillRect(
        Math.floor(x + col * size),
        Math.floor(y + row * size),
        size,
        size
      );
    }
  }
}

/**
 * 글리치 노이즈 효과
 */
export function drawGlitchNoise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  seed: number,
  intensity: number = 0.3
): void {
  const colors = [
    CYBER_PALETTE.glitchPink,
    CYBER_PALETTE.glitchYellow,
    CYBER_PALETTE.matrixGreen,
    CYBER_PALETTE.dataCyan,
  ];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const rand = deterministicRandom(seed + row * width + col);
      if (rand < intensity) {
        const colorIdx = Math.floor(deterministicRandom(seed + row + col * 100) * colors.length);
        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(
          Math.floor(x + col * size),
          Math.floor(y + row * size),
          size,
          size
        );
      }
    }
  }
}

/**
 * 스캔라인 효과
 */
export function drawScanlines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: string = 'rgba(0, 0, 0, 0.3)'
): void {
  ctx.fillStyle = color;
  for (let row = 0; row < height; row += 2) {
    ctx.fillRect(
      Math.floor(x),
      Math.floor(y + row * size),
      width * size,
      size
    );
  }
}

/**
 * 데이터 스트림 효과 (세로 라인들)
 */
export function drawDataStream(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  time: number,
  color: string
): void {
  const streamCount = Math.floor(width / 2);
  ctx.fillStyle = color;

  for (let i = 0; i < streamCount; i++) {
    const streamX = x + i * 2 * size;
    const offset = ((time / 50) + i * 7) % height;
    const streamLength = 3 + (i % 3);

    for (let j = 0; j < streamLength; j++) {
      const py = (offset + j) % height;
      ctx.fillRect(
        Math.floor(streamX),
        Math.floor(y + py * size),
        size,
        size
      );
    }
  }
}

/**
 * 바이너리 텍스트 (0/1)
 */
export function drawBinaryText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number,
  color: string
): void {
  ctx.fillStyle = color;
  // 3x5 픽셀 숫자 패턴
  const zero = [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ];
  const one = [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ];

  const pattern = deterministicRandom(seed) > 0.5 ? one : zero;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (pattern[row][col]) {
        ctx.fillRect(
          Math.floor(x + col * size),
          Math.floor(y + row * size),
          size,
          size
        );
      }
    }
  }
}

// =====================================================
// 공통 몬스터 파츠
// =====================================================

/**
 * 픽셀 눈 그리기
 */
export function drawPixelEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  eyeColor: string,
  pupilColor: string = CYBER_PALETTE.black,
  spacing: number = 6
): void {
  // 왼쪽 눈
  drawPixelRect(ctx, x - spacing * size / 2, y, 2, 2, size, eyeColor);
  drawPixel(ctx, x - spacing * size / 2, y, size, pupilColor);

  // 오른쪽 눈
  drawPixelRect(ctx, x + spacing * size / 2 - size, y, 2, 2, size, eyeColor);
  drawPixel(ctx, x + spacing * size / 2, y, size, pupilColor);
}

/**
 * LED 표시등
 *
 * Two patterns supported:
 * 1. Original: drawPixelLED(ctx, x, y, size, isOn: boolean, onColor, offColor)
 * 2. Animated: drawPixelLED(ctx, x, y, size, color: string, time: number)
 *    - Blinks based on time (on/off every ~300ms)
 */
export function drawPixelLED(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isOnOrColor: boolean | string,
  onColorOrTime: string | number,
  offColor?: string
): void {
  // Pattern detection: if 5th param is string and 6th is number, it's animated pattern
  if (typeof isOnOrColor === 'string' && typeof onColorOrTime === 'number') {
    // Animated pattern: (ctx, x, y, size, color, time)
    const color = isOnOrColor;
    const time = onColorOrTime;
    const isOn = Math.floor(time / 300) % 2 === 0;
    const dimColor = '#333333';
    drawPixel(ctx, x, y, size, isOn ? color : dimColor);
  } else {
    // Original pattern: (ctx, x, y, size, isOn, onColor, offColor)
    const isOn = isOnOrColor as boolean;
    const onColor = onColorOrTime as string;
    const off = offColor || '#333333';
    drawPixel(ctx, x, y, size, isOn ? onColor : off);
  }
}

/**
 * 픽셀 그림자
 */
export function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  size: number
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let i = 0; i < width; i++) {
    // 타원형 그림자
    const distFromCenter = Math.abs(i - width / 2);
    const heightAtPoint = Math.max(1, 2 - Math.floor(distFromCenter / 3));
    for (let j = 0; j < heightAtPoint; j++) {
      ctx.fillRect(
        Math.floor(x + i * size),
        Math.floor(y + j * size),
        size,
        size
      );
    }
  }
}

// =====================================================
// v8.0: 검은 아웃라인 유틸리티 (몬스터 리디자인)
// =====================================================

/**
 * 검은 외곽선이 포함된 픽셀 사각형
 * 모든 몬스터에 2px 검은 아웃라인 보장
 */
export function drawPixelRectWithBlackOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  fillColor: string,
  outlineWidth: number = 1
): void {
  // 1. 검은 아웃라인 (바깥쪽)
  ctx.fillStyle = CYBER_PALETTE.pureBlack;
  const ox = x - outlineWidth * size;
  const oy = y - outlineWidth * size;
  const ow = width + outlineWidth * 2;
  const oh = height + outlineWidth * 2;
  for (let row = 0; row < oh; row++) {
    for (let col = 0; col < ow; col++) {
      ctx.fillRect(
        Math.floor(ox + col * size),
        Math.floor(oy + row * size),
        size,
        size
      );
    }
  }

  // 2. 내부 채움
  ctx.fillStyle = fillColor;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      ctx.fillRect(
        Math.floor(x + col * size),
        Math.floor(y + row * size),
        size,
        size
      );
    }
  }
}

/**
 * 검은 외곽선이 포함된 픽셀 원
 */
export function drawPixelCircleWithBlackOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  size: number,
  fillColor: string,
  outlineWidth: number = 1
): void {
  const r = Math.floor(radius);
  const outerR = r + outlineWidth;

  // 1. 검은 아웃라인 (바깥쪽)
  ctx.fillStyle = CYBER_PALETTE.pureBlack;
  for (let y = -outerR; y <= outerR; y++) {
    for (let x = -outerR; x <= outerR; x++) {
      if (x * x + y * y <= outerR * outerR) {
        ctx.fillRect(
          Math.floor(cx + x * size),
          Math.floor(cy + y * size),
          size,
          size
        );
      }
    }
  }

  // 2. 내부 채움
  ctx.fillStyle = fillColor;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        ctx.fillRect(
          Math.floor(cx + x * size),
          Math.floor(cy + y * size),
          size,
          size
        );
      }
    }
  }
}

/**
 * 몬스터 전체에 검은 외곽선 추가 (후처리용)
 * 기존 그려진 픽셀 주변에 검은색 아웃라인 추가
 */
export function drawBlackOutlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  thickness: number = 1
): void {
  ctx.fillStyle = CYBER_PALETTE.pureBlack;

  for (let t = thickness; t >= 1; t--) {
    const bx = x - t * size;
    const by = y - t * size;
    const bw = width + t * 2;
    const bh = height + t * 2;

    // 상단
    for (let i = 0; i < bw; i++) {
      ctx.fillRect(Math.floor(bx + i * size), Math.floor(by), size, size);
    }
    // 하단
    for (let i = 0; i < bw; i++) {
      ctx.fillRect(Math.floor(bx + i * size), Math.floor(by + (bh - 1) * size), size, size);
    }
    // 좌측
    for (let i = 1; i < bh - 1; i++) {
      ctx.fillRect(Math.floor(bx), Math.floor(by + i * size), size, size);
    }
    // 우측
    for (let i = 1; i < bh - 1; i++) {
      ctx.fillRect(Math.floor(bx + (bw - 1) * size), Math.floor(by + i * size), size, size);
    }
  }
}

// =====================================================
// 몬스터별 픽셀 아트 정의
// =====================================================

/**
 * GLITCH - 손상된 데이터 블록
 * v8.0 리디자인: 선명한 RGB 글리치 + 검은 아웃라인
 * 16x18 픽셀, 명확한 데이터 블록 실루엣
 */
export function drawPixelGlitch(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 16, 10, P);

  // 글리치 흔들림 (더 극적)
  const glitchX = Math.floor(deterministicRandom(seed + Math.floor(t / 40)) * 4) - 2;
  const glitchY = Math.floor(deterministicRandom(seed + Math.floor(t / 60)) * 3) - 1;
  ctx.translate(glitchX * P, glitchY * P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -8 * P, -9 * P, 8, 9, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 먼저 ===
    drawBlackOutlineRect(ctx, -8 * P, -9 * P, 8, 9, P, 1);

    // 메인 바디 (데이터 블록) - 더 밝은 녹색
    drawPixelRect(ctx, -8 * P, -9 * P, 8, 9, P, CYBER_PALETTE.matrixDark);

    // 코어 데이터 영역 (밝게)
    drawPixelRect(ctx, -6 * P, -7 * P, 4, 5, P, CYBER_PALETTE.matrixMid);

    // RGB 분리 효과 (글리치 특징)
    const rgbOffset = Math.floor(t / 80) % 3;
    if (rgbOffset === 0) {
      // 빨강 채널 오프셋
      drawPixelRect(ctx, -7 * P, -6 * P, 2, 3, P, CYBER_PALETTE.brightRed);
    } else if (rgbOffset === 1) {
      // 시안 채널 오프셋
      drawPixelRect(ctx, -3 * P, -5 * P, 2, 3, P, CYBER_PALETTE.brightCyan);
    }

    // 스캔라인 (가로 줄무늬) - 더 선명
    for (let i = 0; i < 9; i += 2) {
      drawPixelLineH(ctx, -8 * P, (-9 + i) * P, 8, P, 'rgba(0, 255, 65, 0.4)');
    }

    // 눈 (빨간 에러 눈) - 더 밝고 크게
    const blink = Math.floor(t / 200) % 10 !== 0;
    if (blink) {
      drawPixelRect(ctx, -6 * P, -4 * P, 2, 2, P, CYBER_PALETTE.brightRed);
      drawPixelRect(ctx, -2 * P, -4 * P, 2, 2, P, CYBER_PALETTE.brightRed);
      // 눈 하이라이트
      drawPixel(ctx, -5 * P, -4 * P, P, CYBER_PALETTE.virusLight);
      drawPixel(ctx, -1 * P, -4 * P, P, CYBER_PALETTE.virusLight);
    }

    // 글리치 노이즈 파티클
    if (deterministicRandom(seed + t) > 0.7) {
      const nx = Math.floor(deterministicRandom(seed + t + 1) * 6) - 3;
      const ny = Math.floor(deterministicRandom(seed + t + 2) * 7) - 4;
      drawPixel(ctx, nx * P, ny * P, P, CYBER_PALETTE.matrixGreen);
    }

    // 데이터 스트림 (세로 라인)
    const streamX = Math.floor((t / 100) % 8) - 4;
    drawPixelLineV(ctx, streamX * P, -9 * P, 9, P, CYBER_PALETTE.matrixLight);
  }

  ctx.restore();
}

/**
 * BOT - AI 챗봇
 * v8.0 리디자인: 귀여운 로봇 + 명확한 LED 눈 + 검은 아웃라인
 * 16x18 픽셀, 둥근 머리 + 모니터 몸통
 */
export function drawPixelBot(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 18, 10, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -7 * P, -8 * P, 7, 10, P, CYBER_PALETTE.white);
    drawPixelCircleWithBlackOutline(ctx, -3 * P, -12 * P, 3, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 ===
    // 머리 아웃라인
    drawPixelCircleWithBlackOutline(ctx, -3 * P, -12 * P, 4, P, CYBER_PALETTE.brightCyan);
    // 몸통 아웃라인
    drawBlackOutlineRect(ctx, -7 * P, -7 * P, 7, 9, P, 1);

    // 머리 (둥근 시안색)
    drawPixelCircle(ctx, -3 * P, -12 * P, 3, P, CYBER_PALETTE.dataMid);

    // 머리 하이라이트
    drawPixel(ctx, -5 * P, -14 * P, P, CYBER_PALETTE.dataLight);

    // LED 눈 (밝은 시안) - 2x2 크기
    const eyeBlink = Math.floor(t / 2000) % 20 === 0;
    if (!eyeBlink) {
      drawPixelRect(ctx, -5 * P, -12 * P, 2, 2, P, CYBER_PALETTE.brightCyan);
      drawPixelRect(ctx, -2 * P, -12 * P, 2, 2, P, CYBER_PALETTE.brightCyan);
      // 눈 하이라이트
      drawPixel(ctx, -5 * P, -12 * P, P, CYBER_PALETTE.white);
      drawPixel(ctx, -2 * P, -12 * P, P, CYBER_PALETTE.white);
    }

    // 안테나
    drawPixelLineV(ctx, -3 * P, -17 * P, 3, P, CYBER_PALETTE.metalMid);
    const antennaOn = Math.floor(t / 400) % 2 === 0;
    drawPixelRect(ctx, -4 * P, -18 * P, 2, 2, P, antennaOn ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.dataDark);

    // 몸통 (모니터 케이스)
    drawPixelRect(ctx, -7 * P, -7 * P, 7, 9, P, CYBER_PALETTE.metalDark);

    // 화면 영역
    drawPixelRect(ctx, -6 * P, -6 * P, 5, 6, P, CYBER_PALETTE.dataDark);

    // 화면 내용 (채팅 메시지)
    const msgFrame = Math.floor(t / 200) % 4;
    for (let i = 0; i <= msgFrame; i++) {
      const msgLen = 3 - (i % 2);
      drawPixelLineH(ctx, -5 * P, (-5 + i) * P, msgLen, P, CYBER_PALETTE.brightCyan);
    }

    // 커서 깜빡임
    if (Math.floor(t / 300) % 2 === 0) {
      drawPixel(ctx, (-5 + msgFrame) * P, (-5 + msgFrame) * P, P, CYBER_PALETTE.white);
    }

    // 다리 (검은 아웃라인 포함)
    drawPixelRectWithBlackOutline(ctx, -6 * P, 2 * P, 2, 4, P, CYBER_PALETTE.metalMid);
    drawPixelRectWithBlackOutline(ctx, -3 * P, 2 * P, 2, 4, P, CYBER_PALETTE.metalMid);

    // 발
    drawPixelRect(ctx, -7 * P, 6 * P, 3, 1, P, CYBER_PALETTE.metalDark);
    drawPixelRect(ctx, -4 * P, 6 * P, 3, 1, P, CYBER_PALETTE.metalDark);

    // 말풍선 아이콘 (... 표시)
    if (Math.floor(t / 1000) % 3 === 0) {
      drawPixelRect(ctx, 2 * P, -15 * P, 4, 2, P, CYBER_PALETTE.white);
      drawPixel(ctx, 3 * P, -14 * P, P, CYBER_PALETTE.dataMid);
      drawPixel(ctx, 4 * P, -14 * P, P, CYBER_PALETTE.dataMid);
      drawPixel(ctx, 5 * P, -14 * P, P, CYBER_PALETTE.dataMid);
    }
  }

  ctx.restore();
}

/**
 * MALWARE - 바이러스 프로그램
 * v8.0 리디자인: 선명한 해골 + 경고 심볼 + 검은 아웃라인
 * 16x16 픽셀, 위협적인 바이러스 실루엣
 */
export function drawPixelMalware(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 14, 10, P);

  // 위협적인 펄스
  const pulse = Math.sin(t / 150) * 0.5;

  if (isHit) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 ===
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, CYBER_PALETTE.brightRed);

    // 메인 바디 (바이러스 코어)
    drawPixelCircle(ctx, 0, 0, 5, P, CYBER_PALETTE.virusMid);
    drawPixelCircle(ctx, 0, 0, 4, P, CYBER_PALETTE.virusDark);

    // 경고 삼각형 (더 크고 선명)
    ctx.fillStyle = CYBER_PALETTE.brightOrange;
    // 삼각형 상단
    drawPixel(ctx, 0, -5 * P, P, CYBER_PALETTE.brightOrange);
    drawPixelLineH(ctx, -1 * P, -4 * P, 3, P, CYBER_PALETTE.brightOrange);
    drawPixelLineH(ctx, -2 * P, -3 * P, 5, P, CYBER_PALETTE.brightOrange);
    // 느낌표
    drawPixelLineV(ctx, 0, -4 * P, 2, P, CYBER_PALETTE.pureBlack);
    drawPixel(ctx, 0, -1 * P, P, CYBER_PALETTE.pureBlack);

    // 해골 눈 (빨간 LED) - 2x2 크기
    const eyeGlow = Math.floor(t / 120) % 3 !== 0;
    const eyeColor = eyeGlow ? CYBER_PALETTE.brightRed : CYBER_PALETTE.virusDark;
    drawPixelRect(ctx, -3 * P, 0, 2, 2, P, eyeColor);
    drawPixelRect(ctx, 1 * P, 0, 2, 2, P, eyeColor);
    // 눈 하이라이트
    if (eyeGlow) {
      drawPixel(ctx, -3 * P, 0, P, CYBER_PALETTE.virusLight);
      drawPixel(ctx, 1 * P, 0, P, CYBER_PALETTE.virusLight);
    }

    // 이빨 (톱니 모양)
    drawPixel(ctx, -2 * P, 3 * P, P, CYBER_PALETTE.white);
    drawPixel(ctx, 0, 3 * P, P, CYBER_PALETTE.white);
    drawPixel(ctx, 2 * P, 3 * P, P, CYBER_PALETTE.white);
    drawPixel(ctx, -1 * P, 4 * P, P, CYBER_PALETTE.metalLight);
    drawPixel(ctx, 1 * P, 4 * P, P, CYBER_PALETTE.metalLight);

    // 감염 촉수 (더 극적)
    const wave = Math.sin(t / 80);
    const wave2 = Math.cos(t / 100);
    // 왼쪽 촉수
    drawPixelLineH(ctx, -8 * P + wave * P, -1 * P, 2, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, -9 * P + wave * P, 0, P, CYBER_PALETTE.virusRed);
    // 오른쪽 촉수
    drawPixelLineH(ctx, 6 * P - wave * P, -1 * P, 2, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, 8 * P - wave * P, 0, P, CYBER_PALETTE.virusRed);
    // 아래 촉수
    drawPixelLineV(ctx, -1 * P, 6 * P + wave2 * P, 2, P, CYBER_PALETTE.brightRed);
    drawPixelLineV(ctx, 1 * P, 6 * P - wave2 * P, 2, P, CYBER_PALETTE.brightRed);

    // 감염 파티클 (깜빡임)
    if (Math.floor(t / 150) % 2 === 0) {
      const px = Math.floor(deterministicRandom(seed + t) * 8) - 4;
      const py = Math.floor(deterministicRandom(seed + t + 1) * 8) - 4;
      drawPixel(ctx, px * P, py * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

/**
 * WHALE - 슈퍼컴퓨터 (서버 랙)
 * v8.0 리디자인: 거대 서버 랙 + LED 어레이 + 검은 아웃라인
 * 20x24 픽셀, 위압적인 데이터센터 실루엣
 */
export function drawPixelWhale(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;

  ctx.save();

  // 그림자 (더 크게)
  drawPixelShadow(ctx, -16, 20, 16, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -10 * P, -12 * P, 10, 14, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 ===
    drawBlackOutlineRect(ctx, -10 * P, -12 * P, 10, 14, P, 1);

    // 메인 서버 케이스 (회색 금속)
    drawPixelRect(ctx, -10 * P, -12 * P, 10, 14, P, CYBER_PALETTE.metalDark);

    // 프레임 테두리
    drawPixelRectOutline(ctx, -10 * P, -12 * P, 10, 14, P, CYBER_PALETTE.metalMid);

    // 서버 슬롯 (5개 - 더 많이)
    for (let i = 0; i < 5; i++) {
      const slotY = -10 * P + i * 4 * P;

      // 슬롯 배경
      drawPixelRect(ctx, -8 * P, slotY, 8, 2, P, CYBER_PALETTE.pureBlack);

      // LED 어레이 (3개씩)
      const ledPhase = Math.floor(t / (80 + i * 25)) % 4;
      // 전원 LED (녹색)
      drawPixelLED(ctx, -7 * P, slotY, P, ledPhase !== 0, CYBER_PALETTE.matrixGreen, CYBER_PALETTE.matrixDark);
      // 활동 LED (시안)
      drawPixelLED(ctx, -5 * P, slotY, P, Math.floor(t / 40) % 2 === 0, CYBER_PALETTE.brightCyan, CYBER_PALETTE.dataDark);
      // 상태 LED (주황/빨강)
      const statusColor = i === 2 ? CYBER_PALETTE.brightOrange : CYBER_PALETTE.matrixGreen;
      drawPixelLED(ctx, -3 * P, slotY, P, Math.floor(t / 100) % 3 === 0, statusColor, CYBER_PALETTE.metalDark);
    }

    // 쿨링 팬 (오른쪽)
    const fanFrame = Math.floor(t / 30) % 4;
    const fanX = 4 * P;
    const fanY = -4 * P;
    // 팬 케이스
    drawPixelCircleWithBlackOutline(ctx, fanX, fanY, 3, P, CYBER_PALETTE.metalMid);
    drawPixelCircle(ctx, fanX, fanY, 2, P, CYBER_PALETTE.pureBlack);
    // 팬 블레이드 (회전)
    const bladePositions = [
      [0, -2], [2, 0], [0, 2], [-2, 0]
    ];
    for (let i = 0; i < 4; i++) {
      const blade = bladePositions[(i + fanFrame) % 4];
      drawPixel(ctx, fanX + blade[0] * P, fanY + blade[1] * P, P, CYBER_PALETTE.metalLight);
    }

    // 두 번째 팬
    const fan2Y = 4 * P;
    drawPixelCircle(ctx, fanX, fan2Y, 2, P, CYBER_PALETTE.pureBlack);
    for (let i = 0; i < 4; i++) {
      const blade = bladePositions[(i + fanFrame + 2) % 4];
      drawPixel(ctx, fanX + blade[0] * P, fan2Y + blade[1] * P, P, CYBER_PALETTE.metalLight);
    }

    // 케이블 (하단)
    drawPixelRectWithBlackOutline(ctx, -7 * P, 8 * P, 2, 4, P, CYBER_PALETTE.electricBlue);
    drawPixelRectWithBlackOutline(ctx, -4 * P, 8 * P, 2, 4, P, CYBER_PALETTE.brightCyan);
    drawPixelRectWithBlackOutline(ctx, -1 * P, 8 * P, 2, 4, P, CYBER_PALETTE.matrixGreen);

    // 전원 버튼 (우상단)
    const powerOn = Math.floor(t / 1000) % 10 !== 0;
    drawPixelRect(ctx, 6 * P, -10 * P, 2, 2, P, powerOn ? CYBER_PALETTE.matrixGreen : CYBER_PALETTE.matrixDark);

    // 데이터 흐름 애니메이션 (세로)
    const streamPos = Math.floor((t / 60) % 12);
    for (let i = 0; i < 3; i++) {
      const sy = -10 + ((streamPos + i * 4) % 12);
      if (sy >= -10 && sy < 2) {
        drawPixel(ctx, -9 * P, sy * P, P, CYBER_PALETTE.brightCyan);
        drawPixel(ctx, 1 * P, (sy + 2) * P, P, CYBER_PALETTE.matrixGreen);
      }
    }

    // 상단 통풍구
    for (let i = 0; i < 4; i++) {
      drawPixelLineH(ctx, -8 * P + i * 4 * P, -13 * P, 2, P, CYBER_PALETTE.pureBlack);
    }
  }

  ctx.restore();
}

/**
 * SNIPER - 타겟팅 드론
 * v8.0 리디자인: 삼각형 드론 + 레이저 조준선 + 검은 아웃라인
 * 16x16 픽셀, 날카로운 드론 실루엣
 */
export function drawPixelSniper(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const charge = enemy.attackCooldown !== undefined ? Math.max(0, 1.0 - enemy.attackCooldown) : 0;
  const isCharging = enemy.attackCooldown !== undefined && enemy.attackCooldown < 1.0;

  ctx.save();

  // 호버 효과 (부드러운 부유)
  const hover = Math.sin(t / 250) * 2;
  ctx.translate(0, hover);

  // 그림자
  drawPixelShadow(ctx, -10, 14 - hover / 2, 10, P);

  if (isHit) {
    // 피격 시 전체 흰색
    drawPixelRectWithBlackOutline(ctx, -8 * P, -6 * P, 8, 8, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 + 메인 바디 ===
    // 삼각형 드론 몸체 (전방 뾰족)
    drawBlackOutlineRect(ctx, -8 * P, -6 * P, 8, 8, P, 1);
    drawPixelRect(ctx, -8 * P, -6 * P, 8, 8, P, CYBER_PALETTE.brightOrange);

    // 내부 장갑 (더 어두운 주황)
    drawPixelRect(ctx, -6 * P, -4 * P, 4, 4, P, CYBER_PALETTE.alertMid);

    // 전면 센서 (삼각형 팁)
    drawPixel(ctx, -9 * P, -2 * P, P, CYBER_PALETTE.pureBlack);
    drawPixel(ctx, -9 * P, -1 * P, P, CYBER_PALETTE.pureBlack);
    drawPixel(ctx, -10 * P, -2 * P, P, CYBER_PALETTE.brightOrange);

    // 조준 눈 (스코프) - 큰 원형
    drawPixelCircleWithBlackOutline(ctx, -4 * P, -2 * P, 3, P, CYBER_PALETTE.pureBlack);
    // 스코프 내부 (빨간 LED)
    const scopeGlow = Math.floor(t / 100) % 2 === 0;
    drawPixelCircle(ctx, -4 * P, -2 * P, 2, P, scopeGlow ? CYBER_PALETTE.brightRed : CYBER_PALETTE.virusDark);
    // 십자선
    drawPixelLineH(ctx, -6 * P, -2 * P, 4, P, CYBER_PALETTE.brightRed);
    drawPixelLineV(ctx, -4 * P, -4 * P, 4, P, CYBER_PALETTE.brightRed);

    // 날개 (상하)
    drawPixelRectWithBlackOutline(ctx, -2 * P, -8 * P, 4, 2, P, CYBER_PALETTE.alertDark);
    drawPixelRectWithBlackOutline(ctx, -2 * P, 2 * P, 4, 2, P, CYBER_PALETTE.alertDark);

    // 후방 추진기
    drawPixelRect(ctx, 2 * P, -4 * P, 3, 4, P, CYBER_PALETTE.metalDark);
    // 추진기 불꽃
    const flamePhase = Math.floor(t / 50) % 3;
    const flameColors = [CYBER_PALETTE.brightOrange, CYBER_PALETTE.alertLight, CYBER_PALETTE.brightRed];
    drawPixelRect(ctx, 5 * P, -3 * P + flamePhase, 2, 2, P, flameColors[flamePhase]);

    // 레이저 조준선 (차지 시 더 밝게)
    if (isCharging) {
      // 레이저 빔 라인
      const beamLength = 8 + Math.floor(charge * 8);
      ctx.fillStyle = CYBER_PALETTE.brightRed;
      for (let i = 0; i < beamLength; i++) {
        if (i % 2 === 0) {
          drawPixel(ctx, (-10 - i) * P, -2 * P, P, CYBER_PALETTE.brightRed);
        }
      }

      // 차지 링
      const ringSize = 2 + Math.floor(charge * 4);
      drawPixelCircleOutline(ctx, -4 * P, -2 * P, ringSize, P, CYBER_PALETTE.brightRed);

      // 경고 깜빡임
      if (Math.floor(t / 80) % 2 === 0) {
        drawPixelRect(ctx, -7 * P, -7 * P, 2, 2, P, CYBER_PALETTE.brightRed);
      }
    }

    // LED 인디케이터
    drawPixelLED(ctx, 1 * P, -5 * P, P, Math.floor(t / 300) % 2 === 0, CYBER_PALETTE.matrixGreen, CYBER_PALETTE.matrixDark);
    drawPixelLED(ctx, 1 * P, 1 * P, P, isCharging, CYBER_PALETTE.brightRed, CYBER_PALETTE.virusDark);
  }

  ctx.restore();
}

/**
 * CASTER - 코드 캐스터 (마법사 AI)
 * v8.0 리디자인: 로브 입은 형태 + 플로팅 코드 심볼 + 검은 아웃라인
 * 14x20 픽셀, 신비로운 마법사 실루엣
 */
export function drawPixelCaster(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const isCharging = enemy.attackCooldown !== undefined && enemy.attackCooldown < 1.5;

  ctx.save();

  // 호버 효과 (신비로운 부유)
  const hover = Math.sin(t / 300) * 3;
  ctx.translate(0, hover);

  // 그림자
  drawPixelShadow(ctx, -8, 16 - hover / 2, 8, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -6 * P, -10 * P, 6, 12, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 ===
    // 로브 (삼각형 형태)
    drawBlackOutlineRect(ctx, -6 * P, -4 * P, 6, 10, P, 1);

    // 후드 (머리)
    drawPixelCircleWithBlackOutline(ctx, -3 * P, -8 * P, 4, P, CYBER_PALETTE.codePurple);

    // 로브 바디
    drawPixelRect(ctx, -6 * P, -4 * P, 6, 10, P, CYBER_PALETTE.codePurple);
    // 로브 내부 (어두운 그라데이션)
    drawPixelRect(ctx, -5 * P, -2 * P, 4, 6, P, CYBER_PALETTE.codeDark);

    // 후드 내부 (얼굴 영역 - 어둡게)
    drawPixelCircle(ctx, -3 * P, -8 * P, 3, P, CYBER_PALETTE.codeMid);
    drawPixelCircle(ctx, -3 * P, -7 * P, 2, P, CYBER_PALETTE.pureBlack);

    // 눈 (빛나는 보라색)
    const eyeGlow = Math.floor(t / 150) % 3 !== 0;
    if (eyeGlow) {
      drawPixelRect(ctx, -5 * P, -8 * P, 2, 1, P, CYBER_PALETTE.electricBlue);
      drawPixelRect(ctx, -2 * P, -8 * P, 2, 1, P, CYBER_PALETTE.electricBlue);
    }

    // 손 (양쪽으로 뻗은)
    const armWave = Math.sin(t / 200) * 0.5;
    drawPixelRectWithBlackOutline(ctx, -8 * P + armWave * P, -2 * P, 2, 2, P, CYBER_PALETTE.codeMid);
    drawPixelRectWithBlackOutline(ctx, 2 * P - armWave * P, -2 * P, 2, 2, P, CYBER_PALETTE.codeMid);

    // 플로팅 코드 심볼들
    const symbolPhase = Math.floor(t / 100) % 4;

    // { } 심볼 (왼쪽)
    const sym1Y = -10 * P + Math.sin(t / 200) * 2;
    drawPixel(ctx, -9 * P, sym1Y, P, CYBER_PALETTE.brightCyan);
    drawPixel(ctx, -9 * P, sym1Y + P, P, CYBER_PALETTE.brightCyan);

    // < > 심볼 (오른쪽)
    const sym2Y = -12 * P + Math.cos(t / 250) * 2;
    drawPixel(ctx, 4 * P, sym2Y, P, CYBER_PALETTE.neonPink);
    drawPixel(ctx, 5 * P, sym2Y + P, P, CYBER_PALETTE.neonPink);

    // 0/1 바이너리 (위)
    if (symbolPhase % 2 === 0) {
      drawPixel(ctx, -4 * P, -14 * P, P, CYBER_PALETTE.matrixGreen);
      drawPixel(ctx, -2 * P, -15 * P, P, CYBER_PALETTE.matrixGreen);
    }

    // 차지 시 마법진
    if (isCharging) {
      // 마법진 원
      const ringPhase = Math.floor(t / 50) % 360;
      const ringRadius = 5 + Math.floor((t / 100) % 3);
      drawPixelCircleOutline(ctx, -3 * P, -1 * P, ringRadius, P, CYBER_PALETTE.electricBlue);

      // 회전하는 심볼들
      for (let i = 0; i < 4; i++) {
        const angle = (ringPhase + i * 90) * Math.PI / 180;
        const sx = Math.cos(angle) * 6;
        const sy = Math.sin(angle) * 4;
        drawPixel(ctx, (-3 + sx) * P, (-1 + sy) * P, P, CYBER_PALETTE.brightCyan);
      }

      // 손 끝 빛
      drawPixel(ctx, -9 * P, -2 * P, P, CYBER_PALETTE.electricBlue);
      drawPixel(ctx, 3 * P, -2 * P, P, CYBER_PALETTE.electricBlue);
    }

    // 로브 끝단 (물결)
    const robeWave = Math.sin(t / 150);
    drawPixelLineH(ctx, -6 * P + robeWave, 5 * P, 6, P, CYBER_PALETTE.codeDark);
  }

  ctx.restore();
}

/**
 * ARTILLERY - DDoS 포대 (서버 클러스터)
 * v8.0 리디자인: 위압적인 포탑 + 패킷 발사구 + 검은 아웃라인
 * 22x24 픽셀, 공격적인 포대 실루엣
 */
export function drawPixelArtillery(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const seed = (enemy.id || 0) + getSeedBase();
  const danger = enemy.attackCooldown !== undefined && enemy.attackCooldown < 0.8;
  const dangerFlash = danger && Math.floor(t / 60) % 2 === 0;

  ctx.save();

  // 위험 시 흔들림 (더 강하게)
  if (danger) {
    const tremble = (deterministicRandom(seed + Math.floor(t / 40)) - 0.5) * 3;
    ctx.translate(tremble, tremble * 0.5);
  }

  // 그림자 (크게)
  drawPixelShadow(ctx, -14, 18, 14, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -8 * P, -10 * P, 8, 12, P, CYBER_PALETTE.white);
  } else {
    // === 검은 아웃라인 ===
    drawBlackOutlineRect(ctx, -8 * P, -10 * P, 8, 12, P, 1);

    // 메인 바디 (포탑 케이스)
    const bodyColor = dangerFlash ? CYBER_PALETTE.brightRed : CYBER_PALETTE.brightOrange;
    drawPixelRect(ctx, -8 * P, -10 * P, 8, 12, P, bodyColor);

    // 내부 장갑 패널
    drawPixelRect(ctx, -6 * P, -8 * P, 4, 8, P, CYBER_PALETTE.alertMid);

    // 경고 스트라이프 (대각선)
    for (let i = 0; i < 4; i++) {
      drawPixelLineH(ctx, -8 * P, (-8 + i * 3) * P, 1, P, CYBER_PALETTE.pureBlack);
      drawPixelLineH(ctx, -1 * P, (-7 + i * 3) * P, 1, P, CYBER_PALETTE.pureBlack);
    }

    // 포구 (3개 - 상단)
    for (let i = 0; i < 3; i++) {
      const barrelX = -6 * P + i * 4 * P;
      // 포구 케이스
      drawPixelRectWithBlackOutline(ctx, barrelX, -14 * P, 2, 4, P, CYBER_PALETTE.metalDark);
      // 포구 내부 (빨간색 - 발사 준비)
      const barrelColor = dangerFlash ? CYBER_PALETTE.brightRed : CYBER_PALETTE.alertDark;
      drawPixelRect(ctx, barrelX, -13 * P, 2, 2, P, barrelColor);
    }

    // 타겟 눈 (큰 스코프)
    drawPixelCircleWithBlackOutline(ctx, -4 * P, -4 * P, 3, P, CYBER_PALETTE.pureBlack);
    // 스코프 내부
    const targetColor = dangerFlash ? CYBER_PALETTE.brightRed : CYBER_PALETTE.brightOrange;
    drawPixelCircle(ctx, -4 * P, -4 * P, 2, P, targetColor);
    // 십자선
    drawPixelLineH(ctx, -6 * P, -4 * P, 4, P, CYBER_PALETTE.pureBlack);
    drawPixelLineV(ctx, -4 * P, -6 * P, 4, P, CYBER_PALETTE.pureBlack);

    // LED 어레이 (측면)
    for (let i = 0; i < 4; i++) {
      const ledColor = dangerFlash
        ? CYBER_PALETTE.brightRed
        : [CYBER_PALETTE.matrixGreen, CYBER_PALETTE.brightCyan, CYBER_PALETTE.brightOrange, CYBER_PALETTE.brightRed][i];
      const ledOn = Math.floor(t / (60 + i * 20)) % 2 === 0;
      drawPixelLED(ctx, 2 * P, (-8 + i * 3) * P, P, ledOn, ledColor, CYBER_PALETTE.metalDark);
    }

    // 안테나 (2개 - 더 굵게)
    drawPixelRectWithBlackOutline(ctx, -7 * P, -18 * P, 1, 4, P, CYBER_PALETTE.metalMid);
    drawPixelRectWithBlackOutline(ctx, -1 * P, -18 * P, 1, 4, P, CYBER_PALETTE.metalMid);
    // 안테나 팁 (빨간 LED)
    const antennaOn = dangerFlash || Math.floor(t / 200) % 2 === 0;
    drawPixelRect(ctx, -7 * P, -19 * P, 1, 1, P, antennaOn ? CYBER_PALETTE.brightRed : CYBER_PALETTE.virusDark);
    drawPixelRect(ctx, -1 * P, -19 * P, 1, 1, P, antennaOn ? CYBER_PALETTE.brightRed : CYBER_PALETTE.virusDark);

    // 다리 (포대 지지대)
    drawPixelRectWithBlackOutline(ctx, -7 * P, 2 * P, 2, 4, P, CYBER_PALETTE.metalDark);
    drawPixelRectWithBlackOutline(ctx, -1 * P, 2 * P, 2, 4, P, CYBER_PALETTE.metalDark);
    // 발 패드
    drawPixelRect(ctx, -8 * P, 6 * P, 4, 1, P, CYBER_PALETTE.metalMid);
    drawPixelRect(ctx, -2 * P, 6 * P, 4, 1, P, CYBER_PALETTE.metalMid);

    // 로딩 바 (위험 시)
    if (danger) {
      const loadProgress = Math.min(1, (0.8 - (enemy.attackCooldown || 0)) / 0.8);
      const barWidth = Math.floor(6 * loadProgress);
      // 바 배경
      drawPixelRect(ctx, -6 * P, 0, 6, 1, P, CYBER_PALETTE.metalDark);
      // 바 진행
      drawPixelRect(ctx, -6 * P, 0, barWidth, 1, P, CYBER_PALETTE.brightRed);

      // 경고 아이콘 깜빡임
      if (dangerFlash) {
        drawPixelRect(ctx, -8 * P, -12 * P, 2, 2, P, CYBER_PALETTE.brightRed);
        drawPixelRect(ctx, 4 * P, -12 * P, 2, 2, P, CYBER_PALETTE.brightRed);
      }
    }

    // 패킷 파티클 (위험 시 - 더 많이)
    if (danger) {
      for (let i = 0; i < 6; i++) {
        const pAngle = (t / 30 + i * 60) * Math.PI / 180;
        const pDist = 8 + (i % 3) * 3;
        const px = Math.sin(pAngle) * pDist;
        const py = -14 - Math.cos(pAngle) * pDist - (t / 50 + i * 10) % 10;
        if (py > -25) {
          drawPixel(ctx, px * P, py * P, P, CYBER_PALETTE.brightOrange);
        }
      }
    }

    // DDoS 라벨
    drawPixelLineH(ctx, -5 * P, -1 * P, 4, P, dangerFlash ? CYBER_PALETTE.brightRed : CYBER_PALETTE.alertOrange);
  }

  ctx.restore();
}

