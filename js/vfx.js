// Particle VFX and fire lighting: one GPU point-sprite system for flames, embers, smoke, hit sparks, magic bursts and
// dust, plus a small fixed pool of flickering point lights handed to the fires nearest the player.
// The light count never changes, so materials compile once. Low quality uses fewer particles and no smoke.
import * as THREE from 'three';

const MAX = 4000;
const pos = new Float32Array(MAX * 3), vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), dur = new Float32Array(MAX);
const aLife = new Float32Array(MAX), aSize = new Float32Array(MAX), aKind = new Float32Array(MAX), aSeed = new Float32Array(MAX);
let cursor = 0, quality = 'high', inited = false, points = null;
const FIRES = [];     // { obj, k, spawn, kind }
const LIGHTS = [];
const _v = new THREE.Vector3();
// kinds: 0 flame, 1 ember, 2 smoke, 3 spark, 4 magic, 5 dust
const KIND = { flame: 0, ember: 1, smoke: 2, spark: 3, magic: 4, dust: 5, leaf: 6, mote: 7 };
let LEAF_SRC = [];
export function setLeafSources(list) { LEAF_SRC = list; }

export function addFire(obj, k = 1, kind = 'fire') { const f = { obj, k, spawn: Math.random(), kind }; FIRES.push(f); return f; }
export function removeFireVfx(obj) { const i = FIRES.findIndex(f => f.obj === obj); if (i >= 0) FIRES.splice(i, 1); }
export function setVfxQuality(q) { quality = q; }

function emit(kind, x, y, z, vx, vy, vz, d, size) {
  const i = cursor; cursor = (cursor + 1) % MAX;
  pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
  life[i] = 0; dur[i] = d; aSize[i] = size; aKind[i] = kind; aSeed[i] = Math.random();
}
// one-off bursts: 'hit' sparks, 'magic' (with colour hue via kind), 'dust'
export function burst(type, x, y, z, n = 14, color = null) {
  if (!inited) return; const R = Math.random;
  const m = quality === 'low' ? 0.5 : 1;
  for (let i = 0; i < n * m; i++) {
    if (type === 'hit') emit(KIND.spark, x, y, z, (R() - 0.5) * 5, R() * 3.5 + 0.5, (R() - 0.5) * 5, 0.35 + R() * 0.3, 0.07 + R() * 0.05);
    else if (type === 'magic') { const a = R() * 6.283, s = 1.5 + R() * 2.5; emit(KIND.magic, x, y, z, Math.cos(a) * s, (R() - 0.3) * 2.5, Math.sin(a) * s, 0.5 + R() * 0.4, 0.18 + R() * 0.14); }
    else if (type === 'dust') { const a = R() * 6.283, s = 0.6 + R() * 0.9; emit(KIND.dust, x + Math.cos(a) * 0.2, y + 0.05, z + Math.sin(a) * 0.2, Math.cos(a) * s, 0.3 + R() * 0.5, Math.sin(a) * s, 0.8 + R() * 0.6, 0.35 + R() * 0.3); }
  }
}

