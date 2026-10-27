// Sails of Sarim: the open sea (the Sarim Sound), its islands, and your ship.
// The Sound lies past the world's south edge; you reach it from the Port Sarim docks.
// Data and cheap geometry only. Low: one merged hull mesh, no sails cloth, no wake. High adds sails and a wake.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SEA = { x: 0, z: 1000, r: 170, z0: 760 };          // anything with z > z0 is the Sound
export const SARIM_DOCK = { x: -80, z: 76 };                       // where you board in Port Sarim
export const SEA_ENTRY = { x: -40, z: 870, yaw: 0 };               // where the ship appears in the Sound
export const ISLANDS = [
  { id: 'gullrest', name: 'Gullrest', x: -70, z: 960, r: 26, port: true, dock: { x: -70, z: 932 }, desc: 'A fishing port of stilt houses and gull cries.' },
  { id: 'brineholt', name: 'Brineholt', x: 80, z: 1030, r: 24, port: true, dock: { x: 54, z: 1030 }, desc: 'A smugglers\' harbour with a rowdy tavern.' },
  { id: 'reef', name: 'Wreckers\' Reef', x: 10, z: 1120, r: 22, port: false, dock: { x: 10, z: 1096 }, desc: 'Black rock and broken hulls, where the Drowned Crew gather.' }
];
export const HULLS = [
  { n: 1, name: 'Sloop', hp: 120, speed: 9, guns: 2, cost: 2000, req: null },
  { n: 2, name: 'Brigantine', hp: 200, speed: 8.2, guns: 3, cost: 6000, req: { Smithing: 30, Crafting: 25 }, mats: [['Steel bar', 10], ['Oak logs', 20]] },
  { n: 3, name: 'Galleon', hp: 300, speed: 7.6, guns: 4, cost: 15000, req: { Smithing: 50, Crafting: 40 }, mats: [['Steel bar', 25], ['Willow logs', 40]] }
];
// Officer traits for Sworn Companions who sail with you.
export const OFFICERS = {
  tamsin: { trait: 'surgeon', desc: 'repairs 1 hull point every 2 s at sea' },
  ysolde: { trait: 'lookout', desc: '+25% cannon range' },
  brannoc: { trait: 'gunnery', desc: '+30% cannon damage' },
  mirelle: { trait: 'helm', desc: '+12% sailing speed' }
};
export const CREW_COST = 150, CREW_MAX = 6;   // each deckhand reloads guns 8% faster
export function islandAt(x, z, pad = 0) { for (const i of ISLANDS) if (Math.hypot(x - i.x, z - i.z) < i.r + pad) return i; return null; }
export function inSound(x, z) { return z > SEA.z0; }
// Ground height in the Sound: islands are low, gently domed land; elsewhere the sea floor.
export function inSea(x, z) { return z > SEA.z0 && Math.hypot(x - SEA.x, z - SEA.z) < SEA.r + 40; }
export function seaGround(x, z) {
  const i = islandAt(x, z); if (!i) return -2;
  return Math.hypot(x - i.x, z - i.z) < i.r * 0.75 ? 1.3 : 1.0;
}
// Keep walkers on their island (pushes back from the shoreline).
export function clampToIsland(pos) {
  if (!inSound(pos.x, pos.z)) return;
  let best = null, bd = Infinity;
  for (const i of ISLANDS) { const d = Math.hypot(pos.x - i.x, pos.z - i.z) - i.r; if (d < bd) { bd = d; best = i; } }
  if (bd > -i_pad(best)) { const ax = pos.x - best.x, az = pos.z - best.z, d = Math.hypot(ax, az) || 1; pos.x = best.x + ax / d * (best.r - i_pad(best)); pos.z = best.z + az / d * (best.r - i_pad(best)); }
  pushOutOfHouses(pos);
}
const i_pad = i => i.r * 0.1 + 0.4;
// Port houses (4 per port island) — also solid to walkers.
export const HOUSES = [];
for (const i of ISLANDS) if (i.port) { const ang = Math.atan2(i.dock.x - i.x, i.dock.z - i.z); for (let h = 0; h < 4; h++) { const a = ang + Math.PI * 0.6 + h * 0.9, rr = i.r * 0.45; HOUSES.push({ x: i.x + Math.sin(a) * rr, z: i.z + Math.cos(a) * rr, h }); } }
function pushOutOfHouses(pos) { for (const b of HOUSES) { const dx = pos.x - b.x, dz = pos.z - b.z; if (Math.abs(dx) < 2.5 && Math.abs(dz) < 2.5) { if (Math.abs(dx) > Math.abs(dz)) pos.x = b.x + Math.sign(dx || 1) * 2.5; else pos.z = b.z + Math.sign(dz || 1) * 2.5; } } }
export function normalizeVessel(v) {
  v = v && typeof v === 'object' ? v : {};
  const hull = Math.max(0, Math.min(3, Math.floor(Number(v.hull) || 0)));
  const H = HULLS[Math.max(0, hull - 1)];
  return { hull, hp: hull ? Math.max(1, Math.min(H.hp, Math.floor(Number(v.hp) || H.hp))) : 0, crew: Math.max(0, Math.min(CREW_MAX, Math.floor(Number(v.crew) || 0))),
    officers: Array.isArray(v.officers) ? [...new Set(v.officers.filter(o => OFFICERS[o]))].slice(0, 4) : [], sunk: Math.max(0, Math.floor(Number(v.sunk) || 0)),
    sank: Math.max(0, Math.floor(Number(v.sank) || 0)), drowned: Math.max(0, Math.floor(Number(v.drowned) || 0)),
    // Treasure charts you've read: each marks a dig spot on an island.
    charts: Array.isArray(v.charts) ? v.charts.filter(c => c && isFinite(c.x) && isFinite(c.z) && typeof c.isl === 'string').slice(0, 5).map(c => ({ x: +c.x, z: +c.z, isl: c.isl, tier: Math.max(1, Math.min(3, c.tier | 0 || 1)) })) : [],
    dug: Math.max(0, Math.floor(Number(v.dug) || 0)),
    cards: { won: Math.max(0, Math.floor(Number(v.cards && v.cards.won) || 0)), lost: Math.max(0, Math.floor(Number(v.cards && v.cards.lost) || 0)) } };
}

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}
const box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, c); };
const cyl = (r1, r2, h, x, y, z, c, seg = 6) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y, z); return paint(g, c); };
export const SEA_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// Ship: one merged hull+deck+mast mesh (all tiers). opts.sails adds cloth sails (High only). opts.hull 1-3 scales it.
export function buildShip(opts = {}) {
  const k = [1, 1, 1.2, 1.45][opts.hull || 1], wood = opts.enemy ? 0x2a3a34 : 0x6a4a2a, trim = opts.enemy ? 0x5a7a6a : 0xc8a040;
  const hullShape = new THREE.Shape(); hullShape.moveTo(-1.3, 0); hullShape.lineTo(1.3, 0); hullShape.lineTo(1.6, 1.0); hullShape.lineTo(-1.6, 1.0); hullShape.closePath();
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 7, bevelEnabled: false }); hull.translate(0, -0.3, -3.5);
  const parts = [paint(hull, wood), box(3.0, 0.12, 6.6, 0, 0.72, 0, 0x8a6a42), box(1.4, 0.9, 1.4, 0, 1.2, -2.6, wood), box(3.3, 0.14, 0.2, 0, 1.0, 3.4, trim),
    cyl(0.12, 0.14, 7, 0, 4.2, 0.4, 0x4a3420), cyl(0.06, 0.06, 3.6, 0, 6.6, 0.4, 0x4a3420)];
  const prow = new THREE.ConeGeometry(0.9, 1.6, 4); prow.rotateX(Math.PI / 2); prow.translate(0, 0.45, 4.2); parts.push(paint(prow, wood));
  for (const s of [-1, 1]) for (let i = 0; i < (opts.guns || 2); i++) { const g = new THREE.CylinderGeometry(0.13, 0.16, 0.8, 6); g.rotateZ(Math.PI / 2); g.translate(s * 1.75, 0.9, 1.6 - i * 1.4); parts.push(paint(g, 0x1a1a1a)); }
  if (!opts.sails) parts.push(box(0.05, 3.4, 2.8, 0, 4.4, 0.4, opts.enemy ? 0x3a4a42 : 0xe8dcc0)); // flat sail stand-in on Low
  const grp = new THREE.Group(); grp.name = opts.enemy ? 'ship-enemy' : 'ship-player';
  const m = new THREE.Mesh(mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)), SEA_MAT); m.castShadow = !opts.low; grp.add(m);
  if (opts.sails) {
    const sailMat = new THREE.MeshStandardMaterial({ color: opts.enemy ? 0x3a4a42 : 0xf0e6cc, roughness: 0.9, side: THREE.DoubleSide });
    const sg = new THREE.PlaneGeometry(3.2, 3.0, 4, 3); const pos = sg.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 3.2 + 0.5) * Math.PI) * 0.45);
    for (const [y, sc] of [[4.4, 1], [6.9, 0.7]]) { const s = new THREE.Mesh(sg, sailMat); s.rotation.y = Math.PI / 2; s.position.set(0, y, 0.55); s.scale.setScalar(sc); s.name = 'sail-high'; grp.add(s); }
  }
  grp.scale.setScalar(k);
  return grp;
}
// The Sound: one big flat water disc (no texture), plus island meshes.
export function buildSound(quality) {
  const g = new THREE.Group(); g.name = 'sarim-sound';
  const water = new THREE.Mesh(new THREE.CircleGeometry(SEA.r + 60, quality === 'low' ? 24 : 64), new THREE.MeshStandardMaterial({ color: 0x2a5a78, roughness: 0.35, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(SEA.x, 0, SEA.z); water.receiveShadow = quality !== 'low'; g.add(water);
  const parts = [];
  for (const i of ISLANDS) {
    const top = new THREE.CylinderGeometry(i.r * 0.92, i.r + 2, 1.6, quality === 'low' ? 14 : 28); top.translate(i.x, 0.2, i.z); parts.push(paint(top, i.port ? 0xc8b07a : 0x3a3a3a));
    const grass = new THREE.CylinderGeometry(i.r * 0.75, i.r * 0.85, 0.5, quality === 'low' ? 12 : 24); grass.translate(i.x, 1.05, i.z); parts.push(paint(grass, i.port ? 0x4a7a3a : 0x2a2a30));
    const dx = i.dock.x - i.x, dz = i.dock.z - i.z, d = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const dock = new THREE.BoxGeometry(2.2, 0.3, 9); dock.translate(0, 0.9, i.r - 2); dock.rotateY(ang); dock.translate(i.x, 0, i.z); parts.push(paint(dock, 0x7a5a3a));
    if (!i.port) for (let h = 0; h < 6; h++) { const a = h * 1.05, rr = i.r * 0.55; const r = new THREE.ConeGeometry(1.6, 4 + (h % 3), 5); r.translate(i.x + Math.sin(a) * rr, 2.5, i.z + Math.cos(a) * rr); parts.push(paint(r, 0x1e1e24)); }
  }
  for (const b of HOUSES) { const g = new THREE.BoxGeometry(4, 3, 4); g.translate(b.x, 2.6, b.z); parts.push(paint(g, [0xd8c8a0, 0xb89a7a, 0xc8b48a, 0xa88a6a][b.h])); const roof = new THREE.ConeGeometry(3.3, 1.8, 4); roof.rotateY(Math.PI / 4); roof.translate(b.x, 5, b.z); parts.push(paint(roof, 0x7a3a2a)); }
  const land = new THREE.Mesh(mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)), SEA_MAT); land.receiveShadow = quality !== 'low'; g.add(land);
  return g;
}
