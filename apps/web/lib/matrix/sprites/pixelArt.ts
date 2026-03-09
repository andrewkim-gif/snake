/**
 * game/sprites/pixelArt.ts - NEO 캐릭터 픽셀 아트 렌더러
 * Canvas 2D API로 직접 그리는 픽셀 아트 스타일
 *
 * 컨셉: 한국 웹툰 주인공 스타일
 * - 브라운 후드 (갈색 hoodie)
 * - 검은 바지
 * - 치비 비율 (대두)
 */

import { Direction8 } from './types';

// 색상 팔레트
const COLORS = {
  // 피부
  skin: '#FFE4C4',
  skinShadow: '#E8C9A0',
  skinHighlight: '#FFF0E0',

  // 후드 (브라운)
  hood: '#8B4513',
  hoodDark: '#654321',
  hoodLight: '#A0522D',
  hoodInner: '#5C3317',

  // 바지 (검은색)
  pants: '#1A1A2E',
  pantsDark: '#0D0D1A',
  pantsHighlight: '#2A2A3E',

  // 머리카락 (검은색)
  hair: '#1A1A1A',
  hairHighlight: '#333333',

  // 눈
  eyeWhite: '#FFFFFF',
  eyePupil: '#1A1A1A',
  eyeHighlight: '#FFFFFF',

  // 신발
  shoes: '#2D2D2D',
  shoesSole: '#1A1A1A',

  // 윤곽선
  outline: '#1A1A1A',

  // 투명
  transparent: 'transparent',
} as const;

type ColorKey = keyof typeof COLORS;

// 픽셀 데이터 타입 (색상 키 또는 null)
type PixelData = (ColorKey | null)[][];

/**
 * NEO 정면 (FRONT) - 16x24 픽셀
 * 브라운 후드를 입은 웹툰 주인공
 */
