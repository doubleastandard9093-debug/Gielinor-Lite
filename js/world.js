import * as THREE from 'three';
import { makeRng } from './rng.js';
import { MONSTER_TYPES } from './gameplay.js';

export const WORLD_HALF = 70;
export const SPAWN = { x: 0, z: 0 };
export const LAKE = { x: -20, z: 16, r: 7 };
export const TOWN_NAME = 'Brightwater';
export const PATHS = [[0, 0, 13, -12], [0, 0, -15, -13], [0, 0, -15, 12], [0, 0, 20, 17], [0, 0, 0, 24], [0, 0, 0, -27], [0, 0, 5, -7.4], [0, 0, 50, -20], [50, -20, 55, -35]];
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
  [-13, -5, 3, 3, 0xc0b090, 0x7a3a2a, 'House', 'A cosy cottage.'],
  // Ashford town (east)
  [48, -25, 5, 6, 0x8a7a6a, 0x5a3a2a, 'Ashford Bank', 'A smaller bank serving the eastern farms.'],
  [55, -18, 4, 5, 0xb8a878, 0x4a5a3a, 'Ashford Store', 'Local goods and supplies.'],
  [42, -32, 4, 4, 0x6a5a4a, 0x3a3a3a, 'Ashford Smithy', 'Hammering rings from the forge.'],
  [52, -35, 3, 3, 0xd0c0a0, 0x7a3a2a, 'Ashford House', 'A farmhouse.'],
  [60, -22, 3, 3, 0xc0b090, 0x5a4a3a, 'Ashford House', 'Another cottage.']
];
// Solid areas the player can't walk through (filled in by createWorld).
export const colliders = [];

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
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...(opts || {}) }));
  return matCache.get(key);
}

