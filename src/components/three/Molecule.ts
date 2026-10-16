import * as THREE from "three";
import type { RootState } from "@react-three/fiber";
import { Backbone } from "./Backbone";
import { FORK_HEIGHT, FORK_SPLIT } from "./forms";
import { BASE_3D, HelixSim, STRAND_COLORS, STRAND_LIGHT, TUBE_R } from "./HelixSim";
import { EL_C, EL_N, EL_O, EL_P, type DnaModel } from "./dna";
import type { TierSettings } from "@/lib/tiers";
import { scrollState } from "@/lib/scroll-state";

/*
 * The whole molecule as a plain three.js object graph (R3F mounts `root` as a primitive).
 *   root (layout: position, scale)
 *     specimen window (darkfield slide behind, sized and tinted per form)
 *     lean (tilt; on phones the hero helix lies diagonally across the slide)
 *       inner (spin)
 *         2 glass backbone tubes (light packets run along them), pearl beads, half-rungs + rounded tips (read light),
 *         base-pair halos, polymerase ring, cell shells,
 *         real atoms of PDB 1BNA (one instanced sphere per atom, shown in the helix forms)
 * frame() runs everything for one rendered frame and says whether another frame is needed. No per-frame allocation.
 */

const TILT = 0.22;
/** scene units per ångström for the real structure (24 stacked base pairs ≈ the height of the old helix) */
export const DNA_SCALE = 0.074;
/** dodecamers stacked along the axis */
export const DNA_COPIES = 2;
const SPIN = 0.22;
const INTRO_S = 1.8;
const ENV_MIN = 0.15;
const ENV_MAX = 1.0;
// z·tan(fov/2) stays at this value during the dolly zoom, so the molecule plane keeps its size
const DOLLY_K = 12 * Math.tan(THREE.MathUtils.degToRad(17.5));
// half [w, h] of the specimen window for each form, in molecule space (helix, fork, cell, plasmid, helix)
const WINDOW = [
  [2.25, 3.95],
  [3.0, 4.25],
  [3.0, 3.0],
  [3.45, 3.0],
  [2.45, 4.15],
];
// window tint per form: [centre, edge]. Teal for the helix, cyan for reading, indigo for the cell, plum for the
// plasmid, deep green for renewal
const TINT = [
  ["#16504C", "#041312"],
  ["#0F4552", "#03111A"],
  ["#232A78", "#060820"],
  ["#4A1D3E", "#12060F"],
  ["#13503F", "#03130E"],
].map(([c, e]) => [new THREE.Color(c), new THREE.Color(e)]);
const TINT_LIGHT = ["#7CF2D8", "#86E8FF", "#A9B4FF", "#FFB4C8", "#9CF5C9"].map((h) => new THREE.Color(h));

/*
 * Real atoms: CPK element colours, tuned to the site's palette (carbon pearl-mint instead of black, nitrogen
 * periwinkle, oxygen coral, phosphorus amber), and radii at half the van der Waals radius (a ball model).
 */
const ATOM_COLORS: Record<number, string> = { [EL_C]: "#A9DCCF", [EL_N]: "#8190FF", [EL_O]: "#FF6A4D", [EL_P]: "#FFB238" };
const VDW: Record<number, number> = { [EL_C]: 1.7, [EL_N]: 1.55, [EL_O]: 1.52, [EL_P]: 1.8 };
const ATOM_SIZE = 0.5;

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function smooth(x: number) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/**
 * Bases: a soft inner glow in their own colour all the time, plus the per-instance "read light" (aGlow) on top.
 */
function withGlow<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * (0.2 + vGlow * 2.4);\n#endif",
      );
  };
  mat.customProgramCacheKey = () => "helix-glow";
  return mat;
}

/**
 * Real atoms: each sphere scales with its base pair's share of "real" (the same per-pair stagger the sim uses, so the
 * molecule dissolves into the diagram as the strand unwinds and re-forms at the end), grows in with the intro, and
 * glows as the read head passes. All on the GPU: the instance matrices are written once.
 */
