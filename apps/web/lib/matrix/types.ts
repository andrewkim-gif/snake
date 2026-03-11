/**
 * types.ts - Matrix 게임 엔진 핵심 타입 정의
 *
 * app_ingame/types.ts 기반으로 실제 사용 패턴 분석하여 재구성.
 * 67개 타입 중 Tier 1 (22개 핵심 타입) 포함.
 */

// ============================================
// 1. Vector2 - 2D 벡터 (위치, 속도, 방향 등)
// ============================================

/** 2D 벡터 - 위치/속도/방향에 사용 */
export interface Vector2 {
  x: number;
  y: number;
}

// ============================================
// 2. WeaponType - 무기 타입 문자열 유니온
// ============================================

/** 무기 타입 (20+ 종류) */
export type WeaponType =
  // 근접/오라 무기
  | 'whip'        // 핸드 코딩 (야구배트 스윙)
  | 'punch'       // 키보드 펀치
  | 'sword'       // 소드
  | 'bible'       // 도큐멘테이션 (궤도 회전)
  | 'garlic'      // 디버그 오라
  | 'pool'        // 파이어월 존
  // 원거리 투사체
  | 'wand'        // API 호출
  | 'knife'       // Git Push (폭발 코인)
  | 'axe'         // 서버 던지기
  | 'bow'         // GraphQL 쿼리 (관통 화살)
  | 'ping'        // Ping 패킷 (체인 공격)
  | 'shard'       // 분열 투사체
  | 'fork'        // 갈래창
  | 'airdrop'     // 에어드랍 폭격
  // 특수 스킬
  | 'lightning'   // Claude Assist (체인 라이트닝)
  | 'beam'        // 스택 트레이스 (레이저 빔)
  | 'laser'       // 리커시브 루프 (회전 레이저)
  | 'bridge'      // 브릿지 (동결 특화)
  | 'phishing'    // 피싱 (화면 전체 공격)
  | 'stablecoin'  // 타입 세이프티 (쉴드)
  | 'aggregator'  // 아그리게이터 (마그넷 범위)
  | 'oracle'      // 오라클 (운 보너스)
  | 'genesis'     // 제네시스 (대폭발)
  | 'gold_reward' // 골드 리워드
  | 'crossbow'    // 크로스보우
  // CODE 카테고리 (Tier 2-4)
  | 'syntax_error'    // 구문 오류
  | 'compiler'        // 컴파일러
  | 'debugger_skill'  // 디버거
  | 'refactor'        // 리팩터링
  | 'regex'           // 정규표현식
  | 'hotfix'          // 핫픽스 (CODE Ultimate)
  // DATA 카테고리 (Tier 2-4)
  | 'json_bomb'       // JSON 폭탄
  | 'csv_spray'       // CSV 스프레이
  | 'binary'          // 바이너리
  | 'big_data'        // 빅데이터 (DATA Ultimate)
  // NETWORK 카테고리 (Tier 2-4)
  | 'websocket'       // 웹소켓
  | 'tcp_flood'       // TCP 플러드
  | 'dns_spoof'       // DNS 스푸핑
  | 'vpn_tunnel'      // VPN 터널 (NETWORK Ultimate)
  | 'ddos'            // DDoS 공격
  // SECURITY 카테고리 (Tier 2-4)
  | 'antivirus'       // 안티바이러스
  | 'sandbox'         // 샌드박스
  | 'zero_trust'      // 제로 트러스트
  | 'encryption'      // 암호화
  | 'honeypot'        // 허니팟 (SECURITY Ultimate)
  | 'firewall_surge'  // 방화벽 서지
  | 'backup'          // 백업
  | 'incident_response' // 인시던트 대응
  | 'sql_injection'   // SQL 인젝션
  // SYSTEM 카테고리 (Tier 2-4)
  | 'ram_upgrade'     // RAM 업그레이드
  | 'cpu_boost'       // CPU 부스트
  | 'cache'           // 캐시
  | 'multithreading'  // 멀티스레딩 (SYSTEM Ultimate)
  | 'garbage_collection' // 가비지 컬렉션
  // AI/시너지 스킬
  | 'neural_net'      // 뉴럴넷
  | 'chatgpt'         // ChatGPT
  | 'deepfake'        // 딥페이크
  | 'singularity_core' // 싱귤래리티 코어
  | 'autopilot'       // 오토파일럿
  | 'agi'             // AGI
  | 'packet_loss'     // 패킷 로스
  // 패시브 스킬
  | 'focus'       // 딥워크 (크리티컬 확률)
  | 'mempool'     // v29: 멤풀 (원본 GameCanvas 호환)
  | 'overclock';  // 오버클럭 (이동속도)

// ============================================
// 3. WeaponStats - 무기 레벨별 스탯
// ============================================

/** 무기 스탯 (레벨별 정의) */
export interface WeaponStats {
  level: number;        // 현재 레벨
  damage: number;       // 데미지
  area: number;         // 범위/크기 (radius로 사용)
  speed: number;        // 투사체 속도
  duration: number;     // 지속 시간 (초)
  cooldown: number;     // 쿨다운 (초)
  amount: number;       // 발사체 수 / 패시브 수치
  pierce: number;       // 관통 횟수
  knockback: number;    // 넉백 강도
  isEvolved?: boolean;  // 진화 여부 (Lv 11+)
  isUltimate?: boolean; // 궁극 여부 (Lv 20)
  evolvedName?: string; // 진화 이름
}

// ============================================
// 4. EnemyType - 적 타입 문자열 유니온
// ============================================

