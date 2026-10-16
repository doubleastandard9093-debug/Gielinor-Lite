// WebGPU release extras: backend badge now; many-lights, dense foliage and cascaded shadows hook in here in later stages.
import { BACKEND } from './scene.js';
let badge = null;
export function initGpuExtras(ctx) {
  badge = document.createElement('div');
  badge.id = 'gpuBadge';
  badge.textContent = BACKEND.name === 'WebGPU' ? 'WebGPU' : 'WebGL2 fallback';
  badge.title = BACKEND.name === 'WebGPU' ? 'Rendering with WebGPU' : 'This browser has no WebGPU, so the WebGPU build is running on its WebGL2 backend';
  badge.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(4px + env(safe-area-inset-top,0px));z-index:30;pointer-events:none;' +
    'font:600 11px Georgia,serif;letter-spacing:.04em;padding:2px 8px;border-radius:9px;border:1px solid #d4af37;' +
    (BACKEND.name === 'WebGPU' ? 'background:rgba(20,60,30,.82);color:#bff5c8' : 'background:rgba(70,45,10,.82);color:#ffd99a');
  document.body.appendChild(badge);
  window.gielinorBackend = BACKEND.name;
}
export function setGpuQuality(q) {}
export function updateGpuExtras(dt, now, p, q) {}
