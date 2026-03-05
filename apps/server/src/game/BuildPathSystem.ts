/**
 * BuildPathSystem.ts — 에이전트 빌드 패스 관리
 *
 * 5개 프리셋 빌드 패스 + 커스텀 빌드 지원.
 * 업그레이드 선택 시 빌드 패스 우선순위에 따라 최적 선택 결정.
 */

import type {
  TomeType,
  AbilityType,
  PlayerBuild,
  UpgradeChoice,
} from '@snake-arena/shared';

// ─── Types ───

/** 빌드 패스 정의 */
export interface BuildPath {
  id: string;
  name: string;
  description: string;
  /** 톰 우선순위 (높은 순) */
  tomePriority: TomeType[];
  /** 어빌리티 우선순위 (높은 순) */
  abilityPriority: AbilityType[];
  /** 목표 시너지 ID */
  targetSynergy: string;
  /** 페이즈별 전략 힌트 */
  phaseStrategy: {
    early: 'gather' | 'fight' | 'farm';
    mid: 'gather' | 'fight' | 'farm' | 'kite';
    late: 'fight' | 'kite' | 'camp';
  };
}

/** 게임 컨텍스트 (업그레이드 선택 시 참고) */
export interface GameContext {
  level: number;
  mass: number;
  timeRemaining: number;
  roundDuration: number;
  nearbyThreats: number;
  myRank: number;
  totalPlayers: number;
}

// ─── 5개 프리셋 빌드 패스 ───

const BERSERKER: BuildPath = {
  id: 'berserker',
  name: 'Berserker',
  description: 'Damage > Cursed > Venom > Speed → Glass Cannon synergy',
  tomePriority: ['damage', 'cursed', 'speed', 'luck'],
  abilityPriority: ['venom_aura', 'speed_dash', 'lightning_strike'],
  targetSynergy: 'glass_cannon',
  phaseStrategy: { early: 'farm', mid: 'fight', late: 'fight' },
};

const TANK: BuildPath = {
  id: 'tank',
  name: 'Tank',
  description: 'Armor > Regen > Shield > Mass Drain → Iron Fortress synergy',
  tomePriority: ['armor', 'regen', 'magnet', 'damage'],
  abilityPriority: ['shield_burst', 'mass_drain', 'gravity_well'],
  targetSynergy: 'iron_fortress',
  phaseStrategy: { early: 'gather', mid: 'farm', late: 'fight' },
};

const SPEEDSTER: BuildPath = {
  id: 'speedster',
  name: 'Speedster',
  description: 'Speed > Magnet > XP > Speed Dash → Speedster synergy',
  tomePriority: ['speed', 'magnet', 'xp', 'luck'],
  abilityPriority: ['speed_dash', 'gravity_well', 'venom_aura'],
  targetSynergy: 'speedster',
  phaseStrategy: { early: 'gather', mid: 'gather', late: 'kite' },
};

const VAMPIRE: BuildPath = {
  id: 'vampire',
  name: 'Vampire',
  description: 'Regen > Venom > Mass Drain > Damage → Vampire synergy',
  tomePriority: ['regen', 'damage', 'armor', 'cursed'],
  abilityPriority: ['venom_aura', 'mass_drain', 'shield_burst'],
  targetSynergy: 'vampire',
  phaseStrategy: { early: 'farm', mid: 'fight', late: 'fight' },
};

const SCHOLAR: BuildPath = {
  id: 'scholar',
  name: 'Scholar',
  description: 'XP > Luck > Magnet → Holy Trinity synergy',
  tomePriority: ['xp', 'luck', 'magnet', 'cursed'],
  abilityPriority: ['gravity_well', 'speed_dash', 'shield_burst'],
  targetSynergy: 'holy_trinity',
  phaseStrategy: { early: 'gather', mid: 'farm', late: 'camp' },
};

/** 모든 프리셋 빌드 패스 */
export const PRESET_BUILD_PATHS: Record<string, BuildPath> = {
  berserker: BERSERKER,
  tank: TANK,
  speedster: SPEEDSTER,
  vampire: VAMPIRE,
  scholar: SCHOLAR,
};

/** 빌드 패스 ID 목록 */
export const BUILD_PATH_IDS = Object.keys(PRESET_BUILD_PATHS);

// ─── 업그레이드 선택 로직 ───

/**
 * 빌드 패스와 게임 상태를 고려해 최적의 업그레이드 선택
 *
 * 선택 알고리즘:
 * 1. bannedUpgrades 제외
 * 2. alwaysPick이 있으면 최우선
 * 3. 빌드 패스 우선순위에 따라 점수 계산
 * 4. 게임 컨텍스트 가중치 적용
 */