/** 적 타입 (150+ 종류, 스테이지별 + 싱귤래리티) */
export type EnemyType =
  // Legacy AI 봇
  | 'glitch' | 'bot' | 'malware' | 'whale'
  // 원거리 AI
  | 'sniper' | 'caster' | 'artillery'
  // Chapter 1: Office & Escape (Stages 1-10)
  | 'stapler' | 'coffee_cup' | 'sticky_note' | 'mouse_cable' | 'keyboard_key'
  | 'vending_bot' | 'donut' | 'soda_can' | 'chip_bag' | 'microwave'
  | 'projector' | 'whiteboard' | 'presentation' | 'chair_spin' | 'clock_watcher'
  | 'keycard' | 'camera_eye' | 'firewall_cube' | 'access_denied' | 'fingerprint'
  | 'data_packet' | 'bit_stream' | 'memory_leak' | 'cache_miss' | 'thread_tangle'
  | 'headlight' | 'tire_roller' | 'parking_cone' | 'oil_slick' | 'exhaust_ghost'
  | 'stair_step' | 'handrail_snake' | 'exit_sign' | 'fire_ext' | 'echo_shade'
  | 'antenna_zap' | 'wind_spirit' | 'satellite_eye' | 'vent_puff' | 'pigeon_bot'
  | 'traffic_light' | 'manhole' | 'billboard' | 'drone_cam' | 'streetlamp'
  | 'static_tv' | 'radio_wave' | 'fridge_hum' | 'dusty_fan' | 'shadow_corner'
  // Chapter 2: Underground & Battleground (Stages 11-20)
  | 'script_kiddie' | 'proxy_mask' | 'vpn_tunnel' | 'tor_onion' | 'backdoor'
  | 'cipher_block' | 'hash_collision' | 'salt_shaker' | 'key_fragment' | 'padding_oracle'
  | 'silk_crawler' | 'bitcoin_thief' | 'phish_hook' | 'scam_popup' | 'identity_ghost'
  | 'assembly_arm' | 'conveyor_bot' | 'qc_scanner' | 'defect_unit' | 'forge_spark'
  | 'core_drone' | 'power_cell' | 'cooling_fan' | 'circuit_bug' | 'steam_vent'
  | 'rubble_golem' | 'rust_crawler' | 'rebar_spike' | 'dust_cloud' | 'broken_screen'
  | 'infected_guard' | 'glitched_medic' | 'hacked_turret' | 'traitor_drone' | 'supply_mimic'
  | 'target_dummy' | 'obstacle_wall' | 'drill_sergeant' | 'tripwire' | 'sandbag_tumble'
  | 'logic_gate' | 'register_file' | 'bus_controller' | 'alu_core' | 'cache_line'
  | 'firewall_guard' | 'quarantine_cell' | 'corrupted_file' | 'delete_marker' | 'backup_ghost'
  // Chapter 3: Digital World & Singularity (Stages 21-30)
  | 'syntax_fish' | 'bracket_crab' | 'comment_jellyfish' | 'variable_eel' | 'function_whale'
  | 'heap_pile' | 'stack_tower' | 'pointer_arrow' | 'garbage_collector' | 'memory_fragment'
  | 'clock_cycle' | 'instruction_fetch' | 'branch_predictor' | 'pipeline_stall' | 'thermal_spike'
  | 'neuron_node' | 'synapse_spark' | 'weight_adjuster' | 'bias_blob' | 'activation_wave'
  | 'training_data' | 'loss_function' | 'gradient_flow' | 'overfitting' | 'epoch_counter'
  | 'instance_spawn' | 'load_balancer' | 'container_box' | 'serverless_ghost' | 'auto_scaler'
  | 'qubit_spin' | 'superposition' | 'entangle_pair' | 'quantum_gate' | 'decoherence'
  | 'event_horizon' | 'time_dilation' | 'gravity_well' | 'hawking_particle' | 'gate_keeper'
  | 'omniscient_eye' | 'divine_code' | 'angel_process' | 'fallen_daemon' | 'prayer_packet'
  | 'destiny_shard' | 'timeline_split' | 'choice_echo' | 'paradox_loop' | 'final_bit'
  // 싱귤래리티 모드 전용
  | 'bitling' | 'pixel' | 'bug'
  | 'worm' | 'spammer'
  | 'crypter' | 'ransomer'
  | 'mutant' | 'polymorphic'
  | 'trojan' | 'botnet'
  | 'rootkit' | 'apt'
  | 'zeroday' | 'skynet'
  | 'adware'
  // 확장용 catch-all
  | (string & {});

// ============================================
// 5. PlayerClass - 캐릭터 클래스 유니온
// ============================================

/** 플레이어 캐릭터 클래스 (9종) */
export type PlayerClass =
  | 'neo'       // NEO - 각성한 풀스택 개발자
  | 'tank'      // TANK - 데브옵스 엔지니어
  | 'cypher'    // CYPHER - D-SEEK 창조자
  | 'morpheus'  // MORPHEUS - 시니어 아키텍트
  | 'niobe'     // NIOBE - AI 안전 전문가
  | 'oracle'    // ORACLE - 데이터 사이언티스트
  | 'trinity'   // TRINITY - 보안 해커
  | 'mouse'     // MOUSE - 오픈소스 전도사
  | 'dozer';    // DOZER - QA 엔지니어

// ============================================
// 6. PickupType - 픽업 아이템 타입
// ============================================

/** 픽업 아이템 타입 */
export type PickupType =
  | 'chicken'            // 체력 회복
  | 'chest'              // 보물 상자
  | 'bomb'               // 폭탄 (화면 전체)
  | 'magnet'             // 자석 (젬 흡수)
  | 'upgrade_material';  // 업그레이드 재료 (엘리트 드랍)

// ============================================
// 7. BossSkillType - 보스 스킬 타입
// ============================================

