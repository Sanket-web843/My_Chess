import io from 'socket.io-client';

const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${defaultHost}:3001`;

/**
 * Singleton Socket.IO client instance.
 * Connects immediately with polling + websocket fallback.
 */
export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  timeout: 10000,
});
