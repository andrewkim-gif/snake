/**
 * resource-harvest.ts — v39 Phase 5: 자원 채취 클라이언트 시스템
 *
 * 서버에서 수신한 자원 노드/채취 상태를 처리하고,
 * 프로그레스바 UI 데이터 및 인벤토리 상태를 관리한다.
 *
 * 주요 기능:
 *   - 자동 채취: 자원 노드 근처(60px) 도달 시 자동 시작
 *   - 프로그레스바 UI 데이터 (채취 시간 3초)
 *   - 피격 캔슬: 채취 중 데미지 받으면 채취 중단
 *   - 채취 완료 → 개인 인벤토리에 추가
 *   - 사망 시 인벤토리 50% 드롭
 *   - 라운드 종료 시 잔여 자원 → 팩션 국고 자동 입금
 *
 * 순수 TypeScript 클래스 (React 의존 없음).
 */

import type {
  IResourceNode,
  IPlayerInventory,
  ResourceType,
  RoundPhase,
} from '@/lib/matrix/types/region';

// ============================================
// 상수
// ============================================

/** 자원 채취 범위 (px) */
export const GATHER_RANGE = 60;

/** 기본 채취 시간 (초) */
export const DEFAULT_GATHER_DURATION = 3.0;

/** 인벤토리 유형별 상한 */
export const INVENTORY_CAPACITY = 50;

/** PvE 사망 시 드롭 비율 */
export const PVE_DEATH_DROP_RATIO = 0.5;

/** BR 사망 시 드롭 비율 */
export const BR_DEATH_DROP_RATIO = 1.0;

/** 드롭 자원 채취 시간 (초) — 즉시 회수에 가까움 */
export const DROP_GATHER_DURATION = 0.5;

/** 자동 채취 체크 간격 (프레임 수, 20Hz 기준 5프레임 = 250ms) */
export const AUTO_GATHER_CHECK_INTERVAL = 5;

// ============================================
// 타입 정의
// ============================================

/** 채취 세션 상태 */
export type GatherState = 'idle' | 'gathering' | 'completed' | 'cancelled';

/** 채취 세션 (클라이언트 로컬 상태) */
export interface IGatherSession {
  /** 채취 대상 노드 ID */
  nodeId: string;
  /** 대상 노드의 자원 유형 */
  resourceType: string;
  /** 특산 자원 여부 */
  isSpecialty: boolean;
  /** 채취 진행도 (0.0 ~ 1.0) */
  progress: number;
  /** 총 채취 시간 (초) */
  duration: number;
  /** 경과 시간 (초) */
  elapsed: number;
  /** 채취 상태 */
  state: GatherState;
}

/** 채취 프로그레스바 UI 데이터 */
export interface IGatherProgressUI {
  /** 표시 여부 */
  visible: boolean;
  /** 진행도 (0~1) */
  progress: number;
  /** 남은 시간 (초) */
  remainingTime: number;
  /** 자원 유형 */
  resourceType: string;
  /** 특산 자원 여부 */
  isSpecialty: boolean;
  /** 노드 위치 (월드 좌표) */
  nodePosition: { x: number; y: number };
}

/** 인벤토리 변경 이벤트 */
export interface IInventoryChangeEvent {
  /** 자원 유형 */
  resourceType: string;
  /** 변경량 (+/−) */
  amount: number;
  /** 특산 자원 여부 */
  isSpecialty: boolean;
  /** 변경 소스 */
  source: 'harvest' | 'drop' | 'pickup' | 'deposit';
}

/** 자원 노드 렌더링 데이터 */
export interface IResourceNodeRenderData {
  /** 노드 ID */
  id: string;
  /** 위치 */
  position: { x: number; y: number };
  /** 자원 유형 */
  resourceType: string;
  /** 남은 양 / 최대 양 비율 (0~1) */
  fillRatio: number;
  /** 특산 자원 여부 */
  isSpecialty: boolean;
  /** 채취 가능 여부 */
  canGather: boolean;
  /** 채취 중 여부 */
  isBeingGathered: boolean;
  /** 채취 진행도 (0~1, 채취 중일 때만) */
  gatherProgress: number;
  /** 거리 (플레이어 기준, 렌더링 우선순위용) */
  distanceToPlayer: number;
}