/** 보스 스킬 타입 */
export type BossSkillType =
  | 'none'
  | 'charge'         // 돌진
  | 'spawn_minions'  // 부하 소환
  | 'bullet_hell'    // 탄막
  | 'laser_sweep'    // 레이저 스윕
  | 'teleport'       // 순간이동
  | 'shield'         // 보호막
  | 'enrage'         // 광폭화
  | 'ranged'         // 원거리 공격
  | 'shoot'          // v29: 발사 (singularity boss)
  | 'nova'           // v29: 노바 (singularity boss)
  | 'laser'          // v29: 레이저 (singularity boss)
  | 'spiral';        // v29: 나선 (singularity boss)

// ============================================
// 8. BossTier - 보스 등급
// ============================================

/** 보스 등급 */
export type BossTier = 'mini' | 'stage' | 'chapter' | 'final' | 'elite' | 'legendary';

// ============================================
// 9. EliteTier - 엘리트 몬스터 등급
// ============================================

/** 엘리트 몬스터 등급 */
export type EliteTier = 'silver' | 'gold' | 'diamond';

// ============================================
// 10. WaveNumber - 웨이브 번호 타입
// ============================================

/** 웨이브 번호 (1부터 시작) */
export type WaveNumber = number;

// ============================================
// 11. Player - 플레이어 엔티티
// ============================================

/** 히트 리액션 상태 */
export interface HitReaction {
  active: boolean;
  timer: number;
  direction: Vector2;
  intensity: number;
}

/** 개별 무기 인스턴스 (player.weapons[weaponType]) */
export interface WeaponInstance {
  level: number;
  damage: number;
  area: number;
  speed: number;
  duration: number;
  cooldown: number;
  amount: number;
  pierce: number;
  knockback: number;
  isEvolved?: boolean;
  isUltimate?: boolean;
  evolvedName?: string;
  /** 무기별 쿨다운 타이머 */
  timer?: number;
}

/** 플레이어 엔티티 */
export interface Player {
  // 식별
  id: string;

  // 기본 속성
  position: Vector2;
  velocity: Vector2;
  radius: number;
  speed: number;                    // 이동 속도
  health: number;                   // 현재 HP
  maxHealth: number;                // 최대 HP
  level: number;                    // 현재 레벨
  xp: number;                       // 현재 경험치
  nextXp?: number;                  // 다음 레벨 필요 경험치 (alias: nextLevelXp)
  nextLevelXp: number;              // 다음 레벨 필요 경험치 (원본 필드명)
  score: number;                    // 점수
  angle: number;                    // 플레이어 각도
  color: string;                    // 플레이어 색상

  // 전투 속성
  shield: number;                   // 현재 쉴드 수
  maxShield: number;                // 최대 쉴드 수
  criticalChance: number;           // 크리티컬 확률 (기본 0.05 = 5%)
  criticalMultiplier: number;       // 크리티컬 데미지 배율
  invulnerabilityTimer: number;     // 무적 타이머 (초)

  // 무기 시스템 (보유 중인 무기 목록)
  weapons: Partial<Record<WeaponType, WeaponInstance>>;
  weaponCooldowns: Partial<Record<WeaponType, number>>;

  // 스킬 시스템
  specialCooldown: number;          // 특수 스킬 쿨다운
  maxSpecialCooldown: number;       // 최대 특수 스킬 쿨다운
  specialAnim?: number;             // 특수 스킬 애니메이션 진행도 (0-1)

  // 캐릭터 정보
  selectedClass?: PlayerClass;      // 선택된 캐릭터
  playerClass?: PlayerClass;        // 캐릭터 클래스 (selectedClass alias)

  // 충돌 박스 (아이소메트릭 충돌용)
  collisionBox?: {
    width: number;
    height: number;
    offsetX?: number;
    offsetY: number;
  };

  // 피격 리액션 (시각 피드백)
  hitReaction?: HitReaction;

  // 공격 애니메이션 (렌더링용)
  attackAnim?: {
    active: boolean;
    timer: number;
    duration: number;
    weaponType?: string;
  };

  // 레벨업 애니메이션 (Phase 3)
  levelUpAnim?: number;             // 레벨업 애니메이션 진행도 (0-1)

  // 넉백/피격 (combat, movement, projectile에서 사용)
  knockback: Vector2;               // 현재 넉백 벡터
  hitFlashTimer: number;            // 피격 플래시 타이머

  // 스탯 배율
  statMultipliers: { speed: number; cooldown: number; damage: number; health: number };
  stance?: string;                  // 전투 스탠스
}

// ============================================
// 12. Enemy - 적 엔티티
// ============================================

/** 적 상태 */
export type EnemyState = 'chasing' | 'stunned' | 'dying' | 'dashing';

/** 적 엔티티 */
export interface Enemy {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  enemyType: EnemyType;
  state: EnemyState;                     // 적 상태 ('chasing' | 'stunned' | 'dying')
  stunTimer: number;                     // 스턴/사망 애니메이션 타이머
  mass: number;                          // 질량 (넉백 계산용)
  hitBy: Set<string>;                    // 이미 맞은 투사체 ID 세트
  isBoss: boolean;                       // 보스 여부
  isFrozen: boolean;                     // 동결 상태

  // 보스 전용 필드
  name?: string;                         // 보스 이름
  skillCooldown: number;                 // 스킬 쿨다운 타이머
  maxSkillCooldown: number;              // 최대 스킬 쿨다운
  skillType: BossSkillType;              // 현재 스킬 타입
  skillDuration: number;                 // 스킬 지속 시간
  skillWarning: boolean;                 // 스킬 경고 표시 여부
  bossTier?: BossTier;                   // 보스 등급
  bossSkills?: BossSkillType[];          // 보스 스킬 목록
  currentSkillIndex: number;             // 현재 사용할 스킬 인덱스

