'use client';

/**
 * useTycoonSocket — 타이쿤 서버 통신 훅
 *
 * 기존 GameSocket ({e, d} JSON 프레임)을 받아서
 * World War Tycoon 전용 이벤트 인터페이스를 제공한다.
 *
 * Uplink (클라이언트 → 서버):
 *   building_purchase, building_bid, attack_order, unit_produce,
 *   defense_build, merge_request, trade_order, alliance_action,
 *   war_declare, city_subscribe_tycoon, city_unsubscribe_tycoon,
 *   income_collect
 *
 * Downlink (서버 → 클라이언트):
 *   territory_update, building_update, auction_update,
 *   battle_start, battle_result, army_march, army_arrival,
 *   income_settled, trade_match, war_update, alliance_update,
 *   global_news, under_attack, tycoon_error
 *
 * server/internal/ws/protocol.go와 이벤트명 동기화
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSocket } from './useWebSocket';

// ─── Client → Server 이벤트명 ───

const TYCOON_EVENTS = {
  BUILDING_PURCHASE: 'building_purchase',
  BUILDING_BID: 'building_bid',
  ATTACK_ORDER: 'attack_order',
  UNIT_PRODUCE: 'unit_produce',
  DEFENSE_BUILD: 'defense_build',
  MERGE_REQUEST: 'merge_request',
  TRADE_ORDER: 'trade_order',
  ALLIANCE_ACTION: 'alliance_action',
  WAR_DECLARE: 'war_declare',
  CITY_SUBSCRIBE: 'city_subscribe_tycoon',
  CITY_UNSUBSCRIBE: 'city_unsubscribe_tycoon',
  INCOME_COLLECT: 'income_collect',
} as const;

// ─── Server → Client 이벤트명 ───

const TYCOON_SERVER_EVENTS = {
  TERRITORY_UPDATE: 'territory_update',
  BUILDING_UPDATE: 'building_update',
  AUCTION_UPDATE: 'auction_update',
  BATTLE_START: 'battle_start',
  BATTLE_RESULT: 'battle_result',
  ARMY_MARCH: 'army_march',
  ARMY_ARRIVAL: 'army_arrival',
  INCOME_SETTLED: 'income_settled',
  TRADE_MATCH: 'trade_match',
  WAR_UPDATE: 'war_update',
  ALLIANCE_UPDATE: 'alliance_update',
  GLOBAL_NEWS: 'global_news',
  UNDER_ATTACK: 'under_attack',
  TYCOON_ERROR: 'tycoon_error',
} as const;

// ─── 최대 보관 개수 ───
const MAX_ALERTS = 10;
const MAX_NEWS = 50;

// ─── Server → Client 페이로드 인터페이스 ───

/** 개별 지역 영토 데이터 (protocol.go RegionTerritoryPayload 동기화) */
export interface ITerritoryRegion {
  region_code: string;
  controller_id?: string;
  controller_name?: string;
  control_pct: number;
  sovereignty_level: string;
}

/** territory_update 페이로드 */
export interface ITerritoryUpdate {
  regions: ITerritoryRegion[];
}

/** building_update 페이로드 */
export interface IBuildingUpdate {
  building_id: string;
  owner_id?: string;
  owner_name?: string;
  is_auctioning: boolean;
  level: number;
}

/** auction_update 페이로드 */
export interface IAuctionUpdate {
  auction_id: string;
  building_id: string;
  current_bid: number;
  bidder_id?: string;
  bidder_name?: string;
  ends_at: number;
}

/** battle_start 페이로드 */
export interface IBattleStart {
  battle_id: string;
  attacker_id: string;
  defender_id: string;
  target_region: string;
}

/** battle_result 페이로드 (protocol.go BattleResultPayload 동기화) */
export interface IBattleResult {
  battle_id: string;
  attacker_id: string;
  defender_id: string;
  target_region: string;
  result: 'attacker_win' | 'defender_win' | 'draw';
  mc_looted: number;
  buildings_captured: string[];
  has_replay: boolean;
}

