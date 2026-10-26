// PNW drizzle (High only, WebGL build): fine wind-slanted streaks in a box that wraps around the camera, animated in
// the vertex shader, plus a WET level the terrain uses to darken and lower roughness on upward-facing ground.
// Nothing here is created until the first High frame; Low keeps WET at 0 and never builds the streaks.
// Spells alternate (drizzle 60-150 s, dry 120-300 s); ?weather=drizzle|clear forces one.
import * as THREE from 'three';
export const WET = { value: 0 };
const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('weather') : null;
let mesh = null, mat = null, k = forced === 'drizzle' ? 1 : 0, raining = forced === 'drizzle', timer = 45 + Math.random() * 60, t = 0;
const N = 2600, BOX = 36, H = 22;
function build(scene) {
  const pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - 0.5) * BOX, z = (Math.random() - 0.5) * BOX, y = Math.random() * H;
    pos.set([x, y, z, x, y, z], i * 6);
  }
  const s2 = new Float32Array(N * 2); for (let i = 0; i < N; i++) { const r = Math.random(); s2[i * 2] = r; s2[i * 2 + 1] = r; }
  const end = new Float32Array(N * 2); for (let i = 0; i < N; i++) end[i * 2 + 1] = 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s2, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uK: { value: 0 } },
    vertexShader: `attribute float aSeed; attribute float aEnd; uniform float uT, uK; uniform vec3 uC; varying float vA;
      void main() {
        vec3 p = position; float sp = 5.5 + aSeed * 2.0;
        p.y = mod(p.y - uT * sp, ${H.toFixed(1)});
        p.xz = mod(p.xz - uC.xz + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uC.xz;
        p.y += uC.y - 6.0;
        p += aEnd * vec3(0.06, 0.32, 0.03);   // short streak, slanted by the onshore breeze
        vA = step(aSeed, uK) * 0.32 * (1.0 - smoothstep(14.0, 18.0, length(p.xz - uC.xz)));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vA; void main() { if (vA < 0.01) discard; gl_FragColor = vec4(0.78, 0.82, 0.86, vA); }`,
  });
  mesh = new THREE.LineSegments(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'drizzle';
  scene.add(mesh);
}
export function updateDrizzle(scene, camera, dt, quality, indoors) {
  const high = quality !== 'low';
  if (!high) { WET.value = 0; if (mesh) mesh.visible = false; return; }
  if (!mesh) build(scene);
  dt = Math.min(0.1, Math.max(0, dt || 0)); t += dt;
  if (forced === 'drizzle' || forced === 'clear') raining = forced === 'drizzle';
  else if ((timer -= dt) <= 0) { raining = !raining; timer = raining ? 60 + Math.random() * 90 : 120 + Math.random() * 180; }
  const want = raining && !indoors ? 1 : 0;
  k += (want - k) * Math.min(1, dt * 0.3);
  if (forced) k = want;
  WET.value += ((raining ? 1 : 0) - WET.value) * Math.min(1, dt * (raining ? 0.05 : 0.02));   // ground wets slowly, dries slower
  if (forced) WET.value = raining ? 1 : 0;
  mat.uniforms.uT.value = t; mat.uniforms.uK.value = k; mat.uniforms.uC.value.copy(camera.position);
  mesh.visible = k > 0.01;
}
