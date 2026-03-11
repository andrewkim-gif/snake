/**
 * region.ts — v39 팩션 기반 영토 지배 시스템 타입 정의
 *
 * Region, CountryRegions, RegionType, DominanceState, RoundState 등
 * 팩션 영토 전투에 필요한 모든 TypeScript 타입을 정의한다.
 */

// ── 기본 열거 타입 ──

/** 국가 티어 — 지역 수와 아레나 크기 결정 */
export type CountryTier = 'S' | 'A' | 'B' | 'C' | 'D';

/** 7가지 지역 유형 */
export type RegionType =
  | 'capital'      // 수도 — Tech, PvP 데미지 +10%
  | 'industrial'   // 산업 — Minerals, 생산 속도 +15%
  | 'port'         // 항구 — Gold(교역), 교역 수수료 -20%
  | 'agricultural' // 농업 — Food, HP 재생 +10%
  | 'military'     // 군사 — Oil(군수), 방어 +15%
  | 'resource'     // 자원 — Minerals+Oil, 자원 수집량 x1.5
  | 'cultural';    // 문화 — Influence, 외교 영향력 +20%

/** 6종 기본 자원 + 특산 자원 */
export type ResourceType =
  | 'tech'
  | 'minerals'
  | 'gold'
  | 'food'
  | 'oil'
  | 'influence';

/** 지역 아레나 상태 */
export type RegionState = 'idle' | 'pve' | 'br' | 'settling';

/** 라운드 페이즈 (EpochPhase 대체) */
export type RoundPhase = 'pve' | 'br_countdown' | 'br' | 'settlement';

/** BR 서브 페이즈 */
export type BRSubPhase = 'skirmish' | 'engagement' | 'final_battle';

/** 주권 에스컬레이션 레벨 */
export type SovereigntyLevel =
  | 'none'
  | 'active_domination'  // 일일 정산 1회 지배
  | 'sovereignty'        // 3일 연속 지배
  | 'hegemony';          // 14일 연속 지배

/** 환경 바이옴 */
export type BiomeType =
  | 'urban'
  | 'industrial_zone'
  | 'coastal'
  | 'farmland'
  | 'military_base'
  | 'mining'
  | 'cultural_heritage'
  | 'forest'
  | 'desert'
  | 'tundra'
  | 'tropical'
  | 'mountain';

// ── 지역 효과 ──

/** 지역별 PvE/PvP 버프 효과 */
export interface IRegionEffects {
  /** PvP 데미지 배율 (1.1 = +10%) */
  pvpDamageMultiplier: number;
  /** PvE 몹 스폰 속도 배율 (1.0 = 기본) */
  pveSpawnRate: number;
  /** 자원 채취 속도 배율 (1.5 = +50%) */
  resourceGatherRate: number;
  /** HP 재생 보너스 (0.1 = +10%) */
  hpRegenBonus: number;
  /** 방어 보너스 (0.15 = +15%) */
  defenseBonus: number;
  /** 교역 수수료 할인 (0.2 = -20%) */
  tradeDiscount: number;
  /** 외교 영향력 보너스 (0.2 = +20%) */
  diplomacyBonus: number;
}

// ── 지역 정의 (정적 데이터) ──

/** 지역 정의 — 국가별 고유 지역 데이터 */
export interface IRegionDef {
  /** 지역 고유 ID — "KOR_seoul", "USA_dc" 형식 */
  id: string;
  /** 소속 국가 ISO3 코드 */
  countryCode: string;
  /** 지역명 (현지어/한글) */
  name: string;
  /** 지역 영문명 */
  nameEn: string;
  /** 지역 유형 */
  type: RegionType;
  /** 주요 자원 */
  primaryResource: ResourceType;
  /** 특산 자원명 (국가별 고유, 예: "semiconductor") */
  specialtyResource: string;
  /** 환경 바이옴 */
  biome: BiomeType;
  /** 지역 특수 효과 설명 */
  specialEffect: string;
  /** 지역 효과 수치 */
  effects: IRegionEffects;
  /** 아레나 크기 (px, 티어별 차등: S=6000, A=5000, B=4000, C=3000, D=2500) */
  arenaSize: number;
  /** 최대 플레이어 수 */
  maxPlayers: number;
}

