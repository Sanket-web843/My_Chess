/**
 * MoveHistory.jsx — Scrollable move history panel.
 *
 * Renders the move list in a #. White  Black table, styled like Chess.com.
 * Auto-scrolls to the last move.
 *
 * Props:
 *   history  Move[] — verbose move objects from chess.js
 */

import { useEffect, useRef } from 'react';

// ── Pair the moves: every two entries make one row ─────────────────
function pairMoves(history) {
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: history[i] ?? null,
      black: history[i + 1] ?? null,
    });
  }
  return pairs;
}

export default function MoveHistory({ history }) {
  const bottomRef = useRef(null);

  // Auto-scroll to the newest move
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [history.length]);

  const pairs = pairMoves(history);

  return (
    <div className="move-history" aria-label="Move history">
      {/* Header */}
      <div className="move-history__header" aria-hidden="true">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>

      {/* Body */}
      <div className="move-history__body" role="list">
        {pairs.length === 0 && (
          <div className="move-history__empty">No moves yet</div>
        )}

        {pairs.map(({ num, white, black }) => (
          <div
            key={num}
            className={`move-history__row${num === pairs.length ? ' move-history__row--last' : ''}`}
            role="listitem"
          >
            <span className="move-history__num">{num}.</span>
            <span
              className={`move-history__san${
                white && num === pairs.length && !black ? ' move-history__san--current' : ''
              }`}
            >
              {white?.san ?? ''}
            </span>
            <span
              className={`move-history__san${
                black && num === pairs.length ? ' move-history__san--current' : ''
              }`}
            >
              {black?.san ?? ''}
            </span>
          </div>
        ))}

        {/* Sentinel for auto-scroll */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
