import * as THREE from "three";

/*
 * Smooth sugar-phosphate backbone: one continuous tube per strand, rebuilt in place from the strand points.
 * - centripetal Catmull-Rom through the points (no overshoot while the forms morph)
 * - parallel-transport frames (no twisting or pinching)
 * - analytic normals (cos·N + sin·B), never computeVertexNormals
 * - rounded caps at both open ends, plus a closure span (last point back to the first) whose radius is scaled by
 *   `close` (1 at the plasmid), so the ring closes seamlessly and the span vanishes in the other forms
 * Index buffer is written once; each update only rewrites position + normal. Nothing is allocated per update.
 *
 * Ring layout per strand: [main tube K+1 rings][closure tube steps+1 rings][end cap CAP rings][start cap CAP rings]
 */

const CAP = 4;
const TAU = Math.PI * 2;

export class Backbone {
  readonly geometries: THREE.BufferGeometry[] = [];
  private readonly n: number;
  private readonly steps: number;
  private readonly radial: number;
  private readonly radius: number;
  private readonly mainRings: number;
  private readonly rings: number;
  // scratch: ring centres, tangents, normals, binormals and radii for one strand
  private readonly c: Float32Array;
  private readonly t: Float32Array;
  private readonly nn: Float32Array;
  private readonly b: Float32Array;
  private readonly r: Float32Array;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;

  constructor(pairs: number, steps: number, radial: number, radius: number) {
    this.n = pairs;
    this.steps = steps;
    this.radial = radial;
    this.radius = radius;
    this.mainRings = (pairs - 1) * steps + 1;
    this.rings = this.mainRings + (steps + 1) + CAP * 2;
    const R = this.rings;
    this.c = new Float32Array(R * 3);
    this.t = new Float32Array(R * 3);
    this.nn = new Float32Array(R * 3);
    this.b = new Float32Array(R * 3);
    this.r = new Float32Array(R);
    this.cos = new Float32Array(radial);
    this.sin = new Float32Array(radial);
    for (let k = 0; k < radial; k++) {
      this.cos[k] = Math.cos((k / radial) * TAU);
      this.sin[k] = Math.sin((k / radial) * TAU);
    }
    const index = this.buildIndex();
    // static distance along the strand in pair units (main tube 0..n-1, closure n-1..n, caps at their end):
    // the shader moves light packets along it
    const along = new Float32Array(R * radial);
    for (let i = 0; i < R; i++) {
      let v: number;
      if (i < this.mainRings) v = i / steps;
      else if (i <= this.mainRings + steps) v = pairs - 1 + (i - this.mainRings) / steps;
      else if (i < this.mainRings + steps + 1 + CAP) v = pairs - 1;
      else v = 0;
      along.fill(v, i * radial, (i + 1) * radial);
    }
    const alongAttr = new THREE.BufferAttribute(along, 1);
    for (let s = 0; s < 2; s++) {
      const g = new THREE.BufferGeometry();
      const pos = new THREE.BufferAttribute(new Float32Array(R * radial * 3), 3);
      const nor = new THREE.BufferAttribute(new Float32Array(R * radial * 3), 3);
      pos.setUsage(THREE.DynamicDrawUsage);
      nor.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute("position", pos);
      g.setAttribute("normal", nor);
      g.setAttribute("aS", alongAttr);
      g.setIndex(index);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
      this.geometries.push(g);
    }
  }