/** 국가-지역 매핑 — 국가별 모든 지역 정보 */
export interface ICountryRegions {
  /** ISO3 국가 코드 */
  countryCode: string;
  /** 국가 티어 */
  tier: CountryTier;
  /** 소속 지역 목록 (3~7개) */
  regions: IRegionDef[];
  /** 국가 특산 자원 */
  specialtyResource: string;
  /** 아레나 크기 (티어별 일괄) */
  arenaSize: number;
  /** 최대 플레이어 수 (티어별 일괄) */
  maxPlayers: number;
}

// ── 지배 상태 (런타임) ──

/** 지역 지배 상태 — 실시간 영토 정보 */
export interface IDominanceState {
  /** 지역 ID */
  regionId: string;
  /** 소속 국가 코드 */
  countryCode: string;
  /** 현재 지배 팩션 ID (null = 중립) */
  controllingFactionId: string | null;
  /** 현재 지배 팩션 컬러 */
  controllingFactionColor: string | null;
  /** 지배 시작 시점 (ISO 8601) */
  controlSince: string | null;
  /** 일일 팩션별 RP 누적 */
  dailyScores: Record<string, number>;
  /** 마지막 일일 정산 시점 (ISO 8601) */
  lastSettlement: string;
  /** 연속 지배 일수 */
  controlStreak: number;
}

/** 국가 주권 상태 */
export interface ICountrySovereignty {
  /** ISO3 국가 코드 */
  countryCode: string;
  /** 주권 보유 팩션 ID (null = 주권 없음) */
  sovereignFactionId: string | null;
  /** 주권 레벨 */
  sovereigntyLevel: SovereigntyLevel;
  /** 모든 지역 통일 여부 */
  allRegionsControlled: boolean;
  /** 주권 획득 이후 경과일 */
  sovereignStreakDays: number;
}

// ── 라운드 상태 (런타임) ──

/** 라운드 실행 상태 — 15분 사이클 */
export interface IRoundState {
  /** 현재 라운드 번호 */
  roundNumber: number;
  /** 현재 페이즈 */
  phase: RoundPhase;
  /** BR 서브 페이즈 (BR 페이즈에서만 유효) */
  brSubPhase: BRSubPhase | null;
  /** 현재 페이즈 남은 시간 (초) */
  countdown: number;
  /** 타이머 표시 문자열 "MM:SS" */
  timerDisplay: string;
  /** PvP 활성화 여부 */
  pvpEnabled: boolean;
  /** BR 전환 카운트다운 (10~1, PvE 마지막 10초에서만 유효) */
  brCountdown: number | null;
  /** 라운드 시작 시각 (ISO 8601) */
  roundStartedAt: string;
}

// ── 실시간 표시용 타입 ──

/** 지역 정보 — 클라이언트 UI 표시용 */
export interface IRegionInfo {
  /** 지역 ID */
  regionId: string;
  /** 소속 국가 코드 */
  countryCode: string;
  /** 지역명 */
  name: string;
  /** 지역 영문명 */
  nameEn: string;
  /** 아레나 크기 */
  arenaSize: number;
  /** 최대 인원 */
  maxPlayers: number;
  /** 현재 접속자 */
  currentPlayers: number;
  /** 지역 상태 */
  state: RegionState;
  /** 지배 팩션 ID */
  controllerFaction: string | null;
  /** 지배 팩션 컬러 */
  controllerColor: string | null;
  /** 바이옴 */
  biome: BiomeType;
}

/** 팩션 현황 — 아레나 내 실시간 */
export interface IFactionPresence {
  /** 팩션 ID */
  factionId: string;
  /** 팩션명 */
  factionName: string;
  /** 팩션 컬러 */
  color: string;
  /** 현재 멤버 수 */
  memberCount: number;
  /** 생존 멤버 수 */
  aliveCount: number;
  /** 전멸 여부 */
  isEliminated: boolean;
  /** 내 팩션 여부 (클라이언트 로컬 판정) */
  isMyFaction: boolean;
}

