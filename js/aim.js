// True Aim: optional free-aim mode. Abilities fire as shapes where you face; every foe inside is hit.
// Shape tests are plain 2D math (no physics). Classic tab-target stays the default.
export const SHAPES = {
  cone: { range: 4.2, half: Math.PI / 3 },     // 120 degree arc in front
  line: { range: 8, width: 1.4 },              // long thin strip
  circle: { ahead: 2.5, r: 3 }                 // ring just in front of you
};
export const ABIL_SHAPE = { power: 'line', snipe: 'line', rend: 'line', puncture: 'line', volley: 'cone', flurry: 'cone', bash: 'circle', challenge: 'circle' };
export const MAX_TARGETS = 6;
// Dodge-cancel window after an aimed strike, per Combat Path (ms).
export const CANCEL_MS = { bulwark: 200, mender: 260, striker: 360, none: 240 };
export const shapeFor = id => ABIL_SHAPE[id] || 'cone';
// yaw: facing angle; forward = (sin yaw, cos yaw). r = target radius.
export function inShape(shape, ox, oz, yaw, x, z, r = 0.5) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = x - ox, dz = z - oz;
  const S = SHAPES[shape];
  if (shape === 'circle') { const cx = ox + fx * S.ahead, cz = oz + fz * S.ahead; return Math.hypot(x - cx, z - cz) <= S.r + r; }
  const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
  if (shape === 'line') return along >= -r && along <= S.range + r && side <= S.width / 2 + r;
  const d = Math.hypot(dx, dz); if (d > S.range + r) return false; if (d < 0.8) return true;
  return Math.acos(Math.max(-1, Math.min(1, along / d))) <= S.half + Math.atan2(r, d);
}
export function normalizeAim(a) { a = a && typeof a === 'object' ? a : {}; return { on: !!a.on, strikes: Math.max(0, Math.floor(+a.strikes || 0)), cancels: Math.max(0, Math.floor(+a.cancels || 0)) }; }
