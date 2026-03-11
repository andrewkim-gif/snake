/**
 * enemy-templates.ts — Voxel 적 3D Base Template 시스템 (S20)
 *
 * 173개 적 타입을 10-15개 base body template으로 매핑.
 * 각 template은 BoxGeometry 기반 placeholder (head + body + limbs 조합).
 * MagicaVoxel .glb 에셋 준비 전까지 사용하는 프로그래밍 모델.
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * pivot: 발바닥 (y=0) 기준
 */

import * as THREE from 'three';

// ============================================
// Template ID 열거
// ============================================

/** 적 base body template 식별자 (12종) */
export type EnemyTemplateId =
  | 'humanoid_small'   // 작은 인간형 (glitch, bot 등 초기 적)
  | 'humanoid_medium'  // 중간 인간형 (malware, crypter 등)
  | 'humanoid_large'   // 큰 인간형 (whale, skynet 등 대형)
  | 'flying'           // 비행형 (drone_cam, pigeon_bot, wind_spirit 등)
  | 'crawler'          // 기어다니는 형태 (silk_crawler, rust_crawler, bug 등)
  | 'sphere'           // 구체형 (data_packet, qubit_spin, orb 등)
  | 'quadruped'        // 사족보행 (bracket_crab 등)
  | 'turret'           // 고정 포탑형 (hacked_turret, tripwire 등)
  | 'boss_small'       // 소형 보스 (rubble_golem 등)
  | 'boss_medium'      // 중형 보스 (gate_keeper 등)
  | 'boss_large'       // 대형 보스 (final_bit, paradox_loop 등)
  | 'cube'             // 기본 큐브 (사무용품, 데이터 등 비생물)

// ============================================
// Template 크기 상수
// ============================================

/** PLACEHOLDER_SIZES */
export interface TemplateSize {
  /** 전체 높이 (unit) */
  height: number;
  /** 머리 크기 비율 (0-1, 전체 대비) */
  headRatio: number;
  /** 몸통 너비 */
  bodyWidth: number;
  /** 몸통 높이 */
  bodyHeight: number;
  /** 몸통 깊이 */
  bodyDepth: number;
  /** 다리/팔 유무 */
  hasLegs: boolean;
  hasArms: boolean;
  /** 날개 유무 (비행형) */
  hasWings: boolean;
}

