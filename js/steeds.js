// Shiftsteeds: summonable rides. Faster than running, a little faster again on roads.
// The Ironbristle Boar can shift into Bulwark form: armoured for a few seconds and charges forward.
// Every steed is one small merged mesh (same on Low and High). The Bulwark armour plates are the only
// High-only model: built lazily the first time they are needed on a non-Low frame, never on Low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './world.js';

export const STEEDS = [
  { id: 'stag', name: 'Fernback Stag', agility: 10, speed: 1.45, desc: 'A swift forest stag. Fastest on roads.', body: 0x8a5a34, belly: 0xd8c0a0, horn: 0xe8dcc0 },
  { id: 'boar', name: 'Ironbristle Boar', agility: 30, speed: 1.3, desc: 'A sturdy war-boar. Shifts into Bulwark form: armoured and charging.', body: 0x4a3a32, belly: 0x6a5a4a, horn: 0xf0e8d8, shift: true }
];
export const ROAD_BONUS = 1.15;
export const BULWARK = { ms: 6000, cdMs: 20000, reduce: 0.3, chargeDist: 5, chargeMs: 350 };
export function steedById(id) { return STEEDS.find(s => s.id === id); }

// Save block: { owned: [...ids], active: id|null }
export function normalizeSteeds(s) {
  const out = { owned: [], active: null };
  if (s && typeof s === 'object') {
    if (Array.isArray(s.owned)) out.owned = s.owned.filter(id => steedById(id));
    if (s.active && out.owned.includes(s.active)) out.active = s.active;
  }
  return out;
}
// Grants any steed the player's Agility now qualifies for. Returns newly granted steeds.
export function grantSteeds(st, agility) {
  const got = [];
  for (const s of STEEDS) if (agility >= s.agility && !st.owned.includes(s.id)) { st.owned.push(s.id); got.push(s); }
  return got;
}

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, color);
}
function cyl(r1, r2, h, x, y, z, color, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(r1, r2, h, 6); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return paint(g, color);
}
function blob(sx, sy, sz, x, y, z, color) {
  const g = new THREE.SphereGeometry(1, 8, 6); g.scale(sx, sy, sz); g.translate(x, y, z); return paint(g, color);
}
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// One merged body plus four leg meshes (for a simple trot swing).
export function buildSteed(def) {
  const g = new THREE.Group(); g.name = 'steed-' + def.id;
  const stag = def.id === 'stag', L = stag ? 0.85 : 0.55, bodyY = L + (stag ? 0.35 : 0.3);
  const parts = [blob(0.38, stag ? 0.36 : 0.42, 0.85, 0, bodyY, 0, def.body), blob(0.3, 0.2, 0.7, 0, bodyY - 0.18, 0, def.belly)];
  if (stag) {
    parts.push(cyl(0.13, 0.18, 0.6, 0, bodyY + 0.35, 0.72, def.body, -0.6), blob(0.15, 0.16, 0.3, 0, bodyY + 0.62, 0.95, def.body));
    for (const s of [-1, 1]) parts.push(cyl(0.025, 0.035, 0.5, s * 0.12, bodyY + 0.95, 0.85, def.horn, 0, s * -0.5), cyl(0.02, 0.025, 0.25, s * 0.25, bodyY + 1.05, 1.0, def.horn, 0.8, s * -0.3));
  } else {
    parts.push(blob(0.28, 0.27, 0.38, 0, bodyY + 0.05, 0.85, def.body), box(0.2, 0.14, 0.12, 0, bodyY - 0.02, 1.2, 0x8a6a5a));
    for (const s of [-1, 1]) parts.push(cyl(0.025, 0.04, 0.22, s * 0.14, bodyY + 0.02, 1.15, def.horn, -0.9, s * 0.3));
    parts.push(box(0.06, 0.12, 1.0, 0, bodyY + 0.42, 0, 0x2a2420)); // bristle ridge
  }
  parts.push(box(0.5, 0.06, 0.55, 0, bodyY + (stag ? 0.36 : 0.42), -0.05, 0x5a2a20)); // saddle
  const body = new THREE.Mesh(mergeGeometries(parts), MAT); body.castShadow = true; g.add(body);
  g.userData.legs = [];
  for (const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, L, z);
    const leg = new THREE.Mesh(cyl(0.06, stag ? 0.04 : 0.07, L, 0, -L / 2, 0, def.body), MAT); pivot.add(leg); g.add(pivot); g.userData.legs.push(pivot);
  }
  g.userData.seatY = bodyY + (stag ? 0.38 : 0.44) - 0.95; // player hips sit about 0.95 above their feet
  g.userData.body = body;
  return g;
}

// High-only Bulwark armour: plated barding and a horned brow plate. Never called on Low.
export function buildBulwarkArmor() {
  const steel = 0x9aa4b0, trim = 0xc8a040, parts = [];
  for (let i = 0; i < 5; i++) parts.push(box(0.9, 0.08, 0.32, 0, 1.15 - Math.abs(i - 2) * 0.03, -0.6 + i * 0.3, i % 2 ? trim : steel));
  for (const s of [-1, 1]) { parts.push(box(0.06, 0.4, 1.4, s * 0.44, 0.85, 0, steel)); parts.push(cyl(0.03, 0.05, 0.35, s * 0.2, 1.05, 1.15, trim, -1.0, s * 0.4)); }
  parts.push(box(0.4, 0.3, 0.1, 0, 0.95, 1.12, steel));
  const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
  m.name = 'bulwark-armor-high'; return m;
}

// Per-frame pose: legs trot with speed; the steed sits under the rider.
export function poseSteed(g, pos, facing, moved, dt, t) {
  g.position.set(pos.x, terrainHeight(pos.x, pos.z), pos.z); g.rotation.y = facing;
  const sp = Math.min(1, moved / Math.max(1e-4, dt) / 8), ph = t * 11;
  g.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 * sp; });
  g.userData.body.position.y = Math.abs(Math.sin(ph)) * 0.05 * sp;
}
