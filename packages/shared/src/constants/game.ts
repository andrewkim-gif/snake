/**
 * Snake Arena — Game Constants v2.0
 * snake.io 스타일 아레나 설정값
 */

import type { ArenaConfig, SnakeSkin } from '../types/game';

// ─── Arena Config (서버 기본값) ───

export const ARENA_CONFIG: ArenaConfig = {
  radius: 6000,
  maxPlayers: 100,
  tickRate: 20,
  baseSpeed: 200,        // px/s
  boostSpeed: 400,       // px/s (2x)
  turnRate: 0.15,        // rad/tick (3.0 rad/s @ 20Hz — 90도 전환 ~0.5s)
  segmentSpacing: 8,     // units
  initialMass: 10,
  minBoostMass: 15,
  boostCostPerTick: 0.5,
  collectRadius: 20,
  headRadius: 12,
  naturalOrbTarget: 2000,
  deathOrbRatio: 0.8,
  trailOrbInterval: 3,   // ticks
  trailOrbValue: 2,
  trailOrbLifetime: 600, // ticks (30s)
};

// ─── Derived Constants ───

export const TICK_INTERVAL_MS = 1000 / ARENA_CONFIG.tickRate; // 50ms
export const ARENA_DIAMETER = ARENA_CONFIG.radius * 2;        // 12000

/** 틱당 이동 거리 = speed / tickRate */
export const BASE_MOVE_PER_TICK = ARENA_CONFIG.baseSpeed / ARENA_CONFIG.tickRate;   // 10
export const BOOST_MOVE_PER_TICK = ARENA_CONFIG.boostSpeed / ARENA_CONFIG.tickRate; // 20

/** 초기 세그먼트 수 = initialMass (1 mass ≈ 1 segment) */
export const INITIAL_SEGMENTS = ARENA_CONFIG.initialMass;

// ─── Orb 설정 ───

export const ORB = {
  NATURAL_VALUE_MIN: 1,
  NATURAL_VALUE_MAX: 2,
  DEATH_VALUE_MIN: 3,
  DEATH_VALUE_MAX: 5,
  /** natural orb 스폰 패딩 (경계에서 떨어진 거리) */
  SPAWN_PADDING: 200,
  /** natural orb 색상 수 */
  COLOR_COUNT: 12,
} as const;

// ─── Network ───

export const NETWORK = {
  /** state 브로드캐스트 주기 (매 틱) */
  STATE_BROADCAST_INTERVAL: 1,
  /** leaderboard 포함 주기 (5틱마다) */
  LEADERBOARD_INTERVAL: 5,
  /** minimap 브로드캐스트 주기 (20틱 = 1초) */
  MINIMAP_INTERVAL: 20,
  /** viewport 마진 (px) — 컬링 시 여분 */
  VIEWPORT_MARGIN: 200,
  /** 최대 input rate (per second) */
  MAX_INPUT_RATE: 30,
  /** respawn cooldown (ms) */
  RESPAWN_COOLDOWN_MS: 2000,
  /** ping interval (ms) */
  PING_INTERVAL_MS: 5000,
  /** reconnect max attempts */
  RECONNECT_ATTEMPTS: 5,
} as const;

// ─── Default Skins ───

/** Brawl Stars 스타일 비비드 스킨 — 강렬한 포화 컬러 */
export const DEFAULT_SKINS: SnakeSkin[] = [
  { id: 0, primaryColor: '#FF4444', secondaryColor: '#CC0000', pattern: 'solid', eyeStyle: 'angry' },   // 파이어 레드
  { id: 1, primaryColor: '#00D4FF', secondaryColor: '#0099CC', pattern: 'solid', eyeStyle: 'cool' },    // 일렉트릭 블루
  { id: 2, primaryColor: '#39FF14', secondaryColor: '#00CC00', pattern: 'solid', eyeStyle: 'default' }, // 네온 그린
  { id: 3, primaryColor: '#FF1493', secondaryColor: '#CC1177', pattern: 'solid', eyeStyle: 'cute' },    // 핫 핑크
  { id: 4, primaryColor: '#FFD700', secondaryColor: '#CC9900', pattern: 'solid', eyeStyle: 'default' }, // 골드 옐로
  { id: 5, primaryColor: '#FF6B00', secondaryColor: '#CC5500', pattern: 'solid', eyeStyle: 'angry' },   // 브라이트 오렌지
  { id: 6, primaryColor: '#9B59B6', secondaryColor: '#7D3C98', pattern: 'solid', eyeStyle: 'cool' },    // 비비드 퍼플
  { id: 7, primaryColor: '#00FFFF', secondaryColor: '#00CCCC', pattern: 'solid', eyeStyle: 'cute' },    // 사이안
  { id: 8, primaryColor: '#FF6B6B', secondaryColor: '#CC4444', pattern: 'solid', eyeStyle: 'default' }, // 코랄
  { id: 9, primaryColor: '#00CED1', secondaryColor: '#009999', pattern: 'solid', eyeStyle: 'cool' },    // 틸
  { id: 10, primaryColor: '#FF00FF', secondaryColor: '#CC00CC', pattern: 'solid', eyeStyle: 'angry' },  // 마젠타
  { id: 11, primaryColor: '#ADFF2F', secondaryColor: '#7FCC00', pattern: 'solid', eyeStyle: 'cute' },   // 라임
];
