// WebGPU release: TSL versions of the shared WebGL shader patches. The shared modules (models.js, anatomy.js, player.js)
// still build plain MeshStandardMaterials with onBeforeCompile hooks, which node materials ignore. This module tags those
// materials by their cache key and gives them equivalent node graphs: foliage sway and trampling, building wood/plaster/
// stone/thatch detail, the vertex-colour noise bump, character skin/fur/cloth shading and armour patterns.
import * as THREE from 'three';
import { Fn, uniform, uniformArray, texture, float, vec2, vec3, vec4, mix, smoothstep, pow, max, min, clamp, abs, sin, cos, fract, floor, mod, dot, normalize,
  length, atan, positionLocal, positionWorld, normalWorld, normalView, cameraPosition, cameraViewMatrix, modelWorldMatrix, vertexColor, attribute, select, If, Loop, positionViewDirection, step } from 'three/tsl';
import { getNoiseTexture, TIME, SWAY, bumpFrom, HIQ } from './gfx.js';
import { PUSH, vcMat, buildMat, foliageMat, treeMat } from '../../js/models.js';
import * as ANAT from '../../js/anatomy.js';
const CHAR = ANAT.CHAR;
import { DAY } from '../../js/daycycle.js';

const N = (uv) => texture(getNoiseTexture(), uv);
const charQ = uniform(1), lDir = uniform(DAY.lightDir), lCol = uniform(DAY.lightCol), lK = uniform(1), ambK = uniform(1);
const pushU = uniformArray(PUSH.value, 'vec4');
const fadeAt = (a, b) => float(1).sub(smoothstep(a, b, length(cameraPosition.sub(positionWorld))));
// object origin in world space (per instance for InstancedMesh: modelWorldMatrix already includes the instance in positionLocal
// space, so take the instance translation from positionWorld minus the local offset)
const instOrigin = () => modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz;

// ---------------- foliage ----------------
function foliageNodes(m, amount, ring) {
  // instancing has already been applied to positionLocal when positionNode runs, so wind and trampling offsets are
  // computed from the raw geometry position (plant-local height) and added in mesh space.
  m.positionNode = Fn(() => {
    const raw = attribute('position', 'vec3');
    const P = positionLocal.toVar();
    const wo = modelWorldMatrix.mul(vec4(P, 1)).xyz;
    const lod = float(1).sub(smoothstep(40.0, 60.0, length(cameraPosition.xz.sub(wo.xz))));
    const h = max(amount > 1 ? raw.y : raw.y.sub(0.9), 0.0);
    const ph = floor(wo.x.mul(2)).mul(0.185).add(floor(wo.z.mul(2)).mul(0.115));
    P.x.addAssign(sin(TIME.mul(1.25).add(ph)).mul(0.03).mul(h).mul(SWAY).mul(amount).mul(lod));
    P.z.addAssign(cos(TIME.mul(1.05).add(ph.mul(1.3))).mul(0.025).mul(h).mul(SWAY).mul(amount).mul(lod));
    if (amount > 1) {
      for (let i = 0; i < 4; i++) {
        const Pu = pushU.element(i);
        const dv = wo.xz.sub(Pu.xy), dd = length(dv);
        const f = float(1).sub(smoothstep(Pu.z.mul(0.3), Pu.z, dd)).mul(Pu.w).mul(step(0.0001, Pu.w));
        const dir = select(dd.greaterThan(1e-3), dv.div(max(dd, 1e-3)), vec2(1, 0));
        P.x.addAssign(dir.x.mul(f).mul(raw.y).mul(0.9)); P.z.addAssign(dir.y.mul(f).mul(raw.y).mul(0.9));
        P.y.subAssign(raw.y.mul(f).mul(0.45));
      }
      if (ring) { const P0 = pushU.element(0); const rd = max(abs(wo.x.sub(P0.x)), abs(wo.z.sub(P0.y))); P.subAssign(raw.mul(smoothstep(10.0, 16.0, rd))); }
    }
    return P;
  })();
}

