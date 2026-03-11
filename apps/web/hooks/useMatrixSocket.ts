'use client';

/**
 * useMatrixSocket — Matrix 온라인 아레나 전용 소켓 훅
 *
 * v33 Phase 3: 기존 GameSocket ({e, d} JSON 프레임)을 래핑하여
 * matrix_* 이벤트 전용 인터페이스를 제공한다.
 *
 * Uplink (클라이언트 → 서버):
 *   matrix_join, matrix_leave, matrix_input (10Hz),
 *   matrix_kill, matrix_damage, matrix_capture, matrix_level_up
 *
 * Downlink (서버 → 클라이언트):
 *   matrix_state (20Hz), matrix_epoch, matrix_spawn_seed,
 *   matrix_kill_confirmed, matrix_kill_rejected, matrix_score,
 *   matrix_result, matrix_capture_state, matrix_buff,
 *   matrix_level_up_choices
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameSocket, type ConnectionState } from './useWebSocket';

// ─── 서버 → 클라이언트 타입 ───

/** 에폭 페이즈 (6단계) */
export type MatrixEpochPhase = 'peace' | 'war_countdown' | 'war' | 'shrink' | 'end' | 'transition';

/** 원격 플레이어 상태 (matrix_state.players[]) */
export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  nation: string;
  isAlly: boolean;
  weapons: string[];
  status: string[];
  angle?: number;
  name?: string;
  /** v33 Phase 8: 킬 수 (delta compression 지원) */
  kills?: number;
  /** v33 Phase 8: 생존 여부 (delta compression 지원) */
  alive?: boolean;
}

/** 캡처 포인트 상태 */
export interface CapturePointState {
  id: string;
  owner: string | null;
  progress: number;
}

/** matrix_state 패킷 (20Hz) */
export interface MatrixStatePayload {
  tick: number;
  phase: MatrixEpochPhase;
  timer: number;
  players: RemotePlayer[];
  captures: CapturePointState[];
  nationScores: Record<string, number>;
  safeZoneRadius: number;
}

/**
 * v33 Phase 8: Delta-compressed matrix_state 패킷
 * 서버에서 변경된 필드만 전송. 클라이언트에서 이전 상태와 머지.
 */
export interface DeltaPlayerState {
  /** 플레이어 ID */
  id: string;
  /** 위치 (변경 시에만 포함) */
  x?: number;
  y?: number;
  /** 각도 (변경 시에만 포함) */
  a?: number;
  /** HP (변경 시에만 포함) */
  hp?: number;
  /** Max HP (변경 시에만 포함) */
  mhp?: number;
  /** 레벨 (변경 시에만 포함) */
  lv?: number;
  /** 킬 수 (변경 시에만 포함) */
  k?: number;
  /** 생존 여부 (변경 시에만 포함) */
  al?: boolean;
  /** 신규 플레이어 플래그 */
  new?: boolean;
  /** 퇴장 플레이어 플래그 */
  rm?: boolean;
}

/** Delta-compressed world state */
export interface DeltaStatePayload {
  tick: number;
  phase: MatrixEpochPhase;
  timer: number;
  players?: DeltaPlayerState[];
  /** 국가 스코어 (변경 시에만 포함) */
  ns?: Record<string, number>;
  /** 안전 구역 반경 (변경 시에만 포함) */
  szr?: number;
  /** 풀 스냅샷 플래그 */
  full?: boolean;
}

/** matrix_epoch 패킷 */
export interface MatrixEpochPayload {
  phase: MatrixEpochPhase;
  countdown?: number;
  config?: {
    pvpEnabled: boolean;
    orbMultiplier: number;
    shrinkTarget?: number;
  };
}

/** matrix_spawn_seed 패킷 */
export interface MatrixSpawnSeedPayload {
  seed: number;
  waveId: number;
  tick: number;
}

/** matrix_kill_confirmed 패킷 */
export interface MatrixKillConfirmedPayload {
  killerId: string;
  targetId: string;
  score: number;
}