/** 자원 유형별 표시 정보 */
export interface IResourceTypeInfo {
  /** 표시명 (한글) */
  displayName: string;
  /** 영문명 */
  displayNameEn: string;
  /** 아이콘 키 */
  iconKey: string;
  /** 색상 (HEX) */
  color: string;
}

// ============================================
// 자원 유형 표시 정보
// ============================================

/** 기본 6종 자원 + 주요 특산 자원 표시 정보 */
export const RESOURCE_TYPE_INFO: Record<string, IResourceTypeInfo> = {
  // 기본 6종
  gold: { displayName: '골드', displayNameEn: 'Gold', iconKey: 'gold', color: '#FFD700' },
  oil: { displayName: '석유', displayNameEn: 'Oil', iconKey: 'oil', color: '#333333' },
  minerals: { displayName: '광물', displayNameEn: 'Minerals', iconKey: 'minerals', color: '#A0522D' },
  food: { displayName: '식량', displayNameEn: 'Food', iconKey: 'food', color: '#32CD32' },
  tech: { displayName: '테크', displayNameEn: 'Tech', iconKey: 'tech', color: '#00CED1' },
  influence: { displayName: '영향력', displayNameEn: 'Influence', iconKey: 'influence', color: '#9370DB' },
  // 주요 특산 자원
  semiconductor: { displayName: '반도체', displayNameEn: 'Semiconductor', iconKey: 'semiconductor', color: '#4169E1' },
  automobile: { displayName: '자동차', displayNameEn: 'Automobile', iconKey: 'automobile', color: '#B22222' },
  precision_machinery: { displayName: '정밀기계', displayNameEn: 'Precision Machinery', iconKey: 'precision', color: '#708090' },
  crude_oil: { displayName: '원유', displayNameEn: 'Crude Oil', iconKey: 'crude_oil', color: '#1C1C1C' },
  rare_earth: { displayName: '희토류', displayNameEn: 'Rare Earth', iconKey: 'rare_earth', color: '#DAA520' },
  diamond: { displayName: '다이아몬드', displayNameEn: 'Diamond', iconKey: 'diamond', color: '#B9F2FF' },
  iron_ore: { displayName: '철광석', displayNameEn: 'Iron Ore', iconKey: 'iron_ore', color: '#8B4513' },
  natural_gas: { displayName: '천연가스', displayNameEn: 'Natural Gas', iconKey: 'natural_gas', color: '#87CEEB' },
  biofuel: { displayName: '바이오연료', displayNameEn: 'Biofuel', iconKey: 'biofuel', color: '#7CFC00' },
  luxury_goods: { displayName: '명품', displayNameEn: 'Luxury Goods', iconKey: 'luxury', color: '#FF69B4' },
  finance: { displayName: '금융', displayNameEn: 'Finance', iconKey: 'finance', color: '#228B22' },
  spices: { displayName: '향신료', displayNameEn: 'Spices', iconKey: 'spices', color: '#FF4500' },
};

/** 자원 유형 정보 조회 (없으면 기본값) */
export function getResourceTypeInfo(type_: string): IResourceTypeInfo {
  return RESOURCE_TYPE_INFO[type_] ?? {
    displayName: type_,
    displayNameEn: type_,
    iconKey: 'generic',
    color: '#AAAAAA',
  };
}

// ============================================
// ResourceHarvestSystem 클래스
// ============================================

/**
 * ResourceHarvestSystem — 자원 채취 클라이언트 시스템
 *
 * 서버에서 수신한 자원 노드 상태를 관리하고,
 * 클라이언트 예측 기반 채취 세션을 처리한다.
 *
 * 사용처:
 *   - MatrixApp.tsx에서 인스턴스 생성 → useRef로 보관
 *   - 서버 state 수신 시 updateNodes() 호출
 *   - useFrame에서 tick() 호출 → 자동 채취 체크 + 프로그레스 업데이트
 *   - HUD에서 getProgressUI() / getInventorySnapshot() 호출
 */
export class ResourceHarvestSystem {
  // ─── 자원 노드 상태 ───
  private _nodes: Map<string, IResourceNode> = new Map();

