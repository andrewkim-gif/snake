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

// ── v39 Phase 7: 영토 주권 설정 ──

/** 주권 에스컬레이션 래더 설정 (서버 territory_engine.go와 동기화) */
export const SOVEREIGNTY_CONFIG = {
  /** 지배 확정에 필요한 최소 RP */
  MIN_RP: 100,
  /** 지배 확정에 필요한 최소 격차 비율 (10%) */
  DOMINANCE_GAP_PCT: 0.10,
  /** 연속 3일+ 지배 시 교체에 필요한 격차 (20%) */
  INERTIA_GAP_PCT: 0.20,
  /** 지배 관성 발동 일수 */
  INERTIA_THRESHOLD_DAYS: 3,
  /** Active Domination 필요 연속 일수 */
  ACTIVE_DOMINATION_DAYS: 1,
  /** Sovereignty 필요 연속 일수 */
  SOVEREIGNTY_DAYS: 3,
  /** Hegemony 필요 연속 일수 */
  HEGEMONY_DAYS: 14,
  /** 소규모 팩션 RP 보너스 인원 기준 */
  UNDERDOG_THRESHOLD: 3,
  /** 소규모 팩션 RP 배율 (1.5 = +50%) */
  UNDERDOG_BONUS: 1.5,
} as const;

/** 주권 레벨별 표시 정보 */
export const SOVEREIGNTY_DISPLAY: Record<SovereigntyLevel, {
  label: string;
  labelKo: string;
  color: string;
  glowIntensity: number;
  pulseSpeed: number;
  icon: string;
}> = {
  none: {
    label: 'Neutral',
    labelKo: '중립',
    color: '#666666',
    glowIntensity: 0,
    pulseSpeed: 0,
    icon: '',
  },
  active_domination: {
    label: 'Active Domination',
    labelKo: '지배 중',
    color: '#FBBF24',
    glowIntensity: 0.1,
    pulseSpeed: 0,
    icon: '⚑',
  },
  sovereignty: {
    label: 'Sovereignty',
    labelKo: '주권 확보',
    color: '#F59E0B',
    glowIntensity: 0.2,
    pulseSpeed: 1.5,
    icon: '👑',
  },
  hegemony: {
    label: 'Hegemony',
    labelKo: '패권',
    color: '#DC2626',
    glowIntensity: 0.4,
    pulseSpeed: 2.0,
    icon: '🏛️',
  },
} as const;

// ── v39 Phase 8: NPC 수비대 타입 ──

/** NPC 수비대 상태 */
export type NPCGuardState = 'idle' | 'patrol' | 'combat' | 'dead' | 'respawning';

/** NPC 수비대 스냅샷 (서버 → 클라이언트 전송) */
export interface INPCGuardSnapshot {
  /** 수비대 고유 ID */
  id: string;
  /** 소속 팩션 ID */
  factionId: string;
  /** 팩션 컬러 */
  factionColor: string;
  /** 위치 X */
  x: number;
  /** 위치 Y */
  y: number;
  /** 현재 HP */
  hp: number;
  /** 최대 HP */
  maxHp: number;
  /** 상태 */
  state: NPCGuardState;
  /** 타겟 플레이어 ID */
  targetId?: string;
}

/** 수비대 배치 상수 (서버 garrison_system.go와 동기화) */
export const GARRISON_CONSTANTS = {
  /** Active Domination 수비대 수 */
  COUNT_ACTIVE: 3,
  /** Sovereignty 수비대 수 */
  COUNT_SOVEREIGNTY: 5,
  /** Hegemony 수비대 수 */
  COUNT_HEGEMONY: 8,
  /** 기본 HP */
  BASE_HP: 150,
  /** 기본 공격력 */
  BASE_DMG: 12,
  /** 적 감지 범위 (px) */
  AGRO_RANGE: 200,
  /** 공격 사거리 (px) */
  ATTACK_RANGE: 80,
  /** 리스폰 딜레이 (초) */
  RESPAWN_DELAY: 60,
  /** Active 스탯 배율 */
  STAT_MULT_ACTIVE: 1.0,
  /** Sovereignty 스탯 배율 */
  STAT_MULT_SOVEREIGNTY: 1.3,
  /** Hegemony 스탯 배율 */
  STAT_MULT_HEGEMONY: 1.6,
} as const;

