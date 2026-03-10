/**
 * online-sync.ts — 서버 상태 동기화 시스템
 *
 * v33 Phase 3: matrix_state (20Hz) 수신 → 로컬 상태에 반영
 * v33 Phase 8: Delta compression 지원 (변경 필드만 수신, 로컬 머지)
 *
 * - 다른 플레이어 위치 보간 (100ms 버퍼, lerp)
 * - 에폭 페이즈/타이머 반영
 * - 국가 스코어 업데이트
 * - 캡처 포인트 상태 업데이트
 * - 안전 구역 반경 업데이트
 * - Delta merge: 서버에서 변경된 필드만 수신하여 기존 상태에 합침
 */

import type {
  MatrixStatePayload,
  RemotePlayer,
  CapturePointState,
  MatrixEpochPhase,
  DeltaStatePayload,
  DeltaPlayerState,
} from '@/hooks/useMatrixSocket';
import type { Vector2 } from '../types';

// ─── 보간 버퍼 엔트리 ───

interface InterpolationEntry {
  timestamp: number;
  player: RemotePlayer;
}

// ─── OnlineSyncState — 외부에서 읽는 동기화 상태 ───

export interface OnlineSyncState {
  /** 보간된 원격 플레이어 목록 */
  remotePlayers: InterpolatedPlayer[];
  /** 현재 에폭 페이즈 */
  epochPhase: MatrixEpochPhase;
  /** 에폭 타이머 (남은 초) */
  epochTimer: number;
  /** 국가별 스코어 */
  nationScores: Record<string, number>;
  /** 캡처 포인트 상태 */
  capturePoints: CapturePointState[];
  /** 안전 구역 반경 */
  safeZoneRadius: number;
  /** 서버 틱 */
  serverTick: number;
  /** PvP 활성화 여부 (에폭 페이즈 기반) */
  pvpEnabled: boolean;
}

/** 보간 완료된 원격 플레이어 */
export interface InterpolatedPlayer {
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
  angle: number;
  name: string;
}

// ─── 상수 ───

/** 보간 버퍼 시간 (ms) — 네트워크 지연 흡수 */
const INTERPOLATION_BUFFER_MS = 100;
/** 보간 버퍼 최대 엔트리 수 */
const MAX_BUFFER_SIZE = 10;
/** PvP 활성 페이즈 */
const PVP_PHASES: Set<MatrixEpochPhase> = new Set(['war', 'shrink']);

// ─── 클래스 구현 ───

export class OnlineSyncSystem {
  /** 플레이어별 보간 버퍼 */
  private buffers = new Map<string, InterpolationEntry[]>();

  /**
   * v33 Phase 8: Delta merge 캐시 — 이전 풀 플레이어 상태 저장
   * delta 패킷 수신 시 여기에 합쳐서 보간 버퍼에 추가
   */
  private cachedPlayers = new Map<string, RemotePlayer>();

  /** 최신 동기화 상태 */
  private _state: OnlineSyncState = {
    remotePlayers: [],
    epochPhase: 'peace',
    epochTimer: 0,
    nationScores: {},
    capturePoints: [],
    safeZoneRadius: 3000,
    serverTick: 0,
    pvpEnabled: false,
  };

  /** 로컬 플레이어 ID (자기 자신 필터링용) */
  private localPlayerId: string = '';

  /** 현재 동기화 상태 (읽기 전용) */
  get state(): OnlineSyncState {
    return this._state;
  }

