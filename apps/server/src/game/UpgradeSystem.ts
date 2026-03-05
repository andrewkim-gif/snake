/**
 * Upgrade System — v10 레벨업 업그레이드 선택지 생성 + 적용
 * Tome 스택 + Ability 슬롯 + 시너지 체크
 */

import type {
  PlayerBuild, TomeType, AbilityType, UpgradeChoice, SynergyDef,
} from '@snake-arena/shared';
import {
  TOME_DEFS, ABILITY_DEFS, ALL_SYNERGIES, UPGRADE_CONFIG,
} from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';

const ALL_TOME_TYPES: TomeType[] = ['xp', 'speed', 'damage', 'armor', 'magnet', 'luck', 'regen', 'cursed'];
const ALL_ABILITY_TYPES: AbilityType[] = ['venom_aura', 'shield_burst', 'lightning_strike', 'speed_dash', 'mass_drain', 'gravity_well'];

/** 레벨업 시 3개 랜덤 업그레이드 선택지 생성 */
export function generateUpgradeChoices(agent: AgentEntity): UpgradeChoice[] {
  const build = agent.data.build;
  const choices: UpgradeChoice[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < UPGRADE_CONFIG.CHOICES_PER_LEVEL; i++) {
    const isAbility = Math.random() < UPGRADE_CONFIG.ABILITY_OFFER_CHANCE;

    let choice: UpgradeChoice | null = null;

    if (isAbility) {
      choice = generateAbilityChoice(build, usedIds);
    }

    // Ability 생성 실패 시 또는 Tome이 선택된 경우
    if (!choice) {
      choice = generateTomeChoice(build, usedIds);
    }

    if (choice) {
      choices.push(choice);
      usedIds.add(choice.id);
    }
  }

  return choices;
}

function generateTomeChoice(build: PlayerBuild, usedIds: Set<string>): UpgradeChoice | null {
  // 스택 가능한 Tome 필터링
  const available = ALL_TOME_TYPES.filter(t => {
    const def = TOME_DEFS[t];
    return build.tomes[t] < def.maxStacks && !usedIds.has(`tome_${t}`);
  });

  if (available.length === 0) return null;

  const tomeType = available[Math.floor(Math.random() * available.length)];
  const def = TOME_DEFS[tomeType];

  return {
    id: `tome_${tomeType}`,
    type: 'tome',
    tomeType,
    name: def.name,
    description: def.description,
    currentStacks: build.tomes[tomeType],
  };
}

function generateAbilityChoice(build: PlayerBuild, usedIds: Set<string>): UpgradeChoice | null {
  const currentAbilities = build.abilities;

  // 이미 보유한 Ability 강화 후보
  const upgradeable = currentAbilities.filter(a =>
    a.level < UPGRADE_CONFIG.MAX_ABILITY_LEVEL && !usedIds.has(`ability_${a.type}`)
  );

  // 새 Ability 후보 (슬롯 여유 있을 때)
  const ownedTypes = new Set(currentAbilities.map(a => a.type));
  const newAbilities = ALL_ABILITY_TYPES.filter(t =>
    !ownedTypes.has(t) && !usedIds.has(`ability_${t}`)
  );

  const canAddNew = currentAbilities.length < UPGRADE_CONFIG.MAX_ABILITY_SLOTS;

  // 50/50: 강화 vs 새 Ability (가능한 경우)
  if (upgradeable.length > 0 && (!canAddNew || Math.random() < 0.5)) {
    // 기존 Ability 강화
    const slot = upgradeable[Math.floor(Math.random() * upgradeable.length)];
    const def = ABILITY_DEFS[slot.type];
    return {
      id: `ability_${slot.type}`,
      type: 'ability',
      abilityType: slot.type,
      name: `${def.name} Lv${slot.level + 1}`,
      description: `${def.description} (강화)`,
      currentLevel: slot.level,
    };
  }

  if (canAddNew && newAbilities.length > 0) {
    // 새 Ability 추가
    const abilityType = newAbilities[Math.floor(Math.random() * newAbilities.length)];
    const def = ABILITY_DEFS[abilityType];
    return {
      id: `ability_${abilityType}`,
      type: 'ability',
      abilityType,
      name: def.name,
      description: def.description,
    };
  }

  return null;
}

