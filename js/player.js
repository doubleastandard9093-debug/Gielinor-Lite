import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shapes, contactShadow } from './anatomy.js';
import { terrainHeight } from './world.js';
import { WORLD_HALF, waterAt, colliders } from './world.js';

export const WALK_SPEED = 3.3;  // world units per second
export const RUN_SPEED = 6.2;

const METAL = { Bronze: 0xb87333, Iron: 0x9a9a9a, Steel: 0xd0d8e0, Mithril: 0x5a6ad0, Adamant: 0x3a9a5a, Rune: 0x3ab8d0, Wooden: 0x8a5a2a, Oak: 0xc49a5a, Willow: 0x9aaa5a, Maple: 0xc0702a, Yew: 0x6a4a2a, Magic: 0x5a8ae0, Leather: 0x7a4a24, Hard: 0x5a3a1a, Shortbow: 0x8a5a2a };

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
  const bodyMat = std(0x6b4423, 0.65);
  const body = new THREE.Group();
  playerGroup.add(body);
  const chest = mesh(shapes.torso(1.02, 1.05, 28), bodyMat, 0, 0, 0, body);
  for (const sx of [-1, 1]) { mesh(shapes.pec(1.02), bodyMat, sx * 0.1, 1.3, 0.095, body); const tr = mesh(shapes.trap(1.02), bodyMat, sx * 0.1, 1.45, -0.02, body); tr.rotation.z = sx * -0.25; }
  mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 18), bodyMat, 0, 1.5, 0, body).rotation.x = Math.PI / 2 - 0.2;
  const legMat = std(0x3a2a1a, 0.7);
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

  const shieldMat = std(0x8a5a2a, 0.5, 0.3);
  const shield = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), shieldMat, 0, 0, 0, shield); disc.rotation.z = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 20), std(0x6a6a70, 0.35, 0.7), 0, 0, 0, shield); rim.rotation.y = Math.PI / 2;
  mesh(sphere(0.08, 10, 8), std(0x8a8a90, 0.35, 0.7), -0.04, 0, 0, shield);
  shield.position.set(-0.12, -0.2, 0.05);
  shield.visible = false;
  handOf(leftArm).add(shield);

  const helmMat = std(0xb87333, 0.35, 0.6);
  const helm = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.295, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), helmMat, 0, 0.26, 0, helm);
  mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), helmMat, 0, 0.22, 0.28, helm);
  mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 22), helmMat, 0, 0.18, 0, helm).rotation.x = Math.PI / 2;
  helm.visible = false;
  headG.add(helm);

  // Cape hangs off the back (slightly curved); amulet is a small gem at the neck.
  const capeMat = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.8, side: THREE.DoubleSide });
  const capeGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.05, 12, 1, true, Math.PI * 0.7, Math.PI * 0.6);
  const cape = mesh(capeGeo, capeMat, 0, 0.9, 0.12, body);
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
    parts: { body, bodyMat, leftArm, rightArm, leftLeg, rightLeg, legMat, helm, helmMat, hair, sword, swordMat, bow, bowMat, shield, shieldMat, cape, capeMat, neck, neckMat, headG }
  };
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
  p.helm.visible = !!equipment.head;
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

// Push a point out of any building it overlaps (circle of radius r vs boxes).
const PR = 0.35;
export function resolveCollisions(pos) {
  for (const b of colliders) {
    if (pos.x <= b.minX - PR || pos.x >= b.maxX + PR || pos.z <= b.minZ - PR || pos.z >= b.maxZ + PR) continue;
    const pl = pos.x - (b.minX - PR), pr = (b.maxX + PR) - pos.x, pt = pos.z - (b.minZ - PR), pb = (b.maxZ + PR) - pos.z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) pos.x = b.minX - PR; else if (m === pr) pos.x = b.maxX + PR; else if (m === pt) pos.z = b.minZ - PR; else pos.z = b.maxZ + PR;
  }
}
export function blockedAt(x, z) {
  return colliders.some(b => x > b.minX - PR && x < b.maxX + PR && z > b.minZ - PR && z < b.maxZ + PR);
}

function stepTo(pos, dx, dz, step) {
  pos.x += dx * step;
  pos.z += dz * step;
  pos.x = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.x));
  pos.z = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.z));
  const W = waterAt(pos.x, pos.z, -0.3);
  if (W) {
    const ax = pos.x - W.x, az = pos.z - W.z, d = Math.hypot(ax, az) || 1;
    pos.x = W.x + (ax / d) * (W.r - 0.3);
    pos.z = W.z + (az / d) * (W.r - 0.3);
  }
  resolveCollisions(pos);
}

// Turn toward a point smoothly.
export function faceToward(pm, x, z) {
  pm.facing = Math.atan2(x - pm.mesh.position.x, z - pm.mesh.position.z);
}

