/*
 * The hero molecule's real structure: RCSB PDB entry 1BNA, the Drew–Dickerson B-DNA dodecamer
 * (5'-CGCGAATTCGCG-3', X-ray, 1.9 Å; Drew et al., PNAS 1981). The file ships in public/structures/ and is parsed here,
 * inside the lazy 3D chunk. Pure math, no three.js, runs once.
 *
 * Extending the dodecamer along its own axis:
 *  1. Fit the rigid screw M that carries base pair i onto base pair i + 6 (least squares over the backbone atoms of
 *     both strands, Horn's quaternion method). That is the molecule's own helical step, measured from the crystal.
 *  2. Stack copies with M² (= 12 base pairs), so each copy continues the last one along the same helix.
 *  3. Rotate everything so the screw axis is +Y, centre it, and read the phosphorus path of each strand.
 */

/** Element codes used for colour and radius. */
export const EL_C = 0;
export const EL_N = 1;
export const EL_O = 2;
export const EL_P = 3;

export interface DnaModel {
  /** base pairs after stacking (12 × copies) */
  bp: number;
  /** atom centres in scene units, molecule centred on the origin, helix axis along +Y */
  atoms: Float32Array;
  /** element code per atom */
  element: Uint8Array;
  /** position along the strand 0..1 (base-pair index / (bp - 1)), the same parameter as the sim's per-pair stagger */
  along: Float32Array;
  /** phosphorus path per strand, per base pair: [theta (unwrapped, atan2(z, x)), radius, y] in scene units */
  strandA: Float32Array;
  strandB: Float32Array;
  /** 0=A 1=T 2=G 3=C for strand A, per base pair (the real sequence, repeated) */
  sequence: Uint8Array;
  /** measured helix step per base pair: rise in Å, twist in degrees */
  rise: number;
  twist: number;
}

