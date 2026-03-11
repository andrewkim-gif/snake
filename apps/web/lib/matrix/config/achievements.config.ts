/**
 * achievements.config.ts - CODE SURVIVOR v4 업적 설정
 * Matrix meets Office Space - 프로그래머 vs AI 세계관
 * 총 60개 이상의 다양한 업적
 *
 * Ported from app_ingame/config/achievements.config.ts
 */

// 업적 카테고리 타입
export type AchievementCategory =
  | 'stage'
  | 'perfect'
  | 'singularity'
  | 'cumulative'
  | 'combat'
  | 'collection'
  | 'mastery';

// 업적 보상 타입
export interface AchievementReward {
  type: 'gold' | 'item' | 'skin';
  amount: number;
  itemId?: string;
}

// 업적 조건 타입
export interface AchievementCondition {
  type: string;
  target?: number;
  characterId?: string;
}

// 업적 타입
export interface Achievement {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  condition: AchievementCondition;
  rewards: AchievementReward[];
  isHidden: boolean;
  order: number;
}

// 전체 업적 목록
export const ACHIEVEMENTS: Achievement[] = [
  // =============================================================================
  // 섹터 클리어 업적 (8개) - 스테이지 클리어
  // =============================================================================
  {
    id: 'stage_1',
    category: 'stage',
    name: '첫 번째 커밋',
    description: '섹터 1을 클리어하세요',
    condition: { type: 'stage_clear', target: 1 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 1,
  },
  {
    id: 'stage_3',
    category: 'stage',
    name: '디버깅 본능',
    description: '섹터 3을 클리어하세요',
    condition: { type: 'stage_clear', target: 3 },
    rewards: [{ type: 'gold', amount: 2000 }],
    isHidden: false,
    order: 2,
  },
  {
    id: 'stage_5',
    category: 'stage',
    name: '주니어 해커',
    description: '섹터 5를 클리어하세요',
    condition: { type: 'stage_clear', target: 5 },
    rewards: [
      { type: 'gold', amount: 5000 },
    ],
    isHidden: false,
    order: 3,
  },
  {
    id: 'stage_10',
    category: 'stage',
    name: '시니어 서바이버',
    description: '섹터 10을 클리어하세요',
    condition: { type: 'stage_clear', target: 10 },
    rewards: [
      { type: 'gold', amount: 10000 },
    ],
    isHidden: false,
    order: 4,
  },
  {
    id: 'stage_15',
    category: 'stage',
    name: '코드 마스터',
    description: '섹터 15를 클리어하세요',
    condition: { type: 'stage_clear', target: 15 },
    rewards: [
      { type: 'gold', amount: 20000 },
    ],
    isHidden: false,
    order: 5,
  },
  {
    id: 'stage_20',
    category: 'stage',
    name: '아키텍트',
    description: '섹터 20을 클리어하세요',
    condition: { type: 'stage_clear', target: 20 },
    rewards: [
      { type: 'gold', amount: 50000 },
    ],
    isHidden: false,
    order: 6,
  },
  {
    id: 'stage_25',
    category: 'stage',
    name: '시스템 수호자',
    description: '섹터 25를 클리어하세요',
    condition: { type: 'stage_clear', target: 25 },
    rewards: [
      { type: 'gold', amount: 75000 },
    ],
    isHidden: false,
    order: 7,
  },
  {
    id: 'stage_30',
    category: 'stage',
    name: 'NEXUS 파괴자',
    description: '섹터 30을 클리어하세요',
    condition: { type: 'stage_clear', target: 30 },
    rewards: [
      { type: 'gold', amount: 100000 },
    ],
    isHidden: false,
    order: 8,
  },

  // =============================================================================
  // 제로 버그 업적 (6개) - 퍼펙트 클리어
  // =============================================================================
  {
    id: 'perfect_first',
    category: 'perfect',
    name: '제로 버그',
    description: '첫 퍼펙트 클리어를 달성하세요',
    condition: { type: 'perfect_count', target: 1 },
    rewards: [{ type: 'gold', amount: 500 }],
    isHidden: false,
    order: 10,
  },
  {
    id: 'perfect_3',
    category: 'perfect',
    name: '클린 코더',
    description: '퍼펙트 클리어 3회 달성',
    condition: { type: 'perfect_count', target: 3 },
    rewards: [{ type: 'gold', amount: 1500 }],
    isHidden: false,
    order: 11,
  },
  {
    id: 'perfect_5',
    category: 'perfect',
    name: '무결점 실행',
    description: '퍼펙트 클리어 5회 달성',
    condition: { type: 'perfect_count', target: 5 },
    rewards: [{ type: 'gold', amount: 3000 }],
    isHidden: false,
    order: 12,
  },
  {
    id: 'perfect_10',
    category: 'perfect',
    name: '방화벽 마스터',
    description: '퍼펙트 클리어 10회 달성',
    condition: { type: 'perfect_count', target: 10 },
    rewards: [{ type: 'gold', amount: 10000 }],
    isHidden: false,
    order: 13,
  },
  {
    id: 'perfect_20',
    category: 'perfect',
    name: '철벽 방어',
    description: '퍼펙트 클리어 20회 달성',
    condition: { type: 'perfect_count', target: 20 },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 14,
  },
  {
    id: 'perfect_50',
    category: 'perfect',
    name: '불침번',
    description: '퍼펙트 클리어 50회 달성',
    condition: { type: 'perfect_count', target: 50 },
    rewards: [{ type: 'gold', amount: 100000 }],
    isHidden: false,
    order: 15,
  },

  // =============================================================================
  // Singularity 업적 (7개) - 한계돌파 모드
  // =============================================================================
  {
    id: 'sing_1min',
    category: 'singularity',
    name: 'Singularity 입문',
    description: 'Singularity 1분 생존',
    condition: { type: 'singularity_time', target: 60 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 20,
  },
  {
    id: 'sing_5min',
    category: 'singularity',
    name: '초보 도전자',
    description: 'Singularity 5분 생존',
    condition: { type: 'singularity_time', target: 300 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 21,
  },
  {
    id: 'sing_10min',
    category: 'singularity',
    name: '열정의 코더',
    description: 'Singularity 10분 생존',
    condition: { type: 'singularity_time', target: 600 },
    rewards: [{ type: 'gold', amount: 10000 }],
    isHidden: false,
    order: 22,
  },
  {
    id: 'sing_15min',
    category: 'singularity',
    name: '레지스탕스',
    description: 'Singularity 15분 생존',
    condition: { type: 'singularity_time', target: 900 },
    rewards: [{ type: 'gold', amount: 20000 }],
    isHidden: false,
    order: 23,
  },
  {
    id: 'sing_30min',
    category: 'singularity',
    name: 'AI 저항군',
    description: 'Singularity 30분 생존',
    condition: { type: 'singularity_time', target: 1800 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 24,
  },
  {
    id: 'sing_45min',
    category: 'singularity',
    name: '최후의 생존자',
    description: 'Singularity 45분 생존',
    condition: { type: 'singularity_time', target: 2700 },
    rewards: [{ type: 'gold', amount: 75000 }],
    isHidden: false,
    order: 25,
  },
  {
    id: 'sing_60min',
    category: 'singularity',
    name: 'Singularity 정복자',
    description: 'Singularity 60분 생존',
    condition: { type: 'singularity_time', target: 3600 },
    rewards: [{ type: 'gold', amount: 100000 }],
    isHidden: false,
    order: 26,
  },

  // =============================================================================
  // 누적 업적 - 처치 (7개)
  // =============================================================================
  {
    id: 'kill_100',
    category: 'cumulative',
    name: '봇 슬레이어',
    description: 'AI 봇 100대 처리',
    condition: { type: 'kill_count', target: 100 },
    rewards: [{ type: 'gold', amount: 500 }],
    isHidden: false,
    order: 30,
  },
  {
    id: 'kill_500',
    category: 'cumulative',
    name: '바이러스 헌터',
    description: 'AI 봇 500대 처리',
    condition: { type: 'kill_count', target: 500 },
    rewards: [{ type: 'gold', amount: 1500 }],
    isHidden: false,
    order: 31,
  },
  {
    id: 'kill_1000',
    category: 'cumulative',
    name: '시스템 클리너',
    description: 'AI 봇 1,000대 처리',
    condition: { type: 'kill_count', target: 1000 },
    rewards: [{ type: 'gold', amount: 3000 }],
    isHidden: false,
    order: 32,
  },
  {
    id: 'kill_5000',
    category: 'cumulative',
    name: '백신 프로그램',
    description: 'AI 봇 5,000대 처리',
    condition: { type: 'kill_count', target: 5000 },
    rewards: [{ type: 'gold', amount: 10000 }],
    isHidden: false,
    order: 33,
  },
  {
    id: 'kill_10000',
    category: 'cumulative',
    name: '포맷터',
    description: 'AI 봇 10,000대 처리',
    condition: { type: 'kill_count', target: 10000 },
    rewards: [{ type: 'gold', amount: 20000 }],
    isHidden: false,
    order: 34,
  },
  {
    id: 'kill_50000',
    category: 'cumulative',
    name: '디지털 학살자',
    description: 'AI 봇 50,000대 처리',
    condition: { type: 'kill_count', target: 50000 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 35,
  },
  {
    id: 'kill_100000',
    category: 'cumulative',
    name: 'AI 멸종자',
    description: 'AI 봇 100,000대 처리',
    condition: { type: 'kill_count', target: 100000 },
    rewards: [{ type: 'gold', amount: 100000 }],
    isHidden: false,
    order: 36,
  },

  // =============================================================================
  // 누적 업적 - 크레딧 (5개)
  // =============================================================================
  {
    id: 'gold_10k',
    category: 'cumulative',
    name: '저축의 시작',
    description: '총 10,000 크레딧 획득',
    condition: { type: 'gold_earned', target: 10000 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 40,
  },
  {
    id: 'gold_50k',
    category: 'cumulative',
    name: '알뜰한 개발자',
    description: '총 50,000 크레딧 획득',
    condition: { type: 'gold_earned', target: 50000 },
    rewards: [{ type: 'gold', amount: 3000 }],
    isHidden: false,
    order: 41,
  },
  {
    id: 'gold_100k',
    category: 'cumulative',
    name: '스타트업 CEO',
    description: '총 100,000 크레딧 획득',
    condition: { type: 'gold_earned', target: 100000 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 42,
  },
  {
    id: 'gold_500k',
    category: 'cumulative',
    name: '실리콘밸리 거물',
    description: '총 500,000 크레딧 획득',
    condition: { type: 'gold_earned', target: 500000 },
    rewards: [{ type: 'gold', amount: 25000 }],
    isHidden: false,
    order: 43,
  },
  {
    id: 'gold_1m',
    category: 'cumulative',
    name: '테크 타이쿤',
    description: '총 1,000,000 크레딧 획득',
    condition: { type: 'gold_earned', target: 1000000 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 44,
  },

  // =============================================================================
  // 누적 업적 - 플레이 횟수 (5개)
  // =============================================================================
  {
    id: 'play_5',
    category: 'cumulative',
    name: '신입 개발자',
    description: '5회 플레이',
    condition: { type: 'play_count', target: 5 },
    rewards: [{ type: 'gold', amount: 300 }],
    isHidden: false,
    order: 50,
  },
  {
    id: 'play_10',
    category: 'cumulative',
    name: '코딩 입문자',
    description: '10회 플레이',
    condition: { type: 'play_count', target: 10 },
    rewards: [{ type: 'gold', amount: 500 }],
    isHidden: false,
    order: 51,
  },
  {
    id: 'play_30',
    category: 'cumulative',
    name: '충성 코더',
    description: '30회 플레이',
    condition: { type: 'play_count', target: 30 },
    rewards: [{ type: 'gold', amount: 2000 }],
    isHidden: false,
    order: 52,
  },
  {
    id: 'play_50',
    category: 'cumulative',
    name: '열혈 서바이버',
    description: '50회 플레이',
    condition: { type: 'play_count', target: 50 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 53,
  },
  {
    id: 'play_100',
    category: 'cumulative',
    name: '레지스탕스 사령관',
    description: '100회 플레이',
    condition: { type: 'play_count', target: 100 },
    rewards: [{ type: 'gold', amount: 10000 }],
    isHidden: false,
    order: 54,
  },

  // =============================================================================
  // 전투 업적 - 보스 (6개)
  // =============================================================================
  {
    id: 'boss_1',
    category: 'combat',
    name: 'AI 코어 파괴',
    description: '첫 보스를 처치하세요',
    condition: { type: 'boss_kill', target: 1 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 60,
  },
  {
    id: 'boss_5',
    category: 'combat',
    name: '슈퍼컴퓨터 사냥꾼',
    description: '보스 5마리 처치',
    condition: { type: 'boss_kill', target: 5 },
    rewards: [{ type: 'gold', amount: 3000 }],
    isHidden: false,
    order: 61,
  },
  {
    id: 'boss_10',
    category: 'combat',
    name: '메인프레임 슬레이어',
    description: '보스 10마리 처치',
    condition: { type: 'boss_kill', target: 10 },
    rewards: [{ type: 'gold', amount: 8000 }],
    isHidden: false,
    order: 62,
  },
  {
    id: 'boss_25',
    category: 'combat',
    name: 'AI 파괴자',
    description: '보스 25마리 처치',
    condition: { type: 'boss_kill', target: 25 },
    rewards: [{ type: 'gold', amount: 20000 }],
    isHidden: false,
    order: 63,
  },
  {
    id: 'boss_50',
    category: 'combat',
    name: 'NEXUS 정복자',
    description: '보스 50마리 처치',
    condition: { type: 'boss_kill', target: 50 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 64,
  },
  {
    id: 'boss_100',
    category: 'combat',
    name: '인류의 수호자',
    description: '보스 100마리 처치',
    condition: { type: 'boss_kill', target: 100 },
    rewards: [{ type: 'gold', amount: 100000 }],
    isHidden: false,
    order: 65,
  },

  // =============================================================================
  // 전투 업적 - 한 판 기록 (6개)
  // =============================================================================
  {
    id: 'single_kill_100',
    category: 'combat',
    name: '미니 퍼지',
    description: '한 게임에서 100대 처리',
    condition: { type: 'single_game_kill', target: 100 },
    rewards: [{ type: 'gold', amount: 500 }],
    isHidden: false,
    order: 70,
  },
  {
    id: 'single_kill_500',
    category: 'combat',
    name: '대규모 퍼지',
    description: '한 게임에서 500대 처리',
    condition: { type: 'single_game_kill', target: 500 },
    rewards: [{ type: 'gold', amount: 2000 }],
    isHidden: false,
    order: 71,
  },
  {
    id: 'single_kill_1000',
    category: 'combat',
    name: '시스템 리셋',
    description: '한 게임에서 1,000대 처리',
    condition: { type: 'single_game_kill', target: 1000 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 72,
  },
  {
    id: 'single_kill_2000',
    category: 'combat',
    name: '완전 포맷',
    description: '한 게임에서 2,000대 처리',
    condition: { type: 'single_game_kill', target: 2000 },
    rewards: [{ type: 'gold', amount: 15000 }],
    isHidden: false,
    order: 73,
  },
  {
    id: 'single_level_10',
    category: 'combat',
    name: '레벨 10 달성',
    description: '한 게임에서 레벨 10 달성',
    condition: { type: 'single_game_level', target: 10 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 74,
  },
  {
    id: 'single_level_20',
    category: 'combat',
    name: '레벨 20 달성',
    description: '한 게임에서 레벨 20 달성',
    condition: { type: 'single_game_level', target: 20 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 75,
  },

  // =============================================================================
  // 수집 업적 - 상자 (4개)
  // =============================================================================
  {
    id: 'chest_10',
    category: 'collection',
    name: '데이터 마이너',
    description: '상자 10개 열기',
    condition: { type: 'chest_open', target: 10 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 80,
  },
  {
    id: 'chest_50',
    category: 'collection',
    name: '데이터 수집가',
    description: '상자 50개 열기',
    condition: { type: 'chest_open', target: 50 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 81,
  },
  {
    id: 'chest_100',
    category: 'collection',
    name: '빅데이터 전문가',
    description: '상자 100개 열기',
    condition: { type: 'chest_open', target: 100 },
    rewards: [{ type: 'gold', amount: 15000 }],
    isHidden: false,
    order: 82,
  },
  {
    id: 'chest_300',
    category: 'collection',
    name: '데이터 사이언티스트',
    description: '상자 300개 열기',
    condition: { type: 'chest_open', target: 300 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 83,
  },

  // =============================================================================
  // 수집 업적 - 무기 (4개)
  // =============================================================================
  {
    id: 'weapon_max_1',
    category: 'collection',
    name: '스킬 마스터',
    description: '무기 하나를 최대 레벨로 강화',
    condition: { type: 'weapon_max', target: 1 },
    rewards: [{ type: 'gold', amount: 2000 }],
    isHidden: false,
    order: 84,
  },
  {
    id: 'weapon_max_3',
    category: 'collection',
    name: '멀티툴 프로그래머',
    description: '무기 3개를 최대 레벨로 강화',
    condition: { type: 'weapon_max', target: 3 },
    rewards: [{ type: 'gold', amount: 8000 }],
    isHidden: false,
    order: 85,
  },
  {
    id: 'weapon_max_5',
    category: 'collection',
    name: '풀스택 개발자',
    description: '무기 5개를 최대 레벨로 강화',
    condition: { type: 'weapon_max', target: 5 },
    rewards: [{ type: 'gold', amount: 20000 }],
    isHidden: false,
    order: 86,
  },
  {
    id: 'weapon_max_10',
    category: 'collection',
    name: '10x 엔지니어',
    description: '무기 10개를 최대 레벨로 강화',
    condition: { type: 'weapon_max', target: 10 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 87,
  },

  // =============================================================================
  // 캐릭터 마스터리 업적 (5개) - Matrix 테마 캐릭터
  // =============================================================================
  {
    id: 'mastery_doha',
    category: 'mastery',
    name: 'NEO 마스터',
    description: 'NEO로 섹터 30 클리어',
    condition: { type: 'character_clear', target: 30, characterId: 'neo' },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 90,
  },
  {
    id: 'mastery_taewoong',
    category: 'mastery',
    name: 'TANK 마스터',
    description: 'TANK로 섹터 30 클리어',
    condition: { type: 'character_clear', target: 30, characterId: 'tank' },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 91,
  },
  {
    id: 'mastery_junser',
    category: 'mastery',
    name: 'CYPHER 마스터',
    description: 'CYPHER로 섹터 30 클리어',
    condition: { type: 'character_clear', target: 30, characterId: 'cypher' },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 92,
  },
  {
    id: 'mastery_siwoo',
    category: 'mastery',
    name: 'MORPHEUS 마스터',
    description: 'MORPHEUS로 섹터 30 클리어',
    condition: { type: 'character_clear', target: 30, characterId: 'morpheus' },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 93,
  },
  {
    id: 'mastery_doyeon',
    category: 'mastery',
    name: 'TRINITY 마스터',
    description: 'TRINITY로 섹터 30 클리어',
    condition: { type: 'character_clear', target: 30, characterId: 'trinity' },
    rewards: [{ type: 'gold', amount: 30000 }],
    isHidden: false,
    order: 94,
  },

  // =============================================================================
  // 총 플레이 시간 업적 (4개)
  // =============================================================================
  {
    id: 'time_1h',
    category: 'cumulative',
    name: '1시간 코딩',
    description: '총 1시간 플레이',
    condition: { type: 'total_time', target: 3600 },
    rewards: [{ type: 'gold', amount: 1000 }],
    isHidden: false,
    order: 95,
  },
  {
    id: 'time_5h',
    category: 'cumulative',
    name: '5시간 마라톤',
    description: '총 5시간 플레이',
    condition: { type: 'total_time', target: 18000 },
    rewards: [{ type: 'gold', amount: 5000 }],
    isHidden: false,
    order: 96,
  },
  {
    id: 'time_10h',
    category: 'cumulative',
    name: '10시간 야근',
    description: '총 10시간 플레이',
    condition: { type: 'total_time', target: 36000 },
    rewards: [{ type: 'gold', amount: 15000 }],
    isHidden: false,
    order: 97,
  },
  {
    id: 'time_24h',
    category: 'cumulative',
    name: '24시간 해커톤',
    description: '총 24시간 플레이',
    condition: { type: 'total_time', target: 86400 },
    rewards: [{ type: 'gold', amount: 50000 }],
    isHidden: false,
    order: 98,
  },
];

// =============================================================================
// 유틸리티 함수
// =============================================================================

// 업적 ID로 조회
export const getAchievementById = (id: string): Achievement | undefined => {
  return ACHIEVEMENTS.find(a => a.id === id);
};

// 카테고리별 업적 조회
export const getAchievementsByCategory = (category: AchievementCategory): Achievement[] => {
  return ACHIEVEMENTS.filter(a => a.category === category).sort((a, b) => a.order - b.order);
};

// 전체 업적 수
export const getTotalAchievementCount = (): number => {
  return ACHIEVEMENTS.length;
};

// 숨겨지지 않은 업적만
export const getVisibleAchievements = (): Achievement[] => {
  return ACHIEVEMENTS.filter(a => !a.isHidden).sort((a, b) => a.order - b.order);
};

// 특정 캐릭터 관련 업적
export const getCharacterAchievements = (characterId: string): Achievement[] => {
  return ACHIEVEMENTS.filter(a =>
    a.category === 'mastery' && a.condition.characterId === characterId
  );
};

// 업적 카테고리 목록
export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; name: string; icon: string }[] = [
  { id: 'stage', name: '섹터', icon: 'Map' },
  { id: 'perfect', name: '퍼펙트', icon: 'Star' },
  { id: 'singularity', name: 'Singularity', icon: 'Zap' },
  { id: 'cumulative', name: '누적', icon: 'TrendingUp' },
  { id: 'combat', name: '전투', icon: 'Swords' },
  { id: 'collection', name: '수집', icon: 'Package' },
  { id: 'mastery', name: '마스터리', icon: 'Crown' },
];

// 업적 진행도 계산
export const getAchievementProgress = (
  achievement: Achievement,
  currentValue: number
): { current: number; target: number; percentage: number } => {
  const target = achievement.condition.target || 1;
  const current = Math.min(currentValue, target);
  const percentage = Math.round((current / target) * 100);
  return { current, target, percentage };
};