  // 원거리 적 전용 필드
  attackType: 'melee' | 'ranged';        // 공격 타입
  attackRange?: number;                  // 원거리 공격 사거리
  attackCooldown?: number;               // 원거리 공격 쿨다운
  projectileColor?: string;              // 투사체 색상
  projectileSpeed?: number;              // 투사체 속도
  currentAttackCooldown?: number;        // 현재 공격 쿨다운 타이머 (남은 시간)
  lastAttackTime?: number;               // 마지막 공격 시간

  // 상태이상 시스템
  statusEffects?: StatusEffect[];        // 적용 중인 상태이상 목록

  // 엘리트 몬스터 필드 (v7.15)
  isElite?: boolean;                     // 엘리트 여부
  eliteTier?: EliteTier;                 // 엘리트 등급
  dropCount?: number;                    // 드랍 아이템 수

  // 사망 애니메이션 (combat에서 사용)
  deathTimer?: number;                   // 사망 애니메이션 타이머
  deathScale?: number;                   // 사망 애니메이션 스케일
  deathVelocity?: Vector2;              // 사망 시 넉백 벡터

  // 호환성 alias
  hp?: number;                           // health alias (일부 시스템에서 사용)
  type?: string;                         // enemyType alias (v29 GameCanvas 호환)

  // 엘리트 비주얼 (elite-monster.ts에서 사용)
  eliteGlow?: number;
  eliteDropCount?: number;
}

// ============================================
// 13. Projectile - 플레이어 투사체
// ============================================

/** 투사체 (무기 발사체) */
export interface Projectile {
  id: string;
  type: WeaponType;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  life: number;            // 남은 수명 (초)
  damage: number;
  pierce: number;          // 남은 관통 횟수
  knockback: number;

  // 방향/회전
  angle?: number;          // 발사 각도 (rad)
  isEvolved?: boolean;     // 진화 상태
  isUltimate?: boolean;    // 궁극 상태
  startLife?: number;      // 초기 수명 (애니메이션 진행도 계산용)

  // 바운스/체인 시스템 (wand)
  bounceCount?: number;    // 현재 바운스 횟수

  // 회전 (knife 코인)
  rotationSpeed?: number;  // 회전 속도 (rad/s)
  currentRotation?: number;// 현재 회전 각도

  // 폭발 (knife)
  explosionDamage?: number;
  explosionRadius?: number;

  // 궤도 (bible)
  orbitAngle?: number;     // 궤도 각도
  startPos?: Vector2;      // 궤도 반지름/초기 위치

  // 레이저 스윕 (laser)
  sweepAngle?: number;     // 스윕 총 각도
  sweepDirection?: number; // 스윕 방향 (1 or -1)
  sweepStartAngle?: number;// 스윕 시작 각도

  // 호밍 (beam)
  homingStrength?: number; // 호밍 강도
  targetId?: string;       // 추적 대상 적 ID

  // 중력/물리 (airdrop)
  gravity?: number;        // Y축 중력
  z?: number;              // Z축 높이 (3D 투사체)
  velocityZ?: number;      // Z축 속도
  gravityZ?: number;       // Z축 중력
  zBounceCount?: number;   // Z축 바운스 남은 횟수
  zBounceDamping?: number; // Z축 바운스 감쇠

  // Arena PvP 소유자
  ownerId?: string;        // 투사체 발사자 ID ('player' | agent ID)
  turretId?: string;       // 터렛에서 발사된 경우 터렛 ID

  // 히트 추적
  hitEnemies?: Set<string>;// 이미 맞은 적 ID (중복 방지)
  chainCount?: number;     // 체인 횟수
  maxChain?: number;       // 최대 체인 횟수
  chainHitIds?: string[];  // 체인 히트 적 ID 배열

  // 동결 (bridge)
  freezeDuration?: number;       // 동결 지속 시간
  freezeSpreadRadius?: number;   // 동결 확산 범위

  // 분열 (shard)
  splitDamage?: number;          // 분열 시 데미지

  // 폭격 (airdrop)
  onlyHitOnGround?: boolean;     // 착지 시에만 히트 판정

  // 체인 라이트닝 (lightning)
  isChainLightning?: boolean;    // 체인 라이트닝 여부

  // 히트 카운트 (beam 등)
  hitCount?: number;             // 누적 히트 수

  // 도형 투사체 (axe 등)
  shape?: string;                // 투사체 형태 ('rect' 등)
  width?: number;                // 투사체 너비 (shape='rect' 시 사용)
  height?: number;               // 투사체 높이 (shape='rect' 시 사용)

  // 기본 속도 (wand 체인용)
  baseSpeed?: number;            // 원본 투사체 속도

  // 체인 라이트닝 추가 필드
  chainDamageMultiplier?: number; // 체인 데미지 배율
  isSingleBolt?: boolean;        // 단일 번개줄기 렌더링 힌트

  // 독 데미지 (터렛 시스템)
  poisonDamage?: number;
  poisonDuration?: number;
}

// ============================================
// 14. EnemyProjectile - 적 투사체
// ============================================

/** 적 투사체 */
export interface EnemyProjectile {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  damage: number;
  life: number;
  skillType?: BossSkillType | 'ranged'; // 보스 스킬 투사체 또는 원거리 적 투사체
}

// ============================================
// 15. Gem - 경험치 젬
// ============================================

/** 경험치 젬 */
export interface Gem {
  id: string;
  position: Vector2;
  value: number;           // 경험치량
  color: string;           // 색상 (가치에 따라 파랑/보라)
  isCollected: boolean;    // 수집 여부
}

// ============================================
// 16. Pickup - 아이템 픽업
// ============================================

/** 픽업 아이템 */
export interface Pickup {
  id: string;
  type: PickupType;
  position: Vector2;
  radius: number;
  life: number;            // 남은 수명 (초)
}

// ============================================
// 17. Blast - 폭발 이펙트
// ============================================