/** army_march 페이로드 (protocol.go ArmyMarchPayload 동기화) */
export interface IArmyMarch {
  army_id: string;
  owner_id: string;
  from_region: string;
  to_region: string;
  unit_type: string;
  count: number;
  arrival_at: number;
}

/** army_arrival 페이로드 */
export interface IArmyArrival {
  army_id: string;
  region: string;
}

/** income_settled 페이로드 (protocol.go IncomeSettledPayload 동기화) */
export interface IIncomeSettled {
  total_earned: number;
  building_count: number;
  new_balance: number;
}

/** trade_match 페이로드 */
export interface ITradeMatch {
  building_id: string;
  seller_id: string;
  buyer_id: string;
  price: number;
}

/** war_update 페이로드 */
export interface IWarUpdate {
  war_id: string;
  attacker_nation: string;
  defender_nation: string;
  status: string;
  score?: Record<string, number>;
}

/** alliance_update 페이로드 */
export interface IAllianceUpdate {
  alliance_id: string;
  name: string;
  action: string;
  members: string[];
}

/** under_attack 페이로드 (protocol.go UnderAttackPayload 동기화) */
export interface IUnderAttack {
  attacker_id: string;
  attacker_name: string;
  target_region: string;
  arrival_at: number;
  unit_count: number;
}

/** global_news 페이로드 (protocol.go GlobalNewsPayload 동기화) */
export interface IGlobalNews {
  type: string;
  message: string;
  data?: Record<string, unknown>;
  /** 클라이언트 수신 시각 (자동 부여) */
  _receivedAt: number;
}

/** tycoon_error 페이로드 (protocol.go TycoonErrorPayload 동기화) */
export interface ITycoonError {
  code: string;
  message: string;
}

// ─── 훅 반환 타입 ───

export interface IUseTycoonSocket {
  // 상태
  territories: ITerritoryRegion[];
  latestBattle: IBattleResult | null;
  latestIncome: IIncomeSettled | null;
  alerts: IUnderAttack[];
  news: IGlobalNews[];
  tycoonError: ITycoonError | null;

  // 액션 (Client → Server)
  purchaseBuilding: (buildingId: string) => void;
  placeBid: (auctionId: string, amount: number) => void;
  attackOrder: (armyIds: string[], targetRegion: string) => void;
  produceUnits: (unitType: string, count: number, region: string) => void;
  buildDefense: (buildingId: string, defenseType: string) => void;
  mergeRequest: (buildingIds: string[]) => void;
  tradeOrder: (buildingId: string, orderType: 'sell' | 'buy', price: number) => void;
  allianceAction: (action: string, opts?: { allianceId?: string; targetId?: string; name?: string }) => void;
  declareWar: (targetNation: string, coalition?: string[]) => void;
  collectIncome: () => void;
  subscribeCity: (cityCode: string) => void;
  unsubscribeCity: (cityCode: string) => void;

  // 이벤트 콜백 등록용 (선택적 — 외부 리스너)
  onBuildingUpdate: React.MutableRefObject<((data: IBuildingUpdate) => void) | null>;
  onAuctionUpdate: React.MutableRefObject<((data: IAuctionUpdate) => void) | null>;
  onBattleStart: React.MutableRefObject<((data: IBattleStart) => void) | null>;
  onArmyMarch: React.MutableRefObject<((data: IArmyMarch) => void) | null>;
  onArmyArrival: React.MutableRefObject<((data: IArmyArrival) => void) | null>;
  onTradeMatch: React.MutableRefObject<((data: ITradeMatch) => void) | null>;
  onWarUpdate: React.MutableRefObject<((data: IWarUpdate) => void) | null>;
  onAllianceUpdate: React.MutableRefObject<((data: IAllianceUpdate) => void) | null>;
}

// ─── 훅 구현 ───

