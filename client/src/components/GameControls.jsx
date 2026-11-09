/**
 * GameControls.jsx — Professional in-game controls.
 *
 * Supports:
 * - Desktop sidebar full control mode
 * - Mobile bottom bar compact native app mode (icon buttons with clean labels/tooltips)
 * - Pause / Resume controls for both Online and Offline modes
 */

export default function GameControls({
  isOver,
  activeTurn = 'white',
  drawOfferPending,
  isPaused = false,
  pauseOfferPending = false,
  resumeOfferPending = false,
  onFlip,
  onTogglePause,
  onOfferPause,
  onResume,
  onOfferDrawWhite,
  onOfferDrawBlack,
  onResignWhite,
  onResignBlack,
  onNewGame,
  onHome,
  isOnline = false,
  onOfferDraw,
  onResign,
  onResignAndPlayAgain,
  onOpenChat,
  unreadChatCount = 0,
}) {
  const handleResignWhite = () => {
    if (window.confirm('White resigns? This cannot be undone.')) onResignWhite();
  };

  const handleResignBlack = () => {
    if (window.confirm('Black resigns? This cannot be undone.')) onResignBlack();
  };

  const handleResignGeneral = () => {
    if (onResignAndPlayAgain) {
      if (window.confirm('Resign this game and immediately play again with swapped colors?')) {
        onResignAndPlayAgain();
      }
    } else if (window.confirm('Resign this game? This cannot be undone.')) {
      if (onResign) onResign();
    }
  };

  const handleNewGame = () => {
    if (isOver || window.confirm('Start a new game? Current progress will be lost.')) {
      onNewGame();
    }
  };

  return (
    <div className="game-controls" role="group" aria-label="Game controls">
      {/* ── Desktop view buttons ── */}
      <div className="desktop-controls-group">
        {!isOver && (
          <>
            <button
              id="ctrl-flip"
              className="game-controls__btn game-controls__btn--flip"
              onClick={onFlip}
              title="Flip board orientation"
            >
              <span>⇅</span> Flip Board
            </button>

            {/* Pause / Resume button */}
            {isOnline ? (
              isPaused ? (
                <button
                  className="game-controls__btn game-controls__btn--resume"
                  onClick={() => onResume && onResume()}
                  disabled={resumeOfferPending}
                  title="Resume match"
                >
                  <span>▶</span> {resumeOfferPending ? 'Waiting…' : 'Resume Match'}
                </button>
              ) : (
                <button
                  className="game-controls__btn game-controls__btn--pause"
                  onClick={() => onOfferPause && onOfferPause()}
                  disabled={pauseOfferPending}
                  title="Request opponent to pause match"
                >
                  <span>⏸</span> {pauseOfferPending ? 'Pause Requested…' : 'Pause Match'}
                </button>
              )
            ) : (
              <button
                id="ctrl-pause"
                className={`game-controls__btn ${isPaused ? 'game-controls__btn--resume' : 'game-controls__btn--pause'}`}
                onClick={() => onTogglePause && onTogglePause()}
                title={isPaused ? 'Resume game' : 'Pause game (stops clocks)'}
              >
                <span>{isPaused ? '▶' : '⏸'}</span> {isPaused ? 'Resume Game' : 'Pause Game'}
              </button>
            )}

            {isOnline ? (
              <div className="game-controls__resign-group">
                <button
                  className="game-controls__btn game-controls__btn--draw"
                  onClick={onOfferDraw}
                  disabled={drawOfferPending || isPaused}
                >
                  <span>½</span> {drawOfferPending ? 'Draw Offered' : 'Offer Draw'}
                </button>
                <button
                  className="game-controls__btn game-controls__btn--resign"
                  onClick={handleResignGeneral}
                  title="Resign current match and start a new match in the same room"
                >
                  <span>🔄</span> Resign & Play Again
                </button>
              </div>
            ) : (
              <>
                <div className="game-controls__resign-group">
                  <button
                    id="ctrl-draw-white"
                    className="game-controls__btn game-controls__btn--draw"
                    onClick={onOfferDrawWhite}
                    disabled={drawOfferPending || isPaused}
                    title="White offers draw"
                  >
                    <span>½</span> White Draw
                  </button>
                  <button
                    id="ctrl-draw-black"
                    className="game-controls__btn game-controls__btn--draw"
                    onClick={onOfferDrawBlack}
                    disabled={drawOfferPending || isPaused}
                    title="Black offers draw"
                  >
                    <span>½</span> Black Draw
                  </button>
                </div>

                <div className="game-controls__resign-group">
                  <button
                    id="ctrl-resign-white"
                    className="game-controls__btn game-controls__btn--resign"
                    onClick={handleResignWhite}
                    title="White resigns"
                  >
                    <span>♔</span> White Resign
                  </button>
                  <button
                    id="ctrl-resign-black"
                    className="game-controls__btn game-controls__btn--resign"
                    onClick={handleResignBlack}
                    title="Black resigns"
                  >
                    <span>♚</span> Black Resign
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <button
          id="ctrl-new-game"
          className="game-controls__btn game-controls__btn--new"
          onClick={handleNewGame}
          title="New game"
        >
          <span>↺</span> New Game
        </button>

        <button
          id="ctrl-home"
          className="game-controls__btn game-controls__btn--home"
          onClick={onHome}
          title="Back to Home"
        >
          <span>⌂</span> Home
        </button>
      </div>

      {/* ── Native Mobile Bottom Bar (Fixed 5 touch actions) ── */}
      <nav className="mobile-bottom-bar" aria-label="Quick mobile game navigation">
        <button className="mobile-nav-btn" onClick={onHome} title="Home">
          <span className="mobile-nav-icon">⌂</span>
          <span className="mobile-nav-label">Home</span>
        </button>

        <button className="mobile-nav-btn" onClick={onFlip} title="Flip Board">
          <span className="mobile-nav-icon">⇅</span>
          <span className="mobile-nav-label">Flip</span>
        </button>

        {!isOver && (
          <>
            {/* Pause / Resume Mobile Action */}
            <button
              className={`mobile-nav-btn ${isPaused ? 'mobile-nav-btn--active' : ''}`}
              onClick={() => {
                if (isOnline) {
                  if (isPaused) {
                    if (onResume) onResume();
                  } else {
                    if (onOfferPause) onOfferPause();
                  }
                } else {
                  if (onTogglePause) onTogglePause();
                }
              }}
              disabled={isOnline && (isPaused ? resumeOfferPending : pauseOfferPending)}
              title={isPaused ? 'Resume Game' : 'Pause Game'}
            >
              <span className="mobile-nav-icon">{isPaused ? '▶' : '⏸'}</span>
              <span className="mobile-nav-label">
                {isOnline
                  ? (isPaused
                      ? (resumeOfferPending ? 'Wait…' : 'Resume')
                      : (pauseOfferPending ? 'Wait…' : 'Pause'))
                  : (isPaused ? 'Resume' : 'Pause')}
              </span>
            </button>

            <button
              className="mobile-nav-btn"
              onClick={isOnline ? onOfferDraw : (activeTurn === 'black' ? onOfferDrawBlack : onOfferDrawWhite)}
              disabled={drawOfferPending || isPaused}
              title={drawOfferPending ? 'Draw offered' : 'Draw offer'}
            >
              <span className="mobile-nav-icon">½</span>
              <span className="mobile-nav-label">{drawOfferPending ? 'Offered' : 'Draw'}</span>
            </button>

            {isOnline ? (
              <button
                className="mobile-nav-btn"
                onClick={onOpenChat}
                title="Chat with opponent"
              >
                <span className="mobile-nav-icon" style={{ position: 'relative' }}>
                  💬
                  {unreadChatCount > 0 && (
                    <span className="mobile-chat-badge">{unreadChatCount}</span>
                  )}
                </span>
                <span className="mobile-nav-label">Chat</span>
              </button>
            ) : (
              <button
                className="mobile-nav-btn mobile-nav-btn--danger"
                onClick={activeTurn === 'black' ? handleResignBlack : handleResignWhite}
                title="Resign"
              >
                <span className="mobile-nav-icon">🏳</span>
                <span className="mobile-nav-label">Resign</span>
              </button>
            )}
          </>
        )}

        {isOver && (
          <button className="mobile-nav-btn mobile-nav-btn--primary" onClick={handleNewGame} title="New Game">
            <span className="mobile-nav-icon">↺</span>
            <span className="mobile-nav-label">New</span>
          </button>
        )}
      </nav>
    </div>
  );
}
