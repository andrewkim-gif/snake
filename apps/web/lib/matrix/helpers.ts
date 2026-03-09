/**
 * helpers.ts - 게임 헬퍼 함수들
 * GameCanvas에서 사용하는 유틸리티 함수들
 *
 * v7.0: 맵 오브젝트 시스템 통합
 * v7.25: collision 모듈 사용으로 좌표계 혼동 방지
 *
 * [이식 노트] obstacle/map 관련 외부 의존성 stub 처리
 */

import { Vector2, Enemy, Player, EntityCollisionBox } from './types';
import { distance, normalize, distanceSquared } from './utils/math';

// --- Stub: obstacles.config (원본 ../config/obstacles.config) ---
export interface ObstacleConfig {
  width: number;
  height: number;
}

// Arena 모드에서는 맵 오브젝트/장애물 미사용 → 항상 false 반환
export const getObstacleAtGrid = (_col: number, _row: number, _stageId?: number): { x: number; y: number; config: ObstacleConfig } | null => null;
const isPointInObstacle = (_x: number, _y: number, _ox: number, _oy: number, _config: ObstacleConfig, _buffer: number): boolean => false;
const isCircleInObstacle = (_cx: number, _cy: number, _r: number, _ox: number, _oy: number, _config: ObstacleConfig): boolean => false;

// --- Stub: map module ---
interface MapObject {
  x: number;
  y: number;
  def: { width: number; height: number; collisionWidth?: number; collisionHeight?: number; hasCollision?: boolean };
}

interface CollisionResult {
  collided: boolean;
  object?: MapObject;
  pushX?: number;
  pushY?: number;
}

const findCollidingObjects = (_cx: number, _cy: number, _r: number, _stageId: number, _gameMode: string, _seed: number): CollisionResult => ({ collided: false });
const isObjectAt = (_x: number, _y: number, _stageId: number, _gameMode: string, _seed: number): boolean => false;
const getObjectAtGrid = (_col: number, _row: number, _stageId: number, _gameMode: string, _seed: number): MapObject | null => null;

// --- Stub: collision module ---
interface ModuleCollisionBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

const getObjectCollisionBox = (x: number, y: number, w: number, h: number): ModuleCollisionBox => ({
  left: x - w / 2,
  right: x + w / 2,
  top: y - h,
  bottom: y,
  centerX: x,
  centerY: y - h / 2,
  width: w,
  height: h,
});

const checkAABBCollision = (a: ModuleCollisionBox, b: ModuleCollisionBox): boolean => {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
};

const GRID_SIZE = 32;

// 현재 스테이지 ID (전역 상태)
let currentStageId = 1;
let currentGameMode: 'stage' | 'singularity' | 'tutorial' = 'stage';
let currentMapSeed = 0;

/**
 * 현재 스테이지 ID 설정 (GameCanvas에서 호출)
 */
export const setCurrentStageId = (stageId: number): void => {
  currentStageId = stageId;
};

/**
 * 현재 스테이지 ID 가져오기
 */
export const getCurrentStageId = (): number => {
  return currentStageId;
};

/**
 * 현재 게임 모드 설정
 */
export const setCurrentGameMode = (mode: 'stage' | 'singularity' | 'tutorial'): void => {
  currentGameMode = mode;
};

/**
 * 현재 게임 모드 가져오기
 */
export const getCurrentGameMode = (): 'stage' | 'singularity' | 'tutorial' => {
  return currentGameMode;
};

/**
 * 현재 맵 시드 설정
 */
export const setCurrentMapSeed = (seed: number): void => {
  currentMapSeed = seed;
};

/**
 * 현재 맵 시드 가져오기
 */
export const getCurrentMapSeed = (): number => {
  return currentMapSeed;
};

/**
 * 특정 위치에 장애물이 있는지 확인 (다양한 크기 지원)
 * v7.0: 기존 terrain 장애물 + 새 맵 오브젝트 모두 검사
 */
export const isObstacleAt = (x: number, y: number, bufferRadius: number = 0): boolean => {
  // 1. 기존 terrain 장애물 검사
  const checkRadius = 2;
  const centerCol = Math.floor(x / GRID_SIZE);
  const centerRow = Math.floor(y / GRID_SIZE);

  for (let dc = -checkRadius; dc <= checkRadius; dc++) {
    for (let dr = -checkRadius; dr <= checkRadius; dr++) {
      const col = centerCol + dc;
      const row = centerRow + dr;

      const obstacle = getObstacleAtGrid(col, row, currentStageId);
      if (obstacle) {
        if (isPointInObstacle(x, y, obstacle.x, obstacle.y, obstacle.config, bufferRadius)) {
          return true;
        }
      }
    }
  }

  // 2. v7.0: 새 맵 오브젝트 검사
  // v7.17 FIX: useTileMap과 동일한 시드 계산 사용
  const effectiveSeed = currentMapSeed + currentStageId * 1000;
  if (isObjectAt(x, y, currentStageId, currentGameMode, effectiveSeed)) {
    return true;
  }

  return false;
};