/** 주권 레벨별 수비대 수 반환 */
export function getGarrisonCountForLevel(level: SovereigntyLevel): number {
  switch (level) {
    case 'hegemony': return GARRISON_CONSTANTS.COUNT_HEGEMONY;
    case 'sovereignty': return GARRISON_CONSTANTS.COUNT_SOVEREIGNTY;
    case 'active_domination': return GARRISON_CONSTANTS.COUNT_ACTIVE;
    default: return 0;
  }
}

/** 수비대 표시 정보 */
export const GARRISON_DISPLAY = {
  /** 수비대 이름 */
  name: 'Garrison Guard',
  /** 수비대 아이콘 */
  icon: '🛡️',
  /** 수비대 기본 색상 (팩션 컬러로 오버라이드) */
  color: '#6B7280',
  /** HP 바 표시 크기 */
  hpBarWidth: 40,
  /** HP 바 높이 */
  hpBarHeight: 4,
} as const;

// ── v39 Phase 8: 용병 시스템 타입 ──

/** 용병 등급 */
export type MercenaryTier = 'recruit' | 'veteran' | 'elite';

/** 용병 상태 */
export type MercenaryNPCState = 'ready' | 'combat' | 'dead';

/** 용병 스냅샷 (서버 → 클라이언트 전송) */
export interface IMercenarySnapshot {
  /** 용병 고유 ID */
  id: string;
  /** 소속 팩션 ID */
  factionId: string;
  /** 팩션 컬러 */
  factionColor: string;
  /** 등급 */
  tier: MercenaryTier;
  /** 위치 X */
  x: number;
  /** 위치 Y */
  y: number;
  /** 현재 HP */
  hp: number;
  /** 최대 HP */
  maxHp: number;
  /** 상태 */
  state: MercenaryNPCState;
  /** 타겟 플레이어 ID */
  targetId?: string;
}

/** 용병 등급 정보 (서버 → 클라이언트 UI) */
export interface IMercenaryTierInfo {
  /** 등급 */
  tier: MercenaryTier;
  /** 등급명 */
  name: string;
  /** HP */
  hp: number;
  /** 공격력 */
  damage: number;
  /** 이동 속도 */
  speed: number;
  /** 고용 비용 (Round Gold) */
  cost: number;
  /** 할인 전 원래 비용 */
  originalCost: number;
  /** 할인 적용 여부 */
  discounted: boolean;
}

/** 용병 상수 (서버 mercenary_system.go와 동기화) */
export const MERCENARY_CONSTANTS = {
  /** 팩션당 최대 용병 수 */
  MAX_PER_FACTION: 5,
  /** Underdog 할인율 (30%) */
  UNDERDOG_DISCOUNT: 0.30,

  /** 신병 비용 */
  COST_RECRUIT: 50,
  /** 숙련병 비용 */
  COST_VETERAN: 120,
  /** 정예병 비용 */
  COST_ELITE: 250,

  /** 신병 HP */
  HP_RECRUIT: 100,
  /** 숙련병 HP */
  HP_VETERAN: 180,
  /** 정예병 HP */
  HP_ELITE: 280,

  /** 신병 공격력 */
  DMG_RECRUIT: 8,
  /** 숙련병 공격력 */
  DMG_VETERAN: 14,
  /** 정예병 공격력 */
  DMG_ELITE: 22,
} as const;

/** 용병 등급별 표시 정보 */
export const MERCENARY_DISPLAY: Record<MercenaryTier, {
  name: string;
  nameKo: string;
  icon: string;
  color: string;
  description: string;
}> = {
  recruit: {
    name: 'Recruit',
    nameKo: '신병',
    icon: '⚔️',
    color: '#9CA3AF',
    description: 'Basic mercenary with low stats',
  },
  veteran: {
    name: 'Veteran',
    nameKo: '숙련병',
    icon: '🗡️',
    color: '#3B82F6',
    description: 'Experienced fighter with balanced stats',
  },
  elite: {
    name: 'Elite',
    nameKo: '정예병',
    icon: '⚜️',
    color: '#EAB308',
    description: 'Elite warrior with superior combat ability',
  },
} as const;

// ── v39 Phase 8: Underdog Boost 타입 ──

