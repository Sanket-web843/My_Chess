/**
 * PlayerCard.jsx — Displays a player's avatar, name, and color indicator.
 *
 * Props:
 *   color       'white' | 'black'
 *   label       Display name (e.g. "White", "Black")
 *   isActive    boolean — whose turn it is
 *   isOver      boolean — game finished
 */
export default function PlayerCard({ color, label, isActive, isOver }) {
  return (
    <div
      className={[
        'player-card',
        `player-card--${color}`,
        isActive && !isOver ? 'player-card--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${label} player${isActive && !isOver ? ' — active' : ''}`}
    >
      {/* Avatar */}
      <div className="player-card__avatar" aria-hidden="true">
        {color === 'white' ? '♔' : '♚'}
      </div>

      {/* Name + status */}
      <div className="player-card__info">
        <span className="player-card__name">{label}</span>
        {isActive && !isOver && (
          <span className="player-card__status" aria-live="polite">
            <span className="player-card__dot" />
            Your turn
          </span>
        )}
      </div>
    </div>
  );
}
