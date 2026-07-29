import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// To use your own Blender export: put a .glb file in an /assets
// folder next to index.html and set MODEL_URL to its path.
// Example: const MODEL_URL = 'assets/my-character.glb';
const MODEL_URL = null; // null => use the built-in placeholder shape

export default function initHero(canvas, prefersReducedMotion) {
  const heroSection = document.querySelector('.hero');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x12141b, 0.028);

  const camera = new THREE.PerspectiveCamera(
    45, heroSection.clientWidth / heroSection.clientHeight, 0.1, 100
  );
  camera.position.set(4.5, 2.6, 6.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(heroSection.clientWidth, heroSection.clientHeight);
  renderer.setClearColor(0x000000, 0);

  // Lighting: a warm key + cool rim, matching the amber/blue accents
  const keyLight = new THREE.DirectionalLight(0xffb454, 2.2);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x4c9eff, 1.4);
  rimLight.position.set(-6, 3, -4);
  scene.add(rimLight);

  const ambient = new THREE.AmbientLight(0x2a2f3b, 1.1);
  scene.add(ambient);

  // Grid floor, styled to match the panel palette
  const grid = new THREE.GridHelper(24, 24, 0x2a2f3b, 0x1c2029);
  grid.position.y = -1.4;
  scene.add(grid);

  // Group that holds either the loaded model or the placeholder
  const heroGroup = new THREE.Group();
  scene.add(heroGroup);

  function buildPlaceholder() {
    // A stand-in "game asset": a faceted low-poly icosahedron core
    // with an orbiting wireframe shell, referencing the axis colors.
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0x1c2029,
        metalness: 0.35,
        roughness: 0.35,
        flatShading: true,
      })
    );
    heroGroup.add(core);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 1),
      new THREE.MeshBasicMaterial({
        color: 0x4c9eff,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      })
    );
    heroGroup.add(shell);

    // three small axis-colored markers orbiting the shape
    const markerGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const colors = [0xff5c6c, 0x57d687, 0x4c9eff];
    const markers = colors.map((c) => {
      const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: c }));
      heroGroup.add(m);
      return m;
    });

    return { core, shell, markers };
  }

  let placeholderParts = null;

  if (MODEL_URL) {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 2.4 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(center);
        heroGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn('Could not load MODEL_URL, falling back to placeholder.', err);
        placeholderParts = buildPlaceholder();
      }
    );
  } else {
    placeholderParts = buildPlaceholder();
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = !prefersReducedMotion;
  controls.autoRotateSpeed = 0.6;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI / 3.2;
  controls.maxPolarAngle = Math.PI / 1.9;
  controls.target.set(0, 0.2, 0);

  function onResize() {
    const w = heroSection.clientWidth;
    const h = heroSection.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // FPS readout for HUD flavor
  const fpsEl = document.getElementById('fps-readout');
  let frames = 0, lastFpsTime = performance.now();

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (placeholderParts) {
      placeholderParts.core.rotation.y = t * 0.25;
      placeholderParts.shell.rotation.y = -t * 0.15;
      placeholderParts.shell.rotation.x = t * 0.08;
      placeholderParts.markers.forEach((m, i) => {
        const angle = t * 0.6 + (i * Math.PI * 2) / 3;
        m.position.set(Math.cos(angle) * 2.1, Math.sin(t * 0.8 + i) * 0.4, Math.sin(angle) * 2.1);
      });
    }

    controls.update();
    renderer.render(scene, camera);

    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fpsEl.textContent = Math.round((frames * 1000) / (now - lastFpsTime));
      frames = 0;
      lastFpsTime = now;
    }
  }
  animate();
}
