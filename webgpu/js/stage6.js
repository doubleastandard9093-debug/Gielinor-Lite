// Stage 6 of the WebGPU release: water ripples, volumetric light, GPU culling and denser props, building detail.
// WebGPU-release only; the WebGL game at the site root never loads this file.
import * as THREE from 'three';
import { BACKEND } from './scene.js';
import { WATER_PLAYER, WATER_RIPPLE, WATER_MESHES } from './gfx.js';
import { VOL } from './post.js';
import { DAY } from '../../js/daycycle.js';
import { Fn, uniform, uniformArray, instancedArray, instanceIndex, float, vec3, vec4, dot, length, max, smoothstep, positionLocal, select, If, lights } from 'three/tsl';
import { markUpgraded } from './nodeMats.js';
import { terrainHeight, TOWNS, PATHS, insideLake, inCave, CHUNK_SIZE, WORLD_HALF } from '../../js/world.js';
import { treeMat } from '../../js/models.js';
import { blockedAt } from '../../js/player.js';

const Q = new URLSearchParams(location.search);
export const S6 = { stats: {} };
let ctx = null, lastP = new THREE.Vector3(), stir = 0;

function updateRipples(dt, p) {
  if (!p) return;
  const moved = lastP.distanceTo(p) / Math.max(dt, 1e-3); lastP.copy(p);
  // stir while walking along or into the water (lakes are shallow discs: near the rim counts)
  let near = false;
  for (const w of WATER_MESHES) { const r = w.geometry.parameters ? w.geometry.parameters.radius : 8; if (Math.hypot(p.x - w.position.x, p.z - w.position.z) < r + 1.2) { near = true; break; } }
  const target = near ? (moved > 0.4 ? 1 : 0.35) : 0;
  stir += (target - stir) * Math.min(1, dt * 2.5);
  WATER_PLAYER.value.set(p.x, p.y, p.z); WATER_RIPPLE.value = stir;
}

const inits = [];
export function addStage6(name, init, update) { inits.push({ name, init, update, ok: false }); }
export function initStage6(c) {
  ctx = c;
  for (const s of inits) { try { s.init(ctx); s.ok = true; } catch (e) { console.warn('[webgpu] stage 6 ' + s.name + ' unavailable', e); } }
  window.gpuStage6 = S6;
}
export function updateStage6(dt, now, p, q) {
  const tn = performance.now(); dt = S6._t ? Math.min(0.1, Math.max(0, (tn - S6._t) / 1000)) : 0; S6._t = tn;
  updateRipples(dt, p);
  for (const s of inits) if (s.ok && s.update) { try { s.update(dt, now, p, q); } catch (e) { s.ok = false; console.warn('[webgpu] stage 6 ' + s.name + ' stopped', e); } }
}
// volumetric light: put the sun and the tiled torch pool on the volume layer, keep the box centred on the camera,
// and scale density with the time of day (stronger at golden hour and at night for torch halos)
addStage6('volumetric', (c) => {
  if (!VOL.on) return;
  c.dirLight.layers.enable(VOL.layer);
  // own light list: the scene's tiled-lighting node can't feed the raymarch (WGSL 'null' factor), and 200 lights per
  // step is far too slow anyway, so the volume sees the sun plus the 8 nearest-spawned torches/fires
  const pts = []; c.scene.traverse(o => { if (o.isPointLight && !o.castShadow && pts.length < 8) { o.layers.enable(VOL.layer); pts.push(o); } });
  VOL.mesh.material.lightsNode = lights([c.dirLight, ...pts]);
  S6.stats.volLights = pts.length + 1;
}, (dt, now, p, q) => {
  if (!VOL.on) return;
  VOL.mesh.visible = q !== 'low';
  VOL.mesh.position.set(ctx.camera.position.x, 14, ctx.camera.position.z);
  const gold = DAY.gold || 0, night = DAY.night || 0;
  VOL.density.value = 0.8 + gold * 0.9 + night * 0.4;
});

