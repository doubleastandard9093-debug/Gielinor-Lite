// Day/night cycle: moves the sun (and a moon at night) across the sky and drives the sky, fog, water,
// sunlight colour and intensity from it. One full day lasts DAY_SECONDS of real time and follows the wall
// clock, so it continues across reloads. Setting 'timeOfDay': 'cycle' (default) or 'day' (fixed morning).
import * as THREE from 'three';
import { SUN_DIR, SKY } from './gfx.js';

export const DAY_SECONDS = 1800; // 30 minutes per in-game day
const C = h => new THREE.Color(h);
const PAL = {
  top:     { night: C(0x081226), gold: C(0x4d6aa6), day: C(0x3f7fd0) },
  horizon: { night: C(0x1a2440), gold: C(0xeeb487), day: C(0xbfdcf0) },
  sun:     { night: C(0x9ab0ff), gold: C(0xffa25a), day: C(0xfff0c8) },
  light:   { night: C(0x7f9cff), gold: C(0xffa868), day: C(0xffdcae) },
  hemiSky: { night: C(0x5a6fa8), gold: C(0xffd2b0), day: C(0xcfe4ff) }
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c = new THREE.Color();
function pick(p, w) { // w: { night, gold, day } weights summing to 1
  _c.setRGB(0, 0, 0);
  for (const k of ['night', 'gold', 'day']) { _c.r += p[k].r * w[k]; _c.g += p[k].g * w[k]; _c.b += p[k].b * w[k]; }
  return _c;
}
export const DAY = { t: 0.32, sunH: 0.6, night: 0, lightDir: new THREE.Vector3(0.55, 0.62, 0.42).normalize(),
  hemiK: 1, dirK: 1, fillK: 1, exposureK: 1, fog: new THREE.Color(0xbfdcf0), lightCol: new THREE.Color(0xffdcae), hemiCol: new THREE.Color(0xcfe4ff) };

// t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
export function dayTimeNow(mode) {
  if (mode === 'day') return 0.36;
  return ((Date.now() / 1000) / DAY_SECONDS + 0.36) % 1;
}
export function updateDay(mode, tOverride) {
  const t = tOverride ?? dayTimeNow(mode); DAY.t = t;
  const ang = (t - 0.25) * Math.PI * 2;           // sun angle above the eastern horizon
  const h = Math.sin(ang) * 0.78;                   // sun height (sin of elevation)
  const az = 0.95 + (t - 0.5) * 1.6;               // swings south-east -> south -> south-west
  const flat = Math.sqrt(Math.max(0, 1 - h * h));
  SUN_DIR.set(Math.cos(az) * flat, h, Math.sin(az) * flat * 0.8).normalize();
  DAY.sunH = h;
  const night = sm(0.04, -0.16, h), gold = (1 - night) * (1 - sm(0.12, 0.42, h)), day = 1 - night - gold;
  const w = { night, gold, day }; DAY.night = night; DAY.gold = gold; SKY.gold = gold;
  SKY.top.copy(pick(PAL.top, w)); SKY.horizon.copy(pick(PAL.horizon, w)); SKY.sun.copy(pick(PAL.sun, w));
  DAY.fog.copy(SKY.horizon); DAY.lightCol.copy(pick(PAL.light, w)); DAY.hemiCol.copy(pick(PAL.hemiSky, w));
  // the shadow-casting light follows the sun by day and the moon (opposite side, high) by night,
  // never dropping below ~14 degrees so shadows stay a sensible length
  const lx = night > 0.5 ? -SUN_DIR.x : SUN_DIR.x, lz = night > 0.5 ? -SUN_DIR.z : SUN_DIR.z;
  const ly = Math.max(0.25, night > 0.5 ? 0.75 : Math.abs(h));
  DAY.lightDir.set(lx, ly, lz).normalize();
  // the light swaps from sun to moon while it is dimmest around the horizon
  const swap = sm(0.0, 0.1, Math.abs(h));
  DAY.dirK = (day + gold * 0.75) * swap + night * 0.28 * swap;
  DAY.hemiK = 1 - night * 0.55 - gold * 0.1;
  DAY.fillK = 1 - night * 0.4;
  DAY.exposureK = 1 + night * 0.22;
  return DAY;
}
export function dayLabel(t = DAY.t) {
  const m = Math.floor(t * 24 * 60), hh = Math.floor(m / 60), mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
