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
const corsOrigins = CORS_ORIGIN.split(',').map(o => o.trim());

// Express
const app = express();
app.use(cors({ origin: corsOrigins }));

// HTTP + Socket.IO
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Socket.IO + RoomManager
const roomManager = setupSocketHandlers(io, logger);

// Health check
app.get('/health', (_req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    rooms: stats.rooms,
    totalPlayers: stats.totalPlayers,
    memory: {
      mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
});

httpServer.listen(PORT, () => {
  logger.info(`Snake Arena server running on port ${PORT}`);
  logger.info(`CORS origin: ${CORS_ORIGIN}`);
});
