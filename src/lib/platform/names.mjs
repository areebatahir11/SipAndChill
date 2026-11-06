// "Same business name" rule. Two names are the same when they match after ignoring case, accents, spaces, punctuation
// and "&" vs "and". So "Sip & Chill", "sip and chill" and "SIP-AND-CHILL!" are one name. Works for Urdu and other scripts too.

/** Comparison key of a business name, or '' when the name has no letters or digits at all. */
export function businessNameKey(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')          // accents and Arabic-script marks
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]+/gu, ''); // keep letters and digits of any language only
}
