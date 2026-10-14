// Ambient wildlife: bird flocks overhead, rabbits and deer in open country.
// Not clickable; a small pool is recycled around the player (cheap on any tier).
import * as THREE from 'three';
import { prim, place, blob } from './models.js';
import { lathe, skinPaint, bakeList, furMat, contactShadow } from './anatomy.js';

const sq = (g, x, y, z) => { g.scale(x, y, z); return g; };
const fur = (g, hex, m = 0.12) => skinPaint(g, hex, { mottle: m, freq: 40, ao: 0.3 });
const mk = (geos) => { const m = new THREE.Mesh(bakeList(geos), furMat); m.castShadow = true; return m; };

function rabbit(hex) {
  const g = new THREE.Group();
  g.add(mk([place(fur(sq(blob(0.16, 0.14, 0.2, { detail: 2, lump: 0.05 }), 1, 1, 1), hex), 0, 0.16, 0),
    place(fur(prim.sphere(0.1, 12, 10), hex), 0, 0.27, 0.17), place(fur(prim.sphere(0.05, 8, 6), 0xf0ece4), 0, 0.2, -0.2),
    ...[-1, 1].flatMap(s => [place(fur(sq(prim.capsule(0.03, 0.16, 2, 8), 1, 1, 0.5), hex), s * 0.04, 0.42, 0.13, -0.3, 0, s * 0.2), place(skinPaint(prim.sphere(0.018, 6, 4), 0x0a0a0a), s * 0.06, 0.3, 0.24),
      place(fur(sq(prim.sphere(0.06, 8, 6), 1, 0.8, 1.6), hex), s * 0.09, 0.08, -0.05), place(fur(prim.capsule(0.022, 0.08, 2, 6), hex), s * 0.06, 0.06, 0.12)])]));
  g.add(contactShadow(0.25));
  return g;
}
function deer(hex, antlers) {
  const g = new THREE.Group();
  const body = [place(fur(sq(lathe([[0, 0.45], [0.16, 0.4], [0.22, 0.2], [0.23, -0.1], [0.19, -0.35], [0, -0.45]], 16), 1, 1, 1).rotateX(Math.PI / 2), hex), 0, 0.95, 0),
    place(fur(prim.sphere(0.07, 8, 6), 0xf0ece4), 0, 1.0, -0.46)];
  const neck = new THREE.Group(); neck.position.set(0, 1.05, 0.35); g.add(neck);
  const nk = [place(fur(prim.capsule(0.08, 0.35, 3, 10), hex), 0, 0.2, 0.06, 0.5), place(fur(sq(lathe([[0, 0.12], [0.06, 0.1], [0.09, -0.02], [0, -0.08]], 12), 1, 1, 1).rotateX(Math.PI / 2), hex), 0, 0.42, 0.22),
    place(skinPaint(prim.sphere(0.025, 6, 4), 0x0a0a0a), 0, 0.41, 0.35)];
  for (const s of [-1, 1]) {
    nk.push(place(skinPaint(prim.sphere(0.02, 6, 4), 0x0a0a0a), s * 0.06, 0.46, 0.22), place(fur(sq(prim.sphere(0.05, 8, 6), 0.4, 1, 0.7), hex), s * 0.09, 0.53, 0.15, 0, 0, s * -0.6));
    if (antlers) { nk.push(place(skinPaint(prim.cyl(0.012, 0.02, 0.3, 6), 0xd8c8a0), s * 0.05, 0.65, 0.16, 0, 0, s * -0.3)); for (let k = 0; k < 3; k++) nk.push(place(skinPaint(prim.cyl(0.008, 0.012, 0.13, 5), 0xd8c8a0), s * (0.07 + k * 0.025), 0.62 + k * 0.08, 0.16 + (k % 2) * 0.05, 0.5, 0, s * -0.9)); }
  }
  neck.add(mk(nk));
  g.add(mk(body));
  const legs = [];
  for (const [x, z] of [[0.11, 0.3], [-0.11, 0.3], [0.11, -0.3], [-0.11, -0.3]]) {
    const p = new THREE.Group(); p.position.set(x, 0.85, z); g.add(p);
    p.add(mk([fur(lathe([[0, 0.04], [0.05, 0], [0.045, -0.3], [0.025, -0.55], [0, -0.6]], 8), hex), place(skinPaint(prim.cyl(0.026, 0.03, 0.06, 6), 0x2a2020), 0, -0.82, 0)]));
    p.children[0].geometry.translate(0, 0, 0);
    legs.push(p);
  }
  g.add(contactShadow(0.4, 1.8));
  g.userData = { legs, neck };
  return g;
}
function bird(hex) {
  const g = new THREE.Group();
  g.add(mk([place(skinPaint(sq(prim.sphere(0.1, 10, 8), 0.8, 0.8, 1.6), hex, { ao: 0.2 }), 0, 0, 0), place(skinPaint(prim.cone(0.025, 0.08, 6), 0xd0a030), 0, 0, 0.2, Math.PI / 2), place(skinPaint(sq(prim.cone(0.07, 0.15, 5), 1, 0.3, 1), hex), 0, 0, -0.2, -Math.PI / 2)]));
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); const m = mk([place(skinPaint(sq(prim.sphere(0.2, 8, 4), 1, 0.08, 0.45), hex), s * 0.2, 0, 0)]); w.add(m); g.add(w); wings.push(w); }
  g.userData = { wings };
  return g;
}