/** 라운드 HUD 표시 상태 */
export interface IRoundHUDState {
  /** 현재 페이즈 */
  phase: RoundPhase;
  /** BR 서브 페이즈 */
  brSubPhase: BRSubPhase | null;
  /** 남은 시간 (초) */
  countdown: number;
  /** 타이머 디스플레이 "MM:SS" */
  timerDisplay: string;
  /** 라운드 번호 */
  roundNumber: number;
  /** PvP 활성화 여부 */
  pvpEnabled: boolean;
  /** 참가 팩션 목록 */
  factions: IFactionPresence[];
  /** 이번 라운드 내 팩션 RP */
  myFactionRP: number;
  /** BR 전환 카운트다운 */
  brCountdown: number | null;
}

/** 영토 지배 상태 — Globe 표시용 */
export interface ITerritoryState {
  /** 지역 ID */
  regionId: string;
  /** 지배 팩션 ID */
  controllerFaction: string | null;
  /** 지배 팩션 컬러 */
  controllerColor: string | null;
  /** 연속 지배 일수 */
  controlStreak: number;
  /** 팩션별 일일 RP */
  dailyRP: Record<string, number>;
}

/** 자원 노드 — 렌더링용 */
export interface IResourceNode {
  /** 노드 ID */
  id: string;
  /** 위치 */
  position: { x: number; y: number };
  /** 자원 유형 */
  resourceType: ResourceType | string;
  /** 남은 채취량 */
  amount: number;
  /** 최대 채취량 */
  maxAmount: number;
  /** 특산 자원 여부 */
  isSpecialty: boolean;
  /** 채취 진행도 (0~1) */
  gatherProgress: number;
}

/** 플레이어 자원 인벤토리 */
export interface IPlayerInventory {
  /** 기본 6종 자원 */
  basic: {
    gold: number;
    oil: number;
    minerals: number;
    food: number;
    tech: number;
    influence: number;
  };
  /** 특산 자원 (타입별 수량) */
  specialty: Record<string, number>;
  /** 유형별 상한 */
  capacity: number;
}

// ── 라운드 결과 ──

/** 팩션별 라운드 결과 */
export interface IFactionRoundResult {
  /** 팩션 ID */
  factionId: string;
  /** 팩션명 */
  factionName: string;
  /** 참가 인원 */
  memberCount: number;
  /** BR 생존자 수 */
  survivorsCount: number;
  /** 생존 RP */
  survivalRP: number;
  /** 킬 RP */
  killRP: number;
  /** 자원 RP */
  resourceRP: number;
  /** 총 RP */
  totalRP: number;
  /** 순위 (1-based) */
  rank: number;
}

/** 라운드 결과 */
export interface IRoundResult {
  /** 지역 ID */
  regionId: string;
  /** 라운드 번호 */
  roundNumber: number;
  /** 팩션별 결과 */
  factionResults: IFactionRoundResult[];
  /** 라운드 시작 시각 (ISO 8601) */
  startedAt: string;
  /** 라운드 종료 시각 (ISO 8601) */
  endedAt: string;
}

// ── 티어별 상수 ──

/** 티어별 설정 값 */
export interface ITierConfig {
  /** 지역 수 */
  regionCount: number;
  /** 아레나 크기 (px) */
  arenaSize: number;
  /** 지역당 최대 플레이어 */
  maxPlayers: number;
}

/** 티어별 설정 상수 */
export const TIER_CONFIG: Record<CountryTier, ITierConfig> = {
  S: { regionCount: 7, arenaSize: 6000, maxPlayers: 30 },
  A: { regionCount: 5, arenaSize: 5000, maxPlayers: 25 },
  B: { regionCount: 4, arenaSize: 4000, maxPlayers: 20 },
  C: { regionCount: 3, arenaSize: 3000, maxPlayers: 15 },
  D: { regionCount: 3, arenaSize: 2500, maxPlayers: 10 },
} as const;

/** 라운드 타이밍 상수 (초) */
export const ROUND_TIMING = {
  /** PvE 파밍 페이즈 (10분) */
  PVE_DURATION: 600,
  /** 배틀로얄 페이즈 (5분) */
  BR_DURATION: 300,
  /** 정산 페이즈 (15초) */
  SETTLEMENT_DURATION: 15,
  /** 전체 라운드 (15분 15초) */
  TOTAL_DURATION: 915,
  /** BR 전환 카운트다운 (10초) */
  BR_COUNTDOWN: 10,
  /** 전쟁 경고 시점 (PvE 시작 후 9분) */
  WAR_WARNING_AT: 540,
} as const;