// ---------------- building material ----------------
function buildNodes(m) {
  const aMat = attribute('aMat', 'float');
  const P = positionWorld, BN = normalize(normalWorld), an = abs(BN), fade = fadeAt(35, 65);
  const id = floor(aMat.add(0.5));
  // wood (1-3): grain along the long axis
  const Q = select(id.equal(1), P.yzx, select(id.equal(2), P.xzy, P.xyz));
  const w = N(vec2(Q.x.mul(1.2).add(Q.y.mul(1.2)), Q.z.mul(0.08))).r;
  const rings = sin(Q.x.add(Q.y).mul(38.0).add(w.mul(9.0))).mul(0.5).add(0.5);
  const knot = smoothstep(0.86, 0.95, N(Q.xz.mul(0.9).add(Q.yz.mul(0.7))).g);
  const woodC = mix(1.0, rings.mul(0.4).add(0.72).sub(knot.mul(0.35)), fade.mul(0.8)), woodH = rings.mul(0.5).sub(knot).mul(fade), woodR = rings.mul(0.12).add(0.78);
  // plaster (4)
  const uvW = select(an.x.greaterThan(an.z), P.zy, P.xy);
  const mot = N(uvW.mul(0.35)).g.mul(0.6).add(N(uvW.mul(1.7)).r.mul(0.4));
  const grime = float(1).sub(smoothstep(0.5, 1.4, P.y.sub(N(uvW.mul(0.6)).r.sub(0.5).mul(0.4))));
  const plC = mix(1.0, mot.mul(0.24).add(0.86).mul(float(1).sub(grime.mul(0.22))), fade), plH = mot.sub(0.5).mul(0.6).mul(fade);
  // stone (5): coursed blocks with mortar
  const uvS = select(an.y.greaterThan(0.7), P.xz, uvW);
  const b0 = uvS.mul(vec2(2.2, 4.4)), b = vec2(b0.x.add(floor(b0.y).mul(0.5)), b0.y), f = fract(b), ci = floor(b);
  const mortar = smoothstep(0.0, 0.07, f.x).mul(smoothstep(1.0, 0.93, f.x)).mul(smoothstep(0.0, 0.1, f.y)).mul(smoothstep(1.0, 0.9, f.y));
  const bv = N(ci.mul(0.173)).g, chip = N(uvS.mul(2.5)).r;
  const stC = mix(1.0, mix(0.55, bv.mul(0.35).add(0.82), mortar).mul(chip.mul(0.2).add(0.9)), fade), stH = mortar.mul(chip.mul(0.4).add(0.6)).sub(0.5).mul(fade);
  // roof (6): strands down the slope, moss low down
  const down = select(length(BN.xz).greaterThan(0.05), normalize(BN.xz), vec2(0, 1)), across = vec2(down.y.negate(), down.x);
  const ra = dot(P.xz, across), dn = dot(P.xz, down);
  const strands = N(vec2(ra.mul(3.5), dn.mul(0.25).add(P.y.mul(0.3)))).r.mul(0.6).add(N(vec2(ra.mul(11.0), dn.mul(0.6))).g.mul(0.4));
  const moss = smoothstep(0.55, 0.8, N(P.xz.mul(0.3).add(P.y.mul(0.2))).b).mul(float(1).sub(smoothstep(0.0, 0.25, BN.y.sub(0.55))));
  const vc = vertexColor();
  const band = (lo, hi) => step(lo, id).mul(step(id, hi));
  const isW = band(0.5, 3.5), is4 = band(3.5, 4.5), is5 = band(4.5, 5.5), is6 = band(5.5, 6.5), isN = float(1).sub(isW).sub(is4).sub(is5).sub(is6);
  const roofC = mix(vc.rgb.mul(mix(1.0, strands.mul(0.5).add(0.7), fade)), vec3(0.2, 0.28, 0.12), moss.mul(0.35).mul(fade));
  m.colorNode = vc.rgb.mul(woodC.mul(isW).add(plC.mul(is4)).add(stC.mul(is5)).add(isN)).add(roofC.mul(is6));
  const H = woodH.mul(isW).add(plH.mul(is4)).add(stH.mul(is5)).add(strands.sub(0.5).mul(1.2).mul(fade).mul(is6));
  m.roughnessNode = woodR.mul(isW).add(is4.mul(0.92)).add(is5.mul(0.85)).add(is6.mul(0.9)).add(isN.mul(m.roughness));
  // stage 6: overlapping clay roof tiles on High (scalloped courses with a shadowed lip), cavity AO everywhere
  const tc = vec2(ra.mul(2.6), dn.mul(3.2)), tcf = fract(vec2(tc.x.add(floor(tc.y).mul(0.5)), tc.y));
  const lip = smoothstep(0.0, 0.18, tcf.y), arc = float(1).sub(pow(abs(tcf.x.sub(0.5)).mul(2.0), 2.0)).mul(0.25);
  const tileH = smoothstep(0.0, 0.95, tcf.y.add(arc)).mul(0.8).add(N(floor(tc).mul(0.21)).g.mul(0.2));
  const tileK = HIQ.mul(fade).mul(is6).mul(step(0.35, vc.r.sub(vc.b)));   // reddish roofs read as tile; thatch keeps strands
  m.colorNode = mix(m.colorNode, vc.rgb.mul(tileH.mul(0.3).add(0.75)).mul(N(floor(tc).mul(0.37)).r.mul(0.25).add(0.85)), tileK);
  m.normalNode = bumpFrom(mix(H, tileH.mul(1.6), tileK).mul(0.012));
  m.aoNode = float(1).sub(knot.mul(0.3).mul(isW)).sub(float(1).sub(mortar).mul(0.5).mul(is5).mul(fade))
    .sub(float(1).sub(lip).mul(0.45).mul(tileK)).sub(float(1).sub(strands).mul(0.25).mul(is6).mul(fade)).sub(grime.mul(0.12).mul(is4));
  m.vertexColors = false;
}
// ---------------- vcMat noise bump ----------------
function noiseBumpNodes(m, strength) {
  const k = float(strength).mul(fadeAt(40, 70));
  const hx = N(positionWorld.xz.mul(0.18)).r, hz = N(positionWorld.xz.mul(0.18).add(0.37)).g;
  const nw = normalize(vec3(hx.sub(0.5).mul(k).mul(2.0), 1.0, hz.sub(0.5).mul(k).mul(2.0)));
  const nt = normalize(cameraViewMatrix.mul(vec4(nw, 0)).xyz);
  m.normalNode = normalize(mix(normalView, nt, 0.55));
}