const NEO_FRONT: PixelData = [
  // Row 0-1: 머리 상단 (후드)
  [null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null, null],
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null, null],
  // Row 2-3: 후드 + 머리카락
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hair', 'hair', 'hair', 'hair', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, null, 'hood', 'hood', 'hair', 'hair', 'hairHighlight', 'hairHighlight', 'hair', 'hair', 'hood', 'hood', null, null, null],
  // Row 4-5: 이마 + 머리카락
  [null, null, 'hoodDark', 'hood', 'hair', 'hair', 'skin', 'skin', 'skin', 'skin', 'hair', 'hair', 'hood', 'hoodDark', null, null],
  [null, null, 'hood', 'hood', 'hair', 'skin', 'skin', 'skinHighlight', 'skinHighlight', 'skin', 'skin', 'hair', 'hood', 'hood', null, null],
  // Row 6-7: 눈
  [null, null, 'hood', 'hoodInner', 'skin', 'skin', 'eyeWhite', 'eyePupil', 'eyePupil', 'eyeWhite', 'skin', 'skin', 'hoodInner', 'hood', null, null],
  [null, null, 'hood', 'hoodInner', 'skin', 'skin', 'eyeWhite', 'eyeHighlight', 'eyeHighlight', 'eyeWhite', 'skin', 'skin', 'hoodInner', 'hood', null, null],
  // Row 8-9: 코, 입
  [null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skin', 'skinShadow', 'skinShadow', 'skin', 'skin', 'skin', 'hoodInner', 'hood', null, null],
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skin', 'skin', 'skin', 'skin', 'hoodInner', 'hood', null, null, null],
  // Row 10-11: 턱, 목
  [null, null, null, 'hood', 'hood', 'hoodInner', 'skin', 'skin', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hoodInner', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null, null],
  // Row 12-13: 어깨, 상체 (후드)
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null],
  // Row 14-15: 몸통 (후드)
  [null, null, 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hoodDark', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hood', 'hood', null, null],
  [null, null, 'hood', 'hood', 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', 'hood', 'hood', null, null],
  // Row 16-17: 하체 시작 (바지)
  [null, null, null, 'hood', 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', 'hood', null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null],
  // Row 18-19: 바지
  [null, null, null, 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pants', 'pants', 'pantsDark', 'pants', 'pants', null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pants', null, null, null],
  // Row 20-21: 다리
  [null, null, null, null, 'pants', 'pants', 'pants', 'pantsHighlight', 'pantsHighlight', 'pants', 'pants', 'pants', null, null, null, null],
  [null, null, null, null, 'pants', 'pants', 'pants', null, null, 'pants', 'pants', 'pants', null, null, null, null],
  // Row 22-23: 신발
  [null, null, null, null, 'shoes', 'shoes', 'shoes', null, null, 'shoes', 'shoes', 'shoes', null, null, null, null],
  [null, null, null, 'shoesSole', 'shoes', 'shoes', 'shoesSole', null, null, 'shoesSole', 'shoes', 'shoes', 'shoesSole', null, null, null],
];

/**
 * NEO 뒷면 (BACK) - 16x24 픽셀
 */
const NEO_BACK: PixelData = [
  // Row 0-1: 머리 상단 (후드)
  [null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null, null],
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null, null],
  // Row 2-3: 후드 뒷면
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hoodDark', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  // Row 4-7: 후드 뒷면 (머리 부분)
  [null, null, 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', null, null],
  [null, null, 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', null, null],
  [null, null, 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hoodDark', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hood', 'hood', null, null],
  [null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', null, null],
  // Row 8-11: 후드 뒷면 하단
  [null, null, 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', null, null],
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hoodDark', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  [null, null, null, 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', null, null, null, null],
  // Row 12-13: 어깨, 상체 (후드)
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null],
  // Row 14-15: 몸통 (후드)
  [null, null, 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hoodDark', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hood', 'hood', null, null],
  [null, null, 'hood', 'hood', 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', 'hood', 'hood', null, null],
  // Row 16-17: 하체 시작 (바지)
  [null, null, null, 'hood', 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', 'hood', null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null],
  // Row 18-19: 바지
  [null, null, null, 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pants', 'pants', 'pantsDark', 'pants', 'pants', null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pants', null, null, null],
  // Row 20-21: 다리
  [null, null, null, null, 'pants', 'pants', 'pants', 'pantsHighlight', 'pantsHighlight', 'pants', 'pants', 'pants', null, null, null, null],
  [null, null, null, null, 'pants', 'pants', 'pants', null, null, 'pants', 'pants', 'pants', null, null, null, null],
  // Row 22-23: 신발
  [null, null, null, null, 'shoes', 'shoes', 'shoes', null, null, 'shoes', 'shoes', 'shoes', null, null, null, null],
  [null, null, null, 'shoesSole', 'shoes', 'shoes', 'shoesSole', null, null, 'shoesSole', 'shoes', 'shoes', 'shoesSole', null, null, null],
];

/**
 * NEO 왼쪽 측면 (SIDE_LEFT) - 16x24 픽셀
 */
const NEO_SIDE_LEFT: PixelData = [
  // Row 0-1: 머리 상단 (후드)
  [null, null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null, null],
  [null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null, null],
  // Row 2-3: 후드 + 머리카락
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hair', 'hair', 'hair', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hair', 'hair', 'hairHighlight', 'hair', 'hair', 'hood', 'hood', null, null, null],
  // Row 4-5: 이마 + 얼굴
  [null, null, null, 'hoodDark', 'hood', 'hair', 'skin', 'skin', 'skin', 'hair', 'hair', 'hood', 'hood', 'hoodDark', null, null],
  [null, null, null, 'hood', 'hood', 'skin', 'skin', 'skinHighlight', 'skin', 'skin', 'hair', 'hood', 'hood', 'hood', null, null],
  // Row 6-7: 눈 (측면)
  [null, null, null, 'hood', 'hoodInner', 'skin', 'eyeWhite', 'eyePupil', 'skin', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null],
  [null, null, null, 'hood', 'hoodInner', 'skin', 'eyeWhite', 'eyeHighlight', 'skin', 'skin', 'skin', 'hoodInner', 'hood', null, null, null],
  // Row 8-9: 코, 입 (측면)
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skinShadow', 'skin', 'skin', 'skin', 'hoodInner', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null],
  // Row 10-11: 턱, 목
  [null, null, null, null, 'hood', 'hood', 'hoodInner', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null, null],
  [null, null, null, null, null, 'hood', 'hood', 'hoodInner', 'hoodInner', 'hood', 'hood', null, null, null, null, null],
  // Row 12-13: 어깨, 상체
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null],
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null],
  // Row 14-15: 몸통 + 팔
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', null, null, null],
  // Row 16-17: 손, 바지
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', null, null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null],
  // Row 18-19: 바지
  [null, null, null, 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pantsDark', 'pants', 'pants', null, null, null, null, null],
  [null, null, null, null, 'pants', 'pants', 'pantsDark', 'pantsDark', 'pants', 'pants', null, null, null, null, null, null],
  // Row 20-21: 다리
  [null, null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null],
  [null, null, null, null, null, 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null, null],
  // Row 22-23: 신발
  [null, null, null, null, null, 'shoes', 'shoes', 'shoes', 'shoes', null, null, null, null, null, null, null],
  [null, null, null, null, 'shoesSole', 'shoes', 'shoes', 'shoes', 'shoesSole', null, null, null, null, null, null, null],
];

/**
 * NEO 왼쪽 위 대각선 (BACK_SIDE_LEFT) - 16x24 픽셀
 */
const NEO_BACK_SIDE_LEFT: PixelData = [
  // Row 0-1: 머리 상단 (후드)
  [null, null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null, null],
  [null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null, null],
  // Row 2-3: 후드 뒷면
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  // Row 4-5: 후드 뒷면
  [null, null, null, 'hoodDark', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', null, null],
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', 'hood', null, null],
  // Row 6-7: 후드 + 약간 보이는 얼굴
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'hoodDark', 'hoodDark', 'hood', 'hood', 'hoodInner', 'hood', 'hood', null, null],
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'hood', 'hood', 'hoodDark', 'hood', 'hoodInner', 'hood', null, null, null],
  // Row 8-11: 후드 뒷면 하단
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'hood', 'hood', 'hood', 'hood', 'hoodInner', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hoodInner', 'skin', 'hood', 'hood', 'hood', 'hoodInner', 'hood', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hoodInner', 'hood', 'hood', 'hoodInner', 'hood', 'hood', null, null, null, null],
  [null, null, null, null, null, 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', null, null, null, null, null],
  // Row 12-13: 어깨, 상체
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null],
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null],
  // Row 14-15: 몸통 + 팔
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', null, null, null],
  // Row 16-17: 손, 바지
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', null, null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null],
  // Row 18-19: 바지
  [null, null, null, 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pantsDark', 'pants', 'pants', null, null, null, null, null],
  [null, null, null, null, 'pants', 'pants', 'pantsDark', 'pantsDark', 'pants', 'pants', null, null, null, null, null, null],
  // Row 20-21: 다리
  [null, null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null],
  [null, null, null, null, null, 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null, null],
  // Row 22-23: 신발
  [null, null, null, null, null, 'shoes', 'shoes', 'shoes', 'shoes', null, null, null, null, null, null, null],
  [null, null, null, null, 'shoesSole', 'shoes', 'shoes', 'shoes', 'shoesSole', null, null, null, null, null, null, null],
];

/**
 * NEO 왼쪽 아래 대각선 (FRONT_SIDE_LEFT) - 16x24 픽셀
 */
const NEO_FRONT_SIDE_LEFT: PixelData = [
  // Row 0-1: 머리 상단 (후드)
  [null, null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null, null],
  [null, null, null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null, null],
  // Row 2-3: 후드 + 머리카락
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hair', 'hair', 'hair', 'hood', 'hood', 'hoodDark', null, null, null],
  [null, null, null, null, 'hood', 'hood', 'hair', 'hair', 'hairHighlight', 'hair', 'hair', 'hood', 'hood', null, null, null],
  // Row 4-5: 이마 + 얼굴 (좀 더 정면 보임)
  [null, null, null, 'hoodDark', 'hood', 'hair', 'skin', 'skin', 'skin', 'skin', 'hair', 'hood', 'hood', 'hoodDark', null, null],
  [null, null, null, 'hood', 'hood', 'skin', 'skin', 'skinHighlight', 'skinHighlight', 'skin', 'hair', 'hood', 'hood', 'hood', null, null],
  // Row 6-7: 눈 (약간 측면)
  [null, null, null, 'hood', 'hoodInner', 'skin', 'eyeWhite', 'eyePupil', 'eyePupil', 'eyeWhite', 'skin', 'hoodInner', 'hood', 'hood', null, null],
  [null, null, null, 'hood', 'hoodInner', 'skin', 'eyeWhite', 'eyeHighlight', 'eyeHighlight', 'eyeWhite', 'skin', 'hoodInner', 'hood', null, null, null],
  // Row 8-9: 코, 입
  [null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skinShadow', 'skin', 'skin', 'skin', 'hoodInner', 'hood', null, null, null],
  [null, null, null, null, 'hood', 'hoodInner', 'skin', 'skin', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null],
  // Row 10-11: 턱, 목
  [null, null, null, null, 'hood', 'hood', 'hoodInner', 'skin', 'skin', 'hoodInner', 'hood', 'hood', null, null, null, null],
  [null, null, null, null, null, 'hood', 'hood', 'hoodInner', 'hoodInner', 'hood', 'hood', null, null, null, null, null],
  // Row 12-13: 어깨, 상체
  [null, null, null, null, 'hoodDark', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hoodDark', null, null, null, null],
  [null, null, null, 'hoodDark', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodLight', 'hood', 'hood', 'hoodDark', null, null, null],
  // Row 14-15: 몸통 + 팔
  [null, null, null, 'hood', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hoodDark', 'hood', 'hood', 'hood', null, null, null],
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'skin', null, null, null],
  // Row 16-17: 손, 바지
  [null, null, 'skin', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', 'hood', null, null, null, null],
  [null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null],
  // Row 18-19: 바지
  [null, null, null, 'pants', 'pants', 'pantsDark', 'pants', 'pants', 'pantsDark', 'pants', 'pants', null, null, null, null, null],
  [null, null, null, null, 'pants', 'pants', 'pantsDark', 'pantsDark', 'pants', 'pants', null, null, null, null, null, null],
  // Row 20-21: 다리
  [null, null, null, null, 'pants', 'pants', 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null],
  [null, null, null, null, null, 'pants', 'pants', 'pants', 'pants', null, null, null, null, null, null, null],
  // Row 22-23: 신발
  [null, null, null, null, null, 'shoes', 'shoes', 'shoes', 'shoes', null, null, null, null, null, null, null],
  [null, null, null, null, 'shoesSole', 'shoes', 'shoes', 'shoes', 'shoesSole', null, null, null, null, null, null, null],
];

// 방향별 픽셀 데이터 매핑
const DIRECTION_PIXEL_DATA: Record<string, PixelData> = {
  front: NEO_FRONT,
  back: NEO_BACK,
  side_left: NEO_SIDE_LEFT,
  back_side_left: NEO_BACK_SIDE_LEFT,
  front_side_left: NEO_FRONT_SIDE_LEFT,
};

/**
 * 픽셀 데이터를 캔버스에 렌더링
 */
function renderPixelData(
  ctx: CanvasRenderingContext2D,
  pixelData: PixelData,
  x: number,
  y: number,
  scale: number = 1,
  flip: boolean = false
): void {
  const pixelSize = 4 * scale; // 각 픽셀의 실제 크기
  const width = pixelData[0].length;
  const height = pixelData.length;

  // 중심점 기준으로 오프셋 계산
  const offsetX = (width * pixelSize) / 2;
  const offsetY = (height * pixelSize) / 2;

  ctx.save();
  ctx.translate(x, y);

  if (flip) {
    ctx.scale(-1, 1);
  }

  // 픽셀 하나씩 그리기
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const colorKey = pixelData[row][col];
      if (colorKey && colorKey !== 'transparent') {
        const color = COLORS[colorKey];
        if (color && (color as string) !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(
            col * pixelSize - offsetX,
            row * pixelSize - offsetY,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  ctx.restore();
}

/**
 * NEO 픽셀 아트 캐릭터 렌더링
 * @param ctx Canvas 2D context
 * @param x 중심 X 좌표
 * @param y 중심 Y 좌표
 * @param direction 8방향
 * @param scale 스케일 (기본 1)
 * @returns 렌더링 성공 여부
 */
export function drawNeoPixelArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction8,
  scale: number = 1
): boolean {
  // 방향에 따른 이미지 키와 플립 여부 결정
  let imageKey: string;
  let flip = false;

  switch (direction) {
    case Direction8.FRONT:
      imageKey = 'front';
      break;
    case Direction8.BACK:
      imageKey = 'back';
      break;
    case Direction8.LEFT:
      imageKey = 'side_left';
      break;
    case Direction8.RIGHT:
      imageKey = 'side_left';
      flip = true;
      break;
    case Direction8.BACK_LEFT:
      imageKey = 'back_side_left';
      break;
    case Direction8.BACK_RIGHT:
      imageKey = 'back_side_left';
      flip = true;
      break;
    case Direction8.FRONT_LEFT:
      imageKey = 'front_side_left';
      break;
    case Direction8.FRONT_RIGHT:
      imageKey = 'front_side_left';
      flip = true;
      break;
    default:
      imageKey = 'front';
  }

  const pixelData = DIRECTION_PIXEL_DATA[imageKey];
  if (!pixelData) {
    return false;
  }

  renderPixelData(ctx, pixelData, x, y, scale, flip);
  return true;
}

/**
 * 피격 효과가 있는 NEO 픽셀 아트 렌더링
 */
export function drawNeoPixelArtWithHit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction8,
  scale: number = 1,
  hitFlash: boolean = false
): boolean {
  const drawn = drawNeoPixelArt(ctx, x, y, direction, scale);

  if (drawn && hitFlash) {
    // 피격 효과: 흰색 오버레이
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

    const pixelSize = 4 * scale;
    const width = 16 * pixelSize;
    const height = 24 * pixelSize;

    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.restore();
  }

  return drawn;
}

// Export 색상 팔레트 (다른 캐릭터에서 재사용 가능)
export { COLORS as NEO_COLORS };
