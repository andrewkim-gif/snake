/**
 * animation-state-machine.ts — 큐블링 애니메이션 상태 머신
 *
 * Three.js 의존 없는 순수 클래스. 숫자 연산만 수행.
 * 2D Canvas에도 재사용 가능하도록 설계.
 *
 * 출력: 파트별 회전(rad), 오프셋(unit), 스케일 — Matrix4 변환은 AgentInstances.tsx에서 수행
 *
 * Phase 4A: IDLE, WALK, BOOST 3상태 + 블렌딩 전환
 * Phase 4B: ATTACK, HIT, DEATH, SPAWN, LEVELUP, VICTORY, COLLECT 7상태 추가
 * Phase 3 (v16): 속도 비례 진폭 + 상/하체 분리 + 2차 모션 + 개성 + DODGE_ROLL
 */

import { AnimState } from '@agent-survivor/shared';

// ─── 상수 ───

const PI = Math.PI;
const PI2 = Math.PI * 2;

/** 속도 임계값: 이 이하이면 IDLE */
const WALK_THRESHOLD = 5;

/** 최대 속도 (부스트, px/s) — 속도 비례 진폭 계산에 사용 */
const MAX_SPEED = 300;

/** 상/하체 최대 비틀림 각도 (rad, ±60°) */
const MAX_TWIST_ANGLE = PI / 3;

// ─── 원샷/루프/영구 상태 duration 상수 ───

/** ATTACK 원샷 duration (초) */
const ATTACK_DURATION = 0.4;
/** HIT 원샷 duration (초) */
const HIT_DURATION = 0.3;
/** DEATH 영구 애니메이션 duration (초) — 완료 후 scale=0 유지 */
const DEATH_DURATION = 2.0;
/** SPAWN 원샷 duration (초) */
const SPAWN_DURATION = 0.4;
/** LEVELUP 원샷 duration (초) */
const LEVELUP_DURATION = 0.8;
/** COLLECT 원샷 duration (초) */
const COLLECT_DURATION = 0.25;
/** VICTORY 루프 주기 (초) */
const VICTORY_LOOP_PERIOD = 1.0;
/** DODGE_ROLL 원샷 duration (초) */
const DODGE_ROLL_DURATION = 0.4;

// ─── 파트별 변환 출력 인터페이스 ───

/** 애니메이션이 출력하는 파트별 변환 값 */
export interface PartTransforms {
  head: {
    rotX: number; rotY: number; rotZ: number;
    posX: number; posY: number; posZ: number;
    scaleX: number; scaleY: number;
  };
  body: {
    rotX: number; rotY: number; rotZ: number;
    posX: number; posY: number; posZ: number;
    scaleX: number; scaleY: number;
  };
  armL: { rotX: number; rotZ: number; };
  armR: { rotX: number; rotZ: number; };
  legL: { rotX: number; };
  legR: { rotX: number; };
  /**
   * v16 Phase 3: 상/하체 분리 — 하체(legs) 기준 Y축 회전 오프셋 (rad)
   * AgentInstances에서 legs에 이 값만큼 추가 Y 회전 적용
   * 0이면 상체와 동일 방향 (기존 동작)
   */
  lowerBodyRotY: number;
  /**
   * v16 Phase 3: 상체(body, arms, head) 기준 Y축 회전 오프셋 (rad)
   * 0이면 에이전트 heading과 동일 (기존 동작)
   */
  upperBodyRotY: number;
  /**
   * v16 Phase 3: DODGE_ROLL 시 전체 body X축 회전 (360° roll)
   */
  rollRotX: number;
}

/** 기본 변환 (모든 값 0, 스케일 1) */
function createDefaultTransforms(): PartTransforms {
  return {
    head: { rotX: 0, rotY: 0, rotZ: 0, posX: 0, posY: 0, posZ: 0, scaleX: 1, scaleY: 1 },
    body: { rotX: 0, rotY: 0, rotZ: 0, posX: 0, posY: 0, posZ: 0, scaleX: 1, scaleY: 1 },
    armL: { rotX: 0, rotZ: 0 },
    armR: { rotX: 0, rotZ: 0 },
    legL: { rotX: 0 },
    legR: { rotX: 0 },
    lowerBodyRotY: 0,
    upperBodyRotY: 0,
    rollRotX: 0,
  };
}

// ─── 상태 전환 설정 ───

/** 전환 규칙 */
interface TransitionConfig {
  from: AnimState | -1;  // -1 = ANY
  to: AnimState;
  blendDuration: number; // 초 (0 = 즉시)
  priority: number;      // 높을수록 우선
}

/** 상태별 우선순위 (높을수록 인터럽트 가능) */
const STATE_PRIORITY: Record<number, number> = {
  [AnimState.IDLE]: 0,
  [AnimState.WALK]: 1,
  [AnimState.BOOST]: 2,
  [AnimState.COLLECT]: 3,
  [AnimState.ATTACK]: 5,
  [AnimState.DODGE_ROLL]: 6,
  [AnimState.HIT]: 8,
  [AnimState.DEATH]: 10,
  [AnimState.SPAWN]: 9,
  [AnimState.LEVELUP]: 4,
  [AnimState.VICTORY]: 4,
};

/** 전환별 블렌드 시간 (초) */
const TRANSITION_DURATIONS: TransitionConfig[] = [
  // IDLE ↔ WALK: 부드러운 시작/정지
  { from: AnimState.IDLE, to: AnimState.WALK, blendDuration: 0.15, priority: 1 },
  { from: AnimState.WALK, to: AnimState.IDLE, blendDuration: 0.15, priority: 0 },

  // WALK ↔ BOOST: 빠른 전환
  { from: AnimState.WALK, to: AnimState.BOOST, blendDuration: 0.1, priority: 2 },
  { from: AnimState.BOOST, to: AnimState.WALK, blendDuration: 0.12, priority: 1 },

  // IDLE → BOOST: 직행
  { from: AnimState.IDLE, to: AnimState.BOOST, blendDuration: 0.1, priority: 2 },
  { from: AnimState.BOOST, to: AnimState.IDLE, blendDuration: 0.15, priority: 0 },

  // ANY → HIT: 즉시
  { from: -1, to: AnimState.HIT, blendDuration: 0, priority: 8 },
  // ANY → DEATH: 즉시
  { from: -1, to: AnimState.DEATH, blendDuration: 0, priority: 10 },
  // ANY → SPAWN: 즉시
  { from: -1, to: AnimState.SPAWN, blendDuration: 0, priority: 9 },
  // SPAWN → IDLE: 느린 전환
  { from: AnimState.SPAWN, to: AnimState.IDLE, blendDuration: 0.2, priority: 0 },

  // ATTACK → 이전 상태: 빠른 복귀
  { from: AnimState.ATTACK, to: AnimState.IDLE, blendDuration: 0.1, priority: 0 },
  { from: AnimState.ATTACK, to: AnimState.WALK, blendDuration: 0.1, priority: 1 },
  { from: AnimState.ATTACK, to: AnimState.BOOST, blendDuration: 0.08, priority: 2 },

  // HIT → 이전 상태: 빠른 복귀
  { from: AnimState.HIT, to: AnimState.IDLE, blendDuration: 0.1, priority: 0 },
  { from: AnimState.HIT, to: AnimState.WALK, blendDuration: 0.1, priority: 1 },

  // LEVELUP → IDLE: 부드러운 복귀
  { from: AnimState.LEVELUP, to: AnimState.IDLE, blendDuration: 0.15, priority: 0 },
  { from: AnimState.LEVELUP, to: AnimState.WALK, blendDuration: 0.12, priority: 1 },

  // COLLECT → 이전 상태: 즉시 복귀
  { from: AnimState.COLLECT, to: AnimState.IDLE, blendDuration: 0.05, priority: 0 },
  { from: AnimState.COLLECT, to: AnimState.WALK, blendDuration: 0.05, priority: 1 },

  // VICTORY → IDLE: 명시적 종료
  { from: AnimState.VICTORY, to: AnimState.IDLE, blendDuration: 0.2, priority: 0 },

  // ANY → ATTACK: 빠른 진입
  { from: -1, to: AnimState.ATTACK, blendDuration: 0.05, priority: 5 },
  // ANY → COLLECT: 즉시
  { from: -1, to: AnimState.COLLECT, blendDuration: 0, priority: 3 },
  // ANY → LEVELUP: 빠른 진입
  { from: -1, to: AnimState.LEVELUP, blendDuration: 0.05, priority: 4 },
  // ANY → VICTORY: 부드러운 진입
  { from: -1, to: AnimState.VICTORY, blendDuration: 0.15, priority: 4 },

  // ANY → DODGE_ROLL: 즉시 진입
  { from: -1, to: AnimState.DODGE_ROLL, blendDuration: 0, priority: 6 },
  // DODGE_ROLL → 이동 상태: 빠른 복귀
  { from: AnimState.DODGE_ROLL, to: AnimState.IDLE, blendDuration: 0.08, priority: 0 },
  { from: AnimState.DODGE_ROLL, to: AnimState.WALK, blendDuration: 0.08, priority: 1 },
  { from: AnimState.DODGE_ROLL, to: AnimState.BOOST, blendDuration: 0.08, priority: 2 },
];

