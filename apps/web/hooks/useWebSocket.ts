/**
 * GameSocket — Native WebSocket 어댑터 (Go 서버용)
 * Socket.IO 호환 인터페이스 (emit/on/off) 제공
 * JSON 프레임: { e: "event_name", d: { ...payload } }
 * 자동 재연결: exponential backoff, 최대 5회
 * Ping/Pong: latency 측정
 */

type Listener = (data: any) => void;

/** WebSocket 연결 상태 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** JSON 프레임 포맷 (Go 서버 프로토콜) */
interface WSFrame {
  e: string; // event name
  d?: any;   // event data (payload)
}

export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private url: string = '';
  private _state: ConnectionState = 'disconnected';
  private _latency = 0;
  private _destroyed = false;

  // 연결 상태 콜백
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onStateChange: ((state: ConnectionState) => void) | null = null;

  /** 현재 연결 상태 */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get state(): ConnectionState {
    return this._state;
  }

  get latency(): number {
    return this._latency;
  }

  /** WebSocket 연결 시작 */
  connect(url: string): void {
    this._destroyed = false;
    this.url = url;

    // HTTP URL을 WS URL로 변환
    let wsUrl = url;
    if (wsUrl.startsWith('https://')) {
      wsUrl = 'wss://' + wsUrl.slice(8);
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = 'ws://' + wsUrl.slice(7);
    }
    // /ws 엔드포인트 추가 (없으면)
    if (!wsUrl.endsWith('/ws')) {
      wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
    }

    this.setState('connecting');
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.onConnect?.();
      this.startPing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      // 서버 WritePump이 여러 JSON을 \n으로 연결해서 배치 전송할 수 있음
      const parts = (event.data as string).split('\n');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        try {
          const frame: WSFrame = JSON.parse(trimmed);
          if (!frame.e) continue;

          // 내부 pong 핸들링 (latency 측정)
          if (frame.e === 'pong' && frame.d?.t) {
            this._latency = Date.now() - frame.d.t;
          }

          // 등록된 리스너에 디스패치
          const handlers = this.listeners.get(frame.e);
          if (handlers) {
            for (const fn of handlers) {
              fn(frame.d);
            }
          }
        } catch {
          // JSON 파싱 실패 무시 (binary 메시지 등)
        }
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopPing();
      const wasConnected = this._state === 'connected';

      if (wasConnected) {
        this.onDisconnect?.();
      }

      // 정상 종료 또는 파괴된 경우 재연결 안함
      if (this._destroyed || event.code === 1000) {
        this.setState('disconnected');
        return;
      }

      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      // onerror 후 onclose가 항상 호출되므로 여기서는 별도 처리 불필요
    };
  }

  /** Socket.IO 호환: 이벤트 발송 */
  emit(event: string, data?: any): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const frame: WSFrame = { e: event, d: data ?? {} };
    this.ws.send(JSON.stringify(frame));
  }

  /** Socket.IO 호환: 이벤트 리스너 등록 */
  on(event: string, callback: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /** Socket.IO 호환: 이벤트 리스너 해제 */
  off(event: string, callback?: Listener): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  /** 모든 리스너 제거 */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /** 연결 종료 */
  disconnect(): void {
    this._destroyed = true;
    this.stopPing();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.onclose = null; // 재연결 방지
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  // ─── 내부 메서드 ───

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this.onStateChange?.(state);
  }

  /** Exponential backoff 재연결 */
  private attemptReconnect(): void {
    if (this._destroyed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('disconnected');
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    this.reconnectTimer = setTimeout(() => {
      if (!this._destroyed) {
        this.connect(this.url);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Ping 주기 시작 (5초 간격) */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.connected) {
        this.emit('ping', { t: Date.now() });
      }
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
