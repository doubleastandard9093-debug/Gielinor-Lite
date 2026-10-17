// WebGPU release extras.
// - Backend badge.
// - Stage 2, many lights: on the WebGPU backend the renderer switches to tiled lighting (a compute pass bins point lights
//   into 32 px screen tiles), so a fixed pool of 256 point lights can be handed to every fire, forge and torch within
//   ~110 m plus short flashes for spells and hits. The WebGL2 fallback keeps the WebGL game's 12-light pool.
import * as THREE from 'three';
import { BACKEND, CASCADE } from './scene.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { FIRES, GPU_LIGHTS, setVfxQuality } from './vfx.js';
import { TiledLighting } from 'three/addons/lighting/TiledLighting.js';
import { DAY } from '../../js/daycycle.js';
import { initStage5, updateStage5, S5 } from './stage5.js';
import { initStage6, updateStage6 } from './stage6.js';
import { terrainHeight, insideLake, WORLD_HALF, inCave } from '../../js/world.js';
import { blockedAt } from '../../js/player.js';
import { PUSH } from '../../js/models.js';
import { TERRAIN_MASK, TIME, SWAY } from './gfx.js';
import { Fn, uniform, uniformArray, texture, float, vec2, vec3, vec4, mix, smoothstep, sin, cos, fract, floor, max, length, dot, normalize, select, step,
  instanceIndex, positionLocal, attribute, varying, positionWorld, cameraPosition, uv as uvNode, hash } from 'three/tsl';

let badge = null, ctx = null, tiled = false, quality = 'high';
const POOL = +(new URLSearchParams(location.search).get('lights') || 160), FLASH = 24, pool = [], flashes = [], _v = new THREE.Vector3();
export const GPU_STATS = { lights: 0, fires: 0 };

export function initGpuExtras(c) {
  ctx = c;
  badge = document.createElement('div');
  badge.id = 'gpuBadge';
  badge.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(4px + env(safe-area-inset-top,0px));z-index:30;pointer-events:none;' +
    'font:600 11px Georgia,serif;letter-spacing:.04em;padding:2px 8px;border-radius:9px;border:1px solid #d4af37;' +
    (BACKEND.name === 'WebGPU' ? 'background:rgba(20,60,30,.82);color:#bff5c8' : 'background:rgba(70,45,10,.82);color:#ffd99a');
  document.body.appendChild(badge);
  window.gielinorBackend = BACKEND.name;
  window.gpuStats = GPU_STATS;
  if (BACKEND.name === 'WebGPU' && !/notiled/.test(location.search)) {
    try {
      ctx.renderer.lighting = new TiledLighting();
      tiled = true;
    } catch (e) { console.warn('[webgpu] tiled lighting unavailable', e); }
  }
  if (tiled) {
    for (let i = 0; i < POOL + FLASH; i++) { const L = new THREE.PointLight(0xff9a40, 0, 10, 1.6); L.castShadow = false; ctx.scene.add(L); pool.push(L); }
    GPU_LIGHTS.active = true; setVfxQuality(quality);
    GPU_LIGHTS.onBurst = (type, x, y, z, color) => {
      const col = type === 'magic' ? (color != null ? new THREE.Color(color) : new THREE.Color(0.6, 0.6, 1.0)) : type === 'hit' ? new THREE.Color(1, 0.7, 0.35) : null;
      if (!col) return;
      flashes.push({ x, y: y + 0.3, z, col, t: 0, d: type === 'magic' ? 0.55 : 0.25, k: type === 'magic' ? 9 : 4 });
      if (flashes.length > FLASH) flashes.shift();
    };
  }
  initGrass();
  // Stage 4, cascaded shadow maps: the sun's shadow is split into cascades along the view, so contact shadows stay
  // sharp at your feet while hills, trees and buildings far off still cast. ?nocsm turns it off.
  if (!/nocsm/.test(location.search)) {
    try {
      const gpu = BACKEND.name === 'WebGPU', L = ctx.dirLight;
      L.shadow.mapSize.set(2048, 2048);
      const csm = new CSMShadowNode(L, { cascades: gpu ? 4 : 3, maxFar: gpu ? 300 : 200, mode: 'practical', lightMargin: 80 });
      csm.fade = true;
      L.shadow.shadowNode = csm; CASCADE.csm = csm; GPU_STATS.cascades = csm.cascades;
    } catch (e) { console.warn('[webgpu] CSM unavailable', e); }
  }
  initStage5(ctx);
  initStage6(ctx);
  const narrow = innerWidth < 520;
  badge.style.whiteSpace = 'nowrap';
  badge.textContent = (BACKEND.name === 'WebGPU' ? 'WebGPU' : narrow ? 'WebGL2' : 'WebGL2 fallback') + (tiled ? (narrow ? ' · tiled' : ' · tiled lights') : '') + (CASCADE.csm ? ' · CSM' : '') + (S5.particles ? (narrow ? ' · FX' : ' · compute FX') : '');
}
export function setGpuQuality(q) { quality = q; }

