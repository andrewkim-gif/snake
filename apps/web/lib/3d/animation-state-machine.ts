/**
 * animation-state-machine.ts — 큐블링 애니메이션 상태 머신
 *
 * Three.js 의존 없는 순수 클래스. 숫자 연산만 수행.
 * 2D Canvas에도 재사용 가능하도록 설계.
 *
 * 출력: 파트별 회전(rad), 오프셋(unit), 스케일 — Matrix4 변환은 AgentInstances.tsx에서 수행
 *
 * Phase 4A: IDLE, WALK, BOOST 3상태 + 블렌딩 전환
 * (ATTACK, HIT, DEATH, SPAWN, LEVELUP, VICTORY, COLLECT는 Phase 4B에서 추가)
 */

import { AnimState } from '@agent-survivor/shared';

// ─── 상수 ───

const PI = Math.PI;
const PI2 = Math.PI * 2;

/** 속도 임계값: 이 이하이면 IDLE */
const WALK_THRESHOLD = 5;

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
  // SPAWN → IDLE: 느린 전환
  { from: AnimState.SPAWN, to: AnimState.IDLE, blendDuration: 0.2, priority: 0 },
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
 */
export function computeBounce(
  elapsed: number,
  velocity: number,
  boosting: boolean,
): BounceResult {
  if (velocity < WALK_THRESHOLD && !boosting) {
    return { bounceY: 0, swayZ: 0, leanX: 0 };
  }

  const walkFreq = Math.min(velocity / 80, 3.5);
  const boostMul = boosting ? 1.5 : 1.0;

  // cos 기반 smooth 바운스 (발 딛을 때마다 올라감)
  // cos(0)=1 → 시작점이 높음, cos(π)=-1 → 낮은 점
  // (1 - cos) / 2 → 0~1 범위, 바닥에서 시작해서 올라감
  const amplitude = 1.2 * boostMul;
  const bounceY = (1 - Math.cos(elapsed * walkFreq * PI2)) * 0.5 * amplitude;

  // 힙스웨이: Z축 미세 회전 (좌우 흔들림)
  const swayAmplitude = 0.04 * boostMul;
  const swayZ = Math.sin(elapsed * walkFreq * PI) * swayAmplitude;

  // 전방 기울임: 부스트 시 더 강하게
  const leanX = boosting ? -0.25 : -0.03;

  return { bounceY, swayZ, leanX };
}

// ─── 개별 상태 애니메이션 계산 ───

/**
 * IDLE 상태 파트 변환 계산
 * - 호흡: body scaleY 미세 변화 (0.98~1.02, sin wave 2초 주기)
 * - 좌우 둘러보기: head Y축 회전 (±0.2rad, 4~6초 랜덤→4초 고정 주기, lerp 전환)
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
  // sin 커브의 부드러운 왕복을 위해 더 느린 주파수 사용
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
 * - 스윙 각도: ±0.44rad (≈25°), velocity 비례 주기
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
  const walkFreq = Math.min(velocity / 80, 3.5);
  const walkAmp = 0.44; // ≈25°

  // 교차 스윙 위상
  const swingPhase = Math.sin(elapsed * walkFreq * PI2);

  // 팔: armL + legR 동위상 (자연스러운 걷기)
  out.armL.rotX = swingPhase * walkAmp;
  out.armR.rotX = -swingPhase * walkAmp;

  // 다리: 팔과 반대 (교차)
  out.legL.rotX = -swingPhase * walkAmp;
  out.legR.rotX = swingPhase * walkAmp;

  // body: 바운스 + 힙스웨이
  out.body.posY = bounce.bounceY;
  out.body.rotZ = bounce.swayZ;
  out.body.rotX = bounce.leanX; // 미세 전방 기울임

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
 * - bounce: 더 큰 amplitude (walk의 1.5배)
 */
