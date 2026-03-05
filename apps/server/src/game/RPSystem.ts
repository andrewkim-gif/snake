/**
 * RPSystem.ts — 메타 프로그레션 시스템 (Reputation Points)
 *
 * RP 획득 규칙:
 * - 라운드 끝까지 생존: +10 RP
 * - 라운드 우승 (#1): +50 RP
 * - 킬당: +5 RP
 * - 도달 레벨당: +3 RP
 * - 첫 시너지 활성화: +15 RP
 * - 히든 시너지 발견: +25 RP
 *
 * RP 잠금해제: 코스메틱 진행 (스킨 슬롯, 칭호, 트레일 이펙트, 어빌리티 슬롯, 이모트)
 */

// ── RP 보상 상수 ──
export const RP_REWARDS = {
  SURVIVE_ROUND: 10,
  WIN_ROUND: 50,
  PER_KILL: 5,
  PER_LEVEL: 3,
  FIRST_SYNERGY: 15,
  HIDDEN_SYNERGY: 25,
} as const;

// ── RP 잠금해제 타입 ──
export type RPUnlockType = 'skin_slot' | 'title' | 'trail_effect' | 'ability_slot' | 'emote';

export interface RPUnlock {
  id: string;
  name: string;
  rpCost: number;
  type: RPUnlockType;
  description: string;
}

// ── RP 잠금해제 카탈로그 ──
export const RP_UNLOCKS: RPUnlock[] = [
  { id: 'trail_sparkle', name: 'Sparkle Trail', rpCost: 50, type: 'trail_effect', description: 'Sparkle particles when moving' },
  { id: 'title_rookie', name: 'Rookie Title', rpCost: 100, type: 'title', description: '"Rookie" title under your name' },
  { id: 'emote_wave', name: 'Wave Emote', rpCost: 150, type: 'emote', description: 'Wave at other agents' },
  { id: 'skin_slot_2', name: '2nd Skin Slot', rpCost: 300, type: 'skin_slot', description: 'Unlock 2nd skin preset slot' },
  { id: 'ability_slot_3', name: '3rd Ability Slot', rpCost: 500, type: 'ability_slot', description: 'Unlock 3rd ability slot' },
  { id: 'title_veteran', name: 'Veteran Title', rpCost: 1000, type: 'title', description: '"Veteran" title' },
  { id: 'emote_taunt', name: 'Taunt Emote', rpCost: 1500, type: 'emote', description: 'Taunt emote animation' },
  { id: 'trail_fire', name: 'Fire Trail', rpCost: 2000, type: 'trail_effect', description: 'Fire particles trail' },
  { id: 'skin_slot_3', name: '3rd Skin Slot', rpCost: 3000, type: 'skin_slot', description: 'Unlock 3rd skin preset slot' },
  { id: 'title_legend', name: 'Legend Title', rpCost: 5000, type: 'title', description: '"Legend" title with gold glow' },
];

// ── 플레이어 RP 데이터 ──
export interface PlayerRPData {
  totalRP: number;
  unlockedItems: string[];       // 잠금해제된 아이템 ID 목록
  roundSynergiesActivated: Set<string>;  // 현재 라운드에서 활성화한 시너지
  hadFirstSynergy: boolean;      // 처음으로 시너지를 활성화했는지
}

// ── 라운드 종료 성과 ──
export interface RoundPerformance {
  playerId: string;
  kills: number;
  level: number;
  isAlive: boolean;               // 라운드 끝까지 생존?
  isWinner: boolean;              // 1위?
  synergiesActivated: string[];   // 활성화된 시너지 ID 목록
}

// ── RP 업데이트 결과 ──
export interface RPAwardResult {
  playerId: string;
  rpEarned: number;
  newTotal: number;
  newUnlocks: RPUnlock[];          // 이번에 새로 잠금해제된 아이템
  breakdown: Record<string, number>; // 세부 항목별 RP
}

export class RPSystem {
  // playerId → RP 데이터 (인메모리)
  private playerData: Map<string, PlayerRPData> = new Map();

  /** 플레이어 RP 데이터 조회 (없으면 생성) */
  getOrCreate(playerId: string): PlayerRPData {
    let data = this.playerData.get(playerId);
    if (!data) {
      data = {
        totalRP: 0,
        unlockedItems: [],
        roundSynergiesActivated: new Set(),
        hadFirstSynergy: false,
      };
      this.playerData.set(playerId, data);
    }
    return data;
  }

