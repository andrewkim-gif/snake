/**
 * arena-agents.config.ts - Arena Mode AI Agent Identity & Behavior
 *
 * Arena 배틀로얄 모드의 AI 에이전트 아이덴티티, 성격, 대사 설정
 * (터렛 시스템의 agents.config.ts와 별도)
 */

import { PlayerClass, AIPersonality, WeaponType } from '../types';

/**
 * 에이전트 아이덴티티 정의
 */
export interface ArenaAgentIdentity {
  displayName: string;       // 영문 표시 이름
  displayNameKo: string;     // 한국어 표시 이름
  title: string;             // 칭호 (예: "The One", "The Oracle")
  personality: AIPersonality;
  chatStyle: 'formal' | 'casual' | 'aggressive' | 'mysterious';
  color: string;             // 이름표 색상
  catchphrases: string[];    // 자주 쓰는 말 (폴백용)
}

// ============================================
// v37 Phase 8: AI 에이전트 전투/경제 성향
// ============================================

/** 전투/경제 성향 비율 (합계 1.0) */
export interface AgentCombatEconomyTraits {
  /** 공격 성향 비율 (0~1) — 공격적 무기/킬 추구 */
  attackRatio: number;
  /** 방어 성향 비율 (0~1) — 생존/방어 무기 선호 */
  defenseRatio: number;
  /** 경제 성향 비율 (0~1) — Gold 수집, 경제 패시브 선호 */
  economyRatio: number;
  /** 선호 무기 목록 (레벨업 시 우선 선택) */
  preferredWeapons: WeaponType[];
  /** 상점 이용 성향 */
  shopBehavior: AgentShopBehavior;
  /** Gold 임계값 — 이 이상 모이면 상점 이용 */
  shopGoldThreshold: number;
}

/** AI 에이전트 상점 이용 행동 */
export type AgentShopBehavior =
  | 'aggressive_buyer'   // 공격력 아이템 우선 구매
  | 'defensive_buyer'    // HP/실드 아이템 우선 구매
  | 'economy_investor'   // 경제 투자 아이템 우선 구매
  | 'balanced_buyer'     // 상황에 따라 균형 구매
  | 'hoarder';           // Gold를 모으고 잘 안 씀

/**
 * 9개 PlayerClass별 전투/경제 성향 설정
 * 기획서 6.4 AI 에이전트 개성 강화 참조
 */
export const AGENT_COMBAT_TRAITS: Record<PlayerClass, AgentCombatEconomyTraits> = {
  neo: {
    attackRatio: 0.4,
    defenseRatio: 0.3,
    economyRatio: 0.3,
    preferredWeapons: ['knife', 'wand'],
    shopBehavior: 'balanced_buyer',
    shopGoldThreshold: 1500,
  },
  trinity: {
    attackRatio: 0.6,
    defenseRatio: 0.15,
    economyRatio: 0.25,
    preferredWeapons: ['bow', 'shard'],
    shopBehavior: 'aggressive_buyer',
    shopGoldThreshold: 800,
  },
  morpheus: {
    attackRatio: 0.3,
    defenseRatio: 0.3,
    economyRatio: 0.4,
    preferredWeapons: ['lightning', 'bridge'],
    shopBehavior: 'economy_investor',
    shopGoldThreshold: 1200,
  },
  tank: {
    attackRatio: 0.2,
    defenseRatio: 0.6,
    economyRatio: 0.2,
    preferredWeapons: ['garlic', 'stablecoin'],
    shopBehavior: 'defensive_buyer',
    shopGoldThreshold: 1000,
  },
  cypher: {
    attackRatio: 0.15,
    defenseRatio: 0.25,
    economyRatio: 0.6,
    preferredWeapons: ['aggregator', 'gold_reward'],
    shopBehavior: 'hoarder',
    shopGoldThreshold: 3000,
  },
  niobe: {
    attackRatio: 0.7,
    defenseRatio: 0.1,
    economyRatio: 0.2,
    preferredWeapons: ['beam', 'airdrop'],
    shopBehavior: 'aggressive_buyer',
    shopGoldThreshold: 600,
  },
  oracle: {
    attackRatio: 0.2,
    defenseRatio: 0.4,
    economyRatio: 0.4,
    preferredWeapons: ['oracle', 'focus'],
    shopBehavior: 'economy_investor',
    shopGoldThreshold: 2000,
  },
  mouse: {
    attackRatio: 0.25,
    defenseRatio: 0.25,
    economyRatio: 0.5,
    preferredWeapons: ['bridge', 'ping'],
    shopBehavior: 'economy_investor',
    shopGoldThreshold: 1500,
  },
  dozer: {
    attackRatio: 0.2,
    defenseRatio: 0.5,
    economyRatio: 0.3,
    preferredWeapons: ['pool', 'bible'],
    shopBehavior: 'defensive_buyer',
    shopGoldThreshold: 1200,
  },
};

