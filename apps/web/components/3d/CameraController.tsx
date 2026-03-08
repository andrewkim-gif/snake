'use client';

/**
 * CameraController — v24 Phase 2: Unified Camera System
 *
 * CameraAutoFocus + CameraShake를 단일 컴포넌트로 병합.
 * 기존 문제 해결:
 * 1. CameraAutoFocus와 CameraShake의 camera.position 레이스 컨디션
 * 2. OrbitControls.target 미갱신으로 인한 스냅백
 * 3. introActive 중 카메라 이벤트 발생 방지
 * 4. 이벤트 우선순위 큐로 경쟁 제어
 *
 * 상태 머신: IDLE → FOCUSING → SHAKING → IDLE
 *            IDLE → INTRO → IDLE (dequeue top-1)
 *
 * 우선순위: nuke(5) > war(4) > epoch(3) > alliance(2) > trade(1)
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_PRIORITY, TIMING } from '@/lib/effect-constants';

// ─── Types ───

export interface CameraControllerProps {
  /** Ref set by parent when an event wants camera focus */
  targetRef: React.RefObject<THREE.Vector3 | null>;
  /** Ref set by parent with the priority of the current target event */
  priorityRef: React.RefObject<number>;
  /** Whether intro camera animation is active */
  introActive: boolean;
  /** Globe radius for distance calculations */
  globeRadius?: number;
  /** Focus duration in seconds */
  focusDuration?: number;
  /** Shake duration in seconds */
  shakeDuration?: number;
  /** Shake intensity (position offset magnitude) */
  shakeIntensity?: number;
  /** Shake frequency (sin wave Hz) */
  shakeFrequency?: number;
}

// 내부 상태 머신 타입
type CameraState = 'idle' | 'focusing' | 'shaking' | 'intro';

