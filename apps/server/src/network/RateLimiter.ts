/**
 * RateLimiter — input/respawn rate limiting
 * SocketHandler에서 추출
 */

import { NETWORK } from '@snake-arena/shared';

export class RateLimiter {
  private inputTimestamps: Map<string, number[]> = new Map();
  private respawnTimestamps: Map<string, number> = new Map();

  /** input rate 체크 — 초과 시 false 반환 */
  checkInputRate(socketId: string): boolean {
    const now = Date.now();
    let timestamps = this.inputTimestamps.get(socketId);
    if (!timestamps) {
      timestamps = [];
      this.inputTimestamps.set(socketId, timestamps);
    }
    while (timestamps.length > 0 && now - timestamps[0] > 1000) {
      timestamps.shift();
    }
    if (timestamps.length >= NETWORK.MAX_INPUT_RATE) return false;
    timestamps.push(now);
    return true;
  }

  /** respawn cooldown 체크 — 쿨다운 중이면 false */
  checkRespawnCooldown(socketId: string): boolean {
    const now = Date.now();
    const lastRespawn = this.respawnTimestamps.get(socketId) || 0;
    if (now - lastRespawn < NETWORK.RESPAWN_COOLDOWN_MS) return false;
    this.respawnTimestamps.set(socketId, now);
    return true;
  }

  /** disconnect 시 정리 */
  cleanup(socketId: string): void {
    this.inputTimestamps.delete(socketId);
    this.respawnTimestamps.delete(socketId);
  }
}
