/**
 * RematchModal.jsx — 5-second popup showing winner notification and immediate accept/exit options.
 */
import { useEffect, useState } from 'react';

export default function RematchModal({
  isOpen,
  rematchOffer,
  myColor,
  onAccept,
  onDecline,
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!rematchOffer?.expiresAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rematchOffer.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [rematchOffer?.expiresAt]);

  if (!isOpen || !rematchOffer) return null;

  const isWinner = rematchOffer.winner === myColor || (rematchOffer.winner && rematchOffer.requestedBy !== myColor);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 120 }}>
      <div className="conflict-modal-card rematch-modal-card">
        <div className="conflict-modal-header">
          <span className="conflict-modal-icon" style={{ fontSize: '2.5rem' }}>
            {isWinner ? '🏆' : '🔄'}
          </span>
          <h2
            className="conflict-modal-title"
            style={{ fontSize: '1.35rem', color: isWinner ? 'var(--clr-accent)' : 'inherit' }}
          >
            {isWinner ? 'You Won! Opponent Resigned' : 'Rematch Requested'}
          </h2>
        </div>

        <p className="conflict-modal-message" style={{ fontSize: '0.95rem', margin: '0.5rem 0' }}>
          {isWinner
            ? 'Opponent resigned and requested to play again. Colors will be swapped.'
            : 'You resigned. Waiting for opponent to accept rematch (colors will be swapped)…'}
        </p>

        <div className="rematch-timer-container">
          <div className="rematch-countdown-badge">
            {countdown}s
          </div>
          <span className="rematch-timer-label">
            {isWinner
              ? `Auto-accepting & starting rematch in ${countdown}s`
              : `Starting in ${countdown}s`}
          </span>
        </div>

        <div className="conflict-modal-actions" style={{ marginTop: '0.75rem' }}>
          {isWinner ? (
            <>
              <button
                className="btn btn--primary conflict-btn"
                onClick={onAccept}
                style={{ fontSize: '1rem', fontWeight: 700 }}
              >
                ✓ Accept & Play Now
              </button>
              <button
                className="btn btn--danger conflict-btn"
                onClick={onDecline}
              >
                ✕ Exit to Menu
              </button>
            </>
          ) : (
            <button
              className="btn btn--secondary conflict-btn"
              onClick={onDecline}
            >
              Cancel & Exit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
