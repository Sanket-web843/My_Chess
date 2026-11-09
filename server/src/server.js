import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerSocketHandlers } from './socket/index.js';

const PORT = process.env.PORT || 3001;

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow all origins in local dev (localhost, 127.0.0.1, LAN IP)
  credentials: true,
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── HTTP → Socket.IO server ───────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// ── Register all socket event handlers ───────────────────────────
registerSocketHandlers(io);

// ── Start ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🟢  Chess server running on http://localhost:${PORT}`);
  console.log(`🔌  CORS: all local / LAN origins allowed`);
  console.log(`🔌  Socket.IO listening for connections…\n`);
});
