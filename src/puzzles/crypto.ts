/**
 * Apply a Caesar cipher shift to alphabetic characters.
 * Non-alphabetic characters are passed through unchanged.
 * Positive shift = encrypt; negative = decrypt.
 */
export function caesarShift(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const isUpper = char >= 'A' && char <= 'Z';
    const base = isUpper ? 65 : 97;
    const code = char.charCodeAt(0) - base;
    // JavaScript's % can return negative values, so add 26 to keep it positive.
    return String.fromCharCode(((code + (shift % 26) + 26) % 26) + base);
  });
}

/** Decrypt Caesar-cipher text (shift letters backward by `key` positions). */
export function caesarDecrypt(text: string, key: number): string {
  return caesarShift(text, -key);
}

/** Encrypt text with a Caesar cipher (shift letters forward by `key` positions). */
export function caesarEncrypt(text: string, key: number): string {
  return caesarShift(text, key);
}
