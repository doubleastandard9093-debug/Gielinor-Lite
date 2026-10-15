import * as THREE from 'three';

export const IS_TOUCH = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Height fog: patch three's fog chunks so fog is thicker in low ground and valleys and thins with altitude,
// letting peaks rise out of a ground mist. Applies to every material that uses fog.
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying float vFogWorldY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogWorldY = (inverse(viewMatrix) * mvPosition).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying float vFogWorldY;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogH = 0.7 + 0.55 * exp(-max(vFogWorldY + 1.0, 0.0) * 0.08);
  float fogD = fogDensity * fogH;
  float fogFactor = 1.0 - exp(- fogD * fogD * vFogDepth * vFogDepth);
 #else
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
 #endif
 gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

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

export function followLight(dirLight, x, z, dir) {
  // Along the sun (or moon) direction from the day cycle; defaults to the old fixed morning sun.
  if (dir) dirLight.position.set(x + dir.x * 60, dir.y * 60, z + dir.z * 60);
  else dirLight.position.set(x + 33, 37.2, z + 25.2);
  dirLight.target.position.set(x, 0, z);
}

export function setShadows(renderer, dirLight, on, quality = 'high') {
  dirLight.castShadow = on;
  // High: 4096 map, tighter bias and wider soft filter. Low keeps a small map.
  const size = quality === 'low' ? 1024 : 4096;
  if (dirLight.shadow.mapSize.x !== size) {
    dirLight.shadow.mapSize.set(size, size);
    if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; }
  }
  dirLight.shadow.normalBias = quality === 'low' ? 0.04 : 0.018;
  dirLight.shadow.bias = quality === 'low' ? -0.0004 : -0.00015;
  dirLight.shadow.radius = quality === 'low' ? 2 : 4;
  dirLight.shadow.blurSamples = quality === 'low' ? 8 : 16;
}
// Light balance: slightly less flat sky fill, a touch more sun for form-revealing shading.
export function tuneLights(lights, quality) {
  lights.hemi.intensity = quality === 'low' ? 1.2 : 0.95;
  lights.hemi.groundColor.setHex(0x5a4a2c);
  lights.dirLight.intensity = quality === 'low' ? 2.6 : 3.0;
  lights.fill.intensity = quality === 'low' ? 0.4 : 0.55;
}