/** Underdog Boost 결과 (서버 → 클라이언트) */
export interface IUnderdogBoostResult {
  /** HP 보정 배율 (1.0 ~ 1.3) */
  hpMultiplier: number;
  /** DMG 보정 배율 (1.0 ~ 1.2) */
  dmgMultiplier: number;
  /** NPC 지원 수 (0 ~ 3) */
  npcSupport: number;
  /** RP 보너스 배율 (1.0 ~ 1.5) */
  rpBonusMult: number;
  /** XP 보너스 배율 (1.0 ~ 1.2) */
  xpBonusMult: number;
  /** 소규모 팩션 여부 (3명 이하) */
  isSmallFaction: boolean;
  /** 인원 비율 (팩션 / 평균) */
  popRatio: number;
}

/** Underdog Boost 상수 (서버 faction_combat.go와 동기화) */
export const UNDERDOG_CONSTANTS = {
  /** 소규모 팩션 기준 (3명 이하) */
  SMALL_FACTION_THRESHOLD: 3,
  /** 최대 HP 보정 (+30%) */
  MAX_HP_BOOST: 0.30,
  /** 최대 DMG 보정 (+20%) */
  MAX_DMG_BOOST: 0.20,
  /** 최대 NPC 지원 수 */
  MAX_NPC_SUPPORT: 3,
  /** RP 보너스 배율 (+50%) */
  RP_BONUS_MULT: 1.5,
  /** XP 보너스 배율 (+20%) */
  XP_BONUS_MULT: 1.2,
  /** 동적 배율 시작 비율 (평균 대비 50% 이하) */
  RATIO_SCALE_MIN: 0.50,
} as const;

/** 팩션 인원 상한 상수 */
export const FACTION_CAP_CONSTANTS = {
  /** 지역당 단일 팩션 최대 인원 기본값 */
  DEFAULT_PER_REGION: 10,
  /** 최소 보장 인원 */
  MIN_PER_REGION: 3,
  /** 과밀 판정 비율 (60%) */
  OVERCROWDED_RATIO: 0.60,
  /** 과밀 팩션 RP 페널티 (-20%) */
  OVERCROWDED_PENALTY: 0.80,
} as const;

/** 영토 스냅샷 (서버 → 클라이언트 브로드캐스트) */
export interface ITerritorySnapshot {
  /** 지역별 영토 상태 */
  regions: ITerritoryRegionSnapshot[];
  /** 국가별 주권 상태 */
  countries: ITerritorySovereigntySnapshot[];
  /** 다음 정산까지 남은 시간 (초) */
  settlementCountdown: number;
  /** 마지막 정산 시각 (ISO 8601) */
  lastSettledAt?: string;
}

/** 지역 영토 스냅샷 */
export interface ITerritoryRegionSnapshot {
  /** 지역 ID */
  regionId: string;
  /** 소속 국가 코드 */
  countryCode: string;
  /** 지배 팩션 ID */
  controllerFaction?: string;
  /** 지배 팩션 컬러 */
  controllerColor?: string;
  /** 연속 지배 일수 */
  controlStreak: number;
  /** 주권 레벨 */
  sovereigntyLevel: SovereigntyLevel;
  /** 팩션별 일일 RP (현재 진행 중) */
  dailyRP?: Record<string, number>;
}

/** 국가 주권 스냅샷 */
export interface ITerritorySovereigntySnapshot {
  /** ISO3 국가 코드 */
  countryCode: string;
  /** 주권 팩션 ID */
  sovereignFaction?: string;
  /** 주권 레벨 */
  sovereigntyLevel: SovereigntyLevel;
  /** 연속 주권 일수 */
  streakDays: number;
  /** 전체 지역 통일 여부 */
  allControlled: boolean;
}

/** 일일 정산 결과 (서버 → 클라이언트 이벤트) */
export interface IDailySettlementResult {
  /** 정산 시각 (ISO 8601) */
  settledAt: string;
  /** 지역별 정산 결과 */
  regionResults: IRegionSettlementResult[];
  /** 국가 주권 변동 */
  sovereigntyChanges: ISovereigntyChange[];
}

/** 지역 정산 결과 */
export interface IRegionSettlementResult {
  /** 지역 ID */
  regionId: string;
  /** 소속 국가 코드 */
  countryCode: string;
  /** 이번 정산 승자 팩션 ID */
  winnerFactionId?: string;
  /** 이전 지배 팩션 ID */
  previousController?: string;
  /** 경합 중 여부 */
  isContested: boolean;
  /** 연속 지배 일수 */
  controlStreak: number;
  /** 주권 레벨 */
  sovereigntyLevel: SovereigntyLevel;
  /** 최종 점수 (factionId → RP) */
  finalScores: Record<string, number>;
}