/** 업그레이드 선택 적용 */
export function applyUpgrade(agent: AgentEntity, choiceId: string): boolean {
  const choices = agent.data.pendingUpgradeChoices;
  if (!choices) return false;

  const choice = choices.find(c => c.id === choiceId);
  if (!choice) return false;

  const build = agent.data.build;

  if (choice.type === 'tome' && choice.tomeType) {
    const def = TOME_DEFS[choice.tomeType];
    if (build.tomes[choice.tomeType] < def.maxStacks) {
      build.tomes[choice.tomeType]++;
    }
  } else if (choice.type === 'ability' && choice.abilityType) {
    const existing = build.abilities.find(a => a.type === choice.abilityType);
    if (existing) {
      // 강화
      if (existing.level < UPGRADE_CONFIG.MAX_ABILITY_LEVEL) {
        existing.level++;
      }
    } else if (build.abilities.length < UPGRADE_CONFIG.MAX_ABILITY_SLOTS) {
      // 새 Ability 추가
      build.abilities.push({
        type: choice.abilityType,
        level: 1,
        cooldownUntil: 0,
      });
    }
  }

  // 선택 완료 → 대기 상태 클리어
  agent.data.pendingUpgradeChoices = null;
  agent.data.upgradeDeadlineTick = 0;

  return true;
}

/** 랜덤 업그레이드 선택 (타임아웃) */
export function applyRandomUpgrade(agent: AgentEntity): void {
  const choices = agent.data.pendingUpgradeChoices;
  if (!choices || choices.length === 0) return;

  const randomChoice = choices[Math.floor(Math.random() * choices.length)];
  applyUpgrade(agent, randomChoice.id);
}

/** 시너지 체크 — 현재 빌드에서 발동 가능한 시너지 반환 */
export function checkSynergies(build: PlayerBuild): SynergyDef[] {
  return ALL_SYNERGIES.filter(synergy => meetsSynergyRequirements(build, synergy));
}

function meetsSynergyRequirements(build: PlayerBuild, synergy: SynergyDef): boolean {
  const { tomes, abilities } = synergy.requirements;

  // Tome 요구 사항 체크
  if (tomes) {
    for (const [tomeType, minStacks] of Object.entries(tomes)) {
      if ((build.tomes[tomeType as TomeType] || 0) < (minStacks as number)) {
        return false;
      }
    }
  }

  // Ability 요구 사항 체크
  if (abilities) {
    for (const [abilityType, minLevel] of Object.entries(abilities)) {
      const slot = build.abilities.find(a => a.type === abilityType as AbilityType);
      if (!slot || slot.level < (minLevel as number)) {
        return false;
      }
    }
  }

  return true;
}

/** 봇 빌드 패스 기반 자동 선택 */
export function botChooseUpgrade(
  agent: AgentEntity,
  tomePriority: TomeType[],
  abilityPriority: AbilityType[],
): void {
  const choices = agent.data.pendingUpgradeChoices;
  if (!choices || choices.length === 0) return;

  // 우선순위에 따라 선택
  for (const pref of tomePriority) {
    const match = choices.find(c => c.type === 'tome' && c.tomeType === pref);
    if (match) {
      applyUpgrade(agent, match.id);
      return;
    }
  }

  for (const pref of abilityPriority) {
    const match = choices.find(c => c.type === 'ability' && c.abilityType === pref);
    if (match) {
      applyUpgrade(agent, match.id);
      return;
    }
  }

  // 우선순위에 없으면 랜덤
  applyRandomUpgrade(agent);
}
