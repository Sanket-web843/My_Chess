import { useEffect, useState } from 'react';
import { socket } from '../services/socket.js';

/**
 * Hook that exposes the Socket.IO socket instance and its connection status.
 *
 * @returns {{ socket: import('socket.io-client').Socket, connected: boolean }}
 */
export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    if (socket.connected) {
      setConnected(true);
    }

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket, connected };
}