/** 주권 변동 이벤트 */
export interface ISovereigntyChange {
  /** 국가 코드 */
  countryCode: string;
  /** 이전 주권 팩션 */
  oldFaction?: string;
  /** 새 주권 팩션 */
  newFaction?: string;
  /** 이전 주권 레벨 */
  oldLevel: SovereigntyLevel;
  /** 새 주권 레벨 */
  newLevel: SovereigntyLevel;
}

// ── v39 Phase 9: 라운드 이벤트 시스템 타입 ──

/** 라운드 이벤트 종류 */
export type RoundEventKind =
  | 'resource_surge'   // 자원 2배
  | 'fast_shrink'      // 세이프존 빠른 수축
  | 'npc_rage'         // NPC 강화
  | 'bonus_airdrop'    // 보너스 에어드롭
  | 'fog_of_war'       // 안개 전쟁
  | 'trade_open';      // 무역 개방

/** 라운드 이벤트 라이프사이클 페이즈 */
export type RoundEventPhase = 'pending' | 'announced' | 'active' | 'expired';

/** 라운드 이벤트 적용 대상 */
export type RoundEventTarget = 'pve' | 'br';

/** 라운드 이벤트 스냅샷 (서버 → 클라이언트 전송) */
export interface IRoundEventSnapshot {
  /** 이벤트 고유 ID */
  id: string;
  /** 이벤트 종류 */
  kind: RoundEventKind;
  /** 이벤트 이름 */
  name: string;
  /** 이벤트 한국어 이름 */
  nameKo: string;
  /** 이벤트 설명 */
  description: string;
  /** 이벤트 아이콘 키 */
  icon: string;
  /** 현재 이벤트 페이즈 */
  phase: RoundEventPhase;
  /** 예고 남은 시간 (초) */
  announceTimer?: number;
  /** 활성 남은 시간 (초) */
  activeTimer?: number;
  /** 이벤트 효과 값 (배율/수량 등) */
  value: number;
}

/** 라운드 이벤트 알림 (WebSocket 이벤트) */
export interface IRoundEventNotification {
  /** 알림 종류 */
  type: 'announced' | 'activated' | 'expired';
  /** 이벤트 데이터 */
  event: IRoundEventSnapshot;
}

/** 라운드 이벤트 상수 (서버 round_event_engine.go와 동기화) */
export const ROUND_EVENT_CONSTANTS = {
  /** 이벤트 예고 시간 (초) */
  ANNOUNCE_DURATION: 30,
  /** 라운드당 최소 이벤트 수 */
  MIN_PER_ROUND: 1,
  /** 라운드당 최대 이벤트 수 */
  MAX_PER_ROUND: 2,
  /** 자원 2배 배율 */
  RESOURCE_SURGE_MULT: 2.0,
  /** 세이프존 수축 가속 배율 */
  FAST_SHRINK_MULT: 1.5,
  /** NPC 강화 배율 */
  NPC_RAGE_MULT: 1.5,
  /** 보너스 에어드롭 수 */
  BONUS_AIRDROP_COUNT: 5,
  /** 안개 전쟁 시야 배율 */
  FOG_OF_WAR_VISION: 0.5,
  /** 무역 개방 수수료 할인 */
  TRADE_OPEN_DISCOUNT: 1.0,
} as const;

/** 라운드 이벤트 표시 정보 */
export const ROUND_EVENT_DISPLAY: Record<RoundEventKind, {
  name: string;
  nameKo: string;
  icon: string;
  color: string;
  description: string;
}> = {
  resource_surge: {
    name: 'Resource Surge',
    nameKo: '자원 폭등',
    icon: '💎',
    color: '#22C55E',
    description: 'Resource nodes spawn at 2x rate',
  },
  fast_shrink: {
    name: 'Fast Shrink',
    nameKo: '빠른 수축',
    icon: '🌀',
    color: '#EF4444',
    description: 'Safe zone shrinks 50% faster',
  },
  npc_rage: {
    name: 'NPC Rage',
    nameKo: 'NPC 광폭화',
    icon: '💀',
    color: '#DC2626',
    description: 'Garrison NPCs gain +50% stats',
  },
  bonus_airdrop: {
    name: 'Bonus Airdrop',
    nameKo: '보너스 에어드롭',
    icon: '📦',
    color: '#8B5CF6',
    description: '5 bonus airdrops deploy immediately',
  },
  fog_of_war: {
    name: 'Fog of War',
    nameKo: '안개 전쟁',
    icon: '🌫️',
    color: '#6B7280',
    description: 'Minimap disabled, vision reduced 50%',
  },
  trade_open: {
    name: 'Trade Open',
    nameKo: '무역 개방',
    icon: '🤝',
    color: '#F59E0B',
    description: 'Trade fees reduced to 0%',
  },
} as const;

