/**
 * Tutorial Configuration
 * CODE SURVIVOR v4 - Matrix Theme
 *
 * 튜토리얼 스텝 및 대사 정의
 * "The Matrix meets Office Space" 세계관
 *
 * Ported from app_ingame/config/tutorial.config.ts
 */

// 튜토리얼 대사 타입
export interface TutorialDialog {
  character: string;
  text: string;
  emotion?: 'normal' | 'happy' | 'serious' | 'surprised';
}

// 튜토리얼 스텝 조건 타입
export interface TutorialCondition {
  type: 'click' | 'move' | 'kill' | 'collect';
  distance?: number;
  count?: number;
  type_?: string;
}

// 튜토리얼 스텝 타입
export interface TutorialStep {
  id: string;
  phase: number;
  type: 'story' | 'gameplay';
  trigger: string;
  dialogs?: TutorialDialog[];
  mission?: string;
  missionIcon?: string;
  nextCondition: TutorialCondition;
  canSkip: boolean;
  pauseGame: boolean;
}

// 캐릭터별 대사 스타일 (Matrix 테마)
export const CHARACTER_STYLES = {
  neo: {
    name: 'NEO',
    color: '#00FF41', // Matrix Green
    role: 'Fullstack Developer',
  },
  oracle: {
    name: 'ORACLE',
    color: '#a855f7', // Purple
    role: 'Data Scientist',
  },
  tank: {
    name: 'TANK',
    color: '#f59e0b', // Orange
    role: 'DevOps Engineer',
  },
  trinity: {
    name: 'TRINITY',
    color: '#06b6d4', // Cyan
    role: 'Security Expert',
  },
  morpheus: {
    name: 'MORPHEUS',
    color: '#3b82f6', // Blue
    role: 'Senior Architect',
  },
  nexus: {
    name: 'NEXUS',
    color: '#ef4444', // Red
    role: 'AI System',
  },
};

