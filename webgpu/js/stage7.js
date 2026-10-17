// Stage 7 of the WebGPU release: higher-detail buildings (window shutters, sills and lintels, diagonal timber braces,
// eave fascia and barge boards, chimney pots and flashing). WebGPU-release only; the root WebGL game never loads this.
// Every building gets one extra baked mesh for its walls and one parented to its roof mesh, so the roof details hide
// with the roof when you walk inside. ?nobdetail turns it off.
import * as THREE from 'three';
import { addStage6, S6 } from './stage6.js';
import { POSTFX } from './post.js';
import { DAY } from '../../js/daycycle.js';
import { prim, col, place as put, setMat, woodAxis, bake } from '../../js/models.js';

const Q = new URLSearchParams(location.search);
const TIMBER = 0x4a3020, SHUTTER = [0x3c5a3a, 0x5a2e24, 0x2e4256, 0x5a4630], STONE = 0x8a8478, POT = 0x8a4a32;
const BIG = /Bank|Church|Smithy|Palace|Castle|Armoury|Emporium|Rune Shop|Store|Inn|Tavern|Weaponsmith/;

function detailFor(b) {
  const inn = b.inner, w = inn.maxX - inn.minX, d = inn.maxZ - inn.minZ, h = 2.7, base = 0.55, name = b.name || '';
  const big = w * d > 22 || BIG.test(name);
  const wall = [], roof = [];
  const wood = (geo, hex, amt, ...p) => { setMat(geo, woodAxis(geo)); wall.push(put(col(geo, hex, amt), ...p)); };
  const stone = (arr, geo, hex, amt, ...p) => { setMat(geo, 5); arr.push(put(col(geo, hex, amt), ...p)); };
  const doorOnX = !!b.door.nx, doorSign = doorOnX ? b.door.nx : b.door.nz;
  const sh = SHUTTER[Math.abs(Math.round(b.x * 7 + b.z * 13)) % SHUTTER.length];
  // windows: same layout as the base building; add shutters, a deep stone sill and a timber lintel
  const win = (px, pz, alongX, out) => {
    const ww = 0.55, whh = 0.55, wy = 1.75, o = 0.06 * out;
    const ox = alongX ? 0 : o, oz = alongX ? o : 0;
    stone(wall, alongX ? prim.box(ww + 0.26, 0.08, 0.2) : prim.box(0.2, 0.08, ww + 0.26), STONE, 0.15, px + ox, wy - whh / 2 - 0.07, pz + oz);
    wood(alongX ? prim.box(ww + 0.3, 0.1, 0.14) : prim.box(0.14, 0.1, ww + 0.3), TIMBER, 0.12, px + ox * 0.5, wy + whh / 2 + 0.07, pz + oz * 0.5);
    for (const s of [-1, 1]) {   // shutters swung open flat against the wall, with two ledger battens each
      const sx = alongX ? s * (ww / 2 + 0.17) : 0, sz = alongX ? 0 : s * (ww / 2 + 0.17);
      wood(alongX ? prim.box(0.3, whh + 0.06, 0.04) : prim.box(0.04, whh + 0.06, 0.3), sh, 0.18, px + sx + ox * 0.6, wy, pz + sz + oz * 0.6);
      for (const yy of [-0.16, 0.16]) wood(alongX ? prim.box(0.28, 0.05, 0.03) : prim.box(0.03, 0.05, 0.28), new THREE.Color(sh).multiplyScalar(0.7).getHex(), 0.1, px + sx + ox * 1.05, wy + yy, pz + sz + oz * 1.05);
    }
  };
  for (const sz of [-1, 1]) {
    if (!doorOnX && sz === doorSign) continue;
    const n = Math.max(1, Math.floor(w / 2));
    for (let i = 0; i < n; i++) win((i + 0.5) * w / n - w / 2, sz * (d / 2 + 0.03), true, sz);
  }
  for (const sx of [-1, 1]) {
    if (doorOnX && sx === doorSign) continue;
    const n = Math.max(1, Math.floor(d / 2));
    for (let i = 0; i < n; i++) win(sx * (w / 2 + 0.03), (i + 0.5) * d / n - d / 2, false, sx);
  }
  // timber-framed houses: diagonal braces in the end panels of every wall (between the sill rail and the mid rail)
  if (!big) {
    const y0 = base + 0.11, y1 = 1.59, ph = y1 - y0, pw = 0.62, L = Math.hypot(ph, pw), a = Math.atan2(ph, pw);
    for (const sd of [-1, 1]) for (const e of [-1, 1]) {
      const isDoorX = !doorOnX && sd === doorSign;
      if (!isDoorX) wood(prim.box(L, 0.09, 0.07), TIMBER, 0.12, e * (w / 2 - 0.1 - pw / 2), (y0 + y1) / 2, sd * (d / 2 + 0.04), 0, 0, e * a);
      const isDoorZ = doorOnX && sd === doorSign;
      if (!isDoorZ) wood(prim.box(0.07, 0.09, L), TIMBER, 0.12, sd * (w / 2 + 0.04), (y0 + y1) / 2, e * (d / 2 - 0.1 - pw / 2), -e * a, 0, 0);
    }
  }
  // roof: fascia boards under both eaves and barge boards up both gable verges
  const alongZ = d >= w, span = (alongZ ? w : d) + 0.5, len = (alongZ ? d : w) + 0.5;
  const rise = Math.min(1.9, span * 0.42), slope = Math.atan2(rise, span / 2), slant = Math.hypot(rise, span / 2);
  const RW = 0x3a2616;
  const rwood = (geo, ...p) => { setMat(geo, woodAxis(geo)); roof.push(put(col(geo, RW, 0.12), ...p)); };
  for (const s of [-1, 1]) {
    if (alongZ) rwood(prim.box(0.05, 0.16, len + 0.06), s * (span / 2 + 0.02), h - 0.02, 0);
    else rwood(prim.box(len + 0.06, 0.16, 0.05), 0, h - 0.02, s * (span / 2 + 0.02));
    for (const e of [-1, 1]) {   // barge boards
      const off = span / 4, yy = h + rise / 2 + 0.12;
      if (alongZ) rwood(prim.box(slant + 0.1, 0.2, 0.05), s * off, yy, e * (len / 2 + 0.03), 0, 0, -s * slope);
      else rwood(prim.box(0.05, 0.2, slant + 0.1), e * (len / 2 + 0.03), yy, s * off, s * slope, 0, 0);
    }
  }
  // finial at each gable apex
  for (const e of [-1, 1]) rwood(prim.cyl(0.03, 0.05, 0.35, 6), alongZ ? 0 : e * (len / 2 + 0.03), h + rise + 0.25, alongZ ? e * (len / 2 + 0.03) : 0);
  // chimney: lead flashing band and two clay pots on the existing stack
  if (!big || /Smithy|Cookhouse/.test(name)) {
    const cx = alongZ ? span * 0.22 : len * 0.3, cz = alongZ ? len * 0.3 : span * 0.22;
    const fy = h + rise * (1 - Math.abs(alongZ ? cx : cz) / (span / 2)) + 0.08;
    stone(roof, prim.box(0.52, 0.06, 0.52), 0x4a4e52, 0.05, cx, fy, cz);
    stone(roof, prim.box(0.5, 0.08, 0.5), 0x7a7268, 0.15, cx, h + rise + 0.62, cz);
    for (const k of [-1, 1]) {
      const g = prim.cyl(0.07, 0.09, 0.28, 8); setMat(g, 0); roof.push(put(col(g, POT, 0.2), cx + k * 0.12, h + rise + 1.15, cz));
      const r = prim.cyl(0.085, 0.085, 0.04, 8); setMat(r, 0); roof.push(put(col(r, 0x6a3826, 0.1), cx + k * 0.12, h + rise + 1.3, cz));
    }
  }
  return { wall, roof };
}

