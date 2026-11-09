import { gameManager } from '../game/gameManager.js';
import { isValidRoomCode } from '../utils/helpers.js';

/**
 * Handles all socket events for a single connected client.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function onConnection(io, socket) {

  // ── Helper: emit updated game state to both players in the room ───
  function broadcastState(session) {
    io.to(session.id).emit('game:state', session.toSnapshot());
  }

  // ── Helper: get session and validate caller is a player in it ─────
  function getSessionForPlayer(roomId, ack) {
    const session = gameManager.getSession(roomId);
    if (!session) {
      if (typeof ack === 'function') ack({ error: 'Room not found' });
      return null;
    }
    const isPlayer =
      session.players.white === socket.id ||
      session.players.black === socket.id;
    if (!isPlayer) {
      if (typeof ack === 'function') ack({ error: 'You are not a player in this room' });
      return null;
    }
    return session;
  }

  // ── room:create ───────────────────────────────────────────────────
  /**
   * Generates a 6-character room code, instantiates a new GameSession,
   * assigns creator as White, joins socket, and emits details back.
   * data: { timeMode?: 'timed'|'unlimited' }
   * ack:  { roomId: string, myColor: 'white' } | { error: string }
   */
  socket.on('room:create', (data, ack) => {
    const timeMode = data?.timeMode || 'classical';
    const playerToken = data?.playerToken;
    const session = gameManager.createSession(timeMode);

    // Assign creator as White and set persistent player token
    session.players.white = socket.id;
    if (playerToken) session.setPlayerToken('white', playerToken);

    // Join the Socket.IO room
    socket.join(session.id);

    console.log(`[room:create] socket=${socket.id} → room=${session.id} (${timeMode})`);

    const details = {
      roomId: session.id,
      myColor: 'white',
      session: session.toSnapshot(),
    };

    if (typeof ack === 'function') ack(details);

    // Emit initial snapshot to the creator
    socket.emit('game:state', session.toSnapshot());
  });

  // ── room:join ─────────────────────────────────────────────────────
  /**
   * Joins an existing room if < 2 players. Validates room code,
   * assigns Black pieces (if creator is White), and broadcasts game:start.
   * data: { roomId: string, playerToken?: string }
   * ack:  { roomId: string, myColor: 'black' } | { error: string }
   */
  socket.on('room:join', (data, ack) => {
    const rawCode = data?.roomId || data?.code;
    const roomId = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const playerToken = data?.playerToken;

    if (!isValidRoomCode(roomId)) {
      if (typeof ack === 'function') ack({ error: 'Invalid room code format (must be 6 letters/digits)' });
      return;
    }

    const session = gameManager.getSession(roomId);

    if (!session) {
      if (typeof ack === 'function') ack({ error: 'Room not found' });
      return;
    }

    // Check if the room has < 2 players
    const playerCount = (session.players.white ? 1 : 0) + (session.players.black ? 1 : 0);
    if (playerCount >= 2 || session.status !== 'waiting') {
      if (typeof ack === 'function') ack({ error: 'Room is full or game has already started' });
      return;
    }

    if (session.players.white === socket.id) {
      if (typeof ack === 'function') ack({ error: 'You created this room — share the code with a friend' });
      return;
    }

    // Assign joiner Black pieces (or White if White was unassigned)
    const assignedColor = !session.players.white ? 'white' : 'black';
    session.players[assignedColor] = socket.id;
    if (playerToken) session.setPlayerToken(assignedColor, playerToken);

    session.status = 'active';
    session.lastActivityAt = Date.now();

    socket.join(session.id);

    console.log(`[room:join] socket=${socket.id} joined room=${session.id}`);

    const myColor = assignedColor;
    if (typeof ack === 'function') ack({ roomId: session.id, myColor });

    // Start authoritative server match clocks
    session.startClocks(() => {
      broadcastState(session);
    });

    // Broadcast game:start to both players in the room
    const snapshot = session.toSnapshot();
    io.to(session.id).emit('game:start', snapshot);
    // Also broadcast game:state for full state consistency
    io.to(session.id).emit('game:state', snapshot);
  });

  // ── room:reconnect ────────────────────────────────────────────────
  /**
   * Reconnects an existing player to their active room using playerToken.
   * data: { roomId: string, playerToken: string }
   * ack:  { roomId: string, myColor: string, session: object } | { error: string }
   */
  socket.on('room:reconnect', (data, ack) => {
    const rawCode = data?.roomId || data?.code;
    const roomId = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const playerToken = data?.playerToken;

    if (!isValidRoomCode(roomId)) {
      if (typeof ack === 'function') ack({ error: 'Invalid room code' });
      return;
    }

    const session = gameManager.getSession(roomId);
    if (!session) {
      if (typeof ack === 'function') ack({ error: 'Match has ended or expired' });
      return;
    }

    const color =
      session.isTokenMatch('white', playerToken) ? 'white' :
      session.isTokenMatch('black', playerToken) ? 'black' : null;

    if (!color) {
      if (typeof ack === 'function') ack({ error: 'Player token not recognized' });
      return;
    }

    // Cancel pending abandonment timer and restore player
    session.cancelAbandonTimer(color);
    session.players[color] = socket.id;
    session.lastActivityAt = Date.now();

    socket.join(session.id);

    console.log(`[room:reconnect] socket=${socket.id} reconnected as ${color} to room=${session.id}`);

    const details = {
      roomId: session.id,
      myColor: color,
      session: session.toSnapshot(),
    };

    if (typeof ack === 'function') ack(details);

    // Broadcast updated state and reconnection notice to opponent
    io.to(session.id).emit('game:state', session.toSnapshot());
    io.to(session.id).emit('game:playerReconnected', { color });
  });

  // ── game:move ─────────────────────────────────────────────────────
  /**
   * Validates and applies a move; broadcasts updated state.
   * data: { roomId, from, to, promotion? }
   * ack:  {} | { error: string }
   */
  socket.on('game:move', (data, ack) => {
    const { roomId, from, to, promotion } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active') {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    // Enforce turn order: only the current player may move
    const turn = session.getTurn(); // 'w' | 'b'
    const moverColor = turn === 'w' ? 'white' : 'black';
    if (session.players[moverColor] !== socket.id) {
      if (typeof ack === 'function') ack({ error: 'Not your turn' });
      return;
    }

    const move = session.applyMove({ from, to, promotion }, () => {
      broadcastState(session);
    });
    if (!move) {
      if (typeof ack === 'function') ack({ error: 'Illegal move or time expired' });
      return;
    }

    if (session.isOver()) {
      session.status = 'finished';
      session.stopClocks();
    }

    console.log(`[game:move]   room=${session.id} ${from}->${to}${promotion ? '='+promotion : ''}`);

    if (typeof ack === 'function') ack({});
    broadcastState(session);
  });

  // ── game:resign ───────────────────────────────────────────────────
  /**
   * The calling player resigns; broadcasts updated state.
   * data: { roomId }
   * ack:  {} | { error: string }
   */
  socket.on('game:resign', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active') {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    // Determine resigning color
    const color =
      session.players.white === socket.id ? 'white' : 'black';
    const winner = color === 'white' ? 'Black' : 'White';

    session.stopClocks();
    session.status = 'finished';
    session.resignedBy = color;
    session.resultText = `${winner} wins — ${color} resigned`;

    console.log(`[game:resign] room=${session.id} ${color} resigned`);

    if (typeof ack === 'function') ack({});
    // toSnapshot includes status=finished; add resultText manually
    io.to(session.id).emit('game:state', {
      ...session.toSnapshot(),
      result: session.resultText,
    });
  });

  // ── game:drawOffer ────────────────────────────────────────────────
  /**
   * Forwards a draw offer to the opponent.
   * The opponent can respond with game:drawAccept or game:drawReject.
   * data: { roomId }
   * ack:  {} | { error: string }
   */
  socket.on('game:drawOffer', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active') {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    const color =
      session.players.white === socket.id ? 'white' : 'black';
    const opponentColor = color === 'white' ? 'black' : 'white';
    const opponentId = session.players[opponentColor];

    if (opponentId) {
      io.to(opponentId).emit('game:drawOffer', { from: color });
    }

    if (typeof ack === 'function') ack({});
  });

  // ── game:drawAccept ───────────────────────────────────────────────
  /**
   * Accepts a pending draw offer — game ends as draw.
   * data: { roomId }
   */
  socket.on('game:drawAccept', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active') {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    session.stopClocks();
    session.status = 'finished';
    session.resultText = 'Draw by agreement';

    if (typeof ack === 'function') ack({});
    io.to(session.id).emit('game:state', {
      ...session.toSnapshot(),
      isDraw: true,
      result: session.resultText,
    });
  });

  // ── game:drawReject ───────────────────────────────────────────────
  /**
   * Rejects a pending draw offer — notifies the offerer.
   * data: { roomId }
   */
  socket.on('game:drawReject', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    const color =
      session.players.white === socket.id ? 'white' : 'black';
    const offererColor = color === 'white' ? 'black' : 'white';
    const offererId = session.players[offererColor];

    if (offererId) {
      io.to(offererId).emit('game:drawRejected');
    }

    if (typeof ack === 'function') ack({});
  });

  // ── game:pauseOffer ───────────────────────────────────────────────
  /**
   * Forwards a timed pause offer to the opponent.
   * data: { roomId, durationMinutes: 1 | 2 | 5 }
   */
  socket.on('game:pauseOffer', (data, ack) => {
    const { roomId, durationMinutes = 2 } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active' || session.isOver()) {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    if (session.isPaused) {
      if (typeof ack === 'function') ack({ error: 'Game is already paused' });
      return;
    }

    const validDuration = [1, 2, 5].includes(Number(durationMinutes)) ? Number(durationMinutes) : 2;
    const color = session.players.white === socket.id ? 'white' : 'black';
    const opponentColor = color === 'white' ? 'black' : 'white';
    const opponentId = session.players[opponentColor];

    if (opponentId) {
      io.to(opponentId).emit('game:pauseOffer', { from: color, durationMinutes: validDuration });
    }

    if (typeof ack === 'function') ack({});
  });

  // ── game:pauseAccept ──────────────────────────────────────────────
  /**
   * Accepts pause offer — freezes clocks, sets timer limit, and marks pauser.
   * data: { roomId, durationMinutes?: number }
   */
  socket.on('game:pauseAccept', (data, ack) => {
    const { roomId, durationMinutes } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (session.status !== 'active' || session.isOver()) {
      if (typeof ack === 'function') ack({ error: 'Game is not active' });
      return;
    }

    // The player who requested the pause is the opponent of whoever accepted
    const callerColor = session.players.white === socket.id ? 'white' : 'black';
    const offererColor = callerColor === 'white' ? 'black' : 'white';
    const validDuration = [1, 2, 5].includes(Number(durationMinutes)) ? Number(durationMinutes) : 2;

    session.pause(offererColor, validDuration, () => {
      broadcastState(session);
    });

    console.log(`[game:pause] room=${session.id} paused by ${offererColor} for ${validDuration} min limit`);

    if (typeof ack === 'function') ack({});
    broadcastState(session);
    io.to(session.id).emit('game:paused', { by: offererColor, durationMinutes: validDuration });
  });

  // ── game:pauseReject ──────────────────────────────────────────────
  /**
   * Rejects a pending pause offer.
   * data: { roomId }
   */
  socket.on('game:pauseReject', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    const color = session.players.white === socket.id ? 'white' : 'black';
    const opponentColor = color === 'white' ? 'black' : 'white';
    const opponentId = session.players[opponentColor];

    if (opponentId) {
      io.to(opponentId).emit('game:pauseRejected');
    }

    if (typeof ack === 'function') ack({});
  });

  // ── game:resume ───────────────────────────────────────────────────
  /**
   * Resumes the paused match. Strictly enforced: only the player who paused can resume!
   * data: { roomId }
   */
  socket.on('game:resume', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (!session.isPaused) {
      if (typeof ack === 'function') ack({ error: 'Game is not paused' });
      return;
    }

    const callerColor = session.players.white === socket.id ? 'white' : 'black';
    if (session.pausedBy && callerColor !== session.pausedBy) {
      if (typeof ack === 'function') ack({ error: 'Only the player who paused can resume the match' });
      return;
    }

    session.resume(callerColor);

    console.log(`[game:resume] room=${session.id} resumed by ${callerColor}`);

    if (typeof ack === 'function') ack({});
    broadcastState(session);
    io.to(session.id).emit('game:resumed');
  });

  // Backward-compatible alias for resume
  socket.on('game:resumeAccept', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session || !session.isPaused) {
      if (typeof ack === 'function') ack({});
      return;
    }
    const callerColor = session.players.white === socket.id ? 'white' : 'black';
    if (!session.pausedBy || callerColor === session.pausedBy) {
      session.resume(callerColor);
      broadcastState(session);
      io.to(session.id).emit('game:resumed');
    }
    if (typeof ack === 'function') ack({});
  });

  // ── chat:send ─────────────────────────────────────────────────────
  /**
   * Broadcasts a chat message between players in the room.
   * data: { roomId: string, text: string }
   */
  socket.on('chat:send', (data, ack) => {
    const { roomId, text } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    if (typeof text !== 'string' || !text.trim()) {
      if (typeof ack === 'function') ack({ error: 'Message cannot be empty' });
      return;
    }

    const cleanText = text.trim().slice(0, 150);
    const senderColor = session.players.white === socket.id ? 'white' : 'black';
    const message = {
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      sender: senderColor,
      text: cleanText,
      timestamp: Date.now(),
    };

    io.to(session.id).emit('chat:message', message);
    if (typeof ack === 'function') ack({ ok: true });
  });

  // ── game:rematch ──────────────────────────────────────────────────
  /**
   * Resets and restarts the match in the same room for the same two players without creating a new room.
   * Swaps colors so players take turns playing White and Black.
   * data: { roomId: string }
   */
  socket.on('game:rematch', (data, ack) => {
    const { roomId } = data ?? {};
    const session = getSessionForPlayer(roomId, ack);
    if (!session) return;

    // If game is still active, forfeit for caller before resetting
    if (session.status === 'active') {
      const callerColor = session.players.white === socket.id ? 'white' : 'black';
      session.resignedBy = callerColor;
      session.status = 'finished';
    }

    session.rematch();
    console.log(`[game:rematch] room=${session.id} restarted in same session with colors swapped`);

    if (typeof ack === 'function') ack({ ok: true });

    const snapshot = session.toSnapshot();
    io.to(session.id).emit('game:start', snapshot);
    io.to(session.id).emit('game:state', snapshot);
  });

  // ── Cleanup on disconnect with 60s reconnection grace period ───────
  socket.on('disconnect', () => {
    for (const [, session] of gameManager.sessions) {
      const isWhite = session.players.white === socket.id;
      const isBlack = session.players.black === socket.id;
      if (!isWhite && !isBlack) continue;

      const disconnectedColor = isWhite ? 'white' : 'black';
      const remainingColor = isWhite ? 'black' : 'white';
      const remainingName = remainingColor === 'white' ? 'White' : 'Black';

      // Clear the disconnected socket but keep session alive
      session.players[disconnectedColor] = null;
      session.disconnectedAt[disconnectedColor] = Date.now();

      if (session.status === 'active') {
        console.log(`[disconnect] ${disconnectedColor} disconnected from room=${session.id}. Starting 60s grace period.`);

        // Notify opponent that player is disconnected
        io.to(session.id).emit('game:playerDisconnected', {
          color: disconnectedColor,
          timeoutSeconds: 60,
        });
        io.to(session.id).emit('game:state', session.toSnapshot());

        // Cancel any existing timer for this color
        session.cancelAbandonTimer(disconnectedColor);

        // Start 60-second abandonment countdown
        session.abandonTimers[disconnectedColor] = setTimeout(() => {
          if (session.status === 'active' && !session.players[disconnectedColor]) {
            const canMate = typeof session.hasMatingMaterial === 'function'
              ? session.hasMatingMaterial(remainingColor)
              : true;

            session.stopClocks();
            session.status = 'finished';
            session.resultText = canMate
              ? `${remainingName} wins — ${disconnectedColor} abandoned the match`
              : `Draw — ${disconnectedColor} abandoned vs insufficient material`;

            console.log(`[abandonment] room=${session.id} ${disconnectedColor} did not reconnect in 60s. Finalized.`);

            io.to(session.id).emit('game:state', {
              ...session.toSnapshot(),
              result: session.resultText,
            });
          }
        }, 60000);
      } else if (session.status === 'waiting') {
        // In waiting room, give 45s before cleaning up if creator left
        setTimeout(() => {
          if (session.status === 'waiting' && !session.players.white) {
            gameManager.deleteSession(session.id);
          }
        }, 45000);
      }
      break;
    }

    // Update socket tracking & disconnected timers for garbage collection
    gameManager.handleSocketDisconnect(socket.id);
  });
}
