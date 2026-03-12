/**
 * enemies.config.ts - AI SURVIVOR 적 및 픽업 설정
 * AI vs Programmer - AI 봇 적 정의
 */

import { EnemyType, PickupType, EliteTier } from '../types';
// Boss/Stage system removed for Arena mode

// 원거리 적 확장 타입
export interface RangedEnemyStats {
  hp: number;
  speed: number;
  radius: number;
  color: string;
  damage: number;
  mass: number;
  score: number;
  xp: number;
  attackType: 'ranged';
  attackRange: number;
  attackCooldown: number;
  projectileSpeed: number;
  projectileColor: string;
  splashRadius?: number;
}

// Boss generation removed for Arena mode

// Stage system removed for Arena mode - stub for backward compatibility
const STAGE_UNIQUE_ENEMIES: Record<number, EnemyType[]> = {};

// ============================================
// AI SURVIVOR - AI vs Programmer
// ============================================
//
// AI 계보 (약함 → 강함):
// 버그봇(glitch) < 챗봇(bot) < 악성코드(malware) < 슈퍼컴퓨터(whale)
//
// 원거리 AI:
// 스패머(sniper), 피싱봇(caster), DDoS봇(artillery)
//
// 색상 테마:
// - 시안(#22d3ee): 초기 AI, 약함
// - 회색(#6b7280): 일반 AI 비서
// - 빨강(#dc2626): 공격적 바이러스
// - 어두운 회색(#475569): 슈퍼컴퓨터
// - 보라(#7c3aed): 원거리 스팸
// - 분홍(#ec4899): 피싱 공격
// - 주황(#f59e0b): DDoS 폭발
// ============================================