// ---------------- gear pattern (0 cloth, 1 chain, 2 plate, 3 leather) ----------------
const gHash = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const gNoise = (p) => { const i = floor(p), f0 = fract(p), f = f0.mul(f0).mul(float(3).sub(f0.mul(2)));
  return mix(mix(gHash(i), gHash(i.add(vec2(1, 0))), f.x), mix(gHash(i.add(vec2(0, 1))), gHash(i.add(vec2(1, 1))), f.x), f.y); };
function gearPat(p, gk) {   // vec4(height, albedo, metal, rough); gk is a JS number or a uniform
  const uv = vec2(atan(p.x, p.z).mul(0.16), p.y);
  const w = uv.mul(260.0), wx = sin(w.x).mul(0.5).add(0.5), wy = sin(w.y).mul(0.5).add(0.5);
  const hC = mix(wx, wy, step(0.5, fract(floor(w.x.div(3.1416)).add(floor(w.y.div(3.1416))).mul(0.5)))).mul(0.6).add(gNoise(uv.mul(40.0)).mul(0.4));
  const cloth = vec4(hC.mul(0.3), hC.mul(0.08).add(0.95), 0.0, 0.92);
  const c = uv.mul(vec2(42.0, 48.0)), cc = vec2(c.x.add(mod(floor(c.y), 2.0).mul(0.5)), c.y), fr = fract(cc).sub(0.5);
  const r = length(fr.mul(vec2(1.0, 1.25))), ring = mix(float(1).sub(smoothstep(0.06, 0.14, abs(r.sub(0.3)))), 0.55, fadeAt(3, 9).oneMinus());
  const chain = vec4(ring, mix(0.25, 1.05, ring), ring, mix(0.8, 0.35, ring));
  const band = fract(p.y.mul(6.0)), edge = smoothstep(0.0, 0.08, band).mul(float(1).sub(smoothstep(0.9, 1.0, band)));
  const rv = vec2(fract(uv.x.mul(18.0)).sub(0.5), band.sub(0.08)), rivet = float(1).sub(smoothstep(0.05, 0.11, length(rv.mul(vec2(1.0, 2.5)))));
  const brush = gNoise(vec2(uv.x.mul(600.0), p.y.mul(6.0)));
  const plate = vec4(edge.mul(0.6).add(rivet.mul(0.6)).add(brush.mul(0.03)), edge.mul(0.2).add(0.8).mul(brush.mul(0.08).add(0.96)).add(rivet.mul(0.15)), 1.0, brush.mul(0.18).add(0.28).add(float(1).sub(edge).mul(0.3)));
  const gr = gNoise(uv.mul(90.0)).mul(0.6).add(gNoise(uv.mul(22.0)).mul(0.4));
  const st = step(0.5, fract(uv.x.mul(40.0))).mul(float(1).sub(smoothstep(0.004, 0.009, abs(fract(p.y.mul(4.0)).sub(0.5)))));
  const leather = vec4(gr.mul(0.5).sub(st.mul(0.5)), gr.mul(0.3).add(0.8).sub(st.mul(0.25)), 0.0, gr.mul(0.25).add(0.6));
  const g = typeof gk === 'number' ? float(gk) : gk;
  return select(g.lessThan(0.5), cloth, select(g.lessThan(1.5), chain, select(g.lessThan(2.5), plate, leather)));
}