/** 특정 전환의 블렌드 시간 조회 */
function getBlendDuration(from: AnimState, to: AnimState): number {
  // 구체적 규칙 먼저 검색
  for (const rule of TRANSITION_DURATIONS) {
    if (rule.from === from && rule.to === to) return rule.blendDuration;
  }
  // ANY 규칙 검색
  for (const rule of TRANSITION_DURATIONS) {
    if (rule.from === -1 && rule.to === to) return rule.blendDuration;
  }
  // 기본 블렌드
  return 0.15;
}

// ─── 이징 함수 ───

/** easeOutBack: 오버슈트 후 복귀 (공격 휘두르기 등) */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** easeOutExpo: 빠른 시작 후 점차 감속 (사망 스핀) */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** easeInBack: 당겼다 발사 (사망 축소) */
function easeInBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

// ─── 바운스 물리 (큐블링 핵심 개성) ───

/** 바운스 결과 */
export interface BounceResult {
  /** Y축 바운스 오프셋 */
  bounceY: number;
  /** Z축 힙스웨이 회전 (rad) */
  swayZ: number;
  /** X축 전방 기울임 (rad) */
  leanX: number;
}

/**
 * 걷기 바운스 물리 계산 — cos 기반 smooth 곡선
 * 큐블링의 핵심 개성: 뒤뚱뒤뚱 귀여운 움직임
 *
 * v16 Phase 3: 속도 비례 진폭 — 느리면 작은 동작, 빠르면 큰 동작
 */
export function computeBounce(
  elapsed: number,
  velocity: number,
  boosting: boolean,
): BounceResult {
  if (velocity < WALK_THRESHOLD && !boosting) {
    return { bounceY: 0, swayZ: 0, leanX: 0 };
  }

  const speedRatio = clamp01(velocity / MAX_SPEED);
  const walkFreq = Math.min(velocity / 80, 3.5);

  // v16: 속도 비례 바운스 진폭 (기존 고정 1.2 → 0.6~2.0)
  const bounceAmp = lerp(0.6, 2.0, speedRatio);
  const bounceY = (1 - Math.cos(elapsed * walkFreq * PI2)) * 0.5 * bounceAmp;

  // 힙스웨이: Z축 미세 회전 (좌우 흔들림) — 속도 비례
  const swayAmplitude = lerp(0.02, 0.06, speedRatio);
  const swayZ = Math.sin(elapsed * walkFreq * PI) * swayAmplitude;

  // 전방 기울임: 속도 비례 (느리면 거의 없음, 부스트면 강하게)
  const leanX = boosting ? -0.25 : lerp(-0.01, -0.12, speedRatio);

  return { bounceY, swayZ, leanX };
}

// ─── 개별 상태 애니메이션 계산 ───

/**
 * IDLE 상태 파트 변환 계산
 * - 호흡: body scaleY 미세 변화 (0.98~1.02, sin wave 2초 주기)
 * - 좌우 둘러보기: head Y축 회전 (±0.2rad, 4초 주기)
 * - 무게중심 이동: body 미세 X 오프셋 (±0.3, 8초 주기)
 * - 팔 자연스러운 흔들림: ±0.08rad, body와 역위상
 * - 다리: 거의 정지 (±0.02rad 미세 흔들림)
 */
function computeIdle(elapsed: number, out: PartTransforms): void {
  // 호흡 주기: 2초 (0.5 Hz)
  const breathPhase = Math.sin(elapsed * 0.5 * PI2);
  // body scaleY: 0.98 ~ 1.02
  out.body.scaleY = 1.0 + breathPhase * 0.02;

  // body posY 호흡 미세 (호흡에 동기화, 1.0 정도 높이 변화)
  out.body.posY = breathPhase * 0.3;

  // head posY: body 호흡 따라감 + 약간 추가
  out.head.posY = breathPhase * 0.4;

  // 좌우 둘러보기: 4초 주기, ±0.2rad (~11°)
  const lookPhase = Math.sin(elapsed * 0.25 * PI2); // 4초 주기
  out.head.rotY = lookPhase * 0.2;

  // 무게중심 이동: 8초 주기, ±0.3 단위
  const swayPhase = Math.sin(elapsed * 0.125 * PI2); // 8초 주기
  out.body.posX = swayPhase * 0.3;

  // 팔 자연스러운 흔들림: 1.5초 주기, ±0.08rad (~5°)
  const armSwingPhase = Math.sin(elapsed * (1 / 1.5) * PI2);
  out.armL.rotX = armSwingPhase * 0.08;
  out.armR.rotX = -armSwingPhase * 0.08; // body와 역위상

  // 다리 미세 흔들림: ±0.02rad (~1°), body 호흡 주기 따라감
  out.legL.rotX = breathPhase * 0.02;
  out.legR.rotX = -breathPhase * 0.02;
}

/**
 * WALK 상태 파트 변환 계산
 * - 교차 스윙: armL/legR 동위상, armR/legL 동위상 (자연스러운 걷기)
 * - v16: 스윙 각도 속도 비례 (0.15~0.6 rad)
 * - Y 바운스: bounceY 적용 (cos 곡선)
 * - Z 힙스웨이: body에 swayZ 적용
 * - 머리: 진행 방향 미세 기울임 (head pitch -0.05rad)
 */
function computeWalk(
  elapsed: number,
  velocity: number,
  bounce: BounceResult,
  out: PartTransforms,
): void {
  const speedRatio = clamp01(velocity / MAX_SPEED);
  const walkFreq = Math.min(velocity / 80, 3.5);
  // v16: 속도 비례 스윙 진폭 (기존 고정 0.44 → 0.15~0.6)
  const walkAmp = lerp(0.15, 0.6, speedRatio);

  // 교차 스윙 위상
  const swingPhase = Math.sin(elapsed * walkFreq * PI2);

  // 팔: armL + legR 동위상 (자연스러운 걷기)
  out.armL.rotX = swingPhase * walkAmp;
  out.armR.rotX = -swingPhase * walkAmp;

  // 다리: 팔과 반대 (교차) — 보폭도 속도 비례
  const strideAmp = lerp(0.15, 0.6, speedRatio);
  out.legL.rotX = -swingPhase * strideAmp;
  out.legR.rotX = swingPhase * strideAmp;

  // body: 바운스 + 힙스웨이
  out.body.posY = bounce.bounceY;
  out.body.rotZ = bounce.swayZ;
  out.body.rotX = bounce.leanX; // 속도 비례 전방 기울임

  // head: body 바운스 따라감 + 진행 방향 미세 기울임
  out.head.posY = bounce.bounceY;
  out.head.rotX = -0.05; // 살짝 앞을 봄
}

