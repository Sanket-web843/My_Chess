/**
 * useOnlineClock.js — Server-synchronized chess clock for online matches.
 *
 * All time calculations are locked to the server-authoritative snapshot.
 * Eliminates clock drift, tab-throttling misalignment, and out-of-sync increments.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @param {Object} params
 * @param {{ white: number, black: number }} [params.serverClocks]
 * @param {number} [params.clockUpdatedAt]
 * @param {'white'|'black'} params.turn
 * @param {'lobby'|'waiting'|'active'|'finished'} params.status
 * @param {boolean} params.isOver
 * @param {boolean} params.isUnlimited
 * @param {boolean} [params.isPaused]
 * @returns {{ white: number, black: number }}
 */
export function useOnlineClock({
  serverClocks,
  clockUpdatedAt,
  turn,
  status,
  isOver,
  isUnlimited,
  isPaused = false,
}) {
  const [clocks, setClocks] = useState(() => ({
    white: serverClocks?.white ?? 15 * 60 * 1000,
    black: serverClocks?.black ?? 15 * 60 * 1000,
  }));

  const syncRef = useRef({
    white: serverClocks?.white ?? 15 * 60 * 1000,
    black: serverClocks?.black ?? 15 * 60 * 1000,
    updatedAt: clockUpdatedAt || Date.now(),
  });

  // Keep ref up to date with authoritative server snapshots
  useEffect(() => {
    if (!serverClocks) return;
    syncRef.current = {
      white: serverClocks.white,
      black: serverClocks.black,
      updatedAt: clockUpdatedAt || Date.now(),
    };
    setClocks({
      white: serverClocks.white,
      black: serverClocks.black,
    });
  }, [serverClocks?.white, serverClocks?.black, clockUpdatedAt]);

  // Smoothly interpolate active player's clock between server events (frozen if paused)
  useEffect(() => {
    if (isUnlimited || isOver || status !== 'active' || isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, now - syncRef.current.updatedAt);
      const activeColor = turn === 'w' ? 'white' : turn === 'b' ? 'black' : turn;
      const inactiveColor = activeColor === 'white' ? 'black' : 'white';

      const currentRemaining = Math.max(0, syncRef.current[activeColor] - elapsed);

      setClocks({
        [inactiveColor]: syncRef.current[inactiveColor],
        [activeColor]: currentRemaining,
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isUnlimited, isOver, status, turn, isPaused]);

  return clocks;
}