// ---------------- character skin / fur / cloth ----------------
function charNodes(m, o) {
  const vc = vertexColor().rgb, W = positionWorld, CN = normalize(normalWorld);
  const skin = smoothstep(0.06, 0.2, vc.r.sub(vc.b)).mul(smoothstep(0.02, 0.12, vc.g.sub(vc.b))).mul(o.sss);
  let col = vc, rough = mix(float(o.rough), 0.5, skin.mul(charQ)), metal = float(o.metal), gM = float(0), gF = float(0), gP = null;
  if (o.gear) {
    gM = float(1).sub(smoothstep(0.02, 0.1, skin)).mul(smoothstep(0.06, 0.16, max(vc.r, max(vc.g, vc.b))));
    gF = gM.mul(charQ).mul(fadeAt(8, 22)); gP = gearPat(positionLocal, o.gear);
    col = vc.mul(mix(1.0, gP.y, gF)); rough = mix(rough, gP.w, gF); metal = mix(0.02, mix(0.15, 0.85, gP.z), gM);
  }
  // stage 9 close-up detail (High, within ~6 m): a per-material surface pattern in mesh-local space so it sticks to the
  // body as it animates. Skin gets mottling and pores, cloth a weave, fur strands and clumps, scales overlapping cells,
  // chitin segment seams, bone pits and hairline cracks, metal fine scratches. ?nochardetail turns it off.
  const kind = CDET_ON ? charKind(o) : null;
  const cd = CDET.mul(HIQ).mul(charQ).mul(fadeAt(2.0, 6.5));
  let dH = null;
  if (kind) {
    const D = charDetail(kind, positionLocal, skin);
    col = col.mul(mix(vec3(1.0), D.alb, cd)); rough = clamp(rough.add(D.rough.mul(cd)), 0.05, 1.0);
    dH = D.h.mul(cd); m.aoNode = mix(float(1.0), D.ao, cd);
  }
  m.colorNode = col; m.roughnessNode = rough; m.metalnessNode = metal; m.vertexColors = false;
  // triplanar micro-bump (pores, weave, fur)
  const cfade = charQ.mul(fadeAt(10, 28));
  const bw0 = abs(CN), bw = bw0.div(bw0.x.add(bw0.y).add(bw0.z)), P = W.mul(o.freq);
  const hx = N(P.yz).r.mul(bw.x).add(N(P.xz).r.mul(bw.y)).add(N(P.xy).r.mul(bw.z));
  const hy = N(P.yz.add(0.37)).g.mul(bw.x).add(N(P.xz.add(0.37)).g.mul(bw.y)).add(N(P.xy.add(0.37)).g.mul(bw.z));
  // stage 6 detail normal: a second, 4x finer octave that only shows within ~4 m (pores, weave threads, fur strands)
  const P2 = W.mul(o.freq * 4.0), dK = HIQ.mul(charQ).mul(fadeAt(1.5, 4.5));
  const dx2 = N(P2.yz).b.mul(bw.x).add(N(P2.xz).b.mul(bw.y)).add(N(P2.xy).b.mul(bw.z)), dy2 = N(P2.yz.add(0.61)).r.mul(bw.x).add(N(P2.xz.add(0.61)).r.mul(bw.y)).add(N(P2.xy.add(0.61)).r.mul(bw.z));
  const wn = normalize(CN.add(vec3(hx, hy, float(1).sub(hx)).sub(0.5).mul(o.bump).mul(cfade)).add(vec3(dx2, dy2, float(1).sub(dx2)).sub(0.5).mul(o.bump * 0.6).mul(dK)));
  let n = normalize(mix(normalView, normalize(cameraViewMatrix.mul(vec4(wn, 0)).xyz), cfade.mul(0.6).mul(o.gear ? float(1).sub(gM) : 1)));
  if (o.gear) n = mix(n, bumpFrom(gP.x.mul(o.gear > 1.5 ? 0.012 : 0.006).mul(gF)), step(0.01, gF));
  if (dH) n = normalize(n.add(bumpFrom(dH.mul(CDET_BUMP[kind] || 0.004)).sub(normalView)));
  m.normalNode = n;
  // rim / sheen / subsurface: added as emissive so it rides on top of the PBR result
  const V = positionViewDirection.negate(), fr = pow(float(1).sub(clamp(dot(normalView, V.negate()).abs(), 0, 1)), 3.0);
  const Lv = normalize(cameraViewMatrix.mul(vec4(lDir, 0)).xyz), nl = dot(normalView, Lv);
  const wrap = max(0.0, nl.add(0.45).div(1.45)).sub(max(0.0, nl));
  // the rim and the base skin scatter are emissive, so they used to glow at full strength at night and in the cave
  // (hill giants read as flat orange segments). They now scale with the light reaching the scene (ambK, 1 at noon),
  // as the WebGL character shader does since eea075c. ?giantglow keeps the old behaviour.
  const rim = vec3(0.85, 0.92, 1.0).mul(fr).mul(o.rim).mul(col.mul(o.sheen ? 1.6 : 0.6).add(0.4)).mul(0.35).mul(ambK);
  const sss = col.mul(vec3(1.0, 0.42, 0.28)).mul(skin).mul(fr.mul(0.25).add(0.18)).mul(0.35).mul(ambK)
    .add(col.mul(lCol).mul(lK).mul(skin).mul(vec3(0.9, 0.35, 0.22)).mul(wrap).mul(0.55));
  const cloth = o.sheen ? vec3(0) : col.mul(lCol).mul(lK).mul(float(1).sub(skin)).mul(fr).mul(max(0.0, nl.add(0.25))).mul(0.35);
  let extra = vec3(0);
  if (o.sheen && !o.sss) {   // fur: Kajiya-Kay strand highlight along the hair direction (the WebGL shader has it too)
    const Tv0 = normalize(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz), Tv = normalize(Tv0.sub(normalView.mul(dot(Tv0, normalView))).add(1e-4));
    const Hh = normalize(Lv.add(V.negate())), th = dot(Tv, Hh), kk = pow(max(float(1).sub(th.mul(th)), 0.0).sqrt(), 24.0);
    extra = col.mul(lCol).mul(lK).mul(kk).mul(0.35).mul(max(0.0, nl.add(0.3)));
  }
  if (o.sss > 0.5) {   // skin: thin edges (ears, fingers, nose) glow red when backlit by the sun
    const back = pow(max(0.0, dot(V, Lv)), 4.0).mul(fr);
    extra = extra.add(col.mul(lCol).mul(lK).mul(skin).mul(vec3(1.0, 0.45, 0.3)).mul(back).mul(0.6).mul(cd.mul(0.5).add(0.5)));
  }
  m.emissiveNode = rim.add(sss).add(cloth).add(extra).mul(charQ);
}

