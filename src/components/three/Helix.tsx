"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { HelixSim } from "./HelixSim";
import { scrollState } from "@/lib/scroll-state";
import type { TierSettings } from "@/lib/quality";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";

interface HelixProps {
  settings: TierSettings;
}

const TILT = 0.3;

export default function Helix({ settings }: HelixProps) {
  const n = settings.pairs;
  const seg = settings.segments;
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const spheres = useRef<THREE.InstancedMesh>(null);
  const rungs = useRef<THREE.InstancedMesh>(null);
  const links = useRef<THREE.InstancedMesh>(null);
  const sim = useRef<HelixSim | null>(null);
  const reduced = useRef(true);
  const pulsing = useRef(false);

  useEffect(() => {
    reduced.current = isReducedMotion();
    return subscribeMotion(() => {
      reduced.current = isReducedMotion();
    });
  }, []);

  useLayoutEffect(() => {
    const s = new HelixSim(n);
    s.fd = scrollState.f;
    sim.current = s;
    if (spheres.current && rungs.current && links.current) {
      s.paintStatic(spheres.current, rungs.current, links.current);
      s.update(spheres.current, rungs.current, links.current, false);
    }
  }, [n]);

  useFrame((state, delta) => {
    const s = sim.current;
    const sp = spheres.current;
    const ru = rungs.current;
    const li = links.current;
    if (!s || !sp || !ru || !li || !outer.current || !inner.current) return;

    const dt = Math.min(delta, 0.05);
    const calm = reduced.current;
    const target = calm ? Math.round(scrollState.f) : scrollState.f;

    if (calm) s.fd = target;
    else s.fd += (target - s.fd) * (1 - Math.exp(-dt * 7));
    const settling = Math.abs(target - s.fd) > 0.0006;
    if (!settling) s.fd = target;

    if (!calm) {
      s.time += dt;
      s.spin += dt * 0.22;
    }

    const pulse = settings.pulse && !calm;
    if (pulsing.current && !pulse) s.resetSphereColors(sp);
    pulsing.current = pulse;
    s.update(sp, ru, li, pulse);

    // layout: right half on landscape screens, centred (below the hero copy, above the cards) on portrait
    const vw = state.viewport.width;
    const vh = state.viewport.height;
    const portrait = vw < vh * 0.9 || state.size.width < 900; // matches the CSS breakpoint
    const hero = Math.min(1, Math.max(0, s.fd));
    if (portrait) {
      // hero: sit on the hero visual (below the copy) and scroll with it; then rise above the service cards
      const scale = Math.min(0.92, vw / 5.8);
      const heroScale = Math.min(scale, (0.5 * vh) / 7.2); // keep the hero helix inside the visual block
      const screenY = (scrollState.heroY || window.innerHeight * 0.7) - window.scrollY;
      const heroWorldY = (0.5 - screenY / window.innerHeight) * vh;
      const k = hero * hero * (3 - 2 * hero);
      outer.current.position.set(0, heroWorldY + (0.17 * vh - heroWorldY) * k, 0);
      outer.current.scale.setScalar(heroScale + (scale - heroScale) * k);
    } else {
      const scale = Math.min(1.05, vh / 8.6);
      outer.current.position.set(Math.min(vw * 0.25, 4.6), 0, 0);
      outer.current.scale.setScalar(scale);
    }
    // the strand forms lean; the cell and the plasmid ring sit upright
    outer.current.rotation.z = -TILT * Math.min(1, Math.max(0, Math.abs(s.fd - 2.5) - 0.5));
    inner.current.rotation.y = s.spin;

    if (settling || (!calm && scrollState.opacity > 0 && !document.hidden)) state.invalidate();
  });

  return (
    <group ref={outer}>
      <group ref={inner}>
        <instancedMesh ref={spheres} args={[undefined, undefined, n * 2]} frustumCulled={false}>
          <sphereGeometry args={[1, seg, Math.max(6, Math.round(seg * 0.66))]} />
          {settings.physical ? (
            <meshPhysicalMaterial roughness={0.28} metalness={0.05} clearcoat={1} clearcoatRoughness={0.18} />
          ) : (
            <meshStandardMaterial roughness={0.32} metalness={0.05} />
          )}
        </instancedMesh>
        <instancedMesh ref={rungs} args={[undefined, undefined, n * 2]} frustumCulled={false}>
          <cylinderGeometry args={[1, 1, 1, Math.max(6, Math.round(seg * 0.5)), 1, false]} />
          <meshStandardMaterial roughness={0.42} metalness={0} />
        </instancedMesh>
        <instancedMesh ref={links} args={[undefined, undefined, (n - 1) * 2]} frustumCulled={false}>
          <cylinderGeometry args={[1, 1, 1, Math.max(5, Math.round(seg * 0.4)), 1, true]} />
          <meshStandardMaterial roughness={0.5} metalness={0} />
        </instancedMesh>
      </group>
    </group>
  );
}
