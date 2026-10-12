import * as THREE from "three";
import type { RootState } from "@react-three/fiber";
import { Backbone } from "./Backbone";
import { FORK_SPLIT } from "./forms";
import { HelixSim, STRAND_COLORS, TUBE_R } from "./HelixSim";
import type { TierSettings } from "@/lib/tiers";
import { scrollState } from "@/lib/scroll-state";

/*
 * The whole molecule as a plain three.js object graph (R3F mounts `root` as a primitive).
 *   root (layout: position, scale, lean)
 *     specimen shadow (soft ellipse behind, sized to the current form)
 *     inner (spin)
 *       2 backbone tubes, phosphate beads, half-rungs + rounded tips (read light), polymerase ring, cell shells
 * frame() runs everything for one rendered frame and says whether another frame is needed. No per-frame allocation.
 */

const TILT = 0.3;
const SPIN = 0.22;
const INTRO_S = 1.8;
const ENV_MIN = 0.15;
const ENV_MAX = 0.9;
// z·tan(fov/2) stays at this value during the dolly zoom, so the molecule plane keeps its size
const DOLLY_K = 12 * Math.tan(THREE.MathUtils.degToRad(17.5));
// [w, h] of each form in molecule space, for the shadow (helix, fork, cell, plasmid, helix)
const EXTENT = [
  [3.4, 8.6],
  [5.4, 8.8],
  [5.6, 5.6],
  [6.4, 5.8],
  [3.8, 9.0],
];

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function smooth(x: number) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/** Adds a per-instance emissive "read light": totalEmissiveRadiance += instance colour * aGlow * 1.6. */
function withGlow<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vGlow * 1.6;\n#endif",
      );
  };
  mat.customProgramCacheKey = () => "helix-glow";
  return mat;
}

const SHADOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// soft ellipse in ink; it reaches 0 before the quad edge, so the edge never shows
const SHADOW_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length((vUv - 0.5) * 2.0);
    float a = 1.0 - smoothstep(0.0, 1.0, r);
    gl_FragColor = vec4(0.063, 0.125, 0.122, a * a * 0.14 * uOpacity);
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
  private readonly inner = new THREE.Group();
  private readonly backbone: Backbone;
  private readonly spheres: THREE.InstancedMesh;
  private readonly rungs: THREE.InstancedMesh;
  private readonly tips: THREE.InstancedMesh;
  private readonly ring = new THREE.Group();
  private readonly shells: THREE.Mesh[] = [];
  private readonly shellMats: THREE.ShaderMaterial[] = [];
  private readonly shadow: THREE.Mesh;
  private readonly shadowMat: THREE.ShaderMaterial;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly ringPos = new THREE.Vector3();
  private readonly ringQuat = new THREE.Quaternion();
  private pulsing = false;

  constructor(settings: TierSettings, calm: boolean) {
    this.settings = settings;
    const n = settings.pairs;
    const sim = new HelixSim(n);
    this.sim = sim;
    sim.fd = scrollState.f;
    sim.intro = calm ? 1 : 0;
    this.root.add(this.inner);

    // backbone tubes: lacquered ribbon (clearcoat + thin-film sheen on high)
    this.backbone = new Backbone(n, settings.tubeSteps, settings.tubeRadial, TUBE_R);
    this.disposables.push(this.backbone);
    STRAND_COLORS.forEach((color, s) => {
      const mat = settings.physical
        ? new THREE.MeshPhysicalMaterial({
            color,
            roughness: 0.22,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            ...(settings.iridescence
              ? { iridescence: 0.35, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 420] as [number, number] }
              : {}),
          })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.25 });
      const mesh = new THREE.Mesh(this.backbone.geometries[s], mat);
      mesh.frustumCulled = false;
      this.inner.add(mesh);
      this.disposables.push(mat);
    });

    // phosphate beads
    const seg = settings.segments;
    const beadGeo = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.66)));
    const beadMat = settings.physical
      ? new THREE.MeshPhysicalMaterial({ roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18 })
      : new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.05 });
    this.spheres = new THREE.InstancedMesh(beadGeo, beadMat, n * 2);

    // bases: open half-rungs + rounded tips, soft ceramic material with the read light
    const radial = settings.tubeRadial;
    const baseMat = withGlow(
      settings.physical
        ? new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ffffff") })
        : new THREE.MeshStandardMaterial({ roughness: 0.38 }),
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

    // polymerase ring: brushed metal clamp with a mint emissive read head inside
    const ringGeo = new THREE.LatheGeometry(roundedRectProfile(1.25, 0.09, 0.17, 0.05), 48);
    const ringMat = settings.physical
      ? new THREE.MeshPhysicalMaterial({ color: "#c9ccd1", metalness: 1, roughness: 0.32, anisotropy: 0.7, anisotropyRotation: 0 })
      : new THREE.MeshStandardMaterial({ color: "#c9ccd1", metalness: 1, roughness: 0.35 });
    const lipGeo = new THREE.LatheGeometry(circleProfile(1.25 - 0.09 - 0.012, 0.026), 48);
    const lipMat = new THREE.MeshStandardMaterial({
      color: "#9ED9C9",
      emissive: "#9ED9C9",
      emissiveIntensity: 1.2,
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
        [2.4, "#1E9C8F", 0.35],
        [1.5, "#3F51C9", 0.25],
      ];
      for (const [radius, color, alpha] of defs) {
        const mat = new THREE.ShaderMaterial({
          vertexShader: SHELL_VERT,
          fragmentShader: SHELL_FRAG,
          uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 } },
          transparent: true,
          depthWrite: false,
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

    // specimen shadow: the object floats just above the paper
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    this.shadowMat = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: { uOpacity: { value: calm ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.shadow.position.set(0.35, -0.45, -2.2);
    this.shadow.renderOrder = -0.5;
    this.shadow.frustumCulled = false;
    this.root.add(this.shadow);
    this.disposables.push(shadowGeo, this.shadowMat);

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

    // drag to rotate, with inertia
    let dragging = false;
    if (scrollState.dragV !== 0) {
      sim.spin += scrollState.dragV * dt;
      scrollState.dragV *= Math.exp(-dt * 3);
      if (Math.abs(scrollState.dragV) < 0.001) scrollState.dragV = 0;
      dragging = true;
    }

    // intro: assemble once the canvas is revealed; lights come up with it
    const ready = document.documentElement.dataset.stage === "ready";
    if (calm) sim.intro = 1;
    else if (ready && sim.intro < 1) sim.intro = Math.min(1, sim.intro + dt / INTRO_S);
    const introRunning = ready && sim.intro < 1;
    const introE = smooth(sim.intro);
    state.scene.environmentIntensity = ENV_MIN + (ENV_MAX - ENV_MIN) * introE;
    this.shadowMat.uniforms.uOpacity.value = introE;

    // live zipper: the split point slides down while the Sequencing chapter scrolls by
    sim.setSplit(calm ? FORK_SPLIT : 0.72 - 0.4 * clamp01((fd - 0.82) / 0.36));
    const w1 = sim.weight(1, 2.2);

    const pulse = this.settings.pulse && !calm && sim.intro >= 1;
    if (this.pulsing && !pulse) sim.resetGlow(this.rungs, this.tips);
    this.pulsing = pulse;
    this.write(pulse, w1);

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

    // shadow follows the current form's extent
    const f4 = Math.min(4, Math.max(0, fd));
    const seg = Math.min(3, Math.floor(f4));
    const k = smooth((f4 - seg - 0.18) / 0.64);
    const a = EXTENT[seg];
    const b = EXTENT[seg + 1];
    this.shadow.scale.set((a[0] + (b[0] - a[0]) * k) * 1.5, (a[1] + (b[1] - a[1]) * k) * 1.5, 1);

    this.layout(state, fd);
    this.inner.rotation.y = sim.spin;
    this.dolly(state, calm ? 0 : smooth(fd) * (1 - smooth((fd - 1) / 0.6)));

    return settling || introRunning || dragging || (!calm && scrollState.opacity > 0 && !document.hidden);
  }

  /** Right half on landscape screens; centred (below the hero copy, above the cards) on portrait. */
  private layout(state: RootState, fd: number) {
    const outer = this.root;
    const vw = state.viewport.width;
    const vh = state.viewport.height;
    const portrait = vw < vh * 0.9 || state.size.width < 900; // matches the CSS breakpoint
    const hero = clamp01(fd);
    if (portrait) {
      // hero: sit on the hero visual (below the copy) and scroll with it; then rise above the service cards
      const scale = Math.min(0.92, vw / 5.8);
      const heroScale = Math.min(scale, (0.5 * vh) / 7.2);
      const screenY = (scrollState.heroY || window.innerHeight * 0.7) - window.scrollY;
      const heroWorldY = (0.5 - screenY / window.innerHeight) * vh;
      const k = hero * hero * (3 - 2 * hero);
      outer.position.set(0, heroWorldY + (0.17 * vh - heroWorldY) * k, 0);
      outer.scale.setScalar(heroScale + (scale - heroScale) * k);
    } else {
      outer.position.set(Math.min(vw * 0.25, 4.6), 0, 0);
      outer.scale.setScalar(Math.min(1.05, vh / 8.6));
    }
    // the strand forms lean; the cell and the plasmid ring sit upright
    outer.rotation.z = -TILT * clamp01(Math.abs(fd - 2.5) - 0.5);
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

