// Game sound: everything is synthesised with WebAudio at runtime (no sound files). Shared by both releases.
// - Footsteps that follow the walk/run cycle and change with the ground: grass, dirt road, cobbled town square,
//   wooden floors indoors, stone in the cave, squelchy mud at the water's edge.
// - Woodcutting chops and mining pick strikes timed to the impact frame of the swing.
// - A town ambience bed (crowd murmur, the odd bird, distant hammering near a smithy) that fades in near towns,
//   and a soft wind bed out in the wilds.
// Settings: settings.sfx (on/off, default on), settings.sfxVolume (0.25 / 0.5 / 1), settings.ambience (on/off).
import { inBuilding, inCave, waterAt, PATHS, TOWNS, footprints } from './world.js';

let ctx = null, master = null, noiseBuf = null, amb = null;
const unlock = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
};
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true, passive: true });

// short filtered-noise burst: the building block of steps, chops and strikes
function burst(t, { f = 800, q = 1, type = 'bandpass', dur = 0.08, gain = 0.3, attack = 0.003, f2 = null } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
}
function tone(t, { f = 200, f2 = null, type = 'sine', dur = 0.1, gain = 0.2, attack = 0.002 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

const segDist = (x, z, [ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); return Math.hypot(x - ax - dx * k, z - az - dz * k); };
export function surfaceAt(x, z) {
  if (inCave(x, z)) return 'stone';
  if (inBuilding(x, z)) return 'wood';
  if (waterAt(x, z, 1.4)) return 'mud';
  for (const t of Object.values(TOWNS)) if (Math.hypot(x - t.x, z - t.z) < 4.5) return 'cobble';
  for (const p of PATHS) if (segDist(x, z, p) < 1.5) return 'dirt';
  return 'grass';
}
const STEP = {
  grass: (t, k) => { burst(t, { f: 2600, q: 0.6, type: 'highpass', dur: 0.09, gain: 0.07 * k }); burst(t, { f: 320, q: 1, dur: 0.06, gain: 0.08 * k }); },
  dirt: (t, k) => { burst(t, { f: 1500, q: 0.9, dur: 0.07, gain: 0.12 * k }); burst(t + 0.012, { f: 3800, q: 2, dur: 0.04, gain: 0.04 * k }); },
  cobble: (t, k) => { burst(t, { f: 900, q: 3, dur: 0.045, gain: 0.16 * k }); tone(t, { f: 140, f2: 90, dur: 0.05, gain: 0.08 * k }); },
  wood: (t, k) => { tone(t, { f: 190, f2: 120, type: 'triangle', dur: 0.08, gain: 0.14 * k }); burst(t, { f: 600, q: 4, dur: 0.06, gain: 0.08 * k }); },
  stone: (t, k) => { burst(t, { f: 1200, q: 5, dur: 0.05, gain: 0.13 * k }); tone(t, { f: 110, f2: 80, dur: 0.06, gain: 0.07 * k }); },
  mud: (t, k) => { burst(t, { f: 420, q: 2, dur: 0.14, gain: 0.12 * k, f2: 900 }); }
};
function chop(t) { tone(t, { f: 170, f2: 70, type: 'triangle', dur: 0.12, gain: 0.32 }); burst(t, { f: 1100, q: 1.5, dur: 0.1, gain: 0.25 }); burst(t + 0.03, { f: 3000, q: 1, dur: 0.12, gain: 0.05 }); }
function strike(t) { for (const [f, g] of [[2350, 0.12], [3400, 0.08], [5100, 0.05]]) tone(t, { f, type: 'sine', dur: 0.35, gain: g }); burst(t, { f: 2500, q: 2, dur: 0.06, gain: 0.3 }); burst(t + 0.02, { f: 700, q: 1, dur: 0.15, gain: 0.08 }); }
function bird(t) { const b = 2600 + Math.random() * 1600; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone(t + i * 0.11, { f: b, f2: b * (1.2 + Math.random() * 0.3), dur: 0.07, gain: 0.025 }); }
function clink(t) { tone(t, { f: 1800, dur: 0.25, gain: 0.03 }); tone(t, { f: 2700, dur: 0.18, gain: 0.02 }); }

// looping noise beds (town murmur, wind); gains are steered every frame
function bed(f, q, type) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start();
  return { g, fl };
}

let lastStep = null, lastAct = 0, birdT = 2, clinkT = 1, tAmb = 0;
export const soundStats = { steps: 0, chops: 0, strikes: 0, surface: 'grass', town: 0, running: false };
export function updateSound(pm, dt, settings, isDay = true) {
  if (!ctx || !noiseBuf) return;
  const on = settings.sfx !== false, vol = on ? (settings.sfxVolume ?? 0.5) : 0, t = ctx.currentTime;
  soundStats.running = ctx.state === 'running';
  master.gain.setTargetAtTime(vol, t, 0.1);
  if (!on) return;
  const p = pm.mesh.position;
  // footsteps: one per half walk cycle (each footfall), louder when running
  const ph = Math.floor((pm.animT || 0) / Math.PI);
  if (pm.moving && lastStep !== null && ph !== lastStep) {
    const s = surfaceAt(p.x, p.z); soundStats.surface = s; soundStats.steps++;
    STEP[s](t + 0.005, (pm.runK > 0.5 ? 1.25 : 0.85) * (0.85 + Math.random() * 0.3));
  }
  lastStep = ph;
  // chop / mine: a fresh swing restarts actionAnim at 1; the blade lands about half-way through (see SKILL_POSES)
  const a = pm.actionAnim || 0;
  if (a > lastAct + 0.05) { // went up: a new swing (updatePlayer already ran this frame, so it is a little under 1)
    if (pm.actionKind === 'chop') { chop(t + Math.max(0, 0.25 - (1 - a) * 0.5)); soundStats.chops++; }
    else if (pm.actionKind === 'mine') { strike(t + Math.max(0, 0.27 - (1 - a) * 0.5)); soundStats.strikes++; }
  }
  lastAct = a;
  // ambience: town murmur near any town, wind out in the open; birds by day, a smithy's hammer close to one
  if (!amb) amb = { town: bed(520, 0.7, 'bandpass'), wind: bed(380, 0.4, 'lowpass') };
  let town = 0; for (const tw of Object.values(TOWNS)) town = Math.max(town, 1 - Math.min(1, Math.max(0, Math.hypot(p.x - tw.x, p.z - tw.z) - 18) / 22));
  soundStats.town = +town.toFixed(2);
  const ambOn = settings.ambience !== false, cave = inCave(p.x, p.z);
  tAmb += dt;
  amb.town.g.gain.setTargetAtTime(ambOn ? town * 0.05 * (0.75 + 0.25 * Math.sin(tAmb * 0.7) * Math.sin(tAmb * 1.9)) : 0, t, 0.4);
  amb.wind.g.gain.setTargetAtTime(ambOn ? (cave ? 0.015 : (1 - town) * 0.035 + 0.01) * (0.7 + 0.3 * Math.sin(tAmb * 0.23)) : 0, t, 0.8);
  amb.wind.fl.frequency.setTargetAtTime(300 + 160 * Math.sin(tAmb * 0.17), t, 1);
  if (!ambOn || cave) return;
  if ((birdT -= dt) < 0) { birdT = 2 + Math.random() * 6; if (isDay) bird(t); }
  if ((clinkT -= dt) < 0) { clinkT = 1.1 + Math.random() * 0.4; if (footprints.some(f => /Smithy/.test(f.name) && Math.hypot(p.x - (f.minX + f.maxX) / 2, p.z - (f.minZ + f.maxZ) / 2) < 14)) clink(t); }
}
