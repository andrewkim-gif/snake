/**
 * GameSocket — Socket.IO 클라이언트 어댑터
 * useSocket.ts에서 사용하는 통일 인터페이스 제공
 */

import { io, Socket } from 'socket.io-client';

type Listener = (data: any) => void;

export class GameSocket {
  private socket: Socket | null = null;
  private pendingListeners: Array<{ event: string; fn: Listener }> = [];

  // 연결 상태 콜백
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(url: string): void {
    // Socket.IO는 HTTP URL 사용 (ws:// → http:// 변환)
    let httpUrl = url;
    if (httpUrl.startsWith('wss://')) {
      httpUrl = 'https://' + httpUrl.slice(6);
    } else if (httpUrl.startsWith('ws://')) {
      httpUrl = 'http://' + httpUrl.slice(5);
    }
    // /ws 엔드포인트 제거 (Socket.IO는 자체 경로 사용)
    httpUrl = httpUrl.replace(/\/ws$/, '');

    this.socket = io(httpUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
    });

    this.socket.on('connect', () => {
      this.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      this.onDisconnect?.();
    });

    // 보류 중인 리스너 등록
    for (const { event, fn } of this.pendingListeners) {
      this.socket.on(event, fn);
    }
    this.pendingListeners = [];
  }

  emit(event: string, data?: any): void {
    this.socket?.emit(event, data ?? {});
  }

  on(event: string, callback: Listener): void {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      // 소켓 연결 전 리스너 보류
      this.pendingListeners.push({ event, fn: callback });
    }
  }

  off(event: string, callback?: Listener): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.removeAllListeners(event);
    }
  }

  removeAllListeners(): void {
    this.socket?.removeAllListeners();
    this.pendingListeners = [];
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
