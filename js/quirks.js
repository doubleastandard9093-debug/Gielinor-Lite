// Scars and Quirks: the game notices how you play and offers a Quirk: a lasting downside paired with a boon.
// You may decline, hold at most 3, and remove one with Apothecary Ysolde's remedy (Herblore). Logic and UI only.
export const QUIRK_MAX = 3;
export const QUIRKS = [
  { id: 'ember', name: 'Ember-shy', counter: 'fire', at: 300, why: 'You have been burned a lot.', down: 'Fire-touched foes hit you 10% harder', up: '+5% Cooking and Smithing XP', fireMult: 1.1, xp: { Cooking: 0.05, Smithing: 0.05 } },
  { id: 'skittish', name: 'Skittish', counter: 'flee', at: 8, why: 'You run from a lot of fights.', down: 'You take 10% more damage under 30% hitpoints', up: 'Run energy drains about a third slower', lowMult: 1.1, runRefund: 0.35 },
  { id: 'glassjaw', name: 'Glass Jaw', counter: 'deaths', at: 5, why: 'You have been knocked out a few times.', down: 'You take 5% more damage', up: '+3% XP in every combat skill', allMult: 1.05, xp: { Attack: 0.03, Strength: 0.03, Defence: 0.03, Ranged: 0.03, Magic: 0.03, Hitpoints: 0.03 } },
  { id: 'brawler', name: 'Knuckle-head', counter: 'meleeKills', at: 300, why: 'You settle almost everything up close.', down: '-10% ranged accuracy', up: '+5% melee damage', rangedAcc: -0.1, meleeDmg: 0.05 }
];
export const REMEDY = { herblore: 30, gold: 2000, items: [['Grimy guam leaf', 5]], xp: 400 };
export const FIRE_RE = /dragon|fire|flame|ember|lava|infernal|blaze|cinder|ash/i;
export function quirkById(id) { return QUIRKS.find(q => q.id === id); }
export function normalizeQuirks(q) {
  q = q && typeof q === 'object' ? q : {};
  const ids = a => (Array.isArray(a) ? a.filter(id => quirkById(id)) : []);
  const held = [...new Set(ids(q.held))].slice(0, QUIRK_MAX), declined = [...new Set(ids(q.declined))];
  const counters = {}; const c = q.counters && typeof q.counters === 'object' ? q.counters : {};
  for (const k of ['fire', 'flee', 'deaths', 'meleeKills']) counters[k] = Math.max(0, Math.floor(Number(c[k]) || 0));
  return { held, declined, counters, offered: quirkById(q.offered) && !held.includes(q.offered) ? q.offered : null, removed: Math.max(0, Math.floor(Number(q.removed) || 0)) };
}
// Which quirk (if any) should be offered now.
export function dueQuirk(Q) {
  if (Q.offered || Q.held.length >= QUIRK_MAX) return null;
  const q = QUIRKS.find(x => !Q.held.includes(x.id) && !Q.declined.includes(x.id) && Q.counters[x.counter] >= x.at);
  return q ? q.id : null;
}
export const has = (Q, id) => Q.held.includes(id);
export function quirkXp(Q, skill) { let b = 0; for (const id of Q.held) { const q = quirkById(id); if (q.xp && q.xp[skill]) b += q.xp[skill]; } return b; }
export function quirkIncoming(Q, dmg, monName, hpFrac) {
  let m = 1;
  if (has(Q, 'ember') && FIRE_RE.test(monName || '')) m *= 1.1;
  if (has(Q, 'skittish') && hpFrac < 0.3) m *= 1.1;
  if (has(Q, 'glassjaw')) m *= 1.05;
  return m === 1 ? dmg : Math.max(1, Math.round(dmg * m));
}
