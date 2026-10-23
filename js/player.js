import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shapes, contactShadow, gearDetail } from './anatomy.js';
import { terrainHeight } from './world.js';
import { WORLD_HALF, waterAt, colliders } from './world.js';

export const WALK_SPEED = 3.3;  // world units per second
export const RUN_SPEED = 6.2;

const METAL = { Bronze: 0xb87333, Iron: 0x9a9a9a, Steel: 0xd0d8e0, Mithril: 0x5a6ad0, Adamant: 0x3a9a5a, Rune: 0x3ab8d0, Dragon: 0xb83a34, Wooden: 0x8a5a2a, Oak: 0xc49a5a, Willow: 0x9aaa5a, Maple: 0xc0702a, Yew: 0x6a4a2a, Magic: 0x5a8ae0, Leather: 0x7a4a24, Hard: 0x5a3a1a, Shortbow: 0x8a5a2a };

// Hand with a palm, four fingers of three jointed segments and a two-segment thumb.
// Origin at the wrist (sits at the end of the forearm). hand.userData.curl(c) closes it: 0 open, 1 fist/grip.
function articulatedHand(side, mat) {
  const hand = new THREE.Group(); hand.position.set(0, -0.29, 0);
  const add = (geo, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const palm = add(new THREE.SphereGeometry(0.05, 12, 8), hand, 0, -0.055, 0.005); palm.scale.set(0.95, 1.25, 0.55);
  const fx = [-0.03, -0.01, 0.01, 0.03], fl = [0.03, 0.035, 0.033, 0.026];
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const r = 0.0105 - (i === 3 ? 0.0015 : 0), L = fl[i];
    let parent = hand, y = -0.112; const segs = [];
    for (let j = 0; j < 3; j++) {
      const len = L * [0.75, 0.6, 0.5][j], rr = r * [1, 0.92, 0.82][j];
      const jt = new THREE.Group(); jt.position.set(j ? 0 : fx[i] * side, y, j ? 0 : 0.005); parent.add(jt);
      add(new THREE.CapsuleGeometry(rr, len, 2, 6), jt, 0, -len / 2 - rr * 0.5, 0);
      if (j === 0) add(new THREE.SphereGeometry(r * 1.15, 6, 4), jt, 0, 0.005, -0.01);
      segs.push(jt); parent = jt; y = -len - rr * 0.9;
    }
    fingers.push(segs);
  }
  // thumb: base pivots across the palm, tip curls over the fingers
  const tb = new THREE.Group(); tb.position.set(-0.04 * side, -0.05, 0.025); tb.rotation.set(0.4, 0, -0.5 * side); hand.add(tb);
  add(new THREE.CapsuleGeometry(0.013, 0.03, 2, 6), tb, 0, -0.022, 0);
  const tt = new THREE.Group(); tt.position.y = -0.046; tb.add(tt);
  add(new THREE.CapsuleGeometry(0.011, 0.022, 2, 6), tt, 0, -0.016, 0);
  hand.userData.curl = c => {
    if (hand.userData.c === c) return; hand.userData.c = c;
    for (let i = 0; i < 4; i++) { const f = fingers[i], k = c * (1 + i * 0.04); f[0].rotation.x = 0.15 + k * 1.35; f[1].rotation.x = 0.1 + k * 1.5; f[2].rotation.x = 0.05 + k * 1.1; }
    tb.rotation.set(0.4 + c * 0.5, 0, (-0.5 + c * 0.35) * side); tt.rotation.x = c * 1.0;
  };
  hand.userData.curl(0.3);
  return hand;
}
export function handCurl(arm, c) { const h = arm.userData.elbow.children.find(o => o.userData.curl); if (h) h.userData.curl(c); }