  /** Quads between ring a and ring b (both `radial` vertices). */
  private strip(out: number[], a: number, b: number) {
    const m = this.radial;
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m;
      const a0 = a * m + k;
      const a1 = a * m + k1;
      const b0 = b * m + k;
      const b1 = b * m + k1;
      out.push(a0, a1, b0, a1, b1, b0); // counter-clockwise seen from outside
    }
  }

  private buildIndex() {
    const out: number[] = [];
    const M = this.mainRings;
    for (let i = 0; i < M - 1; i++) this.strip(out, i, i + 1);
    const z0 = M;
    for (let i = 0; i < this.steps; i++) this.strip(out, z0 + i, z0 + i + 1);
    const e0 = z0 + this.steps + 1;
    this.strip(out, M - 1, e0);
    for (let i = 0; i < CAP - 1; i++) this.strip(out, e0 + i, e0 + i + 1);
    const s0 = e0 + CAP;
    // the start cap lies behind ring 0, so its strips run from the cap tip forward
    this.strip(out, s0, 0);
    for (let i = 0; i < CAP - 1; i++) this.strip(out, s0 + i + 1, s0 + i);
    const max = this.rings * this.radial;
    return new THREE.BufferAttribute(max > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1);
  }

  // control points of the current span: [p0 xyz, p1 xyz, p2 xyz, p3 xyz]
  private readonly k = new Float32Array(12);

  /**
   * Centripetal Catmull-Rom between p1 and p2 (read from `src` at the given offsets), written to c[ring].
   * ext0 / ext3 (0..1) blend p0 / p3 towards a straight extrapolation, used at the open ends.
   */
  private sample(src: Float32Array, o0: number, o1: number, o2: number, o3: number, u: number, ring: number, ext0: number, ext3: number) {
    const k = this.k;
    for (let a = 0; a < 3; a++) {
      const x1 = src[o1 + a];
      const x2 = src[o2 + a];
      k[a] = src[o0 + a] + (2 * x1 - x2 - src[o0 + a]) * ext0;
      k[3 + a] = x1;
      k[6 + a] = x2;
      k[9 + a] = src[o3 + a] + (2 * x2 - x1 - src[o3 + a]) * ext3;
    }
    // knot spacing: sqrt of the chord length (alpha = 0.5)
    const t1 = Math.sqrt(Math.hypot(k[3] - k[0], k[4] - k[1], k[5] - k[2])) || 1e-4;
    const t2 = t1 + (Math.sqrt(Math.hypot(k[6] - k[3], k[7] - k[4], k[8] - k[5])) || 1e-4);
    const t3 = t2 + (Math.sqrt(Math.hypot(k[9] - k[6], k[10] - k[7], k[11] - k[8])) || 1e-4);
    const tt = t1 + (t2 - t1) * u;
    const w = ring * 3;
    for (let a = 0; a < 3; a++) {
      const P0 = k[a];
      const P1 = k[3 + a];
      const P2 = k[6 + a];
      const P3 = k[9 + a];
      const A1 = ((t1 - tt) * P0 + tt * P1) / t1;
      const A2 = ((t2 - tt) * P1 + (tt - t1) * P2) / (t2 - t1);
      const A3 = ((t3 - tt) * P2 + (tt - t2) * P3) / (t3 - t2);
      const B1 = ((t2 - tt) * A1 + tt * A2) / t2;
      const B2 = ((t3 - tt) * A2 + (tt - t1) * A3) / (t3 - t1);
      this.c[w + a] = ((t2 - tt) * B1 + (tt - t1) * B2) / (t2 - t1);
    }
  }

  /** Tangent at ring i from its neighbours (central difference inside [lo, hi]). */
  private tangent(i: number, lo: number, hi: number) {
    const a = Math.max(lo, i - 1) * 3;
    const b = Math.min(hi, i + 1) * 3;
    const c = this.c;
    let x = c[b] - c[a];
    let y = c[b + 1] - c[a + 1];
    let z = c[b + 2] - c[a + 2];
    const l = Math.hypot(x, y, z);
    if (l < 1e-6) {
      // degenerate (points on top of each other): keep the previous tangent
      const p = Math.max(0, i - 1) * 3;
      x = this.t[p];
      y = this.t[p + 1];
      z = this.t[p + 2];
      if (!x && !y && !z) y = 1;
    } else {
      x /= l;
      y /= l;
      z /= l;
    }
    this.t[i * 3] = x;
    this.t[i * 3 + 1] = y;
    this.t[i * 3 + 2] = z;
  }

  // last start normal per strand: the next rebuild seeds from it, so the frame never flips between updates
  private readonly seed = new Float32Array(6);
  private readonly seeded = [false, false];

  /**
   * Parallel transport: project the previous normal onto ring i's plane.
   * `prev < 0` seeds the start frame from `seedFrom` (the strand's last start normal) when given.
   */
  private frame(i: number, prev: number, seedFrom = -1) {
    const T = this.t;
    const N = this.nn;
    const B = this.b;
    const w = i * 3;
    const tx = T[w];
    const ty = T[w + 1];
    const tz = T[w + 2];
    let nx: number;
    let ny: number;
    let nz: number;
    if (prev < 0) {
      nx = ny = nz = 0;
      if (seedFrom >= 0) {
        // keep last update's start normal, re-projected onto the new tangent plane
        const S = this.seed;
        const d = S[seedFrom] * tx + S[seedFrom + 1] * ty + S[seedFrom + 2] * tz;
        nx = S[seedFrom] - tx * d;
        ny = S[seedFrom + 1] - ty * d;
        nz = S[seedFrom + 2] - tz * d;
      }
      if (Math.hypot(nx, ny, nz) < 1e-3) {
        // any vector not parallel to T
        const ax = Math.abs(tx) < 0.9 ? 1 : 0;
        const ay = ax ? 0 : 1;
        nx = ax - tx * (tx * ax + ty * ay);
        ny = ay - ty * (tx * ax + ty * ay);
        nz = -tz * (tx * ax + ty * ay);
      }
    } else {
      const p = prev * 3;
      const d = N[p] * tx + N[p + 1] * ty + N[p + 2] * tz;
      nx = N[p] - tx * d;
      ny = N[p + 1] - ty * d;
      nz = N[p + 2] - tz * d;
    }
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-6 && prev >= 0) {
      const p = prev * 3;
      nx = B[p];
      ny = B[p + 1];
      nz = B[p + 2];
      l = Math.hypot(nx, ny, nz) || 1;
    }
    nx /= l;
    ny /= l;
    nz /= l;
    N[w] = nx;
    N[w + 1] = ny;
    N[w + 2] = nz;
    B[w] = ty * nz - tz * ny;
    B[w + 1] = tz * nx - tx * nz;
    B[w + 2] = tx * ny - ty * nx;
  }

  /** Offset of pair i (wrapped) of strand s in `cur`. */
  private off(i: number, s: number) {
    return ((i + this.n) % this.n) * 6 + s * 3;
  }

  /**
   * Rebuild strand `s` (0 = A, 1 = B) from `cur` ([ax, ay, az, bx, by, bz] per pair).
   * `close` 0..1 opens / closes the ring (plasmid), `scale` shrinks the whole tube (intro).
   */
  update(cur: Float32Array, s: number, close: number, scale = 1) {
    const n = this.n;
    const steps = this.steps;
    const M = this.mainRings;
    const R = this.radius * scale;
    const open = 1 - close;

    // 1) centres along the main tube; the end neighbours blend between a straight extension (open) and the loop
    let ring = 0;
    for (let i = 0; i < n - 1; i++) {
      const e0 = i === 0 ? open : 0;
      const e3 = i === n - 2 ? open : 0;
      for (let j = 0; j < steps; j++) this.sample(cur, this.off(i - 1, s), this.off(i, s), this.off(i + 1, s), this.off(i + 2, s), j / steps, ring++, e0, e3);
    }
    this.sample(cur, this.off(n - 3, s), this.off(n - 2, s), this.off(n - 1, s), this.off(n, s), 1, ring++, 0, open);
    // closure span: last point back to the first
    const z0 = M;
    for (let j = 0; j <= steps; j++) this.sample(cur, this.off(n - 2, s), this.off(n - 1, s), this.off(0, s), this.off(1, s), j / steps, z0 + j, 0, 0);

    // 2) radii
    for (let i = 0; i < M; i++) this.r[i] = R;
    const rc = R * close;
    for (let j = 0; j <= steps; j++) this.r[z0 + j] = rc;

    // 3) tangents and transported frames: main tube, then the closure continues from the main tube's end
    for (let i = 0; i < M; i++) this.tangent(i, 0, M - 1);
    for (let j = 0; j <= steps; j++) this.tangent(z0 + j, z0, z0 + steps);
    this.frame(0, -1, this.seeded[s] ? s * 3 : -1);
    this.seed[s * 3] = this.nn[0];
    this.seed[s * 3 + 1] = this.nn[1];
    this.seed[s * 3 + 2] = this.nn[2];
    this.seeded[s] = true;
    for (let i = 1; i < M; i++) this.frame(i, i - 1);
    this.frame(z0, M - 1);
    for (let j = 1; j <= steps; j++) this.frame(z0 + j, z0 + j - 1);

    // 4) hemispherical caps at both open ends (they sink into the joint as the ring closes)
    const e0 = z0 + steps + 1;
    const s0 = e0 + CAP;
    this.cap(M - 1, e0, 1, R, open);
    this.cap(0, s0, -1, R, open);

    // 5) write vertices with analytic normals
    const g = this.geometries[s];
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const NO = nor.array as Float32Array;
    const m = this.radial;
    const C = this.c;
    const T = this.t;
    const N = this.nn;
    const B = this.b;
    for (let i = 0; i < this.rings; i++) {
      const w = i * 3;
      const r = this.r[i];
      const isCap = i >= e0;
      for (let k = 0; k < m; k++) {
        const cs = this.cos[k];
        const sn = this.sin[k];
        const dx = cs * N[w] + sn * B[w];
        const dy = cs * N[w + 1] + sn * B[w + 1];
        const dz = cs * N[w + 2] + sn * B[w + 2];
        const v = (i * m + k) * 3;
        P[v] = C[w] + dx * r;
        P[v + 1] = C[w + 1] + dy * r;
        P[v + 2] = C[w + 2] + dz * r;
        if (isCap) {
          // normal = cosθ·radial + sinθ·axis, with cosθ / sinθ packed in capCos / capSin
          const ci = this.capCos[i - e0];
          const si = this.capSin[i - e0];
          NO[v] = dx * ci + T[w] * si;
          NO[v + 1] = dy * ci + T[w + 1] * si;
          NO[v + 2] = dz * ci + T[w + 2] * si;
        } else {
          NO[v] = dx;
          NO[v + 1] = dy;
          NO[v + 2] = dz;
        }
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  // cosθ / sinθ for each cap ring (end cap then start cap), filled once
  private readonly capCos = new Float32Array(CAP * 2).map((_, i) => Math.cos((((i % CAP) + 1) / CAP) * Math.PI * 0.5));
  private readonly capSin = new Float32Array(CAP * 2).map((_, i) => Math.sin((((i % CAP) + 1) / CAP) * Math.PI * 0.5));

  /** Hemisphere rings past ring `end`, pointing along dir·T; `ext` (0..1) scales how far they stick out. */
  private cap(end: number, first: number, dir: number, R: number, ext: number) {
    const C = this.c;
    const T = this.t;
    const N = this.nn;
    const B = this.b;
    const e = end * 3;
    for (let j = 0; j < CAP; j++) {
      const th = ((j + 1) / CAP) * Math.PI * 0.5;
      const w = (first + j) * 3;
      const along = Math.sin(th) * R * ext;
      for (let a = 0; a < 3; a++) {
        T[w + a] = T[e + a] * dir; // the cap's axis (outward)
        C[w + a] = C[e + a] + T[w + a] * along;
        N[w + a] = N[e + a];
        B[w + a] = B[e + a];
      }
      this.r[first + j] = Math.cos(th) * R;
    }
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
  }
}