  // ─── 채취 세션 ───
  private _session: IGatherSession | null = null;

  // ─── 인벤토리 ───
  private _inventory: IPlayerInventory = createEmptyInventory();

  // ─── 타이밍 ───
  private _tickCount: number = 0;

  // ─── 이벤트 콜백 ───
  private _onGatherStart?: (nodeId: string) => void;
  private _onGatherComplete?: (event: IInventoryChangeEvent) => void;
  private _onGatherCancel?: (nodeId: string) => void;
  private _onInventoryChange?: (event: IInventoryChangeEvent) => void;

  // ─── 지역 효과 배율 ───
  private _gatherRateMultiplier: number = 1.0;

  // ============================================
  // 초기화 / 리셋
  // ============================================

  constructor(gatherRateMultiplier: number = 1.0) {
    this._gatherRateMultiplier = gatherRateMultiplier;
  }

  /** 라운드 시작 시 리셋 */
  reset(): void {
    this._nodes.clear();
    this._session = null;
    this._inventory = createEmptyInventory();
    this._tickCount = 0;
  }

  // ============================================
  // 서버 상태 동기화
  // ============================================

  /** 서버에서 수신한 자원 노드 목록으로 갱신 */
  updateNodes(nodes: IResourceNode[]): void {
    this._nodes.clear();
    for (const node of nodes) {
      this._nodes.set(node.id, { ...node });
    }
  }

  /** 서버에서 수신한 인벤토리 상태로 갱신 (서버 권위) */
  syncInventory(serverInventory: IPlayerInventory): void {
    this._inventory = {
      basic: { ...serverInventory.basic },
      specialty: { ...serverInventory.specialty },
      capacity: serverInventory.capacity,
    };
  }

  /** 서버에서 수신한 채취 세션 상태 동기화 */
  syncGatherSession(serverSession: {
    nodeId: string;
    progress: number;
    duration: number;
    elapsed: number;
    completed: boolean;
    cancelled: boolean;
  } | null): void {
    if (!serverSession) {
      if (this._session && this._session.state === 'gathering') {
        this._session.state = 'cancelled';
        if (this._onGatherCancel) {
          this._onGatherCancel(this._session.nodeId);
        }
      }
      this._session = null;
      return;
    }

    const node = this._nodes.get(serverSession.nodeId);

    if (serverSession.completed) {
      if (this._session) {
        this._session.state = 'completed';
        this._session.progress = 1.0;
      }
      this._session = null;
      return;
    }

    if (serverSession.cancelled) {
      if (this._session) {
        this._session.state = 'cancelled';
      }
      this._session = null;
      return;
    }

    // 서버 상태 동기화 (클라이언트 예측 보정)
    if (!this._session || this._session.nodeId !== serverSession.nodeId) {
      this._session = {
        nodeId: serverSession.nodeId,
        resourceType: node?.resourceType ?? 'unknown',
        isSpecialty: node?.isSpecialty ?? false,
        progress: serverSession.progress,
        duration: serverSession.duration,
        elapsed: serverSession.elapsed,
        state: 'gathering',
      };
    } else {
      // 보정: 서버 진행도와 차이가 크면 서버 값 채택
      const diff = Math.abs(this._session.progress - serverSession.progress);
      if (diff > 0.1) {
        this._session.progress = serverSession.progress;
        this._session.elapsed = serverSession.elapsed;
      }
    }
  }

  // ============================================
  // 틱 업데이트
  // ============================================

