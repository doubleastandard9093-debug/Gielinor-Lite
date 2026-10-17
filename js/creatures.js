// Detailed creature rigs (built on demand for close monsters): anatomy per type,
// fur / hide / chitin / scale patterns painted into vertex colours, jointed legs,
// and per-spawn variety (size, tint, markings, small part differences).
import * as THREE from 'three';
import { prim, place, paint, snoise, blob } from './models.js';
import { lathe, seeded, skinPaint, buildHumanoidRig, bakeList, charMat, furMat, scaleMat, chitinMat, hideMat, boneMat, attachHeld, plateCharMat, chainCharMat } from './anatomy.js';
let MAT = null;

const C = h => new THREE.Color(h);
const sq = (g, x, y, z) => { g.scale(x, y, z); return g; };
const dk = (h, k) => C(h).multiplyScalar(k).getHex();
const lt = (h, l) => C(h).offsetHSL(0, 0, l).getHex();
// Lathe that runs along +z (front) instead of y.
const latheZ = (prof, seg = 18) => { const g = lathe(prof, seg); g.rotateX(Math.PI / 2); return g; };
// Roughen a surface outward (fur tufts, lumpy hide).
function shag(g, amt, freq, seed = 0) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = amt * (0.5 + 0.5 * snoise(x * freq, y * freq, z * freq, seed)) * (0.6 + 0.4 * Math.abs(Math.sin(x * freq * 3.1 + z * freq * 2.3)));
    p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
// Fur: dorsal dark, belly light, fine strand streaks along the body.
function furPaint(g, base, belly, seed, { stripes = 0, saddle = 0 } = {}) {
  const B = C(base), L = C(belly), S = C(base).multiplyScalar(0.55), c = new THREE.Color();
  g.computeBoundingBox(); const bb = g.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y);
  return paint(g, (x, y, z, nx, ny) => {
    const up = (y - bb.min.y) / h;
    c.copy(L).lerp(B, Math.min(1, Math.max(0, up * 1.6 - 0.25 + 0.2 * snoise(x * 5, y * 5, z * 5, seed))));
    if (saddle && ny > 0.5) c.lerp(S, saddle * (ny - 0.5) * 2);
    if (stripes) c.multiplyScalar(1 - stripes * Math.max(0, Math.sin(z * 18 + snoise(x * 4, y * 4, z * 4, seed) * 3)));
    const strand = 0.86 + 0.22 * snoise(x * 60, y * 9, z * 60, seed + 1) + 0.08 * snoise(x * 140, y * 140, z * 30, seed + 2);
    return c.multiplyScalar(strand * (0.85 + 0.3 * up));
  });
}
// Scales: hexagonal-ish cells with dark seams and lighter rims.
function scalePaint(g, base, belly, seed, size = 26) {
  const B = C(base), L = C(belly), c = new THREE.Color();
  g.computeBoundingBox(); const bb = g.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y);
  return paint(g, (x, y, z, nx, ny) => {
    const u = x * size + Math.floor(y * size) * 0.5, v = y * size + z * size * 0.5;
    const cell = Math.abs(Math.sin(u * Math.PI) * Math.sin(v * Math.PI));
    c.copy(ny < -0.3 ? L : B).multiplyScalar(0.62 + 0.5 * Math.pow(cell, 0.35));
    c.offsetHSL(0.02 * snoise(x * 3, y * 3, z * 3, seed), 0, 0.04 * snoise(x * 9, y * 9, z * 9, seed));
    return c.multiplyScalar(0.75 + 0.3 * (y - bb.min.y) / h);
  });
}
function chitinPaint(g, base, mark, seed, pattern) {
  const B = C(base), M = C(mark), c = new THREE.Color();
  return paint(g, (x, y, z, nx, ny) => {
    c.copy(B).multiplyScalar(0.7 + 0.45 * Math.max(0, ny) + 0.1 * snoise(x * 30, y * 30, z * 30, seed));
    if (pattern === 'hourglass' && ny > 0.3 && Math.abs(x) < 0.12 - Math.abs(Math.abs(z + 0.5) - 0.12) * 0.7) c.lerp(M, 0.9);
    if (pattern === 'bands' && Math.sin(z * 22) > 0.55 && ny > -0.2) c.lerp(M, 0.75);
    if (pattern === 'spots' && snoise(x * 9, y * 9, z * 9, seed) > 0.55 && ny > 0) c.lerp(M, 0.85);
    // bristle speckle
    if (snoise(x * 120, y * 120, z * 120, seed) > 0.7) c.multiplyScalar(1.35);
    return c;
  });
}
const eye = (r, iris, out, x, y, z, slit = false) => {
  out.push(place(paint(prim.sphere(r, 10, 8), () => iris), x, y, z));
  out.push(place(paint(sq(prim.sphere(r * 0.5, 8, 6), slit ? 0.3 : 1, 1, 0.6), () => 0x050505), x, y, z + r * 0.75));
  out.push(place(paint(prim.sphere(r * 0.18, 6, 4), () => 0xffffff), x + r * 0.3, y + r * 0.35, z + r * 0.85));
};
function meshOf(geos, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(bakeList(geos), MAT || charMat); m.castShadow = true; m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m; }

