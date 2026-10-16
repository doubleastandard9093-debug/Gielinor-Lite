// Stage 5 of the WebGPU release: volumetric height fog, compute particles, rain/snow weather and townsfolk crowds.
// Everything here is WebGPU-release only; the WebGL game at the site root never loads this file.
import * as THREE from 'three';
import { Fn, If, uniform, uniformArray, float, vec2, vec3, vec4, mix, smoothstep, sin, cos, fract, floor, max, min, length, dot, normalize, exp, pow, abs, clamp, select, step,
  instanceIndex, instancedArray, instancedBufferAttribute, positionLocal, positionWorld, cameraPosition, attribute, uv, hash, fog, time, vertexColor } from 'three/tsl';
import { BACKEND, FOG } from './scene.js';
import { SUN_DIR, SKY, TIME } from './gfx.js';
import { FIRES, GPU_LIGHTS } from './vfx.js';
import { DAY } from '../../js/daycycle.js';
import { terrainHeight, TOWNS, PATHS, insideLake, inCave } from '../../js/world.js';
import { humanoidParts, kit } from '../../js/models.js';
import { blockedAt } from '../../js/player.js';

const Q = new URLSearchParams(location.search);
const GPU = () => BACKEND.name === 'WebGPU';
export const S5 = { fog: false, particles: 0, weather: 'clear', precip: 0, snow: 0, crowd: 0 };
let ctx = null;

