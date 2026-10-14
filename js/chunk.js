// Jagex-style chunk streaming. The world is cut into square chunks; only the
// chunks within LOAD_RADIUS of the player keep their meshes in the scene.
// Gameplay data (monster HP, colliders, NPC refs) lives outside the meshes, so
// unloading a chunk only detaches its meshes. They are re-attached on return.
import * as THREE from 'three';

export const CHUNK = 32;          // world units per chunk
export let LOAD_RADIUS = 2;       // 2 -> 5x5 chunks around the player
const chunks = new Map();         // key -> { objs: Set, loaded }
const dynamic = [];               // moving things (monsters): { obj, getPos, key }
let curKey = null, curCx = 1e9, curCz = 1e9;

const keyOf = (cx, cz) => cx + ',' + cz;
const cOf = v => Math.floor(v / CHUNK);

export function setLoadRadius(r) { if (r !== LOAD_RADIUS) { LOAD_RADIUS = r; curKey = null; } }

function chunkFor(key) {
  let c = chunks.get(key);
  if (!c) { c = { objs: new Set(), loaded: false }; chunks.set(key, c); }
  return c;
}

// factory: () => Object3D, called the first time the chunk loads.
export function registerChunkObject(x, z, factory, parent = null) {
  const ent = { factory, obj: null, parent, dyn: false };
  chunkFor(keyOf(cOf(x), cOf(z))).objs.add(ent);
  return ent;
}

// Register a moving object; its chunk is recomputed on each update.
export function registerDynamic(obj, getPos, parent = null) {
  const ent = { obj, getPos, parent: parent || obj.parent, key: null, attached: !!obj.parent };
  dynamic.push(ent);
  return ent;
}

function attach(ent, scene) {
  if (!ent.obj) { ent.obj = ent.factory(); if (!ent.parent) ent.parent = ent.obj.parent || scene; }
  const p = ent.parent || scene;
  if (ent.obj.parent !== p) p.add(ent.obj);
}
function detach(ent) { if (ent.obj && ent.obj.parent) ent.obj.parent.remove(ent.obj); }

const near = (cx, cz) => Math.abs(cx - curCx) <= LOAD_RADIUS && Math.abs(cz - curCz) <= LOAD_RADIUS;

export function updateChunks(px, pz, scene) {
  const cx = cOf(px), cz = cOf(pz), k = keyOf(cx, cz);
  if (k !== curKey) {
    curKey = k; curCx = cx; curCz = cz;
    for (const [key, c] of chunks) {
      const [x, z] = key.split(',').map(Number), want = near(x, z);
      if (want === c.loaded) continue;
      c.loaded = want;
      for (const e of c.objs) want ? attach(e, scene) : detach(e);
    }
  }
  for (const d of dynamic) {
    const p = d.getPos(), want = near(cOf(p.x), cOf(p.z));
    if (want && !d.obj.parent) (d.parent || scene).add(d.obj);
    else if (!want && d.obj.parent) d.obj.parent.remove(d.obj);
  }
}

export function chunkStats() {
  let loaded = 0, objs = 0;
  for (const c of chunks.values()) { if (c.loaded) { loaded++; objs += c.objs.size; } }
  return { chunks: chunks.size, loaded, objs, dynamic: dynamic.length, dynLoaded: dynamic.filter(d => d.obj.parent).length };
}

// Hand every static, compact scene object to the chunk manager.
// Skips instanced meshes, lights, huge objects (ground, water, sky) and anything in `skip`.
export function adoptSceneObjects(scene, skip = new Set()) {
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0;
  for (const o of [...scene.children]) {
    if (skip.has(o) || o.isLight || o.isCamera || o.isInstancedMesh || o.userData.noChunk) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getCenter(c); box.getSize(s);
    if (Math.max(s.x, s.z) > 40) continue;
    registerChunkObject(c.x, c.z, () => o, scene);
    n++;
  }
  curKey = null;
  return n;
}
