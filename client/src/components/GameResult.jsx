/**
 * GameResult.jsx — Full-screen overlay shown when a game ends.
 *
 * Displays:
 *  - Trophy / result icon
 *  - Result headline  (e.g. "White wins by checkmate")
 *  - Reason sub-text
 *  - "Play Again" + "Home" buttons
 *
 * Props:
 *   result    string | null  — text from useChessGame
 *   isOver    boolean
 *   onReplay  () => void
 *   onHome    () => void
 */
export default function GameResult({ result, isOver, onReplay, onHome }) {
  if (!isOver) return null;

  const displayResult = result || 'Game over';
  const isWin = /wins/i.test(displayResult);
  const isDraw = /draw/i.test(displayResult) || /stalemate/i.test(displayResult);

  const icon = isWin ? '🏆' : isDraw ? '🤝' : '♟';
  const headline = isWin
    ? displayResult.split('—')[0]?.split('(')[0]?.trim() || displayResult
    : isDraw
    ? displayResult.split('—')[0]?.trim() || 'Draw!'
    : displayResult;

  let sub = '';
  if (displayResult.includes('—')) {
    sub = displayResult.split('—').slice(1).join('—').trim();
  } else if (displayResult.includes('(')) {
    const match = displayResult.match(/\((.*?)\)/);
    if (match) sub = match[1];
  } else if (isDraw && displayResult !== 'Draw!' && displayResult !== 'Draw') {
    sub = displayResult;
  }

  return (
    <div
      className="game-result-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Game result"
    >
      <div className="game-result-card">
        {/* Icon */}
        <div className="game-result__icon" aria-hidden="true">
          {icon}
        </div>

        {/* Headline */}
        <h2 className="game-result__headline">{headline}</h2>

        {/* Sub-text */}
        {sub && <p className="game-result__sub">{sub}</p>}

        {/* Actions */}
        <div className="game-result__actions">
          <button
            id="result-replay"
            className="game-result__btn game-result__btn--primary"
            onClick={onReplay}
          >
            ↺ Play Again
          </button>
          <button
            id="result-home"
            className="game-result__btn game-result__btn--secondary"
            onClick={onHome}
          >
            ⌂ Home
          </button>
        </div>
      </div>
    </div>
  );
}
