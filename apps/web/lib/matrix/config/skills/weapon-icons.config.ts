/**
 * weapon-icons.config.ts - WeaponType → lucide-react 아이콘 매핑
 *
 * v37 인게임 오버홀: SVG 아이콘 시스템
 *
 * 모든 WeaponType에 대해 lucide-react 아이콘 이름을 매핑한다.
 * SkillIconSVG 컴포넌트와 Canvas 렌더링 유틸리티 모두에서 사용.
 *
 * 매핑 기준: v37 기획서 섹션 2.1~2.7 + 섹션 5.2
 */

import type { WeaponType } from '../../types';

/**
 * lucide-react 아이콘 이름 타입
 * (실제로는 string이지만, 문서화 목적으로 유니온 타입 정의)
 */
export type LucideIconName =
  | 'Crosshair' | 'Zap' | 'Bomb' | 'Swords' | 'Target'
  | 'CircleDot' | 'Radio' | 'Expand' | 'LayoutGrid' | 'Flame'
  | 'Link' | 'Globe2' | 'Wifi' | 'Radar' | 'Unplug'
  | 'Shield' | 'HeartPulse' | 'ShieldAlert' | 'Castle' | 'Eye'
  | 'Brain' | 'Bot' | 'Bug' | 'Cpu' | 'Terminal'
  | 'Megaphone' | 'Gauge' | 'Rocket' | 'Package' | 'Users'
  | 'ShieldCheck' | 'BookOpen' | 'Truck' | 'Footprints' | 'Scale'
  | 'Search' | 'Wrench' | 'Sword' | 'Waves' | 'Hand'
  | 'Axe' | 'Triangle' | 'Snowflake' | 'GitFork' | 'Circle'
  | 'Orbit' | 'AlertCircle' | 'Minus' | 'Settings' | 'ArrowDown'
  | 'Atom' | 'Magnet' | 'ChevronsRight' | 'Coins' | 'Grid3x3'
  | (string & {});

/**
 * WeaponType → lucide-react 아이콘 이름 매핑
 *
 * 기획서 섹션 2.1~2.7 기반:
 * - STEEL(CODE): 근접/직접 데미지 계열
 * - TERRITORY(DATA): 원거리/투사체 계열
 * - ALLIANCE(NETWORK): 체인/광역 계열
 * - SOVEREIGNTY(SECURITY): 방어/생존 계열
 * - INTELLIGENCE(AI): 패시브/유틸리티 계열
 * - MORALE(SYSTEM): 특수/범용 계열
 */
