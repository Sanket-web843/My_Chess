/**
 * conflictCheck.js — Prevents concurrent / double matches between Pass & Play and Online modes.
 *
 * Enforces:
 * 1. Only ONE match can be active at a time.
 * 2. If a match is in progress in one mode, switching to the other mode requires
 *    either completing or explicitly abandoning the ongoing match.
 */

import { storageGet, storageRemove, sessionGet, sessionRemove } from './storage.js';

export function hasActiveOfflineMatch() {
  try {
    const saved = storageGet('currentGame', null);
    if (!saved) return { active: false, movesCount: 0 };

    const movesCount = saved.movesCount || (Array.isArray(saved.history) ? saved.history.length : 0);
    const isFinished = saved.isOver || saved.status === 'finished' || saved.status === 'resigned';

    // A match is active if moves were made and it has not concluded
    if (movesCount > 0 && !isFinished) {
      return {
        active: true,
        movesCount,
        turn: saved.turn,
        fen: saved.fen,
      };
    }
  } catch (err) {
    console.warn('[conflictCheck] offline check error:', err);
  }
  return { active: false, movesCount: 0 };
}

export function hasActiveOnlineMatch() {
  try {
    const saved = sessionGet('onlineSession', null);
    if (saved && typeof saved.roomId === 'string' && saved.roomId.trim().length === 6) {
      return {
        active: true,
        roomId: saved.roomId.toUpperCase(),
        myColor: saved.myColor || 'white',
      };
    }
  } catch (err) {
    console.warn('[conflictCheck] online check error:', err);
  }
  return { active: false, roomId: null };
}

export function abandonOfflineMatch() {
  storageRemove('currentGame');
  storageRemove('offlineClocks');
  storageRemove('timeMode');
}

export function abandonOnlineMatch(socket = null) {
  const session = sessionGet('onlineSession', null);
  if (session?.roomId && socket?.connected) {
    try {
      socket.emit('game:resign', { roomId: session.roomId });
    } catch {
      // Ignore
    }
  }
  sessionRemove('onlineSession');
  sessionRemove('onlineClocks');
}

