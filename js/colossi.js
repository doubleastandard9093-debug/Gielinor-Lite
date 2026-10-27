// Colossi: three huge creatures that walk fixed routes around the Contested Wilds. Only one is awake per area.
// Low uses the existing creature mesh scaled up; a High-only detail mesh is added lazily.
export const COLOSSI = {
  stonehorn: { name: 'Stonehorn', title: 'Stonehorn the Walking Hill', base: 'Ogre', scale: 4, hp: 4200, maxHit: 70, att: 70, def: 60, level: 140, area: 'north',
    route: [[96, -100], [120, -92], [146, -100], [150, -80], [110, -80]] },
  frostmaw: { name: 'Frostmaw', title: 'Frostmaw of the Cold Scar', base: 'Ice Giant', scale: 3.5, hp: 4600, maxHit: 76, att: 74, def: 66, level: 150, area: 'east',
    route: [[160, -110], [172, -130], [166, -150], [150, -140], [152, -118]] },
  ashwyrm: { name: 'Ashwyrm', title: 'Ashwyrm, Old Cinderback', base: 'Green Dragon', scale: 3, hp: 5200, maxHit: 84, att: 80, def: 70, level: 165, area: 'south',
    route: [[96, -150], [118, -164], [140, -160], [128, -144], [104, -138]] }
};
export const PARTS = { horn: 0.12, legs: 0.15 }; // part hp as a share of max hp
export const BACK_BONUS = 0.2, CHARGE = { every: 14, warn: 2, range: 7, dmg: 0.22 }, RESPAWN_MS = 10 * 60 * 1000;
export const CHEST = { coins: 4000, tokens: 25, rep: 60 };
// angle between the colossus facing and the direction to the attacker; > 120 degrees = behind.
export function isBehind(mx, mz, myaw, px, pz) {
  const fx = Math.sin(myaw), fz = Math.cos(myaw), dx = px - mx, dz = pz - mz, d = Math.hypot(dx, dz) || 1;
  return (dx * fx + dz * fz) / d < -0.5;
}
export function normalizeColossi(c) {
  c = c && typeof c === 'object' ? c : {};
  const kills = {}; for (const k of Object.keys(COLOSSI)) kills[k] = Math.max(0, Math.floor(+(c.kills || {})[k] || 0));
  return { kills, parts: Math.max(0, Math.floor(+c.parts || 0)) };
}
