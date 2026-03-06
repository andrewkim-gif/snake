'use client';

/**
 * PlayCamera — 3/4 뷰 카메라 (쿼터뷰)
 * mass 기반 동적 줌: height = 300/zoom, behind = 180/zoom
 * 위치 lerp 15%/frame, 줌 lerp 8%/frame (dt-independent)
 * camera.lookAt(targetX, 0, targetZ) — 자연스러운 추적
 *
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 * priority != 0 설정 시 R3F auto-render가 꺼지므로 절대 금지.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { AgentNetworkData } from '@snake-arena/shared';

interface PlayCameraProps {
  /** 보간된 Agent 배열 ref */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 현재 플레이어 ID */
  playerId: string | null;
}

export function PlayCamera({ agentsRef, playerId }: PlayCameraProps) {
  const { camera } = useThree();
  const zoomRef = useRef(1.0);
  const camPosRef = useRef({ x: 0, y: 300, z: 180 });
  const initializedRef = useRef(false);

  // priority 0 (기본값) — auto-render 유지!
  useFrame((_, delta) => {
    if (!playerId) return;

    const agents = agentsRef.current;
    const myAgent = agents.find(a => a.i === playerId);
    if (!myAgent) return;

    // ─── 동적 줌 계산 (mass 기반) ───
    const mass = myAgent.m;
    const targetZoom = Math.max(0.35, Math.min(1.0,
      1.0 - Math.pow(mass, 0.4) * 0.03
    ));

    // dt-independent lerp
    const posSmooth = 1 - Math.pow(1 - 0.15, delta * 60);
    const zoomSmooth = 1 - Math.pow(1 - 0.08, delta * 60);

    // 줌 보간
    zoomRef.current += (targetZoom - zoomRef.current) * zoomSmooth;
    const zoom = zoomRef.current;

    // ─── 카메라 위치 계산 ───
    // 게임 좌표 (x, y) → Three.js (x, 0, y)
    const targetX = myAgent.x;
    const targetZ = myAgent.y;
    const height = 300 / zoom;
    const behind = 180 / zoom;

    // 목표 카메라 위치
    const desiredX = targetX;
    const desiredY = height;
    const desiredZ = targetZ + behind;

    // 첫 프레임: 스냅 (lerp 없이 즉시 이동)
    if (!initializedRef.current) {
      camPosRef.current.x = desiredX;
      camPosRef.current.y = desiredY;
      camPosRef.current.z = desiredZ;
      initializedRef.current = true;
    } else {
      // 부드러운 추적
      camPosRef.current.x += (desiredX - camPosRef.current.x) * posSmooth;
      camPosRef.current.y += (desiredY - camPosRef.current.y) * posSmooth;
      camPosRef.current.z += (desiredZ - camPosRef.current.z) * posSmooth;
    }

    // 카메라 적용
    camera.position.set(
      camPosRef.current.x,
      camPosRef.current.y,
      camPosRef.current.z,
    );
    camera.lookAt(targetX, 0, targetZ);
  });

  return null;
}
