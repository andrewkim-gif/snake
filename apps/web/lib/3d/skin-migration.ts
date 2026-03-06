/**
 * skin-migration.ts — 레거시 skinId → CubelingAppearance 변환
 *
 * 기존 24 스킨 (DEFAULT_SKINS)을 CubelingAppearance로 1:1 매핑
 * 하위 호환: 서버가 skinId를 보내면 자동 변환
 * Three.js 의존 없음
 */

import { DEFAULT_SKINS, VIVID_PALETTE } from '@agent-survivor/shared';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { createDefaultAppearance } from '@agent-survivor/shared';

// ─── 레거시 색상 → VIVID_PALETTE 인덱스 매핑 ───

/**
 * 레거시 크레용 색상 → 비비드 팔레트 근사 매핑
 * 유클리드 RGB 거리 기반 최근접 색상 선택
 */
function hexToRgbArray(hex: string): [number, number, number] {
  const h = parseInt(hex.slice(1), 16);
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
}

function findClosestVividIndex(hex: string): number {
  const [r, g, b] = hexToRgbArray(hex);
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < VIVID_PALETTE.length; i++) {
    const [pr, pg, pb] = hexToRgbArray(VIVID_PALETTE[i]);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ─── 레거시 eyeStyle 문자열 → 인덱스 매핑 ───

const LEGACY_EYE_MAP: Record<string, number> = {
  default: 0,
  angry: 1,
  cute: 2,
  cool: 3,
  wink: 4,
  dot: 5,
};

// ─── 레거시 패턴 문자열 → 인덱스 매핑 ───

const LEGACY_PATTERN_MAP: Record<string, number> = {
  solid: 0,
  striped: 1,
  dotted: 2,
  gradient: 3,
};

// ─── 24 스킨 매핑 테이블 ───

/**
 * 기존 skinId(0~23) → CubelingAppearance 변환 테이블
 * 초기화 시 한 번 생성, 이후 캐시 사용
 */
const LEGACY_SKIN_MAP: Map<number, CubelingAppearance> = new Map();

function buildLegacySkinMap(): void {
  if (LEGACY_SKIN_MAP.size > 0) return; // 이미 초기화됨

  for (const skin of DEFAULT_SKINS) {
    const topColor = findClosestVividIndex(skin.primaryColor);
    const bottomColor = findClosestVividIndex(skin.secondaryColor);
    const eyeStyle = LEGACY_EYE_MAP[skin.eyeStyle] ?? 0;
    const pattern = LEGACY_PATTERN_MAP[skin.pattern] ?? 0;

    // skinId를 기반으로 다양한 기본값 분배
    const skinTone = skin.id % 12;
    const hairStyle = skin.id % 16;
    const hairColor = (skin.id * 3) % 16;
    const mouthStyle = skin.id % 8;

    const appearance: CubelingAppearance = {
      bodyType: 'standard',
      bodySize: 'medium',
      skinTone,
      eyeStyle,
      mouthStyle,
      marking: 0,
      topColor,
      bottomColor,
      pattern,
      hairStyle,
      hairColor,
      hat: 0,
      weapon: 0,
      backItem: 0,
      footwear: 0,
      trailEffect: 0,
      auraEffect: 0,
      emote: 0,
      spawnEffect: 0,
    };

    LEGACY_SKIN_MAP.set(skin.id, appearance);
  }
}

// ─── 공개 API ───

/**
 * 레거시 skinId → CubelingAppearance 변환
 * 알 수 없는 skinId는 기본 프리셋 반환 (에러 없음)
 */
export function migrateSkinToAppearance(skinId: number): CubelingAppearance {
  buildLegacySkinMap();

  const cached = LEGACY_SKIN_MAP.get(skinId);
  if (cached) return { ...cached }; // 방어적 복사

  // 범위 밖 skinId → 기본 프리셋
  return createDefaultAppearance();
}

/**
 * AgentNetworkData.k (레거시 skinId 또는 appearanceHash) → CubelingAppearance 해석
 *
 * Phase 1: 항상 skinId → 마이그레이션 경로
 * Phase 2+: appearanceCache hit 시 네이티브 appearance 반환
 */
export function resolveAppearance(
  skinIdOrHash: number,
  appearanceCache?: Map<number, CubelingAppearance>,
): CubelingAppearance {
  // Phase 2+: 캐시에 있으면 네이티브 appearance 반환
  if (appearanceCache) {
    const cached = appearanceCache.get(skinIdOrHash);
    if (cached) return cached;
  }

  // Phase 1: skinId → 마이그레이션
  return migrateSkinToAppearance(skinIdOrHash);
}

/**
 * LEGACY_SKIN_MAP 직접 접근 (테스트/디버깅용)
 */
export function getLegacySkinMap(): ReadonlyMap<number, CubelingAppearance> {
  buildLegacySkinMap();
  return LEGACY_SKIN_MAP;
}
