// Draws the hero poster (public/structures/1bna-poster.svg) from the real structure, PDB 1BNA, with the same
// stacking, scale and lean as the 3D hero. Run once after changing the structure or the look:
//   node --experimental-strip-types scripts/make-dna-poster.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { buildDna } from "../src/components/three/dna.ts";

const COPIES = 2; // matches DNA_COPIES in Molecule.ts
const LEAN = -0.22; // matches TILT in Molecule.ts (rotation about the view axis)
const W = 400;
const H = 600;
const PX = 6.8; // px per ångström
// print colours of the site palette, per element (C, N, O, P), and the paper they fade into with depth
const INK = ["#2C6F67", "#3F51C9", "#D9472F", "#E09A2E"];
const PAPER = [244, 241, 234];
const VDW = [1.7, 1.55, 1.52, 1.8];

const text = readFileSync(new URL("../public/structures/1BNA.pdb", import.meta.url), "utf8");
const dna = buildDna(text, COPIES, 1);
if (!dna) throw new Error("could not parse 1BNA");

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

const c = Math.cos(LEAN);
const s = Math.sin(LEAN);
const atoms = [];
let zMin = Infinity;
let zMax = -Infinity;
for (let i = 0; i < dna.element.length; i++) {
  const x = dna.atoms[i * 3];
  const y = dna.atoms[i * 3 + 1];
  const z = dna.atoms[i * 3 + 2];
  const sx = x * c - y * s;
  const sy = x * s + y * c;
  zMin = Math.min(zMin, z);
  zMax = Math.max(zMax, z);
  atoms.push({ x: W / 2 + sx * PX, y: H / 2 - sy * PX, z, el: dna.element[i] });
}
// depth layers back to front, then by element inside a layer: one path per colour (circles drawn as two arcs)
const LAYERS = 6;
for (const a of atoms) a.layer = Math.min(LAYERS - 1, Math.floor(((a.z - zMin) / (zMax - zMin)) * LAYERS));
atoms.sort((a, b) => a.layer - b.layer || a.el - b.el);

let out = "";
let curFill = "";
let d = "";
const flush = () => {
  if (d) out += `<path fill="${curFill}" d="${d}"/>`;
  d = "";
};
for (const a of atoms) {
  const layer = a.layer;
  const fill = toHex(mix(hex(INK[a.el]), PAPER, 0.55 * (1 - layer / (LAYERS - 1))));
  if (fill !== curFill) {
    flush();
    curFill = fill;
  }
  const r = Math.round(VDW[a.el] * 0.5 * PX * 10) / 10;
  const x = Math.round((a.x - r) * 10) / 10;
  const y = Math.round(a.y * 10) / 10;
  d += `M${x} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0-${r * 2} 0`;
}
flush();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>B-DNA, PDB 1BNA</title>${out}</svg>\n`;
writeFileSync(new URL("../public/structures/1bna-poster.svg", import.meta.url), svg);
console.log(`1bna-poster.svg: ${atoms.length} atoms, ${(svg.length / 1024).toFixed(1)} KB`);
