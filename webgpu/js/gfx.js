// Graphics helpers for the modern look: sky dome, procedural textures,
// textured terrain, animated water, swaying foliage, graphics quality.
// Everything is generated in code (no image files), and kept cheap for phones.
import * as THREE from 'three';
import { IS_TOUCH } from './scene.js';
import { Fn, uniform, texture, float, vec2, vec3, vec4, mix, smoothstep, pow, max, min, clamp, abs, sin, cos, fract, floor, exp, dot, normalize, length,
  reflect, positionLocal, positionWorld, positionView, normalView, normalWorld, cameraPosition, screenCoordinate, Loop, If, Break, select, attribute, cross, sign, step,
  screenUV, viewportSharedTexture, cameraViewMatrix, viewportDepthTexture, perspectiveDepthToViewZ, cameraNear, cameraFar } from 'three/tsl';
import { reflector } from 'three/tsl';

export const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.42).normalize();
export const SKY = {
  top: new THREE.Color(0x3f7fd0),
  horizon: new THREE.Color(0xc9d3d6),
  sun: new THREE.Color(0xfff0c8)
};
// Shared, ticking time uniform used by water, foliage sway and clouds.
export const TIME = uniform(0);
export const SWAY = uniform(1);
const GOLD = uniform(0);
// 1 on High, 0 on Low: gates parallax, stochastic tiling and other per-pixel extras (stage 6)
export const HIQ = uniform(1);
// 1 on Ultra only: extra water detail normals, sharper ripples and wider shoreline foam
export const ULTRA = uniform(0);

