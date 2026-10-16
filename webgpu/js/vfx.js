// Particle VFX and fire lighting: one GPU point-sprite system for flames, embers, smoke, hit sparks, magic bursts and
// dust, plus a small fixed pool of flickering point lights handed to the fires nearest the player.
// The light count never changes, so materials compile once. Low quality uses fewer particles and no smoke.
import * as THREE from 'three';
import { Fn, uniform, float, vec2, vec3, vec4, mix, smoothstep, length, sin, abs, max, uv, positionLocal, instancedBufferAttribute, If, Discard, select } from 'three/tsl';

const MAX = 4000;
const pos = new Float32Array(MAX * 3), vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), dur = new Float32Array(MAX);
const aLife = new Float32Array(MAX), aSize = new Float32Array(MAX), aKind = new Float32Array(MAX), aSeed = new Float32Array(MAX);
let SCALE = null;
let cursor = 0, quality = 'high', inited = false, points = null;
const FIRES = [];     // { obj, k, spawn, kind }
const LIGHTS = [];
const NL_HI = 12, NL_LO = 2, GLOW_MAX = 256, GLOW = {}; const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(), _p4 = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
// kinds: 0 flame, 1 ember, 2 smoke, 3 spark, 4 magic, 5 dust
const KIND = { flame: 0, ember: 1, smoke: 2, spark: 3, magic: 4, dust: 5, leaf: 6, mote: 7 };
let LEAF_SRC = [];
export function setLeafSources(list) { LEAF_SRC = list; }