  /** 플레이어 RP 조회 */
  getPlayerRP(playerId: string): number {
    return this.getOrCreate(playerId).totalRP;
  }

  /** 플레이어 잠금해제 목록 조회 */
  getPlayerUnlocks(playerId: string): string[] {
    return this.getOrCreate(playerId).unlockedItems;
  }

  /** 시너지 활성화 추적 (게임 중 호출) */
  trackSynergyActivation(playerId: string, synergyId: string, isHidden: boolean): number {
    const data = this.getOrCreate(playerId);
    let rpEarned = 0;

    // 첫 시너지 보너스 (라운드 기준)
    if (data.roundSynergiesActivated.size === 0 && !data.hadFirstSynergy) {
      rpEarned += RP_REWARDS.FIRST_SYNERGY;
      data.hadFirstSynergy = true;
    }

    // 히든 시너지 발견 보너스
    if (isHidden && !data.roundSynergiesActivated.has(synergyId)) {
      rpEarned += RP_REWARDS.HIDDEN_SYNERGY;
    }

    data.roundSynergiesActivated.add(synergyId);

    if (rpEarned > 0) {
      data.totalRP += rpEarned;
    }

    return rpEarned;
  }

  /** 라운드 종료 시 RP 정산 */
  awardRoundEnd(performances: RoundPerformance[]): RPAwardResult[] {
    const results: RPAwardResult[] = [];

    for (const perf of performances) {
      const data = this.getOrCreate(perf.playerId);
      const breakdown: Record<string, number> = {};
      let rpEarned = 0;

      // 생존 보너스
      if (perf.isAlive) {
        breakdown['survive'] = RP_REWARDS.SURVIVE_ROUND;
        rpEarned += RP_REWARDS.SURVIVE_ROUND;
      }

      // 우승 보너스
      if (perf.isWinner) {
        breakdown['win'] = RP_REWARDS.WIN_ROUND;
        rpEarned += RP_REWARDS.WIN_ROUND;
      }

      // 킬 보너스
      if (perf.kills > 0) {
        const killRP = perf.kills * RP_REWARDS.PER_KILL;
        breakdown['kills'] = killRP;
        rpEarned += killRP;
      }

      // 레벨 보너스
      if (perf.level > 1) {
        const levelRP = perf.level * RP_REWARDS.PER_LEVEL;
        breakdown['levels'] = levelRP;
        rpEarned += levelRP;
      }

      data.totalRP += rpEarned;

      // 새로 잠금해제된 아이템 체크
      const newUnlocks = this.checkNewUnlocks(perf.playerId);

      results.push({
        playerId: perf.playerId,
        rpEarned,
        newTotal: data.totalRP,
        newUnlocks,
        breakdown,
      });

      // 라운드 초기화
      data.roundSynergiesActivated.clear();
    }

    return results;
  }

  /** 잠금해제 가능한 새 아이템 체크 + 자동 잠금해제 */
  private checkNewUnlocks(playerId: string): RPUnlock[] {
    const data = this.getOrCreate(playerId);
    const newUnlocks: RPUnlock[] = [];

    for (const unlock of RP_UNLOCKS) {
      if (data.unlockedItems.includes(unlock.id)) continue;
      if (data.totalRP >= unlock.rpCost) {
        data.unlockedItems.push(unlock.id);
        newUnlocks.push(unlock);
      }
    }

    return newUnlocks;
  }

  /** 수동 잠금해제 (RP 소비) */
  purchaseUnlock(playerId: string, unlockId: string): boolean {
    const data = this.getOrCreate(playerId);
    const unlock = RP_UNLOCKS.find(u => u.id === unlockId);
    if (!unlock) return false;
    if (data.unlockedItems.includes(unlockId)) return false;
    if (data.totalRP < unlock.rpCost) return false;

    // RP는 소비하지 않음 (누적 RP 기준 잠금해제)
    data.unlockedItems.push(unlockId);
    return true;
  }

  /** 플레이어 데이터 정리 */
  removePlayer(playerId: string): void {
    // RP 데이터는 세션 간 유지 (인메모리이므로 서버 재시작 시 리셋)
    // 필요시 여기서 정리 가능
  }

  /** 전체 플레이어 수 */
  getPlayerCount(): number {
    return this.playerData.size;
  }
}