export const WEAPON_ICON_MAP: Partial<Record<WeaponType, LucideIconName>> = {
  // ============================================
  // STEEL (CODE) — 근접/직접 데미지
  // ============================================
  whip: 'Waves',           // 전투 채찍 — S자 곡선
  punch: 'Hand',           // 강철 주먹 — 주먹 정면
  knife: 'Crosshair',      // 전투 단검 / 철의 세례 — 조준
  wand: 'Rocket',          // 추적탄 (CODE에 배치됨)
  axe: 'Bomb',             // 전차포 — 폭탄
  bow: 'Target',           // 텅스텐 관통탄 — 타겟
  sword: 'Sword',          // 검 — 칼날
  syntax_error: 'Zap',     // EMP 수류탄 — 전기
  compiler: 'Crosshair',   // 궤도포 — 조준
  debugger_skill: 'Search', // 디버거 — 탐색
  refactor: 'Wrench',      // 리팩터링 — 공구
  regex: 'Terminal',        // 정규표현식 — 터미널
  hotfix: 'Swords',        // 총력전 (CODE Ultimate) — 교차 검

  // ============================================
  // TERRITORY (DATA) — 원거리/투사체
  // ============================================
  shard: 'Triangle',        // 클러스터탄 — 역삼각 분열
  json_bomb: 'Bomb',        // 소이탄 — 폭탄
  csv_spray: 'Expand',      // 산탄 — 확산
  binary: 'CircleDot',      // 관통탄 — 원형 탄
  big_data: 'Grid3x3',      // 융단 폭격 (DATA Ultimate) — 폭격 그리드
  crossbow: 'Target',       // 크로스보우 — 타겟

  // ============================================
  // ALLIANCE (NETWORK) — 체인/광역
  // ============================================
  lightning: 'Zap',         // 전술 번개 — 번개
  ping: 'Radio',            // 소나 펄스 — 파동
  bridge: 'Snowflake',      // 냉각 폭탄 — 결정
  fork: 'GitFork',          // 분열탄 — Y자 분기
  websocket: 'Wifi',        // 웹소켓 — 연결
  tcp_flood: 'Radar',       // TCP 플러드 — 레이더
  dns_spoof: 'Unplug',      // DNS 스푸핑 — 분리
  ddos: 'Globe2',           // DDoS — 글로브
  vpn_tunnel: 'Users',      // 연합 전선 (NETWORK Ultimate) — 분신

  // ============================================
  // SOVEREIGNTY (SECURITY) — 방어/생존
  // ============================================
  garlic: 'Circle',          // 방어 필드 — 동심원 오라
  bible: 'Orbit',            // 가디언 위성 — 궤도
  pool: 'AlertCircle',       // 지뢰밭 — 위험 원
  stablecoin: 'Shield',      // 에너지 실드 — 실드
  antivirus: 'ShieldAlert',  // 안티바이러스 — 경고 실드
  sandbox: 'Castle',         // 샌드박스 — 요새
  zero_trust: 'Eye',         // 제로 트러스트 — 감시
  encryption: 'ShieldCheck', // 암호화 — 체크 실드
  honeypot: 'Castle',        // 요새 (SECURITY Ultimate) — 성벽
  firewall_surge: 'Flame',   // 방화벽 서지 — 화염
  backup: 'HeartPulse',      // 백업 — 생명
  incident_response: 'ShieldAlert', // 인시던트 대응
  sql_injection: 'Terminal',  // SQL 인젝션

  // ============================================
  // MORALE (SYSTEM) — 특수/범용
  // ============================================
  beam: 'Minus',              // 레이저 캐논 — 빔
  laser: 'Settings',          // 회전 레이저 — 톱니
  airdrop: 'ArrowDown',       // 공습 — 낙하
  phishing: 'Target',         // 궤도 폭격 — 타겟
  genesis: 'Atom',            // 전술 핵 — 핵
  ram_upgrade: 'Gauge',       // RAM 업그레이드 — 게이지
  cpu_boost: 'Rocket',        // CPU 부스트 — 로켓
  cache: 'Package',           // 캐시 — 패키지
  multithreading: 'Flame',    // 핵 옵션 (SYSTEM Ultimate) — 화염
  garbage_collection: 'Wrench', // 가비지 컬렉션

  // ============================================
  // INTELLIGENCE (AI) — 패시브/유틸리티
  // ============================================
  aggregator: 'Magnet',       // 보급 체계 — 자석
  oracle: 'Eye',              // 정보 분석 — 눈
  focus: 'Crosshair',         // 정밀 조준 — 조준경
  overclock: 'ChevronsRight', // 강행군 — 가속
  gold_reward: 'Coins',       // 전리품 — 코인

  // 시너지 / AI 특수 스킬
  neural_net: 'Brain',         // 첩보망
  chatgpt: 'Megaphone',        // 프로파간다
  deepfake: 'Bug',             // 이중 첩자
  singularity_core: 'Atom',    // 세계 정복
  autopilot: 'Bot',            // 오토파일럿
  agi: 'Cpu',                  // AGI
  packet_loss: 'Unplug',       // 패킷 로스

  // ============================================
  // 패시브 (nation_loyalty 등)
  // ============================================
  mempool: 'Package',          // 멤풀
};

/**
 * WeaponType에 대한 lucide 아이콘 이름을 반환한다.
 * 매핑이 없으면 기본 폴백 아이콘 'Zap'을 반환.
 */
export function getWeaponIconName(weaponType: WeaponType): LucideIconName {
  return WEAPON_ICON_MAP[weaponType] ?? 'Zap';
}

/**
 * 기본 폴백 아이콘 이름
 */
export const DEFAULT_ICON_NAME: LucideIconName = 'Zap';