/**
 * 에이전트의 전투/경제 성향 가져오기
 */
export function getAgentCombatTraits(playerClass: PlayerClass): AgentCombatEconomyTraits {
  return AGENT_COMBAT_TRAITS[playerClass];
}

/**
 * AI 에이전트의 상점 구매 결정 — 현재 Gold와 성향에 따라 구매 아이템 ID 반환
 * @returns 구매할 아이템 ID 또는 null (구매 안 함)
 */
export function decideShopPurchase(
  playerClass: PlayerClass,
  currentGold: number,
  _matchTimeSeconds: number,
): string | null {
  const traits = AGENT_COMBAT_TRAITS[playerClass];
  if (currentGold < traits.shopGoldThreshold) return null;

  // 간단한 확률 기반 결정
  const roll = Math.random();

  switch (traits.shopBehavior) {
    case 'aggressive_buyer':
      if (roll < 0.5) return 'stat_dmg';
      if (roll < 0.8) return 'stat_spd';
      return 'con_hp';

    case 'defensive_buyer':
      if (roll < 0.5) return 'con_hp';
      if (roll < 0.8) return 'con_shield';
      return 'stat_spd';

    case 'economy_investor':
      if (roll < 0.5) return 'inv_gold_boost';
      if (roll < 0.8) return 'stat_dmg';
      return 'con_hp';

    case 'balanced_buyer':
      if (roll < 0.33) return 'stat_dmg';
      if (roll < 0.66) return 'con_hp';
      return 'inv_gold_boost';

    case 'hoarder':
      // 거의 안 삼 — 30% 확률로 HP 키트만
      if (roll < 0.3) return 'con_hp';
      return null;

    default:
      return null;
  }
}

/**
 * Matrix 테마 에이전트 이름 및 성격
 */
export const ARENA_AGENT_IDENTITIES: Record<PlayerClass, ArenaAgentIdentity> = {
  neo: {
    displayName: 'Neo',
    displayNameKo: '네오',
    title: 'The One',
    personality: 'balanced',
    chatStyle: 'casual',
    color: '#00FF41',
    catchphrases: [
      'I know kung fu.',
      'There is no spoon.',
      'Whoa.',
      "I'm beginning to believe.",
      'The Matrix has you.',
    ],
  },
  trinity: {
    displayName: 'Trinity',
    displayNameKo: '트리니티',
    title: 'The Hacker',
    personality: 'aggressive',
    chatStyle: 'formal',
    color: '#3b82f6',
    catchphrases: [
      'Dodge this.',
      'The answer is out there.',
      'Get up, Neo.',
      'No one has ever done this before.',
      'I cracked the database.',
    ],
  },
  morpheus: {
    displayName: 'Morpheus',
    displayNameKo: '모피어스',
    title: 'The Captain',
    personality: 'balanced',
    chatStyle: 'formal',
    color: '#a855f7',
    catchphrases: [
      'Free your mind.',
      'Welcome to the real world.',
      'I can only show you the door.',
      'What is real?',
      'He is the one.',
    ],
  },
  tank: {
    displayName: 'Tank',
    displayNameKo: '탱크',
    title: 'The Operator',
    personality: 'defensive',
    chatStyle: 'casual',
    color: '#f97316',
    catchphrases: [
      "I got your back.",
      'Loading...',
      "That's a lot of guns.",
      'Stay frosty.',
      'Operator standing by.',
    ],
  },
  cypher: {
    displayName: 'Cypher',
    displayNameKo: '사이퍼',
    title: 'The Traitor',
    personality: 'collector',
    chatStyle: 'mysterious',
    color: '#dc2626',
    catchphrases: [
      'Ignorance is bliss.',
      'Why oh why...',
      'I want to remember nothing.',
      'The steak tastes so good.',
      "You know what I've realized?",
    ],
  },
  niobe: {
    displayName: 'Niobe',
    displayNameKo: '니오베',
    title: 'The Pilot',
    personality: 'aggressive',
    chatStyle: 'aggressive',
    color: '#06b6d4',
    catchphrases: [
      'Lock and load.',
      "I don't believe in fate.",
      'Hold on tight.',
      'Taking evasive action.',
      "Let's do this.",
    ],
  },
  oracle: {
    displayName: 'Oracle',
    displayNameKo: '오라클',
    title: 'The Seer',
    personality: 'defensive',
    chatStyle: 'mysterious',
    color: '#facc15',
    catchphrases: [
      'You already know the answer.',
      "You didn't come here to make a choice.",
      'Everything that has a beginning...',
      'Would you like a cookie?',
      'The path of the One is made by the One.',
    ],
  },
  mouse: {
    displayName: 'Mouse',
    displayNameKo: '마우스',
    title: 'The Programmer',
    personality: 'collector',
    chatStyle: 'casual',
    color: '#22c55e',
    catchphrases: [
      'I designed her.',
      'Did you like the woman in the red dress?',
      'Pay attention!',
      "It's the digital pimp.",
      'Anyone want some tasty wheat?',
    ],
  },
  dozer: {
    displayName: 'Dozer',
    displayNameKo: '도저',
    title: 'The Engineer',
    personality: 'defensive',
    chatStyle: 'casual',
    color: '#78716c',
    catchphrases: [
      'On it.',
      'Systems online.',
      'Ready when you are.',
      'Holding position.',
      "Tank's my little brother.",
    ],
  },
};

