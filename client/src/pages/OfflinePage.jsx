/**
 * OfflinePage.jsx — Complete offline 1v1 chess game with polished setup cards & responsive play.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useChessGame }   from '../hooks/useChessGame.js';
import { useLocalClock }  from '../hooks/useLocalClock.js';
import { storageGet, storageSet, storageRemove } from '../utils/storage.js';
import {
  hasActiveOnlineMatch,
  abandonOnlineMatch,
} from '../utils/conflictCheck.js';
import { TIME_PRESETS } from '../data/constants.js';
import { soundManager } from '../services/sound.js';

import ChessBoard         from '../components/ChessBoard.jsx';
import PlayerCard         from '../components/PlayerCard.jsx';
import ChessClock         from '../components/ChessClock.jsx';
import MoveHistory        from '../components/MoveHistory.jsx';
import CapturedPieces, { calcMaterialAdvantages } from '../components/CapturedPieces.jsx';
import GameControls       from '../components/GameControls.jsx';
import GameResult         from '../components/GameResult.jsx';
import PromotionModal     from '../components/PromotionModal.jsx';
import ConflictWarningModal from '../components/ConflictWarningModal.jsx';

import '../components/components.css';
import './OfflinePage.css';

const DRAW_OFFER_SECONDS = 5;

export default function OfflinePage() {
  const navigate = useNavigate();

  const [timeMode, setTimeModeState] = useState(() => storageGet('timeMode', null));
  const [selectedPreset, setSelectedPreset] = useState(() => storageGet('timeMode', 'classical') || 'classical');

  // Conflict state & exit protection
  const [onlineConflict, setOnlineConflict] = useState(() => hasActiveOnlineMatch());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const setTimeMode = (mode) => {
    setTimeModeState(mode);
    if (mode) storageSet('timeMode', mode);
    else storageRemove('timeMode');
  };

  const [orientation, setOrientation] = useState('white');
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());

  const toggleSound = () => {
    const next = soundManager.toggleSound();
    setSoundEnabled(next);
  };

  const {
    gameState,
    selectedSquare,
    legalTargets,
    pendingPromotion,
    onSquareClick,
    onPieceDrop,
    onPromotionChoice,
    onPromotionCancel,
    resign,
    timeoutLoss,
    declareDraw,
    resetGame,
  } = useChessGame();

  const [drawOffer, setDrawOffer]       = useState(null);
  const [drawCountdown, setDrawCountdown] = useState(0);
  const drawTimerRef = useRef(null);

  useEffect(() => {
    if (!drawOffer) return;

    if (drawCountdown <= 0) {
      setDrawOffer(null);
      return;
    }

    drawTimerRef.current = setTimeout(
      () => setDrawCountdown((c) => c - 1),
      1000
    );
    return () => clearTimeout(drawTimerRef.current);
  }, [drawOffer, drawCountdown]);

  const offerDraw = useCallback((byColor) => {
    if (drawOffer || gameState.isOver) return;
    clearTimeout(drawTimerRef.current);
    setDrawOffer({ by: byColor });
    setDrawCountdown(DRAW_OFFER_SECONDS);
  }, [drawOffer, gameState.isOver]);

  const acceptDraw = useCallback(() => {
    clearTimeout(drawTimerRef.current);
    setDrawOffer(null);
    declareDraw();
  }, [declareDraw]);

  const rejectDraw = useCallback(() => {
    clearTimeout(drawTimerRef.current);
    setDrawOffer(null);
  }, []);

  useEffect(() => {
    if (drawOffer && drawOffer.by !== gameState.turn) {
      clearTimeout(drawTimerRef.current);
      setDrawOffer(null);
    }
  }, [gameState.turn, drawOffer]);

  // Auto-pause if user leaves the tab (e.g., answering a phone call or switching apps)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!gameState.isOver && gameState.history.length > 0) {
          setIsPaused(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameState.isOver, gameState.history.length]);

  const clockRunning =
    timeMode !== null &&
    !gameState.isOver &&
    !isPaused &&
    gameState.history.length > 0;

  const handleTimeout = useCallback(() => {
    timeoutLoss(gameState.turn);
  }, [timeoutLoss, gameState.turn]);

  const { clocks, applyIncrement, resetClocks } = useLocalClock(
    timeMode || 'classical',
    gameState.turn,
    clockRunning,
    handleTimeout
  );

  const handleDrop = (from, to) => {
    if (isPaused) return false;
    const moverColor = gameState.turn;
    const legal = onPieceDrop(from, to);
    if (legal) applyIncrement(moverColor);
    return legal;
  };

  const handleSquareClick = (sq) => {
    if (isPaused) return;
    const moverColor = gameState.turn;
    const moved = onSquareClick(sq);
    if (moved) applyIncrement(moverColor);
  };

  const handlePromotionChoice = (piece) => {
    if (isPaused) return;
    const moverColor = gameState.turn;
    onPromotionChoice(piece);
    applyIncrement(moverColor);
  };

  const handleReset = () => {
    clearTimeout(drawTimerRef.current);
    setDrawOffer(null);
    setIsPaused(false);
    resetGame();
    resetClocks();
    setTimeMode(null);
  };

  const flipBoard = () =>
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));

  const advantages = calcMaterialAdvantages(gameState.capturedPieces);

  const statusText = gameState.isOver
    ? 'Game Over'
    : isPaused
    ? '⏸ Match Paused'
    : gameState.isCheck
    ? `${gameState.turn.toUpperCase()} in check!`
    : `${gameState.turn.charAt(0).toUpperCase() + gameState.turn.slice(1)} to move`;

  const topColor    = orientation === 'white' ? 'black' : 'white';
  const bottomColor = orientation === 'white' ? 'white' : 'black';
  const topLabel    = topColor.charAt(0).toUpperCase()    + topColor.slice(1);
  const bottomLabel = bottomColor.charAt(0).toUpperCase() + bottomColor.slice(1);

  const handleSafeHome = () => {
    if (gameState.history.length > 0 && !gameState.isOver) {
      setShowExitConfirm(true);
      return;
    }
    navigate('/');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SETUP SCREEN (Clean, modern preset selector)
  // ══════════════════════════════════════════════════════════════════════════
  if (timeMode === null) {
    return (
      <main className="setup-screen-wrapper">
        <div className="setup-card">
          <header className="setup-card__header">
            <div className="setup-icon-bubble">♟</div>
            <h1 className="setup-title">Pass &amp; Play</h1>
            <p className="setup-subtitle">Two players, one local device</p>
          </header>

          <div className="setup-card__body">
            {onlineConflict?.active && (
              <div className="conflict-banner-box">
                <div className="conflict-banner-header">
                  <span>⚠️</span>
                  <strong>Active Online Match in Progress (Room {onlineConflict.roomId})</strong>
                </div>
                <p className="conflict-banner-text">
                  You are currently connected to an online match. To protect game integrity, simultaneous matches are disabled.
                </p>
                <div className="conflict-banner-actions">
                  <button
                    className="btn btn--primary"
                    style={{ width: '100%', minHeight: '38px', fontSize: '0.88rem' }}
                    onClick={() => navigate('/online')}
                  >
                    Resume Online Game
                  </button>
                  <button
                    className="btn btn--danger"
                    style={{ width: '100%', minHeight: '38px', fontSize: '0.88rem' }}
                    onClick={() => {
                      abandonOnlineMatch();
                      setOnlineConflict({ active: false });
                    }}
                  >
                    Forfeit Online Match
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="setup-section-label">Choose Time Control</p>
              <div className="time-options-grid">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`time-card-btn${selectedPreset === preset.id ? ' time-card-btn--active' : ''}`}
                    onClick={() => setSelectedPreset(preset.id)}
                    disabled={onlineConflict?.active}
                  >
                    <span className="time-card-icon">{preset.icon}</span>
                    <strong className="time-card-title">{preset.name}</strong>
                    <span className="time-card-desc">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn--primary"
              style={{ width: '100%', minHeight: '48px', fontSize: '1.05rem' }}
              disabled={onlineConflict?.active}
              onClick={() => {
                resetGame();
                resetClocks();
                setTimeMode(selectedPreset);
              }}
            >
              Start Game
            </button>

            <button
              className="btn btn--secondary"
              style={{ width: '100%', minHeight: '44px' }}
              onClick={() => navigate('/')}
            >
              ← Back to Main Menu
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  const drawResponder = drawOffer
    ? (drawOffer.by === 'white' ? 'Black' : 'White')
    : null;

  return (
    <div className="game-screen-wrapper">
      <ConflictWarningModal
        isOpen={showExitConfirm}
        title="Match in Progress"
        message={`Your offline match has ${gameState.history.length} moves played. Do you want to return to the Main Menu? Your game is saved and can be resumed anytime.`}
        resumeText="Stay in Game"
        abandonText="Return to Menu"
        onResume={() => setShowExitConfirm(false)}
        onAbandon={() => {
          setShowExitConfirm(false);
          navigate('/');
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Game Over Overlay Banner */}
      <GameResult
        result={gameState.result}
        isOver={gameState.isOver}
        onReplay={handleReset}
        onHome={handleSafeHome}
      />

      {/* Draw Offer Notification Bar */}
      {drawOffer && !gameState.isOver && (
        <div className="draw-offer-bar" role="alert" aria-live="assertive">
          <div className="draw-offer-bar__inner">
            <span className="draw-offer-bar__msg">
              <strong>{drawOffer.by.charAt(0).toUpperCase() + drawOffer.by.slice(1)}</strong>{' '}
              offered a draw · {drawResponder} decides ({drawCountdown}s)
            </span>
            <button className="draw-offer-bar__btn draw-offer-bar__btn--accept" onClick={acceptDraw}>
              ✓ Accept
            </button>
            <button className="draw-offer-bar__btn draw-offer-bar__btn--reject" onClick={rejectDraw}>
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {/* Desktop Top Header */}
      <header className="game-desktop-topbar">
        <button className="topbar-btn" onClick={handleSafeHome}>
          ← Home
        </button>
        <span className={`topbar-status${gameState.isCheck ? ' topbar-status--check' : ''}`}>
          {statusText}
        </span>
        <div className="topbar-actions">
          <button
            className="topbar-btn"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          >
            {soundEnabled ? '🔊 Sound' : '🔇 Muted'}
          </button>
          <button className="topbar-btn" onClick={flipBoard}>
            ⇅ Flip
          </button>
          <button className="topbar-btn topbar-btn--danger" onClick={handleReset}>
            New Game
          </button>
        </div>
      </header>

      {/* Main Play Layout */}
      <main className="game-app-container">
        <section className="board-play-area">
          {/* Top Player Strip */}
          <div className="player-panel-strip player-panel-strip--top">
            <div className="player-panel-info">
              <PlayerCard
                color={topColor}
                label={topLabel}
                isActive={gameState.turn === topColor}
                isOver={gameState.isOver}
              />
              <CapturedPieces pieces={gameState.capturedPieces[bottomColor]} advantage={advantages[topColor]} />
            </div>
            <ChessClock
              color={topColor}
              timeMs={clocks[topColor]}
              isActive={gameState.turn === topColor}
              isOver={gameState.isOver}
            />
          </div>

          {/* Center Chessboard */}
          <div className="board-square-box">
            {isPaused && !gameState.isOver && (
              <div className="board-pause-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
                <span className="pause-overlay-badge">⏸</span>
                <h2 className="pause-overlay-title">Match Paused</h2>
                <p className="pause-overlay-sub">
                  Clocks are frozen. Take your call or pause as long as needed.
                </p>
                <button
                  className="btn btn--primary pause-overlay-btn"
                  onClick={() => setIsPaused(false)}
                >
                  ▶ Resume Match
                </button>
              </div>
            )}

            <ChessBoard
              gameState={gameState}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              onSquareClick={handleSquareClick}
              onPieceDrop={handleDrop}
              orientation={orientation}
            />
            <PromotionModal
              pendingPromotion={pendingPromotion}
              onChoice={handlePromotionChoice}
              onCancel={onPromotionCancel}
              color={gameState.turn}
            />
          </div>

          {/* Bottom Player Strip */}
          <div className="player-panel-strip player-panel-strip--bottom">
            <div className="player-panel-info">
              <PlayerCard
                color={bottomColor}
                label={bottomLabel}
                isActive={gameState.turn === bottomColor}
                isOver={gameState.isOver}
              />
              <CapturedPieces pieces={gameState.capturedPieces[topColor]} advantage={advantages[bottomColor]} />
            </div>
            <ChessClock
              color={bottomColor}
              timeMs={clocks[bottomColor]}
              isActive={gameState.turn === bottomColor}
              isOver={gameState.isOver}
            />
          </div>
        </section>

        {/* Sidebar (Desktop) & Bottom App Bar (Mobile) */}
        <aside className="game-sidebar-area">
          <div className="sidebar-history-box">
            <h3 className="sidebar-section-title">Moves</h3>
            <MoveHistory history={gameState.history} />
          </div>

          <div className="sidebar-controls-box">
            <GameControls
              isOver={gameState.isOver}
              activeTurn={gameState.turn}
              isPaused={isPaused}
              drawOfferPending={!!drawOffer}
              onFlip={flipBoard}
              onTogglePause={() => setIsPaused((p) => !p)}
              onOfferDrawWhite={() => offerDraw('white')}
              onOfferDrawBlack={() => offerDraw('black')}
              onResignWhite={() => resign('white')}
              onResignBlack={() => resign('black')}
              onNewGame={handleReset}
              onHome={handleSafeHome}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
