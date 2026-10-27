// Stable Codex: one list of every mount you've earned, Skyrook flights between towns, and a wardrobe of looks.
export const ROOSTS = ['Brightwater', 'Ashford', 'Port Sarim', 'Varrock', 'Falador'];
export const FLIGHT = { speed: 34, height: 26, minMs: 2500 };
export const MOUNTS = [
  { id: 'stag', name: 'Fernback Stag', kind: 'steed', how: 'Agility 10' },
  { id: 'boar', name: 'Ironbristle Boar', kind: 'steed', how: 'Agility 30' },
  { id: 'skyrook', name: 'Skyrook', kind: 'flyer', how: 'Visit Roostmaster Hale at Brightwater' }
];
export const LOOK_SLOTS = ['head', 'body', 'legs', 'shield', 'cape'];
export function normalizeCodex(c) {
  c = c && typeof c === 'object' ? c : {};
  const looks = {}; for (const s of LOOK_SLOTS) if (typeof (c.looks || {})[s] === 'string') looks[s] = c.looks[s];
  const seen = Array.isArray(c.seen) ? c.seen.filter(x => typeof x === 'string').slice(0, 400) : [];
  return { skyrook: !!c.skyrook, flights: Math.max(0, Math.floor(+c.flights || 0)), looks, seen };
}
