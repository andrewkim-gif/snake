'use client';

/**
 * TPSCamera — FPS-style Third Person Camera (완전 재작성)
 *
 * 포트나이트/PUBG 스타일:
 *   - 마우스 → 카메라 yaw/pitch 직접 조작 (Pointer Lock)
 *   - 카메라는 캐릭터 뒤+위에 위치
 *   - WASD는 카메라가 바라보는 방향 기준으로 이동
 *   - aimAngle = 카메라가 바라보는 수평 방향
 *   - 캐릭터는 카메라 방향을 바라봄
 *
 * 모드:
 *   - 일반 모드: 플레이어 추적 TPS
 *   - 킬캠 모드: 사망 → 킬러 줌인 → 공전
 *   - 옵저버 모드: 사망 후 자유 비행 / 에이전트 팔로우
 *
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera } from 'three';
import { Vector3 } from 'three';
import type { AgentNetworkData } from '@agent-survivor/shared';
import type { GameData } from '@/hooks/useSocket';
import type { InputManagerReturn } from '@/hooks/useInputManager';
import { getCameraShake } from '@/lib/3d/camera-shake';

// ─── TPS 카메라 상수 ───
const CAM_HEIGHT = 12;         // 캐릭터 위 높이 오프셋
const CAM_DISTANCE = 30;       // 캐릭터 뒤 거리
const MIN_PITCH = -0.3;        // 약간 위를 볼 수 있음 (rad)
const MAX_PITCH = 1.2;         // 거의 수직 탑다운 (rad)
const DEFAULT_PITCH = 0.5;     // ~29도 — 살짝 위에서 내려다봄
const TRACK_SMOOTH = 12;       // 타겟 추적 lerp 속도
const MIN_CAM_Y = 5;           // 최소 카메라 높이 (지면 클리핑 방지)

// 줌 (스크롤)
const MIN_DISTANCE = 15;
const MAX_DISTANCE = 80;
const ZOOM_SENSITIVITY = 0.08;

// ─── 옵저버 자유 카메라 상수 ───
const OBSERVER_MOVE_SPEED = 600;
const OBSERVER_DEFAULT_HEIGHT = 150;
const OBSERVER_MIN_HEIGHT = 30;
const OBSERVER_MAX_HEIGHT = 500;

// ─── 킬캠 상수 ───
const KILLCAM_ZOOM_DURATION = 0.5;
const KILLCAM_ORBIT_DURATION = 2.0;
const KILLCAM_ORBIT_DISTANCE = 15;
const KILLCAM_ORBIT_POLAR = 0.6;
const KILLCAM_ORBIT_SPEED = 1.5;

/** 킬캠 상태 */
export interface KillcamState {
  active: boolean;
  killerId: string | null;
  killerX: number;
  killerY: number;
  startTime: number;
  onComplete: (() => void) | null;
}

/** 옵저버 모드 상태 */
export interface ObserverState {
  active: boolean;
  freeCam: boolean;
  followTargetId: string | null;
  moveInput: { x: number; z: number };
}

interface TPSCameraProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  dataRef: React.MutableRefObject<GameData>;
  inputManager: InputManagerReturn;
  cameraRef: React.MutableRefObject<Camera | null>;
  playerPosRef: React.MutableRefObject<{ x: number; z: number }>;
  killcamRef?: React.MutableRefObject<KillcamState>;
  observerRef?: React.MutableRefObject<ObserverState>;
}

// 임시 벡터 (GC 방지)
const _offset = new Vector3();
const _camPos = new Vector3();
const _target = new Vector3();

