/**
 * weapons.config.ts - AI SURVIVOR 무기 설정
 * AI vs Programmer - 개발자 스킬/무기 정의
 *
 * Ported from app_ingame/config/weapons.config.ts
 */

import { WeaponType, WeaponStats } from '../types';

// --- WEAPON BALANCING (SLOW START → FAST ENDGAME) ---
// 초반: 느린 연사 + 낮은 데미지 → 후반: 빠른 연사 + 높은 데미지
const generateTieredProgression = (
  base: WeaponStats,
  ultimateBase: Partial<WeaponStats>,
  ultimateName: string
): WeaponStats[] => {
  const levels: WeaponStats[] = [];
  let current = { ...base };

  // Lv 1-10: 기본 성장
  const baseCooldown = base.cooldown;
  for (let i = 1; i <= 10; i++) {
    if (i > 1) {
      const upgrade = { ...current, level: i };
      upgrade.damage = Math.floor(current.damage * 1.20);
      upgrade.area = Math.floor(current.area * 1.08);
      const minCooldown = baseCooldown * 0.5;
      upgrade.cooldown = Math.max(minCooldown, current.cooldown * 0.95);
      if (i % 3 === 0) {
        upgrade.amount = current.amount + 1;
      }
      current = upgrade;
    }
    levels.push(current);
  }

  // Lv 11: 진화 (대폭 강화)
  const evolvedStats: WeaponStats = {
    ...current,
    ...ultimateBase,
    level: 11,
    damage: Math.max(ultimateBase.damage || 0, Math.floor(current.damage * 1.8)),
    area: Math.floor(current.area * 1.15),
    cooldown: Math.max(baseCooldown * 0.4, current.cooldown * 0.85),
    isEvolved: true,
    evolvedName: ultimateName
  };
  levels.push(evolvedStats);
  current = evolvedStats;

  // Lv 12-19: 후반 성장
  for (let i = 12; i <= 19; i++) {
    const upgrade = { ...current, level: i };
    upgrade.damage = Math.floor(current.damage * 1.12);
    upgrade.area = Math.floor(current.area * 1.05);
    const minCooldown = baseCooldown * 0.35;
    upgrade.cooldown = Math.max(minCooldown, current.cooldown * 0.97);
    if (i % 3 === 0) upgrade.amount += 1;
    current = upgrade;
    levels.push(current);
  }

  // Lv 20: 궁극 (폭발적 성장)
  const ultimateStats: WeaponStats = {
    ...current,
    level: 20,
    damage: Math.floor(current.damage * 3.0),
    cooldown: Math.max(baseCooldown * 0.3, current.cooldown * 0.9),
    area: Math.floor(current.area * 1.3),
    amount: current.amount + 5,
    isUltimate: true,
    evolvedName: `최강 ${ultimateName}`
  };
  levels.push(ultimateStats);

  return levels;
};

// Base Stats (Level 1)
// === 근접/오라 무기 ===
const BASE_WHIP: WeaponStats = { level: 1, damage: 25, area: 40, speed: 0, duration: 0.26, cooldown: 1.2, amount: 1, pierce: 999, knockback: 35 };
const BASE_PUNCH: WeaponStats = { level: 1, damage: 50, area: 10, speed: 0, duration: 0.25, cooldown: 1.0, amount: 1, pierce: 999, knockback: 60 };
const BASE_BIBLE: WeaponStats = { level: 1, damage: 15, area: 8, speed: 5, duration: 5, cooldown: 4.0, amount: 1, pierce: 999, knockback: 20 };
const BASE_GARLIC: WeaponStats = { level: 1, damage: 8, area: 54, speed: 0, duration: 0.5, cooldown: 0.8, amount: 1, pierce: 999, knockback: 5 };
const BASE_POOL: WeaponStats = { level: 1, damage: 25, area: 30, speed: 0, duration: 4, cooldown: 6.0, amount: 1, pierce: 999, knockback: 0 };

