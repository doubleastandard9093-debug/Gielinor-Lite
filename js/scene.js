import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7eb8e0);
  scene.fog = new THREE.Fog(0x7eb8e0, 40, 95);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
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
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x3a4a22, 0.85);
  scene.add(hemi);
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.15);
  dirLight.position.set(14, 26, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  const c = dirLight.shadow.camera;
  c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 80;
  dirLight.shadow.bias = -0.0003;
  dirLight.shadow.radius = 1.5;
  scene.add(dirLight);
  scene.add(dirLight.target);
  return { hemi, dirLight };
}

export function followLight(dirLight, x, z) {
  dirLight.position.set(x + 14, 26, z + 10);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  dirLight.castShadow = on;
}
