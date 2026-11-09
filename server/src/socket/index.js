import { onConnection } from './handlers.js';

/**
 * Registers all Socket.IO event handlers on the server instance.
 * @param {import('socket.io').Server} io
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected  → id: ${socket.id}`);

    onConnection(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected → id: ${socket.id} | reason: ${reason}`);
    });
  });
}