/** 지역 유형별 기본 효과 */
export const REGION_TYPE_EFFECTS: Record<RegionType, IRegionEffects> = {
  capital: {
    pvpDamageMultiplier: 1.1,
    pveSpawnRate: 1.2,
    resourceGatherRate: 1.0,
    hpRegenBonus: 0,
    defenseBonus: 0,
    tradeDiscount: 0,
    diplomacyBonus: 0,
  },
  industrial: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 1.0,
    resourceGatherRate: 1.15,
    hpRegenBonus: 0,
    defenseBonus: 0,
    tradeDiscount: 0,
    diplomacyBonus: 0,
  },
  port: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 1.0,
    resourceGatherRate: 1.0,
    hpRegenBonus: 0,
    defenseBonus: 0,
    tradeDiscount: 0.2,
    diplomacyBonus: 0,
  },
  agricultural: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 0.9,
    resourceGatherRate: 1.0,
    hpRegenBonus: 0.1,
    defenseBonus: 0,
    tradeDiscount: 0,
    diplomacyBonus: 0,
  },
  military: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 1.1,
    resourceGatherRate: 1.0,
    hpRegenBonus: 0,
    defenseBonus: 0.15,
    tradeDiscount: 0,
    diplomacyBonus: 0,
  },
  resource: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 1.0,
    resourceGatherRate: 1.5,
    hpRegenBonus: 0,
    defenseBonus: 0,
    tradeDiscount: 0,
    diplomacyBonus: 0,
  },
  cultural: {
    pvpDamageMultiplier: 1.0,
    pveSpawnRate: 0.8,
    resourceGatherRate: 1.0,
    hpRegenBonus: 0,
    defenseBonus: 0,
    tradeDiscount: 0,
    diplomacyBonus: 0.2,
  },
} as const;

// ── v39 Phase 3: 팩션 전투 타입 ──

/** 팩션 간 데미지 매트릭스 관계 */
export type FactionDamageRelation = 'same' | 'allied' | 'hostile';

/** 팩션 데미지 타입 (공격 경로) */
export type FactionDamageType = 'direct' | 'projectile' | 'area' | 'knockback';

/** 팩션 전투 상수 (서버 faction_combat.go와 동기화) */
export const FACTION_COMBAT = {
  /** 영역 효과 데미지 배율 (적대 팩션) */
  AREA_EFFECT_MULT: 0.8,
  /** 어시스트 판정 시간 (초) */
  ASSIST_WINDOW: 3.0,
  /** 팩션당 최대 동맹 수 */
  MAX_ALLIANCES: 2,
  /** 팩션당 최대 멤버 수 */
  MAX_MEMBERS: 50,
  /** PvP 킬 Gold */
  KILL_GOLD: 20,
  /** PvP 킬 Nation Score */
  KILL_NATION_SCORE: 15,
  /** PvP 킬 Region Point */
  KILL_RP: 2,
  /** 어시스트 Gold */
  ASSIST_GOLD: 8,
  /** 어시스트 Nation Score */
  ASSIST_NATION_SCORE: 5,
  /** 어시스트 RP */
  ASSIST_RP: 1,
  /** 팩션 전멸 Gold */
  WIPE_GOLD: 50,
  /** 팩션 전멸 Nation Score */
  WIPE_NATION_SCORE: 30,
  /** 팩션 전멸 RP */
  WIPE_RP: 5,
} as const;

/** 팩션 면역 규칙 (서버 동기화) */
export interface IFactionImmunityRules {
  /** 같은 팩션 공격 불가 (항상 true) */
  sameFactionImmune: boolean;
  /** BR에서 동맹 면역 (false = BR에서 동맹도 공격 가능) */
  allianceImmuneInBR: boolean;
  /** PvE에서 동맹 면역 (true) */
  allianceImmuneInPvE: boolean;
  /** 팩션당 최대 동맹 수 */
  maxAlliancesPerFaction: number;
}

