/**
 * useGameRefs - 게임 상태 Refs 관리 훅
 * GameCanvas에서 사용하는 모든 useRef를 중앙 관리
 */

import React, { useRef } from 'react';
import { GAME_CONFIG, XP_THRESHOLDS, SPECIAL_SKILL, ZOOM_CONFIG } from '../constants';
import {
  Player,
  Enemy,
  Projectile,
  Gem,
  Pickup,
  Blast,
  LightningBolt,
  DamageNumber,
  Vector2,
  EnemyProjectile,
  CriticalEffect,
} from '../types';

export interface ExtendedParticle {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  type?: 'square' | 'text' | 'ring' | 'line' | 'smoke' | 'spark' | 'pixel' | 'hex';
  text?: string;
  width?: number;
  rotation?: number;
  rotSpeed?: number;
  // 몬스터별 특화 효과 (burstStyle 시스템)
  burstStyle?: 'data' | 'pixel' | 'slime' | 'spark' | 'smoke' | 'shatter' | 'electric' | 'gold';
  gravity?: number;      // 중력 (slime, 물리 파티클용)
  flickerRate?: number;  // 깜빡임 (electric용)
  scale?: number;        // 크기 배율

  // === v4 신규: 스타일리쉬 이펙트 시스템 ===

  // 이징 (가속/감속)
  easing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeOutCubic' | 'easeOutExpo' |
           'easeOutElastic' | 'easeOutBounce' | 'easeOutBack' | 'easeInOutCubic' | 'easeInExpo';

  // 글로우 효과
  glow?: {
    enabled: boolean;
    preset: 'soft' | 'intense' | 'electric' | 'matrix' | 'golden' | 'fire' | 'coin' | 'success';
    pulseFreq?: number;  // 펄스 빈도 (Hz)
  };

  // 트레일 (잔상)
  trail?: {
    enabled: boolean;
    length: number;      // 잔상 개수 (최대 10)
    decay: number;       // 투명도 감소율 (0-1)
    positions: Vector2[]; // 이전 위치 기록
  };

  // 딜레이 시작 (순차 발동용)
  delay?: number;        // ms, 생성 후 대기 시간
  delayRemaining?: number; // 남은 딜레이

  // 물리 확장
  drag?: number;         // 공기 저항 (0-1)
  bounce?: number;       // 바운스 계수 (0-1)

  // 크기 변화
  scaleStart?: number;   // 시작 크기
  scaleEnd?: number;     // 종료 크기

  // 색상 변화 (그라데이션)
  colorEnd?: string;     // 종료 색상

  // 그룹화 (동기화용)
  groupId?: string;      // 같은 그룹 파티클 동기화
  groupPhase?: number;   // 그룹 내 위상 (0-1)
}

export interface JoystickState {
  active: boolean;
  origin: Vector2;
  current: Vector2;
  pointerId: number | null;
}

export interface GameRefs {
  // Canvas
  canvas: React.RefObject<HTMLCanvasElement | null>;
  requestId: React.MutableRefObject<number | undefined>;
  previousTime: React.MutableRefObject<number | undefined>;

  // Entities
  player: React.MutableRefObject<Player>;
  enemies: React.MutableRefObject<Enemy[]>;
  projectiles: React.MutableRefObject<Projectile[]>;
  enemyProjectiles: React.MutableRefObject<EnemyProjectile[]>;
  gems: React.MutableRefObject<Gem[]>;
  pickups: React.MutableRefObject<Pickup[]>;
  blasts: React.MutableRefObject<Blast[]>;
  lightningBolts: React.MutableRefObject<LightningBolt[]>;

  // Effects
  particles: React.MutableRefObject<ExtendedParticle[]>;
  damageNumbers: React.MutableRefObject<DamageNumber[]>;
  criticalEffects: React.MutableRefObject<CriticalEffect[]>;

  // Input
  keysPressed: React.MutableRefObject<Set<string>>;
  joystick: React.MutableRefObject<JoystickState>;

  // Timing
  lastSpawnTime: React.MutableRefObject<number>;
  gameTime: React.MutableRefObject<number>;
  stageTime: React.MutableRefObject<number>;
  frameCount: React.MutableRefObject<number>;

  // Direction
  lastFacing: React.MutableRefObject<Vector2>;
  lastMoveFacing: React.MutableRefObject<Vector2>;
  smoothedAutoHuntDir: React.MutableRefObject<Vector2>;

  // Screen Effects
  screenFlash: React.MutableRefObject<number>;
  screenShakeTimer: React.MutableRefObject<number>;
  screenShakeIntensity: React.MutableRefObject<number>;  // v7.8: 화면 쉐이크 강도 (0-1)

  // Stage
  currentStageId: React.MutableRefObject<number>;
  currentWave: React.MutableRefObject<number>;
  bossSpawned: React.MutableRefObject<boolean>;
  warningTriggered: React.MutableRefObject<boolean>;

  // Reporting (prevent duplicate callbacks)
  lastReportedTime: React.MutableRefObject<number>;
  lastReportedScore: React.MutableRefObject<number>;
  lastReportedXp: React.MutableRefObject<number>;

  // Timing (sound/attack throttling)
  lastAttackTime: React.MutableRefObject<number>;
  lastDamageTime: React.MutableRefObject<number>;
  lastHitSfx: React.MutableRefObject<number>;
  lastCollectSfx: React.MutableRefObject<number>;