// 우선순위 큐 엔트리
interface QueuedEvent {
  position: THREE.Vector3;
  priority: number;
  timestamp: number;
  shake: boolean; // 포커스 후 쉐이크 여부
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;
const DEFAULT_FOCUS_DURATION = TIMING.CAMERA_MOVE;     // 2.0초
const DEFAULT_SHAKE_DURATION = TIMING.CAMERA_SHAKE;    // 0.4초
const DEFAULT_SHAKE_INTENSITY = 0.3;
const DEFAULT_SHAKE_FREQUENCY = 40;
const USER_INPUT_EVENTS = ['pointerdown', 'wheel', 'touchstart'] as const;
const MAX_QUEUE_SIZE = 8; // 큐 오버플로 방지

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _startDir = new THREE.Vector3();
const _endDir = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _qStart = new THREE.Quaternion();
const _qEnd = new THREE.Quaternion();
const _qCurrent = new THREE.Quaternion();
const _forward = new THREE.Vector3(0, 0, 1);
const _targetDir = new THREE.Vector3();

// ─── Component ───

export function CameraController({
  targetRef,
  priorityRef,
  introActive,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  focusDuration = DEFAULT_FOCUS_DURATION,
  shakeDuration = DEFAULT_SHAKE_DURATION,
  shakeIntensity = DEFAULT_SHAKE_INTENSITY,
  shakeFrequency = DEFAULT_SHAKE_FREQUENCY,
}: CameraControllerProps) {
  const { camera, gl, controls } = useThree();

  // ─── State Machine ───
  const stateRef = useRef<CameraState>('idle');
  const prevIntroActiveRef = useRef(introActive);

  // ─── Focus 애니메이션 상태 ───
  const focusStartTimeRef = useRef(0);
  const focusStartPosRef = useRef(new THREE.Vector3());
  const focusTargetPosRef = useRef(new THREE.Vector3());
  const focusClockRef = useRef(0);
  const currentPriorityRef = useRef(0);
  const currentShakeAfterFocusRef = useRef(false);

  // ─── Shake 애니메이션 상태 ───
  const shakeTimeRef = useRef(0);
  const shakeOrigPosRef = useRef(new THREE.Vector3());

  // ─── Priority Queue (인트로 중 이벤트 저장) ───
  const eventQueueRef = useRef<QueuedEvent[]>([]);

  // ─── OrbitControls 활성화/비활성화 헬퍼 ───

  const setControlsEnabled = useCallback((enabled: boolean) => {
    if (controls && 'enabled' in controls) {
      (controls as any).enabled = enabled;
    }
  }, [controls]);

  // ─── OrbitControls 동기화 (포커스 완료 후) ───

  const syncOrbitControls = useCallback(() => {
    if (controls && 'target' in controls && 'update' in controls) {
      (controls as any).target.set(0, 0, 0);
      (controls as any).update();
    }
  }, [controls]);

  // ─── 애니메이션 중단 (유저 제스처) ───

  const cancelAnimation = useCallback(() => {
    const state = stateRef.current;
    if (state !== 'focusing' && state !== 'shaking') return;

    // 쉐이크 중이면 원래 위치 복원
    if (state === 'shaking') {
      camera.position.copy(shakeOrigPosRef.current);
    }

    stateRef.current = 'idle';
    currentPriorityRef.current = 0;
    setControlsEnabled(true);
    syncOrbitControls();
  }, [camera, setControlsEnabled, syncOrbitControls]);

  // ─── Focus 시작 ───

  const startFocus = useCallback((position: THREE.Vector3, priority: number, shake: boolean) => {
    stateRef.current = 'focusing';
    currentPriorityRef.current = priority;
    currentShakeAfterFocusRef.current = shake;
    focusStartTimeRef.current = focusClockRef.current;
    focusStartPosRef.current.copy(camera.position);

    // 목표 카메라 위치: target 방향으로 현재 distance 유지
    const currentDist = camera.position.length();
    _targetDir.copy(position).normalize();
    focusTargetPosRef.current.copy(_targetDir).multiplyScalar(currentDist);

    // OrbitControls 비활성화 (포커스 중 충돌 방지)
    setControlsEnabled(false);
  }, [camera, setControlsEnabled]);

  // ─── Shake 시작 ───

  const startShake = useCallback(() => {
    stateRef.current = 'shaking';
    shakeTimeRef.current = 0;
    shakeOrigPosRef.current.copy(camera.position);
    // OrbitControls는 비활성 유지 (shake 중)
  }, [camera]);

  // ─── 이벤트 처리 (새 타겟 도착 시) ───

  const processEvent = useCallback((position: THREE.Vector3, priority: number) => {
    // 우선순위 4(war) 이상은 shake 포함
    const shake = priority >= CAMERA_PRIORITY.war;

    const currentState = stateRef.current;

    if (currentState === 'intro') {
      // 인트로 중: 큐에 저장
      const queue = eventQueueRef.current;
      queue.push({ position: position.clone(), priority, timestamp: Date.now(), shake });
      // 큐 크기 제한: 낮은 우선순위 제거
      if (queue.length > MAX_QUEUE_SIZE) {
        queue.sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp);
        queue.length = MAX_QUEUE_SIZE;
      }
      return;
    }

    if (currentState === 'focusing' || currentState === 'shaking') {
      // 현재 애니메이션 중: 높은 우선순위만 preemption
      if (priority <= currentPriorityRef.current) {
        return; // 낮은/동일 우선순위는 무시
      }
      // 쉐이크 중이면 원래 위치 복원 후 preempt
      if (currentState === 'shaking') {
        camera.position.copy(shakeOrigPosRef.current);
      }
    }

    // 포커스 시작
    startFocus(position, priority, shake);
  }, [camera, startFocus]);

  // ─── 유저 입력 이벤트 리스너 ───

  useEffect(() => {
    const domElement = gl.domElement;
    if (!domElement) return;

    const handler = () => cancelAnimation();

    for (const eventName of USER_INPUT_EVENTS) {
      domElement.addEventListener(eventName, handler, { passive: true });
    }

    return () => {
      for (const eventName of USER_INPUT_EVENTS) {
        domElement.removeEventListener(eventName, handler);
      }
    };
  }, [gl.domElement, cancelAnimation]);

  // ─── 컴포넌트 언마운트 시 OrbitControls 복원 ───

  useEffect(() => {
    return () => {
      if (stateRef.current === 'focusing' || stateRef.current === 'shaking') {
        if (stateRef.current === 'shaking') {
          camera.position.copy(shakeOrigPosRef.current);
        }
        if (controls && 'enabled' in controls) {
          (controls as any).enabled = true;
        }
      }
    };
  }, [camera, controls]);