export function createPlayer(scene) {
  const playerGroup = new THREE.Group();
  const std = (c, rough = 0.6, metal = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = playerGroup) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);
  const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

  // Torso (tinted by body armour), hips and belt
  const bodyMat = gearDetail(std(0x6b4423, 0.65));
  const body = new THREE.Group();
  playerGroup.add(body);
  const chest = mesh(shapes.torso(1.02, 1.05, 28), bodyMat, 0, 0, 0, body);
  for (const sx of [-1, 1]) { mesh(shapes.pec(1.02), bodyMat, sx * 0.1, 1.3, 0.095, body); const tr = mesh(shapes.trap(1.02), bodyMat, sx * 0.1, 1.45, -0.02, body); tr.rotation.z = sx * -0.25; }
  mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 18), bodyMat, 0, 1.5, 0, body).rotation.x = Math.PI / 2 - 0.2;
  const legMat = gearDetail(std(0x3a2a1a, 0.7));
  const hips = mesh(sphere(0.25, 14, 8), legMat, 0, 0.8, 0, body); hips.scale.set(1.08, 0.6, 0.8);
  mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.08, 16), std(0x3a2414, 0.5), 0, 0.88, 0, body);
  mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), std(0xc9a227, 0.35, 0.6), 0, 0.88, 0.25, body);

  // Head: rounded with nose, eyes, ears and hair
  const skin = std(0xe0ae84, 0.75);
  const headG = new THREE.Group(); headG.position.y = 1.5; body.add(headG);
  mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 10), skin, 0, 0, 0, headG);
  const head = mesh(shapes.skull(32), skin, 0, 0.25, 0.01, headG);
  mesh(shapes.nose(1), skin, 0, 0.225, 0.255, headG);
  const eyeW = std(0xf4f0e8, 0.25), eyeMat = std(0x2a4a6a, 0.2), pupil = std(0x0a0806, 0.1), lipMat = std(0xb07a62, 0.55), browMat = std(0x3a2a1a, 0.9);
  for (const sx of [-1, 1]) {
    const ex = sx * 0.085;
    mesh(sphere(0.034, 12, 10), eyeW, ex, 0.275, 0.205, headG).scale.set(1, 0.72, 0.6);
    mesh(sphere(0.017, 10, 8), eyeMat, ex, 0.275, 0.224, headG);
    mesh(sphere(0.008, 6, 4), pupil, ex, 0.275, 0.236, headG);
    const lid = mesh(new THREE.SphereGeometry(0.036, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), skin, ex, 0.284, 0.205, headG); lid.scale.set(1.05, 0.5, 0.75); lid.rotation.x = -0.25;
    const br = mesh(new THREE.BoxGeometry(0.085, 0.018, 0.03), browMat, sx * 0.088, 0.325, 0.215, headG); br.rotation.set(0.1, 0, sx * -0.12);
    mesh(shapes.ear(), skin, sx * 0.24, 0.25, -0.01, headG);
    mesh(sphere(0.011, 6, 4), std(0x6a4030, 0.8), sx * 0.018, 0.19, 0.27, headG);
  }
  mesh(sphere(0.04, 12, 6), lipMat, 0, 0.135, 0.225, headG).scale.set(1.3, 0.35, 0.6);
  const hairMat = std(0x3a2a1a, 0.8);
  const hair = new THREE.Group(); headG.add(hair);
  const cap = mesh(new THREE.SphereGeometry(0.275, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat, 0, 0.27, -0.02, hair); cap.rotation.x = -0.3;
  const fringe = mesh(capsule(0.06, 0.26), hairMat, 0, 0.42, 0.18, hair); fringe.rotation.z = Math.PI / 2;
  // back of the head: the cap only reaches the crown, so a nape shell covers the back and sides down to the neck
  // (double-sided so no gap shows looking up from behind), tapering in at the bottom like a short cut.
  hairMat.side = THREE.DoubleSide;
  const napeG = new THREE.SphereGeometry(0.268, 20, 8, Math.PI * 1.5 - 1.45, 2.9, Math.PI * 0.3, Math.PI * 0.42);
  { const q = napeG.attributes.position; for (let i = 0; i < q.count; i++) { const y = q.getY(i), k = y < 0 ? 1 + y * 0.9 : 1; q.setX(i, q.getX(i) * k); q.setZ(i, q.getZ(i) * (y < 0 ? 1 + y * 0.5 : 1)); } napeG.computeVertexNormals(); }
  mesh(napeG, hairMat, 0, 0.255, -0.012, hair);

  // Arms and legs hang from pivots at the shoulder/hip so they can swing; elbows and knees bend.
  function arm(x) {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.36, 0); body.add(pivot);
    mesh(shapes.upperArm(1, 18), bodyMat, 0, 0, 0, pivot);
    mesh(shapes.deltoid(1.02), bodyMat, Math.sign(x) * 0.02, -0.02, 0, pivot);
    const elbow = new THREE.Group(); elbow.position.y = -0.34; pivot.add(elbow);
    mesh(shapes.forearm(1, 18), skin, 0, 0, 0, elbow);
    elbow.add(articulatedHand(Math.sign(x), skin));
    elbow.rotation.x = -0.25;
    pivot.userData.elbow = elbow; pivot.rotation.order = 'ZXY';
    return pivot;
  }
  function leg(x) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.76, 0); playerGroup.add(pivot);
    mesh(shapes.thigh(1, 20), legMat, 0, 0, 0, pivot);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    mesh(shapes.shin(1, 20), legMat, 0, 0, 0, knee);
    mesh(shapes.kneecap(1), legMat, 0, -0.01, 0.07, knee);
    const bootMat = std(0x2e2016, 0.6);
    mesh(mergeGeometries(shapes.foot(16)), bootMat, 0, -0.28, 0, knee);
    pivot.userData.knee = knee; pivot.rotation.order = 'ZXY';
    return pivot;
  }
  const leftArm = arm(-0.39), rightArm = arm(0.39);
  const leftLeg = leg(-0.13), rightLeg = leg(0.13);
  const handOf = a => a.userData.elbow;

  // Held items (hidden until equipped). Attached at the hand so they follow the elbow.
  const swordMat = std(0xb87333, 0.3, 0.7);
  const sword = new THREE.Group();
  const blade = mesh(new THREE.BoxGeometry(0.035, 0.85, 0.11), swordMat, 0, -0.55, 0, sword);
  const tip = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), swordMat, 0, -1.05, 0, sword); tip.rotation.x = Math.PI; tip.scale.set(0.5, 1, 1);
  mesh(new THREE.BoxGeometry(0.06, 0.05, 0.3), std(0x5a4a2a, 0.4, 0.5), 0, -0.1, 0, sword);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), std(0x3a2a1a), 0, 0.0, 0, sword);
  mesh(sphere(0.04, 8, 6), std(0xc9a227, 0.35, 0.6), 0, 0.1, 0, sword);
  sword.position.set(0, -0.34, 0.06);
  sword.rotation.x = -Math.PI / 2;
  sword.visible = false;
  handOf(rightArm).add(sword);

  const bowMat = std(0x8a5a2a, 0.6);
  const bow = new THREE.Group();
  const limb = mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 20, Math.PI * 0.8), bowMat, 0, 0, 0, bow); limb.rotation.z = Math.PI / 2 - Math.PI * 0.4; limb.rotation.y = Math.PI / 2;
  const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.05, 4), std(0xe8e0d0), 0, 0, -0.17, bow);
  bow.position.set(0, -0.34, 0.12);
  bow.visible = false;
  handOf(leftArm).add(bow);

  const shieldMat = gearDetail(std(0x8a5a2a, 0.5, 0.3));
  const shield = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), shieldMat, 0, 0, 0, shield); disc.rotation.z = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 20), std(0x6a6a70, 0.35, 0.7), 0, 0, 0, shield); rim.rotation.y = Math.PI / 2;
  mesh(sphere(0.08, 10, 8), std(0x8a8a90, 0.35, 0.7), -0.04, 0, 0, shield);
  shield.position.set(-0.12, -0.2, 0.05);
  shield.visible = false;
  handOf(leftArm).add(shield);

  const helmMat = gearDetail(std(0xb87333, 0.35, 0.6));
  const helm = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.295, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), helmMat, 0, 0.26, 0, helm);
  mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), helmMat, 0, 0.22, 0.28, helm);
  mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 22), helmMat, 0, 0.18, 0, helm).rotation.x = Math.PI / 2;
  helm.visible = false;
  headG.add(helm);
  // Leather cowl: a soft hood open at the face (double-sided so the opening shows its lining), a rolled rim
  // around the face, and a short mantle draped over the shoulders.
  const cowlMat = gearDetail(std(0x7a4a24, 0.75, 0.0)); cowlMat.side = THREE.DoubleSide; cowlMat.userData.gk.value = 3;
  const cowl = new THREE.Group();
  const hood = mesh(new THREE.SphereGeometry(0.315, 22, 14, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.74), cowlMat, 0, 0.25, -0.015, cowl); hood.scale.set(1, 1.08, 1.05);
  const cRim = mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 18, Math.PI * 1.25), cowlMat, 0, 0.24, 0.215, cowl); cRim.rotation.z = -Math.PI / 8; cRim.scale.set(1, 1.25, 1);
  cRim.rotation.x = -0.25;
  mesh(new THREE.CylinderGeometry(0.17, 0.37, 0.2, 20, 1, true), cowlMat, 0, 0.0, -0.01, cowl);
  mesh(new THREE.ConeGeometry(0.05, 0.12, 6), cowlMat, 0, 0.5, -0.17, cowl).rotation.x = -0.9;
  cowl.visible = false;
  headG.add(cowl);

  // Cape hangs off the back (slightly curved); amulet is a small gem at the neck.
  const capeMat = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.8, side: THREE.DoubleSide });
  const capeGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.05, 12, 4, true, Math.PI * 0.7, Math.PI * 0.6);
  capeGeo.translate(0, -0.525, 0); // pivot at the shoulders so it can swing
  const cape = mesh(capeGeo, capeMat, 0, 1.425, 0.12, body);
  cape.visible = false;
  const neckMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const neck = mesh(new THREE.OctahedronGeometry(0.06, 0), neckMat, 0, 1.33, 0.2, body);
  neck.visible = false;

  playerGroup.add(contactShadow(0.55));
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);

  return {
    mesh: playerGroup,
    position: playerGroup.position,
    velocity: new THREE.Vector3(),
    target: null,       // {x, z} walk target
    stopDist: 0.15,     // stop this close to the target
    moving: false,
    facing: 0,
    animT: 0,
    actionAnim: 0,      // 0..1 swing timer for chopping/attacking
    actionKind: null,
    parts: { cowl, cowlMat, body, bodyMat, leftArm, rightArm, leftLeg, rightLeg, legMat, helm, helmMat, hair, sword, swordMat, bow, bowMat, shield, shieldMat, cape, capeMat, neck, neckMat, headG }
  };
}

