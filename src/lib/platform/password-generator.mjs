// Strong temporary passwords for new client owners. Ambiguous characters (0/O, 1/l/I) are left out.
// Always contains a letter and a number, so it satisfies passwordSchema.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

/** Unbiased random integer in [0, max) from the Web Crypto API. */
function randomBelow(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

export function generatePassword(length = 14) {
  const all = LETTERS + DIGITS;
  const chars = [LETTERS[randomBelow(LETTERS.length)], DIGITS[randomBelow(DIGITS.length)]];
  while (chars.length < length) chars.push(all[randomBelow(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) { // Fisher-Yates shuffle
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
