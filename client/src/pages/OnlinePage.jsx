/**
 * OnlinePage.jsx — Synchronized Online 1v1 chess page using Socket.IO
 * Timed Pauses (1m, 2m, max 5m), Authoritative Timeout Forfeit, and Strict Pauser-Only Resume.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { useOnlineClock } from '../hooks/useOnlineClock.js';
import {
  hasActiveOfflineMatch,
  abandonOfflineMatch,
} from '../utils/conflictCheck.js';
import { TIME_PRESETS } from '../data/constants.js';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import ChessClock from '../components/ChessClock.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import GameResult from '../components/GameResult.jsx';
import PromotionModal from '../components/PromotionModal.jsx';
import GameControls from '../components/GameControls.jsx';
import ConflictWarningModal from '../components/ConflictWarningModal.jsx';
import RematchModal from '../components/RematchModal.jsx';
import CapturedPieces, { calcMaterialAdvantages } from '../components/CapturedPieces.jsx';
import OnlineChat from '../components/OnlineChat.jsx';
import { soundManager } from '../services/sound.js';

import '../components/components.css';
import './OfflinePage.css';

export default function OnlinePage() {
  const navigate = useNavigate();
  const {
    gameState,
    connected,
    drawOffer,
    pauseOffer,
    opponentDisconnected,
    errorMsg,
    createRoom,
    joinRoom,
    sendMove,
    resign,
    offerDraw,
    acceptDraw,
    rejectDraw,
    offerPause,
    acceptPause,
    rejectPause,
    resumeGame,
    sendChatMessage,
    messages,
    rematchOffer,
    acceptRematch,
    declineRematch,
    playAgain,
    leaveGame,
  } = useOnlineGame();

  const [inputCode, setInputCode] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('classical');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);
  const [pauseOfferedByMe, setPauseOfferedByMe] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());

  // Chat tabs & mobile drawer
  const [activeTab, setActiveTab] = useState('moves'); // 'moves' | 'chat'
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Timed pause selection modal & countdown state
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [selectedPauseDuration, setSelectedPauseDuration] = useState(2); // 1, 2, or 5 mins
  const [pauseCountdown, setPauseCountdown] = useState(0);

  // Conflict detection & exit protection
  const [offlineConflict, setOfflineConflict] = useState(() => hasActiveOfflineMatch());
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Re-check conflict whenever gameState changes
  useEffect(() => {
    setOfflineConflict(hasActiveOfflineMatch());
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.isPaused) {
      setPauseOfferedByMe(false);
    }
  }, [gameState.isPaused]);

  // Track unread chat count when chat is not open
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender !== gameState.myColor) {
      if (!mobileChatOpen && activeTab !== 'chat') {
        setUnreadCount((c) => c + 1);
      }
    }
  }, [messages, gameState.myColor, activeTab, mobileChatOpen]);

  // Live countdown timer for pause expiration
  useEffect(() => {
    if (!gameState.isPaused || !gameState.pauseExpiresAt) {
      setPauseCountdown(0);
      return;
    }

    const update = () => {
      const rem = Math.max(0, gameState.pauseExpiresAt - Date.now());
      setPauseCountdown(rem);
    };

    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [gameState.isPaused, gameState.pauseExpiresAt]);

  const formatPauseTime = (ms) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const toggleSound = () => {
    const next = soundManager.toggleSound();
    setSoundEnabled(next);
  };

  useEffect(() => {
    if (drawOfferedByMe) {
      setDrawOfferedByMe(false);
    }
  }, [gameState.history.length, gameState.isOver, drawOfferedByMe]);

  const flipBoard = () => setIsFlipped((prev) => !prev);

  const localChess = useMemo(() => {
    try {
      return new Chess(gameState.fen);
    } catch {
      return new Chess();
    }
  }, [gameState.fen]);

  const effectiveOrientation = isFlipped
    ? (gameState.myColor === 'black' ? 'white' : 'black')
    : (gameState.myColor || 'white');
  const isMyTurn = gameState.status === 'active' && gameState.turn === gameState.myColor && !gameState.isPaused;

  // Server-authoritative clocks: zero drift, frozen while paused
  const clocks = useOnlineClock({
    serverClocks: gameState.clocks,
    clockUpdatedAt: gameState.clockUpdatedAt,
    turn: gameState.turn,
    status: gameState.status,
    isOver: gameState.isOver,
    isUnlimited: gameState.isUnlimited,
    isPaused: gameState.isPaused,
  });

  const legalTargets = useMemo(() => {
    if (!selectedSquare || !isMyTurn || gameState.isPaused) return [];
    try {
      return localChess.moves({ square: selectedSquare, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [localChess, selectedSquare, isMyTurn, gameState.isPaused]);

  const capturedPieces = useMemo(() => {
    const captured = { white: [], black: [] };
    for (const move of gameState.history || []) {
      if (move.captured) {
        const capturedBy = move.color === 'w' ? 'white' : 'black';
        captured[capturedBy === 'white' ? 'black' : 'white'].push({
          type: move.captured,
          by: capturedBy,
        });
      }
    }
    return captured;
  }, [gameState.history]);

  const advantages = useMemo(() => calcMaterialAdvantages(capturedPieces), [capturedPieces]);

  const handleSquareClick = (square) => {
    if (!isMyTurn || gameState.isOver || gameState.isPaused) return;
    const piece = localChess.get(square);

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }

      if (piece && piece.color === (gameState.myColor === 'white' ? 'w' : 'b')) {
        setSelectedSquare(square);
        return;
      }

      if (legalTargets.includes(square)) {
        const movingPiece = localChess.get(selectedSquare);
        const isPromo =
          movingPiece?.type === 'p' &&
          ((movingPiece.color === 'w' && square[1] === '8') ||
           (movingPiece.color === 'b' && square[1] === '1'));

        if (isPromo) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          return;
        }

        sendMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }

      setSelectedSquare(null);
      return;
    }

    if (piece && piece.color === (gameState.myColor === 'white' ? 'w' : 'b')) {
      setSelectedSquare(square);
    }
  };

  const handleDrop = (from, to) => {
    if (!isMyTurn || gameState.isOver || gameState.isPaused) return false;

    const movingPiece = localChess.get(from);
    if (!movingPiece || movingPiece.color !== (gameState.myColor === 'white' ? 'w' : 'b')) {
      return false;
    }

    // Verify legal move
    const legalMoves = localChess.moves({ square: from, verbose: true });
    const isLegalTarget = legalMoves.some((m) => m.to === to);
    if (!isLegalTarget) {
      return false;
    }

    const isPromo =
      movingPiece.type === 'p' &&
      ((movingPiece.color === 'w' && to[1] === '8') ||
       (movingPiece.color === 'b' && to[1] === '1'));

    if (isPromo) {
      setPendingPromotion({ from, to });
      return false;
    }

    sendMove(from, to);
    setSelectedSquare(null);
    return true;
  };

  const handlePromotionChoice = (piece) => {
    if (!pendingPromotion || gameState.isPaused) return;
    sendMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  };

  const copyRoomCode = () => {
    if (gameState.roomId) {
      navigator.clipboard.writeText(gameState.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSafeExit = () => {
    if (gameState.status === 'active' && !gameState.isOver) {
      setShowExitConfirm(true);
      return;
    }
    leaveGame();
    navigate('/');
  };

  const handleConfirmExit = () => {
    resign();
    leaveGame();
    setShowExitConfirm(false);
    navigate('/');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. LOBBY SCREEN (Clean, Minimalist Slate/Charcoal UI)
  // ══════════════════════════════════════════════════════════════════════════
  if (gameState.status === 'lobby') {
    return (
      <main className="setup-screen-wrapper">
        <div className="setup-card">
          <header className="setup-card__header">
            <div className="setup-icon-bubble">🌐</div>
            <h1 className="setup-title">Online Game</h1>
            <p className="setup-subtitle">Play live with a friend using a 6-character room code</p>

            <div
              className={`connection-badge ${connected ? 'connection-badge--on' : 'connection-badge--off'}`}
              style={{ marginTop: '0.75rem' }}
            >
              <span className="connection-dot" />
              {connected ? 'Server connected' : 'Connecting to server...'}
            </div>
          </header>

          <div className="setup-card__body">
            {/* Active offline match blocker banner */}
            {offlineConflict?.active && (
              <div className="conflict-banner-box">
                <div className="conflict-banner-header">
                  <span>⚠️</span>
                  <strong>Active Pass & Play Match Detected</strong>
                </div>
                <p className="conflict-banner-text">
                  You have an unfinished Pass & Play match ({offlineConflict.movesCount} moves played).
                  To prevent conflicting matches, please resume or abandon your offline game before starting online play.
                </p>
                <div className="conflict-banner-actions">
                  <button
                    className="btn btn--primary"
                    style={{ width: '100%', minHeight: '38px', fontSize: '0.88rem' }}
                    onClick={() => navigate('/offline')}
                  >
                    Resume Pass & Play
                  </button>
                  <button
                    className="btn btn--danger"
                    style={{ width: '100%', minHeight: '38px', fontSize: '0.88rem' }}
                    onClick={() => {
                      abandonOfflineMatch();
                      setOfflineConflict({ active: false });
                    }}
                  >
                    Abandon Offline Match
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                style={{
                  color: 'var(--clr-danger)',
                  fontSize: '0.82rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(224, 83, 83, 0.1)',
                  border: '1px solid rgba(224, 83, 83, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  textAlign: 'center',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="lobby-action-stack">
              <div>
                <p className="setup-section-label">Select Match Clock</p>
                <div className="time-options-grid" style={{ marginBottom: '0.65rem' }}>
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`time-card-btn${selectedPreset === preset.id ? ' time-card-btn--active' : ''}`}
                      onClick={() => setSelectedPreset(preset.id)}
                      style={{ padding: '0.65rem 0.65rem' }}
                      disabled={offlineConflict?.active}
                    >
                      <span className="time-card-icon" style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{preset.icon}</span>
                      <strong className="time-card-title" style={{ fontSize: '0.9rem' }}>{preset.name}</strong>
                      <span className="time-card-desc">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Flat "Create Game" button */}
              <button
                id="btn-create-game"
                className="btn btn--primary"
                disabled={!connected || offlineConflict?.active}
                onClick={() => createRoom(selectedPreset)}
                style={{ width: '100%', minHeight: '44px' }}
              >
                Create Game
              </button>

              <div className="lobby-divider">
                <span>or enter a code</span>
              </div>

              {/* Simple input field with a "Join Game" button */}
              <div className="lobby-join-row">
                <input
                  id="input-room-code"
                  type="text"
                  placeholder="Enter 6-char code"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="lobby-input"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={offlineConflict?.active}
                />
                <button
                  id="btn-join-game"
                  className="btn btn--secondary"
                  disabled={!connected || inputCode.trim().length !== 6 || offlineConflict?.active}
                  onClick={() => joinRoom(inputCode.trim())}
                  style={{ minHeight: 'unset', padding: '0 1.25rem', height: '44px' }}
                >
                  Join Game
                </button>
              </div>
            </div>

            <button
              id="btn-back-home"
              className="btn btn--secondary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => navigate('/')}
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. WAITING ROOM SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (gameState.status === 'waiting') {
    return (
      <main className="setup-screen-wrapper">
        <div className="setup-card">
          <header className="setup-card__header">
            <div className="setup-icon-bubble">⏳</div>
            <h1 className="setup-title">Room Created</h1>
            <p className="setup-subtitle">Share this room code with your opponent to begin</p>
          </header>

          <div className="setup-card__body">
            <div className="room-code-display-box">
              <span className="room-code-badge">{gameState.roomId}</span>
              <span className="room-code-hint">Waiting for opponent to connect...</span>
            </div>

            <button
              id="btn-copy-code"
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={copyRoomCode}
            >
              {copied ? '✓ Copied to Clipboard!' : '📋 Copy Room Code'}
            </button>

            <button
              id="btn-cancel-room"
              className="btn btn--danger"
              style={{ width: '100%' }}
              onClick={leaveGame}
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ACTIVE / FINISHED GAME SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  const topColor = effectiveOrientation === 'white' ? 'black' : 'white';
  const bottomColor = effectiveOrientation === 'white' ? 'white' : 'black';
  const topLabel = `Opponent (${topColor})`;
  const bottomLabel = `You (${bottomColor})`;

  const lastMoveObj = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : null;

  const displayState = {
    fen: gameState.fen,
    turn: gameState.turn,
    lastMove: lastMoveObj,
    isCheck: gameState.isCheck,
    isOver: gameState.isOver,
  };

  const onlineIsDraggable = ({ piece }) => {
    if (gameState.isOver || gameState.status !== 'active' || gameState.isPaused) return false;
    const myTurnChar = gameState.myColor === 'white' ? 'w' : 'b';
    return isMyTurn && piece[0] === myTurnChar;
  };

  const iPaused = gameState.pausedBy === gameState.myColor;

  const statusText = gameState.isOver
    ? gameState.result || 'Game Over'
    : gameState.isPaused
    ? `⏸ Paused (${formatPauseTime(pauseCountdown)} left)`
    : gameState.isCheck
    ? `${gameState.turn.toUpperCase()} in check!`
    : isMyTurn
    ? 'Your turn'
    : `Opponent's turn (${gameState.turn})`;

  return (
    <div className="game-screen-wrapper">
      {/* Pause Duration Selector Modal */}
      {showPauseModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-modal-title">
          <div className="conflict-modal-card">
            <div className="conflict-modal-header">
              <span className="conflict-modal-icon">⏸</span>
              <h2 id="pause-modal-title" className="conflict-modal-title">Request Match Pause</h2>
            </div>
            <p className="conflict-modal-message">
              Choose pause time limit (max 5 min). Only you can resume the match. If not resumed before the time limit expires, the opponent will be automatically declared the winner.
            </p>
            <div className="pause-duration-selector">
              {[1, 2, 5].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`pause-duration-btn${selectedPauseDuration === mins ? ' pause-duration-btn--active' : ''}`}
                  onClick={() => setSelectedPauseDuration(mins)}
                >
                  {mins} {mins === 1 ? 'Min' : 'Mins'}
                </button>
              ))}
            </div>
            <div className="conflict-modal-actions">
              <button
                className="btn btn--primary conflict-btn"
                onClick={() => {
                  offerPause(selectedPauseDuration);
                  setPauseOfferedByMe(true);
                  setShowPauseModal(false);
                }}
              >
                Send Request ({selectedPauseDuration} min)
              </button>
              <button
                className="btn btn--secondary conflict-btn"
                onClick={() => setShowPauseModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      <ConflictWarningModal
        isOpen={showExitConfirm}
        title="Active Online Match"
        message="You are currently in an active online match. Leaving or restarting will forfeit the game for you. What would you like to do?"
        resumeText="Stay in Match"
        abandonText="🏳 Resign & Exit"
        secondaryActionText="🔄 Resign & Play Again"
        onResume={() => setShowExitConfirm(false)}
        onAbandon={handleConfirmExit}
        onSecondaryAction={() => {
          playAgain();
          setShowExitConfirm(false);
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Rematch Modal (5-Second Winner Notification & Immediate Actions) */}
      <RematchModal
        isOpen={!!rematchOffer}
        rematchOffer={rematchOffer}
        myColor={gameState.myColor}
        onAccept={acceptRematch}
        onDecline={() => {
          declineRematch();
          leaveGame();
          navigate('/');
        }}
      />

      <GameResult
        result={gameState.result}
        isOver={gameState.isOver && !rematchOffer}
        onReplay={playAgain}
        onHome={() => navigate('/')}
      />

      {/* Draw Offer Notification */}
      {drawOffer && (
        <div className="draw-offer-bar">
          <div className="draw-offer-bar__inner">
            <span className="draw-offer-bar__msg">
              <strong>Opponent</strong> offered a draw
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

      {/* Timed Pause Offer Notification */}
      {pauseOffer && !gameState.isPaused && (
        <div className="draw-offer-bar">
          <div className="draw-offer-bar__inner">
            <span className="draw-offer-bar__msg">
              <strong>Opponent</strong> requested a <strong>{pauseOffer.durationMinutes || 2} min</strong> pause (opponent must resume in time or forfeit)
            </span>
            <button
              className="draw-offer-bar__btn draw-offer-bar__btn--accept"
              onClick={() => acceptPause(pauseOffer.durationMinutes || 2)}
            >
              ✓ Accept ({pauseOffer.durationMinutes || 2}m)
            </button>
            <button className="draw-offer-bar__btn draw-offer-bar__btn--reject" onClick={rejectPause}>
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {opponentDisconnected && !gameState.isOver && (
        <div className="disconnect-alert-bar" role="alert">
          <span>⚠️ Opponent disconnected. Waiting up to 60s for reconnection…</span>
        </div>
      )}

      {/* Desktop Header */}
      <header className="game-desktop-topbar">
        <button className="topbar-btn" onClick={handleSafeExit}>
          ← Exit
        </button>
        <span className={`topbar-status${gameState.isCheck ? ' topbar-status--check' : ''}`}>
          Room: <strong>{gameState.roomId}</strong> · {statusText}
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
          <button
            className="topbar-btn topbar-btn--danger"
            onClick={() => setShowExitConfirm(true)}
            disabled={gameState.isOver}
            title="Resign or exit match"
          >
            🏳 Resign
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="game-app-container">
        <section className="board-play-area">
          {/* Opponent Strip (Top) */}
          <div className="player-panel-strip player-panel-strip--top">
            <div className="player-panel-info">
              <PlayerCard
                color={topColor}
                label={topLabel}
                isActive={gameState.turn === topColor && !gameState.isPaused}
                isOver={gameState.isOver}
              />
              <CapturedPieces pieces={capturedPieces[bottomColor]} advantage={advantages[topColor]} />
            </div>
            <ChessClock
              color={topColor}
              timeMs={clocks[topColor]}
              isActive={gameState.turn === topColor && !gameState.isPaused}
              isOver={gameState.isOver}
            />
          </div>

          {/* Center Board */}
          <div className="board-square-box">
            {/* Timed Pause Overlay */}
            {gameState.isPaused && !gameState.isOver && (
              <div className="board-pause-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
                <span className="pause-overlay-badge">⏸</span>
                <h2 className="pause-overlay-title">
                  {iPaused ? 'You Paused the Match' : 'Match Paused by Opponent'}
                </h2>
                <p className="pause-overlay-sub">
                  {iPaused
                    ? `Time remaining: ${formatPauseTime(pauseCountdown)}. You must resume before time expires or opponent will automatically win.`
                    : `Waiting for opponent to resume (${formatPauseTime(pauseCountdown)} left). If opponent does not resume in time, you win automatically.`}
                </p>
                {iPaused ? (
                  <button
                    className="btn btn--primary pause-overlay-btn"
                    onClick={resumeGame}
                  >
                    ▶ Resume Match
                  </button>
                ) : (
                  <div style={{ color: 'var(--clr-accent)', fontSize: '0.9rem', fontWeight: 600 }}>
                    ⏳ Only the player who paused can resume
                  </div>
                )}
              </div>
            )}

            <ChessBoard
              gameState={displayState}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              onSquareClick={handleSquareClick}
              onPieceDrop={handleDrop}
              orientation={effectiveOrientation}
              isDraggablePiece={onlineIsDraggable}
            />
            <PromotionModal
              pendingPromotion={pendingPromotion}
              onChoice={handlePromotionChoice}
              onCancel={() => setPendingPromotion(null)}
              color={gameState.myColor}
            />
          </div>

          {/* User Strip (Bottom) */}
          <div className="player-panel-strip player-panel-strip--bottom">
            <div className="player-panel-info">
              <PlayerCard
                color={bottomColor}
                label={bottomLabel}
                isActive={isMyTurn}
                isOver={gameState.isOver}
              />
              <CapturedPieces pieces={capturedPieces[topColor]} advantage={advantages[bottomColor]} />
            </div>
            <ChessClock
              color={bottomColor}
              timeMs={clocks[bottomColor]}
              isActive={isMyTurn}
              isOver={gameState.isOver}
            />
          </div>
        </section>

        {/* Sidebar (Desktop) & Bottom App Bar (Mobile) */}
        <aside className="game-sidebar-area">
          <div className="sidebar-history-box">
            <div className="sidebar-tab-row">
              <button
                type="button"
                className={`sidebar-tab-btn ${activeTab === 'moves' ? 'sidebar-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('moves')}
              >
                <span>♟ Moves ({gameState.history.length})</span>
              </button>
              <button
                type="button"
                className={`sidebar-tab-btn ${activeTab === 'chat' ? 'sidebar-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveTab('chat');
                  setUnreadCount(0);
                }}
              >
                <span>💬 Chat</span>
                {unreadCount > 0 && <span className="sidebar-tab-badge">{unreadCount}</span>}
              </button>
            </div>
            {activeTab === 'moves' ? (
              <MoveHistory history={gameState.history} />
            ) : (
              <OnlineChat
                messages={messages}
                myColor={gameState.myColor}
                onSendMessage={sendChatMessage}
              />
            )}
          </div>

          <div className="sidebar-controls-box">
            <GameControls
              isOver={gameState.isOver}
              activeTurn={gameState.turn}
              isOnline={true}
              isPaused={gameState.isPaused}
              pauseOfferPending={!gameState.isPaused && (!!pauseOffer || pauseOfferedByMe)}
              resumeOfferPending={gameState.isPaused && !iPaused}
              drawOfferPending={!!drawOffer || drawOfferedByMe}
              onFlip={flipBoard}
              onOfferPause={() => setShowPauseModal(true)}
              onResume={iPaused ? resumeGame : undefined}
              onOfferDraw={() => {
                offerDraw();
                setDrawOfferedByMe(true);
              }}
              onResign={resign}
              onResignAndPlayAgain={playAgain}
              onOpenChat={() => {
                setMobileChatOpen(true);
                setUnreadCount(0);
              }}
              unreadChatCount={unreadCount}
              onNewGame={handleSafeExit}
              onHome={handleSafeExit}
            />
          </div>
        </aside>
      </main>

      {/* Mobile Chat Slide-Up Drawer */}
      {mobileChatOpen && (
        <OnlineChat
          messages={messages}
          myColor={gameState.myColor}
          onSendMessage={sendChatMessage}
          isMobileDrawer={true}
          onClose={() => setMobileChatOpen(false)}
          history={gameState.history}
        />
      )}
    </div>
  );
}
