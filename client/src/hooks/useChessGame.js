/**
 * useChessGame.js — Complete offline chess engine hook.
 *
 * chess.js is the ONLY source of truth for rules.
 * This hook never touches the network or Socket.IO.
 *
 * Manages:
 *  - FEN (board position)
 *  - Current turn (white / black)
 *  - Move history (verbose)
 *  - Last move (for square highlighting)
 *  - Captured pieces (derived from history)
 *  - Game status (active / checkmate / stalemate / draw / resigned)
 *  - Game over flag
 *  - Legal move squares for the selected piece
 *  - Pawn promotion flow
 */

import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { storageGet, storageSet, storageRemove } from '../utils/storage.js';
import { getGameResult, getLegalMovesForSquare, hasMatingMaterial, turnToColor } from '../utils/chess.js';
import { soundManager } from '../services/sound.js';

// ── localStorage key ──────────────────────────────────────────────
const SAVE_KEY = 'currentGame';

// ── Piece type → display order for captured pieces panel ─────────
const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];

// ── Helpers ───────────────────────────────────────────────────────

/** Derives captured pieces for each side from the verbose move history. */
function deriveCaptured(history) {
  const captured = { white: [], black: [] }; // white/black = who was captured

  for (const move of history) {
    if (move.captured) {
      // The capturing side is move.color ('w'=white moved, 'b'=black moved)
      // So the captured piece belonged to the opponent
      const capturedBy = move.color === 'w' ? 'white' : 'black';
      captured[capturedBy === 'white' ? 'black' : 'white'].push({
        type: move.captured,
        by: capturedBy,
      });
    }
  }
  // Sort by piece value order so display is consistent
  for (const side of ['white', 'black']) {
    captured[side].sort(
      (a, b) => PIECE_ORDER.indexOf(a.type) - PIECE_ORDER.indexOf(b.type)
    );
  }
  return captured;
}

/** Builds a full state snapshot from the chess instance. */
function buildSnapshot(chess, resigned = null) {
  const history = chess.history({ verbose: true });
  const lastMove = history.length > 0 ? history[history.length - 1] : null;

  let status = 'active';
  let result = null;

  if (resigned) {
    status = 'resigned';
    result = `${resigned === 'white' ? 'Black' : 'White'} wins — ${resigned} resigned`;
  } else if (chess.isGameOver()) {
    status = 'finished';
    result = getGameResult(chess);
  }

  return {
    fen: chess.fen(),
    turn: turnToColor(chess.turn()),
    history,
    lastMove,
    capturedPieces: deriveCaptured(history),
    isOver: status !== 'active',
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    status,
    result,
  };
}

// ── Hook ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ChessGameState
 * @property {string}  fen
 * @property {'white'|'black'} turn
 * @property {import('chess.js').Move[]} history
 * @property {import('chess.js').Move|null} lastMove
 * @property {{ white: Array, black: Array }} capturedPieces
 * @property {boolean} isOver
 * @property {boolean} isCheck
 * @property {boolean} isCheckmate
 * @property {boolean} isStalemate
 * @property {boolean} isDraw
 * @property {'active'|'finished'|'resigned'} status
 * @property {string|null} result
 */

/**
 * Complete offline chess engine hook.
 *
 * @returns {{
 *   gameState: ChessGameState,
 *   selectedSquare: string|null,
 *   legalTargets: string[],
 *   pendingPromotion: { from:string, to:string }|null,
 *   onSquareClick: (square: string) => void,
 *   onPieceDrop: (from: string, to: string) => boolean,
 *   onPromotionChoice: (piece: string) => void,
 *   onPromotionCancel: () => void,
 *   resign: (color: 'white'|'black') => void,
 *   resetGame: () => void,
 * }}
 */
