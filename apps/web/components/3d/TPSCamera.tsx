'use client';

/**
 * TPSCamera — v16 Phase 2 TPS 오비탈 카메라
 *
 * Spherical 좌표 기반: azimuth(수평), polar(수직), distance(거리)
 * 우클릭 드래그 → 회전, 스크롤 → 줌
 * 대상(플레이어) 추적 with smooth lerp
 * 지형 클리핑 방지: 카메라 Y를 최소 지면+10 이상으로
 *
 * v16 Phase 7: 카메라 셰이크 통합 (camera-shake.ts)
 * v16 Phase 8: 킬캠 모드 — 사망 → 킬러 줌인 0.5s → 공전 2s → DeathOverlay
 *
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 * JSX에서 GameLoop 다음에 마운트하여 실행 순서 보장.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera } from 'three';
import { Vector3 } from 'three';
import type { AgentNetworkData } from '@agent-survivor/shared';
import type { GameData } from '@/hooks/useSocket';
import type { InputManagerReturn } from '@/hooks/useInputManager';
import { getCameraShake } from '@/lib/3d/camera-shake';

// ─── 상수 ───
const MIN_POLAR = 0.17;      // ~10 deg (거의 탑다운)
const MAX_POLAR = 1.31;      // ~75 deg (거의 수평)
const MIN_DISTANCE = 10;
const MAX_DISTANCE = 60;
const DEFAULT_AZIMUTH = 0;   // 북쪽 (Three.js +Z 방향)
const DEFAULT_POLAR = 0.79;  // ~45 deg
const DEFAULT_DISTANCE = 25;

// 드래그 감도
const YAW_SENSITIVITY = 0.005;
const PITCH_SENSITIVITY = 0.005;
// 줌 감도
const ZOOM_SENSITIVITY = 0.05;
// 추적 lerp 속도
const TRACK_SMOOTH = 10;     // 높을수록 빠름
// 최소 지면 높이 오프셋
const MIN_HEIGHT_OFFSET = 10;

// 킬캠 타이밍 (초)
const KILLCAM_ZOOM_DURATION = 0.5;  // 킬러로 줌인
const KILLCAM_ORBIT_DURATION = 2.0; // 공전
const KILLCAM_ORBIT_DISTANCE = 15;  // 공전 거리
const KILLCAM_ORBIT_POLAR = 0.6;    // 공전 고도각
const KILLCAM_ORBIT_SPEED = 1.5;    // 공전 속도 (rad/s)

/** 킬캠 상태 */
export interface KillcamState {
  /** 킬캠 활성 여부 */
  active: boolean;
  /** 킬러 에이전트 ID */
  killerId: string | null;
  /** 킬러 월드 좌표 (서버 좌표계: x, y) */
  killerX: number;
  killerY: number;
  /** 킬캠 시작 시간 (performance.now()) */
  startTime: number;
  /** 킬캠 종료 콜백 */
  onComplete: (() => void) | null;
}

interface TPSCameraProps {
  /** 보간된 Agent 배열 ref */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 서버 데이터 ref — playerId를 매 프레임 읽기 위함 */
  dataRef: React.MutableRefObject<GameData>;
  /** InputManager refs — 카메라 delta, scroll delta, azimuth/pitch/zoom 동기화 */
  inputManager: InputManagerReturn;
  /** 외부에서 카메라 ref를 받아 설정 (raycasting용) */
  cameraRef: React.MutableRefObject<Camera | null>;
  /** 플레이어 위치 ref (InputManager의 aimAngle 계산용) */
  playerPosRef: React.MutableRefObject<{ x: number; z: number }>;
  /** v16 Phase 8: 킬캠 상태 */
  killcamRef?: React.MutableRefObject<KillcamState>;
}

// 임시 벡터 (GC 방지)
const _offset = new Vector3();
const _camPos = new Vector3();
const _killcamTarget = new Vector3();

