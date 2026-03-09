/**
 * spawnController.ts - 몬스터 스폰 컨트롤러
 * Wave Pool (종류 제한) + Formation (패턴 스폰) 시스템
 */

import { EnemyType, Vector2, Enemy, Player } from '../types';
// Stage system removed for Arena mode - using default monster pool
import { GAME_CONFIG } from '../constants';

// Default arena monsters (replaces ARENA_MONSTERS)
const ARENA_MONSTERS: EnemyType[] = ['glitch', 'bot', 'malware', 'bitling', 'spammer', 'worm', 'crypter'];
import { isObstacleAt } from '../helpers';

// ===========================
// Types
// ===========================

export type FormationType = 'line' | 'circle' | 'v_shape' | 'cluster' | 'wave' | 'pincer';

export interface WavePool {
  activeTypes: EnemyType[];     // 현재 활성화된 적 타입 (2-3종류)
  poolDuration: number;         // 풀 유지 시간 (초)
  poolTimer: number;            // 현재 타이머
  transitionEffect: boolean;    // 전환 이펙트 표시 여부
}

export interface FormationWarning {
  active: boolean;
  positions: Vector2[];
  timer: number;
  enemyType: EnemyType;
}

export interface SpawnState {
  // Wave Pool
  wavePool: WavePool;

  // Formation
  formationTimer: number;
  formationInterval: number;      // 10-20초
  formationWarning: FormationWarning;
  pendingFormation: {
    type: FormationType;
    positions: Vector2[];
    enemyType: EnemyType;
  } | null;

  // Background Spawn
  backgroundTimer: number;
  backgroundRate: number;

  // Stats
  lastFormationTime: number;
}

export interface SpawnResult {
  shouldSpawnBackground: boolean;
  activeTypes: EnemyType[];
  poolChanged: boolean;
  formationTriggered: boolean;
}

// ===========================
// Configuration
// ===========================

interface FormationStageConfig {
  poolDuration: number;
  typeCount: number | [number, number];  // 고정 또는 [min, max]
  formationInterval: [number, number];   // [min, max] 초
  availableFormations: FormationType[];
  formationSize: { min: number; max: number };
}

const FORMATION_CONFIG_BY_STAGE: Record<number, FormationStageConfig> = {
  // Stage 1-5: 초반 (간단한 포메이션)
  1: {
    poolDuration: 40,
    typeCount: 2,
    formationInterval: [18, 25],
    availableFormations: ['line', 'cluster'],
    formationSize: { min: 5, max: 8 }
  },
  // Stage 6-10: 중초반
  6: {
    poolDuration: 35,
    typeCount: 2,
    formationInterval: [15, 22],
    availableFormations: ['line', 'cluster', 'v_shape'],
    formationSize: { min: 6, max: 10 }
  },
  // Stage 11-15: 중반
  11: {
    poolDuration: 32,
    typeCount: [2, 3],
    formationInterval: [12, 18],
    availableFormations: ['line', 'cluster', 'v_shape', 'circle'],
    formationSize: { min: 7, max: 12 }
  },
  // Stage 16-20: 중후반
  16: {
    poolDuration: 30,
    typeCount: 3,
    formationInterval: [10, 16],
    availableFormations: ['line', 'cluster', 'v_shape', 'circle', 'wave'],
    formationSize: { min: 8, max: 14 }
  },
  // Stage 21-25: 후반
  21: {
    poolDuration: 28,
    typeCount: 3,
    formationInterval: [10, 14],
    availableFormations: ['line', 'cluster', 'v_shape', 'circle', 'wave', 'pincer'],
    formationSize: { min: 10, max: 16 }
  },
  // Stage 26-30: 최종
  26: {
    poolDuration: 25,
    typeCount: 3,
    formationInterval: [8, 12],
    availableFormations: ['line', 'cluster', 'v_shape', 'circle', 'wave', 'pincer'],
    formationSize: { min: 12, max: 18 }
  }
};

// 스테이지에 맞는 설정 가져오기
function getConfigForStage(stageNum: number): FormationStageConfig {
  const stages = [26, 21, 16, 11, 6, 1];
  for (const threshold of stages) {
    if (stageNum >= threshold) {
      return FORMATION_CONFIG_BY_STAGE[threshold];
    }
  }
  return FORMATION_CONFIG_BY_STAGE[1];
}

