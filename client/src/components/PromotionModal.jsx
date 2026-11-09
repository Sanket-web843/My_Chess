/**
 * PromotionModal.jsx — Pawn promotion piece picker.
 *
 * Rendered as an absolute overlay over the chess board wrapper.
 * Replaces the old inline dialog in ChessBoard.jsx so ChessBoard
 * stays purely visual.
 *
 * Props:
 *   pendingPromotion  { from: string, to: string } | null
 *   onChoice          (piece: 'q'|'r'|'b'|'n') => void
 *   onCancel          () => void
 *   color             'white' | 'black'  — promotes for which side
 */

const PIECES = [
  { value: 'q', symbol: '♛', name: 'Queen' },
  { value: 'r', symbol: '♜', name: 'Rook' },
  { value: 'b', symbol: '♝', name: 'Bishop' },
  { value: 'n', symbol: '♞', name: 'Knight' },
];

export default function PromotionModal({
  pendingPromotion,
  onChoice,
  onCancel,
  color = 'white',
}) {
  if (!pendingPromotion) return null;

  return (
    <div
      className="promotion-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
    >
      <div className="promotion-modal__card">
        <p className="promotion-modal__title">Promote pawn to…</p>

        <div className="promotion-modal__pieces">
          {PIECES.map((p) => (
            <button
              key={p.value}
              id={`promo-${p.value}`}
              className={`promotion-modal__piece promotion-modal__piece--${color}`}
              title={p.name}
              aria-label={p.name}
              onClick={() => onChoice(p.value)}
            >
              {p.symbol}
            </button>
          ))}
        </div>

        <button
          id="promo-cancel"
          className="promotion-modal__cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