  /**
   * 매 프레임(tick) 호출 — 채취 진행 + 자동 채취 체크
   * @param dt 경과 시간 (초)
   * @param playerPos 플레이어 위치
   * @param phase 현재 라운드 페이즈
   */
  tick(
    dt: number,
    playerPos: { x: number; y: number },
    phase: RoundPhase,
  ): void {
    this._tickCount++;

    // BR/Settlement 페이즈에서는 채취 불가 → 진행 중 세션 취소
    if (phase !== 'pve') {
      if (this._session && this._session.state === 'gathering') {
        this._session.state = 'cancelled';
        if (this._onGatherCancel) {
          this._onGatherCancel(this._session.nodeId);
        }
        this._session = null;
      }
      return;
    }

    // 채취 진행 업데이트 (클라이언트 예측)
    if (this._session && this._session.state === 'gathering') {
      this._session.elapsed += dt;
      this._session.progress = Math.min(
        this._session.elapsed / this._session.duration,
        1.0,
      );

      // 채취 완료 (클라이언트 예측 — 서버 확인 후 실제 반영)
      if (this._session.progress >= 1.0) {
        this._session.state = 'completed';

        // 클라이언트 예측: 인벤토리에 추가
        const event: IInventoryChangeEvent = {
          resourceType: this._session.resourceType,
          amount: 1,
          isSpecialty: this._session.isSpecialty,
          source: 'harvest',
        };
        this.addToInventory(
          this._session.resourceType,
          1,
          this._session.isSpecialty,
        );

        if (this._onGatherComplete) {
          this._onGatherComplete(event);
        }
        if (this._onInventoryChange) {
          this._onInventoryChange(event);
        }

        this._session = null;
      }

      // 노드 범위 이탈 체크 (거리 > GATHER_RANGE * 1.5이면 취소)
      if (this._session) {
        const node = this._nodes.get(this._session.nodeId);
        if (node) {
          const dx = playerPos.x - node.position.x;
          const dy = playerPos.y - node.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > GATHER_RANGE * 1.5) {
            this._session.state = 'cancelled';
            if (this._onGatherCancel) {
              this._onGatherCancel(this._session.nodeId);
            }
            this._session = null;
          }
        }
      }

      return; // 채취 중에는 자동 채취 체크 안 함
    }