// Moves the player. keys move relative to the camera; a tap target overrides keys.
// Returns distance travelled this frame (used to drain run energy).
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

  // Smooth turning
  let diff = pm.facing - pm.mesh.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  pm.mesh.rotation.y += diff * Math.min(1, dt * 14);

  // Animation: walk cycle with knee/elbow bend, body bob and sway
  const p = pm.parts;
  const knee = l => l.userData.knee, elbow = a => a.userData.elbow;
  if (pm.moving) {
    pm.animT += dt * (running ? 11 : 8);
    const ph = pm.animT;
    const amp = running ? 0.8 : 0.55;
    const sw = Math.sin(ph) * amp;
    p.leftLeg.rotation.x = sw; p.rightLeg.rotation.x = -sw;
    knee(p.leftLeg).rotation.x = Math.max(0, -Math.cos(ph)) * (running ? 1.1 : 0.7);
    knee(p.rightLeg).rotation.x = Math.max(0, Math.cos(ph)) * (running ? 1.1 : 0.7);
    p.leftArm.rotation.x = -sw * 0.75; p.rightArm.rotation.x = sw * 0.75;
    elbow(p.leftArm).rotation.x = -0.3 - (running ? 0.7 : 0.2);
    elbow(p.rightArm).rotation.x = -0.3 - (running ? 0.7 : 0.2);
    pm.mesh.position.y = terrainHeight(pos.x, pos.z) + Math.abs(Math.cos(ph)) * (running ? 0.07 : 0.04);
    p.body.rotation.y = Math.sin(ph) * 0.08;
    p.body.rotation.x = running ? 0.12 : 0.04;
    p.body.rotation.z = Math.sin(ph) * 0.025;
  } else {
    const k = Math.min(1, dt * 10);
    { const gy = terrainHeight(pos.x, pos.z); pm.mesh.position.y += (gy - pm.mesh.position.y) * k; if (Math.abs(gy - pm.mesh.position.y) > 0.5) pm.mesh.position.y = gy; }
    for (const l of [p.leftLeg, p.rightLeg]) { l.rotation.x += (0 - l.rotation.x) * k; knee(l).rotation.x += (0 - knee(l).rotation.x) * k; }
    p.body.rotation.y += (0 - p.body.rotation.y) * k; p.body.rotation.x += (0 - p.body.rotation.x) * k; p.body.rotation.z += (0 - p.body.rotation.z) * k;
    // idle breathing
    pm.idleT = (pm.idleT || 0) + dt;
    p.body.position.y = Math.sin(pm.idleT * 2.2) * 0.008;
    elbow(p.leftArm).rotation.x += (-0.25 - elbow(p.leftArm).rotation.x) * k;
    if (pm.actionAnim > 0) {
      pm.actionAnim = Math.max(0, pm.actionAnim - dt * 2.0);
      const t = 1 - pm.actionAnim;
      // wind up then strike, with the body twisting into the swing
      p.rightArm.rotation.x = t < 0.3 ? -(t / 0.3) * 2.4 : -2.4 + ((t - 0.3) / 0.7) * 2.8;
      elbow(p.rightArm).rotation.x = t < 0.3 ? -0.9 * (t / 0.3) : -0.9 + ((t - 0.3) / 0.7) * 0.7;
      p.body.rotation.y = t < 0.3 ? -0.25 * (t / 0.3) : -0.25 + ((t - 0.3) / 0.7) * 0.45;
      p.leftArm.rotation.x += (0 - p.leftArm.rotation.x) * k;
      if (pm.actionKind === 'bow') { p.leftArm.rotation.x = -1.6; elbow(p.leftArm).rotation.x = 0; p.rightArm.rotation.x = -1.5 + Math.sin(t * Math.PI) * 0.25; elbow(p.rightArm).rotation.x = -1.2; p.body.rotation.y = 0; }
    } else {
      p.leftArm.rotation.x += (0 - p.leftArm.rotation.x) * k;
      p.rightArm.rotation.x += (0 - p.rightArm.rotation.x) * k;
      elbow(p.rightArm).rotation.x += (-0.25 - elbow(p.rightArm).rotation.x) * k;
    }
  }
  { const r = p.sword.visible ? 1 : 0.3, l = p.bow.visible ? 1 : p.shield.visible ? 0.85 : 0.3;
    pm.curlL = (pm.curlL ?? 0.3) + (l - (pm.curlL ?? 0.3)) * Math.min(1, dt * 12); pm.curlR = (pm.curlR ?? 0.3) + (r - (pm.curlR ?? 0.3)) * Math.min(1, dt * 12);
    handCurl(p.leftArm, Math.round(pm.curlL * 50) / 50); handCurl(p.rightArm, Math.round(pm.curlR * 50) / 50); }
  return moved;
}