// A two-joint leg: pivot (hip/shoulder) > knee > paw. Returns pivot with userData.knee.
function jointLeg(parent, x, y, z, upper, lower, paw, kneeY, rest = 0, kneeRest = 0) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  meshOf(upper, pivot);
  const knee = new THREE.Group(); knee.position.y = kneeY; knee.rotation.x = kneeRest; pivot.add(knee);
  meshOf([...lower, ...paw], knee);
  pivot.rotation.x = rest; pivot.userData.knee = knee; pivot.userData.kneeRest = kneeRest; pivot.userData.rest = rest;
  return pivot;
}

// ---- per-type builders -------------------------------------------------------
function wolf(v) {
  const r = v.rng, root = new THREE.Group(), base = v.color, belly = lt(base, 0.18), s = v.seed;
  const fur = (g, k = 0.035) => furPaint(shag(g, k, 9, s), base, belly, s, { saddle: v.saddle });
  const body = [];
  body.push(place(fur(sq(latheZ([[0, 0.5], [0.16, 0.46], [0.26, 0.34], [0.29, 0.14], [0.25, -0.1], [0.2, -0.3], [0.17, -0.44], [0, -0.5]], 22), 0.82, 1.1, 1)), 0, 0.82, 0));
  body.push(place(fur(sq(blob(0.26, 0.27, 0.22, { detail: 3, lump: 0.1, seed: s }), 1, 1, 1), 0.07), 0, 0.92, 0.38)); // neck ruff
  const head = new THREE.Group(); head.position.set(0, 1.08, 0.58); root.add(head);
  const hd = [];
  hd.push(fur(sq(blob(0.17, 0.15, 0.17, { detail: 3, lump: 0.05, seed: s + 1 }), 1, 1, 1), 0.02));
  hd.push(place(furPaint(latheZ([[0, 0.3], [0.035, 0.29], [0.06, 0.22], [0.085, 0.1], [0.1, 0.0], [0, -0.02]], 14), lt(base, 0.05), belly, s), 0, -0.05, 0.12));
  hd.push(place(paint(sq(prim.sphere(0.035, 10, 8), 1.2, 0.8, 1), () => 0x141414), 0, -0.01, 0.42));
  hd.push(place(paint(prim.box(0.1, 0.008, 0.2), () => 0x221a18), 0, -0.1, 0.27));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) hd.push(place(paint(prim.cone(0.009, 0.035, 5), () => 0xf0ead8), sx * (0.025 + i * 0.012), -0.11, 0.33 - i * 0.05, Math.PI));
    eye(0.024, v.eye, hd, sx * 0.075, 0.05, 0.14, false);
    hd.push(place(paint(sq(prim.cone(0.065, 0.2 * v.earK, 6), 1, 1, 0.45), () => base), sx * 0.1, 0.18, -0.02, -0.15, 0, sx * -0.2));
    hd.push(place(paint(sq(prim.cone(0.035, 0.13 * v.earK, 5), 1, 1, 0.3), () => 0xc89a8a), sx * 0.1, 0.17, 0.0, -0.15, 0, sx * -0.2));
  }
  if (v.scar) hd.push(place(paint(prim.box(0.012, 0.11, 0.03), () => 0xd8a8a0), 0.06, 0.06, 0.15, 0, 0, 0.5));
  meshOf(hd, head);
  // tail: bushy, hanging back
  const tail = latheZ([[0, 0.04], [0.06, 0], [0.1, -0.15], [0.11, -0.32], [0.07, -0.48], [0, -0.55]], 12);
  tail.rotateX(-0.7 * v.tailUp);
  const bodyG = new THREE.Group(); root.add(bodyG); meshOf(body, bodyG);
  // separate pivot so the tail can swing with secondary motion
  const tailG = new THREE.Group(); tailG.position.set(0, 0.92, -0.5); bodyG.add(tailG); meshOf([fur(tail, 0.04)], tailG);
  const legs = [];
  for (const [x, z, front] of [[0.15, 0.3, 1], [-0.15, 0.3, 1], [0.15, -0.3, 0], [-0.15, -0.3, 0]]) {
    const up = [fur(lathe([[0, 0.06], [0.08, 0.04], [0.085, -0.08], [0.06, -0.22], [0.045, -0.3], [0, -0.32]], 12), 0.02)];
    const lo = [furPaint(lathe([[0, 0.02], [0.04, 0], [0.038, -0.15], [0.032, -0.25], [0, -0.27]], 10), base, belly, s)];
    const paw = [place(paint(sq(prim.sphere(0.05, 10, 8), 1, 0.55, 1.3), () => dk(base, 0.6)), 0, -0.27, 0.02)];
    for (let t = -1.5; t <= 1.5; t++) paw.push(place(paint(sq(prim.sphere(0.018, 6, 4), 1, 0.8, 1.2), () => dk(base, 0.5)), t * 0.022, -0.28, 0.065));
    legs.push(jointLeg(root, x, 0.6, z, up, lo, paw, -0.3, front ? 0.05 : -0.25, front ? -0.05 : 0.45));
  }
  return { root, legs, head, tail: tailG };
}
function cow(v) {
  const root = new THREE.Group(), s = v.seed;
  const W = C(v.hideA), B = C(v.hideB), cc = new THREE.Color();
  const hide = g => paint(g, (x, y, z, nx, ny) => (snoise(x * v.spotF + s, y * v.spotF, z * v.spotF, s) > v.spotT ? cc.copy(B) : cc.copy(W)).multiplyScalar((0.76 + 0.28 * (0.5 + ny * 0.5)) * (0.94 + 0.08 * snoise(x * 70, y * 70, z * 70, s))));
  const body = [];
  body.push(place(hide(sq(latheZ([[0, 0.85], [0.3, 0.78], [0.44, 0.55], [0.48, 0.2], [0.47, -0.2], [0.44, -0.6], [0.32, -0.82], [0, -0.88]], 26), 1, 0.92, 1)), 0, 1.0, 0));
  body.push(place(hide(sq(prim.sphere(0.2, 14, 10), 1.5, 0.6, 1)), 0, 1.38, -0.65)); // hip bones
  body.push(place(skinPaint(sq(prim.sphere(0.15, 14, 10), 1, 0.7, 1.1), 0xe8a8a0, { mottle: 0.06 }), 0, 0.6, -0.35));
  for (const [x, z] of [[-0.06, -0.3], [0.06, -0.3], [-0.06, -0.42], [0.06, -0.42]]) body.push(place(skinPaint(prim.cone(0.025, 0.08, 6), 0xd89890), x, 0.49, z, Math.PI));
  const tail = lathe([[0, 0], [0.03, -0.02], [0.022, -0.6], [0, -0.62]], 8);
  const tuft = place(skinPaint(blob(0.05, 0.1, 0.05, { detail: 2, lump: 0.3, seed: s }), dk(v.hideB, 1)), 0, -0.62, 0);
  const bodyG = new THREE.Group(); root.add(bodyG); meshOf(body, bodyG);
  const tailG = new THREE.Group(); tailG.position.set(0, 1.25, -0.86); tailG.rotation.x = 0.15; bodyG.add(tailG); meshOf([hide(tail), tuft], tailG);
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.9); root.add(head);
  const hd = [hide(sq(latheZ([[0, 0.12], [0.14, 0.08], [0.2, -0.05], [0.18, -0.2], [0, -0.24]], 16), 1, 1.05, 1))];
  hd.push(place(skinPaint(sq(prim.sphere(0.15, 14, 10), 1.1, 0.8, 0.85), 0xe8b0a0, { mottle: 0.1 }), 0, -0.14, 0.24));
  for (const sx of [-1, 1]) {
    hd.push(place(paint(sq(prim.sphere(0.025, 6, 4), 1, 1.4, 0.6), () => 0x3a2020), sx * 0.06, -0.12, 0.37));
    eye(0.032, 0x2a1a10, hd, sx * 0.15, 0.05, 0.05);
    hd.push(place(hide(sq(prim.sphere(0.07, 10, 6), 1.5, 0.55, 0.9)), sx * 0.24, 0.08, -0.08, 0, 0, sx * -0.3));
    if (v.horns) hd.push(place(skinPaint(prim.cone(0.035, 0.2 * v.horns, 8), 0xe0d8c0), sx * 0.15, 0.2, -0.05, 0, 0, sx * -0.7));
  }
  meshOf(hd, head);
  const legs = [];
  for (const [x, z, front] of [[0.27, 0.48, 1], [-0.27, 0.48, 1], [0.27, -0.55, 0], [-0.27, -0.55, 0]]) {
    const up = [hide(lathe([[0, 0.08], [0.12, 0.05], [0.12, -0.12], [0.08, -0.3], [0, -0.33]], 12))];
    const lo = [hide(lathe([[0, 0.02], [0.065, 0], [0.06, -0.22], [0.07, -0.27], [0, -0.3]], 10))];
    const hoof = [place(paint(prim.cyl(0.07, 0.08, 0.09, 10), () => 0x2a2420), 0, -0.33, 0), place(paint(prim.box(0.012, 0.09, 0.08), () => 0x111111), 0, -0.33, 0.04)];
    legs.push(jointLeg(root, x, 0.75, z, up, lo, hoof, -0.32, 0, front ? 0 : 0.1));
  }
  return { root, legs, head };
}
function spider(v) {
  const root = new THREE.Group(), s = v.seed, base = v.color;
  const bodyG = new THREE.Group(); root.add(bodyG);
  const b = [];
  b.push(place(chitinPaint(shag(sq(blob(0.48, 0.38, 0.56, { detail: 3, lump: 0.05, seed: s }), 1, 1, 1), 0.02, 18, s), base, v.mark, s, v.pattern), 0, 0.75, -0.55));
  b.push(place(chitinPaint(sq(blob(0.28, 0.2, 0.32, { detail: 3, lump: 0.04, seed: s + 1 }), 1, 1, 1), dk(base, 0.85), v.mark, s, null), 0, 0.62, 0.18));
  b.push(place(chitinPaint(prim.cyl(0.07, 0.1, 0.12, 10), dk(base, 0.7), v.mark, s, null), 0, 0.66, -0.12, Math.PI / 2));
  // eight eyes in two rows
  for (const [x, y, r] of [[0.06, 0.74, 0.042], [-0.06, 0.74, 0.042], [0.13, 0.72, 0.03], [-0.13, 0.72, 0.03], [0.04, 0.79, 0.022], [-0.04, 0.79, 0.022], [0.1, 0.78, 0.018], [-0.1, 0.78, 0.018]]) {
    b.push(place(paint(prim.sphere(r, 10, 8), () => v.eye), x, y, 0.46 - Math.abs(x) * 0.6));
    b.push(place(paint(prim.sphere(r * 0.3, 6, 4), () => 0xffffff), x + r * 0.3, y + r * 0.4, 0.46 - Math.abs(x) * 0.6 + r * 0.8));
  }
  for (const sx of [-1, 1]) { // chelicerae and fangs, pedipalps
    b.push(place(chitinPaint(sq(prim.sphere(0.06, 10, 8), 1, 1.4, 1), dk(base, 0.8), v.mark, s), sx * 0.05, 0.56, 0.46));
    b.push(place(paint(prim.cone(0.022, 0.12, 6), () => 0x0e0a08), sx * 0.05, 0.45, 0.5, Math.PI - 0.3));
    b.push(place(chitinPaint(prim.capsule(0.025, 0.18, 2, 8), base, v.mark, s), sx * 0.13, 0.55, 0.5, 0.9, 0, sx * 0.3));
  }
  meshOf(b, bodyG);
  const legs = [];
  [-0.0, 0.1, 0.2, 0.3].forEach((lz, i) => {
    for (const side of [1, -1]) {
      const a = (i - 1.5) * 0.45 * side;
      const hip = new THREE.Group(); hip.position.set(side * 0.18, 0.66, lz); hip.rotation.y = side * Math.PI / 2 - a * side + (side > 0 ? 0 : Math.PI) * 0; root.add(hip);
      hip.rotation.set(0, (side > 0 ? 1 : -1) * (Math.PI / 2 + (i - 1.5) * 0.4), 0);
      const swing = new THREE.Group(); hip.add(swing); // swing pivot rotates about local x
      const seg = (len, r) => chitinPaint(shag(lathe([[0, 0.02], [r, 0], [r * 1.1, -len * 0.5], [r * 0.8, -len], [0, -len - 0.02]], 9), 0.006, 60, s), base, v.mark, s, v.legBands ? 'bands' : null);
      // femur goes up-out, then tibia down, metatarsus to the ground
      const femur = new THREE.Group(); femur.rotation.x = -2.3; swing.add(femur); meshOf([seg(0.5 * v.legK, 0.04)], femur);
      const knee = new THREE.Group(); knee.position.y = -0.5 * v.legK; knee.rotation.x = 1.6; femur.add(knee); meshOf([seg(0.55 * v.legK, 0.032)], knee);
      const ankle = new THREE.Group(); ankle.position.y = -0.55 * v.legK; ankle.rotation.x = 0.55; knee.add(ankle); meshOf([seg(0.32 * v.legK, 0.022)], ankle);
      swing.userData.knee = knee; swing.userData.kneeRest = 1.6; swing.userData.spider = true;
      legs.push(swing);
    }
  });
  return { root, legs, head: null };
}
function dragon(v) {
  const root = new THREE.Group(), s = v.seed, base = v.color, belly = v.belly;
  const sc = (g, size) => scalePaint(g, base, belly, s, size);
  const body = [];
  body.push(place(sc(sq(latheZ([[0, 1.0], [0.3, 0.9], [0.5, 0.55], [0.58, 0.1], [0.52, -0.4], [0.38, -0.85], [0, -1.0]], 30), 0.95, 1.0, 1), 22), 0, 1.05, 0));
  // belly plates
  for (let i = 0; i < 9; i++) body.push(place(paint(sq(prim.cyl(0.4 - Math.abs(i - 3) * 0.03, 0.4, 0.13, 16, 1), 1, 1, 0.5), () => dk(belly, 0.9 + (i % 2) * 0.12)), 0, 0.56 + Math.abs(i - 3) * 0.02, 0.7 - i * 0.18, Math.PI / 2));
  // neck in segments rising to the head
  for (let i = 0; i < 5; i++) body.push(place(sc(sq(prim.sphere(0.24 - i * 0.015, 16, 12), 1, 1, 1.2), 30), 0, 1.25 + i * 0.17, 0.85 + i * 0.13));
  // tail tapering behind with a spade tip
  for (let i = 0; i < 8; i++) body.push(place(sc(sq(prim.sphere(0.24 - i * 0.026, 14, 10), 1, 0.9, 1.6), 30), 0, 1.0 - i * 0.07, -0.95 - i * 0.24));
  body.push(place(paint(sq(prim.cone(0.16, 0.3, 4), 1, 0.25, 1), () => dk(base, 0.7)), 0, 0.48, -2.95, -Math.PI / 2));
  // dorsal spines from neck to tail
  for (let i = 0; i < 16; i++) { const z = 1.4 - i * 0.24, y = i < 4 ? 1.95 - i * 0.12 : 1.55 - (i - 4) * 0.08; body.push(place(paint(prim.cone(0.05, 0.22 - Math.abs(i - 5) * 0.008, 6), () => v.horn), 0, y, z, -0.4)); }
  const bodyG = new THREE.Group(); root.add(bodyG); meshOf(body, bodyG);
  // head with jaw, nostrils, horns, frills
  const head = new THREE.Group(); head.position.set(0, 2.05, 1.55); root.add(head);
  const hd = [sc(sq(latheZ([[0, 0.25], [0.16, 0.2], [0.22, 0.0], [0.2, -0.18], [0, -0.22]], 18), 1, 0.85, 1), 34)];
  hd.push(place(sc(sq(latheZ([[0, 0.3], [0.08, 0.27], [0.13, 0.1], [0.15, -0.05], [0, -0.1]], 14), 1, 0.7, 1), 40), 0, -0.02, 0.32));
  hd.push(place(sc(sq(latheZ([[0, 0.26], [0.07, 0.23], [0.11, 0.05], [0.12, -0.05], [0, -0.08]], 14), 1, 0.45, 1), 40), 0, -0.13, 0.28, 0.12));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) hd.push(place(paint(prim.cone(0.012, 0.05, 5), () => 0xf0e8d0), sx * 0.08, -0.09, 0.5 - i * 0.07, Math.PI));
    hd.push(place(paint(sq(prim.sphere(0.022, 6, 4), 1.4, 1, 1), () => 0x0a0a0a), sx * 0.05, 0.03, 0.6));
    eye(0.04, v.eye, hd, sx * 0.14, 0.08, 0.12, true);
    hd.push(place(paint(sq(prim.box(0.1, 0.03, 0.06), 1, 1, 1), () => dk(base, 0.6)), sx * 0.13, 0.13, 0.13, 0, 0, sx * -0.3));
    for (let k = 0; k < v.hornN; k++) { // curved horns from segments
      let y = 0.18, z = -0.08 - k * 0.08, x = sx * (0.12 + k * 0.04);
      for (let j = 0; j < 4; j++) { const r = (0.05 - j * 0.01) * (1 - k * 0.25); hd.push(place(paint(prim.cyl(r * 0.8, r, 0.14, 8), () => lt(v.horn, -j * 0.04)), x, y, z, -0.9 - j * 0.25, 0, sx * -0.25)); y += 0.09 - j * 0.015; z -= 0.08 + j * 0.02; }
    }
    hd.push(place(paint(sq(prim.wing(sx), 0.25, 0.3, 1), () => dk(v.membrane, 1)), sx * 0.16, 0.0, -0.12, 0, sx * 0.9, 0));
  }
  meshOf(hd, head);
  // wings: arm bone + finger struts + membrane panels
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.35, 1.55, 0.3); root.add(w);
    const wg = [];
    const bone = (x1, y1, z1, x2, y2, z2, r) => { const a = new THREE.Vector3(x1, y1, z1), b2 = new THREE.Vector3(x2, y2, z2), d = b2.clone().sub(a), L = d.length(); const g = prim.cyl(r * 0.7, r, L, 8); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(x1, y1, z1); return paint(g, () => dk(base, 0.8)); };
    const S = v.wingK;
    const wrist = [sx * 0.9 * S, 0.55 * S, -0.1];
    wg.push(bone(0, 0, 0, ...wrist, 0.06));
    const tips = [[sx * 2.0 * S, 0.3 * S, -0.5 * S], [sx * 1.8 * S, -0.1 * S, -1.0 * S], [sx * 1.2 * S, -0.35 * S, -1.3 * S]];
    for (const t of tips) wg.push(bone(...wrist, ...t, 0.03));
    // membrane triangles between body, wrist and finger tips
    const pts = [[0, 0, 0], wrist, ...tips, [sx * 0.2, -0.2, -1.2 * S]];
    const pos = [], col = [], M = C(v.membrane), vein = M.clone().multiplyScalar(0.6);
    const tri = (a, b, c) => { for (const q of [a, b, c, a, c, b]) { pos.push(...q); const vv = Math.abs(Math.sin((q[0] + q[2]) * 9)) > 0.92 ? vein : M; col.push(vv.r, vv.g, vv.b); } };
    for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1]);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); mg.computeVertexNormals();
    wg.push(mg);
    wg.push(place(paint(prim.cone(0.03, 0.12, 5), () => v.horn), ...wrist, 0, 0, sx * -1.2));
    meshOf(wg, w).material = hideMat;
    w.rotation.z = sx * 0.25;
    wings.push(w);
  }
  const legs = [];
  for (const [x, z, front] of [[0.4, 0.55, 1], [-0.4, 0.55, 1], [0.42, -0.6, 0], [-0.42, -0.6, 0]]) {
    const up = [sc(lathe([[0, 0.12], [0.2, 0.06], [0.2, -0.15], [0.13, -0.38], [0, -0.42]], 14), 30)];
    const lo = [sc(lathe([[0, 0.02], [0.12, 0], [0.11, -0.25], [0.09, -0.32], [0, -0.35]], 12), 30)];
    const foot = [place(scalePaint(sq(prim.sphere(0.13, 12, 8), 1.1, 0.5, 1.3), base, belly, s, 30), 0, -0.36, 0.05)];
    for (let t = -1; t <= 1; t++) foot.push(place(paint(prim.cone(0.025, 0.12, 6), () => 0x1a1612), t * 0.07, -0.4, 0.2, Math.PI / 2 + 0.3));
    legs.push(jointLeg(root, x, 0.85, z, up, lo, foot, -0.4, front ? 0.1 : -0.3, front ? -0.1 : 0.5));
  }
  return { root, legs, head, wings };
}

