/**
 * obstacles.config.ts - 지형지물 충돌 설정
 * SCHOOL SURVIVOR - 학교 테마 지형지물
 * 스테이지별 지형지물의 충돌 박스 정의
 * 렌더링은 rendering.ts의 drawTerrainFeature에서 처리
 *
 * Ported from app_ingame/config/obstacles.config.ts
 */

// 스테이지별 지형지물 유형 (학교 구역)
export type TerrainType = 'classroom' | 'cafeteria' | 'gym' | 'science' | 'admin' | 'escape' | 'singularity';

// 지형지물 서브타입 (hash 값에 따라 결정)
export type TerrainSubtype =
  // classroom (스테이지 1-5): 교실동
  | 'desk' | 'locker' | 'chalkboard'
  // cafeteria (스테이지 6-10): 급식실
  | 'lunch_table' | 'food_cart' | 'vending_machine'
  // gym (스테이지 11-15): 체육관
  | 'basketball_hoop' | 'gym_mat' | 'bleachers'
  // science (스테이지 16-20): 과학실
  | 'lab_table' | 'microscope' | 'skeleton_model'
  // admin (스테이지 21-25): 본관
  | 'office_desk' | 'file_cabinet' | 'trophy_case'
  // escape (스테이지 26-30): 탈출
  | 'barricade' | 'debris' | 'exit_sign'
  // singularity (한계돌파)
  | 'overturned_bus' | 'military_barrier' | 'infected_zone' | 'helicopter_wreck';

export interface TerrainCollision {
  subtype: TerrainSubtype;
  width: number;   // 충돌 박스 너비
  height: number;  // 충돌 박스 높이
  offsetY: number; // Y축 오프셋 (중심 기준)
}

/**
 * 지형지물별 충돌 박스 설정
 * SCHOOL SURVIVOR - 학교 테마
 * 렌더링 크기에 맞춰 조정됨
 */
const TERRAIN_COLLISIONS: Record<TerrainSubtype, Omit<TerrainCollision, 'subtype'>> = {
  // classroom (스테이지 1-5): 교실동
  desk:            { width: 28, height: 20, offsetY: 0 },  // 학생 책상
  locker:          { width: 16, height: 32, offsetY: 0 },  // 사물함
  chalkboard:      { width: 32, height: 24, offsetY: 0 },  // 칠판

  // cafeteria (스테이지 6-10): 급식실
  lunch_table:     { width: 32, height: 20, offsetY: 0 },  // 급식 테이블
  food_cart:       { width: 24, height: 24, offsetY: 0 },  // 배식 카트
  vending_machine: { width: 20, height: 32, offsetY: 0 },  // 자판기

  // gym (스테이지 11-15): 체육관
  basketball_hoop: { width: 20, height: 36, offsetY: -4 }, // 농구대
  gym_mat:         { width: 28, height: 20, offsetY: 0 },  // 체육 매트
  bleachers:       { width: 32, height: 28, offsetY: 0 },  // 관람석

  // science (스테이지 16-20): 과학실
  lab_table:       { width: 28, height: 20, offsetY: 0 },  // 실험대
  microscope:      { width: 16, height: 24, offsetY: 0 },  // 현미경
  skeleton_model:  { width: 16, height: 36, offsetY: 0 },  // 인체 모형

  // admin (스테이지 21-25): 본관
  office_desk:     { width: 28, height: 24, offsetY: 0 },  // 사무 책상
  file_cabinet:    { width: 18, height: 32, offsetY: 0 },  // 서류함
  trophy_case:     { width: 24, height: 32, offsetY: 0 },  // 트로피 진열장

  // escape (스테이지 26-30): 탈출
  barricade:       { width: 32, height: 20, offsetY: 0 },  // 바리케이드
  debris:          { width: 28, height: 24, offsetY: 0 },  // 잔해/파편
  exit_sign:       { width: 20, height: 16, offsetY: -8 }, // 비상구 표지판

  // singularity (한계돌파) - 대형 장애물
  overturned_bus:  { width: 48, height: 28, offsetY: 0 },  // 전복된 버스
  military_barrier:{ width: 32, height: 24, offsetY: 0 },  // 군용 바리케이드
  infected_zone:   { width: 28, height: 28, offsetY: 0 },  // 감염 구역
  helicopter_wreck:{ width: 40, height: 32, offsetY: 0 },  // 추락한 헬기
};

const GRID_SIZE = 32;

