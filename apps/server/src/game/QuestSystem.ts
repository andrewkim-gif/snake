/**
 * QuestSystem.ts — 일일/주간/마일스톤 퀘스트 시스템
 *
 * 퀘스트 유형:
 * - daily: 매일 3개 (단순 로테이션)
 * - weekly: 장기 목표
 * - milestone: 1회성 업적
 *
 * 퀘스트 완료 시 RP 보상 → RPSystem에 전달
 */

// ── 퀘스트 조건 타입 ──
export type QuestCondition =
  | { type: 'kills'; count: number }
  | { type: 'survive_rounds'; count: number }
  | { type: 'reach_level'; level: number }
  | { type: 'activate_synergy'; synergyId?: string }
  | { type: 'win_rounds'; count: number }
  | { type: 'collect_orbs'; count: number }
  | { type: 'use_ability'; abilityType?: string; count: number };

// ── 퀘스트 정의 ──
export interface QuestDef {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'milestone';
  target: number;
  rpReward: number;
  condition: QuestCondition;
}

// ── 플레이어 퀘스트 진행 ──
export interface QuestProgress {
  questId: string;
  current: number;
  target: number;
  completed: boolean;
  rpReward: number;
}

// ── 퀘스트 업데이트 이벤트 ──
export interface QuestUpdateResult {
  playerId: string;
  quests: QuestProgress[];
  completedQuests: QuestProgress[];   // 이번에 완료된 퀘스트
  rpEarned: number;                    // 퀘스트 완료로 얻은 RP
}

// ── 일일 퀘스트 풀 ──
const DAILY_QUEST_POOL: QuestDef[] = [
  { id: 'daily_kills_5', name: 'Slayer', description: 'Get 5 kills', type: 'daily', target: 5, rpReward: 5, condition: { type: 'kills', count: 5 } },
  { id: 'daily_kills_10', name: 'Hunter', description: 'Get 10 kills', type: 'daily', target: 10, rpReward: 10, condition: { type: 'kills', count: 10 } },
  { id: 'daily_level_8', name: 'Leveler', description: 'Reach level 8', type: 'daily', target: 8, rpReward: 8, condition: { type: 'reach_level', level: 8 } },
  { id: 'daily_level_10', name: 'Grinder', description: 'Reach level 10', type: 'daily', target: 10, rpReward: 12, condition: { type: 'reach_level', level: 10 } },
  { id: 'daily_survive_3', name: 'Survivor', description: 'Survive 3 rounds', type: 'daily', target: 3, rpReward: 10, condition: { type: 'survive_rounds', count: 3 } },
  { id: 'daily_orbs_100', name: 'Collector', description: 'Collect 100 orbs', type: 'daily', target: 100, rpReward: 8, condition: { type: 'collect_orbs', count: 100 } },
  { id: 'daily_synergy_1', name: 'Synergist', description: 'Activate any synergy', type: 'daily', target: 1, rpReward: 10, condition: { type: 'activate_synergy' } },
  { id: 'daily_win_1', name: 'Champion', description: 'Win 1 round', type: 'daily', target: 1, rpReward: 15, condition: { type: 'win_rounds', count: 1 } },
  { id: 'daily_ability_5', name: 'Caster', description: 'Use abilities 5 times', type: 'daily', target: 5, rpReward: 6, condition: { type: 'use_ability', count: 5 } },
];

// ── 주간 퀘스트 풀 ──
const WEEKLY_QUEST_POOL: QuestDef[] = [
  { id: 'weekly_win_3', name: 'Dominator', description: 'Win 3 rounds', type: 'weekly', target: 3, rpReward: 50, condition: { type: 'win_rounds', count: 3 } },
  { id: 'weekly_synergy_5', name: 'Build Master', description: 'Activate 5 different synergies', type: 'weekly', target: 5, rpReward: 30, condition: { type: 'activate_synergy' } },
  { id: 'weekly_kills_50', name: 'Massacre', description: 'Get 50 kills total', type: 'weekly', target: 50, rpReward: 40, condition: { type: 'kills', count: 50 } },
  { id: 'weekly_survive_10', name: 'Endurance', description: 'Survive 10 rounds', type: 'weekly', target: 10, rpReward: 35, condition: { type: 'survive_rounds', count: 10 } },
  { id: 'weekly_orbs_500', name: 'Hoarder', description: 'Collect 500 orbs', type: 'weekly', target: 500, rpReward: 30, condition: { type: 'collect_orbs', count: 500 } },
];

