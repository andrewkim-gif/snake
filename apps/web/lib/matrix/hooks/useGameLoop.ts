/**
 * useGameLoop — Web Worker 기반 게임 루프 오케스트레이션 훅
 *
 * MatrixCanvas의 update() + Worker + rAF 패턴을 추출하여
 * 2D(MatrixCanvas)와 3D(MatrixScene) 모두에서 재사용할 수 있도록 한다.
 *
 * 핵심 원칙:
 * - Worker에서 60Hz로 tick 메시지 수신 → update(deltaTime) 호출
 * - 렌더 루프(2D: rAF, 3D: useFrame)는 별도로 관리
 * - gameActive 상태에 따라 update 실행 여부 결정
 * - deltaTime 상한 적용 (100ms) — 탭 전환 후 큰 점프 방지
 */

import { useEffect, useRef, useCallback } from 'react';

// 최대 deltaTime (100ms) — 탭 전환 시 큰 점프 방지
const MAX_DELTA_TIME = 0.1;

export interface UseGameLoopOptions {
  /** 게임 활성 상태 (false면 update 미실행) */
  gameActive: boolean;
  /** update 함수 — 매 tick마다 호출 */
  update: (deltaTime: number) => void;
  /** 렌더링 콜백 (2D 모드: rAF로 draw 호출, 3D 모드: null → useFrame 사용) */
  render?: (() => void) | null;
}

/**
 * Web Worker 기반 게임 루프 훅
 *
 * - Worker: 60Hz로 tick → update(dt) 호출 (게임 로직)
 * - rAF: render() 호출 (2D Canvas 렌더링) — 3D 모드에서는 미사용
 *
 * @example
 * // 2D 모드 (MatrixCanvas)
 * useGameLoop({
 *   gameActive,
 *   update: (dt) => updateGame(dt),
 *   render: () => drawCanvas(ctx),
 * });
 *
 * // 3D 모드 (MatrixScene) — render는 useFrame이 담당
 * useGameLoop({
 *   gameActive,
 *   update: (dt) => updateGame(dt),
 *   render: null,
 * });
 */
export function useGameLoop({ gameActive, update, render }: UseGameLoopOptions) {
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  // update와 render를 ref로 저장 — stale closure 방지
  const updateRef = useRef(update);
  updateRef.current = update;

  const renderRef = useRef(render);
  renderRef.current = render;

  const gameActiveRef = useRef(gameActive);
  gameActiveRef.current = gameActive;

  // 렌더링 전용 루프 (2D 모드: rAF로 draw 호출)
  const renderLoop = useCallback(() => {
    renderRef.current?.();
    requestRef.current = requestAnimationFrame(renderLoop);
  }, []);

  useEffect(() => {
    // Worker 생성 (game-timer.worker.ts — 16ms interval)
    const worker = new Worker(
      new URL('@/lib/matrix/workers/game-timer.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    // Worker 메시지 핸들러 — tick 수신 시 update 실행
    worker.onmessage = (e) => {
      const { type, deltaTime } = e.data;

      if (type === 'tick' && gameActiveRef.current) {
        const clampedDelta = Math.min(deltaTime, MAX_DELTA_TIME);
        updateRef.current(clampedDelta);
      }
    };

    // 렌더링 루프 시작 (2D 모드에서만, 3D 모드는 useFrame이 자동 호출)
    if (renderRef.current) {
      requestRef.current = requestAnimationFrame(renderLoop);
    }

    // Worker 시작
    worker.postMessage({ type: 'start' });

    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
      workerRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [renderLoop]);

  // render 콜백이 나중에 주어지거나 변경될 때 rAF 시작/정지
  useEffect(() => {
    if (render && !requestRef.current) {
      requestRef.current = requestAnimationFrame(renderLoop);
    }
    // render가 null이면 rAF 정지 (3D 모드 전환 시)
    if (!render && requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }
  }, [render, renderLoop]);
}