/**
 * 스테이지 ID로 지형 타입 결정
 * SCHOOL SURVIVOR - 학교 구역
 */
export const getTerrainType = (stageId: number): TerrainType => {
  if (stageId >= 999) return 'singularity';  // 한계돌파 모드
  if (stageId <= 5) return 'classroom';      // 교실동
  if (stageId <= 10) return 'cafeteria';     // 급식실
  if (stageId <= 15) return 'gym';           // 체육관
  if (stageId <= 20) return 'science';       // 과학실
  if (stageId <= 25) return 'admin';         // 본관
  return 'escape';                            // 탈출
};

/**
 * 해시 기반 랜덤 (일관된 결과)
 */
const seededRandom = (x: number, y: number, seed: number = 0): number => {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7823) * 43758.5453) % 1;
};

/**
 * hash 값으로 지형지물 서브타입 결정
 * SCHOOL SURVIVOR - 학교 테마
 */
const getTerrainSubtype = (terrain: TerrainType, hash: number): TerrainSubtype => {
  switch (terrain) {
    case 'classroom':    // 교실동 (1-5)
      if (hash < 0.5) return 'desk';
      if (hash < 0.8) return 'locker';
      return 'chalkboard';
    case 'cafeteria':    // 급식실 (6-10)
      if (hash < 0.45) return 'lunch_table';
      if (hash < 0.75) return 'food_cart';
      return 'vending_machine';
    case 'gym':          // 체육관 (11-15)
      if (hash < 0.35) return 'basketball_hoop';
      if (hash < 0.7) return 'gym_mat';
      return 'bleachers';
    case 'science':      // 과학실 (16-20)
      if (hash < 0.4) return 'lab_table';
      if (hash < 0.7) return 'microscope';
      return 'skeleton_model';
    case 'admin':        // 본관 (21-25)
      if (hash < 0.4) return 'office_desk';
      if (hash < 0.75) return 'file_cabinet';
      return 'trophy_case';
    case 'escape':       // 탈출 (26-30)
      if (hash < 0.4) return 'barricade';
      if (hash < 0.7) return 'debris';
      return 'exit_sign';
    case 'singularity':  // 한계돌파
      if (hash < 0.25) return 'overturned_bus';
      if (hash < 0.5) return 'military_barrier';
      if (hash < 0.75) return 'infected_zone';
      return 'helicopter_wreck';
  }
};

/**
 * 그리드 위치에서 지형지물 충돌 정보 가져오기
 * @param col 그리드 열
 * @param row 그리드 행
 * @param stageId 현재 스테이지 ID
 * @returns 충돌 정보 또는 null (지형지물 없음)
 */
export const getTerrainAtGrid = (
  col: number,
  row: number,
  stageId: number = 1
): { collision: TerrainCollision; x: number; y: number } | null => {
  // v6.9: 플레이어 스폰 위치(0,0) 주변 17x17 그리드는 장애물 생성 금지
  // 게임 시작 시 넓은 안전 영역 확보 (+-8 그리드 = ~256px 반경)
  const SPAWN_SAFE_RADIUS = 8;
  if (Math.abs(col) <= SPAWN_SAFE_RADIUS && Math.abs(row) <= SPAWN_SAFE_RADIUS) {
    return null;
  }

  const hash = seededRandom(col, row, stageId);

  // 스테이지별 지형지물 밀도 조절 - 10%로 대폭 감소 (도파민 컨셉: 몹에 집중)
  // 기존 대비 10%로 줄임: 1.5% -> 0.15%, 2% -> 0.2%, 2.5% -> 0.25%, 3% -> 0.3%
  let density: number;
  if (stageId >= 999) {
    // 한계돌파 모드: 0.2% 밀도 (기존 2%의 10%)
    density = 0.002;
  } else {
    const densityByStage = [
      0.0015, 0.0015, 0.0015, 0.0015, 0.0015,  // 1-5: mining 0.15%
      0.002, 0.002, 0.002, 0.002, 0.002,        // 6-10: market 0.2%
      0.0025, 0.0025, 0.0025, 0.0025, 0.0025,  // 11-15: hack 0.25%
      0.002, 0.002, 0.002, 0.002, 0.002,        // 16-20: infra 0.2%
      0.0015, 0.0015, 0.0015, 0.0015, 0.0015,  // 21-25: regulation 0.15%
      0.0025, 0.0025, 0.0025, 0.003, 0.003,    // 26-30: void 0.25-0.3%
    ];
    density = densityByStage[Math.min(stageId - 1, 29)] || 0.0015;
  }
  const threshold = 1 - density;

  if (hash < threshold) return null;

  // threshold-1.0 범위를 0-1로 정규화하여 서브타입 결정에 사용
  const subtypeHash = (hash - threshold) / density;

  const terrain = getTerrainType(stageId);
  const subtype = getTerrainSubtype(terrain, subtypeHash);
  const collisionData = TERRAIN_COLLISIONS[subtype];

  return {
    collision: {
      subtype,
      ...collisionData,
    },
    x: col * GRID_SIZE + GRID_SIZE / 2,
    y: row * GRID_SIZE + GRID_SIZE / 2 + collisionData.offsetY,
  };
};

