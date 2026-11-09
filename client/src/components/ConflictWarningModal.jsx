/**
 * ConflictWarningModal.jsx — Restricts double matches and guides mode switching.
 */

export default function ConflictWarningModal({
  isOpen,
  title,
  message,
  resumeText = 'Resume Match',
  abandonText = 'Abandon & Switch Mode',
  secondaryActionText,
  onResume,
  onAbandon,
  onSecondaryAction,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="conflict-modal-card">
        <div className="conflict-modal-header">
          <span className="conflict-modal-icon">⚠️</span>
          <h2 id="conflict-title" className="conflict-modal-title">{title}</h2>
        </div>

        <p className="conflict-modal-message">{message}</p>

        <div className="conflict-modal-actions">
          {onResume && (
            <button
              className="btn btn--primary conflict-btn"
              onClick={onResume}
            >
              {resumeText}
            </button>
          )}

          {secondaryActionText && onSecondaryAction && (
            <button
              className="btn btn--secondary conflict-btn"
              onClick={onSecondaryAction}
              style={{ borderColor: 'var(--clr-accent)', color: 'var(--clr-accent)' }}
            >
              {secondaryActionText}
            </button>
          )}

          {onAbandon && (
            <button
              className="btn btn--danger conflict-btn"
              onClick={onAbandon}
            >
              {abandonText}
            </button>
          )}

          {onCancel && (
            <button
              className="btn btn--secondary conflict-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