/**
 * 원형 객체와 장애물 충돌 체크 (플레이어/적용)
 * v7.0: 기존 terrain 장애물 + 새 맵 오브젝트 모두 검사
 */
export const isCircleCollidingWithObstacles = (
  cx: number,
  cy: number,
  radius: number
): { collided: boolean; obstacle?: { x: number; y: number; config: ObstacleConfig }; mapObject?: MapObject; pushX?: number; pushY?: number } => {
  // 1. 기존 terrain 장애물 검사
  const checkRadius = 2;
  const centerCol = Math.floor(cx / GRID_SIZE);
  const centerRow = Math.floor(cy / GRID_SIZE);

  for (let dc = -checkRadius; dc <= checkRadius; dc++) {
    for (let dr = -checkRadius; dr <= checkRadius; dr++) {
      const col = centerCol + dc;
      const row = centerRow + dr;

      const obstacle = getObstacleAtGrid(col, row, currentStageId);
      if (obstacle && isCircleInObstacle(cx, cy, radius, obstacle.x, obstacle.y, obstacle.config)) {
        return { collided: true, obstacle };
      }
    }
  }

  // 2. v7.0: 새 맵 오브젝트 검사
  // v7.17 FIX: useTileMap과 동일한 시드 계산 사용
  const effectiveSeed = currentMapSeed + currentStageId * 1000;
  const mapCollision = findCollidingObjects(
    cx, cy, radius,
    currentStageId, currentGameMode, effectiveSeed
  );

  if (mapCollision.collided && mapCollision.object) {
    return {
      collided: true,
      mapObject: mapCollision.object,
      pushX: mapCollision.pushX,
      pushY: mapCollision.pushY,
    };
  }

  return { collided: false };
};

/**
 * 가장 가까운 적 찾기
 * v4.9.2: distanceSquared 사용 - sqrt 제거
 */
export const getNearestEnemy = (
  position: Vector2,
  enemies: Enemy[],
  maxRange: number = 1000
): Enemy | null => {
  let nearest: Enemy | null = null;
  let nearestDistSq = maxRange * maxRange; // v4.9.2: 제곱으로 비교

  for (const enemy of enemies) {
    const distSq = distanceSquared(position, enemy.position);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = enemy;
    }
  }

  return nearest;
};

/**
 * 화면에 보이는 적들 가져오기
 */
export const getEnemiesOnScreen = (
  enemies: Enemy[],
  camX: number,
  camY: number,
  width: number,
  height: number
): Enemy[] => {
  const margin = 100;
  return enemies.filter(e =>
    e.position.x > camX - margin &&
    e.position.x < camX + width + margin &&
    e.position.y > camY - margin &&
    e.position.y < camY + height + margin
  );
};

/**
 * 번개 효과용 점들 생성
 */
export const generateLightningPoints = (
  start: Vector2,
  end: Vector2,
  segments: number
): Vector2[] => {
  const points: Vector2[] = [start];

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = start.x + (end.x - start.x) * t + (Math.random() - 0.5) * 30;
    const y = start.y + (end.y - start.y) * t + (Math.random() - 0.5) * 30;
    points.push({ x, y });
  }

  points.push(end);
  return points;
};

/**
 * 색상 밝기 조절
 */
export const adjustColor = (hex: string, amt: number): string => {
  let col = parseInt(hex.replace('#', ''), 16);
  let r = (col >> 16) + amt;
  let g = ((col >> 8) & 0x00FF) + amt;
  let b = (col & 0x0000FF) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
};

/**
 * Auto Hunt 상태 계산
 */
export interface AutoHuntState {
  move: Vector2;
  aim: Vector2;
}