/**
 * BOOST 상태 파트 변환 계산
 * - 앞 기울임: body pitch -0.3rad (전방으로 기울어짐)
 * - 팔 잠금: 뒤로 벌림 (-1.05rad)
 * - 다리: 2배속 걷기 (walk freq × 2)
 * - 머리: -0.15rad pitch (전방 주시)
 * - v16: 속도 비례 진폭
 */
function computeBoost(
  elapsed: number,
  velocity: number,
  bounce: BounceResult,
  out: PartTransforms,
): void {
  const speedRatio = clamp01(velocity / MAX_SPEED);
  const walkFreq = Math.min(velocity / 80, 3.5);
  // v16: 속도 비례 다리 진폭 (부스트는 큰 동작)
  const legAmp = lerp(0.4, 0.75, speedRatio);

  // 다리: 2배속 걷기, 속도 비례 진폭
  const legSwing = Math.sin(elapsed * walkFreq * 2 * PI2) * legAmp;
  out.legL.rotX = legSwing;
  out.legR.rotX = -legSwing;

  // 팔 잠금: 뒤로 벌림
  out.armL.rotX = -1.05;
  out.armR.rotX = -1.05;

  // body: 전방 기울임 + 찌그러짐 = 속도감
  out.body.rotX = -0.3;
  out.body.scaleX = 1.06;
  out.body.scaleY = 0.92;
  out.body.posY = bounce.bounceY;
  out.body.rotZ = bounce.swayZ;

  // head: 전방 주시 (body 기울임 보상 + 추가 기울임)
  out.head.rotX = -0.15;
  out.head.posY = bounce.bounceY;
}

// ─── Phase 4B: 전투/이벤트 애니메이션 ───

/**
 * ATTACK 상태 파트 변환 계산 (원샷 0.4초)
 * - 팔R 휘두르기: rotX -2.0→0 rad (easeOutBack)
 * - body 미세 회전: rotY 0→0.2→0 (타겟 방향 트위스트)
 * - head: 약간 앞으로 기울임 (-0.1rad)
 */
function computeAttack(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / ATTACK_DURATION);

  // 팔R 휘두르기: -2.0 → 0 (easeOutBack으로 오버슈트)
  const armSwing = easeOutBack(t);
  out.armR.rotX = -2.0 * (1 - armSwing);

  // body rotY: 0→0.2→0 (삼각 펄스 — 전반부 올라가고 후반부 내려옴)
  const bodyTwist = t < 0.5 ? t * 2 : (1 - t) * 2;
  out.body.rotY = bodyTwist * 0.2;

  // head: 전방 기울임 (공격 집중)
  out.head.rotX = -0.1 * (1 - t); // 점차 복원

  // body 약간 앞으로 숙이기
  out.body.rotX = -0.05 * (1 - t);
}

/**
 * HIT 상태 파트 변환 계산 (원샷 0.3초)
 * - 넉백: body rotX 0.3rad (뒤로 젖힘)
 * - 찌그러짐: body scaleX 1.3, scaleY 0.7 → 복원 (squash & stretch)
 * - 고주파 진동: posX += sin(elapsed * 40) * 2 (0.3초간)
 */
function computeHit(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / HIT_DURATION);

  // 넉백: 뒤로 젖힘 → 복원 (빠르게 시작, 느리게 복귀)
  const knockbackT = 1 - t;
  out.body.rotX = 0.3 * knockbackT * knockbackT; // 제곱 감쇠

  // 찌그러짐 (squash & stretch): 시작 시 최대, 스프링 바운스로 복원
  const squashDecay = Math.exp(-t * 8); // 지수 감쇠
  out.body.scaleX = 1.0 + 0.3 * squashDecay;
  out.body.scaleY = 1.0 - 0.3 * squashDecay;

  // head도 따라서 찌그러짐
  out.head.scaleX = 1.0 + 0.15 * squashDecay;
  out.head.scaleY = 1.0 - 0.15 * squashDecay;

  // 고주파 진동 (흔들림): sin(elapsed * 40) * 2, 시간에 따라 감쇠
  const shake = Math.sin(elapsed * 40) * 2 * (1 - t);
  out.body.posX = shake;
  out.head.posX = shake * 0.7; // head는 덜 흔들림

  // head 뒤로 젖힘
  out.head.rotX = 0.15 * knockbackT;

  // 팔 벌어짐 (피격 충격)
  out.armL.rotX = -0.5 * knockbackT;
  out.armR.rotX = -0.5 * knockbackT;
}

/**
 * DEATH 상태 파트 변환 계산 (영구 2.0초, "코미컬 퐁" 사망)
 * - 720° 스핀: body rotY 0→4π (easeOutExpo)
 * - Y축 포물선: posY 0→30→-50
 * - 전체 축소: scaleX/Y 1→0 (easeInBack)
 * - head: 별도 더 빠르게 회전 (rotY 6π)
 * - 팔/다리: 벌어짐 (rotX ±1.5rad)
 * - 2초 후 완전 소멸 (scaleX/Y = 0)
 */
function computeDeath(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / DEATH_DURATION);

  // 720° 스핀 (body): easeOutExpo로 처음 빠르고 끝에 느려짐
  const spinProgress = easeOutExpo(t);
  out.body.rotY = spinProgress * 4 * PI; // 0 → 4π (720°)

  // Y축 포물선: 시작→최고점(30)→하강(-50)
  // 포물선 공식: y = -a(t-h)^2 + k, 최고점 t=0.3에서 y=30
  const peakT = 0.3;
  const peakY = 30;
  const fallEnd = -50;
  let posY: number;
  if (t < peakT) {
    // 상승 구간: 0→30 (sin 곡선으로 부드럽게)
    posY = peakY * Math.sin((t / peakT) * PI * 0.5);
  } else {
    // 하강 구간: 30→-50 (가속 낙하)
    const fallT = (t - peakT) / (1 - peakT);
    posY = peakY + (fallEnd - peakY) * fallT * fallT;
  }
  out.body.posY = posY;
  out.head.posY = posY;

  // 전체 축소: easeInBack (당겼다 줄어듦)
  const shrink = 1 - easeInBack(t);
  const scaleVal = Math.max(0, shrink);
  out.body.scaleX = scaleVal;
  out.body.scaleY = scaleVal;
  out.head.scaleX = scaleVal;
  out.head.scaleY = scaleVal;

  // head: 더 빠른 회전 (6π = 1080°)
  out.head.rotY = spinProgress * 6 * PI;

  // 팔/다리 벌어짐: 점차 최대로
  const limbSpread = Math.min(t * 3, 1); // 0.33초 안에 최대
  out.armL.rotX = -1.5 * limbSpread;
  out.armR.rotX = -1.5 * limbSpread;
  out.armL.rotZ = -0.5 * limbSpread; // 옆으로도 벌어짐
  out.armR.rotZ = 0.5 * limbSpread;
  out.legL.rotX = -1.5 * limbSpread;
  out.legR.rotX = 1.5 * limbSpread;
}

/**
 * SPAWN 상태 파트 변환 계산 (원샷 0.4초)
 * - 스케일 바운스: 0→1.3→0.9→1.0 (3단계 bounce)
 * - posY: -20→0 (아래서 솟아오름)
 * - 팔: 양쪽 벌어짐 rotX ±1.0 → 0 (만세 포즈에서 복원)
 */
