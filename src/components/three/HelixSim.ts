import * as THREE from "three";
import { buildForms, buildSequence, COMPLEMENT, fork, FORK_SPLIT, type FormBuffers } from "./forms";
import { BASE_COLORS } from "@/lib/sequence";

/*
 * CPU side of the molecule. Blends between forms, plays the intro assembly, and writes instance matrices for the
 * phosphate beads, the half-rungs and their rounded tips, plus the per-base glow (read light).
 * Every scratch object lives on the instance, so update() allocates nothing.
 */

export { BASE_COLORS };
export const STRAND_COLORS = ["#134E4A", "#1D2748"];

const UP = new THREE.Vector3(0, 1, 0);
export const SPHERE_R = 0.135;
export const RUNG_R = 0.062;
export const TUBE_R = 0.07;

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function smootherstep(x: number) {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export class HelixSim {
  readonly pairs: number;
  readonly forms: FormBuffers[];
  readonly seq: Uint8Array;
  /** displayed (damped) form index */
  fd = 0;
  time = 0;
  spin = 0;
  /** intro assembly 0..1 (1 = assembled) */
  intro = 1;
  /** current fork split point (0..1 along the strand) */
  split = FORK_SPLIT;
  /** blended strand points, [ax, ay, az, bx, by, bz] per pair (read by the backbone) */
  readonly cur: Float32Array;
  /** per-instance glow for rungs and tips (2 per pair), shared by both meshes */
  readonly glow: Float32Array;

  private gap: Float32Array;
  private scatter: Float32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qIdentity = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private pa = new THREE.Vector3();
  private pb = new THREE.Vector3();
  private v = new THREE.Vector3();
  private c = new THREE.Vector3();
  private col = new THREE.Color();
  private strandColors = STRAND_COLORS.map((h) => new THREE.Color(h));

  constructor(pairs: number) {
    this.pairs = pairs;
    this.forms = buildForms(pairs);
    this.seq = buildSequence(pairs);
    this.cur = new Float32Array(pairs * 6);
    this.gap = new Float32Array(pairs);
    this.glow = new Float32Array(pairs * 2);
    this.scatter = new Float32Array(pairs * 6);
    // seeded start points for the intro: inside a radius-5 shell, biased back in z (out of the cell field)
    let r = 271828;
    const rand = () => {
      r = (r * 16807) % 2147483647;
      return r / 2147483647;
    };
    for (let i = 0; i < pairs; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const rad = 2.5 + rand() * 2.5;
      const sx = Math.sqrt(1 - u * u) * Math.cos(th) * rad;
      const sy = u * rad;
      const sz = Math.sqrt(1 - u * u) * Math.sin(th) * rad * 0.6 - 3;
      const o = i * 6;
      const jx = (rand() - 0.5) * 0.5;
      const jy = (rand() - 0.5) * 0.5;
      this.scatter[o] = sx - jx;
      this.scatter[o + 1] = sy - jy;
      this.scatter[o + 2] = sz;
      this.scatter[o + 3] = sx + jx;
      this.scatter[o + 4] = sy + jy;
      this.scatter[o + 5] = sz;
    }
  }

  /** One-time colours: rungs and tips by base, beads by strand. */
  paintStatic(spheres: THREE.InstancedMesh, rungs: THREE.InstancedMesh, tips: THREE.InstancedMesh) {
    const n = this.pairs;
    for (let i = 0; i < n; i++) {
      const b = this.seq[i];
      this.col.set(BASE_COLORS[b]);
      rungs.setColorAt(i * 2, this.col);
      tips.setColorAt(i * 2, this.col);
      this.col.set(BASE_COLORS[COMPLEMENT[b]]);
      rungs.setColorAt(i * 2 + 1, this.col);
      tips.setColorAt(i * 2 + 1, this.col);
      spheres.setColorAt(i * 2, this.strandColors[0]);
      spheres.setColorAt(i * 2 + 1, this.strandColors[1]);
    }
    for (const mesh of [spheres, rungs, tips]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Moves the fork's split point (live zipper). Rewrites forms[1] in place only when it changes. */
  setSplit(t0: number) {
    if (Math.abs(t0 - this.split) < 1e-4) return;
    this.split = t0;
    fork(this.forms[1], this.pairs, t0);
  }

  /** Blend weight of a form (1 at f = k, 0 at distance >= 1 / slope). */
  weight(k: number, slope: number) {
    return clamp01(1 - Math.abs(this.fd - k) * slope);
  }

  private blend() {
    const n = this.pairs;
    const fd = Math.min(4, Math.max(0, this.fd));
    const seg = Math.min(3, Math.floor(fd));
    const e = smoothstep(0.18, 0.82, fd - seg);
    const a = this.forms[seg];
    const b = this.forms[seg + 1];
    const intro = this.intro;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // stagger along the strand, so the change travels like an unwinding instead of a cross-fade
      let k = clamp01(e * 1.55 - t * 0.55);
      k = k * k * (3 - 2 * k);
      const o = i * 6;
      for (let j = 0; j < 6; j++) this.cur[o + j] = a.pos[o + j] + (b.pos[o + j] - a.pos[o + j]) * k;
      this.gap[i] = a.gap[i] + (b.gap[i] - a.gap[i]) * k;
      if (intro < 1) {
        // each pair flies in from its scattered start, staggered along the strand
        const f = smootherstep(intro * 1.6 - t * 0.6);
        for (let j = 0; j < 6; j++) this.cur[o + j] = this.scatter[o + j] + (this.cur[o + j] - this.scatter[o + j]) * f;
      }
    }
  }

  /** Places a unit cylinder (height 1, along +Y) between from and from + dir * len. */
  private cylinder(mesh: THREE.InstancedMesh, index: number, from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number) {
    this.q.setFromUnitVectors(UP, dir);
    this.c.copy(from).addScaledVector(dir, len * 0.5);
    this.s.set(r, Math.max(len, 0.0001), r);
    this.m.compose(this.c, this.q, this.s);
    mesh.setMatrixAt(index, this.m);
  }

  /**
   * Writes every instance. `pulse` runs the travelling read head; `ring` (0..1) lights the bases passing through
   * the polymerase ring at the current split point.
   */
  update(spheres: THREE.InstancedMesh, rungs: THREE.InstancedMesh, tips: THREE.InstancedMesh, pulse: boolean, ring: number) {
    this.blend();
    const n = this.pairs;
    const head = ((this.time * 0.16) % 1.5) - 0.25;
    const at = this.split * (n - 1);
    const cur = this.cur;
    const glow = this.glow;

    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const t = i / (n - 1);
      this.pa.set(cur[o], cur[o + 1], cur[o + 2]);
      this.pb.set(cur[o + 3], cur[o + 4], cur[o + 5]);

      const d = (t - head) / 0.05;
      const boost = pulse ? Math.exp(-d * d) : 0;
      // read light: full within ±2 pairs of the ring, then an exponential tail
      const dr = Math.abs(i - at);
      const lit = ring > 0 ? ring * (dr <= 2 ? 1 : Math.exp(-(dr - 2) * 0.9)) : 0;
      const g = Math.max(boost, lit);
      glow[i * 2] = g;
      glow[i * 2 + 1] = g;

      const r = SPHERE_R * (1 + 0.3 * boost);
      this.s.set(r, r, r);
      this.m.compose(this.pa, this.qIdentity, this.s);
      spheres.setMatrixAt(i * 2, this.m);
      this.m.compose(this.pb, this.qIdentity, this.s);
      spheres.setMatrixAt(i * 2 + 1, this.m);

      // two half-rungs, each from its strand toward the middle, leaving the unzip gap; a rounded tip on each
      this.v.subVectors(this.pb, this.pa);
      const len = this.v.length();
      if (len > 1e-5) this.v.divideScalar(len);
      else this.v.set(1, 0, 0);
      const halfLen = len * (0.5 - this.gap[i] * 0.5);
      const rr = RUNG_R * (1 + 0.35 * boost);
      this.cylinder(rungs, i * 2, this.pa, this.v, halfLen, rr);
      this.s.set(rr, rr, rr);
      this.c.copy(this.pa).addScaledVector(this.v, halfLen);
      this.m.compose(this.c, this.qIdentity, this.s);
      tips.setMatrixAt(i * 2, this.m);
      this.v.negate();
      this.cylinder(rungs, i * 2 + 1, this.pb, this.v, halfLen, rr);
      this.c.copy(this.pb).addScaledVector(this.v, halfLen);
      this.m.compose(this.c, this.qIdentity, this.s);
      tips.setMatrixAt(i * 2 + 1, this.m);
    }

    spheres.instanceMatrix.needsUpdate = true;
    rungs.instanceMatrix.needsUpdate = true;
    tips.instanceMatrix.needsUpdate = true;
    const ga = rungs.geometry.getAttribute("aGlow");
    const gb = tips.geometry.getAttribute("aGlow");
    if (ga) ga.needsUpdate = true;
    if (gb) gb.needsUpdate = true;
  }

  /** Zeroes the read light (pulse switched off). The next update() rewrites it if the ring is lit. */
  resetGlow(rungs: THREE.InstancedMesh, tips: THREE.InstancedMesh) {
    this.glow.fill(0);
    const ga = rungs.geometry.getAttribute("aGlow");
    const gb = tips.geometry.getAttribute("aGlow");
    if (ga) ga.needsUpdate = true;
    if (gb) gb.needsUpdate = true;
  }

  /** Midpoint between the strands of pair k, axis a. Arrow field: created once, so no per-frame closure. */
  private mid = (k: number, a: number) => (this.cur[k * 6 + a] + this.cur[k * 6 + 3 + a]) * 0.5;

  /**
   * Pose of the polymerase ring: centred between the strands at the split point, aligned with the ladder.
   * Writes into `pos` / `quat` (no allocation).
   */
  ringPose(pos: THREE.Vector3, quat: THREE.Quaternion) {
    const n = this.pairs;
    const at = Math.min(n - 1.001, Math.max(0, this.split * (n - 1)));
    const i = Math.floor(at);
    const f = at - i;
    const mid = this.mid;
    pos.set(
      mid(i, 0) + (mid(i + 1, 0) - mid(i, 0)) * f,
      mid(i, 1) + (mid(i + 1, 1) - mid(i, 1)) * f,
      mid(i, 2) + (mid(i + 1, 2) - mid(i, 2)) * f,
    );
    const lo = Math.max(0, i - 1);
    const hi = Math.min(n - 1, i + 2);
    this.v.set(mid(hi, 0) - mid(lo, 0), mid(hi, 1) - mid(lo, 1), mid(hi, 2) - mid(lo, 2));
    if (this.v.lengthSq() < 1e-8) this.v.copy(UP);
    quat.setFromUnitVectors(UP, this.v.normalize());
  }
}
