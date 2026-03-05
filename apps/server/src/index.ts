import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import pino from 'pino';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@snake-arena/shared';
import { setupSocketHandlers } from './network/SocketHandler';
import { AgentAPI } from './game/AgentAPI';
import { TrainingSystem } from './game/TrainingSystem';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOrigins = CORS_ORIGIN.split(',').map(o => o.trim());

// Express
const app = express();
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// HTTP + Socket.IO
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// 공유 인스턴스 생성 (SocketHandler와 REST에서 공유)
const trainingSystem = new TrainingSystem();

// Socket.IO + RoomManager (AgentAPI는 SocketHandler 내에서 생성)
const roomManager = setupSocketHandlers(io, logger, { trainingSystem });

// SocketHandler에서 생성된 AgentAPI 참조
const agentAPI: AgentAPI = (roomManager as any)._agentAPI;

// Health check
app.get('/health', (_req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    rooms: stats.rooms,
    totalPlayers: stats.totalPlayers,
    agents: agentAPI.getAgentCount(),
    trainingProfiles: trainingSystem.getProfileCount(),
    memory: {
      mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
});

// ─── REST API v1: Agent API ───

/**
 * GET /api/v1/agents/:agentId/observe
 * 게임 상태 관찰 — AI 에이전트 의사결정용
 * Header: x-api-key
 */
app.get('/api/v1/agents/:agentId/observe', (req, res) => {
  const { agentId } = req.params;
  const apiKey = req.headers['x-api-key'] as string;

  // API 키 인증
  const agent = agentAPI.getAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not registered' });
  }
  if (apiKey && agent.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const data = agentAPI.getObserveData(agentId);
  if ('error' in data) {
    return res.status(400).json(data);
  }
  res.json(data);
});

/**
 * POST /api/v1/agents/:agentId/command
 * Commander Mode 명령 실행
 * Body: AgentCommand
 * Header: x-api-key
 */
app.post('/api/v1/agents/:agentId/command', (req, res) => {
  const { agentId } = req.params;
  const apiKey = req.headers['x-api-key'] as string;

  const agent = agentAPI.getAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not registered' });
  }
  if (apiKey && agent.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const command = req.body;
  if (!command || !command.cmd) {
    return res.status(400).json({ error: 'Missing command' });
  }

  const result = agentAPI.executeCommand(agentId, command);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

/**
 * POST /api/v1/agents/:agentId/register
 * 에이전트 등록
 * Body: { apiKey, roomId, playerId }
 */
app.post('/api/v1/agents/:agentId/register', (req, res) => {
  const { agentId } = req.params;
  const { apiKey, roomId, playerId } = req.body;

  if (!apiKey || !roomId || !playerId) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, roomId, playerId' });
  }

  const result = agentAPI.registerAgent(agentId, apiKey, { roomId, playerId });
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

/**
 * DELETE /api/v1/agents/:agentId
 * 에이전트 해제
 * Header: x-api-key
 */
app.delete('/api/v1/agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const success = agentAPI.unregisterAgent(agentId);
  if (!success) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ success: true });
});

// ─── REST API v1: Training Profiles ───

/**
 * GET /api/v1/agents/:agentId/training
 * 트레이닝 프로필 조회
 */
app.get('/api/v1/agents/:agentId/training', (req, res) => {
  const { agentId } = req.params;
  const profile = trainingSystem.getProfile(agentId);
  res.json(profile);
});

/**
 * PUT /api/v1/agents/:agentId/training
 * 트레이닝 프로필 설정/업데이트
 * Body: Partial<TrainingProfile>
 */
app.put('/api/v1/agents/:agentId/training', (req, res) => {
  const { agentId } = req.params;
  const profile = req.body;

  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'Invalid profile data' });
  }

  const updated = trainingSystem.setProfile(agentId, profile);
  res.json({ success: true, profile: updated });
});

/**
 * GET /api/v1/agents/:agentId/training/history
 * 라운드 히스토리 조회
 */
app.get('/api/v1/agents/:agentId/training/history', (req, res) => {
  const { agentId } = req.params;
  const limit = parseInt(req.query['limit'] as string) || 20;
  const history = trainingSystem.getRoundHistory(agentId, limit);
  res.json(history);
});

/**
 * GET /api/v1/agents/:agentId/training/stats
 * 성과 통계
 */
app.get('/api/v1/agents/:agentId/training/stats', (req, res) => {
  const { agentId } = req.params;
  const recentN = parseInt(req.query['recent'] as string) || 10;
  const stats = trainingSystem.getPerformanceStats(agentId, recentN);
  res.json(stats);
});

// ─── 기존 호환 REST API (TrainingConsole에서 사용) ───

/**
 * GET /api/training — 기존 TrainingConsole 호환
 */
app.get('/api/training', (req, res) => {
  const agentId = (req.query['agentId'] as string) || 'default';
  const profile = trainingSystem.getProfile(agentId);
  // 기존 형식으로 변환
  res.json({
    buildPath: profile.buildProfile.primaryPath,
    combatStyle: 'balanced',
    strategyPhases: [
      { phase: 'early', strategy: profile.strategyPhases.early },
      { phase: 'mid', strategy: profile.strategyPhases.mid },
      { phase: 'late', strategy: profile.strategyPhases.late },
    ],
    updatedAt: profile.updatedAt,
  });
});

/**
 * PUT /api/training — 기존 TrainingConsole 호환
 */
app.put('/api/training', (req, res) => {
  const { agentId, config } = req.body;
  const id = agentId || 'default';

  if (config) {
    trainingSystem.setProfile(id, {
      buildProfile: {
        primaryPath: config.buildPath || 'berserker',
        bannedUpgrades: [],
        alwaysPick: [],
      },
      strategyPhases: {
        early: config.strategyPhases?.[0]?.strategy || 'gather',
        mid: config.strategyPhases?.[1]?.strategy || 'farm',
        late: config.strategyPhases?.[2]?.strategy || 'fight',
      },
    });
  }

  res.json({ success: true });
});

/**
 * GET /api/training/history — 기존 TrainingConsole 호환
 */
app.get('/api/training/history', (req, res) => {
  const agentId = (req.query['agentId'] as string) || 'default';
  const history = trainingSystem.getRoundHistory(agentId);
  res.json(history);
});

httpServer.listen(PORT, () => {
  logger.info(`Agent Survivor server running on port ${PORT}`);
  logger.info(`CORS origin: ${CORS_ORIGIN}`);
});