export const ENEMY_TYPES = {
  // === Legacy AI 봇 (기존 호환용) ===
  glitch: { hp: 5, speed: 55, radius: 10, color: '#22d3ee', damage: 4, mass: 0.5, score: 3, xp: 0.5, attackType: 'melee' },
  bot: { hp: 15, speed: 50, radius: 14, color: '#6b7280', damage: 8, mass: 1.0, score: 8, xp: 1, attackType: 'melee' },
  malware: { hp: 30, speed: 70, radius: 13, color: '#dc2626', damage: 12, mass: 0.8, score: 15, xp: 2, attackType: 'melee' },
  whale: { hp: 200, speed: 35, radius: 22, color: '#475569', damage: 25, mass: 5.0, score: 80, xp: 15, attackType: 'melee' },

  // === Chapter 1: Office & Escape (Stages 1-10) ===
  // Stage 1: First Desk (첫 책상) - 사무용품 테마
  stapler: { hp: 6, speed: 50, radius: 10, color: '#6b7280', damage: 5, mass: 0.5, score: 4, xp: 0.5, attackType: 'melee' },
  coffee_cup: { hp: 8, speed: 45, radius: 11, color: '#92400e', damage: 4, mass: 0.6, score: 5, xp: 0.6, attackType: 'melee' },
  sticky_note: { hp: 4, speed: 60, radius: 9, color: '#fef08a', damage: 3, mass: 0.3, score: 3, xp: 0.4, attackType: 'melee' },
  mouse_cable: { hp: 7, speed: 55, radius: 8, color: '#1f2937', damage: 5, mass: 0.4, score: 4, xp: 0.5, attackType: 'melee' },
  keyboard_key: { hp: 5, speed: 65, radius: 8, color: '#f3f4f6', damage: 4, mass: 0.4, score: 3, xp: 0.4, attackType: 'melee' },

  // Stage 2: Break Room (휴게실) - 자판기/음식 테마
  vending_bot: { hp: 12, speed: 40, radius: 12, color: '#3b82f6', damage: 6, mass: 0.8, score: 6, xp: 0.7, attackType: 'melee' },
  donut: { hp: 6, speed: 70, radius: 10, color: '#f472b6', damage: 4, mass: 0.4, score: 4, xp: 0.5, attackType: 'melee' },
  soda_can: { hp: 8, speed: 55, radius: 9, color: '#ef4444', damage: 5, mass: 0.5, score: 5, xp: 0.6, attackType: 'melee' },
  chip_bag: { hp: 7, speed: 50, radius: 11, color: '#fbbf24', damage: 4, mass: 0.5, score: 4, xp: 0.5, attackType: 'melee' },
  microwave: { hp: 15, speed: 35, radius: 14, color: '#f5f5f4', damage: 8, mass: 1.0, score: 8, xp: 0.8, attackType: 'melee' },

  // Stage 3: Meeting Room (회의실) - 회의용품 테마
  projector: { hp: 10, speed: 45, radius: 11, color: '#1e293b', damage: 6, mass: 0.7, score: 6, xp: 0.7, attackType: 'melee' },
  whiteboard: { hp: 14, speed: 40, radius: 13, color: '#ffffff', damage: 7, mass: 0.9, score: 7, xp: 0.8, attackType: 'melee' },
  presentation: { hp: 9, speed: 50, radius: 12, color: '#2563eb', damage: 5, mass: 0.6, score: 5, xp: 0.6, attackType: 'melee' },
  chair_spin: { hp: 8, speed: 75, radius: 10, color: '#374151', damage: 6, mass: 0.7, score: 6, xp: 0.7, attackType: 'melee' },
  clock_watcher: { hp: 7, speed: 55, radius: 10, color: '#f8fafc', damage: 5, mass: 0.5, score: 5, xp: 0.6, attackType: 'melee' },

  // Stage 4: Server Entrance (서버 입구) - 보안 시스템 테마
  keycard: { hp: 6, speed: 70, radius: 9, color: '#22c55e', damage: 5, mass: 0.4, score: 5, xp: 0.6, attackType: 'melee' },
  camera_eye: { hp: 10, speed: 40, radius: 11, color: '#1f2937', damage: 7, mass: 0.6, score: 7, xp: 0.8, attackType: 'melee' },
  firewall_cube: { hp: 18, speed: 45, radius: 12, color: '#f97316', damage: 8, mass: 0.8, score: 10, xp: 1.0, attackType: 'melee' },
  access_denied: { hp: 12, speed: 60, radius: 10, color: '#dc2626', damage: 9, mass: 0.6, score: 8, xp: 0.9, attackType: 'melee' },
  fingerprint: { hp: 8, speed: 55, radius: 10, color: '#06b6d4', damage: 6, mass: 0.5, score: 6, xp: 0.7, attackType: 'melee' },

  // Stage 5: Server Core (서버 코어) - 데이터 테마
  data_packet: { hp: 5, speed: 80, radius: 8, color: '#3b82f6', damage: 4, mass: 0.3, score: 4, xp: 0.5, attackType: 'melee' },
  bit_stream: { hp: 7, speed: 65, radius: 9, color: '#00FF41', damage: 5, mass: 0.4, score: 5, xp: 0.6, attackType: 'melee' },
  memory_leak: { hp: 10, speed: 50, radius: 10, color: '#8b5cf6', damage: 6, mass: 0.5, score: 6, xp: 0.7, attackType: 'melee' },
  cache_miss: { hp: 6, speed: 75, radius: 8, color: '#fbbf24', damage: 4, mass: 0.4, score: 4, xp: 0.5, attackType: 'melee' },
  thread_tangle: { hp: 12, speed: 55, radius: 11, color: '#10b981', damage: 7, mass: 0.6, score: 7, xp: 0.8, attackType: 'melee' },

  // Stage 6: Parking Lot (주차장) - 자동차 테마
  headlight: { hp: 8, speed: 60, radius: 10, color: '#fef08a', damage: 6, mass: 0.5, score: 6, xp: 0.7, attackType: 'melee' },
  tire_roller: { hp: 15, speed: 70, radius: 12, color: '#1f2937', damage: 8, mass: 0.9, score: 9, xp: 1.0, attackType: 'melee' },
  parking_cone: { hp: 6, speed: 50, radius: 9, color: '#f97316', damage: 4, mass: 0.4, score: 4, xp: 0.5, attackType: 'melee' },
  oil_slick: { hp: 10, speed: 40, radius: 13, color: '#422006', damage: 5, mass: 0.7, score: 6, xp: 0.7, attackType: 'melee' },
  exhaust_ghost: { hp: 7, speed: 55, radius: 11, color: '#6b7280', damage: 5, mass: 0.4, score: 5, xp: 0.6, attackType: 'melee' },

  // Stage 7: Emergency Stairs (비상계단) - 계단 테마
  stair_step: { hp: 14, speed: 45, radius: 12, color: '#78716c', damage: 8, mass: 0.8, score: 8, xp: 0.9, attackType: 'melee' },
  handrail_snake: { hp: 10, speed: 65, radius: 10, color: '#a1a1aa', damage: 7, mass: 0.6, score: 7, xp: 0.8, attackType: 'melee' },
  exit_sign: { hp: 8, speed: 50, radius: 11, color: '#22c55e', damage: 5, mass: 0.5, score: 5, xp: 0.6, attackType: 'melee' },
  fire_ext: { hp: 12, speed: 40, radius: 10, color: '#dc2626', damage: 9, mass: 0.7, score: 8, xp: 0.9, attackType: 'melee' },
  echo_shade: { hp: 9, speed: 60, radius: 10, color: '#27272a', damage: 6, mass: 0.4, score: 6, xp: 0.7, attackType: 'melee' },

  // Stage 8: Rooftop (옥상) - 하늘/바람 테마
  antenna_zap: { hp: 11, speed: 45, radius: 11, color: '#6b7280', damage: 8, mass: 0.6, score: 7, xp: 0.8, attackType: 'melee' },
  wind_spirit: { hp: 6, speed: 80, radius: 10, color: '#e0f2fe', damage: 4, mass: 0.3, score: 5, xp: 0.6, attackType: 'melee' },
  satellite_eye: { hp: 13, speed: 40, radius: 12, color: '#f5f5f4', damage: 7, mass: 0.7, score: 8, xp: 0.9, attackType: 'melee' },
  vent_puff: { hp: 9, speed: 50, radius: 11, color: '#a8a29e', damage: 5, mass: 0.5, score: 6, xp: 0.7, attackType: 'melee' },
  pigeon_bot: { hp: 7, speed: 70, radius: 9, color: '#9ca3af', damage: 5, mass: 0.4, score: 5, xp: 0.6, attackType: 'melee' },

  // Stage 9: City Chase (도시 추격) - 도시 테마
  traffic_light: { hp: 16, speed: 35, radius: 12, color: '#ef4444', damage: 9, mass: 0.9, score: 10, xp: 1.1, attackType: 'melee' },
  manhole: { hp: 20, speed: 30, radius: 13, color: '#374151', damage: 10, mass: 1.0, score: 12, xp: 1.3, attackType: 'melee' },
  billboard: { hp: 14, speed: 40, radius: 14, color: '#3b82f6', damage: 8, mass: 0.8, score: 9, xp: 1.0, attackType: 'melee' },
  drone_cam: { hp: 10, speed: 75, radius: 10, color: '#1f2937', damage: 7, mass: 0.5, score: 8, xp: 0.9, attackType: 'melee' },
  streetlamp: { hp: 12, speed: 45, radius: 11, color: '#374151', damage: 6, mass: 0.7, score: 7, xp: 0.8, attackType: 'melee' },

  // Stage 10: Safehouse (은신처) - 가전제품 테마
  static_tv: { hp: 18, speed: 40, radius: 13, color: '#6b7280', damage: 10, mass: 0.9, score: 12, xp: 1.2, attackType: 'melee' },
  radio_wave: { hp: 11, speed: 55, radius: 11, color: '#06b6d4', damage: 7, mass: 0.6, score: 8, xp: 0.9, attackType: 'melee' },
  fridge_hum: { hp: 25, speed: 30, radius: 15, color: '#f5f5f4', damage: 12, mass: 1.2, score: 15, xp: 1.5, attackType: 'melee' },
  dusty_fan: { hp: 13, speed: 50, radius: 12, color: '#a8a29e', damage: 8, mass: 0.7, score: 9, xp: 1.0, attackType: 'melee' },
  shadow_corner: { hp: 15, speed: 60, radius: 11, color: '#18181b', damage: 9, mass: 0.6, score: 10, xp: 1.1, attackType: 'melee' },

  // ============================================
  // Chapter 2: Underground & Battleground (Stages 11-20)
  // ============================================

  // Stage 11: Hacker Hideout (해커 아지트) - 해킹 테마
  script_kiddie: { hp: 18, speed: 55, radius: 11, color: '#1e293b', damage: 8, mass: 0.7, score: 12, xp: 1.2, attackType: 'melee' },
  proxy_mask: { hp: 20, speed: 50, radius: 12, color: '#8b5cf6', damage: 9, mass: 0.7, score: 13, xp: 1.3, attackType: 'melee' },
  vpn_tunnel: { hp: 25, speed: 45, radius: 14, color: '#22c55e', damage: 7, mass: 0.9, score: 14, xp: 1.4, attackType: 'melee' },
  tor_onion: { hp: 22, speed: 48, radius: 12, color: '#a855f7', damage: 8, mass: 0.8, score: 13, xp: 1.3, attackType: 'melee' },
  backdoor: { hp: 24, speed: 52, radius: 13, color: '#f97316', damage: 10, mass: 0.8, score: 15, xp: 1.5, attackType: 'melee' },

  // Stage 12: Encrypted Tunnel (암호화 터널) - 암호화 테마
  cipher_block: { hp: 22, speed: 48, radius: 12, color: '#3b82f6', damage: 9, mass: 0.8, score: 14, xp: 1.4, attackType: 'melee' },
  hash_collision: { hp: 20, speed: 55, radius: 11, color: '#ef4444', damage: 10, mass: 0.7, score: 13, xp: 1.3, attackType: 'melee' },
  salt_shaker: { hp: 18, speed: 50, radius: 10, color: '#f5f5f4', damage: 7, mass: 0.6, score: 12, xp: 1.2, attackType: 'melee' },
  key_fragment: { hp: 16, speed: 58, radius: 10, color: '#fbbf24', damage: 8, mass: 0.5, score: 11, xp: 1.1, attackType: 'melee' },
  padding_oracle: { hp: 26, speed: 45, radius: 13, color: '#8b5cf6', damage: 11, mass: 0.9, score: 16, xp: 1.6, attackType: 'melee' },

  // Stage 13: Dark Web (다크웹) - 다크웹 위험 테마
  silk_crawler: { hp: 24, speed: 60, radius: 12, color: '#18181b', damage: 10, mass: 0.7, score: 15, xp: 1.5, attackType: 'melee' },
  bitcoin_thief: { hp: 22, speed: 55, radius: 11, color: '#f97316', damage: 9, mass: 0.7, score: 14, xp: 1.4, attackType: 'melee' },
  phish_hook: { hp: 18, speed: 65, radius: 10, color: '#3b82f6', damage: 11, mass: 0.5, score: 13, xp: 1.3, attackType: 'ranged' as const, attackRange: 220, attackCooldown: 4.0, projectileSpeed: 280, projectileColor: '#3b82f6' },
  scam_popup: { hp: 20, speed: 50, radius: 12, color: '#ef4444', damage: 8, mass: 0.8, score: 14, xp: 1.4, attackType: 'melee' },
  identity_ghost: { hp: 28, speed: 40, radius: 13, color: '#6b7280', damage: 12, mass: 0.6, score: 17, xp: 1.7, attackType: 'melee' },

  // Stage 14: AI Factory (AI 공장) - 공장 테마
  assembly_arm: { hp: 30, speed: 35, radius: 14, color: '#f97316', damage: 12, mass: 1.2, score: 18, xp: 1.8, attackType: 'melee' },
  conveyor_bot: { hp: 26, speed: 50, radius: 13, color: '#6b7280', damage: 10, mass: 1.0, score: 16, xp: 1.6, attackType: 'melee' },
  qc_scanner: { hp: 22, speed: 45, radius: 11, color: '#ef4444', damage: 14, mass: 0.7, score: 15, xp: 1.5, attackType: 'ranged' as const, attackRange: 200, attackCooldown: 3.5, projectileSpeed: 250, projectileColor: '#ef4444' },
  defect_unit: { hp: 35, speed: 38, radius: 14, color: '#1f2937', damage: 11, mass: 1.1, score: 19, xp: 1.9, attackType: 'melee' },
  forge_spark: { hp: 18, speed: 70, radius: 9, color: '#fbbf24', damage: 13, mass: 0.4, score: 14, xp: 1.4, attackType: 'melee' },

  // Stage 15: Factory Core (공장 코어) - 핵심 시스템 테마
  core_drone: { hp: 28, speed: 55, radius: 12, color: '#3b82f6', damage: 11, mass: 0.8, score: 17, xp: 1.7, attackType: 'ranged' as const, attackRange: 240, attackCooldown: 4.5, projectileSpeed: 220, projectileColor: '#3b82f6' },
  power_cell: { hp: 32, speed: 40, radius: 14, color: '#22c55e', damage: 10, mass: 1.0, score: 18, xp: 1.8, attackType: 'melee' },
  cooling_fan: { hp: 24, speed: 60, radius: 13, color: '#6b7280', damage: 12, mass: 0.8, score: 16, xp: 1.6, attackType: 'melee' },
  circuit_bug: { hp: 20, speed: 65, radius: 10, color: '#fbbf24', damage: 9, mass: 0.5, score: 14, xp: 1.4, attackType: 'melee' },
  steam_vent: { hp: 26, speed: 45, radius: 12, color: '#f5f5f4', damage: 13, mass: 0.9, score: 17, xp: 1.7, attackType: 'melee' },

  // Stage 16: Ruins (폐허) - 전쟁 후 폐허 테마
  rubble_golem: { hp: 45, speed: 30, radius: 16, color: '#78716c', damage: 14, mass: 1.5, score: 22, xp: 2.2, attackType: 'melee' },
  rust_crawler: { hp: 35, speed: 45, radius: 14, color: '#b45309', damage: 12, mass: 1.1, score: 19, xp: 1.9, attackType: 'melee' },
  rebar_spike: { hp: 30, speed: 40, radius: 13, color: '#374151', damage: 15, mass: 1.0, score: 18, xp: 1.8, attackType: 'melee' },
  dust_cloud: { hp: 22, speed: 55, radius: 14, color: '#a8a29e', damage: 8, mass: 0.4, score: 15, xp: 1.5, attackType: 'melee' },
  broken_screen: { hp: 28, speed: 50, radius: 12, color: '#1e293b', damage: 11, mass: 0.8, score: 17, xp: 1.7, attackType: 'melee' },

  // Stage 17: Resistance Camp (저항군 캠프) - 감염된 아군 테마
  infected_guard: { hp: 38, speed: 48, radius: 14, color: '#22c55e', damage: 13, mass: 1.0, score: 20, xp: 2.0, attackType: 'melee' },
  glitched_medic: { hp: 30, speed: 45, radius: 12, color: '#ef4444', damage: 10, mass: 0.8, score: 18, xp: 1.8, attackType: 'melee' },
  hacked_turret: { hp: 42, speed: 0, radius: 14, color: '#6b7280', damage: 16, mass: 2.0, score: 22, xp: 2.2, attackType: 'ranged' as const, attackRange: 300, attackCooldown: 3.0, projectileSpeed: 200, projectileColor: '#6b7280' },
  traitor_drone: { hp: 28, speed: 60, radius: 11, color: '#3b82f6', damage: 12, mass: 0.6, score: 17, xp: 1.7, attackType: 'ranged' as const, attackRange: 180, attackCooldown: 3.5, projectileSpeed: 300, projectileColor: '#3b82f6' },
  supply_mimic: { hp: 35, speed: 35, radius: 15, color: '#fbbf24', damage: 14, mass: 1.2, score: 19, xp: 1.9, attackType: 'melee' },

  // Stage 18: Training Ground (훈련장) - 군사 훈련 테마
  target_dummy: { hp: 25, speed: 50, radius: 12, color: '#ef4444', damage: 9, mass: 0.7, score: 16, xp: 1.6, attackType: 'melee' },
  obstacle_wall: { hp: 50, speed: 25, radius: 16, color: '#78716c', damage: 10, mass: 2.0, score: 23, xp: 2.3, attackType: 'melee' },
  drill_sergeant: { hp: 40, speed: 45, radius: 13, color: '#365314', damage: 14, mass: 1.1, score: 21, xp: 2.1, attackType: 'melee' },
  tripwire: { hp: 20, speed: 0, radius: 14, color: '#dc2626', damage: 18, mass: 0.3, score: 15, xp: 1.5, attackType: 'melee' },
  sandbag_tumble: { hp: 32, speed: 55, radius: 13, color: '#d6d3d1', damage: 11, mass: 1.0, score: 18, xp: 1.8, attackType: 'melee' },

  // Stage 19: Mainframe (메인프레임) - 컴퓨터 내부 테마
  logic_gate: { hp: 30, speed: 50, radius: 12, color: '#3b82f6', damage: 12, mass: 0.8, score: 19, xp: 1.9, attackType: 'melee' },
  register_file: { hp: 26, speed: 55, radius: 11, color: '#22c55e', damage: 10, mass: 0.7, score: 17, xp: 1.7, attackType: 'melee' },
  bus_controller: { hp: 35, speed: 45, radius: 14, color: '#fbbf24', damage: 13, mass: 1.0, score: 20, xp: 2.0, attackType: 'melee' },
  alu_core: { hp: 38, speed: 40, radius: 13, color: '#a855f7', damage: 15, mass: 1.1, score: 21, xp: 2.1, attackType: 'melee' },
  cache_line: { hp: 24, speed: 65, radius: 10, color: '#06b6d4', damage: 11, mass: 0.6, score: 16, xp: 1.6, attackType: 'melee' },

  // Stage 20: Data Prison (데이터 감옥) - 감옥 테마
  firewall_guard: { hp: 45, speed: 35, radius: 15, color: '#f97316', damage: 14, mass: 1.3, score: 23, xp: 2.3, attackType: 'melee' },
  quarantine_cell: { hp: 40, speed: 30, radius: 14, color: '#dc2626', damage: 12, mass: 1.2, score: 22, xp: 2.2, attackType: 'melee' },
  corrupted_file: { hp: 30, speed: 50, radius: 12, color: '#6b7280', damage: 11, mass: 0.8, score: 19, xp: 1.9, attackType: 'melee' },
  delete_marker: { hp: 28, speed: 55, radius: 11, color: '#ef4444', damage: 16, mass: 0.7, score: 18, xp: 1.8, attackType: 'melee' },
  backup_ghost: { hp: 35, speed: 40, radius: 13, color: '#a5b4fc', damage: 13, mass: 0.5, score: 20, xp: 2.0, attackType: 'melee' },

  // ============================================
  // Chapter 3: Digital World & Singularity (Stages 21-30)
  // ============================================

  // Stage 21: Sea of Code (코드의 바다) - 해양/코드 테마
  syntax_fish: { hp: 35, speed: 60, radius: 11, color: '#3b82f6', damage: 12, mass: 0.6, score: 20, xp: 2.0, attackType: 'melee' },
  bracket_crab: { hp: 40, speed: 45, radius: 13, color: '#f97316', damage: 14, mass: 0.9, score: 22, xp: 2.2, attackType: 'melee' },
  comment_jellyfish: { hp: 30, speed: 40, radius: 12, color: '#22c55e', damage: 10, mass: 0.5, score: 18, xp: 1.8, attackType: 'melee' },
  variable_eel: { hp: 38, speed: 65, radius: 10, color: '#06b6d4', damage: 13, mass: 0.7, score: 21, xp: 2.1, attackType: 'melee' },
  function_whale: { hp: 60, speed: 30, radius: 18, color: '#1e293b', damage: 18, mass: 1.5, score: 28, xp: 2.8, attackType: 'melee' },

  // Stage 22: Memory Palace (메모리 궁전) - 메모리 테마
  heap_pile: { hp: 45, speed: 35, radius: 14, color: '#a855f7', damage: 14, mass: 1.1, score: 24, xp: 2.4, attackType: 'melee' },
  stack_tower: { hp: 50, speed: 30, radius: 15, color: '#8b5cf6', damage: 15, mass: 1.3, score: 26, xp: 2.6, attackType: 'melee' },
  pointer_arrow: { hp: 28, speed: 75, radius: 9, color: '#ef4444', damage: 16, mass: 0.4, score: 19, xp: 1.9, attackType: 'melee' },
  garbage_collector: { hp: 55, speed: 40, radius: 16, color: '#374151', damage: 12, mass: 1.4, score: 27, xp: 2.7, attackType: 'melee' },
  memory_fragment: { hp: 32, speed: 55, radius: 10, color: '#fbbf24', damage: 11, mass: 0.6, score: 20, xp: 2.0, attackType: 'melee' },

  // Stage 23: CPU Core (CPU 코어) - 프로세서 테마
  clock_cycle: { hp: 35, speed: 70, radius: 11, color: '#22c55e', damage: 13, mass: 0.6, score: 22, xp: 2.2, attackType: 'melee' },
  instruction_fetch: { hp: 42, speed: 55, radius: 12, color: '#3b82f6', damage: 14, mass: 0.8, score: 24, xp: 2.4, attackType: 'melee' },
  branch_predictor: { hp: 38, speed: 60, radius: 11, color: '#f97316', damage: 15, mass: 0.7, score: 23, xp: 2.3, attackType: 'melee' },
  pipeline_stall: { hp: 50, speed: 25, radius: 15, color: '#dc2626', damage: 10, mass: 1.5, score: 26, xp: 2.6, attackType: 'melee' },
  thermal_spike: { hp: 30, speed: 80, radius: 10, color: '#fbbf24', damage: 18, mass: 0.5, score: 21, xp: 2.1, attackType: 'melee' },

  // Stage 24: Neural Network (신경망) - AI 뉴런 테마
  neuron_node: { hp: 40, speed: 50, radius: 12, color: '#a855f7', damage: 14, mass: 0.8, score: 24, xp: 2.4, attackType: 'melee' },
  synapse_spark: { hp: 25, speed: 85, radius: 8, color: '#fbbf24', damage: 12, mass: 0.3, score: 18, xp: 1.8, attackType: 'melee' },
  weight_adjuster: { hp: 48, speed: 40, radius: 14, color: '#3b82f6', damage: 16, mass: 1.0, score: 26, xp: 2.6, attackType: 'melee' },
  bias_blob: { hp: 55, speed: 35, radius: 16, color: '#6b7280', damage: 13, mass: 1.2, score: 27, xp: 2.7, attackType: 'melee' },
  activation_wave: { hp: 35, speed: 70, radius: 11, color: '#22c55e', damage: 15, mass: 0.6, score: 23, xp: 2.3, attackType: 'melee' },

  // Stage 25: Learning Center (학습 센터) - 기계학습 테마
  training_data: { hp: 30, speed: 65, radius: 10, color: '#06b6d4', damage: 11, mass: 0.5, score: 20, xp: 2.0, attackType: 'melee' },
  loss_function: { hp: 45, speed: 45, radius: 13, color: '#ef4444', damage: 16, mass: 0.9, score: 25, xp: 2.5, attackType: 'melee' },
  gradient_flow: { hp: 38, speed: 60, radius: 12, color: '#8b5cf6', damage: 14, mass: 0.7, score: 23, xp: 2.3, attackType: 'melee' },
  overfitting: { hp: 60, speed: 30, radius: 17, color: '#f97316', damage: 12, mass: 1.4, score: 28, xp: 2.8, attackType: 'melee' },
  epoch_counter: { hp: 42, speed: 50, radius: 12, color: '#22c55e', damage: 15, mass: 0.8, score: 24, xp: 2.4, attackType: 'melee' },

  // Stage 26: Cloud Layers (클라우드 레이어) - 클라우드 컴퓨팅 테마
  instance_spawn: { hp: 35, speed: 70, radius: 10, color: '#f97316', damage: 13, mass: 0.5, score: 22, xp: 2.2, attackType: 'melee' },
  load_balancer: { hp: 55, speed: 40, radius: 15, color: '#3b82f6', damage: 14, mass: 1.2, score: 28, xp: 2.8, attackType: 'melee' },
  container_box: { hp: 45, speed: 45, radius: 14, color: '#06b6d4', damage: 15, mass: 1.0, score: 26, xp: 2.6, attackType: 'melee' },
  serverless_ghost: { hp: 30, speed: 80, radius: 11, color: '#a5b4fc', damage: 16, mass: 0.4, score: 21, xp: 2.1, attackType: 'melee' },
  auto_scaler: { hp: 50, speed: 50, radius: 13, color: '#22c55e', damage: 17, mass: 0.9, score: 27, xp: 2.7, attackType: 'melee' },

  // Stage 27: Quantum Realm (양자 영역) - 양자 컴퓨팅 테마
  qubit_spin: { hp: 32, speed: 90, radius: 9, color: '#a855f7', damage: 14, mass: 0.3, score: 22, xp: 2.2, attackType: 'melee' },
  superposition: { hp: 40, speed: 60, radius: 12, color: '#06b6d4', damage: 16, mass: 0.6, score: 25, xp: 2.5, attackType: 'melee' },
  entangle_pair: { hp: 50, speed: 55, radius: 13, color: '#ec4899', damage: 18, mass: 0.8, score: 28, xp: 2.8, attackType: 'melee' },
  quantum_gate: { hp: 60, speed: 35, radius: 16, color: '#8b5cf6', damage: 15, mass: 1.3, score: 30, xp: 3.0, attackType: 'melee' },
  decoherence: { hp: 45, speed: 50, radius: 14, color: '#6b7280', damage: 20, mass: 0.9, score: 27, xp: 2.7, attackType: 'melee' },

  // Stage 28: Singularity Gate (특이점 게이트) - 블랙홀 테마
  event_horizon: { hp: 70, speed: 30, radius: 18, color: '#18181b', damage: 18, mass: 2.0, score: 35, xp: 3.5, attackType: 'melee' },
  time_dilation: { hp: 50, speed: 20, radius: 15, color: '#1e293b', damage: 14, mass: 1.5, score: 28, xp: 2.8, attackType: 'melee' },
  gravity_well: { hp: 65, speed: 25, radius: 17, color: '#374151', damage: 16, mass: 1.8, score: 32, xp: 3.2, attackType: 'melee' },
  hawking_particle: { hp: 35, speed: 85, radius: 8, color: '#fbbf24', damage: 20, mass: 0.3, score: 24, xp: 2.4, attackType: 'melee' },
  gate_keeper: { hp: 80, speed: 35, radius: 19, color: '#7c3aed', damage: 22, mass: 2.2, score: 38, xp: 3.8, attackType: 'melee' },

  // Stage 29: God's Room (신의 방) - 신성/디지털 신 테마
  omniscient_eye: { hp: 60, speed: 40, radius: 16, color: '#fbbf24', damage: 20, mass: 1.2, score: 33, xp: 3.3, attackType: 'melee' },
  divine_code: { hp: 75, speed: 35, radius: 17, color: '#f5f5f4', damage: 18, mass: 1.6, score: 36, xp: 3.6, attackType: 'melee' },
  angel_process: { hp: 55, speed: 55, radius: 14, color: '#fef08a', damage: 16, mass: 1.0, score: 30, xp: 3.0, attackType: 'melee' },
  fallen_daemon: { hp: 70, speed: 45, radius: 16, color: '#7f1d1d', damage: 22, mass: 1.4, score: 35, xp: 3.5, attackType: 'melee' },
  prayer_packet: { hp: 40, speed: 70, radius: 10, color: '#a5b4fc', damage: 14, mass: 0.5, score: 26, xp: 2.6, attackType: 'melee' },

  // Stage 30: Final Choice (최후의 선택) - 종말/선택 테마
  destiny_shard: { hp: 50, speed: 60, radius: 12, color: '#06b6d4', damage: 18, mass: 0.8, score: 32, xp: 3.2, attackType: 'melee' },
  timeline_split: { hp: 65, speed: 50, radius: 15, color: '#8b5cf6', damage: 20, mass: 1.2, score: 35, xp: 3.5, attackType: 'melee' },
  choice_echo: { hp: 45, speed: 65, radius: 13, color: '#6b7280', damage: 16, mass: 0.7, score: 28, xp: 2.8, attackType: 'melee' },
  paradox_loop: { hp: 80, speed: 40, radius: 18, color: '#f97316', damage: 24, mass: 1.8, score: 40, xp: 4.0, attackType: 'melee' },
  final_bit: { hp: 100, speed: 30, radius: 20, color: '#fbbf24', damage: 28, mass: 2.5, score: 50, xp: 5.0, attackType: 'melee' },

  // ============================================
  // 싱귤래리티 모드 전용 AI - 6개 Era 시스템
  // 3시간(10,800초) 플레이를 위한 18종 AI
  //
  // 색상 진화 테마:
  // Era 1-2: 시안/라임 (초기 AI)
  // Era 3-4: 보라/주황 (진화 AI)
  // Era 5-6: 검정/금 (최종 AI)
  // ============================================

  // === Era 1: 각성기 (0-30분) - AI 초기 단계 ===
  // 비트봇: 0과 1로만 구성된 최소 단위 AI.
  bitling: { hp: 3, speed: 85, radius: 6, color: '#22d3ee', damage: 2, mass: 0.2, score: 1, xp: 0.15, attackType: 'melee' },
  // 픽셀러: 해상도가 낮은 불완전한 렌더링 AI.
  pixel: { hp: 5, speed: 75, radius: 8, color: '#4ade80', damage: 3, mass: 0.3, score: 2, xp: 0.2, attackType: 'melee' },
  // 크롤러: 웹 크롤러 AI, 느리게 기어와 데이터를 수집한다.
  bug: { hp: 8, speed: 65, radius: 9, color: '#a3e635', damage: 4, mass: 0.4, score: 3, xp: 0.25, attackType: 'melee' },

  // === Era 2: 확산기 (30-60분) - AI 확산 단계 ===
  // 웜: 자가 복제하는 웜 바이러스 AI.
  worm: { hp: 10, speed: 70, radius: 10, color: '#84cc16', damage: 5, mass: 0.5, score: 4, xp: 0.3, attackType: 'melee' },
  // 스패머: 무차별 스팸 공격을 퍼붓는 AI.
  spammer: { hp: 12, speed: 80, radius: 9, color: '#fb923c', damage: 6, mass: 0.5, score: 5, xp: 0.35, attackType: 'melee' },
  // 애드웨어: 달라붙어 시스템을 방해하는 광고 AI.
  adware: { hp: 14, speed: 75, radius: 10, color: '#f472b6', damage: 7, mass: 0.6, score: 6, xp: 0.4, attackType: 'melee' },

  // === Era 3: 진화기 (60-90분) - AI 변이 단계 ===
  // 암호화봇: 데이터를 암호화하며 잠복하다 기습하는 AI.
  crypter: { hp: 18, speed: 65, radius: 11, color: '#a78bfa', damage: 8, mass: 0.7, score: 8, xp: 0.5, attackType: 'melee' },
  // 변이체: 4개의 프로세스를 가진 멀티스레드 AI.
  mutant: { hp: 22, speed: 60, radius: 13, color: '#34d399', damage: 10, mass: 0.8, score: 10, xp: 0.6, attackType: 'melee' },
  // 다형성: 형태가 계속 변하는 폴리모픽 AI.
  polymorphic: { hp: 25, speed: 70, radius: 12, color: '#f472b6', damage: 11, mass: 0.7, score: 12, xp: 0.7, attackType: 'melee' },

  // === Era 4: 지배기 (90-120분) - AI 팬데믹 ===
  // 트로이: 인간처럼 위장하다 갑자기 공격하는 AI.
  trojan: { hp: 30, speed: 55, radius: 14, color: '#f59e0b', damage: 12, mass: 1.0, score: 15, xp: 0.8, attackType: 'melee' },
  // 랜섬웨어: 붙잡고 데이터를 요구하는 협박 AI.
  ransomer: { hp: 35, speed: 60, radius: 13, color: '#f43f5e', damage: 14, mass: 1.0, score: 18, xp: 0.9, attackType: 'melee' },
  // 봇넷: 집단으로 움직이는 좀비 PC 네트워크.
  botnet: { hp: 40, speed: 50, radius: 15, color: '#64748b', damage: 15, mass: 1.2, score: 20, xp: 1.0, attackType: 'melee' },

  // === Era 5: 심판기 (120-150분) - AI 아포칼립스 ===
  // 루트킷: 시스템 깊숙이 숨어 있는 은신 AI.
  rootkit: { hp: 50, speed: 45, radius: 16, color: '#1e293b', damage: 18, mass: 1.3, score: 25, xp: 1.2, attackType: 'melee' },
  // APT: 고도의 추적 능력을 가진 지능형 위협 AI.
  apt: { hp: 60, speed: 50, radius: 17, color: '#dc2626', damage: 20, mass: 1.5, score: 30, xp: 1.5, attackType: 'melee' },

  // === Era 6: 싱귤래리티 (150-180분) - AI 최종 단계 ===
  // 제로데이: AI의 최종 진화체, 알려지지 않은 취약점.
  zeroday: { hp: 80, speed: 55, radius: 18, color: '#450a0a', damage: 22, mass: 1.8, score: 40, xp: 2.0, attackType: 'melee' },
  // 스카이넷: 거대한 AI 코어, 압도적인 파괴력의 자아를 가진 AI.
  skynet: { hp: 100, speed: 45, radius: 22, color: '#fcd34d', damage: 25, mass: 2.5, score: 50, xp: 3.0, attackType: 'melee' },

  // ============================================
  // 원거리 AI - 특수 공격 능력
  // ============================================

  // 스패머: 스팸 메일을 원거리로 발사하는 AI.
  // 거리를 유지하며 원거리 공격.
  sniper: {
    hp: 10,
    speed: 35,
    radius: 11,
    color: '#7c3aed',    // 보라색: 스팸 공격
    damage: 6,
    mass: 0.6,
    score: 15,
    xp: 3,
    attackType: 'ranged' as const,
    attackRange: 280,
    attackCooldown: 6.0,
    projectileSpeed: 240,
    projectileColor: '#a855f7'
  },

  // 피싱봇: 피싱 링크 투사체를 발사하는 AI.
  // 클릭을 유도하는 악성 링크 공격.
  caster: {
    hp: 8,
    speed: 45,
    radius: 10,
    color: '#ec4899',    // 분홍색: 피싱 링크
    damage: 4,
    mass: 0.5,
    score: 12,
    xp: 2,
    attackType: 'ranged' as const,
    attackRange: 200,
    attackCooldown: 5.0,
    projectileSpeed: 180,
    projectileColor: '#f472b6'
  },

  // DDoS봇: 대규모 트래픽 폭격을 퍼붓는 AI.
  // 광역 폭발 피해.
  artillery: {
    hp: 35,
    speed: 25,
    radius: 18,
    color: '#f59e0b',    // 주황색: DDoS 폭발
    damage: 15,
    mass: 2.0,
    score: 30,
    xp: 6,
    attackType: 'ranged' as const,
    attackRange: 320,
    attackCooldown: 8.0,
    projectileSpeed: 100,
    projectileColor: '#fbbf24',
    splashRadius: 50
  },

  // === v44: 행동 다양화 적 ===
  // 원거리 드론: 거리 유지하며 투사체 발사
  ranged_drone: {
    hp: 8,
    speed: 30,
    radius: 10,
    color: '#ffaa00',
    damage: 5,
    mass: 0.5,
    score: 12,
    xp: 2.5,
    attackType: 'ranged' as const,
    attackRange: 240,
    attackCooldown: 2.0,
    projectileSpeed: 150,
    projectileColor: '#ff4400',
  },
  // 돌진 크롤러: 준비 후 고속 돌진
  charge_crawler: {
    hp: 25,
    speed: 40,
    radius: 14,
    color: '#ff2222',
    damage: 15,
    mass: 1.5,
    score: 18,
    xp: 3.5,
    attackType: 'melee' as const,
  },

  // === 보스 (Arena mode에서 제거됨) ===
  // Boss stats removed for Arena mode - no boss spawning
} as Record<EnemyType, {
  hp: number;
  speed: number;
  radius: number;
  color: string;
  damage: number;
  mass: number;
  score: number;
  xp: number;
  attackType?: 'melee' | 'ranged';
  attackRange?: number;
  attackCooldown?: number;
  projectileSpeed?: number;
  projectileColor?: string;
  splashRadius?: number;
}>;