/** 기본 면역 규칙 */
export const DEFAULT_IMMUNITY_RULES: IFactionImmunityRules = {
  sameFactionImmune: true,
  allianceImmuneInBR: false,
  allianceImmuneInPvE: true,
  maxAlliancesPerFaction: 2,
};

/** 데미지 매트릭스 결과 (클라이언트 표시용) */
export interface IDamageMatrixEntry {
  /** 공격자 → 피해자 관계 */
  relation: FactionDamageRelation;
  /** 데미지 타입 */
  damageType: FactionDamageType;
  /** 데미지 배율 (0.0 = 면역, 0.8 = 영역 80%, 1.0 = 정상) */
  multiplier: number;
  /** 면역 여부 */
  immune: boolean;
}

/** 데미지 매트릭스 계산 (클라이언트 UI 표시용) */
export function calcDamageMultiplier(
  relation: FactionDamageRelation,
  phase: RoundPhase,
  dmgType: FactionDamageType,
): number {
  // 같은 팩션: 항상 0
  if (relation === 'same') return 0;
  // PvE 페이즈: 모든 PvP 0
  if (phase === 'pve' || phase === 'br_countdown') return 0;
  // 영역 효과: 80%
  if (dmgType === 'area') return FACTION_COMBAT.AREA_EFFECT_MULT;
  // 그 외: 100%
  return 1.0;
}

// ── v39 Phase 6: 에어드롭 시스템 타입 ──

/** 에어드롭 파워업 종류 */
export type AirdropPowerupType = 'weapon_boost' | 'shield' | 'speed';

/** 에어드롭 상태 */
export type AirdropState = 'falling' | 'landed' | 'picked_up' | 'expired';

/** 에어드롭 인스턴스 (서버 → 클라이언트 전송) */
export interface IAirdrop {
  /** 에어드롭 고유 ID */
  id: string;
  /** 맵 상 위치 */
  position: { x: number; y: number };
  /** 파워업 종류 */
  powerupType: AirdropPowerupType;
  /** 에어드롭 상태 */
  state: AirdropState;
  /** BR 경과 기준 스폰 시각 (초) */
  spawnedAt: number;
  /** 남은 수명 (초) */
  lifetime: number;
  /** 낙하 타이머 (초, falling 중에만 유효) */
  fallTimer: number;
  /** 획득한 플레이어 ID */
  pickedUpBy?: string;
}

/** 파워업 설정 */
export interface IPowerupConfig {
  /** 파워업 종류 */
  type: AirdropPowerupType;
  /** 효과 지속 시간 (초) */
  duration: number;
  /** 보정 배율 (0.3 = +30%) */
  value: number;
}

/** 활성 파워업 (플레이어에게 적용 중) */
export interface IActivePowerup {
  /** 파워업 종류 */
  type: AirdropPowerupType;
  /** 보정 배율 */
  value: number;
  /** 남은 시간 (초) */
  remaining: number;
  /** 총 지속 시간 (초) */
  duration: number;
}

/** 에어드롭 이벤트 종류 */
export type AirdropEventType = 'airdrop_spawned' | 'airdrop_landed' | 'airdrop_picked_up' | 'airdrop_expired';

/** 에어드롭 이벤트 */
export interface IAirdropEvent {
  /** 이벤트 종류 */
  type: AirdropEventType;
  /** 에어드롭 정보 */
  airdrop: IAirdrop;
  /** 획득 플레이어 ID (picked_up에서만) */
  playerId?: string;
}

/** 에어드롭 상수 (서버 airdrop.go와 동기화) */
export const AIRDROP_CONSTANTS = {
  /** 스폰 간격 (초) */
  SPAWN_INTERVAL: 120,
  /** 획득 거리 (px) */
  PICKUP_RADIUS: 60,
  /** 낙하 시간 (초) */
  FALL_DURATION: 3,
  /** 존재 시간 (초) */
  LIFETIME: 90,
  /** 동시 최대 수 */
  MAX_ACTIVE: 5,
} as const;

/** 파워업별 기본 설정 (서버 동기화) */
export const POWERUP_CONFIGS: Record<AirdropPowerupType, IPowerupConfig> = {
  weapon_boost: { type: 'weapon_boost', duration: 60, value: 0.30 },
  shield: { type: 'shield', duration: 5, value: 1.0 },
  speed: { type: 'speed', duration: 30, value: 0.50 },
} as const;