// Monster humanoids: per-type anatomy on the shared humanoid rig.
const HUMANOID_LOOK = {
  Goblin: v => ({ bare: true, build: 0.78 * v.k, chest: 0.85, height: 0.95, skin: v.tint, legs: 0x5a4024, belt: 0x3a2414, barefoot: true, hair: null, hairStyle: 'bald', nose: 1.6, jaw: 1.3, eyes: 0xd0b020, mottle: 0.12, curl: 0.9 }),
  'Hill Giant': v => ({ bare: true, build: 1.25 * v.k, chest: 1.2, skin: v.tint, legs: 0x5a4a2a, barefoot: true, hair: v.r() < 0.5 ? null : 0x3a2a1a, hairStyle: 'short', nose: 1.5, jaw: 1.4, mottle: 0.1, stubble: true }),
  'Moss Giant': v => ({ bare: true, build: 1.3 * v.k, chest: 1.25, skin: v.tint, legs: 0x3a5a1a, barefoot: true, hair: 0x3a6a1a, hairStyle: 'curly', nose: 1.5, jaw: 1.4, mottle: 0.2 }),
  'Ice Giant': v => ({ bare: true, build: 1.3 * v.k, chest: 1.25, skin: v.tint, legs: 0x5a7a9a, barefoot: true, hair: 0xe0f0ff, hairStyle: 'spiky', nose: 1.4, jaw: 1.4, mottle: 0.12, eyes: 0x80c0ff }),
  Ogre: v => ({ bare: true, build: 1.35 * v.k, chest: 1.3, skin: v.tint, legs: 0x4a3a1a, barefoot: true, hair: null, nose: 1.7, jaw: 1.6, mottle: 0.15, curl: 0.9 }),
  Grumsh: v => ({ bare: true, build: 1.4, chest: 1.35, skin: v.tint, legs: 0x3a2a14, barefoot: true, hair: null, nose: 1.7, jaw: 1.7, mottle: 0.15, curl: 0.9 }),
  Skeleton: v => ({ bare: true, build: 0.6, chest: 0.8, skin: 0xe8e4d4, legs: 0xd8d4c4, belt: 0x6a5a4a, barefoot: true, hair: null, nose: 0.4, jaw: 1.5, eyes: 0x050505, mottle: 0.2 }),
  Zombie: v => ({ body: v.tint2, sleeveLen: 0.15, build: 0.9, skin: v.tint, legs: 0x3a3a2a, barefoot: v.r() < 0.5, hair: v.r() < 0.5 ? null : 0x4a4a3a, hairStyle: 'long', eyes: 0xd0e060, mottle: 0.25, curl: 1.0 }),
  'Lesser Demon': v => ({ bare: true, build: 1.2, chest: 1.2, skin: v.tint, legs: 0x3a0a0a, barefoot: true, hair: null, nose: 1.2, jaw: 1.5, eyes: 0xffd020, mottle: 0.12, curl: 1.0 }),
  Bandit: v => ({ body: v.tint, build: 0.95 * v.k, legs: 0x3a3028, boots: 0x2a1e14, hair: undefined, eyes: undefined }),
  'Dark Archer': v => ({ body: v.tint, build: 0.9, legs: 0x1e2a1e, boots: 0x1a1a14, hair: null }),
  'Black Knight': v => ({ body: 0x24242c, sleeve: 0x2a2a34, sleeveLen: 0.7, build: 1.1, legs: 0x1e1e26, boots: 0x18181e, skin: 0xc89a74, hair: null, bootH: 0.3 }),
  Guard: v => ({ body: v.tint, build: 1.05 * v.k, legs: 0x2a2a3a, boots: 0x1e1a16, hair: null, bootH: 0.25 })
};
const CLAWED = /Goblin|Ogre|Grumsh|Demon|Zombie|Skeleton/;
// Body/leg colours of the far (cheap) LOD mesh so it matches the detailed rig it swaps with:
// bare-chested monsters (giants, ogres, goblins, demons) show skin, not a shirt.
export function loColours(typeName, t, seed) {
  const f = HUMANOID_LOOK[typeName]; if (!f) return null;
  const look = f(rollVariant(typeName, t, seed));
  if (!look.bare) return null;
  return { body: look.skin, sleeve: look.skin, legs: look.legs, belt: look.belt };
}