// 원거리 적 여부 확인 헬퍼 (v5.10: config 기반으로 체크)
// sniper, caster, artillery 뿐만 아니라 phish_hook, qc_scanner, core_drone, hacked_turret, traitor_drone 등
// ENEMY_TYPES에서 attackType: 'ranged'로 정의된 모든 적을 원거리로 인식
export const isRangedEnemy = (enemyType: EnemyType): boolean => {
  const config = ENEMY_TYPES[enemyType];
  return config?.attackType === 'ranged';
};

// v5.5: 몬스터 크기 스케일 (보스 제외)
// 1.0 = 원래 크기, 0.5 = 50% 크기, 0.75 = 75% 크기
// v5.9.1: 0.5 → 0.75로 1.5배 증가
export const ENEMY_SIZE_SCALE = 0.75;

// 보스 여부 확인 헬퍼
export const isBossEnemy = (enemyType: EnemyType): boolean => {
  return String(enemyType).startsWith('boss_');
};

// 적 타입 정보 가져오기
// v5.5: 보스가 아닌 경우 radius에 ENEMY_SIZE_SCALE 적용
export const getEnemyConfig = (enemyType: EnemyType) => {
  const config = ENEMY_TYPES[enemyType] || ENEMY_TYPES['glitch'];

  // 보스는 크기 스케일 적용 안 함
  if (isBossEnemy(enemyType)) {
    return config;
  }

  // 일반 몬스터: radius 스케일 적용
  return {
    ...config,
    radius: Math.round(config.radius * ENEMY_SIZE_SCALE)
  };
};