/** 폭발 이펙트 (phishing, genesis 등) */
export interface Blast {
  id: string;
  position: Vector2;
  radius: number;
  life: number;            // 남은 수명 (초)
  maxLife: number;         // 초기 수명
  color: string;
  type?: string;           // 폭발 종류 ('purge' 등)
}

// ============================================
// 18. LightningBolt - 번개 효과
// ============================================

/** 번개 볼트 (체인 라이트닝 시각 효과) */
export interface LightningBolt {
  id: string;
  segments: Vector2[];     // 번개 경로 (꺾임점 배열)
  color: string;           // 체인 색상 (점점 변화)
  life: number;            // 남은 표시 시간
  maxLife: number;         // 초기 표시 시간
  width: number;           // 번개 두께 (체인이 길어질수록 얇아짐)
  delay: number;           // 표시 딜레이 (순차적 체이닝 연출)
}

// ============================================
// 19. DamageNumber - 데미지 텍스트
// ============================================

/** 떠오르는 데미지 숫자 */
export interface DamageNumber {
  id: string;
  position: Vector2;
  value: number;           // 데미지/힐 수치
  color: string;           // 색상 (흰색=데미지, 녹색=힐, 주황=화상 등)
  life: number;            // 남은 표시 시간
  maxLife?: number;        // 초기 표시 시간
  velocity?: Vector2;      // 이동 속도 (위로 떠오름)
  isCritical?: boolean;    // v29: 크리티컬 데미지 표시
}

// ============================================
// 20. StatusEffect - 상태이상 효과
// ============================================

/** 상태이상 타입 */
export type StatusEffectType = 'poison' | 'burning' | 'freeze' | 'slow';

/** 상태이상 효과 */
export interface StatusEffect {
  type: StatusEffectType;
  duration: number;        // 남은 지속 시간 (초)
  damage?: number;         // 틱 데미지 (poison/burning)
  tickInterval?: number;   // 틱 간격 (초, 기본 0.5)
  tickTimer?: number;      // 현재 틱 타이머
  sourceId?: string;       // 효과 출처 ID (중복 방지)
  slowAmount?: number;     // 감속량 (slow)
  sourceWeapon?: string;   // 효과 출처 무기 타입
}

// ============================================
// 21. CriticalEffect - 크리티컬 히트 효과
// ============================================

/** 크리티컬 히트 시각 효과 (마블 카툰 스타일 팝업) */
export interface CriticalEffect {
  id: string;
  position: Vector2;
  text: string;            // 표시 텍스트 ('펑!', '쾅!' 등)
  color: string;           // 무기별 색상
  life: number;            // 남은 표시 시간
  maxLife: number;         // 초기 표시 시간
  scale: number;           // 현재 스케일 (0에서 팝업)
  rotation: number;        // 회전 각도 (deg)
}

// ============================================
// 22. CollisionBox - AABB 충돌 박스
// ============================================

/**
 * AABB (Axis-Aligned Bounding Box) 충돌 박스
 * 모든 값은 월드 좌표 기준
 */
export interface CollisionBox {
  /** 박스 왼쪽 경계 (월드 X) */
  left: number;
  /** 박스 오른쪽 경계 (월드 X) */
  right: number;
  /** 박스 상단 경계 (월드 Y) - 발에서 위로 확장된 위치 */
  top: number;
  /** 박스 하단 경계 (월드 Y) - 발 위치 */
  bottom: number;
  /** 박스 중심 X (월드 좌표) */
  centerX: number;
  /** 박스 중심 Y (월드 좌표) */
  centerY: number;
  /** 박스 너비 */
  width: number;
  /** 박스 높이 */
  height: number;
  /** 렌더링 오프셋 X */
  offsetX?: number;
  /** 렌더링 오프셋 Y */
  offsetY?: number;
}

// ============================================
// 23. Obstacle - 맵 장애물
// ============================================

/** 맵 장애물 정의 */
export interface ObstacleDef {
  width: number;
  height: number;
  collisionWidth?: number;
  collisionHeight?: number;
  hasCollision?: boolean;
}

/** 맵 장애물 인스턴스 */
export interface Obstacle {
  x: number;               // 발 위치 X (월드 좌표)
  y: number;               // 발 위치 Y (월드 좌표)
  def: ObstacleDef;        // 장애물 정의
  tileX?: number;          // 타일맵 X 좌표
  tileY?: number;          // 타일맵 Y 좌표
}

// ============================================
// 추가 타입 (시스템 파일에서 참조됨)
// ============================================

/** 플레이어/적 충돌 박스 (발 위치 기준) */
export interface EntityCollisionBox {
  width: number;
  height: number;
  offsetX?: number;
  offsetY: number;
}

/** 충돌 결과 */
export interface CollisionResult {
  collided: boolean;
  object?: unknown;
  pushX?: number;
  pushY?: number;
}

/** 원형 충돌체 */
export interface CircleCollider {
  x: number;
  y: number;
  radius: number;
}

// ============================================
// Phase 2 Types - Arena, Config, Skill System
// ============================================

// ============================================
// 24. ArenaPhase - 아레나 게임 상태
// ============================================

/** Arena game phase */
export type ArenaPhase = 'waiting' | 'countdown' | 'playing' | 'ending' | 'result';

/** Arena safe zone phase number (legacy compat) */
export type SafeZonePhaseNumber = 1 | 2 | 3 | 4;

// ============================================
// 25. SafeZone - 안전 구역 상태
// ============================================

/** Arena safe zone state */
export interface SafeZone {
  /** 안전 구역 중심 좌표 */
  center: Vector2;
  /** 현재 안전 구역 반경 */
  currentRadius: number;
  /** 목표 안전 구역 반경 */
  targetRadius: number;
  /** 축소 속도 */
  shrinkSpeed: number;
  /** 구역 밖 초당 피해량 */
  damagePerSecond: number;
  /** 현재 페이즈 번호 */
  phase: number;
  /** 다음 축소까지 남은 시간 */
  nextShrinkTime: number;
  /** 경고 표시 여부 */
  isWarning: boolean;
  /** 축소 중 여부 */
  isShrinking: boolean;
}

