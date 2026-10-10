import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec9ef);
  scene.fog = new THREE.Fog(0x8ec9ef, 35, 85);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 18, 14);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a2a, 0.75);
  scene.add(hemi);
  const dirLight = new THREE.DirectionalLight(0xfff2d8, 1.0);
  dirLight.position.set(12, 24, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  const c = dirLight.shadow.camera;
  c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 70;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
  scene.add(dirLight.target);
  return { hemi, dirLight };
}

// Keep the shadow area centred on the player so shadows work anywhere on the map.
export function followLight(dirLight, x, z) {
  dirLight.position.set(x + 12, 24, z + 8);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  // The shadow map stays enabled; turning the light's shadow off skips the extra pass.
  dirLight.castShadow = on;
}