/**
 * AI 성격별 행동 가중치
 */
export interface PersonalityWeights {
  attackWeight: number;      // 공격 우선순위 (0-1)
  defenseWeight: number;     // 방어/회피 우선순위 (0-1)
  collectWeight: number;     // 아이템 수집 우선순위 (0-1)
  agentTargetWeight: number; // 다른 에이전트 타겟 우선순위 (0-1)
  monsterTargetWeight: number; // 몬스터 타겟 우선순위 (0-1)
  chatFrequency: number;     // 채팅 빈도 (0-1)
}

export const PERSONALITY_WEIGHTS: Record<AIPersonality, PersonalityWeights> = {
  aggressive: {
    attackWeight: 0.9,
    defenseWeight: 0.2,
    collectWeight: 0.3,
    agentTargetWeight: 0.8,
    monsterTargetWeight: 0.6,
    chatFrequency: 0.7,
  },
  defensive: {
    attackWeight: 0.5,
    defenseWeight: 0.9,
    collectWeight: 0.6,
    agentTargetWeight: 0.3,
    monsterTargetWeight: 0.7,
    chatFrequency: 0.4,
  },
  balanced: {
    attackWeight: 0.7,
    defenseWeight: 0.6,
    collectWeight: 0.5,
    agentTargetWeight: 0.5,
    monsterTargetWeight: 0.7,
    chatFrequency: 0.5,
  },
  collector: {
    attackWeight: 0.4,
    defenseWeight: 0.5,
    collectWeight: 0.9,
    agentTargetWeight: 0.2,
    monsterTargetWeight: 0.8,
    chatFrequency: 0.3,
  },
  assassin: {
    attackWeight: 0.95,
    defenseWeight: 0.1,
    collectWeight: 0.2,
    agentTargetWeight: 0.95,
    monsterTargetWeight: 0.3,
    chatFrequency: 0.6,
  },
  support: {
    attackWeight: 0.3,
    defenseWeight: 0.8,
    collectWeight: 0.7,
    agentTargetWeight: 0.2,
    monsterTargetWeight: 0.6,
    chatFrequency: 0.8,
  },
};

/**
 * 채팅 트리거 타입
 */
export type ChatTrigger =
  | 'spawn'          // 스폰 시
  | 'kill_agent'     // 다른 에이전트 처치
  | 'kill_monster'   // 몬스터 처치 (연속킬)
  | 'death'          // 사망 시
  | 'low_health'     // 체력 20% 이하
  | 'level_up'       // 레벨업
  | 'taunt'          // 도발 (가끔)
  | 'observation'    // 관찰 (주변 상황)
  | 'victory'        // 승리
  | 'defeat';        // 패배

/**
 * 트리거별 폴백 메시지 (API 실패 시 사용)
 * v8.1.6: 더 다양하고 긴 메시지 (8-10개씩)
 */