    // 자동 채취 체크 (AUTO_GATHER_CHECK_INTERVAL 프레임마다)
    if (this._tickCount % AUTO_GATHER_CHECK_INTERVAL === 0) {
      this.tryAutoGather(playerPos);
    }
  }

  // ============================================
  // 자동 채취
  // ============================================

  /** 가장 가까운 활성 노드로 자동 채취 시도 */
  private tryAutoGather(playerPos: { x: number; y: number }): void {
    if (this._session) return;

    let closestNode: IResourceNode | null = null;
    let minDist = Infinity;

    for (const node of this._nodes.values()) {
      if (node.amount <= 0) continue;

      const dx = playerPos.x - node.position.x;
      const dy = playerPos.y - node.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= GATHER_RANGE && dist < minDist) {
        minDist = dist;
        closestNode = node;
      }
    }

    if (!closestNode) return;

    // 채취 시작 (클라이언트 예측)
    const duration = DEFAULT_GATHER_DURATION / this._gatherRateMultiplier;
    this._session = {
      nodeId: closestNode.id,
      resourceType: closestNode.resourceType,
      isSpecialty: closestNode.isSpecialty,
      progress: 0,
      duration: Math.max(duration, 0.5),
      elapsed: 0,
      state: 'gathering',
    };

    if (this._onGatherStart) {
      this._onGatherStart(closestNode.id);
    }
  }

  // ============================================
  // 피격 캔슬
  // ============================================

  /** 피격 시 채취 취소 */
  cancelGatherOnDamage(): void {
    if (!this._session || this._session.state !== 'gathering') return;

    this._session.state = 'cancelled';
    if (this._onGatherCancel) {
      this._onGatherCancel(this._session.nodeId);
    }
    this._session = null;
  }

  // ============================================
  // 인벤토리 관리
  // ============================================

  /** 인벤토리에 자원 추가 (capacity 체크) */
  private addToInventory(
    resourceType: string,
    amount: number,
    isSpecialty: boolean,
  ): number {
    const inv = this._inventory;
    const cap = inv.capacity;

    if (isSpecialty) {
      const current = inv.specialty[resourceType] ?? 0;
      const space = cap - current;
      if (space <= 0) return 0;
      const actual = Math.min(amount, space);
      inv.specialty[resourceType] = current + actual;
      return actual;
    }

    // 기본 6종 자원
    const key = resourceType as keyof IPlayerInventory['basic'];
    if (key in inv.basic) {
      const current = inv.basic[key];
      const space = cap - current;
      if (space <= 0) return 0;
      const actual = Math.min(amount, space);
      (inv.basic as Record<string, number>)[key] = current + actual;
      return actual;
    }

    // 알 수 없는 타입은 특산 자원으로 처리
    const current = inv.specialty[resourceType] ?? 0;
    const space = cap - current;
    if (space <= 0) return 0;
    const actual = Math.min(amount, space);
    inv.specialty[resourceType] = current + actual;
    return actual;
  }

  /** 사망 시 인벤토리 페널티 적용 */
  applyDeathPenalty(isBR: boolean): IPlayerInventory {
    const ratio = isBR ? BR_DEATH_DROP_RATIO : PVE_DEATH_DROP_RATIO;
    const dropped = createEmptyInventory();

    // 기본 자원
    const basicKeys: (keyof IPlayerInventory['basic'])[] = [
      'gold', 'oil', 'minerals', 'food', 'tech', 'influence',
    ];
    for (const key of basicKeys) {
      const amount = this._inventory.basic[key];
      const dropAmount = Math.floor(amount * ratio);
      dropped.basic[key] = dropAmount;
      (this._inventory.basic as Record<string, number>)[key] = amount - dropAmount;
    }

    // 특산 자원
    for (const [type_, amount] of Object.entries(this._inventory.specialty)) {
      const dropAmount = Math.floor(amount * ratio);
      if (dropAmount > 0) {
        dropped.specialty[type_] = dropAmount;
        this._inventory.specialty[type_] = amount - dropAmount;
      }
    }

    return dropped;
  }

  /** 라운드 종료 시 잔여 자원 팩션 국고 입금 → 인벤토리 반환 후 초기화 */
  depositToTreasury(): IPlayerInventory {
    const deposited: IPlayerInventory = {
      basic: { ...this._inventory.basic },
      specialty: { ...this._inventory.specialty },
      capacity: this._inventory.capacity,
    };

    // 인벤토리 초기화
    this._inventory = createEmptyInventory();

    return deposited;
  }

  // ============================================
  // UI 데이터 조회
  // ============================================

  /** 채취 프로그레스바 UI 데이터 */
  getProgressUI(): IGatherProgressUI {
    if (!this._session || this._session.state !== 'gathering') {
      return {
        visible: false,
        progress: 0,
        remainingTime: 0,
        resourceType: '',
        isSpecialty: false,
        nodePosition: { x: 0, y: 0 },
      };
    }

    const node = this._nodes.get(this._session.nodeId);
    return {
      visible: true,
      progress: this._session.progress,
      remainingTime: Math.max(
        this._session.duration - this._session.elapsed,
        0,
      ),
      resourceType: this._session.resourceType,
      isSpecialty: this._session.isSpecialty,
      nodePosition: node
        ? { x: node.position.x, y: node.position.y }
        : { x: 0, y: 0 },
    };
  }

  /** 인벤토리 스냅샷 (UI 표시용) */
  getInventorySnapshot(): IPlayerInventory {
    return {
      basic: { ...this._inventory.basic },
      specialty: { ...this._inventory.specialty },
      capacity: this._inventory.capacity,
    };
  }

  /** 자원 노드 렌더링 데이터 목록 */
  getNodeRenderData(
    playerPos: { x: number; y: number },
  ): IResourceNodeRenderData[] {
    const result: IResourceNodeRenderData[] = [];

    for (const node of this._nodes.values()) {
      const dx = playerPos.x - node.position.x;
      const dy = playerPos.y - node.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const isBeingGathered =
        this._session?.nodeId === node.id &&
        this._session?.state === 'gathering';

      result.push({
        id: node.id,
        position: { ...node.position },
        resourceType: node.resourceType,
        fillRatio: node.maxAmount > 0 ? node.amount / node.maxAmount : 0,
        isSpecialty: node.isSpecialty,
        canGather: node.amount > 0 && dist <= GATHER_RANGE && !isBeingGathered,
        isBeingGathered,
        gatherProgress: isBeingGathered ? (this._session?.progress ?? 0) : 0,
        distanceToPlayer: dist,
      });
    }

    // 거리순 정렬 (가까운 것 먼저)
    result.sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);
    return result;
  }

  /** 인벤토리 총 자원량 */
  getTotalResourceCount(): number {
    const basic = this._inventory.basic;
    let total =
      basic.gold + basic.oil + basic.minerals +
      basic.food + basic.tech + basic.influence;

    for (const amount of Object.values(this._inventory.specialty)) {
      total += amount;
    }

    return total;
  }

  /** 특정 자원의 현재 보유량 */
  getResourceCount(resourceType: string): number {
    const key = resourceType as keyof IPlayerInventory['basic'];
    if (key in this._inventory.basic) {
      return this._inventory.basic[key];
    }
    return this._inventory.specialty[resourceType] ?? 0;
  }

  /** 현재 채취 중인지 여부 */
  isGathering(): boolean {
    return this._session?.state === 'gathering';
  }

  /** 현재 채취 세션 (읽기 전용) */
  get currentSession(): Readonly<IGatherSession> | null {
    return this._session;
  }

  /** 노드 수 */
  get nodeCount(): number {
    return this._nodes.size;
  }

  // ============================================
  // 콜백 등록
  // ============================================

  setOnGatherStart(fn: (nodeId: string) => void): void {
    this._onGatherStart = fn;
  }

  setOnGatherComplete(fn: (event: IInventoryChangeEvent) => void): void {
    this._onGatherComplete = fn;
  }

  setOnGatherCancel(fn: (nodeId: string) => void): void {
    this._onGatherCancel = fn;
  }

  setOnInventoryChange(fn: (event: IInventoryChangeEvent) => void): void {
    this._onInventoryChange = fn;
  }

  // ============================================
  // 지역 효과 설정
  // ============================================

  /** 채취 속도 배율 설정 (지역 효과) */
  setGatherRateMultiplier(mult: number): void {
    this._gatherRateMultiplier = Math.max(mult, 0.1);
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/** 빈 인벤토리 생성 */
export function createEmptyInventory(): IPlayerInventory {
  return {
    basic: {
      gold: 0,
      oil: 0,
      minerals: 0,
      food: 0,
      tech: 0,
      influence: 0,
    },
    specialty: {},
    capacity: INVENTORY_CAPACITY,
  };
}

/** 인벤토리 합산 (두 인벤토리 병합) */
export function mergeInventories(
  target: IPlayerInventory,
  source: IPlayerInventory,
): IPlayerInventory {
  const result: IPlayerInventory = {
    basic: {
      gold: Math.min(target.basic.gold + source.basic.gold, target.capacity),
      oil: Math.min(target.basic.oil + source.basic.oil, target.capacity),
      minerals: Math.min(target.basic.minerals + source.basic.minerals, target.capacity),
      food: Math.min(target.basic.food + source.basic.food, target.capacity),
      tech: Math.min(target.basic.tech + source.basic.tech, target.capacity),
      influence: Math.min(target.basic.influence + source.basic.influence, target.capacity),
    },
    specialty: { ...target.specialty },
    capacity: target.capacity,
  };

  for (const [type_, amount] of Object.entries(source.specialty)) {
    const current = result.specialty[type_] ?? 0;
    result.specialty[type_] = Math.min(current + amount, target.capacity);
  }

  return result;
}

/** 인벤토리가 비어있는지 확인 */
export function isInventoryEmpty(inv: IPlayerInventory): boolean {
  const b = inv.basic;
  if (b.gold + b.oil + b.minerals + b.food + b.tech + b.influence > 0) {
    return false;
  }
  for (const amount of Object.values(inv.specialty)) {
    if (amount > 0) return false;
  }
  return true;
}

/** 인벤토리를 문자열 요약으로 변환 (디버그/로그용) */
export function inventorySummary(inv: IPlayerInventory): string {
  const parts: string[] = [];
  const b = inv.basic;
  if (b.gold > 0) parts.push(`Gold:${b.gold}`);
  if (b.oil > 0) parts.push(`Oil:${b.oil}`);
  if (b.minerals > 0) parts.push(`Min:${b.minerals}`);
  if (b.food > 0) parts.push(`Food:${b.food}`);
  if (b.tech > 0) parts.push(`Tech:${b.tech}`);
  if (b.influence > 0) parts.push(`Inf:${b.influence}`);

  for (const [type_, amount] of Object.entries(inv.specialty)) {
    if (amount > 0) parts.push(`${type_}:${amount}`);
  }

  return parts.length > 0 ? parts.join(', ') : '(empty)';
}