// Variation for one spawn. seed: 0..1. Returns tinted colour, scale factor and type-specific traits.
export function rollVariant(typeName, t, seed) {
  const r = seeded(seed * 1000 + 3);
  const k = 0.92 + r() * 0.18;
  const hs = (r() - 0.5) * 0.05, ls = (r() - 0.5) * 0.14;
  const tint = C(t.skin || (typeName === 'Goblin' ? 0x6aa040 : typeName === 'Hill Giant' ? 0xb08a5a : t.color)).offsetHSL(hs, (r() - 0.5) * 0.15, ls).getHex();
  const color = C(t.color).offsetHSL(hs, (r() - 0.5) * 0.12, ls).getHex();
  const v = { seed: seed * 10, r, k, tint, color, tint2: C(t.color).offsetHSL(r() * 0.1, 0, ls).getHex() };
  if (typeName === 'Wolf') Object.assign(v, { color: [0x7a7a80, 0x6a6058, 0x8a8a90, 0x4a4440, 0x9a8a70][Math.floor(r() * 5)], saddle: r() * 0.8, earK: 0.85 + r() * 0.35, tailUp: 0.5 + r() * 0.8, eye: [0xe8c040, 0xd09a30, 0x9ac0e0][Math.floor(r() * 3)], scar: r() < 0.25 });
  if (typeName === 'Cow') Object.assign(v, [{ hideA: 0xf2efe8, hideB: 0x2a2622 }, { hideA: 0xf2efe8, hideB: 0x7a4a2a }, { hideA: 0x8a5a3a, hideB: 0x5a3a20 }, { hideA: 0xe8e0d0, hideB: 0x4a4440 }][Math.floor(r() * 4)], { spotF: 2 + r() * 3, spotT: -0.1 + r() * 0.5, horns: r() < 0.6 ? 0.7 + r() * 0.6 : 0 });
  if (typeName === 'Giant Spider') Object.assign(v, { mark: [0xc02020, 0xd0a020, 0xe0e0d0, 0x8a2a8a][Math.floor(r() * 4)], pattern: ['hourglass', 'bands', 'spots'][Math.floor(r() * 3)], eye: [0xff2020, 0x101010, 0x20ff60][Math.floor(r() * 3)], legK: 0.9 + r() * 0.25, legBands: r() < 0.5 });
  if (t.shape === 'dragon') Object.assign(v, { belly: C(v.color).offsetHSL(0.08, -0.1, 0.25).getHex(), membrane: C(v.color).offsetHSL(-0.02, 0.05, -0.12).getHex(), horn: [0xd8c890, 0x3a3028, 0xc8b8a0][Math.floor(r() * 3)], eye: [0xffc020, 0xff6020, 0xc0ff40][Math.floor(r() * 3)], hornN: 1 + Math.floor(r() * 2), wingK: 0.9 + r() * 0.25 });
  return v;
}
const NAMED = {
  Goblin: ['Snaggletooth', 'Grubfoot', 'Nix'], Wolf: ['Scarface', 'Old Grey', 'Fang'], Cow: ['Old Bessie', 'Daisy'], 'Giant Spider': ['Widowmaker'],
  'Hill Giant': ['Big Bob'], Zombie: ['Shambling Sid'], Skeleton: ['Rattlebones'], Bandit: ['One-Eye Jack'], 'Moss Giant': ['Mossback'], Ogre: ['Gutbelly']
};
export function namedVariant(typeName, seed) {
  const list = NAMED[typeName]; if (!list) return null;
  const r = seeded(seed * 777 + 11);
  return r() < 0.12 ? list[Math.floor(r() * list.length)] : null;
}