function computeSpawn(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / SPAWN_DURATION);

  // 3단계 스케일 바운스: 0→1.3→0.9→1.0
  let scale: number;
  if (t < 0.4) {
    // Phase 1: 0→1.3 (빠른 확대)
    const p = t / 0.4;
    scale = 1.3 * p * p * (3 - 2 * p); // smoothstep
  } else if (t < 0.7) {
    // Phase 2: 1.3→0.9 (살짝 줄어듦)
    const p = (t - 0.4) / 0.3;
    scale = 1.3 + (0.9 - 1.3) * p;
  } else {
    // Phase 3: 0.9→1.0 (안착)
    const p = (t - 0.7) / 0.3;
    scale = 0.9 + (1.0 - 0.9) * p;
  }
  out.body.scaleX = scale;
  out.body.scaleY = scale;
  out.head.scaleX = scale;
  out.head.scaleY = scale;

  // posY: -20→0 (아래서 솟아오름, easeOut)
  const riseT = 1 - (1 - t) * (1 - t); // easeOutQuad
  out.body.posY = -20 * (1 - riseT);
  out.head.posY = -20 * (1 - riseT);

  // 팔: 만세(벌어짐) → 복원
  const armDecay = 1 - t;
  out.armL.rotX = -1.0 * armDecay;
  out.armR.rotX = -1.0 * armDecay;
  out.armL.rotZ = -0.3 * armDecay; // 옆으로도 벌어짐
  out.armR.rotZ = 0.3 * armDecay;
}

/**
 * LEVELUP 상태 파트 변환 계산 (원샷 0.8초)
 * - 점프: posY 0→15→0 (cos 곡선)
 * - 만세 포즈: armL rotX -2.5, armR rotX -2.5 (양팔 위로)
 * - body scaleY: 1.0→1.1→1.0 (기쁨 표현)
 * - head: rotX -0.2 (위를 바라봄)
 */
function computeLevelup(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / LEVELUP_DURATION);

  // 점프: cos 곡선 (0→15→0)
  // sin(t * π) = 0→1→0 곡선
  const jumpHeight = 15;
  out.body.posY = jumpHeight * Math.sin(t * PI);
  out.head.posY = jumpHeight * Math.sin(t * PI);

  // 만세 포즈: 빠르게 올리고 천천히 복원
  const armRaise = t < 0.3
    ? t / 0.3 // 빠르게 올림 (0.3초)
    : 1 - (t - 0.3) / 0.7; // 천천히 복원 (0.5초)
  const armTarget = -2.5; // 양팔 위로
  out.armL.rotX = armTarget * Math.max(0, armRaise);
  out.armR.rotX = armTarget * Math.max(0, armRaise);
  // 팔 옆으로 벌림 (만세)
  out.armL.rotZ = -0.4 * Math.max(0, armRaise);
  out.armR.rotZ = 0.4 * Math.max(0, armRaise);

  // body scaleY: 기쁨으로 살짝 커짐
  const joyScale = Math.sin(t * PI); // 0→1→0
  out.body.scaleY = 1.0 + 0.1 * joyScale;
  out.body.scaleX = 1.0 - 0.03 * joyScale; // 약간 좁아짐 (stretch)

  // head: 위를 바라봄
  out.head.rotX = -0.2 * joyScale;

  // 다리: 공중에서 살짝 오므림
  const legTuck = Math.sin(t * PI) * 0.3;
  out.legL.rotX = legTuck;
  out.legR.rotX = -legTuck;
}

/**
 * VICTORY 상태 파트 변환 계산 (루프 1.0초 주기)
 * - 제자리 춤: body rotY ±0.3rad (왕복)
 * - 팔: 교대 만세 (armL과 armR 번갈아 올라감)
 * - 다리: 작은 스텝 (rotX ±0.2)
 * - head: body 반대 방향 rotY (유연함)
 */
function computeVictory(elapsed: number, out: PartTransforms): void {
  // 루프: elapsed modulo period
  const phase = (elapsed % VICTORY_LOOP_PERIOD) / VICTORY_LOOP_PERIOD;
  const sinPhase = Math.sin(phase * PI2);
  const cosPhase = Math.cos(phase * PI2);

  // body: 좌우 춤 (rotY 왕복)
  out.body.rotY = sinPhase * 0.3;

  // head: body 반대 방향 (유연함)
  out.head.rotY = -sinPhase * 0.2;

  // 팔: 교대 만세 (하나 올라가면 하나 내려감)
  // armL: sin 위상, armR: cos 위상 (90° 차이 = 교대)
  out.armL.rotX = -1.5 - sinPhase * 1.0; // -2.5 ~ -0.5 (올라감~내려감)
  out.armR.rotX = -1.5 - cosPhase * 1.0;

  // 다리: 작은 스텝 (walk보다 느리고 작은 진폭)
  out.legL.rotX = sinPhase * 0.2;
  out.legR.rotX = -sinPhase * 0.2;

  // body: 미세 바운스 (춤 느낌)
  out.body.posY = Math.abs(sinPhase) * 2; // 0~2 범위 바운스
  out.head.posY = Math.abs(sinPhase) * 2;

  // body scaleY: 리듬감 있는 미세 변화
  out.body.scaleY = 1.0 + Math.abs(sinPhase) * 0.05;
}

/**
 * COLLECT 상태 파트 변환 계산 (원샷 0.25초)
 * - 짧은 팔 뻗기: armR rotX -1.5 → 0
 * - body 미세 기울임: rotX -0.1 (앞으로 살짝)
 */
function computeCollect(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / COLLECT_DURATION);

  // 팔R: 앞으로 뻗었다 복원 (빠른 easeOut)
  const reach = 1 - t * t; // 빠르게 감소
  out.armR.rotX = -1.5 * reach;

  // body: 앞으로 미세 기울임 (수집하려 숙이는 느낌)
  out.body.rotX = -0.1 * reach;

  // head: 아래를 봄 (수집 대상 주시)
  out.head.rotX = 0.1 * reach;
}

// ─── 에이전트별 애니메이션 상태 ───

interface AgentAnimState {
  /** 현재 상태 */
  current: AnimState;
  /** 이전 상태 (블렌딩용) */
  previous: AnimState;
  /** 원샷 복귀용: 원샷 애니메이션 직전의 이동 상태 */
  returnState: AnimState;
  /** 현재 상태 경과 시간 (초) */
  elapsed: number;
  /** 블렌드 팩터: 0=previous, 1=current */
  blendFactor: number;
  /** 블렌드 전환 시간 (초) */
  blendDuration: number;
  /** 전환 경과 시간 (초) */
  transitionElapsed: number;
  /** 활성 여부 */
  active: boolean;
  /** IDLE 시드 (에이전트별 위상 오프셋으로 동시 동작 방지) */
  idleSeed: number;
  /** HIT 플래시 타이머 (AgentInstances.tsx에서 참조) */
  hitFlashRemaining: number;
  /** v16: 2차 모션 상태 */
  secondary: SecondaryMotionState;
  /** v16: 개성 파라미터 */
  variation: AgentVariation;
  /** v16: 개성 생성용 agentId (캐시) */
  variationId: string;
  /** v16 Phase 6: 이전 프레임에서 점프 중이었는지 (착지 감지) */
  wasJumping: boolean;
  /** v16 Phase 6: 착지 스쿼시 남은 시간 (초, 0이면 비활성) */
  landSquashTime: number;
}

// ─── AnimInput: 외부에서 전달하는 에이전트 상태 ───