// === 원거리 투사체 ===
const BASE_WAND: WeaponStats = { level: 1, damage: 8, area: 4, speed: 450, duration: 3, cooldown: 1.0, amount: 1, pierce: 1, knockback: 8 };
const BASE_KNIFE: WeaponStats = { level: 1, damage: 8, area: 3, speed: 500, duration: 2, cooldown: 0.7, amount: 1, pierce: 1, knockback: 5 };
const BASE_AXE: WeaponStats = { level: 1, damage: 50, area: 8, speed: 350, duration: 2.5, cooldown: 2.0, amount: 1, pierce: 999, knockback: 25 };
const BASE_BOW: WeaponStats = { level: 1, damage: 7, area: 3, speed: 600, duration: 3, cooldown: 1.2, amount: 1, pierce: 3, knockback: 8 };

// === 특수 원거리 ===
const BASE_PING: WeaponStats = { level: 1, damage: 6, area: 5, speed: 500, duration: 2.5, cooldown: 2.0, amount: 1, pierce: 3, knockback: 5 };
const BASE_SHARD: WeaponStats = { level: 1, damage: 5, area: 4, speed: 400, duration: 3, cooldown: 1.5, amount: 1, pierce: 1, knockback: 5 };
const BASE_FORK: WeaponStats = { level: 1, damage: 5, area: 4, speed: 350, duration: 2.5, cooldown: 2.0, amount: 1, pierce: 2, knockback: 8 };
const BASE_BRIDGE: WeaponStats = { level: 1, damage: 4, area: 5, speed: 400, duration: 3.5, cooldown: 3.5, amount: 1, pierce: 4, knockback: 0 };

// === 특수 스킬 ===
const BASE_LIGHTNING: WeaponStats = { level: 1, damage: 150, area: 15, speed: 0, duration: 0.2, cooldown: 2.0, amount: 1, pierce: 1, knockback: 10 };
const BASE_BEAM: WeaponStats = { level: 1, damage: 35, area: 8, speed: 0, duration: 1.8, cooldown: 9, amount: 1, pierce: 999, knockback: 40 };
const BASE_LASER: WeaponStats = { level: 1, damage: 40, area: 80, speed: 0, duration: 0.8, cooldown: 3.5, amount: 18, pierce: 999, knockback: 15 };
const BASE_PHISHING: WeaponStats = { level: 1, damage: 5000, area: 999, speed: 0, duration: 0.5, cooldown: 90, amount: 1, pierce: 999, knockback: 100 };
const BASE_STABLECOIN: WeaponStats = { level: 1, damage: 0, area: 0, speed: 0, duration: 6, cooldown: 30, amount: 1, pierce: 0, knockback: 0 };
const BASE_AGGREGATOR: WeaponStats = { level: 1, damage: 0, area: 50, speed: 0, duration: 0, cooldown: 0, amount: 0, pierce: 0, knockback: 0 };
const BASE_ORACLE: WeaponStats = { level: 1, damage: 0, area: 0, speed: 0, duration: 0, cooldown: 0, amount: 25, pierce: 0, knockback: 0 };
const BASE_AIRDROP: WeaponStats = { level: 1, damage: 50, area: 12, speed: 0, duration: 0.6, cooldown: 4.0, amount: 3, pierce: 999, knockback: 40 };
const BASE_GENESIS: WeaponStats = { level: 1, damage: 150, area: 25, speed: 0, duration: 0.8, cooldown: 12.0, amount: 1, pierce: 999, knockback: 60 };

// focus: 집중력 훈련 (패시브 - 크리티컬 확률 증가)
const generateFocusProgression = (): WeaponStats[] => {
  const levels: WeaponStats[] = [];
  const baseStats = { level: 1, damage: 0, area: 0, speed: 0, duration: 0, cooldown: 0, amount: 50, pierce: 0, knockback: 0 };

  for (let i = 1; i <= 10; i++) {
    const amount = Math.floor(50 + (i - 1) * 16.67);
    levels.push({ ...baseStats, level: i, amount });
  }

  levels.push({
    ...baseStats, level: 11, amount: 250,
    isEvolved: true, evolvedName: "극한 집중"
  });

  for (let i = 12; i <= 19; i++) {
    const amount = Math.floor(250 + (i - 11) * 10);
    levels.push({
      ...baseStats, level: i, amount,
      isEvolved: true, evolvedName: "극한 집중"
    });
  }

  levels.push({
    ...baseStats, level: 20, amount: 350,
    isUltimate: true, evolvedName: "최강 극한 집중"
  });

  return levels;
};

