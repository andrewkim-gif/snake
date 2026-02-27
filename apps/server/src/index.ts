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

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Express
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

// HTTP + Socket.IO
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Socket.IO + Arena
const arena = setupSocketHandlers(io, logger);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    arena: {
      players: arena.getPlayerCount(),
      orbs: arena.getOrbCount(),
      tick: arena.getTick(),
      tickDuration: arena.getTickDuration().toFixed(1) + 'ms',
    },
    memory: {
      mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
});

httpServer.listen(PORT, () => {
  logger.info(`Snake Arena server running on port ${PORT}`);
  logger.info(`CORS origin: ${CORS_ORIGIN}`);
});