export const TEMPLATE_SIZES: Record<EnemyTemplateId, TemplateSize> = {
  humanoid_small: {
    height: 1.8, headRatio: 0.35, bodyWidth: 0.6, bodyHeight: 0.5, bodyDepth: 0.4,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  humanoid_medium: {
    height: 2.4, headRatio: 0.30, bodyWidth: 0.8, bodyHeight: 0.7, bodyDepth: 0.5,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  humanoid_large: {
    height: 3.2, headRatio: 0.28, bodyWidth: 1.2, bodyHeight: 1.0, bodyDepth: 0.8,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  flying: {
    height: 1.6, headRatio: 0.40, bodyWidth: 0.7, bodyHeight: 0.4, bodyDepth: 0.5,
    hasLegs: false, hasArms: false, hasWings: true,
  },
  crawler: {
    height: 0.8, headRatio: 0.45, bodyWidth: 1.0, bodyHeight: 0.3, bodyDepth: 0.6,
    hasLegs: true, hasArms: false, hasWings: false,
  },
  sphere: {
    height: 1.0, headRatio: 1.0, bodyWidth: 0, bodyHeight: 0, bodyDepth: 0,
    hasLegs: false, hasArms: false, hasWings: false,
  },
  quadruped: {
    height: 1.4, headRatio: 0.35, bodyWidth: 1.0, bodyHeight: 0.5, bodyDepth: 0.7,
    hasLegs: true, hasArms: false, hasWings: false,
  },
  turret: {
    height: 1.2, headRatio: 0.30, bodyWidth: 0.8, bodyHeight: 0.6, bodyDepth: 0.8,
    hasLegs: false, hasArms: false, hasWings: false,
  },
  boss_small: {
    height: 3.6, headRatio: 0.25, bodyWidth: 1.4, bodyHeight: 1.2, bodyDepth: 1.0,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  boss_medium: {
    height: 4.5, headRatio: 0.22, bodyWidth: 1.8, bodyHeight: 1.5, bodyDepth: 1.2,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  boss_large: {
    height: 5.5, headRatio: 0.20, bodyWidth: 2.2, bodyHeight: 1.8, bodyDepth: 1.5,
    hasLegs: true, hasArms: true, hasWings: false,
  },
  cube: {
    height: 1.2, headRatio: 1.0, bodyWidth: 0, bodyHeight: 0, bodyDepth: 0,
    hasLegs: false, hasArms: false, hasWings: false,
  },
};

// ============================================
// Template Geometry 파트
// ============================================

/** template의 geometry 파트 세트 */
export interface EnemyTemplateParts {
  /** 머리 geometry + 로컬 위치 */
  head: { geometry: THREE.BufferGeometry; position: THREE.Vector3 };
  /** 몸통 geometry + 로컬 위치 (구체/큐브 타입은 null) */
  body: { geometry: THREE.BufferGeometry; position: THREE.Vector3 } | null;
  /** 다리 geometry + 로컬 위치 배열 */
  legs: { geometry: THREE.BufferGeometry; position: THREE.Vector3 }[];
  /** 팔 geometry + 로컬 위치 배열 */
  arms: { geometry: THREE.BufferGeometry; position: THREE.Vector3 }[];
  /** 날개 geometry + 로컬 위치 배열 (비행형) */
  wings: { geometry: THREE.BufferGeometry; position: THREE.Vector3 }[];
}

// ============================================
// 공유 Geometry 캐시
// ============================================

const geometryCache = new Map<string, THREE.BufferGeometry>();

/** 캐시된 BoxGeometry 가져오기 */
function getCachedBoxGeometry(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `box_${w}_${h}_${d}`;
  let geo = geometryCache.get(key) as THREE.BoxGeometry | undefined;
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d);
    geometryCache.set(key, geo);
  }
  return geo;
}

/** 캐시된 SphereGeometry 가져오기 */
function getCachedSphereGeometry(radius: number, segments: number = 8): THREE.SphereGeometry {
  const key = `sphere_${radius}_${segments}`;
  let geo = geometryCache.get(key) as THREE.SphereGeometry | undefined;
  if (!geo) {
    geo = new THREE.SphereGeometry(radius, segments, segments);
    geometryCache.set(key, geo);
  }
  return geo;
}

/** 모든 geometry 캐시 정리 */
export function disposeTemplateGeometries(): void {
  geometryCache.forEach(g => g.dispose());
  geometryCache.clear();
}

// ============================================
// Template Geometry 생성 함수들
// ============================================

/** humanoid(인간형) template 생성 (small/medium/large 공용) */
function createHumanoidParts(size: TemplateSize): EnemyTemplateParts {
  const headSize = size.height * size.headRatio;
  const bodyH = size.bodyHeight;
  const legH = size.height - headSize - bodyH;
  const legW = size.bodyWidth * 0.35;
  const legD = size.bodyDepth * 0.6;
  const armW = size.bodyWidth * 0.25;
  const armH = bodyH * 0.9;
  const armD = size.bodyDepth * 0.5;

  // Y 오프셋 (발바닥 = y:0)
  const legCenterY = legH / 2;
  const bodyCenterY = legH + bodyH / 2;
  const headCenterY = legH + bodyH + headSize / 2;

  const head = {
    geometry: getCachedBoxGeometry(headSize, headSize, headSize),
    position: new THREE.Vector3(0, headCenterY, 0),
  };

  const body = {
    geometry: getCachedBoxGeometry(size.bodyWidth, bodyH, size.bodyDepth),
    position: new THREE.Vector3(0, bodyCenterY, 0),
  };

  const legs: EnemyTemplateParts['legs'] = [];
  if (size.hasLegs) {
    const gap = size.bodyWidth * 0.1;
    legs.push(
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(-(legW / 2 + gap / 2), legCenterY, 0) },
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(legW / 2 + gap / 2, legCenterY, 0) },
    );
  }

  const arms: EnemyTemplateParts['arms'] = [];
  if (size.hasArms) {
    const armOffsetX = size.bodyWidth / 2 + armW / 2;
    arms.push(
      { geometry: getCachedBoxGeometry(armW, armH, armD), position: new THREE.Vector3(-armOffsetX, bodyCenterY - (bodyH - armH) / 2, 0) },
      { geometry: getCachedBoxGeometry(armW, armH, armD), position: new THREE.Vector3(armOffsetX, bodyCenterY - (bodyH - armH) / 2, 0) },
    );
  }

  return { head, body, legs, arms, wings: [] };
}

/** flying(비행형) template 생성 */
function createFlyingParts(size: TemplateSize): EnemyTemplateParts {
  const headSize = size.height * size.headRatio;
  const bodyH = size.bodyHeight;
  const bodyCenterY = size.height / 2;
  const headCenterY = bodyCenterY + bodyH / 2 + headSize / 2;

  const wingW = size.bodyWidth * 0.8;
  const wingH = size.bodyHeight * 0.15;
  const wingD = size.bodyDepth * 1.2;

  return {
    head: {
      geometry: getCachedBoxGeometry(headSize, headSize, headSize),
      position: new THREE.Vector3(0, headCenterY, 0),
    },
    body: {
      geometry: getCachedBoxGeometry(size.bodyWidth, bodyH, size.bodyDepth),
      position: new THREE.Vector3(0, bodyCenterY, 0),
    },
    legs: [],
    arms: [],
    wings: [
      { geometry: getCachedBoxGeometry(wingW, wingH, wingD), position: new THREE.Vector3(-(size.bodyWidth / 2 + wingW / 2), bodyCenterY + bodyH * 0.2, 0) },
      { geometry: getCachedBoxGeometry(wingW, wingH, wingD), position: new THREE.Vector3(size.bodyWidth / 2 + wingW / 2, bodyCenterY + bodyH * 0.2, 0) },
    ],
  };
}

/** crawler(기어다니는 형태) template 생성 */
function createCrawlerParts(size: TemplateSize): EnemyTemplateParts {
  const headSize = size.height * size.headRatio;
  const bodyH = size.bodyHeight;
  const bodyCenterY = bodyH / 2;
  const headCenterY = bodyH + headSize / 2;

  const legW = 0.15;
  const legH = 0.2;
  const legD = 0.15;

  // 6개 다리 (양쪽 3개씩)
  const legs: EnemyTemplateParts['legs'] = [];
  for (let i = 0; i < 3; i++) {
    const zOffset = (i - 1) * size.bodyDepth * 0.3;
    legs.push(
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(-(size.bodyWidth / 2 + legW / 2), legH / 2, zOffset) },
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(size.bodyWidth / 2 + legW / 2, legH / 2, zOffset) },
    );
  }

  return {
    head: {
      geometry: getCachedBoxGeometry(headSize * 0.8, headSize, headSize * 0.8),
      position: new THREE.Vector3(0, headCenterY, size.bodyDepth * 0.3),
    },
    body: {
      geometry: getCachedBoxGeometry(size.bodyWidth, bodyH, size.bodyDepth),
      position: new THREE.Vector3(0, bodyCenterY, 0),
    },
    legs,
    arms: [],
    wings: [],
  };
}