export function chooseBestUpgrade(
  choices: UpgradeChoice[],
  buildPath: BuildPath,
  currentBuild: PlayerBuild,
  gameContext: GameContext,
  options?: {
    bannedUpgrades?: string[];
    alwaysPick?: string[];
  },
): UpgradeChoice {
  const banned = new Set(options?.bannedUpgrades ?? []);
  const always = new Set(options?.alwaysPick ?? []);

  // 금지된 업그레이드 필터링
  let filtered = choices.filter(c => {
    const key = c.tomeType || c.abilityType || '';
    return !banned.has(key);
  });

  // 모두 금지되면 원본 반환
  if (filtered.length === 0) filtered = choices;

  // alwaysPick 체크
  for (const c of filtered) {
    const key = c.tomeType || c.abilityType || '';
    if (always.has(key)) return c;
  }

  // 점수 기반 선택
  let bestChoice = filtered[0];
  let bestScore = -Infinity;

  for (const choice of filtered) {
    let score = 0;

    if (choice.type === 'tome' && choice.tomeType) {
      // 빌드 패스 톰 우선순위 점수
      const idx = buildPath.tomePriority.indexOf(choice.tomeType as TomeType);
      if (idx >= 0) {
        score += (buildPath.tomePriority.length - idx) * 10;
      }

      // 스택 보너스: 이미 높은 스택이면 시너지 달성에 유리
      const currentStacks = currentBuild.tomes[choice.tomeType as TomeType] || 0;
      if (currentStacks >= 2) score += 5;  // 스택이 쌓이면 더 높은 가치
    }

    if (choice.type === 'ability' && choice.abilityType) {
      // 빌드 패스 어빌리티 우선순위 점수
      const idx = buildPath.abilityPriority.indexOf(choice.abilityType as AbilityType);
      if (idx >= 0) {
        score += (buildPath.abilityPriority.length - idx) * 8;
      }

      // 이미 보유한 어빌리티 레벨업은 신규보다 약간 높은 가치
      const existing = currentBuild.abilities.find(
        a => a.type === choice.abilityType,
      );
      if (existing) {
        score += 3; // 레벨업 보너스
      }
    }

    // 게임 컨텍스트 가중치
    const timeRatio = gameContext.timeRemaining / gameContext.roundDuration;

    // 초반(early): XP/Magnet 가중치 업
    if (timeRatio > 0.6) {
      if (choice.tomeType === 'xp') score += 4;
      if (choice.tomeType === 'magnet') score += 3;
      if (choice.tomeType === 'speed') score += 2;
    }

    // 후반(late): 전투 관련 가중치 업
    if (timeRatio < 0.3) {
      if (choice.tomeType === 'damage') score += 4;
      if (choice.tomeType === 'armor') score += 3;
      if (choice.abilityType === 'shield_burst') score += 3;
    }

    // 위협이 많으면 방어 가중치
    if (gameContext.nearbyThreats >= 2) {
      if (choice.tomeType === 'armor') score += 5;
      if (choice.tomeType === 'regen') score += 3;
      if (choice.abilityType === 'shield_burst') score += 4;
    }

    // 랭크가 낮으면(뒤처지면) XP/성장 가중치
    if (gameContext.myRank > gameContext.totalPlayers * 0.6) {
      if (choice.tomeType === 'xp') score += 3;
      if (choice.tomeType === 'luck') score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestChoice = choice;
    }
  }

  return bestChoice;
}

/**
 * 빌드 패스 이름으로 조회
 * 커스텀 빌드 패스도 지원 (외부에서 전달)
 */
export function getBuildPath(pathId: string): BuildPath | undefined {
  return PRESET_BUILD_PATHS[pathId];
}

/**
 * 커스텀 빌드 패스 생성
 * 트레이닝 프로필에서 사용
 */
export function createCustomBuildPath(
  id: string,
  name: string,
  tomePriority: TomeType[],
  abilityPriority: AbilityType[],
  targetSynergy: string,
): BuildPath {
  return {
    id,
    name,
    description: `Custom: ${tomePriority.slice(0, 3).join(' > ')}`,
    tomePriority,
    abilityPriority,
    targetSynergy,
    phaseStrategy: { early: 'gather', mid: 'farm', late: 'fight' },
  };
}

/**
 * 현재 빌드 상태가 목표 시너지에 얼마나 가까운지 계산 (0~1)
 */
export function calcSynergyProgress(
  build: PlayerBuild,
  _targetSynergy: string,
  buildPath: BuildPath,
): number {
  // 빌드 패스의 톰 우선순위 기준으로 진행률 계산
  let totalNeeded = 0;
  let totalAcquired = 0;

  for (const tome of buildPath.tomePriority) {
    const needed = 3; // 시너지 달성에 필요한 평균 스택
    totalNeeded += needed;
    totalAcquired += Math.min(build.tomes[tome] || 0, needed);
  }

  for (const ability of buildPath.abilityPriority.slice(0, 2)) {
    totalNeeded += 1;
    const has = build.abilities.some(a => a.type === ability) ? 1 : 0;
    totalAcquired += has;
  }

  return totalNeeded > 0 ? totalAcquired / totalNeeded : 0;
}
