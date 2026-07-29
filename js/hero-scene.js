import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// To use your own Blender export: put a .glb file in an /assets
// folder next to index.html and set MODEL_URL to its path.
// Example: const MODEL_URL = 'assets/my-character.glb';
const MODEL_URL = null; // null => use the built-in placeholder shape

// Labels that orbit the central object, like little satellites —
// edit this list to match whatever you want floating around.
// Each gets its own orbit radius/speed/tilt so they don't move in lockstep.
const ORBIT_LABELS = [
  { text: 'C++',      radius: 3.1, speed: 0.34, phase: 0.0, tiltDeg: 8,  yOff: 0.4  },
  { text: 'C#',        radius: 3.6, speed: -0.26, phase: 1.4, tiltDeg: -14, yOff: -0.3 },
  { text: 'UNITY',     radius: 3.9, speed: 0.21, phase: 3.1, tiltDeg: 20, yOff: 0.9  },
  { text: 'THREE.JS',  radius: 3.4, speed: -0.3,  phase: 4.6, tiltDeg: -6,  yOff: -0.8 },
  { text: 'GODOT',     radius: 4.2, speed: 0.18, phase: 2.2, tiltDeg: 12, yOff: 0.1  },
];

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  const w = 320, h = 128;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const r = 22;
  const pad = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.arcTo(w - pad, pad, w - pad, h - pad, r);
  ctx.arcTo(w - pad, h - pad, pad, h - pad, r);
  ctx.arcTo(pad, h - pad, pad, pad, r);
  ctx.arcTo(pad, pad, w - pad, pad, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,10,0.55)';
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 44px "JetBrains Mono", Consolas, monospace';
  ctx.fillStyle = '#F4F4F2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return { texture, aspect: w / h };
}

function buildOrbitLabels(group) {
  return ORBIT_LABELS.map((cfg) => {
    const { texture, aspect } = makeLabelTexture(cfg.text);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    const sprite = new THREE.Sprite(material);
    const scale = 0.62;
    sprite.scale.set(scale * aspect, scale, 1);
    group.add(sprite);
    return { sprite, ...cfg, tilt: (cfg.tiltDeg * Math.PI) / 180 };
  });
}

export default function initHero(canvas, prefersReducedMotion) {
  const heroSection = document.querySelector('.hero');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.028);

  const camera = new THREE.PerspectiveCamera(
    45, heroSection.clientWidth / heroSection.clientHeight, 0.1, 100
  );
  camera.position.set(4.5, 2.6, 6.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(heroSection.clientWidth, heroSection.clientHeight);
  renderer.setClearColor(0x000000, 0);

  // Lighting: neutral white key + cool gray rim — no hue anywhere.
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xcfcfcf, 1.4);
  rimLight.position.set(-6, 3, -4);
  scene.add(rimLight);

  const ambient = new THREE.AmbientLight(0x2a2a2a, 1.1);
  scene.add(ambient);

  // Grid floor
  const grid = new THREE.GridHelper(24, 24, 0x2e2e2e, 0x181818);
  grid.position.y = -1.4;
  scene.add(grid);

  // Group that holds either the loaded model or the placeholder
  const heroGroup = new THREE.Group();
  scene.add(heroGroup);

  // Orbiting language/tool badges — always face the camera (THREE.Sprite
  // does this automatically) and drift around the central object.
  const orbitLabels = buildOrbitLabels(heroGroup);

  function buildPlaceholder() {
    // A stand-in "game asset": a faceted low-poly icosahedron core
    // with a wireframe shell, both rendered in grayscale.
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.3,
        roughness: 0.4,
        flatShading: true,
      })
    );
    heroGroup.add(core);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      })
    );
    heroGroup.add(shell);

    return { core, shell };
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
  const labelSpeedMul = prefersReducedMotion ? 0 : 1;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (placeholderParts) {
      placeholderParts.core.rotation.y = t * 0.25;
      placeholderParts.shell.rotation.y = -t * 0.15;
      placeholderParts.shell.rotation.x = t * 0.08;
    }

    orbitLabels.forEach((o) => {
      const angle = t * o.speed * labelSpeedMul + o.phase;
      const x = Math.cos(angle) * o.radius;
      const z = Math.sin(angle) * o.radius;
      // Tilt the orbit plane slightly so labels don't all sit on one ring
      const y = o.yOff + Math.sin(angle) * Math.sin(o.tilt) * 0.6;
      o.sprite.position.set(x, y, z);
    });

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
