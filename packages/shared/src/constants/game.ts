/**
 * Snake Arena — Game Constants v4.0
 * Crayon / Pencil Sketch 스타일
 */

import type { ArenaConfig, SnakeSkin } from '../types/game';

// ─── Arena Config (서버 기본값) ───

export const ARENA_CONFIG: ArenaConfig = {
  radius: 6000,
  maxPlayers: 100,
  tickRate: 20,
  baseSpeed: 150,        // px/s
  boostSpeed: 300,       // px/s (2x)
  turnRate: 0.25,        // rad/tick (5.0 rad/s @ 20Hz — 90도 전환 ~0.3s)
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

// ─── Default Skins (Crayon Sketch) ───

/** 크레용 스케치 스킨 — 24종 (12 solid + 12 patterned) */
export const DEFAULT_SKINS: SnakeSkin[] = [
  // 0-11: solid 스킨 — 크레용 팔레트
  { id: 0, primaryColor: '#C75B5B', secondaryColor: '#D48A8A', pattern: 'solid', eyeStyle: 'dot' },
  { id: 1, primaryColor: '#D4914A', secondaryColor: '#DFB07A', pattern: 'solid', eyeStyle: 'default' },
  { id: 2, primaryColor: '#5B8DAD', secondaryColor: '#8AB4CC', pattern: 'solid', eyeStyle: 'cute' },
  { id: 3, primaryColor: '#7BA868', secondaryColor: '#9FC490', pattern: 'solid', eyeStyle: 'dot' },
  { id: 4, primaryColor: '#8B72A8', secondaryColor: '#AE9AC4', pattern: 'solid', eyeStyle: 'wink' },
  { id: 5, primaryColor: '#D4C36A', secondaryColor: '#E0D494', pattern: 'solid', eyeStyle: 'default' },
  { id: 6, primaryColor: '#C47A8E', secondaryColor: '#D4A0AE', pattern: 'solid', eyeStyle: 'angry' },
  { id: 7, primaryColor: '#7DB89A', secondaryColor: '#A0D0B8', pattern: 'solid', eyeStyle: 'cool' },
  { id: 8, primaryColor: '#82ADC8', secondaryColor: '#A8C8DA', pattern: 'solid', eyeStyle: 'cute' },
  { id: 9, primaryColor: '#B8926A', secondaryColor: '#D0B090', pattern: 'solid', eyeStyle: 'dot' },
  { id: 10, primaryColor: '#A89070', secondaryColor: '#C0AC94', pattern: 'solid', eyeStyle: 'wink' },
  { id: 11, primaryColor: '#6A9B7E', secondaryColor: '#90B8A0', pattern: 'solid', eyeStyle: 'default' },
  // 12-23: 패턴 + 머리 모양 + 꼬리 이펙트 — 크레용 컬러
  { id: 12, primaryColor: '#C75B5B', secondaryColor: '#D4C36A', pattern: 'striped', eyeStyle: 'cute', headShape: 'round', tailEffect: 'bubble' },
  { id: 13, primaryColor: '#D4914A', secondaryColor: '#C47A8E', pattern: 'striped', eyeStyle: 'angry', headShape: 'arrow', tailEffect: 'trail' },
  { id: 14, primaryColor: '#5B8DAD', secondaryColor: '#8B72A8', pattern: 'gradient', eyeStyle: 'dot', headShape: 'round', tailEffect: 'bubble' },
  { id: 15, primaryColor: '#7BA868', secondaryColor: '#D4C36A', pattern: 'gradient', eyeStyle: 'wink', tailEffect: 'spark' },
  { id: 16, primaryColor: '#8B72A8', secondaryColor: '#C75B5B', pattern: 'dotted', eyeStyle: 'cute', headShape: 'diamond', tailEffect: 'bubble' },
  { id: 17, primaryColor: '#D4C36A', secondaryColor: '#D4914A', pattern: 'dotted', eyeStyle: 'cool', headShape: 'round', tailEffect: 'fade' },
  { id: 18, primaryColor: '#7DB89A', secondaryColor: '#5B8DAD', pattern: 'striped', eyeStyle: 'dot', tailEffect: 'bubble' },
  { id: 19, primaryColor: '#C47A8E', secondaryColor: '#8B72A8', pattern: 'gradient', eyeStyle: 'angry', headShape: 'arrow', tailEffect: 'trail' },
  { id: 20, primaryColor: '#82ADC8', secondaryColor: '#7BA868', pattern: 'dotted', eyeStyle: 'wink', tailEffect: 'bubble' },
  { id: 21, primaryColor: '#A89070', secondaryColor: '#D4914A', pattern: 'striped', eyeStyle: 'cute', headShape: 'diamond', tailEffect: 'trail' },
  { id: 22, primaryColor: '#6A9B7E', secondaryColor: '#D4C36A', pattern: 'gradient', eyeStyle: 'default', headShape: 'round', tailEffect: 'bubble' },
  { id: 23, primaryColor: '#B8926A', secondaryColor: '#5B8DAD', pattern: 'dotted', eyeStyle: 'dot', headShape: 'round', tailEffect: 'fade' },
];

// ─── Room Config ───

export const ROOM_CONFIG = {
  ROOM_COUNT: 5,
  MAX_PLAYERS_PER_ROOM: 50,   // 인간 플레이어 최대 (봇 별도)
  ROUND_DURATION: 300,         // 5분
  COUNTDOWN_DURATION: 10,      // 카운트다운 10초
  ENDING_DURATION: 5,          // 결과 화면 5초
  COOLDOWN_DURATION: 15,       // 다음 라운드 대기 15초
  MIN_PLAYERS_TO_START: 2,
  BOTS_PER_ROOM: 15,
  ROOM_ORB_TARGET: 1000,
  LOBBY_UPDATE_INTERVAL: 1000, // 1Hz
  RECENT_WINNERS_COUNT: 10,
} as const;