export function createCritters(scene, heightAt, isBlocked) {
  const list = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 10; i++) list.push({ kind: 'rabbit', o: rabbit([0x8a7a64, 0x6a5a48, 0xa89a84, 0xd8d0c4][i % 4]), t: 0, flee: 0 });
  for (let i = 0; i < 6; i++) list.push({ kind: 'deer', o: deer([0x8a5a34, 0x9a6a3a, 0x7a4a2a][i % 3], i % 3 === 0), t: 0, flee: 0 });
  for (let f = 0; f < 3; f++) for (let i = 0; i < 6; i++) list.push({ kind: 'bird', flock: f, idx: i, o: bird([0x2a2a2a, 0x6a5a4a, 0xe8e8e8][f]), t: rand(0, 6) });
  const flocks = [0, 1, 2].map(() => ({ cx: 0, cz: 0, r: rand(10, 25), y: rand(12, 22), sp: rand(0.15, 0.3), a: rand(0, 6), placed: false }));
  for (const c of list) { c.o.visible = false; scene.add(c.o); }
  const spawn = (c, px, pz) => {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, d = rand(25, 60), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      if (isBlocked(x, z)) continue;
      c.o.position.set(x, heightAt(x, z), z); c.o.rotation.y = Math.random() * 6; c.o.visible = true; c.goal = null; c.flee = 0; return;
    }
  };
  let frame = 0;
  return function update(dt, now, px, pz) {
    frame++;
    for (const F of flocks) { if (!F.placed || Math.hypot(F.cx - px, F.cz - pz) > 90) { F.cx = px + rand(-50, 50); F.cz = pz + rand(-50, 50); F.placed = true; } F.a += dt * F.sp; F.cx += Math.cos(F.a * 0.3) * dt * 2; }
    for (const c of list) {
      const o = c.o;
      if (c.kind === 'bird') {
        const F = flocks[c.flock], a = F.a + c.idx * 0.18, rr = F.r + (c.idx % 3) * 1.4;
        const x = F.cx + Math.cos(a) * rr, z = F.cz + Math.sin(a) * rr;
        o.position.set(x, heightAt(F.cx, F.cz) + F.y + Math.sin(now * 0.001 + c.idx) * 0.8 + (c.idx % 2) * 0.6, z);
        o.rotation.y = -a; o.visible = true;
        const fl = Math.sin(now * 0.018 + c.idx * 1.7) * 0.7; o.userData.wings[0].rotation.z = -fl; o.userData.wings[1].rotation.z = fl;
        continue;
      }
      if (!o.visible || Math.hypot(o.position.x - px, o.position.z - pz) > 85) { if (frame % 20 === (list.indexOf(c) % 20)) spawn(c, px, pz); continue; }
      const p = o.position, dp = Math.hypot(p.x - px, p.z - pz);
      if (dp < (c.kind === 'deer' ? 9 : 5)) { c.flee = 2.5; c.goal = [p.x + (p.x - px) / dp * 12, p.z + (p.z - pz) / dp * 12]; }
      c.t -= dt;
      if (!c.goal && c.t <= 0) { c.t = rand(2, 7); if (Math.random() < 0.6) c.goal = [p.x + rand(-6, 6), p.z + rand(-6, 6)]; }
      let moving = false;
      if (c.goal) {
        const dx = c.goal[0] - p.x, dz = c.goal[1] - p.z, d = Math.hypot(dx, dz);
        const sp = (c.kind === 'deer' ? 1.3 : 1.6) * (c.flee > 0 ? 3.5 : 1);
        if (d < 0.2) c.goal = null; else {
          const nx = p.x + dx / d * sp * dt, nz = p.z + dz / d * sp * dt;
          if (isBlocked(nx, nz)) c.goal = null; else { p.x = nx; p.z = nz; o.rotation.y = Math.atan2(dx, dz); moving = true; }
        }
      }
      c.flee = Math.max(0, c.flee - dt);
      c.ph = (c.ph || 0) + dt * (moving ? (c.flee > 0 ? 16 : 9) : 0);
      const gy = heightAt(p.x, p.z);
      if (c.kind === 'rabbit') p.y = gy + (moving ? Math.abs(Math.sin(c.ph)) * 0.22 : 0);
      else {
        p.y = gy;
        const L = o.userData.legs, s = moving ? Math.sin(c.ph) * 0.5 : 0;
        L[0].rotation.x = s; L[3].rotation.x = s; L[1].rotation.x = -s; L[2].rotation.x = -s;
        o.userData.neck.rotation.x += ((moving ? 0 : (Math.sin(now * 0.0005 + p.x) > 0 ? 1.1 : 0)) - o.userData.neck.rotation.x) * Math.min(1, dt * 2);
      }
    }
  };
}