// ── 마일스톤 퀘스트 (1회성) ──
const MILESTONE_QUESTS: QuestDef[] = [
  { id: 'milestone_first_kill', name: 'First Blood', description: 'Get your first kill', type: 'milestone', target: 1, rpReward: 10, condition: { type: 'kills', count: 1 } },
  { id: 'milestone_first_win', name: 'First Victory', description: 'Win your first round', type: 'milestone', target: 1, rpReward: 25, condition: { type: 'win_rounds', count: 1 } },
  { id: 'milestone_level_12', name: 'Max Level', description: 'Reach level 12', type: 'milestone', target: 12, rpReward: 25, condition: { type: 'reach_level', level: 12 } },
  { id: 'milestone_hidden_synergy', name: 'Secret Discovery', description: 'Discover a hidden synergy', type: 'milestone', target: 1, rpReward: 50, condition: { type: 'activate_synergy' } },
  { id: 'milestone_kills_100', name: 'Centurion', description: 'Get 100 total kills', type: 'milestone', target: 100, rpReward: 50, condition: { type: 'kills', count: 100 } },
  { id: 'milestone_survive_25', name: 'Ironclad', description: 'Survive 25 rounds', type: 'milestone', target: 25, rpReward: 40, condition: { type: 'survive_rounds', count: 25 } },
];

// ── 플레이어 퀘스트 상태 ──
interface PlayerQuestState {
  activeQuests: Map<string, { def: QuestDef; progress: number; completed: boolean }>;
  completedMilestones: Set<string>;
  // 누적 카운터 (마일스톤 추적용)
  totalKills: number;
  totalSurvived: number;
  totalWins: number;
  totalOrbs: number;
  totalAbilityUses: number;
  uniqueSynergies: Set<string>;
  hiddenSynergies: Set<string>;
  maxLevel: number;
  // 일일/주간 로테이션 타임스탬프
  dailyRotation: number;   // Date 기준 day
  weeklyRotation: number;  // Date 기준 week
}

export class QuestSystem {
  private playerStates: Map<string, PlayerQuestState> = new Map();