export function TPSCamera({
  agentsRef,
  dataRef,
  inputManager,
  cameraRef,
  playerPosRef,
  killcamRef,
}: TPSCameraProps) {
  const { camera } = useThree();

  // 카메라 상태 (ref로 관리 — React 리렌더 불필요)
  const azimuth = useRef(DEFAULT_AZIMUTH);
  const polar = useRef(DEFAULT_POLAR);
  const distance = useRef(DEFAULT_DISTANCE);
  const target = useRef(new Vector3(0, 0, 0));
  const initialized = useRef(false);

  // 킬캠용 보존 상태 (킬캠 전 카메라 위치)
  const killcamSavedPos = useRef(new Vector3());
  const killcamSavedTarget = useRef(new Vector3());

  // 카메라 ref를 외부에 노출 (raycasting용)
  useEffect(() => {
    cameraRef.current = camera;
    return () => { cameraRef.current = null; };
  }, [camera, cameraRef]);

  // priority 0 — auto-render 유지!
  // GameLoop 다음에 마운트 → GameLoop이 먼저 실행
  useFrame((_, delta) => {
    // ─── 킬캠 모드 체크 ───
    if (killcamRef?.current?.active) {
      const kc = killcamRef.current;
      const elapsed = (performance.now() - kc.startTime) / 1000; // 초
      const totalDuration = KILLCAM_ZOOM_DURATION + KILLCAM_ORBIT_DURATION;

      // 킬러 월드 위치 (실시간 추적: 킬러가 아직 보이면 업데이트)
      let killerWorldX = kc.killerX;
      let killerWorldZ = kc.killerY;
      if (kc.killerId) {
        const killerAgent = agentsRef.current.find(a => a.i === kc.killerId);
        if (killerAgent) {
          killerWorldX = killerAgent.x;
          killerWorldZ = killerAgent.y;
          kc.killerX = killerWorldX;
          kc.killerY = killerWorldZ;
        }
      }
      _killcamTarget.set(killerWorldX, 0, killerWorldZ);

      if (elapsed >= totalDuration) {
        // 킬캠 종료
        kc.active = false;
        if (kc.onComplete) kc.onComplete();
        return;
      }

      if (elapsed < KILLCAM_ZOOM_DURATION) {
        // Phase 1: 줌인 (슬로모 느낌 — 카메라가 킬러에게 부드럽게 이동)
        const t = elapsed / KILLCAM_ZOOM_DURATION;
        const easeT = t * t * (3 - 2 * t); // smoothstep

        // 현재 카메라 → 킬러 위치로 보간
        const targetDistance = KILLCAM_ORBIT_DISTANCE;
        const az = azimuth.current;
        const pol = KILLCAM_ORBIT_POLAR;

        _offset.set(
          targetDistance * Math.sin(pol) * Math.sin(az),
          targetDistance * Math.cos(pol),
          targetDistance * Math.sin(pol) * Math.cos(az),
        );

        const finalCamX = killerWorldX + _offset.x;
        const finalCamY = _offset.y;
        const finalCamZ = killerWorldZ + _offset.z;

        camera.position.set(
          camera.position.x + (finalCamX - camera.position.x) * easeT,
          camera.position.y + (finalCamY - camera.position.y) * easeT,
          camera.position.z + (finalCamZ - camera.position.z) * easeT,
        );
        camera.lookAt(_killcamTarget);
      } else {
        // Phase 2: 공전 (킬러 주위를 회전)
        const orbitElapsed = elapsed - KILLCAM_ZOOM_DURATION;
        const orbitAngle = azimuth.current + orbitElapsed * KILLCAM_ORBIT_SPEED;
        const pol = KILLCAM_ORBIT_POLAR;
        const dist = KILLCAM_ORBIT_DISTANCE;

        _offset.set(
          dist * Math.sin(pol) * Math.sin(orbitAngle),
          dist * Math.cos(pol),
          dist * Math.sin(pol) * Math.cos(orbitAngle),
        );

        _camPos.copy(_killcamTarget).add(_offset);
        if (_camPos.y < MIN_HEIGHT_OFFSET) _camPos.y = MIN_HEIGHT_OFFSET;

        camera.position.copy(_camPos);
        camera.lookAt(_killcamTarget);
      }
      return;
    }

    // ─── 일반 TPS 카메라 모드 ───
    const playerId = dataRef.current.playerId;
    const agents = agentsRef.current;

    // ─── 카메라 입력 소비 (드래그 delta + 스크롤) ───
    const camDelta = inputManager.cameraDeltaRef.current;
    if (camDelta.dx !== 0 || camDelta.dy !== 0) {
      azimuth.current -= camDelta.dx * YAW_SENSITIVITY;
      polar.current = Math.max(MIN_POLAR,
        Math.min(MAX_POLAR, polar.current + camDelta.dy * PITCH_SENSITIVITY));
      // delta 소비 (리셋)
      camDelta.dx = 0;
      camDelta.dy = 0;
    }

    const scrollD = inputManager.scrollDeltaRef.current;
    if (scrollD !== 0) {
      distance.current = Math.max(MIN_DISTANCE,
        Math.min(MAX_DISTANCE, distance.current * (1 + scrollD * ZOOM_SENSITIVITY * 0.01)));
      inputManager.scrollDeltaRef.current = 0;
    }

    // azimuth/pitch/zoom을 InputManager에 동기화 (WASD 방향 계산에 사용)
    inputManager.azimuthRef.current = azimuth.current;
    inputManager.pitchRef.current = polar.current;
    inputManager.zoomRef.current = distance.current;

    // ─── 타겟(플레이어) 추적 ───
    if (!playerId) {
      // 플레이어 없으면 원점 오버뷰
      camera.position.set(0, 500, 400);
      camera.lookAt(0, 0, 0);
      return;
    }

    const myAgent = agents.find(a => a.i === playerId);
    if (!myAgent) {
      if (!initialized.current) {
        camera.position.set(0, 500, 400);
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    // Agent 월드 위치 (서버 좌표계: x, y → Three.js: x, 0, y)
    const playerWorldX = myAgent.x;
    const playerWorldZ = myAgent.y; // 서버 y → Three.js z

    // 플레이어 위치를 InputManager에 동기화 (aimAngle 계산용)
    playerPosRef.current.x = playerWorldX;
    playerPosRef.current.z = playerWorldZ;

    // Smooth target tracking (dt-independent damping)
    const trackFactor = 1 - Math.pow(0.001, delta * TRACK_SMOOTH);
    if (!initialized.current) {
      target.current.set(playerWorldX, 0, playerWorldZ);
      initialized.current = true;
    } else {
      target.current.x += (playerWorldX - target.current.x) * trackFactor;
      target.current.z += (playerWorldZ - target.current.z) * trackFactor;
    }

    // ─── 카메라 셰이크 업데이트 (v16 Phase 7) ───
    const shake = getCameraShake();
    shake.update(delta);

    // ─── Spherical → Cartesian (카메라 오프셋) ───
    const az = azimuth.current;
    const pol = polar.current;
    // 줌 펀치 적용: distance에 셰이크 줌 배수 곱하기
    const dist = distance.current * shake.zoomMultiplier;

    _offset.set(
      dist * Math.sin(pol) * Math.sin(az),
      dist * Math.cos(pol),
      dist * Math.sin(pol) * Math.cos(az),
    );

    _camPos.copy(target.current).add(_offset);

    // ─── 셰이크 오프셋 적용 (XY 평면에서 흔들림) ───
    _camPos.x += shake.offsetX;
    _camPos.y += shake.offsetY;

    // ─── 지형 클리핑 방지 ───
    // 현재 heightmap이 없으므로 기본 지면 Y=0 기준
    const minY = 0 + MIN_HEIGHT_OFFSET;
    if (_camPos.y < minY) {
      _camPos.y = minY;
    }

    // ─── 카메라 적용 ───
    camera.position.copy(_camPos);
    camera.lookAt(target.current);
  });

  return null;
}