// ── v39 Phase 9: 건물 시스템 타입 ──

/** 건물 유형 */
export type BuildingType =
  | 'defense_tower'
  | 'resource_accelerator'
  | 'healing_station'
  | 'scout_post';

/** 건물 효과 */
export interface IBuildingEffect {
  /** 방어탑: 공격 데미지 */
  attackDamage?: number;
  /** 방어탑: 공격 사거리 (px) */
  attackRange?: number;
  /** 방어탑: 공격 쿨다운 (초) */
  attackCd?: number;
  /** 자원 가속기: 채취 속도 보너스 */
  gatherRateBonus?: number;
  /** 치유소: 초당 HP 재생량 */
  healPerSec?: number;
  /** 치유소: 효과 범위 (px) */
  healRange?: number;
  /** 정찰소: 미니맵 감지 범위 (px) */
  scoutRange?: number;
}

/** 건물 정의 (정적 데이터) */
export interface IBuildingDef {
  /** 건물 유형 */
  type: BuildingType;
  /** 건물명 */
  name: string;
  /** 한국어 건물명 */
  nameKo: string;
  /** 설명 */
  description: string;
  /** 아이콘 키 */
  icon: string;
  /** 최대 HP */
  maxHp: number;
  /** 건설 비용 */
  cost: {
    gold?: number;
    oil?: number;
    minerals?: number;
    food?: number;
    tech?: number;
    influence?: number;
  };
  /** 건물 효과 */
  effect: IBuildingEffect;
  /** 건설 시간 (초) */
  buildTime: number;
}

/** 건물 스냅샷 (서버 → 클라이언트 전송) */
export interface IBuildingSnapshot {
  /** 건물 고유 ID */
  id: string;
  /** 건물 유형 */
  type: BuildingType;
  /** 소유 팩션 ID */
  ownerFaction: string;
  /** 팩션 컬러 */
  factionColor: string;
  /** 위치 X */
  x: number;
  /** 위치 Y */
  y: number;
  /** 현재 HP */
  hp: number;
  /** 최대 HP */
  maxHp: number;
  /** 활성 여부 */
  active: boolean;
  /** 건설 중 여부 */
  building: boolean;
  /** 건설 남은 시간 (초) */
  buildTimer?: number;
}

/** 건물 이벤트 종류 */
export type BuildingEventType =
  | 'build_start'
  | 'build_done'
  | 'build_damaged'
  | 'build_destroyed'
  | 'build_deactivated'
  | 'build_activated';

/** 건물 이벤트 */
export interface IBuildingEvent {
  /** 이벤트 종류 */
  type: BuildingEventType;
  /** 건물 정보 */
  building: IBuildingSnapshot;
  /** 지역 ID */
  regionId: string;
}

/** 건물 슬롯 상수 (서버 building_system.go와 동기화) */
export const BUILDING_CONSTANTS = {
  /** Active Domination 슬롯 수 */
  SLOTS_ACTIVE_DOM: 2,
  /** Sovereignty 슬롯 수 */
  SLOTS_SOVEREIGNTY: 3,
  /** Hegemony 슬롯 수 */
  SLOTS_HEGEMONY: 5,
  /** 인수 비용 비율 (50%) */
  ACTIVATION_COST_RATIO: 0.5,
} as const;