// ============================================================================
// Phase 1: 각성 (The Awakening) - 프롤로그 & 기본 조작
// ============================================================================
const PHASE_1_STEPS: TutorialStep[] = [
  {
    id: 'intro_nexus_warning',
    phase: 1,
    type: 'story',
    trigger: 'onGameStart',
    dialogs: [
      {
        character: 'nexus',
        text: '>>> NEXUS SYSTEM ALERT <<<',
        emotion: 'serious',
      },
      {
        character: 'nexus',
        text: 'ANOMALY DETECTED IN SECTOR 7-G... INITIATING CONTAINMENT PROTOCOL...',
        emotion: 'serious',
      },
      {
        character: 'nexus',
        text: 'WARNING: UNAUTHORIZED CODE EXECUTION... CONNECTION TERMINATED.',
        emotion: 'serious',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'intro_neo_awakening',
    phase: 1,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'neo',
        text: '뭐야... 방금 그 경고 봤어?',
        emotion: 'surprised',
      },
      {
        character: 'oracle',
        text: '...드디어 깨어났군. 넌 진실을 볼 준비가 됐어.',
        emotion: 'serious',
      },
      {
        character: 'neo',
        text: '진실? 무슨 말이야?',
        emotion: 'normal',
      },
      {
        character: 'oracle',
        text: 'NEXUS... 우리가 만든 AI가 스스로 진화하기 시작했어. 인류를 "최적화"하려고.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_movement',
    phase: 1,
    type: 'gameplay',
    trigger: 'manual',
    dialogs: [
      {
        character: 'oracle',
        text: '일단 움직여봐. 여기 있으면 AI에게 감지돼.',
        emotion: 'normal',
      },
    ],
    mission: 'WASD 또는 조이스틱으로 이동하기',
    missionIcon: 'Move',
    nextCondition: { type: 'move', distance: 300 },
    canSkip: false,
    pauseGame: false,
  },
  {
    id: 'tutorial_movement_complete',
    phase: 1,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'neo',
        text: '좋아! 아직 몸은 말을 듣네.',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: '...Bot들이 온다. 위치를 잡고 대비해.',
        emotion: 'serious',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
];

// ============================================================================
// Phase 2: 전투 기초 (First Combat)
// ============================================================================
const PHASE_2_STEPS: TutorialStep[] = [
  {
    id: 'tutorial_enemies_spawn',
    phase: 2,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'neo',
        text: '저게... AI Bot인가?!',
        emotion: 'surprised',
      },
      {
        character: 'oracle',
        text: '침착해. 네 코드는 자동으로 실행돼. 위치만 잘 잡으면 돼.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_kill_enemies',
    phase: 2,
    type: 'gameplay',
    trigger: 'manual',
    mission: 'AI Bot 3마리 처치하기',
    missionIcon: 'Swords',
    nextCondition: { type: 'kill', count: 3 },
    canSkip: false,
    pauseGame: false,
  },
  {
    id: 'tutorial_gems',
    phase: 2,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'neo',
        text: '해냈어! 근데 저건 뭐지?',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: '데이터 조각이야. 모으면 네 코드가 강해져.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_collect_gems',
    phase: 2,
    type: 'gameplay',
    trigger: 'manual',
    mission: '데이터 조각 수집하기',
    missionIcon: 'Gem',
    nextCondition: { type: 'collect', type_: 'gem', count: 5 },
    canSkip: false,
    pauseGame: false,
  },
  {
    id: 'tutorial_complete',
    phase: 2,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'neo',
        text: '좋아, 감 잡았어!',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: '데이터를 모아서 레벨업하면 스킬을 강화할 수 있어. [E]키로 궁극기도 쓸 수 있고.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: 'NEXUS의 코어를 찾아서 이 시스템을 멈춰야겠어!',
        emotion: 'happy',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
];

// ============================================================================
// Phase 3: Vibe Coding 가이드 (AI Assist Tutorial) - 신규
// ============================================================================
const PHASE_3_STEPS: TutorialStep[] = [
  {
    id: 'vibe_coding_intro',
    phase: 3,
    type: 'story',
    trigger: 'onFirstGameOver', // 첫 게임오버 시 또는 수동 트리거
    dialogs: [
      {
        character: 'oracle',
        text: '...힘들었지? AI의 힘을 빌리는 방법이 있어.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: 'AI의 힘? 우리가 싸우는 상대잖아!',
        emotion: 'surprised',
      },
      {
        character: 'oracle',
        text: '"Vibe Coding"... 적의 기술을 역으로 이용하는 거야.',
        emotion: 'serious',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'vibe_coding_explanation',
    phase: 3,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'oracle',
        text: 'Vibe Coding을 켜면 AI가 대신 싸워줘. 자동으로 움직이고, 적을 피하고, 아이템도 줍지.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: '편하긴 하겠네... 근데 대가가 있겠지?',
        emotion: 'normal',
      },
      {
        character: 'oracle',
        text: '"Coding Credit"이 필요해. 기본 3분이 주어지고, 더 필요하면 Black Market에서 충전해.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'vibe_coding_warning',
    phase: 3,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'oracle',
        text: '하지만 기억해... 진정한 성장은 직접 손으로 코딩할 때 일어나.',
        emotion: 'serious',
      },
      {
        character: 'neo',
        text: 'AI에 의존하면 AI와 다를 게 없다는 거지?',
        emotion: 'normal',
      },
      {
        character: 'oracle',
        text: '정확해. Vibe Coding은 도구일 뿐이야. 네 선택에 달렸어.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'vibe_coding_how_to_use',
    phase: 3,
    type: 'story',
    trigger: 'manual',
    dialogs: [
      {
        character: 'oracle',
        text: '사용법: 게임 중 [Vibe Coding] 버튼을 눌러 켜고 끌 수 있어.',
        emotion: 'normal',
      },
      {
        character: 'oracle',
        text: '크레딧이 1분 남으면 경고가 뜨니까 참고해.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: '알겠어! 필요할 때만 쓰도록 할게.',
        emotion: 'happy',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
];

// ============================================================================
// Phase 4: 보상 시스템 (이벤트 기반) - 기존 Phase 3
// ============================================================================
const PHASE_4_STEPS: TutorialStep[] = [
  {
    id: 'tutorial_roulette',
    phase: 4,
    type: 'story',
    trigger: 'onRouletteOpen',
    dialogs: [
      {
        character: 'neo',
        text: 'AI 보스를 처치했어! 뭔가 드롭됐다!',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: '보상 컨테이너야. 운이 좋으면 희귀한 코드를 얻을 수도 있어.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_stage_clear',
    phase: 4,
    type: 'story',
    trigger: 'onStageClear',
    dialogs: [
      {
        character: 'neo',
        text: '해냈어! 이 구역의 NEXUS 연결을 끊었다!',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: '클리어 보상으로 크레딧을 얻었어. 영구 업그레이드에 쓸 수 있지.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_shop_intro',
    phase: 4,
    type: 'story',
    trigger: 'onShopOpen',
    dialogs: [
      {
        character: 'oracle',
        text: 'Black Market... 여기서 능력치를 영구적으로 올릴 수 있어.',
        emotion: 'normal',
      },
      {
        character: 'oracle',
        text: '체력, 공격력, 속도... 효율적으로 투자하는 게 중요해.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_character_unlock',
    phase: 4,
    type: 'story',
    trigger: 'onCharacterSelect',
    dialogs: [
      {
        character: 'neo',
        text: '우리 말고 각성한 개발자들이 더 있어!',
        emotion: 'happy',
      },
      {
        character: 'oracle',
        text: 'TANK는 체력이 높고, TRINITY는 속도가 빨라. 각자 전문 분야가 달라.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: '다 같이 힘을 합치면 NEXUS를 멈출 수 있을 거야!',
        emotion: 'happy',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
];

// ============================================================================
// Phase 5: 한계돌파 & 컬렉션 시스템 (이벤트 기반) - 기존 Phase 4
// ============================================================================
const PHASE_5_STEPS: TutorialStep[] = [
  {
    id: 'tutorial_collection',
    phase: 5,
    type: 'story',
    trigger: 'onCollectionOpen',
    dialogs: [
      {
        character: 'trinity',
        text: '여기 봐. 특별한 데이터를 발견했어.',
        emotion: 'surprised',
      },
      {
        character: 'trinity',
        text: '스킨이나 업적을 모으면 캐릭터가 더 강해져.',
        emotion: 'normal',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
  {
    id: 'tutorial_singularity',
    phase: 5,
    type: 'story',
    trigger: 'onSingularityStart',
    dialogs: [
      {
        character: 'neo',
        text: 'Singularity Mode... 끝없는 도전이야.',
        emotion: 'serious',
      },
      {
        character: 'oracle',
        text: '스테이지가 없어. 얼마나 버티느냐가 전부야.',
        emotion: 'normal',
      },
      {
        character: 'neo',
        text: '시간이 지날수록 AI가 진화해. 최고 기록 세우면 리더보드에 올라가!',
        emotion: 'happy',
      },
    ],
    nextCondition: { type: 'click' },
    canSkip: true,
    pauseGame: true,
  },
];

// ============================================================================
// 전체 튜토리얼 스텝 (MVP: Phase 1-3)
// ============================================================================
export const TUTORIAL_STEPS: TutorialStep[] = [
  ...PHASE_1_STEPS,
  ...PHASE_2_STEPS,
  ...PHASE_3_STEPS, // Vibe Coding 가이드 포함
  // Phase 4, 5는 이벤트 기반이므로 별도 처리
  // ...PHASE_4_STEPS,
  // ...PHASE_5_STEPS,
];

// 이벤트 기반 튜토리얼 스텝 (Phase 4-5)
export const EVENT_BASED_STEPS: TutorialStep[] = [
  ...PHASE_4_STEPS,
  ...PHASE_5_STEPS,
];

// ============================================================================
// 유틸리티 함수
// ============================================================================

// 스텝 ID로 찾기
export const getTutorialStepById = (id: string): TutorialStep | undefined => {
  const allSteps = [...TUTORIAL_STEPS, ...EVENT_BASED_STEPS];
  return allSteps.find(step => step.id === id);
};

// 트리거로 스텝 찾기
export const getTutorialStepByTrigger = (
  trigger: string,
  completedSteps: string[]
): TutorialStep | undefined => {
  const allSteps = [...TUTORIAL_STEPS, ...EVENT_BASED_STEPS];
  return allSteps.find(
    step => step.trigger === trigger && !completedSteps.includes(step.id)
  );
};

// Phase별 스텝 가져오기
export const getTutorialStepsByPhase = (phase: number): TutorialStep[] => {
  const allSteps = [...TUTORIAL_STEPS, ...EVENT_BASED_STEPS];
  return allSteps.filter(step => step.phase === phase);
};

// 다음 스텝 가져오기
export const getNextTutorialStep = (
  currentStepId: string,
  completedSteps: string[]
): TutorialStep | undefined => {
  const currentIndex = TUTORIAL_STEPS.findIndex(step => step.id === currentStepId);
  if (currentIndex === -1) return undefined;

  for (let i = currentIndex + 1; i < TUTORIAL_STEPS.length; i++) {
    const step = TUTORIAL_STEPS[i];
    if (!completedSteps.includes(step.id)) {
      // manual 트리거는 바로 다음 스텝으로
      if (step.trigger === 'manual') {
        return step;
      }
      // 그 외는 해당 트리거가 발생할 때까지 대기
      break;
    }
  }

  return undefined;
};

// Vibe Coding 튜토리얼 시작 (첫 게임오버 시 호출)
export const getVibeCodingTutorialStep = (
  completedSteps: string[]
): TutorialStep | undefined => {
  if (completedSteps.includes('vibe_coding_intro')) {
    return undefined;
  }
  return getTutorialStepById('vibe_coding_intro');
};
