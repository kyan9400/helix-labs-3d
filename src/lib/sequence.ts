/*
 * The site's "genome": one deterministic base sequence shared by the 3D molecule and the 2D sequence ruler,
 * so both show the same letters. Pure code, no three.js, safe to import from server components.
 */

export const BASE_LETTERS = ["A", "T", "G", "C"] as const;
export const BASE_COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"]; // A, T, G, C
export const COMPLEMENT = [1, 0, 3, 2];

/** Deterministic xorshift sequence. 0=A 1=T 2=G 3=C for strand A. */
export function buildSequence(pairs: number): Uint8Array {
  const seq = new Uint8Array(pairs);
  let seed = 0x9e3779b9;
  for (let i = 0; i < pairs; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seq[i] = (seed >>> 0) % 4;
  }
  return seq;
}