// ===========================
// Wave Pool Functions
// ===========================

/**
 * 새로운 Wave Pool 생성 (2-3종류 랜덤 선택)
 */
export function refreshWavePool(
  stageEnemies: EnemyType[],
  stageNum: number
): EnemyType[] {
  const config = getConfigForStage(stageNum);

  // 종류 수 결정
  let typeCount: number;
  if (Array.isArray(config.typeCount)) {
    typeCount = config.typeCount[0] + Math.floor(Math.random() * (config.typeCount[1] - config.typeCount[0] + 1));
  } else {
    typeCount = config.typeCount;
  }

  // 적 타입이 부족하면 있는 만큼만
  typeCount = Math.min(typeCount, stageEnemies.length);

  // 랜덤 셔플 후 선택
  const shuffled = [...stageEnemies].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, typeCount);
}

/**
 * SpawnState 초기화
 */
export function createSpawnState(stageNum: number): SpawnState {
  const config = getConfigForStage(stageNum);
  const uniqueEnemies: EnemyType[] = ARENA_MONSTERS.slice(0, Math.min(stageNum + 3, ARENA_MONSTERS.length));

  const formationInterval = config.formationInterval[0] +
    Math.random() * (config.formationInterval[1] - config.formationInterval[0]);

  return {
    wavePool: {
      activeTypes: refreshWavePool(uniqueEnemies, stageNum),
      poolDuration: config.poolDuration,
      poolTimer: config.poolDuration,
      transitionEffect: false,
    },
    formationTimer: formationInterval * 0.5, // 첫 포메이션은 절반 시간 후
    formationInterval,
    formationWarning: {
      active: false,
      positions: [],
      timer: 0,
      enemyType: 'glitch' as EnemyType,
    },
    pendingFormation: null,
    backgroundTimer: 0,
    backgroundRate: 800, // ms
    lastFormationTime: 0,
  };
}

// ===========================
// Formation Position Generators
// ===========================

const SPAWN_RADIUS = GAME_CONFIG.SPAWN_RADIUS || 400;

/**
 * 스폰 위치 계산 (플레이어 주변 원형 영역에서)
 */
function getSpawnCenter(player: Player): Vector2 {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: player.position.x + Math.cos(angle) * SPAWN_RADIUS,
    y: player.position.y + Math.sin(angle) * SPAWN_RADIUS,
  };
}

/**
 * LINE 포메이션: 일렬 횡대
 */
function generateLinePositions(
  center: Vector2,
  count: number,
  spacing: number,
  player: Player
): Vector2[] {
  const positions: Vector2[] = [];
  const angle = Math.atan2(player.position.y - center.y, player.position.x - center.x);
  const perpAngle = angle + Math.PI / 2;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    positions.push({
      x: center.x + Math.cos(perpAngle) * offset,
      y: center.y + Math.sin(perpAngle) * offset,
    });
  }
  return positions;
}

/**
 * CIRCLE 포메이션: 원형 포위
 */
