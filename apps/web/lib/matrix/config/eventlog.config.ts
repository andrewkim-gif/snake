/**
 * eventlog.config.ts - 이벤트 로그 터미널 설정
 * CODE SURVIVOR v4.0 - Matrix 스타일 CLI 이벤트 피드
 *
 * Ported from app_ingame/config/eventlog.config.ts
 */

// 이벤트 로그 전용 타입 (app_ingame 기준, ../types의 EventLogType과 별도)
export type EventLogType =
  | 'pickup'
  | 'xp'
  | 'levelup'
  | 'weapon'
  | 'combo'
  | 'burst'
  | 'mission'
  | 'success'
  | 'fail'
  | 'boss'
  | 'kill'
  | 'wave'
  | 'system'
  | 'witty';

// 이벤트 로그 메시지 타입
export interface EventLogMessage {
  id: string;
  type: EventLogType;
  text: string;
  timestamp: number;
}

// 이벤트 로그 상태 타입
export interface EventLogState {
  messages: EventLogMessage[];
  maxMessages: number;
}

// 이벤트 타입별 색상 (Tailwind CSS 색상 + 커스텀)
export const EVENT_LOG_COLORS: Record<EventLogType, string> = {
  pickup: '#22d3ee',    // cyan-400 - 아이템
  xp: '#a855f7',        // purple-500 - 경험치
  levelup: '#fbbf24',   // amber-400 - 레벨업 (골드)
  weapon: '#f97316',    // orange-500 - 무기
  combo: '#00FF41',     // Matrix green - 콤보
  burst: '#eab308',     // yellow-500 - 데이터 버스트
  mission: '#06b6d4',   // cyan-500 - 미션
  success: '#10b981',   // emerald-500 - 성공
  fail: '#ef4444',      // red-500 - 실패
  boss: '#dc2626',      // red-600 - 보스
  kill: '#ffffff',      // white - 킬 마일스톤
  wave: '#06b6d4',      // cyan-500 - 웨이브
  system: '#9ca3af',    // gray-400 - 시스템
  witty: '#7dd3fc',     // sky-300 - AI 위트 메시지
};

// 이벤트 타입별 접두사 태그
export const EVENT_LOG_TAGS: Record<EventLogType, string> = {
  pickup: 'PICKUP',
  xp: 'XP',
  levelup: 'LEVEL UP',
  weapon: 'WEAPON',
  combo: 'COMBO',
  burst: 'BURST',
  mission: 'MISSION',
  success: 'SUCCESS',
  fail: 'FAIL',
  boss: 'BOSS',
  kill: 'KILL',
  wave: 'WAVE',
  system: 'SYSTEM',
  witty: 'CLAUDE',
};

// 이벤트 로그 설정
export const EVENT_LOG_CONFIG = {
  // 표시 설정
  maxVisibleMessages: 7,      // 화면에 표시할 최대 메시지 수
  maxStoredMessages: 30,      // 저장할 최대 메시지 수

  // 타이밍 설정
  messageLifetime: 5000,      // 메시지 표시 시간 (ms)
  fadeStartTime: 3000,        // 페이드 시작 시간 (ms)
  typingSpeed: 30,            // 타이핑 애니메이션 속도 (ms/char)

  // 시각 효과
  enableTypingAnimation: true,
  enableGlowEffect: true,
  enableFadeOut: true,

  // 레이아웃 (모바일)
  mobile: {
    maxVisibleMessages: 5,
    fontSize: 10,
    width: 180,
    position: { bottom: 120, left: 8 },
  },

  // 레이아웃 (데스크톱) - 화면 하단 왼쪽
  desktop: {
    maxVisibleMessages: 4,
    fontSize: 11,
    width: 320,
    position: { bottom: 16, left: 16 },
  },
};

// 초기 상태 생성
export function createInitialEventLogState(): EventLogState {
  return {
    messages: [],
    maxMessages: EVENT_LOG_CONFIG.maxStoredMessages,
  };
}

// 유니크 ID 생성
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 캐릭터 이름 가져오기 (classes.config.ts에서)
export function getCharacterDisplayName(classId: string): string {
  const names: Record<string, string> = {
    neo: 'NEO',
    tank: 'TANK',
    cypher: 'CYPHER',
    morpheus: 'MORPHEUS',
    niobe: 'NIOBE',
    oracle: 'ORACLE',
    trinity: 'TRINITY',
    mouse: 'MOUSE',
    dozer: 'DOZER',
  };
  return names[classId] || classId.toUpperCase();
}

// 무기 한글 이름 (weapons.config.ts 참조)
export function getWeaponDisplayName(weaponId: string): string {
  const names: Record<string, string> = {
    whip: 'Hand Coding',
    wand: 'API Call',
    knife: 'Git Push',
    axe: 'Server Throw',
    punch: 'Keyboard Punch',
    bible: 'Documentation',
    garlic: 'Debug Aura',
    pool: 'Firewall Zone',
    lightning: 'Claude Assist',
    beam: 'Stack Trace',
    laser: 'Recursive Loop',
    phishing: 'MCP Server',
    stablecoin: 'Type Safety',
  };
  return names[weaponId] || weaponId;
}

// 아이템 이름
export function getPickupDisplayName(pickupType: string): string {
  const names: Record<string, string> = {
    chicken: '회복 아이템',
    magnet: '자석',
    bomb: '폭탄',
    chest: '보물상자',
  };
  return names[pickupType] || pickupType;
}