function withAtoms<T extends THREE.Material>(mat: T, u: Record<string, { value: number }>): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aT;
        uniform float uE;
        uniform float uDir;
        uniform float uIntro;
        uniform float uHead;
        uniform float uPulse;
        varying float vAtomGlow;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float aK = clamp(uE * 1.55 - aT * 0.55, 0.0, 1.0);
        aK = aK * aK * (3.0 - 2.0 * aK);
        float aVis = uDir < -0.5 ? 1.0 - aK : (uDir > 0.5 ? aK : 0.0);
        float aF = clamp(uIntro * 1.6 - aT * 0.6, 0.0, 1.0);
        aF = aF * aF * aF * (aF * (aF * 6.0 - 15.0) + 10.0);
        float aD = (aT - uHead) / 0.07;
        vAtomGlow = uPulse * exp(-aD * aD);
        transformed *= aVis * aF * (1.0 + 0.25 * vAtomGlow);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAtomGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * (0.1 + vAtomGlow * 1.5);\n#endif",
      );
  };
  mat.customProgramCacheKey = () => "helix-atoms";
  return mat;
}

/**
 * Backbone glass: a fresnel rim in the strand's light colour, plus packets of light that run along the strand
 * (`aS` = distance in pairs). The two strands run in opposite directions, like real antiparallel DNA.
 */
