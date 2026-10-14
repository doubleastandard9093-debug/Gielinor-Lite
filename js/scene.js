import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function createScene() {
  const scene = new THREE.Scene();
  // Fog matches the sky's horizon colour so distant land fades into the sky dome.
  scene.background = new THREE.Color(0xbfdcf0);
  scene.fog = new THREE.FogExp2(0xbfdcf0, 0.0064);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 520);
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
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'game';
  return renderer;
}

export function createLights(scene) {
  // Soft sky/ground bounce light: cool blue from above, warm green-brown from below.
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6a5a34, 1.15);
  scene.add(hemi);

  // Warm golden sun (matches the sun in the sky dome).
  const dirLight = new THREE.DirectionalLight(0xffdcae, 2.7);
  dirLight.position.set(22, 25, 17);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const c = dirLight.shadow.camera;
  c.left = -34; c.right = 34; c.top = 34; c.bottom = -34; c.near = 1; c.far = 120;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.normalBias = 0.03;
  dirLight.shadow.radius = 3;
  scene.add(dirLight);
  scene.add(dirLight.target);

  // Cool fill from the opposite side keeps shadowed faces readable.
  const fill = new THREE.DirectionalLight(0x9ab8ff, 0.45);
  fill.position.set(-18, 14, -14);
  scene.add(fill);

  return { hemi, dirLight, fill };
}

export function followLight(dirLight, x, z) {
  // Same direction as the sky's sun (0.55, 0.62, 0.42).
  dirLight.position.set(x + 33, 37.2, z + 25.2);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on) {
  dirLight.castShadow = on;
}
