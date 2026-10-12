/*
 * The five shapes the molecule takes. Each form writes, for every base pair i:
 *   strand A position, strand B position (6 floats) and the "unzip" gap between the two half-rungs.
 * Everything is written into preallocated Float32Arrays — nothing is allocated per frame.
 */

export interface FormBuffers {
  /** [ax, ay, az, bx, by, bz] per pair */
  pos: Float32Array;
  /** gap fraction (0 = closed rung, 1 = fully unzipped) per pair */
  gap: Float32Array;
}

export function createFormBuffers(pairs: number): FormBuffers {
  return { pos: new Float32Array(pairs * 6), gap: new Float32Array(pairs) };
}

const TAU = Math.PI * 2;
const GROOVE = Math.PI * 0.75; // offset between the strands -> major / minor groove

function helix(out: FormBuffers, n: number, radius: number, height: number, turns: number, phase: number) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = t * turns * TAU + phase;
    const y = (t - 0.5) * height;
    const o = i * 6;
    out.pos[o] = Math.cos(a) * radius;
    out.pos[o + 1] = y;
    out.pos[o + 2] = Math.sin(a) * radius;
    out.pos[o + 3] = Math.cos(a + GROOVE) * radius;
    out.pos[o + 4] = y;
    out.pos[o + 5] = Math.sin(a + GROOVE) * radius;
    out.gap[i] = 0.06;
  }
}

export const FORK_HEIGHT = 7.4;
export const FORK_SPLIT = 0.46;

/**
 * Replication fork: an untwisted ladder whose top part splits into a Y with the rungs unzipped.
 * `t0` is the split point along the strand (0..1); scrolling slides it down to unzip the strand live.
 */
export function fork(out: FormBuffers, n: number, t0 = FORK_SPLIT) {
  const height = FORK_HEIGHT;
  const half = 0.85;
  const span = Math.max(0.05, 1 - t0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const d = Math.max(0, t - t0) / span; // 0 below the fork, 1 at the top
    const spread = d * d * 2.1;
    const ripple = Math.sin(t * TAU * 1.5) * 0.28;
    const y = (t - 0.5) * height;
    const o = i * 6;
    out.pos[o] = -half - spread;
    out.pos[o + 1] = y;
    out.pos[o + 2] = ripple - d * 0.9;
    out.pos[o + 3] = half + spread;
    out.pos[o + 4] = y;
    out.pos[o + 5] = ripple + d * 0.9;
    out.gap[i] = 0.06 + Math.min(1, d * 1.6) * 0.86;
  }
}

/** Cell: pairs wound along a spherical spiral; strand A is the membrane, strand B the nucleus shell. */
function cell(out: FormBuffers, n: number) {
  const outer = 2.25;
  const inner = 1.35;
  const turns = Math.max(4, Math.round(Math.sqrt(n * 0.55)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const phi = Math.acos(1 - 2 * t);
    const theta = t * turns * TAU;
    const sx = Math.sin(phi) * Math.cos(theta);
    const sy = Math.cos(phi);
    const sz = Math.sin(phi) * Math.sin(theta);
    const o = i * 6;
    out.pos[o] = sx * outer;
    out.pos[o + 1] = sy * outer;
    out.pos[o + 2] = sz * outer;
    out.pos[o + 3] = sx * inner;
    out.pos[o + 4] = sy * inner;
    out.pos[o + 5] = sz * inner;
    out.gap[i] = 0.2;
  }
}

/** Plasmid: a closed ring of DNA, both strands twisting around the ring's centre line, tilted to the viewer. */
function plasmid(out: FormBuffers, n: number) {
  const ring = 2.35;
  const tube = 0.52;
  const twists = Math.max(4, Math.round(n / 10));
  const tilt = 1.08;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * TAU;
    const phi = theta * twists;
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);
    for (let s = 0; s < 2; s++) {
      const p = phi + s * Math.PI;
      const r = ring + Math.cos(p) * tube;
      const x = nx * r;
      const y0 = Math.sin(p) * tube;
      const z0 = nz * r;
      const o = i * 6 + s * 3;
      out.pos[o] = x;
      out.pos[o + 1] = y0 * ct - z0 * st;
      out.pos[o + 2] = y0 * st + z0 * ct;
    }
    out.gap[i] = 0.06;
  }
}

export function buildForms(pairs: number): FormBuffers[] {
  const forms = [0, 1, 2, 3, 4].map(() => createFormBuffers(pairs));
  helix(forms[0], pairs, 1.05, 7.2, 3.1, 0);
  fork(forms[1], pairs);
  cell(forms[2], pairs);
  plasmid(forms[3], pairs);
  helix(forms[4], pairs, 1.3, 7.6, 3.9, Math.PI * 0.5);
  return forms;
}

// the sequence lives in lib/sequence.ts so the 2D ruler can share it
export { buildSequence, COMPLEMENT } from "@/lib/sequence";