/** matrix_kill_rejected 패킷 */
export interface MatrixKillRejectedPayload {
  reason: string;
  targetId?: string;
}

/** matrix_score 패킷 */
export interface MatrixScorePayload {
  nationScores: Record<string, number>;
  personalScore: number;
  rank: number;
}

/** matrix_result 패킷 (v33 Phase 6: 보상 상세 포함) */
export interface MatrixResultPayload {
  rankings: Array<{
    nationality: string;
    score: number;
    rank: number;
  }>;
  rewards: Array<{
    playerId: string;
    playerName: string;
    nationality: string;
    rawScore: number;
    baseAmount: number;
    multiplier: number;
    popAdjust: number;
    finalAmount: number;
    tokenType: string;
    isMvp: boolean;
    isTopThree: boolean;
    isDirectPlay: boolean;
    reason: string;
  }>;
  mvp: {
    playerId: string;
    playerName: string;
    finalAmount: number;
  } | null;
}

/** matrix_buff 패킷 */
export interface MatrixBuffPayload {
  tokenBuffs: {
    xpBoost: number;
    statBoost: number;
    specialSkills: string[];
  };
  captureBuffs: {
    resource: boolean;
    buff: boolean;
    healing: boolean;
  };
}

/** matrix_level_up_choices 패킷 */
export interface MatrixLevelUpChoicesPayload {
  choices: Array<{
    id: string;
    skill: string;
    isNew: boolean;
    currentLevel: number;
    nextLevel: number;
    priorityScore: number;
  }>;
}

// ─── v39 Phase 4: Region 타입 ───

/** region_list 응답 — 국가별 지역 목록 */
export interface RegionListResponse {
  countryCode: string;
  regions: RegionListEntry[];
}

/** 지역 목록 항목 */
export interface RegionListEntry {
  regionId: string;
  name: string;
  nameEn: string;
  type: string;
  arenaSize: number;
  maxPlayers: number;
  currentPlayers: number;
  state: string;
  controllingFactionId?: string;
  controllingFactionColor?: string;
  controlStreak: number;
  primaryResource: string;
  specialtyResource: string;
  biome: string;
  specialEffect: string;
}

/** region_joined 응답 */
export interface RegionJoinedPayload {
  success: boolean;
  regionId: string;
  countryCode: string;
  phase: string;
  arenaSize: number;
  error?: string;
}

// ─── 클라이언트 → 서버 타입 ───

/** matrix_input 페이로드 (10Hz) */
export interface MatrixInputPayload {
  x: number;
  y: number;
  angle: number;
  boost: boolean;
  tick: number;
}

/** matrix_kill 페이로드 */
export interface MatrixKillPayload {
  targetId: string;
  weaponId: string;
  damage: number;
  distance: number;
  tick: number;
}

/** matrix_damage 페이로드 */
export interface MatrixDamagePayload {
  targetId: string;
  weaponId: string;
  damage: number;
  tick: number;
}

// ─── 다운링크 리스너 타입 ───

export interface MatrixSocketListeners {
  onState?: (data: MatrixStatePayload) => void;
  /** v33 Phase 8: Delta-compressed state handler */
  onDeltaState?: (data: DeltaStatePayload) => void;
  onEpoch?: (data: MatrixEpochPayload) => void;
  onSpawnSeed?: (data: MatrixSpawnSeedPayload) => void;
  onKillConfirmed?: (data: MatrixKillConfirmedPayload) => void;
  onKillRejected?: (data: MatrixKillRejectedPayload) => void;
  onScore?: (data: MatrixScorePayload) => void;
  onResult?: (data: MatrixResultPayload) => void;
  onCaptureState?: (data: { points: CapturePointState[] }) => void;
  onBuff?: (data: MatrixBuffPayload) => void;
  onLevelUpChoices?: (data: MatrixLevelUpChoicesPayload) => void;
  /** v39 Phase 4: Region events */
  onRegionList?: (data: RegionListResponse) => void;
  onRegionJoined?: (data: RegionJoinedPayload) => void;
  onRegionState?: (data: RegionListEntry[]) => void;
}