export function TPSCamera({
  agentsRef,
  dataRef,
  inputManager,
  cameraRef,
  playerPosRef,
  killcamRef,
  observerRef,
}: TPSCameraProps) {
  const { camera } = useThree();

  // 카메라 상태 (ref — 리렌더 불필요)
  const yaw = useRef(0);           // 수평 회전 (rad, 0 = +Z 방향)
  const pitch = useRef(DEFAULT_PITCH); // 수직 각도 (0 = 수평, PI/2 = 탑다운)
  const dist = useRef(CAM_DISTANCE);   // 카메라 거리
  const smoothTarget = useRef(new Vector3(0, 0, 0));
  const initialized = useRef(false);

  // 옵저버 자유 카메라 위치
  const observerPos = useRef(new Vector3(0, OBSERVER_DEFAULT_HEIGHT, 0));
  const observerInitialized = useRef(false);

  // 카메라 ref 외부 노출
  useEffect(() => {
    cameraRef.current = camera;
    return () => { cameraRef.current = null; };
  }, [camera, cameraRef]);

  useFrame((_, delta) => {
    // ─── 킬캠 ───
    if (killcamRef?.current?.active) {
      const kc = killcamRef.current;
      const elapsed = (performance.now() - kc.startTime) / 1000;
      const totalDuration = KILLCAM_ZOOM_DURATION + KILLCAM_ORBIT_DURATION;

      // 킬러 위치 실시간 추적
      let kx = kc.killerX;
      let kz = kc.killerY;
      let ky = 0;
      if (kc.killerId) {
        const killer = agentsRef.current.find(a => a.i === kc.killerId);
        if (killer) { kx = killer.x; kz = killer.y; ky = killer.z ?? 0; kc.killerX = kx; kc.killerY = kz; }
      }
      _target.set(kx, ky, kz);

      if (elapsed >= totalDuration) {
        kc.active = false;
        if (kc.onComplete) kc.onComplete();
        return;
      }

      if (elapsed < KILLCAM_ZOOM_DURATION) {
        // 줌인
        const t = elapsed / KILLCAM_ZOOM_DURATION;
        const e = t * t * (3 - 2 * t); // smoothstep
        const d = KILLCAM_ORBIT_DISTANCE;
        const p = KILLCAM_ORBIT_POLAR;
        const a = yaw.current;
        _offset.set(
          d * Math.sin(p) * Math.sin(a),
          d * Math.cos(p),
          d * Math.sin(p) * Math.cos(a),
        );
        const fx = kx + _offset.x;
        const fy = _offset.y;
        const fz = kz + _offset.z;
        camera.position.set(
          camera.position.x + (fx - camera.position.x) * e,
          camera.position.y + (fy - camera.position.y) * e,
          camera.position.z + (fz - camera.position.z) * e,
        );
        camera.lookAt(_target);
      } else {
        // 공전
        const oe = elapsed - KILLCAM_ZOOM_DURATION;
        const oa = yaw.current + oe * KILLCAM_ORBIT_SPEED;
        const p = KILLCAM_ORBIT_POLAR;
        const d = KILLCAM_ORBIT_DISTANCE;
        _offset.set(
          d * Math.sin(p) * Math.sin(oa),
          d * Math.cos(p),
          d * Math.sin(p) * Math.cos(oa),
        );
        _camPos.copy(_target).add(_offset);
        if (_camPos.y < MIN_CAM_Y) _camPos.y = MIN_CAM_Y;
        camera.position.copy(_camPos);
        camera.lookAt(_target);
      }
      return;
    }

    // ─── 옵저버 모드 ───
    const observer = observerRef?.current;
    if (observer?.active) {
      // 마우스 delta 소비 → yaw/pitch
      const md = inputManager.cameraDeltaRef.current;
      if (md.dx !== 0 || md.dy !== 0) {
        yaw.current -= md.dx;
        pitch.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch.current + md.dy));
        md.dx = 0;
        md.dy = 0;
      }
      // 스크롤 → 줌
      const sd = inputManager.scrollDeltaRef.current;
      if (sd !== 0) {
        dist.current = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE,
          dist.current * (1 + sd * ZOOM_SENSITIVITY * 0.01)));
        inputManager.scrollDeltaRef.current = 0;
      }

      if (observer.freeCam) {
        // 자유 비행 카메라
        if (!observerInitialized.current) {
          observerPos.current.copy(smoothTarget.current);
          observerPos.current.y = OBSERVER_DEFAULT_HEIGHT;
          observerInitialized.current = true;
        }
        // WASD 이동 (yaw 기준)
        const mv = observer.moveInput;
        if (mv.x !== 0 || mv.z !== 0) {
          const sy = Math.sin(yaw.current);
          const cy = Math.cos(yaw.current);
          const speed = OBSERVER_MOVE_SPEED * delta;
          // forward = -sin(yaw), -cos(yaw)
          observerPos.current.x += (-sy * mv.z + cy * mv.x) * speed;
          observerPos.current.z += (-cy * mv.z - sy * mv.x) * speed;
        }
        observerPos.current.y = Math.max(OBSERVER_MIN_HEIGHT,
          Math.min(OBSERVER_MAX_HEIGHT, observerPos.current.y));

        // 오비탈 뷰
        const d = dist.current;
        const p = pitch.current;
        const a = yaw.current;
        _offset.set(
          d * Math.sin(p) * Math.sin(a),
          d * Math.cos(p),
          d * Math.sin(p) * Math.cos(a),
        );
        _camPos.copy(observerPos.current).add(_offset);
        if (_camPos.y < MIN_CAM_Y) _camPos.y = MIN_CAM_Y;
        camera.position.copy(_camPos);
        camera.lookAt(observerPos.current);
        return;
      } else if (observer.followTargetId) {
        // 팔로우 모드
        const fa = agentsRef.current.find(a => a.i === observer.followTargetId);
        if (fa) {
          const trackFactor = 1 - Math.pow(0.001, delta * TRACK_SMOOTH);
          smoothTarget.current.x += (fa.x - smoothTarget.current.x) * trackFactor;
          smoothTarget.current.y += ((fa.z ?? 0) - smoothTarget.current.y) * trackFactor;
          smoothTarget.current.z += (fa.y - smoothTarget.current.z) * trackFactor;

          const shake = getCameraShake();
          shake.update(delta);
          const d = dist.current * shake.zoomMultiplier;
          const p = pitch.current;
          const a = yaw.current;
          _offset.set(
            d * Math.sin(p) * Math.sin(a),
            d * Math.cos(p),
            d * Math.sin(p) * Math.cos(a),
          );
          _camPos.copy(smoothTarget.current).add(_offset);
          _camPos.x += shake.offsetX;
          _camPos.y += shake.offsetY;
          if (_camPos.y < MIN_CAM_Y) _camPos.y = MIN_CAM_Y;
          camera.position.copy(_camPos);
          camera.lookAt(smoothTarget.current);
          return;
        }
        // 팔로우 대상 사망 → 자유 카메라
        observer.freeCam = true;
        observer.followTargetId = null;
      }
      return;
    }

    // ─── 일반 FPS-style TPS 카메라 ───
    const playerId = dataRef.current.playerId;
    const agents = agentsRef.current;

    // 마우스 delta 소비 → yaw/pitch (InputManager에서 포인터 락 처리)
    const md = inputManager.cameraDeltaRef.current;
    if (md.dx !== 0 || md.dy !== 0) {
      yaw.current -= md.dx;
      pitch.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch.current + md.dy));
      md.dx = 0;
      md.dy = 0;
    }

    // 스크롤 → 줌
    const sd = inputManager.scrollDeltaRef.current;
    if (sd !== 0) {
      dist.current = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE,
        dist.current * (1 + sd * ZOOM_SENSITIVITY * 0.01)));
      inputManager.scrollDeltaRef.current = 0;
    }

    // InputManager에 카메라 상태 동기화
    inputManager.azimuthRef.current = yaw.current;
    inputManager.pitchRef.current = pitch.current;
    inputManager.zoomRef.current = dist.current;

    // 플레이어 없으면 기본 위치
    if (!playerId) {
      camera.position.set(0, 300, 300);
      camera.lookAt(0, 0, 0);
      return;
    }

    const myAgent = agents.find(a => a.i === playerId);
    if (!myAgent) {
      if (!initialized.current) {
        camera.position.set(0, 300, 300);
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    // 플레이어 월드 좌표 (서버 x,y → Three.js x,height,z)
    const px = myAgent.x;
    const pz = myAgent.y;
    const py = myAgent.z ?? 0; // 서버 ZPos → Three.js Y (하이트맵 높이)

    // InputManager에 플레이어 위치 동기화
    playerPosRef.current.x = px;
    playerPosRef.current.z = pz;

    // Smooth target tracking
    const trackFactor = 1 - Math.pow(0.001, delta * TRACK_SMOOTH);
    if (!initialized.current) {
      smoothTarget.current.set(px, py, pz);
      initialized.current = true;
      // 초기 yaw를 캐릭터 heading에 맞춤
      if (myAgent.h !== undefined) {
        // 서버 heading: 0 = +X, CCW positive
        // 카메라 yaw에서 캐릭터 뒤에 위치하려면:
        // 캐릭터가 heading 방향을 바라봄 → 카메라는 반대편
        // yaw = heading 방향의 "뒤"를 의미하는 각도
        // Three.js: yaw=0 → 카메라 +Z 위. heading=0 → +X 바라봄
        // 카메라가 캐릭터 뒤에 오려면 yaw = heading - PI/2
        yaw.current = (myAgent.h ?? 0) - Math.PI / 2;
      }
    } else {
      smoothTarget.current.x += (px - smoothTarget.current.x) * trackFactor;
      smoothTarget.current.y += (py - smoothTarget.current.y) * trackFactor;
      smoothTarget.current.z += (pz - smoothTarget.current.z) * trackFactor;
    }

    // 카메라 셰이크
    const shake = getCameraShake();
    shake.update(delta);

    // 카메라 위치 계산: 캐릭터 뒤+위
    // yaw = 수평 회전, pitch = 수직 각도
    // 카메라는 캐릭터로부터 (dist) 만큼 떨어져서 뒤에 위치
    const d = dist.current * shake.zoomMultiplier;
    const p = Math.max(0.05, pitch.current); // 최소 약간 위
    const a = yaw.current;

    // Spherical to Cartesian (캐릭터 중심 오프셋)
    _offset.set(
      d * Math.sin(p) * Math.sin(a),
      d * Math.cos(p) + CAM_HEIGHT,
      d * Math.sin(p) * Math.cos(a),
    );

    _camPos.copy(smoothTarget.current).add(_offset);

    // 셰이크 오프셋
    _camPos.x += shake.offsetX;
    _camPos.y += shake.offsetY;

    // 지면 클리핑 방지
    if (_camPos.y < MIN_CAM_Y) _camPos.y = MIN_CAM_Y;

    // 카메라 적용
    camera.position.copy(_camPos);
    // lookAt: 캐릭터 위치 + 약간 위 (머리 높이)
    _target.copy(smoothTarget.current);
    _target.y += 5; // 캐릭터 머리 높이
    camera.lookAt(_target);
  });

  return null;
}
