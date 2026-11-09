/**
 * useOnlineGame.js — Online chess state via Socket.IO
 *
 * Full authoritative client integration for online multiplayer:
 *  - Handles connect/disconnect lifecycle
 *  - Room creation and joining
 *  - Authoritative game snapshots and moves
 *  - Draw offers and resignations
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { socket } from '../services/socket.js';
import { useSocket } from './useSocket.js';
import { soundManager } from '../services/sound.js';
import { sessionGet, sessionSet, sessionRemove } from '../utils/storage.js';

const ONLINE_SESSION_KEY = 'onlineSession';
const PLAYER_TOKEN_KEY = 'playerToken';

function getPlayerToken() {
  let token = sessionGet(PLAYER_TOKEN_KEY, null);
  if (!token) {
    token = 'pt_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionSet(PLAYER_TOKEN_KEY, token);
  }
  return token;
}

const INITIAL_STATE = {
  roomId: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  myColor: null,
  status: 'lobby', // 'lobby' | 'waiting' | 'active' | 'finished'
  isOver: false,
  isCheck: false,
  isDraw: false,
  result: null,
  players: { white: null, black: null },
  timeMode: 'classical',
  history: [],
  clocks: { white: 15 * 60 * 1000, black: 15 * 60 * 1000 },
  clockUpdatedAt: null,
  isUnlimited: false,
  isPaused: false,
  pausedBy: null,
  pauseExpiresAt: null,
  pauseDurationMs: null,
};

export function useOnlineGame() {
  const { connected } = useSocket();
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [drawOffer, setDrawOffer] = useState(null); // { from: 'white' | 'black' }
  const [pauseOffer, setPauseOffer] = useState(null); // { from: 'white' | 'black' }
  const [resumeOffer, setResumeOffer] = useState(null); // { from: 'white' | 'black' }
  const [opponentDisconnected, setOpponentDisconnected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const reconnectedRef = useRef(false);

  // Connect socket when online mode mounts, disconnect when unmounting
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, []);

  // Attempt automatic reconnection if player had an active match
  useEffect(() => {
    if (!connected || reconnectedRef.current) return;

    const saved = sessionGet(ONLINE_SESSION_KEY, null);
    if (!saved?.roomId) return;

    const playerToken = getPlayerToken();
    socket.emit('room:reconnect', { roomId: saved.roomId, playerToken }, (res) => {
      reconnectedRef.current = true;
      if (res?.error) {
        sessionRemove(ONLINE_SESSION_KEY);
        return;
      }
      if (res?.session) {
        const turnColor = res.session.turn === 'w' ? 'white' : res.session.turn === 'b' ? 'black' : res.session.turn;
        setGameState({
          ...res.session,
          roomId: res.roomId,
          myColor: res.myColor,
          turn: turnColor,
          history: res.session.history || [],
          isOver: res.session.isOver || res.session.status === 'finished',
        });
      }
    });
  }, [connected]);

  // Listen for socket events
  useEffect(() => {
    function onGameState(snapshot) {
      setGameState((prev) => {
        const turnColor = snapshot.turn === 'w' ? 'white' : snapshot.turn === 'b' ? 'black' : snapshot.turn;
        const newHistory = snapshot.history || [];

        // Play move sound if a new move occurred
        if (newHistory.length > (prev.history?.length || 0)) {
          const lastMove = newHistory[newHistory.length - 1];
          soundManager.playMoveEffect({
            captured: !!lastMove?.captured,
            san: lastMove?.san,
            inCheck: snapshot.isCheck,
            isOver: snapshot.isOver || snapshot.status === 'finished',
          });
        }

        const isOver = snapshot.isOver || snapshot.status === 'finished';
        if (isOver) {
          sessionRemove(ONLINE_SESSION_KEY);
          setOpponentDisconnected(null);
        }

        return {
          ...prev,
          ...snapshot,
          turn: turnColor,
          history: newHistory,
          isOver,
        };
      });
    }

    function onGameStart(snapshot) {
      soundManager.playMove();
      setOpponentDisconnected(null);
      setGameState((prev) => {
        const turnColor = snapshot.turn === 'w' ? 'white' : snapshot.turn === 'b' ? 'black' : snapshot.turn;
        return {
          ...prev,
          ...snapshot,
          turn: turnColor,
          status: 'active',
          history: snapshot.history || [],
          isOver: snapshot.isOver || false,
        };
      });
    }

    function onDrawOffer(data) {
      setDrawOffer(data);
    }

    function onDrawRejected() {
      setDrawOffer(null);
    }

    function onPauseOffer(data) {
      setPauseOffer(data);
    }

    function onPaused() {
      setPauseOffer(null);
      soundManager.playMove();
    }

    function onPauseRejected() {
      setPauseOffer(null);
    }

    function onResumeOffer(data) {
      setResumeOffer(data);
    }

    function onResumed() {
      setResumeOffer(null);
      soundManager.playMove();
    }

    function onResumeRejected() {
      setResumeOffer(null);
    }

    function onPlayerDisconnected(data) {
      setOpponentDisconnected(data);
    }

    function onPlayerReconnected() {
      setOpponentDisconnected(null);
      soundManager.playMove();
    }

    function onChatMessage(msg) {
      setMessages((prev) => [...prev, msg]);
      soundManager.playMove();
    }

    function onGameError(err) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'An error occurred');
    }

    socket.on('game:state', onGameState);
    socket.on('game:start', onGameStart);
    socket.on('game:drawOffer', onDrawOffer);
    socket.on('game:drawRejected', onDrawRejected);
    socket.on('game:pauseOffer', onPauseOffer);
    socket.on('game:paused', onPaused);
    socket.on('game:pauseRejected', onPauseRejected);
    socket.on('game:resumeOffer', onResumeOffer);
    socket.on('game:resumed', onResumed);
    socket.on('game:resumeRejected', onResumeRejected);
    socket.on('game:playerDisconnected', onPlayerDisconnected);
    socket.on('game:playerReconnected', onPlayerReconnected);
    socket.on('chat:message', onChatMessage);
    socket.on('game:error', onGameError);

    return () => {
      socket.off('game:state', onGameState);
      socket.off('game:start', onGameStart);
      socket.off('game:drawOffer', onDrawOffer);
      socket.off('game:drawRejected', onDrawRejected);
      socket.off('game:pauseOffer', onPauseOffer);
      socket.off('game:paused', onPaused);
      socket.off('game:pauseRejected', onPauseRejected);
      socket.off('game:resumeOffer', onResumeOffer);
      socket.off('game:resumed', onResumed);
      socket.off('game:resumeRejected', onResumeRejected);
      socket.off('game:playerDisconnected', onPlayerDisconnected);
      socket.off('game:playerReconnected', onPlayerReconnected);
      socket.off('chat:message', onChatMessage);
      socket.off('game:error', onGameError);
    };
  }, []);

  // Actions
  const createRoom = useCallback((timeMode = 'timed') => {
    setErrorMsg(null);
    const playerToken = getPlayerToken();
    socket.emit('room:create', { timeMode, playerToken }, (res) => {
      if (res?.error) {
        setErrorMsg(res.error);
        return;
      }
      sessionSet(ONLINE_SESSION_KEY, { roomId: res.roomId, myColor: 'white' });
      setGameState((prev) => ({
        ...prev,
        roomId: res.roomId,
        myColor: 'white',
        status: 'waiting',
        timeMode,
      }));
    });
  }, []);

  const joinRoom = useCallback((code) => {
    setErrorMsg(null);
    const playerToken = getPlayerToken();
    const roomId = code.trim().toUpperCase();
    socket.emit('room:join', { roomId, playerToken }, (res) => {
      if (res?.error) {
        setErrorMsg(res.error);
        return;
      }
      sessionSet(ONLINE_SESSION_KEY, { roomId: res.roomId, myColor: res.myColor || 'black' });
      setGameState((prev) => ({
        ...prev,
        roomId: res.roomId,
        myColor: res.myColor || 'black',
        status: 'active',
      }));
    });
  }, []);

  const sendMove = useCallback((from, to, promotion) => {
    setErrorMsg(null);
    socket.emit('game:move', {
      roomId: gameState.roomId,
      from,
      to,
      promotion,
    }, (res) => {
      if (res?.error) {
        setErrorMsg(res.error);
      }
    });
  }, [gameState.roomId]);

  const resign = useCallback(() => {
    if (!gameState.roomId) return;
    socket.emit('game:resign', { roomId: gameState.roomId });
    sessionRemove(ONLINE_SESSION_KEY);
  }, [gameState.roomId]);

  const offerDraw = useCallback(() => {
    if (!gameState.roomId) return;
    socket.emit('game:drawOffer', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const acceptDraw = useCallback(() => {
    if (!gameState.roomId) return;
    setDrawOffer(null);
    socket.emit('game:drawAccept', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const rejectDraw = useCallback(() => {
    if (!gameState.roomId) return;
    setDrawOffer(null);
    socket.emit('game:drawReject', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const offerPause = useCallback((durationMinutes = 2) => {
    if (!gameState.roomId) return;
    const mins = typeof durationMinutes === 'number' ? durationMinutes : 2;
    socket.emit('game:pauseOffer', { roomId: gameState.roomId, durationMinutes: mins });
  }, [gameState.roomId]);

  const acceptPause = useCallback((durationMinutes = 2) => {
    if (!gameState.roomId) return;
    const mins = typeof durationMinutes === 'number' ? durationMinutes : 2;
    setPauseOffer(null);
    socket.emit('game:pauseAccept', { roomId: gameState.roomId, durationMinutes: mins });
  }, [gameState.roomId]);

  const rejectPause = useCallback(() => {
    if (!gameState.roomId) return;
    setPauseOffer(null);
    socket.emit('game:pauseReject', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const resumeGame = useCallback(() => {
    if (!gameState.roomId) return;
    socket.emit('game:resume', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const offerResume = useCallback(() => {
    if (!gameState.roomId) return;
    socket.emit('game:resume', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const acceptResume = useCallback(() => {
    if (!gameState.roomId) return;
    setResumeOffer(null);
    socket.emit('game:resumeAccept', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const rejectResume = useCallback(() => {
    if (!gameState.roomId) return;
    setResumeOffer(null);
    socket.emit('game:resumeReject', { roomId: gameState.roomId });
  }, [gameState.roomId]);

  const sendChatMessage = useCallback((text) => {
    if (!gameState.roomId || typeof text !== 'string' || !text.trim()) return;
    socket.emit('chat:send', { roomId: gameState.roomId, text: text.trim() });
  }, [gameState.roomId]);

  const leaveGame = useCallback(() => {
    sessionRemove(ONLINE_SESSION_KEY);
    setGameState(INITIAL_STATE);
    setDrawOffer(null);
    setPauseOffer(null);
    setResumeOffer(null);
    setOpponentDisconnected(null);
    setMessages([]);
    setErrorMsg(null);
  }, []);

  return {
    gameState,
    connected,
    drawOffer,
    pauseOffer,
    resumeOffer,
    opponentDisconnected,
    messages,
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
    offerResume,
    acceptResume,
    rejectResume,
    sendChatMessage,
    leaveGame,
  };
}
