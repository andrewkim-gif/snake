/**
 * Renderer Types — Camera, RenderState 인터페이스
 */

import type { SnakeNetworkData, OrbNetworkData, MinimapPayload, LeaderboardEntry } from '@snake-arena/shared';
import type { Camera } from '../camera';

export interface KillFeedEntry {
  text: string;
  isMe: boolean;
  timestamp: number;
}

export interface RenderState {
  snakes: SnakeNetworkData[];
  orbs: OrbNetworkData[];
  minimap: MinimapPayload | null;
  leaderboard: LeaderboardEntry[];
  killFeed: KillFeedEntry[];
  camera: Camera;
  arenaRadius: number;
  playerCount: number;
  rtt: number;
  fps: number;
}

export type { Camera };