export const calculateAutoHuntDirection = (
  player: Player,
  enemies: Enemy[],
  smoothedDir: Vector2,
  lastPos: Vector2,
  stuckFrames: number,
  escapeDir: Vector2 | null
): { state: AutoHuntState; newStuckFrames: number; newEscapeDir: Vector2 | null } => {
  const nearestEnemy = getNearestEnemy(player.position, enemies);

  // Stuck detection
  const distMoved = distance(player.position, lastPos);
  let newStuckFrames = distMoved < 0.5 ? stuckFrames + 1 : 0;
  let newEscapeDir = escapeDir;

  // Generate escape direction if stuck
  if (newStuckFrames > 30 && !newEscapeDir) {
    const randomAngle = Math.random() * Math.PI * 2;
    newEscapeDir = { x: Math.cos(randomAngle), y: Math.sin(randomAngle) };
  }

  // Clear escape direction when unstuck
  if (newStuckFrames === 0) {
    newEscapeDir = null;
  }

  // Default aim
  let aim: Vector2 = { x: smoothedDir.x || 1, y: smoothedDir.y || 0 };

  // Calculate move direction
  let move: Vector2 = { x: 0, y: 0 };

  if (newEscapeDir) {
    move = newEscapeDir;
  } else if (nearestEnemy) {
    const toEnemy = normalize({
      x: nearestEnemy.position.x - player.position.x,
      y: nearestEnemy.position.y - player.position.y
    });

    const distToEnemy = distance(player.position, nearestEnemy.position);

    // Aim at enemy
    aim = toEnemy;

    // Move toward enemy if far, kite if close
    if (distToEnemy > 150) {
      move = toEnemy;
    } else if (distToEnemy < 80) {
      move = { x: -toEnemy.x, y: -toEnemy.y };
    }
  }

  return {
    state: { move, aim },
    newStuckFrames,
    newEscapeDir
  };
};

/**
 * 축별 장애물 충돌 체크 (다양한 크기 지원)
 * 플레이어 이동 시 X축/Y축 개별 충돌 검사
 */
export const checkAxisCollision = (
  nextPos: number,
  fixedPos: number,
  playerRadius: number,
  axis: 'x' | 'y',
  checkRadiusGrid: number = 3,
  collisionBox?: EntityCollisionBox
): boolean => {
  const col = axis === 'x' ? Math.floor(nextPos / GRID_SIZE) : Math.floor(fixedPos / GRID_SIZE);
  const row = axis === 'x' ? Math.floor(fixedPos / GRID_SIZE) : Math.floor(nextPos / GRID_SIZE);

  const checkX = axis === 'x' ? nextPos : fixedPos;
  const checkY = axis === 'x' ? fixedPos : nextPos;

  // 플레이어 AABB 계산
  let playerBox: ModuleCollisionBox;

  if (collisionBox) {
    const halfW = collisionBox.width / 2;
    const halfH = collisionBox.height / 2;
    const centerX = checkX + (collisionBox.offsetX || 0);
    const centerY = checkY + collisionBox.offsetY;
    playerBox = {
      left: centerX - halfW,
      right: centerX + halfW,
      top: centerY - halfH,
      bottom: centerY + halfH,
      centerX,
      centerY,
      width: collisionBox.width,
      height: collisionBox.height,
    };
  } else {
    playerBox = {
      left: checkX - playerRadius,
      right: checkX + playerRadius,
      top: checkY - playerRadius,
      bottom: checkY + playerRadius,
      centerX: checkX,
      centerY: checkY,
      width: playerRadius * 2,
      height: playerRadius * 2,
    };
  }

  // 1. 기존 terrain 장애물 체크
  for (let c = col - checkRadiusGrid; c <= col + checkRadiusGrid; c++) {
    for (let r = row - checkRadiusGrid; r <= row + checkRadiusGrid; r++) {
      const obstacle = getObstacleAtGrid(c, r, currentStageId);
      if (!obstacle) continue;

      const { config, x: ox, y: oy } = obstacle;
      const halfW = config.width / 2;
      const halfH = config.height / 2;

      const obstacleBox: ModuleCollisionBox = {
        left: ox - halfW,
        right: ox + halfW,
        top: oy - halfH,
        bottom: oy + halfH,
        centerX: ox,
        centerY: oy,
        width: config.width,
        height: config.height,
      };

      if (checkAABBCollision(playerBox, obstacleBox)) {
        return true;
      }
    }
  }

  // 2. v7.25: 맵 오브젝트 충돌 체크
  const effectiveSeed = currentMapSeed + currentStageId * 1000;

  for (let c = col - checkRadiusGrid; c <= col + checkRadiusGrid; c++) {
    for (let r = row - checkRadiusGrid; r <= row + checkRadiusGrid; r++) {
      const mapObj = getObjectAtGrid(c, r, currentStageId, currentGameMode, effectiveSeed);
      if (!mapObj || !mapObj.def.hasCollision) continue;

      const objBox = getObjectCollisionBox(
        mapObj.x,
        mapObj.y,
        mapObj.def.collisionWidth ?? mapObj.def.width,
        mapObj.def.collisionHeight ?? mapObj.def.height
      );

      if (checkAABBCollision(playerBox, objBox)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * 넉백 적용
 */
export const applyKnockback = (
  targetPos: Vector2,
  sourcePos: Vector2,
  force: number,
  mass: number
): Vector2 => {
  const dir = normalize({
    x: targetPos.x - sourcePos.x,
    y: targetPos.y - sourcePos.y
  });

  const knockbackForce = (force * 10) / mass;

  return {
    x: dir.x * knockbackForce,
    y: dir.y * knockbackForce
  };
};