// which surface pattern an equipped item gets (see gearDetail): 0 cloth, 1 chain, 2 plate, 3 leather
function gearKind(item) {
  if (!item) return 0;
  if (/chain/i.test(item)) return 1;
  if (/leather|cowl|chaps|Wooden|Oak|Willow|Maple|Yew/i.test(item)) return 3;
  if (/^(Bronze|Iron|Steel|Mithril|Adamant|Rune|Dragon)/.test(item)) return 2;
  return 0;
}
function setGear(mat, item, rough, metal) {
  const k = gearKind(item); mat.userData.gk.value = k;
  mat.roughness = k === 2 ? 0.35 : k === 1 ? 0.45 : rough; mat.metalness = k === 2 ? 0.75 : k === 1 ? 0.6 : metal;
}

function metalColor(item, fallback) {
  if (!item) return fallback;
  const k = Object.keys(METAL).find(m => item.startsWith(m));
  return k ? METAL[k] : fallback;
}

export function applyEquipmentLook(pm, equipment) {
  const p = pm.parts;
  const w = equipment.weapon;
  const isBow = !!(w && /bow/i.test(w));
  p.sword.visible = !!w && !isBow;
  p.bow.visible = isBow;
  if (w && !isBow) p.swordMat.color.setHex(metalColor(w, 0xb87333));
  if (isBow) p.bowMat.color.setHex(metalColor(w, 0x8a5a2a));
  p.shield.visible = !!equipment.shield && !isBow;
  if (equipment.shield) p.shieldMat.color.setHex(metalColor(equipment.shield, 0x8a5a2a));
  p.bodyMat.color.setHex(equipment.body ? metalColor(equipment.body, 0x6b4423) : 0x6b4423);
  p.legMat.color.setHex(equipment.legs ? metalColor(equipment.legs, 0x3a2a1a) : 0x3a2a1a);
  setGear(p.bodyMat, equipment.body, 0.65, 0.05); setGear(p.legMat, equipment.legs, 0.7, 0.05);
  setGear(p.helmMat, equipment.head, 0.35, 0.6); setGear(p.shieldMat, equipment.shield, 0.5, 0.3);
  const isCowl = !!(equipment.head && /cowl|coif|hood/i.test(equipment.head));
  p.helm.visible = !!equipment.head && !isCowl;
  if (p.cowl) { p.cowl.visible = isCowl; if (isCowl) p.cowlMat.color.setHex(/Hard/.test(equipment.head) ? 0x5a3a1a : 0x7a4a24); }
  p.hair.visible = !equipment.head;
  if (equipment.head) p.helmMat.color.setHex(metalColor(equipment.head, 0x7a4a24));
  if (p.cape) {
    const c = equipment.cape;
    p.cape.visible = !!c;
    if (c) p.capeMat.color.setHex(/Blue|Quest/.test(c) ? 0x3050c0 : / cape$/.test(c) && c !== 'Red cape' ? 0xd4af37 : 0xc03030);
    p.neck.visible = !!equipment.neck;
    if (equipment.neck) p.neckMat.color.setHex(/strength/.test(equipment.neck) ? 0xd04a4a : /defence/.test(equipment.neck) ? 0x4ad08a : /accuracy/.test(equipment.neck) ? 0x4a8ad0 : /Holy/.test(equipment.neck) ? 0xe0e0e0 : 0xffd700);
  }
}

