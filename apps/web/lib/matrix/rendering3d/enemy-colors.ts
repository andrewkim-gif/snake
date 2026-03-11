/**
 * enemy-colors.ts — 적 3D 색상 매핑 시스템 (S21)
 *
 * CYBER_PALETTE 30색 → Three.js Color 매핑.
 * 173개 적 타입별 primary/secondary color 정의.
 * per-instance color 적용 로직 (InstancedMesh.setColorAt)
 *
 * primary color: 주 몸체 색상 (enemies.config.ts의 color 필드에서 파생)
 * secondary color: 디테일/액센트 색상 (자동 생성: primary에서 명도/채도 변조)
 */

import * as THREE from 'three';
import { ENEMY_TYPES } from '../config/enemies.config';
import type { EnemyType } from '../types';

// ============================================
// CYBER_PALETTE → Three.js Color 변환
// ============================================

/** CYBER_PALETTE에서 가져온 30색 Three.js Color 매핑 */
export const CYBER_COLORS = {
  // 매트릭스 그린 계열
  matrixGreen: new THREE.Color('#00FF41'),
  matrixDark: new THREE.Color('#003311'),
  matrixMid: new THREE.Color('#00AA2A'),
  matrixLight: new THREE.Color('#44FF77'),

  // 바이러스 레드 계열
  virusRed: new THREE.Color('#FF2244'),
  virusDark: new THREE.Color('#660011'),
  virusMid: new THREE.Color('#CC1133'),
  virusLight: new THREE.Color('#FF6677'),

  // 데이터 시안 계열
  dataCyan: new THREE.Color('#00FFFF'),
  dataDark: new THREE.Color('#004455'),
  dataMid: new THREE.Color('#00AAAA'),
  dataLight: new THREE.Color('#66FFFF'),

  // 경고 오렌지 계열
  alertOrange: new THREE.Color('#FF8800'),
  alertDark: new THREE.Color('#663300'),
  alertMid: new THREE.Color('#CC6600'),
  alertLight: new THREE.Color('#FFAA44'),

  // 코드 퍼플 계열
  codePurple: new THREE.Color('#AA44FF'),
  codeDark: new THREE.Color('#330066'),
  codeMid: new THREE.Color('#7722CC'),
  codeLight: new THREE.Color('#CC88FF'),

  // 시스템 그레이 계열
  metalDark: new THREE.Color('#1A1A2E'),
  metalMid: new THREE.Color('#374151'),
  metalLight: new THREE.Color('#6B7280'),
  metalHighlight: new THREE.Color('#9CA3AF'),

  // 바이너리
  black: new THREE.Color('#0D0D0D'),
  white: new THREE.Color('#F0F0F0'),

  // 글리치
  glitchPink: new THREE.Color('#FF00FF'),
  glitchYellow: new THREE.Color('#FFFF00'),

  // Semantic
  primary: new THREE.Color('#3B82F6'),
  success: new THREE.Color('#22C55E'),
  gold: new THREE.Color('#FFD700'),
} as const;

// ============================================
// 적 타입별 색상 정의
// ============================================

/** 적 타입별 primary + secondary 색상 쌍 */
export interface EnemyColorPair {
  /** 주 몸체 색상 (head, body) */
  primary: THREE.Color;
  /** 액센트 색상 (legs, arms, wings) */
  secondary: THREE.Color;
}

/**
 * hex 색상에서 secondary 색상 자동 생성
 * - HSL 기반으로 명도를 20% 어둡게, 채도를 10% 높게
 */
function deriveSecondaryColor(primaryHex: string): THREE.Color {
  const color = new THREE.Color(primaryHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // 명도를 20% 낮추고, 채도를 약간 높임
  hsl.l = Math.max(0, hsl.l - 0.2);
  hsl.s = Math.min(1, hsl.s + 0.1);

  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

// ============================================
// 색상 캐시 (lazy 빌드)
// ============================================

const colorCache = new Map<string, EnemyColorPair>();

/**
 * enemyType에 대한 색상 쌍 가져오기 (cached)
 *
 * enemies.config.ts의 color 필드에서 primary 파생,
 * secondary는 자동 생성 (어두운 변형)
 */
export function getEnemyColors(enemyType: string): EnemyColorPair {
  let pair = colorCache.get(enemyType);
  if (pair) return pair;

  // enemies.config.ts에서 원본 hex 색상 가져오기
  const config = ENEMY_TYPES[enemyType as EnemyType];
  const hex = config?.color ?? '#6b7280'; // fallback: metalLight

  const primary = new THREE.Color(hex);
  const secondary = deriveSecondaryColor(hex);

  pair = { primary, secondary };
  colorCache.set(enemyType, pair);
  return pair;
}

/**
 * 모든 적 타입의 색상 캐시 미리 빌드
 * (게임 로딩 시 한 번 호출하면 런타임 할당 방지)
 */
export function prebuildColorCache(): void {
  const types = Object.keys(ENEMY_TYPES);
  for (const t of types) {
    getEnemyColors(t);
  }
}

/**
 * 색상 캐시 정리
 */
export function disposeColorCache(): void {
  colorCache.clear();
}

// ============================================
// InstancedMesh Color 적용 유틸
// ============================================

/** 재사용 가능한 임시 Color 객체 (GC 최적화) */
const _tempColor = new THREE.Color();

/**
 * InstancedMesh에 per-instance primary color 적용
 *
 * @param mesh - InstancedMesh (color attribute 활성화 필요)
 * @param index - instance index
 * @param enemyType - 적 타입 (색상 조회용)
 * @param usePrimary - true면 primary, false면 secondary 사용
 */
export function applyInstanceColor(
  mesh: THREE.InstancedMesh,
  index: number,
  enemyType: string,
  usePrimary: boolean = true,
): void {
  const colors = getEnemyColors(enemyType);
  _tempColor.copy(usePrimary ? colors.primary : colors.secondary);
  mesh.setColorAt(index, _tempColor);
}

/**
 * InstancedMesh에 직접 Color 객체 적용
 *
 * @param mesh - InstancedMesh
 * @param index - instance index
 * @param color - Three.js Color
 */
export function applyDirectColor(
  mesh: THREE.InstancedMesh,
  index: number,
  color: THREE.Color,
): void {
  mesh.setColorAt(index, color);
}

/**
 * InstancedMesh의 instanceColor 업데이트 플래그 설정
 * (setColorAt 후 호출 필요)
 */
export function markColorNeedsUpdate(mesh: THREE.InstancedMesh): void {
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

// ============================================
// Elite 색상 오버라이드
// ============================================

/** Elite tier별 emissive 색상 */
export const ELITE_EMISSIVE_COLORS = {
  silver: new THREE.Color('#c0c0c0'),
  gold: new THREE.Color('#ffd700'),
  diamond: new THREE.Color('#00ffff'),
} as const;

/** Elite tier별 emissive 강도 */
export const ELITE_EMISSIVE_INTENSITY = {
  silver: 0.3,
  gold: 0.6,
  diamond: 1.0,
} as const;

/** Elite tier별 orbiting particle 색상 */
export const ELITE_PARTICLE_COLORS = {
  silver: new THREE.Color('#e0e0e0'),
  gold: new THREE.Color('#ffe066'),
  diamond: new THREE.Color('#66ffff'),
} as const;
