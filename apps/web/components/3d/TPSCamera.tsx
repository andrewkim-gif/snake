'use client';

/**
 * TPSCamera — v16 Phase 2 TPS 오비탈 카메라
 *
 * Spherical 좌표 기반: azimuth(수평), polar(수직), distance(거리)
 * 우클릭 드래그 → 회전, 스크롤 → 줌
 * 대상(플레이어) 추적 with smooth lerp
 * 지형 클리핑 방지: 카메라 Y를 최소 지면+10 이상으로
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
}

// 임시 벡터 (GC 방지)
const _offset = new Vector3();
const _camPos = new Vector3();

export function TPSCamera({
  agentsRef,
  dataRef,
  inputManager,
  cameraRef,
  playerPosRef,
}: TPSCameraProps) {
  const { camera } = useThree();

  // 카메라 상태 (ref로 관리 — React 리렌더 불필요)
  const azimuth = useRef(DEFAULT_AZIMUTH);
  const polar = useRef(DEFAULT_POLAR);
  const distance = useRef(DEFAULT_DISTANCE);
  const target = useRef(new Vector3(0, 0, 0));
  const initialized = useRef(false);

  // 카메라 ref를 외부에 노출 (raycasting용)
  useEffect(() => {
    cameraRef.current = camera;
    return () => { cameraRef.current = null; };
  }, [camera, cameraRef]);

  // priority 0 — auto-render 유지!
  // GameLoop 다음에 마운트 → GameLoop이 먼저 실행
  useFrame((_, delta) => {
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

    // ─── Spherical → Cartesian (카메라 오프셋) ───
    const az = azimuth.current;
    const pol = polar.current;
    const dist = distance.current;

    _offset.set(
      dist * Math.sin(pol) * Math.sin(az),
      dist * Math.cos(pol),
      dist * Math.sin(pol) * Math.cos(az),
    );

    _camPos.copy(target.current).add(_offset);

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