// buildings stream in and out with their chunk, so new ones are picked up by a cheap periodic scan
function decorate(b) {
  const g = b.mesh; g.userData.bdetail = true;
  const base = g.children.find(o => o.isMesh && o.geometry.attributes.aMat);
  if (!base) return 0;
  const { wall, roof } = detailFor(b); let tris = 0;
  if (wall.length) { const m = new THREE.Mesh(bake(wall), base.material); m.castShadow = m.receiveShadow = true; m.name = 'bdetail'; g.add(m); tris += m.geometry.attributes.position.count / 3; }
  const rm = g.userData.roof;
  if (roof.length && rm) { const m = new THREE.Mesh(bake(roof), rm.material); m.castShadow = m.receiveShadow = true; m.name = 'bdetail:roof'; rm.add(m); tris += m.geometry.attributes.position.count / 3; }
  return tris;
}
let scanT = 0;
const stats = { buildings: 0, tris: 0 };
function scan(scene) {
  scene.traverse(o => {
    const e = o.userData && o.userData.entity;
    if (!e || e.type !== 'building' || o.userData.bdetail || !e.inner || !e.door || e.mesh !== o) return;
    try { stats.tris += Math.round(decorate(e)); stats.buildings++; } catch (err) { o.userData.bdetail = true; console.warn('[webgpu] building detail skipped', e.name, err && err.message); }
  });
}
addStage6('buildings', (c) => {
  if (Q.has('nobdetail')) return;
  S6.stats.buildingDetail = stats; scan(c.scene); scanT = 0;
  addStage6.ctxScene = c.scene;
}, (dt) => {
  if (Q.has('nobdetail') || !addStage6.ctxScene) return;
  scanT += dt; if (scanT < 1.5) return; scanT = 0; scan(addStage6.ctxScene);
});

// bloom tuning: by day a high threshold keeps only the sun glints and spell cores blooming; at night and in the cave the
// threshold drops and strength rises so fires, torches, forges and spell effects throw a soft halo. ?nobloomtune
let bk = 0;
addStage6('bloomtune', () => {}, (dt) => {
  const b = POSTFX.bloom; if (!b || Q.has('nobloomtune')) return;
  // the cave fades in through main.js's caveK; walk-in interiors count as dim too (roof lifted, lamps and hearths inside)
  const g = window.gielinor, cave = g ? Math.min(1, g.caveK || 0) : 0, indoor = g && g.indoorsNow ? 0.6 : 0;
  const k = Math.max(DAY.night || 0, cave, indoor);
  bk += (k - bk) * Math.min(1, dt * 2);
  b.strength.value = 0.28 + 0.32 * bk; b.threshold.value = 0.92 - 0.3 * bk; b.radius.value = 0.45 + 0.15 * bk;
});