export function addFire(obj, k = 1, kind = 'fire', opts = {}) { const f = { obj, k, spawn: Math.random(), kind, ground: opts.ground ?? 0, wall: opts.wall || null }; FIRES.push(f); return f; }
export function removeFireVfx(obj) { const i = FIRES.findIndex(f => f.obj === obj); if (i >= 0) FIRES.splice(i, 1); }
export function setVfxQuality(q) { quality = q; LIGHTS.forEach((L, i) => { L.visible = i < (q === 'low' ? NL_LO : NL_HI); }); }

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
  // WebGPU has no sized point sprites, so particles are one instanced billboard sprite (a single draw call) whose
  // per-instance position, life, size, kind and seed come from the same CPU arrays the WebGL game uses.
  const A = {
    position: new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), aLife: new THREE.InstancedBufferAttribute(aLife, 1).setUsage(THREE.DynamicDrawUsage),
    aSize: new THREE.InstancedBufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage), aKind: new THREE.InstancedBufferAttribute(aKind, 1).setUsage(THREE.DynamicDrawUsage),
    aSeed: new THREE.InstancedBufferAttribute(aSeed, 1).setUsage(THREE.DynamicDrawUsage)
  };
  for (let i = 0; i < MAX; i++) { aLife[i] = 1; pos[i * 3 + 1] = -999; }
  const iP = instancedBufferAttribute(A.position), vL = instancedBufferAttribute(A.aLife), vS0 = instancedBufferAttribute(A.aSize), vK = instancedBufferAttribute(A.aKind), vS = instancedBufferAttribute(A.aSeed);
  const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  mat.positionNode = iP;
  const grow = select(vK.lessThan(0.5), float(1).sub(vL.mul(0.7)), select(vK.greaterThan(1.5).and(vK.lessThan(2.5)), vL.mul(2.2).add(0.6), select(vK.greaterThan(4.5), vL.mul(1.5).add(0.7), float(1).sub(vL.mul(0.5)))));
  SCALE = uniform(0.75);
  mat.scaleNode = select(vL.greaterThanEqual(1.0), float(0), vS0.mul(grow).mul(SCALE));
  mat.colorNode = Fn(() => {
    const d = uv().sub(0.5), r = length(d).mul(2.0);
    If(r.greaterThan(1.0), () => { Discard(); });
    const soft = float(1).sub(smoothstep(0.2, 1.0, r));
    const out = vec4(0).toVar();
    If(vK.lessThan(0.5), () => {
      const c = mix(mix(vec3(1.0, 0.92, 0.6), vec3(1.0, 0.45, 0.08), smoothstep(0.0, 0.45, vL)), vec3(0.6, 0.08, 0.02), smoothstep(0.45, 1.0, vL)).mul(2.4);
      out.assign(vec4(c.mul(soft.mul(float(1).sub(vL)).mul(0.8)), 0));
    }).ElseIf(vK.lessThan(1.5), () => {
      const c = vec3(1.0, 0.6, 0.2).mul(3.0).mul(sin(vL.mul(30.0).add(vS.mul(20.0))).mul(0.4).add(0.6));
      out.assign(vec4(c.mul(float(1).sub(smoothstep(0.3, 1.0, r)).mul(float(1).sub(vL))), 0));
    }).ElseIf(vK.lessThan(2.5), () => {
      const a = soft.mul(0.28).mul(sin(vL.mul(3.1416))); out.assign(vec4(vec3(0.32, 0.3, 0.29).mul(a), a));
    }).ElseIf(vK.lessThan(3.5), () => {
      out.assign(vec4(vec3(1.0, 0.8, 0.45).mul(3.0).mul(float(1).sub(smoothstep(0.2, 1.0, r)).mul(float(1).sub(vL))), 0));
    }).ElseIf(vK.lessThan(4.5), () => {
      out.assign(vec4(mix(vec3(0.5, 0.8, 1.0), vec3(0.8, 0.4, 1.0), vS).mul(2.5).mul(soft.mul(float(1).sub(vL))), 0));
    }).ElseIf(vK.lessThan(5.5), () => {
      const a = soft.mul(0.35).mul(float(1).sub(vL)); out.assign(vec4(vec3(0.62, 0.55, 0.42).mul(a), a));
    }).ElseIf(vK.lessThan(6.5), () => {
      const tum = abs(sin(vL.mul(18.0).add(vS.mul(30.0)))); const q = d.mul(vec2(float(1).div(max(0.25, tum)), 1.0));
      const leaf = float(1).sub(smoothstep(0.32, 0.4, length(q.mul(vec2(1.6, 1.0)))));
      If(leaf.lessThan(0.5), () => { Discard(); });
      const a = float(1).sub(smoothstep(0.85, 1.0, vL));
      out.assign(vec4(mix(vec3(0.42, 0.55, 0.18), vec3(0.85, 0.55, 0.15), vS).mul(tum.mul(0.3).add(0.7)).mul(a), a));
    }).Else(() => {
      out.assign(vec4(vec3(1.0, 0.95, 0.8).mul(1.2).mul(soft.mul(0.5).mul(sin(vL.mul(3.1416)))), 0));
    });
    return out;
  })();
  points = new THREE.Sprite(mat); points.count = MAX; points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
  points.userData.attrs = A;
  for (let i = 0; i < NL_HI; i++) { const L = new THREE.PointLight(0xff9a40, 0, 9, 1.6); L.castShadow = false; L.visible = i < NL_LO; scene.add(L); LIGHTS.push(L); }
  // light pools: one additive radial glow on the ground under every fire/torch and one on the wall behind each torch.
  // These are instanced quads (2 draw calls in total), so every visible flame lights its surroundings,
  // and the pooled point lights add real shading on top for the nearest ones.
  for (const key of ['ground', 'wall']) {
    const q = new THREE.PlaneGeometry(1, 1); if (key === 'ground') q.rotateX(-Math.PI / 2);
    const ia = new THREE.InstancedBufferAttribute(new Float32Array(GLOW_MAX), 1); ia.setUsage(THREE.DynamicDrawUsage); q.setAttribute('aI', ia);
    const glowMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    { const vU = vec2(positionLocal.x, positionLocal.y.add(positionLocal.z)); const a = max(float(0), float(1).sub(length(vU).mul(2.0))).pow(2.6).mul(instancedBufferAttribute(ia));
      glowMat.colorNode = vec4(vec3(1.0, 0.52, 0.2).mul(a), 0); }
    const m = new THREE.InstancedMesh(q, glowMat, GLOW_MAX); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.renderOrder = 4;
    scene.add(m); GLOW[key] = m;
  }
  inited = true;
}

