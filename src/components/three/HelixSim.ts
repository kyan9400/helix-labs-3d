import * as THREE from "three";
import { buildForms, buildSequence, COMPLEMENT, type FormBuffers } from "./forms";

/*
 * CPU side of the molecule. Blends between forms and writes instance matrices.
 * Every scratch object lives on the instance, so update() allocates nothing.
 */

export const BASE_COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"]; // A, T, G, C
const STRAND_COLORS = ["#134E4A", "#1D2748"];
const LINK_COLORS = ["#2F6E68", "#36437A"];

const UP = new THREE.Vector3(0, 1, 0);
const SPHERE_R = 0.17;
const RUNG_R = 0.062;
const LINK_R = 0.045;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class HelixSim {
  readonly pairs: number;
  readonly forms: FormBuffers[];
  readonly seq: Uint8Array;
  /** displayed (damped) form index */
  fd = 0;
  time = 0;
  spin = 0;

  private cur: Float32Array;
  private gap: Float32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qIdentity = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private pa = new THREE.Vector3();
  private pb = new THREE.Vector3();
  private v = new THREE.Vector3();
  private c = new THREE.Vector3();
  private col = new THREE.Color();
  private white = new THREE.Color("#ffffff");
  private strandColors = STRAND_COLORS.map((h) => new THREE.Color(h));

  constructor(pairs: number) {
    this.pairs = pairs;
    this.forms = buildForms(pairs);
    this.seq = buildSequence(pairs);
    this.cur = new Float32Array(pairs * 6);
    this.gap = new Float32Array(pairs);
  }

  /** One-time colours for rungs and links (spheres are recoloured by the pulse). */
  paintStatic(spheres: THREE.InstancedMesh, rungs: THREE.InstancedMesh, links: THREE.InstancedMesh) {
    const n = this.pairs;
    for (let i = 0; i < n; i++) {
      const b = this.seq[i];
      rungs.setColorAt(i * 2, this.col.set(BASE_COLORS[b]));
      rungs.setColorAt(i * 2 + 1, this.col.set(BASE_COLORS[COMPLEMENT[b]]));
      spheres.setColorAt(i * 2, this.strandColors[0]);
      spheres.setColorAt(i * 2 + 1, this.strandColors[1]);
    }
    for (let s = 0; s < 2; s++) {
      this.col.set(LINK_COLORS[s]);
      for (let i = 0; i < n - 1; i++) links.setColorAt(s * (n - 1) + i, this.col);
    }
    if (rungs.instanceColor) rungs.instanceColor.needsUpdate = true;
    if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
    if (links.instanceColor) links.instanceColor.needsUpdate = true;
  }

  private blend() {
    const n = this.pairs;
    const fd = Math.min(4, Math.max(0, this.fd));
    const seg = Math.min(3, Math.floor(fd));
    const e = smoothstep(0.18, 0.82, fd - seg);
    const a = this.forms[seg];
    const b = this.forms[seg + 1];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // stagger along the strand, so the change travels like an unwinding instead of a cross-fade
      let k = Math.min(1, Math.max(0, e * 1.55 - t * 0.55));
      k = k * k * (3 - 2 * k);
      const o = i * 6;
      for (let j = 0; j < 6; j++) this.cur[o + j] = a.pos[o + j] + (b.pos[o + j] - a.pos[o + j]) * k;
      this.gap[i] = a.gap[i] + (b.gap[i] - a.gap[i]) * k;
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

  update(spheres: THREE.InstancedMesh, rungs: THREE.InstancedMesh, links: THREE.InstancedMesh, pulse: boolean) {
    this.blend();
    const n = this.pairs;
    const head = ((this.time * 0.16) % 1.5) - 0.25;
    const cur = this.cur;

    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const t = i / (n - 1);
      this.pa.set(cur[o], cur[o + 1], cur[o + 2]);
      this.pb.set(cur[o + 3], cur[o + 4], cur[o + 5]);

      const d = (t - head) / 0.05;
      const boost = pulse ? Math.exp(-d * d) : 0;
      const r = SPHERE_R * (1 + 0.6 * boost);
      this.s.set(r, r, r);
      this.m.compose(this.pa, this.qIdentity, this.s);
      spheres.setMatrixAt(i * 2, this.m);
      this.m.compose(this.pb, this.qIdentity, this.s);
      spheres.setMatrixAt(i * 2 + 1, this.m);

      if (pulse) {
        spheres.setColorAt(i * 2, this.col.copy(this.strandColors[0]).lerp(this.white, boost * 0.7));
        spheres.setColorAt(i * 2 + 1, this.col.copy(this.strandColors[1]).lerp(this.white, boost * 0.7));
      }

      // two half-rungs, each from its strand toward the middle, leaving the unzip gap
      this.v.subVectors(this.pb, this.pa);
      const len = this.v.length();
      if (len > 1e-5) this.v.divideScalar(len);
      else this.v.set(1, 0, 0);
      const halfLen = len * (0.5 - this.gap[i] * 0.5);
      const rr = RUNG_R * (1 + 0.35 * boost);
      this.cylinder(rungs, i * 2, this.pa, this.v, halfLen, rr);
      this.v.negate();
      this.cylinder(rungs, i * 2 + 1, this.pb, this.v, halfLen, rr);
    }

    // sugar-phosphate backbone links between neighbouring nucleotides
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < n - 1; i++) {
        const o = i * 6 + s * 3;
        const p = (i + 1) * 6 + s * 3;
        this.pa.set(cur[o], cur[o + 1], cur[o + 2]);
        this.v.set(cur[p] - cur[o], cur[p + 1] - cur[o + 1], cur[p + 2] - cur[o + 2]);
        const len = this.v.length();
        if (len > 1e-5) this.v.divideScalar(len);
        else this.v.set(0, 1, 0);
        this.cylinder(links, s * (n - 1) + i, this.pa, this.v, len, LINK_R);
      }
    }

    spheres.instanceMatrix.needsUpdate = true;
    rungs.instanceMatrix.needsUpdate = true;
    links.instanceMatrix.needsUpdate = true;
    if (pulse && spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
  }

  /** Puts the sphere colours back after the pulse was switched off. */
  resetSphereColors(spheres: THREE.InstancedMesh) {
    for (let i = 0; i < this.pairs; i++) {
      spheres.setColorAt(i * 2, this.strandColors[0]);
      spheres.setColorAt(i * 2 + 1, this.strandColors[1]);
    }
    if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
  }
}
