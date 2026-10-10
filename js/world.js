import * as THREE from 'three';
import { makeRng } from './rng.js';
import { MONSTER_TYPES } from './gameplay.js';

export const WORLD_HALF = 40;
export const SPAWN = { x: 0, z: 0 };
export const LAKE = { x: -20, z: 16, r: 7 };

// Shared geometry and materials keep memory and draw setup low on phones.
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone5: new THREE.ConeGeometry(1, 1, 5),
  cone7: new THREE.ConeGeometry(1, 1, 7),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  ring: new THREE.RingGeometry(0.35, 0.55, 16)
};
const matCache = new Map();
function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...(opts || {}) }));
  return matCache.get(key);
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
  const base = new THREE.Color(0x3f7a35);
  const tmp = new THREE.Color();
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = 0.88 + rng() * 0.2;
    tmp.copy(base).multiplyScalar(v);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
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
  path(0, 0, 13, -12); path(0, 0, -15, -13); path(0, 0, -15, 12); path(0, 0, 20, 17); path(0, 0, 0, 24);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), new THREE.MeshLambertMaterial({ color: 0x9a9a8a }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true;
  scene.add(plaza);

  // Lake with a sandy shore.
  const shore = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 1.4, 28), new THREE.MeshLambertMaterial({ color: 0xc9b77a }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(LAKE.x, 0.025, LAKE.z);
  scene.add(shore);
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 28), new THREE.MeshLambertMaterial({ color: 0x2f6fb0 }));
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, 0.04, LAKE.z);
  scene.add(water);

  const occupied = [];
  function free(x, z, r = 1.6) {
    if (Math.hypot(x, z) < 6) return false;
    if (insideLake(x, z, 2.2)) return false;
    if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return false;
    for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < r + o.r) return false;
    return true;
  }
  function place(cx, cz, spread, r, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const x = cx + (rng() - 0.5) * spread * 2;
      const z = cz + (rng() - 0.5) * spread * 2;
      if (free(x, z, r)) { occupied.push({ x, z, r }); return { x, z }; }
    }
    return null;
  }
  // Reserve the areas used by monsters and buildings.
  occupied.push({ x: 13, z: -13, r: 5 }, { x: -18, z: -16, r: 7 }, { x: 0, z: 27, r: 4 }, { x: 8, z: 0, r: 1.5 }, { x: -6, z: -2, r: 2 });

  // ---- Trees ----
  const TREE_STYLE = {
    Tree:   { trunk: 0x5a3a14, leaf: 0x2d6a25, h: 2.2, r: 1.05, seg: G.cone5 },
    Oak:    { trunk: 0x4a3010, leaf: 0x3d7a1f, h: 2.0, r: 1.45, seg: G.sphere },
    Willow: { trunk: 0x5a4a2a, leaf: 0x6f9a3a, h: 2.8, r: 1.3,  seg: G.cone7 }
  };
  function createTree(x, z, kind) {
    const st = TREE_STYLE[kind];
    const root = new THREE.Group();
    const full = new THREE.Group();
    full.add(part(G.box, st.trunk, 0.4, 1.7, 0.4, 0, 0.85, 0));
    const leaves = part(st.seg, st.leaf, st.r, kind === 'Oak' ? 1.2 : st.h, st.r, 0, kind === 'Oak' ? 2.5 : 2.5, 0);
    full.add(leaves);
    if (kind === 'Oak') full.add(part(G.sphere, st.leaf, 0.9, 0.8, 0.9, 0.6, 3.1, 0.2));
    const stump = new THREE.Group();
    stump.add(part(G.cyl, st.trunk, 0.32, 0.35, 0.32, 0, 0.17, 0));
    stump.visible = false;
    root.add(full, stump);
    root.position.set(x, 0, z);
    root.rotation.y = rng() * Math.PI;
    const s = 0.9 + rng() * 0.25;
    root.scale.set(s, s, s);
    scene.add(root);
    pickables.push(root);
    const name = kind === 'Tree' ? 'Tree' : kind;
    return tag(root, { mesh: root, full, depleted: stump, type: 'tree', kind, name, alive: true, x, z, radius: 0.9 });
  }

  // ---- Rocks ----
  const ORE_COLOR = { Copper: 0xc07a3a, Tin: 0xc8c8c8, Iron: 0x7a3a2a, Coal: 0x151515 };
  function createRock(x, z, ore) {
    const root = new THREE.Group();
    const rockMesh = part(G.box, 0x6a6560, 1.0, 0.7, 0.85, 0, 0.35, 0);
    rockMesh.rotation.y = rng();
    const top = part(G.box, 0x7a7570, 0.7, 0.35, 0.6, 0.1, 0.8, 0.05);
    top.rotation.y = rng();
    root.add(rockMesh, top);
    const full = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng();
      full.add(part(G.box, ORE_COLOR[ore], 0.22, 0.2, 0.22, Math.cos(a) * 0.42, 0.45 + rng() * 0.35, Math.sin(a) * 0.36, false));
    }
    const depleted = new THREE.Group();
    depleted.visible = false;
    root.add(full, depleted);
    root.position.set(x, 0, z);
    scene.add(root);
    pickables.push(root);
    return tag(root, { mesh: root, full, depleted, type: 'rock', ore, name: 'Rocks', alive: true, x, z, radius: 0.8 });
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
    scene.add(g);
    pickables.push(g);
    return tag(g, { mesh: g, type: 'shop', alive: true, x, z, name: 'Merchant', radius: 1.2 });
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
    } else {
      const c = t.color;
      const skin = typeName === 'Goblin' ? 0x6aa040 : 0xd4a574;
      body.add(part(G.box, c, 0.7, 0.8, 0.42, 0, 1.0, 0));
      body.add(part(G.box, skin, 0.48, 0.45, 0.45, 0, 1.65, 0));
      if (typeName === 'Goblin') {
        body.add(part(G.box, skin, 0.12, 0.25, 0.08, 0.3, 1.75, 0, false));
        body.add(part(G.box, skin, 0.12, 0.25, 0.08, -0.3, 1.75, 0, false));
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
      x, z, spawnX: x, spawnZ: z, roam, bounds, radius: 0.7,
      state: 'idle', target: null, wanderAt: 0, nextAttackTick: 0, deathT: 0, respawnAt: 0, lastHitAt: -1e9
    });
  }

  // ---- Populate ----
  for (let i = 0; i < 26; i++) { const p = place(0, 0, 36, 1.6); if (p) nodes.push(createTree(p.x, p.z, 'Tree')); }
  for (let i = 0; i < 7; i++) { const p = place(26, -24, 8, 2); if (p) nodes.push(createTree(p.x, p.z, 'Oak')); }
  for (let i = 0; i < 5; i++) {
    const a = 0.6 + i * 0.75;
    const x = LAKE.x + Math.cos(a) * (LAKE.r + 3), z = LAKE.z + Math.sin(a) * (LAKE.r + 3);
    occupied.push({ x, z, r: 1.4 });
    nodes.push(createTree(x, z, 'Willow'));
  }
  const mine = [['Copper', 4], ['Tin', 4], ['Iron', 3], ['Coal', 2]];
  for (const [ore, n] of mine) for (let i = 0; i < n; i++) { const p = place(22, 20, 5, 1.0); if (p) nodes.push(createRock(p.x, p.z, ore)); }
  const spots = [['Net', 3.6], ['Net', 4.3], ['Net', 5.0], ['Lure', -0.6], ['Lure', 0.2]];
  for (const [kind, a] of spots) {
    nodes.push(createFish(LAKE.x + Math.cos(a) * (LAKE.r - 0.6), LAKE.z + Math.sin(a) * (LAKE.r - 0.6), kind));
  }
  nodes.push(createMerchant(8, 0));
  nodes.push(createBank(-6, -2));
  createTower(0, 29);
  fence(-18, -16, 12, 10);

  for (let i = 0; i < 4; i++) monsters.push(createMonster('Goblin', 13 + (rng() - 0.5) * 8, -13 + (rng() - 0.5) * 8, 4));
  const field = { minX: -23, maxX: -13, minZ: -20, maxZ: -12 }; // inside the fence
  for (let i = 0; i < 4; i++) monsters.push(createMonster('Cow', -18 + (rng() - 0.5) * 8, -16 + (rng() - 0.5) * 6, 3.5, field));
  monsters.push(createMonster('Guard', -2, 25, 2.5));
  monsters.push(createMonster('Guard', 2.5, 25, 2.5));

  return { ground, nodes, monsters, pickables };
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
