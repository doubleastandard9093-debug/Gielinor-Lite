// WebGPU release: scene, camera, renderer and lights. WebGPURenderer picks WebGPU when the browser has it and
// falls back to its WebGL2 backend otherwise. Height fog and soft shadows are done with nodes instead of GLSL chunk patches.
import * as THREE from 'three';
import { fog, color, positionWorld, positionView, uniform, exp, max, float } from 'three/tsl';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
export const BACKEND = { name: 'pending', forced: null };

// Height fog: thicker in valleys, thinning with altitude (same curve as the WebGL game).
export const FOG = { color: uniform(new THREE.Color(0xbfdcf0)), density: uniform(0.0064) };
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdcf0);
  // keep a FogExp2 object so shared code (scene.fog.color.copy(...)) keeps working; the node below does the real fog
  scene.fog = new THREE.FogExp2(0xbfdcf0, 0.0064);
  FOG.color.value = scene.fog.color;
  const fogH = float(0.7).add(exp(max(positionWorld.y.add(1.0), 0.0).mul(-0.08)).mul(0.55));
  const d = FOG.density.mul(fogH), z = positionView.z.negate();
  scene.fogNode = fog(FOG.color, float(1).sub(exp(d.mul(d).mul(z).mul(z).negate())));
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 520);
  camera.position.set(0, 16, 12);
  return camera;
}

export async function createRenderer() {
  const q = new URLSearchParams(location.search);
  const forceWebGL = q.get('backend') === 'webgl' || !navigator.gpu;
  BACKEND.forced = q.get('backend');
  const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance', forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'game';
  await renderer.init();
  BACKEND.name = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6a5a34, 1.15);
  scene.add(hemi);
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
  const fill = new THREE.DirectionalLight(0x9ab8ff, 0.45);
  fill.position.set(-18, 14, -14);
  scene.add(fill);
  return { hemi, dirLight, fill };
}

// CSM (stage 4) swaps itself in via setCascades(); until then the single shadow follows the player like the WebGL game.
export const CASCADE = { csm: null };
export function followLight(dirLight, x, z, dir) {
  if (dir) dirLight.position.set(x + dir.x * 60, dir.y * 60, z + dir.z * 60);
  else dirLight.position.set(x + 33, 37.2, z + 25.2);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on, quality = 'high') {
  dirLight.castShadow = on;
  const size = quality === 'low' ? 1024 : 4096;
  if (!CASCADE.csm && dirLight.shadow.mapSize.x !== size) {
    dirLight.shadow.mapSize.set(size, size);
    if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; }
  }
  dirLight.shadow.normalBias = quality === 'low' ? 0.04 : 0.018;
  dirLight.shadow.bias = quality === 'low' ? -0.0004 : -0.00015;
  dirLight.shadow.radius = quality === 'low' ? 2 : 4;
  dirLight.shadow.blurSamples = quality === 'low' ? 8 : 16;
  // Ultra: 4096 px cascades (2048 on High), softer PCF and a longer shadow distance. Map sizes are read every shadow
  // render, so cascades resize in place.
  const csm = CASCADE.csm;
  if (csm) {
    const u = quality === 'ultra', cs = u ? 4096 : 2048;
    if (CASCADE.baseFar === undefined) CASCADE.baseFar = csm.maxFar;
    csm.maxFar = u ? 480 : CASCADE.baseFar;
    for (const l of (csm.lights || [])) {
      if (l.shadow.mapSize.x !== cs) l.shadow.mapSize.set(cs, cs);
      l.shadow.radius = u ? 5 : 4; l.shadow.blurSamples = u ? 24 : 16;
    }
    try { csm.updateFrustums && csm.camera && csm.updateFrustums(); } catch (e) { console.warn('[webgpu] CSM resize', e); }
  }
}
export function tuneLights(lights, quality) {
  lights.hemi.intensity = quality === 'low' ? 1.2 : 0.95;
  lights.hemi.groundColor.setHex(0x5a4a2c);
  lights.dirLight.intensity = quality === 'low' ? 2.6 : 3.0;
  lights.fill.intensity = quality === 'low' ? 0.4 : 0.55;
}