// ---------------------------------------------------------------------------------------------------------------
// 1. Volumetric height fog. Density falls off exponentially with height and drifts with a slow noise field, and the
// fog along each view ray is integrated analytically between the camera and the surface (exact for an exponential
// height profile), so valleys fill with mist while hilltops poke out of it. Light scattered toward the camera from
// the sun (a Henyey-Greenstein-style forward lobe) tints the fog gold looking into the sun.
// ---------------------------------------------------------------------------------------------------------------
const F_BASE = uniform(0.0064), F_H = uniform(0.010), F_FALL = uniform(0.11), F_SUN = uniform(new THREE.Vector3()), F_SUNC = uniform(new THREE.Color()), F_WET = uniform(0);
function initFog() {
  if (/nofog/.test(Q.toString())) return;
  const P = positionWorld, C = cameraPosition, ray = P.sub(C), dist = length(ray), dir = ray.div(max(dist, 1e-3));
  // distance fog (the existing curve), denser in rain
  const base = F_BASE.mul(F_WET.mul(1.6).add(1)), dTerm = base.mul(base).mul(dist).mul(dist);
  // drifting density: two slow sine octaves over world xz
  const n = sin(P.x.mul(0.035).add(time.mul(0.05))).mul(sin(P.z.mul(0.041).sub(time.mul(0.037)))).mul(0.35).add(0.75);
  const yc = C.y, dy = P.y.sub(yc), b = F_FALL;
  const bdy = b.mul(dy);
  // integral of exp(-b*y) along the ray / dist  =  exp(-b*yc) * (1 - exp(-b*dy)) / (b*dy)   (-> exp(-b*yc) when dy -> 0)
  const avg = exp(b.mul(yc).negate()).mul(select(abs(bdy).greaterThan(1e-3), float(1).sub(exp(bdy.negate())).div(bdy), float(1)));
  const hTerm = F_H.mul(F_WET.add(1)).mul(n).mul(min(avg, 6.0)).mul(dist);
  const amount = clamp(float(1).sub(exp(dTerm.add(hTerm).negate())), 0, 0.97);
  const mu = max(dot(dir, F_SUN), 0), g = float(0.72);
  const hg = float(1).sub(g.mul(g)).div(pow(float(1).add(g.mul(g)).sub(g.mul(2).mul(mu)), 1.5)).mul(0.08);
  const col = mix(FOG.color, F_SUNC, clamp(hg, 0, 0.75));
  ctx.scene.fogNode = fog(col, amount);
  S5.fog = true;
}
function updateFog(q) {
  if (!S5.fog) return;
  const d = ctx.scene.fog.density; F_BASE.value = d; FOG.density.value = d;
  F_SUN.value.copy(DAY.lightDir || SUN_DIR).normalize();
  F_SUNC.value.copy(SKY.sun).lerp(new THREE.Color(1, 0.6, 0.3), DAY.gold || 0).multiplyScalar(Math.max(0, 1 - (DAY.night || 0)));
  F_H.value = q === 'low' ? 0.004 : 0.010;
  F_WET.value += ((S5.weather === 'clear' ? 0 : S5.precip) - F_WET.value) * 0.02;
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Compute particles (WebGPU only). One storage-buffer pool simulated entirely by a compute shader: fire embers and
// sparks stream from the 64 fires nearest the player, and 16 burst slots of 256 particles each serve hit sparks and
// magic. The CPU only uploads emitter positions and burst starts; the WebGL2 fallback keeps the CPU particle system.
// ---------------------------------------------------------------------------------------------------------------
const NE = 64, NB = 16, PB = 256, BURST_N = NB * PB;
let comp = null, PCOUNT = 0;
const EMIT = uniformArray(Array.from({ length: NE }, () => new THREE.Vector4()), 'vec4'), EMIT_N = uniform(0);
const BPOS = uniformArray(Array.from({ length: NB }, () => new THREE.Vector4(0, -999, 0, 0)), 'vec4'), BSTART = uniformArray(Array.from({ length: NB }, () => new THREE.Vector4(-99, 0, 0, 0)), 'vec4');
const DT = uniform(0.016), NOW = uniform(0);
let bslot = 0;
function initParticles() {
  if (!GPU() || /nocompute/.test(Q.toString())) return;
  PCOUNT = +(Q.get('particles') || 65536);
  const pos = instancedArray(PCOUNT, 'vec3'), vel = instancedArray(PCOUNT, 'vec3'), lif = instancedArray(PCOUNT, 'vec4');   // age, dur, birth, kind
  const update = Fn(() => {
    const i = instanceIndex, P = pos.element(i), V = vel.element(i), L = lif.element(i);
    const fi = float(i), h1 = hash(fi.add(NOW.mul(13.7))), h2 = hash(fi.mul(1.37).add(NOW.mul(7.1))), h3 = hash(fi.mul(2.11).add(NOW.mul(3.3))), h4 = hash(fi.mul(0.73).add(NOW));
    L.x.addAssign(DT);
    If(fi.lessThan(BURST_N), () => {
      const s = floor(fi.div(PB)), B = BPOS.element(s), st = BSTART.element(s).x;
      If(st.greaterThan(L.z), () => {          // a new burst fired into this slot since this particle was born
        const a = h1.mul(6.2832), e = h2.mul(2).sub(1), r = vec3(cos(a).mul(float(1).sub(e.mul(e)).sqrt()), e, sin(a).mul(float(1).sub(e.mul(e)).sqrt()));
        const magic = B.w.greaterThan(0.5);
        P.assign(B.xyz.add(r.mul(0.05)));
        V.assign(select(magic, r.mul(h3.mul(2.5).add(1.2)).add(vec3(0, 0.6, 0)), r.mul(h3.mul(5).add(2)).add(vec3(0, 2.2, 0))));
        L.assign(vec4(0, select(magic, h4.mul(0.5).add(0.5), h4.mul(0.35).add(0.25)), st, select(magic, 4, 3)));
      });
    }).Else(() => {
      If(L.x.greaterThan(L.y).and(EMIT_N.greaterThan(0.5)), () => {
        const e = EMIT.element(floor(h1.mul(EMIT_N)).toInt()), sp = e.w.max(0.3);
        const ember = h2.lessThan(0.82);
        P.assign(e.xyz.add(vec3(h3.sub(0.5).mul(0.5).mul(sp), h4.mul(0.25), h2.sub(0.5).mul(0.5).mul(sp))));
        V.assign(select(ember, vec3(h3.sub(0.5).mul(0.5), h4.mul(1.2).add(0.6), h1.sub(0.5).mul(0.5)), vec3(h3.sub(0.5).mul(2.2), h4.mul(3).add(1.5), h1.sub(0.5).mul(2.2))));
        L.assign(vec4(0, select(ember, h4.mul(1.6).add(0.9), h4.mul(0.5).add(0.3)), NOW, select(ember, 1, 3)));
      });
    });
    // integrate: embers and magic rise and curl in a turbulent updraft, sparks fall under gravity, all with drag
    const k = L.w, t = NOW;
    const curl = vec3(sin(P.y.mul(2.3).add(t.mul(1.7)).add(P.z.mul(1.1))), 0, cos(P.y.mul(2.1).sub(t.mul(1.3)).add(P.x.mul(1.2)))).mul(select(k.lessThan(1.5), 1.6, select(k.greaterThan(3.5), 2.4, 0.3)));
    const g = select(k.lessThan(1.5), 0.9, select(k.greaterThan(3.5), -0.4, -9.0));
    V.addAssign(curl.add(vec3(0, g, 0)).mul(DT));
    V.mulAssign(float(1).sub(DT.mul(select(k.greaterThan(2.5).and(k.lessThan(3.5)), 0.6, 1.6))));
    P.addAssign(V.mul(DT));
  });
  comp = update().compute(PCOUNT);
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  m.positionNode = pos.toAttribute();
  const lv = lif.toAttribute(), lt = clamp(lv.x.div(max(lv.y, 1e-3)), 0, 1), kd = lv.w;
  const alive = step(lv.x, lv.y);
  m.scaleNode = alive.mul(select(kd.lessThan(1.5), float(0.07).mul(float(1).sub(lt.mul(0.6))), select(kd.greaterThan(3.5), float(0.16).mul(float(1).sub(lt)), float(0.05))));
  m.colorNode = Fn(() => {
    const r = length(uv().sub(0.5)).mul(2), core = smoothstep(1, 0, r), hot = core.mul(core);
    const ember = mix(vec3(1.8, 0.9, 0.3), vec3(0.9, 0.18, 0.02), lt);
    const spark = mix(vec3(2.2, 1.7, 1.0), vec3(1.2, 0.4, 0.1), lt);
    const magic = mix(vec3(0.6, 0.8, 2.2), vec3(1.4, 0.4, 2.0), lt);
    const c = select(kd.lessThan(1.5), ember, select(kd.greaterThan(3.5), magic, spark));
    const a = hot.mul(float(1).sub(lt)).mul(alive);
    return vec4(c.mul(a), a);
  })();
  const spr = new THREE.Sprite(m); spr.count = PCOUNT; spr.frustumCulled = false; spr.renderOrder = 5;
  ctx.scene.add(spr);
  // bursts: chain onto the tiled-lighting flash hook so every hit or spell also fires a compute burst
  const prev = GPU_LIGHTS.onBurst;
  GPU_LIGHTS.onBurst = (type, x, y, z, color) => {
    if (prev) prev(type, x, y, z, color);
    if (type !== 'hit' && type !== 'magic') return;
    BPOS.array[bslot].set(x, y, z, type === 'magic' ? 1 : 0); BSTART.array[bslot].x = NOW.value + 1e-4; bslot = (bslot + 1) % NB;
  };
  window.gpuBurst = (type, x, y, z) => GPU_LIGHTS.onBurst(type, x, y, z);
  S5.particles = PCOUNT;
}
const _v = new THREE.Vector3();
function updateParticles(dt, now, p) {
  if (!comp) return;
  DT.value = Math.min(dt, 0.05); NOW.value = now * 0.001;
  const near = [];
  for (const f of FIRES) { if (!f.obj.parent || f.obj.visible === false) continue; f.obj.getWorldPosition(_v); const d = Math.hypot(_v.x - p.x, _v.z - p.z); if (d < 90) near.push([d, _v.x, _v.y + (f.kind === 'torch' ? 0.3 : 0.25), _v.z, f.kind === 'torch' ? 0.35 : 1]); }
  near.sort((a, b) => a[0] - b[0]);
  const n = Math.min(NE, near.length);
  for (let i = 0; i < n; i++) EMIT.array[i].set(near[i][1], near[i][2], near[i][3], near[i][4]);
  EMIT_N.value = n;
  ctx.renderer.compute(comp);
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Weather. Rain streaks or snowflakes in a box that wraps around the camera, animated entirely in the vertex shader
// (works on both backends). Clear spells and showers alternate; up in the northern mountains it snows instead.
// ?weather=rain|snow|clear forces a state.
// ---------------------------------------------------------------------------------------------------------------
const W_K = uniform(0), W_SNOW = uniform(0), W_C = uniform(new THREE.Vector3()), W_H = uniform(30), BOX = 50;
let wMesh = null, wTimer = 40 + Math.random() * 60, wForced = Q.get('weather');
if (wForced === 'rain' || wForced === 'snow') S5.precip = 1;
function initWeather() {
  if (wForced === 'off') return;
  const N = GPU() ? 24000 : 9000;
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
  const fi = float(instanceIndex), h1 = hash(fi.mul(1.13)), h2 = hash(fi.mul(2.71).add(3)), h3 = hash(fi.mul(0.37).add(7)), h4 = hash(fi.mul(5.3).add(1));
  const snow = step(0.5, W_SNOW);
  const speed = mix(float(15).add(h4.mul(6)), float(1.1).add(h4.mul(0.6)), snow);
  const cam = cameraPosition, C0 = W_C;
  // world-anchored positions that wrap inside a box following the camera
  const wx = C0.x.add(fract(h1.sub(C0.x.div(BOX))).sub(0.5).mul(BOX));
  const wz = C0.z.add(fract(h2.sub(C0.z.div(BOX))).sub(0.5).mul(BOX));
  const fall = fract(h3.sub(TIME.mul(speed).div(W_H)));
  const sway = vec2(sin(TIME.mul(0.9).add(h1.mul(40))), cos(TIME.mul(0.7).add(h2.mul(40)))).mul(snow.mul(0.6)).add(vec2(snow.oneMinus().mul(-1.2), 0));
  const wy = C0.y.add(fall.mul(W_H));
  const centre = vec3(wx.add(sway.x.mul(fall)), wy, wz.add(sway.y));
  const toCam = cam.sub(centre), right = normalize(vec3(toCam.z, 0, toCam.x.negate()).add(vec3(1e-4, 0, 0)));
  const up = mix(vec3(0, 1, 0), normalize(vec3(0, 1, 0).sub(normalize(toCam).mul(dot(normalize(toCam), vec3(0, 1, 0))))), snow);
  const w = mix(float(0.016), float(0.07).add(h4.mul(0.05)), snow), hgt = mix(float(0.55).add(h4.mul(0.35)), w, snow);
  const shown = step(h1.add(h2).mul(0.5), W_K).mul(step(mix(float(5), float(2.5), snow), length(toCam)));   // none right in front of the lens
  const pl = positionLocal;
  m.positionNode = centre.add(right.mul(pl.x.mul(w)).add(up.mul(pl.y.sub(0.5).mul(hgt)))).mul(shown).add(vec3(0, -9999, 0).mul(shown.oneMinus()));
  m.colorNode = mix(vec3(0.72, 0.78, 0.86), vec3(1, 1, 1), snow);
  const r = length(uv().sub(0.5)).mul(2);
  m.opacityNode = mix(smoothstep(0.5, 0.0, abs(uv().x.sub(0.5))).mul(0.5), smoothstep(1, 0.4, r).mul(0.9), snow).mul(float(1).sub(DAY.night ? 0 : 0));
  wMesh = new THREE.InstancedMesh(g, m, N); wMesh.frustumCulled = false; wMesh.renderOrder = 6; wMesh.castShadow = wMesh.receiveShadow = false;
  ctx.scene.add(wMesh);
}
function updateWeather(dt, p) {
  if (!wMesh) return;
  const mountains = p.z < -150 || terrainHeight(p.x, p.z) > 14;
  if (wForced === 'rain' || wForced === 'snow' || wForced === 'clear') S5.weather = wForced === 'clear' ? 'clear' : 'wet';
  else if ((wTimer -= dt) <= 0) { S5.weather = S5.weather === 'clear' ? 'wet' : 'clear'; wTimer = S5.weather === 'clear' ? 150 + Math.random() * 240 : 70 + Math.random() * 110; S5.target = 0.35 + Math.random() * 0.65; }
  const snowing = wForced === 'snow' || (wForced !== 'rain' && mountains);
  const want = inCave(p.x, p.z) ? 0 : S5.weather === 'clear' ? (mountains && !wForced ? 0.25 : 0) : (wForced ? 1 : S5.target ?? 0.7);
  S5.precip = Math.min(1, Math.max(0, S5.precip + (want - S5.precip) * Math.min(1, Math.max(0, dt) * 0.25)));
  const cam = ctx.camera.position; W_C.value.set((cam.x + p.x * 2) / 3, p.y - 1, (cam.z + p.z * 2) / 3); W_H.value = Math.max(12, cam.y - p.y + 6);
  W_K.value = S5.precip; W_SNOW.value = snowing ? 1 : 0; S5.snow = W_SNOW.value;
  wMesh.visible = S5.precip > 0.01;
  // rain dims the sun a little (shared day cycle sets the light each frame before this runs)
  if (ctx.dirLight) { const L = ctx.dirLight; if (L.intensity !== S5._dimSet) S5._dimBase = L.intensity; L.intensity = S5._dimSet = S5._dimBase * (1 - 0.45 * S5.precip * (snowing ? 0.5 : 1)); }
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Crowds. Extra townsfolk drawn as instanced humanoids, a few look variants per draw call. They stroll the town
// streets (the PATHS segments near each town) with a walk cycle done in the vertex shader: legs swing from the hip,
// arms counter-swing from the shoulder and the body bobs. They are scenery: no clicks or collisions.
// ---------------------------------------------------------------------------------------------------------------
const LOOKS = [
  { body: 0x7a3a2a, legs: 0x3a2a1a, hair: 0x2a1a10 }, { body: 0x2a4a7a, legs: 0x4a3a2a, hair: 0x8a6a3a, skin: 0xc08a64 }, { body: 0x5a6a2a, legs: 0x2a2a2a, hair: 0x1a1410, skin: 0x8a5a3a },
  { body: 0x8a7a5a, legs: 0x5a4a3a, hair: 0xb08a50 }, { body: 0x6a2a5a, legs: 0x2a1a2a, hair: 0x5a2a12, skin: 0xe8bc94 }, { body: 0x3a5a5a, legs: 0x3a3a3a, hair: 0x4a4a4a, skin: 0xa8784e },
  { body: 0x9a5a2a, legs: 0x3a2a1a, sleeve: 0xd8c8a0, hair: 0x2a1a10, skin: 0x6a4228 }, { body: 0xa8a090, legs: 0x4a4038, hair: 0xd8d0c0 }
];
const walkers = []; let crowdMeshes = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function crowdMaterial(phaseAttr) {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const ph = instancedBufferAttribute(phaseAttr), pl = positionLocal, HIP = 0.74, SH = 1.36;
  m.positionNode = Fn(() => {
    const v = pl.toVar(), side = select(pl.x.greaterThan(0), float(1), float(-1));
    const s = sin(ph.x), amp = ph.y;
    // legs: rotate about the hip around x
    If(pl.y.lessThan(HIP).and(abs(pl.x).lessThan(0.3)), () => {
      const a = s.mul(side).mul(0.55).mul(amp), y = pl.y.sub(HIP), z = pl.z;
      v.y.assign(y.mul(cos(a)).sub(z.mul(sin(a))).add(HIP)); v.z.assign(y.mul(sin(a)).add(z.mul(cos(a))));
    });
    // arms and hands: counter-swing about the shoulder
    If(abs(pl.x).greaterThan(0.3).and(pl.y.lessThan(SH + 0.06)).and(pl.y.greaterThan(0.6)), () => {
      const a = s.mul(side).mul(-0.45).mul(amp), y = pl.y.sub(SH), z = pl.z;
      v.y.assign(y.mul(cos(a)).sub(z.mul(sin(a))).add(SH)); v.z.assign(y.mul(sin(a)).add(z.mul(cos(a))));
    });
    v.y.addAssign(abs(cos(ph.x)).mul(0.045).mul(amp));
    return v;
  })();
  return m;
}
function streetSegments() {
  const segs = [];
  for (const t of Object.values(TOWNS)) for (const [x1, z1, x2, z2] of PATHS) {
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    if (Math.hypot(mx - t.x, mz - t.z) < 26) segs.push({ x1, z1, x2, z2, len: Math.hypot(x2 - x1, z2 - z1), town: t });
  }
  return segs.filter(s => s.len > 4);
}
function initCrowds() {
  if (/nocrowd/.test(Q.toString())) return;
  const N = +(Q.get('crowd') || (GPU() ? 120 : 48)), segs = streetSegments(), towns = [...new Set(segs.map(s => s.town))];
  if (!segs.length) return;
  const per = Math.ceil(N / LOOKS.length);
  LOOKS.forEach((look, li) => {
    const h = humanoidParts(look), parts = [...h.top];
    for (const lx of [-0.13, 0.13]) for (const [geo, hex, px = 0, py = 0, pz = 0, rx, ry, rz, amt] of h.leg) parts.push([geo.clone(), hex, px + lx, py + h.hipY, pz, rx, ry, rz, amt]);
    const src = kit(parts), geo = src.geometry;
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(per * 2), 2).setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.InstancedMesh(geo, crowdMaterial(phase), per);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.phase = phase;
    ctx.scene.add(mesh); crowdMeshes.push(mesh);
    for (let k = 0; k < per; k++) {
      const t = towns[(li * per + k) % towns.length], ts = segs.filter(q => q.town === t), s = ts[Math.floor(Math.random() * ts.length)];
      walkers.push({ mesh, k, s, t: 0.2 + Math.random() * 0.8, dir: Math.random() < 0.5 ? 1 : -1, off: (Math.random() - 0.5) * 2.2, speed: 0.9 + Math.random() * 0.6,
        pause: 0, ph: Math.random() * 6, sc: 0.9 + Math.random() * 0.18, build: 0.9 + Math.random() * 0.2, x: 0, z: 0, yaw: 0 });
    }
  });
  S5.crowd = walkers.length;
}
function updateCrowds(dt, p) {
  if (!walkers.length) return;
  for (const w of walkers) {
    const s = w.s, moving = w.pause <= 0;
    if (moving) {
      w.t += w.dir * w.speed * dt / s.len;
      if (w.t > 1 || w.t < 0) { w.t = Math.min(1, Math.max(0, w.t)); w.dir *= -1; w.pause = Math.random() < 0.4 ? 1 + Math.random() * 4 : 0; }
      w.ph += dt * w.speed * 5.2;
    } else w.pause -= dt;
    const dx = (s.x2 - s.x1) / s.len, dz = (s.z2 - s.z1) / s.len;
    let x = s.x1 + (s.x2 - s.x1) * w.t - dz * w.off, z = s.z1 + (s.z2 - s.z1) * w.t + dx * w.off;
    // step around the player instead of walking through them
    const px = x - p.x, pz = z - p.z, pd = Math.hypot(px, pz);
    if (pd < 1.1 && pd > 1e-3) { x = p.x + px / pd * 1.1; z = p.z + pz / pd * 1.1; }
    w.x = x; w.z = z;
    const yaw = Math.atan2(dx * w.dir, dz * w.dir); w.yaw += (((yaw - w.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
    _p.set(x, terrainHeight(x, z), z); _q.setFromAxisAngle(_Y, w.yaw); _s.set(w.build * w.sc, w.sc, w.build * w.sc);
    w.mesh.setMatrixAt(w.k, _m.compose(_p, _q, _s));
    const a = w.mesh.userData.phase; a.setXY(w.k, w.ph, moving ? 1 : 0);
  }
  for (const m of crowdMeshes) { m.instanceMatrix.needsUpdate = true; m.userData.phase.needsUpdate = true; }
}

export function initStage5(c) {
  ctx = c;
  for (const [name, f] of [['fog', initFog], ['particles', initParticles], ['weather', initWeather]]) {
    try { f(); } catch (e) { console.warn('[webgpu] stage 5 ' + name + ' unavailable', e); }
  }
  window.gpuStage5 = S5;
}
export function updateStage5(dt, now, p, q) {
  // own clock: the frame dt handed in can be zero or negative on the first frames and in slow headless runs
  const tn = performance.now(); dt = S5._t ? Math.min(0.1, Math.max(0, (tn - S5._t) / 1000)) : 0; S5._t = tn;
  updateFog(q); updateWeather(dt, p); updateCrowds(dt, p); updateParticles(dt, now, p);
}
