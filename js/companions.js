// Sworn Companions: four recruitable allies. One can follow you at a time and helps in fights.
// Bond (0-10) rises with gifts and with dialogue-wheel tones they like, and unlocks perks.
// Logic and data only; each companion is an ordinary townsperson model (same LOD rules as every NPC).

export const COMPANIONS = [
  { id: 'tamsin', name: 'Tamsin the Squire', short: 'Tamsin', face: '🛡️', x: 7, z: -11, look: { body: 0x7a8aa0, legs: 0x3a3a4a, hat: 0xa0a8b4, hatH: 0.2, apron: 0x2a4a8a },
    role: 'Squire', skills: ['Defence', 'Attack'], likes: 'kind', giftRe: /^Cooked |Bread|Cake|Pie|Stew/, giftWord: 'cooked food',
    style: 'melee', examine: 'A young squire with a dented shield and a big heart.',
    recruit: { kind: 'kill', mon: 'Goblin', n: 5, ask: 'Goblins keep raiding the farms east of here. Help me drive off five of them and I\'ll ride with you.' } },
  { id: 'ysolde', name: 'Ysolde the Ranger', short: 'Ysolde', face: '🏹', x: 44, z: -30, look: { body: 0x2a5a2a, legs: 0x3a2a1a, hat: 0x1e4a1e, hatH: 0.2 },
    role: 'Ranger', skills: ['Ranged', 'Agility'], likes: 'cunning', giftRe: /arrows$|Feather|hide|leather/i, giftWord: 'arrows, feathers or hides',
    style: 'ranged', examine: 'A sharp-eyed ranger who says little and misses less.',
    recruit: { kind: 'item', item: 'Bronze arrows', n: 25, req: ['Ranged', 10], ask: 'My quiver is empty. Bring me 25 bronze arrows and show me you can shoot, and I\'ll watch your back.' } },
  { id: 'brannoc', name: 'Brannoc Ironbeard', short: 'Brannoc', face: '⚒️', x: -54, z: -70, look: { body: 0x5a4a3a, legs: 0x3a2a1a, hat: 0x6a5a4a, hatH: 0.2, beard: 0xc06a2a, apron: 0x3a3a3a },
    role: 'Dwarf smith', skills: ['Smithing', 'Mining'], likes: 'firm', giftRe: / bar$| ore$|Coal/, giftWord: 'ores and bars',
    style: 'melee', examine: 'A stout dwarf smith with soot in his braids.',
    recruit: { kind: 'item', item: 'Iron bar', n: 3, req: ['Smithing', 15], ask: 'You want a dwarf at your side? Prove you know the forge. Three iron bars, smelted by your own hand.' } },
  { id: 'mirelle', name: 'Mirelle the Hedge-mage', short: 'Mirelle', face: '🔮', x: -74, z: 54, look: { body: 0x5a2a6a, legs: 0x2a1a3a, hat: 0x3a2a4a, hatH: 0.45, hatW: 0.4 },
    role: 'Hedge-mage', skills: ['Magic', 'Herblore'], likes: 'cunning', giftRe: / rune$|Grimy |leaf$|Marrentill|Tarromin/, giftWord: 'runes or herbs',
    style: 'magic', examine: 'A wandering hedge-mage who smells faintly of thyme and thunder.',
    recruit: { kind: 'item', item: 'Air rune', n: 30, req: ['Magic', 10], ask: 'The sea air ate my rune pouch. Thirty air runes and a little magic of your own, and I\'ll travel with you.' } }
];
export const BOND_MAX = 10;
export const GIFT_COOLDOWN_MS = 10 * 60 * 1000;
export const BOND_PERKS = [
  { at: 3, desc: '+5% XP in their skills while they follow you' },
  { at: 6, desc: 'their XP bonus rises to +10% and they hit harder' },
  { at: 10, desc: 'Sworn: they hit twice as often in fights' }
];
export function companionById(id) { return COMPANIONS.find(c => c.id === id); }

// Save block: { [id]: { recruited, bond, giftAt, task } }, plus player.activeCompanion
export function normalizeCompanions(c) {
  const out = {};
  for (const d of COMPANIONS) {
    const s = c && typeof c === 'object' && c[d.id] && typeof c[d.id] === 'object' ? c[d.id] : {};
    out[d.id] = { recruited: !!s.recruited, bond: Math.max(0, Math.min(BOND_MAX, Math.floor(Number(s.bond) || 0))), giftAt: Number(s.giftAt) || 0, task: Math.max(0, Math.floor(Number(s.task) || 0)), started: !!s.started, crew: normCrew(s.crew) };
  }
  return out;
}
function normCrew(c) { const o = {}; if (c && typeof c === 'object') for (const [k, v] of Object.entries(c)) { const n = Math.floor(Number(v)); if (typeof k === 'string' && k.length < 20 && n > 0) o[k] = Math.min(n, 1e6); } return o; }
export function companionXpBonus(player, skill) {
  const id = player.activeCompanion; if (!id) return 0;
  const d = companionById(id), s = player.companions && player.companions[id];
  if (!d || !s || !s.recruited || !d.skills.includes(skill)) return 0;
  return s.bond >= 6 ? 0.10 : s.bond >= 3 ? 0.05 : 0;
}
// Bond change, clamped. Returns the new bond.
export function addBond(player, id, n) {
  const s = player.companions && player.companions[id]; if (!s || !s.recruited) return 0;
  s.bond = Math.max(0, Math.min(BOND_MAX, s.bond + n)); return s.bond;
}
// The active companion's reaction to a tone you picked: +1 bond on a liked tone (at most once per minute).
export function toneReaction(player, tone, now) {
  const id = player.activeCompanion, d = id && companionById(id), s = d && player.companions[id];
  if (!s || !s.recruited) return null;
  if (tone === d.likes && now - (s.toneAt || 0) > 60000) { s.toneAt = now; addBond(player, id, 1); return `${d.short} approves. (Bond ${s.bond}/${BOND_MAX})`; }
  return null;
}
// Assist hit size for the active companion.
export function assistMax(bond, combatLevel) { return 2 + Math.floor(combatLevel / 12) + (bond >= 6 ? 3 : 0); }
export function assistEvery(bond) { return bond >= 10 ? 3 : 6; } // ticks between hits
