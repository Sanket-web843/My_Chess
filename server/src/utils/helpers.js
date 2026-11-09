/**
 * Generates a short alphanumeric room code.
 * @param {number} length
 * @returns {string}
 */
export function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Returns true if the given string is a valid room code format.
 * @param {string} code
 * @returns {boolean}
 */
export function isValidRoomCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code);
}
