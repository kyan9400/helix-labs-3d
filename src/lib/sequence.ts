/*
 * The site's "genome": one base sequence shared by the 3D molecule and the 2D sequence ruler,
 * so both show the same letters. Pure code, no three.js, safe to import from server components.
 */

export const BASE_LETTERS = ["A", "T", "G", "C"] as const;
export const BASE_COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"]; // A, T, G, C
export const COMPLEMENT = [1, 0, 3, 2];

/**
 * The real sequence of the hero molecule, PDB 1BNA (the Drew–Dickerson dodecamer 5'-CGCGAATTCGCG-3'), repeated.
 * 0=A 1=T 2=G 3=C for strand A.
 */
export const DODECAMER = [3, 2, 3, 2, 0, 0, 1, 1, 3, 2, 3, 2];

export function buildSequence(pairs: number): Uint8Array {
  const seq = new Uint8Array(pairs);
  for (let i = 0; i < pairs; i++) seq[i] = DODECAMER[i % DODECAMER.length];
  return seq;
}