/** 건물 정의 목록 (서버 building_system.go와 동기화) */
export const BUILDING_DEFS: Record<BuildingType, IBuildingDef> = {
  defense_tower: {
    type: 'defense_tower',
    name: 'Defense Tower',
    nameKo: '방어탑',
    description: 'Auto-attacks enemies within range during BR',
    icon: 'tower',
    maxHp: 500,
    cost: { minerals: 100, tech: 50 },
    effect: { attackDamage: 15, attackRange: 200, attackCd: 2.0 },
    buildTime: 30,
  },
  resource_accelerator: {
    type: 'resource_accelerator',
    name: 'Resource Accelerator',
    nameKo: '자원 가속기',
    description: 'Increases resource gather rate by 30%',
    icon: 'accelerator',
    maxHp: 300,
    cost: { minerals: 80, gold: 60 },
    effect: { gatherRateBonus: 0.30 },
    buildTime: 20,
  },
  healing_station: {
    type: 'healing_station',
    name: 'Healing Station',
    nameKo: '치유소',
    description: 'Heals nearby allies for 2 HP/s',
    icon: 'heal',
    maxHp: 250,
    cost: { food: 80, influence: 30 },
    effect: { healPerSec: 2.0, healRange: 150 },
    buildTime: 25,
  },
  scout_post: {
    type: 'scout_post',
    name: 'Scout Post',
    nameKo: '정찰소',
    description: 'Reveals enemy positions on minimap within extended range',
    icon: 'scout',
    maxHp: 200,
    cost: { gold: 50, tech: 40 },
    effect: { scoutRange: 300 },
    buildTime: 15,
  },
} as const;

/** 주권 레벨별 건물 슬롯 수 반환 */
export function getBuildingSlotsForLevel(level: SovereigntyLevel): number {
  switch (level) {
    case 'hegemony': return BUILDING_CONSTANTS.SLOTS_HEGEMONY;
    case 'sovereignty': return BUILDING_CONSTANTS.SLOTS_SOVEREIGNTY;
    case 'active_domination': return BUILDING_CONSTANTS.SLOTS_ACTIVE_DOM;
    default: return 0;
  }
}

/** 건물 표시 정보 */
export const BUILDING_DISPLAY: Record<BuildingType, {
  name: string;
  nameKo: string;
  icon: string;
  color: string;
  description: string;
}> = {
  defense_tower: {
    name: 'Defense Tower',
    nameKo: '방어탑',
    icon: '🗼',
    color: '#EF4444',
    description: 'Auto-attacks enemies during BR',
  },
  resource_accelerator: {
    name: 'Resource Accelerator',
    nameKo: '자원 가속기',
    icon: '⚡',
    color: '#22C55E',
    description: 'Gather rate +30%',
  },
  healing_station: {
    name: 'Healing Station',
    nameKo: '치유소',
    icon: '💚',
    color: '#10B981',
    description: 'Heals allies 2 HP/s',
  },
  scout_post: {
    name: 'Scout Post',
    nameKo: '정찰소',
    icon: '🔭',
    color: '#3B82F6',
    description: 'Extended minimap vision',
  },
} as const;

// ── v39 Phase 9: 인텔 미션 타입 ──

/** 인텔 미션 종류 */
export type IntelMissionType =
  | 'enemy_presence'    // 적 팩션 주둔 정보
  | 'resource_map'      // 자원 분포 정보
  | 'garrison_strength' // NPC 수비대 강도
  | 'building_intel'    // 적 건물 정보
  | 'tactical_scan';    // 종합 전술 스캔

/** 인텔 미션 정의 */
export interface IIntelMissionDef {
  /** 미션 종류 */
  type: IntelMissionType;
  /** 미션명 */
  name: string;
  /** 한국어 미션명 */
  nameKo: string;
  /** 설명 */
  description: string;
  /** 인텔 포인트 비용 */
  cost: number;
  /** 결과 유효 시간 (초) */
  duration: number;
}

/** 인텔 미션 스냅샷 (클라이언트 표시용) */
export interface IIntelMissionSnapshot {
  /** 미션 종류 */
  type: IntelMissionType;
  /** 미션명 */
  name: string;
  /** 한국어 미션명 */
  nameKo: string;
  /** 설명 */
  description: string;
  /** 인텔 포인트 비용 */
  cost: number;
  /** 포인트 충분 여부 */
  available: boolean;
}

/** 인텔 결과 (서버 → 클라이언트 전송) */
export interface IIntelResult {
  /** 결과 고유 ID */
  id: string;
  /** 미션 종류 */
  missionType: IntelMissionType;
  /** 대상 지역 ID */
  regionId: string;
  /** 요청 팩션 ID */
  factionId: string;
  /** 결과 데이터 (미션별 상이) */
  data: unknown;
  /** 만료 시각 (ISO 8601) */
  expiresAt: string;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
}