const BASE_CODE: Record<string, number> = { DA: 0, DT: 1, DG: 2, DC: 3 };
const BACKBONE = new Set(["P", "OP1", "OP2", "O1P", "O2P", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'"]);

type V3 = [number, number, number];

interface Atom {
  name: string;
  res: string;
  chain: string;
  seq: number;
  p: V3;
  el: number;
}

function parse(text: string): Atom[] {
  const out: Atom[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    const e = line.slice(76, 78).trim();
    const el = e === "N" ? EL_N : e === "O" ? EL_O : e === "P" ? EL_P : EL_C;
    out.push({
      name: line.slice(12, 16).trim(),
      res: line.slice(17, 20).trim(),
      chain: line.slice(21, 22),
      seq: parseInt(line.slice(22, 26), 10),
      p: [parseFloat(line.slice(30, 38)), parseFloat(line.slice(38, 46)), parseFloat(line.slice(46, 54))],
      el,
    });
  }
  return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => scl(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Row-major 3×3 times vector. */
const mul = (m: number[], v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const mulM = (a: number[], b: number[]) => {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return o;
};

/**
 * Horn (1987): the unit quaternion of the rotation that best maps the centred `src` points onto the centred `dst`
 * points is the top eigenvector of a symmetric 4×4 matrix (found here by shifted power iteration).
 */
function fitRotation(src: V3[], dst: V3[]): [number, number, number, number] {
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0; // prettier-ignore
  for (let i = 0; i < src.length; i++) {
    const a = src[i];
    const b = dst[i];
    Sxx += a[0] * b[0]; Sxy += a[0] * b[1]; Sxz += a[0] * b[2]; // prettier-ignore
    Syx += a[1] * b[0]; Syy += a[1] * b[1]; Syz += a[1] * b[2]; // prettier-ignore
    Szx += a[2] * b[0]; Szy += a[2] * b[1]; Szz += a[2] * b[2]; // prettier-ignore
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  // shift so every eigenvalue is positive; the largest one then dominates the iteration
  let shift = 0;
  for (const row of N) for (const v of row) shift += Math.abs(v);
  for (let i = 0; i < 4; i++) N[i][i] += shift;
  let q = [1, 0.1, 0.1, 0.1];
  for (let it = 0; it < 500; it++) {
    const r = N.map((row) => row[0] * q[0] + row[1] * q[1] + row[2] * q[2] + row[3] * q[3]);
    const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
    q = r.map((v) => v / l);
  }
  if (q[0] < 0) q = q.map((v) => -v);
  return [q[0], q[1], q[2], q[3]];
}

function quatToMatrix([w, x, y, z]: number[]) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ]; // prettier-ignore
}

/**
 * @param text   contents of 1BNA.pdb
 * @param copies dodecamers stacked along the axis
 * @param scale  scene units per ångström
 */
export function buildDna(text: string, copies: number, scale: number): DnaModel | null {
  const atoms = parse(text);
  if (atoms.length < 100) return null;
  const chains = Array.from(new Set(atoms.map((a) => a.chain)));
  if (chains.length < 2) return null;
  const [ca, cb] = chains;
  const resA = Array.from(new Set(atoms.filter((a) => a.chain === ca).map((a) => a.seq))).sort((a, b) => a - b);
  const resB = Array.from(new Set(atoms.filter((a) => a.chain === cb).map((a) => a.seq))).sort((a, b) => a - b);
  const L = Math.min(resA.length, resB.length);
  if (L < 8) return null;
  const H = Math.floor(L / 2);

  // base pair index: strand A residue i pairs with strand B residue L-1-i (antiparallel)
  const bpOf = (a: Atom) => (a.chain === ca ? resA.indexOf(a.seq) : L - 1 - resB.indexOf(a.seq));

  // 1) screw M: base pair i -> i + H, over matching backbone atoms of both strands
  const key = (chain: string, bp: number, name: string) => `${chain}|${bp}|${name}`;
  const byKey = new Map<string, Atom>();
  for (const a of atoms) if (BACKBONE.has(a.name)) byKey.set(key(a.chain, bpOf(a), a.name), a);
  const src: V3[] = [];
  const dst: V3[] = [];
  for (const a of atoms) {
    if (!BACKBONE.has(a.name)) continue;
    const bp = bpOf(a);
    if (bp + H >= L) continue;
    const b = byKey.get(key(a.chain, bp + H, a.name));
    if (b) {
      src.push(a.p);
      dst.push(b.p);
    }
  }
  if (src.length < 12) return null;
  const cs = scl(src.reduce(add, [0, 0, 0]), 1 / src.length);
  const cd = scl(dst.reduce(add, [0, 0, 0]), 1 / dst.length);
  const q = fitRotation(
    src.map((p) => sub(p, cs)),
    dst.map((p) => sub(p, cd)),
  );
  const R = quatToMatrix(q);
  const t = sub(cd, mul(R, cs));

  // screw axis of M: direction from the quaternion, a point on it from Chasles' formula
  const angle = 2 * Math.acos(Math.min(1, q[0]));
  let axis = norm([q[1], q[2], q[3]]);
  const tPar = dot(t, axis);
  const tPerp = sub(t, scl(axis, tPar));
  const onAxis = scl(add(tPerp, scl(cross(axis, tPerp), 1 / Math.tan(angle / 2))), 0.5);
  if (tPar < 0) axis = scl(axis, -1); // +Y runs from base pair 0 upwards
  const rise = Math.abs(tPar) / H;

  // 2) stack copies with M² (12 base pairs per step)
  const R2 = mulM(R, R);
  const t2 = add(mul(R, t), t);
  const stacked: { p: V3; el: number; bp: number; chain: string; name: string }[] = [];
  let cur = atoms.map((a) => a.p);
  for (let k = 0; k < copies; k++) {
    atoms.forEach((a, i) => stacked.push({ p: cur[i], el: a.el, bp: bpOf(a) + L * k, chain: a.chain, name: a.name }));
    cur = cur.map((p) => add(mul(R2, p), t2));
  }

  // 3) local frame: Y = screw axis, origin on the axis at the stack's middle
  const centroid = scl(stacked.reduce((s, a) => add(s, a.p), [0, 0, 0] as V3), 1 / stacked.length);
  const origin = add(onAxis, scl(axis, dot(sub(centroid, onAxis), axis)));
  const ref: V3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const ux = norm(sub(ref, scl(axis, dot(ref, axis))));
  const wz = cross(ux, axis); // (ux, axis, wz) -> (x, y, z), right-handed: a pure rotation keeps the helix right-handed
  const toLocal = (p: V3): V3 => {
    const d = sub(p, origin);
    return [dot(d, ux), dot(d, axis), dot(d, wz)];
  };

  const bp = L * copies;
  const n = stacked.length;
  const pos = new Float32Array(n * 3);
  const element = new Uint8Array(n);
  const along = new Float32Array(n);
  const pA: (V3 | null)[] = new Array(bp).fill(null);
  const pB: (V3 | null)[] = new Array(bp).fill(null);
  stacked.forEach((a, i) => {
    const l = toLocal(a.p);
    pos[i * 3] = l[0] * scale;
    pos[i * 3 + 1] = l[1] * scale;
    pos[i * 3 + 2] = l[2] * scale;
    element[i] = a.el;
    along[i] = a.bp / Math.max(1, bp - 1);
    if (a.name === "P") (a.chain === ca ? pA : pB)[a.bp] = l;
  });

  // phosphorus path per strand in cylindrical form; the missing 5'-end phosphates are filled from their neighbours
  const path = (list: (V3 | null)[]) => {
    const c: ([number, number, number] | null)[] = list.map((p) => (p ? [Math.atan2(p[2], p[0]), Math.hypot(p[0], p[2]), p[1]] : null));
    // unwrap theta along the strand
    let prev: number | null = null;
    for (const v of c) {
      if (!v) continue;
      if (prev !== null) {
        while (v[0] - prev > Math.PI) v[0] -= Math.PI * 2;
        while (v[0] - prev < -Math.PI) v[0] += Math.PI * 2;
      }
      prev = v[0];
    }
    // signed twist per base pair in this frame (theta = atan2(z, x)), from the real neighbours
    let dth = 0;
    let cnt = 0;
    for (let i = 1; i < c.length; i++) {
      if (c[i] && c[i - 1]) {
        dth += c[i]![0] - c[i - 1]![0];
        cnt++;
      }
    }
    dth /= cnt || 1;
    for (let i = 0; i < c.length; i++) {
      if (c[i]) continue;
      const a = c[i - 1];
      const b = c[i + 1];
      if (a && b) c[i] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      else if (b) c[i] = [b[0] - dth, b[1], b[2] - rise];
      else if (a) c[i] = [a[0] + dth, a[1], a[2] + rise];
      else c[i] = [0, 9, 0];
    }
    const out = new Float32Array(c.length * 3);
    c.forEach((v, i) => {
      out[i * 3] = v![0];
      out[i * 3 + 1] = v![1] * scale;
      out[i * 3 + 2] = v![2] * scale;
    });
    return out;
  };

  // the real sequence of strand A, repeated
  const unit = resA.slice(0, L).map((s) => {
    const a = atoms.find((x) => x.chain === ca && x.seq === s);
    return a ? (BASE_CODE[a.res] ?? 3) : 3;
  });
  const sequence = new Uint8Array(bp);
  for (let i = 0; i < bp; i++) sequence[i] = unit[i % L];

  const strandA = path(pA);
  const strandB = path(pB);
  // twist per base pair, read off the stacked phosphorus path (the quaternion angle alone folds 216° to 144°)
  const twist = (Math.abs(strandA[(bp - 1) * 3] - strandA[0]) / (bp - 1)) * (180 / Math.PI);
  return { bp, atoms: pos, element, along, strandA, strandB, sequence, rise, twist };
}
