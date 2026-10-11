import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  // Richer sky gradient feel via fog + background
  scene.background = new THREE.Color(0x5a9ad0);
  scene.fog = new THREE.FogExp2(0x5a9ad0, 0.0085);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 18, 14);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  // Stronger ambient from sky
  const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x1e2a12, 0.55);
  scene.add(hemi);

  // Main sun
  const dirLight = new THREE.DirectionalLight(0xfff6e0, 1.55);
  dirLight.position.set(18, 32, 14);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const c = dirLight.shadow.camera;
  c.left = -32; c.right = 32; c.top = 32; c.bottom = -32; c.near = 1; c.far = 110;
  dirLight.shadow.bias = -0.00015;
  dirLight.shadow.radius = 2.5;
  scene.add(dirLight);
  scene.add(dirLight.target);

  // Cool fill from opposite side
  const fill = new THREE.DirectionalLight(0xa0c0ff, 0.45);
  fill.position.set(-14, 14, -10);
  scene.add(fill);

  // Subtle rim
  const rim = new THREE.DirectionalLight(0xffe0c0, 0.2);
  rim.position.set(0, 8, -20);
  scene.add(rim);

  return { hemi, dirLight };
}

export function followLight(dirLight, x, z) {
  dirLight.position.set(x + 18, 32, z + 14);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  dirLight.castShadow = on;
}
