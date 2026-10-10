import * as THREE from 'three';
import { WORLD_HALF, insideLake, LAKE } from './world.js';

export const WALK_SPEED = 3.3;  // world units per second
export const RUN_SPEED = 6.2;

const METAL = { Bronze: 0xb87333, Iron: 0x9a9a9a, Steel: 0xd0d8e0, Wooden: 0x8a5a2a, Oak: 0xc49a5a, Leather: 0x7a4a24 };

export function createPlayer(scene) {
  const playerGroup = new THREE.Group();
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = true; return x; };

  const bodyMat = lam(0x6b4423);
  const body = box(0.8, 0.9, 0.45, bodyMat);
  body.position.y = 1.0;
  playerGroup.add(body);

  const skin = lam(0xd4a574);
  const head = box(0.55, 0.55, 0.55, skin);
  head.position.y = 1.75;
  playerGroup.add(head);
  const hair = box(0.6, 0.15, 0.6, lam(0x3a2a1a));
  hair.position.y = 2.05;
  playerGroup.add(hair);
  // Eyes so you can tell which way you're facing
  const eyeMat = lam(0x111111);
  for (const ex of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eyeMat); e.position.set(ex, 1.8, 0.28); playerGroup.add(e); }

  // Arms and legs hang from pivots at the shoulder/hip so they can swing.
  function limb(w, h, m, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = box(w, h, w, m);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    playerGroup.add(pivot);
    return pivot;
  }
  const leftArm = limb(0.22, 0.75, skin, -0.55, 1.4);
  const rightArm = limb(0.22, 0.75, skin, 0.55, 1.4);
  const legMat = lam(0x3a2a1a);
  const leftLeg = limb(0.28, 0.65, legMat, -0.18, 0.65);
  const rightLeg = limb(0.28, 0.65, legMat, 0.18, 0.65);

  // Held items (hidden until equipped)
  const swordMat = lam(0xb87333);
  const sword = new THREE.Group();
  const blade = box(0.08, 0.9, 0.16, swordMat); blade.position.y = -0.55;
  const hilt = box(0.3, 0.06, 0.1, lam(0x3a2a1a)); hilt.position.y = -0.1;
  sword.add(blade, hilt);
  sword.position.set(0, -0.7, 0.1);
  sword.rotation.x = -Math.PI / 2;
  sword.visible = false;
  rightArm.add(sword);

  const bowMat = lam(0x8a5a2a);
  const bow = box(0.06, 1.1, 0.12, bowMat);
  bow.position.set(0, -0.7, 0.12);
  bow.visible = false;
  leftArm.add(bow);

  const shieldMat = lam(0x8a5a2a);
  const shield = box(0.08, 0.6, 0.5, shieldMat);
  shield.position.set(-0.15, -0.45, 0);
  shield.visible = false;
  leftArm.add(shield);

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
    parts: { body, bodyMat, leftArm, rightArm, leftLeg, rightLeg, sword, swordMat, bow, bowMat, shield, shieldMat }
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
    pos.x += dx * step;
    pos.z += dz * step;
    // Stay on land and inside the map
    pos.x = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.x));
    pos.z = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, pos.z));
    if (insideLake(pos.x, pos.z, -0.3)) {
      const ax = pos.x - LAKE.x, az = pos.z - LAKE.z, d = Math.hypot(ax, az) || 1;
      pos.x = LAKE.x + (ax / d) * (LAKE.r - 0.3);
      pos.z = LAKE.z + (az / d) * (LAKE.r - 0.3);
    }
    moved = Math.hypot(pos.x - ox, pos.z - oz);
    if (moved < step * 0.2 && pm.target) pm.target = null; // blocked (lake edge)
    pm.facing = Math.atan2(dx, dz);
  }
  pm.moving = moved > 0.0005;

  // Smooth turning
  let diff = pm.facing - pm.mesh.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  pm.mesh.rotation.y += diff * Math.min(1, dt * 14);

  // Animation: walk cycle, or arm swing while acting
  const p = pm.parts;
  if (pm.moving) {
    pm.animT += dt * (running ? 13 : 9);
    const sw = Math.sin(pm.animT) * 0.7;
    p.leftLeg.rotation.x = sw; p.rightLeg.rotation.x = -sw;
    p.leftArm.rotation.x = -sw * 0.8; p.rightArm.rotation.x = sw * 0.8;
  } else {
    p.leftLeg.rotation.x *= 0.8; p.rightLeg.rotation.x *= 0.8;
    p.leftArm.rotation.x *= 0.8;
    if (pm.actionAnim > 0) {
      pm.actionAnim = Math.max(0, pm.actionAnim - dt * 2.2);
      const t = 1 - pm.actionAnim;
      // raise then strike
      p.rightArm.rotation.x = t < 0.35 ? -(t / 0.35) * 2.2 : -2.2 + ((t - 0.35) / 0.65) * 2.6;
      if (pm.actionKind === 'bow') { p.leftArm.rotation.x = -1.5; p.rightArm.rotation.x = -1.4 + Math.sin(t * Math.PI) * 0.3; }
    } else {
      p.rightArm.rotation.x *= 0.8;
    }
  }
  return moved;
}