/**
 * useTycoonSocket — 기존 GameSocket을 받아 타이쿬 전용 이벤트를 처리
 *
 * @param socket - GameSocket 인스턴스 (null이면 모든 send는 no-op)
 */
export function useTycoonSocket(socket: GameSocket | null): IUseTycoonSocket {
  // ─── 다운링크 상태 ───
  const [territories, setTerritories] = useState<ITerritoryRegion[]>([]);
  const [latestBattle, setLatestBattle] = useState<IBattleResult | null>(null);
  const [latestIncome, setLatestIncome] = useState<IIncomeSettled | null>(null);
  const [alerts, setAlerts] = useState<IUnderAttack[]>([]);
  const [news, setNews] = useState<IGlobalNews[]>([]);
  const [tycoonError, setTycoonError] = useState<ITycoonError | null>(null);

  // ─── 외부 이벤트 콜백 ref ───
  const onBuildingUpdate = useRef<((data: IBuildingUpdate) => void) | null>(null);
  const onAuctionUpdate = useRef<((data: IAuctionUpdate) => void) | null>(null);
  const onBattleStart = useRef<((data: IBattleStart) => void) | null>(null);
  const onArmyMarch = useRef<((data: IArmyMarch) => void) | null>(null);
  const onArmyArrival = useRef<((data: IArmyArrival) => void) | null>(null);
  const onTradeMatch = useRef<((data: ITradeMatch) => void) | null>(null);
  const onWarUpdate = useRef<((data: IWarUpdate) => void) | null>(null);
  const onAllianceUpdate = useRef<((data: IAllianceUpdate) => void) | null>(null);

  // ─── 다운링크 리스너 등록/해제 ───
  useEffect(() => {
    if (!socket) return;

    // territory_update — 영토 상태 (1Hz)
    const handleTerritoryUpdate = (data: ITerritoryUpdate) => {
      setTerritories(data.regions);
    };

    // building_update — 건물 소유권/상태 변경
    const handleBuildingUpdate = (data: IBuildingUpdate) => {
      onBuildingUpdate.current?.(data);
    };

    // auction_update — 경매 상태
    const handleAuctionUpdate = (data: IAuctionUpdate) => {
      onAuctionUpdate.current?.(data);
    };

    // battle_start — 전투 시작
    const handleBattleStart = (data: IBattleStart) => {
      onBattleStart.current?.(data);
    };

    // battle_result — 전투 결과
    const handleBattleResult = (data: IBattleResult) => {
      setLatestBattle(data);
    };

    // army_march — 군대 이동 (Globe 표시용)
    const handleArmyMarch = (data: IArmyMarch) => {
      onArmyMarch.current?.(data);
    };

    // army_arrival — 군대 도착
    const handleArmyArrival = (data: IArmyArrival) => {
      onArmyArrival.current?.(data);
    };

    // income_settled — 수익 정산
    const handleIncomeSettled = (data: IIncomeSettled) => {
      setLatestIncome(data);
    };

    // trade_match — 거래 체결
    const handleTradeMatch = (data: ITradeMatch) => {
      onTradeMatch.current?.(data);
    };

    // war_update — 전쟁 상태
    const handleWarUpdate = (data: IWarUpdate) => {
      onWarUpdate.current?.(data);
    };

    // alliance_update — 동맹 상태
    const handleAllianceUpdate = (data: IAllianceUpdate) => {
      onAllianceUpdate.current?.(data);
    };

    // global_news — 글로벌 뉴스 (FIFO, 최대 MAX_NEWS)
    const handleGlobalNews = (data: Omit<IGlobalNews, '_receivedAt'>) => {
      const newsItem: IGlobalNews = { ...data, _receivedAt: Date.now() };
      setNews((prev) => {
        const next = [newsItem, ...prev];
        return next.length > MAX_NEWS ? next.slice(0, MAX_NEWS) : next;
      });
    };

    // under_attack — 공격 알림 (FIFO, 최대 MAX_ALERTS)
    const handleUnderAttack = (data: IUnderAttack) => {
      setAlerts((prev) => {
        const next = [data, ...prev];
        return next.length > MAX_ALERTS ? next.slice(0, MAX_ALERTS) : next;
      });
    };

    // tycoon_error — 에러
    const handleTycoonError = (data: ITycoonError) => {
      setTycoonError(data);
    };

    // 리스너 등록
    socket.on(TYCOON_SERVER_EVENTS.TERRITORY_UPDATE, handleTerritoryUpdate);
    socket.on(TYCOON_SERVER_EVENTS.BUILDING_UPDATE, handleBuildingUpdate);
    socket.on(TYCOON_SERVER_EVENTS.AUCTION_UPDATE, handleAuctionUpdate);
    socket.on(TYCOON_SERVER_EVENTS.BATTLE_START, handleBattleStart);
    socket.on(TYCOON_SERVER_EVENTS.BATTLE_RESULT, handleBattleResult);
    socket.on(TYCOON_SERVER_EVENTS.ARMY_MARCH, handleArmyMarch);
    socket.on(TYCOON_SERVER_EVENTS.ARMY_ARRIVAL, handleArmyArrival);
    socket.on(TYCOON_SERVER_EVENTS.INCOME_SETTLED, handleIncomeSettled);
    socket.on(TYCOON_SERVER_EVENTS.TRADE_MATCH, handleTradeMatch);
    socket.on(TYCOON_SERVER_EVENTS.WAR_UPDATE, handleWarUpdate);
    socket.on(TYCOON_SERVER_EVENTS.ALLIANCE_UPDATE, handleAllianceUpdate);
    socket.on(TYCOON_SERVER_EVENTS.GLOBAL_NEWS, handleGlobalNews);
    socket.on(TYCOON_SERVER_EVENTS.UNDER_ATTACK, handleUnderAttack);
    socket.on(TYCOON_SERVER_EVENTS.TYCOON_ERROR, handleTycoonError);

    // 클린업: 리스너 해제
    return () => {
      socket.off(TYCOON_SERVER_EVENTS.TERRITORY_UPDATE, handleTerritoryUpdate);
      socket.off(TYCOON_SERVER_EVENTS.BUILDING_UPDATE, handleBuildingUpdate);
      socket.off(TYCOON_SERVER_EVENTS.AUCTION_UPDATE, handleAuctionUpdate);
      socket.off(TYCOON_SERVER_EVENTS.BATTLE_START, handleBattleStart);
      socket.off(TYCOON_SERVER_EVENTS.BATTLE_RESULT, handleBattleResult);
      socket.off(TYCOON_SERVER_EVENTS.ARMY_MARCH, handleArmyMarch);
      socket.off(TYCOON_SERVER_EVENTS.ARMY_ARRIVAL, handleArmyArrival);
      socket.off(TYCOON_SERVER_EVENTS.INCOME_SETTLED, handleIncomeSettled);
      socket.off(TYCOON_SERVER_EVENTS.TRADE_MATCH, handleTradeMatch);
      socket.off(TYCOON_SERVER_EVENTS.WAR_UPDATE, handleWarUpdate);
      socket.off(TYCOON_SERVER_EVENTS.ALLIANCE_UPDATE, handleAllianceUpdate);
      socket.off(TYCOON_SERVER_EVENTS.GLOBAL_NEWS, handleGlobalNews);
      socket.off(TYCOON_SERVER_EVENTS.UNDER_ATTACK, handleUnderAttack);
      socket.off(TYCOON_SERVER_EVENTS.TYCOON_ERROR, handleTycoonError);
    };
  }, [socket]);

  // ─── Uplink 메서드 (Client → Server) ───

  /** 건물 구매 요청 */
  const purchaseBuilding = useCallback(
    (buildingId: string) => {
      socket?.emit(TYCOON_EVENTS.BUILDING_PURCHASE, { building_id: buildingId });
    },
    [socket],
  );

  /** 경매 입찰 */
  const placeBid = useCallback(
    (auctionId: string, amount: number) => {
      socket?.emit(TYCOON_EVENTS.BUILDING_BID, { auction_id: auctionId, amount });
    },
    [socket],
  );

  /** 공격 명령 */
  const attackOrder = useCallback(
    (armyIds: string[], targetRegion: string) => {
      socket?.emit(TYCOON_EVENTS.ATTACK_ORDER, { army_ids: armyIds, target_region: targetRegion });
    },
    [socket],
  );

  /** 유닛 생산 요청 */
  const produceUnits = useCallback(
    (unitType: string, count: number, region: string) => {
      socket?.emit(TYCOON_EVENTS.UNIT_PRODUCE, { unit_type: unitType, count, region });
    },
    [socket],
  );

  /** 방어시설 건설 */
  const buildDefense = useCallback(
    (buildingId: string, defenseType: string) => {
      socket?.emit(TYCOON_EVENTS.DEFENSE_BUILD, { building_id: buildingId, type: defenseType });
    },
    [socket],
  );

  /** 건물 합병 요청 */
  const mergeRequest = useCallback(
    (buildingIds: string[]) => {
      socket?.emit(TYCOON_EVENTS.MERGE_REQUEST, { building_ids: buildingIds });
    },
    [socket],
  );

  /** 거래소 주문 */
  const tradeOrder = useCallback(
    (buildingId: string, orderType: 'sell' | 'buy', price: number) => {
      socket?.emit(TYCOON_EVENTS.TRADE_ORDER, {
        building_id: buildingId,
        order_type: orderType,
        price,
      });
    },
    [socket],
  );

  /** 동맹 액션 (생성/가입/탈퇴/초대) */
  const allianceAction = useCallback(
    (action: string, opts?: { allianceId?: string; targetId?: string; name?: string }) => {
      socket?.emit(TYCOON_EVENTS.ALLIANCE_ACTION, {
        action,
        ...(opts?.allianceId && { alliance_id: opts.allianceId }),
        ...(opts?.targetId && { target_id: opts.targetId }),
        ...(opts?.name && { name: opts.name }),
      });
    },
    [socket],
  );

  /** 전쟁 선포 */
  const declareWar = useCallback(
    (targetNation: string, coalition?: string[]) => {
      socket?.emit(TYCOON_EVENTS.WAR_DECLARE, {
        target_nation: targetNation,
        ...(coalition?.length && { coalition }),
      });
    },
    [socket],
  );

  /** 수익 수확 */
  const collectIncome = useCallback(() => {
    socket?.emit(TYCOON_EVENTS.INCOME_COLLECT, {});
  }, [socket]);

  /** 도시 상세 구독 */
  const subscribeCity = useCallback(
    (cityCode: string) => {
      socket?.emit(TYCOON_EVENTS.CITY_SUBSCRIBE, { city_code: cityCode });
    },
    [socket],
  );

  /** 도시 구독 해제 */
  const unsubscribeCity = useCallback(
    (cityCode: string) => {
      socket?.emit(TYCOON_EVENTS.CITY_UNSUBSCRIBE, { city_code: cityCode });
    },
    [socket],
  );

  return {
    // 상태
    territories,
    latestBattle,
    latestIncome,
    alerts,
    news,
    tycoonError,

    // 액션
    purchaseBuilding,
    placeBid,
    attackOrder,
    produceUnits,
    buildDefense,
    mergeRequest,
    tradeOrder,
    allianceAction,
    declareWar,
    collectIncome,
    subscribeCity,
    unsubscribeCity,

    // 외부 이벤트 콜백 ref
    onBuildingUpdate,
    onAuctionUpdate,
    onBattleStart,
    onArmyMarch,
    onArmyArrival,
    onTradeMatch,
    onWarUpdate,
    onAllianceUpdate,
  };
}
