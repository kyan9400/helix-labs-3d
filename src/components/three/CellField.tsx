"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll-state";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";

/*
 * "Cell" particle field: each point is drawn as a soft cell (membrane ring + off-centre nucleus).
 * Drift happens in the vertex shader from a single time uniform, so the CPU does nothing per particle.
 */

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    p.x += sin(uTime * 0.21 + s) * 0.35;
    p.y += cos(uTime * 0.17 + s * 1.3) * 0.45;
    p.z += sin(uTime * 0.13 + s * 0.7) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (11.0 / -mv.z);
    vColor = aColor;
    vSeed = aSeed;
    vAlpha = clamp(1.0 - (-mv.z - 8.0) / 14.0, 0.15, 1.0);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float ring = smoothstep(0.72, 0.84, d) * (1.0 - smoothstep(0.9, 1.0, d));
    float body = (1.0 - smoothstep(0.0, 0.92, d)) * 0.22;
    vec2 off = vec2(cos(vSeed * 40.0), sin(vSeed * 40.0)) * 0.12;
    float nucleus = 1.0 - smoothstep(0.16, 0.24, length(uv - off));
    float a = (ring * 0.6 + body + nucleus * 0.55) * vAlpha * 0.75;
    gl_FragColor = vec4(vColor, a);
  }
`;

const PALETTE = ["#1E9C8F", "#D9472F", "#3F51C9", "#7FB8AE", "#E9A23B"];

export function buildCellGeometry(count: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const c = new THREE.Color();
  let r = 12345;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 22;
    pos[i * 3 + 1] = (rand() - 0.5) * 16;
    pos[i * 3 + 2] = -10 + rand() * 12;
    const big = rand() > 0.92;
    size[i] = big ? 10 + rand() * 12 : 2.5 + rand() * 5;
    seed[i] = rand();
    c.set(PALETTE[Math.floor(rand() * PALETTE.length)]);
    color[i * 3] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -4), 18);
  return g;
}

export default function CellField({ geometry }: { geometry: THREE.BufferGeometry }) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const reduced = useRef(true);
  const clock = useRef(0);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);

  useEffect(() => {
    reduced.current = isReducedMotion();
    return subscribeMotion(() => {
      reduced.current = isReducedMotion();
    });
  }, []);

  useFrame((state, delta) => {
    const m = material.current;
    if (!m || !group.current) return;
    if (!reduced.current) clock.current += Math.min(delta, 0.05);
    m.uniforms.uTime.value = clock.current;
    m.uniforms.uPixelRatio.value = state.viewport.dpr;
    // gentle parallax with the scroll position (none in reduced motion)
    group.current.position.y = reduced.current ? 0 : scrollState.f * 0.45;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false} renderOrder={-1}>
        <shaderMaterial
          ref={material}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
}
