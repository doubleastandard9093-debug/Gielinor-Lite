import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4d8fc4);
  scene.fog = new THREE.FogExp2(0x4d8fc4, 0.0065);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 16, 12);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xd8ecff, 0x182410, 0.45);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xfff8e8, 1.85);
  dirLight.position.set(22, 38, 18);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const c = dirLight.shadow.camera;
  c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 140;
  dirLight.shadow.bias = -0.00008;
  dirLight.shadow.radius = 3.5;
  scene.add(dirLight);
  scene.add(dirLight.target);

  const fill = new THREE.DirectionalLight(0x88b0ff, 0.55);
  fill.position.set(-18, 18, -14);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe0b0, 0.3);
  rim.position.set(4, 12, -28);
  scene.add(rim);

  return { hemi, dirLight };
}

export function followLight(dirLight, x, z) {
  dirLight.position.set(x + 22, 38, z + 18);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  dirLight.castShadow = on;
}
