// Sails of Sarim: runtime for sailing the Sound — your ship, Drowned Crew ships and broadside cannon fights.
// Kept out of main.js. Low: merged hull meshes only (no cloth sails, no wake), a small cannonball pool.
import * as THREE from 'three';
import { SEA, SEA_ENTRY, SARIM_DOCK, ISLANDS, HULLS, OFFICERS, islandAt, buildShip, buildSound } from './sea.js';

const ENEMY_MAX = 3;
const ENEMY_KINDS = [
  { name: 'Drowned sloop', hp: 90, guns: 2, speed: 6.5, dmg: [6, 12], loot: [120, 320] },
  { name: 'Drowned brig', hp: 160, guns: 3, speed: 5.8, dmg: [8, 16], loot: [300, 700] }
];
const RANGE = 26, RELOAD = 3.2, BALL_SPEED = 38;

export function createSailing(ctx) {
  // ctx: { scene, pm, player, log, quality(), burst, markDirty, onChange(), onSunk(), onSinkEnemy(kind), companionsAboard() }
  const S = { atSea: false, moored: null, ship: null, enemies: [], balls: [], sound: null, target: null, throttle: 0, reload: { port: 0, star: 0 }, nextSpawn: 0, repairT: 0, t: 0 };
  const hullDef = () => HULLS[Math.max(0, (ctx.player.vessel.hull || 1) - 1)];
  const officer = trait => (ctx.player.vessel.officers || []).some(o => OFFICERS[o] && OFFICERS[o].trait === trait && ctx.companionsAboard(o));
  const ballGeo = new THREE.SphereGeometry(0.22, 6, 4), ballMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  function ball() { let b = S.balls.find(b => !b.live); if (!b) { if (S.balls.length >= (ctx.quality() === 'low' ? 10 : 20)) return null; b = { mesh: new THREE.Mesh(ballGeo, ballMat), live: false }; ctx.scene.add(b.mesh); S.balls.push(b); } b.live = true; b.mesh.visible = true; return b; }
  function ensureSound() {
    if (!S.sound) { S.sound = buildSound(ctx.quality()); ctx.scene.add(S.sound); }
    S.sound.visible = true;
  }
  function makeShip() {
    if (S.ship) { ctx.scene.remove(S.ship.mesh); }
    const h = hullDef();
    const mesh = buildShip({ hull: h.n, guns: h.guns, sails: ctx.quality() !== 'low', low: ctx.quality() === 'low' });
    ctx.scene.add(mesh);
    S.ship = { mesh, x: SEA_ENTRY.x, z: SEA_ENTRY.z, yaw: SEA_ENTRY.yaw, speed: 0 };
  }
  function place(o) { o.mesh.position.set(o.x, Math.sin(S.t * 1.3 + o.x) * 0.08, o.z); o.mesh.rotation.set(Math.sin(S.t * 0.9 + o.z) * 0.03, o.yaw, Math.sin(S.t * 1.1) * 0.025); }
  function setSoundVisible(v) { if (S.sound) S.sound.visible = v; if (S.ship) S.ship.mesh.visible = v; for (const e of S.enemies) e.mesh.visible = v; }

  function setSail() {
    const v = ctx.player.vessel;
    if (!v.hull) { ctx.log('You have no ship. The Shipwright on the Port Sarim dock can build you one.', 'warn'); return false; }
    if (v.hp <= 0) v.hp = Math.ceil(hullDef().hp * 0.5);
    ensureSound(); makeShip(); S.atSea = true; S.moored = null; S.throttle = 0; S.target = null; S.nextSpawn = S.t + 6;
    ctx.pm.mesh.position.set(S.ship.x, 1, S.ship.z);
    ctx.log(`You cast off in your ${hullDef().name} into the Sarim Sound. Tap the sea to steer; ${'Z'}/${'X'} or the Port/Stbd buttons fire broadsides.`, 'game');
    ctx.onChange(); return true;
  }
  function goAshore(isl) {
    S.atSea = false; S.moored = isl; S.throttle = 0; S.target = null;
    const d = isl.dock, ax = d.x - isl.x, az = d.z - isl.z, k = Math.hypot(ax, az) || 1;
    S.ship.x = isl.x + ax / k * (isl.r + 6); S.ship.z = isl.z + az / k * (isl.r + 6); S.ship.yaw = Math.atan2(ax, az) + Math.PI / 2; place(S.ship);
    ctx.pm.mesh.position.set(isl.x + ax / k * (isl.r * 0.6), 1.3, isl.z + az / k * (isl.r * 0.6));
    ctx.pm.target = null;
    ctx.log(`You tie up at ${isl.name}. Tap your ship to set sail again.`, 'game'); ctx.onChange();
  }
  function reboard() {
    if (!S.moored || !S.ship) return false;
    S.atSea = true; S.moored = null; ctx.pm.target = null; S.throttle = 0;
    ctx.log('You climb aboard and take the helm.', 'game'); ctx.onChange(); return true;
  }
  function homeToSarim(msg) {
    S.atSea = false; S.moored = null; S.throttle = 0; S.target = null;
    for (const e of S.enemies) ctx.scene.remove(e.mesh); S.enemies.length = 0;
    for (const b of S.balls) { b.live = false; b.mesh.visible = false; }
    if (S.ship) { ctx.scene.remove(S.ship.mesh); S.ship = null; }
    if (S.sound) S.sound.visible = false;
    ctx.pm.mesh.position.set(SARIM_DOCK.x, 0, SARIM_DOCK.z - 3); ctx.pm.target = null;
    if (msg) ctx.log(msg, 'game'); ctx.onChange();
  }
  // Tap on the sea: steer toward it.
  function steerTo(x, z) { if (!S.atSea) return false; S.target = { x, z }; S.throttle = 1; return true; }

  function fire(side) {
    if (!S.atSea || !S.ship) return;
    if (S.reload[side] > 0) { ctx.log(`The ${side === 'port' ? 'port' : 'starboard'} guns are still reloading.`, 'combat'); return; }
    const h = hullDef(), v = ctx.player.vessel, sgn = side === 'port' ? 1 : -1;
    S.reload[side] = RELOAD * Math.max(0.45, 1 - 0.08 * (v.crew || 0));
    const range = RANGE * (officer('lookout') ? 1.25 : 1), dmgK = officer('gunnery') ? 1.3 : 1;
    const sx = Math.cos(S.ship.yaw) * sgn, sz = -Math.sin(S.ship.yaw) * sgn; // side direction (left of heading for port)
    for (let i = 0; i < h.guns; i++) {
      const b = ball(); if (!b) break;
      const off = 1.6 - i * 1.4, fx = Math.sin(S.ship.yaw), fz = Math.cos(S.ship.yaw);
      b.x = S.ship.x + fx * off + sx * 2; b.z = S.ship.z + fz * off + sz * 2; b.y = 1.2;
      b.vx = sx * BALL_SPEED + (Math.random() - 0.5) * 2; b.vz = sz * BALL_SPEED + (Math.random() - 0.5) * 2; b.vy = 3;
      b.left = range / BALL_SPEED; b.mine = true; b.dmg = Math.round((10 + Math.random() * 10) * dmgK);
      if (ctx.quality() !== 'low' || i === 0) ctx.burst('dust', b.x, 1.4, b.z, ctx.quality() === 'low' ? 4 : 8);
    }
    ctx.log(`Fire ${side === 'port' ? 'port' : 'starboard'}!`, 'combat');
  }
  function enemyFire(e) {
    const dx = S.ship.x - e.x, dz = S.ship.z - e.z, d = Math.hypot(dx, dz);
    for (let i = 0; i < e.kind.guns; i++) {
      const b = ball(); if (!b) break;
      b.x = e.x; b.z = e.z; b.y = 1.2; const sp = BALL_SPEED * 0.85, sc = (Math.random() - 0.5) * 0.18;
      b.vx = (dx / d + sc) * sp; b.vz = (dz / d - sc) * sp; b.vy = 3; b.left = RANGE / sp; b.mine = false;
      b.dmg = e.kind.dmg[0] + Math.floor(Math.random() * (e.kind.dmg[1] - e.kind.dmg[0] + 1));
    }
  }
  function spawnEnemy() {
    const kind = ENEMY_KINDS[Math.random() < 0.65 ? 0 : 1];
    const mesh = buildShip({ hull: kind.guns > 2 ? 2 : 1, guns: kind.guns, enemy: true, sails: ctx.quality() !== 'low', low: ctx.quality() === 'low' });
    ctx.scene.add(mesh);
    // Drowned ships rise near the reef side of the Sound, away from you.
    let x = 0, z = 0;
    for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 30; x = S.ship.x + Math.sin(a) * r; z = S.ship.z + Math.cos(a) * r; if (Math.hypot(x - SEA.x, z - SEA.z) < SEA.r - 10 && !islandAt(x, z, 6)) break; }
    const e = { mesh, kind, x, z, yaw: Math.random() * 6.28, hp: kind.hp, reload: 2 + Math.random() * 2 };
    S.enemies.push(e); place(e);
    ctx.log(`A ${kind.name} of the Drowned Crew rises from the deep!`, 'warn');
  }
  function sinkEnemy(e) {
    ctx.scene.remove(e.mesh); S.enemies.splice(S.enemies.indexOf(e), 1);
    ctx.burst('dust', e.x, 1, e.z, 14);
    ctx.onSinkEnemy(e.kind);
  }
  function hitShip(dmg) {
    const v = ctx.player.vessel; v.hp = Math.max(0, v.hp - dmg); ctx.markDirty();
    if (v.hp <= 0) { v.sunk = (v.sunk || 0) + 1; ctx.onSunk(); homeToSarim('Your ship goes down! You wash ashore on the Port Sarim docks. The Shipwright can patch her up.'); }
  }
  function moveBoat(o, dt, speed, turnTo) {
    let dy = turnTo - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    o.yaw += Math.max(-1, Math.min(1, dy)) * dt * 0.9;
    const nx = o.x + Math.sin(o.yaw) * speed * dt, nz = o.z + Math.cos(o.yaw) * speed * dt;
    const isl = islandAt(nx, nz, 4), out = Math.hypot(nx - SEA.x, nz - SEA.z) > SEA.r;
    if (!isl && !out) { o.x = nx; o.z = nz; return true; }
    return false;
  }
  function update(dt, keys) {
    S.t += dt;
    if (!S.ship) return;
    if (!S.atSea) { place(S.ship); return; }
    const sh = S.ship, h = hullDef(), v = ctx.player.vessel;
    // Steering: A/D turn, W full sail, S strike sails. Tap-to-steer sets a heading.
    let turnTo = sh.yaw;
    if (keys.a || keys.d) { S.target = null; turnTo = sh.yaw + (keys.a ? 1 : -1); S.throttle = Math.max(S.throttle, 0.5); }
    if (keys.w) { S.throttle = 1; } if (keys.s) { S.throttle = 0; S.target = null; }
    if (S.target) { const dx = S.target.x - sh.x, dz = S.target.z - sh.z; if (Math.hypot(dx, dz) < 5) { S.target = null; S.throttle = 0; } else turnTo = Math.atan2(dx, dz); }
    const top = h.speed * (officer('helm') ? 1.12 : 1) * S.throttle;
    sh.speed += (top - sh.speed) * Math.min(1, dt * 0.8);
    if (!moveBoat(sh, dt, sh.speed, turnTo)) { sh.speed *= 0.3; S.target = null; S.throttle = 0;
      const isl = islandAt(sh.x + Math.sin(sh.yaw) * 8, sh.z + Math.cos(sh.yaw) * 8, 6);
      if (isl && isl.port || isl && isl.id === 'reef') { goAshore(isl); return; } }
    place(sh);
    ctx.pm.mesh.position.set(sh.x - Math.sin(sh.yaw) * 1.6, sh.mesh.position.y + 0.85 * sh.mesh.scale.y, sh.z - Math.cos(sh.yaw) * 1.6);
    ctx.pm.mesh.rotation.y = sh.yaw;
    // Leave the Sound: sail north past the harbour line.
    if (sh.z < SEA_ENTRY.z - 25) { homeToSarim('You sail back into Port Sarim harbour.'); return; }
    for (const k of ['port', 'star']) S.reload[k] = Math.max(0, S.reload[k] - dt);
    if (officer('surgeon')) { S.repairT += dt; if (S.repairT >= 2) { S.repairT = 0; if (v.hp < h.hp) { v.hp++; } } }
    // Enemies: close in, turn broadside, fire.
    if (S.t > S.nextSpawn && S.enemies.length < ENEMY_MAX && sh.z > SEA_ENTRY.z + 30) { spawnEnemy(); S.nextSpawn = S.t + 25 + Math.random() * 20; }
    for (const e of S.enemies.slice()) {
      const dx = sh.x - e.x, dz = sh.z - e.z, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz);
      moveBoat(e, dt, d > 18 ? e.kind.speed : e.kind.speed * 0.5, d > 18 ? toYou : toYou + Math.PI / 2);
      place(e);
      e.reload -= dt; if (d < RANGE && e.reload <= 0) { e.reload = 4 + Math.random() * 2; enemyFire(e); }
      if (d > 140) { ctx.scene.remove(e.mesh); S.enemies.splice(S.enemies.indexOf(e), 1); }
    }
    // Cannonballs
    for (const b of S.balls) {
      if (!b.live) continue;
      b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 6 * dt; b.left -= dt;
      b.mesh.position.set(b.x, b.y, b.z);
      let hit = false;
      if (b.mine) { for (const e of S.enemies) if (Math.hypot(b.x - e.x, b.z - e.z) < 3.2) { e.hp -= b.dmg; hit = true; ctx.burst('hit', b.x, 1.5, b.z, 10); if (e.hp <= 0) sinkEnemy(e); break; } }
      else if (Math.hypot(b.x - sh.x, b.z - sh.z) < 3.2 * sh.mesh.scale.x) { hit = true; ctx.burst('hit', b.x, 1.5, b.z, 8); hitShip(b.dmg); if (!S.atSea) return; }
      if (hit || b.left <= 0 || b.y < 0) { if (!hit && ctx.quality() !== 'low') ctx.burst('dust', b.x, 0.2, b.z, 4); b.live = false; b.mesh.visible = false; }
    }
  }
  // The Shipwright drops you back at Sarim when you load a save made at sea.
  function restore() { if (ctx.pm.mesh.position.z > SEA.z0 && !S.atSea && !S.moored) { ensureSound(); makeShip(); const near = ISLANDS.reduce((a, i) => Math.hypot(i.x - ctx.pm.mesh.position.x, i.z - ctx.pm.mesh.position.z) < Math.hypot(a.x - ctx.pm.mesh.position.x, a.z - ctx.pm.mesh.position.z) ? i : a); const p = ctx.pm.mesh.position.clone(); goAshore(near); if (islandAt(p.x, p.z)) ctx.pm.mesh.position.copy(p); } }
  return {
    S, setSail, goAshore, reboard, homeToSarim, steerTo, fire, update, restore, setSoundVisible, hullDef,
    get atSea() { return S.atSea; }, get moored() { return S.moored; }, get ship() { return S.ship; }, get enemies() { return S.enemies; },
    reloadOf(side) { return S.reload[side]; }
  };
}