// ─── 훅 리턴 타입 ───

export interface UseMatrixSocketReturn {
  /** 연결 상태 */
  connectionState: ConnectionState;
  /** 레이턴시 (ms) */
  latency: number;
  /** 현재 서버 틱 */
  serverTick: number;

  // Uplink 메서드
  /** 국가 아레나 입장 */
  joinArena: (countryCode: string, build?: string, agentId?: string) => void;
  /** 아레나 퇴장 */
  leaveArena: () => void;
  /** 입력 전송 (10Hz 스로틀) */
  sendInput: (x: number, y: number, angle: number, boost: boolean) => void;
  /** 킬 리포트 */
  reportKill: (targetId: string, weaponId: string, damage: number, distance: number) => void;
  /** PvP 데미지 리포트 */
  reportDamage: (targetId: string, weaponId: string, damage: number) => void;
  /** 캡처 포인트 진입 */
  capturePoint: (pointId: string) => void;
  /** 레벨업 선택 */
  chooseLevelUp: (choiceId: string) => void;
  /** 연결 시작 */
  connect: (serverUrl: string) => void;
  /** 연결 해제 */
  disconnect: () => void;

  // v39 Phase 4: Region 메서드
  /** 국가 지역 목록 요청 */
  requestRegionList: (countryCode: string) => void;
  /** 지역 아레나 입장 */
  joinRegion: (countryCode: string, regionId: string, factionId?: string, factionName?: string) => void;
  /** 지역 아레나 퇴장 */
  leaveRegion: () => void;
}

// ─── 상수 ───

/** 입력 전송 간격 (10Hz = 100ms) */
const INPUT_INTERVAL_MS = 100;

// ─── 훅 구현 ───

