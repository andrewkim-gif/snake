/**
 * multiplayer/types.ts — 멀티플레이어 렌더링 타입 정의
 *
 * v33 Phase 4: 다른 플레이어 렌더링, 네임태그, PvP 이펙트, 뷰포트 컬링
 */

import type { InterpolatedPlayer } from '../../systems/online-sync';

// ─── 국적 색상 ───

/** 국적별 색상 매핑 */
export interface NationColorSet {
  /** 메인 컬러 (캐릭터 아웃라인) */
  primary: string;
  /** 보조 컬러 (글로우/이펙트) */
  glow: string;
  /** 텍스트 컬러 */
  text: string;
}

// ─── 원격 플레이어 렌더링 ───

/** 원격 플레이어 렌더링 파라미터 */
export interface RemotePlayerRenderParams {
  ctx: CanvasRenderingContext2D;
  player: InterpolatedPlayer;
  /** 카메라 오프셋 (월드→스크린 변환) */
  cameraX: number;
  cameraY: number;
  /** 줌 레벨 */
  zoom: number;
  /** 현재 타임스탬프 (ms) */
  time: number;
  /** PvP 활성 여부 */
  pvpEnabled: boolean;
  /** LOD 레벨 (0=high, 1=mid, 2=low) */
  lod: number;
}

/** 네임태그 렌더링 파라미터 */
export interface NametagRenderParams {
  ctx: CanvasRenderingContext2D;
  /** 스크린 좌표 X */
  screenX: number;
  /** 스크린 좌표 Y (캐릭터 머리 위) */
  screenY: number;
  /** 플레이어 이름 */
  name: string;
  /** 국가 코드 (3-letter, e.g. "KOR") */
  nation: string;
  /** 현재 HP */
  hp: number;
  /** 최대 HP */
  maxHp: number;
  /** 레벨 */
  level: number;
  /** 아군 여부 */
  isAlly: boolean;
  /** PvP 활성 여부 */
  pvpEnabled: boolean;
  /** LOD 레벨 */
  lod: number;
  /** 줌 레벨 */
  zoom: number;
}

// ─── PvP 이펙트 ───

/** 히트 이펙트 인스턴스 */
export interface HitEffect {
  /** 월드 좌표 */
  x: number;
  y: number;
  /** 데미지량 */
  damage: number;
  /** 생성 시간 (ms) */
  createdAt: number;
  /** 지속 시간 (ms) */
  duration: number;
  /** 색상 */
  color: string;
  /** 이펙트 타입 */
  type: 'hit' | 'critical' | 'kill';
}

/** 킬 알림 팝업 */
export interface KillNotification {
  /** 킬러 이름 */
  killerName: string;
  /** 타겟 이름 */
  targetName: string;
  /** 킬러 국가 코드 */
  killerNation: string;
  /** 타겟 국가 코드 */
  targetNation: string;
  /** 무기 ID */
  weaponId: string;
  /** 생성 시간 (ms) */
  createdAt: number;
  /** 스코어 획득 */
  score: number;
}

/** 데미지 숫자 팝업 */
export interface DamageNumber {
  x: number;
  y: number;
  damage: number;
  createdAt: number;
  /** 올라가는 오프셋 (애니메이션) */
  offsetY: number;
  color: string;
  isCritical: boolean;
}

// ─── 뷰포트 컬링 ───

/** 뷰포트 바운드 (월드 좌표) */
export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 컬링 결과 */
export interface CullingResult {
  /** 렌더링할 플레이어 */
  visible: InterpolatedPlayer[];
  /** 컬링된 플레이어 수 */
  culledCount: number;
  /** LOD 레벨별 플레이어 수 */
  lodCounts: { high: number; mid: number; low: number };
}

/** LOD 거리 임계값 (px, 월드 좌표) */
export interface LODThresholds {
  /** HIGH → MID 전환 거리 */
  midDistance: number;
  /** MID → LOW 전환 거리 */
  lowDistance: number;
  /** LOW → CULL (완전 제거) 거리 */
  cullDistance: number;
}
