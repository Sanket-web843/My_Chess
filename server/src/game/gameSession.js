import { Chess } from 'chess.js';

const TIME_CONFIGS = {
  bullet:    { initialMs: 1 * 60 * 1000, incrementMs: 0 },
  blitz:     { initialMs: 3 * 60 * 1000, incrementMs: 2 * 1000 },
  rapid:     { initialMs: 10 * 60 * 1000, incrementMs: 0 },
  classical: { initialMs: 15 * 60 * 1000, incrementMs: 5 * 1000 },
  timed:     { initialMs: 15 * 60 * 1000, incrementMs: 5 * 1000 },
  unlimited: { initialMs: Infinity, incrementMs: 0 },
};

/**
 * Represents a single active game session.
 * All rules, moves, and match clocks are strictly authoritative on the server.
 */
export class GameSession {
  /**
   * @param {string} id Unique room / game ID
   * @param {string} timeMode
   */
  constructor(id, timeMode = 'classical') {
    this.id = id;
    this.chess = new Chess();
    this.players = { white: null, black: null }; // socket IDs
    this.playerTokens = { white: null, black: null }; // persistent reconnect tokens
    this.status = 'waiting'; // 'waiting' | 'active' | 'finished'
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.disconnectedAt = { white: null, black: null };
    this.abandonTimers = { white: null, black: null };
    this.resultText = null;
    this.isDraw = false;
    this.isPaused = false;
    this.pausedBy = null;
    this.pauseTimer = null;
    this.pauseExpiresAt = null;
    this.pauseDurationMs = null;

    // Authoritative Clocks
    const cfg = TIME_CONFIGS[timeMode] || TIME_CONFIGS['classical'];
    this.timeMode = timeMode;
    this.initialMs = cfg.initialMs;
    this.incrementMs = cfg.incrementMs;
    this.isUnlimited = !isFinite(cfg.initialMs);
    this.clocks = {
      white: cfg.initialMs,
      black: cfg.initialMs,
    };
    this.lastMoveTime = null;
    this.clockTimer = null;
    this.onTimeoutCallback = null;
  }

  setPlayerToken(color, token) {
    if (color === 'white' || color === 'black') {
      this.playerTokens[color] = token || null;
    }
  }

  isTokenMatch(color, token) {
    if (!token || !this.playerTokens[color]) return false;
    return this.playerTokens[color] === token;
  }

  cancelAbandonTimer(color) {
    if (this.abandonTimers[color]) {
      clearTimeout(this.abandonTimers[color]);
      this.abandonTimers[color] = null;
    }
    this.disconnectedAt[color] = null;
  }

  /**
   * Starts authoritative clocks when the match becomes active.
   * @param {(session: GameSession) => void} [onTimeout]
   */
  startClocks(onTimeout) {
    if (typeof onTimeout === 'function') {
      this.onTimeoutCallback = onTimeout;
    }
    if (this.isUnlimited || this.status !== 'active') return;

    this.lastMoveTime = Date.now();
    this.scheduleTimeout();
  }

  /**
   * Cancels any pending server clock timer.
   */
  stopClocks() {
    if (this.clockTimer) {
      clearTimeout(this.clockTimer);
      this.clockTimer = null;
    }
  }