// ============================================
// 26. RouletteReward - 룰렛 보상 정의
// ============================================

/** 룰렛 보상 아이템 (config/index.ts에서도 정의됨, 양쪽 호환) */
export interface RouletteReward {
  id: string;
  type: string;
  label: string;
  value: number;
  icon: string;    // lucide-react icon name (stubbed as string)
  color: string;
}

// ============================================
// Turret System Types (rendering/turrets에서 사용)
// ============================================

/** 터렛 희귀도 */
export type TurretRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** 설치된 터렛 인스턴스 */
export interface PlacedTurret {
  id: string;
  configId: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  spawnAnimation: number;
  hitFlash: number;
  facingAngle?: number;
  targetFacingAngle?: number;
  lastFireTime?: number;
  level?: number;
}

/** 터렛 투사체 */
export interface TurretProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  abilityType?: string;
  isBeam?: boolean;
  beamWidth?: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
}

/** 터렛 AOE 효과 */
export interface TurretAoeEffect {
  id?: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  abilityType?: string;
  rotation?: number;
  damage?: number;
  slowPercent?: number;
  tickRate?: number;
  lastTickTime?: number;
  weaponType?: WeaponType;
  turretId?: string;
  knockback?: number;
}

/** 희귀도별 색상 설정 */
export const RARITY_COLORS: Record<string, { primary: string; border: string; glow: string }> = {
  common: { primary: '#9ca3af', border: '#6b7280', glow: '#9ca3af' },
  rare: { primary: '#3b82f6', border: '#2563eb', glow: '#60a5fa' },
  epic: { primary: '#a855f7', border: '#7c3aed', glow: '#c084fc' },
  legendary: { primary: '#f59e0b', border: '#d97706', glow: '#fbbf24' },
  mythic: { primary: '#ef4444', border: '#dc2626', glow: '#f87171' },
};

// ============================================
// Agent System Types (rendering/ui에서 사용)
// ============================================

/** Arena 에이전트 정보 */
export interface Agent {
  id: string;
  agentId: string;
  playerClass: PlayerClass;
  isLocalPlayer: boolean;
  aiPersonality: AIPersonality;

  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  health: number;
  maxHealth: number;
  speed: number;

  kills: number;
  deaths: number;
  score: number;

  isAlive: boolean;
  respawnTimer: number;
  respawnInvincibility: number;

  weapons: Record<string, WeaponStats>;
  weaponCooldowns: Record<string, number>;

  level: number;
  xp: number;
  nextLevelXp: number;

  statMultipliers: {
    speed: number;
    cooldown: number;
    damage: number;
    health: number;
  };

  state: 'idle' | 'moving' | 'attacking' | 'dying' | 'dead';

  // optional display
  lastDamagedBy?: string;
  targetAgentId?: string;
  displayName?: string;
  selectedClass?: PlayerClass;
}

// ============================================
// Combo System Types (rendering/ui에서 사용)
// ============================================

/** 콤보 티어 */
export type ComboTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'platinum' | 'master' | 'grandmaster' | 'legend' | 'mythic' | 'transcendent';

/** 콤보 티어 설정 */
export interface ComboTierConfig {
  threshold: number;
  name: string;
  effect: { type: string; value: number; isActive: boolean };
  sound: string;
  color: string;
}

/** 콤보 상태 */
export interface ComboState {
  count: number;
  maxCount: number;
  timer: number;
  maxTimer: number;
  tier: ComboTier;
  multipliers: {
    xp: number;
    speed: number;
    damage: number;
  };
  effects: ComboEffect[];
  lastKillTime: number;
  tierUpAnimation: number;
}

/** 번역 키 타입 (i18n stub) */
export type TranslationKeys = Record<string, any>;

/** 파티클 (ExtendedParticle alias - combat.ts 호환) */
export interface Particle {
  // combat.ts 스타일 필드 (Vector2 기반)
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  type?: string;
  // 선택적 추가 필드
  text?: string;
  rotation?: number;
  rotSpeed?: number;
  width?: number;
  alpha?: number;
  fontSize?: number;
  fontColor?: string;
  size?: number;
  // 레거시 flat 필드 호환
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  [key: string]: any;
}

// ============================================
// TurretConfig - 터렛 설정 (turrets.config.ts에서 사용)
// ============================================

/** 터렛 희귀도별 가격 */
export const RARITY_PRICES: Record<TurretRarity, number> = {
  common: 500,
  rare: 1200,
  epic: 3000,
  legendary: 8000,
  mythic: 20000,
};

/** 터렛 희귀도별 최대 레벨 */
export const RARITY_MAX_LEVELS: Record<TurretRarity, number> = {
  common: 5,
  rare: 8,
  epic: 12,
  legendary: 15,
  mythic: 20,
};

/** 터렛 설정 인터페이스 */
export interface TurretConfig {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  type: 'agent' | 'skill';
  rarity: TurretRarity;
  weaponType: WeaponType;
  hp: number;
  range: number;
  baseDamage: number;
  damagePerLevel: number;
  cooldown: number;
  color: string;
  glowColor: string;
  price: number;
  upgradePrice: number;
  maxLevel: number;
  pierce?: number;
  projectileCount?: number;
  projectileSpeed?: number;
  aoe?: boolean;
  aoeRadius?: number;
  slowEffect?: number;
  chainCount?: number;
  burstCount?: number;
  knockback?: number;
}

// ============================================
// AgentConfig - 에이전트 설정 (agents.config.ts에서 사용)
// ============================================