// ---------------- stage 9: close-up character / monster surface detail ----------------
const CDET_ON = !/nochardetail/.test(location.search), CDET = uniform(CDET_ON ? 1 : 0);
const CDET_BUMP = { skin: 0.0025, fur: 0.006, scale: 0.008, chitin: 0.006, bone: 0.005, metal: 0.0015, hide: 0.004 };
function charKind(o) {
  if (o.gear) return null;   // chain / plate already carry their own pattern
  if (o.sheen) return o.sss > 0 ? 'hide' : 'fur';
  if (o.metal >= 0.8) return 'metal';
  if (o.metal >= 0.1 && o.rough < 0.5) return 'scale';
  if (o.rough <= 0.32) return 'chitin';
  if (o.sss === 0 && o.rough > 0.55) return 'bone';
  return 'skin';
}
function charDetail(kind, p, skin) {   // -> { alb: vec3 multiplier, h: height 0..1, ao, rough: offset }
  const a = atan(p.x, p.z), uv = vec2(a.mul(0.16), p.y);
  if (kind === 'fur' || kind === 'hide') {
    const s = gNoise(vec2(a.mul(kind === 'fur' ? 70.0 : 30.0), p.y.mul(9.0))).mul(0.6).add(gNoise(vec2(a.mul(170.0), p.y.mul(22.0))).mul(0.4));
    const clump = gNoise(vec2(a.mul(12.0), p.y.mul(3.2)));
    const k = kind === 'fur' ? 1.0 : 0.5;
    return { alb: vec3(s.mul(0.34 * k).add(1.0 - 0.17 * k).mul(clump.mul(0.18 * k).add(1.0 - 0.09 * k))), h: s.mul(0.7).add(clump.mul(0.3)), ao: mix(float(1.0), s.mul(0.35).add(0.65), k), rough: s.sub(0.5).mul(0.08) };
  }
  if (kind === 'scale') {   // overlapping scales: offset rows, a rounded leading edge and a dark lip under the next row
    const c = uv.mul(vec2(70.0, 26.0)), row = floor(c.y), cc = vec2(c.x.add(mod(row, 2.0).mul(0.5)), c.y), ci = floor(cc), f = fract(cc);
    const d = length(vec2(f.x.sub(0.5), f.y.mul(0.9)));
    const h = float(1).sub(smoothstep(0.3, 0.62, d)), lip = smoothstep(0.42, 0.62, d), v = gHash(ci);
    return { alb: vec3(v.mul(0.22).add(0.88)).mul(float(1).sub(lip.mul(0.3))), h, ao: float(1).sub(lip.mul(0.45)), rough: lip.mul(0.15).sub(h.mul(0.08)) };
  }
  if (kind === 'chitin') {   // segment plates with seams, faint pitting
    const band = fract(p.y.mul(7.0).add(gNoise(uv.mul(6.0)).mul(0.25))), seam = smoothstep(0.0, 0.07, band).mul(smoothstep(1.0, 0.9, band));
    const pit = smoothstep(0.78, 0.9, gNoise(uv.mul(120.0)));
    return { alb: vec3(seam.mul(0.35).add(0.65)).mul(float(1).sub(pit.mul(0.15))), h: seam.sub(pit.mul(0.4)), ao: seam.mul(0.4).add(0.6), rough: float(1).sub(seam).mul(0.25).add(pit.mul(0.1)) };
  }
  if (kind === 'bone') {   // porous pits and hairline cracks
    const crack = float(1).sub(smoothstep(0.0, 0.035, abs(gNoise(uv.mul(vec2(40.0, 18.0))).sub(0.5))));
    const pit = smoothstep(0.7, 0.88, gNoise(uv.mul(160.0)));
    return { alb: vec3(float(1).sub(crack.mul(0.35)).sub(pit.mul(0.12))).mul(gNoise(uv.mul(9.0)).mul(0.12).add(0.94)), h: float(1).sub(crack).sub(pit.mul(0.5)), ao: float(1).sub(crack.mul(0.5)).sub(pit.mul(0.2)), rough: crack.mul(0.15) };
  }
  if (kind === 'metal') {   // fine scratches along one direction, some cross-hatched
    const sc = smoothstep(0.92, 0.99, gNoise(vec2(a.mul(900.0), p.y.mul(8.0)))).add(smoothstep(0.94, 0.995, gNoise(vec2(a.mul(30.0).add(p.y.mul(300.0)), p.y.mul(30.0)))));
    return { alb: vec3(sc.mul(0.12).add(1.0)), h: sc, ao: float(1.0), rough: sc.mul(0.22) };
  }
  // skin and cloth (the default character material carries both, split by the skin-tone test)
  const mott = gNoise(uv.mul(14.0)), pore = gNoise(uv.mul(520.0)), freck = smoothstep(0.82, 0.92, gNoise(uv.mul(90.0)));
  const skinA = mix(vec3(1.0), vec3(1.05, 0.95, 0.94), mott).mul(float(1).sub(freck.mul(0.1)));
  const w = vec2(a.mul(160.0), p.y.mul(110.0)), wx = sin(w.x).mul(0.5).add(0.5), wy = sin(w.y).mul(0.5).add(0.5);
  const weave = mix(wx, wy, step(0.5, fract(floor(w.x.div(3.1416)).add(floor(w.y.div(3.1416))).mul(0.5)))), lint = gNoise(uv.mul(60.0));
  const clothA = vec3(weave.mul(0.12).add(0.9).mul(lint.mul(0.1).add(0.95)));
  return { alb: mix(clothA, skinA, skin), h: mix(weave.mul(0.7).add(lint.mul(0.3)), pore.mul(0.6).add(mott.mul(0.4)), skin), ao: mix(weave.mul(0.18).add(0.82), float(1.0).sub(pore.mul(0.08)), skin),
    rough: mix(lint.sub(0.5).mul(0.06), pore.sub(0.5).mul(0.18).add(mott.sub(0.5).mul(0.1)), skin) };
}