/** sphere(구체형) template 생성 */
function createSphereParts(size: TemplateSize): EnemyTemplateParts {
  const radius = size.height / 2;
  return {
    head: {
      geometry: getCachedSphereGeometry(radius, 8),
      position: new THREE.Vector3(0, radius, 0),
    },
    body: null,
    legs: [],
    arms: [],
    wings: [],
  };
}

/** quadruped(사족보행) template 생성 */
function createQuadrupedParts(size: TemplateSize): EnemyTemplateParts {
  const headSize = size.height * size.headRatio;
  const bodyH = size.bodyHeight;
  const legH = size.height - bodyH - headSize * 0.2;
  const legW = size.bodyWidth * 0.2;
  const legD = size.bodyDepth * 0.25;

  const legCenterY = legH / 2;
  const bodyCenterY = legH + bodyH / 2;
  const headCenterY = legH + bodyH + headSize * 0.2;

  return {
    head: {
      geometry: getCachedBoxGeometry(headSize, headSize, headSize),
      position: new THREE.Vector3(0, headCenterY, size.bodyDepth * 0.4),
    },
    body: {
      geometry: getCachedBoxGeometry(size.bodyWidth, bodyH, size.bodyDepth),
      position: new THREE.Vector3(0, bodyCenterY, 0),
    },
    legs: [
      // 앞다리 2개
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(-(size.bodyWidth / 2 - legW / 2), legCenterY, size.bodyDepth * 0.3) },
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(size.bodyWidth / 2 - legW / 2, legCenterY, size.bodyDepth * 0.3) },
      // 뒷다리 2개
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(-(size.bodyWidth / 2 - legW / 2), legCenterY, -size.bodyDepth * 0.3) },
      { geometry: getCachedBoxGeometry(legW, legH, legD), position: new THREE.Vector3(size.bodyWidth / 2 - legW / 2, legCenterY, -size.bodyDepth * 0.3) },
    ],
    arms: [],
    wings: [],
  };
}

