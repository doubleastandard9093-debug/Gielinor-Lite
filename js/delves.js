// Delves of Three: short instanced dungeons for a party of three (you plus two companions).
// You pick a role; companions fill the other two. Rooms hold at most 8 foes (phone-friendly).
export const DELVE_Z = -400; // delves sit south of the Arena, far west (x < -700)
export const DELVE = { x: -1000, hw: 11, hd: 11 };
export const ROOM_CAP = 8;
export const ROLES = {
  tank: { name: 'Tank', desc: 'You hold their attention. Companions heal and strike.' },
  healer: { name: 'Healer', desc: 'You keep the party standing. Companions guard and strike.' },
  dps: { name: 'Striker', desc: 'You deal the damage. Companions guard and heal.' }
};
export const DELVES = {
  sewers: { name: 'The Undercroft Sewers', z: DELVE_Z, level: 20, floor: 0x2e3a2c, wall: 0x4a5246,
    rooms: [[['Zombie', 4]], [['Giant Spider', 3], ['Zombie', 2]], [['Skeleton', 5], ['Moss Giant', 1]]], coins: 600, xp: 2500 },
  keep: { name: 'The Drowned Keep', z: DELVE_Z - 80, level: 35, floor: 0x26323a, wall: 0x3a4a56,
    rooms: [[['Drowned Deckhand', 5]], [['Drowned Gunner', 3], ['Drowned Deckhand', 3]], [['Drowned Gunner', 4], ['Ogre', 2]]], coins: 1400, xp: 6000 }
};
export const inDelveZone = (x, z) => x < -700 && z < DELVE_Z + 40;
export function normalizeDelves(d) {
  d = d && typeof d === 'object' ? d : {};
  const clears = {}; for (const k of Object.keys(DELVES)) clears[k] = Math.max(0, Math.floor(+(d.clears || {})[k] || 0));
  const best = {}; for (const k of Object.keys(DELVES)) { const v = +(d.best || {})[k]; if (v > 0) best[k] = Math.floor(v); }
  return { clears, best, role: ROLES[d.role] ? d.role : 'dps' };
}
// Role effects while inside: incoming damage reduction, regen per tick, damage bonus.
export function roleFx(role) {
  if (role === 'tank') return { red: 0.25, regen: 2, dmg: 0.05 };
  if (role === 'healer') return { red: 0.3, regen: 4, dmg: 0 };
  return { red: 0.2, regen: 2, dmg: 0.15 };
}