  // Auto Hunt
  lastAutoHuntPos: React.MutableRefObject<Vector2>;
  stuckFrameCount: React.MutableRefObject<number>;
  escapeDir: React.MutableRefObject<Vector2 | null>;

  // Camera Zoom
  currentZoom: React.MutableRefObject<number>;
  targetZoom: React.MutableRefObject<number>;
}

export function useGameRefs(): GameRefs {
  // Canvas
  const canvas = useRef<HTMLCanvasElement>(null);
  const requestId = useRef<number | undefined>(undefined);
  const previousTime = useRef<number | undefined>(undefined);

  // Player
  const player = useRef<Player>({
    id: 'player',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: GAME_CONFIG.PLAYER_RADIUS,
    // v7.22: 박스 충돌 추가 (이소메트릭 캐릭터에 맞춤)
    collisionBox: GAME_CONFIG.PLAYER_COLLISION_BOX,
    color: GAME_CONFIG.PLAYER_COLOR,
    health: GAME_CONFIG.PLAYER_HP,
    maxHealth: GAME_CONFIG.PLAYER_HP,
    speed: GAME_CONFIG.PLAYER_SPEED,
    angle: 0,
    score: 0,
    invulnerabilityTimer: 0,
    level: 1,
    xp: 0,
    nextLevelXp: XP_THRESHOLDS[1],
    weapons: {},
    weaponCooldowns: {},
    specialCooldown: 0,
    maxSpecialCooldown: SPECIAL_SKILL.COOLDOWN,
    shield: 0,
    maxShield: 0,
    playerClass: 'neo',
    knockback: { x: 0, y: 0 },
    hitFlashTimer: 0,
    criticalChance: 0.05,      // 기본 5%
    criticalMultiplier: 2.0,   // 기본 2배
    statMultipliers: { speed: 1, cooldown: 1, damage: 1, health: 1 }
  });

  // Entities
  const enemies = useRef<Enemy[]>([]);
  const projectiles = useRef<Projectile[]>([]);
  const enemyProjectiles = useRef<EnemyProjectile[]>([]);
  const gems = useRef<Gem[]>([]);
  const pickups = useRef<Pickup[]>([]);
  const blasts = useRef<Blast[]>([]);
  const lightningBolts = useRef<LightningBolt[]>([]);

  // Effects
  const particles = useRef<ExtendedParticle[]>([]);
  const damageNumbers = useRef<DamageNumber[]>([]);
  const criticalEffects = useRef<CriticalEffect[]>([]);

  // Input
  const keysPressed = useRef<Set<string>>(new Set());
  const joystick = useRef<JoystickState>({
    active: false,
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    pointerId: null
  });

  // Timing
  const lastSpawnTime = useRef<number>(0);
  const gameTime = useRef<number>(0);
  const stageTime = useRef<number>(0);
  const frameCount = useRef<number>(0);

  // Direction
  const lastFacing = useRef<Vector2>({ x: 0, y: 1 });  // 공격/조준 방향
  const lastMoveFacing = useRef<Vector2>({ x: 1, y: 0 });  // 이동 방향 (캐릭터 렌더링용)
  const smoothedAutoHuntDir = useRef<Vector2>({ x: 0, y: 0 });

  // Screen Effects
  const screenFlash = useRef<number>(0);
  const screenShakeTimer = useRef<number>(0);
  const screenShakeIntensity = useRef<number>(0);  // v7.8: 화면 쉐이크 강도 (0-1)

  // Stage & Wave
  const currentStageId = useRef<number>(1);
  const currentWave = useRef<number>(1);  // 웨이브 시스템
  const bossSpawned = useRef<boolean>(false);
  const warningTriggered = useRef<boolean>(false);

  // Reporting
  const lastReportedTime = useRef<number>(-1);
  const lastReportedScore = useRef<number>(-1);
  const lastReportedXp = useRef<number>(-1);

  // Timing throttling
  const lastAttackTime = useRef<number>(0);
  const lastDamageTime = useRef<number>(0);
  const lastHitSfx = useRef<number>(0);
  const lastCollectSfx = useRef<number>(0);

  // Auto Hunt
  const lastAutoHuntPos = useRef<Vector2>({ x: 0, y: 0 });
  const stuckFrameCount = useRef<number>(0);
  const escapeDir = useRef<Vector2 | null>(null);

  // Camera Zoom - 초기값을 DEFAULT_ZOOM으로 설정 (게임 시작 시 줌 점프 방지)
  const currentZoom = useRef<number>(ZOOM_CONFIG.DEFAULT_ZOOM);
  const targetZoom = useRef<number>(ZOOM_CONFIG.DEFAULT_ZOOM);

  return {
    canvas,
    requestId,
    previousTime,
    player,
    enemies,
    projectiles,
    enemyProjectiles,
    gems,
    pickups,
    blasts,
    lightningBolts,
    particles,
    damageNumbers,
    criticalEffects,
    keysPressed,
    joystick,
    lastSpawnTime,
    gameTime,
    stageTime,
    frameCount,
    lastFacing,
    lastMoveFacing,
    smoothedAutoHuntDir,
    screenFlash,
    screenShakeTimer,
    screenShakeIntensity,
    currentStageId,
    currentWave,
    bossSpawned,
    warningTriggered,
    lastReportedTime,
    lastReportedScore,
    lastReportedXp,
    lastAttackTime,
    lastDamageTime,
    lastHitSfx,
    lastCollectSfx,
    lastAutoHuntPos,
    stuckFrameCount,
    escapeDir,
    currentZoom,
    targetZoom,
  };
}