export interface AnimInput {
  velocity: number;
  boosting: boolean;
  /** false면 DEATH 트리거 (Phase 4B) */
  alive?: boolean;
  /** true면 HIT 트리거 (1프레임 이벤트) */
  wasHit?: boolean;
  /** true면 LEVELUP 트리거 (1프레임 이벤트) */
  wasLevelUp?: boolean;
  /** true면 ATTACK 트리거 (1프레임 이벤트) */
  wasAttack?: boolean;
  /** true면 COLLECT 트리거 (1프레임 이벤트) */
  wasCollect?: boolean;
  /** true면 VICTORY 루프 시작 */
  isVictory?: boolean;
  /** true면 SPAWN 트리거 (첫 등장) */
  wasSpawn?: boolean;
  /** v16: true면 DODGE_ROLL 트리거 (대시 E키) */
  wasDash?: boolean;
  /** v16: 이동 방향 heading (rad) — 하체 회전 기준 */
  moveAngle?: number;
  /** v16: 조준 방향 facing (rad) — 상체 회전 기준 */
  aimAngle?: number;
  /** v16: 에이전트 ID (per-agent variation 해시용) */
  agentId?: string;
  /** v16 Phase 6: 바이옴 인덱스 (0=plains, 1=forest, 2=desert, 3=snow, 4=swamp, 5=volcanic) */
  biomeIndex?: number;
  /** v16 Phase 6: 물 속 여부 (swamp/lake) */
  inWater?: boolean;
  /** v16 Phase 6: 경사 각도 (rad, 양수=오르막, 음수=내리막) */
  slopeAngle?: number;
  /** v16 Phase 6: 점프 중 여부 (지면에서 떠있음) */
  isJumping?: boolean;
}

// ─── 원샷 상태인지 판단 ───

/** 원샷 상태의 duration 조회 (루프/영구 상태는 -1) */
function getOneShotDuration(state: AnimState): number {
  switch (state) {
    case AnimState.ATTACK: return ATTACK_DURATION;
    case AnimState.HIT: return HIT_DURATION;
    case AnimState.SPAWN: return SPAWN_DURATION;
    case AnimState.LEVELUP: return LEVELUP_DURATION;
    case AnimState.COLLECT: return COLLECT_DURATION;
    case AnimState.DODGE_ROLL: return DODGE_ROLL_DURATION;
    // DEATH는 영구 (자동 복귀 없음)
    // VICTORY는 루프 (명시적 종료)
    default: return -1;
  }
}

/** 이동 상태인지 (IDLE/WALK/BOOST) */
function isLocomotionState(state: AnimState): boolean {
  return state === AnimState.IDLE || state === AnimState.WALK || state === AnimState.BOOST;
}

// ─── lerp 유틸 ───

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** smoothstep easing (easeInOut) for blend transitions */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 각도 차이 계산 (-PI ~ PI 범위) */
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > PI) d -= PI2;
  while (d < -PI) d += PI2;
  return d;
}

/** damped lerp: exponential decay toward target (frame-rate independent) */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** damped angle lerp: shortest-arc exponential decay */
function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = angleDiff(target, current);
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** 결정적 해시 (문자열 → 32비트 정수, FNV-1a) */
function simpleHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ─── v16 Phase 3: 2차 모션 상태 (per-agent) ───

interface SecondaryMotionState {
  /** 상체 관성 지연 — 현재 torso 방향 (rad) */
  torsoAngle: number;
  /** 머리 추적 — 현재 head yaw (rad) */
  headYaw: number;
  /** 장비 흔들림 위상 */
  equipPhase: number;
  /** 이전 프레임 heading (급회전 감지용) */
  prevHeading: number;
  /** 부드러운 속도 (가속/감속 easing) */
  smoothVelocity: number;
  /** 초기화 여부 */
  initialized: boolean;
}

function createSecondaryMotion(): SecondaryMotionState {
  return {
    torsoAngle: 0,
    headYaw: 0,
    equipPhase: 0,
    prevHeading: 0,
    smoothVelocity: 0,
    initialized: false,
  };
}

// ─── v16 Phase 3: 개성 파라미터 (per-agent, deterministic) ───

interface AgentVariation {
  /** 팔 진폭 배율 0.8~1.2 */
  armSwingScale: number;
  /** 보폭 배율 0.9~1.1 */
  strideScale: number;
  /** IDLE quirk 종류 0~4 */
  idleQuirk: number;
  /** IDLE quirk 간격 3~8초 */
  idleQuirkInterval: number;
  /** 바운스 주파수 미세 오프셋 0.95~1.05 */
  bounceFreqScale: number;
}

/** 기본 개성 (variation 미적용 시) */
const DEFAULT_VARIATION: AgentVariation = {
  armSwingScale: 1.0,
  strideScale: 1.0,
  idleQuirk: 0,
  idleQuirkInterval: 5,
  bounceFreqScale: 1.0,
};

/** agent ID에서 결정적 개성 생성 */
function generateVariation(agentId: string): AgentVariation {
  const h = simpleHash(agentId);
  return {
    armSwingScale: 0.8 + (h % 40) / 100,                   // 0.80~1.19
    strideScale: 0.9 + ((h >> 8) % 20) / 100,              // 0.90~1.09
    idleQuirk: (h >> 16) % 5,                               // 0~4
    idleQuirkInterval: 3 + ((h >> 20) % 50) / 10,           // 3.0~7.9
    bounceFreqScale: 0.95 + ((h >> 24) % 10) / 100,        // 0.95~1.04
  };
}

// ─── v16: DODGE_ROLL 애니메이션 ───

/**
 * DODGE_ROLL 상태 파트 변환 계산 (원샷 0.4초)
 * - 이동 방향으로 구르기: 몸체 전체 360° X축 회전
 * - 미세 Y 호프 (중간에 최대 3 units)
 * - 스케일 유지 (무적 표현은 별도 이펙트)
 */
function computeDodgeRoll(elapsed: number, out: PartTransforms): void {
  const t = clamp01(elapsed / DODGE_ROLL_DURATION);

  // 360° X축 회전 (easeInOut)
  const rollPhase = smoothstep(t);
  out.rollRotX = rollPhase * PI2;

  // Y 호프: sin 곡선 (0→3→0)
  out.body.posY = Math.sin(t * PI) * 3;
  out.head.posY = out.body.posY;

  // 팔/다리 오므림 (구르기 느낌)
  const tuck = Math.sin(t * PI); // 0→1→0
  out.armL.rotX = -1.2 * tuck;
  out.armR.rotX = -1.2 * tuck;
  out.legL.rotX = 0.8 * tuck;
  out.legR.rotX = -0.8 * tuck;

  // body 약간 압축 (구르기 중 둥글게)
  out.body.scaleY = 1.0 - 0.1 * tuck;
  out.body.scaleX = 1.0 + 0.05 * tuck;
}

// ─── 메인 클래스 ───

/**
 * AnimationStateMachine — 60 에이전트 일괄 관리
 *
 * Three.js 의존 없음. 숫자 연산만 수행.
 * AgentInstances.tsx에서 useRef로 인스턴스 유지하고
 * useFrame에서 update() → getTransforms() 호출.
 */
export class AnimationStateMachine {
  private states: AgentAnimState[];
  private readonly maxAgents: number;

  // 재사용 변환 버퍼 (GC 방지)
  private readonly _prevTransforms: PartTransforms;
  private readonly _currTransforms: PartTransforms;

  constructor(maxAgents: number) {
    this.maxAgents = maxAgents;
    this.states = [];

    for (let i = 0; i < maxAgents; i++) {
      this.states.push({
        current: AnimState.IDLE,
        previous: AnimState.IDLE,
        returnState: AnimState.IDLE,
        elapsed: 0,
        blendFactor: 1, // 완전히 현재 상태
        blendDuration: 0,
        transitionElapsed: 0,
        active: false,
        // 에이전트별 위상 오프셋: IDLE 애니메이션이 동시에 움직이지 않도록
        idleSeed: Math.random() * 10,
        hitFlashRemaining: 0,
        secondary: createSecondaryMotion(),
        variation: { ...DEFAULT_VARIATION },
        variationId: '',
        wasJumping: false,
        landSquashTime: 0,
      });
    }

    this._prevTransforms = createDefaultTransforms();
    this._currTransforms = createDefaultTransforms();
  }