export function useChessGame() {
  // Keep a stable chess instance in a ref so we mutate it without re-creating
  const chessRef = useRef(null);
  if (!chessRef.current) {
    const saved = storageGet(SAVE_KEY, null);
    try {
      chessRef.current = saved?.fen ? new Chess(saved.fen) : new Chess();
    } catch {
      chessRef.current = new Chess();
    }
  }
  const chess = chessRef.current;

  // Derive initial snapshot
  const [gameState, setGameState] = useState(() => {
    const saved = storageGet(SAVE_KEY, null);
    const snap = buildSnapshot(chess);
    if (saved?.status && saved.status !== 'active') {
      return {
        ...snap,
        status: saved.status,
        result: saved.result || snap.result,
        isOver: true,
      };
    }
    return snap;
  });

  // UI state: which square is selected, what targets are highlighted
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);

  // Promotion: if set, we're waiting for the user to pick a piece
  const [pendingPromotion, setPendingPromotion] = useState(null);
  // Track resigned state separately so buildSnapshot can read it
  const resignedRef = useRef(null);

  // ── Internal: commit a move and sync state ───────────────────────
  const commitMove = useCallback(
    (from, to, promotion) => {
      let move;
      try {
        const moveObj = { from, to };
        if (promotion) moveObj.promotion = promotion;
        move = chess.move(moveObj);
      } catch (err) {
        console.error('commitMove error:', err, { from, to, promotion });
        return false;
      }
      if (!move) {
        console.warn('commitMove failed, move is falsy', { from, to, promotion });
        return false;
      }

      const snap = buildSnapshot(chess, resignedRef.current);
      setGameState(snap);
      storageSet(SAVE_KEY, {
        fen: snap.fen,
        status: snap.status,
        result: snap.result,
        movesCount: snap.history.length,
        isOver: snap.isOver,
      });

      soundManager.playMoveEffect({
        captured: !!move.captured,
        san: move.san,
        inCheck: snap.isCheck,
        isOver: snap.isOver,
      });

      setSelectedSquare(null);
      setLegalTargets([]);
      return true;
    },
    [chess]
  );

  // ── Detect pawn promotion attempt ────────────────────────────────
  const isPromotionMove = useCallback(
    (from, to) => {
      const piece = chess.get(from);
      if (!piece || piece.type !== 'p') return false;
      return (
        (piece.color === 'w' && to[1] === '8') ||
        (piece.color === 'b' && to[1] === '1')
      );
    },
    [chess]
  );

  // ── Square click handler (click-to-move) ────────────────────────
  const onSquareClick = useCallback(
    (square) => {
      if (gameState.isOver) return false;

      const piece = chess.get(square);

      // If a square is already selected
      if (selectedSquare) {
        // Clicking the same square → deselect
        if (square === selectedSquare) {
          setSelectedSquare(null);
          setLegalTargets([]);
          return false;
        }

        // Clicking another own piece of the same color → switch selection
        if (piece && piece.color === chess.turn()) {
          const targets = getLegalMovesForSquare(chess, square).map((m) => m.to);
          setSelectedSquare(square);
          setLegalTargets(targets);
          return false;
        }

        // Attempting to move to this square
        if (legalTargets.includes(square)) {
          if (isPromotionMove(selectedSquare, square)) {
            setPendingPromotion({ from: selectedSquare, to: square });
            setSelectedSquare(null);
            setLegalTargets([]);
            return false; // increment applied later in handlePromotionChoice
          }
          return commitMove(selectedSquare, square); // returns true on legal move
        }

        // Clicked an empty or opponent square that's not a legal target → deselect
        setSelectedSquare(null);
        setLegalTargets([]);
        return false;
      }

      // Nothing selected yet — select an own piece
      if (piece && piece.color === chess.turn()) {
        const targets = getLegalMovesForSquare(chess, square).map((m) => m.to);
        setSelectedSquare(square);
        setLegalTargets(targets);
      }
      return false;
    },
    [chess, gameState.isOver, selectedSquare, legalTargets, isPromotionMove, commitMove]
  );

  // ── Drag-and-drop handler (react-chessboard onPieceDrop) ─────────
  const onPieceDrop = useCallback(
    (from, to) => {
      if (gameState.isOver) return false;

      // Clear any click-based selection
      setSelectedSquare(null);
      setLegalTargets([]);

      if (isPromotionMove(from, to)) {
        // Verify it's actually a legal move before opening the dialog
        const legal = getLegalMovesForSquare(chess, from).some((m) => m.to === to);
        if (!legal) return false;
        setPendingPromotion({ from, to });
        return false; // Return false so the board snaps back until promotion is chosen
      }

      return commitMove(from, to, undefined);
    },
    [chess, gameState.isOver, isPromotionMove, commitMove]
  );

  // ── Promotion resolution ─────────────────────────────────────────
  const onPromotionChoice = useCallback(
    (piece) => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      commitMove(from, to, piece);
    },
    [pendingPromotion, commitMove]
  );

  const onPromotionCancel = useCallback(() => {
    setPendingPromotion(null);
  }, []);

  // ── Resign ────────────────────────────────────────────────────────
  const resign = useCallback(
    (color) => {
      if (gameState.isOver) return;
      resignedRef.current = color;
      const snap = buildSnapshot(chess, color);
      setGameState(snap);
      storageSet(SAVE_KEY, {
        fen: snap.fen,
        status: snap.status,
        result: snap.result,
        movesCount: snap.history.length,
        isOver: true,
      });
      setSelectedSquare(null);
      setLegalTargets([]);
    },
    [chess, gameState.isOver]
  );

  // ── Flag fall / timeout loss (FIDE Rule 6.9 compliant) ───────────
  const timeoutLoss = useCallback(
    (color) => {
      if (gameState.isOver) return;
      const opponentColor = color === 'white' ? 'black' : 'white';
      const opponentName = opponentColor === 'white' ? 'White' : 'Black';
      const timedOutName = color === 'white' ? 'White' : 'Black';

      // FIDE Rule 6.9: If opponent lacks mating material, it is a Draw
      const opponentCanMate = hasMatingMaterial(chess, opponentColor);
      const isDraw = !opponentCanMate;
      const result = opponentCanMate
        ? `${opponentName} wins on time (${timedOutName} ran out of time)`
        : `Draw (${timedOutName} ran out of time vs insufficient material)`;

      const snap = {
        ...buildSnapshot(chess, null),
        isOver: true,
        status: 'finished',
        isDraw,
        result,
      };
      setGameState(snap);
      storageSet(SAVE_KEY, {
        fen: snap.fen,
        status: snap.status,
        result: snap.result,
        movesCount: snap.history.length,
        isOver: true,
      });
      setSelectedSquare(null);
      setLegalTargets([]);
    },
    [chess, gameState.isOver]
  );

  // ── Declare draw by agreement ─────────────────────────────────────
  const declareDraw = useCallback(() => {
    if (gameState.isOver) return;
    const base = buildSnapshot(chess, null);
    const snap = {
      ...base,
      isOver: true,
      status: 'finished',
      isDraw: true,
      result: 'Draw by agreement',
    };
    setGameState(snap);
    storageSet(SAVE_KEY, {
      fen: snap.fen,
      status: snap.status,
      result: snap.result,
      movesCount: snap.history.length,
      isOver: true,
    });
    setSelectedSquare(null);
    setLegalTargets([]);
  }, [chess, gameState.isOver]);

  // ── Reset ─────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    chess.reset();
    resignedRef.current = null;
    const snap = buildSnapshot(chess, null);
    setGameState(snap);
    storageRemove(SAVE_KEY);
    setSelectedSquare(null);
    setLegalTargets([]);
    setPendingPromotion(null);
  }, [chess]);

  return {
    gameState,
    selectedSquare,
    legalTargets,
    pendingPromotion,
    onSquareClick,
    onPieceDrop,
    onPromotionChoice,
    onPromotionCancel,
    resign,
    timeoutLoss,
    declareDraw,
    resetGame,
  };
}