// ---------------------------------------------------------------------------
// Graphics quality: 'high' or 'low'. Auto (null) = High on desktop, High on
// phones too but at a lower pixel ratio; it drops to Low by itself if the
// phone can't keep a smooth frame rate.
// ---------------------------------------------------------------------------
export function resolveQuality(setting) {
  if (setting === 'high' || setting === 'low' || setting === 'ultra') return setting;
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
// Stochastic tiling (stage 6): two lookups whose UVs are offset per large hashed cell, blended across cell borders, so the
// 256px noise never visibly repeats on big surfaces. Contrast-preserving blend keeps the variance of a single lookup.
const h2 = (p) => fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))).mul(43758.5453));
export const stoch = (uv) => {
  const g = uv.mul(0.37), c = floor(g), f = fract(g);
  const wx = smoothstep(0.3, 0.7, f.x), wy = smoothstep(0.3, 0.7, f.y);
  const a = texture(getNoiseTexture(), uv.add(h2(c))), b = texture(getNoiseTexture(), uv.add(h2(c.add(vec2(1, 0)))));
  const cc = texture(getNoiseTexture(), uv.add(h2(c.add(vec2(0, 1))))), d = texture(getNoiseTexture(), uv.add(h2(c.add(vec2(1, 1)))));
  const m = mix(mix(a, b, wx), mix(cc, d, wx), wy);
  const v = wx.mul(wx).add(float(1).sub(wx).mul(float(1).sub(wx))).mul(wy.mul(wy).add(float(1).sub(wy).mul(float(1).sub(wy))));
  return m.sub(0.5).div(max(v.sqrt(), 0.35)).add(0.5).clamp(0, 1);
};

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
      const HB = 1.0, HT = 1.38, NS = 24, NSk = mix(12.0, 24.0, ULTRA);   // Ultra: twice the march steps
      const hh = max(h, 0.04), t0 = float(HB).div(hh), t1 = min(float(HT).div(hh), t0.add(3.0)), dt = t1.sub(t0).div(NSk);
      const jit = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453));
      const hg = mix(1.0, pow(sd, 6.0).mul(1.6).add(1.0), 0.8);
      const dens = (p) => { const yf = p.y.sub(HB).div(HT - HB); const uv = p.xz.mul(0.16).add(wind);
        const n = noiseL(uv).r.mul(0.62).add(noiseL(uv.mul(2.3).add(0.3)).g.mul(0.38));
        const shape = smoothstep(0.0, 0.12, yf).mul(float(1).sub(smoothstep(0.35, 1.0, yf).mul(0.9)));
        return { yf, uv, shape, d: smoothstep(0.54, 0.68, n.mul(shape.mul(0.35).add(0.72)).add(shape.sub(0.6).mul(0.2))) }; };
      Loop(NS, ({ i }) => {
        const p = d.mul(t0.add(float(i).add(jit).mul(dt)));
        const D = dens(p);
        If(float(i).greaterThanEqual(NSk), () => { Break(); });
        // erosion: Ultra adds a second, finer octave so cloud edges are wispy instead of soft blobs
        const ero = noiseL(D.uv.mul(6.0).add(D.yf.mul(0.25)).add(0.7)).b.mul(0.25).add(noiseL(D.uv.mul(15.0).add(TIME.mul(0.004))).r.mul(0.14).mul(ULTRA));
        const den = clamp(D.d.sub(ero.mul(float(1).sub(D.d))), 0, 1).mul(dt).mul(7.0);
        If(den.greaterThan(0.002), () => {
          const od = float(0).toVar();
          for (let k = 1; k <= 2; k++) { const Q = dens(p.add(sunDir.mul(0.07 * k))); od.addAssign(Q.d.mul(Q.shape)); }
          { const Q = dens(p.add(sunDir.mul(0.24))); od.addAssign(Q.d.mul(Q.shape).mul(ULTRA).mul(0.8)); }   // Ultra: a far light sample for self-shadowed bases
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
      If(ULTRA.greaterThan(0.5), () => {
        const cu = d.xz.div(max(h, 0.06)).mul(0.09).add(vec2(TIME.mul(0.004), TIME.mul(0.0015)));
        const ci = smoothstep(0.55, 0.85, noiseL(cu.mul(vec2(0.35, 2.2))).g.mul(0.6).add(noiseL(cu.mul(1.7)).r.mul(0.4))).mul(smoothstep(0.03, 0.25, h)).mul(float(1).sub(c)).mul(0.45);
        const cic = mix(mix(vec3(1.0, 0.98, 0.95), vec3(1.0, 0.6, 0.55), GOLD), vec3(0.12, 0.14, 0.22), night).add(sunCol.mul(pow(sd, 10.0)).mul(0.4));
        col.assign(mix(col, cic, ci));
        const mw = smoothstep(0.32, 0.0, abs(dot(d, normalize(vec3(0.3, 0.5, -0.81))))).mul(noiseL(d.xz.mul(3.0).add(d.y)).r.mul(0.8).add(0.2));
        col.addAssign(vec3(0.5, 0.55, 0.75).mul(mw).mul(0.07).mul(night).mul(smoothstep(0.05, 0.35, h)).mul(float(1).sub(c)));
        const sp2 = floor(d.mul(520.0)), r2 = fract(sin(dot(sp2, vec3(39.3468, 11.135, 83.155))).mul(43758.5453));
        const tw = sin(TIME.mul(3.0).add(r2.mul(80.0))).mul(0.4).add(0.6);
        col.addAssign(vec3(0.85, 0.9, 1.0).mul(select(r2.greaterThan(0.9975), tw, float(0))).mul(night).mul(smoothstep(0.05, 0.3, h)).mul(float(1).sub(c)).mul(0.8));
      });
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
    setQuality(q) { ULTRA.value = q === 'ultra' ? 1 : 0; clouds.value = q === 'low' ? 0 : 1; HIQ.value = q === 'low' ? 0 : 1; },
    setNight(n) { night.value = n; }
  };
}

// ---------------------------------------------------------------------------
// Terrain (TSL): splat mask + noise detail, slope/height rock with triplanar strata, snow, procedural bump and roughness.
// ---------------------------------------------------------------------------
// Photo terrain detail (Tier S/M2 port): colour/height detail, cobble set, RG normal maps and mean-normalised roughness.
// Strictly High: the four webp files are fetched only on the first enableTexDetail(true); Low samples a 1x1 grey texture.
const BLANK_DETAIL = new THREE.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1); BLANK_DETAIL.needsUpdate = true;
export const TEX_ON = uniform(0);
const DETAIL_NODES = { d: [], n0: [], n1: [], r: [] };
let detailLoaded = false;
export function enableTexDetail(on) {
  TEX_ON.value = on ? 1 : 0;
  if (!on || detailLoaded) return;
  detailLoaded = true;
  const ld = (f, k) => new THREE.TextureLoader().load('../textures/' + f, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; for (const n of DETAIL_NODES[k]) n.value = t; });
  ld('detail_terrain.webp', 'd'); ld('detail_terrain_n0.webp', 'n0'); ld('detail_terrain_n1.webp', 'n1'); ld('detail_terrain_r.webp', 'r');
}
const dtex = (k, uv) => { const n = texture(BLANK_DETAIL, uv); DETAIL_NODES[k].push(n); return n; };
export const TERRAIN_MASK = { tex: null, size: 1 };
export function terrainMaterial(maskTex, maskSize) {
  TERRAIN_MASK.tex = maskTex; TERRAIN_MASK.size = maskSize;
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
  const W = positionWorld;
  const mk = texture(maskTex, W.xz.div(maskSize).add(0.5));
  const fineK = float(1).sub(smoothstep(40.0, 70.0, length(cameraPosition.sub(W))));
  // parallax occlusion on cobbles (High, near, flat ground only): march the view ray through the cobble height field
  const cobH = (q) => { const c = q.mul(1.35), sh0 = vec2(0.0, floor(c.x).mul(0.5)), f0 = fract(c.add(sh0));
    const e = f0.sub(0.5).abs().mul(2.0); return float(1).sub(smoothstep(0.72, 1.0, max(e.x, e.y))).mul(noiseL(floor(c.add(sh0)).mul(0.137)).g.mul(0.35).add(0.65)); };
  const V0 = normalize(cameraPosition.sub(W));
  const pomK = HIQ.mul(fineK).mul(smoothstep(0.3, 0.55, mk.b)).mul(smoothstep(0.9, 0.98, normalWorld.y));
  const pdir = V0.xz.div(max(V0.y, 0.25)).mul(-0.06).mul(pomK);   // 6 cm max depth
  const pom = Fn(() => {
    const q = W.xz.toVar(), lay = float(1).toVar();
    Loop(8, () => { const go = step(cobH(q), lay); q.addAssign(pdir.mul(0.125).mul(go)); lay.subAssign(go.mul(0.125)); });
    return vec3(q, lay);
  })();
  const wp = pom.xy, layer = pom.z;
  const n1 = noiseNode(wp.mul(0.012)).r, n2 = noiseNode(wp.mul(0.07)).g;
  const st3 = mix(noiseNode(wp.mul(0.45)), stoch(wp.mul(0.45)), HIQ).b, st4 = mix(noiseNode(wp.mul(1.9)), stoch(wp.mul(1.9)), HIQ).r;
  const n3 = mix(0.5, st3, fineK.mul(0.5).add(0.5)), n4 = mix(0.5, st4, fineK);
  let grass = mix(vec3(0.24, 0.37, 0.20), vec3(0.42, 0.54, 0.23), smoothstep(0.3, 0.7, n1));
  grass = mix(grass, vec3(0.12, 0.23, 0.17), smoothstep(0.55, 0.85, n2).mul(0.55));
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
  let rockC = mix(vec3(0.29, 0.29, 0.28), vec3(0.54, 0.53, 0.50), r3).mul(r4.mul(0.3).add(0.85));
  rockC = mix(rockC, vec3(0.29, 0.353, 0.165), smoothstep(0.6, 0.9, fwn.y).mul(0.75)); // moss on rock tops (#4A5A2A)
  rockC = mix(rockC, vec3(0.32, 0.3, 0.28), smoothstep(0.6, 0.8, r2).mul(0.5)).mul(strata.mul(slope).mul(0.16).add(0.88));
  col = mix(col, rockC, hrock);
  const valley = smoothstep(-0.3, -2.5, W.y);
  col = mix(col, mix(col, vec3(0.32, 0.42, 0.16), 0.5), valley);
  const snow = smoothstep(19.0, 24.0, W.y.add(n2.sub(0.5).mul(5.0))).mul(float(1).sub(smoothstep(0.55, 0.75, slope)));
  col = mix(col, vec3(0.92, 0.94, 0.97).mul(n4.mul(0.1).add(0.92)), snow);
  // photo detail, tinted: each set only modulates its own palette colour (TEX_ON gates it; textures are blank until High loads them)
  const dk = fineK.mul(0.75).add(0.25).mul(TEX_ON), nh = float(1).sub(hrock), ns = float(1).sub(snow);
  const dA = dtex('d', wp.mul(0.25)).sub(0.5), dB = dtex('d', wp.mul(0.5).add(0.37)).sub(0.5);
  const dR = dtex('d', W.zy.mul(0.2)).a.mul(tw.x).add(dtex('d', W.xz.mul(0.2)).a.mul(tw.y)).add(dtex('d', W.xy.mul(0.2)).a.mul(tw.z)).sub(0.5);
  const cbK = smoothstep(0.35, 0.65, n1.mul(0.6).add(n2.mul(0.4)));
  const wr = vec2(wp.x.mul(0.799).add(wp.y.mul(0.602)), wp.x.mul(-0.602).add(wp.y.mul(0.799)));
  const cb = mix(dtex('d', wp.mul(0.3)).b, dtex('d', wr.mul(0.3).add(0.53)).b, cbK).sub(0.5);
  const stoneT = mix(vec3(0.27, 0.27, 0.24), mix(vec3(0.52, 0.5, 0.46), vec3(0.66, 0.63, 0.57), cv), smoothstep(-0.22, 0.12, cb)).mul(n4.mul(0.12).add(0.92));
  col = mix(col, stoneT, isStone0.mul(nh).mul(ns).mul(TEX_ON));
  const dd = mix(mix(mix(dA.r, dB.g, isDirt0), cb, isStone0), dR, hrock).mul(ns);
  col = col.mul(dd.mul(mix(0.9, 0.35, isStone0.mul(nh))).mul(dk).add(1));
  const tDet = dd.mul(dk), sk = nh.mul(ns);
  const tW = vec4(float(1).sub(isDirt0).mul(float(1).sub(isStone0)).mul(sk), isDirt0.mul(float(1).sub(isStone0)).mul(sk), isStone0.mul(sk), hrock.mul(tw.y).mul(ns));
  m.colorNode = lin(col);
  const isStone = isStone0.mul(float(1).sub(hrock)), isDirt = isDirt0.mul(float(1).sub(hrock));
  let tH = mix(n4.mul(0.6).add(n3.mul(0.4)), mix(float(1).sub(grout).mul(-0.55).add(n4.mul(0.3)), 0.0, TEX_ON), isStone);
  tH = mix(tH, r4.mul(0.6).add(r3.mul(0.6)).add(strata.mul(0.3).mul(slope)), hrock).mul(float(1).sub(snow.mul(0.7))).mul(fineK).add(tDet.mul(0.8));
  const wq = W.xz;
  const nG = dtex('n0', wq.mul(0.25)).rg, nD = dtex('n0', wq.mul(0.5).add(0.37)).ba;
  const nC1 = dtex('n1', wr.mul(0.3).add(0.53)).rg.sub(0.5);
  const nC = mix(dtex('n1', wq.mul(0.3)).rg, vec2(nC1.x.mul(0.799).sub(nC1.y.mul(0.602)), nC1.x.mul(0.602).add(nC1.y.mul(0.799))).add(0.5), cbK), nR = dtex('n1', wq.mul(0.2)).ba;
  const pn = nG.sub(0.5).mul(tW.x.mul(0.8)).add(nD.sub(0.5).mul(tW.y)).add(nC.sub(0.5).mul(tW.z.mul(1.4))).add(nR.sub(0.5).mul(tW.w)).mul(dk.mul(2.0));
  m.normalNode = normalize(bumpFrom(tH.mul(0.14)).add(cameraViewMatrix.mul(vec4(pn.x, 0.0, pn.y, 0.0)).xyz));
  const rg = vec4(dtex('r', wq.mul(0.25)).r, dtex('r', wq.mul(0.5).add(0.37)).g, dtex('r', wq.mul(0.3)).b, dtex('r', wq.mul(0.2)).a).mul(2.0);
  const rm = dot(rg, tW).add(float(1).sub(tW.x).sub(tW.y).sub(tW.z).sub(tW.w));
  m.roughnessNode = mix(1.0, rm, dk.mul(0.6)).mul(mix(mix(mix(mix(0.95, 0.88, isDirt), 0.72, isStone), float(0.8).sub(r4.mul(0.15)), hrock), 0.55, snow).mul(float(1).sub(valley.mul(0.12)))
    .add(n4.sub(0.5).mul(0.12)).sub(grout.oneMinus().mul(isStone).mul(-0.1))).clamp(0.3, 1.0);
  // cavity AO: grout lines, rock crevices and the low points of the parallax march
  m.aoNode = mix(1.0, float(1).sub(grout.oneMinus().mul(isStone).mul(0.55)).mul(float(1).sub(smoothstep(0.35, 0.0, r4).mul(hrock).mul(0.35))).mul(mix(1.0, layer.mul(0.4).add(0.6), pomK)), fineK);
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
  return { setQuality(q) { const s = WATER_REFL.scale = q === 'ultra' ? 1.0 : 0.5; for (const r of WATER_REFL.nodes) { try { if (r.reflector) r.reflector.resolutionScale = s; } catch (e) {} } },
    update(enabled) { WATER_REFL.on.value = enabled ? 1 : 0; for (const r of WATER_REFL.nodes) r.target.visible = !!enabled; } };
}
// Stage 6 water: 4-wave Gerstner surface with analytic normals plus two scrolling detail normals, screen-space
// refraction of what lies below, Beer-Lambert absorption over a virtual lakebed depth (the lakes are shallow discs, so
// depth comes from the radial profile blended with the real depth-buffer difference at the shore), planar reflection
// mixed by Schlick Fresnel, depth-difference shoreline foam, animated caustics on the refracted lakebed, and expanding
// ripple rings from the player. Low/WebGL2 keeps the same graph with the reflection off.
export const WATER_PLAYER = uniform(new THREE.Vector3(1e4, 0, 1e4));
export const WATER_RIPPLE = uniform(0);   // 0..1 how much the player is stirring the water (moving near or in it)
const GW = [[0.9, 0.35, 0.030, 5.5], [-0.4, 0.92, 0.022, 3.4], [0.62, -0.78, 0.016, 2.1], [-0.85, -0.5, 0.010, 1.3]];   // dir.x, dir.z, amplitude, wavelength
export function waterMaterial(cx, cz, radius) {
  const center = uniform(new THREE.Vector2(cx, cz)), rad = uniform(radius), sunDir = uniform(SUN_DIR), sunCol = uniform(SKY.sun), skyCol = uniform(SKY.horizon), skyTop = uniform(SKY.top);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const wLod = float(1).sub(smoothstep(45.0, 80.0, length(cameraPosition.xz.sub(positionWorld.xz))));
  const edgeK = (p) => float(1).sub(smoothstep(0.8, 1.0, length(p.sub(center)).div(rad)));   // waves die out at the bank so the rim stays put
  const gerst = (p, t) => {   // returns { d: displacement (x, y, z), n: world normal }
    let dx = float(0), dy = float(0), dz = float(0), nx = float(0), nz = float(0), ny = float(0);
    for (const [ax, az, A, L] of GW) {
      const k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k), Q = 0.6;
      const f = dot(vec2(ax, az), p).mul(k).sub(t.mul(c * k)), cf = cos(f), sf = sin(f);
      dx = dx.add(cf.mul(Q * A * ax)); dz = dz.add(cf.mul(Q * A * az)); dy = dy.add(sf.mul(A));
      nx = nx.add(cf.mul(-ax * k * A)); nz = nz.add(cf.mul(-az * k * A)); ny = ny.add(sf.mul(Q * k * A));
    }
    return { d: vec3(dx, dy, dz), n: vec3(nx, float(1).sub(ny), nz) };
  };
  const ripple = (p) => {   // concentric rings travelling out from the player, as a height and its radial slope
    const dv = p.sub(WATER_PLAYER.xz), r = length(dv), ph = r.mul(9.0).sub(TIME.mul(6.0));
    const env = float(1).sub(smoothstep(0.4, 4.5, r)).mul(WATER_RIPPLE);
    return { h: sin(ph).mul(env).mul(0.012), slope: cos(ph).mul(env).mul(0.11), dir: dv.div(max(r, 1e-3)) };
  };
  // the mesh is a circle rotated flat: local x = world x, local y = -world z, local z = world up
  m.positionNode = Fn(() => {
    const p = positionWorld.xz, g = gerst(p, TIME), e = edgeK(p).mul(wLod), rp = ripple(p);
    return positionLocal.add(vec3(g.d.x, g.d.z.negate(), g.d.y.add(rp.h)).mul(e));
  })();
  const refl = reflector({ resolutionScale: WATER_REFL.scale || 0.5 });
  WATER_REFL.nodes.push(refl);
  m.userData.reflector = refl;
  m.colorNode = Fn(() => {
    const p = positionWorld.xz, e = edgeK(p);
    const g = gerst(p, TIME), rp = ripple(p);
    const a = noiseNode(p.mul(0.35).add(vec2(TIME.mul(0.03), TIME.mul(0.017)))).rg.sub(0.5);
    const b = noiseNode(p.mul(0.9).sub(vec2(TIME.mul(0.045), TIME.mul(-0.03)))).gb.sub(0.5);
    // Ultra: a third, finer ripple normal layer scrolling across the other two
    const c3 = noiseNode(p.mul(2.3).add(vec2(TIME.mul(-0.07), TIME.mul(0.05)))).rb.sub(0.5);
    const det = a.mul(0.22).add(b.mul(0.14)).add(c3.mul(0.12).mul(ULTRA)).mul(mix(0.4, 1.0, HIQ));
    const N = normalize(vec3(g.n.x.mul(e).add(det.x).add(rp.dir.x.mul(rp.slope).negate()), 1.0, g.n.z.mul(e).add(det.y).add(rp.dir.y.mul(rp.slope).negate())));
    const V = normalize(cameraPosition.sub(positionWorld));
    const NV = max(dot(N, V), 0.0), fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(NV), 5.0)));
    const r = length(p.sub(center)).div(rad);
    // depth: virtual bowl profile (1.8 m in the middle), then clamp by the real depth-buffer gap so the bank stays shallow
    const sceneZ = perspectiveDepthToViewZ(viewportDepthTexture(screenUV), cameraNear, cameraFar);
    const gap = max(positionView.z.sub(sceneZ), 0.0);   // metres of scene behind the surface along the view ray
    const bowl = float(1).sub(r.mul(r)).max(0.0).mul(1.8);
    const depth = min(bowl, gap.mul(4.0).add(bowl.mul(smoothstep(0.85, 0.6, r))));
    // refraction: bend the screen lookup by the normal, scaled by depth so the bank barely wobbles
    const ruv = screenUV.add(N.xz.mul(0.035).mul(smoothstep(0.0, 0.5, depth)));
    const below = viewportSharedTexture(ruv).rgb;
    // lakebed seen through the water: refracted bed point, sand/silt colour, animated caustics
    const bedP = p.add(N.xz.mul(depth).mul(0.6)).sub(V.xz.div(max(V.y, 0.2)).mul(depth).mul(0.75));
    const c1 = noiseNode(bedP.mul(0.55).add(vec2(TIME.mul(0.05), TIME.mul(0.03)))).r, c2 = noiseNode(bedP.mul(0.55).mul(1.31).sub(vec2(TIME.mul(0.04), TIME.mul(-0.05)))).g;
    const caus = pow(float(1).sub(abs(c1.sub(c2)).mul(3.0)).clamp(0, 1), 6.0).mul(smoothstep(0.0, 0.3, depth)).mul(float(1).sub(smoothstep(0.8, 1.8, depth)).mul(0.6).add(0.4));
    const bed = mix(vec3(0.34, 0.31, 0.22), vec3(0.18, 0.2, 0.15), noiseNode(bedP.mul(0.4)).b).mul(below.mul(1.5).add(0.5)).add(sunCol.mul(caus).mul(0.55).mul(HIQ.mul(0.5).add(0.5)));
    // Beer-Lambert absorption: red goes first, so deep water turns teal then navy
    const absorb = exp(vec3(-1.6, -0.55, -0.32).mul(depth.mul(1.6)));
    const scatter = vec3(0.012, 0.07, 0.09);
    const under = mix(bed, below, smoothstep(0.92, 1.0, r)).mul(absorb).add(scatter.mul(float(1).sub(absorb.g)));
    // reflection: planar reflector on High, analytic sky on Low
    refl.uvNode = refl.uvNode.add(N.xz.mul(0.04));
    const R = reflect(V.negate(), N), sky = mix(skyCol, skyTop, clamp(R.y, 0, 1));
    const rcol = mix(sky.mul(0.8), refl.rgb, WATER_REFL.on);
    const col = mix(under, rcol, fres.mul(0.9)).toVar();
    const H = normalize(sunDir.add(V)), nh = max(dot(N, H), 0.0);
    col.addAssign(sunCol.mul(pow(nh, 400.0).mul(4.0).add(pow(nh, 40.0).mul(0.06))));
    // shoreline foam from the depth gap plus the old lapping bands near the rim, broken up by noise
    const fn = noiseNode(p.mul(0.9).add(TIME.mul(0.04))).b, fn2 = noiseNode(p.mul(2.6).sub(TIME.mul(0.06))).r;
    const shore = float(1).sub(smoothstep(0.0, 0.07, gap.add(fn.sub(0.5).mul(0.04)))).mul(smoothstep(0.78, 0.92, r));   // the flat bed disc sits 3.5 cm down, so only trust the gap near the bank
    const lap = fract(r.mul(9.0).sub(TIME.mul(0.35)));
    const band = smoothstep(0.0, 0.08, lap).mul(smoothstep(0.35, 0.1, lap)).mul(smoothstep(0.85, 0.97, r));
    const crest = smoothstep(0.05, 0.068, g.d.y).mul(e).mul(0.3);
    const foam = max(max(shore, band.mul(0.6)), crest).mul(smoothstep(0.35, 0.7, fn.mul(0.6).add(fn2.mul(0.4)).add(shore.mul(0.3)))).add(abs(rp.h).mul(25.0).mul(WATER_RIPPLE).mul(0.4)).clamp(0, 1);
    // Ultra: a wider lacy foam fringe along the bank (cellular-looking from two noise octaves) that breathes with the waves
    const lace = smoothstep(0.55, 0.72, fn2.mul(0.7).add(noiseNode(p.mul(5.5).add(TIME.mul(0.05))).g.mul(0.3)));
    const fringe = float(1).sub(smoothstep(0.0, 0.22, gap)).mul(smoothstep(0.7, 0.9, r)).mul(lace).mul(sin(TIME.mul(0.9).add(r.mul(14.0))).mul(0.25).add(0.75));
    const foamU = max(foam, fringe.mul(ULTRA));
    col.assign(mix(col, vec3(0.88, 0.92, 0.95), foamU.mul(0.8)));
    return vec4(col, smoothstep(0.0, 0.06, gap).mul(0.25).add(0.75));
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
