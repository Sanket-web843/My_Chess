/**
 * utils/chess.js — Pure chess helpers shared by both Offline and Online modes.
 *
 * These functions are STATELESS — they receive a Chess instance or FEN string
 * and return derived data. They never call the server or touch localStorage.
 */

import { Chess } from 'chess.js';

/**
 * Returns a new Chess instance initialised from the given FEN.
 * Falls back to the starting position on invalid FEN.
 * @param {string} [fen]
 * @returns {Chess}
 */
export function createChessInstance(fen) {
  try {
    return fen ? new Chess(fen) : new Chess();
  } catch {
    return new Chess();
  }
}

/**
 * Returns all legal moves for a given square in the verbose format.
 * @param {Chess} chess
 * @param {string} square - e.g. 'e2'
 * @returns {import('chess.js').Move[]}
 */
export function getLegalMovesForSquare(chess, square) {
  return chess.moves({ square, verbose: true });
}

/**
 * Derives a human-readable result string from the current chess state.
 * @param {Chess} chess
 * @returns {string | null}  null if game is still in progress
 */
export function getGameResult(chess) {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    return `${winner} wins by checkmate`;
  }
  if (chess.isStalemate())          return 'Draw by stalemate';
  if (chess.isThreefoldRepetition()) return 'Draw by threefold repetition';
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material';
  if (typeof chess.isDrawByFiftyMoves === 'function' && chess.isDrawByFiftyMoves()) {
    return 'Draw by 50-move rule';
  }
  if (chess.isDraw())               return 'Draw by 50-move rule';
  return 'Game over';
}

/**
 * FIDE Rule 6.9: Checks if a color has enough material to checkmate.
 * A bare King or King + single minor piece (Knight or Bishop) cannot checkmate.
 * @param {Chess} chess
 * @param {'white'|'black'} color
 * @returns {boolean}
 */
export function hasMatingMaterial(chess, color) {
  const targetChar = color === 'white' ? 'w' : 'b';
  const board = chess.board();
  const nonKings = [];

  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.color === targetChar && sq.type !== 'k') {
        nonKings.push(sq.type);
      }
    }
  }

  // Bare king
  if (nonKings.length === 0) return false;
  // King + single knight or king + single bishop cannot deliver checkmate
  if (nonKings.length === 1 && (nonKings[0] === 'n' || nonKings[0] === 'b')) {
    return false;
  }
  return true;
}

/**
 * Returns 'white' | 'black' from a chess.js turn value ('w' | 'b').
 * @param {'w'|'b'} turn
 * @returns {'white'|'black'}
 */
export function turnToColor(turn) {
  return turn === 'w' ? 'white' : 'black';
}
