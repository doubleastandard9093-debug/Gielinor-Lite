// Boss mechanics: telegraphed ground slams you dodge-roll out of (or through), style switches
// that call for a different Protect prayer, and an enrage below 30% HP.
// Visuals: one shared ring mesh (plus a filling disc on High). Low gets a flat ring only. No textures.
import * as THREE from 'three';

export const BOSS = { slamEvery: 9, slamWarn: 3, slamR: 3.2, slamPct: 0.3, switchEvery: 14, enrageAt: 0.3, enrageHit: 1.3, protectBoss: 0.6 };
export const STYLES = ['melee', 'ranged', 'magic'];
export const STYLE_PRAYER = { melee: 'Protect from Melee', ranged: 'Protect from Missiles', magic: 'Protect from Magic' };

export function createBossMech(scene, getQuality) {
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40), ringMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), fillMat);
  ring.rotation.x = fill.rotation.x = -Math.PI / 2; ring.name = 'boss-tele-ring'; fill.name = 'boss-tele-fill-high';
  ring.visible = fill.visible = false; ring.renderOrder = fill.renderOrder = 5;
  scene.add(ring); scene.add(fill);
  let tele = null; // { mon, x, z, y, r, hitTick, startTick }

  function init(m, tick) {
    if (m.bm) return m.bm;
    m.bm = { style: m.ranged ? 'ranged' : 'melee', baseRanged: !!m.ranged, baseRange: m.range, baseHit: m.maxHit, baseSpeed: m.speed, nextSwitch: tick + BOSS.switchEvery, nextSlam: tick + 5, enraged: false };
    return m.bm;
  }
  function reset(m) {
    if (!m.bm) return; const b = m.bm;
    m.ranged = b.baseRanged; m.range = b.baseRange; m.maxHit = b.baseHit; m.speed = b.baseSpeed; m.bm = null;
    if (tele && tele.mon === m) clear();
  }
  function clear() { tele = null; ring.visible = fill.visible = false; }
  function setStyle(m, style) {
    const b = m.bm; b.style = style;
    m.ranged = style !== 'melee'; m.range = style === 'melee' ? b.baseRange : 6;
  }
  // Called each game tick for a boss that is fighting you. Returns events: [{kind, text, dmg}]
  function tick(m, t, ctx) {
    const b = init(m, t), ev = [];
    if (!b.enraged && m.hp > 0 && m.hp < m.maxHp * BOSS.enrageAt) {
      b.enraged = true; b.baseHit = Math.round(b.baseHit * BOSS.enrageHit); m.maxHit = b.baseHit; m.speed = Math.max(2, b.baseSpeed - 1);
      ev.push({ kind: 'enrage', text: `${m.name} is enraged! It hits harder and faster.` });
    }
    if (t >= b.nextSwitch) {
      const opts = STYLES.filter(s => s !== b.style); setStyle(m, opts[Math.floor(Math.random() * opts.length)]);
      b.nextSwitch = t + BOSS.switchEvery - (b.enraged ? 4 : 0);
      ev.push({ kind: 'switch', style: b.style, text: `${m.name} switches to ${b.style}! Pray ${STYLE_PRAYER[b.style]}.` });
    }
    if (!tele && t >= b.nextSlam) {
      const p = ctx.playerPos;
      tele = { mon: m, x: p.x, z: p.z, y: ctx.groundY(p.x, p.z) + 0.06, r: BOSS.slamR * (b.enraged ? 1.25 : 1), startTick: t, hitTick: t + BOSS.slamWarn };
      b.nextSlam = t + BOSS.slamEvery - (b.enraged ? 3 : 0);
      ev.push({ kind: 'telegraph', text: `${m.name} winds up a ground slam. Roll out of the red ring!` });
    }
    if (tele && tele.mon === m && t >= tele.hitTick) {
      const p = ctx.playerPos, inside = Math.hypot(p.x - tele.x, p.z - tele.z) <= tele.r;
      ev.push({ kind: 'slam', inside, x: tele.x, z: tele.z, dmg: inside ? Math.round(ctx.maxHp * BOSS.slamPct * (b.enraged ? 1.25 : 1)) : 0 });
      clear();
    }
    return ev;
  }
  // Called every frame for smooth visuals.
  function frame(t, frac) {
    if (!tele) return;
    const k = Math.min(1, (t + frac - tele.startTick) / (tele.hitTick - tele.startTick));
    ring.visible = true; ring.position.set(tele.x, tele.y, tele.z); ring.scale.setScalar(tele.r);
    ringMat.opacity = 0.5 + 0.45 * k;
    const high = getQuality() !== 'low';
    fill.visible = high;
    if (high) { fill.position.set(tele.x, tele.y + 0.01, tele.z); fill.scale.setScalar(Math.max(0.05, tele.r * k)); }
  }
  // Damage multiplier from your prayers against a boss's current style.
  function prayerMult(m, isActive) {
    if (!m.bm) return null;
    const want = { melee: 'protect', ranged: 'protectr', magic: 'protectm' }[m.bm.style];
    return isActive(want) ? 1 - BOSS.protectBoss : 1;
  }
  return { tick, frame, reset, prayerMult, get tele() { return tele; }, clear };
}