/** 파워업 표시 정보 (UI용) */
export const POWERUP_DISPLAY: Record<AirdropPowerupType, {
  name: string;
  icon: string;
  color: string;
  description: string;
}> = {
  weapon_boost: {
    name: 'WEAPON BOOST',
    icon: '⚔️',
    color: '#EF4444',
    description: 'DMG +30% for 60s',
  },
  shield: {
    name: 'SHIELD',
    icon: '🛡️',
    color: '#3B82F6',
    description: 'Invincible for 5s',
  },
  speed: {
    name: 'SPEED BOOST',
    icon: '⚡',
    color: '#22C55E',
    description: 'Speed +50% for 30s',
  },
} as const;

// ── v39 Phase 6: 팩션 전멸/승리 타입 ──

/** 팩션 전멸 기록 */
export interface IFactionEliminationRecord {
  /** 팩션 ID */
  factionId: string;
  /** 팩션명 */
  factionName: string;
  /** 팩션 컬러 */
  color: string;
  /** 전멸 시각 (ISO 8601) */
  eliminatedAt: string;
  /** 최종 순위 (1 = 우승) */
  rank: number;
  /** 참가 인원 */
  memberCount: number;
  /** BR 시작 이후 생존 시간 (초) */
  survivalTimeSec: number;
}

/** 개인 기여 점수 */
export interface IPlayerContribution {
  /** 플레이어 ID */
  playerId: string;
  /** 플레이어명 */
  playerName: string;
  /** 팩션 ID */
  factionId: string;
  /** PvP 킬 수 */
  kills: number;
  /** 어시스트 수 */
  assists: number;
  /** 자원 채취량 */
  resourceGathered: number;
  /** 개인 생존 시간 (초) */
  survivalTimeSec: number;
  /** 종합 기여 점수 */
  score: number;
}

/** 팩션 보상 정보 */
export interface IFactionReward {
  /** 팩션 ID */
  factionId: string;
  /** 팩션명 */
  factionName: string;
  /** 순위 */
  rank: number;
  /** Region Point 보상 */
  rp: number;
  /** 보상 비율 (1.0 = 100%) */
  rewardRatio: number;
  /** Gold 보상 */
  gold: number;
}

/** BR 최종 승리 결과 */
export interface IBRVictoryResult {
  /** 우승 팩션 ID */
  winnerFactionId: string;
  /** 우승 팩션명 */
  winnerFactionName: string;
  /** 우승 팩션 컬러 */
  winnerColor: string;
  /** 팩션별 순위 */
  rankings: IFactionEliminationRecord[];
  /** 순위별 보상 */
  rewards: IFactionReward[];
  /** 상위 기여자 목록 */
  topContributors: IPlayerContribution[];
  /** 라운드 번호 */
  roundNumber: number;
  /** 지역 ID */
  regionId: string;
  /** BR 소요 시간 (초) */
  brDurationSec: number;
  /** 완료 시각 (ISO 8601) */
  completedAt: string;
  /** 시간 만료 전 종료 여부 */
  earlyFinish: boolean;
}

/** 전멸 이벤트 종류 */
export type EliminationEventType =
  | 'faction_eliminated'
  | 'round_end_early'
  | 'br_victory'
  | 'spectate_switch';

/** 전멸 이벤트 */
export interface IEliminationEvent {
  /** 이벤트 종류 */
  type: EliminationEventType;
  /** 이벤트 데이터 */
  data: IFactionEliminationRecord | IBRVictoryResult | Record<string, unknown>;
}

/** 승리 보상 상수 (서버 br_elimination.go와 동기화) */
export const VICTORY_REWARDS = {
  /** 1위 RP */
  RP_1ST: 10,
  /** 2위 RP */
  RP_2ND: 5,
  /** 3위 RP */
  RP_3RD: 3,
  /** 1위 보상 비율 */
  RATIO_1ST: 1.0,
  /** 2위 보상 비율 */
  RATIO_2ND: 0.6,
  /** 3위 보상 비율 */
  RATIO_3RD: 0.3,
} as const;
