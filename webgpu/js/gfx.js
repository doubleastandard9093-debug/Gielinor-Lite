// Graphics helpers for the modern look: sky dome, procedural textures,
// textured terrain, animated water, swaying foliage, graphics quality.
// Everything is generated in code (no image files), and kept cheap for phones.
import * as THREE from 'three';
import { IS_TOUCH } from './scene.js';
import { Fn, uniform, texture, float, vec2, vec3, vec4, mix, smoothstep, pow, max, min, clamp, abs, sin, cos, fract, floor, exp, dot, normalize, length,
  reflect, positionLocal, positionWorld, positionView, normalView, normalWorld, cameraPosition, screenCoordinate, Loop, If, Break, select, attribute, cross, sign } from 'three/tsl';
import { reflector } from 'three/tsl';

export const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.42).normalize();
export const SKY = {
  top: new THREE.Color(0x3f7fd0),
  horizon: new THREE.Color(0xbfdcf0),
  sun: new THREE.Color(0xfff0c8)
};
// Shared, ticking time uniform used by water, foliage sway and clouds.
export const TIME = uniform(0);
export const SWAY = uniform(1);
const GOLD = uniform(0);

// ---------------------------------------------------------------------------
// Graphics quality: 'high' or 'low'. Auto (null) = High on desktop, High on
// phones too but at a lower pixel ratio; it drops to Low by itself if the
// phone can't keep a smooth frame rate.
// ---------------------------------------------------------------------------
export function resolveQuality(setting) {
  if (setting === 'high' || setting === 'low') return setting;
  return 'high';
}
export function pixelRatioFor(quality) {
  const dpr = window.devicePixelRatio || 1;
  if (quality === 'low') return Math.min(dpr, IS_TOUCH ? 1.25 : 1);
  return Math.min(dpr, IS_TOUCH ? 1.75 : 2);
}

