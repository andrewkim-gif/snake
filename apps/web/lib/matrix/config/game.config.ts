/**
 * game.config.ts - 게임 기본 설정
 * 플레이어, 젬, 적 스폰 등 핵심 설정
 *
 * Ported from app_ingame/config/game.config.ts
 */

export const BASE_STAGE_DURATION = 60;
export const MAX_ACTIVE_SKILLS = 5;
export const MAX_REROLLS = 5;

export const UNLOCK_COSTS: Record<string, number> = {
  neo: 0,        // 기본 캐릭터 - NEO
  tank: 200000,
  cypher: 1000000,
  morpheus: 0,   // 무료 캐릭터
  trinity: 0,    // 기본 캐릭터 - TRINITY
  // Coming Soon - 음수값은 출시 예정 표시용
  niobe: -1,
  oracle: -1,
  mouse: -1,
  dozer: -1
};

export const GOLD_REWARD = {
  name: "긴급 구호물자",
  desc: "모든 스킬을 마스터했습니다. 보너스 점수와 체력을 획득합니다.",
  value: 5000,
  heal: 50,
  color: "#facc15"
};

export const GAME_CONFIG = {
  // NERFED BASE STATS (Requires upgrades)
  PLAYER_SPEED: 100,
  PLAYER_RADIUS: 11,  // 80% 스케일 (14 -> 11) - 레거시 호환용 (원형 충돌 필요 시)
  // v7.22: 박스 충돌 (이소메트릭 캐릭터에 맞춤)
  // 이소메트릭 변환: isoX = worldX - worldY, isoY = (worldX + worldY) * 0.5
  // offsetX 양수 = 화면 오른쪽 아래, offsetY 양수 = 화면 왼쪽 아래
  PLAYER_COLLISION_BOX: {
    width: 42,
    height: 42,
    offsetX: 45,  // 중심점 유지
    offsetY: 50,  // 중심점 유지
  },
  PLAYER_COLOR: '#3b82f6',
  PLAYER_HP: 100,
  PLAYER_INVULNERABILITY: 0.5,

  GEM_RADIUS: 5,
  GEM_MAGNET_RANGE: 120,
  GEM_COLLECT_SPEED: 700,

  MAX_ENEMIES: 400,
  SPAWN_RADIUS: 650,
  DESPAWN_RADIUS: 1100,

  // 성능 최적화: 배열 크기 제한 (30분+ 플레이 끊김 방지)
  MAX_PARTICLES: 400,
  MAX_PROJECTILES: 300,
  MAX_DAMAGE_NUMBERS: 50,
  MAX_LIGHTNING_BOLTS: 30,
  MAX_BLASTS: 20,
  MAX_GEMS: 200,

  DAMAGE_TEXT_LIFESPAN: 0.5,
  PARTICLE_LIFE: 0.5,
  FRICTION: 0.90,
};

export const SPECIAL_SKILL = {
  NAME: "Special",
  COOLDOWN: 15,
  DAMAGE: 2000,
  RADIUS: 400,
  KNOCKBACK: 100,
  COLOR: '#22d3ee',
};

// 동적 카메라 줌 설정
export const ZOOM_CONFIG = {
  MIN_ZOOM: 0.6,            // 최대 줌아웃 (더 넓게)
  MAX_ZOOM: 1.1,            // 최대 줌인 (긴박한 상황)
  DEFAULT_ZOOM: 0.85,       // 기본 줌 (살짝 넓게)

  // 부드러운 카메라 모션 (단순 LERP)
  LERP_FACTOR: 0.008,       // 프레임당 보간 비율 (낮을수록 천천히, 0.008 = ~2초)

  // 적 가시성 기반 줌 계산
  ENEMY_VISIBLE_MARGIN: 80, // 적이 화면 가장자리에서 이 거리 안에 보이도록
  MIN_ENEMIES_TO_SHOW: 3,   // 최소 이 수의 적이 화면에 보이도록 줌 조절

  // 거리 기반 줌
  CLOSE_RANGE: 150,         // 근거리 기준 (px)
  MID_RANGE: 350,           // 중거리 기준 (px)
  FAR_RANGE: 500,           // 원거리 기준 (px)

  CLOSE_ENEMY_HIGH: 8,      // 이 이상 근거리 적이면 줌인
  BOSS_RANGE: 400,          // 보스 근접 판정 범위
  EARLY_GAME_TIME: 5,       // 초반 시간 (초) - 줌아웃 유지
};