/**
 * 특정 위치에 지형지물이 있는지 확인
 * @param x 월드 X 좌표
 * @param y 월드 Y 좌표
 * @param bufferRadius 버퍼 반경
 * @param stageId 스테이지 ID
 */
export const isTerrainAt = (
  x: number,
  y: number,
  bufferRadius: number = 0,
  stageId: number = 1
): boolean => {
  // 주변 그리드 셀 검사 (큰 장애물도 감지하기 위해 범위 확장)
  const checkRadius = 2;
  const centerCol = Math.floor(x / GRID_SIZE);
  const centerRow = Math.floor(y / GRID_SIZE);

  for (let dc = -checkRadius; dc <= checkRadius; dc++) {
    for (let dr = -checkRadius; dr <= checkRadius; dr++) {
      const col = centerCol + dc;
      const row = centerRow + dr;

      const terrain = getTerrainAtGrid(col, row, stageId);
      if (terrain) {
        if (isPointInTerrain(x, y, terrain.x, terrain.y, terrain.collision, bufferRadius)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * AABB 충돌 체크 (지형지물과 포인트)
 */
export const isPointInTerrain = (
  px: number,
  py: number,
  tx: number,
  ty: number,
  collision: TerrainCollision,
  buffer: number = 0
): boolean => {
  const halfW = collision.width / 2 + buffer;
  const halfH = collision.height / 2 + buffer;

  return (
    px > tx - halfW &&
    px < tx + halfW &&
    py > ty - halfH &&
    py < ty + halfH
  );
};

/**
 * AABB 충돌 체크 (지형지물과 원)
 */
export const isCircleInTerrain = (
  cx: number,
  cy: number,
  radius: number,
  tx: number,
  ty: number,
  collision: TerrainCollision
): boolean => {
  const halfW = collision.width / 2;
  const halfH = collision.height / 2;

  // 원의 중심에서 사각형까지의 최단 거리 계산
  const closestX = Math.max(tx - halfW, Math.min(cx, tx + halfW));
  const closestY = Math.max(ty - halfH, Math.min(cy, ty + halfH));

  const distX = cx - closestX;
  const distY = cy - closestY;

  return (distX * distX + distY * distY) < (radius * radius);
};

// ===== 하위 호환성을 위한 alias (기존 코드가 깨지지 않도록) =====

// 기존 ObstacleConfig 타입 유지 (내부적으로 TerrainCollision 사용)
export interface ObstacleConfig {
  type: string;
  name: string;
  width: number;
  height: number;
  renderScale: number;
  color: string;
  rarity: number;
}

/**
 * 하위 호환: getObstacleAtGrid -> getTerrainAtGrid 래퍼
 */
export const getObstacleAtGrid = (
  col: number,
  row: number,
  stageId: number = 1
): { config: ObstacleConfig; x: number; y: number } | null => {
  const terrain = getTerrainAtGrid(col, row, stageId);
  if (!terrain) return null;

  // TerrainCollision을 ObstacleConfig 형태로 변환
  return {
    config: {
      type: terrain.collision.subtype,
      name: terrain.collision.subtype,
      width: terrain.collision.width,
      height: terrain.collision.height,
      renderScale: 1.0,
      color: '#64748b',
      rarity: 0.005,
    },
    x: terrain.x,
    y: terrain.y,
  };
};

// 하위 호환 함수들
export const isPointInObstacle = isPointInTerrain;
export const isCircleInObstacle = (
  cx: number,
  cy: number,
  radius: number,
  ox: number,
  oy: number,
  config: ObstacleConfig
): boolean => {
  return isCircleInTerrain(cx, cy, radius, ox, oy, {
    subtype: config.type as TerrainSubtype,
    width: config.width,
    height: config.height,
    offsetY: 0,
  });
};