// ---------------------------------------------------------------------------
// Tileable value-noise texture (RGB = three different noise octaves).
// ---------------------------------------------------------------------------
function makeNoiseData(size, seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = new Float32Array(size * size);
  const octave = (cells, amp) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const step = size / cells;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / step, fy = y / step;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % cells) * cells + (x0 % cells)], b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)], d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
    }
  };
  return { out, octave };
}
let noiseTex = null;
export function getNoiseTexture() {
  if (noiseTex) return noiseTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const chans = [[4, 8, 16], [8, 16, 32], [16, 32, 64]];
  chans.forEach((cells, ch) => {
    const { out, octave } = makeNoiseData(size, 1234 + ch * 777);
    octave(cells[0], 0.55); octave(cells[1], 0.3); octave(cells[2], 0.15);
    for (let i = 0; i < size * size; i++) data[i * 4 + ch] = Math.max(0, Math.min(255, out[i] * 255));
  });
  for (let i = 0; i < size * size; i++) data[i * 4 + 3] = 255;
  noiseTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

const noiseNode = (uv) => texture(getNoiseTexture(), uv);
const noiseL = (uv) => texture(getNoiseTexture(), uv).level(0);   // explicit LOD: safe inside loops / branches
const lin = (c) => pow(c, vec3(2.2));

// Screen-space bump from a procedural height (Mikkelsen surface gradient), returns a view-space normal.
export const bumpFrom = Fn(([h]) => {
  const n = normalView, dpx = positionView.dFdx(), dpy = positionView.dFdy();
  const dhx = h.dFdx(), dhy = h.dFdy();
  const r1 = cross(dpy, n), r2 = cross(n, dpx), det = dot(dpx, r1);
  const bn = abs(det).mul(n).sub(sign(det).mul(dhx.mul(r1).add(dhy.mul(r2))));
  return select(dot(bn, bn).greaterThan(1e-12), normalize(bn), n);
});

// ---------------------------------------------------------------------------
// Sky dome (TSL): gradient, sunset bands, sun disc and glow, ray-marched cumulus slab, stars and moon.
// ---------------------------------------------------------------------------
export function createSky(scene) {
  const top = uniform(SKY.top), horizon = uniform(SKY.horizon), sunCol = uniform(SKY.sun), sunDir = uniform(SUN_DIR);
  const clouds = uniform(1), night = uniform(0);
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  mat.colorNode = Fn(() => {
    const d = normalize(positionLocal), h = d.y;
    const col = mix(horizon, top, pow(clamp(h, 0, 1), 0.55)).toVar();
    col.assign(mix(col, horizon.mul(vec3(0.82, 0.9, 0.8)), smoothstep(0.0, -0.25, h)));
    const sd = max(dot(d, sunDir), 0.0);
    const azs = pow(max(0.0, dot(normalize(d.xz.add(1e-4)), normalize(sunDir.xz.add(1e-4)))).mul(0.5).add(0.5), 2.0);
    const ss = mix(vec3(1.0, 0.42, 0.12), vec3(0.98, 0.45, 0.5), smoothstep(0.0, 0.14, h)).toVar();
    ss.assign(mix(ss, vec3(0.5, 0.36, 0.7), smoothstep(0.12, 0.42, h)));
    col.assign(mix(col, ss.mul(azs.mul(0.75).add(0.55)), GOLD.mul(float(1).sub(smoothstep(0.3, 0.75, h))).mul(0.85)));
    col.addAssign(vec3(1.0, 0.5, 0.15).mul(pow(sd, 4.0)).mul(GOLD).mul(0.45));
    col.addAssign(sunCol.mul(pow(sd, 900.0).mul(6.0).add(pow(sd, 40.0).mul(0.25)).add(pow(sd, 6.0).mul(0.12))));
    If(clouds.greaterThan(0.5).and(h.greaterThan(0.0)), () => {
      const wind = vec2(TIME.mul(0.0025), TIME.mul(0.001));
      const T = float(1).toVar(), lit = vec3(0).toVar();
      const sunC = mix(mix(vec3(1.0, 0.97, 0.92), sunCol, 0.35).mul(1.08), vec3(1.0, 0.62, 0.36).mul(1.2), GOLD);
      const shadeC = mix(mix(horizon, top, 0.5).mul(vec3(0.6, 0.65, 0.78)), vec3(0.6, 0.38, 0.52), GOLD.mul(0.85));
      const HB = 1.0, HT = 1.38, NS = 12;
      const hh = max(h, 0.04), t0 = float(HB).div(hh), t1 = min(float(HT).div(hh), t0.add(3.0)), dt = t1.sub(t0).div(NS);
      const jit = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453));
      const hg = mix(1.0, pow(sd, 6.0).mul(1.6).add(1.0), 0.8);
      const dens = (p) => { const yf = p.y.sub(HB).div(HT - HB); const uv = p.xz.mul(0.16).add(wind);
        const n = noiseL(uv).r.mul(0.62).add(noiseL(uv.mul(2.3).add(0.3)).g.mul(0.38));
        const shape = smoothstep(0.0, 0.12, yf).mul(float(1).sub(smoothstep(0.35, 1.0, yf).mul(0.9)));
        return { yf, uv, shape, d: smoothstep(0.54, 0.68, n.mul(shape.mul(0.35).add(0.72)).add(shape.sub(0.6).mul(0.2))) }; };
      Loop(NS, ({ i }) => {
        const p = d.mul(t0.add(float(i).add(jit).mul(dt)));
        const D = dens(p);
        const den = clamp(D.d.sub(noiseL(D.uv.mul(6.0).add(D.yf.mul(0.25)).add(0.7)).b.mul(0.25).mul(float(1).sub(D.d))), 0, 1).mul(dt).mul(7.0);
        If(den.greaterThan(0.002), () => {
          const od = float(0).toVar();
          for (let k = 1; k <= 2; k++) { const Q = dens(p.add(sunDir.mul(0.07 * k))); od.addAssign(Q.d.mul(Q.shape)); }
          const beer = exp(od.mul(-1.6)), powder = float(1).sub(exp(den.mul(-6.0)));
          const sh = beer.mul(mix(1.0, powder, 0.5)).mul(D.yf.mul(0.4).add(0.6));
          const Lc = mix(shadeC, sunC.mul(hg), sh).add(sunCol.mul(pow(sd, 8.0)).mul(beer).mul(0.5)).add(vec3(1.0, 0.45, 0.18).mul(pow(sd, 3.0)).mul(beer).mul(GOLD).mul(0.7));
          const a = float(1).sub(exp(den.mul(-2.5)));
          lit.addAssign(T.mul(a).mul(Lc)); T.mulAssign(float(1).sub(a));
        });
        If(T.lessThan(0.03), () => { Break(); });
      });
      const c = float(1).sub(T).mul(smoothstep(0.0, 0.2, h));
      const cc = lit.div(max(float(1).sub(T), 1e-3)).mul(mix(vec3(1), vec3(0.16, 0.2, 0.32), night));
      col.assign(mix(col, cc, c.mul(0.92)));
      const sp = floor(d.mul(260.0)), r = fract(sin(dot(sp, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
      col.addAssign(vec3(0.9, 0.95, 1.0).mul(select(r.greaterThan(0.9965), float(1), float(0))).mul(night).mul(smoothstep(0.05, 0.3, h)).mul(float(1).sub(c)));
      const md = max(dot(d, sunDir.negate()), 0.0);
      col.addAssign(vec3(0.85, 0.9, 1.0).mul(smoothstep(0.9993, 0.9996, md).mul(1.4).add(pow(md, 60.0).mul(0.15))).mul(night));
    });
    return col;
  })();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  return {
    mesh: sky,
    follow(camera) { sky.position.copy(camera.position); },
    setQuality(q) { clouds.value = q === 'low' ? 0 : 1; },
    setNight(n) { night.value = n; }
  };
}

// ---------------------------------------------------------------------------
// Terrain (TSL): splat mask + noise detail, slope/height rock with triplanar strata, snow, procedural bump and roughness.
// ---------------------------------------------------------------------------
export const TERRAIN_MASK = { tex: null, size: 1 };
export function terrainMaterial(maskTex, maskSize) {
  TERRAIN_MASK.tex = maskTex; TERRAIN_MASK.size = maskSize;
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
  const W = positionWorld, wp = W.xz;
  const mk = texture(maskTex, wp.div(maskSize).add(0.5));
  const n1 = noiseNode(wp.mul(0.012)).r, n2 = noiseNode(wp.mul(0.07)).g;
  const fineK = float(1).sub(smoothstep(40.0, 70.0, length(cameraPosition.sub(W))));
  const n3 = mix(0.5, noiseNode(wp.mul(0.45)).b, fineK.mul(0.5).add(0.5)), n4 = mix(0.5, noiseNode(wp.mul(1.9)).r, fineK);
  let grass = mix(vec3(0.27, 0.50, 0.14), vec3(0.45, 0.63, 0.19), smoothstep(0.3, 0.7, n1));
  grass = mix(grass, vec3(0.20, 0.40, 0.12), smoothstep(0.55, 0.85, n2).mul(0.55));
  grass = mix(grass, vec3(0.55, 0.62, 0.24), smoothstep(0.62, 0.9, n3).mul(0.3)).mul(n4.mul(0.36).add(0.82));
  let dirt = mix(vec3(0.47, 0.35, 0.21), vec3(0.58, 0.45, 0.29), n3).mul(n4.mul(0.35).add(0.8));
  dirt = mix(dirt, vec3(0.62, 0.6, 0.55), smoothstep(0.72, 0.8, n4).mul(0.6));
  const sand = mix(vec3(0.82, 0.72, 0.5), vec3(0.9, 0.82, 0.6), n2).mul(n4.mul(0.18).add(0.9));
  const cell = wp.mul(1.35), sh = vec2(0.0, floor(cell.x).mul(0.5)), ci = floor(cell.add(sh)), cf = fract(cell.add(sh));
  const grout = smoothstep(0.0, 0.09, cf.x).mul(smoothstep(1.0, 0.91, cf.x)).mul(smoothstep(0.0, 0.09, cf.y)).mul(smoothstep(1.0, 0.91, cf.y));
  const cv = noiseNode(ci.mul(0.137)).g;
  const stone = mix(vec3(0.3, 0.29, 0.27), mix(vec3(0.48, 0.47, 0.44), vec3(0.66, 0.63, 0.57), cv).mul(n4.mul(0.15).add(0.9)), grout);
  const edge = n2.sub(0.5).mul(0.45).add(n4.sub(0.5).mul(0.15));
  const isSand = smoothstep(0.35, 0.6, mk.g.add(edge)), isDirt0 = smoothstep(0.38, 0.62, mk.r.add(edge)), isStone0 = smoothstep(0.4, 0.6, mk.b.add(edge.mul(0.4)));
  let col = mix(mix(mix(grass, sand, isSand), dirt, isDirt0), stone, isStone0);
  const fwn = normalize(normalWorld), slope = float(1).sub(abs(fwn.y));
  const hrock = max(smoothstep(11.0, 19.0, W.y.add(n2.sub(0.5).mul(6.0))), smoothstep(0.32, 0.5, slope.add(n3.sub(0.5).mul(0.15))));
  const tw0 = pow(abs(fwn), vec3(4.0)), tw = tw0.div(max(tw0.x.add(tw0.y).add(tw0.z), 1e-4));
  const tri = (s, ch) => noiseNode(W.zy.mul(s))[ch].mul(tw.x).add(noiseNode(W.xz.mul(s))[ch].mul(tw.y)).add(noiseNode(W.xy.mul(s))[ch].mul(tw.z));
  const r3 = tri(0.45, 'b'), r4 = tri(1.9, 'r'), r2 = tri(0.07, 'g');
  const strata = sin(W.y.mul(3.1).add(r2.mul(6.0))).mul(0.5).add(0.5);
  let rockC = mix(vec3(0.42, 0.40, 0.37), vec3(0.6, 0.58, 0.54), r3).mul(r4.mul(0.3).add(0.85));
  rockC = mix(rockC, vec3(0.32, 0.3, 0.28), smoothstep(0.6, 0.8, r2).mul(0.5)).mul(strata.mul(slope).mul(0.16).add(0.88));
  col = mix(col, rockC, hrock);
  const valley = smoothstep(-0.3, -2.5, W.y);
  col = mix(col, mix(col, vec3(0.32, 0.42, 0.16), 0.5), valley);
  const snow = smoothstep(19.0, 24.0, W.y.add(n2.sub(0.5).mul(5.0))).mul(float(1).sub(smoothstep(0.55, 0.75, slope)));
  col = mix(col, vec3(0.92, 0.94, 0.97).mul(n4.mul(0.1).add(0.92)), snow);
  m.colorNode = lin(col);
  const isStone = isStone0.mul(float(1).sub(hrock)), isDirt = isDirt0.mul(float(1).sub(hrock));
  let tH = mix(n4.mul(0.6).add(n3.mul(0.4)), float(1).sub(grout).mul(-0.55).add(n4.mul(0.3)), isStone);
  tH = mix(tH, r4.mul(0.6).add(r3.mul(0.6)).add(strata.mul(0.3).mul(slope)), hrock).mul(float(1).sub(snow.mul(0.7))).mul(fineK);
  m.normalNode = bumpFrom(tH.mul(0.14));
  m.roughnessNode = mix(mix(mix(mix(0.95, 0.88, isDirt), 0.72, isStone), float(0.8).sub(r4.mul(0.15)), hrock), 0.55, snow).mul(float(1).sub(valley.mul(0.12)));
  return m;
}

// ---------------------------------------------------------------------------
// Water (TSL): vertex waves, rippled normal, depth tint, true planar reflection via the reflector node, sun glints, shore foam.
// ---------------------------------------------------------------------------
export const WATER_Y = 0.05;
export const WATER_REFL = { on: uniform(0), nodes: [] };
export const WATER_MESHES = [];
export function createWaterReflection() {
  // the reflector node renders its own mirrored view; this just turns it off on Low
  return { update(enabled) { WATER_REFL.on.value = enabled ? 1 : 0; for (const r of WATER_REFL.nodes) r.target.visible = !!enabled; } };
}
export function waterMaterial(cx, cz, radius) {
  const center = uniform(new THREE.Vector2(cx, cz)), rad = uniform(radius), sunDir = uniform(SUN_DIR), sunCol = uniform(SKY.sun), skyCol = uniform(SKY.horizon), skyTop = uniform(SKY.top);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const wLod = float(1).sub(smoothstep(45.0, 80.0, length(cameraPosition.xz.sub(positionWorld.xz))));
  // the mesh is a circle rotated flat: local z is world up
  m.positionNode = positionLocal.add(vec3(0, 0, sin(positionWorld.x.mul(0.9).add(TIME.mul(1.3))).mul(0.025).add(sin(positionWorld.z.mul(1.3).sub(TIME.mul(1.7))).mul(0.02)).mul(wLod)));
  const refl = reflector({ resolutionScale: 0.5 });
  WATER_REFL.nodes.push(refl);
  m.userData.reflector = refl;
  m.colorNode = Fn(() => {
    const p = positionWorld.xz;
    const a = noiseNode(p.mul(0.09).add(vec2(TIME.mul(0.018), TIME.mul(0.011)))).rg.sub(0.5);
    const b = noiseNode(p.mul(0.21).sub(vec2(TIME.mul(0.025), TIME.mul(-0.017)))).gb.sub(0.5);
    const N = normalize(vec3(a.x.add(b.x).mul(0.45), 1.0, a.y.add(b.y).mul(0.45)));
    const V = normalize(cameraPosition.sub(positionWorld));
    const fres = pow(float(1).sub(max(dot(N, V), 0.0)), 3.0);
    const r = length(p.sub(center)).div(rad);
    const col = mix(vec3(0.008, 0.045, 0.10), vec3(0.025, 0.14, 0.17), smoothstep(0.55, 1.0, r)).toVar();
    const R = reflect(V.negate(), N), sky = mix(skyCol, skyTop, clamp(R.y, 0, 1));
    const shallowK = smoothstep(0.7, 0.98, r.add(a.x.add(b.x).mul(0.15)));
    col.assign(mix(col, vec3(0.32, 0.36, 0.26).mul(noiseNode(p.mul(0.8).add(N.xz.mul(0.6))).g.mul(0.4).add(0.8)), shallowK.mul(0.45)));
    refl.uvNode = refl.uvNode.add(N.xz.mul(0.045));
    const rcol = refl.rgb;
    col.assign(mix(col, mix(sky.mul(0.7), rcol.mul(0.9), WATER_REFL.on), mix(fres.mul(0.4).add(0.05), fres.mul(0.62).add(0.18).mul(float(1).sub(shallowK.mul(0.5))), WATER_REFL.on)));
    const H = normalize(sunDir.add(V).add(vec3(0, 1e-4, 0)));
    const nh = max(dot(N, H), 0.0);
    col.addAssign(sunCol.mul(pow(nh, 220.0).mul(3.0).add(pow(nh, 30.0).mul(0.08))));
    const fn = noiseNode(p.mul(0.6).add(TIME.mul(0.03))).b;
    const foam = smoothstep(0.93, 1.0, r.add(fn.sub(0.5).mul(0.08)).add(sin(TIME.mul(1.6).add(r.mul(40.0))).mul(0.008))).toVar();
    const lap = fract(r.mul(9.0).sub(TIME.mul(0.35)));
    const band = smoothstep(0.0, 0.08, lap).mul(smoothstep(0.35, 0.1, lap)).mul(smoothstep(0.82, 0.97, r));
    foam.assign(max(foam, band.mul(smoothstep(0.45, 0.75, fn.add(noiseNode(p.mul(2.3).sub(TIME.mul(0.05))).r.mul(0.2))))));
    col.assign(mix(col, vec3(0.86, 0.9, 0.93), foam.mul(0.75)));
    return vec4(col, mix(1.0, 0.72, shallowK));
  })();
  return m;
}
export function hookWaterNoise(mat) { return mat; }
// The reflector's virtual camera follows its water mesh: parent each reflector target to the mesh that uses it.
export function attachPendingReflectors(scene) {
  scene.traverse(o => { const r = o.isMesh && o.material && o.material.userData && o.material.userData.reflector; if (r && !r.target.parent) o.add(r.target); });
}

// ---------------------------------------------------------------------------
// World-space noise bump for vertex-colour Standard materials (vcMat and friends).
// ---------------------------------------------------------------------------
export function attachNoiseBump(mat, strength = 0.22) {
  mat.userData.noiseBump = strength;   // applied as a TSL normal node by nodeMats.js
  return mat;
}

export function tickGfx(nowMs) { TIME.value = nowMs / 1000; GOLD.value = SKY.gold || 0; }
