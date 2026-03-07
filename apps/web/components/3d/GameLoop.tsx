'use client';

/**
 * GameLoop — 서버 상태 보간 + 클라이언트 예측 (useFrame 기반)
 * 기존 GameCanvas.tsx의 render loop 로직을 R3F useFrame으로 포팅
 * agentsRef.current를 매 프레임 업데이트 — 다른 3D 컴포넌트에서 참조
 *
 * v16: InputManager의 moveAngle/aimAngle 분리 예측 지원
 *
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 * priority != 0 시 R3F auto-render 꺼짐.
 * JSX에서 GameLoop을 TPSCamera보다 먼저 마운트하면 실행 순서 보장됨.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { interpolateAgents, applyClientPrediction } from '@/lib/interpolation';
import type { GameData } from '@/hooks/useSocket';
import type { AgentNetworkData } from '@agent-survivor/shared';
import type { InputState } from '@/hooks/useInputManager';

interface GameLoopProps {
  /** 서버 데이터 ref (useSocket에서 제공) */
  dataRef: React.MutableRefObject<GameData>;
  /** 보간된 Agent 배열 ref — 다른 컴포넌트에서 읽기 전용 참조 */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 마우스/터치 입력 각도 ref (하위 호환) */
  angleRef: React.MutableRefObject<number>;
  /** 부스트 입력 ref */
  boostRef: React.MutableRefObject<boolean>;
  /** v16: InputManager 상태 ref (moveAngle/aimAngle 분리 예측) */
  inputStateRef?: React.MutableRefObject<InputState>;
}

export function GameLoop({ dataRef, agentsRef, angleRef, inputStateRef }: GameLoopProps) {
  const fpsRef = useRef({ frames: 0, lastTime: 0, value: 60 });

  // priority 0 (기본값) — auto-render 유지!
  // JSX 마운트 순서: GameLoop → TPSCamera → 기타
  // → GameLoop이 먼저 실행되어 agentsRef 업데이트 후 카메라/렌더링
  useFrame((_, delta) => {
    const now = performance.now();

    // FPS 카운터
    const fps = fpsRef.current;
    fps.frames++;
    if (now - fps.lastTime >= 1000) {
      fps.value = fps.frames;
      fps.frames = 0;
      fps.lastTime = now;
    }

    const data = dataRef.current;
    const state = data.latestState;

    if (!state) {
      agentsRef.current = [];
      return;
    }

    // ─── 서버 상태 보간 ───
    const serverInterval = data.stateTimestamp - data.prevStateTimestamp;
    const elapsed = now - data.stateTimestamp;
    const t = serverInterval > 0 ? Math.min(elapsed / serverInterval, 1.5) : 1;

    let agents = interpolateAgents(data.prevState?.s || null, state.s, t);

    // ─── 클라이언트 예측 ───
    const myAgent = agents.find(a => a.i === data.playerId);
    if (myAgent) {
      // v16: InputManager가 있으면 moveAngle/aimAngle 분리 예측
      const inp = inputStateRef?.current;
      const predicted = inp
        ? applyClientPrediction(myAgent, angleRef.current, delta, inp.moveAngle, inp.aimAngle)
        : applyClientPrediction(myAgent, angleRef.current, delta);
      agents = agents.map(a => a.i === data.playerId ? predicted : a);
    }

    // ─── 보간 결과를 ref에 반영 (다른 컴포넌트에서 참조) ───
    agentsRef.current = agents;
  });

  return null;
}