function gearNodes(m) {
  const gk = uniform(m.userData.gk ? m.userData.gk.value : 0); m.userData.gkU = gk;
  const gF = charQ.mul(fadeAt(8, 22)), gP = gearPat(positionLocal, gk);
  const base = m.color.clone();
  m.colorNode = uniform(base).mul(mix(1.0, gP.y, gF));
  m.userData.gearBase = m.colorNode;
  m.roughnessNode = mix(float(m.roughness), gP.w, gF);
  m.metalnessNode = select(gk.greaterThan(0.5).and(gk.lessThan(2.5)), mix(float(m.metalness), mix(0.15, 0.85, gP.z), gF), float(m.metalness));
  m.normalNode = mix(normalView, bumpFrom(gP.x.mul(select(gk.greaterThan(1.5).and(gk.lessThan(2.5)), 0.012, 0.006)).mul(gF)), step(0.01, gF));
  m.userData.gearColorU = base;
}

const done = new WeakSet();
const gearMats = [];
export function upgradeMaterial(m, obj) {
  if (!m || done.has(m) || m.isNodeMaterial) return; done.add(m);
  const key = typeof m.customProgramCacheKey === 'function' && m.onBeforeCompile && m.onBeforeCompile.toString().length > 30 ? String(m.customProgramCacheKey()) : '';
  try {
    if (key.startsWith('foliage-std-lod-')) {
      let k = key.slice(16), ring = k.endsWith('r'); if (ring) k = k.slice(0, -1);
      foliageNodes(m, parseFloat(k.slice(0, -1)), ring, obj && obj.isInstancedMesh);
    } else if (key === 'buildmat-v1') buildNodes(m);
    else if (key.startsWith('char-')) { const [rough, metal, bump, freq, rim, sss, sheen, gear] = key.slice(5).split(',').map(Number); charNodes(m, { rough, metal, bump, freq, rim, sss, sheen, gear }); }
    else if (key === 'gear') { gearNodes(m); gearMats.push(m); }
    else if (key === 'tree-depth-sway') return;
    if (m.userData.noiseBump != null && !m.normalNode) noiseBumpNodes(m, m.userData.noiseBump);
  } catch (e) { console.warn('[webgpu] material upgrade skipped', key, e); }
  m.needsUpdate = true;
}
export function markUpgraded(m) { done.add(m); }
export function upgradeShared() {
  for (const m of [vcMat, buildMat, foliageMat, treeMat]) upgradeMaterial(m);
  for (const k of ['charMat', 'furMat', 'scaleMat', 'chitinMat', 'metalMat', 'boneMat', 'plateCharMat', 'chainCharMat', 'hideMat']) if (ANAT[k] && ANAT[k].isMaterial) upgradeMaterial(ANAT[k]);
}
export function upgradeScene(root) {
  root.traverse(o => {
    if (o.customDepthMaterial) o.customDepthMaterial = undefined;   // node materials cast shadows with their own sway/alpha
    const mm = o.material; if (!mm) return;
    if (Array.isArray(mm)) mm.forEach(x => upgradeMaterial(x, o)); else upgradeMaterial(mm, o);
  });
}
const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const AMB_NOON = lum(new THREE.Color(0xffdcae)) + 0.6 * lum(new THREE.Color(0xcfe4ff));
const GIANT_GLOW = typeof location !== 'undefined' && /giantglow/.test(location.search);
export function tickNodeMats() {
  charQ.value = CHAR.q.value; lK.value = DAY.dirK ?? 1;
  // received-light level relative to noon: sun/moon plus sky fill, dimmed in the cave
  const g = typeof window !== 'undefined' ? window.gielinor : null, cave = g ? Math.min(1, g.caveK || 0) : 0;
  const now = lum(DAY.lightCol) * (DAY.dirK ?? 1) + 0.6 * lum(DAY.hemiCol) * (DAY.hemiK ?? 1);
  ambK.value = GIANT_GLOW ? 1 : Math.min(1, Math.max(0.08, now / AMB_NOON)) * (1 - 0.7 * cave);
  for (const m of gearMats) { if (m.userData.gk) m.userData.gkU.value = m.userData.gk.value; m.userData.gearColorU.copy(m.color); }
}