function generateCirclePositions(
  center: Vector2,
  count: number,
  radius: number
): Vector2[] {
  const positions: Vector2[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    positions.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return positions;
}

/**
 * V_SHAPE 포메이션: V자 공격
 */
function generateVShapePositions(
  center: Vector2,
  count: number,
  spacing: number,
  direction: number
): Vector2[] {
  const positions: Vector2[] = [];
  const halfCount = Math.floor(count / 2);
  const spreadAngle = 0.4; // ~23도

  // 리더 (앞)
  positions.push({ ...center });

  // 양쪽 날개
  for (let i = 1; i <= halfCount; i++) {
    // 좌측 날개
    positions.push({
      x: center.x - Math.cos(direction - spreadAngle) * i * spacing,
      y: center.y - Math.sin(direction - spreadAngle) * i * spacing,
    });
    // 우측 날개
    if (positions.length < count) {
      positions.push({
        x: center.x - Math.cos(direction + spreadAngle) * i * spacing,
        y: center.y - Math.sin(direction + spreadAngle) * i * spacing,
      });
    }
  }
  return positions.slice(0, count);
}

/**
 * CLUSTER 포메이션: 군집
 */
function generateClusterPositions(
  center: Vector2,
  count: number,
  radius: number
): Vector2[] {
  const positions: Vector2[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    positions.push({
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    });
  }
  return positions;
}

/**
 * WAVE 포메이션: 파도
 */
function generateWavePositions(
  center: Vector2,
  count: number,
  spacing: number,
  direction: number
): Vector2[] {
  const positions: Vector2[] = [];
  const cols = Math.min(5, count);
  const rows = Math.ceil(count / cols);
  const perpAngle = direction + Math.PI / 2;

  let idx = 0;
  for (let row = 0; row < rows && idx < count; row++) {
    for (let col = 0; col < cols && idx < count; col++) {
      const xOffset = (col - (cols - 1) / 2) * spacing;
      const yOffset = row * spacing;
      positions.push({
        x: center.x + Math.cos(perpAngle) * xOffset - Math.cos(direction) * yOffset,
        y: center.y + Math.sin(perpAngle) * xOffset - Math.sin(direction) * yOffset,
      });
      idx++;
    }
  }
  return positions;
}

/**
 * PINCER 포메이션: 협공 (양쪽에서)
 */
function generatePincerPositions(
  player: Player,
  count: number,
  distance: number,
  spread: number
): Vector2[] {
  const positions: Vector2[] = [];
  const countPerSide = Math.ceil(count / 2);

  // 좌측 그룹
  for (let i = 0; i < countPerSide; i++) {
    const yOffset = (i - (countPerSide - 1) / 2) * spread;
    positions.push({
      x: player.position.x - distance,
      y: player.position.y + yOffset,
    });
  }

  // 우측 그룹
  for (let i = 0; i < countPerSide && positions.length < count; i++) {
    const yOffset = (i - (countPerSide - 1) / 2) * spread;
    positions.push({
      x: player.position.x + distance,
      y: player.position.y + yOffset,
    });
  }

  return positions.slice(0, count);
}

/**
 * 포메이션 타입에 따른 위치 생성
 */
export function generateFormationPositions(
  type: FormationType,
  player: Player,
  count: number
): Vector2[] {
  const center = type === 'circle' ? player.position : getSpawnCenter(player);
  const direction = Math.atan2(
    player.position.y - center.y,
    player.position.x - center.x
  );

  switch (type) {
    case 'line':
      return generateLinePositions(center, count, 40, player);

    case 'circle':
      // 원형은 플레이어 주변에 배치
      return generateCirclePositions(player.position, count, SPAWN_RADIUS * 0.8);

    case 'v_shape':
      return generateVShapePositions(center, count, 45, direction);

    case 'cluster':
      return generateClusterPositions(center, count, 60);

    case 'wave':
      return generateWavePositions(center, count, 35, direction);

    case 'pincer':
      return generatePincerPositions(player, count, SPAWN_RADIUS, 50);

    default:
      return generateClusterPositions(center, count, 60);
  }
}

/**
 * 유효한 스폰 위치인지 확인 (지형지물 체크)
 */
function filterValidPositions(positions: Vector2[]): Vector2[] {
  return positions.filter(pos => !isObstacleAt(pos.x, pos.y, 20));
}

// ===========================
// Main Controller
// ===========================

/**
 * 스폰 컨트롤러 업데이트
 */
export function updateSpawnController(
  state: SpawnState,
  deltaTime: number,
  player: Player,
  stageNum: number,
  currentEnemyCount: number,
  gameTime: number
): SpawnResult {
  const config = getConfigForStage(stageNum);
  const uniqueEnemies: EnemyType[] = ARENA_MONSTERS.slice(0, Math.min(stageNum + 3, ARENA_MONSTERS.length));

  let poolChanged = false;
  let formationTriggered = false;

  // 1. Wave Pool 타이머 업데이트
  state.wavePool.poolTimer -= deltaTime;
  state.wavePool.transitionEffect = false;

  if (state.wavePool.poolTimer <= 0) {
    // 새로운 적 풀 선택
    state.wavePool.activeTypes = refreshWavePool(uniqueEnemies, stageNum);
    state.wavePool.poolTimer = state.wavePool.poolDuration;
    state.wavePool.transitionEffect = true;
    poolChanged = true;
  }

  // 2. Formation Warning 업데이트
  if (state.formationWarning.active) {
    state.formationWarning.timer -= deltaTime;
    if (state.formationWarning.timer <= 0) {
      state.formationWarning.active = false;
    }
  }

  // 3. Formation 타이머 업데이트
  state.formationTimer -= deltaTime;

  // 포메이션 스폰 조건: 타이머 만료 + 적 수 여유 있음
  const maxEnemies = GAME_CONFIG.MAX_ENEMIES || 400;
  const formationHeadroom = 15; // 포메이션 스폰 여유분

  if (
    state.formationTimer <= 0 &&
    currentEnemyCount < maxEnemies - formationHeadroom &&
    !state.pendingFormation
  ) {
    // 랜덤 포메이션 선택
    const formationType = config.availableFormations[
      Math.floor(Math.random() * config.availableFormations.length)
    ];

    // 랜덤 적 종류 선택 (활성 풀에서)
    const enemyType = state.wavePool.activeTypes[
      Math.floor(Math.random() * state.wavePool.activeTypes.length)
    ];

    // 포메이션 크기 결정
    const formationCount = config.formationSize.min +
      Math.floor(Math.random() * (config.formationSize.max - config.formationSize.min + 1));

    // 위치 생성
    const positions = generateFormationPositions(formationType, player, formationCount);
    const validPositions = filterValidPositions(positions);

    if (validPositions.length >= 3) { // 최소 3마리는 스폰되어야 의미 있음
      // 경고 표시 설정
      state.formationWarning = {
        active: true,
        positions: validPositions,
        timer: 0.8, // 0.8초 경고
        enemyType,
      };

      // 펜딩 포메이션 설정 (경고 후 스폰)
      state.pendingFormation = {
        type: formationType,
        positions: validPositions,
        enemyType,
      };

      formationTriggered = true;
    }

    // 다음 포메이션 타이머 설정
    state.formationTimer = config.formationInterval[0] +
      Math.random() * (config.formationInterval[1] - config.formationInterval[0]);
    state.lastFormationTime = gameTime;
  }

  // 4. Background 스폰 타이머 (밀리초 -> 초 변환)
  state.backgroundTimer -= deltaTime * 1000;
  const shouldSpawnBackground = state.backgroundTimer <= 0 && currentEnemyCount < maxEnemies;

  if (shouldSpawnBackground) {
    state.backgroundTimer = state.backgroundRate;
  }

  return {
    shouldSpawnBackground,
    activeTypes: state.wavePool.activeTypes,
    poolChanged,
    formationTriggered,
  };
}

/**
 * 펜딩 포메이션 가져오기 및 클리어
 */
export function consumePendingFormation(state: SpawnState): {
  type: FormationType;
  positions: Vector2[];
  enemyType: EnemyType;
} | null {
  // 경고 타이머가 끝났는지 확인
  if (!state.pendingFormation || state.formationWarning.active) {
    return null;
  }

  const formation = state.pendingFormation;
  state.pendingFormation = null;
  return formation;
}

/**
 * 포메이션 경고 정보 가져오기 (렌더링용)
 */
export function getFormationWarning(state: SpawnState): FormationWarning | null {
  if (!state.formationWarning.active) {
    return null;
  }
  return state.formationWarning;
}

/**
 * 현재 활성 적 타입 가져오기
 */
export function getActiveEnemyTypes(state: SpawnState): EnemyType[] {
  return state.wavePool.activeTypes;
}

/**
 * Wave Pool 전환 효과 표시 여부
 */
export function shouldShowPoolTransition(state: SpawnState): boolean {
  return state.wavePool.transitionEffect;
}

/**
 * 랜덤 적 타입 선택 (활성 풀에서)
 */
export function pickRandomActiveType(state: SpawnState): EnemyType {
  const types = state.wavePool.activeTypes;
  return types[Math.floor(Math.random() * types.length)];
}
