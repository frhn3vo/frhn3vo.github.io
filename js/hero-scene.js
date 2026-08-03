import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// OOP REFACTOR — see the chat for the "why" behind this shape.
// Three classes, each owning one concern:
//   HeroObject    — the central placeholder shape (or your .glb)
//   CameraRig     — camera + OrbitControls + the view-to-view tween
//   HeroScene     — orchestrator: owns the renderer/scene/lights,
//                   builds the two classes above, runs the loop
//
// Plain functions/constants (easeInOutCubic, CAMERA_PRESETS) stay as
// plain functions/constants — they don't belong to any single object,
// so wrapping them in a class would just be ceremony with no benefit.
// Not everything needs to be a class.
// ============================================================

// To use your own Blender export: put a .glb file in an /assets
// folder next to index.html and set MODEL_URL to its path.
// Example: const MODEL_URL = 'assets/my-character.glb';
const MODEL_URL = null; // null => use the built-in placeholder shape

// Camera "poses" per view — this is the Tekken-menu part: instead of
// reloading, the same camera just glides to a different spot and looks
// at a different point when you switch views. Edit these to taste.
const CAMERA_PRESETS = {
  home:     { pos: [4.5, 2.6, 6.5],  target: [0, 0.2, 0], autoRotate: true,  rotateSpeed: 0.6,  interactive: true  },
  projects: { pos: [1.8, 1.0, 7.6],  target: [0, 0.1, 0], autoRotate: true,  rotateSpeed: 0.18, interactive: false },
  resume:   { pos: [-3.2, 3.1, 5.4], target: [0, 0.4, 0], autoRotate: true,  rotateSpeed: 0.12, interactive: false },
  contact:  { pos: [0.2, 4.4, 4.2],  target: [0, 0, 0],   autoRotate: false, rotateSpeed: 0,    interactive: false },
};
const TWEEN_MS = 1200;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------
// The central object: either your loaded .glb, or (by default, and
// as a fallback if loading fails) a low-poly placeholder shape.
// ---------------------------------------------------------------
class HeroObject {
  constructor(group, modelUrl) {
    this.group = group;
    this.core = null;
    this.shell = null;

    if (modelUrl) {
      this._loadModel(modelUrl);
    } else {
      this._buildPlaceholder();
    }
  }

  _buildPlaceholder() {
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.3,
        roughness: 0.4,
        flatShading: true,
      })
    );
    this.group.add(this.core);

    this.shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      })
    );
    this.group.add(this.shell);
  }

  _loadModel(url) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 2.4 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(center);
        this.group.add(model);
      },
      undefined,
      (err) => {
        console.warn('Could not load MODEL_URL, falling back to placeholder.', err);
        this._buildPlaceholder();
      }
    );
  }

  update(t) {
    if (!this.core) return; // either still loading, or a real model (which doesn't self-rotate)
    this.core.rotation.y = t * 0.25;
    this.shell.rotation.y = -t * 0.15;
    this.shell.rotation.x = t * 0.08;
  }
}

// ---------------------------------------------------------------
// Camera + OrbitControls + the tween that glides between views.
// ---------------------------------------------------------------
class CameraRig {
  constructor(camera, domElement, prefersReducedMotion) {
    this.camera = camera;
    this.prefersReducedMotion = prefersReducedMotion;
    this.tween = null; // { startPos, endPos, startTarget, endTarget, startTime }

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = !prefersReducedMotion;
    this.controls.autoRotateSpeed = CAMERA_PRESETS.home.rotateSpeed;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableRotate = CAMERA_PRESETS.home.interactive;
    this.controls.minPolarAngle = Math.PI / 3.2;
    this.controls.maxPolarAngle = Math.PI / 1.9;
    this.controls.target.set(...CAMERA_PRESETS.home.target);

    this.camera.position.set(...CAMERA_PRESETS.home.pos);
  }

  // Starts gliding to the named view's preset and returns that preset,
  // in case the caller (HeroScene) ever wants to react to it too.
  setView(viewName) {
    const preset = CAMERA_PRESETS[viewName] || CAMERA_PRESETS.home;
    this.tween = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(...preset.pos),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...preset.target),
      startTime: performance.now(),
    };
    this.controls.autoRotate = !this.prefersReducedMotion && preset.autoRotate;
    this.controls.autoRotateSpeed = preset.rotateSpeed;
    this.controls.enableRotate = preset.interactive;
    return preset;
  }

  tick() {
    if (this.tween) {
      const elapsed = performance.now() - this.tween.startTime;
      const raw = Math.min(elapsed / TWEEN_MS, 1);
      const eased = this.prefersReducedMotion ? 1 : easeInOutCubic(raw);
      this.camera.position.lerpVectors(this.tween.startPos, this.tween.endPos, eased);
      this.controls.target.lerpVectors(this.tween.startTarget, this.tween.endTarget, eased);
      if (raw >= 1) this.tween = null;
    }
    this.controls.update();
  }
}

// ---------------------------------------------------------------
// Orchestrator: owns the renderer/scene/lights, builds the three
// classes above, and runs the render loop.
// ---------------------------------------------------------------
class HeroScene {
  constructor(canvas, prefersReducedMotion) {
    this.prefersReducedMotion = prefersReducedMotion;
    this.clock = new THREE.Clock();
    this.frames = 0;
    this.lastFpsTime = performance.now();
    this.fpsEl = document.getElementById('fps-readout');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.028);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    this._setupLights();

    this.heroGroup = new THREE.Group();
    this.scene.add(this.heroGroup);

    this.heroObject = new HeroObject(this.heroGroup, MODEL_URL);
    this.cameraRig = new CameraRig(this.camera, canvas, prefersReducedMotion);

    window.addEventListener('resize', () => this._onResize());

    requestAnimationFrame(this._animate);
  }

  _setupLights() {
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 6, 4);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xcfcfcf, 1.4);
    rimLight.position.set(-6, 3, -4);
    this.scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0x2a2a2a, 1.1);
    this.scene.add(ambient);

    const grid = new THREE.GridHelper(24, 24, 0x2e2e2e, 0x181818);
    grid.position.y = -1.4;
    this.scene.add(grid);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setView(viewName) {
    this.cameraRig.setView(viewName);
  }

  // Arrow function class field — locks `this` to the instance
  // permanently, which matters because requestAnimationFrame calls
  // this function on its own, detached from the object (the exact
  // gotcha from the OOP explanation earlier in chat).
  _animate = () => {
    requestAnimationFrame(this._animate);
    const t = this.clock.getElapsedTime();

    this.heroObject.update(t);
    this.cameraRig.tick();

    this.renderer.render(this.scene, this.camera);

    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      if (this.fpsEl) this.fpsEl.textContent = Math.round((this.frames * 1000) / (now - this.lastFpsTime));
      this.frames = 0;
      this.lastFpsTime = now;
    }
  };
}

// Public API stays identical to the pre-refactor version — spa.js
// doesn't need to change at all.
export default function initHero(canvas, prefersReducedMotion) {
  const heroScene = new HeroScene(canvas, prefersReducedMotion);
  return { setView: (viewName) => heroScene.setView(viewName) };
}
