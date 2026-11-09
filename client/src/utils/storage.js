/**
 * utils/storage.js — localStorage helpers for the offline game.
 *
 * All keys are namespaced under 'chess:offline:' to avoid collisions
 * with other apps on the same origin.
 *
 * Architecture rule: only offline code (useLocalGame, OfflinePage)
 * may use these helpers. Online mode is server-authoritative.
 */

const NS = 'chess:offline:';

/**
 * Persists a JSON-serialisable value under the given key.
 * @param {string} key
 * @param {unknown} value
 */
export function storageSet(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (err) {
    // Storage quota exceeded or private browsing — degrade silently
    console.warn('[storage] Could not save:', key, err);
  }
}

/**
 * Retrieves a previously stored value.
 * @template T
 * @param {string} key
 * @param {T} [defaultValue]
 * @returns {T}
 */
export function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Removes a stored value.
 * @param {string} key
 */
export function storageRemove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch {
    // Ignore
  }
}

/** Clears all keys in our namespace. */
export function storageClearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(NS))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

// ── Tab-isolated sessionStorage helpers for online mode ──────────────
const ONLINE_NS = 'chess:online:';

export function sessionSet(key, value) {
  try {
    sessionStorage.setItem(ONLINE_NS + key, JSON.stringify(value));
  } catch (err) {
    console.warn('[sessionStorage] Could not save:', key, err);
  }
}

export function sessionGet(key, defaultValue = null) {
  try {
    const raw = sessionStorage.getItem(ONLINE_NS + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function sessionRemove(key) {
  try {
    sessionStorage.removeItem(ONLINE_NS + key);
  } catch {
    // Ignore
  }
}
