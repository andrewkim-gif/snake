/**
 * airdrop-client.ts — v39 Phase 6: 에어드롭 클라이언트 시스템
 *
 * 서버에서 수신한 에어드롭 상태를 관리하고
 * 렌더링용 데이터를 제공한다.
 *
 * - 에어드롭 위치 관리
 * - 낙하 애니메이션 보간
 * - 획득 이펙트 트리거
 * - 활성 파워업 타이머 표시
 */

import type {
  IAirdrop,
  IAirdropEvent,
  IActivePowerup,
  AirdropPowerupType,
  AirdropState,
} from '@/lib/matrix/types/region';
import { AIRDROP_CONSTANTS, POWERUP_DISPLAY } from '@/lib/matrix/types/region';

// ── 렌더링용 에어드롭 데이터 ──

/** 에어드롭 렌더링 데이터 */
export interface AirdropVisual {
  /** 에어드롭 ID */
  id: string;
  /** 위치 (px) */
  x: number;
  y: number;
  /** 파워업 종류 */
  powerupType: AirdropPowerupType;
  /** 에어드롭 상태 */
  state: AirdropState;
  /** 낙하 진행도 (0~1, 0=하늘, 1=착지) */
  fallProgress: number;
  /** 아이콘 (이모지) */
  icon: string;
  /** 색상 */
  color: string;
  /** 파워업 이름 */
  name: string;
  /** 남은 수명 (초) */
  lifetime: number;
  /** 펄스 애니메이션 강도 (0~1, lifetime 기반) */
  pulseIntensity: number;
}

/** 활성 파워업 렌더링 데이터 */
export interface PowerupVisual {
  /** 파워업 종류 */
  type: AirdropPowerupType;
  /** 이름 */
  name: string;
  /** 아이콘 */
  icon: string;
  /** 색상 */
  color: string;
  /** 남은 시간 (초) */
  remaining: number;
  /** 총 지속 시간 (초) */
  duration: number;
  /** 남은 비율 (0~1) */
  remainingRatio: number;
  /** 설명 */
  description: string;
}

/** 에어드롭 이벤트 콜백 */
export interface AirdropClientCallbacks {
  /** 새 에어드롭 생성 시 */
  onSpawned?: (airdrop: AirdropVisual) => void;
  /** 에어드롭 착지 시 */
  onLanded?: (airdrop: AirdropVisual) => void;
  /** 에어드롭 획득 시 */
  onPickedUp?: (airdrop: AirdropVisual, playerId: string) => void;
  /** 에어드롭 만료 시 */
  onExpired?: (airdrop: AirdropVisual) => void;
}

// ── AirdropClientSystem ──

/**
 * AirdropClientSystem — 에어드롭 클라이언트 관리자
 *
 * 서버에서 수신한 에어드롭 목록과 이벤트를 처리하여
 * 렌더링에 필요한 시각 데이터를 제공한다.
 */
export class AirdropClientSystem {
  /** 활성 에어드롭 맵 (id → data) */
  private airdrops: Map<string, IAirdrop> = new Map();

  /** 내 활성 파워업 목록 */
  private myPowerups: IActivePowerup[] = [];

  /** 내 플레이어 ID */
  private myPlayerId: string = '';

  /** 콜백 */
  private callbacks: AirdropClientCallbacks = {};

  /** 획득 이펙트 대기열 (최근 획득한 에어드롭 위치) */
  private pickupEffects: Array<{
    x: number;
    y: number;
    powerupType: AirdropPowerupType;
    timestamp: number;
  }> = [];

  // ── 초기화 ──

  /** 내 플레이어 ID 설정 */
  setMyPlayerId(playerId: string): void {
    this.myPlayerId = playerId;
  }

  /** 콜백 설정 */
  setCallbacks(callbacks: AirdropClientCallbacks): void {
    this.callbacks = callbacks;
  }

  // ── 서버 데이터 수신 ──

  /**
   * 서버에서 수신한 에어드롭 목록으로 전체 동기화
   * (matrix_state 패킷 내 airdrops 필드)
   */
  syncAirdrops(serverAirdrops: IAirdrop[]): void {
    const newMap = new Map<string, IAirdrop>();
    for (const ad of serverAirdrops) {
      newMap.set(ad.id, ad);
    }
    this.airdrops = newMap;
  }