  /** 로컬 플레이어 ID 설정 */
  setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }

  /**
   * 서버 matrix_state 수신 시 호출
   * 보간 버퍼에 플레이어 상태를 추가하고, 비-플레이어 상태를 즉시 반영한다.
   */
  applyState(payload: MatrixStatePayload): void {
    const now = Date.now();

    // 에폭/타이머/스코어/캡처/세이프존 즉시 반영
    this._state.epochPhase = payload.phase;
    this._state.epochTimer = payload.timer;
    this._state.nationScores = payload.nationScores;
    this._state.capturePoints = payload.captures;
    this._state.safeZoneRadius = payload.safeZoneRadius;
    this._state.serverTick = payload.tick;
    this._state.pvpEnabled = PVP_PHASES.has(payload.phase);

    // 플레이어 보간 버퍼 업데이트
    const activePlayers = new Set<string>();

    for (const player of payload.players) {
      // 자기 자신은 보간 대상이 아님 (ClientPrediction이 처리)
      if (player.id === this.localPlayerId) continue;

      activePlayers.add(player.id);

      let buffer = this.buffers.get(player.id);
      if (!buffer) {
        buffer = [];
        this.buffers.set(player.id, buffer);
      }

      buffer.push({ timestamp: now, player });

      // 버퍼 크기 제한
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
      }
    }

    // 퇴장한 플레이어 정리
    for (const [id] of this.buffers) {
      if (!activePlayers.has(id)) {
        this.buffers.delete(id);
      }
    }

    // v33 Phase 8: 풀 스냅샷이므로 캐시 동기화
    this.cachedPlayers.clear();
    for (const player of payload.players) {
      this.cachedPlayers.set(player.id, { ...player });
    }
  }

  /**
   * v33 Phase 8: Delta-compressed matrix_state 수신 시 호출
   *
   * Delta merge 로직:
   *   - full=true → 풀 스냅샷, applyState()와 동일하게 처리
   *   - players[].new=true → 새 플레이어 추가 (전체 필드 포함)
   *   - players[].rm=true → 플레이어 제거
   *   - 그 외 → 변경된 필드만 기존 cachedPlayers에 머지
   *   - ns (nationScores), szr (safeZoneRadius) → 존재하면 덮어쓰기
   */
  applyDeltaState(delta: DeltaStatePayload): void {
    const now = Date.now();

    // 에폭/타이머 항상 반영
    this._state.epochPhase = delta.phase;
    this._state.epochTimer = delta.timer;
    this._state.serverTick = delta.tick;
    this._state.pvpEnabled = PVP_PHASES.has(delta.phase);

    // 국가 스코어: delta에 포함된 경우에만 업데이트
    if (delta.ns) {
      this._state.nationScores = delta.ns;
    }

    // 안전 구역: delta에 포함된 경우에만 업데이트
    if (delta.szr !== undefined && delta.szr !== 0) {
      this._state.safeZoneRadius = delta.szr;
    }

    // 풀 스냅샷이면 기존 applyState 로직과 동일하게 처리
    if (delta.full && delta.players) {
      const fullPlayers: RemotePlayer[] = delta.players.map(dp => deltaToRemotePlayer(dp));
      this.applyState({
        tick: delta.tick,
        phase: delta.phase,
        timer: delta.timer,
        players: fullPlayers,
        captures: this._state.capturePoints, // 캡처 포인트는 유지
        nationScores: delta.ns ?? this._state.nationScores,
        safeZoneRadius: delta.szr ?? this._state.safeZoneRadius,
      });
      return;
    }

    // Delta merge
    if (delta.players) {
      for (const dp of delta.players) {
        // 제거된 플레이어
        if (dp.rm) {
          this.cachedPlayers.delete(dp.id);
          this.buffers.delete(dp.id);
          continue;
        }

        // 신규 또는 기존 플레이어 머지
        let cached = this.cachedPlayers.get(dp.id);

        if (dp.new || !cached) {
          // 새 플레이어: 전체 필드로 초기화
          cached = deltaToRemotePlayer(dp);
          this.cachedPlayers.set(dp.id, cached);
        } else {
          // 기존 플레이어: 변경된 필드만 업데이트
          if (dp.x !== undefined && dp.x !== 0) cached.x = dp.x;
          if (dp.y !== undefined && dp.y !== 0) cached.y = dp.y;
          if (dp.a !== undefined && dp.a !== 0) cached.angle = dp.a;
          if (dp.hp !== undefined && dp.hp !== 0) cached.hp = dp.hp;
          if (dp.mhp !== undefined && dp.mhp !== 0) cached.maxHp = dp.mhp;
          if (dp.lv !== undefined && dp.lv !== 0) cached.level = dp.lv;
          if (dp.k !== undefined) cached.kills = dp.k;
          if (dp.al !== undefined) cached.alive = dp.al;
          this.cachedPlayers.set(dp.id, cached);
        }

        // 보간 버퍼에 추가 (자기 자신 필터링)
        if (cached.id === this.localPlayerId) continue;

        // RemotePlayer로 변환하여 버퍼에 추가
        let buffer = this.buffers.get(cached.id);
        if (!buffer) {
          buffer = [];
          this.buffers.set(cached.id, buffer);
        }

        buffer.push({ timestamp: now, player: { ...cached } });

        if (buffer.length > MAX_BUFFER_SIZE) {
          buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
        }
      }
    }

    // 퇴장한 플레이어 정리: cachedPlayers에 없는 버퍼 제거
    for (const [id] of this.buffers) {
      if (!this.cachedPlayers.has(id)) {
        this.buffers.delete(id);
      }
    }
  }

  /**
   * 매 프레임 호출 — 보간된 원격 플레이어 목록 생성
   * 100ms 이전 버퍼 엔트리를 보간하여 부드러운 움직임 제공
   */
  interpolatePlayers(): InterpolatedPlayer[] {
    const renderTime = Date.now() - INTERPOLATION_BUFFER_MS;
    const result: InterpolatedPlayer[] = [];

    for (const [, buffer] of this.buffers) {
      if (buffer.length === 0) continue;

      // renderTime 기준으로 앞뒤 엔트리 찾기
      let prev: InterpolationEntry | null = null;
      let next: InterpolationEntry | null = null;

      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i].timestamp <= renderTime) {
          prev = buffer[i];
        } else {
          next = buffer[i];
          break;
        }
      }

      // 보간 대상이 없으면 가장 최근 엔트리 사용
      if (!prev && !next) continue;

      if (prev && next) {
        // 두 엔트리 사이 보간
        const totalDt = next.timestamp - prev.timestamp;
        const t = totalDt > 0 ? (renderTime - prev.timestamp) / totalDt : 0;
        const clamped = Math.max(0, Math.min(1, t));

        result.push({
          id: next.player.id,
          x: lerp(prev.player.x, next.player.x, clamped),
          y: lerp(prev.player.y, next.player.y, clamped),
          hp: next.player.hp,
          maxHp: next.player.maxHp,
          level: next.player.level,
          nation: next.player.nation,
          isAlly: next.player.isAlly,
          weapons: next.player.weapons,
          status: next.player.status,
          angle: lerpAngle(prev.player.angle ?? 0, next.player.angle ?? 0, clamped),
          name: next.player.name ?? next.player.id,
        });
      } else {
        // 단일 엔트리 (보간 불가) — 그대로 사용
        const entry = (prev ?? next)!;
        result.push({
          id: entry.player.id,
          x: entry.player.x,
          y: entry.player.y,
          hp: entry.player.hp,
          maxHp: entry.player.maxHp,
          level: entry.player.level,
          nation: entry.player.nation,
          isAlly: entry.player.isAlly,
          weapons: entry.player.weapons,
          status: entry.player.status,
          angle: entry.player.angle ?? 0,
          name: entry.player.name ?? entry.player.id,
        });
      }
    }

    this._state.remotePlayers = result;
    return result;
  }

  /**
   * 특정 원격 플레이어의 최신 서버 위치 조회
   * (킬 검증 등에서 서버 위치 기준 거리 계산에 사용)
   */
  getPlayerPosition(playerId: string): Vector2 | null {
    const buffer = this.buffers.get(playerId);
    if (!buffer || buffer.length === 0) return null;
    const latest = buffer[buffer.length - 1].player;
    return { x: latest.x, y: latest.y };
  }

  /** 전체 리셋 (에폭 전환/아레나 퇴장 시) */
  reset(): void {
    this.buffers.clear();
    this.cachedPlayers.clear();
    this._state = {
      remotePlayers: [],
      epochPhase: 'peace',
      epochTimer: 0,
      nationScores: {},
      capturePoints: [],
      safeZoneRadius: 3000,
      serverTick: 0,
      pvpEnabled: false,
    };
  }
}

// ─── 유틸리티 ───

/** 선형 보간 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 각도 보간 (최단 경로) */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // -PI ~ PI 범위로 정규화
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * v33 Phase 8: DeltaPlayerState → RemotePlayer 변환
 * 풀 스냅샷 또는 신규 플레이어에서 사용
 */
function deltaToRemotePlayer(dp: DeltaPlayerState): RemotePlayer {
  return {
    id: dp.id,
    x: dp.x ?? 0,
    y: dp.y ?? 0,
    hp: dp.hp ?? 100,
    maxHp: dp.mhp ?? 100,
    level: dp.lv ?? 1,
    nation: '',       // delta에 nation 없음 — 캐시에서 보충
    isAlly: false,    // delta에 없음 — 캐시에서 보충
    weapons: [],      // delta에 없음 — 캐시에서 보충
    status: [],       // delta에 없음 — 캐시에서 보충
    angle: dp.a ?? 0,
    name: dp.id,      // delta에 없음 — 캐시에서 보충
    // 확장 필드 (delta 전용)
    kills: dp.k ?? 0,
    alive: dp.al ?? true,
  };
}