// overclock: 이동속도 증가 (패시브)
const generateOverclockProgression = (): WeaponStats[] => {
  const levels: WeaponStats[] = [];
  const baseStats = { level: 1, damage: 0, area: 0, speed: 0, duration: 0, cooldown: 0, amount: 100, pierce: 0, knockback: 0 };

  for (let i = 1; i <= 10; i++) {
    const amount = Math.floor(100 + (i - 1) * 37.78);
    levels.push({ ...baseStats, level: i, amount });
  }

  levels.push({
    ...baseStats, level: 11, amount: 560,
    isEvolved: true, evolvedName: "터보 오버클럭"
  });

  for (let i = 12; i <= 19; i++) {
    const amount = Math.floor(560 + (i - 11) * 35);
    levels.push({
      ...baseStats, level: i, amount,
      isEvolved: true, evolvedName: "터보 오버클럭"
    });
  }

  levels.push({
    ...baseStats, level: 20, amount: 900,
    isUltimate: true, evolvedName: "극한 오버클럭"
  });

  return levels;
};

// laser: 회전 레이저 프로그레션
const generateLaserProgression = (): WeaponStats[] => {
  const levels: WeaponStats[] = [];
  const baseCooldown = BASE_LASER.cooldown;
  let current = { ...BASE_LASER };

  for (let i = 1; i <= 10; i++) {
    if (i > 1) {
      const upgrade = { ...current, level: i };
      upgrade.damage = Math.floor(current.damage * 1.15);
      upgrade.area = Math.floor(current.area * 1.08);
      upgrade.amount = Math.min(36, current.amount + 1.5);
      upgrade.duration = current.duration + 0.1;
      upgrade.cooldown = Math.max(baseCooldown * 0.5, current.cooldown * 0.97);
      current = upgrade;
    }
    levels.push({ ...current, level: i });
  }

  const evolvedStats: WeaponStats = {
    ...current, level: 11,
    damage: Math.floor(current.damage * 1.8),
    area: Math.floor(current.area * 1.15),
    amount: 36, duration: 2.0,
    cooldown: Math.max(baseCooldown * 0.4, current.cooldown * 0.85),
    isEvolved: true, evolvedName: "사이버 톱날"
  };
  levels.push(evolvedStats);
  current = evolvedStats;

  for (let i = 12; i <= 19; i++) {
    const upgrade = { ...current, level: i };
    upgrade.damage = Math.floor(current.damage * 1.12);
    upgrade.area = Math.floor(current.area * 1.05);
    upgrade.duration = Math.min(3.0, current.duration + 0.05);
    upgrade.cooldown = Math.max(baseCooldown * 0.35, current.cooldown * 0.97);
    current = upgrade;
    levels.push({ ...current, isEvolved: true, evolvedName: "사이버 톱날" });
  }

  const ultimateStats: WeaponStats = {
    ...current, level: 20,
    damage: Math.floor(current.damage * 3.0),
    area: Math.floor(current.area * 1.3),
    amount: 72, duration: 3.0,
    cooldown: Math.max(baseCooldown * 0.3, current.cooldown * 0.9),
    isUltimate: true, evolvedName: "최강 사이버 톱날"
  };
  levels.push(ultimateStats);

  return levels;
};

