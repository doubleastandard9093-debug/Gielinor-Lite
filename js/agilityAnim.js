// Agility animation: keyframed, full-body poses that follow each obstacle's geometry.
// Every style is a function of normalised time t (0..1) that returns a pose:
//   root motion { u: progress along the obstacle (0..1), y: feet height, s: sideways offset, yaw: extra facing,
//                 P: whole-body pitch, R: whole-body roll }
//   joints      { bx, by, bz (torso), hx (head), lax, laz, lex / rax, raz, rex (shoulder x/z, elbow),
//                 llx, llz, lkx / rlx, rlz, rkx (hip x/z, knee), gl, gr (hand grip 0..1) }
// Sign conventions (player rig): hip x < 0 swings the leg forward, knee x > 0 bends the shin back,
// shoulder x < 0 raises the arm forward/up (−π = overhead), left shoulder z < 0 lifts the arm out to the side.

const TAU = Math.PI * 2;
export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => (k = clamp01(k), k * k * (3 - 2 * k));
export const easeOut = k => (k = clamp01(k), 1 - (1 - k) * (1 - k));
export const easeIn = k => (k = clamp01(k), k * k);
// Local progress of t inside [a, b], eased.
export const seg = (t, a, b, ease = smooth) => ease((t - a) / (b - a));
// Keyframe track: [[t0, v0], [t1, v1], ...] sampled with an ease between keys.
export function track(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    return lerp(v0, v1, ease((t - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}
// Blend two poses channel by channel.
export function mixPose(a, b, k) {
  const o = { ...a };
  for (const key in b) if (typeof b[key] === 'number') o[key] = lerp(a[key] ?? 0, b[key], k);
  return o;
}
// How far the hips drop when the support leg bends (thigh 0.4, shin+foot 0.36).
const legDrop = (h, k) => 0.76 - (0.4 * Math.cos(h) + 0.36 * Math.cos(h + k));

export const NEUTRAL = { u: 0, y: 0, s: 0, yaw: 0, P: 0, R: 0, bx: 0, by: 0, bz: 0, hx: 0,
  lax: 0, laz: -0.05, lex: -0.25, rax: 0, raz: 0.05, rex: -0.25, llx: 0, llz: 0, lkx: 0, rlx: 0, rlz: 0, rkx: 0, gl: 0, gr: 0 };

// Which animation an obstacle uses, from its kind plus its name/verb.
export function agilityStyle(obs) {
  const n = obs.name.toLowerCase(), v = (obs.verb || '').toLowerCase();
  if (obs.kind === 'log') return /ledge/.test(n) ? 'shimmy' : 'balance';
  if (obs.kind === 'rope') return /swing/.test(v) ? 'swing' : 'tightrope';
  if (obs.kind === 'net') return /hand ?holds|monkey|bars/.test(n) ? 'monkey' : 'net';
  if (obs.kind === 'pipe') return 'pipe';
  if (obs.kind === 'wall') return 'wall';
  if (obs.kind === 'zipline') return 'zipline';
  return 'gap';
}
// Seconds for one crossing of an obstacle of length L.
export function agilityDuration(style, L) {
  return ({ balance: 1.4 + L * 0.65, tightrope: 1.6 + L * 0.7, shimmy: 1.4 + L * 0.75, swing: 3.0, wall: 3.4, net: 3.8,
    monkey: 1.6 + L * 0.6, pipe: 2.2 + L * 0.55, gap: 2.2, zipline: 1.5 + L * 0.3 })[style] || 2;
}

// Walk/step helper: a cycle of short careful steps, phase in radians.
function steps(o, ph, amp, kneeAmp) {
  const sw = Math.sin(ph) * amp;
  o.llx = sw; o.rlx = -sw;
  o.lkx = Math.max(0, -Math.cos(ph)) * kneeAmp + 0.08; o.rkx = Math.max(0, Math.cos(ph)) * kneeAmp + 0.08;
  return o;
}
// Hop up/down from the ground onto a raised surface (k 0..1), with a knee lift.
function mount(o, k, h) {
  o.y = h * easeOut(k * 1.3) ; o.llx = -1.1 * Math.sin(Math.PI * k); o.lkx = 1.4 * Math.sin(Math.PI * k);
  o.rlx = -0.2 * Math.sin(Math.PI * k); o.rkx = 0.3 * Math.sin(Math.PI * k);
  o.lax = 0.4 * Math.sin(Math.PI * k); o.rax = -0.5 * Math.sin(Math.PI * k);
  return o;
}

const STYLES = {
  // Log / beam: arms out, counter-sway, slow heel-to-toe steps, the odd wobble.
  balance(t, L, v) {
    const H = 0.67, o = { ...NEUTRAL };
    const up = seg(t, 0, 0.14), down = seg(t, 0.86, 1);
    o.u = track(t, [[0, 0], [0.14, 0.06], [0.86, 0.94], [1, 1]], k => k);
    const ph = (t - 0.14) / 0.72 * Math.max(3, L * 2.2) * Math.PI;
    if (t < 0.14) mount(o, up, H); else if (t > 0.86) { mount(o, 1 - down, H); o.y = H * (1 - easeIn(down)); }
    else { steps(o, ph, 0.22, 0.45); o.y = H; o.llz = 0.04; o.rlz = -0.04; }
    const arms = smooth(t / 0.18) * (1 - smooth((t - 0.84) / 0.16));
    const wob = v.wobAt > 0 ? Math.exp(-((t - v.wobAt) ** 2) / 0.004) : 0;
    const sway = Math.sin(t * v.swayF * TAU + v.ph) * 0.09 + wob * Math.sin(t * 60) * 0.22;
    o.R = sway; o.bz = -sway * 0.8;
    o.laz = lerp(-0.05, -1.35 - sway * 1.6 - wob * Math.sin(t * 40) * 0.5, arms);
    o.raz = lerp(0.05, 1.35 - sway * 1.6 + wob * Math.sin(t * 40 + 1) * 0.5, arms);
    o.lax = lerp(o.lax, -0.2, arms); o.rax = lerp(o.rax, -0.2, arms); o.lex = o.rex = lerp(-0.25, -0.15, arms);
    o.hx = 0.35 * arms; o.bx = 0.06 * arms; o.s = sway * 0.08;
    return o;
  },
  // Foot rope with a hand rope above: hands slide along it, small sidling steps, rope bounce.
  tightrope(t, L, v) {
    const H = 1.0, o = { ...NEUTRAL };
    o.u = track(t, [[0, 0], [0.15, 0.03], [0.86, 0.97], [1, 1]], k => k);
    const up = seg(t, 0, 0.15), down = seg(t, 0.86, 1);
    const ph = (t - 0.15) / 0.71 * Math.max(4, L * 2.6) * Math.PI;
    if (t < 0.15) mount(o, up, H); else if (t > 0.86) { mount(o, 1 - down, H); o.y = H * (1 - easeIn(down)); }
    else { steps(o, ph, 0.18, 0.4); o.y = H - Math.abs(Math.sin(ph)) * 0.05; o.llz = 0.12; o.rlz = -0.12; }
    const hold = smooth(t / 0.15) * (1 - smooth((t - 0.86) / 0.12));
    const sway = Math.sin(t * v.swayF * TAU + v.ph) * 0.07;
    o.R = sway; o.bz = -sway;
    o.lax = lerp(o.lax, -1.25 + Math.sin(ph) * 0.18, hold); o.rax = lerp(o.rax, -1.25 - Math.sin(ph) * 0.18, hold);
    o.laz = lerp(o.laz, 0.15, hold); o.raz = lerp(o.raz, -0.15, hold); o.lex = o.rex = lerp(-0.25, -0.5, hold);
    o.gl = o.gr = hold; o.hx = 0.3 * hold; o.bx = 0.08 * hold;
    return o;
  },
  // Ledge: face the wall, hands on the edge, sidestep along it.
  shimmy(t, L, v) {
    const H = 0.6, o = { ...NEUTRAL };
    o.yaw = -Math.PI / 2 * smooth(t / 0.12) * (1 - smooth((t - 0.9) / 0.1));
    o.u = track(t, [[0, 0], [0.14, 0.04], [0.88, 0.96], [1, 1]], k => k);
    o.s = -0.1 * smooth(t / 0.14) * (1 - smooth((t - 0.88) / 0.12));
    const up = seg(t, 0, 0.14), down = seg(t, 0.88, 1);
    const ph = (t - 0.14) / 0.74 * Math.max(4, L * 2.4) * Math.PI;
    const hold = smooth(t / 0.16) * (1 - smooth((t - 0.86) / 0.12));
    if (t < 0.14) mount(o, up, H); else if (t > 0.88) { mount(o, 1 - down, H); o.y = H * (1 - easeIn(down)); }
    else {
      // sidestep: legs spread and close in turn (abduction), small knee flex
      const a = Math.sin(ph), b = Math.sin(ph + 1.2);
      o.y = H; o.llz = -0.08 - Math.max(0, a) * 0.32; o.rlz = 0.08 + Math.max(0, -a) * 0.32;
      o.lkx = 0.15 + Math.max(0, a) * 0.25; o.rkx = 0.15 + Math.max(0, -a) * 0.25;
      o.R = a * 0.04; o.bz = -a * 0.05; o.lax = -2.55 + b * 0.12; o.rax = -2.55 - b * 0.12;
    }
    o.lax = lerp(o.lax, o.lax, 1); if (t < 0.14 || t > 0.88) { o.lax = lerp(0, -2.55, hold); o.rax = lerp(0, -2.55, hold); }
    o.laz = lerp(-0.05, -0.35, hold); o.raz = lerp(0.05, 0.35, hold); o.lex = o.rex = lerp(-0.25, -0.55, hold);
    o.gl = o.gr = hold; o.P = 0.08 * hold; o.hx = -0.1 * hold + Math.sin(t * 9) * 0.05 * hold;
    return o;
  },
  // Rope swing between two platforms: run-up, jump and grab, pendulum arc with tucked legs, release, land.
  swing(t, L, v) {
    const o = { ...NEUTRAL }, PH = 0.85, A = 0.65;
    const R = Math.max(1.4, (L / 2 - 0.45) / Math.sin(A)), pivY = PH + 2.0 + R * Math.cos(A);
    const grabU = (L / 2 - R * Math.sin(A)) / L;
    if (t < 0.12) { mount(o, seg(t, 0, 0.12), PH); o.u = lerp(0, 0.05, t / 0.12); }
    else if (t < 0.3) { // run-up across the platform
      const k = (t - 0.12) / 0.18; steps(o, k * 3 * Math.PI, 0.7, 1.0); o.y = PH + Math.abs(Math.sin(k * 3 * Math.PI)) * 0.06;
      o.u = lerp(0.05, grabU, k); o.lax = -o.llx * 0.8; o.rax = -o.rlx * 0.8; o.lex = o.rex = -1.0; o.P = 0.15;
    } else if (t < 0.82) { // on the rope
      const k = (t - 0.3) / 0.52, a = -A + 2 * A * smooth(k);
      o.u = (L / 2 + R * Math.sin(a)) / L; o.y = pivY - R * Math.cos(a) - 2.0;
      const grab = seg(t, 0.3, 0.36);
      o.lax = lerp(-1.6, -3.0, grab); o.rax = lerp(-1.6, -3.05, grab); o.lex = o.rex = -0.1; o.gl = o.gr = grab;
      o.laz = 0.12; o.raz = -0.12;
      const tuck = Math.sin(Math.PI * k);
      o.llx = o.rlx = -1.25 * tuck - 0.2; o.lkx = o.rkx = 1.5 * tuck + 0.2; o.P = -a * 0.55; o.hx = 0.1;
    } else { // release, fly, land with a knee bend
      const k = (t - 0.82) / 0.18, fly = seg(k, 0, 0.45), land = seg(k, 0.45, 0.75), rise = seg(k, 0.75, 1);
      const endY = pivY - R * Math.cos(A) - 2.0;
      o.u = lerp((L / 2 + R * Math.sin(A)) / L, 1, easeOut(k * 1.4)); o.y = lerp(endY, 0, easeIn(fly)) + Math.sin(Math.PI * fly) * 0.25;
      const bend = Math.sin(Math.PI * Math.min(1, k * 1.5)) * (1 - rise);
      o.llx = o.rlx = -1.0 * bend; o.lkx = o.rkx = 1.7 * bend; o.y = Math.max(0, o.y) - legDrop(-1.0 * bend, 1.7 * bend) * land * (1 - rise);
      o.lax = lerp(-2.6, -0.6, fly) * (1 - rise); o.rax = o.lax; o.laz = -0.6 * bend; o.raz = 0.6 * bend; o.P = 0.35 * bend;
    }
    return o;
  },
  // Rough wall / crate stack: climb with alternating hand and foot holds, mantle over the top, drop down.
  wall(t, L, v) {
    const o = { ...NEUTRAL }, H = 2.2, face = (L / 2 - 0.62) / L;
    if (t < 0.12) { const k = t / 0.12; steps(o, k * 2 * Math.PI, 0.45, 0.6); o.u = lerp(0, face, k); }
    else if (t < 0.7) {
      const k = (t - 0.12) / 0.58, ph = k * 4 * Math.PI, cyc = (k * 4) % 2; // two full hand-foot cycles per metre
      o.u = face; o.y = Math.max(0, 1.15 * (k - Math.sin(ph) * 0.04));
      const l = Math.sin(ph), r = -l;
      o.lax = -2.6 - Math.max(0, l) * 0.4; o.rax = -2.6 - Math.max(0, r) * 0.4;
      o.lex = -0.3 - Math.max(0, -l) * 0.9; o.rex = -0.3 - Math.max(0, -r) * 0.9; // pull arm bends
      o.laz = 0.2; o.raz = -0.2; o.gl = 0.6 + 0.4 * Math.max(0, -l); o.gr = 0.6 + 0.4 * Math.max(0, -r);
      o.llx = -0.4 - Math.max(0, r) * 1.0; o.rlx = -0.4 - Math.max(0, l) * 1.0;
      o.lkx = 0.5 + Math.max(0, r) * 1.2; o.rkx = 0.5 + Math.max(0, l) * 1.2; o.P = 0.12; o.hx = -0.35; o.bz = l * 0.06;
      void cyc;
    } else if (t < 0.84) { // mantle: press up, swing a knee over the top
      const k = seg(t, 0.7, 0.84);
      o.u = lerp(face, 0.5, k); o.y = lerp(1.15, H, k); o.P = 0.75 * Math.sin(Math.PI * k) + 0.12 * (1 - k);
      o.lax = o.rax = lerp(-2.8, -0.4, k); o.lex = o.rex = lerp(-0.6, -0.2, k); o.gl = o.gr = 1 - k;
      o.llx = -1.4 * Math.sin(Math.PI * k); o.lkx = 1.8 * Math.sin(Math.PI * k); o.rlx = -0.3; o.rkx = 0.6;
    } else { // drop down the far side and absorb
      const k = (t - 0.84) / 0.16, fall = seg(k, 0, 0.5, easeIn), land = Math.sin(Math.PI * clamp01((k - 0.4) / 0.6));
      o.u = lerp(0.5, (L / 2 + 0.75) / L, easeOut(k * 1.6)) + (1 - (L / 2 + 0.75) / L) * seg(k, 0.6, 1); o.y = H * (1 - fall);
      o.llx = o.rlx = -0.6 - 0.5 * land; o.lkx = o.rkx = 0.8 + 0.9 * land; o.y -= legDrop(-1.1 * land, 1.7 * land) * land;
      o.lax = o.rax = -1.0 * (1 - k); o.laz = -0.5 * land; o.raz = 0.5 * land; o.P = 0.3 * land;
    }
    return o;
  },
  // Obstacle net: hand-over-hand up, roll over the top bar, climb down the other side, hop off.
  net(t, L, v) {
    const o = { ...NEUTRAL }, top = 2.35, near = (L / 2 - 0.42) / L, far = (L / 2 + 0.42) / L;
    const climb = (k, dir) => {
      const ph = k * 5 * Math.PI, l = Math.sin(ph), r = -l;
      o.lax = -2.35 - l * 0.45; o.rax = -2.35 - r * 0.45; o.lex = -0.5 - Math.max(0, -l) * 0.7; o.rex = -0.5 - Math.max(0, -r) * 0.7;
      o.gl = 0.7 + 0.3 * Math.max(0, -l); o.gr = 0.7 + 0.3 * Math.max(0, -r); o.laz = 0.15; o.raz = -0.15;
      o.llx = -0.5 - Math.max(0, r) * 0.9; o.rlx = -0.5 - Math.max(0, l) * 0.9; o.lkx = 0.7 + Math.max(0, r) * 1.0; o.rkx = 0.7 + Math.max(0, l) * 1.0;
      o.P = 0.1; o.hx = dir > 0 ? -0.4 : 0.45; o.bz = l * 0.05; o.R = Math.sin(ph * 0.5 + v.ph) * 0.04; // the net gives a little
    };
    if (t < 0.1) { const k = t / 0.1; steps(o, k * 2 * Math.PI, 0.45, 0.6); o.u = lerp(0, near, k); }
    else if (t < 0.45) { const k = (t - 0.1) / 0.35; climb(k, 1); o.u = near; o.y = Math.max(0, lerp(0, 1.3, k) + Math.sin(k * 10 * Math.PI) * 0.03); }
    else if (t < 0.6) { // over the top: torso folds over the bar, legs swing across
      const k = seg(t, 0.45, 0.6); o.u = lerp(near, far, k); o.y = 1.3 + Math.sin(Math.PI * k) * 0.35;
      o.P = 0.9 * Math.sin(Math.PI * k); o.lax = o.rax = lerp(-2.6, -1.2, k); o.gl = o.gr = 1;
      o.llx = -1.5 * Math.sin(Math.PI * k); o.lkx = 1.6 * Math.sin(Math.PI * k); o.rlx = -0.9 * Math.sin(Math.PI * k); o.rkx = 1.2 * Math.sin(Math.PI * k);
    } else if (t < 0.88) { const k = (t - 0.6) / 0.28; climb(k, -1); o.u = far; o.y = lerp(1.3, 0.1, k); o.P = 0.0; }
    else { const k = seg(t, 0.88, 1); o.u = lerp(far, 1, k); const b = Math.sin(Math.PI * k); o.llx = o.rlx = -0.7 * b; o.lkx = o.rkx = 1.1 * b; o.y = Math.max(0, 0.1 * (1 - k) - legDrop(-0.7 * b, 1.1 * b) * b); }
    return o;
  },
  // Monkey bars / hand holds overhead: jump to hang, alternate hand swings with a body pendulum, drop and land.
  monkey(t, L, v) {
    const o = { ...NEUTRAL }, bar = 2.6, hang = bar - 2.15;
    if (t < 0.12) { // jump to the first bar
      const k = seg(t, 0, 0.12); o.u = lerp(0, 0.06, k); const cr = Math.sin(Math.PI * Math.min(1, k * 2));
      o.y = k < 0.5 ? -legDrop(-0.8 * cr, 1.3 * cr) : hang * easeOut((k - 0.5) * 2); o.llx = o.rlx = -0.8 * cr; o.lkx = o.rkx = 1.3 * cr;
      o.lax = o.rax = lerp(0.5, -3.05, seg(k, 0.3, 1)); o.gl = o.gr = seg(k, 0.8, 1);
    } else if (t < 0.86) {
      const k = (t - 0.12) / 0.74, n = Math.max(3, Math.round(L * 1.6)), ph = k * n * Math.PI;
      o.u = lerp(0.06, 0.94, k - Math.sin(ph * 2) / (2 * n * Math.PI) * 0.6); o.y = hang - Math.abs(Math.sin(ph)) * 0.08;
      const l = Math.sin(ph); // l>0: left hand reaching forward, right holding
      o.lax = -3.05 + Math.max(0, l) * 0.55; o.rax = -3.05 + Math.max(0, -l) * 0.55;
      o.lex = -Math.max(0, l) * 0.4; o.rex = -Math.max(0, -l) * 0.4;
      o.gl = 1 - Math.max(0, l) * 0.9; o.gr = 1 - Math.max(0, -l) * 0.9; o.laz = 0.1; o.raz = -0.1;
      o.by = -l * 0.22; o.R = l * 0.08; o.P = Math.cos(ph) * 0.12; // hips swing side to side and fore/aft
      o.llx = -0.35 + Math.cos(ph) * 0.3; o.rlx = -0.35 - Math.cos(ph) * 0.3 + 0.1; o.lkx = 0.6 + Math.max(0, l) * 0.3; o.rkx = 0.6 + Math.max(0, -l) * 0.3;
      o.hx = -0.25;
    } else { // drop and absorb
      const k = seg(t, 0.86, 1, k => k), fall = easeIn(Math.min(1, k * 2)), b = Math.sin(Math.PI * clamp01((k - 0.35) / 0.65));
      o.u = lerp(0.94, 1, k); o.y = hang * (1 - fall) - legDrop(-1.0 * b, 1.6 * b) * b;
      o.lax = o.rax = lerp(-3.0, 0, smooth(k)); o.llx = o.rlx = -1.0 * b; o.lkx = o.rkx = 1.6 * b; o.P = 0.3 * b; o.laz = -0.4 * b; o.raz = 0.4 * b;
    }
    return o;
  },
  // Pipe: crouch, crawl on hands and knees through it, stand up at the far end.
  pipe(t, L, v) {
    const o = { ...NEUTRAL }, CP = 1.2;
    const down = seg(t, 0.04, 0.2), upk = seg(t, 0.84, 0.98), on = down * (1 - upk);
    o.u = track(t, [[0, -0.02], [0.2, 0.04], [0.84, 0.96], [1, 1.02]], k => k);
    o.P = CP * on; o.y = (0.45 - 0.76 * Math.cos(CP) - 0.27) * on + 0.27 * on * 0; // root lift so knees and hands touch
    o.y = (0.5 - 0.76 * Math.cos(o.P)) * on;
    const ph = clamp01((t - 0.2) / 0.64) * Math.max(4, L * 3) * Math.PI, c = Math.sin(ph) * on * (t > 0.2 && t < 0.84 ? 1 : 0);
    // contralateral crawl: left arm with right knee
    o.lax = -o.P - 0.15 - c * 0.35; o.rax = -o.P - 0.15 + c * 0.35; o.lex = o.rex = -0.15;
    o.llx = -o.P + c * 0.3; o.rlx = -o.P - c * 0.3; o.lkx = Math.PI / 2 * on + Math.max(0, -c) * 0.2; o.rkx = Math.PI / 2 * on + Math.max(0, c) * 0.2;
    o.hx = -0.9 * on; o.bz = c * 0.06; o.by = c * 0.08; o.y += Math.abs(c) * 0.02;
    if (on < 1) { o.llx = lerp(0, o.llx, on); o.rlx = lerp(0, o.rlx, on); o.lax = lerp(0, o.lax, on); o.rax = lerp(0, o.rax, on); }
    return o;
  },
  // Gap between two platforms: step up, crouch wind-up with arm swing back, jump arc with tucked legs, land, step off.
  gap(t, L, v) {
    const o = { ...NEUTRAL }, H = 0.8, from = 0.55 / L, to = 1 - 0.55 / L;
    if (t < 0.14) { mount(o, seg(t, 0, 0.14), H); o.u = lerp(0, from, t / 0.14); }
    else if (t < 0.32) { // wind-up
      const k = seg(t, 0.14, 0.32), c = Math.sin(Math.PI * 0.5 * k);
      o.u = from; o.llx = o.rlx = -0.85 * c; o.lkx = o.rkx = 1.3 * c; o.y = H - legDrop(-0.85 * c, 1.3 * c);
      o.lax = o.rax = 0.9 * c; o.lex = o.rex = -0.2; o.P = 0.35 * c; o.hx = -0.2 * c;
    } else if (t < 0.62) { // flight
      const k = (t - 0.32) / 0.3, tuck = Math.sin(Math.PI * k);
      o.u = lerp(from, to, k); o.y = H + Math.sin(Math.PI * k) * (0.9 + L * 0.08) - legDrop(-0.85, 1.3) * (1 - smooth(k * 4)) ;
      o.lax = o.rax = lerp(0.9, -2.3, seg(k, 0, 0.3)) + 0.6 * seg(k, 0.6, 1); o.lex = o.rex = -0.4;
      o.llx = -1.2 * tuck - 0.15; o.rlx = -0.9 * tuck - 0.4 * (1 - tuck); o.lkx = 1.6 * tuck; o.rkx = 1.3 * tuck + 0.3; o.P = 0.25 - 0.3 * k;
    } else if (t < 0.8) { // landing absorb
      const k = seg(t, 0.62, 0.8, k => k), b = Math.sin(Math.PI * k) * (1 - k * 0.3);
      o.u = to; o.llx = o.rlx = -1.0 * b; o.lkx = o.rkx = 1.6 * b; o.y = H - legDrop(-1.0 * b, 1.6 * b);
      o.lax = o.rax = -0.9 * (1 - k); o.laz = -0.5 * b; o.raz = 0.5 * b; o.P = 0.35 * b;
    } else { mount(o, 1 - seg(t, 0.8, 1), H); o.y = H * (1 - easeIn(seg(t, 0.8, 1))); o.u = lerp(to, 1, seg(t, 0.8, 1)); }
    return o;
  },
  // Zipline (not used by any course yet): hang from a handle and slide down the line.
  zipline(t, L, v) {
    const o = { ...NEUTRAL }; o.u = easeIn(t); o.y = 0.5 * Math.sin(Math.PI * t); o.lax = o.rax = -3.0; o.gl = o.gr = 1;
    o.llx = o.rlx = -0.9; o.lkx = o.rkx = 1.0; o.P = -0.15; return o;
  }
};


// ---------------------------------------------------------------------------
// Hand/foot locked versions. These override the styles above and add o.ik:
//   { lh, rh, lf, rf: [x, y, z] in obstacle space (x sideways, y up, z along the path) or null, wh, wf: weights }
// ---------------------------------------------------------------------------
// Swing rig shared with world.js so the rope and frame match the animation.
export function swingGeom(L) {
  const A = 0.65, PH = 0.85, Rf = Math.max(3.2, (L / 2 - 0.45) / Math.sin(A)), R = Rf - 2.05;
  return { A, PH, Rf, R, pivY: PH + Rf * Math.cos(A) };
}
// Planted-then-moving step: holds for `plant` of each cycle, then moves to the next hold.
const stepT = (c, off, plant = 0.55) => { const c2 = c + off, i = Math.floor(c2), f = c2 - i; return i + smooth((f - plant) / (1 - plant)); };
const liftT = (c, off, plant = 0.55) => { const c2 = c + off, f = c2 - Math.floor(c2); return Math.sin(Math.PI * clamp01((f - plant) / (1 - plant))); };

function feetOnLine(o, L, y, t0, t1, t, stride, spread) {
  // feet placed heel-to-toe on a beam or rope at height y while the root walks along it
  const z = o.u * L, c = z / stride;
  o.ik.lf = [-spread, y + 0.1 + liftT(c, 0) * 0.1, stride * stepT(c, 0) + 0.12];
  o.ik.rf = [spread, y + 0.1 + liftT(c, 0.5) * 0.1, stride * stepT(c, 0.5) - stride * 0.5 + 0.12];
  o.ik.wf = seg(t, t0, t0 + 0.05) * (1 - seg(t, t1 - 0.05, t1));
}
const STYLES2 = {
  balance(t, L, v) {
    const o = STYLES.balance(t, L, v); o.ik = {};
    feetOnLine(o, L, 0.67, 0.14, 0.86, t, 0.3, 0.03);
    return o;
  },
  tightrope(t, L, v) {
    const o = STYLES.tightrope(t, L, v); o.ik = {};
    feetOnLine(o, L, 1.03, 0.15, 0.86, t, 0.3, 0.04);
    const z = o.u * L, c = z / 0.4;
    o.ik.lh = [-0.08, 2.0, 0.4 * stepT(c, 0, 0.4) + 0.25]; o.ik.rh = [0.08, 2.0, 0.4 * stepT(c, 0.5, 0.4) + 0.05];
    o.ik.wh = seg(t, 0.06, 0.15) * (1 - seg(t, 0.86, 0.94));
    return o;
  },
  shimmy(t, L, v) {
    const o = STYLES.shimmy(t, L, v); o.ik = {};
    const z = o.u * L, c = z / 0.36;
    // facing the wall (−x): the rig's right side points along +z
    o.ik.rh = [-0.3, 2.16, 0.36 * stepT(c, 0.5) + 0.05]; o.ik.lh = [-0.3, 2.16, 0.36 * stepT(c, 0) - 0.3];
    o.ik.rf = [-0.2, 0.7 + liftT(c, 0.25) * 0.06, 0.36 * stepT(c, 0.25) + 0.0]; o.ik.lf = [-0.2, 0.7 + liftT(c, 0.75) * 0.06, 0.36 * stepT(c, 0.75) - 0.3];
    o.ik.wh = seg(t, 0.08, 0.16) * (1 - seg(t, 0.84, 0.9)); o.ik.wf = seg(t, 0.13, 0.16) * (1 - seg(t, 0.86, 0.88));
    o.s = -0.1 * smooth(t / 0.14) * (1 - smooth((t - 0.88) / 0.12)); o.P = 0.04;
    return o;
  },
  wall(t, L, v) {
    const o = { ...NEUTRAL, ik: {} }, H = 2.2, face = L / 2 - 0.3, rz = face - 0.42;
    const S = 0.3, n = 1.5;
    if (t < 0.12) { const k = t / 0.12; steps(o, k * 2 * Math.PI, 0.45, 0.6); o.u = lerp(0, rz / L, k); o.lax = -0.6 * k; o.rax = -0.6 * k; }
    else if (t < 0.55) {
      const k = (t - 0.12) / 0.43, c = k * n; o.u = rz / L; o.y = S * c; o.P = 0.08; o.hx = -0.4;
      o.ik.lh = [-0.24, Math.min(H, 1.95 + S * stepT(c, 0)), Math.min(H, 1.95 + S * stepT(c, 0)) >= H ? face + 0.06 : face - 0.04];
      o.ik.rh = [0.24, Math.min(H, 1.95 + S * stepT(c, 0.5)), Math.min(H, 1.95 + S * stepT(c, 0.5)) >= H ? face + 0.06 : face - 0.04];
      o.ik.lf = [-0.15, 0.45 + S * stepT(c, 0.25), face - 0.17]; o.ik.rf = [0.15, 0.45 + S * stepT(c, 0.75), face - 0.17];
      o.gl = 0.7 + 0.3 * (1 - liftT(c, 0)); o.gr = 0.7 + 0.3 * (1 - liftT(c, 0.5));
      o.ik.wh = seg(t, 0.1, 0.16); o.ik.wf = seg(t, 0.12, 0.18); o.bz = Math.sin(c * TAU) * 0.05;
    } else if (t < 0.78) { // pull up on the top edge, then press over it
      const k = seg(t, 0.55, 0.78); o.u = lerp(rz, L / 2 - 0.05, seg(k, 0.4, 1)) / L; o.y = lerp(S * n, H, easeOut(k));
      o.P = 0.1 + 0.6 * Math.sin(Math.PI * k); o.ik.lh = [-0.24, H, face + 0.08]; o.ik.rh = [0.24, H, face + 0.08]; o.ik.wh = 1 - seg(k, 0.7, 1);
      o.gl = o.gr = 1 - seg(k, 0.7, 1); o.llx = -1.4 * Math.sin(Math.PI * k); o.lkx = 1.8 * Math.sin(Math.PI * k); o.rlx = -0.5; o.rkx = 0.9;
      o.ik.lf = [-0.15, 0.45 + S * n, face - 0.17]; o.ik.rf = null; o.ik.wf = 1 - seg(k, 0, 0.35);
    } else { // drop down the far side and absorb
      const k = (t - 0.78) / 0.22, fall = seg(k, 0, 0.45, easeIn), land = Math.sin(Math.PI * clamp01((k - 0.4) / 0.6));
      o.u = lerp(L / 2 - 0.05, L, easeOut(k)) / L; o.y = H * (1 - fall) - legDrop(-1.1 * land, 1.7 * land) * land;
      o.llx = o.rlx = -0.6 * (1 - k) - 1.1 * land; o.lkx = o.rkx = 0.8 * (1 - k) + 1.7 * land;
      o.lax = o.rax = -1.0 * (1 - k); o.laz = -0.5 * land; o.raz = 0.5 * land; o.P = 0.3 * land;
    }
    return o;
  },
  net(t, L, v) {
    const o = { ...NEUTRAL, ik: {} }, top = 2.35, nz = L / 2, S = 0.33, n = 3;
    o.R = Math.sin(t * 7 + v.ph) * 0.02;
    if (t < 0.1) { const k = t / 0.1; steps(o, k * 2 * Math.PI, 0.45, 0.6); o.u = lerp(0, nz - 0.4, k) / L; o.lax = o.rax = -0.8 * k; }
    else if (t < 0.45) {
      const k = (t - 0.1) / 0.35, c = k * n; o.u = (nz - 0.4) / L; o.y = S * c; o.P = 0.06; o.hx = -0.35;
      o.ik.lh = [-0.25, Math.min(top, 1.95 + S * stepT(c, 0)), nz - 0.05]; o.ik.rh = [0.25, Math.min(top, 1.95 + S * stepT(c, 0.5)), nz - 0.05];
      o.ik.lf = [-0.18, 0.45 + S * stepT(c, 0.25), nz - 0.13]; o.ik.rf = [0.18, 0.45 + S * stepT(c, 0.75), nz - 0.13];
      o.ik.wh = seg(t, 0.08, 0.14); o.ik.wf = seg(t, 0.1, 0.16); o.gl = 1 - 0.6 * liftT(c, 0); o.gr = 1 - 0.6 * liftT(c, 0.5);
    } else if (t < 0.6) { // over the top bar, turning to face the net
      const k = seg(t, 0.45, 0.6); o.u = lerp(nz - 0.4, nz + 0.4, k) / L; o.y = S * n + Math.sin(Math.PI * k) * 0.35; o.yaw = Math.PI * k;
      o.P = 0.8 * Math.sin(Math.PI * k); const sx = k < 0.5 ? 1 : -1;
      o.ik.lh = [-0.25 * sx, top, nz]; o.ik.rh = [0.25 * sx, top, nz]; o.ik.wh = k < 0.4 || k > 0.6 ? 1 : 0.3; o.gl = o.gr = 1;
      o.llx = -1.5 * Math.sin(Math.PI * k); o.lkx = 1.6 * Math.sin(Math.PI * k); o.rlx = -0.9 * Math.sin(Math.PI * k); o.rkx = 1.2 * Math.sin(Math.PI * k);
    } else if (t < 0.88) { // climb down facing the net (−z), so the rig's left is +x
      const k = (t - 0.6) / 0.28, c = (1 - k) * n; o.u = (nz + 0.4) / L; o.y = S * c; o.yaw = Math.PI; o.P = 0.06; o.hx = 0.3;
      o.ik.lh = [0.25, Math.min(top, 1.95 + S * stepT(c, 0)), nz + 0.05]; o.ik.rh = [-0.25, Math.min(top, 1.95 + S * stepT(c, 0.5)), nz + 0.05];
      o.ik.lf = [0.18, 0.45 + S * stepT(c, 0.25), nz + 0.13]; o.ik.rf = [-0.18, 0.45 + S * stepT(c, 0.75), nz + 0.13];
      o.ik.wh = 1 - seg(t, 0.84, 0.88); o.ik.wf = 1 - seg(t, 0.82, 0.86); o.gl = o.gr = 1 - seg(t, 0.84, 0.88);
    } else { const k = seg(t, 0.88, 1); o.u = lerp(nz + 0.4, L, k) / L; o.yaw = Math.PI + Math.PI * k; const b = Math.sin(Math.PI * k);
      o.llx = o.rlx = -0.7 * b; o.lkx = o.rkx = 1.1 * b; o.y = -legDrop(-0.7 * b, 1.1 * b) * b * 0.6; }
    return o;
  },
  monkey(t, L, v) {
    const o = { ...NEUTRAL, ik: {} }, bar = 2.62, n = Math.max(4, Math.round(L * 2.4)), D = L / n, moves = n - 1;
    const hang = sp => bar - 1.36 - Math.sqrt(Math.max(0.05, 0.69 * 0.69 - (sp / 2) ** 2));
    const idx = (c, start) => { const cc = c - start; if (cc < 0) return start; const e = 2 * Math.floor(cc / 2), f = cc - e; return start + (f < 1 ? e + 2 * smooth(f) : e + 2); };
    const lift = (c, start) => { const cc = c - start; if (cc < 0) return 0; const f = cc - 2 * Math.floor(cc / 2); return f < 1 ? Math.sin(Math.PI * f) : 0; };
    if (t < 0.12) { // crouch and jump up to the first two rungs
      const k = seg(t, 0, 0.12, x => x), cr = Math.sin(Math.PI * Math.min(1, k * 2));
      o.u = lerp(0, D / 2, k) / L; o.y = k < 0.5 ? -legDrop(-0.8 * cr, 1.3 * cr) : hang(D) * easeOut((k - 0.5) * 2);
      o.llx = o.rlx = -0.8 * cr; o.lkx = o.rkx = 1.3 * cr; o.lax = o.rax = lerp(0.5, -2.9, seg(k, 0.3, 1));
      o.ik.lh = [-0.14, bar, 0]; o.ik.rh = [0.14, bar, D]; o.ik.wh = seg(k, 0.6, 1); o.gl = o.gr = seg(k, 0.8, 1);
    } else if (t < 0.86) {
      const k = (t - 0.12) / 0.74, c = k * moves, li = idx(c, 0), ri = idx(c, 1), ll = lift(c, 0), rl = lift(c, 1);
      const zl = li * D, zr = ri * D; o.u = (zl + zr) / 2 / L; o.y = hang(Math.abs(zl - zr));
      o.ik.lh = [-0.14, bar - ll * 0.12, zl]; o.ik.rh = [0.14, bar - rl * 0.12, zr]; o.ik.wh = 1;
      o.gl = 1 - ll * 0.9; o.gr = 1 - rl * 0.9;
      const sw = Math.sin(c * Math.PI); o.by = -sw * 0.25; o.R = sw * 0.07; o.P = Math.cos(c * TAU) * 0.08;
      o.llx = -0.35 + Math.cos(c * Math.PI) * 0.35; o.rlx = -0.25 - Math.cos(c * Math.PI) * 0.35; o.lkx = 0.6 + ll * 0.4; o.rkx = 0.6 + rl * 0.4; o.hx = -0.25;
    } else { // drop and absorb
      const k = seg(t, 0.86, 1, x => x), fall = easeIn(Math.min(1, k * 2)), b = Math.sin(Math.PI * clamp01((k - 0.35) / 0.65));
      const z0 = (n - 1.5) * D; o.u = lerp(z0, L, k) / L; o.y = hang(D) * (1 - fall) - legDrop(-1.0 * b, 1.6 * b) * b;
      o.ik.lh = [-0.14, bar, (n - 1) * D]; o.ik.rh = [0.14, bar, n * D]; o.ik.wh = 1 - seg(k, 0, 0.25);
      o.lax = o.rax = lerp(-2.9, 0, smooth(k)); o.llx = o.rlx = -1.0 * b; o.lkx = o.rkx = 1.6 * b; o.P = 0.3 * b; o.laz = -0.4 * b; o.raz = 0.4 * b;
    }
    return o;
  },
  swing(t, L, v) {
    const o = { ...NEUTRAL, ik: {} }, G = swingGeom(L), { A, PH, Rf, R, pivY } = G, cz = L / 2;
    const grabZ = cz - Rf * Math.sin(A);
    o.ropeA = -A;
    if (t < 0.12) { mount(o, seg(t, 0, 0.12), PH); o.u = lerp(0, 0.05, t / 0.12); }
    else if (t < 0.3) { // run-up across the platform
      const k = (t - 0.12) / 0.18; steps(o, k * 3 * Math.PI, 0.7, 1.0); o.y = PH + Math.abs(Math.sin(k * 3 * Math.PI)) * 0.06;
      o.u = lerp(0.05 * L, grabZ, k) / L; o.lax = -o.llx * 0.8 - 1.8 * seg(k, 0.6, 1); o.rax = -o.rlx * 0.8 - 1.8 * seg(k, 0.6, 1); o.lex = o.rex = -1.0 * (1 - k); o.P = 0.15;
      o.ik.lh = [0, pivY - (R - 0.04) * Math.cos(A), cz - (R - 0.04) * Math.sin(A)]; o.ik.rh = [0, pivY - (R - 0.18) * Math.cos(A), cz - (R - 0.18) * Math.sin(A)]; o.ik.wh = seg(k, 0.75, 1);
    } else if (t < 0.82) { // on the rope: the body hangs along it, so it pitches with the swing
      const k = (t - 0.3) / 0.52, a = -A + 2 * A * smooth(k);
      o.ropeA = a; o.u = (cz + Rf * Math.sin(a)) / L; o.y = pivY - Rf * Math.cos(a); o.P = -a;
      const hand = r => [0, pivY - r * Math.cos(a), cz + r * Math.sin(a)];
      o.ik.lh = hand(R - 0.04); o.ik.rh = hand(R - 0.18); o.ik.wh = 1; o.gl = o.gr = 1;
      const tuck = Math.sin(Math.PI * k);
      o.llx = o.rlx = -1.25 * tuck - 0.2; o.lkx = o.rkx = 1.5 * tuck + 0.2; o.hx = 0.1;
      o.lax = o.rax = -3.0;
    } else { // release onto the far platform, absorb, then step down
      const k = (t - 0.82) / 0.18, land = seg(k, 0, 0.35), b = Math.sin(Math.PI * clamp01(k / 0.6)), down = seg(k, 0.6, 1);
      o.ropeA = A * Math.cos(k * 4) * (1 - k * 0.5);
      o.u = lerp(cz + Rf * Math.sin(A), L, seg(k, 0, 1)) / L; o.y = lerp(PH + 0.1 * Math.sin(Math.PI * land), 0, easeIn(down)) - legDrop(-1.0 * b, 1.7 * b) * b * (1 - down);
      o.P = -A * (1 - land) + 0.35 * b; o.llx = o.rlx = -1.0 * b; o.lkx = o.rkx = 1.7 * b;
      o.lax = o.rax = lerp(-3.0, -0.4, land) * (1 - down); o.laz = -0.6 * b; o.raz = 0.6 * b; o.gl = o.gr = 1 - land;
    }
    return o;
  }
};
// FK baseline for the styles above (old functions kept as the arm/leg fallback when a limb is not locked).
for (const k in STYLES2) { const fk = STYLES[k]; STYLES[k + '_fk'] = fk; }
Object.assign(STYLES, STYLES2);
STYLES.balance = (t, L, v) => { const o = STYLES.balance_fk(t, L, v); o.ik = {}; feetOnLine(o, L, 0.67, 0.14, 0.86, t, 0.3, 0.03); return o; };
STYLES.tightrope = (t, L, v) => { const o = STYLES.tightrope_fk(t, L, v); o.ik = {}; feetOnLine(o, L, 1.03, 0.15, 0.86, t, 0.3, 0.04);
  const c = o.u * L / 0.4; o.ik.lh = [-0.08, 2.0, 0.4 * stepT(c, 0, 0.4) + 0.25]; o.ik.rh = [0.08, 2.0, 0.4 * stepT(c, 0.5, 0.4) + 0.05];
  o.ik.wh = seg(t, 0.06, 0.15) * (1 - seg(t, 0.86, 0.94)); return o; };
STYLES.shimmy = (t, L, v) => { const o = STYLES.shimmy_fk(t, L, v); o.ik = {}; const c = o.u * L / 0.36;
  o.ik.rh = [-0.3, 2.16, 0.36 * stepT(c, 0.5) + 0.05]; o.ik.lh = [-0.3, 2.16, 0.36 * stepT(c, 0) - 0.3];
  o.ik.rf = [-0.2, 0.7 + liftT(c, 0.25) * 0.06, 0.36 * stepT(c, 0.25)]; o.ik.lf = [-0.2, 0.7 + liftT(c, 0.75) * 0.06, 0.36 * stepT(c, 0.75) - 0.3];
  o.ik.wh = seg(t, 0.08, 0.16) * (1 - seg(t, 0.84, 0.9)); o.ik.wf = seg(t, 0.13, 0.16) * (1 - seg(t, 0.86, 0.88)); o.P = 0.04; return o; };

// Analytic two-bone solver. pivot: shoulder/hip group (Euler order ZXY), joint: elbow/knee hinge (x only).
// upper/lower: bone lengths; target: world-space point; w: blend from the current (FK) pose.
const _t = { x: 0, y: 0, z: 0 };
const wrapLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
export function solveLimb(pivot, joint, upper, lower, target, w, arm) {
  if (!(w > 0)) return;
  const par = pivot.parent; par.updateWorldMatrix(true, false);
  const lt = par.worldToLocal(target.clone()).sub(pivot.position);
  const raw = lt.length() || 1e-4, d = Math.min(upper + lower - 0.002, Math.max(Math.abs(upper - lower) + 0.02, raw));
  lt.multiplyScalar(d / raw);
  const cosI = Math.max(-1, Math.min(1, (upper * upper + lower * lower - d * d) / (2 * upper * lower)));
  const bend = Math.PI - Math.acos(cosI), e = arm ? -bend : bend;
  const hy = -upper - lower * Math.cos(e), hz = -lower * Math.sin(e);
  const y1 = (lt.y > 0 && arm ? 1 : -1) * Math.hypot(lt.x, lt.y);
  const beta = Math.atan2(lt.z, y1) - Math.atan2(hz, hy), gamma = Math.atan2(-lt.x / (y1 || 1e-4), lt.y / (y1 || 1e-4));
  pivot.rotation.set(wrapLerp(pivot.rotation.x, beta, w), wrapLerp(pivot.rotation.y, 0, w), wrapLerp(pivot.rotation.z, gamma, w));
  joint.rotation.x = lerp(joint.rotation.x, e, w);
  void _t;
}

// Failure: slip partway across, stumble, fall to the ground beside the obstacle, sit stunned, then stand.
// Returns { pose, impact } where impact is true from the moment the body hits the ground.
const FAIL_AT = 0.45;
function failPose(style, t, L, v) {
  const fn = STYLES[style];
  if (t < 0.4) return { pose: fn(FAIL_AT * (t / 0.4), L, v), impact: false };
  const base = fn(FAIL_AT, L, v), k = (t - 0.4) / 0.6;
  const st = seg(k, 0, 0.22), fall = seg(k, 0.22, 0.42, easeIn), sit = seg(k, 0.42, 0.7), up = seg(k, 0.7, 1);
  const side = v.side, o = { ...base };
  if (base.ik) o.ik = { ...base.ik, wh: (base.ik.wh || 0) * (1 - st), wf: (base.ik.wf || 0) * (1 - st) };
  const back = style === 'wall' || style === 'net' || style === 'pipe';
  // stumble: flailing arms and a big lurch
  const fl = Math.sin(k * 55) * st * (1 - fall);
  o.R = base.R + side * (0.25 * st + 1.1 * fall) * (1 - sit) * (back ? 0.2 : 1);
  o.P = back ? base.P * (1 - fall) - 0.6 * fall * (1 - sit) : base.P * (1 - fall);
  o.laz = lerp(base.laz, -1.9 + fl, st * (1 - sit)); o.raz = lerp(base.raz, 1.9 - fl, st * (1 - sit));
  o.lax = lerp(base.lax, -1.0 + fl, st) ; o.rax = lerp(base.rax, -1.2 - fl, st); o.gl = o.gr = base.gl * (1 - st);
  o.s = base.s + (back ? 0 : side * 0.95 * fall);
  o.u = back ? lerp(base.u, Math.max(-0.1, base.u - 0.85 / L - (style === 'pipe' ? 0.2 : 0)), fall) : base.u;
  o.y = base.y * (1 - fall) + Math.sin(Math.PI * fall) * 0.15;
  // seated on the ground after the fall, then stand back up
  const sitH = -0.42;
  o.llx = lerp(lerp(base.llx, -0.8, fall), -1.45, sit); o.rlx = lerp(lerp(base.rlx, -0.5, fall), -1.3, sit);
  o.lkx = lerp(lerp(base.lkx, 0.6, fall), 0.9, sit); o.rkx = lerp(lerp(base.rkx, 0.4, fall), 1.4, sit);
  o.y = lerp(o.y, sitH, sit);
  if (sit > 0) { o.laz = lerp(o.laz, -0.4, sit); o.raz = lerp(o.raz, 0.4, sit); o.lax = lerp(o.lax, 0.5, sit); o.rax = lerp(o.rax, 0.5, sit); o.hx = lerp(base.hx, 0.4, sit); o.bx = lerp(base.bx, -0.15, sit); }
  return { pose: up > 0 ? mixPose({ ...o, ik: null }, { ...NEUTRAL, u: o.u, s: o.s, yaw: o.yaw * (1 - up) }, up) : o, impact: k >= 0.42 };
}

// Per-crossing random variation so no two crossings look identical.
export function agilityVariation(rng = Math.random) {
  return { swayF: 0.7 + rng() * 0.6, ph: rng() * TAU, wobAt: rng() < 0.55 ? 0.3 + rng() * 0.45 : -1, side: rng() < 0.5 ? -1 : 1, speed: 0.92 + rng() * 0.16 };
}
export function agilityPose(style, t, L, v, failed) {
  if (failed) return failPose(style, t, L, v);
  return { pose: (STYLES[style] || STYLES.gap)(t, L, v), impact: false };
}

// Write a pose onto the player rig. `w` blends from the pose captured at the start (snap) for a smooth entry.
export function snapshotRig(pm) {
  const p = pm.parts, e = a => a.userData.elbow, kn = l => l.userData.knee;
  return { bx: p.body.rotation.x, by: p.body.rotation.y, bz: p.body.rotation.z, hx: p.headG.rotation.x,
    lax: p.leftArm.rotation.x, laz: p.leftArm.rotation.z, lex: e(p.leftArm).rotation.x, rax: p.rightArm.rotation.x, raz: p.rightArm.rotation.z, rex: e(p.rightArm).rotation.x,
    llx: p.leftLeg.rotation.x, llz: p.leftLeg.rotation.z, lkx: kn(p.leftLeg).rotation.x, rlx: p.rightLeg.rotation.x, rlz: p.rightLeg.rotation.z, rkx: kn(p.rightLeg).rotation.x,
    P: 0, R: 0, gl: 0, gr: 0 };
}
const HIP_Y = 0.9;
function setGrip(arm, g) {
  const hand = arm.userData.elbow.children.find(o => o.userData.curl);
  if (hand) hand.userData.curl(Math.round((0.3 + 0.7 * g) * 50) / 50); // jointed fingers close around the hold
}
export function applyRigPose(pm, o) {
  const p = pm.parts, e = a => a.userData.elbow, kn = l => l.userData.knee;
  pm.mesh.rotation.order = 'YXZ';
  pm.mesh.rotation.x = o.P; pm.mesh.rotation.z = o.R;
  p.body.rotation.set(o.bx, o.by, o.bz);
  // pivot the torso about the hips rather than the feet
  p.body.position.set(HIP_Y * Math.sin(o.bz), HIP_Y * (1 - Math.cos(o.bx) * Math.cos(o.bz)), -HIP_Y * Math.sin(o.bx));
  p.headG.rotation.x = o.hx; p.headG.rotation.y = 0;
  p.leftArm.rotation.set(o.lax, 0, o.laz); e(p.leftArm).rotation.x = o.lex;
  p.rightArm.rotation.set(o.rax, 0, o.raz); e(p.rightArm).rotation.x = o.rex;
  p.leftLeg.rotation.set(o.llx, 0, o.llz); kn(p.leftLeg).rotation.x = o.lkx;
  p.rightLeg.rotation.set(o.rlx, 0, o.rlz); kn(p.rightLeg).rotation.x = o.rkx;
  setGrip(p.leftArm, o.gl); setGrip(p.rightArm, o.gr);
}
// Clear the agility-only channels so walk and idle take over cleanly.
export function releaseRig(pm) {
  const p = pm.parts;
  pm.mesh.rotation.x = 0; pm.mesh.rotation.z = 0; p.body.position.set(0, 0, 0); p.headG.rotation.x = 0;
  for (const l of [p.leftArm, p.rightArm, p.leftLeg, p.rightLeg]) { l.rotation.y = 0; l.rotation.z = 0; }
  setGrip(p.leftArm, 0); setGrip(p.rightArm, 0);
}

// ---------------------------------------------------------------------------
// Stage-3 contact locks: hands and feet stay planted through mantles, rolls, take-offs,
// landings, the pipe crawl and the fail fall (targets in obstacle space, see STYLES2).
// ---------------------------------------------------------------------------
// Plant both feet on a surface at height y under the root (rotated with the body's extra yaw).
function plantFeet(o, y, w, spread = 0.13, ahead = 0.04) {
  if (!(w > 0)) return;
  o.ik = o.ik || {};
  const z = o.u * o._L, c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), x0 = o.s || 0;
  o.ik.lf = [x0 - spread * c + ahead * s, y + 0.09, z + spread * s + ahead * c];
  o.ik.rf = [x0 + spread * c + ahead * s, y + 0.09, z - spread * s + ahead * c];
  o.ik.wf = Math.max(o.ik.wf && o.ik.lf ? o.ik.wf : 0, clamp01(w));
}
const wrapL = fn => (t, L, v) => { const o = fn(t, L, v); o._L = L; o.ik = o.ik || {}; return o; };
const S3 = {}, BASE = { ...STYLES };
S3.wall = (t, L, v) => {
  const o = wrapL(BASE.wall)(t, L, v), H = 2.2, face = L / 2 - 0.3;
  if (t >= 0.55 && t < 0.78) { // mantle: lead foot steps from the top hold onto the wall top, trailing foot follows
    const k = seg(t, 0.55, 0.78);
    o.ik.rf = [0.15, lerp(1.0, H + 0.09, seg(k, 0.25, 0.6)), lerp(face - 0.17, face + 0.12, seg(k, 0.35, 0.65))];
    o.ik.lf = [-0.15, lerp(0.9, H + 0.09, seg(k, 0.55, 0.95)), lerp(face - 0.17, face + 0.05, seg(k, 0.6, 0.95))];
    o.ik.wf = 1;
    // palms press down on the top as the hips rise past them
    o.ik.lh = [-0.24, H + 0.02, face + 0.08 + 0.12 * seg(k, 0.4, 0.8)]; o.ik.rh = [0.24, H + 0.02, face + 0.08 + 0.12 * seg(k, 0.4, 0.8)];
    o.ik.wh = 1 - seg(k, 0.8, 1);
  } else if (t >= 0.78) { const k = (t - 0.78) / 0.22; if (k < 0.12) plantFeet(o, H, 1 - k / 0.12); plantFeet(o, 0, seg(k, 0.38, 0.5)); }
  return o;
};
S3.net = (t, L, v) => {
  const o = wrapL(BASE.net)(t, L, v), nz = L / 2;
  if (t >= 0.45 && t < 0.6) { // feet stay in the mesh while the torso rolls over the bar
    const k = seg(t, 0.45, 0.6), far = k > 0.5, sx = far ? -1 : 1;
    o.ik.lf = [-0.18 * sx, 1.0 + 0.2 * Math.sin(Math.PI * k), nz + (far ? 0.13 : -0.13)]; o.ik.rf = [0.18 * sx, 1.0 + 0.2 * Math.sin(Math.PI * k), nz + (far ? 0.13 : -0.13)];
    o.ik.wf = Math.abs(Math.cos(Math.PI * k)) * 0.9 + 0.1;
  } else if (t >= 0.88) { const k = seg(t, 0.88, 1); plantFeet(o, 0, seg(k, 0.15, 0.3)); }
  return o;
};
S3.gap = (t, L, v) => {
  const o = wrapL(BASE.gap)(t, L, v), H = 0.8;
  if (t >= 0.14 && t < 0.32) plantFeet(o, H, seg(t, 0.14, 0.17));
  else if (t >= 0.32 && t < 0.62) { const k = (t - 0.32) / 0.3; if (k < 0.12) plantFeet(o, H, 1 - k / 0.12); } // toes push off the edge
  else if (t >= 0.62 && t < 0.8) plantFeet(o, H, seg(t, 0.62, 0.64));
  else if (t >= 0.8) plantFeet(o, 0, seg(t, 0.93, 0.97));
  else if (t < 0.14) plantFeet(o, 0, 1 - seg(t, 0.0, 0.03));
  return o;
};
S3.monkey = (t, L, v) => {
  const o = wrapL(BASE.monkey)(t, L, v);
  if (t < 0.12) { const k = t / 0.12; plantFeet(o, 0, k < 0.45 ? 1 : 1 - seg(k, 0.45, 0.55)); }
  else if (t >= 0.86) { const k = (t - 0.86) / 0.14; plantFeet(o, 0, seg(k, 0.4, 0.5)); }
  else { const sw = Math.sin((t - 0.12) * 9); o.llz = 0.05 + sw * 0.04; o.rlz = -0.05 + sw * 0.04; } // legs trail together, ankles loosely crossed
  return o;
};
S3.swing = (t, L, v) => {
  const o = wrapL(BASE.swing)(t, L, v), G = swingGeom(L);
  if (t < 0.12) plantFeet(o, 0, 1 - seg(t, 0.06, 0.11));
  else if (t >= 0.82) { const k = (t - 0.82) / 0.18; plantFeet(o, k < 0.6 ? G.PH : 0, k < 0.6 ? seg(k, 0.08, 0.16) * (1 - seg(k, 0.55, 0.6)) : seg(k, 0.9, 0.97)); }
  else if (t >= 0.3) { o.lkx += 0.1; o.rkx += 0.15; o.llz = 0.04; o.rlz = -0.04; } // feet pressed together on the swing
  return o;
};
S3.pipe = (t, L, v) => {
  const o = wrapL(BASE.pipe)(t, L, v), F = 0.13; // inner floor of the pipe
  const on = seg(t, 0.12, 0.22) * (1 - seg(t, 0.82, 0.9));
  if (on > 0) {
    const z = o.u * L, c = z / 0.32;
    o.ik.lh = [-0.17, F + 0.04 + liftT(c, 0) * 0.07, 1.3 + 0.32 * stepT(c, 0) - z + z];
    o.ik.lh[2] = z + 1.18 + 0.32 * (stepT(c, 0) - c); o.ik.rh = [0.17, F + 0.04 + liftT(c, 0.5) * 0.07, z + 1.18 + 0.32 * (stepT(c, 0.5) - c) + 0.16];
    // knees on the floor: the ankle trails flat behind the knee
    o.ik.lf = [-0.13, F + 0.12 + liftT(c, 0.5) * 0.05, z + 0.42 + 0.32 * (stepT(c, 0.5) - c) - 0.16]; o.ik.rf = [0.13, F + 0.12 + liftT(c, 0) * 0.05, z + 0.42 + 0.32 * (stepT(c, 0) - c)];
    o.ik.wh = on; o.ik.wf = on;
  } else plantFeet(o, 0, 1);
  return o;
};
for (const k in S3) STYLES[k] = S3[k];
// Fail fall: after the impact the palms and heels are planted on the ground beside the obstacle.
const _failPose = failPose;
function failPose3(style, t, L, v) {
  const r = _failPose(style, t, L, v);
  if (t < 0.4) return r;
  const k = (t - 0.4) / 0.6, sit = seg(k, 0.42, 0.7), up = seg(k, 0.7, 1), o = r.pose;
  const w = sit * (1 - up);
  if (w > 0) {
    o._L = L; o.ik = { ...(o.ik || {}) }; const z = o.u * L, x = o.s || 0;
    o.ik.lh = [x - 0.3, 0.05, z - 0.3]; o.ik.rh = [x + 0.3, 0.05, z - 0.3]; o.ik.wh = w;
    o.ik.lf = [x - 0.17, 0.08, z + 0.7]; o.ik.rf = [x + 0.15, 0.1, z + 0.45]; o.ik.wf = w;
  } else if (up >= 1 || k > 0.95) { o._L = L; plantFeet(o, 0, 1); }
  return r;
}
export function agilityPose3(style, t, L, v, failed) {
  if (failed) return failPose3(style, t, L, v);
  return { pose: (STYLES[style] || STYLES.gap)(t, L, v), impact: false };
}
