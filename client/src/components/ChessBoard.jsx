/**
 * ChessBoard.jsx — Visual chess board component.
 *
 * Wraps react-chessboard and connects it to useChessGame.
 * Handles:
 *  - Board rendering (correct position via FEN)
 *  - Legal move highlighting
 *  - Last-move highlighting
 *  - Check highlight on king square
 *  - Click-to-move and drag-to-move
 *  - Board orientation (white / black at bottom)
 *
 * Does NOT implement chess rules — chess.js via useChessGame does.
 * Does NOT talk to the server.
 * Promotion dialog is now handled by PromotionModal.jsx (sibling overlay).
 */

import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import './ChessBoard.css';

// ── Lichess / Chess.com styling tokens ────────────────────────────
const COLORS = {
  selected:     'rgba(20, 85, 30, 0.5)',       // muted green highlight for selected
  legalDot:     'rgba(0, 0, 0, 0.22)',         // subtle dark central dot for legal moves
  legalCapture: 'rgba(0, 0, 0, 0.25)',         // ring for legal captures
  lastMoveFrom: 'rgba(205, 210, 106, 0.45)',   // classic chess.com soft yellow
  lastMoveTo:   'rgba(205, 210, 106, 0.65)',   // classic chess.com soft yellow
  check:        'radial-gradient(ellipse at center, rgba(235, 77, 75, 1) 0%, rgba(235, 77, 75, 0.6) 45%, transparent 75%)',
};

/**
 * Returns the square the king of the given color is on.
 * chess.js doesn't expose this directly, so we derive it from the FEN board.
 */
function findKingSquare(fen, color) {
  const board = fen.split(' ')[0];
  const target = color === 'white' ? 'K' : 'k';
  let file = 0;
  let rank = 8;
  for (const ch of board) {
    if (ch === '/') { rank--; file = 0; }
    else if (ch >= '1' && ch <= '8') { file += parseInt(ch, 10); }
    else {
      if (ch === target) {
        return String.fromCharCode(97 + file) + rank;
      }
      file++;
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────

/**
 * @param {{
 *   gameState: import('../hooks/useChessGame.js').ChessGameState,
 *   selectedSquare: string|null,
 *   legalTargets: string[],
 *   pendingPromotion: { from:string, to:string }|null,
 *   onSquareClick: (sq: string) => void,
 *   onPieceDrop: (from: string, to: string) => boolean,
 *   onPromotionChoice: (piece: string) => void,
 *   onPromotionCancel: () => void,
 *   orientation?: 'white'|'black',
 *   isDraggablePiece?: (args: { piece: string, sourceSquare: string }) => boolean,
 * }} props
 */
export default function ChessBoard({
  gameState,
  selectedSquare,
  legalTargets,
  onSquareClick,
  onPieceDrop,
  orientation = 'white',
  isDraggablePiece: customIsDraggablePiece,
}) {
  const { fen, turn, lastMove, isCheck, isOver } = gameState;

  const defaultIsDraggable = ({ piece }) => {
    if (isOver) return false;
    const pieceColor = piece[0] === 'w' ? 'white' : 'black';
    return pieceColor === turn;
  };

  const isDraggablePiece = customIsDraggablePiece || defaultIsDraggable;

  // ── Build square style map ──────────────────────────────────────
  const customSquareStyles = useMemo(() => {
    const styles = {};

    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: COLORS.lastMoveFrom };
      styles[lastMove.to]   = { backgroundColor: COLORS.lastMoveTo };
    }

    // Selected piece
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: COLORS.selected,
      };
    }

    // Legal target dots / capture rings
    for (const sq of legalTargets) {
      styles[sq] = {
        ...styles[sq],
        background: styles[sq]?.backgroundColor
          ? `radial-gradient(circle, ${COLORS.legalDot} 30%, ${styles[sq].backgroundColor} 30%)`
          : `radial-gradient(circle, ${COLORS.legalDot} 30%, transparent 30%)`,
      };
    }

    // Check highlight on king
    if (isCheck && !isOver) {
      const kingSq = findKingSquare(fen, turn);
      if (kingSq) {
        styles[kingSq] = {
          ...styles[kingSq],
          backgroundColor: COLORS.check,
          boxShadow: `inset 0 0 12px 4px rgba(239,68,68,0.8)`,
        };
      }
    }

    return styles;
  }, [fen, lastMove, selectedSquare, legalTargets, isCheck, isOver, turn]);

  // ── Board theme (Standard Chess.com Green & Buff) ───────────────
  const customDarkSquareStyle  = { backgroundColor: '#779556' };
  const customLightSquareStyle = { backgroundColor: '#ebecd0' };

  return (
    <div className="chess-board-wrapper">
      <Chessboard
        id="offline-board"
        position={fen}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        onPieceClick={(_, square) => onSquareClick(square)}
        onPromotionCheck={() => false}
        isDraggablePiece={isDraggablePiece}
        arePiecesDraggable={!isOver}
        boardOrientation={orientation}
        customSquareStyles={customSquareStyles}
        customDarkSquareStyle={customDarkSquareStyle}
        customLightSquareStyle={customLightSquareStyle}
        customBoardStyle={{
          borderRadius: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        animationDuration={150}
        areArrowsAllowed={false}
      />
    </div>
  );
}