/** 적 팩션 정찰 결과 */
export interface IIntelEnemyPresenceResult {
  /** 대상 지역 ID */
  regionId: string;
  /** 적 팩션 목록 */
  factions: {
    factionId: string;
    factionName: string;
    memberCount: number;
    aliveCount: number;
    color: string;
  }[];
  /** 스캔 시각 */
  scannedAt: string;
}

/** 자원 분포 분석 결과 */
export interface IIntelResourceMapResult {
  /** 대상 지역 ID */
  regionId: string;
  /** 총 노드 수 */
  totalNodes: number;
  /** 활성 노드 수 */
  activeNodes: number;
  /** 자원 유형별 노드 수 */
  nodesByType: Record<string, number>;
  /** 특산 자원 유형 */
  specialtyType: string;
  /** 특산 자원 노드 수 */
  specialtyNodes: number;
  /** 스캔 시각 */
  scannedAt: string;
}

/** 수비대 정찰 결과 */
export interface IIntelGarrisonResult {
  /** 대상 지역 ID */
  regionId: string;
  /** 지배 팩션 ID */
  controllerFaction?: string;
  /** 주권 레벨 */
  sovereigntyLevel: SovereigntyLevel;
  /** 총 수비대 수 */
  totalGuards: number;
  /** 생존 수비대 수 */
  aliveGuards: number;
  /** 평균 HP */
  avgHp: number;
  /** 스탯 배율 */
  statMultiplier: number;
  /** 스캔 시각 */
  scannedAt: string;
}

/** 건물 정찰 결과 */
export interface IIntelBuildingResult {
  /** 대상 지역 ID */
  regionId: string;
  /** 적 건물 목록 */
  buildings: {
    type: BuildingType;
    ownerFaction: string;
    hp: number;
    maxHp: number;
    active: boolean;
    building: boolean;
    x: number;
    y: number;
  }[];
  /** 스캔 시각 */
  scannedAt: string;
}

/** 인텔 포인트 스냅샷 */
export interface IIntelPointsSnapshot {
  /** 팩션 ID */
  factionId: string;
  /** 보유 포인트 */
  points: number;
}

/** 인텔 미션 상수 (서버 intel_missions.go와 동기화) */
export const INTEL_CONSTANTS = {
  /** 적 팩션 정찰 비용 */
  COST_ENEMY_PRESENCE: 20,
  /** 자원 분포 분석 비용 */
  COST_RESOURCE_MAP: 30,
  /** 수비대 정찰 비용 */
  COST_GARRISON_STRENGTH: 35,
  /** 건물 정찰 비용 */
  COST_BUILDING_INFO: 25,
  /** 전술 스캔 비용 */
  COST_TACTICAL_SCAN: 80,
  /** PvE 킬 포인트 */
  POINTS_PER_PVE_KILL: 2,
  /** 자원 채취 포인트 */
  POINTS_PER_GATHER: 1,
  /** 정찰소 라운드 보너스 */
  POINTS_SCOUT_POST_BONUS: 10,
  /** 인텔 결과 유효 시간 (초) */
  RESULT_DURATION: 300,
} as const;

/** 인텔 미션 표시 정보 */
export const INTEL_MISSION_DISPLAY: Record<IntelMissionType, {
  name: string;
  nameKo: string;
  icon: string;
  color: string;
  description: string;
  cost: number;
}> = {
  enemy_presence: {
    name: 'Enemy Presence',
    nameKo: '적 팩션 정찰',
    icon: '👁️',
    color: '#EF4444',
    description: 'Reveal enemy faction presence',
    cost: 20,
  },
  resource_map: {
    name: 'Resource Analysis',
    nameKo: '자원 분포 분석',
    icon: '🗺️',
    color: '#22C55E',
    description: 'Reveal resource node distribution',
    cost: 30,
  },
  garrison_strength: {
    name: 'Garrison Recon',
    nameKo: '수비대 정찰',
    icon: '🛡️',
    color: '#F59E0B',
    description: 'Reveal NPC garrison strength',
    cost: 35,
  },
  building_intel: {
    name: 'Building Intel',
    nameKo: '건물 정찰',
    icon: '🏗️',
    color: '#8B5CF6',
    description: 'Reveal enemy buildings',
    cost: 25,
  },
  tactical_scan: {
    name: 'Tactical Scan',
    nameKo: '전술 스캔',
    icon: '🎯',
    color: '#DC2626',
    description: 'Comprehensive intel package',
    cost: 80,
  },
} as const;