function computeBoost(
  elapsed: number,
  velocity: number,
  bounce: BounceResult,
  out: PartTransforms,
): void {
  const walkFreq = Math.min(velocity / 80, 3.5);
  const walkAmp = 0.44;

  // 다리: 2배속 걷기, 진폭 1.3배
  const legSwing = Math.sin(elapsed * walkFreq * 2 * PI2) * walkAmp * 1.3;
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

// ─── 에이전트별 애니메이션 상태 ───

interface AgentAnimState {
  /** 현재 상태 */
  current: AnimState;
  /** 이전 상태 (블렌딩용) */
  previous: AnimState;
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
}

// ─── AnimInput: 외부에서 전달하는 에이전트 상태 ───

export interface AnimInput {
  velocity: number;
  boosting: boolean;
  // Phase 4B에서 추가될 필드:
  // alive: boolean;
  // wasHit: boolean;
  // wasLevelUp: boolean;
  // wasKill: boolean;
  // wasCollect: boolean;
}

// ─── lerp 유틸 ───

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** smoothstep easing (easeInOut) for blend transitions */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
        elapsed: 0,
        blendFactor: 1, // 완전히 현재 상태
        blendDuration: 0,
        transitionElapsed: 0,
        active: false,
        // 에이전트별 위상 오프셋: IDLE 애니메이션이 동시에 움직이지 않도록
        idleSeed: Math.random() * 10,
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

    // 전환 시작
    state.previous = state.current;
    state.current = newState;
    state.blendDuration = getBlendDuration(state.previous, newState);
    state.transitionElapsed = 0;
    state.blendFactor = state.blendDuration > 0 ? 0 : 1;
    state.elapsed = 0; // 새 상태에서 경과 시간 리셋
  }

  /**
   * 외부 입력 기반 자동 상태 전환 + 시간 업데이트
   * 매 프레임 호출: velocity/boosting으로 IDLE/WALK/BOOST 판단
   */
  updateAgent(agentIndex: number, input: AnimInput, dt: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    if (!state.active) return;

    // ─── 자동 상태 전환 결정 ───
    const { velocity, boosting } = input;

    // Phase 4A: IDLE / WALK / BOOST 3상태만
    let targetState: AnimState;
    if (boosting) {
      targetState = AnimState.BOOST;
    } else if (velocity > WALK_THRESHOLD) {
      targetState = AnimState.WALK;
    } else {
      targetState = AnimState.IDLE;
    }

    // 현재 상태가 Phase 4B 전용 상태(ATTACK, HIT 등)이면 자동 전환 안함
    // (해당 상태들은 자체 duration이 끝나면 자동 복귀)
    const currentPriority = STATE_PRIORITY[state.current] ?? 0;
    if (currentPriority <= (STATE_PRIORITY[AnimState.BOOST] ?? 2)) {
      this.requestTransition(agentIndex, targetState);
    }

    // ─── 시간 업데이트 ───
    state.elapsed += dt;

    // 블렌드 진행
    if (state.blendFactor < 1) {
      state.transitionElapsed += dt;
      state.blendFactor = state.blendDuration > 0
        ? clamp01(state.transitionElapsed / state.blendDuration)
        : 1;
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

      if (state.blendFactor < 1) {
        state.transitionElapsed += dt;
        state.blendFactor = state.blendDuration > 0
          ? clamp01(state.transitionElapsed / state.blendDuration)
          : 1;
      }
    }
  }

  /**
   * 특정 에이전트의 최종 파트 변환 계산
   * 블렌딩 적용: previous → current 전환 중이면 lerp
   */
  getTransforms(agentIndex: number, velocity: number, boosting: boolean): PartTransforms {
    const state = this.states[agentIndex];
    if (!state || !state.active) return createDefaultTransforms();

    // 에이전트별 위상 오프셋 적용된 경과 시간
    const seededElapsed = state.elapsed + state.idleSeed;

    // 블렌드 완료: 현재 상태만 계산
    if (state.blendFactor >= 1) {
      return this.computeStateTransforms(state.current, seededElapsed, velocity, boosting);
    }

    // 블렌딩 중: 두 상태 계산 후 lerp
    const prev = this._prevTransforms;
    const curr = this._currTransforms;
    this.fillStateTransforms(state.previous, seededElapsed, velocity, boosting, prev);
    this.fillStateTransforms(state.current, seededElapsed, velocity, boosting, curr);

    const t = smoothstep(state.blendFactor);

    return {
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
    };
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

  /** 에이전트 활성화 (join) */
  activate(agentIndex: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    const state = this.states[agentIndex];
    state.active = true;
    state.current = AnimState.IDLE;
    state.previous = AnimState.IDLE;
    state.elapsed = 0;
    state.blendFactor = 1;
    state.transitionElapsed = 0;
    // idleSeed는 유지 (재접속 시 다른 위상)
  }

  /** 에이전트 비활성화 (leave) */
  deactivate(agentIndex: number): void {
    if (agentIndex < 0 || agentIndex >= this.maxAgents) return;
    this.states[agentIndex].active = false;
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

      // Phase 4B에서 구현할 상태들 — 현재는 IDLE 폴백
      case AnimState.ATTACK:
      case AnimState.HIT:
      case AnimState.DEATH:
      case AnimState.SPAWN:
      case AnimState.LEVELUP:
      case AnimState.VICTORY:
      case AnimState.COLLECT:
        computeIdle(elapsed, out);
        break;

      default:
        computeIdle(elapsed, out);
        break;
    }
  }
}
