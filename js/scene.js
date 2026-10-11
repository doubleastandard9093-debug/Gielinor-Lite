import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6aa8d8);
  scene.fog = new THREE.FogExp2(0x6aa8d8, 0.012);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 250);
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
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xeef6ff, 0x2a3a18, 0.7);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xfff8e8, 1.35);
  dirLight.position.set(16, 28, 12);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  const c = dirLight.shadow.camera;
  c.left = -28; c.right = 28; c.top = 28; c.bottom = -28; c.near = 1; c.far = 90;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.radius = 2;
  scene.add(dirLight);
  scene.add(dirLight.target);

  // Subtle fill light
  const fill = new THREE.DirectionalLight(0xb0c8ff, 0.35);
  fill.position.set(-10, 12, -8);
  scene.add(fill);

  return { hemi, dirLight };
}

export function followLight(dirLight, x, z) {
  dirLight.position.set(x + 16, 28, z + 12);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  dirLight.castShadow = on;
}
