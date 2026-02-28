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
  /** natural orb 색상 수 (자연 오브용) */
  COLOR_COUNT: 12,
} as const;

// ─── 파워업 효과 설정 ───

export const EFFECT_CONFIG = {
  magnet: {
    durationTicks: 100,   // 5초 @ 20Hz
    cooldownTicks: 0,
    pullRadius: 200,
    pullSpeed: 3,
    spawnChance: 0.05,
    orbColor: 12,
  },
  speed: {
    durationTicks: 80,    // 4초 @ 20Hz
    cooldownTicks: 0,
    spawnChance: 0.08,
    orbColor: 13,
  },
  ghost: {
    durationTicks: 60,    // 3초 @ 20Hz
    cooldownTicks: 200,   // 10초 쿨다운
    spawnChance: 0.03,
    orbColor: 14,
  },
  mega: {
    value: 30,
    spawnChance: 0.02,
    orbColor: 15,
    lifetime: 600,        // 30초 후 소멸
  },
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

/** Brawl Stars 스타일 비비드 스킨 — 24종 (12 solid + 12 patterned) */
export const DEFAULT_SKINS: SnakeSkin[] = [
  // 0-11: 기존 solid 스킨 유지
  { id: 0, primaryColor: '#FF4444', secondaryColor: '#CC0000', pattern: 'solid', eyeStyle: 'angry' },
  { id: 1, primaryColor: '#00D4FF', secondaryColor: '#0099CC', pattern: 'solid', eyeStyle: 'cool' },
  { id: 2, primaryColor: '#39FF14', secondaryColor: '#00CC00', pattern: 'solid', eyeStyle: 'default' },
  { id: 3, primaryColor: '#FF1493', secondaryColor: '#CC1177', pattern: 'solid', eyeStyle: 'cute' },
  { id: 4, primaryColor: '#FFD700', secondaryColor: '#CC9900', pattern: 'solid', eyeStyle: 'default' },
  { id: 5, primaryColor: '#FF6B00', secondaryColor: '#CC5500', pattern: 'solid', eyeStyle: 'angry' },
  { id: 6, primaryColor: '#9B59B6', secondaryColor: '#7D3C98', pattern: 'solid', eyeStyle: 'cool' },
  { id: 7, primaryColor: '#00FFFF', secondaryColor: '#00CCCC', pattern: 'solid', eyeStyle: 'cute' },
  { id: 8, primaryColor: '#FF6B6B', secondaryColor: '#CC4444', pattern: 'solid', eyeStyle: 'default' },
  { id: 9, primaryColor: '#00CED1', secondaryColor: '#009999', pattern: 'solid', eyeStyle: 'cool' },
  { id: 10, primaryColor: '#FF00FF', secondaryColor: '#CC00CC', pattern: 'solid', eyeStyle: 'angry' },
  { id: 11, primaryColor: '#ADFF2F', secondaryColor: '#7FCC00', pattern: 'solid', eyeStyle: 'cute' },
  // 12-23: 패턴 + 머리 모양 + 꼬리 이펙트
  { id: 12, primaryColor: '#FF4444', secondaryColor: '#FF6B00', pattern: 'striped', eyeStyle: 'angry', headShape: 'diamond', tailEffect: 'spark' },
  { id: 13, primaryColor: '#00D4FF', secondaryColor: '#00FFFF', pattern: 'striped', eyeStyle: 'cool', headShape: 'arrow', tailEffect: 'trail' },
  { id: 14, primaryColor: '#39FF14', secondaryColor: '#ADFF2F', pattern: 'gradient', eyeStyle: 'default', headShape: 'diamond', tailEffect: 'fade' },
  { id: 15, primaryColor: '#FF1493', secondaryColor: '#FF00FF', pattern: 'gradient', eyeStyle: 'cute', tailEffect: 'spark' },
  { id: 16, primaryColor: '#FFD700', secondaryColor: '#FF6B00', pattern: 'dotted', eyeStyle: 'default', headShape: 'arrow', tailEffect: 'trail' },
  { id: 17, primaryColor: '#9B59B6', secondaryColor: '#FF1493', pattern: 'dotted', eyeStyle: 'cool', headShape: 'diamond', tailEffect: 'fade' },
  { id: 18, primaryColor: '#00FFFF', secondaryColor: '#00D4FF', pattern: 'striped', eyeStyle: 'cute', tailEffect: 'spark' },
  { id: 19, primaryColor: '#FF6B6B', secondaryColor: '#FF4444', pattern: 'gradient', eyeStyle: 'angry', headShape: 'arrow', tailEffect: 'trail' },
  { id: 20, primaryColor: '#00CED1', secondaryColor: '#39FF14', pattern: 'dotted', eyeStyle: 'cool', tailEffect: 'fade' },
  { id: 21, primaryColor: '#FF00FF', secondaryColor: '#9B59B6', pattern: 'striped', eyeStyle: 'angry', headShape: 'diamond', tailEffect: 'trail' },
  { id: 22, primaryColor: '#ADFF2F', secondaryColor: '#39FF14', pattern: 'gradient', eyeStyle: 'default', headShape: 'diamond', tailEffect: 'spark' },
  { id: 23, primaryColor: '#FF6B00', secondaryColor: '#FFD700', pattern: 'dotted', eyeStyle: 'cute', headShape: 'arrow', tailEffect: 'fade' },
];
