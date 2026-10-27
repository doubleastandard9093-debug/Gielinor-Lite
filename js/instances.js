// Instanced spaces (Hearth & Arena): small flat zones far west of the map (x < -700).
// Out there the overworld chunks are beyond load range, so the world is effectively unloaded while you're inside.
export const INSTANCE_X = -700;
export const HEARTH = { x: -1000, z: 0, hw: 12, hd: 9, door: { x: -1000, z: 8 }, stone: { x: -1000, z: 0 } };
export const ARENA = { x: -1000, z: -200, r: 13, gate: { x: -1000, z: -188 } };
export function inInstance(x) { return x < INSTANCE_X; }
export function instanceAt(x, z) {
  if (!inInstance(x)) return null;
  return Math.abs(z - HEARTH.z) < 60 ? 'hearth' : 'arena';
}
// Keep a walker inside the instance it's in.
export function clampInstance(pos) {
  if (instanceAt(pos.x, pos.z) === 'hearth') {
    pos.x = Math.max(HEARTH.x - HEARTH.hw + 0.6, Math.min(HEARTH.x + HEARTH.hw - 0.6, pos.x));
    pos.z = Math.max(HEARTH.z - HEARTH.hd + 0.6, Math.min(HEARTH.z + HEARTH.hd - 0.6, pos.z));
  } else {
    const dx = pos.x - ARENA.x, dz = pos.z - ARENA.z, d = Math.hypot(dx, dz), R = ARENA.r - 0.6;
    if (d > R) { pos.x = ARENA.x + dx / d * R; pos.z = ARENA.z + dz / d * R; }
  }
}