  /**
   * Cancels any pending pause expiration timer.
   */
  stopPauseTimer() {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /**
   * Pauses the game session, freezes clocks, and starts the pause expiration countdown.
   * If not resumed before expiration, the pausing player forfeits and opponent wins.
   * @param {'white'|'black'|null} [requestedBy]
   * @param {number} [durationMinutes] - 1, 2, or 5
   * @param {(session: GameSession) => void} [onPauseTimeout]
   * @returns {boolean}
   */
  pause(requestedBy = null, durationMinutes = 2, onPauseTimeout = null) {
    if (this.isPaused || this.status !== 'active' || this.isOver()) return false;

    // Deduct elapsed time up to the exact moment of pausing
    if (!this.isUnlimited && this.lastMoveTime) {
      const now = Date.now();
      const elapsed = Math.max(0, now - this.lastMoveTime);
      const currentTurn = this.getTurn() === 'w' ? 'white' : 'black';
      this.clocks[currentTurn] = Math.max(0, this.clocks[currentTurn] - elapsed);
    }

    this.stopClocks();
    this.stopPauseTimer();
    this.lastMoveTime = null;
    this.isPaused = true;
    this.pausedBy = requestedBy;
    this.lastActivityAt = Date.now();

    // Valid pause durations: 1, 2, or 5 min (max 5 min)
    const validMinutes = [1, 2, 5].includes(Number(durationMinutes)) ? Number(durationMinutes) : 2;
    this.pauseDurationMs = validMinutes * 60 * 1000;
    this.pauseExpiresAt = Date.now() + this.pauseDurationMs;

    // Start server authoritative pause expiration timer
    this.pauseTimer = setTimeout(() => {
      if (this.status === 'active' && this.isPaused) {
        this.stopPauseTimer();
        const opponentColor = this.pausedBy === 'white' ? 'black' : 'white';
        const opponentName = opponentColor === 'white' ? 'White' : 'Black';
        const pauserName = this.pausedBy === 'white' ? 'White' : 'Black';

        this.status = 'finished';
        this.resultText = `${opponentName} wins — ${pauserName} failed to resume within ${validMinutes} min pause limit`;
        console.log(`[pause:timeout] room=${this.id}: ${this.resultText}`);

        if (typeof onPauseTimeout === 'function') {
          onPauseTimeout(this);
        }
      }
    }, this.pauseDurationMs);

    return true;
  }

  /**
   * Resumes the game session from the exact paused clock values.
   * Only the player who paused can resume!
   * @param {'white'|'black'|null} [requestedBy]
   * @returns {boolean}
   */
  resume(requestedBy = null) {
    if (!this.isPaused || this.status !== 'active' || this.isOver()) return false;
    // Only the player who paused is allowed to resume
    if (requestedBy && this.pausedBy && requestedBy !== this.pausedBy) {
      return false;
    }

    this.stopPauseTimer();
    this.isPaused = false;
    this.pausedBy = null;
    this.pauseExpiresAt = null;
    this.pauseDurationMs = null;
    this.lastActivityAt = Date.now();

    if (!this.isUnlimited) {
      this.lastMoveTime = Date.now();
      this.scheduleTimeout();
    }
    return true;
  }

  /**
   * Schedules a server-side timer for when the currently active player's clock hits zero.
   */
  scheduleTimeout() {
    this.stopClocks();
    if (this.isUnlimited || this.status !== 'active' || this.isOver()) return;

    const currentTurn = this.getTurn() === 'w' ? 'white' : 'black';
    const remaining = Math.max(0, this.clocks[currentTurn]);

    this.clockTimer = setTimeout(() => {
      this.handleTimeout(currentTurn);
    }, remaining);
  }

  /**
   * Authoritative server flag fall: player ran out of time.
   * @param {'white'|'black'} flaggedColor
   */
  handleTimeout(flaggedColor) {
    if (this.status !== 'active') return;
    this.stopClocks();

    const opponentColor = flaggedColor === 'white' ? 'black' : 'white';
    const opponentName = opponentColor === 'white' ? 'White' : 'Black';
    const flaggedName = flaggedColor === 'white' ? 'White' : 'Black';

    const canMate = this.hasMatingMaterial(opponentColor);
    this.status = 'finished';
    this.clocks[flaggedColor] = 0;

    if (canMate) {
      this.resultText = `${opponentName} wins on time (${flaggedName} ran out of time)`;
    } else {
      this.resultText = `Draw — ${flaggedName} ran out of time against insufficient material`;
      this.isDraw = true;
    }

    console.log(`[timeout] room=${this.id}: ${this.resultText}`);

    if (typeof this.onTimeoutCallback === 'function') {
      this.onTimeoutCallback(this);
    }
  }

  /**
   * Resets the game session for a rematch and swaps player colors.
   */
  rematch() {
    this.stopClocks();
    this.chess.reset();
    this.status = 'active';
    this.resultText = null;
    this.isDraw = false;
    this.isPaused = false;
    this.pausedBy = null;
    this.resignedBy = null;
    this.lastActivityAt = Date.now();

    const cfg = TIME_CONFIGS[this.timeMode] || TIME_CONFIGS['classical'];
    this.clocks = {
      white: cfg.initialMs,
      black: cfg.initialMs,
    };
    this.lastMoveTime = null;

    // Swap players and their reconnect tokens
    const prevW = this.players.white;
    const prevB = this.players.black;
    const prevTokenW = this.playerTokens.white;
    const prevTokenB = this.playerTokens.black;

    this.players.white = prevB;
    this.players.black = prevW;
    this.playerTokens.white = prevTokenB;
    this.playerTokens.black = prevTokenW;

    this.cancelAbandonTimer('white');
    this.cancelAbandonTimer('black');

    this.startClocks(this.onTimeoutCallback);
  }

  /** Returns the current authoritative FEN string. */
  getFen() {
    return this.chess.fen();
  }

  /** Returns whose turn it is: 'w' or 'b'. */
  getTurn() {
    return this.chess.turn();
  }

  /**
   * Validates and applies a move against the server-side chess engine.
   * Authoritatively updates match clocks and verifies flag falls.
   *
   * @param {{ from: string, to: string, promotion?: string }} move
   * @param {(session: GameSession) => void} [onTimeout]
   * @returns {import('chess.js').Move | null}
   */
  applyMove(move, onTimeout) {
    if (this.isPaused) {
      return null;
    }
    if (typeof onTimeout === 'function') {
      this.onTimeoutCallback = onTimeout;
    }
    if (!move || typeof move.from !== 'string' || typeof move.to !== 'string') {
      return null;
    }

    const moverColor = this.getTurn() === 'w' ? 'white' : 'black';
    const now = Date.now();

    // Check clock expiration if match is timed
    if (!this.isUnlimited && this.lastMoveTime) {
      const elapsed = Math.max(0, now - this.lastMoveTime);
      const remaining = this.clocks[moverColor] - elapsed;
      if (remaining <= 0) {
        this.handleTimeout(moverColor);
        return null;
      }
      // Apply increment to the player who completed the move
      this.clocks[moverColor] = remaining + this.incrementMs;
    }

    try {
      // Validate promotion value if present
      const cleanMove = {
        from: move.from.toLowerCase(),
        to: move.to.toLowerCase(),
      };
      if (move.promotion) {
        const promo = String(move.promotion).toLowerCase();
        if (['q', 'r', 'b', 'n'].includes(promo)) {
          cleanMove.promotion = promo;
        }
      }

      const result = this.chess.move(cleanMove);
      if (result) {
        this.lastActivityAt = now;
        this.lastMoveTime = now;

        if (this.isOver()) {
          this.status = 'finished';
          this.stopClocks();
        } else {
          this.scheduleTimeout();
        }
      }
      return result;
    } catch {
      return null;
    }
  }

  /** Returns true when the game has reached a terminal state. */
  isOver() {
    return this.status === 'finished' || this.chess.isGameOver();
  }

  /** Returns true if neither white nor black socket is connected. */
  isAbandoned() {
    return !this.players.white && !this.players.black;
  }

  /**
   * Derives human-readable result text if the game has ended.
   * @returns {string | null}
   */
  getResult() {
    if (this.resultText) return this.resultText;
    if (!this.chess.isGameOver()) return null;
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      return `${winner} wins by checkmate`;
    }
    if (this.chess.isStalemate()) return 'Draw by stalemate';
    if (this.chess.isThreefoldRepetition()) return 'Draw by threefold repetition';
    if (this.chess.isInsufficientMaterial()) return 'Draw by insufficient material';
    if (this.chess.isDraw()) return 'Draw by 50-move rule';
    return 'Game over';
  }

