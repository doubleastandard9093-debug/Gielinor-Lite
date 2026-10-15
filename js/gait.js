// Anatomy-appropriate gaits for the detailed creature rigs (js/creatures.js).
// Quadruped leg order: [front A, front B, back A, back B]. Spider legs: rows front->back, two sides each.
// speed: ground speed in units/s; t: accumulated phase; returns nothing, poses the rig in place.
const TAU = Math.PI * 2;
// Per-leg phase offsets (fraction of a cycle) and swing fraction for each gait.
const GAITS = {
  walk:   { off: [0, 0.5, 0.75, 0.25], swing: 0.35, stride: 0.55, knee: 0.75, rate: 1.0, bob: 0.02, pitch: 0.0 },  // 4-beat lateral walk
  trot:   { off: [0, 0.5, 0.5, 0], swing: 0.45, stride: 0.7, knee: 0.95, rate: 1.35, bob: 0.035, pitch: 0.0 },    // diagonal pairs
  gallop: { off: [0, 0.1, 0.55, 0.65], swing: 0.55, stride: 1.05, knee: 1.25, rate: 1.7, bob: 0.07, pitch: 0.09 }  // rotary gallop
};
// One leg: a sinusoid-free step cycle (planted stance sweeping back, then a lifted swing forward).
function legCycle(p, swingFrac) {
  p = ((p % 1) + 1) % 1;
  if (p < swingFrac) { const k = p / swingFrac; return { a: -Math.cos(Math.PI * k), lift: Math.sin(Math.PI * k) }; } // swing: back -> front
  const k = (p - swingFrac) / (1 - swingFrac); return { a: Math.cos(Math.PI * k) * 1, lift: 0 };                       // stance: front -> back
}
export function poseGait(m, rig, dt, speed, now) {
  const ud = rig.userData, legs = ud.legs; if (!legs) return;
  const moving = speed > 0.05;
  m.gaitK = (m.gaitK ?? 0) + ((moving ? 1 : 0) - (m.gaitK ?? 0)) * Math.min(1, dt * 6);
  const K = m.gaitK;
  if (m.shape === 'spider') {
    // wave gait: neighbouring legs alternate, rows ripple front to back; legs lift high and plant fast
    m.gaitT = (m.gaitT || 0) + dt * (1.2 + speed * 1.1);
    legs.forEach((l, i) => {
      const row = i >> 1, side = i & 1, c = legCycle(m.gaitT + row * 0.25 + ((row + side) & 1) * 0.5, 0.4);
      l.rotation.x = c.a * 0.32 * K * (side ? 1 : -1);
      l.userData.knee.rotation.x = l.userData.kneeRest - c.lift * 0.45 * K + Math.sin(now * 0.002 + i) * 0.03 * (1 - K);
    });
    rig.position.y = (Math.abs(Math.sin(m.gaitT * TAU * 2)) * 0.015) * K;
    rig.rotation.z = Math.sin(m.gaitT * TAU) * 0.03 * K;
    return;
  }
  // quadrupeds: wolves trot when wandering and gallop when chasing; heavy animals walk; dragons walk.
  const heavy = m.shape === 'dragon' || /Cow|Bull/i.test(m.name || '');
  const g = heavy ? GAITS.walk : speed > 2.2 ? GAITS.gallop : GAITS.trot;
  m.gait = m.gait || { ...g }; for (const k in g) if (k !== 'off') m.gait[k] += (g[k] - m.gait[k]) * Math.min(1, dt * 4);
  m.gaitOff = m.gaitOff || g.off.slice(); m.gaitOff.forEach((o, i) => { m.gaitOff[i] += (g.off[i] - o) * Math.min(1, dt * 4); });
  const G = m.gait;
  m.gaitT = (m.gaitT || 0) + dt * (0.55 + speed * 0.45) * G.rate * (heavy ? 0.8 : 1);
  legs.forEach((l, i) => {
    const u = l.userData, c = legCycle(m.gaitT + m.gaitOff[i], G.swing), back = i >= 2;
    l.rotation.x = (u.rest || 0) + c.a * G.stride * 0.5 * K;
    if (u.knee) u.knee.rotation.x = (u.kneeRest || 0) + c.lift * G.knee * K * (back ? 0.8 : 1) + (back ? 0 : c.lift * 0.15 * K);
  });
  // body: bob twice per cycle, pitch rocks on the gallop, slight roll from side to side
  const cyc = m.gaitT * TAU;
  rig.position.y = (Math.abs(Math.sin(cyc)) * G.bob) * K;
  rig.rotation.x = Math.sin(cyc) * G.pitch * K;
  rig.rotation.z = Math.sin(cyc * 0.5) * 0.02 * K;
  if (ud.head) ud.head.rotation.x = -rig.rotation.x * 0.8 + Math.sin(cyc) * 0.04 * K + (1 - K) * Math.sin(now * 0.0011 + (m.spawnX || 0)) * 0.08;
  if (ud.head) ud.head.rotation.y = (1 - K) * Math.sin(now * 0.0005 + (m.spawnZ || 0)) * 0.35; // idle: look around
  // dragons: big downstrokes when hurrying, slow fanning and folding at rest
  if (ud.wings) {
    m.wingT = (m.wingT || 0) + dt * (speed > 2 ? 4.2 : 1.1);
    const f = speed > 2 ? Math.sin(m.wingT * TAU * 0.5) : Math.sin(m.wingT) * 0.25;
    const amp = speed > 2 ? 0.75 : 0.18, fold = speed > 2 ? 0.1 : 0.35;
    ud.wings.forEach((w, k) => { const s = k ? 1 : -1; w.rotation.z = s * (fold + f * amp); w.rotation.x = -0.1 + (speed > 2 ? Math.cos(m.wingT * TAU * 0.5) * 0.2 : 0); });
    if (speed > 2) rig.position.y += Math.max(0, -f) * 0.05; // each downstroke lifts the body a little
  }
}
