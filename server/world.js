// Builds the same world layout the browser builds (js/world.js, seeded RNG) without rendering,
// so node and monster ids match the client exactly: id = index in createWorld()'s arrays.
import './register.js';
const THREE = await import('three');
const W = await import('../js/world.js');
const P = await import('../js/player.js');

const built = W.createWorld(new THREE.Scene());
export const WORLD_HALF = W.WORLD_HALF;
export const SPAWN = W.SPAWN;
export const colliders = W.colliders;
export const insideLake = W.insideLake;
export const resolveCollisions = P.resolveCollisions;
export const blockedAt = P.blockedAt;

export const NODES = built.nodes.map((n, id) => {
  const o = { id, type: n.type, name: n.name, x: n.x, z: n.z, radius: n.radius || 0.6, alive: true, respawnAt: 0 };
  for (const k of ['kind', 'ore', 'herb', 'altar', 'npc']) if (n[k] !== undefined) o[k] = n[k];
  return o;
});
export const MONSTER_SPAWNS = built.monsters.map((m, id) => {
  const o = { id };
  for (const [k, v] of Object.entries(m)) if (!['mesh', 'body', 'legs'].includes(k) && typeof v !== 'object') o[k] = v;
  o.bounds = m.bounds ? { ...m.bounds } : null;
  if (m.poison) o.poison = { ...m.poison };
  return o;
});
