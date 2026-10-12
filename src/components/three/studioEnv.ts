import * as THREE from "three";

/*
 * Studio lighting built in code and baked once into a PMREM environment map (no HDRI download):
 * a dark warm room, a big overhead softbox, a tall thin strip on the right (the long highlight down the backbone),
 * a small warm kicker low left and a faint paper-coloured floor bounce. Returns a cleanup.
 */

function card(w: number, h: number, color: string, intensity: number) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export function applyStudioEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene, intensity: number) {
  const studio = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(16, 12, 16),
    new THREE.MeshBasicMaterial({ color: "#2a2622", side: THREE.BackSide }),
  );
  studio.add(room);

  const softbox = card(6, 3, "#ffffff", 3);
  softbox.position.set(0, 5.5, 1);
  softbox.rotation.x = Math.PI / 2;
  studio.add(softbox);

  const strip = card(0.7, 7, "#dff3ec", 4);
  strip.position.set(6.5, 0.5, 1.5);
  strip.rotation.y = -Math.PI / 2;
  studio.add(strip);

  const kicker = card(1.6, 1.2, "#ffd9b0", 1.5);
  kicker.position.set(-5.5, -3, 3);
  kicker.lookAt(0, 0, 0);
  studio.add(kicker);

  const floor = card(10, 10, "#f4f1ea", 0.45);
  floor.position.set(0, -5.5, 0);
  floor.rotation.x = -Math.PI / 2;
  studio.add(floor);

  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(studio, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = intensity;

  studio.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();

  return () => {
    scene.environment = null;
    env.dispose();
  };
}
