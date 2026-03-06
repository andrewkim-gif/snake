'use client';

/**
 * PlayCamera — 3/4 뷰 카메라 (쿼터뷰)
 * mass 기반 동적 줌: height = 300/zoom, behind = 180/zoom
 * 위치 lerp 15%/frame, 줌 lerp 8%/frame (dt-independent)
 * camera.lookAt(targetX, 0, targetZ) — 자연스러운 추적
 *
 * ★ playerId는 dataRef에서 매 프레임 읽음 (props로 전달 시 stale 문제)
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 * priority != 0 설정 시 R3F auto-render가 꺼지므로 절대 금지.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { AgentNetworkData } from '@agent-survivor/shared';
import type { GameData } from '@/hooks/useSocket';

interface PlayCameraProps {
  /** 보간된 Agent 배열 ref */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 서버 데이터 ref — playerId를 매 프레임 읽기 위함 */
  dataRef: React.MutableRefObject<GameData>;
}

/** 스크롤 줌 범위 (0.5 = 가까이, 2.0 = 멀리) */
const MIN_MANUAL_ZOOM = 0.5;
const MAX_MANUAL_ZOOM = 2.5;

export function PlayCamera({ agentsRef, dataRef }: PlayCameraProps) {
  const { camera, gl } = useThree();
  const zoomRef = useRef(1.0);
  const manualZoomRef = useRef(1.0); // 스크롤 줌 배수
  const camPosRef = useRef({ x: 0, y: 300, z: 180 });
  const initializedRef = useRef(false);

  // ─── 스크롤 줌 이벤트 ───
  useEffect(() => {
    const canvas = gl.domElement;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.08 : 0.92; // 줌 아웃/인
      manualZoomRef.current = Math.max(MIN_MANUAL_ZOOM,
        Math.min(MAX_MANUAL_ZOOM, manualZoomRef.current * delta));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [gl]);

  // priority 0 (기본값) — auto-render 유지!
  useFrame((_, delta) => {
    // ★ 매 프레임 ref에서 읽어 항상 최신 playerId 사용
    const playerId = dataRef.current.playerId;

    if (!playerId) {
      camera.position.set(0, 500, 400);
      camera.lookAt(0, 0, 0);
      return;
    }

    const agents = agentsRef.current;
    const myAgent = agents.find(a => a.i === playerId);
    if (!myAgent) {
      if (!initializedRef.current) {
        camera.position.set(0, 500, 400);
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    // ─── 동적 줌 계산 (mass 기반 × 수동 스크롤 줌) ───
    const mass = myAgent.m;
    const autoZoom = Math.max(0.35, Math.min(1.0,
      1.0 - Math.pow(mass, 0.4) * 0.03
    ));
    const targetZoom = autoZoom * manualZoomRef.current;

    // dt-independent lerp
    const posSmooth = 1 - Math.pow(1 - 0.15, delta * 60);
    const zoomSmooth = 1 - Math.pow(1 - 0.12, delta * 60);

    zoomRef.current += (targetZoom - zoomRef.current) * zoomSmooth;
    const zoom = zoomRef.current;

    // ─── 카메라 위치 계산 ───
    const targetX = myAgent.x;
    const targetZ = myAgent.y;
    const height = 300 / zoom;
    const behind = 180 / zoom;

    const desiredX = targetX;
    const desiredY = height;
    const desiredZ = targetZ + behind;

    if (!initializedRef.current) {
      camPosRef.current.x = desiredX;
      camPosRef.current.y = desiredY;
      camPosRef.current.z = desiredZ;
      initializedRef.current = true;
    } else {
      camPosRef.current.x += (desiredX - camPosRef.current.x) * posSmooth;
      camPosRef.current.y += (desiredY - camPosRef.current.y) * posSmooth;
      camPosRef.current.z += (desiredZ - camPosRef.current.z) * posSmooth;
    }

    camera.position.set(
      camPosRef.current.x,
      camPosRef.current.y,
      camPosRef.current.z,
    );
    camera.lookAt(targetX, 0, targetZ);
  });

  return null;
}
