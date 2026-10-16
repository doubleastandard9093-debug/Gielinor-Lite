// WebGPU release extras.
// - Backend badge.
// - Stage 2, many lights: on the WebGPU backend the renderer switches to tiled lighting (a compute pass bins point lights
//   into 32 px screen tiles), so a fixed pool of 256 point lights can be handed to every fire, forge and torch within
//   ~110 m plus short flashes for spells and hits. The WebGL2 fallback keeps the WebGL game's 12-light pool.
import * as THREE from 'three';
import { BACKEND } from './scene.js';
import { FIRES, GPU_LIGHTS, setVfxQuality } from './vfx.js';
import { TiledLighting } from 'three/addons/lighting/TiledLighting.js';
import { DAY } from '../../js/daycycle.js';

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
  badge.textContent = (BACKEND.name === 'WebGPU' ? 'WebGPU' : 'WebGL2 fallback') + (tiled ? ' · tiled lights' : '');
}
export function setGpuQuality(q) { quality = q; }

export function updateGpuExtras(dt, now, p, q) {
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