export function updateGpuExtras(dt, now, p, q) {
  updateGrassField(p, q);
  updateStage5(dt, now, p, q);
  updateStage6(dt, now, p, q);
  if (!tiled) return;
  const t = now * 0.001;
  const near = [];
  for (const f of FIRES) {
    if (!f.obj.parent || f.obj.visible === false) continue;
    f.obj.getWorldPosition(_v); const d = Math.hypot(_v.x - p.x, _v.z - p.z); if (d > 110) continue;
    near.push([d, f, _v.x, _v.y, _v.z]);
  }
  near.sort((a, b) => a[0] - b[0]);
  const nmax = q === 'low' ? 64 : POOL; let n = 0;
  const nightK = DAY.night || 0;
  for (; n < Math.min(nmax, near.length); n++) {
    const [d, f, x, y, z] = near[n], L = pool[n], torch = f.kind === 'torch';
    const fl = 0.75 + 0.18 * Math.sin(t * 13 + n) + 0.12 * Math.sin(t * 23.7 + n * 2) + 0.08 * (Math.random() - 0.5);
    L.position.set(x + Math.sin(t * 7 + n) * 0.05, y + (f.kind === 'forge' ? 0.8 : torch ? 0.35 : 0.7), z + Math.cos(t * 6 + n) * 0.05);
    L.distance = torch ? 9 : f.kind === 'forge' ? 10 : 12;
    L.intensity = (f.kind === 'forge' ? 5 : torch ? 4.5 * Math.max(0.3, nightK) : 7) * f.k * fl * (1 - Math.min(1, Math.max(0, (d - 90) / 20)));
    L.color.setRGB(1, 0.55 + 0.1 * fl, 0.22);
  }
  for (let i = n; i < POOL; i++) pool[i].intensity = 0;
  for (let i = 0; i < FLASH; i++) {
    const L = pool[POOL + i], F = flashes[i];
    if (!F) { L.intensity = 0; continue; }
    F.t += dt; const k = Math.max(0, 1 - F.t / F.d);
    L.position.set(F.x, F.y, F.z); L.color.copy(F.col); L.distance = 8; L.intensity = F.k * k * k;
  }
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t >= flashes[i].d) flashes.splice(i, 1);
  GPU_STATS.lights = n + flashes.length; GPU_STATS.fires = near.length;
}

