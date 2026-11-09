/**
 * Shared game constants used by client and server.
 */

/** Comprehensive time control presets */
export const TIME_PRESETS = [
  {
    id: 'bullet',
    name: '1 min',
    desc: 'Bullet speed',
    initialMs: 1 * 60 * 1000,
    incrementMs: 0,
    icon: '⚡',
  },
  {
    id: 'blitz',
    name: '3 + 2',
    desc: 'Blitz · 2s inc',
    initialMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
    icon: '🔥',
  },
  {
    id: 'rapid',
    name: '10 min',
    desc: 'Rapid standard',
    initialMs: 10 * 60 * 1000,
    incrementMs: 0,
    icon: '⏱',
  },
  {
    id: 'classical',
    name: '15 + 5',
    desc: 'Classical · 5s inc',
    initialMs: 15 * 60 * 1000,
    incrementMs: 5 * 1000,
    icon: '⏳',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    desc: 'No time limits',
    initialMs: Infinity,
    incrementMs: 0,
    icon: '∞',
  },
];

/** Map for O(1) lookup by preset id */
export const TIME_PRESET_MAP = TIME_PRESETS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {});

/** Backwards-compatibility aliases */
TIME_PRESET_MAP['timed'] = TIME_PRESET_MAP['classical'];

/** Helper to get config from string or object */
export function getTimePresetConfig(modeOrId) {
  if (!modeOrId) return TIME_PRESET_MAP['classical'];
  if (typeof modeOrId === 'object' && typeof modeOrId.initialMs === 'number') {
    return modeOrId;
  }
  return TIME_PRESET_MAP[modeOrId] || TIME_PRESET_MAP['classical'];
}

export const TIME_MODES = {
  BULLET: 'bullet',
  BLITZ: 'blitz',
  RAPID: 'rapid',
  CLASSICAL: 'classical',
  TIMED: 'classical',
  UNLIMITED: 'unlimited',
};

/** Initial clock fallback */
export const TIMED_CLOCK = {
  INITIAL_MS: 15 * 60 * 1000,
  INCREMENT_MS: 5 * 1000,
};

/** Game status values */
export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHED: 'finished',
};

/** Play mode */
export const PLAY_MODE = {
  OFFLINE: 'offline',
  ONLINE: 'online',
};