function withFlow<T extends THREE.Material>(mat: T, light: string, dir: number, time: { value: number }, amount: { value: number }): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uFlowAmt = amount;
    shader.uniforms.uFlowCol = { value: new THREE.Color(light) };
    shader.uniforms.uFlowDir = { value: dir };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aS;\nvarying float vS;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvS = aS;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vS;\nuniform float uTime;\nuniform float uFlowAmt;\nuniform vec3 uFlowCol;\nuniform float uFlowDir;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
        float fPh = vS * 0.5 * uFlowDir - uTime * 1.5;
        float fPk = pow(0.5 + 0.5 * sin(fPh), 26.0) + 0.7 * pow(0.5 + 0.5 * sin(fPh * 0.37 + 2.1), 48.0);
        totalEmissiveRadiance += uFlowCol * (fRim * 0.85 + fPk * 2.6 + 0.05) * uFlowAmt;`,
      );
  };
  mat.customProgramCacheKey = () => `helix-flow-${dir}`;
  return mat;
}

/*
 * Darkfield specimen window: a rounded "slide" behind the molecule (a pill for the strand forms, a disc for the cell),
 * deep tinted glass with a soft centre light, out-of-focus cells (procedural bokeh), a dashed reticle, a scale bar,
 * a lit rim and a soft ink shadow on the paper. One quad, one draw call; it replaces the old flat shadow.
 */
const BACK_VERT = /* glsl */ `
  uniform vec2 uQuad;
  varying vec2 vP;
  void main() {
    vP = (uv - 0.5) * uQuad;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BACK_FRAG = /* glsl */ `
  uniform vec2 uHalf;
  uniform float uMargin;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform vec3 uLight;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScan;
  uniform float uScanY;
  varying vec2 vP;
  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  void main() {
    vec2 p = vP;
    float r = min(uHalf.x, uHalf.y);
    float d = sdBox(p, uHalf, r);
    float aa = fwidth(d) * 1.2;
    float inside = 1.0 - smoothstep(-aa, aa, d);

    // soft ink shadow on the paper, offset down-right
    float ds = sdBox(p - vec2(0.14, -0.3), uHalf, r);
    float sh = 1.0 - smoothstep(-0.25, uMargin, ds);
    sh = sh * sh * 0.3;

    // interior: tinted glass lit from the centre and from the upper left
    float g = exp(-dot(p, p) / (r * r) * 1.1);
    float k = exp(-length(p - vec2(-0.35, 0.45) * uHalf) / (r * 0.9));
    vec3 col = mix(uEdge, uCore, g * 0.85 + k * 0.35);

    // out-of-focus cells drifting in the medium
    for (int i = 0; i < BOKEH; i++) {
      float fi = float(i);
      vec2 c = (vec2(hash(fi + 1.3), hash(fi + 7.1)) * 2.0 - 1.0) * uHalf * 0.92;
      c += vec2(sin(uTime * 0.11 + fi * 1.7), cos(uTime * 0.083 + fi * 2.3)) * 0.3;
      float h = hash(fi + 3.7);
      float rr = mix(0.12, 0.62, h * h);
      float dd = length(p - c);
      float disc = 1.0 - smoothstep(rr * 0.8, rr, dd);
      float ring = smoothstep(rr * 0.62, rr * 0.95, dd) * disc;
      vec3 bc = hash(fi + 9.0) < 0.55 ? uLight : mix(vec3(1.0, 0.42, 0.28), vec3(0.42, 0.48, 1.0), hash(fi + 11.0));
      col += bc * (disc * 0.035 + ring * 0.07) * mix(0.4, 1.0, hash(fi + 5.0));
    }

    // dashed reticle circle and a scale bar near the bottom
    float fw = fwidth(p.x) * 1.5;
    float rc = r * 0.84;
    float ang = atan(p.y, p.x) / 6.28318;
    float dash = step(0.55, fract(ang * 96.0));
    col += uLight * (1.0 - smoothstep(0.0, fw * 1.4, abs(length(p) - rc))) * dash * 0.16;
    vec2 sb = p - vec2(0.0, -uHalf.y + r * 0.3);
    float bar = (1.0 - smoothstep(0.0, fw, abs(sb.y))) * step(abs(sb.x), 0.6);
    float tick = (1.0 - smoothstep(0.0, fw, abs(fract(sb.x / 0.2 + 0.5) - 0.5) * 0.2)) * step(abs(sb.x), 0.61)
      * step(sb.y, 0.07) * step(-0.0, sb.y);
    col += uLight * (bar + tick) * 0.28;

    // read scan (sequencing chapter): a thin bright line with a wide glow
    float sy = p.y - uScanY;
    col += uLight * uScan * (exp(-sy * sy / 0.0016) * 0.55 + exp(-abs(sy) * 2.2) * 0.1);

    // vignette towards the edge, an inner glow and a lit rim
    col *= 0.62 + 0.38 * (1.0 - smoothstep(-r * 0.9, 0.0, d));
    col += uLight * exp(d / 0.16) * inside * 0.16;
    col += uLight * exp(-abs(d) / 0.018) * 0.5;

    // dither against banding
    col += (hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) - 0.5) / 128.0;

    vec3 outC = mix(vec3(0.063, 0.125, 0.122), col, inside);
    gl_FragColor = vec4(outC, max(inside, sh) * uOpacity);
    #include <colorspace_fragment>
  }
`;

/* Soft additive halos on every base pair: the "read" bases bloom as the head passes. */
const HALO_VERT = /* glsl */ `
  uniform float uPx;
  uniform float uOpacity;
  attribute float aGlow;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPx * (0.55 + aGlow * 1.1) / -mv.z;
    vColor = aColor;
    vA = (0.16 + aGlow * 0.85) * uOpacity;
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = exp(-d * d * 4.5) * (1.0 - d);
    gl_FragColor = vec4(vColor, a * vA);
    #include <colorspace_fragment>
  }
`;

const SHELL_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
// rim-only fresnel: reads as a membrane from every angle, costs one cheap draw
const SHELL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
    gl_FragColor = vec4(uColor, f * uAlpha);
  }