  /**
   * 서버 에어드롭 이벤트 처리 (개별 이벤트)
   */
  onAirdropEvent(event: IAirdropEvent): void {
    const visual = this.toVisual(event.airdrop);

    switch (event.type) {
      case 'airdrop_spawned':
        this.airdrops.set(event.airdrop.id, event.airdrop);
        this.callbacks.onSpawned?.(visual);
        break;

      case 'airdrop_landed':
        this.airdrops.set(event.airdrop.id, event.airdrop);
        this.callbacks.onLanded?.(visual);
        break;

      case 'airdrop_picked_up':
        this.airdrops.delete(event.airdrop.id);
        // 획득 이펙트 추가
        this.pickupEffects.push({
          x: event.airdrop.position.x,
          y: event.airdrop.position.y,
          powerupType: event.airdrop.powerupType,
          timestamp: Date.now(),
        });
        // 이펙트 큐 정리 (3초 초과된 것 제거)
        const cutoff = Date.now() - 3000;
        this.pickupEffects = this.pickupEffects.filter(e => e.timestamp > cutoff);
        this.callbacks.onPickedUp?.(visual, event.playerId ?? '');
        break;

      case 'airdrop_expired':
        this.airdrops.delete(event.airdrop.id);
        this.callbacks.onExpired?.(visual);
        break;
    }
  }

  /**
   * 활성 파워업 목록 업데이트 (서버에서 수신)
   */
  updateMyPowerups(powerups: IActivePowerup[]): void {
    this.myPowerups = powerups;
  }

  // ── 렌더링 데이터 ──

  /** 활성 에어드롭 시각 데이터 목록 */
  getAirdropVisuals(): AirdropVisual[] {
    const visuals: AirdropVisual[] = [];
    for (const ad of this.airdrops.values()) {
      visuals.push(this.toVisual(ad));
    }
    return visuals;
  }

  /** 내 활성 파워업 시각 데이터 목록 */
  getPowerupVisuals(): PowerupVisual[] {
    return this.myPowerups.map(p => {
      const display = POWERUP_DISPLAY[p.type];
      return {
        type: p.type,
        name: display?.name ?? p.type,
        icon: display?.icon ?? '?',
        color: display?.color ?? '#FFFFFF',
        remaining: p.remaining,
        duration: p.duration,
        remainingRatio: p.duration > 0 ? p.remaining / p.duration : 0,
        description: display?.description ?? '',
      };
    });
  }

  /** 최근 획득 이펙트 목록 (3초 이내) */
  getPickupEffects(): Array<{
    x: number;
    y: number;
    powerupType: AirdropPowerupType;
    age: number; // ms
  }> {
    const now = Date.now();
    return this.pickupEffects
      .filter(e => now - e.timestamp < 3000)
      .map(e => ({
        x: e.x,
        y: e.y,
        powerupType: e.powerupType,
        age: now - e.timestamp,
      }));
  }

  /** 에어드롭 시각 데이터 변환 */
  private toVisual(ad: IAirdrop): AirdropVisual {
    const display = POWERUP_DISPLAY[ad.powerupType];
    const fallProgress =
      ad.state === 'falling'
        ? 1 - ad.fallTimer / AIRDROP_CONSTANTS.FALL_DURATION
        : 1;

    // 수명 기반 펄스 강도 (남은 20초 미만 → 펄스 시작)
    let pulseIntensity = 0;
    if (ad.state === 'landed' && ad.lifetime < 20) {
      pulseIntensity = 1 - ad.lifetime / 20;
    }

    return {
      id: ad.id,
      x: ad.position.x,
      y: ad.position.y,
      powerupType: ad.powerupType,
      state: ad.state,
      fallProgress: Math.min(1, Math.max(0, fallProgress)),
      icon: display?.icon ?? '📦',
      color: display?.color ?? '#FFFFFF',
      name: display?.name ?? ad.powerupType,
      lifetime: ad.lifetime,
      pulseIntensity,
    };
  }

  // ── 리셋 ──

  /** 전체 리셋 (라운드 종료 시) */
  reset(): void {
    this.airdrops.clear();
    this.myPowerups = [];
    this.pickupEffects = [];
  }
}

// ── 싱글톤 인스턴스 ──

/** 전역 에어드롭 클라이언트 인스턴스 */
export const airdropClientSystem = new AirdropClientSystem();
