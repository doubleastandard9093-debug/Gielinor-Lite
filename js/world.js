import * as THREE from 'three';
import { makeRng } from './rng.js';
import { MONSTER_TYPES, AGILITY_COURSES, RUNE_ALTARS, BOUNTIES } from './gameplay.js';
import { agilityStyle, swingGeom } from './agilityAnim.js';
import { QUEST_NPCS } from './questnpcs.js';
import { addFire } from './vfx.js';
import { terrainMaterial, waterMaterial, hookWaterNoise, WATER_MESHES } from './gfx.js';
import { buildHumanoidRig, apronGeo, varyLook, hashStr, contactShadow, plateCharMat, chainCharMat } from './anatomy.js';
import { buildCreatureRig, rollVariant, namedVariant, loColours } from './creatures.js';
import { vcMat, foliageMat, bakedMesh, treeGeometry, rockGeometry, stumpGeometry, emptyRockGeometry, blob, paint, place as put, prim, col, snoise, bake, makeFoliageMat, tuftGeometry, flowerGeometry, humanoidParts, npcExtras, legPivot, creatureParts, hairCap, treeMat, treeDepthMat, setMat, woodAxis, buildMat } from './models.js';

// The world is about 440 x 440. Chunked decor + instance packing keep phones smooth.
export const WORLD_HALF = 300;
export const CHUNK_SIZE = 64; // decor / clutter streaming grid

export const SPAWN = { x: 0, z: 0 };
export const LAKE = { x: -20, z: 16, r: 7 };
// Town centres. Names with spaces need quotes.
export const TOWNS = {
  Brightwater: { x: 0, z: 0 },
  Ashford: { x: 50, z: -24 },
  'Port Sarim': { x: -80, z: 60 },
  Varrock: { x: 120, z: -40 },
  Falador: { x: -60, z: -80 }
};
export const TOWN_NAME = 'Brightwater';
export const PATHS = [[0, 0, 13, -12], [0, 0, -15, -13], [0, 0, -15, 12], [0, 0, 20, 17], [0, 0, 0, 24], [0, 0, 0, -27], [0, 0, 5, -7.4], [0, 0, 50, -20], [50, -20, 55, -35],
  // roads to the new towns
  [0, 24, -30, 45], [-30, 45, -80, 60], [60, -22, 90, -30], [90, -30, 120, -40], [-15, -13, -35, -50], [-35, -50, -60, -80],
  // town streets and side roads
  [-80, 60, -80, 76], [120, -40, 120, -26], [120, -40, 132, -22], [-60, -80, -60, -68], [120, -40, 138, -40], [138, -40, 138, -60], [138, -60, 122, -112], [-60, -80, -95, -110], [-80, 76, -50, 88]];
// Buildings: [x, z, width(x), depth(z), wall colour, roof colour, name, examine]
export const BUILDINGS = [
  [-9.6, -2, 4, 6, 0x9a9488, 0x6a2a2a, 'Bank of Brightwater', 'Your money is safe here.'],
  [11.6, 0, 4, 6, 0xc8b48a, 0x3a5a8a, 'General Store', 'The Merchant trades here.'],
  [5, -10, 4, 4, 0xb89a6a, 0x8a4a2a, "Bob's Brilliant Tools", 'Axes, pickaxes and fishing gear.'],
  [-4, -12, 5, 7, 0xd8d0c0, 0x4a4a5a, 'Church of Saradomin', 'A peaceful place of worship.'],
  [7, 11.5, 5, 4, 0x6a5a4a, 0x3a3a3a, "Doric's Smithy", 'You can hear hammering inside.'],
  [-8, 10.5, 4, 4, 0xc8b48a, 0x8a3a2a, 'Cookhouse', 'Something smells delicious.'],
  [13, -6, 3, 3, 0xd0c0a0, 0x7a3a2a, 'House', 'A cosy cottage.'],
  [12.5, 7, 3, 3, 0xc0b090, 0x5a4a3a, 'House', 'A cosy cottage.'],
  [-12, 5.5, 3, 3, 0xd0c0a0, 0x3a5a3a, 'House', 'A cosy cottage.'],
  [-14, -7, 3, 3, 0xc0b090, 0x7a3a2a, 'House', 'A cosy cottage.'],
  // Ashford town (east)
  [48, -25, 5, 6, 0x8a7a6a, 0x5a3a2a, 'Ashford Bank', 'A smaller bank serving the eastern farms.'],
  [55, -18, 4, 5, 0xb8a878, 0x4a5a3a, 'Ashford Store', 'Local goods and supplies.'],
  [42, -32, 4, 4, 0x6a5a4a, 0x3a3a3a, 'Ashford Smithy', 'Hammering rings from the forge.'],
  [52, -35, 3, 3, 0xd0c0a0, 0x7a3a2a, 'Ashford House', 'A farmhouse.'],
  [60, -22, 3, 3, 0xc0b090, 0x5a4a3a, 'Ashford House', 'Another cottage.'],
  // Port Sarim (south-west, by the docks)
  [-88, 54, 5, 5, 0xc8b48a, 0x3a5a8a, 'Port Sarim General Store', 'Supplies for sailors and travellers.'],
  [-72, 54, 5, 5, 0x7a6a9a, 0x3a2a6a, "Betty's Magic Emporium", 'Runes, staffs and robes. Smells of incense.'],
  [-88, 67, 4, 4, 0xd0c0a0, 0x7a3a2a, 'Port Sarim House', 'A fisherman\'s cottage.'],
  [-71, 67, 6, 4, 0x8a6a4a, 0x4a3a2a, 'The Rusty Anchor', 'A noisy sailors\' tavern.'],
  // Varrock (far east)
  [120, -54, 11, 7, 0x9a9488, 0x5a5a6a, 'Varrock Palace', 'Home of King Roald.'],
  [110, -44, 5, 5, 0x6a5a4a, 0x3a3a3a, 'Varrock Weaponsmith', 'Swords and bows line the walls.'],
  [130, -44, 5, 5, 0xc8b48a, 0x8a3a2a, 'Varrock General Store', 'All sorts of odds and ends.'],
  [130, -33, 5, 4, 0x7a6a9a, 0x3a2a6a, "Aubury's Rune Shop", 'Aubury sells runes and knows the way to the essence mine.'],
  [110, -33, 4, 4, 0xd0c0a0, 0x5a4a3a, 'Varrock House', 'A townhouse.'],
  // Falador (north-west, the white city)
  [-60, -94, 11, 7, 0xe8e4dc, 0x4a5a7a, "White Knights' Castle", 'The White Knights guard Falador.'],
  [-70, -84, 5, 5, 0xd8d4cc, 0x5a5a6a, 'Falador Armoury', 'Cassie sells shields and plate armour.'],
  [-50, -84, 6, 4, 0xd8d0c0, 0x6a2a2a, 'Falador Inn', 'The Rising Sun inn.'],
  [-70, -72, 4, 4, 0xe0dcd0, 0x4a5a7a, 'Falador House', 'A white stone house.'],
  [-50, -72, 4, 4, 0xe0dcd0, 0x3a5a3a, 'Falador House', 'A white stone house.']
];
// Guilds: walk-in halls that check your level at the door. Contents are created in createWorld.
export const GUILDS = [
  { name: 'Mining Guild', skill: 'Mining', level: 60, x: 20, z: -62, w: 12, d: 10, wall: 0x7a7468, roof: 0x4a4a52,
    rocks: [['Coal', 4], ['Mithril', 2], ['Adamantite', 2], ['Runite', 1]], stations: ['furnace', 'anvil'], bank: true },
  { name: 'Cooking Guild', skill: 'Cooking', level: 32, x: 0, z: 60, w: 9, d: 8, wall: 0xd8d0c0, roof: 0x8a3a2a, stations: ['range', 'range'], bank: true },
  { name: 'Crafting Guild', skill: 'Crafting', level: 40, x: -22, z: 60, w: 9, d: 8, wall: 0xb89a6a, roof: 0x3a5a3a, stations: ['furnace', 'anvil'], bank: true }
];
for (const g of GUILDS) BUILDINGS.push([g.x, g.z, g.w, g.d, g.wall, g.roof, g.name, `Members need ${g.skill} level ${g.level} to enter.`]);
PATHS.push([0, -27, 20, -56], [0, 29, 0, 55], [0, 55, -22, 55]);
function nearestTown(x, z) {
  let best = TOWNS.Brightwater, bd = Infinity;
  for (const t of Object.values(TOWNS)) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
  return best;
}
// Solid areas the player can't walk through (filled in by createWorld).
export const colliders = [];
// Extra spots to keep level (points of interest added later register here).
export const FLAT_SPOTS = [];

// Shared geometry and materials keep memory and draw setup low on phones.
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone5: new THREE.ConeGeometry(1, 1, 8),
  cone7: new THREE.ConeGeometry(1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone4: new THREE.ConeGeometry(0.71, 1, 6),
  ring: new THREE.RingGeometry(0.35, 0.55, 24)
};
const matCache = new Map();
function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...(opts || {}) }));
  return matCache.get(key);
}

// Bake all the plain-coloured parts of a static model into one mesh (one draw call)
// using vertex colours. Glowing (unlit) parts stay separate.
function mergeStatic(group, material = vcMat) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const pos = [], nor = [], col = [], drop = [];
  const m = new THREE.Matrix4(), c = new THREE.Color();
  group.traverse(o => {
    if (!o.isMesh || !(o.material.isMeshStandardMaterial || o.material.isMeshLambertMaterial)) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    m.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(m);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    c.copy(o.material.color);
    const vc = g.attributes.color;
    for (let i = 0; i < g.attributes.position.count; i++) {
      if (vc) col.push(c.r * vc.getX(i), c.g * vc.getY(i), c.b * vc.getZ(i)); else col.push(c.r, c.g, c.b);
    }
    g.dispose();
    drop.push(o);
  });
  if (drop.length < 2) return;
  for (const o of drop) o.parent.remove(o);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function part(geo, color, sx, sy, sz, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

function tag(root, entity) {
  root.userData.entity = entity;
  return entity;
}


// ---- Elevation ----------------------------------------------------------------
// Natural relief (hills, ridges, valleys, a northern mountain range) multiplied by a
// flatness mask so towns, roads, buildings and work spots stay level. After the
// world is placed the result is baked into a 1-unit height grid (bilinear lookup).
const HF = { data: null, N: 0, off: 0 };
function ridge(v) { return 1 - Math.abs(v); }
export function reliefHeight(x, z) {
  const r = Math.hypot(x, z);
  // gentle near the centre, bigger toward the outer ring
  const amp = Math.min(1, Math.max(0, (r - 45) / 120));
  let h = 0;
  h += 3.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.018 - 0.7);
  h += 1.6 * Math.sin(x * 0.047 - z * 0.031 + 2.1);
  h += 0.7 * Math.sin(x * 0.11 + Math.cos(z * 0.07) * 1.7) * Math.cos(z * 0.09);
  // winding ridges
  h += 4.5 * Math.pow(Math.max(0, ridge(Math.sin(x * 0.012 + Math.sin(z * 0.017) * 1.8))), 3) * amp;
  // valleys: a long river-less dale running east-west south of the centre
  h -= 3.0 * Math.exp(-(((z - 175) / 22) ** 2)) * (0.6 + 0.4 * Math.sin(x * 0.02));
  h *= 0.35 + 0.65 * amp;
  // mountain range across the far north (negative z), peaks up to ~26
  const m = Math.max(0, Math.min(1, (-z - 185) / 60));
  if (m > 0) {
    const peaks = 0.55 + 0.45 * Math.sin(x * 0.035 + 0.6) * Math.cos(x * 0.013 - 1.1);
    const crag = Math.pow(Math.max(0, ridge(Math.sin(x * 0.06 + z * 0.02))), 2);
    h += m * m * (18 * peaks + 8 * crag);
  }
  // western highland plateau
  const w = Math.max(0, Math.min(1, (-x - 190) / 50)) * Math.max(0, 1 - Math.abs(z + 20) / 160);
  h += w * (7 + 2 * Math.sin(z * 0.05));
  return h;
}
function edgeHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - (WORLD_HALF + 3);
  if (d <= 0) return 0;
  const roll = 0.65 + 0.35 * Math.sin(x * 0.045 + Math.cos(z * 0.031) * 2.1) * Math.cos(z * 0.052 - x * 0.013);
  return Math.min(34, d * d * 0.018 * roll + d * 0.15);
}
export function terrainHeight(x, z) {
  const H = HF.data;
  if (!H) return edgeHeight(x, z);
  const gx = x + HF.off, gz = z + HF.off;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  if (ix < 0 || iz < 0 || ix >= HF.N - 1 || iz >= HF.N - 1) return edgeHeight(x, z) + reliefHeight(x, z) * 0.5;
  const fx = gx - ix, fz = gz - iz, i = iz * HF.N + ix;
  return (H[i] * (1 - fx) + H[i + 1] * fx) * (1 - fz) + (H[i + HF.N] * (1 - fx) + H[i + HF.N + 1] * fx) * fz;
}
// Surface normal-ish slope helper (for placing props upright on hills).
export function groundAt(x, z) { return terrainHeight(x, z); }
// flats: [{x, z, r}] circles and [{x1, z1, x2, z2, r}] segments kept level (blend over BLEND units).
export function bakeHeightField(flats, segs, boxes) {
  const BLEND = 10, M = WORLD_HALF + 70, N = M * 2 + 1;
  const D = new Float32Array(N * N).fill(1e9);
  const stamp = (x, z, r) => {
    const R = r + BLEND, x0 = Math.max(0, Math.floor(x - R + M)), x1 = Math.min(N - 1, Math.ceil(x + R + M)), z0 = Math.max(0, Math.floor(z - R + M)), z1 = Math.min(N - 1, Math.ceil(z + R + M));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const d = Math.hypot(ix - M - x, iz - M - z) - r, k = iz * N + ix;
      if (d < D[k]) D[k] = d;
    }
  };
  for (const f of flats) stamp(f.x, f.z, f.r);
  for (const sg of segs) { const L = Math.hypot(sg.x2 - sg.x1, sg.z2 - sg.z1), n = Math.max(1, Math.ceil(L)); for (let t = 0; t <= n; t++) stamp(sg.x1 + (sg.x2 - sg.x1) * t / n, sg.z1 + (sg.z2 - sg.z1) * t / n, sg.r); }
  for (const b of boxes) stamp((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 1.5);
  const H = new Float32Array(N * N);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const k = iz * N + ix, d = D[k], t = Math.max(0, Math.min(1, d / BLEND)), w = t * t * (3 - 2 * t);
    const x = ix - M, z = iz - M;
    H[k] = reliefHeight(x, z) * w + edgeHeight(x, z);
  }
  HF.data = H; HF.N = N; HF.off = M;
}

