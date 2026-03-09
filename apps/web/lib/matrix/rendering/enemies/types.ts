/**
 * game/rendering/enemies/types.ts - 적 렌더링 타입 정의
 */

// Enemy 타입은 game/types에서 import (순환 의존 방지를 위해 인터페이스로 정의)
export interface EnemyRenderData {
  id?: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  color: string;
  enemyType: string;
  state: 'idle' | 'moving' | 'attacking' | 'stunned' | 'dying' | 'chasing';
  attackCooldown?: number;
  isBoss?: boolean;
  isFrozen?: boolean;
  deathScale?: number;
  deathVelocity?: { x: number; y: number };
  deathTimer?: number;
  statusEffects?: Array<{ type: string; }>;
}

export type EnemyRenderer = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
) => void;

// 적 타입 상수
export const ENEMY_TYPES = {
  // === Legacy Basic (기존 호환용) ===
  GLITCH: 'glitch',
  BOT: 'bot',
  MALWARE: 'malware',
  WHALE: 'whale',
  SNIPER: 'sniper',
  CASTER: 'caster',
  ARTILLERY: 'artillery',

  // === Chapter 1: Office & Escape (Stages 1-10) ===
  // Stage 1: First Desk
  STAPLER: 'stapler',
  COFFEE_CUP: 'coffee_cup',
  STICKY_NOTE: 'sticky_note',
  MOUSE_CABLE: 'mouse_cable',
  KEYBOARD_KEY: 'keyboard_key',
  // Stage 2: Break Room
  VENDING_BOT: 'vending_bot',
  DONUT: 'donut',
  SODA_CAN: 'soda_can',
  CHIP_BAG: 'chip_bag',
  MICROWAVE: 'microwave',
  // Stage 3: Meeting Room
  PROJECTOR: 'projector',
  WHITEBOARD: 'whiteboard',
  PRESENTATION: 'presentation',
  CHAIR_SPIN: 'chair_spin',
  CLOCK_WATCHER: 'clock_watcher',
  // Stage 4: Server Entrance
  KEYCARD: 'keycard',
  CAMERA_EYE: 'camera_eye',
  FIREWALL_CUBE: 'firewall_cube',
  ACCESS_DENIED: 'access_denied',
  FINGERPRINT: 'fingerprint',
  // Stage 5: Server Core
  DATA_PACKET: 'data_packet',
  BIT_STREAM: 'bit_stream',
  MEMORY_LEAK: 'memory_leak',
  CACHE_MISS: 'cache_miss',
  THREAD_TANGLE: 'thread_tangle',
  // Stage 6: Parking Lot
  HEADLIGHT: 'headlight',
  TIRE_ROLLER: 'tire_roller',
  PARKING_CONE: 'parking_cone',
  OIL_SLICK: 'oil_slick',
  EXHAUST_GHOST: 'exhaust_ghost',
  // Stage 7: Emergency Stairs
  STAIR_STEP: 'stair_step',
  HANDRAIL_SNAKE: 'handrail_snake',
  EXIT_SIGN: 'exit_sign',
  FIRE_EXT: 'fire_ext',
  ECHO_SHADE: 'echo_shade',
  // Stage 8: Rooftop
  ANTENNA_ZAP: 'antenna_zap',
  WIND_SPIRIT: 'wind_spirit',
  SATELLITE_EYE: 'satellite_eye',
  VENT_PUFF: 'vent_puff',
  PIGEON_BOT: 'pigeon_bot',
  // Stage 9: City Chase
  TRAFFIC_LIGHT: 'traffic_light',
  MANHOLE: 'manhole',
  BILLBOARD: 'billboard',
  DRONE_CAM: 'drone_cam',
  STREETLAMP: 'streetlamp',
  // Stage 10: Safehouse
  STATIC_TV: 'static_tv',
  RADIO_WAVE: 'radio_wave',
  FRIDGE_HUM: 'fridge_hum',
  DUSTY_FAN: 'dusty_fan',
  SHADOW_CORNER: 'shadow_corner',

  // === Chapter 2: Underground & Battleground (Stages 11-20) ===
  // Stage 11: Hacker Hideout
  SCRIPT_KIDDIE: 'script_kiddie',
  PROXY_MASK: 'proxy_mask',
  VPN_TUNNEL: 'vpn_tunnel',
  TOR_ONION: 'tor_onion',
  BACKDOOR: 'backdoor',
  // Stage 12: Encrypted Tunnel
  CIPHER_BLOCK: 'cipher_block',
  HASH_COLLISION: 'hash_collision',
  SALT_SHAKER: 'salt_shaker',
  KEY_FRAGMENT: 'key_fragment',
  PADDING_ORACLE: 'padding_oracle',
  // Stage 13: Dark Web
  SILK_CRAWLER: 'silk_crawler',
  BITCOIN_THIEF: 'bitcoin_thief',
  PHISH_HOOK: 'phish_hook',
  SCAM_POPUP: 'scam_popup',
  IDENTITY_GHOST: 'identity_ghost',
  // Stage 14: AI Factory
  ASSEMBLY_ARM: 'assembly_arm',
  CONVEYOR_BOT: 'conveyor_bot',
  QC_SCANNER: 'qc_scanner',
  DEFECT_UNIT: 'defect_unit',
  FORGE_SPARK: 'forge_spark',
  // Stage 15: Factory Core
  CORE_DRONE: 'core_drone',
  POWER_CELL: 'power_cell',
  COOLING_FAN: 'cooling_fan',
  CIRCUIT_BUG: 'circuit_bug',
  STEAM_VENT: 'steam_vent',
  // Stage 16: Ruins
  RUBBLE_GOLEM: 'rubble_golem',
  RUST_CRAWLER: 'rust_crawler',
  REBAR_SPIKE: 'rebar_spike',
  DUST_CLOUD: 'dust_cloud',
  BROKEN_SCREEN: 'broken_screen',
  // Stage 17: Resistance Camp
  INFECTED_GUARD: 'infected_guard',
  GLITCHED_MEDIC: 'glitched_medic',
  HACKED_TURRET: 'hacked_turret',
  TRAITOR_DRONE: 'traitor_drone',
  SUPPLY_MIMIC: 'supply_mimic',
  // Stage 18: Training Ground
  TARGET_DUMMY: 'target_dummy',
  OBSTACLE_WALL: 'obstacle_wall',
  DRILL_SERGEANT: 'drill_sergeant',
  TRIPWIRE: 'tripwire',
  SANDBAG_TUMBLE: 'sandbag_tumble',
  // Stage 19: Mainframe
  LOGIC_GATE: 'logic_gate',
  REGISTER_FILE: 'register_file',
  BUS_CONTROLLER: 'bus_controller',
  ALU_CORE: 'alu_core',
  CACHE_LINE: 'cache_line',
  // Stage 20: Data Prison
  FIREWALL_GUARD: 'firewall_guard',
  QUARANTINE_CELL: 'quarantine_cell',
  CORRUPTED_FILE: 'corrupted_file',
  DELETE_MARKER: 'delete_marker',
  BACKUP_GHOST: 'backup_ghost',

  // === Chapter 3: Digital World & Singularity (Stages 21-30) ===
  // Stage 21: Sea of Code
  SYNTAX_FISH: 'syntax_fish',
  BRACKET_CRAB: 'bracket_crab',
  COMMENT_JELLYFISH: 'comment_jellyfish',
  VARIABLE_EEL: 'variable_eel',
  FUNCTION_WHALE: 'function_whale',
  // Stage 22: Memory Palace
  HEAP_PILE: 'heap_pile',
  STACK_TOWER: 'stack_tower',
  POINTER_ARROW: 'pointer_arrow',
  GARBAGE_COLLECTOR: 'garbage_collector',
  MEMORY_FRAGMENT: 'memory_fragment',
  // Stage 23: CPU Core
  CLOCK_CYCLE: 'clock_cycle',
  INSTRUCTION_FETCH: 'instruction_fetch',
  BRANCH_PREDICTOR: 'branch_predictor',
  PIPELINE_STALL: 'pipeline_stall',
  THERMAL_SPIKE: 'thermal_spike',
  // Stage 24: Neural Network
  NEURON_NODE: 'neuron_node',
  SYNAPSE_SPARK: 'synapse_spark',
  WEIGHT_ADJUSTER: 'weight_adjuster',
  BIAS_BLOB: 'bias_blob',
  ACTIVATION_WAVE: 'activation_wave',
  // Stage 25: Learning Center
  TRAINING_DATA: 'training_data',
  LOSS_FUNCTION: 'loss_function',
  GRADIENT_FLOW: 'gradient_flow',
  OVERFITTING: 'overfitting',
  EPOCH_COUNTER: 'epoch_counter',
  // Stage 26: Cloud Layers
  INSTANCE_SPAWN: 'instance_spawn',
  LOAD_BALANCER: 'load_balancer',
  CONTAINER_BOX: 'container_box',
  SERVERLESS_GHOST: 'serverless_ghost',
  AUTO_SCALER: 'auto_scaler',
  // Stage 27: Quantum Realm
  QUBIT_SPIN: 'qubit_spin',
  SUPERPOSITION: 'superposition',
  ENTANGLE_PAIR: 'entangle_pair',
  QUANTUM_GATE: 'quantum_gate',
  DECOHERENCE: 'decoherence',
  // Stage 28: Singularity Gate
  EVENT_HORIZON: 'event_horizon',
  TIME_DILATION: 'time_dilation',
  GRAVITY_WELL: 'gravity_well',
  HAWKING_PARTICLE: 'hawking_particle',
  GATE_KEEPER: 'gate_keeper',
  // Stage 29: God's Room
  OMNISCIENT_EYE: 'omniscient_eye',
  DIVINE_CODE: 'divine_code',
  ANGEL_PROCESS: 'angel_process',
  FALLEN_DAEMON: 'fallen_daemon',
  PRAYER_PACKET: 'prayer_packet',
  // Stage 30: Final Choice
  DESTINY_SHARD: 'destiny_shard',
  TIMELINE_SPLIT: 'timeline_split',
  CHOICE_ECHO: 'choice_echo',
  PARADOX_LOOP: 'paradox_loop',
  FINAL_BIT: 'final_bit',

  // === Singularity Monsters (Existing) ===
  BITLING: 'bitling',
  SPAMMER: 'spammer',
  CRYPTER: 'crypter',
  RANSOMER: 'ransomer',
  PIXEL: 'pixel',
  BUG: 'bug',
  WORM: 'worm',
  ADWARE: 'adware',
  MUTANT: 'mutant',
  POLYMORPHIC: 'polymorphic',
  TROJAN: 'trojan',
  BOTNET: 'botnet',
  ROOTKIT: 'rootkit',
  APT: 'apt',
  ZERODAY: 'zeroday',
  SKYNET: 'skynet',
} as const;

export type EnemyType = typeof ENEMY_TYPES[keyof typeof ENEMY_TYPES];

// 색상 상수
export const ENEMY_COLORS = {
  MATRIX_GREEN: '#00FF41',
  DARK_GREEN: '#003B00',
  ASSISTANT_BLUE: '#3b82f6',
  VIRUS_RED: '#dc2626',
  WHALE_GRAY: '#374151',
  SNIPER_ORANGE: '#f97316',
  CASTER_PURPLE: '#a855f7',
  ARTILLERY_ORANGE: '#ea580c',
  CYBER_CYAN: '#06b6d4',
  WARNING_YELLOW: '#fbbf24',
} as const;