  /**
   * 상태 전환 요청
   * 우선순위에 따라 전환 결정: 높은 우선순위 상태가 낮은 상태를 인터럽트
   */
  requestTransition(agentIndex: number, newState: AnimState): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    if (!state.active) return;

    // 이미 같은 상태
    if (state.current === newState) return;

    // 블렌딩 중일 때: 이미 newState로 전환 중이면 무시
    if (state.blendFactor < 1 && state.current === newState) return;

    // 우선순위 검사: 현재 블렌딩 중이면 현재 상태 우선순위 기준
    const currentPriority = STATE_PRIORITY[state.current] ?? 0;
    const newPriority = STATE_PRIORITY[newState] ?? 0;

    // 현재 블렌딩 중이고, 새 상태가 더 낮은 우선순위면 무시
    // (단, 블렌드가 완료된 상태면 자유롭게 전환 가능)
    if (state.blendFactor < 1 && newPriority < currentPriority) return;

    // DEATH 상태에서는 다른 상태로 전환 불가 (deactivate만 가능)
    if (state.current === AnimState.DEATH && newState !== AnimState.SPAWN) return;

    // 원샷/루프 상태 진입 시 returnState 기록 (이동 상태만)
    if (isLocomotionState(state.current)) {
      state.returnState = state.current;
    }

    // 전환 시작
    state.previous = state.current;
    state.current = newState;
    state.blendDuration = getBlendDuration(state.previous, newState);
    state.transitionElapsed = 0;
    state.blendFactor = state.blendDuration > 0 ? 0 : 1;
    state.elapsed = 0; // 새 상태에서 경과 시간 리셋