// Paint the ground mask in code: R = dirt (paths, mines), G = sand (shore), B = cobbles (squares).
function paintGroundMask(size) {
  const N = 1024, k = N / size;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  const X = x => (x + size / 2) * k, Z = z => (z + size / 2) * k;
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const blob = (x, z, r, rgb, a = 1) => {
    const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * k);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.6, `rgba(${rgb},${a * 0.8})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(X(x), Z(z), r * k, 0, Math.PI * 2); g.fill();
  };
  // soft-edged paths: several passes, wide + faint to narrow + strong
  for (const [w, a] of [[2.6, 0.25], [2.0, 0.35], [1.5, 0.5]]) {
    g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = w * k;
    for (const [x1, z1, x2, z2] of PATHS) { g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); }
  }
  blob(22, 20, 8, '255,0,0', 0.9);      // mine
  blob(-9, -28, 5.5, '255,0,0', 0.9);   // high-level mine
  blob(13, -13, 5, '255,0,0', 0.45);    // goblin camp
  blob(-18, -16, 7, '255,0,0', 0.3);    // trampled cow field
  blob(50, -25, 9, '255,0,0', 0.4);     // Ashford yard
  blob(LAKE.x, LAKE.z, LAKE.r + 2.6, '0,255,0', 1);
  blob(0, 0, 5.4, '0,0,255', 1);        // Brightwater square
  blob(50, -24, 3.5, '0,0,255', 0.9);   // Ashford square
  for (const [name, t] of Object.entries(TOWNS)) if (name !== 'Brightwater' && name !== 'Ashford') { blob(t.x, t.z, 12, '255,0,0', 0.35); blob(t.x, t.z, 5, '0,0,255', 1); }
  blob(132, -22, 6, '255,0,0', 0.9);     // Varrock essence mine
  blob(-80, 74, 6, '0,255,0', 0.8);      // Port Sarim sandy docks
  blob(122, -122, 18, '255,0,0', 0.45);  // scorched wilderness
  blob(130, -175, 7.8, '0,255,0', 1);    // mountain pond shore
  for (const [x, z, r] of [[-175, -150, 7], [205, 120, 12], [-225, 40, 6], [-205, 95, 6], [160, 205, 7], [-20, 230, 4], [60, -205, 8]]) blob(x, z, r, '255,0,0', 0.5); // trodden camps
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Small ponds out in the wilds (fishing). insideLake covers them too.
// Landmarks out in the wilds, listed on nearby signposts.
export const LANDMARKS = [
  { n: "Travellers' camp", x: -175, z: -150 }, { n: 'Old ruins', x: 205, z: 120 }, { n: 'Watchtower', x: -225, z: 40 }, { n: 'Bandit hideout', x: -205, z: 95 },
  { n: "Hunter's camp", x: 160, z: 205 }, { n: 'Wayside shrine', x: -20, z: 230 }, { n: 'Mountain cave', x: 60, z: -205 }, { n: 'Mountain pond', x: 130, z: -175 }
];
export const PONDS = [{ x: 130, z: -175, r: 5 }];
// Mountain cave: the entrance sits in the northern foothills; the cavern itself is a
// sealed chamber sunk into the high peaks that you travel into through the entrance.
export const CAVE = { x: 0, z: -272, r: 15, entrance: { x: 60, z: -205 }, inside: { x: 0, z: -259 }, outside: { x: 60, z: -201.5 } };
export function inCave(x, z) { return Math.hypot(x - CAVE.x, z - CAVE.z) < CAVE.r + 0.5; }
export function waterAt(x, z, pad = 0) {
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + pad) return LAKE;
  for (const p of PONDS) if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return p;
  return null;
}
export function insideLake(x, z, pad = 0) { return !!waterAt(x, z, pad); }

export function createWorld(scene) {
  const rng = makeRng(2004);
  const nodes = [];
  const monsters = [];
  const pickables = []; // root objects the tap raycast checks

  // ---- Terrain: one textured mesh (grass / dirt paths / sand / cobbles) ----
  // The play area is flat (feet stay on the ground); rolling hills rise beyond it.
  const MASK = WORLD_HALF * 2 + 10;
  const mask = paintGroundMask(MASK);
  const GSIZE = WORLD_HALF * 2 + 140, GSEG = Math.round(110 * (WORLD_HALF * 2 + 140) / 580);
  const groundGeo = new THREE.PlaneGeometry(GSIZE, GSIZE, GSEG, GSEG);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, terrainHeight(pos.getX(i), -pos.getY(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, terrainMaterial(mask, MASK));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Lake: animated water with shore foam (sand is painted into the ground).
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 0.25, 64), hookWaterNoise(waterMaterial(LAKE.x, LAKE.z, LAKE.r + 0.25)));
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, 0.05, LAKE.z);
  scene.add(water); WATER_MESHES.push(water);
  // Darker lake bed so the edge reads as depth
  const bed = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 0.3, 40), new THREE.MeshBasicMaterial({ color: 0x0c2a3a }));
  bed.rotation.x = -Math.PI / 2; bed.position.set(LAKE.x, 0.015, LAKE.z);
  scene.add(bed);

  const occupied = [];
  function free(x, z, r = 1.6, townR = 6) {
    if (Math.hypot(x, z) < townR) return false;
    if (insideLake(x, z, 2.2)) return false;
    if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return false;
    for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < r + o.r) return false;
    return true;
  }
  function place(cx, cz, spread, r, tries = 40, townR = 6) {
    for (let i = 0; i < tries; i++) {
      const x = cx + (rng() - 0.5) * spread * 2;
      const z = cz + (rng() - 0.5) * spread * 2;
      if (free(x, z, r, townR)) { occupied.push({ x, z, r }); return { x, z }; }
    }
    return null;
  }
  // Reserve the areas used by monsters and buildings.
  occupied.push({ x: 13, z: -13, r: 5 }, { x: -18, z: -16, r: 7 }, { x: 0, z: 27, r: 4 }, { x: 8, z: 0, r: 1.5 }, { x: -6, z: -2, r: 2 },
    { x: -2, z: -31, r: 6 }, { x: -16, z: -33, r: 5 });
  for (const pth of PATHS) for (let t = 0.1; t <= 1; t += 0.1) occupied.push({ x: pth[0] + (pth[2] - pth[0]) * t, z: pth[1] + (pth[3] - pth[1]) * t, r: 0.6 });

  // ---- Trees & rocks: InstancedMesh (one draw call per type) + invisible proxies for picking ----
  const treeGeoCache = {}, stumpGeoCache = {}, rockGeoCache = {}, emptyRockGeoCache = {};
  const pendingTrees = [], pendingRocks = [];
  const invisMat = new THREE.MeshBasicMaterial({ visible: false });
  const treeHitGeo = new THREE.BoxGeometry(1.4, 3.6, 1.4);
  const rockHitGeo = new THREE.BoxGeometry(1.6, 1.0, 1.6);
  const _im = new THREE.Matrix4(), _iq = new THREE.Quaternion(), _ie = new THREE.Euler(), _ip = new THREE.Vector3(), _is = new THREE.Vector3();
  function writeInstance(mesh, i, x, y, z, ry, sx, sy, sz) {
    _ie.set(0, ry, 0); _iq.setFromEuler(_ie);
    _im.compose(_ip.set(x, y, z), _iq, _is.set(sx, sy, sz));
    mesh.setMatrixAt(i, _im);
    mesh.instanceMatrix.needsUpdate = true;
  }
  // Rebuild one InstancedMesh so only nearby, living trees/rocks are drawn.
  function packGroup(group) {
    if (!group) return;
    let n = 0;
    for (const e of group.ents) {
      if (!e.alive || e.mesh.userData.culled || e.camHidden) continue;
      writeInstance(group.mesh, n++, e.x, terrainHeight(e.x, e.z) - 0.05, e.z, e.instRy, e.instScale, e.instScale, e.instScale);
    }
    group.mesh.count = n;
    group.mesh.instanceMatrix.needsUpdate = true;
    if (n) group.mesh.computeBoundingSphere();
  }
  function syncInstance(ent) { if (ent.instGroup) packGroup(ent.instGroup); }
  function createTree(x, z, kind) {
    const variant = (rng() * 3) | 0;
    const key = kind + variant;
    if (!treeGeoCache[key]) treeGeoCache[key] = treeGeometry(kind, makeRng(key.length * 97 + key.charCodeAt(key.length - 1) * 13));
    if (!stumpGeoCache[kind]) stumpGeoCache[kind] = stumpGeometry(kind, makeRng(kind.length * 41 + 7));
    const root = new THREE.Group();
    const hit = new THREE.Mesh(treeHitGeo, invisMat); hit.position.y = 1.6; root.add(hit);
    const stump = new THREE.Mesh(stumpGeoCache[kind], vcMat);
    stump.castShadow = true; stump.receiveShadow = true; stump.visible = false;
    root.add(stump);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    const name = kind === 'Tree' ? 'Tree' : kind;
    const ry = rng() * Math.PI * 2, s = 0.85 + rng() * 0.3; // same rng order as before (world layout unchanged)
    const ent = tag(root, { mesh: root, full: root, depleted: stump, type: 'tree', kind, name, alive: true, x, z, radius: 0.9,
      instKey: key, instScale: s, instRy: ry, syncInstance });
    pendingTrees.push(ent);
    return ent;
  }
  const ORE_COLOR = { Copper: 0xd0803a, Tin: 0xd8d8d0, Iron: 0x8a4a32, Coal: 0x1a1a1a, Mithril: 0x5a6ad8, Adamantite: 0x3aa860, Runite: 0x40c8e0, Dragon: 0xd03030, Essence: 0xd8e0f0 };
  function createRock(x, z, ore) {
    if (!rockGeoCache[ore]) rockGeoCache[ore] = rockGeometry(ORE_COLOR[ore] ?? 0x888888, makeRng((ore || 'x').length * 53 + 11));
    if (!emptyRockGeoCache[ore]) emptyRockGeoCache[ore] = emptyRockGeometry(makeRng((ore || 'x').length * 17 + 3));
    // Rocks used to build a unique mesh from the shared rng (38 draws); keep consuming
    // the same amount so every tree, monster and patch stays where it was.
    for (let i = 0; i < 38; i++) rng();
    const root = new THREE.Group();
    const hit = new THREE.Mesh(rockHitGeo, invisMat); hit.position.y = 0.4; root.add(hit);
    const empty = new THREE.Mesh(emptyRockGeoCache[ore], vcMat);
    empty.castShadow = true; empty.receiveShadow = true; empty.visible = false;
    empty.rotation.y = rng() * Math.PI * 2;
    root.add(empty);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    const s = 0.9 + 0.25 * (0.5 + 0.5 * Math.sin(x * 12.9898 + z * 78.233)), ry = empty.rotation.y;
    const ent = tag(root, { mesh: root, full: root, depleted: empty, type: 'rock', ore, name: ore === 'Essence' ? 'Essence rock' : 'Rocks', alive: true, x, z, radius: 0.8,
      instKey: ore, instScale: s, instRy: ry, syncInstance });
    pendingRocks.push(ent);
    return ent;
  }
  const instanceGroups = [];
  function flushInstances(list, geoOf, material, shadow) {
    const groups = new Map();
    for (const e of list) { if (!groups.has(e.instKey)) groups.set(e.instKey, []); groups.get(e.instKey).push(e); }
    for (const [key, ents] of groups) {
      const geo = geoOf(key, ents[0]);
      const inst = new THREE.InstancedMesh(geo, material, ents.length);
      inst.castShadow = !!shadow; inst.receiveShadow = true;
      if (material === treeMat) inst.customDepthMaterial = treeDepthMat;   // leaf shadows sway with the leaves
      inst.frustumCulled = true; // bounds refreshed when we pack
      const group = { mesh: inst, ents };
      ents.forEach(e => { e.instanceMesh = inst; e.instGroup = group; });
      packGroup(group);
      scene.add(inst);
      instanceGroups.push(group);
    }
  }
  function flushTreesAndRocks() {
    flushInstances(pendingTrees, (key) => treeGeoCache[key], treeMat, true);
    flushInstances(pendingRocks, (key) => rockGeoCache[key], vcMat, true);
    pendingTrees.length = 0; pendingRocks.length = 0;
  }
  // Exposed so the main loop can re-pack after distance cull flips.
  // Camera occlusion during agility: which tree/rock is instance i of this mesh (packing order), and repack.
  scene.userData.instanceEntAt = (mesh, i) => { const g = instanceGroups.find(g => g.mesh === mesh); if (!g) return null;
    let n = 0; for (const e of g.ents) { if (!e.alive || e.mesh.userData.culled || e.camHidden) continue; if (n++ === i) return { e, g }; } return null; };
  scene.userData.repackInstance = g => packGroup(g);
  scene.userData.packGatherInstances = () => { for (const g of instanceGroups) packGroup(g); };

  // ---- Fishing spots ----
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  function createFish(x, z, kind) {
    const root = new THREE.Group();
    const ring = new THREE.Mesh(G.ring, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    const ring2 = new THREE.Mesh(G.ring, ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.set(0.25, 0.07, 0.2);
    ring2.scale.set(0.6, 0.6, 0.6);
    const bubble = part(G.sphere, 0xeaf6ff, 0.08, 0.08, 0.08, -0.2, 0.15, -0.1, false);
    root.add(ring, ring2, bubble);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    return tag(root, { mesh: root, full: root, type: 'fish', kind, name: 'Fishing spot', alive: true, x, z, radius: 0.6, anim: { ring, ring2, bubble, t: rng() * 6 } });
  }

  // ---- NPCs and buildings ----
  // Little helper: bake a list of [geometry, colour, x, y, z, rx, ry, rz, shadeAmt] into one mesh.
  function kit(list) {
    return bakedMesh(list.map(([geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, amt = 0.22]) => put(col(geo, hex, amt), x, y, z, rx, ry, rz)));
  }
  const glowMat = c => new THREE.MeshBasicMaterial({ color: c });
  const hairCapG = r => hairCap(r);
  function personParts(o, look) {
    // Rounded townsperson shape for stalls and booths (static).
    const skin = look.skin || 0xe0ae84;
    return [
      [prim.capsule(0.27, 0.45, 3, 10), look.body, o.x, o.y + 1.05, o.z],
      [prim.sphere(0.24, 14, 10), skin, o.x, o.y + 1.68, o.z],
      [prim.sphere(0.25, 12, 8), look.hair || 0x3a2a1a, o.x, o.y + 1.76, o.z - 0.04]
    ];
  }
  function createMerchant(x, z) {
    const g = new THREE.Group();
    const parts = [
      ...personParts({ x: 0, y: 0, z: 0 }, { body: 0x6a3a1a, hair: 0x2a1a0a }),
      [prim.capsule(0.12, 0.45, 3, 8), 0x3a2a1a, -0.13, 0.35, 0], [prim.capsule(0.12, 0.45, 3, 8), 0x3a2a1a, 0.13, 0.35, 0],
      // stall: counter, posts, striped canvas awning, crates and goods
      [prim.box(2.3, 0.85, 0.85), 0x7a5430, 0, 0.43, 1.0], [prim.box(2.45, 0.08, 1.0), 0x5a3a1e, 0, 0.88, 1.0],
      [prim.cyl(0.06, 0.07, 2.5, 8), 0x5a3a1e, -1.15, 1.25, 1.4], [prim.cyl(0.06, 0.07, 2.5, 8), 0x5a3a1e, 1.15, 1.25, 1.4],
      [prim.cyl(0.06, 0.07, 2.5, 8), 0x5a3a1e, -1.15, 1.25, 0.2], [prim.cyl(0.06, 0.07, 2.5, 8), 0x5a3a1e, 1.15, 1.25, 0.2],
      [prim.sphere(0.13, 10, 8), 0xd04030, -0.6, 1.0, 1.0], [prim.sphere(0.13, 10, 8), 0xe0c040, -0.35, 1.0, 1.1], [prim.sphere(0.13, 10, 8), 0x60a040, -0.5, 1.0, 0.82],
      [prim.cyl(0.18, 0.15, 0.3, 10), 0x9a7a4a, 0.5, 1.05, 1.0], [prim.box(0.5, 0.4, 0.4), 0x8a6a3a, 1.5, 0.2, 0.6]
    ];
    for (let i = 0; i < 6; i++) parts.push([prim.box(0.44, 0.06, 1.5), i % 2 ? 0xf0e8d8 : 0xc03030, -1.1 + i * 0.44, 2.45 - 0.0, 0.8, -0.22, 0, 0, 0.1]);
    g.add(kit(parts));
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'shop', npc: 'merchant', alive: true, x, z, name: 'Merchant', radius: 1.2 });
  }
  function createBank(x, z) {
    const g = new THREE.Group();
    const parts = [
      [prim.box(3.2, 2.7, 0.3), 0xa49e90, 0, 1.35, -0.95],
      ...personParts({ x: 0, y: 0, z: -0.45 }, { body: 0x2a3a7a, hair: 0x5a4a3a }),
      [prim.box(2.7, 1.0, 0.9), 0x8a8478, 0, 0.5, 0.1], [prim.box(2.9, 0.1, 1.1), 0x5a3a20, 0, 1.05, 0.1],
      [prim.cyl(0.14, 0.17, 2.7, 12), 0xc8c0b0, -1.45, 1.35, 0.5], [prim.cyl(0.14, 0.17, 2.7, 12), 0xc8c0b0, 1.45, 1.35, 0.5],
      [prim.box(0.95, 0.45, 0.06), 0xd4af37, 0, 2.25, -0.78, 0, 0, 0, 0], [prim.box(0.7, 0.25, 0.07), 0x2a2a6a, 0, 2.25, -0.76, 0, 0, 0, 0],
      [prim.box(3.4, 0.16, 1.8), 0x7a2424, 0, 2.78, -0.15, 0.08], [prim.box(3.5, 0.08, 0.08), 0xd4af37, 0, 2.7, 0.75, 0, 0, 0, 0],
      [prim.cyl(0.12, 0.14, 0.12, 10), 0xd4af37, 0.7, 1.16, 0.2, 0, 0, 0, 0], [prim.cyl(0.12, 0.14, 0.18, 10), 0xd4af37, 0.95, 1.19, 0.05, 0, 0, 0, 0]
    ];
    g.add(kit(parts));
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 2;
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'bank', alive: true, x, z, name: 'Bank booth', radius: 1.3 });
  }
  function createTower(x, z) {
    const g = new THREE.Group();
    const parts = [[prim.cyl(2.1, 2.35, 5, 18), 0x8a8478, 0, 2.5, 0], [prim.cyl(2.45, 2.45, 0.4, 18), 0x7a746a, 0, 5.0, 0]];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push([prim.box(0.6, 0.6, 0.5), 0x8e887c, Math.cos(a) * 2.25, 5.5, Math.sin(a) * 2.25, 0, -a, 0]); }
    for (let yy = 0.6; yy < 4.8; yy += 0.7) parts.push([prim.cyl(2.37, 2.37, 0.06, 18), 0x6e685e, 0, yy, 0, 0, 0, 0, 0]);
    parts.push([prim.box(1.0, 1.8, 0.2), 0x4a2e18, 0, 0.9, 2.25], [prim.box(0.25, 0.5, 0.1), 0x1a2030, 0, 3.3, 2.32, 0, 0, 0, 0]);
    g.add(kit(parts));
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // Fences: round posts (one instanced draw call per fence) and two rails.
  const postGeo = col(prim.cyl(0.07, 0.09, 1.0, 7), 0x6a4a2a, 0.3);
  function posts(list) {
    const inst = new THREE.InstancedMesh(postGeo, vcMat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    list.forEach(([x, z], i) => { p.set(x, 0.5, z); m4.compose(p, q, sc); inst.setMatrixAt(i, m4); });
    inst.castShadow = true;
    scene.add(inst);
  }
  function rails(segs) {
    const parts = [];
    for (const [x1, z1, x2, z2] of segs) {
      const len = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1);
      for (const y of [0.45, 0.8]) parts.push([prim.box(0.06, 0.09, len), 0x7a5a3a, (x1 + x2) / 2, y, (z1 + z2) / 2, 0, a, 0, 0.1]);
    }
    const m = kit(parts); m.castShadow = true; scene.add(m);
  }
  function fence(cx, cz, w, d) {
    const ps = [];
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 1.5) { ps.push([cx + x, cz - d / 2], [cx + x, cz + d / 2]); }
    for (let z = -d / 2 + 1.5; z < d / 2; z += 1.5) {
      ps.push([cx - w / 2, cz + z]);
      if (Math.abs(z) > 1.6) ps.push([cx + w / 2, cz + z]); // gate on the east side
    }
    posts(ps);
    rails([[cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2], [cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2],
      [cx + w / 2, cz - d / 2, cx + w / 2, cz - 1.6], [cx + w / 2, cz + 1.6, cx + w / 2, cz + d / 2]]);
  }


  // ---- Town of Brightwater ----
  function createBuilding([x, z, w, d, wall, roof, name, examine]) {
    const g = new THREE.Group();
    const parts = [];
    const h = 2.7, base = 0.55, T = 0.18, DOOR = 1.15;
    const TIMBER = 0x4a3020, STONE = 0x7d776c;
    const WOODS = new Set([TIMBER, 0x5a3a20, 0x6a5040, 0x4a2e16, 0x6a4a2a, 0x5a3a1e]), STONES = new Set([STONE, 0x8e877a, 0x8a8478, 0x7a7268]);
    const add = (geo, hex, amt, px, py, pz, rx = 0, ry = 0, rz = 0) => { setMat(geo, WOODS.has(hex) ? woodAxis(geo) : STONES.has(hex) ? 5 : 0); parts.push(put(col(geo, hex, amt), px, py, pz, rx, ry, rz)); };
    const big = w * d > 22 || /Bank|Church|Smithy|Palace|Castle|Armoury|Emporium|Rune Shop|Store|Inn|Tavern|Weaponsmith/.test(name);
    const wallC = new THREE.Color(wall), wc = new THREE.Color();
    const paintWall = (geo) => paint(geo, (px, py, pz) => wc.copy(wallC).multiplyScalar(0.88 + 0.12 * snoise(px * 3, py * 3, pz * 3, 7)));
    // Door faces the town square
    const tc = nearestTown(x, z), rx = x - tc.x, rz = z - tc.z;
    const toCentre = Math.abs(rx) > Math.abs(rz) ? [Math.sign(-rx) || 1, 0] : [0, Math.sign(-rz) || 1];
    const doorOnX = !!toCentre[0]; // door on +/- X face
    const doorSign = doorOnX ? toCentre[0] : toCentre[1];
    // Footing + interior floor
    const footC = new THREE.Color(STONE), fc = new THREE.Color();
    const foot = paint(prim.box(w + 0.16, base, d + 0.16), (px, py, pz) => fc.copy(footC).multiplyScalar(0.8 + 0.25 * (0.5 + 0.5 * snoise(Math.floor(px * 2.2 + pz * 2.2), Math.floor(py * 4), 0, 3))));
    void foot;
    const fl = 0.04;
    add(prim.box(w - T * 2, 0.06, d - T * 2), 0x6a5040, 0.2, 0, 0.03, 0);
    // Hollow walls with a doorway gap on the town-facing side
    const wh = h, wy = wh / 2;
    const wallSeg = (alongX, side, a0, a1) => {
      const len = a1 - a0, mid = (a0 + a1) / 2;
      if (len < 0.12) return;
      const geo = alongX ? prim.box(len, wh, T) : prim.box(T, wh, len);
      const mesh = setMat(paintWall(geo), big ? 5 : 4);
      if (alongX) put(mesh, mid, wy, side * (d / 2 - T / 2)); else put(mesh, side * (w / 2 - T / 2), wy, mid);
      parts.push(mesh);
      // stone plinth along the outside of the segment
      const pl = alongX ? prim.box(len + 0.08, base, T + 0.12) : prim.box(T + 0.12, base, len + 0.08);
      setMat(pl, 5); const plm = paint(pl, (px, py, pz) => fc.copy(footC).multiplyScalar(0.8 + 0.25 * (0.5 + 0.5 * snoise(Math.floor(px * 2.2 + pz * 2.2), Math.floor(py * 4), 0, 3))));
      if (alongX) put(plm, mid, base / 2, side * (d / 2 - T / 2)); else put(plm, side * (w / 2 - T / 2), base / 2, mid);
      parts.push(plm);
      // The collider is exactly the wall slab (the old box sat T outside the mesh on the -X/-Z faces). Segments run the
      // full outer length, so the two walls at every corner overlap and no corner can be squeezed through.
      const c0 = side * (alongX ? d : w) / 2, c1 = c0 - side * T;
      if (alongX) colliders.push({ minX: x + a0, maxX: x + a1, minZ: z + Math.min(c0, c1), maxZ: z + Math.max(c0, c1), wall: name });
      else colliders.push({ minX: x + Math.min(c0, c1), maxX: x + Math.max(c0, c1), minZ: z + a0, maxZ: z + a1, wall: name });
    };
    const splitDoor = (fullHalf, doorHalf) => {
      // returns [[-full, -door], [door, full]] segments leaving the gap
      return [[-fullHalf, -doorHalf], [doorHalf, fullHalf]];
    };
    for (const side of [-1, 1]) {
      const isDoorFace = doorOnX ? false : side === doorSign;
      if (isDoorFace) for (const [a0, a1] of splitDoor(w / 2, DOOR / 2)) wallSeg(true, side, a0, a1);
      else wallSeg(true, side, -w / 2, w / 2);
    }
    for (const side of [-1, 1]) {
      const isDoorFace = doorOnX ? side === doorSign : false;
      if (isDoorFace) for (const [a0, a1] of splitDoor(d / 2, DOOR / 2)) wallSeg(false, side, a0, a1);
      else wallSeg(false, side, -d / 2, d / 2);
    }
    // Lintel over the door + open doorway (no solid door panel) + step
    const fx = toCentre[0] * (w / 2 - T / 2), fz = toCentre[1] * (d / 2 - T / 2);
    const alongXdoor = !doorOnX;
    add(alongXdoor ? prim.box(DOOR + 0.2, 0.14, T + 0.04) : prim.box(T + 0.04, 0.14, DOOR + 0.2), TIMBER, 0.1, fx, 1.95, fz);
    add(alongXdoor ? prim.box(0.1, 1.7, T + 0.02) : prim.box(T + 0.02, 1.9, 0.1), TIMBER, 0.1, fx + (alongXdoor ? -DOOR / 2 : 0), 0.95, fz + (alongXdoor ? 0 : -DOOR / 2));
    add(alongXdoor ? prim.box(0.1, 1.7, T + 0.02) : prim.box(T + 0.02, 1.9, 0.1), TIMBER, 0.1, fx + (alongXdoor ? DOOR / 2 : 0), 0.95, fz + (alongXdoor ? 0 : DOOR / 2));
    // wall torches either side of the door: bracket, stick and a burning head (VFX + flicker light)
    const oc = [-toCentre[0], -toCentre[1]];
    for (const s2 of [-1, 1]) {
      const ox = fx + (alongXdoor ? s2 * (DOOR / 2 + 0.35) : 0) + oc[0] * 0.2, oz = fz + (alongXdoor ? 0 : s2 * (DOOR / 2 + 0.35)) + oc[1] * 0.2;
      add(prim.box(0.08, 0.08, 0.08), 0x2a2a2e, 0.1, ox - oc[0] * 0.08, 1.85, oz - oc[1] * 0.08);
      add(prim.cyl(0.035, 0.03, 0.45, 6), 0x4a2e16, 0.1, ox, 2.0, oz, oc[1] * 0.35, 0, -oc[0] * 0.35);
      add(prim.cyl(0.06, 0.045, 0.1, 7), 0x2a1a0e, 0.1, ox + oc[0] * 0.07, 2.22, oz + oc[1] * 0.07);
      const head = new THREE.Object3D(); head.position.set(ox + oc[0] * 0.08, 2.27, oz + oc[1] * 0.08); g.add(head); addFire(head, 0.45, 'torch', { ground: 2.27, wall: oc });
    }
    add(alongXdoor ? prim.box(DOOR + 0.15, 0.06, 0.55) : prim.box(0.55, 0.06, DOOR + 0.15), 0x8a8478, 0.2, fx + toCentre[0] * 0.35, 0.03, fz + toCentre[1] * 0.35);
    if (!big) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(prim.box(0.2, wh, 0.2), TIMBER, 0.2, sx * (w / 2), wy, sz * (d / 2));
      for (const yy of [base + 0.05, 1.65, h - 0.06]) {
        add(prim.box(w + 0.12, 0.12, 0.1), TIMBER, 0.1, 0, yy, d / 2 + 0.02); add(prim.box(w + 0.12, 0.12, 0.1), TIMBER, 0.1, 0, yy, -d / 2 - 0.02);
        add(prim.box(0.1, 0.12, d + 0.12), TIMBER, 0.1, w / 2 + 0.02, yy, 0); add(prim.box(0.1, 0.12, d + 0.12), TIMBER, 0.1, -w / 2 - 0.02, yy, 0);
      }
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let yy = base + 0.2; yy < h; yy += 0.42) add(prim.box(0.32, 0.34, 0.32), 0x8e877a, 0.15, sx * (w / 2), yy, sz * (d / 2));
    }
    const win = (px, pz, alongX) => {
      const ww = 0.55, whh = 0.55, wy2 = 1.75;
      add(alongX ? prim.box(ww, whh, 0.06) : prim.box(0.06, whh, ww), 0x23384a, 0.0, px, wy2, pz);
      add(alongX ? prim.box(ww + 0.12, 0.07, 0.1) : prim.box(0.1, 0.07, ww + 0.12), 0xd8cfb8, 0.0, px, wy2 - whh / 2 - 0.02, pz);
      add(alongX ? prim.box(0.04, whh, 0.07) : prim.box(0.07, whh, 0.04), 0xd8cfb8, 0.0, px, wy2, pz);
      add(alongX ? prim.box(ww, 0.04, 0.07) : prim.box(0.07, 0.04, ww), 0xd8cfb8, 0.0, px, wy2, pz);
    };
    for (const sz of [-1, 1]) {
      if (!doorOnX && sz === doorSign) continue;
      for (let i = 0; i < Math.max(1, Math.floor(w / 2)); i++) { const px = (i + 0.5) * w / Math.max(1, Math.floor(w / 2)) - w / 2; win(px, sz * (d / 2 + 0.03), true); }
    }
    for (const sx of [-1, 1]) {
      if (doorOnX && sx === doorSign) continue;
      for (let i = 0; i < Math.max(1, Math.floor(d / 2)); i++) { const pz = (i + 0.5) * d / Math.max(1, Math.floor(d / 2)) - d / 2; win(sx * (w / 2 + 0.03), pz, false); }
    }
    const roofStart = parts.length;
    const alongZ = d >= w;
    const span = (alongZ ? w : d) + 0.5, len = (alongZ ? d : w) + 0.5;
    const rise = Math.min(1.9, span * 0.42);
    const slope = Math.atan2(rise, span / 2), slant = Math.hypot(rise, span / 2);
    const rows = Math.max(4, Math.round(slant / 0.32));
    const rc = new THREE.Color(roof);
    for (const side of [-1, 1]) for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const tile = setMat(prim.box(alongZ ? slant / rows + 0.06 : len, 0.07, alongZ ? len : slant / rows + 0.06), 6);
      const shadeK = (i % 2 ? 0.86 : 1) * (0.9 + 0.1 * t);
      const c2 = rc.clone().multiplyScalar(shadeK);
      paint(tile, (px, py, pz) => { const k = 0.92 + 0.12 * Math.sin((alongZ ? pz : px) * 9 + i * 1.7); return c2.clone().multiplyScalar(k); });
      const off = (span / 2) * (1 - t), yy = h + rise * t + 0.05;
      if (alongZ) put(tile, side * off, yy, 0, 0, 0, -side * slope);
      else put(tile, 0, yy, side * off, side * slope, 0, 0);
      parts.push(tile);
    }
    add(alongZ ? prim.box(0.22, 0.14, len + 0.04) : prim.box(len + 0.04, 0.14, 0.22), rc.clone().multiplyScalar(0.7).getHex(), 0, 0, h + rise + 0.07, 0);
    for (const e of [-1, 1]) {
      const gable = paint(prim.prism(span - 0.5, rise - 0.05, 0.1), () => wallC.clone().multiplyScalar(0.92));
      if (alongZ) put(gable, 0, h, e * (d / 2)); else put(gable, e * (w / 2), h, 0, 0, Math.PI / 2, 0);
      parts.push(gable);
      if (!big) add(prim.box(0.1, rise * 0.8, 0.1), TIMBER, 0.1, alongZ ? 0 : e * (w / 2 + 0.06), h + rise * 0.4, alongZ ? e * (d / 2 + 0.06) : 0);
    }
    if (!big || /Smithy|Cookhouse/.test(name)) {
      const cx = alongZ ? span * 0.22 : len * 0.3, cz = alongZ ? len * 0.3 : span * 0.22;
      add(prim.box(0.45, rise + 0.9, 0.45), 0x6e665c, 0.25, cx, h + (rise + 0.9) / 2, cz);
      add(prim.box(0.55, 0.12, 0.55), 0x56504a, 0, cx, h + rise + 0.95, cz);
    }
    if (name === 'Church of Saradomin') {
      add(prim.box(1.3, 2.4, 1.3), wall, 0.15, 0, h + 1.2, d / 2 - 0.9);
      add(prim.cone(1.05, 2.6, 4), roof, 0.3, 0, h + 3.7, d / 2 - 0.9, 0, Math.PI / 4, 0);
      add(prim.box(0.08, 0.6, 0.08), 0xd4af37, 0, 0, h + 5.3, d / 2 - 0.9); add(prim.box(0.36, 0.08, 0.08), 0xd4af37, 0, 0, h + 5.4, d / 2 - 0.9);
    }
    const roofParts = parts.splice(roofStart);
    // Role-specific interior props, laid out in a door-relative frame:
    // u runs along the back wall, v is the distance in from the back wall.
    const halfDepth = (doorOnX ? w : d) / 2 - T, halfWide = (doorOnX ? d : w) / 2 - T;
    const P = (geo, hex, amt, u, y, v, rz = 0) => {
      const lx = doorOnX ? -doorSign * (halfDepth - v) : u, lz = doorOnX ? u : -doorSign * (halfDepth - v);
      add(geo, hex, amt, lx, y, lz, 0, doorOnX ? Math.PI / 2 : 0, rz);
    };
    const toWorld = (u, v) => { const lx = doorOnX ? -doorSign * (halfDepth - v) : u, lz = doorOnX ? u : -doorSign * (halfDepth - v); return [x + lx, z + lz]; };
    // solid props: u/v centre and half-sizes in the door-relative frame
    const solidUV = (u, v, hu, hv) => { const [ax, az] = toWorld(u - hu, v - hv), [bx, bz] = toWorld(u + hu, v + hv); colliders.push({ minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz), prop: name }); };
    const spots = {};
    if (/Bank/.test(name)) {
      const cw = Math.min(halfWide * 2 - 0.4, 3.4), nWin = Math.min(3, Math.max(2, Math.floor(cw / 1.05)));
      P(prim.box(cw, 1.0, 0.6), 0x8a8478, 0.15, 0, 0.5, 1.2);
      P(prim.box(cw + 0.1, 0.08, 0.75), 0x5a3a20, 0.1, 0, 1.04, 1.2);
      for (let i = 0; i < nWin; i++) {
        const ou = (i - (nWin - 1) / 2) * (cw / nWin);
        P(prim.box(0.08, 0.7, 0.08), 0xd4af37, 0, ou - cw / nWin / 2 + 0.04, 1.4, 1.2);
        P(prim.box(0.6, 0.06, 0.06), 0xd4af37, 0, ou, 1.76, 1.2);
      }
      P(prim.cyl(0.12, 0.14, 0.12, 10), 0xd4af37, 0, cw / 2 - 0.3, 1.14, 1.2);
      P(prim.box(Math.min(1.2, cw), 0.9, 0.5), 0x5a5a62, 0.15, 0, 0.45, 0.3);
      solidUV(0, 1.2, cw / 2, 0.3); solidUV(0, 0.3, Math.min(1.2, cw) / 2, 0.25);
      spots.staff = [toWorld(0, 0.6)];
    } else if (/Store|Shop|Emporium|Armoury|Weaponsmith|Tools/.test(name)) {
      const cw = Math.min(halfWide * 2 - 0.6, 2.4);
      P(prim.box(cw, 0.9, 0.6), 0x7a5430, 0.15, -0.2, 0.45, 1.3);
      P(prim.box(cw + 0.1, 0.08, 0.72), 0x5a3a1e, 0.1, -0.2, 0.92, 1.3);
      for (let i = 0; i < 3; i++) P(prim.box(Math.min(halfWide * 2 - 0.3, 2.6), 0.07, 0.32), 0x8a6a3a, 0.15, 0, 0.6 + i * 0.5, 0.18);
      for (let i = 0; i < 5; i++) P(prim.box(0.22, 0.26, 0.2), [0xc04a30, 0x3a6a9a, 0xe0c040, 0x6a9a4a, 0x8a5a3a][i], 0.1, -1 + i * 0.5, 1.28, 0.18);
      P(prim.sphere(0.1, 8, 6), 0xd04030, 0, -0.5, 1.05, 1.3); P(prim.sphere(0.1, 8, 6), 0xe0c040, 0, -0.25, 1.05, 1.3);
      P(prim.box(0.45, 0.4, 0.4), 0x8a6a3a, 0.15, halfWide - 0.35, 0.2, 1.9);
      solidUV(-0.2, 1.3, cw / 2, 0.3); solidUV(0, 0.18, Math.min(halfWide * 2 - 0.3, 2.6) / 2, 0.16); solidUV(halfWide - 0.35, 1.9, 0.22, 0.2);
      spots.staff = [toWorld(-0.6, 0.75), toWorld(0.5, 0.75)];
    } else if (/Smithy/.test(name)) {
      P(prim.box(1.1, 0.85, 0.8), 0x4a3a3a, 0.2, -0.8, 0.42, 0.5);
      P(prim.box(0.8, 0.12, 0.6), 0xff6a20, 0, -0.8, 0.9, 0.5);
      P(prim.box(0.5, 1.6, 0.5), 0x5a524a, 0.2, -0.8, 1.7, 0.35);
      P(prim.box(0.7, 0.18, 0.32), 0x6a6a72, 0.1, 0.8, 0.7, 0.7);
      P(prim.box(0.26, 0.5, 0.26), 0x5a5a62, 0.1, 0.8, 0.3, 0.7);
      P(prim.box(0.5, 0.5, 0.5), 0x5a3a20, 0.15, halfWide - 0.35, 0.25, 0.3);
      solidUV(-0.8, 0.5, 0.55, 0.4); solidUV(0.8, 0.7, 0.35, 0.16); solidUV(halfWide - 0.35, 0.3, 0.25, 0.25);
      spots.staff = [toWorld(-0.8, 1.15), toWorld(0.8, 1.25)];
    }
    for (const q of parts.concat(roofParts)) if (!q.attributes.aMat) setMat(q, 0);
    g.add(bakedMesh(parts, buildMat));
    const roofMesh = bakedMesh(roofParts, buildMat);
    g.add(roofMesh);
    g.userData.roof = roofMesh;
    g.userData.inner = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    occupied.push({ x, z, r: Math.max(w, d) * 0.75 + 1 });
    return tag(g, { mesh: g, type: 'building', name, examine, alive: true, x, z, radius: Math.max(w, d) / 2, door: { x: x + toCentre[0] * (w / 2), z: z + toCentre[1] * (d / 2), nx: toCentre[0], nz: toCentre[1] }, inner: g.userData.inner, spots });
  }

  // Generic rounded townsperson NPC (one baked mesh). look: { body, legs, hat, skin, beard, apron }
  function createNpc(x, z, npc, name, look, faceX = 0, faceZ = 0) {
    const g = new THREE.Group();
    const L = varyLook({ ...look, legs: look.legs || undefined, hair: look.hat ? null : (look.beard ? new THREE.Color(look.beard).multiplyScalar(0.8).getHex() : undefined) }, hashStr(name + npc + x.toFixed(1)));
    const h = humanoidParts(L);
    const parts = [...h.top, ...npcExtras(look)];
    for (const lx of [-0.13, 0.13]) for (const [geo, hex, px = 0, py = 0, pz = 0, rx, ry, rz, amt] of h.leg) parts.push([geo.clone(), hex, px + lx, py + h.hipY, pz, rx, ry, rz, amt]);
    const lo = kit(parts);
    lo.scale.set(L.build, L.height, L.build);
    g.add(lo);
    g.add(contactShadow(0.55));
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(faceX - x, faceZ - z);
    scene.add(g);
    pickables.push(g);
    const headExtras = npcExtras({ ...look, apron: null, beard: null }).map(([geo, hex, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, amt = 0.22]) => put(col(geo, hex, amt), px, py - 1.5, pz, rx, ry, rz));
    const e = tag(g, { mesh: g, type: 'npc', npc, name, alive: true, x, z, radius: 0.6 });
    e.lod = { lo, hi: null, parent: g, buildHi: () => { const r = buildHumanoidRig({ ...L, headExtras: headExtras.map(q => q.clone()), noCollar: !!look.apron, buckle: look.apron ? new THREE.Color(look.apron).multiplyScalar(0.75).getHex() : undefined }, { extras: look.apron ? apronGeo(look.apron, L.build ?? 1, L.chest ?? 1) : [], material: /knight/i.test(npc) ? plateCharMat : /guard/i.test(npc) ? chainCharMat : undefined }); r.userData.id = x; return r; } };
    return e;
  }

  function createStation(x, z, kind) {
    const g = new THREE.Group();
    let name;
    if (kind === 'furnace') {
      name = 'Furnace';
      g.add(kit([[blob(0.85, 0.95, 0.75, { detail: 2, lump: 0.08, seed: 3, flat: 0.9 }), 0x6a6056, 0, 0.55, 0], [prim.box(1.6, 0.3, 1.3), 0x56504a, 0, 0.15, 0],
        [prim.cyl(0.25, 0.32, 1.4, 10), 0x5a524a, 0, 1.7, -0.2], [prim.cyl(0.3, 0.3, 0.12, 10), 0x48423c, 0, 2.42, -0.2],
        [prim.box(0.75, 0.55, 0.1), 0x2a2420, 0, 0.6, 0.7, 0, 0, 0, 0]]));
      const glow = new THREE.Mesh(prim.box(0.55, 0.4, 0.05), glowMat(0xff8a2a)); glow.position.set(0, 0.6, 0.76); g.add(glow);
      const mouth = new THREE.Object3D(); mouth.position.set(0, 0.1, 0.7); g.add(mouth); addFire(mouth, 0.6, 'forge', { ground: 0.1 });
    } else if (kind === 'anvil') {
      name = 'Anvil';
      g.add(kit([[prim.cyl(0.32, 0.38, 0.5, 10), 0x6a4a2a, 0, 0.25, 0], [prim.box(0.32, 0.2, 0.26), 0x34343c, 0, 0.6, 0, 0, 0, 0, 0.1],
        [prim.box(0.95, 0.2, 0.4), 0x3a3a44, 0, 0.78, 0, 0, 0, 0, 0.1], [prim.cone(0.14, 0.4, 8), 0x3a3a44, 0.65, 0.8, 0, 0, 0, -Math.PI / 2, 0.1],
        [prim.box(0.06, 0.35, 0.06), 0x5a3a1e, 0.3, 0.98, 0.12, 0, 0, 0.5], [prim.box(0.16, 0.1, 0.1), 0x555560, 0.38, 1.13, 0.12, 0, 0, 0.5]]));
    } else {
      name = 'Range';
      g.add(kit([[prim.box(1.45, 0.9, 0.95), 0x6e665c, 0, 0.45, 0], [prim.box(1.5, 0.08, 1.0), 0x2a2a2a, 0, 0.94, 0, 0, 0, 0, 0.05],
        [prim.cyl(0.18, 0.18, 0.12, 12), 0x3a3a3a, -0.35, 1.02, 0.1], [prim.cyl(0.22, 0.2, 0.18, 12), 0x8a5a2a, 0.35, 1.07, 0.05],
        [prim.cyl(0.18, 0.24, 1.4, 10), 0x5e574e, -0.5, 1.6, -0.3], [prim.box(0.95, 0.35, 0.08), 0x221c18, 0, 0.35, 0.48, 0, 0, 0, 0]]));
      const glow = new THREE.Mesh(prim.box(0.8, 0.22, 0.05), glowMat(0xff6a1a)); glow.position.set(0, 0.35, 0.52); g.add(glow);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'station', kind, name, alive: true, x, z, radius: 0.8 });
  }

  function createAltar(x, z) {
    const g = new THREE.Group();
    g.add(kit([[prim.box(1.7, 0.25, 0.95), 0xcfc7b8, 0, 0.12, 0], [prim.box(1.5, 0.7, 0.75), 0xe8e0d0, 0, 0.6, 0], [prim.box(1.7, 0.1, 0.9), 0xdcd4c4, 0, 0.98, 0],
      [prim.box(1.72, 0.04, 0.6), 0x6a2a8a, 0, 1.04, 0, 0, 0, 0, 0], [prim.box(0.3, 0.75, 0.77), 0x6a2a8a, 0, 0.63, 0, 0, 0, 0, 0.1],
      [prim.box(0.08, 0.55, 0.08), 0xe0b84a, 0, 1.33, 0, 0, 0, 0, 0], [prim.box(0.36, 0.08, 0.08), 0xe0b84a, 0, 1.43, 0, 0, 0, 0, 0],
      [prim.cyl(0.05, 0.06, 0.25, 8), 0xf0ead8, -0.6, 1.16, 0.1], [prim.cyl(0.05, 0.06, 0.25, 8), 0xf0ead8, 0.6, 1.16, 0.1]]));
    for (const cx of [-0.6, 0.6]) { const f = new THREE.Mesh(prim.sphere(0.05, 6, 4), glowMat(0xffd070)); f.position.set(cx, 1.33, 0.1); g.add(f); }
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'altar', name: 'Altar', alive: true, x, z, radius: 0.9 });
  }

  function createWell(x, z) {
    const g = new THREE.Group();
    const parts = [[prim.cyl(0.62, 0.62, 0.08, 18), 0x1e4a6a, 0, 0.62, 0, 0, 0, 0, 0]];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (const [yy, off] of [[0.17, 0], [0.5, 0.26]]) parts.push([prim.box(0.42, 0.32, 0.22), 0x8a8478 + (i % 3) * 0x050505, Math.cos(a + off) * 0.75, yy, Math.sin(a + off) * 0.75, 0, -(a + off) + Math.PI / 2, 0, 0.25]); }
    parts.push([prim.box(0.12, 1.7, 0.12), 0x5a3a1e, -0.75, 0.85, 0], [prim.box(0.12, 1.7, 0.12), 0x5a3a1e, 0.75, 0.85, 0],
      [prim.cyl(0.06, 0.06, 1.5, 8), 0x6a4a2a, 0, 1.4, 0, 0, 0, Math.PI / 2], [prim.cyl(0.12, 0.1, 0.2, 10), 0x6a4a2a, 0, 1.0, 0],
      [prim.box(1.15, 0.06, 0.75), 0x7a3a2a, 0, 1.9, 0.27, 0.6], [prim.box(1.15, 0.06, 0.75), 0x7a3a2a, 0, 1.9, -0.27, -0.6]);
    g.add(kit(parts));
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
    return tag(g, { mesh: g, type: 'well', name: 'Well', examine: 'The town well. Use it to fill empty vials with water.', alive: true, x, z, radius: 0.8 });
  }

  // Herb patch (Herblore): a raised dirt bed with leafy herbs. Never runs out. One draw call.
  const HERB_TINT = [0x4a8a2a, 0x5a9a3a, 0x3a7a3a, 0x6a8a2a, 0x2a6a2a, 0x7a9a3a, 0x4a7a4a, 0x3a8a5a, 0x5a7a2a, 0x8aaa3a, 0x2a5a2a, 0x6a6a2a, 0x3a5a4a];
  function createHerbPatch(x, z, herb, tintIdx = 0) {
    const g = new THREE.Group();
    const c = HERB_TINT[tintIdx % HERB_TINT.length];
    const parts = [[prim.box(1.5, 0.22, 1.1), 0x4a3018, 0, 0.11, 0, 0, 0, 0, 0.3],
      [prim.box(1.62, 0.16, 0.12), 0x7a5a3a, 0, 0.16, 0.56], [prim.box(1.62, 0.16, 0.12), 0x7a5a3a, 0, 0.16, -0.56],
      [prim.box(0.12, 0.16, 1.2), 0x7a5a3a, 0.78, 0.16, 0], [prim.box(0.12, 0.16, 1.2), 0x7a5a3a, -0.78, 0.16, 0]];
    let k = 0;
    for (const [hx, hz] of [[-0.45, -0.22], [0, 0.22], [0.45, -0.22], [-0.25, 0.25], [0.28, 0.22], [0.0, -0.25]]) {
      parts.push([blob(0.2, 0.17, 0.2, { detail: 1, lump: 0.3, seed: k++ }), c, hx, 0.36, hz, 0, 0, 0, 0.4]);
      parts.push([prim.cone(0.06, 0.25, 5), new THREE.Color(c).offsetHSL(0, 0, 0.1).getHex(), hx + 0.05, 0.5, hz, 0.3, 0, 0.2, 0.2]);
    }
    g.add(kit(parts));
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    occupied.push({ x, z, r: 1.0 });
    return tag(g, { mesh: g, type: 'herb', herb, name: `${herb} patch`, alive: true, x, z, radius: 0.8 });
  }

  // Straight fence line (instanced posts + rails).
  function fenceLine(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(2, Math.round(len / 1.5) + 1);
    const ps = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); ps.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]); }
    posts(ps);
    rails([[x1, z1, x2, z2]]);
  }

  // ---- Monsters ----
  // Monster extras for humanoids (weapons, helmets, horns...). Parts in kit format.
  function monsterExtras(typeName, skin, c) {
    switch (typeName) {
      case 'Goblin': return [[prim.cone(0.07, 0.3, 5), skin, 0.3, 1.8, 0, 0, 0, -1.2], [prim.cone(0.07, 0.3, 5), skin, -0.3, 1.8, 0, 0, 0, 1.2],
        [prim.sphere(0.07, 6, 4), skin, 0, 1.7, 0.27], [prim.box(0.06, 0.55, 0.08), 0x6a6a70, 0.44, 0.75, 0.25, 1.2, 0, 0]];
      case 'Hill Giant': case 'Moss Giant': case 'Ogre': case 'Ice Giant': case 'Grumsh': {
        const out = [[prim.cyl(0.08, 0.16, 1.0, 8), 0x5a3a1a, 0.48, 0.75, 0.3, 0.5], [blob(0.18, 0.24, 0.18, { detail: 1, lump: 0.3, seed: 1 }), 0x4a2e14, 0.48, 0.32, 0.55]];
        if (typeName === 'Grumsh') out.push([prim.cyl(0.26, 0.22, 0.14, 10), 0xd4af37, 0, 1.97, 0, 0, 0, 0, 0], ...[0, 1, 2, 3, 4].map(i => [prim.cone(0.04, 0.12, 4), 0xd4af37, Math.cos(i * 1.257) * 0.22, 2.08, Math.sin(i * 1.257) * 0.22, 0, 0, 0, 0]));
        if (typeName === 'Moss Giant') out.push([blob(0.28, 0.12, 0.28, { detail: 1, lump: 0.4, seed: 3 }), 0x3a6a1a, 0, 1.94, 0]);
        if (typeName === 'Ice Giant') out.push([prim.cone(0.06, 0.25, 5), 0xd8f0ff, 0.12, 2.0, 0], [prim.cone(0.06, 0.3, 5), 0xd8f0ff, -0.1, 2.02, 0.05]);
        return out;
      }
      case 'Dark Archer': return [[hairCapG(0.29), 0x1e2a1e, 0, 1.76, -0.02, -0.15], [prim.torusArc(0.55), 0x5a3a1a, -0.48, 1.0, 0.25], [prim.cyl(0.08, 0.08, 0.55, 8), 0x3a2a1a, 0.15, 1.15, -0.25, 0.3]];
      case 'Black Knight': return [[hairCapG(0.3), 0x2a2a34, 0, 1.74, 0, 0, 0, 0, 0.1], [prim.box(0.32, 0.05, 0.05), 0x111111, 0, 1.76, 0.27], [prim.cone(0.06, 0.25, 5), 0x2a2a34, 0, 2.08, 0],
        [prim.box(0.06, 1.0, 0.13), 0x8a8a94, 0.46, 0.85, 0.35, 0.4, 0, 0, 0.05], [prim.box(0.26, 0.05, 0.08), 0x3a3a44, 0.46, 0.4, 0.2, 0.4], [prim.cyl(0.3, 0.3, 0.06, 12), 0x24242c, -0.46, 1.0, 0.1, 0, 0, Math.PI / 2]];
      case 'Lesser Demon': return [[prim.cone(0.07, 0.35, 6), 0x2a1a1a, 0.15, 2.02, 0, -0.3, 0, -0.3], [prim.cone(0.07, 0.35, 6), 0x2a1a1a, -0.15, 2.02, 0, -0.3, 0, 0.3],
        [prim.wing(1), 0x5a0a0a, 0.2, 1.3, -0.25], [prim.wing(-1), 0x5a0a0a, -0.2, 1.3, -0.25], [prim.cone(0.06, 0.8, 6), c, 0, 0.7, -0.35, -2.2]];
      case 'Bandit': return [[prim.box(0.42, 0.1, 0.05), 0x2a2a2a, 0, 1.76, 0.22], [prim.box(0.05, 0.7, 0.1), 0xa0a0a8, 0.46, 0.8, 0.3, 0.4, 0, 0, 0.05]];
      case 'Skeleton': return [[prim.sphere(0.06, 6, 4), 0x111111, 0.09, 1.76, 0.2, 0, 0, 0, 0], [prim.sphere(0.06, 6, 4), 0x111111, -0.09, 1.76, 0.2, 0, 0, 0, 0], [prim.box(0.05, 0.8, 0.1), 0x8a8a8a, 0.46, 0.85, 0.3, 0.4]];
      case 'Zombie': return [[prim.sphere(0.05, 6, 4), 0xd0e060, 0.09, 1.76, 0.21, 0, 0, 0, 0], [prim.sphere(0.05, 6, 4), 0xd0e060, -0.09, 1.76, 0.21, 0, 0, 0, 0]];
      default: return [[hairCapG(0.29), 0x9a9aa8, 0, 1.76, 0, 0, 0, 0, 0.1], [prim.cyl(0.03, 0.03, 2.2, 6), 0x6a5a3a, 0.45, 1.15, 0.15], [prim.cone(0.07, 0.3, 4), 0xb0b0b8, 0.45, 2.38, 0.15]];
    }
  }
  let monSeq = 0;
  function createMonster(typeName, x, z, roam, bounds = null) {
    const t = MONSTER_TYPES[typeName];
    const root = new THREE.Group();
    const body = new THREE.Group();
    const legs = [];
    const seed = hashStr(typeName + (monSeq++) + x.toFixed(2));
    const v = rollVariant(typeName, t, seed);
    const variant = t.boss ? null : namedVariant(typeName, seed);
    const c = v.color;
    const cr = creatureParts(t.shape, c, typeName);
    const lo = new THREE.Group(); body.add(lo);
    let extras = [], headExtras = [];
    const held = [[], []];
    if (cr) {
      lo.add(kit(cr.top));
      for (const L of cr.legs) { const p = legPivot(L.parts, L.x, L.y, L.z); lo.add(p); legs.push(p); }
    } else {
      const skin = v.tint;
      const bald = /Giant|Ogre|Grumsh|Skeleton|Zombie|Demon|Goblin/.test(typeName);
      const lc = loColours(typeName, t, seed);
      const h = humanoidParts({ body: c, skin, legs: new THREE.Color(c).multiplyScalar(0.55).getHex(), hair: bald ? null : 0x3a2a1a, sleeve: c, ...(lc || {}) });
      const ex = monsterExtras(typeName, skin, c);
      // detailed rig: head-height extras ride on the head, the rest on the torso
      const keep = typeName === 'Goblin' ? ex.slice(3) : /Skeleton|Zombie/.test(typeName) ? ex.slice(2) : ex;
      // weapons / shields (out at the hands) are re-anchored onto the forearm so they swing with it
      const grip = [null, null];
      for (const [geo, hex, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, amt = 0.22] of keep.map(q => [q[0].clone(), ...q.slice(1)])) {
        if (Math.abs(px) >= 0.4 && py < 1.55) {
          const side = px < 0 ? 0 : 1, hsl = {}; new THREE.Color(hex).getHSL(hsl);
          const metal = hsl.s < 0.18 && hsl.l > 0.2 && !/Giant|Ogre|Grumsh/.test(typeName);
          held[side].push({ geo: put(col(geo.clone(), hex, metal ? 0.08 : amt), px, py, pz, rx, ry, rz), metal });
        } else if (py > 1.55 && Math.abs(px) < 0.35) headExtras.push(put(col(geo.clone(), hex, amt), px, py - 1.5, pz, rx, ry, rz));
        else extras.push(put(col(geo.clone(), hex, amt), px, py, pz, rx, ry, rz));
      }
      // grip near the handle end: clubs hang head-down from the fist, blades point up
      for (const list of held) {
        if (!list.length) continue;
        const bb = new THREE.Box3(); for (const it of list) { it.geo.computeBoundingBox(); bb.union(it.geo.boundingBox); }
        const hgt = bb.max.y - bb.min.y, club = /Giant|Ogre|Grumsh/.test(typeName);
        const gy = list.length > 1 && !club && hgt > 1.5 ? (bb.min.y + bb.max.y) / 2 - hgt * 0.15 : club ? bb.max.y - hgt * 0.12 : bb.min.y + Math.min(0.12, hgt * 0.2);
        const gx = (bb.min.x + bb.max.x) / 2, gz = (bb.min.z + bb.max.z) / 2;
        for (const it of list) it.geo.translate(-gx, -gy - 0.31, -gz + 0.05);
      }
      lo.add(kit([...h.top, ...ex]));
      for (const lx of [-0.13, 0.13]) { const p = legPivot(h.leg.map(q => [q[0].clone(), ...q.slice(1)]), lx, h.hipY, 0); lo.add(p); legs.push(p); }
    }
    root.add(body);
    root.add(t.shape === 'spider' ? contactShadow(0.9, 1.2) : t.shape === 'dragon' ? contactShadow(1.1, 2.2) : typeName === 'Wolf' || typeName === 'Cow' ? contactShadow(0.55, 1.9) : contactShadow(0.5));
    const sc = t.scale * (variant ? 1.15 : v.k);
    root.scale.setScalar(sc);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    const e = tag(root, {
      ...t, mesh: root, body, legs, loLegs: legs, maxHp: t.hp, hp: t.hp, alive: true, variant,
      x, z, spawnX: x, spawnZ: z, roam, bounds, radius: 0.7 * Math.max(1, t.scale * 0.8),
      state: 'idle', target: null, wanderAt: 0, nextAttackTick: 0, deathT: 0, respawnAt: 0, lastHitAt: -1e9
    });
    e.lod = { lo, hi: null, parent: body, buildHi: () => buildCreatureRig(typeName, t, rollVariant(typeName, t, seed), extras.map(g => g.clone()), headExtras.map(g => g.clone()), held.map(l => l.map(h => ({ geo: h.geo.clone(), metal: h.metal })))) };
    return e;
  }

  // ---- Agility obstacles: the root sits at the start point, the model spans to the end point ----
  function createObstacle(id, obs, sx, sz, ex, ez) {
    const g = new THREE.Group();
    const L = Math.hypot(ex - sx, ez - sz);
    const parts = [];
    const W = 0x6a4a2a, DW = 0x4a3020, ST = 0x8a8478;
    const style = agilityStyle(obs);
    let swingRope = null;
    const solid = []; // [x0, x1, z0, z1] in obstacle space, kept clear of the path
    if (style === 'shimmy') {
      // stone wall with a narrow foot ledge and a hand edge; the player faces the wall (local -x side)
      solid.push([-0.85, -0.5, -0.3, L + 0.3]);
      parts.push([prim.box(0.5, 2.6, L + 0.6), ST, -0.6, 1.3, L / 2, 0, 0, 0, 0.3], [prim.box(0.32, 0.1, L + 0.6), 0x6a645a, -0.22, 0.55, L / 2],
        [prim.box(0.16, 0.08, L + 0.6), 0x6a645a, -0.32, 2.1, L / 2]);
    } else if (style === 'swing') {
      // two platforms with an A-frame overhead; the rope is its own mesh so it swings with you
      const { R, pivY } = swingGeom(L);
      for (const z of [0.4, L - 0.4]) parts.push([prim.box(1.4, 0.85, 0.9), 0x7a5a3a, 0, 0.425, z, 0, 0, 0, 0.2]);
      for (const x of [-1.1, 1.1]) { parts.push([prim.cyl(0.09, 0.11, pivY + 0.2, 7), W, x, (pivY + 0.2) / 2, L / 2]); solid.push([x - 0.1, x + 0.1, L / 2 - 0.1, L / 2 + 0.1]); }
      parts.push([prim.cyl(0.08, 0.08, 2.4, 7), DW, 0, pivY + 0.05, L / 2, 0, 0, Math.PI / 2], [prim.box(1.2, 0.04, Math.max(0.2, L - 1.8)), 0x1e3a4a, 0, 0.02, L / 2, 0, 0, 0, 0]);
      swingRope = { R, pivY };
    } else if (style === 'monkey') {
      // overhead frame of hand holds (monkey bars)
      for (const z of [0, L]) for (const x of [-0.55, 0.55]) { parts.push([prim.cyl(0.07, 0.08, 2.75, 7), W, x, 1.375, z]); solid.push([x + (x > 0 ? 0.3 : -0.38), x + (x > 0 ? 0.38 : -0.3), z - 0.08, z + 0.08]); }
      for (const x of [-0.55, 0.55]) parts.push([prim.cyl(0.05, 0.05, L, 6), W, x, 2.68, L / 2, Math.PI / 2, 0, 0]);
      const n = Math.max(4, Math.round(L * 2.4));
      for (let i = 0; i <= n; i++) parts.push([prim.cyl(0.03, 0.03, 1.1, 6), 0x9a9aa0, 0, 2.62, (i / n) * L, 0, 0, Math.PI / 2, 0.5]);
    } else if (obs.kind === 'log') {
      parts.push([prim.cyl(0.22, 0.22, L, 10), 0x7a5a3a, 0, 0.45, L / 2, Math.PI / 2, 0, 0],
        [prim.box(0.5, 0.45, 0.3), DW, 0, 0.22, 0.2], [prim.box(0.5, 0.45, 0.3), DW, 0, 0.22, L - 0.2]);
    } else if (obs.kind === 'net') {
      for (const x of [-0.9, 0.9]) parts.push([prim.cyl(0.07, 0.08, 2.4, 7), W, x, 1.2, L / 2]);
      parts.push([prim.box(1.9, 0.1, 0.1), W, 0, 2.35, L / 2]);
      for (const x of [-0.9, 0.9]) solid.push([x - 0.08, x + 0.08, L / 2 - 0.08, L / 2 + 0.08]);
      for (let i = 0; i < 6; i++) parts.push([prim.box(1.8, 0.03, 0.03), 0xcab88a, 0, 0.3 + i * 0.36, L / 2, 0, 0, 0, 0.05]);
      for (let i = 0; i < 6; i++) parts.push([prim.box(0.03, 2.1, 0.03), 0xcab88a, -0.75 + i * 0.3, 1.25, L / 2, 0, 0, 0, 0.05]);
    } else if (obs.kind === 'rope') {
      for (const z of [0, L]) parts.push([prim.cyl(0.08, 0.1, 2.2, 7), W, 0, 1.1, z], [prim.box(0.5, 0.15, 0.5), DW, 0, 0.08, z]);
      parts.push([prim.cyl(0.03, 0.03, L, 5), 0xd8c89a, 0, 1.0, L / 2, Math.PI / 2, 0, 0, 0.05], [prim.cyl(0.025, 0.025, L, 5), 0xd8c89a, 0, 2.0, L / 2, Math.PI / 2, 0, 0, 0.05]);
    } else if (obs.kind === 'pipe') {
      parts.push([prim.cyl(0.5, 0.5, L, 14), 0x6a6a70, 0, 0.5, L / 2, Math.PI / 2, 0, 0, 0.3], [prim.cyl(0.38, 0.38, 0.05, 14), 0x101012, 0, 0.5, -0.01, Math.PI / 2, 0, 0, 0],
        [prim.cyl(0.38, 0.38, 0.05, 14), 0x101012, 0, 0.5, L + 0.01, Math.PI / 2, 0, 0, 0]);
    } else if (obs.kind === 'wall') {
      parts.push([prim.box(2.0, 2.2, 0.6), ST, 0, 1.1, L / 2, 0, 0, 0, 0.3]);
      // hand and foot holds where the climb animation places them
      for (let y = 0.36; y < 2.1; y += 0.3) for (const x of [-0.24, 0.24, -0.15, 0.15]) if ((x * x > 0.03) === (y > 1.0)) parts.push([prim.box(0.14, 0.07, 0.1), 0x5a524a, x, y, L / 2 - 0.34]);
      solid.push([-1.0, 1.0, L / 2 - 0.3, L / 2 + 0.3]);
    } else {
      // gap: two wooden platforms with a drop between them
      for (const z of [0.4, L - 0.4]) {
        parts.push([prim.box(1.4, 0.8, 0.9), 0x7a5a3a, 0, 0.4, z, 0, 0, 0, 0.2]);
        for (const x of [-0.6, 0.6]) parts.push([prim.cyl(0.06, 0.06, 0.9, 6), DW, x, 0.45, z]);
      }
      parts.push([prim.box(1.2, 0.04, Math.max(0.2, L - 1.8)), 0x2a2018, 0, 0.02, L / 2, 0, 0, 0, 0]);
    }
    const m = kit(parts);
    m.castShadow = true; m.receiveShadow = true;
    const yaw = Math.atan2(ex - sx, ez - sz), cy = Math.cos(yaw), sy = Math.sin(yaw);
    m.rotation.y = yaw;
    g.add(m);
    for (const [x0, x1, z0, z1] of solid) {
      const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => [sx + x * cy + z * sy, sz - x * sy + z * cy]);
      colliders.push({ minX: Math.min(...pts.map(p => p[0])), maxX: Math.max(...pts.map(p => p[0])), minZ: Math.min(...pts.map(p => p[1])), maxZ: Math.max(...pts.map(p => p[1])), prop: obs.name });
    }
    let ropeG = null;
    if (swingRope) {
      // pivot group sits on the cross-beam; the rope hangs down its local -y and rotates about x with the swing
      const frame = new THREE.Group(); frame.rotation.y = yaw; g.add(frame);
      ropeG = new THREE.Group(); ropeG.position.set(0, swingRope.pivY, L / 2); frame.add(ropeG);
      const len = swingRope.R + 0.35, ropeMat = new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 0.9 });
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), ropeMat); rope.position.y = -len / 2; rope.castShadow = true; ropeG.add(rope);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), ropeMat); knot.position.y = -len; ropeG.add(knot);
      ropeG.rotation.x = 0;
    }
    g.position.set(sx, 0, sz);
    scene.add(g);
    pickables.push(g);
    occupied.push({ x: (sx + ex) / 2, z: (sz + ez) / 2, r: L / 2 + 1 });
    return tag(g, { mesh: g, type: 'agility', obstacle: id, name: obs.name, verb: obs.verb, alive: true, x: sx, z: sz, toX: ex, toZ: ez, radius: 0.6, rope: ropeG });
  }

  // ---- Rune altars: a ring of standing stones around a glowing altar ----
  const ALTAR_GLOW = { Air: 0xe8f4ff, Mind: 0xffa040, Water: 0x40a0ff, Earth: 0xa07a40, Fire: 0xff5020, Body: 0x7090ff, Chaos: 0xffd030, Death: 0xf0f0f0, Blood: 0xd01818 };
  function createRuneAltar(x, z, altar) {
    const g = new THREE.Group();
    const parts = [[prim.cyl(2.6, 2.8, 0.15, 24), 0x7a746a, 0, 0.07, 0, 0, 0, 0, 0.2], [prim.box(1.3, 0.8, 1.0), 0x9a948a, 0, 0.45, 0, 0, 0, 0, 0.25]];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      parts.push([prim.box(0.45, 1.6 + (i % 2) * 0.4, 0.35), 0x8a8478, Math.cos(a) * 2.3, 0.85, Math.sin(a) * 2.3, 0, -a, (i % 3 - 1) * 0.06, 0.3]);
    }
    g.add(kit(parts));
    const glow = new THREE.Mesh(prim.sphere(0.32, 14, 10), glowMat(ALTAR_GLOW[altar] || 0xffffff));
    glow.position.set(0, 1.25, 0);
    g.add(glow);
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    occupied.push({ x, z, r: 3 });
    colliders.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.5, maxZ: z + 0.5 });
    return tag(g, { mesh: g, type: 'runealtar', altar, name: `${altar} altar`, alive: true, x, z, radius: 1.0, anim: { glow, t: rng() * 6 } });
  }

  // ---- Signposts: boards point at the nearest towns; Read lists every town's direction ----
  function compass(dx, dz) {
    const a = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8];
  }
  function createSignpost(x, z) {
    const g = new THREE.Group();
    const parts = [[prim.box(0.14, 2.1, 0.14), 0x5a3a1e, 0, 1.05, 0, 0, 0, 0, 0.3], [prim.box(0.4, 0.12, 0.4), 0x6a6458, 0, 0.06, 0, 0, 0, 0, 0.3]];
    const towns = Object.entries(TOWNS).map(([n, t]) => ({ n, dx: t.x - x, dz: t.z - z, d: Math.hypot(t.x - x, t.z - z) })).sort((a, b) => a.d - b.d);
    const away = towns.filter(t => t.d > 14);
    away.slice(0, 3).forEach((t, i) => {
      const ux = t.dx / t.d, uz = t.dz / t.d, ry = Math.atan2(-uz, ux), y = 1.85 - i * 0.32;
      parts.push([prim.box(1.0, 0.22, 0.06), [0xb08a5a, 0xa07a4a, 0x9a7448][i], ux * 0.5, y, uz * 0.5, 0, ry, 0, 0.25],
        [prim.box(0.2, 0.16, 0.065), 0x3a2a1a, ux * 0.92, y, uz * 0.92, 0, ry + Math.PI / 4, 0, 0.1]);
    });
    g.add(kit(parts));
    g.position.set(x, 0, z);
    scene.add(g);
    pickables.push(g);
    colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15 });
    const guilds = GUILDS.map(G => ({ n: `${G.name} (${G.skill} ${G.level})`, dx: G.x - x, dz: G.z - z, d: Math.hypot(G.x - x, G.z - z) })).filter(t => t.d < 75);
    const marks = LANDMARKS.map(L => ({ n: L.n, dx: L.x - x, dz: L.z - z, d: Math.hypot(L.x - x, L.z - z) })).filter(t => t.d > 12 && t.d < 140).sort((a, b) => a.d - b.d).slice(0, 3);
    const text = 'The signpost reads: ' + [...away, ...guilds, ...marks].map(t => `${t.n}, ${compass(t.dx, t.dz)} (${Math.round(t.d)} steps)`).join(' · ');
    return tag(g, { mesh: g, type: 'sign', name: 'Signpost', text, alive: true, x, z, radius: 0.6 });
  }

  // ---- Populate ----
  // Town first so trees keep clear of it
  const GUILD_NAMES = new Set(GUILDS.map(g => g.name));
  const buildings = BUILDINGS.filter(b => !GUILD_NAMES.has(b[6])).map(createBuilding);
  buildings.push(createWell(3, 3.2));
  nodes.push(createMerchant(8, 0));
  nodes.push(createBank(-6, -5.6));
  nodes.push(createNpc(5, -7.4, 'bob', 'Bob', { body: 0x3a6a3a, hat: 0x5a3a1a, beard: 0x8a6a4a, apron: 0x6a4a2a }, 0, 0));
  nodes.push(createStation(5.3, 8.6, 'furnace'));
  nodes.push(createStation(8, 8.6, 'anvil'));
  nodes.push(createNpc(9.9, 9.2, 'doric', 'Doric', { body: 0x6a3a2a, beard: 0xc06a2a, apron: 0x3a3a3a, skin: 0xd09a74 }, 8, 8.6));
  nodes.push(createStation(-7.2, 7.7, 'range'));
  nodes.push(createNpc(-5.3, 7.8, 'cook', 'Cook', { body: 0xf0f0f0, hat: 0xffffff, hatH: 0.45, hatW: 0.5, apron: 0xe0e0e0 }, 0, 0));
  nodes.push(createAltar(-4, -7.6));
  nodes.push(createNpc(-1.8, -7.6, 'priest', 'Father Elric', { body: 0x2a2a3a, legs: 0x2a2a3a, hat: null, beard: 0xdddddd, apron: 0xd4af37 }, 0, 0));
  nodes.push(createNpc(-1.8, 13, 'captain', 'Captain Rhea', { body: 0x8a2a2a, legs: 0x3a3a4a, hat: 0x9a9aa8, hatH: 0.28, skin: 0xc89a74 }, 0, 0));
  nodes.push(createNpc(-16, 2, 'ranger', 'Ranger Wyn', { body: 0x2a5a2a, legs: 0x3a2a1a, hat: 0x1e4a1e, hatH: 0.2, skin: 0xc89a74 }, -20, 2));
  nodes.push(createNpc(1.8, -17, 'knight', 'Sir Vyvin', { body: 0xb0b0c0, legs: 0x8a8a9a, hat: 0xc0c0d0, hatH: 0.3, apron: 0x2a4aa0 }, 0, -17));
  // Brightwater herb patches + the apothecary (Herblore shop)
  ['Guam leaf', 'Marrentill', 'Tarromin', 'Harralander'].forEach((h, i) => nodes.push(createHerbPatch(0.6 + i * 2, -14, h, i)));
  nodes.push(Object.assign(createNpc(1.2, -12, 'apothecary', 'Apothecary Lin', { body: 0x4a7a5a, legs: 0x3a3a2a, hat: 0x2a5a3a, hatH: 0.22, apron: 0xe0e0d0 }, 1.2, -14), { shop: 'apothecary' }));
  nodes.push(createNpc(-10.8, -16, 'farmer', 'Farmer Gil', { body: 0x6a8a3a, legs: 0x4a5a8a, hat: 0xd8c070, hatW: 0.8, hatH: 0.12 }, 0, 0));
  nodes.push(createNpc(LAKE.x + Math.cos(-0.9) * (LAKE.r + 1), LAKE.z + Math.sin(-0.9) * (LAKE.r + 1), 'fisherman', 'Fisherman Fred', { body: 0x4a6a8a, legs: 0x3a3a2a, hat: 0x2a4a6a, hatH: 0.2, skin: 0xc89a74 }, LAKE.x, LAKE.z)); // on the lakeshore facing the water
  // Ashford NPCs
  nodes.push(createNpc(50, -22, 'mayor', 'Mayor Aldric', { body: 0x4a3a2a, legs: 0x3a2a1a, hat: 0x8a6a3a, hatH: 0.25, beard: 0x6a4a2a }, 48, -25));
  nodes.push(createNpc(56, -16, 'merchant2', 'Trader Mira', { body: 0xc8b48a, legs: 0x5a4a3a, hat: 0xd4af37, hatH: 0.15 }, 55, -18));
  nodes.push(createNpc(43, -30, 'smith2', 'Smith Torin', { body: 0x6a3a2a, beard: 0xa06a2a, apron: 0x3a3a3a }, 42, -32));
  nodes.push(createNpc(53, -33, 'farmer2', 'Farmer Elara', { body: 0x6a8a3a, legs: 0x4a5a8a, hat: 0xd8c070, hatW: 0.7, hatH: 0.1 }, 52, -35));
  nodes.push(createNpc(58, -24, 'guard2', 'Guard Captain Ryn', { body: 0x8a2a2a, legs: 0x3a3a4a, hat: 0x9a9aa8, hatH: 0.25 }, 60, -22));
  nodes.push(createNpc(46, -20, 'priest2', 'Sister Lira', { body: 0x2a2a3a, legs: 0x2a2a3a, hat: null, beard: null, apron: 0xd4af37 }, 48, -25));
  nodes.push(createNpc(51, -28, 'ranger2', 'Scout Vey', { body: 0x2a5a2a, legs: 0x3a2a1a, hat: 0x1e4a1e, hatH: 0.18 }, 50, -22));
  nodes.push(createNpc(62, -18, 'cook2', 'Chef Bran', { body: 0xf0f0f0, hat: 0xffffff, hatH: 0.4, apron: 0xe0e0e0 }, 60, -22));
  nodes.push(createNpc(40, -26, 'miner', 'Miner Kael', { body: 0x5a4a3a, legs: 0x3a2a1a, hat: 0x6a5a4a, hatH: 0.2, beard: 0x8a6a4a }, 42, -32));
  nodes.push(createNpc(57, -30, 'angler', 'Angler Tess', { body: 0x4a6a8a, legs: 0x3a3a2a, hat: 0x2a4a6a }, 55, -18));
  nodes.push(createNpc(44, -18, 'knight2', 'Sir Elric', { body: 0xb0b0c0, legs: 0x8a8a9a, hat: 0xc0c0d0, hatH: 0.28 }, 48, -25));
  nodes.push(createNpc(54, -26, 'herbalist', 'Herbalist Wren', { body: 0x4a7a5a, legs: 0x3a3a2a, hat: 0x2a5a3a, apron: 0xe0e0d0 }, 52, -35));
  nodes.push(createNpc(59, -28, 'carpenter', 'Carpenter Olan', { body: 0x8a6a4a, legs: 0x5a4a3a, hat: 0x6a4a2a, hatH: 0.15 }, 55, -18));
  // ---- New towns: Port Sarim, Varrock and Falador ----
  const townsfolk = (x, z, npc, name, look, extra, fx, fz) => nodes.push(Object.assign(createNpc(x, z, npc, name, look, fx, fz), extra));
  const MAN = { body: 0x7a6a4a, legs: 0x4a3a2a }, WOMAN = { body: 0x9a4a6a, legs: 0x5a3a4a, apron: 0xe0d8c8 };
  // Brightwater: townsfolk to pickpocket and a wizard selling runes by the tower
  townsfolk(-2.6, 3.8, 'man', 'Man', MAN, { thieve: 'Man', say: 'Nice day for it, eh? Mind your pockets around here.' }, 0, 0);
  townsfolk(2.8, -3.6, 'woman', 'Woman', WOMAN, { thieve: 'Woman', say: 'Have you seen the new agility course past the mine?' }, 0, 0);
  townsfolk(-4, 22, 'mizgog', 'Wizard Mizgog', { body: 0x2a3a9a, legs: 0x2a3a9a, hat: 0x2a3a9a, hatH: 0.5, hatW: 0.42, beard: 0xdddddd }, { shop: 'magic0' }, 0, 24);
  // Port Sarim
  for (const [n, t] of Object.entries(TOWNS)) if (n !== 'Brightwater' && n !== 'Ashford') occupied.push({ x: t.x, z: t.z, r: 9 });
  townsfolk(-84.5, 54, 'gerrant', 'Shopkeeper Gerrant', { body: 0x3a5a8a, legs: 0x3a3a2a, apron: 0xe0d8c8 }, { shop: 'general2' }, -80, 60);
  townsfolk(-75.5, 54, 'betty', 'Betty', { body: 0x6a2a8a, legs: 0x4a2a5a, hat: 0x4a1a6a, hatH: 0.45, hatW: 0.4 }, { shop: 'magic' }, -80, 60);
  townsfolk(-78, 71, 'sailor', 'Sailor', { body: 0x2a4a7a, legs: 0xe0e0e0, hat: 0xf0f0f0, hatH: 0.12 }, { thieve: 'Sailor', say: 'Arr, the docks are no place for landlubbers. Try the rigging course if ye dare.' }, -80, 60);
  townsfolk(-84, 73, 'sailor', 'Sailor', { body: 0x2a4a7a, legs: 0xe0e0e0, hat: 0xf0f0f0, hatH: 0.12 }, { thieve: 'Sailor', say: 'The Water altar is south-west of town, past the willows.' }, -80, 60);
  townsfolk(-76, 62, 'man', 'Man', MAN, { thieve: 'Man', say: 'Welcome to Port Sarim.' }, -80, 60);
  townsfolk(-85, 61, 'woman', 'Woman', WOMAN, { thieve: 'Woman', say: 'Bandits camp to the south-east near a strange dark altar.' }, -80, 60);
  nodes.push(createBank(-80, 51));
  // Varrock
  townsfolk(113.5, -44, 'horvik', 'Horvik', { body: 0x5a3a2a, beard: 0x5a3a1a, apron: 0x3a3a3a }, { shop: 'weapons' }, 120, -40);
  townsfolk(126.5, -44, 'vshop', 'Shopkeeper', { body: 0xc8b48a, legs: 0x5a4a3a, apron: 0xe0d8c8 }, { shop: 'general3' }, 120, -40);
  townsfolk(126.5, -33, 'aubury', 'Aubury', { body: 0x6a2a2a, legs: 0x4a2a2a, hat: 0x7a2a2a, hatH: 0.45, hatW: 0.4, beard: 0xcccccc }, { shop: 'runes' }, 120, -40);
  townsfolk(116, -49.5, 'vguard', 'Varrock Guard', { body: 0x8a8a9a, legs: 0x5a5a6a, hat: 0x9a9aa8, hatH: 0.28 }, { thieve: 'Guard', say: 'Move along, citizen.' }, 120, -40);
  townsfolk(124, -49.5, 'vguard', 'Varrock Guard', { body: 0x8a8a9a, legs: 0x5a5a6a, hat: 0x9a9aa8, hatH: 0.28 }, { thieve: 'Guard', say: 'The wilderness to the north is full of demons and dragons.' }, 120, -40);
  townsfolk(114, -37, 'warrior', 'Warrior', { body: 0x8a3a2a, legs: 0x4a3a2a, hat: 0x7a7a7a, hatH: 0.2 }, { thieve: 'Warrior', say: 'I train on the agility course south-west of town.' }, 120, -40);
  townsfolk(122.5, -36, 'man', 'Man', MAN, { thieve: 'Man', say: 'Aubury sells runes. The essence mine is just south-east of his shop.' }, 120, -40);
  townsfolk(117, -30, 'woman', 'Woman', WOMAN, { thieve: 'Woman', say: 'The Earth altar is north-west of the palace.' }, 120, -40);
  nodes.push(createBank(124, -27));
  // Falador
  townsfolk(-66.5, -84, 'cassie', 'Cassie', { body: 0xb0b0c0, legs: 0x6a6a7a, apron: 0x3a5aa0 }, { shop: 'armour' }, -60, -80);
  townsfolk(-55, -77, 'nessa', 'Nessa', { body: 0x4a7a5a, legs: 0x3a3a2a, hat: 0x2a5a3a, hatH: 0.2, apron: 0xe0e0d0 }, { shop: 'herb2' }, -60, -80);
  townsfolk(-64, -89.5, 'wknight', 'White Knight', { body: 0xe0e0e8, legs: 0xb0b0c0, hat: 0xd0d0d8, hatH: 0.3, apron: 0x2a4aa0 }, { thieve: 'Knight', say: 'For Saradomin and Falador!' }, -60, -80);
  townsfolk(-56, -89.5, 'wknight', 'White Knight', { body: 0xe0e0e8, legs: 0xb0b0c0, hat: 0xd0d0d8, hatH: 0.3, apron: 0x2a4aa0 }, { thieve: 'Knight', say: 'Ogres roam the hills to the north-west.' }, -60, -80);
  townsfolk(-52.5, -89, 'paladin', 'Paladin', { body: 0xd8c070, legs: 0xb0b0c0, hat: 0xd8c070, hatH: 0.3 }, { thieve: 'Paladin', say: 'Only the nimble fingered dare try my purse.' }, -60, -80);
  townsfolk(-68, -89, 'hero', 'Hero', { body: 0x8a1a1a, legs: 0x3a3a4a, hat: 0xd4af37, hatH: 0.18, beard: 0x6a4a2a }, { thieve: 'Hero', say: 'I have slain dragons in the far north-east.' }, -60, -80);
  townsfolk(-63, -76, 'man', 'Man', MAN, { thieve: 'Man', say: 'Welcome to Falador, the white city.' }, -60, -80);
  townsfolk(-56.5, -70, 'woman', 'Woman', WOMAN, { thieve: 'Woman', say: 'The Mind altar is north-east of the castle.' }, -60, -80);
  nodes.push(createBank(-56, -75));
  // Farmers can be pickpocketed too
  for (const n of nodes) if (n.npc === 'farmer' || n.npc === 'farmer2') n.thieve = 'Farmer';

  // ---- Signposts at the town roads ----
  for (const [x, z] of [[-7, 30.5], [62, -25], [-17.5, -15.5], [-75.5, 64.5], [124.5, -35.5], [-65, -79]]) nodes.push(createSignpost(x, z));

  // ---- Agility courses ----
  const COURSE_LAYOUT = {
    brightwater: [[16, 33, 22, 33], [23.5, 33, 26.5, 33], [28, 34, 28, 40], [26, 42, 19, 42]],
    varrock: [[100, -22, 100, -19], [100, -17, 106, -17], [107.5, -17, 110.5, -17], [111.5, -19, 111.5, -25]],
    portsarim: [[-64, 70, -64, 73], [-64, 75, -58, 75], [-56, 75, -56, 72], [-56, 70, -56, 66]],
    falador: [[-84, -66, -84, -63], [-84, -61, -78, -61], [-76, -61, -76, -58], [-76, -56, -80, -56], [-82, -56, -88, -56]]
  };
  for (const [cid, list] of Object.entries(COURSE_LAYOUT)) list.forEach(([sx, sz, ex, ez], i) => nodes.push(createObstacle(`${cid}:${i}`, AGILITY_COURSES[cid].obstacles[i], sx, sz, ex, ez)));

  // ---- Rune altars and the essence mines ----
  for (const [altar, x, z] of [['Air', -26, 34], ['Mind', -40, -102], ['Water', -104, 76], ['Earth', 100, -66], ['Fire', 143, -72], ['Body', -28, -64],
    ['Chaos', -44, 100], ['Death', 98, -126], ['Blood', -128, -134]]) if (RUNE_ALTARS[altar]) nodes.push(createRuneAltar(x, z, altar));
  for (let i = 0; i < 5; i++) { const p = place(132, -22, 4.5, 1.0); if (p) nodes.push(createRock(p.x, p.z, 'Essence')); }

  // ---- Trees around the new towns ----
  for (const [kind, cx, cz, spread, n] of [['Tree', -80, 60, 26, 14], ['Tree', 120, -40, 26, 14], ['Tree', -60, -80, 26, 14], ['Tree', -40, 30, 18, 8], ['Tree', 85, -30, 15, 8],
    ['Oak', -60, 45, 8, 5], ['Oak', 95, -50, 8, 5], ['Willow', -98, 66, 6, 4], ['Maple', 100, -6, 6, 4], ['Yew', -38, -88, 5, 3], ['Magic', 104, -112, 4, 2]]) {
    for (let i = 0; i < n; i++) { const p = place(cx, cz, spread, 1.8); if (p) nodes.push(createTree(p.x, p.z, kind)); }
  }
  fenceLine(-8, -16.5, 0, -16.5);
  fenceLine(10.5, 9.2, 14.5, 9.2);
  fenceLine(10.5, -8.2, 15, -8.2);

  for (let i = 0; i < 26; i++) { const p = place(0, 0, 36, 1.6, 40, 16); if (p) nodes.push(createTree(p.x, p.z, 'Tree')); }
  for (let i = 0; i < 7; i++) { const p = place(26, -24, 8, 2); if (p) nodes.push(createTree(p.x, p.z, 'Oak')); }
  for (let i = 0; i < 5; i++) {
    const a = 0.6 + i * 0.75;
    const x = LAKE.x + Math.cos(a) * (LAKE.r + 3), z = LAKE.z + Math.sin(a) * (LAKE.r + 3);
    occupied.push({ x, z, r: 1.4 });
    nodes.push(createTree(x, z, 'Willow'));
  }
  for (let i = 0; i < 4; i++) { const p = place(31, 4, 5, 2); if (p) nodes.push(createTree(p.x, p.z, 'Maple')); }
  for (let i = 0; i < 3; i++) { const p = place(-31, -1, 4, 2.2); if (p) nodes.push(createTree(p.x, p.z, 'Yew')); }
  for (let i = 0; i < 2; i++) { const p = place(10, -33, 3, 2); if (p) nodes.push(createTree(p.x, p.z, 'Magic')); }
  const mine = [['Copper', 4], ['Tin', 4], ['Iron', 3], ['Coal', 3], ['Mithril', 2], ['Adamantite', 1]];
  for (const [ore, n] of mine) for (let i = 0; i < n; i++) { const p = place(22, 20, 5.5, 1.0); if (p) nodes.push(createRock(p.x, p.z, ore)); }
  for (const [ore, n] of [['Dragon', 1], ['Runite', 1], ['Adamantite', 1], ['Mithril', 1], ['Coal', 2]]) for (let i = 0; i < n; i++) { const p = place(-9, -28, 3, 1.0); if (p) nodes.push(createRock(p.x, p.z, ore)); }
  const spots = [['Net', 3.6], ['Net', 4.3], ['Net', 5.0], ['Lure', -0.6], ['Lure', 0.2], ['Cage', 1.2], ['Harpoon', 2.0]];
  for (const [kind, a] of spots) {
    nodes.push(createFish(LAKE.x + Math.cos(a) * (LAKE.r - 0.6), LAKE.z + Math.sin(a) * (LAKE.r - 0.6), kind));
  }
  // Wild herb patches further out (higher herbs need higher Herblore)
  for (const [h, x, z, ti] of [['Ranarr weed', -27, -8, 4], ['Toadflax', 30, -16, 5], ['Irit leaf', -12, -32, 6], ['Avantoe', 35, 12, 7]]) {
    const p = place(x, z, 4, 1.2); if (p) nodes.push(createHerbPatch(p.x, p.z, h, ti));
  }
  createTower(0, 29);
  fence(-18, -16, 12, 10);

  // ---- Staff inside buildings: smiths, shopkeepers and bankers walk between their spots ----
  const BANKER = { body: 0x2a3a7a, legs: 0x2a2a3a, apron: 0xd4af37 };
  for (const b of buildings) {
    if (!b || !b.spots || !b.spots.staff) continue;
    const pts = b.spots.staff, near = n => Math.hypot(n.x - b.x, n.z - b.z);
    let who = null;
    if (/Bank/.test(b.name)) {
      who = createNpc(pts[0][0], pts[0][1], 'banker', 'Banker', BANKER, b.door.x + b.door.nx * 3, b.door.z + b.door.nz * 3);
      Object.assign(who, { type: 'bank', examine: 'He can look after your money.' });
      nodes.push(who);
      who.patrol = [pts[0], [pts[0][0] + (b.door.nz ? 0.9 : 0), pts[0][1] + (b.door.nx ? 0.9 : 0)]];
      continue;
    }
    const smith = /Smithy/.test(b.name);
    const cands = nodes.filter(n => n.type === 'npc' && !n.patrol && near(n) < 9 && (smith ? /smith|doric/.test(n.npc) : /Tools/.test(b.name) ? n.npc === 'bob' : !!n.shop));
    cands.sort((a, c) => near(a) - near(c));
    who = cands[0];
    if (!who && /General Store/.test(b.name)) {
      who = createNpc(pts[0][0], pts[0][1], 'storekeep', 'Shopkeeper', { body: 0xc8b48a, legs: 0x5a4a3a, apron: 0xe0d8c8 }, b.door.x, b.door.z);
      Object.assign(who, { shop: 'shop' });
      nodes.push(who);
    }
    if (!who) continue;
    who.mesh.position.set(pts[0][0], 0, pts[0][1]); who.x = pts[0][0]; who.z = pts[0][1];
    who.patrol = pts.length > 1 ? pts : [pts[0], [pts[0][0] + 0.6, pts[0][1]]];
  }

  for (let i = 0; i < 4; i++) monsters.push(createMonster('Goblin', 13 + (rng() - 0.5) * 8, -13 + (rng() - 0.5) * 8, 4));
  const field = { minX: -23, maxX: -13, minZ: -20, maxZ: -12 }; // inside the fence
  for (let i = 0; i < 4; i++) monsters.push(createMonster('Cow', -18 + (rng() - 0.5) * 8, -16 + (rng() - 0.5) * 6, 3.5, field));
  monsters.push(createMonster('Guard', -2, 25, 2.5));
  monsters.push(createMonster('Guard', 2.5, 25, 2.5));
  for (const [x, z] of [[-3, -31], [1.5, -33], [-1, -28.5]]) monsters.push(createMonster('Hill Giant', x, z, 3));
  for (const [x, z] of [[-16, -32], [-18, -35]]) monsters.push(createMonster('Black Knight', x, z, 2.5));
  for (const [x, z] of [[-34, 9], [-36, 4.5], [-32.5, 5]]) monsters.push(createMonster('Dark Archer', x, z, 2));
  // New monsters near Brightwater (more in the far wilderness)
  for (const [x, z] of [[38, -8], [40, -12], [36, -14]]) monsters.push(createMonster('Wolf', x, z, 3));
  for (const [x, z] of [[-24, -30], [-28, -27]]) monsters.push(createMonster('Zombie', x, z, 2.5));
  for (const [x, z] of [[24, -38], [28, -36]]) monsters.push(createMonster('Skeleton', x, z, 2.5));
  for (const [x, z] of [[-38, -18], [-36, -22]]) monsters.push(createMonster('Giant Spider', x, z, 2.5));

  // Monsters of the wider world (most were defined but never placed before)
  for (const [x, z] of [[-52, 86], [-46, 92], [-54, 95]]) monsters.push(createMonster('Bandit', x, z, 3));
  for (const [x, z] of [[-108, 38], [-113, 45], [-104, 47]]) monsters.push(createMonster('Moss Giant', x, z, 3));
  for (const [x, z] of [[-116, 96], [-110, 104]]) monsters.push(createMonster('Ice Giant', x, z, 3));
  for (const [x, z] of [[136, -8], [139, -16]]) monsters.push(createMonster('Ice Giant', x, z, 3));
  for (const [x, z] of [[-96, -112], [-102, -107], [-100, -119]]) monsters.push(createMonster('Ogre', x, z, 3));
  monsters.push(createMonster('Grumsh', -112, -124, 3));
  for (const [x, z] of [[112, -100], [123, -97]]) monsters.push(createMonster('Lesser Demon', x, z, 3));
  for (const [x, z] of [[113, -121], [128, -117], [120, -130]]) monsters.push(createMonster('Green Dragon', x, z, 3));
  monsters.push(createMonster('Scorchwing', 134, -136, 3));
  for (const [x, z] of [[-30, -56], [-24, -48]]) monsters.push(createMonster('Wolf', x, z, 3));

  // Quest givers from the 100-quest update: a free spot near each one's home (own rng so the rest of the world is unchanged).
  const qrng = makeRng(9091);
  for (const n of QUEST_NPCS) {
    let p = null;
    for (let i = 0; i < 60 && !p; i++) {
      const sp = 1 + i * 0.12, x = n.x + (qrng() - 0.5) * sp * 2, z = n.z + (qrng() - 0.5) * sp * 2;
      if (insideLake(x, z, 1.5) || colliders.some(b => x > b.minX - 0.8 && x < b.maxX + 0.8 && z > b.minZ - 0.8 && z < b.maxZ + 0.8)) continue;
      if (occupied.some(o => o.r < 6 && Math.hypot(o.x - x, o.z - z) < Math.min(o.r, 2.5) + 0.6)) continue;
      p = { x, z };
    }
    p = p || { x: n.x, z: n.z };
    occupied.push({ x: p.x, z: p.z, r: 0.8 });
    nodes.push(createNpc(p.x, p.z, n.id, n.name, n.look, p.x + 1, p.z + 1));
  }


  // Outer wilderness filler (own rng — keeps every previous placement identical).
  {
    const orng = makeRng(7711);
    const ofree = (x, z, r = 1.6) => {
      if (Math.abs(x) > WORLD_HALF - 3 || Math.abs(z) > WORLD_HALF - 3) return false;
      if (insideLake(x, z, 2.2)) return false;
      for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < r + o.r) return false;
      for (const t of Object.values(TOWNS)) if (Math.hypot(t.x - x, t.z - z) < 14) return false;
      return true;
    };
    for (const [kind, n] of [['Tree', 36], ['Oak', 8], ['Willow', 5], ['Maple', 5], ['Yew', 4]]) {
      for (let i = 0; i < n; i++) {
        let p = null;
        for (let t = 0; t < 50 && !p; t++) {
          const x = (orng() - 0.5) * (WORLD_HALF - 8) * 2, z = (orng() - 0.5) * (WORLD_HALF - 8) * 2;
          if (Math.hypot(x, z) < 155) continue;
          if (!ofree(x, z, 1.8)) continue;
          occupied.push({ x, z, r: 1.8 }); p = { x, z };
        }
        if (p) nodes.push(createTree(p.x, p.z, kind));
      }
    }
  }

  // ---- Guild halls (built last so earlier random placement doesn't shift) ----
  for (const G of GUILDS) {
    const b = createBuilding(BUILDINGS.find(e => e[6] === G.name));
    b.guild = G;
    buildings.push(b);
    const dn = b.door, ux = dn.nz ? 1 : 0, uz = dn.nx ? 1 : 0; // along the back wall
    const bx = b.x - dn.nx * (G.w / 2 - 1.6), bz = b.z - dn.nz * (G.d / 2 - 1.6); // near the back wall
    let k = 0;
    for (const [ore, n] of G.rocks || []) for (let i = 0; i < n; i++, k++) {
      const off = (k - 4) * 1.25; nodes.push(createRock(bx + ux * off, bz + uz * off, ore));
    }
    const side = (G.rocks ? 1.6 : 0), mid = [b.x - dn.nx * side * 0.2, b.z - dn.nz * side * 0.2];
    (G.stations || []).forEach((st, i) => {
      const off = (i ? 1 : -1) * (Math.min(G.w, G.d) / 2 - 1.3);
      const sx = (G.rocks ? mid[0] : bx) + ux * off, sz = (G.rocks ? mid[1] : bz) + uz * off;
      const node = createStation(sx, sz, st); node.guild = G.name; nodes.push(node);
    });
    if (G.bank) {
      const half = (ux ? G.w : G.d) / 2 - 1.4;
      const bk = createBank(b.x + ux * half + dn.nx * 0.4, b.z + uz * half + dn.nz * 0.4);
      nodes.push(bk);
    }
  }

  // ---- The wilds: points of interest across the outer ring (own rng, after everything else) ----
  {
    const wr = makeRng(5150);
    const flat = (x, z, r) => { FLAT_SPOTS.push({ x, z, r }); occupied.push({ x, z, r }); };
    const solid = (x, z, hw, hd) => colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
    const prop = (x, z, parts, name, examine, ry = 0, extra = {}) => {
      const g = new THREE.Group(); g.add(kit(parts)); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); pickables.push(g);
      return tag(g, { mesh: g, type: 'poi', name, examine, alive: true, x, z, radius: 1, ...extra });
    };
    const fireAt = (x, z) => {
      const parts = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; parts.push([blob(0.16, 0.11, 0.14, { detail: 1, lump: 0.2, seed: i }), 0x7a7268, Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5]); }
      parts.push([prim.cyl(0.06, 0.06, 0.8, 7), 0x4a2e16, 0, 0.12, 0, 0, 0.4, Math.PI / 2], [prim.cyl(0.06, 0.06, 0.8, 7), 0x4a2e16, 0, 0.14, 0, 0, -0.6, Math.PI / 2]);
      const e = prop(x, z, parts, 'Campfire', 'A crackling campfire. You could cook on it.', 0, { type: 'station', kind: 'range' });
      const fl = new THREE.Mesh(prim.cone(0.25, 0.7, 8), glowMat(0xff8a2a)); fl.position.y = 0.45; e.mesh.add(fl);
      const fl2 = new THREE.Mesh(prim.cone(0.14, 0.45, 7), glowMat(0xffd060)); fl2.position.y = 0.35; e.mesh.add(fl2);
      fl.scale.setScalar(0.55); fl2.scale.setScalar(0.6); addFire(e.mesh, 1.1); // particles carry the flame; cones are the hot core
      e.name = 'Campfire'; return e;
    };
    const tent = (x, z, ry, hex) => {
      const p = [[prim.prism(2.2, 1.7, 2.6), hex, 0, 0, 0, 0, 0, 0, 0.3], [prim.box(0.06, 1.9, 0.06), 0x5a3a1e, 0, 0.95, 1.32], [prim.box(0.06, 1.9, 0.06), 0x5a3a1e, 0, 0.95, -1.32],
        [prim.prism(0.9, 1.0, 0.04), 0x2a2018, 0, 0, 1.31, 0, 0, 0, 0]];
      for (const sx of [-1, 1]) p.push([prim.cyl(0.01, 0.01, 1.4, 4), 0xd8c89a, sx * 1.5, 0.6, 1.5, 0.4, 0, sx * 0.9]);
      const e = prop(x, z, p, 'Tent', 'A weathered canvas tent.', ry); solid(x, z, 1.1, 1.3); return e;
    };
    const npcAt = (x, z, id, name, look, say, extra = {}) => { const n = createNpc(x, z, id, name, look, x + 1, z + 1); Object.assign(n, { say, ...extra }); nodes.push(n); return n; };
    const bush = (x, z, item) => {
      const leaf = 0x3a6a2a, berry = item === 'White berries' ? 0xf0f0e0 : 0xc02040;
      const g = new THREE.Group(); const full = new THREE.Group();
      g.add(kit([[blob(0.6, 0.5, 0.6, { detail: 2, lump: 0.25, seed: x }), leaf, 0, 0.5, 0], [blob(0.4, 0.35, 0.4, { detail: 1, lump: 0.25, seed: z }), 0x4a7a32, 0.3, 0.75, 0.2]]));
      const bp = []; for (let i = 0; i < 14; i++) { const a = i * 2.4, e2 = (i % 4) * 0.3; bp.push([prim.sphere(0.055, 6, 5), berry, Math.cos(a) * 0.55 * Math.cos(e2), 0.5 + Math.sin(e2) * 0.45, Math.sin(a) * 0.55 * Math.cos(e2), 0, 0, 0, 0.1]); }
      full.add(kit(bp)); g.add(full);
      g.position.set(x, 0, z); scene.add(g); pickables.push(g);
      return tag(g, { mesh: g, full, type: 'forage', name: item === 'White berries' ? 'White berry bush' : 'Redberry bush', item, alive: true, x, z, radius: 0.8, xp: item === 'White berries' ? 18 : 8, level: item === 'White berries' ? 20 : 1 });
    };
    const wall = (x, z, w, h, ry, p) => p.push([prim.box(w, h, 0.5), 0x8a8478, x, h / 2, z, 0, ry, 0, 0.35], [blob(w * 0.3, 0.12, 0.3, { detail: 1, lump: 0.4, seed: x + z }), 0x4a6a2a, x, h, z]);

    // 1) Travellers' campsite (north-west)
    { const cx = -175, cz = -150; flat(cx, cz, 9);
      nodes.push(fireAt(cx, cz)); tent(cx - 4, cz - 3, 0.6, 0x8a6a4a); tent(cx + 4, cz - 3.5, -0.5, 0x5a6a4a);
      prop(cx + 1.6, cz + 1.4, [[prim.cyl(0.2, 0.2, 1.2, 9), 0x6a4a2a, 0, 0.2, 0, 0, 0, Math.PI / 2]], 'Log seat', 'A log to sit on by the fire.', 0.4);
      npcAt(cx - 1.8, cz + 1.2, 'camper', 'Weary Traveller', { body: 0x6a5a4a, legs: 0x3a3028, beard: 0x5a4a3a }, "The road from Falador is long. Rest by the fire a while; you can cook on it if you've caught anything.");
      npcAt(cx + 2.2, cz - 0.6, 'bard', 'Wandering Bard', { body: 0x8a2a4a, legs: 0x2a2a3a, hat: 0x6a1a3a, hatH: 0.16 }, "I sing of the snowy peaks to the north. They say a cave there runs deep, crawling with spiders.");
    }
    // 2) Old ruins (east) with the restless dead
    { const cx = 205, cz = 120; flat(cx, cz, 14); const p = [];
      wall(-5, -4, 6, 2.6, 0, p); wall(-8, 0, 5, 1.6, Math.PI / 2, p); wall(4, -5, 3, 1.1, 0.1, p); wall(7, 1, 4, 2.0, Math.PI / 2, p); wall(1, 6, 5, 0.9, 0.05, p);
      for (const [x, z, h] of [[-3, 3, 3.4], [2, 3, 1.4], [-1, -1, 2.6]]) p.push([prim.cyl(0.4, 0.45, h, 12), 0xa8a294, x, h / 2, z, 0, 0, 0, 0.3]);
      p.push([prim.cyl(0.4, 0.4, 3.2, 12), 0x9a9486, 4, 0.4, -1, 0, 0.3, Math.PI / 2, 0.3]);
      const r = prop(cx, cz, p, 'Ancient ruins', 'The broken walls of a forgotten keep. Something stirs among the stones.');
      solid(cx - 5, cz - 4, 3, 0.3); solid(cx - 8, cz, 0.3, 2.5); solid(cx + 7, cz + 1, 0.3, 2);
      for (const [x, z] of [[-2, 1], [3, -2], [0, 4], [-5, 3]]) monsters.push(createMonster('Skeleton', cx + x, cz + z, 3));
      for (const [x, z] of [[6, 5], [-6, -6]]) monsters.push(createMonster('Zombie', cx + x, cz + z, 3));
      npcAt(cx - 12, cz + 2, 'warden', 'Ruins Warden', { body: 0x4a4a5a, legs: 0x2a2a3a, hat: 0x6a6a72, hatH: 0.26 }, null, { bounty: BOUNTIES.find(b => b.id === 'ruins') });
    }
    // 3) Watchtower on the western plateau + bandit hideout
    { const cx = -225, cz = 40; flat(cx, cz, 7); const p = [];
      p.push([prim.cyl(2.0, 2.4, 7, 16), 0x8a8478, 0, 3.5, 0, 0, 0, 0, 0.4], [prim.cyl(2.6, 2.6, 0.3, 16), 0x6a5a4a, 0, 7.15, 0]);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; p.push([prim.box(0.6, 0.7, 0.4), 0x8a8478, Math.cos(a) * 2.4, 7.6, Math.sin(a) * 2.4, 0, -a, 0, 0.3]); }
      p.push([prim.cone(2.9, 2.4, 16), 0x7a3a2a, 0, 9.4, 0, 0, 0, 0, 0.3], [prim.box(1.0, 1.9, 0.2), 0x3a2a1a, 0, 0.95, 2.3, 0, 0, 0, 0], [prim.box(0.4, 0.8, 0.2), 0x1a1a22, 1.3, 4.5, 1.8, 0, 0.6, 0]);
      prop(cx, cz, p, 'Watchtower', 'A stone watchtower keeping an eye on the western highlands.'); solid(cx, cz, 2.2, 2.2);
      npcAt(cx + 2.5, cz + 3.5, 'watchman', 'Captain Brann', { body: 0x3a3a6a, legs: 0x2a2a3a, hat: 0x8a8a94, hatH: 0.26 }, null, { bounty: BOUNTIES.find(b => b.id === 'bandits') });
      const bx = -205, bz = 95; flat(bx, bz, 7); tent(bx, bz - 2, 0.2, 0x4a3a2a); nodes.push(fireAt(bx + 2, bz + 2));
      for (const [x, z] of [[-3, 3], [3, -2], [4, 4], [-2, -4]]) monsters.push(createMonster('Bandit', bx + x, bz + z, 3));
      nodes.push(createSignpost(cx + 5, cz + 6));
    }
    // 4) Hunter camp (south-east) with a wolf pack in the dale
    { const cx = 160, cz = 205; flat(cx, cz, 8); tent(cx - 3, cz - 2, -0.3, 0x6a5a3a); nodes.push(fireAt(cx + 1.5, cz + 1));
      const rack = []; for (const x of [-1, 1]) rack.push([prim.box(0.1, 1.8, 0.1), 0x5a3a1e, x, 0.9, 0]); rack.push([prim.box(2.2, 0.08, 0.08), 0x5a3a1e, 0, 1.7, 0]);
      for (let i = 0; i < 3; i++) rack.push([prim.box(0.5, 0.8, 0.03), [0x8a6a4a, 0x7a7a80, 0x9a8a70][i], -0.7 + i * 0.7, 1.25, 0, 0, 0, 0, 0.2]);
      prop(cx + 3.5, cz - 2.5, rack, 'Drying rack', 'Pelts drying in the wind.', 0.5);
      npcAt(cx + 0.5, cz + 3.4, 'hunter', 'Rhea the Hunter', { body: 0x4a5a2a, legs: 0x3a3020, hat: 0x3a4a1a, hatH: 0.16 }, null, { bounty: BOUNTIES.find(b => b.id === 'wolves') });
      for (let i = 0; i < 6; i++) monsters.push(createMonster('Wolf', cx - 20 + (wr() - 0.5) * 16, cz - 25 + (wr() - 0.5) * 12, 4));
      nodes.push(createSignpost(cx + 6, cz + 5));
    }
    // 5) Wayside shrine (south) — pray to restore prayer
    { const cx = -20, cz = 230; flat(cx, cz, 6);
      const g = new THREE.Group(); const p = [[prim.cyl(1.6, 1.8, 0.3, 18), 0x9a9486, 0, 0.15, 0], [prim.box(1.0, 1.2, 0.6), 0xd8d0c0, 0, 0.9, 0], [prim.cone(0.7, 0.9, 4), 0xc8c0b0, 0, 1.95, 0, 0, Math.PI / 4]];
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.785; p.push([prim.cyl(0.12, 0.14, 1.6, 8), 0xb8b0a0, Math.cos(a) * 1.3, 0.9, Math.sin(a) * 1.3]); }
      g.add(kit(p)); const orb = new THREE.Mesh(prim.sphere(0.18, 14, 10), glowMat(0x9ad8ff)); orb.position.y = 1.65; g.add(orb);
      g.position.set(cx, 0, cz); scene.add(g); pickables.push(g); solid(cx, cz, 0.6, 0.4);
      nodes.push(tag(g, { mesh: g, type: 'altar', name: 'Wayside shrine', alive: true, x: cx, z: cz, radius: 1.2 }));
      for (let i = 0; i < 5; i++) { const a = i * 1.3; nodes.push(bush(cx + Math.cos(a) * 7, cz + Math.sin(a) * 7, i % 2 ? 'White berries' : 'Redberries')); }
    }
    // 6) Cave entrance in the northern mountains, guarded by giant spiders. Enter it to reach the cavern.
    { const cx = CAVE.entrance.x, cz = CAVE.entrance.z; flat(cx, cz, 10); const p = [];
      for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8); p.push([blob(1.4, 1.6, 1.2, { detail: 2, lump: 0.25, seed: i }), 0x6a645c, Math.cos(a) * 3, Math.sin(a) * 3.2, -1, 0, 0, 0]); }
      p.push([blob(2.8, 2.4, 1.0, { detail: 2, lump: 0.1, seed: 9 }), 0x08080a, 0, 1.4, -1.6, 0, 0, 0, 0]);
      for (let i = 0; i < 5; i++) p.push([prim.cone(0.12, 0.6, 6), 0x5a544c, -1.6 + i * 0.8, 3.0, -0.4, Math.PI]);
      for (const sx of [-1, 1]) p.push([prim.cyl(0.06, 0.07, 1.6, 6), 0x5a3a1a, sx * 2.2, 0.8, 0.4], [prim.box(0.14, 0.2, 0.14), 0x3a2a1a, sx * 2.2, 1.65, 0.4]);
      const ent = prop(cx, cz, p, 'Cave entrance', 'A dark cave mouth breathing cold air. Torches light the way down into the mountain.', 0, { type: 'cave', dest: CAVE.inside, radius: 2.2 });
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(prim.sphere(0.12, 8, 6), glowMat(0xffa040)); f.position.set(sx * 2.2, 1.85, 0.4); ent.mesh.add(f); }
      nodes.push(ent); solid(cx, cz - 1.6, 4, 1.0);
      for (const [x, z] of [[-4, 4], [4, 5], [0, 7]]) monsters.push(createMonster('Giant Spider', cx + x, cz + z, 3));
      for (const [ore, x, z] of [['Coal', -7, 2], ['Iron', 8, 4]]) nodes.push(createRock(cx + x, cz + z, ore));
      for (const [x, z] of [[-60, -230], [-20, -250], [110, -240]]) monsters.push(createMonster('Ice Giant', x, z, 4));
    }
    // 6b) The cavern: rock shell (inside faces only, so the camera can look in from above),
    // a stony floor, stalactites and stalagmites, glowing crystals and torches, webs,
    // spiders, coal / iron / mithril seams, and the spider queen's hoard at the back.
    { const { x: cx, z: cz, r: R } = CAVE; flat(cx, cz, R + 8);
      const rockC = new THREE.Color(0x6a6058), rc = new THREE.Color();
      const shellGeo = () => { const g = new THREE.SphereGeometry(R, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2); g.deleteAttribute('uv'); const q = g.attributes.position;
        for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), k = 1 + 0.09 * snoise(x * 0.35, y * 0.5, z * 0.35, 21) + 0.04 * snoise(x * 1.3, y * 1.3, z * 1.3, 22); q.setXYZ(i, x * k, y * 0.58 * k, z * k); }
        g.computeVertexNormals();
        return paint(g, (x, y, z) => rc.copy(rockC).multiplyScalar(0.7 + 0.35 * (0.5 + 0.5 * snoise(x * 0.8, y * 1.6, z * 0.8, 3)) - Math.max(0, 0.25 - y * 0.1))); };
      const innerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, side: THREE.BackSide });
      const inner = new THREE.Mesh(shellGeo(), innerMat); inner.receiveShadow = true;
      const outer = new THREE.Mesh(shellGeo(), vcMat); outer.castShadow = true; outer.receiveShadow = true; outer.scale.setScalar(1.04);
      const cave = new THREE.Group(); cave.position.set(cx, 0, cz); cave.add(inner); cave.add(outer); scene.add(cave);
      cave.userData = { inner, outer };
      const parts = [];
      parts.push([blob(R - 0.3, 0.25, R - 0.3, { detail: 3, lump: 0.05, seed: 31, flat: 0.2 }), 0x5a5048, 0, 0.0, 0, 0, 0, 0, 0.1]);
      const wr2 = makeRng(777);
      for (let i = 0; i < 26; i++) { const a = wr2() * Math.PI * 2, d = 2 + wr2() * (R - 4), h = 0.8 + wr2() * 1.6; parts.push([prim.cone(0.16 + wr2() * 0.2, h, 7), 0x5a5048, Math.cos(a) * d, 8.2 * Math.sqrt(Math.max(0, 1 - (d / R) ** 2)) - h / 2, Math.sin(a) * d, Math.PI]); }
      const mites = [];
      for (let i = 0; i < 14; i++) { const a = wr2() * Math.PI * 2, d = 6 + wr2() * (R - 8), h = 0.6 + wr2() * 1.4; const mx = Math.cos(a) * d, mz = Math.sin(a) * d; if (Math.hypot(mx, mz + 13 - R) < 3) continue; parts.push([prim.cone(0.25 + wr2() * 0.2, h, 7), 0x6a6056, mx, h / 2, mz]); mites.push([mx, mz]); }
      for (let i = 0; i < 10; i++) { const a = wr2() * Math.PI * 2; parts.push([blob(0.9, 0.6, 0.8, { detail: 1, lump: 0.3, seed: 40 + i }), 0x524a42, Math.cos(a) * (R - 1.2), 0.3, Math.sin(a) * (R - 1.2)]); }
      // webs: thin pale sheets strung between stalagmites and the wall

      // torch brackets by the exit
      for (const sx of [-1, 1]) parts.push([prim.cyl(0.05, 0.06, 1.2, 6), 0x5a3a1a, sx * 1.8, 1.2, R - 1.4], [prim.box(0.12, 0.16, 0.12), 0x3a2a1a, sx * 1.8, 1.85, R - 1.4]);
      // exit: a rope up to the light
      parts.push([prim.cyl(0.035, 0.035, 7.5, 6), 0xc8b088, 0, 3.75, R - 3], [blob(1.2, 0.3, 1.0, { detail: 1, lump: 0.2, seed: 50 }), 0x5a5048, 0, 0.1, R - 3]);
      const deco = new THREE.Group(); deco.add(kit(parts)); cave.add(deco);
      for (const sx of [-1, 1]) { const h = new THREE.Object3D(); h.position.set(sx * 1.8, 1.97, R - 1.4); deco.add(h); addFire(h, 0.5, 'torch', { ground: 1.97 }); }
      { // webs: radial spokes and spiral threads
        const wm = new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.55 }), v = [];
        for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; v.push(0, 0, 0, Math.cos(t) * 1.2, Math.sin(t) * 1.2, 0); }
        for (let ring = 1; ring <= 4; ring++) for (let k = 0; k < 8; k++) { const r = ring * 0.27, t0 = k / 8 * Math.PI * 2, t1 = (k + 1) / 8 * Math.PI * 2; v.push(Math.cos(t0) * r, Math.sin(t0) * r, 0, Math.cos(t1) * r * 0.97, Math.sin(t1) * r * 0.97, 0); }
        const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, w = new THREE.LineSegments(wg, wm); w.position.set(Math.cos(a) * (R - 2.4), 1.9 + (i % 3) * 0.5, Math.sin(a) * (R - 2.4)); w.rotation.y = -a + Math.PI / 2; cave.add(w); } }
      // glowing crystal clusters (unlit, so they read in the dark)
      const crystals = [[-9, -6, 0x6ad0ff], [8, -8, 0xb070ff], [-11, 4, 0x6ad0ff], [10, 5, 0x70ffc0], [0, -13, 0xb070ff]];
      for (const [x, z, c] of crystals) for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(prim.cone(0.12, 0.7 + k * 0.15, 5), glowMat(c)); m.position.set(x + (k - 1.5) * 0.25, 0.3, z + (k % 2) * 0.2); m.rotation.z = (k - 1.5) * 0.25; cave.add(m); }
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(prim.sphere(0.14, 8, 6), glowMat(0xffa040)); f.position.set(sx * 1.8, 2.0, R - 1.4); cave.add(f); }
      { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), glowMat(0xfff0c8)); hole.rotation.x = Math.PI / 2; hole.position.set(0, 7.6, R - 3); cave.add(hole); }
      const lights = [new THREE.PointLight(0xffa050, 9, 26, 1), new THREE.PointLight(0x8ac0ff, 8, 30, 1), new THREE.PointLight(0xc090ff, 5, 22, 1)];
      lights[0].position.set(0, 2.6, R - 2.5); lights[1].position.set(-6, 4, -4); lights[2].position.set(7, 3, -6);
      for (const L of lights) cave.add(L);
      cave.userData.lights = lights;
      CAVE.group = cave;
      // the walls are solid: a ring of boxes keeps you inside (and walkers outside)
      for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, wx = cx + Math.cos(a) * (R - 0.6), wz = cz + Math.sin(a) * (R - 0.6); colliders.push({ minX: wx - 1.6, maxX: wx + 1.6, minZ: wz - 1.6, maxZ: wz + 1.6, cave: true }); }
      for (const [mx, mz] of mites) solid(cx + mx, cz + mz, 0.3, 0.3);
      // exit node
      const ex = new THREE.Group(); ex.position.set(cx, 0, cz + R - 3); scene.add(ex); pickables.push(ex);
      ex.add(new THREE.Mesh(prim.cyl(1.0, 1.0, 0.2, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })));
      nodes.push(tag(ex, { mesh: ex, type: 'cave', name: 'Rope (exit)', examine: 'A rope leads back up to daylight.', dest: CAVE.outside, alive: true, x: cx, z: cz + R - 3, radius: 1.2 }));
      // seams of ore along the walls
      for (const [ore, a] of [['Coal', 3.6], ['Coal', 3.85], ['Coal', 4.1], ['Iron', 5.0], ['Iron', 5.25], ['Mithril', 0.4], ['Mithril', 0.7]]) nodes.push(createRock(cx + Math.cos(a) * (R - 3.4), cz + Math.sin(a) * (R - 3.4), ore));
      // spiders, with a bigger brood mother near the hoard
      for (const [x, z] of [[-5, -3], [5, -2], [-2, 4], [6, 6]]) monsters.push(createMonster('Giant Spider', cx + x, cz + z, 2.5, { minX: cx - R + 3, maxX: cx + R - 3, minZ: cz - R + 3, maxZ: cz + R - 3 }));
      { const q = createMonster('Giant Spider', cx, cz - 9, 1.5, { minX: cx - 4, maxX: cx + 4, minZ: cz - 12, maxZ: cz - 6 }); q.variant = 'Brood Mother'; q.mesh.scale.multiplyScalar(1.4); q.maxHp = q.hp = Math.round(q.hp * 2); q.level = (q.level || 1) + 15; monsters.push(q); }
      // the hoard
      const ch = new THREE.Group(); ch.position.set(cx, 0, cz - R + 2.6); scene.add(ch); pickables.push(ch);
      ch.add(kit([[prim.box(1.1, 0.6, 0.7), 0x6a4a2a, 0, 0.3, 0, 0, 0, 0, 0.2], [prim.cyl(0.35, 0.35, 1.1, 12, 1), 0x5a3a1e, 0, 0.6, 0, 0, 0, Math.PI / 2, 0.2],
        [prim.box(1.14, 0.06, 0.74), 0xc9a227, 0, 0.12, 0], [prim.box(1.14, 0.06, 0.74), 0xc9a227, 0, 0.5, 0], [prim.box(0.14, 0.18, 0.06), 0xd4af37, 0, 0.55, 0.37],
        ...[0, 1, 2, 3, 4, 5].map(i => [prim.cyl(0.08, 0.08, 0.03, 10), 0xffd040, -0.8 + i * 0.3, 0.02, 0.6 + (i % 2) * 0.2, 0, 0, 0, 0])]));
      solid(cx, cz - R + 2.6, 0.55, 0.35);
      nodes.push(tag(ch, { mesh: ch, type: 'chest', name: "Brood Mother's hoard", examine: 'A battered chest wrapped in old webbing, half-buried in coins.', alive: true, x: cx, z: cz - R + 2.6, radius: 0.9 }));
    }
    // 7) Mountain pond with fishing spots (north-east foothills)
    { const P = PONDS[0]; flat(P.x, P.z, P.r + 5);
      const w = new THREE.Mesh(new THREE.CircleGeometry(P.r + 0.25, 48), hookWaterNoise(waterMaterial(P.x, P.z, P.r + 0.25))); w.rotation.x = -Math.PI / 2; w.position.set(P.x, 0.05, P.z); scene.add(w); WATER_MESHES.push(w);
      const b = new THREE.Mesh(new THREE.CircleGeometry(P.r + 0.3, 32), new THREE.MeshBasicMaterial({ color: 0x0c2a3a })); b.rotation.x = -Math.PI / 2; b.position.set(P.x, 0.015, P.z); scene.add(b);
      ['Lure', 'Net', 'Cage'].forEach((k, i) => { const a = i * 2.1; nodes.push(createFish(P.x + Math.cos(a) * (P.r - 0.6), P.z + Math.sin(a) * (P.r - 0.6), k)); });
      npcAt(P.x + P.r + 1.5, P.z, 'angler', 'Old Angler', { body: 0x3a5a6a, legs: 0x3a3a2a, hat: 0x6a8a3a, hatW: 0.7, hatH: 0.1 }, "Quiet up here. Trout and salmon bite on the lure, and there's lobster if you've a cage.");
    }
    // 8) Berry thickets scattered through the ring, and a few more wild spawns
    for (let i = 0; i < 18; i++) {
      for (let t = 0; t < 20; t++) {
        const a = wr() * Math.PI * 2, d = 170 + wr() * 100, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.abs(x) > WORLD_HALF - 8 || Math.abs(z) > WORLD_HALF - 8 || occupied.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 2)) continue;
        occupied.push({ x, z, r: 1 }); nodes.push(bush(x, z, wr() < 0.35 ? 'White berries' : 'Redberries')); break;
      }
    }
    for (const [x, z] of [[-150, 185], [-140, 195], [-160, 200]]) monsters.push(createMonster('Moss Giant', x, z, 4));
    for (const [x, z] of [[230, -60], [238, -52]]) monsters.push(createMonster('Hill Giant', x, z, 4));
    for (const [x, z] of [[-245, -120], [-250, -130]]) monsters.push(createMonster('Dark Archer', x, z, 3));
    // 9) A wandering merchant who walks between the camps
    { const m = npcAt(-170, -146, 'pedlar', 'Wandering Pedlar', { body: 0x8a6a2a, legs: 0x4a3a2a, hat: 0x5a3a1a, hatW: 0.7, hatH: 0.1 }, null, { shop: 'shop' });
      m.patrol = [[-170, -146], [-150, -120], [-125, -95], [-150, -120]]; m.wander = true; }
    { const m = npcAt(196, 118 + 12, 'pilgrim', 'Pilgrim', { body: 0xd8d0b0, legs: 0x8a8070 }, "I walk from the ruins to the shrine and back, and pray for the lost along the way.");
      m.patrol = [[193, 132], [175, 150], [160, 170], [175, 150]]; m.wander = true; }
    for (const [x, z] of [[-168, -132], [196, 132], [-12, 222], [52, -190], [174, 112]]) nodes.push(createSignpost(x, z));
  }

  // ---- Elevation: keep every town, road, building and work spot level, then lift the land ----
  {
    const flats = [{ x: LAKE.x, z: LAKE.z, r: LAKE.r + 6 }];
    for (const t of Object.values(TOWNS)) flats.push({ x: t.x, z: t.z, r: t === TOWNS.Brightwater ? 42 : 24 });
    for (const o of occupied) if (o.r >= 2.5) flats.push({ x: o.x, z: o.z, r: Math.min(o.r, 12) + 1 });
    for (const n of nodes) if (n.type !== 'tree' && n.type !== 'rock' && n.type !== 'fish') flats.push({ x: n.x, z: n.z, r: (n.radius || 1) + 2.5 });
    for (const sp of FLAT_SPOTS) flats.push(sp);
    bakeHeightField(flats, PATHS.map(([x1, z1, x2, z2]) => ({ x1, z1, x2, z2, r: 2.6 })), colliders);
    for (let i = 0; i < pos.count; i++) pos.setZ(i, terrainHeight(pos.getX(i), -pos.getY(i)));
    groundGeo.computeVertexNormals();
    pos.needsUpdate = true; groundGeo.computeBoundingSphere(); groundGeo.computeBoundingBox();
    // Everything placed at ground level sits on the surface.
    for (const o of scene.children) {
      if (o === ground || o === water || o === bed || o.isLight || Math.abs(o.position.y) > 0.001) continue;
      o.position.y = terrainHeight(o.position.x, o.position.z);
    }
  }
  flushTreesAndRocks();
  scatterDecor(scene, rng, occupied);
  return { ground, nodes, monsters, pickables, buildings };
}

// ---- Ground clutter (grass, flowers, bushes) in 64×64 chunks ----
let decorFine = null;
const decorChunks = new Map(); // key "cx,cz" -> { group, fine: meshes[] }
let decorChunkActive = new Set();
export function setDecorQuality(q) {
  if (!decorFine) return;
  const show = q !== 'low';
  for (const m of decorFine) m.visible = show;
}
export function updateDecorChunks(px, pz, radius = 110) {
  // A chunk is needed when its nearest point is within the radius (usually 3x3 or fewer).
  const need = new Set();
  for (const [key, c] of decorChunks) {
    const nx = Math.max(c.minX, Math.min(px, c.minX + CHUNK_SIZE)), nz = Math.max(c.minZ, Math.min(pz, c.minZ + CHUNK_SIZE));
    if ((nx - px) ** 2 + (nz - pz) ** 2 < radius * radius) need.add(key);
  }
  for (const key of decorChunkActive) {
    if (!need.has(key)) { const c = decorChunks.get(key); if (c) c.group.visible = false; decorChunkActive.delete(key); }
  }
  for (const key of need) {
    if (!decorChunkActive.has(key)) { const c = decorChunks.get(key); if (c) c.group.visible = true; decorChunkActive.add(key); }
  }
}
function distToSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}
let decorOk = null, localGrass = null;
// Dense near-player meadow (High): an 8x8 ring of 4 m blocks around the player. Each block owns a fixed slice of one
// InstancedMesh; when the player crosses a 4 m cell only the blocks that scrolled into range are regenerated (a strip of
// 8 blocks, ~1,800 placement tests) instead of the whole 32 m square, so walking no longer hitches.
const LG_B = 8, LG_SZ = 4, LG_CAP = 240, LG_S = 0.27;
export function updateLocalGrass(scene, px, pz, on) {
  if (!decorOk) return;
  if (!localGrass) {
    const N = LG_B * LG_B * LG_CAP, mat = makeFoliageMat({}, 2.5, true), geo = tuftGeometry(4, 0.34, 0.12);
    const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < N; i++) mesh.setMatrixAt(i, zero);
    scene.add(mesh); localGrass = { mesh, slots: new Array(LG_B * LG_B).fill(null), zero };
  }
  const G = localGrass; G.mesh.visible = on; if (!on) return;
  const cbx = Math.floor(px / LG_SZ), cbz = Math.floor(pz / LG_SZ), H = LG_B / 2;
  // walking scrolls in 8 blocks per cell, filled one per frame; a teleport (or first fill) refills everything at once
  let stale = 0; for (let bx = cbx - H; bx < cbx + H; bx++) for (let bz = cbz - H; bz < cbz + H; bz++) if (G.slots[(((bx % LG_B) + LG_B) % LG_B) * LG_B + (((bz % LG_B) + LG_B) % LG_B)] !== bx + ',' + bz) stale++;
  if (!stale) return;
  let dirty = false, budget = stale > 16 ? 64 : 1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
  for (let bx = cbx - H; bx < cbx + H; bx++) for (let bz = cbz - H; bz < cbz + H; bz++) {
    const si = (((bx % LG_B) + LG_B) % LG_B) * LG_B + (((bz % LG_B) + LG_B) % LG_B), key = bx + ',' + bz;
    if (G.slots[si] === key) continue;
    if (budget-- <= 0) continue;
    G.slots[si] = key; dirty = true;
    let n = 0; const base = si * LG_CAP;
    const g0x = Math.ceil(bx * LG_SZ / LG_S), g1x = Math.ceil((bx + 1) * LG_SZ / LG_S), g0z = Math.ceil(bz * LG_SZ / LG_S), g1z = Math.ceil((bz + 1) * LG_SZ / LG_S);
    for (let gx = g0x; gx < g1x && n < LG_CAP; gx++) for (let gz = g0z; gz < g1z && n < LG_CAP; gz++) {
      const r1 = hash(gx, gz), r2 = hash(gz + 7.3, gx - 2.1); if (r1 > 0.62) continue;
      const x = (gx + r2) * LG_S, z = (gz + hash(gx + 1.7, gz + 9.2)) * LG_S;
      if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2 || !decorOk(x, z, 0.2)) continue;
      const s = 0.55 + r1 * 0.9;
      m4.compose(p.set(x, terrainHeight(x, z) - 0.02, z), q.setFromEuler(e.set(0, r2 * 6.283, 0)), sc.set(s, s * (0.8 + r2 * 0.5), s));
      G.mesh.setMatrixAt(base + n, m4); G.mesh.setColorAt(base + n, c.setHSL(0.21 + r2 * 0.07, 0.33 + r1 * 0.15, 0.62 + hash(gx * 3, gz) * 0.28)); n++;
    }
    for (; n < LG_CAP; n++) G.mesh.setMatrixAt(base + n, G.zero);
  }
  if (dirty) { G.mesh.instanceMatrix.needsUpdate = true; G.mesh.instanceColor.needsUpdate = true; }
  G.filled = true;
}
function scatterDecor(scene, rng, occupied) {
  const ok = decorOk = (x, z, pad) => {
    if (Math.hypot(x, z) < 6.5 || Math.hypot(x - 50, z + 24) < 4) return false;
    for (const t of Object.values(TOWNS)) if (Math.hypot(x - t.x, z - t.z) < 6) return false;
    if (Math.hypot(x - 132, z + 22) < 6) return false;
    if (insideLake(x, z, 2.6)) return false;
    for (const p of PATHS) if (distToSeg(x, z, ...p) < 1.4) return false;
    for (const b of colliders) if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return false;
    for (const o of occupied) if (o.r < 3 && Math.hypot(o.x - x, o.z - z) < o.r * 0.6 + pad) return false;
    if (Math.hypot(x - 22, z - 20) < 6 || Math.hypot(x + 9, z + 28) < 4) return false;
    return true;
  };
  // Density scales gently with area so phones aren't crushed by the bigger map.
  const areaScale = (WORLD_HALF / 150) ** 2;
  const grassMat = makeFoliageMat({}, 2.5);
  const flowerMat = makeFoliageMat({}, 2.5);
  const FLOWER = [0xf0e040, 0xffffff, 0xe05a8a, 0x9a6ae0, 0xff8a3a];
  const bushGeo = bake([paint(blob(0.6, 0.45, 0.6, { detail: 1, lump: 0.28, seed: 4, flat: 0.6 }), (x, y, z, nx, ny) => new THREE.Color(0x2e6a22).multiplyScalar(0.7 + 0.45 * (0.5 + ny * 0.5)))]);
  bushGeo.translate(0, 0.25, 0);
  const pebGeo = bake([col(blob(0.12, 0.07, 0.1, { detail: 0, lump: 0.3, seed: 9 }), 0x8a857c, 0.3)]);
  const grassGeo = tuftGeometry(), flowerGeo = flowerGeometry();
  // Collect placements per chunk, then build one InstancedMesh per (chunk, kind).
  const buckets = new Map(); // key -> { grass:[], flowers:[], bushes:[], pebbles:[] }
  function bucket(x, z) {
    const cx = Math.floor((x + WORLD_HALF) / CHUNK_SIZE), cz = Math.floor((z + WORLD_HALF) / CHUNK_SIZE);
    const key = cx + ',' + cz;
    if (!buckets.has(key)) buckets.set(key, { grass: [], grassHi: [], flowers: [], bushes: [], pebbles: [] });
    return buckets.get(key);
  }
  function scatterInto(kind, count, range, pad, scaleMin, scaleMax, colorFn) {
    let n = 0;
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      const x = (rng() - 0.5) * range * 2, z = (rng() - 0.5) * range * 2;
      if (!ok(x, z, pad)) continue;
      const s = scaleMin + rng() * (scaleMax - scaleMin), ry = rng() * Math.PI * 2;
      const c = colorFn ? colorFn(new THREE.Color()) : null;
      bucket(x, z)[kind].push({ x, z, s, ry, c });
      n++;
    }
  }
  scatterInto('grass', Math.round(8000 * Math.min(areaScale, 1.6)), WORLD_HALF - 2, 0.3, 0.7, 1.4, cc => cc.setHSL(0.22 + rng() * 0.06, 0.35, 0.75 + rng() * 0.2));
  // High-only meadow layer: twice as many tufts again, shorter and darker near the roots so the ground reads as thick grass
  scatterInto('grassHi', Math.round(16000 * Math.min(areaScale, 1.6)), WORLD_HALF - 2, 0.3, 0.5, 1.1, cc => cc.setHSL(0.2 + rng() * 0.09, 0.3 + rng() * 0.15, 0.62 + rng() * 0.25));
  scatterInto('flowers', Math.round(900 * Math.min(areaScale, 1.6)), WORLD_HALF - 2, 0.3, 0.8, 1.3, cc => cc.setHex(FLOWER[(rng() * FLOWER.length) | 0]));
  scatterInto('bushes', Math.round(320 * Math.min(areaScale, 1.5)), WORLD_HALF - 3, 1.0, 0.7, 1.4, cc => cc.setHSL(0.27 + rng() * 0.07, 0.4 + rng() * 0.2, 0.55 + rng() * 0.15));
  scatterInto('pebbles', Math.round(650 * Math.min(areaScale, 1.5)), WORLD_HALF - 2, 0.2, 0.6, 2.0, cc => cc.setScalar(0.75 + rng() * 0.35));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  decorFine = [];
  for (const [key, lists] of buckets) {
    const group = new THREE.Group();
    group.visible = false;
    group.name = 'decor:' + key;
    const fine = [];
    function makeInst(geo, mat, list, shadow) {
      if (!list.length) return null;
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        m4.compose(p.set(it.x, terrainHeight(it.x, it.z) - 0.02, it.z), q.setFromEuler(e.set(0, it.ry, 0)), sc.set(it.s, it.s, it.s));
        inst.setMatrixAt(i, m4);
        if (it.c) inst.setColorAt(i, it.c);
      });
      inst.count = list.length;
      inst.castShadow = !!shadow; inst.receiveShadow = true;
      if (mat === treeMat) inst.customDepthMaterial = treeDepthMat;   // leaf shadows sway with the leaves
      inst.computeBoundingSphere();
      group.add(inst);
      return inst;
    }
    const g = makeInst(grassGeo, grassMat, lists.grass, false); if (g) fine.push(g);
    const gh = makeInst(grassGeo, grassMat, lists.grassHi, false); if (gh) fine.push(gh);
    const f = makeInst(flowerGeo, flowerMat, lists.flowers, false); if (f) fine.push(f);
    makeInst(bushGeo, foliageMat, lists.bushes, true);
    makeInst(pebGeo, vcMat, lists.pebbles, false);
    scene.add(group);
    const [kx, kz] = key.split(',').map(Number);
    decorChunks.set(key, { group, fine, minX: kx * CHUNK_SIZE - WORLD_HALF, minZ: kz * CHUNK_SIZE - WORLD_HALF });
    for (const m of fine) decorFine.push(m);
  }
  // Start with spawn neighbourhood visible.
  updateDecorChunks(0, 0, 60);
}

// Pile of items on the ground. Shared look, one small mesh each.
const pileGeo = new THREE.BoxGeometry(0.35, 0.22, 0.35);
const pileMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.45, metalness: 0.6 });
const pileMat2 = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8, metalness: 0.0 });
export function createPileMesh(scene, x, z) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(pileGeo, pileMat); a.position.y = 0.11;
  const b = new THREE.Mesh(pileGeo, pileMat2); b.position.set(0.18, 0.08, 0.12); b.scale.set(0.7, 0.7, 0.7); b.rotation.y = 0.7;
  g.add(a, b);
  g.position.set(x, terrainHeight(x, z), z);
  scene.add(g);
  return g;
}


