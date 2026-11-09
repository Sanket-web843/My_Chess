import { v4 as uuidv4 } from 'uuid';
import { GameSession } from './gameSession.js';
import { generateRoomCode } from '../utils/helpers.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const GC_INTERVAL_MS = 2 * 60 * 1000; // run GC every 2 minutes

/**
 * In-memory store for all active game sessions.
 * Key: roomId (string)  →  Value: GameSession
 *
 * Includes automatic garbage collection:
 * Sessions with no connected sockets for 30 minutes are deleted.
 */
class GameManager {
  constructor() {
    /** @type {Map<string, GameSession>} */
    this.sessions = new Map();

    // Start periodic garbage collection
    this._startGarbageCollector();
  }

  /**
   * Creates a new game session with a unique 6-character room code.
   * @param {'timed'|'unlimited'} timeMode
   * @returns {GameSession}
   */
  createSession(timeMode = 'timed') {
    let id;
    do {
      id = generateRoomCode(6);
    } while (this.sessions.has(id));

    const session = new GameSession(id, timeMode);
    this.sessions.set(id, session);
    console.log(`[GameManager] Session created → ${id}`);
    return session;
  }

  /**
   * Retrieves an existing session by ID.
   * @param {string} id
   * @returns {GameSession | undefined}
   */
  getSession(id) {
    return this.sessions.get(id);
  }

  /**
   * Deletes a session from the store.
   * @param {string} id
   */
  deleteSession(id) {
    this.sessions.delete(id);
    console.log(`[GameManager] Session deleted → ${id}`);
  }

  /**
   * Marks a socket as disconnected in any session they belong to,
   * updating `disconnectedAt` if no sockets remain.
   * @param {string} socketId
   */
  handleSocketDisconnect(socketId) {
    const now = Date.now();
    for (const [, session] of this.sessions) {
      let changed = false;
      if (session.players.white === socketId) {
        session.players.white = null;
        changed = true;
      }
      if (session.players.black === socketId) {
        session.players.black = null;
        changed = true;
      }
      if (changed && session.isAbandoned() && !session.disconnectedAt) {
        session.disconnectedAt = now;
      }
    }
  }

  /**
   * Runs garbage collection:
   * Deletes sessions with no connected sockets for >= 30 minutes,
   * or idle waiting sessions created > 30 minutes ago without activity.
   */
  collectGarbage() {
    const now = Date.now();
    let pruned = 0;

    for (const [id, session] of this.sessions.entries()) {
      const isUnoccupied = session.isAbandoned();
      const timeDisconnected = session.disconnectedAt ? now - session.disconnectedAt : 0;
      const timeSinceActivity = now - (session.lastActivityAt || session.createdAt);

      // Condition 1: No connected sockets for >= 30 minutes
      const abandonedExpired = isUnoccupied && (timeDisconnected >= THIRTY_MINUTES_MS || timeSinceActivity >= THIRTY_MINUTES_MS);

      // Condition 2: Session finished and untouched for 30 minutes
      const finishedExpired = session.status === 'finished' && timeSinceActivity >= THIRTY_MINUTES_MS;

      if (abandonedExpired || finishedExpired) {
        this.sessions.delete(id);
        pruned++;
        console.log(`[GameManager GC] Pruned dead session ${id} (unoccupied: ${isUnoccupied}, age: ${Math.round(timeSinceActivity / 60000)}m)`);
      }
    }

    if (pruned > 0) {
      console.log(`[GameManager GC] Collected ${pruned} session(s). Active count: ${this.sessions.size}`);
    }
  }

  _startGarbageCollector() {
    // Unref so the interval does not block process exit if used in tests/scripts
    const timer = setInterval(() => this.collectGarbage(), GC_INTERVAL_MS);
    if (timer.unref) timer.unref();
  }

  /** Returns the number of active sessions. */
  get count() {
    return this.sessions.size;
  }
}

// Singleton instance shared across the server process
export const gameManager = new GameManager();