/** turret(고정 포탑형) template 생성 */
function createTurretParts(size: TemplateSize): EnemyTemplateParts {
  const headSize = size.height * size.headRatio;
  const bodyH = size.bodyHeight;
  const bodyCenterY = bodyH / 2;
  const headCenterY = bodyH + headSize / 2;

  // 포신 (barrel)
  const barrelW = 0.15;
  const barrelH = 0.15;
  const barrelD = size.bodyDepth * 0.8;

  return {
    head: {
      geometry: getCachedBoxGeometry(headSize, headSize, headSize),
      position: new THREE.Vector3(0, headCenterY, 0),
    },
    body: {
      geometry: getCachedBoxGeometry(size.bodyWidth, bodyH, size.bodyDepth),
      position: new THREE.Vector3(0, bodyCenterY, 0),
    },
    legs: [],
    arms: [
      // 포신을 arm 슬롯에 배치
      { geometry: getCachedBoxGeometry(barrelW, barrelH, barrelD), position: new THREE.Vector3(0, headCenterY, size.bodyDepth / 2 + barrelD / 2) },
    ],
    wings: [],
  };
}

/** cube(큐브형) template 생성 — 비생물 오브젝트 (사무용품, 데이터 등) */
function createCubeParts(size: TemplateSize): EnemyTemplateParts {
  const s = size.height;
  return {
    head: {
      geometry: getCachedBoxGeometry(s, s, s),
      position: new THREE.Vector3(0, s / 2, 0),
    },
    body: null,
    legs: [],
    arms: [],
    wings: [],
  };
}

// ============================================
// Template Parts 캐시
// ============================================

const templatePartsCache = new Map<EnemyTemplateId, EnemyTemplateParts>();

/** template ID에 해당하는 파트 세트 가져오기 (lazy cached) */
export function getTemplateParts(templateId: EnemyTemplateId): EnemyTemplateParts {
  let parts = templatePartsCache.get(templateId);
  if (parts) return parts;

  const size = TEMPLATE_SIZES[templateId];

  switch (templateId) {
    case 'humanoid_small':
    case 'humanoid_medium':
    case 'humanoid_large':
    case 'boss_small':
    case 'boss_medium':
    case 'boss_large':
      parts = createHumanoidParts(size);
      break;
    case 'flying':
      parts = createFlyingParts(size);
      break;
    case 'crawler':
      parts = createCrawlerParts(size);
      break;
    case 'sphere':
      parts = createSphereParts(size);
      break;
    case 'quadruped':
      parts = createQuadrupedParts(size);
      break;
    case 'turret':
      parts = createTurretParts(size);
      break;
    case 'cube':
      parts = createCubeParts(size);
      break;
  }

  templatePartsCache.set(templateId, parts);
  return parts;
}

/** template parts 캐시 + geometry 캐시 전체 정리 */
export function disposeAllTemplates(): void {
  templatePartsCache.clear();
  disposeTemplateGeometries();
}

// ============================================
// EnemyType → TemplateId 매핑 (173 타입)
// ============================================

/**
 * 173개 적 타입 → 12개 base body template 매핑
 *
 * 분류 기준:
 * - radius/크기: 작은(≤12) → small, 중간(13-17) → medium, 큰(≥18) → large
 * - 이름/테마: flying 계열, crawler, data/sphere 계열
 * - 특수: 고정 포탑(speed=0), boss 급
 */
