/**
 * game/rendering/utils.ts - 렌더링 유틸리티 함수
 */

/**
 * 색상 밝기 조절
 * @param hex - 16진수 색상 (# 포함 또는 미포함)
 * @param amt - 조절량 (양수: 밝게, 음수: 어둡게)
 * @returns 조절된 16진수 색상
 */
export const adjustColor = (hex: string, amt: number): string => {
  let usePound = false;
  if (hex[0] === '#') {
    hex = hex.slice(1);
    usePound = true;
  }
  let num = parseInt(hex, 16);
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let b = ((num >> 8) & 0x00ff) + amt;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  let g = (num & 0x0000ff) + amt;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;
  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
};

/**
 * 해시 기반 의사 난수 생성 (일관된 결과)
 * @param x - x 좌표
 * @param y - y 좌표
 * @param seed - 시드값
 * @returns 0~1 사이의 난수
 */
export const seededRandom = (x: number, y: number, seed: number = 0): number => {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7823) * 43758.5453) % 1;
};

/**
 * 두 색상 사이 보간
 * @param color1 - 시작 색상 (hex)
 * @param color2 - 끝 색상 (hex)
 * @param factor - 보간 계수 (0~1)
 * @returns 보간된 색상
 */
export const lerpColor = (color1: string, color2: string, factor: number): string => {
  const c1 = color1.startsWith('#') ? color1.slice(1) : color1;
  const c2 = color2.startsWith('#') ? color2.slice(1) : color2;

  const r1 = parseInt(c1.substring(0, 2), 16);
  const g1 = parseInt(c1.substring(2, 4), 16);
  const b1 = parseInt(c1.substring(4, 6), 16);

  const r2 = parseInt(c2.substring(0, 2), 16);
  const g2 = parseInt(c2.substring(2, 4), 16);
  const b2 = parseInt(c2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * RGBA 색상 생성
 * @param hex - 16진수 색상
 * @param alpha - 투명도 (0~1)
 * @returns rgba 문자열
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/**
 * 각도를 라디안으로 변환
 */
export const degToRad = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * 라디안을 각도로 변환
 */
export const radToDeg = (radians: number): number => radians * (180 / Math.PI);

/**
 * 두 점 사이 거리
 */
export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

/**
 * 값을 범위 내로 클램프
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * 캔버스 컨텍스트 저장 및 복원 헬퍼
 */
export const withContext = (
  ctx: CanvasRenderingContext2D,
  fn: () => void
): void => {
  ctx.save();
  try {
    fn();
  } finally {
    ctx.restore();
  }
};