export const FALLBACK_MESSAGES: Record<ChatTrigger, string[]> = {
  spawn: [
    'Jacking in. Ready for action.',
    "Let's see what the Matrix has for me today.",
    'Entering combat zone. Stay sharp.',
    'I was born ready for this fight.',
    'Time to show them what I can do.',
    'Another day, another battle to win.',
    'The simulation begins now.',
    'Booting up combat protocols.',
  ],
  kill_agent: [
    'Target eliminated. Who is next?',
    'One down, many more to go.',
    "That's how a real operator fights.",
    'Too slow. You need to move faster.',
    'You should have dodged that one.',
    'Your code has been terminated.',
    'Another one bites the digital dust.',
    'Better luck in your next respawn.',
  ],
  kill_monster: [
    'Easy target. Keep them coming.',
    'These bugs are no match for me.',
    'Clearing the area of hostiles.',
    'Just another glitch in the system.',
    'My algorithms are too fast for you.',
    'Debugging complete.',
  ],
  death: [
    'I will be back stronger than before.',
    'Not like this... not like this...',
    'Respawning in 3... 2... 1...',
    'Good fight. You got me this time.',
    'My code needs some optimization.',
    'This is only a temporary setback.',
    'You win this round, but not the war.',
    'Rebooting combat systems now.',
  ],
  low_health: [
    'Taking heavy fire! Need to retreat.',
    'Critical damage detected. Careful now.',
    'My shields are almost gone.',
    'Running low on health. Stay focused.',
    'One more hit and I am done for.',
    'Time to play defensive.',
  ],
  level_up: [
    'Power levels increasing rapidly.',
    'Upgraded my combat protocols.',
    'Feeling stronger with each level.',
    'New abilities unlocked and ready.',
    'Evolution in progress.',
    'My potential grows without limits.',
  ],
  taunt: [
    'Is that really all you got? Pathetic.',
    'Come at me if you dare, coward.',
    'You call that an attack? Laughable.',
    'I have seen better moves from bots.',
    'Try harder or go back to training.',
    'Your skills need serious improvement.',
    'Wake me up when you get good.',
    'Even the Oracle predicted your loss.',
    'You are just background noise to me.',
    'My grandmother codes better than you.',
  ],
  observation: [
    'Interesting movement patterns detected.',
    'I see what you are planning over there.',
    'Stay alert, something is not right.',
    'The battlefield is changing rapidly.',
    'Analyzing enemy positions now.',
    'Multiple hostiles in the vicinity.',
    'Scanning for threats in all directions.',
    'The Matrix reveals all to those who see.',
    'Keep your eyes open, danger approaches.',
    'Something big is about to happen here.',
  ],
  victory: [
    'Victory is mine. As it was meant to be.',
    'We did it. The Matrix favors the bold.',
    'Mission complete. Time to celebrate.',
    'The One always prevails in the end.',
    'All opponents have been neutralized.',
    'This is what peak performance looks like.',
  ],
  defeat: [
    'Not this time, but I will return.',
    'We will return stronger than before.',
    'Next time the outcome will differ.',
    'The fight continues in another round.',
    'Defeat is just another form of learning.',
    'Analyzing mistakes for next encounter.',
  ],
};

/**
 * 에이전트 이름표 설정
 */
export const NAMEPLATE_CONFIG = {
  fontSize: 12,
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: 4,
  borderRadius: 4,
  // v8.1.1: screenY는 이미 spriteHeadY (머리 위치)로 전달됨
  // 이름표는 체력바 아래, 머리 위에 표시 (체력바: -10, 이름표: +5)
  offsetY: 5,
};

/**
 * 채팅 버블 설정
 */
export const CHAT_BUBBLE_CONFIG = {
  maxWidth: 200,
  fontSize: 11,
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  textColor: '#00FF41',
  borderColor: '#00FF41',
  padding: 8,
  borderRadius: 8,
  // v8.1.3: 채팅 버블은 체력바(screenY-10) 위에 표시
  // 버블이 아래로 그려지므로, 버블 하단이 체력바 위에 와야 함
  // offsetY = -10 (체력바) - bubbleHeight(~35) - gap(5) = -50
  offsetY: -50,
  displayDuration: 3000, // 3초 표시
  fadeOutDuration: 500,  // 0.5초 페이드아웃
};

/**
 * 에이전트 식별자로 아이덴티티 가져오기
 */
export function getArenaAgentIdentity(agentId: string): ArenaAgentIdentity | null {
  // agentId 형식: 'agent_neo', 'agent_trinity_0' 등
  const match = agentId.match(/^agent_(\w+)/);
  if (!match) return null;

  const className = match[1] as PlayerClass;
  return ARENA_AGENT_IDENTITIES[className] || null;
}

/**
 * 에이전트 표시 이름 가져오기
 */
export function getArenaAgentDisplayName(agentId: string, useKorean = false): string {
  const identity = getArenaAgentIdentity(agentId);
  if (!identity) return agentId;
  return useKorean ? identity.displayNameKo : identity.displayName;
}

/**
 * 랜덤 폴백 메시지 가져오기
 */
export function getRandomFallbackMessage(
  agentId: string,
  trigger: ChatTrigger
): string {
  const identity = getArenaAgentIdentity(agentId);

  // 캐릭터 고유 대사 우선 (50% 확률)
  if (identity && Math.random() < 0.5) {
    const catchphrases = identity.catchphrases;
    return catchphrases[Math.floor(Math.random() * catchphrases.length)];
  }

  // 트리거별 폴백 메시지
  const messages = FALLBACK_MESSAGES[trigger];
  return messages[Math.floor(Math.random() * messages.length)];
}