  /** 플레이어 퀘스트 상태 조회 (없으면 생성) */
  private getOrCreate(playerId: string): PlayerQuestState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      state = {
        activeQuests: new Map(),
        completedMilestones: new Set(),
        totalKills: 0,
        totalSurvived: 0,
        totalWins: 0,
        totalOrbs: 0,
        totalAbilityUses: 0,
        uniqueSynergies: new Set(),
        hiddenSynergies: new Set(),
        maxLevel: 1,
        dailyRotation: 0,
        weeklyRotation: 0,
      };
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /** 일일/주간 퀘스트 자동 갱신 + 마일스톤 초기화 */
  refreshQuests(playerId: string): void {
    const state = this.getOrCreate(playerId);
    const now = Date.now();
    const currentDay = Math.floor(now / (24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now / (7 * 24 * 60 * 60 * 1000));

    // 일일 퀘스트 갱신
    if (state.dailyRotation !== currentDay) {
      state.dailyRotation = currentDay;
      // 이전 일일 퀘스트 제거
      for (const [id] of state.activeQuests) {
        const quest = state.activeQuests.get(id);
        if (quest?.def.type === 'daily') {
          state.activeQuests.delete(id);
        }
      }
      // 새 일일 퀘스트 3개 선택 (로테이션: day 기반 시드)
      const dailies = this.selectDailyQuests(currentDay);
      for (const def of dailies) {
        state.activeQuests.set(def.id, { def, progress: 0, completed: false });
      }
    }

    // 주간 퀘스트 갱신
    if (state.weeklyRotation !== currentWeek) {
      state.weeklyRotation = currentWeek;
      for (const [id] of state.activeQuests) {
        const quest = state.activeQuests.get(id);
        if (quest?.def.type === 'weekly') {
          state.activeQuests.delete(id);
        }
      }
      // 새 주간 퀘스트 2개 선택
      const weeklies = this.selectWeeklyQuests(currentWeek);
      for (const def of weeklies) {
        state.activeQuests.set(def.id, { def, progress: 0, completed: false });
      }
    }

    // 마일스톤 퀘스트 (아직 완료하지 않은 것만)
    for (const def of MILESTONE_QUESTS) {
      if (!state.completedMilestones.has(def.id) && !state.activeQuests.has(def.id)) {
        state.activeQuests.set(def.id, { def, progress: 0, completed: false });
      }
    }
  }

  /** 일일 퀘스트 3개 선택 (시드 기반 로테이션) */
  private selectDailyQuests(daySeed: number): QuestDef[] {
    const pool = [...DAILY_QUEST_POOL];
    const selected: QuestDef[] = [];
    let seed = daySeed;

    for (let i = 0; i < 3 && pool.length > 0; i++) {
      // 간단한 해시 기반 선택
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const idx = seed % pool.length;
      selected.push(pool[idx]);
      pool.splice(idx, 1);
    }

    return selected;
  }

  /** 주간 퀘스트 2개 선택 */
  private selectWeeklyQuests(weekSeed: number): QuestDef[] {
    const pool = [...WEEKLY_QUEST_POOL];
    const selected: QuestDef[] = [];
    let seed = weekSeed;

    for (let i = 0; i < 2 && pool.length > 0; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const idx = seed % pool.length;
      selected.push(pool[idx]);
      pool.splice(idx, 1);
    }

    return selected;
  }

  // ─── 게임 이벤트 추적 ───

  /** 킬 추적 */
  trackKill(playerId: string): void {
    const state = this.getOrCreate(playerId);
    state.totalKills++;
    this.updateProgress(state, 'kills');
  }

  /** 라운드 생존 추적 */
  trackSurvive(playerId: string): void {
    const state = this.getOrCreate(playerId);
    state.totalSurvived++;
    this.updateProgress(state, 'survive_rounds');
  }

  /** 라운드 우승 추적 */
  trackWin(playerId: string): void {
    const state = this.getOrCreate(playerId);
    state.totalWins++;
    this.updateProgress(state, 'win_rounds');
  }

  /** 레벨 도달 추적 */
  trackLevel(playerId: string, level: number): void {
    const state = this.getOrCreate(playerId);
    if (level > state.maxLevel) {
      state.maxLevel = level;
    }
    this.updateProgress(state, 'reach_level', level);
  }

  /** 오브 수집 추적 */
  trackOrbCollect(playerId: string, count: number = 1): void {
    const state = this.getOrCreate(playerId);
    state.totalOrbs += count;
    this.updateProgress(state, 'collect_orbs', count);
  }

  /** 시너지 활성화 추적 */
  trackSynergyActivation(playerId: string, synergyId: string, isHidden: boolean): void {
    const state = this.getOrCreate(playerId);
    state.uniqueSynergies.add(synergyId);
    if (isHidden) {
      state.hiddenSynergies.add(synergyId);
    }
    this.updateProgress(state, 'activate_synergy', 1, synergyId);
  }

  /** 어빌리티 사용 추적 */
  trackAbilityUse(playerId: string, abilityType?: string): void {
    const state = this.getOrCreate(playerId);
    state.totalAbilityUses++;
    this.updateProgress(state, 'use_ability', 1, abilityType);
  }

  /** 진행률 업데이트 (내부) */
  private updateProgress(
    state: PlayerQuestState,
    condType: string,
    value?: number,
    subtype?: string,
  ): void {
    for (const [, quest] of state.activeQuests) {
      if (quest.completed) continue;
      if (quest.def.condition.type !== condType) continue;

      // 서브타입 체크 (특정 시너지/어빌리티)
      const cond = quest.def.condition;
      if (cond.type === 'activate_synergy' && cond.synergyId && cond.synergyId !== subtype) {
        continue;
      }
      if (cond.type === 'use_ability' && cond.abilityType && cond.abilityType !== subtype) {
        continue;
      }

      // 레벨 퀘스트: max 값 기준
      if (cond.type === 'reach_level') {
        quest.progress = Math.max(quest.progress, value ?? 0);
      } else {
        // 누적 퀘스트: +1 (또는 value)
        quest.progress += (value !== undefined && condType === 'collect_orbs') ? value : 1;
      }

      // 완료 체크
      if (quest.progress >= quest.def.target) {
        quest.progress = quest.def.target;
        quest.completed = true;
        // 마일스톤이면 완료 목록에 추가
        if (quest.def.type === 'milestone') {
          state.completedMilestones.add(quest.def.id);
        }
      }
    }
  }

  /** 퀘스트 진행 상황 + 완료된 것 수집 */
  getQuestUpdate(playerId: string): QuestUpdateResult {
    const state = this.getOrCreate(playerId);
    this.refreshQuests(playerId);

    const quests: QuestProgress[] = [];
    const completedQuests: QuestProgress[] = [];
    let rpEarned = 0;

    for (const [, quest] of state.activeQuests) {
      const prog: QuestProgress = {
        questId: quest.def.id,
        current: quest.progress,
        target: quest.def.target,
        completed: quest.completed,
        rpReward: quest.def.rpReward,
      };
      quests.push(prog);
      if (quest.completed) {
        completedQuests.push(prog);
      }
    }

    return { playerId, quests, completedQuests, rpEarned };
  }

  /** 라운드 종료 시 완료 퀘스트 RP 정산 + 리셋 */
  settleRoundEnd(playerId: string): { completedQuests: QuestProgress[]; rpEarned: number } {
    const state = this.getOrCreate(playerId);
    const completedQuests: QuestProgress[] = [];
    let rpEarned = 0;

    for (const [id, quest] of state.activeQuests) {
      if (quest.completed) {
        completedQuests.push({
          questId: quest.def.id,
          current: quest.progress,
          target: quest.def.target,
          completed: true,
          rpReward: quest.def.rpReward,
        });
        rpEarned += quest.def.rpReward;

        // 완료된 일일/주간 퀘스트 제거 (마일스톤은 이미 completedMilestones에 들어감)
        if (quest.def.type !== 'milestone') {
          // 완료 상태로 유지 (갱신 시 자동 제거)
        }
      }
    }

    return { completedQuests, rpEarned };
  }

  /** 플레이어 데이터 정리 */
  removePlayer(playerId: string): void {
    // 인메모리 데이터 유지 (세션 동안)
  }
}
