/**
 * game-timer.worker.ts - Web Worker 기반 게임 타이머
 * 탭 비활성화 시에도 게임 루프 유지 (브라우저 rAF 제한 우회)
 *
 * 메시지 프로토콜:
 * IN:  { type: 'start' } | { type: 'stop' }
 * OUT: { type: 'tick', deltaTime: number }
 */

let timer: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'start') {
    // 기존 타이머 정리
    if (timer) clearInterval(timer);

    lastTime = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000; // 초 단위
      lastTime = now;
      // deltaTime 상한: 100ms (탭 전환 등으로 큰 값 방지)
      self.postMessage({ type: 'tick', deltaTime: Math.min(dt, 0.1) });
    }, 16); // ~60fps
  } else if (e.data.type === 'stop') {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
};