// Skeleton: built from separate bones on the same joint layout as the humanoid rig
// (body > head, shoulder > elbow, hip > knee) so the shared walk/attack poses drive it.
function skeletonRig(v, held) {
  const B = lt(0xe4dcc4, (v.r() - 0.5) * 0.08), D = dk(B, 0.62);
  const bone = g => skinPaint(g, B, { mottle: 0.25, freq: 40, seed: v.seed, ao: 0.3 });
  const darkP = g => paint(g, () => 0x0a0806);
  const mk = (geos, parent) => { const m = new THREE.Mesh(bakeList(geos), boneMat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const longBone = (len, r, knob = 1.5) => [place(bone(prim.cyl(r, r * 0.85, len, 10)), 0, -len / 2, 0), place(bone(prim.sphere(r * knob, 10, 8)), 0, 0, 0), place(bone(sq(prim.sphere(r * knob, 10, 8), 1.3, 0.8, 1)), 0, -len, 0)];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const t = [];
  // spine: stacked vertebrae with spinous processes
  for (let i = 0; i < 13; i++) { const y = 0.86 + i * 0.05; t.push(place(bone(sq(prim.cyl(0.035, 0.035, 0.032, 10), 1.2, 1, 1)), 0, y, -0.06), place(bone(prim.cone(0.015, 0.05, 6)), 0, y, -0.1, -Math.PI / 2 - 0.4)); }
  // ribcage: curved rib pairs, sternum, clavicles
  for (let i = 0; i < 7; i++) {
    const y = 1.36 - i * 0.055, r = 0.13 + Math.sin((i + 1) / 8 * Math.PI) * 0.05;
    for (const sx of [-1, 1]) { const g = new THREE.TorusGeometry(r, 0.012, 5, 14, Math.PI * 0.8); g.deleteAttribute('uv'); g.rotateX(Math.PI / 2); g.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI * 0.7); t.push(place(bone(sq(g, 1, 1, 0.85)), 0, y, -0.07 + r * 0.85, 0.22)); }
  }
  t.push(place(bone(prim.box(0.04, 0.26, 0.02)), 0, 1.24, 0.13, -0.15));
  for (const sx of [-1, 1]) t.push(place(bone(prim.cyl(0.014, 0.012, 0.22, 6)), sx * 0.12, 1.43, 0.03, 0, 0.2 * sx, Math.PI / 2 - sx * 0.15), place(bone(sq(prim.sphere(0.07, 10, 8), 0.4, 1, 0.9)), sx * 0.14, 1.32, -0.11)); // clavicles + shoulder blades
  // pelvis: iliac wings, sacrum, pubic arch
  for (const sx of [-1, 1]) t.push(place(bone(sq(prim.sphere(0.1, 12, 8), 0.45, 0.85, 1)), sx * 0.11, 0.84, -0.02, 0, 0, sx * 0.5));
  { const g = new THREE.TorusGeometry(0.11, 0.022, 6, 14, Math.PI); g.deleteAttribute('uv'); t.push(place(bone(g), 0, 0.76, 0.03, Math.PI / 2 + 0.3, 0, Math.PI)); }
  t.push(place(bone(prim.cone(0.06, 0.14, 8)), 0, 0.8, -0.07, Math.PI));
  t.push(place(paint(prim.box(0.36, 0.05, 0.22), () => dk(v.color || 0x6a5a4a, 0.6)), 0, 0.88, 0)); // tattered belt
  mk(t, body);
  // skull: cranium, cheekbones, eye sockets, nasal cavity, jaw with teeth
  const headG = new THREE.Group(); headG.position.y = 1.5; body.add(headG);
  const h = [...[0, 1, 2].map(i => place(bone(prim.cyl(0.03, 0.03, 0.03, 8)), 0, 0.02 + i * 0.04, -0.04))];
  h.push(place(bone(sq(prim.sphere(0.2, 20, 16), 0.9, 1, 1.08)), 0, 0.3, -0.01));
  for (const sx of [-1, 1]) { h.push(place(darkP(sq(prim.sphere(0.055, 10, 8), 1, 0.9, 0.6)), sx * 0.07, 0.28, 0.165)); h.push(place(paint(prim.sphere(0.013, 6, 4), () => 0xff4020), sx * 0.07, 0.28, 0.17)); h.push(place(bone(sq(prim.sphere(0.04, 8, 6), 1.6, 0.6, 1)), sx * 0.12, 0.22, 0.12)); }
  h.push(place(darkP(prim.cone(0.025, 0.06, 3)), 0, 0.21, 0.19, Math.PI));
  h.push(place(bone(sq(prim.box(0.2, 0.035, 0.16), 1, 1, 1)), 0, 0.12, 0.08));
  for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 1.6; h.push(place(paint(prim.box(0.016, 0.026, 0.014), () => 0xf0ead8), Math.sin(a) * 0.08, 0.155, 0.07 + Math.cos(a) * 0.09), place(paint(prim.box(0.016, 0.022, 0.014), () => 0xe8e0c8), Math.sin(a) * 0.075, 0.18, 0.07 + Math.cos(a) * 0.095)); }
  mk(h, headG);
  // arms: humerus / radius + ulna / carpals with jointed finger bones
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.24, 1.38, -0.02); body.add(pivot);
    mk(longBone(0.32, 0.02), pivot);
    const elbow = new THREE.Group(); elbow.position.y = -0.34; elbow.rotation.x = -0.2; pivot.add(elbow);
    const fa = [...longBone(0.27, 0.012, 1.8).map(g => place(g, 0.015, 0, 0)), ...longBone(0.27, 0.011, 1.6).map(g => place(g, -0.015, 0, 0.01))];
    fa.push(place(bone(sq(prim.sphere(0.03, 8, 6), 1.2, 0.6, 0.8)), 0, -0.29, 0));
    for (let f = 0; f < 5; f++) { const fx = (f - 2) * 0.012 * sx, thumb = f === 0; let y = -0.31;
      for (let k = 0; k < 3; k++) { const L = (thumb ? 0.025 : 0.03) - k * 0.005; fa.push(place(bone(prim.cyl(0.005, 0.004, L, 5)), thumb ? sx * -0.025 : fx, y - L / 2, 0.008 + k * 0.006, 0.15 * k)); y -= L; } }
    mk(fa, elbow);
    attachHeld(elbow, held[sx < 0 ? 0 : 1], boneMat);
    pivot.userData.elbow = elbow; arms.push(pivot);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.12, 0.78, 0); root.add(pivot);
    mk(longBone(0.38, 0.024, 1.6), pivot);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const sh = [...longBone(0.33, 0.02).map(g => place(g, -0.01 * sx, 0, 0)), ...longBone(0.32, 0.01).map(g => place(g, 0.03 * sx, 0, -0.01))];
    sh.push(place(bone(sq(prim.sphere(0.03, 8, 6), 1, 1.1, 0.6)), 0, 0.02, 0.04)); // kneecap
    sh.push(place(bone(sq(prim.sphere(0.04, 8, 6), 1, 0.7, 1.3)), 0, -0.35, -0.02)); // heel
    for (let f = 0; f < 5; f++) sh.push(place(bone(prim.cyl(0.008, 0.006, 0.13, 5)), (f - 2) * 0.018, -0.37, 0.07, Math.PI / 2 - 0.25));
    mk(sh, knee);
    pivot.userData.knee = knee; legs.push(pivot);
  }
  root.scale.setScalar(1.02);
  root.userData = { body, head: headG, arms, legs, id: v.seed };
  return root;
}