// Bake all the plain-coloured parts of a static model into one mesh (one draw call)
// using vertex colours. Glowing (unlit) parts stay separate.
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function mergeStatic(group) {
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
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
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
  const mesh = new THREE.Mesh(geo, vcMat);
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

export function insideLake(x, z, pad = 0) {
  return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + pad;
}

export function createWorld(scene) {
  const rng = makeRng(2004);
  const nodes = [];
  const monsters = [];
  const pickables = []; // root objects the tap raycast checks

  // Ground with gentle colour variation (one draw call).
  const groundGeo = new THREE.PlaneGeometry(WORLD_HALF * 2 + 10, WORLD_HALF * 2 + 10, 45, 45);
  const colors = [];
  const base = new THREE.Color(0x4a8a3a);
  const tmp = new THREE.Color();
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = 0.88 + rng() * 0.2;
    tmp.copy(base).multiplyScalar(v);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dirt paths from spawn to each area.
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x8a7650 });
  function path(x1, z1, x2, z2, w = 1.6) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(x2 - x1, z2 - z1);
    m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    m.receiveShadow = true;
    scene.add(m);
  }
  for (const pth of PATHS) path(...pth);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), new THREE.MeshLambertMaterial({ color: 0x9a9a8a }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true;
  scene.add(plaza);

  // Lake with a sandy shore.
  const shore = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 1.6, 36), new THREE.MeshStandardMaterial({ color: 0xc4b080, roughness: 0.9 }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(LAKE.x, 0.025, LAKE.z);
  scene.add(shore);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a6aa0,
    roughness: 0.15,
    metalness: 0.35,
    transparent: true,
    opacity: 0.85
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 48), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, 0.05, LAKE.z);
  water.receiveShadow = true;
  scene.add(water);
  // Store for simple animation
  water.userData.wave = true;

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

  // ---- Trees ----
  const TREE_STYLE = {
    Tree:   { trunk: 0x5a3a14, leaf: 0x2d6a25, h: 2.2, r: 1.05, seg: G.cone5 },
    Oak:    { trunk: 0x4a3010, leaf: 0x3d7a1f, h: 2.0, r: 1.45, seg: G.sphere },
    Willow: { trunk: 0x5a4a2a, leaf: 0x6f9a3a, h: 2.8, r: 1.3,  seg: G.cone7 },
    Maple:  { trunk: 0x5a3a1a, leaf: 0xc0602a, h: 2.0, r: 1.4,  seg: G.sphere },
    Yew:    { trunk: 0x3a2a14, leaf: 0x1f4a2a, h: 3.2, r: 1.5,  seg: G.cone7 },
    Magic:  { trunk: 0x6a6a7a, leaf: 0x5a8ae0, h: 3.0, r: 1.2,  seg: G.cone5 }
  };
  function createTree(x, z, kind) {
    const st = TREE_STYLE[kind];
    const root = new THREE.Group();
    const full = new THREE.Group();
    // Thicker, tapered trunk
    const trunk = part(G.cyl, st.trunk, 0.35, 1.9, 0.35, 0, 0.95, 0);
    full.add(trunk);
    // Main canopy
    const round = st.seg === G.sphere;
    const leaves = part(st.seg, st.leaf, st.r, round ? 1.4 : st.h * 1.1, st.r, 0, 2.6, 0);
    full.add(leaves);
    // Extra foliage clusters for more organic shape
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng() * 0.5;
      const dist = 0.4 + rng() * 0.4;
      const y = 2.2 + rng() * 0.8;
      full.add(part(G.sphere, st.leaf, 0.6 + rng() * 0.3, 0.5 + rng() * 0.3, 0.6 + rng() * 0.3,
        Math.cos(a) * dist, y, Math.sin(a) * dist));
    }
    root.add(full);
    root.position.set(x, 0, z);
    root.rotation.y = rng() * Math.PI;
    const s = 0.85 + rng() * 0.3;
    root.scale.set(s, s, s);
    mergeStatic(root);
    scene.add(root);
    pickables.push(root);
    const name = kind === 'Tree' ? 'Tree' : kind;
    return tag(root, { mesh: root, full: root, type: 'tree', kind, name, alive: true, x, z, radius: 0.9 });
  }

  // ---- Rocks ----
  const ORE_COLOR = { Copper: 0xc07a3a, Tin: 0xc8c8c8, Iron: 0x7a3a2a, Coal: 0x151515, Mithril: 0x5a6ad0, Adamantite: 0x3a9a5a, Runite: 0x3ab8d0 };
  function createRock(x, z, ore) {
    const root = new THREE.Group();
    // Base rock using sphere for more organic shape
    const rockMesh = part(G.sphere, 0x6a6560, 0.85, 0.55, 0.75, 0, 0.3, 0);
    rockMesh.rotation.y = rng();
    rockMesh.rotation.x = (rng() - 0.5) * 0.3;
    root.add(rockMesh);
    // Secondary lumps
    const lump = part(G.sphere, 0x7a7570, 0.5, 0.35, 0.45, 0.25, 0.45, 0.15);
    lump.rotation.y = rng();
    root.add(lump);
    const full = new THREE.Group();
    // Ore crystals
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng();
      const dist = 0.3 + rng() * 0.25;
      full.add(part(G.box, ORE_COLOR[ore] || 0x888888, 0.18, 0.22, 0.18,
        Math.cos(a) * dist, 0.35 + rng() * 0.4, Math.sin(a) * dist, false));
    }
    root.add(full);
    root.position.set(x, 0, z);
    mergeStatic(root);
    scene.add(root);
    pickables.push(root);
    return tag(root, { mesh: root, full: root, type: 'rock', ore, name: 'Rocks', alive: true, x, z, radius: 0.8 });
  }

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
  function createMerchant(x, z) {
    const g = new THREE.Group();
    g.add(part(G.box, 0x5a3a1a, 0.7, 1.0, 0.4, 0, 0.9, 0));
    g.add(part(G.box, 0xd4a574, 0.5, 0.45, 0.5, 0, 1.65, 0));
    g.add(part(G.box, 0x2a1a0a, 0.6, 0.2, 0.6, 0, 1.95, 0));
    g.add(part(G.box, 0x3a2a1a, 0.6, 0.5, 0.35, 0, 0.25, 0));
    // Market stall
    g.add(part(G.box, 0x7a5a2a, 2.2, 0.8, 0.8, 0, 0.4, 1.0));
    g.add(part(G.box, 0xb03030, 2.6, 0.1, 1.4, 0, 2.4, 0.8));
    g.add(part(G.box, 0x5a3a1a, 0.1, 2.4, 0.1, -1.2, 1.2, 1.4));
    g.add(part(G.box, 0x5a3a1a, 0.1, 2.4, 0.1, 1.2, 1.2, 1.4));
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'shop', npc: 'merchant', alive: true, x, z, name: 'Merchant', radius: 1.2 });
  }
  function createBank(x, z) {
    const g = new THREE.Group();
    g.add(part(G.box, 0x9a9488, 3.0, 2.6, 0.25, 0, 1.3, -0.9));        // back wall
    g.add(part(G.box, 0x2a3a7a, 0.6, 0.7, 0.35, 0, 1.35, -0.45));       // banker
    g.add(part(G.box, 0xd4a574, 0.4, 0.4, 0.4, 0, 1.92, -0.45));
    g.add(part(G.box, 0x8a8a90, 2.6, 1.0, 0.9, 0, 0.5, 0.1));           // counter
    g.add(part(G.box, 0x6a4a2a, 2.8, 0.1, 1.1, 0, 1.05, 0.1));
    g.add(part(G.box, 0xd4af37, 0.9, 0.45, 0.05, 0, 2.2, -0.76, false)); // gold sign
    g.add(part(G.box, 0x8a2a2a, 3.2, 0.15, 1.7, 0, 2.75, -0.2));        // awning
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 2;
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'bank', alive: true, x, z, name: 'Bank booth', radius: 1.3 });
  }
  function createTower(x, z) {
    const g = new THREE.Group();
    g.add(part(G.cyl, 0x8a8478, 2.2, 5, 2.2, 0, 2.5, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(part(G.box, 0x8a8478, 0.6, 0.6, 0.6, Math.cos(a) * 2, 5.3, Math.sin(a) * 2));
    }
    g.add(part(G.box, 0x3a2a1a, 1.0, 1.8, 0.1, 0, 0.9, 2.2, false));
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
  }

  // Fence around the cow field (instanced posts: one draw call).
  function fence(cx, cz, w, d) {
    const posts = [];
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 1.5) { posts.push([cx + x, cz - d / 2], [cx + x, cz + d / 2]); }
    for (let z = -d / 2 + 1.5; z < d / 2; z += 1.5) {
      posts.push([cx - w / 2, cz + z]);
      if (Math.abs(z) > 1.6) posts.push([cx + w / 2, cz + z]); // gate on the east side
    }
    const inst = new THREE.InstancedMesh(G.box, mat(0x6a4a2a), posts.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(0.15, 1.0, 0.15);
    const p = new THREE.Vector3();
    posts.forEach(([x, z], i) => { p.set(x, 0.5, z); m4.compose(p, q, sc); inst.setMatrixAt(i, m4); });
    inst.castShadow = true;
    scene.add(inst);
    const railMat = mat(0x7a5a3a);
    const rail = (x, z, sx, sz) => { const r = new THREE.Mesh(G.box, railMat); r.scale.set(sx, 0.1, sz); r.position.set(x, 0.75, z); scene.add(r); };
    rail(cx, cz - d / 2, w, 0.08); rail(cx, cz + d / 2, w, 0.08); rail(cx - w / 2, cz, 0.08, d);
    rail(cx + w / 2, cz - d / 4 - 0.8, 0.08, d / 2 - 1.6); rail(cx + w / 2, cz + d / 4 + 0.8, 0.08, d / 2 - 1.6);
  }


  // ---- Town of Brightwater ----
  function createBuilding([x, z, w, d, wall, roof, name, examine]) {
    const g = new THREE.Group();
    const h = 2.6;
    g.add(part(G.box, wall, w, h, d, 0, h / 2, 0));
    const r = new THREE.Mesh(G.cone4, mat(roof));
    r.scale.set(w * 0.78, 1.6, d * 0.78);
    r.rotation.y = Math.PI / 4;
    r.position.y = h + 0.8;
    r.castShadow = true;
    g.add(r);
    // door and windows on the side facing the town square
    const toCentre = Math.abs(x) > Math.abs(z) ? [Math.sign(-x), 0] : [0, Math.sign(-z)];
    const fx = toCentre[0] * (w / 2 + 0.01), fz = toCentre[1] * (d / 2 + 0.01);
    const door = part(G.box, 0x3a2414, toCentre[0] ? 0.05 : 0.8, 1.5, toCentre[0] ? 0.8 : 0.05, fx, 0.75, fz, false);
    g.add(door);
    if (name === 'Church of Saradomin') g.add(part(G.cone4, 0x4a4a5a, 0.7, 2.6, 0.7, 0, h + 2.4, d / 2 - 0.8));
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    occupied.push({ x, z, r: Math.max(w, d) * 0.75 + 1 });
    return tag(g, { mesh: g, type: 'building', name, examine, alive: true, x, z, radius: Math.max(w, d) / 2 });
  }

  // Generic humanoid NPC. look: { body, legs, hat, skin, beard, apron }
  function createNpc(x, z, npc, name, look, faceX = 0, faceZ = 0) {
    const g = new THREE.Group();
    const skin = look.skin || 0xd4a574;
    // Torso with slight taper
    g.add(part(G.box, look.body, 0.68, 0.85, 0.38, 0, 1.05, 0));
    // Shoulders
    g.add(part(G.box, look.body, 0.82, 0.22, 0.42, 0, 1.38, 0));
    // Head (sphere for rounder look)
    g.add(part(G.sphere, skin, 0.42, 0.46, 0.42, 0, 1.78, 0));
    // Legs
    g.add(part(G.box, look.legs || 0x3a2a1a, 0.28, 0.62, 0.28, -0.18, 0.31, 0));
    g.add(part(G.box, look.legs || 0x3a2a1a, 0.28, 0.62, 0.28, 0.18, 0.31, 0));
    // Arms
    g.add(part(G.cyl, skin, 0.12, 0.58, 0.12, -0.42, 1.05, 0));
    g.add(part(G.cyl, skin, 0.12, 0.58, 0.12, 0.42, 1.05, 0));
    // Hands
    g.add(part(G.sphere, skin, 0.1, 0.1, 0.1, -0.42, 0.72, 0));
    g.add(part(G.sphere, skin, 0.1, 0.1, 0.1, 0.42, 0.72, 0));
    if (look.hat) g.add(part(G.box, look.hat, look.hatW || 0.5, look.hatH || 0.16, look.hatW || 0.5, 0, 2.05, 0));
    if (look.beard) g.add(part(G.box, look.beard, 0.36, 0.22, 0.08, 0, 1.55, 0.22, false));
    if (look.apron) g.add(part(G.box, look.apron, 0.55, 0.7, 0.04, 0, 0.95, 0.2, false));
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(faceX - x, faceZ - z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'npc', npc, name, alive: true, x, z, radius: 0.6 });
  }

  function createStation(x, z, kind) {
    const g = new THREE.Group();
    let name;
    if (kind === 'furnace') {
      name = 'Furnace';
      g.add(part(G.box, 0x5a5048, 1.4, 1.6, 1.2, 0, 0.8, 0));
      g.add(part(G.box, 0x4a4038, 0.6, 1.2, 0.6, 0, 2.0, -0.2));
      const glow = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
      glow.scale.set(0.6, 0.4, 0.05); glow.position.set(0, 0.6, 0.61);
      g.add(glow);
    } else if (kind === 'anvil') {
      name = 'Anvil';
      g.add(part(G.box, 0x5a3a1a, 0.5, 0.5, 0.5, 0, 0.25, 0));
      g.add(part(G.box, 0x2a2a30, 0.9, 0.25, 0.4, 0, 0.62, 0));
      g.add(part(G.box, 0x2a2a30, 0.3, 0.12, 0.25, 0.55, 0.68, 0));
    } else {
      name = 'Range';
      g.add(part(G.box, 0x4a4a50, 1.4, 0.9, 0.9, 0, 0.45, 0));
      g.add(part(G.box, 0x2a2a2a, 1.3, 0.06, 0.8, 0, 0.93, 0));
      g.add(part(G.box, 0x4a4a50, 0.3, 1.4, 0.3, -0.5, 1.6, -0.3));
      const glow = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xff5a1a }));
      glow.scale.set(0.8, 0.25, 0.05); glow.position.set(0, 0.35, 0.46);
      g.add(glow);
    }
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'station', kind, name, alive: true, x, z, radius: 0.8 });
  }

  function createAltar(x, z) {
    const g = new THREE.Group();
    g.add(part(G.box, 0xe8e0d0, 1.6, 0.9, 0.8, 0, 0.45, 0));
    g.add(part(G.box, 0x6a2a8a, 1.7, 0.08, 0.9, 0, 0.92, 0));
    g.add(part(G.box, 0xd4af37, 0.1, 0.5, 0.1, 0, 1.2, 0, false));
    g.add(part(G.box, 0xd4af37, 0.34, 0.1, 0.1, 0, 1.3, 0, false));
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'altar', name: 'Altar', alive: true, x, z, radius: 0.9 });
  }

  function createWell(x, z) {
    const g = new THREE.Group();
    g.add(part(G.cyl, 0x8a8478, 0.8, 0.7, 0.8, 0, 0.35, 0));
    g.add(part(G.cyl, 0x2a4a7a, 0.62, 0.05, 0.62, 0, 0.66, 0, false));
    g.add(part(G.box, 0x5a3a1a, 0.1, 1.6, 0.1, -0.7, 0.8, 0));
    g.add(part(G.box, 0x5a3a1a, 0.1, 1.6, 0.1, 0.7, 0.8, 0));
    g.add(part(G.cone4, 0x7a3a2a, 1.1, 0.6, 0.8, 0, 1.85, 0));
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
    return tag(g, { mesh: g, type: 'well', name: 'Well', examine: 'The town well. Use it to fill empty vials with water.', alive: true, x, z, radius: 0.8 });
  }

  // Herb patch (Herblore): a raised dirt bed with leafy herbs. Never runs out. One draw call.
  const HERB_TINT = [0x4a8a2a, 0x5a9a3a, 0x3a7a3a, 0x6a8a2a, 0x2a6a2a, 0x7a9a3a, 0x4a7a4a, 0x3a8a5a, 0x5a7a2a, 0x8aaa3a, 0x2a5a2a, 0x6a6a2a, 0x3a5a4a];
  function createHerbPatch(x, z, herb, tintIdx = 0) {
    const g = new THREE.Group();
    g.add(part(G.box, 0x5a3a20, 1.5, 0.22, 1.1, 0, 0.11, 0, false));
    g.add(part(G.box, 0x7a5a3a, 1.6, 0.1, 0.12, 0, 0.18, 0.55, false));
    g.add(part(G.box, 0x7a5a3a, 1.6, 0.1, 0.12, 0, 0.18, -0.55, false));
    const c = HERB_TINT[tintIdx % HERB_TINT.length];
    for (const [hx, hz] of [[-0.45, -0.2], [0, 0.2], [0.45, -0.2], [-0.2, 0.25], [0.25, -0.25]]) {
      g.add(part(G.cone4, c, 0.32, 0.45, 0.32, hx, 0.42, hz, false));
    }
    g.position.set(x, 0, z);
    mergeStatic(g);
    scene.add(g);
    pickables.push(g);
    occupied.push({ x, z, r: 1.0 });
    return tag(g, { mesh: g, type: 'herb', herb, name: `${herb} patch`, alive: true, x, z, radius: 0.8 });
  }

  // Straight fence (instanced posts: one draw call per fence line).
  function fenceLine(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(2, Math.round(len / 1.5) + 1);
    const inst = new THREE.InstancedMesh(G.box, mat(0x6a4a2a), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(0.15, 1.0, 0.15), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const t = i / (n - 1); p.set(x1 + (x2 - x1) * t, 0.5, z1 + (z2 - z1) * t); m4.compose(p, q, sc); inst.setMatrixAt(i, m4); }
    inst.castShadow = true;
    scene.add(inst);
    const rail = new THREE.Mesh(G.box, mat(0x7a5a3a));
    rail.scale.set(0.08, 0.1, len);
    rail.position.set((x1 + x2) / 2, 0.75, (z1 + z2) / 2);
    rail.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(rail);
  }

  // ---- Monsters ----
  function createMonster(typeName, x, z, roam, bounds = null) {
    const t = MONSTER_TYPES[typeName];
    const root = new THREE.Group();
    const body = new THREE.Group();
    const legs = [];
    if (typeName === 'Cow') {
      body.add(part(G.box, 0xf0eee8, 1.5, 0.75, 0.75, 0, 0.95, 0));
      body.add(part(G.box, 0x2a2a2a, 0.5, 0.5, 0.78, 0.2, 1.0, 0, false));
      body.add(part(G.box, 0xf0eee8, 0.5, 0.5, 0.45, 0.95, 1.2, 0));
      body.add(part(G.box, 0xe8b0a0, 0.25, 0.25, 0.4, 1.25, 1.05, 0, false));
      body.add(part(G.box, 0xd8d0b0, 0.08, 0.2, 0.08, 0.9, 1.5, 0.18, false));
      body.add(part(G.box, 0xd8d0b0, 0.08, 0.2, 0.08, 0.9, 1.5, -0.18, false));
      for (const [lx, lz] of [[0.55, 0.25], [0.55, -0.25], [-0.55, 0.25], [-0.55, -0.25]]) {
        const l = part(G.box, 0xf0eee8, 0.18, 0.6, 0.18, lx, 0.3, lz);
        body.add(l); legs.push(l);
      }
      body.rotation.y = -Math.PI / 2; // face +z
    } else if (t.shape === 'quad') { // wolf
      const c = t.color;
      body.add(part(G.sphere, c, 0.48, 0.42, 1.1, 0, 0.72, 0));
      body.add(part(G.sphere, c, 0.38, 0.36, 0.45, 0, 0.88, 0.7));
      body.add(part(G.box, 0x4a4a50, 0.2, 0.18, 0.28, 0, 0.78, 1.05, false));
      body.add(part(G.cone4, c, 0.1, 0.18, 0.08, 0.12, 1.15, 0.65, false));
      body.add(part(G.cone4, c, 0.1, 0.18, 0.08, -0.12, 1.15, 0.65, false));
      body.add(part(G.cyl, c, 0.08, 0.08, 0.45, 0, 0.85, -0.7, false));
      for (const [lx, lz] of [[0.18, 0.45], [-0.18, 0.45], [0.18, -0.45], [-0.18, -0.45]]) {
        const l = part(G.box, c, 0.14, 0.5, 0.14, lx, 0.25, lz); body.add(l); legs.push(l);
      }
    } else if (t.shape === 'spider') {
      const c = t.color;
      body.add(part(G.box, c, 0.8, 0.5, 0.9, 0, 0.6, -0.2));
      body.add(part(G.box, c, 0.5, 0.4, 0.45, 0, 0.55, 0.45));
      body.add(part(G.box, 0xc02020, 0.3, 0.08, 0.05, 0, 0.62, 0.68, false));
      for (const side of [-1, 1]) for (const lz of [-0.4, -0.1, 0.2, 0.45]) {
        const l = part(G.box, 0x1a1a1a, 0.7, 0.08, 0.08, side * 0.6, 0.45, lz); l.rotation.z = side * 0.5; body.add(l); legs.push(l);
      }
    } else if (t.shape === 'dragon') {
      const c = t.color;
      body.add(part(G.box, c, 0.9, 0.8, 1.8, 0, 1.0, 0));
      body.add(part(G.box, c, 0.4, 0.4, 0.8, 0, 1.5, 1.1));
      body.add(part(G.box, c, 0.5, 0.45, 0.7, 0, 1.75, 1.6));
      body.add(part(G.box, 0xd0c080, 0.1, 0.3, 0.1, 0.16, 2.1, 1.45, false));
      body.add(part(G.box, 0xd0c080, 0.1, 0.3, 0.1, -0.16, 2.1, 1.45, false));
      body.add(part(G.box, c, 0.25, 0.25, 1.2, 0, 0.9, -1.4));
      for (const side of [-1, 1]) { const w = part(G.box, 0x1a4a1a, 1.4, 0.06, 1.0, side * 1.1, 1.6, -0.1, false); w.rotation.z = side * 0.35; body.add(w); }
      for (const [lx, lz] of [[0.35, 0.6], [-0.35, 0.6], [0.35, -0.6], [-0.35, -0.6]]) {
        const l = part(G.box, c, 0.25, 0.7, 0.25, lx, 0.35, lz); body.add(l); legs.push(l);
      }
    } else {
      const c = t.color;
      const skin = t.skin || (typeName === 'Goblin' ? 0x6aa040 : typeName === 'Hill Giant' ? 0xb08a5a : typeName === 'Black Knight' ? 0x1a1a22 : 0xd4a574);
      // More detailed humanoid
      body.add(part(G.box, c, 0.65, 0.75, 0.36, 0, 1.05, 0));
      body.add(part(G.box, c, 0.78, 0.2, 0.4, 0, 1.35, 0)); // shoulders
      body.add(part(G.sphere, skin, 0.4, 0.44, 0.4, 0, 1.72, 0)); // round head
      // Arms
      body.add(part(G.cyl, skin, 0.11, 0.55, 0.11, -0.4, 1.05, 0));
      body.add(part(G.cyl, skin, 0.11, 0.55, 0.11, 0.4, 1.05, 0));
      // Legs
      body.add(part(G.box, c, 0.26, 0.58, 0.26, -0.16, 0.32, 0));
      body.add(part(G.box, c, 0.26, 0.58, 0.26, 0.16, 0.32, 0));
      if (typeName === 'Goblin') {
        body.add(part(G.box, skin, 0.12, 0.25, 0.08, 0.3, 1.75, 0, false));
        body.add(part(G.box, skin, 0.12, 0.25, 0.08, -0.3, 1.75, 0, false));
      } else if (typeName === 'Hill Giant') {
        body.add(part(G.box, 0x5a3a1a, 0.18, 1.1, 0.18, 0.55, 0.9, 0.3)); // club
        body.add(part(G.box, 0x5a3a1a, 0.32, 0.4, 0.32, 0.55, 0.4, 0.3));
      } else if (typeName === 'Dark Archer') {
        body.add(part(G.box, 0x1e2a1e, 0.56, 0.3, 0.56, 0, 1.86, -0.03)); // hood
        body.add(part(G.box, 0x5a3a1a, 0.06, 1.2, 0.06, 0.5, 1.1, 0.3)); // bow
        body.add(part(G.box, 0x3a2a1a, 0.2, 0.6, 0.15, 0, 1.1, -0.3, false)); // quiver
      } else if (typeName === 'Black Knight') {
        body.add(part(G.box, 0x2a2a34, 0.56, 0.5, 0.56, 0, 1.68, 0));
        body.add(part(G.box, 0x111111, 0.4, 0.06, 0.02, 0, 1.7, 0.29, false));
        body.add(part(G.box, 0x777780, 0.08, 1.0, 0.14, 0.5, 0.9, 0.35)); // sword
      } else if (['Moss Giant', 'Ogre', 'Ice Giant', 'Grumsh'].includes(typeName)) {
        body.add(part(G.box, 0x4a3a2a, 0.2, 1.1, 0.2, 0.55, 0.9, 0.3)); // club
        body.add(part(G.box, 0x4a3a2a, 0.34, 0.42, 0.34, 0.55, 0.4, 0.3));
        if (typeName === 'Grumsh') body.add(part(G.box, 0xd4af37, 0.52, 0.16, 0.52, 0, 1.95, 0, false)); // crown
        if (typeName === 'Moss Giant') body.add(part(G.box, 0x2a5a1a, 0.5, 0.15, 0.5, 0, 1.92, 0, false));
      } else if (typeName === 'Lesser Demon') {
        body.add(part(G.cone4, 0x2a1a1a, 0.1, 0.35, 0.1, 0.18, 2.0, 0, false));
        body.add(part(G.cone4, 0x2a1a1a, 0.1, 0.35, 0.1, -0.18, 2.0, 0, false));
        for (const side of [-1, 1]) { const w = part(G.box, 0x5a0a0a, 0.9, 0.6, 0.05, side * 0.6, 1.3, -0.3, false); w.rotation.y = side * 0.4; body.add(w); }
      } else if (typeName === 'Bandit') {
        body.add(part(G.box, 0x2a2a2a, 0.5, 0.12, 0.05, 0, 1.6, 0.24, false)); // mask
        body.add(part(G.box, 0xa0a0a8, 0.07, 0.7, 0.1, 0.5, 0.95, 0.3)); // blade
      } else if (typeName === 'Skeleton' || typeName === 'Zombie') {
        body.add(part(G.box, 0x111111, 0.3, 0.08, 0.02, 0, 1.7, 0.24, false)); // eyes
        if (typeName === 'Skeleton') body.add(part(G.box, 0x8a8a8a, 0.07, 0.8, 0.1, 0.5, 0.95, 0.3));
      } else {
        body.add(part(G.box, 0x9a9aa8, 0.54, 0.25, 0.54, 0, 1.92, 0));
        body.add(part(G.box, 0x6a5a3a, 0.06, 2.2, 0.06, 0.5, 1.2, 0.15)); // spear
        body.add(part(G.box, 0xb0b0b8, 0.12, 0.3, 0.06, 0.5, 2.4, 0.15, false));
      }
      body.add(part(G.box, skin, 0.18, 0.7, 0.18, -0.45, 1.0, 0));
      body.add(part(G.box, skin, 0.18, 0.7, 0.18, 0.45, 1.0, 0));
      for (const lx of [-0.17, 0.17]) {
        const l = part(G.box, 0x3a2a1a, 0.24, 0.6, 0.24, lx, 0.3, 0);
        body.add(l); legs.push(l);
      }
    }
    root.add(body);
    root.scale.setScalar(t.scale);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    return tag(root, {
      ...t, mesh: root, body, legs, maxHp: t.hp, hp: t.hp, alive: true,
      x, z, spawnX: x, spawnZ: z, roam, bounds, radius: 0.7 * Math.max(1, t.scale * 0.8),
      state: 'idle', target: null, wanderAt: 0, nextAttackTick: 0, deathT: 0, respawnAt: 0, lastHitAt: -1e9
    });
  }

  // ---- Populate ----
  // Town first so trees keep clear of it
  const buildings = BUILDINGS.map(createBuilding);
  buildings.push(createWell(3, 3.2));
  nodes.push(createMerchant(8, 0));
  nodes.push(createBank(-6, -2));
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
  for (const [ore, n] of [['Runite', 1], ['Adamantite', 1], ['Mithril', 1], ['Coal', 2]]) for (let i = 0; i < n; i++) { const p = place(-9, -28, 3, 1.0); if (p) nodes.push(createRock(p.x, p.z, ore)); }
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

  return { ground, nodes, monsters, pickables, buildings };
}

// Pile of items on the ground. Shared look, one small mesh each.
const pileGeo = new THREE.BoxGeometry(0.35, 0.22, 0.35);
const pileMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
const pileMat2 = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
export function createPileMesh(scene, x, z) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(pileGeo, pileMat); a.position.y = 0.11;
  const b = new THREE.Mesh(pileGeo, pileMat2); b.position.set(0.18, 0.08, 0.12); b.scale.set(0.7, 0.7, 0.7); b.rotation.y = 0.7;
  g.add(a, b);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}