export function useMatrixSocket(listeners: MatrixSocketListeners = {}): UseMatrixSocketReturn {
  const socketRef = useRef<GameSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [latency, setLatency] = useState(0);
  const serverTickRef = useRef(0);
  const [serverTick, setServerTick] = useState(0);
  const lastInputTimeRef = useRef(0);
  const listenersRef = useRef(listeners);
  listenersRef.current = listeners;

  // 소켓 생성 및 다운링크 리스너 등록
  const connect = useCallback((serverUrl: string) => {
    // 기존 연결이 있으면 정리
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = new GameSocket();
    socketRef.current = socket;

    // 연결 상태 콜백
    socket.onStateChange = (state) => {
      setConnectionState(state);
    };

    // ─── 다운링크 이벤트 등록 ───

    // v33 Phase 8: matrix_state now supports delta compression
    // Delta packets have short field names (ns, szr, etc.) and optional full flag.
    // Full state packets have players[] with full RemotePlayer objects.
    socket.on('matrix_state', (data: DeltaStatePayload | MatrixStatePayload) => {
      serverTickRef.current = data.tick;
      setServerTick(data.tick);

      // Detect delta format: delta packets use 'ns' key for nation scores,
      // full legacy packets use 'nationScores' key
      if ('ns' in data || 'szr' in data || (data as DeltaStatePayload).full !== undefined) {
        // Delta-compressed packet
        listenersRef.current.onDeltaState?.(data as DeltaStatePayload);
      } else {
        // Legacy full state packet (backward compatible)
        listenersRef.current.onState?.(data as MatrixStatePayload);
      }
    });

    socket.on('matrix_epoch', (data: MatrixEpochPayload) => {
      listenersRef.current.onEpoch?.(data);
    });

    socket.on('matrix_spawn_seed', (data: MatrixSpawnSeedPayload) => {
      listenersRef.current.onSpawnSeed?.(data);
    });

    socket.on('matrix_kill_confirmed', (data: MatrixKillConfirmedPayload) => {
      listenersRef.current.onKillConfirmed?.(data);
    });

    socket.on('matrix_kill_rejected', (data: MatrixKillRejectedPayload) => {
      listenersRef.current.onKillRejected?.(data);
    });

    socket.on('matrix_score', (data: MatrixScorePayload) => {
      listenersRef.current.onScore?.(data);
    });

    socket.on('matrix_result', (data: MatrixResultPayload) => {
      listenersRef.current.onResult?.(data);
    });

    socket.on('matrix_capture_state', (data: { points: CapturePointState[] }) => {
      listenersRef.current.onCaptureState?.(data);
    });

    socket.on('matrix_buff', (data: MatrixBuffPayload) => {
      listenersRef.current.onBuff?.(data);
    });

    socket.on('matrix_level_up_choices', (data: MatrixLevelUpChoicesPayload) => {
      listenersRef.current.onLevelUpChoices?.(data);
    });

    // v39 Phase 4: Region events
    socket.on('region_list', (data: RegionListResponse) => {
      listenersRef.current.onRegionList?.(data);
    });

    socket.on('region_joined', (data: RegionJoinedPayload) => {
      listenersRef.current.onRegionJoined?.(data);
    });

    socket.on('region_state', (data: RegionListEntry[]) => {
      listenersRef.current.onRegionState?.(data);
    });

    // 레이턴시 트래킹
    socket.on('pong', () => {
      setLatency(socket.latency);
    });

    // 연결 시작
    socket.connect(serverUrl);
  }, []);

  // 연결 해제
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('matrix_leave', {});
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  // 클린업
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ─── Uplink 메서드 ───

  const joinArena = useCallback((countryCode: string, build?: string, agentId?: string) => {
    socketRef.current?.emit('matrix_join', {
      countryCode,
      ...(build && { build }),
      ...(agentId && { agentId }),
    });
  }, []);

  const leaveArena = useCallback(() => {
    socketRef.current?.emit('matrix_leave', {});
  }, []);

  /** 10Hz 스로틀된 입력 전송 */
  const sendInput = useCallback((x: number, y: number, angle: number, boost: boolean) => {
    const now = Date.now();
    if (now - lastInputTimeRef.current < INPUT_INTERVAL_MS) return;
    lastInputTimeRef.current = now;

    socketRef.current?.emit('matrix_input', {
      x: Math.round(x),
      y: Math.round(y),
      angle: Math.round(angle * 1000) / 1000, // 소수점 3자리
      boost,
      tick: serverTickRef.current,
    } satisfies MatrixInputPayload);
  }, []);

  const reportKill = useCallback((targetId: string, weaponId: string, damage: number, distance: number) => {
    socketRef.current?.emit('matrix_kill', {
      targetId,
      weaponId,
      damage: Math.round(damage),
      distance: Math.round(distance),
      tick: serverTickRef.current,
    } satisfies MatrixKillPayload);
  }, []);

  const reportDamage = useCallback((targetId: string, weaponId: string, damage: number) => {
    socketRef.current?.emit('matrix_damage', {
      targetId,
      weaponId,
      damage: Math.round(damage),
      tick: serverTickRef.current,
    } satisfies MatrixDamagePayload);
  }, []);

  const capturePoint = useCallback((pointId: string) => {
    socketRef.current?.emit('matrix_capture', { pointId });
  }, []);

  const chooseLevelUp = useCallback((choiceId: string) => {
    socketRef.current?.emit('matrix_level_up', { choiceId });
  }, []);

  // v39 Phase 4: Region uplink methods

  const requestRegionList = useCallback((countryCode: string) => {
    socketRef.current?.emit('country_regions', { countryCode });
  }, []);

  const joinRegion = useCallback((countryCode: string, regionId: string, factionId?: string, factionName?: string) => {
    socketRef.current?.emit('region_join', {
      countryCode,
      regionId,
      ...(factionId && { factionId }),
      ...(factionName && { factionName }),
    });
  }, []);

  const leaveRegion = useCallback(() => {
    socketRef.current?.emit('region_leave', {});
  }, []);

  return {
    connectionState,
    latency,
    serverTick,
    joinArena,
    leaveArena,
    sendInput,
    reportKill,
    reportDamage,
    capturePoint,
    chooseLevelUp,
    connect,
    disconnect,
    // v39 Phase 4: Region methods
    requestRegionList,
    joinRegion,
    leaveRegion,
  };
}