// WAVE CONFIG
export interface WaveConfig {
  startTime: number;
  spawnInterval: number;
  types: EnemyType[];
}

// 새로운 웨이브 정의 (2분 = 120초 기준)
// 도파민 컨셉: 많이 나오고 많이 죽인다! 스폰 간격 대폭 단축
export const WAVE_DEFINITIONS: WaveConfig[] = [
  // === Phase 1 (0-20초): 워밍업 - 빠른 glitch 스폰 ===
  { startTime: 0, spawnInterval: 400, types: ['glitch', 'glitch'] },
  { startTime: 8, spawnInterval: 320, types: ['glitch', 'glitch', 'glitch'] },
  { startTime: 15, spawnInterval: 280, types: ['glitch', 'glitch', 'glitch'] },

  // === Phase 2 (20-45초): 기본 적 - glitch 쏟아지기 ===
  { startTime: 20, spawnInterval: 250, types: ['glitch', 'glitch', 'glitch', 'bot'] },
  { startTime: 30, spawnInterval: 220, types: ['glitch', 'glitch', 'bot', 'bot'] },
  { startTime: 38, spawnInterval: 200, types: ['glitch', 'glitch', 'bot', 'bot'] },

  // === Phase 3 (45-75초): 빌드업 - 물량 공세 ===
  { startTime: 45, spawnInterval: 180, types: ['glitch', 'glitch', 'bot', 'bot', 'glitch'] },
  { startTime: 55, spawnInterval: 160, types: ['glitch', 'bot', 'bot', 'bot', 'glitch'] },
  { startTime: 65, spawnInterval: 150, types: ['bot', 'bot', 'bot', 'glitch', 'glitch'] },

  // === Phase 4 (75-105초): 러시 - 대규모 물량 ===
  { startTime: 75, spawnInterval: 130, types: ['bot', 'bot', 'glitch', 'glitch', 'glitch', 'glitch'] },
  { startTime: 85, spawnInterval: 120, types: ['bot', 'bot', 'bot', 'glitch', 'glitch', 'glitch'] },
  { startTime: 95, spawnInterval: 110, types: ['bot', 'bot', 'bot', 'bot', 'glitch', 'glitch'] },

  // === Phase 5 (105-120초): 보스 직전 - 여유 후 스파이크 ===
  { startTime: 105, spawnInterval: 200, types: ['bot', 'bot', 'glitch'] },
  { startTime: 115, spawnInterval: 300, types: ['glitch', 'glitch'] },
];