// Collision: the player (and chasing monsters) are circles of radius PR against axis-aligned boxes (walls, furniture,
// props). Each box is grown by PR and the centre point is pushed out of it.
// - Swept: when the previous position is known, the point leaves through the face it entered by (the face whose slab it
//   crossed last), never through the far side, so a long step can't pop out on the other side of a thin wall.
// - Sub-stepped: movement is applied in slices of at most SUB (well under half a wall's grown thickness), so a lag spike
//   or running at a low frame rate can't tunnel, and sliding along corners resolves one small step at a time.
// - Iterated: pushing out of one box can push into its neighbour (furniture against a wall), so it repeats until clear.
export const PR = 0.35;
const SUB = 0.08;
function pushOut(pos, b, prev) {
  const x0 = b.minX - PR, x1 = b.maxX + PR, z0 = b.minZ - PR, z1 = b.maxZ + PR;
  if (prev) {
    // entry time along each axis for the move prev -> pos (later entry = the face that was actually hit)
    const mx = pos.x - prev.x, mz = pos.z - prev.z;
    let tx = -1, tz = -1, fx = 0, fz = 0;
    if (prev.x <= x0 && mx > 0) { tx = (x0 - prev.x) / mx; fx = x0; } else if (prev.x >= x1 && mx < 0) { tx = (x1 - prev.x) / mx; fx = x1; }
    if (prev.z <= z0 && mz > 0) { tz = (z0 - prev.z) / mz; fz = z0; } else if (prev.z >= z1 && mz < 0) { tz = (z1 - prev.z) / mz; fz = z1; }
    if (tx >= 0 || tz >= 0) { if (tx >= tz) pos.x = fx; else pos.z = fz; return; }
  }
  let pl = pos.x - x0, pr = x1 - pos.x, pt = pos.z - z0, pb = z1 - pos.z;
  if (b.wall) {
    // Never flip through a wall: across its thin axis only the face on the side the point came from is allowed
    // (furniture pushed against a wall used to shove you into the slab, and the shortest way out was the far side).
    const ref = prev || pos;
    if (b.maxX - b.minX < b.maxZ - b.minZ) { if (ref.x < (b.minX + b.maxX) / 2) pr = Infinity; else pl = Infinity; }
    else { if (ref.z < (b.minZ + b.maxZ) / 2) pb = Infinity; else pt = Infinity; }
  }
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) pos.x = x0; else if (m === pr) pos.x = x1; else if (m === pt) pos.z = z0; else pos.z = z1;
}
const overlaps = (b, x, z) => x > b.minX - PR && x < b.maxX + PR && z > b.minZ - PR && z < b.maxZ + PR;
export function resolveCollisions(pos, prev = null) {
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;
    for (const b of colliders) if (overlaps(b, pos.x, pos.z)) { pushOut(pos, b, prev); hit = true; }
    if (!hit) return;
  }
}
export function blockedAt(x, z) {
  return colliders.some(b => overlaps(b, x, z));
}
// Move a point dist along (dx, dz) with collision, in sub-steps. opts.world/opts.water: clamp to the map and lakes.
export function moveWithCollision(pos, dx, dz, dist, opts = {}) {
  const n = Math.max(1, Math.ceil(dist / SUB)), s = dist / n, prev = { x: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    prev.x = pos.x; prev.z = pos.z;
    pos.x += dx * s; pos.z += dz * s;
    if (opts.world !== false) {
      pos.x = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.x));
      pos.z = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.z));
    }
    if (opts.water !== false) {
      const W = waterAt(pos.x, pos.z, -0.3);
      if (W) {
        const ax = pos.x - W.x, az = pos.z - W.z, d = Math.hypot(ax, az) || 1;
        pos.x = W.x + (ax / d) * (W.r - 0.3);
        pos.z = W.z + (az / d) * (W.r - 0.3);
      }
    }
    resolveCollisions(pos, prev);
  }
}
function stepTo(pos, dx, dz, step) { moveWithCollision(pos, dx, dz, step); }

// Turn toward a point smoothly.
export function faceToward(pm, x, z) {
  pm.facing = Math.atan2(x - pm.mesh.position.x, z - pm.mesh.position.z);
}

// Moves the player. keys move relative to the camera; a tap target overrides keys.
// Returns distance travelled this frame (used to drain run energy).
// Skilling poses (t: 0..1 through one action). Each fully overrides the arms and torso for that action.
const ease = k => k * k * (3 - 2 * k), seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
// impact pulse: a quick damped jolt starting at t0 (1 at contact, rings down over len)
const pulse = (t, t0, len = 0.18) => t < t0 || t > t0 + len ? 0 : Math.exp(-((t - t0) / len) * 4) * Math.cos(((t - t0) / len) * Math.PI * 2.5);
// Lean the torso about the hips (not the feet), like the agility rig does.
function hipPivot(p, extraY = 0) { const H = 0.9, bx = p.body.rotation.x, bz = p.body.rotation.z;
  p.body.position.set(H * Math.sin(bz), H * (1 - Math.cos(bx) * Math.cos(bz)) + extraY, -H * Math.sin(bx)); }