    // HIT 시 플래시 타이머 설정
    if (newState === AnimState.HIT) {
      state.hitFlashRemaining = 0.08; // 80ms 흰색 플래시
    }
  }

  /**
   * 외부 입력 기반 자동 상태 전환 + 시간 업데이트
   * 매 프레임 호출: velocity/boosting + Phase 4B 이벤트 플래그 처리
   * v16 Phase 3: 2차 모션 + 개성 파라미터 업데이트
   */
  updateAgent(agentIndex: number, input: AnimInput, dt: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    if (!state.active) return;

    // ─── v16: 개성 파라미터 lazy 초기화 (agentId 기반) ───
    if (input.agentId && input.agentId !== state.variationId) {
      state.variationId = input.agentId;
      const v = generateVariation(input.agentId);
      state.variation.armSwingScale = v.armSwingScale;
      state.variation.strideScale = v.strideScale;
      state.variation.idleQuirk = v.idleQuirk;
      state.variation.idleQuirkInterval = v.idleQuirkInterval;
      state.variation.bounceFreqScale = v.bounceFreqScale;
    }

    // ─── Phase 4B: 이벤트 기반 상태 전환 (우선순위 높은 순서) ───

    // DEATH: 최우선 (alive === false)
    if (input.alive === false && state.current !== AnimState.DEATH) {
      this.requestTransition(agentIndex, AnimState.DEATH);
    }

    // SPAWN: 등장 시
    if (input.wasSpawn) {
      this.requestTransition(agentIndex, AnimState.SPAWN);
    }

    // HIT: 피격 시
    if (input.wasHit && state.current !== AnimState.DEATH) {
      this.requestTransition(agentIndex, AnimState.HIT);
    }

    // v16: DODGE_ROLL (대시 E키)
    if (input.wasDash && state.current !== AnimState.DEATH && state.current !== AnimState.HIT
        && state.current !== AnimState.DODGE_ROLL) {
      this.requestTransition(agentIndex, AnimState.DODGE_ROLL);
    }

    // ATTACK: 전투 시
    if (input.wasAttack && state.current !== AnimState.DEATH && state.current !== AnimState.HIT) {
      this.requestTransition(agentIndex, AnimState.ATTACK);
    }

    // LEVELUP: 레벨업 시
    if (input.wasLevelUp && state.current !== AnimState.DEATH) {
      this.requestTransition(agentIndex, AnimState.LEVELUP);
    }

    // COLLECT: 수집 시
    if (input.wasCollect && state.current !== AnimState.DEATH && state.current !== AnimState.HIT) {
      this.requestTransition(agentIndex, AnimState.COLLECT);
    }

    // VICTORY: 승리 루프
    if (input.isVictory && state.current !== AnimState.DEATH && state.current !== AnimState.VICTORY) {
      this.requestTransition(agentIndex, AnimState.VICTORY);
    }

    // ─── 자동 상태 전환 결정 (이동 상태) ───
    const { velocity, boosting } = input;

    let targetState: AnimState;
    if (boosting) {
      targetState = AnimState.BOOST;
    } else if (velocity > WALK_THRESHOLD) {
      targetState = AnimState.WALK;
    } else {
      targetState = AnimState.IDLE;
    }

    // 현재 상태가 이동 상태(IDLE/WALK/BOOST)일 때만 자동 전환
    const currentPriority = STATE_PRIORITY[state.current] ?? 0;
    if (currentPriority <= (STATE_PRIORITY[AnimState.BOOST] ?? 2)) {
      this.requestTransition(agentIndex, targetState);
    }

    // ─── returnState 업데이트 (원샷 복귀 대상 추적) ───
    // 원샷 상태 중에도 velocity/boosting이 변할 수 있으므로 returnState 갱신
    if (!isLocomotionState(state.current) && state.current !== AnimState.DEATH) {
      state.returnState = targetState;
    }

    // ─── 시간 업데이트 ───
    state.elapsed += dt;

    // HIT 플래시 타이머 감소
    if (state.hitFlashRemaining > 0) {
      state.hitFlashRemaining = Math.max(0, state.hitFlashRemaining - dt);
    }

    // 블렌드 진행
    if (state.blendFactor < 1) {
      state.transitionElapsed += dt;
      state.blendFactor = state.blendDuration > 0
        ? clamp01(state.transitionElapsed / state.blendDuration)
        : 1;
    }

    // ─── 원샷 애니메이션 자동 복귀 ───
    const oneShotDuration = getOneShotDuration(state.current);
    if (oneShotDuration > 0 && state.elapsed >= oneShotDuration) {
      // 원샷 완료: returnState로 복귀
      this.requestTransition(agentIndex, state.returnState);
    }

    // ─── v16 Phase 3: 2차 모션 업데이트 ───
    const sec = state.secondary;
    if (!sec.initialized) {
      sec.torsoAngle = input.aimAngle ?? input.moveAngle ?? 0;
      sec.headYaw = sec.torsoAngle;
      sec.prevHeading = input.moveAngle ?? 0;
      sec.smoothVelocity = velocity;
      sec.initialized = true;
    }

    // 부드러운 속도 (가속/감속 easing)
    sec.smoothVelocity = damp(sec.smoothVelocity, velocity, 8, dt);

    // 상체 관성 지연: aimAngle로 spring decay (0.1~0.2초 뒤따라옴)
    const targetTorso = input.aimAngle ?? input.moveAngle ?? sec.torsoAngle;
    sec.torsoAngle = dampAngle(sec.torsoAngle, targetTorso, 10, dt);

    // 머리 추적: aimAngle 방향으로 약간 더 빠르게 (lookAhead)
    const targetHead = input.aimAngle ?? input.moveAngle ?? sec.headYaw;
    sec.headYaw = dampAngle(sec.headYaw, targetHead, 18, dt);

    // 장비 흔들림 위상 (walkCycle에 연동)
    const walkFreq = Math.min(velocity / 80, 3.5);
    sec.equipPhase += walkFreq * dt * PI2;

    sec.prevHeading = input.moveAngle ?? sec.prevHeading;

    // v16 Phase 6: Landing squash detection
    const isJumping = !!input.isJumping;
    if (state.wasJumping && !isJumping) {
      // Transition from airborne to ground → trigger squash
      state.landSquashTime = 0.25; // 250ms squash
    }
    state.wasJumping = isJumping;
    if (state.landSquashTime > 0) {
      state.landSquashTime = Math.max(0, state.landSquashTime - dt);
    }
  }

  /**
   * 전체 에이전트 시간 업데이트 (updateAgent 대신 일괄 사용 시)
   */
  update(dt: number): void {
    // 일괄 업데이트 시에는 elapsed만 진행
    // (실제 상태 전환은 updateAgent에서 개별 처리)
    for (let i = 0; i < this.maxAgents; i++) {
      const state = this.states[i];
      if (!state.active) continue;

      state.elapsed += dt;

      if (state.hitFlashRemaining > 0) {
        state.hitFlashRemaining = Math.max(0, state.hitFlashRemaining - dt);
      }

      if (state.blendFactor < 1) {
        state.transitionElapsed += dt;
        state.blendFactor = state.blendDuration > 0
          ? clamp01(state.transitionElapsed / state.blendDuration)
          : 1;
      }

      // 원샷 자동 복귀
      const oneShotDuration = getOneShotDuration(state.current);
      if (oneShotDuration > 0 && state.elapsed >= oneShotDuration) {
        this.requestTransition(i, state.returnState);
      }
    }
  }

  /**
   * 특정 에이전트의 최종 파트 변환 계산
   * 블렌딩 적용: previous → current 전환 중이면 lerp
   * v16 Phase 3: 2차 모션 + 개성 파라미터 + 상/하체 분리 오버레이
   */
  getTransforms(agentIndex: number, velocity: number, boosting: boolean, moveAngle?: number, aimAngle?: number, slopeAngle?: number, inWater?: boolean, isJumping?: boolean): PartTransforms {
    const state = this.states[agentIndex];
    if (!state || !state.active) return createDefaultTransforms();

    // 에이전트별 위상 오프셋 적용된 경과 시간
    const seededElapsed = state.elapsed + state.idleSeed;

    let result: PartTransforms;

    // 블렌드 완료: 현재 상태만 계산
    if (state.blendFactor >= 1) {
      result = this.computeStateTransforms(state.current, seededElapsed, velocity, boosting);
    } else {
      // 블렌딩 중: 두 상태 계산 후 lerp
      const prev = this._prevTransforms;
      const curr = this._currTransforms;
      this.fillStateTransforms(state.previous, seededElapsed, velocity, boosting, prev);
      this.fillStateTransforms(state.current, seededElapsed, velocity, boosting, curr);

      const t = smoothstep(state.blendFactor);

      result = {
        head: {
          rotX: lerp(prev.head.rotX, curr.head.rotX, t),
          rotY: lerp(prev.head.rotY, curr.head.rotY, t),
          rotZ: lerp(prev.head.rotZ, curr.head.rotZ, t),
          posX: lerp(prev.head.posX, curr.head.posX, t),
          posY: lerp(prev.head.posY, curr.head.posY, t),
          posZ: lerp(prev.head.posZ, curr.head.posZ, t),
          scaleX: lerp(prev.head.scaleX, curr.head.scaleX, t),
          scaleY: lerp(prev.head.scaleY, curr.head.scaleY, t),
        },
        body: {
          rotX: lerp(prev.body.rotX, curr.body.rotX, t),
          rotY: lerp(prev.body.rotY, curr.body.rotY, t),
          rotZ: lerp(prev.body.rotZ, curr.body.rotZ, t),
          posX: lerp(prev.body.posX, curr.body.posX, t),
          posY: lerp(prev.body.posY, curr.body.posY, t),
          posZ: lerp(prev.body.posZ, curr.body.posZ, t),
          scaleX: lerp(prev.body.scaleX, curr.body.scaleX, t),
          scaleY: lerp(prev.body.scaleY, curr.body.scaleY, t),
        },
        armL: {
          rotX: lerp(prev.armL.rotX, curr.armL.rotX, t),
          rotZ: lerp(prev.armL.rotZ, curr.armL.rotZ, t),
        },
        armR: {
          rotX: lerp(prev.armR.rotX, curr.armR.rotX, t),
          rotZ: lerp(prev.armR.rotZ, curr.armR.rotZ, t),
        },
        legL: { rotX: lerp(prev.legL.rotX, curr.legL.rotX, t) },
        legR: { rotX: lerp(prev.legR.rotX, curr.legR.rotX, t) },
        lowerBodyRotY: lerp(prev.lowerBodyRotY, curr.lowerBodyRotY, t),
        upperBodyRotY: lerp(prev.upperBodyRotY, curr.upperBodyRotY, t),
        rollRotX: lerp(prev.rollRotX, curr.rollRotX, t),
      };
    }

    // ─── v16 Phase 3: 개성 파라미터 적용 ───
    const v = state.variation;
    result.armL.rotX *= v.armSwingScale;
    result.armR.rotX *= v.armSwingScale;
    result.legL.rotX *= v.strideScale;
    result.legR.rotX *= v.strideScale;

    // ─── v16 Phase 3: 개성 IDLE quirk (대기 중 고유 동작) ───
    if (state.current === AnimState.IDLE && velocity < WALK_THRESHOLD) {
      const quirkTime = seededElapsed % v.idleQuirkInterval;
      // quirk가 발동하는 시간대 (1초간)
      if (quirkTime < 1.0) {
        const qt = quirkTime; // 0~1 범위
        const quirkStrength = Math.sin(qt * PI); // 0→1→0
        switch (v.idleQuirk) {
          case 0: // 고개 갸우뚱 (Z축 tilt)
            result.head.rotZ += quirkStrength * 0.15;
            break;
          case 1: // 발 구르기 (한쪽 다리 빠른 진동)
            result.legR.rotX += Math.sin(qt * PI2 * 3) * 0.12 * quirkStrength;
            break;
          case 2: // 팔 스트레칭 (양팔 위로)
            result.armL.rotX -= quirkStrength * 0.5;
            result.armR.rotX -= quirkStrength * 0.5;
            break;
          case 3: // 주위 둘러보기 (머리 빠른 좌우)
            result.head.rotY += Math.sin(qt * PI2 * 2) * 0.25 * quirkStrength;
            break;
          case 4: // 머리 긁기 (한쪽 팔만 올림)
            result.armR.rotX -= quirkStrength * 1.2;
            result.head.rotZ -= quirkStrength * 0.08;
            break;
        }
      }
    }

    // ─── v16 Phase 3: 2차 모션 오버레이 ───
    const sec = state.secondary;
    if (sec.initialized && velocity > WALK_THRESHOLD) {
      // 상체 관성 지연: torso 방향과 aimAngle의 차이를 body.rotY에 추가
      const torsoLag = angleDiff(sec.torsoAngle, aimAngle ?? moveAngle ?? 0);
      // 작은 값만 추가 (최대 ±0.15 rad ≈ 8.6°)
      result.body.rotY += clamp01(Math.abs(torsoLag) / PI) * torsoLag * 0.3;

      // 머리 추적 (lookAhead): aimAngle 방향으로 머리가 약간 더 회전
      const headLead = angleDiff(sec.headYaw, sec.torsoAngle);
      result.head.rotY += headLead * 0.2;

      // 장비 흔들림 (진자 운동): walk cycle에 연동된 미세 진동
      const equipSway = Math.sin(sec.equipPhase * 1.3) * 0.04;
      result.body.rotZ += equipSway;
    }

    // ─── v16 Phase 3: 상/하체 분리 ───
    if (moveAngle !== undefined && aimAngle !== undefined) {
      // heading(facing)은 AgentInstances에서 aimAngle 기준으로 전체 회전을 적용
      // 하체는 moveAngle 방향, 상체는 aimAngle 방향
      let twist = angleDiff(moveAngle, aimAngle);
      // 최대 twist 각도 제한 (±60°)
      if (twist > MAX_TWIST_ANGLE) twist = MAX_TWIST_ANGLE;
      if (twist < -MAX_TWIST_ANGLE) twist = -MAX_TWIST_ANGLE;

      // lowerBodyRotY: 하체를 moveAngle 방향으로 회전 (상체 기준으로 상대적)
      result.lowerBodyRotY = twist;
      // upperBodyRotY: 상체는 0 (에이전트의 facing = aimAngle이 이미 기본 방향)
      result.upperBodyRotY = 0;
    }

    // ─── v16 Phase 6: Terrain-reactive overlays ───

    // 1. Slope tilt: 경사면에서 상체 기울임 (±15° = ±0.26 rad)
    if (slopeAngle !== undefined && slopeAngle !== 0 && velocity > WALK_THRESHOLD) {
      const slopeTilt = clamp(slopeAngle, -0.26, 0.26);
      result.body.rotX += slopeTilt;
      result.head.rotX += slopeTilt * 0.5; // 머리는 절반만 기울임
    }

    // 2. Swimming motion: 물 속일 때 다리 숨기고 팔 수영 동작
    if (inWater) {
      // 다리 접기 (시각적으로 숨김)
      result.legL.rotX = 0.8; // 뒤로 접힘
      result.legR.rotX = 0.8;
      // 팔 수영 크롤 모션
      const swimPhase = seededElapsed * 3.0; // 빠른 수영 주기
      result.armL.rotX = Math.sin(swimPhase) * 1.2;
      result.armR.rotX = Math.sin(swimPhase + PI) * 1.2;
      result.armL.rotZ = -0.3; // 팔 벌림
      result.armR.rotZ = 0.3;
      // 몸체 약간 앞으로 기울임 (수영 자세)
      result.body.rotX += 0.15;
      // 바운스 억제 (물에서는 부유감)
      result.body.posY *= 0.3;
    }

    // 3. Jump animation: 공중에서 팔 위로 + 착지 시 스쿼시
    if (isJumping) {
      // 팔 올림 (공중 자세)
      result.armL.rotX -= 0.6;
      result.armR.rotX -= 0.6;
      result.armL.rotZ -= 0.2;
      result.armR.rotZ += 0.2;
      // 다리 살짝 오므림
      result.legL.rotX += 0.2;
      result.legR.rotX -= 0.2;
    }

    // 4. Landing squash: 착지 시 바디 찌그러짐 + 복원
    if (state.landSquashTime > 0) {
      const landT = state.landSquashTime / 0.25; // 1→0 decay
      const squash = landT * 0.25; // max 25% squash
      result.body.scaleX = 1.0 + squash;
      result.body.scaleY = 1.0 - squash;
      result.head.scaleX = 1.0 + squash * 0.5;
      result.head.scaleY = 1.0 - squash * 0.5;
      // 다리 약간 벌림 (착지 자세)
      result.legL.rotX += squash * 0.6;
      result.legR.rotX -= squash * 0.6;
    }

    return result;
  }

  /**
   * 에이전트의 현재 애니메이션 상태 정보 조회
   */
  getState(agentIndex: number): {
    state: AnimState;
    elapsed: number;
    blendFactor: number;
    prevState: AnimState;
  } | null {
    const s = this.states[agentIndex];
    if (!s || !s.active) return null;
    return {
      state: s.current,
      elapsed: s.elapsed,
      blendFactor: s.blendFactor,
      prevState: s.previous,
    };
  }

  /**
   * HIT 플래시 상태 조회 (AgentInstances.tsx에서 사용)
   * @returns 잔여 플래시 시간 (0이면 플래시 없음)
   */
  getHitFlashRemaining(agentIndex: number): number {
    const s = this.states[agentIndex];
    if (!s || !s.active) return 0;
    return s.hitFlashRemaining;
  }

  /** 에이전트 활성화 (join) */
  activate(agentIndex: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    state.active = true;
    state.current = AnimState.IDLE;
    state.previous = AnimState.IDLE;
    state.returnState = AnimState.IDLE;
    state.elapsed = 0;
    state.blendFactor = 1;
    state.transitionElapsed = 0;
    state.hitFlashRemaining = 0;
    // idleSeed는 유지 (재접속 시 다른 위상)
    // v16: 2차 모션 리셋
    state.secondary = createSecondaryMotion();
  }

  /** 에이전트 비활성화 (leave) — DEATH 포함 모든 상태 리셋 */
  deactivate(agentIndex: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    state.active = false;
    state.current = AnimState.IDLE;
    state.previous = AnimState.IDLE;
    state.returnState = AnimState.IDLE;
    state.hitFlashRemaining = 0;
    // v16: 2차 모션 리셋
    state.secondary = createSecondaryMotion();
  }

  /** 에이전트 활성 여부 */
  isActive(agentIndex: number): boolean {
    return agentIndex >= 0 && agentIndex < this.maxAgents && this.states[agentIndex].active;
  }

  // ─── 내부: 상태별 변환 계산 ───

  private computeStateTransforms(
    animState: AnimState,
    elapsed: number,
    velocity: number,
    boosting: boolean,
  ): PartTransforms {
    const out = createDefaultTransforms();
    this.fillStateTransforms(animState, elapsed, velocity, boosting, out);
    return out;
  }

  private fillStateTransforms(
    animState: AnimState,
    elapsed: number,
    velocity: number,
    boosting: boolean,
    out: PartTransforms,
  ): void {
    // 기본값 리셋
    out.head.rotX = 0; out.head.rotY = 0; out.head.rotZ = 0;
    out.head.posX = 0; out.head.posY = 0; out.head.posZ = 0;
    out.head.scaleX = 1; out.head.scaleY = 1;
    out.body.rotX = 0; out.body.rotY = 0; out.body.rotZ = 0;
    out.body.posX = 0; out.body.posY = 0; out.body.posZ = 0;
    out.body.scaleX = 1; out.body.scaleY = 1;
    out.armL.rotX = 0; out.armL.rotZ = 0;
    out.armR.rotX = 0; out.armR.rotZ = 0;
    out.legL.rotX = 0;
    out.legR.rotX = 0;
    out.lowerBodyRotY = 0;
    out.upperBodyRotY = 0;
    out.rollRotX = 0;

    switch (animState) {
      case AnimState.IDLE:
        computeIdle(elapsed, out);
        break;

      case AnimState.WALK: {
        const bounce = computeBounce(elapsed, velocity, false);
        computeWalk(elapsed, velocity, bounce, out);
        break;
      }

      case AnimState.BOOST: {
        const bounce = computeBounce(elapsed, velocity, true);
        computeBoost(elapsed, velocity, bounce, out);
        break;
      }

      case AnimState.ATTACK:
        computeAttack(elapsed, out);
        break;

      case AnimState.HIT:
        computeHit(elapsed, out);
        break;

      case AnimState.DEATH:
        computeDeath(elapsed, out);
        break;

      case AnimState.SPAWN:
        computeSpawn(elapsed, out);
        break;

      case AnimState.LEVELUP:
        computeLevelup(elapsed, out);
        break;

      case AnimState.VICTORY:
        computeVictory(elapsed, out);
        break;

      case AnimState.COLLECT:
        computeCollect(elapsed, out);
        break;

      case AnimState.DODGE_ROLL:
        computeDodgeRoll(elapsed, out);
        break;

      default:
        computeIdle(elapsed, out);
        break;
    }
  }
}