export function initVfx(scene) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  for (let i = 0; i < MAX; i++) { aLife[i] = 1; pos[i * 3 + 1] = -999; }
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float aLife, aSize, aKind, aSeed; uniform float scale; varying float vL, vK, vS;
      void main(){ vL = aLife; vK = aKind; vS = aSeed; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float grow = vK < 0.5 ? (1.0 - vL * 0.7) : vK > 1.5 && vK < 2.5 ? (0.6 + vL * 2.2) : vK > 4.5 ? (0.7 + vL * 1.5) : (1.0 - vL * 0.5);
        gl_PointSize = aLife >= 1.0 ? 0.0 : aSize * grow * scale / -mv.z; }`,
    fragmentShader: `varying float vL, vK, vS;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
        float soft = 1.0 - smoothstep(0.2, 1.0, r); vec3 c; float a;
        if (vK < 0.5) { // flame: white-yellow core to orange to deep red as it rises and cools
          c = mix(vec3(1.0, 0.92, 0.6), vec3(1.0, 0.45, 0.08), smoothstep(0.0, 0.45, vL)); c = mix(c, vec3(0.6, 0.08, 0.02), smoothstep(0.45, 1.0, vL));
          c *= 2.4; a = soft * (1.0 - vL) * 0.8; }
        else if (vK < 1.5) { c = vec3(1.0, 0.6, 0.2) * 3.0 * (0.6 + 0.4 * sin(vL * 30.0 + vS * 20.0)); a = (1.0 - smoothstep(0.3, 1.0, r)) * (1.0 - vL); }
        else if (vK < 2.5) { c = vec3(0.32, 0.3, 0.29); a = soft * 0.28 * sin(vL * 3.1416); gl_FragColor = vec4(c * a, a); return; }
        else if (vK < 3.5) { c = vec3(1.0, 0.8, 0.45) * 3.0; a = (1.0 - smoothstep(0.2, 1.0, r)) * (1.0 - vL); }
        else if (vK < 4.5) { c = mix(vec3(0.5, 0.8, 1.0), vec3(0.8, 0.4, 1.0), vS) * 2.5; a = soft * (1.0 - vL); }
        else if (vK < 5.5) { c = vec3(0.62, 0.55, 0.42); a = soft * 0.35 * (1.0 - vL); gl_FragColor = vec4(c * a, a); return; }
        else if (vK < 6.5) { // leaf: a pointed oval that tumbles (squash with time), autumn-to-green palette by seed
          float tum = abs(sin(vL * 18.0 + vS * 30.0)); vec2 q = d * vec2(1.0 / max(0.25, tum), 1.0);
          float leaf = 1.0 - smoothstep(0.32, 0.4, length(q * vec2(1.6, 1.0))); if (leaf < 0.5) discard;
          c = mix(vec3(0.42, 0.55, 0.18), vec3(0.85, 0.55, 0.15), vS) * (0.7 + 0.3 * tum); a = 1.0 - smoothstep(0.85, 1.0, vL);
          gl_FragColor = vec4(c * a, a); return; }
        else { c = vec3(1.0, 0.95, 0.8) * 1.2; a = soft * 0.5 * sin(vL * 3.1416); }
        gl_FragColor = vec4(c * a, 0.0); }`,   // additive for glowing kinds (alpha 0 = pure add with premultiplied blend)
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  });
  points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
  for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xff9a40, 0, 9, 1.6); L.castShadow = false; scene.add(L); LIGHTS.push(L); }
  inited = true;
}

export function updateVfx(dt, px, pz, camera, now, night = 0, inCave = false) {
  if (!inited) return;
  const R = Math.random, hi = quality !== 'low', d = Math.min(dt, 0.05);
  points.material.uniforms.scale.value = window.innerHeight * 0.9;
  // spawn from fires near the player; rank by distance for the light pool
  const near = [];
  for (const f of FIRES) {
    if (!f.obj.parent || f.obj.visible === false) continue;
    f.obj.getWorldPosition(_v); const dist = Math.hypot(_v.x - px, _v.z - pz); if (dist > 45) continue;
    near.push([dist, f, _v.x, _v.y, _v.z]);
    const torch = f.kind === 'torch', lit = torch ? Math.max(0.25, night) : 1;
    const rate = (f.kind === 'forge' ? 12 : torch ? 16 : 34) * f.k * (hi ? 1 : 0.35) * lit;
    f.spawn += rate * d;
    while (f.spawn >= 1) { f.spawn -= 1;
      const ox = (R() - 0.5) * 0.35 * f.k, oz = (R() - 0.5) * 0.35 * f.k, y0 = _v.y + (f.kind === 'forge' ? 0.55 : torch ? 0.0 : 0.15);
      emit(KIND.flame, _v.x + ox, y0, _v.z + oz, -ox * 0.6, 1.1 + R() * 0.9, -oz * 0.6, 0.45 + R() * 0.35, (0.32 + R() * 0.2) * f.k);
      if (R() < 0.12) emit(KIND.ember, _v.x + ox, y0 + 0.2, _v.z + oz, (R() - 0.5) * 0.8, 1.6 + R() * 1.6, (R() - 0.5) * 0.8, 1.4 + R() * 1.2, 0.045);
      if (hi && R() < 0.16 && f.kind !== 'forge') emit(KIND.smoke, _v.x + ox, y0 + 0.7 * f.k, _v.z + oz, 0.15 + R() * 0.2, 0.7 + R() * 0.4, (R() - 0.5) * 0.2, 2.6 + R() * 1.5, 0.5 * f.k);
    }
  }
  near.sort((a, b) => a[0] - b[0]);
  // ambient: leaves drifting down from nearby trees, and dust motes floating in the air (High only)
  if (hi && !inCave) {
    for (const L of LEAF_SRC) { if (L.alive === false) continue; const dd = Math.hypot(L.x - px, L.z - pz); if (dd > 28) continue; const Lh = L.leafH || 3.6, Lr = L.leafR || 1.3, terrainY0 = L.mesh ? L.mesh.position.y : 0;
      if (R() < 1.2 * d) emit(KIND.leaf, L.x + (R() - 0.5) * Lr * 2, terrainY0 + Lh * (0.75 + R() * 0.3), L.z + (R() - 0.5) * Lr * 2, 0.3 + R() * 0.3, -0.45 - R() * 0.25, (R() - 0.5) * 0.4, 7 + R() * 3, 0.14 + R() * 0.06); }
    if (R() < 12 * d) emit(KIND.mote, px + (R() - 0.5) * 16, 0.4 + R() * 3, pz + (R() - 0.5) * 16, (R() - 0.5) * 0.15, (R() - 0.3) * 0.08, (R() - 0.5) * 0.15, 5 + R() * 4, 0.035 + R() * 0.02);
  }
  const t = now * 0.001;
  LIGHTS.forEach((L, i) => { const n = near[i]; if (!n) { L.intensity = 0; return; }
    const f = n[1], fl = 0.75 + 0.18 * Math.sin(t * 13 + i) + 0.12 * Math.sin(t * 23.7 + i * 2) + 0.08 * (R() - 0.5);
    L.position.set(n[2] + Math.sin(t * 7 + i) * 0.05, n[3] + (f.kind === 'forge' ? 0.8 : f.kind === 'torch' ? 0.35 : 0.7), n[4] + Math.cos(t * 6 + i) * 0.05);
    L.intensity = (f.kind === 'forge' ? 5 : f.kind === 'torch' ? 4.5 * Math.max(0.25, night) : 7) * f.k * fl * (1 - Math.min(1, Math.max(0, (n[0] - 30) / 15)));
    L.color.setRGB(1, 0.55 + 0.1 * fl, 0.22); });
  // integrate
  for (let i = 0; i < MAX; i++) {
    if (life[i] >= 1) { aLife[i] = 1; continue; }
    life[i] += d / dur[i]; const k = aKind[i];
    if (k === 0) { vel[i * 3] *= 0.96; vel[i * 3 + 2] *= 0.96; vel[i * 3 + 1] += 0.6 * d; }
    else if (k === 1) { vel[i * 3] += Math.sin(t * 3 + aSeed[i] * 9) * 0.8 * d; vel[i * 3 + 1] -= 0.25 * d; }
    else if (k === 3) vel[i * 3 + 1] -= 9 * d;
    else if (k === 4) { vel[i * 3] *= 0.93; vel[i * 3 + 1] *= 0.93; vel[i * 3 + 2] *= 0.93; }
    else if (k === 5) { vel[i * 3] *= 0.94; vel[i * 3 + 2] *= 0.94; vel[i * 3 + 1] *= 0.9; }
    else if (k === 6) { const ph = t * 2.2 + aSeed[i] * 20; pos[i * 3] += Math.sin(ph) * 0.6 * d; pos[i * 3 + 2] += Math.cos(ph * 0.8) * 0.4 * d; if (pos[i * 3 + 1] < 0.03) { vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0; } }
    else if (k === 7) { vel[i * 3] += Math.sin(t * 0.7 + aSeed[i] * 30) * 0.02 * d; vel[i * 3 + 2] += Math.cos(t * 0.6 + aSeed[i] * 17) * 0.02 * d; }
    pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d;
    aLife[i] = Math.min(1, life[i]);
  }
  points.geometry.attributes.position.needsUpdate = true; points.geometry.attributes.aLife.needsUpdate = true;
  points.geometry.attributes.aSize.needsUpdate = true; points.geometry.attributes.aKind.needsUpdate = true; points.geometry.attributes.aSeed.needsUpdate = true;
}