  /**
   * FIDE Rule 6.9: Checks if a color has enough material to checkmate.
   * Bare king or king + single minor piece cannot deliver checkmate.
   * @param {'white'|'black'} color
   * @returns {boolean}
   */
  hasMatingMaterial(color) {
    const targetChar = color === 'white' ? 'w' : 'b';
    const board = this.chess.board();
    const nonKings = [];

    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.color === targetChar && sq.type !== 'k') {
          nonKings.push(sq.type);
        }
      }
    }

    if (nonKings.length === 0) return false;
    if (nonKings.length === 1 && (nonKings[0] === 'n' || nonKings[0] === 'b')) {
      return false;
    }
    return true;
  }

  /** Returns a plain-object snapshot suitable for emitting over the wire. */
  toSnapshot() {
    let currentWhite = this.clocks.white;
    let currentBlack = this.clocks.black;

    // Deduct live elapsed time for the active player's clock (only if not paused)
    if (!this.isUnlimited && this.status === 'active' && this.lastMoveTime && !this.isOver() && !this.isPaused) {
      const now = Date.now();
      const elapsed = Math.max(0, now - this.lastMoveTime);
      const currentTurn = this.getTurn() === 'w' ? 'white' : 'black';
      if (currentTurn === 'white') {
        currentWhite = Math.max(0, currentWhite - elapsed);
      } else {
        currentBlack = Math.max(0, currentBlack - elapsed);
      }
    }

    return {
      id: this.id,
      fen: this.getFen(),
      turn: this.getTurn(),
      status: this.status,
      isOver: this.isOver(),
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw() || !!this.isDraw,
      isPaused: this.isPaused,
      pausedBy: this.pausedBy,
      pauseExpiresAt: this.pauseExpiresAt,
      pauseDurationMs: this.pauseDurationMs,
      result: this.getResult(),
      players: this.players,
      connected: {
        white: !!this.players.white,
        black: !!this.players.black,
      },
      disconnectedAt: this.disconnectedAt,
      timeMode: this.timeMode,
      history: this.chess.history({ verbose: true }),
      clocks: {
        white: currentWhite,
        black: currentBlack,
      },
      clockUpdatedAt: Date.now(),
      incrementMs: this.incrementMs,
      isUnlimited: this.isUnlimited,
    };
  }
}