`;

/** Lathe profile of a rounded rectangle (counter-clockwise, so the lathe normals face out). */
function roundedRectProfile(r: number, hw: number, hh: number, cr: number, steps = 5) {
  const pts: THREE.Vector2[] = [];
  const corners = [
    [r + hw - cr, -hh + cr, -Math.PI / 2],
    [r + hw - cr, hh - cr, 0],
    [r - hw + cr, hh - cr, Math.PI / 2],
    [r - hw + cr, -hh + cr, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr));
    }
  }
  pts.push(pts[0].clone());
  return pts;
}

function circleProfile(cx: number, rad: number, steps = 12) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * rad, Math.sin(a) * rad));
  }
  return pts;
}

export class Molecule {
  readonly root = new THREE.Group();
  readonly sim: HelixSim;
  private readonly settings: TierSettings;
  private readonly lean = new THREE.Group();
  private readonly inner = new THREE.Group();
  private readonly backbone: Backbone;
  private readonly spheres: THREE.InstancedMesh;
  private readonly rungs: THREE.InstancedMesh;
  private readonly tips: THREE.InstancedMesh;
  private readonly ring = new THREE.Group();
  private readonly shells: THREE.Mesh[] = [];
  private readonly shellMats: THREE.ShaderMaterial[] = [];
  private readonly back: THREE.Mesh;
  private readonly backMat: THREE.ShaderMaterial;
  private readonly halos: THREE.Points;
  private readonly haloMat: THREE.ShaderMaterial;
  private readonly haloPos: Float32Array;
  private readonly haloGlow: Float32Array;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly ringPos = new THREE.Vector3();
  private readonly ringQuat = new THREE.Quaternion();
  private readonly uTime = { value: 0 };
  private readonly uFlow = { value: 0 };
  private readonly atomU = { uE: { value: 0 }, uDir: { value: -1 }, uIntro: { value: 1 }, uHead: { value: -1 }, uPulse: { value: 0 } };
  private pulsing = false;

  constructor(settings: TierSettings, calm: boolean, dna: DnaModel | null = null) {
    this.settings = settings;
    const n = settings.pairs;
    const sim = new HelixSim(n, dna);
    this.sim = sim;
    sim.fd = scrollState.f;
    sim.intro = calm ? 1 : 0;
    this.root.add(this.lean);
    this.lean.add(this.inner);

    // backbone tubes: dark glass with a lit rim, clearcoat (+ thin-film iridescence on high), light packets
    this.backbone = new Backbone(n, settings.tubeSteps, settings.tubeRadial, TUBE_R);
    this.disposables.push(this.backbone);
    STRAND_COLORS.forEach((color, s) => {
      const base = settings.physical
        ? new THREE.MeshPhysicalMaterial({
            color,
            roughness: 0.14,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            ...(settings.iridescence
              ? { iridescence: 0.6, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 520] as [number, number] }
              : {}),
          })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.18 });
      const mat = withFlow(base, STRAND_LIGHT[s], s === 0 ? 1 : -1, this.uTime, this.uFlow);
      const mesh = new THREE.Mesh(this.backbone.geometries[s], mat);
      mesh.frustumCulled = false;
      this.inner.add(mesh);
      this.disposables.push(mat);
    });

    // phosphate beads: small pearls
    const seg = settings.segments;
    const beadGeo = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.66)));
    const beadMat = settings.physical
      ? new THREE.MeshPhysicalMaterial({
          roughness: 0.22,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          ...(settings.iridescence ? { iridescence: 0.9, iridescenceIOR: 1.4 } : {}),
        })
      : new THREE.MeshStandardMaterial({ roughness: 0.26 });
    this.spheres = new THREE.InstancedMesh(beadGeo, beadMat, n * 2);

    // bases: open half-rungs + rounded tips, glossy candy glass that glows from inside, brighter when read
    const radial = settings.tubeRadial;
    const baseMat = withGlow(
      settings.physical
        ? new THREE.MeshPhysicalMaterial({
            roughness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            sheen: 0.35,
            sheenColor: new THREE.Color("#ffffff"),
          })
        : new THREE.MeshStandardMaterial({ roughness: 0.24 }),
    );
    const rungGeo = new THREE.CylinderGeometry(1, 1, 1, radial, 1, true);
    const tipGeo = new THREE.SphereGeometry(1, Math.max(8, radial), Math.max(6, Math.round(radial * 0.66)));
    for (const g of [rungGeo, tipGeo]) {
      const attr = new THREE.InstancedBufferAttribute(sim.glow, 1);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute("aGlow", attr);
    }
    this.rungs = new THREE.InstancedMesh(rungGeo, baseMat, n * 2);
    this.tips = new THREE.InstancedMesh(tipGeo, baseMat, n * 2);
    for (const mesh of [this.spheres, this.rungs, this.tips]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.inner.add(mesh);
    }
    this.disposables.push(beadGeo, beadMat, rungGeo, tipGeo, baseMat);

    // base-pair halos: one additive point per pair, at the middle of the rung
    this.haloPos = new Float32Array(n * 3);
    this.haloGlow = new Float32Array(n);
    const haloCol = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.set(BASE_3D[sim.seq[i]]);
      haloCol[i * 3] = c.r;
      haloCol[i * 3 + 1] = c.g;
      haloCol[i * 3 + 2] = c.b;
    }
    const haloGeo = new THREE.BufferGeometry();
    const hp = new THREE.BufferAttribute(this.haloPos, 3);
    const hg = new THREE.BufferAttribute(this.haloGlow, 1);
    hp.setUsage(THREE.DynamicDrawUsage);
    hg.setUsage(THREE.DynamicDrawUsage);
    haloGeo.setAttribute("position", hp);
    haloGeo.setAttribute("aGlow", hg);
    haloGeo.setAttribute("aColor", new THREE.BufferAttribute(haloCol, 3));
    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uPx: { value: 100 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.halos = new THREE.Points(haloGeo, this.haloMat);
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 2;
    this.inner.add(this.halos);
    this.disposables.push(haloGeo, this.haloMat);

    // polymerase ring: brushed metal clamp with a mint emissive read head inside
    const ringGeo = new THREE.LatheGeometry(roundedRectProfile(1.25, 0.09, 0.17, 0.05), 48);
    const ringMat = settings.physical
      ? new THREE.MeshPhysicalMaterial({ color: "#c9ccd1", metalness: 1, roughness: 0.28, anisotropy: 0.7, anisotropyRotation: 0 })
      : new THREE.MeshStandardMaterial({ color: "#c9ccd1", metalness: 1, roughness: 0.32 });
    const lipGeo = new THREE.LatheGeometry(circleProfile(1.25 - 0.09 - 0.012, 0.026), 48);
    const lipMat = new THREE.MeshStandardMaterial({
      color: "#9ED9C9",
      emissive: "#7CF2D8",
      emissiveIntensity: 2.2,
      roughness: 0.4,
    });
    this.ring.add(new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(lipGeo, lipMat));
    this.ring.visible = false;
    this.inner.add(this.ring);
    this.disposables.push(ringGeo, ringMat, lipGeo, lipMat);

    // cell form: fresnel membrane + nucleus shells (shell tiers only), drawn after the molecule
    if (settings.shell) {
      const shellGeo = new THREE.SphereGeometry(1, 64, 48);
      this.disposables.push(shellGeo);
      const defs: [number, string, number][] = [
        [2.4, "#6FF0DA", 0.55],
        [1.5, "#9AA6FF", 0.4],
      ];
      for (const [radius, color, alpha] of defs) {
        const mat = new THREE.ShaderMaterial({
          vertexShader: SHELL_VERT,
          fragmentShader: SHELL_FRAG,
          uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        mat.userData.alpha = alpha;
        const mesh = new THREE.Mesh(shellGeo, mat);
        mesh.scale.setScalar(radius);
        mesh.renderOrder = 1;
        mesh.visible = false;
        this.inner.add(mesh);
        this.shells.push(mesh);
        this.shellMats.push(mat);
        this.disposables.push(mat);
      }
    }

    // real atoms of PDB 1BNA: one instanced sphere per atom, static matrices, coloured by element
    if (dna) {
      const count = dna.element.length;
      const aSeg = Math.min(seg, 18);
      const atomGeo = new THREE.SphereGeometry(1, aSeg, Math.max(6, Math.round(aSeg * 0.66)));
      const along = new THREE.InstancedBufferAttribute(dna.along, 1);
      atomGeo.setAttribute("aT", along);
      const atomMat = withAtoms(
        settings.physical
          ? new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 })
          : new THREE.MeshStandardMaterial({ roughness: 0.34 }),
        this.atomU,
      );
      const atomsMesh = new THREE.InstancedMesh(atomGeo, atomMat, count);
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const colors = Object.fromEntries(Object.entries(ATOM_COLORS).map(([k, v]) => [k, new THREE.Color(v)]));
      for (let i = 0; i < count; i++) {
        const el = dna.element[i];
        const r = VDW[el] * ATOM_SIZE * DNA_SCALE;
        p.set(dna.atoms[i * 3], dna.atoms[i * 3 + 1], dna.atoms[i * 3 + 2]);
        sc.set(r, r, r);
        m.compose(p, q, sc);
        atomsMesh.setMatrixAt(i, m);
        atomsMesh.setColorAt(i, colors[el]);
      }
      atomsMesh.frustumCulled = false;
      this.atomU.uIntro.value = calm ? 1 : 0;
      this.inner.add(atomsMesh);
      this.disposables.push(atomGeo, atomMat, atomsMesh);
    }

    // darkfield specimen window behind the molecule (does not lean or spin)
    const backGeo = new THREE.PlaneGeometry(1, 1);
    const tint = TINT[0];
    this.backMat = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT,
      fragmentShader: BACK_FRAG,
      defines: { BOKEH: settings.pulse ? (settings.physical ? 22 : 14) : 8 },
      uniforms: {
        uQuad: { value: new THREE.Vector2(1, 1) },
        uHalf: { value: new THREE.Vector2(2, 4) },
        uMargin: { value: 0.9 },
        uCore: { value: tint[0].clone() },
        uEdge: { value: tint[1].clone() },
        uLight: { value: TINT_LIGHT[0].clone() },
        uTime: this.uTime,
        uOpacity: { value: calm ? 1 : 0 },
        uScan: { value: 0 },
        uScanY: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.back = new THREE.Mesh(backGeo, this.backMat);
    this.back.position.set(0, 0, -3.2);
    this.back.renderOrder = -2;
    this.back.frustumCulled = false;
    this.root.add(this.back);
    this.disposables.push(backGeo, this.backMat);

    sim.paintStatic(this.spheres, this.rungs, this.tips);
    this.write(false, 0);
  }

  /** Runs the sim and writes every buffer for the current state. */
  private write(pulse: boolean, ringW: number) {
    const sim = this.sim;
    sim.update(this.spheres, this.rungs, this.tips, pulse, ringW);
    const close = smooth(sim.weight(3, 2));
    const grow = smooth((sim.intro - 0.35) / 0.65); // the ribbon grows in as the pairs arrive
    this.backbone.update(sim.cur, 0, close, grow);
    this.backbone.update(sim.cur, 1, close, grow);
    // halos sit at the middle of each rung and fade as the pair unzips
    const cur = sim.cur;
    for (let i = 0; i < sim.pairs; i++) {
      const o = i * 6;
      this.haloPos[i * 3] = (cur[o] + cur[o + 3]) * 0.5;
      this.haloPos[i * 3 + 1] = (cur[o + 1] + cur[o + 4]) * 0.5;
      this.haloPos[i * 3 + 2] = (cur[o + 2] + cur[o + 5]) * 0.5;
      this.haloGlow[i] = sim.glow[i * 2] * (1 - sim.gap[i] * 0.85);
    }
    const g = this.halos.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aGlow.needsUpdate = true;
  }

  /** One frame. Returns true while something is still moving (the caller then invalidates). */
  frame(state: RootState, delta: number, calm: boolean): boolean {
    const sim = this.sim;
    const dt = Math.min(delta, 0.05);

    // scroll -> displayed form (damped; reduced motion cuts at chapter midpoints)
    const target = calm ? Math.round(scrollState.f) : scrollState.f;
    if (calm) sim.fd = target;
    else sim.fd += (target - sim.fd) * (1 - Math.exp(-dt * 7));
    const settling = Math.abs(target - sim.fd) > 0.0006;
    if (!settling) sim.fd = target;
    const fd = sim.fd;

    if (!calm) {
      sim.time += dt;
      sim.spin += dt * SPIN;
    }
    this.uTime.value = sim.time;

    // drag to rotate, with inertia
    let dragging = false;
    if (scrollState.dragV !== 0) {
      sim.spin += scrollState.dragV * dt;
      scrollState.dragV *= Math.exp(-dt * 3);
      if (Math.abs(scrollState.dragV) < 0.001) scrollState.dragV = 0;
      dragging = true;
    }

    // intro: assemble once the canvas is revealed; lights come up with it, the slide fades in first
    const ready = document.documentElement.dataset.stage === "ready";
    if (calm) sim.intro = 1;
    else if (ready && sim.intro < 1) sim.intro = Math.min(1, sim.intro + dt / INTRO_S);
    const introRunning = ready && sim.intro < 1;
    const introE = smooth(sim.intro);
    state.scene.environmentIntensity = ENV_MIN + (ENV_MAX - ENV_MIN) * introE;
    this.backMat.uniforms.uOpacity.value = smooth(sim.intro * 2.5);
    this.uFlow.value = smooth((sim.intro - 0.4) / 0.6);
    this.haloMat.uniforms.uOpacity.value = introE;

    // live zipper: the split point slides down while the Sequencing chapter scrolls by
    sim.setSplit(calm ? FORK_SPLIT : 0.72 - 0.4 * clamp01((fd - 0.82) / 0.36));
    const w1 = sim.weight(1, 2.2);

    const pulse = this.settings.pulse && !calm && sim.intro >= 1;
    if (this.pulsing && !pulse) sim.resetGlow(this.rungs, this.tips);
    this.pulsing = pulse;
    this.write(pulse, w1);

    // real atoms follow the sim's blend (the shader repeats its per-pair stagger)
    const au = this.atomU;
    au.uE.value = sim.e;
    au.uDir.value = sim.seg === 0 ? -1 : sim.seg === 3 ? 1 : 0;
    au.uIntro.value = sim.intro;
    au.uHead.value = sim.head;
    au.uPulse.value = pulse ? 1 : 0;

    // polymerase ring clamps on at the split point
    this.ring.visible = w1 > 0.001;
    if (this.ring.visible) {
      sim.ringPose(this.ringPos, this.ringQuat);
      this.ring.position.copy(this.ringPos);
      this.ring.quaternion.copy(this.ringQuat);
      const e = smooth(w1);
      const radial = 1.4 - 0.4 * e;
      this.ring.scale.set(radial, 0.6 + 0.4 * e, radial);
    }

    // cell shells
    const w2 = smooth(sim.weight(2, 2));
    for (let i = 0; i < this.shells.length; i++) {
      this.shells[i].visible = w2 > 0;
      this.shellMats[i].uniforms.uAlpha.value = w2 * (this.shellMats[i].userData.alpha as number);
    }

    this.layout(state, fd);
    this.inner.rotation.y = sim.spin;
    this.dolly(state, calm ? 0 : smooth(fd) * (1 - smooth((fd - 1) / 0.6)));

    // halo size: world size -> pixels at unit depth
    const cam = state.camera as THREE.PerspectiveCamera;
    const pxPerUnit = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5));
    this.haloMat.uniforms.uPx.value = pxPerUnit * 1.15 * this.root.scale.x;

    // read scan on the slide, at the polymerase ring (sequencing chapter)
    this.backMat.uniforms.uScan.value = smooth(w1);
    this.backMat.uniforms.uScanY.value = (sim.split - 0.5) * FORK_HEIGHT * Math.cos(this.lean.rotation.z);

    return settling || introRunning || dragging || (!calm && scrollState.opacity > 0 && !document.hidden);
  }

  /**
   * Landscape: the slide and the molecule sit in the right half. Portrait: in the hero the helix lies diagonally
   * across a wide slide on the hero visual (above the copy), then rises upright above the service cards.
   * Also sizes and tints the specimen window for the current form.
   */
  private layout(state: RootState, fd: number) {
    const outer = this.root;
    const vw = state.viewport.width;
    const vh = state.viewport.height;
    const portrait = vw < vh * 0.9 || state.size.width < 900; // matches the CSS breakpoint
    const k = smooth(clamp01(fd));

    // form blend for the window size and tint
    const f4 = Math.min(4, Math.max(0, fd));
    const seg = Math.min(3, Math.floor(f4));
    const fk = smooth((f4 - seg - 0.18) / 0.64);
    const a = WINDOW[seg];
    const b = WINDOW[seg + 1];
    let hw = a[0] + (b[0] - a[0]) * fk;
    let hh = a[1] + (b[1] - a[1]) * fk;
    const u = this.backMat.uniforms;
    (u.uCore.value as THREE.Color).lerpColors(TINT[seg][0], TINT[seg + 1][0], fk);
    (u.uEdge.value as THREE.Color).lerpColors(TINT[seg][1], TINT[seg + 1][1], fk);
    (u.uLight.value as THREE.Color).lerpColors(TINT_LIGHT[seg], TINT_LIGHT[seg + 1], fk);

    let lean = -TILT * clamp01(Math.abs(fd - 2.5) - 0.5); // the strand forms lean; cell and plasmid sit upright
    let scale: number;
    if (portrait) {
      const upright = Math.min(0.92, vw / 6.4);
      const boxH = ((scrollState.heroH || window.innerHeight * 0.36) / window.innerHeight) * vh;
      // hero: the helix lies along the diagonal of the hero visual box
      const diag = Math.hypot(vw * 0.94, boxH * 0.92);
      const heroScale = Math.min(0.56, diag / 9.4);
      const screenY = (scrollState.heroY || window.innerHeight * 0.3) - window.scrollY;
      const heroWorldY = (0.5 - screenY / window.innerHeight) * vh;
      outer.position.set(0, heroWorldY + (0.17 * vh - heroWorldY) * k, 0);
      scale = heroScale + (upright - heroScale) * k;
      const angle = Math.PI / 2 - Math.atan2(boxH * 0.92, vw * 0.94);
      lean = angle * (1 - k) + lean * k;
      // window: the hero box, then the form's own window (never wider than the screen)
      const heroHW = (vw * 0.47) / scale;
      const heroHH = (boxH * 0.47) / scale;
      hw = Math.min(heroHW + (hw - heroHW) * k, (vw * 0.48) / scale);
      hh = heroHH + (hh - heroHH) * k;
    } else {
      // a little below centre: the fixed header covers the top of the viewport
      outer.position.set(Math.min(vw * 0.23, 4.3), -0.035 * vh, 0);
      scale = Math.min(1.0, vh / 9.0);
      hh = Math.min(hh, (vh * 0.43) / scale);
    }
    outer.scale.setScalar(scale);
    this.lean.rotation.z = lean;

    // the slide sits behind the molecule: grow it by the perspective factor so it reads at the size set here
    const camZ = state.camera.position.z;
    const pf = (camZ - this.back.position.z * scale) / camZ;
    const margin = 0.9;
    this.back.scale.set((hw * 2 + margin * 2) * pf, (hh * 2 + margin * 2) * pf, 1);
    (u.uQuad.value as THREE.Vector2).set(hw * 2 + margin * 2, hh * 2 + margin * 2);
    (u.uHalf.value as THREE.Vector2).set(hw, hh);
  }

  /** Dolly zoom: the camera moves in while the fov widens, keeping the molecule plane the same size. */
  private dolly(state: RootState, w: number) {
    const cam = state.camera as THREE.PerspectiveCamera;
    const z = 12 - 3.3 * w;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(DOLLY_K / z));
    if (Math.abs(cam.fov - fov) < 1e-3) return;
    cam.fov = fov;
    cam.position.z = z;
    cam.updateProjectionMatrix();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.spheres.dispose();
    this.rungs.dispose();
    this.tips.dispose();
  }
}