  // ─── 인트로 상태 추적 ───

  useEffect(() => {
    if (introActive && !prevIntroActiveRef.current) {
      // 인트로 시작
      stateRef.current = 'intro';
    }

    if (!introActive && prevIntroActiveRef.current) {
      // 인트로 완료 → idle로 전환 + 큐에서 최상위 1개 실행
      stateRef.current = 'idle';
      const queue = eventQueueRef.current;
      if (queue.length > 0) {
        // 최상위 우선순위 이벤트만 실행, 나머지 폐기
        queue.sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp);
        const top = queue[0];
        queue.length = 0; // 큐 비우기
        startFocus(top.position, top.priority, top.shake);
      }
    }

    prevIntroActiveRef.current = introActive;
  }, [introActive, startFocus]);

  // ─── Frame Loop ───

  useFrame((_state, delta) => {
    focusClockRef.current += delta;

    // 새 타겟 확인 (부모가 targetRef에 설정)
    const newTarget = targetRef.current;
    if (newTarget) {
      const priority = priorityRef.current ?? 1;
      // 타겟 소비 (1회성)
      (targetRef as React.MutableRefObject<THREE.Vector3 | null>).current = null;
      processEvent(newTarget, priority);
    }

    const currentState = stateRef.current;

    // ── FOCUSING 상태 ──
    if (currentState === 'focusing') {
      const elapsed = focusClockRef.current - focusStartTimeRef.current;
      const t = Math.min(elapsed / focusDuration, 1.0);

      // easeInOutCubic
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // 구면 보간 (Slerp) — temp 객체 사용 (GC 방지)
      _startDir.copy(focusStartPosRef.current).normalize();
      _endDir.copy(focusTargetPosRef.current).normalize();
      const currentDist = camera.position.length();

      // Quaternion slerp 기반 구면 보간
      _forward.set(0, 0, 1);
      _qStart.setFromUnitVectors(_forward, _startDir);
      _forward.set(0, 0, 1);
      _qEnd.setFromUnitVectors(_forward, _endDir);
      _qCurrent.copy(_qStart).slerp(_qEnd, eased);

      // 보간된 방향 벡터 → 카메라 위치
      _currentDir.set(0, 0, 1).applyQuaternion(_qCurrent);
      camera.position.copy(_currentDir).multiplyScalar(currentDist);

      // 항상 원점(글로브 중심) 바라봄
      camera.lookAt(0, 0, 0);

      if (t >= 1.0) {
        // 포커스 완료
        if (currentShakeAfterFocusRef.current) {
          // Shake 시작 (포커스 완료 위치에서 origPos 캡처 — 레이스 컨디션 해결)
          startShake();
        } else {
          // 포커스만: 완료 → IDLE
          stateRef.current = 'idle';
          currentPriorityRef.current = 0;
          setControlsEnabled(true);
          syncOrbitControls();
        }
      }
    }

    // ── SHAKING 상태 ──
    if (currentState === 'shaking') {
      shakeTimeRef.current += delta;

      if (shakeTimeRef.current >= shakeDuration) {
        // 쉐이크 완료: 원래 위치 복원 → IDLE
        camera.position.copy(shakeOrigPosRef.current);
        stateRef.current = 'idle';
        currentPriorityRef.current = 0;
        setControlsEnabled(true);
        syncOrbitControls();
        return;
      }

      // Decay envelope: 시간이 지남에 따라 강도 감소
      const decay = 1.0 - (shakeTimeRef.current / shakeDuration);
      const elapsed = shakeTimeRef.current;
      const offsetX = Math.sin(elapsed * shakeFrequency) * shakeIntensity * decay;
      const offsetY = Math.cos(elapsed * shakeFrequency * 1.3) * shakeIntensity * decay * 0.7;

      // 원래 위치 기준으로 오프셋 적용 (레이스 컨디션 방지)
      camera.position.copy(shakeOrigPosRef.current);
      camera.position.x += offsetX;
      camera.position.y += offsetY;
    }
  });

  return null;
}

export default CameraController;