const SKILL_POSES = {
  // melee: step in and plant the lead foot, chamber the blade over the shoulder, cut through with the hips and follow through.
  // pm.swingVar alternates a diagonal slash (0), a backhand (1) and a thrust (2) so repeated hits do not look identical.
  melee(p, t, knee, elbow, pm) {
    const ch = seg(t, 0, 0.3), cut = seg(t, 0.3, 0.5), rec = seg(t, 0.6, 1), v = pm.swingVar || 0, hold = 1 - rec;
    if (v === 2) { // thrust
      p.rightArm.rotation.x = -1.0 - 0.4 * ch * (1 - cut) - 0.5 * cut * hold; elbow(p.rightArm).rotation.x = -1.6 * ch * (1 - cut) - 0.1;
      p.body.rotation.y = 0.35 * ch * (1 - cut) - 0.3 * cut * hold; p.body.rotation.x = 0.05 + 0.22 * cut * hold;
    } else {
      const dir = v === 1 ? -1 : 1;
      p.rightArm.rotation.x = -0.4 - 2.2 * ch + 2.6 * cut * (1 - 0.3 * rec); p.rightArm.rotation.z = dir * (0.5 * ch - 0.9 * cut) * hold;
      elbow(p.rightArm).rotation.x = -1.2 * ch * (1 - cut) - 0.2;
      p.body.rotation.y = dir * (-0.45 * ch + 0.85 * cut) * hold; p.body.rotation.x = 0.04 + 0.16 * cut * hold;
    }
    // contact: the blade jars back a touch, the body settles through the follow-through
    const imp = pulse(t, 0.5, 0.2); p.rightArm.rotation.x -= 0.22 * imp; elbow(p.rightArm).rotation.x -= 0.12 * imp; p.body.rotation.x += 0.05 * imp;
    p.rightArm.rotation.y = -0.25 * cut * hold; // wrist rolls the edge over through the cut
    p.leftArm.rotation.x = -0.5 * hold - 0.2; p.leftArm.rotation.z = -0.25; elbow(p.leftArm).rotation.x = -0.9;   // guard hand up
    const lunge = Math.sin(Math.PI * seg(t, 0.1, 0.85));
    p.leftLeg.rotation.x = -0.45 * lunge; knee(p.leftLeg).rotation.x = 0.35 * lunge; p.rightLeg.rotation.x = 0.3 * lunge; knee(p.rightLeg).rotation.x = 0.2 * lunge;
    if (p.headG) p.headG.rotation.y = -p.body.rotation.y * 0.8;
  },
  // two-handed axe: wind back over the right shoulder, drive across into the trunk, follow through
  chop(p, t, knee, elbow) {
    // a small anticipation dip, weight onto the back foot for the wind-up, drive the hips through onto the front foot,
    // the axe bites (arms jar back), then recover. The head keeps its eyes on the cut.
    const a = Math.sin(Math.PI * seg(t, 0, 0.12)) * 0.5, w = seg(t, 0.05, 0.38), s = seg(t, 0.38, 0.52), r = seg(t, 0.62, 1), imp = pulse(t, 0.52, 0.2);
    const twist = -0.8 * w + 1.2 * s - 0.4 * r - 0.08 * imp;
    p.body.rotation.y = twist; p.body.rotation.x = 0.1 + 0.06 * a + 0.16 * s * (1 - r) + 0.04 * imp; p.body.rotation.z = -0.05 * w + 0.07 * s * (1 - r);
    p.rightArm.rotation.x = -1.2 - 0.95 * w + 0.75 * s + 0.2 * imp; p.rightArm.rotation.z = 0.3 * w - 0.2 * s;
    p.leftArm.rotation.x = -1.0 - 0.85 * w + 0.65 * s + 0.18 * imp; p.leftArm.rotation.z = -0.5 + 0.2 * w;
    elbow(p.rightArm).rotation.x = -0.9 + 0.6 * s - 0.15 * imp; elbow(p.leftArm).rotation.x = -1.3 + 0.7 * s - 0.15 * imp;
    const back = w * (1 - s), front = s * (1 - r);
    p.leftLeg.rotation.x = -0.18 * front + 0.05 * back; p.rightLeg.rotation.x = 0.12 * front - 0.06 * back;
    knee(p.leftLeg).rotation.x = 0.16 + 0.16 * front + 0.08 * a + 0.06 * imp; knee(p.rightLeg).rotation.x = 0.16 + 0.14 * back + 0.08 * a;
    p.leftLeg.rotation.z = 0.08; p.rightLeg.rotation.z = -0.08;
    if (p.headG) { p.headG.rotation.y = -twist * 0.65; p.headG.rotation.x = 0.08 + 0.1 * s * (1 - r); }
  },
  // pickaxe: raise overhead with both hands, bring it down with the whole back, knees absorbing the impact
  mine(p, t, knee, elbow) {
    // dip, raise overhead with the back arching, whip down with the whole back, the pick rings off the rock
    // (arms bounce, knees take the shock), lever it free and reset.
    const a = Math.sin(Math.PI * seg(t, 0, 0.1)) * 0.5, up = seg(t, 0.06, 0.4), dn = seg(t, 0.4, 0.56), r = seg(t, 0.66, 1), imp = pulse(t, 0.56, 0.24);
    const lever = Math.sin(Math.PI * seg(t, 0.6, 0.85));
    const ar = -0.7 + 0.15 * a - 2.15 * up + 2.25 * dn * (1 - r * 0.2) - 0.3 * imp + 0.15 * lever;
    p.rightArm.rotation.x = ar; p.leftArm.rotation.x = ar + 0.1; p.leftArm.rotation.z = -0.25; p.rightArm.rotation.z = 0.15;
    elbow(p.rightArm).rotation.x = -0.4 - 0.6 * up * (1 - dn) - 0.2 * imp; elbow(p.leftArm).rotation.x = -0.5 - 0.6 * up * (1 - dn) - 0.2 * imp;
    p.body.rotation.x = 0.05 * a - 0.16 * up + 0.46 * dn - 0.2 * r - 0.06 * lever + 0.05 * imp; p.body.rotation.y = 0.06 * up - 0.04 * dn; p.body.rotation.z = 0;
    const k = 0.2 + 0.1 * a + 0.35 * dn * (1 - r) + 0.12 * Math.abs(imp); knee(p.leftLeg).rotation.x = k; knee(p.rightLeg).rotation.x = k * 0.9; p.leftLeg.rotation.x = -k * 0.5; p.rightLeg.rotation.x = -k * 0.3;
    if (p.headG) { p.headG.rotation.x = 0.15 + 0.25 * dn * (1 - r) - 0.2 * up * (1 - dn); p.headG.rotation.y = 0; }
  },
  // rod or net held out over the water, with small jigs and the occasional strike
  fish(p, t, knee, elbow, pm) {
    const jig = Math.sin((pm.idleT || 0) * 5) * 0.06, strike = Math.max(0, Math.sin(Math.PI * seg(t, 0.75, 1)));
    p.rightArm.rotation.x = -1.05 + jig - 0.5 * strike; p.leftArm.rotation.x = -0.85 + jig * 0.5 - 0.3 * strike; p.leftArm.rotation.z = 0.25;
    elbow(p.rightArm).rotation.x = -0.6; elbow(p.leftArm).rotation.x = -0.9; p.body.rotation.x = 0.1 - 0.12 * strike; p.body.rotation.y = 0.1;
  },
  // hammer on the anvil: left hand steadies the work, right arm beats down from shoulder height
  smith(p, t, knee, elbow) {
    const up = seg(t, 0, 0.45), dn = seg(t, 0.45, 0.6);
    p.rightArm.rotation.x = -0.6 - 1.4 * up + 1.3 * dn; elbow(p.rightArm).rotation.x = -0.6 - 0.9 * up + 0.6 * dn; p.rightArm.rotation.z = 0.1;
    p.leftArm.rotation.x = -0.75; elbow(p.leftArm).rotation.x = -1.0; p.leftArm.rotation.z = 0.2;
    p.body.rotation.x = 0.28 + 0.06 * dn; p.body.rotation.y = -0.15;
  },
  // stirring over the fire: forearms forward, the right hand circling the pan
  cook(p, t, knee, elbow, pm) {
    const c = (pm.idleT || 0) * 4;
    p.rightArm.rotation.x = -0.75 + Math.sin(c) * 0.12; p.rightArm.rotation.z = 0.1 + Math.cos(c) * 0.12; elbow(p.rightArm).rotation.x = -1.1;
    p.leftArm.rotation.x = -0.6; elbow(p.leftArm).rotation.x = -1.2; p.leftArm.rotation.z = 0.15;
    p.body.rotation.x = 0.22; p.body.rotation.y = 0; knee(p.leftLeg).rotation.x = 0.12; knee(p.rightLeg).rotation.x = 0.12;
  },
  // close bench work (fletching, crafting, herblore): hands together at the chest, head down, small cutting strokes
  craft(p, t, knee, elbow, pm) {
    const cut = Math.max(0, Math.sin((pm.idleT || 0) * 7));
    p.leftArm.rotation.x = -0.55; p.leftArm.rotation.z = 0.3; elbow(p.leftArm).rotation.x = -1.6;
    p.rightArm.rotation.x = -0.6 + cut * 0.15; p.rightArm.rotation.z = -0.25 - cut * 0.1; elbow(p.rightArm).rotation.x = -1.45 + cut * 0.25;
    p.body.rotation.x = 0.18; p.body.rotation.y = 0; if (p.headG) p.headG.rotation.x = 0.45;
  },
  // firemaking: bent low over the logs, striking the tinderbox with quick strokes
  fire(p, t, knee, elbow) {
    const st = Math.max(0, Math.sin(t * Math.PI * 6));
    p.body.rotation.x = 0.65; p.body.rotation.y = 0;
    p.rightArm.rotation.x = -0.35 - st * 0.25; elbow(p.rightArm).rotation.x = -0.7; p.leftArm.rotation.x = -0.45; elbow(p.leftArm).rotation.x = -0.8; p.leftArm.rotation.z = 0.25;
    const k = 0.55; knee(p.leftLeg).rotation.x = k; knee(p.rightLeg).rotation.x = k; p.leftLeg.rotation.x = -k * 0.6; p.rightLeg.rotation.x = -k * 0.6;
    if (p.headG) p.headG.rotation.x = 0.3;
  }
};
export function updatePlayer(pm, keys, dt, running, camYaw) {
  const pos = pm.mesh.position;
  let dx = 0, dz = 0;
  if (keys['w']) dz -= 1;
  if (keys['s']) dz += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;
  if (dx || dz) {
    pm.target = null;
    // rotate by camera yaw so "up" is away from the camera
    const c = Math.cos(camYaw), s = Math.sin(camYaw);
    const rx = dx * c + dz * s, rz = -dx * s + dz * c;
    dx = rx; dz = rz;
  } else if (pm.target) {
    const tx = pm.target.x - pos.x, tz = pm.target.z - pos.z;
    const dist = Math.hypot(tx, tz);
    if (dist <= Math.max(0.1, pm.stopDist)) {
      pm.target = null;
    } else {
      dx = tx / dist; dz = tz / dist;
    }
  }
  const len = Math.hypot(dx, dz);
  let moved = 0;
  if (len > 0) {
    dx /= len; dz /= len;
    let step = (running ? RUN_SPEED : WALK_SPEED) * dt;
    if (pm.target) step = Math.min(step, Math.hypot(pm.target.x - pos.x, pm.target.z - pos.z) - pm.stopDist + 0.01);
    step = Math.max(0, step);
    const ox = pos.x, oz = pos.z;
    stepTo(pos, dx, dz, step);
    moved = Math.hypot(pos.x - ox, pos.z - oz);
    // Walked into a wall: try turning a little each way and keep whichever gets closest to the target.
    if (moved < step * 0.5 && step > 0.001) {
      const goal = pm.target || { x: ox + dx * 10, z: oz + dz * 10 };
      const tryDir = a => {
        const c = Math.cos(a), sn = Math.sin(a);
        const ndx = dx * c - dz * sn, ndz = dx * sn + dz * c;
        const t = { x: ox, z: oz };
        stepTo(t, ndx, ndz, step);
        const mv = Math.hypot(t.x - ox, t.z - oz);
        return mv >= step * 0.5 ? { ...t, dx: ndx, dz: ndz, d: Math.hypot(goal.x - t.x, goal.z - t.z) } : null;
      };
      // Pick a side once (whichever gets closer) and keep sliding that way along the wall.
      let side = pm.steerSide;
      if (!side) { const l = tryDir(0.8), r = tryDir(-0.8); side = !l ? -1 : !r ? 1 : (l.d <= r.d ? 1 : -1); }
      let best = null;
      for (const a of [0.8 * side, 1.5 * side, -0.8 * side, -1.5 * side]) { best = tryDir(a); if (best) { pm.steerSide = Math.sign(a); break; } }
      if (best) { pos.x = best.x; pos.z = best.z; dx = best.dx; dz = best.dz; moved = Math.hypot(pos.x - ox, pos.z - oz); }
      else pos.set(ox, pos.y, oz), stepTo(pos, dx, dz, step);
    } else if (moved >= step * 0.9) pm.steerSide = 0;
    if (moved < step * 0.2 && pm.target) pm.target = null; // truly blocked
    pm.facing = Math.atan2(dx, dz);
  }
  pm.moving = moved > 0.0005;

  // Smooth turning (remember how much is left, for turn-in-place steps)
  let diff = pm.facing - pm.mesh.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  pm.mesh.rotation.y += diff * Math.min(1, dt * 14);
  pm.turnLeft = diff;

  // undo last frame's foot-planting offsets so the poses below (some of which ease from the current value) never see them
  if (pm.plantOff) { const o = pm.plantOff, q = pm.parts; pm.mesh.position.y += o[0]; q.leftLeg.rotation.x += o[1]; q.rightLeg.rotation.x += o[2];
    q.leftLeg.userData.knee.rotation.x -= o[1] * 2; q.rightLeg.userData.knee.rotation.x -= o[2] * 2; q.body.rotation.z -= o[3]; o.fill(0); }
  // Snapshot the rig so a change of state (start/stop walking, start or finish a skill) can cross-fade instead of snapping.
  const JOINTS = pm.joints ??= (() => { const q = pm.parts, l = [q.body, q.leftArm, q.rightArm, q.leftLeg, q.rightLeg, q.leftArm.userData.elbow, q.rightArm.userData.elbow, q.leftLeg.userData.knee, q.rightLeg.userData.knee]; if (q.headG) l.push(q.headG); return l; })();
  const snap = pm.jointSnap ??= new Float32Array(JOINTS.length * 3);
  for (let i = 0; i < JOINTS.length; i++) { const r = JOINTS[i].rotation; snap[i * 3] = r.x; snap[i * 3 + 1] = r.y; snap[i * 3 + 2] = r.z; }
  // Animation: walk/run cycle blended by speed (pm.runK) and eased in/out (pm.moveK), with slope adaptation
  const p = pm.parts;
  const knee = l => l.userData.knee, elbow = a => a.userData.elbow;
  pm.moveK = (pm.moveK ?? 0) + ((pm.moving ? 1 : 0) - (pm.moveK ?? 0)) * Math.min(1, dt * (pm.moving ? 9 : 7));
  pm.runK = (pm.runK ?? 0) + (((running && pm.moving) ? 1 : 0) - (pm.runK ?? 0)) * Math.min(1, dt * 5);
  if (pm.moving) {
    const R = pm.runK, M = Math.min(1, pm.moveK * 1.4), L = (a, b) => a + (b - a) * R;
    pm.animT += dt * L(8, 11.5);
    const ph = pm.animT;
    // terrain slope along the facing: lean into hills, lift the knees more going up, shorten the stride going down
    const f = pm.mesh.rotation.y, fx = Math.sin(f), fz = Math.cos(f);
    const slope = Math.max(-0.6, Math.min(0.6, (terrainHeight(pos.x + fx * 0.6, pos.z + fz * 0.6) - terrainHeight(pos.x - fx * 0.6, pos.z - fz * 0.6)) / 1.2));
    pm.slopeK = (pm.slopeK ?? 0) + (slope - (pm.slopeK ?? 0)) * Math.min(1, dt * 6);
    const up = Math.max(0, pm.slopeK), dn = Math.max(0, -pm.slopeK);
    const amp = L(0.55, 0.85) * (1 - dn * 0.35) * M;
    const sw = Math.sin(ph) * amp;
    p.leftLeg.rotation.x = sw - up * 0.35; p.rightLeg.rotation.x = -sw - up * 0.35;
    // swing-leg knee folds high in a run; the stance knee keeps a little give (and more downhill)
    const kneeAmp = L(0.75, 1.55) * (1 + up * 0.6);
    knee(p.leftLeg).rotation.x = (Math.max(0, -Math.cos(ph)) * kneeAmp + L(0.06, 0.16) + dn * 0.25) * M;
    knee(p.rightLeg).rotation.x = (Math.max(0, Math.cos(ph)) * kneeAmp + L(0.06, 0.16) + dn * 0.25) * M;
    // arms: relaxed pendulum walking, bent and pumping when running
    p.leftArm.rotation.x = -sw * L(0.75, 1.05); p.rightArm.rotation.x = sw * L(0.75, 1.05);
    p.leftArm.rotation.z = -L(0.06, 0.12) * M; p.rightArm.rotation.z = L(0.06, 0.12) * M;
    elbow(p.leftArm).rotation.x = -L(0.45, 1.35) - Math.max(0, Math.sin(ph)) * L(0.15, 0.3);
    elbow(p.rightArm).rotation.x = -L(0.45, 1.35) - Math.max(0, -Math.sin(ph)) * L(0.15, 0.3);
    // two bobs per stride (one per footfall); running has a flight phase so the bob is bigger
    pm.mesh.position.y = terrainHeight(pos.x, pos.z) + Math.abs(Math.cos(ph)) * L(0.04, 0.09) * M;
    p.body.rotation.y = Math.sin(ph) * L(0.08, 0.14) * M;        // shoulders counter-rotate the hips
    p.body.rotation.x = (L(0.04, 0.16) + up * 0.25 - dn * 0.1) * M; // lean forward with speed and uphill
    p.body.rotation.z = Math.sin(ph) * 0.025 * M; hipPivot(p);
    if (p.headG) { p.headG.rotation.x = -p.body.rotation.x * 0.6; p.headG.rotation.y = -p.body.rotation.y * 0.7; } // eyes stay level
    pm.idleT = 0; pm.mesh.rotation.z = 0; p.leftLeg.rotation.z = 0; p.rightLeg.rotation.z = 0;
  } else {
    const k = Math.min(1, dt * 10);
    { const gy = terrainHeight(pos.x, pos.z); pm.mesh.position.y += (gy - pm.mesh.position.y) * k; if (Math.abs(gy - pm.mesh.position.y) > 0.5) pm.mesh.position.y = gy; }
    for (const l of [p.leftLeg, p.rightLeg]) { l.rotation.x += (0 - l.rotation.x) * k; knee(l).rotation.x += (0 - knee(l).rotation.x) * k; }
    p.body.rotation.y += (0 - p.body.rotation.y) * k; p.body.rotation.x += (0 - p.body.rotation.x) * k; p.body.rotation.z += (0 - p.body.rotation.z) * k;
    // idle: breathing, a slow weight shift onto one leg, and now and then a look around
    pm.idleT = (pm.idleT || 0) + dt;
    const it = pm.idleT, settle = Math.min(1, it / 1.2);
    p.body.position.set(0, Math.sin(it * 2.1) * 0.009, 0);
    const shift = Math.sin(it * 0.42 + (pm.idleSeed ??= Math.random() * 6)) * settle;
    p.body.rotation.z = shift * 0.03; pm.mesh.rotation.z = shift * 0.012;
    knee(shift > 0 ? p.leftLeg : p.rightLeg).rotation.x = Math.abs(shift) * 0.22; // relaxed knee on the unweighted side
    (shift > 0 ? p.leftLeg : p.rightLeg).rotation.z = 0; (shift > 0 ? p.rightLeg : p.leftLeg).rotation.z = shift * 0.04;
    if (p.headG && !pm.actionAnim) {
      const cyc = (it + 3) % 11, look = cyc > 7 ? Math.sin((cyc - 7) / 4 * Math.PI) : 0, dir = Math.floor((it + 3) / 11) % 2 ? 1 : -1;
      p.headG.rotation.y += (look * 0.7 * dir - p.headG.rotation.y) * Math.min(1, dt * 4);
      p.headG.rotation.x += (Math.sin(it * 0.3) * 0.05 - p.headG.rotation.x) * Math.min(1, dt * 4);
    }
    // turning on the spot: little stepping feet instead of sliding round
    if (Math.abs(pm.turnLeft || 0) > 0.15) {
      pm.turnT = (pm.turnT || 0) + dt * 12; const st = Math.sin(pm.turnT);
      p.leftLeg.rotation.x = Math.max(0, st) * -0.3; p.rightLeg.rotation.x = Math.max(0, -st) * -0.3;
      knee(p.leftLeg).rotation.x = Math.max(0, st) * 0.5; knee(p.rightLeg).rotation.x = Math.max(0, -st) * 0.5;
    }
    elbow(p.leftArm).rotation.x += (-0.25 - elbow(p.leftArm).rotation.x) * k;
    if (pm.actionAnim > 0) {
      pm.actionAnim = Math.max(0, pm.actionAnim - dt * (pm.actionKind === 'fish' || pm.actionKind === 'cook' || pm.actionKind === 'craft' ? 0.75 : pm.actionKind === 'melee' ? 1.6 : 2.0));
      const t = 1 - pm.actionAnim;
      // wind up then strike, with the body twisting into the swing
      p.rightArm.rotation.x = t < 0.3 ? -(t / 0.3) * 2.4 : -2.4 + ((t - 0.3) / 0.7) * 2.8;
      elbow(p.rightArm).rotation.x = t < 0.3 ? -0.9 * (t / 0.3) : -0.9 + ((t - 0.3) / 0.7) * 0.7;
      p.body.rotation.y = t < 0.3 ? -0.25 * (t / 0.3) : -0.25 + ((t - 0.3) / 0.7) * 0.45;
      p.leftArm.rotation.x += (0 - p.leftArm.rotation.x) * k;
      const S = SKILL_POSES[pm.actionKind]; if (S) { S(p, t, knee, elbow, pm); const kb = knee(p.leftLeg).rotation.x; hipPivot(p, -0.3 * (1 - Math.cos(kb)) - 0.05 * Math.max(0, -p.leftLeg.rotation.x)); }
      if (pm.actionKind === 'bow') { p.leftArm.rotation.x = -1.6; elbow(p.leftArm).rotation.x = 0; p.rightArm.rotation.x = -1.5 + Math.sin(t * Math.PI) * 0.25; elbow(p.rightArm).rotation.x = -1.2; p.body.rotation.y = 0; }
    } else {
      p.leftArm.rotation.x += (0 - p.leftArm.rotation.x) * k;
      p.rightArm.rotation.x += (0 - p.rightArm.rotation.x) * k;
      elbow(p.rightArm).rotation.x += (-0.25 - elbow(p.rightArm).rotation.x) * k;
      p.leftArm.rotation.z += (-0.05 - p.leftArm.rotation.z) * k; p.rightArm.rotation.z += (0.05 - p.rightArm.rotation.z) * k;
    }
  }
  // cross-fade: for a short while after the state changes, ease each joint from last frame's pose toward the new one
  { const st = pm.moving ? (running ? 'run' : 'walk') : pm.actionAnim > 0 ? pm.actionKind : 'idle';
    if (st !== pm.animState) { if (pm.animState !== undefined) pm.blendT = 0.28; pm.animState = st; }
    if (pm.blendT > 0) { pm.blendT -= dt; const a = Math.min(1, dt * 11 + Math.max(0, 1 - pm.blendT / 0.28) * 0.15);
      for (let i = 0; i < JOINTS.length; i++) { const r = JOINTS[i].rotation; r.set(snap[i * 3] + (r.x - snap[i * 3]) * a, snap[i * 3 + 1] + (r.y - snap[i * 3 + 1]) * a, snap[i * 3 + 2] + (r.z - snap[i * 3 + 2]) * a); } } }
  // foot planting: standing (or skilling) on a slope, the body drops to the lower foot and the uphill leg bends to
  // reach the ground, so neither foot floats or sinks. While walking it fades out (the stride already handles it).
  { const plant = 1 - Math.min(1, pm.moveK ?? 0), f = pm.mesh.rotation.y, rx = Math.cos(f) * 0.13, rz = -Math.sin(f) * 0.13, fx = Math.sin(f) * 0.04, fz = Math.cos(f) * 0.04;
    const hL = terrainHeight(pos.x - rx + fx, pos.z - rz + fz), hR = terrainHeight(pos.x + rx + fx, pos.z + rz + fz), gc = terrainHeight(pos.x, pos.z);
    const low = Math.min(hL, hR), drop = Math.min(0.25, gc - low) * plant;
    pm.plantY = (pm.plantY ?? 0) + (drop - (pm.plantY ?? 0)) * Math.min(1, dt * 10);
    if (plant > 0.01) {
      const o = pm.plantOff ??= new Float32Array(4);
      pm.mesh.position.y -= pm.plantY; o[0] = pm.plantY;
      [[p.leftLeg, hL, 1], [p.rightLeg, hR, 2]].forEach(([leg, h, i]) => {
        const dh = Math.max(0, Math.min(0.3, h - low)) * plant, ang = Math.acos(Math.max(0.3, 1 - dh / 0.78));
        leg.rotation.x -= ang; knee(leg).rotation.x += ang * 2; o[i] = ang;
      });
      o[3] = Math.max(-0.12, Math.min(0.12, (hR - hL) * 0.6)) * plant; p.body.rotation.z += o[3]; // hips tilt with the ground
    }
  }
  // cape: damped spring that flares back with speed, lags behind turns and flutters while running
  if (p.cape && p.cape.visible) {
    const cs = pm.capeS ??= { x: 0, v: 0, z: 0, vz: 0, yaw: pm.mesh.rotation.y };
    let dy = pm.mesh.rotation.y - cs.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cs.yaw = pm.mesh.rotation.y;
    const spd = moved / Math.max(dt, 1e-3), d = Math.min(dt, 0.05), tm = performance.now() * 0.001;
    const tx = Math.min(0.65, spd * 0.1) + Math.sin(tm * 9) * 0.06 * Math.min(1, spd / 4);
    cs.v += ((tx - cs.x) * 45 - cs.v * 6) * d; cs.x += cs.v * d;
    cs.vz += ((dy / Math.max(dt, 1e-3) * 0.08 - cs.z) * 45 - cs.vz * 6) * d; cs.z += cs.vz * d;
    p.cape.rotation.x = Math.max(-0.1, Math.min(0.75, cs.x)); p.cape.rotation.z = Math.max(-0.4, Math.min(0.4, cs.z));
  }
  // reactions layered on top of whatever else is playing: flinch when hit, shield or forearm block when the hit is stopped
  if (pm.hitT > 0) { pm.hitT = Math.max(0, pm.hitT - dt * 3.2); const h = Math.sin(pm.hitT * Math.PI) * (pm.hitK || 1);
    p.body.rotation.x -= 0.3 * h; p.body.rotation.z += 0.12 * h * (pm.hitSide || 1); if (p.headG) { p.headG.rotation.x -= 0.35 * h; p.headG.rotation.z = 0.2 * h * (pm.hitSide || 1); }
    p.leftArm.rotation.z -= 0.35 * h; p.rightArm.rotation.z += 0.35 * h; knee(p.leftLeg).rotation.x += 0.25 * h; knee(p.rightLeg).rotation.x += 0.25 * h; }
  else if (p.headG) p.headG.rotation.z *= 0.8;
  if (pm.blockT > 0) { pm.blockT = Math.max(0, pm.blockT - dt * 2.2); const b = Math.min(1, Math.sin(pm.blockT * Math.PI) * 1.6);
    p.leftArm.rotation.x += (-1.5 - p.leftArm.rotation.x) * b; p.leftArm.rotation.z += (0.55 - p.leftArm.rotation.z) * b; elbow(p.leftArm).rotation.x += (-1.4 - elbow(p.leftArm).rotation.x) * b;
    p.body.rotation.x -= 0.08 * b; p.body.rotation.y += (-0.3 - p.body.rotation.y) * b * 0.6; knee(p.leftLeg).rotation.x += 0.2 * b; knee(p.rightLeg).rotation.x += 0.2 * b; }
  { const r = p.sword.visible ? 1 : 0.3, l = p.bow.visible ? 1 : p.shield.visible ? 0.85 : 0.3;
    pm.curlL = (pm.curlL ?? 0.3) + (l - (pm.curlL ?? 0.3)) * Math.min(1, dt * 12); pm.curlR = (pm.curlR ?? 0.3) + (r - (pm.curlR ?? 0.3)) * Math.min(1, dt * 12);
    handCurl(p.leftArm, Math.round(pm.curlL * 50) / 50); handCurl(p.rightArm, Math.round(pm.curlR * 50) / 50); }
  return moved;
}
