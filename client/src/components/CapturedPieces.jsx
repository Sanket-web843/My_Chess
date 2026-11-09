/**
 * CapturedPieces.jsx — Shows pieces captured by one side.
 *
 * Renders piece symbols grouped and sorted by value (Q > R > B > N > P).
 * Shows a material advantage score if one side is ahead.
 *
 * Props:
 *   pieces  { type: string, by: string }[]
 *   color   'white' | 'black'  — which side's captured pieces to show
 *   label   string             — e.g. "Captured by White"
 */

// ── Unicode symbols ───────────────────────────────────────────────
const SYMBOLS = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

// ── Material values ────────────────────────────────────────────────
const VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };

// ── Sort order ─────────────────────────────────────────────────────
const ORDER = ['q', 'r', 'b', 'n', 'p'];

function sortPieces(pieces = []) {
  if (!Array.isArray(pieces)) return [];
  return [...pieces].sort(
    (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)
  );
}

function calcAdvantage(pieces = []) {
  if (!Array.isArray(pieces)) return 0;
  return pieces.reduce((sum, p) => sum + (VALUES[p.type] ?? 0), 0);
}

export default function CapturedPieces({ pieces = [], advantage = 0 }) {
  const sorted = sortPieces(pieces);

  return (
    <div className="captured-pieces" aria-label="Captured pieces">
      {sorted.length === 0 ? (
        <span className="captured-pieces__empty">—</span>
      ) : (
        <div className="captured-pieces__list">
          {sorted.map((p, i) => (
            <span key={i} className="captured-pieces__piece" aria-hidden="true">
              {SYMBOLS[p.type] ?? '?'}
            </span>
          ))}
          {advantage > 0 && (
            <span className="captured-pieces__adv">+{advantage}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Calculates material advantages for both sides.
 * Returns { white: number, black: number } — positive means the side is ahead.
 */
export function calcMaterialAdvantages(capturedPieces) {
  if (!capturedPieces) return { white: 0, black: 0 };
  const whiteAdv = calcAdvantage(capturedPieces.black || []); // white captured black's pieces
  const blackAdv = calcAdvantage(capturedPieces.white || []); // black captured white's pieces
  const diff = whiteAdv - blackAdv;
  return {
    white: diff > 0 ? diff : 0,
    black: diff < 0 ? Math.abs(diff) : 0,
  };
}
