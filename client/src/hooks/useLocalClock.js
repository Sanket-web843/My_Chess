/**
 * useLocalClock.js — Browser-side countdown clock for offline mode.
 *
 * Drives any time preset (Bullet 1m, Blitz 3+2, Rapid 10m, Classical 15+5, or Unlimited)
 * entirely with browser setInterval — no server contact required.
 *
 * Architecture rule: must NEVER import socket.js or call fetch().
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTimePresetConfig } from '../data/constants.js';
import {
  storageGet,
  storageSet,
  storageRemove,
  sessionGet,
  sessionSet,
  sessionRemove,
} from '../utils/storage.js';

const DEFAULT_STORAGE_KEY = 'offlineClocks';

/**
 * @param {string|object} timeMode      - e.g. 'bullet', 'blitz', 'rapid', 'classical', 'unlimited'
 * @param {'white'|'black'} activeColor - whose clock is ticking
 * @param {boolean} isRunning           - false when game is paused/over
 * @param {() => void} onTimeout        - called when a clock hits 0
 * @param {string} [storageKey]         - key for persisting clock times
 * @param {boolean} [useSessionStorage] - whether to use tab-isolated sessionStorage
 */
export function useLocalClock(
  timeMode,
  activeColor,
  isRunning,
  onTimeout,
  storageKey = DEFAULT_STORAGE_KEY,
  useSessionStorage = false
) {
  const getStore = useCallback(
    (k, def) => (useSessionStorage ? sessionGet(k, def) : storageGet(k, def)),
    [useSessionStorage]
  );
  const setStore = useCallback(
    (k, val) => (useSessionStorage ? sessionSet(k, val) : storageSet(k, val)),
    [useSessionStorage]
  );
  const removeStore = useCallback(
    (k) => (useSessionStorage ? sessionRemove(k) : storageRemove(k)),
    [useSessionStorage]
  );

  const config = getTimePresetConfig(timeMode);
  const isUnlimited = config.initialMs === Infinity || config.id === 'unlimited';

  const [clocks, setClocks] = useState(() => {
    if (isUnlimited) return { white: Infinity, black: Infinity };
    const saved = getStore(storageKey, null);
    if (
      saved &&
      saved.modeId === config.id &&
      typeof saved.white === 'number' &&
      typeof saved.black === 'number' &&
      saved.white > 0 &&
      saved.black > 0
    ) {
      return { white: saved.white, black: saved.black };
    }
    return {
      white: config.initialMs,
      black: config.initialMs,
    };
  });

  const intervalRef = useRef(null);
  const lastTickRef = useRef(null);
  const lastSaveRef = useRef(0);
  const configRef = useRef(config);
  const onTimeoutRef = useRef(onTimeout);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const tick = useCallback(() => {
    if (isUnlimited || !isRunningRef.current) return;

    const now = Date.now();
    const elapsed = now - (lastTickRef.current ?? now);
    lastTickRef.current = now;

    let timedOut = false;

    setClocks((prev) => {
      const remaining = prev[activeColor] - elapsed;
      if (remaining <= 0) {
        timedOut = true;
        const zeroClocks = { ...prev, [activeColor]: 0 };
        setStore(storageKey, { ...zeroClocks, modeId: config.id });
        return zeroClocks;
      }
      const updated = { ...prev, [activeColor]: remaining };
      // Save periodically (every 500ms) to avoid high-frequency disk I/O while preserving reload state
      if (now - lastSaveRef.current >= 500) {
        lastSaveRef.current = now;
        setStore(storageKey, { ...updated, modeId: config.id });
      }
      return updated;
    });

    if (timedOut) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      onTimeoutRef.current?.();
    }
  }, [isUnlimited, activeColor, config.id, setStore, storageKey]);

  useEffect(() => {
    if (!isRunning || isUnlimited) return;

    lastTickRef.current = Date.now();
    intervalRef.current = setInterval(tick, 100); // 100ms resolution

    return () => clearInterval(intervalRef.current);
  }, [isRunning, isUnlimited, tick]);

  const prevTimeModeRef = useRef(timeMode);

  // Reset clocks automatically if timeMode changes after mount
  useEffect(() => {
    if (prevTimeModeRef.current === timeMode) return;
    prevTimeModeRef.current = timeMode;

    const nextConfig = getTimePresetConfig(timeMode);
    const unlimited = nextConfig.initialMs === Infinity || nextConfig.id === 'unlimited';
    const saved = getStore(storageKey, null);

    if (
      !unlimited &&
      saved &&
      saved.modeId === nextConfig.id &&
      typeof saved.white === 'number' &&
      typeof saved.black === 'number' &&
      saved.white > 0 &&
      saved.black > 0
    ) {
      setClocks({ white: saved.white, black: saved.black });
    } else {
      setClocks({
        white: unlimited ? Infinity : nextConfig.initialMs,
        black: unlimited ? Infinity : nextConfig.initialMs,
      });
    }
  }, [timeMode, getStore, storageKey]);

  /**
   * Add the increment to the player who just moved.
   * Call this immediately after a legal move.
   * @param {'white'|'black'} color
   */
  const applyIncrement = useCallback(
    (color) => {
      const currentConfig = configRef.current;
      if (currentConfig.initialMs === Infinity || !currentConfig.incrementMs) return;

      setClocks((prev) => {
        const next = {
          ...prev,
          [color]: prev[color] + currentConfig.incrementMs,
        };
        setStore(storageKey, { ...next, modeId: currentConfig.id });
        return next;
      });
    },
    [setStore, storageKey]
  );

  /** Resets both clocks to their initial configured values. */
  const resetClocks = useCallback(() => {
    const currentConfig = configRef.current;
    const unlimited = currentConfig.initialMs === Infinity || currentConfig.id === 'unlimited';
    removeStore(storageKey);
    setClocks({
      white: unlimited ? Infinity : currentConfig.initialMs,
      black: unlimited ? Infinity : currentConfig.initialMs,
    });
  }, [removeStore, storageKey]);

  return { clocks, applyIncrement, resetClocks };
}
