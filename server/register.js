import { register } from 'node:module';
register('./three-hooks.js', import.meta.url);
// Minimal browser stubs so js/world.js can build its layout headlessly (no rendering happens).
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.window ??= { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800 };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }) };
globalThis.navigator ??= { maxTouchPoints: 0 };