// ---------------------------------------------------------------------------------------------------------------
// GPU culling + denser props (WebGPU only). Every chunked decor InstancedMesh (grass, meadow, flowers, bushes, pebbles)
// gets a companion mesh with DENS extra instances scattered around the originals, and every tree group gets a ring of
// non-interactive background trees bucketed into the same 64 m decor chunks (so chunk streaming still hides them).
// All companion instances live in one storage buffer; a compute pass each frame tests each instance's bounding sphere
// against the six frustum planes and a per-kind LOD distance and writes a 0..1 mask, and the vertex stage collapses
// masked instances to their centre (no raster or fragment cost) and shrinks them in over the last few metres so
// nothing pops. three r180 has indirect draw buffers but no instance compaction path for InstancedMesh yet, so this is
// the "GPU-written instance mask" route. ?dense=N sets the multiplier, ?nodense turns it off.
const DENS = Math.max(0, Math.min(3, +(Q.get('dense') ?? 2)));
const KIND_FAR = { grass: 42, flower: 50, bush: 120, pebble: 38, tree: 260 };
let cullCompute = null; const planesU = uniformArray(new Array(6).fill(0).map(() => new THREE.Vector4()), 'vec4'), camU = uniform(new THREE.Vector3());
const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
function rngOf(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function clearSpot(x, z, pad) {
  if (Math.abs(x) > WORLD_HALF - 3 || Math.abs(z) > WORLD_HALF - 3) return false;
  if (insideLake(x, z, pad + 0.5) || (inCave && inCave(x, z)) || blockedAt(x, z)) return false;
  for (const k in TOWNS) { const t = TOWNS[k]; if (Math.hypot(x - t.x, z - t.z) < 22 + pad) return false; }
  for (const s of PATHS) { const [x1, z1, x2, z2] = s, dx = x2 - x1, dz = z2 - z1, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L)); if (Math.hypot(x - x1 - dx * t, z - z1 - dz * t) < 2.2 + pad) return false; }
  return true;
}
const NODE_KEYS = ['colorNode', 'normalNode', 'positionNode', 'roughnessNode', 'metalnessNode', 'emissiveNode', 'aoNode', 'opacityNode', 'alphaTestNode'];
function maskedMaterial(src, mask, offset) {
  const m = src.clone(); markUpgraded(m);
  for (const k of NODE_KEYS) if (src[k]) m[k] = src[k];
  m.vertexColors = src.vertexColors;
  const base = src.positionNode || positionLocal, off = uniform(offset);
  m.positionNode = Fn(() => {
    const e = mask.toReadOnly().element(off.add(instanceIndex)), c = e.xyz;   // mask.xyz = instance centre (mesh space), w = visibility
    return c.add(base.sub(c).mul(e.w));
  })();
  m.needsUpdate = true;
  return m;
}
addStage6('density', (c) => {
  if (BACKEND.name !== 'WebGPU' || Q.has('nodense') || DENS <= 0) return;
  const meshes = [];   // { src, list: [{ m: Matrix4, color }], kind, parent }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const decor = c.scene.children.filter(o => o.isGroup && /^decor:/.test(o.name));
  const groupOf = (x, z) => { const cx = Math.floor((x + WORLD_HALF) / CHUNK_SIZE), cz = Math.floor((z + WORLD_HALF) / CHUNK_SIZE); return c.scene.getObjectByName('decor:' + cx + ',' + cz); };
  for (const g of decor) {
    for (const src of g.children) {
      if (!src.isInstancedMesh || !src.count) continue;
      const geoR = (src.geometry.boundingSphere || (src.geometry.computeBoundingSphere(), src.geometry.boundingSphere)).radius;
      const kind = geoR < 0.25 ? 'pebble' : src.castShadow ? 'bush' : src.material.color && src.material.color.r > 0.6 && !src.instanceColor ? 'flower' : 'grass';
      const rnd = rngOf(src.count * 7919 + g.name.length * 131 + src.id), list = [];
      for (let i = 0; i < src.count; i++) {
        src.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
        for (let k = 0; k < DENS; k++) {
          const a = rnd() * Math.PI * 2, d = 0.5 + rnd() * (kind === 'bush' ? 3.5 : 1.6), x = _p.x + Math.cos(a) * d, z = _p.z + Math.sin(a) * d;
          if (insideLake(x, z, 0.6) || blockedAt(x, z)) continue;
          const sc = _s.x * (0.75 + rnd() * 0.45);
          list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.02, z), _q.clone().setFromEuler(_e.set(0, rnd() * 6.283, 0)), new THREE.Vector3(sc, sc, sc)),
            color: src.instanceColor ? (src.getColorAt(i, _c), _c.clone().offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08)) : null, r: geoR * sc });
        }
      }
      if (list.length) meshes.push({ src, list, kind, parent: g });
    }
  }
  // background trees: one or two extra per tree, 5-11 m away, in clear wilderness only
  const treeBuckets = new Map();
  c.scene.traverse(o => {
    if (!o.isInstancedMesh || o.material !== treeMat || o.parent !== c.scene || !o.count) return;
    const geoR = (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius;
    const rnd = rngOf(o.count * 104729 + o.id);
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (_s.x < 0.05) continue;
      for (let k = 0; k < Math.min(DENS, 2); k++) {
        const a = rnd() * Math.PI * 2, d = 5 + rnd() * 6, x = _p.x + Math.cos(a) * d, z = _p.z + Math.sin(a) * d;
        if (!clearSpot(x, z, 1.5)) continue;
        const g = groupOf(x, z); if (!g) continue;
        const key = g.name + '|' + o.id; if (!treeBuckets.has(key)) treeBuckets.set(key, { src: o, list: [], kind: 'tree', parent: g });
        const sc = _s.x * (0.8 + rnd() * 0.4);
        treeBuckets.get(key).list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.05, z), new THREE.Quaternion().setFromEuler(_e.set(0, rnd() * 6.283, 0)), new THREE.Vector3(sc, sc * (0.85 + rnd() * 0.3), sc)), color: null, r: geoR * sc });
      }
    }
  });
  meshes.push(...treeBuckets.values());
  const total = meshes.reduce((n, e) => n + e.list.length, 0);
  if (!total) return;
  const centres = new Float32Array(total * 4), kindFar = new Float32Array(total);
  const mask = instancedArray(total, 'vec4'), info = instancedArray(centres, 'vec4'), far = instancedArray(kindFar, 'float');
  let off = 0, added = { grass: 0, flower: 0, bush: 0, pebble: 0, tree: 0 };
  for (const e of meshes) {
    const n = e.list.length, inst = new THREE.InstancedMesh(e.src.geometry, maskedMaterial(e.src.material, mask, off), n);
    e.list.forEach((it, i) => {
      inst.setMatrixAt(i, it.m); if (it.color) inst.setColorAt(i, it.color);
      const j = off + i; centres[j * 4] = it.m.elements[12]; centres[j * 4 + 1] = it.m.elements[13]; centres[j * 4 + 2] = it.m.elements[14]; centres[j * 4 + 3] = it.r; kindFar[j] = KIND_FAR[e.kind];
    });
    inst.castShadow = e.kind === 'tree' || (e.kind === 'bush' && DENS < 3); inst.receiveShadow = true;
    if (e.src.customDepthMaterial) inst.customDepthMaterial = undefined;
    inst.computeBoundingSphere(); inst.frustumCulled = true; inst.name = 'dense:' + e.kind;
    e.parent.add(inst); off += n; added[e.kind] += n;
  }
  info.value.needsUpdate = true; far.value.needsUpdate = true;
  // the compute pass: frustum sphere test + distance LOD with a 15% shrink-in band
  cullCompute = Fn(() => {
    const ci = info.element(instanceIndex), p = ci.xyz, r = ci.w, fd = far.element(instanceIndex);
    const vis = float(1).toVar();
    for (let k = 0; k < 6; k++) { const pl = planesU.element(k); If(dot(pl.xyz, p).add(pl.w).lessThan(r.negate()), () => { vis.assign(0); }); }
    const d = length(p.sub(camU));
    vis.mulAssign(float(1).sub(smoothstep(fd.mul(0.85), fd, d)));
    mask.element(instanceIndex).assign(vec4(p, vis));
  })().compute(total);
  S6.stats.dense = added; S6.stats.denseTotal = total; S6.stats.cull = 'compute mask';
}, (dt, now, p, q) => {
  if (!cullCompute) return;
  const cam = ctx.camera; cam.updateMatrixWorld();
  pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  frustum.planes.forEach((pl, i) => planesU.array[i].set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant));
  camU.value.copy(cam.position);
  const t0 = performance.now(); ctx.renderer.compute(cullCompute); S6.stats.cullCpuMs = +(performance.now() - t0).toFixed(2);
});

export { ctx as S6CTX, BACKEND, Q };