// Build a detailed rig for one monster. extras: kit-format body extras (weapons).
export function buildCreatureRig(typeName, t, v, extras = [], headExtras = [], held = [[], []]) {
  let out;
  if (typeName === 'Skeleton') return skeletonRig(v, held);
  if (typeName === 'Wolf') { MAT = furMat; out = wolf(v); }
  else if (typeName === 'Cow') { MAT = hideMat; out = cow(v); }
  else if (t.shape === 'spider') { MAT = chitinMat; out = spider(v); }
  else if (t.shape === 'dragon') { MAT = scaleMat; out = dragon(v); }
  else {
    const look = (HUMANOID_LOOK[typeName] || (vv => ({ body: vv.tint, build: vv.k, hair: null })))(v);
    if (look.hair === undefined) look.hair = [0x1a1410, 0x3a2a1a, 0x6a4a2a][Math.floor(v.r() * 3)];
    if (!look.hairStyle) look.hairStyle = look.hair ? ['short', 'long', 'spiky', 'pony'][Math.floor(v.r() * 4)] : 'bald';
    look.headExtras = headExtras;
    const armour = typeName === 'Black Knight' ? plateCharMat : typeName === 'Guard' ? chainCharMat : undefined;   // armoured humanoids get the plate/chain surface detail
    const rig = buildHumanoidRig(look, { extras, held, claws: CLAWED.test(typeName), ears: typeName === 'Goblin' || typeName === 'Lesser Demon' ? true : null, material: armour });
    rig.userData.id = v.seed;
    return rig;
  }
  MAT = null;
  out.root.userData = { legs: out.legs, head: out.head, wings: out.wings, tail: out.tail, quad: true, id: v.seed };
  return out.root;
}