export const ENEMY_TYPE_TO_TEMPLATE: Record<string, EnemyTemplateId> = {
  // === Legacy AI 봇 ===
  glitch: 'humanoid_small',
  bot: 'humanoid_medium',
  malware: 'humanoid_medium',
  whale: 'humanoid_large',

  // === Chapter 1: Office & Escape (Stages 1-10) ===
  // Stage 1: First Desk
  stapler: 'cube',
  coffee_cup: 'cube',
  sticky_note: 'cube',
  mouse_cable: 'crawler',
  keyboard_key: 'cube',

  // Stage 2: Break Room
  vending_bot: 'cube',
  donut: 'sphere',
  soda_can: 'cube',
  chip_bag: 'cube',
  microwave: 'cube',

  // Stage 3: Meeting Room
  projector: 'cube',
  whiteboard: 'cube',
  presentation: 'cube',
  chair_spin: 'sphere',
  clock_watcher: 'cube',

  // Stage 4: Server Entrance
  keycard: 'cube',
  camera_eye: 'sphere',
  firewall_cube: 'cube',
  access_denied: 'cube',
  fingerprint: 'sphere',

  // Stage 5: Server Core
  data_packet: 'sphere',
  bit_stream: 'sphere',
  memory_leak: 'sphere',
  cache_miss: 'sphere',
  thread_tangle: 'crawler',

  // Stage 6: Parking Lot
  headlight: 'sphere',
  tire_roller: 'sphere',
  parking_cone: 'cube',
  oil_slick: 'crawler',
  exhaust_ghost: 'flying',

  // Stage 7: Emergency Stairs
  stair_step: 'cube',
  handrail_snake: 'crawler',
  exit_sign: 'cube',
  fire_ext: 'cube',
  echo_shade: 'flying',

  // Stage 8: Rooftop
  antenna_zap: 'cube',
  wind_spirit: 'flying',
  satellite_eye: 'sphere',
  vent_puff: 'flying',
  pigeon_bot: 'flying',

  // Stage 9: City Chase
  traffic_light: 'cube',
  manhole: 'cube',
  billboard: 'cube',
  drone_cam: 'flying',
  streetlamp: 'cube',

  // Stage 10: Safehouse
  static_tv: 'cube',
  radio_wave: 'sphere',
  fridge_hum: 'cube',
  dusty_fan: 'sphere',
  shadow_corner: 'flying',

  // === Chapter 2: Underground & Battleground (Stages 11-20) ===
  // Stage 11: Hacker Hideout
  script_kiddie: 'humanoid_small',
  proxy_mask: 'humanoid_medium',
  vpn_tunnel: 'cube',
  tor_onion: 'sphere',
  backdoor: 'humanoid_medium',

  // Stage 12: Encrypted Tunnel
  cipher_block: 'cube',
  hash_collision: 'sphere',
  salt_shaker: 'cube',
  key_fragment: 'cube',
  padding_oracle: 'humanoid_medium',

  // Stage 13: Dark Web
  silk_crawler: 'crawler',
  bitcoin_thief: 'humanoid_small',
  phish_hook: 'humanoid_small',
  scam_popup: 'cube',
  identity_ghost: 'flying',

  // Stage 14: AI Factory
  assembly_arm: 'humanoid_medium',
  conveyor_bot: 'humanoid_medium',
  qc_scanner: 'turret',
  defect_unit: 'humanoid_medium',
  forge_spark: 'sphere',

  // Stage 15: Factory Core
  core_drone: 'flying',
  power_cell: 'cube',
  cooling_fan: 'sphere',
  circuit_bug: 'crawler',
  steam_vent: 'turret',

  // Stage 16: Ruins
  rubble_golem: 'boss_small',
  rust_crawler: 'crawler',
  rebar_spike: 'cube',
  dust_cloud: 'flying',
  broken_screen: 'cube',

  // Stage 17: Resistance Camp
  infected_guard: 'humanoid_medium',
  glitched_medic: 'humanoid_medium',
  hacked_turret: 'turret',
  traitor_drone: 'flying',
  supply_mimic: 'cube',

  // Stage 18: Training Ground
  target_dummy: 'humanoid_medium',
  obstacle_wall: 'cube',
  drill_sergeant: 'humanoid_medium',
  tripwire: 'turret',
  sandbag_tumble: 'cube',

  // Stage 19: Mainframe
  logic_gate: 'cube',
  register_file: 'cube',
  bus_controller: 'humanoid_medium',
  alu_core: 'sphere',
  cache_line: 'sphere',

  // Stage 20: Data Prison
  firewall_guard: 'humanoid_large',
  quarantine_cell: 'cube',
  corrupted_file: 'cube',
  delete_marker: 'cube',
  backup_ghost: 'flying',

  // === Chapter 3: Digital World & Singularity (Stages 21-30) ===
  // Stage 21: Sea of Code
  syntax_fish: 'crawler',
  bracket_crab: 'quadruped',
  comment_jellyfish: 'flying',
  variable_eel: 'crawler',
  function_whale: 'boss_small',

  // Stage 22: Memory Palace
  heap_pile: 'cube',
  stack_tower: 'cube',
  pointer_arrow: 'sphere',
  garbage_collector: 'boss_small',
  memory_fragment: 'sphere',

  // Stage 23: CPU Core
  clock_cycle: 'sphere',
  instruction_fetch: 'humanoid_medium',
  branch_predictor: 'humanoid_medium',
  pipeline_stall: 'cube',
  thermal_spike: 'sphere',

  // Stage 24: Neural Network
  neuron_node: 'sphere',
  synapse_spark: 'sphere',
  weight_adjuster: 'humanoid_medium',
  bias_blob: 'boss_small',
  activation_wave: 'sphere',

  // Stage 25: Learning Center
  training_data: 'sphere',
  loss_function: 'cube',
  gradient_flow: 'sphere',
  overfitting: 'boss_small',
  epoch_counter: 'cube',

  // Stage 26: Cloud Layers
  instance_spawn: 'humanoid_small',
  load_balancer: 'boss_small',
  container_box: 'cube',
  serverless_ghost: 'flying',
  auto_scaler: 'humanoid_medium',

  // Stage 27: Quantum Realm
  qubit_spin: 'sphere',
  superposition: 'sphere',
  entangle_pair: 'sphere',
  quantum_gate: 'boss_small',
  decoherence: 'sphere',

  // Stage 28: Singularity Gate
  event_horizon: 'boss_medium',
  time_dilation: 'boss_small',
  gravity_well: 'boss_medium',
  hawking_particle: 'sphere',
  gate_keeper: 'boss_medium',

  // Stage 29: God's Room
  omniscient_eye: 'sphere',
  divine_code: 'boss_medium',
  angel_process: 'flying',
  fallen_daemon: 'boss_medium',
  prayer_packet: 'sphere',

  // Stage 30: Final Choice
  destiny_shard: 'sphere',
  timeline_split: 'boss_medium',
  choice_echo: 'flying',
  paradox_loop: 'boss_large',
  final_bit: 'boss_large',

  // === 싱귤래리티 모드 전용 AI (Era 1-6) ===
  bitling: 'humanoid_small',
  pixel: 'cube',
  bug: 'crawler',
  worm: 'crawler',
  spammer: 'humanoid_small',
  adware: 'humanoid_small',
  crypter: 'humanoid_medium',
  mutant: 'humanoid_medium',
  polymorphic: 'humanoid_medium',
  trojan: 'humanoid_medium',
  ransomer: 'humanoid_medium',
  botnet: 'humanoid_medium',
  rootkit: 'humanoid_large',
  apt: 'humanoid_large',
  zeroday: 'boss_medium',
  skynet: 'boss_large',

  // === 원거리 AI ===
  sniper: 'humanoid_medium',
  caster: 'humanoid_small',
  artillery: 'boss_small',
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * enemyType → templateId 조회 (미매핑 시 humanoid_small fallback)
 */
export function getTemplateIdForEnemy(enemyType: string): EnemyTemplateId {
  return ENEMY_TYPE_TO_TEMPLATE[enemyType] ?? 'humanoid_small';
}

/**
 * templateId 목록 반환 (모든 12종)
 */
export function getAllTemplateIds(): EnemyTemplateId[] {
  return Object.keys(TEMPLATE_SIZES) as EnemyTemplateId[];
}

/**
 * 특정 templateId에 매핑된 모든 enemyType 반환
 */
export function getEnemyTypesForTemplate(templateId: EnemyTemplateId): string[] {
  return Object.entries(ENEMY_TYPE_TO_TEMPLATE)
    .filter(([, tid]) => tid === templateId)
    .map(([enemyType]) => enemyType);
}

/**
 * template 총 파트 수 (InstancedMesh 생성 시 geometry 개수 파악)
 */
export function getTemplatePartCount(templateId: EnemyTemplateId): number {
  const parts = getTemplateParts(templateId);
  let count = 1; // head
  if (parts.body) count++;
  count += parts.legs.length;
  count += parts.arms.length;
  count += parts.wings.length;
  return count;
}