export function updateVfx(dt, px, pz, camera, now, night = 0, inCave = false) {
  if (!inited) return;
  const R = Math.random, hi = quality !== 'low', d = Math.min(dt, 0.05);
  
  // spawn from fires near the player; rank by distance for the light pool
  const near = [];
  for (const f of FIRES) {
    if (!f.obj.parent || f.obj.visible === false) continue;
    f.obj.getWorldPosition(_v); const dist = Math.hypot(_v.x - px, _v.z - pz); if (dist > 60) continue;
    near.push([dist, f, _v.x, _v.y, _v.z]); if (dist > 45) continue;
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
      if (R() < 2.0 * d) emit(KIND.leaf, L.x + (R() - 0.5) * Lr * 2, terrainY0 + Lh * (0.75 + R() * 0.3), L.z + (R() - 0.5) * Lr * 2, 0.3 + R() * 0.3, -0.45 - R() * 0.25, (R() - 0.5) * 0.4, 7 + R() * 3, 0.21 + R() * 0.08); }
    if (R() < 12 * d) emit(KIND.mote, px + (R() - 0.5) * 16, 0.4 + R() * 3, pz + (R() - 0.5) * 16, (R() - 0.5) * 0.15, (R() - 0.3) * 0.08, (R() - 0.5) * 0.15, 5 + R() * 4, 0.035 + R() * 0.02);
  }
  const t = now * 0.001;
  LIGHTS.forEach((L, i) => { const n = near[i]; if (!n) { L.intensity = 0; return; }
    const f = n[1], fl = 0.75 + 0.18 * Math.sin(t * 13 + i) + 0.12 * Math.sin(t * 23.7 + i * 2) + 0.08 * (R() - 0.5);
    L.position.set(n[2] + Math.sin(t * 7 + i) * 0.05, n[3] + (f.kind === 'forge' ? 0.8 : f.kind === 'torch' ? 0.35 : 0.7), n[4] + Math.cos(t * 6 + i) * 0.05);
    L.intensity = (f.kind === 'forge' ? 5 : f.kind === 'torch' ? 4.5 * Math.max(0.25, night) : 7) * f.k * fl * (1 - Math.min(1, Math.max(0, (n[0] - 30) / 15)));
    L.color.setRGB(1, 0.55 + 0.1 * fl, 0.22); });
  // light pools under/behind every fire within 60 m
  { let ng = 0, nw = 0; const G = GLOW.ground, W = GLOW.wall, gi = G.geometry.attributes.aI, wi = W.geometry.attributes.aI;
    for (const n of near) { if (n[0] > 60) break; const f = n[1], torch = f.kind === 'torch';
      const fl = 0.85 + 0.1 * Math.sin(t * 13 + n[2]) + 0.06 * Math.sin(t * 23.7 + n[4]);
      const lit = (torch ? (0.12 + 0.88 * night) : (0.35 + 0.65 * night)) * fl * (1 - Math.max(0, (n[0] - 45) / 15));
      if (ng < GLOW_MAX) { const sz = (torch ? 5.5 : f.kind === 'forge' ? 4 : 6.5) * Math.sqrt(f.k / (torch ? 0.45 : 1));
        _p4.set(n[2], n[3] - f.ground + 0.05, n[4]); _s4.set(sz, 1, sz); _m4.compose(_p4, _q4.identity(), _s4); G.setMatrixAt(ng, _m4); gi.array[ng++] = lit * 0.07; }
      if (f.wall && nw < GLOW_MAX) { _p4.set(n[2] - f.wall[0] * 0.165, n[3] - 0.15, n[4] - f.wall[1] * 0.165); _q4.setFromUnitVectors(_up, _v.set(f.wall[0], 0, f.wall[1])); _s4.set(3.2, 3.6, 1);
        _m4.compose(_p4, _q4, _s4); W.setMatrixAt(nw, _m4); wi.array[nw++] = lit * 0.06; }
    }
    G.count = ng; W.count = nw; G.instanceMatrix.needsUpdate = W.instanceMatrix.needsUpdate = gi.needsUpdate = wi.needsUpdate = true; }
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
  { const A = points.userData.attrs; A.position.needsUpdate = A.aLife.needsUpdate = A.aSize.needsUpdate = A.aKind.needsUpdate = A.aSeed.needsUpdate = true; }
}