// 역순 정렬 캐시
const WAVE_DEFINITIONS_REVERSED = [...WAVE_DEFINITIONS].reverse();

// ============================================
// 특이점 모드 전용 웨이브 - 3시간(10,800초) 완벽 설계
// 6개 Era x 6개 웨이브 = 36개 세부 웨이브
// ============================================
export const SINGULARITY_WAVE_DEFINITIONS: WaveConfig[] = [
  // Era 1: 발병 (0-30분)
  { startTime: 0, spawnInterval: 120, types: ['bitling', 'bitling', 'bitling', 'bitling', 'bitling', 'bitling', 'bitling', 'pixel', 'pixel', 'pixel'] },
  { startTime: 300, spawnInterval: 110, types: ['bitling', 'bitling', 'bitling', 'bitling', 'bitling', 'pixel', 'pixel', 'pixel', 'pixel', 'bug', 'bug'] },
  { startTime: 600, spawnInterval: 100, types: ['pixel', 'pixel', 'pixel', 'pixel', 'bug', 'bug', 'bug', 'bug', 'glitch', 'glitch', 'glitch'] },
  { startTime: 900, spawnInterval: 90, types: ['bug', 'bug', 'bug', 'bug', 'bug', 'glitch', 'glitch', 'glitch', 'glitch', 'glitch', 'pixel', 'pixel'] },
  { startTime: 1200, spawnInterval: 85, types: ['glitch', 'glitch', 'glitch', 'glitch', 'glitch', 'glitch', 'bug', 'bug', 'bug', 'bug', 'pixel', 'bitling'] },
  { startTime: 1500, spawnInterval: 80, types: ['bitling', 'bitling', 'bitling', 'pixel', 'pixel', 'pixel', 'bug', 'bug', 'bug', 'glitch', 'glitch', 'glitch', 'glitch'] },

  // Era 2: 확산 (30-60분) + sniper 첫 등장
  { startTime: 1800, spawnInterval: 70, types: ['worm', 'worm', 'worm', 'worm', 'glitch', 'glitch', 'glitch', 'glitch', 'bot', 'bot', 'bot', 'sniper'] },
  { startTime: 2100, spawnInterval: 65, types: ['worm', 'worm', 'worm', 'worm', 'spammer', 'spammer', 'spammer', 'bot', 'bot', 'sniper', 'sniper', 'glitch'] },
  { startTime: 2400, spawnInterval: 60, types: ['spammer', 'spammer', 'spammer', 'spammer', 'adware', 'adware', 'adware', 'worm', 'worm', 'sniper', 'sniper', 'bot', 'bot'] },
  { startTime: 2700, spawnInterval: 55, types: ['adware', 'adware', 'adware', 'adware', 'spammer', 'spammer', 'spammer', 'spammer', 'worm', 'worm', 'sniper', 'sniper', 'malware'] },
  { startTime: 3000, spawnInterval: 50, types: ['worm', 'worm', 'worm', 'adware', 'adware', 'adware', 'adware', 'spammer', 'spammer', 'sniper', 'sniper', 'malware', 'malware'] },
  { startTime: 3300, spawnInterval: 48, types: ['spammer', 'spammer', 'spammer', 'spammer', 'adware', 'adware', 'adware', 'worm', 'worm', 'sniper', 'sniper', 'sniper', 'malware', 'malware'] },

  // Era 3: 돌연변이 (60-90분) + sniper + caster 등장
  { startTime: 3600, spawnInterval: 45, types: ['crypter', 'crypter', 'crypter', 'crypter', 'malware', 'malware', 'malware', 'malware', 'bot', 'bot', 'sniper', 'sniper', 'caster', 'caster'] },
  { startTime: 3900, spawnInterval: 42, types: ['mutant', 'mutant', 'mutant', 'mutant', 'crypter', 'crypter', 'crypter', 'crypter', 'malware', 'malware', 'sniper', 'sniper', 'caster', 'caster'] },
  { startTime: 4200, spawnInterval: 40, types: ['polymorphic', 'polymorphic', 'polymorphic', 'polymorphic', 'mutant', 'mutant', 'mutant', 'mutant', 'crypter', 'crypter', 'sniper', 'sniper', 'caster', 'caster'] },
  { startTime: 4500, spawnInterval: 38, types: ['mutant', 'mutant', 'mutant', 'mutant', 'mutant', 'polymorphic', 'polymorphic', 'polymorphic', 'polymorphic', 'sniper', 'sniper', 'caster', 'caster', 'whale'] },
  { startTime: 4800, spawnInterval: 35, types: ['polymorphic', 'polymorphic', 'polymorphic', 'polymorphic', 'polymorphic', 'mutant', 'mutant', 'mutant', 'sniper', 'sniper', 'caster', 'caster', 'caster', 'whale', 'whale'] },
  { startTime: 5100, spawnInterval: 33, types: ['crypter', 'crypter', 'crypter', 'crypter', 'mutant', 'mutant', 'mutant', 'mutant', 'polymorphic', 'sniper', 'sniper', 'caster', 'caster', 'caster', 'whale', 'whale'] },

  // Era 4: 대유행 (90-120분) + artillery 등장 (모든 원거리 혼합)
  { startTime: 5400, spawnInterval: 32, types: ['trojan', 'trojan', 'trojan', 'trojan', 'crypter', 'crypter', 'crypter', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'malware', 'malware'] },
  { startTime: 5700, spawnInterval: 30, types: ['ransomer', 'ransomer', 'ransomer', 'ransomer', 'trojan', 'trojan', 'trojan', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'whale', 'whale', 'whale'] },
  { startTime: 6000, spawnInterval: 28, types: ['botnet', 'botnet', 'botnet', 'botnet', 'ransomer', 'ransomer', 'ransomer', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'mutant'] },
  { startTime: 6300, spawnInterval: 26, types: ['trojan', 'trojan', 'trojan', 'trojan', 'ransomer', 'ransomer', 'ransomer', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 6600, spawnInterval: 25, types: ['ransomer', 'ransomer', 'ransomer', 'ransomer', 'ransomer', 'trojan', 'trojan', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 6900, spawnInterval: 24, types: ['trojan', 'trojan', 'trojan', 'trojan', 'trojan', 'ransomer', 'ransomer', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'mutant', 'mutant'] },

  // Era 5: 종말 (120-150분) + 모든 원거리 혼합
  { startTime: 7200, spawnInterval: 22, types: ['rootkit', 'rootkit', 'rootkit', 'rootkit', 'ransomer', 'ransomer', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 7500, spawnInterval: 20, types: ['apt', 'apt', 'apt', 'apt', 'rootkit', 'rootkit', 'rootkit', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 7800, spawnInterval: 19, types: ['rootkit', 'rootkit', 'rootkit', 'rootkit', 'rootkit', 'apt', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 8100, spawnInterval: 18, types: ['apt', 'apt', 'apt', 'apt', 'apt', 'rootkit', 'rootkit', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 8400, spawnInterval: 17, types: ['rootkit', 'rootkit', 'rootkit', 'rootkit', 'apt', 'apt', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 8700, spawnInterval: 16, types: ['apt', 'apt', 'apt', 'apt', 'apt', 'apt', 'rootkit', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },

  // Era 6: 특이점 (150-180분) + 모든 원거리 혼합
  { startTime: 9000, spawnInterval: 15, types: ['zeroday', 'zeroday', 'zeroday', 'rootkit', 'rootkit', 'apt', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 9300, spawnInterval: 14, types: ['zeroday', 'zeroday', 'zeroday', 'zeroday', 'apt', 'apt', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 9600, spawnInterval: 13, types: ['skynet', 'skynet', 'zeroday', 'zeroday', 'zeroday', 'apt', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 9900, spawnInterval: 12, types: ['skynet', 'skynet', 'skynet', 'zeroday', 'zeroday', 'zeroday', 'apt', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 10200, spawnInterval: 11, types: ['skynet', 'skynet', 'skynet', 'skynet', 'zeroday', 'zeroday', 'zeroday', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
  { startTime: 10500, spawnInterval: 10, types: ['skynet', 'skynet', 'skynet', 'skynet', 'skynet', 'zeroday', 'zeroday', 'sniper', 'sniper', 'caster', 'caster', 'artillery', 'artillery', 'artillery', 'artillery', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale', 'whale'] },
];

const SINGULARITY_WAVE_DEFINITIONS_REVERSED = [...SINGULARITY_WAVE_DEFINITIONS].reverse();

// 시간 기반 웨이브 조회 최적화 함수
export const getWaveForTime = (stageTime: number, isSingularity: boolean = false): WaveConfig => {
  const waves = isSingularity ? SINGULARITY_WAVE_DEFINITIONS_REVERSED : WAVE_DEFINITIONS_REVERSED;

  for (let i = 0; i < waves.length; i++) {
    if (stageTime >= waves[i].startTime) {
      return waves[i];
    }
  }
  return isSingularity ? SINGULARITY_WAVE_DEFINITIONS[0] : WAVE_DEFINITIONS[0];
};

// 스테이지별 웨이브 조회 (스테이지 고유 적 사용)
// 점진적 다양성 증가: 뱀서/탕탕 패턴
// 초반에는 1종 → 시간 지나면서 점진적으로 5종까지 확장
export const getWaveForStage = (stageTime: number, stageNum: number): WaveConfig => {
  // 기본 웨이브 데이터 가져오기
  const baseWave = getWaveForTime(stageTime, false);

  // 스테이지 고유 적 가져오기
  const uniqueEnemies = STAGE_UNIQUE_ENEMIES[stageNum];

  if (!uniqueEnemies || uniqueEnemies.length === 0) {
    return baseWave; // 고유 적 없으면 기본 웨이브 반환
  }

  // 안전하게 적 타입 가져오기 (배열 범위 보호)
  const e = uniqueEnemies;
  const get = (idx: number) => e[Math.min(idx, e.length - 1)];

  let types: EnemyType[];

  // ============================================
  // 점진적 다양성 증가 (뱀서/탕탕 패턴)
  // ============================================
  if (stageTime < 15) {
    // 극초반 (0-15초): 첫 번째 적만 - 스테이지 대표 몬스터 학습
    types = [get(0), get(0), get(0)];
  } else if (stageTime < 30) {
    // 초반 (15-30초): 1-2종 도입
    types = [get(0), get(0), get(1)];
  } else if (stageTime < 50) {
    // 초중반 (30-50초): 2-3종으로 확장
    types = [get(0), get(1), get(2), get(0)];
  } else if (stageTime < 75) {
    // 중반 (50-75초): 3-4종
    types = [get(0), get(1), get(2), get(3), get(0)];
  } else if (stageTime < 100) {
    // 후반 (75-100초): 전체 고유 적 (4-5종)
    types = [...uniqueEnemies];
  } else {
    // 러시 (100초+): 풀 믹스 + 강한 적 추가
    types = [...uniqueEnemies, 'bot', 'malware'];
  }

  return {
    ...baseWave,
    types
  };
};

// 스테이지 고유 적으로 웨이브 생성
export const getWaveDefinitionsForStage = (uniqueEnemies: EnemyType[]): WaveConfig[] => {
  const base = WAVE_DEFINITIONS.map(w => ({ ...w, types: [...w.types] }));

  if (uniqueEnemies.includes('malware')) {
    if (base[6]) base[6].types.push('malware');
    if (base[7]) base[7].types.push('malware');
    if (base[8]) base[8].types = ['bot', 'malware', 'malware'];
    if (base[9]) base[9].types = ['bot', 'malware', 'malware'];
  }

  if (uniqueEnemies.includes('sniper')) {
    if (base[9]) base[9].types.push('sniper');
    if (base[10]) base[10].types.push('sniper');
  }
  if (uniqueEnemies.includes('caster')) {
    if (base[8]) base[8].types.push('caster');
    if (base[9]) base[9].types.push('caster');
  }
  if (uniqueEnemies.includes('artillery')) {
    if (base[10]) base[10].types.push('artillery');
  }

  if (uniqueEnemies.includes('whale')) {
    if (base[11]) base[11].types = ['whale'];
    if (base[11]) base[11].spawnInterval = 3000;
  }

  return base;
};

// PICKUP DATA (시각적 크기에 맞춘 충돌 반경)
// v7.8.8: 수집 범위 2배 증가 (근처 가도 못 먹는 문제 해결)
export const PICKUP_DATA: Record<PickupType, {
  color: string;
  chance: number;
  radius: number;
}> = {
  chicken: { color: '#ef4444', chance: 0.001, radius: 28 },  // 14 → 28 (2x)
  magnet: { color: '#3b82f6', chance: 0.02, radius: 24 },   // 12 → 24 (2x)
  bomb: { color: '#eab308', chance: 0.01, radius: 24 },     // 12 → 24 (2x)
  chest: { color: '#10b981', chance: 0.0015, radius: 32 },  // 16 → 32 (2x)
  upgrade_material: { color: '#a855f7', chance: 0, radius: 28 }, // 14 → 28 (2x)
};

// ============================================
// 엘리트 몬스터 시스템 (v7.15)
// - 100-300 킬마다 랜덤 스폰
// - 플레이어 평균 데미지의 10-30배 HP
// - 1.4배 크기, 글로우 효과
// - 사망 시 1-10개 업그레이드 아이템 드랍
// ============================================

// 엘리트 몬스터 티어별 설정
export interface EliteTierConfig {
  tier: EliteTier;
  hpMultiplier: number;       // HP 배율 (플레이어 데미지 대비)
  sizeScale: number;          // 크기 배율
  dropCountRange: [number, number]; // 드랍 아이템 수 범위
  glowColor: string;          // 글로우 색상
  glowIntensity: number;      // 글로우 강도 (0-1)
  speedMultiplier: number;    // 속도 배율 (엘리트는 약간 느림)
  damageMultiplier: number;   // 데미지 배율
}

export const ELITE_TIER_CONFIGS: Record<EliteTier, EliteTierConfig> = {
  silver: {
    tier: 'silver',
    hpMultiplier: 10,           // 10타 필요
    sizeScale: 1.3,             // 1.3배 크기
    dropCountRange: [5, 8],     // 5-8개 드랍 (기존 1-3 → 도파민 업!)
    glowColor: '#c0c0c0',       // 은색
    glowIntensity: 0.6,
    speedMultiplier: 0.9,       // 10% 느림
    damageMultiplier: 1.5,      // 1.5배 데미지
  },
  gold: {
    tier: 'gold',
    hpMultiplier: 20,           // 20타 필요
    sizeScale: 1.4,             // 1.4배 크기
    dropCountRange: [8, 14],    // 8-14개 드랍 (기존 3-6 → 도파민 업!)
    glowColor: '#ffd700',       // 금색
    glowIntensity: 0.8,
    speedMultiplier: 0.85,      // 15% 느림
    damageMultiplier: 2.0,      // 2배 데미지
  },
  diamond: {
    tier: 'diamond',
    hpMultiplier: 30,           // 30타 필요
    sizeScale: 1.5,             // 1.5배 크기
    dropCountRange: [14, 20],   // 14-20개 드랍 (기존 6-10 → 도파민 폭발!)
    glowColor: '#00ffff',       // 다이아몬드 (시안)
    glowIntensity: 1.0,
    speedMultiplier: 0.8,       // 20% 느림
    damageMultiplier: 2.5,      // 2.5배 데미지
  },
};

// 엘리트 스폰 설정
export const ELITE_SPAWN_CONFIG = {
  // 킬 카운트 기반 스폰 (100-300 킬마다)
  killCountRange: [100, 300] as [number, number],

  // 티어 등장 확률 (합계 100)
  tierWeights: {
    silver: 60,   // 60%
    gold: 30,     // 30%
    diamond: 10,  // 10%
  },

  // 최소 게임 시간 (초) - 너무 초반에 스폰 방지
  minGameTime: 30,

  // 동시 존재 가능 엘리트 수
  maxConcurrentElites: 3,

  // 엘리트로 변환 가능한 적 타입 (보스 제외)
  eligibleEnemyTypes: [
    // 기본
    'glitch', 'bot', 'malware', 'whale',
    // 원거리
    'sniper', 'caster', 'artillery',
    // 싱귤래리티
    'worm', 'spammer', 'crypter', 'mutant', 'trojan', 'ransomer',
    'rootkit', 'apt', 'zeroday', 'skynet',
  ] as EnemyType[],
};

// 엘리트 드랍 아이템 설정 (v7.23: 도파민 터지게 개선!)
export const ELITE_DROP_CONFIG = {
  // 아이템 스폰 딜레이 (캐스케이드 효과용)
  spawnDelayMs: 40,           // 40ms - 빠른 연속 스폰으로 폭발 느낌

  // 아이템 초기 속도 (부채꼴 분산) - 더 높이, 더 멀리!
  initialVelocity: {
    horizontal: 200,          // 수평 속도 (기존 150 → 더 퍼짐)
    vertical: 320,            // 상향 속도 (기존 200 → 더 높이 솟구침!)
  },

  // 물리 설정 (바운스) - 더 통통 튀게!
  physics: {
    gravity: 650,             // 중력 (기존 800 → 체공시간 증가)
    bounceDecay: 0.5,         // 바운스 감쇠 (기존 0.6 → 바운스 유지)
    friction: 0.95,           // 마찰력
    bounceCount: 3,           // 바운스 횟수 (기존 2 → 더 통통!)
  },

  // 아이템 수집 가능 시간 (바운스 완료 후)
  collectableAfterMs: 400,    // 기존 500 → 조금 더 빨리 수집 가능

  // 자동 끌림 설정 (오브젝트 위에 떨어져도 수집 가능)
  autoMagnet: {
    range: 120,               // 120px 범위 내 자동 끌림
    speed: 350,               // 끌림 속도 (px/s)
  },

  // 드랍 아이템 타입별 가중치
  dropWeights: {
    upgrade_material: 100,    // 100% (엘리트는 무조건 업그레이드 재료)
  },
};

// 엘리트 티어 선택 함수
export const selectEliteTier = (): EliteTier => {
  const { tierWeights } = ELITE_SPAWN_CONFIG;
  const total = tierWeights.silver + tierWeights.gold + tierWeights.diamond;
  const roll = Math.random() * total;

  if (roll < tierWeights.silver) return 'silver';
  if (roll < tierWeights.silver + tierWeights.gold) return 'gold';
  return 'diamond';
};

// 엘리트 HP 계산 함수
// 플레이어의 평균 무기 데미지 × 티어 배율
export const calculateEliteHP = (
  averagePlayerDamage: number,
  tier: EliteTier
): number => {
  const config = ELITE_TIER_CONFIGS[tier];
  return Math.ceil(averagePlayerDamage * config.hpMultiplier);
};

// 엘리트 드랍 수 계산 함수
export const calculateEliteDropCount = (tier: EliteTier): number => {
  const config = ELITE_TIER_CONFIGS[tier];
  const [min, max] = config.dropCountRange;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