/** 에이전트 희귀도 */
export type AgentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** 에이전트 설정 인터페이스 */
export interface AgentConfig {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  rarity: AgentRarity;
  weaponType: WeaponType;
  hp: number;
  range: number;
  baseDamage: number;
  damagePerLevel: number;
  cooldown: number;
  color: string;
  glowColor: string;
  price: number;
  upgradePrice: number;
  maxLevel: number;
  pierce?: number;
  projectileCount?: number;
  projectileSpeed?: number;
  aoe?: boolean;
  aoeRadius?: number;
  slowEffect?: number;
  chainCount?: number;
  burstCount?: number;
}

// ============================================
// AIPersonality - AI 성격 유형 (arena-agents.config.ts에서 사용)
// ============================================

/** AI 에이전트 성격 유형 */
export type AIPersonality = 'aggressive' | 'defensive' | 'balanced' | 'assassin' | 'support' | 'collector';

// ============================================
// BreakTimeState - 데이터 버스트 상태 (breaktime.config.ts에서 사용)
// ============================================

/** 데이터 버스트(쉬는 시간) 시스템 상태 */
export interface BreakTimeState {
  isActive: boolean;
  gauge: number;
  timer: number;
  nextBreakTime: number;
  warningTimer: number;
  isWarning: boolean;
  ultimateReady: boolean;
  totalBreaks: number;
  killsDuringBreak: number;
}

// ============================================
// SkillDefinition / SkillCategory - 스킬 시스템 타입
// ============================================

/** 스킬 카테고리 */
export type SkillCategory = 'CODE' | 'DATA' | 'NETWORK' | 'SECURITY' | 'AI' | 'SYSTEM';

/** 스킬 티어 */
export type SkillTier = 'basic' | 'advanced' | 'expert' | 'elite' | 'ultimate';

/** 스킬 정의 인터페이스 */
export interface SkillDefinition {
  id: WeaponType;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: SkillCategory;
  tier: SkillTier;
  icon: string;
  color: string;
  synergyTags: string[];
  recommendedWith: string[];
}

// ============================================
// Entity - 게임 엔티티 기본 인터페이스
// ============================================

/** 게임 엔티티 공통 인터페이스 */
export interface Entity {
  position: Vector2;
  velocity?: Vector2;
  radius: number;
  health?: number;
  maxHealth?: number;
}

// ============================================
// ChatTrigger - 채팅 트리거 타입 (arena-agents.config.ts에서 정의)
// ============================================

/** 채팅 트리거 타입 (arena-agents.config.ts에서 export됨) */
export type ChatTrigger =
  | 'spawn'
  | 'kill_agent'
  | 'kill_monster'
  | 'death'
  | 'low_health'
  | 'level_up'
  | 'taunt'
  | 'observation'
  | 'victory'
  | 'defeat';

// ============================================
// JoystickState - 조이스틱 상태 (useInput에서 사용)
// ============================================

/** 조이스틱 입력 상태 */
export interface JoystickState {
  active: boolean;
  origin: Vector2;
  current: Vector2;
  pointerId: number | null;
}

// ============================================
// Skin System Types (skins.config.ts에서 사용)
// ============================================

/** 스킨 희귀도 */
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** 스킨 정의 */
export interface Skin {
  id: string;
  characterId: string;
  name: string;
  description: string;
  rarity: SkinRarity;
  unlockMethod: 'default' | 'purchase' | 'achievement' | 'event';
  unlockCondition?: {
    achievementId?: string;
    price?: number;
    eventId?: string;
  };
  colors: {
    body: string;
    pants: string;
    hair: string;
    accent: string;
    shoes: string;
    outfit: string;
    accessoryType: string;
    pattern: string;
    patternColor?: string;
    glowEffect: string;
  };
  hasSpecialEffect: boolean;
  statBonus?: {
    atkBonus?: number;
    hpBonus?: number;
    spdBonus?: number;
    critBonus?: number;
    xpBonus?: number;
    expBonus?: number;
    defBonus?: number;
    goldBonus?: number;
    dodgeBonus?: number;
    atkSpeedBonus?: number;
  };
  bonusSkill?: {
    id: string;
    name: string;
    description: string;
    type: string;
    weaponType?: WeaponType;
    weaponLevel?: number;
    effectParams?: Record<string, number>;
  };
}

// ============================================
// AutoHuntState - helpers.ts에서 사용
// ============================================

/** 자동 사냥 상태 */
export interface AutoHuntState {
  targetEnemy: Enemy | null;
  targetPickup: any | null;
  moveDirection: Vector2;
  isEvading: boolean;
}

// ============================================
// GameState - 게임 상태 머신 (useGameState에서 사용)
// ============================================

/** 게임 페이즈 */
export type GamePhase = 'farming' | 'boss' | 'clear';

/** 게임 상태 */
export interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  isLevelUp: boolean;
  isCharacterSelect: boolean;
  gameTime: number;
  stage: number;
  phase: GamePhase;
  wave: WaveNumber;
}

// ============================================
// ComboEffect - 콤보 효과 (useCombo에서 사용)
// ============================================

/** 콤보 효과 타입 */
export type ComboEffectType = 'xp' | 'speed' | 'damage' | 'invincible' | 'screenClear';

/** 콤보 효과 */
export interface ComboEffect {
  type: ComboEffectType;
  value: number;
  duration?: number;
  isActive: boolean;
}

// ============================================
// Quiz System Types (useQuizChallenge에서 사용)
// ============================================

/** 퀴즈 챌린지 타입 */
export type QuizChallengeType = 'kill' | 'survive' | 'combo' | 'time_boss' | 'no_hit';

/** 퀴즈 난이도 */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

/** 퀴즈 보상 타입 */
export type QuizRewardType = 'levelUp' | 'heal' | 'weapon' | 'buff' | 'xp' | 'gold';