// ---------------------------------------------------------------------------
// Stage 3, dense foliage: one instanced draw of grass blades placed entirely on the GPU. Each instance index maps to a
// cell of a grid that scrolls with the player; the vertex shader jitters it by a stable world hash, reads ground height
// and a "grass allowed" mask from a baked texture (no roads, sand, cobbles, water or buildings), and applies wind and
// trampling by the same pushers the WebGL grass uses. No per-frame CPU work besides two uniforms.
// ---------------------------------------------------------------------------
let grass = null;
const G_ORIGIN = uniform(new THREE.Vector2()), G_ON = uniform(1);
function bakeGround() {
  const R = 512, H = WORLD_HALF, data = new Uint16Array(R * R * 4), toH = THREE.DataUtils.toHalfFloat;
  const t0 = performance.now();
  // ground mask (R dirt, G sand, B cobbles) read back from its canvas: grass only where all three are low
  let md = null, MN = 0; const mc = TERRAIN_MASK.tex && TERRAIN_MASK.tex.image;
  if (mc && mc.getContext) { MN = mc.width; md = mc.getContext('2d').getImageData(0, 0, MN, MN).data; }
  const bareAt = (x, z) => { if (!md) return 0; const px = Math.floor((x / TERRAIN_MASK.size + 0.5) * MN), pz = Math.floor((z / TERRAIN_MASK.size + 0.5) * MN);
    if (px < 0 || pz < 0 || px >= MN || pz >= MN) return 0; const o = (pz * MN + px) * 4; return Math.max(md[o], md[o + 1], md[o + 2]) / 255; };
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const x = (i + 0.5) / R * 2 * H - H, z = (j + 0.5) / R * 2 * H - H, o = (j * R + i) * 4;
    const bare = bareAt(x, z);
    const ok = bare < 0.3 && Math.hypot(x, z) > 8.8 && Math.hypot(x - 50, z + 24) > 6 && !insideLake(x, z, 0.6) && !inCave(x, z) && !blockedAt(x, z) && Math.abs(x) < H - 3 && Math.abs(z) < H - 3;
    data[o] = toH(terrainHeight(x, z)); data[o + 1] = toH(ok ? 1 - Math.max(0, bare - 0.1) * 4 : 0); data[o + 2] = 0; data[o + 3] = toH(1);
  }
  const tex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  GPU_STATS.bakeMs = Math.round(performance.now() - t0);
  return tex;
}
function bladeGeometry() {
  // 7-vertex tapered blade with a slight curve, 0..1 in height
  const g = new THREE.BufferGeometry(), P = [], U = [], I = [];
  const rows = [[0, 0.075], [0.35, 0.062], [0.7, 0.038], [1, 0]];
  rows.forEach(([y, w], r) => { const bend = y * y * 0.18; if (w > 0) { P.push(-w, y, bend, w, y, bend); U.push(0, y, 1, y); } else { P.push(0, y, bend); U.push(0.5, y); } });
  I.push(0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
function initGrass() {
  if (/nograss/.test(location.search)) return;
  const gpu = BACKEND.name === 'WebGPU';
  const SIDE = gpu ? 300 : 180, S = gpu ? 0.26 : 0.34, COUNT = SIDE * SIDE, HALF = SIDE * S / 2;
  const ground = bakeGround(), HW = WORLD_HALF;
  const mask = TERRAIN_MASK.tex;
  const pushU = uniformArray(PUSH.value, 'vec4');
  const raw = attribute('position', 'vec3');
  const i = float(instanceIndex), gx = i.mod(SIDE), gz = floor(i.div(SIDE));
  const cell = G_ORIGIN.add(vec2(gx, gz).mul(S)).sub(HALF);
  const wc = floor(cell.div(S).add(0.5));
  const h1 = hash(wc.x.mul(7919).add(wc.y.mul(104729))), h2 = hash(wc.x.mul(15485).add(wc.y.mul(32452)).add(11)), h3 = hash(wc.x.mul(3571).add(wc.y.mul(9973)).add(23));
  const p = cell.add(vec2(h1, h2).sub(0.5).mul(S * 1.1));
  const g = texture(ground, p.div(2 * HW).add(0.5)).level(0);
  const dC = length(p.sub(G_ORIGIN));
  const fade = float(1).sub(smoothstep(HALF * 0.62, HALF * 0.98, dC));
  const k = smoothstep(0.35, 0.8, g.y).mul(fade).mul(step(g.x, 16.0)).mul(G_ON);
  const ht = h3.mul(0.6).add(0.55).mul(k).mul(smoothstep(0.0, 0.25, k).mul(0.5).add(0.5));
  const yaw = h1.mul(6.2832), cy = cos(yaw), sy = sin(yaw);
  const pos = Fn(() => {
    const v = vec3(raw.x.mul(cy).sub(raw.z.mul(sy)), raw.y.mul(ht), raw.x.mul(sy).add(raw.z.mul(cy))).toVar();
    const tip = raw.y.mul(raw.y);
    const ph = p.x.mul(0.31).add(p.y.mul(0.17));
    v.x.addAssign(sin(TIME.mul(1.6).add(ph)).mul(0.07).add(sin(TIME.mul(3.7).add(ph.mul(2.3))).mul(0.025)).mul(tip).mul(ht).mul(SWAY.mul(0.8).add(0.2)));
    v.z.addAssign(cos(TIME.mul(1.3).add(ph.mul(1.2))).mul(0.05).mul(tip).mul(ht).mul(SWAY.mul(0.8).add(0.2)));
    for (let n = 0; n < 4; n++) {
      const P = pushU.element(n), dv = p.sub(P.xy), dd = length(dv);
      const f = float(1).sub(smoothstep(P.z.mul(0.25), P.z.mul(1.1), dd)).mul(P.w).mul(step(0.0001, P.w));
      const dir = select(dd.greaterThan(1e-3), dv.div(max(dd, 1e-3)), vec2(1, 0));
      v.x.addAssign(dir.x.mul(f).mul(tip).mul(ht).mul(0.95)); v.z.addAssign(dir.y.mul(f).mul(tip).mul(ht).mul(0.95));
      v.y.mulAssign(float(1).sub(f.mul(0.5)));
    }
    // blades where grass isn't allowed collapse to a point (zero area) instead of lying flat as dark specks
    return vec3(p.x, g.x.add(0.01), p.y).add(v.mul(step(0.03, ht)));
  })();
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
  m.positionNode = pos;
  const yv = uvNode().y, tone = hash(wc.x.mul(31).add(wc.y.mul(57)).add(5));
  const base = mix(vec3(0.09, 0.2, 0.035), vec3(0.13, 0.26, 0.05), tone), tipC = mix(vec3(0.24, 0.42, 0.08), vec3(0.42, 0.5, 0.14), tone.mul(tone));
  m.colorNode = mix(base, tipC, yv.pow(0.8));
  m.emissiveNode = vec3(0.35, 0.5, 0.12).mul(yv.pow(3)).mul(0.04);   // a hint of light through the tips
  if (/gdbg/.test(location.search)) { m.colorNode = varying(vec3(g.y, 0, 0)); m.positionNode = Fn(() => vec3(p.x, g.x.add(0.05), p.y).add(raw.mul(vec3(4, 0.6, 4))))(); }
  grass = new THREE.InstancedMesh(bladeGeometry(), m, COUNT);
  grass.frustumCulled = false; grass.castShadow = false; grass.receiveShadow = true; grass.renderOrder = 1;
  ctx.scene.add(grass);
  GPU_STATS.grass = COUNT;
}
export function updateGrassField(p, q) {
  if (!grass) return;
  const S = BACKEND.name === 'WebGPU' ? 0.26 : 0.34;
  G_ORIGIN.value.set(Math.round(p.x / S) * S, Math.round(p.z / S) * S);
  G_ON.value = q === 'low' || inCave(p.x, p.z) ? 0 : 1;
  grass.visible = G_ON.value > 0;
}
