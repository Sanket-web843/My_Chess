/**
 * ChessClock.jsx — Countdown / unlimited clock panel for one player.
 *
 * Props:
 *   color     'white' | 'black'
 *   timeMs    number  — remaining milliseconds (Infinity = unlimited)
 *   isActive  boolean — ticking right now
 *   isOver    boolean — game finished (stop ticking)
 *   isLow     boolean — optionally signal < 30 s left
 */

// ── Formatter ──────────────────────────────────────────────────────────
function formatMs(ms) {
  if (!isFinite(ms)) return '∞';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ChessClock({ color, timeMs, isActive, isOver }) {
  const isUnlimited = !isFinite(timeMs);
  const isLow = !isUnlimited && timeMs < 30_000 && !isOver;

  return (
    <div
      className={[
        'chess-clock',
        `chess-clock--${color}`,
        isActive && !isOver ? 'chess-clock--active' : '',
        isLow ? 'chess-clock--low' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${color} clock: ${formatMs(timeMs)}`}
      role="timer"
    >
      {/* Pulsing activity dot */}
      {isActive && !isOver && (
        <span className="chess-clock__dot" aria-hidden="true" />
      )}

      {/* Time display */}
      <span className="chess-clock__time">{formatMs(timeMs)}</span>

      {/* Animated fill bar */}
      {isActive && !isOver && (
        <span className="chess-clock__bar" aria-hidden="true" />
      )}
    </div>
  );
}