/** 퀴즈 보상 */
export interface QuizReward {
  type: QuizRewardType;
  value: number | string;
  label: string;
}

/** 퀴즈 챌린지 */
export interface QuizChallenge {
  id: string;
  type: QuizChallengeType;
  description: string;
  target: number;
  current: number;
  timeLimit: number;
  remaining: number;
  difficulty: QuizDifficulty;
  reward: QuizReward;
  status: 'active' | 'success' | 'failed' | 'expired';
}

/** 퀴즈 상태 */
export interface QuizState {
  activeChallenge: QuizChallenge | null;
  lastChallengeTime: number;
  nextChallengeIn: number;
  completedCount: number;
  failedCount: number;
  isPenaltyActive: boolean;
  penaltyTimer: number;
  history: QuizChallenge[];
}

// ============================================
// V3GameSystems - 통합 시스템 상태 (useV3Systems에서 사용)
// ============================================

/** V3 통합 게임 시스템 상태 */
export interface V3GameSystems {
  combo: ComboState;
  breakTime: BreakTimeState;
  quiz: QuizState;
}

// ============================================
// ArenaConfig / ArenaResult - 아레나 설정 및 결과 (useArena에서 사용)
// ============================================

/** 아레나 설정 */
export interface ArenaConfig {
  gameDuration: number;
  maxAgents: number;
  respawnDelay: number;
  respawnInvincibility: number;
  killScore: number;
  monsterDensity: number;
  monsterXpMultiplier: number;
  agentKillXp: number;
}

/** 아레나 결과 */
export interface ArenaResult {
  ranking: {
    agentId: string;
    playerClass: PlayerClass;
    kills: number;
    deaths: number;
    score: number;
    isLocalPlayer: boolean;
  }[];
  matchDuration: number;
  mvpAgentId: string;
  myRank: number;
  myKills: number;
  myDeaths: number;
  myScore: number;
}

// ============================================
// Skill Build Types (useSkillBuild에서 사용)
// ============================================

/** 시너지 요구 조건 타입 */
export type SynergyRequirementType = 'category_mastery' | 'fusion' | 'ultimate_fusion' | 'skill_combo';

/** 시너지 요구 조건 */
export interface SynergyRequirement {
  type: SynergyRequirementType;
  skills?: WeaponType[];
  categories?: SkillCategory[];
  minLevel: number;
  categoryCount?: number;
}

/** 시너지 효과 */
export interface SynergyEffect {
  type: string;
  value: number;
  description: string;
}

/** 시너지 정의 */
export interface SynergyDefinition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  requirements: SynergyRequirement;
  effects: SynergyEffect[];
  tier: 'basic' | 'advanced' | 'ultimate';
}

/** 스킬 빌드 프리셋 */
export interface SkillBuild {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  recommendedClass?: PlayerClass;
  priorityPath: WeaponType[];
  synergyGoals: string[];
}

/** 플레이어 스킬 진행도 */
export interface PlayerSkillProgress {
  unlockedSkills: WeaponType[];
  maxLevelReached: Record<WeaponType, number>;
  branchExperience: Record<WeaponType, { A: number; B: number }>;
  synergyAchievements: Record<string, number>;
  savedBuilds: SkillBuild[];
  lastUsedBuildId: string;
}

/** 플레이어 스킬 상태 */
export interface PlayerSkillState {
  skills: Map<WeaponType, number>;
  branchChoices: Map<WeaponType, 'A' | 'B'>;
  activeSynergies: SynergyDefinition[];
}

/** 레벨업 선택지 */
export interface LevelUpChoice {
  skill: WeaponType;
  isNew: boolean;
  currentLevel: number;
  nextLevel: number;
  needsBranchChoice: boolean;
  willActivateSynergy: string | null;
  priorityScore: number;
  source: 'priority' | 'category' | 'random';
}

/** 레벨업 선택지 설정 */
export interface LevelUpChoiceConfig {
  priorityWeight: number;
  categoryWeight: number;
  randomWeight: number;
  choiceCount: number;
  excludeSkills: WeaponType[];
  maxSkillLevel: number;
}

// ============================================
// v29: Missing types for GameCanvas full port
// ============================================

/** 게임 모드 */
export type GameMode = 'stage' | 'singularity' | 'tutorial';

/** 영구 업그레이드 */
export interface PersistentUpgrades {
  hpLevel: number;
  speedLevel: number;
  damageLevel: number;
  defenseLevel: number;
  xpBonusLevel: number;
  cooldownLevel: number;
  critLevel: number;
  pickupLevel: number;
  reviveLevel: number;
  [key: string]: number;
}

/** 이벤트 로그 타입 */
export type EventLogType =
  | 'damage'
  | 'heal'
  | 'kill'
  | 'levelup'
  | 'pickup'
  | 'skill'
  | 'boss'
  | 'milestone'
  | 'system'
  | 'elite'
  | 'combo'
  | 'achievement';

/** 특이점 상태 */
export interface SingularityState {
  isActive: boolean;
  survivalTime: number;
  bestTime: number;
  killCount: number;
  currentDifficulty: number;
  activeEvent: SingularityEvent | null;
}

/** 특이점 이벤트 */
export interface SingularityEvent {
  type: SingularityEventType;
  name: string;
  description: string;
  duration: number;
  remaining: number;
}

/** 특이점 결과 */
export interface SingularityResult {
  survivalTime: number;
  killCount: number;
  score: number;
  isNewRecord: boolean;
  rewards: {
    survivalBonus: number;
    recordBonus: number;
    killBonus: number;
    total: number;
  };
}

/** 특이점 이벤트 타입 */
export type SingularityEventType =
  | 'MINI_BOSS'
  | 'milestone'
  | 'boss_spawn'
  | 'boss_defeat'
  | 'difficulty_increase';