export const WEAPON_DATA: Partial<Record<WeaponType, {
  name: string;
  desc: string;
  stats: WeaponStats[];
  color: string;
}>> = {
  // === 근접 무기 (Melee) ===
  whip: {
    name: "손코딩", desc: "키보드 없이 허공에 코드를 쓰며 공격합니다.",
    color: "#00FF41",
    stats: generateTieredProgression(BASE_WHIP, { damage: 250, area: 300, cooldown: 0.6 }, "마스터 코딩")
  },
  punch: {
    name: "키보드 펀치", desc: "기계식 키보드로 강력한 펀치를 날립니다.",
    color: "#ef4444",
    stats: generateTieredProgression(BASE_PUNCH, { damage: 600, area: 50, knockback: 120 }, "청축 스매시")
  },
  // === 투사체 무기 (Projectile) ===
  wand: {
    name: "API 호출", desc: "REST API 요청을 발사합니다.",
    color: "#3b82f6",
    stats: generateTieredProgression(BASE_WAND, { damage: 60, cooldown: 0.1 }, "GraphQL 쿼리")
  },
  knife: {
    name: "Git Push", desc: "날카로운 커밋 메시지를 투척합니다.",
    color: "#facc15",
    stats: generateTieredProgression(BASE_KNIFE, { damage: 100, pierce: 999 }, "Force Push")
  },
  axe: {
    name: "서버 던지기", desc: "무거운 서버 랙을 투척합니다.",
    color: "#ef4444",
    stats: generateTieredProgression(BASE_AXE, { damage: 400, area: 100, cooldown: 1.2 }, "데이터센터 투척")
  },
  bow: {
    name: "GraphQL 쿼리", desc: "정밀한 쿼리로 적을 관통합니다.",
    color: "#84cc16",
    stats: generateTieredProgression(BASE_BOW, { damage: 300, pierce: 10 }, "N+1 쿼리 폭격")
  },
  // === 회전/궤도 무기 (Orbital) ===
  bible: {
    name: "문서화", desc: "두꺼운 기술 문서가 주변을 회전합니다.",
    color: "#0ea5e9",
    stats: generateTieredProgression(BASE_BIBLE, { damage: 150, speed: 15, duration: 9999 }, "컨플루언스 오비탈")
  },
  garlic: {
    name: "디버그 오라", desc: "버그 탐지 필드로 주변 적에게 지속 피해를 줍니다.",
    color: "#10b981",
    stats: generateTieredProgression(BASE_GARLIC, { damage: 80, area: 150 }, "프로파일러 필드")
  },
  // === 지역 무기 (Area) ===
  pool: {
    name: "방화벽", desc: "바닥에 방화벽 존을 설치하여 적에게 피해를 줍니다.",
    color: "#06b6d4",
    stats: generateTieredProgression(BASE_POOL, { damage: 150, area: 130, duration: 8 }, "엔터프라이즈 방화벽")
  },
  genesis: {
    name: "시스템 크래시", desc: "거대한 블루스크린 폭발을 일으킵니다.",
    color: "#0066FF",
    stats: generateTieredProgression(BASE_GENESIS, { damage: 1000, area: 125, cooldown: 5.0 }, "커널 패닉")
  },
  // === 빔/레이저 무기 (Beam) ===
  beam: {
    name: "매트릭스 비전", desc: "코드를 꿰뚫어 보는 눈. 적의 약점을 관통하는 녹색 레이저.",
    color: "#00FF41",
    stats: generateTieredProgression(BASE_BEAM, { damage: 350, area: 40 }, "트루 비전")
  },
  laser: {
    name: "재귀 루프", desc: "무한 루프로 주변을 회전하며 적을 베어냅니다.",
    color: "#f43f5e",
    stats: generateLaserProgression()
  },
  // === 특수 무기 (Special) ===
  lightning: {
    name: "Claude 어시스트", desc: "AI 어시스트 낙뢰가 랜덤 적에게 연쇄 공격합니다.",
    color: "#D97706",
    stats: generateTieredProgression(BASE_LIGHTNING, { damage: 600, cooldown: 1.5 }, "Opus 어시스트")
  },
  phishing: {
    name: "MCP 서버", desc: "Model Context Protocol로 화면의 모든 적을 제거합니다.",
    color: "#be123c",
    stats: generateTieredProgression(BASE_PHISHING, { cooldown: 30 }, "MCP 클러스터")
  },
  stablecoin: {
    name: "타입 세이프티", desc: "TypeScript 타입 보호막으로 피해를 막습니다.",
    color: "#3178C6",
    stats: generateTieredProgression(BASE_STABLECOIN, { amount: 8, cooldown: 12 }, "Strict Mode")
  },
  bridge: {
    name: "Async/Await", desc: "비동기 대기로 적을 일시 정지시킵니다.",
    color: "#6366f1",
    stats: generateTieredProgression(BASE_BRIDGE, { area: 100, cooldown: 1.0 }, "Promise.all")
  },
  ping: {
    name: "Ping 패킷", desc: "적들 사이를 튕기며 연쇄 공격합니다.",
    color: "#0ea5e9",
    stats: generateTieredProgression(BASE_PING, { damage: 200, pierce: 8, amount: 3 }, "DDoS 패킷")
  },
  shard: {
    name: "코드 조각", desc: "적 히트 시 3방향으로 분열합니다.",
    color: "#8b5cf6",
    stats: generateTieredProgression(BASE_SHARD, { damage: 180, pierce: 5, amount: 4 }, "스니펫 폭발")
  },
  airdrop: {
    name: "NPM Install", desc: "하늘에서 패키지들이 쏟아집니다.",
    color: "#CB3837",
    stats: generateTieredProgression(BASE_AIRDROP, { damage: 400, area: 40, amount: 8 }, "node_modules 폭격")
  },
  fork: {
    name: "Git Fork", desc: "직진 후 2갈래로 분기합니다.",
    color: "#06b6d4",
    stats: generateTieredProgression(BASE_FORK, { damage: 200, pierce: 6, amount: 3 }, "Merge Conflict")
  },
  // === 패시브/유틸리티 (Passive) ===
  aggregator: {
    name: "Auto Import", desc: "경험치 자동 수집 범위를 증가시킵니다.",
    color: "#ec4899",
    stats: generateTieredProgression(BASE_AGGREGATOR, { area: 400 }, "VSCode 자동완성")
  },
  oracle: {
    name: "코드 리뷰", desc: "행운 수치를 높여 희귀 아이템 확률을 높입니다.",
    color: "#f59e0b",
    stats: generateTieredProgression(BASE_ORACLE, { amount: 500 }, "시니어 리뷰")
  },
  focus: {
    name: "딥워크", desc: "집중력을 높여 크리티컬 확률이 증가합니다.",
    color: "#f472b6",
    stats: generateFocusProgression()
  },
  overclock: {
    name: "오버클럭", desc: "CPU 클럭을 올려 이동속도가 증가합니다.",
    color: "#f97316",
    stats: generateOverclockProgression()
  },
  gold_reward: {
    name: "긴급 보상", desc: "즉시 보상 획득",
    color: "#facc15",
    stats: []
  },
  // Phase 2 추가 무기
  sword: {
    name: "코드 블레이드", desc: "날카로운 코드로 적을 베어냅니다.",
    color: "#10b981",
    stats: generateTieredProgression(
      { level: 1, damage: 30, area: 5, speed: 0, duration: 0.5, cooldown: 1.2, amount: 1, pierce: 1, knockback: 2 },
      { damage: 300, area: 250, cooldown: 0.5 },
      "엑스칼리버"
    )
  },
  crossbow: {
    name: "크로스보우", desc: "십자형 볼트를 발사하여 관통합니다.",
    color: "#6366f1",
    stats: generateTieredProgression(
      { level: 1, damage: 25, area: 4, speed: 500, duration: 2, cooldown: 1.5, amount: 1, pierce: 2, knockback: 1 },
      { damage: 250, pierce: 10, cooldown: 0.6 },
      "발리스타"
    )
  },
};

// 터렛용 무기 분류
export const RANGED_WEAPONS: WeaponType[] = [
  'bow', 'wand', 'knife', 'axe', 'ping', 'shard', 'fork', 'airdrop', 'beam',
];

export const MELEE_WEAPONS: WeaponType[] = [
  'garlic', 'whip', 'punch', 'bible', 'pool', 'laser', 'lightning',
];

export const isRangedWeapon = (weaponType: WeaponType): boolean => {
  return RANGED_WEAPONS.includes(weaponType);
};

export const isMeleeWeapon = (weaponType: WeaponType): boolean => {
  return MELEE_WEAPONS.includes(weaponType);
};
